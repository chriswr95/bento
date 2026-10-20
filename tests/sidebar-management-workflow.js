import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { WorkspaceRepository } from '../files/repository.js';
import { trashPath } from '../files/trash-paths.js';
import * as markdown from '../files/markdown.js';

export async function checkSidebarManagement({ launch, stop, temporary, root }) {
  const folder = path.join(temporary, 'Sidebar workspace'), userData = path.join(temporary, 'SidebarUserData');
  await fs.cp(path.join(root, 'examples/document-databases'), folder, { recursive: true });
  let launched = await launch(folder, userData), app = launched.app, page = launched.page;
  const errors = []; const listen = () => page.on('pageerror', error => errors.push(error.message)); listen();
  const saved = () => page.locator('#b-save-state').filter({ hasText: /^Saved$/ }).waitFor();
  const tree = () => page.getByRole('navigation', { name: 'Workspace files', exact: true });
  const row = id => tree().locator(`[data-record="${id}"]`);
  const folderRow = value => tree().locator(`[data-open-folder="${value}"]`);
  const menu = name => page.getByRole('menu', { name, exact: true });
  const create = async title => {
    await page.getByRole('textbox', { name: 'Document title', exact: true }).fill(title);
    await page.getByRole('button', { name: 'Create page', exact: true }).click(); await saved();
    const repo = await WorkspaceRepository.open(folder);
    return Object.values(repo.workspace.records).find(record => record.title === title);
  };
  try {
    await tree().waitFor();
    await folderRow('').click({ button: 'right' });
    await menu('Folder actions').getByRole('menuitem', { name: 'New file…', exact: true }).click();
    assert.equal(await page.getByRole('combobox', { name: 'Folder', exact: true }).inputValue(), '');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    // An unrelated file action must preserve an unfinished New file form.
    await folderRow('notes').click({ button: 'right' });
    await menu('Folder actions').getByRole('menuitem', { name: 'New file…', exact: true }).click();
    await page.getByRole('textbox', { name: 'Document title', exact: true }).fill('Keep this unfinished title');
    await row('note-scratch').focus(); await row('note-scratch').press('Delete');
    await page.locator('.b-deletion-notice').filter({ hasText: 'Deleted Scratch notes.' }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: 'Document title', exact: true }).inputValue(), 'Keep this unfinished title');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.locator('.b-deletion-notice').getByRole('button', { name: 'Undo', exact: true }).click();
    await row('note-scratch').waitFor();
    // Right-clicking a folder targets that exact folder and supports menu keyboard navigation.
    await folderRow('notes').click({ button: 'right' });
    await menu('Folder actions').getByRole('menuitem', { name: 'New file…', exact: true }).waitFor();
    await page.keyboard.press('ArrowDown');
    assert.equal(await menu('Folder actions').getByRole('menuitem', { name: 'New file…', exact: true }).evaluate(element => document.activeElement === element), true);
    await page.keyboard.press('Escape');
    assert.equal(await folderRow('notes').evaluate(element => document.activeElement === element), true);
    await folderRow('notes').press('Shift+F10');
    await menu('Folder actions').getByRole('menuitem', { name: 'New folder…', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'New folder', exact: true });
    assert.equal(await dialog.getByRole('combobox', { name: 'Parent folder', exact: true }).inputValue(), 'notes');
    await dialog.getByRole('textbox', { name: 'Folder name', exact: true }).fill('Context child');
    await dialog.getByRole('button', { name: 'Create folder', exact: true }).click();
    await page.locator('main').getByRole('heading', { name: 'Context child', exact: true }).waitFor();
    await fs.access(path.join(folder, 'notes/Context child'));
    await folderRow('notes/Context child').click({ button: 'right' });
    await menu('Folder actions').getByRole('menuitem', { name: 'New file…', exact: true }).click();
    assert.equal(await page.getByRole('combobox', { name: 'Folder', exact: true }).inputValue(), 'notes/Context child');
    assert.equal(await page.getByRole('combobox', { name: 'Database', exact: true }).inputValue(), '');
    const note = await create('Context note');
    let repo = await WorkspaceRepository.open(folder);
    assert.equal(repo.workspace.paths[note.id], `notes/Context child/${note.id}.md`);

    // Deletion keys belong to the focused sidebar row, never the document editor.
    const editor = () => page.getByRole('textbox', { name: 'Page Markdown', exact: true });
    await editor().press('ControlOrMeta+End'); await editor().press('Delete');
    await fs.access(path.join(folder, repo.workspace.paths[note.id]));
    await editor().press('Enter'); await page.keyboard.insertText('Fresh detail before autosave');
    await row(note.id).focus(); await row(note.id).press('Delete');
    let notice = page.locator('.b-deletion-notice'); await notice.filter({ hasText: 'Deleted Context note.' }).waitFor();
    repo = await WorkspaceRepository.open(folder);
    assert.equal(repo.workspace.records[note.id], undefined);
    assert.match(markdown.parse(await fs.readFile(path.join(folder, trashPath(repo.lastDeletion.token)), 'utf8')).body, /Fresh detail before autosave/);
    await page.locator('main').getByRole('heading', { name: 'Context child', exact: true }).waitFor();
    await page.keyboard.press('ControlOrMeta+z');
    await editor().waitFor(); assert.match(await editor().innerText(), /Fresh detail before autosave/);
    assert.equal(await row(note.id).getAttribute('data-sidebar-selected'), '');

    // Visible-row navigation expands/collapses without changing the open document.
    await folderRow('notes/Context child').focus(); await page.keyboard.press('ArrowLeft');
    await row(note.id).waitFor({ state: 'hidden' });
    await page.keyboard.press('ArrowRight'); await row(note.id).waitFor();
    await page.keyboard.press('ArrowRight');
    assert.equal(await row(note.id).evaluate(element => document.activeElement === element), true);
    await page.keyboard.press('ArrowLeft');
    assert.equal(await folderRow('notes/Context child').evaluate(element => document.activeElement === element), true);

    // Opening/canceling menus preserves focus; Delete is also available through the menu.
    await row(note.id).focus(); await row(note.id).press('Shift+F10'); await page.keyboard.press('Escape');
    assert.equal(await row(note.id).evaluate(element => document.activeElement === element), true);
    await row(note.id).click({ button: 'right' });
    await menu('File actions').getByRole('menuitem', { name: 'Move to…', exact: true }).click();
    await page.getByRole('dialog', { name: 'Move page', exact: true }).waitFor(); await page.keyboard.press('Escape');
    await row(note.id).press('Shift+F10'); await page.keyboard.press('End'); await page.keyboard.press('Enter');
    await notice.filter({ hasText: 'Deleted Context note.' }).waitFor();
    repo = await WorkspaceRepository.open(folder); assert.equal(repo.workspace.records[note.id], undefined);

    // Database creation inherits the parent database instead of making an ordinary note.
    await folderRow('projects').click({ button: 'right' });
    await menu('Folder actions').getByRole('menuitem', { name: 'New file…', exact: true }).click();
    assert.equal(await page.getByRole('combobox', { name: 'Database', exact: true }).inputValue(), 'db-projects');
    assert.equal(await page.getByRole('combobox', { name: 'Folder', exact: true }).inputValue(), 'projects');
    const project = await create('Context project');
    await row(project.id).click({ button: 'right' });
    await menu('File actions').getByRole('menuitem', { name: 'Delete', exact: true }).click();
    await notice.filter({ hasText: 'Deleted Context project.' }).waitFor();
    const home = row('example-workspace'); await home.focus(); await home.press('Delete');
    await fs.access(path.join(folder, 'workspace.md'));
    await home.click({ button: 'right' });
    assert.equal(await menu('File actions').getByRole('menuitem', { name: 'Delete', exact: true }).isDisabled(), true);
    await page.locator('main').click(); await menu('File actions').waitFor({ state: 'hidden' });

    // Trash survives restarts and can be restored through the workspace menu or palette.
    await app.close(); app = null;
    launched = await launch(null, userData); app = launched.app; page = launched.page; listen();
    notice = page.locator('.b-deletion-notice');
    await saved();
    await page.locator('.b-workspace-menu>summary').click();
    await page.getByRole('button', { name: 'Restore last deleted file', exact: true }).click();
    await page.getByRole('textbox', { name: 'Project Markdown', exact: true }).waitFor();
    repo = await WorkspaceRepository.open(folder); assert.equal(repo.workspace.records[project.id].database, 'db-projects');
    await page.keyboard.press('ControlOrMeta+Shift+p');
    const search = page.getByRole('combobox', { name: 'Search pages and commands', exact: true });
    await search.fill('> Restore last deleted file'); await search.press('Enter');
    await editor().waitFor(); assert.match(await editor().innerText(), /Fresh detail before autosave/);

    // Deleting a todo while its source is open leaves the authored checkbox intact.
    await row('meeting-coordination').click();
    const sourceBefore = await fs.readFile(path.join(folder, 'meetings/meeting-coordination.md'), 'utf8');
    await row('todo-review-comments').focus(); await row('todo-review-comments').press('Backspace');
    await notice.filter({ hasText: 'Deleted Review drainage comments.' }).waitFor();
    assert.equal(await fs.readFile(path.join(folder, 'meetings/meeting-coordination.md'), 'utf8'), sourceBefore);
    assert.match(await editor().innerText(), /Review drainage comments/);
    await notice.getByRole('button', { name: 'Undo', exact: true }).click();
    await page.getByRole('textbox', { name: 'Todo Markdown', exact: true }).waitFor();
    assert.equal((await WorkspaceRepository.open(folder)).readOnly, false);

    await page.setViewportSize({ width: 600, height: 500 });
    await folderRow('notes').click({ button: 'right' });
    await page.waitForTimeout(150);
    const bounds = await menu('Folder actions').boundingBox();
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 601 && bounds.y + bounds.height <= 501);
    await fs.mkdir(path.join(root, 'work/qa'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'work/qa/sidebar-context-menu.png') });
    assert.equal(await menu('Folder actions').isVisible(), true);
    await tree().evaluate(tree => { tree.scrollTop = tree.scrollTop > 0 ? 0 : tree.scrollHeight; });
    await menu('Folder actions').waitFor({ state: 'hidden' });
    await folderRow('notes').click({ button: 'right' }); await menu('Folder actions').waitFor();
    await page.setViewportSize({ width: 800, height: 600 }); await menu('Folder actions').waitFor({ state: 'hidden' });
    assert.deepEqual(errors, []);
    console.log('Passed folder/file context menus, exact-parent creation, database inheritance, keyboard row navigation, editor-safe Delete/Backspace, flushed drafts, recoverable deletion, focus, protected home, restart restoration, linked todo safety and viewport placement.');
  } finally { await stop(app); }
}
