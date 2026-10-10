
/*TI-CORE-START*/
/* ---------- Time Intelligence Builder: measures or a calculation group, as TMDL ----------
   Follows SQLBI's DAX Patterns, Standard time-related calculations (daxpatterns.com):
   - a hidden DateWithSales column on the date table ('Date'[Date] <= MAX ( <fact date> )) and a hidden
     ShowValueForDates measure (blank for periods after the last date with data);
   - YTD/QTD/MTD with DATESYTD/DATESQTD/DATESMTD, previous periods with DATEADD limited to DateWithSales,
     PYC with PREVIOUSYEAR, MAT with DATESINPERIOD, AVG 3M averaging the days of the last 3 months;
   - growth: current and previous both non-blank, then DIVIDE by the previous value. */
const TI_DWS = 'DateWithSales', TI_SVD = 'ShowValueForDates';
const I4 = s => s.split('\n').map(l => l ? '    ' + l : l).join('\n');
// NAME ( a, b ) on one line when short, otherwise one argument per line
function tiFn(name, args){
  const one = name + ' ( ' + args.join(', ') + ' )';
  return !args.some(a => a.includes('\n')) && one.length <= 72 ? one : name + ' (\n' + args.map(I4).join(',\n') + '\n)';
}
function tiVar(name, expr){ return 'VAR ' + name + (expr.includes('\n') || expr.length > 60 ? ' =\n' + I4(expr) : ' = ' + expr); }
function tiDateRef(cfg){ return qName(cfg.dateTable) + bracket(cfg.dateColumn); }
function tiDataRef(cfg){ const p = (cfg.dataDate || '').split('|'); return p.length === 2 && p[0] && p[1] ? qName(p[0]) + bracket(p[1]) : ''; }
function tiFy(cfg){
  const m = +cfg.fyEnd || 12;
  return m === 12 ? '' : ', "' + String(m).padStart(2, '0') + '-' + TI_LAST_DAY[m - 1] + '"';
}
// the building blocks, each a CALCULATE over a time intelligence filter (no ShowValueForDates guard)
function tiBlocks(cfg, m){
  const d = tiDateRef(cfg), fy = tiFy(cfg), dws = qName(cfg.dateTable) + bracket(TI_DWS) + ' = TRUE';
  const shift = (n, unit) => tiFn('CALCULATETABLE', ['DATEADD ( ' + d + ', ' + n + ', ' + unit + ' )', dws]);
  const ytd = tiFn('CALCULATE', [m, 'DATESYTD ( ' + d + fy + ' )']);
  const mtd = tiFn('CALCULATE', [m, 'DATESMTD ( ' + d + ' )']);
  const qtd = tiFn('CALCULATE', [m, 'DATESQTD ( ' + d + ' )']);
  return {
    sv: tiSv(cfg), cur: m, ytd, mtd, qtd,
    py: tiFn('CALCULATE', [m, shift(-1, 'YEAR')]),
    pyc: tiFn('CALCULATE', [m, 'PREVIOUSYEAR ( ' + d + fy + ' )']),
    pytd: tiFn('CALCULATE', [ytd, shift(-1, 'YEAR')]),
    pm: tiFn('CALCULATE', [m, shift(-1, 'MONTH')]),
    pmc: tiFn('CALCULATE', [m, 'PARALLELPERIOD ( ' + d + ', -1, MONTH )']),
    pmtd: tiFn('CALCULATE', [mtd, shift(-1, 'MONTH')]),
    pqtd: tiFn('CALCULATE', [qtd, shift(-1, 'QUARTER')]),
    pymtd: tiFn('CALCULATE', [mtd, shift(-1, 'YEAR')]),
    mat: tiFn('CALCULATE', [m, 'DATESINPERIOD ( ' + d + ', MAX ( ' + d + ' ), -1, YEAR )'])
  };
}
// In a calculation group a measure reference would get the calculation item applied too,
// so the items test ShowValueForDates' condition inline instead of calling the measure.
function tiSv(cfg){ return cfg.output === 'group' ? 'MIN ( ' + tiDateRef(cfg) + ' ) <= ' + tiFn('CALCULATE', ['MAX ( ' + tiDataRef(cfg) + ' )', 'REMOVEFILTERS ()']) : '[' + TI_SVD + ']'; }
const tiGuard = (b, e) => tiFn('IF', [b.sv, e]);
// growth, as in the pattern's YOY / YOY % measures
function tiGrowth(cur, prev, pct, sv){
  const diff = tiFn('IF', ['NOT ISBLANK ( ValueCurrentPeriod ) && NOT ISBLANK ( ValuePreviousPeriod )', 'ValueCurrentPeriod - ValuePreviousPeriod']);
  const L = [tiVar('ValueCurrentPeriod', cur), tiVar('ValuePreviousPeriod', prev)];
  if (pct) L.push(tiVar('Growth', diff), tiVar('Result', sv ? tiFn('IF', [sv, 'DIVIDE ( Growth, ValuePreviousPeriod )']) : 'DIVIDE ( Growth, ValuePreviousPeriod )'));
  else L.push(tiVar('Result', sv ? tiFn('IF', [sv, diff]) : diff));
  return L.concat('RETURN', '    Result').join('\n');
}
// the pattern's Sales AVG 3M: the average of the days with data in the 3 months to `last`
function tiAvg3m(cfg, m, last, pre){
  const d = tiDateRef(cfg), f = tiDataRef(cfg), dws = qName(cfg.dateTable) + bracket(TI_DWS) + ' = TRUE';
  return (pre || []).concat([
    tiVar('Period3M', tiFn('CALCULATETABLE', ['DATESINPERIOD ( ' + d + ', ' + last + ', -3, MONTH )', dws])),
    tiVar('FirstDayWithData', tiFn('CALCULATE', ['MIN ( ' + f + ' )', 'REMOVEFILTERS ()'])),
    tiVar('FirstDayInPeriod', 'MINX ( Period3M, ' + d + ' )'),
    tiVar('Result', tiFn('IF', ['FirstDayWithData <= FirstDayInPeriod', 'AVERAGEX ( Period3M, ' + m + ' )'])),
    'RETURN', '    Result']).join('\n');
}
// Every date in the filter: the pattern's measures as they are
const TI_CALCS = [
  { key: 'ytd', name: 'YTD', kind: 'value', label: 'Year to date', f: b => tiGuard(b, b.ytd) },
  { key: 'qtd', name: 'QTD', kind: 'value', label: 'Quarter to date', f: b => tiGuard(b, b.qtd) },
  { key: 'mtd', name: 'MTD', kind: 'value', label: 'Month to date', f: b => tiGuard(b, b.mtd) },
  { key: 'pqtd', name: 'PQTD', kind: 'value', label: 'Previous quarter, quarter to date', f: b => tiGuard(b, b.pqtd) },
  { key: 'qoqp', dep: ['qtd', 'pqtd'], name: 'QOQTD %', kind: 'pct', label: 'Quarter to date vs previous quarter to date, %', f: b => tiGrowth(tiGuard(b, b.qtd), tiGuard(b, b.pqtd), true) },
  { key: 'py', name: 'PY', kind: 'value', label: 'Same period last year', f: b => tiGuard(b, b.py) },
  { key: 'pytd', name: 'PYTD', kind: 'value', label: 'Last year, year to date', f: b => tiGuard(b, b.pytd) },
  { key: 'yoy', dep: ['cur', 'py'], name: 'YOY', kind: 'value', label: 'Change on last year', f: b => tiGrowth(b.cur, tiGuard(b, b.py)) },
  { key: 'yoyp', dep: ['cur', 'py'], name: 'YOY %', kind: 'pct', label: 'Change on last year, %', f: b => tiGrowth(b.cur, tiGuard(b, b.py), true) },
  { key: 'ytdyoyp', dep: ['ytd', 'pytd'], name: 'YOYTD %', kind: 'pct', label: 'Year to date vs last year to date, %', f: b => tiGrowth(tiGuard(b, b.ytd), tiGuard(b, b.pytd), true) },
  { key: 'pm', name: 'PM', kind: 'value', label: 'Previous month', f: b => tiGuard(b, b.pm) },
  { key: 'momp', dep: ['cur', 'pm'], name: 'MOM %', kind: 'pct', label: 'Change on previous month, %', f: b => tiGrowth(b.cur, tiGuard(b, b.pm), true) },
  { key: 'r12', name: 'MAT', kind: 'value', label: 'Moving annual total: the 12 months to the last date', f: b => tiGuard(b, b.mat) },
  { key: 'r3avg', name: 'AVG 3M', kind: 'value', label: 'Daily average over the last 3 months', f: (b, cfg) => tiAvg3m(cfg, b.cur, 'MAX ( ' + tiDateRef(cfg) + ' )') }
];
// Latest date (the default): the same pattern measures, worked out on the last date with data in the filter,
// so a card or total shows one period. Whole previous year and month use the pattern's PYC and PMC.
function tiLatest(cfg){
  const d = tiDateRef(cfg);
  return [tiVar('LastDateWithData', tiFn('CALCULATE', ['MAX ( ' + tiDataRef(cfg) + ' )', 'REMOVEFILTERS ()'])),
    tiVar('LastVisibleDate', 'MIN ( MAX ( ' + d + ' ), LastDateWithData )')];
}
const tiAt = (cfg, e) => tiFn('CALCULATE', [e, tiDateRef(cfg) + ' = LastVisibleDate']);
function tiLatestValue(cfg, e){ return tiLatest(cfg).concat(tiVar('Result', tiFn('IF', [tiSvLatest(cfg), tiAt(cfg, e)])), 'RETURN', '    Result').join('\n'); }
function tiLatestGrowth(cfg, cur, prev, pct){ return tiLatest(cfg).join('\n') + '\n' + tiGrowth(tiAt(cfg, cur), tiAt(cfg, prev), pct, tiSvLatest(cfg)); }
// LastDateWithData is already a variable here
function tiSvLatest(cfg){ return cfg.output === 'group' ? 'MIN ( ' + tiDateRef(cfg) + ' ) <= LastDateWithData' : '[' + TI_SVD + ']'; }
const TI_CALCS_LATEST = [
  { key: 'ytd', name: 'YTD', kind: 'value', label: 'Year to the last date', f: (b, cfg) => tiLatestValue(cfg, b.ytd) },
  { key: 'qtd', name: 'QTD', kind: 'value', label: 'Quarter to the last date', f: (b, cfg) => tiLatestValue(cfg, b.qtd) },
  { key: 'mtd', name: 'MTD', kind: 'value', label: 'Month to the last date', f: (b, cfg) => tiLatestValue(cfg, b.mtd) },
  { key: 'pqtd', name: 'PQTD', kind: 'value', label: 'Previous quarter, to the same day', f: (b, cfg) => tiLatestValue(cfg, b.pqtd) },
  { key: 'qoqp', dep: ['qtd', 'pqtd'], name: 'QOQTD %', kind: 'pct', label: 'Quarter to date vs previous quarter to date, %', f: (b, cfg) => tiLatestGrowth(cfg, b.qtd, b.pqtd, true) },
  { key: 'py', name: 'PYC', kind: 'value', label: 'Previous year, whole year', f: (b, cfg) => tiLatestValue(cfg, b.pyc) },
  { key: 'pytd', name: 'PYTD', kind: 'value', label: 'Last year, to the same day', f: (b, cfg) => tiLatestValue(cfg, b.pytd) },
  { key: 'yoy', dep: ['ytd', 'pytd'], name: 'YOYTD', kind: 'value', label: 'Year to date vs last year to date', f: (b, cfg) => tiLatestGrowth(cfg, b.ytd, b.pytd) },
  { key: 'yoyp', dep: ['ytd', 'pytd'], name: 'YOYTD %', kind: 'pct', label: 'Year to date vs last year to date, %', f: (b, cfg) => tiLatestGrowth(cfg, b.ytd, b.pytd, true) },
  { key: 'pm', name: 'PMC', kind: 'value', label: 'Previous month, whole month', f: (b, cfg) => tiLatestValue(cfg, b.pmc) },
  { key: 'pmtd', name: 'PMTD', kind: 'value', label: 'Previous month, to the same day', f: (b, cfg) => tiLatestValue(cfg, b.pmtd) },
  { key: 'momp', dep: ['mtd', 'pmtd'], name: 'MOMTD %', kind: 'pct', label: 'Month to date vs the same days last month, %', f: (b, cfg) => tiLatestGrowth(cfg, b.mtd, b.pmtd, true) },
  { key: 'pymtd', name: 'PYMTD', kind: 'value', label: 'Same month last year, to the same day', f: (b, cfg) => tiLatestValue(cfg, b.pymtd) },
  { key: 'mtdyoyp', dep: ['mtd', 'pymtd'], name: 'MTD YOY %', kind: 'pct', label: 'Month to date vs same month last year, %', f: (b, cfg) => tiLatestGrowth(cfg, b.mtd, b.pymtd, true) },
  { key: 'r12', name: 'MAT', kind: 'value', label: 'Moving annual total: the 12 months to the last date', f: (b, cfg) => tiLatestValue(cfg, b.mat) },
  { key: 'r3avg', name: 'AVG 3M', kind: 'value', label: 'Daily average over the 3 months to the last date', f: (b, cfg) => tiAvg3m(cfg, b.cur, 'LastVisibleDate', tiLatest(cfg)) }
];
/* ---------- Month-based calendars: SQLBI's Month-related calculations pattern ----------
   Filters month-level columns of the date table instead of dates: Year, Month Number (in year),
   Year Month Number (sequential: Year * 12 + Month - 1) and Year Quarter Number. Missing sequential
   and fiscal columns are added as hidden calculated columns worked out from Year and Month Number. */
