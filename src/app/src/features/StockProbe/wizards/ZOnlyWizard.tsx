import React, { useState } from 'react';
import WizardShell from './WizardShell';
import ZOnlySVG from '../illustrations/ZOnlySVG';
import ProbeParamsInput from '../components/ProbeParamsInput';
import { StockProbeSettings } from '../definitions';
import { generateZOnlyGCode } from '../StockProbeGCode';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    settings: StockProbeSettings;
    onSettingsUpdate: (key: keyof StockProbeSettings, value: unknown) => void;
}

const ZOnlyWizard: React.FC<Props> = ({ isOpen, onClose, settings, onSettingsUpdate }) => {
    const [buffer, setBuffer] = useState(settings.bufferDistance);

    const saveBuffer = (v: number) => { setBuffer(v); onSettingsUpdate('bufferDistance', v); };

    const handleExecute = () =>
        generateZOnlyGCode({
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
                <ZOnlySVG className="w-72 h-72 dark:invert flex-shrink-0"/>
                <div className="text-sm text-gray-600 dark:text-gray-300 flex-1">
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Move spindle directly above the stock surface</li>
                        <li>Place the probe / touch plate on top of the stock</li>
                        <li>Z zero will be set at the stock surface</li>
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
            title="Z Probe"
            isOpen={isOpen}
            onClose={onClose}
            introContent={intro}
            connectivityTest={settings.connectivityTest}
            onExecute={handleExecute}
            showZ={true}
            wcsIndex={settings.wcsIndex}
        />
    );
};

export default ZOnlyWizard;
