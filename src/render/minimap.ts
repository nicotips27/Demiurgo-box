import { G } from '../core/state.ts';
import { mCtx, minimapCanvas, view } from '../core/dom.ts';
import { TILE_SIZE } from '../core/constants.ts';
import { TERRAIN_COLORS as COLORS } from '../core/constants.ts';
export function updateMinimap() {
    if (!G.grid || G.grid.length === 0) return;
    minimapCanvas.width = G.cols; minimapCanvas.height = G.rows;
    mCtx.imageSmoothingEnabled = false;
    let imgData = mCtx.createImageData(G.cols, G.rows);
    for(let x=0; x<G.cols; x++) {
        for(let y=0; y<G.rows; y++) {
            let idx = (y * G.cols + x) * 4; let t = G.grid[x][y]; let hex = COLORS[t.type];
            if (t.ownerId) { let v = G.villages.find(v => v.id === t.ownerId); if (v) hex = v.color; }
            let r = parseInt(hex.slice(1, 3), 16); let g = parseInt(hex.slice(3, 5), 16); let b = parseInt(hex.slice(5, 7), 16);
            imgData.data[idx] = r; imgData.data[idx+1] = g; imgData.data[idx+2] = b; imgData.data[idx+3] = 255;
        }
    }
    mCtx.putImageData(imgData, 0, 0);
}

export function updateMinimapViewbox() {
    let vb = document.getElementById('minimap-viewbox'); let mc = document.getElementById('minimap-container');
    if(!vb || !mc || mc.clientWidth === 0) return;
    let viewW = (view.w / G.zoom) / TILE_SIZE; let viewH = (view.h / G.zoom) / TILE_SIZE;
    let viewX = (-G.camX / G.zoom) / TILE_SIZE; let viewY = (-G.camY / G.zoom) / TILE_SIZE;
    let scaleX = mc.clientWidth / G.cols; let scaleY = mc.clientHeight / G.rows;
    vb.style.width = (viewW * scaleX) + 'px'; vb.style.height = (viewH * scaleY) + 'px';
    vb.style.left = (viewX * scaleX) + 'px'; vb.style.top = (viewY * scaleY) + 'px';
}

export function moveCamFromMinimap(e) {
    let mc = document.getElementById('minimap-container'); let rect = mc.getBoundingClientRect();
    let x = Math.max(0, Math.min((e as MouseEvent).clientX - rect.left, rect.width)); let y = Math.max(0, Math.min((e as MouseEvent).clientY - rect.top, rect.height));
    let targetGridX = (x / rect.width) * G.cols; let targetGridY = (y / rect.height) * G.rows;
    G.camX = -((targetGridX * TILE_SIZE) - (view.w / G.zoom / 2)) * G.zoom; G.camY = -((targetGridY * TILE_SIZE) - (view.h / G.zoom / 2)) * G.zoom;
}
