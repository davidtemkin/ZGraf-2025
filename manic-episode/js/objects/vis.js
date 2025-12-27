/*
 * ZGraf Web - Base Visible Object Class
 *
 * Copyright (c) 1991-2025 David Temkin
 * SPDX-License-Identifier: MIT
 */

import { CONFIG } from '../config.js';

export class Vis {
    constructor(x = 0, y = 0, z = 0) {
        // Position in world coordinates
        this.x = x;
        this.y = y;
        this.z = z;

        // Velocity
        this.vx = 0;
        this.vy = 0;
        this.vz = 0;

        // Bounding box (half-widths from center)
        this.extentX = 100;
        this.extentY = 100;
        this.thick = 30;  // Z thickness

        // State
        this.isProcessed = false;
        this.pleaseRemove = false;
        this.checkCollide = true;

        // Visual
        this.shade = 0.8;

        // Explosion state (from original ZExpl.c)
        this.isExploding = false;
        this.isForming = false;
        this.expl = null;  // Explosion data structure

        // Linked list pointers (set by Tunnel)
        this.prev = null;
        this.next = null;

        // Reference to tunnel
        this.tunnel = null;
    }

    /**
     * Initialize explosion (from original InitExpl in ZExpl.c)
     * Divides object into grid segments that fly apart from impact point
     * @param {number} xHit - X position of impact relative to object center
     * @param {number} yHit - Y position of impact relative to object center
     * @param {number} distIncr - How fast segments fly apart each frame
     * @param {number} lastStep - Total animation frames
     */
    initExpl(xHit, yHit, distIncr, lastStep) {
        const extent = {
            left: -this.extentX,
            right: this.extentX,
            top: -this.extentY,
            bottom: this.extentY
        };

        const xQuarter = (extent.right - extent.left) / 4;
        const yQuarter = (extent.bottom - extent.top) / 4;

        // Find which grid cell the hit is in (0-4)
        let xHitLine, yHitLine;
        let xOffset, yOffset;

        if (xHit >= extent.right) {
            xHitLine = 4;
            xOffset = xQuarter;
        } else if (xHit <= extent.left) {
            xHitLine = 0;
            xOffset = xQuarter;
        } else {
            let i = 0;
            let look = extent.left;
            while (xHit > (look + xQuarter) && i <= 4) {
                look += xQuarter;
                i++;
            }
            xHitLine = i + 1;
            xOffset = xHit - look;
        }

        if (yHit >= extent.bottom) {
            yHitLine = 4;
            yOffset = yQuarter;
        } else if (yHit <= extent.top) {
            yHitLine = 0;
            yOffset = yQuarter;
        } else {
            let i = 0;
            let look = extent.top;
            while (yHit > (look + yQuarter) && i <= 4) {
                look += yQuarter;
                i++;
            }
            yHitLine = i + 1;
            yOffset = yHit - look;
        }

        // Set up grid lines (6 lines = 5 segments)
        const xLine = new Array(6);
        const yLine = new Array(6);
        xLine[0] = extent.left;
        yLine[0] = extent.top;
        xLine[1] = extent.left + xOffset;
        yLine[1] = extent.top + yOffset;
        for (let i = 2; i <= 5; i++) {
            xLine[i] = xLine[i - 1] + xQuarter;
            yLine[i] = yLine[i - 1] + yQuarter;
        }

        // Initialize offsets to 0
        const xOffsets = [0, 0, 0, 0, 0];
        const yOffsets = [0, 0, 0, 0, 0];

        this.expl = {
            xLine,
            yLine,
            xOffset: xOffsets,
            yOffset: yOffsets,
            distIncr,
            xHitLine,
            yHitLine,
            step: 0,
            lastStep
        };
    }

