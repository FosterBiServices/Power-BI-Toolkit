/*RV-CORE-START*/
/* ---------- DAX tokenizer ----------
   Tokens: ws, comment, str ("..."), table ('...'), ref ([...]), id, num, op, punct. Each has start, end, line. */
function daxTokens(src){
  const t = []; let i = 0, line = 1; const n = src.length;
  const push = (k, s, e) => { t.push({ k, v: src.slice(s, e), s, e, line }); for (let j = s; j < e; j++) if (src[j] === '\n') line++; };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (/\s/.test(c)) { let j = i; while (j < n && /\s/.test(src[j])) j++; push('ws', i, j); i = j; continue; }
    if ((c === '/' && d === '/') || (c === '-' && d === '-')) { let j = i; while (j < n && src[j] !== '\n') j++; push('comment', i, j); i = j; continue; }
    if (c === '/' && d === '*') { let j = src.indexOf('*/', i + 2); j = j < 0 ? n : j + 2; push('comment', i, j); i = j; continue; }
    if (c === '"') { let j = i + 1; while (j < n) { if (src[j] === '"') { if (src[j + 1] === '"') { j += 2; continue; } j++; break; } j++; } push('str', i, j); i = j; continue; }
    if (c === "'") { let j = i + 1; while (j < n) { if (src[j] === "'") { if (src[j + 1] === "'") { j += 2; continue; } j++; break; } j++; } push('table', i, j); i = j; continue; }
    if (c === '[') { let j = i + 1; while (j < n) { if (src[j] === ']') { if (src[j + 1] === ']') { j += 2; continue; } j++; break; } j++; } push('ref', i, j); i = j; continue; }
    if (/[A-Za-z_]/.test(c)) { let j = i; while (j < n && /[A-Za-z0-9_.]/.test(src[j])) j++; push('id', i, j); i = j; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(d))) { let j = i; while (j < n && /[0-9.eE]/.test(src[j])) j++; push('num', i, j); i = j; continue; }
    const two = src.slice(i, i + 2);
    if (['&&', '||', '<=', '>=', '<>', '=='].includes(two)) { push('op', i, i + 2); i += 2; continue; }
    push(/[()\{\},]/.test(c) ? 'punct' : 'op', i, i + 1); i++;
  }
  return t;
}
const refName = v => v.slice(1, -1).replace(/\]\]/g, ']');
const tableName = v => v.slice(1, -1).replace(/''/g, "'");

// Function calls: { fn, open (token index of "("), close, args: [[startIdx, endIdx)...], line }
function daxCalls(toks){
  const sig = toks.map((t, i) => i).filter(i => toks[i].k !== 'ws' && toks[i].k !== 'comment');
  const calls = [];
  for (let p = 0; p < sig.length - 1; p++) {
    const a = toks[sig[p]], b = toks[sig[p + 1]];
    if (a.k !== 'id' || b.v !== '(') continue;
    let depth = 0, q = p + 1, argStart = p + 2; const args = [];
    for (; q < sig.length; q++) {
      const v = toks[sig[q]].v;
      if (v === '(' || v === '{') depth++;
      else if (v === ')' || v === '}') { depth--; if (depth === 0) { if (q > argStart || args.length) args.push([sig[argStart], sig[q]]); break; } }
      else if (v === ',' && depth === 1) { args.push([sig[argStart], sig[q]]); argStart = q + 1; }
    }
    calls.push({ fn: a.v.toUpperCase(), tok: sig[p], open: sig[p + 1], close: sig[Math.min(q, sig.length - 1)], args, line: a.line });
  }
  return calls;
}
function textOf(src, toks, a, b){ return toks[a] ? src.slice(toks[a].s, toks[b] ? toks[b].s : src.length).trim() : ''; }
function sigToks(toks, a, b){ const out = []; for (let i = a; i < b; i++) if (toks[i].k !== 'ws' && toks[i].k !== 'comment') out.push(toks[i]); return out; }

