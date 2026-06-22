import reducer, {
    updateFileContent,
    applyGcodeRotation,
    revertGcodeRotation,
} from 'app/store/redux/slices/fileInfo.slice';

const loaded = () =>
    reducer(undefined, updateFileContent({ content: 'G1 X1 Y2', name: 'job.nc', size: 8 }));

describe('fileInfo slice — gcode rotation apply/revert', () => {
    it('apply stores the original as rawContent and marks rotation applied', () => {
        const s0 = loaded();
        const s1 = reducer(
            s0,
            applyGcodeRotation({
                content: 'G1 X-2 Y1', rawContent: s0.content, name: 'job.nc', size: 9, angle: 3,
            }),
        );
        expect(s1.content).toBe('G1 X-2 Y1');
        expect(s1.rawContent).toBe('G1 X1 Y2');
        expect(s1.rotationApplied).toBe(true);
        expect(s1.appliedRotationAngle).toBe(3);
    });

    it('re-applying does not overwrite the original backup', () => {
        const s0 = loaded();
        const s1 = reducer(s0, applyGcodeRotation({ content: 'rot1', rawContent: s0.content, name: 'job.nc', size: 4, angle: 3 }));
        const s2 = reducer(s1, applyGcodeRotation({ content: 'rot2', rawContent: 'rot1', name: 'job.nc', size: 4, angle: 5 }));
        expect(s2.content).toBe('rot2');
        expect(s2.rawContent).toBe('G1 X1 Y2'); // still the true original
        expect(s2.appliedRotationAngle).toBe(5);
    });

    it('revert restores the original content and clears applied state', () => {
        const s0 = loaded();
        const s1 = reducer(s0, applyGcodeRotation({ content: 'rotated', rawContent: s0.content, name: 'job.nc', size: 7, angle: 3 }));
        const s2 = reducer(s1, revertGcodeRotation({ content: s0.content, name: 'job.nc', size: s0.size }));
        expect(s2.content).toBe('G1 X1 Y2');
        expect(s2.rotationApplied).toBe(false);
        expect(s2.appliedRotationAngle).toBe(0);
        expect(s2.rawContent).toBe('');
    });

    it('revert survives the re-upload echo arriving first (content not lost)', () => {
        const s0 = loaded();
        const s1 = reducer(s0, applyGcodeRotation({ content: 'rotated', rawContent: s0.content, name: 'job.nc', size: 7, angle: 3 }));
        // Echo of the revert upload (original content) lands before revertGcodeRotation,
        // clearing rawContent. Revert must still restore the original via its payload.
        const echo = reducer(s1, updateFileContent({ content: s0.content, name: 'job.nc', size: s0.size }));
        expect(echo.rawContent).toBe(''); // echo cleared the backup
        const s2 = reducer(echo, revertGcodeRotation({ content: s0.content, name: 'job.nc', size: s0.size }));
        expect(s2.content).toBe('G1 X1 Y2'); // not '' — the bug being fixed
        expect(s2.rotationApplied).toBe(false);
    });

    it('preserves rotation state when the re-upload echoes the same content back', () => {
        const s0 = loaded();
        const s1 = reducer(s0, applyGcodeRotation({ content: 'rotated', rawContent: s0.content, name: 'job.nc', size: 7, angle: 3 }));
        // file:load echo of our own rotated program
        const s2 = reducer(s1, updateFileContent({ content: 'rotated', name: 'job.nc', size: 7 }));
        expect(s2.rotationApplied).toBe(true);
        expect(s2.rawContent).toBe('G1 X1 Y2');
        expect(s2.appliedRotationAngle).toBe(3);
    });

    it('loading a new file clears any applied-rotation state', () => {
        const s0 = loaded();
        const s1 = reducer(s0, applyGcodeRotation({ content: 'rotated', rawContent: s0.content, name: 'job.nc', size: 7, angle: 3 }));
        const s2 = reducer(s1, updateFileContent({ content: 'NEW', name: 'other.nc', size: 3 }));
        expect(s2.content).toBe('NEW');
        expect(s2.rotationApplied).toBe(false);
        expect(s2.rawContent).toBe('');
        expect(s2.appliedRotationAngle).toBe(0);
    });
});
