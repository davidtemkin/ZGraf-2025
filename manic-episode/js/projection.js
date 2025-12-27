/*
 * ZGraf Web - 3D Projection
 *
 * Copyright (c) 1991-2025 David Temkin
 * SPDX-License-Identifier: MIT
 */

import { CONFIG } from './config.js';

// Eye position in world coordinates (controlled by player)
export let eyeX = 0;
export let eyeY = 0;
export let eyeZ = 0;

export function setEyePosition(x, y, z) {
    eyeX = x;
    eyeY = y;
    eyeZ = z;
}

/**
 * Project a 3D world point to 2D screen coordinates
 * Matches original formula:
 *   screenX = (worldX - eyeX) * eyeToScreen / (worldZ - eyeZ)
 *   screenY = (worldY - eyeY) * eyeToScreen / (worldZ - eyeZ)
 *
 * @param {number} worldX - X position in world
 * @param {number} worldY - Y position in world
 * @param {number} worldZ - Z position in world (distance from player)
 * @param {number} eyeOffsetX - Additional X offset for stereo (left/right eye)
 * @returns {{x: number, y: number, visible: boolean}}
 */
export function projectPoint(worldX, worldY, worldZ, eyeOffsetX = 0) {
    const relZ = worldZ - eyeZ;

    // Behind the eye or too close
    if (relZ <= CONFIG.TUNNEL.near) {
        return { x: 0, y: 0, visible: false };
    }

    // Too far
    if (relZ > CONFIG.TUNNEL.far) {
        return { x: 0, y: 0, visible: false };
    }

    const { eyeToScreen, screenPlaneZ } = CONFIG.STEREO;

    // Base projection
    let screenX = ((worldX - eyeX - eyeOffsetX) * eyeToScreen) / relZ;
    const screenY = ((worldY - eyeY) * eyeToScreen) / relZ;

    // If screen plane is defined, shift parallax so objects at screenPlaneZ appear at screen depth
    // Objects closer than screenPlaneZ pop out (in front), farther recede (behind)
    if (screenPlaneZ && eyeOffsetX !== 0) {
        screenX += (eyeOffsetX * eyeToScreen) / screenPlaneZ;
    }

    // Convert to canvas coordinates (center origin)
    // Note: CONFIG.WIDTH/HEIGHT are updated on resize
    return {
        x: screenX + CONFIG.WIDTH / 2,
        y: screenY + CONFIG.HEIGHT / 2,
        visible: true
    };
}

/**
 * Project a 3D line to 2D, handling clipping
 * Returns null if line is completely behind camera
 */
export function projectLine(x1, y1, z1, x2, y2, z2, eyeOffsetX = 0) {
    const p1 = projectPoint(x1, y1, z1, eyeOffsetX);
    const p2 = projectPoint(x2, y2, z2, eyeOffsetX);

    if (!p1.visible && !p2.visible) {
        return null;
    }

    // Simple clipping: if one point is behind, we'd need proper clipping
    // For now, just skip if either point is not visible
    if (!p1.visible || !p2.visible) {
        return null;
    }

    return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
}

/**
 * Project a 3D rectangle (at a single Z depth) to 2D
 */
export function projectRect(left, top, right, bottom, z, eyeOffsetX = 0) {
    const tl = projectPoint(left, top, z, eyeOffsetX);
    const br = projectPoint(right, bottom, z, eyeOffsetX);

    if (!tl.visible || !br.visible) {
        return null;
    }

    return {
        x: tl.x,
        y: tl.y,
        width: br.x - tl.x,
        height: br.y - tl.y
    };
}
