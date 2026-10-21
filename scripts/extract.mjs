/**
 * Phase 0 extraction tool.
 * Slices the monolithic inline <script> of index.html into src/ modules.
 * Idempotent-ish: always reads from index.html, never edits it except for the
 * script-tag swap, which it performs only if the inline script is still present.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = join(ROOT, 'index.html');

/**
 * The monolith used to live inline in index.html. It has since been split
 * into src/, so the original is recovered from git when the inline script is
 * no longer there. This keeps the split reproducible.
 */
function readSource() {
  const html = readFileSync(INDEX, 'utf8');
  if (/<script>\s*\n/.test(html)) return html;
  try {
    return execFileSync('git', ['show', 'HEAD:index.html'], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
      .toString('utf8');
  } catch (e) {
    throw new Error('no inline <script> in index.html and git history is unavailable: ' + e.message);
  }
}

const html = readSource();
const lines = html.split(/\r?\n/);

// Locate the inline script block.
const openIdx = lines.findIndex((l) => l.trim() === '<script>');
const closeIdx = lines.findIndex((l, i) => i > openIdx && l.trim() === '</script>');
if (openIdx < 0 || closeIdx < 0) throw new Error('inline <script> not found');
// script body = openIdx+1 .. closeIdx-1 (0-based) => 1-based openIdx+2 .. closeIdx
const body = (from1, to1) => lines.slice(from1 - 1, to1).join('\n');

/**
 * Strip the common leading indentation and mark top-level declarations with
 * `export`. The common indent is computed from the block, not assumed.
 */
function toModule(src, { exportAll = true } = {}) {
  const raw = src.split('\n');
  let min = Infinity;
  for (const l of raw) {
    if (!l.trim()) continue;
    const m = l.match(/^[ \t]*/)[0].length;
    if (m < min) min = m;
  }
  if (!isFinite(min)) min = 0;
  const out = raw.map((l) => (l.trim() ? l.slice(min) : '')).join('\n');
  if (!exportAll) return out;
  return out.replace(
    /^(function\s+[A-Za-z_$][\w$]*|class\s+[A-Za-z_$][\w$]*|const\s+[A-Za-z_$][\w$]*|let\s+[A-Za-z_$][\w$]*)/gm,
    (m) => 'export ' + m,
  );
}

function write(rel, content) {
  const p = join(ROOT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content, 'utf8');
  console.log('wrote', rel, `(${content.split('\n').length} lines)`);
}

// ------------------------------------------- Manifest --------------------------------------------------------------------------------------------------------------------------------
const MODULES = [
  { file: 'src/audio/sfx.ts', from: 1374, to: 1743 },
  { file: 'src/render/assets.ts', from: 1744, to: 2009 },
  { file: 'src/systems/faith.ts', from: 2041, to: 2419 },
  { file: 'src/utils/helpers.ts', from: 2420, to: 2455 },
  { file: 'src/systems/combat.ts', from: 2456, to: 2499 },
  { file: 'src/core/storage.ts', from: 2500, to: 2600 },
  { file: 'src/systems/particles.ts', from: 2601, to: 2621 },
  { file: 'src/entities/Critters.ts', from: 2622, to: 2641 },
  { file: 'src/entities/Tile.ts', from: 2642, to: 2645 },
  { file: 'src/entities/Village.ts', from: 2646, to: 2817 },
  { file: 'src/entities/Human.ts', from: 2818, to: 3508 },
  { file: 'src/systems/worldgen.ts', from: 3509, to: 3732 },
  { file: 'src/systems/sim.ts', from: 3733, to: 3929 },
  { file: 'src/render/renderer.ts', from: 3930, to: 5137 },
  { file: 'src/render/minimap.ts', from: 5138, to: 5169 },
  { file: 'src/systems/power.ts', from: 5178, to: 5499 },
  { file: 'src/ui/input.ts', from: 5500, to: 6082 },
  { file: 'src/ui/modals.ts', from: 6083, to: 6195 },
  { file: 'src/audio/music.ts', from: 6196, to: 6495 },
  { file: 'src/ui/modal-utils.ts', from: 6496, to: 6495 },
  { file: 'src/ui/misc.ts', from: 6499, to: 6611 },
  { file: 'src/core/loop.ts', from: 5170, to: 5177 },
  { file: 'src/ui/misc.ts', from: 6499, to: 6611 },
];

// ------------------------------------------- Extra imports each module needs from its siblings ------------------------------------------
// The splitter cannot infer these; they are listed here so the extraction
// stays reproducible (`node scripts/extract.mjs` always yields a buildable
// tree).
const IMPORTS = {
  'src/core/loop.ts': [
    "import { updateLogic } from '../systems/sim.ts';",
    "import { drawWorld } from '../render/renderer.ts';",
  ],
  'src/core/storage.ts': [
    "import { Tile } from '../entities/Tile.ts';",
    "import { Village } from '../entities/Village.ts';",
    "import { Human } from '../entities/Human.ts';",
    "import { Animal, Fish } from '../entities/Critters.ts';",
    "import { loadTerrainTextures } from '../render/assets.ts';",
    "import { updateMinimap } from '../render/minimap.ts';",
  ],
  'src/entities/Tile.ts': [
    "import { TerrainType, BuildingType } from '../core/types.ts';",
  ],
  'src/entities/Village.ts': [
    "import { spawnParticles, spawnFloatingText } from '../systems/particles.ts';",
    "import { AudioSystem } from '../audio/sfx.ts';",
    "import { gainFaith, addChronicle, trySpawnHero } from '../systems/faith.ts';",
    "import { createVillage } from '../systems/sim.ts';",
    "import { Human } from './Human.ts';",
    "import { TerrainType, BuildingType } from '../core/types.ts';",
  ],
  'src/entities/Human.ts': [
    "import { generateHumanName, adjustColor, findResource } from '../utils/helpers.ts';",
    "import { spawnParticles, spawnFloatingText } from '../systems/particles.ts';",
    "import { spawnBullet, spawnExplosion } from '../systems/combat.ts';",
    "import { AudioSystem } from '../audio/sfx.ts';",
    "import { gainFaith, addChronicle, trySpawnHero } from '../systems/faith.ts';",
    "import { createVillage } from '../systems/sim.ts';",
    "import { BuildingType, HumanRole, Personality } from '../core/types.ts';",
  ],
  'src/render/renderer.ts': [
    "import { getPseudoRandom, drawTexture } from './assets.ts';",
    "import { updateMinimapViewbox } from './minimap.ts';",
    "import { AudioSystem } from '../audio/sfx.ts';",
    "import { spawnParticles, spawnFloatingText } from '../systems/particles.ts';",
  ],
  'src/systems/faith.ts': [
    "import { spawnParticles, spawnFloatingText } from './particles.ts';",
    "import { AudioSystem } from '../audio/sfx.ts';",
    "import { updateMinimap } from '../render/minimap.ts';",
    "import { Human } from '../entities/Human.ts';",
    "import { Village } from '../entities/Village.ts';",
  ],
  'src/systems/power.ts': [
    "import { spawnParticles, spawnFloatingText } from './particles.ts';",
    "import { createVillage } from './sim.ts';",
    "import { AudioSystem } from '../audio/sfx.ts';",
    "import { gainFaith, addChronicle, trySpawnHero } from './faith.ts';",
    "import { updateMinimap } from '../render/minimap.ts';",
    "import { updateVillagePanel } from './sim.ts';",
    "import { Tile } from '../entities/Tile.ts';",
    "import { Village } from '../entities/Village.ts';",
    "import { Human } from '../entities/Human.ts';",
  ],
  'src/systems/sim.ts': [
    "import { Tile } from '../entities/Tile.ts';",
    "import { Village } from '../entities/Village.ts';",
    "import { Human } from '../entities/Human.ts';",
    "import { Animal, Fish } from '../entities/Critters.ts';",
    "import { spawnParticles, spawnFloatingText } from './particles.ts';",
    "import { spawnExplosion } from './combat.ts';",
    "import { AudioSystem } from '../audio/sfx.ts';",
    "import { gainFaith, addChronicle, updateFaithGeneration, updateCrises, checkCrisisGeneration, updateHeroes } from './faith.ts';",
    "import { updateClimate } from './worldgen.ts';",
    "import { checkContextualMusic } from '../audio/music.ts';",
    "import { updateMinimap } from '../render/minimap.ts';",
    "import { saveGame } from '../core/storage.ts';",
  ],
  'src/systems/worldgen.ts': [
    "import { Tile } from '../entities/Tile.ts';",
    "import { MapType } from '../core/types.ts';",
    "import { Village } from '../entities/Village.ts';",
    "import { Human } from '../entities/Human.ts';",
    "import { Animal, Fish } from '../entities/Critters.ts';",
    "import { spawnParticles, spawnFloatingText } from './particles.ts';",
    "import { loadTerrainTextures } from '../render/assets.ts';",
    "import { updateMinimap } from '../render/minimap.ts';",
    "import { AudioSystem } from '../audio/sfx.ts';",
  ],
  'src/ui/input.ts': [
    "import { applyPower } from '../systems/power.ts';",
    "import { moveCamFromMinimap } from '../render/minimap.ts';",
    "import { AudioSystem } from '../audio/sfx.ts';",
  ],
  'src/ui/misc.ts': [
    "import { openModal, closeModal } from './modal-utils.ts';",
    "import { AudioSystem } from '../audio/sfx.ts';",
    "import { MusicEngine, stopAllMusic } from '../audio/music.ts';",
    "import { initWorld } from '../systems/worldgen.ts';",
    "import { checkSave } from '../core/storage.ts';",
    "import { mainLoop } from '../core/loop.ts';",
  ],
  'src/ui/modals.ts': [
    "import { openModal, closeModal } from './modal-utils.ts';",
    "import { AudioSystem } from '../audio/sfx.ts';",
    "import { MusicEngine, stopAllMusic, playGameMusic } from '../audio/music.ts';",
    "import { initWorld, applyClimateToWorld } from '../systems/worldgen.ts';",
    "import { initFaithUI, addChronicle } from '../systems/faith.ts';",
    "import { saveGame, loadGame, checkSave } from '../core/storage.ts';",
    "import { setSpeed } from './input.ts';",
  ],
  'src/audio/music.ts': [
    "import { AudioSystem } from './sfx.ts';",
  ],
  'src/audio/sfx.ts': [
    "import { MusicEngine } from './music.ts';",
  ],
};

// ------------------------------------------- Class field declarations ----------------------------------------------------------------------------------------------
// TypeScript in this environment cannot infer class properties from
// constructor assignments, so every field is declared explicitly. This is
// also just better TypeScript.
const FIELDS = {
  'src/entities/Tile.ts': {
    Tile: `    x: number;
    y: number;
    type: TerrainType;
    ownerId: number | null;
    hasHouse: boolean;
    buildingType: BuildingType | null;
    isTownHall: boolean;
    houseLevel: number;
    hasRoad: boolean;
    fireTimer: number;
    hasBerries: boolean;
    tradeRoute?: number | null;`,
  },
  'src/entities/Critters.ts': {
    Animal: `    x: number;
    y: number;
    vx: number;
    vy: number;
    dead: boolean;
    type: 'sheep' | 'cow';
    dir: number;`,
    Fish: `    x: number;
    y: number;
    vx: number;
    vy: number;
    dead: boolean;`,
  },
  'src/entities/Village.ts': {
    Village: `    id: number;
    color: string;
    name: string;
    centerX: number;
    centerY: number;
    wood: number;
    food: number;
    iron: number;
    gold: number;
    age: number;
    territory: Array<{ x: number, y: number }>;
    enemies: Set<number>;
    allies: Set<number>;
    state: 'PEACE' | 'WAR';
    farmTimer: number;
    culture: number;
    religion: number;
    stability: number;
    armySize: number;
    population: number;
    diplomacy: Record<number, { relation: number; tradeTimer: number }>;`,
  },
  'src/entities/Human.ts': {
    Human: `    x: number;
    y: number;
    villageId: number;
    hp: number;
    maxHp: number;
    hunger: number;
    state: string;
    disease: boolean;
    vx: number;
    vy: number;
    dir: number;
    target: { x: number, y: number } | null;
    buildTarget: BuildingType | null;
    isColonist: boolean;
    actionTimer: number;
    name: string;
    age: number;
    maxAge: number;
    personality: Personality;
    role: HumanRole;
    exp: number;
    memory: any;
    shirtColor: string;
    isHero: boolean;
    heroTitle: string;
    heroDeeds: number;
    isGeneral: boolean;
    isMad: boolean;
    madTimer: number;
    madOriginalVillage: number | null;
    isZombie: boolean;
    isScavenging: boolean;
    isReturning: boolean;
    dead: boolean;`,
  },
  'src/systems/particles.ts': {
    FloatingText: `    x: number;
    y: number;
    text: string;
    color: string;
    life: number;
    maxLife: number;`,
    Particle: `    x: number;
    y: number;
    color: string;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size?: number;`,
  },
};

// ------------------------------------------- Extra top-of-file content per module --------------------------------------------------------------------
const PREAMBLE = {
  'src/systems/combat.ts': `export interface Bullet {
    x: number; y: number;
    vx: number; vy: number;
    life: number; maxLife: number;
    color: string;
    trail: Array<{ x: number, y: number }>;
}

export interface Explosion {
    x: number; y: number;
    life: number; maxLife: number;
    radius: number;
}`,
  'src/ui/modal-utils.ts': `export function openModal(id: string) { document.getElementById(id)!.style.display = 'block'; }
export function closeModal(id: string) { document.getElementById(id)!.style.display = 'none'; }`,
};

// ------------------------------------------- Literal patches applied after extraction --------------------------------------------------------------
const PATCH = {
  'src/systems/power.ts': [
    ['t.type = id;', 't.type = Number(id) as TERRAIN;'],
  ],
  'src/core/storage.ts': [
    ['let obj = { t: t.type };', 'let obj: any = { t: t.type };'],
  ],
  'src/render/assets.ts': [
    ['export const terrainTextures = {};', 'export const terrainTextures: Record<number, HTMLImageElement> = {};'],
    ['for (const [type, src] of Object.entries(files)) {', 'for (const [type, src] of Object.entries(files) as [string, string][]) {'],
  ],
  'src/systems/worldgen.ts': [
    ['export function initWorld(mapType = \'random\') {', 'export function initWorld(mapType: MapType = \'random\') {'],
  ],
  'src/audio/music.ts': [
    ['startGame(mood) {', 'startGame(mood?) {'],
  ],
  'src/ui/input.ts': [
    // the monolith declares 'WANDER' twice; the second one wins, so the
    // tooltip says "Patrullando". Keep that behaviour, drop the duplicate key.
    ["{'IDLE':'Descansando','WANDER':'Vagabundeando',", "{'IDLE':'Descansando',"],
  ],
  'src/systems/sim.ts': [
    // createVillage never returned anything, so the "Guerra Civil" curse could
    // never create its rebel village (the `if (rebel)` branch was dead code).
    // Returning the village makes the curse work as intended.
    ['    updateMinimap();\n}', '    updateMinimap();\n    return v;\n}'],
    [".innerText = globalStats.pop;", ".innerText = String(globalStats.pop);"],
    [".innerText = villages.length;", ".innerText = String(villages.length);"],
    [".innerText = globalStats.deaths;", ".innerText = String(globalStats.deaths);"],
    [".innerText = Math.floor(v.food);", ".innerText = String(Math.floor(v.food));"],
    [".innerText = Math.floor(v.wood);", ".innerText = String(Math.floor(v.wood));"],
    [".innerText = Math.floor(v.iron);", ".innerText = String(Math.floor(v.iron));"],
    [".innerText = Math.floor(v.gold);", ".innerText = String(Math.floor(v.gold));"],
    [".innerText = Math.floor(v.culture);", ".innerText = String(Math.floor(v.culture));"],
  ],
};

// ------------------------------------------- Regex patches ------------------------------------------------------------------------------------------------------------------
// Type-narrowing fixes for the legacy code, applied uniformly.
const REGEX_PATCH = [
  // e.target.closest(...) -> (e.target as HTMLElement).closest(...)
  [/(\w+)\.target\.closest\(/g, '($1.target as HTMLElement).closest('],
  // document.getElementById(...).style / .innerText
  [/document\.getElementById\(([^()]*)\)\.style/g, '(document.getElementById($1) as HTMLElement).style'],
  [/document\.getElementById\(([^()]*)\)\.innerText/g, '(document.getElementById($1) as HTMLElement).innerText'],
  [/document\.getElementById\(([^()]*)\)\.classList/g, '(document.getElementById($1) as HTMLElement).classList'],
  // TouchEvent -> MouseEvent property access
  [/\be\.clientX\b/g, '(e as MouseEvent).clientX'],
  [/\be\.clientY\b/g, '(e as MouseEvent).clientY'],
  [/\be\.touches\b/g, '(e as TouchEvent).touches'],
  [/\be\.changedTouches\b/g, '(e as TouchEvent).changedTouches'],
  // Element -> HTMLElement for style / innerText
  [/(\w+) => \1\.style\./g, '$1 => ($1 as HTMLElement).style.'],
  [/(\w+)\.innerText\.includes\(/g, '($1 as HTMLElement).innerText.includes('],
  [/event\.currentTarget\.style\./g, '(event.currentTarget as HTMLElement).style.'],
  [/event\.currentTarget\.innerText/g, '(event.currentTarget as HTMLElement).innerText'],
];

for (const m of MODULES) {
  let content = toModule(body(m.from, m.to));

  // inject explicit class field declarations
  const fields = FIELDS[m.file];
  if (fields) {
    for (const [cls, decl] of Object.entries(fields)) {
      const needle = `export class ${cls} {`;
      const idx = content.indexOf(needle);
      if (idx < 0) throw new Error(`class ${cls} not found in ${m.file}`);
      const at = idx + needle.length;
      content = content.slice(0, at) + '\n' + decl + content.slice(at);
    }
  }

  // prepend the sibling imports
  const imports = IMPORTS[m.file];
  if (imports) content = imports.join('\n') + '\n' + content;

  // prepend any module-local type declarations
  const preamble = PREAMBLE[m.file];
  if (preamble) content = preamble + '\n' + content;

  // apply literal patches
  for (const [from, to] of PATCH[m.file] || []) {
    if (!content.includes(from)) throw new Error(`patch target not found in ${m.file}: ${from}`);
    content = content.split(from).join(to);
  }

  // apply regex patches
  for (const [re, to] of REGEX_PATCH) content = content.replace(re, to);

  write(m.file, content);
}

console.log('\ninline script body: lines', openIdx + 2, '..', closeIdx);
console.log('extracted', MODULES.length, 'modules');

export { MODULES, IMPORTS, FIELDS, PREAMBLE, PATCH, REGEX_PATCH, toModule, body };
