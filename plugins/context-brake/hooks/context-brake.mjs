// context-brake: one gentle, one-time nudge when the context window gets full.
import { DEFAULT_THRESHOLD, note, parseThreshold, step } from "./core.mjs";

const PERCENT = { plugin: "context-brake", key: "percent" };
const ARMED = { plugin: "context-brake", key: "armed" };
const FIRED = { plugin: "context-brake", key: "fired" };
const STORE_KEY = "context-brake:threshold"; // persists across sessions

const val = (r, fallback) => r?.value ?? fallback;

async function threshold($) {
  try {
    const v = await $.store.get(STORE_KEY); // $.store.get resolves to the stored value itself
    if (v === "off") return null;
    return Number.isInteger(v) ? v : DEFAULT_THRESHOLD;
  } catch {
    return DEFAULT_THRESHOLD;
  }
}

async function reading($) {
  const { context } = await $.session.usage();
  if (!context?.window) return null;
  return context.percent ?? Math.round(((context.tokens ?? 0) / context.window) * 100);
}

async function update($) {
  const percent = await reading($);
  if (percent == null) return;
  const limit = await threshold($);
  const before = { armed: val(await $.state.get(ARMED), false), fired: val(await $.state.get(FIRED), false) };
  const after = step(before, percent, limit);
  await $.state.set(PERCENT, percent);
  await $.state.set(ARMED, after.armed);
  await $.state.set(FIRED, after.fired);
  if (after.armed && !before.armed) {
    try { $.ui.toast(`Context ${percent}% full: Claude will wrap up at a clean boundary. /compact when ready.`); } catch { /* no UI */ }
  }
}

export function register(on) {
  on("session.start", async ($, e, next) => {
    const result = await next(e);
    try {
      await $.command.register({ name: "brake", description: "Context brake: /brake [status | <10-99> | off]" });
    } catch { /* never block startup */ }
    try { await update($); } catch { /* usage unavailable */ }
    return result;
  });

  on("turn.complete", async ($, e, next) => {
    const result = await next(e);
    if (!e.agentId) {
      try { await update($); } catch { /* usage unavailable */ }
    }
    return result;
  });

  // The only rewrite: attach the note once, as context beside the user's own prompt (never edits the prompt text).
  on("prompt.submit", async ($, e, next) => {
    let armed = false;
    try { armed = val(await $.state.get(ARMED), false); } catch { /* fall through */ }
    if (!armed) return next(e);
    const percent = val(await $.state.get(PERCENT), 0);
    await $.state.set(ARMED, false);
    await $.state.set(FIRED, true);
    return next({ ...e, context: [...(Array.isArray(e.context) ? e.context : []), note(percent)] });
  });

  on("command.run", { command: "brake" }, async ($, e) => {
    const arg = String(e.args ?? "").trim();
    if (arg && arg !== "status") {
      const parsed = parseThreshold(arg);
      if (!parsed) return { text: "Usage: /brake [status | <10-99> | off]" };
      await $.store.set(STORE_KEY, parsed.off ? "off" : parsed.threshold);
      await $.state.set(ARMED, false);
      await $.state.set(FIRED, false);
      try { await update($); } catch { /* ignore */ }
      return { text: parsed.off ? "Context brake off." : `Context brake set to ${parsed.threshold}%.` };
    }
    const limit = await threshold($);
    const percent = val(await $.state.get(PERCENT), null);
    const fired = val(await $.state.get(FIRED), false);
    const armed = val(await $.state.get(ARMED), false);
    const where = percent == null ? "no reading yet" : `context ${percent}%`;
    const status = limit == null ? "off" : armed ? "armed: the note goes out with your next prompt" : fired ? "already sent for this fill; re-arms after /compact or /clear" : "waiting";
    return { text: `Context brake ${limit == null ? "" : `at ${limit}% `}(${where}): ${status}.` };
  });
}
