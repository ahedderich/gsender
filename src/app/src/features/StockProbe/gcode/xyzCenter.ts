import { ProbeStep, RectProbeParams, RoundProbeParams } from '../definitions';
import { PROBE_RETRACT_TOTAL } from './constants';
import {
    probeTouchApproach,
    probeTouchRetract,
    probeTouchApproachXY,
    probeTouchRetractXY,
    moveTo,
} from './helpers';

export function generateXYZCenterRectGCode(params: RectProbeParams): ProbeStep[] {
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
        tipDiameter = 2,
    } = params;

    const halfW      = stockWidth  / 2;
    const halfL      = stockLength / 2;
    const probeZDist = buf + 10;
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
                ...probeTouchApproach('Z', -1, probeZDist, ff, fs),
                `G10 L20 P${wcsIndex} Z0`,
                ...probeTouchRetract('Z', -1, tr),
                `G91 G1 Z${liftToSafe} F${tr}`,
            ],
        },
        {
            label: 'Moving to probing position left',
            commands: (ctx) => [
                ...moveTo(ctx, ctx.start.x - (halfW + buf), null, tr),
                `G91 G1 Z${sinkToXY} F${tr}`,
            ],
        },
        {
            label: 'Probing left side',
            capture: 'SP_X_MINUS',
            commands: [
                ...probeTouchApproach('X', 1, halfW + buf + 5, ff, fs),
                ...probeTouchRetract('X', 1, tr),
            ],
        },
        {
            label: 'Moving to probing position right',
            commands: (ctx) => [
                `G91 G1 Z${liftFromXY} F${tr}`,
                ...moveTo(ctx, ctx.start.x + (halfW + buf), null, tr),
                `G91 G1 Z${sinkToXY} F${tr}`,
            ],
        },
        {
            label: 'Probing right side',
            capture: 'SP_X_PLUS',
            // Both X contacts are now known — compute X centre and width client-side.
            // Contacts are tool-centre positions, so the measured span overshoots the true
            // width by one tip diameter (½ tip at each side); subtract it. The centre is
            // unaffected (the two tip offsets cancel).
            compute: (ctx) => {
                ctx.values.SP_X_CENTER = (ctx.probes.SP_X_MINUS.x + ctx.probes.SP_X_PLUS.x) / 2;
                ctx.values.SP_WIDTH    = (ctx.probes.SP_X_PLUS.x - ctx.probes.SP_X_MINUS.x) - tipDiameter;
            },
            commands: [
                ...probeTouchApproach('X', -1, halfW + buf + 5, ff, fs),
                ...probeTouchRetract('X', -1, tr),
            ],
        },
        {
            label: 'Moving to probing position top',
            commands: (ctx) => [
                `G91 G1 Z${liftFromXY} F${tr}`,
                ...moveTo(ctx, ctx.values.SP_X_CENTER, ctx.start.y + (halfL + buf), tr),
                `G91 G1 Z${sinkToXY} F${tr}`,
            ],
        },
        {
            label: 'Probing top side',
            capture: 'SP_Y_PLUS',
            commands: [
                ...probeTouchApproach('Y', -1, halfL + buf + 5, ff, fs),
                ...probeTouchRetract('Y', -1, tr),
            ],
        },
        {
            label: 'Moving to probing position bottom',
            commands: (ctx) => [
                `G91 G1 Z${liftFromXY} F${tr}`,
                ...moveTo(ctx, ctx.values.SP_X_CENTER, ctx.start.y - (halfL + buf), tr),
                `G91 G1 Z${sinkToXY} F${tr}`,
            ],
        },
        {
            label: 'Probing bottom side',
            capture: 'SP_Y_MINUS',
            // Both Y contacts are now known — compute Y centre and length client-side.
            compute: (ctx) => {
                ctx.values.SP_Y_CENTER = (ctx.probes.SP_Y_MINUS.y + ctx.probes.SP_Y_PLUS.y) / 2;
                ctx.values.SP_LENGTH   = (ctx.probes.SP_Y_PLUS.y - ctx.probes.SP_Y_MINUS.y) - tipDiameter;
            },
            commands: [
                ...probeTouchApproach('Y', 1, halfL + buf + 5, ff, fs),
                ...probeTouchRetract('Y', 1, tr),
            ],
        },
        {
            label: 'Moving to work zero',
            commands: (ctx) => [
                `G91 G1 Z${liftFromXY} F${tr}`,
                ...moveTo(ctx, ctx.values.SP_X_CENTER, ctx.values.SP_Y_CENTER, tr),
                'G4 P0.1',
                `G10 L20 P${wcsIndex} X0 Y0`,
            ],
        },
    ];
}

