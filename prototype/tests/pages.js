import assert from 'node:assert/strict';

export async function checkPages(browser, url) {
  const page = await browser.newPage(); page.setDefaultTimeout(10000);
  try {
    await page.goto(url); await page.getByRole('button', { name: 'Meeting note', exact: true }).click();
    await page.keyboard.press('ControlOrMeta+Shift+p');
    await page.getByRole('combobox', { name: 'Search pages and commands', exact: true }).fill('> New page');
    await page.keyboard.press('Enter');
    await page.getByRole('textbox', { name: 'Document title', exact: true }).fill('Drainage calculations');
    await page.getByRole('button', { name: 'Create page', exact: true }).click();
    const editor = page.getByRole('textbox', { name: 'Page Markdown', exact: true });
    await editor.locator('h1').filter({ hasText: 'Drainage calculations' }).waitFor();
    await editor.press('ControlOrMeta+End'); await editor.press('Enter'); await editor.pressSequentially('See [[Weekly');
    const picker = page.getByRole('listbox', { name: 'Link a page', exact: true });
    await picker.getByRole('option').filter({ hasText: 'Weekly coordination' }).waitFor();
    await editor.press('Enter');
    const link = editor.getByRole('link', { name: 'Weekly coordination', exact: true }); await link.waitFor();
    const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('bento.prototype.workspace.v4')));
    const child = Object.values(snapshot.workspace.records).find(record => record.title === 'Drainage calculations');
    assert.equal(child.parent, undefined); assert.equal(child.database, undefined);
    assert.match(child.body, /\[Weekly coordination\]\(coordination.md\)/); assert.doesNotMatch(child.body, /\[\[/);
    await link.click();
    await page.locator('.b-backlinks>summary').click();
    await page.locator('.b-backlinks').getByRole('button', { name: 'Drainage calculations', exact: true }).click();
    await editor.press('ControlOrMeta+End'); await editor.press('Enter'); await editor.pressSequentially('[[No such page');
    await picker.getByText('No matching pages', { exact: true }).waitFor();
    await editor.press('Escape'); assert.equal(await picker.isVisible(), false);
    assert.match(await editor.innerText(), /\[\[No such page/);
    assert.equal(await page.getByRole('button', { name: 'Edit Parent', exact: true }).count(), 0);
    await page.reload(); await editor.locator('h1').filter({ hasText: 'Drainage calculations' }).waitFor();
    assert.equal(await editor.getByRole('link', { name: 'Weekly coordination', exact: true }).count(), 1);
    console.log('Passed standalone page creation, [[ keyboard suggestions, portable Markdown links, backlinks, empty/cancel states and reload persistence.');
  } finally { await page.close(); }
}
