import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { WorkspaceRepository } from '../files/repository.js';
import * as markdown from '../files/markdown.js';

export async function checkFolderCardsAndDrag({ launch, stop, temporary, root }) {
  const folder = path.join(temporary, 'Cards and drag'), userData = path.join(temporary, 'CardsDragData');
  await fs.cp(path.join(root, 'examples/document-databases'), folder, { recursive: true });
  const definition = path.join(folder, 'projects/database.md');
  await fs.writeFile(definition, (await fs.readFile(definition, 'utf8')).replace('title: Projects', 'title: Client work'));
  await fs.writeFile(path.join(folder, 'projects/completed.md'), markdown.serialize({ id: 'project-completed', schema_version: 1, title: 'Creekside permit review', properties: { 'field-project-status': 'option-completed' }, tags: [], body: '# Creekside permit review\n\nPermit issued.\n' }));
  await fs.mkdir(path.join(folder, 'notes/archive'), { recursive: true });
  await fs.writeFile(path.join(folder, 'notes/source.md'), markdown.serialize({ id: 'drag-note', title: 'Drag note', properties: {}, tags: [], body: '[Project](../projects/project-creekside.md)\n' }));
  await fs.writeFile(path.join(folder, 'notes/incoming.md'), markdown.serialize({ id: 'incoming-note', title: 'Incoming', properties: {}, tags: [], body: '[Note](source.md)\n' }));
  let launched = await launch(folder, userData), app = launched.app, page = launched.page;
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const row = id => page.locator(`aside [data-record="${id}"]`);
  const target = value => page.locator(`aside [data-open-folder="${value}"]`);
  const saved = () => page.locator('#b-save-state').filter({ hasText: /^Saved$/ }).waitFor();
  try {
    await target('projects').click();
    await page.locator('main .b-project-grid .b-project').first().waitFor();
    let repo = await WorkspaceRepository.open(folder);
    const count = Object.values(repo.workspace.records).filter(record => record.database === 'db-projects').length;
    assert.equal(await page.locator('main .b-project-grid .b-project').count(), count);
    assert.equal(await page.locator('main table').count(), 0);
    await page.locator('main').getByRole('heading', { name: 'Client work', exact: true }).waitFor();
    assert.equal(await page.locator('.b-project-grid [aria-label="Project status: Completed"]').count(), 1);
    for (const width of [400, 900, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.locator('.b-project-grid').evaluate(element => element.scrollWidth <= element.clientWidth + 1), true);
    }
    await page.screenshot({ path: path.join(root, 'work/qa/project-cards.png') });
    await page.locator('main .b-project-grid [data-record="project-creekside"]').click();
    await page.getByRole('textbox', { name: 'Project Markdown', exact: true }).waitFor();
    assert.equal(await row('project-creekside').getAttribute('draggable'), 'false');
    assert.equal(await row(repo.workspace.home).getAttribute('draggable'), 'false');
    await target('todos').click();
    await page.locator('main table').waitFor();

    await row('drag-note').click();
    const editor = page.getByRole('textbox', { name: 'Page Markdown', exact: true });
    await editor.press('ControlOrMeta+End'); await editor.press('Enter'); await page.keyboard.insertText('Pending edit survives the move');
    assert.equal(await row('drag-note').getAttribute('draggable'), 'true');
    const cancelled = await row('drag-note').evaluate(element => {
      const dataTransfer = new DataTransfer();
      element.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer }));
      const dispatch = folder => {
        const target = document.querySelector(`aside [data-open-folder="${folder}"]`);
        const event = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer });
        target.dispatchEvent(event); return event.defaultPrevented;
      };
      const sameFolder = dispatch('notes'), database = dispatch('projects'), regular = dispatch('notes/archive');
      const highlighted = document.querySelectorAll('[data-drop-target]').length;
      element.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer }));
      return { sameFolder, database, regular, highlighted, remaining: document.querySelectorAll('[data-drop-target]').length };
    });
    assert.deepEqual(cancelled, { sameFolder: false, database: false, regular: true, highlighted: 1, remaining: 0 });
    assert.equal((await WorkspaceRepository.open(folder)).workspace.paths['drag-note'], 'notes/source.md');
    // Drop directly onto a closed folder; children need not be visible.
    await target('notes/archive').focus(); await target('notes/archive').press('ArrowLeft');
    await row('drag-note').dragTo(target('notes/archive'));
    await page.waitForFunction(() => document.querySelector('aside [data-record="drag-note"]')?.title === 'notes/archive/source.md');
    await saved();
    repo = await WorkspaceRepository.open(folder);
    assert.equal(repo.workspace.paths['drag-note'], 'notes/archive/source.md');
    assert.match(repo.workspace.records['drag-note'].body, /Pending edit survives/);
    assert.match(repo.workspace.records['drag-note'].body, /\.\.\/\.\.\/projects\/project-creekside.md/);
    assert.match(repo.workspace.records['incoming-note'].body, /archive\/source.md/);
    assert.equal(await row('drag-note').evaluate(element => document.activeElement === element), true);
    assert.equal(await page.locator('[data-drop-target]').count(), 0);
    assert.match(await editor.innerText(), /Pending edit survives/);

    // Invalid database targets and foreign drags cannot move notes.
    await row('drag-note').dragTo(target('projects'));
    assert.equal((await WorkspaceRepository.open(folder)).workspace.paths['drag-note'], 'notes/archive/source.md');
    await target('').evaluate(element => {
      const dataTransfer = new DataTransfer(); dataTransfer.setData('application/x-bento-note', 'drag-note');
      element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
    });
    assert.equal((await WorkspaceRepository.open(folder)).workspace.paths['drag-note'], 'notes/archive/source.md');
    await row('drag-note').dragTo(target(''));
    await page.waitForFunction(() => document.querySelector('aside [data-record="drag-note"]')?.title === 'source.md');
    await saved();
    assert.equal(await page.locator('[data-drop-target]').count(), 0);
    await stop(app); app = null;
    launched = await launch(folder, userData); app = launched.app; page = launched.page;
    await row('drag-note').waitFor();
    assert.equal(await row('drag-note').getAttribute('title'), 'source.md');
    assert.deepEqual(errors, []);
    console.log('Project cards and regular-note drag/drop passed (hidden Electron).');
  } finally { await stop(app); }
}
