import { parseLine } from 'app/lib/GCodeParser';

/**
 * Rotate every X/Y coordinate of a G-code program about the work origin (0,0)
 * by `angleDegCCW` degrees counter-clockwise. Used to align a loaded toolpath
 * with a physically rotated stock measured by the rotation probe.
 *
 * Notes / scope:
 * - Absolute mode (G90, the default) rotates each target point about the origin.
 *   A line that moves in only one axis is expanded to carry both X and Y, since
 *   after rotation a pure-X move becomes a move in both axes.
 * - Incremental mode (G91) rotates the per-line delta as a vector (no translation).
 * - Arc centre offsets I/J are rotated as a vector (they are relative offsets).
 *   Absolute arc-centre mode (G90.1) is not handled; I/J are assumed relative.
 * - Z, A, K, R, feed/spindle words and comments are preserved untouched.
 */
export function rotateGcodeXY(gcode: string, angleDegCCW: number): string {
    if (!gcode) {
        return gcode;
    }
    const phi = (angleDegCCW * Math.PI) / 180;
    const cos = Math.cos(phi);
    const sin = Math.sin(phi);

    const rotate = (x: number, y: number): [number, number] => [
        x * cos - y * sin,
        x * sin + y * cos,
    ];

    // Track absolute/incremental mode and the current logical position in the
    // program's ORIGINAL coordinate space.
    let absolute = true;
    let curX = 0;
    let curY = 0;

    const eol = gcode.includes('\r\n') ? '\r\n' : '\n';
    const lines = gcode.split(/\r?\n/);
    const out = lines.map((line) => rewriteLine(line));
    return out.join(eol);

    function rewriteLine(line: string): string {
        const { words } = parseLine(line);
        if (!words.length) {
            return line;
        }

        let hasX = false, hasY = false, hasI = false, hasJ = false;
        let xVal = 0, yVal = 0, iVal = 0, jVal = 0;

        for (const [letter, value] of words) {
            switch (letter) {
                case 'G': {
                    const g = Number(value);
                    if (g === 90) absolute = true;
                    else if (g === 91) absolute = false;
                    break;
                }
                case 'X': hasX = true; xVal = Number(value); break;
                case 'Y': hasY = true; yVal = Number(value); break;
                case 'I': hasI = true; iVal = Number(value); break;
                case 'J': hasJ = true; jVal = Number(value); break;
                default: break;
            }
        }

        const touchesXY = hasX || hasY;
        if (!touchesXY && !(hasI || hasJ)) {
            return line; // nothing to rotate on this line
        }

        const repl: Array<[string, number]> = [];
        const append: Array<[string, number]> = [];

        if (touchesXY) {
            if (absolute) {
                const tx = hasX ? xVal : curX;
                const ty = hasY ? yVal : curY;
                const [rx, ry] = rotate(tx, ty);
                (hasX ? repl : append).push(['X', rx]);
                (hasY ? repl : append).push(['Y', ry]);
                curX = tx;
                curY = ty;
            } else {
                const dx = hasX ? xVal : 0;
                const dy = hasY ? yVal : 0;
                const [rx, ry] = rotate(dx, dy);
                (hasX ? repl : append).push(['X', rx]);
                (hasY ? repl : append).push(['Y', ry]);
                curX += dx;
                curY += dy;
            }
        }

        if (hasI || hasJ) {
            // I/J are a relative centre vector — rotate as a direction.
            const di = hasI ? iVal : 0;
            const dj = hasJ ? jVal : 0;
            const [ri, rj] = rotate(di, dj);
            (hasI ? repl : append).push(['I', ri]);
            (hasJ ? repl : append).push(['J', rj]);
        }

        return applyEdits(line, repl, append);
    }
}

/** Format a number with up to 4 decimals, trimming trailing zeros and -0. */
function fmt(n: number): string {
    const s = parseFloat(n.toFixed(4)).toString();
    return s === '-0' ? '0' : s;
}

const COORD_RE: Record<string, RegExp> = {
    X: /([Xx])\s*[-+]?(?:\d+\.?\d*|\.\d+)/,
    Y: /([Yy])\s*[-+]?(?:\d+\.?\d*|\.\d+)/,
    I: /([Ii])\s*[-+]?(?:\d+\.?\d*|\.\d+)/,
    J: /([Jj])\s*[-+]?(?:\d+\.?\d*|\.\d+)/,
};

/**
 * Replace existing coordinate words in place and append the ones that were
 * implied, without disturbing comments or other words on the line.
 */
function applyEdits(
    line: string,
    repl: Array<[string, number]>,
    append: Array<[string, number]>,
): string {
    // Mask comments with a non-numeric sentinel so coordinate edits never touch
    // text inside them, then restore at the end.
    const masks: string[] = [];
    const mask = (m: string): string => {
        masks.push(m);
        return `\x00${masks.length - 1}\x00`;
    };
    let code = line.replace(/\([^)]*\)/g, mask).replace(/;.*/, mask);

    for (const [letter, value] of repl) {
        code = code.replace(COORD_RE[letter], `${letter}${fmt(value)}`);
    }

    if (append.length) {
        const tail = append.map(([l, v]) => `${l}${fmt(v)}`).join(' ');
        const trailingComment = code.match(/\x00\d+\x00\s*$/);
        if (trailingComment) {
            const idx = code.length - trailingComment[0].length;
            code = `${code.slice(0, idx).trimEnd()} ${tail} ${code.slice(idx)}`;
        } else {
            code = `${code.trimEnd()} ${tail}`;
        }
    }

    return code.replace(/\x00(\d+)\x00/g, (_, i) => masks[Number(i)]);
}
