/*
 * Copyright (C) 2021 Sienci Labs Inc.
 *
 * This file is part of gSender.
 *
 * gSender is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, under version 3 of the License.
 *
 * gSender is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with gSender.  If not, see <https://www.gnu.org/licenses/>.
 */

import {
    ProbeTask,
    RectProbeParams,
    RoundProbeParams,
    StockProbeGCodeParams,
    CornerProbeParams,
    EdgeProbeParams,
    RotationProbeParams,
    CornerSelection,
    EdgeSelection,
} from './definitions';

// ── Probe sequence constants ──────────────────────────────────────────────────
const PROBE_FAST         = 500;   // mm/min — initial fast approach
const PROBE_FAST_RETRACT = 3;     // mm — back off after fast probe
const PROBE_SLOW         = 50;    // mm/min — precision approach
const PROBE_RELEASE_SPD  = 10;    // mm/min — controlled slow release after slow probe
const PROBE_RELEASE_DIST = 1;     // mm — distance of controlled release
const PROBE_CLEARANCE    = 5;     // mm — additional clearance retract at travel speed
const PROBE_RETRACT_TOTAL = PROBE_RELEASE_DIST + PROBE_CLEARANCE; // 6 mm total retract from surface

// ── Probe helpers ─────────────────────────────────────────────────────────────

/**
 * 4-command approach: fast probe → back off → slow probe → capture var.
 * Ends with tool AT the surface. Insert G10 L20 after this if needed,
 * then call probeTouchRetract to lift clear.
 * Requires G91 mode to be active.
 */
function probeTouchApproach(
    axis: string,
    direction: number,
    distance: number,
    varName: string,
    feedrateFast = PROBE_FAST,
    feedrateSlow = PROBE_SLOW,
): string[] {
    const s  = direction > 0 ? '' : '-';
    const rs = direction > 0 ? '-' : '';
    return [
        `G38.2 ${axis}${s}${distance.toFixed(3)} F${feedrateFast}`,
        `G91 G1 ${axis}${rs}${PROBE_FAST_RETRACT.toFixed(3)} F200`,
        `G38.2 ${axis}${s}${(PROBE_FAST_RETRACT + 1).toFixed(3)} F${feedrateSlow}`,
        `%${varName}=pos${axis.toLowerCase()}`,
    ];
}

/**
 * 2-command retract: controlled slow release then clearance.
 * Call after probeTouchApproach (and optional G10 L20).
 * Leaves tool PROBE_RETRACT_TOTAL mm away from surface.
 */
function probeTouchRetract(
    axis: string,
    direction: number,
    travelFeedrate: number,
): string[] {
    const rs = direction > 0 ? '-' : '';
    return [
        `G91 G1 ${axis}${rs}${PROBE_RELEASE_DIST.toFixed(3)} F${PROBE_RELEASE_SPD}`,
        `G91 G1 ${axis}${rs}${PROBE_CLEARANCE.toFixed(3)} F${travelFeedrate}`,
    ];
}

/**
 * 2D diagonal approach for round-stock probing.
 * outCos/outSin are the unit-vector components of the OUTWARD direction from center.
 * Probes INWARD toward center.
 * Requires G91 mode to be active.
 */
function probeTouchApproachXY(
    outCos: number,
    outSin: number,
    distance: number,
    xVarName: string,
    yVarName: string,
    feedrateFast = PROBE_FAST,
    feedrateSlow = PROBE_SLOW,
): string[] {
    const ix = (d: number) => (-outCos * d).toFixed(4);
    const iy = (d: number) => (-outSin * d).toFixed(4);
    const ox = (d: number) => ( outCos * d).toFixed(4);
    const oy = (d: number) => ( outSin * d).toFixed(4);
    return [
        `G38.2 X${ix(distance)} Y${iy(distance)} F${feedrateFast}`,
        `G91 G1 X${ox(PROBE_FAST_RETRACT)} Y${oy(PROBE_FAST_RETRACT)} F200`,
        `G38.2 X${ix(PROBE_FAST_RETRACT + 1)} Y${iy(PROBE_FAST_RETRACT + 1)} F${feedrateSlow}`,
        `%${xVarName}=posx`,
        `%${yVarName}=posy`,
    ];
}

