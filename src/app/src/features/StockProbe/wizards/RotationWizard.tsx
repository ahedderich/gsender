import React, { useState } from 'react';
import WizardShell from './WizardShell';
import RotationSVG from '../illustrations/RotationSVG';
import ProbeParamsInput from '../components/ProbeParamsInput';
import { StockProbeSettings, SideSelection, ProbeDirection } from '../definitions';
import { generateRotationGCode } from '../StockProbeGCode';
import cx from 'classnames';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    settings: StockProbeSettings;
    onSettingsUpdate: (key: keyof StockProbeSettings, value: unknown) => void;
}

const SIDES: SideSelection[] = ['top', 'bottom', 'left', 'right'];

const DIRECTIONS: { value: ProbeDirection; label: string }[] = [
    { value: 'towards_center', label: 'Towards Center' },
    { value: 'away_from_center', label: 'Away from Center' },
];

const RotationWizard: React.FC<Props> = ({ isOpen, onClose, settings, onSettingsUpdate }) => {
    const [side, setSide] = useState<SideSelection>('top');
    const [direction, setDirection] = useState<ProbeDirection>('towards_center');
    const [rotationAngle, setRotationAngle] = useState<number | undefined>(undefined);
    const [buffer, setBuffer] = useState(settings.bufferDistance);
    const [probingZHeight, setProbingZHeight] = useState(-3);
    const [edgeOffset, setEdgeOffset] = useState(settings.rotationEdgeOffset ?? 15);

    const defaultMeasuringLength = (s: SideSelection) =>
        (s === 'top' || s === 'bottom') ? settings.stockWidth : settings.stockLength;

    const [measuringLength, setMeasuringLength] = useState(defaultMeasuringLength('top'));

    const saveBuffer = (v: number) => { setBuffer(v); onSettingsUpdate('bufferDistance', v); };
    const saveEdgeOffset = (v: number) => { setEdgeOffset(v); onSettingsUpdate('rotationEdgeOffset', v); };

    const handleSideChange = (s: SideSelection) => {
        setSide(s);
        setMeasuringLength(defaultMeasuringLength(s));
    };

    const handleExecute = () =>
        generateRotationGCode({
            measuringLength,
            stockWidth: settings.stockWidth,
            stockLength: settings.stockLength,
            probingZHeight,
            direction,
            side,
            probeFeedrateFast: settings.probeFeedrateFast,
            probeFeedrateSlow: settings.probeFeedrateSlow,
            travelFeedrate: 5000,
            safeHeight: settings.safeHeight,
            retractDistance: settings.retractDistance,
            bufferDistance: buffer,
            xyProbingHeight: settings.xyProbingHeight,
            wcsIndex: settings.wcsIndex,
            rotationEdgeOffset: edgeOffset,
        });

    const intro = (
        <div className="flex flex-col gap-3">
            <div className="flex gap-4 items-start">
                <RotationSVG side={side} className="w-72 h-72 dark:invert flex-shrink-0"/>
                <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Probe direction:</p>
                    <div className="grid grid-cols-2 gap-1 mb-3">
                        {DIRECTIONS.map((d) => (
                            <button
                                key={d.value}
                                onClick={() => setDirection(d.value)}
                                className={cx(
                                    'text-sm py-1 px-1 rounded border transition-colors',
                                    direction === d.value
                                        ? 'bg-blue-500 text-white border-blue-500'
                                        : 'bg-white dark:bg-dark text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600',
                                )}
                            >
                                {d.label}
                            </button>
                        ))}
                    </div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Side to measure:</p>
                    <div className="grid grid-cols-4 gap-1 mb-3">
                        {SIDES.map((s) => (
                            <button
                                key={s}
                                onClick={() => handleSideChange(s)}
                                className={cx(
                                    'text-sm py-1 px-1 rounded border capitalize transition-colors',
                                    side === s
                                        ? 'bg-blue-500 text-white border-blue-500'
                                        : 'bg-white dark:bg-dark text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600',
                                )}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                        <label className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                            Measuring side length (mm):
                        </label>
                        <input
                            type="number"
                            value={measuringLength}
                            min={1}
                            step={1}
                            onChange={(e) => setMeasuringLength(parseFloat(e.target.value) || defaultMeasuringLength(side))}
                            className="w-20 text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-0.5 bg-white dark:bg-dark text-gray-900 dark:text-white"
                        />
                        {measuringLength !== defaultMeasuringLength(side) && (
                            <button
                                onClick={() => setMeasuringLength(defaultMeasuringLength(side))}
                                className="text-xs text-blue-500 hover:underline"
                            >
                                Reset
                            </button>
                        )}
                    </div>
                    <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-300 space-y-0.5">
                        <li>
                            Position at {direction === 'towards_center' ? 'outside' : 'inside'} the {side} side,
                            {' '}{buffer}mm from edge — routine moves to each point automatically
                        </li>
                        <li>3 points probed — angle displayed, no zero set</li>
                    </ul>
                </div>
            </div>
            <ProbeParamsInput
                buffer={buffer}
                probingZHeight={probingZHeight}
                edgeOffset={edgeOffset}
                onBufferChange={saveBuffer}
                onProbingZHeightChange={setProbingZHeight}
                onEdgeOffsetChange={saveEdgeOffset}
            />
        </div>
    );

    return (
        <WizardShell
            title="Rotation Measurement"
            isOpen={isOpen}
            onClose={onClose}
            introContent={intro}
            connectivityTest={settings.connectivityTest}
            onExecute={handleExecute}
            isRotation={true}
            wcsIndex={settings.wcsIndex}
            probedDimensions={{ rotationAngle }}
            onProbeComplete={(vars) => setRotationAngle(typeof vars.SP_ANGLE === 'number' ? vars.SP_ANGLE : undefined)}
        />
    );
};

export default RotationWizard;
