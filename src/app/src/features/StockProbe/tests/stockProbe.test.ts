import {
    generateXYZCenterRectGCode,
    generateXYZCenterRoundGCode,
    generateHoleCenterGCode,
    generateRotationGCode,
    generateCornerProbeGCode,
    generateSingleEdgeGCode,
    generateZOnlyGCode,
} from '../StockProbeGCode';
import { ProbeContext, ProbePoint, ProbeStep } from '../definitions';
import { parseProbeReport } from '../parseProbeReport';

const P = (x: number, y: number, z = 0): ProbePoint => ({ x, y, z });

/**
 * Walk a ProbeStep[] the way WizardShell does: resolve each step's commands against the
 * accumulated context, then apply that step's capture (from a supplied point map) and
 * compute. Returns every emitted command plus the final computed values.
 */
function simulate(
    steps: ProbeStep[],
    probePoints: Record<string, ProbePoint> = {},
): { commands: string[]; values: Record<string, number> } {
    const ctx: ProbeContext = {
        start:   P(0, 0, 0),
        current: P(0, 0, 0),
        probes:  {},
        values:  {},
    };
    const commands: string[] = [];
    for (const step of steps) {
        const cmds = typeof step.commands === 'function' ? step.commands(ctx) : step.commands;
        commands.push(...cmds);
        if (step.capture) {
            ctx.probes[step.capture] = probePoints[step.capture] ?? P(0, 0, 0);
        }
        step.compute?.(ctx);
    }
    return { commands, values: ctx.values };
}

