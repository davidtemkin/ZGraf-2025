/*
 * ZGraf Web - Main Entry Point
 *
 * Copyright (c) 1991-2025 David Temkin
 * SPDX-License-Identifier: MIT
 */

import { CONFIG } from './config.js';
import { Renderer } from './renderer.js';
import { Tunnel } from './tunnel.js';
import { Player } from './player.js';
import { Game } from './game.js';
import { audio } from './audio.js';
import { Aphid } from './objects/aphid.js';

// Game states
const GameState = {
    LOADING: 'loading',
    INTRO: 'intro',      // Zoom grid animation
    ATTRACT: 'attract',
    PLAYING: 'playing',
    GAME_OVER: 'gameover'
};

// Intro animation constants (from original Anim.c BenchmarkSystem)
// At 60fps with step=10, 450 units = 0.75 seconds (45 frames)
// Start at 500, end at 50 = 450 units
const INTRO_Z_START = 500;    // Start very close so immediately visible
const INTRO_Z_END = 50;       // End much closer to user
const INTRO_Z_STEP = 10;      // Decrement per frame

class ZGraf {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');

        // Size canvas to window
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        this.renderer = new Renderer(this.canvas);
        this.tunnel = new Tunnel();
        this.player = new Player(this.tunnel);
        this.game = new Game(this.tunnel, this.player);

        this.tunnel.setPlayer(this.player);
        this.tunnel.setGame(this.game);

        this.lastTime = 0;
        this.state = GameState.LOADING;
        this.paused = false;

        // Intro animation state
        this.introZ = INTRO_Z_START;

        // Apply stereo settings (tuned values, all pop-out mode)
        CONFIG.STEREO.halfOffset = 380;
        CONFIG.STEREO.screenPlaneZ = null;
        this.renderer.halfOffset = 380;

        this.setupInput();

        // Start loading/attract sequence
        this.startLoading();
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // Update config dimensions
        CONFIG.WIDTH = this.canvas.width;
        CONFIG.HEIGHT = this.canvas.height;

