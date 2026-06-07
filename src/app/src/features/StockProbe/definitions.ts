/*
 * Copyright (C) 2021 Sienci Labs Inc.
 *
 * This file is part of gSender.
 *
 * gSender is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, under version 3 of the License.
 *
 * gSender is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with gSender.  If not, see <https://www.gnu.org/licenses/>.
 */

export interface ProbeTask {
    label: string;
    commands: string[];
}

export type StockType = 'rectangle' | 'round';
export type EdgeSelection = 'X+' | 'X-' | 'Y+' | 'Y-';
export type SideSelection = 'top' | 'bottom' | 'left' | 'right';
export type WizardStep = 'intro' | 'connectivity' | 'executing' | 'results' | 'failed';
export type CornerSelection = 'BL' | 'TL' | 'TR' | 'BR';
export type ProbeDirection = 'towards_center' | 'away_from_center';

export interface StockProbeSettings {
    stockType: StockType;
    stockWidth: number;
    stockLength: number;
    stockDiameter: number;
    xyProbingHeight: number; // negative mm, e.g. -2
    bufferDistance: number;
    safeHeight: number;      // mm above probed Z=0 for safe travel between XY moves
    probeFeedrateFast: number;
    probeFeedrateSlow: number;
    retractDistance: number;
    connectivityTest: boolean;
    wcsIndex: number; // 1-6 → G54-G59
    rotationEdgeOffset: number; // mm inset from each end of the probed side to avoid missing a rotated corner
    lastProbedWidth: number | null;
    lastProbedLength: number | null;
    lastProbedDiameter: number | null;
    lastProbedAngle: number | null;
    lastProbedTimestamp: number | null;
}

export interface ProbedDimensions {
    width?: number;
    length?: number;
    diameter?: number;
    rotationAngle?: number;
    timestamp?: number;
}

export interface StockProbeGCodeParams {
    probeFeedrateFast: number;
    probeFeedrateSlow: number;
    travelFeedrate: number;
    retractDistance: number;
    bufferDistance: number;
    xyProbingHeight: number;
    wcsIndex: number;
    safeHeight?: number; // mm above probed Z=0 for safe travel, default 10
}

export interface RectProbeParams extends StockProbeGCodeParams {
    stockWidth: number;
    stockLength: number;
}

export interface RoundProbeParams extends StockProbeGCodeParams {
    stockDiameter: number;
}

export interface CornerProbeParams extends StockProbeGCodeParams {
    corner: CornerSelection;
}

export interface EdgeProbeParams extends StockProbeGCodeParams {
    edge: EdgeSelection;
}

export interface RotationProbeParams extends StockProbeGCodeParams {
    measuringLength: number;
    stockWidth: number;
    stockLength: number;
    probingZHeight: number;
    direction: ProbeDirection;
    side: SideSelection;
    rotationEdgeOffset?: number; // mm inset from each end of the side, default 15
}

export const DEFAULT_SETTINGS: StockProbeSettings = {
    stockType: 'rectangle',
    stockWidth: 100,
    stockLength: 100,
    stockDiameter: 100,
    xyProbingHeight: -2,
    bufferDistance: 20,
    safeHeight: 10,
    probeFeedrateFast: 200,
    probeFeedrateSlow: 75,
    retractDistance: 2,
    connectivityTest: true,
    wcsIndex: 1,
    rotationEdgeOffset: 15,
    lastProbedWidth: null,
    lastProbedLength: null,
    lastProbedDiameter: null,
    lastProbedAngle: null,
    lastProbedTimestamp: null,
};
