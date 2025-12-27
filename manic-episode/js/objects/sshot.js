/*
 * ZGraf Web - Saucer Shot
 *
 * Copyright (c) 1991-2025 David Temkin
 * SPDX-License-Identifier: MIT
 */

import { CONFIG } from '../config.js';
import { Vis } from './vis.js';

// Authentic SShot shape from zOBJ 130: hollow square
// sizeFactor: 25
// [left, top, right, bottom, filled, shade]
const SSHOT_SHAPE = [
    [-8, -8, 8, 8, true, 0.89],   // Outer 16x16 filled
    [-6, -6, 6, 6, false, 0.89],  // Inner 12x12 hollow (frame)
];

export class SShot extends Vis {
    constructor(x, y, z) {
        super(x, y, z);

        // sizeFactor=25 from resource 130, ×2 for tunnel scale
        this.shapeScale = 50;
        this.extentX = 8 * this.shapeScale;
        this.extentY = 8 * this.shapeScale;
        this.thick = 30;
        this.shade = 0.9;
        this.checkCollide = true;

        this.isForming = false;
        this.lifeTime = 0;
        this.maxLifeTime = 5000; // 5 seconds max
    }

    update(dt) {
        const dtScale = dt / 16.67;

        // Apply velocity
        this.x += this.vx * dtScale;
        this.y += this.vy * dtScale;
        this.z += this.vz * dtScale;

        // Track lifetime
        this.lifeTime += dt;
        if (this.lifeTime > this.maxLifeTime) {
            this.pleaseRemove = true;
        }

        // Check bounds
        const { left, right, top, bottom } = CONFIG.TUNNEL;
        if (this.x < left || this.x > right || this.y < top || this.y > bottom) {
            this.pleaseRemove = true;
        }
    }

    draw(renderer) {
        const s = this.shapeScale;

        // Draw authentic SShot shape from zOBJ 130
        for (const [left, top, right, bottom, filled, shade] of SSHOT_SHAPE) {
            const cx = this.x + ((left + right) / 2) * s;
            const cy = this.y + ((top + bottom) / 2) * s;
            const hw = ((right - left) / 2) * s;
            const hh = ((bottom - top) / 2) * s;

            if (filled) {
                renderer.drawFilledRect3D(cx, cy, this.z, hw, hh, shade);
            } else {
                renderer.drawFrameRect3D(cx, cy, this.z, hw, hh, shade);
            }
        }
    }

    onCollide(other) {
        const typeName = other.constructor.name;
        if (typeName === 'Player') {
            // Damage player
            other.takeDamage(15);
            this.pleaseRemove = true;
        }
    }
}
