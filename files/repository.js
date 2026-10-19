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
import schema from '../prototype/schema.js';

async function snapshot(root) {
  const names = await paths.walk(root);
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
  const ids = new Set(), folders = [];
  for (const entry of data.databases) {
    if (!schema.identity(entry.id) || ids.has(entry.id)) throw new Error('Duplicate or invalid database identity.');
    ids.add(entry.id); paths.relative(entry.path);
    if (entry.path.startsWith('.') || folders.some(folder => folder.toLowerCase() === entry.path.toLowerCase() || folder.startsWith(entry.path + '/') || entry.path.startsWith(folder + '/'))) throw new Error('Database folders must be distinct and must not nest.');
    folders.push(entry.path);
  }
  return data;
}
function membership(name, definitions) {
  return definitions.find(entry => name.startsWith(entry.path + '/'))?.id;
}
function contentRecord(name, parsed, database, definitions) {
  const meta = parsed.metadata;
  if (meta.kind) throw new Error(`Unregistered control document: ${name}.`);
  if (meta.database !== undefined && meta.database !== database) throw new Error(`Legacy membership disagrees with the folder in ${name}; review the database transfer before editing.`);
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
    const files = await snapshot(this.root), info = manifest(files);
    const workspace = { version: 4, defaultTaskDatabase: info.default_task_database ?? null, databases: {}, records: {}, issues: [], paths: {}, databasePaths: {} };
    for (const entry of info.databases) {
      const parsed = parseFile(files, `${entry.path}/database.md`, 'database-definition');
      if (parsed.metadata.id !== entry.id) throw new Error(`Database identity mismatch in ${entry.path}.`);
      workspace.databases[entry.id] = { ...parsed.metadata, capabilities: parsed.metadata.capabilities || {} };
      workspace.databasePaths[entry.id] = entry.path;
    }
    model.assertWorkspace(workspace);
    const errors = recoveryIssue ? [{ path: '.bento-local/pending.json', message: recoveryIssue }] : [];
    const controls = new Set(['workspace.md', ...info.databases.map(entry => `${entry.path}/database.md`)]);
    const identities = new Map();
    for (const [name] of files) {
      if (controls.has(name)) continue;
      try {
        const record = contentRecord(name, parseFile(files, name), membership(name, info.databases), workspace.databases);
        if (identities.has(record.id)) throw new Error(`Duplicate document ID ${record.id} in ${identities.get(record.id)} and ${name}.`);
        identities.set(record.id, name);
        workspace.records[record.id] = record; workspace.paths[record.id] = name;
      } catch (error) { errors.push({ path: name, message: error.message }); }
    }
    // Duplicate identity makes all writes ambiguous; never choose a winning file.
    this.readOnly = !!recoveryIssue || errors.some(error => error.message.startsWith('Duplicate document ID'));
    for (const record of Object.values(workspace.records)) {
      try { model.assertWorkspace({ ...workspace, records: { [record.id]: record } }); }
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
    this.files = files; this.workspace = workspace; this.info = info; this.errors = errors;
    return this.view();
  }
  view() {
    return { workspace: model.clone(this.workspace), title: this.info.title, folder: this.root, errors: this.errors, readOnly: this.readOnly };
  }
  async verify() {
    const current = await snapshot(this.root);
    if (!isDeepStrictEqual(current, this.files)) throw new Error('Workspace changed on disk. Your draft is kept; reload and review the external changes before saving.');
  }
  async save(workspace) {
    if (this.busy) throw new Error('A workspace save is already in progress.');
    if (this.readOnly) throw new Error('Workspace needs repair before saving. Existing files have been left unchanged.');
    this.busy = true;
    try {
      model.assertWorkspace(workspace);
      if (!isDeepStrictEqual(workspace.databases, this.workspace.databases) || workspace.defaultTaskDatabase !== this.workspace.defaultTaskDatabase) throw new Error('Schema changes must be made in their Markdown definitions and reloaded.');
      const next = model.clone(workspace), entries = [];
      for (const id of Object.keys(this.workspace.records)) if (!next.records[id]) throw new Error('Deleting documents through a snapshot is not supported.');
      // Paths and folder membership come exclusively from the repository, never the renderer.
      next.paths = { ...this.workspace.paths }; next.databasePaths = { ...this.workspace.databasePaths };
      for (const record of Object.values(next.records)) {
        const before = this.workspace.records[record.id];
        if (before && record.database !== before.database) throw new Error('Move files between folders to transfer database membership.');
        if (!before) {
          if (!Object.hasOwn(next.databases, record.database)) throw new Error('Choose a database for the new document.');
          next.paths[record.id] = `${next.databasePaths[record.database]}/${record.id}.md`;
          if (this.files.has(next.paths[record.id])) throw new Error('New document path already exists.');
        }
        if (isDeepStrictEqual(record, before)) continue;
        const name = next.paths[record.id], original = this.files.get(name) ?? null;
        entries.push({ path: name, before: original, after: markdown.serialize(record, original) });
      }
      entries.sort((a, b) => Number(a.before !== null) - Number(b.before !== null));
      await transaction.commit(this.root, entries, () => this.verify(), this.options.beforeWrite);
      this.workspace = next;
      for (const entry of entries) this.files.set(entry.path, entry.after);
      // Keep the baseline sorted exactly like the scanner, including new paths.
      this.files = new Map([...this.files].sort(([a], [b]) => a.localeCompare(b)));
      return this.view();
    } finally { this.busy = false; }
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
async function create(directory, title = 'My workspace') {
  const root = await fs.realpath(directory);
  if ((await fs.readdir(root)).length) throw new Error('Choose an empty folder to create a workspace.');
  const template = path.join(__dirname, '..', 'templates', 'workspace');
  await copyTemplate(template, root);
  const file = path.join(root, 'workspace.md'), raw = await fs.readFile(file, 'utf8');
  const parsed = markdown.parse(raw); parsed.document.set('id', `workspace-${randomUUID()}`); parsed.document.set('title', title);
  await fs.writeFile(file, '---\n' + parsed.document.toString() + '---\n' + parsed.body, 'utf8');
  return WorkspaceRepository.open(root);
}
export { WorkspaceRepository, create, snapshot };
