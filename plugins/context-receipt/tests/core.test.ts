import { describe, expect, test } from "claude-code/testing";
import { answerText, bandParts, estimateTokens, labelFor, mergeTop, rank, report, short } from "../hooks/core.mjs";

describe("core", () => {
  test("estimates ≈4 chars per token", async () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("x".repeat(4001))).toBe(1001);
  });
  test("reads the text of different answer shapes", async () => {
    expect(answerText({ text: "hi" })).toBe("hi");
    expect(answerText({ deny: "no" })).toBe("no");
    expect(answerText({ result: { stdout: "o" } })).toBe('{"stdout":"o"}');
    expect(answerText(undefined)).toBe("");
  });
  test("labels common tools", async () => {
    expect(labelFor({ tool: "Read", file_path: "/a/b/big.log" })).toBe("Read big.log");
    expect(labelFor({ tool: "Bash", command: "npm   test -- --watch=false --reporter=verbose" })).toBe("Bash npm test -- --watch=false -…");
    expect(labelFor({ tool: "WebFetch", url: "https://docs.example.com/x" })).toBe("WebFetch docs.example.com");
    expect(labelFor({ tool: "mcp__github__get_file" })).toBe("github:get_file");
    expect(labelFor({ tool: "Weird" })).toBe("Weird");
  });
  test("ranks, merges and formats", async () => {
    const r = rank([{ tool: "Read", label: "Read a", tokens: 10 }, { tool: "Bash", label: "Bash b", tokens: 30 }, { tool: "Read", label: "Read a", tokens: 25 }]);
    expect(r.map((x) => [x.label, x.tokens])).toEqual([["Read a", 35], ["Bash b", 30]]);
    expect(mergeTop([{ tool: "x", label: "x", tokens: 5 }], [{ tool: "y", label: "y", tokens: 9 }], 1)[0].label).toBe("y");
    expect(short(98_300)).toBe("98.3k");
    expect(short(1_200_000)).toBe("1.2M");
  });
  test("band fits the width and reports what it dropped", async () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ tool: "Read", label: `Read file-${i}.ts`, tokens: 1000 * (i + 1) }));
    const p = bandParts({ turn: 1, delta: 40_000, tokens: 120_000, window: 200_000, percent: 60, items }, 80)!;
    expect(p.head).toBe("ctx 60% +40k last turn");
    expect(p.level).toBe("warm");
    expect(p.items[0]).toBe("Read file-7.ts ≈8k");
    expect(p.items.join(" · ").length + p.head.length).toBeLessThanOrEqual(80);
    expect(p.more).toBe(8 - p.items.length);
    expect(bandParts(null)).toBeNull();
  });
  test("report explains a turn with no tool output", async () => {
    const text = report({ turn: 1, delta: 300, tokens: 1000, window: 200_000, percent: 1, items: [] }, []);
    expect(text).toContain("no tool results");
    expect(report(null, [])).toContain("no completed turn");
  });
});
