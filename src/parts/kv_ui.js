/* ---------- KPI Visualizer page ---------- */
const $ = id => document.getElementById(id);
const PREFIX = 'kkv.';
const KV_MAX = 6;
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
    if (/^\s*(\/\/|\/\/\/)/.test(l)) return '<span class="tok-com">' + l + '</span>';
    return l.replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)/g, '<span class="tok-str">$1</span>')
      .replace(/\b(createOrReplace|ref|table|column|measure|partition|DEFINE|MEASURE|EVALUATE|ROW|VAR|RETURN|SWITCH|IF|FORMAT|CONCATENATEX|ADDCOLUMNS|FILTER|TOPN|DIVIDE|SELECTEDVALUE|formatStringDefinition|dataCategory|displayFolder|formatString)\b/g, '<span class="tok-kw">$1</span>');
  }).join('\n');
}
const clone = o => JSON.parse(JSON.stringify(o));
const blankCfg = () => ({ mode: 'one', sel: 0, option: '', rowOption: 'rcards', preset: 'excel', colors: clone(KV_EXCEL), ink: clone(KV_INK_DEF), refPos: 'below', band: 2, table: '', folder: 'KPI Visuals', trendCol: "'Date'[Month Start]", periods: 12, scoreTable: 'KPI Scorecard', htmlW: KV_HTML_W, htmlH: KV_HTML_H, htmlLayout: 'auto' });
const state = { example: false, model: null, kpis: [], cfg: blankCfg(), out: {} };
const FIELDS = ['label', 'measure', 'format', 'better', 'target', 'compare', 'compareLabel', 'pv.value', 'pv.target', 'pv.compare', 'pv.trend'];
// field paths: 'label', 'pv.value', 'ctx.0.ref'
const getF = (k, f) => { const p = f.split('.'); if (p[0] === 'pv') return k.pv[p[1]]; if (p[0] === 'ctx') return ((k.ctx || [])[+p[1]] || {})[p[2]]; return k[f]; };
const setF = (k, f, v) => {
  const p = f.split('.');
  if (p[0] === 'pv') k.pv[p[1]] = v;
  else if (p[0] === 'ctx') { k.ctx = k.ctx || []; const c = k.ctx[+p[1]] || (k.ctx[+p[1]] = kvBlankCtx()); if (p[2] === 'kind') { const n = kvBlankCtx(v), d = kvCtxKind(c); n.ref = ['measure', 'period'].includes(v) === ['measure', 'period'].includes(c.kind) ? c.ref : ''; if (c.before !== (d.before || '')) n.before = c.before; if (c.after !== (d.after || '')) n.after = c.after; k.ctx[+p[1]] = n; } else c[p[2]] = v; }
  else k[f] = v;
};

function persist(){
  store.set('model', state.example ? '' : $('modelInput').value);
  store.set('kpis', JSON.stringify(state.example ? [] : state.kpis));
  const c = Object.assign({}, state.cfg); if (state.example) { c.table = ''; c.trendCol = blankCfg().trendCol; }
  store.set('cfg', JSON.stringify(c));
}
function setExample(on){ state.example = on; $('exampleBanner').hidden = !on; }
function leaveExample(){ if (state.example) { state.kpis = []; state.cfg.table = ''; state.cfg.sel = 0; setExample(false); } }

