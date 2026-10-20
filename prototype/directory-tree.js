/* Navigation reflects folder paths; relationships never move or duplicate files. */
import { folderDatabase, folderAvailable } from './folders.js';
export function directoryTree(workspace) {
  const root = { path: '', name: workspace.records[workspace.home]?.title || 'Workspace', folders: [], documents: [] };
  const folders = new Map([['', root]]);
  function folder(path) {
    if (folders.has(path)) return folders.get(path);
    const parts = path.split('/'), name = parts.pop();
    const node = { path, name, folders: [], documents: [] };
    folder(parts.join('/')).folders.push(node);
    folders.set(path, node);
    return node;
  }
  for (const path of workspace.folders || []) folder(path);
  for (const [id, path] of Object.entries(workspace.databasePaths || {})) {
    const node = folder(path);
    node.database = id;
    node.name = workspace.databases[id]?.title || path.split('/').at(-1);
    node.unavailable = !workspace.databases[id];
  }
  for (const document of Object.values(workspace.records)) {
    const path = workspace.paths?.[document.id];
    if (!path) continue;
    const parts = path.split('/'); parts.pop();
    folder(parts.join('/')).documents.push({ id: document.id, title: document.id === workspace.home ? 'Workspace' : document.title, path });
  }
  function sort(node) {
    const database = folderDatabase(workspace, node.path);
    node.unavailable = !!(database && !workspace.databases[database]) || !folderAvailable(workspace, node.path);
    node.folders.sort((a, b) => Number(!!b.database) - Number(!!a.database) || a.name.localeCompare(b.name));
    node.documents.sort((a, b) => a.title.localeCompare(b.title) || a.path.localeCompare(b.path));
    node.folders.forEach(sort);
  }
  sort(root);
  return root;
}

export class DirectoryState {
  constructor(key, storage) {
    this.key = key; this.preferences = new Map();
    try {
      this.storage = storage ?? globalThis.localStorage;
      const saved = JSON.parse(this.storage.getItem(key));
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        this.preferences = new Map(Object.entries(saved).filter(([, value]) => typeof value === 'boolean'));
      }
    } catch { /* Navigation still works when local settings are unavailable. */ }
  }
  expanded(path, fallback = true) { return this.preferences.get(path) ?? fallback; }
  set(path, expanded) {
    this.preferences.set(path, expanded);
    this.persist();
  }
  reveal(documentPath) {
    if (!documentPath) return;
    const parts = documentPath.split('/'); parts.pop();
    this.preferences.set('', true);
    while (parts.length) { this.preferences.set(parts.join('/'), true); parts.pop(); }
    this.persist();
  }
  persist() {
    try { this.storage.setItem(this.key, JSON.stringify(Object.fromEntries(this.preferences))); }
    catch { /* Keep session preferences without affecting document saving. */ }
  }
}
