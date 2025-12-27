/*
 * ZGraf Web - TestSquare
 *
 * Copyright (c) 1991-2025 David Temkin
 * SPDX-License-Identifier: MIT
 */

import { CONFIG } from '../config.js';
import { Vis } from './vis.js';

// Single solid rectangle for explosion testing
const TESTSQUARE_SHAPE = [
    [-30, -30, 30, 30, 0.8],
];

// Static counter for assigning unique shades
let testSquareCount = 0;

export class TestSquare extends Vis {
    constructor(x, y, z) {
        super(x, y, z);

        // Large scale for easy visibility
        this.shapeScale = 150;
        this.extentX = 30 * this.shapeScale;
        this.extentY = 30 * this.shapeScale;
        this.thick = 50;

        // Assign unique shade to each TestSquare (cycling through 0.3-1.0)
        this.instanceId = testSquareCount++;
        this.shade = 0.3 + (this.instanceId % 8) * 0.1;  // 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0

        // Slow or no movement
        this.vx = 0;
        this.vy = 0;
        this.vz = 0;
    }

    update(dt) {
        super.update(dt);

        const dtScale = dt / 16.67;

        // Apply velocities
        this.x += this.vx * dtScale;
        this.y += this.vy * dtScale;
        this.z += this.vz * dtScale;

        // Bounce off walls
        this.checkBounds();

        // Wrap Z position
        this.wrapZ();
    }

    // Use explosion parameters - doubled duration for visibility
    initExpl(xHit, yHit, distIncr, lastStep) {
        super.initExpl(xHit, yHit, 50, 50);
    }

    draw(renderer) {
        // When exploding or forming, use the 5x5 grid with offsets
        if ((this.isExploding || this.isForming) && this.expl) {
            this.drawExploding(renderer);
            return;
        }

        const s = this.shapeScale;

        // Draw TestSquare shape (normal, fully formed)
        for (const [left, top, right, bottom, shadeVal] of TESTSQUARE_SHAPE) {
            const scaledLeft = left * s;
            const scaledTop = top * s;
            const scaledRight = right * s;
            const scaledBottom = bottom * s;

            const cx = this.x + (scaledLeft + scaledRight) / 2;
            const cy = this.y + (scaledTop + scaledBottom) / 2;
            const hw = (scaledRight - scaledLeft) / 2;
            const hh = (scaledBottom - scaledTop) / 2;

            renderer.drawFilledRect3D(cx, cy, this.z, hw, hh, this.shade);
        }
    }

    /**
     * Override to draw filled rectangles during explosion (base class draws frames)
     */
    drawExploding(renderer) {
        const e = this.expl;
        if (!e) return;

        // Draw each grid cell as a separate filled rectangle
        for (let xi = 0; xi < 5; xi++) {
            for (let yi = 0; yi < 5; yi++) {
                if (e.xLine[xi + 1] !== undefined && e.yLine[yi + 1] !== undefined) {
                    const left = e.xLine[xi] + e.xOffset[xi];
                    const right = e.xLine[xi + 1] + e.xOffset[xi];
                    const top = e.yLine[yi] + e.yOffset[yi];
                    const bottom = e.yLine[yi + 1] + e.yOffset[yi];

                    const cx = this.x + (left + right) / 2;
                    const cy = this.y + (top + bottom) / 2;
                    const hw = (right - left) / 2;
                    const hh = (bottom - top) / 2;

                    if (hw > 0 && hh > 0) {
                        renderer.drawFilledRect3D(cx, cy, this.z, hw, hh, this.shade);
                    }
                }
            }
        }
    }

    onCollide(other) {
        const typeName = other.constructor.name;
        if (typeName === 'PShot') {
            // Only explode when hit by player shot (matching original behavior)
            this.explode(other.x, other.y);
            if (this.tunnel && this.tunnel.game) {
                this.tunnel.game.hitOne();
            }
            // Award points (200, same as Cross in original)
            if (this.tunnel && this.tunnel.player) {
                this.tunnel.player.addScore(200);
            }
        }
        // Note: Player collision does NOT cause explosion in original game
        // Player just takes energy damage (handled in Player.onCollide)
    }
}
