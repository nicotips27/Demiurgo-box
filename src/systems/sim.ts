import { G } from '../core/state.ts';
import { vPanel } from '../core/dom.ts';
import { AGES_NAMES } from '../core/constants.ts';
import { TerrainType as TERRAIN } from '../core/types.ts';
import { Tile } from '../entities/Tile.ts';
import { Village } from '../entities/Village.ts';
import { Human } from '../entities/Human.ts';
import { Animal, Fish } from '../entities/Critters.ts';
import { spawnParticles, spawnFloatingText } from './particles.ts';
import { spawnExplosion } from './combat.ts';
import { AudioSystem } from '../audio/sfx.ts';
import { gainFaith, addChronicle, updateFaithGeneration, updateCrises, checkCrisisGeneration, updateHeroes } from './faith.ts';
import { updateClimate } from './worldgen.ts';
import { checkContextualMusic } from '../audio/music.ts';
import { updateMinimap } from '../render/minimap.ts';
import { saveGame } from '../core/storage.ts';
export function createVillage(tx, ty) {
    if(G.grid[tx][ty].type === TERRAIN.WATER || G.grid[tx][ty].type === TERRAIN.FIRE) return;
    if(G.grid[tx][ty].ownerId) return;
    let v = new Village(tx, ty); G.villages.push(v);
    // A founding generation of mixed ages, so the village starts with
    // children, working adults and grandparents. Same-age founders all die
    // of old age at the same time and the village goes extinct.
    const foundingAges = [12, 19, 27, 40];
    for (let i = 0; i < foundingAges.length; i++) G.humans.push(new Human(tx + Math.random(), ty + Math.random(), v.id, foundingAges[i]));
    spawnFloatingText(tx, ty, "¡NUEVA ALDEA!", v.color); spawnParticles(tx, ty, v.color, 30, 40); AudioSystem.play('spawn');
    gainFaith(5);
    addChronicle(`🏛️ Nació la aldea <span style="color:${v.color}">${v.name}</span>`);
    updateMinimap();
    return v;
}

