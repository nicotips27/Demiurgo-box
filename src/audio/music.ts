import { G } from '../core/state.ts';
import { TerrainType as TERRAIN } from '../core/types.ts';
import { AudioSystem } from './sfx.ts';
export const gameTracks = [
    { id: 'war-1',     name: 'Campos de Batalla',   mood: 'war',     label: '⚔️ Campos de Batalla'   },
    { id: 'epic-1',    name: 'Era Heroica',         mood: 'epic',    label: '🏛️ Era Heroica'         },
    { id: 'explore-1', name: 'Horizontes',          mood: 'explore', label: '🌿 Exploración'         },
    { id: 'peace-1',   name: 'Soberano',            mood: 'peace',   label: '👑 Soberanía'           },
    { id: 'war-2',     name: 'Marcha de Conquista', mood: 'war',     label: '🔥 Conquista'           },
    { id: 'ambient-1', name: 'Misterio Ancestral',  mood: 'ambient', label: '🌌 Misterio'            },
    { id: 'peace-2',   name: 'Ciudades Flotantes',  mood: 'peace',   label: '🏙️ Civilización'        },
    { id: 'ambient-2', name: 'Canto Primordial',    mood: 'ambient', label: '🌀 Primordial'          },
    { id: 'war-3',     name: 'Choque Defiant',      mood: 'war',     label: '💥 Batalla'             },
    { id: 'explore-2', name: 'El Gran Camino',      mood: 'explore', label: '🛤️ El Camino'           },
    { id: 'epic-2',    name: 'Épica del Alba',      mood: 'epic',    label: '🌅 Épica del Alba'      },
    { id: 'ambient-3', name: 'Tierra Sagrada',      mood: 'ambient', label: '🌿 Tierra Sagrada'      },
    { id: 'war-4',     name: 'Legiones',            mood: 'war',     label: '🛡️ Legiones'            },
    { id: 'peace-3',   name: 'Paz del Imperio',     mood: 'peace',   label: '☮️ Paz del Imperio'     },
    { id: 'explore-3', name: 'Valles Eternos',      mood: 'explore', label: '🏔️ Valles Eternos'      },
    { id: 'war-5',     name: 'Tormenta de Hierro',  mood: 'war',     label: '⛈️ Tormenta de Hierro'  },
    { id: 'ambient-4', name: 'Susurros del Mundo',  mood: 'ambient', label: '🍃 Susurros del Mundo'  },
    { id: 'epic-3',    name: 'Gloria Eterna',       mood: 'epic',    label: '✨ Gloria Eterna'        },
    { id: 'peace-4',   name: 'Senderos de Luz',     mood: 'peace',   label: '🌟 Senderos de Luz'     },
    { id: 'explore-4', name: 'El Último Reino',     mood: 'explore', label: '🗺️ El Último Reino'     },
];

