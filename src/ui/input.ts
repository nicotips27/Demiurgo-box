import { G } from '../core/state.ts';
import { canvas, tooltip } from '../core/dom.ts';
import { TILE_SIZE } from '../core/constants.ts';
import { TerrainType as TERRAIN } from '../core/types.ts';
import { applyPower } from '../systems/power.ts';
import { moveCamFromMinimap } from '../render/minimap.ts';
import { AudioSystem } from '../audio/sfx.ts';
window.addEventListener('contextmenu', e => {
    if ((e.target as HTMLElement).closest('#ui-layer > *') && !(e.target as HTMLElement).closest('#minimap-container')) return;
    e.preventDefault(); 
}); 

window.addEventListener('mousedown', (e) => {
    if(G.gameState !== 'PLAYING') return;
    if((e.target as HTMLElement).closest('#minimap-container')) { G.isMinimapPanning = true; moveCamFromMinimap(e); return; }
    if((e.target as HTMLElement).closest('#ui-layer > *') && !(e.target as HTMLElement).closest('#cam-hint') && !(e.target as HTMLElement).closest('#tooltip')) return;

    if(e.button === 2 || e.button === 1) { G.isPanning = true; G.startPanX = (e as MouseEvent).clientX - G.camX; G.startPanY = (e as MouseEvent).clientY - G.camY; canvas.style.cursor = 'grabbing'; return; }

    G.isDrawing = true; let tx = Math.floor((((e as MouseEvent).clientX - G.camX) / G.zoom) / TILE_SIZE); let ty = Math.floor((((e as MouseEvent).clientY - G.camY) / G.zoom) / TILE_SIZE); applyPower(tx, ty);
});

