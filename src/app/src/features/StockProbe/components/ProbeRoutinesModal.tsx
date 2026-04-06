import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from 'app/components/shadcn/Dialog';
import { StockProbeSettings } from '../definitions';
import XYZCenterWizard from '../wizards/XYZCenterWizard';
import HoleCenterWizard from '../wizards/HoleCenterWizard';
import CornerProbeWizard from '../wizards/CornerProbeWizard';
import XYZCenterSVG from '../illustrations/XYZCenterSVG';
import HoleCenterSVG from '../illustrations/HoleCenterSVG';
import CornerProbeSVG from '../illustrations/CornerProbeSVG';

type Routine = 'xyzCenter' | 'holeCenter' | 'cornerProbe' | null;

interface Props {
    isOpen: boolean;
    onClose: () => void;
    settings: StockProbeSettings;
    onSettingsUpdate: (key: keyof StockProbeSettings, value: unknown) => void;
}

const BUTTON_BASE =
    'flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 ' +
    'hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-center';

const ProbeRoutinesModal: React.FC<Props> = ({ isOpen, onClose, settings, onSettingsUpdate }) => {
    const [activeWizard, setActiveWizard] = useState<Routine>(null);
    const isRect = settings.stockType === 'rectangle';

    const closeWizard = () => {
        setActiveWizard(null);
        onClose();
    };

    const backToRoutines = () => setActiveWizard(null);

    return (
        <>
            <Dialog open={isOpen && !activeWizard} onOpenChange={(open) => { if (!open) onClose(); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Probing Routines</DialogTitle>
                    </DialogHeader>

                    <div className="flex flex-col gap-5 py-2">

                        {/* ── Center Probing group ── */}
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                                Center Probing
                            </p>
                            <div className="flex gap-2">
                                {/* Center from outside */}
                                <button className={BUTTON_BASE} onClick={() => setActiveWizard('xyzCenter')}>
                                    <XYZCenterSVG stockType={settings.stockType} className="w-20 h-20 dark:invert"/>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">From Outside</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Probe all sides toward center</p>
                                    </div>
                                </button>

                                {/* Center from inside (hole) */}
                                <button className={BUTTON_BASE} onClick={() => setActiveWizard('holeCenter')}>
                                    <HoleCenterSVG className="w-20 h-20 dark:invert"/>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">From Inside</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Probe outward in a bore / hole</p>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* ── Corner Probing group (rect only) ── */}
                        {isRect && (
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                                    Corner Probing
                                </p>
                                <div className="flex gap-2">
                                    <button className={BUTTON_BASE} onClick={() => setActiveWizard('cornerProbe')}>
                                        <CornerProbeSVG corner="BL" className="w-20 h-20 dark:invert"/>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Corner XYZ</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Zero XYZ at selected corner</p>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>
                </DialogContent>
            </Dialog>

            <XYZCenterWizard
                isOpen={activeWizard === 'xyzCenter'}
                onClose={closeWizard}
                onBack={backToRoutines}
                settings={settings}
                onSettingsUpdate={onSettingsUpdate}
            />
            <HoleCenterWizard
                isOpen={activeWizard === 'holeCenter'}
                onClose={closeWizard}
                onBack={backToRoutines}
                settings={settings}
                onSettingsUpdate={onSettingsUpdate}
            />
            <CornerProbeWizard
                isOpen={activeWizard === 'cornerProbe'}
                onClose={closeWizard}
                onBack={backToRoutines}
                settings={settings}
                onSettingsUpdate={onSettingsUpdate}
            />
        </>
    );
};

export default ProbeRoutinesModal;
