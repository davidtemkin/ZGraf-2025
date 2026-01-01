/*
 * ZGraf Web - Game State Management
 *
 * Copyright (c) 1991-2025 David Temkin
 * SPDX-License-Identifier: MIT
 */

import { CONFIG } from './config.js';
import { Cross } from './objects/cross.js';
import { Saucer } from './objects/saucer.js';
import { Aphid } from './objects/aphid.js';
import { Blocker } from './objects/blocker.js';
import { Thing } from './objects/thing.js';
import { Grabber } from './objects/grabber.js';
import { audio } from './audio.js';

// Constants from original Game.c/Game.h
const kDemoLevel = 0;  // Attract mode / demo level
const GAME_OVER_DURATION = 7000;  // 7 seconds (from original: ticksInGameOver = 7 * 60)

// Helper: random integer in range [min, max]
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper: random float in range [min, max]
function randFloat(min, max) {
    return min + Math.random() * (max - min);
}

export class Game {
    constructor(tunnel, player) {
        this.tunnel = tunnel;
        this.player = player;

        this.level = kDemoLevel;
        this.isGameOver = false;
        this.gameOverTime = 0;

        // Track time spent in attract mode (for flashing text)
        this.attractModeTime = 0;

        // Track live objects for level completion
        this.numLiveObjs = 0;

        // Energy drain timing (from original: ticksPerEnergyUnit)
        this.energyDrainInterval = 100; // ticks (frames) per energy unit
        this.energyDrainAccum = 0;
    }

    /**
     * Check if we're in attract/demo mode (level 0)
     */
    isAttractMode() {
        return this.level === kDemoLevel;
    }

