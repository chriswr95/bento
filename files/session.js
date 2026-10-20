import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import schema from '../prototype/schema.js';
import { publicFolder } from './organization.js';

export function validLocation(value) {
  if (value?.view === 'folder') { try { publicFolder(value.folder); } catch { return false; } }
  return schema.object(value) && ['daily', 'document', 'profile', 'folder'].includes(value.view)
    && [value.document, value.project].every(id => id === null || schema.identity(id))
    && (value.view !== 'document' || value.document !== null);
}
export class SessionStore {
  constructor(root) { this.filename = path.join(root, 'session.json'); this.value = null; }
  async read() {
    try {
      const value = JSON.parse(await fs.readFile(this.filename, 'utf8'));
      if (value.version !== 1 || typeof value.workspace !== 'string' || !path.isAbsolute(value.workspace) || !validLocation(value.location)) throw new Error('Invalid saved session.');
      this.value = value; return '';
    } catch (error) {
      this.value = null;
      return error.code === 'ENOENT' ? '' : 'The previous session could not be read. Open a workspace to continue.';
    }
  }
  async remember(workspace, location) {
    if (!path.isAbsolute(workspace) || !validLocation(location)) throw new Error('Invalid workspace location.');
    const next = { version: 1, workspace, location: structuredClone(location) };
    const temporary = this.filename + '.' + randomUUID() + '.tmp';
    try {
      const handle = await fs.open(temporary, 'wx', 0o600);
      try { await handle.writeFile(JSON.stringify(next, null, 2)); await handle.sync(); }
      finally { await handle.close(); }
      await fs.rename(temporary, this.filename);
      this.value = next;
    } finally { await fs.rm(temporary, { force: true }); }
  }
  async restore(open) {
    const warning = await this.read();
    if (!this.value) return { repository: null, warning };
    try {
      const repository = await open(this.value.workspace);
      let location = this.value.location, message = '';
      if (location.view === 'folder' && location.folder && !repository.workspace.folders.includes(location.folder)) { location = { view: 'folder', folder: '', document: null, project: null }; message = 'The last folder is unavailable. Opened workspace files.'; }
      if (location.document && !repository.workspace.records[location.document] || location.project && !repository.workspace.databases[repository.workspace.records[location.project]?.database]?.capabilities.project) {
        location = { view: 'daily', document: null, project: null };
        message = 'The last page is unavailable. Opened the workspace overview.';
      }
      return { repository, location, warning: message };
    } catch { return { repository: null, warning: 'The last workspace is unavailable. Reconnect its folder or open another workspace.' }; }
  }
}
