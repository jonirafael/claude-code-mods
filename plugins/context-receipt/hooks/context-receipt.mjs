// context-receipt: an itemised receipt of what each turn added to the context window.
import { answerText, bandParts, estimateTokens, labelFor, mergeTop, report } from "./core.mjs";

const LAST = { plugin: "context-receipt", key: "last" };
const TOP = { plugin: "context-receipt", key: "top" };
const TURNS = { plugin: "context-receipt", key: "turns" };
const HIDDEN = { plugin: "context-receipt", key: "hidden" };
const MIN_TOKENS = 50; // ignore tiny results so the band stays readable

// Items for the turn in flight. Reset at turn.start; a hot reload mid-turn loses only this turn.
let pending = [];

const val = (r, fallback) => r?.value ?? fallback;

async function finishTurn($) {
  const { context } = await $.session.usage();
  if (!context?.window) return;
  const tokens = context.tokens ?? 0;
  const percent = context.percent ?? Math.round((tokens / context.window) * 100);
  const prev = val(await $.state.get(LAST), null);
  const turn = (val(await $.state.get(TURNS), 0)) + 1;
  const items = pending;
  pending = [];
  const delta = prev && prev.window === context.window ? tokens - prev.tokens : null;
  await $.state.set(LAST, { turn, delta, tokens, window: context.window, percent, items });
  await $.state.set(TURNS, turn);
  await $.state.set(TOP, mergeTop(val(await $.state.get(TOP), []), items));
}

export function register(on) {
  on("session.start", async ($, e, next) => {
    const result = await next(e);
    try {
      await $.command.register({ name: "receipt", description: "What filled the context last turn: /receipt [on|off|reset]" });
    } catch { /* never block startup */ }
    return result;
  });

  on("turn.start", async ($, e, next) => {
    if (!e.agentId) pending = [];
    return next(e);
  });

  // Observe only: the call and its answer pass through untouched.
  on("tool.call", async ($, e, next) => {
    const answer = await next(e);
    if (!e.agentId) {
      try {
        const tokens = estimateTokens(answerText(answer));
        if (tokens >= MIN_TOKENS) pending.push({ tool: String(e.tool), label: labelFor(e), tokens });
      } catch { /* measuring must never affect the tool */ }
    }
    return answer;
  });

  on("turn.complete", async ($, e, next) => {
    const result = await next(e);
    if (!e.agentId) {
      try { await finishTurn($); } catch { /* usage unavailable: skip this reading */ }
    }
    return result;
  });

  on("session.end", async ($, e, next) => {
    const result = await next(e);
    if (e.reason === "clear") {
      pending = [];
      try {
        await $.state.set(LAST, null);
        await $.state.set(TOP, []);
        await $.state.set(TURNS, 0);
      } catch { /* ignore */ }
    }
    return result;
  });

  on("command.run", { command: "receipt" }, async ($, e) => {
    const arg = String(e.args ?? "").trim().toLowerCase();
    if (arg === "off" || arg === "on") {
      await $.state.set(HIDDEN, arg === "off");
      return { text: `context-receipt band ${arg === "off" ? "hidden" : "shown"}.` };
    }
    if (arg === "reset") {
      pending = [];
      await $.state.set(LAST, null);
      await $.state.set(TOP, []);
      return { text: "context-receipt cleared." };
    }
    return { text: report(val(await $.state.get(LAST), null), val(await $.state.get(TOP), [])) };
  });

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const hidden = val(await $.state.get(HIDDEN), false);
    const last = val(await $.state.get(LAST), null);
    const parts = hidden || e.props?.hasSurvey ? null : bandParts(last, e.props?.bodyColumns ?? 80);
    if (!parts) return next(e);
    const { Box, Text } = $.ui.resolve(e);
    const color = parts.level === "hot" ? "red" : parts.level === "warm" ? "yellow" : "green";
    const children = [Text({ key: "cr-head", color, bold: true, children: `▤ ${parts.head}` })];
    parts.items.forEach((s, i) => children.push(Text({ key: `cr-item-${i}`, dimColor: i > 0, children: ` · ${s}` })));
    if (parts.more > 0) children.push(Text({ key: "cr-more", dimColor: true, children: ` · +${parts.more} more` }));
    const band = Box({ key: "context-receipt", flexDirection: "row", paddingX: 1, children });
    const below = await next(e);
    return below ? Box({ flexDirection: "column", children: [band, below] }) : band;
  });
}