const TI_MCOLS = [
  { key: 'y', label: 'Year', re: /^(calendar )?year( ?number)?$/i, add: 'Year Number', fromDate: true, f: (y, mn, fe, d) => 'YEAR ( ' + d + ' )' },
  { key: 'mn', label: 'Month number', re: /^month ?(number|no\.?|num|of year|in year)$/i, add: 'Month Number', fromDate: true, f: (y, mn, fe, d) => 'MONTH ( ' + d + ' )' },
  { key: 'ymn', label: 'Year Month Number', re: /^year ?month ?(number|index|seq(uence)?)$/i, add: 'Year Month Number', f: (y, mn) => y + ' * 12 + ' + mn + ' - 1' },
  { key: 'yqn', label: 'Year Quarter Number', re: /^year ?quarter ?(number|index)$/i, add: 'Year Quarter Number', f: (y, mn) => y + ' * 4 + INT ( ( ' + mn + ' - 1 ) / 3 )' },
  { key: 'fy', label: 'Fiscal Year Number', fiscal: true, re: /^fiscal ?year ?(number)?$/i, add: 'Fiscal Year Number', f: (y, mn, fe) => y + ' + IF ( ' + mn + ' > ' + fe + ', 1, 0 )' },
  { key: 'fmn', label: 'Fiscal Month Number', fiscal: true, re: /^fiscal ?month ?(number|no\.?)$/i, add: 'Fiscal Month Number', f: (y, mn, fe) => 'MOD ( ' + mn + ' - ' + (fe + 1) + ', 12 ) + 1' }
];
const tiNumeric = c => /int|decimal|double|number|currency/i.test(c.dataType || '');
function tiMonthColsNeeded(cfg){ const fiscal = (+cfg.fyEnd || 12) !== 12; return TI_MCOLS.filter(k => !k.fiscal || fiscal); }
// the column names to use: picked, or the name of the column the script adds
function tiMonthCols(cfg){
  const o = {}, p = cfg.mcols || {};
  tiMonthColsNeeded(cfg).forEach(k => { o[k.key] = (p[k.key] || '').trim() || k.add || ''; });
  return o;
}
// a date column of the date table, to work out Year and Month number from when the table has none
function tiMonthDateCol(model, cfg){
  const cols = model.columns.filter(x => lc(x.table) === lc(cfg.dateTable) && /date/i.test(x.dataType || ''));
  const c = cols.find(x => lc(x.name) === lc(cfg.dateColumn)) || cols.find(x => x.key) || cols[0];
  return c ? c.name : '';
}
function tiMonthAdds(model, cfg){
  const p = cfg.mcols || {}, c = tiMonthCols(cfg), T = qName(cfg.dateTable), fe = +cfg.fyEnd || 12, dc = tiMonthDateCol(model, cfg);
  return tiMonthColsNeeded(cfg).filter(k => k.add && !(p[k.key] || '').trim() && !(k.fromDate && !dc) && !model.columns.some(x => lc(x.table) === lc(cfg.dateTable) && lc(x.name) === lc(k.add)))
    .map(k => ({ name: k.add, expression: k.f(T + bracket(c.y), T + bracket(c.mn), fe, T + bracket(dc)) }));
}
// Each block is { pre: the VAR lines it needs, val: its expression }. Blocks share VAR names only where
// the definition is the same, so growth measures can put both blocks' VARs in one list.
function tiMonthBlocks(cfg, m){
  const T = qName(cfg.dateTable), c = tiMonthCols(cfg), r = n => T + bracket(c[n]);
  const fiscal = (+cfg.fyEnd || 12) !== 12, yc = fiscal ? r('fy') : r('y'), miy = fiscal ? r('fmn') : r('mn');
  const rf = 'REMOVEFILTERS ( ' + T + ' )', ymn = r('ymn'), yqn = r('yqn');
  const latest = cfg.basis !== 'context', fact = qName((cfg.dataDate || '').split('|')[0] || '');
  const calc = (...f) => tiFn('CALCULATE', [m, rf].concat(f));
  const blk = (pre, val) => ({ pre, val });
  // the last month: in the filter, or (latest) the last month with data in the filter
  const lastMonth = latest ? [tiVar('LastMonthWithData', tiFn('CALCULATE', ['MAX ( ' + ymn + ' )', 'REMOVEFILTERS ()', fact])), tiVar('LastMonthAvailable', 'MIN ( MAX ( ' + ymn + ' ), LastMonthWithData )')]
    : [tiVar('LastMonthAvailable', 'MAX ( ' + ymn + ' )')];
  const at = col => latest ? tiFn('CALCULATE', ['MAX ( ' + col + ' )', rf, ymn + ' = LastMonthAvailable']) : 'MAX ( ' + col + ' )';
  const curYear = [tiVar('CurrentYearNumber', 'SELECTEDVALUE ( ' + yc + ' )'), tiVar('PreviousYearNumber', 'CurrentYearNumber - 1')];
  const range = n => lastMonth.concat(tiVar('FirstMonth' + n, 'LastMonthAvailable - ' + (n - 1)));
  return {
    cur: blk([], m),
    ytd: blk(lastMonth.concat(tiVar('LastYearAvailable', at(yc))), calc(ymn + ' <= LastMonthAvailable', yc + ' = LastYearAvailable')),
    qtd: blk(lastMonth.concat(tiVar('LastYearQuarterAvailable', at(yqn))), calc(ymn + ' <= LastMonthAvailable', yqn + ' = LastYearQuarterAvailable')),
    py: blk(curYear, calc(yc + ' = PreviousYearNumber', 'VALUES ( ' + miy + ' )')),
    pyc: blk(lastMonth.concat(tiVar('LastYearAvailable', at(yc))), calc(yc + ' = LastYearAvailable - 1')),
    pytd: latest
      ? blk(lastMonth.concat(tiVar('LastYearAvailable', at(yc)), tiVar('LastMonthInYearAvailable', at(miy))), calc(miy + ' <= LastMonthInYearAvailable', yc + ' = LastYearAvailable - 1'))
      : blk(curYear.concat(tiVar('LastMonthInYearAvailable', 'MAX ( ' + miy + ' )')), calc(miy + ' <= LastMonthInYearAvailable', yc + ' = PreviousYearNumber')),
    pm: blk([tiVar('CurrentYearMonthNumber', 'SELECTEDVALUE ( ' + ymn + ' )')], calc(ymn + ' = CurrentYearMonthNumber - 1')),
    pqtd: blk(lastMonth.concat(tiVar('LastYearQuarterAvailable', at(yqn))), calc(yqn + ' = LastYearQuarterAvailable - 1', ymn + ' <= LastMonthAvailable - 3')),
    lm: blk(lastMonth, calc(ymn + ' = LastMonthAvailable')),
    pmc: blk(lastMonth, calc(ymn + ' = LastMonthAvailable - 1')),
    mat: blk(range(12), calc(ymn + ' >= FirstMonth12', ymn + ' <= LastMonthAvailable')),
    avg3m: blk(range(3).concat(tiVar('Period3M', tiFn('FILTER', ['ALL ( ' + ymn + ' )', ymn + ' >= FirstMonth3 && ' + ymn + ' <= LastMonthAvailable']))),
      tiFn('IF', ['COUNTROWS ( Period3M ) >= 3', tiFn('CALCULATE', ['AVERAGEX ( Period3M, ' + m + ' )', rf])]))
  };
}
function tiMonthValue(b){ return b.pre.length ? b.pre.concat(tiVar('Result', b.val), 'RETURN', '    Result').join('\n') : b.val; }
function tiMonthGrowth(a, b, pct){ const pre = [...new Set(a.pre.concat(b.pre))]; return (pre.length ? pre.join('\n') + '\n' : '') + tiGrowth(a.val, b.val, pct); }
// Every month in the filter: the pattern's measures as they are
const TI_M_CALCS = [
  { key: 'ytd', name: 'YTD', kind: 'value', label: 'Year to date', f: b => tiMonthValue(b.ytd) },
  { key: 'qtd', name: 'QTD', kind: 'value', label: 'Quarter to date', f: b => tiMonthValue(b.qtd) },
  { key: 'pqtd', name: 'PQTD', kind: 'value', label: 'Previous quarter, quarter to date', f: b => tiMonthValue(b.pqtd) },
  { key: 'qoqp', dep: ['qtd', 'pqtd'], name: 'QOQTD %', kind: 'pct', label: 'Quarter to date vs previous quarter to date, %', f: b => tiMonthGrowth(b.qtd, b.pqtd, true) },
  { key: 'py', name: 'PY', kind: 'value', label: 'Same months last year', f: b => tiMonthValue(b.py) },
  { key: 'pytd', name: 'PYTD', kind: 'value', label: 'Last year, year to date', f: b => tiMonthValue(b.pytd) },
  { key: 'yoy', dep: ['cur', 'py'], name: 'YOY', kind: 'value', label: 'Change on last year', f: b => tiMonthGrowth(b.cur, b.py) },
  { key: 'yoyp', dep: ['cur', 'py'], name: 'YOY %', kind: 'pct', label: 'Change on last year, %', f: b => tiMonthGrowth(b.cur, b.py, true) },
  { key: 'ytdyoyp', dep: ['ytd', 'pytd'], name: 'YOYTD %', kind: 'pct', label: 'Year to date vs last year to date, %', f: b => tiMonthGrowth(b.ytd, b.pytd, true) },
  { key: 'pm', name: 'PM', kind: 'value', label: 'Previous month', f: b => tiMonthValue(b.pm) },
  { key: 'momp', dep: ['cur', 'pm'], name: 'MOM %', kind: 'pct', label: 'Change on previous month, %', f: b => tiMonthGrowth(b.cur, b.pm, true) },
  { key: 'r12', name: 'MAT', kind: 'value', label: 'Moving annual total: the 12 months to the last month', f: b => tiMonthValue(b.mat) },
  { key: 'r3avg', name: 'AVG 3M', kind: 'value', label: 'Monthly average over the last 3 months', f: b => tiMonthValue(b.avg3m) }
];
// Latest month with data (the default): one period on a card or total
const TI_M_CALCS_LATEST = [
  { key: 'ytd', name: 'YTD', kind: 'value', label: 'Year to the last month', f: b => tiMonthValue(b.ytd) },
  { key: 'qtd', name: 'QTD', kind: 'value', label: 'Quarter to the last month', f: b => tiMonthValue(b.qtd) },
  { key: 'pqtd', name: 'PQTD', kind: 'value', label: 'Previous quarter, to the same month', f: b => tiMonthValue(b.pqtd) },
  { key: 'qoqp', dep: ['qtd', 'pqtd'], name: 'QOQTD %', kind: 'pct', label: 'Quarter to date vs previous quarter to date, %', f: b => tiMonthGrowth(b.qtd, b.pqtd, true) },
  { key: 'py', name: 'PYC', kind: 'value', label: 'Previous year, whole year', f: b => tiMonthValue(b.pyc) },
  { key: 'pytd', name: 'PYTD', kind: 'value', label: 'Last year, to the same month', f: b => tiMonthValue(b.pytd) },
  { key: 'yoy', dep: ['ytd', 'pytd'], name: 'YOYTD', kind: 'value', label: 'Year to date vs last year to date', f: b => tiMonthGrowth(b.ytd, b.pytd) },
  { key: 'yoyp', dep: ['ytd', 'pytd'], name: 'YOYTD %', kind: 'pct', label: 'Year to date vs last year to date, %', f: b => tiMonthGrowth(b.ytd, b.pytd, true) },
  { key: 'lm', name: 'LM', kind: 'value', label: 'Last month: the latest month with data', f: b => tiMonthValue(b.lm) },
  { key: 'pm', name: 'PMC', kind: 'value', label: 'Previous month, whole month', f: b => tiMonthValue(b.pmc) },
  { key: 'momp', dep: ['lm', 'pm'], name: 'MOM %', kind: 'pct', label: 'Last month vs the month before, %', f: b => tiMonthGrowth(b.lm, b.pmc, true) },
  { key: 'r12', name: 'MAT', kind: 'value', label: 'Moving annual total: the 12 months to the last month', f: b => tiMonthValue(b.mat) },
  { key: 'r3avg', name: 'AVG 3M', kind: 'value', label: 'Monthly average over the 3 months to the last month', f: b => tiMonthValue(b.avg3m) }
];
// Step 3 groups the calculations by type
const TI_GROUPS = [
  { name: 'Period to date', keys: ['ytd', 'qtd', 'mtd', 'lm'] },
  { name: 'Previous periods', keys: ['py', 'pytd', 'pqtd', 'pm', 'pmtd', 'pymtd'] },
  { name: 'Growth', keys: ['yoy', 'yoyp', 'ytdyoyp', 'qoqp', 'momp', 'mtdyoyp'] },
  { name: 'Rolling', keys: ['r12', 'r3avg'] }
];
const TI_ORDER = TI_GROUPS.flatMap(g => g.keys);
const tiSorted = l => l.slice().sort((a, b) => TI_ORDER.indexOf(a.key) - TI_ORDER.indexOf(b.key));
function tiCalcList(cfg){ return tiSorted(tiCalcListRaw(cfg)); }
function tiCalcListRaw(cfg){ cfg = cfg || {}; return cfg.grain === 'month' ? (cfg.basis === 'context' ? TI_M_CALCS : TI_M_CALCS_LATEST) : cfg.basis === 'context' ? TI_CALCS : TI_CALCS_LATEST; }
const TI_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const TI_LAST_DAY = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
// A DAX date table: CALENDAR ( … ) or CALENDARAUTO ( … ) in a calculated table
function tiCalcDateTable(t){ return !!t && /\bCALENDAR(AUTO)?\s*\(/i.test(t.calc || ''); }
// fact date columns related to the date table (where "the last date with data" comes from)
function tiDataDateOptions(model, cfg){
  if (!model || !cfg.dateTable) return [];
  const out = [], seen = new Set(), add = (t, c) => { const k = lc(t + '|' + c); if (!seen.has(k)) { seen.add(k); out.push({ v: t + '|' + c, t: qName(t) + bracket(c) }); } };
  const rels = model.rels.filter(r => lc(r.toTable) === lc(cfg.dateTable));
  rels.filter(r => !r.inactive && lc(r.toColumn) === lc(cfg.dateColumn)).concat(rels).forEach(r => add(r.fromTable, r.fromColumn));
  model.columns.filter(c => lc(c.table) !== lc(cfg.dateTable) && /date/i.test(c.dataType || '')).forEach(c => add(c.table, c.name));
  return out;
}
// the helper column and measure the patterns need, unless the model has them already
function tiHelpers(model, cfg){
  const hasCol = model.columns.some(c => lc(c.table) === lc(cfg.dateTable) && lc(c.name) === lc(TI_DWS));
  const hasMeasure = model.measures.some(m => lc(m.name) === lc(TI_SVD));
  const f = tiDataRef(cfg), d = tiDateRef(cfg);
  if (cfg.grain === 'month') return { columns: tiMonthAdds(model, cfg), measure: null };
  return {
    columns: hasCol ? [] : [{ name: TI_DWS, expression: d + ' <= MAX ( ' + f + ' )' }],
    measure: hasMeasure || cfg.output === 'group' ? null : { name: TI_SVD, expression: [tiVar('LastDateWithData', tiFn('CALCULATE', ['MAX ( ' + f + ' )', 'REMOVEFILTERS ()'])),
      tiVar('FirstDateVisible', 'MIN ( ' + d + ' )'), tiVar('Result', 'FirstDateVisible <= LastDateWithData'), 'RETURN', '    Result'].join('\n') }
  };
}
function tiCalcName(cfg, c){ const o = (cfg.names || {})[c.key]; return (o || '').trim() || c.name; }
function tiExpr(cfg, c, measureExpr){ return c.f(cfg.grain === 'month' ? tiMonthBlocks(cfg, measureExpr) : tiBlocks(cfg, measureExpr), cfg); }
function tiSelectedCalcs(cfg){ return tiCalcList(cfg).filter(c => (cfg.calcs || []).includes(c.key)); }
function tiMeasureName(cfg, base, c){
  const n = tiCalcName(cfg, c);
  return cfg.namePattern === 'prefix' ? n + ' ' + base.name : base.name + ' ' + n;
}
function tiFolder(cfg, base){
  const f = normFolder(cfg.folder || '');
  if (cfg.folderMode === 'under') return normFolder((base.folder ? base.folder + '\\' : '') + (f || 'Time Intelligence'));
  if (cfg.folderMode === 'perMeasure') return normFolder((f ? f + '\\' : '') + base.name);
  return f;
}
// Growth measures (those with dep) build on the other new measures when those are being created too:
// dep is [current, previous], 'cur' being the base measure itself.
function tiDepsMet(cfg, c){ return !!c.dep && c.dep.every(k => k === 'cur' || (cfg.calcs || []).includes(k)); }
// calculations the selected growth measures need but that aren't ticked (measures output only)
function tiMissingDeps(cfg){
  if (cfg.output === 'group') return [];
  const list = tiCalcList(cfg), sel = tiSelectedCalcs(cfg), keys = new Set();
  sel.forEach(c => (c.dep || []).forEach(k => { if (k !== 'cur' && !(cfg.calcs || []).includes(k)) keys.add(k); }));
  return list.filter(c => keys.has(c.key));
}
function tiPlan(model, cfg){
  const bases = (cfg.measures || []).map(n => model.measures.find(m => lc(m.name) === lc(n))).filter(Boolean);
  const calcs = tiSelectedCalcs(cfg), list = tiCalcList(cfg), out = [];
  const ref = (b, k) => bracket(k === 'cur' ? b.name : tiMeasureName(cfg, b, list.find(x => x.key === k)));
  // the measures they build on come first, growth measures last
  const add = (b, c) => out.push({
    base: b, calc: c, name: tiMeasureName(cfg, b, c),
    expression: tiDepsMet(cfg, c) ? tiGrowth(ref(b, c.dep[0]), ref(b, c.dep[1]), c.kind === 'pct') : tiExpr(cfg, c, bracket(b.name)),
    formatString: c.kind === 'pct' ? (cfg.pctFormat || '0.0%') : (b.formatString || ''),
    folder: tiFolder(cfg, b)
  });
  bases.forEach(b => calcs.filter(c => !c.dep).forEach(c => add(b, c)));
  bases.forEach(b => calcs.filter(c => c.dep).forEach(c => add(b, c)));
  return out;
}
function tiCheck(model, cfg){
  const out = [], add = (level, text) => out.push({ level, text });
  const t = model.tables.find(x => lc(x.name) === lc(cfg.dateTable || ''));
  const col = t && model.columns.find(c => lc(c.table) === lc(t.name) && lc(c.name) === lc(cfg.dateColumn || ''));
  if (!cfg.dateTable || !t) add('err', 'Choose your date table in Step 2.');
  else if (cfg.grain === 'month') tiMonthCheck(model, cfg, t, add);
  else if (!col) add('err', 'Choose the date column of ' + qName(t.name) + ' in Step 2.');
  else {
    if (!/date/i.test(col.dataType || '')) add('err', qName(t.name) + bracket(col.name) + ' is a ' + (col.dataType || 'non-date') + ' column; time intelligence needs a date column.');
    if (lc(t.category) !== 'time' && tiCalcDateTable(t)) add('warn', qName(t.name) + ' is a calculated date table (built with ' + (/CALENDARAUTO/i.test(t.calc) ? 'CALENDARAUTO' : 'CALENDAR') + ') and isn\u2019t marked as a date table. You can carry on: the measures work without it. Marking it (Table tools > Mark as date table, using ' + bracket(col.name) + ') is optional.');
    else if (lc(t.category) !== 'time') add('warn', qName(t.name) + ' isn\u2019t marked as a date table. You can carry on: marking it is optional. Just make sure it has one row for every day and no gaps; a fact table\u2019s date column won\u2019t do (the Date Table Generator builds a proper one).');
    if (!model.rels.some(r => (lc(r.toTable) === lc(t.name) || lc(r.fromTable) === lc(t.name)))) add('warn', qName(t.name) + ' has no relationships in the export, so these calculations won’t filter your facts. Relate it to your fact tables first.');
    const dp = (cfg.dataDate || '').split('|');
    if (!tiDataRef(cfg) || !model.columns.some(c => lc(c.table) === lc(dp[0]) && lc(c.name) === lc(dp[1]))) add('err', 'Choose the fact date column that has your last date with data in Step 2.');
    else {
      const h = tiHelpers(model, cfg);
      if (!h.columns.length) add('info', 'Uses the ' + bracket(TI_DWS) + ' column already in ' + qName(t.name) + '. It should be TRUE for dates up to the last date with data.');
      if (!h.measure && cfg.output !== 'group') add('info', 'Uses the ' + bracket(TI_SVD) + ' measure already in the model. It should be TRUE when the first date in the filter is on or before the last date with data.');
      if (model.measures.some(x => lc(x.table) === lc(t.name) && lc(x.name) === lc(TI_DWS)) || model.columns.some(x => lc(x.table) === lc(t.name) && lc(x.name) === lc(TI_SVD))) add('err', qName(t.name) + ' already has an object named ' + TI_DWS + ' or ' + TI_SVD + ' of the wrong kind; rename it first.');
    }
  }
  const calcs = tiSelectedCalcs(cfg);
  if (!calcs.length) add('err', 'Pick at least one calculation in Step 3.');
  const m = +cfg.fyEnd || 12;
  if (m % 3 !== 0 && calcs.some(c => /^(qtd|pqtd|qoqp)$/.test(c.key)) && cfg.grain !== 'month') add('warn', 'QTD uses calendar quarters (Jan–Mar, Apr–Jun…), which don’t line up with a fiscal year ending in ' + TI_MONTHS[m - 1] + '.');
  const names = calcs.map(c => lc(tiCalcName(cfg, c)));
  const dupN = names.filter((n, i) => names.indexOf(n) !== i);
  if (dupN.length) add('err', 'Two calculations have the same name: ' + [...new Set(dupN)].join(', ') + '.');
  if (cfg.output === 'group') {
    const tn = (cfg.groupTable || '').trim(), cn = (cfg.groupColumn || '').trim();
    if (!tn) add('err', 'Give the calculation group table a name.');
    if (!cn) add('err', 'Give the calculation group column a name.');
    if (cn && lc(cn) === 'ordinal') add('err', 'The column can’t be called Ordinal; that name is used for the sort column.');
    const ex = tn && model.tables.find(x => lc(x.name) === lc(tn));
    if (ex) {
      const isGroup = model.columns.some(c => lc(c.table) === lc(tn) && lc(c.name) === 'ordinal');
      if (isGroup) add('warn', 'The model already has a table named ' + qName(tn) + ' that looks like a calculation group. Applying replaces it with this version.');
      else add('err', 'The model already has a table named ' + qName(tn) + '; applying the script would replace it. Choose another name.');
    }
    if (!(+cfg.precedence >= 0)) add('err', 'Precedence must be a whole number, 0 or more.');
  } else {
    if (!(cfg.measures || []).length) add('err', 'Pick at least one measure in Step 3.');
    const missing = (cfg.measures || []).filter(n => !model.measures.some(x => lc(x.name) === lc(n)));
    if (missing.length) add('err', 'Not in the model export: ' + missing.map(bracket).join(', ') + '.');
    const target = model.tables.find(x => lc(x.name) === lc(cfg.target || ''));
    if (!target) add('err', (cfg.target || '').trim() ? qName(cfg.target.trim()) + ' isn\u2019t a table in the model. New measures need an existing home table.' : 'Choose the home table for the new measures (Where new measures go, at the top).');
    const plan = tiPlan(model, cfg);
    const clash = [], replace = [], colClash = [];
    plan.forEach(p => {
      const ex = model.measures.find(x => lc(x.name) === lc(p.name));
      if (ex && target && lc(ex.table) !== lc(target.name)) clash.push(bracket(p.name) + ' (in ' + qName(ex.table) + ')');
      else if (ex) replace.push(bracket(p.name));
      if (target && model.columns.some(c => lc(c.table) === lc(target.name) && lc(c.name) === lc(p.name))) colClash.push(bracket(p.name));
    });
    if (clash.length) add('err', 'These names are already used by measures in other tables: ' + clash.join(', ') + '. Change the calculation names or the naming pattern.');
    if (colClash.length) add('err', 'These names match columns in ' + qName(cfg.target) + ': ' + colClash.join(', ') + '.');
    if (replace.length) add('warn', 'These measures already exist and will be replaced: ' + replace.join(', ') + '.');
    const pn = plan.map(p => lc(p.name)); const dp = pn.filter((n, i) => pn.indexOf(n) !== i);
    if (dp.length) add('err', 'Some new measure names repeat: ' + [...new Set(dp)].join(', ') + '.');
    if (plan.length > 60) add('info', plan.length + ' measures is a lot to maintain. A calculation group gives the same results with one small table.');
  }
  return out;
}
function tiMonthCheck(model, cfg, t, add){
  const p = cfg.mcols || {}, cols = model.columns.filter(c => lc(c.table) === lc(t.name));
  tiMonthColsNeeded(cfg).forEach(k => {
    const n = (p[k.key] || '').trim();
    if (!n) { if (k.fromDate && !tiMonthDateCol(model, cfg)) add('err', 'Choose the ' + k.label + ' column of ' + qName(t.name) + ' in Step 2 (it has no date column to work it out from).'); return; }
    const c = cols.find(x => lc(x.name) === lc(n));
    if (!c) add('err', qName(t.name) + ' has no column ' + bracket(n) + '.');
    else if (!tiNumeric(c)) add('err', qName(t.name) + bracket(n) + ' is a ' + (c.dataType || 'text') + ' column; ' + k.label + ' needs to be a number.');
  });
  const adds = tiMonthAdds(model, cfg);
  if (adds.length) add('info', 'The script adds hidden ' + adds.map(a => bracket(a.name)).join(', ') + (adds.length === 1 ? ' column' : ' columns') + ' to ' + qName(t.name) + ', worked out from the table\u2019s own columns.');
  if (p.ymn && !adds.length) add('info', 'Year Month Number must count months in order across years (for example Year \u00d7 12 + Month \u2212 1), not YYYYMM.');
  if (cfg.basis !== 'context' && !(cfg.dataDate || '').split('|')[0]) add('err', 'Choose the fact table that has your data in Step 2.');
  if (!model.rels.some(r => (lc(r.toTable) === lc(t.name) || lc(r.fromTable) === lc(t.name)))) add('warn', qName(t.name) + ' has no relationships in the export, so these calculations won\u2019t filter your facts. Relate it to your fact tables first.');
}
function tiIndentBlock(expr, indent){ return exprLines(expr).map(l => l ? indent + l : ''); }
function tiPushObject(L, kind, name, expr){
  const T = TAB, lines = exprLines(expr);
  if (lines.length === 1) L.push(T + T + kind + ' ' + tmdlName(name) + ' = ' + lines[0].trim());
  else { L.push(T + T + kind + ' ' + tmdlName(name) + ' ='); lines.forEach(l => L.push(l ? T.repeat(4) + l : '')); }
}
// DateWithSales and ShowValueForDates (hidden), in the date table
function tiPushHelpers(L, model, cfg){
  const T = TAB, h = tiHelpers(model, cfg);
  h.columns.forEach(c => { tiPushObject(L, 'column', c.name, c.expression); L.push(T + T + T + 'isHidden', T + T + T + 'summarizeBy: none', ''); });
  if (h.measure) { tiPushObject(L, 'measure', h.measure.name, h.measure.expression); L.push(T + T + T + 'isHidden', T + T + T + 'displayFolder: Time intelligence helpers', ''); }
  return !!(h.columns.length || h.measure);
}
function tiTmdl(model, cfg){
  const T = TAB, L = ['createOrReplace', ''];
  if (cfg.output === 'group') {
    const tn = cfg.groupTable.trim(), cn = cfg.groupColumn.trim();
    L.push(T + 'table ' + tmdlName(tn), '', T + T + 'calculationGroup', T + T + T + 'precedence: ' + (+cfg.precedence || 0), '');
    const items = [{ name: 'Current', expr: 'SELECTEDMEASURE ()', kind: 'value' }].concat(tiSelectedCalcs(cfg).map(c => ({ name: tiCalcName(cfg, c), expr: tiExpr(cfg, c, 'SELECTEDMEASURE ()'), kind: c.kind })));
    items.forEach((it, i) => {
      const lines = exprLines(it.expr);
      if (lines.length === 1) L.push(T.repeat(3) + 'calculationItem ' + tmdlName(it.name) + ' = ' + lines[0].trim());
      else { L.push(T.repeat(3) + 'calculationItem ' + tmdlName(it.name) + ' ='); lines.forEach(l => L.push(l ? T.repeat(5) + l : '')); }
      L.push('', T.repeat(4) + 'ordinal: ' + i);
      if (it.kind === 'pct') L.push('', T.repeat(4) + 'formatStringDefinition = ' + daxString(cfg.pctFormat || '0.0%'));
      L.push('');
    });
    L.push(T + T + 'column ' + tmdlName(cn), T + T + T + 'dataType: string', T + T + T + 'summarizeBy: none', T + T + T + 'sourceColumn: Name', T + T + T + 'sortByColumn: Ordinal', '');
    L.push(T + T + 'column Ordinal', T + T + T + 'dataType: int64', T + T + T + 'isHidden', T + T + T + 'formatString: 0', T + T + T + 'summarizeBy: sum', T + T + T + 'sourceColumn: Ordinal', '');
    const H = [T + 'ref table ' + tmdlName(cfg.dateTable), ''];
    if (tiPushHelpers(H, model, cfg)) L.push(...H);
    while (L[L.length - 1] === '') L.pop();
    return L.join('\n') + '\n';
  }
  const same = lc(cfg.target.trim()) === lc(cfg.dateTable);
  L.push(T + 'ref table ' + tmdlName(same ? cfg.dateTable : cfg.target.trim()), '');
  if (same) tiPushHelpers(L, model, cfg);
  tiPlan(model, cfg).forEach(p => {
    const lines = exprLines(p.expression);
    if (lines.length === 1) L.push(T + T + 'measure ' + tmdlName(p.name) + ' = ' + lines[0].trim());
    else { L.push(T + T + 'measure ' + tmdlName(p.name) + ' ='); lines.forEach(l => L.push(l ? T.repeat(4) + l : '')); }
    if (p.formatString) L.push(T + T + T + 'formatString: ' + tmdlValue(p.formatString));
    if (p.folder) L.push(T + T + T + 'displayFolder: ' + tmdlValue(p.folder));
    L.push('');
  });
  if (!same) { const H = [T + 'ref table ' + tmdlName(cfg.dateTable), '']; if (tiPushHelpers(H, model, cfg)) L.push(...H); }
  while (L[L.length - 1] === '') L.pop();
  return L.join('\n') + '\n';
}
function tiTestQuery(model, cfg){
  const by = cfg.testBy ? cfg.testBy.split('|') : null;
  const byRef = by ? qName(by[0]) + bracket(by[1]) : null;
  const I = '    ';
  if (cfg.output === 'group') {
    const base = (cfg.testMeasure || '').trim() || (model.measures[0] ? model.measures[0].name : '');
    if (!base || !byRef) return '';
    return ['// Run in DAX query view AFTER applying the script: one row per ' + by[1] + ' and calculation.',
      'EVALUATE',
      'SUMMARIZECOLUMNS (',
      I + byRef + ',',
      I + qName(cfg.groupTable.trim()) + '[Ordinal],',
      I + qName(cfg.groupTable.trim()) + bracket(cfg.groupColumn.trim()) + ',',
      I + daxString(base) + ', ' + bracket(base),
      ')',
      'ORDER BY ' + byRef + ', ' + qName(cfg.groupTable.trim()) + '[Ordinal]'].join('\n');
  }
  const plan = tiPlan(model, cfg);
  if (!plan.length || !byRef) return '';
  const L = ['// Run in DAX query view BEFORE applying: the measures exist only in this query.', '// Check a few numbers against a visual, then apply the TMDL script.', 'DEFINE'];
  const def = (kind, table, name, expr) => {
    const lines = exprLines(expr);
    L.push(I + kind + ' ' + qName(table) + bracket(name) + ' =');
    lines.forEach(l => L.push(l ? I + I + l.replace(/^\t+/, t => I.repeat(t.length)) : ''));
  };
  const h = tiHelpers(model, cfg);
  h.columns.forEach(c => def('COLUMN', cfg.dateTable, c.name, c.expression));
  if (h.measure) def('MEASURE', cfg.dateTable, h.measure.name, h.measure.expression);
  plan.forEach(p => def('MEASURE', cfg.target.trim(), p.name, p.expression));
  L.push('EVALUATE', 'SUMMARIZECOLUMNS (', I + byRef + ',');
  const bases = [...new Set(plan.map(p => p.base.name))];
  const cols = bases.map(b => I + daxString(b) + ', ' + bracket(b)).concat(plan.map(p => I + daxString(p.name) + ', ' + bracket(p.name)));
  cols.forEach((c, i) => L.push(c + (i < cols.length - 1 ? ',' : '')));
  L.push(')', 'ORDER BY ' + byRef);
  return L.join('\n');
}
/*TI-CORE-END*/
