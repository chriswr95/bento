import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function checkWindowChrome({ launch, stop, temporary, root }) {
  const folder = path.join(temporary, 'Header workspace');
  await fs.cp(path.join(root, 'examples/document-databases'), folder, { recursive: true });
  const { app, page } = await launch(folder, path.join(temporary, 'HeaderUser'));
  try {
    await page.locator('#b-save-state').filter({ hasText: /^Saved$/ }).waitFor();
    assert.equal(await page.evaluate(() => window.bentoDesktop.platform), process.platform);
    if (process.platform === 'darwin') {
      assert.deepEqual(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getWindowButtonPosition()), { x: 16, y: 26 });
      assert.equal(await page.locator('.b-chrome').evaluate(element => getComputedStyle(element).webkitAppRegion), 'drag');
      for (const selector of ['.b-theme-toggle', '.b-workspace-menu', '.b-file-controls']) {
        assert.equal(await page.locator(selector).evaluate(element => getComputedStyle(element).webkitAppRegion), 'no-drag');
      }
    }
    for (const width of [1160, 736, 380]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Header overflow at ' + width);
      if (process.platform === 'darwin') assert.ok(await page.locator('.b-brand').evaluate(element => element.getBoundingClientRect().left) >= 96, 'Keep traffic lights clear');
      await page.getByLabel('Workspace actions', { exact: true }).click();
      await page.getByRole('button', { name: 'Quick open…', exact: true }).click();
      await page.getByRole('combobox', { name: 'Search pages and commands', exact: true }).waitFor();
      await page.keyboard.press('Escape');
      const toggle = page.getByRole('button', { name: 'Dark mode', exact: true });
      const before = await toggle.getAttribute('aria-pressed');
      await toggle.click(); assert.notEqual(await toggle.getAttribute('aria-pressed'), before);
      await page.screenshot({ path: path.join(root, `work/qa/window-header-${width}.png`) });
    }
    console.log('Passed native header controls, drag regions, menu and theme actions, and narrow-window layout.');
  } finally { await stop(app); }
}
