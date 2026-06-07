import { ProbeTask, EdgeProbeParams, EdgeSelection } from '../definitions';
import { probeTouchApproach, probeTouchRetract } from './helpers';

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
