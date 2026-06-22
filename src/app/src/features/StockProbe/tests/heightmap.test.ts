import { generateHeightmapGrid, sampleHeightmap } from '../gcode/heightmap';
import { DEFAULT_SETTINGS, HeightmapData, StockProbeSettings } from '../definitions';

const settings = (over: Partial<StockProbeSettings>): StockProbeSettings => ({
    ...DEFAULT_SETTINGS, ...over,
});

describe('generateHeightmapGrid', () => {
    it('builds an inset rectangular grid centered on the origin', () => {
        // 100×60 stock, 5mm inset → effective 90×50, 10mm resolution.
        const g = generateHeightmapGrid(settings({
            stockType: 'rectangle', stockWidth: 100, stockLength: 60,
            heightmapResolution: 10, heightmapEdgeInset: 5,
        }));
        expect(g.cols).toBe(10); // round(90/10)+1
        expect(g.rows).toBe(6);  // round(50/10)+1
        expect(g.points.length).toBe(60);
        expect(g.originX).toBeCloseTo(-45, 4);
        expect(g.originY).toBeCloseTo(-25, 4);
        expect(g.stepX).toBeCloseTo(90 / 9, 4);
        expect(g.stepY).toBeCloseTo(50 / 5, 4);
        expect(g.points.every((p) => p.inside)).toBe(true);
    });

    it('clips a round grid to the inset radius', () => {
        const g = generateHeightmapGrid(settings({
            stockType: 'round', stockDiameter: 100,
            heightmapResolution: 10, heightmapEdgeInset: 5,
        }));
        const r = 45;
        // Corner points lie outside the circle → not probed.
        const corner = g.points.find((p) => p.col === 0 && p.row === 0)!;
        expect(corner.inside).toBe(false);
        // Centre point is inside.
        const inside = g.points.some((p) => p.inside);
        expect(inside).toBe(true);
        // Every "inside" point is actually within the radius.
        for (const p of g.points.filter((q) => q.inside)) {
            expect(p.x * p.x + p.y * p.y).toBeLessThanOrEqual(r * r + 1e-3);
        }
    });
});

describe('sampleHeightmap', () => {
    // 2×2 grid spanning 0..10 in both axes with a simple ramp.
    const data: HeightmapData = {
        shape: 'rectangle', originX: 0, originY: 0, stepX: 10, stepY: 10,
        cols: 2, rows: 2, resolution: 10,
        z: [0, 2, 4, 6], // row-major: (0,0)=0 (10,0)=2 (0,10)=4 (10,10)=6
    };

    it('returns exact corner values', () => {
        expect(sampleHeightmap(data, 0, 0)).toBeCloseTo(0, 6);
        expect(sampleHeightmap(data, 10, 0)).toBeCloseTo(2, 6);
        expect(sampleHeightmap(data, 0, 10)).toBeCloseTo(4, 6);
        expect(sampleHeightmap(data, 10, 10)).toBeCloseTo(6, 6);
    });

    it('bilinearly interpolates the centre', () => {
        expect(sampleHeightmap(data, 5, 5)).toBeCloseTo((0 + 2 + 4 + 6) / 4, 6);
    });

    it('clamps points outside the grid bounds', () => {
        expect(sampleHeightmap(data, -5, -5)).toBeCloseTo(0, 6);
        expect(sampleHeightmap(data, 99, 99)).toBeCloseTo(6, 6);
    });

    it('falls back to the nearest valid corner when one is missing', () => {
        const withHole: HeightmapData = { ...data, z: [0, 2, 4, null] };
        // At the missing (10,10) corner, nearest valid corner value is used.
        const v = sampleHeightmap(withHole, 10, 10);
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeCloseTo(2, 6); // nearest of remaining corners to (col1,row1)
    });
});
