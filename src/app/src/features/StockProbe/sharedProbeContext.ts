// In-memory shared context: variables captured from the most recent probe run.
// Reset on page reload. Never persisted — probe coordinates are machine-state-relative
// and meaningless after reconnect or any repositioning.

const sharedContext: Record<string, number> = {};

export function setSharedProbeContext(vars: Record<string, number>): void {
    Object.keys(sharedContext).forEach((k) => delete sharedContext[k]);
    Object.assign(sharedContext, vars);
}

export function getSharedContextInjectionLines(): string[] {
    return Object.entries(sharedContext).map(([k, v]) => `%global.${k}=${v}`);
}

export function clearSharedProbeContext(): void {
    Object.keys(sharedContext).forEach((k) => delete sharedContext[k]);
}
