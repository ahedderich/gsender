import { rotateGcodeXY } from '../gcode/rotateGcode';

/** Pull the numeric value of an axis word from a single gcode line. */
const word = (line: string, letter: string): number | undefined => {
    const m = line.match(new RegExp(`${letter}\\s*(-?(?:\\d+\\.?\\d*|\\.\\d+))`, 'i'));
    return m ? Number(m[1]) : undefined;
};

describe('rotateGcodeXY', () => {
    it('rotates an absolute X/Y point about the origin (90°)', () => {
        const out = rotateGcodeXY('G1 X10 Y0', 90);
        expect(word(out, 'X')).toBeCloseTo(0, 4);
        expect(word(out, 'Y')).toBeCloseTo(10, 4);
    });

    it('matches the stock direction: −3° measured (φ=+3° CCW) moves X10 Y0 toward +Y', () => {
        // Apply uses φ = -measured. Measured −3° → φ = +3°.
        const phi = 3;
        const out = rotateGcodeXY('G1 X10 Y0', phi);
        expect(word(out, 'X')).toBeCloseTo(10 * Math.cos((phi * Math.PI) / 180), 4);
        expect(word(out, 'Y')).toBeCloseTo(10 * Math.sin((phi * Math.PI) / 180), 4);
        expect(word(out, 'Y')!).toBeGreaterThan(0);
    });

    it('expands a single-axis move to carry both X and Y (modal Y carried)', () => {
        // After G1 X0 Y10, a pure-X move to X10 sits at (10,10); rotate 90° → (-10,10).
        const out = rotateGcodeXY(['G90', 'G1 X0 Y10', 'G1 X10'].join('\n'), 90);
        const last = out.trim().split('\n').pop()!;
        expect(word(last, 'X')).toBeCloseTo(-10, 4);
        expect(word(last, 'Y')).toBeCloseTo(10, 4);
    });

    it('rotates arc centre offsets I/J as a vector (90°)', () => {
        const out = rotateGcodeXY('G2 X10 Y0 I5 J0', 90);
        expect(word(out, 'I')).toBeCloseTo(0, 4);
        expect(word(out, 'J')).toBeCloseTo(5, 4);
    });

    it('rotates incremental (G91) moves as a delta vector', () => {
        const out = rotateGcodeXY(['G91', 'G1 X10 Y0'].join('\n'), 90);
        const last = out.trim().split('\n').pop()!;
        expect(word(last, 'X')).toBeCloseTo(0, 4);
        expect(word(last, 'Y')).toBeCloseTo(10, 4);
    });

    it('leaves non-coordinate lines and comments untouched', () => {
        const src = ['; preamble', 'M3 S1000', 'G21 (millimeters)', 'F500'].join('\n');
        expect(rotateGcodeXY(src, 33)).toBe(src);
    });

    it('preserves a trailing comment while rewriting coordinates', () => {
        const out = rotateGcodeXY('G1 X10 Y0 (cut edge)', 90);
        expect(out).toContain('(cut edge)');
        expect(word(out, 'X')).toBeCloseTo(0, 4);
        expect(word(out, 'Y')).toBeCloseTo(10, 4);
    });

    it('does not modify Z', () => {
        const out = rotateGcodeXY('G1 X10 Y0 Z-2.5', 90);
        expect(word(out, 'Z')).toBeCloseTo(-2.5, 4);
    });

    it('round-trips: rotate by φ then −φ returns the original points', () => {
        const src = ['G90', 'G1 X12.5 Y-7.25', 'G1 X-3 Y4', 'G2 X1 Y1 I2 J-1'].join('\n');
        const back = rotateGcodeXY(rotateGcodeXY(src, 3), -3);
        const a = src.split('\n');
        const b = back.split('\n');
        for (let i = 0; i < a.length; i++) {
            for (const letter of ['X', 'Y', 'I', 'J']) {
                const av = word(a[i], letter);
                if (av !== undefined) {
                    expect(word(b[i], letter)).toBeCloseTo(av, 3);
                }
            }
        }
    });
});
