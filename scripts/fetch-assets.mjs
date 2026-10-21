/**
 * Download a CC0 asset pack into public/assets/ and list its contents.
 *   node scripts/fetch-assets.mjs <url> <targetName>
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'assets');
mkdirSync(OUT, { recursive: true });

const [, , url, name] = process.argv;
if (!url || !name) {
  console.error('usage: node scripts/fetch-assets.mjs <url> <name>');
  process.exit(1);
}

const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
if (!r.ok) { console.error(`${r.status} ${r.statusText} for ${url}`); process.exit(1); }
const buf = Buffer.from(await r.arrayBuffer());
const file = join(OUT, name);
writeFileSync(file, buf);
console.log(`saved ${name} (${(buf.length / 1024).toFixed(1)} KB)`);

if (name.endsWith('.zip')) {
  try {
    const out = execFileSync('tar', ['-tf', file], { cwd: OUT, maxBuffer: 16 * 1024 * 1024 }).toString();
    console.log(out.split('\n').filter(Boolean).join('\n'));
  } catch (e) {
    console.log('(could not list the zip:', e.message, ')');
  }
}
