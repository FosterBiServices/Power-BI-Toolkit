
/* ---------- RLS Role Generator page ---------- */
const $ = id => document.getElementById(id);
const PREFIX = 'krl.';
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
      .replace(/\b(createOrReplace|role|modelPermission|tablePermission|DEFINE|VAR|EVALUATE|UNION|ROW|CALCULATE|CALCULATETABLE|COUNTROWS|FILTER|ALL|VALUES|IN|NOT|USERPRINCIPALNAME|DATE|TRUE|FALSE)\b/g, '<span class="tok-kw">$1</span>');
  }).join('\n');
}

const blankCfg = () => ({ roles: [{ name: '', rules: [] }], testUser: '' });
const state = { example: false, model: null, cfg: blankCfg(), out: {} };

function persist(){
  store.set('model', state.example ? '' : $('modelInput').value);
  store.set('cfg', JSON.stringify(state.example ? blankCfg() : state.cfg));
}
function setExample(on){ state.example = on; $('exampleBanner').hidden = !on; }
function leaveExample(){ if (state.example) setExample(false); }

/* ---------- model ---------- */
function renderModel(){
  const text = $('modelInput').value;
  const m = text.trim() ? parseModel(text) : null;
  state.model = m && !m.error ? m : null;
  $('modelMsg').innerHTML = m && m.error ? '<div class="msg err">' + esc(m.error) + '</div>' : (!m ? '<div class="msg info">Without a model export you can still type table and column names, but the page can&rsquo;t check them or tell which tables each role reaches.</div>' : '');
  $('modelStats').innerHTML = state.model ? '<span class="stat"><b>' + state.model.tables.length + '</b> tables</span><span class="stat"><b>' + state.model.columns.length + '</b> columns</span><span class="stat"><b>' + state.model.rels.length + '</b> relationships</span>' : '';
  renderLists();
}
// datalists: tables, and the columns of each table
function renderLists(){
  const m = state.model; let h = '<datalist id="dlTables">' + (m ? m.tables.map(t => '<option value="' + esc(t.name) + '"></option>').join('') : '') + '</datalist>';
  if (m) m.tables.forEach((t, i) => { h += '<datalist id="dlc' + i + '">' + m.columns.filter(c => lc(c.table) === lc(t.name)).map(c => '<option value="' + esc(c.name) + '">' + esc(c.dataType || '') + '</option>').join('') + '</datalist>'; });
  $('lists').innerHTML = h;
}
function colList(table){ const m = state.model; if (!m) return ''; const i = m.tables.findIndex(t => lc(t.name) === lc(table || '')); return i < 0 ? '' : 'dlc' + i; }

