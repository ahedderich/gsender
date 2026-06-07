import { ProbeTask, RoundProbeParams } from '../definitions';
import { probeTouchApproach, probeTouchRetract } from './helpers';

export function generateHoleCenterGCode(params: RoundProbeParams): ProbeTask[] {
    const {
        stockDiameter,
        probeFeedrateFast: ff,
        probeFeedrateSlow: fs,
        travelFeedrate: tr,
        wcsIndex,
        safeHeight = 10,
    } = params;

    const holeRadius = stockDiameter / 2;
    const probeDist  = holeRadius + 5;

    return [
        {
            label: 'Spindle/coolant off',
            commands: ['M5', 'M9', 'G21', 'G91', '%global.SP_HX=posx', '%global.SP_HY=posy'],
        },
        {
            label: 'Probing +X wall',
            commands: [
                ...probeTouchApproach('X', 1, probeDist, 'SP_XP', ff, fs),
                ...probeTouchRetract('X', 1, tr),
            ],
        },
        {
            label: 'Returning to start',
            commands: [
                '%global.SP_DX=global.SP_HX-posx',
                '%global.SP_DY=global.SP_HY-posy',
                `G91 G1 X[global.SP_DX] Y[global.SP_DY] F${tr}`,
            ],
        },
        {
            label: 'Probing -X wall',
            commands: [
                ...probeTouchApproach('X', -1, probeDist, 'SP_XM', ff, fs),
                ...probeTouchRetract('X', -1, tr),
            ],
        },
        {
            label: 'Centering X axis',
            commands: [
                '%global.SP_XC=(global.SP_XP+global.SP_XM)/2',
                '%global.SP_DX=global.SP_XC-posx',
                '%global.SP_DY=global.SP_HY-posy',
                `G91 G1 X[global.SP_DX] Y[global.SP_DY] F${tr}`,
            ],
        },
        {
            label: 'Probing +Y wall',
            commands: [
                ...probeTouchApproach('Y', 1, probeDist, 'SP_YP', ff, fs),
                ...probeTouchRetract('Y', 1, tr),
            ],
        },
        {
            label: 'Returning to X center',
            commands: [
                '%global.SP_DX=global.SP_XC-posx',
                '%global.SP_DY=global.SP_HY-posy',
                `G91 G1 X[global.SP_DX] Y[global.SP_DY] F${tr}`,
            ],
        },
        {
            label: 'Probing -Y wall',
            commands: [
                ...probeTouchApproach('Y', -1, probeDist, 'SP_YM', ff, fs),
                ...probeTouchRetract('Y', -1, tr),
            ],
        },
        {
            label: 'Moving to hole center',
            commands: [
                '%global.SP_YC=(global.SP_YP+global.SP_YM)/2',
                '%global.SP_DX=global.SP_XC-posx',
                '%global.SP_DY=global.SP_YC-posy',
                `G91 G1 X[global.SP_DX] Y[global.SP_DY] F${tr}`,
                'G4 P0.1',
                `G10 L20 P${wcsIndex} X0 Y0`,
                '%global.SP_HOLE_DIAMETER=global.SP_XP-global.SP_XM',
                '(MSG, SP_HOLE_DIAMETER=[global.SP_HOLE_DIAMETER])',
                `G91 G1 Z${safeHeight.toFixed(3)} F${tr}`,
            ],
        },
    ];
}
