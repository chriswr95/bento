import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readTheme, saveTheme, nextTheme, isDark } from '../prototype/appearance.js';

test('appearance follows the system until explicitly chosen and toggles the visible mode', () => {
  assert.equal(isDark('system', true), true);
  assert.equal(isDark('system', false), false);
  assert.equal(nextTheme('system', true), 'light');
  assert.equal(nextTheme('system', false), 'dark');
  assert.equal(nextTheme('dark', false), 'light');
  assert.equal(nextTheme('light', true), 'dark');
});
test('appearance choice persists without modifying workspace data', () => {
  let saved = null;
  const storage = { getItem: () => saved, setItem: (_key, value) => { saved = value; } };
  assert.equal(readTheme(storage), 'system');
  assert.equal(saveTheme('dark', storage), true);
  assert.equal(readTheme(storage), 'dark');
  saveTheme('light', storage); assert.equal(readTheme(storage), 'light');
  assert.throws(() => saveTheme('invalid', storage), /Invalid appearance/);
  saved = 'corrupt'; assert.equal(readTheme(storage), 'system');
});
test('unavailable local settings keep appearance switching usable for the session', () => {
  const storage = { getItem() { throw new Error('Unavailable'); }, setItem() { throw new Error('Unavailable'); } };
  assert.equal(readTheme(storage), 'system');
  assert.equal(saveTheme('dark', storage), false);
});
