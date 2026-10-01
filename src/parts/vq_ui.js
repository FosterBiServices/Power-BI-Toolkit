
/* ---------- example ---------- */
const EX_CFG = () => ({
  check: 'results',
  results: { measures: ['Total Sales', 'Order Count'], groups: ['Date[Fiscal Year]', 'Customer[Region]'], topN: '', totals: true },
  totals: { measures: ['Total Sales', 'Order Count'], groups: ['Customer[Region]'] },
  reconcile: { pairs: [{ measure: 'Total Sales', agg: 'SUM', col: 'Sales[Net Amount]', table: 'Sales' }, { measure: 'Order Count', agg: 'DISTINCTCOUNT', col: 'Sales[Order ID]', table: 'Sales' }], groups: ['Date[Fiscal Year]'], tol: '0.01' },
  rels: { off: [], detail: '' },
  profile: { table: 'Customer' },
  filters: [{ col: 'Sales[Channel]', op: 'in', values: 'Online', from: '', to: '' }]
});
const BLANK_CFG = () => ({
  check: 'results',
  results: { measures: [], groups: [], topN: '', totals: false },
  totals: { measures: [], groups: [] },
  reconcile: { pairs: [{ measure: '', agg: 'SUM', col: '', table: '' }], groups: [], tol: '0.01' },
  rels: { off: [], detail: '' },
  profile: { table: '' },
  filters: []
});
const CHECKS = [
  { key: 'results', name: 'Measure results', desc: 'Measures broken down by any columns, with filters. Compare with a report or a known number.' },
  { key: 'totals', name: 'Totals add up', desc: 'Does the grand total equal the sum of its rows? Catches double counting and broken totals.' },
  { key: 'reconcile', name: 'Reconcile with the source', desc: 'Measures next to a plain SUM or COUNT of a column, row by row, with differences flagged.' },
  { key: 'rels', name: 'Relationship health', desc: 'Keys with no match on the other side, the rows they affect, and blank keys.' },
  { key: 'profile', name: 'Table profile', desc: 'Rows, blanks, distinct values and lowest and highest values for every column.' }
];
const LOOK_FOR = {
  results: '<b>What to look for:</b> compare the numbers with a visual or a figure you trust. Rows where every measure is blank are left out, which is normal. With subtotals, the rows marked TRUE in a <i>total</i> column are the subtotals and grand total.',
  totals: '<b>What to look for:</b> for sums and counts, <b>Difference</b> should be 0. If it isn&rsquo;t, rows may be counted twice, some rows may fall outside every group (look for a blank group), or the measure may change its logic at the total. Distinct counts, averages and percentages aren&rsquo;t expected to add up.',
  reconcile: '<b>What to look for:</b> rows with <b>Matches</b> = FALSE come first. A difference usually means the measure applies extra logic (a filter, a status, a currency or a date rule). That can be right, but you should be able to explain it. A blank <b>Source value</b> with <b>Source rows</b> = 0 means no rows of the source table link to that row: the source is a different table from the one the measure reads, the relationship doesn&rsquo;t reach it, or the keys don&rsquo;t match (run Relationship health). Source rows above 0 with a blank Source value means those rows are blank in that column.',
  rels: '<b>What to look for:</b> <b>Rows with no match</b> should be 0. Those rows appear under a blank value in visuals and aren&rsquo;t filtered by the other table. Use the second query to list the missing keys, then add them to the lookup table or fix the keys at the source. Blank keys are worth a look too.',
  profile: '<b>What to look for:</b> blanks where you don&rsquo;t expect them, a <b>Distinct</b> of 1 (a column that never changes), key columns where Distinct is lower than Rows, and odd lowest or highest values such as 1900-01-01, 0 or negative amounts.'
};

/* ---------- state + UI ---------- */
const $ = id => document.getElementById(id);
const PREFIX = 'kvq.';
const store = {
  get(k){ try { return localStorage.getItem(PREFIX + k); } catch (e) { return null; } },
  set(k, v){ try { localStorage.setItem(PREFIX + k, v); } catch (e) {} }
};
const state = { model: null, example: false, cfg: BLANK_CFG(), out: {} };

