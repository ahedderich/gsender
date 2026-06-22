import { shallowEqual } from 'react-redux';
import { useTypedSelector } from 'app/hooks/useTypedSelector';
import { store as reduxStore } from 'app/store/redux';
import { setGcodeTransforms } from 'app/store/redux/slices/fileInfo.slice';
import controller from 'app/lib/controller';
import { uploadGcodeFileToServer } from 'app/lib/fileupload';
import { toast } from 'app/lib/toaster';
import { VISUALIZER_PRIMARY, WORKFLOW_STATE_RUNNING } from 'app/constants';
import { HeightmapData } from '../definitions';
import { composeGcode, TransformState } from '../gcode/composeGcode';

interface UseGcodeTransforms {
    fileLoaded: boolean;
    rotationApplied: boolean;
    heightmapApplied: boolean;
    appliedRotationAngle: number;
    /** Apply the measured stock rotation (CW-positive) to the loaded gcode. */
    applyRotation: (measuredAngleDeg: number) => Promise<void>;
    revertRotation: () => Promise<void>;
    /** Apply a probed heightmap (Z autolevel) to the loaded gcode. */
    applyHeightmap: (data: HeightmapData) => Promise<void>;
    revertHeightmap: () => Promise<void>;
}

/**
 * Apply / revert the two independent g-code transforms — rotation (X/Y) and
 * heightmap (Z autolevel). Both are derived by re-composing from the pristine
 * `rawContent`, so they can be toggled in any combination without compounding or
 * conflicting. Each change re-uploads the composed program (mirroring the G-code
 * editor's Save) so the running job is updated, not just the visualizer.
 */
export function useGcodeTransforms(): UseGcodeTransforms {
    const s = useTypedSelector((state) => ({
        rawContent:           state.file.rawContent,
        content:              state.file.content,
        name:                 state.file.name,
        fileLoaded:           state.file.fileLoaded,
        rotationApplied:      state.file.rotationApplied,
        appliedRotationAngle: state.file.appliedRotationAngle,
        heightmapApplied:     state.file.heightmapApplied,
        heightmapData:        state.file.heightmapData,
        isJobRunning:         state.controller.workflow.state === WORKFLOW_STATE_RUNNING,
    }), shallowEqual);

    const fileName = s.name || 'transformed.gcode';

    const current: TransformState = {
        rotationApplied:      s.rotationApplied,
        appliedRotationAngle: s.appliedRotationAngle,
        heightmapApplied:     s.heightmapApplied,
        heightmapData:        s.heightmapData,
    };

    /** Recompose from rawContent with the next transform set and re-upload. */
    const rebuild = async (next: TransformState): Promise<void> => {
        if (s.isJobRunning) {
            toast.error('Cannot modify g-code while a job is running', { position: 'bottom-right' });
            return;
        }
        if (!s.fileLoaded || !s.rawContent) {
            toast.error('Load a g-code file first', { position: 'bottom-right' });
            return;
        }
        const composed = composeGcode(s.rawContent, next);
        // Dispatch first so state reflects the new transforms before the re-upload
        // echoes back through updateFileContent (which would otherwise treat the
        // composed content as a fresh file and reset rawContent).
        reduxStore.dispatch(setGcodeTransforms({
            content: composed, name: fileName, size: new Blob([composed]).size, ...next,
        }));
        try {
            await uploadGcodeFileToServer(new File([composed], fileName), controller.port, VISUALIZER_PRIMARY);
        } catch (err) {
            // Roll back to the previous composed state on upload failure.
            const prev = composeGcode(s.rawContent, current);
            reduxStore.dispatch(setGcodeTransforms({
                content: prev, name: fileName, size: new Blob([prev]).size, ...current,
            }));
            toast.error('Failed to update g-code', { position: 'bottom-right' });
        }
    };

    const applyRotation = async (measuredAngleDeg: number): Promise<void> => {
        if (!Number.isFinite(measuredAngleDeg) || measuredAngleDeg === 0) {
            toast.error('No rotation angle to apply', { position: 'bottom-right' });
            return;
        }
        // CW-positive measured angle → CCW rotation to match the stock.
        await rebuild({ ...current, rotationApplied: true, appliedRotationAngle: -measuredAngleDeg });
    };

    const revertRotation = async (): Promise<void> => {
        if (!s.rotationApplied) return;
        await rebuild({ ...current, rotationApplied: false, appliedRotationAngle: 0 });
    };

    const applyHeightmap = async (data: HeightmapData): Promise<void> => {
        if (!data || data.z.length === 0) {
            toast.error('No heightmap to apply', { position: 'bottom-right' });
            return;
        }
        await rebuild({ ...current, heightmapApplied: true, heightmapData: data });
    };

    const revertHeightmap = async (): Promise<void> => {
        if (!s.heightmapApplied) return;
        await rebuild({ ...current, heightmapApplied: false, heightmapData: null });
    };

    return {
        fileLoaded: s.fileLoaded,
        rotationApplied: s.rotationApplied,
        heightmapApplied: s.heightmapApplied,
        appliedRotationAngle: s.appliedRotationAngle,
        applyRotation,
        revertRotation,
        applyHeightmap,
        revertHeightmap,
    };
}
