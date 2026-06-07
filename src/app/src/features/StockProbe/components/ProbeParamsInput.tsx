import React from 'react';

interface Props {
    buffer: number;
    xyHeight?: number;
    safeHeight?: number;
    probingZHeight?: number;
    edgeOffset?: number;
    onBufferChange: (v: number) => void;
    onXyHeightChange?: (v: number) => void;
    onSafeHeightChange?: (v: number) => void;
    onProbingZHeightChange?: (v: number) => void;
    onEdgeOffsetChange?: (v: number) => void;
}

/**
 * Compact inline parameter inputs shown at the bottom of wizard intro steps.
 */
const ProbeParamsInput: React.FC<Props> = ({
    buffer,
    xyHeight,
    safeHeight,
    probingZHeight,
    edgeOffset,
    onBufferChange,
    onXyHeightChange,
    onSafeHeightChange,
    onProbingZHeightChange,
    onEdgeOffsetChange,
}) => {
    const colCount = [
        true,
        onXyHeightChange !== undefined && xyHeight !== undefined,
        onSafeHeightChange !== undefined && safeHeight !== undefined,
        onProbingZHeightChange !== undefined && probingZHeight !== undefined,
        onEdgeOffsetChange !== undefined && edgeOffset !== undefined,
    ].filter(Boolean).length;
    const gridClass = ({ 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-3' } as Record<number, string>)[colCount] ?? 'grid-cols-2';

    return (
        <div className="pt-3 mt-1 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Probing Parameters</p>
            <div className={`grid gap-2 ${gridClass}`}>
                <div>
                    <label className="text-sm text-gray-500 dark:text-gray-400">XY Oversize Buffer (mm)</label>
                    <input
                        type="number"
                        value={buffer}
                        min={2}
                        step={1}
                        onChange={(e) => onBufferChange(parseFloat(e.target.value) || 20)}
                        className="w-full mt-0.5 text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-dark text-gray-900 dark:text-white"
                    />
                </div>
                {onXyHeightChange !== undefined && xyHeight !== undefined && (
                    <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400">XY Relative Probing Height (mm)</label>
                        <input
                            type="number"
                            value={xyHeight}
                            max={0}
                            step={0.5}
                            onChange={(e) => onXyHeightChange(parseFloat(e.target.value) || -2)}
                            className="w-full mt-0.5 text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-dark text-gray-900 dark:text-white"
                        />
                    </div>
                )}
                {onSafeHeightChange !== undefined && safeHeight !== undefined && (
                    <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400">Safe Travel Height (mm)</label>
                        <input
                            type="number"
                            value={safeHeight}
                            min={1}
                            step={1}
                            onChange={(e) => onSafeHeightChange(parseFloat(e.target.value) || 10)}
                            className="w-full mt-0.5 text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-dark text-gray-900 dark:text-white"
                        />
                    </div>
                )}
                {onProbingZHeightChange !== undefined && probingZHeight !== undefined && (
                    <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400">Probing Z Height (mm)</label>
                        <input
                            type="number"
                            value={probingZHeight}
                            max={0}
                            step={0.5}
                            onChange={(e) => onProbingZHeightChange(parseFloat(e.target.value) || -3)}
                            className="w-full mt-0.5 text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-dark text-gray-900 dark:text-white"
                        />
                    </div>
                )}
                {onEdgeOffsetChange !== undefined && edgeOffset !== undefined && (
                    <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400">Edge Inset Offset (mm)</label>
                        <input
                            type="number"
                            value={edgeOffset}
                            min={0}
                            step={1}
                            onChange={(e) => onEdgeOffsetChange(parseFloat(e.target.value) || 15)}
                            className="w-full mt-0.5 text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-dark text-gray-900 dark:text-white"
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProbeParamsInput;
