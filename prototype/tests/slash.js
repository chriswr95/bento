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
    await menu.getByRole('option', { name: /^Page/ }).waitFor(); await editor.press('Enter');
    await page.getByRole('textbox', { name: 'Document title', exact: true }).fill('Linked child');
    await page.getByRole('button', { name: 'Create page', exact: true }).click();
    await page.getByRole('navigation', { name: 'Page parents', exact: true }).getByRole('button', { name: 'Weekly coordination', exact: true }).click();
    const link = editor.getByRole('link', { name: 'Linked child', exact: true }); await link.waitFor();
    assert.equal(await link.count(), 1); assert.equal(await page.getByRole('region', { name: 'Subpages', exact: true }).count(), 0);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('bento.prototype.workspace.v4')));
    const child = Object.values(stored.workspace.records).find(record => record.title === 'Linked child');
    assert.equal(child.parent, 'coordination'); assert.ok(stored.workspace.records.coordination.body.includes(`](${child.id}.md)`));
    assert.doesNotMatch(stored.workspace.records.coordination.body, /\/page|\/heading 2|\/todo/);
    // Removing a child link cannot silently orphan its page: it is rendered again.
    await editor.press('ControlOrMeta+a'); await page.keyboard.insertText('Replaced parent text');
    await link.waitFor(); assert.equal(await link.count(), 1);
    await editor.press('ControlOrMeta+End'); await editor.press('Enter'); await editor.pressSequentially('/not-a-command');
    await menu.getByText('No matching commands', { exact: true }).waitFor(); await editor.press('Escape');
    assert.equal(await menu.isVisible(), false); assert.match(await editor.innerText(), /\/not-a-command/);
    await editor.press('ControlOrMeta+End'); await editor.press('Enter'); await editor.pressSequentially('/page'); await editor.press('Enter');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    const cancelled = await page.evaluate(() => JSON.parse(localStorage.getItem('bento.prototype.workspace.v4')));
    assert.equal(Object.values(cancelled.workspace.records).filter(record => record.parent === 'coordination').length, 1);
    console.log('Passed slash headings/todos, /page insertion, child-link restoration, cancellation, literal unknown commands and preserved hierarchy.');
  } finally { await page.close(); }
}
