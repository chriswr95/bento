import { SessionStore } from '../files/session.js';
import { SettingsStore } from '../files/settings.js';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
import { app, BrowserWindow, dialog, ipcMain, session } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { WorkspaceRepository, create } from '../files/repository.js';
let window, settings, lastSession, startupWarning = '', startupLocation = null, repository = null, pending = Promise.resolve();
const entry = path.join(__dirname, '..', 'prototype', 'index.html');
const trustedURL = pathToFileURL(entry).href;
const icon = path.join(__dirname, '..', 'prototype', 'assets', 'bento-256.png');
const hiddenTestWindow = process.env.BENTO_TEST_MODE === '1' && process.env.BENTO_TEST_SHOW_WINDOW !== '1';
if (hiddenTestWindow && process.platform === 'darwin') app.setActivationPolicy('prohibited');
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
async function choose(makeNew, example = false) {
  const result = await dialog.showOpenDialog(window, { title: example ? 'Choose an empty folder for your example workspace' : makeNew ? 'Choose an empty folder for your new workspace' : 'Open Bento workspace folder', properties: ['openDirectory', 'createDirectory'] });
  if (result.canceled) return null;
  const next = makeNew ? await create(result.filePaths[0], example ? 'Bento example' : path.basename(result.filePaths[0]), { example }) : await WorkspaceRepository.open(result.filePaths[0]);
  repository = next;
  startupWarning = ''; startupLocation = example ? { view: 'document', document: next.info.walkthrough.project, project: null } : null;
  try { await lastSession.remember(next.root, startupLocation || { view: 'daily', document: null, project: null }); }
  catch { startupWarning = 'Workspace opened, but the last session could not be saved.'; }
  return { ...next.view(), location: startupLocation, resumeWarning: startupWarning };
}
async function start() {
  if (!app.isPackaged && !hiddenTestWindow && process.platform === 'darwin') app.dock.setIcon(icon);
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  settings = new SettingsStore(app.getPath('userData'));
  lastSession = new SessionStore(app.getPath('userData'));
  const restored = await lastSession.restore(folder => WorkspaceRepository.open(folder));
  repository = restored.repository; startupWarning = restored.warning; startupLocation = restored.location;
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  window = new BrowserWindow({ icon, show: !hiddenTestWindow, skipTaskbar: hiddenTestWindow, width: 1160, height: 900, minWidth: 380, minHeight: 500, title: 'Bento', webPreferences: { offscreen: hiddenTestWindow, backgroundThrottling: !hiddenTestWindow, preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  register('settings:read', legacy => settings.load(legacy));
  register('settings:save', patch => settings.save(patch));
  register('workspace:initial', () => repository ? { ...repository.view(), location: startupLocation, resumeWarning: startupWarning } : { unavailable: true, resumeWarning: startupWarning });
  register('workspace:location', async location => { await lastSession.remember(requireRepository().root, location); startupLocation = location; return true; });
  register('workspace:open', () => choose(false));
  register('workspace:create', mode => {
    if (mode !== undefined && mode !== 'example') throw new Error('Unknown workspace template.');
    return choose(true, mode === 'example');
  });
  register('workspace:reload', () => requireRepository().reload());
  register('workspace:upgrade', () => requireRepository().upgrade());
  register('workspace:folder', (parent, name) => requireRepository().createFolder(parent, name));
  register('workspace:move', (id, folder) => requireRepository().moveDocument(id, folder));
  register('workspace:save', workspace => requireRepository().save(workspace));
  if (!app.isPackaged && process.env.BENTO_TEST_MODE === '1' && process.env.BENTO_TEST_WORKSPACE) { repository = await WorkspaceRepository.open(process.env.BENTO_TEST_WORKSPACE); startupLocation = null; startupWarning = ''; }
  await window.loadFile(entry);
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window && !hiddenTestWindow) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
  app.whenReady().then(start).catch(error => { if (hiddenTestWindow) console.error('Bento could not open:', error);
    else dialog.showErrorBox('Bento could not open', error.message);
    app.quit(); });
}
let quitting = false;
app.on('before-quit', event => {
  if (quitting) return;
  event.preventDefault();
  pending.finally(() => { quitting = true; app.quit(); });
});
app.on('window-all-closed', () => app.quit());
