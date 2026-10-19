import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { SessionStore, validLocation } from '../files/session.js';
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bento-session-'));
  t.after(() => fs.rm(root, { recursive: true, force: true })); return { root, session: new SessionStore(root) };
}
test('last workspace and document restore from an atomic local session file', async t => {
  const { root, session } = await fixture(t), location = { view: 'document', document: 'note-one', project: null };
  await session.remember(root, location);
  const repository = { workspace: { records: { 'note-one': {} }, databases: {} } };
  const restored = await new SessionStore(root).restore(async folder => { assert.equal(folder, root); return repository; });
  assert.deepEqual(restored.location, location); assert.equal(restored.repository, repository);
  assert.equal(restored.warning, ''); assert.deepEqual(await fs.readdir(root), ['session.json']);
});
test('missing workspace preserves the previous session and allows choosing another folder', async t => {
  const { root, session } = await fixture(t); await session.remember(root, { view: 'daily', document: null, project: null });
  const before = await fs.readFile(session.filename, 'utf8');
  const restored = await session.restore(async () => { throw new Error('Disconnected'); });
  assert.equal(restored.repository, null); assert.match(restored.warning, /unavailable/);
  assert.equal(await fs.readFile(session.filename, 'utf8'), before);
});
test('missing pages and invalid project references fall back to the overview', async t => {
  const { root, session } = await fixture(t); await session.remember(root, { view: 'document', document: 'missing', project: null });
  const restored = await session.restore(async () => ({ workspace: { records: {}, databases: {} } }));
  assert.equal(restored.location.view, 'daily'); assert.match(restored.warning, /last page/);
  await session.remember(root, { view: 'daily', document: null, project: 'not-project' });
  assert.equal((await session.restore(async () => ({ workspace: { records: { 'not-project': {} }, databases: {} } }))).location.project, null);
});
test('malformed session metadata is retained and invalid updates are rejected', async t => {
  const { root, session } = await fixture(t); await fs.writeFile(session.filename, '{invalid');
  assert.match(await session.read(), /could not be read/);
  assert.equal(await fs.readFile(session.filename, 'utf8'), '{invalid');
  assert.equal(validLocation({ view: 'create', document: null, project: null }), false);
  await assert.rejects(session.remember('relative', { view: 'daily', document: null, project: null }));
  await assert.rejects(session.remember(root, { view: 'document', document: null, project: null }));
});
