/**
 * Game constants.
 *
 * IMPORTANT: these values were reconciled against the live game (the monolith
 * that used to live inline in index.html). Several values here previously
 * drifted from the running game and were WRONG:
 *   - BUILDING_COSTS: MARKET/DOCK/WALL/FARM costs did not match the code that
 *     actually charged for them, so markets and docks could never be built.
 *   - MAP_MINERAL_CONFIG: archipelago/continents/frozen had counts the world
 *     generator never used.
 *   - CRISIS_TYPES: PLAGUE_CRISIS description text differed.
 * Re-verify against the simulation before changing anything here.
 */
import {
  TerrainType, BuildingType, Age,
  HumanRole, Personality, ClimateType, MapType,
  DivinePower, CrisisType,
} from './types';

// ── World Dimensions ─────────────────────────────────────────────────────
export const WORLD_COLS = 150;
export const WORLD_ROWS = 150;

/**
 * The size of a world tile, in pixels. This is the native size of the
 * pixel-art tiles in the atlas.
 */
export const TILE_SIZE = 16;

/**
 * The size the procedural (hand-drawn) buildings and units were drawn for.
 * They are rendered at this size and then scaled down to TILE_SIZE, so the
 * art keeps its proportions without every offset having to be re-tuned.
 */
export const LEGACY_TILE = 20;

/** How much the procedural art is scaled to fit a tile. */
export const ART_SCALE = TILE_SIZE / LEGACY_TILE;

// ── Terrain Colors (fallback when no texture is available) ───────────────
export const TERRAIN_COLORS: Record<TerrainType, string> = {
  [TerrainType.WATER]: '#1565C0',
  [TerrainType.SAND]: '#D4A843',
  [TerrainType.GRASS]: '#388E3C',
  [TerrainType.FOREST]: '#1B5E20',
  [TerrainType.FIRE]: '#E65100',
  [TerrainType.IRON]: '#546E7A',
  [TerrainType.GOLD]: '#F9A825',
};

// ── Faction Colors ───────────────────────────────────────────────────────
export const FACTION_COLORS = [
  '#e1b12c', '#c23616', '#8c7ae6', '#4cd137',
  '#0097e6', '#e84118', '#7f8fa6', '#1abc9c',
  '#9b59b6', '#34495e',
];

// ── Name Generation ──────────────────────────────────────────────────────
export const NAME_PREFIXES = [
  'Dor', 'Mal', 'Kal', 'Bor', 'Grom', 'Syl', 'Aet', 'Lun', 'Val',
  'Iron', 'Ocea', 'Mar',
];

export const NAME_SUFFIXES = [
  'ia', 'dor', 'mar', 'heim', 'grad', 'ton', 'berg', 'polis', 'fort', 'port',
];

export const HUMAN_NAMES = [
  'Abel', 'Bera', 'Cain', 'Dara', 'Elian', 'Fael', 'Gael', 'Hera', 'Ira', 'Jael',
  'Kael', 'Lia', 'Mael', 'Nia', 'Orel', 'Pia', 'Quin', 'Rae', 'Sael', 'Tia',
];

export const PERSONALITIES: Personality[] = [
  'Valiente', 'Cobarde', 'Perezoso', 'Trabajador', 'Curioso', 'Normal',
];

export const ROLES: HumanRole[] = [
  'Ninguno', 'Granjero', 'Minero', 'Leñador', 'Constructor',
  'Guerrero', 'Pescador', 'Comerciante', 'Recolector', 'Médico',
];

export const AGES_NAMES = ['', 'Edad de Piedra', 'Edad de Hierro', 'Edad de Oro'];

// ── Climate Textures Mapping ─────────────────────────────────────────────

// ── Tree Climate Tints ───────────────────────────────────────────────────

