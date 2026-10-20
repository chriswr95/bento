import './build-editor.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import { fileURLToPath } from 'node:url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const root = path.resolve(__dirname, '..');

async function copyDependency(name, from, into) {
  let entry;
  try { entry = require.resolve(name + '/package.json', { paths: [from] }); }
  catch { entry = require.resolve(name, { paths: [from] }); }
  let source = path.dirname(entry);
  while (true) {
    try { if (JSON.parse(await fs.readFile(path.join(source, 'package.json'), 'utf8')).name === name) break; } catch { /* Keep looking for the package root. */ }
    const parent = path.dirname(source); if (parent === source) throw new Error('Cannot locate runtime dependency ' + name); source = parent;
  }
  const manifest = path.join(source, 'package.json'), destination = path.join(into, 'node_modules', name);
  await fs.cp(source, destination, { recursive: true, dereference: true });
  const info = JSON.parse(await fs.readFile(manifest, 'utf8'));
  for (const dependency of Object.keys(info.dependencies || {})) await copyDependency(dependency, source, destination);
}
async function build() {
  const { packager } = await import('@electron/packager');
  const metadata = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  const staging = await fs.mkdtemp(path.join(os.tmpdir(), 'bento-package-'));
  try {
    // Build a real runtime tree, independent of the development package manager's symlinks.
    for (const name of ['desktop', 'files', 'prototype', 'templates']) await fs.cp(path.join(root, name), path.join(staging, name), { recursive: true, filter: source => !source.includes(path.sep + 'tests') });
    for (const name of Object.keys(metadata.dependencies)) await copyDependency(name, root, staging);
    const { devDependencies, scripts, packageManager, ...runtime } = metadata;
    await fs.writeFile(path.join(staging, 'package.json'), JSON.stringify(runtime, null, 2));
    const iconFile = { darwin: 'bento.icns', win32: 'bento.ico' }[process.platform];
    const output = await packager({ dir: staging, name: 'Bento', icon: iconFile ? path.join(root, 'assets', iconFile) : undefined, out: path.join(root, 'dist'), electronVersion: devDependencies.electron, platform: process.platform, arch: process.arch, overwrite: true, asar: true, prune: false });
    output.forEach(folder => console.log(folder));
  } finally { await fs.rm(staging, { recursive: true, force: true }); }
}
build().catch(error => { console.error(error); process.exitCode = 1; });
