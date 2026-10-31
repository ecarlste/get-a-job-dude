// How an Interview Loop ended, or open while it hasn't. Free of imports, so the
// schema and client components can share it.
export const loopEndings = ["open", "offer", "rejected", "withdrawn", "ghosted"] as const;

export type LoopEnding = (typeof loopEndings)[number];
