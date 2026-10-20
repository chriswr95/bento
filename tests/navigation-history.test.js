import { test } from 'node:test';
import assert from 'node:assert/strict';
import History from '../prototype/navigation-history.js';
const page = document => ({ view: 'document', project: null, document });
test('back and forward restore locations and presentation without storing workspace snapshots', () => {
  const history = new History(page('first'));
  history.remember({ scrollY: 250, editor: { selection: { type: 'text', anchor: 3, head: 3 }, focused: true } });
  history.visit(page('second')); history.visit(page('third'));
  assert.equal(history.move(-1).location.document, 'second');
  const first = history.move(-1); assert.equal(first.location.document, 'first'); assert.equal(first.presentation.scrollY, 250);
  assert.equal(history.move(-1), null); assert.equal(history.move(1).location.document, 'second');
  first.location.document = 'changed'; assert.equal(history.entries[0].location.document, 'first');
});
test('new visits clear forward history, duplicate visits do not, and history is bounded', () => {
  const history = new History(page('a'), 3); history.visit(page('b')); history.visit(page('c')); history.move(-1);
  assert.equal(history.visit(page('b')), false); assert.equal(history.move(1).location.document, 'c');
  history.move(-1); history.visit(page('d')); assert.equal(history.move(1), null);
  history.visit(page('e')); assert.equal(history.entries.length, 3); assert.equal(history.entries[0].location.document, 'b');
});
test('history skips unavailable pages and reset clears the previous workspace', () => {
  const history = new History(page('a')); history.visit(page('missing')); history.visit(page('b'));
  assert.equal(history.move(-1, location => location.document !== 'missing').location.document, 'a');
  history.reset(page('other-workspace')); assert.equal(history.move(-1), null); assert.equal(history.move(1), null);
});

test('folder history distinguishes nested locations and skips unavailable destinations', () => {
  const folder = value => ({ view: 'folder', folder: value, document: null, project: null });
  const history = new History(folder('notes'));
  history.visit(folder('notes/Design')); history.visit(folder('projects'));
  assert.equal(history.entries.length, 3);
  assert.equal(history.move(-1, location => location.folder !== 'notes/Design').location.folder, 'notes');
  assert.equal(history.move(1).location.folder, 'notes/Design');
});
