/**
 * Build the world sprite atlas.
 *
 * Composites the chosen CC0 tiles into a single PNG plus a JSON manifest, so
 * the runtime loads one image and draws sub-rectangles from it instead of
 * juggling 125 separate files.
 *
 * The compositing runs in headless Edge (a canvas is the only image
 * processor available without native dependencies).
 *
 *   node scripts/build-atlas.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const WEB_ROOT = join(ROOT, 'public');
const OUT_DIR = join(WEB_ROOT, 'assets');
mkdirSync(OUT_DIR, { recursive: true });

const ISHTAR = 'art-src/top-down-pack-1/tiles';
const WATER = 'art-src/water-sand-grass-16x16-cc0.png';
const TILE = 16;

/** name -> { file, cell } */
export const TILES = {
  // ── terrain ────────────────────────────────────────────────────────────
  'grass.0':  { file: `${ISHTAR}/Slice 98.png` },
  'grass.1':  { file: `${ISHTAR}/Slice 99.png` },
  'grass.2':  { file: `${ISHTAR}/Slice 100.png` },
  'grass.3':  { file: `${ISHTAR}/Slice 101.png` },
  'grass.4':  { file: `${ISHTAR}/Slice 102.png` },
  'grass.flower': { file: `${ISHTAR}/Slice 101.png` },
  'sand.0':   { file: `${ISHTAR}/Slice 66.png` },
  'sand.1':   { file: `${ISHTAR}/Slice 67.png` },
  'sand.2':   { file: `${ISHTAR}/Slice 68.png` },
  'sand.3':   { file: `${ISHTAR}/Slice 69.png` },
  'stone.0':  { file: `${ISHTAR}/Slice 70.png` },
  'stone.1':  { file: `${ISHTAR}/Slice 71.png` },
  'stone.2':  { file: `${ISHTAR}/Slice 72.png` },
  'stone.3':  { file: `${ISHTAR}/Slice 73.png` },
  'stone.4':  { file: `${ISHTAR}/Slice 74.png` },
  'stone.5':  { file: `${ISHTAR}/Slice 75.png` },
  'stone.6':  { file: `${ISHTAR}/Slice 76.png` },
  'stone.7':  { file: `${ISHTAR}/Slice 77.png` },
  'stone.8':  { file: `${ISHTAR}/Slice 78.png` },
  'stone.9':  { file: `${ISHTAR}/Slice 79.png` },
  'gold.0':   { file: `${ISHTAR}/Slice 93.png` },
  'gold.1':   { file: `${ISHTAR}/Slice 92.png` },
  'gem.green': { file: `${ISHTAR}/Slice 86.png` },
  'gem.blue':  { file: `${ISHTAR}/Slice 87.png` },
  'gem.red':   { file: `${ISHTAR}/Slice 91.png` },
  'gem.gold':  { file: `${ISHTAR}/Slice 93.png` },

  // water (4 animation frames) — from the CC0 water/sand/grass autotile
  'water.0':  { file: WATER, cell: 0 },
  'water.1':  { file: WATER, cell: 26 },
  'water.2':  { file: WATER, cell: 27 },
  'water.3':  { file: WATER, cell: 30 },

  // ── props ──────────────────────────────────────────────────────────────
  'tree.green':  { file: `${ISHTAR}/Slice 80.png` },
  'tree.red':    { file: `${ISHTAR}/Slice 81.png` },
  'tree.orange': { file: `${ISHTAR}/Slice 82.png` },
  'trunk.0':     { file: `${ISHTAR}/Slice 9.png` },
  'trunk.1':     { file: `${ISHTAR}/Slice 10.png` },
  'rock.0':      { file: `${ISHTAR}/Slice 7.png` },
  'rock.1':      { file: `${ISHTAR}/Slice 8.png` },
  'rock.2':      { file: `${ISHTAR}/Slice 27.png` },
  'rock.3':      { file: `${ISHTAR}/Slice 28.png` },
  'stump':       { file: `${ISHTAR}/Slice 119.png` },
  'mushroom.0':  { file: `${ISHTAR}/Slice 124.png` },
  'mushroom.1':  { file: `${ISHTAR}/Slice 125.png` },
  'mushroom.2':  { file: `${ISHTAR}/Slice 121.png` },
  'mushroom.3':  { file: `${ISHTAR}/Slice 120.png` },
  'tuft.0':      { file: `${ISHTAR}/Slice 95.png` },
  'tuft.1':      { file: `${ISHTAR}/Slice 96.png` },
  'pebble.0':    { file: `${ISHTAR}/Slice 32.png` },

  // ── characters ─────────────────────────────────────────────────────────
  'human.0':     { file: `${ISHTAR}/Slice 6.png` },
  'human.1':     { file: `${ISHTAR}/Slice 6.png` },
  'zombie.0':    { file: `${ISHTAR}/Slice 83.png` },
  'zombie.1':    { file: `${ISHTAR}/Slice 84.png` },
  'zombie.2':    { file: `${ISHTAR}/Slice 85.png` },
};

