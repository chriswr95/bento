import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
await build({ entryPoints: [fileURLToPath(new URL('../prototype/rich-editor.js', import.meta.url))], outfile: fileURLToPath(new URL('../prototype/vendor/rich-editor.js', import.meta.url)), bundle: true, format: 'esm', platform: 'browser', target: 'chrome120', legalComments: 'eof', logOverride: { 'commonjs-variable-in-esm': 'silent' } });
