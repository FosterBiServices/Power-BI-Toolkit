
/* ---------- Field Parameter Builder page ---------- */
const $ = id => document.getElementById(id);
const PREFIX = 'kfp.';
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
      .replace(/\b(createOrReplace|table|column|measure|partition|EVALUATE|SELECTCOLUMNS|SWITCH|SELECTEDVALUE|NAMEOF|VAR|RETURN|BLANK|SELECTEDMEASUREFORMATSTRING|formatStringDefinition|extendedProperty|relatedColumnDetails)\b/g, '<span class="tok-kw">$1</span>');
  }).join('\n');
}

const blankCfg = () => ({ type: 'field', table: 'Measure Selector', measureName: 'Selected Measure', folder: '', fallback: 'first', dynFormat: true, groupOn: false, groupName: 'Group', items: [] });
const state = { example: false, model: null, cfg: blankCfg(), kindFilter: 'measure', out: {} };

function persist(){
  store.set('model', state.example ? '' : $('modelInput').value);
  store.set('cfg', JSON.stringify(state.example ? blankCfg() : state.cfg));
  store.set('filter', state.kindFilter);
}
function setExample(on){ state.example = on; $('exampleBanner').hidden = !on; }
function leaveExample(){ if (state.example) { setExample(false); } }

/* ---------- render ---------- */
function renderModel(){
  const text = $('modelInput').value;
  const m = text.trim() ? parseModel(text) : null;
  state.model = m && !m.error ? m : null;
  $('modelMsg').innerHTML = m && m.error ? '<div class="msg err">' + esc(m.error) + '</div>' : '';
  $('modelStats').innerHTML = state.model ? '<span class="stat"><b>' + state.model.measures.length + '</b> measures</span><span class="stat"><b>' + state.model.columns.filter(c => !c.hidden).length + '</b> visible columns</span><span class="stat"><b>' + state.model.tables.length + '</b> tables</span>' : '';
}
function renderType(){
  const c = state.cfg, sw = c.type === 'switch';
  $('destTable').textContent = (c.table || '').trim() ? qName(c.table.trim()) : '(name it in Step 2)';
  const fs = new Set(); (state.model ? state.model.measures : []).forEach(x => { const f = normFolder(x.folder || ''); if (!f) return; const p = f.split('\\'); for (let i = 1; i <= p.length; i++) fs.add(p.slice(0, i).join('\\')); });
  $('destFolders').innerHTML = [...fs].sort((a, b) => a.localeCompare(b)).map(f => '<option value="' + esc(f) + '"></option>').join('');
  $('typeField').setAttribute('aria-checked', !sw); $('typeSwitch').setAttribute('aria-checked', sw);
  document.querySelectorAll('.only-switch').forEach(el => { el.hidden = !sw; });
  $('kindFilter').disabled = sw; if (sw) $('kindFilter').value = 'measure'; else $('kindFilter').value = state.kindFilter;
  $('groupNameWrap').hidden = !c.groupOn;
  $('typeNote').innerHTML = sw
    ? 'The table holds the labels for the slicer; the measure reads the pick with SELECTEDVALUE and returns the matching measure. Put <b>' + esc(fpNames(c).display || 'the label column') + '</b> in a slicer and <b>' + esc((c.measureName || '').trim() || 'the measure') + '</b> in the visual.'
    : 'Power BI recognises the table as a field parameter from a setting in the script. Put <b>' + esc(fpNames(c).display || 'the first column') + '</b> in a slicer <i>and</i> in the visual in place of the measure.';
}
function availItems(){
  const m = state.model; if (!m) return [];
  const f = state.cfg.type === 'switch' ? 'measure' : state.kindFilter;
  const q = lc($('search').value.trim());
  const out = [];
  if (f !== 'column') m.measures.forEach(x => out.push({ kind: 'measure', table: x.table, name: x.name, meta: [x.table, x.folder, x.formatString].filter(Boolean).join(' · '), hidden: x.hidden }));
  if (f !== 'measure') m.columns.filter(c => !c.hidden && !/^RowNumber/.test(c.name) && lc(c.table) !== lc(state.cfg.table)).forEach(x => out.push({ kind: 'column', table: x.table, name: x.name, meta: x.table + ' · ' + (x.dataType || 'column') }));
  return out.filter(x => !q || lc(x.name).includes(q) || lc(x.meta).includes(q));
}
const inSel = x => state.cfg.items.some(i => i.kind === x.kind && lc(i.table) === lc(x.table) && lc(i.name) === lc(x.name));
function renderAvail(){
  if (!state.model) { $('avail').innerHTML = '<p class="note small" style="padding:10px 12px">Fields appear here after Step 1.</p>'; return; }
  const list = availItems();
  $('avail').innerHTML = list.length ? list.map((x, i) => '<button type="button" class="mrow2' + (inSel(x) ? ' added' : '') + '" data-i="' + i + '" role="listitem"><span class="kind ' + x.kind + '">' + (x.kind === 'measure' ? 'M' : 'C') + '</span><span class="mname">' + esc(x.name) + '</span><span class="mmeta">' + esc(x.meta) + (x.hidden ? ' · hidden' : '') + '</span><span class="add">' + (inSel(x) ? '&#10003; added' : '+ Add') + '</span></button>').join('')
    : '<p class="note small" style="padding:10px 12px">No fields match.</p>';
  state.availList = list;
}
function renderSel(){
  const c = state.cfg, items = state.model ? fpItemsInModel(state.model, c) : c.items.map(i => Object.assign({ found: true }, i));
  $('selCount').textContent = c.items.length ? '(' + c.items.length + ')' : '';
  $('selEmpty').hidden = !!c.items.length;
  $('sel').innerHTML = items.map((it, i) => '<li class="srow' + (it.found ? '' : ' missing') + '" data-i="' + i + '">'
    + '<span class="ord">' + i + '</span>'
    + '<div class="sbody"><div class="sref"><span class="kind ' + it.kind + '">' + (it.kind === 'measure' ? 'M' : 'C') + '</span> <span class="mono">' + esc(it.kind === 'measure' ? bracket(it.name) : qName(it.table) + bracket(it.name)) + '</span>' + (it.found ? '' : ' <span class="pill err">not in export</span>') + '</div>'
    + '<div class="sin"><label><span class="sr">Label</span><input type="text" data-f="label" value="' + esc(it.label || '') + '" placeholder="' + esc(it.name) + '" aria-label="Label for ' + esc(it.name) + '"></label>'
    + (c.groupOn ? '<label><span class="sr">Group</span><input type="text" data-f="group" value="' + esc(it.group || '') + '" placeholder="' + esc(c.groupName || 'Group') + '" aria-label="Group for ' + esc(it.name) + '"></label>' : '') + '</div></div>'
    + '<span class="sbtns"><button type="button" class="ib" data-act="up" aria-label="Move up"' + (i ? '' : ' disabled') + '>&#8593;</button><button type="button" class="ib" data-act="down" aria-label="Move down"' + (i < items.length - 1 ? '' : ' disabled') + '>&#8595;</button><button type="button" class="ib" data-act="rm" aria-label="Remove">&#10005;</button></span></li>').join('');
}
function renderOut(){
  const c = state.cfg, m = state.model;
  if (!m) { $('checks').innerHTML = '<div class="msg info">Paste your model export in Step 1.</div>'; $('outBox').hidden = true; state.out = {}; return; }
  const checks = fpCheck(m, c), errs = checks.filter(x => x.level === 'err');
  $('checks').innerHTML = checks.map(x => '<div class="msg ' + x.level + '">' + esc(x.text) + '</div>').join('') || '<div class="msg ok">&#10003; Every name checks out against the export.</div>';
  $('outBox').hidden = !!errs.length;
  if (errs.length) { state.out = {}; return; }
  state.out.tmdl = fpTmdl(m, c); state.out.test = fpTestQuery(m, c);
  $('tmdlView').innerHTML = hl(state.out.tmdl); $('testView').innerHTML = hl(state.out.test);
  $('tmdlTitle').textContent = 'TMDL script: ' + (c.type === 'switch' ? 'SWITCH measure and selector table' : 'field parameter');
  const n = fpNames(c);
  $('applySteps').innerHTML = [
    'In Power BI Desktop, open <b>TMDL view</b>, paste the script into a new tab and select <b>Preview</b>. It should show one new table' + (c.type === 'switch' ? ' with one measure' : '') + ' and nothing else changing.',
    'Select <b>Apply</b>. The table is calculated, so it&rsquo;s ready straight away; no refresh of your data is needed.',
    c.type === 'switch'
      ? 'Add <b>' + esc(n.display) + '</b> to a slicer (single select) and <b>' + esc(c.measureName.trim()) + '</b> to your visual. ' + (c.dynFormat ? 'The measure takes the format of whichever measure is picked.' : '')
      : 'Add <b>' + esc(n.display) + '</b> to a slicer, and to the visual in place of a ' + (c.items.some(i => i.kind === 'column') && !c.items.some(i => i.kind === 'measure') ? 'column' : 'measure') + '. The visual switches with the slicer.',
    'To change the options later, come back here, adjust them and apply the new script: it replaces the table.'
  ].map(s => '<li>' + s + '</li>').join('');
}
function renderAll(){ renderModel(); renderType(); syncInputs(); renderAvail(); renderSel(); renderOut(); }
function syncInputs(){
  const c = state.cfg;
  if (document.activeElement !== $('tName')) $('tName').value = c.table;
  if (document.activeElement !== $('mName')) $('mName').value = c.measureName;
  if (document.activeElement !== $('mFolder')) $('mFolder').value = c.folder;
  if (document.activeElement !== $('groupName')) $('groupName').value = c.groupName;
  $('fallback').value = c.fallback; $('dynFormat').checked = c.dynFormat; $('groupOn').checked = c.groupOn;
}

