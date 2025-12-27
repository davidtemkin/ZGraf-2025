/*
 * ZGraf Web - Blocker
 *
 * Copyright (c) 1991-2025 David Temkin
 * SPDX-License-Identifier: MIT
 */

import { CONFIG } from '../config.js';
import { Vis } from './vis.js';

export class Blocker extends Vis {
    constructor(x, y, z, isHorz = true, width = null) {
        super(x, y, z);

        const cfg = CONFIG.ENEMIES.blocker;

        // From original: random width between 100-1000 (in fixed point)
        // Scaled ×2 for our tunnel size
        const barWidth = width !== null ? width : (100 + Math.random() * 900) * 2;

        this.isHorz = isHorz;
        this.barWidth = barWidth;

        // Calculate bRect like original:
        // Horizontal: spans full tunnel width, height = barWidth
        // Vertical: spans full tunnel height, width = barWidth
        if (isHorz) {
            this.bLeft = CONFIG.TUNNEL.left;
            this.bRight = CONFIG.TUNNEL.right;
            this.bTop = y - barWidth;
            this.bBottom = y + barWidth;
            this.extentX = (CONFIG.TUNNEL.right - CONFIG.TUNNEL.left) / 2;
            this.extentY = barWidth;
        } else {
            this.bLeft = x - barWidth;
            this.bRight = x + barWidth;
            this.bTop = CONFIG.TUNNEL.top;
            this.bBottom = CONFIG.TUNNEL.bottom;
            this.extentX = barWidth;
            this.extentY = (CONFIG.TUNNEL.bottom - CONFIG.TUNNEL.top) / 2;
        }

        this.thick = cfg.thick;
        this.shade = CONFIG.SHADES.blocker;

        // Blockers don't move
        this.vx = 0;
        this.vy = 0;
        this.vz = 0;
    }

    update(dt) {
        super.update(dt);
        // Blockers don't move, no wrap needed
    }

    draw(renderer) {
        // Use grid-based offset system for both explosion and formation
        if ((this.isExploding || this.isForming) && this.expl) {
            super.draw(renderer);
            return;
        }

        // Normal drawing (not exploding or forming)
        let left, right, top, bottom;
        if (this.isHorz) {
            left = this.bLeft;
            right = this.bRight;
            top = this.y - this.barWidth;
            bottom = this.y + this.barWidth;
        } else {
            left = this.x - this.barWidth;
            right = this.x + this.barWidth;
            top = this.bTop;
            bottom = this.bBottom;
        }

        const cx = (left + right) / 2;
        const cy = (top + bottom) / 2;
        const hw = (right - left) / 2;
        const hh = (bottom - top) / 2;

        // Original draws with zWhite pattern (shade 1.0)
        renderer.drawFilledRect3D(cx, cy, this.z, hw, hh, this.shade);
    }

    onCollide(other) {
        const typeName = other.constructor.name;
        if (typeName === 'PShot') {
            // Blockers can be destroyed by shots
            this.explode(other.x, other.y);
        }
    }
}
