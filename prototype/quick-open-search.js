const normalize = value => String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
function subsequence(text, query) {
  let position = -1, gap = 0;
  for (const character of query) {
    const next = text.indexOf(character, position + 1);
    if (next === -1) return null;
    gap += next - position - 1; position = next;
  }
  return gap;
}
function score(entry, query) {
  if (!query) return entry.kind === 'command' ? 0 : 1;
  const title = normalize(entry.title);
  if (title === query) return 0;
  if (title.startsWith(query)) return 10;
  const substring = title.indexOf(query);
  if (substring !== -1) return 20 + substring / 100;
  const metadata = normalize([entry.detail, ...(entry.keywords || [])].join(' '));
  let total = 0;
  for (const term of query.split(/\s+/)) {
    if (title.includes(term)) total += 30;
    else if (metadata.includes(term)) total += 50;
    else {
      const gap = subsequence(title, term);
      if (gap === null) return null;
      total += 80 + gap / 100;
    }
  }
  return total;
}
export function searchQuickOpen(entries, input, limit = 40) {
  const commandsOnly = input.trimStart().startsWith('>');
  const query = normalize(commandsOnly ? input.trimStart().slice(1) : input).trim();
  return entries.filter(entry => entry.enabled !== false && (!commandsOnly || entry.kind === 'command'))
    .map((entry, index) => ({ entry, index, score: score(entry, query) })).filter(match => match.score !== null)
    .sort((a, b) => a.score - b.score || a.index - b.index).slice(0, limit).map(match => match.entry);
}