    /**
     * Advance explosion animation (from original IncrExpl in ZExpl.c)
     * @returns {boolean} True if explosion is finished
     */
    incrExpl() {
        const e = this.expl;
        if (!e) return true;

        let incr = e.distIncr;

        // Move segments to the right of hit point rightward (exponential)
        for (let i = e.xHitLine; i <= 4; i++) {
            e.xOffset[i] += incr;
            incr += incr;  // Double each step
        }

        // Move segments to the left of hit point leftward (exponential)
        incr = e.distIncr;
        for (let i = e.xHitLine - 1; i >= 0; i--) {
            e.xOffset[i] -= incr;
            incr += incr;
        }

        // Move segments below hit point downward
        incr = e.distIncr;
        for (let i = e.yHitLine; i <= 4; i++) {
            e.yOffset[i] += incr;
            incr += incr;
        }

        // Move segments above hit point upward
        incr = e.distIncr;
        for (let i = e.yHitLine - 1; i >= 0; i--) {
            e.yOffset[i] -= incr;
            incr += incr;
        }

        e.step++;
        return e.step >= e.lastStep;
    }

    /**
     * Initialize formation - pieces start scattered and fly inward
     * From original ZExpl.c InitForm: uses NEGATIVE distIncr so IncrExpl converges
     */
    initForm(distIncr, lastStep) {
        const extent = {
            left: -this.extentX,
            right: this.extentX,
            top: -this.extentY,
            bottom: this.extentY
        };

        const xQuarter = (extent.right - extent.left) / 4;
        const yQuarter = (extent.bottom - extent.top) / 4;

        // Original uses xHitLine=3, yHitLine=3 for formation
        const xHitLine = 3;
        const yHitLine = 3;

        // Set up grid lines (from original InitForm)
        const xLine = new Array(6);
        const yLine = new Array(6);
        xLine[0] = extent.left;
        yLine[0] = extent.top;
        xLine[1] = extent.left;  // Note: original sets [1] = left, not left+offset
        yLine[1] = extent.top;
        for (let i = 2; i <= 5; i++) {
            xLine[i] = xLine[i - 1] + xQuarter;
            yLine[i] = yLine[i - 1] + yQuarter;
        }

        // Pre-calculate scattered starting offsets (from original InitForm)
        // Original: xOffset[3] = FixMul(S2F(lastStep), distIncr)
        const baseOffset = lastStep * distIncr;
        const xOffsets = [0, 0, 0, 0, 0];
        const yOffsets = [0, 0, 0, 0, 0];

        xOffsets[3] = baseOffset;
        yOffsets[3] = baseOffset;
        xOffsets[2] = -baseOffset;
        yOffsets[2] = -baseOffset;
        xOffsets[4] = 2 * baseOffset;
        yOffsets[4] = 2 * baseOffset;
        xOffsets[1] = -2 * baseOffset;
        yOffsets[1] = -2 * baseOffset;
        xOffsets[0] = xOffsets[1];
        yOffsets[0] = yOffsets[1];

        this.expl = {
            xLine,
            yLine,
            xOffset: xOffsets,
            yOffset: yOffsets,
            distIncr: -distIncr,  // NEGATIVE! This makes incrExpl converge
            xHitLine,
            yHitLine,
            step: 0,
            lastStep
        };
    }

    /**
     * Get offset for a point based on which grid segment it's in
     * (from original ED* functions in ZExpl.c)
     */
    getExplOffset(x, y) {
        const e = this.expl;
        if (!e) return { dx: 0, dy: 0 };

        // Find which X segment
        let xl = 0;
        while (x > e.xLine[xl + 1] && xl <= 4) xl++;

        // Find which Y segment
        let yl = 0;
        while (y > e.yLine[yl + 1] && yl <= 4) yl++;

        return {
            dx: e.xOffset[xl] || 0,
            dy: e.yOffset[yl] || 0
        };
    }

