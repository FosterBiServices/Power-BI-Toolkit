
/* ---------- Model Linter page ---------- */
const $ = id => document.getElementById(id);
const PREFIX = 'kml.';
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

const blankCfg = () => ({ off: {}, visibleUnused: false, ignored: {}, showIgnored: false, collapsed: {}, crowded: 12 });
const state = { example: false, model: null, cfg: blankCfg(), result: null, report: null, reps: [], repSel: [], repRoot: '' };

/* ---------- report pages from a PBIP folder (only .Report files are read) ---------- */
const SKIP_DIRS = new Set(['.git', 'node_modules', '.pbi', '.vs', 'StaticResources', 'RegisteredResources']);
const skipDir = n => SKIP_DIRS.has(n) || /\.Dataset$/i.test(n);
// report files, plus the semantic model's table files (for field parameters and other calculated tables)
const wanted = p => /\.Report\/.*\.json$/i.test(p) || /\.Report\/definition\.pbir$/i.test(p) || /\.SemanticModel\/definition\/tables\/[^\/]+\.tmdl$/i.test(p);
async function decode(file){
  const buf = await file.arrayBuffer();
  let t; try { t = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { t = new TextDecoder('windows-1252').decode(buf); }
  return t.replace(/^\uFEFF/, '');
}
async function walkHandle(dir, prefix, out){
  for await (const [name, h] of dir.entries()) {
    if (h.kind === 'directory') { if (!skipDir(name)) await walkHandle(h, prefix + '/' + name, out); }
    else if (/\.(json|tmdl|pbir)$/i.test(name)) out.push({ path: prefix + '/' + name, file: await h.getFile() });
  }
}
function walkEntry(entry, prefix, out){
  return new Promise(resolve => {
    if (entry.isFile) { if (/\.(json|tmdl|pbir)$/i.test(entry.name)) entry.file(f => { out.push({ path: prefix + '/' + entry.name, file: f }); resolve(); }, () => resolve()); else resolve(); return; }
    if (skipDir(entry.name)) { resolve(); return; }
    const reader = entry.createReader(); const all = [];
    const next = () => reader.readEntries(batch => { if (!batch.length) { Promise.all(all.map(e => walkEntry(e, prefix + '/' + entry.name, out))).then(resolve); return; } all.push(...batch); next(); }, () => resolve());
    next();
  });
}
async function loadReport(root, list, quiet){
  $('repMsg').innerHTML = '<div class="msg info">Reading &ldquo;' + esc(root) + '&rdquo;&hellip;</div>';
  // a chosen .Report folder itself: its files have no ".Report/" above them, so add it back
  const norm = p => (/\.(Report|SemanticModel)$/i.test(root) && !/\.(Report|SemanticModel)\//i.test(p)) ? root + '/' + p.split('/').slice(1).join('/') : p;
  const files = new Map();
  for (const { path, file } of list) {
    const p = norm(path); if (!wanted(p) || file.size > 30 * 1024 * 1024) continue;
    try { files.set(p, await decode(file)); } catch (e) {}
  }
  const reps = ML.reportList(files).filter(r => r.pages);
  if (!reps.length) {
    if (quiet) { $('repMsg').innerHTML = ''; return; }
    $('repMsg').innerHTML = '<div class="msg warn">No report pages were found in &ldquo;' + esc(root) + '&rdquo;. Choose a folder that holds a <b>.Report</b> folder, from a report saved as a Power BI Project (<b>File &gt; Save as &gt; Power BI project files</b>).</div>';
    return;
  }
  state.reps = reps; state.repRoot = root;
  // several reports: start with the one that best matches this model export; tick others to add them
  let pick = reps[0];
  if (reps.length > 1 && state.model) pick = reps.reduce((a, b) => (ML.matchScore(state.model, b) || 0) > (ML.matchScore(state.model, a) || 0) ? b : a);
  state.repSel = [pick.id];
  applyReports();
  leaveExample(); run(); renderReport(); renderRules(); renderResults(); persist();
}
function applyReports(){
  const sel = (state.reps || []).filter(r => state.repSel.includes(r.id));
  state.report = ML.mergeReports(sel);
  if (state.report) { state.report.root = state.repRoot; }
  store.set('reports', JSON.stringify({ root: state.repRoot, reps: state.reps || [], sel: state.repSel || [] }));
  try { localStorage.removeItem(PREFIX + 'report'); } catch (e) {}
}
function renderReport(){
  const r = state.report, reps = state.reps || [];
  $('clearReport').hidden = !reps.length; $('pickReport').textContent = reps.length ? 'Choose a different folder' : 'Choose a PBIP folder';
  const pick = reps.length > 1 ? '<div class="reppick"><p class="small"><b>' + reps.length + ' reports in &ldquo;' + esc(state.repRoot || '') + '&rdquo;.</b> Tick the ones to check against this model; each is read with its own semantic model.</p>' + reps.map(x => {
      const sc = state.model ? ML.matchScore(state.model, x) : null;
      const fit = sc == null ? '' : sc >= 0.8 ? '<span class="fit ok">built on this model</span>' : sc >= 0.5 ? '<span class="fit">partly matches this model</span>' : '<span class="fit off">likely a different model</span>';
      return '<label class="reprow"><input type="checkbox" data-rep="' + esc(x.id) + '"' + (state.repSel.includes(x.id) ? ' checked' : '') + '><span><b>' + esc(x.label) + '</b> <span class="muted small">' + x.pages + ' page' + (x.pages === 1 ? '' : 's') + ', ' + x.visuals + ' visuals' + (x.model ? ' &middot; model: ' + esc(x.model.replace(/\.SemanticModel$/i, '')) : x.live ? ' &middot; connected to a published model' : '') + '</span> ' + fit + '</span></label>';
    }).join('') + '</div>' : '';
  if (!r) { if (reps.length) { $('repMsg').innerHTML = pick + '<div class="msg info">No report is ticked, so the checks that need report pages are waiting.</div>'; return; } if (!/Reading/.test($('repMsg').textContent) && !/No report pages/.test($('repMsg').textContent)) $('repMsg').innerHTML = ''; return; }
  const cols = state.model ? r.refs.filter(x => state.model.columns.some(c => lc(c.table) === lc(x[0]) && lc(c.name) === lc(x[1]))).length : 0;
  const bm = r.detail ? r.detail.bookmarks.length : 0;
  $('repMsg').innerHTML = pick + '<div class="msg ok">&#10003; <b>' + esc(r.reports.join(', ')) + '</b>: ' + r.pages + ' page' + (r.pages === 1 ? '' : 's') + ', ' + r.visuals + ' visual' + (r.visuals === 1 ? '' : 's') + (bm ? ', ' + bm + ' bookmark' + (bm === 1 ? '' : 's') : '') + ', ' + r.refs.length + ' fields' + (state.model ? ' (' + cols + ' columns of this model)' : '') + '.' + ((r.modelExprs || []).length ? ' The semantic model&rsquo;s field parameters and calculated tables were read too.' : '') + ' Unused columns and measures, and the report checks, now use these pages.</div>';
}

function persist(){
  store.set('model', state.example ? '' : $('modelInput').value);
  store.set('cfg', JSON.stringify(state.example ? blankCfg() : state.cfg));
}
function setExample(on){ state.example = on; $('exampleBanner').hidden = !on; }
function leaveExample(){ if (state.example) setExample(false); }

function objLabel(f){
  if (f.kind === 'Model') return 'Model settings';
  if (f.kind === 'Visual') return f.table + ' \u203a ' + f.name;
  if (f.kind === 'Page') return f.table;
  if (f.kind === 'Bookmark') return f.name + (state.report && state.report.reports.length > 1 ? ' (' + f.table + ')' : '');
  if (f.kind === 'Relationship') return qName(f.table) + '[' + f.name.replace(' → ', '] → ');
  return qName(f.table) + bracket(f.name);
}

function renderModel(){
  const text = $('modelInput').value;
  const m = text.trim() ? ML.parse(text) : null;
  state.model = m && !m.error ? m : null;
  let msg = m && m.error ? '<div class="msg err">' + esc(m.error) + '</div>' : '';
  if (state.model && !state.model.has.upgraded) msg += '<div class="msg warn"><b>This export comes from the earlier version of the query.</b> It works, but it doesn&rsquo;t include each column&rsquo;s summarization, sort-by column and hierarchies, or the Discourage implicit measures setting, so three checks are partial. Copy the updated query above, replace the one in your DAX query view tab, then <b>Run</b> and <b>Copy</b> again. Every toolkit page reads the new version.</div>';
  $('modelMsg').innerHTML = msg;
  const m2 = state.model;
  $('modelStats').innerHTML = m2 ? '<span class="stat"><b>' + m2.tables.length + '</b> tables</span><span class="stat"><b>' + m2.columns.length + '</b> columns</span><span class="stat"><b>' + m2.measures.length + '</b> measures</span><span class="stat"><b>' + m2.rels.length + '</b> relationships</span>' : '';
}

function readDeps(){
  const t = $('depInput').value.trim();
  const d = t ? ML.parseDeps(t) : null;
  state.deps = d && !d.error ? d.rows : null;
  $('depMsg').innerHTML = d && d.error ? '<div class="msg err">' + esc(d.error) + '</div>' : state.deps ? '<div class="msg ok">&#10003; ' + state.deps.length + ' dependencies from Power BI. Unused measures and columns now use them.</div>' : '';
}
function run(){
  state.result = state.model ? ML.lint(state.model, Object.assign({}, state.cfg, { report: state.report, deps: state.deps })) : null;
}

function renderRules(){
  const r = state.result, c = state.cfg;
  const needs = !state.report || !state.report.detail;
  $('rules').innerHTML = ML.RULES.map((rule, idx) => {
    const head = rule.group === 'report' && ML.RULES[idx - 1].group !== 'report' ? '<h3 class="rules-h">Report pages' + (needs ? ' <span class="muted small">(add a PBIP folder in Step 1 to run these)</span>' : '') + '</h3>' : '';
    return head + ruleHtml(rule);
  }).join('');
}
function ruleHtml(rule){
  const r = state.result, c = state.cfg;
  {
    const on = !c.off[rule.id];
    const n = r ? r.findings.filter(f => f.rule === rule.id && !c.ignored[f.id]).length : 0;
    const waiting = rule.needsReport && (!state.report || (rule.group === 'report' && !state.report.detail));
    const badge = !r ? '' : !on ? '<span class="cnt off">off</span>' : waiting ? '<span class="cnt off">needs report pages</span>' : n ? '<span class="cnt bad">' + n + '</span>' : '<span class="cnt ok">&#10003;</span>';
    const extra = rule.id === 'crowded' ? '<label class="subopt">More than <input type="number" id="crowdedN" min="3" max="60" value="' + (+c.crowded || 12) + '"' + (on ? '' : ' disabled') + '> visuals that load data on one page</label>' : rule.id === 'unused' && state.report ? '<p class="subopt muted">Visible columns are checked against the report pages added in Step 1.</p>' : rule.id === 'unused' ? '<label class="subopt"><input type="checkbox" id="visibleUnused"' + (c.visibleUnused ? ' checked' : '') + (on ? '' : ' disabled') + '> Also list visible columns <span class="muted">(the export can&rsquo;t see report pages, so these need checking by hand)</span></label>' : '';
    return '<div class="rule' + (on ? '' : ' is-off') + (rule.needsReport && (!state.report || (rule.group === 'report' && !state.report.detail)) ? ' needs' : '') + '"><label class="rule-main"><input type="checkbox" data-rule="' + rule.id + '"' + (on ? ' checked' : '') + '><span class="rule-t">' + esc(rule.title) + '</span>' + badge + '</label><p class="rule-why">' + esc(rule.why) + '</p>' + extra + '</div>';
  }
}

function row(f, ignored){
  return '<li class="f ' + f.sev + (ignored ? ' ign' : '') + '"><span class="sev ' + f.sev + '" title="' + (f.sev === 'warn' ? 'Fix' : 'Worth a look') + '"></span>'
    + '<div class="f-body"><div class="f-obj"><span class="kindtag">' + esc(f.kind) + '</span><span class="mono">' + esc(objLabel(f)) + '</span></div><div class="f-det">' + esc(f.detail) + '</div></div>'
    + '<span class="f-btns">' + (f.rule === 'unusedm' || f.rule === 'unused' ? '<button type="button" class="btn small" data-where="' + esc(f.name) + '">Where used?</button>' : '') + '<button type="button" class="btn small" data-ign="' + esc(f.id) + '">' + (ignored ? 'Restore' : 'Ignore') + '</button></span></li>';
}

function renderResults(){
  const r = state.result, c = state.cfg;
  if (!r) { $('sumBar').innerHTML = ''; $('results').innerHTML = '<p class="muted">Paste a model export in Step 1 to see the findings.</p>'; return; }
  const live = r.findings.filter(f => !c.ignored[f.id]), ign = r.findings.filter(f => c.ignored[f.id]);
  const w = live.filter(f => f.sev === 'warn').length, i = live.length - w;
  const active = ML.RULES.filter(x => !c.off[x.id]);
  $('sumBar').innerHTML = '<div class="sum-txt">' + (live.length ? '<b>' + live.length + '</b> finding' + (live.length === 1 ? '' : 's') + ': <b>' + w + '</b> to fix, <b>' + i + '</b> worth a look' : '<b class="okc">&#10003; No findings</b> across ' + active.length + ' check' + (active.length === 1 ? '' : 's')) + (ign.length ? ' &middot; ' + ign.length + ' ignored' : '') + '</div>'
    + '<div class="btns">' + (ign.length ? '<button type="button" class="btn" id="toggleIgn">' + (c.showIgnored ? 'Hide ignored' : 'Show ignored') + '</button>' : '') + (r.findings.length ? '<button type="button" class="btn primary" id="copyAll">Copy findings for Excel</button>' : '') + '</div>';
  const waiting = rule => rule.needsReport && (!state.report || (rule.group === 'report' && !state.report.detail));
  const waitRep = active.filter(x => x.group === 'report' && waiting(x));
  $('results').innerHTML = active.filter(x => !(x.group === 'report' && waiting(x))).map(rule => {
    if (waiting(rule)) return '<div class="grp pass"><div class="grp-head"><span class="grp-t muted">' + esc(rule.title) + '</span><span class="muted small">needs report pages</span></div>' + (r.notes[rule.id] ? '<div class="msg info">' + esc(r.notes[rule.id]) + '</div>' : '') + '</div>';
    const fs = live.filter(f => f.rule === rule.id), fi = c.showIgnored ? ign.filter(f => f.rule === rule.id) : [];
    const note = r.notes[rule.id];
    const vu = rule.id === 'unused' && !c.visibleUnused && r.notes.visibleUnused ? '<div class="msg info">' + r.notes.visibleUnused + ' visible column' + (r.notes.visibleUnused === 1 ? ' isn’t' : 's aren’t') + ' used anywhere in the model either. They&rsquo;re probably on report pages; turn on <b>Also list visible columns</b> in Step 2 to review them.</div>' : '';
    const noteHtml = note ? '<div class="msg ' + (/^✓/.test(note) ? 'ok' : 'info') + '">' + esc(note) + '</div>' : '';
    const open = !c.collapsed[rule.id];
    if (!fs.length && !fi.length) return '<div class="grp pass"><div class="grp-head"><span class="okc">&#10003;</span> <span class="grp-t">' + esc(rule.title) + '</span><span class="muted small">no findings</span></div>' + noteHtml + vu + '</div>';
    return '<details class="grp" data-grp="' + rule.id + '"' + (open ? ' open' : '') + '><summary class="grp-head"><span class="grp-t">' + esc(rule.title) + '</span><span class="cnt bad">' + fs.length + '</span>'
      + '<span class="grp-act"><button type="button" class="btn small" data-copyrule="' + rule.id + '">Copy list</button>' + (fs.length > 1 ? '<button type="button" class="btn small" data-ignall="' + rule.id + '">Ignore all</button>' : '') + '</span></summary>'
      + '<div class="grp-body"><div class="fix"><b>How to fix.</b> ' + rule.fix + '</div>' + noteHtml + vu
      + '<ul class="fl">' + fs.map(f => row(f, false)).join('') + fi.map(f => row(f, true)).join('') + '</ul></div></details>';
  }).join('') + (waitRep.length ? '<div class="grp pass"><div class="grp-head"><span class="grp-t muted">Report checks</span><span class="muted small">' + waitRep.length + ' check' + (waitRep.length === 1 ? '' : 's') + ' waiting for report pages</span></div><div class="msg info">' + esc(r.notes[waitRep[0].id] || '') + '</div></div>' : '') || '<p class="muted">All checks are off. Turn some on in Step 2.</p>';
  renderWhere();
}

function tsv(list){
  const title = id => (ML.RULES.find(x => x.id === id) || {}).title || id;
  const cell = s => String(s || '').replace(/[\t\n]+/g, ' ');
  return ['Check\tSeverity\tObject type\tTable\tName\tDetail'].concat(list.map(f => [title(f.rule), f.sev === 'warn' ? 'Fix' : 'Worth a look', f.kind, f.table, f.name, f.detail].map(cell).join('\t'))).join('\n');
}

function renderWhere(){
  const m = state.model;
  $('whereList').innerHTML = m ? m.measures.map(x => '<option value="' + esc(x.name) + '">').join('') + m.columns.map(c => '<option value="' + esc(c.table + '[' + c.name + ']') + '">').join('') : '';
  const q = $('whereInput').value.trim();
  if (!m || !q) { $('whereOut').innerHTML = ''; return; }
  const name = q.replace(/^.*\[|\]$/g, '');
  const known = m.measures.some(x => lc(x.name) === lc(name)) || m.columns.some(c => lc(c.name) === lc(name));
  const list = ML.whereUsed(m, q, { report: state.report, deps: state.deps });
  const seen = new Set(), rows = list.filter(x => { const k = x.kind + '|' + x.where; if (seen.has(k)) return false; seen.add(k); return true; });
  $('whereOut').innerHTML = (!known ? '<div class="msg warn">No measure or column called &ldquo;' + esc(name) + '&rdquo; is in this model export.</div>' : '')
    + (rows.length ? '<ul class="wl">' + rows.map(x => '<li><span class="kindtag">' + esc(x.kind) + '</span> <span class="mono">' + esc(x.where) + '</span></li>').join('') + '</ul>'
      : known ? '<div class="msg info">Nothing in the model export' + (state.report ? ' or on the report pages checked' : '') + (state.deps ? ' or in Power BI&rsquo;s dependencies' : '') + ' uses &ldquo;' + esc(name) + '&rdquo;.' + (state.report ? '' : ' Add report pages in Step 1 to include visuals.') + (state.deps ? '' : ' The dependencies query in Step 1 is the most complete check.') + '</div>' : '')
    + (known && !m.measures.some(x => lc(x.name) === lc(name)) ? '<p class="note small">Columns are matched by name, so a column name used in more than one table shows every place that name is used.</p>' : '');
}
function renderAll(){ renderModel(); readDeps(); run(); renderReport(); renderRules(); renderResults(); renderWhere(); }

/* ---------- init ---------- */
function resetAll(){ $('modelInput').value = ''; $('depInput').value = ''; $('depBox').open = false; state.report = null; state.reps = []; state.repSel = []; $('repMsg').innerHTML = ''; state.cfg = blankCfg(); setExample(false); $('modelBox').open = false; renderAll(); }
function init(){
  $('exportView').textContent = DAX_QUERY;
  $('depsView').textContent = ML.DEPS_QUERY;
  $('depInput').value = store.get('deps') || '';
  const saved = store.get('model');
  let cfg = null; try { cfg = JSON.parse(store.get('cfg') || 'null'); } catch (e) {}
  try {
    const saved = JSON.parse(store.get('reports') || 'null'), old = JSON.parse(store.get('report') || 'null');
    if (saved && saved.reps && saved.reps.length) { state.reps = saved.reps; state.repSel = saved.sel || []; state.repRoot = saved.root; state.report = ML.mergeReports(state.reps.filter(r => state.repSel.includes(r.id))); }
    else if (old) { old.id = old.id || 'saved'; old.label = old.label || old.reports.join(', '); state.reps = [old]; state.repSel = [old.id]; state.repRoot = old.root; state.report = old; }
  } catch (e) { state.report = null; state.reps = []; state.repSel = []; }
  if (saved && saved.trim()) { $('modelInput').value = saved; if (cfg) state.cfg = Object.assign(blankCfg(), cfg); }
  else if (store.get('blank') !== '1') { $('modelInput').value = ML_EX_MODEL; setExample(true); }
  else if (cfg) state.cfg = Object.assign(blankCfg(), cfg);
  renderAll();

  const change = () => { leaveExample(); run(); renderRules(); renderResults(); persist(); };
  $('whereInput').addEventListener('input', renderWhere);
  $('depInput').addEventListener('input', () => { readDeps(); run(); renderRules(); renderResults(); store.set('deps', $('depInput').value); });
  $('modelInput').addEventListener('input', () => {
    if (state.example) { state.cfg = blankCfg(); setExample(false); }
    try { localStorage.removeItem(PREFIX + 'blank'); } catch (e) {}
    renderAll(); persist();
  });
  $('rules').addEventListener('change', e => {
    const id = e.target.dataset.rule;
    if (id) { if (e.target.checked) delete state.cfg.off[id]; else state.cfg.off[id] = true; change(); }
    else if (e.target.id === 'visibleUnused') { state.cfg.visibleUnused = e.target.checked; change(); }
    else if (e.target.id === 'crowdedN') { const v = Math.max(3, Math.min(60, +e.target.value || 12)); state.cfg.crowded = v; change(); }
  });
  $('results').addEventListener('toggle', e => { const g = e.target.dataset && e.target.dataset.grp; if (!g) return; if (e.target.open) delete state.cfg.collapsed[g]; else state.cfg.collapsed[g] = true; persist(); }, true);
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.copy === 'export') { copyText(DAX_QUERY, b); return; }
    if (b.dataset.copy === 'deps') { copyText(ML.DEPS_QUERY, b); return; }
    if (b.dataset.where != null) { e.preventDefault(); $('whereInput').value = b.dataset.where; $('whereBox').open = true; renderWhere(); $('whereBox').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (b.dataset.ign) { const id = b.dataset.ign; if (state.cfg.ignored[id]) delete state.cfg.ignored[id]; else state.cfg.ignored[id] = true; change(); return; }
    if (b.dataset.ignall) { e.preventDefault(); state.result.findings.filter(f => f.rule === b.dataset.ignall).forEach(f => { state.cfg.ignored[f.id] = true; }); change(); return; }
    if (b.dataset.copyrule) { e.preventDefault(); copyText(tsv(state.result.findings.filter(f => f.rule === b.dataset.copyrule && !state.cfg.ignored[f.id])), b); return; }
    if (b.id === 'copyAll') { copyText(tsv(state.result.findings.filter(f => !state.cfg.ignored[f.id])), b); return; }
    if (b.id === 'toggleIgn') { state.cfg.showIgnored = !state.cfg.showIgnored; renderResults(); persist(); }
  });
  // a PBIP folder chosen in Connect your model brings its report pages too
  document.addEventListener('sf-pbip-folder', e => loadReport(e.detail.root, e.detail.list, true).catch(err => { $('repMsg').innerHTML = '<div class="msg err">The report pages couldn&rsquo;t be read: ' + esc(err.message || err) + '</div>'; }));
  $('pickReport').addEventListener('click', async () => {
    if (window.showDirectoryPicker) {
      let dir; try { dir = await window.showDirectoryPicker({ id: 'sf-model-linter', mode: 'read' }); } catch (e) { if (e && e.name === 'AbortError') return; $('repInput').click(); return; }
      const list = []; try { await walkHandle(dir, dir.name, list); await loadReport(dir.name, list); } catch (e) { $('repMsg').innerHTML = '<div class="msg err">The folder couldn&rsquo;t be read: ' + esc(e.message || e) + '</div>'; }
    } else $('repInput').click();
  });
  $('repInput').addEventListener('change', async e => {
    const fl = [...e.target.files]; if (!fl.length) return;
    const root = (fl[0].webkitRelativePath || fl[0].name).split('/')[0];
    const list = fl.filter(f => /\.(json|tmdl|pbir)$/i.test(f.name) && !(f.webkitRelativePath || '').split('/').some(skipDir)).map(f => ({ path: f.webkitRelativePath || (root + '/' + f.name), file: f }));
    try { await loadReport(root, list); } catch (err) { $('repMsg').innerHTML = '<div class="msg err">The folder couldn&rsquo;t be read: ' + esc(err.message || err) + '</div>'; }
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
    try { await loadReport(item.name, list.map(x => ({ path: x.path.replace(/^\//, ''), file: x.file }))); } catch (err) { $('repMsg').innerHTML = '<div class="msg err">The folder couldn&rsquo;t be read: ' + esc(err.message || err) + '</div>'; }
  });
  $('repMsg').addEventListener('change', e => { const id = e.target.dataset && e.target.dataset.rep; if (id == null) return; state.repSel = e.target.checked ? state.repSel.concat([id]) : state.repSel.filter(x => x !== id); applyReports(); run(); renderReport(); renderRules(); renderResults(); });
  $('clearReport').addEventListener('click', () => { state.report = null; state.reps = []; state.repSel = []; try { localStorage.removeItem(PREFIX + 'report'); localStorage.removeItem(PREFIX + 'reports'); } catch (e) {} $('repMsg').innerHTML = ''; run(); renderReport(); renderRules(); renderResults(); });
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
