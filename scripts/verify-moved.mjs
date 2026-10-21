/**
 * Moved-block verification.
 *
 * The split moved a number of declarations out of the monolith and into
 * core/constants.ts, core/dom.ts and core/state.ts. This script checks that
 * each moved block is present in its new home with the same values.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const original = execFileSync('git', ['show', 'HEAD:index.html'], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
const origLines = original.split(/\r?\n/);

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const constants = read('src/core/constants.ts');
const dom = read('src/core/dom.ts');
const state = read('src/core/state.ts');

/** Pull a `const NAME = ...;` / `let NAME = ...;` block out of the original. */
function block(name, from, to) {
  const text = origLines.slice(from - 1, to).join('\n');
  const re = new RegExp(`(?:export\\s+)?(?:const|let)\\s+${name}\\s*=`);
  const m = re.exec(text);
  if (!m) return null;
  let i = m.index, d = 0, inStr = null, seen = false;
  for (; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (c === '\\') { i++; continue; } if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{' || c === '[' || c === '(') { d++; seen = true; continue; }
    if (c === '}' || c === ']' || c === ')') { d--; continue; }
    if (c === ';' && d === 0) { i++; break; }
    if (c === '\n' && d === 0 && seen) break;
  }
  return text.slice(m.index, i);
}

/** Pull the same block out of a new file, and compare the bodies. */
function inNew(file, name) {
  const re = new RegExp(`export\\s+(?:const|let)\\s+${name}(?:\\s*:[^=]+)?\\s*=`);
  const m = re.exec(file);
  if (!m) return null;
  let i = m.index, d = 0, inStr = null, seen = false;
  for (; i < file.length; i++) {
    const c = file[i];
    if (inStr) { if (c === '\\') { i++; continue; } if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{' || c === '[' || c === '(') { d++; seen = true; continue; }
    if (c === '}' || c === ']' || c === ')') { d--; continue; }
    if (c === ';' && d === 0) { i++; break; }
    if (c === '\n' && d === 0 && seen) break;
  }
  return file.slice(m.index, i);
}

/** Compare two declaration bodies by their literal content. */
function sameValues(a, b) {
  const norm = (s) => s
    .replace(/export\s+/, '')
    .replace(/\s+/g, ' ')
    .replace(/'/g, '"')
    .trim();
  const A = norm(a), B = norm(b);
  if (A === B) return true;
  // compare the sequence of string/number literals
  const lit = (s) => (s.match(/"[^"]*"|-?\b\d+(?:\.\d+)?\b/g) || []);
  const la = lit(A), lb = lit(B);
  if (la.length !== lb.length) return false;
  return la.every((v, i) => v === lb[i]);
}

const CHECKS = [
  // [label, original block, new home file, new home text, new name]
  ['CLIMATE_TEXTURES', block('CLIMATE_TEXTURES', 1763, 1836), 'src/core/constants.ts', constants, 'CLIMATE_TEXTURES'],
  ['TREE_CLIMATE_TINTS', block('TREE_CLIMATE_TINTS', 1897, 1906), 'src/core/constants.ts', constants, 'TREE_CLIMATE_TINTS'],
  ['DIVINE_POWERS', block('DIVINE_POWERS', 2042, 2053), 'src/core/constants.ts', constants, 'DIVINE_POWERS'],
  ['CRISIS_TYPES', block('CRISIS_TYPES', 2054, 2065), 'src/core/constants.ts', constants, 'CRISIS_TYPES'],
  ['HERO_TITLES', block('HERO_TITLES', 2166, 2167), 'src/core/constants.ts', constants, 'HERO_TITLES'],
  ['COLORS', block('COLORS', 1752, 1752), 'src/core/constants.ts', constants, 'TERRAIN_COLORS'],
  ['FACTION_COLORS', block('FACTION_COLORS', 2010, 2010), 'src/core/constants.ts', constants, 'FACTION_COLORS'],
  ['NAME_PREFIXES', block('NAME_PREFIXES', 2011, 2011), 'src/core/constants.ts', constants, 'NAME_PREFIXES'],
  ['NAME_SUFFIXES', block('NAME_SUFFIXES', 2012, 2012), 'src/core/constants.ts', constants, 'NAME_SUFFIXES'],
  ['AGES_NAMES', block('AGES_NAMES', 2013, 2013), 'src/core/constants.ts', constants, 'AGES_NAMES'],
  ['HUMAN_NAMES', block('HUMAN_NAMES', 2014, 2014), 'src/core/constants.ts', constants, 'HUMAN_NAMES'],
  ['PERSONALITIES', block('PERSONALITIES', 2015, 2015), 'src/core/constants.ts', constants, 'PERSONALITIES'],
  ['ROLES', block('ROLES', 2016, 2016), 'src/core/constants.ts', constants, 'ROLES'],
];

let ok = 0, bad = 0;
for (const [label, orig, file, text, name] of CHECKS) {
  if (!orig) { console.log(`SKIP  ${label}: not found in the original`); continue; }
  const moved = inNew(text, name);
  if (!moved) { console.log(`FAIL  ${label}: not found in ${file}`); bad++; continue; }
  if (sameValues(orig, moved)) { console.log(`OK    ${label} -> ${file}`); ok++; }
  else {
    console.log(`FAIL  ${label} -> ${file} (values differ)`);
    console.log(`   orig: ${orig.slice(0, 200)}`);
    console.log(`   new : ${moved.slice(0, 200)}`);
    bad++;
  }
}

// TERRAIN and BLD became TypeScript enums — compare their members.
const types = read('src/core/types.ts');
for (const [label, orig, enumName] of [
  ['TERRAIN', block('TERRAIN', 1749, 1749), 'TerrainType'],
  ['BLD', block('BLD', 1750, 1750), 'BuildingType'],
]) {
  const members = [...orig.matchAll(/([A-Z_]+)\s*:\s*(\d+)/g)].map((m) => `${m[1]}=${m[2]}`);
  const em = new RegExp(`export enum ${enumName}\\s*\\{([^}]*)\\}`).exec(types);
  if (!em) { console.log(`FAIL  ${enumName} enum not found`); bad++; continue; }
  const emMembers = [...em[1].matchAll(/([A-Z_]+)\s*=\s*(\d+)/g)].map((m) => `${m[1]}=${m[2]}`);
  const missing = members.filter((x) => !emMembers.includes(x));
  if (missing.length) { console.log(`FAIL  ${label} -> ${enumName} is missing ${missing.join(', ')}`); bad++; }
  else { console.log(`OK    ${label} -> ${enumName} (${members.length} members)`); ok++; }
}

// The state object must carry every mutable global.
const STATE_NAMES = [
  'gameState', 'cols', 'rows', 'grid', 'humans', 'villages', 'animals', 'fishes',
  'particles', 'floatingTexts', 'bullets', 'explosions', 'heroes', 'activeCrises',
  'chronicles', 'globalStats', 'simSettings', 'currentTool', 'brushRadius', 'hoverTx',
  'hoverTy', 'isDrawing', 'nextVillageId', 'selectedVillageId', 'currentMapType',
  'villagePanelManuallyClosed', 'currentClimate', 'selectedMapType', 'selectedClimate',
  'hasActiveGame', 'timeTick', 'divineFaith', 'faithMax', 'nextCrisisId', 'chroniclesOpen',
  'camX', 'camY', 'zoom', 'isPanning', 'startPanX', 'startPanY', 'isMinimapPanning',
  'climateParticles', 'climateTimer', 'climateEvent', 'activeCurseId', 'previousSpeed',
  'isMenuMusicActive', 'currentGameTrackIndex', 'isFadingOut', 'lastMoodCheck',
  'aboutFromPause', 'instructionsFromPause', 'settingsFromPause',
  'globalMusicVolume', 'globalSFXVolume', 'musicEnabled', 'frameCounter',
];
const missingState = STATE_NAMES.filter((n) => !new RegExp(`^\\s*${n}:`, 'm').test(state));
if (missingState.length) { console.log(`FAIL  state.ts is missing: ${missingState.join(', ')}`); bad++; }
else { console.log(`OK    state.ts carries all ${STATE_NAMES.length} mutable globals`); ok++; }

// The DOM handles must be present.
for (const [label, file, text] of [
  ['canvas', 'src/core/dom.ts', dom], ['ctx', 'src/core/dom.ts', dom],
  ['tooltip', 'src/core/dom.ts', dom], ['vPanel', 'src/core/dom.ts', dom],
  ['minimapCanvas', 'src/core/dom.ts', dom], ['mCtx', 'src/core/dom.ts', dom],
]) {
  if (new RegExp(`export const ${label}\\b`).test(text)) { console.log(`OK    dom.ts has ${label}`); ok++; }
  else { console.log(`FAIL  dom.ts is missing ${label}`); bad++; }
}

console.log(`\n${ok} checks passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