/* ---------- pasted measure ---------- */
// Accepts "Name = expr", TMDL "measure 'Name' = expr" (with properties), DEFINE MEASURE 'T'[Name] = expr, or a bare expression
function parseMeasureInput(text){
  let s = (text || '').replace(/\r/g, '');
  const res = { name: '', table: '', expression: '', form: 'bare' };
  if (!s.trim()) return res;
  s = s.replace(/^\s*\/\/\/.*\n/gm, '');
  // TMDL: cut the property lines that follow the expression
  const tm = s.match(/^\s*measure\s+('(?:[^']|'')+'|[^\s=]+)\s*=\s*([\s\S]*)$/i);
  if (tm) {
    res.form = 'tmdl'; res.name = tm[1].replace(/^'|'$/g, '').replace(/''/g, "'");
    const lines = tm[2].split('\n');
    const cut = lines.findIndex((l, i) => i > 0 && /^\s*(formatString|displayFolder|lineageTag|description|annotation|isHidden|dataCategory|formatStringDefinition|changedProperty|detailRowsDefinition|kpi)\b/.test(l));
    res.expression = dedent((cut > 0 ? lines.slice(0, cut) : lines).join('\n')).trim();
    return res;
  }
  const dm = s.match(/^\s*(?:DEFINE\s+)?MEASURE\s+('(?:[^']|'')+'|[A-Za-z_]\w*)\s*\[((?:[^\]]|\]\])+)\]\s*=\s*([\s\S]*)$/i);
  if (dm) { res.form = 'define'; res.table = dm[1].replace(/^'|'$/g, '').replace(/''/g, "'"); res.name = dm[2].replace(/\]\]/g, ']'); res.expression = dedent(dm[3].replace(/\n\s*EVALUATE[\s\S]*$/i, '')).trim(); return res; }
  // "Name = expr": the part before the first "=" must be a plain name
  const eq = s.indexOf('=');
  if (eq > 0) {
    const left = s.slice(0, eq).trim();
    if (left && !/[()"\[\]{},]/.test(left.replace(/^\[|\]$/g, '')) && left.length < 120 && !/\n/.test(left)) {
      res.form = 'named'; res.name = left.replace(/^\[|\]$/g, '').trim(); res.expression = dedent(s.slice(eq + 1)).trim(); return res;
    }
  }
  res.expression = dedent(s).trim();
  return res;
}
function dedent(s){
  const lines = s.replace(/^\n+/, '').split('\n');
  const ind = lines.filter(l => l.trim()).map(l => l.match(/^[ \t]*/)[0].length);
  const m = ind.length ? Math.min(...ind.slice(1).concat(ind.length > 1 ? [] : ind)) : 0;
  return lines.map((l, i) => i === 0 ? l.replace(/^[ \t]+/, '') : l.slice(Math.min(m, l.match(/^[ \t]*/)[0].length))).join('\n');
}