/** 2-command retract for diagonal probing — moves in the outward direction. */
function probeTouchRetractXY(
    outCos: number,
    outSin: number,
    travelFeedrate: number,
): string[] {
    const ox = (d: number) => ( outCos * d).toFixed(4);
    const oy = (d: number) => ( outSin * d).toFixed(4);
    return [
        `G91 G1 X${ox(PROBE_RELEASE_DIST)} Y${oy(PROBE_RELEASE_DIST)} F${PROBE_RELEASE_SPD}`,
        `G91 G1 X${ox(PROBE_CLEARANCE)} Y${oy(PROBE_CLEARANCE)} F${travelFeedrate}`,
    ];
}

// ── Wizard A: XYZ Center — Rectangle stock ────────────────────────────────────

export function generateXYZCenterRectGCode(params: RectProbeParams): ProbeTask[] {
    const {
        stockWidth,
        stockLength,
        probeFeedrateFast: ff,
        probeFeedrateSlow: fs,
        travelFeedrate: tr,
        bufferDistance: buf,
        xyProbingHeight: xyH,
        wcsIndex,
        safeHeight = 10,
    } = params;

    const halfW      = stockWidth  / 2;
    const halfL      = stockLength / 2;
    const probeZDist = buf + 10;
    const liftToSafe = (safeHeight - PROBE_RETRACT_TOTAL).toFixed(3); // after Z probe retract → safeHeight
    const liftFromXY = (safeHeight - xyH).toFixed(3);                 // xyH → safeHeight
    const sinkToXY   = (xyH - safeHeight).toFixed(3);                  // safeHeight → xyH

    return [
        {
            label: 'Spindle/coolant off',
            commands: ['M5', 'M9', 'G21', 'G91', '%SP_START_X=posx', '%SP_START_Y=posy'],
        },
        {
            label: 'Probing Z surface',
            commands: [
                ...probeTouchApproach('Z', -1, probeZDist, 'SP_Z', ff, fs),
                `G10 L20 P${wcsIndex} Z0`,
                ...probeTouchRetract('Z', -1, tr),
                `G91 G1 Z${liftToSafe} F${tr}`,
            ],
        },
        {
            label: 'Moving to probing position left',
            commands: [
                `%SP_DX=SP_START_X-${(halfW + buf).toFixed(3)}-posx`,
                `G91 G1 X[SP_DX] F${tr}`,
                `G91 G1 Z${sinkToXY} F${tr}`,
            ],
        },
        {
            label: 'Probing left side',
            commands: [
                ...probeTouchApproach('X', 1, halfW + buf + 5, 'SP_X_MINUS', ff, fs),
                ...probeTouchRetract('X', 1, tr),
            ],
        },
        {
            label: 'Moving to probing position right',
            commands: [
                `G91 G1 Z${liftFromXY} F${tr}`,
                `%SP_DX=SP_START_X+${(halfW + buf).toFixed(3)}-posx`,
                `G91 G1 X[SP_DX] F${tr}`,
                `G91 G1 Z${sinkToXY} F${tr}`,
            ],
        },
        {
            label: 'Probing right side',
            commands: [
                ...probeTouchApproach('X', -1, halfW + buf + 5, 'SP_X_PLUS', ff, fs),
                ...probeTouchRetract('X', -1, tr),
            ],
        },
        {
            label: 'Moving to probing position top',
            commands: [
                `G91 G1 Z${liftFromXY} F${tr}`,
                '%SP_X_CENTER=(SP_X_MINUS+SP_X_PLUS)/2',
                '%SP_DX=SP_X_CENTER-posx',
                `%SP_DY=SP_START_Y+${(halfL + buf).toFixed(3)}-posy`,
                `G91 G1 X[SP_DX] Y[SP_DY] F${tr}`,
                `G91 G1 Z${sinkToXY} F${tr}`,
            ],
        },
        {
            label: 'Probing top side',
            commands: [
                ...probeTouchApproach('Y', -1, halfL + buf + 5, 'SP_Y_PLUS', ff, fs),
                ...probeTouchRetract('Y', -1, tr),
            ],
        },
        {
            label: 'Moving to probing position bottom',
            commands: [
                `G91 G1 Z${liftFromXY} F${tr}`,
                '%SP_DX=SP_X_CENTER-posx',
                `%SP_DY=SP_START_Y-${(halfL + buf).toFixed(3)}-posy`,
                `G91 G1 X[SP_DX] Y[SP_DY] F${tr}`,
                `G91 G1 Z${sinkToXY} F${tr}`,
            ],
        },
        {
            label: 'Probing bottom side',
            commands: [
                ...probeTouchApproach('Y', 1, halfL + buf + 5, 'SP_Y_MINUS', ff, fs),
                ...probeTouchRetract('Y', 1, tr),
            ],
        },
        {
            label: 'Moving to work zero',
            commands: [
                `G91 G1 Z${liftFromXY} F${tr}`,
                '%SP_Y_CENTER=(SP_Y_MINUS+SP_Y_PLUS)/2',
                '%SP_DX=SP_X_CENTER-posx',
                '%SP_DY=SP_Y_CENTER-posy',
                `G91 G1 X[SP_DX] Y[SP_DY] F${tr}`,
                'G4 P0.1',
                `G10 L20 P${wcsIndex} X0 Y0`,
                '%SP_WIDTH=SP_X_PLUS-SP_X_MINUS',
                '%SP_LENGTH=SP_Y_PLUS-SP_Y_MINUS',
            ],
        },
    ];
}

