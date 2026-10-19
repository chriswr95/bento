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
async function stop(app) {
  if (!app) return;
  const child = app.process();
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
  application = app;
  const page = await app.firstWindow(); page.setDefaultTimeout(12000);
  page.on('dialog', dialog => dialog.accept().catch(() => {}));
  await page.waitForLoadState('domcontentloaded');
  if (packaged && workspace) {
    await app.evaluate(({ dialog }, folder) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] }); }, workspace);
    await page.getByRole('button', { name: 'Open workspace', exact: true }).click();
  }
  return { app, page };
}
async function saved(page) {
  try { await page.locator('#b-save-state').filter({ hasText: 'Saved to workspace files' }).waitFor(); }
  catch (error) { console.error('Save diagnostics:', await page.locator('#b-save-state').textContent(), await page.locator('#b-file-errors').textContent()); throw error; }
}
(async () => {
  temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'bento-desktop-'));
  const workspace = path.join(temporary, 'Workspace'), userData = path.join(temporary, 'UserData');
  await fs.mkdir(workspace);
  let launched = await launch(null, userData); application = launched.app; let page = launched.page;
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('heading', { name: 'Your workspace, in Markdown.' }).waitFor();
  await application.evaluate(({ dialog }, folder) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] }); }, workspace);
  await page.getByRole('button', { name: 'New workspace', exact: true }).click();
  await saved(page);
  console.log('Created workspace through the native dialog.');
  assert.equal(await page.locator('aside').getByRole('button', { name: 'Creekside improvements', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Create your first project', exact: true }).click();
  await page.getByRole('textbox', { name: 'Document title', exact: true }).fill('My first project');
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await page.getByRole('article', { name: 'Editable Markdown document' }).getByRole('heading', { name: 'My first project', exact: true }).waitFor();
  await saved(page);
  await page.locator('.b-page-properties>summary').click();
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('option-completed');
  await page.getByRole('textbox', { name: 'Tags', exact: true }).fill('Civil engineering\nclient, internal');
  await page.getByRole('button', { name: 'Save properties', exact: true }).click();
  await saved(page);
  await page.locator('.b-page-properties>summary').click();
  assert.equal(await page.getByRole('combobox', { name: 'Status', exact: true }).inputValue(), 'option-completed');
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('option-active');
  await page.getByRole('button', { name: 'Save properties', exact: true }).click();
  await saved(page);
  const projectFiles = (await fs.readdir(path.join(workspace, 'projects'))).filter(name => name.startsWith('project-'));
  assert.equal(projectFiles.length, 1);
  const projectId = projectFiles[0].slice(0, -3);
  assert.match(await fs.readFile(path.join(workspace, 'projects', projectFiles[0]), 'utf8'), /title: My first project/);
  assert.equal(await page.locator('aside').getByRole('button', { name: 'My first project', exact: true }).count(), 1);
  await page.locator('aside').getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByRole('textbox', { name: 'Document title', exact: true }).fill('Canceled project');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
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
  await page.locator('aside').getByRole('button', { name: 'My first project', exact: true }).click();
  await page.getByRole('article', { name: 'Editable Markdown document' }).getByRole('heading', { name: 'My first project', exact: true }).waitFor();
  await projectsFolder.locator(':scope>summary').click();
  await page.getByRole('button', { name: 'Daily overview', exact: true }).click();
  assert.equal(await projectsFolder.getAttribute('open'), null);
  // Opening the project from the overview reveals its folder ancestry.
  await page.locator('main').getByRole('button', { name: 'My first project', exact: true }).click();
  assert.notEqual(await projectsFolder.getAttribute('open'), null);
  assert.notEqual(await designFolder.getAttribute('open'), null);
  console.log('Passed nested directory navigation, keyboard disclosure, retained collapse, and active-path reveal.');
  await page.locator('main').getByRole('button', { name: 'New meeting note', exact: true }).click();
  assert.equal(await page.getByRole('combobox', { name: 'Project', exact: true }).inputValue(), projectId);
  await page.getByRole('textbox', { name: 'Document title', exact: true }).fill('Weekly coordination');
  await page.getByRole('button', { name: 'Create page', exact: true }).click();
  await saved(page);
  const meetingFile = (await fs.readdir(path.join(workspace, 'meetings'))).find(name => name !== 'database.md');
  assert.ok(meetingFile);
  await page.locator('.b-page-properties>summary').click();
  await page.getByLabel('Meeting date', { exact: true }).fill('2026-10-20');
  assert.equal(await page.getByRole('group', { name: 'Related projects', exact: true }).getByRole('checkbox', { name: 'My first project', exact: true }).isChecked(), true);
  await page.getByRole('textbox', { name: 'Tags', exact: true }).fill('Follow up');
  await page.getByRole('button', { name: 'Save properties', exact: true }).click();
  await saved(page);
  const meetingRaw = await fs.readFile(path.join(workspace, 'meetings', meetingFile), 'utf8');
  assert.match(meetingRaw, /2026-10-20/); assert.match(meetingRaw, /Follow up/);
  console.log('Created and opened project Markdown, canceled without a file, and linked a meeting note.');
  await page.getByRole('button', { name: 'Write a note…', exact: true }).click();
  await page.getByRole('textbox', { name: 'Meeting Markdown', exact: true }).pressSequentially('[] ');
  await page.locator('[data-task-title]:focus').pressSequentially('Desktop action');
  await saved(page);
  let filename;
  for (const name of (await fs.readdir(path.join(workspace, 'todos'))).filter(name => name.startsWith('todo-'))) if ((await fs.readFile(path.join(workspace, 'todos', name), 'utf8')).includes('title: Desktop action')) filename = name;
  assert.ok(filename, 'Typed checkbox creates a real Markdown todo file');
  console.log('Captured a checkbox into its Markdown todo file.');
  assert.match(await fs.readFile(path.join(workspace, 'meetings', meetingFile), 'utf8'), new RegExp('../todos/' + filename));
  await page.getByRole('button', { name: 'Open Desktop action', exact: true }).click();
  await page.getByRole('button', { name: 'Write a note…', exact: true }).click();
  await page.getByRole('textbox', { name: 'Todo Markdown', exact: true }).fill('# Supporting notes\n\nKeep this project detail.\n');
  await page.getByRole('textbox', { name: 'Todo Markdown', exact: true }).press('Escape');
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('option-started');
  await page.getByRole('button', { name: 'Save properties', exact: true }).click();
  await saved(page);
  let raw = await fs.readFile(path.join(workspace, 'todos', filename), 'utf8');
  assert.match(raw, /Keep this project detail/); assert.match(raw, /option-started/);
  assert.doesNotMatch(raw, /^database:/m);
  assert.match(raw, new RegExp(projectId));
  assert.deepEqual(await page.evaluate(() => ({ node: typeof process, require: typeof require, bridge: Object.keys(window.bentoDesktop).sort() })), { node: 'undefined', require: 'undefined', bridge: ['create', 'initial', 'open', 'reload', 'save'] });
  await fs.mkdir(path.join(root, 'work', 'qa'), { recursive: true });
  await page.locator('#bento-workflow').screenshot({ path: path.join(root, 'work/qa/desktop-todo.png') });
  assert.deepEqual(errors, []);
  await page.locator('aside details[data-directory="projects"]>summary').click();
  await page.locator('aside details[data-directory="todos"]>summary').click();
  await application.close(); application = null;
  console.log('Closed the app after saving. Reopening workspace.');
  launched = await launch(workspace, userData); application = launched.app; page = launched.page;
  await saved(page);
  assert.equal(await page.locator('aside details[data-directory="projects"]').getAttribute('open'), null);
  await page.locator('aside').getByRole('button', { name: 'Weekly coordination', exact: true }).click();
  await page.locator('.b-page-properties>summary').click();
  assert.equal(await page.getByLabel('Meeting date', { exact: true }).inputValue(), '2026-10-20');
  assert.equal(await page.getByRole('textbox', { name: 'Tags', exact: true }).inputValue(), 'Follow up');
  await page.locator('#bento-workflow').screenshot({ path: path.join(root, 'work/qa/desktop-meeting-properties.png') });
  assert.equal(await page.getByRole('group', { name: 'Related projects', exact: true }).getByRole('checkbox', { name: 'My first project', exact: true }).isChecked(), true);

  await page.locator('aside details[data-directory="todos"]>summary').click();
  await page.getByRole('navigation', { name: 'Workspace files', exact: true }).getByRole('button', { name: 'Desktop action', exact: true }).click();
  assert.match(await page.locator('#b-reading').innerText(), /Keep this project detail/);
  assert.equal(await page.getByRole('combobox', { name: 'Status', exact: true }).inputValue(), 'option-started');
  await page.getByRole('checkbox', { name: 'Completed', exact: true }).click();
  await saved(page);
  assert.match(await fs.readFile(path.join(workspace, 'meetings', meetingFile), 'utf8'), /\[x\] \[Desktop action\]/);
  await page.getByRole('button', { name: 'Write a note…', exact: true }).click();
  await page.getByRole('textbox', { name: 'Todo Markdown', exact: true }).fill('Unsaved local detail');
  await fs.appendFile(path.join(workspace, 'todos', filename), '\nExternal detail\n');
  await page.getByRole('button', { name: 'Save files', exact: true }).click();
  await page.locator('#b-file-errors').filter({ hasText: 'changed on disk' }).waitFor();
  raw = await fs.readFile(path.join(workspace, 'todos', filename), 'utf8');
  assert.match(raw, /External detail/); assert.doesNotMatch(raw, /Unsaved local detail/);
  assert.equal(await page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('bento.desktop.draft.') && localStorage.getItem(key).includes('Unsaved local detail'))), true);
  console.log('Passed native create/open, typed checkbox → Markdown files, grouped status, todo notes, restart, completion propagation, sandbox bridge, external-change protection, and retained draft.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  try {
    await stop(application);
    if (temporary) await fs.rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } finally { clearTimeout(watchdog); }
});
