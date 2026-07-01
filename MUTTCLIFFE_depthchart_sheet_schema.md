# MUTTCLIFFE Depth Chart — Google Sheet Schema

The single source of truth for the hosted depth chart. One workbook, four tabs, keyed so **every team and every week is a set of rows** — no per-team files, no redeploys to change data, and week-over-week diffs compute themselves.

---

## 0. How it plugs into the app

In `muttcliffe_depthchart.html`:

```js
const DATA_SOURCE = 'sheet';                          // flip from 'embedded'
const SHEET_ID    = '1AbC...your_id';
async function fetchTeamFromSheet(abbr){ ... }         // returns the same shape as TEAMS.OTT
```

`fetchTeamFromSheet(abbr)` must return an object **identical in shape** to the in-memory `TEAMS.OTT` (colors, week/opp meta, `verdict`, `ratioMeter`, `summary`, `units`, `layout`, `il`). The parser in §6 builds exactly that shape from the four tabs. Nothing in the render layer changes.

**Design principles baked in**

- **Weekly snapshots.** Every tab carries a `week` column. Store consecutive weeks and the app can (a) show any week via a selector and (b) compute `chg` (IN/OUT/moved) by diffing week *N* vs *N-1* instead of you hand-tagging it. The app fetches the latest week by default.
- **One tab per record type, not per team.** A `team` column + a gviz `tq` filter (`where team='OTT'`) is efficient and lets you bulk-edit all nine teams in one grid.
- **Placement by slot, not by hand-drawn position.** Each player row names a canonical `slot` (see §5); the parser looks up that slot's label, grid position, unit, and field coordinates. You never re-enter geometry.

---

## 1. Workbook tabs

| Tab | Grain (one row per…) | Purpose |
|---|---|---|
| **Players** | team · week · slot · depth | The roster + all scouting-card descriptors |
| **Teams** | team · week | Header meta, verdict, ratio meter, TL;DR headline/trajectory |
| **Units** | team · week · unit | Unit roll-up cards (tier / depth / flag) |
| **Callouts** | team · week · kind · order | The TL;DR "dragging the rating" and "watch & returns" lists |

Optionally keep a static **Slots** tab (a copy of §5) for reference while entering data; the parser has the slot map built in, so the sheet only needs the slot ID.

---

## 2. `Players` tab

One row per player at a position. Column names below are the header row (row 1), left to right. `→` shows the in-memory field each maps to.

