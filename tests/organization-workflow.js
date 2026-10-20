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
    await main().getByRole('heading', { name: name.split('/').at(-1) || 'Files', exact: true }).waitFor();
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
    await page.getByRole('button', { name: 'Create page', exact: true }).click(); await saved();
  };
  try {
    await page.getByRole('button', { name: 'Review upgrade', exact: true }).click();
    await main().getByRole('heading', { name: 'Separate folders from databases', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Upgrade workspace', exact: true }).click(); await saved();
    await page.locator('.b-organization-upgrade').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('aside [data-directory="databases"]').count(), 0);
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
    assert.equal(repo.workspace.paths[meeting.id], `notes/Drainage/Design/${meeting.id}.md`);
    const editor = page.getByRole('textbox', { name: 'Page Markdown', exact: true });
    await editor.press('ControlOrMeta+End'); await editor.press('Enter'); await editor.pressSequentially('See [[Drainage mus');
    await page.getByRole('listbox', { name: 'Link a page', exact: true }).waitFor(); await editor.press('Enter'); await saved();
    await editor.getByRole('link', { name: 'Drainage musings', exact: true }).click();
    await page.locator('summary[aria-label="Document actions"]').click();
    await page.getByRole('button', { name: 'Move page…', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Move page', exact: true });
    await dialog.getByRole('combobox', { name: 'Destination folder', exact: true }).selectOption('projects');
    await dialog.getByRole('button', { name: 'Move page', exact: true }).click();
    await main().getByRole('heading', { name: 'projects', exact: true }).waitFor();
    await main().getByRole('button', { name: 'Drainage musings', exact: true }).click();
    repo = await WorkspaceRepository.open(folder);
    assert.equal(repo.workspace.records[note.id].database, undefined, 'Moving into projects must not turn an ordinary page into a Project');
    assert.equal(repo.workspace.paths[note.id], `projects/${note.id}.md`);
    assert.match(repo.workspace.records[meeting.id].body, /\.\.\/\.\.\/\.\.\/projects\/note-/);
    await page.getByRole('navigation', { name: 'File path', exact: true }).getByRole('button', { name: 'projects', exact: true }).click();
    await page.keyboard.press('ControlOrMeta+[');
    await page.getByRole('textbox', { name: 'Page Markdown', exact: true }).waitFor();
    await page.keyboard.press('ControlOrMeta+]');
    await main().getByRole('heading', { name: 'projects', exact: true }).waitFor();
    await browse('notes/Drainage/Design');
    await page.locator('#bento-workflow').screenshot({ path: path.join(root, 'work/qa/folder-browser.png') });
    await page.setViewportSize({ width: 800, height: 500 });
    assert.equal(await page.locator('aside [data-view="profile"]').evaluate(button => button.getBoundingClientRect().bottom <= innerHeight), true);
    await page.setViewportSize({ width: 600, height: 800 });
    assert.equal(await page.locator('body').evaluate(body => body.scrollWidth <= innerWidth + 1), true);
    await app.close(); app = null;
    launched = await launch(null, userData); app = launched.app; page = launched.page;
    await main().getByRole('heading', { name: 'Design', exact: true }).waitFor();
    await main().getByRole('button', { name: 'Design coordination', exact: true }).click();
    await page.getByRole('textbox', { name: 'Page Markdown', exact: true }).getByRole('link', { name: 'Drainage musings', exact: true }).click();
    await page.getByRole('article', { name: 'Editable Markdown document' }).getByRole('heading', { name: 'Drainage musings', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log('Passed explicit upgrade, nested empty folders, folder browsing/creation, mixed database membership, page move/link repair, breadcrumbs/history, responsive layout and folder restoration.');
  } finally { await stop(app); }
}
