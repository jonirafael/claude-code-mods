import { describe, expect, test } from "claude-code/testing";

const BAND = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120 };

describe("context-receipt (real runtime)", () => {
  test("itemises the turn above the prompt and in /receipt", async ($, on) => {
    let tokens = 20_000;
    on("session.start", ($, e) => ({ cwd: e.cwd }));
    on("ui.render", { component: "AbovePrompt" }, ($, e) => { const { Box } = $.ui.resolve(e); return Box({ key: "core-band" }); });
    on("command.register", (_$, e) => ({ value: { command: e.name } }));
    on("session.usage", () => ({ value: { startedAt: 0, rateLimits: [], context: { tokens, window: 200_000, percent: Math.round(tokens / 2_000) } } }));
    on("turn.start", () => ({ turnId: "t" }));
    on("turn.complete", () => ({ text: "" }));
    on("tool.call", (_$, e) => { const s = e.tool === "Read" ? "x".repeat(56_000) : "y".repeat(8_000); return { result: { stdout: s, stderr: "" }, text: s }; });

    await $.session.start({ surface: "terminal", isInteractive: true, cwd: "/work" } as any);
    await $.turn.complete({ reason: "answer", answer: "ok", durationMs: 1 } as any); // baseline reading

    await $.turn.start({ turnId: "t2" } as any);
    const answer = await $.tool.call({ tool: "Read", file_path: "/work/logs/big.log", tool_use_id: "a" } as any);
    expect((answer as any).text.length).toBe(56_000); // passes through untouched
    await $.tool.call({ tool: "Bash", command: "npm test", tool_use_id: "b" } as any);
    tokens = 60_000;
    await $.turn.complete({ reason: "answer", answer: "ok", durationMs: 1 } as any);

    const ui = await $.ui.mount({ plugin: "context-receipt", surface: "terminal", component: "AbovePrompt", props: BAND } as any);
    expect(await ui.find({ type: "Text", text: /ctx 30% \+40k last turn/ })).toBeDefined();
    expect(await ui.find({ type: "Text", text: /Read big\.log ≈14k/ })).toBeDefined();
    expect(await ui.find({ type: "Text", text: /Bash npm test ≈2k/ })).toBeDefined();

    const r = await $.command.run({ command: "receipt", args: "" } as any);
    expect(r.text).toContain("Read big.log");
    expect(r.text).toContain("+40k last turn");

    await $.command.run({ command: "receipt", args: "off" } as any);
    await ui.redraw();
    expect(await ui.find({ key: "context-receipt" })).toBeUndefined();
    await ui.unmount();
  });

  test("yields to surveys and ignores subagent tool calls", async ($, on) => {
    on("session.start", ($, e) => ({ cwd: e.cwd }));
    on("ui.render", { component: "AbovePrompt" }, ($, e) => { const { Box } = $.ui.resolve(e); return Box({ key: "core-band" }); });
    on("command.register", (_$, e) => ({ value: { command: e.name } }));
    on("session.usage", () => ({ value: { startedAt: 0, rateLimits: [], context: { tokens: 1000, window: 200_000, percent: 1 } } }));
    on("turn.start", () => ({ turnId: "t" }));
    on("turn.complete", () => ({ text: "" }));
    on("tool.call", () => ({ result: { stdout: "z", stderr: "" }, text: "z".repeat(40_000) }));
    await $.session.start({ surface: "desktop", isInteractive: true, cwd: "/work" } as any);
    await $.turn.start({ turnId: "t" } as any);
    await $.tool.call({ tool: "Read", file_path: "/x/sub.txt", tool_use_id: "s", agentId: "sub-1" } as any);
    await $.turn.complete({ reason: "answer", answer: "ok", durationMs: 1 } as any);
    const r = await $.command.run({ command: "receipt", args: "" } as any);
    expect(r.text).not.toContain("sub.txt");
    const ui = await $.ui.mount({ plugin: "context-receipt", surface: "desktop", component: "AbovePrompt", props: { ...BAND, hasSurvey: true } } as any);
    expect(await ui.find({ key: "context-receipt" })).toBeUndefined();
    await ui.unmount();
  });
});
