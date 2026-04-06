import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from 'app/components/shadcn/Dialog';
import { StockProbeSettings, EdgeSelection } from '../definitions';
import ZOnlyWizard from '../wizards/ZOnlyWizard';
import SingleEdgeWizard from '../wizards/SingleEdgeWizard';
import SingleEdgeSVG from '../illustrations/SingleEdgeSVG';
import ZOnlySVG from '../illustrations/ZOnlySVG';

type IndividualAction = 'z' | EdgeSelection | null;

interface Props {
    isOpen: boolean;
    onClose: () => void;
    settings: StockProbeSettings;
    onSettingsUpdate: (key: keyof StockProbeSettings, value: unknown) => void;
}

interface EdgeCardProps {
    edge: EdgeSelection;
    label: string;
    onClick: () => void;
}

const EdgeCard: React.FC<EdgeCardProps> = ({ edge, label, onClick }) => (
    <button
        onClick={onClick}
        className="flex flex-col items-center gap-1 p-2 rounded-xl border-2
                   border-gray-200 dark:border-gray-600
                   hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20
                   transition-colors cursor-pointer w-full"
    >
        <SingleEdgeSVG edge={edge} className="w-20 h-20 dark:invert" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
    </button>
);

const IndividualProbeModal: React.FC<Props> = ({ isOpen, onClose, settings, onSettingsUpdate }) => {
    const [activeWizard, setActiveWizard] = useState<IndividualAction>(null);

    const closeWizard = () => {
        setActiveWizard(null);
        onClose();
    };

    return (
        <>
            <Dialog open={isOpen && !activeWizard} onOpenChange={(open) => { if (!open) onClose(); }}>
                <DialogContent className="max-w-xs">
                    <DialogHeader>
                        <DialogTitle>Individual Probing</DialogTitle>
                    </DialogHeader>

                    <div className="flex flex-col items-center gap-3 py-2">
                        {/* Directional pad — Top / Left-Right / Bottom */}
                        <div className="grid grid-cols-3 gap-2 w-full">
                            {/* Row 1 */}
                            <div />
                            <EdgeCard edge="Y+" label="Top"    onClick={() => setActiveWizard('Y+')} />
                            <div />
                            {/* Row 2 */}
                            <EdgeCard edge="X-" label="Left"   onClick={() => setActiveWizard('X-')} />
                            <div />
                            <EdgeCard edge="X+" label="Right"  onClick={() => setActiveWizard('X+')} />
                            {/* Row 3 */}
                            <div />
                            <EdgeCard edge="Y-" label="Bottom" onClick={() => setActiveWizard('Y-')} />
                            <div />
                        </div>

                        {/* Z probe — full width, visually distinct */}
                        <button
                            onClick={() => setActiveWizard('z')}
                            aria-label="Z Probe"
                            className="flex items-center justify-center gap-3 w-full px-4 py-2
                                       rounded-xl border-2
                                       border-gray-200 dark:border-gray-600
                                       hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20
                                       transition-colors cursor-pointer"
                        >
                            <ZOnlySVG className="w-16 h-16 dark:invert flex-shrink-0" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Z</span>
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Z only wizard */}
            <ZOnlyWizard
                isOpen={activeWizard === 'z'}
                onClose={closeWizard}
                settings={settings}
                onSettingsUpdate={onSettingsUpdate}
            />

            {/* X/Y edge wizards */}
            {(['X+', 'X-', 'Y+', 'Y-'] as EdgeSelection[]).map((edge) => (
                <SingleEdgeWizard
                    key={edge}
                    isOpen={activeWizard === edge}
                    onClose={closeWizard}
                    settings={settings}
                    onSettingsUpdate={onSettingsUpdate}
                    presetEdge={edge}
                />
            ))}
        </>
    );
};

export default IndividualProbeModal;
