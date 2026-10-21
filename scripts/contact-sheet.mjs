/**
 * Build an HTML contact sheet for a folder of tiles so they can be reviewed
 * and indexed by eye.
 *   node scripts/contact-sheet.mjs <dir> <out.html> [cols] [cell]
 */
import { readdirSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const [, , dir, out = 'contact-sheet.html', cols = '13', cell = '64'] = process.argv;

const abs = join(ROOT, dir);
const files = readdirSync(abs).filter((f) => f.endsWith('.png')).sort((a, b) => {
  const na = parseInt(a.match(/\d+/)?.[0] ?? '0', 10);
  const nb = parseInt(b.match(/\d+/)?.[0] ?? '0', 10);
  return na - nb || a.localeCompare(b);
});

const rel = relative(ROOT, abs).replace(/\\/g, '/');
const cells = files.map((f) => {
  const url = rel + '/' + f;
  const label = (f.match(/\d+/) || ['?'])[0];
  return `<div class="c"><img src="${url}"><span>${label}</span></div>`;
}).join('\n');

const html = `<!doctype html><meta charset="utf-8"><title>${dir}</title>
<style>
  body { background:#1b1b1b; color:#eee; font:11px ui-monospace,monospace; margin:0; padding:8px; }
  .grid { display:grid; grid-template-columns:repeat(${cols}, ${cell}px); gap:4px; }
  .c { background:#3a3a3a; padding:2px; text-align:center; }
  .c img { width:${cell}px; height:${cell}px; image-rendering:pixelated; display:block;
           background:repeating-conic-gradient(#5a5a5a 0 25%, #6a6a6a 0 50%) 0 0/${cell / 2}px ${cell / 2}px; }
  .c span { color:#ffd; }
</style>
<div class="grid">
${cells}
</div>
`;
writeFileSync(join(ROOT, out), html, 'utf8');
console.log(`${files.length} tiles -> ${out}`);
