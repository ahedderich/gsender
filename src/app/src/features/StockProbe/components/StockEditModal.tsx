import React from 'react';
import cx from 'classnames';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from 'app/components/shadcn/Dialog';
import { Button } from 'app/components/Button';
import { StockProbeSettings, StockType } from '../definitions';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    settings: StockProbeSettings;
    onUpdate: (key: keyof StockProbeSettings, value: unknown) => void;
}

const StockEditModal: React.FC<Props> = ({ isOpen, onClose, settings, onUpdate }) => {
    const isRect = settings.stockType === 'rectangle';

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Stock Dimensions</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-2">
                    {/* Stock type */}
                    <div>
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5 block">
                            Stock Type
                        </label>
                        <div className="flex gap-2">
                            {(['rectangle', 'round'] as StockType[]).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => onUpdate('stockType', t)}
                                    className={cx(
                                        'flex-1 py-2 rounded border capitalize text-sm transition-colors',
                                        settings.stockType === t
                                            ? 'bg-blue-500 text-white border-blue-500'
                                            : 'bg-white dark:bg-dark text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600',
                                    )}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Dimensions */}
                    {isRect ? (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                                    Width — X (mm)
                                </label>
                                <input
                                    type="number"
                                    value={settings.stockWidth}
                                    min={1}
                                    step={1}
                                    onChange={(e) => onUpdate('stockWidth', parseFloat(e.target.value) || 0)}
                                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-dark text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                                    Length — Y (mm)
                                </label>
                                <input
                                    type="number"
                                    value={settings.stockLength}
                                    min={1}
                                    step={1}
                                    onChange={(e) => onUpdate('stockLength', parseFloat(e.target.value) || 0)}
                                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-dark text-gray-900 dark:text-white"
                                />
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                                Diameter (mm)
                            </label>
                            <input
                                type="number"
                                value={settings.stockDiameter}
                                min={1}
                                step={1}
                                onChange={(e) => onUpdate('stockDiameter', parseFloat(e.target.value) || 0)}
                                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-dark text-gray-900 dark:text-white"
                            />
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="primary" onClick={onClose}>Done</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default StockEditModal;
