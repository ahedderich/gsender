import { ProbeStep, EdgeProbeParams, EdgeSelection } from '../definitions';
import { probeTouchApproach, probeTouchRetract } from './helpers';

export function generateSingleEdgeGCode(params: EdgeProbeParams): ProbeStep[] {
    const {
        edge,
        probeFeedrateFast: ff,
        probeFeedrateSlow: fs,
        travelFeedrate: tr,
        bufferDistance: buf,
        wcsIndex,
        safeHeight = 10,
        tipDiameter = 2,
    } = params;

    const edgeMap: Record<EdgeSelection, { axis: string; outDir: number; probeDir: number }> = {
        'X+': { axis: 'X', outDir:  1, probeDir: -1 },
        'X-': { axis: 'X', outDir: -1, probeDir:  1 },
        'Y+': { axis: 'Y', outDir:  1, probeDir: -1 },
        'Y-': { axis: 'Y', outDir: -1, probeDir:  1 },
    };

    const { axis, outDir, probeDir } = edgeMap[edge];

    // The tool centre stops one tip radius shy of the edge (on the approach side), so set
    // the work zero to that offset — making the true edge read 0.
    const edgeZero = (-probeDir * tipDiameter / 2).toFixed(3);

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
                ...probeTouchApproach(axis, probeDir, buf + 10, ff, fs),
                `G10 L20 P${wcsIndex} ${axis}${edgeZero}`,
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
