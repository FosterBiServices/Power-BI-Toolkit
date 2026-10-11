/* ---------- Chart Patterns page ---------- */
const $ = id => document.getElementById(id);
const PREFIX = 'kcp.';
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
    if (/^\s*\/\//.test(l)) return '<span class="tok-com">' + l + '</span>';
    return l.replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)/g, '<span class="tok-str">$1</span>')
      .replace(/\b(createOrReplace|ref|table|column|measure|partition|calculated|EVALUATE|SUMMARIZECOLUMNS|ORDER BY|ROW|VAR|RETURN|IF|FORMAT|DIVIDE|CALCULATE|ALLSELECTED|REMOVEFILTERS|SELECTEDVALUE|MAXX|MIN|MAX|RANKX|RANK|ORDERBY|HASONEVALUE|DESC|ASC|ALL|FILTER|COUNTROWS|VALUES|GENERATESERIES|ISBLANK|BLANK|displayFolder|formatString|sourceColumn|dataType|summarizeBy|mode|source)\b/g, '<span class="tok-kw">$1</span>');
  }).join('\n');
}
const clone = o => JSON.parse(JSON.stringify(o));
const EX_KEYS = ['measure', 'category', 'item', 'date', 'axis'];
const blankCfg = () => { const c = Object.assign({ pattern: 'labels' }, clone(CP_DEF)); EX_KEYS.concat(['fmt']).forEach(k => { c[k] = ''; }); return c; };
const exCfg = () => Object.assign({ pattern: 'labels' }, clone(CP_DEF), { fmt: '\\$#,0' });
const state = { example: false, model: null, cfg: blankCfg(), out: {}, page: 1, theme: null };

function persist(){
  store.set('model', state.example ? '' : $('modelInput').value);
  const c = clone(state.cfg); if (state.example) EX_KEYS.concat(['fmt']).forEach(k => { c[k] = ''; });
  store.set('cfg', JSON.stringify(c));
}
function setExample(on){ state.example = on; $('exampleBanner').hidden = !on; }
// Leaving the example: every example field goes, except what was typed into `keep`
function leaveExample(keep, val){
  if (!state.example) return;
  EX_KEYS.concat(['fmt']).forEach(k => { state.cfg[k] = ''; });
  if (keep) state.cfg[keep] = val;
  setExample(false);
}
const touch = () => { try { localStorage.removeItem(PREFIX + 'blank'); } catch (e) {} };

/* ---------- Step 1 ---------- */
function renderModel(){
  const text = $('modelInput').value, m = text.trim() ? parseModel(text) : null;
  state.model = m && !m.error ? m : null;
  $('modelMsg').innerHTML = m && m.error ? '<div class="msg err">' + esc(m.error) + '</div>' : '';
  $('modelStats').innerHTML = state.model ? '<span class="stat"><b>' + state.model.measures.length + '</b> measures</span><span class="stat"><b>' + state.model.columns.length + '</b> columns</span><span class="stat"><b>' + state.model.tables.length + '</b> tables</span>' : '';
  const md = state.model || { measures: [], columns: [], tables: [] }, col = c => '<option value="' + esc(qName(c.table) + bracket(c.name)) + '">';
  $('measureNames').innerHTML = md.measures.map(x => '<option value="' + esc(x.name) + '">').join('');
  $('columnNames').innerHTML = md.columns.filter(c => !c.hidden || c.key).map(col).join('');
  $('dateNames').innerHTML = md.columns.filter(c => /date|time/i.test(c.dataType || '')).map(col).join('');
  $('tableNames').innerHTML = md.tables.map(t => '<option value="' + esc(t.name) + '">').join('');
}

/* ---------- Step 2: patterns ---------- */
function previewSvg(id, f){
  if (id === 'labels') return cpSvgLabels(CP_EX_CATS, f);
  if (id === 'stacked') return cpSvgStacked(CP_EX_CATS, f);
  if (id === 'bubbles') return cpSvgBubbles(CP_EX_CATS, f);
  if (id === 'paging') return cpSvgPaging(CP_EX_ITEMS, f, state.page);
  return cpSvgWindow(CP_EX_MONTHS, f);
}
function renderPatterns(){
  const c = state.cfg;
  $('patterns').innerHTML = CP_GROUPS.map(g => '<div class="cp-grouphead"><h3>' + esc(g.name) + '</h3><p class="small muted">' + esc(g.note) + '</p></div>'
    + CP_PATTERNS.filter(p => p.group === g.id).map(p => '<div class="cp-opt' + (p.id === c.pattern ? ' on' : '') + '" data-p="' + p.id + '">'
      + '<div class="cp-opt-head"><h3>' + esc(p.name) + '</h3><span class="small muted">' + esc(p.kind) + '</span></div>'
      + '<div class="cp-canvas sm">' + previewSvg(p.id, c) + '</div>'
      + '<p class="small">' + esc(p.what) + '</p>'
      + '<p class="small"><b>Fits:</b> ' + esc(p.when) + '</p><p class="small muted"><b>Avoid:</b> ' + esc(p.avoid) + '</p>'
      + '<button type="button" class="btn' + (p.id === c.pattern ? ' primary' : '') + '" data-pick="' + p.id + '" aria-pressed="' + (p.id === c.pattern) + '">' + (p.id === c.pattern ? '&#10003; Building this' : 'Build this') + '</button></div>').join('')).join('');
}

