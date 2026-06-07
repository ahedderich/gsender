import { ProbeTask, RotationProbeParams } from '../definitions';
import { probeTouchApproach, probeTouchRetract } from './helpers';

export function generateRotationGCode(params: RotationProbeParams): ProbeTask[] {
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
    const travelAxisLower = travelAxis.toLowerCase();

    const edgeSign = (side === 'top' || side === 'right') ? 1 : -1;
    const halfEdge = isTopBottom ? stockLength / 2 : stockWidth / 2;
    const edgePos  = edgeSign * halfEdge;
    const probeDir = direction === 'towards_center' ? -edgeSign : edgeSign;
    const startOnProbeAxis = edgePos - probeDir * buf;

    const step = measuringLength / 2 - rotationEdgeOffset;
    const travelPositions = [-step, 0, step] as const;

    function probePoint(n: number, travelPos: number): string[] {
        return [
            `G90 G1 ${probeAxis}${startOnProbeAxis.toFixed(3)} ${travelAxis}${travelPos.toFixed(3)} F${tr}`,
            `G90 G1 Z${probingZHeight.toFixed(3)} F${tr}`,
            'G91',
            ...probeTouchApproach(probeAxis, probeDir, buf + 5, `SP_P${n}${probeAxis}`, ff, fs),
            `%global.SP_P${n}${travelAxis}=pos${travelAxisLower}`,
            ...probeTouchRetract(probeAxis, probeDir, tr),
            `G90 G1 Z${safeHeight.toFixed(3)} F${tr}`,
        ];
    }

    return [
        {
            label: 'Spindle/coolant off',
            commands: ['M5', 'M9', 'G21'],
        },
        {
            label: 'Probing point 1',
            commands: probePoint(1, travelPositions[0]),
        },
        {
            label: 'Probing point 2',
            commands: probePoint(2, travelPositions[1]),
        },
        {
            label: 'Probing point 3',
            commands: probePoint(3, travelPositions[2]),
        },
        {
            label: 'Calculating rotation angle',
            commands: [
                '%global.SP_DX=global.SP_P3X-global.SP_P1X',
                '%global.SP_DY=global.SP_P3Y-global.SP_P1Y',
                '%global.SP_ANGLE=Math.atan2(global.SP_DY,global.SP_DX)*180/Math.PI',
                '(MSG, SP_ANGLE=[global.SP_ANGLE])',
            ],
        },
    ];
}
