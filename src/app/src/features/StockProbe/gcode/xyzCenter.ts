import { ProbeTask, RectProbeParams, RoundProbeParams } from '../definitions';
import { PROBE_RETRACT_TOTAL } from './constants';
import {
    probeTouchApproach,
    probeTouchRetract,
    probeTouchApproachXY,
    probeTouchRetractXY,
} from './helpers';

export function generateXYZCenterRectGCode(params: RectProbeParams): ProbeTask[] {
    const {
        stockWidth,
        stockLength,
        probeFeedrateFast: ff,
        probeFeedrateSlow: fs,
        travelFeedrate: tr,
        bufferDistance: buf,
        xyProbingHeight: xyH,
        wcsIndex,
        safeHeight = 10,
    } = params;

    const halfW      = stockWidth  / 2;
    const halfL      = stockLength / 2;
    const probeZDist = buf + 10;
    const liftToSafe = (safeHeight - PROBE_RETRACT_TOTAL).toFixed(3);
    const liftFromXY = (safeHeight - xyH).toFixed(3);
    const sinkToXY   = (xyH - safeHeight).toFixed(3);

    return [
        {
            label: 'Spindle/coolant off',
            commands: ['%global.SP_START_X=posx', '%global.SP_START_Y=posy', 'M5', 'M9', 'G21', 'G91'],
        },
        {
            label: 'Probing Z surface',
            commands: [
                ...probeTouchApproach('Z', -1, probeZDist, 'SP_Z', ff, fs),
                `G10 L20 P${wcsIndex} Z0`,
                ...probeTouchRetract('Z', -1, tr),
                `G91 G1 Z${liftToSafe} F${tr}`,
            ],
        },
        {
            label: 'Moving to probing position left',
            commands: [
                `%global.SP_DX=global.SP_START_X-${(halfW + buf).toFixed(3)}-posx`,
                `G91 G1 X[global.SP_DX] F${tr}`,
                `G91 G1 Z${sinkToXY} F${tr}`,
            ],
        },
        {
            label: 'Probing left side',
            commands: [
                ...probeTouchApproach('X', 1, halfW + buf + 5, 'SP_X_MINUS', ff, fs),
                ...probeTouchRetract('X', 1, tr),
            ],
        },
        {
            label: 'Moving to probing position right',
            commands: [
                `G91 G1 Z${liftFromXY} F${tr}`,
                `%global.SP_DX=global.SP_START_X+${(halfW + buf).toFixed(3)}-posx`,
                `G91 G1 X[global.SP_DX] F${tr}`,
                `G91 G1 Z${sinkToXY} F${tr}`,
            ],
        },
        {
            label: 'Probing right side',
            commands: [
                ...probeTouchApproach('X', -1, halfW + buf + 5, 'SP_X_PLUS', ff, fs),
                ...probeTouchRetract('X', -1, tr),
            ],
        },
        {
            label: 'Moving to probing position top',
            commands: [
                `G91 G1 Z${liftFromXY} F${tr}`,
                '%global.SP_X_CENTER=(global.SP_X_MINUS+global.SP_X_PLUS)/2',
                '%global.SP_DX=global.SP_X_CENTER-posx',
                `%global.SP_DY=global.SP_START_Y+${(halfL + buf).toFixed(3)}-posy`,
                `G91 G1 X[global.SP_DX] Y[global.SP_DY] F${tr}`,
                `G91 G1 Z${sinkToXY} F${tr}`,
            ],
        },
        {
            label: 'Probing top side',
            commands: [
                ...probeTouchApproach('Y', -1, halfL + buf + 5, 'SP_Y_PLUS', ff, fs),
                ...probeTouchRetract('Y', -1, tr),
            ],
        },
        {
            label: 'Moving to probing position bottom',
            commands: [
                `G91 G1 Z${liftFromXY} F${tr}`,
                '%global.SP_DX=global.SP_X_CENTER-posx',
                `%global.SP_DY=global.SP_START_Y-${(halfL + buf).toFixed(3)}-posy`,
                `G91 G1 X[global.SP_DX] Y[global.SP_DY] F${tr}`,
                `G91 G1 Z${sinkToXY} F${tr}`,
            ],
        },
        {
            label: 'Probing bottom side',
            commands: [
                ...probeTouchApproach('Y', 1, halfL + buf + 5, 'SP_Y_MINUS', ff, fs),
                ...probeTouchRetract('Y', 1, tr),
            ],
        },
        {
            label: 'Moving to work zero',
            commands: [
                `G91 G1 Z${liftFromXY} F${tr}`,
                '%global.SP_Y_CENTER=(global.SP_Y_MINUS+global.SP_Y_PLUS)/2',
                '%global.SP_DX=global.SP_X_CENTER-posx',
                '%global.SP_DY=global.SP_Y_CENTER-posy',
                `G91 G1 X[global.SP_DX] Y[global.SP_DY] F${tr}`,
                'G4 P0.1',
                `G10 L20 P${wcsIndex} X0 Y0`,
                '%global.SP_WIDTH=global.SP_X_PLUS-global.SP_X_MINUS',
                '%global.SP_LENGTH=global.SP_Y_PLUS-global.SP_Y_MINUS',
                '(MSG, SP_WIDTH=[global.SP_WIDTH])',
                '(MSG, SP_LENGTH=[global.SP_LENGTH])',
            ],
        },
    ];
}

