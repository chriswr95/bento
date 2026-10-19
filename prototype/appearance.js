export const appearanceKey = 'bento.appearance.v1';
const valid = theme => ['system', 'light', 'dark'].includes(theme);
export function readTheme(storage) {
  try {
    const theme = (storage ?? globalThis.localStorage).getItem(appearanceKey);
    return valid(theme) ? theme : 'system';
  } catch { return 'system'; }
}
export function saveTheme(theme, storage) {
  if (!valid(theme)) throw new Error('Invalid appearance.');
  try { (storage ?? globalThis.localStorage).setItem(appearanceKey, theme); return true; }
  catch { return false; }
}
export function isDark(theme, systemDark) { return theme === 'dark' || theme === 'system' && systemDark; }
export function nextTheme(theme, systemDark) { return isDark(theme, systemDark) ? 'light' : 'dark'; }
