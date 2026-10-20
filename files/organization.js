import path from 'node:path';
import fs from 'node:fs/promises';
import * as paths from './paths.js';
import * as markdown from './markdown.js';
import { definitionPath, defaultFolder } from './database-definitions.js';
import { moveLinks } from './move-links.js';

export function publicFolder(folder) {
  if (folder === '') return folder;
  paths.relative(folder);
  if (folder.split('/').some(part => part.startsWith('.') || part === 'node_modules') || folder === 'databases' || folder.startsWith('databases/')) throw new Error('Choose an ordinary workspace folder.');
  return folder;
}
export function complete(repository) {
  const known = new Set(['workspace.md', ...repository.info.databases.map(definitionPath), ...Object.values(repository.workspace.paths)]);
  if ([...repository.files.keys()].some(name => !known.has(name)) || repository.workspace.readOnlyRecords.length) throw new Error('Restore unavailable pages or database definitions before reorganizing this workspace.');
}
export async function vacant(repository, name) {
  paths.relative(name);
  const parent = path.posix.dirname(name), filename = path.posix.basename(name);
  const location = parent === '.' ? repository.root : await paths.inside(repository.root, parent);
  const existing = await fs.readdir(location);
  if (existing.some(item => item.normalize('NFC').toLowerCase() === filename.normalize('NFC').toLowerCase())) throw new Error('A file or folder with that name already exists.');
}
export async function upgradePlan(repository) {
  for (const name of ['databases', 'notes']) {
    const existing = (await fs.readdir(repository.root)).find(item => item.normalize('NFC').toLowerCase() === name);
    if (existing && (existing !== name || !(await fs.lstat(await paths.inside(repository.root, existing))).isDirectory())) throw new Error(`The ${name} folder conflicts with an existing file or folder.`);
  }

  complete(repository);
  const definitionsOnly = new Set(repository.info.databases.map(definitionPath));
  if ([...repository.files.keys()].some(name => name.startsWith('databases/') && !definitionsOnly.has(name))) throw new Error('Move existing content out of the reserved databases folder before upgrading.');
  for (const entry of repository.info.databases) publicFolder(defaultFolder(entry));
  const entries = [], definitions = [];
  const moved = new Map(repository.info.databases.map(entry => [definitionPath(entry), `databases/${entry.id}.md`]));
  for (const entry of repository.info.databases) {
    const source = definitionPath(entry), target = `databases/${entry.id}.md`;
    if (!repository.files.has(source)) throw new Error('Restore missing database definitions before upgrading.');
    if (repository.folders.includes('databases')) await vacant(repository, target);
    if (definitions.some(item => item.target.toLowerCase() === target.toLowerCase())) throw new Error('Schema filenames would collide. Rename a database identity before upgrading.');
    if (repository.files.has(target)) throw new Error('Database definition destination already exists.');
    const raw = repository.files.get(source), parsed = markdown.parse(raw);
    const body = moveLinks(parsed.body, source, target, moved);
    entries.push({ path: target, before: null, after: body === parsed.body ? raw : markdown.serialize({ ...parsed.metadata, body }, raw) });
    definitions.push({ source, target, entry });
  }
  for (const record of Object.values(repository.workspace.records)) {
    if (record.id === repository.workspace.home) continue;
    const filename = repository.workspace.paths[record.id], before = repository.files.get(filename);
    entries.push({ path: filename, before, after: markdown.serialize({ ...record, body: moveLinks(record.body, filename, filename, moved) }, before, { explicitMembership: true }) });
  }
  const raw = repository.files.get('workspace.md'), parsed = markdown.parse(raw);
  parsed.document.set('organization_version', 2); parsed.document.set('default_page_folder', 'notes');
  for (const [index, { target, entry }] of definitions.entries()) {
    parsed.document.deleteIn(['databases', index, 'path']);
    parsed.document.setIn(['databases', index, 'definition'], target);
    parsed.document.setIn(['databases', index, 'default_folder'], defaultFolder(entry));
  }
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const header = parsed.document.toString({ lineWidth: 0 }).replace(/\r?\n/g, eol);
  entries.push({ path: 'workspace.md', before: raw, after: (raw.startsWith('\uFEFF') ? '\uFEFF' : '') + '---' + eol + header + '---' + eol + moveLinks(parsed.body, 'workspace.md', 'workspace.md', moved) });
  for (const { source } of definitions) entries.push({ path: source, before: repository.files.get(source), after: null });
  return { entries, directories: ['databases', 'notes'] };
}
export async function folderPlan(repository, parent, name) {
  publicFolder(parent); paths.relative(name);
  if (name.includes('/')) throw new Error('Enter one folder name.');
  const folder = publicFolder(parent ? parent + '/' + name : name);
  if (parent && !repository.folders.includes(parent)) throw new Error('Parent folder is unavailable.');
  await vacant(repository, folder);
  return { entries: [], directories: [folder] };
}
export async function movePlan(repository, id, folder) {
  complete(repository); publicFolder(folder);
  if (folder && !repository.folders.includes(folder)) throw new Error('Destination folder is unavailable.');
  if (!Object.hasOwn(repository.workspace.records, id) || id === repository.workspace.home) throw new Error('Choose an ordinary page to move.');
  const beforePath = repository.workspace.paths[id], afterPath = (folder ? folder + '/' : '') + path.posix.basename(beforePath);
  if (beforePath === afterPath) return { entries: [], directories: [] };
  await vacant(repository, afterPath);
  const moved = new Map([[beforePath, afterPath]]), entries = [];
  for (const [filename, raw] of repository.files) {
    const parsed = markdown.parse(raw), destination = moved.get(filename) || filename;
    const body = moveLinks(parsed.body, filename, destination, moved);
    if (filename === beforePath) {
      const record = repository.workspace.records[id];
      entries.unshift({ path: destination, before: null, after: markdown.serialize({ ...record, body }, raw, { explicitMembership: true }) });
    } else if (body !== parsed.body) entries.push({ path: filename, before: raw, after: markdown.serialize({ ...parsed.metadata, body }, raw, { explicitMembership: !parsed.metadata.kind }) });
  }
  entries.push({ path: beforePath, before: repository.files.get(beforePath), after: null });
  return { entries, directories: [] };
}
