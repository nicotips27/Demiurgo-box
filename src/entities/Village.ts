import { G } from '../core/state.ts';
import { FACTION_COLORS, NAME_PREFIXES, NAME_SUFFIXES } from '../core/constants.ts';
import { BuildingType as BLD } from '../core/types.ts';
import { TerrainType as TERRAIN } from '../core/types.ts';
import { spawnParticles, spawnFloatingText } from '../systems/particles.ts';
import { AudioSystem } from '../audio/sfx.ts';
import { gainFaith, addChronicle, trySpawnHero } from '../systems/faith.ts';
import { createVillage } from '../systems/sim.ts';
import { Human } from './Human.ts';
import { TerrainType, BuildingType } from '../core/types.ts';
export class Village {
    id: number;
    color: string;
    name: string;
    centerX: number;
    centerY: number;
    wood: number;
    food: number;
    iron: number;
    gold: number;
    age: number;
    territory: Array<{ x: number, y: number }>;
    enemies: Set<number>;
    allies: Set<number>;
    state: 'PEACE' | 'WAR';
    farmTimer: number;
    culture: number;
    religion: number;
    stability: number;
    armySize: number;
    population: number;
    diplomacy: Record<number, { relation: number; tradeTimer: number }>;
    constructor(x, y) {
        this.id = G.nextVillageId++; this.color = FACTION_COLORS[this.id % FACTION_COLORS.length];
        this.name = NAME_PREFIXES[Math.floor(Math.random()*NAME_PREFIXES.length)] + NAME_SUFFIXES[Math.floor(Math.random()*NAME_SUFFIXES.length)];
        this.centerX = x; this.centerY = y; this.wood = 200; this.food = 200; this.iron = 0; this.gold = 0; this.age = 1; 
        this.territory = []; this.enemies = new Set(); this.allies = new Set(); this.state = 'PEACE'; 
        this.farmTimer = 0; this.culture = 0; this.religion = 0; this.stability = 100; this.armySize = 0;
        this.claimTile(x, y);
        let t = G.grid[x][y];
        // The founding building is a town hall: it gives the village room to
        // grow (capacity 10) instead of the bonfire's 3, which was less than
        // the four settlers it started with.
        t.hasHouse = true; t.isTownHall = true; t.buildingType = BLD.TOWNHALL; t.houseLevel = 1; t.hasRoad = true;
    }
    getCapacity() { let cap = 0; this.territory.forEach(t => { let tile = G.grid[t.x][t.y]; if(tile.hasHouse) { if(tile.buildingType === BLD.TOWNHALL) cap += tile.houseLevel * 10; else if(tile.buildingType === BLD.HOUSE) cap += tile.houseLevel * 4; else if(tile.buildingType === BLD.BONFIRE) cap += 3; else if(tile.buildingType === BLD.WELL) cap += 2; } }); return cap; }
    claimTile(tx, ty) { if(tx>=0 && tx<G.cols && ty>=0 && ty<G.rows) { let t = G.grid[tx][ty]; if(!t.ownerId && t.type !== TERRAIN.WATER && t.type !== TERRAIN.FIRE) { t.ownerId = this.id; this.territory.push({x: tx, y: ty}); } } }
    update() {
        let farms = this.territory.filter(t => G.grid[t.x][t.y].buildingType === BLD.FARM).length;
        let mines = this.territory.filter(t => G.grid[t.x][t.y].buildingType === BLD.MINE).length;
        let barracks = this.territory.filter(t => G.grid[t.x][t.y].buildingType === BLD.BARRACKS).length;
        let markets = this.territory.filter(t => G.grid[t.x][t.y].buildingType === BLD.MARKET).length;
        let windmills = this.territory.filter(t => G.grid[t.x][t.y].buildingType === BLD.WINDMILL).length;
        let forests = this.territory.filter(t => G.grid[t.x][t.y].type === TERRAIN.FOREST).length;

        this.farmTimer++;
        // A farm produces 24 food per 3600 ticks and a villager eats 18 of
        // them, so one farm per villager leaves a surplus and the stores
        // build up. Fewer farms and the village runs dry.
        if (this.farmTimer >= 3600) { this.food += farms * 24; this.farmTimer = 0; if (farms > 0) spawnParticles(this.centerX, this.centerY, '#2ecc71', 20, 30); }

        this.territory.forEach(t => {
            let tile = G.grid[t.x][t.y];
            if (tile.buildingType === BLD.MINE && Math.random() < 0.15) {
                let nx = t.x + Math.floor(Math.random()*3)-1; let ny = t.y + Math.floor(Math.random()*3)-1;
                if(nx>=0 && nx<G.cols && ny>=0 && ny<G.rows && G.grid[nx][ny].type === TERRAIN.GRASS && !G.grid[nx][ny].hasHouse) { G.grid[nx][ny].type = Math.random() < 0.2 ? TERRAIN.GOLD : TERRAIN.IRON; }
            }
            if (tile.buildingType === BLD.WINDMILL && Math.random() < 0.1) {
                let nx = t.x + Math.floor(Math.random()*5)-2; let ny = t.y + Math.floor(Math.random()*5)-2;
                if(nx>=0 && nx<G.cols && ny>=0 && ny<G.rows && G.grid[nx][ny].type === TERRAIN.GRASS && !G.grid[nx][ny].hasHouse) {
                    G.grid[nx][ny].hasHouse = true; G.grid[nx][ny].buildingType = BLD.FARM; G.grid[nx][ny].ownerId = this.id;
                    if (!this.territory.some(tr => tr.x===nx && tr.y===ny)) this.territory.push({x:nx,y:ny});
                }
            }
        });

        this.wood += forests * 0.1 + (mines * 0.2); this.iron += mines * 0.5; this.gold += mines * 0.15 + (markets * 0.5);
        if(this.food > 3000) this.food = 3000; if(this.wood > 3000) this.wood = 3000; if(this.iron > 3000) this.iron = 3000; if(this.gold > 3000) this.gold = 3000;

        let myPop = G.humans.filter(h => h.villageId === this.id).length;

        if (this.age === 1 && this.iron >= 200 && this.wood >= 200 && this.food > 300) { this.age = 2; this.iron -= 200; this.wood -= 200; spawnFloatingText(this.centerX, this.centerY, "¡EDAD DE HIERRO!", '#bdc3c7'); spawnParticles(this.centerX, this.centerY, '#bdc3c7', 60, 40); AudioSystem.play('age_up'); this.culture += 20; gainFaith(20); addChronicle(`⚒️ <span style="color:${this.color}">${this.name}</span> entró en la Edad de Hierro`, true); } 
        else if (this.age === 2 && this.gold >= 300 && this.iron >= 300 && this.food > 500) { this.age = 3; this.gold -= 300; this.iron -= 300; spawnFloatingText(this.centerX, this.centerY, "¡EDAD DE ORO!", '#fbc531'); spawnParticles(this.centerX, this.centerY, '#fbc531', 80, 50); AudioSystem.play('age_up'); this.culture += 50; this.stability = 100; gainFaith(40); addChronicle(`👑 <span style="color:${this.color}">${this.name}</span> alcanzó la Edad de Oro`, true); }

        if(Math.random() < 0.05) { this.culture += (0.05 + markets*0.01); this.religion += 0.05; }
        // The stores need to hold a small buffer, otherwise a village that
        // is merely keeping its head above water starts to break apart.
        if(this.food < myPop * 0.8) this.stability -= 0.5; else if(this.food > myPop * 4) this.stability += 0.2;
        this.stability += (this.religion * 0.005); if(this.stability > 100) this.stability = 100; if(this.stability < 0) this.stability = 0;

        // Intentar generar héroe
        trySpawnHero(this);

        if(Math.random() < 0.05 && this.territory.length > 0) { let base = this.territory[Math.floor(Math.random() * this.territory.length)]; let dirX = base.x + (Math.random() < 0.5 ? 1 : -1); let dirY = base.y + (Math.random() < 0.5 ? 1 : -1); this.claimTile(dirX, dirY); }

        if(this.wood > 100 && this.iron > 20 && Math.random() < 0.1) {
            let ths = this.territory.filter(t => G.grid[t.x][t.y].buildingType === BLD.TOWNHALL && G.grid[t.x][t.y].houseLevel < 3);
            if(ths.length > 0) {
                let t = ths[Math.floor(Math.random() * ths.length)]; let tile = G.grid[t.x][t.y];
                tile.houseLevel++; this.wood -= 100; this.iron -= 20; spawnParticles(t.x, t.y, '#f1c40f', 20, 30); AudioSystem.playAt('build', t.x, t.y);
            } else {
                let upgradable = this.territory.filter(t => { let tile = G.grid[t.x][t.y]; return tile.hasHouse && tile.buildingType === BLD.HOUSE && tile.houseLevel < 3; });
                if(upgradable.length > 0) {
                    let t = upgradable[Math.floor(Math.random() * upgradable.length)]; let tile = G.grid[t.x][t.y];
                    if (tile.houseLevel === 1) { tile.houseLevel = 2; this.wood -= 50; spawnParticles(t.x, t.y, '#f5f6fa', 10, 20); AudioSystem.playAt('build', t.x, t.y); }
                    else if (tile.houseLevel === 2 && this.age >= 2 && this.iron >= 50) { tile.houseLevel = 3; this.wood -= 50; this.iron -= 50; spawnParticles(t.x, t.y, '#bdc3c7', 10, 20); AudioSystem.playAt('build', t.x, t.y); }
                }
            }
        }

        if(this.stability < 20 && myPop > 10 && this.territory.length > 8 && Math.random() < 0.002) {
            let half = Math.floor(this.territory.length / 2); let rebelTiles = [];
            for(let i=0; i<half; i++) rebelTiles.push(this.territory.pop());
            if(rebelTiles.length > 0) {
                let startTile = rebelTiles[0]; let rebelV = new Village(startTile.x, startTile.y);
                rebelTiles.forEach(t => { G.grid[t.x][t.y].ownerId = rebelV.id; rebelV.territory.push(t); });
                G.humans.forEach(h => { if(h.villageId === this.id && Math.random() < 0.5) h.villageId = rebelV.id; });
                this.stability = 80; spawnFloatingText(this.centerX, this.centerY, "¡REBELIÓN!", '#e74c3c'); spawnParticles(this.centerX, this.centerY, '#e74c3c', 50, 50); AudioSystem.play('alert');
                this.enemies.add(rebelV.id); rebelV.enemies.add(this.id);
                addChronicle(`⚔️ <span style="color:${this.color}">${this.name}</span> sufrió una rebelión. Surge <span style="color:${rebelV.color}">${rebelV.name}</span>`, true);
            }
        }

        if(this.food > 400 && this.wood > 300 && myPop >= this.getCapacity() * 0.8 && Math.random() < 0.01) { let colonist = new Human(this.centerX, this.centerY, this.id, 18); colonist.isColonist = true; colonist.state = 'COLONIZE'; G.humans.push(colonist); this.food -= 150; this.wood -= 150; }

        if(G.simSettings.warsEnabled && Math.random() < 0.02) {
            let myWarriors = G.humans.filter(h => h.villageId === this.id && h.role === 'Guerrero').length;
            this.armySize = myWarriors + (barracks * 6 * this.age); 
            if(!this.diplomacy) this.diplomacy = {}; // {villageId: {relation: 0-100, tradeTimer: 0}}

            G.villages.forEach(v => {
                if(v.id === this.id) return;
                if(!this.diplomacy[v.id]) this.diplomacy[v.id] = {relation: 20, tradeTimer: 0};
                let diplo = this.diplomacy[v.id];
                let dist = Math.abs(this.centerX - v.centerX) + Math.abs(this.centerY - v.centerY);

                // ── GUERRA ──────────────────────────────────────────────
                if(!this.allies.has(v.id) && !this.enemies.has(v.id)) {
                    let enemyWarriors = G.humans.filter(h => h.villageId === v.id && h.role === 'Guerrero').length;
                    let enemyBarracks = v.territory.filter(t => G.grid[t.x][t.y].buildingType === BLD.BARRACKS).length;
                    let enemyArmySize = enemyWarriors + (enemyBarracks * 6 * v.age);
                    let shouldAttack = dist < 45 && ((this.armySize > enemyArmySize * 1.3) || (dist < 25 && this.armySize >= enemyArmySize * 0.9 && this.age > v.age));
                    // Naciones aliadas no se atacan; relación alta protege
                    if(shouldAttack && diplo.relation < 60) {
                        this.enemies.add(v.id); v.enemies.add(this.id);
                        if(v.diplomacy && v.diplomacy[this.id]) v.diplomacy[this.id].relation = 0;
                        diplo.relation = 0;
                        this.state = 'WAR'; v.state = 'WAR';
                        spawnFloatingText(this.centerX, this.centerY, "⚔️ ¡A LA GUERRA!", '#c0392b');
                        AudioSystem.play('alert');
                    }
                }

                // ── TREGUA / PAZ ─────────────────────────────────────
                if(this.enemies.has(v.id)) {
                    let myW = G.humans.filter(h=>h.villageId===this.id && h.role==='Guerrero').length;
                    let theirW = G.humans.filter(h=>h.villageId===v.id && h.role==='Guerrero').length;
                    if(myW < 2 && theirW < 2 && Math.random() < 0.005) {
                        this.enemies.delete(v.id); v.enemies.delete(this.id);
                        diplo.relation = Math.min(diplo.relation + 10, 40);
                        spawnFloatingText(this.centerX, this.centerY, "🕊️ TREGUA", '#3498db');
                    }
                }

                // ── DIPLOMACIA / ALIANZA ──────────────────────────────
                if(!this.enemies.has(v.id) && dist < 60) {
                    // Relación sube lentamente si hay paz y comercio activo
                    if(v.allies.has(this.id)) diplo.relation = Math.min(100, diplo.relation + 0.05);
                    // Proponer alianza cuando relación >= 65 y ambos tienen cultura suficiente
                    if(diplo.relation >= 65 && !this.allies.has(v.id) && this.culture > 40 && v.culture > 30 && Math.random() < 0.02) {
                        this.allies.add(v.id); v.allies.add(this.id);
                        if(!v.diplomacy) v.diplomacy = {};
                        if(!v.diplomacy[this.id]) v.diplomacy[this.id] = {relation: diplo.relation, tradeTimer: 0};
                        v.diplomacy[this.id].relation = diplo.relation;
                        spawnFloatingText(this.centerX, this.centerY, "🤝 ¡ALIANZA!", '#3498db');
                        spawnParticles(this.centerX, this.centerY, '#3498db', 30, 40);
                        AudioSystem.playAt('coins', this.centerX, this.centerY);
                    }
                    // Romper alianza si relación cae mucho (por guerra con aliado, etc.)
                    if(this.allies.has(v.id) && diplo.relation < 20) {
                        this.allies.delete(v.id); v.allies.delete(this.id);
                        spawnFloatingText(this.centerX, this.centerY, "💔 ALIANZA ROTA", '#e67e22');
                    }
                }

                // ── COMERCIO ACTIVO ───────────────────────────────────
                // Si somos aliados o relación > 40 y hay market, mandar comerciante
                if(!this.enemies.has(v.id) && dist < 80 && (this.allies.has(v.id) || diplo.relation > 40)) {
                    diplo.tradeTimer = (diplo.tradeTimer || 0) + 1;
                    let marketHere = this.territory.some(t => G.grid[t.x][t.y].buildingType === BLD.MARKET);
                    let tradeInterval = marketHere ? 900 : 2400; // con mercado, comercian más seguido
                    if(diplo.tradeTimer >= tradeInterval && Math.random() < 0.3) {
                        diplo.tradeTimer = 0;
                        // Buscar un comerciante libre de esta aldea
                        let trader = G.humans.find(h => h.villageId === this.id && h.role === 'Comerciante' && h.state !== 'TRADE');
                        if(!trader) trader = G.humans.find(h => h.villageId === this.id && (h.state === 'IDLE' || h.state === 'WANDER'));
                        if(trader) {
                            trader.state = 'TRADE';
                            trader.memory = {targetVillage: v.id};
                            trader.target = {x: v.centerX + 0.5, y: v.centerY + 0.5};
                            // Subir relación al iniciar comercio
                            diplo.relation = Math.min(100, diplo.relation + 5);
                            spawnParticles(trader.x, trader.y, '#f1c40f', 8, 20);
                        }
                    }
                }
            });
        }
        if (this.enemies.size === 0) this.state = 'PEACE';
    }
}
