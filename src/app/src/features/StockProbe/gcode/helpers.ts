import {
    PROBE_FAST,
    PROBE_FAST_RETRACT,
    PROBE_SLOW,
    PROBE_RELEASE_SPD,
    PROBE_RELEASE_DIST,
    PROBE_CLEARANCE,
} from './constants';

/**
 * 4-command approach: fast probe → back off → slow probe → capture var.
 * Ends with tool AT the surface. Insert G10 L20 after this if needed,
 * then call probeTouchRetract to lift clear.
 * Requires G91 mode to be active.
 */
export function probeTouchApproach(
    axis: string,
    direction: number,
    distance: number,
    varName: string,
    feedrateFast = PROBE_FAST,
    feedrateSlow = PROBE_SLOW,
): string[] {
    const s  = direction > 0 ? '' : '-';
    const rs = direction > 0 ? '-' : '';
    return [
        `G38.2 ${axis}${s}${distance.toFixed(3)} F${feedrateFast}`,
        `G91 G1 ${axis}${rs}${PROBE_FAST_RETRACT.toFixed(3)} F200`,
        `G38.2 ${axis}${s}${(PROBE_FAST_RETRACT + 1).toFixed(3)} F${feedrateSlow}`,
        `%global.${varName}=pos${axis.toLowerCase()}`,
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
 * Probes INWARD toward center.
 * Requires G91 mode to be active.
 */
export function probeTouchApproachXY(
    outCos: number,
    outSin: number,
    distance: number,
    xVarName: string,
    yVarName: string,
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
        `%global.${xVarName}=posx`,
        `%global.${yVarName}=posy`,
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