/* ---------- the checklist ---------- */
// auto: the page checks it. Every enabled rule also goes to Copilot.
const RULES = [
  { id: 'DIVIDE', name: 'Use DIVIDE instead of /', sev: 'medium', auto: true, check: 'Division with / returns an error or infinity when the denominator is 0 or blank. DIVIDE ( a, b ) returns blank instead (or a value you choose). Dividing by a constant number is fine.' },
  { id: 'FILTER_TABLE', name: 'FILTER over a whole table', sev: 'high', auto: true, check: 'FILTER ( Table, ... ) as a CALCULATE filter scans every row and filters every column of the table. Filter the columns you need instead: Table[Column] = value, wrapped in KEEPFILTERS if existing filters must be kept.' },
  { id: 'REPEATED', name: 'Repeated expressions: use variables', sev: 'medium', auto: true, check: 'The same expression or measure is written more than once in the same filter context. Store it in a VAR once and reuse it; long formulas should use VAR and RETURN to name their steps.' },
  { id: 'CONTEXT_TRANSITION', name: 'Context transition inside iterators', sev: 'high', auto: true, check: 'A measure or CALCULATE inside an iterator (SUMX, FILTER, AVERAGEX, ADDCOLUMNS...) runs once per row with that row as a filter. It is slow over large tables, and over tables with duplicate rows it can count values more than once. Check the iterator runs over the smallest table that works (for example VALUES of a key column).' },
  { id: 'IFERROR', name: 'Avoid IFERROR and ISERROR', sev: 'medium', auto: true, check: 'IFERROR hides real errors and is slow. Prevent the error instead, for example with DIVIDE or by checking for blanks.' },
  { id: 'BLANK_TO_ZERO', name: 'Turning blanks into zero', sev: 'low', auto: true, check: 'Adding + 0, COALESCE ( x, 0 ) or IF ( ISBLANK ( x ), 0, x ) makes every row show up in visuals, even ones with no data, and slows the report. Only do it when zero rows must appear.' },
  { id: 'ALL_MODIFIER', name: 'ALL as a CALCULATE filter', sev: 'low', auto: true, check: 'Inside CALCULATE, REMOVEFILTERS says the same as ALL and reads more clearly.' },
  { id: 'SUMX_SIMPLE', name: 'SUMX of a single column', sev: 'low', auto: true, check: 'SUMX ( Table, Table[Column] ) is the same as SUM ( Table[Column] ). The same goes for AVERAGEX, MINX and MAXX.' },
  { id: 'COUNT_ROWS', name: 'COUNT of a column to count rows', sev: 'low', auto: true, check: 'COUNT ( Table[Column] ) skips blanks. To count rows, COUNTROWS ( Table ) is clearer and never misses rows with a blank in that column.' },
  { id: 'NESTED_IF', name: 'Deeply nested IF', sev: 'low', auto: true, check: 'Three or more nested IFs are hard to read. SWITCH ( TRUE (), condition1, result1, condition2, result2, else ) is easier to follow.' },
  { id: 'SELECTEDVALUE', name: 'HASONEVALUE with VALUES', sev: 'low', auto: true, check: 'IF ( HASONEVALUE ( T[C] ), VALUES ( T[C] ) ) is what SELECTEDVALUE ( T[C] ) does.' },
  { id: 'EARLIER', name: 'EARLIER', sev: 'medium', auto: true, check: 'EARLIER is hard to follow. Store the outer row value in a VAR instead.' },
  { id: 'FORMAT_TEXT', name: 'FORMAT turns numbers into text', sev: 'low', auto: true, check: 'A measure that returns FORMAT ( ... ) returns text: it can’t be summed, sorted as a number or used in charts. Use a format string or a dynamic format string instead, unless text is the goal.' },
  { id: 'REFERENCES', name: 'Column and measure references', sev: 'medium', auto: true, check: 'Always write columns with their table (Table[Column]) and measures without one ([Measure]), so readers can tell them apart. Every name must exist in the model.' }
];
const SEV = { high: 3, medium: 2, low: 1 };
const ITERATORS = new Set(['SUMX', 'AVERAGEX', 'MINX', 'MAXX', 'COUNTX', 'COUNTAX', 'PRODUCTX', 'CONCATENATEX', 'RANKX', 'FILTER', 'ADDCOLUMNS', 'SELECTCOLUMNS', 'GENERATE', 'MAXX', 'TOPN']);
const CALC_FNS = new Set(['CALCULATE', 'CALCULATETABLE']);

// model (optional) tells columns from measures
function refKind(model, toks, i){
  // "[X]" preceded by a table token -> column (or a measure written with its table)
  let p = i - 1; while (p >= 0 && (toks[p].k === 'ws' || toks[p].k === 'comment')) p--;
  const pre = p >= 0 && (toks[p].k === 'table' || (toks[p].k === 'id' && p === i - 1)) ? toks[p] : null;
  const name = refName(toks[i].v);
  if (pre) {
    const tn = pre.k === 'table' ? tableName(pre.v) : pre.v;
    if (model && model.measures.some(m => lc(m.name) === lc(name)) && !model.columns.some(c => lc(c.table) === lc(tn) && lc(c.name) === lc(name))) return { kind: 'measure', qualified: true, name, table: tn };
    return { kind: 'column', qualified: true, name, table: tn };
  }
  if (model && model.columns.some(c => lc(c.name) === lc(name)) && !model.measures.some(m => lc(m.name) === lc(name))) return { kind: 'column', qualified: false, name };
  return { kind: 'measure', qualified: false, name };
}

