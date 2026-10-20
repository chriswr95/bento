export function validateHierarchy(records, home) {
  const complete = new Set();
  for (const record of Object.values(records)) {
    if (record.parent != null && (typeof record.parent !== 'string' || !/^[\w-]+$/.test(record.parent))) throw new Error('Parent must be a page identity.');
    if (record.id === home && record.parent != null) throw new Error('The Workspace page cannot have a parent.');
    const visiting = new Set(); let current = record;
    while (current && !complete.has(current.id)) {
      if (visiting.has(current.id)) throw new Error('Page hierarchy cannot contain a cycle.');
      visiting.add(current.id); current = records[current.parent];
    }
    for (const id of visiting) complete.add(id);
  }
}
export function ancestors(workspace, id) {
  const result = [], visited = new Set([id]); let parent = workspace.records[id]?.parent;
  while (parent && workspace.records[parent] && !visited.has(parent)) {
    visited.add(parent); result.unshift(workspace.records[parent]); parent = workspace.records[parent].parent;
  }
  return result;
}
export function canParent(workspace, id, parent) {
  return id !== workspace.home && !!workspace.records[parent] && parent !== id && !ancestors(workspace, parent).some(page => page.id === id);
}
export function pagePath(workspace, id) {
  return [...ancestors(workspace, id), workspace.records[id]].filter(Boolean).map(page => page.title).join(' / ');
}
export function pageTree(workspace) {
  const nodes = new Map(Object.values(workspace.records).filter(page => page.id !== workspace.home).map(page => [page.id, { page, children: [] }]));
  const roots = [];
  let valid = true;
  try { validateHierarchy(workspace.records, workspace.home); } catch { valid = false; }
  for (const node of nodes.values()) {
    const parent = nodes.get(node.page.parent);
    if (parent && valid) parent.children.push(node);
    else roots.push(node);
  }
  const pending = [roots];
  while (pending.length) {
    const list = pending.pop(); list.sort((a, b) => a.page.title.localeCompare(b.page.title) || a.page.id.localeCompare(b.page.id));
    list.forEach(node => { if (node.children.length) pending.push(node.children); });
  }
  return roots;
}