// ── Wizard A: XYZ Center — Round stock (3-point circle) ──────────────────────

export function generateXYZCenterRoundGCode(params: RoundProbeParams): ProbeTask[] {
    const {
        stockDiameter,
        probeFeedrateFast: ff,
        probeFeedrateSlow: fs,
        travelFeedrate: tr,
        bufferDistance: buf,
        xyProbingHeight: xyH,
        wcsIndex,
        safeHeight = 10,
    } = params;

    const probeRadius = stockDiameter / 2 + buf;
    const probeZDist  = buf + 10;
    const liftToSafe  = (safeHeight - PROBE_RETRACT_TOTAL).toFixed(3);
    const liftFromXY  = (safeHeight - xyH).toFixed(3);
    const sinkToXY    = (xyH - safeHeight).toFixed(3);

    // Outward unit vectors at 0°, 120°, 240°
    const angles = [0, 120, 240].map((a) => (a * Math.PI) / 180);
    const dirs   = angles.map((a) => ({ cos: Math.cos(a), sin: Math.sin(a) }));

    return [
        {
            label: 'Spindle/coolant off',
            commands: ['M5', 'M9', 'G21', 'G91', '%SP_START_X=posx', '%SP_START_Y=posy'],
        },
        {
            label: 'Probing Z surface',
            commands: [
                ...probeTouchApproach('Z', -1, probeZDist, 'SP_Z', ff, fs),
                `G10 L20 P${wcsIndex} Z0`,
                ...probeTouchRetract('Z', -1, tr),
                `G91 G1 Z${liftToSafe} F${tr}`,
            ],
        },
        {
            label: 'Moving to probing position 1 (0°)',
            commands: [
                `%SP_DX=SP_START_X+${(dirs[0].cos * probeRadius).toFixed(4)}-posx`,
                `%SP_DY=SP_START_Y+${(dirs[0].sin * probeRadius).toFixed(4)}-posy`,
                `G91 G1 X[SP_DX] Y[SP_DY] F${tr}`,
                `G91 G1 Z${sinkToXY} F${tr}`,
            ],
        },
        {
            label: 'Probing point 1 (0°)',
            commands: [
                ...probeTouchApproachXY(dirs[0].cos, dirs[0].sin, probeRadius + 5, 'SP_P1X', 'SP_P1Y', ff, fs),
                ...probeTouchRetractXY(dirs[0].cos, dirs[0].sin, tr),
            ],
        },
        {
            label: 'Moving to probing position 2 (120°)',
            commands: [
                `G91 G1 Z${liftFromXY} F${tr}`,
                `%SP_DX=SP_START_X+${(dirs[1].cos * probeRadius).toFixed(4)}-posx`,
                `%SP_DY=SP_START_Y+${(dirs[1].sin * probeRadius).toFixed(4)}-posy`,
                `G91 G1 X[SP_DX] Y[SP_DY] F${tr}`,
                `G91 G1 Z${sinkToXY} F${tr}`,
            ],
        },
        {
            label: 'Probing point 2 (120°)',
            commands: [
                ...probeTouchApproachXY(dirs[1].cos, dirs[1].sin, probeRadius + 5, 'SP_P2X', 'SP_P2Y', ff, fs),
                ...probeTouchRetractXY(dirs[1].cos, dirs[1].sin, tr),
            ],
        },
        {
            label: 'Moving to probing position 3 (240°)',
            commands: [
                `G91 G1 Z${liftFromXY} F${tr}`,
                `%SP_DX=SP_START_X+${(dirs[2].cos * probeRadius).toFixed(4)}-posx`,
                `%SP_DY=SP_START_Y+${(dirs[2].sin * probeRadius).toFixed(4)}-posy`,
                `G91 G1 X[SP_DX] Y[SP_DY] F${tr}`,
                `G91 G1 Z${sinkToXY} F${tr}`,
            ],
        },
        {
            label: 'Probing point 3 (240°)',
            commands: [
                ...probeTouchApproachXY(dirs[2].cos, dirs[2].sin, probeRadius + 5, 'SP_P3X', 'SP_P3Y', ff, fs),
                ...probeTouchRetractXY(dirs[2].cos, dirs[2].sin, tr),
            ],
        },
        {
            label: 'Calculating center (circumcenter)',
            commands: [
                '%SP_AX=SP_P2X-SP_P1X',
                '%SP_AY=SP_P2Y-SP_P1Y',
                '%SP_BX=SP_P3X-SP_P1X',
                '%SP_BY=SP_P3Y-SP_P1Y',
                '%SP_D=2*(SP_AX*SP_BY-SP_AY*SP_BX)',
                '%SP_UX=(SP_BY*(SP_AX*SP_AX+SP_AY*SP_AY)-SP_AY*(SP_BX*SP_BX+SP_BY*SP_BY))/SP_D',
                '%SP_UY=(SP_AX*(SP_BX*SP_BX+SP_BY*SP_BY)-SP_BX*(SP_AX*SP_AX+SP_AY*SP_AY))/SP_D',
                '%SP_CX=SP_P1X+SP_UX',
                '%SP_CY=SP_P1Y+SP_UY',
                '%SP_RADIUS=Math.sqrt(SP_UX*SP_UX+SP_UY*SP_UY)',
                '%SP_DIAMETER=2*SP_RADIUS',
            ],
        },
        {
            label: 'Moving to work zero',
            commands: [
                `G91 G1 Z${liftFromXY} F${tr}`,
                '%SP_DX=SP_CX-posx',
                '%SP_DY=SP_CY-posy',
                `G91 G1 X[SP_DX] Y[SP_DY] F${tr}`,
                'G4 P0.1',
                `G10 L20 P${wcsIndex} X0 Y0`,
            ],
        },
    ];
}

