
/* ---------- example ---------- */
const EX_MEASURE = [
 'Online Share % =',
 'IFERROR(',
 '    CALCULATE ( [Total Sales], FILTER ( Sales, Sales[Channel] = "Online" ) )',
 '        / CALCULATE ( [Total Sales], ALL ( Sales[Channel] ) ),',
 '    0',
 ')'].join('\n');
const EX_CUSTOM = [{ id: 'MY_1', name: 'Percent measures return blank, not 0', check: 'A measure whose name ends in % must return BLANK () when the denominator is blank or 0, so rows with no data disappear from visuals.', sev: 'medium', on: true }];
const EX_NOTES = 'Shows the share of sales made online, by region and month.';
const EX_REPLY = '```\n@@@ SUMMARY @@@\nThe measure gives the right share when both channels have sales, but it shows 0% instead of blank when there are no sales, and filters the whole Sales table where one column is enough.\n@@@ END @@@\n'
 + '@@@ FINDING @@@\nRULE: MY_1\nSEVERITY: medium\nLINE: 1\nWHERE: IFERROR( ..., 0 )\nWHAT: When a region has no sales, [Total Sales] is blank on both sides and the measure returns 0 instead of blank, so every empty region shows 0% in tables.\nFIX: Use DIVIDE ( online, all channels ), which returns blank.\n@@@ END @@@\n'
 + '@@@ FINDING @@@\nRULE: DIVIDE\nSEVERITY: medium\nLINE: 3\nWHERE: / CALCULATE ( [Total Sales], ALL ( Sales[Channel] ) )\nWHAT: IFERROR doesn\'t catch division by zero: in DAX a number divided by 0 returns infinity, not an error, so a region with negative and positive sales that net to 0 would show infinity.\nFIX: DIVIDE handles 0 and blank denominators.\n@@@ END @@@\n'
 + '@@@ DISMISS @@@\nRULE: ALL_MODIFIER\nLINE: 3\nREASON: ALL ( Sales[Channel] ) is the right filter here; switching to REMOVEFILTERS only improves readability, so treat it as a style note.\n@@@ END @@@\n'
 + '@@@ REWRITE @@@\nVAR _OnlineSales =\n    CALCULATE ( [Total Sales], KEEPFILTERS ( Sales[Channel] = "Online" ) )\nVAR _AllChannelSales =\n    CALCULATE ( [Total Sales], REMOVEFILTERS ( Sales[Channel] ) )\nRETURN\n    DIVIDE ( _OnlineSales, _AllChannelSales )\n@@@ END @@@\n'
 + '@@@ CHANGES @@@\n- Replaced FILTER over Sales with KEEPFILTERS on the Channel column: same result, but it filters one column instead of the whole table.\n- Used REMOVEFILTERS instead of ALL.\n- Replaced / and IFERROR with DIVIDE. Result change (MY_1): blank instead of 0 when there are no sales.\n@@@ END @@@\n```';

/* ---------- state + UI ---------- */
const $ = id => document.getElementById(id);
const PREFIX = 'kdr.';
const store = {
  get(k){ try { return localStorage.getItem(PREFIX + k); } catch (e) { return null; } },
  set(k, v){ try { localStorage.setItem(PREFIX + k, v); } catch (e) {} }
};
const blankRules = () => ({ builtin: {}, custom: [] });
const state = { example: false, model: null, m: null, rules: blankRules(), wantRewrite: true, tTable: '', tBy: '', out: {} };

