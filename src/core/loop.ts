import { G } from './state.ts';
import { updateLogic } from '../systems/sim.ts';
import { drawWorld } from '../render/renderer.ts';
export function mainLoop() {
    if(G.simSettings.speed > 0 && G.simSettings.speed < 1) {
        G.frameCounter += G.simSettings.speed;
        if(G.frameCounter >= 1) { updateLogic(); G.frameCounter -= 1; }
    } else { for(let i=0; i<G.simSettings.speed; i++) updateLogic(); }
    drawWorld(); requestAnimationFrame(mainLoop);
}

/**
 * Debug hook: advance the simulation by a fixed number of ticks without
 * waiting for real time to pass. Used by scripts/needs-test.mjs to fast
 * forward a few simulated decades in a second.
 */
if (typeof window !== 'undefined') {
    (window as any).__stepSim = (ticks: number) => {
        for (let i = 0; i < ticks; i++) updateLogic();
        return G.timeTick;
    };
}
