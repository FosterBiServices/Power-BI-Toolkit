/*MQ-CORE-START*/
function lc(s){ return (s || '').toLowerCase(); }
function oneLine(s){ return (s || '').replace(/\s+/g, ' ').trim(); }

/* ---------- M tokenizer ----------
   Tokens: ws, comment, str ("..." with "" escapes), qid (#"..."), id (letters, digits, _ and dots), num, punct. */
function mTokenize(src){
  const toks = []; let i = 0; const n = src.length;
  const push = (t, s, e) => toks.push({ t, v: src.slice(s, e), s, e });
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (/\s/.test(c)) { let j = i; while (j < n && /\s/.test(src[j])) j++; push('ws', i, j); i = j; continue; }
    if (c === '/' && d === '/') { let j = i; while (j < n && src[j] !== '\n') j++; push('comment', i, j); i = j; continue; }
    if (c === '/' && d === '*') { const j = src.indexOf('*/', i + 2); if (j < 0) return { error: 'A /* comment is never closed.', at: i }; push('comment', i, j + 2); i = j + 2; continue; }
    if (c === '"' || (c === '#' && d === '"')) {
      let j = c === '#' ? i + 2 : i + 1;
      for (;;) {
        if (j >= n) return { error: c === '#' ? 'A quoted name #"... is never closed.' : 'A text value "... is never closed.', at: i };
        if (src[j] === '"') { if (src[j + 1] === '"') { j += 2; continue; } j++; break; }
        j++;
      }
      push(c === '#' ? 'qid' : 'str', i, j); i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) { let j = i; while (j < n && /[A-Za-z0-9_.]/.test(src[j])) j++; while (src[j - 1] === '.') j--; push('id', i, j); i = j; continue; }
    if (/[0-9]/.test(c)) { let j = i; while (j < n && /[0-9.eExX]/.test(src[j])) j++; push('num', i, j); i = j; continue; }
    if (c === '#') { let j = i + 1; while (j < n && /[A-Za-z]/.test(src[j])) j++; push('id', i, j); i = j; continue; }
    const two = src.slice(i, i + 2);
    if (['=>', '<=', '>=', '<>', '..', '??'].includes(two)) { push('punct', i, i + 2); i += 2; continue; }
    push('punct', i, i + 1); i++;
  }
  return { toks };
}
function qidName(v){ return v.slice(2, -1).replace(/""/g, '"'); }
function lineOf(src, pos){ return src.slice(0, pos).split('\n').length; }

