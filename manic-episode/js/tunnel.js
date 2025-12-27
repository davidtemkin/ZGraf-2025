/*
 * ZGraf Web - Tunnel
 *
 * Copyright (c) 1991-2025 David Temkin
 * SPDX-License-Identifier: MIT
 */

import { CONFIG } from './config.js';
import { setEyePosition } from './projection.js';

export class Tunnel {
    constructor() {
        // List of all objects (will be sorted by Z)
        this.objects = [];

        // Player reference
        this.player = null;

        // Game reference (for hitOne callback)
        this.game = null;

        // Tunnel boundaries
        this.bounds = { ...CONFIG.TUNNEL };
    }

    setPlayer(player) {
        this.player = player;
        player.tunnel = this;
    }

    setGame(game) {
        this.game = game;
    }

    /**
     * Add an object to the tunnel
     */
    addObject(obj) {
        obj.tunnel = this;
        obj.isForming = true;
        obj.formAccum = 0;
        // Initialize formation: pieces start scattered and fly inward
        // Original: stdFormIncr = 200, stdFormSteps = 15
        obj.initForm(200, 15);
        this.objects.push(obj);
    }

    /**
     * Remove an object from the tunnel
     */
    removeObject(obj) {
        const idx = this.objects.indexOf(obj);
        if (idx !== -1) {
            this.objects.splice(idx, 1);
        }
        obj.tunnel = null;
    }

    /**
     * Process all objects (update step)
     */
    processObjects(dt) {
        // Update all objects
        for (const obj of this.objects) {
            if (!obj.isProcessed) {
                obj.update(dt);
                obj.isProcessed = true;
            }
        }

        // Remove objects marked for removal
        for (let i = this.objects.length - 1; i >= 0; i--) {
            if (this.objects[i].pleaseRemove) {
                this.objects.splice(i, 1);
            } else {
                this.objects[i].isProcessed = false;
            }
        }
    }

    /**
     * Check collisions between objects
     */
    checkCollisions() {
        const player = this.player;
        if (!player) return;

        for (const obj of this.objects) {
            if (obj === player) continue;
            if (!obj.checkCollide) continue;

            // Check player collision
            if (player.collidesWith(obj)) {
                player.onCollide(obj);
                obj.onCollide(player);
            }

            // Check player shots against enemies
            for (const shot of player.shots) {
                if (shot.collidesWith(obj)) {
                    shot.onCollide(obj);
                    obj.onCollide(shot);
                }
            }
        }
    }

    /**
     * Draw all objects, sorted by Z (far to near - painter's algorithm)
     */
    drawObjects(renderer) {
        if (!this.player) return;

        const playerZ = this.player.z;

        // Set eye position for projection
        setEyePosition(this.player.x, this.player.y, playerZ);

        // Draw tunnel frames first (background)
        renderer.drawTunnelFrames(playerZ);

        // Sort objects by distance from player (far to near)
        const sortedObjects = [...this.objects].sort((a, b) => {
            return b.getZFromPlayer(playerZ) - a.getZFromPlayer(playerZ);
        });

        // Draw objects from far to near (only those ahead of player)
        for (const obj of sortedObjects) {
            const relZ = obj.getZFromPlayer(playerZ);

            // Only draw objects ahead of the player (positive relZ)
            if (relZ > CONFIG.TUNNEL.near && relZ < CONFIG.TUNNEL.far) {
                // Temporarily adjust object Z for correct projection
                const originalZ = obj.z;
                obj.z = playerZ + relZ;
                obj.draw(renderer);
                obj.z = originalZ;
            }
        }

        // Draw player shots (only ahead)
        for (const shot of this.player.shots) {
            const relZ = shot.getZFromPlayer(playerZ);
            if (relZ > CONFIG.TUNNEL.near && relZ < CONFIG.TUNNEL.far) {
                const originalZ = shot.z;
                shot.z = playerZ + relZ;
                shot.draw(renderer);
                shot.z = originalZ;
            }
        }
    }

    /**
     * Draw radar and status panel (called after game view clipping is removed)
     */
    drawStatusPanel(renderer) {
        const playerZ = this.player ? this.player.z : 0;

        // Draw radar display
        renderer.drawRadar(this.player.x, playerZ, this.objects, this.player.shots);

        // Draw status text (score, level, energy)
        const level = this.game ? this.game.level : 1;
        renderer.drawStatusText(this.player.score, level, this.player.energy);
    }

    /**
     * Clear all objects except player
     */
    clear() {
        this.objects = [];
    }

    /**
     * Get count of active enemies
     */
    getEnemyCount() {
        return this.objects.filter(obj =>
            obj.constructor.name !== 'Player' &&
            !obj.pleaseRemove &&
            !obj.isExploding
        ).length;
    }
}
