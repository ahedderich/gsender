export const PROBE_FAST          = 500;  // mm/min — initial fast approach
export const PROBE_FAST_RETRACT  = 3;    // mm — back off after fast probe
export const PROBE_SLOW          = 50;   // mm/min — precision approach
export const PROBE_RELEASE_SPD   = 10;   // mm/min — controlled slow release after slow probe
export const PROBE_RELEASE_DIST  = 1;    // mm — distance of controlled release
export const PROBE_CLEARANCE     = 5;    // mm — additional clearance retract at travel speed
export const PROBE_RETRACT_TOTAL = PROBE_RELEASE_DIST + PROBE_CLEARANCE; // 6 mm total from surface
