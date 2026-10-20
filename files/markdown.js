import YAML from 'yaml';
import { isDeepStrictEqual } from 'node:util';
import schema from '../prototype/schema.js';

function parse(raw) {
  const match = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---[\t ]*(?:\r?\n|$)/.exec(raw);
  if (!match) return { metadata: {}, body: raw, document: new YAML.Document(), raw, envelope: false };
  const document = YAML.parseDocument(match[1], { version: '1.2', strict: true, uniqueKeys: true, stringKeys: true, customTags: [] });
  if (document.errors.length || document.warnings.length) throw new Error([...document.errors, ...document.warnings].map(error => error.message).join('\n'));
  const metadata = document.toJS({ maxAliasCount: 0 });
  if (!schema.object(metadata)) throw new Error('Frontmatter must be a mapping.');
  if (metadata.bento_version !== undefined && metadata.bento_version !== 1) throw new Error('Unsupported Markdown envelope version.');
  return { metadata, body: raw.slice(match[0].length), document, raw, envelope: true };
}

function updateMap(document, path, before, after) {
  if (isDeepStrictEqual(before, after)) return;
  if (schema.object(before) && schema.object(after)) {
    for (const key of Object.keys(before)) if (!Object.hasOwn(after, key)) document.deleteIn([...path, key]);
    for (const [key, value] of Object.entries(after)) updateMap(document, [...path, key], before[key], value);
  } else document.setIn(path, after);
}

function serialize(record, original) {
  const parsed = parse(original || '');
  const { body, ...metadata } = record;
  const next = { ...parsed.metadata, ...metadata, bento_version: 1 };
  // Membership is derived from the enclosing registered database folder.
  delete next.database;
  updateMap(parsed.document, [], parsed.metadata, next);
  const eol = original?.includes('\r\n') ? '\r\n' : '\n';
  const header = parsed.document.toString({ lineWidth: 0 }).replace(/\r?\n/g, eol);
  const content = body.replace(/\r\n?/g, '\n').replace(/\n/g, eol);
  return `${original?.startsWith('\uFEFF') ? '\uFEFF' : ''}---${eol}${header}---${eol}${content}`;
}
export { parse, serialize };
