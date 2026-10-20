import assert from 'node:assert/strict';

export async function checkPages(browser, url) {
  const page = await browser.newPage(); page.setDefaultTimeout(10000);
  try {
    await page.goto(url); await page.getByRole('button', { name: 'Meeting note', exact: true }).click();
    await page.locator('summary[aria-label="Document actions"]').click();
    await page.getByRole('button', { name: 'New subpage', exact: true }).click();
    await page.getByRole('textbox', { name: 'Document title', exact: true }).fill('Drainage calculations');
    await page.getByRole('button', { name: 'Create page', exact: true }).click();
    const editor = page.getByRole('textbox', { name: 'Page Markdown', exact: true });
    await editor.locator('h1').filter({ hasText: 'Drainage calculations' }).waitFor();
    await page.getByRole('navigation', { name: 'Page parents', exact: true }).getByRole('button', { name: 'Weekly coordination', exact: true }).click();
    await editor.getByRole('link', { name: 'Drainage calculations', exact: true }).click();
    await editor.press('ControlOrMeta+End'); await editor.press('Enter'); await editor.pressSequentially('See [[Weekly');
    const picker = page.getByRole('listbox', { name: 'Link a page', exact: true });
    await picker.getByRole('option').filter({ hasText: 'Weekly coordination' }).waitFor();
    await editor.press('Enter');
    const link = editor.getByRole('link', { name: 'Weekly coordination', exact: true }); await link.waitFor();
    const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('bento.prototype.workspace.v4')));
    const child = Object.values(snapshot.workspace.records).find(record => record.title === 'Drainage calculations');
    assert.equal(child.parent, 'coordination'); assert.equal(child.database, undefined);
    assert.match(child.body, /\[Weekly coordination\]\(coordination.md\)/); assert.doesNotMatch(child.body, /\[\[/);
    await link.click();
    await page.locator('.b-backlinks>summary').click();
    await page.locator('.b-backlinks').getByRole('button', { name: 'Drainage calculations', exact: true }).click();
    await editor.press('ControlOrMeta+End'); await editor.press('Enter'); await editor.pressSequentially('[[No such page');
    await picker.getByText('No matching pages', { exact: true }).waitFor();
    await editor.press('Escape'); assert.equal(await picker.isVisible(), false);
    assert.match(await editor.innerText(), /\[\[No such page/);
    await page.getByRole('button', { name: 'Edit Parent', exact: true }).click();
    await page.getByRole('group', { name: 'Parent', exact: true }).getByRole('radio', { name: 'Not set', exact: true }).click();
    const cleared = await page.evaluate(() => JSON.parse(localStorage.getItem('bento.prototype.workspace.v4')));
    assert.equal(cleared.workspace.records[child.id].parent, null);
    await page.reload(); await editor.locator('h1').filter({ hasText: 'Drainage calculations' }).waitFor();
    assert.equal(await editor.getByRole('link', { name: 'Weekly coordination', exact: true }).count(), 1);
    console.log('Passed subpage creation/navigation, [[ keyboard suggestions, portable Markdown links, backlinks, empty/cancel states and reload persistence.');
  } finally { await page.close(); }
}
