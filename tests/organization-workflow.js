import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { WorkspaceRepository } from '../files/repository.js';

export async function checkOrganizationWorkflow({ launch, stop, temporary, root }) {
  const folder = path.join(temporary, 'Organized workspace'), userData = path.join(temporary, 'OrganizationUserData');
  await fs.cp(path.join(root, 'examples/document-databases'), folder, { recursive: true });
  let launched = await launch(folder, userData), app = launched.app, page = launched.page;
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const saved = () => page.locator('#b-save-state').filter({ hasText: /^Saved$/ }).waitFor();
  const main = () => page.locator('main');
  const browse = async name => {
    await page.locator(`aside [data-open-folder="${name}"]`).click();
    await main().getByRole('heading', { name: ({projects:'Projects',todos:'Todos',meetings:'Meeting Notes'})[name] || name.split('/').at(-1) || 'Example workspace', exact: true }).waitFor();
  };
  const createFolder = async name => {
    await main().getByRole('button', { name: 'New folder', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'New folder', exact: true });
    await dialog.getByRole('textbox', { name: 'Folder name', exact: true }).fill(name);
    await dialog.getByRole('button', { name: 'Create folder', exact: true }).click();
    await main().getByRole('heading', { name, exact: true }).waitFor();
  };
  const createPage = async (title, database = '') => {
    await main().getByRole('button', { name: 'New page', exact: true }).click();
    await page.getByRole('textbox', { name: 'Document title', exact: true }).fill(title);
    await page.getByRole('combobox', { name: 'Database', exact: true }).selectOption(database);
    if (database) {
      assert.equal(await page.getByRole('combobox', { name: 'Folder', exact: true }).inputValue(), 'meetings');
      assert.equal(await page.getByRole('combobox', { name: 'Folder', exact: true }).locator('option[value="notes"]').count(), 0);
    }
    await page.getByRole('button', { name: 'Create page', exact: true }).click(); await saved();
  };
  try {
    await saved();
    assert.equal(await page.getByRole('button', { name: 'Review upgrade', exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => 'upgrade' in window.bentoDesktop), false);
    assert.equal(await page.locator('aside [data-directory=""]').count(), 1);
    assert.equal(await page.locator('aside').getByRole('button', { name: 'Workspace', exact: true }).count(), 1);
    assert.equal(await page.getByRole('button', { name: 'Collapse all folders', exact: true }).count(), 0);
    await browse('notes'); await createFolder('Drainage'); await createFolder('Design');
    // Empty folders are real filesystems entries, visible and traversable before any pages exist.
    await fs.access(path.join(folder, 'notes/Drainage/Design'));
    await main().getByRole('button', { name: 'New folder', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'New folder', exact: true });
    await dialog.getByRole('textbox', { name: 'Folder name', exact: true }).fill('../escape');
    await dialog.getByRole('button', { name: 'Create folder', exact: true }).click();
    await dialog.getByRole('alert').filter({ hasText: /relative|portable|folder|name/i }).waitFor();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await createPage('Drainage musings');
    let repo = await WorkspaceRepository.open(folder);
    const note = Object.values(repo.workspace.records).find(doc => doc.title === 'Drainage musings');
    assert.equal(repo.workspace.paths[note.id], `notes/Drainage/Design/${note.id}.md`);
    assert.equal(note.database, undefined);
    await browse('notes/Drainage/Design'); await createPage('Design coordination', 'db-meetings');
    repo = await WorkspaceRepository.open(folder);
    const meeting = Object.values(repo.workspace.records).find(doc => doc.title === 'Design coordination');
    assert.equal(meeting.database, 'db-meetings');
    assert.equal(repo.workspace.paths[meeting.id], `meetings/${meeting.id}.md`);
    const editor = page.getByRole('textbox', { name: 'Page Markdown', exact: true });
    await editor.press('ControlOrMeta+End'); await editor.press('Enter'); await editor.pressSequentially('See [[Drainage mus');
    await page.getByRole('listbox', { name: 'Link a page', exact: true }).waitFor(); await editor.press('Enter'); await saved();
    await editor.getByRole('link', { name: 'Drainage musings', exact: true }).click();
    await page.locator('summary[aria-label="Document actions"]').click();
    await page.getByRole('button', { name: 'Move page…', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Move page', exact: true });
    assert.equal(await dialog.locator('option[value="projects"]').count(), 0);
    await dialog.getByRole('combobox', { name: 'Destination folder', exact: true }).selectOption('notes/Drainage');
    await dialog.getByRole('button', { name: 'Move page', exact: true }).click();
    await main().getByRole('heading', { name: 'Drainage', exact: true }).waitFor();
    await main().getByRole('button', { name: 'Drainage musings', exact: true }).click();
    repo = await WorkspaceRepository.open(folder);
    assert.equal(repo.workspace.records[note.id].database, undefined, 'Moving between regular folders keeps an ordinary page untyped');
    assert.equal(repo.workspace.paths[note.id], `notes/Drainage/${note.id}.md`);
    assert.match(repo.workspace.records[meeting.id].body, /\.\.\/notes\/Drainage\/note-/);
    await page.getByRole('navigation', { name: 'File path', exact: true }).getByRole('button', { name: 'Drainage', exact: true }).click();
    await page.keyboard.press('ControlOrMeta+[');
    await page.getByRole('textbox', { name: 'Page Markdown', exact: true }).waitFor();
    await page.keyboard.press('ControlOrMeta+]');
    await main().getByRole('heading', { name: 'Drainage', exact: true }).waitFor();
    await browse('notes/Drainage/Design');
    await page.locator('#bento-workflow').screenshot({ path: path.join(root, 'work/qa/folder-browser.png') });
    await page.setViewportSize({ width: 800, height: 500 });
    assert.equal(await page.locator('aside [data-view="profile"]').evaluate(button => button.getBoundingClientRect().bottom <= innerHeight), true);
    await page.setViewportSize({ width: 600, height: 800 });
    assert.equal(await page.locator('body').evaluate(body => body.scrollWidth <= innerWidth + 1), true);
    await app.close(); app = null;
    launched = await launch(null, userData); app = launched.app; page = launched.page;
    await main().getByRole('heading', { name: 'Design', exact: true }).waitFor();
    await browse('meetings');
    const meetingTable = page.getByRole('table', { name: 'Meeting Notes records', exact: true });
    await meetingTable.getByRole('columnheader', { name: 'Meeting date', exact: true }).waitFor();
    assert.match(await meetingTable.innerText(), /Creekside improvements/);
    assert.equal(await main().getByRole('button', { name: 'New folder', exact: true }).count(), 0);
    const newRecord = main().getByRole('button', { name: 'New page', exact: true });
    assert.equal(await newRecord.innerText(), '');
    await page.locator('#bento-workflow').screenshot({ path: path.join(root, 'work/qa/database-browser.png') });
    await newRecord.focus(); await newRecord.press('Enter');
    assert.equal(await page.getByRole('combobox', { name: 'Database', exact: true }).inputValue(), 'db-meetings');
    assert.equal(await page.getByRole('combobox', { name: 'Folder', exact: true }).inputValue(), 'meetings');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await meetingTable.getByRole('button', { name: 'Design coordination', exact: true }).click();
    await page.getByRole('textbox', { name: 'Page Markdown', exact: true }).getByRole('link', { name: 'Drainage musings', exact: true }).click();
    await page.getByRole('article', { name: 'Editable Markdown document' }).getByRole('heading', { name: 'Drainage musings', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Daily overview', exact: true }).click();
    const workspaceRoot = page.locator('aside details[data-directory=""]');
    await workspaceRoot.locator(':scope>summary').press('Enter');
    await page.waitForFunction(() => {
      const key = Object.keys(localStorage).find(key => key.startsWith('bento.sidebar.tree.v1:'));
      return key && JSON.parse(localStorage.getItem(key))[''] === false;
    });
    await app.close(); app = null;
    launched = await launch(null, userData); app = launched.app; page = launched.page;
    await page.locator('aside details[data-directory=""]').waitFor();
    assert.equal(await page.locator('aside details[data-directory=""]').getAttribute('open'), null);
    await page.locator('aside [data-record]').filter({ hasText: /^Workspace$/ }).waitFor({ state: 'hidden' });
    await page.locator('aside details[data-directory=""]>summary').press('Enter');
    await page.locator('aside').getByRole('button', { name: 'Workspace', exact: true }).click();
    await page.getByRole('textbox', { name: 'Workspace Markdown', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log('Passed immediate folder access without upgrade UI, nested empty folders, folder browsing/creation, folder-owned database membership, page move/link repair, breadcrumbs/history, responsive layout and folder restoration.');
  } finally { await stop(app); }
}
