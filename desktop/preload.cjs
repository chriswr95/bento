const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('bentoDesktop', Object.freeze({
  initial: () => ipcRenderer.invoke('workspace:initial'),
  open: () => ipcRenderer.invoke('workspace:open'),
  create: () => ipcRenderer.invoke('workspace:create'),
  reload: () => ipcRenderer.invoke('workspace:reload'),
  save: workspace => ipcRenderer.invoke('workspace:save', workspace)
}));
