import assert from 'node:assert/strict';
import path from 'node:path';
export async function checkColors(browser, url, screenshots) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
  await page.goto(url);
  await page.evaluate(async () => {
    const [{ default: InlineProperties }, { default: model }, themes, colors] = await Promise.all([import('./inline-properties.js'), import('./workspace.js'), import('./themes.js'), import('./colors.js')]);
    const main = document.querySelector('main'); main.innerHTML = '<h1>Project colors</h1><section id="color-properties"></section>';
    let workspace = model.createWorkspace();
    workspace = model.updateDocument(workspace, 'creek', { tags: ['Follow up', 'Civil engineering'] });
    workspace = model.updateDocument(workspace, 'elm', { tags: ['Follow up'] });
    const fixture = window.colorFixture = { id: 'creek', get workspace() { return workspace; }, themes, colors };
    fixture.editor = new InlineProperties(document.querySelector('#color-properties'), {
      record: () => workspace.records[fixture.id], workspace: () => workspace,
      change(patch) { workspace = model.updateDocument(workspace, fixture.id, patch); },
      tagColor(tag, color) { workspace = model.updateTagColor(workspace, tag, color); }
    });
  });
  const edit = async name => {
    const button = page.getByRole('button', { name: `Edit ${name}`, exact: true });
    if (!await button.isVisible()) await page.locator('[data-more-properties]>summary').click();
    await button.click();
  };
  await edit('Color');
  assert.equal(await page.locator('[data-pick-document-color]:not(.b-color-auto)').count(), 8);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.colorFixture.workspace.records.creek.color), undefined);
  await edit('Color');
  await page.getByRole('group', { name: 'Color', exact: true }).getByRole('button', { name: 'Purple', exact: true }).click();
  assert.equal(await page.evaluate(() => window.colorFixture.workspace.records.creek.color), 'purple');
  await edit('Tags'); const input = page.getByRole('textbox', { name: 'Tags', exact: true });
  await input.fill('Unfinished tag');
  await page.getByRole('button', { name: 'Color tag Follow up', exact: true }).click();
  await page.getByRole('group', { name: 'Tag color', exact: true }).getByRole('button', { name: 'Pink', exact: true }).click();
  assert.equal(await input.inputValue(), 'Unfinished tag'); await input.press('Escape');
  assert.equal(await page.getByRole('button', { name: 'Edit Tags', exact: true }).locator('[data-color="pink"]').count(), 1);
  await page.evaluate(() => { const f = window.colorFixture; f.id = 'elm'; f.editor.render(); });
  assert.equal(await page.getByRole('button', { name: 'Edit Tags', exact: true }).locator('[data-color="pink"]').count(), 1);
  const checks = await page.evaluate(() => {
    const f = window.colorFixture, root = document.querySelector('#bento-workflow');
    const results = [];
    for (const theme of f.themes.builtinThemes) for (const dark of [false, true]) {
      root.dataset.theme = dark ? 'dark' : 'light';
      f.themes.applyColorTheme(root, { colorTheme: theme.id, themes: [] }, dark);
      const chip = document.querySelector('[data-edit-property="$tags"] [data-color="pink"]'), style = getComputedStyle(chip);
      const hex = rgb => '#' + rgb.match(/\d+/g).slice(0, 3).map(value => Number(value).toString(16).padStart(2, '0')).join('');
      results.push({ theme: theme.id, dark, contrast: f.colors.contrastRatio(hex(style.color), hex(style.backgroundColor)) });
    }
    return results;
  });
  for (const check of checks) assert.ok(check.contrast >= 4.5, JSON.stringify(check));
  assert.equal(await page.evaluate(() => window.colorFixture.workspace.tagColors['Follow up']), 'pink');
  await page.locator('#bento-workflow').screenshot({ path: path.join(screenshots, 'project-tag-colors.png') });
  await edit('Tags'); await page.getByRole('button', { name: 'Color tag Follow up', exact: true }).click();
  await page.getByRole('group', { name: 'Tag color', exact: true }).getByRole('button', { name: 'Automatic', exact: true }).click();
  assert.equal(await page.evaluate(() => Object.hasOwn(window.colorFixture.workspace.tagColors, 'Follow up')), false);
  await input.press('Escape');
  await edit('Color');
  await page.locator('#bento-workflow').screenshot({ path: path.join(screenshots, 'color-picker.png') });
  await page.keyboard.press('Escape');
  await page.close();
  console.log('Passed eight-color pickers, Escape cancellation, stable document assignments, shared tag colors, pending tag preservation, reset, and rendered chip contrast across themes.');
}
