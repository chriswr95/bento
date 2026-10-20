import { pageIndex, resolvePageLink } from './page-links.js';

// Hierarchy stays in parent metadata. The body contains ordinary, portable links.
export function bodyWithChildLinks(workspace, source, hrefFor, escapeLabel) {
  const page = workspace.records[source]; if (!page) return '';
  const children = Object.values(workspace.records).filter(child => child.parent === source);
  if (!children.length) return page.body;
  const index = pageIndex(workspace), linked = new Set();
  globalThis.marked.walkTokens(globalThis.marked.lexer(page.body), token => {
    if (token.type === 'link') linked.add(resolvePageLink(workspace, source, token.href, index));
  });
  const missing = children.filter(child => !linked.has(child.id)).sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  if (!missing.length) return page.body;
  const separator = !page.body ? '' : page.body.endsWith('\n\n') ? '' : page.body.endsWith('\n') ? '\n' : '\n\n';
  return page.body + separator + missing.map(child => `- [${escapeLabel(child.title)}](${hrefFor(workspace, source, child.id)})\n`).join('');
}
export function ensureChildLinks(workspace, source, hrefFor, escapeLabel) {
  const page = workspace.records[source]; if (!page) return;
  const body = bodyWithChildLinks(workspace, source, hrefFor, escapeLabel);
  if (body === page.body) return;
  if (workspace.readOnlyRecords?.includes(source)) throw new Error('The parent page is read-only. Restore its database before adding a subpage.');
  page.body = body;
}
