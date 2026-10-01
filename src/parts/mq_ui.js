
/* ---------- example data ---------- */
const EX_NAME = 'Sales';
const EX_QUERY = [
 'let',
 '    Source = Excel.Workbook(File.Contents("C:\\Users\\jsmith\\Documents\\Sales\\Sales 2025.xlsx"), null, true),',
 '    Orders_Sheet = Source{[Item="Orders",Kind="Sheet"]}[Data],',
 '    #"Promoted Headers" = Table.PromoteHeaders(Orders_Sheet, [PromoteAllScalars=true]),',
 '    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Order ID", type text}, {"Order Date", type date}, {"Customer", type text}, {"Region", type text}, {"Quantity", Int64.Type}, {"Unit Price", type number}, {"Discount", type number}, {"Notes", type text}}),',
 '    #"Filtered Rows" = Table.SelectRows(#"Changed Type", each [Order Date] <> null),',
 '    #"Removed Columns" = Table.RemoveColumns(#"Filtered Rows",{"Notes"}),',
 '    #"Added Custom" = Table.AddColumn(#"Removed Columns", "Net Amount", each [Quantity] * [Unit Price] * (1 - [Discount])),',
 '    #"Changed Type1" = Table.TransformColumnTypes(#"Added Custom",{{"Net Amount", type number}}),',
 '    #"Sorted Rows" = Table.Sort(#"Changed Type1",{{"Order Date", Order.Descending}}),',
 '    #"Filtered Rows1" = Table.SelectRows(#"Sorted Rows", each [Region] <> "Test"),',
 '    #"Duplicated Column" = Table.DuplicateColumn(#"Filtered Rows1", "Region", "Region - Copy"),',
 '    #"Renamed Columns" = Table.RenameColumns(#"Filtered Rows1",{{"Customer", "Customer Name"}})',
 'in',
 '    #"Renamed Columns"'].join('\n');
const EX_EXPLAIN = '```\n@@@ SUMMARY @@@\nLoads order lines from the Orders sheet of the Sales 2025 workbook. It sets column types, drops undated and test orders, removes the Notes column and adds Net Amount after discount. One row is one order line.\n@@@ END @@@\n'
 + [['Source', 'Opens the Sales 2025 workbook from a personal Documents folder.', 'The path only works on this computer; a parameter or shared location is safer.'],
    ['Orders_Sheet', 'Picks the Orders sheet from the workbook.', ''],
    ['Promoted Headers', 'Uses the first row as column names.', ''],
    ['Changed Type', 'Sets the type of each column: dates, whole numbers, decimals and text.', ''],
    ['Filtered Rows', 'Keeps only rows that have an Order Date.', ''],
    ['Removed Columns', 'Removes the Notes column.', ''],
    ['Added Custom', 'Adds Net Amount as Quantity times Unit Price, less the Discount.', ''],
    ['Changed Type1', 'Sets Net Amount to a decimal number.', 'Could be set directly in the Added Custom step instead.'],
    ['Sorted Rows', 'Sorts orders by Order Date, newest first.', 'The model doesn\'t keep row order, so this sort has no effect on reports.'],
    ['Filtered Rows1', 'Removes rows where Region is "Test".', ''],
    ['Duplicated Column', 'Copies Region into a new Region - Copy column.', 'Nothing uses this step, so the copy never reaches the result.'],
    ['Renamed Columns', 'Renames Customer to Customer Name.', '']]
   .map(([n, c, x]) => '@@@ STEP @@@\nNAME: ' + n + '\nCOMMENT: ' + c + (x ? '\nNOTE: ' + x : '') + '\n@@@ END @@@').join('\n') + '\n```';
const EX_CLEAN = '```\n@@@ CODE @@@\n' + [
 'let',
 '    Source = Excel.Workbook(File.Contents(SalesFilePath), null, true),',
 '    OrdersSheet = Source{[Item="Orders",Kind="Sheet"]}[Data],',
 '    #"Used First Row As Headers" = Table.PromoteHeaders(OrdersSheet, [PromoteAllScalars=true]),',
 '    #"Set Column Types" = Table.TransformColumnTypes(#"Used First Row As Headers",{{"Order ID", type text}, {"Order Date", type date}, {"Customer", type text}, {"Region", type text}, {"Quantity", Int64.Type}, {"Unit Price", type number}, {"Discount", type number}, {"Notes", type text}}),',
 '    #"Kept Dated Non-Test Orders" = Table.SelectRows(#"Set Column Types", each [Order Date] <> null and [Region] <> "Test"),',
 '    #"Dropped Notes" = Table.RemoveColumns(#"Kept Dated Non-Test Orders",{"Notes"}),',
 '    #"Added Net Amount" = Table.AddColumn(#"Dropped Notes", "Net Amount", each [Quantity] * [Unit Price] * (1 - [Discount]), type number),',
 '    #"Renamed Customer" = Table.RenameColumns(#"Added Net Amount",{{"Customer", "Customer Name"}})',
 'in',
 '    #"Renamed Customer"'].join('\n')
 + '\n@@@ END @@@\n@@@ PARAMETER @@@\nNAME: SalesFilePath\nTYPE: Text\nVALUE: C:\\Users\\jsmith\\Documents\\Sales\\Sales 2025.xlsx\n@@@ END @@@\n'
 + '@@@ CHANGES @@@\n- Replaced the file path with the SalesFilePath parameter.\n- Renamed default steps to say what they do.\n- Combined the two row filters into one step.\n- Set the Net Amount type inside Table.AddColumn and removed the second type step.\n- Removed the unused Duplicated Column step and the sort, which doesn\'t affect the loaded table.\n- Suggestion (not applied): Table.SelectColumns would keep an explicit column list instead of removing Notes by name.\n@@@ END @@@\n```';

