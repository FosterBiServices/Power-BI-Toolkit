
/* ---------- Time Intelligence Builder page ---------- */
const $ = id => document.getElementById(id);
const PREFIX = 'kti.';
const store = {
  get(k){ try { return localStorage.getItem(PREFIX + k); } catch (e) { return null; } },
  set(k, v){ try { localStorage.setItem(PREFIX + k, v); } catch (e) {} }
};
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function copyText(text, btn){
  const done = () => { const o = btn.dataset.label || btn.textContent; btn.dataset.label = o; btn.textContent = 'Copied'; btn.classList.add('done'); setTimeout(() => { btn.textContent = o; btn.classList.remove('done'); }, 1600); };
  const fallback = () => { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta); if (ok) done(); };
  try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
}
function hl(code){
  return esc(code).split('\n').map(l => {
    if (/^\s*(\/\/|--)/.test(l)) return '<span class="tok-com">' + l + '</span>';
    return l.replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)/g, '<span class="tok-str">$1</span>')
      .replace(/\b(createOrReplace|ref table|table|column|measure|calculationGroup|calculationItem|formatStringDefinition|DEFINE|MEASURE|EVALUATE|SUMMARIZECOLUMNS|ORDER BY|CALCULATE|DATESYTD|DATESQTD|DATESMTD|SAMEPERIODLASTYEAR|DATEADD|DATESINPERIOD|DIVIDE|DATATABLE|INTEGER|SELECTCOLUMNS|DISTINCT|ISINSCOPE|COALESCE|MAXX|TREATAS|FORMAT|partition|calculated|VAR|RETURN|IF|NOT|ISBLANK|SELECTEDMEASURE|BLANK|MIN|MAX|MINX|AVERAGEX|CALCULATETABLE|PREVIOUSYEAR|PARALLELPERIOD|REMOVEFILTERS|COLUMN|TRUE|YEAR|MONTH|SELECTEDVALUE|VALUES|FILTER|ALL|COUNTROWS|INT|MOD)\b/g, '<span class="tok-kw">$1</span>');
  }).join('\n');
}

const blankCfg = () => ({ output: 'measures', dateTable: '', dateColumn: '', fyEnd: 12, grain: 'day', mcols: {}, basis: 'latest', dataDate: '', calcs: ['ytd', 'pytd', 'yoyp'], names: {}, pctFormat: '0.0%',
  measures: [], target: '', namePattern: 'suffix', folderMode: 'fixed', folder: 'Time Intelligence', groupTable: 'Time Intelligence', groupColumn: 'Show as', precedence: 10, testBy: '', testMeasure: '', trLabel: null, trSort: null, ...TI_TR_DEF });
const state = { example: false, model: null, cfg: blankCfg(), out: {} };

function persist(){
  store.set('model', state.example ? '' : $('modelInput').value);
  store.set('cfg', JSON.stringify(state.example ? blankCfg() : state.cfg));
}
function setExample(on){ state.example = on; $('exampleBanner').hidden = !on; }
function leaveExample(){ if (state.example) setExample(false); }

