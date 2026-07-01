# MUTTCLIFFE — CFL Depth Chart Analysis

Live depth-chart, unit-tier, and matchup app for all nine CFL teams (2026 season), part of the @muttcliffe betting-transparency operation.

**How it works:** `index.html` is the entire app — a single self-contained file, no build step. It reads live from a public Google Sheet (gviz endpoint) and renders the latest week per team: field diagram with player chips, unit tiers, ratio meter, verdicts, and week-over-week in/out/moved derived automatically from the stored weekly snapshots.

**Structure**
- `index.html` — the app (deployed on Vercel; static, framework-free)
- `docs/` — operations runbook, weekly export format, architecture & optimization notes, sheet schema
- `tools/` — bound Apps Script for the Sheet (inbox fan-out, validator, week-bump) and the workbook builder
- `data/` — baseline snapshot (four CSV tabs + the xlsx that seeded the live Sheet)

**Weekly loop:** each team's Claude Project emits one combined export block → pasted into the Sheet's Inbox tab → `MUTTCLIFFE ▸ Process inbox` fans it out → the app reflects the new week on reload. Full ops: `docs/MUTTCLIFFE_App_Runbook.md`.
