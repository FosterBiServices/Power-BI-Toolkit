
/* ---------- Power Query Writer page ---------- */
const $ = id => document.getElementById(id);
const PREFIX = 'kpw.';
const store = {
  get(k){ try { return localStorage.getItem(PREFIX + k); } catch (e) { return null; } },
  set(k, v){ try { localStorage.setItem(PREFIX + k, v); } catch (e) {} }
};
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
const M_KW = new Set(['let', 'in', 'each', 'if', 'then', 'else', 'and', 'or', 'not', 'type', 'meta', 'true', 'false', 'null', 'try', 'otherwise', 'as', 'is', 'error', 'section', 'shared']);
function hlM(code){
  const tk = mTokenize(code);
  if (tk.error) return esc(code);
  return tk.toks.map(t => {
    const h = esc(t.v);
    if (t.t === 'comment') return '<span class="tok-com">' + h + '</span>';
    if (t.t === 'str') return '<span class="tok-str">' + h + '</span>';
    if (t.t === 'qid') return '<span class="tok-qid">' + h + '</span>';
    if (t.t === 'id' && M_KW.has(t.v)) return '<span class="tok-kw">' + h + '</span>';
    return h;
  }).join('');
}
function copyText(text, btn){
  const done = () => { const o = btn.dataset.label || btn.textContent; btn.dataset.label = o; btn.textContent = 'Copied'; btn.classList.add('done'); setTimeout(() => { btn.textContent = o; btn.classList.remove('done'); }, 1600); };
  const fallback = () => { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta); if (ok) done(); };
  try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
}

const FIELDS = ['goal', 'sourceDetail', 'existing', 'columns', 'merges', 'params', 'culture', 'myFns', 'pwReply', 'pwError'];
const blank = () => ({ pick: '', goal: '', start: 'new', source: 'sql', sourceDetail: '', existing: '', columns: '', merges: '', params: '', culture: '', makeParams: true, typeMap: true, typeHow: 'fx', fx: PWF.blankOpts(), haveFx: false, myFns: '', pwReply: '', pwError: '' });
const state = { example: false, v: blank(), prompt: '', reply: null };

function inputs(){
  const v = state.v, ex = v.start === 'existing' && v.existing.trim() ? parseM(v.existing) : null;
  return { goal: v.goal, start: v.start, source: v.source, sourceDetail: v.sourceDetail, existing: v.existing, existingDb: ex && !ex.error && sourceInfo(ex).kind === 'database',
    columns: v.columns, merges: v.merges, params: v.params, culture: v.culture, makeParams: v.makeParams, typeMap: v.typeMap !== false,
    typeHow: v.typeHow === 'steps' ? 'steps' : 'fx', fx: v.fx, haveFx: !!v.haveFx, myFns: v.myFns };
}
function toForm(){
  const v = state.v;
  FIELDS.forEach(k => { $(k).value = v[k] || ''; });
  $('source').value = v.source; $('makeParams').checked = v.makeParams; $('typeMap').checked = v.typeMap !== false;
  $('typeSteps').checked = v.typeHow === 'steps'; $('haveFx').checked = !!v.haveFx;
  document.querySelectorAll('input[name=start]').forEach(i => { i.checked = i.value === v.start; });
}

