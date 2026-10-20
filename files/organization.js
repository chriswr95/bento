import path from 'node:path';
import fs from 'node:fs/promises';
import * as paths from './paths.js';
import * as markdown from './markdown.js';
import { definitionPath } from './database-definitions.js';
import { moveLinks } from './move-links.js';
import { folderDatabase, folderAvailable } from '../prototype/folders.js';

export function publicFolder(folder) {
  if (folder === '') return folder;
  paths.relative(folder);
  if (folder.split('/').some(part => part.startsWith('.') || part === 'node_modules')) throw new Error('Choose a visible workspace folder.');
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
export async function folderPlan(repository, parent, name) {
  publicFolder(parent); paths.relative(name);
  if (name.includes('/')) throw new Error('Enter one folder name.');
  const folder = publicFolder(parent ? parent + '/' + name : name);
  if (parent && !repository.folders.includes(parent)) throw new Error('Parent folder is unavailable.');
  if (!folderAvailable(repository.workspace, parent) || folderDatabase(repository.workspace, parent) && !repository.workspace.databases[folderDatabase(repository.workspace, parent)]) throw new Error('Restore this database before creating folders inside it.');
  await vacant(repository, folder);
  return { entries: [], directories: [folder] };
}
export async function movePlan(repository, id, folder) {
  complete(repository); publicFolder(folder);
  if (folder && !repository.folders.includes(folder)) throw new Error('Destination folder is unavailable.');
  if (!Object.hasOwn(repository.workspace.records, id) || id === repository.workspace.home) throw new Error('Choose an ordinary page to move.');
  const beforePath = repository.workspace.paths[id], afterPath = (folder ? folder + '/' : '') + path.posix.basename(beforePath);
  const database = repository.workspace.records[id].database || null;
  if ((folderDatabase(repository.workspace, folder) || null) !== database) throw new Error('Moving between a database and another location requires Change database. Move page keeps the current database.');
  if (beforePath === afterPath) return { entries: [], directories: [] };
  await vacant(repository, afterPath);
  const moved = new Map([[beforePath, afterPath]]), entries = [];
  for (const [filename, raw] of repository.files) {
    const parsed = markdown.parse(raw), destination = moved.get(filename) || filename;
    const body = moveLinks(parsed.body, filename, destination, moved);
    if (filename === beforePath) {
      const record = repository.workspace.records[id];
      entries.unshift({ path: destination, before: null, after: markdown.serialize({ ...record, body }, raw) });
    } else if (body !== parsed.body) entries.push({ path: filename, before: raw, after: markdown.serialize({ ...parsed.metadata, body }, raw) });
  }
  entries.push({ path: beforePath, before: repository.files.get(beforePath), after: null });
  return { entries, directories: [] };
}
