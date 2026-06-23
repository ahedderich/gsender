import React, { useEffect, useRef, useState } from 'react';
import { FaCheck, FaTimes, FaRedo, FaSyncAlt } from 'react-icons/fa';
import { Button } from 'app/components/Button';
import { useTypedSelector } from 'app/hooks/useTypedSelector';
import { GRBL_ACTIVE_STATE_IDLE, GRBL_ACTIVE_STATE_ALARM } from 'app/constants';
import controller from 'app/lib/controller';
import store from 'app/store';
import {
    generateCalibrationProbeTask,
    generateReferenceProbeTask,
    computeTipDiameter,
    ReferenceContacts,
    TipCalibrationResult,
} from './calibrationGCode';

// ── Types ─────────────────────────────────────────────────────────────────────

type PageStep =
    | 'intro'
    | 'guide1' | 'probing1'
    | 'guide2' | 'probing2'
    | 'guide3' | 'probing3'
    | 'guide4' | 'probing4'
    | 'guideRef' | 'probingRef'
    | 'results'
    | 'failed';

// Config key shared with the Probe widget (widgets["probe"].tipDiameter3D).
const TIP_DIAMETER_KEY = 'widgets["probe"].tipDiameter3D';
const DEFAULT_TIP_DIAMETER = 2;
const DEFAULT_REFERENCE_DIAMETER = 20;

function getConfiguredTipDiameter(): number {
    const v = store.get(TIP_DIAMETER_KEY, DEFAULT_TIP_DIAMETER) as number;
    return typeof v === 'number' && v > 0 ? v : DEFAULT_TIP_DIAMETER;
}

function saveTipDiameter(value: number): void {
    store.set(TIP_DIAMETER_KEY, value);
}

export interface CalibrationResult {
    measurements: [number, number, number, number];
    xDeviation: number;
    yDeviation: number;
    totalDeviation: number;
    timestamp: number;
}

const STORAGE_KEY = 'probe-calibration-result';

const STEP_LABELS: Record<number, string> = {
    1: 'Cable facing back (0°)',
    2: 'Cable facing left (90°)',
    3: 'Cable facing front (180°)',
    4: 'Cable facing right (270°)',
};

const CABLE_POSITIONS: Record<number, string> = {
    1: 'facing back (away from you)',
    2: 'facing to the left',
    3: 'facing toward you (front)',
    4: 'facing to the right',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadResult(): CalibrationResult | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as CalibrationResult) : null;
    } catch {
        return null;
    }
}

function saveResult(r: CalibrationResult): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
    } catch {
        // ignore storage errors
    }
}

function computeResult(m: [number, number, number, number]): CalibrationResult {
    // P0=cable back, P1=cable left, P2=cable front, P3=cable right (all probing −X)
    // X tip offset: a = (P2 − P0) / 2
    // Y tip offset: b = (P1 − P3) / 2
    const xDev = (m[2] - m[0]) / 2;
    const yDev = (m[1] - m[3]) / 2;
    return {
        measurements: m,
        xDeviation: xDev,
        yDeviation: yDev,
        totalDeviation: Math.sqrt(xDev * xDev + yDev * yDev),
        timestamp: Date.now(),
    };
}

/** Parse a grbl PRB response: [PRB:-10.234,0.123,-5.678:1] → {x,y,z} (null if no contact). */
function parsePrb(line: string): { x: number; y: number; z: number } | null {
    const match = /\[PRB:(-?\d+\.\d+),(-?\d+\.\d+),(-?\d+\.\d+):(\d)\]/.exec(line);
    if (!match || match[4] === '0') return null;
    return { x: parseFloat(match[1]), y: parseFloat(match[2]), z: parseFloat(match[3]) };
}

/** Parse just X from a PRB response (eccentricity phase probes -X only). */
function parsePrbX(line: string): number | null {
    return parsePrb(line)?.x ?? null;
}

// ── Progress bar ──────────────────────────────────────────────────────────────