export function generateXYZCenterRoundGCode(params: RoundProbeParams): ProbeStep[] {
    const {
        stockDiameter,
        probeFeedrateFast: ff,
        probeFeedrateSlow: fs,
        travelFeedrate: tr,
        bufferDistance: buf,
        xyProbingHeight: xyH,
        wcsIndex,
        safeHeight = 10,
        tipDiameter = 2,
    } = params;

    const probeRadius = stockDiameter / 2 + buf;
    const probeZDist  = buf + 10;
    const liftToSafe  = (safeHeight - PROBE_RETRACT_TOTAL).toFixed(3);
    const liftFromXY  = (safeHeight - xyH).toFixed(3);
    const sinkToXY    = (xyH - safeHeight).toFixed(3);

    const angles = [0, 120, 240].map((a) => (a * Math.PI) / 180);
    const dirs   = angles.map((a) => ({ cos: Math.cos(a), sin: Math.sin(a) }));

    const moveToPoint = (i: number, lift: boolean): ProbeStep['commands'] => (ctx) => [
        ...(lift ? [`G91 G1 Z${liftFromXY} F${tr}`] : []),
        ...moveTo(
            ctx,
            ctx.start.x + dirs[i].cos * probeRadius,
            ctx.start.y + dirs[i].sin * probeRadius,
            tr,
        ),
        `G91 G1 Z${sinkToXY} F${tr}`,
    ];

    return [
        {
            label: 'Spindle/coolant off',
            commands: ['M5', 'M9', 'G21', 'G91'],
        },
        {
            label: 'Probing Z surface',
            commands: [
                ...probeTouchApproach('Z', -1, probeZDist, ff, fs),
                `G10 L20 P${wcsIndex} Z0`,
                ...probeTouchRetract('Z', -1, tr),
                `G91 G1 Z${liftToSafe} F${tr}`,
            ],
        },
        { label: 'Moving to probing position 1 (0°)',   commands: moveToPoint(0, false) },
        {
            label: 'Probing point 1 (0°)',
            capture: 'SP_P1',
            commands: [
                ...probeTouchApproachXY(dirs[0].cos, dirs[0].sin, probeRadius + 5, ff, fs),
                ...probeTouchRetractXY(dirs[0].cos, dirs[0].sin, tr),
            ],
        },
        { label: 'Moving to probing position 2 (120°)', commands: moveToPoint(1, true) },
        {
            label: 'Probing point 2 (120°)',
            capture: 'SP_P2',
            commands: [
                ...probeTouchApproachXY(dirs[1].cos, dirs[1].sin, probeRadius + 5, ff, fs),
                ...probeTouchRetractXY(dirs[1].cos, dirs[1].sin, tr),
            ],
        },
        { label: 'Moving to probing position 3 (240°)', commands: moveToPoint(2, true) },
        {
            label: 'Probing point 3 (240°)',
            capture: 'SP_P3',
            // All three contacts known — compute the circumcentre + diameter client-side.
            compute: (ctx) => {
                const { SP_P1: p1, SP_P2: p2, SP_P3: p3 } = ctx.probes;
                const ax = p2.x - p1.x, ay = p2.y - p1.y;
                const bx = p3.x - p1.x, by = p3.y - p1.y;
                const d  = 2 * (ax * by - ay * bx);
                const ux = (by * (ax * ax + ay * ay) - ay * (bx * bx + by * by)) / d;
                const uy = (ax * (bx * bx + by * by) - bx * (ax * ax + ay * ay)) / d;
                ctx.values.SP_CX       = p1.x + ux;
                ctx.values.SP_CY       = p1.y + uy;
                ctx.values.SP_RADIUS   = Math.sqrt(ux * ux + uy * uy);
                // Each contact sits one tip radius outside the true surface, so the fitted
                // circle is oversized by one tip diameter across. Centre is unaffected.
                ctx.values.SP_DIAMETER = 2 * ctx.values.SP_RADIUS - tipDiameter;
            },
            commands: [
                ...probeTouchApproachXY(dirs[2].cos, dirs[2].sin, probeRadius + 5, ff, fs),
                ...probeTouchRetractXY(dirs[2].cos, dirs[2].sin, tr),
            ],
        },
        {
            label: 'Moving to work zero',
            commands: (ctx) => [
                `G91 G1 Z${liftFromXY} F${tr}`,
                ...moveTo(ctx, ctx.values.SP_CX, ctx.values.SP_CY, tr),
                'G4 P0.1',
                `G10 L20 P${wcsIndex} X0 Y0`,
            ],
        },
    ];
}
