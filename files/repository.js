import { fileURLToPath } from 'node:url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import * as markdown from './markdown.js';
import * as paths from './paths.js';
import * as transaction from './transaction.js';
import model from '../prototype/workspace.js';
import { exampleWorkspace } from './example-workspace.js';
import schema from '../prototype/schema.js';
import { publicFolder, folderPlan, movePlan, vacant } from './organization.js';
import { loadDefinitions, definitionPath } from './database-definitions.js';
import { folderDatabase, folderAvailable } from '../prototype/folders.js';
import { deletePlan, restorePlan, latestDeletion } from './trash.js';
import { propertyLayoutPlan } from './property-layout.js';

async function snapshot(root, folders = []) {
  const names = await paths.walk(root, '', [], folders);
  const folded = new Set();
  const result = new Map();
  for (const name of names) {
    const key = name.normalize('NFC').toLowerCase();
    if (folded.has(key)) throw new Error(`Case or Unicode filename collision: ${name}`);
    folded.add(key);
    result.set(name, await transaction.read(root, name));
  }
  return result;
}
function parseFile(files, name, kind) {
  if (!files.has(name)) throw new Error(`Missing ${name}.`);
  const parsed = markdown.parse(files.get(name));
  if (kind && (parsed.metadata.kind !== kind || parsed.metadata.bento_version !== 1)) throw new Error(`Expected ${kind} in ${name}.`);
  return parsed;
}
function manifest(files) {
  const parsed = parseFile(files, 'workspace.md', 'workspace-definition');
  const data = parsed.metadata;
  if (!schema.identity(data.id) || typeof data.title !== 'string' || !Array.isArray(data.databases)) throw new Error('Invalid workspace.md definition.');
  if (data.organization_version !== 3) throw new Error('Unsupported workspace organization version.');
  const ids = new Set(), folders = [];
  publicFolder(data.default_page_folder || 'notes');
  for (const entry of data.databases) {
    if (!schema.identity(entry.id) || ids.has(entry.id)) throw new Error('Duplicate or invalid database identity.');
    ids.add(entry.id);
    publicFolder(entry.path);
    if (!entry.path) throw new Error('A database must have its own folder.');
    const folded = entry.path.normalize('NFC').toLowerCase();
    if (folders.some(folder => folded === folder || folded.startsWith(folder + '/') || folder.startsWith(folded + '/'))) throw new Error('Database folders must be distinct and must not nest.');
    folders.push(folded);
  }
  if (folderDatabase({ databasePaths: Object.fromEntries(data.databases.map(entry => [entry.id, entry.path])) }, data.default_page_folder || 'notes')) throw new Error('The default notes folder must be outside databases.');
  return data;
}
function contentRecord(name, parsed, database, definitions) {
  const meta = parsed.metadata;
  if (meta.kind) throw new Error(`Unregistered control document: ${name}.`);
  const id = meta.id || 'note-' + createHash('sha256').update(name).digest('hex').slice(0, 24);
  if (!schema.identity(id)) throw new Error(`Invalid identity in ${name}.`);
  const record = { bento_version: 1, ...meta, id, title: meta.title ?? path.posix.basename(name, '.md'), tags: meta.tags ?? [], properties: meta.properties ?? {}, references: meta.references ?? {}, body: parsed.body };
  delete record.database;
  if (database) {
    record.database = database;
    record.schema_version ??= definitions[database].schema_version;
  }
  return record;
}

function workspacePage(files, info) {
  const parsed = markdown.parse(files.get('workspace.md'));
  return { bento_version: 1, id: info.id, title: info.title, tags: info.tags ?? [], color: info.color ?? null,
    properties: {}, references: info.references ?? {}, body: parsed.body };
}
function workspaceEntry(repository, next) {
  const original = repository.files.get('workspace.md'), parsed = markdown.parse(original);
  const before = repository.workspace.records[repository.workspace.home], page = next.records[next.home];
  const editable = ['title', 'body', 'tags', 'references', 'color'];
  for (const key of new Set([...Object.keys(before), ...Object.keys(page)])) {
    if (!editable.includes(key) && !isDeepStrictEqual(before[key], page[key])) throw new Error('Workspace configuration cannot be changed through the page editor.');
  }
  const metadata = { ...parsed.metadata, body: parsed.body };
  for (const key of editable) if (!isDeepStrictEqual(before[key], page[key])) metadata[key] = page[key];
  if (!isDeepStrictEqual(next.tagColors, repository.workspace.tagColors)) metadata.tag_colors = next.tagColors || {};
  if (isDeepStrictEqual(page, before) && isDeepStrictEqual(next.tagColors, repository.workspace.tagColors)) return null;
  return { path: 'workspace.md', before: original, after: markdown.serialize(metadata, original) };
}

