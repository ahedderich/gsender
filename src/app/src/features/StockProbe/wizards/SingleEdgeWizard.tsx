import React, { useState } from 'react';
import WizardShell from './WizardShell';
import SingleEdgeSVG from '../illustrations/SingleEdgeSVG';
import ProbeParamsInput from '../components/ProbeParamsInput';
import { StockProbeSettings, EdgeSelection } from '../definitions';
import { generateSingleEdgeGCode } from '../StockProbeGCode';
import cx from 'classnames';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    settings: StockProbeSettings;
    onSettingsUpdate: (key: keyof StockProbeSettings, value: unknown) => void;
    /** When set from IndividualProbeModal, skip the edge selector */
    presetEdge?: EdgeSelection;
}

const EDGES: EdgeSelection[] = ['X+', 'X-', 'Y+', 'Y-'];

const DIRECTIONS: Record<EdgeSelection, string> = {
    'X+': 'Position outside the right (+X) edge at probing height',
    'X-': 'Position outside the left (−X) edge at probing height',
    'Y+': 'Position outside the top (+Y) edge at probing height',
    'Y-': 'Position outside the bottom (−Y) edge at probing height',
};

const SingleEdgeWizard: React.FC<Props> = ({
    isOpen,
    onClose,
    settings,
    onSettingsUpdate,
    presetEdge,
}) => {
    const [edge, setEdge] = useState<EdgeSelection>(presetEdge ?? 'X+');
    const [buffer, setBuffer] = useState(settings.bufferDistance);
    const [xyHeight, setXyHeight] = useState(settings.xyProbingHeight);

    const saveBuffer = (v: number) => { setBuffer(v); onSettingsUpdate('bufferDistance', v); };
    const saveXyHeight = (v: number) => { setXyHeight(v); onSettingsUpdate('xyProbingHeight', v); };

    const handleExecute = () =>
        generateSingleEdgeGCode({
            edge,
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

    const axisLabel = edge.startsWith('X') ? 'X' : 'Y';

    const intro = (
        <div className="flex flex-col gap-3">
            <div className="flex gap-4 items-start">
                <SingleEdgeSVG edge={edge} className="w-72 h-72 dark:invert flex-shrink-0"/>
                <div className="flex-1">
                    {!presetEdge && (
                        <>
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Edge:</p>
                            <div className="grid grid-cols-4 gap-1 mb-2">
                                {EDGES.map((e) => (
                                    <button
                                        key={e}
                                        onClick={() => setEdge(e)}
                                        className={cx(
                                            'text-sm py-1 px-2 rounded border font-mono transition-colors',
                                            edge === e
                                                ? 'bg-blue-500 text-white border-blue-500'
                                                : 'bg-white dark:bg-dark text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600',
                                        )}
                                    >
                                        {e}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                    <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-300 space-y-0.5">
                        <li>{DIRECTIONS[edge]}</li>
                        <li>{axisLabel} zero set at measured edge</li>
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
            title={`Edge Probe${presetEdge ? ` (${presetEdge})` : ''}`}
            isOpen={isOpen}
            onClose={onClose}
            introContent={intro}
            connectivityTest={settings.connectivityTest}
            onExecute={handleExecute}
            wcsIndex={settings.wcsIndex}
        />
    );
};

export default SingleEdgeWizard;
