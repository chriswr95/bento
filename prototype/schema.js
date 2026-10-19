const types = ['text', 'number', 'boolean', 'date', 'select', 'multi-select', 'status', 'relation'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const identity = value => typeof value === 'string' && /^[a-zA-Z0-9][\w-]*$/.test(value) && !['constructor', 'prototype', '__proto__'].includes(value);
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T12:00:00Z');
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}
function definition(database, databases) {
  if (!identity(database.id) || typeof database.title !== 'string' || !Number.isInteger(database.schema_version) || database.schema_version < 1 || !Array.isArray(database.fields)) throw new Error('Invalid database definition.');
  const fields = new Map();
  for (const field of database.fields) {
    if (!identity(field.id) || fields.has(field.id) || typeof field.name !== 'string' || !types.includes(field.type)) throw new Error('Invalid or duplicate field definition.');
    fields.set(field.id, field);
    if ('required' in field && typeof field.required !== 'boolean') throw new Error('Required must be a boolean.');
    if (['select', 'multi-select', 'status'].includes(field.type)) {
      if (!Array.isArray(field.options) || !field.options.length || new Set(field.options.map(option => option.id)).size !== field.options.length) throw new Error('Invalid select options.');
      for (const option of field.options) {
        if (!identity(option.id) || typeof option.name !== 'string') throw new Error('Invalid option identity.');
        if (field.type === 'status' && !['not-started', 'in-progress', 'complete'].includes(option.group)) throw new Error('Invalid status group.');
      }
    }
    if (field.type === 'relation' && (!Object.hasOwn(databases, field.target_database) || !['one', 'many'].includes(field.cardinality))) throw new Error('Invalid relation definition.');
    if (field.type === 'number') {
      if (['min', 'max'].some(key => key in field && !Number.isFinite(field[key]))) throw new Error('Invalid number bound.');
      if (field.min > field.max) throw new Error('Invalid number range.');
    }
    if ('default' in field) value(field, field.default);
  }
  return fields;
}
function value(field, input) {
  if (input == null) {
    if (field.required) throw new Error(`${field.name} is required.`);
    return;
  }
  let valid = true;
  switch (field.type) {
    case 'text': valid = typeof input === 'string' && (!field.required || !!input.trim()); break;
    case 'number': valid = Number.isFinite(input) && (!field.integer || Number.isInteger(input)) && (field.min == null || input >= field.min) && (field.max == null || input <= field.max); break;
    case 'boolean': valid = typeof input === 'boolean'; break;
    case 'date': valid = date(input); break;
    case 'select': case 'status': valid = field.options.some(option => option.id === input); break;
    case 'multi-select': valid = Array.isArray(input) && (!field.required || input.length > 0) && new Set(input).size === input.length && input.every(item => field.options.some(option => option.id === item)); break;
    case 'relation': valid = field.cardinality === 'many' ? Array.isArray(input) && (!field.required || input.length > 0) && new Set(input).size === input.length && input.every(identity) : identity(input); break;
  }
  if (!valid) throw new Error(`Invalid value for ${field.name} (${field.type}).`);
}
function properties(database, record, records) {
  for (const field of database.fields) {
    const input = record.properties[field.id]; value(field, input);
    if (field.type !== 'relation' || input == null) continue;
    for (const target of Array.isArray(input) ? input : [input]) {
      if (Object.hasOwn(records, target) && records[target].database !== field.target_database) throw new Error(`Invalid target database for ${field.name}.`);
    }
  }
}
const defaults = database => Object.fromEntries(database.fields.filter(field => 'default' in field).map(field => [field.id, structuredClone(field.default)]));
export default Object.freeze({ types, object, identity, date, definition, value, properties, defaults });
