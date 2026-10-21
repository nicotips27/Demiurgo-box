/**
 * DemiurgoBox — entry point.
 *
 * The game used to live as a single 5,244-line inline <script> inside
 * index.html. It now lives in src/ as ES modules:
 *
 *   core/      state (G), constants, types, DOM handles, save/load, main loop
 *   entities/  Tile, Village, Human, Animal, Fish
 *   systems/   world generation, simulation, faith, crises, powers, particles
 *   render/    asset loading, the world renderer, the minimap
 *   ui/        input handling, menus, modals
 *   audio/     procedural SFX and the music engine
 *
 * Importing the modules below registers their side effects (asset loading,
 * event listeners) and gives the page one place to boot from.
 */
import './core/loop.ts';
import './ui/input.ts';
import './ui/modals.ts';
import './ui/misc.ts';
import './ui/window-bridge.ts';
import './render/assets.ts';
import './render/renderer.ts';
import './render/minimap.ts';
import './systems/worldgen.ts';
import './systems/sim.ts';
import './systems/faith.ts';
import './systems/power.ts';
import './audio/sfx.ts';
import './audio/music.ts';
import './core/storage.ts';