/* ---------- Step 2: KPIs ---------- */
function ctxEditor(k, i, it){
  const cs = k.ctx || [], main = it === 'context';
  const line = (c, j) => {
    const d = kvCtxKind(c), id = 'k' + i + '_ctx' + j, inp = (fld, label, ph, list) => '<div class="field"><label for="' + id + fld + '">' + label + '</label><input type="text" id="' + id + fld + '" data-f="ctx.' + j + '.' + fld + '" value="' + esc(c[fld] || '') + '" placeholder="' + esc(ph) + '" autocomplete="off" spellcheck="false"' + (list ? ' list="' + list + '"' : '') + '></div>';
    return '<div class="kv-ctxed"><div class="kv-fields">'
      + '<div class="field"><label for="' + id + 'kind">Context ' + (j + 1) + '</label><select id="' + id + 'kind" data-f="ctx.' + j + '.kind">' + KV_CTX_KINDS.map(x => '<option value="' + x.id + '"' + (x.id === c.kind ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select></div>'
      + (d.ref ? inp('ref', d.ref, d.ph, ['measure', 'period'].includes(c.kind) ? 'measureNames' : 'columnNames') : '')
      + inp('before', c.kind === 'text' ? 'Text' : 'Text before', c.kind === 'text' ? 'Excludes returns' : d.before || '')
      + (c.kind === 'text' ? '' : inp('after', 'Text after', d.after || ''))
      + (['measure', 'per'].includes(c.kind) ? inp('fmt', 'Format string', d.fmt, 'formats') : '')
      + (c.kind === 'measure' ? inp('pv', 'Number for the preview', '1,240') : '')
      + '</div><button type="button" class="ib" data-act="rmctx" data-j="' + j + '" aria-label="Remove context ' + (j + 1) + '">&#10005;</button></div>';
  };
  const add = cs.length < KV_CTX_MAX ? '<button type="button" class="btn" data-act="addctx">+ Add context</button>' : '';
  const intro = '<p class="small muted">A short neutral line next to the value: share of the total, a rank, per customer, an as-of date, another measure, or your own text. No good or bad colors.</p>';
  if (main || cs.length) return '<div class="kv-ctxbox"><h4>Context' + (main ? '' : ' <span class="muted">(optional)</span>') + '</h4>' + intro + cs.map(line).join('') + add + '</div>';
  return '<div class="kv-ctxbox closed">' + add + ' <span class="small muted">Optional: a neutral line like &ldquo;18% of total&rdquo; or &ldquo;As of 30 Sep&rdquo;.</span></div>';
}
function kpiEditor(k, i){
  const it = kvIntent(k), show = { goal: it === 'goal' || !!(k.target || '').trim(), change: it === 'change' || !!(k.compare || '').trim() };
  show.better = show.goal || show.change || it === 'trend';
  const f = (field, label, ph, extra) => '<div class="field' + (extra || '') + '"><label for="k' + i + '_' + field + '">' + label + '</label><input type="text" id="k' + i + '_' + field + '" data-f="' + field + '" value="' + esc(getF(k, field) || '') + '" placeholder="' + esc(ph) + '" autocomplete="off" spellcheck="false"' + (/measure|target|compare$/.test(field) ? ' list="measureNames"' : field === 'format' ? ' list="formats"' : '') + '></div>';
  return '<div class="kv-ed" data-i="' + i + '">'
    + '<div class="kv-ed-head"><b>KPI ' + (i + 1) + '</b><button type="button" class="ib" data-act="rm" aria-label="Remove KPI ' + (i + 1) + '">&#10005;</button></div>'
    + '<div class="kv-fields">'
    + f('label', 'Name on the card', 'Sales')
    + f('measure', 'Measure', 'Total Sales')
    + f('format', 'Format string', '\\$#,0 or 0.0%')
    + '</div>'
    + '<div class="field kv-intent"><label for="k' + i + '_intent">What should readers get from it?</label><select id="k' + i + '_intent" data-f="intent">' + KV_INTENTS.map(x => '<option value="' + x.id + '"' + (x.id === it ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select></div>'
    + (show.goal || show.change || show.better ? '<div class="kv-fields">'
      + (show.better ? '<div class="field"><label for="k' + i + '_better">Better when</label><select id="k' + i + '_better" data-f="better"><option value="higher"' + (k.better !== 'lower' ? ' selected' : '') + '>Higher</option><option value="lower"' + (k.better === 'lower' ? ' selected' : '') + '>Lower</option></select></div>' : '')
      + (show.goal ? f('target', 'Target <span class="muted">(measure or number)</span>', 'Sales Target') : '')
      + (show.change ? f('compare', 'Compare to <span class="muted">(measure)</span>', 'Sales LY') + f('compareLabel', 'Comparison name', 'last year') : '')
      + '</div>' : '')
    + ctxEditor(k, i, it)
    + '<details class="kv-pv"><summary>Numbers for the preview <span class="muted">(optional)</span></summary><div class="kv-fields">'
    + f('pv.value', 'Value', '1,240,000') + f('pv.target', 'Target value', '1,200,000') + f('pv.compare', 'Comparison value', '1,150,000')
    + f('pv.trend', 'Last 12 periods', '940000 980000 1010000 …', ' wide')
    + '</div></details></div>';
}
function renderKpis(){
  $('kpis').innerHTML = state.kpis.map(kpiEditor).join('') + '<datalist id="formats"><option value="\\$#,0"><option value="#,0"><option value="#,0.00"><option value="0.0%"><option value="0%"></datalist>';
  $('kpis').hidden = !state.kpis.length;
  $('addKpi').disabled = state.kpis.length >= KV_MAX;
  $('kpiMax').textContent = state.kpis.length >= KV_MAX ? 'Up to ' + KV_MAX + ' KPIs.' : state.kpis.length ? '' : 'No KPIs yet. Add one, or pick measures from your model export below.';
  $('modeOne').checked = state.cfg.mode !== 'row'; $('modeRow').checked = state.cfg.mode === 'row';
}
/* ---------- Step 1: connect (the shared step from the suite) ---------- */
function renderModel(){
  const text = $('modelInput').value;
  const m = text.trim() ? parseModel(text) : null;
  state.model = m && !m.error ? m : null;
  $('modelMsg').innerHTML = m && m.error ? '<div class="msg err">' + esc(m.error) + '</div>' : '';
  $('modelStats').innerHTML = state.model ? '<span class="stat"><b>' + state.model.measures.length + '</b> measures</span><span class="stat"><b>' + state.model.tables.length + '</b> tables</span>' : '';
  $('pickBox').hidden = !state.model;
  const ms = state.model ? state.model.measures : [];
  $('measureNames').innerHTML = ms.map(x => '<option value="' + esc(x.name) + '">').join('');
  $('columnNames').innerHTML = state.model ? state.model.columns.map(c => '<option value="' + esc(qName(c.table) + bracket(c.name)) + '">').join('') : '';
  $('tableNames').innerHTML = state.model ? state.model.tables.map(t => '<option value="' + esc(t.name) + '">').join('') : '';
  const dateCols = state.model ? state.model.columns.filter(c => /date|time|int/i.test(c.dataType || '') && (/date|calendar|period|month/i.test(c.table) || /month|date|period/i.test(c.name))) : [];
  $('trendCols').innerHTML = dateCols.map(c => '<option value="' + esc(qName(c.table) + bracket(c.name)) + '">').join('');
  // the default trend column isn't in this model: take a month date column from it (or any date column in a date table)
  if (state.model && state.cfg.trendCol === blankCfg().trendCol && !state.model.columns.some(c => qName(c.table) + bracket(c.name) === state.cfg.trendCol)) {
    const dt = dateCols.filter(c => /date|time/i.test(c.dataType || '')), best = dt.find(c => /month/i.test(c.name)) || dateCols.find(c => /year.?month/i.test(c.name)) || dt.find(c => /date|calendar/i.test(c.table));
    if (best) state.cfg.trendCol = qName(best.table) + bracket(best.name);
  }
  renderAvail();
}
const inKpis = name => state.kpis.some(k => lc(k.measure) === lc(name));
function renderAvail(){
  if (!state.model) return;
  const q = lc($('search').value.trim());
  const list = state.model.measures.filter(x => !q || lc(x.name).includes(q) || lc(x.table).includes(q) || lc(x.folder).includes(q));
  state.availList = list;
  $('avail').innerHTML = list.length ? list.map((x, i) => '<button type="button" class="mrow2' + (inKpis(x.name) ? ' added' : '') + '" data-i="' + i + '" role="listitem"><span class="mname">' + esc(x.name) + '</span><span class="mmeta">' + esc([x.table, x.folder, x.formatString].filter(Boolean).join(' · ')) + '</span><span class="add">' + (inKpis(x.name) ? '&#10003; added' : '+ Add') + '</span></button>').join('')
    : '<p class="note small" style="padding:10px 12px">No measures match.</p>';
}
// A KPI from an export measure, with a target and comparison guessed from the measure names
function kpiFromMeasure(x){
  const k = kvBlankKpi(), ms = state.model.measures, base = lc(x.name).replace(/\s*(total|sum|amount)\s*/g, ' ').trim();
  k.label = x.name; k.measure = x.name; k.format = x.formatString || '';
  const near = re => ms.find(m => m.name !== x.name && lc(m.name).includes(base) && re.test(m.name));
  const t = near(/target|budget|goal|plan|quota/i), c = near(/\b(LY|PY|SPLY|prior|last year|previous)\b/i);
  if (t) k.target = t.name;
  if (c) { k.compare = c.name; k.compareLabel = 'last year'; }
  if (/return|cost|churn|days|time|defect|error|late/i.test(x.name)) k.better = 'lower';
  if (!state.cfg.table.trim()) state.cfg.table = x.table;
  return k;
}

/* ---------- Step 4: colors ---------- */
function tbInk(){
  try { if (localStorage.getItem('ktb.blank') === '1') return null; return kvThemeInk(JSON.parse(localStorage.getItem('ktb.cfg') || 'null')); } catch (e) { return null; }
}
function tbColors(){
  try { if (localStorage.getItem('ktb.blank') === '1') return null; return kvThemeColors(JSON.parse(localStorage.getItem('ktb.cfg') || 'null')); } catch (e) { return null; }
}
function renderColors(){
  const c = state.cfg.colors;
  document.querySelectorAll('#colorPresets [data-preset]').forEach(b => b.setAttribute('aria-pressed', b.dataset.preset === state.cfg.preset));
  $('jsonBox').hidden = state.cfg.preset !== 'json';
  const row = (s, name, sample) => '<div class="kv-crow"><span class="kv-cname">' + name + '</span>'
    + '<label class="kv-cin"><input type="color" data-c="' + s + '.fill" value="' + c[s].fill + '"> Fill <span class="mono small">' + c[s].fill + '</span></label>'
    + '<label class="kv-cin"><input type="color" data-c="' + s + '.text" value="' + c[s].text + '"> Text <span class="mono small">' + c[s].text + '</span></label>'
    + '<span class="kv-lab" style="background:' + c[s].fill + ';color:' + c[s].text + '">' + sample + '</span>'
    + (kvContrast(c[s].text, c[s].fill) < 4.5 ? '<span class="pill warn">hard to read</span>' : '') + '</div>';
  $('colorRows').innerHTML = row('good', 'Good', '▲ +6.2% vs target') + row('neutral', 'Neutral', '► +0.4% vs target') + row('bad', 'Bad', '▼ -4.1% vs target');
  const P = kvInk(state.cfg);
  $('inkRows').innerHTML = KV_INK_KEYS.map(([x, name]) => '<label class="kv-cin kv-ink"><input type="color" data-ink="' + x + '" value="' + P[x] + '"> ' + name + ' <span class="mono small">' + P[x] + '</span></label>').join('')
    + (kvContrast(P.text, P.bg) < 4.5 ? '<span class="pill warn">Text is hard to read on the background</span>' : '');
  if (document.activeElement !== $('band')) $('band').value = state.cfg.band;
}
function applyPreset(p){
  state.cfg.preset = p; let msg = '';
  if (p === 'excel') state.cfg.colors = clone(KV_EXCEL);
  if (p === 'scale') state.cfg.colors = clone(KV_SCALE);
  if (p === 'tb') { const t = tbColors(); if (t) { state.cfg.colors = t; const ink = tbInk(); if (ink) state.cfg.ink = ink; msg = '<div class="msg ok">Status and card colors from the theme saved in <a href="theme-builder.html">Theme Builder</a>, with lighter fills made from them.</div>'; } else msg = '<div class="msg info">No theme is saved in <a href="theme-builder.html">Theme Builder</a> in this browser yet. Build one there, or paste a theme file.</div>'; }
  if (p === 'json') readThemeJson();
  $('presetMsg').innerHTML = msg;
}
function readThemeJson(){
  const t = $('themeJson').value.trim(); if (!t) { $('presetMsg').innerHTML = ''; return; }
  let o = null; try { o = JSON.parse(t); } catch (e) {}
  const c = kvThemeColors(o);
  if (c) { state.cfg.colors = c; const ink = kvThemeInk(o); if (ink) state.cfg.ink = ink; $('presetMsg').innerHTML = '<div class="msg ok">Status' + (ink ? ' and card' : '') + ' colors from your theme' + (o.name ? ' (' + esc(o.name) + ')' : '') + ', with lighter fills made from them.</div>'; }
  else $('presetMsg').innerHTML = '<div class="msg err">' + (o ? 'This theme has no good and bad colors. Theme files list them as "good", "neutral" and "bad".' : 'This isn’t valid JSON. Paste the whole theme file.') + '</div>';
}

/* ---------- Step 3: options ---------- */
const KIND = { native: 'Power BI visual', svg: 'SVG measure', core: 'Core visuals', html: 'HTML measure', design: 'SVG card' };
function currentKpi(){ return state.kpis[Math.min(state.cfg.sel, state.kpis.length - 1)] || null; }
function chosenOption(){
  if (state.cfg.mode === 'row') return rowOptions().find(o => o.id === state.cfg.rowOption) || rowOptions()[0];
  const k = currentKpi(); if (!k) return null;
  const r = kvRanked(k), pick = r.find(x => x.o.id === state.cfg.option && x.ok);
  return (pick || r[0]).o;
}
// The previews use the card colors from Step 4
function inkVars(el){ const P = kvInk(state.cfg); ['bg', 'text', 'muted', 'track'].forEach(x => el.style.setProperty('--kv-' + x, P[x])); }
// Row layouts the KPIs can use: bullet charts only when a KPI has a target
const rowOptions = () => KV_ROW_OPTIONS.filter(o => o.id !== 'rbullet' || state.kpis.some(x => kvHas(x).target));
function renderOptions(){
  const row = state.cfg.mode === 'row', k = currentKpi();
  inkVars($('options')); inkVars($('htmlFit'));
  $('kpiPickWrap').hidden = row || state.kpis.length < 2;
  $('kpiPick').innerHTML = state.kpis.map((x, i) => '<option value="' + i + '"' + (i === state.cfg.sel ? ' selected' : '') + '>' + esc(kvName(x)) + '</option>').join('');
  if (!state.kpis.length) { $('options').innerHTML = '<p class="note">Add a KPI in Step 2 to see the options.</p>'; $('sampleMsg').innerHTML = ''; return; }
  const chosen = chosenOption();
  const sample = row ? state.kpis.some(x => kvNums(x).sample) : kvNums(k).sample;
  $('sampleMsg').innerHTML = sample ? '<div class="msg info">Some preview numbers are made up because none were typed. Add yours under &ldquo;Numbers for the preview&rdquo; in Step 2.</div>' : '';
  $('s3note').textContent = row ? 'Each layout shows all your KPIs. Pick one to see how to build it.' : 'Ways that fit what you want readers to get come first. Pick one to see how to build it.';
  if (row) {
    $('options').innerHTML = rowOptions().map(o => '<article class="kv-opt wide' + (o === chosen ? ' on' : '') + '">'
      + '<div class="kv-opt-head"><h3>' + esc(o.name) + '</h3><span class="pill replace">' + KIND[o.kind] + '</span></div>'
      + '<div class="kv-canvas">' + kvRowPreview(o.id, state.kpis, state.cfg) + '</div>'
      + '<p class="small"><b>Fits:</b> ' + esc(o.fits) + '</p><p class="small"><b>Avoid:</b> ' + esc(o.avoid) + '</p>'
      + '<button type="button" class="btn' + (o === chosen ? ' primary' : '') + '" data-opt="' + o.id + '" aria-pressed="' + (o === chosen) + '">' + (o === chosen ? '&#10003; Building this' : 'Build this') + '</button></article>').join('');
    return;
  }
  // only the ways this KPI's fields can support are shown
  const h = kvHas(k), ranked = kvRanked(k).filter(x => x.ok), it = KV_INTENTS.find(x => x.id === kvIntent(k));
  const firstOther = ranked.findIndex(x => !x.fit);
  const head = (t, p) => '<div class="kv-grouphead"><h3>' + t + '</h3>' + (p ? '<p class="small muted">' + p + '</p>' : '') + '</div>';
  $('options').innerHTML = ranked.map(({ o }, idx) => {
    const pre = idx === 0 && ranked[0].fit ? head('Fits what you want: ' + esc(it.name.charAt(0).toLowerCase() + it.name.slice(1)), '') : idx === firstOther ? head(firstOther === 0 ? 'Ways to show it' : 'Other ways', firstOther === 0 ? '' : 'They show something else about the KPI.') : '';
    return pre + optCard(o, k, h, chosen);
  }).join('');
}
function optCard(o, k, h, chosen){
  {
    return '<article class="kv-opt' + (o === chosen ? ' on' : '') + '">'
      + '<div class="kv-opt-head"><h3>' + esc(o.name) + '</h3><span class="pill replace">' + KIND[o.kind] + '</span></div>'
      + '<div class="kv-canvas">' + kvPreview(o.id, k, state.cfg) + '</div>'
      + '<dl class="kv-nmc"><dt>Number</dt><dd>' + esc(o.nmc[0]) + '</dd><dt>Meaning</dt><dd>' + esc(o.nmc[1]) + '</dd><dt>Context</dt><dd>' + esc(o.nmc[2]) + '</dd></dl>'
      + '<p class="small"><b>Fits:</b> ' + esc(o.fits) + '</p><p class="small"><b>Avoid:</b> ' + esc(o.avoid) + '</p>'
      + (o.id === 'card' && h.base ? '<p class="small muted">Your KPI has a ' + (h.target ? 'target' : 'comparison') + '; a card with variance shows it.</p>' : '')
      + '<button type="button" class="btn' + (o === chosen ? ' primary' : '') + '" data-opt="' + o.id + '" aria-pressed="' + (o === chosen) + '">' + (o === chosen ? '&#10003; Building this' : 'Build this') + '</button></article>';
  }
}

/* ---------- Step 5: build ---------- */
const B = n => '<b>' + esc(bracket(n)) + '</b>';
const FP = p => '<b>Format visual &gt; ' + p + '</b>';
const FX = n => 'select the <b>fx</b> button, set Format style to <b>Field value</b> and pick ' + B(n);
// Setup steps in Power BI for the chosen option, in groups: [{ title, steps: [html] }]
function kvSteps(id, kpis, cfg){
  const k = kpis[0], h = kvHas(k), m = kvRef(k.measure), trend = esc((cfg.trendCol || '').trim() || "'Date'[Month Start]");
  const plan = kvPlan(kpis, cfg, id), status = x => kvOptionMeasures(id, x, cfg).some(p => /Status Label$/.test(p.name));
  const G = [];
  if (plan.length) {
    const tbl = esc((cfg.table || '').trim() || '_Measures'), fold = esc(normFolder(cfg.folder || '') || '');
    G.push({ title: 'Add the measures to your model', steps: [
      'Optional: copy the <b>test query</b> above, open <b>DAX query view</b> (on the left edge of Power BI Desktop), paste it into a new query tab and select <b>Run</b>. You see what each new measure returns. Nothing in the model changes.',
      'Open <b>TMDL view</b> (also on the left edge). If it isn&rsquo;t there, turn it on under File &gt; Options and settings &gt; Options &gt; Preview features.',
      'Copy the <b>TMDL script</b> above, open a new tab with <b>+</b>, paste the script and select <b>Apply</b>. It only adds ' + (id === 'rtable' ? 'the scorecard table and its measures, plus ' : '') + 'measures in <b>' + tbl + '</b>' + (fold ? ', in the folder <b>' + fold + '</b>' : '') + '.',
      'Go back to <b>Report view</b>. The new measures are in the Data pane under ' + (id === 'rtable' ? '<b>' + esc(kvScoreTable(cfg)) + '</b> and ' : '') + '<b>' + tbl + '</b>.'] });
  }
  const tip = 'Names in the Format pane move a little between Power BI versions. If a setting isn&rsquo;t where a step says, type its name in the search box at the top of the Format pane.';
  const newCard = 'Select an empty spot on the page, then select the <b>Card</b> visual in the Visualizations pane (the newer card; some versions list it as <b>Card (new)</b>).';
  const callout = FP('Visual &gt; Callout value') + ': set Display units to <b>Auto</b> and the decimal places you want.';
  const refLabel = x => [
    FP('Visual &gt; Reference labels') + ': turn them on and add a label. For its value (Data), pick ' + B(kvMName(x, 'Status Label')) + '. Turn the label&rsquo;s title off, or call it &ldquo;' + (kvHas(x).target ? 'vs target' : 'vs ' + esc((x.compareLabel || '').trim() || 'last period')) + '&rdquo;.',
    'For the reference label&rsquo;s value color, ' + FX(kvMName(x, 'Status Color')) + '. Leave its background off: a background fills the whole label area under the value, not just the text. For a colored pill like Excel&rsquo;s, use the HTML card.'];
  const ctxLabels = x => kvCtx(x).slice(0, KV_CTX_MAX).map((c, j) => FP('Visual &gt; Reference labels') + ': add ' + (j || id === 'cardvar' ? 'another' : 'a') + ' label with value ' + B(kvCtxName(x, j)) + ' (&ldquo;' + esc(kvCtxSample(x, c)) + '&rdquo; in the preview). Turn its title off and make its value your label color (' + kvInk(cfg).muted + '): it&rsquo;s context, not good or bad.');
  // Reference labels to the right of the callout value (Step 5 choice)
  const right = usesRef(id, kpis, cfg) && kvRight(cfg);
  const rightSteps = right ? [
    FP('Visual &gt; Cards &gt; Layout') + ': set Arrangement to <b>Horizontal</b> and Order to <b>Callout</b>, then <b>Reference labels</b>. The labels move to the right of the value.',
    'Under the same Layout, set <b>Callout size</b> to about 55%. Lower it if the labels are cut off; raise it if the value is.',
    FP('Visual &gt; Reference labels layout') + ': set the vertical alignment to <b>Middle</b> and turn the background off. For a line between the value and the labels, turn on <b>Divider</b> if your version has it.'] : [];
  const wide = (a, b) => right ? b : a;
  const finish = (alt, size) => ({ title: 'Finish', steps: [
    'Drag the corners until nothing is cut off' + (size ? '; about ' + size + ' pixels works' : '') + '. To set it exactly, use ' + FP('General &gt; Properties &gt; Size') + '.',
    FP('General &gt; Title') + ': name the period, like &ldquo;' + esc(kvName(k)) + ', year to date&rdquo;, so readers know what they&rsquo;re looking at.',
    alt ? FP('General &gt; Alt text') + ': ' + FX(alt) + ', so screen readers hear the status too.' : '',
    'Test it: change a slicer or filter and check the number' + (alt ? ', color and arrow change' : ' changes') + ' with it.'].filter(Boolean) });
  const ds = KV_DESIGNS[id] || (id === 'rlist' ? kvListEls(kpis, cfg, false) : null);
  if (ds) {
    const pic = id === 'rlist' ? 'KPI List Card' : kvMName(k, 'Card'), P = kvInk(cfg);
    G.push({ title: 'Add the visual', steps: [newCard, 'Drag <b>' + esc(m) + '</b> into the <b>Data</b> field well. The card needs a value to show the picture; you hide the value next.'] });
    G.push({ title: 'Show the card picture', tip, steps: [
      'Turn ' + FP('Visual &gt; Image') + ' on (the card image, not the callout image). Take the image from data (called Image URL or Select from data, depending on your version), select <b>fx</b> if asked, and pick ' + B(pic) + '. Set Image fit to <b>Fit</b>.',
      FP('Visual &gt; Callout value') + ', <b>Label</b> and <b>Reference labels</b>: turn them off, so only the picture shows.',
      FP('Visual &gt; Cards') + ' and ' + FP('General &gt; Effects') + ': turn the background, border and shadow off. The picture has its own background (' + P.bg + ') and rounded corners.',
      FP('General &gt; Properties &gt; Size') + ': about ' + (ds.w + 16) + ' wide and ' + (ds.h + 16) + ' high, so the picture shows at its real size (' + ds.w + ' &times; ' + ds.h + ').',
      'In a table instead: add ' + B(pic) + ' as its only column and set ' + FP('Visual &gt; Image size') + ' to ' + ds.h + ' high and ' + ds.w + ' wide. To hide the header, rename the column to a single space.',
      'Colors come from Step 4 on this page. To change them, change them there and paste the script again.'] });
    G.push({ title: 'Finish', steps: [FP('General &gt; Title') + ': turn it off; the picture already shows the name.', 'Test it: change a slicer or filter and check the numbers and colors change with it.'] });
    return G;
  }
  const svg = { bullet: ['Bullet', 120, 24], progress: ['Progress', 120, 24], spark: ['Sparkline', 120, 32], varbar: ['Variance Bar', 120, 24], slope: ['Slope', 120, 32], waffle: ['Waffle', 60, 60] }[id];
  if (svg) {
    const pic = kvMName(k, svg[0]), st = status(k);
    G.push({ title: 'Add the visual', steps: [newCard, 'Drag <b>' + esc(m) + '</b> from the Data pane into the visual&rsquo;s <b>Data</b> field well.'] });
    G.push({ title: 'Format it', tip, steps: [callout].concat(st ? refLabel(k) : [], rightSteps, [
      FP('Visual &gt; Images') + ': turn images on and set Image type to <b>Image URL</b>. For the URL, ' + FX(pic) + '.',
      'Under Images, set Position to <b>Bottom</b> (or Right) and the size to about ' + svg[1] + ' wide and ' + svg[2] + ' high.',
      'In a table or matrix instead: add ' + B(pic) + ' as a column and set ' + FP('Visual &gt; Image size') + ' to ' + svg[2] + ' high and ' + svg[1] + ' wide. The script already marks it as an Image URL, so it shows as a picture.']) });
    G.push(finish(st ? kvMName(k, 'Status Label') : '', '250 &times; 170'));
    return G;
  }
  const C = cfg.colors;
  switch (id) {
    case 'card':
      G.push({ title: 'Add the visual', steps: [newCard, 'Drag <b>' + esc(m) + '</b> into the <b>Data</b> field well.'] });
      G.push({ title: 'Format it', tip, steps: [callout, FP('Visual &gt; Label') + ' (the category label under the value): keep it on, or turn it off when the title already names the KPI.', 'Nothing to add to the model. When you have a target or a comparison, a card with variance tells readers whether the number is good.'] });
      G.push(finish('', '220 &times; 120')); break;
    case 'html': {
      const hm = kvMName(k, 'HTML Card');
      G.push({ title: 'Get the HTML Content visual (once per report)', steps: [
        'In the Visualizations pane, select the <b>&hellip;</b> (Get more visuals) &gt; <b>Get more visuals</b>, search for <b>HTML Content</b> (by Daniel Marsh-Patrick) and select <b>Add</b>.',
        'If AppSource visuals are blocked where you work, ask your Power BI admin to allow it, or build a card with variance instead.'] });
      const lay = kvHtmlLayout(k, cfg), sz = lay.size;
      G.push({ title: 'Add the visual', steps: ['Select an empty spot, then select the <b>HTML Content</b> icon in the Visualizations pane.', 'Drag ' + B(hm) + ' into its <b>Values</b> field well. The card draws itself from the measure&rsquo;s HTML.'] });
      G.push({ title: 'Size it', steps: [
        FP('General &gt; Properties &gt; Size') + ': set the width to <b>' + sz.w + '</b> and the height to <b>' + sz.h + '</b>. The measure&rsquo;s text sizes, gaps and padding are built for that size' + (lay.tooSmall ? ', the smallest where every line is readable (you entered ' + lay.W + ' &times; ' + lay.H + ')' : '') + '.',
        'Resizing the visual doesn&rsquo;t resize the text. If you change its size, enter the new size under <b>Visual size</b> above and paste the script again.'] });
      G.push({ title: 'Format it', tip, steps: [
        FP('General &gt; Title') + ' and <b>Background</b>: turn them off, so only the card shows.',
        'To change colors, the font or one text size, edit the style variables at the top of ' + B(hm) + ' (<b>_BoxStyle</b>, <b>_ValueStyle</b> and so on) in TMDL view or the formula bar.',
      ].concat(kvCtx(k).length ? ['Your context lines (' + kvCtx(k).slice(0, KV_CTX_MAX).map((c, j) => B(kvCtxName(k, j))).join(', ') + ') are already in the card, under the value.'] : []).concat([
        'To use the card outside Power BI (an email, a web page), copy the <b>HTML file</b> above. It has the numbers shown in the preview, not live data.']) });
      { const fin = finish(h.base ? kvMName(k, 'Status Label') : '', ''); fin.steps.shift(); G.push(fin); } break;
    }
    case 'ctxlabel': case 'ctxsub': case 'ctxtip': {
      const cs = kvCtx(k).slice(0, KV_CTX_MAX), names = cs.map((c, j) => kvCtxName(k, j));
      G.push({ title: 'Add the visual', steps: [newCard, 'Drag <b>' + esc(m) + '</b> into the <b>Data</b> field well.'] });
      if (id === 'ctxlabel') G.push({ title: 'Format it', tip, steps: [callout].concat(ctxLabels(k), rightSteps) });
      if (id === 'ctxsub') G.push({ title: 'Format it', tip, steps: [callout,
        FP('General &gt; Title') + ': turn the title on and type ' + esc(kvName(k)) + ' as its text.',
        'Under Title, turn <b>Subtitle</b> on. For its text, ' + FX(names[0]) + '. Make it a size or two smaller than the title, in your label color (' + kvInk(cfg).muted + ').'].concat(names[1] ? ['Your second context line doesn&rsquo;t fit in the subtitle. Add it as a reference label: ' + FP('Visual &gt; Reference labels') + ', value ' + B(names[1]) + '.'] : [])
        .concat([FP('Visual &gt; Label') + ' (the category label under the value): turn it off; the title already names the KPI.']) });
      if (id === 'ctxtip') G.push({ title: 'Format it', tip, steps: [callout,
        'Drag ' + names.map(B).join(' and ') + ' into the visual&rsquo;s <b>Tooltips</b> field well.',
        'In the Tooltips well, double-click each one and rename it for readers, like &ldquo;' + cs.map((c, j) => esc(kvCtxTipName(c, j))).join('&rdquo; and &ldquo;') + '&rdquo;.',
        'Check ' + FP('General &gt; Tooltips') + ' is on. Hover the card to see them.'] });
      G.push(finish('', id === 'ctxlabel' ? wide('220 &times; 140', '320 &times; 110') : '220 &times; 140'));
      break;
    }
    case 'cardvar':
      G.push({ title: 'Add the visual', steps: [newCard, 'Drag <b>' + esc(m) + '</b> into the <b>Data</b> field well.'] });
      G.push({ title: 'Format it', tip, steps: [callout].concat(refLabel(k), ctxLabels(k), rightSteps) });
      G.push(finish(kvMName(k, 'Status Label'), wide('250 &times; 150', '340 &times; 110'))); break;
    case 'core':
      G.push({ title: 'Add the card', steps: [newCard, 'Drag <b>' + esc(m) + '</b> into the <b>Data</b> field well.'] });
      G.push({ title: 'Format the card', tip, steps: [callout].concat(status(k) ? refLabel(k) : [], rightSteps) });
      G.push({ title: 'Add the area chart under it', steps: [
        'Select an empty spot, then select <b>Area chart</b> in the Visualizations pane.',
        'X-axis: ' + trend + '. Y-axis: <b>' + esc(m) + '</b>.',
        'In the Format pane turn off ' + FP('Visual &gt; X-axis') + ', <b>Y-axis</b>, <b>Gridlines</b> and <b>Legend</b>, and ' + FP('General &gt; Title') + '.',
        FP('Visual &gt; Lines') + ' (and Shade area): make the line and area a light grey, so the trend sits behind the number.',
        'Make it the same width as the card and about a third of its height, then place it along the card&rsquo;s bottom edge.',
        'Select both visuals (Ctrl+click), right-click and choose <b>Group &gt; Group</b>, so they move and resize together.'] });
      G.push(finish(status(k) ? kvMName(k, 'Status Label') : '', '')); break;
    case 'kpi':
      G.push({ title: 'Add the visual', steps: ['Select an empty spot, then select the <b>KPI</b> visual in the Visualizations pane.', 'Field wells: <b>Value</b> ' + esc(m) + ', <b>Trend axis</b> ' + trend + ', <b>Target</b> ' + esc(kvRef(k.target)) + '.'] });
      G.push({ title: 'Format it', tip, steps: [
        FP('Visual &gt; Color coding') + ' (called Indicator in some versions): Direction <b>' + (k.better === 'lower' ? 'Low is good' : 'High is good') + '</b>, Good color ' + esc(C.good.text) + ', Neutral color ' + esc(C.neutral.text) + ', Bad color ' + esc(C.bad.text) + '. Neutral needs a distance from goal, set as a % next to it (' + esc(String(cfg.band)) + '% matches this page).',
        FP('Visual &gt; Target label') + ': turn it on, label it &ldquo;Goal&rdquo; and show the distance to goal as a <b>Percent</b>.',
        FP('Visual &gt; Trend axis') + ': keep it on; that&rsquo;s the shaded trend behind the value.',
        'Nothing to add to the model.'] });
      G.push(finish('', '250 &times; 170')); break;
    case 'gauge':
      G.push({ title: 'Add the visual', steps: ['Select an empty spot, then select <b>Gauge</b> in the Visualizations pane.', 'Field wells: <b>Value</b> ' + esc(m) + ', <b>Target value</b> ' + esc(kvRef(k.target)) + '.', 'Set the maximum about 25% above the target, so the needle doesn&rsquo;t sit at the end: put a measure in the <b>Maximum value</b> well, or type a number under ' + FP('Visual &gt; Gauge axis &gt; Max') + '.'] });
      G.push({ title: 'Format it', tip, steps: [FP('Visual &gt; Colors') + ': for Fill color, ' + FX(kvMName(k, 'Status Color')) + '. Keep the target color a dark grey.', FP('Visual &gt; Data labels') + ': turn them off if the callout already shows the value.'] });
      G.push(finish(kvMName(k, 'Status Label'), '250 &times; 170')); break;
    case 'rcards': case 'rspark': case 'rbullet': {
      const pic = id === 'rspark' ? 'Sparkline' : id === 'rbullet' ? 'Bullet' : '';
      G.push({ title: 'Add the visual', steps: [newCard, 'Drag each KPI measure into the <b>Data</b> field well, in this order: ' + kpis.map(x => '<b>' + esc(kvRef(x.measure)) + '</b>').join(', ') + '. One card visual shows a card for each.', FP('Visual &gt; Layout') + ': set the arrangement to a single row with ' + kpis.length + ' cards (max tiles), and the gap between them.'] });
      const each = kpis.map(x => { const st = status(x), hasPic = pic && (pic !== 'Bullet' || kvHas(x).target); if (!st && !hasPic) return ''; return '<b>' + esc(kvRef(x.measure)) + '</b>: ' + [st ? 'reference label ' + B(kvMName(x, 'Status Label')) + ', its color from ' + B(kvMName(x, 'Status Color')) : '', hasPic ? 'image ' + B(kvMName(x, pic)) : ''].filter(Boolean).join('; ') + '.'; }).filter(Boolean);
      const steps = [callout + ' Leave &ldquo;Apply settings to&rdquo; on <b>All</b> for this, so every card matches.',
        'At the top of the Visual tab, set <b>Apply settings to</b> (Series) to one KPI at a time. Then:'];
      if (each.length) steps.push('<ul>' + each.map(x => '<li>' + x + '</li>').join('') + '</ul>');
      steps.push('For each one, ' + FP('Visual &gt; Reference labels') + ': add a label and pick its Status Label; for the value color, select <b>fx</b>, Format style <b>Field value</b>, and pick its Status Color. Leave the label background off; it would fill the whole label area.');
      if (right) steps.push(...rightSteps.map(x => x + ' Keep &ldquo;Apply settings to&rdquo; on <b>All</b> for this.'));
      if (pic) steps.push('And ' + FP('Visual &gt; Images') + ': turn images on, set Image type to <b>Image URL</b>, select <b>fx</b> &gt; Field value and pick its ' + pic + ' measure. Position <b>Bottom</b>.' + (id === 'rbullet' ? ' KPIs without a target get no bullet.' : ''));
      G.push({ title: 'Format it', tip, steps });
      G.push(finish('', 'about ' + wide(220, 300) + ' wide per card, so ' + (kpis.length * wide(230, 310)) + ' &times; ' + (pic ? 170 : wide(150, 110)))); break;
    }
    case 'rtable': {
      const t = qName(kvScoreTable(cfg));
      G.push({ title: 'Add the visual', steps: ['Select an empty spot, then select <b>Table</b> in the Visualizations pane.', 'Drag these into <b>Columns</b>, in order: ' + esc(t) + '[KPI], [KPI Value], [KPI Status Label]' + (kpis.some(x => kvHas(x).target) ? ', [KPI Bullet]' : '') + ', [KPI Trend]. You get one row per KPI, in your order.', 'To rename a column header, double-click it in the Columns well (for example, &ldquo;Status&rdquo;, &ldquo;Target&rdquo;, &ldquo;Last ' + (cfg.periods || 12) + '&rdquo;).'] });
      G.push({ title: 'Format it', tip, steps: [
        'In the Columns well, select the arrow next to <b>KPI Status Label</b> &gt; <b>Conditional formatting</b> &gt; <b>Font color</b>. Set Format style to <b>Field value</b> and pick [KPI Status Color]. Select OK.',
        'Do the same for <b>Background color</b> with [KPI Status Fill].',
        FP('Visual &gt; Image size') + ': height 32, width 120.',
        FP('Visual &gt; Totals') + ': turn totals off; a total of different KPIs means nothing.',
        'To change the KPIs later, come back to this page and apply the new script. It replaces the scorecard table and its measures.'] });
      G.push(finish('', '')); break;
    }
  }
  return G;
}
// Options whose setup uses the card's reference labels, so they can go to the right of the value
function usesRef(id, kpis, cfg){
  if (['cardvar', 'ctxlabel'].includes(id)) return true;
  return ['core', 'bullet', 'progress', 'spark', 'varbar', 'waffle', 'rcards', 'rspark', 'rbullet'].includes(id) && kpis.some(x => kvHas(x).base && (x.measure || '').trim());
}
function renderBuild(){
  const o = chosenOption(), row = state.cfg.mode === 'row';
  const kpis = row ? state.kpis : (currentKpi() ? [currentKpi()] : []);
  $('buildName').textContent = o ? o.name : '';
  if (!o || !kpis.length) { $('buildKind').textContent = 'Add a KPI in Step 2 first.'; $('steps').innerHTML = ''; $('setupHead').hidden = true; $('checks').innerHTML = ''; $('outBox').hidden = true; $('buildCfg').hidden = true; state.out = {}; return; }
  const plan = kvPlan(kpis, state.cfg, o.id);
  $('buildKind').textContent = plan.length ? 'The script adds ' + plan.length + ' measure' + (plan.length > 1 ? 's' : '') + (o.id === 'rtable' ? ' and the scorecard table' : '') + ' to your model. Below the script, step-by-step setup in Power BI says where each one goes.' : 'Nothing to add to your model. The steps below set it up in Power BI.';
  $('buildCfg').hidden = !plan.length;
  const spark = plan.some(m => /Sparkline/.test(m.name) || m.usesTrend);
  $('trendWrap').hidden = !spark && o.id !== 'kpi' && o.id !== 'core'; $('periodsWrap').hidden = !spark; $('scoreWrap').hidden = o.id !== 'rtable'; $('htmlSizeWrap').hidden = o.id !== 'html'; renderHtmlFit(o.id === 'html' ? kpis[0] : null);
  const ref = usesRef(o.id, kpis, state.cfg); $('refPosWrap').hidden = !ref; $('refBelow').checked = !kvRight(state.cfg); $('refRight').checked = kvRight(state.cfg);
  if (!plan.length && (o.id === 'kpi' || o.id === 'core' || ref)) $('buildCfg').hidden = false;
  if (!plan.length) ['homeTable', 'folder'].forEach(id => { $(id).closest('.field').hidden = true; }); else ['homeTable', 'folder'].forEach(id => { $(id).closest('.field').hidden = false; });
  syncInputs();
  $('setupHead').hidden = false;
  $('steps').innerHTML = kvSteps(o.id, kpis, state.cfg).map(g => '<div class="kv-grp"><h4>' + g.title + '</h4>' + (g.tip ? '<p class="small muted">' + g.tip + '</p>' : '') + '<ol class="kv-steps">' + g.steps.map(s => '<li>' + s + '</li>').join('') + '</ol></div>').join('');
  if (!plan.length) { $('checks').innerHTML = ''; $('outBox').hidden = true; state.out = {}; return; }
  const checks = kvChecks(kpis, state.cfg, o.id, state.model), errs = checks.filter(x => x.level === 'err');
  $('checks').innerHTML = checks.map(x => '<div class="msg ' + x.level + '">' + esc(x.text) + '</div>').join('') || (state.model ? '<div class="msg ok">&#10003; Every name checks out against the export.</div>' : '');
  $('outBox').hidden = !!errs.length;
  if (errs.length) { state.out = {}; return; }
  state.out.tmdl = kvTmdl(kpis, state.cfg, o.id); state.out.test = kvTestQuery(kpis, state.cfg, o.id);
  state.out.html = o.id === 'html' ? '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + kvHtmlEsc(kvName(kpis[0])) + '</title></head>\n<body style="margin:16px">\n<div style="width:' + (kvHtmlLayout(kpis[0], state.cfg).size.w - KV_HTML_EDGE) + 'px">\n' + kvHtmlCard(kpis[0], state.cfg) + '\n</div>\n</body></html>\n' : '';
  $('htmlBox').hidden = !state.out.html; $('htmlView').textContent = state.out.html;
  $('tmdlView').innerHTML = hl(state.out.tmdl); $('testView').innerHTML = hl(state.out.test);
}
// The HTML card at the size entered, in each layout that suits it, with a readability check
function renderHtmlFit(k){
  const box = $('htmlFit'); box.hidden = !k; if (!k) { box.innerHTML = ''; return; }
  const c = state.cfg, l = kvHtmlLayout(k, c), best = kvHtmlBest(k, c), lays = kvHtmlLayoutsFor(k), nm = id => KV_HTML_LAYOUTS.find(o => o.id === id).name;
  const btn = (id, label) => '<button type="button" class="btn" data-hlay="' + id + '" aria-pressed="' + ((c.htmlLayout || 'auto') === id || (id === 'auto' && !lays.some(o => o.id === c.htmlLayout))) + '">' + label + '</button>';
  box.innerHTML = '<div class="kv-lays"><span class="small">Layout:</span>' + btn('auto', 'Best fit (' + nm(best.lay) + ')') + (lays.length > 1 ? lays.map(o => btn(o.id, o.name)).join('') : '') + '</div>'
    + (l.tooSmall
      ? '<div class="msg warn">At ' + l.W + ' &times; ' + l.H + ' the card doesn&rsquo;t fit with text of ' + KV_HTML_MIN_PX + ' px or more. Make the visual at least <b>' + l.minSize.w + ' &times; ' + l.minSize.h + '</b> (' + l.comfy.w + ' &times; ' + l.comfy.h + ' reads more easily). The script is built for ' + l.minSize.w + ' &times; ' + l.minSize.h + '.</div>'
      : '<div class="msg ok">' + nm(l.lay) + ' fits ' + l.W + ' &times; ' + l.H + ': the value is ' + l.value + ' px and the smallest text ' + l.smallest + ' px (never below ' + KV_HTML_MIN_PX + ').</div>')
    + '<div class="kv-fitwrap">' + lays.map(o => {
      const f = kvHtmlFitFor(k, c, o.id);
      return '<figure class="kv-fitfig' + (o.id === l.lay ? ' on' : '') + '" data-hlay="' + o.id + '" title="' + esc(o.tip) + '"><figcaption class="small">' + o.name + (o.id === best.lay ? ' <span class="muted">(best fit)</span>' : '') + ' &middot; ' + (f.tooSmall ? 'needs ' + f.minSize.w + ' &times; ' + f.minSize.h : 'value ' + f.value + ' px') + '</figcaption>'
        + '<div class="kv-fitframe" style="width:' + f.size.w + 'px;height:' + f.size.h + 'px;padding:' + (KV_HTML_EDGE / 2) + 'px">' + kvHtmlCard(k, c, f) + '</div></figure>';
    }).join('') + '</div><div class="small muted">Shown at the size the script is built for, with the preview&rsquo;s numbers. Select one to use it.</div>';
}
function syncInputs(){
  const c = state.cfg;
  [['homeTable', 'table'], ['folder', 'folder'], ['trendCol', 'trendCol'], ['periods', 'periods'], ['scoreTable', 'scoreTable'], ['htmlW', 'htmlW'], ['htmlH', 'htmlH']].forEach(([id, key]) => { if (document.activeElement !== $(id)) $(id).value = c[key]; });
}
function renderLive(){ renderOptions(); renderBuild(); }
function renderAll(){ renderKpis(); renderModel(); renderColors(); renderLive(); }

/* ---------- init ---------- */
function resetAll(){
  $('modelInput').value = ''; $('search').value = ''; $('themeJson').value = '';
  state.kpis = []; state.cfg = blankCfg(); setExample(false); $('queryBox').open = false; $('presetMsg').innerHTML = '';
  renderAll();
}
function init(){
  $('exportView').textContent = DAX_QUERY;
  const saved = store.get('model');
  let kpis = null, cfg = null; try { kpis = JSON.parse(store.get('kpis') || 'null'); cfg = JSON.parse(store.get('cfg') || 'null'); } catch (e) {}
  if (cfg) { state.cfg = Object.assign(blankCfg(), cfg); state.cfg.ink = kvInk(cfg); }
  if (saved && saved.trim()) $('modelInput').value = saved;
  if (kpis && kpis.length) state.kpis = kpis.map(k => Object.assign(kvBlankKpi(), k, { pv: Object.assign(kvBlankKpi().pv, k.pv || {}), ctx: Array.isArray(k.ctx) ? k.ctx.slice(0, KV_CTX_MAX).map(c => Object.assign(kvBlankCtx(c.kind), c)) : [] }));
  else if (!(saved && saved.trim()) && store.get('blank') !== '1') { state.kpis = clone(KV_EX_KPIS); Object.assign(state.cfg, KV_EX_CFG); setExample(true); }
  renderAll();
  $('dlHtml').addEventListener('click', () => { if (!state.out.html) return; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([state.out.html], { type: 'text/html' })); a.download = (kvName(currentKpi() || {}).replace(/[^\w -]+/g, '').trim() || 'KPI') + ' card.html'; document.body.appendChild(a); a.click(); a.remove(); });

  const touch = () => { try { localStorage.removeItem(PREFIX + 'blank'); } catch (e) {} };
  $('modelInput').addEventListener('input', () => { if ($('modelInput').value.trim()) leaveExample(); touch(); renderKpis(); renderModel(); renderLive(); persist(); });
  $('modeOne').addEventListener('change', () => { state.cfg.mode = 'one'; renderLive(); persist(); });
  $('modeRow').addEventListener('change', () => { state.cfg.mode = 'row'; renderLive(); persist(); });
  $('addKpi').addEventListener('click', () => {
    leaveExample(); touch();
    if (state.kpis.length < KV_MAX) state.kpis.push(kvBlankKpi());
    state.cfg.sel = state.kpis.length - 1;
    renderKpis(); renderAvail(); renderLive(); persist();
    const f = document.querySelector('#kpis .kv-ed:last-of-type input'); if (f) f.focus();
  });
  $('kpis').addEventListener('click', e => {
    const c = e.target.closest('[data-act=addctx],[data-act=rmctx]');
    if (c) {
      const i = +c.closest('[data-i]').dataset.i;
      if (state.example) { leaveExample(); state.kpis = [kvBlankKpi()]; }
      const k = state.kpis[Math.min(i, state.kpis.length - 1)]; k.ctx = k.ctx || [];
      if (c.dataset.act === 'addctx' && k.ctx.length < KV_CTX_MAX) k.ctx.push(kvBlankCtx(kvIntent(k) === 'context' && !k.ctx.length ? 'share' : 'measure'));
      if (c.dataset.act === 'rmctx') k.ctx.splice(+c.dataset.j, 1);
      touch(); renderKpis(); renderLive(); persist();
      return;
    }
    const b = e.target.closest('[data-act=rm]'); if (!b) return;
    const i = +b.closest('[data-i]').dataset.i;
    if (state.example) { leaveExample(); } else state.kpis.splice(i, 1);
    touch(); state.cfg.sel = Math.max(0, Math.min(state.cfg.sel, state.kpis.length - 1));
    renderKpis(); renderAvail(); renderLive(); persist();
  });
  const onField = e => {
    const f = e.target.dataset.f; if (!f) return;
    const i = +e.target.closest('[data-i]').dataset.i;
    if (state.example) {
      // typing into the example keeps only what was typed, and drops every other example field
      const was = getF(KV_EX_KPIS[i], f) || '', own = e.target.tagName === 'SELECT' ? e.target.value : SF_SUITE.ownText(e.target.value, was);
      leaveExample(); touch();
      const k = kvBlankKpi(); setF(k, f, own); state.kpis = [k];
      renderKpis(); renderAvail(); renderLive(); persist();
      const el = $('k0_' + f.replace(/^ctx\.(\d+)\./, 'ctx$1')); if (el) { if (f.startsWith('pv.')) el.closest('details').open = true; el.focus(); if (el.setSelectionRange && el.type === 'text') el.setSelectionRange(el.value.length, el.value.length); }
      return;
    }
    setF(state.kpis[i], f, e.target.value); touch();
    state.cfg.sel = i;
    if (f === 'intent' || /^ctx\.\d+\.kind$/.test(f)) { if (f === 'intent') state.cfg.option = ''; renderKpis(); const el = $('k' + i + '_' + (f === 'intent' ? 'intent' : 'ctx' + f.split('.')[1] + 'kind')); if (el) el.focus(); }
    const kp = $('kpiPick'); if (kp) kp.value = i;
    if (f === 'measure' && state.model) renderAvail();
    renderLive(); persist();
  };
  $('kpis').addEventListener('input', onField);
  $('kpis').addEventListener('change', e => { if (e.target.tagName === 'SELECT') onField(e); });
  $('search').addEventListener('input', renderAvail);
  $('avail').addEventListener('click', e => {
    const b = e.target.closest('[data-i]'); if (!b) return;
    const x = state.availList[+b.dataset.i]; if (!x) return;
    leaveExample(); touch();
    if (inKpis(x.name)) state.kpis = state.kpis.filter(k => lc(k.measure) !== lc(x.name));
    else if (state.kpis.length < KV_MAX) { state.kpis.push(kpiFromMeasure(x)); state.cfg.sel = state.kpis.length - 1; }
    renderKpis(); renderAvail(); renderLive(); persist();
  });
  $('colorPresets').addEventListener('click', e => { const b = e.target.closest('[data-preset]'); if (!b) return; applyPreset(b.dataset.preset); renderColors(); renderLive(); persist(); });
  $('themeJson').addEventListener('input', () => { readThemeJson(); renderColors(); renderLive(); persist(); });
  $('openTheme').addEventListener('click', () => $('themeFile').click());
  $('themeFile').addEventListener('change', () => { const f = $('themeFile').files[0]; if (!f) return; f.text().then(t => { $('themeJson').value = t; readThemeJson(); renderColors(); renderLive(); persist(); }); $('themeFile').value = ''; });
  $('colorRows').addEventListener('input', e => {
    const k = e.target.dataset.c; if (!k) return;
    const [s, part] = k.split('.'); state.cfg.colors[s][part] = kvHex(e.target.value) || state.cfg.colors[s][part]; state.cfg.preset = '';
    const sp = e.target.parentElement.querySelector('.mono'); if (sp) sp.textContent = state.cfg.colors[s][part];
    document.querySelectorAll('#colorPresets [data-preset]').forEach(b => b.setAttribute('aria-pressed', 'false'));
    renderLive(); persist();
  });
  $('colorRows').addEventListener('change', () => renderColors());
  $('inkRows').addEventListener('input', e => {
    const x = e.target.dataset.ink; if (!x) return;
    state.cfg.ink = kvInk(state.cfg); state.cfg.ink[x] = kvHex(e.target.value) || state.cfg.ink[x];
    const sp = e.target.parentElement.querySelector('.mono'); if (sp) sp.textContent = state.cfg.ink[x];
    renderLive(); persist();
  });
  $('inkRows').addEventListener('change', () => renderColors());
  $('inkReset').addEventListener('click', () => { state.cfg.ink = clone(KV_INK_DEF); renderColors(); renderLive(); persist(); });
  ['refBelow', 'refRight'].forEach(id => $(id).addEventListener('change', () => { state.cfg.refPos = $('refRight').checked ? 'right' : 'below'; renderLive(); persist(); }));
  $('band').addEventListener('input', () => { const v = parseFloat($('band').value); state.cfg.band = isFinite(v) ? Math.max(0, Math.min(50, v)) : 0; renderLive(); persist(); });
  $('kpiPick').addEventListener('change', () => { state.cfg.sel = +$('kpiPick').value; renderLive(); persist(); });
  $('options').addEventListener('click', e => {
    const b = e.target.closest('[data-opt]'); if (!b) return;
    if (state.cfg.mode === 'row') state.cfg.rowOption = b.dataset.opt; else state.cfg.option = b.dataset.opt;
    renderLive(); persist();
    const s4 = $('s4'); if (s4 && s4.scrollIntoView) s4.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  [['homeTable', 'table'], ['folder', 'folder'], ['trendCol', 'trendCol'], ['scoreTable', 'scoreTable']].forEach(([id, key]) => $(id).addEventListener('input', () => { state.cfg[key] = $(id).value; renderBuild(); persist(); }));
  $('htmlFit').addEventListener('click', e => { const b = e.target.closest('[data-hlay]'); if (!b) return; state.cfg.htmlLayout = b.dataset.hlay; renderBuild(); persist(); });
  ['htmlW', 'htmlH'].forEach(id => $(id).addEventListener('input', () => { const v = parseInt($(id).value, 10); state.cfg[id] = isFinite(v) ? Math.max(40, Math.min(2000, v)) : (id === 'htmlW' ? KV_HTML_W : KV_HTML_H); renderBuild(); persist(); }));
  $('periods').addEventListener('input', () => { const v = parseInt($('periods').value, 10); state.cfg.periods = isFinite(v) ? Math.max(2, Math.min(36, v)) : 12; renderBuild(); persist(); });
  $('clearAll').addEventListener('click', () => { resetAll(); try { localStorage.setItem(PREFIX + 'blank', '1'); } catch (e) {} persist(); });
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
