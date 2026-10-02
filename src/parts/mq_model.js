
/* ---------- whole model: export every query ---------- */
const NL_MARK = '↵';
const M_CLEAN = col => 'SUBSTITUTE ( SUBSTITUTE ( SUBSTITUTE ( ' + col + ', UNICHAR ( 13 ), "" ), UNICHAR ( 10 ), UNICHAR ( 8629 ) ), UNICHAR ( 9 ), "    " )';
const M_EXPORT_QUERY = [
'// Power Query Explainer: export every Power Query query in the model',
'// Run in DAX query view, then select Copy above the results grid.',
'EVALUATE',
'VAR _tables = SELECTCOLUMNS ( INFO.TABLES (), "TID", [ID], "TName", [Name] )',
'// What each query returns, as Power BI records it (Table, Function, Text...)',
'VAR _types = SELECTCOLUMNS ( FILTER ( INFO.ANNOTATIONS (), [Name] = "PBI_ResultType" ), "AID", [ObjectID], "AValue", [Value] )',
'// Loaded tables: the query behind each table (M partitions only)',
'VAR _loaded =',
'\tSELECTCOLUMNS (',
'\t\tFILTER ( INFO.PARTITIONS (), [Type] = 4 ),',
'\t\t"Kind", "Table",',
'\t\t"Name",',
'\t\t\tVAR _tid = [TableID]',
'\t\t\tRETURN MAXX ( FILTER ( _tables, [TID] = _tid ), [TName] ),',
'\t\t"ResultType", "Table",',
'\t\t"Code", ' + M_CLEAN('[QueryDefinition]'),
'\t)',
'// Queries that aren’t loaded, parameters and functions',
'VAR _other =',
'\tSELECTCOLUMNS (',
'\t\tFILTER ( INFO.EXPRESSIONS (), [Kind] = 0 ),',
'\t\t"Kind", "Query",',
'\t\t"Name", [Name],',
'\t\t"ResultType",',
'\t\t\tVAR _eid = [ID]',
'\t\t\tRETURN CONCATENATEX ( FILTER ( _types, [AID] = _eid ), [AValue], ", " ),',
'\t\t"Code", ' + M_CLEAN('[Expression]'),
'\t)',
'RETURN UNION ( _loaded, _other )',
'ORDER BY [Kind], [Name]'].join('\n');

