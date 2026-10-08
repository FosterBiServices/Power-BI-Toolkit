
/*TI-CORE-START*/
/* ---------- Time Intelligence Builder: measures or a calculation group, as TMDL ---------- */
// {m} = the measure (or SELECTEDMEASURE ()), {d} = 'Date'[Date], {fy} = , "06-30" when the fiscal year doesn't end in December
const TI_CALCS = [
  { key: 'ytd', name: 'YTD', kind: 'value', label: 'Year to date', tpl: 'CALCULATE ( {m}, DATESYTD ( {d}{fy} ) )' },
  { key: 'qtd', name: 'QTD', kind: 'value', label: 'Quarter to date', tpl: 'CALCULATE ( {m}, DATESQTD ( {d} ) )' },
  { key: 'mtd', name: 'MTD', kind: 'value', label: 'Month to date', tpl: 'CALCULATE ( {m}, DATESMTD ( {d} ) )' },
  { key: 'py', name: 'PY', kind: 'value', label: 'Same period last year', tpl: 'CALCULATE ( {m}, SAMEPERIODLASTYEAR ( {d} ) )' },
  { key: 'pytd', name: 'PY YTD', kind: 'value', label: 'Last year, year to date', tpl: 'CALCULATE ( {m}, SAMEPERIODLASTYEAR ( DATESYTD ( {d}{fy} ) ) )' },
  { key: 'yoy', name: 'YoY', kind: 'value', label: 'Change on last year', tpl: 'VAR _Current = {m}\nVAR _PriorYear = CALCULATE ( {m}, SAMEPERIODLASTYEAR ( {d} ) )\nRETURN\n    IF ( NOT ISBLANK ( _Current ) && NOT ISBLANK ( _PriorYear ), _Current - _PriorYear )' },
  { key: 'yoyp', name: 'YoY %', kind: 'pct', label: 'Change on last year, %', tpl: 'VAR _Current = {m}\nVAR _PriorYear = CALCULATE ( {m}, SAMEPERIODLASTYEAR ( {d} ) )\nRETURN\n    IF ( NOT ISBLANK ( _Current ), DIVIDE ( _Current - _PriorYear, _PriorYear ) )' },
  { key: 'ytdyoyp', name: 'YTD YoY %', kind: 'pct', label: 'Year to date vs last year to date, %', tpl: 'VAR _YTD = CALCULATE ( {m}, DATESYTD ( {d}{fy} ) )\nVAR _PriorYTD = CALCULATE ( {m}, SAMEPERIODLASTYEAR ( DATESYTD ( {d}{fy} ) ) )\nRETURN\n    IF ( NOT ISBLANK ( _YTD ), DIVIDE ( _YTD - _PriorYTD, _PriorYTD ) )' },
  { key: 'pm', name: 'PM', kind: 'value', label: 'Previous month', tpl: 'CALCULATE ( {m}, DATEADD ( {d}, -1, MONTH ) )' },
  { key: 'momp', name: 'MoM %', kind: 'pct', label: 'Change on previous month, %', tpl: 'VAR _Current = {m}\nVAR _PriorMonth = CALCULATE ( {m}, DATEADD ( {d}, -1, MONTH ) )\nRETURN\n    IF ( NOT ISBLANK ( _Current ), DIVIDE ( _Current - _PriorMonth, _PriorMonth ) )' },
  { key: 'r12', name: 'Rolling 12M', kind: 'value', label: 'Last 12 months to the latest date', tpl: 'CALCULATE ( {m}, DATESINPERIOD ( {d}, MAX ( {d} ), -12, MONTH ) )' },
  { key: 'r3avg', name: '3M Avg', kind: 'value', label: 'Monthly average over the last 3 months', tpl: 'VAR _Months = DATESINPERIOD ( {d}, MAX ( {d} ), -3, MONTH )\nRETURN\n    DIVIDE ( CALCULATE ( {m}, _Months ), 3 )' }
];
// Latest-date calculations (the default): {a} = the latest date in the filter, and each period is worked out from it,
// so a card or total shows one month or year, not every date added up. {ys} = start of _Anchor's (fiscal) year,
// {ly} = the same day last year (a month end stays a month end, so 28 Feb gives 29 Feb in a leap year).
const TI_CALCS_LATEST = [
  { key: 'ytd', name: 'YTD', kind: 'value', label: 'Year to the latest date', tpl: 'VAR _Anchor = {a}\nVAR _YearStart = {ys}\nRETURN\n    CALCULATE ( {m}, DATESBETWEEN ( {d}, _YearStart, _Anchor ) )' },
  { key: 'qtd', name: 'QTD', kind: 'value', label: 'Quarter to the latest date', tpl: 'VAR _Anchor = {a}\nRETURN\n    CALCULATE ( {m}, DATESBETWEEN ( {d}, EOMONTH ( _Anchor, -1 - MOD ( MONTH ( _Anchor ) - 1, 3 ) ) + 1, _Anchor ) )' },
  { key: 'mtd', name: 'MTD', kind: 'value', label: 'Month to the latest date', tpl: 'VAR _Anchor = {a}\nRETURN\n    CALCULATE ( {m}, DATESBETWEEN ( {d}, EOMONTH ( _Anchor, -1 ) + 1, _Anchor ) )' },
  { key: 'py', name: 'PY', kind: 'value', label: 'Previous year, whole year', tpl: 'VAR _Anchor = {a}\nVAR _YearStart = {ys}\nRETURN\n    CALCULATE ( {m}, DATESBETWEEN ( {d}, EDATE ( _YearStart, -12 ), _YearStart - 1 ) )' },
  { key: 'pytd', name: 'PY YTD', kind: 'value', label: 'Last year, to the same day', tpl: 'VAR _Anchor = {a}\nVAR _YearStart = {ys}\nVAR _LastYear = {ly}\nRETURN\n    CALCULATE ( {m}, DATESBETWEEN ( {d}, EDATE ( _YearStart, -12 ), _LastYear ) )' },
  { key: 'yoy', name: 'YoY', kind: 'value', label: 'Year to date vs last year to date', tpl: 'VAR _Anchor = {a}\nVAR _YearStart = {ys}\nVAR _LastYear = {ly}\nVAR _YTD = CALCULATE ( {m}, DATESBETWEEN ( {d}, _YearStart, _Anchor ) )\nVAR _PriorYTD = CALCULATE ( {m}, DATESBETWEEN ( {d}, EDATE ( _YearStart, -12 ), _LastYear ) )\nRETURN\n    IF ( NOT ISBLANK ( _YTD ) && NOT ISBLANK ( _PriorYTD ), _YTD - _PriorYTD )' },
  { key: 'yoyp', name: 'YoY %', kind: 'pct', label: 'Year to date vs last year to date, %', tpl: 'VAR _Anchor = {a}\nVAR _YearStart = {ys}\nVAR _LastYear = {ly}\nVAR _YTD = CALCULATE ( {m}, DATESBETWEEN ( {d}, _YearStart, _Anchor ) )\nVAR _PriorYTD = CALCULATE ( {m}, DATESBETWEEN ( {d}, EDATE ( _YearStart, -12 ), _LastYear ) )\nRETURN\n    IF ( NOT ISBLANK ( _YTD ), DIVIDE ( _YTD - _PriorYTD, _PriorYTD ) )' },
  { key: 'pm', name: 'PM', kind: 'value', label: 'Previous month, whole month', tpl: 'VAR _Anchor = {a}\nRETURN\n    CALCULATE ( {m}, DATESBETWEEN ( {d}, EOMONTH ( _Anchor, -2 ) + 1, EOMONTH ( _Anchor, -1 ) ) )' },
  { key: 'momp', name: 'MoM %', kind: 'pct', label: 'Month to date vs previous month, %', tpl: 'VAR _Anchor = {a}\nVAR _Current = CALCULATE ( {m}, DATESBETWEEN ( {d}, EOMONTH ( _Anchor, -1 ) + 1, _Anchor ) )\nVAR _PriorMonth = CALCULATE ( {m}, DATESBETWEEN ( {d}, EOMONTH ( _Anchor, -2 ) + 1, EOMONTH ( _Anchor, -1 ) ) )\nRETURN\n    IF ( NOT ISBLANK ( _Current ), DIVIDE ( _Current - _PriorMonth, _PriorMonth ) )' },
  { key: 'pymtd', name: 'PY MTD', kind: 'value', label: 'Same month last year, to the same day', tpl: 'VAR _Anchor = {a}\nVAR _LastYear = {ly}\nRETURN\n    CALCULATE ( {m}, DATESBETWEEN ( {d}, EOMONTH ( _LastYear, -1 ) + 1, _LastYear ) )' },
  { key: 'mtdyoyp', name: 'MTD YoY %', kind: 'pct', label: 'Month to date vs same month last year, %', tpl: 'VAR _Anchor = {a}\nVAR _LastYear = {ly}\nVAR _MTD = CALCULATE ( {m}, DATESBETWEEN ( {d}, EOMONTH ( _Anchor, -1 ) + 1, _Anchor ) )\nVAR _PriorMTD = CALCULATE ( {m}, DATESBETWEEN ( {d}, EOMONTH ( _LastYear, -1 ) + 1, _LastYear ) )\nRETURN\n    IF ( NOT ISBLANK ( _MTD ), DIVIDE ( _MTD - _PriorMTD, _PriorMTD ) )' },
  { key: 'r12', name: 'Rolling 12M', kind: 'value', label: 'Last 12 months to the latest date', tpl: 'VAR _Anchor = {a}\nRETURN\n    CALCULATE ( {m}, DATESINPERIOD ( {d}, _Anchor, -12, MONTH ) )' },
  { key: 'r3avg', name: '3M Avg', kind: 'value', label: 'Monthly average over the last 3 months', tpl: 'VAR _Anchor = {a}\nVAR _Months = DATESINPERIOD ( {d}, _Anchor, -3, MONTH )\nRETURN\n    DIVIDE ( CALCULATE ( {m}, _Months ), 3 )' }
];
function tiCalcList(cfg){ return (cfg || {}).basis === 'context' ? TI_CALCS : TI_CALCS_LATEST; }
const TI_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const TI_LAST_DAY = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function tiDateRef(cfg){ return qName(cfg.dateTable) + bracket(cfg.dateColumn); }
function tiFy(cfg){
  const m = +cfg.fyEnd || 12;
  return m === 12 ? '' : ', "' + String(m).padStart(2, '0') + '-' + TI_LAST_DAY[m - 1] + '"';
}
function tiAnchor(cfg){ const d = tiDateRef(cfg); return cfg.hideFuture ? 'MIN ( MAX ( ' + d + ' ), TODAY () )' : 'MAX ( ' + d + ' )'; }
function tiYearStart(cfg){
  const s = (+cfg.fyEnd || 12) % 12 + 1;
  return s === 1 ? 'DATE ( YEAR ( _Anchor ), 1, 1 )' : 'DATE ( YEAR ( _Anchor ) - IF ( MONTH ( _Anchor ) < ' + s + ', 1, 0 ), ' + s + ', 1 )';
}
const TI_LAST_YEAR = 'IF ( _Anchor = EOMONTH ( _Anchor, 0 ), EOMONTH ( _Anchor, -12 ), EDATE ( _Anchor, -12 ) )';
function tiCalcName(cfg, c){ const o = (cfg.names || {})[c.key]; return (o || '').trim() || c.name; }
function tiExpr(cfg, c, measureExpr){
  let e = c.tpl.split('{a}').join(tiAnchor(cfg)).split('{ys}').join(tiYearStart(cfg)).split('{ly}').join(TI_LAST_YEAR)
    .split('{m}').join(measureExpr).split('{d}').join(tiDateRef(cfg)).split('{fy}').join(tiFy(cfg));
  if (cfg.hideFuture) {
    const body = e.split('\n');
    e = 'IF (\n    MIN ( ' + tiDateRef(cfg) + ' ) > TODAY (),\n    BLANK (),\n' + body.map(l => '    ' + l).join('\n') + '\n)';
  }
  return e;
}
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
function tiPlan(model, cfg){
  const bases = (cfg.measures || []).map(n => model.measures.find(m => lc(m.name) === lc(n))).filter(Boolean);
  const calcs = tiSelectedCalcs(cfg), out = [];
  bases.forEach(b => calcs.forEach(c => out.push({
    base: b, calc: c, name: tiMeasureName(cfg, b, c),
    expression: tiExpr(cfg, c, bracket(b.name)),
    formatString: c.kind === 'pct' ? (cfg.pctFormat || '0.0%') : (b.formatString || ''),
    folder: tiFolder(cfg, b)
  })));
  return out;
}
function tiCheck(model, cfg){
  const out = [], add = (level, text) => out.push({ level, text });
  const t = model.tables.find(x => lc(x.name) === lc(cfg.dateTable || ''));
  const col = t && model.columns.find(c => lc(c.table) === lc(t.name) && lc(c.name) === lc(cfg.dateColumn || ''));
  if (!cfg.dateTable || !t) add('err', 'Choose your date table in Step 2.');
  else if (!col) add('err', 'Choose the date column of ' + qName(t.name) + ' in Step 2.');
  else {
    if (!/date/i.test(col.dataType || '')) add('err', qName(t.name) + bracket(col.name) + ' is a ' + (col.dataType || 'non-date') + ' column; time intelligence needs a date column.');
    if (lc(t.category) !== 'time') add('warn', qName(t.name) + ' isn\u2019t marked as a date table. These calculations need a date table with one row for every day and no gaps; a fact table\u2019s date column won\u2019t do (the Date Table Generator builds a proper one). If ' + qName(t.name) + ' is a date table, mark it (Table tools > Mark as date table, using ' + bracket(col.name) + ') so year-to-date and last-year results ignore filters on its other columns, like Month.');
    if (!model.rels.some(r => (lc(r.toTable) === lc(t.name) || lc(r.fromTable) === lc(t.name)))) add('warn', qName(t.name) + ' has no relationships in the export, so these calculations won’t filter your facts. Relate it to your fact tables first.');
  }
  const calcs = tiSelectedCalcs(cfg);
  if (!calcs.length) add('err', 'Pick at least one calculation in Step 3.');
  const m = +cfg.fyEnd || 12;
  if (m % 3 !== 0 && calcs.some(c => c.key === 'qtd')) add('warn', 'QTD uses calendar quarters (Jan–Mar, Apr–Jun…), which don’t line up with a fiscal year ending in ' + TI_MONTHS[m - 1] + '.');
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
function tiIndentBlock(expr, indent){ return exprLines(expr).map(l => l ? indent + l : ''); }
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
    L.push(T + T + 'column Ordinal', T + T + T + 'dataType: int64', T + T + T + 'isHidden', T + T + T + 'formatString: 0', T + T + T + 'summarizeBy: sum', T + T + T + 'sourceColumn: Ordinal');
    return L.join('\n') + '\n';
  }
  L.push(T + 'ref table ' + tmdlName(cfg.target.trim()), '');
  tiPlan(model, cfg).forEach(p => {
    const lines = exprLines(p.expression);
    if (lines.length === 1) L.push(T + T + 'measure ' + tmdlName(p.name) + ' = ' + lines[0].trim());
    else { L.push(T + T + 'measure ' + tmdlName(p.name) + ' ='); lines.forEach(l => L.push(l ? T.repeat(4) + l : '')); }
    if (p.formatString) L.push(T + T + T + 'formatString: ' + tmdlValue(p.formatString));
    if (p.folder) L.push(T + T + T + 'displayFolder: ' + tmdlValue(p.folder));
    L.push('');
  });
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
  plan.forEach(p => {
    const lines = exprLines(p.expression);
    L.push(I + 'MEASURE ' + qName(cfg.target.trim()) + bracket(p.name) + ' =');
    lines.forEach(l => L.push(l ? I + I + l.replace(/^\t+/, t => I.repeat(t.length)) : ''));
  });
  L.push('EVALUATE', 'SUMMARIZECOLUMNS (', I + byRef + ',');
  const bases = [...new Set(plan.map(p => p.base.name))];
  const cols = bases.map(b => I + daxString(b) + ', ' + bracket(b)).concat(plan.map(p => I + daxString(p.name) + ', ' + bracket(p.name)));
  cols.forEach((c, i) => L.push(c + (i < cols.length - 1 ? ',' : '')));
  L.push(')', 'ORDER BY ' + byRef);
  return L.join('\n');
}
/*TI-CORE-END*/