/* ---------- init ---------- */
function resetAll(){
  $('modelInput').value = ''; $('search').value = '';
  state.cfg = blankCfg(); state.kindFilter = 'measure'; setExample(false); $('modelBox').open = false;
  renderAll();
}
function init(){
  $('exportView').textContent = DAX_QUERY;
  const saved = store.get('model');
  let cfg = null; try { cfg = JSON.parse(store.get('cfg') || 'null'); } catch (e) {}
  state.kindFilter = store.get('filter') || 'measure';
  if (saved && saved.trim()) { $('modelInput').value = saved; if (cfg) state.cfg = Object.assign(blankCfg(), cfg); }
  else if (store.get('blank') !== '1') { $('modelInput').value = FP_EX_MODEL; state.cfg = Object.assign(blankCfg(), { groupOn: true, items: FP_EX_ITEMS.map(x => Object.assign({}, x)) }); setExample(true); }
  else if (cfg) state.cfg = Object.assign(blankCfg(), cfg);
  renderAll();

  const change = () => { leaveExample(); renderAll(); persist(); };
  $('modelInput').addEventListener('input', () => {
    if (state.example) { state.cfg.items = []; state.cfg.groupOn = false; setExample(false); }
    try { localStorage.removeItem(PREFIX + 'blank'); } catch (e) {}
    renderAll(); persist();
  });
  $('typeField').addEventListener('click', () => { state.cfg.type = 'field'; change(); });
  $('typeSwitch').addEventListener('click', () => { state.cfg.type = 'switch'; change(); });
  [['tName', 'table'], ['mName', 'measureName'], ['mFolder', 'folder'], ['groupName', 'groupName']].forEach(([id, k]) => $(id).addEventListener('input', () => { state.cfg[k] = $(id).value; leaveExample(); renderType(); renderSel(); renderOut(); persist(); }));
  $('fallback').addEventListener('change', () => { state.cfg.fallback = $('fallback').value; change(); });
  $('dynFormat').addEventListener('change', () => { state.cfg.dynFormat = $('dynFormat').checked; change(); });
  $('groupOn').addEventListener('change', () => { state.cfg.groupOn = $('groupOn').checked; change(); });
  $('search').addEventListener('input', renderAvail);
  $('kindFilter').addEventListener('change', () => { state.kindFilter = $('kindFilter').value; renderAvail(); persist(); });
  const addItem = x => { if (!inSel(x)) state.cfg.items.push({ kind: x.kind, table: x.table, name: x.name, label: x.name, group: '' }); };
  $('avail').addEventListener('click', e => {
    const b = e.target.closest('[data-i]'); if (!b) return;
    const x = state.availList[+b.dataset.i]; if (!x) return;
    if (inSel(x)) state.cfg.items = state.cfg.items.filter(i => !(i.kind === x.kind && lc(i.table) === lc(x.table) && lc(i.name) === lc(x.name)));
    else addItem(x);
    change();
  });
  $('addShown').addEventListener('click', () => { (state.availList || []).forEach(addItem); change(); });
  $('clearSel').addEventListener('click', () => { state.cfg.items = []; change(); });
  $('sel').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const i = +b.closest('[data-i]').dataset.i, a = state.cfg.items;
    if (b.dataset.act === 'rm') a.splice(i, 1);
    if (b.dataset.act === 'up' && i > 0) [a[i - 1], a[i]] = [a[i], a[i - 1]];
    if (b.dataset.act === 'down' && i < a.length - 1) [a[i + 1], a[i]] = [a[i], a[i + 1]];
    change();
    const row = $('sel').querySelector('[data-i="' + (b.dataset.act === 'up' ? i - 1 : b.dataset.act === 'down' ? i + 1 : i) + '"] [data-act="' + b.dataset.act + '"]'); if (row && !row.disabled) row.focus();
  });
  $('sel').addEventListener('input', e => {
    const f = e.target.dataset.f; if (!f) return;
    state.cfg.items[+e.target.closest('[data-i]').dataset.i][f] = e.target.value;
    leaveExample(); renderOut(); persist();
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