// ── Wizard B: Z Only ─────────────────────────────────────────────────────────

export function generateZOnlyGCode(params: StockProbeGCodeParams): ProbeTask[] {
    const {
        probeFeedrateFast: ff,
        probeFeedrateSlow: fs,
        travelFeedrate: tr,
        bufferDistance: buf,
        wcsIndex,
        safeHeight = 10,
    } = params;

    const liftToSafe = (safeHeight - PROBE_RETRACT_TOTAL).toFixed(3);

    return [
        {
            label: 'Spindle/coolant off',
            commands: ['M5', 'M9', 'G21', 'G91'],
        },
        {
            label: 'Probing Z surface',
            commands: [
                ...probeTouchApproach('Z', -1, buf + 10, 'SP_Z', ff, fs),
                `G10 L20 P${wcsIndex} Z0`,
                ...probeTouchRetract('Z', -1, tr),
            ],
        },
        {
            label: 'Retracting to safe height',
            commands: [
                `G91 G1 Z${liftToSafe} F${tr}`,
            ],
        },
    ];
}

// ── Wizard C: Hole Center — XY from inside outward ───────────────────────────

export function generateHoleCenterGCode(params: RoundProbeParams): ProbeTask[] {
    const {
        stockDiameter,
        probeFeedrateFast: ff,
        probeFeedrateSlow: fs,
        travelFeedrate: tr,
        wcsIndex,
        safeHeight = 10,
    } = params;

    const holeRadius = stockDiameter / 2;
    const probeDist  = holeRadius + 5;

    return [
        {
            label: 'Spindle/coolant off',
            commands: ['M5', 'M9', 'G21', 'G91', '%SP_HX=posx', '%SP_HY=posy'],
        },
        {
            label: 'Probing +X wall',
            commands: [
                ...probeTouchApproach('X', 1, probeDist, 'SP_XP', ff, fs),
                ...probeTouchRetract('X', 1, tr),
            ],
        },
        {
            label: 'Returning to start',
            commands: [
                '%SP_DX=SP_HX-posx',
                '%SP_DY=SP_HY-posy',
                `G91 G1 X[SP_DX] Y[SP_DY] F${tr}`,
            ],
        },
        {
            label: 'Probing -X wall',
            commands: [
                ...probeTouchApproach('X', -1, probeDist, 'SP_XM', ff, fs),
                ...probeTouchRetract('X', -1, tr),
            ],
        },
        {
            label: 'Centering X axis',
            commands: [
                '%SP_XC=(SP_XP+SP_XM)/2',
                '%SP_DX=SP_XC-posx',
                '%SP_DY=SP_HY-posy',
                `G91 G1 X[SP_DX] Y[SP_DY] F${tr}`,
            ],
        },
        {
            label: 'Probing +Y wall',
            commands: [
                ...probeTouchApproach('Y', 1, probeDist, 'SP_YP', ff, fs),
                ...probeTouchRetract('Y', 1, tr),
            ],
        },
        {
            label: 'Returning to X center',
            commands: [
                '%SP_DX=SP_XC-posx',
                '%SP_DY=SP_HY-posy',
                `G91 G1 X[SP_DX] Y[SP_DY] F${tr}`,
            ],
        },
        {
            label: 'Probing -Y wall',
            commands: [
                ...probeTouchApproach('Y', -1, probeDist, 'SP_YM', ff, fs),
                ...probeTouchRetract('Y', -1, tr),
            ],
        },
        {
            label: 'Moving to hole center',
            commands: [
                '%SP_YC=(SP_YP+SP_YM)/2',
                '%SP_DX=SP_XC-posx',
                '%SP_DY=SP_YC-posy',
                `G91 G1 X[SP_DX] Y[SP_DY] F${tr}`,
                'G4 P0.1',
                `G10 L20 P${wcsIndex} X0 Y0`,
                // Relative Z lift since no Z WCS was set in hole center probing
                `G91 G1 Z${safeHeight.toFixed(3)} F${tr}`,
            ],
        },
    ];
}

