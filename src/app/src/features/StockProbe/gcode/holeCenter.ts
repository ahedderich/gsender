import { ProbeStep, RoundProbeParams } from '../definitions';
import { probeTouchApproach, probeTouchRetract, moveTo } from './helpers';

export function generateHoleCenterGCode(params: RoundProbeParams): ProbeStep[] {
    const {
        stockDiameter,
        probeFeedrateFast: ff,
        probeFeedrateSlow: fs,
        travelFeedrate: tr,
        wcsIndex,
        safeHeight = 10,
        tipDiameter = 2,
    } = params;

    const holeRadius = stockDiameter / 2;
    const probeDist  = holeRadius + 5;

    return [
        {
            label: 'Spindle/coolant off',
            commands: ['M5', 'M9', 'G21', 'G91'],
        },
        {
            label: 'Probing +X wall',
            capture: 'SP_XP',
            commands: [
                ...probeTouchApproach('X', 1, probeDist, ff, fs),
                ...probeTouchRetract('X', 1, tr),
            ],
        },
        {
            label: 'Returning to start',
            commands: (ctx) => moveTo(ctx, ctx.start.x, ctx.start.y, tr),
        },
        {
            label: 'Probing -X wall',
            capture: 'SP_XM',
            // Both X walls known — compute X centre client-side.
            compute: (ctx) => {
                ctx.values.SP_XC = (ctx.probes.SP_XP.x + ctx.probes.SP_XM.x) / 2;
            },
            commands: [
                ...probeTouchApproach('X', -1, probeDist, ff, fs),
                ...probeTouchRetract('X', -1, tr),
            ],
        },
        {
            label: 'Centering X axis',
            commands: (ctx) => moveTo(ctx, ctx.values.SP_XC, ctx.start.y, tr),
        },
        {
            label: 'Probing +Y wall',
            capture: 'SP_YP',
            commands: [
                ...probeTouchApproach('Y', 1, probeDist, ff, fs),
                ...probeTouchRetract('Y', 1, tr),
            ],
        },
        {
            label: 'Returning to X center',
            commands: (ctx) => moveTo(ctx, ctx.values.SP_XC, ctx.start.y, tr),
        },
        {
            label: 'Probing -Y wall',
            capture: 'SP_YM',
            // Both Y walls known — compute Y centre and hole diameter client-side.
            // For an internal feature the tool centre stops one tip radius short of each
            // wall, so the measured span is undersized by one tip diameter; add it back.
            compute: (ctx) => {
                ctx.values.SP_YC            = (ctx.probes.SP_YP.y + ctx.probes.SP_YM.y) / 2;
                ctx.values.SP_HOLE_DIAMETER = (ctx.probes.SP_XP.x - ctx.probes.SP_XM.x) + tipDiameter;
            },
            commands: [
                ...probeTouchApproach('Y', -1, probeDist, ff, fs),
                ...probeTouchRetract('Y', -1, tr),
            ],
        },
        {
            label: 'Moving to hole center',
            commands: (ctx) => [
                ...moveTo(ctx, ctx.values.SP_XC, ctx.values.SP_YC, tr),
                'G4 P0.1',
                `G10 L20 P${wcsIndex} X0 Y0`,
                `G91 G1 Z${safeHeight.toFixed(3)} F${tr}`,
            ],
        },
    ];
}
