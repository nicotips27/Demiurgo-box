/**
 * Global mutable game state.
 *
 * Everything the simulation and the renderer share lives here, on a single
 * exported object `G`. Modules read and write `G.foo` — there are no
 * module-level mutable variables anywhere else, which keeps the dependency
 * graph acyclic and makes the whole world state inspectable in one place.
 *
 * Note: entity arrays are typed loosely on purpose. They are filled with the
 * real classes from ../entities, but importing those classes here would
 * create a runtime import cycle (entities -> state -> entities). `import type`
 * is erased at compile time, so it is safe.
 */
import type { Tile } from '../entities/Tile';
import type { Village } from '../entities/Village';
import type { Human } from '../entities/Human';
import type { Animal, Fish } from '../entities/Critters';
import type { Particle, FloatingText } from '../systems/particles';
import type { Bullet, Explosion } from '../systems/combat';
import type {
  ClimateType, GlobalStats, MapType, SimSettings, Tool,
  ActiveCrisis, Chronicle,
} from './types';
import { WORLD_COLS, WORLD_ROWS } from './constants';

export const G = {
  // ── Audio ───────────────────────────────────────────────────────────────
  globalMusicVolume: 0.33,
  globalSFXVolume: 0.12,
  musicEnabled: false,
  frameCounter: 0,

  // ── World dimensions ────────────────────────────────────────────────────
  cols: WORLD_COLS,
  rows: WORLD_ROWS,

  // ── World content ───────────────────────────────────────────────────────
  grid: [] as Tile[][],
  humans: [] as Human[],
  villages: [] as Village[],
  animals: [] as Animal[],
  fishes: [] as Fish[],
  particles: [] as Particle[],
  floatingTexts: [] as FloatingText[],
  bullets: [] as Bullet[],
  explosions: [] as Explosion[],
  heroes: [] as Human[],
  activeCrises: [] as ActiveCrisis[],
  chronicles: [] as Chronicle[],

  // ── Session ─────────────────────────────────────────────────────────────
  gameState: 'MENU' as 'MENU' | 'PLAYING' | 'PAUSED',
  globalStats: { pop: 0, deaths: 0 } as GlobalStats,
  simSettings: { speed: 1, warsEnabled: true, breedEnabled: true } as SimSettings,
  currentTool: { id: 'SELECT', type: 'select' } as Tool,
  brushRadius: 1,
  hoverTx: -1,
  hoverTy: -1,
  isDrawing: false,
  nextVillageId: 1,
  selectedVillageId: null as number | null,
  currentMapType: 'random' as MapType,
  villagePanelManuallyClosed: false,
  currentClimate: 'temperate' as ClimateType,
  selectedMapType: null as MapType | null,
  selectedClimate: null as ClimateType | null,
  hasActiveGame: false,
  timeTick: 0,

  // ── Faith / powers / crises ─────────────────────────────────────────────
  divineFaith: 0,
  faithMax: 100,
  nextCrisisId: 1,
  chroniclesOpen: false,

  /** Counters for the food economy, surfaced in the world statistics. */
  foodStats: {
    /** Meals taken out of the village stores. */
    meals: 0,
    /** Meals that could not be served: the stores were empty. */
    missedMeals: 0,
    /** Humans that died of hunger. */
    starvationDeaths: 0,
  },

  /** Why the villagers died, so the world history can explain itself. */
  deathCauses: {
    oldAge: 0,
    starvation: 0,
    drowning: 0,
    disease: 0,
    combat: 0,
    other: 0,
  },

  // ── Camera ──────────────────────────────────────────────────────────────
  camX: 0,
  camY: 0,
  zoom: 1.0,
  isPanning: false,
  startPanX: 0,
  startPanY: 0,
  isMinimapPanning: false,

  // ── Climate ─────────────────────────────────────────────────────────────
  climateParticles: [] as any[],
  climateTimer: 0,
  climateEvent: null as any,

  // ── Input / UI ──────────────────────────────────────────────────────────
  touchState: {
    active: false,
    moved: false,
    startX: 0, startY: 0,
    lastX: 0, lastY: 0,
    startTime: 0,
    longPressTimer: null as any,
    isLongPress: false,
    // Two-finger
    pinchStartDist: 0,
    pinchStartZoom: 1,
    panStartCamX: 0, panStartCamY: 0,
    lastTwoFingerX: 0, lastTwoFingerY: 0,
    fingerCount: 0,
  },
  activeCurseId: 'CURSE',
  previousSpeed: 1,

  // ── Menu state ──────────────────────────────────────────────────────────
  isMenuMusicActive: false,
  currentGameTrackIndex: -1,
  isFadingOut: false,
  lastMoodCheck: 0,
  aboutFromPause: false,
  instructionsFromPause: false,
  settingsFromPause: false,
};

export type GameStateObj = typeof G;

/**
 * Debug hook.
 *
 * The headless test harness (scripts/needs-test.mjs) needs to inspect the
 * live world from the page. Harmless in production and invaluable when
 * tuning the simulation.
 */
if (typeof window !== 'undefined') {
  (window as any).__G = G;
}
