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
import { shallowEqual } from 'react-redux';
import { useTypedSelector } from 'app/hooks/useTypedSelector';
import { GRBL_ACTIVE_STATE_IDLE, GRBL_ACTIVE_STATE_ALARM } from 'app/constants';
import { FeederStatus } from 'app/lib/definitions/sender_feeder';
import { GRBL_ALARMS } from '../../../../../server/controllers/Grbl/constants';
import controller from 'app/lib/controller';
import ResultsStep from './ResultsStep';
import { ProbeContext, ProbePoint, ProbeStep, WizardStep } from '../definitions';
import { parseProbeReport } from '../parseProbeReport';

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
    onExecute: () => ProbeStep[];
    showXY?: boolean;
    showZ?: boolean;
    isRotation?: boolean;
    wcsIndex: number;
    probedDimensions?: ProbedDimensions;
    onProbeComplete?: (vars: Record<string, number>) => void;
    onApplyRotation?: () => void;
    canApplyRotation?: boolean;
    rotationApplied?: boolean;
}

const STEP_LABELS: Record<WizardStep, string> = {
    intro:        'Setup',
    connectivity: 'Check Probe',
    executing:    'Probing',
    results:      'Results',
    failed:       'Failed',
};

const VISIBLE_STEPS: WizardStep[] = ['intro', 'executing', 'results'];

// Stable reference returned by the selector while the wizard is closed. Returning the same
// object on every dispatch makes the useSelector subscription inert (no re-render, no effect
// runs) when the wizard isn't active — so the ~10 mounted-but-closed wizards stop reacting to
// every status report while gcode is streaming.
const IDLE_SELECTION = {
    activeState:    'Idle',
    probePinStatus: false,
    isConnected:    false,
    wpos:           { x: '0.000', y: '0.000', z: '0.000' },
    mpos:           { x: 0, y: 0, z: 0 },
    rawAlarmCode:   null as number | null,
    feederStatus:   null as FeederStatus | null,
};

