/*VQ-CORE-START*/
/* ---------- names, values ---------- */
function colKey(c){ return c.table + '[' + c.name + ']'; }
function findCol(model, key){
  const m = (key || '').match(/^(.*)\[(.*)\]$/); if (!m) return null;
  return model.columns.find(c => lc(c.table) === lc(m[1]) && lc(c.name) === lc(m[2])) || null;
}
function findMeasure(model, name){ return model.measures.find(m => lc(m.name) === lc(name)) || null; }
function colRef(c){ return qName(c.table) + bracket(c.name); }
function valueType(c){
  const t = lc(c.dataType || '');
  if (/bool/.test(t)) return 'bool';
  if (/date|time/.test(t)) return 'date';
  if (/int|double|decimal|currency|number|fixed/.test(t)) return 'num';
  return 'text';
}
// "a, b, \"c, d\"" -> ['a', 'b', 'c, d']; new lines also separate
function splitValues(s){
  const out = []; let cur = '', q = false;
  for (const ch of (s || '')) {
    if (ch === '"') { q = !q; continue; }
    if (!q && (ch === ',' || ch === '\n')) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur.trim());
  return out.filter(v => v !== '');
}
function valueLiteral(v, type){
  if (type === 'num') { const x = v.replace(/[$,\s]/g, ''); return /^-?\d+(\.\d+)?$/.test(x) ? { lit: x } : { error: '“' + v + '” isn’t a number.' }; }
  if (type === 'date') {
    let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/), y, mo, d;
    if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) { mo = +m[1]; d = +m[2]; y = +m[3]; }
    else return { error: '“' + v + '” isn’t a date. Use 2026-01-31 or 1/31/2026.' };
    const t = new Date(Date.UTC(y, mo - 1, d));
    if (t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return { error: '“' + v + '” isn’t a real date.' };
    return { lit: 'DATE ( ' + y + ', ' + mo + ', ' + d + ' )' };
  }
  if (type === 'bool') { if (/^(true|yes|1)$/i.test(v)) return { lit: 'TRUE ()' }; if (/^(false|no|0)$/i.test(v)) return { lit: 'FALSE ()' }; return { error: '“' + v + '” isn’t TRUE or FALSE.' }; }
  return { lit: daxString(v) };
}

/* ---------- filters ---------- */
const FILTER_OPS = { in: 'is one of', notin: 'is not one of', between: 'is between', blank: 'is blank', notblank: 'is not blank' };
// f: { col: 'Table[Column]', op, values, from, to } -> { expr, label, error }
function filterExpr(model, f){
  const c = findCol(model, f.col);
  if (!c) return { error: 'Pick a column for this filter.' };
  const r = colRef(c), t = valueType(c);
  if (f.op === 'blank') return { expr: 'FILTER ( ALL ( ' + r + ' ), ISBLANK ( ' + r + ' ) )', label: colKey(c) + ' is blank' };
  if (f.op === 'notblank') return { expr: 'FILTER ( ALL ( ' + r + ' ), NOT ISBLANK ( ' + r + ' ) )', label: colKey(c) + ' is not blank' };
  if (f.op === 'between') {
    const lo = (f.from || '').trim(), hi = (f.to || '').trim();
    if (!lo && !hi) return { error: 'Enter a from or to value for ' + colKey(c) + '.' };
    const a = lo ? valueLiteral(lo, t) : null, b = hi ? valueLiteral(hi, t) : null;
    if (a && a.error) return { error: a.error }; if (b && b.error) return { error: b.error };
    const cond = [a ? r + ' >= ' + a.lit : '', b ? r + ' <= ' + b.lit : ''].filter(Boolean).join(' && ');
    return { expr: 'FILTER ( ALL ( ' + r + ' ), ' + cond + ' )', label: colKey(c) + (lo && hi ? ' from ' + lo + ' to ' + hi : lo ? ' from ' + lo : ' up to ' + hi) };
  }
  const vals = splitValues(f.values);
  if (!vals.length) return { error: 'Enter at least one value for ' + colKey(c) + '.' };
  const lits = [];
  for (const v of vals) { const x = valueLiteral(v, t); if (x.error) return { error: x.error }; lits.push(x.lit); }
  const list = '{ ' + lits.join(', ') + ' }';
  if (f.op === 'notin') return { expr: 'FILTER ( ALL ( ' + r + ' ), NOT ' + r + ' IN ' + list + ' )', label: colKey(c) + ' is not ' + vals.join(', ') };
  return { expr: 'TREATAS ( ' + list + ', ' + r + ' )', label: colKey(c) + ' is ' + vals.join(', ') };
}
function buildFilters(model, filters){
  const out = { names: [], defs: [], labels: [], errors: [] };
  (filters || []).forEach((f, i) => {
    if (!f.col) return;
    const x = filterExpr(model, f);
    if (x.error) { out.errors.push(x.error); return; }
    const n = '_filter' + (out.names.length + 1);
    out.names.push(n); out.defs.push('    VAR ' + n + ' = ' + x.expr); out.labels.push(x.label);
  });
  return out;
}
function header(title, fl, extra){
  const L = ['// Validation Query Builder: ' + title];
  (extra || []).forEach(x => L.push('// ' + x));
  if (fl && fl.labels.length) L.push('// Filters: ' + fl.labels.join('; '));
  L.push('// Run in DAX query view.');
  if (fl && fl.defs.length) { L.push('DEFINE'); fl.defs.forEach(d => L.push(d)); }
  return L;
}
const I = '    ';

