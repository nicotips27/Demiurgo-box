/**
 * Phase 0 transform.
 *
 * Rewrites the extracted legacy modules so that every shared value is reached
 * through an explicit module instead of an implicit global:
 *
 *   - game state          -> G.<name>            (src/core/state.ts)
 *   - DOM handles         -> imported            (src/core/dom.ts)
 *   - constants           -> imported            (src/core/constants.ts)
 *   - asset registries    -> imported            (src/render/assets.ts)
 *
 * It also deletes the constant declarations that now live in core/, and
 * inserts the import lines each module needs.
 *
 * The transformer is a small character scanner (not a regex) so that it can
 * tell an identifier apart from a property access, an object key, an object
 * shorthand and a string literal.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

// ------------------------------------------- Name groups ------------------------------------------------------------------------------------------------------------------------
const STATE = [
  'gameState', 'cols', 'rows',
  'grid', 'humans', 'villages', 'animals', 'fishes',
  'particles', 'floatingTexts', 'bullets', 'explosions',
  'heroes', 'activeCrises', 'chronicles',
  'globalStats', 'simSettings', 'currentTool',
  'brushRadius', 'hoverTx', 'hoverTy', 'isDrawing', 'nextVillageId',
  'selectedVillageId', 'currentMapType', 'villagePanelManuallyClosed',
  'currentClimate', 'selectedMapType', 'selectedClimate', 'hasActiveGame',
  'timeTick', 'divineFaith', 'faithMax', 'nextCrisisId', 'chroniclesOpen',
  'camX', 'camY', 'zoom', 'isPanning', 'startPanX', 'startPanY', 'isMinimapPanning',
  'climateParticles', 'climateTimer', 'climateEvent',
  'touchState', 'activeCurseId', 'previousSpeed',
  'isMenuMusicActive', 'currentGameTrackIndex', 'isFadingOut', 'lastMoodCheck',
  'aboutFromPause', 'instructionsFromPause', 'settingsFromPause',
  'globalMusicVolume', 'globalSFXVolume', 'musicEnabled', 'frameCounter',
];

const DOM = ['canvas', 'ctx', 'tooltip', 'vPanel', 'minimapCanvas', 'mCtx'];

const CONST = [
  'TILE_SIZE', 'WORLD_COLS', 'WORLD_ROWS',
  'FACTION_COLORS', 'NAME_PREFIXES', 'NAME_SUFFIXES', 'AGES_NAMES',
  'HUMAN_NAMES', 'PERSONALITIES', 'ROLES',
  'CLIMATE_TEXTURES', 'TREE_CLIMATE_TINTS',
  'DIVINE_POWERS', 'CRISIS_TYPES', 'HERO_TITLES',
];

const ALIASED = {
  TERRAIN: "import { TerrainType as TERRAIN } from '%TYPES%';",
  BLD: "import { BuildingType as BLD } from '%TYPES%';",
  COLORS: "import { TERRAIN_COLORS as COLORS } from '%CONST%';",
};

const ASSET = [
  'terrainTextures', 'texturesLoaded', 'texturesReady',
  'treeSprites', 'treeSpritesReady',
  'gameSprites', 'gameSpritesReady',
];

// Names that must never be rewritten even though they appear in a group,
// because they are locally declared in that file.
const SKIP = {
  'src/render/assets.ts': ['cols', 'rows', 'terrainTextures', 'texturesLoaded', 'texturesReady',
    'treeSprites', 'treeSpritesReady', 'gameSprites', 'gameSpritesReady'],
  'src/systems/combat.ts': ['ctx'],
};

// Whole lines to delete (locals that shadow a global of the same name, or
// module-level declarations that now live in core/state.ts).
const DELETE_LINE = {
  'src/audio/music.ts': [/^\s*(?:export\s+)?let lastMoodCheck = 0;\s*$/m],
  'src/systems/faith.ts': [
    /^\s*(?:export\s+)?let camX = 0, camY = 0, zoom = 1\.0;\s*$/m,
    /^\s*(?:export\s+)?let isPanning = false, startPanX = 0, startPanY = 0;\s*$/m,
    /^\s*(?:export\s+)?let isMinimapPanning = false; let timeTick = 0;\s*$/m,
  ],
  'src/systems/worldgen.ts': [
    /^\s*(?:export\s+)?let climateParticles = \[\];.*$/m,
    /^\s*(?:export\s+)?let climateTimer = 0;\s*$/m,
    /^\s*(?:export\s+)?let climateEvent = null;.*$/m,
  ],
  'src/ui/input.ts': [
    /^\s*(?:export\s+)?let touchState = \{[\s\S]*?^\s*\};\s*$/m,
    /^\s*(?:export\s+)?let activeCurseId = 'CURSE';\s*$/m,
  ],
  'src/ui/modals.ts': [
    /^\s*(?:export\s+)?let previousSpeed = 1;\s*$/m,
    /^\s*(?:export\s+)?let isMenuMusicActive = false;\s*$/m,
    /^\s*(?:export\s+)?let currentGameTrackIndex = -1;\s*$/m,
    /^\s*(?:export\s+)?let isFadingOut = false;\s*$/m,
  ],
  'src/ui/misc.ts': [
    /^\s*(?:export\s+)?let aboutFromPause = false;\s*$/m,
    /^\s*(?:export\s+)?let instructionsFromPause = false; let settingsFromPause = false;\s*$/m,
  ],
};

// Top-level declarations to delete because they moved to core/ or dom/.
const DELETE = {
  'src/render/assets.ts': [
    'canvas', 'tooltip', 'minimapCanvas',
    'TILE_SIZE', 'TERRAIN', 'BLD', 'COLORS',
    'CLIMATE_TEXTURES', 'TREE_CLIMATE_TINTS',
  ],
  'src/systems/faith.ts': ['DIVINE_POWERS', 'CRISIS_TYPES', 'HERO_TITLES'],
};

// ------------------------------------------- Helpers --------------------------------------------------------------------------------------------------------------------------------
function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** Remove a top-level `export const NAME = ...;` statement (balanced). */
function deleteDeclaration(src, name) {
  const re = new RegExp(`^export const ${name} =`, 'm');
  const m = re.exec(src);
  if (!m) return src;
  let i = m.index;
  // walk to the end of the statement, tracking depth of {} [] ()
  let depth = 0, inStr = null, seenBody = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{' || c === '[' || c === '(') { depth++; seenBody = true; continue; }
    if (c === '}' || c === ']' || c === ')') { depth--; continue; }
    if (c === ';' && depth === 0) { i++; break; }
    if (c === '\n' && depth === 0 && seenBody) { break; }
  }
  // swallow the rest of the line (other statements on the same line)
  while (i < src.length && src[i] !== '\n') i++;
  return src.slice(0, m.index) + src.slice(i);
}

/** Find the index just past the matching close paren/brace/bracket. */
function matchBracket(src, open) {
  const pairs = { '(': ')', '[': ']', '{': '}' };
  const close = pairs[src[open]];
  let d = 0;
  for (let k = open; k < src.length; k++) {
    const ch = src[k];
    if (ch === '(' || ch === '[' || ch === '{') d++;
    else if (ch === ')' || ch === ']' || ch === '}') {
      d--;
      if (d === 0) return k;
    }
  }
  return -1;
}

/** True if the parenthesised group starting at `open` is an arrow parameter list. */
function isArrowParams(src, open) {
  const close = matchBracket(src, open);
  if (close < 0) return false;
  let j = close + 1;
  while (j < src.length && /\s/.test(src[j])) j++;
  return src[j] === '=' && src[j + 1] === '>';
}

const IDENT = /[A-Za-z_$][\w$]*/y;

/**
 * Rewrite identifiers in `src`.
 *
 * The scanner tracks enough context to tell apart:
 *   - a property access            (`obj.grid`)
 *   - an object literal key        (`{ grid: value }`)
 *   - an object literal shorthand  (`{ grid }`)
 *   - a declaration binding        (`let a = 1, b = 2`)
 *   - a function parameter         (`function f(grid) {}`)
 *   - a string or comment
 *
 * `rewrite(name)` returns null to leave the name alone, or
 * `{ text, shorthand? }` to replace it.
 */
function transform(src, rewrite) {
  let out = '';
  let i = 0;
  const n = src.length;

  let declKind = null;       // 'let' | 'const' | 'var' | 'function' | 'class'
  let declExpectBinding = false;
  let declDepth = 0;
  let depth = 0;
  let destructure = false;
  let paramList = false;     // inside a parameter list
  let paramDepth = 0;

  while (i < n) {
    const c = src[i];

    // line comment
    if (c === '/' && src[i + 1] === '/') {
      const j = src.indexOf('\n', i);
      const end = j < 0 ? n : j;
      out += src.slice(i, end);
      i = end;
      continue;
    }
    // block comment
    if (c === '/' && src[i + 1] === '*') {
      const j = src.indexOf('*/', i + 2);
      const end = j < 0 ? n : j + 2;
      out += src.slice(i, end);
      i = end;
      continue;
    }
    // string / template literal
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === quote) { j++; break; }
        j++;
      }
      if (quote !== '`') {
        out += src.slice(i, j);
      } else {
        // Template literal: the ${...} interpolations are real code and must
        // be rewritten too, so recurse into them.
        let t = '`';
        let k = i + 1;
        while (k < j - 1) {
          if (src[k] === '\\') { t += src.slice(k, k + 2); k += 2; continue; }
          if (src[k] === '$' && src[k + 1] === '{') {
            let d = 0;
            let e = k + 1;
            for (; e < j; e++) {
              if (src[e] === '{') d++;
              else if (src[e] === '}') { d--; if (d === 0) break; }
            }
            t += '${' + transform(src.slice(k + 2, e), rewrite) + '}';
            k = e + 1;
            continue;
          }
          t += src[k];
          k++;
        }
        t += '`';
        out += t;
      }
      i = j;
      continue;
    }
    // parameter list start
    if (c === '(' && !paramList) {
      const arrow = isArrowParams(src, i);
      if (arrow || (declKind === 'function' && declExpectBinding === false && declDepth === depth)) {
        paramList = true;
        paramDepth = depth;
      }
      depth++;
      out += c;
      i++;
      continue;
    }
    // braces / brackets
    if (c === '{' || c === '[') {
      depth++;
      if (declKind && declExpectBinding) destructure = true;
      out += c;
      i++;
      continue;
    }
    if (c === '}' || c === ']') {
      depth--;
      if (destructure && depth <= declDepth) destructure = false;
      out += c;
      i++;
      continue;
    }
    if (c === ')') {
      depth--;
      if (paramList && depth <= paramDepth) paramList = false;
      out += c;
      i++;
      continue;
    }
    if (c === '\n') {
      // ASI: a declaration ends at the newline unless the statement clearly
      // continues onto the next line.
      if (declKind) {
        const tail = out.replace(/\s+$/, '');
        const last = tail[tail.length - 1];
        const continues = ',([{=+-*/%<>!&|?:'.includes(last);
        if (!continues) { declKind = null; declExpectBinding = false; destructure = false; }
      }
      out += c;
      i++;
      continue;
    }
    if (c === ';' && depth === declDepth) {
      declKind = null;
      declExpectBinding = false;
      out += c;
      i++;
      continue;
    }
    if (c === ',' && depth === declDepth && declKind && declKind !== 'function' && declKind !== 'class') {
      declExpectBinding = true;
      out += c;
      i++;
      continue;
    }

    // identifier / keyword
    if (/[A-Za-z_$]/.test(c)) {
      IDENT.lastIndex = i;
      const m = IDENT.exec(src);
      const word = m[0];
      const end = i + word.length;
      const before = out[out.length - 1];
      const after = src[end];

      // let/const/var/function/class are reserved: always a declaration
      if (word === 'let' || word === 'const' || word === 'var' || word === 'function' || word === 'class') {
        declKind = word;
        declDepth = depth;
        declExpectBinding = true;
        destructure = false;
        out += word;
        i = end;
        continue;
      }
      // a binding name in a declaration -> leave alone
      if (declKind && declExpectBinding) {
        declExpectBinding = false;
        if (declKind === 'function' || declKind === 'class') declKind = null;
        out += word;
        i = end;
        continue;
      }
      // destructuring pattern -> leave the whole pattern alone
      if (destructure) { out += word; i = end; continue; }
      // parameter name -> leave alone
      if (paramList) { out += word; i = end; continue; }
      // property access -> leave alone
      if (before === '.' || (before === '?' && out[out.length - 2] === '.')) {
        out += word;
        i = end;
        continue;
      }
      // object literal key -> leave alone
      if (after === ':' && !isTernaryBefore(out)) {
        out += word;
        i = end;
        continue;
      }

      const rep = rewrite(word, out, src, end);
      if (rep === null) {
        out += word;
      } else if (rep.shorthand) {
        out += `${word}: ${rep.text}`;
      } else {
        out += rep.text;
      }
      i = end;
      continue;
    }

    out += c;
    i++;
  }
  return out;
}