/** Macro tokens that must never survive into generated gcode any more. */
function assertNoMacros(commands: string[]): void {
    for (const line of commands) {
        expect(line).not.toMatch(/%/);        // %global assignments
        expect(line).not.toMatch(/\[/);       // [expression] reads
        expect(line).not.toMatch(/global/i);
        expect(line).not.toMatch(/MSG/);      // (MSG, ...) echoes
    }
}

const BASE = {
    probeFeedrateFast: 200,
    probeFeedrateSlow: 75,
    travelFeedrate: 5000,
    retractDistance: 2,
    bufferDistance: 20,
    xyProbingHeight: -2,
    wcsIndex: 1,
    safeHeight: 10,
    tipDiameter: 2,
};

describe('StockProbe gcode — no macro variables remain', () => {
    const cases: Array<[string, ProbeStep[], Record<string, ProbePoint>]> = [
        ['XYZ center (rect)', generateXYZCenterRectGCode({ ...BASE, stockWidth: 100, stockLength: 60 }), {
            SP_X_MINUS: P(-50, 0), SP_X_PLUS: P(50, 0), SP_Y_PLUS: P(0, 30), SP_Y_MINUS: P(0, -30),
        }],
        ['XYZ center (round)', generateXYZCenterRoundGCode({ ...BASE, stockDiameter: 50 }), {
            SP_P1: P(35, 5), SP_P2: P(-2.5, 26.6506), SP_P3: P(-2.5, -16.6506),
        }],
        ['hole center', generateHoleCenterGCode({ ...BASE, stockDiameter: 80 }), {
            SP_XP: P(40, 0), SP_XM: P(-40, 0), SP_YP: P(0, 30), SP_YM: P(0, -30),
        }],
        ['rotation', generateRotationGCode({
            ...BASE, measuringLength: 100, stockWidth: 100, stockLength: 60,
            probingZHeight: -3, direction: 'towards_center', side: 'top', rotationEdgeOffset: 15,
        }), { SP_P1: P(0, 0), SP_P2: P(50, 5), SP_P3: P(100, 10) }],
        ['corner', generateCornerProbeGCode({ ...BASE, corner: 'BL' }), {}],
        ['single edge', generateSingleEdgeGCode({ ...BASE, edge: 'X+' }), {}],
        ['z only', generateZOnlyGCode(BASE), {}],
    ];

    it.each(cases)('%s emits only numeric gcode', (_name, steps, points) => {
        const { commands } = simulate(steps, points);
        expect(commands.length).toBeGreaterThan(0);
        assertNoMacros(commands);
    });
});

describe('StockProbe client-side math', () => {
    it('computes rectangle width and length, corrected by tip diameter', () => {
        // Tool-centre contacts span 100 × 60; with a 2 mm tip the true stock is 2 mm smaller
        // each way. Centre is unaffected (tip offsets cancel).
        const { values } = simulate(
            generateXYZCenterRectGCode({ ...BASE, stockWidth: 100, stockLength: 60 }),
            { SP_X_MINUS: P(-50, 0), SP_X_PLUS: P(50, 0), SP_Y_PLUS: P(0, 30), SP_Y_MINUS: P(0, -30) },
        );
        expect(values.SP_WIDTH).toBeCloseTo(98, 3);
        expect(values.SP_LENGTH).toBeCloseTo(58, 3);
        expect(values.SP_X_CENTER).toBeCloseTo(0, 3);
        expect(values.SP_Y_CENTER).toBeCloseTo(0, 3);
    });

    it('computes the circumcentre and tip-corrected diameter for round stock', () => {
        // Three tool-centre points on a circle centred at (10, 5) with radius 25 → measured
        // diameter 50; a 2 mm tip makes the true diameter 48. Centre unaffected.
        const { values } = simulate(
            generateXYZCenterRoundGCode({ ...BASE, stockDiameter: 50 }),
            { SP_P1: P(35, 5), SP_P2: P(-2.5, 26.6506), SP_P3: P(-2.5, -16.6506) },
        );
        expect(values.SP_CX).toBeCloseTo(10, 2);
        expect(values.SP_CY).toBeCloseTo(5, 2);
        expect(values.SP_DIAMETER).toBeCloseTo(48, 2);
    });

    it('computes hole diameter, corrected by tip diameter (internal feature)', () => {
        // Tool-centre wall contacts span 80; for an internal feature a 2 mm tip means the
        // true hole is 2 mm larger.
        const { values } = simulate(
            generateHoleCenterGCode({ ...BASE, stockDiameter: 80 }),
            { SP_XP: P(40, 0), SP_XM: P(-40, 0), SP_YP: P(0, 30), SP_YM: P(0, -30) },
        );
        expect(values.SP_HOLE_DIAMETER).toBeCloseTo(82, 3);
        expect(values.SP_XC).toBeCloseTo(0, 3);
        expect(values.SP_YC).toBeCloseTo(0, 3);
    });

    it('scales the tip-diameter correction with the configured value', () => {
        const contacts = { SP_X_MINUS: P(-50, 0), SP_X_PLUS: P(50, 0), SP_Y_PLUS: P(0, 30), SP_Y_MINUS: P(0, -30) };
        const none = simulate(generateXYZCenterRectGCode({ ...BASE, tipDiameter: 0, stockWidth: 100, stockLength: 60 }), contacts);
        const six  = simulate(generateXYZCenterRectGCode({ ...BASE, tipDiameter: 6, stockWidth: 100, stockLength: 60 }), contacts);
        expect(none.values.SP_WIDTH).toBeCloseTo(100, 3);
        expect(six.values.SP_WIDTH).toBeCloseTo(94, 3);
    });

    it('offsets the single-edge work zero by the tip radius', () => {
        // X+ edge probes in -X; the tool centre stops +1 mm (½ of 2 mm) outside the true
        // edge, so the work zero is set to +1 so the true edge reads 0.
        const cmds = generateSingleEdgeGCode({ ...BASE, edge: 'X+' }).flatMap((s) =>
            typeof s.commands === 'function' ? [] : s.commands);
        expect(cmds.some((c) => /G10 L20 P1 X1\.000/.test(c))).toBe(true);
    });

    // Rotation reports a CW-positive angle: a stock rotated CCW yields a negative angle,
    // and the same physical rotation reports the same value on every side. Top/bottom
    // spread contacts along X (skew in Y); left/right spread along Y (skew in X).
    const rotationParams = (side: 'top' | 'bottom' | 'left' | 'right') => ({
        ...BASE, measuringLength: 100, stockWidth: 100, stockLength: 60,
        probingZHeight: -3, direction: 'towards_center' as const, side, rotationEdgeOffset: 15,
    });
    // step = measuringLength/2 - rotationEdgeOffset = 35; skew of a 3° tilt over the 70mm span.
    const tan3 = Math.tan((3 * Math.PI) / 180);
    const skew = 70 * tan3; // 3.6685

    it('computes a CW-positive (negative for CCW) rotation angle on the top edge', () => {
        // Contacts spread along X; Y rises as X rises => 3° CCW tilt => reports -3°.
        const { values } = simulate(generateRotationGCode(rotationParams('top')),
            { SP_P1: P(-35, 0), SP_P2: P(0, skew / 2), SP_P3: P(35, skew) });
        expect(values.SP_ANGLE).toBeCloseTo(-3, 4);
    });

    it('reports the same angle on the bottom edge as the top edge', () => {
        const { values } = simulate(generateRotationGCode(rotationParams('bottom')),
            { SP_P1: P(-35, 0), SP_P2: P(0, skew / 2), SP_P3: P(35, skew) });
        expect(values.SP_ANGLE).toBeCloseTo(-3, 4);
    });

    it('computes -3° on the right edge for a 3° CCW stock (the reported bug)', () => {
        // Contacts spread along Y; X drifts left as Y rises => 3° CCW tilt => reports -3°
        // (previously this returned ~93° because the formula was not side-aware).
        const { values } = simulate(generateRotationGCode(rotationParams('right')),
            { SP_P1: P(50, -35), SP_P2: P(50 - skew / 2, 0), SP_P3: P(50 - skew, 35) });
        expect(values.SP_ANGLE).toBeCloseTo(-3, 4);
    });

    it('reports the same angle on the left edge as the right edge', () => {
        const { values } = simulate(generateRotationGCode(rotationParams('left')),
            { SP_P1: P(-50, -35), SP_P2: P(-50 - skew / 2, 0), SP_P3: P(-50 - skew, 35) });
        expect(values.SP_ANGLE).toBeCloseTo(-3, 4);
    });

    it('moves use relative deltas from the current machine position', () => {
        // With start at origin, the first XY positioning move for the left side targets
        // start.x - (halfW + buf) = -(50 + 20) = -70, emitted as a G91 X-70 delta.
        const steps = generateXYZCenterRectGCode({ ...BASE, stockWidth: 100, stockLength: 60 });
        const ctx: ProbeContext = { start: P(0, 0), current: P(0, 0), probes: {}, values: {} };
        const leftMove = steps[2].commands;
        const cmds = typeof leftMove === 'function' ? leftMove(ctx) : leftMove;
        expect(cmds.some((c) => /G91 G1 X-70\.000/.test(c))).toBe(true);
    });
});

describe('parseProbeReport', () => {
    it('parses a successful probe report into a machine point', () => {
        expect(parseProbeReport('[PRB:-10.234,0.123,-5.678:1]')).toEqual({
            x: -10.234, y: 0.123, z: -5.678,
        });
    });

    it('returns null for a failed probe (result 0)', () => {
        expect(parseProbeReport('[PRB:1.000,2.000,3.000:0]')).toBeNull();
    });

    it('returns null for non-PRB lines', () => {
        expect(parseProbeReport('ok')).toBeNull();
        expect(parseProbeReport('<Idle|MPos:0.000,0.000,0.000>')).toBeNull();
    });
});
