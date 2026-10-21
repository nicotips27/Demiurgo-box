/**
 * Shared types & enums for DemiurgoBox.
 *
 * Entity types (Tile, Village, Human, Animal, Fish) live as real classes in
 * ../entities and are imported from there — this file only holds the
 * primitives that both the simulation and the renderer need to agree on.
 */

// ── Terrain ────────────────────────────────────────────────────────────────
// Values are persisted in the save file as plain integers, so these numbers
// are part of the on-disk format. Do not renumber without a save migration.
export enum TerrainType {
  WATER = 0,
  SAND = 1,
  GRASS = 2,
  FOREST = 3,
  FIRE = 4,
  IRON = 5,
  GOLD = 6,
}

// ── Building Types ────────────────────────────────────────────────────────
export enum BuildingType {
  HOUSE = 1,
  FARM = 2,
  MINE = 3,
  BARRACKS = 4,
  TOWNHALL = 5,
  DOCK = 6,
  MARKET = 7,
  WALL = 8,
  BONFIRE = 9,
  WINDMILL = 10,
  WATCHTOWER = 11,
  WELL = 12,
  TEMPLE = 13,
}

// ── Ages ───────────────────────────────────────────────────────────────────
export enum Age {
  STONE = 1,
  IRON = 2,
  GOLD = 3,
}

export const AGE_NAMES = ['', 'Edad de Piedra', 'Edad de Hierro', 'Edad de Oro'] as const;

// ── Human Roles ───────────────────────────────────────────────────────────
export type HumanRole =
  | 'Ninguno'
  | 'Granjero'
  | 'Minero'
  | 'Leñador'
  | 'Constructor'
  | 'Guerrero'
  | 'Pescador'
  | 'Comerciante'
  | 'Recolector'
  | 'Médico';

export const ROLES: HumanRole[] = [
  'Ninguno', 'Granjero', 'Minero', 'Leñador', 'Constructor',
  'Guerrero', 'Pescador', 'Comerciante', 'Recolector', 'Médico',
];

// ── Personalities ─────────────────────────────────────────────────────────
export type Personality = 'Valiente' | 'Cobarde' | 'Perezoso' | 'Trabajador' | 'Curioso' | 'Normal';

export const PERSONALITIES: Personality[] = [
  'Valiente', 'Cobarde', 'Perezoso', 'Trabajador', 'Curioso', 'Normal',
];

// ── Climate ───────────────────────────────────────────────────────────────
export type ClimateType =
  | 'temperate' | 'tropical' | 'arid' | 'cold'
  | 'stormy' | 'volcanic_climate' | 'plague' | 'blessed';

export const CLIMATES: ClimateType[] = [
  'temperate', 'tropical', 'arid', 'cold',
  'stormy', 'volcanic_climate', 'plague', 'blessed',
];

// ── Map Types ─────────────────────────────────────────────────────────────
export type MapType =
  | 'random' | 'pangea' | 'archipelago' | 'ring'
  | 'continents' | 'desert' | 'volcanic' | 'frozen';

export const MAP_TYPES: MapType[] = [
  'random', 'pangea', 'archipelago', 'ring',
  'continents', 'desert', 'volcanic', 'frozen',
];

// ── Game State ────────────────────────────────────────────────────────────
export type GameState = 'MENU' | 'PLAYING' | 'PAUSED';

export type ToolType = 'select' | 'terrain' | 'god';

export interface Tool {
  id: string | number;
  type: ToolType;
  name?: string;
}

export type HumanState =
  | 'IDLE' | 'WANDER' | 'GATHER' | 'GATHER_FOOD' | 'GATHER_IRON' | 'GATHER_GOLD'
  | 'HUNT' | 'FISH' | 'BUILD' | 'FIGHT' | 'HEAL' | 'TRADE' | 'FLEE' | 'COLONIZE';

export type VillageState = 'PEACE' | 'WAR';

export type BuildingCost = { wood: number; iron: number; gold: number };

export type ClimateTint = { light: [number, number, number]; dark: [number, number, number]; desat: boolean };

export interface SimSettings {
  speed: number;
  warsEnabled: boolean;
  breedEnabled: boolean;
}

export interface GlobalStats {
  pop: number;
  deaths: number;
}

export interface DivinePower {
  id: string;
  name: string;
  icon: string;
  cost: number;
  desc: string;
  unlocked: boolean;
}

/** A crisis *template*. The live crisis object is a different shape. */
export interface CrisisType {
  id: string;
  title: string;
  icon: string;
  color: string;
  desc: (villageName: string) => string;
  duration: number;
  bless?: boolean;
}

export interface ActiveCrisis {
  id: number;
  type: string;
  title: string;
  icon: string;
  color: string;
  desc: string;
  villageId: number;
  villageName: string;
  timer: number;
  maxTimer: number;
  bless: boolean;
  resolved: boolean;
}

export interface Chronicle {
  text: string;
  year: number;
  highlight: boolean;
  id: number;
}

export type WorldMood = 'war' | 'epic' | 'peace' | 'ambient' | 'explore';

export type SoundType =
  | 'click' | 'place' | 'smite' | 'bless' | 'curse' | 'spawn' | 'age_up' | 'alert'
  | 'sword' | 'mine' | 'chop' | 'build' | 'splash' | 'gunshot' | 'machinegun' | 'explosion' | 'coins';

export interface SaveData {
  grid: any[][];
  villages: any[];
  humans: any[];
  animals: any[];
  fishes: any[];
  stats: GlobalStats;
  cam: { x: number; y: number; z: number };
  misc: {
    timeTick: number;
    nextVillageId: number;
    currentMapType: MapType;
    currentClimate: ClimateType;
  };
}
