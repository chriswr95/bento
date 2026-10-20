import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colorNames, automaticColor, recordColor, tagColor, colorPair, paletteAccents, contrastRatio } from '../prototype/colors.js';
import { builtinThemes, validateTheme } from '../prototype/themes.js';
import model from '../prototype/workspace.js';

test('eight stable color identities resolve consistently and explicit choices win', () => {
  assert.equal(colorNames.length, 8);
  assert.equal(automaticColor('Follow up'), automaticColor('Follow up'));
  assert.ok(colorNames.includes(recordColor({ id: 'project-a' })));
  assert.equal(recordColor({ id: 'project-a', color: 'pink' }), 'pink');
  assert.equal(tagColor({ tagColors: { 'Follow up': 'teal' } }, 'Follow up'), 'teal');
  assert.ok(colorNames.includes(tagColor({}, '__proto__')));
});
test('every theme accent yields readable chip text in light and dark mode', () => {
  for (const theme of builtinThemes) for (const mode of ['light', 'dark']) {
    const palette = theme[mode], accents = paletteAccents(palette, mode === 'dark');
    assert.deepEqual(Object.keys(accents), colorNames);
    for (const name of colorNames) {
      const pair = colorPair(accents[name], palette.paper);
      assert.ok(contrastRatio(pair.foreground, pair.background) >= 4.5, `${theme.id}/${mode}/${name}`);
    }
  }
});
test('older custom themes derive eight colors while optional authored palettes are validated', () => {
  const theme = structuredClone(builtinThemes[0]); delete theme.light.accents; delete theme.dark.accents;
  assert.deepEqual(Object.keys(paletteAccents(validateTheme(theme).light, false)), colorNames);
  for (const paper of ['#000000', '#ffffff', '#777777']) for (const color of ['#ffff00', '#0000ff', '#000000', '#ffffff']) {
    const pair = colorPair(color, paper); assert.ok(contrastRatio(pair.foreground, pair.background) >= 4.5);
  }
  const invalid = structuredClone(builtinThemes[0]); delete invalid.dark.accents.pink;
  assert.throws(() => validateTheme(invalid), /eight/);
});
test('document and shared tag assignments are atomic, preserve Markdown and handle free-range tag names', () => {
  const workspace = model.createWorkspace(), before = structuredClone(workspace);
  let next = model.updateDocument(workspace, 'creek', { color: 'purple' });
  next = model.updateTagColor(next, '__proto__', 'pink');
  next = model.updateTagColor(next, 'client, internal', 'blue');
  assert.deepEqual(workspace, before);
  assert.equal(next.records.creek.body, workspace.records.creek.body);
  assert.equal(next.records.creek.color, 'purple');
  assert.equal(tagColor(next, '__proto__'), 'pink');
  assert.equal(tagColor(next, 'client, internal'), 'blue');
  const reset = model.updateTagColor(model.updateDocument(next, 'creek', { color: null }), '__proto__', null);
  assert.equal(reset.records.creek.color, null); assert.equal(Object.hasOwn(reset.tagColors, '__proto__'), false);
  for (const color of ['#112233', 'transparent', '', {}, 'automatic']) {
    assert.throws(() => model.updateDocument(workspace, 'creek', { color }));
    assert.throws(() => model.updateTagColor(workspace, 'Tag', color));
  }
});
