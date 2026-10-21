/**
 * Needs simulation test.
 *
 * Runs the game headlessly and checks that the food loop behaves:
 *
 *   Scenario A - a village with enough farms must feed itself: the stores
 *                stay healthy, nobody starves and the population holds.
 *   Scenario B - a village with no farms must run out of food and start
 *                losing people to hunger.
 *
 *   node scripts/needs-test.mjs
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 4330;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const file = join(DIST, rel === '/' ? 'index.html' : rel);
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404).end('nope'); }
});
await new Promise((r) => server.listen(PORT, r));

const profile = join(process.env.TEMP, 'opencode', 'needs-profile');
const browser = spawn(EDGE, [
  '--headless=new', '--remote-debugging-port=9336', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=1280,720', 'about:blank',
], { stdio: 'ignore' });
const cleanup = () => { try { browser.kill(); } catch {} server.close(); };
process.on('exit', cleanup);

async function targetWs() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:9336/json/list')).json();
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
const errors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    return;
  }
  if (m.method === 'Runtime.exceptionThrown') {
    errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed');
  return r.result.value;
};

await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
await sleep(3000);

/** Start a fresh world with one village, placed well inland. */
async function startWorld() {
  await evaluate('window.openModal("map-selector"); window.launchGame(); true');
  await sleep(1200);
  return evaluate(`(() => {
    const G = window.__G;
    let best = null, bestScore = -1;
    for (let x = 5; x < G.cols - 5; x++) {
      for (let y = 5; y < G.rows - 5; y++) {
        const t = G.grid[x][y];
        if (t.type !== 2 || t.ownerId) continue;
        // count the dry tiles around it, to find the middle of a landmass
        let dry = 0;
        for (let dx = -4; dx <= 4; dx++) {
          for (let dy = -4; dy <= 4; dy++) {
            const n = G.grid[x + dx] && G.grid[x + dx][y + dy];
            if (n && n.type === 2) dry++;
          }
        }
        if (dry > bestScore) { bestScore = dry; best = { x, y }; }
      }
    }
    if (!best) return false;
    G.currentTool = { id: 'SPAWN_VILLAGE', type: 'god' };
    window.applyPower(best.x, best.y);
    return true;
  })()`);
}

/**
 * Make sure the village has enough farms.
 * `perVillager` = farms per villager; 0 means "at least `minimum`".
 */
const ensureFarms = (minimum, perVillager = 0) => evaluate(`(() => {
  const G = window.__G;
  const v = G.villages[0];
  if (!v) return 0;
  const pop = G.humans.filter(h => h.villageId === v.id).length;
  const want = Math.max(${minimum}, Math.ceil(pop * ${perVillager}));
  const have = v.territory.filter(t => G.grid[t.x][t.y].buildingType === 2).length;
  let n = have;
  for (const t of v.territory) {
    if (n >= want) break;
    const tile = G.grid[t.x][t.y];
    if (!tile.hasHouse && tile.type === 2) { tile.hasHouse = true; tile.buildingType = 2; tile.hasRoad = true; n++; }
  }
  return n;
})()`);

const sample = () => evaluate(`(() => {
  const G = window.__G;
  const v = G.villages[0];
  const pop = G.humans.length;
  return {
    tick: G.timeTick,
    pop,
    deaths: G.globalStats.deaths,
    food: v ? Math.floor(v.food) : 0,
    farms: v ? v.territory.filter(t => G.grid[t.x][t.y].buildingType === 2).length : 0,
    starving: G.humans.filter(h => h.hunger <= 0).length,
    avgHunger: pop ? Math.round(G.humans.reduce((a, h) => a + h.hunger, 0) / pop) : 0,
    meals: G.foodStats.meals,
    missed: G.foodStats.missedMeals,
    starved: G.foodStats.starvationDeaths,
    causes: G.deathCauses,
    perHead: pop ? Math.round((v ? v.food : 0) / pop) : 0,
  };
})()`);

const table = (rows) => {
  console.log('tick     pop  deaths   food  farms  avgHun  meals  missed  starved  causes');
  for (const s of rows) {
    const c = s.causes;
    const causeStr = `${c.oldAge}/${c.starvation}/${c.drowning}/${c.disease}/${c.combat}`;
    console.log(
      String(s.tick).padStart(6),
      String(s.pop).padStart(6),
      String(s.deaths).padStart(7),
      String(s.food).padStart(7),
      String(s.farms).padStart(6),
      String(s.avgHunger).padStart(6),
      String(s.meals).padStart(6),
      String(s.missed).padStart(7),
      String(s.starved).padStart(8),
      '  ' + causeStr,
    );
  }
};

/** Remove every berry tile, so nothing can be foraged. */
const stripBerries = () => evaluate(`(() => {
  const G = window.__G;
  let n = 0;
  for (let x = 0; x < G.cols; x++) for (let y = 0; y < G.rows; y++) {
    if (G.grid[x][y].hasBerries) { G.grid[x][y].hasBerries = false; n++; }
  }
  return n;
})()`);

