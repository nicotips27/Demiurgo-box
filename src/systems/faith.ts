import { G } from '../core/state.ts';
import { CRISIS_TYPES, DIVINE_POWERS, HERO_TITLES } from '../core/constants.ts';
import { BuildingType as BLD } from '../core/types.ts';
import { TerrainType as TERRAIN } from '../core/types.ts';
import { spawnParticles, spawnFloatingText } from './particles.ts';
import { AudioSystem } from '../audio/sfx.ts';
import { updateMinimap } from '../render/minimap.ts';
import { Human } from '../entities/Human.ts';
import { Village } from '../entities/Village.ts';
// Poderes desbloqueables


// Tipos de crisis que pueden dispararse


export function addChronicle(text, highlight=false) {
    let year = Math.floor(G.timeTick / 600) + 1;
    G.chronicles.unshift({ text, year, highlight, id: Date.now() });
    if(G.chronicles.length > 40) G.chronicles.pop();
    renderChronicles();
}

export function renderChronicles() {
    let list = document.getElementById('chronicles-list');
    if(!list) return;
    list.innerHTML = G.chronicles.slice(0,18).map((c,i) =>
        `<div class="chronicle-entry${i<2?' new':''}" style="${c.highlight?'color:#c8a050;':''}">`+
        `<span class="chron-time">Año ${c.year}</span>${c.text}</div>`
    ).join('');
    list.scrollTop = list.scrollHeight;
    // Pulso: abrir sólo si estaba cerrado, cerrar tras 5s
    let panel = document.getElementById('chronicles-panel');
    let hdr   = document.getElementById('chronicles-header');
    if (panel && !G.chroniclesOpen) {
        panel.classList.add('chron-open');
        hdr.textContent = '📜 CRÓNICAS DEL MUNDO ▴';
        clearTimeout(panel._ac);
        panel._ac = setTimeout(() => {
            if (!G.chroniclesOpen) {
                panel.classList.remove('chron-open');
                hdr.textContent = '📜 CRÓNICAS DEL MUNDO ▸';
            }
        }, 5000);
    }
}

export function toggleChronicles() {
    G.chroniclesOpen = !G.chroniclesOpen;
    let panel = document.getElementById('chronicles-panel');
    let hdr   = document.getElementById('chronicles-header');
    panel.classList.toggle('chron-open', G.chroniclesOpen);
    hdr.textContent = G.chroniclesOpen ? '📜 CRÓNICAS DEL MUNDO ▴' : '📜 CRÓNICAS DEL MUNDO ▸';
    if (G.chroniclesOpen) {
        let list = document.getElementById('chronicles-list');
        if (list) list.scrollTop = list.scrollHeight;
    }
}

// ── SISTEMA DE FE ─────────────────────────────────────
export function gainFaith(amount) {
    G.divineFaith = Math.min(G.faithMax, G.divineFaith + amount);
    updateFaithUI();
}

export function spendFaith(amount) {
    if(G.divineFaith < amount) return false;
    G.divineFaith -= amount;
    updateFaithUI();
    return true;
}

export function updateFaithUI() {
    let fill = document.getElementById('faith-fill');
    let val  = document.getElementById('faith-value');
    let btn  = document.getElementById('btn-faith-count');
    if(fill) fill.style.width = (G.divineFaith/G.faithMax*100) + '%';
    if(val)  val.textContent  = Math.floor(G.divineFaith) + ' / ' + G.faithMax + ' ✦';
    if(btn)  btn.textContent  = Math.floor(G.divineFaith) + '✦';
}

export function updateFaithGeneration() {
    // Fe generada por templos, cultura y tamaño de civilización
    if(G.timeTick % 60 !== 0) return;
    let faithGain = 0;
    G.villages.forEach(v => {
        let temples = v.territory.filter(t => G.grid[t.x][t.y].buildingType === BLD.TEMPLE).length;
        faithGain += temples * 0.8 + v.culture * 0.002 + 0.05;
    });
    if(faithGain > 0) gainFaith(faithGain * 0.1);
}

