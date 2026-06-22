import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { BBox } from 'app/definitions/general';
import { METRIC_UNITS, RENDER_NO_FILE } from 'app/constants';
import { FileInfoState } from 'app/store/definitions';

const initialState: FileInfoState = {
    fileLoaded: false,
    fileProcessing: false,
    renderState: RENDER_NO_FILE,
    name: null,
    path: '',
    size: 0,
    total: 0,
    toolSet: [],
    spindleSet: [],
    movementSet: [],
    invalidGcode: [],
    estimatedTime: 0,
    fileModal: METRIC_UNITS,
    bbox: {
        min: { x: 0, y: 0, z: 0, a: 0 },
        max: { x: 0, y: 0, z: 0, a: 0 },
        delta: { x: 0, y: 0, z: 0, a: 0 },
    },
    content: '',
    fileType: null,
    usedAxes: [],
    rawContent: '',
    rotationApplied: false,
    appliedRotationAngle: 0,
};

const normalizeBBox = (bbox: Partial<BBox>): BBox => {
    const defaultBBox: BBox = {
        min: { x: 0, y: 0, z: 0, a: 0 },
        max: { x: 0, y: 0, z: 0, a: 0 },
        delta: { x: 0, y: 0, z: 0, a: 0 },
    };
    return {
        ...defaultBBox,
        ...bbox,
    };
};

const fileInfoSlice = createSlice({
    name: 'fileInfo',
    initialState,
    reducers: {
        unloadFileInfo: () => {
            return initialState;
        },
        updateFileInfo: (
            state,
            action: PayloadAction<Partial<FileInfoState>>,
        ) => {
            const bbox = action.payload.bbox
                ? { bbox: normalizeBBox(action.payload.bbox) }
                : {};
            return {
                ...state,
                ...action.payload,
                fileLoaded: true,
                fileProcessing: false,
                ...bbox,
            };
        },
        updateFileContent: (
            state,
            action: PayloadAction<{
                content: string;
                name: string;
                size: number;
            }>,
        ) => {
            const { content, name, size } = action.payload;
            // Re-uploading a rotated program echoes back through file:load →
            // updateFileContent. Detect that echo (same content we just applied) so
            // it does not wipe the rotation bookkeeping; any other (new) program clears it.
            const isRotationEcho = state.rotationApplied && content === state.content;
            state.fileLoaded = true;
            state.content = content;
            state.name = name;
            state.size = size;
            if (!isRotationEcho) {
                state.rawContent = '';
                state.rotationApplied = false;
                state.appliedRotationAngle = 0;
            }
        },
        applyGcodeRotation: (
            state,
            action: PayloadAction<{
                content: string;
                rawContent: string;
                name: string;
                size: number;
                angle: number;
            }>,
        ) => {
            const { content, rawContent, name, size, angle } = action.payload;
            // Keep the very first backup so re-applying (with a corrected angle)
            // never overwrites the true original.
            if (!state.rotationApplied) {
                state.rawContent = rawContent;
            }
            state.content = content;
            state.name = name;
            state.size = size;
            state.fileLoaded = true;
            state.rotationApplied = true;
            state.appliedRotationAngle = angle;
        },
        revertGcodeRotation: (
            state,
            action: PayloadAction<{ content: string; name: string; size: number }>,
        ) => {
            // `content` (the original) is passed in rather than read from
            // state.rawContent: the revert re-upload echoes through updateFileContent,
            // which may have already cleared rawContent by the time this runs.
            const { content, name, size } = action.payload;
            state.content = content;
            state.name = name;
            state.size = size;
            state.rawContent = '';
            state.rotationApplied = false;
            state.appliedRotationAngle = 0;
        },
        updateFileProcessing: (
            state,
            action: PayloadAction<{ fileProcessing: boolean }>,
        ) => {
            state.fileProcessing = action.payload.fileProcessing;
        },
        updateFileRenderState: (
            state,
            action: PayloadAction<{ renderState: string }>,
        ) => {
            state.renderState = action.payload.renderState;
        },
    },
});

export const {
    unloadFileInfo,
    updateFileInfo,
    updateFileContent,
    updateFileProcessing,
    updateFileRenderState,
    applyGcodeRotation,
    revertGcodeRotation,
} = fileInfoSlice.actions;

export default fileInfoSlice.reducer;