/* ---------- the connected model (Step 1) ---------- */
// The model export (or a PBIP folder read as one) gives the tables and their columns; a PBIP folder also gives each
// table's Power Query code and the queries that are functions (state.mq, saved per model name).
state.model = null; state.mq = null;
function modelTables(){
  const m = state.model; if (!m || m.error) return [];
  const cols = t => m.columns.filter(c => c.table === t.name && !c.expression);
  // leave out calculated tables and measures tables (measures, and at most one column, hidden or named for measures)
  const measuresTable = t => m.measures.some(x => x.table === t.name) && cols(t).length <= 1 && (cols(t).every(c => c.hidden) || /measure/i.test(t.name));
  return m.tables.filter(t => !t.calc && !measuresTable(t) && (cols(t).length || mqFor(t.name))).map(t => ({ name: t.name, cols: cols(t) }));
}
// the model's data types in the words the column list reads (a DateTime column named like a date is a date)
function colType(c){
  const t = (c.dataType || '').toLowerCase();
  if (/int/.test(t)) return 'whole number';
  if (/double|decimal|currency|number/.test(t)) return 'number';
  if (/date/.test(t)) return /time/i.test(c.name) || !/date|day/i.test(c.name) ? 'datetime' : 'date';
  if (/bool/.test(t)) return 'logical';
  return 'text';
}
function colLines(t){ return t.cols.map(c => c.name + ': ' + colType(c)).join('\n'); }
function mqFor(name){ const q = state.mq && state.mq.queries.find(x => x.table === name || x.name === name); return q ? q.code : ''; }
function modelFns(){ return state.mq ? state.mq.queries.filter(q => !q.loaded && (/function/i.test(q.resultType || '') || /^\s*\([^)]*\)\s*(as\s+[\w.]+\s*)?=>/.test(q.code.replace(/^(\s*\/\/[^\n]*\n)+/, '')))).map(q => q.name) : []; }
function renderModel(){
  const ts = modelTables(), m = state.model;
  $('modelMsg').innerHTML = m && m.error ? '<div class="msg err">' + esc(m.error) + '</div>' : '';
  $('pickBox').hidden = !ts.length;
  $('mergePickBox').hidden = !ts.length;
  const opts = '<option value="">Choose a table</option>' + ts.map(t => '<option' + (t.name === state.v.pick ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('');
  $('pickTable').innerHTML = opts;
  $('mergePick').innerHTML = '<option value="">Choose a table to add</option>' + ts.map(t => '<option>' + esc(t.name) + '</option>').join('');
  const pick = ts.find(t => t.name === state.v.pick);
  $('pickMsg').innerHTML = !pick ? '' : mqFor(pick.name)
    ? '<div class="msg ok">&#10003; Its query' + (pick.cols.length ? ' and ' + pick.cols.length + ' column' + (pick.cols.length === 1 ? '' : 's') : '') + ' came from your model.</div>'
    : '<div class="msg info">Its ' + pick.cols.length + ' column' + (pick.cols.length === 1 ? '' : 's') + ' came from your model. The model export doesn&rsquo;t include the queries, so paste this one from the Advanced Editor below, or connect the PBIP folder in Step 1 and it&rsquo;s filled in.</div>';
  $('existing').placeholder = ts.length ? 'Pick a table above, or paste the query from the Advanced Editor (Home > Advanced Editor), starting with let' : 'Paste the query from the Advanced Editor (Home > Advanced Editor), starting with let';
}
function pickTable(name){
  const t = modelTables().find(x => x.name === name);
  leaveExample();
  state.v.pick = name;
  if (t) {
    if (t.cols.length) state.v.columns = colLines(t);
    const code = mqFor(name); if (code) state.v.existing = code;
  }
  toForm(); renderAll(); persist();
}
const modelSig = t => (t || '').length + ':' + (t || '').slice(0, 300);
function loadModel(first){
  const text = $('modelInput').value;
  state.model = text.trim() ? BC.parseModel(text) : null;
  // the queries read from a folder belong to the model read with them
  if (state.mq && !first && state.mq.sig !== modelSig(text)) { state.mq = null; store.set('mq', ''); }
  renderModel(); renderFx();
}
async function loadFolderQueries(root, list){
  const files = await SF_SUITE.pbipFiles(list.filter(x => /\.(tmdl|bim)$/i.test(x.path)));
  const models = readPbip(new Map(files.map(f => [f.path, f.text]))).filter(x => x.queries.length);
  if (!models.length) return;
  const m = models[0];
  state.mq = { name: m.name, sig: modelSig($('modelInput').value), queries: m.queries.map(q => ({ name: q.name, table: q.table || '', loaded: q.loaded, resultType: q.resultType || '', code: q.code })) };
  store.set('mq', JSON.stringify(state.mq));
  renderModel(); renderFx();
}

/* ---------- render ---------- */
function renderStart(){
  const v = state.v, src = PW.SOURCES.find(s => s[0] === v.source);
  $('newBox').hidden = v.start !== 'new'; $('existingBox').hidden = v.start !== 'existing';
  $('sourceDetail').placeholder = src ? src[2] : '';
  if (v.start === 'existing' && v.existing.trim()) {
    const q = parseM(v.existing);
    if (q.error) $('existingMsg').innerHTML = '<div class="msg err">' + esc(q.error) + '</div>';
    else { const src2 = sourceInfo(q); $('existingMsg').innerHTML = '<div class="msg ok">&#10003; ' + q.steps.length + ' step' + (q.steps.length === 1 ? '' : 's') + (src2.fn ? ', source ' + esc(src2.fn) : '') + '. Copilot is told to keep the source step and build on it.</div>'; }
  } else $('existingMsg').innerHTML = '';
}
function renderCols(){
  const cols = PW.parseColumns(state.v.columns);
  $('colChips').innerHTML = cols.length ? cols.map(c => '<span class="chip">' + esc(c.name) + (c.type ? ' <small>' + esc(c.type) + '</small>' : '') + '</span>').join('') + '<span class="muted small">' + cols.length + ' column' + (cols.length === 1 ? '' : 's') + '</span>' : '';
  // the type map: shown once there are columns
  $('typeMapBox').hidden = !cols.length;
  $('typeHowBox').hidden = state.v.typeMap === false;
  $('typeMapView').hidden = state.v.typeMap === false || state.v.typeHow !== 'steps';
  $('typeMapCode').textContent = cols.length ? PW.typeMap(cols, 'PromotedHeaders', state.v.culture) : '';
  $('fxBox').hidden = !cols.length;
  renderRecipes(cols); renderFx();
}
/* ---------- cleaning recipes ---------- */
const R_OPTS = {
  trim: o => '<label><input type="checkbox" data-opt="collapse"' + (o.collapse ? ' checked' : '') + '> Also turn runs of spaces inside the text into one</label>',
  case: o => '<label>Case <select data-opt="how">' + ['Upper', 'Lower', 'Proper'].map(c => '<option' + (o.how === c ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></label>',
  date: o => '<label class="row" style="flex:1 1 220px">Format <input type="text" class="txt" data-opt="format" value="' + esc(o.format || '') + '" placeholder="only if fixed, for example yyyyMMdd"></label>',
  num: o => '<label><input type="checkbox" data-opt="whole"' + (o.whole ? ' checked' : '') + '> Whole numbers (rounded)</label>',
  split: o => '<label><input type="checkbox" data-opt="keep"' + (o.keep !== false ? ' checked' : '') + '> Keep the original columns</label>',
  nulls: o => '<label class="row" style="flex:1 1 220px">Replace with <input type="text" class="txt" data-opt="value" value="' + esc(o.value || '') + '" placeholder="for example Unknown or 0"></label>',
  dedupe: o => '<label><input type="checkbox" data-opt="last"' + (o.last ? ' checked' : '') + '> Keep the last row instead of the first</label><label><input type="checkbox" data-opt="nocase"' + (o.nocase ? ' checked' : '') + '> Ignore upper and lower case</label>'
};
function fxOpt(id){ const all = state.v.fx || (state.v.fx = PWF.blankOpts()); return all[id] || (all[id] = PWF.blankOpts()[id]); }
function renderRecipes(cols){
  cols = cols || PW.parseColumns(state.v.columns);
  $('recipes').innerHTML = PWF.RECIPES.map(r => {
    const o = fxOpt(r.id), picked = new Set(o.cols || []);
    const need = r.cols && !r.all && o.on && !cols.some(c => picked.has(c.name));
    return '<div class="recipe" data-r="' + r.id + '"><label class="opts"><span><input type="checkbox" data-on="' + r.id + '"' + (o.on ? ' checked' : '') + '> ' + esc(r.label) + ' <span class="muted small">' + r.fx + '</span></span></label>'
      + '<div class="rbody"' + (o.on && (r.cols || R_OPTS[r.id] || r.hint) ? '' : ' hidden') + '>' + (r.hint ? '<p class="note small">' + esc(r.hint) + '</p>' : '')
      + (r.cols ? '<div class="colpick" role="group" aria-label="Columns for ' + esc(r.label) + '">' + cols.map(c => '<button type="button" data-col="' + esc(c.name) + '" aria-pressed="' + picked.has(c.name) + '">' + esc(c.name) + '</button>').join('') + '</div>' : '')
      + (R_OPTS[r.id] ? '<div class="row">' + R_OPTS[r.id](o) + '</div>' : '')
      + (need ? '<div class="msg info">Pick at least one column.</div>' : '') + '</div></div>';
  }).join('');
}
function renderFx(){
  const f = PW.fxInfo(inputs());
  state.fxCode = f.code;
  $('fxOut').hidden = !f.rs;
  $('fxStepsCode').textContent = f.code;
  const have = new Set(modelFns().map(n => n.toLowerCase())), fns = f.rs ? f.rs.fns : [];
  const inModel = fns.filter(n => have.has(n.toLowerCase())), toAdd = fns.filter(n => !have.has(n.toLowerCase()));
  state.fxTmdl = PWF.tmdl(toAdd);
  $('fxTmdl').textContent = state.fxTmdl;
  $('fxTmdlBox').hidden = $('fxOneBox').hidden = !toAdd.length;
  $('fxHave').innerHTML = inModel.length ? '<div class="msg ok">&#10003; Already in your model: ' + inModel.map(n => '<code>' + esc(n) + '</code>').join(', ') + '.' + (toAdd.length ? ' Add the others below.' : '') + '</div>' : '';
  $('fxFns').innerHTML = f.rs ? toAdd.map(n => { const fn = PWF.BY.get(n); return '<details class="extra"><summary><code>' + n + '</code> <span class="muted">' + esc(fn.does) + '</span></summary><div class="codebox"><div class="codebox-bar"><span class="t">Blank query &gt; Advanced Editor, then rename it ' + n + '</span><span class="r"><button class="btn" type="button" data-copyfn="' + n + '">Copy</button></span></div><pre class="short">' + esc(fn.code) + '</pre></div></details>'; }).join('') : '';
}
// what a recipe starts with when ticked: the date columns for dates, the date-time columns for splitting
function recipeDefaults(id, cols){
  if (id === 'date') return cols.filter(c => c.type === 'date').map(c => c.name);
  if (id === 'split') return cols.filter(c => c.type === 'datetime').map(c => c.name);
  return [];
}
function fxChanged(redraw){ if (redraw) renderRecipes(); renderFx(); renderPrompt(); renderReply(); persist(); }
function renderPrompt(){
  const v = state.v;
  state.prompt = v.goal.trim() ? PW.prompt(inputs()) : '';
  $('pwPromptView').textContent = state.prompt || 'Describe the query in Step 2 to build the prompt.';
  const n = state.prompt.length;
  $('promptTitle').textContent = 'Prompt for Copilot' + (n ? ' (' + n.toLocaleString() + ' characters)' : '');
  const tips = [];
  if (v.goal.trim() && !PW.parseColumns(v.columns).length) tips.push('No columns given: Copilot will have to guess names. Pasting a few rows from the preview in Step 3 (or picking a table from your model) makes the query far more likely to work first time.');
  $('promptMsg').innerHTML = tips.map(t => '<div class="msg info">' + esc(t) + '</div>').join('');
}
const LEVEL = { err: ['err', 'Fix'], warn: ['warn', 'Check'], info: ['skip', 'Note'], ok: ['ok', 'OK'] };
function renderReply(){
  const t = state.v.pwReply;
  const r = t.trim() ? PW.parseReply(t) : null;
  state.reply = r;
  $('result').hidden = !r || !!r.error;
  $('replyMsg').innerHTML = r && r.error ? '<div class="msg err">' + esc(r.error) + '</div>' : '';
  if (!r || r.error) return;
  const c = PW.checks(r.code, inputs());
  const order = { err: 0, warn: 1, info: 2, ok: 3 };
  $('checkList').innerHTML = c.list.slice().sort((a, b) => order[a.level] - order[b.level]).map(x => '<li><span class="pill ' + LEVEL[x.level][0] + '">' + LEVEL[x.level][1] + '</span><div><b>' + esc(x.title) + '</b>' + (x.step ? ' <span class="mono small">' + esc(x.step) + '</span>' : '') + '<p>' + esc(x.detail) + '</p></div></li>').join('');
  $('queryView').innerHTML = hlM(r.code);
  // steps with Copilot's explanation, in query order
  const q = c.q;
  if (!q.error && q.steps.length) {
    const ex = new Map(r.steps.map(s => [s.name.toLowerCase(), s.text]));
    $('stepsBox').innerHTML = '<h3 class="sub">What each step does</h3><div class="tablewrap"><table class="steps"><thead><tr><th>Step</th><th>Function</th><th>What it does</th></tr></thead><tbody>'
      + q.steps.map(s => '<tr><td class="mono">' + esc(s.name) + '</td><td class="mono muted">' + esc(s.fn || '') + '</td><td>' + esc(ex.get(s.name.toLowerCase()) || '') + '</td></tr>').join('') + '</tbody></table></div>';
  } else $('stepsBox').innerHTML = '';
  $('paramsBox').innerHTML = r.params.length ? '<h3 class="sub">Parameters to create first</h3><p class="note small">In Power Query: <b>Home &gt; Manage Parameters &gt; New Parameter</b>, or create a blank query, open the Advanced Editor and paste its line below, then rename the query to the parameter name.</p>'
    + r.params.map((p, i) => '<div class="codebox"><div class="codebox-bar"><span class="t">' + esc(p.name) + '</span><span class="r"><button class="btn" type="button" data-copyparam="' + i + '">Copy</button></span></div><pre class="short">' + esc(paramQuery(p)) + '</pre></div>').join('') : '';
  // a fixed reply says what it changed
  $('changesBox').innerHTML = (r.changes || []).length ? '<h3 class="sub">What Copilot changed</h3><div class="msg info"><ul class="qs">' + r.changes.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' : '';
  // the fix prompt: the Desktop error (or what's wrong) and the page's own findings
  const prob = (state.v.pwError || '').trim(), found = c.list.filter(x => x.level === 'err' || x.level === 'warn').length;
  state.fix = prob || found ? PW.fixPrompt(inputs(), r, c.list, prob) : '';
  $('fixBox').hidden = !state.fix; $('pwFixView').textContent = state.fix;
  $('fixMsg').innerHTML = state.fix ? (prob ? '' : '<div class="msg info">The prompt below asks Copilot to fix the ' + found + ' problem' + (found === 1 ? '' : 's') + ' the page found. Add the error from Desktop above if there is one.</div>')
    : '<div class="msg ok">Nothing to fix from the checks. If Desktop shows an error or the result is wrong, describe it above and a fix prompt appears.</div>';
  $('questionsBox').innerHTML = r.questions.length ? '<h3 class="sub">Copilot&rsquo;s assumptions and questions</h3><div class="msg info"><ul class="qs">' + r.questions.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>Answer them in Step 2 and send the prompt again if they change the query.</div>' : '';
}
function renderAll(){ renderModel(); renderStart(); renderCols(); renderPrompt(); renderReply(); }

/* ---------- persistence ---------- */
function persist(){ store.set('v', state.example ? '' : JSON.stringify(state.v)); }
function setExample(on){ state.example = on; $('exampleBanner').hidden = !on; }
function leaveExample(keep){
  if (!state.example) return;
  const v = blank(); if (keep) v[keep] = state.v[keep];
  state.v = v; setExample(false); toForm();
}

/* ---------- init ---------- */
function resetAll(){ state.v = blank(); setExample(false); toForm(); $('moreBox').open = false; renderAll(); }
function init(){
  $('source').innerHTML = PW.SOURCES.map(s => '<option value="' + s[0] + '">' + esc(s[1]) + '</option>').join('');
  let saved = null; try { saved = JSON.parse(store.get('v') || 'null'); } catch (e) {}
  if (saved) { const b = blank(); state.v = Object.assign(b, saved); const fx = PWF.blankOpts(); Object.keys(fx).forEach(k => Object.assign(fx[k], (saved.fx || {})[k] || {})); state.v.fx = fx; }
  else if (store.get('blank') !== '1') { state.v = Object.assign(blank(), { goal: PW_EX.goal, start: PW_EX.start, source: PW_EX.source, sourceDetail: PW_EX.sourceDetail, columns: PW_EX.columns, merges: PW_EX.merges, params: PW_EX.params, culture: PW_EX.culture, makeParams: PW_EX.makeParams, pwReply: PW_EX.reply }); setExample(true); }
  toForm(); renderAll();

  FIELDS.forEach(k => $(k).addEventListener('input', () => {
    // typing anything of your own replaces the whole example
    if (state.example) { const val = SF_SUITE.ownText($(k).value, state.v[k] || ''); leaveExample(); state.v[k] = val; $(k).value = val; }
    else state.v[k] = $(k).value;
    try { localStorage.removeItem(PREFIX + 'blank'); } catch (e) {}
    if (k === 'pwReply' || k === 'pwError') renderReply(); else if (k === 'columns' || k === 'culture') { renderCols(); renderPrompt(); renderReply(); } else if (k === 'existing') { renderStart(); renderPrompt(); } else { renderPrompt(); if (k === 'params' || k === 'merges' || k === 'myFns') renderReply(); }
    persist();
  }));
  $('exportView').textContent = BC.DAX_QUERY;
  try { state.mq = JSON.parse(store.get('mq') || 'null'); if (!state.mq || !Array.isArray(state.mq.queries)) state.mq = null; } catch (e) { state.mq = null; }
  $('modelInput').addEventListener('input', () => loadModel());
  document.addEventListener('sf-pbip-folder', e => loadFolderQueries(e.detail.root, e.detail.list).catch(() => {}));
  $('pickTable').addEventListener('change', () => pickTable($('pickTable').value));
  $('mergePick').addEventListener('change', () => {
    const t = modelTables().find(x => x.name === $('mergePick').value); $('mergePick').value = ''; if (!t) return;
    leaveExample();
    const line = t.name + ': ' + t.cols.map(c => c.name).join(', ');
    const cur = state.v.merges.split('\n').filter(l => l.trim() && l.split(':')[0].trim() !== t.name);
    state.v.merges = cur.concat([line]).join('\n'); $('merges').value = state.v.merges;
    try { localStorage.removeItem(PREFIX + 'blank'); } catch (e) {}
    renderPrompt(); renderReply(); persist();
  });
  loadModel(true);
  $('source').addEventListener('change', () => { leaveExample(); state.v.source = $('source').value; renderStart(); renderPrompt(); persist(); });
  $('makeParams').addEventListener('change', () => { state.v.makeParams = $('makeParams').checked; renderPrompt(); persist(); });
  $('typeMap').addEventListener('change', () => { state.v.typeMap = $('typeMap').checked; renderCols(); renderPrompt(); renderReply(); persist(); });
  $('typeSteps').addEventListener('change', () => { state.v.typeHow = $('typeSteps').checked ? 'steps' : 'fx'; renderCols(); renderPrompt(); renderReply(); persist(); });
  $('haveFx').addEventListener('change', () => { state.v.haveFx = $('haveFx').checked; renderPrompt(); renderReply(); persist(); });
  $('recipes').addEventListener('change', e => {
    const t = e.target, box = t.closest('.recipe'); if (!box) return;
    const id = box.dataset.r, o = fxOpt(id);
    if (t.dataset.on) { o.on = t.checked; if (o.on && !(o.cols || []).length) o.cols = recipeDefaults(id, PW.parseColumns(state.v.columns)); fxChanged(true); }
    else if (t.dataset.opt) { o[t.dataset.opt] = t.type === 'checkbox' ? t.checked : t.value; fxChanged(t.tagName === 'SELECT' ? false : t.type === 'checkbox'); }
  });
  $('recipes').addEventListener('input', e => { const t = e.target, box = t.closest('.recipe'); if (!box || !t.dataset.opt || t.type === 'checkbox') return; fxOpt(box.dataset.r)[t.dataset.opt] = t.value; fxChanged(false); });
  $('recipes').addEventListener('click', e => {
    const b = e.target.closest('button[data-col]'), box = b && b.closest('.recipe'); if (!box) return;
    const o = fxOpt(box.dataset.r), n = b.dataset.col, cs = new Set(o.cols || []);
    if (cs.has(n)) cs.delete(n); else cs.add(n);
    o.cols = PW.parseColumns(state.v.columns).map(c => c.name).filter(c => cs.has(c));
    fxChanged(true);
    const again = document.querySelector('.recipe[data-r="' + box.dataset.r + '"] button[data-col="' + CSS.escape(n) + '"]'); if (again) again.focus();
  });
  document.querySelectorAll('input[name=start]').forEach(i => i.addEventListener('change', () => { leaveExample(); state.v.start = i.value; toForm(); renderAll(); persist(); }));
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.copy === 'prompt' && state.prompt) copyText(state.prompt, b);
    else if (b.dataset.copy === 'query' && state.reply) copyText(state.reply.code, b);
    else if (b.dataset.copy === 'fix' && state.fix) copyText(state.fix, b);
    else if (b.dataset.copy === 'typemap') copyText($('typeMapCode').textContent, b);
    else if (b.dataset.copy === 'steps' && state.fxCode) copyText(state.fxCode, b);
    else if (b.dataset.copy === 'fxtmdl' && state.fxTmdl) copyText(state.fxTmdl, b);
    else if (b.dataset.copy === 'export') copyText(BC.DAX_QUERY, b);
    else if (b.dataset.copyfn && PWF.BY.get(b.dataset.copyfn)) copyText(PWF.BY.get(b.dataset.copyfn).code, b);
    else if (b.dataset.copyparam != null && state.reply) copyText(paramQuery(state.reply.params[+b.dataset.copyparam]), b);
  });
  $('clearAll').addEventListener('click', () => { resetAll(); try { localStorage.setItem(PREFIX + 'blank', '1'); } catch (e) {} persist(); $('goal').focus(); });
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
