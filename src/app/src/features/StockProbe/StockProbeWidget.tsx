/*
 * Copyright (C) 2021 Sienci Labs Inc.
 *
 * This file is part of gSender.
 *
 * gSender is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, under version 3 of the License.
 */

import React, { useMemo, useState } from 'react';
import includes from 'lodash/includes';
import { Button } from 'app/components/Button';
import { useTypedSelector } from 'app/hooks/useTypedSelector';
import {
    GRBL,
    GRBLHAL,
    GRBL_ACTIVE_STATE_IDLE,
    WORKFLOW_STATE_RUNNING,
} from 'app/constants';
import { getWidgetConfigContext } from '../WidgetConfig/WidgetContextProvider';
import { StockProbeSettings, ProbedDimensions, DEFAULT_SETTINGS } from './definitions';
import StockEditModal from './components/StockEditModal';
import ProbeRoutinesModal from './components/ProbeRoutinesModal';
import IndividualProbeModal from './components/IndividualProbeModal';
import RotationWizard from './wizards/RotationWizard';

type Modal = 'stockEdit' | 'probeRoutines' | 'individual' | 'rotation' | null;

/** 3-D top-down 45° stock icon */
const StockIcon: React.FC<{ stockType: 'rectangle' | 'round' }> = ({ stockType }) =>
    stockType === 'rectangle' ? (
        <svg viewBox="0 0 60 58" className="w-16 h-14 dark:invert" xmlns="http://www.w3.org/2000/svg">
            {/* Top-down 45° rectangular block */}
            <polygon points="4,34 42,34 56,18 18,18" fill="#d8e4f0" stroke="#506070" strokeWidth="1.5"/>
            <polygon points="4,34 42,34 42,52 4,52"  fill="#c0cdd8" stroke="#506070" strokeWidth="1.5"/>
            <polygon points="42,34 56,18 56,36 42,52" fill="#98aab8" stroke="#506070" strokeWidth="1.5"/>
        </svg>
    ) : (
        <svg viewBox="0 0 56 54" className="w-14 h-14 dark:invert" xmlns="http://www.w3.org/2000/svg">
            {/* 3D cylinder — top-down 45° */}
            <path d="M6,28 L6,44 A22,10 0 0,1 50,44 L50,28" fill="#c0cdd8" stroke="none"/>
            <path d="M6,44 A22,10 0 0,1 50,44" fill="none" stroke="#506070" strokeWidth="1.5"/>
            <line x1="6"  y1="28" x2="6"  y2="44" stroke="#506070" strokeWidth="1.5"/>
            <line x1="50" y1="28" x2="50" y2="44" stroke="#506070" strokeWidth="1.5"/>
            <ellipse cx="28" cy="28" rx="22" ry="10" fill="#d8e4f0" stroke="#506070" strokeWidth="1.5"/>
        </svg>
    );