// ── SISTEMA DE HÉROES ─────────────────────────────────
export function trySpawnHero(v) {
    if(G.heroes.length >= 6) return;
    if(Math.random() > 0.003) return;  // ~0.3% chance per village per tick check
    let villageHumans = G.humans.filter(h => h.villageId === v.id && !h.isHero && h.age > 18 && h.age < 40);
    if(villageHumans.length === 0) return;
    let chosen = villageHumans[Math.floor(Math.random()*villageHumans.length)];
    chosen.isHero = true;
    chosen.heroTitle = HERO_TITLES[Math.floor(Math.random()*HERO_TITLES.length)];
    chosen.heroDeeds = 0;
    chosen.maxHp = chosen.maxHp * 1.8;
    chosen.hp = chosen.maxHp;
    chosen.shirtColor = '#f1c40f';
    G.heroes.push(chosen);
    gainFaith(15);
    spawnParticles(chosen.x, chosen.y, '#f1c40f', 25, 40);
    spawnFloatingText(chosen.x, chosen.y, '⭐ HÉROE', '#f1c40f');
    // Notificación
    let notif = document.getElementById('hero-notification');
    document.getElementById('hero-notif-name').textContent = chosen.heroTitle + ' ' + chosen.name;
    document.getElementById('hero-notif-desc').textContent = `Surge en ${v.name} para guiar a su pueblo`;
    notif.style.display = 'block';
    setTimeout(() => { notif.style.display = 'none'; }, 4000);
    addChronicle(`⭐ <b>${chosen.heroTitle} ${chosen.name}</b> nació en <span style="color:${v.color}">${v.name}</span>`, true);
    AudioSystem.play('age_up');
}



export function updateHeroes() {
    for(let i = G.heroes.length-1; i >= 0; i--) {
        let h = G.heroes[i];
        if(!h || h.hp <= 0 || h.dead) {
            if(h && h.heroDeeds > 0) {
                let v = G.villages.find(v => v.id === h.villageId);
                addChronicle(`💀 ${h.heroTitle} ${h.name} cayó con ${h.heroDeeds} hazañas`, true);
                gainFaith(8);
                if(v) { v.culture += 30; v.stability = Math.min(100, v.stability + 20); }
            }
            G.heroes.splice(i, 1);
            continue;
        }
        // Heroes gain deeds from fighting
        if(h.state === 'FIGHT') {
            h.heroDeeds = (h.heroDeeds || 0);
            if(Math.random() < 0.01) {
                h.heroDeeds++;
                gainFaith(2);
                if(h.heroDeeds % 5 === 0) {
                    spawnFloatingText(h.x, h.y, `⭐×${h.heroDeeds}`, '#f1c40f');
                    let v = G.villages.find(v => v.id === h.villageId);
                    if(v) addChronicle(`⚔️ ${h.heroTitle} ${h.name} completó su hazaña #${h.heroDeeds}`);
                }
            }
        }
        // Aura de inspiración: sana a aliados cercanos
        if(G.timeTick % 120 === 0) {
            G.humans.forEach(ally => {
                if(ally.villageId === h.villageId && ally !== h) {
                    let dx = ally.x - h.x, dy = ally.y - h.y;
                    if(dx*dx+dy*dy < 16) {
                        ally.hp = Math.min(ally.maxHp, ally.hp + 5);
                        ally.hunger = Math.min(100, ally.hunger + 3);
                    }
                }
            });
        }
    }
}

// ── CRISIS SYSTEM ─────────────────────────────────────
export function checkCrisisGeneration() {
    if(G.timeTick % 200 !== 0) return;
    if(G.activeCrises.length >= 3) return;
    if(G.villages.length === 0) return;
    // Pick a random village with something interesting happening
    let candidate = null;
    let crisisType = null;

    // Fire crisis: village on fire tiles nearby
    let burningV = G.villages.find(v => v.territory.some(t => G.grid[t.x][t.y].type === TERRAIN.FIRE));
    if(burningV && !G.activeCrises.find(c=>c.villageId===burningV.id && c.type==='FIRE_CRISIS') && Math.random()<0.4) {
        candidate = burningV; crisisType = CRISIS_TYPES.find(c=>c.id==='FIRE_CRISIS');
    }
    // Famine: village very low on food
    if(!crisisType) {
        let hungryV = G.villages.find(v => v.food < 30 && G.humans.filter(h=>h.villageId===v.id).length > 3);
        if(hungryV && Math.random()<0.3) { candidate = hungryV; crisisType = CRISIS_TYPES.find(c=>c.id==='FAMINE_CRISIS'); }
    }
    // Invasion: village at war
    if(!crisisType) {
        let warV = G.villages.find(v => v.state === 'WAR');
        if(warV && Math.random()<0.25) { candidate = warV; crisisType = CRISIS_TYPES.find(c=>c.id==='INVASION'); }
    }
    // Plague
    if(!crisisType) {
        let plagueV = G.villages.find(v => G.humans.filter(h=>h.villageId===v.id&&h.disease).length > 2);
        if(plagueV && Math.random()<0.3) { candidate = plagueV; crisisType = CRISIS_TYPES.find(c=>c.id==='PLAGUE_CRISIS'); }
    }
    // Golden Age — reward event
    if(!crisisType && Math.random()<0.08) {
        let richV = G.villages.find(v => v.age >= 2 && v.culture > 80 && v.stability > 75);
        if(richV) { candidate = richV; crisisType = CRISIS_TYPES.find(c=>c.id==='GOLDEN_AGE'); }
    }

    if(candidate && crisisType) spawnCrisis(candidate, crisisType);
}