function esc(s){ return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function msg(level, html){ return '<div class="msg ' + level + '">' + html + '</div>'; }
const DAX_KW = /\b(VAR|RETURN|DEFINE|MEASURE|EVALUATE|ORDER BY|CALCULATE|CALCULATETABLE|FILTER|ALL|REMOVEFILTERS|KEEPFILTERS|VALUES|DIVIDE|IF|SWITCH|SUMX|AVERAGEX|MINX|MAXX|COUNTX|SUM|COUNT|COUNTROWS|IFERROR|ISBLANK|BLANK|TRUE|FALSE|AND|OR|NOT|IN|SELECTEDVALUE|HASONEVALUE|ADDCOLUMNS|SUMMARIZECOLUMNS|ROW|ABS|FORMAT|COALESCE|RELATED|EARLIER)\b/g;
function hl(code){
  return code.split('\n').map(line => {
    if (/^\s*(\/\/|--)/.test(line)) return '<span class="tok-com">' + esc(line) + '</span>';
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
function lineDiff(a, b){
  const A = a.replace(/\r/g, '').split('\n'), B = b.replace(/\r/g, '').split('\n');
  const n = A.length, m = B.length; if (n * m > 4e6) return null;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i].trim() === B[j].trim() ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < n && j < m) { if (A[i].trim() === B[j].trim()) { out.push({ t: ' ', v: B[j] }); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ t: '-', v: A[i++] }); else out.push({ t: '+', v: B[j++] }); }
  while (i < n) out.push({ t: '-', v: A[i++] }); while (j < m) out.push({ t: '+', v: B[j++] });
  return out;
}
function setExample(on){ state.example = on; $('exampleBanner').hidden = !on; }
function leaveExample(){ if (state.example) { setExample(false); persist(); } }
function persist(){
  store.set('rules', JSON.stringify(state.rules)); // the checklist is kept even while the example shows
  if (state.example) return;
  store.set('measure', $('mInput').value); store.set('model', $('modelInput').value);
  store.set('state', JSON.stringify({ notes: $('notes').value, reply: $('reply').value, wantRewrite: state.wantRewrite, tTable: state.tTable, tBy: state.tBy }));
}

/* ---------- checklist ---------- */
function activeRules(){
  const b = state.rules.builtin;
  const list = RULES.map(r => Object.assign({}, r, { on: b[r.id] ? b[r.id].on !== false : true, sev: b[r.id] && b[r.id].sev ? b[r.id].sev : r.sev }));
  return list.concat(state.rules.custom.map(c => Object.assign({ auto: false }, c)));
}
function ruleName(id){ const r = activeRules().find(x => x.id === id); return r ? r.name : id === 'OTHER' ? 'Other problem' : id; }
function ruleSev(id){ const r = activeRules().find(x => x.id === id); return r ? r.sev : 'medium'; }
function renderRules(){
  const sevSel = (id, v) => '<select data-act="sev" data-id="' + id + '" aria-label="Severity">' + ['high', 'medium', 'low'].map(s => '<option value="' + s + '"' + (v === s ? ' selected' : '') + '>' + s[0].toUpperCase() + s.slice(1) + '</option>').join('') + '</select>';
  $('rules').innerHTML = activeRules().map(r => '<div class="rule' + (r.on ? '' : ' off') + '"><label class="rchk"><input type="checkbox" data-act="on" data-id="' + r.id + '"' + (r.on ? ' checked' : '') + '><span><b>' + esc(r.name) + '</b><span class="rtext">' + esc(r.check || '') + '</span></span></label>'
    + '<span class="rmeta"><span class="by ' + (r.auto ? 'page' : 'ai') + '">' + (r.auto ? 'Page + Copilot' : 'Copilot') + '</span>' + sevSel(r.id, r.sev) + (r.auto ? '' : '<button type="button" class="linkbtn" data-act="del" data-id="' + r.id + '">Remove</button>') + '</span></div>').join('');
}

/* ---------- render ---------- */
function renderModel(){
  const t = $('modelInput').value;
  state.model = null;
  if (!t.trim()) { $('modelMsg').innerHTML = ''; return; }
  const m = parseModel(t);
  if (m.error) { $('modelMsg').innerHTML = msg('err', esc(m.error)); return; }
  state.model = m;
  $('modelMsg').innerHTML = msg('ok', m.tables.length + ' tables, ' + m.columns.length + ' columns and ' + m.measures.length + ' measures loaded.');
  $('tableList').innerHTML = m.tables.map(x => '<option value="' + esc(x.name) + '">').join('');
  $('colList').innerHTML = m.columns.map(c => '<option value="' + esc(qName(c.table) + bracket(c.name)) + '">').join('');
}
function renderPicker(){
  const m = state.model;
  $('pickWrap').hidden = !m || !m.measures.length;
  if (!m) return;
  const cur = state.m && state.m.name ? lc(state.m.name) : '';
  const byT = new Map(); m.measures.filter(x => x.expression).forEach(x => { if (!byT.has(x.table)) byT.set(x.table, []); byT.get(x.table).push(x); });
  $('pickM').innerHTML = '<option value="">Choose a measure (' + m.measures.length + ')</option>' + [...byT.keys()].sort((a, b) => a.localeCompare(b)).map(t => '<optgroup label="' + esc(t) + '">' + byT.get(t).sort((a, b) => a.name.localeCompare(b.name)).map(x => '<option value="' + esc(x.name) + '"' + (lc(x.name) === cur ? ' selected' : '') + '>' + esc(x.name) + (x.folder ? ' (' + esc(x.folder) + ')' : '') + '</option>').join('') + '</optgroup>').join('');
}
function loadMeasure(name){
  const x = state.model && state.model.measures.find(mm => lc(mm.name) === lc(name)); if (!x) return;
  if (state.example) { $('notes').value = ''; state.rules.custom = state.rules.custom.filter(c => !EX_CUSTOM.some(e => e.id === c.id && e.name === c.name)); setExample(false); }
  $('mInput').value = x.name + ' =\n' + x.expression; $('reply').value = ''; $('tTable').value = ''; state.tTable = '';
  try { localStorage.removeItem(PREFIX + 'blank'); } catch (e) {}
  renderAll(); persist();
  window.scrollTo({ top: $('mInput').getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
}
function renderScan(){
  const m = state.model;
  $('scanBox').hidden = !m || !m.measures.length;
  if (!m) return;
  const enabled = new Set(activeRules().filter(r => r.on && r.auto).map(r => r.id));
  if (!state.scan || state.scanKey !== $('modelInput').value.length + '|' + [...enabled].join(',') + '|' + JSON.stringify(state.rules.builtin)) {
    state.scan = m.measures.filter(x => x.expression).map(x => {
      let f = []; try { f = autoReview(x.expression, m, enabled); } catch (e) {}
      const c = { high: 0, medium: 0, low: 0 }; f.forEach(y => { c[ruleSev(y.rule)]++; });
      return { name: x.name, table: x.table, c, rules: [...new Set(f.map(y => ruleName(y.rule)))] };
    }).sort((a, b) => b.c.high - a.c.high || b.c.medium - a.c.medium || b.c.low - a.c.low || a.name.localeCompare(b.name));
    state.scanKey = $('modelInput').value.length + '|' + [...enabled].join(',') + '|' + JSON.stringify(state.rules.builtin);
  }
  const withIssues = state.scan.filter(s => s.c.high + s.c.medium + s.c.low).length;
  $('scanStat').textContent = '(' + withIssues + ' of ' + state.scan.length + ' have findings)';
  const q = lc($('scanFilter').value.trim());
  const rows = state.scan.filter(s => !q || lc(s.name).includes(q) || lc(s.table).includes(q));
  $('scanBody').innerHTML = rows.slice(0, 400).map(s => '<tr><td class="nm">' + esc(s.name) + '</td><td class="fmt">' + esc(s.table) + '</td><td class="num' + (s.c.high ? ' hi' : '') + '">' + (s.c.high || '') + '</td><td class="num">' + (s.c.medium || '') + '</td><td class="num">' + (s.c.low || '') + '</td><td class="rl">' + esc(s.rules.join(', ')) + '</td><td><button type="button" class="btn" data-review="' + esc(s.name) + '">Review</button></td></tr>').join('')
    + (rows.length > 400 ? '<tr><td colspan="7" class="muted">Showing the first 400. Search to narrow the list.</td></tr>' : '');
}
function currentMeasure(){
  const p = parseMeasureInput($('mInput').value);
  if (state.model && p.name && !p.table) { const mm = state.model.measures.find(x => lc(x.name) === lc(p.name)); if (mm) p.table = mm.table; }
  return p;
}
function related(p){
  if (!state.model) return [];
  const names = new Set(); const toks = daxTokens(p.expression);
  toks.forEach((t, i) => { if (t.k === 'ref') { const r = refKind(state.model, toks, i); if (r.kind === 'measure') names.add(lc(r.name)); } });
  const out = []; const seen = new Set();
  const addM = (n, depth) => {
    const m = state.model.measures.find(x => lc(x.name) === n); if (!m || seen.has(n) || lc(m.name) === lc(p.name)) return; seen.add(n); out.push(m);
    if (depth < 1) { const tk = daxTokens(m.expression || ''); tk.forEach((t, i) => { if (t.k === 'ref' && refKind(state.model, tk, i).kind === 'measure') addM(lc(refName(t.v)), depth + 1); }); }
  };
  names.forEach(n => addM(n, 0));
  return out.slice(0, 12);
}
function renderAll(){
  renderModel(); renderRules();
  const p = currentMeasure(); state.m = p;
  const has = !!p.expression.trim();
  $('mStats').innerHTML = has ? '<span class="stat">Name <b>' + (p.name ? esc(p.name) : '<span class="muted">not given</span>') + '</b></span>' + (p.table ? '<span class="stat">Table <b>' + esc(p.table) + '</b></span>' : '') + '<span class="stat"><b>' + p.expression.split('\n').length + '</b> lines</span>' + (p.form === 'tmdl' ? '<span class="stat remote">From TMDL: properties left out</span>' : '') : '';
  const rules = activeRules().filter(r => r.on);
  const enabled = new Set(rules.map(r => r.id));
  const found = has ? autoReview(p.expression, state.model, enabled) : [];
  state.found = found;
  // references in the model
  let refIssues = [];
  if (has && state.model && enabled.has('REFERENCES')) {
    const v = validate([{ name: p.name || '__measure', expression: p.expression, formatString: '0' }], state.model, { targetTable: p.table || '_Measures' })[0];
    refIssues = v.errors.concat(v.warns).filter(x => !/already|Replaces|format string/i.test(x));
  }
  state.refIssues = refIssues;
  renderPicker(); renderScan();
  $('autoOut').innerHTML = !has ? msg('info', state.model && state.model.measures.length ? 'Pick a measure from your model in Step 1 (or paste one), or open the list below to see which measures need attention.' : 'Paste a measure in Step 1.') : (found.length || refIssues.length ? '<p class="note">' + found.length + ' finding' + (found.length === 1 ? '' : 's') + (state.model ? '' : '. Add your model in Step 1 to also check names and tell columns from measures') + '.</p>' + findingList(found.map(f => Object.assign({ sev: ruleSev(f.rule) }, f)), true) + refIssues.map(x => msg('warn', '<b>Name check:</b> ' + esc(x))).join('') : msg('ok', 'No problems found by the page’s checks. Copilot can still review it against the full checklist.'));
  const lines = new Set(found.map(f => f.line));
  $('codeView').innerHTML = has ? p.expression.split('\n').map((l, i) => '<span class="ln' + (lines.has(i + 1) ? ' hit' : '') + '"><span class="no">' + (i + 1) + '</span>' + hl(l) + '</span>').join('') : '';
  // prompt
  state.out.prompt = has ? reviewPrompt({ name: p.name, expr: p.expression, rules: rules.map(r => ({ id: r.id, name: r.name, check: r.check || r.name, sev: r.sev })), found, related: related(p), notes: $('notes').value, rewrite: state.wantRewrite }) : '';
  $('promptView').textContent = state.out.prompt || (state.model ? 'Pick or paste a measure in Step 1.' : 'Paste a measure in Step 1.');
  $('pCount').textContent = state.out.prompt ? state.out.prompt.length.toLocaleString() + ' characters' : '';
  renderReply();
}
function findingList(list, pageOnly){
  if (!list.length) return '';
  const sorted = list.slice().sort((a, b) => SEV[b.sev] - SEV[a.sev] || a.line - b.line);
  return '<ul class="flist">' + sorted.map(f => '<li class="' + (f.dismissed ? 'dismissed' : '') + '"><span class="pill ' + (f.sev === 'high' ? 'err' : f.sev === 'medium' ? 'warn' : 'replace') + '">' + f.sev + '</span><div><b>' + esc(ruleName(f.rule)) + '</b> <span class="muted">line ' + (f.line || '?') + (pageOnly ? '' : ' &middot; ' + (f.source === 'page' ? 'found by the page' : 'from Copilot')) + '</span>'
    + (f.where ? '<code class="where">' + esc(f.where) + '</code>' : '') + '<p>' + esc(f.what) + (f.fix ? ' <b>Fix:</b> ' + esc(f.fix) : '') + '</p>' + (f.dismissed ? '<p class="dis"><b>Copilot says this doesn’t apply:</b> ' + esc(f.dismissed) + '</p>' : '') + '</div></li>').join('') + '</ul>';
}
function renderReply(){
  const text = $('reply').value, p = state.m;
  $('report').hidden = true;
  if (!text.trim() || !p || !p.expression.trim()) { $('replyMsg').innerHTML = ''; return; }
  const r = parseReview(text);
  if (r.error) { $('replyMsg').innerHTML = msg('err', esc(r.error)); return; }
  $('replyMsg').innerHTML = '';
  $('report').hidden = false;
  const page = state.found.map(f => Object.assign({ sev: ruleSev(f.rule) }, f));
  r.dismiss.forEach(d => { const f = page.find(x => x.rule === d.rule && (!d.line || x.line === d.line)); if (f) f.dismissed = d.reason || 'No reason given.'; });
  const known = new Set(activeRules().map(x => x.id).concat(['OTHER']));
  const all = page.concat(r.findings.map(f => Object.assign(f, { rule: known.has(f.rule) ? f.rule : 'OTHER' })));
  const live = all.filter(f => !f.dismissed);
  const counts = ['high', 'medium', 'low'].map(s => live.filter(f => f.sev === s).length);
  $('summary').innerHTML = '<div class="stats"><span class="stat' + (counts[0] ? ' limited' : '') + '"><b>' + counts[0] + '</b> high</span><span class="stat"><b>' + counts[1] + '</b> medium</span><span class="stat"><b>' + counts[2] + '</b> low</span>' + (all.length > live.length ? '<span class="stat">' + (all.length - live.length) + ' dismissed</span>' : '') + '</div>' + (r.summary ? '<p class="tip">' + esc(r.summary) + '</p>' : '');
  $('findings').innerHTML = findingList(all, false) || msg('ok', 'No findings.');
  // rewrite
  $('rewriteBox').hidden = !r.rewrite;
  let reportText = 'DAX review: ' + (p.name || 'measure') + '\n' + (r.summary ? r.summary + '\n' : '') + '\n' + live.slice().sort((a, b) => SEV[b.sev] - SEV[a.sev] || a.line - b.line).map(f => '[' + f.sev.toUpperCase() + '] ' + ruleName(f.rule) + ' (line ' + (f.line || '?') + '): ' + f.what + (f.fix ? ' Fix: ' + f.fix : '')).join('\n');
  if (r.rewrite) {
    state.out.rewrite = r.rewrite;
    $('rwView').innerHTML = hl(r.rewrite);
    const enabled = new Set(activeRules().filter(x => x.on).map(x => x.id));
    const after = autoReview(r.rewrite, state.model, enabled);
    const notes = [];
    const opens = (r.rewrite.match(/\(/g) || []).length, closes = (r.rewrite.match(/\)/g) || []).length;
    if (opens !== closes) notes.push(msg('err', 'The rewrite has ' + opens + ' opening and ' + closes + ' closing brackets. Ask Copilot to fix it.'));
    notes.push(msg(after.length < state.found.length ? 'ok' : after.length ? 'warn' : 'ok', 'Page checks on the rewrite: ' + after.length + ' finding' + (after.length === 1 ? '' : 's') + ' (the original had ' + state.found.length + ').'));
    if (after.length) notes.push(findingList(after.map(f => Object.assign({ sev: ruleSev(f.rule) }, f)), true));
    if (state.model) {
      const v = validate([{ name: p.name || '__measure', expression: r.rewrite, formatString: '0' }], state.model, { targetTable: p.table || '_Measures' })[0];
      const iss = v.errors.concat(v.warns).filter(x => !/already|Replaces|format string/i.test(x));
      notes.push(iss.length ? iss.map(x => msg('err', '<b>Name check:</b> ' + esc(x))).join('') : msg('ok', 'Every table, column and measure in the rewrite exists in the model.'));
    }
    $('rwChecks').innerHTML = notes.join('');
    $('rwChanges').innerHTML = r.changes.length ? '<ul class="changes">' + r.changes.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul>' : '';
    const d = lineDiff(p.expression.trim(), r.rewrite.trim());
    if (d) { $('diffStat').textContent = '(' + d.filter(x => x.t === '-').length + ' lines removed, ' + d.filter(x => x.t === '+').length + ' added)'; $('diffView').innerHTML = d.map(x => '<span class="dl ' + (x.t === '+' ? 'add' : x.t === '-' ? 'del' : 'same') + '"><span class="dm">' + (x.t === ' ' ? ' ' : x.t) + '</span>' + esc(x.v) + '</span>').join(''); }
    // test query
    const defTable = p.table || (state.model && (state.model.tables.find(t => /^_?measures$/i.test(t.name)) || state.model.tables[0] || {}).name) || '_Measures';
    if (!$('tTable').value && !state.tTable) $('tTable').value = defTable;
    const tbl = ($('tTable').value || defTable).trim().replace(/^'|'$/g, '');
    const by = ($('tBy').value || '').trim();
    state.out.compare = compareQuery({ name: p.name, table: tbl, original: p.expression, rewrite: r.rewrite, byCol: by });
    $('cmpView').innerHTML = hl(state.out.compare);
    if (p.name && tbl) { state.out.save = saveScript({ name: p.name, table: p.table || tbl, rewrite: r.rewrite }); $('saveView').innerHTML = hl(state.out.save); $('saveMsg').innerHTML = p.table ? '' : msg('warn', 'The measure&rsquo;s table isn&rsquo;t known. Add the model export in Step 1, or check the table name in the query matches where the measure lives.'); }
    else { state.out.save = ''; $('saveView').textContent = ''; $('saveMsg').innerHTML = msg('info', 'Give the measure a name in Step 1 (Name = ...) to get this query.'); }
    reportText += '\n\nRewrite:\n' + r.rewrite + (r.changes.length ? '\n\nChanges:\n' + r.changes.map(c => '- ' + c).join('\n') : '');
  }
  state.out.report = reportText;
}

function init(){
  $('exportView').textContent = DAX_QUERY;
  try { const r = JSON.parse(store.get('rules') || 'null'); if (r && typeof r === 'object') state.rules = Object.assign(blankRules(), r); } catch (e) {}
  const saved = store.get('measure');
  let st = null; try { st = JSON.parse(store.get('state') || 'null'); } catch (e) {}
  if (saved && saved.trim() && saved !== EX_MEASURE) {
    $('mInput').value = saved; $('modelInput').value = store.get('model') || '';
    if (st) { $('notes').value = st.notes || ''; $('reply').value = st.reply === EX_REPLY ? '' : (st.reply || ''); state.wantRewrite = st.wantRewrite !== false; state.tTable = st.tTable || ''; state.tBy = st.tBy || ''; $('tTable').value = state.tTable; $('tBy').value = state.tBy; }
  } else if (store.get('blank') !== '1') {
    $('mInput').value = EX_MEASURE; $('modelInput').value = EX_MODEL; $('notes').value = EX_NOTES; $('reply').value = EX_REPLY;
    if (!state.rules.custom.length) state.rules.custom = EX_CUSTOM.map(x => Object.assign({}, x));
    $('modelBox').open = true; setExample(true);
  }
  $('wantRewrite').checked = state.wantRewrite;
  renderAll();

  const change = () => { renderAll(); persist(); };
  $('mInput').addEventListener('input', () => {
    if (state.example) {
      // drop every sample except the measure being typed
      if ($('modelInput').value === EX_MODEL) $('modelInput').value = '';
      $('notes').value = ''; $('reply').value = ''; $('modelBox').open = false;
      state.rules.custom = state.rules.custom.filter(c => !EX_CUSTOM.some(e => e.id === c.id && e.name === c.name));
      setExample(false);
    }
    try { localStorage.removeItem(PREFIX + 'blank'); } catch (e) {}
    change();
  });
  $('modelInput').addEventListener('input', () => { leaveExample(); change(); });
  $('notes').addEventListener('input', () => { leaveExample(); change(); });
  $('reply').addEventListener('input', () => { leaveExample(); change(); });
  $('wantRewrite').addEventListener('change', () => { state.wantRewrite = $('wantRewrite').checked; change(); });
  $('tTable').addEventListener('input', () => { state.tTable = $('tTable').value; renderReply(); persist(); });
  $('tBy').addEventListener('input', () => { state.tBy = $('tBy').value; renderReply(); persist(); });
  $('rules').addEventListener('change', e => {
    const t = e.target, id = t.dataset.id; if (!id) return;
    const custom = state.rules.custom.find(c => c.id === id);
    const slot = custom || (state.rules.builtin[id] = state.rules.builtin[id] || {});
    if (t.dataset.act === 'on') slot.on = t.checked;
    if (t.dataset.act === 'sev') slot.sev = t.value;
    change();
  });
  $('rules').addEventListener('click', e => {
    const b = e.target.closest('[data-act=del]'); if (!b) return;
    state.rules.custom = state.rules.custom.filter(c => c.id !== b.dataset.id); change();
  });
  $('nrAdd').addEventListener('click', () => {
    const name = $('nrName').value.trim(); if (!name) { $('nrName').focus(); return; }
    let n = 1; while (state.rules.custom.some(c => c.id === 'MY_' + n)) n++;
    state.rules.custom.push({ id: 'MY_' + n, name, check: $('nrCheck').value.trim() || name, sev: $('nrSev').value, on: true });
    $('nrName').value = ''; $('nrCheck').value = ''; change();
  });
  $('pickM').addEventListener('change', () => { if ($('pickM').value) loadMeasure($('pickM').value); });
  $('scanFilter').addEventListener('input', renderScan);
  $('scanBody').addEventListener('click', e => { const b = e.target.closest('[data-review]'); if (b) loadMeasure(b.dataset.review); });
  $('rulesReset').addEventListener('click', () => { state.rules.builtin = {}; change(); });
  $('clearAll').addEventListener('click', () => { resetAll(); try { localStorage.setItem(PREFIX + 'blank', '1'); } catch (e) {} persist(); $('mInput').focus(); });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    const v = b.dataset.copy === 'export' ? DAX_QUERY : state.out[b.dataset.copy]; if (v) copyText(v, b);
  });
}
function resetAll(){
  ['mInput', 'modelInput', 'notes', 'reply', 'tTable', 'tBy', 'nrName', 'nrCheck'].forEach(id => { $(id).value = ''; });
  state.rules.custom = state.rules.custom.filter(c => !EX_CUSTOM.some(e => e.id === c.id && e.name === c.name));
  state.tTable = ''; state.tBy = ''; state.wantRewrite = true; $('wantRewrite').checked = true; $('modelBox').open = false;
  setExample(false); renderAll();
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
    state.rules = blankRules(); resetAll();
    try { localStorage.setItem(PREFIX + 'blank', '1'); } catch (e) {}
    persist();
    show(false); done.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => { done.hidden = true; }, 6000);
  });
})();