/* ---------- roles form ---------- */
function inp(ri, ki, f, v, label, list, ph){
  return '<div class="field"><label>' + label + '</label><input type="text" data-r="' + ri + '" data-k="' + ki + '" data-f="' + f + '" value="' + esc(v || '') + '"' + (list ? ' list="' + list + '"' : '') + ' spellcheck="false" autocomplete="off"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '></div>';
}
function ruleHtml(r, ri, ki){
  const T = RLS.RULE_TYPES[r.type] || r.type;
  let body = '';
  if (r.type === 'values') {
    body = '<div class="rrow">' + inp(ri, ki, 'table', r.table, 'Table', 'dlTables') + inp(ri, ki, 'column', r.column, 'Column', colList(r.table))
      + '<div class="field"><label>Rows where the column</label><select data-r="' + ri + '" data-k="' + ki + '" data-f="op"><option value="in"' + (r.op !== 'notin' ? ' selected' : '') + '>is one of</option><option value="notin"' + (r.op === 'notin' ? ' selected' : '') + '>is not one of</option></select></div></div>'
      + '<div class="field"><label>Values <span class="muted">(one per line; dates as YYYY-MM-DD)</span></label><textarea class="vals" data-r="' + ri + '" data-k="' + ki + '" data-f="values" spellcheck="false">' + esc(r.values || '') + '</textarea></div>'
      + (r.table && r.column ? '<div><button type="button" class="linkbtn" data-vq="' + ri + ':' + ki + '">Copy a query that lists this column&rsquo;s values</button></div>' : '');
  } else if (r.type === 'user') {
    body = '<p class="note small">People see the rows where this column holds their sign-in email.</p><div class="rrow">' + inp(ri, ki, 'table', r.table, 'Table', 'dlTables') + inp(ri, ki, 'column', r.column, 'Email column', colList(r.table)) + '</div>';
  } else if (r.type === 'access') {
    body = '<div class="rrow">' + inp(ri, ki, 'accessTable', r.accessTable, 'Access table', 'dlTables') + inp(ri, ki, 'emailCol', r.emailCol, 'Its email column', colList(r.accessTable)) + inp(ri, ki, 'keyCol', r.keyCol, 'Its key column <span class="muted">(what they may see)</span>', colList(r.accessTable)) + '</div>'
      + '<div class="rrow">' + inp(ri, ki, 'table', r.table, 'Filters the table', 'dlTables') + inp(ri, ki, 'column', r.column, 'Where this column matches the key', colList(r.table)) + '</div>'
      + '<label class="chk"><input type="checkbox" data-r="' + ri + '" data-k="' + ki + '" data-f="secure"' + (r.secure ? ' checked' : '') + '> Also secure the access table, so each person sees only their own rows of it</label>';
  } else {
    body = '<div class="rrow">' + inp(ri, ki, 'table', r.table, 'Table', 'dlTables') + '</div><div class="field"><label>Filter <span class="muted">(TRUE for rows to keep)</span></label><textarea class="dax" data-r="' + ri + '" data-k="' + ki + '" data-f="expr" spellcheck="false" placeholder="\'Customer\'[Segment] <> &quot;Corporate&quot;">' + esc(r.expr || '') + '</textarea></div>';
  }
  return '<li class="rule" data-rule="' + ri + ':' + ki + '"><div class="rule-head"><span class="rn">' + (ki + 1) + '</span><span class="rt">' + esc(T) + '</span><button type="button" class="ib" data-rmrule="' + ri + ':' + ki + '" aria-label="Remove rule ' + (ki + 1) + '">&#10005;</button></div>' + body + '</li>';
}
function renderRoles(){
  const roles = state.cfg.roles;
  $('roles').innerHTML = roles.map((role, ri) =>
    '<div class="role" data-role="' + ri + '"><div class="role-head"><div class="field grow"><label for="rn' + ri + '">Role name</label><input type="text" id="rn' + ri + '" data-r="' + ri + '" data-f="name" value="' + esc(role.name || '') + '" placeholder="West Region" autocomplete="off"></div>'
    + '<span class="btns"><button type="button" class="btn small" data-dup="' + ri + '">Duplicate</button>' + (roles.length > 1 ? '<button type="button" class="btn small" data-rmrole="' + ri + '">Remove role</button>' : '') + '</span></div>'
    + '<ol class="rules">' + (role.rules || []).map((r, ki) => ruleHtml(r, ri, ki)).join('') + '</ol>'
    + '<div class="addrule"><span class="muted small">Add a rule:</span>' + Object.entries(RLS.RULE_TYPES).map(([k, v]) => '<button type="button" class="btn small" data-add="' + ri + ':' + k + '">' + esc(v) + '</button>').join('') + '</div>'
    + '<div class="reach" id="reach' + ri + '"></div><div class="rchecks" id="rchk' + ri + '"></div></div>').join('');
}

/* ---------- per-role summary, checks and output ---------- */
function renderStatus(){
  const m = state.model, roles = state.cfg.roles;
  let errs = 0;
  roles.forEach((role, ri) => {
    const comp = RLS.compileRole(role, m), checks = RLS.roleChecks(role, comp, m, roles);
    errs += checks.filter(c => c.level === 'err').length;
    let reach = '';
    if (m && comp.filters.length && !checks.some(c => c.level === 'err')) {
      const r = RLS.reach(m, comp.filters), tabs = RLS.dataTables(m);
      const chip = (t, cls, title) => '<span class="tchip ' + cls + '" title="' + esc(title) + '">' + esc(t) + '</span>';
      const direct = tabs.filter(t => (r.get(lc(t.name)) || {}).how === 'direct'), via = tabs.filter(t => (r.get(lc(t.name)) || {}).how === 'via'), open = tabs.filter(t => !r.has(lc(t.name)) || r.get(lc(t.name)).how === 'maybe');
      reach = '<div class="reach-in"><span class="rl">Restricts</span>' + direct.map(t => chip(t.name, 'd', 'Filtered by a rule')).join('') + via.map(t => { const x = r.get(lc(t.name)); return chip(t.name, 'v', 'Through ' + x.via); }).join('')
        + (open.length ? '<span class="rl">Sees all rows of</span>' + open.map(t => chip(t.name, 'o', (r.get(lc(t.name)) || {}).how === 'maybe' ? 'Only through a bidirectional relationship' : 'No relationship carries the filter here')).join('') : '') + '</div>';
    } else if (!(role.rules || []).length) reach = '<div class="reach-in"><span class="rl">Full access:</span> <span class="muted small">sees every row of every table</span></div>';
    const re = $('reach' + ri), ce = $('rchk' + ri);
    if (re) re.innerHTML = reach;
    if (ce) ce.innerHTML = checks.map(c => '<div class="msg ' + c.level + '">' + esc(c.text) + '</div>').join('');
  });
  // output
  const named = roles.filter(r => (r.name || '').trim());
  if (errs || !named.length) {
    $('outBox').hidden = true; state.out = {};
    $('outMsg').innerHTML = '<div class="msg ' + (errs ? 'err' : 'info') + '">' + (errs ? 'Fix the problems marked in Step 2 and the script appears here.' : 'Name a role in Step 2 to get the script.') + '</div>';
    return;
  }
  $('outMsg').innerHTML = named.length < roles.length ? '<div class="msg info">Roles without a name are left out.</div>' : '';
  $('outBox').hidden = false;
  state.out.tmdl = RLS.tmdl(named, m);
  state.out.test = m ? RLS.testQuery(named, m, state.cfg.testUser) : '';
  $('tmdlView').innerHTML = hl(state.out.tmdl);
  $('testView').innerHTML = m ? hl(state.out.test) : '<span class="muted">Paste a model export in Step 1 for the test query.</span>';
  if (document.activeElement !== $('testUser')) $('testUser').value = state.cfg.testUser || '';
}
function renderAll(){ renderModel(); renderRoles(); renderStatus(); }