const EX_MODEL_QUERIES = [
 { name: 'Customers', loaded: true, code: ['let',
 '    Source = Sql.Database("sql01", "Retail"),',
 '    dbo_Customer = Source{[Schema="dbo",Item="Customer"]}[Data],',
 '    #"Removed Other Columns" = Table.SelectColumns(dbo_Customer,{"CustomerKey", "Name", "RegionKey", "Segment"}),',
 '    #"Merged Queries" = Table.NestedJoin(#"Removed Other Columns", {"RegionKey"}, Regions, {"RegionKey"}, "Regions", JoinKind.LeftOuter),',
 '    #"Expanded Regions" = Table.ExpandTableColumn(#"Merged Queries", "Regions", {"Region"}, {"Region"}),',
 '    #"Cleaned Names" = Table.TransformColumns(#"Expanded Regions", {{"Name", fnCleanText, type text}})',
 'in',
 '    #"Cleaned Names"'].join('\n') },
 { name: 'Returns', loaded: true, code: ['let',
 '    Source = Excel.Workbook(File.Contents("C:\\Users\\jsmith\\Documents\\Sales\\Sales 2025.xlsx"), null, true),',
 '    Returns_Sheet = Source{[Item="Returns",Kind="Sheet"]}[Data],',
 '    #"Promoted Headers" = Table.PromoteHeaders(Returns_Sheet, [PromoteAllScalars=true]),',
 '    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"Order ID", type text}, {"Return Date", type date}, {"Quantity", Int64.Type}, {"Reason", type text}}),',
 '    #"Filtered Rows" = Table.SelectRows(#"Changed Type", each [Return Date] >= ReportStartDate)',
 'in',
 '    #"Filtered Rows"'].join('\n') },
 { name: 'Sales', loaded: true, code: EX_QUERY },
 { name: 'Regions', loaded: false, code: ['let',
 '    Source = Sql.Database("sql01", "Retail"),',
 '    dbo_Region = Source{[Schema="dbo",Item="Region"]}[Data]',
 'in',
 '    dbo_Region'].join('\n') },
 { name: 'Sales Old Extract', loaded: false, code: ['let',
 '    Source = Csv.Document(File.Contents("C:\\Users\\jsmith\\Downloads\\sales_old.csv"),[Delimiter=",", Encoding=65001]),',
 '    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true])',
 'in',
 '    #"Promoted Headers"'].join('\n') },
 { name: 'fnCleanText', loaded: false, code: ['(txt as nullable text) as nullable text =>',
 'let',
 '    Trimmed = if txt = null then null else Text.Trim(txt),',
 '    Proper = if Trimmed = null then null else Text.Proper(Trimmed)',
 'in',
 '    Proper'].join('\n') },
 { name: 'ReportStartDate', loaded: false, code: '#date(2024, 2, 1) meta [IsParameterQuery=true, Type="Date", IsParameterQueryRequired=true]' }
];
const EX_MODEL_EXPORT = 'Kind\tName\tCode\n' + EX_MODEL_QUERIES.map(x => [x.loaded ? 'Table' : 'Query', x.name, x.code.split('\n').join('\u21B5')].join('\t')).join('\n');
const EX_MODEL_REPLY = '```\n'
 + '@@@ SUMMARY @@@\nQUERY: Customers\nTEXT: Loads customers from the Retail database, keeps four columns, adds each customer\'s region name from the Regions query, and tidies the names. One row is one customer.\n@@@ END @@@\n'
 + [['Customers', 'Source', 'Connects to the Retail database on server sql01.', ''],
    ['Customers', 'dbo_Customer', 'Picks the dbo.Customer table.', ''],
    ['Customers', 'Removed Other Columns', 'Keeps only CustomerKey, Name, RegionKey and Segment.', ''],
    ['Customers', 'Merged Queries', 'Looks up each customer\'s region in the Regions query by RegionKey.', ''],
    ['Customers', 'Expanded Regions', 'Adds the Region name from the lookup.', ''],
    ['Customers', 'Cleaned Names', 'Trims customer names and capitalizes each word using fnCleanText.', '']]
   .map(([q, n, c, x]) => '@@@ STEP @@@\nQUERY: ' + q + '\nNAME: ' + n + '\nCOMMENT: ' + c + (x ? '\nNOTE: ' + x : '') + '\n@@@ END @@@').join('\n')
 + '\n@@@ SUMMARY @@@\nQUERY: Returns\nTEXT: Loads returned order lines from the Returns sheet of the Sales 2025 workbook and keeps returns from the report start date on. One row is one returned order line.\n@@@ END @@@\n'
 + [['Returns', 'Source', 'Opens the Sales 2025 workbook from a personal Documents folder.', 'The same path is typed into the Sales query; a shared parameter is safer.'],
    ['Returns', 'Returns_Sheet', 'Picks the Returns sheet.', ''],
    ['Returns', 'Promoted Headers', 'Uses the first row as column names.', ''],
    ['Returns', 'Changed Type', 'Sets Order ID and Reason to text, Return Date to date and Quantity to whole number.', ''],
    ['Returns', 'Filtered Rows', 'Keeps returns on or after the ReportStartDate parameter.', '']]
   .map(([q, n, c, x]) => '@@@ STEP @@@\nQUERY: ' + q + '\nNAME: ' + n + '\nCOMMENT: ' + c + (x ? '\nNOTE: ' + x : '') + '\n@@@ END @@@').join('\n') + '\n```';