// Run the page's checks. Returns [{ rule, line, where, what, fix }]
function autoReview(expr, model, enabled){
  const on = id => !enabled || enabled.has(id);
  const src = expr || '', toks = daxTokens(src), calls = daxCalls(toks);
  const out = [];
  const add = (rule, line, where, what, fix) => out.push({ rule, line, where: oneLine(where).slice(0, 140), what, fix, source: 'page' });
  const vars = new Set(); toks.forEach((t, i) => { if (t.k === 'id' && /^VAR$/i.test(t.v)) { let j = i + 1; while (toks[j] && toks[j].k === 'ws') j++; if (toks[j]) vars.add(lc(toks[j].v)); } });
  const lineText = ln => (src.split('\n')[ln - 1] || '').trim();

  // DIVIDE
  if (on('DIVIDE')) toks.forEach((t, i) => {
    if (t.k !== 'op' || t.v !== '/') return;
    let j = i + 1; while (toks[j] && toks[j].k === 'ws') j++;
    if (toks[j] && toks[j].k === 'num') return;
    add('DIVIDE', t.line, lineText(t.line), 'Division with / fails or returns infinity when the denominator is 0 or blank.', 'Use DIVIDE ( numerator, denominator ).');
  });
  // FILTER over a whole table, FILTER as CALCULATE modifier
  calls.forEach(c => {
    const a0 = c.args[0] ? sigToks(toks, c.args[0][0], c.args[0][1]) : [];
    const bareTable = a0.length === 1 && (a0[0].k === 'table' || (a0[0].k === 'id' && !vars.has(lc(a0[0].v))));
    if (on('FILTER_TABLE') && c.fn === 'FILTER' && bareTable) {
      const tn = a0[0].k === 'table' ? tableName(a0[0].v) : a0[0].v;
      const inCalc = calls.some(p => CALC_FNS.has(p.fn) && p.args.slice(1).some(x => sigToks(toks, x[0], x[1])[0] === toks[c.tok]));
      add('FILTER_TABLE', c.line, textOf(src, toks, c.tok, c.close + 1), 'FILTER scans every row of ' + tn + (inCalc ? ' and, as a CALCULATE filter, filters all of its columns (including ones you didn\u2019t mean to).' : '.'), inCalc ? 'Filter only the columns you need, for example KEEPFILTERS ( ' + (a0[0].k === 'table' ? a0[0].v : tn) + '[Column] = value ).' : 'Iterate over only the columns you need, for example FILTER ( VALUES ( ' + tn + '[Key] ), ... ).');
    }
    if (on('SUMX_SIMPLE') && /^(SUMX|AVERAGEX|MINX|MAXX)$/.test(c.fn) && c.args.length === 2 && bareTable) {
      const a1 = sigToks(toks, c.args[1][0], c.args[1][1]);
      if (a1.length === 2 && (a1[0].k === 'table' || a1[0].k === 'id') && a1[1].k === 'ref' || (a1.length === 1 && a1[0].k === 'ref' && refKind(model, toks, toks.indexOf(a1[0])).kind === 'column'))
        add('SUMX_SIMPLE', c.line, textOf(src, toks, c.tok, c.close + 1), c.fn + ' over a single column does the same as ' + c.fn.slice(0, -1) + '.', 'Use ' + c.fn.slice(0, -1) + ' ( ' + a1.map(x => x.v).join('') + ' ).');
    }
    if (on('COUNT_ROWS') && c.fn === 'COUNT' && c.args.length === 1) add('COUNT_ROWS', c.line, textOf(src, toks, c.tok, c.close + 1), 'COUNT skips rows where this column is blank.', 'To count rows, use COUNTROWS ( table ).');
    if (on('ALL_MODIFIER') && CALC_FNS.has(c.fn)) c.args.slice(1).forEach(a => {
      const s = sigToks(toks, a[0], a[1]);
      if (s[0] && s[0].k === 'id' && /^ALL$/i.test(s[0].v) && s[1] && s[1].v === '(') add('ALL_MODIFIER', s[0].line, textOf(src, toks, a[0], a[1]), 'ALL used as a filter inside ' + c.fn + ' removes filters.', 'REMOVEFILTERS ( ... ) does the same and says so.');
    });
    if (on('IFERROR') && /^(IFERROR|ISERROR)$/.test(c.fn)) add('IFERROR', c.line, lineText(c.line), c.fn + ' hides errors and is slow.', 'Prevent the error instead, for example with DIVIDE.');
    if (on('EARLIER') && /^(EARLIER|EARLIEST)$/.test(c.fn)) add('EARLIER', c.line, lineText(c.line), c.fn + ' refers to an outer row context.', 'Store the outer value in a VAR before the inner iterator.');
    if (on('SELECTEDVALUE') && c.fn === 'HASONEVALUE') add('SELECTEDVALUE', c.line, lineText(c.line), 'HASONEVALUE with VALUES is what SELECTEDVALUE does.', 'Use SELECTEDVALUE ( Table[Column], alternate ).');
    if (on('BLANK_TO_ZERO') && c.fn === 'COALESCE' && c.args.length === 2 && /^0(\.0+)?$/.test(textOf(src, toks, c.args[1][0], c.args[1][1]))) add('BLANK_TO_ZERO', c.line, textOf(src, toks, c.tok, c.close + 1), 'COALESCE ( ..., 0 ) shows 0 instead of blank.', 'Only do this if rows with no data must appear in visuals.');
    if (on('BLANK_TO_ZERO') && c.fn === 'IF' && c.args.length >= 2) {
      const cond = sigToks(toks, c.args[0][0], c.args[0][1]);
      const then = textOf(src, toks, c.args[1][0], c.args[1][1]);
      if (cond[0] && /^ISBLANK$/i.test(cond[0].v) && /^0(\.0+)?$/.test(then)) add('BLANK_TO_ZERO', c.line, textOf(src, toks, c.tok, c.close + 1), 'IF ( ISBLANK ( ... ), 0, ... ) shows 0 instead of blank.', 'Only do this if rows with no data must appear in visuals.');
    }
    if (on('IFERROR') && c.fn === 'IFERROR' && c.args[1] && /^0(\.0+)?$/.test(textOf(src, toks, c.args[1][0], c.args[1][1])) && on('BLANK_TO_ZERO')) add('BLANK_TO_ZERO', c.line, lineText(c.line), 'IFERROR ( ..., 0 ) also turns errors into 0.', 'Return blank instead unless 0 is needed.');
  });
  // + 0 / 0 +
  if (on('BLANK_TO_ZERO')) toks.forEach((t, i) => {
    if (t.k !== 'op' || t.v !== '+') return;
    let a = i - 1; while (toks[a] && toks[a].k === 'ws') a--;
    let b = i + 1; while (toks[b] && toks[b].k === 'ws') b++;
    if ((toks[b] && toks[b].k === 'num' && /^0(\.0+)?$/.test(toks[b].v)) || (toks[a] && toks[a].k === 'num' && /^0(\.0+)?$/.test(toks[a].v) && !(toks[a - 1] && /[\w\])]/.test((toks[a - 1].v || '').slice(-1)))))
      add('BLANK_TO_ZERO', t.line, lineText(t.line), 'Adding 0 turns blanks into 0.', 'Only do this if rows with no data must appear in visuals.');
  });
  // nested IF
  if (on('NESTED_IF')) {
    const ifs = calls.filter(c => c.fn === 'IF');
    const depthOf = c => ifs.filter(o => o !== c && o.open < c.open && o.close > c.close).length;
    const deep = ifs.filter(c => depthOf(c) >= 2);
    if (deep.length) { const top = ifs.find(c => depthOf(c) === 0 && c.open < deep[0].open && c.close > deep[0].close) || deep[0]; add('NESTED_IF', top.line, lineText(top.line), (depthOf(deep[deep.length - 1]) + 1) + ' IFs are nested inside each other.', 'Use SWITCH ( TRUE (), ... ).'); }
  }
  // FORMAT
  if (on('FORMAT_TEXT')) calls.filter(c => c.fn === 'FORMAT').slice(0, 1).forEach(c => add('FORMAT_TEXT', c.line, textOf(src, toks, c.tok, c.close + 1), 'FORMAT returns text.', 'Use a format string on the measure unless text is what you want.'));
  // context transition in iterators
  if (on('CONTEXT_TRANSITION')) calls.filter(c => ITERATORS.has(c.fn) && c.args.length >= 2).forEach(c => {
    const iterTable = textOf(src, toks, c.args[0][0], c.args[0][1]);
    const a0 = sigToks(toks, c.args[0][0], c.args[0][1]);
    const whole = a0.length === 1 && (a0[0].k === 'table' || (a0[0].k === 'id' && !vars.has(lc(a0[0].v))));
    const hits = [];
    for (let i = c.args[1][0]; i < c.close; i++) {
      const t = toks[i];
      if (t.k === 'ref' && refKind(model, toks, i).kind === 'measure') hits.push(t.v);
      if (t.k === 'id' && CALC_FNS.has(t.v.toUpperCase())) hits.push(t.v.toUpperCase());
    }
    if (!hits.length) return;
    // only report the innermost iterator for each hit
    const inner = calls.some(o => o !== c && ITERATORS.has(o.fn) && o.open > c.open && o.close < c.close && o.args.length >= 2);
    if (inner && !whole) return;
    add('CONTEXT_TRANSITION', c.line, textOf(src, toks, c.tok, c.close + 1), [...new Set(hits)].join(', ') + ' runs once for every row of ' + oneLine(iterTable) + (whole ? ', a whole table' : '') + ', with that row as a filter.', whole ? 'Iterate over fewer rows, for example VALUES ( Table[Key] ), or use a column instead of the measure if row-by-row filtering isn’t needed.' : 'Fine if intended; check the row count and that rows are unique.');
  });
  // repeated expressions
  if (on('REPEATED')) {
    const seen = new Map();
    calls.forEach(c => {
      if (c.close <= c.tok) return;
      const txt = textOf(src, toks, c.tok, c.close + 1); const key = stripComments(txt).replace(/\s+/g, '').toUpperCase();
      if (key.length < 18) return;
      if (!seen.has(key)) seen.set(key, []); seen.get(key).push(c);
    });
    const dups = [...seen.values()].filter(a => a.length > 1);
    // drop duplicates nested inside other duplicates
    const outer = dups.filter(a => !dups.some(b => b !== a && b.some(o => a.every(x => x.open > o.open && x.close < o.close))));
    outer.forEach(a => add('REPEATED', a[0].line, textOf(src, toks, a[0].tok, a[0].close + 1), 'This expression appears ' + a.length + ' times (lines ' + a.map(x => x.line).join(', ') + ').', 'Calculate it once in a VAR and reuse the variable.'));
    const measRefs = new Map();
    toks.forEach((t, i) => { if (t.k === 'ref' && refKind(model, toks, i).kind === 'measure') { const k = lc(refName(t.v)); if (!measRefs.has(k)) measRefs.set(k, []); measRefs.get(k).push(t); } });
    [...measRefs.values()].filter(a => a.length > 1).forEach(a => {
      // only when each use sits outside CALCULATE (same filter context)
      const plain = a.filter(t => !calls.some(c => CALC_FNS.has(c.fn) && toks[c.open].s < t.s && toks[c.close].s > t.s) && !calls.some(c => ITERATORS.has(c.fn) && toks[c.open].s < t.s && toks[c.close].s > t.s));
      if (plain.length > 1) add('REPEATED', plain[0].line, plain[0].v, plain[0].v + ' is evaluated ' + plain.length + ' times in the same filter context (lines ' + plain.map(x => x.line).join(', ') + ').', 'Store it once: VAR _Value = ' + plain[0].v + '.');
    });
    const sig = stripComments(src).replace(/\s+/g, ' ');
    if (sig.length > 220 && !vars.size) add('REPEATED', 1, lineText(1), 'A long formula with no variables.', 'Break it into named steps with VAR and RETURN.');
  }
  // references
  if (on('REFERENCES')) toks.forEach((t, i) => {
    if (t.k !== 'ref') return;
    const r = refKind(model, toks, i);
    if (r.kind === 'column' && !r.qualified && model) add('REFERENCES', t.line, t.v, t.v + ' is a column written without its table.', 'Write it as Table' + t.v + '.');
    if (r.kind === 'measure' && r.qualified) add('REFERENCES', t.line, t.v, t.v + ' is a measure written with a table name.', 'Write measures without a table: ' + t.v + '.');
  });
  // de-duplicate same rule + line + where
  const k = new Set();
  return out.filter(f => { const key = f.rule + '|' + f.line + '|' + f.where; if (k.has(key)) return false; k.add(key); return true; }).sort((a, b) => a.line - b.line);
}

