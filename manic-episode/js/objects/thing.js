/*
 * ZGraf Web - Thing (Power-up)
 *
 * Copyright (c) 1991-2025 David Temkin
 * SPDX-License-Identifier: MIT
 */

import { CONFIG } from '../config.js';
import { Vis } from './vis.js';

// Thing shape from zOBJ 131: concentric squares with cross in center
// sizeFactor: 100
// [left, top, right, bottom, filled, shade]
// Original used: zLt1 (light) for outer frame, zWhite for inner frame, dithered grays for fills
const THING_SHAPE = [
    [-10, -10, 10, 10, false, 0.6],   // Outermost frame (zLt1 - light)
    [-10, -10, 10, 10, true, 0.5],    // Outer filled (medium gray)
    [-8, -8, 8, 8, true, 0.6],        // Layer (dithered gray)
    [-6, -6, 6, 6, true, 0.7],        // Layer (dithered gray)
    [-5, -5, 5, 5, false, 1.0],       // Inner frame (zWhite)
    [-3, -3, 3, 3, false, 1.0],       // Center frame (zWhite)
    [-1, -3, 1, 3, true, 0.9],        // Vertical cross bar (bright gray)
    [-3, -1, 3, 1, true, 0.9],        // Horizontal cross bar (bright gray)
];

export class Thing extends Vis {
    constructor(x, y, z) {
        super(x, y, z);

        // Power-up item - needs to be visible and collectable
        // sizeFactor=100 from resource 131, ×2 for tunnel scale
        this.shapeScale = 200;
        this.extentX = 10 * this.shapeScale;
        this.extentY = 10 * this.shapeScale;
        this.thick = 25;
        this.shade = CONFIG.SHADES.thing;

        // Things are stationary in original (vx=vy=vz=0)
        this.vx = 0;
        this.vy = 0;
        this.vz = 0;

        // Gentle bobbing motion for visual effect
        this.bobPhase = Math.random() * Math.PI * 2;
        this.bobSpeed = 0.003;
    }

    update(dt) {
        super.update(dt);

        // Bobbing motion (visual only, not movement)
        this.bobPhase += this.bobSpeed * dt;

        // No movement - things are stationary in original
        this.wrapZ();
    }

    draw(renderer) {
        // Pulsing brightness
        const pulse = 0.8 + 0.2 * Math.sin(this.bobPhase * 2);
        this.drawShape(renderer, THING_SHAPE, this.shapeScale, pulse);
    }

    getCollisionRects() {
        const s = this.shapeScale;
        // Thing shape has 6 elements: [left, top, right, bottom, filled, shade]
        return THING_SHAPE.map(([left, top, right, bottom]) => ({
            left: left * s,
            top: top * s,
            right: right * s,
            bottom: bottom * s
        }));
    }

    onCollide(other) {
        const typeName = other.constructor.name;
        if (typeName === 'Player') {
            // Player collision handled in Player class
            this.explode();
        } else if (typeName === 'PShot') {
            // Don't destroy on shot - let player collect it
        }
    }
}
