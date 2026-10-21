import { folderDatabase, folderAvailable } from './folders.js';

export function movableNote(workspace, id) {
  const record = workspace.records[id], path = workspace.paths?.[id];
  const folder = path?.split('/').slice(0, -1).join('/');
  return !!record && !!path && id !== workspace.home && !record.database &&
    !workspace.readOnlyRecords?.includes(id) && !folderDatabase(workspace, folder) && folderAvailable(workspace, folder);
}

export function noteDestination(workspace, id, folder) {
  return movableNote(workspace, id) && typeof folder === 'string' &&
    (folder === '' || workspace.folders?.includes(folder)) && !folderDatabase(workspace, folder) &&
    folderAvailable(workspace, folder) && workspace.paths[id].split('/').slice(0, -1).join('/') !== folder;
}
