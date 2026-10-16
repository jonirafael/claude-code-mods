// Prints the band exactly as the real Claude Code runtime renders it, for scripts/make-demo.py.
import { test } from "claude-code/testing";

test("demo frames", async ($, on) => {
  let tokens = 24_000;
  let results: Record<string, number> = {};
  on("session.start", ($, e) => ({ cwd: e.cwd }));
  on("command.register", (_$, e) => ({ value: { command: e.name } }));
  on("ui.render", { component: "AbovePrompt" }, ($, e) => { const { Box } = $.ui.resolve(e); return Box({}); });
  on("session.usage", () => ({ value: { startedAt: 0, rateLimits: [], context: { tokens, window: 200_000, percent: Math.round(tokens / 2_000) } } }));
  on("turn.start", () => ({ turnId: "t" }));
  on("turn.complete", () => ({ text: "" }));
  on("tool.call", (_$, e: any) => { const s = "x".repeat(results[e.tool_use_id] ?? 400); return { result: { stdout: s, stderr: "" }, text: s }; });
  await $.session.start({ surface: "terminal", isInteractive: true, cwd: "/repo" } as any);
  await $.turn.complete({ reason: "answer", answer: "", durationMs: 1 } as any);
  const turns: [string, [string, any, number][], number][] = [
    ["Find why the auth tests fail", [["a", { tool: "Grep", pattern: "verifyToken" }, 3_200], ["b", { tool: "Read", file_path: "/repo/src/auth/session.ts" }, 38_000], ["c", { tool: "Bash", command: "npm test -- auth" }, 21_000]], 43_000],
    ["Check the CI log too", [["d", { tool: "WebFetch", url: "https://github.com/acme/api/actions/runs/1" }, 96_000], ["e", { tool: "Read", file_path: "/repo/logs/ci-full.log" }, 190_000]], 128_000],
  ];
  const frame = async (prompt: string) => {
    const ui = await $.ui.mount({ plugin: "context-receipt", surface: "terminal", component: "AbovePrompt", props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 96 } } as any);
    const band: any = await ui.find({ key: "context-receipt" });
    console.log("FRAME\t" + prompt + "\t" + JSON.stringify(band?.children?.map((c: any) => ({ t: c.children.join(""), color: c.props.color ?? null, dim: !!c.props.dimColor, bold: !!c.props.bold })) ?? []));
    await ui.unmount();
  };
  for (const [prompt, calls, add] of turns) {
    await $.turn.start({ turnId: prompt } as any);
    for (const [id, e, size] of calls) { results[id] = size; await $.tool.call({ ...e, tool_use_id: id } as any); }
    tokens += add;
    await $.turn.complete({ reason: "answer", answer: "", durationMs: 1 } as any);
    await frame(prompt);
  }
  console.log("RECEIPT\t" + JSON.stringify((await $.command.run({ command: "receipt", args: "" } as any)).text));
});
