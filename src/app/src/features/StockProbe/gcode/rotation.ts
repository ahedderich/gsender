import { ProbeStep, RotationProbeParams } from '../definitions';
import { probeTouchApproach, probeTouchRetract } from './helpers';

export function generateRotationGCode(params: RotationProbeParams): ProbeStep[] {
    const {
        measuringLength,
        stockWidth,
        stockLength,
        probingZHeight,
        direction,
        side,
        probeFeedrateFast: ff,
        probeFeedrateSlow: fs,
        travelFeedrate: tr,
        bufferDistance: buf,
        safeHeight = 10,
        rotationEdgeOffset = 15,
    } = params;

    const isTopBottom     = side === 'top' || side === 'bottom';
    const probeAxis       = isTopBottom ? 'Y' : 'X';
    const travelAxis      = isTopBottom ? 'X' : 'Y';

    const edgeSign = (side === 'top' || side === 'right') ? 1 : -1;
    const halfEdge = isTopBottom ? stockLength / 2 : stockWidth / 2;
    const edgePos  = edgeSign * halfEdge;
    const probeDir = direction === 'towards_center' ? -edgeSign : edgeSign;
    const startOnProbeAxis = edgePos - probeDir * buf;

    const step = measuringLength / 2 - rotationEdgeOffset;
    const travelPositions = [-step, 0, step] as const;

    // Moves use G90 absolute WORK coordinates that depend only on geometry (not on captured
    // contacts), so they stay as numeric literals. The contact itself is captured by the
    // step's `capture` key from the grbl `[PRB:...]` report.
    function probePoint(travelPos: number): string[] {
        return [
            `G90 G1 ${probeAxis}${startOnProbeAxis.toFixed(3)} ${travelAxis}${travelPos.toFixed(3)} F${tr}`,
            `G90 G1 Z${probingZHeight.toFixed(3)} F${tr}`,
            'G91',
            ...probeTouchApproach(probeAxis, probeDir, buf + 5, ff, fs),
            ...probeTouchRetract(probeAxis, probeDir, tr),
            `G90 G1 Z${safeHeight.toFixed(3)} F${tr}`,
        ];
    }

    return [
        {
            label: 'Spindle/coolant off',
            commands: ['M5', 'M9', 'G21'],
        },
        { label: 'Probing point 1', capture: 'SP_P1', commands: probePoint(travelPositions[0]) },
        { label: 'Probing point 2', capture: 'SP_P2', commands: probePoint(travelPositions[1]) },
        {
            label: 'Probing point 3',
            capture: 'SP_P3',
            // Angle from the first and last contacts (machine coords; the constant work
            // offset cancels in the difference). CW-positive: a stock rotated CCW reports
            // a negative angle, consistently on every side. Top/bottom spread the points
            // along X (skew shows up in Y); left/right spread along Y (skew shows up in X),
            // so the atan2 arguments differ per side.
            compute: (ctx) => {
                const { SP_P1: p1, SP_P3: p3 } = ctx.probes;
                const dx = p3.x - p1.x;
                const dy = p3.y - p1.y;
                ctx.values.SP_ANGLE = (isTopBottom
                    ? -Math.atan2(dy, dx)
                    : Math.atan2(dx, dy)
                ) * 180 / Math.PI;
            },
            commands: probePoint(travelPositions[2]),
        },
    ];
}
