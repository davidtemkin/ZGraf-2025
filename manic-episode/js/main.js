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

// DEBUG: Set to true to enable color calibration mode
const DEBUG_COLOR_CALIBRATION = false;

// DEBUG: Set to true to enable depth mode switching UI
const DEBUG_DEPTH_MODE = false;

// Depth mode configurations
// Mode 1: Original - all objects pop out (no screen plane)
// Mode 2: Extended - close objects in front, far objects behind
// Mode 3: Exaggerated depth effect
// Mode 4: Very exaggerated depth effect
const DEPTH_MODES = [
    { name: '1: Original (all pop-out)', screenPlaneZ: null, halfOffset: 70 },
    { name: '2: Extended depth', screenPlaneZ: 5000, halfOffset: 70 },
    { name: '3: Exaggerated', screenPlaneZ: 4000, halfOffset: 100 },
    { name: '4: Very exaggerated', screenPlaneZ: 3000, halfOffset: 140 },
    { name: '5: Extreme', screenPlaneZ: 2500, halfOffset: 180 },
    { name: '6: Ultra', screenPlaneZ: 2000, halfOffset: 220 },
    { name: '7: Maximum', screenPlaneZ: 1500, halfOffset: 280 }
];

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

        // Depth mode - start with mode 4 (very exaggerated)
        this.depthMode = 3;  // 0-indexed, so 3 = mode 4
        this.applyDepthMode();

        // Debug color calibration state
        if (DEBUG_COLOR_CALIBRATION) {
            this.calibrationColor = { r: 255, g: 0, b: 0 };  // Start with pure red
            this.calibrationKeys = {};  // Track held keys
            this.calibrationRefIsCyan = false;  // Reference starts as red
        }

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

        // Keyboard - only during gameplay
        document.addEventListener('keydown', (e) => {
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

            // Debug color calibration key release
            if (DEBUG_COLOR_CALIBRATION) {
                // Use e.code for physical key (KeyR, KeyG, KeyB, etc.)
                this.calibrationKeys[e.code] = false;
                this.calibrationKeys['Shift'] = e.shiftKey;
            }
        });

        // Debug color calibration - track key holds
        if (DEBUG_COLOR_CALIBRATION) {
            document.addEventListener('keydown', (e) => {
                // Use e.code for physical key (KeyR, KeyG, KeyB, etc.)
                this.calibrationKeys[e.code] = true;
                this.calibrationKeys['Shift'] = e.shiftKey;

                // Toggle reference color with /
                if (e.key === '/') {
                    this.calibrationRefIsCyan = !this.calibrationRefIsCyan;
                }
            });
        }

        // Depth mode switching (global - works in any state)
        if (DEBUG_DEPTH_MODE) {
            document.addEventListener('keydown', (e) => {
                if (e.key === '[') {
                    // Previous depth mode
                    this.depthMode = Math.max(0, this.depthMode - 1);
                    this.applyDepthMode();
                } else if (e.key === ']') {
                    // Next depth mode
                    this.depthMode = Math.min(DEPTH_MODES.length - 1, this.depthMode + 1);
                    this.applyDepthMode();
                }
            });
        }
    }

    /**
     * Update calibration color based on held keys
     */
    updateCalibrationColor() {
        if (!DEBUG_COLOR_CALIBRATION) return;

        const step = 5;  // Color change per frame when key held
        const c = this.calibrationColor;
        const shift = this.calibrationKeys['Shift'];

        // Brightness: -/_ decreases, =/+ increases (scales all)
        if (this.calibrationKeys['Minus']) {
            c.r = Math.max(0, c.r - step);
            c.g = Math.max(0, c.g - step);
            c.b = Math.max(0, c.b - step);
        }
        if (this.calibrationKeys['Equal']) {
            c.r = Math.min(255, c.r + step);
            c.g = Math.min(255, c.g + step);
            c.b = Math.min(255, c.b + step);
        }

        // Individual channels: without shift = decrease, with shift = increase
        if (this.calibrationKeys['KeyR']) {
            if (shift) c.r = Math.min(255, c.r + step);
            else c.r = Math.max(0, c.r - step);
        }
        if (this.calibrationKeys['KeyG']) {
            if (shift) c.g = Math.min(255, c.g + step);
            else c.g = Math.max(0, c.g - step);
        }
        if (this.calibrationKeys['KeyB']) {
            if (shift) c.b = Math.min(255, c.b + step);
            else c.b = Math.max(0, c.b - step);
        }
    }

    /**
     * Apply current depth mode settings to CONFIG.STEREO
     */
    applyDepthMode() {
        const mode = DEPTH_MODES[this.depthMode];
        CONFIG.STEREO.screenPlaneZ = mode.screenPlaneZ;
        CONFIG.STEREO.halfOffset = mode.halfOffset;
        // Also update renderer's cached value
        if (this.renderer) {
            this.renderer.halfOffset = mode.halfOffset;
        }
        console.log(`Depth mode: ${mode.name}`);
    }

    /**
     * Get current depth mode name for display
     */
    getDepthModeName() {
        return DEPTH_MODES[this.depthMode].name;
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
        this.tunnel.drawObjects(this.renderer);

        // Draw crosshairs in center (amber, static) - only during gameplay
        if (this.state === GameState.PLAYING) {
            this.renderer.drawCrosshairs();
        }

        // End game view clipping before drawing UI elements
        this.renderer.endGameViewClip();

        // Draw status panel (radar, score, level, energy) - after clipping removed
        this.tunnel.drawStatusPanel(this.renderer);

        this.game.drawStatus(this.renderer);

        if (this.paused && this.state === GameState.PLAYING) {
            this.renderer.drawPauseOverlay();
        }

        // Debug color calibration overlay
        if (DEBUG_COLOR_CALIBRATION) {
            this.updateCalibrationColor();
            this.renderer.drawCalibrationOverlay(this.calibrationColor, this.calibrationRefIsCyan);
        }

        // Depth mode indicator (debug only)
        if (DEBUG_DEPTH_MODE) {
            this.renderer.drawDepthModeIndicator(this.getDepthModeName());
        }

        this.renderer.endFrame();

        requestAnimationFrame((t) => this.gameLoop(t));
    }
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.zgraf = new ZGraf();
});
