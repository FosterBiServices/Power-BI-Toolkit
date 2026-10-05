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
const blankCfg = () => ({ source: '', modelFrom: '', pbipName: '', mode: 'one', sel: 0, option: '', rowOption: 'rcards', preset: 'excel', colors: clone(KV_EXCEL), band: 2, table: '', folder: 'KPI Visuals', trendCol: "'Date'[Month Start]", periods: 12, scoreTable: 'KPI Scorecard' });
const state = { example: false, model: null, kpis: [], cfg: blankCfg(), out: {} };
const FIELDS = ['label', 'measure', 'format', 'better', 'target', 'compare', 'compareLabel', 'pv.value', 'pv.target', 'pv.compare', 'pv.trend'];
const getF = (k, f) => f.startsWith('pv.') ? k.pv[f.slice(3)] : k[f];
const setF = (k, f, v) => { if (f.startsWith('pv.')) k.pv[f.slice(3)] = v; else k[f] = v; };

function persist(){
  store.set('model', state.example ? '' : $('modelInput').value);
  store.set('kpis', JSON.stringify(state.example ? [] : state.kpis));
  const c = Object.assign({}, state.cfg); if (state.example) { c.table = ''; c.trendCol = blankCfg().trendCol; }
  store.set('cfg', JSON.stringify(c));
}
function setExample(on){ state.example = on; $('exampleBanner').hidden = !on; }
function leaveExample(){ if (state.example) { state.kpis = []; state.cfg.table = ''; state.cfg.sel = 0; setExample(false); } }

