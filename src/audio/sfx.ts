import { G } from '../core/state.ts';
import { TILE_SIZE } from '../core/constants.ts';
import { MusicEngine } from './music.ts';
export const AudioSystem = {
    ctx: null, muted: false,
    // Multiple noise buffers with different characters
    noiseBuffers: {},
    // Master reverb convolver
    reverb: null, reverbGain: null, dryGain: null,

    init: function() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        const sr = this.ctx.sampleRate;

        // --- Build noise buffers with different textures ---
        // White noise
        let wBuf = this.ctx.createBuffer(1, sr * 2, sr);
        let wData = wBuf.getChannelData(0);
        for (let i = 0; i < wData.length; i++) wData[i] = Math.random() * 2 - 1;
        this.noiseBuffers.white = wBuf;

        // Brown noise (integrated white → warm rumble)
        let bBuf = this.ctx.createBuffer(1, sr * 2, sr);
        let bData = bBuf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < bData.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; bData[i] = last * 3.5; }
        this.noiseBuffers.brown = bBuf;

        // Crackle noise (sparse impulses → fire / wood)
        let cBuf = this.ctx.createBuffer(1, sr * 2, sr);
        let cData = cBuf.getChannelData(0);
        for (let i = 0; i < cData.length; i++) cData[i] = Math.random() < 0.003 ? (Math.random() * 2 - 1) * 8 : 0;
        this.noiseBuffers.crackle = cBuf;

        // Metallic noise (high-pitched pings for swords/metal)
        let mBuf = this.ctx.createBuffer(1, sr, sr);
        let mData = mBuf.getChannelData(0);
        for (let i = 0; i < mData.length; i++) mData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i/mData.length, 2);
        this.noiseBuffers.metallic = mBuf;

        // --- Build a short plate-reverb impulse response ---
        let revLen = sr * 1.2;
        let revBuf = this.ctx.createBuffer(2, revLen, sr);
        for (let ch = 0; ch < 2; ch++) {
            let d = revBuf.getChannelData(ch);
            for (let i = 0; i < revLen; i++) {
                let decay = Math.pow(1 - i / revLen, 2.5);
                d[i] = (Math.random() * 2 - 1) * decay;
            }
        }
        this.reverb = this.ctx.createConvolver();
        this.reverb.buffer = revBuf;

        // Wet/dry mix for reverb
        this.reverbGain = this.ctx.createGain(); this.reverbGain.gain.value = 0.18;
        this.dryGain   = this.ctx.createGain(); this.dryGain.gain.value   = 1.0;

        // Master limiter to prevent clipping
        this.limiter = this.ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -6;
        this.limiter.knee.value = 3;
        this.limiter.ratio.value = 20;
        this.limiter.attack.value = 0.001;
        this.limiter.release.value = 0.05;

        this.reverb.connect(this.reverbGain);
        this.reverbGain.connect(this.limiter);
        this.dryGain.connect(this.limiter);
        this.limiter.connect(this.ctx.destination);
    },

    toggleMute: function() {
        this.muted = !this.muted;
        let btn = document.getElementById('btn-sound');
        if(btn) btn.innerText = this.muted ? "🔇" : "🔊";
        // Silenciar/activar música procedural
        if (typeof MusicEngine !== 'undefined') MusicEngine.mute(this.muted);
    },

    // Route a gain node through both dry and reverb wet paths
    _route: function(gainNode, wetAmount = 0.15) {
        gainNode.connect(this.dryGain);
        if (wetAmount > 0) {
            let sendGain = this.ctx.createGain();
            sendGain.gain.value = wetAmount;
            gainNode.connect(sendGain);
            sendGain.connect(this.reverb);
        }
    },

    // Oscillator with frequency glide, vibrato, optional detune
    _osc: function(type, freq, freqEnd, attack, hold, decay, vol, detune = 0, wetAmount = 0.1) {
        let t = this.ctx.currentTime;
        let osc = this.ctx.createOscillator();
        let gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (freqEnd !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(0.01, freqEnd), t + attack + hold + decay * 0.3);
        osc.detune.value = detune;
        let v = vol * G.globalSFXVolume;
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(v, t + attack);
        gain.gain.setValueAtTime(v, t + attack + hold);
        gain.gain.exponentialRampToValueAtTime(0.001, t + attack + hold + decay);
        osc.connect(gain); this._route(gain, wetAmount);
        osc.start(t); osc.stop(t + attack + hold + decay + 0.05);
    },

    // Noise burst with bandpass shaping
    _noise: function(bufKey, filterFreq, q, attack, hold, decay, vol, filterType = 'lowpass', wetAmount = 0.1, freqEnd = null) {
        let t = this.ctx.currentTime;
        let src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffers[bufKey] || this.noiseBuffers.white;
        src.loop = true;
        let filt = this.ctx.createBiquadFilter();
        filt.type = filterType; filt.frequency.value = filterFreq; filt.Q.value = q;
        if (freqEnd) filt.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + attack + hold + decay * 0.5);
        let gain = this.ctx.createGain();
        let v = vol * G.globalSFXVolume;
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(v, t + attack);
        gain.gain.setValueAtTime(v, t + attack + hold);
        gain.gain.exponentialRampToValueAtTime(0.001, t + attack + hold + decay);
        src.connect(filt); filt.connect(gain); this._route(gain, wetAmount);
        src.start(t); src.stop(t + attack + hold + decay + 0.05);
    },

    play: function(type, volumeScale = 1) {
        if (this.muted || !this.ctx || G.globalSFXVolume === 0) return;
        const v = volumeScale; // shorthand

        switch(type) {

            // ── UI ──────────────────────────────────────────────
            case 'click':
                // Soft wooden click + tiny high shimmer
                this._osc('sine', 420, 280, 0.005, 0, 0.08, 0.06 * v, 0, 0);
                this._osc('sine', 1200, 900, 0.003, 0, 0.04, 0.02 * v, 0, 0);
                break;

            // ── TERRAIN PAINTING ────────────────────────────────
            case 'place':
                // Soft earth thud
                this._noise('brown', 180, 0.8, 0.008, 0.01, 0.18, 0.12 * v, 'lowpass', 0.05);
                this._osc('sine', 95, 60, 0.01, 0, 0.15, 0.06 * v, 0, 0);
                break;

            // ── DIVINE POWERS ────────────────────────────────────
            case 'smite':
                // Thunderous lightning strike: massive low BOOM + crackle + high sizzle
                this._noise('white', 8000, 1, 0.001, 0.02, 0.4, 0.35 * v, 'highpass', 0.3);        // sizzle
                this._noise('brown', 120, 1, 0.001, 0.05, 1.8, 0.4 * v, 'lowpass', 0.5, 30);      // deep thunder roll
                this._noise('crackle', 3000, 5, 0.001, 0.15, 0.6, 0.25 * v, 'bandpass', 0.2);      // electric crackle
                this._osc('sawtooth', 80, 35, 0.001, 0.05, 1.5, 0.15 * v, 0, 0.4);                 // sub boom
                // Pitch-down impact
                this._osc('square', 300, 25, 0.001, 0, 0.5, 0.1 * v, 12, 0.3);
                break;

            case 'bless':
                // Celestial choir: shimmering harmonics, angelic harp-like arpeggios
                // Root → major third → fifth → octave, each offset
                [0, 0.12, 0.25, 0.40].forEach((delay, i) => {
                    const notes = [523.25, 659.25, 783.99, 1046.5];
                    setTimeout(() => {
                        if (this.muted) return;
                        let t = this.ctx.currentTime;
                        let osc = this.ctx.createOscillator();
                        let gain = this.ctx.createGain();
                        osc.type = 'sine'; osc.frequency.value = notes[i];
                        let vol2 = (0.12 - i * 0.02) * v * G.globalSFXVolume;
                        gain.gain.setValueAtTime(0.001, t);
                        gain.gain.linearRampToValueAtTime(vol2, t + 0.06);
                        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.4 - i * 0.1);
                        osc.connect(gain); this._route(gain, 0.4);
                        osc.start(t); osc.stop(t + 1.5);
                        // Overtone shimmer
                        let osc2 = this.ctx.createOscillator();
                        let g2 = this.ctx.createGain();
                        osc2.type = 'sine'; osc2.frequency.value = notes[i] * 2.01;
                        g2.gain.setValueAtTime(0.001, t + 0.03);
                        g2.gain.linearRampToValueAtTime(vol2 * 0.4, t + 0.1);
                        g2.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
                        osc2.connect(g2); this._route(g2, 0.5);
                        osc2.start(t + 0.03); osc2.stop(t + 1.3);
                    }, delay * 1000);
                });
                // Golden dust shimmer noise
                this._noise('white', 5000, 8, 0.05, 0.3, 0.8, 0.05 * v, 'highpass', 0.5);
                break;

            case 'curse':
                // Dark ominous drone: dissonant tritone, low growl, ghostly formants
                this._osc('sawtooth', 73.4, 69.3, 0.3, 0.5, 1.5, 0.22 * v, 0, 0.6);      // low B
                this._osc('square',   110.0, 103.8, 0.3, 0.5, 1.5, 0.14 * v, -8, 0.6);  // dissonant A (tritone-ish)
                this._osc('sawtooth', 146.8, 138.6, 0.5, 0.3, 1.8, 0.08 * v, 15, 0.7);  // D (minor chord)
                this._noise('brown', 200, 2, 0.2, 0.8, 1.2, 0.15 * v, 'lowpass', 0.5);   // dark rumble
                // High evil whistle
                this._osc('sine', 880, 440, 0.8, 0, 1.0, 0.05 * v, 0, 0.8);
                break;

            // ── VILLAGE EVENTS ───────────────────────────────────
            case 'spawn':
                // Village founding: warm trumpet fanfare + wooden drum hit
                this._osc('triangle', 392, 392, 0.02, 0.1, 0.3, 0.14 * v, 0, 0.25);
                this._osc('triangle', 523.25, 523.25, 0.02, 0.12, 0.35, 0.12 * v, 0, 0.25);
                this._osc('triangle', 659.25, 659.25, 0.05, 0.1, 0.45, 0.10 * v, 0, 0.25);
                // Drum kick
                this._noise('brown', 80, 0.5, 0.001, 0.02, 0.25, 0.3 * v, 'lowpass', 0.1);
                this._osc('sine', 120, 50, 0.001, 0, 0.2, 0.25 * v, 0, 0.1);
                // Bell shimmer on top
                this._osc('sine', 2093, 1800, 0.01, 0, 0.6, 0.04 * v, 0, 0.5);
                break;

            case 'age_up':
                // Epic civilization advancement: orchestral brass chord + timpani
                // Brass chord (C major triad, wide voicing)
                [[261.63, 0], [329.63, 0.08], [392.00, 0.16], [523.25, 0.24]].forEach(([freq, delay]) => {
                    setTimeout(() => {
                        if (this.muted) return;
                        this._osc('sawtooth', freq * 0.5, freq * 0.5, 0.05, 0.25, 1.0, 0.06 * v, 0, 0.35);
                        this._osc('square', freq, freq, 0.05, 0.2, 0.9, 0.03 * v, -5, 0.35);
                    }, delay * 1000);
                });
                // Timpani rolls
                this._noise('brown', 60, 0.3, 0.001, 0.05, 0.5, 0.2 * v, 'lowpass', 0.3);
                this._osc('sine', 65, 45, 0.001, 0.05, 0.6, 0.15 * v, 0, 0.3);
                setTimeout(() => {
                    if (this.muted) return;
                    this._noise('brown', 55, 0.3, 0.001, 0.05, 0.8, 0.2 * v, 'lowpass', 0.3);
                    this._osc('sine', 58, 40, 0.001, 0.05, 0.9, 0.15 * v, 0, 0.3);
                }, 500);
                // Victory bell
                this._osc('sine', 2637, 2100, 0.01, 0, 1.8, 0.03 * v, 0, 0.6);
                this._osc('sine', 3136, 2500, 0.01, 0, 1.5, 0.02 * v, 0, 0.6);
                break;

            case 'alert':
                // War drum + urgent horn blast
                this._noise('brown', 90, 0.4, 0.001, 0.02, 0.18, 0.18 * v, 'lowpass', 0.2);
                this._osc('sine', 75, 55, 0.001, 0.02, 0.2, 0.12 * v, 0, 0.1);
                setTimeout(() => {
                    if (this.muted) return;
                    this._noise('brown', 90, 0.4, 0.001, 0.02, 0.18, 0.18 * v, 'lowpass', 0.2);
                    this._osc('sine', 75, 55, 0.001, 0.02, 0.2, 0.12 * v, 0, 0.1);
                    this._osc('sawtooth', 440, 380, 0.01, 0.1, 0.3, 0.05 * v, 0, 0.2);
                }, 220);
                break;

            // ── COMBAT ───────────────────────────────────────────
            case 'sword':
                // Steel clash: sharp metallic ring + scrape
                this._noise('metallic', 5500, 18, 0.001, 0.002, 0.18, 0.18 * v, 'bandpass', 0.15);
                this._noise('white', 9000, 3, 0.001, 0, 0.06, 0.12 * v, 'highpass', 0.05);
                // Ringing overtone
                this._osc('sine', 3400, 2800, 0.001, 0.002, 0.35, 0.03 * v, 7, 0.25);
                this._osc('sine', 5100, 4200, 0.001, 0, 0.22, 0.02 * v, -5, 0.2);
                break;

            // ── RESOURCE GATHERING ───────────────────────────────
            case 'mine':
                // Pickaxe on stone: sharp impact + rock resonance + debris scatter
                this._noise('white', 4000, 4, 0.001, 0, 0.04, 0.14 * v, 'bandpass', 0.1);
                this._noise('brown', 350, 1, 0.001, 0.01, 0.25, 0.12 * v, 'lowpass', 0.15, 80);
                // Stone ring
                this._osc('triangle', 1800, 900, 0.001, 0, 0.2, 0.03 * v, 0, 0.2);
                this._osc('triangle', 2400, 1200, 0.001, 0, 0.15, 0.02 * v, 8, 0.15);
                // Debris hiss
                this._noise('white', 2500, 1, 0.02, 0.05, 0.12, 0.04 * v, 'highpass', 0.05);
                break;

            case 'chop':
                // Axe through wood: dull thwack + wood split + reverberation
                this._noise('brown', 600, 1.5, 0.001, 0.005, 0.18, 0.2 * v, 'lowpass', 0.2, 100);
                this._noise('crackle', 2500, 4, 0.001, 0.03, 0.15, 0.12 * v, 'bandpass', 0.1);
                this._osc('sine', 240, 120, 0.001, 0.01, 0.18, 0.05 * v, 0, 0.15);
                // Wood resonance
                this._osc('triangle', 520, 340, 0.002, 0, 0.14, 0.03 * v, 0, 0.2);
                break;

            case 'build':
                // Hammer on wood/stone: rhythmic thud + nail tap
                this._noise('brown', 400, 1, 0.001, 0.01, 0.15, 0.14 * v, 'lowpass', 0.1, 120);
                this._osc('sine', 320, 180, 0.001, 0.01, 0.12, 0.06 * v, 0, 0.1);
                // Nail tap ping
                this._osc('triangle', 1600, 1100, 0.001, 0, 0.08, 0.02 * v, 0, 0.15);
                this._noise('white', 3000, 6, 0.001, 0, 0.03, 0.03 * v, 'bandpass', 0.05);
                break;

            // ── WATER / FISHING ──────────────────────────────────
            case 'splash':
                // Water splash: layered: impact slap + bubbles + ripple fade
                this._noise('white', 3500, 2, 0.001, 0.02, 0.22, 0.18 * v, 'highpass', 0.3);
                this._noise('brown', 500, 1, 0.001, 0.03, 0.35, 0.12 * v, 'lowpass', 0.2, 80);
                // Bubble pops
                [0.05, 0.10, 0.17, 0.26].forEach((delay) => {
                    setTimeout(() => {
                        if (this.muted) return;
                        this._osc('sine', 900 + Math.random()*400, 400, 0.001, 0, 0.07, 0.015 * v, 0, 0.3);
                    }, delay * 1000);
                });
                break;

            // ── COMBAT FIREARMS ──────────────────────────────────
            case 'gunshot':
                // Single gunshot: sharp crack + body resonance + echo decay
                this._noise('white', 8000, 1, 0.001, 0.001, 0.12, 0.4 * v, 'highpass', 0.0);    // sharp crack
                this._noise('brown', 200, 0.5, 0.001, 0.002, 0.55, 0.35 * v, 'lowpass', 0.45, 30); // deep boom
                this._osc('sawtooth', 180, 35, 0.001, 0.002, 0.4, 0.12 * v, 0, 0.3);            // sub thud
                this._noise('white', 3000, 2, 0.001, 0.005, 0.08, 0.15 * v, 'bandpass', 0.1);    // snap
                break;

            case 'machinegun':
                // Machine gun burst — rapid-fire ticks + rumble
                {
                    let burstCount = 3 + Math.floor(Math.random() * 3); // 3-5 shots
                    for (let b = 0; b < burstCount; b++) {
                        let delay = b * 90 + Math.random() * 20;
                        setTimeout(() => {
                            if (this.muted) return;
                            this._noise('white', 9000, 1, 0.001, 0.001, 0.08, 0.25 * v, 'highpass', 0.0);
                            this._noise('brown', 250, 0.6, 0.001, 0.001, 0.3, 0.2 * v, 'lowpass', 0.35, 40);
                            this._osc('sawtooth', 140, 30, 0.001, 0.001, 0.22, 0.08 * v, 0, 0.2);
                        }, delay);
                    }
                }
                break;

            case 'explosion':
                // Massive explosion: huge low BOOM + debris scatter + ring-out
                this._noise('brown', 60, 0.2, 0.001, 0.06, 2.5, 0.5 * v, 'lowpass', 0.7, 15);   // deep rumble
                this._noise('white', 5000, 0.5, 0.001, 0.04, 1.2, 0.35 * v, 'highpass', 0.5);    // high blast
                this._noise('crackle', 1500, 3, 0.001, 0.2, 1.8, 0.3 * v, 'bandpass', 0.4);     // debris crackle
                this._osc('sawtooth', 60, 18, 0.001, 0.04, 2.2, 0.2 * v, 0, 0.5);              // sub bass kick
                this._osc('square', 120, 20, 0.001, 0.02, 1.5, 0.12 * v, 0, 0.5);                // distortion layer
                // After-ring
                setTimeout(() => {
                    if (this.muted) return;
                    this._noise('white', 8000, 8, 0.05, 0.5, 1.2, 0.08 * v, 'highpass', 0.6);
                }, 180);
                break;

            // ── TRADE / ECONOMY ──────────────────────────────────
            case 'coins':
                // Coin shower: bright metallic pings, overlapping
                [0, 0.06, 0.12, 0.20, 0.30].forEach((delay, i) => {
                    setTimeout(() => {
                        if (this.muted) return;
                        let baseFreq = 3200 + i * 180 + Math.random() * 200;
                        this._osc('sine', baseFreq, baseFreq * 0.85, 0.001, 0, 0.25 - i*0.02, 0.06 * v, i * 3, 0.35);
                        this._osc('triangle', baseFreq * 1.5, baseFreq * 1.2, 0.001, 0, 0.15, 0.025 * v, 0, 0.2);
                    }, delay * 1000);
                });
                break;
        }
    },

    playAt: function(type, x, y) {
        if (this.muted || !this.ctx) return;
        let worldScreenX = G.camX + (x * TILE_SIZE) * G.zoom;
        let worldScreenY = G.camY + (y * TILE_SIZE) * G.zoom;
        if(worldScreenX < -100 || worldScreenX > window.innerWidth + 100 || worldScreenY < -100 || worldScreenY > window.innerHeight + 100) return;
        // Distance-based volume: sounds closer to screen center are louder
        let centerDx = worldScreenX - window.innerWidth / 2;
        let centerDy = worldScreenY - window.innerHeight / 2;
        let dist = Math.sqrt(centerDx*centerDx + centerDy*centerDy);
        let maxDist = Math.sqrt(Math.pow(window.innerWidth/2, 2) + Math.pow(window.innerHeight/2, 2));
        let vScale = Math.max(0.1, 1 - dist / maxDist) * Math.min(1, G.zoom);
        this.play(type, vScale);
    }
};