/* ---------- 1. measure results ---------- */
function qResults(model, cfg, filters){
  const ms = (cfg.measures || []).map(n => findMeasure(model, n)).filter(Boolean);
  const gs = (cfg.groups || []).map(k => findCol(model, k)).filter(Boolean);
  const fl = buildFilters(model, filters);
  if (!ms.length) return { error: 'Pick at least one measure.' };
  if (fl.errors.length) return { error: fl.errors.join(' ') };
  const topN = parseInt(cfg.topN, 10) > 0 ? parseInt(cfg.topN, 10) : 0;
  const totals = !!cfg.totals && gs.length > 0 && !topN;
  const L = header('measure results', fl, [ms.map(m => m.name).join(', ') + (gs.length ? ' by ' + gs.map(colKey).join(', ') : '')]);
  L.push('EVALUATE');
  const args = [];
  const dup = n => gs.filter(x => lc(x.name) === lc(n)).length > 1;
  const totName = c => (dup(c.name) ? c.table + ' ' + c.name : c.name) + ' total';
  if (totals) args.push('ROLLUPADDISSUBTOTAL ( ' + gs.map(c => colRef(c) + ', ' + daxString(totName(c))).join(', ') + ' )');
  else gs.forEach(c => args.push(colRef(c)));
  fl.names.forEach(n => args.push(n));
  ms.forEach(m => args.push(daxString(m.name) + ', ' + bracket(m.name)));
  // @Sort repeats the first measure under a name no measure can have, so the ranking uses the filtered values
  if (topN) args.push('"@Sort", ' + bracket(ms[0].name));
  const sc = ['SUMMARIZECOLUMNS ('].concat(args.map((a, i) => I + a + (i < args.length - 1 ? ',' : ''))).concat([')']);
  if (topN) {
    L.push('TOPN (');
    L.push(I + topN + ',');
    sc.forEach((l, i) => L.push(I + l + (i === sc.length - 1 ? ',' : '')));
    L.push(I + '[@Sort], DESC');
    L.push(')');
    L.push('ORDER BY [@Sort] DESC');
  } else {
    sc.forEach(l => L.push(l));
    if (totals) L.push('ORDER BY ' + gs.map(c => bracket(totName(c)) + ', ' + colRef(c)).join(', '));
    else if (gs.length) L.push('ORDER BY ' + gs.map(colRef).join(', '));
  }
  return { code: L.join('\n') };
}