/* ---------- prompt ---------- */
function numbered(expr){ return expr.split('\n').map((l, i) => String(i + 1).padStart(2, ' ') + ' | ' + l).join('\n'); }
function reviewPrompt(o){
  // o: { name, expr, rules: [{id,name,check,sev}], found: [page findings], related: [{name, expression}], notes, rewrite }
  const L = [];
  L.push('You are reviewing a DAX measure from a Power BI model against the checklist below.' + (o.name ? ' The measure is called [' + o.name + '].' : ''));
  L.push('');
  L.push('## How to review');
  L.push('- Check the measure against EVERY rule in the checklist. Report each problem as one FINDING block, using the rule ID. Use rule ID OTHER for important problems the checklist doesn’t cover (wrong results, filter context mistakes).');
  L.push('- Give the line number from the numbered listing. Quote the exact code in WHERE.');
  L.push('- Be precise about DAX behaviour. Say what actually happens (for example which filters are removed, or when a blank appears), not generic advice.');
  L.push('- The page has already found the problems listed under "Found by the page". Don’t repeat them. If one is a false alarm for this measure, write a DISMISS block saying why.');
  if (o.rewrite) {
    L.push('- Then write a REWRITE of the whole measure that fixes the findings. It must return exactly the same results in every filter context, unless a finding says the current result is wrong; if so, say that in CHANGES.');
    L.push('- In the rewrite use VAR and RETURN, DIVIDE, and only tables, columns and measures that already appear in the measure or the related measures. Write only the expression, without the measure name or "=".');
  }
  if (o.notes) { L.push(''); L.push('## About this measure'); L.push(o.notes.trim()); }
  L.push('');
  L.push('## Checklist');
  o.rules.forEach(r => L.push('- ' + r.id + ' (' + r.sev + '): ' + r.name + '. ' + r.check));
  L.push('');
  L.push('## Found by the page');
  if (o.found.length) o.found.forEach(f => L.push('- ' + f.rule + ', line ' + f.line + ': ' + f.what)); else L.push('- Nothing.');
  L.push('');
  L.push('## Output format');
  L.push('Put your ENTIRE answer inside ONE code block. Write nothing before or after the code block:');
  L.push('');
  L.push('@@@ SUMMARY @@@');
  L.push('One or two sentences on the overall quality of the measure.');
  L.push('@@@ END @@@');
  L.push('@@@ FINDING @@@');
  L.push('RULE: rule ID');
  L.push('SEVERITY: high, medium or low');
  L.push('LINE: line number');
  L.push('WHERE: the exact code');
  L.push('WHAT: what happens and why it matters');
  L.push('FIX: how to fix it');
  L.push('@@@ END @@@');
  L.push('@@@ DISMISS @@@');
  L.push('RULE: rule ID');
  L.push('LINE: line number');
  L.push('REASON: why the page’s finding doesn’t apply here');
  L.push('@@@ END @@@');
  if (o.rewrite) {
    L.push('@@@ REWRITE @@@');
    L.push('VAR ...');
    L.push('RETURN ...');
    L.push('@@@ END @@@');
    L.push('@@@ CHANGES @@@');
    L.push('- One line per change.');
    L.push('@@@ END @@@');
  }
  L.push('Write no FINDING blocks if you find nothing.');
  if (o.related && o.related.length) {
    L.push('');
    L.push('## Related measures (for context; don’t review them)');
    o.related.forEach(r => L.push('[' + r.name + '] = ' + oneLine(r.expression).slice(0, 400)));
  }
  L.push('');
  L.push('## The measure (numbered lines)');
  L.push(numbered(o.expr));
  L.push('');
  L.push('=== END OF PROMPT ===');
  return L.join('\n');
}

