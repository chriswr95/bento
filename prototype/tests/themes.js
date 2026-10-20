import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { builtinThemes, parseTheme } from '../themes.js';
export async function checkThemes(browser, url, screenshots) {
  const page = await browser.newPage({ colorScheme: 'light', acceptDownloads: true });
  page.setDefaultTimeout(10000);
  await page.goto(url); await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const before = await page.evaluate(() => localStorage.getItem('bento.prototype.workspace.v4'));
  const pick = async id => { await page.getByRole('combobox', { name: 'Color theme', exact: true }).selectOption(id); await page.waitForFunction(value => document.querySelector('#bento-workflow').dataset.colorTheme === value, id); };
  await pick('tokyo-night');
  await page.getByRole('combobox', { name: 'Mode', exact: true }).selectOption('dark');
  await page.waitForFunction(() => document.querySelector('#bento-workflow').dataset.theme === 'dark');
  assert.equal(await page.locator('#bento-workflow').evaluate(element => getComputedStyle(element).getPropertyValue('--b-paper').trim()), '#1a1b26');
  const custom = { ...structuredClone(builtinThemes[0]), id: 'custom-smoke', name: '<img src=x> custom', dark: { ...builtinThemes[0].dark, paper: '#112233' } };
  const file = raw => ({ name: 'custom.bento-theme.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
  await page.locator('[data-theme-file]').setInputFiles(file(JSON.stringify(custom)));
  await page.waitForFunction(() => document.querySelector('#bento-workflow').dataset.colorTheme === 'custom-smoke');
  assert.equal(await page.locator('#b-theme-settings img').count(), 0);
  assert.equal(await page.locator('#bento-workflow').evaluate(element => getComputedStyle(element).getPropertyValue('--b-paper').trim()), '#112233');
  await page.locator('[data-theme-file]').setInputFiles(file('{invalid'));
  await page.locator('[data-theme-error]').filter({ hasText: 'not valid JSON' }).waitFor();
  assert.equal(await page.locator('#bento-workflow').getAttribute('data-color-theme'), 'custom-smoke');
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export template', exact: true }).click();
  const download = await downloadPromise, template = parseTheme(fs.readFileSync(await download.path(), 'utf8'));
  assert.equal(template.id, 'custom-custom-smoke'); assert.deepEqual(template.dark, custom.dark);
  assert.equal(await page.evaluate(() => localStorage.getItem('bento.prototype.workspace.v4')), before);
  await page.reload(); await page.getByRole('button', { name: 'Settings', exact: true }).click();
  assert.equal(await page.getByRole('combobox', { name: 'Color theme', exact: true }).inputValue(), 'custom-smoke');
  await page.getByRole('button', { name: 'Remove theme', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#bento-workflow').dataset.colorTheme === 'bento');
  for (const mode of ['light', 'dark']) {
    await page.getByRole('combobox', { name: 'Mode', exact: true }).selectOption(mode);
    for (const theme of builtinThemes) {
      await pick(theme.id);
      assert.equal(await page.locator('#bento-workflow').evaluate(element => getComputedStyle(element).getPropertyValue('--b-paper').trim()), theme[mode].paper);
    }
  }
  await page.locator('#bento-workflow').screenshot({ path: path.join(screenshots, 'catppuccin-settings.png') });
  for (const width of [320, 736, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Theme settings overflow ' + width);
  }
  await page.getByRole('combobox', { name: 'Mode', exact: true }).selectOption('system');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#bento-workflow')).getPropertyValue('--b-paper').trim() === '#eff1f5');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#bento-workflow')).getPropertyValue('--b-paper').trim() === '#1e1e2e');
  await page.close();
  console.log('Passed paired presets, custom theme import/validation/export/removal, restart, system mode, unchanged workspace data, and responsive theme settings.');
}
