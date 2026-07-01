# MUTTCLIFFE — Weekly App-Export Appendix (v2)

**Paste this into each team's Project** (Project settings → custom instructions, or append it to `CFL_Injury_Report_Review_Guideline_v2.md`). It doesn't change the analysis — it adds a machine-readable tail so every write-up drops straight into the depth-chart app's Google Sheet.

> **What changed from v1:** the export is now **one combined block** (each row prefixed with its tab name) that you paste into a single **Inbox** tab and fan out with one menu click — instead of four separate blocks pasted into four tabs. The `chg` column is now **optional**: the app derives in/out/moved automatically by diffing week N against N‑1. See `MUTTCLIFFE_App_Runbook.md` for the one-time setup.

---

## What to do

At the **end of every write-up** (opening dump *and* each weekly update), after the normal MUTTCLIFFE output, add a section titled **`=== APP EXPORT — Week N (paste into Inbox) ===`** containing **one fenced code block** of **tab-separated rows**. **Every row begins with its destination tab name** — `Teams`, `Units`, `Players`, or `Callouts` — followed by that tab's columns in the exact order below.

The app always renders the **latest week per team**, so each export is a **complete snapshot of that team at Week N** — not just the changed rows. "Only what changed" lives in the analysis (and is derived automatically for the chip highlights), not in which rows you emit. Weeks accumulate, powering the week selector and the automatic IN/OUT/MOVED diffing.

**Order within the block:** one `Teams` row, then the ten `Units` rows, then any `Players` rows, then the `Callouts` rows. Order isn't required by the importer (it routes by the leading tab name and upserts by team+week), but keeping it consistent makes the block easy to eyeball.

**Quiet weeks — two easy paths:**
- *Menu path (no chat needed):* run **MUTTCLIFFE ▸ Bump all teams +1 week**, then edit only the cells that moved (usually a verdict line and a callout). 
- *Chat path:* emit the block as usual. If the roster is unchanged, you can still omit the `Players` rows and just re-state `Teams` + `Units`; the app carries the prior week's roster forward for the diff. Always re-emit **Teams** (verdict/ratio/headline move weekly) and **Units** (tiers can shift).

---

## Column order (must match exactly — each row is prefixed with the tab name)

**Teams** — 1 row · `Teams` + 26 fields:
```
Teams  team  week  name  accent  ink  opp  oppFull  date  venue  homeAway  record  verdict_dir  verdict_mag  verdict_conf  verdict_persist  verdict_mvar  verdict_ratio  ratio_nat  ratio_floor  ratio_max  ratio_cushion  ratio_fragility  ratio_delta  traj  traj_note  headline
```

**Units** — 10 rows · `Units` + 10 fields (keys: `rec iol ot bak qb edge idl lb sec st`):
```
Units  team  week  key  label  side  tier  conf  depth  flag  note
```
`side` ∈ offense|defense|st · `tier` ∈ Elite|Above-avg|Starter|Fringe|Insufficient · `depth` ∈ full|thinned|critical

**Players** — one row per player at a slot (**only for teams carrying a full roster**; omit for unit-level teams) · `Players` + 32 fields:
```
Players  team  week  side  slot  depth  num  name  full  pos  nat  flags  status  chg  lev  drop  conf  persist  mvar  ratio  note  health_since  health_reason  health_list  health_return  health_ramp  col  ht  wt  age  cfl  pff  pffSnaps
```
- `side` ∈ offense|defense|st|il (use `il` + blank `slot` for deep IR not dressed) · `slot` from the **Slots** tab (`WR_B, LT, C, QB, DE_B, HB_F …`) · `depth` 1 = declared starter, then 2,3… · `nat` ∈ N|A|G · `flags` csv (`DA,GTD,QB1`) · `status` ∈ active|1gIL|6gIL|reserve|practice|suspended · `health_ramp` TRUE|FALSE.
- **`chg` is optional — leave it blank.** The app derives `in` / `out` / `moved` by diffing this week's roster against last week's, matched on **jersey + slot** (so a WR who also returns kicks is handled correctly). Fill `chg` in **only to override** the derivation in an unusual case; a value you type always wins.
- To show an injured starter behind their fill-in: fill-in `depth=1 status=active`, starter `depth=2 status=1gIL` + a `health_*` block. The red dot appears automatically, and the diff marks the starter `out` on its own.

