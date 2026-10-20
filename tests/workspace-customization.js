import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { WorkspaceRepository } from '../files/repository.js';

export async function checkWorkspaceCustomization({ launch, stop, temporary, root }) {
  const folder = path.join(temporary, 'Custom workspace');
  await fs.cp(path.join(root, 'examples/document-databases'), folder, { recursive: true });
  const definition = path.join(folder, 'meetings/database.md');
  await fs.writeFile(definition, (await fs.readFile(definition, 'utf8')).replace('title: Meeting Notes', 'title: Field Notes'));
  const userData = path.join(temporary, 'CustomizationUserData');
  let launched = await launch(folder, userData), app = launched.app, page = launched.page;
  try {
    await page.locator('aside').getByRole('button', { name: 'Workspace', exact: true }).click();
    const editor = page.getByRole('textbox', { name: 'Workspace Markdown', exact: true });
    await editor.press('ControlOrMeta+End'); await editor.press('Enter');
    await editor.pressSequentially('- [ ] '); await editor.pressSequentially('Plan the week');
    await page.locator('#b-save-state').filter({ hasText: /^Saved$/ }).waitFor();
    const repo = await WorkspaceRepository.open(folder);
    assert.ok(Object.values(repo.workspace.records).some(doc => doc.title === 'Plan the week'));
    await page.getByRole('button', { name: 'Edit Page title', exact: true }).click();
    await page.getByRole('textbox', { name: 'Page title', exact: true }).fill('Makena’s desk');
    await page.getByRole('textbox', { name: 'Page title', exact: true }).press('Enter');
    await page.locator('#b-save-state').filter({ hasText: /^Saved$/ }).waitFor();
    await page.keyboard.press('ControlOrMeta+Shift+p');
    const search = page.getByRole('combobox', { name: 'Search pages and commands', exact: true });
    await search.fill('>new page in Field Notes');
    await page.getByRole('option', { name: /New page in Field Notes/ }).waitFor();
    await search.press('Escape');
    await stop(app); app = null;
    await fs.unlink(path.join(folder, 'todos/database.md'));
    launched = await launch(null, userData); app = launched.app; page = launched.page;
    await page.getByRole('textbox', { name: 'Workspace Markdown', exact: true }).waitFor();
    assert.equal(await page.locator('[data-workspace-name]').innerText(), 'Makena’s desk');
    if (await page.locator('aside details[data-directory="todos"]').getAttribute('open') === null) await page.locator('aside details[data-directory="todos"]>summary').click();
    await page.locator('aside').getByRole('button', { name: 'Plan the week', exact: true }).click();
    const protectedEditor = page.getByRole('textbox', { name: 'Page Markdown', exact: true });
    assert.equal(await protectedEditor.getAttribute('contenteditable'), 'false');
    assert.equal(await page.getByRole('button', { name: 'Edit Page title', exact: true }).isDisabled(), true);
    assert.match(await page.locator('main').innerText(), /read-only/);
    await assert.rejects(fs.access(path.join(folder, 'todos/database.md')));
    console.log('Passed editable Workspace page, checkbox capture, title persistence, renamed database commands and protected pages after database removal.');
  } finally { await stop(app); }
}
