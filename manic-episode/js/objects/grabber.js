/*
 * ZGraf Web - Grabber Enemy
 *
 * Copyright (c) 1991-2025 David Temkin
 * SPDX-License-Identifier: MIT
 */

import { CONFIG } from '../config.js';
import { Vis } from './vis.js';

// Grabber shape from zOBJ 128: arch/gateway with pillars
// Original sizeFactor: 75
// All solid filled rectangles - shade 0-10 (converted to 0-1)
// Format: [left, top, right, bottom, shade]
const GRABBER_SHAPE = [
    // Top cap
    [-7, -32, 7, -30, 0.8],
    // Upper dome
    [-13, -30, 13, -20, 0.9],
    // Horizontal lintel
    [-30, -27, 29, -23, 0.5],
    // Left pillar
    [-30, -23, -18, 32, 0.5],
    // Left foot details
    [-18, 25, -14, 28, 0.5],
    [-18, 28, -11, 32, 0.5],
    // Right foot details
    [12, 25, 16, 28, 0.5],
    [9, 28, 16, 32, 0.5],
    // Right pillar
    [16, -23, 29, 32, 0.5],
];

export class Grabber extends Vis {
    constructor(x, y, z) {
        super(x, y, z);

        // sizeFactor=75 from resource, ×2 for our tunnel scale
        this.shapeScale = 150;
        // Extent based on shape bounds (±30 x, ±32 y)
        this.extentX = 30 * this.shapeScale;
        this.extentY = 32 * this.shapeScale;
        this.thick = 30;
        this.shade = 0.6;

        // Velocities set by Game - default to 0
        this.vx = 0;
        this.vy = 0;
        this.vz = 0;
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

        // Bounce off tunnel walls
        this.checkBounds();

        // Wrap Z position
        this.wrapZ();
    }

    draw(renderer) {
        this.drawShape(renderer, GRABBER_SHAPE, this.shapeScale);
    }

    getCollisionRects() {
        const s = this.shapeScale;
        return GRABBER_SHAPE.map(([left, top, right, bottom]) => ({
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
            if (this.tunnel && this.tunnel.game) {
                this.tunnel.game.hitOne();
            }
        } else if (typeName === 'Player') {
            // Explode from center when hitting player
            this.explode(this.x, this.y);
            if (this.tunnel && this.tunnel.game) {
                this.tunnel.game.hitOne();
            }
        }
    }
}