// ── Motor de música procedural ──────────────────────────────────
export const MusicEngine = {
    ac: null,          // AudioContext (compartido con AudioSystem)
    masterGain: null,
    reverbNode: null,
    activeNodes: [],   // nodos activos para poder detenerlos
    menuInterval: null,
    gameInterval: null,
    currentMood: null,
    chordStep: 0,

    // Inicializar (reutiliza el contexto de AudioSystem si ya existe)
    init() {
        if (this.ac) return;
        this.ac = AudioSystem.ctx || (() => {
            const AC = window.AudioContext || window.webkitAudioContext;
            return new AC();
        })();
        // Master gain para música
        this.masterGain = this.ac.createGain();
        this.masterGain.gain.value = G.globalMusicVolume * 0.7;
        // Reverb de catedral largo
        const revLen = this.ac.sampleRate * 3.5;
        const revBuf = this.ac.createBuffer(2, revLen, this.ac.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const d = revBuf.getChannelData(ch);
            for (let i = 0; i < revLen; i++) {
                const decay = Math.pow(1 - i / revLen, 1.8);
                d[i] = (Math.random() * 2 - 1) * decay * (ch === 0 ? 1 : 0.9);
            }
        }
        this.reverbNode = this.ac.createConvolver();
        this.reverbNode.buffer = revBuf;
        const reverbGain = this.ac.createGain();
        reverbGain.gain.value = 0.55;
        const dryGain = this.ac.createGain();
        dryGain.gain.value = 0.65;
        this.masterGain.connect(dryGain); dryGain.connect(this.ac.destination);
        this.masterGain.connect(this.reverbNode); this.reverbNode.connect(reverbGain); reverbGain.connect(this.ac.destination);
    },

    setVolume(v) {
        if (this.masterGain) this.masterGain.gain.setTargetAtTime(v * 0.7, this.ac.currentTime, 0.1);
        if (this._menuAudio) this._menuAudio.volume = v;
        if (this._gameAudio) this._gameAudio.volume = v;
    },

    // Crea un oscilador con envelope y lo conecta al master
    _playNote(freq, type, startTime, duration, peak, harmonics) {
        const g = this.ac.createGain();
        g.connect(this.masterGain);
        g.gain.setValueAtTime(0, startTime);
        g.gain.linearRampToValueAtTime(peak, startTime + 0.06);
        g.gain.setTargetAtTime(peak * 0.7, startTime + 0.06, 0.3);
        g.gain.setTargetAtTime(0, startTime + duration * 0.7, duration * 0.18);
        // Oscilador fundamental
        const osc = this.ac.createOscillator();
        osc.type = type; osc.frequency.value = freq;
        osc.connect(g); osc.start(startTime); osc.stop(startTime + duration + 0.5);
        this.activeNodes.push(osc, g);
        // Armónicos de órgano (tubos)
        if (harmonics) {
            [2, 3, 4, 6].forEach((h, i) => {
                const hg = this.ac.createGain();
                hg.gain.value = peak * [0.4, 0.2, 0.15, 0.05][i];
                hg.connect(this.masterGain);
                const ho = this.ac.createOscillator();
                ho.type = 'sine'; ho.frequency.value = freq * h;
                ho.connect(hg); ho.start(startTime); ho.stop(startTime + duration + 0.5);
                this.activeNodes.push(ho, hg);
            });
        }
    },

    // Funk chords — dominantes con 7ª y 9ª (estilo Parliament/Funkadelic)
    FUNK_CHORDS: [
        [110.00, 138.59, 164.81, 220.00],  // A7   (A2 C#3 E3 A3)
        [73.42,  92.50,  110.00, 146.83],  // D9   (D2 F#2 A2 D3)
        [82.41,  103.83, 123.47, 164.81],  // E7   (E2 G#2 B2 E3)
        [98.00,  123.47, 146.83, 196.00],  // G7   (G2 B2 D3 G3)
        [110.00, 138.59, 174.61, 220.00],  // Am7  (A2 C#3 F3 A3)
        [73.42,  110.00, 130.81, 174.61],  // Dm7  (D2 A2 C3 F3)
    ],
    // Bajo funky sincopado — patrón clásico de slap bass
    FUNK_BASS: [
        { freq: 55.00, dur: 0.15, rest: 0.10 },   // A1
        { freq: 73.42, dur: 0.10, rest: 0.05 },   // D2
        { freq: 55.00, dur: 0.10, rest: 0.15 },   // A1
        { freq: 55.00, dur: 0.08, rest: 0.02 },   // A1 (ghost)
        { freq: 82.41, dur: 0.12, rest: 0.10 },   // E2
        { freq: 55.00, dur: 0.10, rest: 0.20 },   // A1
    ],
    // Progresión funk: I7 IV7 V7 (clásica)
    MENU_PROGRESSION: [0, 1, 2, 3, 0, 4, 5, 1],

    // Elementos de audio MP3
    _menuAudio: null,
    _gameAudio: null,

    startMenu() {
        this.stop();
        this.init();
        if (!G.musicEnabled) return;
        // Detener música de juego si está sonando
        if (this._gameAudio) { this._gameAudio.pause(); this._gameAudio.currentTime = 0; }
        // Reproducir música del menú
        if (!this._menuAudio) {
            this._menuAudio = new Audio('menu_music.mp3');
            this._menuAudio.loop = true;
            this._menuAudio.volume = G.globalMusicVolume;
        }
        this._menuAudio.currentTime = 0;
        this._menuAudio.play().catch(() => {});
    },

    // ── Música de juego por mood ────────────────────────────────
    GAME_SCALES: {
        war:     [65.41, 73.42, 77.78, 87.31, 98.00, 103.83, 116.54], // frigio → oscuro
        epic:    [65.41, 73.42, 82.41, 87.31, 98.00, 110.00, 123.47], // mayor → triunfal
        peace:   [65.41, 73.42, 82.41, 87.31, 98.00, 110.00, 123.47], // mayor suave
        ambient: [65.41, 77.78, 87.31, 98.00, 116.54, 130.81],        // pentatónico
        explore: [65.41, 73.42, 87.31, 98.00, 110.00, 130.81],        // hexatónica
    },
    GAME_MOODS: {
        war:     { bpm: 96,  type: 'sawtooth', peak: 0.10, harm: false },
        epic:    { bpm: 80,  type: 'square',   peak: 0.08, harm: true  },
        peace:   { bpm: 56,  type: 'sine',     peak: 0.09, harm: true  },
        ambient: { bpm: 44,  type: 'sine',     peak: 0.07, harm: true  },
        explore: { bpm: 68,  type: 'triangle', peak: 0.10, harm: false },
    },

    startGame(mood?) {
        this.stop();
        this.init();
        if (!G.musicEnabled) return;
        // Detener música del menú
        if (this._menuAudio) { this._menuAudio.pause(); this._menuAudio.currentTime = 0; }
        // Reproducir música de juego (funk)
        if (!this._gameAudio) {
            this._gameAudio = new Audio('funk_menu.mp3');
            this._gameAudio.loop = true;
            this._gameAudio.volume = G.globalMusicVolume;
        }
        this._gameAudio.currentTime = 0;
        this._gameAudio.play().catch(() => {});
        this.currentMood = mood || 'ambient';
    },

    changeMood(newMood) {
        this.currentMood = newMood;
    },

    stop() {
        if (this.menuInterval) { clearInterval(this.menuInterval); this.menuInterval = null; }
        if (this.gameInterval) { clearInterval(this.gameInterval); this.gameInterval = null; }
        // Detener ambos audios
        if (this._menuAudio) { this._menuAudio.pause(); this._menuAudio.currentTime = 0; }
        if (this._gameAudio) { this._gameAudio.pause(); this._gameAudio.currentTime = 0; }
        // Apagar nodos activos suavemente
        if (this.ac && this.activeNodes.length) {
            const now = this.ac.currentTime;
            this.activeNodes.forEach(n => {
                try {
                    if (n instanceof GainNode) n.gain.setTargetAtTime(0, now, 0.15);
                    else if (n instanceof OscillatorNode) { try { n.stop(now + 0.5); } catch(e){} }
                } catch(e) {}
            });
            this.activeNodes = [];
        }
        G.isFadingOut = false;
    },

    mute(val) {
        if (this.masterGain) this.masterGain.gain.setTargetAtTime(val ? 0 : G.globalMusicVolume * 0.7, this.ac.currentTime, 0.1);
        if (this._menuAudio) this._menuAudio.muted = val;
        if (this._gameAudio) this._gameAudio.muted = val;
    }
};

