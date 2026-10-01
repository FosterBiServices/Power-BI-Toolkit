
/* ---------- Model Documenter page ---------- */
const $ = id => document.getElementById(id);
const PREFIX = 'kmdoc.';
const store = {
  get(k){ try { return localStorage.getItem(PREFIX + k); } catch (e) { return null; } },
  set(k, v){ try { localStorage.setItem(PREFIX + k, v); } catch (e) {} },
  del(k){ try { localStorage.removeItem(PREFIX + k); } catch (e) {} }
};
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function msg(level, html){ return '<div class="msg ' + level + '">' + html + '</div>'; }
function copyText(text, btn){
  const done = () => { const o = btn.dataset.label || btn.textContent; btn.dataset.label = o; btn.textContent = 'Copied'; btn.classList.add('done'); setTimeout(() => { btn.textContent = o; btn.classList.remove('done'); }, 1600); };
  const fallback = () => { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta); if (ok) done(); };
  try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
}

/* Presets. The desktop app's Business preset also leaves out measures tables, which drops every measure kept in one,
   so here Business keeps them. */
const OPT_KEYS = ['include_report', 'include_dax', 'include_power_query', 'include_hidden', 'include_measures_tables', 'show_auto_date_tables'];
const PRESETS = {
  'Business Documentation': { include_report: false, include_dax: false, include_power_query: false, include_hidden: false, include_measures_tables: true, show_auto_date_tables: false },
  'Developer Documentation': { include_report: true, include_dax: true, include_power_query: true, include_hidden: true, include_measures_tables: true, show_auto_date_tables: true }
};
const state = { example: false, tab: 'folder', files: null, root: '', projects: [], choice: '', project: null, projectError: '', folderNote: '', preset: 'Business Documentation', opts: Object.assign({}, PRESETS['Business Documentation']), html: '', fileName: '', readInfo: null };

/* ---------- settings ---------- */
function persist(){
  store.set('settings', JSON.stringify({ tab: state.tab, preset: state.preset, opts: state.opts, root: state.lastRoot || '' }));
  store.set('export', state.example ? '' : $('exInput').value);
  store.set('exName', $('exName').value);
}
function setTab(t){
  state.tab = t;
  $('tabFolder').setAttribute('aria-selected', t === 'folder'); $('tabExport').setAttribute('aria-selected', t === 'export');
  $('paneFolder').hidden = t !== 'folder'; $('paneExport').hidden = t !== 'export';
  document.querySelectorAll('[data-only=folder]').forEach(el => { el.hidden = t === 'folder'; });
}
function setPreset(p){
  state.preset = p; $('preset').value = p;
  if (PRESETS[p]) state.opts = Object.assign({}, PRESETS[p]);
  renderOpts();
}
function renderOpts(){ document.querySelectorAll('#opts [data-opt]').forEach(cb => { cb.checked = !!state.opts[cb.dataset.opt]; }); }
function setExample(on){ state.example = on; $('exampleBanner').hidden = !on; }

