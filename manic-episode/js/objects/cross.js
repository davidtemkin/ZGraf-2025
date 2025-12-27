/*
 * ZGraf Web - Cross Enemy
 *
 * Copyright (c) 1991-2025 David Temkin
 * SPDX-License-Identifier: MIT
 */

import { CONFIG } from '../config.js';
import { Vis } from './vis.js';
import { audio } from '../audio.js';

// Cross shape: hash symbol (#) with 4 bars
// Format: [left, top, right, bottom, shade]
// Draw order: horizontals first, then verticals on top
// Shades from original CrossClass.c: r1=zMed, r2=zLt1, r3=zDk1, r4=zDk2
const CROSS_SHAPE = [
    // r3: Upper horizontal (zDk1 = 0.4)
    [-32, -16, 32, -3, 0.4],
    // r4: Lower horizontal (zDk2 = 0.3)
    [-32, 3, 32, 16, 0.3],
    // r1: Left vertical (zMed = 0.5)
    [-16, -32, -3, 32, 0.5],
    // r2: Right vertical (zLt1 = 0.6)
    [3, -32, 16, 32, 0.6],
];

export class Cross extends Vis {
    constructor(x, y, z) {
        super(x, y, z);

        // sizeFactor=75 from resource, ×2 for our tunnel scale
        this.shapeScale = 150;
        // Extent based on shape bounds (±32 x, ±32 y)
        this.extentX = 32 * this.shapeScale;
        this.extentY = 32 * this.shapeScale;
        this.thick = 30;
        this.shade = CONFIG.SHADES.cross;

        // Velocities set by Game.addCross() - default to 0
        this.vx = 0;
        this.vy = 0;
        this.vz = 0;
    }

    update(dt) {
        super.update(dt);

        // Don't move while exploding or forming
        if (this.isExploding || this.isForming) return;

        const dtScale = dt / 16.67;

        // Apply velocities (from original Vis.Process)
        this.x += this.vx * dtScale;
        this.y += this.vy * dtScale;
        this.z += this.vz * dtScale;

        // Bounce off tunnel walls (from original Vis.CheckBounds)
        this.checkBounds();

        // Wrap Z position
        this.wrapZ();
    }

    draw(renderer) {
        this.drawShape(renderer, CROSS_SHAPE, this.shapeScale);
    }

    getCollisionRects() {
        const s = this.shapeScale;
        return CROSS_SHAPE.map(([left, top, right, bottom]) => ({
            left: left * s,
            top: top * s,
            right: right * s,
            bottom: bottom * s
        }));
    }

    onCollide(other) {
        const typeName = other.constructor.name;
        if (typeName === 'PShot') {
            // Explode from shot's position
            this.explode(other.x, other.y);
            audio.play('crossHit');
            if (this.tunnel && this.tunnel.game) {
                this.tunnel.game.hitOne();
            }
        } else if (typeName === 'Player') {
            // Explode from center when hitting player
            this.explode(this.x, this.y);
            audio.play('crossHit');
            if (this.tunnel && this.tunnel.game) {
                this.tunnel.game.hitOne();
            }
        }
    }
}
