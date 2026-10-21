/**
 * Phase 0 analysis: find every use of each module-level global in the
 * extracted src/ modules, and flag any position where a mechanical
 * `name` -> `G.name` rewrite would be wrong:
 *   - local declarations / parameters that shadow the global
 *   - object-literal keys
 *   - property accesses (already excluded by the caller)
 *   - string literals
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

const GLOBALS = [
  'globalMusicVolume', 'globalSFXVolume', 'musicEnabled', 'frameCounter',
  'canvas', 'ctx', 'tooltip', 'vPanel', 'minimapCanvas', 'mCtx',
  'terrainTextures', 'texturesLoaded', 'texturesReady',
  'treeSprites', 'treeSpritesReady',
  'gameSprites', 'gameSpritesReady',
  'FACTION_COLORS', 'NAME_PREFIXES', 'NAME_SUFFIXES', 'AGES_NAMES',
  'HUMAN_NAMES', 'PERSONALITIES', 'ROLES',
  'gameState', 'cols', 'rows',
  'grid', 'humans', 'villages', 'particles', 'floatingTexts',
  'animals', 'fishes', 'bullets', 'explosions',
  'globalStats', 'simSettings', 'currentTool',
  'brushRadius', 'hoverTx', 'hoverTy', 'isDrawing', 'nextVillageId',
  'selectedVillageId', 'currentMapType', 'villagePanelManuallyClosed',
  'currentClimate', 'selectedMapType', 'selectedClimate', 'hasActiveGame',
  'divineFaith', 'faithMax', 'heroes', 'activeCrises', 'chronicles',
  'nextCrisisId', 'chroniclesOpen',
  'camX', 'camY', 'zoom', 'isPanning', 'startPanX', 'startPanY',
  'isMinimapPanning', 'timeTick',
  'climateParticles', 'climateTimer', 'climateEvent',
  'touchState', 'activeCurseId', 'previousSpeed',
  'isMenuMusicActive', 'currentGameTrackIndex', 'isFadingOut',
  'lastMoodCheck', 'aboutFromPause', 'instructionsFromPause', 'settingsFromPause',
];

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

const files = walk(SRC).filter((f) => !f.includes('state.ts'));

const shadow = [];   // local declarations / params
const keyPos = [];   // object-literal keys
const counts = {};

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const rel = f.slice(ROOT.length + 1);
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    // strip string literals for analysis
    const noStr = line.replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/`(?:[^`\\]|\\.)*`/g, '``');
    for (const g of GLOBALS) {
      const re = new RegExp(`(?<![.\\w$])${g}(?![\\w$])`, 'g');
      const hits = noStr.match(re);
      if (!hits) continue;
      counts[g] = (counts[g] || 0) + hits.length;
      // local declaration / parameter?
      if (new RegExp(`\\b(let|const|var|function)\\s+${g}\\b`).test(noStr) ||
          new RegExp(`\\(\\s*[^)]*\\b${g}\\b[^)]*\\)\\s*(=>|\\{)`).test(noStr) ||
          new RegExp(`,\\s*${g}\\b`).test(noStr)) {
        shadow.push(`${rel}:${i + 1}  ${g}  ::  ${line.trim().slice(0, 110)}`);
      }
      // object literal key?
      if (new RegExp(`[{,]\\s*${g}\\s*:`).test(noStr)) {
        keyPos.push(`${rel}:${i + 1}  ${g}  ::  ${line.trim().slice(0, 110)}`);
      }
    }
  });
}

console.log('=== POSSIBLE LOCAL SHADOWING (must review) ===');
console.log(shadow.length ? shadow.join('\n') : '(none)');
console.log('\n=== OBJECT-LITERAL KEY POSITIONS (must review) ===');
console.log(keyPos.length ? keyPos.join('\n') : '(none)');
console.log('\n=== USE COUNTS ===');
console.log(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join('  '));
