import React from 'react';

interface Props {
    className?: string;
}

const ZOnlySVG: React.FC<Props> = ({ className = 'w-36 h-36 dark:invert' }) => (
    <svg viewBox="0 0 140 140" className={className} xmlns="http://www.w3.org/2000/svg">
        <defs>
            <marker id="zo-zarr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#2563eb"/>
            </marker>
        </defs>

        {/* 3D stock block — top-down 45° view */}
        {/* Top face (dominant) */}
        <polygon points="18,86 88,86 116,54 46,54" fill="#d8e4f0" stroke="#506070" strokeWidth="1.5"/>
        {/* Front face */}
        <polygon points="18,86 88,86 88,106 18,106" fill="#c0cdd8" stroke="#506070" strokeWidth="1.5"/>
        {/* Right face */}
        <polygon points="88,86 116,54 116,74 88,106" fill="#98aab8" stroke="#506070" strokeWidth="1.5"/>

        {/* Probe / spindle shaft above top-face center (67, 70) */}
        <rect x="64" y="14" width="6" height="20" rx="1" fill="#888" stroke="#556" strokeWidth="1"/>
        <ellipse cx="67" cy="14" rx="5" ry="2.5" fill="#bbb" stroke="#556" strokeWidth="1"/>
        {/* Probe tip */}
        <polygon points="63,34 71,34 67,42" fill="#666" stroke="#444" strokeWidth="0.5"/>

        {/* Z arrow from probe tip down toward top-face center */}
        <line x1="67" y1="42" x2="67" y2="63" stroke="#2563eb" strokeWidth="2.5" markerEnd="url(#zo-zarr)"/>
        <text x="73" y="58" fontSize="10" fontWeight="bold" fill="#2563eb">Z</text>
    </svg>
);

export default ZOnlySVG;
