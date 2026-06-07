import { ProbeTask, CornerProbeParams, CornerSelection } from '../definitions';
import { PROBE_RETRACT_TOTAL } from './constants';
import { probeTouchApproach, probeTouchRetract } from './helpers';

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