function isTernaryBefore(out) {
  // look back for a '?' that is not '?.'
  let j = out.length - 1;
  while (j >= 0 && /\s/.test(out[j])) j--;
  return out[j] === '?' && out[j - 1] !== '?';
}

// ------------------------------------------- Main --------------------------------------------------------------------------------------------------------------------------------------
const files = walk(SRC).filter((f) => {
  const n = relative(ROOT, f).replace(/\\/g, '/');
  return !['src/core/state.ts', 'src/core/types.ts', 'src/core/constants.ts', 'src/core/dom.ts'].includes(n);
});

const report = [];

for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  let src = readFileSync(file, 'utf8');

  // 1. delete relocated declarations
  for (const name of DELETE[rel] || []) {
    src = deleteDeclaration(src, name);
  }
  // 1b. delete shadowing / relocated local declarations
  for (const re of DELETE_LINE[rel] || []) {
    src = src.replace(re, '');
  }

  const skip = new Set(SKIP[rel] || []);
  const used = new Set();

  const rewrite = (word) => {
    if (skip.has(word)) return null;
    if (STATE.includes(word)) { used.add(word); return { text: `G.${word}` }; }
    if (DOM.includes(word)) { used.add(word); return { text: word }; }
    if (CONST.includes(word)) { used.add(word); return { text: word }; }
    if (Object.prototype.hasOwnProperty.call(ALIASED, word)) { used.add(word); return { text: word }; }
    if (ASSET.includes(word)) { used.add(word); return { text: word }; }
    return null;
  };

  // Track shorthand object properties: `{ grid }` -> `{ grid: G.grid }`
  // Only state names need this - imported names keep working as shorthand.
  src = transform(src, (word, outSoFar, full, end) => {
    const rep = rewrite(word);
    if (!rep) return null;
    if (STATE.includes(word)) {
      // detect shorthand: previous non-space char is '{' or ',' and next non-space is ',' or '}'
      const before = outSoFar.replace(/\s+$/, '').slice(-1);
      let j = end;
      while (j < full.length && /\s/.test(full[j])) j++;
      const after = full[j];
      if ((before === '{' || before === ',') && (after === ',' || after === '}')) {
        return { text: `G.${word}`, shorthand: true };
      }
    }
    return rep;
  });

  // 2. build the import header
  const up = (p) => {
    let relPath = relative(dirname(file), join(ROOT, p)).replace(/\\/g, '/');
    if (!relPath.startsWith('.')) relPath = './' + relPath;
    return relPath;
  };

  const imports = [];
  const need = (n) => used.has(n);

  if ([...used].some((n) => STATE.includes(n))) {
    imports.push(`import { G } from '${up('src/core/state.ts')}';`);
  }
  const domUsed = [...used].filter((n) => DOM.includes(n));
  if (domUsed.length) {
    imports.push(`import { ${domUsed.sort().join(', ')} } from '${up('src/core/dom.ts')}';`);
  }
  const constUsed = [...used].filter((n) => CONST.includes(n));
  if (constUsed.length) {
    imports.push(`import { ${constUsed.sort().join(', ')} } from '${up('src/core/constants.ts')}';`);
  }
  const aliasUsed = [...used].filter((n) => Object.prototype.hasOwnProperty.call(ALIASED, n));
  for (const a of aliasUsed) {
    imports.push(ALIASED[a].replace('%TYPES%', up('src/core/types.ts')).replace('%CONST%', up('src/core/constants.ts')));
  }
  const assetUsed = [...used].filter((n) => ASSET.includes(n));
  if (assetUsed.length) {
    imports.push(`import { ${assetUsed.sort().join(', ')} } from '${up('src/render/assets.ts')}';`);
  }

  if (imports.length) {
    src = imports.join('\n') + '\n' + src;
  }

  writeFileSync(file, src, 'utf8');
  report.push(`${rel}: ${imports.length} import lines, ${used.size} names rewritten`);
}

console.log(report.join('\n'));
console.log(`\n${files.length} files transformed`);
