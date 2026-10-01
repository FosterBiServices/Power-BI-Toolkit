
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

const FIELDS = ['goal', 'sourceDetail', 'existing', 'columns', 'merges', 'params', 'culture', 'pwReply'];
const blank = () => ({ goal: '', start: 'new', source: 'sql', sourceDetail: '', existing: '', columns: '', merges: '', params: '', culture: '', makeParams: true, pwReply: '' });
const state = { example: false, v: blank(), prompt: '', reply: null };

function inputs(){
  const v = state.v, ex = v.start === 'existing' && v.existing.trim() ? parseM(v.existing) : null;
  return { goal: v.goal, start: v.start, source: v.source, sourceDetail: v.sourceDetail, existing: v.existing, existingDb: ex && !ex.error && sourceInfo(ex).kind === 'database',
    columns: v.columns, merges: v.merges, params: v.params, culture: v.culture, makeParams: v.makeParams };
}
function toForm(){
  const v = state.v;
  FIELDS.forEach(k => { $(k).value = v[k] || ''; });
  $('source').value = v.source; $('makeParams').checked = v.makeParams;
  document.querySelectorAll('input[name=start]').forEach(i => { i.checked = i.value === v.start; });
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
}
function renderPrompt(){
  const v = state.v;
  state.prompt = v.goal.trim() ? PW.prompt(inputs()) : '';
  $('pwPromptView').textContent = state.prompt || 'Describe the query in Step 1 to build the prompt.';
  const n = state.prompt.length;
  $('promptTitle').textContent = 'Prompt for Copilot' + (n ? ' (' + n.toLocaleString() + ' characters)' : '');
  const tips = [];
  if (v.goal.trim() && !PW.parseColumns(v.columns).length) tips.push('No columns given: Copilot will have to guess names. Pasting a few rows from the preview in Step 2 makes the query far more likely to work first time.');
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
  $('questionsBox').innerHTML = r.questions.length ? '<h3 class="sub">Copilot&rsquo;s assumptions and questions</h3><div class="msg info"><ul class="qs">' + r.questions.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>Answer them in Step 1 and send the prompt again if they change the query.</div>' : '';
}
function renderAll(){ renderStart(); renderCols(); renderPrompt(); renderReply(); }

/* ---------- persistence ---------- */
// what was typed or pasted into an example field, without the example text around it
function ownText(val, ex){
  if (!ex) return val;
  let p = 0; while (p < val.length && p < ex.length && val[p] === ex[p]) p++;
  let q = 0; while (q < val.length - p && q < ex.length - p && val[val.length - 1 - q] === ex[ex.length - 1 - q]) q++;
  return val.slice(p, val.length - q).trim();
}
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
  if (saved) state.v = Object.assign(blank(), saved);
  else if (store.get('blank') !== '1') { state.v = Object.assign(blank(), { goal: PW_EX.goal, start: PW_EX.start, source: PW_EX.source, sourceDetail: PW_EX.sourceDetail, columns: PW_EX.columns, merges: PW_EX.merges, params: PW_EX.params, culture: PW_EX.culture, makeParams: PW_EX.makeParams, pwReply: PW_EX.reply }); setExample(true); }
  toForm(); renderAll();

  FIELDS.forEach(k => $(k).addEventListener('input', () => {
    // typing anything of your own replaces the whole example
    if (state.example) { const val = ownText($(k).value, state.v[k] || ''); leaveExample(); state.v[k] = val; $(k).value = val; }
    else state.v[k] = $(k).value;
    try { localStorage.removeItem(PREFIX + 'blank'); } catch (e) {}
    if (k === 'pwReply') renderReply(); else if (k === 'columns') { renderCols(); renderPrompt(); renderReply(); } else if (k === 'existing') { renderStart(); renderPrompt(); } else { renderPrompt(); if (k === 'params' || k === 'merges') renderReply(); }
    persist();
  }));
  $('source').addEventListener('change', () => { leaveExample(); state.v.source = $('source').value; renderStart(); renderPrompt(); persist(); });
  $('makeParams').addEventListener('change', () => { state.v.makeParams = $('makeParams').checked; renderPrompt(); persist(); });
  document.querySelectorAll('input[name=start]').forEach(i => i.addEventListener('change', () => { leaveExample(); state.v.start = i.value; toForm(); renderAll(); persist(); }));
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.copy === 'prompt' && state.prompt) copyText(state.prompt, b);
    else if (b.dataset.copy === 'query' && state.reply) copyText(state.reply.code, b);
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
