
/* ---------- Model Compare page ---------- */
const $ = id => document.getElementById(id);
const PREFIX = 'kmc.';
const store = {
  get(k){ try { return localStorage.getItem(PREFIX + k); } catch (e) { return null; } },
  set(k, v){ try { localStorage.setItem(PREFIX + k, v); return true; } catch (e) { return false; } }
};
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function copyText(text, btn){
  const done = () => { const o = btn.dataset.label || btn.textContent; btn.dataset.label = o; btn.textContent = 'Copied'; btn.classList.add('done'); setTimeout(() => { btn.textContent = o; btn.classList.remove('done'); }, 1600); };
  const fallback = () => { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta); if (ok) done(); };
  try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
}
const when = t => { const d = new Date(t); return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); };

const blankCfg = () => ({ src: 'saved', savedAt: null, kind: 'all', house: true, notesHouse: false, notesDax: false, name: '', beforeLabel: '' });
const EX_AT = Date.now() - 3 * 86400000;
const state = { example: false, suite: null, after: null, before: null, res: null, cfg: blankCfg() };

/* ---------- Step 1 ---------- */
function statsHtml(m){ const d = MC.describe(m); return '<span class="stat"><b>' + d.tables + '</b> tables</span><span class="stat"><b>' + d.columns + '</b> columns</span><span class="stat"><b>' + d.measures + '</b> measures</span><span class="stat"><b>' + d.rels + '</b> relationships</span>'; }
function readAfter(){
  const t = $('modelInput').value, m = t.trim() ? MC.parse(t) : null;
  state.after = m && !m.error ? m : null;
  $('afterMsg').innerHTML = m && m.error ? '<div class="msg err">' + esc(m.error) + '</div>' : '';
  $('afterStats').innerHTML = state.after ? statsHtml(state.after) : '';
}

/* ---------- Step 2 ---------- */
function history(){
  if (state.example) return [{ text: MC_EX_BEFORE, name: 'Sales model', savedAt: EX_AT }];
  return state.suite && state.suite.history ? state.suite.history() : [];
}
function candidates(){
  const now = $('modelInput').value.trim();
  return history().filter(h => h.text.trim() !== now).map(h => { const m = MC.parse(h.text); return Object.assign({}, h, { m: m && !m.error ? m : null }); }).filter(h => h.m);
}
function renderBefore(){
  const c = state.cfg;
  document.querySelectorAll('input[name=bsrc]').forEach(i => { i.checked = i.value === c.src; });
  $('pasteBox').hidden = c.src !== 'paste'; $('savedList').hidden = c.src !== 'saved';
  let before = null, label = '';
  if (c.src === 'saved') {
    const list = candidates();
    let pick = list.find(h => h.savedAt === c.savedAt);
    if (!pick) pick = list.find(h => !state.after || MC.overlap(h.m, state.after) >= 0.5) || list[0];
    if (pick) { before = pick.m; label = 'the export saved ' + when(pick.savedAt); c.savedAt = pick.savedAt; }
    $('savedList').innerHTML = list.length
      ? '<div class="hist">' + list.map(h => { const ov = state.after ? MC.overlap(h.m, state.after) : 1, d = MC.describe(h.m);
          return '<label class="hrow' + (h === pick ? ' on' : '') + '"><input type="radio" name="hist" value="' + h.savedAt + '"' + (h === pick ? ' checked' : '') + '><span class="hb"><span class="ht">' + esc(h.name || 'Model export') + ' <span class="muted">&middot; saved ' + esc(when(h.savedAt)) + '</span></span><span class="hs">' + d.tables + ' tables, ' + d.measures + ' measures' + (ov < 0.5 ? ' &middot; <b>looks like a different model</b>' : '') + '</span></span></label>'; }).join('')
        + '</div>' + (state.example ? '' : '<p class="note small"><button type="button" class="linkbtn" id="forget">Remove the earlier exports the toolkit keeps</button></p>')
      : '<div class="msg info">No earlier export is kept yet. From now on, each time you save a new export on the <a href="index.html">home page</a> or paste one into any tool, the one it replaces is kept here (up to five). For now, choose <b>Paste or open a file</b>.</div>';
  } else {
    const t = $('beforeInput').value, m = t.trim() ? MC.parse(t) : null;
    before = m && !m.error ? m : null; label = c.beforeLabel || 'the earlier export';
    $('beforeMsg').innerHTML = m && m.error ? '<div class="msg err">' + esc(m.error) + '</div>' : '';
  }
  state.before = before; state.beforeLabel = label;
  $('beforeStats').innerHTML = before && c.src === 'paste' ? statsHtml(before) : '';
  if (c.src === 'saved') $('beforeMsg').innerHTML = '';
  if (before && state.after && MC.overlap(before, state.after) < 0.5) $('beforeMsg').innerHTML = '<div class="msg warn">These two exports share few table names. They may be from different models; check you&rsquo;re comparing the same one.</div>';
}

