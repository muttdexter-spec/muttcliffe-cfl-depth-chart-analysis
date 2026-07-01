/**
 * MUTTCLIFFE — Sheet Tools
 * Bound Apps Script for the depth-chart data workbook.
 *
 * INSTALL (one time):
 *   1. Open the Google Sheet ▸ Extensions ▸ Apps Script.
 *   2. Delete any placeholder, paste this whole file, Save.
 *   3. Reload the sheet. A "MUTTCLIFFE" menu appears.
 *   4. MUTTCLIFFE ▸ Set up tabs — creates the Inbox and _check tabs
 *      on your EXISTING sheet without touching your data.
 *
 * WEEKLY LOOP:
 *   • Each team chat emits ONE combined block (rows prefixed with the tab
 *     name). Paste all of them into the Inbox tab (anywhere under the header).
 *   • MUTTCLIFFE ▸ Process inbox — fans each row to Teams/Units/Players/
 *     Callouts and clears the Inbox. Re-pasting a corrected (team, week)
 *     block cleanly REPLACES the old rows (idempotent upsert).
 *   • MUTTCLIFFE ▸ Validate data — flags unknown slots, bad enums, missing
 *     unit sets, orphan team+week, duplicate starters, ratio-floor breaches.
 *
 * The hosted app reads the four data tabs live; it ignores Inbox/_check/_log.
 */

// Destination tabs and their field counts (columns AFTER the leading "tab" column in the Inbox).
// Every data tab begins team, week, ... so the upsert key is always cols 1–2.
var TABW = { Teams: 26, Units: 10, Players: 32, Callouts: 8 };

var TAB_ORDER = ['Teams', 'Units', 'Players', 'Callouts'];

// ---- allowed values, kept in sync with the app + schema doc ----
var SLOT_OK = ['WR_B','SB_1','SB_2','SB_3','WR_F','LT','LG','C','RG','RT','QB','RB','FB',
               'CB_B','HB_B','S','HB_F','CB_F','WLB','MLB','SLB','DE_B','DT_1','DT_2','DE_F',
               'KP','LS','RET'];
var STATUS_OK = ['active','1gIL','6gIL','reserve','practice','suspended'];
var NAT_OK    = ['N','A','G'];
var TIER_OK   = ['Elite','Above-avg','Starter','Fringe','Insufficient'];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('MUTTCLIFFE')
    .addItem('Process inbox', 'processInbox')
    .addItem('Validate data', 'validateData')
    .addSeparator()
    .addItem('Bump all teams +1 week', 'bumpWeek')
    .addItem('Set up tabs (Inbox + checks)', 'setupTabs')
    .addToUi();
}

// ---------- helpers ----------
function ui()   { return SpreadsheetApp.getUi(); }
function norm(v){ return String(v == null ? '' : v).trim(); }
function pad(a, w){ a = a.slice(0, w); while (a.length < w) a.push(''); return a; }
function readTab(name){
  var s = SpreadsheetApp.getActive().getSheetByName(name);
  if (!s) return { sheet: null, header: [], rows: [] };
  var v = s.getDataRange().getValues();
  return { sheet: s, header: v[0] || [], rows: v.slice(1).filter(function(r){ return norm(r[0]) !== ''; }) };
}

