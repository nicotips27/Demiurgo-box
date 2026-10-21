import { G } from '../core/state.ts';
import { resizeCanvas, view } from '../core/dom.ts';
import { TILE_SIZE } from '../core/constants.ts';
import { TerrainType as TERRAIN } from '../core/types.ts';
import { Tile } from '../entities/Tile.ts';
import { MapType } from '../core/types.ts';
import { Village } from '../entities/Village.ts';
import { Human } from '../entities/Human.ts';
import { Animal, Fish } from '../entities/Critters.ts';
import { spawnParticles, spawnFloatingText } from './particles.ts';
import { updateMinimap } from '../render/minimap.ts';
import { AudioSystem } from '../audio/sfx.ts';
export function initWorld(mapType: MapType = 'random') {
    resizeCanvas();
    G.grid = []; G.humans = []; G.villages = []; G.particles = []; G.floatingTexts = []; G.nextVillageId = 1;
    G.animals = []; G.fishes = []; G.bullets = []; G.explosions = [];
    G.globalStats.pop = 0; G.globalStats.deaths = 0; G.selectedVillageId = null; G.currentMapType = mapType;
    G.foodStats.meals = 0; G.foodStats.missedMeals = 0; G.foodStats.starvationDeaths = 0;
    G.deathCauses.oldAge = 0; G.deathCauses.starvation = 0; G.deathCauses.drowning = 0;
    G.deathCauses.disease = 0; G.deathCauses.combat = 0; G.deathCauses.other = 0;
    G.frameCounter = 0; G.timeTick = 0;

    for (let x = 0; x < G.cols; x++) { G.grid[x] = []; for (let y = 0; y < G.rows; y++) G.grid[x][y] = new Tile(x, y); }
    generateTerrain(mapType);

    // Generar Vida Salvaje Inicial
    for(let i=0; i<80; i++) {
        let tx = Math.floor(Math.random()*G.cols); let ty = Math.floor(Math.random()*G.rows);
        if (G.grid[tx][ty].type === TERRAIN.GRASS || G.grid[tx][ty].type === TERRAIN.FOREST) G.animals.push(new Animal(tx, ty));
    }
    for(let i=0; i<80; i++) {
        let tx = Math.floor(Math.random()*G.cols); let ty = Math.floor(Math.random()*G.rows);
        if (G.grid[tx][ty].type === TERRAIN.WATER) G.fishes.push(new Fish(tx, ty));
    }

    G.camX = (view.w / 2) - ((G.cols * TILE_SIZE) / 2); G.camY = (view.h / 2) - ((G.rows * TILE_SIZE) / 2);
    updateMinimap();
}