window.addEventListener('mousemove', (e) => {
    if(G.gameState !== 'PLAYING') return;
    if(G.isMinimapPanning) { moveCamFromMinimap(e); return; }
    if(G.isPanning) { G.camX = (e as MouseEvent).clientX - G.startPanX; G.camY = (e as MouseEvent).clientY - G.startPanY; return; }

    let worldX = ((e as MouseEvent).clientX - G.camX) / G.zoom; let worldY = ((e as MouseEvent).clientY - G.camY) / G.zoom;
    G.hoverTx = Math.floor(worldX / TILE_SIZE); G.hoverTy = Math.floor(worldY / TILE_SIZE);

    if((e.target as HTMLElement).closest('#ui-layer > *') && !(e.target as HTMLElement).closest('#cam-hint') && !(e.target as HTMLElement).closest('#tooltip') && !(e.target as HTMLElement).closest('#minimap-container')) {
        tooltip.style.display = 'none'; G.hoverTx = -1; G.hoverTy = -1; return;
    }

    let tx = G.hoverTx; let ty = G.hoverTy;
    let hoveredHuman = G.humans.find(h => Math.abs(h.x + 0.5 - worldX/TILE_SIZE) < 0.8 && Math.abs(h.y + 0.5 - worldY/TILE_SIZE) < 0.8);

    if (hoveredHuman) {
        tooltip.style.display = 'block'; let ttW = tooltip.offsetWidth || 200; let ttH = tooltip.offsetHeight || 120;
        let left = (e as MouseEvent).clientX + 15; let top = (e as MouseEvent).clientY + 15;
        if(left + ttW > window.innerWidth) left = (e as MouseEvent).clientX - ttW - 10; if(top + ttH > window.innerHeight) top = (e as MouseEvent).clientY - ttH - 10;
        tooltip.style.left = left + 'px'; tooltip.style.top = top + 'px';
        let v = G.villages.find(vv => vv.id === hoveredHuman.villageId);
        let vName = v ? `<span style="color:${v.color};font-size:10px;">${v.name} (Edad ${v.age})</span>` : '<span style="color:#888">Sin aldea</span>';
        let stateNames = {'IDLE':'Descansando','GATHER':'Talando','GATHER_IRON':'Minando Hierro','GATHER_GOLD':'Minando Oro','GATHER_FOOD':'Recolectando','SWIM':'Nadando hacia la orilla','BUILD':'Construyendo','FIGHT':'¡En combate!','FLEE':'¡Huyendo!','FISH':'Pescando','TRADE':'Comerciando','HUNT':'Cazando','COLONIZE':'Colonizando','HEAL':'Curando','WANDER':'Patrullando'};
        let stateName = stateNames[hoveredHuman.state] || hoveredHuman.state;
        let stateColor = hoveredHuman.state === 'FIGHT' ? '#e74c3c' : (hoveredHuman.state === 'FLEE' ? '#e67e22' : (hoveredHuman.state === 'BUILD' ? '#3498db' : '#2ecc71'));
        let hpBarW = Math.round((hoveredHuman.hp / hoveredHuman.maxHp) * 60);
        let hpColor = hoveredHuman.hp > 60 ? '#2ecc71' : (hoveredHuman.hp > 30 ? '#f39c12' : '#e74c3c');
        let generalBadge = hoveredHuman.isGeneral ? ' <span style="color:#FFD700">⭐General</span>' : '';
        let diseaseBadge = hoveredHuman.disease ? ' <span style="color:#badc58">☣Enfermo</span>' : '';
        let zombieBadge = hoveredHuman.isZombie ? ' <span style="color:#4a7c1f">🧟Zombi</span>' : '';
        tooltip.innerHTML = `
            <div style="border-bottom:1px solid rgba(232,184,75,0.3);margin-bottom:5px;padding-bottom:4px;">
                <strong style="color:${hoveredHuman.shirtColor}; font-size:13px;">${hoveredHuman.name}</strong>${generalBadge}${diseaseBadge}${zombieBadge}<br>
                ${vName}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;font-size:11px;">
                <span style="color:#8a7a60">Edad:</span><span>${Math.floor(hoveredHuman.age)}/${Math.floor(hoveredHuman.maxAge)}a</span>
                <span style="color:#8a7a60">Rol:</span><span style="color:#e8dfc8">${hoveredHuman.role}</span>
                <span style="color:#8a7a60">Pers.:</span><span><i>${hoveredHuman.personality}</i></span>
                <span style="color:#8a7a60">Exp:</span><span style="color:#fbc531">${hoveredHuman.exp}⭐</span>
                <span style="color:#8a7a60">Estado:</span><span style="color:${stateColor}">${stateName}</span>
                <span style="color:#8a7a60">Hambre:</span><span style="color:#f39c12">${Math.floor(hoveredHuman.hunger)}%</span>
            </div>
            <div style="margin-top:4px;">
                <div style="font-size:10px;color:#8a7a60;margin-bottom:2px;">Vida: ${Math.floor(hoveredHuman.hp)}/${Math.floor(hoveredHuman.maxHp)}</div>
                <div style="background:rgba(183,28,28,0.5);height:4px;border-radius:2px;"><div style="background:${hpColor};height:4px;border-radius:2px;width:${hpBarW}px;max-width:60px;transition:width 0.3s;"></div></div>
            </div>`;
    } else {
        let t = null; if(tx>=0 && tx<G.cols && ty>=0 && ty<G.rows) t = G.grid[tx][ty];
        if(t && t.ownerId && G.currentTool.type !== 'select') {
            let v = G.villages.find(v => v.id === t.ownerId);
            if(v) {
                tooltip.style.display = 'block'; let ttW = tooltip.offsetWidth || 200; let ttH = tooltip.offsetHeight || 100;
                let left = (e as MouseEvent).clientX + 15; let top = (e as MouseEvent).clientY + 15;
                if(left + ttW > window.innerWidth) left = (e as MouseEvent).clientX - ttW - 10; if(top + ttH > window.innerHeight) top = (e as MouseEvent).clientY - ttH - 10;
                tooltip.style.left = left + 'px'; tooltip.style.top = top + 'px';
                let myPop = G.humans.filter(h => h.villageId === v.id).length;
                let buildName = {'BONFIRE':'Hoguera','HOUSE':'Casa','TOWNHALL':'Ayuntamiento','FARM':'Granja','MINE':'Mina','BARRACKS':'Cuartel','MARKET':'Mercado','DOCK':'Puerto','WELL':'Pozo','WINDMILL':'Molino','WATCHTOWER':'Torre de Guardia','TEMPLE':'Templo','WALL':'Muro'};
                let bldLabel = t.buildingType ? `<span style="color:#fbc531">${buildName[t.buildingType]||t.buildingType}${t.houseLevel>1?' Nv.'+t.houseLevel:''}</span>` : `<span style="color:#7a7060">Terreno</span>`;
                tooltip.innerHTML = `<strong style="color:${v.color}">${v.name}</strong> <span style="color:#6a5a40;font-size:10px;">Edad ${v.age} · ${['Paz','Guerra'][v.state==='WAR'?1:0]}</span><br>
                👥 ${myPop}hab · ⚔️${v.armySize} · 💰${Math.floor(v.gold)}<br>
                📍 ${bldLabel}<br>
                <span style="font-size:10px;color:#6a5a40">Clic con 👆 para ver detalles</span>`;
            }
        } else if(t && t.buildingType && G.currentTool.type === 'select') {
            let buildName2 = {'BONFIRE':'Hoguera','HOUSE':'Casa','TOWNHALL':'Ayuntamiento','FARM':'Granja','MINE':'Mina','BARRACKS':'Cuartel','MARKET':'Mercado','DOCK':'Puerto','WELL':'Pozo','WINDMILL':'Molino','WATCHTOWER':'Torre de Guardia','TEMPLE':'Templo','WALL':'Muro'};
            tooltip.style.display = 'block';
            let left = (e as MouseEvent).clientX + 15; let top = (e as MouseEvent).clientY + 15; if(left+180>window.innerWidth) left=(e as MouseEvent).clientX-190; if(top+60>window.innerHeight) top=(e as MouseEvent).clientY-70;
            tooltip.style.left=left+'px'; tooltip.style.top=top+'px';
            tooltip.innerHTML = `<span style="color:#fbc531">${buildName2[t.buildingType]||t.buildingType}</span>${t.houseLevel>1?' · Nivel '+t.houseLevel:''}<br><span style="font-size:10px;color:#6a5a40">Clic para seleccionar aldea</span>`;
        } else { tooltip.style.display = 'none'; }
    }
    if (G.isDrawing && G.currentTool.type === 'terrain') applyPower(tx, ty);
});