// ---------- Process inbox: fan out + upsert by (team, week) ----------
function processInbox() {
  var ss = SpreadsheetApp.getActive();
  var inbox = ss.getSheetByName('Inbox');
  if (!inbox) { ui().alert('No Inbox tab yet. Run “MUTTCLIFFE ▸ Set up tabs” first.'); return; }

  var vals = inbox.getDataRange().getValues();
  var rows = vals.slice(1).filter(function(r){ return norm(r[0]) !== ''; });
  if (!rows.length) { ui().alert('Inbox is empty — nothing to process.'); return; }

  var byTab = {}, skipped = [];
  rows.forEach(function(r, i){
    var tab = norm(r[0]);
    if (!TABW[tab]) { skipped.push('inbox row ' + (i + 2) + ': unknown tab "' + tab + '"'); return; }
    if (norm(r[1]).toLowerCase() === 'team') { skipped.push('inbox row ' + (i + 2) + ': looks like a header row — skipped'); return; }
    (byTab[tab] = byTab[tab] || []).push(r.slice(1, 1 + TABW[tab]));
  });

  // Same block pasted twice? Exact-duplicate rows collapse to one, so a double-paste is harmless.
  Object.keys(byTab).forEach(function(tab){
    var seen = {};
    byTab[tab] = byTab[tab].filter(function(r){
      var k = r.map(norm).join('\u0001');
      if (seen[k]) return false; seen[k] = true; return true;
    });
  });

  var summary = [];
  TAB_ORDER.forEach(function(tab){
    if (!byTab[tab]) return;
    var sheet = ss.getSheetByName(tab);
    if (!sheet) { skipped.push('missing destination tab: ' + tab); return; }
    var w = TABW[tab];
    var incoming = byTab[tab];

    // keys we're about to (re)write
    var keys = {};
    incoming.forEach(function(r){ keys[norm(r[0]) + '|' + norm(r[1])] = true; });

    // keep every existing row whose (team, week) is NOT being replaced
    var dv = sheet.getDataRange().getValues();
    var kept = [], removed = 0;
    for (var i = 1; i < dv.length; i++) {
      if (norm(dv[i][0]) === '') continue;                 // drop stray blank rows
      var k = norm(dv[i][0]) + '|' + norm(dv[i][1]);
      if (keys[k]) { removed++; continue; }
      kept.push(dv[i]);
    }

    var body = kept.concat(incoming).map(function(r){ return pad(r.slice(), w); });
    sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), w).clearContent();
    if (body.length) sheet.getRange(2, 1, body.length, w).setValues(body);
    summary.push(tab + ':  +' + incoming.length + ' row(s), replaced ' + removed);
  });

  // clear the inbox payload, keep the header
  inbox.getRange(2, 1, Math.max(inbox.getMaxRows() - 1, 1), inbox.getMaxColumns()).clearContent();

  var msg = 'Processed inbox\n\n' + summary.join('\n');
  if (skipped.length) msg += '\n\nSkipped:\n' + skipped.join('\n');
  ui().alert(msg);
}

