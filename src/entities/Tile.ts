import { TerrainType as TERRAIN } from '../core/types.ts';
import { TerrainType, BuildingType } from '../core/types.ts';
export class Tile {
    x: number;
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
    tradeRoute?: number | null;
    constructor(x, y) { this.x = x; this.y = y; this.type = TERRAIN.WATER; this.ownerId = null; this.hasHouse = false; this.buildingType = null; this.isTownHall = false; this.houseLevel = 0; this.hasRoad = false; this.fireTimer = 0; this.hasBerries = false; }
}
