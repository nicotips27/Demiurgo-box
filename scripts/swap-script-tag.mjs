/**
 * Replaces the monolithic inline <script> in index.html with a module script
 * tag pointing at src/main.ts.
 *
 * Idempotent: if the inline script is already gone, it does nothing.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = join(ROOT, 'index.html');

const html = readFileSync(INDEX, 'utf8');
const lines = html.split(/\r?\n/);

const openIdx = lines.findIndex((l) => l.trim() === '<script>');
if (openIdx < 0) {
  console.log('inline <script> already removed — nothing to do');
  process.exit(0);
}
const closeIdx = lines.findIndex((l, i) => i > openIdx && l.trim() === '</script>');
if (closeIdx < 0) throw new Error('closing </script> not found');

const out = [
  ...lines.slice(0, openIdx),
  '    <script type="module" src="/src/main.ts"></script>',
  ...lines.slice(closeIdx + 1),
];

writeFileSync(INDEX, out.join('\n'), 'utf8');
console.log(`replaced inline script (lines ${openIdx + 1}..${closeIdx + 1}) with a module tag`);
console.log(`index.html is now ${out.length} lines`);