function esc(s){ return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function msg(level, html){ return '<div class="msg ' + level + '">' + html + '</div>'; }
const DAX_KW = /\b(DEFINE|EVALUATE|ORDER BY|VAR|RETURN|SUMMARIZECOLUMNS|ROLLUPADDISSUBTOTAL|TREATAS|FILTER|ALL|CALCULATE|ADDCOLUMNS|UNION|ROW|TOPN|SUMX|COUNTROWS|COUNTBLANK|DISTINCTCOUNT|DISTINCT|EXCEPT|CONCATENATEX|ISBLANK|NOT|IN|ABS|DATE|TRUE|FALSE|SUM|COUNT|MIN|MAX|AVERAGE|ASC|DESC)\b/g;
function hl(code){
  return code.split('\n').map(line => {
    if (/^\s*\/\//.test(line)) return '<span class="tok-com">' + esc(line) + '</span>';
    return esc(line).replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)/g, '<span class="tok-str">$1</span>').replace(DAX_KW, '<span class="tok-kw">$1</span>');
  }).join('\n');
}
function copyText(text, btn){
  const done = () => { const o = btn.dataset.label || btn.textContent; btn.dataset.label = o; btn.textContent = 'Copied'; btn.classList.add('done'); setTimeout(() => { btn.textContent = o; btn.classList.remove('done'); }, 1600); };
  const fallback = () => {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    if (ok) done(); else { btn.textContent = 'Select and copy manually'; setTimeout(() => { btn.textContent = btn.dataset.label || 'Copy'; }, 2200); }
  };
  try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
}
function setExample(on){ state.example = on; $('exampleBanner').hidden = !on; }
function leaveExample(){ if (state.example) { setExample(false); persist(); } }
function persist(){
  if (state.example) return;
  store.set('model', $('modelInput').value);
  store.set('cfg', JSON.stringify(state.cfg));
}

/* ---------- pickers ---------- */
function colOptions(selected, placeholder, filterFn){
  const m = state.model; const byT = new Map();
  m.columns.filter(filterFn || (() => true)).forEach(c => { if (!byT.has(c.table)) byT.set(c.table, []); byT.get(c.table).push(c); });
  let h = '<option value="">' + esc(placeholder || 'Choose a column') + '</option>';
  [...byT.keys()].sort((a, b) => a.localeCompare(b)).forEach(t => {
    h += '<optgroup label="' + esc(t) + '">' + byT.get(t).map(c => { const k = colKey(c); return '<option value="' + esc(k) + '"' + (lc(k) === lc(selected || '') ? ' selected' : '') + '>' + esc(c.name) + (c.hidden ? ' (hidden)' : '') + '</option>'; }).join('') + '</optgroup>';
  });
  return h;
}
function measureOptions(selected){
  return '<option value="">Choose a measure</option>' + state.model.measures.slice().sort((a, b) => a.name.localeCompare(b.name)).map(m => '<option' + (lc(m.name) === lc(selected || '') ? ' selected' : '') + '>' + esc(m.name) + '</option>').join('');
}
function measureList(part){
  const sel = new Set((state.cfg[part].measures || []).map(lc));
  const q = lc(state.search[part] || '');
  const ms = state.model.measures.slice().sort((a, b) => a.name.localeCompare(b.name)).filter(m => !q || lc(m.name).includes(q) || lc(m.folder || '').includes(q));
  return '<div class="pick"><div class="pick-head"><span class="flabel">Measures</span><input type="text" class="search" data-act="search" data-part="' + part + '" placeholder="Search measures" value="' + esc(state.search[part] || '') + '" aria-label="Search measures"><span class="count">' + sel.size + ' picked</span></div>'
    + '<div class="mlist">' + (ms.length ? ms.map(m => '<label class="mrow"><input type="checkbox" data-act="measure" data-part="' + part + '" value="' + esc(m.name) + '"' + (sel.has(lc(m.name)) ? ' checked' : '') + '><span class="mname">' + esc(m.name) + '</span><span class="mmeta">' + esc(m.folder || m.table) + '</span></label>').join('') : '<p class="note" style="padding:8px 12px">No measures match.</p>') + '</div></div>';
}
function groupPicker(part, label){
  const gs = state.cfg[part].groups || [];
  return '<div class="field"><span class="flabel">' + esc(label) + '</span><div class="addrow"><select data-act="groupSel" data-part="' + part + '">' + colOptions('', 'Add a column') + '</select></div>'
    + '<div class="tchips">' + gs.map((g, i) => '<span class="tchip">' + esc(g) + '<button type="button" data-act="groupDel" data-part="' + part + '" data-i="' + i + '" aria-label="Remove ' + esc(g) + '">&times;</button></span>').join('') + '</div></div>';
}
function filterEditor(){
  const fs = state.cfg.filters;
  const rows = fs.map((f, i) => {
    const c = findCol(state.model, f.col), t = c ? valueType(c) : 'text';
    const valBox = f.op === 'between'
      ? '<input type="text" data-act="fFrom" data-i="' + i + '" value="' + esc(f.from || '') + '" placeholder="' + (t === 'date' ? '2025-01-01' : 'From') + '" aria-label="From"><span class="muted">and</span><input type="text" data-act="fTo" data-i="' + i + '" value="' + esc(f.to || '') + '" placeholder="' + (t === 'date' ? '2025-12-31' : 'To') + '" aria-label="To">'
      : f.op === 'blank' || f.op === 'notblank' ? '' : '<input type="text" class="wide" data-act="fVals" data-i="' + i + '" value="' + esc(f.values || '') + '" placeholder="' + (t === 'date' ? '2025-01-31, 2025-02-28' : t === 'num' ? '1, 2, 3' : 'Value, Another value') + '" aria-label="Values">';
    return '<div class="frow"><select data-act="fCol" data-i="' + i + '">' + colOptions(f.col) + '</select><select data-act="fOp" data-i="' + i + '">' + Object.entries(FILTER_OPS).map(([k, v]) => '<option value="' + k + '"' + (f.op === k ? ' selected' : '') + '>' + v + '</option>').join('') + '</select>' + valBox + '<button type="button" class="btn" data-act="fDel" data-i="' + i + '" aria-label="Remove filter">Remove</button></div>';
  }).join('');
  return '<div class="filters-box"><span class="flabel">Filters <span class="muted">(optional, applied to every number in the query)</span></span>' + rows
    + '<button type="button" class="linkbtn" data-act="fAdd">+ Add a filter</button><p class="note">Separate values with commas; put a value that contains a comma in quotes. Dates as 2026-01-31 or 1/31/2026.</p></div>';
}

