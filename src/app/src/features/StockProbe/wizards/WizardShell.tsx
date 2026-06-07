/*
 * Copyright (C) 2021 Sienci Labs Inc.
 *
 * This file is part of gSender.
 *
 * gSender is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, under version 3 of the License.
 */

import React, { useEffect, useRef, useState } from 'react';
import cx from 'classnames';
import { FaCheck, FaTimes } from 'react-icons/fa';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from 'app/components/shadcn/Dialog';
import { Button } from 'app/components/Button';
import { useTypedSelector } from 'app/hooks/useTypedSelector';
import { GRBL_ACTIVE_STATE_IDLE, GRBL_ACTIVE_STATE_ALARM } from 'app/constants';
import { FeederStatus } from 'app/lib/definitions/sender_feeder';
import { GRBL_ALARMS } from '../../../../../server/controllers/Grbl/constants';
import controller from 'app/lib/controller';
import ResultsStep from './ResultsStep';
import { ProbeTask, WizardStep } from '../definitions';
import { getSharedContextInjectionLines, setSharedProbeContext } from '../sharedProbeContext';

interface ProbedDimensions {
    width?: number;
    length?: number;
    diameter?: number;
    rotationAngle?: number;
}

interface Props {
    title: string;
    isOpen: boolean;
    onClose: () => void;
    onBack?: () => void;
    introContent: React.ReactNode;
    connectivityTest: boolean;
    onExecute: () => ProbeTask[];
    showXY?: boolean;
    showZ?: boolean;
    isRotation?: boolean;
    wcsIndex: number;
    probedDimensions?: ProbedDimensions;
    onProbeComplete?: (vars: Record<string, number>) => void;
}

const STEP_LABELS: Record<WizardStep, string> = {
    intro:        'Setup',
    connectivity: 'Check Probe',
    executing:    'Probing',
    results:      'Results',
    failed:       'Failed',
};

const VISIBLE_STEPS: WizardStep[] = ['intro', 'executing', 'results'];