// ── Divine Powers Definition ─────────────────────────────────────────────
export const DIVINE_POWERS: DivinePower[] = [
  { id: 'RAIN_GOLD',   name: 'Lluvia de Oro',      icon: '💛', cost: 40,  desc: 'Llueve oro sobre una aldea. +500 gold, inspira cultura.',           unlocked: false },
  { id: 'RAISE_HERO',  name: 'Engendrar Héroe',    icon: '⚔️', cost: 30,  desc: 'Un humano común se convierte en Héroe legendario.',                 unlocked: false },
  { id: 'GROW_FOREST', name: 'Bosque Sagrado',     icon: '🌳', cost: 25,  desc: 'Hace crecer un bosque denso. Regenera la tierra.',                  unlocked: false },
  { id: 'EARTHQUAKE',  name: 'Terremoto',          icon: '🌍', cost: 60,  desc: 'Destruye edificios en área pero revela minerales ocultos.',         unlocked: false },
  { id: 'DIVINE_WALL', name: 'Muro Sagrado',       icon: '🏰', cost: 50,  desc: 'Construye un anillo de muros protectores sobre la aldea.',          unlocked: false },
  { id: 'RAPTURE',     name: 'Arrebato',           icon: '✨', cost: 35,  desc: 'Todos los humanos del área se curan y entran en éxtasis productivo.', unlocked: false },
  { id: 'STORM_CALL',  name: 'Invocar Tormenta',   icon: '⛈️', cost: 45,  desc: 'Lluvia que apaga todos los incendios del mapa.',                    unlocked: false },
  { id: 'PLAGUE_CURE', name: 'Cura Divina',        icon: '💊', cost: 20,  desc: 'Cura todas las enfermedades en el área al instante.',               unlocked: false },
];

// ── Crisis Types ─────────────────────────────────────────────────────────
export const CRISIS_TYPES: CrisisType[] = [
  { id: 'FIRE_CRISIS',    title: '¡INCENDIO!',          icon: '🔥', color: '#e8501e', desc: (v: string) => `${v} está en llamas. Actúa rápido.`,              duration: 300 },
  { id: 'INVASION',       title: '¡INVASIÓN!',          icon: '⚔️', color: '#e74c3c', desc: (v: string) => `Guerreros extranjeros atacan ${v}.`,              duration: 400 },
  { id: 'FAMINE_CRISIS',  title: '¡HAMBRUNA!',          icon: '💀', color: '#d35400', desc: (v: string) => `${v} se muere de hambre.`,                         duration: 350 },
  { id: 'PLAGUE_CRISIS',  title: '¡EPIDEMIA!',          icon: '☣️', color: '#8e44ad', desc: (v: string) => `Una plaga devora a ${v}.`,                         duration: 380 },
  { id: 'GOLDEN_AGE',     title: '¡EDAD DE ORO!',       icon: '👑', color: '#f1c40f', desc: (v: string) => `${v} alcanza su apogeo. ¡Bendíceles!`,             duration: 250, bless: true },
  { id: 'HERO_BORN',      title: '¡HÉROE NACE!',        icon: '⭐', color: '#f1c40f', desc: (v: string) => `Un héroe surge en ${v}.`,                          duration: 200, bless: true },
];

// ── Hero Titles ──────────────────────────────────────────────────────────
export const HERO_TITLES = [
  'El Grande', 'El Sabio', 'La Valiente', 'El Conquistador', 'La Fundadora',
  'El Eterno', 'La Profeta', 'El Forjador', 'La Libertadora', 'El Invicto',
];

// ── Building Names (for tooltips) ────────────────────────────────────────
export const BUILDING_NAMES: Record<BuildingType, string> = {
  [BuildingType.HOUSE]: '🏠 Casa',
  [BuildingType.TOWNHALL]: '🏛️ Ayuntamiento',
  [BuildingType.BARRACKS]: '⚔️ Cuartel',
  [BuildingType.FARM]: '🌾 Granja',
  [BuildingType.MINE]: '⛏️ Mina',
  [BuildingType.MARKET]: '🏪 Mercado',
  [BuildingType.WALL]: '🧱 Muro',
  [BuildingType.WINDMILL]: '🌀 Molino',
  [BuildingType.DOCK]: '⚓ Puerto',
  [BuildingType.WELL]: '💧 Pozo',
  [BuildingType.TEMPLE]: '🛕 Templo',
  [BuildingType.WATCHTOWER]: '🗼 Torre',
  [BuildingType.BONFIRE]: '🔥 Hoguera',
};