/* ---------- parse a query into steps ---------- */
function parseM(src){
  const res = { steps: [], header: '', result: '', resultRefs: [], error: null, hasLet: false };
  const tk = mTokenize(src || '');
  if (tk.error) { res.error = tk.error + ' (line ' + lineOf(src, tk.at) + ')'; return res; }
  const toks = tk.toks;
  // bracket balance
  const stack = [], pairs = { ')': '(', ']': '[', '}': '{' };
  for (const t of toks) {
    if (t.t !== 'punct') continue;
    if ('([{'.includes(t.v)) stack.push(t);
    else if (')]}'.includes(t.v)) {
      const o = stack.pop();
      if (!o || o.v !== pairs[t.v]) { res.error = 'Unmatched "' + t.v + '" on line ' + lineOf(src, t.s) + '.'; return res; }
    }
  }
  if (stack.length) { res.error = 'Unclosed "' + stack[stack.length - 1].v + '" on line ' + lineOf(src, stack[stack.length - 1].s) + '.'; return res; }
  // first let at bracket depth 0
  let depth = 0, letIdx = -1;
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.t === 'punct' && '([{'.includes(t.v)) depth++;
    else if (t.t === 'punct' && ')]}'.includes(t.v)) depth--;
    else if (t.t === 'id' && t.v === 'let' && depth === 0) { letIdx = k; break; }
  }
  if (letIdx < 0) { res.noLet = true; res.error = 'No "let ... in" block was found. Paste the whole query from the Advanced Editor, starting with "let".'; return res; }
  res.hasLet = true;
  res.header = src.slice(0, toks[letIdx].s);
  depth = 0; let letDepth = 1, start = letIdx + 1, inIdx = -1;
  const chunks = [];
  for (let k = letIdx + 1; k < toks.length; k++) {
    const t = toks[k];
    if (t.t === 'punct' && '([{'.includes(t.v)) depth++;
    else if (t.t === 'punct' && ')]}'.includes(t.v)) depth--;
    else if (t.t === 'id' && t.v === 'let') letDepth++;
    else if (t.t === 'id' && t.v === 'in') {
      letDepth--;
      if (letDepth === 0 && depth === 0) { chunks.push([start, k]); inIdx = k; break; }
    } else if (t.t === 'punct' && t.v === ',' && depth === 0 && letDepth === 1) { chunks.push([start, k]); start = k + 1; }
  }
  if (inIdx < 0) { res.error = 'The "let" block has no matching "in". Check that the query ends with "in" and the name of the last step.'; return res; }
  const names = [];
  for (const [a, b] of chunks) {
    let k = a; while (k < b && (toks[k].t === 'ws' || toks[k].t === 'comment')) k++;
    if (k >= b) continue;
    const nt = toks[k];
    if (nt.t !== 'id' && nt.t !== 'qid') { res.error = 'Couldn’t read a step name on line ' + lineOf(src, nt.s) + '.'; return res; }
    let e = k + 1; while (e < b && toks[e].t === 'ws') e++;
    if (!(toks[e] && toks[e].t === 'punct' && toks[e].v === '=')) { res.error = 'Expected "=" after the step name on line ' + lineOf(src, nt.s) + '.'; return res; }
    const name = nt.t === 'qid' ? qidName(nt.v) : nt.v;
    const lineStart = src.lastIndexOf('\n', nt.s - 1) + 1;
    const indent = src.slice(lineStart, nt.s).match(/^[ \t]*/)[0];
    const exprToks = toks.slice(e + 1, b);
    const expr = src.slice(toks[e].e, toks[b - 1] ? toks[b - 1].e : toks[e].e).trim();
    names.push(name);
    res.steps.push({ name, raw: nt.v, quoted: nt.t === 'qid', nameStart: nt.s, lineStart, indent, expr, exprToks, line: lineOf(src, nt.s), chunkStart: toks[a].s, chunkEnd: toks[b - 1] ? toks[b - 1].e : toks[e].e });
  }
  const nameSet = new Map(names.map(n => [n, true]));
  const refsIn = (tks) => {
    const out = [];
    for (let k = 0; k < tks.length; k++) {
      const t = tks[k];
      let nm = null;
      if (t.t === 'qid') nm = qidName(t.v);
      else if (t.t === 'id' && nameSet.has(t.v)) {
        let p = k - 1; while (p >= 0 && tks[p].t === 'ws') p--;
        let q = k + 1; while (q < tks.length && tks[q].t === 'ws') q++;
        if (tks[p] && tks[p].v === '[' && tks[q] && tks[q].v === ']') continue; // [Field] access, not a step
        nm = t.v;
      }
      if (nm && nameSet.has(nm) && !out.includes(nm)) out.push(nm);
    }
    return out;
  };
  res.steps.forEach(s => {
    s.refs = refsIn(s.exprToks);
    const fn = s.exprToks.find((t, k) => t.t === 'id' && t.v.includes('.') && /^[A-Z]/.test(t.v) && (() => { let q = k + 1; while (q < s.exprToks.length && s.exprToks[q].t === 'ws') q++; return s.exprToks[q] && s.exprToks[q].v === '('; })());
    const first = s.exprToks.find(t => t.t !== 'ws' && t.t !== 'comment');
    s.fn = fn ? fn.v : (first && (first.t === 'qid' || nameSet.has(first.v)) && s.exprToks.some(t => t.v === '{') ? 'Navigation' : '');
    s.strings = s.exprToks.filter(t => t.t === 'str').map(t => t.v.slice(1, -1).replace(/""/g, '"'));
    delete s.exprToks;
  });
  const resultToks = toks.slice(inIdx + 1);
  res.result = src.slice(toks[inIdx].e).trim();
  res.resultRefs = refsIn(resultToks);
  return res;
}

