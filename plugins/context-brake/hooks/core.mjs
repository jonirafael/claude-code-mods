// Pure decision logic for context-brake.

export const DEFAULT_THRESHOLD = 80;
export const REARM_GAP = 15; // percentage points below the threshold before the brake re-arms

/**
 * Next brake state after a context reading.
 * - crosses threshold while not yet fired  -> armed (note goes out with the next prompt)
 * - drops REARM_GAP below threshold         -> reset (after /compact or /clear)
 */
export function step(state, percent, threshold) {
  const s = { armed: !!state?.armed, fired: !!state?.fired };
  if (threshold == null || !Number.isFinite(percent)) return s;
  if (percent >= threshold && !s.fired) return { armed: true, fired: false };
  if (percent < threshold - REARM_GAP) return { armed: false, fired: false };
  return s;
}

export function parseThreshold(arg) {
  const a = String(arg ?? "").trim().toLowerCase();
  if (a === "off") return { off: true };
  const n = Number(a.replace(/%$/, ""));
  if (a !== "" && Number.isInteger(n) && n >= 10 && n <= 99) return { threshold: n };
  return null;
}

export function note(percent) {
  return [
    `[context-brake] The context window is ${percent}% full and auto-compaction is approaching.`,
    "Finish the step you are on, then stop at a clean boundary instead of starting large new work.",
    "Before stopping, give a short handoff: goal, what is done, what is left, key files and decisions.",
    "This is a one-time note from a user-installed mod; the user may run /compact afterwards.",
  ].join(" ");
}