// ---------- Validate: write a report to _log ----------
function validateData() {
  var T = readTab('Teams'), U = readTab('Units'), P = readTab('Players'), C = readTab('Callouts');
  var issues = [];
  function add(sev, where, msg){ issues.push([sev, where, msg]); }
  function ix(h, name){ return h.indexOf(name); }
  function inList(v, list){ return v === '' || list.indexOf(v) >= 0; }

  // 1) referential integrity: every Units/Players/Callouts (team,week) has a Teams row
  var teamKeys = {};
  T.rows.forEach(function(r){ teamKeys[norm(r[0]) + '|' + norm(r[1])] = true; });
  [['Units', U], ['Players', P], ['Callouts', C]].forEach(function(pair){
    var label = pair[0], d = pair[1];
    d.rows.forEach(function(r, i){
      var k = norm(r[0]) + '|' + norm(r[1]);
      if (norm(r[0]) && !teamKeys[k]) add('ERROR', label + ' row ' + (i + 2), 'no Teams row for ' + norm(r[0]) + ' wk' + norm(r[1]));
    });
  });

  // 2) each team's latest week should carry 10 unit rows
  var latest = {};
  T.rows.forEach(function(r){ var t = norm(r[0]), w = +r[1]; if (!(t in latest) || w > latest[t]) latest[t] = w; });
  Object.keys(latest).forEach(function(t){
    var n = U.rows.filter(function(r){ return norm(r[0]) === t && +r[1] === latest[t]; }).length;
    if (n !== 10) add('WARN', 'Units', t + ' wk' + latest[t] + ' has ' + n + ' unit rows (expected 10)');
  });

  // 3) Players: slots, enums, duplicate starters, national floor
  var pSide = ix(P.header, 'side'), pSlot = ix(P.header, 'slot'), pDepth = ix(P.header, 'depth'),
      pNat = ix(P.header, 'nat'), pStat = ix(P.header, 'status');
  var dup = {}, nat = {};
  P.rows.forEach(function(r, i){
    var side = norm(r[pSide]), slot = norm(r[pSlot]), st = norm(r[pStat]), nt = norm(r[pNat]);
    if (side !== 'il' && slot && SLOT_OK.indexOf(slot) < 0) add('ERROR', 'Players row ' + (i + 2), 'unknown slot "' + slot + '"');
    if (!inList(st, STATUS_OK)) add('ERROR', 'Players row ' + (i + 2), 'bad status "' + st + '"');
    if (!inList(nt, NAT_OK))    add('ERROR', 'Players row ' + (i + 2), 'bad nat "' + nt + '"');
    if (side !== 'il' && +r[pDepth] === 1) {
      var dk = norm(r[0]) + '|' + norm(r[1]) + '|' + slot;
      dup[dk] = (dup[dk] || 0) + 1;
    }
    if ((side === 'offense' || side === 'defense') && +r[pDepth] === 1) {
      var nk = norm(r[0]) + '|' + norm(r[1]);
      nat[nk] = nat[nk] || { n: 0, tot: 0 };
      nat[nk].tot++; if (nt === 'N') nat[nk].n++;
    }
  });
  Object.keys(dup).forEach(function(k){ if (dup[k] > 1) add('WARN', 'Players', 'two starters (depth=1) at ' + k.replace(/\|/g, ' / ')); });

  // 3b) a player-level team whose LATEST week has no Players rows silently drops to unit level (all chips vanish)
  Object.keys(latest).forEach(function(t){
    var before = 0, now = 0;
    P.rows.forEach(function(r){
      if (norm(r[0]) !== t) return;
      if (+r[1] === latest[t]) now++; else if (+r[1] < latest[t]) before++;
    });
    if (before > 0 && now === 0) add('ERROR', 'Players', t + ' had a roster in earlier weeks but none at wk' + latest[t] + ' — the app will silently drop it to unit level (partial paste?)');
  });

  // 3c) exact duplicate player rows (same team+week+side+slot+num) render duplicate chips
  var exact = {};
  P.rows.forEach(function(r, i){
    var k = [norm(r[0]), norm(r[1]), norm(r[pSide]), norm(r[pSlot]), norm(r[ix(P.header,'num')])].join('|');
    if (exact[k] != null) add('WARN', 'Players row ' + (i + 2), 'duplicate of row ' + exact[k] + ' (' + k.replace(/\|/g, ' / ') + ')');
    else exact[k] = i + 2;
  });
  Object.keys(nat).forEach(function(k){
    var v = nat[k];
    if (v.tot >= 18 && v.n < 7) add('WARN', 'ratio', k.replace('|', ' wk') + ': ' + v.n + ' declared National starters (floor is 7)');
  });

  // 4) Units tier enum
  var uTier = ix(U.header, 'tier');
  U.rows.forEach(function(r, i){ var t = norm(r[uTier]); if (!inList(t, TIER_OK)) add('ERROR', 'Units row ' + (i + 2), 'bad tier "' + t + '"'); });

  // write report
  var ss = SpreadsheetApp.getActive();
  var log = ss.getSheetByName('_log') || ss.insertSheet('_log');
  log.clear();
  log.getRange(1, 1, 1, 3).setValues([['severity', 'where', 'message']]).setFontWeight('bold').setBackground('#11202E').setFontColor('#FFFFFF');
  if (issues.length) {
    // errors first, then warnings
    issues.sort(function(a, b){ return (a[0] === 'ERROR' ? 0 : 1) - (b[0] === 'ERROR' ? 0 : 1); });
    log.getRange(2, 1, issues.length, 3).setValues(issues);
  } else {
    log.getRange(2, 1, 1, 3).setValues([['OK', '—', 'No problems found.']]);
  }
  log.setColumnWidth(1, 90); log.setColumnWidth(2, 160); log.setColumnWidth(3, 560);
  log.setFrozenRows(1);

  var errs = issues.filter(function(x){ return x[0] === 'ERROR'; }).length;
  var warns = issues.length - errs;
  ui().alert('Validation complete\n\n' + errs + ' error(s), ' + warns + ' warning(s).\nSee the _log tab for details.');
}

// ---------- Bump all teams to next week (quiet-week shortcut) ----------
function bumpWeek() {
  var resp = ui().alert('Bump all teams to next week?',
    'Copies each team\'s latest-week rows in Teams / Units / Players / Callouts to week + 1, so you only edit what changed. Continue?',
    ui().ButtonSet.YES_NO);
  if (resp !== ui().Button.YES) return;

  var ss = SpreadsheetApp.getActive();
  var report = [];
  TAB_ORDER.forEach(function(tab){
    var d = readTab(tab); if (!d.sheet) return;
    var latest = {};
    d.rows.forEach(function(r){ var t = norm(r[0]), w = +r[1]; if (!(t in latest) || w > latest[t]) latest[t] = w; });
    var add = [];
    d.rows.forEach(function(r){ var t = norm(r[0]); if (+r[1] === latest[t]) { var c = r.slice(); c[1] = latest[t] + 1; add.push(pad(c, d.header.length)); } });
    if (add.length) d.sheet.getRange(d.sheet.getLastRow() + 1, 1, add.length, d.header.length).setValues(add);
    report.push(tab + ': +' + add.length);
  });
  ui().alert('Done — each team now has a fresh week copied from its latest.\n\n' + report.join('\n') + '\n\nEdit only what changed; the app shows the newest week.');
}

