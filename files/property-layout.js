import * as markdown from './markdown.js';
import { definitionPath } from './database-definitions.js';
import { validateLayout } from '../prototype/property-layout.js';

export function propertyLayoutPlan(repository, databaseId, layout) {
  const database = repository.workspace.databases[databaseId];
  if (!database) throw new Error('Choose an available database.');
  validateLayout(database, layout);
  const entry = repository.info.databases.find(entry => entry.id === databaseId);
  const filename = definitionPath(entry), before = repository.files.get(filename);
  const parsed = markdown.parse(before);
  // Update the authored definition, preserving comments, unknown metadata and body.
  const after = markdown.serialize({ ...parsed.metadata, property_layout: layout, body: parsed.body }, before);
  return { entries: before === after ? [] : [{ path: filename, before, after }] };
}
