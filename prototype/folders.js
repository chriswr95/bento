/* One physical location owns membership; relations do not affect placement. */
export function folderDatabase(workspace, folder) {
  return Object.entries(workspace.databasePaths || {}).find(([, path]) => folder === path || folder.startsWith(path + '/'))?.[0];
}

export function folderAvailable(workspace, folder) {
  return !(workspace.unavailableFolders || []).some(path => folder === path || folder.startsWith(path + '/'));
}

export function foldersFor(workspace, database = null) {
  return ['', ...(workspace.folders || [])].filter(folder => (folderDatabase(workspace, folder) || null) === database && folderAvailable(workspace, folder));
}