window.addEventListener('mouseup', (e) => { G.isPanning = false; G.isDrawing = false; G.isMinimapPanning = false; canvas.style.cursor = 'crosshair'; });
window.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; G.isPanning = false; G.isDrawing = false; G.isMinimapPanning = false; canvas.style.cursor = 'crosshair'; G.hoverTx = -1; G.hoverTy = -1; });

// ═══════════════════════════════════════════════════════════════════
//  CAPA DE COMPATIBILIDAD TÁCTIL — Mobile Touch Layer
//  Toque simple = aplicar poder / seleccionar
//  Arrastre = dibujar terreno
//  Dos dedos = mover cámara + pinch zoom
//  Toque en minimapa = centrar cámara
// ═══════════════════════════════════════════════════════════════════

export function getTouchDist(t1, t2) {
    let dx = t1.clientX - t2.clientX;
    let dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

export function getTouchCenter(t1, t2) {
    return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
}

export function touchToTile(touch) {
    let worldX = (touch.clientX - G.camX) / G.zoom;
    let worldY = (touch.clientY - G.camY) / G.zoom;
    return { tx: Math.floor(worldX / TILE_SIZE), ty: Math.floor(worldY / TILE_SIZE) };
}

export function isTouchOnUI(touch) {
    let el = document.elementFromPoint(touch.clientX, touch.clientY);
    return el && (el.closest('#ui-layer > *') || el.closest('#minimap-container'));
}

// ── touchstart ──────────────────────────────────────────────────
canvas.addEventListener('touchstart', (e) => {
    if (G.gameState !== 'PLAYING') return;
    e.preventDefault();
    AudioSystem.init();

    const touches = (e as TouchEvent).touches;
    G.touchState.fingerCount = touches.length;

    if (touches.length === 1) {
        const t = touches[0];
        G.touchState.active = true;
        G.touchState.startX = t.clientX;
        G.touchState.startY = t.clientY;
        G.touchState.lastX = t.clientX;
        G.touchState.lastY = t.clientY;
        G.touchState.startTime = Date.now();
        G.touchState.moved = false;
        G.touchState.isLongPress = false;

        // Check if touch is on minimap
        if ((t.target as HTMLElement).closest('#minimap-container')) {
            G.isMinimapPanning = true;
            moveCamFromMinimap({ clientX: t.clientX, clientY: t.clientY });
            return;
        }

        // Start long-press timer for tooltip
        G.touchState.longPressTimer = setTimeout(() => {
            if (!G.touchState.moved && G.touchState.fingerCount === 1) {
                G.touchState.isLongPress = true;
                // Show tooltip at touch position
                let { tx, ty } = touchToTile(t);
                G.hoverTx = tx; G.hoverTy = ty;
                // Trigger tooltip by simulating mouse position
                let worldX = (t.clientX - G.camX) / G.zoom;
                let worldY = (t.clientY - G.camY) / G.zoom;
                let hoveredHuman = G.humans.find(h => Math.abs(h.x + 0.5 - worldX/TILE_SIZE) < 0.8 && Math.abs(h.y + 0.5 - worldY/TILE_SIZE) < 0.8);
                if (hoveredHuman) {
                    tooltip.style.display = 'block';
                    tooltip.style.left = Math.min(t.clientX + 15, window.innerWidth - 210) + 'px';
                    tooltip.style.top = Math.min(t.clientY + 15, window.innerHeight - 130) + 'px';
                    let v = G.villages.find(vv => vv.id === hoveredHuman.villageId);
                    let vName = v ? `<span style="color:${v.color};font-size:10px;">${v.name} (Edad ${v.age})</span>` : '<span style="color:#888">Sin aldea</span>';
                    let stateNames = {'IDLE':'Descansando','GATHER':'Talando','GATHER_IRON':'Minando Hierro','GATHER_GOLD':'Minando Oro','GATHER_FOOD':'Recolectando','SWIM':'Nadando hacia la orilla','BUILD':'Construyendo','FIGHT':'¡En combate!','FLEE':'¡Huyendo!','FISH':'Pescando','TRADE':'Comerciando','HUNT':'Cazando','COLONIZE':'Colonizando','HEAL':'Curando','PATROL':'Patrullando'};
                    let stateName = stateNames[hoveredHuman.state] || hoveredHuman.state;
                    let stateColor = hoveredHuman.state === 'FIGHT' ? '#e74c3c' : (hoveredHuman.state === 'FLEE' ? '#e67e22' : (hoveredHuman.state === 'BUILD' ? '#3498db' : '#2ecc71'));
                    let hpBarW = Math.round((hoveredHuman.hp / hoveredHuman.maxHp) * 60);
                    let hpColor = hoveredHuman.hp > 60 ? '#2ecc71' : (hoveredHuman.hp > 30 ? '#f39c12' : '#e74c3c');
                    let generalBadge = hoveredHuman.isGeneral ? ' <span style="color:#FFD700">⭐General</span>' : '';
                    tooltip.innerHTML = `
                        <div style="border-bottom:1px solid rgba(232,184,75,0.3);margin-bottom:5px;padding-bottom:4px;">
                            <strong style="color:${hoveredHuman.shirtColor}; font-size:13px;">${hoveredHuman.name}</strong>${generalBadge}<br>
                            ${vName}
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px;font-size:11px;">
                            <span style="color:#8a7a60">Edad:</span><span>${Math.floor(hoveredHuman.age)}/${Math.floor(hoveredHuman.maxAge)}a</span>
                            <span style="color:#8a7a60">Rol:</span><span style="color:#e8dfc8">${hoveredHuman.role}</span>
                            <span style="color:#8a7a60">Estado:</span><span style="color:${stateColor}">${stateName}</span>
                        </div>
                        <div style="margin-top:4px;">
                            <div style="font-size:10px;color:#8a7a60;margin-bottom:2px;">Vida: ${Math.floor(hoveredHuman.hp)}/${Math.floor(hoveredHuman.maxHp)}</div>
                            <div style="background:rgba(183,28,28,0.5);height:4px;border-radius:2px;"><div style="background:${hpColor};height:4px;border-radius:2px;width:${hpBarW}px;max-width:60px;"></div></div>
                        </div>`;
                } else {
                    let t2 = null; if(tx>=0 && tx<G.cols && ty>=0 && ty<G.rows) t2 = G.grid[tx][ty];
                    if(t2 && t2.ownerId) {
                        let v = G.villages.find(vv => vv.id === t2.ownerId);
                        if(v) {
                            tooltip.style.display = 'block';
                            tooltip.style.left = Math.min(t.clientX + 15, window.innerWidth - 200) + 'px';
                            tooltip.style.top = Math.min(t.clientY + 15, window.innerHeight - 80) + 'px';
                            let myPop = G.humans.filter(h => h.villageId === v.id).length;
                            tooltip.innerHTML = `<strong style="color:${v.color}">${v.name}</strong> <span style="color:#6a5a40;font-size:10px;">Edad ${v.age}</span><br>👥 ${myPop}hab · ⚔️${v.armySize}`;
                        }
                    }
                }
            }
        }, 500);
    }

    if (touches.length === 2) {
        // Two-finger start: pan + pinch zoom
        clearTimeout(G.touchState.longPressTimer);
        G.touchState.moved = true; // prevent tap on 2-finger
        const t1 = touches[0], t2 = touches[1];
        G.touchState.pinchStartDist = getTouchDist(t1, t2);
        G.touchState.pinchStartZoom = G.zoom;
        let center = getTouchCenter(t1, t2);
        G.touchState.panStartCamX = G.camX;
        G.touchState.panStartCamY = G.camY;
        G.touchState.lastTwoFingerX = center.x;
        G.touchState.lastTwoFingerY = center.y;
        G.isPanning = true;
    }
}, { passive: false });

// ── touchmove ───────────────────────────────────────────────────
canvas.addEventListener('touchmove', (e) => {
    if (G.gameState !== 'PLAYING') return;
    e.preventDefault();
    const touches = (e as TouchEvent).touches;

    if (touches.length === 1 && G.touchState.active && !G.isMinimapPanning) {
        const t = touches[0];
        let dx = t.clientX - G.touchState.startX;
        let dy = t.clientY - G.touchState.startY;
        // If finger moved more than 10px, consider it a drag (not tap)
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
            G.touchState.moved = true;
            clearTimeout(G.touchState.longPressTimer);
        }

        // If not a long press and tool is terrain → draw while dragging
        if (!G.touchState.isLongPress && G.currentTool.type === 'terrain') {
            G.isDrawing = true;
            let { tx, ty } = touchToTile(t);
            applyPower(tx, ty);
        }

        // Single-finger pan if no terrain tool
        if (!G.touchState.isLongPress && G.currentTool.type !== 'terrain') {
            G.camX += t.clientX - G.touchState.lastX;
            G.camY += t.clientY - G.touchState.lastY;
        }

        G.touchState.lastX = t.clientX;
        G.touchState.lastY = t.clientY;
    }

    // Two-finger: pinch zoom + pan
    if (touches.length === 2) {
        clearTimeout(G.touchState.longPressTimer);
        G.touchState.moved = true;
        const t1 = touches[0], t2 = touches[1];

        // Pinch zoom
        let dist = getTouchDist(t1, t2);
        let scale = dist / G.touchState.pinchStartDist;
        let newZoom = G.touchState.pinchStartZoom * scale;
        newZoom = Math.min(Math.max(0.2, newZoom), 4);

        // Zoom toward pinch center
        let center = getTouchCenter(t1, t2);
        let worldX = (center.x - G.touchState.panStartCamX) / G.touchState.pinchStartZoom;
        let worldY = (center.y - G.touchState.panStartCamY) / G.touchState.pinchStartZoom;
        G.zoom = newZoom;
        G.camX = center.x - worldX * G.zoom;
        G.camY = center.y - worldY * G.zoom;

        // Pan with two-finger drag
        G.camX += center.x - G.touchState.lastTwoFingerX;
        G.camY += center.y - G.touchState.lastTwoFingerY;
        G.touchState.lastTwoFingerX = center.x;
        G.touchState.lastTwoFingerY = center.y;
    }
}, { passive: false });

