import { test } from 'node:test';
import assert from 'node:assert/strict';
import FileSession from '../prototype/file-session.js';

function fixture(t, { storageFailure = false, save } = {}) {
  let workspace = { version: 4, records: { note: { body: 'Original' } } };
  const stored = new Map();
  const storage = {
    getItem: key => stored.get(key) ?? null,
    setItem(key, value) { if (storageFailure) throw new Error('Unavailable'); stored.set(key, value); },
    removeItem(key) { if (storageFailure) throw new Error('Unavailable'); stored.delete(key); }
  };
  let message = '', error = '';
  const session = new FileSession({ save: save || (async value => ({ ok: true, value: { workspace: value, folder: 'test', readOnly: false } })) }, {
    workspace: () => workspace, status: value => { message = value; }, error: value => { error = value; }
  }, { storage, confirm: () => true });
  session.view = { workspace: structuredClone(workspace), folder: 'test', readOnly: false };
  t.after(() => clearTimeout(session.timer));
  return { session, stored, edit(body) { workspace.records.note.body = body; session.changed(workspace); }, message: () => message, error: () => error };
}

test('draft-storage failure is disclosed without misreporting a successful file save', async t => {
  const f = fixture(t, { storageFailure: true }); f.edit('Changed');
  assert.match(f.message(), /draft storage unavailable/); await f.session.save();
  assert.equal(f.session.view.workspace.records.note.body, 'Changed');
  assert.equal(f.session.failed, false); assert.equal(f.session.dirty, false);
  assert.match(f.message(), /Saved to workspace files/);
});

test('a rejected file save retains the draft and stops automatic retry', async t => {
  const f = fixture(t, { save: async () => ({ ok: false, error: 'Changed on disk' }) });
  f.edit('Keep my notes'); await f.session.save();
  assert.equal(f.session.failed, true); assert.equal(f.session.dirty, true);
  assert.match(f.error(), /Changed on disk/); assert.match(f.stored.get(f.session.key()), /Keep my notes/);
});

test('edits arriving during an in-flight save remain dirty and are saved next', async t => {
  let finish;
  const f = fixture(t, { save: requested => new Promise(resolve => { finish = () => resolve({ ok: true, value: { workspace: requested, folder: 'test', readOnly: false } }); }) });
  f.edit('First'); const saving = f.session.save(); f.edit('Second'); finish(); await saving;
  assert.equal(f.session.view.workspace.records.note.body, 'First'); assert.equal(f.session.dirty, true);
  assert.match(f.stored.get(f.session.key()), /Second/);
  const next = f.session.save(); finish(); await next;
  assert.equal(f.session.dirty, false); assert.equal(f.stored.has(f.session.key()), false);
});

test('read-only workspaces never send a save request', async t => {
  let calls = 0;
  const f = fixture(t, { save: async () => { calls++; throw new Error('Unexpected write'); } });
  f.session.view.readOnly = true; f.edit('Draft'); await f.session.save();
  assert.equal(calls, 0); assert.equal(f.session.dirty, true);
});


test('canceling a workspace chooser resumes autosave for the current draft', async t => {
  const f = fixture(t); f.edit('Still here');
  const priorTimer = f.session.timer;
  await f.session.open(async () => ({ ok: true, value: null }));
  assert.equal(f.session.dirty, true);
  assert.notEqual(f.session.timer, priorTimer);
  await f.session.save();
  assert.equal(f.session.dirty, false);
});
