import React, { useState } from 'react';
import WizardShell from './WizardShell';
import RotationSVG from '../illustrations/RotationSVG';
import ProbeParamsInput from '../components/ProbeParamsInput';
import { StockProbeSettings, SideSelection } from '../definitions';
import { generateRotationGCode } from '../StockProbeGCode';
import cx from 'classnames';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    settings: StockProbeSettings;
    onSettingsUpdate: (key: keyof StockProbeSettings, value: unknown) => void;
}

const SIDES: SideSelection[] = ['top', 'bottom', 'left', 'right'];

const RotationWizard: React.FC<Props> = ({ isOpen, onClose, settings, onSettingsUpdate }) => {
    const [side, setSide] = useState<SideSelection>('top');
    const [buffer, setBuffer] = useState(settings.bufferDistance);

    const saveBuffer = (v: number) => { setBuffer(v); onSettingsUpdate('bufferDistance', v); };

    const handleExecute = () =>
        generateRotationGCode({
            stockWidth: settings.stockWidth,
            side,
            probeFeedrateFast: settings.probeFeedrateFast,
            probeFeedrateSlow: settings.probeFeedrateSlow,
            travelFeedrate: 5000,
            safeHeight: 10,
            retractDistance: settings.retractDistance,
            bufferDistance: buffer,
            xyProbingHeight: settings.xyProbingHeight,
            wcsIndex: settings.wcsIndex,
        });

    const intro = (
        <div className="flex flex-col gap-3">
            <div className="flex gap-4 items-start">
                <RotationSVG side={side} className="w-72 h-72 dark:invert flex-shrink-0"/>
                <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Side to measure:</p>
                    <div className="grid grid-cols-4 gap-1 mb-2">
                        {SIDES.map((s) => (
                            <button
                                key={s}
                                onClick={() => setSide(s)}
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
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                        {settings.stockWidth} × {settings.stockLength} mm
                    </p>
                    <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-300 space-y-0.5">
                        <li>Position at start of the {side} side, {buffer}mm outside</li>
                        <li>3 points probed — angle displayed, no zero set</li>
                    </ul>
                </div>
            </div>
            <ProbeParamsInput
                buffer={buffer}
                onBufferChange={saveBuffer}
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
        />
    );
};

export default RotationWizard;
