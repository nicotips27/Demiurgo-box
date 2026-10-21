import { G } from '../core/state.ts';
import { HERO_TITLES } from '../core/constants.ts';
import { TerrainType as TERRAIN } from '../core/types.ts';
import { BuildingType as BLD } from '../core/types.ts';
import { spawnParticles, spawnFloatingText } from './particles.ts';
import { createVillage } from './sim.ts';
import { AudioSystem } from '../audio/sfx.ts';
import { gainFaith, addChronicle, trySpawnHero } from './faith.ts';
import { updateMinimap } from '../render/minimap.ts';
import { updateVillagePanel } from './sim.ts';
import { Tile } from '../entities/Tile.ts';
import { Village } from '../entities/Village.ts';
import { Human } from '../entities/Human.ts';
export function applyPower(tx, ty) {
    if (tx < 0 || tx >= G.cols || ty < 0 || ty >= G.rows) return;
    let type = G.currentTool.type; let id = G.currentTool.id;
    if (type === 'select') { let t = G.grid[tx][ty]; if(t.ownerId) { G.selectedVillageId = t.ownerId; G.villagePanelManuallyClosed = false; updateVillagePanel(); AudioSystem.play('click'); } }
    else if (type === 'terrain') {
        let placed = false;
        for(let i = -G.brushRadius; i <= G.brushRadius; i++) { for(let j = -G.brushRadius; j <= G.brushRadius; j++) {
            if(tx+i>=0 && tx+i<G.cols && ty+j>=0 && ty+j<G.rows) {
                let t = G.grid[tx+i][ty+j]; if(t.type !== id) placed = true; t.type = Number(id) as TERRAIN;
                if(id === TERRAIN.WATER || id === TERRAIN.FIRE) { t.hasHouse = false; t.isTownHall = false; t.buildingType = null; t.ownerId = null; t.hasRoad = false; } 
                else if (id === TERRAIN.IRON || id === TERRAIN.GOLD || id === TERRAIN.FOREST) { t.hasHouse = false; t.isTownHall = false; t.buildingType = null; }
            }
        }}
        if(placed && Math.random() < 0.2) AudioSystem.play('place'); updateMinimap();
    } 
    else if (type === 'god') {
        if(id === 'SPAWN_VILLAGE') createVillage(tx, ty);
        else if(id === 'SMITE') {
            let r = G.brushRadius;
            let hit = false;
            for(let i = -r; i <= r; i++) { for(let j = -r; j <= r; j++) { 
                if(tx+i>=0 && tx+i<G.cols && ty+j>=0 && ty+j<G.rows) { 
                    G.grid[tx+i][ty+j].type = TERRAIN.FIRE; G.grid[tx+i][ty+j].hasHouse = false; 
                    if(Math.random() < 0.3) spawnParticles(tx+i, ty+j, '#fbc531', 2, 40);
                    hit = true;
                } 
            }}
            G.humans.forEach(h => { if(h.x >= tx-r && h.x < tx+r+1 && h.y >= ty-r && h.y < ty+r+1) h.hp = 0; }); 
            G.animals.forEach(a => { if(a.x >= tx-r && a.x < tx+r+1 && a.y >= ty-r && a.y < ty+r+1) a.dead = true; });
            if (hit) { spawnFloatingText(tx, ty, "¡CASTIGO DIVINO!", '#fbc531'); AudioSystem.play('smite'); updateMinimap(); }
        }
        else if(id === 'BLESS') {
            let r = G.brushRadius;
            let targets = new Set();
            let blessedHumans = 0;
            for(let i = -r; i <= r; i++) { for(let j = -r; j <= r; j++) { 
                if(tx+i>=0 && tx+i<G.cols && ty+j>=0 && ty+j<G.rows) {
                    if(G.grid[tx+i][ty+j].ownerId) targets.add(G.grid[tx+i][ty+j].ownerId); 
                    if(Math.random() < 0.3) spawnParticles(tx+i, ty+j, '#2ecc71', 2, 40);
                }
            }}
            targets.forEach(vId => {
                let v = G.villages.find(v => v.id === vId); 
                if(v) { 
                    v.wood += 500; v.food += 500; v.iron += 200; v.gold += 100; 
                    v.stability += 20; if(v.stability>100) v.stability=100; 

                    // Imponer la PAZ a la aldea bendecida y a sus enemigos mutuos
                    v.enemies.forEach(enemyId => {
                        let enemyV = G.villages.find(ev => ev.id === enemyId);
                        if (enemyV) {
                            enemyV.enemies.delete(v.id);
                            if (enemyV.enemies.size === 0) enemyV.state = 'PEACE';
                        }
                    });
                    v.enemies.clear();
                    v.state = 'PEACE';
                }
            });
            G.humans.forEach(h => { 
                if(h.x >= tx-r && h.x < tx+r+1 && h.y >= ty-r && h.y < ty+r+1) { 
                    h.hp = h.maxHp; h.disease = false; 
                    if (h.state === 'FIGHT' || h.state === 'FLEE') { 
                        h.state = 'IDLE'; 
                        h.target = null; 
                    }
                    blessedHumans++; 
                } 
            });
            if(targets.size > 0 || blessedHumans > 0) {
                spawnFloatingText(tx, ty, "¡PAZ Y BENDICIÓN!", '#2ecc71'); AudioSystem.play('bless');
            } else {
                spawnFloatingText(tx, ty, "¿Nadie aquí?", '#bdc3c7');
            }
        }
        else if(id === 'CURSE') {
            let r = G.brushRadius;
            let cursed = 0;
            for(let i = -r; i <= r; i++) { for(let j = -r; j <= r; j++) { 
                if(tx+i>=0 && tx+i<G.cols && ty+j>=0 && ty+j<G.rows) {
                    if(Math.random() < 0.3) spawnParticles(tx+i, ty+j, '#8e44ad', 2, 40);
                }
            }}
            G.humans.forEach(h => { 
                if(h.x >= tx-r && h.x < tx+r+1 && h.y >= ty-r && h.y < ty+r+1) { h.disease = true; cursed++; } 
            });
            G.animals.forEach(a => { 
                if(a.x >= tx-r && a.x < tx+r+1 && a.y >= ty-r && a.y < ty+r+1) { a.dead = true; }
            });
            if(cursed > 0) {
                spawnFloatingText(tx, ty, "¡PLAGA!", '#8e44ad'); AudioSystem.play('curse');
            }
        }
        else if(id === 'ZOMBIE') {
            let r = G.brushRadius;
            let infected = 0;
            for(let i = -r; i <= r; i++) { for(let j = -r; j <= r; j++) {
                if(tx+i>=0 && tx+i<G.cols && ty+j>=0 && ty+j<G.rows) {
                    if(Math.random() < 0.4) spawnParticles(tx+i, ty+j, '#badc58', 3, 35);
                }
            }}
            G.humans.forEach(h => {
                if(h.x >= tx-r && h.x < tx+r+1 && h.y >= ty-r && h.y < ty+r+1) {
                    h.disease = true; h.isZombie = true; h.shirtColor = '#4a7c1f'; infected++;
                }
            });
            if(infected > 0) {
                spawnFloatingText(tx, ty, "¡ZOMBIS!", '#badc58'); AudioSystem.play('curse');
            }
        }
        else if(id === 'CIVIL_WAR') {
            let r = G.brushRadius + 3;
            let affectedVillages = new Set();
            for(let i = -r; i <= r; i++) { for(let j = -r; j <= r; j++) {
                if(tx+i>=0 && tx+i<G.cols && ty+j>=0 && ty+j<G.rows && G.grid[tx+i][ty+j].ownerId) {
                    affectedVillages.add(G.grid[tx+i][ty+j].ownerId);
                    if(Math.random() < 0.2) spawnParticles(tx+i, ty+j, '#e74c3c', 2, 25);
                }
            }}
            affectedVillages.forEach(vId => {
                let v = G.villages.find(v => v.id === vId);
                if(v && v.population > 4) {
                    // Crear una facción rebelde como nueva aldea
                    let rebel = createVillage(Math.floor(v.centerX + (Math.random()*6-3)), Math.floor(v.centerY + (Math.random()*6-3)));
                    if(rebel) {
                        rebel.name = v.name + " (Rebeldes)";
                        // Hacer enemigas
                        v.enemies.add(rebel.id); rebel.enemies.add(v.id);
                        v.state = 'WAR'; rebel.state = 'WAR';
                        v.stability = Math.max(0, v.stability - 40);
                        // Transferir algunos humanos al bando rebelde
                        let villageHumans = G.humans.filter(h => h.villageId === v.id);
                        let splitCount = Math.floor(villageHumans.length / 3);
                        for(let k = 0; k < splitCount; k++) {
                            if(villageHumans[k]) villageHumans[k].villageId = rebel.id;
                        }
                    }
                }
            });
            if(affectedVillages.size > 0) {
                spawnFloatingText(tx, ty, "¡GUERRA CIVIL!", '#e74c3c'); AudioSystem.play('smite');
            } else {
                spawnFloatingText(tx, ty, "Sin aldea aquí", '#bdc3c7');
            }
        }
        else if(id === 'FAMINE') {
            let r = G.brushRadius + 2;
            let affected = new Set();
            for(let i = -r; i <= r; i++) { for(let j = -r; j <= r; j++) {
                if(tx+i>=0 && tx+i<G.cols && ty+j>=0 && ty+j<G.rows) {
                    let tile = G.grid[tx+i][ty+j];
                    tile.hasBerries = false;
                    if(tile.buildingType === BLD.FARM || tile.buildingType === BLD.WINDMILL) {
                        tile.hasHouse = false; tile.buildingType = null;
                    }
                    if(tile.ownerId) affected.add(tile.ownerId);
                    if(Math.random() < 0.25) spawnParticles(tx+i, ty+j, '#d35400', 2, 20);
                }
            }}
            affected.forEach(vId => {
                let v = G.villages.find(v => v.id === vId);
                if(v) { v.food = Math.max(0, v.food - 800); v.stability = Math.max(0, v.stability - 20); }
            });
            G.humans.forEach(h => {
                if(h.x >= tx-r && h.x < tx+r+1 && h.y >= ty-r && h.y < ty+r+1) {
                    h.hunger = Math.max(0, h.hunger - 50);
                }
            });
            if(affected.size > 0 || true) {
                spawnFloatingText(tx, ty, "¡HAMBRUNA!", '#d35400'); AudioSystem.play('curse');
            }
        }
        else if(id === 'MADNESS') {
            let r = G.brushRadius;
            let driven = 0;
            for(let i = -r; i <= r; i++) { for(let j = -r; j <= r; j++) {
                if(tx+i>=0 && tx+i<G.cols && ty+j>=0 && ty+j<G.rows) {
                    if(Math.random() < 0.35) spawnParticles(tx+i, ty+j, '#9b59b6', 2, 30);
                }
            }}
            G.humans.forEach(h => {
                if(h.x >= tx-r && h.x < tx+r+1 && h.y >= ty-r && h.y < ty+r+1) {
                    // Hacer que ataquen a su propia aldea cambiándoles bando temporalmente
                    let ownVId = h.villageId;
                    let otherVillage = G.villages.find(v => v.id !== ownVId);
                    if(otherVillage) {
                        h.isMad = true;
                        h.madTimer = 300 + Math.floor(Math.random() * 200);
                        h.madOriginalVillage = ownVId;
                        h.villageId = otherVillage.id;
                        h.state = 'FIGHT';
                    }
                    driven++;
                }
            });
            if(driven > 0) {
                spawnFloatingText(tx, ty, "¡LOCURA!", '#9b59b6'); AudioSystem.play('curse');
            }
        }
        else if(id === 'METEOR_RAIN') {
            let r = G.brushRadius + 3;
            let strikes = 5 + G.brushRadius * 3;
            let hit = false;
            for(let s = 0; s < strikes; s++) {
                let mx = tx + Math.floor(Math.random() * (r*2+1)) - r;
                let my = ty + Math.floor(Math.random() * (r*2+1)) - r;
                if(mx >= 0 && mx < G.cols && my >= 0 && my < G.rows) {
                    G.grid[mx][my].type = TERRAIN.FIRE;
                    if(G.grid[mx][my].hasHouse) { G.grid[mx][my].hasHouse = false; G.grid[mx][my].buildingType = null; }
                    spawnParticles(mx, my, '#fbc531', 5, 40);
                    spawnParticles(mx, my, '#e74c3c', 3, 25);
                    hit = true;
                }
            }
            G.humans.forEach(h => {
                if(h.x >= tx-r && h.x < tx+r+1 && h.y >= ty-r && h.y < ty+r+1 && Math.random() < 0.4) {
                    h.hp -= 60;
                }
            });
            if(hit) { spawnFloatingText(tx, ty, "¡METEOROS!", '#fbc531'); AudioSystem.play('smite'); updateMinimap(); }
        }
        // ── PODERES DESBLOQUEABLES ────────────────────────
        else if(id === 'RAIN_GOLD') {
            let targets = new Set();
            let r = G.brushRadius + 1;
            for(let i=-r;i<=r;i++) for(let j=-r;j<=r;j++) { let t=G.grid[tx+i]&&G.grid[tx+i][ty+j]; if(t&&t.ownerId) targets.add(t.ownerId); if(t) spawnParticles(tx+i,ty+j,'#f1c40f',3,30); }
            targets.forEach(vId => { let v=G.villages.find(v=>v.id===vId); if(v){v.gold+=500;v.culture+=15;v.stability=Math.min(100,v.stability+10);} });
            spawnFloatingText(tx,ty,'💛 LLUVIA DE ORO','#f1c40f'); AudioSystem.play('bless');
            addChronicle(`💛 Dios hizo llover oro sobre el mundo`);
        }
        else if(id === 'RAISE_HERO') {
            let near = G.humans.find(h => Math.abs(h.x-tx)<3 && Math.abs(h.y-ty)<3 && !h.isHero);
            if(near) {
                let v = G.villages.find(v=>v.id===near.villageId);
                if(v) trySpawnHero(v); // force one
                near.isHero=true; near.heroTitle=HERO_TITLES[Math.floor(Math.random()*HERO_TITLES.length)];
                near.heroDeeds=0; near.maxHp*=1.8; near.hp=near.maxHp; near.shirtColor='#f1c40f';
                if(!G.heroes.includes(near)) G.heroes.push(near);
                spawnParticles(near.x,near.y,'#f1c40f',30,45);
                spawnFloatingText(near.x,near.y,'⭐ HÉROE ELEGIDO','#f1c40f');
                addChronicle(`⭐ Dios engendró al héroe <b>${near.heroTitle} ${near.name}</b>`, true);
                AudioSystem.play('age_up');
            } else spawnFloatingText(tx,ty,'No hay candidatos','#888');
        }
        else if(id === 'GROW_FOREST') {
            let r = G.brushRadius + 2;
            for(let i=-r;i<=r;i++) for(let j=-r;j<=r;j++) {
                let nx=tx+i,ny=ty+j; if(nx<0||nx>=G.cols||ny<0||ny>=G.rows) continue;
                let t=G.grid[nx][ny];
                if((t.type===TERRAIN.GRASS||t.type===TERRAIN.SAND)&&!t.hasHouse) { t.type=TERRAIN.FOREST; t.hasBerries=Math.random()<0.3; spawnParticles(nx,ny,'#1B5E20',2,15); }
            }
            spawnFloatingText(tx,ty,'🌳 BOSQUE SAGRADO','#2ecc71'); AudioSystem.play('bless'); updateMinimap();
        }
        else if(id === 'EARTHQUAKE') {
            let r = G.brushRadius + 2;
            let affected = new Set();
            for(let i=-r;i<=r;i++) for(let j=-r;j<=r;j++) {
                let nx=tx+i,ny=ty+j; if(nx<0||nx>=G.cols||ny<0||ny>=G.rows) continue;
                let t=G.grid[nx][ny];
                if(t.hasHouse) { t.hasHouse=false; t.buildingType=null; t.isTownHall=false; spawnParticles(nx,ny,'#8B4513',4,20); }
                if(t.type===TERRAIN.GRASS&&Math.random()<0.3) t.type=Math.random()<0.4?TERRAIN.GOLD:TERRAIN.IRON;
                if(t.ownerId) affected.add(t.ownerId);
            }
            affected.forEach(vId=>{ let v=G.villages.find(v=>v.id===vId); if(v) v.stability=Math.max(0,v.stability-20); });
            G.humans.forEach(h=>{ if(h.x>=tx-r&&h.x<tx+r+1&&h.y>=ty-r&&h.y<ty+r+1) h.hp-=30; });
            spawnFloatingText(tx,ty,'🌍 TERREMOTO','#8B4513'); AudioSystem.play('smite'); updateMinimap();
            addChronicle(`🌍 Terremoto divino reveló minerales en el mundo`);
        }
        else if(id === 'DIVINE_WALL') {
            let v=null; let t=G.grid[tx][ty]; if(t.ownerId) v=G.villages.find(v=>v.id===t.ownerId);
            if(v) {
                let cx=v.centerX,cy=v.centerY,wallR=5;
                for(let angle=0;angle<360;angle+=15) {
                    let wx=Math.round(cx+Math.cos(angle*Math.PI/180)*wallR);
                    let wy=Math.round(cy+Math.sin(angle*Math.PI/180)*wallR);
                    if(wx>=0&&wx<G.cols&&wy>=0&&wy<G.rows&&!G.grid[wx][wy].hasHouse) {
                        G.grid[wx][wy].hasHouse=true; G.grid[wx][wy].buildingType=BLD.WALL; G.grid[wx][wy].ownerId=v.id;
                        if(!v.territory.some(t=>t.x===wx&&t.y===wy)) v.territory.push({x:wx,y:wy});
                        spawnParticles(wx,wy,'#bdc3c7',3,20);
                    }
                }
                spawnFloatingText(cx,cy,'🏰 MURO SAGRADO','#bdc3c7'); AudioSystem.play('build');
                addChronicle(`🏰 Dios erigió un muro sagrado en <span style="color:${v.color}">${v.name}</span>`);
            }
        }
        else if(id === 'RAPTURE') {
            let r = G.brushRadius + 1;
            let count=0;
            for(let i=-r;i<=r;i++) for(let j=-r;j<=r;j++) { if(Math.random()<0.4) spawnParticles(tx+i,ty+j,'#fff5cc',2,25); }
            G.humans.forEach(h=>{
                if(h.x>=tx-r&&h.x<tx+r+1&&h.y>=ty-r&&h.y<ty+r+1) {
                    h.hp=h.maxHp; h.hunger=100; h.disease=false; h.isZombie=false;
                    h.state='IDLE'; count++;
                }
            });
            let targets=new Set();
            for(let i=-r;i<=r;i++) for(let j=-r;j<=r;j++) { let t=G.grid[tx+i]&&G.grid[tx+i][ty+j]; if(t&&t.ownerId) targets.add(t.ownerId); }
            targets.forEach(vId=>{let v=G.villages.find(v=>v.id===vId);if(v){v.stability=Math.min(100,v.stability+30);v.culture+=10;}});
            spawnFloatingText(tx,ty,'✨ ARREBATO','#fff5cc'); AudioSystem.play('bless');
        }
        else if(id === 'STORM_CALL') {
            let extinguished=0;
            for(let x=0;x<G.cols;x++) for(let y=0;y<G.rows;y++) {
                if(G.grid[x][y].type===TERRAIN.FIRE) { G.grid[x][y].type=TERRAIN.GRASS; extinguished++; spawnParticles(x,y,'#1B9CFC',3,15); }
            }
            // Also fill some nearby water
            spawnFloatingText(tx,ty,`⛈️ TORMENTA (${extinguished} fuegos)`, '#1B9CFC'); AudioSystem.play('bless'); updateMinimap();
            addChronicle(`⛈️ Dios invocó una tormenta que apagó ${extinguished} incendios`, true);
        }
        else if(id === 'PLAGUE_CURE') {
            let r=G.brushRadius+1; let cured=0;
            G.humans.forEach(h=>{
                if(h.x>=tx-r&&h.x<tx+r+1&&h.y>=ty-r&&h.y<ty+r+1&&(h.disease||h.isZombie)) {
                    h.disease=false; h.isZombie=false; h.shirtColor=null; h.hp=Math.min(h.maxHp,h.hp+30);
                    spawnParticles(h.x,h.y,'#2ecc71',5,20); cured++;
                }
            });
            if(cured>0) { spawnFloatingText(tx,ty,`💊 CURADOS: ${cured}`,'#2ecc71'); AudioSystem.play('bless'); }
            else spawnFloatingText(tx,ty,'No hay enfermos','#888');
        }
    } // end type === 'god'
} // end applyPower