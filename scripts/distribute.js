import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';

const run = promisify(execFile), root = fileURLToPath(new URL('../', import.meta.url));
async function distribute() {
  if (!['darwin', 'win32'].includes(process.platform)) throw new Error('Build downloads on macOS or Windows.');
  const bundle = path.join(root, 'dist', `Bento-${process.platform}-${process.arch}`);
  await fs.access(path.join(bundle, process.platform === 'darwin' ? 'Bento.app' : 'Bento.exe'));
  const output = path.join(root, 'dist/downloads'); await fs.mkdir(output, { recursive: true });
  const staging = await fs.mkdtemp(path.join(os.tmpdir(), 'bento-download-'));
  const platform = process.platform === 'darwin' ? 'macos' : 'windows';
  const name = `Bento-${platform}-${process.arch}.${process.platform === 'darwin' ? 'dmg' : 'zip'}`;
  const destination = path.join(output, name);
  try {
    if (process.platform === 'darwin') {
      await run('codesign', ['--verify', '--deep', '--strict', path.join(bundle, 'Bento.app')]);
      await run('ditto', [path.join(bundle, 'Bento.app'), path.join(staging, 'Bento.app')]);
      await fs.symlink('/Applications', path.join(staging, 'Applications'));
      await fs.copyFile(path.join(root, 'docs/install.md'), path.join(staging, 'START HERE.md'));
      await run('hdiutil', ['create', '-volname', 'Bento', '-srcfolder', staging, '-ov', '-format', 'UDZO', destination]);
      await run('hdiutil', ['verify', destination]);
    } else {
      const source = path.join(staging, 'Bento'); await fs.cp(bundle, source, { recursive: true });
      await fs.copyFile(path.join(root, 'docs/install.md'), path.join(source, 'START HERE.md'));
      await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Compress-Archive -LiteralPath $env:BENTO_ARCHIVE_SOURCE -DestinationPath $env:BENTO_ARCHIVE_OUTPUT -Force'], { env: { ...process.env, BENTO_ARCHIVE_SOURCE: source, BENTO_ARCHIVE_OUTPUT: destination } });
    }
    const digest = createHash('sha256').update(await fs.readFile(destination)).digest('hex');
    await fs.writeFile(destination + '.sha256', `${digest}  ${name}\n`);
    console.log(destination);
  } finally { await fs.rm(staging, { recursive: true, force: true }); }
}
distribute().catch(error => { console.error(error); process.exitCode = 1; });
