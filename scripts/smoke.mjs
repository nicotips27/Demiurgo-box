/**
 * Smoke test: boots the game in headless Edge, drives it into a live
 * world, captures console errors and a screenshot.
 *
 *   node scripts/smoke.mjs              # against the local dist/ build
 *   node scripts/smoke.mjs <url>        # against a deployed site
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 4319;
const DEBUG_PORT = 9333;

/** When a URL is given we test that; otherwise we serve the local build. */
const TARGET = process.argv[2] || null;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.json': 'application/json',
};

// ── static server ──────────────────────────────────────────────────────────
let server = null;
if (!TARGET) {
  server = createServer(async (req, res) => {
    try {
      const url = req.url.split('?')[0];
      const rel = url === '/' ? '/index.html' : url;
      const file = join(DIST, decodeURIComponent(rel));
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  await new Promise((r) => server.listen(PORT, r));
}
const siteUrl = TARGET || `http://127.0.0.1:${PORT}/`;

// ── headless browser ───────────────────────────────────────────────────────
const profile = join(process.env.TEMP, 'opencode', 'smoke-profile');
const browser = spawn(EDGE, [
  '--headless=new',
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=1280,720',
  'about:blank',
], { stdio: 'ignore' });

const cleanup = () => { try { browser.kill(); } catch {} if (server) server.close(); };
process.on('exit', cleanup);

async function targetWs() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('browser did not expose a debugging target');
}

const ws = new WebSocket(await targetWs());
await new Promise((r) => { ws.onopen = r; });

let nextId = 1;
const pending = new Map();
const consoleErrors = [];
const pageErrors = [];

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    return;
  }
  if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
    consoleErrors.push(`[${msg.params.type}] ` + msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '));
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    pageErrors.push(d.exception?.description || d.text);
  }
  if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
    consoleErrors.push(`[log] ${msg.params.entry.text} ${msg.params.entry.url || ''}`);
  }
};

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
});

const url = siteUrl;
console.log('navigating to', url);
await send('Page.navigate', { url });
await sleep(3500);

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed');
  return r.result.value;
}

// Did the module graph load? The window bridge only exists if main.ts ran.
const bridgeOk = await evaluate('typeof window.launchGame === "function"');
console.log('module graph loaded (window.launchGame present):', bridgeOk);

// Drive the menu: open the map picker, then start a world.
await evaluate('window.openModal("map-selector"); true');
await sleep(400);
await evaluate('window.launchGame(); true');
await sleep(4000);

const state = await evaluate(`(() => {
  const c = document.getElementById('gameCanvas');
  const ctx = c.getContext('2d');
  const d = ctx.getImageData(0, 0, Math.min(c.width, 400), Math.min(c.height, 300)).data;
  let nonBlack = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] + d[i+1] + d[i+2] > 30) nonBlack++;
  }
  return {
    canvas: c.width + 'x' + c.height,
    nonBlackPixels: nonBlack,
    menuVisible: getComputedStyle(document.getElementById('main-menu')).opacity,
    uiLayer: getComputedStyle(document.getElementById('ui-layer')).display,
  };
})()`);
console.log('state:', state);

const shot = await send('Page.captureScreenshot', { format: 'png' });
const { writeFile } = await import('node:fs/promises');
await writeFile(join(ROOT, 'smoke.png'), Buffer.from(shot.data, 'base64'));
console.log('screenshot -> smoke.png');

// A second shot with the HUD hidden, so the world itself can be judged.
await evaluate('document.getElementById("ui-layer").style.display = "none"; true');
await sleep(400);
const shot2 = await send('Page.captureScreenshot', { format: 'png' });
await writeFile(join(ROOT, 'smoke-world.png'), Buffer.from(shot2.data, 'base64'));
console.log('screenshot -> smoke-world.png');

console.log('\n--- console errors (' + consoleErrors.length + ') ---');
consoleErrors.slice(0, 25).forEach((e) => console.log(e));
console.log('--- page exceptions (' + pageErrors.length + ') ---');
pageErrors.slice(0, 25).forEach((e) => console.log(e));

const ok = bridgeOk && state.nonBlackPixels > 1000 && pageErrors.length === 0;
console.log('\nRESULT:', ok ? 'PASS' : 'FAIL');
cleanup();
process.exit(ok ? 0 : 1);