export function spawnCrisis(v, ctype) {
    if(G.activeCrises.find(c=>c.villageId===v.id && c.type===ctype.id)) return;
    let crisis = {
        id: G.nextCrisisId++, type: ctype.id, title: ctype.title,
        icon: ctype.icon, color: ctype.color, desc: ctype.desc(v.name),
        villageId: v.id, villageName: v.name,
        timer: ctype.duration, maxTimer: ctype.duration,
        bless: !!ctype.bless, resolved: false,
    };
    G.activeCrises.push(crisis);
    renderCrises();
    addChronicle(`${ctype.icon} Crisis en <span style="color:${v.color}">${v.name}</span>: ${ctype.title}`);
    AudioSystem.play('alert');
}

export function resolveCrisis(id, act) {
    let idx = G.activeCrises.findIndex(c=>c.id===id);
    if(idx === -1) return;
    let c = G.activeCrises[idx];
    let v = G.villages.find(v=>v.id===c.villageId);
    if(act && v) {
        // Intervención divina
        let cx = v.centerX, cy = v.centerY;
        if(c.type==='FIRE_CRISIS') {
            v.territory.forEach(t => { if(G.grid[t.x][t.y].type===TERRAIN.FIRE) { G.grid[t.x][t.y].type=TERRAIN.GRASS; spawnParticles(t.x,t.y,'#1B9CFC',4,20); } });
            spawnFloatingText(cx,cy,'💧 EXTINGUIDO','#1B9CFC');
            gainFaith(8);
            addChronicle(`💧 Dios apagó el incendio en <span style="color:${v.color}">${v.name}</span>`, true);
        } else if(c.type==='FAMINE_CRISIS') {
            v.food += 600; v.stability = Math.min(100, v.stability+20);
            spawnParticles(cx,cy,'#2ecc71',20,35);
            spawnFloatingText(cx,cy,'🍖 MANÁ','#2ecc71');
            gainFaith(6);
            addChronicle(`🍖 Dios envió maná a <span style="color:${v.color}">${v.name}</span>`, true);
        } else if(c.type==='INVASION' || c.type==='PLAGUE_CRISIS') {
            G.humans.filter(h=>h.villageId===v.id).forEach(h=>{h.hp=h.maxHp;h.disease=false;h.isZombie=false;});
            v.stability=Math.min(100,v.stability+30);
            spawnParticles(cx,cy,'#f1c40f',25,40);
            spawnFloatingText(cx,cy,'✨ GRACIA','#f1c40f');
            gainFaith(10);
            addChronicle(`✨ Dios concedió gracia a <span style="color:${v.color}">${v.name}</span>`, true);
        } else if(c.type==='GOLDEN_AGE') {
            v.wood+=300; v.food+=300; v.gold+=200; v.culture+=25;
            spawnParticles(cx,cy,'#f1c40f',30,45);
            gainFaith(20);
            addChronicle(`👑 <span style="color:${v.color}">${v.name}</span> fue bendecida en su Edad de Oro`, true);
        }
    } else if(!act) {
        // Ignorar: consecuencias
        if(v && !c.bless) {
            if(c.type==='FIRE_CRISIS') { v.wood = Math.max(0, v.wood-200); }
            else if(c.type==='FAMINE_CRISIS') { G.humans.filter(h=>h.villageId===v.id).forEach(h=>h.hunger=Math.max(0,h.hunger-30)); }
            addChronicle(`😶 Dios ignoró la crisis en <span style="color:${v&&v.color}'#fff'}">${c.villageName}</span>`);
        }
    }
    G.activeCrises.splice(idx,1);
    renderCrises();
}

