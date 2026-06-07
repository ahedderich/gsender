import { ProbeTask, StockProbeGCodeParams } from '../definitions';
import { PROBE_RETRACT_TOTAL } from './constants';
import { probeTouchApproach, probeTouchRetract } from './helpers';

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
