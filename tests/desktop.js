import { checkDailyWorkflow } from './daily-workflow.js';
import { checkPageWorkflow } from './page-workflow.js';
import { checkWorkspaceCustomization } from './workspace-customization.js';
import { checkOnboarding } from './onboarding.js';
import { builtinThemes } from '../prototype/themes.js';
import electronPath from 'electron';
import { fileURLToPath } from 'node:url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const root = path.resolve(__dirname, '..');
let application, temporary;
const processes = new WeakMap();
async function stop(app) {
  if (!app) return;
  const child = processes.get(app);
  if (!child) return;
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  // Playwright launches through cmd.exe on Windows; terminate its owned process tree.
  if (process.platform === 'win32') await promisify(execFile)('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 10000 });
  else child.kill('SIGKILL');
  await exited;
}
const watchdog = setTimeout(() => {
  console.error('Native workflow exceeded 120 seconds.');
  stop(application).catch(console.error).finally(() => process.exit(1));
}, 120000);
async function launch(workspace, userData) {
  const packaged = process.env.BENTO_PACKAGED_EXECUTABLE;
  const app = await electron.launch({ executablePath: packaged || electronPath, args: packaged ? ['--user-data-dir=' + userData] : [root], env: { ...process.env, BENTO_TEST_MODE: '1', BENTO_TEST_USER_DATA: userData, ...(workspace ? { BENTO_TEST_WORKSPACE: workspace } : {}) } });
  application = app; processes.set(app, app.process());
  const page = await app.firstWindow(); page.setDefaultTimeout(12000);
  page.on('dialog', dialog => dialog.accept().catch(() => {}));
  await page.waitForLoadState('domcontentloaded');
  if (process.env.BENTO_TEST_SHOW_WINDOW !== '1') {
    assert.deepEqual(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(window => ({ visible: window.isVisible(), focused: window.isFocused(), offscreen: window.webContents.isOffscreen() }))), [{ visible: false, focused: false, offscreen: true }], 'Desktop tests must not show or focus an OS window.');
  }
  if (packaged && workspace) {
    await app.evaluate(({ dialog }, folder) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] }); }, workspace);
    await page.getByRole('button', { name: 'Open workspace', exact: true }).click();
  }
  return { app, page };
}
async function paste(editor, text, html = '') {
  await editor.evaluate((element, data) => {
    const clipboardData = new DataTransfer(); clipboardData.setData('text/plain', data.text);
    if (data.html) clipboardData.setData('text/html', data.html);
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
  }, { text, html });
}
async function saved(page) {
  try { await page.locator('#b-save-state').filter({ hasText: /^Saved$/ }).waitFor(); }
  catch (error) { console.error('Save diagnostics:', await page.locator('#b-save-state').textContent(), await page.locator('#b-file-errors').textContent()); throw error; }
}
async function editProperty(page, name) {
  const button = page.getByRole('button', { name: `Edit ${name}`, exact: true });
  if (!await button.isVisible()) await page.locator('[data-more-properties]>summary').click();
  await button.click();
}
async function setStatus(page, value) {
  await editProperty(page, 'Status');
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption(value);
}
async function addTag(page, value) {
  await editProperty(page, 'Tags');
  const input = page.getByRole('textbox', { name: 'Tags', exact: true });
  await input.fill(value); await input.press('Enter'); await input.press('Escape');
}
(async () => {
  temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'bento-desktop-'));
  const workspace = path.join(temporary, 'Workspace'), userData = path.join(temporary, 'UserData');
  await fs.mkdir(workspace);
  let launched = await launch(null, userData); application = launched.app; let page = launched.page;
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('heading', { name: 'Your projects, notes, and next steps.' }).waitFor();
  const settingsPath = path.join(await application.evaluate(({ app }) => app.getPath('userData')), 'settings.md');
  assert.match(await fs.readFile(settingsPath, 'utf8'), /kind: user-settings/);

  const theme = page.getByRole('button', { name: 'Dark mode', exact: true });
  if (await theme.getAttribute('aria-pressed') === 'true') await theme.click();
  await theme.click();
  assert.equal(await page.locator('#bento-workflow').getAttribute('data-theme'), 'dark');
  assert.equal(await theme.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('html').evaluate(element => getComputedStyle(element).colorScheme), 'dark');
  await application.evaluate(({ dialog }, folder) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] }); }, workspace);
  await page.getByRole('button', { name: 'New workspace', exact: true }).click();
  await saved(page);
  assert.equal(await page.getByRole('button', { name: 'Save files', exact: true }).isVisible(), false);
  assert.equal(await page.getByRole('button', { name: 'Restore draft', exact: true }).isVisible(), false);
  await page.locator('.b-workspace-menu>summary').click();
  assert.equal(await page.getByRole('button', { name: 'Save files', exact: true }).isVisible(), true);
  await page.keyboard.press('Escape');
  console.log('Created workspace through the native dialog.');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('First name', { exact: true }).fill('Maki');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await page.getByRole('heading', { name: /, Maki\??$/ }).waitFor();
  assert.match(await fs.readFile(settingsPath, 'utf8'), /first_name: Maki/);
  assert.equal((await fs.readdir(workspace)).includes('settings.md'), false);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('combobox', { name: 'Color theme', exact: true }).selectOption('catppuccin');
  await page.waitForFunction(() => document.querySelector('#bento-workflow').dataset.colorTheme === 'catppuccin');
  const customTheme = { ...structuredClone(builtinThemes[0]), id: 'desktop-custom', name: 'Desktop custom', dark: { ...builtinThemes[0].dark, paper: '#112233' } };
  const themeFile = path.join(temporary, 'custom.bento-theme.json'); await fs.writeFile(themeFile, JSON.stringify(customTheme));
  await page.locator('[data-theme-file]').setInputFiles(themeFile);
  await page.waitForFunction(() => document.querySelector('#bento-workflow').dataset.colorTheme === 'desktop-custom');
  assert.match(await fs.readFile(settingsPath, 'utf8'), /color_theme: desktop-custom/);
  await page.getByRole('button', { name: 'Back to overview', exact: true }).click();

  assert.equal(await page.locator('aside').getByRole('button', { name: 'Creekside improvements', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Start your first page', exact: true }).click();
  await page.getByRole('textbox', { name: 'Document title', exact: true }).fill('My first project');
  await page.getByRole('button', { name: 'Create page', exact: true }).click();
  await page.getByRole('article', { name: 'Editable Markdown document' }).getByRole('heading', { name: 'My first project', exact: true }).waitFor();
  assert.equal(await page.locator('#b-task-count').count(), 0);
  await page.getByRole('textbox', { name: 'Project Markdown', exact: true }).click();
  await page.keyboard.press('ControlOrMeta+,');
  await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
  await page.keyboard.press('ControlOrMeta+k'); await page.keyboard.press('ControlOrMeta+s');
  const shortcutSearch = page.getByRole('searchbox', { name: 'Search keyboard shortcuts', exact: true });
  assert.equal(await shortcutSearch.evaluate(element => document.activeElement === element), true);
  await shortcutSearch.fill('go back'); assert.equal(await page.locator('[data-shortcut-command]').count(), 1);
  await page.keyboard.press('ControlOrMeta+[');
  await page.getByRole('textbox', { name: 'Project Markdown', exact: true }).waitFor();
  await page.keyboard.press('ControlOrMeta+]'); await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
  await page.keyboard.press(process.platform === 'darwin' ? 'ControlOrMeta+[' : 'Alt+ArrowLeft');
  await page.getByRole('textbox', { name: 'Project Markdown', exact: true }).waitFor();

  await saved(page);
  await setStatus(page, 'option-completed');
  await addTag(page, 'Civil engineering');
  await addTag(page, 'client, internal');
  await editProperty(page, 'Color');
  await page.getByRole('group', { name: 'Color', exact: true }).getByRole('button', { name: 'Purple', exact: true }).click();
  await editProperty(page, 'Tags');
  await page.getByRole('button', { name: 'Color tag Civil engineering', exact: true }).click();
  await page.getByRole('group', { name: 'Tag color', exact: true }).getByRole('button', { name: 'Teal', exact: true }).click();
  await page.getByRole('textbox', { name: 'Tags', exact: true }).press('Escape');
  await saved(page);
  assert.equal(await page.getByRole('button', { name: 'Edit Status', exact: true }).innerText(), 'Completed');
  await setStatus(page, 'option-active');
  await saved(page);
  const projectFiles = (await fs.readdir(path.join(workspace, 'projects'))).filter(name => name.startsWith('project-'));
  assert.equal(projectFiles.length, 1);
  const projectId = projectFiles[0].slice(0, -3);
  assert.match(await fs.readFile(path.join(workspace, 'projects', projectFiles[0]), 'utf8'), /title: My first project/);
  assert.match(await fs.readFile(path.join(workspace, 'projects', projectFiles[0]), 'utf8'), /color: purple/);
  assert.equal(await page.getByRole('button', { name: 'Edit Page title', exact: true }).count(), 0);
  const projectHeading = page.getByRole('textbox', { name: 'Project Markdown', exact: true }).locator('h1').first();
  await projectHeading.click(); await page.keyboard.press('Home');
  await page.keyboard.press('Shift+End'); await page.keyboard.insertText('Temporary project title');
  await page.keyboard.press('ControlOrMeta+s'); await saved(page);
  assert.match(await fs.readFile(path.join(workspace, 'projects', projectFiles[0]), 'utf8'), /title: Temporary project title/);
  await page.keyboard.press('Home'); await page.keyboard.press('Shift+End'); await page.keyboard.insertText('My first project');
  await page.keyboard.press('ControlOrMeta+s'); await saved(page);
  assert.match(await fs.readFile(path.join(workspace, 'workspace.md'), 'utf8'), /Civil engineering: teal/);
  await page.keyboard.press('ControlOrMeta+p');
  const quickDialog = page.getByRole('dialog', { name: 'Quick open', exact: true });
  const quickSearch = quickDialog.getByRole('combobox', { name: 'Search pages and commands', exact: true });
  assert.equal(await quickSearch.inputValue(), '');
  assert.equal(await quickDialog.locator('[data-quick-kind=command]').count(), 0);
  await quickSearch.fill('>new page in Meeting Notes'); await quickSearch.press('Enter');
  assert.equal(await page.getByRole('combobox', { name: 'Project', exact: true }).inputValue(), projectId);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.keyboard.press('ControlOrMeta+Shift+p');
  assert.equal(await quickSearch.inputValue(), '> ');
  await quickSearch.fill('>settings'); await quickSearch.press('Enter');
  await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
  await page.keyboard.press('ControlOrMeta+p'); await quickSearch.fill('My first project'); await quickSearch.press('Enter');
  await page.getByRole('textbox', { name: 'Project Markdown', exact: true }).waitFor();

  assert.equal(await page.locator('aside').getByRole('button', { name: 'My first project', exact: true }).count(), 1);
  await page.locator('aside').getByRole('button', { name: 'New page in Projects', exact: true }).click();
  await page.getByRole('textbox', { name: 'Document title', exact: true }).fill('Canceled project');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.locator('aside').getByRole('button', { name: 'New page in Projects', exact: true }).click();
  await page.keyboard.press('ControlOrMeta+,');
  await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
  await page.keyboard.press('ControlOrMeta+['); await page.getByRole('textbox', { name: 'Project Markdown', exact: true }).waitFor();
  await page.keyboard.press('ControlOrMeta+]'); await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
  await page.keyboard.press('ControlOrMeta+['); await page.getByRole('textbox', { name: 'Project Markdown', exact: true }).waitFor();
  assert.equal((await fs.readdir(path.join(workspace, 'projects'))).filter(name => name.startsWith('project-')).length, 1);
  // Reload after an external directory move: folders remain navigation, not membership changes.
  await fs.mkdir(path.join(workspace, 'projects', 'Design'));
  await fs.rename(path.join(workspace, 'projects', projectFiles[0]), path.join(workspace, 'projects', 'Design', projectFiles[0]));
  await page.locator('.b-workspace-menu>summary').click();
  await page.getByRole('button', { name: 'Reload files', exact: true }).click();
  await saved(page);
  const projectsFolder = page.locator('aside details[data-directory="projects"]');
  const designFolder = page.locator('aside details[data-directory="projects/Design"]');
  assert.equal(await designFolder.getAttribute('open'), null);
  await designFolder.locator(':scope>summary').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('aside details[data-directory="projects/Design"]>summary>.b-tree-chevron')).transform).b - 1) < 0.01);
  await page.locator('aside').getByRole('button', { name: 'My first project', exact: true }).click();
  await page.getByRole('article', { name: 'Editable Markdown document' }).getByRole('heading', { name: 'My first project', exact: true }).waitFor();
  await projectsFolder.locator(':scope>summary').click();
  await page.getByRole('button', { name: 'Daily overview', exact: true }).click();
  assert.equal(await projectsFolder.getAttribute('open'), null);
  await page.waitForFunction(() => Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('aside details[data-directory="projects"]>summary>.b-tree-chevron')).transform).b) < 0.01);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await projectsFolder.locator(':scope>summary').press('Enter');
  assert.equal(await projectsFolder.locator(':scope>summary>.b-tree-chevron').evaluate(element => element.getAnimations().length), 0);
  await projectsFolder.locator(':scope>summary').press('Enter');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  // Opening the project from the overview reveals its folder ancestry.
  await page.locator('main').getByRole('button', { name: 'My first project', exact: true }).click();
  assert.notEqual(await projectsFolder.getAttribute('open'), null);
  assert.notEqual(await designFolder.getAttribute('open'), null);
  console.log('Passed nested directory navigation, keyboard disclosure, retained collapse, and active-path reveal.');
  assert.equal(await page.getByRole('button', { name: 'Download Markdown', exact: true }).count(), 0);
  await page.locator('summary[aria-label="Document actions"]').click();
  await page.locator('main').getByRole('button', { name: 'New page in Meeting Notes', exact: true }).click();
  assert.equal(await page.getByRole('combobox', { name: 'Project', exact: true }).inputValue(), projectId);
  await page.getByRole('textbox', { name: 'Document title', exact: true }).fill('Weekly coordination');
  await page.getByRole('button', { name: 'Create page', exact: true }).click();
  await saved(page);
  const meetingFile = (await fs.readdir(path.join(workspace, 'meetings'))).find(name => name !== 'database.md');
  assert.ok(meetingFile);
  await editProperty(page, 'Meeting date');
  await page.getByLabel('Meeting date', { exact: true }).fill('2026-10-20');
  await page.getByLabel('Meeting date', { exact: true }).press('Enter');
  await editProperty(page, 'Related projects');
  assert.equal(await page.getByRole('group', { name: 'Related projects', exact: true }).getByRole('checkbox', { name: 'My first project', exact: true }).isChecked(), true);
  await page.getByRole('searchbox', { name: 'Search Related projects', exact: true }).press('Escape');
  await addTag(page, 'Follow up');
  await saved(page);
  const meetingRaw = await fs.readFile(path.join(workspace, 'meetings', meetingFile), 'utf8');
  assert.match(meetingRaw, /2026-10-20/); assert.match(meetingRaw, /Follow up/);
  console.log('Created and opened project Markdown, canceled without a file, and linked a meeting note.');

  const meetingEditor = page.getByRole('textbox', { name: 'Page Markdown', exact: true });
  await meetingEditor.click(); await meetingEditor.press('ControlOrMeta+End'); await meetingEditor.press('Enter');
  await meetingEditor.pressSequentially('[] '); await meetingEditor.pressSequentially('Desktop action');
  await saved(page);
  let filename;
  for (const name of (await fs.readdir(path.join(workspace, 'todos'))).filter(name => name.startsWith('todo-'))) if ((await fs.readFile(path.join(workspace, 'todos', name), 'utf8')).includes('title: Desktop action')) filename = name;
  assert.ok(filename, 'Typed checkbox creates a real Markdown todo file');
  console.log('Captured a checkbox into its Markdown todo file.');
  assert.match(await fs.readFile(path.join(workspace, 'meetings', meetingFile), 'utf8'), new RegExp('../todos/' + filename));
  await page.getByRole('link', { name: 'Desktop action', exact: true }).click();

  const todoEditor = page.getByRole('textbox', { name: 'Todo Markdown', exact: true });
  await todoEditor.click(); await todoEditor.press('ControlOrMeta+a');
  await paste(todoEditor, '# Supporting notes\n\nKeep this project detail.\n');

  await setStatus(page, 'option-started');
  await saved(page);
  let raw = await fs.readFile(path.join(workspace, 'todos', filename), 'utf8');
  assert.match(raw, /Keep this project detail/); assert.match(raw, /option-started/);
  assert.doesNotMatch(raw, /^database:/m);
  assert.match(raw, new RegExp(projectId));
  assert.deepEqual(await page.evaluate(() => ({ node: typeof process, require: typeof require, bridge: Object.keys(window.bentoDesktop).sort() })), { node: 'undefined', require: 'undefined', bridge: ['create', 'initial', 'open', 'reload', 'rememberLocation', 'save', 'settingsRead', 'settingsSave'] });
  await fs.mkdir(path.join(root, 'work', 'qa'), { recursive: true });
  await page.locator('#bento-workflow').screenshot({ path: path.join(root, 'work/qa/desktop-todo.png') });
  assert.deepEqual(errors, []);

  await page.locator('aside').getByRole('button', { name: 'My first project', exact: true }).click();
  await page.locator('summary[aria-label="Document actions"]').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: 'Review project work', exact: true }).isVisible(), false);
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Review project work', exact: true }).click();
  await page.getByRole('region', { name: 'Related notes', exact: true }).getByRole('button', { name: 'Weekly coordination', exact: true }).waitFor();
  await page.getByRole('region', { name: 'Without a date', exact: true }).getByRole('button', { name: 'Desktop action', exact: true }).waitFor();
  await page.locator('#bento-workflow').screenshot({ path: path.join(root, 'work/qa/project-review.png') });
  await page.getByRole('region', { name: 'Related notes', exact: true }).getByRole('button', { name: 'Weekly coordination', exact: true }).click();
  await page.getByRole('article', { name: 'Editable Markdown document' }).waitFor();
  await page.getByRole('button', { name: 'Collapse all folders', exact: true }).click();
  assert.equal(await page.locator('aside details[open]').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Collapse all folders', exact: true }).evaluate(button => document.activeElement === button), true);
  await page.waitForFunction(key => {
    const folders = JSON.parse(localStorage.getItem(key) || '{}');
    return folders.projects === false && folders.todos === false;
  }, 'bento.sidebar.tree.v1:' + await fs.realpath(workspace));
  await application.close(); application = null;
  console.log('Closed the app after saving. Reopening workspace.');
  launched = await launch(null, userData); application = launched.app; page = launched.page;
  await saved(page);
  assert.equal(await page.locator('aside [aria-current="page"]').getAttribute('data-record') !== null, true);
  await page.getByRole('article', { name: 'Editable Markdown document' }).getByRole('heading', { name: 'Weekly coordination', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Daily overview', exact: true }).click();
  await page.getByRole('heading', { name: /, Maki\??$/ }).waitFor();
  assert.equal(await page.locator('#bento-workflow').getAttribute('data-color-theme'), 'desktop-custom');
  assert.equal(await page.locator('#bento-workflow').getAttribute('data-theme'), 'dark');
  assert.equal(await page.getByRole('button', { name: 'Dark mode', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
  assert.equal(await page.locator('#bento-workflow').getAttribute('data-theme'), 'light');
  assert.equal(await page.locator('aside details[data-directory="projects"]').getAttribute('open'), null);
  await page.locator('aside').getByRole('button', { name: 'Weekly coordination', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Edit Meeting date', exact: true }).innerText(), '2026-10-20');
  assert.equal(await page.getByRole('button', { name: 'Edit Tags', exact: true }).innerText(), 'Follow up');
  await addTag(page, 'Civil engineering');
  assert.equal(await page.getByRole('button', { name: 'Edit Tags', exact: true }).locator('[data-color="teal"]').count(), 1);
  await editProperty(page, 'Related projects');
  await page.locator('#bento-workflow').screenshot({ path: path.join(root, 'work/qa/desktop-meeting-properties.png') });
  assert.equal(await page.getByRole('group', { name: 'Related projects', exact: true }).getByRole('checkbox', { name: 'My first project', exact: true }).isChecked(), true);

  await page.locator('aside details[data-directory="todos"]>summary').click();
  await page.getByRole('navigation', { name: 'Workspace files', exact: true }).getByRole('button', { name: 'Desktop action', exact: true }).click();
  assert.match(await page.locator('#b-reading').innerText(), /Keep this project detail/);
  assert.equal(await page.getByRole('button', { name: 'Edit Status', exact: true }).innerText(), 'In progress');
  await page.getByRole('checkbox', { name: 'Completed', exact: true }).click();
  await saved(page);
  assert.match(await fs.readFile(path.join(workspace, 'meetings', meetingFile), 'utf8'), /\[x\] \[Desktop action\]/);

  await page.getByRole('textbox', { name: 'Todo Markdown', exact: true }).click();
  await page.getByRole('textbox', { name: 'Todo Markdown', exact: true }).press('ControlOrMeta+a');
  await paste(page.getByRole('textbox', { name: 'Todo Markdown', exact: true }), 'Unsaved local detail');
  await fs.appendFile(path.join(workspace, 'todos', filename), '\nExternal detail\n');
  await page.getByRole('textbox', { name: 'Todo Markdown', exact: true }).press('ControlOrMeta+s');
  await page.locator('#b-file-errors').filter({ hasText: 'changed on disk' }).waitFor();
  raw = await fs.readFile(path.join(workspace, 'todos', filename), 'utf8');
  assert.match(raw, /External detail/); assert.doesNotMatch(raw, /Unsaved local detail/);
  assert.equal(await page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('bento.desktop.draft.') && localStorage.getItem(key).includes('Unsaved local detail'))), true);
  await page.getByRole('button', { name: 'Draft kept', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Download draft', exact: true }).isVisible(), true);
  await page.keyboard.press('Escape');
  console.log('Passed native create/open, typed checkbox → Markdown files, grouped status, todo notes, restart, completion propagation, sandbox bridge, external-change protection, and retained draft.');
  await stop(application); application = null;
  const movedWorkspace = path.join(temporary, 'Reconnected workspace');
  await fs.rename(workspace, movedWorkspace);
  launched = await launch(null, userData); application = launched.app; page = launched.page;
  await page.getByRole('heading', { name: 'Your projects, notes, and next steps.' }).waitFor();
  assert.match(await page.locator('#b-status').innerText(), /last workspace is unavailable/);
  await application.evaluate(({ dialog }, folder) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] }); }, movedWorkspace);
  await page.getByRole('button', { name: 'Open workspace', exact: true }).click();
  await saved(page);
  assert.doesNotMatch(await page.locator('#b-status').innerText(), /last workspace is unavailable/);
  console.log('Passed disconnected-workspace welcome fallback and recovery through another folder.');
  await stop(application); application = null;
  await checkOnboarding({ launch, stop, temporary, root });
  await checkWorkspaceCustomization({ launch, stop, temporary, root });
  await checkPageWorkflow({ launch, stop, temporary, root });
  await checkDailyWorkflow({ launch, stop, temporary, root });

})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  try {
    await stop(application);
    if (temporary) await fs.rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } finally { clearTimeout(watchdog); }
});
