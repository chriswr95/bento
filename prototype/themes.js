import schema from './schema.js';
import { colorNames, colorPair, paletteAccents } from './colors.js';
export const themePreferencesKey = 'bento.themes.v1';
export const colorTokens = Object.freeze(['paper', 'side', 'ink', 'soft', 'line', 'accent', 'wash', 'warn']);
export const themeId = value => typeof value === 'string' && value.length <= 64 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const text = (value, limit) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
function palette(value) {
  if (!schema.object(value) || Object.keys(value).filter(key => key !== 'accents').length !== colorTokens.length) throw new Error('Each palette needs all eight Bento color tokens.');
  const result = Object.fromEntries(colorTokens.map(key => {
    if (typeof value[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(value[key])) throw new Error(`Invalid ${key} color. Use #RRGGBB.`);
    return [key, value[key].toLowerCase()];
  }));
  if ('accents' in value) {
    if (!schema.object(value.accents) || Object.keys(value.accents).length !== 8 || !colorNames.every(name => typeof value.accents[name] === 'string' && /^#[0-9a-f]{6}$/i.test(value.accents[name]))) throw new Error('Theme accents need all eight named #RRGGBB colors.');
    result.accents = Object.fromEntries(colorNames.map(name => [name, value.accents[name].toLowerCase()]));
  }
  return result;
}
export function validateTheme(value) {
  if (!schema.object(value) || Object.keys(value).some(key => !['version', 'id', 'name', 'author', 'description', 'light', 'dark'].includes(key)) || value.version !== 1 || !themeId(value.id) || !text(value.name, 80)) throw new Error('Expected a version 1 Bento theme with an id and name.');
  for (const key of ['author', 'description']) if (key in value && !text(value[key], key === 'author' ? 100 : 300)) throw new Error(`Invalid theme ${key}.`);
  return { version: 1, id: value.id, name: value.name, ...('author' in value ? { author: value.author } : {}), ...('description' in value ? { description: value.description } : {}), light: palette(value.light), dark: palette(value.dark) };
}
export function parseTheme(raw) {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > 32768) throw new Error('Theme files must be smaller than 32 KB.');
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error('Theme file is not valid JSON.'); }
  return validateTheme(value);
}
const colors = (...values) => Object.fromEntries(colorTokens.map((key, index) => [key, values[index]]));
const definitions = [
  { id: 'bento', name: 'Bento', description: 'The original warm, quiet Bento palette.',
    light: colors('#fffefa','#f5f3ed','#33382e','#666b60','#e4e4da','#53623f','#e9efdf','#984b33'),
    dark: colors('#202127','#282930','#eeeee4','#b8bbb1','#41433f','#c6d6ac','#3b4432','#f1b79f') },
  { id: 'github', name: 'GitHub', description: 'A Bento adaptation of GitHub Light and Dark.',
    light: colors('#ffffff','#f6f8fa','#1f2328','#59636e','#d1d9e0','#0969da','#ddf4ff','#b35900'),
    dark: colors('#0d1117','#161b22','#e6edf3','#9198a1','#30363d','#79c0ff','#1c2d41','#ffa657') },
  { id: 'one-dark', name: 'One Dark', description: 'Atom-inspired dark colors with a light companion.',
    light: colors('#fafafa','#f0f0f0','#383a42','#62666f','#d4d4d4','#3369b8','#e2eaf6','#986801'),
    dark: colors('#282c34','#21252b','#abb2bf','#9da5b4','#424854','#61afef','#34445c','#e5c07b') },
  { id: 'darcula', name: 'Darcula', description: 'JetBrains-inspired charcoal with a neutral light companion.',
    light: colors('#ffffff','#f2f2f2','#2b2b2b','#616161','#d5d5d5','#315f9b','#e5edf7','#9b5a16'),
    dark: colors('#2b2b2b','#3c3f41','#bbbbbb','#ababab','#55585a','#7eb6e6','#34465e','#e8bf6a') },
  { id: 'tokyo-night', name: 'Tokyo Night', description: 'A Bento adaptation of Tokyo Night with a day palette.',
    light: colors('#e1e2e7','#d5d6db','#304f9e','#4e5a70','#b4b5c0','#7847bd','#d4ccea','#8c4351'),
    dark: colors('#1a1b26','#16161e','#c0caf5','#a9b1d6','#3b4261','#bb9af7','#292e42','#ff9e64') },
  { id: 'catppuccin', name: 'Catppuccin', description: 'A Bento adaptation of Latte in light mode and Mocha in dark mode.',
    light: colors('#eff1f5','#e6e9ef','#4c4f69','#5c5f77','#bcc0cc','#8839ef','#e2d6f6','#9b4817'),
    dark: colors('#1e1e2e','#181825','#cdd6f4','#bac2de','#45475a','#cba6f7','#313244','#fab387') }
];
const accentSets = {
  bento: ['#ac3f44 #b65a18 #8a6c00 #39704a #227878 #3b68ad #7952a3 #a64d7b', '#f28b82 #f5b277 #e9cf75 #a9cf89 #80cbc4 #90b9ef #bca2e5 #e6a3c5'],
  github: ['#cf222e #bc4c00 #9a6700 #1a7f37 #0e7979 #0969da #8250df #bf3989', '#ff7b72 #ffa657 #e3b341 #7ee787 #76e3ea #79c0ff #d2a8ff #ff9bce'],
  'one-dark': ['#be5046 #a65b24 #8b6c20 #507d29 #167d8d #4078c0 #a626a4 #a03e75', '#e06c75 #d19a66 #e5c07b #98c379 #56b6c2 #61afef #c678dd #d78eb3'],
  darcula: ['#b64542 #ac6426 #8b731f #4f7836 #227e76 #315f9b #8052a5 #a24d7e', '#ff8f88 #e8b078 #e8bf6a #a9c57b #72b8ad #7eb6e6 #bda0d4 #d99cbd'],
  'tokyo-night': ['#b7355d #a45f1f #8b7018 #496d34 #237d78 #315aaf #7847bd #a34886', '#f7768e #ff9e64 #e0af68 #9ece6a #73daca #7aa2f7 #bb9af7 #ff9bce'],
  catppuccin: ['#d20f39 #fe640b #df8e1d #40a02b #179299 #1e66f5 #8839ef #ea76cb', '#f38ba8 #fab387 #f9e2af #a6e3a1 #94e2d5 #89b4fa #cba6f7 #f5c2e7']
};
export const builtinThemes = Object.freeze(definitions.map(definition => {
  const accents = accentSets[definition.id].map(set => Object.fromEntries(colorNames.map((name, index) => [name, set.split(' ')[index]])));
  const theme = validateTheme({ version: 1, ...definition, light: { ...definition.light, accents: accents[0] }, dark: { ...definition.dark, accents: accents[1] } });
  Object.freeze(theme.light.accents); Object.freeze(theme.dark.accents);
  Object.freeze(theme.light); Object.freeze(theme.dark); return Object.freeze(theme);
}));
export function validateThemePreferences(value) {
  if (!schema.object(value) || !themeId(value.colorTheme) || !Array.isArray(value.themes) || value.themes.length > 32) throw new Error('Invalid theme preferences. At most 32 custom themes can be installed.');
  const themes = value.themes.map(validateTheme), ids = new Set(builtinThemes.map(theme => theme.id));
  for (const theme of themes) { if (ids.has(theme.id)) throw new Error('A theme cannot replace a built-in theme or duplicate another installed id.'); ids.add(theme.id); }
  return { colorTheme: value.colorTheme, themes };
}
export function installTheme(preferences, raw) {
  const theme = parseTheme(raw);
  const themes = preferences.themes.filter(existing => existing.id !== theme.id);
  return validateThemePreferences({ colorTheme: theme.id, themes: [...themes, theme] });
}
export function removeTheme(preferences, id) {
  if (builtinThemes.some(theme => theme.id === id)) throw new Error('Built-in themes cannot be removed.');
  return validateThemePreferences({ colorTheme: preferences.colorTheme === id ? 'bento' : preferences.colorTheme, themes: preferences.themes.filter(theme => theme.id !== id) });
}
export const themeCatalog = preferences => [...builtinThemes, ...preferences.themes];
export const selectedTheme = preferences => themeCatalog(preferences).find(theme => theme.id === preferences.colorTheme) || builtinThemes[0];
export function applyColorTheme(element, preferences, dark) {
  const theme = selectedTheme(preferences);
  for (const token of colorTokens) element.style.setProperty('--b-' + token, theme[dark ? 'dark' : 'light'][token]);
  const palette = theme[dark ? 'dark' : 'light'];
  for (const [name, color] of Object.entries(paletteAccents(palette, dark))) {
    const pair = colorPair(color, palette.paper);
    element.style.setProperty('--b-color-' + name, pair.foreground);
    element.style.setProperty('--b-color-' + name + '-wash', pair.background);
  }
  element.dataset.colorTheme = theme.id;
}
export function readThemePreferences(storage) {
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(themePreferencesKey);
    return raw ? validateThemePreferences(JSON.parse(raw)) : { colorTheme: 'bento', themes: [] };
  } catch { return { colorTheme: 'bento', themes: [], warning: 'Theme preferences could not be read. Using Bento.' }; }
}
export function saveThemePreferences(preferences, storage) {
  const valid = validateThemePreferences(preferences);
  try { (storage ?? globalThis.localStorage).setItem(themePreferencesKey, JSON.stringify(valid)); return true; }
  catch { return false; }
}
