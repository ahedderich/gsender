import {
    generateCalibrationProbeTask,
    generateReferenceProbeTask,
    computeTipDiameter,
    REFERENCE_PROBE_ORDER,
    ReferenceContacts,
} from '../calibrationGCode';

// Helper: simulate the four wall contacts for a centred probe in a hole of
// diameter D with a round tip of diameter `tip`. For an internal feature the
// controlled point stops one tip radius short of each wall, so each contact sits
// (D/2 − tip/2) from the hole centre. `centre` lets us offset the whole feature
// (and `off` the probe's off-centre placement) to prove the maths is robust.
function simulateContacts(
    D: number,
    tip: number,
    centre: { x: number; y: number } = { x: 0, y: 0 },
    off: { x: number; y: number } = { x: 0, y: 0 },
): ReferenceContacts {
    const reach = D / 2 - tip / 2;
    return {
        xPlus:  centre.x + off.x + reach,
        xMinus: centre.x + off.x - reach,
        yPlus:  centre.y + off.y + reach,
        yMinus: centre.y + off.y - reach,
    };
}

describe('generateCalibrationProbeTask', () => {
    it('probes only toward -X (eccentricity phase)', () => {
        const task = generateCalibrationProbeTask('Cable back');
        const probes = task.commands.filter((c) => c.startsWith('G38.2'));
        expect(probes.length).toBe(2); // fast + slow
        probes.forEach((c) => expect(c).toMatch(/X-/));
        expect(task.commands).toContain('G91');
        expect(task.commands).toContain('G90');
    });
});

describe('generateReferenceProbeTask', () => {
    const centre = { x: -60, y: -60 };

    it('emits four probes, one per wall, in +X/-X/+Y/-Y order', () => {
        const task = generateReferenceProbeTask(20, centre);
        const probes = task.commands.filter((c) => c.startsWith('G38.2'));
        expect(probes.length).toBe(4);
        expect(probes[0]).toMatch(/X(?!-)/);  // +X
        expect(probes[1]).toMatch(/X-/);      // -X
        expect(probes[2]).toMatch(/Y(?!-)/);  // +Y
        expect(probes[3]).toMatch(/Y-/);      // -Y
        expect(REFERENCE_PROBE_ORDER).toEqual(['X+', 'X-', 'Y+', 'Y-']);
    });

    it('reaches past the nominal radius to guarantee contact', () => {
        const task = generateReferenceProbeTask(20, centre); // radius 10
        const plusX = task.commands.find((c) => /^G38\.2 X\d/.test(c))!;
        const dist = parseFloat(plusX.match(/X(\d+(?:\.\d+)?)/)![1]);
        expect(dist).toBeGreaterThan(10);
    });

    it('uses G90 absolute retracts to the supplied centre position', () => {
        const task = generateReferenceProbeTask(20, { x: -123.456, y: 7.89 });
        const retracts = task.commands.filter((c) => c.startsWith('G90'));
        // Each retract should include the exact centre coordinates.
        retracts.forEach((c) => {
            expect(c).toContain('X-123.456');
            expect(c).toContain('Y7.890');
        });
    });

    it('clamps a negative diameter to zero reach', () => {
        const task = generateReferenceProbeTask(-5, centre);
        // Should not throw and should still emit four probes.
        expect(task.commands.filter((c) => c.startsWith('G38.2')).length).toBe(4);
    });
});

describe('computeTipDiameter', () => {
    it('recovers the tip diameter from a known hole', () => {
        const r = computeTipDiameter(20, simulateContacts(20, 2));
        expect(r.tipDiameter).toBeCloseTo(2, 6);
        expect(r.tipDiameterX).toBeCloseTo(2, 6);
        expect(r.tipDiameterY).toBeCloseTo(2, 6);
        expect(r.consistency).toBeCloseTo(0, 6);
        expect(r.knownDiameter).toBe(20);
    });

    it('is independent of where the hole sits in machine space', () => {
        const r = computeTipDiameter(25, simulateContacts(25, 3, { x: -120, y: -80 }));
        expect(r.tipDiameter).toBeCloseTo(3, 6);
    });

    it('is independent of the probe being off-centre in the hole', () => {
        // Off-centre placement shifts both opposing contacts equally, so the span
        // — and therefore the derived diameter — is unchanged.
        const r = computeTipDiameter(20, simulateContacts(20, 2, { x: 0, y: 0 }, { x: 1.5, y: -0.8 }));
        expect(r.tipDiameter).toBeCloseTo(2, 6);
        expect(r.consistency).toBeCloseTo(0, 6);
    });

    it('reports a non-zero spread when the tip is not round', () => {
        // X span implies tip 2.0, Y span implies tip 3.0 → different reach per axis.
        const contacts: ReferenceContacts = {
            xPlus: 9, xMinus: -9,    // span 18 → tip 2
            yPlus: 8.5, yMinus: -8.5, // span 17 → tip 3
        };
        const r = computeTipDiameter(20, contacts);
        expect(r.tipDiameterX).toBeCloseTo(2, 6);
        expect(r.tipDiameterY).toBeCloseTo(3, 6);
        expect(r.tipDiameter).toBeCloseTo(2.5, 6);
        expect(r.consistency).toBeGreaterThan(0);
    });
});