    startLevel(levelNum) {
        this.level = levelNum;
        this.numLiveObjs = 0;
        this.energyDrainAccum = 0;
        this.attractModeTime = 0;

        // Clear existing objects
        this.tunnel.clear();

        const { left, right, top, bottom, length } = CONFIG.TUNNEL;

        if (levelNum === kDemoLevel) {
            // === ATTRACT MODE (from original Game.c) ===
            // 100-150 aphids randomly placed
            const numAphids = randInt(100, 150);
            for (let i = 0; i < numAphids; i++) {
                this.addAphid();
            }
            // Reset player position for attract mode viewing
            this.player.reset();
            return;
        }

        if (levelNum === 1) {
            // === LEVEL 1 (from original Game.c) ===
            // Positions scaled 2x to match web tunnel size (±32000 vs original ±16384)
            // Original negative Z values wrap to: length + (Z × 2)

            // Energy drain rate for level 1
            this.energyDrainInterval = 100;

            // 12-25 aphids randomly placed
            const numAphids = randInt(12, 25);
            for (let i = 0; i < numAphids; i++) {
                this.addAphid();
            }

            // 1 Thing at (6000, 200, -8000) - behind player, wraps to 49000
            this.addThing(12000, 400, 49000);

            // 4 Crosses approaching from far away (vz = -30 toward player)
            this.addCross(0, 0, 32000, 0, 0, -30);
            this.addCross(0, 0, 30000, 0, 0, -30);
            this.addCross(0, 0, 28000, 0, 0, -30);
            this.addCross(0, 0, 26000, 0, 0, -30);

            // 1 Saucer approaching
            this.addSaucer(0, 0, 24400, 0, 0, -30);

            // 1 Saucer stationary off to the side
            this.addSaucer(-30000, 18400, 13000, 0, 0, 0);

            // Stationary crosses - positive Z (ahead of player)
            this.addCross(19000, 24200, 10000, 0, 0, 0);
            this.addCross(24642, -1600, 2400, 0, 0, 0);
            this.addCross(-4000, 2000, 3840, 0, 0, 0);
            this.addCross(3000, -8000, 5058, 0, 0, 0);
            this.addCross(-9198, -6000, 4600, 0, 0, 0);

            // Stationary crosses - originally negative Z (behind player)
            // Original -3230 → 65000 - 6460 = 58540
            this.addCross(80, 1400, 58540, 0, 0, 0);
            // Original -7700 → 65000 - 15400 = 49600
            this.addCross(2000, 11602, 49600, 0, 0, 0);
            // Original -12000 → 65000 - 24000 = 41000
            this.addCross(0, 0, 41000, 0, 0, 0);
            // Original -14000 → 65000 - 28000 = 37000
            this.addCross(-4000, 10000, 37000, 0, 0, 0);

            // Add aphid swarms: 1 swarm per level (50 aphids each)
            // (experimental - level 1 gets 1 swarm, level 2 gets 2, etc.)
            for (let i = 0; i < levelNum; i++) {
                this.addAphidSwarm(50);
            }

        } else {
            // === LEVEL 2+ (from original Game.c) ===

            // Energy drains faster on higher levels
            this.energyDrainInterval = Math.max(20, 100 - 10 * (levelNum - 1));

            // Saucer velocity scaling by level
            // X/Y: interpolate from 0.5 (level 1) to 1.0 (level 6)
            const saucerXYScale = Math.min(1.0, 0.5 + (levelNum - 1) * 0.1);
            const saucerMaxXY = Math.round(100 * saucerXYScale);
            // Z: interpolate from 0.5 (level 1) to 1.0 (level 3)
            const saucerZScale = Math.min(1.0, 0.5 + (levelNum - 1) * 0.25);

            // Number of crosses/saucers: (level + 1) * 4
            const numAdding = (levelNum + 1) * 4;

            for (let i = 1; i < numAdding; i++) {
                // 50% cross, 50% saucer
                if (Math.random() > 0.5) {
                    // Cross with random velocities ±100
                    this.addCross(
                        randFloat(left, right),
                        randFloat(top, bottom),
                        randFloat(0, length),
                        randInt(-100, 100),
                        randInt(-100, 100),
                        randInt(-100, 100)
                    );
                } else {
                    // Saucer with random velocities
                    // x/y velocity scaled by level, z velocity scaled by level (maxes at level 3)
                    const zMin = Math.round(200 * saucerZScale);
                    const zMax = Math.round(400 * saucerZScale);
                    let zVel = randInt(zMin, zMax);
                    if (Math.random() > 0.5) zVel = -zVel;

                    this.addSaucer(
                        randFloat(left, right),
                        randFloat(top, bottom),
                        randFloat(0, length),
                        randInt(-saucerMaxXY, saucerMaxXY),
                        randInt(-saucerMaxXY, saucerMaxXY),
                        zVel
                    );
                }
            }

            // Add Things for refueling: 1 per 12 enemies
            const numThings = Math.floor(numAdding / 12);
            for (let i = 1; i <= numThings; i++) {
                this.addThing(
                    randFloat(left, right),
                    randFloat(top, bottom),
                    randFloat(0, length)
                );
            }

            // Add aphids: 3 + level/3
            const numAphids = 3 + Math.floor(levelNum / 3);
            for (let i = 1; i <= numAphids; i++) {
                this.addAphid();
            }

            // Add aphid swarms: 1 swarm per level (50 aphids each)
            // (experimental - level 2 gets 2 swarms, level 3 gets 3, etc.)
            for (let i = 0; i < levelNum; i++) {
                this.addAphidSwarm(50);
            }
        }
    }

    // Add methods matching original AddCross, AddSaucer, etc.
    // Velocities are scaled by SPEED_FACTOR for gameplay tuning
    addCross(x, y, z, vx, vy, vz) {
        const sf = CONFIG.SPEED_FACTOR;
        const cross = new Cross(x, y, z);
        cross.vx = vx * sf;
        cross.vy = vy * sf;
        cross.vz = vz * sf;
        this.tunnel.addObject(cross);
        this.numLiveObjs++;
    }