const PROGRESS_STEPS: PageStep[] = ['intro', 'probing1', 'probing2', 'probing3', 'probing4', 'probingRef', 'results'];
const PROGRESS_LABELS = ['Setup', 'Step 1', 'Step 2', 'Step 3', 'Step 4', 'Tip Cal', 'Results'];

const ProgressBar: React.FC<{ step: PageStep }> = ({ step }) => {
    const idx = PROGRESS_STEPS.indexOf(
        step === 'guide1'     ? 'intro'
        : step === 'guide2'   ? 'probing1'
        : step === 'guide3'   ? 'probing2'
        : step === 'guide4'   ? 'probing3'
        : step === 'guideRef' ? 'probing4'
        : step === 'failed'   ? 'results'
        : step,
    );
    return (
        <div className="flex items-center gap-1 mb-6">
            {PROGRESS_LABELS.map((label, i) => {
                const isFailed = step === 'failed' && i === PROGRESS_LABELS.length - 1;
                const isActive = i === idx;
                const isDone   = i < idx;
                return (
                    <React.Fragment key={label}>
                        <div className={`flex items-center gap-1.5 text-xs ${
                            isFailed  ? 'text-red-600 dark:text-red-400 font-semibold'
                            : isActive ? 'text-blue-600 dark:text-blue-400 font-semibold'
                            : isDone   ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-400'
                        }`}>
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs border ${
                                isFailed  ? 'border-red-500 bg-red-50 dark:bg-red-900/30'
                                : isActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                                : isDone   ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                                : 'border-gray-300 dark:border-gray-600'
                            }`}>
                                {isDone ? <FaCheck className="w-2.5 h-2.5" /> : i + 1}
                            </span>
                            <span className="hidden sm:inline">{label}</span>
                        </div>
                        {i < PROGRESS_LABELS.length - 1 && (
                            <div className={`flex-1 h-px ${isDone ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const DeviationCell: React.FC<{ label: string; value: number; highlight?: boolean }> = ({ label, value, highlight }) => (
    <div className={`rounded-lg p-3 text-center ${highlight ? 'bg-green-100 dark:bg-green-800/30' : 'bg-gray-100 dark:bg-gray-700/50'}`}>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
        <p className={`font-mono font-semibold text-xl ${highlight ? 'text-green-700 dark:text-green-300' : 'text-gray-800 dark:text-gray-100'}`}>
            {value.toFixed(3)}
            <span className="text-sm font-normal ml-0.5 text-gray-500">mm</span>
        </p>
    </div>
);

const PreviousResultCard: React.FC<{ result: CalibrationResult; label?: string }> = ({ result, label }) => (
    <div className="w-full bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <p className="text-xs text-gray-400 mb-3">
            {label ?? 'Previous calibration'} — {new Date(result.timestamp).toLocaleString()}
        </p>
        <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div>
                <p className="text-xs text-gray-400">X Deviation</p>
                <p className="font-mono font-medium">{result.xDeviation.toFixed(3)} mm</p>
            </div>
            <div>
                <p className="text-xs text-gray-400">Y Deviation</p>
                <p className="font-mono font-medium">{result.yDeviation.toFixed(3)} mm</p>
            </div>
            <div>
                <p className="text-xs text-gray-400">Total</p>
                <p className="font-mono font-semibold text-blue-600 dark:text-blue-400">{result.totalDeviation.toFixed(3)} mm</p>
            </div>
        </div>
    </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const ProbeCalibration: React.FC = () => {
    const [step, setStep]               = useState<PageStep>('intro');
    const [measurements, setMeasurements] = useState<number[]>([]);
    const [result, setResult]           = useState<CalibrationResult | null>(null);
    const [previousResult, setPreviousResult] = useState<CalibrationResult | null>(null);
    const [alarmOccurred, setAlarmOccurred]   = useState(false);

    // Tip-diameter (reference) phase
    const [referenceDiameter, setReferenceDiameter] = useState<number>(DEFAULT_REFERENCE_DIAMETER);
    const [tipResult, setTipResult]     = useState<TipCalibrationResult | null>(null);
    const [currentTipDiameter, setCurrentTipDiameter] = useState<number>(DEFAULT_TIP_DIAMETER);
    const [tipApplied, setTipApplied]   = useState(false);

    const wasExecutingRef  = useRef(false);
    const okCountRef       = useRef(0);
    const totalCmdsRef     = useRef(0);
    const allAckedRef      = useRef(false);
    const prbXRef          = useRef<number | null>(null);
    const prbListRef       = useRef<Array<{ x: number; y: number }>>([]);
    const referenceDiameterRef = useRef<number>(DEFAULT_REFERENCE_DIAMETER);
    const handleReadRef    = useRef<((data: string) => void) | null>(null);

    const { activeState, isConnected, mpos } = useTypedSelector((state) => ({
        activeState:  state.controller.state.status?.activeState ?? 'Idle',
        isConnected:  state.connection.isConnected ?? false,
        mpos:         state.controller.mpos ?? { x: 0, y: 0, z: 0 },
    }));

    useEffect(() => {
        setPreviousResult(loadResult());
        setCurrentTipDiameter(getConfiguredTipDiameter());
    }, []);

    // Alarm detection during probing
    useEffect(() => {
        const isProbing = ['probing1', 'probing2', 'probing3', 'probing4', 'probingRef'].includes(step);
        if (isProbing && activeState === GRBL_ACTIVE_STATE_ALARM) {
            detachListener();
            setAlarmOccurred(true);
            setStep('failed');
        }
    }, [activeState, step]);

    // Idle detection: batch complete
    useEffect(() => {
        const isEccProbing = ['probing1', 'probing2', 'probing3', 'probing4'].includes(step);
        const isRefProbing = step === 'probingRef';
        if (!isEccProbing && !isRefProbing) return;

        if (activeState !== GRBL_ACTIVE_STATE_IDLE) {
            wasExecutingRef.current = true;
        }
        if (wasExecutingRef.current && activeState === GRBL_ACTIVE_STATE_IDLE && allAckedRef.current) {
            detachListener();
            wasExecutingRef.current = false;

            if (isRefProbing) {
                const prbs = prbListRef.current;
                prbListRef.current = [];
                // Expect four contacts in order [+X, -X, +Y, -Y].
                if (prbs.length >= 4) {
                    const contacts: ReferenceContacts = {
                        xPlus:  prbs[0].x,
                        xMinus: prbs[1].x,
                        yPlus:  prbs[2].y,
                        yMinus: prbs[3].y,
                    };
                    setTipResult(computeTipDiameter(referenceDiameterRef.current, contacts));
                    setStep('results');
                } else {
                    setStep('failed');
                }
                return;
            }

            const capturedX = prbXRef.current;
            prbXRef.current = null;

            if (capturedX !== null) {
                setMeasurements((prev) => {
                    const updated = [...prev, capturedX];
                    if (updated.length === 4) {
                        const r = computeResult(updated as [number, number, number, number]);
                        setResult(r);
                        saveResult(r);
                        setPreviousResult(r);
                        // Eccentricity done — continue to the tip-diameter reference phase.
                        setStep('guideRef');
                    } else {
                        const nextGuide = (['guide2', 'guide3', 'guide4'] as PageStep[])[updated.length - 1];
                        setStep(nextGuide);
                    }
                    return updated;
                });
            } else {
                setStep('failed');
            }
        }
    }, [activeState, step]);

    const detachListener = () => {
        if (handleReadRef.current) {
            controller.removeListener('serialport:read', handleReadRef.current);
            handleReadRef.current = null;
        }
    };

    const runProbe = (probingStep: PageStep, stepNum: number) => {
        detachListener();
        okCountRef.current  = 0;
        allAckedRef.current = false;
        prbXRef.current     = null;
        wasExecutingRef.current = false;

        const task = generateCalibrationProbeTask(STEP_LABELS[stepNum]);
        totalCmdsRef.current = task.commands.filter(
            (c) => !(c.startsWith('%') && c.includes('=')),
        ).length;

        const handler = (data: string) => {
            if (typeof data !== 'string') return;
            const prbX = parsePrbX(data);
            if (prbX !== null) prbXRef.current = prbX;
            if (data.trim() === 'ok') {
                okCountRef.current++;
                if (okCountRef.current >= totalCmdsRef.current) allAckedRef.current = true;
            }
        };
        handleReadRef.current = handler;
        controller.addListener('serialport:read', handler);

        setStep(probingStep);
        controller.command('gcode:safe', task.commands, 'G21');
    };

    const runReferenceProbe = () => {
        detachListener();
        okCountRef.current  = 0;
        allAckedRef.current = false;
        prbListRef.current  = [];
        referenceDiameterRef.current = referenceDiameter;
        wasExecutingRef.current = false;

        // Capture machine centre now — used for absolute G90 retracts in the GCode.
        const centre = { x: Number(mpos.x), y: Number(mpos.y) };
        const task = generateReferenceProbeTask(referenceDiameter, centre);
        totalCmdsRef.current = task.commands.filter(
            (c) => !(c.startsWith('%') && c.includes('=')),
        ).length;

        const handler = (data: string) => {
            if (typeof data !== 'string') return;
            const prb = parsePrb(data);
            if (prb !== null) prbListRef.current.push({ x: prb.x, y: prb.y });
            if (data.trim() === 'ok') {
                okCountRef.current++;
                if (okCountRef.current >= totalCmdsRef.current) allAckedRef.current = true;
            }
        };
        handleReadRef.current = handler;
        controller.addListener('serialport:read', handler);

        setStep('probingRef');
        controller.command('gcode:safe', task.commands, 'G21');
    };

    const handleApplyTipDiameter = () => {
        if (!tipResult) return;
        const value = Math.round(tipResult.tipDiameter * 1000) / 1000;
        saveTipDiameter(value);
        setCurrentTipDiameter(value);
        setTipApplied(true);
    };

    const handleReset = () => {
        detachListener();
        setStep('intro');
        setMeasurements([]);
        setResult(null);
        setTipResult(null);
        setTipApplied(false);
        setAlarmOccurred(false);
        setCurrentTipDiameter(getConfiguredTipDiameter());
        wasExecutingRef.current = false;
        okCountRef.current  = 0;
        allAckedRef.current = false;
        prbXRef.current     = null;
        prbListRef.current  = [];
    };

    // ── Intro ──────────────────────────────────────────────────────────────────

    if (step === 'intro') {
        return (
            <div className="flex flex-col gap-5 max-w-2xl dark:text-white">
                <ProgressBar step={step} />

                <p className="text-sm text-gray-600 dark:text-gray-300">
                    This wizard calibrates your 3D touch probe in two phases. First it measures the
                    offset of the stylus tip from the body centre by probing toward <strong>−X</strong>{' '}
                    four times, rotating the probe body <strong>90°</strong> between each. Then it
                    derives the <strong>tip diameter</strong> from a hole of known size so the probe
                    triggers at the correct zero on every side.
                </p>

                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Current configured tip diameter</span>
                    <span className="font-mono font-semibold">{currentTipDiameter.toFixed(3)} mm</span>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 text-sm space-y-1">
                    <p className="font-semibold text-blue-700 dark:text-blue-300 mb-1">Before you start:</p>
                    <ul className="list-disc list-inside text-blue-600 dark:text-blue-300 space-y-0.5">
                        <li>Position the spindle near a flat vertical surface to the left (−X side)</li>
                        <li>Leave ~50 mm clearance between probe tip and surface</li>
                        <li>Ensure the probe cable port faces <strong>back (away from you)</strong></li>
                        <li>Have a hole/pocket of known diameter ready for the tip-diameter phase</li>
                    </ul>
                </div>

                {previousResult ? (
                    <PreviousResultCard result={previousResult} />
                ) : (
                    <div className="bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center">
                        <p className="text-sm text-gray-400">No calibration data yet</p>
                    </div>
                )}

                {!isConnected && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-3 text-sm text-yellow-700 dark:text-yellow-300">
                        Connect to a machine before starting calibration.
                    </div>
                )}

                <div>
                    <Button variant="primary" onClick={() => setStep('guide1')} disabled={!isConnected}>
                        Start Calibration
                    </Button>
                </div>
            </div>
        );
    }

    // ── Guide step (before each individual probe) ──────────────────────────────

    if (step === 'guide1' || step === 'guide2' || step === 'guide3' || step === 'guide4') {
        const stepNum = step === 'guide1' ? 1 : step === 'guide2' ? 2 : step === 'guide3' ? 3 : 4;
        const probingStep: PageStep = `probing${stepNum}` as PageStep;
        const isFirst = stepNum === 1;

        return (
            <div className="flex flex-col gap-5 max-w-2xl dark:text-white">
                <ProgressBar step={step} />

                {!isFirst && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg px-4 py-3 flex items-start gap-3">
                        <FaSyncAlt className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                            <strong>Rotate the probe 90°</strong> — cable port should now be <strong>{CABLE_POSITIONS[stepNum]}</strong>.
                        </p>
                    </div>
                )}

                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-sm space-y-1">
                    <p className="font-semibold text-gray-700 dark:text-gray-200">
                        Step {stepNum} of 4 — {STEP_LABELS[stepNum]}
                    </p>
                    <p className="text-gray-500 dark:text-gray-400">
                        The machine will probe toward <strong>−X</strong>. Ensure the path is clear,
                        then click the button below.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="primary" onClick={() => runProbe(probingStep, stepNum)}>
                        Probe Step {stepNum}
                    </Button>
                    <Button variant="outline" onClick={handleReset}>Cancel</Button>
                </div>
            </div>
        );
    }

    // ── Tip-diameter reference guide ───────────────────────────────────────────

    if (step === 'guideRef') {
        const valid = referenceDiameter > 0;
        return (
            <div className="flex flex-col gap-5 max-w-2xl dark:text-white">
                <ProgressBar step={step} />

                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                    <FaCheck className="w-4 h-4" />
                    Tip offset measured. Now calibrate the tip diameter.
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-sm space-y-3">
                    <p className="font-semibold text-gray-700 dark:text-gray-200">Tip diameter calibration</p>
                    <p className="text-gray-500 dark:text-gray-400">
                        Position the probe tip at the <strong>centre</strong> of a hole or pocket of
                        known diameter, lowered to probing depth. The machine probes outward toward
                        all four walls (+X, −X, +Y, −Y). The tip diameter is the amount by which the
                        measured span falls short of the true diameter.
                    </p>
                    <label className="flex items-center gap-3">
                        <span className="text-gray-600 dark:text-gray-300">Known hole diameter</span>
                        <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={referenceDiameter}
                            onChange={(e) => setReferenceDiameter(parseFloat(e.target.value) || 0)}
                            className="w-28 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 font-mono text-right"
                        />
                        <span className="text-gray-400">mm</span>
                    </label>
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="primary" onClick={runReferenceProbe} disabled={!valid}>
                        Probe Tip Diameter
                    </Button>
                    <Button variant="outline" onClick={handleReset}>Cancel</Button>
                </div>
            </div>
        );
    }

    // ── Probing spinner ────────────────────────────────────────────────────────

    if (step === 'probing1' || step === 'probing2' || step === 'probing3' || step === 'probing4' || step === 'probingRef') {
        const isRef = step === 'probingRef';
        const stepNum = isRef ? 0 : step === 'probing1' ? 1 : step === 'probing2' ? 2 : step === 'probing3' ? 3 : 4;
        return (
            <div className="flex flex-col gap-5 max-w-2xl dark:text-white">
                <ProgressBar step={step} />

                <div className="flex flex-col items-center gap-5 py-12">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <div className="text-center">
                        <p className="text-base font-medium text-gray-700 dark:text-gray-200">
                            {isRef ? 'Probing tip diameter reference' : `Probing — Step ${stepNum} of 4`}
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                            {isRef ? 'Probing all four walls' : STEP_LABELS[stepNum]}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Do not interrupt or move the machine</p>
                    </div>
                    <Button
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                        onClick={() => { controller.command('reset'); handleReset(); }}
                    >
                        Abort
                    </Button>
                </div>
            </div>
        );
    }

    // ── Results ────────────────────────────────────────────────────────────────

    if (step === 'results' && result) {
        return (
            <div className="flex flex-col gap-5 max-w-2xl dark:text-white">
                <ProgressBar step={step} />

                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <FaCheck className="w-5 h-5" />
                    <span className="font-semibold text-base">Calibration Complete</span>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Probe Tip Deviation from Centre</p>
                    <div className="grid grid-cols-3 gap-3">
                        <DeviationCell label="X Deviation" value={result.xDeviation} />
                        <DeviationCell label="Y Deviation" value={result.yDeviation} />
                        <DeviationCell label="Total" value={result.totalDeviation} highlight />
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Raw Measurements (Machine X at contact)</p>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        {result.measurements.map((m, i) => (
                            <div key={i}>
                                <p className="text-gray-400 mb-0.5">{['Back', 'Left', 'Front', 'Right'][i]}</p>
                                <p className="font-mono font-medium">{m.toFixed(3)}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {tipResult && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Calibrated Tip Diameter (from {tipResult.knownDiameter.toFixed(3)} mm reference)
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                            <DeviationCell label="From X" value={tipResult.tipDiameterX} />
                            <DeviationCell label="From Y" value={tipResult.tipDiameterY} />
                            <DeviationCell label="Tip Ø" value={tipResult.tipDiameter} highlight />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Trigger consistency (spread across all four sides):{' '}
                            <span className="font-mono">{tipResult.consistency.toFixed(3)} mm</span>
                            {tipResult.consistency > 0.1 && (
                                <span className="text-amber-600 dark:text-amber-400">
                                    {' '}— high; re-centre the probe in the hole and retry for a better result.
                                </span>
                            )}
                        </p>
                        <div className="flex items-center justify-between border-t border-blue-200 dark:border-blue-800 pt-3">
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                                Configured: <span className="font-mono">{currentTipDiameter.toFixed(3)} mm</span>
                                {' → '}
                                New: <span className="font-mono font-semibold">{tipResult.tipDiameter.toFixed(3)} mm</span>
                            </span>
                            {tipApplied ? (
                                <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                                    <FaCheck className="w-3.5 h-3.5" /> Applied
                                </span>
                            ) : (
                                <Button variant="primary" onClick={handleApplyTipDiameter}>
                                    Apply Tip Diameter
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-3">
                    <Button variant="primary" onClick={handleReset}>
                        <FaRedo className="w-3 h-3 mr-1.5 inline" />Rerun Calibration
                    </Button>
                </div>
            </div>
        );
    }

    // ── Failed ─────────────────────────────────────────────────────────────────

    if (step === 'failed') {
        return (
            <div className="flex flex-col gap-5 max-w-2xl dark:text-white">
                <ProgressBar step={step} />

                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <FaTimes className="w-5 h-5" />
                    <span className="font-semibold text-base">Calibration Failed</span>
                </div>

                <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3">
                    <p className="text-sm text-red-700 dark:text-red-300">
                        {alarmOccurred
                            ? 'The machine entered an alarm state during probing. Unlock the machine ($X) before retrying.'
                            : 'Probe contact was not detected. Ensure the probe is correctly wired and positioned within 50 mm of the surface.'
                        }
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="primary" onClick={handleReset}>Retry</Button>
                </div>
            </div>
        );
    }

    return null;
};

export default ProbeCalibration;
