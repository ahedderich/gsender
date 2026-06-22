import { parseLine } from 'app/lib/GCodeParser';
import { HeightmapData } from '../definitions';
import { sampleHeightmap } from './heightmap';

/**
 * Recalculate the Z values of a G-code program so the toolpath follows a probed
 * surface (auto-leveling). Each linear move is subdivided into segments no longer
 * than the heightmap resolution, and every point's Z is set to its commanded
 * depth plus the bilinearly-interpolated surface offset at that X/Y.
 *
 * Scope / limitations:
 * - G0/G1 linear moves (incl. rapids) are subdivided and Z-compensated.
 * - Plunge / Z-only lines are offset in place.
 * - Arcs (G2/G3) get their endpoint Z offset only — CAM should linearize arcs
 *   for best results on a non-flat surface.
 * - Absolute (G90) is assumed for the autolevel pass; incremental (G91) moves are
 *   passed through unchanged (they have no fixed X/Y to sample).
 */
export function applyHeightmapToGcode(gcode: string, data: HeightmapData): string {
    if (!gcode || !data || data.z.length === 0) {
        return gcode;
    }
    const res = data.resolution > 0 ? data.resolution : 10;

    let absolute = true;
    let motion = 0;            // last modal motion: 0,1,2,3 → G0..G3
    let cur = { x: 0, y: 0, z: 0 };

    const eol = gcode.includes('\r\n') ? '\r\n' : '\n';
    const out: string[] = [];

    for (const line of gcode.split(/\r?\n/)) {
        const { words } = parseLine(line);
        if (!words.length) { out.push(line); continue; }

        let hasX = false, hasY = false, hasZ = false, hasMotion = false;
        let nx = cur.x, ny = cur.y, nz = cur.z;

        for (const [letter, value] of words) {
            switch (letter) {
                case 'G': {
                    const g = Number(value);
                    if (g === 90) absolute = true;
                    else if (g === 91) absolute = false;
                    else if (g === 0 || g === 1 || g === 2 || g === 3) { motion = g; hasMotion = true; }
                    break;
                }
                case 'X': hasX = true; nx = absolute ? Number(value) : cur.x + Number(value); break;
                case 'Y': hasY = true; ny = absolute ? Number(value) : cur.y + Number(value); break;
                case 'Z': hasZ = true; nz = absolute ? Number(value) : cur.z + Number(value); break;
                default: break;
            }
        }

        const touches = hasX || hasY || hasZ;
        if (!touches) { out.push(line); continue; }

        // Incremental moves: can't sample a fixed surface point — pass through.
        if (!absolute) {
            out.push(line);
            cur = { x: nx, y: ny, z: nz };
            continue;
        }

        const isLinear = motion === 0 || motion === 1;
        const movesXY = (hasX && nx !== cur.x) || (hasY && ny !== cur.y);

        if (isLinear && movesXY) {
            const dx = nx - cur.x;
            const dy = ny - cur.y;
            const dist = Math.hypot(dx, dy);
            const segs = Math.max(1, Math.ceil(dist / res));
            const g = `G${motion}`;
            const fMatch = line.match(/[Ff]\s*[-+]?[0-9]*\.?[0-9]+/);
            const feed = fMatch ? ` ${fMatch[0].replace(/\s+/, '').toUpperCase()}` : '';
            const baseZ = cur.z; // segment starts at the current commanded Z
            for (let s = 1; s <= segs; s++) {
                const t = s / segs;
                const px = cur.x + dx * t;
                const py = cur.y + dy * t;
                const cz = baseZ + (nz - baseZ) * t;           // interpolated commanded Z
                const z = cz + sampleHeightmap(data, px, py);
                out.push(`${g} X${fmt(px)} Y${fmt(py)} Z${fmt(z)}${s === 1 ? feed : ''}`);
            }
            cur = { x: nx, y: ny, z: nz };
            continue;
        }

        if (hasZ) {
            // Plunge / Z-only (or arc endpoint): offset the commanded Z in place.
            const offset = sampleHeightmap(data, nx, ny);
            out.push(replaceZ(line, nz + offset));
            cur = { x: nx, y: ny, z: nz };
            continue;
        }

        // XY move on an arc, or non-compensated move: keep but track position.
        out.push(line);
        cur = { x: nx, y: ny, z: nz };
    }

    return out.join(eol);
}

function fmt(n: number): string {
    const s = parseFloat(n.toFixed(4)).toString();
    return s === '-0' ? '0' : s;
}

const Z_RE = /([Zz])\s*[-+]?(?:\d+\.?\d*|\.\d+)/;

/** Replace the Z word in a line, preserving comments and other words. */
function replaceZ(line: string, value: number): string {
    const masks: string[] = [];
    const mask = (m: string): string => { masks.push(m); return `\x00${masks.length - 1}\x00`; };
    let code = line.replace(/\([^)]*\)/g, mask).replace(/;.*/, mask);
    code = code.replace(Z_RE, `Z${fmt(value)}`);
    return code.replace(/\x00(\d+)\x00/g, (_, i) => masks[Number(i)]);
}
