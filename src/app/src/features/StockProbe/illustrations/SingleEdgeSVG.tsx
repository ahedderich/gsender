import React from 'react';
import { EdgeSelection } from '../definitions';

interface Props {
    edge: EdgeSelection;
    className?: string;
}

/**
 * Probe approach configs for each edge — top-down 45° view.
 * X axis is horizontal; Y axis goes diagonally upper-right.
 * Arrow goes FROM outside the stock TOWARD the target edge.
 *
 * Top face corners: FLT(18,86)=X-,Y-  FRT(88,86)=X+,Y-  BRT(116,54)=X+,Y+  BLT(46,54)=X-,Y+
 */
const EDGE_3D: Record<EdgeSelection, {
    sx: number; sy: number;
    arrow: [number, number, number, number];
    color: string;
    label: string;
}> = {
    // Right face (X+): approached horizontally from the right
    'X+': { sx: 130, sy: 70,
        arrow: [137, 70, 119, 70],
        color: '#dc2626', label: 'X+' },
    // Left edge (X-): approached horizontally from the left
    'X-': { sx: 4,   sy: 70,
        arrow: [3,   70, 15,  70],
        color: '#dc2626', label: 'X−' },
    // Back edge (Y+): approached diagonally from the upper-right
    'Y+': { sx: 104, sy: 38,
        arrow: [101, 37, 86, 52],
        color: '#16a34a', label: 'Y+' },
    // Front edge (Y-): approached diagonally from the lower-left
    'Y-': { sx: 30,  sy: 114,
        arrow: [31, 115, 47, 92],
        color: '#16a34a', label: 'Y−' },
};

const SingleEdgeSVG: React.FC<Props> = ({ edge, className = 'w-36 h-36 dark:invert' }) => {
    const { sx, sy, arrow, color, label } = EDGE_3D[edge];
    const markerId = `se-a-${edge.replace('+', 'p').replace('-', 'm')}`;

    return (
        <svg viewBox="0 0 140 140" className={className} xmlns="http://www.w3.org/2000/svg">
            <defs>
                <marker id={markerId} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill={color}/>
                </marker>
            </defs>

            {/* 3D stock block — top-down 45° view */}
            <polygon points="18,86 88,86 116,54 46,54" fill="#d8e4f0" stroke="#506070" strokeWidth="1.5"/>
            <polygon points="18,86 88,86 88,106 18,106" fill="#c0cdd8" stroke="#506070" strokeWidth="1.5"/>
            <polygon points="88,86 116,54 116,74 88,106" fill="#98aab8" stroke="#506070" strokeWidth="1.5"/>

            {/* Probe spindle crosshair outside the target edge */}
            <circle cx={sx} cy={sy} r="5" fill="none" stroke="#2563eb" strokeWidth="1.5"/>
            <line x1={sx} y1={sy - 5} x2={sx} y2={sy - 11} stroke="#2563eb" strokeWidth="1.5"/>
            <line x1={sx} y1={sy + 5} x2={sx} y2={sy + 11} stroke="#2563eb" strokeWidth="1.5"/>
            <line x1={sx - 5} y1={sy} x2={sx - 11} y2={sy} stroke="#2563eb" strokeWidth="1.5"/>
            <line x1={sx + 5} y1={sy} x2={sx + 11} y2={sy} stroke="#2563eb" strokeWidth="1.5"/>

            {/* Probe approach arrow */}
            <line
                x1={arrow[0]} y1={arrow[1]}
                x2={arrow[2]} y2={arrow[3]}
                stroke={color} strokeWidth="3"
                markerEnd={`url(#${markerId})`}
            />

            {/* Edge label */}
            <text x="70" y="128" textAnchor="middle" fontSize="10" fontWeight="bold" fill={color}>
                Edge {label}
            </text>
        </svg>
    );
};

export default SingleEdgeSVG;