/* ---------- health checks (no AI) ---------- */
const DEFAULT_NAMES = /^(Source|Navigation|Changed Type|Promoted Headers|Filtered Rows|Removed Columns|Removed Other Columns|Renamed Columns|Reordered Columns|Added Custom|Custom|Added Conditional Column|Added Index|Replaced Value|Replaced Errors|Removed Errors|Sorted Rows|Merged Queries|Appended Query|Expanded .+|Grouped Rows|Removed Duplicates|Removed Top Rows|Removed Bottom Rows|Removed Blank Rows|Kept First Rows|Kept Range of Rows|Split Column by .+|Trimmed Text|Cleaned Text|Uppercased Text|Lowercased Text|Capitalized Each Word|Pivoted Column|Unpivoted Columns|Unpivoted Other Columns|Transposed Table|Duplicated Column|Inserted .+|Extracted .+|Invoked Custom Function|Changed Type with Locale|Filled Down|Filled Up|Merged Columns|Calculated .+|Rounded Off|Multiplication|Division|Subtraction|Addition)\d*$/;
const DB_SOURCES = /^(Sql\.Database|Sql\.Databases|Oracle\.Database|PostgreSQL\.Database|MySQL\.Database|Snowflake\.Databases|GoogleBigQuery\.Database|AmazonRedshift\.Database|Teradata\.Database|Databricks\.Catalogs|Odbc\.Query|Odbc\.DataSource|AzureDataExplorer\.Contents|Sybase\.Database|DB2\.Database)$/;
const FOLD_BREAKERS = /^(Table\.Buffer|Table\.AddIndexColumn|Table\.FromRecords|Table\.FromList|Table\.FromRows|List\.Generate|List\.Accumulate|Table\.Profile|Table\.Transpose|Table\.ReplaceErrorValues)$/;
const FILE_FNS = /^(File\.Contents|Folder\.Files|Folder\.Contents|Web\.Contents|SharePoint\.Files|SharePoint\.Contents|SharePoint\.Tables|Excel\.Workbook|Csv\.Document)$/;

