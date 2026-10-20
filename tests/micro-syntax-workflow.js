import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as markdown from '../files/markdown.js';
import { WorkspaceRepository } from '../files/repository.js';

export async function checkMicroSyntax({ launch, stop, temporary, root }) {
  const folder = path.join(temporary, 'Micro workspace'), userData = path.join(temporary, 'MicroUserData');
  await fs.cp(path.join(root, 'examples/document-databases'), folder, { recursive: true });
  const manifestPath = path.join(folder, 'workspace.md'), manifestRaw = await fs.readFile(manifestPath, 'utf8'), manifest = markdown.parse(manifestRaw);
  manifest.metadata.databases.push({ id: 'db-permits', path: 'permits' });
  await fs.mkdir(path.join(folder, 'permits'));
  const definition = { bento_version: 1, kind: 'database-definition', id: 'db-permits', title: 'Permits', schema_version: 1, capabilities: {}, fields: [
    { id: 'client', name: 'Client', type: 'text', required: true },
    { id: 'submission', name: 'Submission date', type: 'date', required: true },
    { id: 'hours', name: 'Hours', type: 'number', min: 0 },
    { id: 'approved', name: 'Approved', type: 'boolean' },
    { id: 'disciplines', name: 'Disciplines', type: 'multi-select', options: [{ id: 'civil', name: 'Civil' }, { id: 'landscape', name: 'Landscape' }] }
  ] };
  await fs.writeFile(path.join(folder, 'permits/database.md'), markdown.serialize({ ...definition, body: '\n# Permits\n' }));
  await fs.writeFile(manifestPath, markdown.serialize({ ...manifest.metadata, body: manifest.body }, manifestRaw));
  let launched = await launch(folder, userData), app = launched.app, page = launched.page;
  const errors = []; const listen = () => page.on('pageerror', error => errors.push(error.message)); listen();
  const saved = async () => {
    try { await page.locator('#b-save-state').filter({ hasText: /^Saved$/ }).waitFor(); }
    catch (error) { console.error('Micro save diagnostics:', await page.locator('#b-save-state').innerText(), await page.locator('#b-file-errors').innerText(), await page.locator('.b-micro-picker:not([hidden])').innerText().catch(() => 'Closed')); throw error; }
  };
  const props = () => page.getByRole('listbox', { name: 'Properties', exact: true });
  const title = () => page.getByRole('textbox', { name: 'Document title', exact: true });
  const source = () => page.getByRole('textbox', { name: 'Page Markdown', exact: true });
  const field = async query => { await title().pressSequentially(' @' + query); await title().press('Enter'); };
  try {
    await page.locator('aside').getByRole('button', { name: 'Weekly coordination', exact: true }).click();
    await source().press('ControlOrMeta+End'); await source().press('Enter'); await source().press('Enter');
    await source().pressSequentially('[] Check permit comments @da ');
    await props().getByRole('option', { name: /^Due date/ }).waitFor(); await source().press('Enter');
    await page.getByRole('dialog', { name: 'Set Due date', exact: true }).getByRole('button', { name: 'Tomorrow', exact: true }).click();
    await saved(); let repo = await WorkspaceRepository.open(folder);
    let task = Object.values(repo.workspace.records).find(record => record.title === 'Check permit comments'); assert.ok(task);
    assert.match(task.properties['field-task-due'], /^\d{4}-\d{2}-\d{2}$/);
    await source().pressSequentially(' @pro'); await props().getByRole('option', { name: /^Project/ }).click();
    await page.getByRole('searchbox', { name: 'Search Project', exact: true }).fill('Creekside'); await page.keyboard.press('Enter'); await saved();
    repo = await WorkspaceRepository.open(folder); task = repo.workspace.records[task.id];
    assert.equal(task.properties['field-task-project'], 'project-creekside');
    await source().pressSequentially(' @status'); await source().press('Enter');
    await page.getByRole('listbox', { name: 'Status', exact: true }).selectOption('option-done'); await page.keyboard.press('Enter'); await saved();
    repo = await WorkspaceRepository.open(folder);
    assert.equal(repo.workspace.records[task.id].properties['field-task-status'], 'option-done');
    assert.match(repo.workspace.records['meeting-coordination'].body, /\[x\] \[Check permit comments\]/);
    assert.doesNotMatch(repo.workspace.records['meeting-coordination'].body, /@da|@pro|@status/);
    await source().press('ControlOrMeta+End'); await source().press('Enter'); await source().press('Enter');
    await source().pressSequentially('/Permits');
    await page.getByRole('listbox', { name: 'Slash commands', exact: true }).getByRole('option', { name: /^New page in Permits/ }).waitFor();
    await source().press('Enter'); await title().fill('Tree trimming permit');
    await field('client'); await page.getByRole('textbox', { name: 'Client', exact: true }).fill('City review'); await page.keyboard.press('Enter');
    await field('da '); await page.locator('.b-micro-picker input[type=date]').fill('2026-10-27'); await page.keyboard.press('Enter');
    await field('hours'); await page.getByRole('spinbutton', { name: 'Hours', exact: true }).fill('-1'); await page.keyboard.press('Enter');
    await page.locator('.b-micro-picker [role=alert]').filter({ hasText: /Invalid/ }).waitFor(); assert.match(await title().inputValue(), /@hours/);
    await page.getByRole('spinbutton', { name: 'Hours', exact: true }).fill('0'); await page.keyboard.press('Enter');
    await field('approved'); await page.getByRole('listbox', { name: 'Approved', exact: true }).selectOption('false'); await page.keyboard.press('Enter');
    await field('disc'); await page.getByRole('listbox', { name: 'Disciplines', exact: true }).selectOption(['civil', 'landscape']); await page.keyboard.press('Enter');
    await field('tags'); await page.getByRole('textbox', { name: 'Tags', exact: true }).fill('client, internal\nFollow up'); await page.keyboard.press('ControlOrMeta+Enter');
    await field('color'); await page.getByRole('listbox', { name: 'Color', exact: true }).selectOption('purple'); await page.keyboard.press('Enter');
    assert.doesNotMatch(await title().inputValue(), /@/);
    assert.equal(Object.values((await WorkspaceRepository.open(folder)).workspace.records).filter(record => record.database === 'db-permits').length, 0);
    await page.screenshot({ path: path.join(root, 'work/qa/micro-entry.png') });
    await title().press('Enter'); await source().waitFor(); await saved();
    repo = await WorkspaceRepository.open(folder);
    const permit = Object.values(repo.workspace.records).find(record => record.title === 'Tree trimming permit');
    assert.ok(permit); assert.equal(permit.database, 'db-permits');
    assert.deepEqual(permit.properties, { client: 'City review', submission: '2026-10-27', hours: 0, approved: false, disciplines: ['civil', 'landscape'] });
    assert.deepEqual(permit.tags, ['client, internal', 'Follow up']); assert.equal(permit.color, 'purple');
    await page.keyboard.press('ControlOrMeta+Shift+p');
    await page.getByRole('combobox', { name: 'Search pages and commands', exact: true }).fill('>new page in Permits'); await page.keyboard.press('Enter');
    await title().fill('Cancel this @client'); await title().press('Enter');
    await page.getByRole('textbox', { name: 'Client', exact: true }).fill('Never written'); await page.keyboard.press('Escape');
    assert.equal(await title().inputValue(), 'Cancel this @client');
    await title().fill('Unknown @['); await title().press('Enter');
    await props().getByText('No matching properties', { exact: true }).waitFor();
    assert.equal(await title().isVisible(), true); await title().press('Escape');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await stop(app); app = null;
    launched = await launch(null, userData); app = launched.app; page = launched.page; listen();
    await source().waitFor(); repo = await WorkspaceRepository.open(folder);
    assert.deepEqual(repo.workspace.records[permit.id].properties, permit.properties);
    assert.equal(Object.values(repo.workspace.records).filter(record => record.database === 'db-permits').length, 1);
    assert.deepEqual(errors, []);
    console.log('Passed shared @ queries on captured todos and slash/palette creation, custom required schemas, typed values, validation, cancellation, clean titles, stable identities, and restart.');
  } finally { await stop(app); }
}
