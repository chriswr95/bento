import assert from 'node:assert/strict';

export async function checkIndent(browser, url) {
  const page = await browser.newPage();
  try {
    await page.goto(url); await page.getByRole('button', { name: 'Meeting note', exact: true }).click();
    const editor = page.getByRole('textbox', { name: 'Page Markdown', exact: true });
    const paste = async text => {
      await editor.press('ControlOrMeta+a');
      await editor.evaluate((element, text) => {
        const data = new DataTransfer(); data.setData('text/plain', text);
        element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
      }, text);
    };
    const workspace = () => page.evaluate(() => JSON.parse(localStorage.getItem('bento.prototype.workspace.v4')).workspace);
    await paste('- [ ] Parent action\n- [ ] Child action\n');
    const child = Object.values((await workspace()).records).find(record => record.title === 'Child action');
    await editor.press('ControlOrMeta+End'); await editor.press('Tab');
    assert.match((await workspace()).records.coordination.body, /\n {2}- \[ \] \[Child action\]/);
    assert.equal(await editor.evaluate(element => document.activeElement === element), true);
    await editor.press('Shift+Tab'); await editor.press('Shift+Tab');
    assert.match((await workspace()).records.coordination.body, /\n- \[ \] \[Child action\]/);
    assert.equal(Object.values((await workspace()).records).filter(record => record.title === 'Child action')[0].id, child.id);
    await paste('```text\nfirst\nsecond\n```\n');
    await editor.press('ControlOrMeta+Home'); await editor.press('Tab');
    assert.equal(await editor.locator('pre').innerText(), '  first\nsecond');
    await editor.press('Shift+Tab'); assert.equal(await editor.locator('pre').innerText(), 'first\nsecond');
    await page.reload(); assert.equal(await editor.locator('pre').innerText(), 'first\nsecond');
    console.log('Passed keyboard todo nesting/outdenting with stable identities and persisted code indentation.');
  } finally { await page.close(); }
}
