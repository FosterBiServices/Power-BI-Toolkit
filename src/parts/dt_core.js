/*DT-CORE-START*/
/* ---------- dates (UTC, no time part) ---------- */
const DAY = 86400000;
function D(y, m, d){ return new Date(Date.UTC(y, m - 1, d)); }
function ymd(dt){ return dt.toISOString().slice(0, 10); }
function addDays(dt, n){ return new Date(dt.getTime() + n * DAY); }
function dow1(dt, weekStart){ const w = dt.getUTCDay(); return weekStart === 'sun' ? w + 1 : (w + 6) % 7 + 1; } // 1..7
function nthWeekday(y, m, weekday, n){ // weekday 0=Sun; n>0 nth, n=-1 last
  if (n > 0) { const first = D(y, m, 1); const off = (weekday - first.getUTCDay() + 7) % 7; return D(y, m, 1 + off + (n - 1) * 7); }
  const last = D(y, m + 1, 0); const off = (last.getUTCDay() - weekday + 7) % 7; return addDays(last, -off);
}
function easter(y){ // Anonymous Gregorian algorithm
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
    month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return D(y, month, day);
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* ---------- holidays ---------- */
// fixed: true = a fixed calendar date that moves to a weekday when "observed" is on
const US_HOLIDAYS = [
  { key: 'newyear', spec: { k: 'fixed', m: 1, d: 1 }, name: "New Year's Day", fixed: true, on: true, rule: y => D(y, 1, 1) },
  { key: 'mlk', spec: { k: 'nth', m: 1, wd: 1, n: 3 }, name: 'Martin Luther King Jr. Day', on: true, rule: y => nthWeekday(y, 1, 1, 3) },
  { key: 'presidents', spec: { k: 'nth', m: 2, wd: 1, n: 3 }, name: "Presidents' Day", on: true, rule: y => nthWeekday(y, 2, 1, 3) },
  { key: 'goodfriday', spec: { k: 'easter', off: -2 }, name: 'Good Friday', on: false, rule: y => addDays(easter(y), -2) },
  { key: 'memorial', spec: { k: 'last', m: 5, wd: 1 }, name: 'Memorial Day', on: true, rule: y => nthWeekday(y, 5, 1, -1) },
  { key: 'juneteenth', spec: { k: 'fixed', m: 6, d: 19 }, name: 'Juneteenth', fixed: true, on: true, from: 2021, rule: y => D(y, 6, 19) },
  { key: 'independence', spec: { k: 'fixed', m: 7, d: 4 }, name: 'Independence Day', fixed: true, on: true, rule: y => D(y, 7, 4) },
  { key: 'labor', spec: { k: 'nth', m: 9, wd: 1, n: 1 }, name: 'Labor Day', on: true, rule: y => nthWeekday(y, 9, 1, 1) },
  { key: 'columbus', spec: { k: 'nth', m: 10, wd: 1, n: 2 }, name: 'Columbus Day', on: true, rule: y => nthWeekday(y, 10, 1, 2) },
  { key: 'veterans', spec: { k: 'fixed', m: 11, d: 11 }, name: 'Veterans Day', fixed: true, on: true, rule: y => D(y, 11, 11) },
  { key: 'thanksgiving', spec: { k: 'nth', m: 11, wd: 4, n: 4 }, name: 'Thanksgiving Day', on: true, rule: y => nthWeekday(y, 11, 4, 4) },
  { key: 'dayafter', spec: { k: 'nth', m: 11, wd: 4, n: 4, plus: 1 }, name: 'Day after Thanksgiving', on: false, rule: y => addDays(nthWeekday(y, 11, 4, 4), 1) },
  { key: 'xmaseve', spec: { k: 'fixed', m: 12, d: 24 }, name: 'Christmas Eve', on: false, rule: y => D(y, 12, 24) },
  { key: 'christmas', spec: { k: 'fixed', m: 12, d: 25 }, name: 'Christmas Day', fixed: true, on: true, rule: y => D(y, 12, 25) },
  { key: 'nye', spec: { k: 'fixed', m: 12, d: 31 }, name: "New Year's Eve", on: false, rule: y => D(y, 12, 31) }
];

// Custom lines: "2026-12-24 Name" (one date) or "12-24 Name" / "12/24 Name" (every year) or "12/24/2026 Name"
function parseCustomHolidays(text){
  const out = [], errors = [];
  (text || '').split('\n').forEach((raw, i) => {
    const line = raw.trim(); if (!line || line.startsWith('//')) return;
    let m, y = null, mo, d, name;
    if ((m = line.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(.+)$/))) { y = +m[1]; mo = +m[2]; d = +m[3]; name = m[4]; }
    else if ((m = line.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(.+)$/))) { mo = +m[1]; d = +m[2]; y = +m[3]; name = m[4]; }
    else if ((m = line.match(/^(\d{1,2})[-\/](\d{1,2})\s+(.+)$/))) { mo = +m[1]; d = +m[2]; name = m[3]; }
    else { errors.push('Line ' + (i + 1) + ': “' + line + '” isn’t a date followed by a name.'); return; }
    name = name.replace(/^[-–:,\s]+/, '').trim();
    const test = D(y || 2024, mo, d);
    if (mo < 1 || mo > 12 || test.getUTCMonth() !== mo - 1 || test.getUTCDate() !== d) { errors.push('Line ' + (i + 1) + ': ' + (y ? y + '-' : '') + mo + '-' + d + ' isn’t a real date.'); return; }
    if (!name) { errors.push('Line ' + (i + 1) + ': add a name after the date.'); return; }
    if (!y && mo === 2 && d === 29) { errors.push('Line ' + (i + 1) + ': 29 February can\u2019t repeat every year; add a year, like 2028-02-29.'); return; }
    out.push({ year: y, month: mo, day: d, name });
  });
  return { list: out, errors };
}

// All holidays from year a to year b, merged by date: [{ date, name }]
function buildHolidays(cfg, a, b){
  const map = new Map();
  const add = (dt, name) => { const k = ymd(dt); const cur = map.get(k); if (!cur) map.set(k, { date: dt, names: [name] }); else if (!cur.names.includes(name)) cur.names.push(name); };
  const picked = cfg.country === 'us' ? US_HOLIDAYS.filter(h => cfg.holidays[h.key] !== undefined ? cfg.holidays[h.key] : h.on) : [];
  const custom = parseCustomHolidays(cfg.custom).list;
  for (let y = a - 1; y <= b + 1; y++) {
    picked.forEach(h => {
      if (h.from && y < h.from) return;
      const dt = h.rule(y); add(dt, h.name);
      if (cfg.observed && h.fixed) {
        const w = dt.getUTCDay();
        if (w === 6) add(addDays(dt, -1), h.name + ' (observed)');
        if (w === 0) add(addDays(dt, 1), h.name + ' (observed)');
      }
    });
    custom.filter(c => c.year === null || c.year === y).forEach(c => add(D(y, c.month, c.day), c.name));
  }
  return [...map.values()].filter(h => h.date.getUTCFullYear() >= a && h.date.getUTCFullYear() <= b)
    .sort((x, z) => x.date - z.date).map(h => ({ date: h.date, name: h.names.join(' / ') }));
}