// ── touchend ────────────────────────────────────────────────────
canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    clearTimeout(G.touchState.longPressTimer);

    // Minimap end
    if (G.isMinimapPanning && (e as TouchEvent).touches.length === 0) {
        G.isMinimapPanning = false;
    }

    // Single tap: apply power (if didn't move and not long press)
    if (G.touchState.active && !G.touchState.moved && !G.touchState.isLongPress && G.touchState.fingerCount === 1) {
        const elapsed = Date.now() - G.touchState.startTime;
        if (elapsed < 300) {
            // It's a tap — apply power at start position
            let worldX = (G.touchState.startX - G.camX) / G.zoom;
            let worldY = (G.touchState.startY - G.camY) / G.zoom;
            let tx = Math.floor(worldX / TILE_SIZE);
            let ty = Math.floor(worldY / TILE_SIZE);
            applyPower(tx, ty);
        }
    }

    // Two-finger lift
    if ((e as TouchEvent).touches.length < 2) {
        G.isPanning = false;
    }

    // All fingers up
    if ((e as TouchEvent).touches.length === 0) {
        G.touchState.active = false;
        G.touchState.fingerCount = 0;
        G.isDrawing = false;
        G.isPanning = false;
        tooltip.style.display = 'none';
        G.hoverTx = -1; G.hoverTy = -1;
    }
}, { passive: false });