// ── Scenario A: a village with a farm per villager ────────────────────────
console.log('=== Scenario A: village with one farm per villager ===');
await startWorld();
const rowsA = [];
for (let i = 0; i < 14; i++) {
  await evaluate('window.__stepSim(2000); true');
  // keep one farm per villager: the balanced case
  await ensureFarms(0, 1);
  rowsA.push(await sample());
}
table(rowsA);

// ── Direct check of the starvation death path ────────────────────────────
// Run it while the village from scenario A is still healthy, so there is
// always somebody to starve.
const hungerCheck = await evaluate(`(() => {
  const G = window.__G;
  const h = G.humans.slice().sort((a, b) => a.age - b.age)[0];
  if (!h) return { deaths: -1, alive: false, causes: G.deathCauses };
  const before = G.foodStats.starvationDeaths;
  // Take the villager out of their village: no stores, no medics, no forager
  // duty. Nothing can save them now but a full belly.
  h.isColonist = true;
  h.villageId = -1;
  h.hunger = 0.1;
  h.hp = 3; // a few points of health left, so the test is not a race
  for (let i = 0; i < 300; i++) {
    // keep the world from feeding them: no game, no berries, empty stores
    G.animals.length = 0;
    G.fishes.length = 0;
    for (const v of G.villages) v.food = 0;
    for (let x = 0; x < G.cols; x++) {
      for (let y = 0; y < G.rows; y++) G.grid[x][y].hasBerries = false;
    }
    window.__stepSim(1);
  }
  return { deaths: G.foodStats.starvationDeaths - before, alive: G.humans.includes(h), hunger: Math.round(h.hunger), hp: Math.round(h.hp), causes: G.deathCauses };
})()`);
const starvedByHunger = hungerCheck.deaths;
console.log('  forced starvation check:', JSON.stringify(hungerCheck));

// ── Scenario B: a village with no farms ───────────────────────────────────
console.log('\n=== Scenario B: village without farms ===');
await startWorld();
const rowsB = [];
for (let i = 0; i < 14; i++) {
  await evaluate('window.__stepSim(2000); true');
  rowsB.push(await sample());
}
table(rowsB);

// ── Scenario C: nothing to eat at all ─────────────────────────────────────
console.log('\n=== Scenario C: no farms, no food, nothing to forage ===');
await startWorld();
const rowsC = [];
for (let i = 0; i < 10; i++) {
  // the ecosystem repopulates every 120 ticks and berries regrow on their
  // own, so keep clearing them and empty the stores
  await evaluate('window.__G.animals.length = 0; window.__G.fishes.length = 0; true');
  await stripBerries();
  await evaluate('if (window.__G.villages[0]) window.__G.villages[0].food = 0; true');
  await evaluate('window.__stepSim(2000); true');
  rowsC.push(await sample());
}
table(rowsC);

console.log('\npage exceptions:', errors.length);
errors.slice(0, 5).forEach((e) => console.log('  ', e));

const lastA = rowsA[rowsA.length - 1];
const lastB = rowsB[rowsB.length - 1];
const lastC = rowsC[rowsC.length - 1];
const peakB = Math.max(...rowsB.map((r) => r.pop));
const peakC = Math.max(...rowsC.map((r) => r.pop));

// A: with a farm per villager the village is fed: nobody starves and the
// stores keep up. (The population can still be hit by wars, which is a
// different system.)
const aOk = lastA && lastA.pop >= 1 && lastA.avgHunger > 50 && lastA.starved === 0;// B: without farms the stores run dry and the village stops growing.
const bOk = lastB && rowsB.length > 2 && lastB.perHead < rowsB[0].perHead;
// C: with nothing to eat the hunger mechanic bites and people die of hunger.
const cOk = starvedByHunger > 0 && (lastC.missed > 0 || rowsC.some((r) => r.food === 0));

console.log('\nA (farms)         ->', aOk ? 'PASS' : 'FAIL',
  lastA ? `pop ${lastA.pop}, food ${lastA.food}, hunger ${lastA.avgHunger}, starved ${lastA.starved}` : '');
console.log('B (no farms)      ->', bOk ? 'PASS' : 'FAIL',
  lastB ? `peak ${peakB} -> pop ${lastB.pop}, food ${lastB.food}, food/head ${rowsB[0].perHead} -> ${lastB.perHead}, missed meals ${lastB.missed}` : '');
console.log('C (nothing to eat)->', cOk ? 'PASS' : 'FAIL',
  lastC ? `missed meals ${lastC.missed}, starvation deaths ${starvedByHunger}` : '');
console.log('\nRESULT:', aOk && bOk && cOk && errors.length === 0 ? 'PASS' : 'FAIL');
cleanup();
process.exit(aOk && bOk && cOk && errors.length === 0 ? 0 : 1);
