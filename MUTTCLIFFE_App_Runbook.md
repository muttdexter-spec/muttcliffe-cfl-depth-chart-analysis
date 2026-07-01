# MUTTCLIFFE Depth Chart — Operations Runbook (v2)

Everything needed to run the hosted depth chart as a living, Sheet-driven app. After the one-time setup, a weekly update is **paste-once → click Process inbox → reload** — no code, no redeploys, no chasing rows across four tabs.

The pieces:

| File | Role |
|---|---|
| `muttcliffe_depthchart.html` | The app. Reads its data live from your Google Sheet. Derives weekly in/out/moved automatically. |
| `MUTTCLIFFE_DepthChart_Data.xlsx` | The baseline workbook — becomes your Google Sheet. Data for all 9 teams, plus an `Inbox` tab. |
| `MUTTCLIFFE_Sheet_Tools.gs` | Bound Apps Script. Adds the **MUTTCLIFFE** menu: Process inbox, Validate, Bump week, Set up tabs. |
| `muttcliffe_sheet/*.csv` | The same four data tabs as CSVs (alternative import / version control). |
| `MUTTCLIFFE_Weekly_Export_Appendix.md` | Standing directive for each team Project — makes write-ups emit one paste-ready block. |

> **What changed from v1.** Weekly updates now go through a single **Inbox** tab and a one-click fan-out, instead of pasting four blocks into four tabs. Re-pasting a corrected week **replaces** its rows automatically (no duplicates). The app now **derives the in/out/moved chips itself** from week-over-week history, so the `chg` column is optional. A built-in **validator** catches bad slots/enums/orphans before they reach the app.

---

## 1. One-time setup (~12 minutes)

### a. Stand up the Sheet
**Fastest path:** upload `MUTTCLIFFE_DepthChart_Data.xlsx` to Google Drive → right-click → **Open with ▸ Google Sheets**. That creates a native Google Sheet with the tabs (`Teams, Units, Players, Callouts` + `_READ ME`, `Slots`, `Inbox`) already populated.

*Alternative (CSV import):* create a blank Google Sheet, make four tabs named exactly `Players`, `Teams`, `Units`, `Callouts`, then for each: **File ▸ Import ▸ Upload** the matching CSV → **Replace current sheet**. (The `Inbox` tab is then created for you in step **e**.)

> The tab names `Players / Teams / Units / Callouts` must be exact — the app fetches them by name.

### b. Share it (required)
The app fetches from the browser with no login, so the Sheet must be world-readable:
**File ▸ Share ▸ General access ▸ "Anyone with the link" = Viewer.**
Without this, the app silently falls back to built-in data.

### c. Wire the app
Copy the Sheet **ID** from its URL — the long string between `/d/` and `/edit`:
`https://docs.google.com/spreadsheets/d/`**`1AbC…xyz`**`/edit`

Open `muttcliffe_depthchart.html` and set the two lines near the top of the script:
```js
const DATA_SOURCE = 'sheet';        // was 'embedded'
const SHEET_ID    = '1AbC…xyz';     // your Sheet ID
```

### d. Verify the app
Open the app (hard-refresh: **Cmd/Ctrl+Shift+R**). The pill under the title should read **"google sheet · 8 teams."** Ottawa shows player chips; the other seven show unit tiles; BC is a stub until you add it. If it reads *"sheet unavailable"* or *"built-in,"* see Troubleshooting.

### e. Install the Sheet tools (Apps Script)
This adds the one-click weekly workflow. On an **existing** Sheet it never touches your data.
1. In the Sheet: **Extensions ▸ Apps Script.**
2. Delete the placeholder, paste the entire contents of `MUTTCLIFFE_Sheet_Tools.gs`, **Save**.
3. Reload the Sheet. A **MUTTCLIFFE** menu appears (approve the one-time authorization prompt the first time you run an item).
4. **MUTTCLIFFE ▸ Set up tabs (Inbox + checks)** — creates/refreshes the `Inbox` tab and a live `_check` tab, and sets **plain-text formatting** on the Inbox and all four data tabs so Sheets can never auto-convert pasted values (heights like `5-10` becoming dates is the classic). (If you used the xlsx path, `Inbox` already exists; this adds `_check` and the format protection.) **If you update the script later, re-run this once** — it's safe on a live sheet and never touches data.

You're done. The `_check` tab now shows live validation at all times; `Inbox` is where weekly blocks land.

---

## 2. The weekly loop

Per team, once its depth chart posts (~24 h pre-game):

1. **Attach** the chart PDF to that team's Claude Project chat.
2. The chat produces the normal MUTTCLIFFE write-up **and**, because of the appendix, one **`=== APP EXPORT — Week N (paste into Inbox) ===`** block — tab-separated rows, each prefixed with its destination tab name.
3. **Paste** that block into the **Inbox** tab (anywhere under the header). You can paste several teams' blocks before running.
4. **MUTTCLIFFE ▸ Process inbox** — each row fans out to the right tab, keyed by team+week, and the Inbox clears. *(Re-pasting a corrected block for the same team+week replaces the old rows — safe to redo.)*
5. *(Optional but recommended)* **MUTTCLIFFE ▸ Validate data** — check the `_log` tab for any errors before you rely on the numbers.
6. **Reload** the app. It shows Week N automatically and lights up the in/out/moved chips from the diff against Week N‑1.

