
/* ---------- About This Report page ---------- */
const $ = id => document.getElementById(id);
const PREFIX = 'kab.';
const store = {
  get(k){ try { return localStorage.getItem(PREFIX + k); } catch (e) { return null; } },
  set(k, v){ try { localStorage.setItem(PREFIX + k, v); } catch (e) {} }
};
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function copyText(text, btn){
  const done = () => { const o = btn.dataset.label || btn.textContent; btn.dataset.label = o; btn.textContent = 'Copied'; btn.classList.add('done'); setTimeout(() => { btn.textContent = o; btn.classList.remove('done'); }, 1600); };
  const fallback = () => { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta); if (ok) done(); };
  try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
}

const blankSec = () => { const o = {}; AB.SECTIONS.forEach(s => { o[s.id] = { on: s.rec, text: null, title: '' }; }); return o; };
const blankCfg = () => ({
  basics: { name: '', audience: [], extraAud: [], owner: '', contact: '', freq: '', time: '' },
  sec: blankSec(),
  kpi: { n: 5, compound: false, hidden: false, picks: null, edits: {}, off: {} },
  src: { edits: {}, off: {}, added: [] }, showCovers: false,
  html: { name: 'About This Report HTML', table: '', folder: '', font: 16, accent: '#1F3A5F', title: true, refresh: '' },
  ai: ''
});
const EX_BASICS = () => ({ name: 'Sales Overview', audience: ['Sales managers', 'Finance team'], extraAud: [], owner: 'the Sales Analytics team', contact: 'sales-analytics@contoso.com', freq: 'daily', time: '6:00 AM' });
const state = { example: false, model: null, report: null, tmdlRows: [], detected: null, cands: [], kpiList: [], sourceList: [], cfg: blankCfg(), aiParsed: null };

/* ---------- derived lists ---------- */
function derive(){
  const c = state.cfg, m = state.model;
  state.cands = m ? AB.kpis(m, state.report, { compound: c.kpi.compound, hidden: c.kpi.hidden }) : [];
  const ok = state.cands.filter(k => !k.excluded);
  const picks = c.kpi.picks ? c.kpi.picks.filter(n => state.cands.some(k => k.name === n)) : ok.slice(0, Math.max(1, Math.min(8, +c.kpi.n || 5))).map(k => k.name);
  state.kpiList = picks.map(n => {
    const k = state.cands.find(x => x.name === n), e = c.kpi.edits[n] || {};
    return Object.assign({}, k, { label: e.label != null ? e.label : k.name, meaning: e.meaning != null ? e.meaning : k.meaning, on: !c.kpi.off[n] });
  });
  // sources: the sources query, else the TMDL in a PBIP folder, plus remote models from the export
  const q = $('srcInput').value.trim() ? AB.parseSourcesQuery($('srcInput').value) : null;
  const rows = q && !q.error ? q.rows : state.tmdlRows;
  state.srcQuery = q;
  state.detected = m || rows.length ? AB.detect(rows, m) : null;
  const det = state.detected ? state.detected.sources : [];
  state.sourceList = det.map(s => { const e = c.src.edits[s.key] || {}; return Object.assign({}, s, { label: e.label != null ? e.label : s.label, covers: e.covers != null ? e.covers : s.tables.join(', '), on: !c.src.off[s.key] && !s.manual || (s.manual && c.src.off[s.key] === false) }); })
    .concat(c.src.added.map((a, i) => ({ key: 'added:' + i, label: a.label, covers: a.covers || '', tables: [], on: a.on !== false, added: true })));
}
function abState(){ return { model: state.model, report: state.report, basics: Object.assign({}, state.cfg.basics, { audience: state.cfg.basics.audience }), kpiList: state.kpiList, sourceList: state.sourceList, sec: state.cfg.sec, showCovers: state.cfg.showCovers }; }

/* ---------- Step 1 ---------- */
function renderModel(){
  const text = $('modelInput').value;
  const m = text.trim() ? AB.parse(text) : null;
  state.model = m && !m.error ? m : null;
  $('modelMsg').innerHTML = m && m.error ? '<div class="msg err">' + esc(m.error) + '</div>' : '';
  const x = state.model;
  $('modelStats').innerHTML = x ? '<span class="stat"><b>' + x.tables.length + '</b> tables</span><span class="stat"><b>' + x.measures.length + '</b> measures</span><span class="stat"><b>' + x.columns.filter(c => !c.hidden).length + '</b> visible columns</span>' : '';
}
function renderSrcMsg(){
  const q = state.srcQuery, d = state.detected;
  let h = '';
  if (q && q.error) h = '<div class="msg err">' + esc(q.error) + '</div>';
  else if (q && d) h = '<div class="msg ok">&#10003; ' + d.sources.length + ' source' + (d.sources.length === 1 ? '' : 's') + ' found for ' + d.tables + ' table' + (d.tables === 1 ? '' : 's') + (d.calc.length ? '; ' + d.calc.length + ' built in the model' : '') + '. Review them in Step 3.</div>';
  else if (!q && state.tmdlRows.length && d) h = '<div class="msg info">Sources are read from the semantic model in the PBIP folder. Paste the query results here to use those instead.</div>';
  $('srcMsg').innerHTML = h;
}

