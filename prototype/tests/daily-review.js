import assert from 'node:assert/strict';
import path from 'node:path';

export async function checkDailyReview(browser, url, screenshots) {
  const page = await browser.newPage({ viewport: { width: 1160, height: 1000 }, reducedMotion: 'reduce' }); page.setDefaultTimeout(10000);
  const title = 'Send meeting follow-up';
  const row = () => page.locator('main .b-task').filter({ has: page.locator('.b-task-title').filter({ hasText: title }) });
  const dateButton = () => row().getByRole('button', { name: /^Due date for/ });
  const picker = () => page.getByRole('dialog', { name: 'Reschedule todo', exact: true });
  const filters = () => page.getByRole('group', { name: 'Focus my work', exact: true });
  const filter = name => filters().getByRole('button', { name: new RegExp('^' + name + ' ') });
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('bento.prototype.workspace.v4')));
  const due = async () => {
    const records = Object.values((await stored()).workspace.records), task = records.find(record => record.title === title);
    assert.ok(task, JSON.stringify(records.map(record => record.title)));
    return task.properties['field-task-due'];
  };
  try {
    await page.goto(url); await page.getByRole('button', { name: 'Meeting note', exact: true }).click();
    const editor = page.getByRole('textbox', { name: 'Page Markdown', exact: true });
    await editor.press('ControlOrMeta+End'); await editor.press('Enter'); await editor.press('Enter'); await editor.pressSequentially('[] ' + title);
    await page.getByRole('button', { name: 'Daily overview', exact: true }).click();
    await page.getByRole('region', { name: 'My work', exact: true }).waitFor();
    const card = page.getByRole('region', { name: 'Project summary: Creekside improvements', exact: true });
    await card.getByRole('button', { name: 'Weekly coordination', exact: true }).waitFor();
    await card.getByLabel('Project status: Active', { exact: true }).waitFor();
    const before = await stored();
    await filter('Without a date').click();
    assert.equal(await filter('Without a date').getAttribute('aria-pressed'), 'true');
    assert.equal(await filter('Without a date').evaluate(button => button === document.activeElement), true);
    assert.equal(await page.getByRole('region', { name: 'Upcoming', exact: true }).count(), 0);
    assert.equal(await card.isVisible(), true, 'Project summaries remain available while filtering work');
    assert.deepEqual(await stored(), before, 'Focus filters do not write workspace data');
    await row().getByRole('button', { name: 'Creekside improvements', exact: true }).click();
    await page.getByRole('heading', { name: 'Creekside improvements', exact: true }).waitFor();
    await page.getByRole('button', { name: 'All projects', exact: true }).click();
    assert.equal(await filter('All work').getAttribute('aria-pressed'), 'true');
    await filter('Without a date').focus(); await page.keyboard.press('Enter');
    await dateButton().click();
    await picker().getByLabel('Due date', { exact: true }).fill('2026-10-20');
    await page.keyboard.press('Escape'); assert.deepEqual((await stored()).workspace, before.workspace);
    assert.equal(await dateButton().evaluate(button => document.activeElement === button), true);
    await dateButton().click(); await picker().getByRole('button', { name: 'Today', exact: true }).click();
    assert.equal(await due(), '2026-10-19');
    assert.equal(await row().count(), 0, 'Rescheduled work leaves the focused group');
    assert.equal(await filter('Without a date').evaluate(button => button === document.activeElement), true);
    await filter('All work').click();
    assert.equal(await page.getByRole('region', { name: 'Today', exact: true }).getByRole('button', { name: title, exact: true }).count(), 1);
    await dateButton().focus();
    await dateButton().click(); await picker().getByRole('button', { name: 'Tomorrow', exact: true }).click();
    assert.equal(await due(), '2026-10-20');
    assert.equal(await page.getByRole('region', { name: 'Upcoming', exact: true }).getByRole('button', { name: title, exact: true }).count(), 1);
    await page.getByRole('button', { name: 'Undo last change', exact: true }).click(); assert.equal(await due(), '2026-10-19');
    await dateButton().click(); await picker().getByRole('button', { name: 'No date', exact: true }).click();
    assert.equal(await due(), null);
    assert.equal(await page.getByRole('region', { name: 'Without a date', exact: true }).getByRole('button', { name: title, exact: true }).count(), 1);
    await dateButton().click(); await picker().getByLabel('Due date', { exact: true }).fill('2026-10-18');
    await picker().getByRole('button', { name: 'Set date', exact: true }).click();
    assert.equal(await due(), '2026-10-18');
    assert.equal(await page.getByRole('region', { name: 'Overdue', exact: true }).getByRole('button', { name: title, exact: true }).count(), 1);
    // Setting an unchanged date must not consume the existing Undo snapshot.
    const undoBefore = await stored(); await dateButton().click(); await picker().getByRole('button', { name: 'Set date', exact: true }).click();
    assert.deepEqual(await stored(), undoBefore);
    await dateButton().click(); await page.keyboard.press('ControlOrMeta+,'); assert.equal(await picker().isVisible(), true);
    await picker().getByRole('button', { name: 'Cancel', exact: true }).click();
    await row().getByRole('button', { name: /Weekly coordination/ }).click(); await editor.waitFor();
    await page.keyboard.press('ControlOrMeta+['); await row().waitFor();
    await page.reload(); assert.equal(await due(), '2026-10-18');
    await page.getByRole('region', { name: 'My work', exact: true }).waitFor();
    await page.locator('#bento-workflow').screenshot({ path: path.join(screenshots, 'daily-review.png') });
    for (const width of [380, 736, 1160]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Daily review overflow at ' + width);
      await dateButton().click();
      assert.equal(await picker().evaluate(dialog => { const rect = dialog.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth; }), true);
      await page.keyboard.press('Escape');
    }
    await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('bento.prototype.workspace.v4'));
      saved.workspace.databases['db-todos'].fields.find(field => field.id === 'field-task-due').required = true;
      for (const task of Object.values(saved.workspace.records).filter(record => record.database === 'db-todos')) task.properties['field-task-due'] ||= '2026-10-19';
      localStorage.setItem('bento.prototype.workspace.v4', JSON.stringify(saved));
    });
    await page.reload(); await dateButton().click(); await picker().getByRole('button', { name: 'No date', exact: true }).click();
    await picker().getByRole('alert').filter({ hasText: /required/ }).waitFor();
    assert.equal(await due(), '2026-10-18');
    await picker().getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.evaluate(title => {
      const saved = JSON.parse(localStorage.getItem('bento.prototype.workspace.v4'));
      saved.workspace.readOnlyRecords = [Object.values(saved.workspace.records).find(record => record.title === title).id];
      localStorage.setItem('bento.prototype.workspace.v4', JSON.stringify(saved));
    }, title);
    await page.reload(); assert.equal(await dateButton().isDisabled(), true);
    await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('bento.prototype.workspace.v4')); delete saved.workspace.readOnlyRecords;
      localStorage.setItem('bento.prototype.workspace.v4', JSON.stringify(saved));
    });
    await page.reload(); await filter('Today').click();
    const today = page.getByRole('region', { name: 'Today', exact: true });
    const todayIds = await today.locator('[data-task]').evaluateAll(inputs => inputs.map(input => input.dataset.task)); assert.ok(todayIds.length > 0);
    for (const id of todayIds) await today.locator(`[data-task="${id}"]`).click();
    await today.getByRole('status').filter({ hasText: 'Nothing due today.' }).waitFor();
    assert.equal(await filter('Today').evaluate(button => document.activeElement === button), true);
    assert.match(await filter('Today').innerText(), /0$/);
    await page.getByRole('button', { name: 'Undo last change', exact: true }).click();
    assert.equal(await today.getByRole('checkbox').count(), 1);
    await filter('All work').click();
    await page.setViewportSize({ width: 1160, height: 900 });
    await page.locator('#bento-workflow').screenshot({ path: path.join(screenshots, 'daily-review-polished.png') });
    console.log('Passed daily-review grouping, project note links, Today/Tomorrow/custom/clear dates, cancel/focus, Undo/no-op, source navigation, reload, modal shortcuts, required/read-only dates and responsive layouts.');
  } finally { await page.close(); }
}
