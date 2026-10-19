const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('bentoDesktop', Object.freeze({
  settingsRead: legacy => ipcRenderer.invoke('settings:read', legacy),
  settingsSave: patch => ipcRenderer.invoke('settings:save', patch),
  rememberLocation: location => ipcRenderer.invoke('workspace:location', location),
  initial: () => ipcRenderer.invoke('workspace:initial'),
  open: () => ipcRenderer.invoke('workspace:open'),
  create: () => ipcRenderer.invoke('workspace:create'),
  reload: () => ipcRenderer.invoke('workspace:reload'),
  save: workspace => ipcRenderer.invoke('workspace:save', workspace)
}));