export function generateTerrain(mapType) {
    let tempGrid = []; let cx = G.cols / 2; let cy = G.rows / 2;
    for (let x = 0; x < G.cols; x++) { tempGrid[x] = []; for (let y = 0; y < G.rows; y++) {
        if (mapType === 'random') tempGrid[x][y] = Math.random() < 0.45 ? TERRAIN.GRASS : TERRAIN.WATER;
        else if (mapType === 'archipelago') tempGrid[x][y] = Math.random() < 0.35 ? TERRAIN.GRASS : TERRAIN.WATER;
        else if (mapType === 'pangea') { let isLand = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2)) < 45; if (Math.random() < 0.25) isLand = !isLand; tempGrid[x][y] = isLand ? TERRAIN.GRASS : TERRAIN.WATER; }
        else if (mapType === 'ring') { let dist = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2)); let isLand = (dist > 20 && dist < 50); if (Math.random() < 0.25) isLand = !isLand; tempGrid[x][y] = isLand ? TERRAIN.GRASS : TERRAIN.WATER; }
        // NUEVO: Continentes — 3 masas de tierra separadas
        else if (mapType === 'continents') {
            let centers = [{x:G.cols*0.2, y:G.rows*0.5}, {x:G.cols*0.55, y:G.rows*0.35}, {x:G.cols*0.8, y:G.rows*0.65}];
            let isLand = centers.some(c => Math.sqrt(Math.pow(x-c.x,2)+Math.pow(y-c.y,2)) < 22 + Math.sin(x*0.3+y*0.2)*8);
            if (Math.random() < 0.18) isLand = !isLand;
            tempGrid[x][y] = isLand ? TERRAIN.GRASS : TERRAIN.WATER;
        }
        // NUEVO: Desierto — gran masa de tierra con muy poca agua, mucha arena
        else if (mapType === 'desert') {
            let isLand = Math.random() < 0.75;
            // Ríos sinuosos
            let riverY1 = cy + Math.sin(x * 0.12) * 15;
            let riverY2 = cy * 0.4 + Math.sin(x * 0.08 + 2) * 10;
            if (Math.abs(y - riverY1) < 2 || Math.abs(y - riverY2) < 2) isLand = false;
            tempGrid[x][y] = isLand ? TERRAIN.GRASS : TERRAIN.WATER;
        }
        // NUEVO: Volcánico — islas volcánicas con lava/fuego
        else if (mapType === 'volcanic') {
            let volcanoes = [{x:G.cols*0.3,y:G.rows*0.4},{x:G.cols*0.65,y:G.rows*0.55},{x:G.cols*0.5,y:G.rows*0.2},{x:G.cols*0.2,y:G.rows*0.75}];
            let nearVol = volcanoes.find(v => Math.sqrt(Math.pow(x-v.x,2)+Math.pow(y-v.y,2)) < 18);
            let isLand = nearVol ? Math.random() < 0.75 : Math.random() < 0.25;
            tempGrid[x][y] = isLand ? TERRAIN.GRASS : TERRAIN.WATER;
        }
        // NUEVO: Tundra — gran masa helada, pocos recursos visibles
        else if (mapType === 'frozen') {
            let isLand = Math.random() < 0.65;
            // Grietas de hielo como ríos
            if (Math.abs((x + y) % 18) < 2 && Math.random() < 0.4) isLand = false;
            tempGrid[x][y] = isLand ? TERRAIN.GRASS : TERRAIN.WATER;
        }
    }}
    let passes = (mapType === 'archipelago' || mapType === 'volcanic') ? 3 : (mapType === 'desert' || mapType === 'frozen') ? 6 : 5;
    for (let i = 0; i < passes; i++) {
        let newGrid = [];
        for (let x = 0; x < G.cols; x++) { newGrid[x] = []; for (let y = 0; y < G.rows; y++) {
            let grassCount = 0;
            for(let ocx = -1; ocx <= 1; ocx++) { for(let ocy = -1; ocy <= 1; ocy++) { let nx = x + ocx; let ny = y + ocy; if(nx >= 0 && nx < G.cols && ny >= 0 && ny < G.rows) { if(tempGrid[nx][ny] === TERRAIN.GRASS) grassCount++; } } }
            newGrid[x][y] = grassCount > 4 ? TERRAIN.GRASS : TERRAIN.WATER;
        }}
        tempGrid = newGrid;
    }
    for (let x = 0; x < G.cols; x++) { for (let y = 0; y < G.rows; y++) {
        G.grid[x][y].type = tempGrid[x][y];
        if(G.grid[x][y].type === TERRAIN.GRASS) {
            let touchesWater = false;
            for(let ocx = -1; ocx <= 1; ocx++) { for(let ocy = -1; ocy <= 1; ocy++) { let nx = x + ocx; let ny = y + ocy; if(nx >= 0 && nx < G.cols && ny >= 0 && ny < G.rows && tempGrid[nx][ny] === TERRAIN.WATER) touchesWater = true; } }
            if(touchesWater && Math.random() < 0.6) G.grid[x][y].type = TERRAIN.SAND; 
            else if(!touchesWater && Math.random() < 0.15) G.grid[x][y].type = TERRAIN.FOREST;
            if (G.grid[x][y].type === TERRAIN.GRASS && Math.random() < 0.05) G.grid[x][y].hasBerries = true;
        }
    }}
    // Volcánico: añadir fuego/lava en los picos
    if(mapType === 'volcanic') {
        let volcanoes = [{x:Math.floor(G.cols*0.3),y:Math.floor(G.rows*0.4)},{x:Math.floor(G.cols*0.65),y:Math.floor(G.rows*0.55)},{x:Math.floor(G.cols*0.5),y:Math.floor(G.rows*0.2)},{x:Math.floor(G.cols*0.2),y:Math.floor(G.rows*0.75)}];
        volcanoes.forEach(v => {
            for(let r=-3;r<=3;r++) for(let c=-3;c<=3;c++) {
                let nx=v.x+c, ny=v.y+r;
                if(nx>=0&&nx<G.cols&&ny>=0&&ny<G.rows&&Math.sqrt(r*r+c*c)<2.5) G.grid[nx][ny].type = TERRAIN.FIRE;
            }
        });
    }
    // Desierto: convertir mayoría de grass a sand, sin bosques
    if(mapType === 'desert') {
        for(let x=0;x<G.cols;x++) for(let y=0;y<G.rows;y++) {
            if(G.grid[x][y].type === TERRAIN.FOREST) G.grid[x][y].type = TERRAIN.SAND;
            if(G.grid[x][y].type === TERRAIN.GRASS && Math.random() < 0.7) G.grid[x][y].type = TERRAIN.SAND;
        }
    }
    // Tundra: pocas bayas, mucho terreno helado (visual via clima)
    if(mapType === 'frozen') {
        for(let x=0;x<G.cols;x++) for(let y=0;y<G.rows;y++) {
            if(G.grid[x][y].hasBerries && Math.random() < 0.7) G.grid[x][y].hasBerries = false;
            if(G.grid[x][y].type === TERRAIN.FOREST && Math.random() < 0.5) G.grid[x][y].type = TERRAIN.GRASS;
        }
    }
    // Distribución de minerales (desierto y volcánico tienen más)
    let mineralCount = mapType === 'desert' ? 90 : mapType === 'volcanic' ? 100 : 60;
    let goldBias = mapType === 'desert' ? 0.5 : mapType === 'volcanic' ? 0.45 : 0.2;
    for(let i=0; i<mineralCount; i++) {
        let tx = Math.floor(Math.random()*G.cols); let ty = Math.floor(Math.random()*G.rows);
        if(G.grid[tx][ty].type === TERRAIN.GRASS || G.grid[tx][ty].type === TERRAIN.FOREST || G.grid[tx][ty].type === TERRAIN.SAND) {
            let type = Math.random() < goldBias ? TERRAIN.GOLD : TERRAIN.IRON;
            for(let ocx = -2; ocx <= 2; ocx++) { for(let ocy = -2; ocy <= 2; ocy++) { let nx = tx + ocx; let ny = ty + ocy; if(nx>=0 && nx<G.cols && ny>=0 && ny<G.rows && (G.grid[nx][ny].type === TERRAIN.GRASS || G.grid[nx][ny].type === TERRAIN.FOREST || G.grid[nx][ny].type === TERRAIN.SAND)) { if(Math.random() < 0.5) G.grid[nx][ny].type = type; } } }
        }
    }
}

