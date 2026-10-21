import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const bundle = path.join(root, 'dist', `Bento-${process.platform}-${process.arch}`);
const executable = process.platform === 'darwin' ? path.join(bundle, 'Bento.app/Contents/MacOS/Bento') : path.join(bundle, 'Bento.exe');
const result = spawnSync(process.execPath, ['tests/desktop.js', '--onboarding'], { cwd: root, stdio: 'inherit', env: { ...process.env, BENTO_PACKAGED_EXECUTABLE: executable } });
if (result.error) console.error(result.error);
process.exitCode = result.status ?? 1;
