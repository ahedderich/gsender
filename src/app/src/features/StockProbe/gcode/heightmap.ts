import { HeightmapData, StockProbeSettings, StockType } from '../definitions';

export interface GridLayout {
    shape: StockType;
    originX: number;
    originY: number;
    stepX: number;
    stepY: number;
    cols: number;
    rows: number;
    resolution: number;
    /** Ordered, row-major grid points in WORK coords. `inside=false` for round
     *  points that fall outside the inset radius (not probed). */
    points: Array<{ x: number; y: number; col: number; row: number; inside: boolean }>;
}

/** Number of grid columns/rows spanning `span` mm at ~`resolution` spacing. */
function countFor(span: number, resolution: number): number {
    if (span <= 0) return 1;
    return Math.max(2, Math.round(span / resolution) + 1);
}

/**
 * Build the probe grid for the current stock, inset from the edges so every point
 * stays on material. The grid is centered on the work origin (0,0), matching the
 * StockProbe convention (XYZ-center sets work zero at the stock centre).
 */
export function generateHeightmapGrid(settings: StockProbeSettings): GridLayout {
    const { stockType, heightmapResolution: res, heightmapEdgeInset: inset } = settings;

    if (stockType === 'round') {
        const r = Math.max(0, settings.stockDiameter / 2 - inset);
        const span = 2 * r;
        const n = countFor(span, res);
        const step = n > 1 ? span / (n - 1) : 0;
        const points: GridLayout['points'] = [];
        for (let row = 0; row < n; row++) {
            for (let col = 0; col < n; col++) {
                const x = -r + col * step;
                const y = -r + row * step;
                const inside = x * x + y * y <= r * r + 1e-6;
                points.push({ x, y, col, row, inside });
            }
        }
        return { shape: 'round', originX: -r, originY: -r, stepX: step, stepY: step, cols: n, rows: n, resolution: res, points };
    }

    // rectangle
    const halfW = Math.max(0, settings.stockWidth / 2 - inset);
    const halfL = Math.max(0, settings.stockLength / 2 - inset);
    const cols = countFor(2 * halfW, res);
    const rows = countFor(2 * halfL, res);
    const stepX = cols > 1 ? (2 * halfW) / (cols - 1) : 0;
    const stepY = rows > 1 ? (2 * halfL) / (rows - 1) : 0;
    const points: GridLayout['points'] = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            points.push({ x: -halfW + col * stepX, y: -halfL + row * stepY, col, row, inside: true });
        }
    }
    return { shape: 'rectangle', originX: -halfW, originY: -halfL, stepX, stepY, cols, rows, resolution: res, points };
}

const at = (data: HeightmapData, col: number, row: number): number | null => {
    if (col < 0 || row < 0 || col >= data.cols || row >= data.rows) return null;
    return data.z[row * data.cols + col];
};

/**
 * Bilinearly interpolate the surface offset at work point (x,y). The point is
 * clamped to the grid bounds. If a needed corner is missing (round / failed
 * probe), it falls back to the nearest valid corner of that cell, and if the
 * whole cell is empty, to the nearest valid grid value overall.
 */
export function sampleHeightmap(data: HeightmapData, x: number, y: number): number {
    const { originX, originY, stepX, stepY, cols, rows } = data;
    if (cols < 1 || rows < 1) return 0;

    const fx = stepX > 0 ? (x - originX) / stepX : 0;
    const fy = stepY > 0 ? (y - originY) / stepY : 0;
    const cx = Math.min(Math.max(fx, 0), cols - 1);
    const cy = Math.min(Math.max(fy, 0), rows - 1);

    const c0 = Math.floor(cx);
    const r0 = Math.floor(cy);
    const c1 = Math.min(c0 + 1, cols - 1);
    const r1 = Math.min(r0 + 1, rows - 1);
    const tx = cx - c0;
    const ty = cy - r0;

    const corners = [
        { z: at(data, c0, r0), col: c0, row: r0 },
        { z: at(data, c1, r0), col: c1, row: r0 },
        { z: at(data, c0, r1), col: c0, row: r1 },
        { z: at(data, c1, r1), col: c1, row: r1 },
    ];

    const valid = corners.filter((p) => p.z != null);
    if (valid.length === 0) return nearestValid(data, c0, r0);

    // Fill missing corners with the nearest valid corner of this cell.
    const z = (col: number, row: number): number => {
        const v = at(data, col, row);
        if (v != null) return v;
        let best = valid[0];
        let bestD = Infinity;
        for (const p of valid) {
            const d = (p.col - col) ** 2 + (p.row - row) ** 2;
            if (d < bestD) { bestD = d; best = p; }
        }
        return best.z as number;
    };

    const z00 = z(c0, r0);
    const z10 = z(c1, r0);
    const z01 = z(c0, r1);
    const z11 = z(c1, r1);

    const top = z00 * (1 - tx) + z10 * tx;
    const bot = z01 * (1 - tx) + z11 * tx;
    return top * (1 - ty) + bot * ty;
}

function nearestValid(data: HeightmapData, col: number, row: number): number {
    let best = 0;
    let bestD = Infinity;
    for (let r = 0; r < data.rows; r++) {
        for (let c = 0; c < data.cols; c++) {
            const v = at(data, c, r);
            if (v == null) continue;
            const d = (c - col) ** 2 + (r - row) ** 2;
            if (d < bestD) { bestD = d; best = v; }
        }
    }
    return best;
}
