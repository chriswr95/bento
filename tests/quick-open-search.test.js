import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchQuickOpen } from '../prototype/quick-open-search.js';
const entries = [
  { id: 'save', kind: 'command', title: 'Save', detail: 'Command' },
  { id: 'settings', kind: 'command', title: 'Open Settings' },
  { id: 'blocked', kind: 'command', title: 'Unavailable', enabled: false },
  { id: 'note-1', kind: 'page', title: 'Résumé', detail: 'meetings/phase-a/resume.md', keywords: ['Follow up'] },
  { id: 'note-2', kind: 'page', title: 'Weekly coordination', detail: 'meetings/weekly.md' },
  { id: 'note-3', kind: 'page', title: 'Résumé', detail: 'projects/resume.md' },
  { id: 'note-4', kind: 'page', title: 'Save' }
];
test('quick-open ranks exact titles, supports paths/tags and matches accents or fuzzy text', () => {
  assert.deepEqual(searchQuickOpen(entries, 'resume').map(entry => entry.id), ['note-1', 'note-3']);
  assert.equal(searchQuickOpen(entries, 'phase-a')[0].id, 'note-1');
  assert.equal(searchQuickOpen(entries, 'follow up')[0].id, 'note-1');
  assert.equal(searchQuickOpen(entries, 'wkcoord')[0].id, 'note-2');
  assert.equal(searchQuickOpen(entries, 'save')[0].id, 'note-4');
});
test('command-only mode, disabled commands, limits and no matches are deterministic', () => {
  assert.deepEqual(searchQuickOpen(entries, '').map(entry => entry.id), ['note-1', 'note-2', 'note-3', 'note-4']);
  assert.equal(searchQuickOpen(entries, '>save')[0].id, 'save');
  assert.deepEqual(searchQuickOpen(entries, '> resume'), []);
  assert.deepEqual(searchQuickOpen(entries, '> unavailable'), []);
  assert.deepEqual(searchQuickOpen(entries, '>').map(entry => entry.id), ['save', 'settings']);
  assert.equal(searchQuickOpen(entries, ' > settings')[0].id, 'settings');
  assert.deepEqual(searchQuickOpen(entries, 'unavailable'), []);
  assert.deepEqual(searchQuickOpen(entries, 'zzzzzz'), []);
  assert.equal(searchQuickOpen(entries, '', 2).length, 2);
  const before = structuredClone(entries); searchQuickOpen(entries, 'resume'); assert.deepEqual(entries, before);
});