    /**
     * Update object each frame
     * @param {number} dt - Delta time in ms
     */
    update(dt) {
        // Framerate-independent timing using delta time
        // dtScale = 1.0 at 60fps, scales proportionally at other framerates
        const dtScale = dt / 16.67;

        // Handle formation animation (pieces fly inward)
        // Original: stdFormIncr = S2F(200), stdFormSteps = 15
        // Uses same incrExpl() as explosion - negative distIncr makes it converge
        // Duration: 15 steps at base rate
        // Speed multiplier 1.8 matches explosion for consistency
        // 0.5 factor for half-speed animations
        if (this.isForming) {
            this.formAccum = (this.formAccum || 0) + dtScale * 1.8 * 0.5;
            while (this.formAccum >= 1) {
                this.formAccum -= 1;
                if (this.incrExpl()) {
                    this.isForming = false;
                    this.expl = null;
                    break;
                }
            }
        }

        // Handle explosion animation (from original Vis.c Process)
        // Original: stdExplIncr = S2F(125), stdExplSteps = 25
        // Max extent after 25 steps: segment d positions from hit gets 25 * 125 * 2^d offset
        // Speed multiplier 1.8 tuned to match original feel
        // 0.5 factor for half-speed animations
        if (this.isExploding) {
            this.explAccum = (this.explAccum || 0) + dtScale * 1.8 * 0.5;
            while (this.explAccum >= 1) {
                this.explAccum -= 1;
                if (this.incrExpl()) {
                    this.pleaseRemove = true;
                    break;
                }
            }
            return; // Don't move while exploding
        }

        // Apply velocity
        if (this.vx !== 0 || this.vy !== 0) {
            this.x += this.vx * dtScale;
            this.y += this.vy * dtScale;
            this.checkBounds();
        }
    }

    /**
     * Check and handle collision with tunnel walls
     */
    checkBounds() {
        const { left, right, top, bottom } = CONFIG.TUNNEL;

        // Right wall
        if (this.x + this.extentX > right) {
            this.x = right - this.extentX;
            this.vx = -this.vx;
        }
        // Left wall
        else if (this.x - this.extentX < left) {
            this.x = left + this.extentX;
            this.vx = -this.vx;
        }

        // Bottom wall
        if (this.y + this.extentY > bottom) {
            this.y = bottom - this.extentY;
            this.vy = -this.vy;
        }
        // Top wall
        else if (this.y - this.extentY < top) {
            this.y = top + this.extentY;
            this.vy = -this.vy;
        }
    }

    /**
     * Draw the object
     * @param {Renderer} renderer
     */
    draw(renderer) {
        // During explosion or formation, use grid-based drawing
        if ((this.isExploding || this.isForming) && this.expl) {
            this.drawExploding(renderer);
            return;
        }

        // Normal drawing
        const w = this.extentX;
        const h = this.extentY;
        renderer.drawFrameRect3D(this.x, this.y, this.z, w, h, this.shade);
    }

    /**
     * Draw a shape array, handling explosion/formation grid subdivision
     * @param {Renderer} renderer
     * @param {Array} shape - Array of [left, top, right, bottom, shade] or [left, top, right, bottom, filled, shade]
     * @param {number} scale - Scale factor for shape coordinates
     * @param {number} shadeMultiplier - Optional multiplier for shade values (default 1.0)
     */
    drawShape(renderer, shape, scale, shadeMultiplier = 1.0) {
        const isAnimating = (this.isExploding || this.isForming) && this.expl;

        for (const rect of shape) {
            // Support both [l,t,r,b,shade] and [l,t,r,b,filled,shade] formats
            let left, top, right, bottom, shade, filled;
            if (rect.length === 5) {
                [left, top, right, bottom, shade] = rect;
                filled = true;
            } else {
                [left, top, right, bottom, filled, shade] = rect;
            }

            // Apply shade multiplier (for pulsing effects, etc.)
            shade = shade * shadeMultiplier;

            const scaledLeft = left * scale;
            const scaledTop = top * scale;
            const scaledRight = right * scale;
            const scaledBottom = bottom * scale;

            if (isAnimating) {
                // Subdivide rectangle by explosion grid, each piece gets same shade
                this.drawRectWithGridSubdivision(renderer, scaledLeft, scaledTop, scaledRight, scaledBottom, shade, filled);
            } else {
                // Normal drawing - just draw the rectangle
                const cx = this.x + (scaledLeft + scaledRight) / 2;
                const cy = this.y + (scaledTop + scaledBottom) / 2;
                const hw = (scaledRight - scaledLeft) / 2;
                const hh = (scaledBottom - scaledTop) / 2;

                if (filled) {
                    renderer.drawFilledRect3D(cx, cy, this.z, hw, hh, shade);
                } else {
                    renderer.drawFrameRect3D(cx, cy, this.z, hw, hh, shade);
                }
            }
        }
    }

