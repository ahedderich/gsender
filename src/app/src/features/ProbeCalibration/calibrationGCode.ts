import { ProbeTask } from '../StockProbe/definitions';

const PROBE_FAST_FEED = 200;   // mm/min
const PROBE_SLOW_FEED = 50;    // mm/min
const PROBE_FAST_DIST = 50;    // mm – max approach distance
const PROBE_RETRACT   = 3;     // mm – pull-back between fast and slow probe
const PROBE_SLOW_DIST = 4;     // mm – slow probe distance
const PROBE_CLEAR     = 6;     // mm – clearance retract after probe

/**
 * Generate a single -X probe sequence for one calibration step.
 * The machine must already be positioned near the probing surface.
 */
export function generateCalibrationProbeTask(stepLabel: string): ProbeTask {
    const commands = [
        'G91',
        `G38.2 X-${PROBE_FAST_DIST.toFixed(3)} F${PROBE_FAST_FEED}`,
        `G1 X${PROBE_RETRACT.toFixed(3)} F${PROBE_FAST_FEED}`,
        `G38.2 X-${(PROBE_RETRACT + 1).toFixed(3)} F${PROBE_SLOW_FEED}`,
        `G1 X${PROBE_CLEAR.toFixed(3)} F${PROBE_FAST_FEED}`,
        'G90',
    ];
    return { label: stepLabel, commands };
}