function mUnquoteCell(s){
  if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') {
    const inner = s.slice(1, -1);
    if (!/(^|[^"])"([^"]|$)/.test(inner.replace(/""/g, ''))) return inner.replace(/""/g, '"');
  }
  return s;
}
function parseMExport(text){
  const res = { queries: [], error: null };
  const raw = (text || '').replace(/\r/g, '');
  if (!raw.trim()) return res;
  const lines = raw.split('\n');
  let h = -1, map = {};
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cells = lines[i].split('\t').map(c => lc(mUnquoteCell(c.trim())).replace(/^.*\[|\]$/g, ''));
    if (cells.includes('kind') && cells.includes('name') && cells.includes('code')) { h = i; cells.forEach((c, j) => { map[c] = j; }); break; }
  }
  if (h < 0 && looksTmdl(raw)) {
    const r = pbipTmdlQueries(raw);
    res.queries = pbipQueryList(r.tables, r.exprs, true);
    res.tmdl = true;
    if (!res.queries.length) res.error = 'No Power Query code was found in this TMDL. Script the tables whose queries you want (or the whole semantic model) in TMDL view, and copy all of it.';
    return res;
  }
  if (h < 0) {
    res.error = /\bkind\b.*\btable\b.*\bname\b/i.test(lines[0] || '')
      ? 'This looks like the model export from the other toolkit pages. Run the query from Step 1 on this page instead; it returns the Power Query code.'
      : 'The header row (Kind, Name, Code) wasn’t found. Use the Copy button above the results grid so the column names come along.';
    return res;
  }
  const seen = new Set();
  for (let i = h + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const c = lines[i].split('\t');
    const get = k => map[k] === undefined ? '' : mUnquoteCell((c[map[k]] || '').trim());
    const name = get('name'), code = get('code').split(NL_MARK).join('\n');
    if (!name || !code.trim() || seen.has(lc(name))) continue;
    seen.add(lc(name));
    res.queries.push({ name, loaded: lc(get('kind')) === 'table', code, resultType: get('resulttype'), table: get('table'), partition: get('partition'),
      props: get('props').split(NL_MARK).join('\n').split(TAB_MARK).join('\t'), tmdl: lc(get('from')) === 'tmdl' });
  }
  if (!res.queries.length) res.error = 'No queries were found under the header row.';
  return res;
}

function stripMComments(code){
  const tk = mTokenize(code);
  return tk.error ? code : tk.toks.filter(t => t.t !== 'comment').map(t => t.v).join('');
}
// Does the code (tokens from k, comments and spaces skipped) start with a function: (params) [as type] => or each
function startsFunction(toks, k){
  const sig = toks.filter((t, i) => i >= k && t.t !== 'ws' && t.t !== 'comment');
  if (!sig.length) return false;
  if (sig[0].t === 'id' && sig[0].v === 'each') return true;
  if (sig[0].v !== '(') return false;
  let d = 0, j = 0;
  for (; j < sig.length; j++) { if (sig[j].v === '(') d++; else if (sig[j].v === ')' && --d === 0) break; }
  j++;
  if (sig[j] && sig[j].v === 'as') { j++; if (sig[j] && sig[j].v === 'nullable') j++; j++; }
  return !!(sig[j] && sig[j].v === '=>');
}
// How a query was recognised as a function: 'model' (Power BI's own record), 'code', 'name' or ''
function functionReason(code, name, resultType){
  if (/\bfunction\b/i.test(resultType || '')) return 'model';
  const tk = mTokenize(code);
  if (!tk.error) {
    if (startsFunction(tk.toks, 0)) return 'code';
    const q = parseM(code);
    if (!q.error && q.resultRefs.length === 1) {
      const s = q.steps.find(x => x.name === q.resultRefs[0]);
      const st = s && mTokenize(s.expr);
      if (st && !st.error && startsFunction(st.toks, 0)) return 'code';
    }
  }
  if (/^f[nx]([A-Z0-9_ .-]|$)/.test(name || '')) return 'name';
  return '';
}
function queryType(code, loaded, name, resultType){
  if (loaded) return 'table';
  const s = stripMComments(code).trim();
  if (/\bIsParameterQuery\s*=\s*true/i.test(s)) return 'parameter';
  if (functionReason(code, name, resultType)) return 'function';
  return 'query';
}
const TYPE_LABEL = { table: 'Loaded table', query: 'Not loaded', function: 'Function', parameter: 'Parameter' };

// Literal values a query's source step depends on (paths, URLs, servers)
function sourceLiterals(q){
  const out = [];
  q.steps.forEach(s => {
    if (DB_SOURCES.test(s.fn)) { const p = s.strings.slice(0, 2); if (p.length) out.push({ v: p.join(' / '), parts: p, db: true }); }
    else if (FILE_FNS.test(s.fn) || /File\.Contents|Web\.Contents|Folder\.Files/.test(s.expr))
      s.strings.filter(v => /^[A-Za-z]:\\|^\\\\|^https?:\/\/|\.(xlsx|xlsm|xls|csv|txt|json|parquet)$/i.test(v)).forEach(v => out.push({ v, parts: [v], db: false }));
  });
  return out;
}

function analyzeModel(list){
  const names = new Map(list.map(x => [x.name, x]));
  const items = list.map(x => {
    const type = queryType(x.code, x.loaded, x.name, x.resultType);
    const it = { name: x.name, code: x.code, loaded: x.loaded, table: x.table || '', partition: x.partition || '', props: x.props || '', tmdl: !!x.tmdl, type, fnWhy: type === 'function' ? functionReason(x.code, x.name, x.resultType) : '', q: null, error: null, checks: [], deps: [], usedBy: [], literals: [], paramValue: '' };
    if (type === 'parameter') {
      const tk = mTokenize(x.code); const s = !tk.error && tk.toks.find(t => t.t === 'str');
      it.paramValue = s ? s.v.slice(1, -1).replace(/""/g, '"') : '';
    } else {
      const q = parseM(x.code);
      if (q.error && !q.noLet) it.error = q.error;
      else if (!q.error) { it.q = q; it.checks = healthChecks(q); it.literals = sourceLiterals(q); }
    }
    // references to other queries
    const tk = mTokenize(x.code);
    if (!tk.error) {
      const own = new Set(it.q ? it.q.steps.map(s => s.name) : []);
      const toks = tk.toks;
      toks.forEach((t, k) => {
        let nm = null;
        if (t.t === 'qid') nm = qidName(t.v);
        else if (t.t === 'id') {
          let p = k - 1; while (p >= 0 && toks[p].t === 'ws') p--;
          let n = k + 1; while (n < toks.length && toks[n].t === 'ws') n++;
          if (toks[p] && toks[p].v === '[' && toks[n] && toks[n].v === ']') return;
          nm = t.v;
        }
        if (nm && nm !== x.name && names.has(nm) && !own.has(nm) && !it.deps.includes(nm)) it.deps.push(nm);
      });
    }
    return it;
  });
  const byName = new Map(items.map(i => [i.name, i]));
  items.forEach(i => i.deps.forEach(d => byName.get(d).usedBy.push(i.name)));

  // model-wide findings
  const findings = [];
  const add = (level, title, detail, queries) => findings.push({ level, title, detail, queries: queries || [] });
  items.filter(i => i.error).forEach(i => add('err', 'Couldn’t read “' + i.name + '”', i.error + ' If the code looks cut off, open this query in the Advanced Editor and use One query mode.', [i.name]));
  const lits = new Map();
  items.forEach(i => i.literals.forEach(l => { const k = l.v; if (!lits.has(k)) lits.set(k, { v: k, parts: l.parts, db: l.db, qs: [] }); if (!lits.get(k).qs.includes(i.name)) lits.get(k).qs.push(i.name); }));
  const params = items.filter(i => i.type === 'parameter');
  [...lits.values()].filter(l => l.qs.length > 1).forEach(l => {
    const p = params.find(x => l.parts.includes(x.paramValue));
    add('warn', (l.db ? 'Same server or database' : 'Same file path or URL') + ' in ' + l.qs.length + ' queries',
      l.parts.map(x => '“' + x + '”').join(' / ') + ' is typed into each of them: ' + l.qs.join(', ') + '. ' + (p ? 'The parameter “' + p.name + '” already holds ' + (l.db ? 'part of this' : 'this value') + '; use it in these queries.' : 'Parameters would let you repoint them all in one place.'), l.qs);
  });
  items.filter(i => i.type === 'query' && !i.usedBy.length && !i.error).forEach(i => add('info', '“' + i.name + '” isn’t loaded or used', 'Nothing loads it and no other query refers to it, so it only adds clutter. Check it isn’t needed, then delete it.', [i.name]));
  items.filter(i => i.type === 'function' && !i.usedBy.length).forEach(i => add('info', 'Function “' + i.name + '” isn’t used', 'No query calls it.', [i.name]));
  items.filter(i => i.type === 'parameter' && !i.usedBy.length).forEach(i => add('info', 'Parameter “' + i.name + '” isn’t used', 'No query refers to it.', [i.name]));
  const order = { table: 0, query: 1, function: 2, parameter: 3 };
  items.sort((a, b) => order[a.type] - order[b.type] || a.name.localeCompare(b.name));
  return { items, findings };
}

/* ---------- whole model: batched explain prompt ---------- */
// batch: [{ name, type, code, q, steps: [names to comment], summary: bool }]
function modelExplainPrompt(batch, o){
  const opts = Object.assign({ audience: 'mixed' }, o || {});
  const L = [];
  L.push('You are explaining Power Query (M) queries from one Power BI model. For each query below, write a short comment for each listed step' + (batch.some(b => b.summary) ? ', and a summary where asked' : '') + '.');
  L.push('');
  L.push('## TASK');
  L.push('Comment the listed steps of each query under STARTING POINT' + (batch.some(b => b.summary) ? ', and write a summary where asked' : '') + '.');
  L.push('');
  L.push('## RULES: how to write the comments');
  if (opts.audience === 'business') L.push('- Audience: report authors who don’t read M. Say what the step does to the data in plain words, not how the function works.');
  else L.push('- Audience: people who maintain the queries. Say what the step does and, where it isn’t obvious, why it matters.');
  L.push('- One sentence per step, at most 120 characters. Start with a verb: "Keeps rows where...", "Renames...".');
  L.push('- Be specific: name the columns, values and conditions from the code. When a step uses another query, name it.');
  L.push('- If a step looks wrong, unnecessary or risky, add a NOTE line saying why, briefly. Otherwise leave NOTE out.');
  L.push('- SUMMARY: 2 to 4 sentences: where the data comes from, the main changes, and what one row of the result is.');
  L.push('');
  L.push('## REPLY FORMAT (a template: replace the placeholder text with your answer)');
  L.push('Put your ENTIRE answer inside ONE code block. Write nothing before or after the code block. Every block starts with the QUERY line, using the query name exactly as given. Use each step name exactly as listed:');
  L.push('');
  L.push('@@@ SUMMARY @@@');
  L.push('QUERY: Query name');
  L.push('TEXT: Two to four sentences.');
  L.push('@@@ END @@@');
  L.push('@@@ STEP @@@');
  L.push('QUERY: Query name');
  L.push('NAME: Step name');
  L.push('COMMENT: One sentence.');
  L.push('NOTE: Only if the step looks wrong or risky.');
  L.push('@@@ END @@@');
  batch.forEach((b, i) => {
    L.push('');
    L.push('## STARTING POINT: query ' + (i + 1) + ': ' + b.name + ' (' + (TYPE_LABEL[b.type] || 'query').toLowerCase() + ')');
    L.push(b.summary ? 'Write a SUMMARY for this query.' : 'No summary needed.');
    L.push('Steps to comment:');
    b.steps.forEach((n, k) => { const s = b.q.steps.find(x => x.name === n); L.push((k + 1) + '. ' + n + (s && s.fn ? ' (' + s.fn + ')' : '')); });
    L.push('Code:');
    L.push(b.code.trim());
  });
  L.push('');
  L.push('=== END OF PROMPT ===');
  return L.join('\n');
}
function parseModelExplain(text){
  const t = cleanReply(text).replace(/[‘’]/g, "'");
  const res = { summaries: [], steps: [], error: null };
  if (!t.trim()) return res;
  const bs = answerBlocks(t);
  const L = ['QUERY', 'NAME', 'COMMENT', 'NOTE', 'TEXT'];
  const qn = b => field(b.body, 'QUERY', L).replace(/^#"(.*)"$/s, '$1').replace(/^"(.*)"$/s, '$1').replace(/""/g, '"').trim();
  bs.forEach(b => {
    if (b.kind === 'STEP') {
      const name = field(b.body, 'NAME', L).replace(/^#"(.*)"$/s, '$1').replace(/^"(.*)"$/s, '$1').replace(/""/g, '"').trim();
      if (name) res.steps.push({ query: qn(b), name, comment: oneLine(field(b.body, 'COMMENT', L)), note: oneLine(field(b.body, 'NOTE', L)) });
    } else if (b.kind === 'SUMMARY') {
      const text = oneLine(field(b.body, 'TEXT', L) || b.body.replace(/(^|\n)[ \t]*QUERY[ \t]*:.*/i, '').replace(/^[ \t]*```[\w-]*[ \t]*$/gm, ''));
      if (text) res.summaries.push({ query: qn(b), text });
    }
  });
  if (!res.steps.length && !res.summaries.length) res.error = 'No @@@ STEP @@@ blocks were found. Make sure Copilot answered inside one code block, and paste its whole answer.';
  return res;
}