class WorkspaceRepository {
  static async open(directory, options = {}) {
    const root = await fs.realpath(directory);
    const repository = new WorkspaceRepository(root, options);
    await repository.reload();
    return repository;
  }
  constructor(root, options) { this.root = root; this.options = options; this.busy = false; }
  async reload() {
    let recoveryIssue = null;
    try { await transaction.recover(this.root); }
    catch (error) { recoveryIssue = error.message; }
    const folders = [], files = await snapshot(this.root, folders), info = manifest(files);
    const workspace = { version: 4, home: info.id, defaultTaskDatabase: info.default_task_database ?? null, databases: {}, records: {}, issues: [], paths: {}, databasePaths: {} };
    workspace.folders = folders;
    workspace.defaultPageFolder = info.default_page_folder || 'notes';
    if (info.tag_colors !== undefined) workspace.tagColors = info.tag_colors;
    const loaded = loadDefinitions(files, info);
    workspace.databases = loaded.databases; workspace.databasePaths = loaded.databasePaths;
    workspace.unavailableFolders = loaded.unavailableFolders;
    workspace.readOnlyRecords = [];
    if (!workspace.databases[workspace.defaultTaskDatabase]?.capabilities.task) {
      workspace.defaultTaskDatabase = null;
      loaded.errors.push({ path: 'workspace.md', message: 'Checkbox capture is unavailable. Configure default_task_database with a compatible todo database; existing checkboxes and pages are preserved.' });
    }
    workspace.records[info.id] = workspacePage(files, info); workspace.paths[info.id] = 'workspace.md';
    model.assertWorkspace(workspace);
    const errors = [...loaded.errors, ...(recoveryIssue ? [{ path: '.bento-local/pending.json', message: recoveryIssue }] : [])];
    const controls = new Set(['workspace.md', ...info.databases.map(definitionPath)]);
    const identities = new Map([[info.id, 'workspace.md']]);
    for (const [name] of files) {
      if (controls.has(name)) continue;
      try {
        const parsed = parseFile(files, name);
        if (parsed.metadata.database !== undefined) throw new Error('Database membership comes from the folder. Remove redundant database metadata.');
        const database = folderDatabase(workspace, path.posix.dirname(name));
        const protectedPage = !!database && !workspace.databases[database] || !folderAvailable(workspace, path.posix.dirname(name));
        const record = contentRecord(name, parsed, protectedPage ? undefined : database, workspace.databases);
        if (protectedPage) errors.push({ path: name, message: 'The containing database is unavailable or unregistered. This page is protected; its metadata is retained.' });
        if (protectedPage) workspace.readOnlyRecords.push(record.id);
        if (identities.has(record.id)) throw new Error(`Duplicate document ID ${record.id} in ${identities.get(record.id)} and ${name}.`);
        identities.set(record.id, name);
        workspace.records[record.id] = record; workspace.paths[record.id] = name;
      } catch (error) { errors.push({ path: name, message: error.message }); }
    }
    // Duplicate identity makes all writes ambiguous; never choose a winning file.
    this.readOnly = !!recoveryIssue || errors.some(error => error.message.startsWith('Duplicate document ID'));
    for (const record of Object.values(workspace.records)) {
      try { model.assertWorkspace({ ...workspace, records: { [workspace.home]: workspace.records[workspace.home], [record.id]: record } }); }
      catch (error) { errors.push({ path: workspace.paths[record.id], message: error.message }); delete workspace.records[record.id]; delete workspace.paths[record.id]; }
    }
    for (const record of Object.values(workspace.records)) {
      const known = new Set(workspace.databases[record.database]?.fields.map(field => field.id) || []);
      const unknown = Object.keys(record.properties).filter(id => !known.has(id));
      if (unknown.length) errors.push({ path: workspace.paths[record.id], message: `Unmapped property values retained: ${unknown.join(', ')}. Review schema or folder transfer.` });
      try { if (record.database) schema.properties(workspace.databases[record.database], record, workspace.records); }
      catch (error) { errors.push({ path: workspace.paths[record.id], message: error.message }); this.readOnly = true; }
      for (const occurrence of model.parse(record.body).tasks) {
        if (occurrence.href && (!workspace.records[occurrence.todoId] || !model.linkMatches(workspace, record.id, occurrence.href, occurrence.todoId))) errors.push({ path: workspace.paths[record.id], message: `Unresolved link on line ${occurrence.line + 1}.` });
      }
    }
    try { model.assertWorkspace(workspace); }
    catch (error) { this.readOnly = true; errors.push({ path: 'workspace.md', message: error.message }); }
    this.folders = folders; this.files = files; this.workspace = workspace; this.info = info; this.errors = errors;
    try { this.lastDeletion = await latestDeletion(this.root); }
    catch (error) { this.lastDeletion = null; this.errors.push({ path: '.bento-local/trash', message: 'Deleted files could not be read: ' + error.message }); }
    return this.view();
  }
  view() {
    return { workspace: model.clone(this.workspace), title: this.info.title, folder: this.root, walkthrough: this.info.walkthrough ?? null, errors: this.errors, readOnly: this.readOnly, lastDeletion: this.lastDeletion || null };
  }
  async verify() {
    const folders = [], current = await snapshot(this.root, folders);
    if (!isDeepStrictEqual(current, this.files) || !isDeepStrictEqual(folders, this.folders)) throw new Error('Workspace changed on disk. Your draft is kept; reload and review the external changes before saving.');
  }
  async save(workspace) {
    if (this.busy) throw new Error('A workspace save is already in progress.');
    if (this.readOnly) throw new Error('Workspace needs repair before saving. Existing files have been left unchanged.');
    this.busy = true;
    try {
      model.assertWorkspace(workspace);
      if (!isDeepStrictEqual(workspace.databases, this.workspace.databases) || workspace.defaultTaskDatabase !== this.workspace.defaultTaskDatabase || workspace.home !== this.workspace.home || !isDeepStrictEqual(workspace.readOnlyRecords, this.workspace.readOnlyRecords)) throw new Error('Schema changes must be made in their Markdown definitions and reloaded.');
      const next = model.clone(workspace), entries = [];
      if (!isDeepStrictEqual(next.folders, this.workspace.folders) || !isDeepStrictEqual(next.unavailableFolders, this.workspace.unavailableFolders) || next.defaultPageFolder !== this.workspace.defaultPageFolder) throw new Error('Folder settings are repository-owned.');
      for (const id of this.workspace.readOnlyRecords) if (!isDeepStrictEqual(next.records[id], this.workspace.records[id])) throw new Error('This page belongs to an unavailable database. Restore or migrate its definition before editing.');
      for (const id of Object.keys(this.workspace.records)) if (!next.records[id]) throw new Error('Deleting documents through a snapshot is not supported.');
      // Existing paths and creation defaults remain repository-owned.
      next.paths = { ...this.workspace.paths }; next.databasePaths = { ...this.workspace.databasePaths };
      for (const record of Object.values(next.records)) {
        if (record.id === next.home) continue;
        const before = this.workspace.records[record.id];
        if (before && record.database !== before.database) throw new Error('Database transfers require an explicit schema mapping operation.');
        if (!before) {
          if (record.database !== undefined && !Object.hasOwn(next.databases, record.database)) throw new Error('Choose a database for the new document.');
          const requested = workspace.paths?.[record.id];
          paths.relative(requested);
          if (path.posix.basename(requested) !== `${record.id}.md`) throw new Error('Invalid new document filename.');
          const folder = path.posix.dirname(requested) === '.' ? '' : path.posix.dirname(requested);
          publicFolder(folder); if (folder && !this.folders.includes(folder)) throw new Error('Choose an existing folder.');
          if ((folderDatabase(this.workspace, folder) || null) !== (record.database || null) || !folderAvailable(this.workspace, folder)) throw new Error('New pages must live inside their database folder; ordinary pages must live outside databases.');
          await vacant(this, requested); next.paths[record.id] = requested;
          if (this.files.has(next.paths[record.id])) throw new Error('New document path already exists.');
        }
        if (isDeepStrictEqual(record, before)) continue;
        const name = next.paths[record.id], original = this.files.get(name) ?? null;
        entries.push({ path: name, before: original, after: markdown.serialize(record, original) });
      }
      const manifest = workspaceEntry(this, next); if (manifest) entries.push(manifest);
      entries.sort((a, b) => Number(a.before !== null) - Number(b.before !== null));
      await transaction.commit(this.root, entries, () => this.verify(), this.options.beforeWrite);
      this.workspace = next;
      for (const entry of entries) this.files.set(entry.path, entry.after);
      this.info = markdown.parse(this.files.get('workspace.md')).metadata;
      // Keep the baseline sorted exactly like the scanner, including new paths.
      this.files = new Map([...this.files].sort(([a], [b]) => a.localeCompare(b)));
      return this.view();
    } finally { this.busy = false; }
  }
  async organize(operation) {
    if (this.busy) throw new Error('Wait for the current save to finish.');
    if (this.readOnly) throw new Error('Repair the workspace before organizing files.');
    this.busy = true;
    try {
      const plan = await operation();
      await transaction.commit(this.root, plan.entries, () => this.verify(), this.options.beforeWrite, plan.directories);
      const view = await this.reload();
      return { ...view, ...(plan.deletion ? { deletion: plan.deletion } : {}), ...(plan.restored ? { restored: plan.restored } : {}) };
    } finally { this.busy = false; }
  }
  createFolder(parent, name) {
    return this.organize(() => folderPlan(this, parent, name));
  }
  moveDocument(id, folder) {
    return this.organize(() => movePlan(this, id, folder));
  }
  deleteDocument(id) { return this.organize(() => deletePlan(this, id)); }
  restoreDocument(token) { return this.organize(() => restorePlan(this, token)); }
  setPropertyLayout(database, layout) { return this.organize(() => propertyLayoutPlan(this, database, layout)); }
  validateRestored(filename, raw, id, database) {
    const parsed = markdown.parse(raw);
    if (parsed.metadata.database !== undefined) throw new Error('The deleted file contains redundant membership metadata. Nothing was restored.');
    const record = contentRecord(filename, parsed, database || undefined, this.workspace.databases);
    if (record.id !== id) throw new Error('The deleted file’s identity changed. Nothing was restored.');
    const next = { ...this.workspace, records: { ...this.workspace.records, [id]: record } };
    model.assertWorkspace(next);
    if (database) schema.properties(next.databases[database], record, next.records);
  }

}
async function copyTemplate(source, destination) {
  // readFile/readdir work inside Electron's app.asar; fs.cp internals do not.
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name), to = path.join(destination, entry.name);
    if (entry.isDirectory()) { await fs.mkdir(to); await copyTemplate(from, to); }
    else if (entry.isFile()) await fs.writeFile(to, await fs.readFile(from), { flag: 'wx' });
    else throw new Error('Unexpected template entry.');
  }
}
async function create(directory, title = 'My workspace', { example = false, today = new Date() } = {}) {
  const root = await fs.realpath(directory);
  if ((await fs.readdir(root)).length) throw new Error('Choose an empty folder to create a workspace.');
  const template = path.join(__dirname, '..', 'templates', 'workspace');
  await copyTemplate(template, root);
  const file = path.join(root, 'workspace.md'), raw = await fs.readFile(file, 'utf8');
  const parsed = markdown.parse(raw); parsed.document.set('id', `workspace-${randomUUID()}`); parsed.document.set('title', title);
  await fs.writeFile(file, '---\n' + parsed.document.toString() + '---\n' + parsed.body, 'utf8');
  const repository = await WorkspaceRepository.open(root);
  if (!example) return repository;
  const seeded = exampleWorkspace(repository.workspace, today);
  await repository.save(seeded.workspace);
  const seededManifest = markdown.parse(repository.files.get('workspace.md'));
  seededManifest.document.set('walkthrough', seeded.walkthrough);
  await transaction.commit(root, [{ path: 'workspace.md', before: repository.files.get('workspace.md'), after: '---\n' + seededManifest.document.toString() + '---\n' + seededManifest.body }], () => repository.verify());
  await repository.reload();
  return repository;
}
export { WorkspaceRepository, create, snapshot };
