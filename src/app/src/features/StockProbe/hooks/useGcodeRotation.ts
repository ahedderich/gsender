import { shallowEqual } from 'react-redux';
import { useTypedSelector } from 'app/hooks/useTypedSelector';
import { store as reduxStore } from 'app/store/redux';
import {
    applyGcodeRotation,
    revertGcodeRotation,
} from 'app/store/redux/slices/fileInfo.slice';
import controller from 'app/lib/controller';
import { uploadGcodeFileToServer } from 'app/lib/fileupload';
import { toast } from 'app/lib/toaster';
import { VISUALIZER_PRIMARY, WORKFLOW_STATE_RUNNING } from 'app/constants';
import { rotateGcodeXY } from '../gcode/rotateGcode';

interface UseGcodeRotation {
    fileLoaded: boolean;
    rotationApplied: boolean;
    appliedRotationAngle: number;
    /** True when a measured angle could be applied to the loaded program. */
    canApply: boolean;
    /** Apply the measured stock rotation to the loaded gcode (re-uploads it). */
    apply: (measuredAngleDeg: number) => Promise<void>;
    /** Restore the original (pre-rotation) gcode. */
    revert: () => Promise<void>;
}

/**
 * Apply / revert a measured stock rotation on the loaded G-code program.
 *
 * The toolpath is rotated about the work origin (0,0) in the SAME direction the
 * stock is physically crooked. The measured angle is CW-positive (a 3° CCW stock
 * reads −3°), so the applied CCW rotation is `φ = -measured`.
 *
 * Mirrors the G-code editor's Save: re-uploads to the controller so the running
 * job actually changes, and updates the Redux file mirror for the visualizer.
 */
export function useGcodeRotation(): UseGcodeRotation {
    const { content, rawContent, name, fileLoaded, rotationApplied, appliedRotationAngle, isJobRunning } =
        useTypedSelector((state) => ({
            content:              state.file.content,
            rawContent:           state.file.rawContent,
            name:                 state.file.name,
            fileLoaded:           state.file.fileLoaded,
            rotationApplied:      state.file.rotationApplied,
            appliedRotationAngle: state.file.appliedRotationAngle,
            isJobRunning:         state.controller.workflow.state === WORKFLOW_STATE_RUNNING,
        }), shallowEqual);

    const fileName = name || 'rotated.gcode';

    const apply = async (measuredAngleDeg: number): Promise<void> => {
        if (isJobRunning) {
            toast.error('Cannot modify g-code while a job is running', { position: 'bottom-right' });
            return;
        }
        if (!fileLoaded || !content) {
            toast.error('Load a g-code file before applying rotation', { position: 'bottom-right' });
            return;
        }
        if (!Number.isFinite(measuredAngleDeg) || measuredAngleDeg === 0) {
            toast.error('No rotation angle to apply', { position: 'bottom-right' });
            return;
        }
        try {
            // Always transform from the original so re-applying a corrected angle
            // does not compound rotations.
            const base = rotationApplied ? rawContent : content;
            const phi = -measuredAngleDeg; // CCW rotation matching the stock
            const rotated = rotateGcodeXY(base, phi);
            const file = new File([rotated], fileName);
            await uploadGcodeFileToServer(file, controller.port, VISUALIZER_PRIMARY);
            reduxStore.dispatch(
                applyGcodeRotation({
                    content: rotated,
                    rawContent: base,
                    name: fileName,
                    size: new Blob([rotated]).size,
                    angle: phi,
                }),
            );
            toast.success(`Applied ${phi.toFixed(3)}° rotation to loaded g-code`, { position: 'bottom-right' });
        } catch (err) {
            toast.error('Failed to apply rotation to g-code', { position: 'bottom-right' });
        }
    };

    const revert = async (): Promise<void> => {
        if (isJobRunning) {
            toast.error('Cannot modify g-code while a job is running', { position: 'bottom-right' });
            return;
        }
        if (!rotationApplied || !rawContent) {
            return;
        }
        try {
            const file = new File([rawContent], fileName);
            await uploadGcodeFileToServer(file, controller.port, VISUALIZER_PRIMARY);
            reduxStore.dispatch(
                revertGcodeRotation({ content: rawContent, name: fileName, size: new Blob([rawContent]).size }),
            );
            toast.success('Reverted g-code to original', { position: 'bottom-right' });
        } catch (err) {
            toast.error('Failed to revert g-code', { position: 'bottom-right' });
        }
    };

    return {
        fileLoaded,
        rotationApplied,
        appliedRotationAngle,
        canApply: fileLoaded && !rotationApplied,
        apply,
        revert,
    };
}
