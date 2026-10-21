import { G } from '../core/state.ts';
import { openModal, closeModal } from './modal-utils.ts';
import { AudioSystem } from '../audio/sfx.ts';
import { MusicEngine, stopAllMusic, playGameMusic } from '../audio/music.ts';
import { initWorld, applyClimateToWorld } from '../systems/worldgen.ts';
import { initFaithUI, addChronicle } from '../systems/faith.ts';
import { saveGame, loadGame, checkSave } from '../core/storage.ts';
import { setSpeed } from './input.ts';
export const CLIMATE_DESCRIPTIONS = {
    temperate: '🌤️ <b>Templado</b>: Condiciones normales. Clima equilibrado, bosques abundantes, recursos moderados.',
    tropical: '🌴 <b>Tropical</b>: Bosques densos y mucha comida, pero lluvias frecuentes ralentizan la construcción. Alta biodiversidad.',
    arid: '☀️ <b>Árido</b>: Poco agua y comida escasa. Más oro en el subsuelo. Los humanos trabajan más lento bajo el calor.',
    cold: '🌨️ <b>Frío</b>: Recursos menguantes en invierno. Los humanos necesitan más comida. Minerales abundantes bajo el hielo.',
    stormy: '⛈️ <b>Tormentoso</b>: Rayos incendian edificios esporádicamente. Las tormentas dañan cultivos. Alto riesgo, alta recompensa.',
    volcanic_climate: '🔥 <b>Volcánico</b>: Erupciones periódicas destruyen terreno. Suelo muy fértil entre erupciones. Mucho hierro y oro.',
    plague: '☣️ <b>Plaga</b>: Enfermedades se propagan más rápido. Las aldeas deben construir médicos o perecer. Máxima dificultad.',
    blessed: '✨ <b>Bendecido</b>: Terreno fértil, recursos abundantes, pocos desastres. Ideal para ver civilizaciones florecer.'
};

export const MAP_DESCRIPTIONS = {
    random: '🌍 Forma aleatoria. Cada partida es un mundo nuevo e impredecible.',
    pangea: '🟢 Un solo supercontinente. Ejércitos terrestres dominan, el comercio marítimo es limitado.',
    archipelago: '🏝️ Muchas islas pequeñas. Las civilizaciones se aíslan y compiten por recursos.',
    ring: '🍩 Continente en anillo. El centro es océano, las costas son fértiles y estratégicas.',
    continents: '🌎 Varios continentes separados. La tecnología naval es clave para la expansión.',
    desert: '🏜️ Terreno árido dominado por arena. Poca vegetación, mucho oro subterráneo.',
    volcanic: '🌋 Montañas volcánicas y lava. Terreno peligroso pero extremadamente fértil.',
    frozen: '❄️ Tundra helada. Recursos escasos, los humanos luchan por sobrevivir.'
};

export function selectMap(type) {
    G.selectedMapType = type;
    document.querySelectorAll('.map-card:not(.climate-card)').forEach(c => (c as HTMLElement).style.borderColor = '');
    (event.currentTarget as HTMLElement).style.borderColor = '#f1c40f';
    document.getElementById('map-desc').innerHTML = MAP_DESCRIPTIONS[type] || '';
}

export function selectClimate(climate) {
    G.selectedClimate = climate;
    document.querySelectorAll('.climate-card').forEach(c => (c as HTMLElement).style.borderColor = '');
    (document.getElementById('climate-' + climate) as HTMLElement).style.borderColor = '#f1c40f';
    document.getElementById('climate-desc').innerHTML = CLIMATE_DESCRIPTIONS[climate] || '';
}

export function launchGame() {
    let mapType = G.selectedMapType || 'random';
    let climate = G.selectedClimate || 'temperate';
    G.currentClimate = climate;
    startNewGame(mapType);
}