const ORIGIN: ProbePoint = { x: 0, y: 0, z: 0 };

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
    onApplyRotation,
    canApplyRotation,
    rotationApplied,
}) => {
    const [step, setStep] = useState<WizardStep>('intro');
    const [probeVerified, setProbeVerified] = useState(false);
    const [alarmCode, setAlarmCode] = useState<number | null>(null);

    const [taskLabels, setTaskLabels] = useState<string[]>([]);
    const [currentTaskIdx, setCurrentTaskIdx] = useState(0);

    // Refs for per-step execution tracking.
    const stepsRef          = useRef<ProbeStep[]>([]);
    const currentTaskIdxRef = useRef(0);
    // Shared context accumulated across steps (machine coords). Step generators read it;
    // `compute` callbacks fill `values`.
    const ctxRef            = useRef<ProbeContext>({ start: ORIGIN, current: ORIGIN, probes: {}, values: {} });
    // All probe contacts captured this run, in arrival order, parsed from `[PRB:...]`.
    const prbRef            = useRef<ProbePoint[]>([]);
    // prbRef length when the current step was sent — lets us pick out the contact(s) that
    // arrived during this step.
    const stepPrbStartRef   = useRef(0);
    // Latest machine position, mirrored from the selector so the completion effect (which
    // omits mpos from its deps) always reads a fresh value.
    const mposRef           = useRef<ProbePoint>(ORIGIN);
    // Mirror of `step` kept in sync via a useEffect so the completion effect can read the
    // current step value without listing `step` as a dependency (which would trigger it on
    // step→'executing' with stale feederStatus and cause a false-positive advance).
    const stepRef           = useRef<WizardStep>('intro');

    // While the wizard is closed, return a stable constant so the subscription is inert.
    // shallowEqual then limits re-renders to actual value changes while it's open.
    const { activeState, probePinStatus, isConnected, wpos, mpos, rawAlarmCode, feederStatus } = useTypedSelector(
        (state) => isOpen ? ({
            activeState:    state.controller.state.status?.activeState ?? 'Idle',
            probePinStatus: state.controller.state.status?.pinState.P ?? false,
            isConnected:    state.connection.isConnected ?? false,
            wpos:           state.controller.state.status?.wpos ?? { x: '0.000', y: '0.000', z: '0.000' },
            mpos:           state.controller.mpos ?? { x: 0, y: 0, z: 0 },
            rawAlarmCode:   state.controller.state.status?.alarmCode ?? null,
            feederStatus:   state.controller.feeder.status as FeederStatus | null,
        }) : IDLE_SELECTION,
        shallowEqual,
    );

    // Keep stepRef in sync so the completion effect can read the current step via a ref
    // instead of closing over the state value (which would require 'step' as a dependency).
    useEffect(() => { stepRef.current = step; }, [step]);

    // Keep mposRef fresh — the completion effect reads it without listing mpos as a dep.
    useEffect(() => {
        mposRef.current = { x: Number(mpos.x), y: Number(mpos.y), z: Number(mpos.z) };
    }, [mpos]);

    // Latch probe verification: once touched, stay verified until dialog resets
    useEffect(() => {
        if (probePinStatus && step === 'intro') {
            setProbeVerified(true);
        }
    }, [probePinStatus, step]);

    // While-open listener: capture `[PRB:...]` probe contacts as they stream in.
    // Gated on isOpen so closed wizards aren't regex-matching every serial read line.
    useEffect(() => {
        if (!isOpen) return;
        const handler = (data: string) => {
            const p = parseProbeReport(data);
            if (p) prbRef.current.push(p);
        };
        controller.addListener('serialport:read', handler);
        return () => controller.removeListener('serialport:read', handler);
    }, [isOpen]);

    // Detect alarm during probing → abort to failed step
    useEffect(() => {
        if (step === 'executing' && activeState === GRBL_ACTIVE_STATE_ALARM) {
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
            const ctx       = ctxRef.current;
            const idx       = currentTaskIdxRef.current;
            const probeStep = stepsRef.current[idx];
            if (!probeStep) return;

            // Machine position now that this step has finished — used by the next step's
            // generator to turn an absolute target into a relative delta.
            ctx.current = { ...mposRef.current };

            // Record the probe contact (the last `[PRB:...]` seen during this step).
            if (probeStep.capture) {
                const contacts = prbRef.current.slice(stepPrbStartRef.current);
                if (contacts.length > 0) {
                    ctx.probes[probeStep.capture] = contacts[contacts.length - 1];
                }
            }

            // Client-side math for this step (fills ctx.values).
            probeStep.compute?.(ctx);

            const nextIdx = idx + 1;
            if (nextIdx < stepsRef.current.length) {
                currentTaskIdxRef.current = nextIdx;
                setCurrentTaskIdx(nextIdx);
                sendStep(nextIdx);
            } else {
                setStep('results');
                onProbeComplete?.(ctx.values);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [feederStatus, activeState]);

    // Resolve a step's commands (calling its generator with the live context) and send them.
    function sendStep(idx: number) {
        const step = stepsRef.current[idx];
        stepPrbStartRef.current = prbRef.current.length;
        const commands = typeof step.commands === 'function'
            ? step.commands(ctxRef.current)
            : step.commands;
        controller.command('gcode:safe', commands, 'G21');
    }

    const executeProbe = () => {
        const steps = onExecute();
        stepsRef.current          = steps;
        currentTaskIdxRef.current = 0;
        prbRef.current            = [];
        ctxRef.current = {
            start:   { ...mposRef.current },
            current: { ...mposRef.current },
            probes:  {},
            values:  {},
        };
        setTaskLabels(steps.map((s) => s.label));
        setCurrentTaskIdx(0);
        setStep('executing');
        sendStep(0);
    };

    const handleRetry = () => {
        stepsRef.current          = [];
        currentTaskIdxRef.current = 0;
        setStep('intro');
        setProbeVerified(false);
        setAlarmCode(null);
        setTaskLabels([]);
        setCurrentTaskIdx(0);
    };

    const handleClose = () => {
        stepsRef.current          = [];
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
            <DialogContent
                className="max-w-4xl"
                // While probing is running, don't let an outside click or Escape dismiss
                // the dialog — the only way out of an active probe is the Abort button.
                onInteractOutside={(e) => { if (step === 'executing') e.preventDefault(); }}
                onEscapeKeyDown={(e) => { if (step === 'executing') e.preventDefault(); }}
            >
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
                        onApplyRotation={onApplyRotation}
                        canApplyRotation={canApplyRotation}
                        rotationApplied={rotationApplied}
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