/* ---------- state + UI ---------- */
const $ = id => document.getElementById(id);
const PREFIX = 'kpq.';
const store = {
  get(k){ try { return localStorage.getItem(PREFIX + k); } catch (e) { return null; } },
  set(k, v){ try { localStorage.setItem(PREFIX + k, v); } catch (e) {} }
};
const DEFAULT_OPTS = () => ({ rename: true, merge: true, unused: true, params: true, comments: false });
const state = {
  example: false, tab: 'ex', audience: 'mixed', opts: DEFAULT_OPTS(), exNotes: true, exSummary: true,
  exReply: '', clReply: '', q: null, checks: [],
  mode: 'one', m: null, mDone: {}, mAsked: {}, mPick: {}, mLastBatch: [], mBatch: '3', mNotes: true, mSummary: true,
  out: { exPrompt: '', exFollow: '', commented: '', clPrompt: '', clean: '', mExport: '', mPrompt: '', mAll: '' }
};
const LONG_PROMPT = 14000;

function esc(s){ return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
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
  const fallback = () => {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    if (ok) done(); else { btn.textContent = 'Select and copy manually'; setTimeout(() => { btn.textContent = btn.dataset.label || 'Copy'; }, 2200); }
  };
  try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
}
function msg(level, html){ return '<div class="msg ' + level + '">' + html + '</div>'; }
function setExample(on){ state.example = on; $('exampleBanner').hidden = !on; }
function leaveExample(){ if (state.example) { setExample(false); persist(); } }
function persist(){
  if (state.example) return;
  store.set('query', $('qInput').value);
  store.set('model', $('mInput').value);
  store.set('state', JSON.stringify({ name: $('qName').value, tab: state.tab, audience: state.audience, opts: state.opts, exNotes: state.exNotes, exSummary: state.exSummary, exReply: state.exReply, clReply: state.clReply,
    mode: state.mode, mDone: state.mDone, mAsked: state.mAsked, mPick: state.mPick, mLastBatch: state.mLastBatch, mBatch: state.mBatch, mNotes: state.mNotes, mSummary: state.mSummary }));
}
function src(){ return $('qInput').value; }
function optName(){ return $('qName').value.trim(); }

/* ---------- step 1 + 2 ---------- */
function renderQuery(){
  const text = src();
  state.q = null; state.checks = [];
  const has = !!text.trim();
  let m = '';
  if (has) {
    const q = parseM(text);
    if (q.error) m = msg('err', '<b>This query can&rsquo;t be read.</b> ' + esc(q.error));
    else if (!q.steps.length) m = msg('err', 'No steps were found between <code>let</code> and <code>in</code>.');
    else { state.q = q; state.checks = healthChecks(q); }
    if (state.q && functionReason(text, optName(), '')) m = msg('info', 'This query is a function. Its steps are explained as usual; the Step 2 findings are written for queries that load data, so some may not apply.');
  }
  $('qMsg').innerHTML = m;
  const ok = !!state.q;
  $('mapStep').hidden = !ok; $('tabs').hidden = !ok;
  $('paneEx').hidden = !ok || state.tab !== 'ex'; $('paneCl').hidden = !ok || state.tab !== 'cl';
  if (!ok) return;
  const q = state.q, checks = state.checks;
  const si = sourceInfo(q);
  const warns = checks.filter(c => c.level === 'warn').length, infos = checks.length - warns;
  $('qStats').innerHTML = '<span class="stat"><b>' + q.steps.length + '</b> steps</span>'
    + (si.fn ? '<span class="stat">Source <b>' + esc(si.fn) + '</b></span>' : '')
    + (si.kind === 'database' ? '<span class="stat remote">Database: query folding matters</span>' : '')
    + '<span class="stat' + (warns ? ' limited' : '') + '"><b>' + warns + '</b> to fix</span>'
    + '<span class="stat"><b>' + infos + '</b> to consider</span>';
  const byStep = {};
  checks.forEach(c => { (c.step ? c.step.split(', ') : []).forEach(s => { (byStep[s] = byStep[s] || []).push(c); }); });
  $('mapBody').innerHTML = q.steps.map((s, i) => {
    const f = byStep[s.name] || [];
    return '<tr' + (f.some(c => c.level === 'warn') ? ' class="flagged"' : '') + '><td class="n">' + (i + 1) + '</td><td class="nm">' + esc(s.name) + '</td><td class="fmt">' + esc(s.fn || '') + '</td><td class="uses">' + (s.refs.length ? s.refs.map(esc).join(', ') : '<span class="muted">&ndash;</span>') + '</td><td>'
      + f.map(c => '<span class="pill ' + (c.level === 'warn' ? 'warn' : 'replace') + '">' + esc(c.title) + '</span>').join(' ') + '</td></tr>';
  }).join('');
  $('findings').innerHTML = checks.length
    ? '<h3>Findings</h3><ul class="flist">' + checks.map(c => '<li class="' + c.level + '"><span class="pill ' + (c.level === 'warn' ? 'warn' : 'replace') + '">' + (c.level === 'warn' ? 'Fix' : 'Consider') + '</span><div><b>' + esc(c.title) + '</b>' + (c.step ? ' <span class="mono muted">' + esc(c.step) + '</span>' : '') + '<p>' + esc(c.detail) + '</p></div></li>').join('') + '</ul>'
    : msg('ok', 'No findings. The steps are named, used and in a sensible order.');
}