/* ---------- 2. totals add up ---------- */
function qTotals(model, cfg, filters){
  const ms = (cfg.measures || []).map(n => findMeasure(model, n)).filter(Boolean);
  const gs = (cfg.groups || []).map(k => findCol(model, k)).filter(Boolean);
  const fl = buildFilters(model, filters);
  if (!ms.length) return { error: 'Pick at least one measure.' };
  if (!gs.length) return { error: 'Pick at least one column to split the total by.' };
  if (fl.errors.length) return { error: fl.errors.join(' ') };
  const L = header('do the rows add up to the total?', fl, ['Split by ' + gs.map(colKey).join(', '), 'Distinct counts, averages and percentages aren’t expected to add up; for sums and counts, Difference should be 0.']);
  L.push('EVALUATE');
  L.push('VAR _rows =');
  const args = gs.map(colRef).concat(fl.names).concat(ms.map((m, i) => daxString('@m' + (i + 1)) + ', ' + bracket(m.name)));
  L.push(I + 'SUMMARIZECOLUMNS (');
  args.forEach((a, i) => L.push(I + I + a + (i < args.length - 1 ? ',' : '')));
  L.push(I + ')');
  const tot = m => fl.names.length ? 'CALCULATE ( ' + bracket(m.name) + ', ' + fl.names.join(', ') + ' )' : bracket(m.name);
  ms.forEach((m, i) => {
    L.push('VAR _total' + (i + 1) + ' = ' + tot(m));
    L.push('VAR _sum' + (i + 1) + ' = SUMX ( _rows, [@m' + (i + 1) + '] )');
  });
  L.push('RETURN');
  const rows = ms.map((m, i) => 'ROW ( "Measure", ' + daxString(m.name) + ', "Rows", COUNTROWS ( _rows ), "Grand total", _total' + (i + 1) + ', "Sum of rows", _sum' + (i + 1) + ', "Difference", _total' + (i + 1) + ' - _sum' + (i + 1) + ' )');
  if (rows.length === 1) L.push(I + rows[0]);
  else { L.push(I + 'UNION ('); rows.forEach((r, i) => L.push(I + I + r + (i < rows.length - 1 ? ',' : ''))); L.push(I + ')'); }
  return { code: L.join('\n') };
}