function sourceInfo(q){
  const s = q.steps.find(x => DB_SOURCES.test(x.fn) || FILE_FNS.test(x.fn) || /^[A-Z][A-Za-z]+\.(Database|Databases|Contents|Files|Workbook|Document|Tables|Feed|Query)$/.test(x.fn));
  if (!s) return { kind: 'other', step: null, fn: '' };
  return { kind: DB_SOURCES.test(s.fn) ? 'database' : FILE_FNS.test(s.fn) ? 'file' : 'other', step: s, fn: s.fn };
}
function healthChecks(q){
  const out = [];
  const add = (level, step, title, detail) => out.push({ level, step, title, detail });
  if (!q.steps.length) return out;
  const src = sourceInfo(q);
  // unused steps
  const used = new Set(q.resultRefs);
  q.steps.forEach(s => s.refs.forEach(r => used.add(r)));
  q.steps.filter(s => !used.has(s.name)).forEach(s => add('warn', s.name, 'Step is never used', 'Nothing after it, and not the query’s result, refers to this step, so it has no effect. It can be deleted.'));
  // default names
  const defaults = q.steps.filter(s => DEFAULT_NAMES.test(s.name) && !/^(Source|Navigation)$/.test(s.name));
  if (defaults.length) add('info', null, defaults.length + ' step' + (defaults.length > 1 ? 's have' : ' has') + ' a default name', 'Names like ' + defaults.slice(0, 4).map(s => '“' + s.name + '”').join(', ') + (defaults.length > 4 ? ' and ' + (defaults.length - 4) + ' more' : '') + ' say what kind of step it is, not why. Descriptive names make the Applied Steps list readable.');
  // several type changes
  const types = q.steps.filter(s => s.fn === 'Table.TransformColumnTypes');
  if (types.length > 1) add('warn', types.map(s => s.name).join(', '), types.length + ' type-change steps', 'Power BI adds a type change after most edits. Usually one type step after the headers, plus types set directly in Table.AddColumn, is enough; extra ones add work and clutter.');
  // hard-coded paths and servers
  q.steps.forEach(s => {
    const lits = s.strings.filter(v => /^[A-Za-z]:\\|^\\\\|^https?:\/\/|\.(xlsx|xlsm|xls|csv|txt|json|parquet)$/i.test(v));
    if (lits.length && (FILE_FNS.test(s.fn) || /File\.Contents|Web\.Contents|Folder\.Files/.test(s.expr))) add('warn', s.name, 'Hard-coded file path or URL', lits.map(v => '“' + v + '”').join(', ') + '. A parameter makes it easy to repoint, and a personal folder like this breaks when someone else refreshes.');
    if (DB_SOURCES.test(s.fn) && s.strings.length) add('info', s.name, 'Hard-coded server or database', s.strings.slice(0, 2).map(v => '“' + v + '”').join(', ') + '. Parameters make it easy to switch between test and production.');
  });
  // remove vs select columns
  q.steps.filter(s => s.fn === 'Table.RemoveColumns').forEach(s => add('info', s.name, 'Removes columns by name', 'New columns added at the source will flow through, and the step fails if a named column disappears. Table.SelectColumns keeps an explicit list instead.'));
  // sort mid-query
  const last = q.steps[q.steps.length - 1];
  q.steps.filter(s => s.fn === 'Table.Sort' && s !== last).forEach(s => add('info', s.name, 'Sort in the middle of the query', 'Row order isn’t kept when the table loads into the model, so this sort usually only costs time.'));
  // folding
  if (src.kind === 'database') {
    q.steps.filter(s => FOLD_BREAKERS.test(s.fn)).forEach(s => add('warn', s.name, 'May stop query folding', s.fn + ' usually can’t be sent to the database, so this step and every step after it run in Power BI instead. Move it as late as possible, and right-click a step > View Native Query to check.'));
  }
  q.steps.filter(s => s.fn === 'Table.Buffer').forEach(s => { if (src.kind !== 'database') add('info', s.name, 'Table.Buffer', 'Buffering loads the whole table into memory. It helps in a few specific cases; otherwise it slows refresh.'); });
  // result is not the last step
  if (q.resultRefs.length === 1 && last && q.resultRefs[0] !== last.name) add('warn', last.name, 'The result isn’t the last step', 'The query returns “' + q.resultRefs[0] + '”, so steps after it are ignored. That is often left over from a deleted step.');
  return out;
}

