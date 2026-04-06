import React from 'react';
import { StockType } from '../definitions';

interface Props {
    stockType: StockType;
    className?: string;
}

/** 3D top-down 45° illustration of center probing (from outside). */
const XYZCenterSVG: React.FC<Props> = ({ stockType, className = 'w-36 h-36 dark:invert' }) => (
    <svg viewBox="0 0 140 140" className={className} xmlns="http://www.w3.org/2000/svg">
        <defs>
            <marker id="xyz-a" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#ef4444"/>
            </marker>
            <marker id="xyz-za" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#2563eb"/>
            </marker>
        </defs>

        {stockType === 'rectangle' ? (
            <>
                {/* 3D rectangular stock — top-down 45° view */}
                <polygon points="18,86 88,86 116,54 46,54" fill="#d8e4f0" stroke="#506070" strokeWidth="1.5"/>
                <polygon points="18,86 88,86 88,106 18,106" fill="#c0cdd8" stroke="#506070" strokeWidth="1.5"/>
                <polygon points="88,86 116,54 116,74 88,106" fill="#98aab8" stroke="#506070" strokeWidth="1.5"/>
            </>
        ) : (
            <>
                {/* 3D cylindrical stock — top-down 45° view */}
                {/* Cylinder body */}
                <path d="M29,70 L29,84 A38,20 0 0,1 105,84 L105,70" fill="#c0cdd8" stroke="none"/>
                <path d="M29,84 A38,20 0 0,1 105,84" fill="none" stroke="#506070" strokeWidth="1.5"/>
                <line x1="29" y1="70" x2="29" y2="84" stroke="#506070" strokeWidth="1.5"/>
                <line x1="105" y1="70" x2="105" y2="84" stroke="#506070" strokeWidth="1.5"/>
                {/* Top ellipse face */}
                <ellipse cx="67" cy="70" rx="38" ry="20" fill="#d8e4f0" stroke="#506070" strokeWidth="1.5"/>
            </>
        )}

        {/* Crosshair at top-face center (67, 70) */}
        <circle cx="67" cy="70" r="5" fill="none" stroke="#2563eb" strokeWidth="1.5"/>
        <line x1="67" y1="64" x2="67" y2="58" stroke="#2563eb" strokeWidth="1.5"/>
        <line x1="67" y1="76" x2="67" y2="82" stroke="#2563eb" strokeWidth="1.5"/>
        <line x1="61" y1="70" x2="55" y2="70" stroke="#2563eb" strokeWidth="1.5"/>
        <line x1="73" y1="70" x2="79" y2="70" stroke="#2563eb" strokeWidth="1.5"/>

        {/* Z arrow from above */}
        <line x1="67" y1="26" x2="67" y2="56" stroke="#2563eb" strokeWidth="2" markerEnd="url(#xyz-za)"/>
        <text x="71" y="40" fontSize="9" fontWeight="bold" fill="#2563eb">Z</text>

        {/* 4 probe approach arrows */}
        {/* X− from left (horizontal) */}
        <line x1="3"   y1="70" x2="15"  y2="70" stroke="#ef4444" strokeWidth="2" markerEnd="url(#xyz-a)"/>
        {/* X+ from right (horizontal) */}
        <line x1="137" y1="70" x2="120" y2="70" stroke="#ef4444" strokeWidth="2" markerEnd="url(#xyz-a)"/>
        {/* Y− from lower-left (diagonal) */}
        <line x1="34"  y1="115" x2="49"  y2="92" stroke="#ef4444" strokeWidth="2" markerEnd="url(#xyz-a)"/>
        {/* Y+ from upper-right (diagonal) */}
        <line x1="100" y1="38" x2="84"  y2="53" stroke="#ef4444" strokeWidth="2" markerEnd="url(#xyz-a)"/>
    </svg>
);

export default XYZCenterSVG;