/* ---------- 3. reconcile with the source ---------- */
const AGGS = { SUM: 'Sum', COUNT: 'Count (non-blank)', COUNTROWS: 'Count rows', DISTINCTCOUNT: 'Distinct count', MIN: 'Minimum', MAX: 'Maximum', AVERAGE: 'Average' };
function sourceExpr(model, cfg){
  if (cfg.agg === 'COUNTROWS') { const t = model.tables.find(x => lc(x.name) === lc(cfg.table)); return t ? { expr: 'COUNTROWS ( ' + qName(t.name) + ' )', label: 'rows in ' + t.name, table: t.name } : { error: 'Pick the table to count.' }; }
  const c = findCol(model, cfg.col); if (!c) return { error: 'Pick the source column.' };
  return { expr: cfg.agg + ' ( ' + colRef(c) + ' )', label: cfg.agg + ' of ' + colKey(c), table: c.table };
}
// cfg: { pairs: [{ measure, agg, col, table }], groups, tol }. Each pair becomes rows tagged by "Check".
function qReconcile(model, cfg, filters){
  const pairs = [];
  for (const [i, p] of (cfg.pairs || []).entries()) {
    const m = findMeasure(model, p.measure);
    if (!m) return { error: 'Pick the measure for pair ' + (i + 1) + '.' };
    const s = sourceExpr(model, p); if (s.error) return { error: s.error.replace('.', ' for pair ' + (i + 1) + '.') };
    pairs.push({ m, s });
  }
  if (!pairs.length) return { error: 'Add at least one measure to check.' };
  const gs = (cfg.groups || []).map(k => findCol(model, k)).filter(Boolean);
  const fl = buildFilters(model, filters);
  if (fl.errors.length) return { error: fl.errors.join(' ') };
  const tol = Math.abs(parseFloat(cfg.tol)); const t = isNaN(tol) ? 0 : tol;
  const dup = n => gs.filter(x => lc(x.name) === lc(n)).length > 1;
  const gName = c => dup(c.name) ? c.table + ' ' + c.name : c.name;
  // Can each breakdown column filter the source table through active relationships?
  const warnings = [];
  pairs.forEach(p => gs.forEach(g => {
    if (lc(g.table) === lc(p.s.table)) return;
    const d = describePath(model, g.table, p.s.table);
    if (!d.ok || !d.forward || d.inactive) warnings.push(colKey(g) + ' doesn\u2019t filter ' + p.s.table + (d.ok ? (d.inactive ? ' through active relationships' : ' (the relationship filters the other way)') : ' (no relationship path)') + ', so the source value for ' + p.m.name + ' won\u2019t split by it.');
  }));
  const L = header('reconcile measures with their source', fl, pairs.map(p => p.m.name + ' vs ' + p.s.label).concat([(gs.length ? 'Row by row, by ' + gs.map(colKey).join(', ') + '. ' : '') + 'Rows that don\u2019t match sort first. Allowed difference: ' + t + '.', 'Source rows = rows of the source table that this row reaches. 0 means no source rows link to it.']).concat(warnings.map(w => 'WARNING: ' + w)));
  L.push('EVALUATE');
  pairs.forEach((p, i) => {
    L.push('VAR _pair' + (i + 1) + ' =');
    const args = gs.map(colRef).concat(fl.names).concat(['"@measure", ' + bracket(p.m.name), '"@source", ' + p.s.expr, '"@rows", IGNORE ( COUNTROWS ( ' + qName(p.s.table) + ' ) )']);
    L.push(I + 'SUMMARIZECOLUMNS (');
    args.forEach((a, j) => L.push(I + I + a + (j < args.length - 1 ? ',' : ''))); L.push(I + ')');
  });
  const sel = (p, i) => 'SELECTCOLUMNS ( _pair' + (i + 1) + ', "Check", ' + daxString(p.m.name + ' vs ' + p.s.label) + ', ' + gs.map(c => daxString(gName(c)) + ', ' + colRef(c)).concat(['"Measure value", [@measure]', '"Source value", [@source]', '"Source rows", [@rows]']).join(', ') + ' )';
  L.push('VAR _all =');
  if (pairs.length === 1) L.push(I + sel(pairs[0], 0));
  else { L.push(I + 'UNION ('); pairs.forEach((p, i) => L.push(I + I + sel(p, i) + (i < pairs.length - 1 ? ',' : ''))); L.push(I + ')'); }
  L.push('RETURN');
  L.push(I + 'ADDCOLUMNS (');
  L.push(I + I + '_all,');
  L.push(I + I + '"Difference", [Measure value] - [Source value],');
  L.push(I + I + '"Matches", ABS ( [Measure value] - [Source value] ) <= ' + t);
  L.push(I + ')');
  L.push('ORDER BY [Matches], [Check]' + gs.map(c => ', ' + bracket(gName(c))).join(''));
  return { code: L.join('\n'), warnings };
}

