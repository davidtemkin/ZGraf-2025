/*
 * ZGraf Web - Renderer
 *
 * Copyright (c) 1991-2025 David Temkin
 * SPDX-License-Identifier: MIT
 */

import { CONFIG } from './config.js';
import { projectPoint, projectLine, projectRect } from './projection.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = CONFIG.WIDTH;
        this.height = CONFIG.HEIGHT;
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;

        // Create offscreen canvases for stereo rendering
        this.leftEyeCanvas = document.createElement('canvas');
        this.leftEyeCanvas.width = this.width;
        this.leftEyeCanvas.height = this.height;
        this.leftCtx = this.leftEyeCanvas.getContext('2d');

        this.rightEyeCanvas = document.createElement('canvas');
        this.rightEyeCanvas.width = this.width;
        this.rightEyeCanvas.height = this.height;
        this.rightCtx = this.rightEyeCanvas.getContext('2d');

        // Compositing canvas
        this.compositeCanvas = document.createElement('canvas');
        this.compositeCanvas.width = this.width;
        this.compositeCanvas.height = this.height;
        this.compositeCtx = this.compositeCanvas.getContext('2d');

        this.stereoEnabled = CONFIG.STEREO.enabled;
        this.halfOffset = CONFIG.STEREO.halfOffset;

        // Track all images loaded for loading screen
        this.allImagesLoaded = false;
        this.imagesLoaded = 0;
        this.totalImages = 4;

        const checkAllLoaded = () => {
            this.imagesLoaded++;
            if (this.imagesLoaded >= this.totalImages) {
                this.allImagesLoaded = true;
                console.log('All images loaded');
            }
        };

        // Load loading screen image (pict_128)
        this.loadingImage = new Image();
        this.loadingImageLoaded = false;
        this.loadingImage.onload = () => {
            this.loadingImageLoaded = true;
            console.log('Loading image loaded');
            checkAllLoaded();
        };
        this.loadingImage.onerror = () => {
            console.error('Failed to load loading image');
            checkAllLoaded();
        };
        this.loadingImage.src = './images/pict_128.png';

        // Load status panel image for radar (pict_129)
        this.statusImage = new Image();
        this.statusImageLoaded = false;
        this.statusImage.onload = () => {
            this.statusImageLoaded = true;
            console.log('Status panel image loaded');
            checkAllLoaded();
        };
        this.statusImage.onerror = () => {
            console.error('Failed to load status panel image');
            checkAllLoaded();
        };
        this.statusImage.src = './images/pict_129.png';

        // Load "press to play" image for attract mode (pict_130)
        this.pressToPlayImage = new Image();
        this.pressToPlayImageLoaded = false;
        this.pressToPlayImage.onload = () => {
            this.pressToPlayImageLoaded = true;
            console.log('Press to play image loaded');
            checkAllLoaded();
        };
        this.pressToPlayImage.onerror = () => {
            console.error('Failed to load press to play image');
            checkAllLoaded();
        };
        this.pressToPlayImage.src = './images/pict_130.png';

        // Load game over image (pict_131)
        this.gameOverImage = new Image();
        this.gameOverImageLoaded = false;
        this.gameOverImage.onload = () => {
            this.gameOverImageLoaded = true;
            console.log('Game over image loaded');
            checkAllLoaded();
        };
        this.gameOverImage.onerror = () => {
            console.error('Failed to load game over image');
            checkAllLoaded();
        };
        this.gameOverImage.src = './images/pict_131.png';
    }

    /**
     * Get the game view width (area to left of status panel)
     * Accounts for the narrow margin between game view and panel
     */
    getGameViewWidth() {
        const layout = this.getStatusPanelLayout();
        const leftMargin = CONFIG.RADAR.leftMargin || 6;
        return layout.x - leftMargin;
    }

    beginFrame() {
        // Clear all buffers
        this.leftCtx.fillStyle = '#000';
        this.leftCtx.fillRect(0, 0, this.width, this.height);

        this.rightCtx.fillStyle = '#000';
        this.rightCtx.fillRect(0, 0, this.width, this.height);

        // Set up clip region for game view (left of status panel)
        const gameViewWidth = this.getGameViewWidth();

        const contexts = this.stereoEnabled ? [this.leftCtx, this.rightCtx] : [this.leftCtx];
        for (const ctx of contexts) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, gameViewWidth, this.height);
            ctx.clip();
        }
    }

    /**
     * End game view clipping - call before drawing UI elements
     */
    endGameViewClip() {
        const contexts = this.stereoEnabled ? [this.leftCtx, this.rightCtx] : [this.leftCtx];
        for (const ctx of contexts) {
            ctx.restore();
        }
    }

    /**
     * Draw a 3D line with specified shade (0-1)
     */
    drawLine3D(x1, y1, z1, x2, y2, z2, shade = 1.0) {
        if (this.stereoEnabled) {
            // Left eye (cyan) - offset right (for red-left/cyan-right glasses, creates pop-out)
            this._drawLineToCanvas(this.leftCtx, x1, y1, z1, x2, y2, z2, this.halfOffset, shade, 'cyan');
            // Right eye (red) - offset left
            this._drawLineToCanvas(this.rightCtx, x1, y1, z1, x2, y2, z2, -this.halfOffset, shade, 'red');
        } else {
            // Mono mode - draw white
            this._drawLineToCanvas(this.leftCtx, x1, y1, z1, x2, y2, z2, 0, shade, 'white');
        }
    }

    _drawLineToCanvas(ctx, x1, y1, z1, x2, y2, z2, eyeOffset, shade, colorMode) {
        const line = projectLine(x1, y1, z1, x2, y2, z2, eyeOffset);
        if (!line) return;

        ctx.beginPath();
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);

        const intensity = Math.floor(shade * 255);
        if (colorMode === 'cyan') {
            // Use stereo color values from config, scaled by shade
            const { g, b } = CONFIG.STEREO.leftColorValues;
            const green = Math.floor(shade * g);
            const blue = Math.floor(shade * b);
            ctx.strokeStyle = `rgb(0, ${green}, ${blue})`;
        } else if (colorMode === 'red') {
            const { r } = CONFIG.STEREO.rightColorValues;
            const red = Math.floor(shade * r);
            ctx.strokeStyle = `rgb(${red}, 0, 0)`;
        } else {
            ctx.strokeStyle = `rgb(${intensity}, ${intensity}, ${intensity})`;
        }

        // Scale line width based on screen size
        ctx.lineWidth = Math.max(1, Math.round(this.getScale()));
        ctx.stroke();
    }

    /**
     * Draw a 3D filled rectangle at a given Z depth
     */
    drawFilledRect3D(x, y, z, halfWidth, halfHeight, shade = 1.0) {
        if (this.stereoEnabled) {
            this._drawRectToCanvas(this.leftCtx, x, y, z, halfWidth, halfHeight, this.halfOffset, shade, 'cyan', true);
            this._drawRectToCanvas(this.rightCtx, x, y, z, halfWidth, halfHeight, -this.halfOffset, shade, 'red', true);
        } else {
            this._drawRectToCanvas(this.leftCtx, x, y, z, halfWidth, halfHeight, 0, shade, 'white', true);
        }
    }

    /**
     * Draw a 3D frame rectangle at a given Z depth
     */
    drawFrameRect3D(x, y, z, halfWidth, halfHeight, shade = 1.0) {
        if (this.stereoEnabled) {
            this._drawRectToCanvas(this.leftCtx, x, y, z, halfWidth, halfHeight, this.halfOffset, shade, 'cyan', false);
            this._drawRectToCanvas(this.rightCtx, x, y, z, halfWidth, halfHeight, -this.halfOffset, shade, 'red', false);
        } else {
            this._drawRectToCanvas(this.leftCtx, x, y, z, halfWidth, halfHeight, 0, shade, 'white', false);
        }
    }

    _drawRectToCanvas(ctx, x, y, z, halfWidth, halfHeight, eyeOffset, shade, colorMode, filled) {
        const rect = projectRect(x - halfWidth, y - halfHeight, x + halfWidth, y + halfHeight, z, eyeOffset);
        if (!rect) return;

        const intensity = Math.floor(shade * 255);
        let color;
        if (colorMode === 'cyan') {
            // Use stereo color values from config, scaled by shade
            const { g, b } = CONFIG.STEREO.leftColorValues;
            const green = Math.floor(shade * g);
            const blue = Math.floor(shade * b);
            color = `rgb(0, ${green}, ${blue})`;
        } else if (colorMode === 'red') {
            const { r } = CONFIG.STEREO.rightColorValues;
            const red = Math.floor(shade * r);
            color = `rgb(${red}, 0, 0)`;
        } else {
            color = `rgb(${intensity}, ${intensity}, ${intensity})`;
        }

        if (filled) {
            ctx.fillStyle = color;
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        } else {
            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(1, Math.round(this.getScale()));
            ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        }
    }

    /**
     * Draw the tunnel frame at a specific Z depth
     * This draws the rectangular boundary of the tunnel
     */
    drawTunnelFrame(z, shade = CONFIG.SHADES.tunnelFrame) {
        const { left, right, top, bottom } = CONFIG.TUNNEL;

        // Draw four edges of the tunnel frame
        // Top edge
        this.drawLine3D(left, top, z, right, top, z, shade);
        // Bottom edge
        this.drawLine3D(left, bottom, z, right, bottom, z, shade);
        // Left edge
        this.drawLine3D(left, top, z, left, bottom, z, shade);
        // Right edge
        this.drawLine3D(right, top, z, right, bottom, z, shade);
    }

    /**
     * Draw multiple tunnel frames from far to near
     * Frames are at fixed world Z positions, spaced by frameSpacing
     * Handles wrap-around tunnel geometry
     */
    drawTunnelFrames(playerZ) {
        const { left, right, top, bottom, near, far, frameSpacing, length } = CONFIG.TUNNEL;

        let prevRelZ = null;

        // Draw frames within visible range, handling wrap-around
        // We need to check frames that might be visible considering wrap
        const numFrames = Math.ceil(length / frameSpacing);

        for (let i = 0; i < numFrames; i++) {
            const worldZ = i * frameSpacing;

            // Calculate wrapped relative Z (shortest distance)
            let relZ = worldZ - playerZ;
            if (relZ > length / 2) relZ -= length;
            if (relZ < -length / 2) relZ += length;

            // Only draw frames ahead of player within visible range
            if (relZ >= near && relZ <= far) {
                // Fade based on distance - closer frames are brighter
                const distFactor = 1 - (relZ / far);
                const shade = CONFIG.SHADES.tunnelFrame * (0.2 + 0.8 * distFactor);

                // Draw the frame rectangle (pass relZ for projection)
                this.drawTunnelFrame(playerZ + relZ, shade);
            }
        }
    }

    /**
     * Draw a 2D element (for UI, not affected by 3D projection)
     * In stereo mode, uses cyan/red for proper anaglyph (composites to white)
     */
    drawText(text, x, y, color = '#fff', size = 14) {
        // In stereo mode, use cyan for left eye, red for right eye
        // This composites to white at screen depth
        if (this.stereoEnabled) {
            this.leftCtx.font = `${size}px monospace`;
            this.leftCtx.fillStyle = CONFIG.STEREO.leftColor;
            this.leftCtx.fillText(text, x, y);

            this.rightCtx.font = `${size}px monospace`;
            this.rightCtx.fillStyle = CONFIG.STEREO.rightColor;
            this.rightCtx.fillText(text, x, y);
        } else {
            this.leftCtx.font = `${size}px monospace`;
            this.leftCtx.fillStyle = color;
            this.leftCtx.fillText(text, x, y);
        }
    }

    drawPauseOverlay() {
        // Match pict_130 box size: 128x104 at 2x scale = 256x208
        const scale = 2;
        const boxWidth = 128 * scale;
        const boxHeight = 104 * scale;
        const borderWidth = 2 * scale;  // Match image border thickness
        const x = this.centerX - boxWidth / 2;
        const y = this.centerY - boxHeight / 2;

        // Stereo colors from config; border uses same color scheme so it appears white at screen depth
        const contexts = this.stereoEnabled
            ? [{ ctx: this.leftCtx, textColor: CONFIG.STEREO.leftColor, borderColor: CONFIG.STEREO.leftColor },
               { ctx: this.rightCtx, textColor: CONFIG.STEREO.rightColor, borderColor: CONFIG.STEREO.rightColor }]
            : [{ ctx: this.leftCtx, textColor: '#808080', borderColor: '#FFFFFF' }];

        for (const { ctx, textColor, borderColor } of contexts) {
            // Draw border in stereo color (composites to white)
            ctx.fillStyle = borderColor;
            ctx.fillRect(x, y, boxWidth, boxHeight);

            // Draw black interior
            ctx.fillStyle = '#000000';
            ctx.fillRect(
                x + borderWidth,
                y + borderWidth,
                boxWidth - borderWidth * 2,
                boxHeight - borderWidth * 2
            );

            // Draw "Paused" in stereo color
            ctx.font = '48px Silkscreen, monospace';
            ctx.fillStyle = textColor;
            ctx.textAlign = 'center';
            ctx.fillText('Paused', this.centerX, this.centerY - 20);

            // Draw "Press the mouse button to continue" in stereo color
            ctx.font = '16px Silkscreen, monospace';
            ctx.fillStyle = textColor;
            ctx.fillText('Press the mouse', this.centerX, this.centerY + 40);
            ctx.fillText('button to continue', this.centerX, this.centerY + 60);

            ctx.textAlign = 'left';
        }
    }

    /**
     * Draw the intro zoom grid (from original Anim.c BenchmarkSystem)
     * 10x10 grid of white squares that zoom toward the viewer
     * @param {number} zDistance - Z distance for the grid (982 down to 2)
     */
    drawIntroGrid(zDistance) {
        // From original: firstRect = (-500, -500) to (-450, -450) = 50x50 unit squares
        // Grid: 10x10 with 100 unit spacing
        const squareSize = 25;  // Half of 50
        const gridSpacing = 100;
        const gridStart = -500;  // Upper-left corner of grid

        // Scale for web tunnel (original coords were smaller)
        const scale = 2;

        for (let gx = 0; gx < 10; gx++) {
            for (let gy = 0; gy < 10; gy++) {
                // Center of each square
                const x = (gridStart + squareSize + gx * gridSpacing) * scale;
                const y = (gridStart + squareSize + gy * gridSpacing) * scale;

                // Draw filled white square at this Z distance
                this.drawFilledRect3D(x, y, zDistance, squareSize * scale, squareSize * scale, 1.0);
            }
        }
    }

    /**
     * Draw loading image centered (for overlay on intro animation)
     * Uses purple/magenta color (combo of red + cyan stereo colors)
     * Image is 1-bit grayscale - white text on black background
     */
    drawLoadingImage() {
        if (!this.loadingImageLoaded) return;

        const scale = 2;
        const imgWidth = this.loadingImage.width * scale;
        const imgHeight = this.loadingImage.height * scale;
        const x = this.centerX - imgWidth / 2;
        const y = this.centerY - imgHeight / 2;

        // Use offscreen canvas to convert white pixels to purple, black to transparent
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imgWidth;
        tempCanvas.height = imgHeight;
        const tempCtx = tempCanvas.getContext('2d');

        // Draw image to get pixel data
        tempCtx.drawImage(this.loadingImage, 0, 0, imgWidth, imgHeight);
        const imageData = tempCtx.getImageData(0, 0, imgWidth, imgHeight);
        const data = imageData.data;

        // Convert: white (255) -> purple, black (0) -> transparent
        for (let i = 0; i < data.length; i += 4) {
            const brightness = data[i];  // Grayscale, so R=G=B
            if (brightness > 128) {
                // White pixel -> purple
                data[i] = 255;      // R
                data[i + 1] = 120;  // G
                data[i + 2] = 255;  // B
                data[i + 3] = 255;  // A (opaque)
            } else {
                // Black pixel -> opaque black
                data[i] = 0;        // R
                data[i + 1] = 0;    // G
                data[i + 2] = 0;    // B
                data[i + 3] = 255;  // A (opaque)
            }
        }

        tempCtx.putImageData(imageData, 0, 0);

        // Draw tinted result to main canvas
        this.ctx.drawImage(tempCanvas, x, y);
    }

    /**
     * Helper to draw an image with stereo color tinting
     * In stereo mode: left canvas gets cyan tint, right canvas gets red tint
     * Uses multiply blend mode to preserve image luminance
     */
    drawStereoImage(image, x, y, width, height) {
        if (this.stereoEnabled) {
            const leftColor = CONFIG.STEREO.leftColor;
            const rightColor = CONFIG.STEREO.rightColor;

            // Left canvas - draw color rect first, then multiply image on top
            this.leftCtx.fillStyle = leftColor;
            this.leftCtx.fillRect(x, y, width, height);
            this.leftCtx.globalCompositeOperation = 'multiply';
            this.leftCtx.drawImage(image, x, y, width, height);
            this.leftCtx.globalCompositeOperation = 'source-over';

            // Right canvas - draw color rect first, then multiply image on top
            this.rightCtx.fillStyle = rightColor;
            this.rightCtx.fillRect(x, y, width, height);
            this.rightCtx.globalCompositeOperation = 'multiply';
            this.rightCtx.drawImage(image, x, y, width, height);
            this.rightCtx.globalCompositeOperation = 'source-over';
        } else {
            // Mono mode - draw normally
            this.leftCtx.drawImage(image, x, y, width, height);
        }
    }

    /**
     * Draw "press to play" overlay for attract mode
     * Image flashes: visible for 2 out of every 3 seconds
     */
    drawPressToPlayOverlay(totalSeconds) {
        // Flash pattern: show for 2 seconds, hide for 1 second (3 second cycle)
        const cyclePos = totalSeconds % 3;
        if (cyclePos > 2) return;  // Hidden during last second

        if (this.pressToPlayImageLoaded) {
            const scale = 2;
            const imgWidth = this.pressToPlayImage.width * scale;
            const imgHeight = this.pressToPlayImage.height * scale;
            const x = this.centerX - imgWidth / 2;
            const y = this.centerY - imgHeight / 2;

            // Draw with stereo color tinting
            this.drawStereoImage(this.pressToPlayImage, x, y, imgWidth, imgHeight);
        } else {
            // Fallback text - use stereo colors from config
            const text = 'CLICK TO PLAY';
            if (this.stereoEnabled) {
                this.leftCtx.font = '32px Silkscreen, monospace';
                this.leftCtx.fillStyle = CONFIG.STEREO.leftColor;
                this.leftCtx.textAlign = 'center';
                this.leftCtx.fillText(text, this.centerX, this.centerY);
                this.leftCtx.textAlign = 'left';

                this.rightCtx.font = '32px Silkscreen, monospace';
                this.rightCtx.fillStyle = CONFIG.STEREO.rightColor;
                this.rightCtx.textAlign = 'center';
                this.rightCtx.fillText(text, this.centerX, this.centerY);
                this.rightCtx.textAlign = 'left';
            } else {
                this.leftCtx.font = '32px Silkscreen, monospace';
                this.leftCtx.fillStyle = CONFIG.RADAR.textColor;
                this.leftCtx.textAlign = 'center';
                this.leftCtx.fillText(text, this.centerX, this.centerY);
                this.leftCtx.textAlign = 'left';
            }
        }
    }

    /**
     * Draw game over overlay - pict_131 centered
     */
    drawGameOverOverlay() {
        if (this.gameOverImageLoaded) {
            const scale = 2;
            const imgWidth = this.gameOverImage.width * scale;
            const imgHeight = this.gameOverImage.height * scale;
            const x = this.centerX - imgWidth / 2;
            const y = this.centerY - imgHeight / 2;

            // Draw with stereo color tinting
            this.drawStereoImage(this.gameOverImage, x, y, imgWidth, imgHeight);
        } else {
            // Fallback text - use stereo colors from config
            if (this.stereoEnabled) {
                this.leftCtx.font = '48px Silkscreen, monospace';
                this.leftCtx.fillStyle = CONFIG.STEREO.leftColor;
                this.leftCtx.textAlign = 'center';
                this.leftCtx.fillText('GAME OVER', this.centerX, this.centerY);
                this.leftCtx.textAlign = 'left';

                this.rightCtx.font = '48px Silkscreen, monospace';
                this.rightCtx.fillStyle = CONFIG.STEREO.rightColor;
                this.rightCtx.textAlign = 'center';
                this.rightCtx.fillText('GAME OVER', this.centerX, this.centerY);
                this.rightCtx.textAlign = 'left';
            } else {
                this.leftCtx.font = '48px Silkscreen, monospace';
                this.leftCtx.fillStyle = '#f00';
                this.leftCtx.textAlign = 'center';
                this.leftCtx.fillText('GAME OVER', this.centerX, this.centerY);
                this.leftCtx.textAlign = 'left';
            }
        }
    }

    /**
     * Get scale factor based on current window size vs original Mac screen
     * Used for 3D rendering elements (tunnel, objects)
     */
    getScale() {
        // Scale based on height to maintain proportions
        return this.height / CONFIG.ORIGINAL.totalHeight;
    }

    /**
     * Get fixed status panel dimensions and position
     * Panel has fixed size, centered vertically, with right margin
     */
    getStatusPanelLayout() {
        const radar = CONFIG.RADAR;

        // Fixed size settings (with fallbacks for cache issues)
        const fixedHeight = radar.fixedHeight || 500;
        const rightMargin = radar.rightMargin || 20;

        // Fixed scale based on desired height
        const fixedScale = fixedHeight / radar.statusHeight;

        const scaledWidth = Math.round(radar.statusWidth * fixedScale);
        const scaledHeight = Math.round(radar.statusHeight * fixedScale);

        // Position: right side with margin, centered vertically
        const x = this.width - scaledWidth - rightMargin;
        const y = (this.height - scaledHeight) / 2;

        // Debug: log layout once
        if (!this._layoutLogged) {
            console.log('Status panel layout:', { x, y, width: scaledWidth, height: scaledHeight, scale: fixedScale, canvasWidth: this.width, canvasHeight: this.height });
            this._layoutLogged = true;
        }

        return {
            x,
            y,
            width: scaledWidth,
            height: scaledHeight,
            scale: fixedScale
        };
    }

    /**
     * Draw crosshairs in center of screen (matching original RenderTarget)
     * Original: arms from -20 to -6 and 5 to 19, with black outline
     * Crosshairs appear very close to player (in front of all objects)
     */
    drawCrosshairs() {
        const scale = this.getScale();

        // Original coordinates scaled
        const armStart = Math.round(20 * scale);  // Outer edge of arm
        const armEnd = Math.round(6 * scale);     // Inner edge (gap starts)
        const gapStart = Math.round(5 * scale);   // Other side of gap

        // Stereo offset for crosshairs - fixed pixel offset to appear very close to player
        // ~30-35px total separation matches closest visible objects
        const stereoOffset = this.stereoEnabled ? 15 : 0;

        // For stereo mode, use anaglyph colors from config
        // Cyan offset left, red offset right (for red-left/cyan-right glasses, creates pop-out)
        // For mono mode, use amber
        const contexts = this.stereoEnabled
            ? [{ ctx: this.leftCtx, offset: -stereoOffset, color: CONFIG.STEREO.leftColor },
               { ctx: this.rightCtx, offset: stereoOffset, color: CONFIG.STEREO.rightColor }]
            : [{ ctx: this.leftCtx, offset: 0, color: CONFIG.RADAR.textColor }];

        for (const { ctx, offset, color } of contexts) {
            const cx = this.centerX + offset;  // Offset center X for stereo

            // Dim the crosshairs to reduce visual prominence
            ctx.globalAlpha = 0.6;

            // Draw black outline first (slightly offset)
            ctx.strokeStyle = '#000';
            ctx.lineWidth = Math.max(1, Math.round(scale));

            // Black outline - horizontal
            ctx.beginPath();
            ctx.moveTo(cx - armStart, this.centerY - 1);
            ctx.lineTo(cx - armEnd, this.centerY - 1);
            ctx.moveTo(cx + gapStart, this.centerY - 1);
            ctx.lineTo(cx + armStart, this.centerY - 1);
            ctx.moveTo(cx - armStart, this.centerY + 2);
            ctx.lineTo(cx - armEnd, this.centerY + 2);
            ctx.moveTo(cx + gapStart, this.centerY + 2);
            ctx.lineTo(cx + armStart, this.centerY + 2);
            ctx.stroke();

            // Black outline - vertical
            ctx.beginPath();
            ctx.moveTo(cx - 1, this.centerY - armStart);
            ctx.lineTo(cx - 1, this.centerY - armEnd);
            ctx.moveTo(cx - 1, this.centerY + gapStart);
            ctx.lineTo(cx - 1, this.centerY + armStart);
            ctx.moveTo(cx + 2, this.centerY - armStart);
            ctx.lineTo(cx + 2, this.centerY - armEnd);
            ctx.moveTo(cx + 2, this.centerY + gapStart);
            ctx.lineTo(cx + 2, this.centerY + armStart);
            ctx.stroke();

            // Draw crosshairs in stereo color (2 pixels thick)
            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(2, Math.round(2 * scale));

            // Horizontal arms
            ctx.beginPath();
            ctx.moveTo(cx - armStart, this.centerY);
            ctx.lineTo(cx - armEnd, this.centerY);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(cx + gapStart, this.centerY);
            ctx.lineTo(cx + armStart, this.centerY);
            ctx.stroke();

            // Vertical arms
            ctx.beginPath();
            ctx.moveTo(cx, this.centerY - armStart);
            ctx.lineTo(cx, this.centerY - armEnd);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(cx, this.centerY + gapStart);
            ctx.lineTo(cx, this.centerY + armStart);
            ctx.stroke();

            // Reset alpha
            ctx.globalAlpha = 1.0;
        }
    }

    /**
     * Composite left/right eye images into final anaglyph output
     */
    endFrame() {
        if (this.stereoEnabled) {
            // Get image data from both canvases
            const leftData = this.leftCtx.getImageData(0, 0, this.width, this.height);
            const rightData = this.rightCtx.getImageData(0, 0, this.width, this.height);
            const outputData = this.compositeCtx.createImageData(this.width, this.height);

            const left = leftData.data;
            const right = rightData.data;
            const output = outputData.data;

            // Combine: take red from right eye, cyan (green+blue) from left eye
            // (Red lens over left eye filters out red, shows cyan = left eye image)
            // (Cyan lens over right eye filters out cyan, shows red = right eye image)
            for (let i = 0; i < left.length; i += 4) {
                output[i] = right[i];         // Red from right eye
                output[i + 1] = left[i + 1];  // Green from left eye (cyan)
                output[i + 2] = left[i + 2];  // Blue from left eye (cyan)
                output[i + 3] = 255;          // Full alpha
            }

            this.compositeCtx.putImageData(outputData, 0, 0);
            this.ctx.drawImage(this.compositeCanvas, 0, 0);
        } else {
            // Mono mode - just copy left canvas
            this.ctx.drawImage(this.leftEyeCanvas, 0, 0);
        }
    }

    /**
     * Toggle stereo mode
     */
    toggleStereo() {
        this.stereoEnabled = !this.stereoEnabled;
        return this.stereoEnabled;
    }

    /**
     * Draw radar display matching original ZGraf implementation
     * Uses pict_129.png as status panel background
     * Radar is narrow vertical strip: X maps to horizontal, Z maps to vertical
     * In stereo mode, uses cyan/red colors (composites to white at screen depth)
     * Panel has fixed size, centered vertically with right margin
     */
    drawRadar(playerX, playerZ, objects, shots) {
        const radar = CONFIG.RADAR;
        const tunnel = CONFIG.TUNNEL;

        // Get fixed layout for status panel
        const layout = this.getStatusPanelLayout();
        const scale = layout.scale;

        // Radar area within status panel (narrow vertical strip on left side)
        const scaledRadarFrame = Math.round(radar.radarFrame * scale);
        const scaledRadarWidth = Math.round(radar.radarWidth * scale);
        const scaledRadarHeight = Math.round(radar.radarHeight * scale);

        const radarX = layout.x + scaledRadarFrame;
        const radarY = layout.y + scaledRadarFrame;
        const radarCenterX = radarX + scaledRadarWidth / 2;
        const radarCenterY = radarY + scaledRadarHeight / 2;

        // Divisors for mapping world coordinates to radar (using scaled radar dimensions)
        // Y uses half tunnel length since wrap-around caps distance at ±length/2
        const xRadarDiv = tunnel.right / (scaledRadarWidth / 2);
        const yRadarDiv = -((tunnel.length / 2) / (scaledRadarHeight / 2));

        // Blip sizes scale with panel
        // Small blips for shots and aphids, large blips for major objects
        const smallBlip = Math.max(1, Math.round(scale));
        const largeBlip = smallBlip * 2;

        // Stereo colors from config; mono mode uses amber for classic look
        const leftColor = CONFIG.STEREO.leftColor;
        const rightColor = CONFIG.STEREO.rightColor;
        const contexts = this.stereoEnabled
            ? [{ ctx: this.leftCtx, blipColor: leftColor, playerColor: leftColor, tintColor: leftColor },
               { ctx: this.rightCtx, blipColor: rightColor, playerColor: rightColor, tintColor: rightColor }]
            : [{ ctx: this.leftCtx, blipColor: radar.radarBlipColor, playerColor: radar.playerColor, tintColor: null }];

        for (const { ctx, blipColor, playerColor, tintColor } of contexts) {
            // Draw status panel background image (fixed size) with stereo tinting
            if (this.statusImageLoaded) {
                if (this.stereoEnabled) {
                    // Draw color first, then multiply image on top
                    ctx.fillStyle = tintColor;
                    ctx.fillRect(layout.x, layout.y, layout.width, layout.height);
                    ctx.globalCompositeOperation = 'multiply';
                    ctx.drawImage(this.statusImage, layout.x, layout.y, layout.width, layout.height);
                    ctx.globalCompositeOperation = 'source-over';
                } else {
                    ctx.drawImage(this.statusImage, layout.x, layout.y, layout.width, layout.height);
                }
            } else {
                // Fallback: draw dark gray rectangle with border if image not loaded
                ctx.fillStyle = '#222';
                ctx.fillRect(layout.x, layout.y, layout.width, layout.height);
                ctx.strokeStyle = '#666';
                ctx.lineWidth = 2;
                ctx.strokeRect(layout.x, layout.y, layout.width, layout.height);
            }

            // Clear/draw radar area (black background for blips)
            ctx.fillStyle = '#000';
            ctx.fillRect(radarX, radarY, scaledRadarWidth, scaledRadarHeight);

            // Clip all radar content to radar bounds
            ctx.save();
            ctx.beginPath();
            ctx.rect(radarX, radarY, scaledRadarWidth, scaledRadarHeight);
            ctx.clip();

            // Draw objects as blips (matching original DrawRadar in Vis.c)
            for (const obj of objects) {
                // Calculate wrapped relative Z (distance from player)
                let relZ = obj.z - playerZ;
                const len = tunnel.length;
                if (relZ > len / 2) relZ -= len;
                if (relZ < -len / 2) relZ += len;

                // Show objects both ahead and behind (within radar range)
                // Range is half tunnel length due to wrap-around
                const radarRange = tunnel.length / 2;
                if (Math.abs(relZ) < radarRange) {
                    const dotX = radarCenterX + (obj.x / xRadarDiv);
                    const dotY = radarCenterY + (relZ / yRadarDiv);

                    // Use small blips for shots and aphids, large for major objects
                    const typeName = obj.constructor.name;
                    const isSmall = typeName === 'PShot' || typeName === 'SShot' || typeName === 'Aphid';
                    const blipSize = isSmall ? smallBlip : largeBlip;

                    ctx.fillStyle = blipColor;
                    ctx.fillRect(Math.round(dotX), Math.round(dotY), blipSize, blipSize);
                }
            }

            // Draw player shots (small blips)
            for (const shot of shots) {
                let relZ = shot.z - playerZ;
                const len = tunnel.length;
                if (relZ > len / 2) relZ -= len;
                if (relZ < -len / 2) relZ += len;

                const radarRange = tunnel.length / 2;
                if (Math.abs(relZ) < radarRange) {
                    const dotX = radarCenterX + (shot.x / xRadarDiv);
                    const dotY = radarCenterY + (relZ / yRadarDiv);

                    ctx.fillStyle = playerColor;
                    ctx.fillRect(Math.round(dotX), Math.round(dotY), smallBlip, smallBlip);
                }
            }

            // Draw player position at radar center (pixelated triangle pointing up)
            // 3 horizontal rows: widths 1, 3, 5
            const pDotX = radarCenterX + (playerX / xRadarDiv);
            const px = Math.max(1, Math.round(scale)) * 2;  // Double pixel size for player
            ctx.fillStyle = playerColor;

            // Row 1: 1 pixel wide (top)
            ctx.fillRect(Math.round(pDotX - px * 0.5), Math.round(radarCenterY - px), px, px);
            // Row 2: 3 pixels wide
            ctx.fillRect(Math.round(pDotX - px * 1.5), Math.round(radarCenterY), px * 3, px);
            // Row 3: 5 pixels wide (bottom)
            ctx.fillRect(Math.round(pDotX - px * 2.5), Math.round(radarCenterY + px), px * 5, px);

            // Restore context (remove clip)
            ctx.restore();
        }
    }

    /**
     * Draw text with tight letter spacing (canvas doesn't support letterSpacing directly)
     */
    drawTightText(ctx, text, x, y, letterSpacing = -2) {
        const chars = String(text).split('');
        let currentX = x;

        // Calculate total width for centering
        let totalWidth = 0;
        for (const char of chars) {
            totalWidth += ctx.measureText(char).width + letterSpacing;
        }
        totalWidth -= letterSpacing; // Remove last spacing

        // Start position for centered text
        currentX = x - totalWidth / 2;

        // Draw each character
        ctx.textAlign = 'left';
        for (const char of chars) {
            ctx.fillText(char, currentX, y);
            currentX += ctx.measureText(char).width + letterSpacing;
        }
    }

    /**
     * Draw score, level, and energy bar in the status panel
     * Positions from original StatusIndicator.h
     * Font: Silkscreen - bitmap-style font matching old Mac aesthetic
     * Panel has fixed size, centered vertically with right margin
     */
    drawStatusText(score, level, energy) {
        const radar = CONFIG.RADAR;

        // Get fixed layout for status panel
        const layout = this.getStatusPanelLayout();
        const scale = layout.scale;

        // Scaled positions within panel
        const scaledXCenter = Math.round(radar.xCenter * scale);
        const scaledYScore = Math.round(radar.yScore * scale);
        const scaledYLevel = Math.round(radar.yLevel * scale);
        const scaledEnergyLeft = Math.round(radar.energyLeft * scale);
        const scaledEnergyTop = Math.round(radar.energyTop * scale);
        const scaledMaxEnergy = Math.round(radar.maxEnergy * scale);
        const scaledBarHeight = Math.round((radar.energyBottom - radar.energyTop) * scale);

        // Smaller font size to match "Score" label in image
        const fontSize = Math.round(12 * scale);
        // Tight letter spacing (negative = closer together)
        const letterSpacing = Math.round(-1 * scale);

        // Stereo colors from config (composites to white at screen depth)
        // Mono mode uses amber for classic look
        const contexts = this.stereoEnabled
            ? [{ ctx: this.leftCtx, color: CONFIG.STEREO.leftColor },
               { ctx: this.rightCtx, color: CONFIG.STEREO.rightColor }]
            : [{ ctx: this.leftCtx, color: CONFIG.RADAR.textColor }];

        for (const { ctx, color } of contexts) {
            ctx.font = `${fontSize}px Silkscreen, monospace`;
            ctx.fillStyle = color;
            ctx.textBaseline = 'middle';

            // Score text - centered at xCenter, at yScore (with tight spacing)
            this.drawTightText(ctx, score, layout.x + scaledXCenter, layout.y + scaledYScore, letterSpacing);

            // Level text - centered at xCenter, at yLevel (with tight spacing)
            this.drawTightText(ctx, level, layout.x + scaledXCenter, layout.y + scaledYLevel, letterSpacing);

            // Energy bar - filled rectangle from left to (left + energy/100 * maxEnergy)
            const energyWidth = Math.floor((energy / 100) * scaledMaxEnergy);

            // Draw energy bar in stereo color
            ctx.fillStyle = color;
            ctx.fillRect(
                layout.x + scaledEnergyLeft,
                layout.y + scaledEnergyTop,
                energyWidth,
                scaledBarHeight
            );

            // Empty portion is just black (no fill needed, background is already black)

            // Reset text alignment
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
        }

        // Draw "Best enjoyed with 3D glasses" text above status panel
        const aboveFontSize = Math.round(8 * scale);
        const panelCenterX = layout.x + Math.round(radar.statusWidth * scale) / 2;
        const aboveY = layout.y - Math.round(15 * scale);

        const aboveContexts = this.stereoEnabled
            ? [{ ctx: this.leftCtx, color: CONFIG.STEREO.leftColor },
               { ctx: this.rightCtx, color: CONFIG.STEREO.rightColor }]
            : [{ ctx: this.leftCtx, color: '#666' }];
        for (const { ctx, color } of aboveContexts) {
            ctx.font = `${aboveFontSize}px Silkscreen, monospace`;
            ctx.fillStyle = color;
            ctx.globalAlpha = this.stereoEnabled ? 0.55 : 1.0;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.letterSpacing = `${Math.round(-1 * scale)}px`;

            ctx.fillText('Best enjoyed with 3D glasses', panelCenterX, aboveY);
            ctx.globalAlpha = 1.0;
            ctx.letterSpacing = '0px';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
        }

        // Draw control hints below status panel (small, dark grey, unobtrusive)
        // These use same grey for both eyes (appears grey at screen depth)
        const hintFontSize = Math.round(8 * scale);
        const hintY = layout.y + Math.round(radar.statusHeight * scale) + Math.round(15 * scale);
        const lineHeight = Math.round(12 * scale);

        // Hint text uses dimmer stereo colors
        const hintContexts = this.stereoEnabled
            ? [{ ctx: this.leftCtx, color: CONFIG.STEREO.leftColor },
               { ctx: this.rightCtx, color: CONFIG.STEREO.rightColor }]
            : [{ ctx: this.leftCtx, color: '#666' }];
        for (const { ctx, color } of hintContexts) {
            ctx.font = `${hintFontSize}px Silkscreen, monospace`;
            ctx.fillStyle = color;
            ctx.globalAlpha = this.stereoEnabled ? 0.55 : 1.0;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.letterSpacing = `${Math.round(-1 * scale)}px`;

            ctx.fillText('Press and hold 2 to go forward', panelCenterX, hintY);
            ctx.fillText('1 to go backward', panelCenterX, hintY + lineHeight);
            ctx.fillText('Click to fire', panelCenterX, hintY + lineHeight * 2);
            ctx.globalAlpha = 1.0;

            ctx.letterSpacing = '0px';

            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
        }
    }

    /**
     * Draw color calibration overlay for debugging anaglyph colors
     * Shows two squares side by side: reference (red or cyan) and adjustable color
     */
    drawCalibrationOverlay(color, refIsCyan = false) {
        const { r, g, b } = color;
        const colorStr = `rgb(${r}, ${g}, ${b})`;
        const referenceColor = refIsCyan ? CONFIG.STEREO.leftColor : CONFIG.STEREO.rightColor;
        const refLabel = refIsCyan ? 'Cyan Ref' : 'Red Ref';

        // Two squares side by side
        const squareSize = 200;
        const gap = 30;
        const x1 = 50;  // Reference square
        const x2 = x1 + squareSize + gap;  // Calibration square
        const y = this.centerY - squareSize / 2;

        // Draw to both canvases so it appears on final output
        const contexts = this.stereoEnabled ? [this.leftCtx, this.rightCtx] : [this.leftCtx];

        for (const ctx of contexts) {
            // Draw reference red square (left)
            ctx.fillStyle = referenceColor;
            ctx.fillRect(x1, y, squareSize, squareSize);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(x1, y, squareSize, squareSize);

            // Draw calibration square (right)
            ctx.fillStyle = colorStr;
            ctx.fillRect(x2, y, squareSize, squareSize);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(x2, y, squareSize, squareSize);

            // Labels above squares
            ctx.font = '14px Silkscreen, monospace';
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText(refLabel, x1 + squareSize / 2, y - 10);
            ctx.fillText('Calibration', x2 + squareSize / 2, y - 10);

            // RGB text below the squares
            ctx.font = '16px Silkscreen, monospace';
            ctx.textAlign = 'left';
            ctx.fillText(referenceColor, x1, y + squareSize + 25);
            ctx.fillText(colorStr, x2, y + squareSize + 25);

            // Draw instructions
            ctx.font = '12px Silkscreen, monospace';
            ctx.fillStyle = '#888';
            ctx.fillText('r/R: red  g/G: green  b/B: blue  -/+: all  /: toggle ref', x1, y + squareSize + 50);

            // Static reference squares below (fixed red and cyan from config)
            const y2 = y + squareSize + 80;

            // Static red square (left)
            ctx.fillStyle = CONFIG.STEREO.rightColor;
            ctx.fillRect(x1, y2, squareSize, squareSize);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(x1, y2, squareSize, squareSize);

            // Static cyan square (right)
            ctx.fillStyle = CONFIG.STEREO.leftColor;
            ctx.fillRect(x2, y2, squareSize, squareSize);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(x2, y2, squareSize, squareSize);

            // Labels for static squares
            ctx.font = '14px Silkscreen, monospace';
            ctx.fillStyle = '#888';
            ctx.textAlign = 'center';
            ctx.fillText('Red (fixed)', x1 + squareSize / 2, y2 + squareSize + 20);
            ctx.fillText('Cyan (fixed)', x2 + squareSize / 2, y2 + squareSize + 20);
        }
    }

    /**
     * Draw depth mode indicator in top-left corner
     */
    drawDepthModeIndicator(modeName) {
        const x = 20;
        const y = 30;

        // Draw to both canvases in stereo mode
        const contexts = this.stereoEnabled ? [this.leftCtx, this.rightCtx] : [this.leftCtx];

        for (const ctx of contexts) {
            // Semi-transparent background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(x - 10, y - 20, 280, 50);

            // Mode text
            ctx.font = '14px Silkscreen, monospace';
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(`Depth: ${modeName}`, x, y - 10);

            // Instructions
            ctx.font = '10px Silkscreen, monospace';
            ctx.fillStyle = '#888';
            ctx.fillText('[ / ] to change mode', x, y + 10);
        }
    }

    /**
     * Resize all canvases
     */
    resize(width, height) {
        this.width = width;
        this.height = height;
        this.centerX = width / 2;
        this.centerY = height / 2;

        this.leftEyeCanvas.width = width;
        this.leftEyeCanvas.height = height;

        this.rightEyeCanvas.width = width;
        this.rightEyeCanvas.height = height;

        this.compositeCanvas.width = width;
        this.compositeCanvas.height = height;
    }
}
