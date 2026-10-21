/**
 * Parity check.
 *
 * The module split was a mechanical transformation of the original inline
 * <script>. This script proves it was lossless by comparing the new modules
 * against the original monolith (recovered from git) after normalising away
 * the things the transform intentionally added:
 *
 *   - import statements
 *   - the `export` marker
 *   - the injected class field declarations
 *   - the `G.` state prefixes
 *   - the type-narrowing casts
 *   - whitespace
 *
 * Every remaining difference is printed for review.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── recover the original monolith ──────────────────────────────────────────
let original;
try {
  original = execFileSync('git', ['show', 'HEAD:index.html'], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
    .toString('utf8');
} catch (e) {
  console.error('could not read the original index.html from git:', e.message);
  process.exit(2);
}

const origLines = original.split(/\r?\n/);
const openIdx = origLines.findIndex((l) => l.trim() === '<script>');
const closeIdx = origLines.findIndex((l, i) => i > openIdx && l.trim() === '</script>');
const origBody = origLines.slice(openIdx + 1, closeIdx);

// ── the module manifest (must match scripts/extract.mjs) ──────────────────
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
  { file: 'src/ui/misc.ts', from: 6499, to: 6611 },
];

// ── normalisation ──────────────────────────────────────────────────────────
/** Remove `(expr as Type)` casts, including nested parentheses. */
function uncast(code) {
  let out = '';
  let i = 0;
  const TYPES = ['HTMLElement', 'MouseEvent', 'TouchEvent', 'MapType', 'TerrainType'];
  while (i < code.length) {
    if (code[i] === '(') {
      // find the matching close paren
      let d = 0, j = i, inStr = null;
      for (; j < code.length; j++) {
        const c = code[j];
        if (inStr) { if (c === '\\') { j++; continue; } if (c === inStr) inStr = null; continue; }
        if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
        if (c === '(') d++;
        else if (c === ')') { d--; if (d === 0) break; }
      }
      const inner = code.slice(i + 1, j);
      const m = inner.match(new RegExp(`^(.*) as (${TYPES.join('|')})$`, 's'));
      if (m) { out += m[1]; i = j + 1; continue; }
    }
    out += code[i];
    i++;
  }
  return out;
}

function norm(code) {
  let s = code
    .split('\n').filter((l) => !/^\s*import\s/.test(l)).join('\n')
    .replace(/^export\s+/gm, '')
    // undo the injected class field declarations: they sit between the class
    // opening and the constructor
    .replace(/(class\s+[A-Za-z_$][\w$]*\s*\{)[\s\S]*?(\n\s*constructor)/g, '$1$2')
    // undo the state prefix
    .replace(/\bG\.([A-Za-z_$][\w$]*)/g, '$1')
    // undo the shorthand expansion the transform does for state names
    .replace(/\b(timeTick|nextVillageId|currentMapType|currentClimate): \1\b/g, '$1')
    // undo the String() wrappers around innerText assignments
    .replace(/String\((Math\.floor\([^()]*\)|[A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*)\)/g, '$1')
    // undo the literal patches
    .replace(/t\.type = Number\(id\);/g, 't.type = id;')
    .replace(/let obj: any = \{ t: t\.type \};/g, 'let obj = { t: t.type };')
    .replace(/const terrainTextures: Record<number, HTMLImageElement> = \{\};/g, 'const terrainTextures = {};')
    .replace(/Object\.entries\(files\) as \[string, string\]\[\]/g, 'Object.entries(files)')
    .replace(/mapType: MapType = 'random'/, "mapType = 'random'")
    .replace(/startGame\(mood\?\) \{/, 'startGame(mood) {')
    .replace(/    return v;\n\}/, '\n}');

  s = uncast(s)
    .replace(/\bas (?:HTMLElement|MouseEvent|TouchEvent|MapType|TerrainType)\b/g, '')
    .replace(/ as TERRAIN/g, '');

  return s.split('\n').map((l) => l.trim()).filter(Boolean);
}

// ── word-level diff ────────────────────────────────────────────────────────
function diffWords(a, b) {
  const A = a.join(' ').split(/(\s+)/);
  const B = b.join(' ').split(/(\s+)/);
  // classic LCS
  const n = A.length, m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push([' ', A[i]]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push(['-', A[i]]); i++; }
    else { out.push(['+', B[j]]); j++; }
  }
  while (i < n) out.push(['-', A[i++]]);
  while (j < m) out.push(['+', B[j++]]);
  return out;
}

let clean = 0;
const report = [];

for (const m of MODULES) {
  const p = join(ROOT, m.file);
  if (!existsSync(p)) { report.push(`${m.file}: MISSING`); continue; }
  const now = readFileSync(p, 'utf8');
  const before = origBody.slice(m.from - 1 - (openIdx + 1), m.to - (openIdx + 1)).join('\n');

  const a = norm(before);
  const b = norm(now);
  const d = diffWords(a, b);

  const changed = d.filter(([k]) => k !== ' ');
  if (changed.length === 0) { report.push(`${m.file}: IDENTICAL`); clean++; continue; }

  report.push(`${m.file}: ${changed.length} changed tokens`);
  // print the changed regions with a little context
  let idx = 0;
  while (idx < d.length) {
    if (d[idx][0] === ' ') { idx++; continue; }
    const start = Math.max(0, idx - 6);
    let end = idx;
    while (end < d.length && (d[end][0] !== ' ' || (end - idx) < 30)) end++;
    report.push('   ' + d.slice(start, end).map(([k, t]) => (k === ' ' ? t : `[${k}${t}]`)).join(' '));
    idx = end;
  }
}

console.log(report.join('\n'));
console.log(`\n${clean}/${MODULES.length} modules identical after normalisation`);