// Prevent pinch-zoom the whole page on iOS
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('gesturechange', (e) => e.preventDefault());
document.addEventListener('gestureend', (e) => e.preventDefault());

window.addEventListener('wheel', (e) => {
    if(G.gameState !== 'PLAYING') return; 
    if((e.target as HTMLElement).closest('#ui-layer > *') && !(e.target as HTMLElement).closest('#minimap-container')) return; 
    e.preventDefault(); 
    let worldX = ((e as MouseEvent).clientX - G.camX) / G.zoom; let worldY = ((e as MouseEvent).clientY - G.camY) / G.zoom;
    let zoomFactor = 1.1; if (e.deltaY < 0) G.zoom *= zoomFactor; else G.zoom /= zoomFactor;
    G.zoom = Math.min(Math.max(0.2, G.zoom), 4); 
    G.camX = (e as MouseEvent).clientX - worldX * G.zoom; G.camY = (e as MouseEvent).clientY - worldY * G.zoom;
}, { passive: false });

// === MENÚ ACORDEÓN DE MALDICIONES ===

export function toggleCurseMenu(e) {
    e.stopPropagation();
    AudioSystem.init(); AudioSystem.play('click');
    let dropdown = document.getElementById('curse-dropdown');
    let isOpen = dropdown.classList.contains('open');
    // Cerrar si ya está abierto; de lo contrario, activar la herramienta y abrir
    if (isOpen) {
        dropdown.classList.remove('open');
    } else {
        // Activar botón como herramienta actual
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        (document.getElementById('btn-curse-main') as HTMLElement).classList.add('active');
        G.currentTool = { id: G.activeCurseId, type: 'god' };
        let nameEl = document.getElementById('current-power-name');
        nameEl.innerText = document.querySelector('.curse-option.active-curse')?.getAttribute('data-name') || 'Maldecir';
        nameEl.style.color = '#e056fd';
        dropdown.classList.add('open');
    }
}

