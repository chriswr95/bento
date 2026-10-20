import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { WorkspaceRepository } from '../files/repository.js';

export async function checkPageWorkflow({ launch, stop, temporary, root }) {
  const folder = path.join(temporary, 'Page workspace'), userData = path.join(temporary, 'PageUserData');
  await fs.cp(path.join(root, 'examples/document-databases'), folder, { recursive: true });
  let launched = await launch(folder, userData), app = launched.app, page = launched.page;
  const saved = () => page.locator('#b-save-state').filter({ hasText: /^Saved$/ }).waitFor();
  const createChild = async title => {
    await page.locator('summary[aria-label="Document actions"]').click();
    await page.getByRole('button', { name: 'New subpage', exact: true }).click();
    await page.getByRole('textbox', { name: 'Document title', exact: true }).fill(title);
    await page.getByRole('button', { name: 'Create page', exact: true }).click(); await saved();
  };
  try {
    await page.locator('aside').getByRole('button', { name: 'Creekside improvements', exact: true }).click();
    await createChild('Drainage calculations');
    const parentEditor = page.getByRole('textbox', { name: 'Page Markdown', exact: true });
    await parentEditor.press('ControlOrMeta+End'); await parentEditor.press('Enter'); await parentEditor.pressSequentially('/');
    await page.getByRole('listbox', { name: 'Slash commands', exact: true }).waitFor();
    await page.locator('#bento-workflow').screenshot({ path: path.join(root, 'work/qa/slash-commands.png') });
    await parentEditor.pressSequentially('page');
    await page.getByRole('listbox', { name: 'Slash commands', exact: true }).getByRole('option', { name: /^Page/ }).waitFor();
    await parentEditor.press('Enter');
    await page.getByRole('textbox', { name: 'Document title', exact: true }).fill('Assumptions');
    await page.getByRole('button', { name: 'Create page', exact: true }).click(); await saved();
    const repo = await WorkspaceRepository.open(folder);
    const child = Object.values(repo.workspace.records).find(doc => doc.title === 'Drainage calculations');
    const grandchild = Object.values(repo.workspace.records).find(doc => doc.title === 'Assumptions');
    assert.equal(child.parent, 'project-creekside'); assert.equal(grandchild.parent, child.id);
    assert.equal(child.database, undefined); assert.equal(grandchild.database, undefined);
    assert.ok(repo.workspace.records[child.id].body.includes(`](${grandchild.id}.md)`));
    assert.doesNotMatch(repo.workspace.records[child.id].body, /\/page/);
    assert.equal(await page.getByRole('navigation', { name: 'Workspace pages', exact: true }).getByRole('button', { name: 'Assumptions', exact: true }).count(), 1);
    await page.getByRole('button', { name: 'Edit Parent', exact: true }).click();
    assert.equal(await page.getByRole('group', { name: 'Parent', exact: true }).getByRole('radio', { name: /Assumptions/ }).count(), 0);
    await page.keyboard.press('Escape');
    const editor = page.getByRole('textbox', { name: 'Page Markdown', exact: true });
    await editor.press('ControlOrMeta+End'); await editor.press('Enter'); await editor.pressSequentially('See [[Drainage');
    await page.getByRole('listbox', { name: 'Link a page', exact: true }).getByRole('option', { name: /^Drainage calculations/ }).waitFor();
    await editor.press('Enter'); await saved();
    const source = await fs.readFile(path.join(folder, `${grandchild.id}.md`), 'utf8');
    assert.ok(source.includes(`[Drainage calculations](${child.id}.md)`));
    await editor.getByRole('link', { name: 'Drainage calculations', exact: true }).click();
    await page.locator('.b-backlinks>summary').click();
    await page.locator('.b-backlinks').getByRole('button', { name: 'Assumptions', exact: true }).waitFor();
    await page.locator('#bento-workflow').screenshot({ path: path.join(root, 'work/qa/subpages-backlinks.png') });
    await page.getByRole('button', { name: 'Edit Parent', exact: true }).click();
    const choices = page.getByRole('group', { name: 'Parent', exact: true });
    assert.equal(await choices.getByRole('radio', { name: /Assumptions/ }).count(), 0, 'Descendants cannot be parents');
    await choices.getByRole('radio', { name: 'Not set', exact: true }).click(); await saved();
    const reloaded = await WorkspaceRepository.open(folder);
    assert.equal(reloaded.workspace.records[child.id].parent, null);
    assert.equal(reloaded.workspace.paths[child.id], `${child.id}.md`);
    assert.equal(reloaded.workspace.records[grandchild.id].parent, child.id);
    await app.close(); app = null;
    launched = await launch(null, userData); app = launched.app; page = launched.page;
    await page.getByRole('textbox', { name: 'Page Markdown', exact: true }).waitFor();
    await page.getByRole('navigation', { name: 'Workspace pages', exact: true }).waitFor();
    await page.getByRole('article', { name: 'Editable Markdown document', exact: true }).getByRole('link', { name: 'Assumptions', exact: true }).click();
    assert.equal(await page.getByRole('textbox', { name: 'Page Markdown', exact: true }).getByRole('link', { name: 'Drainage calculations', exact: true }).count(), 1);
    await page.getByRole('button', { name: 'Files', exact: true }).click();
    await page.getByRole('navigation', { name: 'Workspace files', exact: true }).waitFor();
    console.log('Passed native nested page creation, page/file trees, parent editing, cycle-choice exclusion, portable links, backlinks and restart persistence.');
  } finally { await stop(app); }
}
