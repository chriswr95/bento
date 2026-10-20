const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('bentoDesktop', Object.freeze({
  settingsRead: legacy => ipcRenderer.invoke('settings:read', legacy),
  settingsSave: patch => ipcRenderer.invoke('settings:save', patch),
  rememberLocation: location => ipcRenderer.invoke('workspace:location', location),
  initial: () => ipcRenderer.invoke('workspace:initial'),
  open: () => ipcRenderer.invoke('workspace:open'),
  create: mode => ipcRenderer.invoke('workspace:create', mode),
  reload: () => ipcRenderer.invoke('workspace:reload'),
  createFolder: (parent, name) => ipcRenderer.invoke('workspace:folder', parent, name),
  moveDocument: (id, folder) => ipcRenderer.invoke('workspace:move', id, folder),
  save: workspace => ipcRenderer.invoke('workspace:save', workspace)
}));