export function selectCurse(el) {
    G.activeCurseId = el.getAttribute('data-curse');
    let name = el.getAttribute('data-name');
    // Marcar activo visual
    document.querySelectorAll('.curse-option').forEach(c => c.classList.remove('active-curse'));
    el.classList.add('active-curse');
    // Actualizar herramienta
    G.currentTool = { id: G.activeCurseId, type: 'god' };
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    (document.getElementById('btn-curse-main') as HTMLElement).classList.add('active');
    let nameEl = document.getElementById('current-power-name');
    nameEl.innerText = name;
    nameEl.style.color = '#e056fd';
    (document.getElementById('curse-dropdown') as HTMLElement).classList.remove('open');
    AudioSystem.play('click');
}

// Cerrar dropdown al hacer clic fuera
document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('#curse-wrapper')) {
        (document.getElementById('curse-dropdown') as HTMLElement).classList.remove('open');
    }
});

document.querySelectorAll('button').forEach(btn => { btn.addEventListener('mousedown', () => { AudioSystem.init(); AudioSystem.play('click'); }); });
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (btn.id === 'btn-curse-main') return; // manejado por toggleCurseMenu
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active');
        const typeInfo = btn.getAttribute('data-type');
        if (typeInfo === 'SELECT') G.currentTool = { id: 'SELECT', type: 'select' }; else if (TERRAIN[typeInfo] !== undefined) G.currentTool = { id: TERRAIN[typeInfo], type: 'terrain' }; else G.currentTool = { id: typeInfo, type: 'god' };
        let nameEl = document.getElementById('current-power-name'); nameEl.innerText = btn.getAttribute('data-name');
        if(G.currentTool.type === 'god') nameEl.style.color = '#e056fd'; else if(G.currentTool.type === 'select') nameEl.style.color = '#3498db'; else nameEl.style.color = '#fbc531';
        (document.getElementById('curse-dropdown') as HTMLElement).classList.remove('open');
    });
});

