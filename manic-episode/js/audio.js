/*
 * ZGraf Web - Audio System
 *
 * Copyright (c) 1991-2025 David Temkin
 * SPDX-License-Identifier: MIT
 */

export class Audio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.5;
        this.buffers = {};
        this.loaded = false;

        // Sound file mappings (from original SoundList.h)
        this.soundFiles = {
            playerFire: 'player_fire.wav',      // Sound 3: PlayerFiredShot
            playerHit: 'player_hit.wav',        // Sound 2: PlayerHit, PShotHitAphid
            crossHit: 'cross_hit.wav',          // Sound 1: PShotHitCross, PShotHitThing
            saucerHit: 'saucer_hit.wav',        // Sound 0: PShotHitSaucer
            powerup: 'powerup.wav',             // Sound 4: PlayerHitThing
            gameOver: 'game_over.wav',          // Sound 6: GameOver
            nextLevel: 'next_level.wav',        // Sound 9: NextLevel
            collision: 'collision.wav',         // Sound 5: (misc)
        };
    }

    async init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            await this.loadSounds();
        } catch (e) {
            console.warn('Web Audio not available:', e);
            this.enabled = false;
        }
    }

    async loadSounds() {
        const loadPromises = [];

        for (const [name, file] of Object.entries(this.soundFiles)) {
            const promise = this.loadSound(name, `sounds/${file}`);
            loadPromises.push(promise);
        }

        try {
            await Promise.all(loadPromises);
            this.loaded = true;
            console.log('All sounds loaded');
        } catch (e) {
            console.warn('Some sounds failed to load:', e);
        }
    }

    async loadSound(name, url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            this.buffers[name] = audioBuffer;
        } catch (e) {
            console.warn(`Failed to load sound ${name}:`, e);
        }
    }

    play(soundName) {
        if (!this.enabled || !this.ctx) return;

        // Resume context if suspended (browser autoplay policy)
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const buffer = this.buffers[soundName];
        if (!buffer) {
            // Fallback to synthesized sound if sample not loaded
            this.playSynth(soundName);
            return;
        }

        const source = this.ctx.createBufferSource();
        const gainNode = this.ctx.createGain();

        source.buffer = buffer;
        gainNode.gain.value = this.volume;

        source.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        source.start();
    }

    // Fallback synthesized sounds (in case samples don't load)
    playSynth(soundName) {
        const synthSounds = {
            playerFire: { freq: 800, duration: 0.05, type: 'square' },
            playerHit: { freq: 150, duration: 0.15, type: 'square' },
            crossHit: { freq: 200, duration: 0.1, type: 'sawtooth' },
            saucerHit: { freq: 250, duration: 0.12, type: 'sawtooth' },
            powerup: { freq: 600, duration: 0.2, type: 'sine', sweep: 1200 },
            gameOver: { freq: 100, duration: 0.5, type: 'sawtooth', decay: true },
            nextLevel: { freq: 500, duration: 0.3, type: 'sine', sweep: 800 },
        };

        const sound = synthSounds[soundName];
        if (!sound) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = sound.type || 'square';
        osc.frequency.value = sound.freq;

        if (sound.sweep) {
            osc.frequency.linearRampToValueAtTime(sound.sweep, this.ctx.currentTime + sound.duration);
        }

        gain.gain.value = this.volume;

        if (sound.decay) {
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + sound.duration);
        } else {
            gain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + sound.duration);
        }

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + sound.duration);
    }

    setVolume(v) {
        this.volume = Math.max(0, Math.min(1, v));
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

// Singleton instance
export const audio = new Audio();