/* ---------- reading a folder ---------- */
const WANT = /\.(tmdl|json|pbip|pbir)$/i;
const SKIP_DIRS = new Set(['.git', 'node_modules', '.pbi', '.vs', 'StaticResources']);
const MAX_BYTES = 20 * 1024 * 1024;
async function decode(file){
  const buf = await file.arrayBuffer();
  let t; try { t = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { t = new TextDecoder('windows-1252').decode(buf); }
  return t.replace(/^﻿/, '');
}
async function readList(list){ // [{path, file}]
  const files = new Map(); let seen = 0, other = { bim: false, legacyReport: false };
  for (const { path, file } of list) {
    seen++;
    if (/\.bim$/i.test(path)) other.bim = true;
    if (/\.Report\/report\.json$/i.test(path)) other.legacyReport = true;
    if (!WANT.test(path) || file.size > MAX_BYTES) continue;
    try { files.set(path, await decode(file)); } catch (e) { (other.unreadable = other.unreadable || []).push(path); }
  }
  return { files, seen, other };
}
async function walkHandle(dir, prefix, out){
  for await (const [name, h] of dir.entries()) {
    if (h.kind === 'directory') { if (!SKIP_DIRS.has(name)) await walkHandle(h, prefix + '/' + name, out); }
    else if (WANT.test(name) || /\.bim$/i.test(name) || /^report\.json$/i.test(name)) out.push({ path: prefix + '/' + name, file: await h.getFile() });
  }
}
function walkEntry(entry, prefix, out){
  return new Promise(resolve => {
    if (entry.isFile) { if (WANT.test(entry.name) || /\.bim$/i.test(entry.name) || /^report\.json$/i.test(entry.name)) entry.file(f => { out.push({ path: prefix + '/' + entry.name, file: f }); resolve(); }, () => resolve()); else resolve(); return; }
    if (SKIP_DIRS.has(entry.name)) { resolve(); return; }
    const reader = entry.createReader(); const all = [];
    const next = () => reader.readEntries(batch => {
      if (!batch.length) { Promise.all(all.map(e => walkEntry(e, prefix + '/' + entry.name, out))).then(resolve); return; }
      all.push(...batch); next();
    }, () => resolve());
    next();
  });
}
async function loadFolder(root, list){
  $('folderMsg').innerHTML = msg('info', 'Reading &ldquo;' + esc(root) + '&rdquo;&hellip;');
  const { files, seen, other } = await readList(list);
  if (state.example) setExample(false);
  state.files = files; state.root = root; state.lastRoot = root; state.readInfo = { seen, count: files.size, other };
  try { store.del('blank'); } catch (e) {}
  setTab('folder');
  pickProjects();
  persist();
}
function pickProjects(){
  state.projects = MD.listProjects(state.files, state.root);
  const usable = state.projects.filter(p => p.semantic);
  $('projWrap').hidden = state.projects.length < 2;
  $('projPick').innerHTML = state.projects.map(p => '<option value="' + esc(p.id) + '">' + esc(p.label) + '</option>').join('');
  const keep = state.projects.find(p => p.id === state.choice && p.semantic);
  state.choice = keep ? keep.id : (usable[0] ? usable[0].id : (state.projects[0] ? state.projects[0].id : ''));
  $('projPick').value = state.choice;
  loadChoice();
}
function loadChoice(){
  const c = state.projects.find(p => p.id === state.choice);
  state.project = null; state.projectError = '';
  if (!c) {
    const o = (state.readInfo || {}).other || {};
    state.projectError = o.bim
      ? 'This project saves its model as model.bim. In Power BI Desktop, turn on <b>File &gt; Options and settings &gt; Options &gt; Preview features &gt; Store semantic model using TMDL format</b>, then save the project again.'
      : 'No semantic model was found in &ldquo;' + esc(state.root) + '&rdquo;. Choose the folder that holds your <b>.pbip</b> file or a <b>.SemanticModel</b> folder, saved as a Power BI Project (PBIP) with the TMDL format.';
  } else if (c.error) state.projectError = esc(c.error);
  else {
    try { state.project = MD.loadModel(state.files, c); }
    catch (e) { state.projectError = esc(e.message || String(e)); }
  }
  render();
}

/* ---------- export ---------- */
function exportProject(){
  const text = $('exInput').value;
  if (!text.trim()) return { project: null, error: '' };
  try {
    const p = MD.projectFromExport(text, $('exName').value.trim() || 'Model');
    if (!p.tables.size) return { project: null, error: 'No tables were found in the export.' };
    return { project: p, error: '' };
  } catch (e) { return { project: null, error: esc(e.message || String(e)) }; }
}

/* ---------- output ---------- */
const DOC_CSS = MD.CSS.replace(/#1a3a5c/g, '#003F88').replace(/#c89632/g, '#F5A800');
function currentProject(){
  if (state.tab === 'export') { const r = exportProject(); return r; }
  return { project: state.project, error: state.projectError };
}
function render(){
  const o = Object.assign({ profile: state.preset }, state.opts);
  // folder status
  if (state.tab === 'folder') {
    if (state.example) $('folderMsg').innerHTML = msg('info', 'Showing the example project. Choose your own folder to replace it.');
    else if (!state.files) {
      const last = state.lastRoot || '';
      $('folderMsg').innerHTML = last ? msg('info', 'The page doesn&rsquo;t keep your project files. Choose &ldquo;' + esc(last) + '&rdquo; again to document it.') : '';
    } else if (state.projectError) $('folderMsg').innerHTML = msg('err', state.projectError);
    else if (state.project) {
      const p = state.project, info = state.readInfo || {};
      const warn = [];
      if (!p.report_root && !(info.other || {}).legacyReport) warn.push('No report was found next to the model, so report pages aren&rsquo;t included.');
      if ((info.other || {}).unreadable) warn.push('These files couldn&rsquo;t be read, so anything in them is missing: ' + info.other.unreadable.map(x => esc(x.split('/').slice(-2).join('/'))).join(', ') + '. Close any program that has them open and choose the folder again.');
      if ((info.other || {}).legacyReport && !p.pages.length) warn.push('The report uses the older report.json format, so report pages can&rsquo;t be read. In Power BI Desktop, turn on <b>File &gt; Options and settings &gt; Options &gt; Preview features &gt; Store reports using enhanced metadata format (PBIR)</b>, then save the project again.');
      $('folderMsg').innerHTML = msg('ok', '&#10003; <b>' + esc(p.name) + '</b> read from &ldquo;' + esc(state.root) + '&rdquo;: ' + p.tables.size + ' tables, ' + [...p.tables.values()].reduce((s, t) => s + t.measures.length, 0) + ' measures, ' + p.relationships.length + ' relationships, ' + p.pages.length + ' report pages.')
        + warn.map(w => msg('warn', w)).join('');
    }
  } else {
    const r = exportProject();
    $('exportMsg').innerHTML = r.error ? msg('err', r.error) : '';
  }
  const { project, error } = currentProject();
  $('outBox').hidden = !project; $('outWait').hidden = !!project;
  if (!project) { state.html = ''; $('outWait').className = 'msg ' + (error ? 'err' : 'info'); $('outWait').innerHTML = error ? 'Fix the problem in Step 1 to see the document.' : 'Choose a project folder or paste a model export in Step 1.'; return; }
  const note = project.source === 'export' ? 'Documented from the model export, so Power Query, data sources and report pages aren’t included.' : '';
  const today = new Date(); const date = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  state.html = MD.generateHtml(project, o, { css: DOC_CSS, footer: 'Generated locally with the SF Power BI Toolkit · Model Documenter.', note, date });
  state.fileName = MD.defaultFilename(project, o).replace(/[<>:"\/\\|?*\x00-\x1f]/g, '-');
  $('fileName').textContent = state.fileName;
  const tables = MD.scopeTables(project, o);
  const shown = MD.sectionVisibility(o, project);
  const measures = tables.reduce((s, t) => s + t.measures.filter(m => o.include_hidden || !m.is_hidden).length, 0);
  let stats = '<span class="stat"><b>' + tables.length + '</b> tables</span><span class="stat"><b>' + measures + '</b> measures</span><span class="stat"><b>' + project.relationships.length + '</b> relationships</span>';
  if (project.pages.length) stats += '<span class="stat"><b>' + project.pages.length + '</b> report pages' + (shown.report ? '' : ' (not included)') + '</span>';
  if (shown.validation) {
    const f = MD.analyzeModel(project, tables); const e = f.filter(x => x.severity === 'Error').length, w = f.filter(x => x.severity === 'Warning').length;
    stats += '<span class="stat' + (e ? ' bad' : '') + '"><b>' + e + '</b> errors</span><span class="stat"><b>' + w + '</b> warnings</span>';
  }
  $('outStats').innerHTML = stats;
  $('preview').srcdoc = state.html;
}

/* ---------- init ---------- */
function resetAll(){
  state.files = null; state.root = ''; state.projects = []; state.choice = ''; state.project = null; state.projectError = ''; state.readInfo = null;
  $('exInput').value = ''; $('exName').value = ''; $('projWrap').hidden = true; $('folderMsg').innerHTML = ''; $('exportMsg').innerHTML = '';
  setExample(false); setTab('folder'); setPreset('Business Documentation');
  state.lastRoot = '';
  render();
}
function loadExample(){
  state.files = new Map(Object.entries(EX_FILES)); state.root = EX_ROOT; state.readInfo = { seen: state.files.size, count: state.files.size, other: {} };
  setExample(true); setTab('folder');
  state.projects = MD.listProjects(state.files, state.root); state.choice = state.projects[0].id; $('projWrap').hidden = true;
  loadChoice();
}
function init(){
  $('exportView').textContent = DAX_QUERY;
  let s = {}; try { s = JSON.parse(store.get('settings') || '{}') || {}; } catch (e) {}
  state.lastRoot = s.root || '';
  if (s.preset) { state.preset = s.preset; $('preset').value = s.preset; }
  if (s.opts) OPT_KEYS.forEach(k => { if (k in s.opts) state.opts[k] = !!s.opts[k]; });
  renderOpts();
  const savedExport = store.get('export') || '';
  $('exName').value = store.get('exName') || '';
  if (savedExport.trim()) { $('exInput').value = savedExport; setTab(s.tab === 'folder' ? 'folder' : 'export'); render(); }
  else if (store.get('blank') !== '1' && !s.root) loadExample();
  else { setTab(s.tab || 'folder'); render(); }

  $('tabFolder').addEventListener('click', () => { setTab('folder'); render(); persist(); });
  $('tabExport').addEventListener('click', () => { setTab('export'); render(); persist(); });
  $('pickFolder').addEventListener('click', async () => {
    if (window.showDirectoryPicker) {
      let dir; try { dir = await window.showDirectoryPicker({ id: 'sf-model-documenter', mode: 'read' }); } catch (e) { if (e && e.name === 'AbortError') return; $('folderInput').click(); return; }
      const list = []; try { await walkHandle(dir, dir.name, list); } catch (e) { $('folderMsg').innerHTML = msg('err', 'The folder couldn&rsquo;t be read: ' + esc(e.message || e)); return; }
      try { await loadFolder(dir.name, list); } catch (err) { $('folderMsg').innerHTML = msg('err', 'The folder couldn&rsquo;t be read: ' + esc(err.message || err)); }
    } else $('folderInput').click();
  });
  $('folderInput').addEventListener('change', async e => {
    const fl = [...e.target.files]; if (!fl.length) return;
    const root = (fl[0].webkitRelativePath || fl[0].name).split('/')[0];
    const list = fl.filter(f => !(f.webkitRelativePath || '').split('/').some(seg => SKIP_DIRS.has(seg))).map(f => ({ path: f.webkitRelativePath || (root + '/' + f.name), file: f }));
    try { await loadFolder(root, list); }
    catch (err) { $('folderMsg').innerHTML = msg('err', 'The folder couldn&rsquo;t be read: ' + esc(err.message || err)); }
    e.target.value = '';
  });
  const drop = $('drop');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('over')));
  drop.addEventListener('drop', async e => {
    e.preventDefault();
    const item = [...(e.dataTransfer.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).find(Boolean);
    if (!item || !item.isDirectory) { $('folderMsg').innerHTML = msg('warn', 'Drop the project <b>folder</b>, not a file inside it.'); return; }
    const list = []; await walkEntry(item, '', list);
    try { await loadFolder(item.name, list.map(x => ({ path: x.path.replace(/^\//, ''), file: x.file }))); } catch (err) { $('folderMsg').innerHTML = msg('err', 'The folder couldn&rsquo;t be read: ' + esc(err.message || err)); }
  });
  $('projPick').addEventListener('change', () => { state.choice = $('projPick').value; loadChoice(); });
  $('exInput').addEventListener('input', () => {
    if (state.example) { setExample(false); state.files = null; state.project = null; }
    if (!$('exName').value.trim() && window.SF_SUITE) { const v = SF_SUITE.get(); if (v && v.name && v.text.trim() === $('exInput').value.trim()) $('exName').value = v.name; }
    store.del('blank'); setTab('export'); render(); persist();
  });
  $('exName').addEventListener('input', () => { render(); persist(); });
  $('preset').addEventListener('change', () => { setPreset($('preset').value); render(); persist(); });
  $('opts').addEventListener('change', e => {
    const k = e.target.dataset.opt; if (!k) return;
    state.opts[k] = e.target.checked;
    if (state.preset !== 'Custom') { state.preset = 'Custom'; $('preset').value = 'Custom'; }
    render(); persist();
  });
  $('download').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([state.html], { type: 'text/html' }));
    const a = document.createElement('a'); a.href = url; a.download = state.fileName; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  });
  $('openTab').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([state.html], { type: 'text/html' }));
    const w = window.open(url, '_blank'); if (!w) location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
  $('clearAll').addEventListener('click', () => { resetAll(); store.set('blank', '1'); persist(); });
  document.addEventListener('click', e => { const b = e.target.closest('[data-copy=export]'); if (b) copyText(DAX_QUERY, b); });
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
    resetAll(); store.set('blank', '1'); persist();
    show(false); done.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => { done.hidden = true; }, 6000);
  });
})();
