/* ---------- Relationship Planner page ---------- */
const $ = id => document.getElementById(id);
const PREFIX = 'krp.';
const store = {
  get(k){ try { return localStorage.getItem(PREFIX + k); } catch (e) { return null; } },
  set(k, v){ try { localStorage.setItem(PREFIX + k, v); } catch (e) {} }
};
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
const low = s => (s || '').toLowerCase();
function copyText(text, btn){
  const done = () => { const o = btn.dataset.label || btn.textContent; btn.dataset.label = o; btn.textContent = 'Copied'; btn.classList.add('done'); setTimeout(() => { btn.textContent = o; btn.classList.remove('done'); }, 1600); };
  const fallback = () => { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta); if (ok) done(); };
  try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
}
const plural = (n, w, ws) => n + ' ' + (n === 1 ? w : (ws || w + 's'));
const ARR = r => RP.flowsBoth(r) ? '⇄' : '→';

const blankPlan = () => ({ table: '', key: '', prefer: [], carriers: null, option: '' });
const state = { example: false, base: null, changes: [], from: '', view: 'after', plan: blankPlan(), ev: null, after: null };

/* ---------- saving ---------- */
function persist(){
  if (state.example) { store.set('model', ''); store.set('changes', '[]'); store.set('plan', JSON.stringify(blankPlan())); store.set('goals', ownGoals()); return; }
  store.set('model', $('modelInput').value);
  store.set('changes', JSON.stringify(state.changes));
  store.set('goals', $('goalInput').value);
  store.set('plan', JSON.stringify(state.plan));
  store.set('view', JSON.stringify({ from: state.from, view: state.view }));
}
// goals the person typed while the example was showing (never the example's own lines)
function ownGoals(){ return state.example ? SF_SUITE.ownText($('goalInput').value, RP_EX_GOALS) : $('goalInput').value; }
function setExample(on){ state.example = on; $('exampleBanner').hidden = !on; }

/* ---------- Step 1 ---------- */
function readModelBox(){
  const text = $('modelInput').value;
  const m = text.trim() ? parseModel(text) : null;
  let msg = '';
  if (m && m.error) msg = '<div class="msg err">' + esc(m.error) + '</div>';
  state.base = m && !m.error ? RP.fromParsed(m) : null;
  if (state.base && !state.base.rels.length) msg += '<div class="msg warn">No relationships came with this export. Check the export query is the toolkit&rsquo;s current one, or add relationships in Step 3 to plan them.</div>';
  $('modelMsg').innerHTML = msg;
  const b = state.base;
  $('modelStats').innerHTML = b ? '<span class="stat"><b>' + b.tables.length + '</b> tables</span><span class="stat"><b>' + b.rels.length + '</b> relationships</span><span class="stat"><b>' + b.rels.filter(r => r.both && r.card !== '1:1').length + '</b> both directions</span><span class="stat"><b>' + b.rels.filter(r => !r.active).length + '</b> inactive</span>' : '';
}
function compute(){
  const b = state.base;
  if (!b) { state.after = null; state.ev = null; return; }
  state.after = RP.apply(b, state.changes);
  state.goals = RP.parseGoals($('goalInput').value, state.after);
  state.ev = RP.evaluate(state.after, state.goals);
  state.evBefore = state.changes.length ? RP.evaluate(b, []) : state.ev;
}
const viewModel = () => state.view === 'before' || !state.changes.length ? state.base : state.after;

