import { propertyChoices, propertyValue } from './property-editor.js';
import { validColor, colorNames, colorLabel } from './colors.js';

// Bounded literal queries: punctuation is text, never executable regular expressions.
export function propertyQuery(text, caret = text.length) {
  const before = text.slice(0, caret), match = /(?:^|\s)@([^@\n]{0,64})$/.exec(before);
  return match ? { from: before.lastIndexOf('@'), to: caret, text: match[1].trim() } : null;
}
export function entryFields(workspace, database) {
  return [ ...(workspace.databases[database]?.fields || []).filter(field => !field.unavailable),
    { id: '$tags', name: 'Tags', type: 'tags' }, { id: '$color', name: 'Color', type: 'color' } ];
}
const normalized = value => value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase();
export function matchingProperties(fields, query) {
  const text = normalized(query.trim());
  return fields.filter(field => normalized(field.name).includes(text)).sort((a, b) => Number(!normalized(a.name).startsWith(text)) - Number(!normalized(b.name).startsWith(text)));
}
export function microPatch(field, raw) {
  if (field.type === 'tags') return { tags: [...new Set(String(raw).split('\n').map(tag => tag.trim()).filter(Boolean))] };
  if (field.type === 'color') {
    if (raw !== '' && !validColor(raw)) throw new Error('Choose one of the eight named colors.');
    return { color: raw || null };
  }
  return { properties: { [field.id]: propertyValue(field, raw) } };
}
export function fieldValue(record, field) {
  return field.id === '$tags' ? record.tags || [] : field.id === '$color' ? record.color || '' : record.properties?.[field.id] ?? null;
}
export function valueChoices(workspace, field, current) {
  if (field.type === 'boolean') return [{ id: 'true', name: 'Yes' }, { id: 'false', name: 'No' }];
  if (field.type === 'color') return colorNames.map(id => ({ id, name: colorLabel(id) }));
  return propertyChoices(workspace, field, current) || [];
}
export function microLabel(workspace, field, value) {
  const choices = valueChoices(workspace, field, value);
  const display = item => choices.find(choice => choice.id === String(item))?.name || (item == null || item === '' ? field.type === 'color' ? 'Automatic' : 'Not set' : String(item));
  const values = (Array.isArray(value) ? value : [value]).map(display);
  return `@${field.name}(${values.join(', ') || 'Not set'})`;
}