/* ---------- 4. relationship health ---------- */
function relKey(r){ return r.fromTable + '[' + r.fromColumn + ']>' + r.toTable + '[' + r.toColumn + ']'; }
function relParts(model, r){
  const f = findCol(model, r.fromTable + '[' + r.fromColumn + ']'), t = findCol(model, r.toTable + '[' + r.toColumn + ']');
  const fr = f ? colRef(f) : qName(r.fromTable) + bracket(r.fromColumn), tr = t ? colRef(t) : qName(r.toTable) + bracket(r.toColumn);
  const missing = 'FILTER ( EXCEPT ( DISTINCT ( ' + fr + ' ), DISTINCT ( ' + tr + ' ) ), NOT ISBLANK ( ' + fr + ' ) )';
  return { fr, tr, missing, label: r.fromTable + '[' + r.fromColumn + '] → ' + r.toTable + '[' + r.toColumn + ']' };
}
function qRelSummary(model, rels){
  if (!rels.length) return { error: 'Tick at least one relationship.' };
  const L = header('relationship health', null, ['For each relationship: keys on the many side with no match on the one side, the rows they affect, and blank keys.', 'Rows with no match or blank keys show under a blank value in visuals.']);
  L.push('EVALUATE');
  const rows = rels.map(r => {
    const p = relParts(model, r);
    return 'ROW ( "Relationship", ' + daxString(p.label) + ', "Rows", COUNTROWS ( ' + qName(r.fromTable) + ' ), "Keys with no match", COUNTROWS ( ' + p.missing + ' ), "Rows with no match", CALCULATE ( COUNTROWS ( ' + qName(r.fromTable) + ' ), TREATAS ( ' + p.missing + ', ' + p.fr + ' ) ), "Blank keys", COUNTBLANK ( ' + p.fr + ' ) )';
  });
  if (rows.length === 1) L.push(rows[0]);
  else { L.push('UNION ('); rows.forEach((r, i) => L.push(I + r + (i < rows.length - 1 ? ',' : ''))); L.push(')'); }
  L.push('ORDER BY [Rows with no match] DESC');
  return { code: L.join('\n') };
}
function qRelDetail(model, r){
  const p = relParts(model, r);
  const L = header('keys with no match', null, [p.label, 'The first 500 keys on the many side that have no match, with how many rows use each.']);
  L.push('EVALUATE');
  L.push('TOPN (');
  L.push(I + '500,');
  L.push(I + 'ADDCOLUMNS (');
  L.push(I + I + p.missing + ',');
  L.push(I + I + '"Rows", CALCULATE ( COUNTROWS ( ' + qName(r.fromTable) + ' ) )');
  L.push(I + '),');
  L.push(I + '[Rows], DESC');
  L.push(')');
  L.push('ORDER BY [Rows] DESC');
  return { code: L.join('\n') };
}

/* ---------- 5. table profile ---------- */
function qProfile(model, tableName){
  const t = model.tables.find(x => lc(x.name) === lc(tableName)); if (!t) return { error: 'Pick a table.' };
  const cols = model.columns.filter(c => lc(c.table) === lc(t.name));
  if (!cols.length) return { error: 'This table has no columns in the export.' };
  const L = header('table profile', null, [t.name + ': ' + cols.length + ' columns. Lowest and highest are shown as text; true/false columns have none.']);
  L.push('EVALUATE');
  const rows = cols.map(c => {
    const r = colRef(c), b = valueType(c) === 'bool';
    const nb = 'FILTER ( DISTINCT ( ' + r + ' ), NOT ISBLANK ( ' + r + ' ) )';
    const lo = b ? '""' : 'CONCATENATEX ( TOPN ( 1, ' + nb + ', ' + r + ', ASC ), ' + r + ' & "" )';
    const hi = b ? '""' : 'CONCATENATEX ( TOPN ( 1, ' + nb + ', ' + r + ', DESC ), ' + r + ' & "" )';
    return 'ROW ( "Column", ' + daxString(c.name) + ', "Type", ' + daxString(c.dataType || '') + ', "Hidden", ' + (c.hidden ? 'TRUE ()' : 'FALSE ()') + ', "Rows", COUNTROWS ( ' + qName(t.name) + ' ), "Blank", COUNTBLANK ( ' + r + ' ), "Distinct", DISTINCTCOUNT ( ' + r + ' ), "Lowest", ' + lo + ', "Highest", ' + hi + ' )';
  });
  if (rows.length === 1) L.push(rows[0]);
  else { L.push('UNION ('); rows.forEach((r, i) => L.push(I + r + (i < rows.length - 1 ? ',' : ''))); L.push(')'); }
  return { code: L.join('\n') };
}
/*VQ-CORE-END*/
