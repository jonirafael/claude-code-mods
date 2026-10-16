# Drafts (not posted anywhere)

Replace `GITHUB_USER` with the real GitHub account before using any of these. Nothing here has been sent.

---

## 1. Pull request to karanb192/awesome-claude-code-mods

Per `contributing.md`, a catalogue submission is one line in `data/seeds.txt` (alphabetical, case-insensitive; do not append at the end, do not edit README). Run `npm test` and `npm run lint` before opening. Alternatively, adding the GitHub topic `claude-code-mod` to the repo lets the 3-hourly scan pick it up with no PR at all.

**Title:** Add GITHUB_USER/claude-code-mods to seeds

**Body:**

> Adds `GITHUB_USER/claude-code-mods` to `data/seeds.txt`.
>
> The repo is a marketplace with two mods:
>
> - **context-receipt** – a band above the prompt that itemises what each turn added to the context window by tool result (`ctx 61% +40k last turn · Read big.log ≈14k · Bash npm test ≈2k`), plus `/receipt`. Observe-only: never changes a tool call.
> - **context-brake** – when context crosses a threshold (default 80%), adds one note beside the next prompt asking Claude to stop at a clean boundary with a handoff; re-arms after /compact. `/brake` to configure.
>
> Neither reads files, runs processes, reaches the network or calls a model. Both pass `claude plugin validate` on 2.1.301 and ship tests for `claude plugin test` (12 passing).
>
> I checked the catalogue for overlap: there are many context meters/forecasts; I did not find one that attributes per-turn growth to individual tool results, or one that tells the model once at a context threshold (without a model call or `/clear`). Happy to adjust if a duplicate exists.
>
> `npm test` and `npm run lint` pass locally.

---

## 2. Comment for anthropics/claude-code#90708

> Not a fix for the desktop footer itself, but a stopgap for people who want an at-a-glance signal now: I published two small mods at https://github.com/GITHUB_USER/claude-code-mods.
>
> - **context-receipt** shows context % above the prompt (terminal and desktop) *and* which tool results grew it last turn, e.g. `ctx 61% +40k last turn · Read big.log ≈14k`.
> - **context-brake** addresses the "compaction with no lead-up" part (#91232, #91385): at a threshold you choose it gives Claude a one-time note to finish at a clean boundary and leave a handoff.
>
> Both are observe-only apart from that one note, with no file, network or process access. Other context meters already linked in this thread work well too; these focus on attribution and on warning the model. A first-party setting for what the ring shows would still be the right fix.

## 3. Comment for anthropics/claude-code#91870 (optional, only if on topic)

> Small data point from building on the shipped API: two things worked very well. `prompt.submit` forwarding `{ ...e, context: [...e.context, note] }` gives a clean "tell the model once, don't edit the user's text" primitive, and `claude plugin test` against the real runtime made the adapter tests straightforward. One thing I'd like documented: `$.store.get` resolves to the raw value while `$.state.get` resolves to `{ value }`. That cost me a failing test. Example mods: https://github.com/GITHUB_USER/claude-code-mods

---

## 4. Reddit (r/ClaudeAI or r/ClaudeCode)

**Title:** I made two Claude Code mods: a per-turn "context receipt" and a one-time "context brake" before auto-compact

**Body:**

> Since the desktop context ring started showing plan limits instead (#90708), I kept getting surprised by compaction. Two small mods, MIT:
>
> **context-receipt**: one line above the prompt after each turn: `ctx 61% +40k last turn · Read big.log ≈14k · Bash npm test ≈2k`. So you see *what* ate the context, not just how much. `/receipt` shows the session's biggest tool results.
>
> **context-brake**: at a threshold (default 80%), Claude gets one note with your next prompt: finish the current step, stop at a clean boundary, write a handoff. Then you `/compact` when it suits you. Re-arms after compaction.
>
> No network, no file access, no extra model calls. Works in terminal and desktop (Claude Code 2.1.287+).
>
> ```
> /plugin marketplace add GITHUB_USER/claude-code-mods
> /plugin install context-receipt@claude-code-mods
> ```
>
> Repo + GIF: https://github.com/GITHUB_USER/claude-code-mods. Feedback welcome, especially from desktop users.

## 5. Show HN

**Title:** Show HN: Context receipt and context brake – two Claude Code mods

**URL:** https://github.com/GITHUB_USER/claude-code-mods

**Text:**

> Claude Code shipped "mods" (in-process TypeScript/JS function hooks) on Oct 1. I wrote two small ones for long sessions:
>
> context-receipt itemises each turn's context growth by tool result, so "61%, +40k" becomes "the 40k was one Read of a log file". The per-result numbers are estimates (≈4 chars/token); the turn total comes from the session's own usage figures.
>
> context-brake watches context fill and, once per fill past a threshold, attaches a short note to the next prompt so the model wraps up at a clean boundary before auto-compaction lands mid-task.
>
> Both are plain ES modules with no dependencies and no file/network/process access, with tests that run against the real runtime via `claude plugin test`. Not affiliated with Anthropic.
