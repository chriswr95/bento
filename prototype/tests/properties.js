import assert from 'node:assert/strict';
export async function checkProperties(browser, url) {
  const page = await browser.newPage();
  await page.goto(url);
  await page.evaluate(async () => {
    const [{ default: InlineProperties }, { default: model }] = await Promise.all([import('./inline-properties.js'), import('./workspace.js')]);
    document.body.innerHTML = '<div id="bento-workflow"><section id="test-properties"></section><button id="outside">Outside</button></div>';
    let workspace = model.createWorkspace(); const id = 'creek';
    workspace.databases[workspace.records[id].database].fields.push(
      { id: 'hours', name: 'Hours', type: 'number', min: 0 },
      { id: 'reviewed', name: 'Reviewed', type: 'boolean' },
      { id: 'related', name: 'Related', type: 'relation', cardinality: 'many', target_database: 'db-projects' }
    );
    workspace.databases[workspace.records[id].database].property_layout = { important: [], detail: ['hours', '$color', '$tags'] };
    window.propertyFixture = { get workspace() { return workspace; }, id, changes: 0 };
    window.propertyFixture.editor = new InlineProperties(document.querySelector('#test-properties'), {
      disclosureKey: 'bento.test.properties.expanded',
      record: () => workspace.records[id], workspace: () => workspace,
      change(patch) { workspace = model.updateDocument(workspace, id, patch); window.propertyFixture.changes++; }
    });
  });
  const edit = async name => {
    const button = page.getByRole('button', { name: `Edit ${name}`, exact: true });
    if (!await button.isVisible()) await page.locator('[data-more-properties]>summary').click();
    await button.click();
  };
  const record = () => page.evaluate(() => window.propertyFixture.workspace.records.creek);
  const original = await record();
  await edit('Page title'); await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => window.propertyFixture.changes), 0);
  await edit('Page title');
  await page.getByRole('textbox', { name: 'Page title', exact: true }).fill('Canceled title');
  await page.keyboard.press('Escape'); assert.equal((await record()).title, original.title);
  await edit('Page title'); await page.getByRole('textbox', { name: 'Page title', exact: true }).fill('');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('[data-inline-error]:visible').count(), 1);
  assert.equal((await record()).title, original.title);
  const disclosure = page.locator('[data-properties-disclosure]');
  const summary = disclosure.locator(':scope>summary');
  await summary.click();
  assert.equal(await disclosure.getAttribute('open'), '');
  assert.equal(await page.locator('[data-inline-error]:visible').count(), 1);
  await page.keyboard.press('Escape');
  await edit('Page title'); await page.getByRole('textbox', { name: 'Page title', exact: true }).fill('Keyboard title');
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => window.propertyFixture.workspace.records.creek.title === 'Keyboard title' && document.activeElement?.dataset.editProperty === 'field-project-status');
  assert.equal((await record()).title, 'Keyboard title');
  await edit('Hours'); await page.getByRole('spinbutton', { name: 'Hours', exact: true }).fill('-1');
  await page.keyboard.press('Enter'); assert.equal((await record()).properties.hours, undefined);
  await page.locator('[data-more-properties]>summary').click();
  assert.equal(await page.locator('[data-more-properties]').getAttribute('open'), '');
  assert.equal(await page.locator('[data-inline-error]:visible').count(), 1);
  await page.getByRole('spinbutton', { name: 'Hours', exact: true }).fill('0'); await page.keyboard.press('Enter');
  assert.equal((await record()).properties.hours, 0);
  await edit('Reviewed'); await page.getByRole('combobox', { name: 'Reviewed', exact: true }).selectOption('false');
  assert.equal((await record()).properties.reviewed, false);
  await edit('Page title'); await page.getByRole('textbox', { name: 'Page title', exact: true }).fill('Saved on blur');
  await page.locator('#outside').click(); await page.getByRole('button', { name: 'Edit Page title', exact: true }).waitFor();
  assert.equal((await record()).title, 'Saved on blur');
  await edit('Tags'); const tags = page.getByRole('textbox', { name: 'Tags', exact: true });
  await tags.fill('client, internal'); await tags.press('Enter'); await tags.fill('Follow up'); await tags.press('Enter');
  assert.deepEqual((await record()).tags, ['client, internal', 'Follow up']);
  await tags.fill('Follow up'); await tags.press('Enter'); assert.equal((await record()).tags.length, 2);
  await tags.press('Backspace'); assert.deepEqual((await record()).tags, ['client, internal']);
  await page.getByRole('button', { name: 'Remove tag client, internal', exact: true }).click();
  assert.deepEqual((await record()).tags, []);
  await tags.fill('Saved on blur'); await page.locator('#outside').click();
  assert.deepEqual((await record()).tags, ['Saved on blur']);
  assert.equal(await page.locator('#outside').evaluate(button => document.activeElement === button), true);
  await edit('Related'); const search = page.getByRole('searchbox', { name: 'Search Related', exact: true });
  await search.fill('Elm'); await page.getByRole('checkbox', { name: 'Elm Street drainage', exact: true }).check();
  await search.press('Escape'); assert.equal((await record()).properties.related, undefined);
  await edit('Related'); await page.getByRole('checkbox', { name: 'Elm Street drainage', exact: true }).check();
  await page.getByRole('searchbox', { name: 'Search Related', exact: true }).press('Enter');
  assert.deepEqual((await record()).properties.related, ['elm']);
  assert.equal((await record()).body, original.body);
  await edit('Tags'); await tags.fill('Committed on collapse');
  await summary.click();
  await page.getByRole('button', { name: 'Edit Page title', exact: true }).waitFor({ state: 'hidden' });
  assert.ok((await record()).tags.includes('Committed on collapse'));
  await page.waitForFunction(() => localStorage.getItem('bento.test.properties.expanded') === 'false');
  await page.evaluate(() => {
    const fixture = window.propertyFixture, previous = fixture.editor;
    previous.destroy();
    const section = document.createElement('section'); section.id = 'test-properties';
    document.querySelector('#test-properties').replaceWith(section);
    fixture.editor = new previous.constructor(section, previous.options);
  });
  assert.equal(await disclosure.getAttribute('open'), null);
  await summary.focus(); await summary.press('Enter');
  await page.getByRole('button', { name: 'Edit Page title', exact: true }).waitFor();
  await page.evaluate(() => { const fixture = window.propertyFixture; fixture.editor.options.readOnly = true; fixture.editor.render(); });
  assert.equal(await page.getByRole('button', { name: 'Edit Page title', exact: true }).isDisabled(), true);
  await summary.click(); assert.equal(await disclosure.getAttribute('open'), null);
  await page.close();
  console.log('Passed inline properties: cancel, validation, zero/false, blur save, tag chips, relation search/cancel/apply, unchanged Markdown, and read-only mode.');
}