/* ---------- report pages from a PBIP folder ---------- */
const SKIP_DIRS = new Set(['.git', 'node_modules', '.pbi', '.vs', 'StaticResources', 'RegisteredResources', 'cultures']);
const wanted = n => /\.(json|tmdl)$/i.test(n);
async function decode(file){
  const buf = await file.arrayBuffer();
  let t; try { t = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { t = new TextDecoder('windows-1252').decode(buf); }
  return t.replace(/^﻿/, '');
}
async function walkHandle(dir, prefix, out){
  for await (const [name, h] of dir.entries()) {
    if (h.kind === 'directory') { if (!SKIP_DIRS.has(name)) await walkHandle(h, prefix + '/' + name, out); }
    else if (wanted(name)) out.push({ path: prefix + '/' + name, file: await h.getFile() });
  }
}
function walkEntry(entry, prefix, out){
  return new Promise(resolve => {
    if (entry.isFile) { if (wanted(entry.name)) entry.file(f => { out.push({ path: prefix + '/' + entry.name, file: f }); resolve(); }, () => resolve()); else resolve(); return; }
    if (SKIP_DIRS.has(entry.name)) { resolve(); return; }
    const reader = entry.createReader(); const all = [];
    const next = () => reader.readEntries(batch => { if (!batch.length) { Promise.all(all.map(e => walkEntry(e, prefix + '/' + entry.name, out))).then(resolve); return; } all.push(...batch); next(); }, () => resolve());
    next();
  });
}
async function loadFolder(root, list){
  $('repMsg').innerHTML = '<div class="msg info">Reading &ldquo;' + esc(root) + '&rdquo;&hellip;</div>';
  const norm = p => (/\.(Report|SemanticModel)$/i.test(root) && !/\.(Report|SemanticModel)\//i.test(p)) ? root + '/' + p.split('/').slice(1).join('/') : p;
  const files = new Map();
  for (const { path, file } of list) {
    const p = norm(path); if (!/\.(Report|SemanticModel)\//i.test(p) || file.size > 30 * 1024 * 1024) continue;
    try { files.set(p, await decode(file)); } catch (e) {}
  }
  const r = AB.readReport(files), tm = AB.parseTmdl(files);
  if (!r.reports.length && !tm.length) { $('repMsg').innerHTML = '<div class="msg warn">No report or semantic model files were found in &ldquo;' + esc(root) + '&rdquo;. Choose the project folder of a report saved with <b>File &gt; Save as &gt; Power BI project files</b>.</div>'; return; }
  const rep = r.reports.length ? { reports: r.reports, pages: r.pages, drill: r.drill, visuals: r.visuals, counts: [...r.counts], slicers: r.slicers } : null;
  store.set('report', JSON.stringify({ root, rep, tmdl: tm }));
  setFolder(root, rep, tm);
  dropExample(); if (rep && !state.cfg.basics.name && rep.reports[0]) state.cfg.basics.name = rep.reports[0];
  renderAll(); persist();
}
function setFolder(root, rep, tm){
  state.folder = root || null;
  state.report = rep ? Object.assign({}, rep, { counts: new Map(rep.counts) }) : null;
  state.tmdlRows = tm || [];
}
function renderFolder(){
  $('clearReport').hidden = !state.folder; $('pickReport').textContent = state.folder ? 'Choose a different folder' : 'Choose a PBIP folder';
  if (!state.folder) { if (!/Reading|No report/.test($('repMsg').textContent)) $('repMsg').innerHTML = ''; return; }
  const r = state.report, bits = [];
  if (r) bits.push('<b>' + esc(r.reports.join(', ')) + '</b>: ' + r.pages.length + ' page' + (r.pages.length === 1 ? '' : 's') + ' for readers, ' + r.visuals + ' visual' + (r.visuals === 1 ? '' : 's') + (r.slicers.length ? ', slicers on ' + esc(r.slicers.slice(0, 4).join(', ')) : ''));
  if (state.tmdlRows.length) bits.push('semantic model read for data sources');
  $('repMsg').innerHTML = '<div class="msg ok">&#10003; ' + bits.join('; ') + '.</div>';
}

/* ---------- Step 2 ---------- */
function renderBasics(){
  const b = state.cfg.basics;
  $('bName').value = b.name; $('bOwner').value = b.owner; $('bContact').value = b.contact; $('bFreq').value = b.freq; $('bTime').value = b.time;
  renderAud();
  const d = state.detected, allDq = state.model && state.model.tables.length && state.model.tables.every(t => /directquery/i.test(t.storage || '') || t.remote);
  const hint = [];
  if (d && d.refreshed) hint.push('The model was last refreshed ' + esc(d.refreshed.replace(/:\d\d(\.\d+)?$/, '')) + ' (from the data sources query). The scheduled refresh is set in the Power BI service, under the semantic model&rsquo;s settings.');
  if (allDq && b.freq !== 'live') hint.push('Every table uses DirectQuery, so <b>Live</b> may fit best.');
  $('refreshHint').hidden = !hint.length; $('refreshHint').innerHTML = hint.join(' ');
}
function renderAud(){
  const b = state.cfg.basics;
  const sug = AB.audienceSuggestions(state.model);
  const all = [...new Set(sug.concat(b.extraAud, b.audience))];
  $('audChips').innerHTML = all.map(a => '<button type="button" class="chip" data-aud="' + esc(a) + '" aria-pressed="' + b.audience.includes(a) + '">' + esc(a) + '</button>').join('');
}

/* ---------- Step 3: sections ---------- */
function ctx(){ return AB.context(abState()); }
function draftOf(id, c){ return AB.DRAFTS[id](c || ctx()); }
function secBar(){
  const c = state.cfg.sec, on = AB.SECTIONS.filter(s => c[s.id].on).length, rec = AB.SECTIONS.filter(s => s.rec);
  const missing = rec.filter(s => !c[s.id].on);
  $('secBar').innerHTML = '<div class="sum-txt"><b>' + on + '</b> of ' + AB.SECTIONS.length + ' parts included' + (missing.length ? ' &middot; recommended but off: ' + missing.map(s => esc(s.label)).join(', ') : ' &middot; all recommended parts are in') + '</div>'
    + '<div class="btns"><button type="button" class="btn" id="recOnly">Recommended only</button><button type="button" class="btn" id="allOn">Include all</button></div>';
}
function renderSections(){
  secBar();
  const c = ctx();
  $('secs').innerHTML = AB.SECTIONS.map(s => {
    const sec = state.cfg.sec[s.id];
    const head = '<div class="sec-head"><label class="sec-main"><input type="checkbox" data-secon="' + s.id + '"' + (sec.on ? ' checked' : '') + '><span class="sec-t">' + esc(s.label) + '</span></label><span class="tag ' + (s.rec ? 'rec' : 'opt') + '">' + (s.rec ? 'Recommended' : 'Optional') + '</span>'
      + '<label class="sec-title">Heading <input type="text" class="txt" data-sectitle="' + s.id + '" value="' + esc(sec.title || '') + '" placeholder="' + esc(s.title) + '"></label></div>'
      + '<p class="sec-why">' + esc(s.why) + '</p>';
    return '<div class="sec' + (sec.on ? '' : ' is-off') + '" id="sec-' + s.id + '">' + head + '<div class="sec-body"' + (sec.on ? '' : ' hidden') + '>' + secBody(s, sec, c) + '</div></div>';
  }).join('');
}
function secBody(s, sec, c){
  if (s.kind === 'text' || s.kind === 'list') {
    const d = draftOf(s.id, c);
    const val = sec.text != null ? sec.text : s.kind === 'text' ? (d[0] || '') : AB.listItems(abState(), s.id, c).join('\n');
    return '<textarea class="draft' + (s.kind === 'list' ? ' list' : '') + '" data-draft="' + s.id + '" rows="' + (s.kind === 'list' ? Math.max(4, val.split('\n').length + 1) : 3) + '" aria-label="' + esc(s.label) + '">' + esc(val) + '</textarea>'
      + (s.kind === 'list' ? '<p class="note small">One per line.</p>' : '')
      + '<div class="alts" data-alts="' + s.id + '">' + altsHtml(s, sec, c) + '</div>';
  }
  if (s.kind === 'kpis') return kpiHtml();
  if (s.kind === 'sources') return srcHtml();
  return '';
}
function altsHtml(s, sec, c){
  const d = draftOf(s.id, c);
  const cur = sec.text != null ? sec.text : null;
  const reset = cur != null ? '<button type="button" class="btn small" data-reset="' + s.id + '">Back to the suggestion</button>' : '';
  if (s.kind === 'text') {
    const others = d.filter(t => t !== (cur != null ? cur : d[0]));
    return (others.length ? '<span class="alts-l">Other wordings</span>' + others.map(t => '<button type="button" class="alt" data-use="' + s.id + '" data-t="' + esc(t) + '">' + esc(t) + '</button>').join('') : '') + reset;
  }
  const have = new Set(AB.listItems(abState(), s.id, c).map(x => x.toLowerCase()));
  const more = d.filter(t => !have.has(t.toLowerCase()));
  return (more.length ? '<span class="alts-l">More suggestions</span>' + more.map(t => '<button type="button" class="alt add" data-add="' + s.id + '" data-t="' + esc(t) + '">+ ' + esc(t) + '</button>').join('') : '') + reset;
}
// drafts that haven't been edited follow Steps 1 and 2
function refreshDrafts(){
  const c = ctx();
  AB.SECTIONS.forEach(s => {
    const sec = state.cfg.sec[s.id];
    if (s.kind !== 'text' && s.kind !== 'list') return;
    const ta = document.querySelector('[data-draft="' + s.id + '"]'); if (!ta) return;
    if (sec.text == null && document.activeElement !== ta) ta.value = s.kind === 'text' ? (draftOf(s.id, c)[0] || '') : AB.listItems(abState(), s.id, c).join('\n');
    const al = document.querySelector('[data-alts="' + s.id + '"]'); if (al) al.innerHTML = altsHtml(s, sec, c);
  });
}

function kpiHtml(){
  const k = state.cfg.kpi;
  if (!state.model) return '<p class="muted">Paste a model export in Step 1 to see suggested measures.</p>';
  const rows = state.kpiList.map((x, i) => '<div class="krow' + (x.on ? '' : ' is-off') + '">'
    + '<input type="checkbox" data-kon="' + esc(x.name) + '"' + (x.on ? ' checked' : '') + ' aria-label="Include ' + esc(x.name) + '">'
    + '<div class="kfields"><input type="text" class="txt kname" data-klabel="' + esc(x.name) + '" value="' + esc(x.label) + '" aria-label="Name readers see">'
    + '<input type="text" class="txt kmean" data-kmean="' + esc(x.name) + '" value="' + esc(x.meaning) + '" placeholder="What it means, in plain words" aria-label="Meaning">'
    + '<span class="kwhy">' + (x.label !== x.name ? '<span class="mono">' + esc(x.name) + '</span> &middot; ' : '') + (x.why.length ? 'Picked because it&rsquo;s ' + esc(x.why.join(', ')) : 'Added by you') + (x.measure.description ? '' : ' &middot; <span class="hintw">no description in the model: add a meaning here, and consider adding it to the model too</span>') + '</span></div>'
    + '<span class="kbtns"><button type="button" class="btn small" data-kup="' + i + '" aria-label="Move up"' + (i ? '' : ' disabled') + '>&uarr;</button><button type="button" class="btn small" data-krem="' + esc(x.name) + '">Remove</button></span></div>').join('');
  const inList = new Set(state.kpiList.map(x => x.name));
  const rest = state.cands.filter(x => !inList.has(x.name) && !x.excluded), excl = state.cands.filter(x => !inList.has(x.name) && x.excluded);
  return '<div class="kset"><label>How many <input type="number" id="kN" min="1" max="8" value="' + (k.picks ? state.kpiList.length : k.n) + '"' + (k.picks ? ' disabled title="You picked the measures by hand; select Pick for me to use a number again."' : '') + '></label>'
    + '<label><input type="checkbox" id="kComp"' + (k.compound ? ' checked' : '') + '> Include combined measures <span class="muted">(ratios, variances, year-on-year)</span></label>'
    + '<label><input type="checkbox" id="kHid"' + (k.hidden ? ' checked' : '') + '> Include hidden measures</label>'
    + (k.picks ? '<button type="button" class="btn small" id="kAuto">Pick for me</button>' : '') + '</div>'
    + '<p class="note small">Ranked by how often other measures ' + (state.report ? 'and report visuals ' : '') + 'use them, with a boost for a description or a Core or KPI folder. Helpers (titles, colors, labels, formats) and measures that combine others are left out, as in the About This Report Generator rules.</p>'
    + (rows || '<p class="muted">No measures fit. Turn on combined or hidden measures, or add one below.</p>')
    + (rest.length || excl.length ? '<details class="extra more"><summary>Other measures <span class="muted">(' + (rest.length + excl.length) + ')</span></summary><div class="extra-body"><ul class="cand">'
      + rest.map(x => '<li><span><b>' + esc(x.name) + '</b> <span class="muted small">' + esc(x.why.join(', ') || 'not used elsewhere') + '</span></span><button type="button" class="btn small" data-kadd="' + esc(x.name) + '">Add</button></li>').join('')
      + excl.map(x => '<li class="ex"><span><b>' + esc(x.name) + '</b> <span class="muted small">' + esc(x.excluded) + '</span></span><button type="button" class="btn small" data-kadd="' + esc(x.name) + '">Add anyway</button></li>').join('')
      + '</ul></div></details>' : '');
}

function srcHtml(){
  const d = state.detected, list = state.sourceList;
  const rows = list.map(s => '<div class="srow' + (s.on ? '' : ' is-off') + '">'
    + '<input type="checkbox" data-son="' + esc(s.key) + '"' + (s.on ? ' checked' : '') + ' aria-label="Include ' + esc(s.label) + '">'
    + '<div class="kfields"><input type="text" class="txt kname" data-slabel="' + esc(s.key) + '" value="' + esc(s.label) + '" aria-label="Source name readers see">'
    + (state.cfg.showCovers ? '<input type="text" class="txt kmean" data-scover="' + esc(s.key) + '" value="' + esc(s.covers) + '" placeholder="What it provides, for example orders and customers" aria-label="What it provides">' : '')
    + '<span class="kwhy">' + (s.added ? 'Added by you' : (s.manual ? 'Typed or pasted into the report (Enter data). ' : '') + 'Feeds ' + esc(s.tables.join(', '))) + '</span></div>'
    + (s.added ? '<span class="kbtns"><button type="button" class="btn small" data-srem="' + esc(s.key) + '">Remove</button></span>' : '') + '</div>').join('');
  let note = '';
  if (!state.srcQuery && !state.tmdlRows.length) note = '<div class="msg info">To name the sources for you, run the <b>data sources query</b> in Step 1' + (state.model && state.model.hasRemote ? '. Remote semantic models are already listed from the model export.' : ', or add them by hand below.') + '</div>';
  if (d && d.unknown.length) note += '<div class="msg info">No source was recognized for ' + esc(d.unknown.join(', ')) + '. Add it by hand if it matters to readers.</div>';
  if (d && d.calc.length) note += '<p class="note small">Built in the model, so not listed: ' + esc(d.calc.join(', ')) + '.</p>';
  return '<p class="note small">Rename each source the way readers know it, for example <i>Sales data warehouse</i> rather than a server or file name.</p>' + note + rows
    + '<div class="addsrc"><input type="text" class="txt" id="srcAdd" placeholder="Add a source, for example Budget workbook from Finance"><button type="button" class="btn small" id="srcAddBtn">Add</button></div>'
    + '<label class="opts"><span><input type="checkbox" id="showCovers"' + (state.cfg.showCovers ? ' checked' : '') + '> Say what each source provides</span></label>';
}

/* ---------- Copilot ---------- */
function renderPrompt(){ $('promptView').textContent = AB.prompt(abState()); }
function renderAi(){
  const t = $('aiInput').value.trim();
  if (!t) { state.aiParsed = null; $('aiOut').innerHTML = ''; return; }
  const r = AB.parseReply(t, abState()); state.aiParsed = r;
  if (r.error) { $('aiOut').innerHTML = '<div class="msg err">' + esc(r.error) + '</div>'; return; }
  const x = r.reply, row = (id, label, val) => val ? '<div class="airow"><div><b>' + esc(label) + '</b><div class="aival">' + (Array.isArray(val) ? '<ul>' + val.map(v => '<li>' + esc(v) + '</li>').join('') + '</ul>' : esc(val)) + '</div></div><button type="button" class="btn small" data-aiuse="' + id + '">Use</button></div>' : '';
  const mm = Object.keys(x.meanings);
  $('aiOut').innerHTML = (r.warns.length ? '<div class="msg warn">' + r.warns.map(esc).join('<br>') + '</div>' : '')
    + (x.gaps.length ? '<div class="msg info"><b>Copilot couldn&rsquo;t tell:</b><ul>' + x.gaps.map(g => '<li>' + esc(g) + '</li>').join('') + '</ul>Answer these in Step 2 or in the drafts.</div>' : '')
    + row('summary', 'Report summary', x.summary) + row('value', 'Business value', x.value) + row('audience', 'Who it’s for', x.audience) + row('questions', 'Questions it answers', x.questions)
    + (mm.length ? row('meanings', 'Measure meanings', mm.map(n => n + ': ' + x.meanings[n])) : '')
    + '<div class="btns"><button type="button" class="btn primary" data-aiuse="all">Use all</button></div>';
}
function useAi(id){
  const x = state.aiParsed && state.aiParsed.reply; if (!x) return;
  const ids = id === 'all' ? ['summary', 'value', 'audience', 'questions', 'meanings'] : [id];
  ids.forEach(k => {
    if (k === 'meanings') Object.keys(x.meanings).forEach(n => { state.cfg.kpi.edits[n] = Object.assign({}, state.cfg.kpi.edits[n], { meaning: x.meanings[n] }); });
    else if (k === 'questions' && x.questions.length) state.cfg.sec.questions.text = x.questions.join('\n');
    else if (x[k]) state.cfg.sec[k].text = x[k];
  });
  leaveExample(); derive(); renderSections(); renderOut(); persist();
}

/* ---------- Step 4 ---------- */
function docNow(){ return AB.compose(abState()); }
function renderOut(){
  const d = docNow();
  $('outCount').textContent = d.sections.length ? d.sections.length + ' part' + (d.sections.length === 1 ? '' : 's') : '';
  $('preview').innerHTML = !d.sections.length ? '<p class="muted">Tick at least one part in Step 3.</p>'
    : (d.name ? '<h3 class="ab-name">' + esc(d.name) + '</h3>' : '') + d.sections.map(s => s.id === 'value' ? '<div class="ab-callout"><b>' + esc(s.title) + ':</b> ' + esc(s.text) + '</div>'
      : '<h4>' + esc(s.title) + '</h4>' + (s.kind === 'text' ? '<p>' + esc(s.text) + '</p>' : s.kind === 'list' ? '<ul>' + s.items.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>'
      : s.kind === 'sources' ? '<div class="ab-chips">' + s.items.map((i, k) => '<span class="c' + (k % 5) + '">' + esc(i.name) + (i.text ? ' <small>&middot; ' + esc(i.text) + '</small>' : '') + '</span>').join('') + '</div>'
      : '<ul>' + s.items.map(i => '<li><b>' + esc(i.name) + '</b>' + (i.text ? ': ' + esc(i.text) : '') + '</li>').join('') + '</ul>')).join('');
  renderHtml(d);
  renderPrompt();
}
function htmlOpts(){ const h = state.cfg.html; return { name: h.name, table: h.table || defaultTable(), folder: h.folder, font: h.font, accent: /^#[0-9a-f]{6}$/i.test(h.accent) ? h.accent : '#1F3A5F', title: h.title, refresh: h.refresh }; }
function defaultTable(){ const m = state.model; if (!m) return '_Measures'; const r = AB.roles(m); return (r.measure[0] && r.measure[0].name) || (m.tables.find(t => /measure/i.test(t.name)) || {}).name || '_Measures'; }
function renderHtml(d){
  if (!$('htmlBox').open) return;
  const h = state.cfg.html, o = htmlOpts();
  $('hName').value = h.name; $('hTable').value = h.table; $('hTable').placeholder = defaultTable(); $('hFolder').value = h.folder; $('hFont').value = h.font; $('hAccent').value = h.accent; $('hAccentPick').value = o.accent; $('hTitle').checked = h.title;
  $('tableList').innerHTML = state.model ? state.model.tables.map(t => '<option value="' + esc(t.name) + '">').join('') : '';
  const ms = state.model ? state.model.measures.filter(m => /refresh|updated|as of|load date/i.test(m.name)) : [];
  $('hRefresh').innerHTML = '<option value="">Don&rsquo;t show</option>' + ms.map(m => '<option' + (m.name === h.refresh ? ' selected' : '') + '>' + esc(m.name) + '</option>').join('')
    + (h.refresh && !ms.some(m => m.name === h.refresh) ? '<option selected>' + esc(h.refresh) + '</option>' : '');
  $('htmlPrev').innerHTML = AB.toHtml(d, o);
  $('tmdlView').textContent = d.sections.length ? AB.tmdl(d, o) : '';
}

/* ---------- persistence ---------- */
function persist(){
  if (state.example) { store.set('model', ''); store.set('sources', ''); store.set('cfg', ''); return; }
  store.set('model', $('modelInput').value); store.set('sources', $('srcInput').value);
  state.cfg.ai = $('aiInput').value;
  store.set('cfg', JSON.stringify(state.cfg));
}
function setExample(on){ state.example = on; $('exampleBanner').hidden = !on; }
function leaveExample(){ if (state.example) setExample(false); }
// facts about your own report replace the whole example (model, sources and answers), so none of it reaches the prompt
function dropExample(){ if (!state.example) return; $('modelInput').value = ''; $('srcInput').value = ''; $('aiInput').value = ''; state.cfg = blankCfg(); setExample(false); renderAll(); }

function renderAll(){ renderModel(); derive(); renderSrcMsg(); renderFolder(); renderBasics(); renderSections(); renderAi(); renderOut(); }

/* ---------- init ---------- */
function resetAll(){
  $('modelInput').value = ''; $('srcInput').value = ''; $('aiInput').value = '';
  setFolder(null, null, []); $('repMsg').innerHTML = '';
  state.cfg = blankCfg(); setExample(false);
  $('modelBox').open = false; $('srcBox').open = false; $('aiBox').open = false; $('htmlBox').open = false;
  renderAll();
}
function loadExample(){ $('modelInput').value = AB_EX_MODEL; $('srcInput').value = AB_EX_SOURCES; state.cfg = blankCfg(); state.cfg.basics = EX_BASICS(); state.cfg.sec.howto.on = true; setExample(true); }
function init(){
  $('exportView').textContent = DAX_QUERY;
  $('sourcesView').textContent = AB.SOURCES_QUERY;
  let cfg = null; try { cfg = JSON.parse(store.get('cfg') || 'null'); } catch (e) {}
  let fold = null; try { fold = JSON.parse(store.get('report') || 'null'); } catch (e) {}
  const saved = store.get('model');
  if ((saved && saved.trim()) || cfg || fold) {
    $('modelInput').value = saved || ''; $('srcInput').value = store.get('sources') || '';
    if (cfg) { const b = blankCfg(); state.cfg = Object.assign(b, cfg, { basics: Object.assign(b.basics, cfg.basics), sec: Object.assign(b.sec, cfg.sec), kpi: Object.assign(b.kpi, cfg.kpi), src: Object.assign(b.src, cfg.src), html: Object.assign(b.html, cfg.html) }); $('aiInput').value = state.cfg.ai || ''; }
    if (fold) setFolder(fold.root, fold.rep, fold.tmdl);
  } else if (store.get('blank') !== '1') loadExample();
  renderAll();

  const clearBlank = () => { try { localStorage.removeItem(PREFIX + 'blank'); } catch (e) {} };
  // pasting your own model clears the example (its answers and drafts too)
  $('modelInput').addEventListener('input', () => {
    if (state.example) { const v = $('modelInput').value; state.cfg = blankCfg(); $('srcInput').value = ''; setExample(false); $('modelInput').value = v; }
    clearBlank(); renderAll(); persist();
  });
  $('srcInput').addEventListener('input', () => {
    if (state.example) { const v = $('srcInput').value; $('modelInput').value = ''; state.cfg = blankCfg(); setExample(false); $('srcInput').value = v; }
    clearBlank(); renderModel(); derive(); renderSrcMsg(); renderBasics(); renderSections(); renderOut(); persist();
  });
  // Step 2
  const basic = (id, key) => $(id).addEventListener('input', () => { const v = state.example ? SF_SUITE.ownText($(id).value, state.cfg.basics[key] || '') : $(id).value; dropExample(); state.cfg.basics[key] = v; if ($(id).value !== v) $(id).value = v; refreshDrafts(); renderOut(); persist(); });
  basic('bName', 'name'); basic('bOwner', 'owner'); basic('bContact', 'contact'); basic('bTime', 'time');
  $('bFreq').addEventListener('change', () => { const v = $('bFreq').value; dropExample(); state.cfg.basics.freq = v; $('bFreq').value = v; renderBasics(); refreshDrafts(); renderOut(); persist(); });
  $('audChips').addEventListener('click', e => {
    const b = e.target.closest('[data-aud]'); if (!b) return;
    dropExample(); const a = b.dataset.aud, list = state.cfg.basics.audience, i = list.indexOf(a);
    if (i >= 0) list.splice(i, 1); else list.push(a);
    leaveExample(); renderAud(); refreshDrafts(); renderOut(); persist();
  });
  const addAud = () => { const v = $('audAdd').value.trim(); if (!v) return; dropExample(); const b = state.cfg.basics; if (!b.extraAud.includes(v)) b.extraAud.push(v); if (!b.audience.includes(v)) b.audience.push(v); $('audAdd').value = ''; leaveExample(); renderAud(); refreshDrafts(); renderOut(); persist(); };
  $('audAddBtn').addEventListener('click', addAud);
  $('audAdd').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addAud(); } });

  // Step 3: typing
  $('secs').addEventListener('input', e => {
    const t = e.target, c = state.cfg;
    if (t.dataset.draft) { c.sec[t.dataset.draft].text = t.value; const s = AB.SECTIONS.find(x => x.id === t.dataset.draft); document.querySelector('[data-alts="' + s.id + '"]').innerHTML = altsHtml(s, c.sec[s.id], ctx()); }
    else if (t.dataset.sectitle) c.sec[t.dataset.sectitle].title = t.value;
    else if (t.dataset.klabel != null) { c.kpi.edits[t.dataset.klabel] = Object.assign({}, c.kpi.edits[t.dataset.klabel], { label: t.value }); derive(); refreshDrafts(); }
    else if (t.dataset.kmean != null) { c.kpi.edits[t.dataset.kmean] = Object.assign({}, c.kpi.edits[t.dataset.kmean], { meaning: t.value }); derive(); }
    else if (t.dataset.slabel != null) { const k = t.dataset.slabel; if (k.startsWith('added:')) c.src.added[+k.slice(6)].label = t.value; else c.src.edits[k] = Object.assign({}, c.src.edits[k], { label: t.value }); derive(); refreshDrafts(); }
    else if (t.dataset.scover != null) { const k = t.dataset.scover; if (k.startsWith('added:')) c.src.added[+k.slice(6)].covers = t.value; else c.src.edits[k] = Object.assign({}, c.src.edits[k], { covers: t.value }); derive(); }
    else if (t.id === 'kN') { c.kpi.n = Math.max(1, Math.min(8, +t.value || 5)); derive(); leaveExample(); renderSections(); renderOut(); persist(); $('kN').focus(); return; }
    else return;
    leaveExample(); renderOut(); persist();
  });
  // Step 3: choices
  $('secs').addEventListener('change', e => {
    const t = e.target, c = state.cfg;
    if (t.dataset.secon) c.sec[t.dataset.secon].on = t.checked;
    else if (t.dataset.kon != null) { if (t.checked) delete c.kpi.off[t.dataset.kon]; else c.kpi.off[t.dataset.kon] = true; }
    else if (t.dataset.son != null) { const k = t.dataset.son; if (k.startsWith('added:')) c.src.added[+k.slice(6)].on = t.checked; else c.src.off[k] = !t.checked; }
    else if (t.id === 'kComp') c.kpi.compound = t.checked;
    else if (t.id === 'kHid') c.kpi.hidden = t.checked;
    else if (t.id === 'showCovers') c.showCovers = t.checked;
    else return;
    leaveExample(); derive(); renderSections(); renderOut(); persist();
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const c = state.cfg;
    const re = () => { leaveExample(); derive(); renderSections(); renderOut(); persist(); };
    if (b.dataset.copy === 'export') { copyText(DAX_QUERY, b); return; }
    if (b.dataset.copy === 'sources') { copyText(AB.SOURCES_QUERY, b); return; }
    if (b.dataset.use) { c.sec[b.dataset.use].text = b.dataset.t; return re(); }
    if (b.dataset.add) { const cur = AB.listItems(abState(), b.dataset.add); c.sec[b.dataset.add].text = cur.concat([b.dataset.t]).join('\n'); return re(); }
    if (b.dataset.reset) { c.sec[b.dataset.reset].text = null; return re(); }
    if (b.dataset.kadd) { c.kpi.picks = state.kpiList.map(x => x.name).concat([b.dataset.kadd]); delete c.kpi.off[b.dataset.kadd]; return re(); }
    if (b.dataset.krem) { c.kpi.picks = state.kpiList.map(x => x.name).filter(n => n !== b.dataset.krem); return re(); }
    if (b.dataset.kup) { const i = +b.dataset.kup, l = state.kpiList.map(x => x.name); [l[i - 1], l[i]] = [l[i], l[i - 1]]; c.kpi.picks = l; return re(); }
    if (b.id === 'kAuto') { c.kpi.picks = null; return re(); }
    if (b.dataset.srem) { c.src.added.splice(+b.dataset.srem.slice(6), 1); return re(); }
    if (b.id === 'srcAddBtn') { const v = $('srcAdd').value.trim(); if (v) { c.src.added.push({ label: v, covers: '', on: true }); re(); } return; }
    if (b.id === 'recOnly') { AB.SECTIONS.forEach(s => { c.sec[s.id].on = s.rec; }); return re(); }
    if (b.id === 'allOn') { AB.SECTIONS.forEach(s => { c.sec[s.id].on = true; }); return re(); }
    if (b.dataset.aiuse) { useAi(b.dataset.aiuse); return; }
    if (b.id === 'copyPrompt') { copyText(AB.prompt(abState()), b); return; }
    if (b.id === 'copyText') { copyText(AB.toText(docNow()), b); return; }
    if (b.id === 'copyMd') { copyText(AB.toMarkdown(docNow()), b); return; }
    if (b.id === 'copyTmdl') { copyText(AB.tmdl(docNow(), htmlOpts()), b); return; }
    if (b.id === 'copyDax') { copyText(AB.daxExpr(docNow(), htmlOpts()), b); return; }
  });
  $('secs').addEventListener('keydown', e => { if (e.target.id === 'srcAdd' && e.key === 'Enter') { e.preventDefault(); $('srcAddBtn').click(); } });
  $('aiInput').addEventListener('input', () => { renderAi(); persist(); });
  // HTML measure options
  $('htmlBox').addEventListener('toggle', () => renderOut());
  const hopt = (id, key, ev, fn) => $(id).addEventListener(ev || 'input', () => { state.cfg.html[key] = fn ? fn($(id)) : $(id).value; renderHtml(docNow()); persist(); });
  hopt('hName', 'name'); hopt('hTable', 'table'); hopt('hFolder', 'folder'); hopt('hFont', 'font', 'input', el => Math.max(10, Math.min(28, +el.value || 16)));
  hopt('hAccent', 'accent'); hopt('hAccentPick', 'accent', 'input', el => el.value.toUpperCase()); hopt('hRefresh', 'refresh', 'change'); hopt('hTitle', 'title', 'change', el => el.checked);

  // PBIP folder
  $('pickReport').addEventListener('click', async () => {
    if (window.showDirectoryPicker) {
      let dir; try { dir = await window.showDirectoryPicker({ id: 'sf-about-report', mode: 'read' }); } catch (e) { if (e && e.name === 'AbortError') return; $('repInput').click(); return; }
      const list = []; try { await walkHandle(dir, dir.name, list); await loadFolder(dir.name, list); } catch (e) { $('repMsg').innerHTML = '<div class="msg err">The folder couldn&rsquo;t be read: ' + esc(e.message || e) + '</div>'; }
    } else $('repInput').click();
  });
  $('repInput').addEventListener('change', async e => {
    const fl = [...e.target.files]; if (!fl.length) return;
    const root = (fl[0].webkitRelativePath || fl[0].name).split('/')[0];
    const list = fl.filter(f => wanted(f.name) && !(f.webkitRelativePath || '').split('/').some(n => SKIP_DIRS.has(n))).map(f => ({ path: f.webkitRelativePath || (root + '/' + f.name), file: f }));
    try { await loadFolder(root, list); } catch (err) { $('repMsg').innerHTML = '<div class="msg err">The folder couldn&rsquo;t be read: ' + esc(err.message || err) + '</div>'; }
    e.target.value = '';
  });
  const drop = $('repDrop');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('over')));
  drop.addEventListener('drop', async e => {
    e.preventDefault();
    const item = [...(e.dataTransfer.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).find(Boolean);
    if (!item || !item.isDirectory) { $('repMsg').innerHTML = '<div class="msg warn">Drop the project <b>folder</b>, not a file inside it.</div>'; return; }
    const list = []; await walkEntry(item, '', list);
    try { await loadFolder(item.name, list.map(x => ({ path: x.path.replace(/^\//, ''), file: x.file }))); } catch (err) { $('repMsg').innerHTML = '<div class="msg err">The folder couldn&rsquo;t be read: ' + esc(err.message || err) + '</div>'; }
  });
  $('clearReport').addEventListener('click', () => { setFolder(null, null, []); try { localStorage.removeItem(PREFIX + 'report'); } catch (e) {} $('repMsg').innerHTML = ''; renderAll(); });
  $('clearAll').addEventListener('click', () => { resetAll(); try { localStorage.setItem(PREFIX + 'blank', '1'); } catch (e) {} persist(); $('modelInput').focus(); });
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
