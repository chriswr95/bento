import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourceCaret } from '../prototype/editor-position.js';
test('pointer caret mapping respects plain and formatted text and falls back safely for ambiguous runs', () => {
  assert.equal(sourceCaret('A plain paragraph.\n', 'A plain paragraph.', 2), 2);
  assert.equal(sourceCaret('# A **bold** heading\n', 'bold', 2), 8);
  assert.equal(sourceCaret('one one', 'one', 1), 7);
  assert.equal(sourceCaret('&amp;', '&', 1), 5);
  assert.equal(sourceCaret('paragraph', 'absent', 0), 9);
});
