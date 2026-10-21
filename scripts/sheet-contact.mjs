/**
 * Build an HTML contact sheet from a single tileset image, sliced into a
 * grid, so each tile can be reviewed and indexed by eye.
 *   node scripts/sheet-contact.mjs <png> <out.html> [cols] [tileSize] [cell]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const [, , png, out = 'sheet.html', cols = '8', tile = '16', cell = '64'] = process.argv;

const buf = readFileSync(join(ROOT, png));
const w = buf.readUInt32BE(16);
const h = buf.readUInt32BE(20);
const tw = Number(tile);
const nCols = Number(cols);
const nRows = Math.ceil(h / tw);

const rel = relative(ROOT, join(ROOT, png)).replace(/\\/g, '/');
const cells = [];
for (let r = 0; r < nRows; r++) {
  for (let c = 0; c < nCols; c++) {
    const sx = c * tw, sy = r * tw;
    if (sx >= w) continue;
    const sw = Math.min(tw, w - sx), sh = Math.min(tw, h - sy);
    const i = r * nCols + c;
    cells.push(
      `<div class="c"><div class="t" style="background-image:url('${rel}');` +
      `background-position:${-sx * (cell / tw)}px ${-sy * (cell / tw)}px;` +
      `background-size:${w * (cell / tw)}px ${h * (cell / tw)}px"></div><span>${i}</span></div>`
    );
  }
}

const html = `<!doctype html><meta charset="utf-8"><title>${png}</title>
<style>
  body { background:#1b1b1b; color:#eee; font:11px ui-monospace,monospace; margin:0; padding:8px; }
  .grid { display:grid; grid-template-columns:repeat(${nCols}, ${cell}px); gap:4px; }
  .c { background:#3a3a3a; padding:2px; text-align:center; }
  .t { width:${cell}px; height:${cell}px; image-rendering:pixelated; }
  .c span { color:#ffd; }
</style>
<div class="grid">
${cells.join('\n')}
</div>
`;
writeFileSync(join(ROOT, out), html, 'utf8');
console.log(`${png} is ${w}x${h} -> ${nCols}x${nRows} grid of ${tw}px tiles (${cells.length} cells) -> ${out}`);
