import { describe, expect, test } from "claude-code/testing";
import { note, parseThreshold, step } from "../hooks/core.mjs";

describe("core", () => {
  test("arms once per fill and re-arms after compaction", async () => {
    let s = step({ armed: false, fired: false }, 50, 80);
    expect(s).toEqual({ armed: false, fired: false });
    s = step(s, 81, 80);
    expect(s).toEqual({ armed: true, fired: false });
    s = { armed: false, fired: true }; // note was sent
    expect(step(s, 90, 80)).toEqual({ armed: false, fired: true });
    expect(step(s, 70, 80)).toEqual({ armed: false, fired: true }); // inside the gap: stays quiet
    expect(step(s, 30, 80)).toEqual({ armed: false, fired: false }); // after /compact
    expect(step(s, 99, null)).toEqual({ armed: false, fired: true }); // off
  });
  test("parses /brake arguments", async () => {
    expect(parseThreshold("75")).toEqual({ threshold: 75 });
    expect(parseThreshold("70%")).toEqual({ threshold: 70 });
    expect(parseThreshold("off")).toEqual({ off: true });
    expect(parseThreshold("5")).toBeNull();
    expect(parseThreshold("abc")).toBeNull();
  });
});

describe("context-brake (real runtime)", () => {
  test("sends exactly one note with the next prompt after crossing the threshold", async ($, on) => {
    let percent = 40;
    const store = new Map<string, unknown>();
    const seen: any[] = [];
    const toasts: string[] = [];
    on("session.start", ($, e) => ({ cwd: e.cwd }));
    on("command.register", (_$, e) => ({ value: { command: e.name } }));
    on("store.get", (_$, e) => ({ value: store.get(e.key) }));
    on("store.set", (_$, e) => { store.set(e.key, e.value); return { value: undefined }; });
    on("ui.toast", (_$, e) => { toasts.push(e.text); return { value: undefined }; });
    on("session.usage", () => ({ value: { startedAt: 0, rateLimits: [], context: { tokens: percent * 2000, window: 200_000, percent } } }));
    on("turn.complete", () => ({ text: "" }));
    on("prompt.submit", (_$, e) => { seen.push(e); return { text: e.text }; });

    await $.session.start({ surface: "terminal", isInteractive: true, cwd: "/w" } as any);
    await $.prompt.submit({ text: "first" } as any);
    expect(seen[0].context).toBeUndefined();

    percent = 83;
    await $.turn.complete({ reason: "answer", answer: "ok", durationMs: 1 } as any);
    expect(toasts.length).toBe(1);
    expect((await $.command.run({ command: "brake", args: "" } as any)).text).toContain("armed");

    await $.prompt.submit({ text: "second" } as any);
    expect(seen[1].text).toBe("second"); // user text untouched
    expect(String(seen[1].context)).toContain("83% full");

    percent = 88;
    await $.turn.complete({ reason: "answer", answer: "ok", durationMs: 1 } as any);
    await $.prompt.submit({ text: "third" } as any);
    expect(seen[2].context).toBeUndefined(); // only once per fill

    percent = 20; // after /compact
    await $.turn.complete({ reason: "answer", answer: "ok", durationMs: 1 } as any);
    percent = 85;
    await $.turn.complete({ reason: "answer", answer: "ok", durationMs: 1 } as any);
    await $.prompt.submit({ text: "fourth" } as any);
    expect(String(seen[3].context)).toContain("85% full");
  });

  test("/brake changes and disables the threshold", async ($, on) => {
    let percent = 72;
    const store = new Map<string, unknown>();
    const seen: any[] = [];
    on("session.start", ($, e) => ({ cwd: e.cwd }));
    on("command.register", (_$, e) => ({ value: { command: e.name } }));
    on("store.get", (_$, e) => ({ value: store.get(e.key) }));
    on("store.set", (_$, e) => { store.set(e.key, e.value); return { value: undefined }; });
    on("ui.toast", () => ({ value: undefined }));
    on("session.usage", () => ({ value: { startedAt: 0, rateLimits: [], context: { tokens: percent * 2000, window: 200_000, percent } } }));
    on("turn.complete", () => ({ text: "" }));
    on("prompt.submit", (_$, e) => { seen.push(e); return { text: e.text }; });
    await $.session.start({ surface: "desktop", isInteractive: true, cwd: "/w" } as any);
    expect((await $.command.run({ command: "brake", args: "70" } as any)).text).toContain("70%");
    await $.prompt.submit({ text: "a" } as any);
    expect(String(seen[0].context)).toContain("72% full");
    expect((await $.command.run({ command: "brake", args: "off" } as any)).text).toContain("off");
    percent = 95;
    await $.turn.complete({ reason: "answer", answer: "ok", durationMs: 1 } as any);
    await $.prompt.submit({ text: "b" } as any);
    expect(seen[1].context).toBeUndefined();
    expect((await $.command.run({ command: "brake", args: "nope" } as any)).text).toContain("Usage");
  });
});