    addSaucer(x, y, z, vx, vy, vz) {
        const sf = CONFIG.SPEED_FACTOR;
        const saucer = new Saucer(x, y, z);
        saucer.vx = vx * sf;
        saucer.vy = vy * sf;
        saucer.vz = vz * sf;

        // Set max x/y speed based on level
        // Interpolate from 0.5 (level 1) to 1.0 (level 6)
        const saucerXYScale = Math.min(1.0, 0.5 + (this.level - 1) * 0.1);
        saucer.maxXYSpeed = 100 * saucerXYScale * sf;

        this.tunnel.addObject(saucer);
        this.numLiveObjs++;
    }

    addGrabber(x, y, z, vx, vy, vz) {
        const sf = CONFIG.SPEED_FACTOR;
        const grabber = new Grabber(x, y, z);
        grabber.vx = vx * sf;
        grabber.vy = vy * sf;
        grabber.vz = vz * sf;
        this.tunnel.addObject(grabber);
        this.numLiveObjs++;
    }

    addAphid() {
        const { left, right, top, bottom, length } = CONFIG.TUNNEL;
        const aphid = new Aphid(
            randFloat(left, right),
            randFloat(top, bottom),
            randFloat(0, length)
        );
        this.tunnel.addObject(aphid);
        // Aphids don't count toward numLiveObjs in original
    }

    addThing(x, y, z) {
        const thing = new Thing(x, y, z);
        this.tunnel.addObject(thing);
        // Things don't count toward level completion
    }

    addBlocker(x, y, z) {
        const blocker = new Blocker(x, y, z);
        this.tunnel.addObject(blocker);
        this.numLiveObjs++;
    }

    /**
     * Spawn a swarm of aphids around a random center point
     * @param {number} count - Number of aphids in the swarm
     */
    addAphidSwarm(count) {
        const { left, right, top, bottom, length } = CONFIG.TUNNEL;

        // Random center point for the swarm
        const centerX = left + Math.random() * (right - left);
        const centerY = top + Math.random() * (bottom - top);
        const centerZ = Math.random() * length;

        // Spread range for individual aphids
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
    }

    // Called when an enemy is destroyed
    hitOne() {
        this.numLiveObjs--;
    }

    update(dt) {
        // Handle game over state
        if (this.isGameOver) {
            this.gameOverTime += dt;
            // After 7 seconds, return to attract mode
            if (this.gameOverTime >= GAME_OVER_DURATION) {
                this.isGameOver = false;
                this.startLevel(kDemoLevel);
            }
            return;
        }

        // Handle attract mode
        if (this.level === kDemoLevel) {
            this.attractModeTime += dt;
            return;  // No gameplay logic in attract mode
        }

        // Normal gameplay logic below

        // Check for game over (energy depleted)
        if (this.player.energy <= 0) {
            this.isGameOver = true;
            this.gameOverTime = 0;
            audio.play('gameOver');
            return;
        }

        // Energy drain over time (from original: ticksPerEnergyUnit)
        // Convert dt (ms) to frames (60fps = 16.67ms per frame)
        this.energyDrainAccum += dt / 16.67;
        if (this.energyDrainAccum >= this.energyDrainInterval) {
            const drain = Math.floor(this.energyDrainAccum / this.energyDrainInterval);
            this.player.energy = Math.max(0, this.player.energy - drain);
            this.energyDrainAccum %= this.energyDrainInterval;
        }

        // Check for level complete (all tracked enemies destroyed)
        if (this.numLiveObjs <= 0) {
            audio.play('nextLevel');
            this.startLevel(this.level + 1);
        }
    }

    /**
     * Get attract mode time in seconds (for flashing text)
     */
    getAttractModeSeconds() {
        return this.attractModeTime / 1000;
    }

    drawStatus(renderer) {
        // Score, level, and energy are drawn in the status panel (right side)
        // Handle overlays for different game states
        if (this.isGameOver) {
            renderer.drawGameOverOverlay();
        } else if (this.level === kDemoLevel) {
            renderer.drawPressToPlayOverlay(this.getAttractModeSeconds());
        }
    }

    restart() {
        this.player.reset();
        this.isGameOver = false;
        this.startLevel(1);
    }
}