        // Reinitialize renderer if it exists
        if (this.renderer) {
            this.renderer.resize(this.canvas.width, this.canvas.height);
        }
    }

    setupInput() {
        // Mouse movement - only during gameplay
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.state !== GameState.PLAYING || this.paused) return;
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left - CONFIG.WIDTH / 2;
            const y = e.clientY - rect.top - CONFIG.HEIGHT / 2;
            this.player.setMousePosition(x, y);
        });

        // Mouse click - context dependent
        this.canvas.addEventListener('mousedown', (e) => {
            switch (this.state) {
                case GameState.LOADING:
                    // Ignore clicks while loading
                    break;
                case GameState.ATTRACT:
                    // Start game from attract mode
                    this.startGame();
                    break;
                case GameState.PLAYING:
                    if (this.paused) {
                        this.setPaused(false);
                    } else {
                        this.player.fire();
                    }
                    break;
                case GameState.GAME_OVER:
                    // Ignore clicks during game over (wait for timer)
                    break;
            }
        });

        // Keyboard input
        document.addEventListener('keydown', (e) => {
            // 'R' restarts game (works in any state except loading)
            // From original Player.c: sets startNewGame flag
            if ((e.key === 'r' || e.key === 'R') && this.state !== GameState.LOADING) {
                this.restartGame();
                return;
            }

            // Only process gameplay keys when actually playing
            if (this.state !== GameState.PLAYING) return;

            switch (e.key) {
                case 'w':
                case 'W':
                case 'ArrowUp':
                    this.player.moveForward = true;
                    break;
                case 's':
                case 'S':
                case 'ArrowDown':
                    this.player.moveBackward = true;
                    break;
                case '2':
                    // Original: '2' accelerates forward
                    this.player.moveForward = true;
                    break;
                case '1':
                    // Original: '1' accelerates backward
                    this.player.moveBackward = true;
                    break;
                case ' ':
                    if (!this.paused) {
                        this.player.fire();
                    }
                    break;
                case 'Escape':
                    this.setPaused(!this.paused);
                    break;
            }
        });

        document.addEventListener('keyup', (e) => {
            switch (e.key) {
                case 'w':
                case 'W':
                case 'ArrowUp':
                case '2':
                    this.player.moveForward = false;
                    break;
                case 's':
                case 'S':
                case 'ArrowDown':
                case '1':
                    this.player.moveBackward = false;
                    break;
            }
        });

        // Shift+A: spawn aphid swarm (100 aphids around a random point)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'A' && e.shiftKey) {
                this.spawnAphidSwarm(100);
            }
        });
    }

    /**
     * Start loading sequence - show loading screen until all images loaded
     */
    async startLoading() {
        this.state = GameState.LOADING;
        document.getElementById('instructions').style.display = 'none';

        // Ensure canvas starts black
        const ctx = this.canvas.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Initialize audio system
        await audio.init();

        // Start loading animation loop
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loadingLoop(t));
    }

    /**
     * Loading loop - display loading screen until all assets ready
     */
    loadingLoop(currentTime) {
        // Just show black screen while loading (no loading graphic)
        this.renderer.ctx.fillStyle = '#000';
        this.renderer.ctx.fillRect(0, 0, this.renderer.width, this.renderer.height);

        // Check if all images are loaded
        if (this.renderer.allImagesLoaded) {
            // Transition to intro animation
            this.startIntro();
            return;
        }

        // Continue loading loop
        requestAnimationFrame((t) => this.loadingLoop(t));
    }

    /**
     * Start intro zoom grid animation (from original Anim.c BenchmarkSystem)
     */
    startIntro() {
        this.state = GameState.INTRO;
        this.introZ = INTRO_Z_START;
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.introLoop(t));
    }

    /**
     * Intro animation loop - 10x10 grid of squares zooming toward viewer
     * with "please wait" loading image overlaid
     */
    introLoop(currentTime) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Clear and draw grid
        this.renderer.beginFrame();
        this.renderer.drawIntroGrid(this.introZ);
        this.renderer.endGameViewClip();  // Must restore clip state before endFrame
        this.renderer.endFrame();

        // Draw loading image on top (after endFrame so it's not overwritten)
        this.renderer.drawLoadingImage();

        // Advance animation (scale step by frame time for consistency)
        const dtScale = deltaTime / 16.67;
        this.introZ -= INTRO_Z_STEP * dtScale;

        // Check if animation complete
        if (this.introZ <= INTRO_Z_END) {
            this.startAttractMode();
            return;
        }

        requestAnimationFrame((t) => this.introLoop(t));
    }

    /**
     * Start attract mode - demo with flashing "press to play"
     */
    startAttractMode() {
        this.state = GameState.ATTRACT;
        this.game.startLevel(0);  // Level 0 = attract/demo mode
        this.canvas.style.cursor = 'default';
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.gameLoop(t));
    }

    /**
     * Start actual gameplay
     */
    startGame() {
        this.state = GameState.PLAYING;
        this.paused = false;
        this.game.startLevel(1);
        this.canvas.style.cursor = 'none';  // Hide cursor during gameplay
    }

    /**
     * Restart game (from original Player.c 'R' key handler)
     * Resets score, energy, velocity and starts level 1
     */
    restartGame() {
        // From original Game.c lines 220-225:
        // var(score) = 0;
        // var(energy) = kMaxEnergy;
        // objVar(thePlayer, zVel) = 0;
        // (method(StartLevel), 1);
        this.player.reset();
        this.state = GameState.PLAYING;
        this.paused = false;
        this.game.startLevel(1);
        this.canvas.style.cursor = 'none';
    }

    /**
     * Debug: spawn a swarm of aphids around a random point
     */
    spawnAphidSwarm(count) {
        const { left, right, top, bottom, length } = CONFIG.TUNNEL;

        // Random center point for the swarm
        const centerX = left + Math.random() * (right - left);
        const centerY = top + Math.random() * (bottom - top);
        const centerZ = Math.random() * length;

        // Spread range for individual aphids (moderate distances)
        const spreadX = 4000;
        const spreadY = 4000;
        const spreadZ = 3000;

        for (let i = 0; i < count; i++) {
            const x = centerX + (Math.random() - 0.5) * 2 * spreadX;
            const y = centerY + (Math.random() - 0.5) * 2 * spreadY;
            const z = centerZ + (Math.random() - 0.5) * 2 * spreadZ;

            // Clamp to tunnel bounds
            const clampedX = Math.max(left, Math.min(right, x));
            const clampedY = Math.max(top, Math.min(bottom, y));
            const clampedZ = ((z % length) + length) % length;

            const aphid = new Aphid(clampedX, clampedY, clampedZ);
            this.tunnel.addObject(aphid);
        }

        console.log(`Spawned ${count} aphids around (${Math.round(centerX)}, ${Math.round(centerY)}, ${Math.round(centerZ)})`);
    }

    setPaused(paused) {
        this.paused = paused;
        // Show cursor when paused, hide when playing
        this.canvas.style.cursor = paused ? 'default' : 'none';
    }

    gameLoop(currentTime) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Update game state based on Game class state
        if (this.game.isGameOver && this.state !== GameState.GAME_OVER) {
            this.state = GameState.GAME_OVER;
            this.canvas.style.cursor = 'default';
        }
        if (this.game.isAttractMode() && this.state === GameState.GAME_OVER) {
            // Game over timer expired, now in attract mode
            this.state = GameState.ATTRACT;
        }

        // Update logic depends on state
        switch (this.state) {
            case GameState.ATTRACT:
                // In attract mode: player moves forward at constant speed
                // (from original Player.c GetDemoInput)
                this.player.updateAttractMode(deltaTime);
                this.tunnel.processObjects(deltaTime);
                this.game.update(deltaTime);
                break;

            case GameState.PLAYING:
                if (!this.paused) {
                    this.player.update(deltaTime);
                    this.tunnel.processObjects(deltaTime);
                    this.tunnel.checkCollisions();
                    this.game.update(deltaTime);
                }
                break;

            case GameState.GAME_OVER:
                // Objects keep moving during game over
                this.tunnel.processObjects(deltaTime);
                this.game.update(deltaTime);
                break;
        }

        // Render (always)
        this.renderer.beginFrame();

        // If player was hit, draw full-screen flash instead of objects (from original Anim.c)
        if (this.player.wasHit) {
            this.renderer.drawHitFlash();
            this.player.wasHit = false;
        } else {
            this.tunnel.drawObjects(this.renderer);

            // Draw crosshairs in center (amber, static) - only during gameplay
            if (this.state === GameState.PLAYING) {
                this.renderer.drawCrosshairs();
            }
        }

        // End game view clipping before drawing UI elements
        this.renderer.endGameViewClip();

        // Draw status panel (radar, score, level, energy) - after clipping removed
        this.tunnel.drawStatusPanel(this.renderer);

        this.game.drawStatus(this.renderer);

        if (this.paused && this.state === GameState.PLAYING) {
            this.renderer.drawPauseOverlay();
        }

        this.renderer.endFrame();

        requestAnimationFrame((t) => this.gameLoop(t));
    }
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.zgraf = new ZGraf();
});
