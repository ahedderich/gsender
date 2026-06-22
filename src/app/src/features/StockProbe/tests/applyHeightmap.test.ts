import { applyHeightmapToGcode } from '../gcode/applyHeightmap';
import { HeightmapData } from '../definitions';

const flat: HeightmapData = {
    shape: 'rectangle', originX: 0, originY: 0, stepX: 10, stepY: 10,
    cols: 2, rows: 2, resolution: 10, z: [0, 0, 0, 0],
};

// Linear ramp in X: z grows 0 → 4 across x 0..10 (independent of y).
const rampX: HeightmapData = {
    shape: 'rectangle', originX: 0, originY: 0, stepX: 10, stepY: 10,
    cols: 2, rows: 2, resolution: 5, z: [0, 4, 0, 4],
};

const lines = (g: string) => g.split('\n').filter((l) => l.trim().length);
const zOf = (line: string) => {
    const m = line.match(/Z\s*(-?(?:\d+\.?\d*|\.\d+))/i);
    return m ? Number(m[1]) : undefined;
};

describe('applyHeightmapToGcode', () => {
    it('leaves Z unchanged for a flat (zero) heightmap, even when subdividing', () => {
        const out = applyHeightmapToGcode('G1 X0 Y0 Z-1\nG1 X10 Y0 Z-1', flat);
        for (const l of lines(out)) {
            const z = zOf(l);
            if (z !== undefined) expect(z).toBeCloseTo(-1, 4);
        }
    });

    it('subdivides a move into ceil(dist/resolution) segments', () => {
        // 10mm move, resolution 5 → 2 segments.
        const out = applyHeightmapToGcode('G0 X0 Y0 Z5\nG1 X10 Y0 Z-1', rampX);
        const moveLines = lines(out).filter((l) => /^G1 /.test(l));
        expect(moveLines.length).toBe(2);
    });

    it('offsets Z by the interpolated surface along a ramp', () => {
        // Move from x0→x10 at commanded Z-1; ramp adds 0..4. Endpoint x10 → +4 → Z3.
        const out = applyHeightmapToGcode('G0 X0 Y0 Z-1\nG1 X10 Y0 Z-1', rampX);
        const last = lines(out).pop()!;
        expect(zOf(last)).toBeCloseTo(-1 + 4, 4);
        // Midpoint segment (x5) → +2 → Z1.
        const mid = lines(out).find((l) => /X5\b/.test(l));
        expect(mid && zOf(mid)).toBeCloseTo(-1 + 2, 4);
    });

    it('offsets a plunge (Z-only) line in place', () => {
        // Position at x10 then plunge: surface there is +4.
        const out = applyHeightmapToGcode('G0 X10 Y0\nG1 Z-2', rampX);
        const plunge = lines(out).find((l) => /^G1 Z/.test(l));
        expect(plunge && zOf(plunge)).toBeCloseTo(-2 + 4, 4);
    });

    it('passes through non-motion lines and comments', () => {
        const src = '; header\nM3 S1000\nG21';
        expect(applyHeightmapToGcode(src, rampX)).toBe(src);
    });

    it('passes incremental (G91) moves through unchanged', () => {
        const src = 'G91\nG1 X10 Y0 Z-1';
        expect(applyHeightmapToGcode(src, rampX)).toBe(src);
    });
});
