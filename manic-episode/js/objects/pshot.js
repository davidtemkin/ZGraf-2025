/*
 * ZGraf Web - Player Shot
 *
 * Copyright (c) 1991-2025 David Temkin
 * SPDX-License-Identifier: MIT
 */

import { CONFIG } from '../config.js';
import { Vis } from './vis.js';

// Authentic PShot shape from zOBJ 129: simple filled square
// sizeFactor: 7
// [left, top, right, bottom, filled, shade]
// Shade is index 0-10: 0=black, 5=medium, 10=white
const PSHOT_SHAPE = [
    [-12, -12, 12, 12, true, 10],  // Solid 24x24 square, shade 10 (white)
];

// From original PShot.c: shot not drawn until 800 units from player
const START_DIST = 800;

export class PShot extends Vis {
    constructor(x, y, z) {
        super(x, y, z);

        // sizeFactor=7 from resource 129, ×2 for tunnel scale
        this.shapeScale = 14;
        this.extentX = 12 * this.shapeScale;
        this.extentY = 12 * this.shapeScale;
        this.thick = 40;
        this.shade = CONFIG.SHADES.shot;
        this.checkCollide = true;

        // Shots don't bounce off walls
        this.isForming = false;
    }

    update(dt) {
        const dtScale = dt / 16.67;

        // Move forward
        this.z += this.vz * dtScale;

        // Wrap Z position
        this.wrapZ();

        // Track distance traveled - remove after traveling too far
        const frameDistance = Math.abs(this.vz * dtScale);
        this.distanceTraveled = (this.distanceTraveled || 0) + frameDistance;
        if (this.distanceTraveled > CONFIG.TUNNEL.far) {
            this.pleaseRemove = true;
        }
    }

    draw(renderer) {
        // From original PShot.c: don't draw if too close to player
        // if (!(var(zFromPlayer) >= 0 && var(zFromPlayer) < classVar(startDist)))
        //     (inherited(Draw));
        const zFromPlayer = this.getZFromPlayer(this.tunnel?.player?.z || 0);
        if (zFromPlayer >= 0 && zFromPlayer < START_DIST) {
            return;  // Too close, don't draw yet
        }

        const s = this.shapeScale;

        // Draw authentic PShot shape from zOBJ 129
        // Shade index 0-10 maps to grayscale 0.0-1.0
        for (const [left, top, right, bottom, filled, shadeIdx] of PSHOT_SHAPE) {
            const cx = this.x + ((left + right) / 2) * s;
            const cy = this.y + ((top + bottom) / 2) * s;
            const hw = ((right - left) / 2) * s;
            const hh = ((bottom - top) / 2) * s;
            const shade = shadeIdx / 10;

            if (filled) {
                renderer.drawFilledRect3D(cx, cy, this.z, hw, hh, shade);
            } else {
                renderer.drawFrameRect3D(cx, cy, this.z, hw, hh, shade);
            }
        }
    }

    onCollide(other) {
        // Shot hit something
        const typeName = other.constructor.name;

        if (typeName !== 'Player' && typeName !== 'PShot') {
            this.pleaseRemove = true;

            // Award points if enemy
            if (typeName !== 'Blocker' && typeName !== 'Thing') {
                const cfg = CONFIG.ENEMIES[typeName.toLowerCase()];
                if (cfg && cfg.points && this.tunnel && this.tunnel.player) {
                    this.tunnel.player.addScore(cfg.points);
                }
            }
        }
    }
}