const names = Object.keys(TILES);
const COLS = 12;
const ROWS = Math.ceil(names.length / COLS);

// ── the page that does the compositing ───────────────────────────────────
const page = `<!doctype html><meta charset="utf-8"><body><script>
const TILES = ${JSON.stringify(TILES)};
const TILE = ${TILE}, COLS = ${COLS}, ROWS = ${ROWS};
const names = Object.keys(TILES);
(async () => {
  const files = [...new Set(Object.values(TILES).map(t => t.file))];
  const images = {};
  await Promise.all(files.map(f => new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => { images[f] = i; res(); };
    i.onerror = () => rej(new Error('failed to load ' + f));
    i.src = encodeURI('/' + f);
  })));
  const c = document.createElement('canvas');
  c.width = COLS * TILE; c.height = ROWS * TILE;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const manifest = {};
  names.forEach((n, i) => {
    const t = TILES[n];
    const img = images[t.file];
    const sx = t.cell !== undefined ? (t.cell % 10) * TILE : 0;
    const sy = t.cell !== undefined ? Math.floor(t.cell / 10) * TILE : 0;
    const dx = (i % COLS) * TILE, dy = Math.floor(i / COLS) * TILE;
    g.drawImage(img, sx, sy, TILE, TILE, dx, dy, TILE, TILE);
    manifest[n] = { x: dx, y: dy, w: TILE, h: TILE };
  });
  window.__atlas = { png: c.toDataURL('image/png'), manifest };
  window.__done = true;
})().catch(e => { window.__error = String(e && e.message || e); window.__done = true; });
</script></body>`;

writeFileSync(join(ROOT, 'atlas-build.html'), page, 'utf8');

// ── run it in headless Edge ───────────────────────────────────────────────
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const file = join(ROOT, rel === '/' ? 'index.html' : rel);
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404).end('nope'); }
});
const PORT = 4322;
await new Promise((r) => server.listen(PORT, r));

const profile = join(process.env.TEMP, 'opencode', 'atlas-profile');
const browser = spawn(EDGE, [
  '--headless=new', '--remote-debugging-port=9335', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  'about:blank',
], { stdio: 'ignore' });
const cleanup = () => { try { browser.kill(); } catch {} server.close(); };
process.on('exit', cleanup);

async function targetWs() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:9335/json/list')).json();
      const p = list.find((t) => t.type === 'page');
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch { /* waiting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('no debugging target');
}

const ws = new WebSocket(await targetWs());
await new Promise((r) => { ws.onopen = r; });
let nextId = 1;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    return;
  }
  if (m.method === 'Runtime.consoleAPICalled') {
    console.log('  [page]', m.params.args.map((a) => a.value ?? a.description).join(' '));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    console.log('  [page error]', m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/atlas-build.html` });
await sleep(1200);
const probe = await send('Runtime.evaluate', {
  expression: 'JSON.stringify({ url: location.href, done: !!window.__done, err: window.__error || null, imgs: document.images.length, body: document.body ? document.body.innerHTML.length : -1 })',
  returnByValue: true,
});
console.log('  [probe]', probe.result?.value);
let result = null;
for (let i = 0; i < 80; i++) {
  await sleep(250);
  const r = await send('Runtime.evaluate', { expression: 'window.__done ? JSON.stringify(window.__atlas || { error: window.__error }) : null', returnByValue: true });
  if (r.result?.value) { result = JSON.parse(r.result.value); break; }
}
if (!result) { console.error('atlas build timed out'); cleanup(); process.exit(1); }
if (result.error) { console.error('atlas build failed:', result.error); cleanup(); process.exit(1); }

const png = Buffer.from(result.png.split(',')[1], 'base64');
writeFileSync(join(OUT_DIR, 'world-atlas.png'), png);
writeFileSync(join(OUT_DIR, 'world-atlas.json'), JSON.stringify(result.manifest, null, 1), 'utf8');
console.log(`atlas: ${names.length} tiles, ${COLS * TILE}x${ROWS * TILE}px, ${(png.length / 1024).toFixed(1)} KB`);
cleanup();
process.exit(0);