export function startNewGame(mapType) {
    AudioSystem.init(); stopAllMusic();
    localStorage.removeItem('demirgobox_save');
    closeModal('map-selector'); (document.getElementById('main-menu') as HTMLElement).style.opacity = '0';
    setTimeout(() => { 
        (document.getElementById('main-menu') as HTMLElement).style.display = 'none'; 
        (document.getElementById('ui-layer') as HTMLElement).style.display = 'flex'; 
        initWorld(mapType); 
        applyClimateToWorld(G.currentClimate);
        G.gameState = 'PLAYING'; 
        G.hasActiveGame = true;
        initFaithUI();
        addChronicle('🌍 El mundo fue creado. Los primeros humanos despiertan...', true);
        if (G.musicEnabled) playGameMusic(); // playGameMusic llama unlockAllTracks internamente
        checkSave();
        saveGame();
        setTimeout(()=> { (document.getElementById('cam-hint') as HTMLElement).style.display = 'none'; }, 10000); 
    }, 500);
}

export function resumeGame() {
    AudioSystem.init(); stopAllMusic();
    (document.getElementById('main-menu') as HTMLElement).style.opacity = '0';
    setTimeout(() => { 
        (document.getElementById('main-menu') as HTMLElement).style.display = 'none'; 
        (document.getElementById('ui-layer') as HTMLElement).style.display = 'flex'; 
        if (!G.hasActiveGame) { loadGame(); }
        G.gameState = 'PLAYING'; 
        G.hasActiveGame = true;
        if (G.musicEnabled) playGameMusic(); // playGameMusic llama unlockAllTracks internamente
    }, 500);
}

export function openInGameMenu() { G.previousSpeed = G.simSettings.speed; let pauseBtn = Array.from(document.querySelectorAll('.speed-btn')).find(b => (b as HTMLElement).innerText.includes('⏸')); if(pauseBtn) setSpeed(0, pauseBtn); else G.simSettings.speed = 0; (document.getElementById('ingame-menu') as HTMLElement).style.display = 'block'; }
export function closeInGameMenu() { (document.getElementById('ingame-menu') as HTMLElement).style.display = 'none'; let buttons = Array.from(document.querySelectorAll('.speed-btn')); let targetBtn = buttons.find(b => (b as HTMLElement).innerText.includes(G.previousSpeed + 'x') || (G.previousSpeed === 0.5 && (b as HTMLElement).innerText.includes('0.5x'))); if(targetBtn) setSpeed(G.previousSpeed, targetBtn); else setSpeed(1, buttons[2]); }
export function restartGame() { (document.getElementById('ingame-menu') as HTMLElement).style.display = 'none'; initWorld(G.currentMapType); let buttons = Array.from(document.querySelectorAll('.speed-btn')); if(buttons.length > 2) setSpeed(1, buttons[2]); }
export function exitToMainMenu() {
    saveGame();
    (document.getElementById('ingame-menu') as HTMLElement).style.display = 'none'; (document.getElementById('ui-layer') as HTMLElement).style.display = 'none'; (document.getElementById('main-menu') as HTMLElement).style.display = 'flex';
    void document.getElementById('main-menu').offsetWidth; (document.getElementById('main-menu') as HTMLElement).style.opacity = '1';
    // Siempre reproducir música de menú si el jugador la tiene activada
    if (G.musicEnabled) {
        stopAllMusic();
        MusicEngine.startMenu();
        G.isMenuMusicActive = true;
        let btn = document.getElementById('menu-music-btn');
        if (btn) btn.innerText = '🔊 Silenciar Música';
    }
    G.gameState = 'MENU';
    checkSave();
}


// ═══════════════════════════════════════════════════════════════════
//  MOTOR DE MÚSICA PROCEDURAL — Web Audio API
//  Sin URLs externas. Todo generado en tiempo real.
//  Menú    → menu_music.mp3 (archivo externo)
//  Juego   → funk_menu.mp3 (archivo externo, suena durante el juego)
//  war     → Percusión grave + cuerdas tensas
//  epic    → Fanfarria con acordes mayores
//  peace   → Laúd + flauta suave
//  ambient → Drones modales + campanas
//  explore → Arpa + melodía pentatónica
// ═══════════════════════════════════════════════════════════════════

// gameTracks como metadatos (sin <audio> elements)