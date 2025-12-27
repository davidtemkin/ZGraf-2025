/*
 * ZGraf Web - Saucer Enemy
 *
 * Copyright (c) 1991-2025 David Temkin
 * SPDX-License-Identifier: MIT
 */

import { CONFIG } from '../config.js';
import { Vis } from './vis.js';
import { SShot } from './sshot.js';
import { audio } from '../audio.js';

// Saucer shape from zOBJ 132: horizontal bar with gradient shading
// Original sizeFactor: 50
// Format: [left, top, right, bottom, shade]
const SAUCER_SHAPE = [
    // Gradient segments from edges to center
    [16, -4, 20, 4, 1.0],
    [12, -4, 16, 4, 0.1],
    [8, -4, 12, 4, 0.2],
    [4, -4, 8, 4, 0.3],
    [0, -4, 4, 4, 0.4],
    [-4, -4, 0, 4, 0.4],
    [-8, -4, -4, 4, 0.3],
    [-12, -4, -8, 4, 0.2],
    [-16, -4, -12, 4, 0.1],
    [-20, -4, -16, 4, 1.0],
    // Dark center bar overlay
    [-20, -2, 20, 2, 0.9],
];

export class Saucer extends Vis {
    constructor(x, y, z) {
        super(x, y, z);

        const cfg = CONFIG.ENEMIES.saucer;
        // sizeFactor=50 from resource, ×2 for our tunnel scale
        this.shapeScale = 100;
        this.extentX = 20 * this.shapeScale;
        this.extentY = 4 * this.shapeScale;
        this.thick = 30;
        this.shade = CONFIG.SHADES.saucer;

        // Velocities set by Game.addSaucer() - default to 0
        this.vx = 0;
        this.vy = 0;
        this.vz = 0;

        // Shooting state (from original Saucer.c)
        this.fShotTimer = 0;
        this.fShotCount = 0;
        this.fShootDistance = cfg.shootDistance;  // 8000
        this.fShotWait = cfg.shotWait;            // 100 frames
    }

    update(dt) {
        super.update(dt);

        // Don't move while exploding or forming
        if (this.isExploding || this.isForming) return;

        const dtScale = dt / 16.67;

        // Apply velocities
        this.x += this.vx * dtScale;
        this.y += this.vy * dtScale;
        this.z += this.vz * dtScale;

        // Bounce off walls
        this.checkBounds();

        // Saucer AI from original Saucer.c Process method
        if (this.tunnel && this.tunnel.player) {
            const player = this.tunnel.player;
            const zFromPlayer = this.getZFromPlayer(player.z);

            // Shooting logic (from original)
            if (this.fShotTimer > 0) {
                this.fShotTimer -= dtScale;
            }

            if (this.fShotTimer <= 0) {
                // Only shoot when within range and with random chance
                if (Math.abs(zFromPlayer) < this.fShootDistance && Math.random() > 0.95) {
                    const xDist = player.x - this.x;
                    const yDist = player.y - this.y;

                    // Only shoot if player is reasonably close in X/Y
                    if (Math.abs(xDist) < 5000 && Math.abs(yDist) < 5000) {
                        this.shootAtPlayer(xDist, yDist, zFromPlayer);
                        this.fShotTimer = 10;  // Quick shots in burst
                        this.fShotCount++;

                        // After 5 shots, long pause
                        if (this.fShotCount >= 5) {
                            this.fShotTimer = this.fShotWait;
                            this.fShotCount = 0;
                        }
                    }
                }
            }

            // Slow drift toward player (from original: ±1 per frame, 50% chance)
            if (Math.random() > 0.5) {
                if (player.x < this.x) this.vx -= 1 * dtScale;
                if (player.x > this.x) this.vx += 1 * dtScale;
                if (player.y < this.y) this.vy -= 1 * dtScale;
                if (player.y > this.y) this.vy += 1 * dtScale;
            }
        }

        // Wrap Z position
        this.wrapZ();
    }

    shootAtPlayer(xDist, yDist, zFromPlayer) {
        if (!this.tunnel) return;

        const sf = CONFIG.SPEED_FACTOR;

        // Direction toward player (simplified from original)
        let xDir = 0, yDir = 0;

        if (yDist < -4000) yDir = -2;
        else if (yDist < -2000) yDir = -1;
        else if (yDist > 4000) yDir = 2;
        else if (yDist > 2000) yDir = 1;

        if (xDist < -4000) xDir = -2;
        else if (xDist < -2000) xDir = -1;
        else if (xDist > 4000) xDir = 2;
        else if (xDist > 2000) xDir = 1;

        const shot = new SShot(this.x, this.y, this.z);
        shot.vx = xDir * 20 * sf;  // Scaled
        shot.vy = yDir * 20 * sf;
        shot.vz = (zFromPlayer < 0 ? -50 : 50) * sf;  // Toward player, scaled

        this.tunnel.addObject(shot);
    }

    draw(renderer) {
        this.drawShape(renderer, SAUCER_SHAPE, this.shapeScale);
    }

    getCollisionRects() {
        const s = this.shapeScale;
        return SAUCER_SHAPE.map(([left, top, right, bottom]) => ({
            left: left * s,
            top: top * s,
            right: right * s,
            bottom: bottom * s
        }));
    }

    onCollide(other) {
        const typeName = other.constructor.name;
        if (typeName === 'PShot') {
            this.explode(other.x, other.y);
            audio.play('saucerHit');
            if (this.tunnel && this.tunnel.game) {
                this.tunnel.game.hitOne();
            }
        } else if (typeName === 'Player') {
            this.explode(this.x, this.y);
            audio.play('saucerHit');
            if (this.tunnel && this.tunnel.game) {
                this.tunnel.game.hitOne();
            }
        }
    }
}