/* sensible defaults from the model */
function autoPick(){
  const m = state.model, c = state.cfg; if (!m) return;
  // picks the model doesn't have (made for an earlier model) are dropped: they'd be invisible in the list yet still checked
  c.measures = (c.measures || []).filter(n => m.measures.some(x => lc(x.name) === lc(n)));
  const dateTables = m.tables.filter(t => lc(t.category) === 'time');
  const dateCols = t => m.columns.filter(x => lc(x.table) === lc(t) && /date/i.test(x.dataType || ''));
  if (c.grain === 'month') {
    if (!m.tables.some(t => lc(t.name) === lc(c.dateTable))) { const t = dateTablesOf(m)[0] || m.tables.find(t => /date|calendar|month|period/i.test(t.name)) || m.tables[0]; c.dateTable = t ? t.name : ''; }
    const cols = m.columns.filter(x => lc(x.table) === lc(c.dateTable) && tiNumeric(x)), mc = c.mcols || (c.mcols = {});
    TI_MCOLS.forEach(k => {
      const v = mc[k.key];
      if (v === '' && k.add) return;
      if (v && cols.some(x => lc(x.name) === lc(v))) return;
      const hit = cols.find(x => k.re.test(x.name.trim()));
      mc[k.key] = hit ? hit.name : '';
    });
  } else if (!m.tables.some(t => lc(t.name) === lc(c.dateTable))) {
    const t = dateTables[0] || m.tables.find(t => tiCalcDateTable(t) && dateCols(t.name).length) || m.tables.find(t => /date|calendar/i.test(t.name) && dateCols(t.name).length) || m.tables.find(t => dateCols(t.name).length);
    c.dateTable = t ? t.name : '';
    c.dateColumn = '';
  }
  if (c.dateTable && !dateCols(c.dateTable).some(x => lc(x.name) === lc(c.dateColumn))) {
    const cols = dateCols(c.dateTable);
    const k = cols.find(x => x.key) || cols.find(x => lc(x.name) === 'date') || cols[0];
    c.dateColumn = k ? k.name : '';
  }
  // trend columns: null = not chosen yet, '' = add it
  const tCols = m.columns.filter(x => lc(x.table) === lc(c.dateTable));
  [['trSort', /^(year ?)?month ?(sort|index|seq(uence)?|order)$|^year ?month ?(number|index)$/i, true], ['trLabel', /^(year ?month|month ?year|month ?(and|&) ?year)( ?(name|label))?$/i]].forEach(([k, re, num]) => {
    const v = c[k];
    if (v === '' || (v && tCols.some(x => lc(x.name) === lc(v)))) return;
    const hit = tCols.find(x => re.test(x.name.trim()) && (!num || tiNumeric(x)));
    c[k] = hit ? hit.name : null;
  });
  if (!(c.target || '').trim()) {
    const first = m.measures.find(x => (c.measures || []).some(n => lc(n) === lc(x.name))) || m.measures[0];
    c.target = first ? first.table : '';
  }
  const dd = tiDataDateOptions(m, c);
  if (!dd.some(o => lc(o.v) === lc(c.dataDate))) c.dataDate = dd[0] ? dd[0].v : '';
  const byOpts = testByOptions();
  if (!byOpts.some(o => o.v === c.testBy)) { const y = byOpts.find(o => /\|year$/i.test(o.v)) || byOpts.find(o => /year/i.test(o.v)) || byOpts[0]; c.testBy = y ? y.v : ''; }
  if (!m.measures.some(x => lc(x.name) === lc(c.testMeasure))) c.testMeasure = (c.measures[0] || (m.measures[0] || {}).name || '');
}
function testByOptions(){
  const m = state.model, c = state.cfg; if (!m || !c.dateTable) return [];
  return m.columns.filter(x => lc(x.table) === lc(c.dateTable) && !x.hidden).map(x => ({ v: x.table + '|' + x.name, t: qName(x.table) + bracket(x.name) }));
}

