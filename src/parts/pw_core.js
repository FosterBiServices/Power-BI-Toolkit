
/* ---------- Power Query Writer: a Copilot prompt that writes a short, maintainable M query, and checks of the reply ----------
   Uses the Power Query Explainer's tokenizer and parser (mTokenize, parseM, healthChecks, paramQuery, blocks, field, cleanReply). */
const PW = (() => {
  const SOURCES = [
    ['sql', 'SQL Server or Azure SQL', 'Server, database and table or view, for example sql-prod / SalesDW / dbo.FactSales'],
    ['excel', 'Excel workbook', 'File path or SharePoint link, and the sheet or table name'],
    ['csv', 'CSV or text file', 'File path or SharePoint link, delimiter and encoding if not comma and UTF-8'],
    ['spfolder', 'SharePoint folder of files', 'Site URL, folder, and which files to combine'],
    ['folder', 'Folder of files', 'Folder path, and which files to combine'],
    ['splist', 'SharePoint list', 'Site URL and list name'],
    ['web', 'Web page or API (JSON)', 'URL, and any paging or authentication notes'],
    ['dataverse', 'Dataverse', 'Environment URL and table'],
    ['odbc', 'Other database (ODBC, Oracle, Snowflake…)', 'Connector, server, database and table'],
    ['query', 'Another query in this file', 'Query name, for example stgSales'],
    ['other', 'Something else', 'Describe the source']
  ];
  const DB = new Set(['sql', 'odbc', 'dataverse']);

  // column list from a pasted header row, a few rows copied from the preview, Table.Schema output, or one name per line
  function parseColumns(text){
    const lines = (text || '').replace(/\r/g, '').split('\n').filter(l => l.trim());
    if (!lines.length) return [];
    const cells = l => l.split('\t').map(c => c.trim().replace(/^"(.*)"$/, '$1'));
    const head = cells(lines[0]);
    // Table.Schema output: Name, Position, TypeName, Kind…
    const lh = head.map(h => h.toLowerCase());
    if (lh.includes('name') && (lh.includes('typename') || lh.includes('kind'))) {
      const ni = lh.indexOf('name'), ti = lh.indexOf('typename') >= 0 ? lh.indexOf('typename') : lh.indexOf('kind');
      return lines.slice(1).map(l => { const c = cells(l); return { name: c[ni], type: (c[ti] || '').replace(/^Type\./i, '').replace(/\.Type$/i, '').toLowerCase() }; }).filter(c => c.name);
    }
    if (head.length > 1) {
      const rows = lines.slice(1, 30).map(cells);
      return head.map((h, i) => ({ name: h, type: guessType(rows.map(r => r[i]).filter(v => v != null && v !== '' && !/^null$/i.test(v))) })).filter(c => c.name);
    }
    // one name per line, optionally "Name: type" or "Name (type)"
    return lines.map(l => { const m = l.trim().match(/^(.+?)\s*(?:[:|]\s*|\()\s*(text|number|whole number|decimal|date|datetime|datetimezone|time|logical|true\/false|currency|duration)\)?\s*$/i); return m ? { name: m[1].trim(), type: m[2].toLowerCase() } : { name: l.trim().replace(/^[-*•]\s*/, ''), type: '' }; }).filter(c => c.name);
  }
  function guessType(vals){
    if (!vals.length) return '';
    const all = re => vals.every(v => re.test(v.trim()));
    if (all(/^-?\d+$/)) return 'whole number';
    if (all(/^-?[\d,]*\.?\d+([eE][-+]?\d+)?$/) || all(/^-?\$?[\d,]+(\.\d+)?$/)) return 'number';
    if (all(/^(true|false)$/i)) return 'logical';
    if (all(/^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/)) return 'date';
    if (all(/^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}[ T]\d{1,2}:\d{2}/)) return 'datetime';
    return 'text';
  }
  function parseParams(text){
    return (text || '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean).map(l => { const m = l.match(/^#?"?([^"=:]+?)"?\s*[=:]\s*(.*)$/); return m ? { name: m[1].trim(), value: m[2].trim() } : { name: l, value: '' }; }).filter(p => p.name);
  }
  function parseMerges(text){
    return (text || '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean).map(l => { const m = l.match(/^([^:]+):\s*(.*)$/); return m ? { query: m[1].trim(), columns: m[2].split(/[,;\t]/).map(s => s.trim()).filter(Boolean) } : { query: l, columns: [] }; });
  }

  function prompt(inp){
    const L = [];
    const src = SOURCES.find(s => s[0] === inp.source) || SOURCES[SOURCES.length - 1];
    const db = DB.has(inp.source) || (inp.start === 'existing' && inp.existingDb);
    const cols = parseColumns(inp.columns), params = parseParams(inp.params), merges = parseMerges(inp.merges);
    L.push('You are an expert in Power Query M. Write one Power Query query for Power BI that does what is asked below.');
    L.push('The query must work first time, be easy for another developer to maintain, and be as short as it can be while still doing everything asked. Leave out anything that isn’t asked for.');
    L.push('', 'WHAT IT SHOULD DO', (inp.goal || '(not given)').trim());
    L.push('', 'STARTING POINT');
    if (inp.start === 'existing' && (inp.existing || '').trim()) {
      L.push('Build on this existing query. Keep its source step exactly as it is (same connector and arguments), and keep what it already does unless the request says otherwise:', '```', inp.existing.trim(), '```');
    } else {
      L.push('Source: ' + src[1] + '.');
      if ((inp.sourceDetail || '').trim()) L.push('Details: ' + inp.sourceDetail.trim());
      if (inp.source === 'query') L.push('Reference the other query by its name as the first step (Source = QueryName); don’t repeat its steps.');
    }
    if (cols.length) {
      L.push('', 'COLUMNS AVAILABLE AT THE START (exact names; types are from the data where known)');
      cols.forEach(c => L.push('- ' + c.name + (c.type ? ' (' + c.type + ')' : '')));
    } else L.push('', 'COLUMNS: not given. Use the column names from the request. If you have to assume a name, list it under QUESTIONS.');
    if (merges.length) {
      L.push('', 'OTHER QUERIES YOU MAY MERGE WITH (use these names exactly)');
      merges.forEach(m => L.push('- ' + m.query + (m.columns.length ? ': ' + m.columns.join(', ') : '')));
    }
    if (params.length) {
      L.push('', 'PARAMETERS THAT ALREADY EXIST (use them by name instead of typing the value)');
      params.forEach(p => L.push('- ' + p.name + (p.value ? ' = ' + p.value : '')));
    }
    if ((inp.culture || '').trim()) L.push('', 'Culture for types and dates: ' + inp.culture.trim());
    L.push('', 'RULES');
    L.push('It must work:');
    L.push('- Use only the column names listed above (exact spelling and case) and columns the query itself creates. If you need a column that isn’t listed, don’t guess: say so under QUESTIONS.');
    L.push('- Each step builds on an earlier step, and the query returns its last step after "in".');
    L.push('- Set the types of the columns the query keeps in one Table.TransformColumnTypes step' + ((inp.culture || '').trim() ? ' with the culture above' : '') + '. Give each new column its type in the fourth argument of Table.AddColumn instead of another type step.');
    L.push('- Handle nulls and errors only where the request says to expect them. Don’t wrap everything in try … otherwise.');
    L.push('- ' + (inp.makeParams ? 'Don’t type a server, database, file path or URL into the query. Use an existing parameter, or add a new parameter under PARAMETERS and use its name.' : 'Keep the source values as given.'));
    L.push('It must be easy to maintain:');
    L.push('- Name every step with a single descriptive word, no spaces and no #"..." quoting (PascalCase when it needs two words, for example Source, Filtered, Typed, RecentOrders). Say what the step achieves, not which button made it.');
    L.push('- Keep columns with Table.SelectColumns and an explicit list, not Table.RemoveColumns, so new source columns don’t flow through and a missing one is caught early.');
    L.push('- Refer to columns by name, never by position.');
    L.push('- Add a short // comment on the line above a step only when why it’s there isn’t obvious from its name and code. No comments that repeat the code.');
    L.push('It must be short:');
    L.push('- One step per kind of change: all row conditions in one Table.SelectRows, all renames in one Table.RenameColumns, all types in one Table.TransformColumnTypes.');
    L.push('- No automatic "Changed Type" or leftover steps, no sort unless asked (row order isn’t kept in the model), no index or buffer steps unless they are needed and explained in a comment.');
    L.push('- Filter rows and choose columns as early as possible.' + (db ? ' The source is a database: keep every step that can be sent to it (query folding) before any step that can’t, and avoid Table.Buffer, Table.AddIndexColumn and custom functions over rows before the filters.' : ''));
    L.push('Formatting (the style of powerqueryformatter.com):');
    L.push('- "let" and "in" on their own lines at the left margin. Each step on its own line, indented 4 spaces, ending with a comma except the last. The step name after "in" indented 4 spaces.');
    L.push('- If a function call doesn’t fit in about 100 characters, put each argument on its own line indented 4 more spaces, with the closing ) on its own line at the indentation of the line that opened it.');
    L.push('- Lists { } and records [ ] that don’t fit on one line: one item per line, the same way. Column-and-type pairs one per line: {"Column", type text}.');
    L.push('- One space after commas and around = and operators. Spaces only, no tabs, no trailing spaces. Use "each" and [Column] for single-argument functions.');
    L.push('', 'REPLY FORMAT');
    L.push('Reply with these blocks only, nothing before or after them:');
    L.push('@@@ QUERY @@@', 'let', '    ...', 'in', '    LastStep', '@@@ END @@@');
    L.push('@@@ STEPS @@@', 'StepName: one short sentence on what the step does and why', '(one line per step, in order)', '@@@ END @@@');
    L.push('@@@ PARAMETERS @@@', 'Name | Type | Value', '(only parameters that must be created; leave the block empty if none)', '@@@ END @@@');
    L.push('@@@ QUESTIONS @@@', 'Anything you had to assume, or need to know to finish the query. Leave empty if none.', '@@@ END @@@');
    return L.join('\n');
  }

  function parseReply(text){
    const t = cleanReply(text).replace(/[‘’]/g, "'");
    if (!t.trim()) return null;
    // Copilot sometimes repeats the prompt's format example before its answer: skip the example blocks, use the last real one
    const example = b => b.kind === 'QUERY' ? /^\s*let\s+\.\.\.\s+in\s+LastStep\s*$/.test(b.body)
      : b.kind === 'STEPS' ? /StepName: one short sentence on what the step does/.test(b.body)
      : b.kind === 'PARAMETERS' ? /\(only parameters that must be created/.test(b.body)
      : b.kind === 'QUESTIONS' ? /^\s*Anything you had to assume, or need to know to finish the query\. Leave empty if none\.\s*$/.test(b.body) : false;
    const all = blocks(t), bs = all.filter(b => !example(b)).reverse();
    const qb = bs.find(b => b.kind === 'QUERY' || b.kind === 'CODE');
    let code = qb ? qb.body.replace(/^[ \t]*```[\w-]*[ \t]*$/gm, '').replace(/^\s*\n|\s+$/g, '') : '';
    if (!code) { const m = t.match(/```(?:m|powerquery|pq)?\s*\n([\s\S]*?\blet\b[\s\S]*?)```/i); if (m) code = m[1].trim(); else if (/^\s*let\b[\s\S]*\bin\b/.test(t)) code = t.trim(); }
    const lines = b => (b ? b.body.replace(/^[ \t]*```[\w-]*[ \t]*$/gm, '').split('\n').map(s => s.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean) : []);
    const steps = lines(bs.find(b => b.kind === 'STEPS')).map(l => { const m = l.match(/^#?"?([^":]+?)"?\s*:\s*(.+)$/); return m ? { name: m[1].trim(), text: m[2].trim() } : null; }).filter(Boolean);
    const params = lines(bs.find(b => b.kind === 'PARAMETERS')).filter(l => !/^name\s*\|/i.test(l) && /\|/.test(l)).map(l => { const c = l.split('|').map(s => s.trim()); return { name: c[0].replace(/^#"(.*)"$/, '$1'), type: c[1] || 'Text', value: c.slice(2).join('|') }; }).filter(p => p.name && !/^\(/.test(p.name));
    const questions = lines(bs.find(b => b.kind === 'QUESTIONS')).filter(l => !/^\(?leave empty|^none\.?$|^n\/a$/i.test(l));
    // only the prompt's format example, no answer: the prompt was pasted back, or Copilot stopped before answering
    if (!code && all.some(example))
      return { code: '', steps: [], params: [], questions: [], error: 'This has only the prompt’s format example, not a query from Copilot. If you pasted the prompt, send it to Copilot and paste its answer here. If Copilot repeated the format without answering, ask it to fill in the blocks.' };
    return { code, steps, params, questions, error: code ? null : 'No @@@ QUERY @@@ block was found. Paste Copilot’s whole reply, or ask it to answer in the format the prompt gives.' };
  }

  // columns the query reads and the ones it creates, from its step code
  function columnUse(q){
    const created = new Set(), read = new Map();
    const note = (n, step) => { if (!read.has(n)) read.set(n, step); };
    q.steps.forEach(s => {
      const e = s.expr, strs = s.strings;
      // [Column] field access (not #"step" references)
      // (skipping navigation such as Source{[...]}[Data] and record fields after a call)
      (e.match(/(^|[^})\]\w])\[\s*(#"(?:[^"]|"")*"|[^\[\]"=,]+?)\s*\]/g) || []).map(m => m.replace(/^[^\[]/, '')).forEach(m => { const n = m.slice(1, -1).trim().replace(/^#"(.*)"$/, '$1').replace(/""/g, '"'); if (n && !/[=]/.test(n)) note(n, s.name); });
      if (s.fn === 'Table.AddColumn' && strs[0]) created.add(strs[0]);
      if (s.fn === 'Table.DuplicateColumn' && strs[1]) { note(strs[0], s.name); created.add(strs[1]); }
      if (s.fn === 'Table.RenameColumns') for (let i = 0; i + 1 < strs.length; i += 2) { note(strs[i], s.name); created.add(strs[i + 1]); }
      if (/^Table\.(ExpandTableColumn|ExpandRecordColumn)$/.test(s.fn)) { note(strs[0], s.name); strs.slice(1).forEach(x => created.add(x)); }
      if (s.fn === 'Table.NestedJoin') { created.add(strs[strs.length - 1]); }
      if (s.fn === 'Table.Group') { const m = e.match(/\{\s*"((?:[^"]|"")*)"\s*,\s*each/g) || []; m.forEach(x => created.add(x.match(/"((?:[^"]|"")*)"/)[1])); }
      if (s.fn === 'Table.CombineColumns' && strs.length) created.add(strs[strs.length - 1]);
      if (/^Table\.(SplitColumn)$/.test(s.fn)) strs.slice(1).forEach(x => created.add(x));
      if (/^Table\.(Unpivot|UnpivotOtherColumns)$/.test(s.fn) && strs.length >= 2) { created.add(strs[strs.length - 1]); created.add(strs[strs.length - 2]); }
      if (/^Table\.(SelectColumns|RemoveColumns|TransformColumnTypes|Sort|Distinct|FillDown|FillUp|ReorderColumns|TransformColumns|ReplaceValue|Pivot)$/.test(s.fn)) strs.forEach(x => { if (!/^(en|fr|de|es|nl|it|pt|ja|zh|sv|da|nb|fi)-[A-Z]{2}$/.test(x)) note(x, s.name); });
      if (s.fn === 'Table.Group') { const m = e.match(/Table\.Group\s*\(\s*[^,]+,\s*\{([^}]*)\}/); if (m) (m[1].match(/"((?:[^"]|"")*)"/g) || []).forEach(x => note(x.slice(1, -1), s.name)); }
    });
    return { created, read };
  }

  function checks(code, inp){
    const out = [];
    const add = (level, title, detail, step) => out.push({ level, title, detail, step });
    const q = parseM(code);
    if (q.error) { add('err', 'The query can’t be read', q.error); return { q, list: out }; }
    // step names: one word, no spaces
    const bad = q.steps.filter(s => s.quoted || !/^[A-Za-z][A-Za-z0-9]*$/.test(s.name));
    if (bad.length) add('warn', bad.length + ' step name' + (bad.length > 1 ? 's don’t' : ' doesn’t') + ' follow the naming rule', bad.map(s => '“' + s.name + '”').join(', ') + '. Use a single descriptive word with no spaces or quoting.');
    // leftovers, unused steps, result not last, removes, type steps, folding, hard-coded values (the Explainer's checks)
    healthChecks(q).forEach(c => { if (/default name/.test(c.title)) return; add(c.level === 'warn' ? 'warn' : 'info', c.title, c.detail, c.step); });
    const kinds = [['Table.RenameColumns', 'rename'], ['Table.SelectRows', 'filter'], ['Table.SelectColumns', 'column-choice']];
    kinds.forEach(([fn, word]) => { const n = q.steps.filter(s => s.fn === fn); if (n.length > 1) add('info', n.length + ' ' + word + ' steps', n.map(s => s.name).join(', ') + ' could usually be one step.'); });
    // parameters given but values typed in
    const params = parseParams(inp.params);
    params.forEach(p => { const v = (p.value || '').replace(/^"|"$/g, ''); if (v && q.steps.some(s => s.strings.includes(v))) add('warn', 'Typed-in value for an existing parameter', '“' + v + '” is typed into the query; use the parameter ' + p.name + ' instead.'); });
    // columns
    const cols = parseColumns(inp.columns);
    if (cols.length) {
      const have = new Set(cols.map(c => c.name.toLowerCase()));
      const merges = parseMerges(inp.merges); merges.forEach(m => m.columns.forEach(c => have.add(c.toLowerCase())));
      const u = columnUse(q); u.created.forEach(c => have.add(c.toLowerCase()));
      // columns the connectors themselves return (file lists, workbook contents, navigation tables)
      if (q.steps.some(x => /^(Folder\.(Files|Contents)|SharePoint\.(Files|Contents))$/.test(x.fn))) ['Content', 'Name', 'Extension', 'Date accessed', 'Date modified', 'Date created', 'Attributes', 'Folder Path'].forEach(c => have.add(c.toLowerCase()));
      if (q.steps.some(x => /^(Excel\.Workbook|Sql\.Database|Sql\.Databases|Odbc\.DataSource|SharePoint\.Tables)$/.test(x.fn))) ['Name', 'Data', 'Item', 'Kind', 'Hidden', 'Schema'].forEach(c => have.add(c.toLowerCase()));
      const unknown = [...u.read.entries()].filter(([n]) => !have.has(n.toLowerCase()) && !q.steps.some(s => s.name === n));
      if (unknown.length) add('warn', unknown.length + ' column name' + (unknown.length > 1 ? 's aren’t' : ' isn’t') + ' in the columns you gave', unknown.slice(0, 10).map(([n, s]) => '“' + n + '” (step ' + s + ')').join(', ') + (unknown.length > 10 ? ' and more' : '') + '. Check the spelling, or that an earlier step creates it. If it comes from a merged query, list that query’s columns in Step 2.');
      else add('ok', 'Every column name matches', 'All the columns the query reads are in the list you gave or are created by the query.');
    }
    // formatting
    const lines = code.replace(/\r/g, '').split('\n');
    const long = lines.filter(l => l.length > 120).length, tabs = lines.filter(l => /\t/.test(l)).length, trail = lines.filter(l => /[ \t]+$/.test(l)).length;
    const stepIndent = q.steps.filter(s => s.indent !== '    ').length;
    const fmt = [];
    if (!/^let\s*$/m.test(code) || !/^in\s*$/m.test(code)) fmt.push('"let" and "in" should be on their own lines at the left margin');
    if (stepIndent) fmt.push(stepIndent + ' step' + (stepIndent > 1 ? 's aren’t' : ' isn’t') + ' indented 4 spaces');
    if (long) fmt.push(long + ' line' + (long > 1 ? 's are' : ' is') + ' longer than 120 characters');
    if (tabs) fmt.push('tabs on ' + tabs + ' line' + (tabs > 1 ? 's' : ''));
    if (trail) fmt.push('trailing spaces on ' + trail + ' line' + (trail > 1 ? 's' : ''));
    if (fmt.length) add('info', 'Formatting', cap(fmt.join('; ')) + '. Paste it into powerqueryformatter.com to tidy it, or ask Copilot to fix the format.');
    const comments = (code.match(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g) || []).length;
    if (comments > Math.max(3, q.steps.length * 0.6)) add('info', 'Many comments', comments + ' comments on ' + q.steps.length + ' steps. Keep comments for steps whose reason isn’t obvious.');
    if (!out.some(c => c.level === 'err' || c.level === 'warn')) add('ok', 'Reads correctly', q.steps.length + ' steps, every step reference exists, and the query returns its last step.');
    return { q, list: out };
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  return { SOURCES, DB, parseColumns, parseParams, parseMerges, prompt, parseReply, checks, columnUse };
})();
