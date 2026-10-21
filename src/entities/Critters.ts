import { G } from '../core/state.ts';
import { TerrainType as TERRAIN } from '../core/types.ts';
export class Animal {
    x: number;
    y: number;
    vx: number;
    vy: number;
    dead: boolean;
    type: 'sheep' | 'cow';
    dir: number;
    constructor(x, y) { this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.dead = false; this.type = Math.random() < 0.5 ? 'sheep' : 'cow'; this.dir = 1; }
    update() {
        if(Math.random() < 0.02) { this.vx = (Math.random()-0.5)*0.1; this.vy = (Math.random()-0.5)*0.1; this.dir = this.vx > 0 ? 1 : -1; }
        let nx = this.x + this.vx; let ny = this.y + this.vy;
        let tx = Math.floor(nx); let ty = Math.floor(ny);
        if(tx>=0 && tx<G.cols && ty>=0 && ty<G.rows && (G.grid[tx][ty].type === TERRAIN.GRASS || G.grid[tx][ty].type === TERRAIN.SAND || G.grid[tx][ty].type === TERRAIN.FOREST) && !G.grid[tx][ty].hasHouse) { this.x = nx; this.y = ny; }
    }
}

export class Fish {
    x: number;
    y: number;
    vx: number;
    vy: number;
    dead: boolean;
    constructor(x, y) { this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.dead = false; }
    update() {
        if(Math.random() < 0.05) { this.vx = (Math.random()-0.5)*0.2; this.vy = (Math.random()-0.5)*0.2; }
        let nx = this.x + this.vx; let ny = this.y + this.vy;
        let tx = Math.floor(nx); let ty = Math.floor(ny);
        if(tx>=0 && tx<G.cols && ty>=0 && ty<G.rows && G.grid[tx][ty].type === TERRAIN.WATER) { this.x = nx; this.y = ny; }
    }
}
