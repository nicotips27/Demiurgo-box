import { G } from '../core/state.ts';
import { ctx } from '../core/dom.ts';
import { TILE_SIZE } from '../core/constants.ts';
export class FloatingText {
    x: number;
    y: number;
    text: string;
    color: string;
    life: number;
    maxLife: number;
    constructor(x, y, text, color) { this.x = x; this.y = y; this.text = text; this.color = color; this.life = 90; this.maxLife = 90; }
    update() { this.y -= 0.02; this.life--; }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife); ctx.fillStyle = this.color; ctx.font = "bold 16px 'Segoe UI'"; ctx.textAlign = "center";
        ctx.strokeStyle = "rgba(0,0,0,0.8)"; ctx.lineWidth = 3; ctx.strokeText(this.text, this.x * TILE_SIZE + TILE_SIZE/2, this.y * TILE_SIZE + TILE_SIZE/2); ctx.fillText(this.text, this.x * TILE_SIZE + TILE_SIZE/2, this.y * TILE_SIZE + TILE_SIZE/2); ctx.globalAlpha = 1;
    }
}
export function spawnFloatingText(x, y, text, color) { if(G.gameState !== 'PLAYING') return; G.floatingTexts.push(new FloatingText(x, y, text, color)); }

export class Particle {
    x: number;
    y: number;
    color: string;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size?: number;
    constructor(x, y, color, vx, vy, life) { this.x = x; this.y = y; this.color = color; this.vx = vx; this.vy = vy; this.life = life; this.maxLife = life; }
    update() { this.x += this.vx; this.y += this.vy; this.life--; }
    draw(ctx) { ctx.globalAlpha = Math.max(0, this.life / this.maxLife); ctx.fillStyle = this.color; ctx.fillRect(this.x * TILE_SIZE + TILE_SIZE/2, this.y * TILE_SIZE + TILE_SIZE/2, 3, 3); ctx.globalAlpha = 1; }
}
export function spawnParticles(x, y, color, amount, lifeBase) {
    if(G.gameState !== 'PLAYING') return;
    if (G.particles.length > 800) return; 
    for(let i=0; i<amount; i++) G.particles.push(new Particle(x + Math.random(), y + Math.random(), color, (Math.random()-0.5)*0.2, (Math.random()-0.5)*0.2, lifeBase + Math.random()*20));
}
