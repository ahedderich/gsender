import reducer, {
    updateFileContent,
    setGcodeTransforms,
} from 'app/store/redux/slices/fileInfo.slice';
import { HeightmapData } from '../definitions';

const HM: HeightmapData = {
    shape: 'rectangle', originX: 0, originY: 0, stepX: 10, stepY: 10,
    cols: 2, rows: 2, resolution: 10, z: [0, 1, 1, 2],
};

const loaded = () =>
    reducer(undefined, updateFileContent({ content: 'ORIG', name: 'job.nc', size: 4 }));

const tx = (over: Partial<Parameters<typeof setGcodeTransforms>[0]>) =>
    setGcodeTransforms({
        content: 'X', name: 'job.nc', size: 1,
        rotationApplied: false, appliedRotationAngle: 0,
        heightmapApplied: false, heightmapData: null,
        ...over,
    });

describe('fileInfo slice — unified gcode transforms', () => {
    it('captures the pristine original on load', () => {
        const s = loaded();
        expect(s.content).toBe('ORIG');
        expect(s.rawContent).toBe('ORIG');
        expect(s.rotationApplied).toBe(false);
        expect(s.heightmapApplied).toBe(false);
    });

    it('applies rotation without touching rawContent', () => {
        const s = reducer(loaded(), tx({ content: 'ROT', rotationApplied: true, appliedRotationAngle: 3 }));
        expect(s.content).toBe('ROT');
        expect(s.rawContent).toBe('ORIG');
        expect(s.rotationApplied).toBe(true);
        expect(s.appliedRotationAngle).toBe(3);
        expect(s.heightmapApplied).toBe(false);
    });

    it('applies heightmap independently of rotation', () => {
        const s = reducer(loaded(), tx({ content: 'HM', heightmapApplied: true, heightmapData: HM }));
        expect(s.content).toBe('HM');
        expect(s.rawContent).toBe('ORIG');
        expect(s.heightmapApplied).toBe(true);
        expect(s.heightmapData).toEqual(HM);
        expect(s.rotationApplied).toBe(false);
    });

    it('applies both transforms together', () => {
        const s = reducer(loaded(), tx({
            content: 'BOTH', rotationApplied: true, appliedRotationAngle: 3,
            heightmapApplied: true, heightmapData: HM,
        }));
        expect(s.content).toBe('BOTH');
        expect(s.rawContent).toBe('ORIG');
        expect(s.rotationApplied).toBe(true);
        expect(s.heightmapApplied).toBe(true);
    });

    it('reverts one transform while keeping the other', () => {
        const both = reducer(loaded(), tx({
            content: 'BOTH', rotationApplied: true, appliedRotationAngle: 3,
            heightmapApplied: true, heightmapData: HM,
        }));
        // Revert rotation only (compose now heightmap-only).
        const s = reducer(both, tx({ content: 'HM_ONLY', heightmapApplied: true, heightmapData: HM }));
        expect(s.content).toBe('HM_ONLY');
        expect(s.rotationApplied).toBe(false);
        expect(s.heightmapApplied).toBe(true);
        expect(s.rawContent).toBe('ORIG');
    });

    it('preserves transforms when the re-upload echoes the same content', () => {
        const s1 = reducer(loaded(), tx({ content: 'ROT', rotationApplied: true, appliedRotationAngle: 3 }));
        const s2 = reducer(s1, updateFileContent({ content: 'ROT', name: 'job.nc', size: 3 }));
        expect(s2.rotationApplied).toBe(true);
        expect(s2.rawContent).toBe('ORIG');
    });

    it('loading a different file resets transforms and recaptures the original', () => {
        const s1 = reducer(loaded(), tx({ content: 'ROT', rotationApplied: true, appliedRotationAngle: 3 }));
        const s2 = reducer(s1, updateFileContent({ content: 'NEW', name: 'other.nc', size: 3 }));
        expect(s2.content).toBe('NEW');
        expect(s2.rawContent).toBe('NEW');
        expect(s2.rotationApplied).toBe(false);
        expect(s2.heightmapApplied).toBe(false);
        expect(s2.heightmapData).toBe(null);
    });
});