// ── Wizard D: Corner Probe ────────────────────────────────────────────────────

const CORNER_SIGNS: Record<CornerSelection, { x: number; y: number }> = {
    BL: { x: -1, y: -1 },
    TL: { x: -1, y:  1 },
    TR: { x:  1, y:  1 },
    BR: { x:  1, y: -1 },
};

export function generateCornerProbeGCode(params: CornerProbeParams): ProbeTask[] {
    const {
        corner,
        probeFeedrateFast: ff,
        probeFeedrateSlow: fs,
        travelFeedrate: tr,
        bufferDistance: buf,
        xyProbingHeight: xyH,
        wcsIndex,
        safeHeight = 10,
    } = params;

    const signs      = CORNER_SIGNS[corner];
    const probeZDist = buf + 10;
    const probeDist  = buf + 5;
    const probeXDir  = -signs.x;
    const probeYDir  = -signs.y;
    const liftToSafe = (safeHeight - PROBE_RETRACT_TOTAL).toFixed(3);
    const liftFromXY = (safeHeight - xyH).toFixed(3);
    const sinkToXY   = (xyH - safeHeight).toFixed(3);

    return [
        {
            label: 'Spindle/coolant off',
            commands: ['M5', 'M9', 'G21', 'G91'],
        },
        {
            label: 'Probing Z surface',
            commands: [
                ...probeTouchApproach('Z', -1, probeZDist, 'SP_Z', ff, fs),
                `G10 L20 P${wcsIndex} Z0`,
                ...probeTouchRetract('Z', -1, tr),
                `G91 G1 Z${liftToSafe} F${tr}`,
            ],
        },
        {
            label: 'Moving to X edge position',
            commands: [
                `G91 G1 X${(buf * signs.x).toFixed(3)} F${tr}`,
                `G91 G1 Z${sinkToXY} F${tr}`,
            ],
        },
        {
            label: 'Probing X edge',
            commands: [
                ...probeTouchApproach('X', probeXDir, probeDist, 'SP_X_EDGE', ff, fs),
                `G10 L20 P${wcsIndex} X0`,
                ...probeTouchRetract('X', probeXDir, tr),
            ],
        },
        {
            label: 'Moving to Y edge position',
            commands: [
                `G91 G1 Z${liftFromXY} F${tr}`,
                // After X probing the retract left the tool PROBE_RETRACT_TOTAL mm away from
                // the X edge. Move back to the edge so the Y probe is positioned over the stock.
                `G91 G1 X${((PROBE_RETRACT_TOTAL + 5) * probeXDir).toFixed(3)} Y${(buf * signs.y).toFixed(3)} F${tr}`,
                `G91 G1 Z${sinkToXY} F${tr}`,
            ],
        },
        {
            label: 'Probing Y edge',
            commands: [
                ...probeTouchApproach('Y', probeYDir, probeDist, 'SP_Y_EDGE', ff, fs),
                `G10 L20 P${wcsIndex} Y0`,
                ...probeTouchRetract('Y', probeYDir, tr),
            ],
        },
        {
            label: 'Moving to work zero',
            commands: [
                `G91 G1 Z${liftFromXY} F${tr}`,
                `G91 G1 X${(probeXDir * PROBE_RETRACT_TOTAL).toFixed(3)} Y${(probeYDir * PROBE_RETRACT_TOTAL).toFixed(3)} F${tr}`,
            ],
        },
    ];
}