// ── Stubs para compatibilidad con código existente ────────────────
export function unlockAllTracks() { return Promise.resolve(); }

export function stopAllMusic() {
    MusicEngine.stop();
    G.isMenuMusicActive = false;
}

export function _fadeOut(el, duration, onDone) { onDone && setTimeout(onDone, 200); }
export function _fadeIn(el, targetVol, duration) {}

export function showNowPlaying(track) {
    let hud = document.getElementById('now-playing-hud');
    if (!hud) return;
    hud.innerHTML = `🎵 <span style="color:var(--gold);font-weight:700;">${track.name}</span> <span style="color:#5a5040;font-size:10px;">${track.label}</span>`;
    hud.style.opacity = '1'; hud.style.transform = 'translateY(0)';
    clearTimeout(hud._hideTimer);
    hud._hideTimer = setTimeout(() => { hud.style.opacity = '0'; hud.style.transform = 'translateY(-8px)'; }, 4000);
}

export function getWorldMood() {
    if (!G.villages || G.villages.length === 0) return 'ambient';
    let warCount  = G.villages.filter(v => v.state === 'WAR').length;
    let totalPop  = G.humans.length;
    let heroCount = (typeof G.heroes !== 'undefined') ? G.heroes.length : 0;
    let fireCount = 0;
    for (let x = 0; x < G.cols; x += 4) for (let y = 0; y < G.rows; y += 4)
        if (G.grid[x] && G.grid[x][y] && G.grid[x][y].type === TERRAIN.FIRE) fireCount++;
    if (warCount >= 2 || fireCount > 10) return 'war';
    if (heroCount > 0 && totalPop > 30) return 'epic';
    if (totalPop < 10) return 'ambient';
    if (totalPop > 40 && warCount === 0) return 'peace';
    return 'explore';
}

