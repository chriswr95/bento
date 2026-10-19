const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
let application, temporary;
async function launch(workspace, userData) {
  const packaged = process.env.BENTO_PACKAGED_EXECUTABLE;
  const app = await electron.launch({ executablePath: packaged || require('electron'), args: packaged ? ['--user-data-dir=' + userData] : [root], env: { ...process.env, BENTO_TEST_MODE: '1', BENTO_TEST_USER_DATA: userData, ...(workspace ? { BENTO_TEST_WORKSPACE: workspace } : {}) } });
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
  await page.getByRole('button', { name: 'Meeting note', exact: true }).click();
  await page.getByRole('button', { name: 'Write a note…', exact: true }).click();
  await page.getByRole('textbox', { name: 'Meeting Markdown', exact: true }).pressSequentially('[] ');
  await page.locator('[data-task-title]:focus').pressSequentially('Desktop action');
  await saved(page);
  let filename;
  for (const name of (await fs.readdir(path.join(workspace, 'todos'))).filter(name => name.startsWith('todo-'))) if ((await fs.readFile(path.join(workspace, 'todos', name), 'utf8')).includes('title: Desktop action')) filename = name;
  assert.ok(filename, 'Typed checkbox creates a real Markdown todo file');
  assert.match(await fs.readFile(path.join(workspace, 'meetings/meeting-coordination.md'), 'utf8'), new RegExp('../todos/' + filename));
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
  assert.deepEqual(await page.evaluate(() => ({ node: typeof process, require: typeof require, bridge: Object.keys(window.bentoDesktop).sort() })), { node: 'undefined', require: 'undefined', bridge: ['create', 'initial', 'open', 'reload', 'save'] });
  await fs.mkdir(path.join(root, 'work', 'qa'), { recursive: true });
  await page.locator('#bento-workflow').screenshot({ path: path.join(root, 'work/qa/desktop-todo.png') });
  assert.deepEqual(errors, []);
  await application.close(); application = null;
  launched = await launch(workspace, userData); application = launched.app; page = launched.page;
  await saved(page);
  await page.getByRole('navigation', { name: 'Documents', exact: true }).getByRole('button', { name: 'Desktop action', exact: true }).click();
  assert.match(await page.locator('#b-reading').innerText(), /Keep this project detail/);
  assert.equal(await page.getByRole('combobox', { name: 'Status', exact: true }).inputValue(), 'option-started');
  await page.getByRole('checkbox', { name: 'Completed', exact: true }).click();
  await saved(page);
  assert.match(await fs.readFile(path.join(workspace, 'meetings/meeting-coordination.md'), 'utf8'), /\[x\] \[Desktop action\]/);
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
  if (application) {
    const child = application.process();
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGKILL'); await exited;
  }
  if (temporary) await fs.rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});