// ── Wizard E: Single Edge Probe ──────────────────────────────────────────────

export function generateSingleEdgeGCode(params: EdgeProbeParams): ProbeTask[] {
    const {
        edge,
        probeFeedrateFast: ff,
        probeFeedrateSlow: fs,
        travelFeedrate: tr,
        bufferDistance: buf,
        wcsIndex,
        safeHeight = 10,
    } = params;

    const edgeMap: Record<EdgeSelection, { axis: string; outDir: number; probeDir: number }> = {
        'X+': { axis: 'X', outDir:  1, probeDir: -1 },
        'X-': { axis: 'X', outDir: -1, probeDir:  1 },
        'Y+': { axis: 'Y', outDir:  1, probeDir: -1 },
        'Y-': { axis: 'Y', outDir: -1, probeDir:  1 },
    };

    const { axis, outDir, probeDir } = edgeMap[edge];

    return [
        {
            label: 'Spindle/coolant off',
            commands: ['M5', 'M9', 'G21', 'G91'],
        },
        {
            label: `Moving to ${edge} edge`,
            commands: [
                `G91 G1 ${axis}${(outDir * buf).toFixed(3)} F${tr}`,
            ],
        },
        {
            label: `Probing ${edge} edge`,
            commands: [
                ...probeTouchApproach(axis, probeDir, buf + 10, `SP_EDGE_${axis}`, ff, fs),
                `G10 L20 P${wcsIndex} ${axis}0`,
                ...probeTouchRetract(axis, probeDir, tr),
            ],
        },
        {
            label: 'Retracting',
            commands: [
                `G91 G1 ${axis}${(outDir * 5).toFixed(3)} F${tr}`,
                `G91 G1 Z${safeHeight.toFixed(3)} F${tr}`,
            ],
        },
    ];
}