/* ---------- Step 2: health and flow ---------- */
function healthLine(m, ev){
  const g = ev.graph, roles = RP.roles(m);
  const both = m.rels.filter(r => r.active && r.both && r.card !== '1:1'), inact = m.rels.filter(r => !r.active), mm = m.rels.filter(r => r.active && r.card === 'M:M');
  const alone = m.tables.filter(t => !g.linked.has(low(t)));
  return { both, inact, mm, alone, amb: ev.ambiguity, roles };
}
function renderHealth(){
  const el = $('health');
  if (!state.base) { el.innerHTML = ''; return; }
  const cur = healthLine(state.base, state.evBefore || state.ev);
  const aft = state.changes.length ? healthLine(state.after, state.ev) : null;
  const h = aft || cur;
  const chip = (n, label, warn) => '<span class="stat' + (warn && n ? ' warnstat' : '') + '"><b>' + n + '</b> ' + label + '</span>';
  let html = '<div class="healthbar"><span class="hl">' + (aft ? 'With your changes' : 'Your model') + '</span>'
    + chip(h.amb.length, h.amb.length === 1 ? 'ambiguous route' : 'ambiguous routes', true)
    + chip(h.both.length, 'both directions') + chip(h.inact.length, 'inactive') + (h.mm.length ? chip(h.mm.length, 'many-to-many') : '') + chip(h.alone.length, 'with no relationships') + '</div>';
  if (aft && aft.amb.length !== cur.amb.length) html += '<p class="small muted">Your model as it is: ' + plural(cur.amb.length, 'ambiguous route') + '.</p>';
  if (h.amb.length) {
    html += '<div class="msg warn"><b>' + plural(h.amb.length, 'pair') + ' of tables can be reached by two routes.</b> Power BI uses only one, so a total can depend on which. Open one for the routes and tested fixes.</div><div class="amblist">';
    const seen = new Set();
    h.amb.slice(0, 40).forEach((a, i) => {
      const k = low(a.from) + '>' + low(a.to); if (seen.has(k)) return; seen.add(k);
      html += '<details class="adv" data-amb="' + i + '"><summary><b>' + esc(a.from) + '</b> &rarr; <b>' + esc(a.to) + '</b> <span class="muted small">' + a.paths.length + ' routes</span></summary><div class="adv-body"></div></details>';
    });
    html += (h.amb.length > 40 ? '<p class="small muted">and ' + (h.amb.length - 40) + ' more.</p>' : '') + '</div>';
  }
  el.innerHTML = html;
}
function renderPick(){
  const m = state.base ? viewModel() : null;
  $('viewSeg').hidden = !state.changes.length;
  document.querySelectorAll('input[name=view]').forEach(i => { i.checked = i.value === (state.changes.length ? state.view : 'before'); });
  if (!m) { $('fromSel').innerHTML = ''; return; }
  const ev = m === state.base ? (state.evBefore || state.ev) : state.ev, g = ev.graph, roles = RP.roles(m);
  const linked = m.tables.filter(t => g.linked.has(low(t)));
  if (!state.from || !RP.canon(m, state.from) || !g.linked.has(low(state.from))) {
    // start on the table that filters the most (often the date table)
    state.from = linked.slice().sort((a, b) => RP.reach(g, b).size - RP.reach(g, a).size)[0] || '';
  }
  $('fromSel').innerHTML = linked.map(t => '<option value="' + esc(t) + '"' + (low(t) === low(state.from) ? ' selected' : '') + '>' + esc(t) + ' (' + RP.ROLE_WORD[roles.get(low(t))] + ', filters ' + RP.reach(g, t).size + ')</option>').join('');
}
function whyShort(w){
  if (w.kind === 'none') return 'not connected to it';
  if (w.kind === 'inactive') return 'only through an inactive relationship';
  const there = w.at === 0 ? null : w.hops[w.at - 1].to, next = w.hops[w.at].to;
  return (there ? 'the filter gets to ' + there + ' but can’t go on to ' + next : 'the filter can’t go to ' + next) + ' (' + w.rel.toTable + ' filters ' + w.rel.fromTable + ', not the other way)';
}
function renderFlow(){
  const el = $('flow'), nr = $('notReached');
  const m = state.base ? viewModel() : null;
  if (!m || !state.from) { el.innerHTML = state.base ? '<p class="muted">No relationships to show.</p>' : '<p class="muted">Connect your model in Step 1.</p>'; nr.innerHTML = ''; return; }
  const ev = m === state.base ? (state.evBefore || state.ev) : state.ev, g = ev.graph, roles = RP.roles(m);
  const src = state.from, rch = RP.reach(g, src), amb = RP.ambiguity(g, src);
  const linked = m.tables.filter(t => g.linked.has(low(t)) && low(t) !== low(src));
  const byHop = [];
  rch.forEach((v, k) => { (byHop[v.hops - 1] = byHop[v.hops - 1] || []).push(v); });
  let html = '<p class="flowsum"><b>Slicing by ' + esc(src) + ' filters ' + plural(rch.size, 'table') + '</b> of ' + linked.length + ' connected' + (amb.size ? ', <span class="warntext">' + amb.size + ' of them by two routes</span>' : '') + '.</p>';
  html += '<div class="hops"><div class="hop src"><span class="hop-h">Slice by</span><div class="tcard src"><b>' + esc(src) + '</b><span class="role">' + esc(RP.ROLE_WORD[roles.get(low(src))]) + '</span></div></div>';
  byHop.forEach((list, i) => {
    html += '<div class="hop"><span class="hop-h">' + (i === 0 ? 'Filters directly' : 'Then, ' + plural(i + 1, 'step') + ' away') + '</span>' + list.sort((a, b) => a.name.localeCompare(b.name)).map(v => {
      const a = amb.has(low(v.name));
      return '<div class="tcard' + (a ? ' amb' : '') + (v.rel.isNew || v.rel.changed ? ' chg' : '') + '"><b>' + esc(v.name) + '</b><span class="role">' + esc(RP.ROLE_WORD[roles.get(low(v.name))]) + '</span><span class="via">' + ARR(v.rel) + ' from ' + esc((rch.get(v.from) || { name: src }).name) + (v.rel.isNew ? ' (new)' : v.rel.changed ? ' (changed)' : '') + '</span>' + (a ? '<span class="ambtag">2 routes</span>' : '') + '</div>';
    }).join('') + '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
  // what it doesn't reach, grouped by reason
  const miss = linked.filter(t => !rch.has(low(t)));
  if (!miss.length) { nr.innerHTML = linked.length ? '<p class="okc small">&#10003; ' + esc(src) + ' filters every connected table.</p>' : ''; return; }
  const groups = { direction: [], inactive: [], none: [] };
  miss.forEach(t => { const w = RP.whyNot(g, src, t); groups[w.kind].push({ t, w }); });
  const head = { direction: 'The filter would have to go against a relationship’s direction', inactive: 'Only through an inactive relationship', none: 'Not connected to ' + src };
  nr.innerHTML = '<details class="extra" open><summary>Not filtered by ' + esc(src) + ' <span class="muted">(' + miss.length + ')</span></summary><div class="extra-body">' + Object.keys(groups).filter(k => groups[k].length).map(k =>
    '<p class="nr-h">' + esc(head[k]) + ' <span class="muted">(' + groups[k].length + ')</span></p><ul class="nr">' + groups[k].map(x => '<li><b>' + esc(x.t) + '</b> <span class="muted">' + esc(whyShort(x.w)) + '</span></li>').join('') + '</ul>').join('')
    + '<p class="small muted">That&rsquo;s usually right: a lookup table isn&rsquo;t meant to be filtered by another lookup. If it should be, write it as a goal in Step 4 for the reason and tested fixes.</p></div></details>';
}
function renderAllList(){
  const m = state.base ? viewModel() : null;
  if (!m) { $('allList').innerHTML = ''; $('relList').innerHTML = ''; return; }
  const ev = m === state.base ? (state.evBefore || state.ev) : state.ev, g = ev.graph, roles = RP.roles(m);
  const rows = m.tables.filter(t => g.linked.has(low(t))).map(t => ({ t, n: RP.reach(g, t).size, a: RP.ambiguity(g, t).size, role: roles.get(low(t)) })).sort((a, b) => b.n - a.n || a.t.localeCompare(b.t));
  const alone = m.tables.filter(t => !g.linked.has(low(t)));
  $('allList').innerHTML = '<div class="tablewrap"><table><thead><tr><th>Table</th><th>Kind</th><th>Filters</th><th></th></tr></thead><tbody>' + rows.map(r =>
    '<tr><td><button type="button" class="linkbtn" data-from="' + esc(r.t) + '">' + esc(r.t) + '</button></td><td class="muted">' + esc(RP.ROLE_WORD[r.role]) + '</td><td>' + r.n + '</td><td>' + (r.a ? '<span class="warntext">' + r.a + ' by two routes</span>' : '') + '</td></tr>').join('') + '</tbody></table></div>'
    + (alone.length ? '<p class="small muted"><b>No relationships</b> (helper, measure or parameter tables; nothing filters them): ' + alone.map(esc).join(', ') + '</p>' : '');
  $('relList').innerHTML = '<ul class="rels">' + m.rels.slice().sort((a, b) => a.toTable.localeCompare(b.toTable) || a.fromTable.localeCompare(b.fromTable)).map(r =>
    '<li class="' + (r.active ? '' : 'off') + '"><span class="mono">' + esc(r.toTable + '[' + r.toColumn + '] ' + ARR(r) + ' ' + r.fromTable + '[' + r.fromColumn + ']') + '</span> <span class="muted">' + esc(r.card === 'M:1' ? 'many to one' : r.card === '1:1' ? 'one to one' : 'many to many') + ', ' + esc(RP.relWords(r)) + '</span>' + (r.isNew ? ' <span class="pill ok">new</span>' : r.changed ? ' <span class="pill warn">changed</span>' : '') + '</li>').join('') + '</ul>';
}

/* ---------- Step 3: changes ---------- */
function renderChanges(){
  const b = state.base;
  const list = $('changeList');
  if (!state.changes.length) list.innerHTML = '<p class="muted small">No changes yet.</p>';
  else {
    const skipped = new Set(b ? RP.apply(b, state.changes).skipped : []);
    list.innerHTML = '<ol class="chlist">' + state.changes.map((c, i) => '<li' + (skipped.has(i) ? ' class="skip"' : '') + '><span>' + esc(b ? RP.changeText(b, c) : '') + (skipped.has(i) ? ' <span class="pill warn">doesn&rsquo;t match this model</span>' : '') + '</span><button type="button" class="btn small" data-unchange="' + i + '" aria-label="Remove this change">Remove</button></li>').join('') + '</ol>'
      + '<p class="small"><button type="button" class="linkbtn" id="clearChanges">Remove all changes</button></p>';
  }
  // pickers
  const m = state.after || b;
  $('tableList').innerHTML = m ? m.tables.map(t => '<option value="' + esc(t) + '">').join('') : '';
  fillCols();
  const op = $('chOp').value;
  $('chAdd').hidden = op !== 'add'; $('chRel').hidden = op === 'add';
  if (op !== 'add' && m) {
    const rels = op === 'remove' ? m.rels : m.rels;
    $('chRelSel').innerHTML = rels.map(r => '<option value="' + esc(r.key) + '">' + esc(r.toTable + '[' + r.toColumn + '] ' + ARR(r) + ' ' + r.fromTable + '[' + r.fromColumn + ']' + (r.active ? '' : ' (inactive)')) + '</option>').join('');
    $('chAddBtn').textContent = op === 'dir' ? 'Switch direction' : op === 'active' ? 'Turn off or on' : 'Remove it';
  } else $('chAddBtn').textContent = 'Add change';
  // effect and Desktop steps
  renderEffect();
}
function fillCols(){
  const m = state.after || state.base; if (!m) return;
  const cols = t => (m.cols.get(low(t)) || []);
  $('oneCols').innerHTML = cols($('chOneT').value).map(c => '<option value="' + esc(c) + '">').join('');
  $('manyCols').innerHTML = cols($('chManyT').value).map(c => '<option value="' + esc(c) + '">').join('');
}
function renderEffect(){
  const b = state.base, el = $('changeEffect');
  if (!b || !state.changes.length) { el.innerHTML = ''; $('desktopSteps').innerHTML = ''; $('stepsBox').hidden = true; return; }
  $('stepsBox').hidden = false;
  const g0 = (state.evBefore || state.ev).graph, g1 = state.ev.graph;
  const a0 = (state.evBefore || state.ev).ambiguity.length, a1 = state.ev.ambiguity.length;
  const gained = [], lost = [];
  state.after.tables.forEach(t => {
    const r0 = RP.canon(b, t) ? RP.reach(g0, t) : new Map(), r1 = RP.reach(g1, t);
    const plus = [...r1.keys()].filter(k => !r0.has(k)), minus = [...r0.keys()].filter(k => !r1.has(k));
    const nm = k => (r1.get(k) || r0.get(k) || { name: k }).name;
    if (plus.length) gained.push(t + ' now filters ' + plus.map(nm).join(', '));
    if (minus.length) lost.push(t + ' no longer filters ' + minus.map(nm).join(', '));
  });
  el.innerHTML = '<div class="effect"><p><b>What your changes do</b></p><ul>'
    + '<li>' + (a1 === a0 ? 'Ambiguous routes: ' + a1 + ' (no change).' : a1 > a0 ? '<span class="warntext">Ambiguous routes go from ' + a0 + ' to ' + a1 + '.</span>' : 'Ambiguous routes go from ' + a0 + ' to ' + a1 + '.') + '</li>'
    + gained.slice(0, 12).map(x => '<li>' + esc(x) + '</li>').join('') + (gained.length > 12 ? '<li class="muted">and ' + (gained.length - 12) + ' more tables filter more</li>' : '')
    + lost.slice(0, 12).map(x => '<li class="warntext">' + esc(x) + '</li>').join('') + (lost.length > 12 ? '<li class="muted">and ' + (lost.length - 12) + ' more tables filter less</li>' : '')
    + '</ul></div>';
  $('desktopSteps').innerHTML = state.changes.map(c => '<li>' + esc(RP.desktopSteps(b, c)) + '</li>').join('');
}
function addChange(){
  const op = $('chOp').value, msg = $('chMsg'), m = state.after || state.base;
  msg.textContent = '';
  if (!m) { msg.textContent = 'Connect your model in Step 1 first.'; return; }
  if (op === 'add') {
    const ot = $('chOneT').value.trim(), oc = $('chOneC').value.trim(), mt = $('chManyT').value.trim(), mc = $('chManyC').value.trim();
    if (!ot || !oc || !mt || !mc) { msg.textContent = 'Fill in both tables and both columns.'; return; }
    if (low(ot) === low(mt)) { msg.textContent = 'Pick two different tables.'; return; }
    if (!RP.canon(m, mt)) { msg.textContent = 'The many side has to be a table in your model: ' + mt + ' isn’t one.'; return; }
    state.changes.push({ op: 'add', one: [RP.canon(m, ot) || ot, oc], many: [RP.canon(m, mt), mc], card: $('chCard').value, both: $('chBoth').value === '1' });
    ['chOneC', 'chManyT', 'chManyC'].forEach(id => { $(id).value = ''; });
  } else {
    const key = $('chRelSel').value, r = m.rels.find(x => x.key === key); if (!r) return;
    if (op === 'dir') state.changes.push({ op: 'dir', key, both: !r.both });
    else if (op === 'active') state.changes.push({ op: 'active', key, active: !r.active });
    else {
      // removing a relationship added here just drops that change
      if (r.isNew && r.change != null) state.changes.splice(r.change, 1); else state.changes.push({ op: 'remove', key });
    }
  }
  changed();
}

/* ---------- Step 3: plan a shared table ---------- */
function planCarriers(){
  const b = state.base; if (!b) return [];
  return state.plan.carriers ? state.plan.carriers.filter(t => RP.canon(b, t)) : RP.defaultCarriers(b, state.plan.table);
}
function renderPlan(){
  const b = state.base, out = $('planOut');
  $('plTable').value = state.plan.table; $('plKey').value = state.plan.key;
  $('plPrefer').innerHTML = state.plan.prefer.map((t, i) => '<span class="tchip">' + (i + 1) + '. ' + esc(t) + ' <button type="button" data-unprefer="' + i + '" aria-label="Remove ' + esc(t) + '">&times;</button></span>').join('');
  state.planResult = null;
  if (!b) { out.innerHTML = ''; $('plCarry').innerHTML = ''; return; }
  const all = b.tables.filter(t => low(t) !== low(state.plan.table)), carry = new Set(planCarriers().map(low));
  $('plCarry').innerHTML = all.map(t => '<label class="ck"><input type="checkbox" data-carry="' + esc(t) + '"' + (carry.has(low(t)) ? ' checked' : '') + '> ' + esc(t) + '</label>').join('');
  $('plCarryCount').textContent = '(' + carry.size + ' of ' + all.length + ')';
  const t = (RP.canon(b, state.plan.table.trim()) || state.plan.table.trim()), k = state.plan.key.trim();
  if (!t || !k) { out.innerHTML = '<p class="small muted">Name the table and its key to see the options. It can be a table you already have (such as a Location table related to one or two tables) or a new one.</p>'; return; }
  // plan on top of the other changes (but not earlier plan changes for this same table)
  const touches = c => (c.op === 'add' && low(c.one[0]) === low(t)) || (c.op === 'remove' && b.rels.some(r => r.key === c.key && (low(r.toTable) === low(t) || low(r.fromTable) === low(t))));
  const others = state.changes.filter(c => !touches(c));
  const base = RP.apply(b, others);
  const opts = RP.planOptions(base, t, k, planCarriers(), state.plan.prefer);
  if (!opts.length) { out.innerHTML = ''; return; }
  const sel = opts.find(o => o.id === state.plan.option) || opts[0];
  state.planResult = { table: t, option: sel, others };
  const exists = !!RP.canon(b, t) && opts.some(o => o.id === 'keep');
  const best = opts.slice().sort((x, y) => (y.covered.length - x.covered.length) || (x.offMeasures.length - y.offMeasures.length) || (x.changes.length - y.changes.length))[0];
  const card = o => '<label class="opt' + (o === sel ? ' on' : '') + '"><input type="radio" name="planOpt" value="' + o.id + '"' + (o === sel ? ' checked' : '') + '><span class="opt-b"><b>' + esc(o.title) + '</b>' + (o === best ? ' <span class="pill ok">filters the most</span>' : '')
    + '<span class="small">Filters <b>' + o.covered.length + ' of ' + o.total + '</b> tables (' + o.facts[0] + ' of ' + o.facts[1] + ' fact tables, ' + o.lookups[0] + ' of ' + o.lookups[1] + ' others) &middot; ' + (o.amb ? '<span class="warntext">' + plural(o.amb, 'ambiguous route') + '</span>' : 'no ambiguity') + ' &middot; '
    + (o.changes.length ? plural(o.p.added.length, 'new relationship') + (o.removed.length ? ', removes the links to ' + esc(o.removed.join(', ')) : '') : 'no changes') + '</span>'
    + (o.offMeasures.length ? '<span class="small muted">' + plural(o.offMeasures.length, 'measure') + ' read a table it doesn&rsquo;t filter, so they won&rsquo;t follow ' + esc(t) + ' (' + esc(o.offMeasures.slice(0, 3).join(', ')) + (o.offMeasures.length > 3 ? '&hellip;' : '') + ')</span>' : '')
    + '</span></label>';
  const p = sel.p;
  const word = { link: 'Relate directly', filtered: 'Filtered through another table', conflict: 'Can’t be linked: two routes', unreached: 'Not reached' };
  const rowHtml = r => {
    let how = '', res = word[r.status];
    if (r.status === 'link') { const col = (b.cols.get(low(r.table)) || []).find(c => low(c) === low(k)) || k; how = esc(t + '[' + k + '] → ' + r.table + '[' + col + ']'); if (r.existing) res = 'Already related'; }
    else if (r.status === 'filtered') how = esc(RP.pathText(t, r.path)) + '<br><span class="muted">by ' + esc(r.by) + '&rsquo;s ' + esc(k) + '; ' + esc(r.table) + '&rsquo;s own ' + esc(k) + ' isn&rsquo;t used</span>';
    else if (r.status === 'conflict') how = 'Linking it too gives a second route to ' + esc(r.clash.slice(0, 4).join(', ')) + (r.clash.length > 4 ? ' and ' + (r.clash.length - 4) + ' more' : '') + ':<br>' + r.paths.map(x => '<span class="mono">' + esc(RP.pathText(t, x)) + '</span>').join('<br>') + (r.preferred ? '<br><span class="warntext">You asked to link it first, but an earlier link already reaches ' + esc(r.at) + '.</span>' : '');
    else how = 'No link reaches it without a second route somewhere.';
    return '<tr class="pl-' + r.status + '"><td><b>' + esc(r.table) + '</b></td><td>' + esc(res) + '</td><td class="how">' + how + '</td></tr>';
  };
  // a visual filter measure for every table left out that has the key column
  const missed = p.rows.filter(r => r.status === 'conflict' || r.status === 'unreached');
  const withKey = missed.map(r => ({ t: r.table, col: (b.cols.get(low(r.table)) || []).find(c => low(c) === low(k)) })).filter(x => x.col);
  const dax = withKey.map(x => RP.treatasMeasure(x.t, t, k, x.col)).join('\n\n');
  // what the chosen option already filters underneath each left-out lookup
  const g = RP.graph(p.model), rch = RP.canon(p.model, t) ? RP.reach(g, t) : new Map();
  const coveredBelow = missed.map(r => ({ t: r.table, under: [...new Set(p.model.rels.filter(z => z.active && low(z.toTable) === low(r.table)).map(z => z.fromTable))] })).filter(x => x.under.length && x.under.every(u => rch.has(low(u))));
  out.innerHTML = '<p class="small">' + (exists ? esc(t) + ' already has relationships, so the first option builds on them. ' : '') + 'Pick an option to see it table by table.</p><div class="opts2">' + opts.map(card).join('') + '</div>'
    + '<div class="planhead"><p><b>' + esc(sel.title) + ':</b> ' + plural(p.links.length, 'relationship') + (p.links.length === 1 ? ' filters ' : ' filter ') + sel.covered.length + ' of ' + sel.total + ' tables with no ambiguity.' + (missed.length ? ' The other ' + missed.length + ' can&rsquo;t be related to ' + esc(t) + ' without a second route.' : '') + '</p>'
    + (sel.changes.length ? '<button type="button" class="btn primary" id="planUse">Use this option (' + plural(sel.changes.length, 'change') + ')</button>' : '<span class="small okc">&#10003; Your model already does this.</span>') + '</div>'
    + '<div class="tablewrap"><table class="plan"><thead><tr><th>Table</th><th>Result</th><th>How</th></tr></thead><tbody>' + p.rows.map(rowHtml).join('') + '</tbody></table></div>'
    + (missed.length ? '<div class="fix"><p><b>For the ' + missed.length + ' that can&rsquo;t be linked</b></p><ul>'
      + (coveredBelow.length ? '<li><b>Measures already follow ' + esc(t) + ' for ' + esc(coveredBelow.map(x => x.t).join(', ')) + ':</b> every table ' + (coveredBelow.length === 1 ? 'it filters' : 'they filter') + ' is filtered by ' + esc(t) + ', so a count or total from those tables follows the ' + esc(t) + ' selection, row by row. Only the list itself (a slicer, or a table visual with no measure) isn&rsquo;t narrowed.</li>' : '')
      + '<li><b>To narrow those lists:</b> add the measure for the table to the filters of its slicers and visuals (Filters pane: is 1). It matches each row&rsquo;s own ' + esc(k) + ' to the ' + esc(t) + ' selection, with no new route.</li>'
      + '<li><b>If ' + esc(t) + ' is for security</b> (people only see their own): use row-level security with a rule on each table&rsquo;s own ' + esc(k) + '. Each rule filters its table on its own, so ambiguity doesn&rsquo;t come into it. The <a href="rls-role-generator.html">RLS Role Generator</a> writes them.</li></ul>'
      + (dax ? '<div class="codebox"><div class="codebox-bar"><span class="t">DAX measures: visual filters, set to 1 (' + withKey.length + ')</span><span class="r"><button class="btn small" type="button" data-copytext="' + esc(dax) + '">Copy all</button></span></div><pre class="short">' + esc(dax) + '</pre></div>' : '')
      + (missed.length > withKey.length ? '<p class="small muted">' + esc(missed.filter(r => !withKey.some(x => x.t === r.table)).map(r => r.table).join(', ')) + ' ha' + (missed.length - withKey.length === 1 ? 's' : 've') + ' no ' + esc(k) + ' column yet.</p>' : '')
      + '<p class="small muted">Use &ldquo;Link these first&rdquo; to choose whose key drives the filter. The plan adds links one at a time, starting with the one whose filter reaches the most tables the normal way (from the one side to the many side).</p></div>' : '');
}

/* ---------- Step 4: goals ---------- */
const GOAL_WORD = { filters: 'should filter', notFilters: 'should not filter' };
function itemReason(x, i){
  if (x.goal.kind === 'notFilters') return 'by ' + RP.pathText(x.src, i.path);
  if (i.ambiguous) return i.ambiguous.length + ' routes';
  return whyShort(i.why);
}
function goalBlock(x, gi){
  const g = x.goal;
  if (g.kind === 'unknown') {
    const plan = g.missing ? ' <button type="button" class="btn small" data-planfor="' + esc(g.missing) + '">Plan ' + esc(g.missing) + ' as a new table</button>' : '';
    return '<div class="goal unk"><div class="goal-h"><span class="mark q" aria-hidden="true">?</span><span class="gl">' + esc(g.line) + '</span></div><p class="small">' + esc(g.why) + plan + '</p></div>';
  }
  if (g.kind === 'noAmbiguity' || g.kind === 'allowAmbiguity') return '';
  const bad = x.items.filter(i => !i.ok), ok = x.items.filter(i => i.ok);
  const multi = g.from.length > 1;
  const pass = !bad.length && x.items.length;
  const what = g.scope === 'list' ? '' : ' <span class="muted small">(' + plural(x.items.length, g.scope === 'facts' ? 'fact table' : g.scope === 'lookups' ? 'lookup table' : 'table') + (g.except.length ? ', except ' + g.except.map(esc).join(', ') : '') + ')</span>';
  let html = '<div class="goal ' + (pass ? 'pass' : 'fail') + '"><div class="goal-h"><span class="mark ' + (pass ? 'ok' : 'no') + '" aria-hidden="true">' + (pass ? '&#10003;' : '&#10007;') + '</span><span class="gl">' + esc(g.line) + (multi ? ' <span class="muted">(' + esc(x.src) + ')</span>' : '') + what + '</span>'
    + '<span class="gsum">' + (x.items.length ? (g.kind === 'filters' ? ok.length + ' of ' + x.items.length + ' filtered cleanly' : ok.length + ' of ' + x.items.length + ' kept out') : 'nothing to check') + '</span></div>';
  if (!x.items.length) html += '<p class="small muted">No tables matched. Check the table names, or use &ldquo;every table&rdquo;.</p>';
  if (bad.length) {
    // grouped by reason
    const grp = new Map();
    bad.forEach(i => { const k = g.kind === 'notFilters' ? 'reach' : i.ambiguous ? 'amb' : i.why.kind; if (!grp.has(k)) grp.set(k, []); grp.get(k).push(i); });
    const head = { amb: 'Reached by two routes (ambiguous)', direction: 'Blocked by a relationship&rsquo;s direction', inactive: 'Only through an inactive relationship', none: 'Not connected', reach: 'Filtered, but shouldn&rsquo;t be' };
    ['amb', 'direction', 'inactive', 'none', 'reach'].filter(k => grp.has(k)).forEach(k => {
      html += '<p class="nr-h">' + head[k] + ' <span class="muted">(' + grp.get(k).length + ')</span></p>';
      html += grp.get(k).map(i => '<details class="adv" data-goal="' + gi + '" data-item="' + esc(i.table) + '"><summary><b>' + esc(i.table) + '</b> <span class="muted small">' + esc(itemReason(x, i)) + '</span></summary><div class="adv-body"></div></details>').join('');
    });
    if (g.scope !== 'list' && bad.length > 2) html += '<p class="small tip"><b>Not sure which relationships to make?</b> <button type="button" class="linkbtn" data-planfor="' + esc(x.src) + '">Compare the ways to relate ' + esc(x.src) + '</button> in Step 3: each option says how many tables it filters, with no ambiguity, and what to do for the rest.</p>';
  }
  if (ok.length && g.kind === 'filters') html += '<details class="okl"><summary class="small">&#10003; ' + plural(ok.length, 'table') + ' filtered by one route</summary><ul class="nr">' + ok.map(i => '<li><b>' + esc(i.table) + '</b> <span class="muted mono small">' + esc(RP.pathText(x.src, i.path)) + '</span></li>').join('') + '</ul></details>';
  const notes = [];
  if (x.skippedDates && x.skippedDates.length) notes.push('Date tables left out (' + x.skippedDates.map(esc).join(', ') + '); add &ldquo;including Date&rdquo; to check them.');
  if (x.notConnected && x.notConnected.length) notes.push(plural(x.notConnected.length, 'table') + ' with no relationships left out (helper, measure or parameter tables).');
  if (notes.length) html += '<p class="small muted">' + notes.join(' ') + '</p>';
  return html + '</div>';
}
function renderGoals(){
  const el = $('goalResults');
  if (!state.ev) { el.innerHTML = '<p class="muted">Connect your model in Step 1.</p>'; renderQuick(); return; }
  const ev = state.ev, allow = state.goals.some(g => g.kind === 'allowAmbiguity');
  const a = ev.ambiguity.length;
  let html = '<div class="goal ' + (a && !allow ? 'fail' : 'pass') + '"><div class="goal-h"><span class="mark ' + (a && !allow ? 'no' : 'ok') + '" aria-hidden="true">' + (a && !allow ? '&#10007;' : '&#10003;') + '</span><span class="gl">No ambiguous routes <span class="muted small">(always checked)</span></span><span class="gsum">' + (a ? plural(a, 'pair') + ' with two routes' : 'none') + '</span></div>'
    + (a ? '<p class="small">Listed in Step 2 with tested fixes: <button type="button" class="linkbtn" data-goto="health">see them</button>.</p>' : '') + (ev.cut.length ? '<p class="small muted">The model is large, so the search for routes stopped early from ' + ev.cut.map(esc).join(', ') + '.</p>' : '') + '</div>';
  if (!state.goals.length) html += '<p class="small muted">Write a goal above, or use the row of lists to add one.</p>';
  html += ev.goals.map((x, i) => goalBlock(x, i)).join('');
  el.innerHTML = html;
  renderQuick();
}
function renderQuick(){
  const m = state.after || state.base;
  const keep = (id, html) => { const v = $(id).value; $(id).innerHTML = html; if ([...$(id).options].some(o => o.value === v)) $(id).value = v; };
  if (!m) { $('qFrom').innerHTML = ''; $('qTo').innerHTML = ''; return; }
  const g = state.ev ? state.ev.graph : null;
  const opts = m.tables.filter(t => !g || g.linked.has(low(t)) || m.added.has(low(t))).map(t => '<option value="' + esc(t) + '">' + esc(t) + '</option>').join('');
  keep('qFrom', opts);
  keep('qTo', '<option value="every table">every table</option><option value="every fact table">every fact table</option><optgroup label="Tables">' + opts + '</optgroup>');
}
// advice for one failing item, worked out when it's opened
function fillAdvice(d){
  const body = d.querySelector('.adv-body'); if (!body || body.dataset.done) return;
  body.dataset.done = '1';
  let adv, fixes;
  if (d.dataset.amb != null) {
    const h = state.changes.length ? state.ev : (state.evBefore || state.ev);
    const a = h.ambiguity[+d.dataset.amb]; if (!a) return;
    fixes = RP.adviseAmbiguity(state.base, state.changes, state.goals, a);
    adv = { text: ['Routes from ' + a.from + ' to ' + a.to + ':'].concat(a.paths.slice(0, 3).map(p => RP.pathText(a.from, p))), fixes, code: [] };
  } else {
    const x = state.ev.goals[+d.dataset.goal]; if (!x) return;
    const it = x.items.find(i => i.table === d.dataset.item); if (!it) return;
    adv = RP.advise(state.base, state.changes, state.goals, x, it);
  }
  let html = adv.text.map(t => '<p' + (/^Route|^Closest|→|⇄/.test(t) && t.length < 400 && !/\. /.test(t) ? ' class="mono small"' : '') + '>' + esc(t) + '</p>').join('');
  if (adv.fixes.length) {
    html += '<p class="fix-h"><b>Fixes, each tested on the whole model</b></p>' + adv.fixes.map((f, i) => {
      const bits = [];
      if (f.fixed.length) bits.push('<span class="okc">Fixes ' + plural(f.fixed.length, 'goal check') + '</span>');
      if (f.broke.length) bits.push('<span class="warntext">Breaks ' + plural(f.broke.length, 'goal check') + ': ' + esc(f.broke.slice(0, 3).map(b => b.src + ' → ' + b.table).join(', ')) + (f.broke.length > 3 ? '…' : '') + '</span>');
      if (f.ambAfter !== f.ambBefore) bits.push((f.ambAfter > f.ambBefore ? '<span class="warntext">' : '<span>') + 'Ambiguous routes ' + f.ambBefore + ' → ' + f.ambAfter + '</span>');
      f.lost.slice(0, 2).forEach(l => bits.push('<span class="warntext">' + esc(l.table) + ' stops filtering ' + (l.n > 4 ? l.n + ' tables' : esc(l.tables.join(', '))) + '</span>'));
      if (f.lost.length > 2) bits.push('<span class="muted">and ' + (f.lost.length - 2) + ' more tables filter less</span>');
      if (!bits.length) bits.push('<span class="muted">No other effect</span>');
      const best = i === 0 && !f.broke.length && f.ambAfter <= f.ambBefore && !f.lostN;
      return '<div class="fixrow' + (best ? ' best' : '') + '"><div><b>' + esc(f.title) + '</b>' + (best ? ' <span class="pill ok">no side effects</span>' : '') + '<div class="small">' + bits.join(' &middot; ') + '</div></div><button type="button" class="btn small" data-usefix="' + i + '">Add to my changes</button></div>';
    }).join('');
    d._fixes = adv.fixes;
    if (!adv.fixes.some(f => !f.broke.length && f.ambAfter <= f.ambBefore && !f.lostN) && adv.code.length) html += '<p class="small muted">Every relationship change tested here has a cost. The DAX below gets the same result without changing a relationship.</p>';
  } else if (adv.tried) html += '<p class="small muted">None of the ' + plural(adv.tried, 'relationship change') + ' tried fixes it on its own.</p>';
  adv.code.forEach(c => { html += '<div class="codebox"><div class="codebox-bar"><span class="t">' + esc(c.title) + '</span><span class="r"><button class="btn small" type="button" data-copytext="' + esc(c.dax) + '">Copy</button></span></div><pre class="short">' + esc(c.dax) + '</pre></div>' + (c.note ? '<p class="small muted">' + esc(c.note) + '</p>' : ''); });
  body.innerHTML = html;
}
function summaryText(){
  if (!state.ev) return '';
  const L = [];
  L.push('Relationship Planner' + (state.changes.length ? ' (with ' + plural(state.changes.length, 'change') + ')' : ''));
  if (state.changes.length) state.changes.forEach(c => L.push('- ' + RP.changeText(state.base, c)));
  L.push('', 'Ambiguous routes: ' + state.ev.ambiguity.length);
  state.ev.ambiguity.slice(0, 20).forEach(a => L.push('- ' + a.from + ' to ' + a.to + ': ' + a.paths.slice(0, 2).map(p => RP.pathText(a.from, p)).join(' | ')));
  state.ev.goals.forEach(x => {
    const g = x.goal;
    if (g.kind === 'unknown') { L.push('', '? ' + g.line + ': ' + g.why); return; }
    if (!x.items) return;
    const bad = x.items.filter(i => !i.ok);
    if (g.kind === 'noAmbiguity' || g.kind === 'allowAmbiguity') return;
    L.push('', (bad.length ? 'FAIL ' : 'OK ') + g.line + (g.from.length > 1 ? ' (' + x.src + ')' : '') + ': ' + (x.items.length - bad.length) + ' of ' + x.items.length);
    bad.forEach(i => L.push('- ' + i.table + ': ' + itemReason(x, i)));
  });
  return L.join('\n');
}

/* ---------- render everything ---------- */
function renderAll(){ readModelBox(); compute(); renderHealth(); renderPick(); renderFlow(); renderAllList(); renderChanges(); renderPlan(); renderGoals(); }
function changed(){ compute(); renderHealth(); renderPick(); renderFlow(); renderAllList(); renderChanges(); renderPlan(); renderGoals(); persist(); }

/* ---------- init ---------- */
function resetAll(){
  $('modelInput').value = ''; $('goalInput').value = ''; state.changes = []; state.plan = blankPlan(); state.from = ''; state.view = 'after';
  setExample(false); $('modelBox').open = false; $('planBox').open = false; renderAll();
}
function loadExample(){
  $('modelInput').value = RP_EX_MODEL; $('goalInput').value = RP_EX_GOALS;
  state.changes = RP_EX_CHANGES.map(c => JSON.parse(JSON.stringify(c))); state.plan = blankPlan(); state.from = 'Region'; state.view = 'after';
  setExample(true);
}
// a saved change must have the shape the page writes (storage can hold anything)
const isStrPair = v => Array.isArray(v) && v.length === 2 && v.every(x => typeof x === 'string' && x.trim());
function validChange(c){
  if (!c || typeof c !== 'object') return false;
  if (c.op === 'add') return isStrPair(c.one) && isStrPair(c.many);
  return ['dir', 'active', 'remove'].includes(c.op) && typeof c.key === 'string';
}
function init(){
  $('exportView').textContent = DAX_QUERY;
  const saved = store.get('model');
  const J = (k, d) => { try { const v = JSON.parse(store.get(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  if (saved && saved.trim()) {
    $('modelInput').value = saved;
    const ch = J('changes', []); state.changes = Array.isArray(ch) ? ch.filter(validChange) : [];
    $('goalInput').value = typeof store.get('goals') === 'string' ? store.get('goals') : '';
    const pl = J('plan', null); if (pl && typeof pl === 'object') state.plan = Object.assign(blankPlan(), { table: String(pl.table || ''), key: String(pl.key || ''), option: String(pl.option || ''), prefer: Array.isArray(pl.prefer) ? pl.prefer.map(String) : [], carriers: Array.isArray(pl.carriers) ? pl.carriers.map(String) : null });
    const v = J('view', {}); if (v && typeof v === 'object') { state.from = String(v.from || ''); state.view = v.view === 'before' ? 'before' : 'after'; }
  } else if (store.get('blank') !== '1') {
    loadExample();
    const own = store.get('goals'); if (own && own.trim()) $('goalInput').value = own;
  } else $('goalInput').value = store.get('goals') || '';
  renderAll();

  $('modelInput').addEventListener('input', () => {
    if (state.example) {
      // the person's own model replaces the whole example; goals they typed themselves stay
      const own = ownGoals(); setExample(false); state.changes = []; state.plan = blankPlan(); state.from = ''; $('goalInput').value = own;
    }
    try { localStorage.removeItem(PREFIX + 'blank'); } catch (e) {}
    renderAll(); persist();
  });
  let gt;
  $('goalInput').addEventListener('input', () => { clearTimeout(gt); gt = setTimeout(() => { compute(); renderGoals(); renderHealth(); persist(); }, 250); });
  $('fromSel').addEventListener('change', e => { state.from = e.target.value; renderFlow(); persist(); });
  document.querySelectorAll('input[name=view]').forEach(i => i.addEventListener('change', e => { state.view = e.target.value; renderPick(); renderFlow(); renderAllList(); persist(); }));
  $('chOp').addEventListener('change', renderChanges);
  ['chOneT', 'chManyT'].forEach(id => $(id).addEventListener('input', fillCols));
  $('chAddBtn').addEventListener('click', addChange);
  // plan inputs
  const planChanged = () => { renderPlan(); persist(); };
  let pt;
  $('plTable').addEventListener('input', e => {
    state.plan.table = e.target.value; state.plan.option = '';
    // a table already in the model: start from the key it's related by
    const m = state.base, t = m && RP.canon(m, e.target.value.trim());
    if (t && !state.plan.key.trim()) { const r = m.rels.find(x => low(x.toTable) === low(t)); if (r) { state.plan.key = r.toColumn; } }
    clearTimeout(pt); pt = setTimeout(planChanged, 300);
  });
  $('planOut').addEventListener('change', e => { if (e.target.name === 'planOpt') { state.plan.option = e.target.value; planChanged(); } });
  $('plKey').addEventListener('input', e => { state.plan.key = e.target.value; clearTimeout(pt); pt = setTimeout(planChanged, 300); });
  const addPrefer = () => { const m = state.base; const v = $('plPreferIn').value.trim(); const t = m && RP.canon(m, v); if (t && !state.plan.prefer.includes(t)) { state.plan.prefer.push(t); $('plPreferIn').value = ''; planChanged(); } };
  $('plPreferAdd').addEventListener('click', addPrefer);
  $('plPreferIn').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addPrefer(); } });
  $('plCarry').addEventListener('change', e => {
    const t = e.target.dataset.carry; if (t == null) return;
    const cur = new Set(planCarriers()); if (e.target.checked) cur.add(t); else cur.delete(t);
    state.plan.carriers = [...cur]; planChanged();
  });
  $('plAll').addEventListener('click', () => { state.plan.carriers = state.base ? state.base.tables.filter(t => low(t) !== low(state.plan.table)) : []; planChanged(); });
  $('plNone').addEventListener('click', () => { state.plan.carriers = []; planChanged(); });
  $('plDefault').addEventListener('click', () => { state.plan.carriers = null; planChanged(); });
  $('qAdd').addEventListener('click', () => {
    const f = $('qFrom').value, t = $('qTo').value; if (!f || !t) return;
    const line = f + ($('qNeg').value ? ' should not filter ' : ' should filter ') + t;
    const ta = $('goalInput'); ta.value = (ta.value.replace(/\s+$/, '') ? ta.value.replace(/\s+$/, '') + '\n' : '') + line;
    compute(); renderGoals(); renderHealth(); persist();
  });
  $('copySteps').addEventListener('click', e => copyText(state.base ? state.changes.map((c, i) => (i + 1) + '. ' + RP.desktopSteps(state.base, c)).join('\n') : '', e.target));
  $('copySummary').addEventListener('click', e => copyText(summaryText(), e.target));
  document.addEventListener('toggle', e => { const d = e.target; if (d.classList && d.classList.contains('adv') && d.open) fillAdvice(d); }, true);
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.copy === 'export') { copyText(DAX_QUERY, b); return; }
    if (b.dataset.copytext != null) { copyText(b.dataset.copytext, b); return; }
    if (b.dataset.from) { state.from = b.dataset.from; renderPick(); renderFlow(); persist(); $('s2').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (b.dataset.unchange != null) { state.changes.splice(+b.dataset.unchange, 1); changed(); return; }
    if (b.id === 'clearChanges') { state.changes = []; changed(); return; }
    if (b.dataset.unprefer != null) { state.plan.prefer.splice(+b.dataset.unprefer, 1); planChanged(); return; }
    if (b.id === 'planUse' && state.planResult) {
      state.changes = state.planResult.others.concat(state.planResult.option.changes.map(c => JSON.parse(JSON.stringify(c))));
      changed(); $('changeList').scrollIntoView({ behavior: 'smooth', block: 'center' }); return;
    }
    if (b.dataset.planfor != null) {
      state.plan.table = b.dataset.planfor; state.plan.option = '';
      const ex = state.base && state.base.rels.find(x => low(x.toTable) === low(b.dataset.planfor));
      state.plan.key = ex ? ex.toColumn : (state.plan.key || b.dataset.planfor.replace(/\s+/g, '') + 'Key');
      $('planBox').open = true; renderPlan(); persist(); $('planBox').scrollIntoView({ behavior: 'smooth', block: 'start' }); return;
    }
    if (b.dataset.goto === 'health') { $('health').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (b.dataset.usefix != null) {
      const d = b.closest('details.adv'); const f = d && d._fixes && d._fixes[+b.dataset.usefix]; if (!f) return;
      state.changes = f.changes.map(c => JSON.parse(JSON.stringify(c))); changed();
      $('changeList').scrollIntoView({ behavior: 'smooth', block: 'center' }); return;
    }
  });
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
