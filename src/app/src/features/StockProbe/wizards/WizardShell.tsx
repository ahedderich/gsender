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
import { GRBL_ALARMS } from '../../../../../server/controllers/Grbl/constants';
import controller from 'app/lib/controller';
import ResultsStep from './ResultsStep';
import { ProbeTask, WizardStep } from '../definitions';

interface ProbedDimensions {
    width?: number;
    length?: number;
    diameter?: number;
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
    onProbeComplete?: () => void;
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
    const [wasExecuting, setWasExecuting] = useState(false);
    const [probeVerified, setProbeVerified] = useState(false);
    const [alarmCode, setAlarmCode] = useState<number | null>(null);

    // Task tracking
    const [taskLabels, setTaskLabels] = useState<string[]>([]);
    const [taskBoundaries, setTaskBoundaries] = useState<number[]>([]);
    const [currentTaskIdx, setCurrentTaskIdx] = useState(0);
    // Set to true only after every GCode command in the batch has received its
    // 'ok' acknowledgement. This prevents the wizard from advancing to the results
    // step during transient Idle states that occur between individual probe moves
    // (e.g. after the Z probe and before XY probing begins).
    const [allCommandsAcked, setAllCommandsAcked] = useState(false);

    // Refs for the serial-port listener — avoids the race condition where
    // controller.command fires oks before useEffect can attach the listener.
    const okCountRef        = useRef(0);
    const totalCommandsRef  = useRef(0);
    const boundariesRef     = useRef<number[]>([]);
    const labelsRef         = useRef<string[]>([]);
    const handleReadRef     = useRef<((data: string) => void) | null>(null);

    const attachTaskListener = (boundaries: number[], labels: string[]) => {
        if (handleReadRef.current) {
            controller.removeListener('serialport:read', handleReadRef.current);
        }
        okCountRef.current      = 0;
        totalCommandsRef.current = boundaries.length > 0 ? boundaries[boundaries.length - 1] : 0;
        boundariesRef.current   = boundaries;
        labelsRef.current       = labels;

        const handler = (data: string) => {
            if (typeof data === 'string' && data.trim() === 'ok') {
                okCountRef.current++;
                const count = okCountRef.current;
                const idx   = boundariesRef.current.findIndex((b) => count < b);
                setCurrentTaskIdx(idx === -1 ? labelsRef.current.length - 1 : idx);
                // All commands acknowledged — the batch is truly complete.
                if (totalCommandsRef.current > 0 && count >= totalCommandsRef.current) {
                    setAllCommandsAcked(true);
                }
            }
        };
        handleReadRef.current = handler;
        controller.addListener('serialport:read', handler);
    };

    const detachTaskListener = () => {
        if (handleReadRef.current) {
            controller.removeListener('serialport:read', handleReadRef.current);
            handleReadRef.current = null;
        }
        okCountRef.current = 0;
    };

    const { activeState, probePinStatus, isConnected, wpos, mpos, rawAlarmCode } = useTypedSelector((state) => ({
        activeState:    state.controller.state.status?.activeState ?? 'Idle',
        probePinStatus: state.controller.state.status?.pinState.P ?? false,
        isConnected:    state.connection.isConnected ?? false,
        wpos:           state.controller.state.status?.wpos ?? { x: '0.000', y: '0.000', z: '0.000' },
        mpos:           state.controller.mpos ?? { x: 0, y: 0, z: 0 },
        rawAlarmCode:   state.controller.state.status?.alarmCode ?? null,
    }));

    // Latch probe verification: once touched, stay verified until dialog resets
    useEffect(() => {
        if (probePinStatus && step === 'intro') {
            setProbeVerified(true);
        }
    }, [probePinStatus, step]);

    // Detect alarm during probing → abort to failed step
    useEffect(() => {
        if (step === 'executing' && activeState === GRBL_ACTIVE_STATE_ALARM) {
            detachTaskListener();
            setAlarmCode(rawAlarmCode !== null ? Number(rawAlarmCode) : null);
            setStep('failed');
            setWasExecuting(false);
        }
    }, [activeState, step, rawAlarmCode]);

    // Detect GCode batch completion: idle after executing AND all commands acked.
    // Requiring allCommandsAcked prevents premature completion during transient
    // Idle states between individual probe moves (e.g. after Z probe, before XY).
    useEffect(() => {
        if (step === 'executing' && activeState !== GRBL_ACTIVE_STATE_IDLE) {
            setWasExecuting(true);
        }
        if (step === 'executing' && wasExecuting && activeState === GRBL_ACTIVE_STATE_IDLE && allCommandsAcked) {
            detachTaskListener();
            setStep('results');
            setWasExecuting(false);
            setAllCommandsAcked(false);
            onProbeComplete?.();
        }
    }, [activeState, step, wasExecuting, allCommandsAcked]);

    const executeProbe = () => {
        const tasks = onExecute();
        const labels = tasks.map((t) => t.label);
        let total = 0;
        // % variable assignments (e.g. %SP_Z=posz) are evaluated client-side and never
        // forwarded to the firmware, so they produce no 'ok' response. Exclude them from
        // the count to prevent allCommandsAcked from never firing.
        const boundaries = tasks.map((t) => {
            total += t.commands.filter((cmd) => !(cmd.startsWith('%') && cmd.includes('='))).length;
            return total;
        });
        setTaskLabels(labels);
        setTaskBoundaries(boundaries);
        setCurrentTaskIdx(0);
        setAllCommandsAcked(false);
        attachTaskListener(boundaries, labels);
        setStep('executing');
        setWasExecuting(false);
        const allCommands = tasks.flatMap((t) => t.commands);
        controller.command('gcode:safe', allCommands, 'G21');
    };

    const handleRetry = () => {
        setStep('intro');
        setWasExecuting(false);
        setAllCommandsAcked(false);
        setProbeVerified(false);
        setAlarmCode(null);
        setTaskLabels([]);
        setTaskBoundaries([]);
        setCurrentTaskIdx(0);
    };

    const handleClose = () => {
        setStep('intro');
        setWasExecuting(false);
        setAllCommandsAcked(false);
        setProbeVerified(false);
        setAlarmCode(null);
        setTaskLabels([]);
        setTaskBoundaries([]);
        setCurrentTaskIdx(0);
        onClose();
    };

    const canStart = !connectivityTest || probeVerified;
    const currentTaskLabel = taskLabels[currentTaskIdx] ?? '';

    // Resolve alarm description from code
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
