import { ProbeStep } from '../definitions';
import { probeTouchApproach, probeTouchRetract, moveTo } from './helpers';
import { GridLayout } from './heightmap';

export interface HeightmapProbeParams {
    safeTravel: number;       // mm above the surface (relative to start Z) for travel
    probingHeight: number;    // mm above the surface to begin the probe descent
    maxDistance: number;      // mm max downward probe travel
    probeFeedrateFast: number;
    probeFeedrateSlow: number;
    travelFeedrate: number;
}

/** Stable capture key for grid point index `i`. */
export const hmCaptureKey = (i: number) => `HM_${i}`;
/** Stable value key (probed machine Z) for grid point index `i`. */
export const hmValueKey = (i: number) => `HMZ_${i}`;

/**
 * Build the probe routine for a heightmap grid. The tool must start at work zero
 * (the stock centre / surface origin), matching the rest of StockProbe. All moves
 * are relative to the start position, so heights are expressed relative to `start.z`
 * (the surface at the origin). Each grid point is one step: lift to safe travel,
 * move to the point, drop to the probing height, probe Z, retract.
 */
export function generateHeightmapGCode(grid: GridLayout, params: HeightmapProbeParams): ProbeStep[] {
    const { safeTravel, probingHeight, maxDistance,
        probeFeedrateFast: ff, probeFeedrateSlow: fs, travelFeedrate: tr } = params;

    const steps: ProbeStep[] = [
        { label: 'Spindle/coolant off', commands: ['M5', 'M9', 'G21', 'G91'] },
    ];

    const probed = grid.points.filter((p) => p.inside);
    probed.forEach((p, idx) => {
        const i = p.row * grid.cols + p.col;
        steps.push({
            label: `Probing point ${idx + 1} of ${probed.length} (r${p.row} c${p.col})`,
            capture: hmCaptureKey(i),
            compute: (ctx) => {
                const z = ctx.probes[hmCaptureKey(i)]?.z;
                ctx.values[hmValueKey(i)] = typeof z === 'number' ? z : NaN;
            },
            commands: (ctx) => [
                // Lift to safe travel height above the surface origin.
                `G91 G1 Z${(ctx.start.z + safeTravel - ctx.current.z).toFixed(3)} F${tr}`,
                // Travel to the grid point.
                ...moveTo(ctx, ctx.start.x + p.x, ctx.start.y + p.y, tr),
                // Drop to the probing start height, then probe down.
                `G91 G1 Z${(probingHeight - safeTravel).toFixed(3)} F${tr}`,
                ...probeTouchApproach('Z', -1, maxDistance, ff, fs),
                ...probeTouchRetract('Z', -1, tr),
            ],
        });
    });

    // Final lift back to safe travel height.
    steps.push({
        label: 'Retracting to safe height',
        commands: (ctx) => [`G91 G1 Z${(ctx.start.z + safeTravel - ctx.current.z).toFixed(3)} F${tr}`],
    });

    return steps;
}
