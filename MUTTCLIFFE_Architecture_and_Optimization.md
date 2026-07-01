# MUTTCLIFFE — Process Architecture & Optimization Notes

*The operating philosophy behind the depth-chart pipeline, the reasoning for each design choice, and the sequenced roadmap. Read this once; skim §4 and §6 when deciding what to build next.*

---

## 0. The shape of the operation

Two pillars sit under the `@muttcliffe` brand: the **injury/roster framework** (Guideline v2 → weekly power-rating adjustments for all nine teams) and the **public betting dashboard** (`muttcliffecflpicks`). The **depth-chart app** is the connective tissue that turns roster analysis into something a reader can *see* — a field diagram, unit tiers, a matchup view, and week-over-week movement.

The architecture is deliberately simple:

```
  9 team chats            one Google Sheet             the hosted app
  (producers)             (shared source of truth)     (read-only consumer)
  ───────────             ────────────────────         ─────────────────
  attach PDF        →     Inbox → Teams/Units/     →    reads live via gviz,
  emit 1 block            Players/Callouts              renders latest week,
                          (+ Slots, _check, _log)       derives in/out/moved
```

Everything downstream of the analysis is plumbing, and plumbing should be **boring, idempotent, and self-checking**. That is the whole design brief.

---

## 1. Where the time and error actually go

Three cost centers, and they reward different fixes:

| Cost center | What it costs | What attacks it |
|---|---|---|
| **Transcription** (getting analysis into the Sheet) | tedium; wrong-tab / overwrite / wrong-week errors | Inbox + one-click fan-out with idempotent upsert; derived `chg`; validator |
| **Per-chat analysis** (the visual read + write-up) | tokens; wall-clock | diff-first prompting; carry static descriptors forward; fidelity tracks |
| **Calibration** (making outputs defensible) | the thing the brand is actually selling | PFF→tier overlay (generated not typed); mechanical §14 recalibration |

The recent build spent itself on the first row (highest tedium-to-value ratio) and set up the second. The third — calibration — is the biggest remaining *quality* lever and is the headline of the roadmap.

---

## 2. The optimized weekly loop (target state)

**Producer side (each team chat).** Attach the depth-chart PDF. The chat emits the normal MUTTCLIFFE write-up plus **one combined export block** — tab-separated rows, each prefixed with its destination tab. Static descriptors (bio, PFF, college) are carried forward; only moved players and the refreshed verdict/units need fresh derivation.

**Store side (the Sheet).** Paste the block(s) into **Inbox**; run **Process inbox**. Rows fan out by tab and **upsert by (team, week)** — re-pasting a corrected week replaces its rows in place, never duplicates. Run **Validate** to catch structural errors before they're trusted. The `_check` tab is a live backstop for hand-edits.

**Consumer side (the app).** On reload it renders the **latest week per team** and **derives the in/out/moved chips** by diffing this week's roster against last week's, matched on **jersey + slot**.

**Quiet-week shortcut.** When little moved league-wide, skip the chats: **Bump all teams +1 week** clones each team's latest rows forward; edit only what changed.

Net effect: a full-league update goes from *up to ~30 targeted pastes across four tabs* to *paste-once, click once, reload* — with the most common error classes (wrong tab, double-paste, stale week) structurally eliminated rather than watched for.

---

## 3. Design decisions & why

**Sheet as the single source of truth — not API writes.** The Sheet is human-readable, hand-editable, diffable, and shareable as public proof. Every consumer (the app today; a dashboard or notebook tomorrow) reads the same rows. The alternative — chats writing the Sheet directly via API — is rejected on purpose (see §5).

**Inbox + idempotent fan-out.** One paste target removes the "which tab?" decision and its errors. Upserting by (team, week) makes the operation **safe to repeat**: fix a typo, re-paste, re-run — the state converges. Idempotency is what lets you move fast without fear of corrupting history.

**Derive `chg`, don't type it.** In/out/moved is *implied* by consecutive weekly snapshots, so typing it is redundant data-entry and a fresh inconsistency source. The app computes it. Two subtleties made it robust: (1) matching on **jersey + slot**, not jersey alone, so a dual-role player (a WR who also returns kicks — same number, two slots) is handled per instance and never spuriously flagged "moved"; (2) **explicit always wins** — a value you type overrides the derivation for the rare case the diff can't see. The derivation is a strict no-op with one week of data, so nothing is disturbed until history exists.

**Store full weekly snapshots (snapshot, not diff).** Each week is a complete, self-contained picture of the team. This is what powers the automatic diff, a future week-selector, and any later recalibration from tracked history — all with no schema change. Standing absences are re-stated each week (same `health_*` block), not re-flagged; the `out` chip fires only on the week a player first drops, which is the diff doing its job.

