import React, { useState } from 'react';
import WizardShell from './WizardShell';
import CornerProbeSVG from '../illustrations/CornerProbeSVG';
import ProbeParamsInput from '../components/ProbeParamsInput';
import { StockProbeSettings, CornerSelection } from '../definitions';
import { generateCornerProbeGCode } from '../StockProbeGCode';
import cx from 'classnames';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onBack?: () => void;
    settings: StockProbeSettings;
    onSettingsUpdate: (key: keyof StockProbeSettings, value: unknown) => void;
}

const CORNERS: CornerSelection[] = ['TL', 'TR', 'BL', 'BR'];
const CORNER_LABELS: Record<CornerSelection, string> = {
    BL: 'Bottom Left',
    TL: 'Top Left',
    TR: 'Top Right',
    BR: 'Bottom Right',
};

const CornerProbeWizard: React.FC<Props> = ({ isOpen, onClose, onBack, settings, onSettingsUpdate }) => {
    const [corner, setCorner] = useState<CornerSelection>('BL');
    const [buffer, setBuffer] = useState(settings.bufferDistance);
    const [xyHeight, setXyHeight] = useState(settings.xyProbingHeight);

    const saveBuffer = (v: number) => { setBuffer(v); onSettingsUpdate('bufferDistance', v); };
    const saveXyHeight = (v: number) => { setXyHeight(v); onSettingsUpdate('xyProbingHeight', v); };

    const handleExecute = () =>
        generateCornerProbeGCode({
            corner,
            probeFeedrateFast: settings.probeFeedrateFast,
            probeFeedrateSlow: settings.probeFeedrateSlow,
            travelFeedrate: 5000,
            safeHeight: 10,
            retractDistance: settings.retractDistance,
            bufferDistance: buffer,
            xyProbingHeight: xyHeight,
            wcsIndex: settings.wcsIndex,
            tipDiameter: settings.tipDiameter,
        });

    const intro = (
        <div className="flex flex-col gap-3">
            <div className="flex gap-4 items-start">
                <CornerProbeSVG corner={corner} className="w-72 h-72 dark:invert flex-shrink-0"/>
                <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Corner:</p>
                    <div className="grid grid-cols-2 gap-1 mb-2">
                        {CORNERS.map((c) => (
                            <button
                                key={c}
                                onClick={() => setCorner(c)}
                                className={cx(
                                    'text-sm py-1 px-2 rounded border transition-colors',
                                    corner === c
                                        ? 'bg-blue-500 text-white border-blue-500'
                                        : 'bg-white dark:bg-dark text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600',
                                )}
                            >
                                {CORNER_LABELS[c]}
                            </button>
                        ))}
                    </div>
                    <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-300 space-y-0.5">
                        <li>Position spindle above stock near corner</li>
                        <li>Z → X edge → Y edge, zero at corner</li>
                    </ul>
                </div>
            </div>
            <ProbeParamsInput
                buffer={buffer}
                xyHeight={xyHeight}
                onBufferChange={saveBuffer}
                onXyHeightChange={saveXyHeight}
            />
        </div>
    );

    return (
        <WizardShell
            title="Corner Probe"
            isOpen={isOpen}
            onClose={onClose}
            onBack={onBack}
            introContent={intro}
            connectivityTest={settings.connectivityTest}
            onExecute={handleExecute}
            showXY={true}
            showZ={true}
            wcsIndex={settings.wcsIndex}
        />
    );
};

export default CornerProbeWizard;
