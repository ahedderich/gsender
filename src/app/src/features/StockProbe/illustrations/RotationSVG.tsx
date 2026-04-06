import React from 'react';
import { SideSelection } from '../definitions';

interface Props {
    side: SideSelection;
    className?: string;
}

/**
 * 3 evenly-spaced probe points along the selected side of the 3D block.
 * Top-down 45° view. Top face corners:
 *   FLT(18,86) = front-left (X-min, Y-min)
 *   FRT(88,86) = front-right (X-max, Y-min)
 *   BRT(116,54) = back-right (X-max, Y-max)
 *   BLT(46,54) = back-left  (X-min, Y-max)
 *
 * sides: top=Y+ back edge, bottom=Y- front edge, left=X- diagonal, right=X+ diagonal
 */
const SIDE_POINTS: Record<SideSelection, Array<[number, number]>> = {
    // Back edge (Y+): BLT(46,54) → BRT(116,54)
    top:    [[57, 54], [81, 54], [105, 54]],
    // Front edge (Y-): FLT(18,86) → FRT(88,86)
    bottom: [[28, 86], [53, 86], [78, 86]],
    // Left edge (X-): FLT(18,86) → BLT(46,54), direction (+28,−32)
    left:   [[25, 79], [32, 70], [39, 61]],
    // Right edge (X+): FRT(88,86) → BRT(116,54), direction (+28,−32)
    right:  [[95, 79], [102, 70], [109, 61]],
};

const RotationSVG: React.FC<Props> = ({ side, className = 'w-36 h-36 dark:invert' }) => {
    const pts = SIDE_POINTS[side];

    return (
        <svg viewBox="0 0 140 140" className={className} xmlns="http://www.w3.org/2000/svg">
            {/* 3D stock block — top-down 45° view */}
            <polygon points="18,86 88,86 116,54 46,54" fill="#d8e4f0" stroke="#506070" strokeWidth="1.5"/>
            <polygon points="18,86 88,86 88,106 18,106" fill="#c0cdd8" stroke="#506070" strokeWidth="1.5"/>
            <polygon points="88,86 116,54 116,74 88,106" fill="#98aab8" stroke="#506070" strokeWidth="1.5"/>

            {/* Dashed line through the 3 probe points */}
            <line
                x1={pts[0][0]} y1={pts[0][1]}
                x2={pts[2][0]} y2={pts[2][1]}
                stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4,3"
            />

            {/* 3 probe point markers */}
            {pts.map(([cx, cy], i) => (
                <g key={i}>
                    <circle cx={cx} cy={cy} r="5" fill="#ef4444" opacity="0.85"/>
                    <text x={cx + 7} y={cy + 4} fontSize="9" fontWeight="bold" fill="#333">{i + 1}</text>
                </g>
            ))}

            {/* Spindle shown at first probe point */}
            <circle cx={pts[0][0]} cy={pts[0][1]} r="4" fill="none" stroke="#2563eb" strokeWidth="1.5"/>

            {/* Angle arc hint at top-face center (67, 70) */}
            <path
                d="M67,70 L86,70 A19,19 0 0,0 73,53"
                fill="none" stroke="#2563eb" strokeWidth="1" strokeDasharray="3,2"
            />
            <text x="86" y="53" fontSize="8" fill="#2563eb">∠</text>

            <text x="4" y="130" fontSize="7.5" fill="#666">Probe 3 pts — {side} side</text>
        </svg>
    );
};

export default RotationSVG;