| Column | → field | Type / values | Notes |
|---|---|---|---|
| `team` | — | `OTT` `TOR` … | filter key |
| `week` | — | int | snapshot key (e.g., `4`) |
| `side` | layout bucket | `offense` `defense` `st` `il` | `il` routes to the Injured-reserve tray |
| `slot` | placement | slot ID (see §5) | required unless `side=il` |
| `depth` | order | int | `1` = declared starter; ascending down the stack |
| `num` | `n` | int | jersey |
| `name` | `name` | text | short display name (single word is ideal) |
| `full` | `full` | text | optional full name |
| `pos` | `pos` | text | card display position, e.g. `WR (X)`, `HB (field)` |
| `nat` | `nat` | `N` `A` `G` | authoritative for nationality |
| `flags` | `flags` | csv | any of `DA` `GTD` `DN` `NA` `QB1` |
| `status` | `status` | `active` `1gIL` `6gIL` `reserve` `practice` `suspended` | drives dimming + badges |
| `chg` | `chg` | `in` `out` `moved` · blank | leave blank to let the app derive it from the prior week |
| `lev` | `lev` | `Very High` `High` `Medium` `Low` `Minimal` | MUTTCLIFFE leverage |
| `drop` | `drop` | `Large` `Moderate` `Small` `Negligible` · blank | drop-to-replacement |
| `conf` | `conf` | `High` `Mod–High` `Moderate` `Low` · blank | confidence |
| `persist` | `persist` | text | e.g. `≥3g (6-game IL)`, `week-to-week` |
| `mvar` | `mvar` | text · blank | matchup-variance driver |
| `ratio` | `ratio` | text · blank | ratio flag/note |
| `note` | `note` | text | card summary line |
| `health_since` | `health.since` | text · blank | blank ⇒ no health block |
| `health_reason` | `health.reason` | text · blank | e.g. `shoulder` |
| `health_list` | `health.list` | text · blank | e.g. `1-game IL` |
| `health_return` | `health.ret` | text · blank | e.g. `Wk5 (week-to-week)` |
| `health_ramp` | `health.ramp` | `TRUE` `FALSE` · blank | return-ramp flag |
| `col` | `bio.col` | text | college |
| `ht` | `bio.ht` | text | e.g. `6-2` |
| `wt` | `bio.wt` | int | |
| `age` | `bio.age` | int | |
| `cfl` | `bio.cfl` | int | CFL years |
| `pff` | `pff` | number | **2025 PFF Overall grade** (the card's PFF bar) |
| `pffSnaps` | `pffSnaps` | int · blank | 2025 snaps; drives the "small sample" flag when < 150 |

**Rules**

- A "box" = all rows sharing `team · week · side · slot`, ordered by `depth`. The `depth=1` row is the starter (bold on the chart, lead disc in field view); the rest become the backup pills / stack.
- To show an out starter at their spot (e.g. Lewis behind Victor at `WR_B`): give the fill-in `depth=1 status=active`, and the injured starter `depth=2 status=1gIL` with a `health_*` block. The red injury dot appears automatically.
- Deep IR not in the game-day lineup → `side=il`, `slot` blank. These populate the IR tray only.
- `health_*` columns are only read when `health_since` is non-blank.

---

## 3. `Teams` tab

One row per `team · week`.

| Column | → | Notes |
|---|---|---|
| `team` / `week` | keys | |
| `name` | team title | `Ottawa REDBLACKS` |
| `accent` / `ink` | `colors.accent` / `colors.ink` | hex, e.g. `#c8102e` / `#ffffff` |
| `opp` / `oppFull` | opponent | `@ MTL` / `Montréal Alouettes` |
| `date` / `venue` / `homeAway` / `record` | header meta | `Sun Jun 28, 2026` / `Percival-Molson` / `Away` / `0–3` |
| `verdict_dir` | `verdict.dir` | `▲` `▬` `▼` |
| `verdict_mag` / `verdict_conf` / `verdict_persist` / `verdict_mvar` / `verdict_ratio` | `verdict.*` | text |
| `ratio_nat` / `ratio_floor` / `ratio_max` | `ratioMeter.*` | ints (nat starters / 7 floor / scale max, e.g. `14`) |
| `ratio_cushion` / `ratio_fragility` / `ratio_delta` | `ratioMeter.*` | `elite` / `none` / `+1 vs Wk3` |
| `traj` | `summary.trajectory` | `improving` `stable` `deteriorating` |
| `traj_note` | `summary.trajectoryNote` | hover text for the trajectory chip |
| `headline` | `summary.headline` | the TL;DR sentence |

---

## 4. `Units` tab

One row per `team · week · unit`.

| Column | → | Notes |
|---|---|---|
| `team` / `week` | keys | |
| `key` | `units[].key` | `rec iol ot bak qb edge idl lb sec st` (must match §5 unit keys) |
| `label` | `units[].label` | `Interior OL` |
| `side` | `units[].side` | `offense` `defense` `st` |
| `tier` | `units[].tier` | `Elite` `Above-avg` `Starter` `Fringe` `Insufficient` ← **PFF workbook feeds this** |
| `conf` | `units[].conf` | `High` `Med` `Low–Med` … |
| `depth` | `units[].depth` | `full` `thinned` `critical` |
| `flag` | `units[].flag` | short dominant note (or `—`) |
| `note` | `units[].note` | hover text |

---

## 5. Slot placement reference (the geometry contract)

The parser resolves each `slot` to its box label, grid row/col (for the Depth view), unit, and field coordinates `fx`,`fy` in % (for the Field view). Enter only the `slot` ID in Players; everything here is looked up. This table *is* the formation — edit it once to reshape all teams (e.g. to a 5-wide base).

**Offense**

| slot | label | unit | row | col | fx | fy |
|---|---|---|---|---|---|---|
| `WR_B` | WR ⟵ | rec | 0 | 0 | 8 | 27 |
| `SB_1` | SB | rec | 0 | 1 | 19 | 40 |
| `SB_2` | SB | rec | 0 | 2 | 64 | 40 |
| `SB_3` | SB | rec | 0 | 3 | 78 | 38 |
| `WR_F` | ⟶ WR | rec | 0 | 4 | 91 | 27 |
| `LT` | LT | ot | 1 | 0 | 22.5 | 22 |
| `LG` | LG | iol | 1 | 1 | 32 | 22 |
| `C` | C | iol | 1 | 2 | 41.5 | 22 |
| `RG` | RG | iol | 1 | 3 | 51 | 22 |
| `RT` | RT | ot | 1 | 4 | 60.5 | 22 |
| `QB` | QB | qb | 2 | 0 | 41 | 61 |
| `RB` | RB | bak | 2 | 1 | 51 | 63 |
| `FB` | FB | bak | 2 | 2 | 31 | 62 |

**Defense**

| slot | label | unit | row | col | fx | fy |
|---|---|---|---|---|---|---|
| `CB_B` | CB ⟵ | sec | 0 | 0 | 8 | 44 |
| `HB_B` | HB | sec | 0 | 1 | 27 | 36 |
| `S` | S | sec | 0 | 2 | 46 | 26 |
| `HB_F` | HB | sec | 0 | 3 | 68 | 36 |
| `CB_F` | ⟶ CB | sec | 0 | 4 | 90 | 44 |
| `WLB` | WLB | lb | 1 | 0 | 27 | 55 |
| `MLB` | MLB | lb | 1 | 1 | 43 | 55 |
| `SLB` | SLB | lb | 1 | 2 | 59 | 55 |
| `DE_B` | DE ⟵ | edge | 2 | 0 | 23 | 72 |
| `DT_1` | DT | idl | 2 | 1 | 36 | 72 |
| `DT_2` | DT | idl | 2 | 2 | 49 | 72 |
| `DE_F` | ⟶ DE | edge | 2 | 3 | 62 | 72 |

**Special teams** (rendered as boxes, no field coordinates)

| slot | label | unit |
|---|---|---|
| `KP` | K / P | st |
| `LS` | LS | st |
| `RET` | RET | st |

---

## 6. Worked example (Ottawa, Week 4)

**Players** (a few rows — headers omitted for brevity; order matches §2):

```
OTT,4,offense,WR_B,1,80,Victor,Binjimen Victor,WR (X),A,,active,in,High,,Moderate,ongoing,Moderate,,Redblacks debut in place of Lewis…,,,,,,Ohio State,6-4,198,29,2,66.3,331
OTT,4,offense,WR_B,2,87,Lewis,Eugene Lewis,WR (X),A,,1gIL,out,High,Moderate,Moderate,week-to-week,Moderate–High,,Baseline #1 — 3× All-CFL…,Wk4,shoulder,1-game IL,Wk5 (week-to-week),TRUE,Penn State,6-2,207,33,9,83.1,620
OTT,4,offense,C,1,51,McEwen,,C,N,,active,,High,,High,—,,National C — ratio spine,Veteran National centre…,,,,,,Calgary,6-3,300,32,10,76.0,660
OTT,4,offense,QB,1,13,Maier,Jake Maier,QB,A,QB1,active,,Very High,,High,—,,,Established QB1; early form priced separately.,,,,,,UC Davis,6-0,219,29,5,68.4,480
OTT,4,il,,,84,Mardner,,WR,A,,6gIL,,Low,,,,,,Depth loss when healthy,Wk1,,6-game IL,~Wk6–7,,,,,26,,68.2,
```

**Teams** (one row):

```
team=OTT week=4 name="Ottawa REDBLACKS" accent=#c8102e ink=#ffffff opp="@ MTL" oppFull="Montréal Alouettes"
date="Sun Jun 28, 2026" venue="Percival-Molson" homeAway=Away record="0–3"
verdict_dir=▼ verdict_mag=Minor verdict_conf=Moderate verdict_persist="week-to-week (Lewis 1-game IL)"
verdict_mvar="Moderate — top-WR loss" verdict_ratio="▲ +1 National (Pelehos RT)"
ratio_nat=10 ratio_floor=7 ratio_max=14 ratio_cushion=elite ratio_fragility=none ratio_delta="+1 vs Wk3"
traj=improving traj_note="Trending healthier — Henderson back; Parks in DL rotation; Lewis week-to-week."
headline="0–3, but the availability board reads modest…"
```

**Units** (one row per unit):

```
OTT,4,iol,Interior OL,offense,Elite,High,full,National-anchored,"Desjarlais–McEwen–Vaccaro — solid and established."
OTT,4,sec,Secondary,defense,Starter,Med,thinned,"HIGH variance; Frye 6g","Houston/S.Brown/Hutter (N); Henderson back, Addae 1g."
```

**Callouts** (`kind` = `drag` or `watch`; `order` sets list order):

```
team=OTT week=4 kind=drag order=1 label="WR (X)"        meta=  sev=notable    note="Lewis out (shoulder, 1-game IL)…"
team=OTT week=4 kind=drag order=2 label="Secondary depth" meta= sev=minor      note="Frye (6g, covered) + Addae (1g)…"
team=OTT week=4 kind=watch order=1 label=Henderson       meta="field HB"       note="season debut — on return ramp."
team=OTT week=4 kind=watch order=2 label=Lewis           meta="WR (X)"         note="week-to-week — reassess Wk5."
```

---

## 7. Fetch + parse (drop into `fetchTeamFromSheet`)

gviz returns each tab as JSONP wrapped in `google.visualization.Query.setResponse(…)`. Strip the wrapper, read `table.rows`, and assemble the shape.

```js
const GVIZ = (sheet, tq='') =>
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${encodeURIComponent(sheet)}`
  + (tq ? `&tq=${encodeURIComponent(tq)}` : '');

async function gviz(sheet, tq){
  const txt = await (await fetch(GVIZ(sheet, tq))).text();
  const json = JSON.parse(txt.replace(/^[\s\S]*?setResponse\(/, '').replace(/\);?\s*$/, ''));
  const cols = json.table.cols.map(c => (c.label || c.id));         // header labels
  return json.table.rows.map(r =>
    Object.fromEntries(cols.map((c,i) => [c, r.c[i] ? r.c[i].v : null])));
}

// Slot map from §5 (label/row/col/unit/fx/fy), keyed by slot id.
const SLOTS = { WR_B:{label:'WR ⟵',unit:'rec',row:0,col:0,fx:8,fy:27}, /* …all slots… */ };

async function fetchTeamFromSheet(abbr){
  const wk = `team='${abbr}'`;
  const [players, teamRows, unitRows, callRows] =
    await Promise.all([ gviz('Players', wk), gviz('Teams', wk), gviz('Units', wk), gviz('Callouts', wk) ]);

  const week = Math.max(...teamRows.map(r => +r.week));            // latest snapshot
  const T = teamRows.find(r => +r.week === week);
  const P = players.filter(r => +r.week === week);

  // players → nested player objects
  const mk = r => ({
    n:+r.num, name:r.name, full:r.full||undefined, pos:r.pos, nat:r.nat,
    flags:(r.flags||'').split(',').map(s=>s.trim()).filter(Boolean),
    starter:+r.depth===1, status:r.status||'active', chg:r.chg||null,
    lev:r.lev||null, drop:r.drop||null, conf:r.conf||null, persist:r.persist||null,
    mvar:r.mvar||null, ratio:r.ratio||null, note:r.note||null,
    health: r.health_since ? {since:r.health_since,reason:r.health_reason,list:r.health_list,ret:r.health_return,ramp:String(r.health_ramp).toUpperCase()==='TRUE'} : null,
    bio:{col:r.col,ht:r.ht,wt:+r.wt||undefined,age:+r.age||undefined,cfl:+r.cfl||undefined},
    pff: r.pff!=null ? +r.pff : undefined, pffSnaps: r.pffSnaps!=null ? +r.pffSnaps : undefined,
  });

  // group into boxes by slot, order by depth; place into layout rows via SLOTS
  const boxesBySide = {offense:{}, defense:{}, st:{}};
  const il = [];
  P.forEach(r => {
    if(r.side==='il'){ il.push(mk(r)); return; }
    const b = boxesBySide[r.side][r.slot] ||= { label: SLOTS[r.slot].label, _slot:r.slot, players:[] };
    b.players.push(mk(r));
  });
  const toRows = side => {
    Object.values(boxesBySide[side]).forEach(b => b.players.sort((a,z)=> a-z)); // depth already implied by push order if sorted upstream
    const grid = [];
    Object.values(boxesBySide[side]).forEach(b => {
      const {row,col} = SLOTS[b._slot]; (grid[row] ||= [])[col] = b;
    });
    return grid.map(r => r.filter(Boolean));
  };

  const call = kind => callRows.filter(r=>+r.week===week && r.kind===kind).sort((a,z)=>+a.order-+z.order);

  return {
    abbr, name:T.name, colors:{accent:T.accent, ink:T.ink},
    week, opp:T.opp, oppFull:T.oppFull, date:T.date, venue:T.venue, homeAway:T.homeAway, record:T.record,
    verdict:{ dir:T.verdict_dir, mag:T.verdict_mag, conf:T.verdict_conf, persist:T.verdict_persist, mvar:T.verdict_mvar, ratio:T.verdict_ratio },
    ratioMeter:{ nat:+T.ratio_nat, floor:+T.ratio_floor, max:+T.ratio_max, cushion:T.ratio_cushion, fragility:T.ratio_fragility, delta:T.ratio_delta },
    summary:{
      trajectory:T.traj, trajectoryNote:T.traj_note, headline:T.headline,
      drags: call('drag').map(r=>({pos:r.label, sev:r.sev, note:r.note})),
      watch: call('watch').map(r=>({who:r.label, pos:r.meta, note:r.note})),
    },
    units: unitRows.filter(r=>+r.week===week).map(r=>({key:r.key,label:r.label,side:r.side,tier:r.tier,conf:r.conf,depth:r.depth,flag:r.flag,note:r.note})),
    layout:{ offense:toRows('offense'), defense:toRows('defense'), specialists:[Object.values(boxesBySide.st).map(b=>b)] },
    il,
  };
}
```

> Sort `Players` rows by `depth` in the query (`tq=... order by depth`) or add a `.sort((a,b)=>+a.depth-+b.depth)` before grouping, so stacks come out starter-first.

---

## 8. Sync + rollout checklist

1. Create the four tabs with the header rows above; paste Ottawa Week 4 as the reference team (it already exists in the embedded data — export it once and you're done).
2. Fill in the remaining eight teams row-by-row; the switcher lights up as each `Teams`/`Players` set lands.
3. Replace the placeholder `pff` / `tier` values with the real workbook outputs — the card's PFF bar and the unit tiers are the two hooks.
4. Point `fetchTeamFromSheet` at the sheet, flip `DATA_SOURCE='sheet'`, and add loading / empty / error states before going live with nine live fetches.
5. Once ≥2 weeks exist per team, drop the hand-entered `chg` column and derive IN/OUT/moved from the week-*N* vs *N-1* diff — and add the week selector + health-trajectory read on top of the snapshots.

*Keep the returned object identical to `TEAMS.OTT`; that contract is what lets the render layer stay untouched as data moves to the sheet.*
