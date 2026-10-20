import fs from 'node:fs/promises';
import path from 'node:path';
import { exerciseInlineMenuScroll } from '../prototype/tests/inline-menu-scroll.js';

export async function checkInlineMenuWorkflow({ launch, stop, temporary, root }) {
  const folder = path.join(temporary, 'Inline menus'), userData = path.join(temporary, 'InlineMenuUser');
  await fs.cp(path.join(root, 'examples/document-databases'), folder, { recursive: true });
  const { app, page } = await launch(folder, userData);
  try {
    await page.locator('aside').getByRole('button', { name: 'Weekly coordination', exact: true }).click();
    await exerciseInlineMenuScroll(page);
    await page.locator('#b-save-state').filter({ hasText: /^Saved$/ }).waitFor();
    console.log('Passed native slash/wiki menus across auto-scroll, keyboard option scrolling, cancellation, deliberate scroll and resize.');
  } finally { await stop(app); }
}
