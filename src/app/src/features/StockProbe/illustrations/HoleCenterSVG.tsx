import React from 'react';

interface Props {
    className?: string;
}

/** 3D top-down 45° illustration of hole-center probing (from inside). */
const HoleCenterSVG: React.FC<Props> = ({ className = 'w-36 h-36 dark:invert' }) => (
    <svg viewBox="0 0 140 140" className={className} xmlns="http://www.w3.org/2000/svg">
        <defs>
            <marker id="hc-a" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#ef4444"/>
            </marker>
        </defs>

        {/* 3D stock block — top-down 45° view */}
        <polygon points="18,86 88,86 116,54 46,54" fill="#d8e4f0" stroke="#506070" strokeWidth="1.5"/>
        <polygon points="18,86 88,86 88,106 18,106" fill="#c0cdd8" stroke="#506070" strokeWidth="1.5"/>
        <polygon points="88,86 116,54 116,74 88,106" fill="#98aab8" stroke="#506070" strokeWidth="1.5"/>

        {/* Bore hole — more circular from top-down view */}
        <ellipse cx="67" cy="70" rx="28" ry="18" fill="#606878" stroke="#404858" strokeWidth="1.5"/>
        {/* Hole depth suggestion */}
        <ellipse cx="67" cy="72" rx="23" ry="14" fill="#484e58" stroke="none"/>

        {/* Probe crosshair at hole center */}
        <circle cx="67" cy="70" r="4" fill="none" stroke="#2563eb" strokeWidth="1.5"/>
        <line x1="67" y1="65" x2="67" y2="60" stroke="#2563eb" strokeWidth="1.5"/>
        <line x1="67" y1="75" x2="67" y2="80" stroke="#2563eb" strokeWidth="1.5"/>
        <line x1="62" y1="70" x2="57" y2="70" stroke="#2563eb" strokeWidth="1.5"/>
        <line x1="72" y1="70" x2="77" y2="70" stroke="#2563eb" strokeWidth="1.5"/>

        {/* Outward probe arrows toward hole wall */}
        {/* X+ (right) */}
        <line x1="72" y1="70" x2="90"  y2="70" stroke="#ef4444" strokeWidth="2" markerEnd="url(#hc-a)"/>
        {/* X− (left) */}
        <line x1="62" y1="70" x2="44"  y2="70" stroke="#ef4444" strokeWidth="2" markerEnd="url(#hc-a)"/>
        {/* Y+ upper-right (diagonal) */}
        <line x1="70" y1="65" x2="83"  y2="56" stroke="#ef4444" strokeWidth="2" markerEnd="url(#hc-a)"/>
        {/* Y− lower-left (diagonal) */}
        <line x1="64" y1="75" x2="51"  y2="84" stroke="#ef4444" strokeWidth="2" markerEnd="url(#hc-a)"/>
    </svg>
);

export default HoleCenterSVG;