**Quiet weeks — the fast path.** If little moved league-wide, skip the chats entirely: **MUTTCLIFFE ▸ Bump all teams +1 week** copies each team's latest rows forward, then you edit only the cells that changed (usually a verdict line and a callout). The diff still highlights whatever you touched.

**Two fidelity tracks, one pipeline:**
- *Unit-level* (7 teams today): a tiny weekly block — 1 Teams row + 10 Units rows + a few Callouts. Keeps the matchup and TL;DRs current.
- *Player-level* (Ottawa today): the above **plus** a Players snapshot, which lights up the chips, hover cards, and the automatic diff. Promote a team only where roster detail actually swings a pick — re-attach its chart PDFs in that chat once and have it emit a full Players block (the history tools can't recover jersey-numbered rosters — the PDFs are needed).

---

## 3. Periodic recalibration (Guideline §14) — separate from the weekly loop

Every **4–6 games per team**, re-anchor the engine from your *own* tracked results rather than borrowed priors: update tier anchors and confidence-shrink fractions. This is an occasional pass, not part of the weekly paste:

- Do the re-anchoring in the engine / PFF workbook, then re-emit each affected team's **Units** rows (and any changed `verdict_conf`) for the current week — one combined block through the Inbox as usual.
- For an audit trail, add a `Recalibration` tab to the Sheet (the app ignores unknown tabs) noting date, sample size, and what moved.

---

## 4. Editing directly in the Sheet

Everything is one-row-per-record plain text, so hand-edits are safe — and the `_check` tab flags mistakes live:
- **Fix a record or opponent** (e.g., Hamilton's Week-N opponent, or a team's `record`): edit the single cell. Records and Hamilton's opponent are best-estimate through ~Week 4 and are meant to be corrected here.
- **Change a unit tier:** edit `tier` in the Units tab.
- **Bench/injure a player:** in Players, set the fill-in to `depth=1 status=active` and the starter to `depth=2 status=1gIL` with a `health_*` block — the red dot renders automatically and the starter is marked `out` by the diff.
- **Add BC:** add its Teams + Units rows (and Players if you have the roster). The switcher lights up on reload.
- Leave unknown cells **blank** (don't type `—` unless you want it shown). The app coerces numbers, so numeric cells can be plain text.

---

## 5. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Pill says *"sheet unavailable · built-in"* | Sheet isn't shared. Set **Anyone with the link = Viewer**. Also confirm `SHEET_ID` is correct and `DATA_SOURCE='sheet'`. |
| Pill says *"google sheet (empty)"* | Tabs are named wrong or empty. They must be exactly `Players / Teams / Units / Callouts` with the header row intact. |
| No **MUTTCLIFFE** menu | The Apps Script isn't installed or the Sheet wasn't reloaded. Redo step 1e; approve the authorization prompt. |
| Process inbox skipped rows | A row's first cell wasn't a valid tab name (`Teams/Units/Players/Callouts`). The alert lists which rows; fix the prefix and rerun. |
| A team is missing | It has no row in the **Teams** tab for any week. Every rendered team needs at least a Teams row (+ Units rows). |
| A team shows tiles, not chips | It has no **Players** rows — that's the unit-level track. Add Players rows to promote it. |
| A chip shows the wrong in/out/moved | The diff matches on jersey + slot vs last week. Either an explicit `chg` value is overriding it, or the prior week's row for that jersey/slot differs from what you expect. Clear the `chg` cell to let it derive, or check last week's row. |
| A height like `5-10` shows as a date | A cell got auto-converted to a date. Re-enter as text (prefix with an apostrophe: `'5-10`), or re-import from the CSV. The uploaded `.xlsx` already stores these as text. |
| Changes don't appear | Browser cache — hard-refresh (**Cmd/Ctrl+Shift+R**). gviz can also lag a few seconds after an edit. |
| Wrong week showing | The app takes the **max** `week` per team. Check for a stray higher week number in any tab (the validator's orphan check helps spot these). |

---

## 6. Current state & known limitations

- **All 9 teams** are in the Sheet. **Ottawa** is player-level (full roster + IR tray); the other **seven non-BC teams are unit-level**; **BC** is a stub (add when ready).
- **Automatic in/out/moved chips are live** once a team has **≥2 weeks** of history — the app diffs jersey + slot against the prior week; the `chg` column is only for manual overrides.
- **Records and Hamilton's opponent** are best-estimate through ~Week 4 — single-cell fixes in the Sheet.
- Promoting any team to player-level needs its **chart PDFs re-attached** in that team's chat once (rosters/jersey numbers can't be reconstructed from prior-chat text).
- The **week selector** (browsing past weeks in the UI) remains the next UI addition; the weekly-snapshot history already stored powers it with no schema change.