export function updateCrises() {
    if(G.timeTick % 10 !== 0) return;
    let changed = false;
    for(let i=G.activeCrises.length-1; i>=0; i--) {
        G.activeCrises[i].timer--;
        if(G.activeCrises[i].timer <= 0) {
            let c = G.activeCrises[i];
            // Expired without action — bad outcome
            let v = G.villages.find(v=>v.id===c.villageId);
            if(v && !c.bless) {
                v.stability = Math.max(0, v.stability-25);
                addChronicle(`💔 Crisis no resuelta en <span style="color:${v.color}">${v.name}</span>. Consecuencias.`);
            }
            G.activeCrises.splice(i,1);
            changed = true;
        }
    }
    if(changed) renderCrises();
}

export function renderCrises() {
    let container = document.getElementById('crisis-container');
    if(!container) return;
    container.innerHTML = '';
    G.activeCrises.forEach(c => {
        let pct = (c.timer / c.maxTimer * 100).toFixed(0);
        let div = document.createElement('div');
        div.className = 'crisis-card' + (c.bless?' bless-crisis':'');
        div.innerHTML = `
            <div class="crisis-title">${c.icon} ${c.title}</div>
            <div class="crisis-desc">${c.desc}</div>
            <div class="crisis-timer">⏳ ${pct}% tiempo restante</div>
            <div class="crisis-actions">
                <button class="crisis-btn crisis-btn-act" onclick="resolveCrisis(${c.id},true)">
                    ${c.bless?'✨ Bendecir':'⚡ Intervenir'}
                </button>
                <button class="crisis-btn crisis-btn-ign" onclick="resolveCrisis(${c.id},false)">Ignorar</button>
            </div>`;
        container.appendChild(div);
    });
}

// ── ÁRBOL DE PODERES ─────────────────────────────────
export function openPowersModal() {
    renderPowerTree();
    (document.getElementById('powers-modal') as HTMLElement).style.display='block';
}

export function renderPowerTree() {
    let grid2 = document.getElementById('power-tree-grid');
    if(!grid2) return;
    grid2.innerHTML = DIVINE_POWERS.map(p => {
        let canAfford = G.divineFaith >= p.cost;
        let cls = p.unlocked ? 'unlocked' : (!canAfford ? 'locked' : '');
        return `<div class="power-node ${cls}" onclick="unlockPower('${p.id}')">
            <span class="power-node-badge ${p.unlocked?'badge-unlocked':'badge-locked'}">${p.unlocked?'✔ ACTIVO':'🔒'}</span>
            <div class="power-node-icon">${p.icon}</div>
            <div class="power-node-name">${p.name}</div>
            <div class="power-node-desc">${p.desc}</div>
            <div class="power-node-cost">${p.unlocked?'Desbloqueado':'Costo: '+p.cost+' ✦ Fe'}</div>
        </div>`;
    }).join('');
}

export function unlockPower(id) {
    let p = DIVINE_POWERS.find(p=>p.id===id);
    if(!p || p.unlocked) return;
    if(!spendFaith(p.cost)) {
        spawnFloatingText(Math.floor(G.cols/2), Math.floor(G.rows/2), '¡Fe insuficiente!', '#e74c3c');
        return;
    }
    p.unlocked = true;
    // Agregar al toolbar
    addPowerToToolbar(p);
    renderPowerTree();
    addChronicle(`⬡ Poder desbloqueado: <b>${p.name}</b>`, true);
    AudioSystem.play('age_up');
}

export function addPowerToToolbar(p) {
    // Add to god toolbar row
    let toolbar = document.querySelectorAll('.toolbar')[1];
    if(!toolbar) return;
    // Check not already added
    if(document.querySelector(`[data-type="${p.id}"]`)) return;
    let btn = document.createElement('button');
    btn.className = 'tool-btn btn-god';
    btn.setAttribute('data-type', p.id);
    btn.setAttribute('data-name', p.name);
    btn.textContent = p.icon + ' ' + p.name;
    toolbar.appendChild(btn);
    // Re-bind toolbar event (clone approach)
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        G.currentTool = { id: p.id, type: 'god' };
        (document.getElementById('current-power-name') as HTMLElement).innerText = p.name;
        (document.getElementById('current-power-name') as HTMLElement).style.color = '#e056fd';
    });
}

export function initFaithUI() {
    (document.getElementById('faith-bar-container') as HTMLElement).style.display = 'flex';
    (document.getElementById('chronicles-panel') as HTMLElement).style.display = 'block';
    (document.getElementById('divine-powers-btn') as HTMLElement).style.display = 'block';
    G.divineFaith = 0; G.heroes = []; G.activeCrises = []; G.chronicles = [];
    updateFaithUI();
}