export function generateXYZCenterRoundGCode(params: RoundProbeParams): ProbeTask[] {
    const {
        stockDiameter,
        probeFeedrateFast: ff,
        probeFeedrateSlow: fs,
        travelFeedrate: tr,
        bufferDistance: buf,
        xyProbingHeight: xyH,
        wcsIndex,
        safeHeight = 10,
    } = params;

    const probeRadius = stockDiameter / 2 + buf;
    const probeZDist  = buf + 10;
    const liftToSafe  = (safeHeight - PROBE_RETRACT_TOTAL).toFixed(3);
    const liftFromXY  = (safeHeight - xyH).toFixed(3);
    const sinkToXY    = (xyH - safeHeight).toFixed(3);

    const angles = [0, 120, 240].map((a) => (a * Math.PI) / 180);
    const dirs   = angles.map((a) => ({ cos: Math.cos(a), sin: Math.sin(a) }));

    return [
        {
            label: 'Spindle/coolant off',
            commands: ['%global.SP_START_X=posx', '%global.SP_START_Y=posy', 'M5', 'M9', 'G21', 'G91'],
        },
        {
            label: 'Probing Z surface',
            commands: [
                ...probeTouchApproach('Z', -1, probeZDist, 'SP_Z', ff, fs),
                `G10 L20 P${wcsIndex} Z0`,
                ...probeTouchRetract('Z', -1, tr),
                `G91 G1 Z${liftToSafe} F${tr}`,
            ],
        },
        {
            label: 'Moving to probing position 1 (0°)',
            commands: [
                `%global.SP_DX=global.SP_START_X+${(dirs[0].cos * probeRadius).toFixed(4)}-posx`,
                `%global.SP_DY=global.SP_START_Y+${(dirs[0].sin * probeRadius).toFixed(4)}-posy`,
                `G91 G1 X[global.SP_DX] Y[global.SP_DY] F${tr}`,
                `G91 G1 Z${sinkToXY} F${tr}`,
            ],
        },
        {
            label: 'Probing point 1 (0°)',
            commands: [
                ...probeTouchApproachXY(dirs[0].cos, dirs[0].sin, probeRadius + 5, 'SP_P1X', 'SP_P1Y', ff, fs),
                ...probeTouchRetractXY(dirs[0].cos, dirs[0].sin, tr),
            ],
        },
        {
            label: 'Moving to probing position 2 (120°)',
            commands: [
                `G91 G1 Z${liftFromXY} F${tr}`,
                `%global.SP_DX=global.SP_START_X+${(dirs[1].cos * probeRadius).toFixed(4)}-posx`,
                `%global.SP_DY=global.SP_START_Y+${(dirs[1].sin * probeRadius).toFixed(4)}-posy`,
                `G91 G1 X[global.SP_DX] Y[global.SP_DY] F${tr}`,
                `G91 G1 Z${sinkToXY} F${tr}`,
            ],
        },
        {
            label: 'Probing point 2 (120°)',
            commands: [
                ...probeTouchApproachXY(dirs[1].cos, dirs[1].sin, probeRadius + 5, 'SP_P2X', 'SP_P2Y', ff, fs),
                ...probeTouchRetractXY(dirs[1].cos, dirs[1].sin, tr),
            ],
        },
        {
            label: 'Moving to probing position 3 (240°)',
            commands: [
                `G91 G1 Z${liftFromXY} F${tr}`,
                `%global.SP_DX=global.SP_START_X+${(dirs[2].cos * probeRadius).toFixed(4)}-posx`,
                `%global.SP_DY=global.SP_START_Y+${(dirs[2].sin * probeRadius).toFixed(4)}-posy`,
                `G91 G1 X[global.SP_DX] Y[global.SP_DY] F${tr}`,
                `G91 G1 Z${sinkToXY} F${tr}`,
            ],
        },
        {
            label: 'Probing point 3 (240°)',
            commands: [
                ...probeTouchApproachXY(dirs[2].cos, dirs[2].sin, probeRadius + 5, 'SP_P3X', 'SP_P3Y', ff, fs),
                ...probeTouchRetractXY(dirs[2].cos, dirs[2].sin, tr),
            ],
        },
        {
            label: 'Calculating center (circumcenter)',
            commands: [
                '%global.SP_AX=global.SP_P2X-global.SP_P1X',
                '%global.SP_AY=global.SP_P2Y-global.SP_P1Y',
                '%global.SP_BX=global.SP_P3X-global.SP_P1X',
                '%global.SP_BY=global.SP_P3Y-global.SP_P1Y',
                '%global.SP_D=2*(global.SP_AX*global.SP_BY-global.SP_AY*global.SP_BX)',
                '%global.SP_UX=(global.SP_BY*(global.SP_AX*global.SP_AX+global.SP_AY*global.SP_AY)-global.SP_AY*(global.SP_BX*global.SP_BX+global.SP_BY*global.SP_BY))/global.SP_D',
                '%global.SP_UY=(global.SP_AX*(global.SP_BX*global.SP_BX+global.SP_BY*global.SP_BY)-global.SP_BX*(global.SP_AX*global.SP_AX+global.SP_AY*global.SP_AY))/global.SP_D',
                '%global.SP_CX=global.SP_P1X+global.SP_UX',
                '%global.SP_CY=global.SP_P1Y+global.SP_UY',
                '%global.SP_RADIUS=Math.sqrt(global.SP_UX*global.SP_UX+global.SP_UY*global.SP_UY)',
                '%global.SP_DIAMETER=2*global.SP_RADIUS',
                '(MSG, SP_RADIUS=[global.SP_RADIUS])',
                '(MSG, SP_DIAMETER=[global.SP_DIAMETER])',
            ],
        },
        {
            label: 'Moving to work zero',
            commands: [
                `G91 G1 Z${liftFromXY} F${tr}`,
                '%global.SP_DX=global.SP_CX-posx',
                '%global.SP_DY=global.SP_CY-posy',
                `G91 G1 X[global.SP_DX] Y[global.SP_DY] F${tr}`,
                'G4 P0.1',
                `G10 L20 P${wcsIndex} X0 Y0`,
            ],
        },
    ];
}
