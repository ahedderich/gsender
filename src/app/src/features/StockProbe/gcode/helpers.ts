import {
    PROBE_FAST,
    PROBE_FAST_RETRACT,
    PROBE_SLOW,
    PROBE_RELEASE_SPD,
    PROBE_RELEASE_DIST,
    PROBE_CLEARANCE,
} from './constants';
import { ProbeContext } from '../definitions';

/**
 * 4-command approach: fast probe → back off → slow probe.
 * Ends with tool AT the surface. Insert G10 L20 after this if needed,
 * then call probeTouchRetract to lift clear.
 * Requires G91 mode to be active.
 *
 * The contact coordinate is NOT captured here — grbl emits a `[PRB:...]` report for the
 * slow probe, which WizardShell records via the owning step's `capture` key.
 */
export function probeTouchApproach(
    axis: string,
    direction: number,
    distance: number,
    feedrateFast = PROBE_FAST,
    feedrateSlow = PROBE_SLOW,
): string[] {
    const s  = direction > 0 ? '' : '-';
    const rs = direction > 0 ? '-' : '';
    return [
        `G38.2 ${axis}${s}${distance.toFixed(3)} F${feedrateFast}`,
        `G91 G1 ${axis}${rs}${PROBE_FAST_RETRACT.toFixed(3)} F200`,
        `G38.2 ${axis}${s}${(PROBE_FAST_RETRACT + 1).toFixed(3)} F${feedrateSlow}`,
    ];
}

/**
 * 2-command retract: controlled slow release then clearance.
 * Call after probeTouchApproach (and optional G10 L20).
 * Leaves tool PROBE_RETRACT_TOTAL mm away from surface.
 */
export function probeTouchRetract(
    axis: string,
    direction: number,
    travelFeedrate: number,
): string[] {
    const rs = direction > 0 ? '-' : '';
    return [
        `G91 G1 ${axis}${rs}${PROBE_RELEASE_DIST.toFixed(3)} F${PROBE_RELEASE_SPD}`,
        `G91 G1 ${axis}${rs}${PROBE_CLEARANCE.toFixed(3)} F${travelFeedrate}`,
    ];
}

/**
 * 2D diagonal approach for round-stock probing.
 * outCos/outSin are the unit-vector components of the OUTWARD direction from center.
 * Probes INWARD toward center. The `[PRB:...]` contact is captured by the step.
 * Requires G91 mode to be active.
 */
export function probeTouchApproachXY(
    outCos: number,
    outSin: number,
    distance: number,
    feedrateFast = PROBE_FAST,
    feedrateSlow = PROBE_SLOW,
): string[] {
    const ix = (d: number) => (-outCos * d).toFixed(4);
    const iy = (d: number) => (-outSin * d).toFixed(4);
    const ox = (d: number) => ( outCos * d).toFixed(4);
    const oy = (d: number) => ( outSin * d).toFixed(4);
    return [
        `G38.2 X${ix(distance)} Y${iy(distance)} F${feedrateFast}`,
        `G91 G1 X${ox(PROBE_FAST_RETRACT)} Y${oy(PROBE_FAST_RETRACT)} F200`,
        `G38.2 X${ix(PROBE_FAST_RETRACT + 1)} Y${iy(PROBE_FAST_RETRACT + 1)} F${feedrateSlow}`,
    ];
}

/** 2-command retract for diagonal probing — moves in the outward direction. */
export function probeTouchRetractXY(
    outCos: number,
    outSin: number,
    travelFeedrate: number,
): string[] {
    const ox = (d: number) => ( outCos * d).toFixed(4);
    const oy = (d: number) => ( outSin * d).toFixed(4);
    return [
        `G91 G1 X${ox(PROBE_RELEASE_DIST)} Y${oy(PROBE_RELEASE_DIST)} F${PROBE_RELEASE_SPD}`,
        `G91 G1 X${ox(PROBE_CLEARANCE)} Y${oy(PROBE_CLEARANCE)} F${travelFeedrate}`,
    ];
}

/**
 * Build a G91 relative move from the current machine position (`ctx.current`) to the
 * given absolute machine target. Because the move is a delta, the result is identical in
 * any coordinate system — and relative moves are what the controller (and simulator)
 * already support, so no G53 is needed. Pass `null` for an axis to leave it unchanged.
 */
export function moveTo(
    ctx: ProbeContext,
    targetX: number | null,
    targetY: number | null,
    feedrate: number,
): string[] {
    const parts: string[] = [];
    if (targetX !== null) parts.push(`X${(targetX - ctx.current.x).toFixed(3)}`);
    if (targetY !== null) parts.push(`Y${(targetY - ctx.current.y).toFixed(3)}`);
    if (parts.length === 0) return [];
    return [`G91 G1 ${parts.join(' ')} F${feedrate}`];
}
