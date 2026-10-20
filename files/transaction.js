import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import * as paths from './paths.js';
const hash = text => text === null ? null : createHash('sha256').update(text).digest('hex');

async function read(root, name) {
  try { return await fs.readFile(await paths.inside(root, name, true), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function replace(root, name, text) {
  const target = await paths.inside(root, name, true);
  const temporary = path.join(path.dirname(target), `.bento-tmp-${randomUUID()}`);
  let mode = 0o600;
  try { mode = (await fs.stat(target)).mode; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const handle = await fs.open(temporary, 'wx', mode);
  try {
    try { await handle.writeFile(text, 'utf8'); await handle.sync(); }
    finally { await handle.close(); }
    await fs.rename(temporary, target);
  } finally { await fs.rm(temporary, { force: true }); }
}
async function directory(root, name) {
  await fs.mkdir(path.join(root, name), { recursive: true });
  await paths.inside(root, name);
}
async function lock(root, operation) {
  // Validate existing components before creating anything under them.
  try { await paths.inside(root, '.bento-local'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await directory(root, '.bento-local');
  const filename = '.bento-local/write-lock.json';
  let handle;
  try { handle = await fs.open(await paths.inside(root, filename, true), 'wx', 0o600); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const held = JSON.parse(await read(root, filename));
    if (held.host !== os.hostname() || !Number.isSafeInteger(held.pid)) throw new Error('Workspace is locked by another process.', { cause: error });
    try { process.kill(held.pid, 0); throw new Error('Workspace is already being saved by another process.', { cause: error }); }
    catch (probe) { if (probe.code !== 'ESRCH') throw probe; }
    await fs.unlink(await paths.inside(root, filename));
    handle = await fs.open(await paths.inside(root, filename, true), 'wx', 0o600);
  }
  try {
    await handle.writeFile(JSON.stringify({ pid: process.pid, host: os.hostname() })); await handle.sync();
    return await operation();
  } finally { await handle.close(); await fs.unlink(await paths.inside(root, filename)); }
}
async function finish(root, journal, hook = () => {}) {
  if (journal.version !== 1 || !/^[\w-]+$/.test(journal.id) || !Array.isArray(journal.entries)) throw new Error('Invalid recovery journal.');
  // Validate all destinations before resuming any interrupted operation.
  for (const entry of journal.entries) {
    paths.relative(entry.path);
    if (!entry.path.endsWith('.md') || entry.path.startsWith('.')) throw new Error('Invalid journal destination.');
    if (typeof entry.after !== 'string' || (entry.before !== null && typeof entry.before !== 'string')) throw new Error('Invalid journal content.');
    const current = await read(root, entry.path);
    if (current !== entry.after && current !== entry.before) throw new Error(`Recovery conflict in ${entry.path}. Both versions remain in .bento-local/pending.json; no conflicting file was overwritten.`);
  }
  for (const entry of journal.entries) {
    await hook(entry);
    const current = await read(root, entry.path);
    if (current === entry.after) continue;
    if (current !== entry.before) throw new Error(`External change in ${entry.path}; save stopped. Recovery journal retained.`);
    await replace(root, entry.path, entry.after);
  }
  await directory(root, '.bento-local/history');
  await fs.rename(await paths.inside(root, '.bento-local/pending.json'), await paths.inside(root, `.bento-local/history/${journal.id}.json`, true));
}
async function recover(root) {
  const raw = await read(root, '.bento-local/pending.json').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (raw === null) return false;
  return lock(root, async () => { await finish(root, JSON.parse(raw)); return true; });
}
async function commit(root, entries, verify, hook) {
  if (!entries.length) return;
  return lock(root, async () => {
    if (await read(root, '.bento-local/pending.json') !== null) throw new Error('An earlier save needs recovery. Reload the workspace before saving.');
    await verify();
    const journal = { version: 1, id: randomUUID(), entries };
    await replace(root, '.bento-local/pending.json', JSON.stringify(journal, null, 2));
    await finish(root, journal, hook);
  });
}
export { hash, read, replace, recover, commit };