    /**
     * Draw a rectangle subdivided by the explosion grid
     * Each grid cell intersection becomes a separate fragment with the same shade
     */
    drawRectWithGridSubdivision(renderer, rectLeft, rectTop, rectRight, rectBottom, shade, filled = true) {
        const e = this.expl;
        if (!e) return;

        // For each grid cell, find intersection with this rectangle
        for (let xi = 0; xi < 5; xi++) {
            for (let yi = 0; yi < 5; yi++) {
                const gridLeft = e.xLine[xi];
                const gridRight = e.xLine[xi + 1];
                const gridTop = e.yLine[yi];
                const gridBottom = e.yLine[yi + 1];

                // Compute intersection of rectangle with this grid cell
                const intLeft = Math.max(rectLeft, gridLeft);
                const intRight = Math.min(rectRight, gridRight);
                const intTop = Math.max(rectTop, gridTop);
                const intBottom = Math.min(rectBottom, gridBottom);

                // Only draw if there's a valid intersection
                if (intLeft < intRight && intTop < intBottom) {
                    // Apply this grid cell's offset
                    const offsetX = e.xOffset[xi] || 0;
                    const offsetY = e.yOffset[yi] || 0;

                    const cx = this.x + (intLeft + intRight) / 2 + offsetX;
                    const cy = this.y + (intTop + intBottom) / 2 + offsetY;
                    const hw = (intRight - intLeft) / 2;
                    const hh = (intBottom - intTop) / 2;

                    if (filled) {
                        renderer.drawFilledRect3D(cx, cy, this.z, hw, hh, shade);
                    } else {
                        renderer.drawFrameRect3D(cx, cy, this.z, hw, hh, shade);
                    }
                }
            }
        }
    }

    /**
     * Draw object during explosion - default implementation for simple rectangles
     * Subclasses with custom shapes should use drawShape() instead
     */
    drawExploding(renderer) {
        // Default: draw object extent as a single rectangle subdivided by grid
        const shape = [[-this.extentX, -this.extentY, this.extentX, this.extentY, this.shade]];
        this.drawShape(renderer, shape, 1);
    }

    /**
     * Called when this object collides with another
     * @param {Vis} other
     */
    onCollide(other) {
        // Override in subclasses
    }

    /**
     * Start explosion animation
     * @param {number} xHit - X position of impact (world coords), defaults to center
     * @param {number} yHit - Y position of impact (world coords), defaults to center
     */
    explode(xHit = 0, yHit = 0) {
        if (!this.isExploding) {
            this.isExploding = true;
            this.checkCollide = false;
            this.explAccum = 0;  // Reset frame accumulator

            // Convert world hit position to object-relative coords
            const relX = xHit - this.x;
            const relY = yHit - this.y;

            // Initialize explosion with impact point
            // Original: stdExplIncr = S2F(125), stdExplSteps = 25
            // At 24fps: 25 steps = ~1.04 seconds
            const distIncr = 125;
            const lastStep = 25;

            this.initExpl(relX, relY, distIncr, lastStep);
        }
    }