/* ---------- prompts ---------- */
function stepListing(src, q){
  const lines = [];
  q.steps.forEach((s, i) => lines.push((i + 1) + '. ' + s.name + (s.fn ? ' (' + s.fn + ')' : '')));
  return lines;
}
function explainPrompt(src, q, o){
  const opts = Object.assign({ audience: 'mixed', name: '' }, o || {});
  const L = [];
  L.push('You are explaining a Power Query (M) query from Power BI' + (opts.name ? ', named "' + opts.name + '"' : '') + '.');
  L.push('');
  L.push('## TASK');
  L.push('Write a short comment for every step listed under CONTEXT, and a summary of the whole query.');
  L.push('');
  L.push('## RULES: how to write the comments');
  if (opts.audience === 'business') L.push('- Audience: report authors who don’t read M. Say what the step does to the data in plain words, not how the function works.');
  else L.push('- Audience: people who maintain the query. Say what the step does and, where it isn’t obvious, why it matters.');
  L.push('- One sentence per step, at most 120 characters. Start with a verb: "Keeps rows where...", "Renames...".');
  L.push('- Be specific: name the columns, values and conditions from the code.');
  L.push('- If a step looks wrong, unnecessary or risky, add a NOTE line saying why, briefly. Otherwise leave NOTE out.');
  L.push('- SUMMARY: 2 to 4 sentences: where the data comes from, the main changes, and what one row of the result is.');
  L.push('');
  L.push('## REPLY FORMAT (a template: replace the placeholder text with your answer)');
  L.push('Put your ENTIRE answer inside ONE code block. Write nothing before or after the code block. One STEP block per step, in the order listed, using each step name exactly as listed:');
  L.push('');
  L.push('@@@ SUMMARY @@@');
  L.push('Two to four sentences.');
  L.push('@@@ END @@@');
  L.push('@@@ STEP @@@');
  L.push('NAME: Step name');
  L.push('COMMENT: One sentence.');
  L.push('NOTE: Only if the step looks wrong or risky.');
  L.push('@@@ END @@@');
  L.push('');
  L.push('## CONTEXT: the steps');
  stepListing(src, q).forEach(l => L.push(l));
  L.push('');
  L.push('## STARTING POINT: the query');
  L.push(src.trim());
  L.push('');
  L.push('=== END OF PROMPT ===');
  return L.join('\n');
}
function cleanupPrompt(src, q, checks, o){
  const opts = Object.assign({ rename: true, merge: true, unused: true, params: true, comments: false, name: '' }, o || {});
  const L = [];
  L.push('You are cleaning up a Power Query (M) query from Power BI' + (opts.name ? ', named "' + opts.name + '"' : '') + '. Rewrite it so it is easier to read and maintain, WITHOUT changing its result.');
  L.push('');
  L.push('## RULES you must keep');
  L.push('- The result must be exactly the same: the same columns with the same names, types and order, and the same rows.');
  L.push('- Keep the same data source, server, database, file, sheet and credentials. Do not add or remove connectors.');
  L.push('- Do not add Table.Buffer, Table.AddIndexColumn or other steps that can stop query folding, and do not move steps that filter or remove columns later than they are now.');
  L.push('- Keep valid M that Power BI’s Advanced Editor accepts, starting with "let" and ending with "in" and the last step.');
  L.push('');
  L.push('## TASK: changes to make');
  if (opts.rename) L.push('- Rename default step names (such as "Changed Type1" or "Filtered Rows") to short names that say why, for example #"Kept Orders With Dates". Update every reference.');
  if (opts.merge) L.push('- Merge consecutive steps of the same kind where the result is identical (for example two type changes or two renames in a row), and set the type of new columns directly in Table.AddColumn instead of a separate type step.');
  if (opts.unused) L.push('- Remove steps that nothing uses, and sorts that don’t affect the result.');
  if (opts.params) L.push('- Replace hard-coded file paths, URLs, server and database names with parameters. List each parameter in a PARAMETER block and use its name in the code; do not write the parameter queries into the code.');
  if (opts.comments) L.push('- Add a short // comment above each step saying what it does.');
  L.push('- Change nothing else. If a change could alter the result, leave it out and mention it in CHANGES as a suggestion.');
  if (checks && checks.length) {
    L.push('');
    L.push('## CONTEXT: issues found in this query');
    checks.forEach(c => L.push('- ' + (c.step ? c.step + ': ' : '') + c.title + '. ' + c.detail));
  }
  L.push('');
  L.push('## REPLY FORMAT (a template: replace the placeholder text with your answer)');
  L.push('Put your ENTIRE answer inside ONE code block. Write nothing before or after the code block:');
  L.push('');
  L.push('@@@ CODE @@@');
  L.push('let');
  L.push('    ...');
  L.push('in');
  L.push('    ...');
  L.push('@@@ END @@@');
  if (opts.params) {
    L.push('@@@ PARAMETER @@@');
    L.push('NAME: ParameterName');
    L.push('TYPE: Text');
    L.push('VALUE: the original value');
    L.push('@@@ END @@@');
  }
  L.push('@@@ CHANGES @@@');
  L.push('- One line per change, in plain words.');
  L.push('@@@ END @@@');
  L.push('');
  L.push('## STARTING POINT: the query');
  L.push(src.trim());
  L.push('');
  L.push('=== END OF PROMPT ===');
  return L.join('\n');
}

