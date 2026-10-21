import { G } from '../core/state.ts';
import { PERSONALITIES } from '../core/constants.ts';
import { TerrainType as TERRAIN } from '../core/types.ts';
import { BuildingType as BLD } from '../core/types.ts';
import { generateHumanName, adjustColor, findResource } from '../utils/helpers.ts';
import { spawnParticles, spawnFloatingText } from '../systems/particles.ts';
import { spawnBullet, spawnExplosion } from '../systems/combat.ts';
import { AudioSystem } from '../audio/sfx.ts';
import { gainFaith, addChronicle, trySpawnHero } from '../systems/faith.ts';
import { createVillage } from '../systems/sim.ts';
import { BuildingType, HumanRole, Personality } from '../core/types.ts';
export class Human {
    x: number;
    y: number;
    villageId: number;
    hp: number;
    maxHp: number;
    hunger: number;
    state: string;
    disease: boolean;
    vx: number;
    vy: number;
    dir: number;
    target: { x: number, y: number } | null;
    buildTarget: BuildingType | null;
    isColonist: boolean;
    actionTimer: number;
    name: string;
    age: number;
    maxAge: number;
    personality: Personality;
    role: HumanRole;
    exp: number;
    memory: any;
    shirtColor: string;
    isHero: boolean;
    heroTitle: string;
    heroDeeds: number;
    isGeneral: boolean;
    isMad: boolean;
    madTimer: number;
    madOriginalVillage: number | null;
    isZombie: boolean;
    isScavenging: boolean;
    isReturning: boolean;
    dead: boolean;
    /** True while the human has run out of food and is losing health. */
    starving: boolean;
    /** True while the human is standing in water. */
    inWater: boolean;
    constructor(x, y, vId, startAge = 18) {
        this.x = x; this.y = y; this.villageId = vId; this.hp = 100; this.maxHp = 100; this.hunger = 100;
        this.state = 'IDLE'; this.disease = false; this.vx = 0; this.vy = 0; this.dir = 1; this.target = null; this.buildTarget = null; this.isColonist = false; this.actionTimer = 0; 
        this.name = generateHumanName(); this.age = startAge; this.maxAge = 60 + (Math.random() * 30); this.personality = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
        this.role = 'Ninguno'; this.exp = 0; this.memory = null; this.starving = false; this.inWater = false;
        let v = G.villages.find(v => v.id === this.villageId); this.shirtColor = adjustColor(v ? v.color : '#3498db', (Math.random() - 0.5) * 40);
    }
    getTile() { let tx = Math.floor(this.x); let ty = Math.floor(this.y); if(tx<0) tx=0; if(tx>=G.cols) tx=G.cols-1; if(ty<0) ty=0; if(ty>=G.rows) ty=G.rows-1; return G.grid[tx][ty]; }