/* ---------- range ---------- */
function fiscalStartYear(dt, s){ const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1; return s > 1 && m < s ? y - 1 : y; }
function fyNumber(fsy, cfg){ return cfg.fyStart > 1 && cfg.fyNaming === 'end' ? fsy + 1 : fsy; }
// First day of the fiscal (or calendar) year whose label year is Y
function yearStart(Y, cfg, fiscal){ if (!fiscal || cfg.fyStart === 1) return D(Y, 1, 1); return D(cfg.fyNaming === 'end' ? Y - 1 : Y, cfg.fyStart, 1); }
function yearEnd(Y, cfg, fiscal){ return addDays(yearStart(Y + 1, cfg, fiscal), -1); }
// Columns whose earliest date starts the table: "'Sales'[Order Date]" or "Sales[Order Date]", one per line
function parseStartCols(text){
  const cols = [], errors = [];
  (text || '').split(/\n|;/).forEach(raw => {
    const s = raw.trim(); if (!s) return;
    const m = s.match(/^'((?:[^']|'')+)'\s*\[([^\]]+)\]$/) || s.match(/^([^'\[\]]+?)\s*\[([^\]]+)\]$/);
    if (!m) { errors.push('\u201C' + s + '\u201D isn\u2019t a column. Write it as Table[Column], for example Sales[Order Date].'); return; }
    cols.push({ table: m[1].replace(/''/g, "'").trim(), column: m[2].trim() });
  });
  return { cols, errors };
}
function computeRange(cfg, today){
  const fiscal = cfg.align === 'fiscal' && cfg.fyStart > 1;
  const start = yearStart(cfg.startYear, cfg, fiscal); // also the stand-in when the start comes from your data
  let endYear, end;
  if (cfg.endMode === 'today' || cfg.endMode === 'yesterday') {
    end = cfg.endMode === 'today' ? today : addDays(today, -1);
    endYear = end.getUTCFullYear();
  } else if (cfg.endMode === 'data') {
    endYear = cfg.endYear; end = yearEnd(endYear, cfg, fiscal); // stand-in until the data is read
  } else {
    if (cfg.endMode === 'rolling') endYear = (fiscal ? fyNumber(fiscalStartYear(today, cfg.fyStart), cfg) : today.getUTCFullYear()) + cfg.rollYears;
    else endYear = cfg.endYear;
    end = yearEnd(endYear, cfg, fiscal);
  }
  const fromData = cfg.startMode === 'data', endFromData = cfg.endMode === 'data';
  const dynamic = fromData || cfg.endMode !== 'fixed';
  return { start, end, endYear, fiscal, fromData, endFromData, usesData: fromData || endFromData, dynamic, days: Math.round((end - start) / DAY) + 1 };
}
function describeRange(cfg, r){
  const cols = parseStartCols(cfg.startCols).cols;
  const s = r.fromData ? (cfg.startSnap === 'year' ? 'start of the first ' + (r.fiscal ? 'fiscal ' : '') + 'year in ' : 'the earliest date in ') + cols.map(c => c.table + '[' + c.column + ']').join(', ') : ymd(r.start);
  const e = cfg.endMode === 'rolling' ? 'end of ' + (r.fiscal ? 'fiscal ' : '') + 'year + ' + cfg.rollYears : cfg.endMode === 'today' ? 'today' : cfg.endMode === 'yesterday' ? 'yesterday'
    : cfg.endMode === 'data' ? (cfg.endSnap === 'exact' ? 'the latest date' : 'end of the ' + (r.fiscal ? 'fiscal ' : '') + 'year holding the latest date') + (r.fromData ? '' : ' in ' + cols.map(c => c.table + '[' + c.column + ']').join(', ')) : ymd(r.end);
  return '// Date table: ' + s + ' to ' + e + (r.dynamic ? ' (updates on refresh)' : '');
}
const DATE_COLS_QUERY = [
'// Date Table Generator: list every date column in the model',
'// Run in DAX query view, then select Copy above the results grid.',
'EVALUATE',
'SELECTCOLUMNS (',
'    FILTER (',
'        INFO.VIEW.COLUMNS (),',
'        // Date and DateTime columns (Power BI reports the type as "Date" or "DateTime")',
'        CONTAINSSTRING ( [DataType], "Date" )',
'            && NOT CONTAINSSTRING ( [Table], "LocalDateTable_" )',
'            && NOT CONTAINSSTRING ( [Table], "DateTableTemplate_" )',
'    ),',
'    "Table", [Table],',
'    "Column", [Name],',
'    "Type", [DataType],',
'    "Hidden", [IsHidden]',
')',
'ORDER BY [Table], [Column]'].join('\n');
function parseDateCols(text){
  const res = { cols: [], error: null };
  const lines = (text || '').replace(/\r/g, '').split('\n').filter(l => l.trim());
  if (!lines.length) return res;
  const head = lines[0].split('\t').map(h => h.trim().replace(/^"|"$/g, '').replace(/^.*\[|\]$/g, '').toLowerCase());
  const ti = head.indexOf('table'), ci = head.indexOf('column'), hi = head.indexOf('hidden');
  if (ti < 0 || ci < 0) { res.error = 'The header row (Table, Column) wasn\u2019t found. Use the Copy button above the results grid so the column names come along.'; return res; }
  const seen = new Set();
  lines.slice(1).forEach(l => {
    const c = l.split('\t').map(x => x.trim().replace(/^"(.*)"$/, '$1').replace(/""/g, '"'));
    const t = c[ti], col = c[ci]; if (!t || !col) return;
    const k = (t + '[' + col + ']').toLowerCase(); if (seen.has(k)) return; seen.add(k);
    res.cols.push({ table: t, column: col, hidden: hi >= 0 && /^true$/i.test(c[hi] || '') });
  });
  if (!res.cols.length) res.error = 'No date columns were found under the header row.';
  return res;
}
function dateRangeQuery(cols){
  const rows = cols.map(c => 'ROW ( "Column", ' + daxStr(c.table + '[' + c.column + ']') + ', "Earliest", MIN ( ' + daxColRef(c) + ' ), "Latest", MAX ( ' + daxColRef(c) + ' ), "Blank rows", COUNTBLANK ( ' + daxColRef(c) + ' ) )');
  const L = ['// Earliest and latest date in each column. Watch for placeholder dates such as 1900-01-01 or 9999-12-31.', 'EVALUATE'];
  if (rows.length === 1) L.push(rows[0]);
  else { L.push('UNION ('); rows.forEach((r, i) => L.push('    ' + r + (i < rows.length - 1 ? ',' : ''))); L.push(')'); }
  L.push('ORDER BY [Earliest]');
  return L.join('\n');
}
function daxColRef(c){ return "'" + c.table.replace(/'/g, "''") + "'[" + c.column.replace(/\]/g, ']]') + ']'; }

/* ---------- columns ---------- */
// type: date | int | text | bool. Expressions use shared variables (see daxCode / mCode).
const DT_COLUMNS = [
  { key: 'year', name: 'Year', group: 'Calendar', type: 'int', on: true, dax: '_y', m: 'y', js: c => c.y },
  { key: 'quarter', name: 'Quarter', group: 'Calendar', type: 'text', on: true, dax: '"Q" & _q', m: '"Q" & Text.From(q)', js: c => 'Q' + c.q },
  { key: 'yearQuarter', name: 'Year Quarter', group: 'Calendar', type: 'text', on: true, dax: '_y & " Q" & _q', m: 'Text.From(y) & " Q" & Text.From(q)', js: c => c.y + ' Q' + c.q },
  { key: 'monthNum', name: 'Month Number', group: 'Calendar', type: 'int', on: true, dax: '_m', m: 'm', js: c => c.m },
  { key: 'monthName', name: 'Month Name', group: 'Calendar', type: 'text', on: true, dax: 'FORMAT ( _d, "mmmm" )', m: 'Date.MonthName(d, "en-US")', js: c => MONTHS[c.m - 1], sortBy: 'monthOrder' },
  { key: 'monthShort', name: 'Month Short', group: 'Calendar', type: 'text', on: false, dax: 'FORMAT ( _d, "mmm" )', m: 'Text.Start(Date.MonthName(d, "en-US"), 3)', js: c => MONTHS[c.m - 1].slice(0, 3), sortBy: 'monthOrder' },
  { key: 'yearMonth', name: 'Year Month', group: 'Calendar', type: 'text', on: true, dax: 'FORMAT ( _d, "mmm yyyy" )', m: 'Text.Start(Date.MonthName(d, "en-US"), 3) & " " & Text.From(y)', js: c => MONTHS[c.m - 1].slice(0, 3) + ' ' + c.y, sortBy: 'monthSort' },
  { key: 'monthSort', name: 'Month Sort', group: 'Calendar', type: 'int', on: true, dax: '_y * 12 + _m', m: 'y * 12 + m', js: c => c.y * 12 + c.m },
  { key: 'monthStart', name: 'Month Start', group: 'Calendar', type: 'date', on: false, dax: 'DATE ( _y, _m, 1 )', m: 'Date.StartOfMonth(d)', js: c => ymd(D(c.y, c.m, 1)) },
  { key: 'monthEnd', name: 'Month End', group: 'Calendar', type: 'date', on: false, dax: 'EOMONTH ( _d, 0 )', m: 'Date.EndOfMonth(d)', js: c => ymd(D(c.y, c.m + 1, 0)) },
  { key: 'dayOfMonth', name: 'Day of Month', group: 'Calendar', type: 'int', on: true, dax: 'DAY ( _d )', m: 'Date.Day(d)', js: c => c.dt.getUTCDate() },
  { key: 'dowNum', name: 'Day of Week Number', group: 'Week', type: 'int', on: true, dax: '_dow', m: 'dow', js: c => c.dow },
  { key: 'dayName', name: 'Day Name', group: 'Week', type: 'text', on: true, dax: 'FORMAT ( _d, "dddd" )', m: 'Date.DayOfWeekName(d, "en-US")', js: c => DAYS[c.dt.getUTCDay()], sortBy: 'dowNum' },
  { key: 'dayShort', name: 'Day Short', group: 'Week', type: 'text', on: false, dax: 'FORMAT ( _d, "ddd" )', m: 'Text.Start(Date.DayOfWeekName(d, "en-US"), 3)', js: c => DAYS[c.dt.getUTCDay()].slice(0, 3), sortBy: 'dowNum' },
  { key: 'weekStart', name: 'Week Start', group: 'Week', type: 'date', on: true, dax: '_d - _dow + 1', m: 'Date.AddDays(d, 1 - dow)', js: c => ymd(addDays(c.dt, 1 - c.dow)) },
  { key: 'weekOfYear', name: 'Week of Year', group: 'Week', type: 'int', on: false, dax: 'WEEKNUM ( _d, {WEEKNUM} )', m: 'Date.WeekOfYear(d, {MDAY})', js: c => c.wk },
  { key: 'isoWeek', name: 'ISO Week', group: 'Week', type: 'int', on: false, dax: 'WEEKNUM ( _d, 21 )', m: 'Number.RoundDown((Date.DayOfYear(Date.AddDays(d, 3 - Date.DayOfWeek(d, Day.Monday))) - 1) / 7) + 1', js: c => c.isoWk },
  { key: 'isoYear', name: 'ISO Year', group: 'Week', type: 'int', on: false, dax: 'YEAR ( _d + 4 - WEEKDAY ( _d, 2 ) )', m: 'Date.Year(Date.AddDays(d, 3 - Date.DayOfWeek(d, Day.Monday)))', js: c => c.isoYr },
  { key: 'fy', name: 'Fiscal Year', group: 'Fiscal', type: 'text', on: true, dax: '{FYLABEL_DAX}', m: '{FYLABEL_M}', js: c => c.fyLabel },
  { key: 'fyNum', name: 'Fiscal Year Number', group: 'Fiscal', type: 'int', on: false, dax: '_fy', m: 'fy', js: c => c.fy },
  { key: 'fq', name: 'Fiscal Quarter', group: 'Fiscal', type: 'text', on: true, dax: '"FQ" & _fq', m: '"FQ" & Text.From(fq)', js: c => 'FQ' + c.fq },
  { key: 'fyq', name: 'Fiscal Year Quarter', group: 'Fiscal', type: 'text', on: true, dax: '{FYLABEL_DAX} & " Q" & _fq', m: '{FYLABEL_M} & " Q" & Text.From(fq)', js: c => c.fyLabel + ' Q' + c.fq },
  { key: 'fm', name: 'Fiscal Month Number', group: 'Fiscal', type: 'int', on: true, dax: '_fm', m: 'fm', js: c => c.fm },
  { key: 'fperiod', name: 'Fiscal Period', group: 'Fiscal', type: 'text', on: false, dax: '"P" & FORMAT ( _fm, "00" )', m: '"P" & Text.PadStart(Text.From(fm), 2, "0")', js: c => 'P' + String(c.fm).padStart(2, '0') },
  { key: 'isWeekend', name: 'Is Weekend', group: 'Working days', type: 'bool', on: true, dax: '_weekend', m: 'weekend', js: c => c.weekend },
  { key: 'isHoliday', name: 'Is Holiday', group: 'Working days', type: 'bool', on: true, needsHol: true, dax: 'NOT ISBLANK ( _hol )', m: 'hol <> null', js: c => !!c.hol },
  { key: 'holidayName', name: 'Holiday Name', group: 'Working days', type: 'text', on: true, needsHol: true, dax: '_hol', m: 'hol', js: c => c.hol || '' },
  { key: 'isWorkday', name: 'Is Working Day', group: 'Working days', type: 'bool', on: true, dax: '{WORKDAY_DAX}', m: '{WORKDAY_M}', js: c => !c.weekend && !c.hol },
  { key: 'monthFilter', name: 'Month Filter', group: 'Relative to today', type: 'text', on: true, rel: true, dax: '{MF_DAX}', m: '{MF_M}', sortBy: 'monthSort',
    js: c => c.y === c.today.getUTCFullYear() && c.m === c.today.getUTCMonth() + 1 ? 'Current' : (c.mfStyle === 'short' ? MONTHS[c.m - 1].slice(0, 3) : MONTHS[c.m - 1]) + '-' + c.y },
  { key: 'dayOffset', name: 'Day Offset', group: 'Relative to today', type: 'int', on: false, rel: true, dax: 'INT ( _d - _today )', m: 'Duration.Days(d - Today)', js: c => Math.round((c.dt - c.today) / DAY) },
  { key: 'monthOffset', name: 'Month Offset', group: 'Relative to today', type: 'int', on: false, rel: true, dax: '( _y - YEAR ( _today ) ) * 12 + _m - MONTH ( _today )', m: '(y - Date.Year(Today)) * 12 + m - Date.Month(Today)', js: c => (c.y - c.today.getUTCFullYear()) * 12 + c.m - (c.today.getUTCMonth() + 1) },
  { key: 'yearOffset', name: 'Year Offset', group: 'Relative to today', type: 'int', on: false, rel: true, dax: '_y - YEAR ( _today )', m: 'y - Date.Year(Today)', js: c => c.y - c.today.getUTCFullYear() },
  { key: 'fyOffset', name: 'Fiscal Year Offset', group: 'Relative to today', type: 'int', on: false, rel: true, dax: '_fy - {TODAY_FY_DAX}', m: 'fy - TodayFiscalYear', js: c => c.fy - c.todayFy }
];
const SORT_TARGET = { monthOrder: cfg => cfg.monthFiscalOrder && cfg.fyStart > 1 ? 'fm' : 'monthNum' };

// Columns to output, in catalog order, with sort-by targets added (hidden) when needed
function outputColumns(cfg, hasHolidays){
  const want = new Set(DT_COLUMNS.filter(c => (cfg.cols[c.key] !== undefined ? cfg.cols[c.key] : c.on) && !(c.needsHol && !hasHolidays)).map(c => c.key));
  const added = new Set();
  DT_COLUMNS.forEach(c => {
    if (!want.has(c.key) || !c.sortBy) return;
    const t = SORT_TARGET[c.sortBy] ? SORT_TARGET[c.sortBy](cfg) : c.sortBy;
    if (!want.has(t)) { want.add(t); added.add(t); }
  });
  return DT_COLUMNS.filter(c => want.has(c.key)).map(c => Object.assign({}, c, {
    sortTarget: c.sortBy ? (SORT_TARGET[c.sortBy] ? SORT_TARGET[c.sortBy](cfg) : c.sortBy) : null,
    hidden: !!c.hide || added.has(c.key), auto: added.has(c.key)
  }));
}
function colName(key){ return DT_COLUMNS.find(c => c.key === key).name; }

/* ---------- one row, for the preview ---------- */
function rowValues(dt, cfg, holMap, today){
  const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1;
  const dow = dow1(dt, cfg.weekStart);
  const fsy = fiscalStartYear(dt, cfg.fyStart), fy = fyNumber(fsy, cfg);
  const fm = (m - cfg.fyStart + 12) % 12 + 1;
  const thu = addDays(dt, 3 - ((dt.getUTCDay() + 6) % 7));
  const jan1 = D(y, 1, 1), jan1dow = dow1(jan1, cfg.weekStart);
  const c = { dt, y, m, q: Math.ceil(m / 3), dow, fsy, fy, fm, fq: Math.ceil(fm / 3), today,
    fyLabel: fyLabel(fsy, cfg), isoWk: Math.floor((Math.round((thu - D(thu.getUTCFullYear(), 1, 1)) / DAY)) / 7) + 1, isoYr: thu.getUTCFullYear(),
    wk: Math.floor((Math.round((dt - jan1) / DAY) + jan1dow - 1) / 7) + 1,
    weekend: (cfg.weekend || []).includes(dt.getUTCDay()), hol: holMap.get(ymd(dt)) || null,
    todayFy: fyNumber(fiscalStartYear(today, cfg.fyStart), cfg), mfStyle: cfg.monthFilterStyle };
  return c;
}
function fyLabel(fsy, cfg){
  const fy = fyNumber(fsy, cfg), fey = cfg.fyStart > 1 ? fsy + 1 : fsy;
  if (cfg.fyStyle === 'short') return 'FY' + String(fy).slice(-2);
  if (cfg.fyStyle === 'span') return cfg.fyStart > 1 ? fsy + '-' + String(fey).slice(-2) : String(fsy);
  return 'FY' + fy;
}

/* ---------- code: shared pieces ---------- */
function daxStr(s){ return '"' + String(s).replace(/"/g, '""') + '"'; }
function mStr(s){ return '"' + String(s).replace(/"/g, '""') + '"'; }
function mName(s){ return /^[A-Za-z_][A-Za-z0-9_]*$/.test(s) ? s : '#"' + s.replace(/"/g, '""') + '"'; }
function fyLabelDax(cfg){
  if (cfg.fyStyle === 'short') return '"FY" & RIGHT ( _fy, 2 )';
  if (cfg.fyStyle === 'span') return cfg.fyStart > 1 ? '_fsy & "-" & RIGHT ( _fsy + 1, 2 )' : 'FORMAT ( _fsy, "0" )';
  return '"FY" & _fy';
}
function fyLabelM(cfg){
  if (cfg.fyStyle === 'short') return '"FY" & Text.End(Text.From(fy), 2)';
  if (cfg.fyStyle === 'span') return cfg.fyStart > 1 ? 'Text.From(fsy) & "-" & Text.End(Text.From(fsy + 1), 2)' : 'Text.From(fsy)';
  return '"FY" & Text.From(fy)';
}
function fill(expr, cfg, lang, hasHolidays){
  const hol = hasHolidays;
  return expr
    .replace(/\{FYLABEL_DAX\}/g, fyLabelDax(cfg)).replace(/\{FYLABEL_M\}/g, fyLabelM(cfg))
    .replace('{WEEKNUM}', cfg.weekStart === 'sun' ? '1' : '2').replace('{MDAY}', cfg.weekStart === 'sun' ? 'Day.Sunday' : 'Day.Monday')
    .replace('{WORKDAY_DAX}', hol ? 'NOT _weekend && ISBLANK ( _hol )' : 'NOT _weekend').replace('{WORKDAY_M}', hol ? 'not weekend and hol = null' : 'not weekend')
    .replace('{MF_DAX}', 'IF ( _y = YEAR ( _today ) && _m = MONTH ( _today ), "Current", FORMAT ( _d, "' + (cfg.monthFilterStyle === 'short' ? 'mmm' : 'mmmm') + '" ) & "-" & _y )')
    .replace('{MF_M}', 'if y = Date.Year(Today) and m = Date.Month(Today) then "Current" else ' + (cfg.monthFilterStyle === 'short' ? 'Text.Start(Date.MonthName(d, "en-US"), 3)' : 'Date.MonthName(d, "en-US")') + ' & "-" & Text.From(y)')
    .replace('{TODAY_FY_DAX}', '( YEAR ( _today ) - IF ( MONTH ( _today ) < ' + cfg.fyStart + ', 1, 0 )' + (cfg.fyStart > 1 && cfg.fyNaming === 'end' ? ' + 1' : '') + ' )');
}
function weekendDax(cfg){ // WEEKDAY(d,1): Sunday=1..Saturday=7
  const w = (cfg.weekend || []).map(x => x + 1).sort();
  return w.length ? 'WEEKDAY ( _d, 1 ) IN { ' + w.join(', ') + ' }' : 'FALSE ()';
}
function weekendM(cfg){ // Date.DayOfWeek(d, Day.Sunday): Sunday=0..Saturday=6
  const w = (cfg.weekend || []).slice().sort();
  return w.length ? 'List.Contains({' + w.join(', ') + '}, Date.DayOfWeek(d, Day.Sunday))' : 'false';
}

/* ---------- DAX calculated table ---------- */
function daxCode(cfg, today){
  const r = computeRange(cfg, today);
  const plan = holidayPlan(cfg);
  const hols = plan.any ? holidaysFor(cfg, r, today) : [];
  if (plan.any && !hols.length) hols.push(null);
  const cols = outputColumns(cfg, hols.length > 0);
  const rel = cols.some(c => c.rel);
  const L = [];
  L.push(describeRange(cfg, r));
  L.push('// Made with the Date Table Generator. Fiscal year starts in ' + MONTHS[cfg.fyStart - 1] + '.');
  if (rel) L.push('VAR _today = TODAY ()');
  const fallback = 'DATE ( ' + r.start.getUTCFullYear() + ', ' + (r.start.getUTCMonth() + 1) + ', ' + r.start.getUTCDate() + ' )';
  const sc = parseStartCols(cfg.startCols).cols;
  if (r.usesData && sc.length && r.endFromData) {
    L.push('// Latest date in your data');
    L.push('VAR _last = ' + (sc.length === 1 ? 'MAX ( ' + daxColRef(sc[0]) + ' )' : 'MAXX ( { ' + sc.map(x => 'MAX ( ' + daxColRef(x) + ' )').join(', ') + ' }, [Value] )'));
  }
  if (r.fromData && sc.length) {
    L.push(cfg.startSnap === 'year' ? '// Start at the beginning of the ' + (r.fiscal ? 'fiscal ' : '') + 'year that holds the earliest date in your data' : '// Start on the earliest date in your data');
    L.push('VAR _first = ' + (sc.length === 1 ? 'MIN ( ' + daxColRef(sc[0]) + ' )' : 'MINX ( { ' + sc.map(x => 'MIN ( ' + daxColRef(x) + ' )').join(', ') + ' }, [Value] )'));
    L.push('VAR _start =');
    L.push('    IF (');
    L.push('        ISBLANK ( _first ),');
    L.push('        ' + fallback + ',');
    L.push('        ' + (cfg.startSnap !== 'year' ? 'DATE ( YEAR ( _first ), MONTH ( _first ), DAY ( _first ) )' : r.fiscal ? 'DATE ( YEAR ( _first ) - IF ( MONTH ( _first ) < ' + cfg.fyStart + ', 1, 0 ), ' + cfg.fyStart + ', 1 )' : 'DATE ( YEAR ( _first ), 1, 1 )'));
    L.push('    )');
  } else L.push('VAR _start = ' + fallback);
  if (cfg.endMode === 'rolling') {
    if (r.fiscal) {
      L.push('// End of the fiscal year that is ' + cfg.rollYears + ' after the current one');
      L.push('VAR _end = DATE ( YEAR ( TODAY () ) - IF ( MONTH ( TODAY () ) < ' + cfg.fyStart + ', 1, 0 ) + ' + (cfg.rollYears + 1) + ', ' + cfg.fyStart + ', 1 ) - 1');
    } else L.push('VAR _end = DATE ( YEAR ( TODAY () ) + ' + cfg.rollYears + ', 12, 31 )');
  } else if (cfg.endMode === 'today') L.push('VAR _end = TODAY ()');
  else if (cfg.endMode === 'yesterday') L.push('VAR _end = TODAY () - 1');
  else if (r.endFromData && sc.length) {
    const fb = 'DATE ( ' + r.end.getUTCFullYear() + ', ' + (r.end.getUTCMonth() + 1) + ', ' + r.end.getUTCDate() + ' )';
    const snap = cfg.endSnap === 'exact' ? 'DATE ( YEAR ( _last ), MONTH ( _last ), DAY ( _last ) )'
      : r.fiscal ? 'DATE ( YEAR ( _last ) - IF ( MONTH ( _last ) < ' + cfg.fyStart + ', 1, 0 ) + 1, ' + cfg.fyStart + ', 1 ) - 1' : 'DATE ( YEAR ( _last ), 12, 31 )';
    L.push('// End ' + (cfg.endSnap === 'exact' ? 'on the latest date' : 'at the end of the ' + (r.fiscal ? 'fiscal ' : '') + 'year that holds the latest date'));
    L.push('VAR _end =');
    L.push('    IF (');
    L.push('        ISBLANK ( _last ),');
    L.push('        ' + fb + ',');
    L.push('        ' + snap);
    L.push('    )');
  }
  else L.push('VAR _end = DATE ( ' + r.end.getUTCFullYear() + ', ' + (r.end.getUTCMonth() + 1) + ', ' + r.end.getUTCDate() + ' )');
  if (hols.length) holidaysDax(plan).forEach(l => L.push(l));
  L.push('RETURN');
  L.push('    GENERATE (');
  L.push(r.dynamic ? '        CALENDAR ( _start, MAX ( _start, _end ) ),' : '        CALENDAR ( _start, _end ),');
  L.push('        VAR _d = [Date]');
  L.push('        VAR _y = YEAR ( _d )');
  L.push('        VAR _m = MONTH ( _d )');
  L.push('        VAR _q = QUARTER ( _d )');
  L.push('        VAR _dow = WEEKDAY ( _d, ' + (cfg.weekStart === 'sun' ? 1 : 2) + ' )');
  L.push('        VAR _fsy = _y - IF ( _m < ' + cfg.fyStart + ', 1, 0 )');
  L.push('        VAR _fy = _fsy' + (cfg.fyStart > 1 && cfg.fyNaming === 'end' ? ' + 1' : ''));
  L.push('        VAR _fm = MOD ( _m - ' + cfg.fyStart + ' + 12, 12 ) + 1');
  L.push('        VAR _fq = QUOTIENT ( _fm - 1, 3 ) + 1');
  L.push('        VAR _weekend = ' + weekendDax(cfg));
  if (hols.length) L.push('        VAR _hol = CONCATENATEX ( FILTER ( _holidays, [HolidayDate] = _d ), [HolidayName], " / ", [Seq], ASC )');
  L.push('        RETURN');
  L.push('            ROW (');
  cols.forEach((c, i) => L.push('                ' + daxStr(c.name) + ', ' + fill(c.dax, cfg, 'dax', hols.length > 0) + (i < cols.length - 1 ? ',' : '')));
  L.push('            )');
  L.push('    )');
  return { code: L.join('\n'), cols, range: r, holidays: hols.filter(Boolean) };
}

/* ---------- M query ---------- */
const M_TYPE = { date: 'date', int: 'Int64.Type', text: 'text', bool: 'logical' };
function mCode(cfg, today){
  const r = computeRange(cfg, today);
  const plan = holidayPlan(cfg);
  const hols = plan.any ? holidaysFor(cfg, r, today) : [];
  if (plan.any && !hols.length) hols.push(null);
  const cols = outputColumns(cfg, hols.length > 0);
  const rel = cols.some(c => c.rel);
  const needsToday = rel || ['rolling', 'today', 'yesterday'].includes(cfg.endMode);
  const L = [];
  L.push(describeRange(cfg, r));
  L.push('// Made with the Date Table Generator. Fiscal year starts in ' + MONTHS[cfg.fyStart - 1] + '.');
  L.push('let');
  if (needsToday) L.push('    Today = Date.From(DateTime.LocalNow()),');
  L.push('    FiscalStartMonth = ' + cfg.fyStart + ',');
  if (rel && cols.some(c => c.key === 'fyOffset')) L.push('    TodayFiscalYear = Date.Year(Today) - (if Date.Month(Today) < FiscalStartMonth then 1 else 0)' + (cfg.fyStart > 1 && cfg.fyNaming === 'end' ? ' + 1' : '') + ',');
  const mFallback = '#date(' + r.start.getUTCFullYear() + ', ' + (r.start.getUTCMonth() + 1) + ', ' + r.start.getUTCDate() + ')';
  const msc = parseStartCols(cfg.startCols).cols;
  if (r.usesData && msc.length) {
    L.push('    // Date columns from your data (query name, then column)');
    L.push('    DataDates = {' + msc.map(x => 'List.Buffer(Table.Column(' + mName(x.table) + ', ' + mStr(x.column) + '))').join(', ') + '},');
  }
  if (r.fromData && msc.length) {
    L.push(cfg.startSnap === 'year' ? '    // Start at the beginning of the ' + (r.fiscal ? 'fiscal ' : '') + 'year that holds the earliest date' : '    // Start on the earliest date');
    L.push('    FirstValue = List.Min(List.Transform(DataDates, each List.Min(_))),');
    L.push('    FirstDate = if FirstValue = null then null else Date.From(FirstValue),');
    L.push('    StartDate = if FirstDate = null then ' + mFallback + ' else ' + (cfg.startSnap !== 'year' ? 'FirstDate' : r.fiscal ? '#date(Date.Year(FirstDate) - (if Date.Month(FirstDate) < FiscalStartMonth then 1 else 0), FiscalStartMonth, 1)' : '#date(Date.Year(FirstDate), 1, 1)') + ',');
  } else L.push('    StartDate = ' + mFallback + ',');
  if (cfg.endMode === 'rolling') {
    if (r.fiscal) L.push('    // End of the fiscal year that is ' + cfg.rollYears + ' after the current one\n    EndDate = Date.AddDays(#date(Date.Year(Today) - (if Date.Month(Today) < FiscalStartMonth then 1 else 0) + ' + (cfg.rollYears + 1) + ', FiscalStartMonth, 1), -1),');
    else L.push('    EndDate = #date(Date.Year(Today) + ' + cfg.rollYears + ', 12, 31),');
  } else if (cfg.endMode === 'today') L.push('    EndDate = Today,');
  else if (cfg.endMode === 'yesterday') L.push('    EndDate = Date.AddDays(Today, -1),');
  else if (r.endFromData && msc.length) {
    const fb = '#date(' + r.end.getUTCFullYear() + ', ' + (r.end.getUTCMonth() + 1) + ', ' + r.end.getUTCDate() + ')';
    const snap = cfg.endSnap === 'exact' ? 'LastDate'
      : r.fiscal ? 'Date.AddDays(#date(Date.Year(LastDate) - (if Date.Month(LastDate) < FiscalStartMonth then 1 else 0) + 1, FiscalStartMonth, 1), -1)' : '#date(Date.Year(LastDate), 12, 31)';
    L.push('    // End ' + (cfg.endSnap === 'exact' ? 'on the latest date' : 'at the end of the ' + (r.fiscal ? 'fiscal ' : '') + 'year that holds the latest date'));
    L.push('    LastValue = List.Max(List.Transform(DataDates, each List.Max(_))),');
    L.push('    LastDate = if LastValue = null then null else Date.From(LastValue),');
    L.push('    EndDate = if LastDate = null then ' + fb + ' else ' + snap + ',');
  }
  else L.push('    EndDate = #date(' + r.end.getUTCFullYear() + ', ' + (r.end.getUTCMonth() + 1) + ', ' + r.end.getUTCDate() + '),');
  if (hols.length) holidaysM(plan).forEach(l => L.push(l));
  L.push(r.dynamic ? '    Dates = List.Dates(StartDate, List.Max({Duration.Days(EndDate - StartDate) + 1, 1}), #duration(1, 0, 0, 0)),' : '    Dates = List.Dates(StartDate, Duration.Days(EndDate - StartDate) + 1, #duration(1, 0, 0, 0)),');
  L.push('    Rows = List.Transform(Dates, (d) =>');
  L.push('        let');
  L.push('            y = Date.Year(d),');
  L.push('            m = Date.Month(d),');
  L.push('            q = Date.QuarterOfYear(d),');
  L.push('            dow = Date.DayOfWeek(d, ' + (cfg.weekStart === 'sun' ? 'Day.Sunday' : 'Day.Monday') + ') + 1,');
  L.push('            fsy = y - (if m < FiscalStartMonth then 1 else 0),');
  L.push('            fy = fsy' + (cfg.fyStart > 1 && cfg.fyNaming === 'end' ? ' + 1' : '') + ',');
  L.push('            fm = Number.Mod(m - FiscalStartMonth + 12, 12) + 1,');
  L.push('            fq = Number.IntegerDivide(fm - 1, 3) + 1,');
  L.push('            weekend = ' + weekendM(cfg) + (hols.length ? ',' : ''));
  if (hols.length) L.push('            hol = Record.FieldOrDefault(Holidays, Date.ToText(d, [Format = "yyyy-MM-dd", Culture = "en-US"]), null)');
  L.push('        in');
  L.push('            [');
  L.push('                Date = d,');
  cols.forEach((c, i) => L.push('                ' + mName(c.name) + ' = ' + fill(c.m, cfg, 'm', hols.length > 0) + (i < cols.length - 1 ? ',' : '')));
  L.push('            ]),');
  L.push('    Result = Table.FromRecords(Rows, type table [');
  const types = [['Date', 'date']].concat(cols.map(c => [c.name, c.type === 'text' && c.key === 'holidayName' ? 'nullable text' : M_TYPE[c.type]]));
  types.forEach(([n, t], i) => L.push('        ' + mName(n) + ' = ' + t + (i < types.length - 1 ? ',' : '')));
  L.push('    ])');
  L.push('in');
  L.push('    Result');
  return { code: L.join('\n'), cols, range: r, holidays: hols.filter(Boolean) };
}
// Holidays for the preview and checks: the range's years (rolling ranges: 5 more years)
function holidaysFor(cfg, r, today){
  const last = r.dynamic ? r.endYear + 5 : r.end.getUTCFullYear();
  return buildHolidays(cfg, r.start.getUTCFullYear() - (r.fromData ? 30 : 0), last + (r.endFromData ? 30 : 0)).filter(h => (r.fromData || h.date >= r.start) && (r.dynamic || h.date <= r.end));
}

/* ---------- holidays as rules in the code (nothing hard-coded except one-off dates) ---------- */
// Rows in the same order buildHolidays uses, so names on a shared date join the same way
function holidayPlan(cfg){
  const picked = cfg.country === 'us' ? US_HOLIDAYS.filter(h => cfg.holidays[h.key] !== undefined ? cfg.holidays[h.key] : h.on) : [];
  const custom = parseCustomHolidays(cfg.custom).list;
  const yearly = [], once = []; let k = 1;
  picked.forEach(h => { yearly.push({ h, k: k++ }); if (cfg.observed && h.fixed) yearly.push({ h, obs: true, k: k++ }); });
  custom.forEach(c => { if (c.year === null) yearly.push({ c, k: k++ }); else once.push({ c, k: k++ }); });
  return { yearly, once, any: yearly.length > 0 || once.length > 0, easter: yearly.some(r => r.h && r.h.spec.k === 'easter') };
}
function ruleDax(s){
  const first = 'DATE ( _hy, ' + s.m + ', 1 )';
  if (s.k === 'fixed') return 'DATE ( _hy, ' + s.m + ', ' + s.d + ' )';
  if (s.k === 'nth') { const add = 7 * (s.n - 1) + (s.plus || 0); return first + ' + MOD ( ' + (s.wd + 1) + ' - WEEKDAY ( ' + first + ', 1 ) + 7, 7 )' + (add ? ' + ' + add : ''); }
  if (s.k === 'last') { const e = 'EOMONTH ( ' + first + ', 0 )'; return e + ' - MOD ( WEEKDAY ( ' + e + ', 1 ) - ' + (s.wd + 1) + ' + 7, 7 )'; }
  if (s.k === 'easter') return '_easter ' + (s.off < 0 ? '- ' + -s.off : '+ ' + s.off);
}
function ruleM(s){
  if (s.k === 'fixed') return '#date(y, ' + s.m + ', ' + s.d + ')';
  if (s.k === 'nth') { const x = 'NthWeekday(y, ' + s.m + ', ' + s.wd + ', ' + s.n + ')'; return s.plus ? 'Date.AddDays(' + x + ', ' + s.plus + ')' : x; }
  if (s.k === 'last') return 'LastWeekday(y, ' + s.m + ', ' + s.wd + ')';
  if (s.k === 'easter') return 'Date.AddDays(Easter(y), ' + s.off + ')';
}
function daxDateLit(y, m, d){ return 'DATE ( ' + y + ', ' + m + ', ' + d + ' )'; }
function daxUnion(parts, ind){
  if (parts.length === 1) return parts[0];
  return 'UNION (\n' + parts.map((p, i) => ind + '    ' + p + (i < parts.length - 1 ? ',' : '')).join('\n') + '\n' + ind + ')';
}
function holidaysDax(plan){
  const L = [];
  const I = '                            ';
  const rows = plan.yearly.map(r => {
    let expr, name;
    if (r.c) { expr = 'DATE ( _hy, ' + r.c.month + ', ' + r.c.day + ' )'; name = r.c.name; }
    else {
      const base = ruleDax(r.h.spec);
      expr = r.obs ? 'SWITCH ( WEEKDAY ( ' + base + ', 1 ), 7, ' + base + ' - 1, 1, ' + base + ' + 1 )' : base;
      if (r.h.from) expr = 'IF ( _hy >= ' + r.h.from + ', ' + expr + ' )';
      name = r.h.name + (r.obs ? ' (observed)' : '');
    }
    return 'ROW ( "HolidayDate", ' + expr + ', "HolidayName", ' + daxStr(name) + ', "Seq", _hy * 100 + ' + r.k + ' )';
  });
  const parts = [];
  if (rows.length) {
    const easter = plan.easter ? [
      'VAR _a = MOD ( _hy, 19 )', 'VAR _b = INT ( _hy / 100 )', 'VAR _c = MOD ( _hy, 100 )', 'VAR _e = MOD ( _b, 4 )',
      'VAR _g = INT ( ( _b - INT ( ( _b + 8 ) / 25 ) + 1 ) / 3 )', 'VAR _h = MOD ( 19 * _a + _b - INT ( _b / 4 ) - _g + 15, 30 )',
      'VAR _l = MOD ( 32 + 2 * _e + 2 * INT ( _c / 4 ) - _h - MOD ( _c, 4 ), 7 )', 'VAR _n = _h + _l - 7 * INT ( ( _a + 11 * _h + 22 * _l ) / 451 ) + 114',
      'VAR _easter = DATE ( _hy, INT ( _n / 31 ), MOD ( _n, 31 ) + 1 )'] : [];
    const gen = ['SELECTCOLUMNS (',
      '            FILTER (',
      '                GENERATE (',
      '                    GENERATESERIES ( YEAR ( _start ) - 1, YEAR ( _end ) + 1, 1 ),',
      '                    VAR _hy = [Value]']
      .concat(easter.map(v => '                    ' + v))
      .concat(['                    RETURN',
      '                        ' + daxUnion(rows, '                        '),
      '                ),',
      '                NOT ISBLANK ( [HolidayDate] )',
      '            ),',
      '            "HolidayDate", [HolidayDate],',
      '            "HolidayName", [HolidayName],',
      '            "Seq", [Seq]',
      '        )']).join('\n');
    parts.push(gen);
  }
  plan.once.forEach(r => parts.push('ROW ( "HolidayDate", ' + daxDateLit(r.c.year, r.c.month, r.c.day) + ', "HolidayName", ' + daxStr(r.c.name) + ', "Seq", ' + (r.c.year * 100 + r.k) + ' )'));
  L.push('// Holidays: worked out from rules for every year in the range, so they keep up as the dates move');
  L.push('VAR _holidays =');
  L.push('    ' + daxUnion(parts, '    '));
  return L;
}
function holidaysM(plan){
  const L = [];
  const specs = plan.yearly.filter(r => r.h).map(r => r.h.spec.k);
  L.push('    // Holidays: worked out from rules for every year in the range, so they keep up as the dates move');
  if (specs.includes('nth')) L.push('    NthWeekday = (y as number, m as number, wd as number, n as number) as date =>\n        let First = #date(y, m, 1) in Date.AddDays(First, Number.Mod(wd - Date.DayOfWeek(First, Day.Sunday) + 7, 7) + (n - 1) * 7),');
  if (specs.includes('last')) L.push('    LastWeekday = (y as number, m as number, wd as number) as date =>\n        let Last = Date.EndOfMonth(#date(y, m, 1)) in Date.AddDays(Last, -Number.Mod(Date.DayOfWeek(Last, Day.Sunday) - wd + 7, 7)),');
  if (plan.yearly.some(r => r.obs)) L.push('    Observed = (d as date) as nullable date =>\n        let w = Date.DayOfWeek(d, Day.Sunday) in if w = 6 then Date.AddDays(d, -1) else if w = 0 then Date.AddDays(d, 1) else null,');
  if (plan.easter) L.push(['    Easter = (y as number) as date =>', '        let',
    '            a = Number.Mod(y, 19), b = Number.IntegerDivide(y, 100), c = Number.Mod(y, 100), e = Number.Mod(b, 4),',
    '            g = Number.IntegerDivide(b - Number.IntegerDivide(b + 8, 25) + 1, 3),',
    '            h = Number.Mod(19 * a + b - Number.IntegerDivide(b, 4) - g + 15, 30),',
    '            l = Number.Mod(32 + 2 * e + 2 * Number.IntegerDivide(c, 4) - h - Number.Mod(c, 4), 7),',
    '            n = h + l - 7 * Number.IntegerDivide(a + 11 * h + 22 * l, 451) + 114',
    '        in', '            #date(y, Number.IntegerDivide(n, 31), Number.Mod(n, 31) + 1),'].join('\n'));
  const rows = plan.yearly.map(r => {
    let expr, name;
    if (r.c) { expr = '#date(y, ' + r.c.month + ', ' + r.c.day + ')'; name = r.c.name; }
    else {
      const base = ruleM(r.h.spec);
      expr = r.obs ? 'Observed(' + base + ')' : base;
      if (r.h.from) expr = 'if y >= ' + r.h.from + ' then ' + expr + ' else null';
      name = r.h.name + (r.obs ? ' (observed)' : '');
    }
    return '{' + expr + ', ' + mStr(name) + ', y * 100 + ' + r.k + '}';
  });
  const once = plan.once.map(r => '{#date(' + r.c.year + ', ' + r.c.month + ', ' + r.c.day + '), ' + mStr(r.c.name) + ', ' + (r.c.year * 100 + r.k) + '}');
  const parts = [];
  if (rows.length) parts.push('List.Combine(List.Transform({Date.Year(StartDate) - 1 .. Date.Year(EndDate) + 1}, (y) => {\n' + rows.map((x, i) => '            ' + x + (i < rows.length - 1 ? ',' : '')).join('\n') + '\n        }))');
  if (once.length) parts.push('{\n' + once.map((x, i) => '            ' + x + (i < once.length - 1 ? ',' : '')).join('\n') + '\n        }');
  L.push('    HolidayRows = ' + parts.join(' & ') + ',');
  L.push('    HolidayTable = Table.SelectRows(Table.FromRows(HolidayRows, type table [HolidayDate = nullable date, HolidayName = text, Seq = number]), each [HolidayDate] <> null),');
  L.push('    HolidayGroups = Table.Group(HolidayTable, {"HolidayDate"}, {{"Names", each Text.Combine(Table.Sort(_, {"Seq"})[HolidayName], " / "), type text}}),');
  L.push('    Holidays = Record.FromList(HolidayGroups[Names], List.Transform(HolidayGroups[HolidayDate], each Date.ToText(_, [Format = "yyyy-MM-dd", Culture = "en-US"]))),');
  return L;
}

/* ---------- TMDL script ---------- */
function tmdlName(s){ return /^[A-Za-z_][A-Za-z0-9_]*$/.test(s) ? s : "'" + s.replace(/'/g, "''") + "'"; }
const TMDL_TYPE = { date: 'dateTime', int: 'int64', text: 'string', bool: 'boolean' };
function tmdlScript(cfg, lang, today){
  const g = lang === 'dax' ? daxCode(cfg, today) : mCode(cfg, today);
  const t = cfg.tableName || 'Date';
  const L = ['createOrReplace', '', '\ttable ' + tmdlName(t), '\t\tdataCategory: Time', ''];
  const all = [{ key: 'date', name: 'Date', type: 'date', hidden: false, sortTarget: null }].concat(g.cols);
  all.forEach(c => {
    L.push('\t\tcolumn ' + tmdlName(c.name));
    L.push('\t\t\tdataType: ' + TMDL_TYPE[c.type]);
    if (lang === 'dax') L.push('\t\t\tisDataTypeInferred');
    if (c.key === 'date') L.push('\t\t\tisKey');
    if (c.type === 'date') L.push('\t\t\tformatString: Short Date');
    if (c.type === 'int') L.push('\t\t\tformatString: 0');
    if (c.hidden) L.push('\t\t\tisHidden');
    L.push('\t\t\tsummarizeBy: none');
    if (lang === 'dax') { L.push('\t\t\tisNameInferred'); L.push('\t\t\tsourceColumn: [' + c.name + ']'); }
    else L.push('\t\t\tsourceColumn: ' + c.name);
    if (c.sortTarget) L.push('\t\t\tsortByColumn: ' + tmdlName(colName(c.sortTarget)));
    L.push('');
  });
  L.push('\t\tpartition ' + tmdlName(t) + ' = ' + (lang === 'dax' ? 'calculated' : 'm'));
  L.push('\t\t\tmode: import');
  L.push('\t\t\tsource =');
  g.code.split('\n').forEach(l => L.push('\t\t\t\t' + l));
  L.push('');
  return Object.assign({}, g, { code: L.join('\n') });
}
/*DT-CORE-END*/
