import profile from './profile.js';
import { appearanceKey } from './appearance.js';

export function legacyPreferences(storage) {
  const patch = {};
  try {
    const source = storage ?? globalThis.localStorage;
    const appearance = source.getItem(appearanceKey);
    if (['system', 'light', 'dark'].includes(appearance)) patch.appearance = appearance;
    try { const value = JSON.parse(source.getItem(profile.key)); if (profile.validate(value)) patch.profile = value; } catch { /* Retain invalid legacy data unchanged. */ }
  } catch { /* A missing browser profile never blocks local-file settings. */ }
  return patch;
}