/* ---------- render ---------- */
function renderModel(){
  const text = $('modelInput').value;
  const m = text.trim() ? parseModel(text) : null;
  state.model = m && !m.error ? m : null;
  $('modelMsg').innerHTML = m && m.error ? '<div class="msg err">' + esc(m.error) + '</div>' : '';
  $('modelStats').innerHTML = state.model ? '<span class="stat"><b>' + state.model.measures.length + '</b> measures</span><span class="stat"><b>' + dateTablesOf(state.model).length + '</b> date tables</span><span class="stat"><b>' + state.model.tables.length + '</b> tables</span>' : '';
  autoPick();
}
const opt = (v, t, sel) => '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(t) + '</option>';
function renderDates(){
  const m = state.model, c = state.cfg;
  if (!m) { ['dTable', 'dCol', 'dataDate'].forEach(id => { $(id).innerHTML = '<option value="">After Step 1</option>'; }); $('dateMsg').innerHTML = ''; }
  else {
    const month = c.grain === 'month';
    const withDates = month ? m.tables.filter(t => m.columns.some(x => lc(x.table) === lc(t.name) && tiNumeric(x))) : m.tables.filter(t => m.columns.some(x => lc(x.table) === lc(t.name) && /date/i.test(x.dataType || '')));
    $('dTable').innerHTML = (withDates.length ? '' : '<option value="">No table has a date column</option>') + withDates.map(t => opt(t.name, t.name + (lc(t.category) === 'time' ? '  (date table)' : tiCalcDateTable(t) ? '  (calculated date table)' : ''), lc(t.name) === lc(c.dateTable))).join('');
    const dd = tiDataDateOptions(m, c);
    $('dataDate').innerHTML = dd.length ? dd.map(o => opt(o.v, o.t, lc(o.v) === lc(c.dataDate))).join('') : '<option value="">No fact date column</option>';
    $('monthCols').innerHTML = month ? tiMonthColsNeeded(c).map(k => {
      const cols = m.columns.filter(x => lc(x.table) === lc(c.dateTable) && tiNumeric(x)), v = (c.mcols || {})[k.key] || '';
      return '<div class="field"><label for="mc_' + k.key + '">' + esc(k.label) + '</label><select id="mc_' + k.key + '" data-mcol="' + k.key + '">'
        + opt('', k.fromDate ? (tiMonthDateCol(m, c) ? 'Work it out from ' + tiMonthDateCol(m, c) : 'Choose a column') : 'Add it (hidden column)', !v) + cols.map(x => opt(x.name, x.name, lc(x.name) === lc(v))).join('') + '</select></div>';
    }).join('') : '';
    $('dCol').innerHTML = m.columns.filter(x => lc(x.table) === lc(c.dateTable) && /date/i.test(x.dataType || '')).map(x => opt(x.name, x.name + (x.key ? '  (key)' : ''), lc(x.name) === lc(c.dateColumn))).join('');
  }
  if (m) {
    const tCols = m.columns.filter(x => lc(x.table) === lc(c.dateTable)), dc = tiMonthDateCol(m, c);
    const addOpt = (k, what) => opt('', dc ? 'Add it (' + what + ', from ' + dc + ')' : 'Choose a column', !c[k]);
    $('trLabel').innerHTML = addOpt('trLabel', TI_TR_ADD.label) + tCols.map(x => opt(x.name, x.name, lc(x.name) === lc(c.trLabel || ''))).join('');
    $('trSort').innerHTML = addOpt('trSort', TI_TR_ADD.sort) + tCols.filter(tiNumeric).map(x => opt(x.name, x.name, lc(x.name) === lc(c.trSort || ''))).join('');
  } else ['trLabel', 'trSort'].forEach(id => { $(id).innerHTML = '<option value="">After Step 1</option>'; });
  $('fyEnd').innerHTML = TI_MONTHS.map((n, i) => opt(i + 1, n + (i === 11 ? ' (calendar year)' : ''), (+c.fyEnd || 12) === i + 1)).join('');
  const month = c.grain === 'month';
  $('grain').value = month ? 'month' : 'day';
  const trend = c.output === 'trend';
  $('dColField').hidden = month || trend; $('monthCols').hidden = !month || trend; $('dayNote').hidden = month || trend; $('monthNote').hidden = !month || trend; $('basisHint').hidden = trend;
  $('dataDateField').hidden = (month && c.basis === 'context') || trend;
  $('dataDateLbl').textContent = month ? 'Last month with data from' : 'Last date with data from';
  $('basis').value = c.basis === 'context' ? 'context' : 'latest';
  if (month) $('basisHint').textContent = c.basis === 'context'
    ? 'The pattern\u2019s measures as they are: each uses the months in the filter. Previous year and previous month show blank when the filter covers more than one year or month.'
    : 'The same pattern measures, worked out on the last month with data in the filter. A card or total shows one period (this year to date, last year in full, last month in full).';
  else $('basisHint').textContent = c.basis === 'context'
    ? 'The pattern\u2019s measures as they are: each uses every date in the filter. With no date in the visual, last year and previous month add up every date shifted back.'
    : 'The same pattern measures, worked out on the last date with data in the filter. A card or total shows one period (this year to date, last year in full, last month in full), and growth compares to the same day.';
}
function renderCalcs(){
  const c = state.cfg;
  const list = tiCalcList(c);
  $('calcs').innerHTML = TI_GROUPS.map(g => [g, list.filter(k => g.keys.includes(k.key))]).filter(([, ks]) => ks.length).map(([g, ks]) => '<h4 class="calc-grp">' + esc(g.name) + '</h4>' + ks.map(k => {
    const on = c.calcs.includes(k.key);
    return '<div class="calc' + (on ? ' on' : '') + '"><label class="ck"><input type="checkbox" data-calc="' + k.key + '"' + (on ? ' checked' : '') + '> <span><b>' + esc(k.name) + '</b><span class="cd">' + esc(k.label.replace(/, %$/, '')) + (k.kind === 'pct' ? ' · percent' : '') + '</span></span></label>'
      + '<input type="text" class="cname" data-name="' + k.key + '" value="' + esc((c.names || {})[k.key] || '') + '" placeholder="' + esc(k.name) + '" aria-label="Name for ' + esc(k.label) + '"' + (on ? '' : ' disabled') + '></div>';
  }).join('')).join('');
}
// growth measures can build on the measures they compare; ask to add any that aren't ticked
function renderDepAsk(){
  const c = state.cfg, missing = tiMissingDeps(c), box = $('depAsk');
  box.hidden = !missing.length;
  if (!missing.length) return;
  const needs = tiSelectedCalcs(c).filter(x => x.dep && !tiDepsMet(c, x)).map(x => '<b>' + esc(tiCalcName(c, x)) + '</b>');
  const adds = missing.map(x => '<b>' + esc(tiCalcName(c, x)) + '</b>');
  const list = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  box.innerHTML = c.depMode === 'inline'
    ? '<span>' + list(needs) + ' ' + (needs.length === 1 ? 'is written as a full formula' : 'are written as full formulas') + '.</span><span class="btns"><button type="button" class="btn" data-dep="add">Add ' + list(adds) + ' and build on them</button></span>'
    : '<span>' + list(needs) + ' can build on ' + list(adds) + ' measures instead of repeating their formulas. Add ' + (missing.length === 1 ? 'it' : 'them') + ' too?</span><span class="btns"><button type="button" class="btn primary" data-dep="add">Add ' + (missing.length === 1 ? 'it' : 'them') + '</button><button type="button" class="btn" data-dep="inline">No, write the full formulas</button></span>';
}
function tiFolderOptions(m){
  const set = new Set();
  m.measures.forEach(x => { const f = normFolder(x.folder || ''); if (!f) return; const parts = f.split('\\'); for (let i = 1; i <= parts.length; i++) set.add(parts.slice(0, i).join('\\')); });
  return [...set].sort((a, b) => a.localeCompare(b));
}
function renderDestHint(){
  const c = state.cfg, f = normFolder(c.folder), m = state.model;
  const ex = m && m.measures.find(x => c.measures.some(n => lc(n) === lc(x.name)));
  const sample = ex ? tiFolder(c, ex) : '';
  $('destHint').innerHTML = !f && c.folderMode === 'fixed' ? 'No folder: the measures go at the top of the table.'
    : 'Pick a folder from your model or type a new one.' + (sample ? ' For example, the ' + esc(ex.name) + ' measures go in <span class="mono">' + esc(sample) + '</span>.' : '');
}
function renderOutputKind(){
  const o = state.cfg.output, g = o === 'group', t = o === 'trend';
  $('destBox').hidden = g;
  $('outMeasures').setAttribute('aria-checked', o !== 'group' && !t); $('outGroup').setAttribute('aria-checked', g); $('outTrend').setAttribute('aria-checked', t);
  document.querySelectorAll('.only-measures').forEach(el => { el.hidden = g; });
  document.querySelectorAll('.only-group').forEach(el => { el.hidden = !g; });
  document.querySelectorAll('.only-trend').forEach(el => { el.hidden = !t; });
  document.querySelectorAll('.no-trend').forEach(el => { el.hidden = t; });
  $('s3Lede').innerHTML = t ? 'Pick the measures to trend and the months readers can choose. Each new measure keeps its measure&rsquo;s format.' : 'Tick the calculations you want and rename them if you like. Percent calculations get the percent format; the others keep each measure&rsquo;s own format.';
}
function renderMeasures(){
  const m = state.model, c = state.cfg;
  if (!m) { $('mList').innerHTML = '<p class="note small" style="padding:10px 12px">Measures appear here after Step 1.</p>'; $('target').innerHTML = ''; $('planInfo').textContent = ''; return; }
  const q = lc($('search').value.trim());
  const list = m.measures.filter(x => !q || lc(x.name).includes(q) || lc(x.folder).includes(q));
  $('mList').innerHTML = list.map(x => '<label class="mrow"><input type="checkbox" data-m="' + esc(x.name) + '"' + (c.measures.some(n => lc(n) === lc(x.name)) ? ' checked' : '') + '><span class="mname">' + esc(x.name) + '</span><span class="mmeta">' + esc([x.table, x.folder, x.formatString].filter(Boolean).join(' · ')) + '</span></label>').join('') || '<p class="note small" style="padding:10px 12px">No measures match.</p>';
  $('destTables').innerHTML = m.tables.filter(t => !t.remote).map(t => '<option value="' + esc(t.name) + '"></option>').join('');
  $('destFolders').innerHTML = tiFolderOptions(m).map(f => '<option value="' + esc(f) + '"></option>').join('');
  if (document.activeElement !== $('target')) $('target').value = c.target;
  const n = c.measures.length * tiSelectedCalcs(c).length;
  if (c.output === 'trend') { $('planInfo').innerHTML = c.measures.length ? '<b>' + c.measures.length + '</b> trend measure' + (c.measures.length === 1 ? '' : 's') + ', one for each measure you tick.' : 'Tick the measures to build on.'; return; }
  $('planInfo').innerHTML = c.measures.length ? '<b>' + c.measures.length + '</b> measure' + (c.measures.length === 1 ? '' : 's') + ' × <b>' + tiSelectedCalcs(c).length + '</b> calculation' + (tiSelectedCalcs(c).length === 1 ? '' : 's') + ' = <b>' + n + '</b> new measures.' : 'Tick the measures to build on.';
}
function renderOut(){
  const c = state.cfg, m = state.model;
  if (!m) { $('checks').innerHTML = '<div class="msg info">Paste your model export in Step 1.</div>'; $('outBox').hidden = true; state.out = {}; return; }
  const checks = tiCheck(m, c), errs = checks.filter(x => x.level === 'err');
  $('checks').innerHTML = checks.map(x => '<div class="msg ' + x.level + '">' + esc(x.text) + '</div>').join('') || '<div class="msg ok">&#10003; Every name checks out against the export.</div>';
  $('outBox').hidden = !!errs.length;
  if (errs.length) { state.out = {}; return; }
  const g = c.output === 'group', t = c.output === 'trend', after = g || t;
  $('testBy').innerHTML = testByOptions().map(o => opt(o.v, o.t, o.v === c.testBy)).join('');
  $('testMeasure').innerHTML = m.measures.map(x => opt(x.name, x.name, lc(x.name) === lc(c.testMeasure))).join('');
  state.out.tmdl = tiTmdl(m, c); state.out.test = tiTestQuery(m, c);
  $('tmdlView').innerHTML = hl(state.out.tmdl); $('testView').innerHTML = hl(state.out.test || '// Choose a column for the rows above.');
  $('testTitle').innerHTML = after ? '2. Test it <span class="muted">(DAX query view, after applying)</span>' : '1. Test the measures <span class="muted">(DAX query view, before applying)</span>';
  $('tmdlH').innerHTML = (after ? '1' : '2') + '. Add to the model <span class="muted">(TMDL view)</span>';
  const box = $('outBox'), tp = $('testPart'), mp = $('tmdlPart'), ap = box.querySelector('.apply');
  if (after) { box.insertBefore(mp, ap); box.insertBefore(tp, ap); } else { box.insertBefore(tp, ap); box.insertBefore(mp, ap); }
  const count = g ? tiSelectedCalcs(c).length + 1 : tiPlan(m, c).length;
  $('tmdlTitle').textContent = g ? 'TMDL script: calculation group' : t ? 'TMDL script: trend tables and measures' : 'TMDL script: measures';
  $('tmdlCount').textContent = count + (g ? ' calculation items' : ' measures');
  const st = esc(qName(tiTr(c, 'trSelTable'))), at = esc(qName(tiTr(c, 'trAxisTable'))), tc = tiTrendCols(c);
  $('applySteps').innerHTML = (t ? [
    'In Power BI Desktop, open <b>TMDL view</b>, paste the script into a new tab and select <b>Preview</b>: two new tables, ' + st + ' and ' + at + ', and the new measures' + (tiTrendAdds(m, c).length ? ', plus the new columns in ' + esc(qName(c.dateTable)) : '') + '.',
    'Select <b>Apply</b>, then run the test query above. In <b>Model view</b>, check that neither new table is related to anything (delete any relationship Power BI added).',
    'Build the chart: ' + esc(qName(tiTr(c, 'trAxisTable')) + bracket(tiTr(c, 'trAxisLabel'))) + ' on the X-axis and the trend measure as the values. Don&rsquo;t use the date table on the axis.',
    'Add a slicer on ' + esc(qName(c.dateTable) + bracket(tc.label)) + ' (single select) for the last month to show, and a slicer on ' + esc(qName(tiTr(c, 'trSelTable')) + bracket(tiTr(c, 'trSelCol'))) + ' (single select) for how many months. With no month picked, the chart ends at the last month in the date table.'
  ] : g ? [
    'In Power BI Desktop, open <b>TMDL view</b>, paste the script into a new tab and select <b>Preview</b>: one new table, ' + esc(qName(c.groupTable.trim())) + ', and nothing else changing.',
    'Select <b>Apply</b>. If Power BI says calculation groups need implicit measures turned off, open <b>Model view</b>, select the model in the Data pane and set <b>Discourage implicit measures</b> to On, then apply again.',
    'Add <b>' + esc(c.groupColumn.trim()) + '</b> to a slicer, or to a matrix&rsquo;s columns, next to any measure. Then run the test query above.',
    'Only measures work with a calculation group: a column dragged straight into a visual (an implicit measure) isn&rsquo;t changed.'
  ] : [
    'Run the test query first and compare a couple of values with a visual.',
    'In Power BI Desktop, open <b>TMDL view</b>, paste the script into a new tab and select <b>Preview</b>: only the new measures in ' + esc(qName(c.target)) + ' should appear.',
    'Select <b>Apply</b>. The measures appear in ' + (c.folderMode === 'fixed' && !c.folder.trim() ? 'the table' : 'their display folder') + ' straight away.'
  ]).map(s => '<li>' + s + '</li>').join('');
}
const TR_INPUTS = ['trOptions', 'trDefault', 'trName', 'trSelTable', 'trSelCol', 'trAxisTable', 'trAxisLabel', 'trAxisSort'].map(k => [k, k]);
function syncInputs(){
  const c = state.cfg;
  TR_INPUTS.concat([['pctFormat', 'pctFormat'], ['folder', 'folder'], ['gTable', 'groupTable'], ['gCol', 'groupColumn'], ['prec', 'precedence']]).forEach(([id, k]) => { if (document.activeElement !== $(id)) $(id).value = c[k]; });
  $('namePattern').value = c.namePattern; $('folderMode').value = c.folderMode;
}
function renderAll(){ renderModel(); renderDates(); renderCalcs(); renderOutputKind(); renderDepAsk(); renderMeasures(); syncInputs(); renderDestHint(); renderOut(); }

