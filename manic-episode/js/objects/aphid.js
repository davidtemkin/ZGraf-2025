/*
 * ZGraf Web - Aphid Enemy
 *
 * Copyright (c) 1991-2025 David Temkin
 * SPDX-License-Identifier: MIT
 */

import { CONFIG } from '../config.js';
import { Vis } from './vis.js';
import { audio } from '../audio.js';

// Aphid shape from zOBJ 134: plus sign with center square
// Original sizeFactor: 7
// Format: [left, top, right, bottom, shade]
const APHID_SHAPE = [
    // Vertical bar
    [-2, -25, 2, 25, 0.9],
    // Horizontal bar
    [-25, -2, 25, 2, 0.9],
    // Center filled square
    [-12, -12, 12, 12, 1.0],
];

export class Aphid extends Vis {
    constructor(x, y, z) {
        super(x, y, z);

        const cfg = CONFIG.ENEMIES.aphid;
        // sizeFactor=7 from resource, ×2 for our tunnel scale
        this.shapeScale = 14;
        this.extentX = 25 * this.shapeScale;
        this.extentY = 25 * this.shapeScale;
        this.thick = 20;
        this.shade = CONFIG.SHADES.aphid;

        // Flocking state (from original Aphid.c)
        this.angle = Math.floor(Math.random() * 360);
        this.newAngle = this.angle;
        this.velocity = cfg.initialVelocity;  // 10
        this.direction = Math.random() > 0.5 ? 1 : -1;

        // Initial velocities from angle
        this.calcVectors();

        // Random Z velocity (from original: FRand(-f100, f100)), scaled
        this.vz = (Math.random() - 0.5) * 200 * CONFIG.SPEED_FACTOR;

        // Max velocities (from original), scaled
        this.maxVelocity = cfg.maxVelocity * CONFIG.SPEED_FACTOR;        // 30
        this.maxAxisVelocity = cfg.maxAxisVelocity * CONFIG.SPEED_FACTOR; // 100
    }

    calcVectors() {
        // Convert angle to velocity components
        const rad = this.angle * Math.PI / 180;
        const vMag = this.velocity * this.direction;
        this.targetVx = Math.cos(rad) * vMag;
        this.targetVy = Math.sin(rad) * vMag;
    }

    update(dt) {
        super.update(dt);

        // Don't move while exploding or forming
        if (this.isExploding || this.isForming) return;

        const dtScale = dt / 16.67;

        // Flocking logic from original Aphid.c Process method
        if (this.tunnel) {
            this.processFlocking(dtScale);
        }

        // Apply velocities
        this.x += this.vx * dtScale;
        this.y += this.vy * dtScale;
        this.z += this.vz * dtScale;

        // Bounce off walls
        this.checkBounds();

        // Wrap Z position
        this.wrapZ();
    }

    processFlocking(dtScale) {
        // Find nearest neighbor (simplified from original linked-list traversal)
        let neighbor = null;
        let minDist = Infinity;

        for (const obj of this.tunnel.objects) {
            if (obj === this) continue;
            const dx = obj.x - this.x;
            const dy = obj.y - this.y;
            const dz = obj.z - this.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist < minDist) {
                minDist = dist;
                neighbor = obj;
            }
        }

        // Adjust behavior based on neighbor (from original)
        if (neighbor) {
            const oZVel = neighbor.vz;

            // Match Z velocity of neighbor if it's slow enough
            if (oZVel > -100 && oZVel < 100) {
                if (oZVel > this.vz) {
                    this.vz += 2 * dtScale;
                } else if (oZVel < this.vz) {
                    this.vz -= 2 * dtScale;
                }
            }

            // Adjust angle to approach/avoid neighbor
            if (neighbor.x > this.x && !(this.newAngle < 270 && this.newAngle > 90)) {
                this.newAngle++;
            }
            if (neighbor.x < this.x && (this.newAngle < 270 && this.newAngle > 90)) {
                this.newAngle--;
            }
            if (neighbor.y < this.y && this.newAngle > 180) {
                this.newAngle--;
            }
            if (neighbor.y > this.y && this.newAngle < 180) {
                this.newAngle++;
            }

            // Avoid if too close
            if (minDist < 400) {
                this.newAngle += 10;
            }
        }

        // Also steer toward center (from original: toward 0,0)
        if (this.x < 0 && !(this.newAngle < 270 && this.newAngle > 90)) {
            this.newAngle++;
        }
        if (this.x > 0 && (this.newAngle < 270 && this.newAngle > 90)) {
            this.newAngle--;
        }
        if (this.y > 0 && this.newAngle > 180) {
            this.newAngle--;
        }
        if (this.y < 0 && this.newAngle < 180) {
            this.newAngle++;
        }

        // Wrap angle
        if (this.newAngle >= 360) this.newAngle -= 360;
        if (this.newAngle < 0) this.newAngle += 360;

        // Adjust current angle toward new angle
        if (this.newAngle !== this.angle) {
            this.angle += 2 * this.direction;
            if (this.angle >= 360) this.angle -= 360;
            if (this.angle < 0) this.angle += 360;
            this.velocity += 2;  // Speed up when turning
        } else {
            this.velocity -= 1;  // Slow down when straight
        }

        // Clamp velocity
        if (this.velocity > this.maxVelocity) this.velocity = this.maxVelocity;
        if (this.velocity < -this.maxVelocity) this.velocity = this.maxVelocity;

        // Calculate velocity components from angle
        this.calcVectors();

        // Apply to velocity with limits
        this.vx += this.targetVx * dtScale;
        this.vy += this.targetVy * dtScale;

        // Clamp axis velocities
        if (this.vx > this.maxAxisVelocity) this.vx = this.maxAxisVelocity;
        if (this.vx < -this.maxAxisVelocity) this.vx = -this.maxAxisVelocity;
        if (this.vy > this.maxAxisVelocity) this.vy = this.maxAxisVelocity;
        if (this.vy < -this.maxAxisVelocity) this.vy = -this.maxAxisVelocity;
        if (this.vz > this.maxAxisVelocity) this.vz = this.maxAxisVelocity;
        if (this.vz < -this.maxAxisVelocity) this.vz = -this.maxAxisVelocity;
    }

    draw(renderer) {
        this.drawShape(renderer, APHID_SHAPE, this.shapeScale);
    }

    getCollisionRects() {
        const s = this.shapeScale;
        return APHID_SHAPE.map(([left, top, right, bottom]) => ({
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
            audio.play('playerHit');  // Sound 2 used for aphid hits
        } else if (typeName === 'Player') {
            this.explode(this.x, this.y);
        }
    }
}
