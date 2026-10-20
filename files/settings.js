import path from 'node:path';
import * as markdown from './markdown.js';
import * as transaction from './transaction.js';
import profile from '../prototype/profile.js';
import schema from '../prototype/schema.js';
import { validateThemePreferences } from '../prototype/themes.js';

const defaults = () => ({ appearance: 'system', colorTheme: 'bento', themes: [], profile: { version: 1, firstName: 'Makena', lastName: '', birthday: '' } });
function validatePatch(patch) {
  if (!schema.object(patch) || Object.keys(patch).some(key => !['appearance', 'profile', 'colorTheme', 'themes'].includes(key))) throw new Error('Invalid personal settings update.');
  if ('appearance' in patch && !['system', 'light', 'dark'].includes(patch.appearance)) throw new Error('Invalid appearance.');
  if ('colorTheme' in patch || 'themes' in patch) validateThemePreferences({ colorTheme: 'colorTheme' in patch ? patch.colorTheme : 'bento', themes: 'themes' in patch ? patch.themes : [] });
  if ('profile' in patch && !profile.validate(patch.profile)) throw new Error('Invalid personal profile.');
}
function decode(raw) {
  if (raw === null) return defaults();
  const data = markdown.parse(raw).metadata;
  if (data.kind !== 'user-settings' || data.bento_version !== 1) throw new Error('Expected version 1 user-settings Markdown.');
  const result = defaults();
  if ('appearance' in data) result.appearance = data.appearance;
  if ('color_theme' in data) result.colorTheme = data.color_theme;
  if ('themes' in data) result.themes = data.themes;
  if ('profile' in data) {
    if (!schema.object(data.profile)) throw new Error('Invalid personal profile.');
    result.profile = { version: 1, firstName: data.profile.first_name ?? result.profile.firstName, lastName: data.profile.last_name ?? '', birthday: data.profile.birthday ?? '' };
  }
  validatePatch(result); return result;
}
function encode(raw, values) {
  const parsed = markdown.parse(raw || '');
  const metadata = { ...parsed.metadata, bento_version: 1, kind: 'user-settings', appearance: values.appearance, color_theme: values.colorTheme, themes: values.themes,
    profile: { ...parsed.metadata.profile, first_name: values.profile.firstName, last_name: values.profile.lastName, birthday: values.profile.birthday } };
  return markdown.serialize({ ...metadata, body: raw === null ? '\n# Personal settings\n\nPreferences for Bento on this computer.\n' : parsed.body }, raw);
}

export class SettingsStore {
  constructor(root, options = {}) { this.options = options; this.root = root; this.values = defaults(); this.warning = ''; this.loaded = false; }
  view() { return { ...structuredClone(this.values), path: path.join(this.root, 'settings.md'), warning: this.warning, readOnly: !!this.warning }; }
  async load(legacy = {}) {
    this.warning = ''; this.loaded = true;
    try {
      await transaction.recover(this.root);
      this.raw = await transaction.read(this.root, 'settings.md');
      this.values = decode(this.raw);
      // Existing files always win. Original browser preferences are retained as a fallback copy.
      if (this.raw === null) { validatePatch(legacy); this.values = { ...this.values, ...structuredClone(legacy) }; return await this.save({}); }
    } catch (error) { this.warning = `Personal settings could not be loaded: ${error.message} Repair settings.md and reload settings. Notes remain available.`; }
    return this.view();
  }
  async save(patch) {
    if (!this.loaded || this.warning) throw new Error('Reload or repair personal settings before saving.');
    validatePatch(patch);
    const next = { ...this.values, ...structuredClone(patch) };
    validatePatch(next);
    const after = encode(this.raw, next);
    await transaction.commit(this.root, [{ path: 'settings.md', before: this.raw, after }], async () => {
      if (await transaction.read(this.root, 'settings.md') !== this.raw) throw new Error('Personal settings changed on disk. Reload settings before saving; the external file was preserved.');
    }, this.options.beforeWrite);
    this.raw = after; this.values = next;
    return this.view();
  }
}