/* ---------- explain ---------- */
function followUpPrompt(text, q, missing, audience, name){
  const L = explainPrompt(text, q, { audience, name }).split('\n');
  const i = L.indexOf('## CONTEXT: the steps');
  const head = L.slice(0, i).filter(l => !/^- SUMMARY:/.test(l)).join('\n')
    .replace(/Write a short comment for every step listed under CONTEXT, and a summary of the whole query\./, 'Some steps are still missing comments. Write a comment for ONLY the steps listed under CONTEXT.')
    .replace(/@@@ SUMMARY @@@\nTwo to four sentences\.\n@@@ END @@@\n/, '')
    .replace('One STEP block per step, in the order listed', 'One STEP block for each listed step');
  return head + '\n## CONTEXT: the steps\n' + missing.map((n, k) => (k + 1) + '. ' + n).join('\n') + '\n\n## STARTING POINT: the query\n' + text.trim() + '\n\n=== END OF PROMPT ===';
}
function lenNote(p){ return p.length > LONG_PROMPT ? msg('warn', 'This prompt is long (' + p.length.toLocaleString() + ' characters). If Copilot cuts it off or stops early, the follow-up in Step 4 picks up the missing steps.') : ''; }
function renderExplain(){
  if (!state.q) return;
  const text = src(), q = state.q;
  state.out.exPrompt = explainPrompt(text, q, { audience: state.audience, name: optName() });
  $('exPromptView').textContent = state.out.exPrompt;
  $('exCount').textContent = state.out.exPrompt.length.toLocaleString() + ' characters';
  $('exLong').innerHTML = lenNote(state.out.exPrompt);
  const ex = parseExplain(state.exReply);
  const has = !!state.exReply.trim();
  $('exOut').hidden = true; $('exMore').hidden = true;
  if (!has) { $('exMsg').innerHTML = ''; return; }
  if (ex.error) { $('exMsg').innerHTML = msg('err', esc(ex.error)); return; }
  const cc = commentedCode(text, q, ex, { notes: state.exNotes, summary: state.exSummary });
  state.out.commented = cc.code;
  const m = [];
  if (!cc.missing.length) m.push(msg('ok', 'Every step has a comment (' + cc.total + ' of ' + cc.total + ').'));
  else m.push(msg('warn', cc.matched + ' of ' + cc.total + ' steps have a comment. Missing: ' + cc.missing.map(n => '<code>' + esc(n) + '</code>').join(', ') + '. Use the follow-up prompt below.'));
  if (cc.unknown.length) m.push(msg('info', 'Ignored comments for steps that aren&rsquo;t in this query: ' + cc.unknown.map(n => '<code>' + esc(n) + '</code>').join(', ') + '. If you changed the query after asking Copilot, copy the prompt again.'));
  $('exMsg').innerHTML = m.join('');
  if (cc.missing.length) {
    state.out.exFollow = followUpPrompt(text, q, cc.missing, state.audience, optName());
    $('exFollowView').textContent = state.out.exFollow; $('exMore').hidden = false;
  }
  $('exOut').hidden = false;
  $('commentedView').innerHTML = hlM(cc.code);
  $('exSumBox').innerHTML = ex.summary ? '<div class="tip"><b>Summary.</b> ' + esc(ex.summary) + '</div>' : '';
  const byName = new Map(ex.steps.map(s => [lc(s.name), s]));
  $('exBody').innerHTML = q.steps.map(s => {
    const e = byName.get(lc(s.name));
    return '<tr><td class="nm">' + esc(s.name) + '</td><td>' + (e ? esc(e.comment) + (e.note ? '<div class="snote"><b>Note:</b> ' + esc(e.note) + '</div>' : '') : '<span class="pill skip">No comment yet</span>') + '</td></tr>';
  }).join('');
}

/* ---------- clean up ---------- */
function renderClean(){
  if (!state.q) return;
  const text = src(), q = state.q;
  state.out.clPrompt = cleanupPrompt(text, q, state.checks, Object.assign({ name: optName() }, state.opts));
  $('clPromptView').textContent = state.out.clPrompt;
  $('clCount').textContent = state.out.clPrompt.length.toLocaleString() + ' characters';
  $('clLong').innerHTML = state.out.clPrompt.length > LONG_PROMPT ? msg('warn', 'This prompt is long (' + state.out.clPrompt.length.toLocaleString() + ' characters). If Copilot&rsquo;s cleaned query stops partway, the check in Step 4 will say so; try again with fewer options ticked.') : '';
  $('clOut').hidden = true;
  if (!state.clReply.trim()) { $('clMsg').innerHTML = ''; return; }
  const pc = parseCleanup(state.clReply);
  if (pc.error) { $('clMsg').innerHTML = msg('err', esc(pc.error)); return; }
  $('clMsg').innerHTML = '';
  const cq = parseM(pc.code);
  state.out.clean = pc.code;
  const notes = checkCleanup(q, cq, pc.params);
  if (!cq.error) notes.unshift({ level: 'info', text: q.steps.length + ' steps before, ' + cq.steps.length + ' after.' });
  const order = { err: 0, warn: 1, ok: 2, info: 3 };
  $('clChecks').innerHTML = notes.slice().sort((a, b) => order[a.level] - order[b.level]).map(n => msg(n.level, esc(n.text))).join('')
    + (notes.some(n => n.level === 'err') ? msg('err', '<b>Don&rsquo;t paste this version yet.</b> Paste the problems above back into Copilot and ask it to fix them, then paste its new reply here.') : '');
  const used = pc.params.filter(p => new RegExp('(^|[^A-Za-z0-9_.])' + p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^A-Za-z0-9_.]|$)').test(pc.code) || pc.code.includes('#"' + p.name + '"'));
  state.out.params = {};
  $('clParams').innerHTML = used.length ? '<div class="params"><h3>Create ' + (used.length > 1 ? 'these parameters' : 'this parameter') + ' first</h3><p class="note">In Power Query, select <b>Home &gt; New Source &gt; Blank Query</b>, open its <b>Advanced Editor</b>, paste the code, then rename the query to the name shown. Or use <b>Home &gt; Manage Parameters &gt; New Parameter</b> with the same name, type and value.</p>'
    + used.map((p, i) => { const code = paramQuery(p); state.out['param' + i] = code; return '<div class="codebox"><div class="codebox-bar"><span class="t">' + esc(p.name) + ' <span class="muted">' + esc(p.type) + '</span></span><span class="r"><button class="btn" type="button" data-copy="param' + i + '">Copy</button></span></div><pre>' + hlM(code) + '</pre></div>'; }).join('') + '</div>' : '';
  $('applyParams').hidden = !used.length;
  $('cleanView').innerHTML = hlM(pc.code);
  const d = lineDiff(text.trim(), pc.code.trim());
  if (d) {
    const adds = d.filter(x => x.t === '+').length, dels = d.filter(x => x.t === '-').length;
    $('diffStat').textContent = '(' + dels + ' line' + (dels === 1 ? '' : 's') + ' removed, ' + adds + ' added)';
    $('diffView').innerHTML = d.map(x => '<span class="dl ' + (x.t === '+' ? 'add' : x.t === '-' ? 'del' : 'same') + '"><span class="dm">' + (x.t === ' ' ? ' ' : x.t) + '</span>' + esc(x.v) + '</span>').join('');
    $('diffBox').hidden = false;
  } else $('diffBox').hidden = true;
  $('clChanges').innerHTML = pc.changes.length ? '<h3>What Copilot changed</h3><ul class="changes">' + pc.changes.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul>' : '';
  $('clOut').hidden = false;
}

