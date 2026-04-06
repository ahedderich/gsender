import React, { useState } from 'react';
import WizardShell from './WizardShell';
import HoleCenterSVG from '../illustrations/HoleCenterSVG';
import { StockProbeSettings } from '../definitions';
import { generateHoleCenterGCode } from '../StockProbeGCode';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onBack?: () => void;
    settings: StockProbeSettings;
    onSettingsUpdate: (key: keyof StockProbeSettings, value: unknown) => void;
}

const HoleCenterWizard: React.FC<Props> = ({ isOpen, onClose, onBack, settings, onSettingsUpdate }) => {
    const [diameter, setDiameter] = useState(settings.stockDiameter);

    const saveDiameter = (v: number) => { setDiameter(v); onSettingsUpdate('stockDiameter', v); };

    const handleExecute = () =>
        generateHoleCenterGCode({
            stockDiameter: diameter,
            probeFeedrateFast: settings.probeFeedrateFast,
            probeFeedrateSlow: settings.probeFeedrateSlow,
            travelFeedrate: 5000,
            safeHeight: 10,
            retractDistance: settings.retractDistance,
            bufferDistance: settings.bufferDistance,
            xyProbingHeight: settings.xyProbingHeight,
            wcsIndex: settings.wcsIndex,
        });

    const intro = (
        <div className="flex flex-col gap-3">
            <div className="flex gap-4 items-start">
                <HoleCenterSVG className="w-72 h-72 dark:invert flex-shrink-0"/>
                <div className="text-sm text-gray-600 dark:text-gray-300 flex-1">
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Move spindle <strong>inside the hole</strong> at probing height</li>
                        <li>Probes outward in X+/X−/Y+/Y− to find the hole wall</li>
                        <li>XY zero set at the calculated center</li>
                    </ul>
                </div>
            </div>
            <div className="pt-3 mt-1 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Probing Parameters</p>
                <div className="w-1/2 pr-1">
                    <label htmlFor="hole-diameter" className="text-sm text-gray-500 dark:text-gray-400">Hole Diameter (mm)</label>
                    <input
                        id="hole-diameter"
                        type="number"
                        value={diameter}
                        min={1}
                        step={0.5}
                        onChange={(e) => saveDiameter(parseFloat(e.target.value) || 10)}
                        className="w-full mt-0.5 text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-dark text-gray-900 dark:text-white"
                    />
                </div>
            </div>
        </div>
    );

    const handleProbeComplete = () => {
        onSettingsUpdate('lastProbedDiameter', diameter);
        onSettingsUpdate('lastProbedWidth', null);
        onSettingsUpdate('lastProbedLength', null);
        onSettingsUpdate('lastProbedTimestamp', Date.now());
    };

    return (
        <WizardShell
            title="Hole Center"
            isOpen={isOpen}
            onClose={onClose}
            onBack={onBack}
            introContent={intro}
            connectivityTest={settings.connectivityTest}
            onExecute={handleExecute}
            showXY={true}
            wcsIndex={settings.wcsIndex}
            probedDimensions={{ diameter }}
            onProbeComplete={handleProbeComplete}
        />
    );
};

export default HoleCenterWizard;
