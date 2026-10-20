import assert from 'node:assert/strict';

const settled = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const body = '# Menu stability\n\n' + Array.from({ length: 24 }, (_, index) => `Supporting notes ${index + 1}.`).join('\n\n') + '\n\nEnd of notes.\n';
async function reset(editor) {
  await editor.press('ControlOrMeta+a');
  await editor.evaluate((element, text) => {
    const clipboardData = new DataTransfer(); clipboardData.setData('text/plain', text);
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
  }, body);
  await editor.press('ControlOrMeta+End'); await editor.press('Enter');
}
async function visibleMenu(page, menu) {
  await settled(page);
  assert.equal(await menu.isVisible(), true, 'Caret auto-scroll must not dismiss the inline menu');
  assert.equal(await menu.evaluate(element => {
    const box = element.getBoundingClientRect();
    return box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth;
  }), true, 'Menu must remain within the viewport');
}
export async function exerciseInlineMenuScroll(page) {
  const editor = page.getByRole('textbox', { name: 'Page Markdown', exact: true });
  const slash = page.getByRole('listbox', { name: 'Slash commands', exact: true });
  const links = page.getByRole('listbox', { name: 'Link a page', exact: true });
  for (const height of [500, 600, 720]) {
    await page.setViewportSize({ width: 1000, height });
    await reset(editor);
    await editor.pressSequentially('/heading 2'); await visibleMenu(page, slash);
    await editor.press('Enter'); await editor.pressSequentially('Review notes');
    await editor.getByRole('heading', { name: 'Review notes', exact: true }).waitFor();
    await editor.evaluate(() => { const caret = getSelection().getRangeAt(0).getBoundingClientRect(); scrollBy(0, caret.bottom - innerHeight + 2); });
    await settled(page);
    const before = await page.evaluate(() => scrollY);
    await editor.press('Enter'); await editor.pressSequentially('/todo'); await visibleMenu(page, slash);
    assert.ok(await page.evaluate(() => scrollY) > before, 'The editor must actually scroll during this regression');
    await editor.press('Enter'); await editor.pressSequentially(`Scroll action ${height}`);
    await editor.getByRole('checkbox', { name: `Complete Scroll action ${height}`, exact: true }).waitFor();
    await editor.press('Enter'); await editor.press('Enter'); await editor.pressSequentially('/'); await visibleMenu(page, slash);
    await editor.press('ArrowUp');
    const selected = await editor.getAttribute('aria-activedescendant');
    await visibleMenu(page, slash);
    assert.equal(await editor.getAttribute('aria-activedescendant'), selected, 'Menu scrolling must retain the keyboard selection');
    assert.ok(await slash.evaluate(element => element.scrollTop) > 0, 'Options must really scroll');
    await editor.press('Escape'); assert.equal(await slash.isVisible(), false);
    assert.equal(await editor.getAttribute('aria-activedescendant'), null);
    await editor.press('Enter'); await editor.pressSequentially('/quote'); await visibleMenu(page, slash);
    const scroll = await page.evaluate(() => scrollY);
    await page.evaluate(() => scrollBy(0, -80)); await settled(page);
    assert.ok(await page.evaluate(() => scrollY) < scroll);
    assert.equal(await slash.isVisible(), false, 'Scrolling away from the caret must still dismiss the menu');
    assert.match(await editor.innerText(), /\/quote/);
    await reset(editor);
    await editor.pressSequentially('[[Creekside'); await visibleMenu(page, links);
    await links.getByRole('option', { name: /^Creekside improvements/ }).waitFor();
    await editor.press('Enter');
    await editor.getByRole('link', { name: 'Creekside improvements', exact: true }).waitFor();
    await editor.press('Enter'); await editor.pressSequentially('/heading'); await visibleMenu(page, slash);
    await page.setViewportSize({ width: 980, height }); await settled(page);
    assert.equal(await slash.isVisible(), false, 'Resizing must still dismiss the menu');
    assert.equal(await editor.getAttribute('aria-controls'), null);
  }
}
export async function checkInlineMenuScroll(browser, url) {
  const page = await browser.newPage(); page.setDefaultTimeout(10000);
  try {
    await page.goto(url); await page.getByRole('button', { name: 'Meeting note', exact: true }).click();
    await exerciseInlineMenuScroll(page);
    console.log('Passed inline-menu auto-scroll at 500/600/720px, slash execution, wiki links, option scrolling/selection, Escape, real scroll dismissal and resize cleanup.');
  } finally { await page.close(); }
}
