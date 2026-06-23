import { ProbeTask } from '../StockProbe/definitions';

const PROBE_FAST_FEED = 200;   // mm/min
const PROBE_SLOW_FEED = 50;    // mm/min
const PROBE_FAST_DIST = 50;    // mm – max approach distance
const PROBE_RETRACT   = 3;     // mm – pull-back between fast and slow probe
const PROBE_SLOW_DIST = 4;     // mm – slow probe distance
const PROBE_CLEAR     = 6;     // mm – clearance retract after probe

const REF_FEED        = PROBE_SLOW_FEED; // slow feed for accurate reference contact
const REF_MARGIN      = 6;     // mm – extra travel beyond nominal radius to guarantee contact

/**
 * Generate a single -X probe sequence for one calibration step.
 * The machine must already be positioned near the probing surface.
 *
 * Used by the rotation (eccentricity) phase: probing -X four times while the
 * probe body is rotated 90° between each measurement reveals the stylus tip's
 * X/Y offset from the body centre.
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

/**
 * Generate a reference probe sequence that measures the probe tip diameter.
 *
 * The machine must already be positioned at the centre of a hole / pocket of a
 * known diameter, at probing depth. The probe touches off the wall in all four
 * lateral directions (+X, -X, +Y, -Y), returning to the exact start centre
 * (via G90 absolute) between each probe so that later probes are not biased by
 * the contact offset of earlier ones.
 *
 * Each `G38.2` emits one `[PRB:...]` line, so the four readings arrive in the
 * order [+X, -X, +Y, -Y] — see {@link REFERENCE_PROBE_ORDER}.
 */
export function generateReferenceProbeTask(
    knownDiameter: number,
    centre: { x: number; y: number },
): ProbeTask {
    const radius = Math.max(knownDiameter, 0) / 2;
    const reach  = (radius + REF_MARGIN).toFixed(3);
    const cx     = centre.x.toFixed(3);
    const cy     = centre.y.toFixed(3);
    const f      = REF_FEED;
    const fr     = PROBE_FAST_FEED;

    const commands = [
        'G91',
        `G38.2 X${reach} F${f}`,           // +X probe
        `G90 G1 X${cx} Y${cy} F${fr}`,     // return to absolute centre
        'G91',
        `G38.2 X-${reach} F${f}`,          // -X probe
        `G90 G1 X${cx} Y${cy} F${fr}`,     // return to absolute centre
        'G91',
        `G38.2 Y${reach} F${f}`,           // +Y probe
        `G90 G1 X${cx} Y${cy} F${fr}`,     // return to absolute centre
        'G91',
        `G38.2 Y-${reach} F${f}`,          // -Y probe
        `G90 G1 X${cx} Y${cy} F${fr}`,     // return to absolute centre
    ];
    return { label: 'Tip diameter reference', commands };
}

/** Order in which {@link generateReferenceProbeTask} emits its four PRB readings. */
export const REFERENCE_PROBE_ORDER = ['X+', 'X-', 'Y+', 'Y-'] as const;

/** Machine coordinates of the four reference wall contacts (mm). */
export interface ReferenceContacts {
    xPlus: number;   // machine X at the +X wall contact
    xMinus: number;  // machine X at the -X wall contact
    yPlus: number;   // machine Y at the +Y wall contact
    yMinus: number;  // machine Y at the -Y wall contact
}

export interface TipCalibrationResult {
    /** Calibrated tip diameter (mm) — average of the X and Y derived values. */
    tipDiameter: number;
    tipDiameterX: number;  // derived from the X span
    tipDiameterY: number;  // derived from the Y span
    spanX: number;         // measured +X→-X contact span
    spanY: number;         // measured +Y→-Y contact span
    /** Spread between the four centre-to-wall distances (mm). Lower = rounder/more centred. */
    consistency: number;
    knownDiameter: number;
    timestamp: number;
}

/**
 * Derive the probe tip diameter from a known reference hole.
 *
 * For an internal feature the controlled point stops one tip radius short of
 * each wall, so the measured span is undersized by exactly one tip diameter:
 *
 *     measuredSpan = knownDiameter − tipDiameter   ⇒   tipDiameter = knownDiameter − measuredSpan
 *
 * The four centre-to-wall distances should all equal (knownRadius − tipRadius)
 * when the tip is round and the probe was centred; their spread is reported as a
 * consistency metric so the operator can judge the calibration quality.
 */
export function computeTipDiameter(
    knownDiameter: number,
    c: ReferenceContacts,
): TipCalibrationResult {
    const spanX = c.xPlus - c.xMinus;
    const spanY = c.yPlus - c.yMinus;

    const tipDiameterX = knownDiameter - spanX;
    const tipDiameterY = knownDiameter - spanY;

    const centreX = (c.xPlus + c.xMinus) / 2;
    const centreY = (c.yPlus + c.yMinus) / 2;
    const distances = [
        c.xPlus - centreX,
        centreX - c.xMinus,
        c.yPlus - centreY,
        centreY - c.yMinus,
    ];
    const consistency = Math.max(...distances) - Math.min(...distances);

    return {
        tipDiameter: (tipDiameterX + tipDiameterY) / 2,
        tipDiameterX,
        tipDiameterY,
        spanX,
        spanY,
        consistency,
        knownDiameter,
        timestamp: Date.now(),
    };
}
