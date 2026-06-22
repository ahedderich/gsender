import { ProbePoint } from './definitions';

/**
 * Parse a grbl probe report — `[PRB:x,y,z:result]` — into a machine-coordinate point.
 * Returns null for non-PRB lines and for failed probes (trailing result `0`).
 */
export function parseProbeReport(line: string): ProbePoint | null {
    if (typeof line !== 'string') return null;
    const m = /\[PRB:(-?\d+\.\d+),(-?\d+\.\d+),(-?\d+\.\d+):(\d)\]/.exec(line.trim());
    if (!m || m[4] === '0') return null;
    return { x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) };
}
