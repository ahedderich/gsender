import React, { useMemo, useState } from 'react';
import WizardShell from './WizardShell';
import { Button } from 'app/components/Button';
import { StockProbeSettings, HeightmapData } from '../definitions';
import { generateHeightmapGrid, generateHeightmapGCode, hmValueKey } from '../StockProbeGCode';
import { useGcodeTransforms } from '../hooks/useGcodeTransforms';
import HeightmapView from '../components/HeightmapView';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    settings: StockProbeSettings;
    onSettingsUpdate: (key: keyof StockProbeSettings, value: unknown) => void;
}

const NumberField: React.FC<{
    label: string; value: number; onChange: (v: number) => void; min?: number; step?: number;
}> = ({ label, value, onChange, min = 0, step = 1 }) => (
    <div className="flex items-center justify-between gap-2">
        <label className="text-sm text-gray-600 dark:text-gray-300">{label}</label>
        <input
            type="number"
            value={value}
            min={min}
            step={step}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-24 text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-0.5 bg-white dark:bg-dark text-gray-900 dark:text-white"
        />
    </div>
);

const HeightmapWizard: React.FC<Props> = ({ isOpen, onClose, settings, onSettingsUpdate }) => {
    const [resolution, setResolution] = useState(settings.heightmapResolution);
    const [safeTravel, setSafeTravel] = useState(settings.heightmapSafeTravel);
    const [maxDistance, setMaxDistance] = useState(settings.heightmapMaxDistance);
    const [probingHeight, setProbingHeight] = useState(settings.heightmapProbingHeight);
    const [edgeInset, setEdgeInset] = useState(settings.heightmapEdgeInset);
    const [heightmap, setHeightmap] = useState<HeightmapData | undefined>(undefined);

    const { applyHeightmap, fileLoaded, heightmapApplied } = useGcodeTransforms();

    const save = (key: keyof StockProbeSettings, v: number, setLocal: (n: number) => void) => {
        if (!Number.isFinite(v)) return;
        setLocal(v);
        onSettingsUpdate(key, v);
    };

    // Grid recomputed from the live config + stock dimensions.
    const grid = useMemo(
        () => generateHeightmapGrid({
            ...settings,
            heightmapResolution: resolution,
            heightmapEdgeInset: edgeInset,
        }),
        [settings, resolution, edgeInset],
    );
    const pointCount = grid.points.filter((p) => p.inside).length;

    const handleExecute = () =>
        generateHeightmapGCode(grid, {
            safeTravel,
            probingHeight,
            maxDistance,
            probeFeedrateFast: settings.probeFeedrateFast,
            probeFeedrateSlow: settings.probeFeedrateSlow,
            travelFeedrate: 5000,
        });

    const handleComplete = (vars: Record<string, number>) => {
        // Reference = probed Z at the inside point nearest work (0,0).
        let refZ = NaN;
        let bestD = Infinity;
        for (const p of grid.points) {
            if (!p.inside) continue;
            const z = vars[hmValueKey(p.row * grid.cols + p.col)];
            if (!Number.isFinite(z)) continue;
            const d = p.x * p.x + p.y * p.y;
            if (d < bestD) { bestD = d; refZ = z; }
        }
        const z: Array<number | null> = new Array(grid.rows * grid.cols).fill(null);
        for (const p of grid.points) {
            const i = p.row * grid.cols + p.col;
            if (!p.inside) continue;
            const raw = vars[hmValueKey(i)];
            z[i] = Number.isFinite(raw) && Number.isFinite(refZ) ? raw - refZ : null;
        }
        const data: HeightmapData = {
            shape: grid.shape,
            originX: grid.originX, originY: grid.originY,
            stepX: grid.stepX, stepY: grid.stepY,
            cols: grid.cols, rows: grid.rows,
            resolution: grid.resolution, z,
        };
        setHeightmap(data);
        onSettingsUpdate('lastHeightmap', data);
    };

    const intro = (
        <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
                Probes a grid of Z points across the {settings.stockType} stock surface
                (inset from the edges) and maps the surface. Start with the tool at work
                zero (stock centre / surface origin).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                <NumberField label="Probing resolution (mm)" value={resolution} min={1}
                    onChange={(v) => save('heightmapResolution', v, setResolution)} />
                <NumberField label="Safe travel height (mm)" value={safeTravel}
                    onChange={(v) => save('heightmapSafeTravel', v, setSafeTravel)} />
                <NumberField label="Max probing distance (mm)" value={maxDistance} min={1}
                    onChange={(v) => save('heightmapMaxDistance', v, setMaxDistance)} />
                <NumberField label="Probing height (mm)" value={probingHeight}
                    onChange={(v) => save('heightmapProbingHeight', v, setProbingHeight)} />
                <NumberField label="XY distance from edges (mm)" value={edgeInset}
                    onChange={(v) => save('heightmapEdgeInset', v, setEdgeInset)} />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
                Grid: {grid.cols} × {grid.rows} — {pointCount} probe point{pointCount === 1 ? '' : 's'}.
            </p>
        </div>
    );

    const renderResults = ({ onRetry, onClose: closeResults }: { onRetry: () => void; onClose: () => void }) => (
        <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Surface heightmap</p>
            {heightmap ? (
                <HeightmapView data={heightmap} />
            ) : (
                <p className="text-gray-400 italic text-sm">No heightmap data captured.</p>
            )}
            {heightmap && (
                <div className="flex flex-col items-center gap-1">
                    <Button
                        variant="primary"
                        size="sm"
                        disabled={!fileLoaded || heightmapApplied}
                        onClick={() => applyHeightmap(heightmap)}
                    >
                        Apply heightmap to loaded gcode
                    </Button>
                    {heightmapApplied ? (
                        <span className="text-xs text-gray-500 dark:text-gray-400">Heightmap applied — revert from the Stock Probe widget.</span>
                    ) : !fileLoaded ? (
                        <span className="text-xs text-gray-400 italic">Load a g-code file to enable.</span>
                    ) : null}
                </div>
            )}
            <div className="flex gap-2 mt-1">
                <Button variant="secondary" size="sm" onClick={onRetry}>Retry</Button>
                <Button variant="secondary" size="sm" onClick={closeResults}>Close</Button>
            </div>
        </div>
    );

    return (
        <WizardShell
            title="Heightmap Probing"
            isOpen={isOpen}
            onClose={onClose}
            introContent={intro}
            connectivityTest={settings.connectivityTest}
            onExecute={handleExecute}
            wcsIndex={settings.wcsIndex}
            onProbeComplete={handleComplete}
            renderResults={renderResults}
        />
    );
};

export default HeightmapWizard;