/**
 * Building costs, reconciled with the code that actually charges them.
 * Every building that falls through to the default costs 30 wood — that
 * default is what HOUSE, FARM, MARKET and DOCK actually charged before.
 */
export const BUILDING_COSTS: Record<BuildingType, { wood: number; iron: number; gold: number }> = {
  [BuildingType.HOUSE]:      { wood: 30,  iron: 0,  gold: 0 },
  [BuildingType.FARM]:       { wood: 30,  iron: 0,  gold: 0 },
  [BuildingType.MARKET]:     { wood: 30,  iron: 0,  gold: 0 },
  [BuildingType.DOCK]:       { wood: 30,  iron: 0,  gold: 0 },
  [BuildingType.BONFIRE]:    { wood: 30,  iron: 0,  gold: 0 },
  [BuildingType.TOWNHALL]:   { wood: 100, iron: 0,  gold: 0 },
  [BuildingType.BARRACKS]:   { wood: 50,  iron: 50, gold: 0 },
  [BuildingType.WATCHTOWER]: { wood: 50,  iron: 50, gold: 0 },
  [BuildingType.MINE]:       { wood: 100, iron: 0,  gold: 0 },
  [BuildingType.WINDMILL]:   { wood: 100, iron: 0,  gold: 0 },
  [BuildingType.WELL]:       { wood: 30,  iron: 10, gold: 0 },
  [BuildingType.TEMPLE]:     { wood: 200, iron: 0,  gold: 300 },
  [BuildingType.WALL]:       { wood: 30,  iron: 20, gold: 0 },
};

// ── Brush Settings ───────────────────────────────────────────────────────
export const BRUSH_SETTINGS = [
  { radius: 0, label: 'Pequeño' },
  { radius: 1, label: 'Mediano' },
  { radius: 2, label: 'Grande' },
  { radius: 3, label: 'Enorme' },
];

// ── Mineral Distribution ─────────────────────────────────────────────────
export const MAP_MINERAL_CONFIG: Record<MapType, { count: number; goldBias: number }> = {
  random:         { count: 60, goldBias: 0.2 },
  pangea:         { count: 60, goldBias: 0.2 },
  archipelago:    { count: 60, goldBias: 0.2 },
  ring:           { count: 60, goldBias: 0.2 },
  continents:     { count: 60, goldBias: 0.2 },
  desert:         { count: 90, goldBias: 0.5 },
  volcanic:       { count: 100, goldBias: 0.45 },
  frozen:         { count: 60, goldBias: 0.2 },
};

// ── Simulation Constants ─────────────────────────────────────────────────
export const SIM_CONSTANTS = {
  FAITH_MAX: 100,
  MAX_HEROES: 6,
  MAX_CRISES: 3,
  MAX_CHRONICLES: 40,
  MAX_PARTICLES: 800,
  BASE_ANIMAL_COUNT: 80,
  BASE_FISH_COUNT: 80,
  MIN_DIST_FOR_TRADE: 80,
  /**
   * The crisis check is gated twice: called every CRISIS_CALL_INTERVAL ticks
   * and internally bails unless `timeTick % CRISIS_INNER_INTERVAL === 0`.
   * The two guards only coincide every lcm(180, 200) = 3600 ticks.
   */
  CRISIS_CALL_INTERVAL: 180,
  CRISIS_INNER_INTERVAL: 200,
  FAITH_GEN_INTERVAL: 60,
  HERO_CHECK_INTERVAL: 60,
  HERO_AURA_INTERVAL: 120,
  CRISIS_UPDATE_INTERVAL: 10,
  ECOSYSTEM_INTERVAL: 120,
  AMBIENT_FX_INTERVAL: 40,
  SAVE_INTERVAL: 300,
  MUSIC_MOOD_INTERVAL: 600,
  WORLD_UPDATE_INTERVAL: 10,
  MINIMAP_UPDATE_INTERVAL: 60,
  PANEL_UPDATE_INTERVAL: 10,
} as const;

export { Age, TerrainType, BuildingType };
