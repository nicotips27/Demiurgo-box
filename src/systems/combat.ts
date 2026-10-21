import { G } from '../core/state.ts';
import { TILE_SIZE } from '../core/constants.ts';
export interface Bullet {
    x: number; y: number;
    vx: number; vy: number;
    life: number; maxLife: number;
    color: string;
    trail: Array<{ x: number, y: number }>;
}

export interface Explosion {
    x: number; y: number;
    life: number; maxLife: number;
    radius: number;
}
export function spawnBullet(fromX, fromY, toX, toY, color) {
    let dx = toX - fromX, dy = toY - fromY;
    let dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 0.01) return;
    G.bullets.push({
        x: fromX, y: fromY,
        vx: (dx / dist) * 0.7,
        vy: (dy / dist) * 0.7,
        life: Math.ceil(dist / 0.7) + 3,
        maxLife: Math.ceil(dist / 0.7) + 3,
        color: color || '#FFFF88',
        trail: []
    });
}

export function spawnExplosion(x, y) {
    G.explosions.push({ x, y, life: 18, maxLife: 18, radius: 0 });
    // Spawn extra smoke/fire particles
    for (let i = 0; i < 18; i++) {
        let angle = Math.random() * Math.PI * 2;
        let speed = 0.15 + Math.random() * 0.35;
        G.particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 0.08,
            life: 25 + Math.floor(Math.random() * 20),
            maxLife: 45,
            color: Math.random() < 0.5 ? '#FF6B00' : (Math.random() < 0.5 ? '#FFD700' : '#888888'),
            size: 3 + Math.random() * 5,
            update() { this.x += this.vx; this.y += this.vy; this.vy -= 0.004; this.life--; },
            draw(ctx) {
                let alpha = this.life / this.maxLife;
                ctx.globalAlpha = alpha * 0.85;
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x * TILE_SIZE + 10, this.y * TILE_SIZE + 10, this.size * alpha + 1, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        });
    }
}

// --- SISTEMA DE GUARDADO (SAVE/LOAD) ---