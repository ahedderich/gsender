import { HeightmapData } from '../definitions';
import { rotateGcodeXY } from './rotateGcode';
import { applyHeightmapToGcode } from './applyHeightmap';

export interface TransformState {
    rotationApplied: boolean;
    appliedRotationAngle: number;   // CCW degrees actually applied
    heightmapApplied: boolean;
    heightmapData: HeightmapData | null;
}

/**
 * Rebuild the running g-code from the pristine original by composing the active
 * transforms. Order is fixed: rotation (X/Y) first, then heightmap (Z) — the
 * heightmap samples the already-rotated coordinates, which is where the tool
 * actually travels. This makes rotation and heightmap independent and order-stable
 * so they never conflict.
 */
export function composeGcode(rawContent: string, t: TransformState): string {
    let g = rawContent;
    if (t.rotationApplied) {
        g = rotateGcodeXY(g, t.appliedRotationAngle);
    }
    if (t.heightmapApplied && t.heightmapData) {
        g = applyHeightmapToGcode(g, t.heightmapData);
    }
    return g;
}
