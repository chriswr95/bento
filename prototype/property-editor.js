import schema from './schema.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const name = field => `property:${field.id}`;

function choices(workspace, field, current) {
  if (field.type !== 'relation') return field.options;
  const records = Object.values(workspace.records).filter(record => record.database === field.target_database)
    .map(record => ({ id: record.id, name: record.title })).sort((a, b) => a.name.localeCompare(b.name));
  for (const id of Array.isArray(current) ? current : current ? [current] : []) {
    if (!records.some(option => option.id === id)) records.push({ id, name: `Unavailable record (${id})` });
  }
  return records;
}
function fieldControl(workspace, field, current) {
  const key = escape(name(field)), required = field.required ? 'required' : '';
  if (field.type === 'multi-select' || field.type === 'relation' && field.cardinality === 'many') {
    return `<fieldset class="b-property-options"><legend>${escape(field.name)}${field.required ? ' (required)' : ''}</legend>
      ${choices(workspace, field, current).map(option => `<label><input type="checkbox" name="${key}" value="${escape(option.id)}" ${(current || []).includes(option.id) ? 'checked' : ''}>${escape(option.name)}</label>`).join('') || '<p class="b-muted">No records available.</p>'}</fieldset>`;
  }
  let control;
  if (['select', 'status', 'relation', 'boolean'].includes(field.type)) {
    const options = field.type === 'boolean' ? [{ id: 'true', name: 'Yes' }, { id: 'false', name: 'No' }] : choices(workspace, field, current);
    control = `<select name="${key}" ${required}><option value="">Not set</option>${options.map(option => `<option value="${escape(option.id)}" ${current != null && String(current) === option.id ? 'selected' : ''}>${escape(option.name)}</option>`).join('')}</select>`;
  } else {
    const type = field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text';
    const bounds = field.type === 'number' ? `step="${field.integer ? '1' : 'any'}" ${field.min != null ? `min="${field.min}"` : ''} ${field.max != null ? `max="${field.max}"` : ''}` : '';
    control = `<input type="${type}" name="${key}" value="${escape(current)}" ${required} ${bounds}>`;
  }
  return `<label class="b-field">${escape(field.name)}${field.required ? ' (required)' : ''}${control}</label>`;
}

export function propertyForm(workspace, record, readOnly = false) {
  const fields = workspace.databases[record.database]?.fields || [];
  return `<details class="b-page-properties"><summary>Properties</summary><form id="b-page-properties" class="b-properties">
    <fieldset class="b-property-fields" ${readOnly ? 'disabled' : ''}><legend class="b-visually-hidden">Page properties</legend>
      <label class="b-field">Page title<input name="title" required maxlength="200" value="${escape(record.title)}"></label>
      <div class="b-property-grid">${fields.map(field => fieldControl(workspace, field, record.properties[field.id])).join('')}</div>
      <label class="b-field">Tags<textarea name="tags" rows="2" placeholder="One tag per line">${escape(record.tags.join('\n'))}</textarea></label>
      <p class="b-muted">One tag per line. Tags can contain spaces and commas.</p>
      <button type="submit" class="b-button">Save properties</button></fieldset>
      <p class="b-issues" data-property-error role="alert" hidden></p>
    </form></details>`;
}

export function propertyPatch(workspace, record, values) {
  const properties = {};
  for (const field of workspace.databases[record.database]?.fields || []) {
    const key = name(field), raw = values.get(key) ?? '';
    let input;
    if (field.type === 'multi-select' || field.type === 'relation' && field.cardinality === 'many') input = values.getAll(key);
    else if (raw === '') input = null;
    else if (field.type === 'number') input = Number(raw);
    else if (field.type === 'boolean') {
      if (!['true', 'false'].includes(raw)) throw new Error(`Invalid value for ${field.name}.`);
      input = raw === 'true';
    } else input = raw;
    schema.value(field, input);
    // Preserve absent/null/empty values when the form has not changed their meaning.
    const before = record.properties[field.id];
    if (input == null && before == null || Array.isArray(input) && !input.length && before == null) continue;
    properties[field.id] = input;
  }
  return { title: String(values.get('title') ?? ''), tags: [...new Set(String(values.get('tags') ?? '').split(/\r?\n/).map(tag => tag.trim()).filter(Boolean))], properties };
}