/* ---------- Step 3 ---------- */
const TYPE_LABEL = { added: 'Added', removed: 'Removed', renamed: 'Renamed', changed: 'Changed' };
const IMP_LABEL = { attention: 'Check reports', change: 'Change', house: 'Housekeeping' };
function run(){ state.res = state.before && state.after ? MC.compare(state.before, state.after) : null; }
function renderSummary(){
  const r = state.res;
  if (!r) { $('sumBar').innerHTML = ''; $('filters').innerHTML = ''; $('changes').innerHTML = '<p class="muted">' + (!state.after ? 'Paste the current model export in Step 1.' : 'Choose the earlier export in Step 2.') + '</p>'; return false; }
  const n = k => r.changes.filter(c => c.imp === k).length;
  $('sumBar').innerHTML = r.changes.length
    ? '<div class="sum-txt"><b>' + r.changes.length + '</b> change' + (r.changes.length === 1 ? '' : 's') + ': <span class="imp attention">' + n('attention') + ' check reports</span> <span class="imp change">' + n('change') + ' change' + (n('change') === 1 ? '' : 's') + '</span> <span class="imp house">' + n('house') + ' housekeeping</span></div><div class="muted small">' + esc(MC.summaryText(r.summary)) + '</div>'
    : '<div class="sum-txt"><b class="okc">&#10003; No changes</b> to tables, columns, measures or relationships.</div>';
  const kinds = [['all', 'All'], ['table', 'Tables'], ['column', 'Columns'], ['measure', 'Measures'], ['relationship', 'Relationships'], ['model', 'Model']].filter(([k]) => k === 'all' || r.changes.some(c => c.kind === k));
  $('filters').innerHTML = r.changes.length ? '<div class="chips" role="group" aria-label="Show">' + kinds.map(([k, l]) => '<button type="button" class="chip" data-kind="' + k + '" aria-pressed="' + (state.cfg.kind === k) + '">' + l + (k === 'all' ? '' : ' <small>' + r.changes.filter(c => c.kind === k).length + '</small>') + '</button>').join('') + '</div><label class="opts"><span><input type="checkbox" id="showHouse"' + (state.cfg.house ? ' checked' : '') + '> Show housekeeping</span></label>' : '';
  return true;
}
function renderChanges(){
  if (!renderSummary()) return;
  const r = state.res, c = state.cfg;
  const list = r.changes.filter(x => (c.kind === 'all' || x.kind === c.kind) && (c.house || x.imp !== 'house'));
  if (!r.changes.length) { $('changes').innerHTML = ''; return; }
  $('changes').innerHTML = ['attention', 'change', 'house'].map(imp => {
    const g = list.filter(x => x.imp === imp); if (!g.length) return '';
    return '<section class="cgrp"><h3><span class="imp ' + imp + '">' + IMP_LABEL[imp] + '</span> <span class="muted small">' + g.length + '</span></h3>' + g.map(card).join('') + '</section>';
  }).join('') || '<p class="muted">Nothing to show with these filters.</p>';
}
function card(x){
  const was = x.type === 'renamed' ? ' <span class="muted">' + (x.probable ? 'probably renamed from' : 'was') + ' <span class="mono">' + esc(x.kind === 'table' ? "'" + x.before.name + "'" : '[' + x.before.name + ']') + '</span></span>' : '';
  let h = '<div class="chg"><div class="chg-head"><span class="ctype t-' + x.type + '">' + TYPE_LABEL[x.type] + '</span><span class="kindtag">' + MC.KIND_LABEL[x.kind] + '</span><span class="mono lbl">' + esc(x.label) + '</span>' + was + '</div>';
  const w = x.imp === 'attention' ? MC.why(x) : '';
  if (w) h += '<p class="why">' + esc(w) + (x.probable ? ' Matched by position and data type only: check it really is the same column.' : '') + '</p>';
  const props = (x.diffs || []).filter(d => !d.code);
  if (props.length) h += '<div class="tablewrap"><table class="pd"><thead><tr><th>Property</th><th>Before</th><th>After</th></tr></thead><tbody>' + props.map(d => '<tr><td>' + esc(d.label) + '</td>' + (d.note ? '<td colspan="2" class="muted">' + esc(d.note) + '</td>' : '<td>' + val(d, d.before) + '</td><td><b>' + val(d, d.after) + '</b></td>') + '</tr>').join('') + '</tbody></table></div>';
  (x.diffs || []).filter(d => d.code).forEach(d => { h += '<div class="dax"><div class="dax-h">' + esc(d.label) + '</div>' + diffHtml(d.before, d.after) + '</div>'; });
  if (x.type === 'added' && x.obj.expression) h += '<details class="daxd"><summary>Show the DAX</summary><pre>' + esc(x.obj.expression) + '</pre></details>';
  if (x.type === 'removed' && x.obj.expression) h += '<details class="daxd"><summary>Show the DAX it had</summary><pre>' + esc(x.obj.expression) + '</pre></details>';
  return h + '</div>';
}
function val(d, v){ const s = MC.fmtVal(d, v); return s.length > 140 ? '<span class="long">' + esc(s) + '</span>' : esc(s); }
function diffHtml(a, b){
  const rows = MC.diffLines(a, b), out = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.t === 'same') { out.push('<div class="dl s"><span class="g"> </span>' + esc(r.b) + '</div>'); continue; }
    // pair a run of removed lines with the added lines after it, for word highlights
    const dels = [], adds = [];
    while (i < rows.length && rows[i].t === 'del') dels.push(rows[i++].a);
    while (i < rows.length && rows[i].t === 'add') adds.push(rows[i++].b);
    i--;
    dels.forEach((l, k) => { if (adds[k] != null) { const w = MC.diffWords(l, adds[k]); out.push('<div class="dl d"><span class="g">&minus;</span>' + w.a.map(([t, ch]) => ch ? '<mark>' + esc(t) + '</mark>' : esc(t)).join('') + '</div>'); } else out.push('<div class="dl d"><span class="g">&minus;</span>' + esc(l) + '</div>'); });
    adds.forEach((l, k) => { if (dels[k] != null) { const w = MC.diffWords(dels[k], l); out.push('<div class="dl a"><span class="g">+</span>' + w.b.map(([t, ch]) => ch ? '<mark>' + esc(t) + '</mark>' : esc(t)).join('') + '</div>'); } else out.push('<div class="dl a"><span class="g">+</span>' + esc(l) + '</div>'); });
  }
  return '<div class="diff" role="group" aria-label="DAX before and after: lines marked minus were removed, plus were added">' + out.join('') + '</div>';
}