**Validation as a gate, not an afterthought.** For a public operation the dangerous failure is a *silent* paste error. The validator enforces the invariants that make a week trustworthy: known slots, valid enums (tier/status/nat), every Units/Players/Callouts row backed by a Teams row, exactly ten units at each team's latest week, no two declared starters at one slot, and a ratio-floor sanity check (≥7 National starters where the roster is player-level). Errors surface on `_log`; the live `_check` tab catches hand-edits between runs.

**Two fidelity tracks, one pipeline.** Unit-level (tiles) is nearly free and keeps the matchup and TL;DRs current; player-level (chips, hover cards, the diff) costs real weekly effort. The rule mirrors the framework's own logic: **spend fidelity only where roster detail actually swings a pick.** Keep stable or rarely-bet teams at unit level; promote a team when an injury there becomes decision-relevant. (Promotion needs the chart PDFs re-attached once — jersey-numbered rosters can't be reconstructed from prior-chat text.)

**Render-equivalence is the correctness bar — not byte-identity.** The embedded reference data is internally inconsistent (some fields `null`, some `""`, some absent), so a byte-perfect round-trip from the Sheet is impossible *and pointless*: `null`, `""`, and absent all render identically. The verification normalizes those three to "no value" and confirms the Sheet path reproduces the embedded app **exactly as rendered** across all eight loaded teams. Chasing byte-identity would have meant encoding meaningless distinctions; render-equivalence is the honest invariant.

---

## 4. The sequenced roadmap (in priority order)

**① PFF workbook → Units tier overlay — the biggest quality lever.** *Status: next.* Overlay each team's depth chart onto the validated PFF prior-ratings workbook (the 864-row, role-weighted, Bayesian-shrunk build) so each team's ten `tier`/`conf` values fall out of a **lookup** instead of an eyeballed weekly read. This compounds on both axes: outputs become more defensible (the north star), and the weekly Units block becomes mechanical. Mechanic: map unit → constituent players → role-weighted composite → tier band + confidence tag → emit Units rows. This is the single change that most moves "calibrated, not dramatic" from principle to enforced default.

**② Mechanical §14 recalibration.** *Status: designed, not built.* Turn the recalibration loop into an artifact — a small notebook/sheet that ingests the tracked prediction ledger and, every 4–6 games, emits updated tier anchors and confidence-shrink fractions from *your own* results. Today it's an ad-hoc pass; making it mechanical is where calibration compounds over the season instead of drifting. Keep it off the weekly path (occasional, isolated), re-emitting affected Units + `verdict_conf` through the Inbox like any other update.

**③ Week-selector UI.** *Status: data ready.* Let the app browse past weeks, not just the latest. The weekly-snapshot history is already stored in exactly the shape this needs; it's a front-end addition with no schema change.

**④ Contingent: dashboard caching.** *Only if it bites.* A cached-JSON build for the public dashboard earns its keep **only** if traffic or latency becomes a real problem; gviz-direct is fine at current scale. Don't pre-optimize this.

---

## 5. Explicit non-goals (and why they're off the table)

**Full API-driven automation that writes the Sheet for you.** It would remove the paste entirely — but it costs the per-team chats with **rolling memory and continuity**, which is precisely what makes the framework self-correcting and lets each team's Project accumulate context. The paste is cheap now; the continuity is not worth trading. *Deliberately not built.*

**Re-deriving static descriptors every week.** Bio, PFF, college don't change week to week. Re-emitting them for the ~90% of a roster that didn't move is wasted tokens and a needless diff surface. Carry them forward; emit only what changed.

**Fidelity everywhere.** Player-level for all nine teams every week is effort spent where it doesn't change a decision. Unit-level is the correct default; promote surgically.

**Contaminating the power rating with matchup or schedule effects.** Matchup-variance and fatigue/travel are priced *separately* at game time (per Guideline §4/§17). The base rating stays opponent-agnostic; folding those in would double-count and make the number less defensible, not more.

---

## 6. The through-line: defensible, calibrated tiebreakers

Every choice above serves one goal — outputs that function as **grounded tiebreakers, not dramatic pattern-reads from thin samples**. The pipeline enforces that discipline structurally:

- **Generated, not typed** (PFF→tier overlay) removes eyeballed drama from the most-repeated weekly judgment.
- **Validated** means a number is never trusted on a silent structural error.
- **Self-correcting from your own ledger** (mechanical §14) means the tiers acquire real point-values from tracked results over the season, not borrowed priors.
- **Confidence shrinks magnitude** (the engine's core) and **the base rating stays opponent-agnostic** — so a scary-looking loss covered by an unknown is carried as "big but low-confidence," not overstated.

The tooling exists so that judgment is spent where it's decisive and everything else is mechanical, checked, and repeatable. That is the operation's edge: not louder signals, but calibrated ones that hold up in public.