export function checkContextualMusic() {
    if (!G.musicEnabled || G.gameState !== 'PLAYING') return;
    if (G.timeTick - G.lastMoodCheck < 600) return;
    G.lastMoodCheck = G.timeTick;
    const mood = getWorldMood();
    if (mood !== MusicEngine.currentMood) MusicEngine.changeMood(mood);
}

export function playSpecificTrack(index, skipFade) {
    const track = gameTracks[index] || gameTracks[0];
    G.currentGameTrackIndex = index;
    MusicEngine.startGame(track.mood);
    showNowPlaying(track);
}

export function playNextTrack(skipFade) {
    if (!G.musicEnabled) return;
    const mood = (G.gameState === 'PLAYING') ? getWorldMood() : 'ambient';
    const pool = gameTracks.filter((t, i) => t.mood === mood && i !== G.currentGameTrackIndex);
    const chosen = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : gameTracks[0];
    G.currentGameTrackIndex = gameTracks.indexOf(chosen);
    playSpecificTrack(G.currentGameTrackIndex, skipFade);
}

export function playGameMusic() {
    MusicEngine.stop();
    G.currentGameTrackIndex = -1;
    G.isMenuMusicActive = false;
    unlockAllTracks().then(() => { setTimeout(() => { playNextTrack(true); }, 200); });
}

export function toggleMenuMusic() {
    const btn = document.getElementById('menu-music-btn');
    if (G.isMenuMusicActive) {
        MusicEngine.stop();
        G.isMenuMusicActive = false;
        if (btn) btn.innerText = "🔇 Activar Música";
    } else {
        if (!AudioSystem.ctx) AudioSystem.init();
        MusicEngine.ac = AudioSystem.ctx;
        MusicEngine.masterGain = null; // forzar reinit del gain
        MusicEngine.init();
        G.musicEnabled = true;
        // Si está jugando, activar música de juego en vez de menú
        if (G.gameState === 'PLAYING') {
            MusicEngine.startGame();
            G.isMenuMusicActive = false;
        } else {
            MusicEngine.startMenu();
            G.isMenuMusicActive = true;
        }
        if (btn) btn.innerText = "🔊 Silenciar Música";
    }
}

export function updateMusicVolume(val) {
    G.globalMusicVolume = val / 100;
    (document.getElementById('music-vol-val') as HTMLElement).innerText = val + '%';
    MusicEngine.setVolume(G.globalMusicVolume);
}
export function updateSFXVolume(val) { G.globalSFXVolume = val / 100; (document.getElementById('sfx-vol-val') as HTMLElement).innerText = val + '%'; }
