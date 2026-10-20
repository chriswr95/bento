import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import * as paths from './paths.js';
import * as markdown from './markdown.js';
import { read } from './transaction.js';
import { publicFolder, vacant } from './organization.js';
import { definitionPath } from './database-definitions.js';
import { folderDatabase, folderAvailable } from '../prototype/folders.js';
import schema from '../prototype/schema.js';
import { trashDirectory, trashPath, validTrashToken } from './trash-paths.js';

function deletedFile(raw, token) {
  const parsed = markdown.parse(raw), meta = parsed.metadata;
  if (meta.kind !== 'deleted-document' || !schema.identity(meta.document) || typeof meta.title !== 'string' || typeof meta.deleted_at !== 'string' || !Number.isFinite(Date.parse(meta.deleted_at))) throw new Error('Invalid deleted-file record.');
  publicFolder(meta.path);
  if (!meta.path.toLowerCase().endsWith('.md') || meta.path === 'workspace.md') throw new Error('Invalid deleted-file location.');
  if (meta.database !== null && !schema.identity(meta.database)) throw new Error('Invalid deleted-file database.');
  return { receipt: { token, document: meta.document, title: meta.title, path: meta.path, database: meta.database, deletedAt: meta.deleted_at }, content: parsed.body };
}

export async function latestDeletion(root) {
  let names;
  try { names = await fs.readdir(await paths.inside(root, trashDirectory)); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  let latest = null;
  for (const name of names) {
    const token = name.endsWith('.md') ? name.slice(0, -3) : '';
    if (!validTrashToken(token)) continue;
    try {
      const raw = await read(root, trashPath(token));
      const { receipt } = deletedFile(raw, token);
      if (!latest || receipt.deletedAt > latest.deletedAt || receipt.deletedAt === latest.deletedAt && token > latest.token) latest = receipt;
    } catch { /* Retain malformed trash entries; they are never restored automatically. */ }
  }
  return latest;
}

export function deletePlan(repository, id) {
  const record = Object.hasOwn(repository.workspace.records, id) && repository.workspace.records[id];
  if (!record || id === repository.workspace.home || repository.workspace.readOnlyRecords.includes(id)) throw new Error('Choose an editable content file to delete. Workspace and schema files are protected.');
  const filename = repository.workspace.paths[id], before = repository.files.get(filename);
  if (typeof before !== 'string') throw new Error('The file is unavailable. Reload before deleting it.');
  const deletedAt = new Date(Math.max(Date.now(), (Date.parse(repository.lastDeletion?.deletedAt) || 0) + 1)).toISOString();
  const token = randomUUID(), metadata = { bento_version: 1, kind: 'deleted-document', document: id, title: record.title, path: filename, database: record.database || null, deleted_at: deletedAt };
  const after = '---\n' + JSON.stringify(metadata) + '\n---\n' + before;
  return { entries: [{ path: trashPath(token), before: null, after }, { path: filename, before, after: null }], directories: [trashDirectory], deletion: deletedFile(after, token).receipt };
}

export async function restorePlan(repository, token) {
  const filename = trashPath(token), raw = await read(repository.root, filename);
  if (raw === null) throw new Error('That deleted file is no longer in Bento’s trash.');
  const { receipt, content } = deletedFile(raw, token), folder = path.posix.dirname(receipt.path) === '.' ? '' : path.posix.dirname(receipt.path);
  if (repository.info.databases.some(entry => definitionPath(entry) === receipt.path)) throw new Error('Schema files cannot be restored through content-file actions.');
  if (folder && !repository.folders.includes(folder)) throw new Error('The original folder is unavailable. Restore that folder before restoring this file.');
  if ((folderDatabase(repository.workspace, folder) || null) !== receipt.database || !folderAvailable(repository.workspace, folder) || receipt.database && !repository.workspace.databases[receipt.database]) throw new Error('Restore the original database definition before restoring this file.');
  if (Object.hasOwn(repository.workspace.records, receipt.document)) throw new Error('A document with this identity already exists. Nothing was overwritten.');
  await vacant(repository, receipt.path);
  repository.validateRestored(receipt.path, content, receipt.document, receipt.database);
  return { entries: [{ path: receipt.path, before: null, after: content }, { path: filename, before: raw, after: null }], directories: [], restored: receipt };
}
