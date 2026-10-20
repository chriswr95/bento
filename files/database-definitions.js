import * as markdown from './markdown.js';
import schema from '../prototype/schema.js';
import path from 'node:path';

export const definitionPath = entry => `${entry.path}/database.md`;

// Runtime availability is derived; authored schema files are never repaired on load.
export function loadDefinitions(files, info) {
  const databases = {}, databasePaths = {}, unavailableFolders = [], errors = [];
  function unavailable(entry, error) {
    delete databases[entry.id];
    errors.push({ path: definitionPath(entry), message: `Database unavailable: ${error.message}. Its pages are protected until the definition is restored or migrated.` });
  }
  for (const entry of info.databases) {
    databasePaths[entry.id] = entry.path;
    try {
      const file = files.get(definitionPath(entry));
      if (file === undefined) throw new Error('Missing database definition');
      const data = markdown.parse(file).metadata;
      if (data.kind !== 'database-definition' || data.bento_version !== 1 || data.id !== entry.id) throw new Error('Invalid database identity or definition');
      databases[entry.id] = { ...data, capabilities: schema.object(data.capabilities) ? data.capabilities : {} };
    } catch (error) { unavailable(entry, error); }
  }
  let removed;
  do {
    removed = false;
    for (const entry of info.databases) {
      const database = databases[entry.id]; if (!database) continue;
      if (Array.isArray(database.fields)) for (const field of database.fields) {
        if (schema.object(field)) { delete field.unavailable; if (field.type === 'relation' && !databases[field.target_database]) field.unavailable = true; }
      }
      try { schema.definition(database, databases); }
      catch (error) { unavailable(entry, error); removed = true; }
    }
  } while (removed);
  for (const database of Object.values(databases)) {
    const file = definitionPath(info.databases.find(entry => entry.id === database.id));
    for (const field of database.fields) if (field.unavailable) errors.push({ path: file, message: `${field.name} is unavailable because its target database is missing. Existing values are preserved.` });
    for (const role of ['task', 'project']) {
      if (!database.capabilities[role]) continue;
      try { schema.capabilities({ ...database, capabilities: { [role]: database.capabilities[role] } }); }
      catch (error) {
        delete database.capabilities[role];
        errors.push({ path: file, message: `${role === 'task' ? 'Todo tracking' : 'Project review'} unavailable: ${error.message} Restore the capability mapping to enable it. Pages and stored values are retained.` });
      }
    }
  }
  const registered = new Set(info.databases.map(definitionPath));
  for (const [name, raw] of files) {
    if (registered.has(name) || !name.endsWith('/database.md')) continue;
    try {
      if (markdown.parse(raw).metadata.kind !== 'database-definition') continue;
      unavailableFolders.push(path.posix.dirname(name));
      errors.push({ path: name, message: 'This database definition is not registered in workspace.md. Its folder is protected.' });
    } catch { /* The repository reports malformed control files. */ }
  }
  return { databases, databasePaths, unavailableFolders, errors };
}