export function updateLogic() {
    if(G.gameState !== 'PLAYING') return;
    G.timeTick++;
    updateClimate();
    updateFaithGeneration();
    updateCrises();
    if(G.timeTick % 180 === 0) checkCrisisGeneration();
    if(G.timeTick % 60 === 0)  updateHeroes();
    if(G.timeTick % 120 === 0) checkContextualMusic();

    if(G.timeTick % 300 === 0) saveGame();

    for(let x=0; x<G.cols; x++) { 
        for(let y=0; y<G.rows; y++) { 
            let t = G.grid[x][y]; 
            if(t.type === TERRAIN.FIRE) { t.fireTimer++; if(Math.random() < 0.1) spawnParticles(x+0.5, y+0.5, '#7f8c8d', 1, 20); if(t.fireTimer > 60) { t.type = TERRAIN.SAND; t.fireTimer = 0; t.hasHouse = false; t.isTownHall = false; t.buildingType = null; t.ownerId = null; } } 

            // Crecimiento pasivo de arbustos (frecuencia reducida radicalmente para evitar plagas)
            if(t.type === TERRAIN.GRASS && !t.hasHouse && !t.hasRoad && !t.hasBerries && Math.random() < 0.000005) t.hasBerries = true;

            // NUEVO: Crecimiento y expansión de los bosques
            if(t.type === TERRAIN.FOREST && Math.random() < 0.00002) {
                // Expansión a casillas adyacentes
                let nx = x + Math.floor(Math.random()*3)-1; let ny = y + Math.floor(Math.random()*3)-1;
                if(nx>=0 && nx<G.cols && ny>=0 && ny<G.rows) {
                    let nt = G.grid[nx][ny];
                    if(nt.type === TERRAIN.GRASS && !nt.hasHouse && !nt.hasRoad) { 
                        nt.type = TERRAIN.FOREST; 
                        nt.hasBerries = false; 
                    }
                }
            } else if (t.type === TERRAIN.GRASS && !t.hasHouse && !t.hasRoad && Math.random() < 0.000001) {
                // Brote espontáneo aislado
                t.type = TERRAIN.FOREST; 
                t.hasBerries = false;
            }
        } 
    }

    for(let i=G.villages.length-1; i>=0; i--) {
        let v = G.villages[i]; let vHumans = G.humans.filter(h => h.villageId === v.id);
        if(vHumans.length === 0 || v.territory.length === 0) {
            v.territory.forEach(t => { G.grid[t.x][t.y].ownerId = null; }); G.villages.forEach(otherV => {otherV.enemies.delete(v.id); otherV.allies.delete(v.id);}); vHumans.forEach(h => h.hp = 0); 
            if(G.selectedVillageId === v.id) { G.selectedVillageId = null; vPanel.style.display = 'none'; }
            G.villages.splice(i, 1); updateMinimap(); continue;
        }
        v.update();
        let capacity = v.getCapacity(); let fertileAdults = vHumans.filter(h => h.age >= 15 && h.age <= 45).length;
        if(G.simSettings.breedEnabled && v.food >= 5 && vHumans.length < capacity && fertileAdults >= 2 && Math.random() < 0.05) { v.food -= 5; G.humans.push(new Human(v.centerX, v.centerY, v.id, 0)); spawnParticles(v.centerX, v.centerY, '#ff9ff3', 10, 20); }
    }

    for(let i=G.humans.length-1; i>=0; i--) G.humans[i].update();

    // === PROPAGACIÓN ZOMBI ===
    G.humans.forEach(zombie => {
        if(!zombie.isZombie) return;
        if(Math.random() < 0.02) {
            let nearby = G.humans.find(h => !h.isZombie && Math.abs(h.x - zombie.x) < 2 && Math.abs(h.y - zombie.y) < 2);
            if(nearby) { nearby.isZombie = true; nearby.disease = true; nearby.shirtColor = '#4a7c1f'; spawnParticles(nearby.x, nearby.y, '#badc58', 5, 20); }
        }
        if(Math.random() < 0.05) {
            let prey = G.humans.find(h => !h.isZombie && Math.abs(h.x - zombie.x) < 3 && Math.abs(h.y - zombie.y) < 3);
            if(prey) { prey.hp -= 15; zombie.target = {x: prey.x, y: prey.y}; zombie.state = 'FIGHT'; }
        }
    });

    // === TIMER LOCURA ===
    G.humans.forEach(h => {
        if(h.isMad && h.madTimer > 0) {
            h.madTimer--;
            if(h.madTimer <= 0) { h.isMad = false; h.villageId = h.madOriginalVillage; h.state = 'IDLE'; h.madOriginalVillage = null; }
        }
    });
    for(let i=G.animals.length-1; i>=0; i--) { G.animals[i].update(); if(G.animals[i].dead) G.animals.splice(i, 1); }
    for(let i=G.fishes.length-1; i>=0; i--) { G.fishes[i].update(); if(G.fishes[i].dead) G.fishes.splice(i, 1); }
    for(let i=G.particles.length-1; i>=0; i--) { G.particles[i].update(); if(G.particles[i].life <= 0) G.particles.splice(i, 1); }
    for(let i=G.floatingTexts.length-1; i>=0; i--) { G.floatingTexts[i].update(); if(G.floatingTexts[i].life <= 0) G.floatingTexts.splice(i, 1); }
    // Update bullets
    for(let i=G.bullets.length-1; i>=0; i--) {
        let b = G.bullets[i];
        b.trail.push({x: b.x, y: b.y});
        if (b.trail.length > 5) b.trail.shift();
        b.x += b.vx; b.y += b.vy; b.life--;
        if(b.life <= 0) G.bullets.splice(i, 1);
    }
    // Update explosions
    for(let i=G.explosions.length-1; i>=0; i--) {
        let e = G.explosions[i];
        e.life--; e.radius = (1 - e.life / e.maxLife) * 2.5;
        if(e.life <= 0) G.explosions.splice(i, 1);
    }

    // Reaparición del ecosistema (Repoblación forzada si son cazados)
    if (G.timeTick % 120 === 0) {
        let attemptsA = 0;
        while (G.animals.length < 80 && attemptsA < 100) { 
            let tx = Math.floor(Math.random()*G.cols); let ty = Math.floor(Math.random()*G.rows); 
            if ((G.grid[tx][ty].type === TERRAIN.GRASS || G.grid[tx][ty].type === TERRAIN.FOREST) && !G.grid[tx][ty].hasHouse) G.animals.push(new Animal(tx, ty));
            attemptsA++;
        }
        let attemptsF = 0;
        while (G.fishes.length < 80 && attemptsF < 100) { 
            let tx = Math.floor(Math.random()*G.cols); let ty = Math.floor(Math.random()*G.rows); 
            if (G.grid[tx][ty].type === TERRAIN.WATER) G.fishes.push(new Fish(tx, ty));
            attemptsF++;
        }
    }

    G.globalStats.pop = G.humans.length;
    if(G.timeTick % 10 === 0) { (document.getElementById('stat-pop') as HTMLElement).innerText = String(G.globalStats.pop); (document.getElementById('stat-villages') as HTMLElement).innerText = String(G.villages.length); (document.getElementById('stat-deaths') as HTMLElement).innerText = String(G.globalStats.deaths); updateVillagePanel(); }
    if(G.timeTick % 60 === 0) updateMinimap();
    // Ambient war sounds: random explosions + machinegun bursts on active battlefields
    if (G.timeTick % 40 === 0) {
        let warringVillages = G.villages.filter(v => v.state === 'WAR');
        if (warringVillages.length > 0) {
            let wv = warringVillages[Math.floor(Math.random() * warringVillages.length)];
            // Random battle effect near village center
            let bx = wv.centerX + (Math.random()*16-8), by = wv.centerY + (Math.random()*16-8);
            if (Math.random() < 0.25) {
                spawnExplosion(bx, by);
                AudioSystem.playAt('explosion', bx, by);
            } else if (Math.random() < 0.5) {
                AudioSystem.playAt('machinegun', bx, by);
                // Spawn smoke particles
                for (let s=0; s<4; s++) spawnParticles(bx, by, '#808080', 3, 25);
            }
        }
    }
}

