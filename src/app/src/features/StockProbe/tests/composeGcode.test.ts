import { composeGcode } from '../gcode/composeGcode';
import { HeightmapData } from '../definitions';

const raw = ['G90', 'G1 X10 Y0 Z-1'].join('\n');

const flatOffset: HeightmapData = {
    shape: 'rectangle', originX: -50, originY: -50, stepX: 100, stepY: 100,
    cols: 2, rows: 2, resolution: 50, z: [2, 2, 2, 2], // constant +2 everywhere
};

const word = (g: string, letter: string): number | undefined => {
    const last = g.split('\n').filter((l) => l.trim()).pop()!;
    const m = last.match(new RegExp(`${letter}\\s*(-?(?:\\d+\\.?\\d*|\\.\\d+))`, 'i'));
    return m ? Number(m[1]) : undefined;
};

describe('composeGcode', () => {
    it('returns the original when no transforms are active', () => {
        expect(composeGcode(raw, {
            rotationApplied: false, appliedRotationAngle: 0,
            heightmapApplied: false, heightmapData: null,
        })).toBe(raw);
    });

    it('applies rotation only (X/Y change, Z untouched)', () => {
        const out = composeGcode(raw, {
            rotationApplied: true, appliedRotationAngle: 90,
            heightmapApplied: false, heightmapData: null,
        });
        expect(word(out, 'X')).toBeCloseTo(0, 4);
        expect(word(out, 'Y')).toBeCloseTo(10, 4);
        expect(word(out, 'Z')).toBeCloseTo(-1, 4);
    });

    it('applies heightmap only (Z change, X/Y untouched)', () => {
        const out = composeGcode(raw, {
            rotationApplied: false, appliedRotationAngle: 0,
            heightmapApplied: true, heightmapData: flatOffset,
        });
        expect(word(out, 'X')).toBeCloseTo(10, 4);
        expect(word(out, 'Z')).toBeCloseTo(-1 + 2, 4);
    });

    it('applies both: rotation in X/Y then heightmap in Z', () => {
        const out = composeGcode(raw, {
            rotationApplied: true, appliedRotationAngle: 90,
            heightmapApplied: true, heightmapData: flatOffset,
        });
        // Rotated X10Y0 → X0Y10, then constant +2 offset applied to Z.
        expect(word(out, 'X')).toBeCloseTo(0, 4);
        expect(word(out, 'Y')).toBeCloseTo(10, 4);
        expect(word(out, 'Z')).toBeCloseTo(-1 + 2, 4);
    });
});
