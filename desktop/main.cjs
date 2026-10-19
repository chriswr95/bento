const { app, BrowserWindow, dialog, ipcMain, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { WorkspaceRepository, create } = require('../files/repository.cjs');
let window, repository = null, pending = Promise.resolve();
const entry = path.join(__dirname, '..', 'prototype', 'index.html');
const trustedURL = pathToFileURL(entry).href;
if (!app.isPackaged && process.env.BENTO_TEST_MODE === '1' && process.env.BENTO_TEST_USER_DATA) app.setPath('userData', process.env.BENTO_TEST_USER_DATA);

function register(channel, operation) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== trustedURL) throw new Error('Untrusted workspace request.');
    const result = pending.then(() => operation(...args));
    pending = result.catch(() => {});
    try { return { ok: true, value: await result }; }
    catch (error) { return { ok: false, error: error.message }; }
  });
}
function requireRepository() {
  if (!repository) throw new Error('Open a workspace first.');
  return repository;
}
async function choose(makeNew) {
  const result = await dialog.showOpenDialog(window, { title: makeNew ? 'Choose an empty folder for your new workspace' : 'Open Bento workspace folder', properties: ['openDirectory', 'createDirectory'] });
  if (result.canceled) return null;
  const next = makeNew ? await create(result.filePaths[0], path.basename(result.filePaths[0])) : await WorkspaceRepository.open(result.filePaths[0]);
  repository = next;
  return next.view();
}
async function start() {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  window = new BrowserWindow({ width: 1160, height: 900, minWidth: 380, minHeight: 500, title: 'Bento', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  register('workspace:initial', () => repository?.view() || null);
  register('workspace:open', () => choose(false));
  register('workspace:create', () => choose(true));
  register('workspace:reload', () => requireRepository().reload());
  register('workspace:save', workspace => requireRepository().save(workspace));
  if (!app.isPackaged && process.env.BENTO_TEST_MODE === '1' && process.env.BENTO_TEST_WORKSPACE) repository = await WorkspaceRepository.open(process.env.BENTO_TEST_WORKSPACE);
  await window.loadFile(entry);
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
  app.whenReady().then(start).catch(error => { dialog.showErrorBox('Bento could not open', error.message); app.quit(); });
}
app.on('window-all-closed', () => app.quit());
