import path from 'node:path';
import { fromMarkdown } from 'mdast-util-from-markdown';

function destination(source, node) {
  let index = node.position.start.offset;
  if (source[index] === '!') index++;
  if (source[index] !== '[') throw new Error('Cannot locate Markdown link label.');
  let depth = 1; index++;
  while (depth && index < node.position.end.offset) {
    const char = source[index++];
    if (char === '\\') index++;
    else if (char === '`') {
      let ticks = 1; while (source[index] === '`') { ticks++; index++; }
      const end = source.indexOf('`'.repeat(ticks), index); if (end >= 0 && end < node.position.end.offset) index = end + ticks;
    } else if (char === '[') depth++;
    else if (char === ']') depth--;
  }
  if (source[index++] !== (node.type === 'definition' ? ':' : '(')) throw new Error('Cannot locate Markdown link destination.');
  while (/\s/.test(source[index] || '') && index < node.position.end.offset) {
    if (source[index++] === '\n') {
      // AST offsets include blockquote prefixes on continuation lines.
      while (source[index] === ' ' || source[index] === '\t') index++;
      while (source[index] === '>') {
        index++;
        while (source[index] === ' ' || source[index] === '\t') index++;
      }
    }
  }
  const angle = source[index] === '<'; if (angle) index++;
  const start = index; depth = 0;
  while (index < node.position.end.offset) {
    const char = source[index];
    if (char === '\\') { index += 2; continue; }
    if (angle ? char === '>' : /\s/.test(char) || char === ')' && !depth) break;
    if (char === '(') depth++;
    else if (char === ')') depth--;
    index++;
  }
  return { start, end: index };
}
function rebased(url, before, after, moved) {
  if (!url || url.startsWith('#') || url.startsWith('/') || /^[a-z][a-z\d+.-]*:/i.test(url)) return null;
  const [, pathname, suffix = ''] = /^([^?#]*)([\s\S]*)$/.exec(url);
  if (!pathname) return null;
  let decoded; try { decoded = decodeURIComponent(pathname); } catch { throw new Error('Repair the malformed Markdown link before moving this page.'); }
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(before), decoded));
  if (target === '..' || target.startsWith('../')) return null;
  if (before === after && !moved.has(target)) return null;
  const directory = decoded.endsWith('/') || ['.', '..'].includes(decoded);
  let relative = path.posix.relative(path.posix.dirname(after), moved.get(target) || target);
  if (directory) relative = relative ? relative + '/' : './';
  else relative ||= path.posix.basename(target);
  return relative.split('/').map(part => encodeURIComponent(part).replace(/[!'()*]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase())).join('/') + suffix;
}
// Edit only destination spans. Labels, titles, references, code and unrelated bytes survive.
export function moveLinks(source, before, after, moved) {
  const edits = [];
  function visit(node) {
    if (['link', 'image', 'definition'].includes(node.type)) {
      const value = rebased(node.url, before, after, moved);
      if (value !== null && value !== node.url) edits.push({ ...destination(source, node), value });
    }
    for (const child of node.children || []) visit(child);
  }
  visit(fromMarkdown(source));
  for (const edit of edits.sort((a, b) => b.start - a.start)) source = source.slice(0, edit.start) + edit.value + source.slice(edit.end);
  return source;
}
