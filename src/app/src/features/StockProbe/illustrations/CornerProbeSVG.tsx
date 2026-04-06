import React from 'react';
import { CornerSelection } from '../definitions';

interface Props {
    corner: CornerSelection;
    className?: string;
}

/**
 * Corner positions mapped to 3D-block top-face vertices (top-down 45° view).
 * Top face: FLT(18,86)=BL, FRT(88,86)=BR, BRT(116,54)=TR, BLT(46,54)=TL
 *   X axis = horizontal, Y axis = diagonal upper-right
 */
const CORNER_3D: Record<CornerSelection, {
    sx: number; sy: number;
    xArrow: [number, number, number, number];   // x1,y1 → x2,y2 (X axis probe)
    yArrow: [number, number, number, number];   // x1,y1 → x2,y2 (Y axis probe)
}> = {
    // BL = front-left corner (X-min, Y-min)
    BL: { sx: 18, sy: 86,
        xArrow: [3,  86, 16, 86],      // X− from left (horizontal)
        yArrow: [8, 113, 16, 92] },    // Y− from lower-left (diagonal)
    // BR = front-right corner (X-max, Y-min)
    BR: { sx: 88, sy: 86,
        xArrow: [137, 86, 90, 86],    // X+ from right (horizontal)
        yArrow: [99, 113, 89, 92] },  // Y− from lower-left (diagonal)
    // TL = back-left corner (X-min, Y-max)
    TL: { sx: 46, sy: 54,
        xArrow: [3,  54, 44, 54],     // X− from left (horizontal)
        yArrow: [58, 40, 47, 52] },   // Y+ from upper-right (diagonal)
    // TR = back-right corner (X-max, Y-max)
    TR: { sx: 116, sy: 54,
        xArrow: [137, 54, 118, 54],   // X+ from right (horizontal)
        yArrow: [128, 40, 117, 52] }, // Y+ from upper-right (diagonal)
};

const CornerProbeSVG: React.FC<Props> = ({ corner, className = 'w-36 h-36 dark:invert' }) => {
    const { sx, sy, xArrow, yArrow } = CORNER_3D[corner];

    return (
        <svg viewBox="0 0 140 140" className={className} xmlns="http://www.w3.org/2000/svg">
            <defs>
                <marker id="cp-xa" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="#dc2626"/>
                </marker>
                <marker id="cp-ya" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="#16a34a"/>
                </marker>
            </defs>

            {/* 3D stock block — top-down 45° view */}
            <polygon points="18,86 88,86 116,54 46,54" fill="#d8e4f0" stroke="#506070" strokeWidth="1.5"/>
            <polygon points="18,86 88,86 88,106 18,106" fill="#c0cdd8" stroke="#506070" strokeWidth="1.5"/>
            <polygon points="88,86 116,54 116,74 88,106" fill="#98aab8" stroke="#506070" strokeWidth="1.5"/>

            {/* Probe crosshair at selected corner */}
            <circle cx={sx} cy={sy} r="5" fill="none" stroke="#2563eb" strokeWidth="1.5"/>
            <line x1={sx} y1={sy - 5} x2={sx} y2={sy - 11} stroke="#2563eb" strokeWidth="1.5"/>
            <line x1={sx} y1={sy + 5} x2={sx} y2={sy + 11} stroke="#2563eb" strokeWidth="1.5"/>
            <line x1={sx - 5} y1={sy} x2={sx - 11} y2={sy} stroke="#2563eb" strokeWidth="1.5"/>
            <line x1={sx + 5} y1={sy} x2={sx + 11} y2={sy} stroke="#2563eb" strokeWidth="1.5"/>

            {/* X approach arrow (red) */}
            <line
                x1={xArrow[0]} y1={xArrow[1]}
                x2={xArrow[2]} y2={xArrow[3]}
                stroke="#dc2626" strokeWidth="2.5"
                markerEnd="url(#cp-xa)"
            />
            {/* Y approach arrow (green) */}
            <line
                x1={yArrow[0]} y1={yArrow[1]}
                x2={yArrow[2]} y2={yArrow[3]}
                stroke="#16a34a" strokeWidth="2.5"
                markerEnd="url(#cp-ya)"
            />

            {/* Corner label */}
            <text
                x={sx + (sx > 70 ? -24 : 8)}
                y={sy + (sy > 65 ? 16 : -12)}
                fontSize="9" fontWeight="bold" fill="#2563eb"
            >
                {corner}
            </text>

            {/* Legend */}
            <text x="4" y="130" fontSize="8" fill="#dc2626">X</text>
            <text x="16" y="130" fontSize="8" fill="#16a34a">Y</text>
        </svg>
    );
};

export default CornerProbeSVG;