// ---------- Set up Inbox + _check tabs on an existing sheet ----------
function setupTabs() {
  var ss = SpreadsheetApp.getActive();

  // Inbox
  var inbox = ss.getSheetByName('Inbox') || ss.insertSheet('Inbox', 0);
  var head = ['tab', 'team', 'week', '←  paste combined export rows below; fields follow each tab\'s column order  →'];
  inbox.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#11202E').setFontColor('#FFFFFF');
  inbox.setFrozenRows(1);
  var needCols = 33; // widest record = Players (32) + the leading tab column
  if (inbox.getMaxColumns() < needCols) inbox.insertColumnsAfter(inbox.getMaxColumns(), needCols - inbox.getMaxColumns());
  // Force plain-text everywhere data lands, so Sheets can never auto-convert pasted values
  // (heights like 5-10 → dates, date strings → Date objects that render as garbage in the app).
  inbox.getRange(1, 1, inbox.getMaxRows(), inbox.getMaxColumns()).setNumberFormat('@');
  TAB_ORDER.forEach(function(t){
    var s = ss.getSheetByName(t);
    if (s) s.getRange(1, 1, s.getMaxRows(), s.getMaxColumns()).setNumberFormat('@');
  });

  // _check — live formulas (auto-update; blank/✓ means clean)
  var chk = ss.getSheetByName('_check') || ss.insertSheet('_check');
  chk.clear();
  var body = [
    ['MUTTCLIFFE — live checks (auto-updating). “✓ none” or blank = clean.'],
    [''],
    ['Unknown slots in Players:'],
    ['=IFERROR(TEXTJOIN(", ", TRUE, FILTER(Players!D2:D, (Players!D2:D<>"")*(Players!C2:C<>"il")*(ISNA(MATCH(Players!D2:D, Slots!A2:A, 0))))), "✓ none")'],
    ['Bad tiers in Units:'],
    ['=IFERROR(TEXTJOIN(", ", TRUE, FILTER(Units!F2:F, (Units!F2:F<>"")*ISNA(MATCH(Units!F2:F, {"Elite";"Above-avg";"Starter";"Fringe";"Insufficient"}, 0)))), "✓ none")'],
    ['Bad statuses in Players:'],
    ['=IFERROR(TEXTJOIN(", ", TRUE, FILTER(Players!L2:L, (Players!L2:L<>"")*ISNA(MATCH(Players!L2:L, {"active";"1gIL";"6gIL";"reserve";"practice";"suspended"}, 0)))), "✓ none")'],
    ['Team+week in Units with no matching Teams row:'],
    ['=IFERROR(TEXTJOIN(", ", TRUE, FILTER(Units!A2:A&" wk"&Units!B2:B, (Units!A2:A<>"")*ISNA(MATCH(Units!A2:A&"|"&Units!B2:B, ARRAYFORMULA(Teams!A2:A&"|"&Teams!B2:B), 0)))), "✓ none")'],
    ['Team+week in Players with no matching Teams row:'],
    ['=IFERROR(TEXTJOIN(", ", TRUE, FILTER(Players!A2:A&" wk"&Players!B2:B, (Players!A2:A<>"")*ISNA(MATCH(Players!A2:A&"|"&Players!B2:B, ARRAYFORMULA(Teams!A2:A&"|"&Teams!B2:B), 0)))), "✓ none")']
  ];
  chk.getRange(1, 1, body.length, 1).setValues(body);
  chk.getRange(1, 1).setFontWeight('bold');
  [3, 5, 7, 9, 11].forEach(function(r){ chk.getRange(r, 1).setFontWeight('bold').setFontColor('#11202E'); });
  chk.setColumnWidth(1, 780);
  chk.setFrozenRows(1);

  ui().alert('Set up complete.\n\n• Inbox — paste combined export blocks here, then run “Process inbox”.\n• _check — live validation, always on.');
}