    /**
     * Get collision rectangles for this object (in object-local coordinates, scaled)
     * Subclasses with custom shapes should override this
     * @returns {Array} Array of {left, top, right, bottom} rectangles
     */
    getCollisionRects() {
        // Default: return extent as a single rectangle
        return [{
            left: -this.extentX,
            top: -this.extentY,
            right: this.extentX,
            bottom: this.extentY
        }];
    }

    /**
     * Check AABB collision with another object (handles wrap-around)
     * Uses velocity-extended bounds (from original AdjustSize in Vis.c)
     * This prevents fast-moving objects from passing through each other
     */
    collidesWith(other) {
        if (!this.checkCollide || !other.checkCollide) return false;
        if (this.isExploding || other.isExploding) return false;
        if (this.isForming || other.isForming) return false;

        // Extend collision bounds by velocity (from original AdjustSize in Vis.c)
        // Original extended bounds in direction of movement; we simplify by
        // extending in both directions which is slightly more conservative
        const thisExtentX = this.extentX + Math.abs(this.vx || 0);
        const thisExtentY = this.extentY + Math.abs(this.vy || 0);
        const thisThick = this.thick + Math.abs(this.vz || 0);

        const otherExtentX = other.extentX + Math.abs(other.vx || 0);
        const otherExtentY = other.extentY + Math.abs(other.vy || 0);
        const otherThick = other.thick + Math.abs(other.vz || 0);

        // Phase 1: Fast AABB check (bounding box)
        // X axis
        if (this.x + thisExtentX < other.x - otherExtentX) return false;
        if (this.x - thisExtentX > other.x + otherExtentX) return false;

        // Y axis
        if (this.y + thisExtentY < other.y - otherExtentY) return false;
        if (this.y - thisExtentY > other.y + otherExtentY) return false;

        // Z axis with wrap-around
        const len = CONFIG.TUNNEL.length;
        let zDiff = other.z - this.z;
        if (zDiff > len / 2) zDiff -= len;
        if (zDiff < -len / 2) zDiff += len;

        const combinedThick = thisThick + otherThick;
        if (Math.abs(zDiff) > combinedThick) return false;

        // Phase 2: Deep collision - check per-rectangle (from original DeepCollide)
        return this.deepCollide(other);
    }

    /**
     * Per-rectangle collision check (from original DeepCollide in Tunnel.c)
     * Checks if any rectangle from this object overlaps any rectangle from other
     */
    deepCollide(other) {
        const thisRects = this.getCollisionRects();
        const otherRects = other.getCollisionRects();

        for (const r1 of thisRects) {
            // Convert to world coordinates
            const r1Left = r1.left + this.x;
            const r1Right = r1.right + this.x;
            const r1Top = r1.top + this.y;
            const r1Bottom = r1.bottom + this.y;

            for (const r2 of otherRects) {
                // Convert to world coordinates
                const r2Left = r2.left + other.x;
                const r2Right = r2.right + other.x;
                const r2Top = r2.top + other.y;
                const r2Bottom = r2.bottom + other.y;

                // Check if rectangles overlap
                if (!(r1Left > r2Right) &&
                    !(r1Right < r2Left) &&
                    !(r1Bottom < r2Top) &&
                    !(r1Top > r2Bottom)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Get Z distance from player (for sorting), with wrap-around
     */
    getZFromPlayer(playerZ) {
        const len = CONFIG.TUNNEL.length;
        let relZ = this.z - playerZ;

        // Handle wrap-around: find shortest distance
        if (relZ > len / 2) {
            relZ -= len;
        } else if (relZ < -len / 2) {
            relZ += len;
        }

        return relZ;
    }

    /**
     * Wrap Z position to tunnel length
     */
    wrapZ() {
        const len = CONFIG.TUNNEL.length;
        this.z = ((this.z % len) + len) % len;
    }
}