// ═══════════════════════════════════════════════════════════════
//  TOOLBAR — Draggable + Collapsible
// ═══════════════════════════════════════════════════════════════
(function() {
    const panel = document.getElementById('top-panel');
    const handle = document.getElementById('panel-drag-handle');
    const collapseBtn = document.getElementById('panel-collapse-btn');
    let isDragging = false, startX, startY, startLeft, startTop;

    // Collapse / Expand
    window.toggleToolbarCollapse = function() {
        panel.classList.toggle('collapsed');
        collapseBtn.textContent = panel.classList.contains('collapsed') ? '▴' : '▾';
    };

    // Reset position
    window.resetToolbarPosition = function() {
        panel.style.left = '50%';
        panel.style.top = '10px';
        panel.style.transform = 'translateX(-50%)';
        panel.classList.remove('collapsed');
        collapseBtn.textContent = '▾';
    };

    // Drag — Mouse
    handle.addEventListener('mousedown', (e) => {
        if ((e.target as HTMLElement).closest('.panel-collapse-btn')) return;
        isDragging = true;
        panel.classList.add('dragging');
        const rect = panel.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        startX = (e as MouseEvent).clientX;
        startY = (e as MouseEvent).clientY;
        panel.style.transform = 'none';
        panel.style.left = startLeft + 'px';
        panel.style.top = startTop + 'px';
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let newLeft = startLeft + ((e as MouseEvent).clientX - startX);
        let newTop = startTop + ((e as MouseEvent).clientY - startY);
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - panel.offsetWidth));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - panel.offsetHeight));
        panel.style.left = newLeft + 'px';
        panel.style.top = newTop + 'px';
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        panel.classList.remove('dragging');
    });

    // Drag — Touch
    handle.addEventListener('touchstart', (e) => {
        if ((e.target as HTMLElement).closest('.panel-collapse-btn')) return;
        isDragging = true;
        panel.classList.add('dragging');
        const rect = panel.getBoundingClientRect();
        const t = (e as TouchEvent).touches[0];
        startLeft = rect.left;
        startTop = rect.top;
        startX = t.clientX;
        startY = t.clientY;
        panel.style.transform = 'none';
        panel.style.left = startLeft + 'px';
        panel.style.top = startTop + 'px';
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const t = (e as TouchEvent).touches[0];
        let newLeft = startLeft + (t.clientX - startX);
        let newTop = startTop + (t.clientY - startY);
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - panel.offsetWidth));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - panel.offsetHeight));
        panel.style.left = newLeft + 'px';
        panel.style.top = newTop + 'px';
    }, { passive: true });

    window.addEventListener('touchend', () => {
        isDragging = false;
        panel.classList.remove('dragging');
    });
})();