const StockProbeWidget: React.FC = () => {
    const { actions: config } = getWidgetConfigContext();

    const [settings, setSettings] = useState<StockProbeSettings>(() => ({
        stockType:          config.get('stockType',          DEFAULT_SETTINGS.stockType),
        stockWidth:         config.get('stockWidth',         DEFAULT_SETTINGS.stockWidth),
        stockLength:        config.get('stockLength',        DEFAULT_SETTINGS.stockLength),
        stockDiameter:      config.get('stockDiameter',      DEFAULT_SETTINGS.stockDiameter),
        xyProbingHeight:    config.get('xyProbingHeight',    DEFAULT_SETTINGS.xyProbingHeight),
        bufferDistance:     config.get('bufferDistance',     DEFAULT_SETTINGS.bufferDistance),
        safeHeight:         config.get('safeHeight',         DEFAULT_SETTINGS.safeHeight),
        probeFeedrateFast:  config.get('probeFeedrateFast',  DEFAULT_SETTINGS.probeFeedrateFast),
        probeFeedrateSlow:  config.get('probeFeedrateSlow',  DEFAULT_SETTINGS.probeFeedrateSlow),
        retractDistance:    config.get('retractDistance',    DEFAULT_SETTINGS.retractDistance),
        connectivityTest:   config.get('connectivityTest',   DEFAULT_SETTINGS.connectivityTest),
        wcsIndex:           config.get('wcsIndex',           DEFAULT_SETTINGS.wcsIndex),
        lastProbedWidth:    config.get('lastProbedWidth',    DEFAULT_SETTINGS.lastProbedWidth),
        lastProbedLength:   config.get('lastProbedLength',   DEFAULT_SETTINGS.lastProbedLength),
        lastProbedDiameter: config.get('lastProbedDiameter', DEFAULT_SETTINGS.lastProbedDiameter),
        lastProbedAngle:    config.get('lastProbedAngle',    DEFAULT_SETTINGS.lastProbedAngle),
        lastProbedTimestamp:config.get('lastProbedTimestamp',DEFAULT_SETTINGS.lastProbedTimestamp),
    }));

    const probedDimensions: ProbedDimensions = {
        width:         settings.lastProbedWidth    ?? undefined,
        length:        settings.lastProbedLength   ?? undefined,
        diameter:      settings.lastProbedDiameter ?? undefined,
        rotationAngle: settings.lastProbedAngle    ?? undefined,
        timestamp:     settings.lastProbedTimestamp ?? undefined,
    };

    const [activeModal, setActiveModal] = useState<Modal>(null);

    const { activeState, controllerType, workflow, isConnected } = useTypedSelector((state) => ({
        activeState:    state.controller.state.status?.activeState ?? '',
        controllerType: state.controller.type,
        workflow:       state.controller.workflow,
        isConnected:    state.connection.isConnected ?? false,
    }));

    const canClick = useMemo(
        () =>
            isConnected &&
            includes([GRBL, GRBLHAL], controllerType) &&
            activeState === GRBL_ACTIVE_STATE_IDLE &&
            workflow.state !== WORKFLOW_STATE_RUNNING,
        [isConnected, controllerType, activeState, workflow],
    );

    const updateSetting = (key: keyof StockProbeSettings, value: unknown) => {
        setSettings((prev) => {
            config.set(key, value);
            return { ...prev, [key]: value };
        });
    };

    const isRect = settings.stockType === 'rectangle';

    // Stock dimension labels
    const roughDims = isRect
        ? `${settings.stockWidth} × ${settings.stockLength} mm`
        : `⌀ ${settings.stockDiameter} mm`;

    const hasProbedData = probedDimensions.timestamp != null;
    const probedDimsLabel = hasProbedData
        ? isRect
            ? `${(probedDimensions.width ?? 0).toFixed(1)} × ${(probedDimensions.length ?? 0).toFixed(1)} mm`
            : `⌀ ${(probedDimensions.diameter ?? 0).toFixed(1)} mm`
        : '—';

    return (
        <div className="w-full h-full grid grid-cols-[1fr_auto] gap-2 p-1.5">
            {/* ── Left: stock icon + dimensions ── */}
            <div className="flex items-center gap-2 min-w-0">
                <StockIcon stockType={settings.stockType} />
                <div className="min-w-0">
                    <p className="text-base font-semibold text-gray-700 dark:text-gray-200 truncate capitalize">
                        {settings.stockType}
                    </p>
                    <p className="text-base text-gray-600 dark:text-gray-300 truncate" title={`Rough: ${roughDims}`}>
                        <span className="text-gray-400 dark:text-gray-500">R: </span>{roughDims}
                    </p>
                    <p className="text-base text-gray-600 dark:text-gray-300 truncate" title={hasProbedData ? `Probed: ${probedDimsLabel}` : 'Not probed'}>
                        <span className={hasProbedData ? 'text-green-500' : 'text-gray-400 dark:text-gray-500'}>
                            P:{' '}
                        </span>
                        {probedDimsLabel}
                    </p>
                    <Button
                        variant="ghost"
                        size="mini"
                        className="text-sm px-0 h-auto underline text-blue-500 hover:text-blue-600"
                        onClick={() => setActiveModal('stockEdit')}
                    >
                        Edit
                    </Button>
                </div>
            </div>

            {/* ── Right: wizard buttons — stretch full height ── */}
            <div className="flex flex-col gap-1.5 h-full">
                <Button
                    variant="primary"
                    disabled={!canClick}
                    onClick={() => setActiveModal('probeRoutines')}
                    className="flex-1 text-sm whitespace-nowrap px-3"
                >
                    Probe Routines
                </Button>
                <Button
                    variant="secondary"
                    disabled={!canClick}
                    onClick={() => setActiveModal('individual')}
                    className="flex-1 text-sm whitespace-nowrap px-3"
                >
                    Individual
                </Button>
                {isRect && (
                    <Button
                        variant="secondary"
                        disabled={!canClick}
                        onClick={() => setActiveModal('rotation')}
                        className="flex-1 text-sm whitespace-nowrap px-3"
                    >
                        Rotation
                    </Button>
                )}
            </div>

            {/* ── Modals ── */}
            <StockEditModal
                isOpen={activeModal === 'stockEdit'}
                onClose={() => setActiveModal(null)}
                settings={settings}
                onUpdate={updateSetting}
            />
            <ProbeRoutinesModal
                isOpen={activeModal === 'probeRoutines'}
                onClose={() => setActiveModal(null)}
                settings={settings}
                onSettingsUpdate={updateSetting}
            />
            <IndividualProbeModal
                isOpen={activeModal === 'individual'}
                onClose={() => setActiveModal(null)}
                settings={settings}
                onSettingsUpdate={updateSetting}
            />
            <RotationWizard
                isOpen={activeModal === 'rotation'}
                onClose={() => setActiveModal(null)}
                settings={settings}
                onSettingsUpdate={updateSetting}
            />
        </div>
    );
};

export default StockProbeWidget;
