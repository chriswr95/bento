import assert from 'node:assert/strict';
import path from 'node:path';
export async function checkShortcuts(browser, url, screenshots) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 900 } }); page.setDefaultTimeout(10000);
  await page.goto(url);
  await page.getByRole('button', { name: 'Meeting note', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Page Markdown', exact: true });
  assert.equal(await page.locator('#b-task-count').count(), 0);
  await editor.click(); await editor.press('ControlOrMeta+End'); await editor.press('Enter'); await editor.pressSequentially('Navigation keeps my work');
  const rememberedScroll = await page.evaluate(() => scrollY);
  const selection = await page.evaluate(() => ({ text: getSelection().anchorNode.textContent, offset: getSelection().anchorOffset }));
  await page.keyboard.press('ControlOrMeta+,');
  await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
  await page.keyboard.press('ControlOrMeta+k'); await page.keyboard.press('ControlOrMeta+s');
  const search = page.getByRole('searchbox', { name: 'Search keyboard shortcuts', exact: true });
  assert.equal(await search.evaluate(element => document.activeElement === element), true);
  await search.fill('go back'); assert.equal(await page.locator('[data-shortcut-command]').count(), 1);
  await search.fill('save'); assert.equal(await page.locator('[data-shortcut-command="save"]').count(), 1);
  await search.fill('nonexistent action'); await page.getByText('No matching shortcuts.', { exact: true }).waitFor();
  await search.fill('');
  await page.locator('#b-keyboard-shortcuts').screenshot({ path: path.join(screenshots, 'keyboard-shortcuts.png') });
  await page.keyboard.press('ControlOrMeta+[');
  await editor.waitFor(); assert.match(await editor.innerText(), /Navigation keeps my work/);
  assert.deepEqual(await page.evaluate(() => ({ text: getSelection().anchorNode.textContent, offset: getSelection().anchorOffset })), selection);
  assert.equal(await editor.evaluate(element => document.activeElement === element), true);
  assert.ok(Math.abs(await page.evaluate(() => scrollY) - rememberedScroll) <= 1);
  await page.keyboard.press('ControlOrMeta+]'); await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
  for (const width of [320, 736, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Shortcuts overflow ' + width);
  }
  await page.keyboard.press('ControlOrMeta+['); await editor.waitFor();
  await page.getByRole('button', { name: 'Daily overview', exact: true }).click();
  await page.keyboard.press('ControlOrMeta+]');
  await page.getByRole('heading', { name: /, Makena\??$/ }).waitFor();
  await page.keyboard.press('ControlOrMeta+['); await editor.waitFor();
  assert.match(await editor.innerText(), /Navigation keeps my work/);
  await page.keyboard.press('ControlOrMeta+s');
  await page.reload(); await editor.waitFor(); assert.match(await editor.innerText(), /Navigation keeps my work/);
  await page.keyboard.press('ControlOrMeta+['); await editor.waitFor();
  await page.close();
  console.log('Passed keyboard back/forward, caret restoration, forward-branch truncation, Settings/chord shortcuts, searchable reference, save, session-local history and responsive layout.');
}
