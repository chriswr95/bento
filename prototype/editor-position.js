/* Map a clicked visible text run to source only when its location is unambiguous. */
export function sourceCaret(source, text, offset) {
  if (!text || !Number.isInteger(offset) || offset < 0 || offset > text.length) return source.length;
  if (/&(?:#\d+|#x[\da-f]+|[a-z]+);/i.test(source)) return source.length;
  const start = source.indexOf(text);
  if (start < 0 || source.indexOf(text, start + 1) !== -1) return source.length;
  return start + offset;
}