// ═══════════════════════════════════════════════════════════════
//  SIDE PANELS — Draggable + Closeable
// ═══════════════════════════════════════════════════════════════
window.closeSidePanel = function(id) {
    (document.getElementById(id) as HTMLElement).classList.add('hidden');
    if (id === 'village-panel') G.villagePanelManuallyClosed = true;
};

(function() {
    document.querySelectorAll('.side-panel-drag').forEach(handle => {
        const panelId = handle.getAttribute('data-panel');
        const panel = document.getElementById(panelId);
        if (!panel) return;

        let isDragging = false, startX, startY, startLeft, startTop;

        // Mouse drag
        handle.addEventListener('mousedown', (e) => {
            if ((e.target as HTMLElement).closest('.side-panel-close')) return;
            isDragging = true;
            panel.classList.add('dragging');
            const rect = panel.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            startX = (e as MouseEvent).clientX;
            startY = (e as MouseEvent).clientY;
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            let newLeft = startLeft + ((e as MouseEvent).clientX - startX);
            let newTop = startTop + ((e as MouseEvent).clientY - startY);
            newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - panel.offsetWidth));
            newTop = Math.max(0, Math.min(newTop, window.innerHeight - panel.offsetHeight));
            panel.style.left = newLeft + 'px';
            panel.style.top = newTop + 'px';
            panel.style.right = 'auto';
        });

        window.addEventListener('mouseup', () => {
            if (isDragging) { isDragging = false; panel.classList.remove('dragging'); }
        });

        // Touch drag
        handle.addEventListener('touchstart', (e) => {
            if ((e.target as HTMLElement).closest('.side-panel-close')) return;
            isDragging = true;
            panel.classList.add('dragging');
            const rect = panel.getBoundingClientRect();
            const t = (e as TouchEvent).touches[0];
            startLeft = rect.left;
            startTop = rect.top;
            startX = t.clientX;
            startY = t.clientY;
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            const t = (e as TouchEvent).touches[0];
            let newLeft = startLeft + (t.clientX - startX);
            let newTop = startTop + (t.clientY - startY);
            newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - panel.offsetWidth));
            newTop = Math.max(0, Math.min(newTop, window.innerHeight - panel.offsetHeight));
            panel.style.left = newLeft + 'px';
            panel.style.top = newTop + 'px';
            panel.style.right = 'auto';
        }, { passive: true });

        window.addEventListener('touchend', () => {
            if (isDragging) { isDragging = false; panel.classList.remove('dragging'); }
        });
    });
})();

export function setSpeed(s, btn) { G.simSettings.speed = s; document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
export function toggleSetting(setting) { let btn = document.getElementById(setting === 'war' ? 'toggle-war' : 'toggle-breed'); btn.classList.toggle('on'); if(setting === 'war') G.simSettings.warsEnabled = !G.simSettings.warsEnabled; if(setting === 'breed') G.simSettings.breedEnabled = !G.simSettings.breedEnabled; }

export function updateBrushSize(val) {
    let size = parseInt(val);
    let labels = ["Pequeño", "Mediano", "Grande", "Enorme"];
    (document.getElementById('brush-size-val') as HTMLElement).innerText = labels[size - 1];
    G.brushRadius = size - 1; 
}