    /**
     * The closest tile that is not water, searching outwards from here.
     * Used to drag drowning villagers back to the shore.
     */
    nearestLand(): { x: number; y: number } | null {
        const cx = Math.floor(this.x);
        const cy = Math.floor(this.y);
        for (let r = 1; r <= 12; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    // only the ring at this radius
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                    const nx = cx + dx, ny = cy + dy;
                    if (nx < 0 || nx >= G.cols || ny < 0 || ny >= G.rows) continue;
                    const t = G.grid[nx][ny];
                    if (t.type !== TERRAIN.WATER && t.type !== TERRAIN.FIRE) return { x: nx, y: ny };
                }
            }
        }
        return null;
    }

    /**
     * Take a meal out of the village stores.
     *
     * The village's food pool is the only source of nourishment: farms,
     * foraging, hunting and fishing all top it up, and every human has to
     * eat from it. Returns how much was actually eaten.
     */
    feed(amount: number): number {
        const v = G.villages.find(v => v.id === this.villageId);
        if (!v) return 0;
        const take = Math.min(amount, Math.max(0, v.food));
        if (take <= 0) { G.foodStats.missedMeals++; return 0; }
        v.food -= take;
        this.hunger = Math.min(100, this.hunger + take);
        if (this.hunger > 20) this.starving = false;
        G.foodStats.meals++;
        return take;
    }

    /**
     * Eat some of what was just gathered, and put the rest in the village
     * stores. Foraging, hunting and fishing all work this way.
     */
    store(share: number, eatRatio = 0.5): void {
        const v = G.villages.find(v => v.id === this.villageId);
        const eaten = Math.round(share * eatRatio);
        if (v) v.food += share - eaten;
        this.hunger = Math.min(100, this.hunger + eaten);
        if (this.hunger > 20) this.starving = false;
    }
    update() {
        let tile = this.getTile(); let v = G.villages.find(v => v.id === this.villageId);
        if(!v && !this.isColonist) { this.die('other'); return; }
        if(this.hp <= 0) { this.die(this.starving ? 'starvation' : (this.inWater ? 'drowning' : (this.disease ? 'disease' : 'combat'))); return; }

        this.age += 0.0033; if (this.age >= this.maxAge) { this.die('oldAge'); return; }
        if(v) this.maxHp = 100 + (v.culture * 0.5);

        this.hunger -= 0.005 * (this.age < 15 ? 0.5 : 1);
        if(this.disease) {
            this.hp -= 0.5; if(Math.random() < 0.05) spawnParticles(this.x, this.y, '#badc58', 1, 15);
            if(Math.random() < 0.01) G.humans.forEach(other => { if(!other.disease && Math.abs(other.x - this.x) < 2 && Math.abs(other.y - this.y) < 2) other.disease = true; });
        }
        if(this.hunger <= 0) {
            this.hunger = 0;
            this.starving = true;
            this.hp -= 1;
        } else if (this.hunger > 20) {
            this.starving = false;
        }

        if(tile.type === TERRAIN.FIRE) this.hp -= 5;
        this.inWater = tile.type === TERRAIN.WATER;
        if(tile.type === TERRAIN.WATER && this.state !== 'FISH') {
            // In the water: start drowning. Head for the nearest shore.
            this.hp -= 5;
            if (this.state !== 'SWIM') {
                const shore = this.nearestLand();
                if (shore) {
                    this.state = 'SWIM';
                    this.target = { x: shore.x + 0.5, y: shore.y + 0.5 };
                }
            }
        } else if (this.state === 'SWIM') {
            this.state = 'IDLE';
        }

        if(v && tile.ownerId === v.id && !tile.hasRoad && Math.random() < 0.015 && tile.type !== TERRAIN.WATER) {
            tile.hasRoad = true;
        }
        // Comerciante en ruta: pavimenta tiles en su camino hacia aldea aliada
        if(this.state === 'TRADE' && this.memory && this.memory.targetVillage) {
            let curTx = Math.floor(this.x), curTy = Math.floor(this.y);
            if(curTx>=0 && curTx<G.cols && curTy>=0 && curTy<G.rows) {
                let ct = G.grid[curTx][curTy];
                if(ct.type !== TERRAIN.WATER && ct.type !== TERRAIN.FIRE) {
                    ct.hasRoad = true;
                    // Marcar de qué nación viene esta ruta para colorearla
                    if(!ct.tradeRoute) ct.tradeRoute = v.id;
                }
            }
        }
        // Cuando regresa a casa, también construye en su camino
        if(this.state === 'TRADE' && this.isReturning && v) {
            let curTx = Math.floor(this.x), curTy = Math.floor(this.y);
            if(curTx>=0 && curTx<G.cols && curTy>=0 && curTy<G.rows) {
                let ct = G.grid[curTx][curTy];
                if(ct.type !== TERRAIN.WATER && ct.type !== TERRAIN.FIRE) ct.hasRoad = true;
            }
        }

        // While swimming to the shore, do not change your mind.
        if(this.state !== 'SWIM' && (!this.target || (Math.random() < 0.22 && this.actionTimer <= 0))) this.decideNextAction(v, tile);

        if(this.target) {
            let dx = this.target.x - this.x; let dy = this.target.y - this.y; let dist = Math.sqrt(dx*dx + dy*dy);

            // Seguimiento de presas móviles
            if (this.state === 'HUNT' && this.memory && this.memory.targetAnimal && !this.memory.targetAnimal.dead) {
                this.target.x = this.memory.targetAnimal.x; this.target.y = this.memory.targetAnimal.y;
                dx = this.target.x - this.x; dy = this.target.y - this.y; dist = Math.sqrt(dx*dx + dy*dy);
            }
            if (this.state === 'FISH' && this.memory && this.memory.targetFish && !this.memory.targetFish.dead) {
                this.target.x = this.memory.targetFish.x; this.target.y = this.memory.targetFish.y;
                dx = this.target.x - this.x; dy = this.target.y - this.y; dist = Math.sqrt(dx*dx + dy*dy);
            }

            if(dist > 0.8) {
                // Velocidad base tranquila
                let baseSpeed = 0.035 + (v ? v.culture * 0.00015 : 0);
                if (this.age < 15) baseSpeed *= 1.15;
                if (this.age > 55) baseSpeed *= 0.8;
                if (this.role === 'Guerrero') baseSpeed *= 1.2;
                if (this.personality === 'Perezoso') baseSpeed *= 0.75;
                if (this.personality === 'Trabajador') baseSpeed *= 1.1;
                if (this.state === 'FLEE') baseSpeed *= 1.5;
                if (this.state === 'COLONIZE') baseSpeed *= 1.1;

                // ── STEERING POR COSTE DE TILE ──────────────────────────
                const isFisher = this.state === 'FISH';
                const isExplorer = this.isScavenging || this.state === 'GATHER' || this.state === 'GATHER_IRON' || this.state === 'GATHER_GOLD';
                const isGatherer = this.state === 'GATHER'; // leñador puede talar bosque

                function tileCost(tx, ty, swimming) {
                    if (tx < 0 || tx >= G.cols || ty < 0 || ty >= G.rows) return 999;
                    let t = G.grid[tx][ty];
                    if (!isFisher) {
                        // Water is impassable, unless you are already in it:
                        // a drowning villager has to be able to path back to
                        // the shore.
                        if (t.type === TERRAIN.WATER) return swimming ? 20 : 999;
                        if (t.type === TERRAIN.FIRE)  return 300;
                        // Muros bloquean salvo que seas guerrero atacándolos
                        if (t.hasHouse && t.buildingType === BLD.WALL) return 250;
                        // Edificios ajenos tienen costo alto pero no infranqueable
                        if (t.hasHouse && t.buildingType !== BLD.FARM && t.buildingType !== BLD.MINE && t.buildingType !== BLD.BONFIRE) return 60;
                        // Caminos: coste mínimo — siempre preferidos
                        if (t.hasRoad) return 0;
                        // Bosque: leñadores lo ven barato (van a talarlo); otros lo evitan un poco
                        if (t.type === TERRAIN.FOREST) return isGatherer ? 2 : (isExplorer ? 6 : 20);
                        // Arena: terreno pobre, se evita si hay alternativa
                        if (t.type === TERRAIN.SAND) return 15;
                        // Pasto: terreno normal, preferido sobre arena
                        if (t.type === TERRAIN.GRASS) return 5;
                        // Hierro/oro/etc: transitable
                        return 5;
                    } else {
                        if (t.type !== TERRAIN.WATER) return 60;
                        return 0;
                    }
                }

                // Radio de steering ampliado a 2 tiles para ver más lejos y rodear mejor
                let cx = Math.floor(this.x), cy = Math.floor(this.y);
                let bestScore = Infinity, bestMoveX = 0, bestMoveY = 0;

                for (let nx = cx - 2; nx <= cx + 2; nx++) {
                    for (let ny = cy - 2; ny <= cy + 2; ny++) {
                        if (nx === cx && ny === cy) continue;
                        let stepCost = tileCost(nx, ny, this.inWater);
                        if (stepCost >= 900) continue; // descarta obstáculos duros (agua)
                        // Coste del tile intermedio si saltamos 2
                        let midX = cx + Math.sign(nx-cx), midY = cy + Math.sign(ny-cy);
                        let midCost = (Math.abs(nx-cx) > 1 || Math.abs(ny-cy) > 1) ? tileCost(midX, midY, this.inWater) : 0;
                        if (midCost >= 900) continue;
                        let toGoalX = this.target.x - (nx + 0.5);
                        let toGoalY = this.target.y - (ny + 0.5);
                        let toGoal  = Math.sqrt(toGoalX*toGoalX + toGoalY*toGoalY);
                        let score = stepCost + midCost * 0.5 + toGoal * 2;
                        if (score < bestScore) {
                            bestScore = score;
                            bestMoveX = (nx + 0.5) - this.x;
                            bestMoveY = (ny + 0.5) - this.y;
                        }
                    }
                }

                // Si todos los vecinos están bloqueados, intenta moverse directo
                if (bestMoveX === 0 && bestMoveY === 0) { bestMoveX = dx; bestMoveY = dy; }

                let moveLen = Math.sqrt(bestMoveX*bestMoveX + bestMoveY*bestMoveY);
                let desiredVx = (bestMoveX / moveLen) * baseSpeed;
                let desiredVy = (bestMoveY / moveLen) * baseSpeed;

                // Bonus de velocidad si ya está sobre un camino
                let curTile = this.getTile();
                if (curTile && curTile.hasRoad) { desiredVx *= 1.2; desiredVy *= 1.2; }

                // Separación muy suave entre NPCs cercanos
                let sepX = 0, sepY = 0;
                for (let hi = 0; hi < G.humans.length; hi++) {
                    let other = G.humans[hi];
                    if (other === this) continue;
                    let odx = this.x - other.x, ody = this.y - other.y;
                    let od = odx*odx + ody*ody;
                    if (od < 0.8 && od > 0.001) {
                        let inv = 0.012 / Math.sqrt(od);
                        sepX += odx * inv; sepY += ody * inv;
                    }
                }
                desiredVx += sepX; desiredVy += sepY;

                // Huir suavemente de enfermos
                if (!this.disease) {
                    G.humans.forEach(other => {
                        if (other.disease && Math.abs(other.x - this.x) < 3 && Math.abs(other.y - this.y) < 3) {
                            desiredVx += (this.x - other.x) * 0.02;
                            desiredVy += (this.y - other.y) * 0.02;
                        }
                    });
                }

                // Inercia fuerte: movimiento suave y fluido
                let inertia = this.state === 'FIGHT' ? 0.18 : 0.1;
                this.vx = this.vx * (1 - inertia) + desiredVx * inertia;
                this.vy = this.vy * (1 - inertia) + desiredVy * inertia;

                this.x += this.vx; this.y += this.vy;
                if(this.vx > 0.005) this.dir = 1; else if(this.vx < -0.005) this.dir = -1;

                // ── ABRIR CAMINO AL EXPLORAR ─────────────────────────────
                // Leñadores y exploradores talan árboles y destruyen arbustos
                // en el tile donde están si les bloquea el paso.
                if(this.isScavenging || this.state === 'GATHER' || this.state === 'GATHER_IRON' || this.state === 'GATHER_GOLD') {
                    let curTx = Math.floor(this.x), curTy = Math.floor(this.y);
                    if(curTx>=0 && curTx<G.cols && curTy>=0 && curTy<G.rows) {
                        let curT = G.grid[curTx][curTy];
                        // Talar bosque en el camino (leñadores siempre, otros con baja prob)
                        if(curT.type === TERRAIN.FOREST && !curT.hasHouse) {
                            let clearChance = this.role === 'Leñador' ? 0.08 : 0.02;
                            if(Math.random() < clearChance) {
                                curT.type = TERRAIN.GRASS;
                                // Pequeño bonus de madera por talar en el camino
                                if(v) v.wood += 8;
                                spawnParticles(this.x, this.y, '#8B4513', 6, 12);
                            }
                        }
                        // Destruir arbusto de bayas en el camino: va a las
                        // despensas de la aldea, apenas un bocado para el
                        // caminante.
                        if(curT.hasBerries && !curT.hasHouse && Math.random() < 0.15) {
                            curT.hasBerries = false;
                            this.store(5, 0.2);
                            spawnParticles(this.x, this.y, '#e74c3c', 4, 10);
                        }
                    }
                }
            } else {
                if(['GATHER', 'GATHER_IRON', 'GATHER_GOLD', 'BUILD', 'FISH', 'TRADE', 'GATHER_FOOD', 'HUNT'].includes(this.state)) {
                    // Si llegó pero el recurso ya no está, buscar nuevo inmediatamente
                    let arrivedAtEmpty = false;
                    if(this.state === 'GATHER' && tile.type !== TERRAIN.FOREST) { arrivedAtEmpty = true; this.memory = null; }
                    if(this.state === 'GATHER_IRON' && tile.type !== TERRAIN.IRON) { arrivedAtEmpty = true; this.memory = null; }
                    if(this.state === 'GATHER_GOLD' && tile.type !== TERRAIN.GOLD) { arrivedAtEmpty = true; this.memory = null; }
                    if(arrivedAtEmpty) { this.target = null; this.decideNextAction(v, tile); return; }

                    if(this.actionTimer <= 0) { let delay = 60; if(this.personality === 'Perezoso') delay = 90; else if(this.personality === 'Trabajador') delay = 40; delay = Math.max(10, delay - Math.floor(this.exp / 10)); this.actionTimer = delay; }
                    this.actionTimer--; this.vx = 0; this.vy = 0;
                    if(this.actionTimer % 8 === 0) {
                        if(this.state === 'GATHER_IRON') { spawnParticles(this.x, this.y, '#bdc3c7', 5, 12); spawnParticles(this.x, this.y, '#78909C', 2, 8); }
                        if(this.state === 'GATHER_GOLD') { spawnParticles(this.x, this.y, '#f1c40f', 5, 12); spawnParticles(this.x, this.y, '#FFF176', 2, 8); }
                        if(this.state === 'GATHER') { spawnParticles(this.x, this.y, '#8B4513', 5, 12); spawnParticles(this.x, this.y, '#A0522D', 2, 8); }
                        if(this.state === 'BUILD') { spawnParticles(this.x, this.y, '#BCAAA4', 4, 10); }
                        if(this.state === 'GATHER_FOOD') { spawnParticles(this.x, this.y, '#4CAF50', 3, 10); }
                    }
                    if(this.actionTimer <= 0) { this.target = null; this.performAction(v, tile); }
                } else { this.target = null; this.performAction(v, tile); }
            }
        } else { this.vx = 0; this.vy = 0; }
    }

    decideNextAction(v, currentTile) {
        if(this.isColonist) {
            if(!currentTile.ownerId && currentTile.type === TERRAIN.GRASS && Math.random() < 0.05) { createVillage(currentTile.x, currentTile.y); this.villageId = G.villages[G.villages.length-1].id; this.isColonist = false; this.state = 'IDLE'; } 
            else { this.target = {x: this.x + (Math.random()*30-15), y: this.y + (Math.random()*30-15)}; }
            return;
        }
        if(!v) return;

        let nearbyFire = false;
        for(let cx=-1; cx<=1; cx++) { for(let cy=-1; cy<=1; cy++) { let nx = Math.floor(this.x)+cx, ny = Math.floor(this.y)+cy; if(nx>=0 && nx<G.cols && ny>=0 && ny<G.rows && G.grid[nx][ny].type === TERRAIN.FIRE) nearbyFire = true; } }
        if (nearbyFire) { this.target = {x: this.x + (Math.random()-0.5)*10, y: this.y + (Math.random()-0.5)*10}; this.state = 'FLEE'; return; }
        if (this.hp < 40 && this.personality !== 'Valiente' && v.enemies.size > 0) { this.target = {x: v.centerX, y: v.centerY}; this.state = 'FLEE'; return; }
        // Critically wounded (any role) flees to village center
        if (this.hp < 20) { this.target = {x: v.centerX, y: v.centerY}; this.state = 'FLEE'; return; }

        // Médico: ir a curar heridos
        if(this.role === 'Médico') {
            let wounded = G.humans.find(h => h.villageId === v.id && h !== this && h.hp < h.maxHp * 0.6 && Math.abs(h.x-this.x)<20 && Math.abs(h.y-this.y)<20);
            if(wounded) { this.target = {x: wounded.x, y: wounded.y}; this.state = 'HEAL'; this.memory = {targetHuman: wounded}; return; }
        }

        if (this.hunger < 30) {
            // Eat from the village stores when there is something to eat.
            if (v.food >= 5) {
                let farms = v.territory.filter(t => G.grid[t.x][t.y].buildingType === BLD.FARM || G.grid[t.x][t.y].buildingType === BLD.DOCK);
                if (farms.length > 0) {
                    let f = farms[Math.floor(Math.random() * farms.length)];
                    this.target = {x: f.x + 0.5, y: f.y + 0.5};
                } else {
                    this.target = {x: v.centerX + 0.5, y: v.centerY + 0.5};
                }
                this.state = 'GATHER_FOOD';
                return;
            }
            // The stores are empty: go and forage whatever is left.
            let berries = [];
            for (let nx = Math.floor(this.x) - 30; nx <= Math.floor(this.x) + 30; nx += 5) {
                for (let ny = Math.floor(this.y) - 30; ny <= Math.floor(this.y) + 30; ny += 5) {
                    if (nx >= 0 && nx < G.cols && ny >= 0 && ny < G.rows && G.grid[nx][ny].hasBerries) berries.push({x: nx, y: ny});
                }
            }
            if (berries.length > 0) {
                let t = berries[Math.floor(Math.random() * berries.length)];
                this.target = {x: t.x + 0.5, y: t.y + 0.5};
            } else {
                // Nothing at all to eat: wait at the village square.
                this.target = {x: v.centerX + 0.5, y: v.centerY + 0.5};
            }
            this.state = 'GATHER_FOOD';
            return;
        }

        if (this.age < 15) { if(v.territory.length > 0) { let t = v.territory[Math.floor(Math.random() * v.territory.length)]; this.target = {x: t.x + 0.5, y: t.y + 0.5}; this.state = 'WANDER'; } return; }

        if (this.role === 'Ninguno' && this.age >= 18) { 
            let r = Math.random(); 
            if(r < 0.13) this.role = 'Granjero'; 
            else if(r < 0.25) this.role = 'Recolector'; 
            else if(r < 0.38) this.role = 'Minero'; 
            else if(r < 0.50) this.role = 'Leñador'; 
            else if(r < 0.60) this.role = 'Constructor'; 
            else if(r < 0.70) this.role = 'Pescador'; 
            else if(r < 0.80) this.role = 'Comerciante'; 
            else if(r < 0.92) this.role = 'Guerrero'; 
            else this.role = 'Médico'; 
        }

        if (this.personality === 'Perezoso' && Math.random() < 0.3) { if(v.territory.length > 0) { let t = v.territory[Math.floor(Math.random() * v.territory.length)]; this.target = {x: t.x + 0.5, y: t.y + 0.5}; this.state = 'WANDER'; } return; }

        if(G.simSettings.warsEnabled && v.enemies.size > 0 && (this.role === 'Guerrero' || this.personality === 'Valiente' || (v.state === 'WAR' && Math.random() < 0.4))) {
            // Reclutar civiles en guerra si hay barracas
            if(this.role !== 'Guerrero' && v.territory.some(t=>G.grid[t.x][t.y].buildingType === BLD.BARRACKS)) {
                if(Math.random() < 0.15) this.role = 'Guerrero';
            }
            let enemyVIds = Array.from(v.enemies);
            // Elige el enemigo más cercano
            let bestEnemyV = null, bestDist = Infinity;
            enemyVIds.forEach(eid => {
                let ev = G.villages.find(v => v.id === eid);
                if(ev) { let d = Math.abs(this.x - ev.centerX) + Math.abs(this.y - ev.centerY); if(d < bestDist) { bestDist = d; bestEnemyV = ev; } }
            });
            if(bestEnemyV) {
                let walls = bestEnemyV.territory.filter(t => G.grid[t.x][t.y].buildingType === BLD.WALL);
                let townhall = bestEnemyV.territory.find(t => G.grid[t.x][t.y].isTownHall);
                // Generales lideran asaltos directos al ayuntamiento
                if(this.isGeneral && townhall) {
                    this.target = {x: townhall.x + 0.5, y: townhall.y + 0.5};
                } else if(walls.length > 0 && Math.random() < 0.6) {
                    // Atacar el muro más cercano
                    let nearestWall = walls.reduce((a,b) => {
                        let da = Math.abs(a.x-this.x)+Math.abs(a.y-this.y);
                        let db = Math.abs(b.x-this.x)+Math.abs(b.y-this.y);
                        return da < db ? a : b;
                    });
                    this.target = {x: nearestWall.x + 0.5, y: nearestWall.y + 0.5};
                } else {
                    // Ataque flanqueador: offset aleatorio para rodear
                    let flankeAngle = Math.random() * Math.PI * 2;
                    let flankeRadius = 3 + Math.random() * 8;
                    this.target = {
                        x: bestEnemyV.centerX + Math.cos(flankeAngle) * flankeRadius,
                        y: bestEnemyV.centerY + Math.sin(flankeAngle) * flankeRadius
                    };
                }
                this.state = 'FIGHT'; 
                // Asignar general si hay suficiente tropa y no existe uno aún
                if(this.role === 'Guerrero' && !this.isGeneral) {
                    let myWarriors = G.humans.filter(h => h.villageId === v.id && h.role === 'Guerrero');
                    let existingGeneral = myWarriors.find(h => h.isGeneral);
                    if(!existingGeneral && myWarriors.length >= 4 && this.exp > 40) {
                        this.isGeneral = true;
                        spawnFloatingText(this.x, this.y, "⭐ GENERAL", v.color);
                    }
                }
                return;
            }
        }

        if(this.role === 'Comerciante' && v.allies.size > 0 && Math.random() < 0.6) {
            let allyId = Array.from(v.allies)[Math.floor(Math.random() * v.allies.size)]; let allyV = G.villages.find(ev => ev.id === allyId);
            if(allyV && allyV.territory.length > 0) {
                let market = allyV.territory.find(t => G.grid[t.x][t.y].buildingType === BLD.MARKET);
                this.target = market ? {x: market.x + 0.5, y: market.y + 0.5} : {x: allyV.centerX, y: allyV.centerY}; this.state = 'TRADE'; this.memory = { targetVillage: allyV.id }; return;
            }
        }

        // NUEVA LÓGICA DE PESCA EN EL MAR
        if(this.role === 'Pescador' && Math.random() < 0.8) {
            let docks = v.territory.filter(t => G.grid[t.x][t.y].buildingType === BLD.DOCK);
            if(docks.length > 0 || v.territory.some(t => G.grid[t.x][t.y].type === TERRAIN.WATER)) {
                if (G.fishes.length > 0) {
                    let nearbyFishes = G.fishes.filter(f => Math.abs(f.x - this.x) < 30 && Math.abs(f.y - this.y) < 30);
                    if(nearbyFishes.length > 0) {
                        let targetFish = nearbyFishes[Math.floor(Math.random() * nearbyFishes.length)];
                        this.target = {x: targetFish.x, y: targetFish.y};
                        this.state = 'FISH';
                        this.memory = { targetFish: targetFish };
                        return;
                    }
                }
            }
        }

        // ── RECOLECCIÓN Y EXPLORACIÓN ──────────────────────────────────
        // Umbral real de necesidad
        let pop = G.humans.filter(h => h.villageId === v.id).length;
        let needFood = v.food < pop * 12;
        let needWood = v.wood < 500;
        let needIron = v.iron < 300;
        let needGold = v.gold < 150;
        let desperateFood = v.food < pop * 4;
        let desperateWood = v.wood < 100;

        // MÉDICO: sanar aliados heridos
        if(this.role === 'Médico') { this.tryHeal(v); if(this.state === 'HEAL') return; }

        // GUERRERO sin guerra: patrulla pero también ayuda si hay necesidad urgente
        if(this.role === 'Guerrero' && !v.enemies.size) {
            if(desperateFood && Math.random() < 0.5) {
                // Guerreros ayudan a cazar cuando hay hambre
                if(G.animals.length > 0) {
                    let nearby = G.animals.filter(a => Math.abs(a.x-this.x)<50 && Math.abs(a.y-this.y)<50);
                    if(nearby.length > 0) { let a = nearby[Math.floor(Math.random()*nearby.length)]; this.target={x:a.x,y:a.y}; this.state='HUNT'; this.memory={targetAnimal:a}; return; }
                }
            }
        }

        // RECOLECTOR / CAZADOR — siempre activo si hay necesidad
        if(this.role === 'Recolector' || this.role === 'Granjero' || (this.role === 'Ninguno' && (needFood || Math.random() < 0.3))) {
            // Granjas propias primero
            if(this.role === 'Granjero') {
                let farms = v.territory.filter(t => G.grid[t.x][t.y].buildingType === BLD.FARM || G.grid[t.x][t.y].buildingType === BLD.WINDMILL);
                if(farms.length > 0) { let f = farms[Math.floor(Math.random()*farms.length)]; this.target={x:f.x+0.5,y:f.y+0.5}; this.state='GATHER_FOOD'; return; }
            }
            // Bayas en radio amplio (hasta 80 tiles)
            let berries = [];
            for(let i=0; i<80; i++) {
                let nx=Math.floor(this.x+(Math.random()*100-50));
                let ny=Math.floor(this.y+(Math.random()*100-50));
                if(nx>=0&&nx<G.cols&&ny>=0&&ny<G.rows&&G.grid[nx][ny].hasBerries) berries.push({x:nx,y:ny});
            }
            if(berries.length > 0) { let t=berries[Math.floor(Math.random()*berries.length)]; this.target={x:t.x+0.5,y:t.y+0.5}; this.state='GATHER_FOOD'; return; }
            // Caza en radio amplio
            if(G.animals.length > 0) {
                let nearby = G.animals.filter(a => Math.abs(a.x-this.x)<60 && Math.abs(a.y-this.y)<60 && !a.dead);
                if(nearby.length > 0) { let a=nearby[Math.floor(Math.random()*nearby.length)]; this.target={x:a.x,y:a.y}; this.state='HUNT'; this.memory={targetAnimal:a}; return; }
            }
        }

        // MINERO: busca hierro y oro, siempre sale si es su rol
        if(this.role === 'Minero' || (needIron && Math.random() < 0.8) || (needGold && Math.random() < 0.8) || (this.role === 'Ninguno' && Math.random() < 0.25)) {
            // Recordar destino previo
            if(this.memory && this.memory.gatherType && this.memory.gatherType !== TERRAIN.FOREST) {
                let mt = G.grid[this.memory.gatherX]?.[this.memory.gatherY];
                if(mt && (mt.type === TERRAIN.GOLD || mt.type === TERRAIN.IRON)) {
                    this.target={x:this.memory.gatherX+0.5,y:this.memory.gatherY+0.5};
                    this.state = mt.type===TERRAIN.GOLD ? 'GATHER_GOLD' : 'GATHER_IRON';
                    return;
                } else { this.memory=null; }
            }
            // Radio amplio — mineros expertos van muy lejos
            let radius = this.role === 'Minero' ? 120 : 60;
            if(needGold || this.role === 'Minero') {
                // Buscar LEJOS primero para explorar (tomar elemento aleatorio, no siempre el más cercano)
                let g = findResource(this.x, this.y, TERRAIN.GOLD, radius);
                if(g.length > 0) {
                    let t = g[Math.floor(Math.random()*g.length)]; // aleatorio, no solo el más cercano
                    this.target={x:t.x+0.5,y:t.y+0.5}; this.state='GATHER_GOLD';
                    this.memory={gatherX:t.x,gatherY:t.y,gatherType:TERRAIN.GOLD}; this.isScavenging=true; return;
                }
            }
            let ir = findResource(this.x, this.y, TERRAIN.IRON, radius);
            if(ir.length > 0) {
                let t = ir[Math.floor(Math.random()*ir.length)];
                this.target={x:t.x+0.5,y:t.y+0.5}; this.state='GATHER_IRON';
                this.memory={gatherX:t.x,gatherY:t.y,gatherType:TERRAIN.IRON}; this.isScavenging=true; return;
            }
        }

        // LEÑADOR: siempre activo si es su rol, sale muy lejos
        if(this.role === 'Leñador' || (needWood && Math.random() < 0.85) || (this.role === 'Ninguno' && Math.random() < 0.3)) {
            if(this.memory && this.memory.gatherType === TERRAIN.FOREST) {
                let mt = G.grid[this.memory.gatherX]?.[this.memory.gatherY];
                if(mt && mt.type===TERRAIN.FOREST) { this.target={x:this.memory.gatherX+0.5,y:this.memory.gatherY+0.5}; this.state='GATHER'; return; }
                else { this.memory=null; }
            }
            let radius = this.role === 'Leñador' ? 100 : 50;
            let f = findResource(this.x, this.y, TERRAIN.FOREST, radius);
            if(f.length > 0) {
                let t = f[Math.floor(Math.random()*f.length)]; // aleatorio = explorar
                this.target={x:t.x+0.5,y:t.y+0.5}; this.state='GATHER';
                this.memory={gatherX:t.x,gatherY:t.y,gatherType:TERRAIN.FOREST}; this.isScavenging=true; return;
            }
        }

        // CONSTRUCTOR / todos cuando hay necesidad — probabilidad ALTA
        let shouldBuild = this.role === 'Constructor' || Math.random() < 0.55;
        if(shouldBuild) {
            let emptyTiles = v.territory.filter(t => !G.grid[t.x][t.y].hasHouse && G.grid[t.x][t.y].type === TERRAIN.GRASS);
            if(emptyTiles.length > 0) {
                let t = emptyTiles[Math.floor(Math.random() * emptyTiles.length)]; this.target = {x: t.x + 0.5, y: t.y + 0.5}; this.state = 'BUILD';
                let cap = v.getCapacity();
                let hasTownHall = v.territory.some(tile => G.grid[tile.x][tile.y].buildingType === BLD.TOWNHALL);
                let farms2 = v.territory.filter(tile => G.grid[tile.x][tile.y].buildingType === BLD.FARM).length;
                let mines2 = v.territory.filter(tile => G.grid[tile.x][tile.y].buildingType === BLD.MINE).length;
                let docks2 = v.territory.filter(tile => G.grid[tile.x][tile.y].buildingType === BLD.DOCK).length;
                let markets2 = v.territory.filter(tile => G.grid[tile.x][tile.y].buildingType === BLD.MARKET).length;
                let windmills2 = v.territory.filter(tile => G.grid[tile.x][tile.y].buildingType === BLD.WINDMILL).length;
                let watchtowers2 = v.territory.filter(tile => G.grid[tile.x][tile.y].buildingType === BLD.WATCHTOWER).length;
                let wells2 = v.territory.filter(tile => G.grid[tile.x][tile.y].buildingType === BLD.WELL).length;
                let temples2 = v.territory.filter(tile => G.grid[tile.x][tile.y].buildingType === BLD.TEMPLE).length;
                let touchesWater = false;
                for(let cx2=-3;cx2<=3;cx2++){for(let cy2=-3;cy2<=3;cy2++){if(t.x+cx2>=0&&t.x+cx2<G.cols&&t.y+cy2>=0&&t.y+cy2<G.rows&&G.grid[t.x+cx2][t.y+cy2].type===TERRAIN.WATER)touchesWater=true;}}
                let resourcesSufficient = v.wood >= 150 && v.food >= 100;
                let needsMorePeople = cap <= pop + 2;
                if(!hasTownHall && v.wood >= 100) this.buildTarget = BLD.TOWNHALL;
                else if(needsMorePeople && v.wood >= 30) this.buildTarget = BLD.HOUSE;
                else if(resourcesSufficient) {
                    if(v.state==='WAR'&&v.iron>=20){if(v.age>=2&&v.iron>=50&&v.territory.filter(tl=>G.grid[tl.x][tl.y].buildingType===BLD.BARRACKS).length<1)this.buildTarget=BLD.BARRACKS;else this.buildTarget=BLD.WALL;}
                    else if(v.food<pop*4&&windmills2<1+Math.floor(pop/15))this.buildTarget=BLD.WINDMILL;
                    else if(v.iron<200&&mines2<1+Math.floor(pop/12))this.buildTarget=BLD.MINE;
                    else if(touchesWater&&docks2<2)this.buildTarget=BLD.DOCK;
                    else if(v.age>=2&&v.iron>=50&&v.territory.filter(tl=>G.grid[tl.x][tl.y].buildingType===BLD.BARRACKS).length<1)this.buildTarget=BLD.BARRACKS;
                    else if(v.wood>200&&v.gold>100&&markets2<1)this.buildTarget=BLD.MARKET;
                    else if(v.age>=2&&v.iron>50&&watchtowers2<Math.floor(pop/12))this.buildTarget=BLD.WATCHTOWER;
                    else if(v.wood>100&&wells2<Math.floor(pop/18))this.buildTarget=BLD.WELL;
                    else if(v.age>=3&&v.gold>=300&&temples2<1)this.buildTarget=BLD.TEMPLE;
                    else this.buildTarget=BLD.HOUSE;
                } else {
                    if(v.food<pop*2&&windmills2<1)this.buildTarget=BLD.WINDMILL;
                    else this.buildTarget=BLD.HOUSE;
                }
                return;
            }
        }

        // FALLBACK AMBICIOSO: si llegamos aquí, ir a expandir territorio o explorar lejos
        if(Math.random() < 0.4) {
            // Explorar en dirección aleatoria lejos (expansión de territorio)
            let exploreAngle = Math.random() * Math.PI * 2;
            let exploreRadius = 15 + Math.random() * 25;
            let ex = Math.floor(v.centerX + Math.cos(exploreAngle)*exploreRadius);
            let ey = Math.floor(v.centerY + Math.sin(exploreAngle)*exploreRadius);
            ex = Math.max(0, Math.min(G.cols-1, ex)); ey = Math.max(0, Math.min(G.rows-1, ey));
            this.target = {x: ex+0.5, y: ey+0.5}; this.state = 'WANDER';
        } else if(v.territory.length > 0) {
            let t = v.territory[Math.floor(Math.random() * v.territory.length)];
            this.target = {x: t.x+0.5, y: t.y+0.5}; this.state = 'WANDER';
        }
    }

    performAction(v, tile) {
        if(!v) return;

        if(this.state === 'GATHER_FOOD') {
            if(tile.hasBerries) {
                tile.hasBerries = false;
                let amount = 30 + Math.floor(this.exp / 5);
                this.store(amount, 0.5);
                this.exp += 5;
                spawnParticles(this.x, this.y, '#e74c3c', 10, 15);
            } else {
                // At a farm, a dock or in the village square: take a ration
                // out of the stores. The ration is small on purpose: a whole
                // village eating at once must not empty the stores in one go.
                let eaten = this.feed(12);
                if (eaten > 0) {
                    spawnParticles(this.x, this.y, '#f1c40f', 6, 12);
                }
            }        }
        else if(this.state === 'HUNT') {
            if(this.memory && this.memory.targetAnimal && !this.memory.targetAnimal.dead) {
                this.memory.targetAnimal.dead = true;
                let amount = 50 + Math.floor(this.exp / 2);
                this.store(amount, 0.5);
                this.exp += 10;
                spawnParticles(this.x, this.y, '#e74c3c', 20, 25);
                spawnParticles(this.x, this.y, '#c0392b', 8, 15);
                spawnFloatingText(this.x, this.y - 1, `+${amount} 🍖`, '#e74c3c');
                AudioSystem.playAt('sword', this.x, this.y);
            }
            this.memory = null;
        }
        else if(this.state === 'GATHER' && tile.type === TERRAIN.FOREST) {
            let amount = 25 + Math.floor(this.exp / 10); v.wood += amount; this.exp += 2;
            // Virutas de madera volando
            spawnParticles(this.x, this.y, '#8B4513', 18, 20);
            spawnParticles(this.x, this.y, '#A0522D', 8, 15);
            if(Math.random() < 0.3) spawnFloatingText(this.x, this.y - 1, `+${amount} 🪵`, '#8B4513');
            if(Math.random() < 0.25) AudioSystem.playAt('chop', this.x, this.y);
            if(Math.random() < 0.05) { tile.type = TERRAIN.GRASS; this.memory = null; }
            // Regresa a depositar si tiene mucha madera acumulada
            if(this.isScavenging && Math.random() < 0.15) { this.isScavenging = false; this.target = {x: v.centerX+0.5, y: v.centerY+0.5}; this.state = 'WANDER'; }
        }
        else if(this.state === 'GATHER_IRON' && tile.type === TERRAIN.IRON) {
            let amount = 50 + Math.floor(this.exp / 5); v.iron += amount; this.exp += 5;
            // Chispas de metal
            spawnParticles(this.x, this.y, '#bdc3c7', 15, 20);
            spawnParticles(this.x, this.y, '#78909C', 8, 12);
            if(Math.random() < 0.3) spawnFloatingText(this.x, this.y - 1, `+${amount} ⚙️`, '#90A4AE');
            if(Math.random() < 0.3) AudioSystem.playAt('mine', this.x, this.y);
            if(Math.random() < 0.05) { tile.type = TERRAIN.GRASS; this.memory = null; }
            if(this.isScavenging && Math.random() < 0.12) { this.isScavenging = false; this.target = {x: v.centerX+0.5, y: v.centerY+0.5}; this.state = 'WANDER'; }
        }
        else if(this.state === 'GATHER_GOLD' && tile.type === TERRAIN.GOLD) {
            let amount = 50 + Math.floor(this.exp / 5); v.gold += amount; this.exp += 5;
            // Destellos dorados
            spawnParticles(this.x, this.y, '#f1c40f', 20, 25);
            spawnParticles(this.x, this.y, '#FFF176', 10, 18);
            if(Math.random() < 0.35) spawnFloatingText(this.x, this.y - 1, `+${amount} 💰`, '#f1c40f');
            if(Math.random() < 0.3) AudioSystem.playAt('mine', this.x, this.y);
            if(Math.random() < 0.05) { tile.type = TERRAIN.GRASS; this.memory = null; }
            if(this.isScavenging && Math.random() < 0.12) { this.isScavenging = false; this.target = {x: v.centerX+0.5, y: v.centerY+0.5}; this.state = 'WANDER'; }
        }
        else if(this.state === 'FISH') {
            if (this.memory && this.memory.targetFish && !this.memory.targetFish.dead) {
                 this.memory.targetFish.dead = true;
            }
            let amount = 30 + Math.floor(this.exp / 5); this.store(amount, 0.6); this.exp += 5;
            spawnParticles(this.x, this.y, '#1B9CFC', 20, 25);
            spawnParticles(this.x, this.y, '#74b9ff', 8, 15);
            if(Math.random() < 0.4) spawnFloatingText(this.x, this.y - 1, `+${amount} 🐟`, '#1B9CFC');
            if(Math.random() < 0.3) AudioSystem.playAt('splash', this.x, this.y);
            this.memory = null;
        }
        else if(this.state === 'HEAL') {
            if(this.memory && this.memory.targetHuman && G.humans.includes(this.memory.targetHuman)) {
                let target = this.memory.targetHuman;
                target.hp = Math.min(target.maxHp, target.hp + 35);
                target.disease = false;
                spawnParticles(target.x, target.y, '#2ecc71', 12, 25);
                spawnParticles(this.x, this.y, '#a8ff78', 5, 20);
                this.exp += 8;
            }
            this.memory = null;
        }
        else if(this.state === 'TRADE') {
            if (this.memory && this.memory.targetVillage) {
                let allyV = G.villages.find(ev => ev.id === this.memory.targetVillage);
                if (allyV) {
                    // Intercambio de recursos
                    if (v.wood > 100) { v.wood -= 50; allyV.wood += 50; v.gold += 20; }
                    if (v.food > 100) { v.food -= 50; allyV.food += 50; v.iron += 20; }
                    // Ruta comercial: construir carretera en el tile actual hacia la aldea aliada
                    let curTx = Math.floor(this.x), curTy = Math.floor(this.y);
                    if(curTx>=0 && curTx<G.cols && curTy>=0 && curTy<G.rows) {
                        G.grid[curTx][curTy].hasRoad = true;
                        // También pavimentar el tile siguiente hacia la aldea destino
                        let rdx = allyV.centerX - this.x, rdy = allyV.centerY - this.y;
                        let rdist = Math.sqrt(rdx*rdx+rdy*rdy);
                        if(rdist > 0) {
                            let nx2 = Math.floor(this.x + rdx/rdist*2);
                            let ny2 = Math.floor(this.y + rdy/rdist*2);
                            if(nx2>=0 && nx2<G.cols && ny2>=0 && ny2<G.rows && G.grid[nx2][ny2].type !== TERRAIN.WATER && G.grid[nx2][ny2].type !== TERRAIN.FIRE) {
                                G.grid[nx2][ny2].hasRoad = true;
                            }
                        }
                    }
                    this.exp += 10;
                    spawnParticles(this.x, this.y, '#f1c40f', 20, 20);
                    AudioSystem.playAt('coins', this.x, this.y);
                    // Consolidar alianza (aumenta cultura y estabilidad)
                    v.culture += 2; allyV.culture += 2;
                    v.stability = Math.min(100, v.stability + 1);
                }
                this.isScavenging = false;
                this.memory = null; 
            }
        }
        else if(this.state === 'BUILD' && !tile.hasHouse && tile.type === TERRAIN.GRASS) {

            let costWood = 30; let costIron = 0; let costGold = 0;
            if (this.buildTarget === BLD.TOWNHALL) costWood = 100;
            if (this.buildTarget === BLD.BARRACKS || this.buildTarget === BLD.WATCHTOWER) { costWood = 50; costIron = 50; }
            if (this.buildTarget === BLD.MINE || this.buildTarget === BLD.WINDMILL) costWood = 100;
            if (this.buildTarget === BLD.WELL) { costWood = 30; costIron = 10; }
            if (this.buildTarget === BLD.TEMPLE) { costWood = 200; costGold = 300; }
            if (this.buildTarget === BLD.WALL) costIron = 20;

            if (v.wood >= costWood && v.iron >= costIron && v.gold >= costGold) {
                tile.hasHouse = true; tile.buildingType = this.buildTarget;
                if(this.buildTarget === BLD.HOUSE || this.buildTarget === BLD.TOWNHALL) tile.houseLevel = 1;
                if(this.buildTarget === BLD.TOWNHALL) tile.isTownHall = true;
                tile.hasRoad = true; v.wood -= costWood; v.iron -= costIron; v.gold -= costGold; this.exp += 15;
                spawnParticles(this.x, this.y, '#f1c40f', 25, 25);
                spawnParticles(this.x, this.y, '#BCAAA4', 12, 18);
                // Mostrar nombre del edificio construido
                let bldNames = { [BLD.HOUSE]:'🏠 Casa', [BLD.TOWNHALL]:'🏛️ Ayuntamiento', [BLD.BARRACKS]:'⚔️ Cuartel', [BLD.FARM]:'🌾 Granja', [BLD.MINE]:'⛏️ Mina', [BLD.MARKET]:'🏪 Mercado', [BLD.WALL]:'🧱 Muro', [BLD.WINDMILL]:'🌀 Molino', [BLD.DOCK]:'⚓ Puerto', [BLD.WELL]:'💧 Pozo', [BLD.TEMPLE]:'🛕 Templo', [BLD.WATCHTOWER]:'🗼 Torre' };
                spawnFloatingText(this.x, this.y - 1, bldNames[this.buildTarget] || '🔨 Construido', '#f1c40f');
                AudioSystem.playAt('build', this.x, this.y);
            }
        }
        else if(this.state === 'FIGHT') {
            let damage = 25 + (v.culture * 0.2) + (v.age * 15) + (this.role === 'Guerrero' ? this.exp / 2 : 0);
            if (this.personality === 'Valiente') damage *= 1.2;
            if (this.isGeneral) damage *= 1.5; // generales causan más daño
            // Guerreros cercanos a un general reciben bonus de moral
            let nearGeneral = G.humans.some(h => h.isGeneral && h.villageId === v.id && Math.abs(h.x-this.x)<5 && Math.abs(h.y-this.y)<5);
            if(nearGeneral) damage *= 1.25;
            // Age 2+ use ranged attacks
            let isRanged = v ? v.age >= 2 : false;

            if (tile.buildingType === BLD.WALL && tile.ownerId && v.enemies.has(tile.ownerId)) {
                if (Math.random() < 0.2) { 
                    tile.hasHouse = false; tile.buildingType = null; tile.type = TERRAIN.SAND; 
                    spawnExplosion(tile.x + 0.5, tile.y + 0.5);
                    AudioSystem.playAt('explosion', this.x, this.y); 
                } else { 
                    spawnParticles(tile.x, tile.y, '#bdc3c7', 5, 10); 
                    if (isRanged) AudioSystem.playAt('gunshot', this.x, this.y);
                    else AudioSystem.playAt('sword', this.x, this.y); 
                }
                // Fire bullet tracer toward wall
                if (isRanged) spawnBullet(this.x, this.y, tile.x + 0.5, tile.y + 0.5, v.color);
                return; 
            }

            let enemy = G.humans.find(h => v.enemies.has(h.villageId) && Math.abs(h.x-this.x)<1.5 && Math.abs(h.y-this.y)<1.5);
            if(enemy) { 
                enemy.hp -= damage; this.exp += 5; 
                spawnParticles(enemy.x, enemy.y, '#e74c3c', 8, 15); 
                if (isRanged) {
                    spawnBullet(this.x, this.y, enemy.x, enemy.y, v.color);
                    if(Math.random() < 0.4) AudioSystem.playAt('machinegun', this.x, this.y);
                } else {
                    if(Math.random() < 0.3) AudioSystem.playAt('sword', this.x, this.y);
                }
            }

            if(tile.ownerId && v.enemies.has(tile.ownerId) && tile.buildingType !== BLD.WALL) {
                let enemyV = G.villages.find(ev => ev.id === tile.ownerId);
                if(enemyV && tile.isTownHall) {
                    if(Math.random() < 0.1) { 
                        tile.isTownHall = false; tile.buildingType = 'FIRE';
                        spawnExplosion(tile.x + 0.5, tile.y + 0.5);
                        AudioSystem.playAt('explosion', tile.x, tile.y);
                        enemyV.territory.forEach(t => { G.grid[t.x][t.y].ownerId = v.id; v.territory.push(t); }); enemyV.territory = []; 
                        spawnFloatingText(tile.x, tile.y, "¡CONQUISTA!", v.color); spawnParticles(tile.x, tile.y, v.color, 40, 40); AudioSystem.play('age_up');
                    }
                }
                else if(tile.hasHouse && Math.random() < 0.3) { 
                    tile.hasHouse = false; tile.buildingType = null; tile.houseLevel = 0; tile.type = TERRAIN.FIRE; 
                    spawnParticles(tile.x, tile.y, '#7f8c8d', 15, 30); 
                    if (isRanged) { spawnExplosion(tile.x + 0.5, tile.y + 0.5); AudioSystem.playAt('explosion', tile.x, tile.y); }
                }
            }
        }
    }

    /**
     * Record why this human died.
     * `cause` is one of: oldAge, starvation, drowning, disease, combat, other.
     */
    die(cause: 'oldAge' | 'starvation' | 'drowning' | 'disease' | 'combat' | 'other' = 'other') {
        G.globalStats.deaths++;
        G.deathCauses[cause] = (G.deathCauses[cause] || 0) + 1;
        spawnParticles(this.x, this.y, '#c0392b', 15, 30);
        if (this.starving) {
            // Died of hunger: the village needs more farms.
            spawnFloatingText(this.x, this.y - 1, '💀 HAMBRE', '#d35400');
            addChronicle(`☠️ <b>${this.name}</b> murió de hambre`, true);
            G.foodStats.starvationDeaths++;
        }
        if(G.globalStats.deaths%10===0) gainFaith(1);
        let idx = G.humans.indexOf(this); if(idx > -1) G.humans.splice(idx, 1);
    }

    tryHeal(v) {
        // Médicos curan a heridos cercanos
        if(this.role === 'Médico' && this.actionTimer <= 0) {
            let wounded = G.humans.find(h => h.villageId === v.id && h !== this && h.hp < h.maxHp * 0.6 && Math.abs(h.x-this.x)<3 && Math.abs(h.y-this.y)<3);
            if(wounded) { wounded.hp = Math.min(wounded.maxHp, wounded.hp + 20); spawnParticles(wounded.x, wounded.y, '#2ecc71', 5, 20); this.actionTimer = 60; return true; }
        }
        return false;
    }
}

// --- FUNCIONES MUNDO ---
