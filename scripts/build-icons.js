// Optional authoring step on macOS; checked-in exports make packaging cross-platform.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'assets/bento-source.png');
async function resize(size, output) {
  await run('/usr/bin/sips', ['--resampleHeightWidth', String(size), String(size), source, '--out', output]);
}
async function windowsIcon(files, output) {
  const images = await Promise.all(files.map(async ([size, file]) => ({ size, bytes: await fs.readFile(file) })));
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  for (const [index, { size, bytes }] of images.entries()) {
    const entry = 6 + index * 16;
    header[entry] = size === 256 ? 0 : size; header[entry + 1] = header[entry];
    header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(bytes.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
    offset += bytes.length;
  }
  await fs.writeFile(output, Buffer.concat([header, ...images.map(image => image.bytes)]));
}
async function build() {
  if (process.platform !== 'darwin') throw new Error('Regenerate icon exports on macOS (sips and iconutil). Normal app packaging uses the checked-in files on every platform.');
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'bento-icons-'));
  try {
    const iconset = path.join(temporary, 'bento.iconset'); await fs.mkdir(iconset);
    await fs.mkdir(path.join(root, 'prototype/assets'), { recursive: true });
    const pngs = new Map();
    for (const size of [16, 24, 32, 48, 64, 128, 256, 512, 1024]) {
      const file = path.join(temporary, `icon-${size}.png`); await resize(size, file); pngs.set(size, file);
    }
    for (const size of [16, 32, 128, 256, 512]) {
      await fs.copyFile(pngs.get(size), path.join(iconset, `icon_${size}x${size}.png`));
      await fs.copyFile(pngs.get(size * 2), path.join(iconset, `icon_${size}x${size}@2x.png`));
    }
    await run('/usr/bin/iconutil', ['--convert', 'icns', iconset, '--output', path.join(root, 'assets/bento.icns')]);
    await windowsIcon([16, 24, 32, 48, 64, 128, 256].map(size => [size, pngs.get(size)]), path.join(root, 'assets/bento.ico'));
    await fs.copyFile(pngs.get(512), path.join(root, 'assets/bento.png'));
    for (const size of [32, 64, 256]) await fs.copyFile(pngs.get(size), path.join(root, `prototype/assets/bento-${size}.png`));
    console.log('Exported macOS ICNS, multi-size Windows ICO, Linux PNG, and browser/header PNGs.');
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}
build().catch(error => { console.error(error); process.exitCode = 1; });