// ── Wizard F: Rotation Measurement — 3 points along one side ─────────────────

export function generateRotationGCode(params: RotationProbeParams): ProbeTask[] {
    const {
        stockWidth,
        side,
        probeFeedrateFast: ff,
        probeFeedrateSlow: fs,
        travelFeedrate: tr,
        bufferDistance: buf,
        safeHeight = 10,
    } = params;

    const isTopBottom  = side === 'top' || side === 'bottom';
    const probeAxis    = isTopBottom ? 'Y' : 'X';
    const travelAxis   = isTopBottom ? 'X' : 'Y';
    const orthAxis     = isTopBottom ? 'x' : 'y'; // lowercase for %var capture
    const probeDir     = (side === 'top' || side === 'right') ? 1 : -1;
    const step         = stockWidth / 2;

    // Primary captured var matches probeAxis; also capture orthogonal axis.
    // e.g. top/bottom: probeTouchApproach captures SP_PnY, then we add SP_PnX.
    const [pSuf, oSuf] = isTopBottom ? ['Y', 'X'] : ['X', 'Y'];

    function probePoint(n: number, travelCmds: string[]): string[] {
        return [
            ...travelCmds,
            `G91 G1 ${probeAxis}${(probeDir * buf).toFixed(3)} F${tr}`,
            ...probeTouchApproach(probeAxis, probeDir, buf + 5, `SP_P${n}${pSuf}`, ff, fs),
            `%SP_P${n}${oSuf}=pos${orthAxis}`,
            ...probeTouchRetract(probeAxis, probeDir, tr),
            `G91 G1 ${probeAxis}${(-probeDir * buf).toFixed(3)} F${tr}`,
        ];
    }

    return [
        {
            label: 'Spindle/coolant off',
            commands: ['M5', 'M9', 'G21', 'G91'],
        },
        {
            label: 'Probing point 1',
            commands: probePoint(1, []),
        },
        {
            label: 'Probing point 2',
            commands: probePoint(2, [`G91 G1 ${travelAxis}${step.toFixed(3)} F${tr}`]),
        },
        {
            label: 'Probing point 3',
            commands: probePoint(3, [`G91 G1 ${travelAxis}${step.toFixed(3)} F${tr}`]),
        },
        {
            label: 'Calculating rotation angle',
            commands: [
                '%SP_DX=SP_P3X-SP_P1X',
                '%SP_DY=SP_P3Y-SP_P1Y',
                '%SP_ANGLE=Math.atan2(SP_DY,SP_DX)*180/Math.PI',
            ],
        },
        {
            label: 'Retracting',
            commands: [
                `G91 G1 Z${safeHeight.toFixed(3)} F${tr}`,
            ],
        },
    ];
}