export function updateVillagePanel() {
    if(!G.selectedVillageId) { vPanel.style.display = 'none'; vPanel.classList.remove('hidden'); G.villagePanelManuallyClosed = false; return; }
    let v = G.villages.find(v => v.id === G.selectedVillageId);
    if(!v) { G.selectedVillageId = null; vPanel.style.display = 'none'; vPanel.classList.remove('hidden'); G.villagePanelManuallyClosed = false; return; }

    // Si el usuario cerró manualmente, no mostrar
    if (G.villagePanelManuallyClosed) { vPanel.style.display = 'none'; return; }

    vPanel.style.display = 'flex';
    vPanel.classList.remove('hidden');
    (document.getElementById('vp-name') as HTMLElement).innerText = v.name;
    (document.getElementById('vp-name') as HTMLElement).style.color = v.color;
    (document.getElementById('vp-age') as HTMLElement).innerText = AGES_NAMES[v.age];

    let allHumans = G.humans.filter(h=>h.villageId === v.id);
    let pop = allHumans.length;
    let warriors = allHumans.filter(h=>h.role==='Guerrero').length;
    let generals = allHumans.filter(h=>h.isGeneral).length;
    let medics = allHumans.filter(h=>h.role==='Médico').length;

    (document.getElementById('vp-pop') as HTMLElement).innerText = `${pop} / ${v.getCapacity()}`;
    // Show army breakdown with general marker
    let armyLabel = warriors > 0 ? `${warriors}⚔️${generals>0?' '+generals+'⭐':''}${medics>0?' '+medics+'💊':''}` : '0';
    (document.getElementById('vp-army') as HTMLElement).innerText = armyLabel;

    (document.getElementById('vp-food') as HTMLElement).innerText = String(Math.floor(v.food));
    (document.getElementById('bar-food') as HTMLElement).style.width = `${(v.food/3000)*100}%`;

    (document.getElementById('vp-wood') as HTMLElement).innerText = String(Math.floor(v.wood));
    (document.getElementById('bar-wood') as HTMLElement).style.width = `${(v.wood/3000)*100}%`;

    (document.getElementById('vp-iron') as HTMLElement).innerText = String(Math.floor(v.iron));
    (document.getElementById('bar-iron') as HTMLElement).style.width = `${(v.iron/3000)*100}%`;

    (document.getElementById('vp-gold') as HTMLElement).innerText = String(Math.floor(v.gold));
    (document.getElementById('bar-gold') as HTMLElement).style.width = `${(v.gold/3000)*100}%`;

    (document.getElementById('vp-culture') as HTMLElement).innerText = String(Math.floor(v.culture));
    (document.getElementById('vp-stability') as HTMLElement).innerText = `${Math.floor(v.stability)}%`;

    // State with enemies/allies info
    let stateEl = document.getElementById('vp-state');
    if(v.state === 'WAR') {
        let enemyNames = Array.from(v.enemies).map(eid => { let ev = G.villages.find(ev=>ev.id===eid); return ev ? `<span style="color:${ev.color}">${ev.name}</span>` : '?'; }).join(', ');
        stateEl.innerHTML = `⚔️ Guerra contra: ${enemyNames||'?'}`;
        stateEl.style.color = '#e74c3c';
    } else if(v.allies.size > 0) {
        let allyNames = Array.from(v.allies).map(aid => { let av = G.villages.find(av=>av.id===aid); return av ? `<span style="color:${av.color}">${av.name}</span>` : '?'; }).join(', ');
        stateEl.innerHTML = `🕊️ Aliado con: ${allyNames}`;
        stateEl.style.color = '#3498db';
    } else {
        stateEl.innerHTML = '☮️ En Paz';
        stateEl.style.color = '#2ecc71';
    }
}