/* ---------- reply ---------- */
function rvBlocks(t){
  const out = []; const parts = t.split(/@@@\s*([A-Z]+)\s*@@@/);
  for (let i = 1; i < parts.length; i += 2) { const kind = parts[i].toUpperCase(); if (kind === 'END') continue; out.push({ kind, body: parts[i + 1].split(/@@@\s*END\s*@@@/i)[0] }); }
  return out;
}
function rvField(body, label, labels){
  const re = new RegExp('(^|\\n)[ \\t]*' + label + '[ \\t]*:', 'i'); const m = re.exec(body); if (!m) return '';
  const start = m.index + m[0].length; let end = body.length;
  for (const l of labels) { if (l === label) continue; const x = new RegExp('(^|\\n)[ \\t]*' + l + '[ \\t]*:', 'i').exec(body.slice(start)); if (x) end = Math.min(end, start + x.index); }
  return body.slice(start, end).replace(/^[ \t]*```[\w-]*[ \t]*$/gm, '').trim();
}
function parseReview(text){
  const t = unMarkdown((text || '').replace(/\r/g, '')).replace(/[“”]/g, '"').replace(/ /g, ' ');
  const res = { summary: '', findings: [], dismiss: [], rewrite: '', changes: [], error: null };
  if (!t.trim()) return res;
  const bs = rvBlocks(t);
  const FL = ['RULE', 'SEVERITY', 'LINE', 'WHERE', 'WHAT', 'FIX'], DL = ['RULE', 'LINE', 'REASON'];
  bs.forEach(b => {
    if (b.kind === 'SUMMARY') res.summary = oneLine(b.body.replace(/^[ \t]*```[\w-]*[ \t]*$/gm, ''));
    else if (b.kind === 'FINDING') {
      const sev = lc(rvField(b.body, 'SEVERITY', FL)); const line = parseInt(rvField(b.body, 'LINE', FL), 10);
      res.findings.push({ rule: rvField(b.body, 'RULE', FL).toUpperCase().replace(/[^A-Z0-9_]/g, '') || 'OTHER', sev: SEV[sev] ? sev : 'medium', line: isNaN(line) ? 0 : line,
        where: oneLine(rvField(b.body, 'WHERE', FL)), what: oneLine(rvField(b.body, 'WHAT', FL)), fix: oneLine(rvField(b.body, 'FIX', FL)), source: 'copilot' });
    } else if (b.kind === 'DISMISS') {
      const line = parseInt(rvField(b.body, 'LINE', DL), 10);
      res.dismiss.push({ rule: rvField(b.body, 'RULE', DL).toUpperCase().replace(/[^A-Z0-9_]/g, ''), line: isNaN(line) ? 0 : line, reason: oneLine(rvField(b.body, 'REASON', DL)) });
    } else if (b.kind === 'REWRITE') res.rewrite = b.body.replace(/^[ \t]*```[\w-]*[ \t]*$/gm, '').replace(/^\s*\n|\s+$/g, '').replace(/^(?!\s*VAR\b)\s*\[?[^=\n\[\]()]{1,80}\]?\s*=\s*\n/i, '');
    else if (b.kind === 'CHANGES') res.changes = b.body.split('\n').map(s => s.replace(/^\s*[-*•]\s*/, '').trim()).filter(s => s && !/^```/.test(s));
  });
  if (!bs.length) res.error = 'No @@@ blocks were found. Make sure Copilot answered inside one code block, and paste its whole answer.';
  return res;
}