/* ---------- init ---------- */
function resetAll(){
  $('modelInput').value = ''; $('search').value = '';
  state.cfg = blankCfg(); setExample(false); $('modelBox').open = false;
  renderAll();
}
function init(){
  $('exportView').textContent = DAX_QUERY;
  const saved = store.get('model');
  let cfg = null; try { cfg = JSON.parse(store.get('cfg') || 'null'); } catch (e) {}
  if (saved && saved.trim()) { $('modelInput').value = saved; if (cfg) state.cfg = Object.assign(blankCfg(), cfg); }
  else if (store.get('blank') !== '1') { $('modelInput').value = FP_EX_MODEL; state.cfg = Object.assign(blankCfg(), { measures: ['Total Sales', 'Gross Margin'], calcs: ['ytd', 'pytd', 'yoyp', 'pm'] }); setExample(true); }
  else if (cfg) state.cfg = Object.assign(blankCfg(), cfg);
  renderAll();

  const c = () => state.cfg;
  const change = () => { leaveExample(); renderAll(); persist(); };
  $('modelInput').addEventListener('input', () => {
    if (state.example) { state.cfg = blankCfg(); setExample(false); }
    try { localStorage.removeItem(PREFIX + 'blank'); } catch (e) {}
    renderAll(); persist();
  });
  $('dTable').addEventListener('change', () => { c().dateTable = $('dTable').value; c().dateColumn = ''; c().trLabel = null; c().trSort = null; c().dataDate = ''; c().testBy = ''; change(); });
  $('grain').addEventListener('change', () => { c().grain = $('grain').value; change(); });
  $('monthCols').addEventListener('change', e => { const k = e.target.dataset.mcol; if (!k) return; (c().mcols = c().mcols || {})[k] = e.target.value; change(); });
  $('dCol').addEventListener('change', () => { c().dateColumn = $('dCol').value; change(); });
  $('fyEnd').addEventListener('change', () => { c().fyEnd = +$('fyEnd').value; change(); });
  $('basis').addEventListener('change', () => { c().basis = $('basis').value; change(); });
  $('dataDate').addEventListener('change', () => { c().dataDate = $('dataDate').value; change(); });
  $('outMeasures').addEventListener('click', () => { c().output = 'measures'; change(); });
  $('outGroup').addEventListener('click', () => { c().output = 'group'; change(); });
  $('outTrend').addEventListener('click', () => { c().output = 'trend'; change(); });
  [['trLabel', 'trLabel'], ['trSort', 'trSort']].forEach(([id, k]) => $(id).addEventListener('change', () => { c()[k] = $(id).value; change(); }));
  $('calcs').addEventListener('change', e => {
    const k = e.target.dataset.calc; if (!k) return;
    c().calcs = e.target.checked ? tiCalcList(c()).map(x => x.key).filter(x => x === k || c().calcs.includes(x)) : c().calcs.filter(x => x !== k);
    change();
  });
  $('depAsk').addEventListener('click', e => {
    const v = e.target.closest('[data-dep]'); if (!v) return;
    if (v.dataset.dep === 'add') { const keys = tiMissingDeps(c()).map(x => x.key); c().calcs = tiCalcList(c()).map(x => x.key).filter(x => keys.includes(x) || c().calcs.includes(x)); c().depMode = ''; }
    else c().depMode = 'inline';
    change();
  });
  $('calcs').addEventListener('input', e => { const k = e.target.dataset.name; if (!k) return; c().names[k] = e.target.value; leaveExample(); renderMeasures(); renderOut(); persist(); });
  TR_INPUTS.concat([['pctFormat', 'pctFormat'], ['folder', 'folder'], ['gTable', 'groupTable'], ['gCol', 'groupColumn'], ['prec', 'precedence']]).forEach(([id, k]) => $(id).addEventListener('input', () => { c()[k] = $(id).value; leaveExample(); renderDestHint(); renderMeasures(); renderOut(); persist(); }));
  $('target').addEventListener('input', () => { c().target = $('target').value; leaveExample(); renderDestHint(); renderOut(); persist(); });
  [['namePattern', 'namePattern'], ['folderMode', 'folderMode'], ['testBy', 'testBy'], ['testMeasure', 'testMeasure']].forEach(([id, k]) => $(id).addEventListener('change', () => { c()[k] = $(id).value; change(); }));
  $('search').addEventListener('input', renderMeasures);
  $('mList').addEventListener('change', e => {
    const n = e.target.dataset.m; if (!n) return;
    c().measures = e.target.checked ? c().measures.concat(n) : c().measures.filter(x => lc(x) !== lc(n));
    change();
  });
  $('clearAll').addEventListener('click', () => { resetAll(); try { localStorage.setItem(PREFIX + 'blank', '1'); } catch (e) {} persist(); $('modelInput').focus(); });
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
    resetAll();
    try { localStorage.setItem(PREFIX + 'blank', '1'); } catch (e) {}
    persist();
    show(false); done.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => { done.hidden = true; }, 6000);
  });
})();
