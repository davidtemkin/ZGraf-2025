/*
 * ZGraf Web - Configuration
 *
 * Copyright (c) 1991-2025 David Temkin
 * SPDX-License-Identifier: MIT
 */

export const CONFIG = {
    // Display
    WIDTH: 640,
    HEIGHT: 480,

    // Original Mac screen dimensions (for scaling calculations)
    ORIGINAL: {
        viewWidth: 512,
        viewHeight: 342,
        statusWidth: 160,
        statusHeight: 342,
        totalWidth: 672,
        totalHeight: 342
    },

    // Stereo 3D parameters (from original CDisplay.c)
    STEREO: {
        eyeToScreen: 50,
        eyeOffset: 140,
        halfOffset: 70,
        enabled: true,
        // Screen plane depth - objects at this Z appear at screen depth
        // Objects closer pop out (in front), objects farther recede (behind)
        // Set to 0 or null to disable (all objects pop out)
        screenPlaneZ: 5000,
        // Anaglyph colors for red/cyan glasses (red lens left, cyan lens right)
        // Cyan is blue-shifted to reduce green bleed through red lens
        leftColor: 'rgb(0, 120, 255)',    // Blue-shifted cyan for left eye
        rightColor: 'rgb(255, 0, 0)',      // Red for right eye
        leftColorValues: { r: 0, g: 120, b: 255 },   // For dynamic shading
        rightColorValues: { r: 255, g: 0, b: 0 }
    },

    // Global speed factor - scales all velocities for gameplay tuning
    // Original game ran at 60fps on SE/30; modern browsers are much faster
    // Lower = slower gameplay, 1.0 = original speed
    SPEED_FACTOR: 0.5,

    // Tunnel dimensions (world coordinates)
    // Original: ±32767 Fixed, with rectGap=2000, minVisDist=30
    // Original maxVisDist was MAXFIXED (~32768), effectively infinite
    TUNNEL: {
        left: -32000,
        right: 32000,
        top: -32000,
        bottom: 32000,
        near: 30,            // minVisDist from original
        far: 65000,          // maxVisDist - match tunnel length so objects always visible
        frameSpacing: 2000,  // rectGap from original
        length: 65000        // Full tunnel wrap distance (matches original)
    },

    // Player settings (from Player.c IPlayerClass)
    // Original: accelStep=3.0, slowFactor=0.95, speedLimit=500
    // These will be scaled by SPEED_FACTOR at runtime
    PLAYER: {
        accelStep: 3.0,       // Acceleration per frame (Fixed 3.0)
        maxSpeed: 500,        // speedLimit from original
        slowFactor: 0.95,     // Deceleration factor when not pressing keys
        mouseSensitivity: 4,
        shotSpeed: 500,       // PShot inherits player zVel + offset
        shotCooldown: 100,    // ms between shots (rough estimate)
        startEnergy: 100,     // kMaxEnergy
        startLives: 3
    },

    // Enemy settings (from respective .c files)
    ENEMIES: {
        cross: {
            // Cross velocities set per-instance in Game.c
            // Level 1 approaching: vz=-30, Level 2+: random ±100
            points: 200       // DeltaScore from Cross.c Collided
        },
        saucer: {
            // Saucer has complex AI: tracks player ±1/frame, evades 100-200
            shootDistance: 8000,  // fShootDistance
            shotWait: 100,        // fShotWait (frames between shot bursts)
            points: 400           // DeltaScore from Saucer.c
        },
        aphid: {
            // Aphid flocking from Aphid.c
            initialVelocity: 10,  // f10
            maxVelocity: 30,      // f30
            maxAxisVelocity: 100, // f100 limit on x/y/z
            points: 0             // Aphids don't give score in original
        },
        blocker: {
            // Blockers are stationary bars spanning tunnel
            points: 0
        },
        thing: {
            // Things are stationary power-ups
            energyBonus: 40,     // DeltaEnergy from Thing.c
            pointsPenalty: -400  // Penalty for shooting it
        }
    },

    // Radar and Status display settings (matching original Display.h and StatusIndicator.h)
    // Original: kStatusWidth=160, kStatusHeight=342, kRadarFrame=8
    // kRadarWidth=24 (32-8), kRadarHeight=326 (342-2*8)
    RADAR: {
        statusWidth: 160,
        statusHeight: 342,
        radarFrame: 8,
        radarWidth: 24,       // Narrow vertical strip
        radarHeight: 326,
        // Fixed display settings (status panel doesn't scale with window)
        fixedHeight: 500,     // Fixed panel height in pixels
        rightMargin: 20,      // Black margin to right of panel
        leftMargin: 6,        // Narrow black margin between game view and panel
        // Yellow-green color matching original status panel (appears same through both eyes)
        textColor: 'rgb(255, 238, 0)',      // Bright yellow for score/level text
        barColor: 'rgb(255, 238, 0)',       // Yellow for energy bar
        radarBlipColor: 'rgb(200, 180, 50)', // Dimmer yellow-green for radar blips
        playerColor: 'rgb(255, 238, 100)',  // Brighter for player marker
        // Status text positions from StatusIndicator.h (relative to status panel)
        xCenter: 96,          // kXCenter - horizontal center for text
        yScore: 101,          // kYScore - score text Y position
        yLevel: 175,          // kYLevel - level text Y position
        // Energy bar rectangle (from StatusIndicator.h)
        energyLeft: 56,       // kLeftEnergy
        energyTop: 219,       // kTopEnergy
        energyRight: 137,     // kRightEnergy
        energyBottom: 225,    // kBottomEnergy
        maxEnergy: 81         // kMaxEnergy - max width of energy bar
    },

    // Visual settings
    SHADES: {
        tunnelFrame: 0.4,
        player: 1.0,
        cross: 0.8,
        saucer: 0.9,
        aphid: 0.6,
        blocker: 0.3,
        thing: 1.0,
        shot: 1.0,
        explosion: 1.0
    },

    // Timing
    TARGET_FPS: 60
};