/* ---------- reply parsing ---------- */
function unMarkdown(s){ let p; do { p = s; s = s.replace(/(^|[^\\])\\([\[\]_*#])/g, '$1$2'); } while (s !== p); return s; }
function cleanReply(t){ return unMarkdown((t || '').replace(/\r/g, '')).replace(/[“”]/g, '"').replace(/ /g, ' '); }
function blocks(t){
  const out = [];
  const parts = t.split(/@@@\s*([A-Z]+)\s*@@@/);
  for (let i = 1; i < parts.length; i += 2) {
    const kind = parts[i].toUpperCase();
    if (kind === 'END') continue;
    out.push({ kind, body: parts[i + 1].split(/@@@\s*END\s*@@@/i)[0] });
  }
  return out;
}
// blocks without the reply-format template, in case Copilot repeats it in its answer
const TEMPLATE_LINES = ['NAME: Step name', 'TEXT: Two to four sentences.', 'NAME: ParameterName', '- One line per change, in plain words.'];
function answerBlocks(t){
  return blocks(t).filter(b => { const x = b.body.trim(); return !(x === 'Two to four sentences.' || /^let\s+\.\.\.\s+in\s+\.\.\.$/.test(x) || TEMPLATE_LINES.some(l => x.includes(l))); });
}
function field(body, label, labels){
  const re = new RegExp('(^|\\n)[ \\t]*' + label + '[ \\t]*:', 'i');
  const m = re.exec(body); if (!m) return '';
  const start = m.index + m[0].length;
  let end = body.length;
  for (const l of labels) { if (l === label) continue; const r = new RegExp('(^|\\n)[ \\t]*' + l + '[ \\t]*:', 'i'); const x = r.exec(body.slice(start)); if (x) end = Math.min(end, start + x.index); }
  return body.slice(start, end).replace(/^[ \t]*```[\w-]*[ \t]*$/gm, '').trim();
}
function parseExplain(text){
  const t = cleanReply(text).replace(/[‘’]/g, "'");
  if (!t.trim()) return { summary: '', steps: [], error: null };
  const bs = answerBlocks(t);
  const L = ['NAME', 'COMMENT', 'NOTE'];
  const steps = bs.filter(b => b.kind === 'STEP').map(b => ({
    name: field(b.body, 'NAME', L).replace(/^#"(.*)"$/s, '$1').replace(/^"(.*)"$/s, '$1').replace(/""/g, '"').trim(),
    comment: oneLine(field(b.body, 'COMMENT', L)), note: oneLine(field(b.body, 'NOTE', L))
  })).filter(s => s.name);
  const sb = bs.find(b => b.kind === 'SUMMARY');
  const summary = sb ? oneLine(sb.body.replace(/^[ \t]*```[\w-]*[ \t]*$/gm, '')) : '';
  return { summary, steps, error: steps.length || summary ? null : 'No @@@ STEP @@@ blocks were found. Make sure Copilot answered inside one code block, and paste its whole answer.' };
}
function parseCleanup(text){
  const t = cleanReply(text);
  if (!t.trim()) return { code: '', params: [], changes: [], error: null };
  const bs = answerBlocks(t);
  const cb = bs.find(b => b.kind === 'CODE');
  let code = cb ? cb.body.replace(/^[ \t]*```[\w-]*[ \t]*$/gm, '').replace(/^\s*\n|\s+$/g, '') : '';
  if (!cb) { const m = t.match(/```(?:m|powerquery|pq)?\s*\n([\s\S]*?\blet\b[\s\S]*?)```/i); if (m) code = m[1].trim(); }
  const PL = ['NAME', 'TYPE', 'VALUE'];
  const params = bs.filter(b => b.kind === 'PARAMETER').map(b => ({ name: field(b.body, 'NAME', PL).replace(/^#"(.*)"$/s, '$1').trim(), type: field(b.body, 'TYPE', PL) || 'Text', value: field(b.body, 'VALUE', PL) })).filter(p => p.name);
  const ch = bs.find(b => b.kind === 'CHANGES');
  const changes = ch ? ch.body.split('\n').map(s => s.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean) : [];
  return { code, params, changes, error: code ? null : 'No @@@ CODE @@@ block was found. Make sure Copilot answered inside one code block, and paste its whole answer.' };
}

/* ---------- outputs ---------- */
function wrapComment(indent, text, width){
  const words = oneLine(text).split(' '); const out = []; let line = '';
  for (const w of words) { if (line && (line + ' ' + w).length > (width || 100)) { out.push(indent + '// ' + line); line = w; } else line = line ? line + ' ' + w : w; }
  if (line) out.push(indent + '// ' + line);
  return out;
}
// Insert // comments above each step; the code itself is not touched
function commentedCode(src, q, ex, o){
  const opts = Object.assign({ notes: true, summary: true }, o || {});
  const byName = new Map(ex.steps.map(s => [lc(s.name), s]));
  const inserts = [];
  q.steps.forEach(s => {
    const e = byName.get(lc(s.name)); if (!e || !e.comment) return;
    const lines = wrapComment(s.indent, e.comment);
    if (opts.notes && e.note) wrapComment(s.indent, 'Note: ' + e.note).forEach(l => lines.push(l));
    // skip if the same comment is already right above
    const before = src.slice(0, s.lineStart).replace(/\s+$/, '');
    const prevLine = before.slice(before.lastIndexOf('\n') + 1).trim();
    if (prevLine === lines[lines.length - 1].trim()) return;
    inserts.push({ at: s.lineStart, text: lines.join('\n') + '\n' });
  });
  let out = src;
  inserts.sort((a, b) => b.at - a.at).forEach(ins => { out = out.slice(0, ins.at) + ins.text + out.slice(ins.at); });
  if (opts.summary && ex.summary) {
    const letPos = out.search(/(^|\n)[ \t]*let\b/);
    const at = letPos < 0 ? 0 : (out[letPos] === '\n' ? letPos + 1 : letPos);
    out = out.slice(0, at) + wrapComment('', 'Summary: ' + ex.summary).join('\n') + '\n' + out.slice(at);
  }
  const matched = q.steps.filter(s => byName.has(lc(s.name))).length;
  const unknown = ex.steps.filter(e => !q.steps.some(s => lc(s.name) === lc(e.name))).map(e => e.name);
  return { code: out, matched, total: q.steps.length, missing: q.steps.filter(s => !byName.has(lc(s.name))).map(s => s.name), unknown };
}
function mText(v){ return '"' + String(v).replace(/"/g, '""') + '"'; }
function paramQuery(p){
  let v = (p.value || '').trim();
  const type = /^(number|decimal)/i.test(p.type) ? 'Number' : /^date/i.test(p.type) ? 'Date' : /^(true|false|logical)/i.test(p.type) ? 'Logical' : 'Text';
  if (type === 'Text') { if (!/^".*"$/s.test(v)) v = mText(v); }
  return v + ' meta [IsParameterQuery=true, Type="' + type + '", IsParameterQueryRequired=true]';
}
// Compare original and cleaned query; flag anything that could change the result
function checkCleanup(orig, clean, params){
  const notes = [];
  const add = (level, text) => notes.push({ level, text });
  if (clean.error) { add('err', 'The cleaned query can’t be read: ' + clean.error); return notes; }
  const paramNames = new Set((params || []).map(p => p.name));
  // every referenced name exists
  const cleanNames = new Set(clean.steps.map(s => s.name));
  const bare = /^[A-Za-z_][A-Za-z0-9_.]*$/;
  clean.steps.forEach(s => {
    const quoted = (s.expr.match(/#"(?:[^"]|"")*"/g) || []).map(qidName);
    quoted.filter(n => !cleanNames.has(n) && !paramNames.has(n)).forEach(n => add('err', 'Step “' + s.name + '” refers to #"' + n + '", which isn’t a step in the cleaned query.'));
  });
  if (!clean.resultRefs.length || !clean.resultRefs.every(r => cleanNames.has(r))) add('err', 'The final "in" line doesn’t point to a step in the cleaned query.');
  // same source
  const a = sourceInfo(orig), b = sourceInfo(clean);
  if (a.fn && a.fn !== b.fn) add('err', 'The data source changed from ' + a.fn + ' to ' + (b.fn || 'something else') + '.');
  else if (a.step && b.step) {
    const litsA = a.step.strings.slice().sort().join('|'), litsB = b.step.strings.slice().sort().join('|');
    if (litsA !== litsB) {
      const moved = a.step.strings.filter(v => !b.step.strings.includes(v));
      const covered = moved.every(v => (params || []).some(p => p.value.replace(/^"|"$/g, '') === v));
      add(covered ? 'info' : 'warn', covered ? 'The source now uses parameters for ' + moved.map(v => '“' + v + '”').join(', ') + '. Create the parameters below first.' : 'The source arguments changed (' + moved.map(v => '“' + v + '”').join(', ') + ' no longer appear). Check the source step carefully.');
    }
  }
  // risky functions added
  const fnsA = new Set(orig.steps.map(s => s.fn));
  clean.steps.filter(s => FOLD_BREAKERS.test(s.fn) && !fnsA.has(s.fn)).forEach(s => add('warn', 'Adds ' + s.fn + ' (step “' + s.name + '”), which can stop query folding and wasn’t in the original.'));
  // filters and column choices kept
  const count = (q, re) => q.steps.filter(s => re.test(s.fn)).length;
  if (count(clean, /^Table\.SelectRows$/) < count(orig, /^Table\.SelectRows$/)) {
    const origConds = orig.steps.filter(s => s.fn === 'Table.SelectRows').length;
    add('info', 'The original has ' + origConds + ' row filter step' + (origConds > 1 ? 's' : '') + '; the cleaned query has ' + count(clean, /^Table\.SelectRows$/) + '. Check the conditions were combined, not dropped.');
  }
  const usedIn = q => { const u = new Set(q.resultRefs); for (let k = q.steps.length - 1; k >= 0; k--) if (u.has(q.steps[k].name)) q.steps[k].refs.forEach(r => u.add(r)); return u; };
  const liveA = usedIn(orig);
  const lit = (q, live) => new Set([].concat(...q.steps.filter(s => !live || live.has(s.name)).map(s => s.strings)));
  const la = lit(orig, liveA), lb = lit(clean);
  const lost = [...la].filter(v => !lb.has(v) && !(params || []).some(p => p.value.replace(/^"|"$/g, '') === v));
  if (lost.length) add('warn', 'These values from the original no longer appear: ' + lost.slice(0, 8).map(v => '“' + v + '”').join(', ') + (lost.length > 8 ? ' and ' + (lost.length - 8) + ' more' : '') + '. Check nothing a filter, rename or type change needs was lost.');
  const dflt = clean.steps.filter(s => DEFAULT_NAMES.test(s.name) && !/^(Source|Navigation)$/.test(s.name));
  if (dflt.length) add('info', dflt.length + ' default step name' + (dflt.length > 1 ? 's' : '') + ' left: ' + dflt.slice(0, 5).map(s => s.name).join(', ') + '.');
  if (!notes.some(n => n.level !== 'info')) add('ok', 'The cleaned query reads correctly, every step reference exists, and the source is unchanged.');
  return notes;
}
// Line diff (LCS)
function lineDiff(a, b){
  const A = a.replace(/\r/g, '').split('\n'), B = b.replace(/\r/g, '').split('\n');
  const n = A.length, m = B.length;
  if (n * m > 4e6) return null;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i].trim() === B[j].trim() ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i].trim() === B[j].trim()) { out.push({ t: ' ', v: B[j] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ t: '-', v: A[i++] });
    else out.push({ t: '+', v: B[j++] });
  }
  while (i < n) out.push({ t: '-', v: A[i++] });
  while (j < m) out.push({ t: '+', v: B[j++] });
  return out;
}
/*MQ-CORE-END*/