export function applyClimateToWorld(climate) {
    G.currentClimate = climate;
    // Modificar el terreno inicial según el clima
    for(let x=0;x<G.cols;x++) for(let y=0;y<G.rows;y++) {
        let t = G.grid[x][y];
        if(climate === 'tropical' && t.type === TERRAIN.GRASS && Math.random() < 0.25) t.type = TERRAIN.FOREST;
        if(climate === 'tropical' && t.type === TERRAIN.GRASS && Math.random() < 0.1) t.hasBerries = true;
        if(climate === 'arid') {
            if(t.type === TERRAIN.FOREST && Math.random() < 0.6) t.type = TERRAIN.SAND;
            if(t.type === TERRAIN.GRASS && Math.random() < 0.35) t.type = TERRAIN.SAND;
            if(t.hasBerries && Math.random() < 0.7) t.hasBerries = false;
        }
        if(climate === 'cold') {
            if(t.type === TERRAIN.FOREST && Math.random() < 0.3) t.type = TERRAIN.GRASS;
            if(t.hasBerries && Math.random() < 0.5) t.hasBerries = false;
        }
        if(climate === 'volcanic_climate' && t.type === TERRAIN.GRASS && Math.random() < 0.04) t.type = TERRAIN.FIRE;
        if(climate === 'plague') {
            if(t.type === TERRAIN.FOREST && Math.random() < 0.2) { t.type = TERRAIN.GRASS; t.hasBerries = false; }
        }
        if(climate === 'blessed') {
            if(t.type === TERRAIN.GRASS && Math.random() < 0.15) t.hasBerries = true;
            if(t.type === TERRAIN.SAND && Math.random() < 0.3) t.type = TERRAIN.GRASS;
        }
    }
    // Cargar texturas del clima
    // Mostrar nombre del clima al inicio
    setTimeout(() => spawnFloatingText(G.cols/2, G.rows/2, `Clima: ${climate.toUpperCase()}`, '#f1c40f'), 600);
}

