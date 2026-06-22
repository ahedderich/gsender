import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { BBox } from 'app/definitions/general';
import { METRIC_UNITS, RENDER_NO_FILE } from 'app/constants';
import { FileInfoState } from 'app/store/definitions';
import { HeightmapData } from 'app/features/StockProbe/definitions';

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
    heightmapApplied: false,
    heightmapData: null,
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
            // Re-uploading a transformed program echoes back through file:load →
            // updateFileContent. Detect that echo (same content we just composed) so it
            // does not wipe the transform bookkeeping; any other (new) program resets it
            // and captures the new pristine original.
            const anyApplied = state.rotationApplied || state.heightmapApplied;
            const isEcho = anyApplied && content === state.content;
            state.fileLoaded = true;
            state.content = content;
            state.name = name;
            state.size = size;
            if (!isEcho) {
                state.rawContent = content;
                state.rotationApplied = false;
                state.appliedRotationAngle = 0;
                state.heightmapApplied = false;
                state.heightmapData = null;
            }
        },
        // Set the composed content + the full transform flag set in one shot. `rawContent`
        // (the pristine original) is owned by updateFileContent and never touched here, so
        // content can always be rebuilt by composing the active transforms from it.
        setGcodeTransforms: (
            state,
            action: PayloadAction<{
                content: string;
                name: string;
                size: number;
                rotationApplied: boolean;
                appliedRotationAngle: number;
                heightmapApplied: boolean;
                heightmapData: HeightmapData | null;
            }>,
        ) => {
            const { content, name, size, rotationApplied, appliedRotationAngle, heightmapApplied, heightmapData } = action.payload;
            state.content = content;
            state.name = name;
            state.size = size;
            state.fileLoaded = true;
            state.rotationApplied = rotationApplied;
            state.appliedRotationAngle = appliedRotationAngle;
            state.heightmapApplied = heightmapApplied;
            state.heightmapData = heightmapData;
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
    setGcodeTransforms,
} = fileInfoSlice.actions;

export default fileInfoSlice.reducer;