/* ---------- Step 3: fields ---------- */
const FIELD_DEFS = {
  measure: ['Measure to chart', 'Sales', 'measureNames'],
  category: ['Category column', "'Product'[Category]", 'columnNames'],
  item: ['Items to rank <span class="muted">(one name per item)</span>', "'Customer'[Customer Name]", 'columnNames'],
  date: ['Date column for the slicer', "'Date'[Date]", 'dateNames'],
  axis: ['Date column on the chart&rsquo;s axis', "'Date'[Month]", 'columnNames'],
  fmt: ['Number format for the subtitle', '\\$#,0', ''],
  pct: ['Percent format', '0.0%', ''],
  table: ['Table for the new measures', '_Measures', 'tableNames'],
  folder: ['Display folder', 'Chart Patterns', '']
};
function fieldKeys(p){
  const k = p.needs.slice();
  if (['labels', 'stacked', 'bubbles', 'paging'].includes(p.id)) k.push('fmt');
  if (p.group === 'share') k.push('pct');
  return k.concat(['table', 'folder']);
}
function renderFields(){
  const p = cpPattern(state.cfg.pattern), c = state.cfg;
  $('fieldsLede').textContent = p.id === 'paging' ? 'The measure to rank by and the column with the items (customers, products).' : p.id === 'window' ? 'The measure on your line chart, and its date columns.' : 'The measure to chart and the column to chart it by.';
  $('fields').innerHTML = fieldKeys(p).map(k => { const d = FIELD_DEFS[k];
    return '<div class="field"><label for="f_' + k + '">' + d[0] + '</label><input type="text" id="f_' + k + '" data-k="' + k + '" value="' + esc(c[k] || '') + '" placeholder="' + esc(d[1]) + '" autocomplete="off" spellcheck="false"' + (d[2] ? ' list="' + d[2] + '"' : '') + '></div>'; }).join('');
}

