import React, { useState } from 'react';
import WizardShell from './WizardShell';
import XYZCenterSVG from '../illustrations/XYZCenterSVG';
import ProbeParamsInput from '../components/ProbeParamsInput';
import { StockProbeSettings } from '../definitions';
import { generateXYZCenterRectGCode, generateXYZCenterRoundGCode } from '../StockProbeGCode';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onBack?: () => void;
    settings: StockProbeSettings;
    onSettingsUpdate: (key: keyof StockProbeSettings, value: unknown) => void;
}

const XYZCenterWizard: React.FC<Props> = ({ isOpen, onClose, onBack, settings, onSettingsUpdate }) => {
    const isRect = settings.stockType === 'rectangle';
    const [buffer, setBuffer] = useState(settings.bufferDistance);
    const [xyHeight, setXyHeight] = useState(settings.xyProbingHeight);
    const [safeHeight, setSafeHeight] = useState(settings.safeHeight ?? 10);

    const saveBuffer = (v: number) => { setBuffer(v); onSettingsUpdate('bufferDistance', v); };
    const saveXyHeight = (v: number) => { setXyHeight(v); onSettingsUpdate('xyProbingHeight', v); };
    const saveSafeHeight = (v: number) => { setSafeHeight(v); onSettingsUpdate('safeHeight', v); };

    const handleExecute = () => {
        if (isRect) {
            return generateXYZCenterRectGCode({
                stockWidth: settings.stockWidth,
                stockLength: settings.stockLength,
                probeFeedrateFast: settings.probeFeedrateFast,
                probeFeedrateSlow: settings.probeFeedrateSlow,
                travelFeedrate: 5000,
                safeHeight,
                retractDistance: settings.retractDistance,
                bufferDistance: buffer,
                xyProbingHeight: xyHeight,
                wcsIndex: settings.wcsIndex,
            });
        }
        return generateXYZCenterRoundGCode({
            stockDiameter: settings.stockDiameter,
            probeFeedrateFast: settings.probeFeedrateFast,
            probeFeedrateSlow: settings.probeFeedrateSlow,
            travelFeedrate: 5000,
            safeHeight,
            retractDistance: settings.retractDistance,
            bufferDistance: buffer,
            xyProbingHeight: xyHeight,
            wcsIndex: settings.wcsIndex,
        });
    };

    const dims = isRect
        ? `${settings.stockWidth} × ${settings.stockLength} mm`
        : `⌀ ${settings.stockDiameter} mm`;

    const intro = (
        <div className="flex flex-col gap-3">
            <div className="flex gap-4 items-start">
                <XYZCenterSVG stockType={settings.stockType} className="w-72 h-72 dark:invert flex-shrink-0"/>
                <div className="text-sm text-gray-600 dark:text-gray-300 flex-1">
                    <p className="font-semibold mb-1">Stock: {settings.stockType} ({dims})</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Position spindle over the <strong>rough center</strong> of the stock</li>
                        <li>Z will probe down first, then {isRect ? 'all four sides' : 'three points at 120°'} from outside</li>
                        <li>XYZ zero set at the measured center</li>
                    </ul>
                </div>
            </div>
            <ProbeParamsInput
                buffer={buffer}
                xyHeight={xyHeight}
                safeHeight={safeHeight}
                onBufferChange={saveBuffer}
                onXyHeightChange={saveXyHeight}
                onSafeHeightChange={saveSafeHeight}
            />
        </div>
    );

    const probedDimensions = isRect
        ? { width: settings.stockWidth, length: settings.stockLength }
        : { diameter: settings.stockDiameter };

    const handleProbeComplete = () => {
        if (isRect) {
            onSettingsUpdate('lastProbedWidth', settings.stockWidth);
            onSettingsUpdate('lastProbedLength', settings.stockLength);
            onSettingsUpdate('lastProbedDiameter', null);
        } else {
            onSettingsUpdate('lastProbedDiameter', settings.stockDiameter);
            onSettingsUpdate('lastProbedWidth', null);
            onSettingsUpdate('lastProbedLength', null);
        }
        onSettingsUpdate('lastProbedTimestamp', Date.now());
    };

    return (
        <WizardShell
            title="XYZ Center"
            isOpen={isOpen}
            onClose={onClose}
            onBack={onBack}
            introContent={intro}
            connectivityTest={settings.connectivityTest}
            onExecute={handleExecute}
            showXY={true}
            showZ={true}
            wcsIndex={settings.wcsIndex}
            probedDimensions={probedDimensions}
            onProbeComplete={handleProbeComplete}
        />
    );
};

export default XYZCenterWizard;