/* ---------- Step 2: KPIs ---------- */
function kpiEditor(k, i){
  const f = (field, label, ph, extra) => '<div class="field' + (extra || '') + '"><label for="k' + i + '_' + field + '">' + label + '</label><input type="text" id="k' + i + '_' + field + '" data-f="' + field + '" value="' + esc(getF(k, field) || '') + '" placeholder="' + esc(ph) + '" autocomplete="off" spellcheck="false"' + (/measure|target|compare$/.test(field) ? ' list="measureNames"' : field === 'format' ? ' list="formats"' : '') + '></div>';
  return '<div class="kv-ed" data-i="' + i + '">'
    + '<div class="kv-ed-head"><b>KPI ' + (i + 1) + '</b><button type="button" class="ib" data-act="rm" aria-label="Remove KPI ' + (i + 1) + '">&#10005;</button></div>'
    + '<div class="kv-fields">'
    + f('label', 'Name on the card', 'Sales')
    + f('measure', 'Measure', 'Total Sales')
    + f('format', 'Format string', '\\$#,0 or 0.0%')
    + '<div class="field"><label for="k' + i + '_better">Better when</label><select id="k' + i + '_better" data-f="better"><option value="higher"' + (k.better !== 'lower' ? ' selected' : '') + '>Higher</option><option value="lower"' + (k.better === 'lower' ? ' selected' : '') + '>Lower</option></select></div>'
    + f('target', 'Target <span class="muted">(measure or number)</span>', 'Sales Target')
    + f('compare', 'Compare to <span class="muted">(measure)</span>', 'Sales LY')
    + f('compareLabel', 'Comparison name', 'last year')
    + '</div>'
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
/* ---------- Step 1: connect ---------- */
function renderSource(){
  const c = state.cfg;
  document.querySelectorAll('.kv-src [data-src]').forEach(b => b.setAttribute('aria-checked', b.dataset.src === c.source));
  $('srcPbip').hidden = c.source !== 'pbip'; $('srcExport').hidden = c.source !== 'export';
}
function renderModel(){
  renderSource();
  const c = state.cfg, text = $('modelInput').value;
  const active = c.source && c.source !== 'none' && c.source === c.modelFrom;
  const m = active && text.trim() ? parseModel(text) : null;
  state.model = m && !m.error ? m : null;
  if (c.source !== 'pbip' || !state.pbipMsg) $('modelMsg').innerHTML = m && m.error ? '<div class="msg err">' + esc(m.error) + '</div>' : c.source === 'none' ? '<div class="msg info">Type each KPI&rsquo;s measure name in Step 2.</div>' : !c.source ? '<div class="msg info">Choose how to connect. The example below uses no model.</div>' : '';
  if (c.source === 'pbip' && state.pbipMsg) $('modelMsg').innerHTML = state.pbipMsg;
  $('modelStats').innerHTML = state.model ? (c.modelFrom === 'pbip' ? '<span class="stat ok">&#10003; ' + esc(c.pbipName || 'PBIP folder') + '</span>' : '') + '<span class="stat"><b>' + state.model.measures.length + '</b> measures</span><span class="stat"><b>' + state.model.tables.length + '</b> tables</span>' : '';
  $('pickBox').hidden = !state.model;
  const ms = state.model ? state.model.measures : [];
  $('measureNames').innerHTML = ms.map(x => '<option value="' + esc(x.name) + '">').join('');
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

/* ---------- Step 3: colors ---------- */
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
  if (document.activeElement !== $('band')) $('band').value = state.cfg.band;
}
function applyPreset(p){
  state.cfg.preset = p; let msg = '';
  if (p === 'excel') state.cfg.colors = clone(KV_EXCEL);
  if (p === 'scale') state.cfg.colors = clone(KV_SCALE);
  if (p === 'tb') { const t = tbColors(); if (t) { state.cfg.colors = t; msg = '<div class="msg ok">Good, neutral and bad from the theme saved in <a href="theme-builder.html">Theme Builder</a>, with lighter fills made from them.</div>'; } else msg = '<div class="msg info">No theme is saved in <a href="theme-builder.html">Theme Builder</a> in this browser yet. Build one there, or paste a theme file.</div>'; }
  if (p === 'json') readThemeJson();
  $('presetMsg').innerHTML = msg;
}
function readThemeJson(){
  const t = $('themeJson').value.trim(); if (!t) { $('presetMsg').innerHTML = ''; return; }
  let o = null; try { o = JSON.parse(t); } catch (e) {}
  const c = kvThemeColors(o);
  if (c) { state.cfg.colors = c; $('presetMsg').innerHTML = '<div class="msg ok">Good, neutral and bad from your theme' + (o.name ? ' (' + esc(o.name) + ')' : '') + ', with lighter fills made from them.</div>'; }
  else $('presetMsg').innerHTML = '<div class="msg err">' + (o ? 'This theme has no good and bad colors. Theme files list them as "good", "neutral" and "bad".' : 'This isn’t valid JSON. Paste the whole theme file.') + '</div>';
}

/* ---------- Step 4: options ---------- */
const KIND = { native: 'Power BI visual', svg: 'SVG measure', core: 'Core visuals' };
function currentKpi(){ return state.kpis[Math.min(state.cfg.sel, state.kpis.length - 1)] || null; }
function chosenOption(){
  if (state.cfg.mode === 'row') return KV_ROW_OPTIONS.find(o => o.id === state.cfg.rowOption) || KV_ROW_OPTIONS[0];
  const k = currentKpi(); if (!k) return null;
  const r = kvRanked(k), pick = r.find(x => x.o.id === state.cfg.option && x.ok);
  return (pick || r[0]).o;
}
function renderOptions(){
  const row = state.cfg.mode === 'row', k = currentKpi();
  $('kpiPickWrap').hidden = row || state.kpis.length < 2;
  $('kpiPick').innerHTML = state.kpis.map((x, i) => '<option value="' + i + '"' + (i === state.cfg.sel ? ' selected' : '') + '>' + esc(kvName(x)) + '</option>').join('');
  if (!state.kpis.length) { $('options').innerHTML = '<p class="note">Add a KPI in Step 2 to see the options.</p>'; $('sampleMsg').innerHTML = ''; return; }
  const chosen = chosenOption();
  const sample = row ? state.kpis.some(x => kvNums(x).sample) : kvNums(k).sample;
  $('sampleMsg').innerHTML = sample ? '<div class="msg info">Some preview numbers are made up because none were typed. Add yours under &ldquo;Numbers for the preview&rdquo; in Step 2.</div>' : '';
  $('s3note').textContent = row ? 'Each layout shows all your KPIs. Pick one to see how to build it.' : 'Best fit first, based on what your KPI has. Pick one to see how to build it.';
  if (row) {
    $('options').innerHTML = KV_ROW_OPTIONS.map(o => '<article class="kv-opt wide' + (o === chosen ? ' on' : '') + '">'
      + '<div class="kv-opt-head"><h3>' + esc(o.name) + '</h3><span class="pill replace">' + KIND[o.kind] + '</span></div>'
      + '<div class="kv-canvas">' + kvRowPreview(o.id, state.kpis, state.cfg) + '</div>'
      + '<p class="small"><b>Fits:</b> ' + esc(o.fits) + '</p><p class="small"><b>Avoid:</b> ' + esc(o.avoid) + '</p>'
      + '<button type="button" class="btn' + (o === chosen ? ' primary' : '') + '" data-opt="' + o.id + '" aria-pressed="' + (o === chosen) + '">' + (o === chosen ? '&#10003; Building this' : 'Build this') + '</button></article>').join('');
    return;
  }
  const h = kvHas(k);
  $('options').innerHTML = kvRanked(k).map(({ o, ok }) => {
    if (!ok) return '<article class="kv-opt off"><div class="kv-opt-head"><h3>' + esc(o.name) + '</h3><span class="pill skip">' + KIND[o.kind] + '</span></div><p class="small muted">' + esc(KV_NEED[o.need] || '') + '. ' + esc(o.fits) + '</p></article>';
    return '<article class="kv-opt' + (o === chosen ? ' on' : '') + '">'
      + '<div class="kv-opt-head"><h3>' + esc(o.name) + '</h3><span class="pill replace">' + KIND[o.kind] + '</span></div>'
      + '<div class="kv-canvas">' + kvPreview(o.id, k, state.cfg) + '</div>'
      + '<dl class="kv-nmc"><dt>Number</dt><dd>' + esc(o.nmc[0]) + '</dd><dt>Meaning</dt><dd>' + esc(o.nmc[1]) + '</dd><dt>Context</dt><dd>' + esc(o.nmc[2]) + '</dd></dl>'
      + '<p class="small"><b>Fits:</b> ' + esc(o.fits) + '</p><p class="small"><b>Avoid:</b> ' + esc(o.avoid) + '</p>'
      + (o.id === 'card' && h.base ? '<p class="small muted">Your KPI has a ' + (h.target ? 'target' : 'comparison') + '; a card with variance shows it.</p>' : '')
      + '<button type="button" class="btn' + (o === chosen ? ' primary' : '') + '" data-opt="' + o.id + '" aria-pressed="' + (o === chosen) + '">' + (o === chosen ? '&#10003; Building this' : 'Build this') + '</button></article>';
  }).join('');
}

/* ---------- Step 5: build ---------- */
const B = n => '<b>' + esc(bracket(n)) + '</b>';
function kvSteps(id, kpis, cfg){
  const k = kpis[0], h = kvHas(k), m = kvRef(k.measure), mn = (k.measure || '').replace(/^\[|\]$/g, '');
  const apply = 'Optional: run the test query in <b>DAX query view</b> to see each new measure&rsquo;s result without changing the model. Then open <b>TMDL view</b>, paste the script into a new tab, select <b>Preview</b> (it only adds measures' + (id === 'rtable' ? ' and the scorecard table' : '') + ') and select <b>Apply</b>.';
  const card = 'Add the new <b>Card</b> visual and put <b>' + esc(m) + '</b> in Data. Set the callout&rsquo;s display units to Auto.';
  const label = h.base ? 'Under Format &gt; <b>Reference labels</b>, add ' + B(kvMName(k, 'Status Label')) + '. For its color, select <b>fx</b>, Format style <b>Field value</b>, field ' + B(kvMName(k, 'Status Color')) + '. For the full Excel look, set the reference label background the same way with ' + B(kvMName(k, 'Status Fill')) + '.' : '';
  const img = (name, w, hh) => 'Put the picture under the value: in the new Card, Format &gt; <b>Images</b>, turn the image on, choose <b>Image URL</b> and pick ' + B(name) + ' with fx. Or use it as a column in a table or matrix and set Format &gt; <b>Image size</b> to ' + hh + ' high and ' + w + ' wide. The script marks it as an Image URL already.';
  const svg = { bullet: ['Bullet', 120, 24], progress: ['Progress', 120, 24], spark: ['Sparkline', 120, 32], varbar: ['Variance Bar', 120, 24], slope: ['Slope', 120, 32], waffle: ['Waffle', 60, 60] }[id];
  if (svg) return [apply, card, img(kvMName(k, svg[0]), svg[1], svg[2]), label].filter(Boolean);
  const C = cfg.colors;
  switch (id) {
    case 'card': return [card, 'Give it a label that names the period, like &ldquo;Sales, year to date&rdquo;, so readers know what they&rsquo;re looking at.', 'Nothing to add to the model. If you have a target or a comparison later, a card with variance tells readers whether the number is good.'];
    case 'cardvar': return [apply, card, label];
    case 'core': return [h.base ? apply : '', card, label, 'Under it, add an <b>Area chart</b>: X-axis ' + esc(cfg.trendCol || "'Date'[Month Start]") + ', Y-axis <b>' + esc(m) + '</b>. Turn off the title, both axes, gridlines and the legend, and make the area grey.', 'Select both visuals and group them (Format &gt; Group) so they move together.'].filter(Boolean);
    case 'kpi': return ['Add the <b>KPI</b> visual: Value <b>' + esc(m) + '</b>, Trend axis ' + esc(cfg.trendCol || "'Date'[Month Start]") + ', Target <b>' + esc(kvRef(k.target)) + '</b>.', 'Under Format &gt; <b>Callout value</b> &gt; Color coding, set Direction to <b>' + (k.better === 'lower' ? 'Low is good' : 'High is good') + '</b>, Good color ' + C.good.text + ', Neutral color ' + C.neutral.text + ' and Bad color ' + C.bad.text + '.', 'Under <b>Target label</b>, show the distance to goal as a %, and label it &ldquo;Goal&rdquo;.', 'Nothing to add to the model.'];
    case 'gauge': return [apply, 'Add the <b>Gauge</b> visual: Value <b>' + esc(m) + '</b>, Target value <b>' + esc(kvRef(k.target)) + '</b>. Set Maximum to a fixed value or a measure about 25% above the target, so the needle doesn&rsquo;t sit at the end.', 'Under Format &gt; <b>Colors</b> &gt; Fill color, select <b>fx</b>, Format style <b>Field value</b>, field ' + B(kvMName(k, 'Status Color')) + '.'];
    case 'rcards': case 'rspark': case 'rbullet': {
      const s = [apply, 'Add one new <b>Card</b> visual and put each KPI measure in Data: ' + kpis.map(x => '<b>' + esc(kvRef(x.measure)) + '</b>').join(', ') + '. It shows one card per measure; set how many per row under Format &gt; <b>Layout</b>.',
        'Under Format &gt; <b>Reference labels</b>, pick each card in the Series list and add its Status Label (for example ' + B(kvMName(kpis.find(x => kvHas(x).base) || k, 'Status Label')) + '). Color each one with fx &gt; Field value &gt; its Status Color, and the background with its Status Fill.'];
      if (id !== 'rcards') s.push('Under Format &gt; <b>Images</b>, pick each card in the Series list, choose <b>Image URL</b> and pick its ' + (id === 'rspark' ? 'Sparkline' : 'Bullet') + ' measure with fx' + (id === 'rbullet' ? '. KPIs without a target get no bullet.' : '.'));
      return s;
    }
    case 'rtable': { const t = kvScoreTable(cfg); return [apply, 'Add a <b>Table</b> visual with ' + esc(qName(t)) + '[KPI], [KPI Value], [KPI Status Label], [KPI Bullet] and [KPI Trend]. One row per KPI, in your order.', 'On <b>KPI Status Label</b>, add conditional formatting: Font color &gt; Field value &gt; [KPI Status Color], and Background color &gt; Field value &gt; [KPI Status Fill].', 'Under Format &gt; <b>Image size</b>, set height 32 and width 120.', 'To change the KPIs later, come back here and apply the new script; it replaces the table and its measures.']; }
  }
  return [];
}
function renderBuild(){
  const o = chosenOption(), row = state.cfg.mode === 'row';
  const kpis = row ? state.kpis : (currentKpi() ? [currentKpi()] : []);
  $('buildName').textContent = o ? o.name : '';
  if (!o || !kpis.length) { $('buildKind').textContent = 'Add a KPI in Step 2 first.'; $('steps').innerHTML = ''; $('checks').innerHTML = ''; $('outBox').hidden = true; $('buildCfg').hidden = true; state.out = {}; return; }
  const plan = kvPlan(kpis, state.cfg, o.id);
  $('buildKind').textContent = plan.length ? 'The script adds ' + plan.length + ' measure' + (plan.length > 1 ? 's' : '') + (o.id === 'rtable' ? ' and the scorecard table' : '') + ' to your model. The steps say where each one goes.' : 'Nothing to add to your model: it’s all set in the visual.';
  $('buildCfg').hidden = !plan.length;
  const spark = plan.some(m => /Sparkline/.test(m.name));
  $('trendWrap').hidden = !spark && o.id !== 'kpi' && o.id !== 'core'; $('periodsWrap').hidden = !spark; $('scoreWrap').hidden = o.id !== 'rtable';
  if (!plan.length && (o.id === 'kpi' || o.id === 'core')) $('buildCfg').hidden = false;
  if (!plan.length) ['homeTable', 'folder'].forEach(id => { $(id).closest('.field').hidden = true; }); else ['homeTable', 'folder'].forEach(id => { $(id).closest('.field').hidden = false; });
  syncInputs();
  $('steps').innerHTML = kvSteps(o.id, kpis, state.cfg).map(s => '<li>' + s + '</li>').join('');
  if (!plan.length) { $('checks').innerHTML = ''; $('outBox').hidden = true; state.out = {}; return; }
  const checks = kvChecks(kpis, state.cfg, o.id, state.model), errs = checks.filter(x => x.level === 'err');
  $('checks').innerHTML = checks.map(x => '<div class="msg ' + x.level + '">' + esc(x.text) + '</div>').join('') || (state.model ? '<div class="msg ok">&#10003; Every name checks out against the export.</div>' : '');
  $('outBox').hidden = !!errs.length;
  if (errs.length) { state.out = {}; return; }
  state.out.tmdl = kvTmdl(kpis, state.cfg, o.id); state.out.test = kvTestQuery(kpis, state.cfg, o.id);
  $('tmdlView').innerHTML = hl(state.out.tmdl); $('testView').innerHTML = hl(state.out.test);
}
function syncInputs(){
  const c = state.cfg;
  [['homeTable', 'table'], ['folder', 'folder'], ['trendCol', 'trendCol'], ['periods', 'periods'], ['scoreTable', 'scoreTable']].forEach(([id, key]) => { if (document.activeElement !== $(id)) $(id).value = c[key]; });
}
function renderLive(){ renderOptions(); renderBuild(); }
function renderAll(){ renderKpis(); renderModel(); renderColors(); renderLive(); }

/* ---------- init ---------- */
function resetAll(){
  $('modelInput').value = ''; $('search').value = ''; $('themeJson').value = '';
  state.kpis = []; state.cfg = blankCfg(); state.pbipMsg = ''; setExample(false); $('queryBox').open = false; $('presetMsg').innerHTML = '';
  renderAll();
}
function init(){
  $('exportView').textContent = DAX_QUERY;
  const saved = store.get('model');
  let kpis = null, cfg = null; try { kpis = JSON.parse(store.get('kpis') || 'null'); cfg = JSON.parse(store.get('cfg') || 'null'); } catch (e) {}
  if (cfg) state.cfg = Object.assign(blankCfg(), cfg);
  if (saved && saved.trim()) { $('modelInput').value = saved; if (!state.cfg.modelFrom) state.cfg.modelFrom = state.cfg.source = 'export'; }
  if (kpis && kpis.length) state.kpis = kpis.map(k => Object.assign(kvBlankKpi(), k, { pv: Object.assign(kvBlankKpi().pv, k.pv || {}) }));
  else if (!(saved && saved.trim()) && store.get('blank') !== '1') { state.kpis = clone(KV_EX_KPIS); Object.assign(state.cfg, KV_EX_CFG); setExample(true); }
  renderAll();

  const touch = () => { try { localStorage.removeItem(PREFIX + 'blank'); } catch (e) {} };
  $('modelInput').addEventListener('input', () => {
    if (!state.loadingPbip) { state.cfg.modelFrom = 'export'; if (state.cfg.source !== 'export') state.cfg.source = 'export'; }
    if ($('modelInput').value.trim()) leaveExample();
    touch(); renderKpis(); renderModel(); renderLive(); persist();
  });
  document.querySelector('.kv-src').addEventListener('click', e => {
    const b = e.target.closest('[data-src]'); if (!b) return;
    state.cfg.source = b.dataset.src; renderKpis(); renderModel(); renderLive(); persist();
    if (b.dataset.src === 'export' && !$('modelInput').value.trim()) $('queryBox').open = true;
  });
  // PBIP folder: read the semantic model and use it like an export
  const loadPbip = async (root, list) => {
    state.pbipMsg = '<div class="msg info">Reading &ldquo;' + esc(root) + '&rdquo;&hellip;</div>'; renderModel();
    const files = [];
    for (const { path, file } of list) { if (kvWanted(path) && file.size < 30 * 1024 * 1024) files.push({ path, text: await kvDecode(file) }); }
    const r = kvReadPbip(files);
    if (r.error) { state.pbipMsg = '<div class="msg err">' + esc(r.error) + '</div>'; renderModel(); return; }
    state.pbipMsg = r.others.length ? '<div class="msg info">This folder has more than one semantic model; using ' + esc(r.name) + '. Choose a project folder to use another.</div>' : '';
    state.cfg.source = 'pbip'; state.cfg.modelFrom = 'pbip'; state.cfg.pbipName = r.name;
    state.loadingPbip = true; $('modelInput').value = r.text; $('modelInput').dispatchEvent(new Event('input', { bubbles: true })); state.loadingPbip = false;
  };
  const fail = e => { state.pbipMsg = '<div class="msg err">The folder couldn&rsquo;t be read: ' + esc(e.message || e) + '</div>'; renderModel(); };
  $('pickPbip').addEventListener('click', async () => {
    if (window.showDirectoryPicker) {
      let dir; try { dir = await window.showDirectoryPicker({ id: 'sf-kpi-visualizer', mode: 'read' }); } catch (e) { if (e && e.name === 'AbortError') return; $('pbipInput').click(); return; }
      const list = []; try { await kvWalkHandle(dir, dir.name, list); await loadPbip(dir.name, list); } catch (e) { fail(e); }
    } else $('pbipInput').click();
  });
  $('pbipInput').addEventListener('change', async e => {
    const fl = [...e.target.files]; if (!fl.length) return;
    const root = (fl[0].webkitRelativePath || fl[0].name).split('/')[0];
    const list = fl.filter(f => /\.(tmdl|bim)$/i.test(f.name)).map(f => ({ path: f.webkitRelativePath || (root + '/' + f.name), file: f }));
    try { await loadPbip(root, list); } catch (err) { fail(err); }
    e.target.value = '';
  });
  const drop = $('pbipDrop');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('over')));
  drop.addEventListener('drop', async e => {
    e.preventDefault();
    const item = [...(e.dataTransfer.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).find(Boolean);
    if (!item || !item.isDirectory) { state.pbipMsg = '<div class="msg warn">Drop the project <b>folder</b>, not a file inside it.</div>'; renderModel(); return; }
    const list = []; await kvWalkEntry(item, '', list);
    try { await loadPbip(item.name, list.map(x => ({ path: x.path.replace(/^\//, ''), file: x.file }))); } catch (err) { fail(err); }
  });
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
      const el = $('k0_' + f); if (el) { if (f.startsWith('pv.')) el.closest('details').open = true; el.focus(); if (el.setSelectionRange && el.type === 'text') el.setSelectionRange(el.value.length, el.value.length); }
      return;
    }
    setF(state.kpis[i], f, e.target.value); touch();
    state.cfg.sel = i;
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
  $('band').addEventListener('input', () => { const v = parseFloat($('band').value); state.cfg.band = isFinite(v) ? Math.max(0, Math.min(50, v)) : 0; renderLive(); persist(); });
  $('kpiPick').addEventListener('change', () => { state.cfg.sel = +$('kpiPick').value; renderLive(); persist(); });
  $('options').addEventListener('click', e => {
    const b = e.target.closest('[data-opt]'); if (!b) return;
    if (state.cfg.mode === 'row') state.cfg.rowOption = b.dataset.opt; else state.cfg.option = b.dataset.opt;
    renderLive(); persist();
    const s4 = $('s4'); if (s4 && s4.scrollIntoView) s4.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  [['homeTable', 'table'], ['folder', 'folder'], ['trendCol', 'trendCol'], ['scoreTable', 'scoreTable']].forEach(([id, key]) => $(id).addEventListener('input', () => { state.cfg[key] = $(id).value; renderBuild(); persist(); }));
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
