/*
 * ZGraf Web - Player
 *
 * Copyright (c) 1991-2025 David Temkin
 * SPDX-License-Identifier: MIT
 */

import { CONFIG } from './config.js';
import { Vis } from './objects/vis.js';
import { PShot } from './objects/pshot.js';
import { audio } from './audio.js';

export class Player extends Vis {
    constructor(tunnel) {
        super(0, 0, 0);

        this.tunnel = tunnel;

        // Player extent (from original: stdExtent = ±500)
        this.extentX = 500;
        this.extentY = 500;
        this.thick = 100;
        this.shade = CONFIG.SHADES.player;
        this.checkCollide = true;

        // Movement state
        this.moveForward = false;
        this.moveBackward = false;

        // Mouse mapping factors (from original Player.c)
        // xMouseFactor = tunnelRect.right / screenCenterX
        this.xMouseFactor = CONFIG.TUNNEL.right / (CONFIG.WIDTH / 2);
        this.yMouseFactor = CONFIG.TUNNEL.bottom / (CONFIG.HEIGHT / 2);

        // Player stats (original used energy only, no lives)
        this.energy = CONFIG.PLAYER.startEnergy;
        this.score = 0;

        // Shooting
        this.shots = [];
        this.lastShotTime = 0;

        // Damage flash (from original: wasHit flag triggers single-frame flash)
        this.wasHit = false;

        // Don't form/explode player
        this.isForming = false;
    }

    setMousePosition(x, y) {
        // Original: xEyePos = xMouseFactor * (xMouseAbs - xScreenCtr)
        // x, y are already screen coords relative to center
        this.x = this.xMouseFactor * x;
        this.y = this.yMouseFactor * y;

        // Clamp to tunnel bounds (minus player extent)
        const { left, right, top, bottom } = CONFIG.TUNNEL;
        this.x = Math.max(left + this.extentX, Math.min(right - this.extentX, this.x));
        this.y = Math.max(top + this.extentY, Math.min(bottom - this.extentY, this.y));
    }

    update(dt) {
        // dtScale converts from milliseconds to frames (at 60fps)
        const dtScale = dt / 16.67;
        const cfg = CONFIG.PLAYER;
        const speedFactor = CONFIG.SPEED_FACTOR;

        // Scaled acceleration and max speed
        const accel = cfg.accelStep * speedFactor;
        const maxSpeed = cfg.maxSpeed * speedFactor;

        // Z movement physics from original Player.c GetInput:
        // if (moveBackward) { if (zVel > 0) zVel *= slowFactor; zVel -= accelStep; }
        // if (moveForward) { if (zVel < 0) zVel *= slowFactor; zVel += accelStep; }
        // else zVel *= slowFactor;

        if (this.moveBackward) {
            if (this.vz > 0) {
                this.vz *= cfg.slowFactor;
            }
            this.vz -= accel * dtScale;
        } else if (this.moveForward) {
            if (this.vz < 0) {
                this.vz *= cfg.slowFactor;
            }
            this.vz += accel * dtScale;
        } else {
            // Decelerate when neither key pressed
            this.vz *= Math.pow(cfg.slowFactor, dtScale);
        }

        // Speed limit (from original: speedLimit = 500, scaled)
        this.vz = Math.max(-maxSpeed, Math.min(maxSpeed, this.vz));

        // Apply Z velocity
        this.z += this.vz * dtScale;

        // Wrap Z position around tunnel length
        const len = CONFIG.TUNNEL.length;
        this.z = ((this.z % len) + len) % len;

        // Update shots
        for (let i = this.shots.length - 1; i >= 0; i--) {
            const shot = this.shots[i];
            shot.update(dt);

            // Remove shots that are too far or marked for removal
            if (shot.pleaseRemove || shot.getZFromPlayer(this.z) > CONFIG.TUNNEL.far) {
                this.shots.splice(i, 1);
            }
        }

        // wasHit is reset by main.js after drawing the flash frame
    }

    fire() {
        const now = performance.now();
        if (now - this.lastShotTime < CONFIG.PLAYER.shotCooldown) {
            return;
        }

        // From original PShot.c: IPShot takes player x, y, and zVel
        // Shot velocity = player zVel + base shot speed (scaled)
        const shot = new PShot(this.x, this.y, this.z);
        shot.vz = this.vz + CONFIG.PLAYER.shotSpeed * CONFIG.SPEED_FACTOR;
        shot.tunnel = this.tunnel;
        this.shots.push(shot);
        this.lastShotTime = now;
        audio.play('playerFire');
    }

    draw(renderer) {
        // Player is at the camera position, not drawn in 3D
    }

    onCollide(other) {
        // Ignore collisions with own shots
        if (other instanceof PShot) return;

        const typeName = other.constructor.name;

        if (typeName === 'Thing') {
            // Power-up: gain energy (from original: DeltaEnergy +40)
            this.energy = Math.min(100, this.energy + CONFIG.ENEMIES.thing.energyBonus);
            audio.play('powerup');
        } else if (typeName === 'Cross' || typeName === 'Saucer' ||
                   typeName === 'Aphid' || typeName === 'SShot') {
            // Enemy collision: -1 energy per hit (from original Player.c Collided)
            this.takeDamage(1);
        }
        // Blockers don't deal damage in original
    }

    takeDamage(amount) {
        this.energy -= amount;
        this.wasHit = true;
        audio.play('playerHit');

        if (this.energy < 0) {
            this.energy = 0;
        }
    }

    addScore(points) {
        this.score += points;
    }

    isDead() {
        // Original: game over when energy <= 0
        return this.energy <= 0;
    }

    reset() {
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.vz = 0;
        this.energy = CONFIG.PLAYER.startEnergy;
        this.score = 0;
        this.shots = [];
        this.wasHit = false;
    }

    /**
     * Update for attract/demo mode (from original Player.c GetDemoInput)
     * - Centers player position
     * - Moves forward at constant cruising speed
     */
    updateAttractMode(dt) {
        // From original: demoCruisingSpeed = S2F(10) × speedFactor
        // Tuned for gentle forward movement in attract mode
        const demoCruisingSpeed = 14 * CONFIG.SPEED_FACTOR;

        // Center position (from original: var(x) = var(y) = 0L)
        this.x = 0;
        this.y = 0;

        // Constant forward velocity (from original: var(zVel) = classVar(demoCruisingSpeed))
        this.vz = demoCruisingSpeed;

        // Apply Z velocity
        const dtScale = dt / 16.67;
        this.z += this.vz * dtScale;

        // Wrap Z position around tunnel length
        const len = CONFIG.TUNNEL.length;
        this.z = ((this.z % len) + len) % len;
    }
}