/* ---------- init ---------- */
function resetAll(){ $('modelInput').value = ''; state.cfg = blankCfg(); setExample(false); $('modelBox').open = false; renderAll(); }
function ruleAt(key){ const [ri, ki] = key.split(':').map(Number); return { ri, ki, r: state.cfg.roles[ri].rules[ki] }; }
function init(){
  $('exportView').textContent = DAX_QUERY;
  const saved = store.get('model');
  let cfg = null; try { cfg = JSON.parse(store.get('cfg') || 'null'); } catch (e) {}
  if (saved && saved.trim()) { $('modelInput').value = saved; if (cfg) state.cfg = Object.assign(blankCfg(), cfg); }
  else if (store.get('blank') !== '1') { $('modelInput').value = RLS_EX_MODEL; state.cfg = { roles: JSON.parse(JSON.stringify(RLS_EX_ROLES)), testUser: 'ana@contoso.com' }; setExample(true); }
  else if (cfg) state.cfg = Object.assign(blankCfg(), cfg);
  if (!state.cfg.roles || !state.cfg.roles.length) state.cfg.roles = blankCfg().roles;
  renderAll();

  const changed = full => { leaveExample(); try { localStorage.removeItem(PREFIX + 'blank'); } catch (e) {} if (full) renderRoles(); renderStatus(); persist(); };
  $('modelInput').addEventListener('input', () => {
    if (state.example) { state.cfg = blankCfg(); setExample(false); }
    try { localStorage.removeItem(PREFIX + 'blank'); } catch (e) {}
    renderAll(); persist();
  });
  // typing: update values in place (focus stays); leaving a table box: re-render so the column list follows
  $('roles').addEventListener('input', e => {
    const t = e.target, f = t.dataset.f; if (!f) return;
    const role = state.cfg.roles[+t.dataset.r];
    if (f === 'name') role.name = t.value;
    else { const r = role.rules[+t.dataset.k]; r[f] = t.type === 'checkbox' ? t.checked : t.value; }
    changed(false);
  });
  $('roles').addEventListener('change', e => {
    const f = e.target.dataset.f;
    if (f === 'table' || f === 'accessTable') { const k = e.target.dataset.r + ':' + e.target.dataset.k; renderRoles(); renderStatus(); const next = document.querySelector('[data-rule="' + k + '"] [data-f="' + (f === 'table' ? 'column' : 'emailCol') + '"]'); if (next) next.focus(); }
  });
  $('roles').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const roles = state.cfg.roles;
    if (b.dataset.add) { const [ri, type] = b.dataset.add.split(':'); roles[+ri].rules.push(RLS.blankRule(type)); changed(true); const li = document.querySelectorAll('[data-role="' + ri + '"] .rule'); const x = li[li.length - 1]; if (x) { const i = x.querySelector('input,textarea'); if (i) i.focus(); } }
    else if (b.dataset.rmrule) { const { ri, ki } = ruleAt(b.dataset.rmrule); roles[ri].rules.splice(ki, 1); changed(true); }
    else if (b.dataset.dup) { const ri = +b.dataset.dup, c = JSON.parse(JSON.stringify(roles[ri])); c.name = (c.name || 'Role') + ' copy'; roles.splice(ri + 1, 0, c); changed(true); const n = $('rn' + (ri + 1)); if (n) { n.focus(); n.select(); } }
    else if (b.dataset.rmrole) { roles.splice(+b.dataset.rmrole, 1); changed(true); }
    else if (b.dataset.vq) { const { r } = ruleAt(b.dataset.vq); copyText(RLS.valuesQuery(r.table, r.column), b); }
  });
  $('addRole').addEventListener('click', () => { state.cfg.roles.push({ name: '', rules: [] }); changed(true); const n = $('rn' + (state.cfg.roles.length - 1)); if (n) n.focus(); });
  $('testUser').addEventListener('input', () => { state.cfg.testUser = $('testUser').value.trim(); changed(false); });
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
