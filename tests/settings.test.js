import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SettingsStore } from '../files/settings.js';
import { parse } from '../files/markdown.js';
import { legacyPreferences } from '../prototype/personal-settings.js';
import profile from '../prototype/profile.js';
import { appearanceKey } from '../prototype/appearance.js';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bento-settings-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return { root, filename: path.join(root, 'settings.md'), store: new SettingsStore(root) };
}
const person = { version: 1, firstName: 'Maki', lastName: 'Example', birthday: '1990-10-19' };

test('missing settings initialize defaults and valid legacy preferences migrate to Markdown once', async t => {
  const { store, root, filename } = await fixture(t);
  const values = await store.load({ appearance: 'dark', profile: person });
  assert.equal(values.readOnly, false); assert.equal(values.appearance, 'dark');
  assert.deepEqual(parse(await fs.readFile(filename, 'utf8')).metadata.profile, { first_name: 'Maki', last_name: 'Example', birthday: '1990-10-19' });
  const next = await new SettingsStore(root).load({ appearance: 'light' });
  assert.equal(next.appearance, 'dark'); assert.equal(next.profile.firstName, 'Maki');
});
test('absent preferences default to system appearance and preserve blank optional profile details', async t => {
  const { store } = await fixture(t); const values = await store.load();
  assert.equal(values.appearance, 'system'); assert.equal(values.profile.birthday, '');
});
test('unknown metadata, comments and Markdown body survive a settings edit', async t => {
  const { store, filename } = await fixture(t); await store.load();
  const raw = (await fs.readFile(filename, 'utf8')).replace('appearance:', '# Keep comment\ncustom: retained\nappearance:').replace('profile:', 'profile:\n  custom: nested');
  await fs.writeFile(filename, raw); await store.load(); await store.save({ appearance: 'dark' });
  const saved = await fs.readFile(filename, 'utf8'), parsed = parse(saved);
  assert.match(saved, /# Keep comment/); assert.equal(parsed.metadata.custom, 'retained');
  assert.equal(parsed.metadata.profile.custom, 'nested'); assert.equal(parsed.body, parse(raw).body);
});
test('malformed settings remain untouched, disable settings writes, and can be repaired and reloaded', async t => {
  const { store, filename } = await fixture(t); await fs.writeFile(filename, '---\nkind: [broken\n---\n');
  const raw = await fs.readFile(filename, 'utf8'), values = await store.load({ appearance: 'dark' });
  assert.equal(values.readOnly, true); assert.match(values.warning, /settings/);
  await assert.rejects(store.save({ appearance: 'light' }), /repair/);
  assert.equal(await fs.readFile(filename, 'utf8'), raw);
  await fs.writeFile(filename, '---\nbento_version: 1\nkind: user-settings\nappearance: dark\n---\n');
  assert.equal((await store.load()).appearance, 'dark');
  assert.equal((await store.save({ appearance: 'light' })).appearance, 'light');
});
test('external settings changes stop a save without overwriting either persisted state or the file', async t => {
  const { store, filename } = await fixture(t); await store.load();
  const external = (await fs.readFile(filename, 'utf8')) + '\nAgent notes\n'; await fs.writeFile(filename, external);
  await assert.rejects(store.save({ appearance: 'dark' }), /changed on disk/);
  assert.equal(await fs.readFile(filename, 'utf8'), external); assert.equal(store.view().appearance, 'system');
});
test('invalid settings and profile values are rejected before writing', async t => {
  const { store, filename } = await fixture(t); await store.load(); const before = await fs.readFile(filename, 'utf8');
  for (const patch of [{ appearance: 'neon' }, { arbitrary: 1 }, { profile: { ...person, birthday: '2001-02-29' } }]) await assert.rejects(store.save(patch));
  assert.equal(await fs.readFile(filename, 'utf8'), before);
});
test('legacy migration reads only valid values and never removes or rewrites original browser preferences', () => {
  const stored = new Map([[appearanceKey, 'dark'], [profile.key, JSON.stringify(person)]]);
  const before = [...stored]; assert.deepEqual(legacyPreferences({ getItem: key => stored.get(key) }), { appearance: 'dark', profile: person });
  assert.deepEqual([...stored], before);
  assert.deepEqual(legacyPreferences({ getItem: () => '{invalid' }), {});
  assert.deepEqual(legacyPreferences({ getItem() { throw new Error('Unavailable'); } }), {});
});

test('an interrupted initial migration retains legacy values and recovers the same settings on next load', async t => {
  const { root } = await fixture(t);
  const failing = new SettingsStore(root, { beforeWrite() { throw new Error('Simulated interruption'); } });
  const view = await failing.load({ appearance: 'dark', profile: person });
  assert.equal(view.readOnly, true); assert.equal(view.profile.firstName, 'Maki');
  const recovered = await new SettingsStore(root).load({ appearance: 'light' });
  assert.equal(recovered.readOnly, false); assert.equal(recovered.appearance, 'dark');
  assert.deepEqual(recovered.profile, person);
});

test('custom theme installation, selection and removal round-trip through personal Markdown settings', async t => {
  const { builtinThemes } = await import('../prototype/themes.js');
  const theme = { ...structuredClone(builtinThemes[0]), id: 'my-theme', name: 'My theme' };
  const { store, root, filename } = await fixture(t); await store.load();
  await store.save({ colorTheme: theme.id, themes: [theme] });
  const next = await new SettingsStore(root).load();
  assert.equal(next.colorTheme, 'my-theme'); assert.deepEqual(next.themes, [theme]);
  assert.match(await fs.readFile(filename, 'utf8'), /color_theme: my-theme/);
  await store.save({ colorTheme: 'bento', themes: [] });
  assert.deepEqual((await new SettingsStore(root).load()).themes, []);
});

test('invalid theme settings never modify the personal settings file', async t => {
  const { store, filename } = await fixture(t); await store.load(); const before = await fs.readFile(filename, 'utf8');
  for (const patch of [{ colorTheme: null }, { themes: null }, { themes: [{}] }, { colorTheme: '../escape' }]) await assert.rejects(store.save(patch));
  assert.equal(await fs.readFile(filename, 'utf8'), before);
});
