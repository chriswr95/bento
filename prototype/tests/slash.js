import assert from 'node:assert/strict';

export async function checkSlash(browser, url) {
  const page = await browser.newPage(); page.setDefaultTimeout(10000);
  try {
    await page.goto(url); await page.getByRole('button', { name: 'Meeting note', exact: true }).click();
    const editor = page.getByRole('textbox', { name: 'Page Markdown', exact: true });
    const menu = page.getByRole('listbox', { name: 'Slash commands', exact: true });
    await editor.press('ControlOrMeta+End'); await editor.press('Enter'); await editor.press('Enter');
    await editor.pressSequentially('/heading 2'); await menu.getByRole('option', { name: /^Heading 2/ }).waitFor();
    await editor.press('Enter'); await editor.pressSequentially('Review notes');
    await editor.getByRole('heading', { name: 'Review notes', exact: true }).waitFor();
    await editor.press('Enter'); await editor.pressSequentially('/todo'); await editor.press('Enter'); await editor.pressSequentially('Slash action');
    await editor.getByRole('checkbox', { name: 'Complete Slash action', exact: true }).waitFor();
    await editor.press('Enter'); await editor.press('Enter'); await editor.pressSequentially('/page');
    await menu.getByRole('option', { name: /^New page in / }).first().waitFor();
    assert.equal(await menu.getByRole('option', { name: /^New subpage/ }).count(), 0);
    await editor.press('Escape'); assert.match(await editor.innerText(), /\/page/);
    assert.equal(await page.getByRole('textbox', { name: 'Document title', exact: true }).count(), 0);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('bento.prototype.workspace.v4')));
    assert.doesNotMatch(stored.workspace.records.coordination.body, /\/heading 2|\/todo/);
    await editor.press('ControlOrMeta+End'); await editor.press('Enter'); await editor.pressSequentially('/not-a-command');
    await menu.getByText('No matching commands', { exact: true }).waitFor(); await editor.press('Escape');
    assert.equal(await menu.isVisible(), false); assert.match(await editor.innerText(), /\/not-a-command/);
    console.log('Passed slash headings/todos, database creation choices, absent subpages, and literal unknown/cancelled commands.');
  } finally { await page.close(); }
}
