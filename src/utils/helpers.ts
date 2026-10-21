import { G } from '../core/state.ts';
import { HUMAN_NAMES, NAME_SUFFIXES } from '../core/constants.ts';
export function generateHumanName() { return HUMAN_NAMES[Math.floor(Math.random() * HUMAN_NAMES.length)] + (Math.random() > 0.5 ? " " + NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)] : ""); }
export function adjustColor(color, amount) { return '#' + color.replace(/^#/, '').replace(/../g, color => ('0'+Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2)); }

export function findResource(cx, cy, type, radius, maxSamples = 120) {
    let found = [];
    // Barrido en espiral desde el centro para encontrar lo más cercano primero
    let step = Math.max(1, Math.floor(radius / 12));
    for (let r = step; r <= radius; r += step) {
        for (let i = 0; i < 24; i++) {
            let angle = (i / 24) * Math.PI * 2;
            let nx = Math.floor(cx + Math.cos(angle) * r);
            let ny = Math.floor(cy + Math.sin(angle) * r);
            if(nx>=0 && nx<G.cols && ny>=0 && ny<G.rows && G.grid[nx][ny].type === type) {
                found.push({x:nx, y:ny, dist: r});
                if(found.length >= 3) {
                    // Ordenar por distancia y devolver
                    found.sort((a,b) => a.dist - b.dist);
                    return found;
                }
            }
        }
    }
    // También muestreo aleatorio como respaldo
    for (let i=0; i<maxSamples && found.length < 3; i++) {
        let nx = Math.floor(cx + (Math.random()*radius*2 - radius));
        let ny = Math.floor(cy + (Math.random()*radius*2 - radius));
        if(nx>=0 && nx<G.cols && ny>=0 && ny<G.rows && G.grid[nx][ny].type === type) {
            let d = Math.abs(nx-cx)+Math.abs(ny-cy);
            found.push({x:nx, y:ny, dist: d});
        }
    }
    found.sort((a,b) => a.dist - b.dist);
    return found;
}

// --- SISTEMA DE BALAS Y EXPLOSIONES ---