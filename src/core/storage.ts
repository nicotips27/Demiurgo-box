import { G } from './state.ts';
import { Tile } from '../entities/Tile.ts';
import { Village } from '../entities/Village.ts';
import { Human } from '../entities/Human.ts';
import { Animal, Fish } from '../entities/Critters.ts';
import { updateMinimap } from '../render/minimap.ts';
export function saveGame() {
    if (!G.hasActiveGame || G.gameState !== 'PLAYING') return;
    try {
        const gridData = [];
        for(let x=0; x<G.cols; x++) {
            let col = [];
            for(let y=0; y<G.rows; y++) {
                let t = G.grid[x][y]; let obj: any = { t: t.type };
                if (t.ownerId !== null) obj.o = t.ownerId;
                if (t.hasHouse) obj.h = 1;
                if (t.buildingType !== null) obj.b = t.buildingType;
                if (t.isTownHall) obj.th = 1;
                if (t.houseLevel > 0) obj.hl = t.houseLevel;
                if (t.hasRoad) obj.r = 1;
                if (t.fireTimer > 0) obj.f = t.fireTimer;
                if (t.hasBerries) obj.be = 1;
                col.push(obj);
            }
            gridData.push(col);
        }

        const saveData = {
            grid: gridData,
            villages: G.villages.map(v => ({...v, enemies: Array.from(v.enemies), allies: Array.from(v.allies)})),
            humans: G.humans.map(h => ({...h})), 
            animals: G.animals.map(a => ({x: a.x, y: a.y, type: a.type})),
            fishes: G.fishes.map(f => ({x: f.x, y: f.y})),
            stats: G.globalStats,
            cam: {x: G.camX, y: G.camY, z: G.zoom},
            misc: { timeTick: G.timeTick, nextVillageId: G.nextVillageId, currentMapType: G.currentMapType, currentClimate: G.currentClimate }
        };
        localStorage.setItem('demirgobox_save', JSON.stringify(saveData));
    } catch (e) {
        console.error("Error guardando partida", e);
    }
}

export function loadGame() {
    try {
        const dataStr = localStorage.getItem('demirgobox_save');
        if (!dataStr) return false;
        const data = JSON.parse(dataStr);

        if (G.grid.length !== G.cols || G.grid[0].length !== G.rows) {
            G.grid = []; for (let x = 0; x < G.cols; x++) { G.grid[x] = []; for (let y = 0; y < G.rows; y++) G.grid[x][y] = new Tile(x, y); }
        }

        for(let x=0; x<G.cols; x++) {
            for(let y=0; y<G.rows; y++) {
                let sT = data.grid[x][y]; let t = G.grid[x][y];
                t.type = sT.t; t.ownerId = sT.o !== undefined ? sT.o : null; t.hasHouse = !!sT.h;
                t.buildingType = sT.b !== undefined ? sT.b : null; t.isTownHall = !!sT.th;
                t.houseLevel = sT.hl || 0; t.hasRoad = !!sT.r; t.fireTimer = sT.f || 0;
                t.hasBerries = !!sT.be;
            }
        }

        G.villages = data.villages.map(vData => {
            let v = Object.create(Village.prototype); Object.assign(v, vData);
            v.enemies = new Set(vData.enemies); v.allies = new Set(vData.allies); return v;
        });

        G.humans = data.humans.map(hData => {
            let h = Object.create(Human.prototype); Object.assign(h, hData); return h;
        });

        G.animals = data.animals ? data.animals.map(a => { let an = new Animal(a.x, a.y); an.type = a.type; return an; }) : [];
        G.fishes = data.fishes ? data.fishes.map(f => new Fish(f.x, f.y)) : [];

        G.globalStats = data.stats; G.camX = data.cam.x; G.camY = data.cam.y; G.zoom = data.cam.z;
        G.timeTick = data.misc.timeTick; G.nextVillageId = data.misc.nextVillageId; G.currentMapType = data.misc.currentMapType;
        G.currentClimate = data.misc.currentClimate || 'temperate';
        G.particles = []; G.floatingTexts = []; G.selectedVillageId = null;

        updateMinimap();
        return true;
    } catch (e) {
        console.error("Error cargando partida", e); return false;
    }
}

export function checkSave() {
    if (localStorage.getItem('demirgobox_save') || G.hasActiveGame) {
        (document.getElementById('btn-resume') as HTMLElement).style.display = 'block';
    } else {
        (document.getElementById('btn-resume') as HTMLElement).style.display = 'none';
    }
}

export function manualSave() {
    saveGame();
    let btn = document.getElementById('btn-manual-save');
    let oldText = btn.innerText;
    btn.innerText = "¡Partida Guardada!";
    btn.style.borderColor = "#2ecc71"; btn.style.color = "#2ecc71";
    setTimeout(() => { btn.innerText = oldText; btn.style.borderColor = "#3498db"; btn.style.color = "#3498db"; }, 2000);
}

// --- CLASES DEL MOTOR ---
