import './vendor/marked.umd.js';

function resolvedPath(source, href) {
  if (typeof href !== 'string' || href.startsWith('/') || /[:?#\\]/.test(href)) return null;
  const parts = source.split('/').slice(0, -1);
  try {
    for (const encoded of href.split('/')) {
      const part = decodeURIComponent(encoded);
      if (/[/\\]/.test(part)) return null;
      if (part === '..') { if (!parts.length) return null; parts.pop(); }
      else if (part && part !== '.') parts.push(part);
    }
  } catch { return null; }
  return parts.join('/');
}
export function pageIndex(workspace) {
  return new Map(Object.values(workspace.records).map(page => [workspace.paths?.[page.id] || `${page.id}.md`, page.id]));
}
export function resolvePageLink(workspace, source, href, index = pageIndex(workspace)) {
  return index.get(resolvedPath(workspace.paths?.[source] || `${source}.md`, href)) || null;
}
export function backlinks(workspace, target) {
  const index = pageIndex(workspace), result = [];
  for (const page of Object.values(workspace.records)) {
    if (page.id === target) continue;
    let found = false;
    globalThis.marked.walkTokens(globalThis.marked.lexer(page.body), token => {
      if (token.type === 'link' && resolvePageLink(workspace, page.id, token.href, index) === target) found = true;
    });
    if (found) result.push(page);
  }
  return result.sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}
