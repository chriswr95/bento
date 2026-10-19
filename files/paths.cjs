const fs = require('node:fs/promises');
const path = require('node:path');

function relative(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes(':') || value.includes('\0') || path.posix.isAbsolute(value)) throw new Error('Expected a relative workspace path.');
  const segments = value.split('/');
  if (segments.some(part => !part || part === '.' || part === '..' || /[<>"|?*]|[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw new Error('Invalid portable workspace path.');
  return value;
}
async function inside(root, value, allowMissing = false) {
  const safe = relative(value), parts = safe.split('/');
  let cursor = root;
  for (let index = 0; index < parts.length; index++) {
    cursor = path.join(cursor, parts[index]);
    try {
      const stat = await fs.lstat(cursor);
      if (stat.isSymbolicLink()) throw new Error(`Symbolic links are not supported: ${safe}`);
      if (index < parts.length - 1 && !stat.isDirectory()) throw new Error(`Not a directory: ${safe}`);
    } catch (error) {
      if (error.code !== 'ENOENT' || !allowMissing || index !== parts.length - 1) throw error;
    }
  }
  return cursor;
}
async function walk(root, directory = '', results = []) {
  const location = directory ? await inside(root, directory) : root;
  for (const entry of (await fs.readdir(location, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const item = directory ? `${directory}/${entry.name}` : entry.name;
    relative(item);
    if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not supported: ${item}`);
    if (entry.isDirectory()) await walk(root, item, results);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) results.push(item);
  }
  return results;
}
module.exports = { relative, inside, walk };
