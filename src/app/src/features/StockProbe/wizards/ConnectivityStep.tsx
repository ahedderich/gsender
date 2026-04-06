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
import ProbeCircuitStatus from '../../Probe/ProbeCircuitStatus';

interface Props {
    probePinStatus: boolean;
    isConnected: boolean;
}

const ConnectivityStep: React.FC<Props> = ({ probePinStatus, isConnected }) => {
    return (
        <div className="flex flex-col items-center gap-4 py-4">
            <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
                Momentarily touch the probe to the spindle / collet to verify the circuit is working, then remove it before starting.
            </p>
            <ProbeCircuitStatus probeActive={probePinStatus} connected={isConnected} />
            {probePinStatus && (
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                    Circuit verified — ready to probe.
                </p>
            )}
        </div>
    );
};

export default ConnectivityStep;
