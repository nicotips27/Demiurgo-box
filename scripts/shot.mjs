/**
 * Screenshot any local page with headless Edge.
 *   node scripts/shot.mjs <file-or-url> <out.png> [width] [height]
 */
import { createServer } from 'node:http';
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const [, , target, out = 'shot.png', w = '1280', h = '900'] = process.argv;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json',
};

const server = createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const file = join(ROOT, rel === '/' ? 'index.html' : rel);
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404).end('nope'); }
});
const PORT = 4321;
await new Promise((r) => server.listen(PORT, r));

const profile = join(process.env.TEMP, 'opencode', 'shot-profile');
const browser = spawn(EDGE, [
  '--headless=new', '--remote-debugging-port=9334', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  `--window-size=${w},${h}`, 'about:blank',
], { stdio: 'ignore' });
const cleanup = () => { try { browser.kill(); } catch {} server.close(); };
process.on('exit', cleanup);

async function targetWs() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:9334/json/list')).json();
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
await send('Emulation.setDeviceMetricsOverride', {
  width: Number(w), height: Number(h), deviceScaleFactor: 1, mobile: false,
});
const url = target.startsWith('http') ? target : `http://127.0.0.1:${PORT}/${target.replace(/^\//, '')}`;
await send('Page.navigate', { url });
await sleep(2500);
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
await writeFile(join(ROOT, out), Buffer.from(shot.data, 'base64'));
console.log('wrote', out);
cleanup();
process.exit(0);
