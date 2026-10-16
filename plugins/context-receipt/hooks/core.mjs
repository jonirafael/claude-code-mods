// Pure helpers for context-receipt. No `$`, no I/O: easy to unit test.

/** Rough token estimate for text that enters the context (≈4 chars per token). */
export function estimateTokens(text) {
  if (typeof text !== "string" || text.length === 0) return 0;
  return Math.ceil(text.length / 4);
}

/** The text a tool answer puts in front of the model. */
export function answerText(answer) {
  if (answer == null) return "";
  if (typeof answer === "string") return answer;
  if (typeof answer.text === "string") return answer.text;
  if (typeof answer.deny === "string") return answer.deny;
  try {
    return JSON.stringify(answer.result ?? answer) ?? "";
  } catch {
    return "";
  }
}

function clip(s, n) {
  const flat = String(s).replace(/\s+/g, " ").trim();
  return flat.length > n ? flat.slice(0, n - 1) + "…" : flat;
}

function base(p) {
  const parts = String(p).split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? String(p);
}

/** A short, human label for one tool call. */
export function labelFor(e) {
  const tool = String(e?.tool ?? "tool");
  const pick = (...keys) => {
    for (const k of keys) {
      const v = e?.[k] ?? e?.input?.[k] ?? e?.args?.[k];
      if (typeof v === "string" && v) return v;
    }
    return "";
  };
  let detail = "";
  switch (tool) {
    case "Read": case "Write": case "Edit": case "MultiEdit": case "NotebookEdit":
      detail = base(pick("file_path", "notebook_path", "path")); break;
    case "Bash": case "PowerShell":
      detail = clip(pick("command"), 28); break;
    case "Grep": case "Glob":
      detail = clip(pick("pattern"), 24); break;
    case "WebFetch": {
      const url = pick("url");
      const m = /^[a-z]+:\/\/([^/]+)/i.exec(url);
      detail = m ? m[1] : clip(url, 24); break;
    }
    case "WebSearch":
      detail = clip(pick("query"), 24); break;
    case "Agent": case "Task":
      detail = clip(pick("description", "subagent_type"), 24); break;
    default:
      if (tool.startsWith("mcp__")) return clip(tool.split("__").slice(1).join(":"), 32);
  }
  return detail ? `${tool} ${detail}` : tool;
}

/** Merge items with the same label and sort biggest first. */
export function rank(items, limit = Infinity) {
  const byLabel = new Map();
  for (const it of items) {
    const prev = byLabel.get(it.label);
    if (prev) prev.tokens += it.tokens;
    else byLabel.set(it.label, { ...it });
  }
  return [...byLabel.values()].sort((a, b) => b.tokens - a.tokens).slice(0, limit);
}

/** Keep the session's N biggest single items. */
export function mergeTop(top, items, limit = 10) {
  return [...top, ...items].sort((a, b) => b.tokens - a.tokens).slice(0, limit);
}

export function short(n) {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${+(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

/** Pieces of the one-line band. Returns null when there is nothing to show. */
export function bandParts(receipt, columns = 80) {
  if (!receipt) return null;
  const head = receipt.delta == null
    ? `ctx ${receipt.percent}%`
    : `ctx ${receipt.percent}% ${receipt.delta >= 0 ? "+" : "−"}${short(Math.abs(receipt.delta))} last turn`;
  const room = Math.max(0, columns - head.length - 4);
  const items = [];
  let used = 0;
  const ranked = rank(receipt.items);
  for (const it of ranked) {
    const s = `${it.label} ≈${short(it.tokens)}`;
    if (used + s.length + 3 > room) break;
    items.push(s);
    used += s.length + 3;
  }
  const more = ranked.length - items.length;
  return { head, items, more, level: receipt.percent >= 80 ? "hot" : receipt.percent >= 50 ? "warm" : "cool" };
}

/** Text for /receipt. */
export function report(last, top) {
  const lines = [];
  if (!last) return "context-receipt: no completed turn yet.";
  lines.push(`Context: ${short(last.tokens)} / ${short(last.window)} (${last.percent}%)` +
    (last.delta == null ? "" : `, ${last.delta >= 0 ? "+" : "−"}${short(Math.abs(last.delta))} last turn`));
  const ranked = rank(last.items);
  if (ranked.length) {
    lines.push("", "Last turn, tool results (estimated, ≈4 chars/token):");
    for (const it of ranked.slice(0, 10)) lines.push(`  ≈${short(it.tokens).padStart(6)}  ${it.label}`);
    if (ranked.length > 10) lines.push(`  … ${ranked.length - 10} more`);
  } else {
    lines.push("", "Last turn added no tool results (growth is your prompt and Claude's reply).");
  }
  if (top.length) {
    lines.push("", "Biggest single tool results this session:");
    for (const it of top) lines.push(`  ≈${short(it.tokens).padStart(6)}  ${it.label}`);
  }
  lines.push("", "Estimates are for tool output only; /context gives the exact breakdown.");
  return lines.join("\n");
}
