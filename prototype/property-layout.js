// Presentation only: required validation stays on each database field.
export function validateLayout(database, layout) {
  if (!layout || typeof layout !== 'object' || Array.isArray(layout) || Object.keys(layout).some(key => !['important', 'detail'].includes(key)) || !Array.isArray(layout.important) || !Array.isArray(layout.detail)) throw new Error('Property layout needs Important and Details lists.');
  const fields = new Map(database.fields.map(field => [field.id, field]));
  const known = new Set([...fields.keys(), '$color', '$tags']);
  const seen = new Set();
  for (const group of ['important', 'detail']) for (const id of layout[group]) {
    if (typeof id !== 'string' || !known.has(id) || seen.has(id)) throw new Error('Property layout contains an unknown or duplicate field.');
    if (fields.get(id)?.required) throw new Error('Required properties are always above the fold.');
    seen.add(id);
  }
  return layout;
}

export function propertyLayout(database) {
  const authored = database.property_layout;
  if (authored !== undefined) validateLayout(database, authored);
  const layout = authored ? structuredClone(authored) : { important: [], detail: ['$color', '$tags'] };
  const assigned = new Set([...layout.important, ...layout.detail]);
  for (const field of [...database.fields, { id: '$color' }, { id: '$tags' }]) {
    if (!field.required && !assigned.has(field.id)) layout.important.push(field.id);
  }
  return { required: database.fields.filter(field => field.required).map(field => field.id), ...layout };
}

export function withPropertyLayout(workspace, databaseId, layout) {
  const database = workspace.databases[databaseId];
  if (!database) throw new Error('Choose an available database.');
  validateLayout(database, layout);
  const next = structuredClone(workspace);
  next.databases[databaseId].property_layout = structuredClone(layout);
  return next;
}