/* ---------- render ---------- */
function renderModel(){
  const text = $('modelInput').value;
  const m = parseModel(text);
  state.model = null;
  $('modelMsg').innerHTML = m.error ? msg('err', esc(m.error)) : '';
  if (!m.error && (m.columns.length || m.measures.length)) state.model = m;
  $('work').hidden = !state.model;
  $('modelStats').innerHTML = state.model ? '<span class="stat"><b>' + m.tables.length + '</b> tables</span><span class="stat"><b>' + m.columns.length + '</b> columns</span><span class="stat"><b>' + m.measures.length + '</b> measures</span><span class="stat"><b>' + m.rels.length + '</b> relationships</span>' : '';
}
function renderChecks(){
  $('checks').innerHTML = CHECKS.map(c => '<button type="button" role="radio" aria-checked="' + (state.cfg.check === c.key) + '" data-check="' + c.key + '"><span class="tn">' + esc(c.name) + '</span><span class="td">' + esc(c.desc) + '</span></button>').join('');
}
function renderSetup(){
  const k = state.cfg.check, c = state.cfg[k], m = state.model;
  let h = '', hint = '';
  if (k === 'results') {
    hint = 'Pick the measures, the columns to break them down by, and any filters.';
    h = measureList('results') + groupPicker('results', 'Break down by (optional)')
      + '<div class="cfg"><div class="field"><label for="topN">Show only the top</label><input type="number" id="topN" data-act="topN" min="1" class="num" value="' + esc(c.topN || '') + '" placeholder="All"><span class="note">rows, by the first measure</span></div>'
      + '<label class="chk"><input type="checkbox" data-act="totals"' + (c.totals ? ' checked' : '') + '> Add subtotals and a grand total</label></div>' + filterEditor();
  } else if (k === 'totals') {
    hint = 'Pick the measures and the column to split them by. The query adds up the rows and compares them with the grand total.';
    h = measureList('totals') + groupPicker('totals', 'Split the total by') + filterEditor();
  } else if (k === 'reconcile') {
    hint = 'Add each measure with the plain calculation it should match. All pairs run in one query.';
    const pair = (p, i) => '<div class="frow pair"><span class="pnum">' + (i + 1) + '</span><select data-act="rcMeasure" data-i="' + i + '" aria-label="Measure">' + measureOptions(p.measure) + '</select>'
      + '<span class="muted">should match the</span><select data-act="rcAgg" data-i="' + i + '" aria-label="Calculation">' + Object.entries(AGGS).map(([a, l]) => '<option value="' + a + '"' + (p.agg === a ? ' selected' : '') + '>' + l + '</option>').join('') + '</select>'
      + (p.agg === 'COUNTROWS'
        ? '<span class="muted">of</span><select data-act="rcTable" data-i="' + i + '" aria-label="Table"><option value="">Choose a table</option>' + m.tables.map(t => '<option value="' + esc(t.name) + '"' + (lc(t.name) === lc(p.table) ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('') + '</select>'
        : '<span class="muted">of</span><select data-act="rcCol" data-i="' + i + '" aria-label="Column">' + colOptions(p.col, 'Choose a column', col => ['SUM', 'AVERAGE'].includes(p.agg) ? valueType(col) === 'num' : true) + '</select>')
      + (c.pairs.length > 1 ? '<button type="button" class="btn" data-act="rcDel" data-i="' + i + '" aria-label="Remove pair ' + (i + 1) + '">Remove</button>' : '') + '</div>';
    h = '<div class="filters-box"><span class="flabel">Measures to check</span>' + c.pairs.map(pair).join('') + '<button type="button" class="linkbtn" data-act="rcAdd">+ Add a measure</button></div>'
      + '<div class="cfg"><div class="field"><label for="rcTol">Allowed difference</label><input type="number" id="rcTol" data-act="rcTol" step="any" min="0" class="num" value="' + esc(c.tol) + '"></div></div>'
      + groupPicker('reconcile', 'Compare row by row, by (optional)') + filterEditor();
  } else if (k === 'rels') {
    hint = 'Untick relationships you don&rsquo;t want to check. Pick one for the second query that lists its missing keys.';
    const off = new Set(c.off.map(lc));
    h = m.rels.length ? '<div class="rlist">' + m.rels.map((r, i) => {
      const key = relKey(r);
      return '<label class="rrow"><input type="checkbox" data-act="rel" value="' + esc(key) + '"' + (!off.has(lc(key)) ? ' checked' : '') + '><span class="mname">' + esc(r.fromTable + '[' + r.fromColumn + ']') + ' &rarr; ' + esc(r.toTable + '[' + r.toColumn + ']') + '</span><span class="mmeta">' + esc((r.fromCard || '?') + ':' + (r.toCard || '?')) + (r.inactive ? ', inactive' : '') + (r.limited ? ', limited' : '') + '</span></label>';
    }).join('') + '</div><div class="field"><label for="relDet">List the missing keys for</label><select id="relDet" data-act="relDetail">' + m.rels.map(r => '<option value="' + esc(relKey(r)) + '"' + (lc(relKey(r)) === lc(c.detail || relKey(m.rels[0])) ? ' selected' : '') + '>' + esc(r.fromTable + '[' + r.fromColumn + '] → ' + r.toTable + '[' + r.toColumn + ']') + '</option>').join('') + '</select></div>'
      + (m.rels.some(r => r.limited) ? msg('info', 'Limited relationships cross to another source or are many-to-many. Checking them can be slow, or may not be allowed for DirectQuery sources.') : '')
      : msg('info', 'The export has no relationships.');
  } else if (k === 'profile') {
    hint = 'Pick a table. Every column in it gets a row in the results.';
    h = '<div class="field"><label for="pfT">Table</label><select id="pfT" data-act="pfTable"><option value="">Choose a table</option>' + m.tables.map(t => '<option value="' + esc(t.name) + '"' + (lc(t.name) === lc(c.table) ? ' selected' : '') + '>' + esc(t.name) + ' (' + m.columns.filter(x => lc(x.table) === lc(t.name)).length + ' columns)</option>').join('') + '</select></div>';
  }
  $('setupHint').innerHTML = hint;
  $('setup').innerHTML = h;
}
function renderOut(){
  const k = state.cfg.check, c = state.cfg[k], m = state.model, fs = state.cfg.filters;
  const outs = [];
  let r;
  if (k === 'results') outs.push({ t: 'Measure results', r: qResults(m, c, fs) });
  if (k === 'totals') outs.push({ t: 'Totals check', r: qTotals(m, c, fs) });
  if (k === 'reconcile') outs.push({ t: 'Reconciliation (' + c.pairs.length + ' measure' + (c.pairs.length === 1 ? '' : 's') + ')', r: qReconcile(m, c, fs) });
  if (k === 'rels') {
    const off = new Set(c.off.map(lc));
    outs.push({ t: 'Relationship health', r: qRelSummary(m, m.rels.filter(x => !off.has(lc(relKey(x))))) });
    const det = m.rels.find(x => lc(relKey(x)) === lc(c.detail)) || m.rels[0];
    if (det) outs.push({ t: 'Missing keys: ' + det.fromTable + '[' + det.fromColumn + ']', r: qRelDetail(m, det) });
  }
  if (k === 'profile') {
    const t = m.tables.find(x => lc(x.name) === lc((c.table || '').replace(/ \(\d+ columns\)$/, '')));
    outs.push({ t: 'Table profile', r: qProfile(m, t ? t.name : '') });
  }
  const errs = outs.filter(o => o.r.error).map(o => o.r.error);
  const warns = [].concat(...outs.map(o => o.r.warnings || []));
  $('outMsg').innerHTML = (errs.length ? msg('warn', esc(errs[0])) : '') + warns.map(w => msg('warn', esc(w))).join('');
  state.out = { export: DAX_QUERY };
  $('outs').innerHTML = outs.filter(o => !o.r.error).map((o, i) => { state.out['q' + i] = o.r.code; return '<div class="codebox"><div class="codebox-bar"><span class="t">' + esc(o.t) + '</span><span class="r"><button class="btn primary" type="button" data-copy="q' + i + '">Copy query</button></span></div><pre class="tall">' + hl(o.r.code) + '</pre></div>'; }).join('');
  $('lookFor').innerHTML = LOOK_FOR[k];
  $('lookFor').hidden = !!errs.length && !outs.some(o => !o.r.error);
}
function renderAll(){ renderModel(); if (state.model) { renderChecks(); renderSetup(); renderOut(); } }
function refresh(keepFocus){
  const a = document.activeElement, id = a && a.dataset ? a.dataset.act + '|' + (a.dataset.i || '') + '|' + (a.dataset.part || '') : '';
  const pos = a && typeof a.selectionStart === 'number' ? a.selectionStart : null;
  renderSetup(); renderOut(); persist();
  if (keepFocus && id) {
    const el = [...$('setup').querySelectorAll('[data-act]')].find(e => e.dataset.act + '|' + (e.dataset.i || '') + '|' + (e.dataset.part || '') === id);
    if (el) { el.focus(); if (pos !== null && el.setSelectionRange) try { el.setSelectionRange(pos, pos); } catch (e) {} }
  }
}
// Keep only choices that exist in the current model
function pruneCfg(){
  const m = state.model; if (!m) return;
  const cfg = state.cfg;
  ['results', 'totals'].forEach(p => { cfg[p].measures = cfg[p].measures.filter(n => findMeasure(m, n)); });
  ['results', 'totals', 'reconcile'].forEach(p => { cfg[p].groups = cfg[p].groups.filter(g => findCol(m, g)); });
  cfg.reconcile.pairs.forEach(p => { if (p.measure && !findMeasure(m, p.measure)) p.measure = ''; if (p.col && !findCol(m, p.col)) p.col = ''; });
  cfg.filters = cfg.filters.filter(f => !f.col || findCol(m, f.col));
}

function init(){
  state.search = {};
  $('exportView').textContent = DAX_QUERY;
  const saved = store.get('model');
  let cfg = null; try { cfg = JSON.parse(store.get('cfg') || 'null'); } catch (e) {}
  if (saved && saved.trim() && saved !== EX_MODEL) {
    $('modelInput').value = saved;
    state.cfg = Object.assign(BLANK_CFG(), cfg || {});
    const rc = state.cfg.reconcile;
    if (!Array.isArray(rc.pairs)) state.cfg.reconcile = { pairs: [{ measure: rc.measure || '', agg: rc.agg || 'SUM', col: rc.col || '', table: rc.table || '' }], groups: rc.groups || [], tol: rc.tol || '0.01' };
  } else if (store.get('blank') !== '1') { $('modelInput').value = EX_MODEL; state.cfg = EX_CFG(); setExample(true); }
  renderModel(); pruneCfg(); renderAll();

  $('modelInput').addEventListener('input', () => {
    if (state.example) { state.cfg = BLANK_CFG(); setExample(false); }
    try { localStorage.removeItem(PREFIX + 'blank'); } catch (e) {}
    renderModel(); pruneCfg(); renderAll(); persist();
  });
  $('checks').addEventListener('click', e => { const b = e.target.closest('[data-check]'); if (!b) return; leaveExample(); state.cfg.check = b.dataset.check; renderChecks(); refresh(); });
  const S = $('setup');
  S.addEventListener('input', e => {
    const t = e.target, a = t.dataset.act, cfg = state.cfg; if (!a) return;
    leaveExample();
    if (a === 'search') { state.search[t.dataset.part] = t.value; return refresh(true); }
    if (a === 'fVals') { cfg.filters[+t.dataset.i].values = t.value; return refresh(true); }
    if (a === 'fFrom') { cfg.filters[+t.dataset.i].from = t.value; return refresh(true); }
    if (a === 'fTo') { cfg.filters[+t.dataset.i].to = t.value; return refresh(true); }
    if (a === 'topN') { cfg.results.topN = t.value; return refresh(true); }
    if (a === 'rcTol') { cfg.reconcile.tol = t.value; return refresh(true); }
  });
  S.addEventListener('change', e => {
    const t = e.target, a = t.dataset.act, cfg = state.cfg; if (!a) return;
    leaveExample();
    if (a === 'measure') { const p = cfg[t.dataset.part]; p.measures = p.measures.filter(n => lc(n) !== lc(t.value)).concat(t.checked ? [t.value] : []); }
    else if (a === 'groupSel') { const p = cfg[t.dataset.part]; if (t.value && !p.groups.some(g => lc(g) === lc(t.value))) p.groups.push(t.value); }
    else if (a === 'totals') cfg.results.totals = t.checked;
    else if (a === 'fCol') { const f = cfg.filters[+t.dataset.i]; f.col = t.value; }
    else if (a === 'fOp') cfg.filters[+t.dataset.i].op = t.value;
    else if (a === 'rcMeasure') cfg.reconcile.pairs[+t.dataset.i].measure = t.value;
    else if (a === 'rcAgg') cfg.reconcile.pairs[+t.dataset.i].agg = t.value;
    else if (a === 'rcCol') { const p = cfg.reconcile.pairs[+t.dataset.i]; p.col = t.value; const c = findCol(state.model, t.value); if (c) p.table = c.table; }
    else if (a === 'rcTable') cfg.reconcile.pairs[+t.dataset.i].table = t.value;
    else if (a === 'rel') { cfg.rels.off = cfg.rels.off.filter(x => lc(x) !== lc(t.value)).concat(t.checked ? [] : [t.value]); }
    else if (a === 'relDetail') cfg.rels.detail = t.value;
    else if (a === 'pfTable') cfg.profile.table = t.value;
    else return;
    refresh();
  });
  S.addEventListener('click', e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const a = b.dataset.act, cfg = state.cfg;
    leaveExample();
    if (a === 'groupDel') cfg[b.dataset.part].groups.splice(+b.dataset.i, 1);
    else if (a === 'rcAdd') { const last = cfg.reconcile.pairs[cfg.reconcile.pairs.length - 1] || {}; cfg.reconcile.pairs.push({ measure: '', agg: last.agg || 'SUM', col: '', table: last.table || '' }); }
    else if (a === 'rcDel') cfg.reconcile.pairs.splice(+b.dataset.i, 1);
    else if (a === 'fAdd') cfg.filters.push({ col: '', op: 'in', values: '', from: '', to: '' });
    else if (a === 'fDel') cfg.filters.splice(+b.dataset.i, 1);
    else return;
    refresh();
  });
  $('clearAll').addEventListener('click', () => { $('modelInput').value = ''; state.cfg = BLANK_CFG(); setExample(false); try { localStorage.setItem(PREFIX + 'blank', '1'); } catch (e) {} renderAll(); persist(); $('modelInput').focus(); });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    const v = b.dataset.copy === 'export' ? DAX_QUERY : state.out[b.dataset.copy]; if (v) copyText(v, b);
  });
}
init();

/* ---------- Clear entries ---------- */
(function(){
  const btn = $('clearEntries'), box = $('clearConfirm'), done = $('clearDone');
  const show = on => { box.hidden = !on; btn.setAttribute('aria-expanded', on); if (on) { done.hidden = true; $('clearNo').focus(); } };
  btn.addEventListener('click', () => show(box.hidden));
  $('clearNo').addEventListener('click', () => { show(false); btn.focus(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) { show(false); btn.focus(); } });
  $('clearYes').addEventListener('click', () => {
    try { Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k)); } catch (e) {}
    $('modelInput').value = ''; state.cfg = BLANK_CFG(); state.search = {}; setExample(false); renderAll();
    try { localStorage.setItem(PREFIX + 'blank', '1'); } catch (e) {}
    persist();
    show(false); done.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => { done.hidden = true; }, 6000);
  });
})();