// Overlay visual del clima


export function updateClimate() {
    if(G.gameState !== 'PLAYING') return;
    G.climateTimer++;

    // Efectos periódicos por clima
    switch(G.currentClimate) {
        case 'stormy':
            // Rayos aleatorios cada ~600 ticks
            if(G.climateTimer % 600 === 0 && Math.random() < 0.5) {
                let lx = Math.floor(Math.random()*G.cols), ly = Math.floor(Math.random()*G.rows);
                let t = G.grid[lx][ly];
                if(t.type === TERRAIN.GRASS || t.type === TERRAIN.FOREST) {
                    t.type = TERRAIN.FIRE;
                    spawnParticles(lx+0.5, ly+0.5, '#FFD700', 30, 40);
                    spawnFloatingText(lx, ly, '⚡ RAYO', '#FFD700');
                }
            }
            // Reducir producción de cultivos durante tormenta
            if(G.climateTimer % 1800 === 0) G.villages.forEach(v => { v.food = Math.max(0, v.food - 30); });
            break;
        case 'volcanic_climate':
            // Erupciones cada ~1800 ticks
            if(G.climateTimer % 1800 === 0 && Math.random() < 0.4) {
                let ex = Math.floor(Math.random()*G.cols), ey = Math.floor(Math.random()*G.rows);
                for(let r=-2;r<=2;r++) for(let c=-2;c<=2;c++) {
                    let nx=ex+c,ny=ey+r;
                    if(nx>=0&&nx<G.cols&&ny>=0&&ny<G.rows&&Math.random()<0.6) G.grid[nx][ny].type=TERRAIN.FIRE;
                }
                spawnParticles(ex+0.5,ey+0.5,'#FF4500',50,60);
                spawnFloatingText(ex,ey,'🌋 ERUPCIÓN','#FF4500');
            }
            break;
        case 'plague':
            // Propagación de enfermedad entre humanos más rápida
            if(G.climateTimer % 300 === 0 && Math.random() < 0.3) {
                let healthy = G.humans.filter(h => !h.disease && Math.random() < 0.05);
                healthy.forEach(h => { if(Math.random() < 0.08) h.disease = true; });
            }
            break;
        case 'cold':
            // Los humanos necesitan más comida en invierno
            if(G.climateTimer % 1200 === 0) G.villages.forEach(v => { v.food = Math.max(0, v.food - 20); });
            break;
        case 'arid':
            // Ralentizar la recolección de comida
            if(G.climateTimer % 900 === 0) G.villages.forEach(v => { if(v.food > 0) v.food = Math.max(0, v.food - 15); });
            break;
        case 'tropical':
            // Bosques se expanden más rápido
            if(G.climateTimer % 200 === 0) {
                let forests = [];
                for(let x=0;x<G.cols;x++) for(let y=0;y<G.rows;y++) if(G.grid[x][y].type===TERRAIN.FOREST) forests.push({x,y});
                if(forests.length > 0) {
                    let f = forests[Math.floor(Math.random()*forests.length)];
                    let nx=f.x+Math.floor(Math.random()*3)-1, ny=f.y+Math.floor(Math.random()*3)-1;
                    if(nx>=0&&nx<G.cols&&ny>=0&&ny<G.rows&&G.grid[nx][ny].type===TERRAIN.GRASS&&!G.grid[nx][ny].hasHouse) G.grid[nx][ny].type=TERRAIN.FOREST;
                }
            }
            break;
        case 'blessed':
            // Bayas reaparecen más rápido
            if(G.climateTimer % 600 === 0) {
                for(let x=0;x<G.cols;x++) for(let y=0;y<G.rows;y++) if(G.grid[x][y].type===TERRAIN.GRASS&&!G.grid[x][y].hasBerries&&!G.grid[x][y].hasHouse&&Math.random()<0.002) G.grid[x][y].hasBerries=true;
            }
            break;
    }
}

window.addEventListener('resize', () => { resizeCanvas(); updateMinimap(); });