function setTab(t){
  state.tab = t;
  $('tabEx').setAttribute('aria-selected', t === 'ex'); $('tabCl').setAttribute('aria-selected', t === 'cl');
  if (state.q) { $('paneEx').hidden = t !== 'ex'; $('paneCl').hidden = t !== 'cl'; }
}
/* ---------- whole model ---------- */
function codeHash(s){ let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
function mPickable(i){ return !!(i.q && i.q.steps.length); }
function mPicked(i){ const p = state.mPick[i.name]; return mPickable(i) && (typeof p === 'boolean' ? p : i.type !== 'function'); }
function mDoneFor(i){
  const d = state.mDone[i.name];
  return d && d.h === codeHash(i.code) ? d : null;
}
function mStatus(i){
  const d = mDoneFor(i) || { summary: '', steps: {} };
  const missing = i.q ? i.q.steps.filter(s => !d.steps[lc(s.name)]).map(s => s.name) : [];
  const needSummary = !d.summary;
  const complete = !missing.length && !needSummary;
  const gaveUp = !complete && (state.mAsked[i.name] || 0) >= 2;
  return { d, missing, needSummary, complete, gaveUp, started: !!(d.summary || Object.keys(d.steps).length) };
}
function mBatchList(){
  if (!state.m) return [];
  const queue = state.m.items.filter(i => mPicked(i)).filter(i => { const s = mStatus(i); return !s.complete && !s.gaveUp; });
  const max = +state.mBatch || 3, out = [];
  for (const i of queue) {
    const s = mStatus(i);
    const b = { name: i.name, type: i.type, code: i.code, q: i.q, steps: s.missing, summary: s.needSummary };
    if (out.length && (out.length >= max || modelExplainPrompt(out.concat(b), { audience: state.audience }).length > LONG_PROMPT)) break;
    out.push(b);
  }
  return out;
}
const FN_WHY = { model: 'Power BI says so', code: 'from its code', name: 'from its name' };
function renderModel(){
  const text = $('mInput').value;
  const ex = parseMExport(text);
  state.m = null;
  $('mMsg').innerHTML = ex.error ? msg('err', esc(ex.error)) : '';
  if (!ex.error && ex.queries.length) state.m = analyzeModel(ex.queries);
  const ok = !!state.m;
  $('mCheck').hidden = !ok; $('mStep3').hidden = !ok; $('mStep4').hidden = !ok;
  if (!ok) return;
  const m = state.m, it = m.items;
  const cnt = t => it.filter(i => i.type === t).length;
  const warns = m.findings.filter(f => f.level !== 'info').length + it.reduce((n, i) => n + i.checks.filter(c => c.level === 'warn').length, 0);
  $('mStats').innerHTML = '<span class="stat"><b>' + cnt('table') + '</b> loaded tables</span><span class="stat"><b>' + cnt('query') + '</b> not loaded</span>'
    + (cnt('function') ? '<span class="stat"><b>' + cnt('function') + '</b> function' + (cnt('function') > 1 ? 's' : '') + '</span>' : '')
    + (cnt('parameter') ? '<span class="stat"><b>' + cnt('parameter') + '</b> parameter' + (cnt('parameter') > 1 ? 's' : '') + '</span>' : '')
    + '<span class="stat' + (warns ? ' limited' : '') + '"><b>' + warns + '</b> to fix</span>';
  const lvl = f => f.level === 'err' ? 'err' : f.level === 'warn' ? 'warn' : 'replace';
  const lbl = f => f.level === 'err' ? 'Error' : f.level === 'warn' ? 'Fix' : 'Consider';
  $('mFindings').innerHTML = m.findings.length
    ? '<h3>Across the model</h3><ul class="flist">' + m.findings.map(f => '<li><span class="pill ' + lvl(f) + '">' + lbl(f) + '</span><div><b>' + esc(f.title) + '</b><p>' + esc(f.detail) + '</p></div></li>').join('') + '</ul>'
    : msg('ok', 'No model-wide findings: no repeated hard-coded sources and no unused queries.');
  const fns = it.filter(i => i.type === 'function').length;
  $('mFnNote').innerHTML = fns ? '<p class="note">' + (fns === 1 ? '1 function is' : fns + ' functions are') + ' left out of the explanations automatically. Tick one to include it.</p>' : '';
  $('mBody').innerHTML = it.map((i, k) => {
    const w = i.checks.filter(c => c.level === 'warn').length, n = i.checks.length - w;
    const find = i.error ? '<span class="pill err">Can&rsquo;t read</span>' : (w ? '<span class="pill warn">' + w + ' to fix</span> ' : '') + (n ? '<span class="pill replace">' + n + ' to consider</span>' : '') + (!w && !n && i.q ? '<span class="muted">&ndash;</span>' : '');
    const st = mPickable(i) ? mStatus(i) : null;
    return '<tr data-k="' + k + '"><td class="ck">' + (mPickable(i) ? '<input type="checkbox" data-act="pick" aria-label="Explain ' + esc(i.name) + '"' + (mPicked(i) ? ' checked' : '') + '>' : '') + '</td>'
      + '<td class="nm">' + esc(i.name) + (st && st.complete ? ' <span class="mdesc">commented</span>' : '') + '</td><td class="fmt">' + TYPE_LABEL[i.type] + (i.fnWhy ? '<span class="why">' + FN_WHY[i.fnWhy] + '</span>' : '') + '</td>'
      + '<td class="num">' + (i.q ? i.q.steps.length : '<span class="muted">&ndash;</span>') + '</td>'
      + '<td class="uses">' + (i.deps.length ? i.deps.map(esc).join(', ') : '<span class="muted">&ndash;</span>') + '</td>'
      + '<td class="uses">' + (i.usedBy.length ? i.usedBy.map(esc).join(', ') : '<span class="muted">&ndash;</span>') + '</td>'
      + '<td>' + find + '</td>'
      + '<td class="act">' + (i.type !== 'parameter' ? '<button type="button" class="btn" data-act="open">Open</button>' : '') + '</td></tr>';
  }).join('');
  renderMQueue(); renderMResults();
}
function renderMQueue(){
  if (!state.m) return;
  const picked = state.m.items.filter(mPicked);
  const done = picked.filter(i => mStatus(i).complete).length;
  const pct = picked.length ? Math.round(done / picked.length * 100) : 0;
  $('mProgress').innerHTML = '<div class="cov-head"><span class="cov-num">' + done + ' of ' + picked.length + '</span><span class="cov-label">ticked queries fully commented</span></div><div class="cov-bar"><span style="width:' + pct + '%"></span></div>';
  const batch = mBatchList();
  state.mLastBatch = batch.map(b => b.name);
  const gaveUp = picked.filter(i => mStatus(i).gaveUp);
  const notes = [];
  if (gaveUp.length) notes.push(msg('warn', 'Copilot was asked twice and still left steps without a comment in ' + gaveUp.map(i => '<code>' + esc(i.name) + '</code>').join(', ') + '. They&rsquo;re out of the queue; use <b>Ask again</b> in Step 4 to retry.'));
  if (!batch.length) {
    state.out.mPrompt = '';
    $('mPromptBox').hidden = true;
    notes.push(picked.length ? msg('ok', 'Every ticked query has comments. Copy them from Step 4.') : msg('info', 'Tick at least one query in Step 2.'));
  } else {
    state.out.mPrompt = modelExplainPrompt(batch, { audience: state.audience });
    $('mPromptBox').hidden = false;
    $('mPromptTitle').textContent = 'Prompt for ' + batch.map(b => b.name).join(', ');
    $('mPromptView').textContent = state.out.mPrompt;
    $('mCount').textContent = state.out.mPrompt.length.toLocaleString() + ' characters';
    if (state.out.mPrompt.length > LONG_PROMPT) notes.push(msg('warn', 'This query alone makes a long prompt. If Copilot stops early, paste what it wrote; the missing steps come back in the next prompt.'));
  }
  $('mQueueMsg').innerHTML = notes.join('');
}
function addMReply(text){
  const r = parseModelExplain(text);
  if (r.error) { $('mReplyMsg').innerHTML = msg('err', esc(r.error)); return false; }
  const byName = new Map(state.m.items.map(i => [lc(i.name), i]));
  const lone = state.mLastBatch.length === 1 ? state.mLastBatch[0] : '';
  const unknownQ = new Set(); let added = 0; const touched = new Set();
  const slot = i => { let d = mDoneFor(i); if (!d) { d = { h: codeHash(i.code), summary: '', steps: {} }; state.mDone[i.name] = d; } return d; };
  const find = q => byName.get(lc(q || lone));
  r.summaries.forEach(s => { const i = find(s.query); if (!i || !i.q) { unknownQ.add(s.query || '(no query name)'); return; } slot(i).summary = s.text; touched.add(i.name); });
  r.steps.forEach(s => {
    const i = find(s.query); if (!i || !i.q) { unknownQ.add(s.query || '(no query name)'); return; }
    const st = i.q.steps.find(x => lc(x.name) === lc(s.name)); if (!st || !s.comment) return;
    slot(i).steps[lc(st.name)] = { name: st.name, comment: s.comment, note: s.note }; added++; touched.add(i.name);
  });
  state.mLastBatch.forEach(n => { state.mAsked[n] = (state.mAsked[n] || 0) + 1; });
  const m = [];
  if (added || touched.size) m.push(msg('ok', 'Added ' + added + ' step comment' + (added === 1 ? '' : 's') + ' across ' + touched.size + ' quer' + (touched.size === 1 ? 'y' : 'ies') + '.'));
  else m.push(msg('warn', 'Nothing in this reply matched the queries in this model.'));
  if (unknownQ.size) m.push(msg('info', 'Skipped blocks for queries that aren&rsquo;t in this model: ' + [...unknownQ].map(n => '<code>' + esc(n) + '</code>').join(', ') + '.'));
  $('mReplyMsg').innerHTML = m.join('');
  return true;
}
function renderMResults(){
  if (!state.m) return;
  const list = state.m.items.filter(i => i.q && mStatus(i).started);
  $('mResults').hidden = !list.length;
  const all = [];
  $('mList').innerHTML = list.map(i => {
    const s = mStatus(i), k = state.m.items.indexOf(i);
    const ex = { summary: s.d.summary, steps: Object.values(s.d.steps) };
    const cc = commentedCode(i.code, i.q, ex, { notes: state.mNotes, summary: state.mSummary });
    state.out['mq' + k] = cc.code;
    all.push('// ===== ' + i.name + ' (' + TYPE_LABEL[i.type].toLowerCase() + ') =====\n' + cc.code.trim());
    const pill = s.complete ? '<span class="pill ok">All ' + cc.total + ' steps</span>'
      : s.gaveUp ? '<span class="pill warn">' + cc.matched + ' of ' + cc.total + ' steps</span>'
      : '<span class="pill replace">' + cc.matched + ' of ' + cc.total + ' steps' + (s.needSummary ? ', no summary yet' : '') + '</span>';
    return '<details class="extra mq" data-k="' + k + '"><summary><span class="mqn">' + esc(i.name) + '</span> ' + pill + '</summary><div class="extra-body">'
      + (s.d.summary ? '<p class="note"><b>Summary.</b> ' + esc(s.d.summary) + '</p>' : '')
      + (s.missing.length ? '<p class="note">No comment yet: ' + s.missing.map(n => '<code>' + esc(n) + '</code>').join(', ') + '</p>' : '')
      + '<div class="codebox"><div class="codebox-bar"><span class="t">Commented query</span><span class="r"><button type="button" class="linkbtn" data-act="again">Ask again</button><button type="button" class="btn" data-act="open">Open</button><button type="button" class="btn primary" data-copy="mq' + k + '">Copy query</button></span></div><pre class="tall">' + hlM(cc.code) + '</pre></div>'
      + '</div></details>';
  }).join('');
  state.out.mAll = all.join('\n\n');
}
function openInOne(i){
  leaveExample();
  $('qInput').value = i.code; $('qName').value = i.name;
  state.exReply = ''; state.clReply = ''; $('exAdd').value = '';
  syncControls(); setMode('one'); renderAll(); persist();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function setMode(m){
  state.mode = m;
  $('modeOneBtn').setAttribute('aria-selected', m === 'one'); $('modeModelBtn').setAttribute('aria-selected', m === 'model');
  $('modeOne').hidden = m !== 'one'; $('modeModel').hidden = m !== 'model';
}

function renderAll(){ renderQuery(); renderExplain(); renderClean(); }
function syncControls(){
  document.querySelectorAll('input[name=aud], input[name=maud]').forEach(r => { r.checked = r.value === state.audience; });
  document.querySelectorAll('#clOpts [data-opt]').forEach(c => { c.checked = !!state.opts[c.dataset.opt]; });
  $('exNotes').checked = state.exNotes; $('exSummary').checked = state.exSummary;
  $('mNotes').checked = state.mNotes; $('mSummary').checked = state.mSummary; $('mBatch').value = state.mBatch;
  $('exReply').value = state.exReply; $('clReply').value = state.clReply;
}
function loadExample(){
  $('qInput').value = EX_QUERY; $('qName').value = EX_NAME;
  state.exReply = EX_EXPLAIN; state.clReply = EX_CLEAN;
  $('mInput').value = EX_MODEL_EXPORT;
  state.m = analyzeModel(parseMExport(EX_MODEL_EXPORT).queries);
  state.mLastBatch = ['Customers', 'Returns'];
  addMReply(EX_MODEL_REPLY); $('mReplyMsg').innerHTML = '';
  setExample(true);
}
// Drop every sample value except the one the person just typed into
function dropExample(keep){
  if (!state.example) return;
  const ex = { qInput: EX_QUERY, qName: EX_NAME }, v = keep ? SF_SUITE.ownText($(keep).value, ex[keep]) : '';
  if ($('qInput').value === EX_QUERY || keep === 'qInput') $('qInput').value = '';
  if ($('qName').value === EX_NAME || keep === 'qName') $('qName').value = '';
  if (keep) $(keep).value = v;
  if ($('mInput').value === EX_MODEL_EXPORT) $('mInput').value = '';
  Object.assign(state, { exReply: '', clReply: '', mDone: {}, mAsked: {}, mPick: {}, mLastBatch: [] });
  $('mReplyMsg').innerHTML = '';
  setExample(false); syncControls();
}
function resetAll(){
  Object.assign(state, { tab: 'ex', audience: 'mixed', opts: DEFAULT_OPTS(), exNotes: true, exSummary: true, exReply: '', clReply: '',
    mDone: {}, mAsked: {}, mPick: {}, mLastBatch: [], mBatch: '3', mNotes: true, mSummary: true });
  ['qInput', 'qName', 'exAdd', 'mInput', 'mReply'].forEach(id => { $(id).value = ''; });
  $('mReplyMsg').innerHTML = '';
  setExample(false); syncControls(); setTab('ex'); renderAll(); renderModel();
}

function init(){
  $('mExportView').textContent = M_EXPORT_QUERY;
  state.out.mExport = M_EXPORT_QUERY;
  const saved = store.get('query'), savedModel = store.get('model');
  let st = null; try { st = JSON.parse(store.get('state') || 'null'); } catch (e) {}
  if ((saved && saved.trim()) || (savedModel && savedModel.trim())) {
    $('qInput').value = saved || ''; $('mInput').value = savedModel || '';
    if (st) {
      $('qName').value = st.name || '';
      ['tab', 'audience', 'exReply', 'clReply', 'mode', 'mBatch'].forEach(k => { if (typeof st[k] === 'string') state[k] = st[k]; });
      ['mDone', 'mAsked', 'mPick'].forEach(k => { if (st[k] && typeof st[k] === 'object') state[k] = st[k]; });
      if (Array.isArray(st.mLastBatch)) state.mLastBatch = st.mLastBatch;
      if (st.opts) state.opts = Object.assign(DEFAULT_OPTS(), st.opts);
      ['exNotes', 'exSummary', 'mNotes', 'mSummary'].forEach(k => { if (typeof st[k] === 'boolean') state[k] = st[k]; });
    }
    // never carry the sample replies into real work
    if ((saved || '').trim() !== EX_QUERY) { if (state.exReply === EX_EXPLAIN) state.exReply = ''; if (state.clReply === EX_CLEAN) state.clReply = ''; }
    if (savedModel !== EX_MODEL_EXPORT) { EX_MODEL_QUERIES.forEach(x => { const d = state.mDone[x.name]; if (d && d.h === codeHash(x.code)) delete state.mDone[x.name]; }); }
  } else if (store.get('blank') !== '1') loadExample();
  syncControls(); setTab(state.tab); setMode(state.mode); renderAll(); renderModel();

  const unblank = () => { try { localStorage.removeItem(PREFIX + 'blank'); } catch (e) {} };
  $('qInput').addEventListener('input', () => {
    dropExample('qInput');
    if (state.exReply === EX_EXPLAIN) state.exReply = '';
    if (state.clReply === EX_CLEAN) state.clReply = '';
    syncControls(); unblank(); renderAll(); persist();
  });
  $('qName').addEventListener('input', () => {
    if (state.example) { dropExample('qName'); state.exReply = ''; state.clReply = ''; syncControls(); renderAll(); }
    renderExplain(); renderClean(); persist();
  });
  $('tabEx').addEventListener('click', () => { setTab('ex'); persist(); });
  $('tabCl').addEventListener('click', () => { setTab('cl'); persist(); });
  $('tabs').addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const t = state.tab === 'ex' ? 'cl' : 'ex'; setTab(t); $(t === 'ex' ? 'tabEx' : 'tabCl').focus(); persist();
  });
  $('modeOneBtn').addEventListener('click', () => { setMode('one'); persist(); });
  $('modeModelBtn').addEventListener('click', () => { setMode('model'); persist(); });
  document.querySelector('.modebar').addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const m = state.mode === 'one' ? 'model' : 'one'; setMode(m); $(m === 'one' ? 'modeOneBtn' : 'modeModelBtn').focus(); persist();
  });
  document.querySelectorAll('input[name=aud], input[name=maud]').forEach(r => r.addEventListener('change', () => { state.audience = r.value; leaveExample(); syncControls(); renderExplain(); renderMQueue(); persist(); }));
  document.querySelectorAll('#clOpts [data-opt]').forEach(c => c.addEventListener('change', () => { state.opts[c.dataset.opt] = c.checked; leaveExample(); renderClean(); persist(); }));
  $('exNotes').addEventListener('change', () => { state.exNotes = $('exNotes').checked; renderExplain(); persist(); });
  $('exSummary').addEventListener('change', () => { state.exSummary = $('exSummary').checked; renderExplain(); persist(); });
  $('exReply').addEventListener('input', () => { leaveExample(); state.exReply = $('exReply').value; renderExplain(); persist(); });
  $('clReply').addEventListener('input', () => { leaveExample(); state.clReply = $('clReply').value; renderClean(); persist(); });
  const addFollow = () => {
    const t = $('exAdd').value; if (!t.trim()) return;
    const p = parseExplain(t); if (p.error || !p.steps.length) { return; }
    leaveExample();
    state.exReply = state.exReply.replace(/\s+$/, '') + '\n\n' + t.trim();
    $('exReply').value = state.exReply; $('exAdd').value = '';
    renderExplain(); persist();
  };
  $('exAdd').addEventListener('paste', () => setTimeout(addFollow, 0));
  $('exAdd').addEventListener('change', addFollow);

  // whole model
  $('mInput').addEventListener('input', () => { dropExample(); unblank(); $('mReplyMsg').innerHTML = ''; renderModel(); persist(); });
  $('mBody').addEventListener('change', e => {
    const cb = e.target.closest('[data-act=pick]'); if (!cb) return;
    const i = state.m.items[+cb.closest('tr').dataset.k];
    leaveExample(); state.mPick[i.name] = cb.checked; renderMQueue(); persist();
  });
  const itemFrom = el => state.m.items[+el.closest('[data-k]').dataset.k];
  $('mBody').addEventListener('click', e => { const b = e.target.closest('[data-act=open]'); if (b) openInOne(itemFrom(b)); });
  $('mList').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const i = itemFrom(b);
    if (b.dataset.act === 'open') openInOne(i);
    if (b.dataset.act === 'again') { leaveExample(); delete state.mDone[i.name]; state.mAsked[i.name] = 0; state.mPick[i.name] = true; renderModel(); persist(); }
  });
  const pickAll = on => { leaveExample(); state.m.items.filter(i => mPickable(i) && i.type !== 'function').forEach(i => { state.mPick[i.name] = on; }); renderModel(); persist(); };
  $('mAllOn').addEventListener('click', () => pickAll(true));
  $('mAllOff').addEventListener('click', () => pickAll(false));
  $('mBatch').addEventListener('change', () => { state.mBatch = $('mBatch').value; renderMQueue(); persist(); });
  $('mNotes').addEventListener('change', () => { state.mNotes = $('mNotes').checked; renderMResults(); persist(); });
  $('mSummary').addEventListener('change', () => { state.mSummary = $('mSummary').checked; renderMResults(); persist(); });
  const submitM = () => {
    const t = $('mReply').value; if (!t.trim() || !state.m) return;
    leaveExample();
    if (addMReply(t)) $('mReply').value = '';
    renderModel(); persist();
  };
  $('mAdd').addEventListener('click', submitM);
  $('mReply').addEventListener('paste', () => setTimeout(submitM, 0));

  $('clearAll').addEventListener('click', () => { resetAll(); try { localStorage.setItem(PREFIX + 'blank', '1'); } catch (e) {} persist(); });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    const v = state.out[b.dataset.copy]; if (v) copyText(v, b);
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