const WizardShell: React.FC<Props> = ({
    title,
    isOpen,
    onClose,
    onBack,
    introContent,
    connectivityTest,
    onExecute,
    showXY = false,
    showZ = false,
    isRotation = false,
    wcsIndex,
    probedDimensions,
    onProbeComplete,
}) => {
    const [step, setStep] = useState<WizardStep>('intro');
    const [probeVerified, setProbeVerified] = useState(false);
    const [alarmCode, setAlarmCode] = useState<number | null>(null);

    const [taskLabels, setTaskLabels] = useState<string[]>([]);
    const [currentTaskIdx, setCurrentTaskIdx] = useState(0);

    // Refs for per-task execution tracking.
    const tasksRef          = useRef<ProbeTask[]>([]);
    const currentTaskIdxRef = useRef(0);
    // Accumulates [MSG:KEY=VALUE] lines received during execution.
    const msgVarsRef        = useRef<Record<string, number>>({});
    // Mirror of `step` kept in sync via a useEffect so the completion effect can read the
    // current step value without listing `step` as a dependency (which would trigger it on
    // step→'executing' with stale feederStatus and cause a false-positive advance).
    const stepRef           = useRef<WizardStep>('intro');

    const { activeState, probePinStatus, isConnected, wpos, mpos, rawAlarmCode, feederStatus } = useTypedSelector((state) => ({
        activeState:    state.controller.state.status?.activeState ?? 'Idle',
        probePinStatus: state.controller.state.status?.pinState.P ?? false,
        isConnected:    state.connection.isConnected ?? false,
        wpos:           state.controller.state.status?.wpos ?? { x: '0.000', y: '0.000', z: '0.000' },
        mpos:           state.controller.mpos ?? { x: 0, y: 0, z: 0 },
        rawAlarmCode:   state.controller.state.status?.alarmCode ?? null,
        feederStatus:   state.controller.feeder.status as FeederStatus | null,
    }));

    // Keep stepRef in sync so the completion effect can read the current step via a ref
    // instead of closing over the state value (which would require 'step' as a dependency).
    useEffect(() => { stepRef.current = step; }, [step]);

    // Latch probe verification: once touched, stay verified until dialog resets
    useEffect(() => {
        if (probePinStatus && step === 'intro') {
            setProbeVerified(true);
        }
    }, [probePinStatus, step]);

    // Mount-time listener: capture [MSG:KEY=VALUE] lines emitted by (MSG, KEY=VALUE) gcode.
    useEffect(() => {
        const handler = (data: string) => {
            if (typeof data !== 'string') return;
            const m = data.trim().match(/^\[MSG:([A-Za-z_]\w*)\s*=\s*([-\d.]+)\]$/);
            if (m) msgVarsRef.current[m[1]] = parseFloat(m[2]);
        };
        controller.addListener('serialport:read', handler);
        return () => controller.removeListener('serialport:read', handler);
    }, []);

    // Detect alarm during probing → abort to failed step
    useEffect(() => {
        if (step === 'executing' && activeState === GRBL_ACTIVE_STATE_ALARM) {
            controller.command('probe:context:end');
            setAlarmCode(rawAlarmCode !== null ? Number(rawAlarmCode) : null);
            setStep('failed');
        }
    }, [activeState, step, rawAlarmCode]);

    // Per-task completion: feeder drained (queue === 0, not pending) AND machine idle.
    //
    // Intentionally excludes `step` from the dependency array. If `step` were listed, this
    // effect would fire the moment step transitions to 'executing', at which point feederStatus
    // still reflects the pre-submission state (queue === 0) — triggering a false advance.
    // By using stepRef.current instead, the effect only re-runs when feederStatus or activeState
    // actually changes, which is guaranteed to happen AFTER the server has received and begun
    // processing the submitted gcode (feeder:status updates arrive ~500 ms after the server timer).
    useEffect(() => {
        if (
            stepRef.current === 'executing' &&
            feederStatus !== null &&
            feederStatus.queue === 0 &&
            !feederStatus.pending &&
            activeState === GRBL_ACTIVE_STATE_IDLE
        ) {
            const tasks   = tasksRef.current;
            const nextIdx = currentTaskIdxRef.current + 1;

            if (nextIdx < tasks.length) {
                currentTaskIdxRef.current = nextIdx;
                setCurrentTaskIdx(nextIdx);
                controller.command('gcode:safe', tasks[nextIdx].commands, 'G21');
            } else {
                controller.command('probe:context:end');
                setStep('results');
                setSharedProbeContext(msgVarsRef.current);
                onProbeComplete?.(msgVarsRef.current);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [feederStatus, activeState]);

    const executeProbe = () => {
        const tasks = onExecute();
        const injectionLines = getSharedContextInjectionLines();
        if (injectionLines.length > 0 && tasks.length > 0) {
            tasks[0] = { ...tasks[0], commands: [...injectionLines, ...tasks[0].commands] };
        }
        tasksRef.current          = tasks;
        currentTaskIdxRef.current = 0;
        msgVarsRef.current        = {};
        setTaskLabels(tasks.map((t) => t.label));
        setCurrentTaskIdx(0);
        setStep('executing');
        controller.command('probe:context:start');
        controller.command('gcode:safe', tasks[0].commands, 'G21');
    };

    const handleRetry = () => {
        controller.command('probe:context:end');
        tasksRef.current          = [];
        currentTaskIdxRef.current = 0;
        setStep('intro');
        setProbeVerified(false);
        setAlarmCode(null);
        setTaskLabels([]);
        setCurrentTaskIdx(0);
    };

    const handleClose = () => {
        tasksRef.current          = [];
        currentTaskIdxRef.current = 0;
        setStep('intro');
        setProbeVerified(false);
        setAlarmCode(null);
        setTaskLabels([]);
        setCurrentTaskIdx(0);
        onClose();
    };

    const canStart = !connectivityTest || probeVerified;
    const currentTaskLabel = taskLabels[currentTaskIdx] ?? '';

    const alarmInfo = alarmCode !== null
        ? (GRBL_ALARMS.find((a: { code: number }) => a.code === alarmCode) ?? null)
        : null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>

                {/* ── Step progress indicator ── */}
                <div className="flex items-center gap-1 mb-3">
                    {VISIBLE_STEPS.map((s, i) => {
                        const isFailed  = step === 'failed';
                        const isActive  = step === s || (isFailed && s === 'results');
                        const isDone    = !isFailed && VISIBLE_STEPS.indexOf(step) > i;
                        return (
                            <React.Fragment key={s}>
                                <div className={`flex items-center gap-1.5 text-xs ${
                                    isActive
                                        ? isFailed && s === 'results'
                                            ? 'text-red-600 dark:text-red-400 font-semibold'
                                            : 'text-blue-600 dark:text-blue-400 font-semibold'
                                        : isDone
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-gray-400'
                                }`}>
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs border ${
                                        isActive
                                            ? isFailed && s === 'results'
                                                ? 'border-red-500 bg-red-50 dark:bg-red-900/30'
                                                : 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                                            : isDone
                                            ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                                            : 'border-gray-300 dark:border-gray-600'
                                    }`}>
                                        {i + 1}
                                    </span>
                                    <span className="hidden sm:inline">
                                        {isFailed && s === 'results' ? STEP_LABELS['failed'] : STEP_LABELS[s]}
                                    </span>
                                </div>
                                {i < VISIBLE_STEPS.length - 1 && (
                                    <div className={`flex-1 h-px ${
                                        isDone
                                            ? 'bg-green-400'
                                            : 'bg-gray-200 dark:bg-gray-700'
                                    }`} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* ── Step 1: Setup (intro + optional connectivity check) ── */}
                {step === 'intro' && (
                    <div className="flex flex-col gap-6">
                        {introContent}

                        {/* Connectivity status card */}
                        {connectivityTest && (
                            <div className={cx(
                                'rounded-lg border px-4 py-3 flex items-center gap-3 transition-colors',
                                probeVerified
                                    ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40',
                            )}>
                                <div className={cx(
                                    'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
                                    probeVerified ? 'bg-green-500' : 'bg-red-400',
                                )}>
                                    {probeVerified
                                        ? <FaCheck className="w-3.5 h-3.5 text-white"/>
                                        : <FaTimes className="w-3.5 h-3.5 text-white"/>
                                    }
                                </div>
                                <p className="text-sm leading-snug">
                                    {probeVerified
                                        ? <span className="text-green-600 dark:text-green-400 font-semibold">Circuit verified — ready to start</span>
                                        : <span className="text-gray-600 dark:text-gray-300">Touch the probe to the spindle to verify the circuit, then remove it before probing.</span>
                                    }
                                </p>
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            {onBack
                                ? <Button variant="outline" onClick={onBack}>← Back</Button>
                                : <div/>
                            }
                            <Button variant="primary" onClick={executeProbe} disabled={!canStart}>
                                Start Probing
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── Step 2: Probing ── */}
                {step === 'executing' && (
                    <div className="flex flex-col items-center gap-5 py-8">
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                        <div className="text-center">
                            <p className="text-base font-medium text-gray-700 dark:text-gray-200">Probing in progress</p>
                            <p className="text-sm text-gray-400 mt-1">Do not interrupt or move the machine</p>
                        </div>

                        {/* Current task + progress */}
                        {taskLabels.length > 0 && (
                            <div className="flex flex-col items-center gap-2">
                                <div className="flex items-center gap-2.5 rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5">
                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0"/>
                                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                        {currentTaskLabel}
                                    </span>
                                </div>
                                <span className="text-xs text-gray-400">
                                    Step {currentTaskIdx + 1} of {taskLabels.length}
                                </span>
                            </div>
                        )}

                        <Button
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                            onClick={() => {
                                controller.command('reset');
                                handleRetry();
                            }}
                        >
                            Abort
                        </Button>
                    </div>
                )}

                {/* ── Step 3a: Results (success) ── */}
                {step === 'results' && (
                    <ResultsStep
                        wcsPosition={{
                            x: typeof wpos.x === 'number' ? wpos.x.toFixed(3) : String(wpos.x),
                            y: typeof wpos.y === 'number' ? wpos.y.toFixed(3) : String(wpos.y),
                            z: typeof wpos.z === 'number' ? wpos.z.toFixed(3) : String(wpos.z),
                        }}
                        machinePosition={{
                            x: typeof mpos.x === 'number' ? (mpos.x as number).toFixed(3) : String(mpos.x),
                            y: typeof mpos.y === 'number' ? (mpos.y as number).toFixed(3) : String(mpos.y),
                            z: typeof mpos.z === 'number' ? (mpos.z as number).toFixed(3) : String(mpos.z),
                        }}
                        wcsIndex={wcsIndex}
                        probedDimensions={probedDimensions}
                        onRetry={handleRetry}
                        onClose={handleClose}
                        isRotation={isRotation}
                    />
                )}

                {/* ── Step 3b: Failed (alarm) ── */}
                {step === 'failed' && (
                    <div className="flex flex-col items-center gap-4 py-2">
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                            <FaTimes className="w-5 h-5" />
                            <span className="font-semibold">Probing Failed</span>
                        </div>

                        <div className="w-full rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 space-y-1">
                            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                                {alarmInfo ? `Alarm ${alarmCode}: ${alarmInfo.message}` : `Alarm${alarmCode !== null ? ` ${alarmCode}` : ''}`}
                            </p>
                            {alarmInfo?.description && (
                                <p className="text-xs text-red-600 dark:text-red-400 leading-snug">
                                    {alarmInfo.description}
                                </p>
                            )}
                            {!alarmInfo && (
                                <p className="text-xs text-red-600 dark:text-red-400">
                                    The machine entered an alarm state during probing. Check the machine and unlock before retrying.
                                </p>
                            )}
                        </div>

                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                            Unlock the machine ($X) before retrying.
                        </p>

                        <div className="flex gap-2 mt-2">
                            <Button variant="secondary" size="sm" onClick={handleRetry}>Retry</Button>
                            <Button variant="secondary" size="sm" onClick={handleClose}>Close</Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default WizardShell;
