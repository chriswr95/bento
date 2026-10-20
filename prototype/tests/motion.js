import assert from 'node:assert/strict';
import path from 'node:path';

export async function checkMotion(browser, url, screenshots) {
  const page = await browser.newPage({ reducedMotion: 'no-preference' });
  try {
    await page.goto(url);
    await page.getByRole('button', { name: 'Daily overview', exact: true }).click();
    const checkbox = page.locator('main .b-task input[data-task]:not(:checked)').first();
    const id = await checkbox.getAttribute('data-task');
    const status = () => page.evaluate(id => JSON.parse(localStorage.getItem('bento.prototype.workspace.v4')).workspace.records[id].properties['field-task-status'], id);
    const result = await checkbox.evaluate(input => {
      const row = input.closest('.b-task'); input.focus(); input.click();
      const animation = row.getAnimations()[0]; animation?.pause();
      return { checked: input.checked, dimmed: row.classList.contains('b-done'), connected: row.isConnected, duration: animation?.effect.getTiming().duration };
    });
    assert.deepEqual(result, { checked: true, dimmed: true, connected: true, duration: 300 });
    assert.equal(await status(), 'option-done', 'Persistence must precede animation completion');
    await page.locator(`main [data-task="${id}"]`).evaluate(input => { input.closest('.b-task').getAnimations()[0].currentTime = 70; });
    await page.locator('#bento-workflow').screenshot({ path: path.join(screenshots, 'motion-completion.png'), animations: 'allow' });
    await page.getByRole('button', { name: 'Undo last change', exact: true }).click();
    assert.equal(await status(), 'option-open');
    assert.equal(await page.locator(`main [data-task="${id}"]`).isChecked(), false);

    await page.locator(`main [data-task="${id}"]`).evaluate(input => {
      input.focus(); input.click(); input.closest('.b-task').getAnimations().forEach(animation => animation.finish());
    });
    await page.waitForFunction(id => !!document.querySelector(`main details [data-task="${id}"]`), id);
    assert.equal(await status(), 'option-done');
    assert.equal(await page.evaluate(() => document.activeElement.matches('[data-task], [data-undo]')), true);
    await page.getByRole('button', { name: 'Undo last change', exact: true }).click();

    // Leaving during completion must cancel its callback, preserving the new page.
    await page.locator(`main [data-task="${id}"]`).evaluate(input => { input.click(); input.closest('.b-task').getAnimations().forEach(animation => animation.pause()); });
    const entrance = await page.getByRole('button', { name: 'Meeting note', exact: true }).evaluate(button => {
      button.click(); return document.querySelector('main').getAnimations().map(animation => animation.effect.getTiming().duration);
    });
    assert.deepEqual(entrance, [220]);
    const editor = page.getByRole('textbox', { name: 'Page Markdown', exact: true });
    await editor.click();
    await page.keyboard.press('ControlOrMeta+p');
    const dialog = page.getByRole('dialog', { name: 'Quick open', exact: true });
    assert.equal(await dialog.getByRole('combobox').evaluate(input => document.activeElement === input), true);
    assert.equal(await dialog.evaluate(element => getComputedStyle(element).animationName), 'bento-palette-enter');
    await page.keyboard.press('Escape');
    assert.equal(await editor.evaluate(element => document.activeElement === element), true);

    await page.getByRole('button', { name: 'Daily overview', exact: true }).click();
    const pendingId = await page.locator('main .b-task input[data-task]:not(:checked)').first().evaluate(input => {
      input.focus(); input.click(); input.closest('.b-task').getAnimations().forEach(animation => animation.pause()); return input.dataset.task;
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(id => !!document.querySelector(`main details [data-task="${id}"]`), pendingId);
    assert.equal(await page.evaluate(() => document.activeElement.matches('[data-task], [data-undo]')), true);

    await page.getByRole('button', { name: 'Daily overview', exact: true }).click();
    const reduced = await page.locator('main .b-task input[data-task]:not(:checked)').first().evaluate(input => {
      const row = input.closest('.b-task'); input.click(); return { removed: !row.isConnected, animations: document.querySelector('main').getAnimations({ subtree: true }).length };
    });
    assert.deepEqual(reduced, { removed: true, animations: 0 });
    await page.getByRole('button', { name: 'Meeting note', exact: true }).click();
    assert.equal(await page.locator('main').evaluate(element => element.getAnimations().length), 0);
    await page.keyboard.press('ControlOrMeta+Shift+p');
    assert.equal(await dialog.evaluate(element => getComputedStyle(element).animationName), 'none');
    await page.keyboard.press('Escape');
    assert.equal(await editor.isVisible(), true);
    console.log('Passed immediate completion persistence, undo during motion, collapse/focus, navigation cancellation, immediate palette focus, keyboard dismissal and reduced-motion behavior.');
  } finally { await page.close(); }
}