/* ---------- Step 4: look ---------- */
const COLOR_DEFS = {
  labels: [['bar', 'Bars'], ['label', 'Labels']],
  stacked: [['bar', 'Bars'], ['label', '% labels']],
  bubbles: [['bar', 'Columns (bubbles and stems are lighter shades)'], ['label', 'Labels']],
  paging: [['bar', 'Bars'], ['accent', 'Value badge'], ['label', 'Rank badge text']],
  window: [['bar', 'Line'], ['accent', 'Window shade, markers and labels']]
};
function renderLook(){
  const c = state.cfg, p = cpPattern(c.pattern);
  $('orientWrap').hidden = !p.orient;
  $('orientBar').checked = c.orient !== 'column'; $('orientCol').checked = c.orient === 'column';
  $('colors').innerHTML = COLOR_DEFS[p.id].map(([k, n]) => '<div class="cp-crow"><input type="color" id="c_' + k + '" data-c="' + k + '" value="' + esc((cpHex(c[k]) || CP_DEF[k]).toLowerCase()) + '" aria-label="' + esc(n) + '"><input type="text" class="hex" data-h="' + k + '" value="' + esc(cpHex(c[k]) || CP_DEF[k]) + '" aria-label="' + esc(n) + ' hex code" spellcheck="false"><span>' + esc(n) + '</span></div>').join('');
  const sel = (k, label, opts) => '<div class="field"><label for="x_' + k + '">' + label + '</label><select id="x_' + k + '" data-x="' + k + '">' + opts.map(o => '<option value="' + o[0] + '"' + (String(c[k]) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select></div>';
  const num = (k, label, min, max) => '<div class="field"><label for="x_' + k + '">' + label + '</label><input type="number" id="x_' + k + '" data-x="' + k + '" value="' + esc(c[k]) + '" min="' + min + '" max="' + max + '"></div>';
  $('extra').innerHTML = p.id === 'stacked' ? sel('headroom', 'Room for the % column', [[10, '10% of the longest bar'], [15, '15%'], [20, '20% (fits most labels)'], [25, '25%'], [30, '30%']])
    : p.id === 'bubbles' ? sel('bubble', 'Bubble size (set in the theme, Step 5)', [[20, '20'], [25, '25'], [30, '30 (fits most labels)'], [35, '35'], [40, '40']])
    : p.id === 'paging' ? num('perPage', 'Items per page to start with', 1, 50) + num('maxItems', 'Most items per page readers can pick', 1, 100) + num('maxPages', 'Most pages', 2, 500)
    : '';
  $('preview').innerHTML = previewSvg(p.id, c);
}

/* ---------- Step 5: build it ---------- */
function renderOut(){
  const c = state.cfg, p = cpPattern(c.pattern);
  $('buildName').textContent = p.name;
  const checks = cpCheck(p, c, state.model), bad = checks.some(x => x.level === 'err');
  $('checks').innerHTML = checks.map(x => '<div class="msg ' + x.level + '">' + esc(x.text) + '</div>').join('') || (state.model ? '<div class="msg ok">&#10003; Every name was found in your model.</div>' : '<div class="msg info">Names aren&rsquo;t checked without a model. Connect it in Step 1 to check them.</div>');
  $('outBox').hidden = bad;
  if (bad) { state.out = {}; return; }
  const out = cpOut(p, c);
  state.out = { tmdl: cpTmdl(out, c), test: cpTest(p, c, out), snippet: cpThemeSnippet(+c.bubble || 30) };
  $('tmdlView').innerHTML = hl(state.out.tmdl);
  $('testView').innerHTML = hl(state.out.test);
  $('tmdlNote').textContent = out.tables.length ? 'It adds ' + out.measures.length + ' measures to ' + ((c.table || '_Measures').trim()) + ' and the ' + out.tables.map(t => t.name).join(' and ') + ' table' + (out.tables.length > 1 ? 's' : '') + '.' : 'It adds ' + out.measures.length + ' measures to ' + ((c.table || '_Measures').trim()) + '.';
  const theme = !!p.theme;
  $('themeStep').hidden = !theme;
  $('stepsHead').textContent = (theme ? '4' : '3') + '. Build the chart in Power BI';
  $('checkHead').textContent = (theme ? '5' : '4') + '. Check it';
  $('bubbleNow').textContent = +c.bubble || 30;
  document.querySelectorAll('.bubbleN').forEach(x => { x.textContent = +c.bubble || 30; });
  $('snippetView').textContent = state.out.snippet;
  $('themeDl').disabled = !state.theme;
  $('steps').innerHTML = cpSteps(p, c, out, esc).map(g => '<div class="cp-grp"><h4>' + esc(g[0]) + '</h4><ol class="kv-steps cp-steps">' + g[1].map(s => '<li>' + s + '</li>').join('') + '</ol></div>').join('');
  $('checkList').innerHTML = cpChecks(p, c, out).map(x => '<li>' + esc(x) + '</li>').join('');
}
function renderAll(){ renderModel(); renderPatterns(); renderFields(); renderLook(); renderOut(); }
function refreshLive(){ renderPatterns(); $('preview').innerHTML = previewSvg(state.cfg.pattern, state.cfg); renderOut(); }

/* ---------- Theme Builder colors ---------- */
function tbBrand(){
  try { if (localStorage.getItem('ktb.blank') === '1') return null; const t = JSON.parse(localStorage.getItem('ktb.cfg') || 'null'); return t && Array.isArray(t.seeds) && cpHex(t.seeds[0]) ? t : null; } catch (e) { return null; }
}

/* ---------- init ---------- */
function resetAll(){
  $('modelInput').value = ''; state.cfg = blankCfg(); state.theme = null; state.page = 1; setExample(false);
  $('queryBox').open = false; $('themeMsg').textContent = ''; $('themeFileMsg').innerHTML = '';
  renderAll();
}
function init(){
  $('exportView').textContent = DAX_QUERY;
  const saved = store.get('model'); let cfg = null; try { cfg = JSON.parse(store.get('cfg') || 'null'); } catch (e) {}
  if (saved && saved.trim()) $('modelInput').value = saved;
  if (cfg) state.cfg = Object.assign(blankCfg(), cfg);
  const empty = !EX_KEYS.some(k => (state.cfg[k] || '').trim());
  if (empty && !(saved && saved.trim()) && store.get('blank') !== '1') { state.cfg = Object.assign(exCfg(), { pattern: state.cfg.pattern }); setExample(true); }
  renderAll();

  $('modelInput').addEventListener('input', () => { if ($('modelInput').value.trim()) leaveExample(); touch(); renderModel(); renderFields(); renderOut(); persist(); });
  $('patterns').addEventListener('click', e => {
    const b = e.target.closest('[data-pick]'), g = e.target.closest('[data-page]');
    if (g) { state.page = +g.dataset.page; renderPatterns(); $('preview').innerHTML = previewSvg(state.cfg.pattern, state.cfg); return; }
    if (!b) return;
    state.cfg.pattern = b.dataset.pick; touch(); renderAll(); persist();
    $('s3').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('preview').addEventListener('click', e => { const g = e.target.closest('[data-page]'); if (g) { state.page = +g.dataset.page; refreshLive(); } });
  $('fields').addEventListener('input', e => {
    const k = e.target.dataset.k; if (!k) return;
    let v = e.target.value;
    if (state.example) { const was = exCfg()[k] || ''; v = EX_KEYS.concat(['fmt']).includes(k) ? SF_SUITE.ownText(v, was) : v; leaveExample(k, v); if (e.target.value !== v) e.target.value = v; renderFields(); const el = $('f_' + k); if (el) { el.focus(); el.setSelectionRange(v.length, v.length); } }
    state.cfg[k] = v; touch();
    // a measure from the model brings its format and, when the table for new measures isn't in the model, its table
    if (k === 'measure' && state.model) {
      const m = state.model.measures.find(x => lc(x.name) === lc(cpMeasure(v)));
      if (m) {
        if (m.formatString && !(state.cfg.fmt || '').trim()) { state.cfg.fmt = m.formatString; const f = $('f_fmt'); if (f) f.value = m.formatString; }
        if (!state.model.tables.some(t => lc(t.name) === lc((state.cfg.table || '').trim()))) { state.cfg.table = m.table; const f = $('f_table'); if (f) f.value = m.table; }
      }
    }
    refreshLive(); persist();
  });
  document.querySelectorAll('input[name=orient]').forEach(r => r.addEventListener('change', () => { state.cfg.orient = r.value; touch(); refreshLive(); persist(); }));
  $('colors').addEventListener('input', e => {
    const k = e.target.dataset.c || e.target.dataset.h; if (!k) return;
    const h = cpHex(e.target.value); e.target.classList.toggle('bad', !h); if (!h) return;
    state.cfg[k] = h; touch();
    const other = e.target.dataset.c ? document.querySelector('[data-h="' + k + '"]') : $('c_' + k); if (other) other.value = e.target.dataset.c ? h : h.toLowerCase();
    refreshLive(); persist();
  });
  $('extra').addEventListener('change', e => { const k = e.target.dataset.x; if (!k) return; state.cfg[k] = +e.target.value || CP_DEF[k]; touch(); refreshLive(); persist(); });
  $('fromTheme').addEventListener('click', () => {
    const t = tbBrand();
    if (!t) { $('themeMsg').textContent = 'No saved Theme Builder colors in this browser yet.'; return; }
    state.cfg.bar = cpHex(t.seeds[0]); if (cpHex(t.seeds[1])) state.cfg.accent = cpHex(t.seeds[1]);
    $('themeMsg').textContent = 'Using ' + [t.seeds[0], t.seeds[1]].filter(cpHex).map(cpHex).join(' and ') + ' from Theme Builder.';
    touch(); renderLook(); refreshLive(); persist();
  });
  $('themeFile').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try { cpThemeMerge(String(r.result), 30); state.theme = { text: String(r.result), name: file.name }; $('themeFileMsg').innerHTML = '<div class="msg ok">&#10003; ' + esc(file.name) + ' is ready. Select Download updated theme.</div>'; }
      catch (err) { state.theme = null; $('themeFileMsg').innerHTML = '<div class="msg err">That file isn&rsquo;t a Power BI theme (.json). Save it from View &gt; Themes &gt; Save current theme.</div>'; }
      $('themeDl').disabled = !state.theme; e.target.value = '';
    };
    r.readAsText(file);
  });
  $('themeDl').addEventListener('click', () => {
    if (!state.theme) return;
    const text = cpThemeMerge(state.theme.text, +state.cfg.bubble || 30), name = state.theme.name.replace(/\.json$/i, '') + ' (bubbles).json';
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    $('themeFileMsg').innerHTML = '<div class="msg ok">&#10003; Downloaded ' + esc(name) + '. Import it with View &gt; Themes &gt; Browse for themes.</div>';
  });
  $('clearAll').addEventListener('click', () => { resetAll(); try { localStorage.setItem(PREFIX + 'blank', '1'); } catch (e) {} persist(); });
  document.addEventListener('click', e => { const b = e.target.closest('[data-copy]'); if (!b) return; const v = b.dataset.copy === 'export' ? DAX_QUERY : state.out[b.dataset.copy]; if (v) copyText(v, b); });
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