**Callouts** — the TL;DR lists · `Callouts` + 8 fields:
```
Callouts  team  week  kind  order  label  meta  sev  note
```
`kind=drag` → what's dragging the rating (`label`=position, `meta` blank, `sev` ∈ notable|minor). `kind=watch` → returns/watch items (`label`=player, `meta`=position, `sev` blank).

---

## Rules baked in (keep them consistent with Guideline v2)

- **Snapshot, not diff.** Emit the whole team at Week N so that week is self-contained. Blank cells stay blank (don't type `—` unless you want it displayed).
- **Standing discounts persist.** A player out since Week 1 stays in every week's snapshot with the same `health_*` block — you're re-stating, not re-flagging. (The `out` chip fires the week they first drop, not every week after — that's the diff working as intended.)
- **Never silently delete a player.** The diff only sees players who have a row this week — a row that simply vanishes (release, practice-roster demotion) fires no chip at all. Carry the player **one more week** with the new status (`reserve` or `practice`) so the `out` fires visibly; drop the row the following week.
- **Let `chg` derive itself.** Only set it by hand to correct a case the jersey+slot diff can't see.
- **Unit tiers come from the PFF workbook** where available; otherwise your calibrated read. Confidence tags mirror the write-up.
- **Nationality is authoritative from the chart** (§16). Carry the marker into `nat`.
- **Numbers can be entered as-is** (the app coerces them); leave unknowns blank rather than guessing.
- **Re-pasting is safe.** Fixed a typo? Re-emit that team's block and Process inbox again — the importer replaces the old (team, week) rows in place. No duplicates, no manual deletes.

---

## Worked example — a unit-level team, Week 5 (Winnipeg)

*(No `Players` rows: Winnipeg is carried at unit level. A full-roster team would add `Players` rows, one per player.)*

```
=== APP EXPORT — Week 5 (paste into Inbox) ===
Teams	WPG	5	Winnipeg Blue Bombers	#12395b	#ffffff	@ SSK	Saskatchewan Roughriders	Fri Jul 3, 2026	Mosaic Stadium	Away	3–1	▬	Negligible	High	ongoing	Low	~12 — non-constraint	12	7	14	elite	none	flat	stable	Offence and secondary unchanged again; all churn is deep front-seven rotation.	Still the calmest roster in the league — elite National core and a ratio non-issue; the only soft spot remains the edge opposite Jefferson.
Units	WPG	5	rec	Receivers	offense	Above-avg	High	full	Schoen (All-CFL) leads	Dalton Schoen and Ontaria Wilson headline a stable corps.
Units	WPG	5	iol	Interior OL	offense	Above-avg	High	full	deep National	Settled, deep, National-heavy interior.
Units	WPG	5	ot	Tackles	offense	Above-avg	Med	full		Steady protection.
Units	WPG	5	bak	Backfield	offense	Above-avg	High	full	Oliveira — star National RB	Brady Oliveira anchors a premium spot.
Units	WPG	5	qb	Quarterback	offense	Above-avg	High	full	Collaros QB1	Zach Collaros; Dru Brown insurance behind him.
Units	WPG	5	edge	Edge	defense	Above-avg	Med	thinned	Jefferson elite; opposite edge unsettled	Jefferson locks one edge; opposite side is the real soft spot.
Units	WPG	5	idl	Interior DL	defense	Starter	Med	full		Deep rotation absorbs weekly churn.
Units	WPG	5	lb	Linebackers	defense	Above-avg	Med	full	deep room; Santos-Knox out	Loaded room; Santos-Knox on 6-game IL.
Units	WPG	5	sec	Secondary	defense	Above-avg	High	full	Holm (2025 MOD) anchors	Reigning MOD anchors an unchanged back end.
Units	WPG	5	st	Specialists	st	Above-avg	High	full		Reliable, well-drilled units.
Callouts	WPG	5	drag	1	Boundary edge		notable	The DE opposite Jefferson is unsettled/replacement-level — a structural, not injury, weakness.
Callouts	WPG	5	drag	2	DB depth		minor	Cam Allen on the 6-game IL since Week 1.
Callouts	WPG	5	watch	1	Opposite edge	DE		whether anyone claims the spot next to Jefferson.
Callouts	WPG	5	watch	2	Santos-Knox	LB		6-game IL — deep room covers.
```

Paste the whole block into the **Inbox** tab, then **MUTTCLIFFE ▸ Process inbox**. The app shows Week 5 on next load.
