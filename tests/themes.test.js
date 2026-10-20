import { test } from 'node:test';
import assert from 'node:assert/strict';
import { builtinThemes, validateTheme, parseTheme, installTheme, removeTheme, selectedTheme, readThemePreferences, saveThemePreferences, themePreferencesKey } from '../prototype/themes.js';
const custom = () => ({ ...structuredClone(builtinThemes[0]), id: 'my-theme', name: 'My theme' });
const contrast = (first, second) => {
  const luminance = color => color.slice(1).match(/../g).map(hex => parseInt(hex, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
  const a = luminance(first), b = luminance(second); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};
test('built-in themes have valid paired palettes and readable primary and secondary text', () => {
  assert.equal(new Set(builtinThemes.map(theme => theme.id)).size, 6);
  for (const theme of builtinThemes) {
    assert.deepEqual(validateTheme(theme), theme);
    for (const mode of ['light', 'dark']) for (const foreground of ['ink', 'soft']) for (const background of ['paper', 'side']) {
      assert.ok(contrast(theme[mode][foreground], theme[mode][background]) >= 4.5, `${theme.id} ${mode} ${foreground}/${background}: ${contrast(theme[mode][foreground], theme[mode][background])}`);
    }
  }
});
test('theme files reject executable CSS, incomplete palettes, unknown extensions and invalid identities', () => {
  for (const change of [theme => { theme.dark.paper = 'url(https://example.com)'; }, theme => { delete theme.light.warn; }, theme => { theme.css = 'body{}'; }, theme => { theme.id = '../escape'; }, theme => { theme.version = 2; }, theme => { theme.name = ''; }]) {
    const theme = custom(); change(theme); assert.throws(() => parseTheme(JSON.stringify(theme)));
  }
  assert.throws(() => parseTheme('{not json'), /JSON/);
  assert.throws(() => parseTheme(' '.repeat(32769)), /32 KB/);
  assert.deepEqual(parseTheme(JSON.stringify(custom())), custom());
});
test('installing and updating custom themes preserves the input and protects built-in identities', () => {
  const original = { colorTheme: 'bento', themes: [] };
  const next = installTheme(original, JSON.stringify(custom()));
  assert.equal(next.colorTheme, 'my-theme'); assert.equal(next.themes.length, 1); assert.deepEqual(original.themes, []);
  const updated = installTheme(next, JSON.stringify({ ...custom(), name: 'Updated' }));
  assert.equal(updated.themes.length, 1); assert.equal(updated.themes[0].name, 'Updated');
  assert.throws(() => installTheme(next, JSON.stringify(builtinThemes[1])), /built-in/);
  assert.equal(next.themes[0].name, 'My theme');
});
test('removing the selected custom theme falls back to Bento without changing other themes', () => {
  const preferences = { colorTheme: 'my-theme', themes: [custom(), { ...custom(), id: 'other' }] };
  const next = removeTheme(preferences, 'my-theme');
  assert.equal(next.colorTheme, 'bento'); assert.deepEqual(next.themes.map(theme => theme.id), ['other']);
  assert.equal(preferences.themes.length, 2); assert.throws(() => removeTheme(preferences, 'bento'));
  assert.equal(selectedTheme({ colorTheme: 'missing', themes: [] }).id, 'bento');
});
test('browser theme preferences persist separately and tolerate corrupt or blocked storage', () => {
  const data = new Map(), storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  const preferences = { colorTheme: 'my-theme', themes: [custom()] };
  assert.equal(saveThemePreferences(preferences, storage), true);
  assert.deepEqual(readThemePreferences(storage), preferences); assert.deepEqual([...data.keys()], [themePreferencesKey]);
  data.set(themePreferencesKey, '{broken');
  assert.equal(readThemePreferences(storage).colorTheme, 'bento'); assert.equal(data.get(themePreferencesKey), '{broken');
  const blocked = { getItem() { throw new Error('Blocked'); }, setItem() { throw new Error('Blocked'); } };
  assert.equal(readThemePreferences(blocked).colorTheme, 'bento'); assert.equal(saveThemePreferences(preferences, blocked), false);
});
