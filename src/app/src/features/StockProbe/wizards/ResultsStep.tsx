/*
 * Copyright (C) 2021 Sienci Labs Inc.
 *
 * This file is part of gSender.
 *
 * gSender is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, under version 3 of the License.
 */

import React from 'react';
import { FaCheck } from 'react-icons/fa';
import { Button } from 'app/components/Button';

interface CoordPosition {
    x: string;
    y: string;
    z: string;
}

interface ProbedDimensions {
    width?: number;
    length?: number;
    diameter?: number;
}

interface Props {
    wcsPosition: CoordPosition;
    machinePosition: CoordPosition;
    wcsIndex: number;
    probedDimensions?: ProbedDimensions;
    onRetry: () => void;
    onClose: () => void;
    isRotation?: boolean;
}

const CoordGrid: React.FC<{ label: string; pos: CoordPosition }> = ({ label, pos }) => (
    <div className="w-full bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm">
        <p className="text-gray-500 dark:text-gray-400 mb-2 text-xs">{label}</p>
        <div className="grid grid-cols-3 gap-2 text-center">
            {(['x', 'y', 'z'] as const).map((axis) => (
                <div key={axis}>
                    <span className="text-gray-500 text-xs">{axis.toUpperCase()}</span>
                    <p className="font-mono font-medium">{pos[axis]}</p>
                </div>
            ))}
        </div>
    </div>
);

const ResultsStep: React.FC<Props> = ({
    wcsPosition,
    machinePosition,
    probedDimensions,
    onRetry,
    onClose,
    isRotation = false,
}) => {
    return (
        <div className="flex flex-col items-center gap-4 py-2">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <FaCheck className="w-5 h-5" />
                <span className="font-semibold">Probing Complete</span>
            </div>

            {!isRotation && probedDimensions && (
                <div className="w-full bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm">
                    <p className="text-gray-500 dark:text-gray-400 mb-2 text-xs">Probed Stock Dimensions</p>
                    {probedDimensions.diameter !== undefined ? (
                        <p className="font-mono font-medium text-center">⌀ {probedDimensions.diameter.toFixed(3)} mm</p>
                    ) : (
                        <div className="grid grid-cols-2 gap-2 text-center">
                            {probedDimensions.width !== undefined && (
                                <div>
                                    <span className="text-gray-500 text-xs">Width</span>
                                    <p className="font-mono font-medium">{probedDimensions.width.toFixed(3)} mm</p>
                                </div>
                            )}
                            {probedDimensions.length !== undefined && (
                                <div>
                                    <span className="text-gray-500 text-xs">Length</span>
                                    <p className="font-mono font-medium">{probedDimensions.length.toFixed(3)} mm</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {!isRotation && (
                <CoordGrid label="Current WCS Position" pos={wcsPosition} />
            )}

            {!isRotation && (
                <CoordGrid label="Current Machine Position" pos={machinePosition} />
            )}

            {isRotation && (
                <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
                    Rotation measurement complete. Adjust workholding based on the measured angle, then re-probe as needed.
                </p>
            )}

            <div className="flex gap-2 mt-2">
                <Button variant="secondary" size="sm" onClick={onRetry}>Retry</Button>
                <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
            </div>
        </div>
    );
};

export default ResultsStep;
