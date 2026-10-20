import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { WorkspaceRepository } from '../files/repository.js';

export async function checkPageWorkflow({ launch, stop, temporary, root }) {
  const folder = path.join(temporary, 'Page workspace'), userData = path.join(temporary, 'PageUserData');
  await fs.cp(path.join(root, 'examples/document-databases'), folder, { recursive: true });
  let launched = await launch(folder, userData), app = launched.app, page = launched.page;
  const saved = () => page.locator('#b-save-state').filter({ hasText: /^Saved$/ }).waitFor();
  const createPage = async title => {
    await page.getByRole('button', { name: 'New page', exact: true }).click();
    await page.getByRole('textbox', { name: 'Document title', exact: true }).fill(title);
    await page.getByRole('button', { name: 'Create page', exact: true }).click(); await saved();
  };
  try {
    let tree = page.getByRole('navigation', { name: 'Workspace files', exact: true });
    await tree.waitFor();
    assert.equal(await page.getByRole('group', { name: 'Sidebar view', exact: true }).count(), 0);
    assert.equal(await page.locator('aside .b-record-marker').count(), 0);
    assert.equal(await tree.locator('[data-directory="projects"]>summary').innerText(), 'Projects');
    await createPage('Drainage calculations');
    await createPage('Assumptions');
    const repo = await WorkspaceRepository.open(folder);
    const first = Object.values(repo.workspace.records).find(doc => doc.title === 'Drainage calculations');
    const second = Object.values(repo.workspace.records).find(doc => doc.title === 'Assumptions');
    for (const doc of [first, second]) {
      assert.equal(doc.parent, undefined); assert.equal(doc.database, undefined);
      const row = tree.getByRole('button', { name: doc.title, exact: true });
      assert.equal(await row.getAttribute('title'), `notes/${doc.id}.md`);
      assert.equal(await row.locator('xpath=ancestor::details').count(), 2);
    }
    assert.equal(await page.getByRole('button', { name: 'Edit Parent', exact: true }).count(), 0);
    assert.equal(await page.getByRole('navigation', { name: 'Page parents', exact: true }).count(), 0);
    await page.keyboard.press('ControlOrMeta+Shift+p');
    await page.getByRole('combobox', { name: 'Search pages and commands', exact: true }).fill('> New subpage');
    assert.equal(await page.getByRole('option').count(), 0); await page.keyboard.press('Escape');
    const editor = page.getByRole('textbox', { name: 'Page Markdown', exact: true });
    await editor.press('ControlOrMeta+End'); await editor.press('Enter'); await editor.pressSequentially('See [[Drainage');
    await page.getByRole('listbox', { name: 'Link a page', exact: true }).getByRole('option', { name: /^Drainage calculations/ }).waitFor();
    await editor.press('Enter'); await saved();
    assert.ok((await fs.readFile(path.join(folder, `notes/${second.id}.md`), 'utf8')).includes(`[Drainage calculations](${first.id}.md)`));
    await editor.getByRole('link', { name: 'Drainage calculations', exact: true }).click();
    await page.locator('.b-backlinks>summary').click();
    await page.locator('.b-backlinks').getByRole('button', { name: 'Assumptions', exact: true }).waitFor();
    await app.close(); app = null;
    launched = await launch(null, userData); app = launched.app; page = launched.page;
    tree = page.getByRole('navigation', { name: 'Workspace files', exact: true });
    await tree.getByRole('button', { name: 'Assumptions', exact: true }).click();
    assert.equal(await page.getByRole('textbox', { name: 'Page Markdown', exact: true }).getByRole('link', { name: 'Drainage calculations', exact: true }).count(), 1);
    // A large workspace scrolls within the explorer; selected pages remain visible.
    const longTitle = 'Z Review ' + 'long title '.repeat(12);
    for (let index = 0; index < 45; index++) {
      await fs.writeFile(path.join(folder, `sidebar-${index}.md`), `---\nbento_version: 1\nid: sidebar-${index}\ntitle: ${longTitle}${index}\n---\n\n# Review\n`);
    }
    await page.locator('.b-workspace-menu>summary').click();
    await page.getByRole('button', { name: 'Reload files', exact: true }).click(); await saved();
    await tree.locator('[data-record="sidebar-9"]').waitFor();
    await page.keyboard.press('ControlOrMeta+p');
    await page.getByRole('combobox', { name: 'Search pages and commands', exact: true }).fill(longTitle + '9');
    await page.keyboard.press('Enter');
    const selected = page.locator('aside [aria-current="page"]');
    await selected.filter({ hasText: longTitle + '9' }).waitFor();
    const layout = await page.locator('aside').evaluate(sidebar => {
      const tree = sidebar.querySelector('.b-directory-tree'), selected = tree.querySelector('[aria-current="page"]');
      const viewport = tree.getBoundingClientRect(), item = selected.getBoundingClientRect();
      return { scrollable: tree.scrollHeight > tree.clientHeight, noOverflow: tree.scrollWidth <= tree.clientWidth + 1, selectedVisible: item.top >= viewport.top - 1 && item.bottom <= viewport.bottom + 1, settingsVisible: sidebar.querySelector('[data-view="profile"]').getBoundingClientRect().bottom <= innerHeight };
    });
    assert.deepEqual(layout, { scrollable: true, noOverflow: true, selectedVisible: true, settingsVisible: true });
    await page.locator('#bento-workflow').screenshot({ path: path.join(root, 'work/qa/sidebar.png') });
    await page.setViewportSize({ width: 600, height: 800 });
    assert.equal(await page.locator('.b-directory-tree').evaluate(tree => tree.clientHeight <= 240 && tree.scrollWidth <= tree.clientWidth + 1), true);
    await page.setViewportSize({ width: 800, height: 500 });
    assert.equal(await page.locator('aside [data-view="profile"]').evaluate(button => button.getBoundingClientRect().bottom <= innerHeight), true);
    console.log('Passed native standalone creation, unified file tree, removed subpage controls, portable links, backlinks, restart persistence, and large/narrow/short-window layouts.');
  } finally { await stop(app); }
}
