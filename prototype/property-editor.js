import schema from './schema.js';
import { canParent, pagePath } from './page-hierarchy.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

export function propertyChoices(workspace, field, current) {
  if (field.type !== 'relation') return field.options;
  const records = Object.values(workspace.records).filter(record => field.pageParent ? canParent(workspace, field.pageParent, record.id) : record.database === field.target_database)
    .map(record => ({ id: record.id, name: field.pageParent ? pagePath(workspace, record.id) + ' · ' + (workspace.paths?.[record.id] || record.id) : record.title })).sort((a, b) => a.name.localeCompare(b.name));
  for (const id of Array.isArray(current) ? current : current ? [current] : []) {
    if (!records.some(option => option.id === id)) records.push({ id, name: `Unavailable record (${id})` });
  }
  return records;
}
export function propertyValue(field, raw) {
  const many = field.type === 'multi-select' || field.type === 'relation' && field.cardinality === 'many';
  let value = many ? raw : raw === '' || raw == null ? null : raw;
  if (field.type === 'number' && value != null) value = Number(value);
  if (field.type === 'boolean' && value != null) {
    if (!['true', 'false'].includes(value)) throw new Error(`Invalid value for ${field.name}.`);
    value = value === 'true';
  }
  schema.value(field, value);
  return value;
}
export { escape as escapeProperty };
