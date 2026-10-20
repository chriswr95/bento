/* Navigation reflects folder paths; relationships never move or duplicate files. */
export function directoryTree(workspace) {
  const root = { path: '', name: '', folders: [], documents: [] };
  const folders = new Map([['', root]]);
  function folder(path) {
    if (folders.has(path)) return folders.get(path);
    const parts = path.split('/'), name = parts.pop();
    const node = { path, name, folders: [], documents: [] };
    folder(parts.join('/')).folders.push(node);
    folders.set(path, node);
    return node;
  }
  for (const [id, path] of Object.entries(workspace.databasePaths || {})) {
    const node = folder(path);
    node.database = workspace.databases[id];
  }
  for (const document of Object.values(workspace.records)) {
    if (document.id === workspace.home) continue;
    const path = workspace.paths?.[document.id];
    if (!path) continue;
    const parts = path.split('/'); parts.pop();
    folder(parts.join('/')).documents.push({ id: document.id, title: document.title, path });
  }
  function sort(node) {
    node.folders.sort((a, b) => a.name.localeCompare(b.name));
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
  collapse(paths) {
    for (const path of paths) this.preferences.set(path, false);
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
