import { G } from '../core/state.ts';
import { openModal, closeModal } from './modal-utils.ts';
import { AudioSystem } from '../audio/sfx.ts';
import { MusicEngine, stopAllMusic } from '../audio/music.ts';
import { initWorld } from '../systems/worldgen.ts';
import { checkSave } from '../core/storage.ts';
import { mainLoop } from '../core/loop.ts';
export function volverECGAME() {
    if (confirm('¿Seguro que quieres volver a ECGAME? Se cerrará DemiurgoBox.')) {
        window.location.href = 'https://nicotips27.github.io/ec-download/';
    }
}

export function closeAbout() { closeModal('about-modal'); if (G.aboutFromPause) { (document.getElementById('ingame-menu') as HTMLElement).style.display = 'block'; G.aboutFromPause = false; } }
export function openAboutFromPause() { (document.getElementById('ingame-menu') as HTMLElement).style.display = 'none'; G.aboutFromPause = true; openModal('about-modal'); }

export function openInstructions() { let inGameMenu = document.getElementById('ingame-menu'); if (inGameMenu.style.display === 'block') { inGameMenu.style.display = 'none'; G.instructionsFromPause = true; } else { G.instructionsFromPause = false; } openModal('how-to-play'); }
export function closeInstructions() { closeModal('how-to-play'); if (G.instructionsFromPause) { (document.getElementById('ingame-menu') as HTMLElement).style.display = 'block'; G.instructionsFromPause = false; } }
export function openSettings() { let inGameMenu = document.getElementById('ingame-menu'); if (inGameMenu.style.display === 'block') { inGameMenu.style.display = 'none'; G.settingsFromPause = true; } else { G.settingsFromPause = false; } openModal('settings-modal'); }
export function closeSettings() { closeModal('settings-modal'); if (G.settingsFromPause) { (document.getElementById('ingame-menu') as HTMLElement).style.display = 'block'; G.settingsFromPause = false; } }

export function toggleFullScreen() {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(err => { console.log(`Error FS: ${err.message}`); }); } 
    else { if (document.exitFullscreen) document.exitFullscreen(); }
}
document.addEventListener('fullscreenchange', () => { const isFS = !!document.fullscreenElement; let btnFloating = document.getElementById('fs-btn-floating'); if (btnFloating) { btnFloating.innerText = isFS ? "🗗" : "🖵"; btnFloating.title = isFS ? "Salir Pantalla Completa" : "Pantalla Completa"; } });

// ── Consentimiento de música ──────────────────────────────────────
export function consentMusic(action) {
    let overlay = document.getElementById('music-consent-overlay');
    overlay.style.animation = 'slideOutConsent 0.35s ease forwards';
    setTimeout(() => { overlay.style.display = 'none'; }, 350);
    if (action === 'yes') {
        G.musicEnabled = true;
        G.isMenuMusicActive = true;
        let btn = document.getElementById('menu-music-btn');
        if (btn) btn.innerText = "🔊 Silenciar Música";
        AudioSystem.init();
        MusicEngine.ac = AudioSystem.ctx;
        MusicEngine.init();
        MusicEngine.startMenu();
    } else if (action === 'no') {
        stopAllMusic();
        G.isMenuMusicActive = false;
        let btn = document.getElementById('menu-music-btn');
        if (btn) btn.innerText = "🔇 Música";
    }
}

// Inicialización en arranque
window.onload = () => {
    initWorld('random'); 
    G.hasActiveGame = false;
    checkSave();
    mainLoop();

    // ═══════════════════════════════════════════════
    //  ORIENTATION LOCK — Forzar landscape en móvil
    // ═══════════════════════════════════════════════
    const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
    const orOverlay = document.getElementById('orientation-overlay');

    function checkOrientation() {
        if (!isMobile) { orOverlay.style.display = 'none'; return; }
        const isPortrait = window.innerHeight > window.innerWidth;
        orOverlay.style.display = isPortrait ? 'flex' : 'none';
    }

    // Intentar bloquear orientación a landscape
    function lockLandscape() {
        const sl = screen.orientation || screen.mozOrientation || screen.msOrientation;
        if (sl && sl.lock) {
            sl.lock('landscape').catch(() => {});
        }
    }

    if (isMobile) {
        checkOrientation();
        window.addEventListener('resize', checkOrientation);
        window.addEventListener('orientationchange', () => {
            setTimeout(checkOrientation, 100);
        });
        // Bloquear en la primera interacción
        const lockOnFirst = () => {
            lockLandscape();
            document.removeEventListener('click', lockOnFirst);
            document.removeEventListener('touchstart', lockOnFirst);
        };
        document.addEventListener('click', lockOnFirst);
        document.addEventListener('touchstart', lockOnFirst);
    }

    function startMenuMusic() {
        AudioSystem.init();
        MusicEngine.ac = AudioSystem.ctx;
        MusicEngine.init();
        if (G.musicEnabled) {
            MusicEngine.startMenu();
            G.isMenuMusicActive = true;
            let btn = document.getElementById('menu-music-btn');
            if (btn) btn.innerText = "🔊 Silenciar Música";
        }
    }

    startMenuMusic();

    function onFirstInteraction() {
        if (AudioSystem.ctx && AudioSystem.ctx.state === 'suspended') AudioSystem.ctx.resume();
        // Solo activar música de menú si no está jugando y la música no está activa
        if (G.musicEnabled && !G.isMenuMusicActive && G.gameState !== 'PLAYING') startMenuMusic();
        document.removeEventListener('click', onFirstInteraction);
        document.removeEventListener('keydown', onFirstInteraction);
        document.removeEventListener('touchstart', onFirstInteraction);
    }
    document.addEventListener('click', onFirstInteraction);
    document.addEventListener('keydown', onFirstInteraction);
    document.addEventListener('touchstart', onFirstInteraction);
};