/* ---------- test the rewrite in DAX query view ---------- */
function compareQuery(o){
  // o: { name, table, original, rewrite, byCol }
  const t = qName(o.table || '_Measures');
  const L = ['// DAX Reviewer: compare the original measure with the rewrite', '// Run in DAX query view. "Same" should be TRUE on every row.' + (o.byCol ? '' : ' Add a column in the page to compare row by row.'), 'DEFINE'];
  const ind = s => s.split('\n').map(l => '        ' + l).join('\n');
  L.push('    MEASURE ' + t + bracket('__Original') + ' =');
  L.push(ind(o.original));
  L.push('    MEASURE ' + t + bracket('__Rewrite') + ' =');
  L.push(ind(o.rewrite));
  L.push('EVALUATE');
  const cmp = '"Original", [__Original], "Rewrite", [__Rewrite]';
  const same = 'IF ( ISBLANK ( [Original] ) && ISBLANK ( [Rewrite] ), TRUE (), ABS ( [Original] - [Rewrite] ) < 0.000001 )';
  if (o.byCol) {
    L.push('VAR _rows = SUMMARIZECOLUMNS ( ' + o.byCol + ', ' + cmp + ' )');
    L.push('RETURN ADDCOLUMNS ( _rows, "Same", ' + same + ' )');
    L.push('ORDER BY [Same], ' + o.byCol);
  } else {
    L.push('VAR _row = ROW ( ' + cmp + ' )');
    L.push('RETURN ADDCOLUMNS ( _row, "Same", ' + same + ' )');
  }
  return L.join('\n');
}
function saveScript(o){
  const ind = o.rewrite.split('\n').map(l => '        ' + l).join('\n');
  return ['// DAX Reviewer: replace the measure with the rewrite', '// Run in DAX query view, then select "Update model with changes" above the editor.', 'DEFINE', '    MEASURE ' + qName(o.table) + bracket(o.name) + ' =', ind, 'EVALUATE', '    { ' + bracket(o.name) + ' }'].join('\n');
}
/*RV-CORE-END*/
