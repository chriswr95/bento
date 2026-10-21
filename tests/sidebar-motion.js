import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { checkDisclosureMotion } from '../prototype/tests/disclosure-motion.js';

export async function checkSidebarMotion({ launch, stop, temporary, root }) {
  const folder = path.join(temporary, 'Animated folders');
  await fs.cp(path.join(root, 'examples/document-databases'), folder, { recursive: true });
  const { app, page } = await launch(folder, path.join(temporary, 'MotionUser'));
  try {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('#b-save-state').filter({ hasText: /^Saved$/ }).waitFor();
    const projects = page.locator('details[data-directory="projects"]');
    await checkDisclosureMotion(projects, true);
    await checkDisclosureMotion(page.locator('details[data-directory=""]'));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('details[data-directory=""]').evaluate(element => { element.open = true; element.getBoundingClientRect(); });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await projects.locator(':scope>summary [data-open-folder]').focus();
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.openFolder), 'todos', 'Closing children must leave keyboard navigation immediately');
    await projects.locator(':scope>summary [data-open-folder]').focus(); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => !!document.activeElement.closest('details:not([open]) > :not(summary)')), false, 'Tab must skip closing content');
    await projects.locator(':scope>summary').click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reduced = await projects.evaluate(element => {
      element.open = false; element.getBoundingClientRect(); const closed = element.getBoundingClientRect().height;
      element.open = true; element.getBoundingClientRect();
      return { closed, open: element.getBoundingClientRect().height, duration: getComputedStyle(element, '::details-content').transitionDuration };
    });
    assert.ok(reduced.open > reduced.closed); assert.equal(reduced.duration, '0s');
    await page.locator('aside [data-record="project-creekside"]').click();
    await page.getByRole('textbox', { name: 'Project Markdown', exact: true }).waitFor();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await checkDisclosureMotion(page.locator('[data-properties-disclosure]'));
    await page.locator('[data-properties-disclosure]>summary').click();
    await page.locator('[data-properties-disclosure]').evaluate(element => { element.getBoundingClientRect(); element.getAnimations({ subtree: true }).forEach(animation => animation.finish()); });
    await checkDisclosureMotion(page.locator('[data-more-properties]'));
    console.log('Passed folder height/fade, moving sibling rows, workspace disclosure, rapid reversal, keyboard navigation, properties, and reduced motion.');
  } finally { await stop(app); }
}