/* ---------- Step 4 ---------- */
function info(){ return { name: $('notesName').value.trim(), before: state.beforeLabel, after: 'the current export' }; }
function renderNotes(){
  const c = state.cfg;
  $('notesName').value = c.name; $('optHouse').checked = c.notesHouse; $('optDax').checked = c.notesDax;
  $('notesView').textContent = state.res ? MC.markdown(state.res, info(), { house: c.notesHouse, dax: c.notesDax }) : '';
  ['copyText', 'copyTsv', 'copyMd'].forEach(id => { $(id).disabled = !state.res; });
}

function renderAll(){ readAfter(); renderBefore(); run(); renderChanges(); renderNotes(); }

/* ---------- persistence ---------- */
function persist(){
  if (state.example) { store.set('model', ''); store.set('before', ''); store.set('cfg', ''); return; }
  store.set('model', $('modelInput').value); store.set('before', $('beforeInput').value); store.set('cfg', JSON.stringify(state.cfg));
}
function setExample(on){ state.example = on; $('exampleBanner').hidden = !on; }
function leaveExample(){ if (!state.example) return; setExample(false); $('beforeInput').value = ''; const keepName = state.cfg; state.cfg = blankCfg(); void keepName; }

/* ---------- init ---------- */
function resetAll(){ $('modelInput').value = ''; $('beforeInput').value = ''; state.cfg = blankCfg(); setExample(false); $('modelBox').open = false; renderAll(); }
function download(name, text){
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function init(){
  $('exportView').textContent = DAX_QUERY;
  let cfg = null; try { cfg = JSON.parse(store.get('cfg') || 'null'); } catch (e) {}
  const saved = store.get('model');
  if ((saved && saved.trim()) || cfg) { $('modelInput').value = saved || ''; $('beforeInput').value = store.get('before') || ''; if (cfg) state.cfg = Object.assign(blankCfg(), cfg); }
  else if (store.get('blank') !== '1') { $('modelInput').value = MC_EX_AFTER; state.cfg.name = 'Sales model'; setExample(true); }
  renderAll();

  $('modelInput').addEventListener('input', () => {
    if (state.example) { const v = $('modelInput').value; leaveExample(); $('modelInput').value = v; }
    try { localStorage.removeItem(PREFIX + 'blank'); } catch (e) {}
    state.cfg.savedAt = null; renderAll(); persist();
    setTimeout(() => { renderBefore(); run(); renderChanges(); renderNotes(); }, 0); // the toolkit keeps the replaced export after this handler
  });
  $('beforeInput').addEventListener('input', () => { leaveExample(); state.cfg.src = 'paste'; state.cfg.beforeLabel = ''; renderAll(); persist(); });
  document.querySelectorAll('input[name=bsrc]').forEach(i => i.addEventListener('change', () => { state.cfg.src = i.value; renderAll(); persist(); }));
  $('savedList').addEventListener('change', e => { if (e.target.name === 'hist') { state.cfg.savedAt = +e.target.value; renderAll(); persist(); } });
  $('openBefore').addEventListener('click', () => $('beforeFile').click());
  $('beforeFile').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    const t = (await f.text()).replace(/^﻿/, '');
    leaveExample(); $('beforeInput').value = t; state.cfg.src = 'paste'; state.cfg.beforeLabel = f.name; e.target.value = '';
    renderAll(); persist();
  });
  $('saveFile').addEventListener('click', () => {
    const t = $('modelInput').value.trim(); if (!t) { $('beforeMsg').innerHTML = '<div class="msg info">Paste the current model export in Step 1 first.</div>'; return; }
    const d = new Date(), stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    download(((($('notesName').value.trim() || 'Model export') + ' ' + stamp).replace(/[\\/:*?"<>|]+/g, '-')) + '.txt', t + '\n');
  });
  $('filters').addEventListener('click', e => { const b = e.target.closest('[data-kind]'); if (!b) return; state.cfg.kind = b.dataset.kind; renderChanges(); persist(); });
  $('filters').addEventListener('change', e => { if (e.target.id === 'showHouse') { state.cfg.house = e.target.checked; renderChanges(); persist(); } });
  $('notesName').addEventListener('input', () => { state.cfg.name = $('notesName').value; renderNotes(); persist(); });
  $('optHouse').addEventListener('change', () => { state.cfg.notesHouse = $('optHouse').checked; renderNotes(); persist(); });
  $('optDax').addEventListener('change', () => { state.cfg.notesDax = $('optDax').checked; renderNotes(); persist(); });
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.copy === 'export') { copyText(DAX_QUERY, b); return; }
    if (b.id === 'forget' && state.suite) { state.suite.clearHistory(); state.cfg.savedAt = null; renderAll(); return; }
    if (!state.res) return;
    const o = { house: state.cfg.notesHouse, dax: state.cfg.notesDax };
    if (b.id === 'copyMd') copyText(MC.markdown(state.res, info(), o), b);
    else if (b.id === 'copyText') copyText(MC.plain(state.res, info(), o), b);
    else if (b.id === 'copyTsv') copyText(MC.tsv(state.res), b);
  });
  $('clearAll').addEventListener('click', () => { resetAll(); try { localStorage.setItem(PREFIX + 'blank', '1'); } catch (e) {} persist(); $('modelInput').focus(); });
}
init();
// the toolkit's shared storage (suite.js runs after this script and calls this)
window.mcSuite = S => { state.suite = S; renderBefore(); run(); renderChanges(); renderNotes(); };

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
