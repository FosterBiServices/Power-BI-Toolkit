
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
    const out = [];
    (text || '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean).forEach(l => {
      const m = l.match(/^([^:\t]+):\s*(.*)$/), prev = out[out.length - 1];
      // a pasted header row (tab-separated) under a query name: that query's columns
      if (!m && /\t/.test(l) && prev && !prev.columns.length) { prev.columns = l.split('\t').map(s => s.trim()).filter(Boolean); return; }
      out.push(m ? { query: m[1].trim(), columns: m[2].split(/[,;\t]/).map(s => s.trim()).filter(Boolean) } : { query: l, columns: [] });
    });
    return out;
  }

  /* The owner's way to set types: a list of column-and-type pairs, applied only to the columns that exist, with every
     other column typed as text, in one Table.TransformColumnTypes. A source column that's missing or renamed doesn't
     break the refresh. cols: [{ name, type }] from parseColumns; prev: the step it starts from. */
  const M_TYPE = { 'whole number': 'Int64.Type', number: 'type number', date: 'type date', datetime: 'type datetime', time: 'type time', logical: 'type logical', text: 'type text' };
  function typeMap(cols, prev, culture){
    const q = n => '"' + n.replace(/"/g, '""') + '"', P = prev || 'PromotedHeaders', I = '    ', I2 = I + I, I3 = I2 + I;
    const pairs = cols.map(c => I2 + '{' + q(c.name) + ', ' + (M_TYPE[c.type] || 'type text') + '}');
    return [I + 'TypePairs = {', pairs.join(',\n'), I + '},',
      I + 'ExistingCols = Table.ColumnNames(' + P + '),',
      I + '// Keep type rules only for columns that actually exist',
      I + 'TypePairsExistingOnly = List.Select(TypePairs, each List.Contains(ExistingCols, _{0})),',
      I + '// Turn the pairs into a lookup record: column name -> type',
      I + 'ExplicitTypeMap = Record.FromList(', I2 + 'List.Transform(TypePairsExistingOnly, each _{1}),', I2 + 'List.Transform(TypePairsExistingOnly, each _{0})', I + '),',
      I + '// A type from ExplicitTypeMap where there is one; every other column is text',
      I + 'AllTypePairs = List.Transform(', I2 + 'ExistingCols,', I2 + '(c) => {c, Record.FieldOrDefault(ExplicitTypeMap, c, type text)}', I + '),',
      I + '// Apply types in one go',
      I + 'ChangeTypes = Table.TransformColumnTypes(' + P + ', AllTypePairs' + ((culture || '').trim() ? ', ' + q(culture.trim()) : '') + ')'].join('\n');
  }
  // the "each" rule, with examples in the user's own columns when they listed some (a text column for the value example)
  function eachRule(cols){
    const q = n => '"' + n.replace(/"/g, '""') + '"', f = n => /^[^\[\]]+$/.test(n) ? '[' + n + ']' : '[#' + q(n) + ']';
    const txt = (cols.find(c => /text/i.test(c.type || '')) || cols[0] || { name: 'Customer Name' }).name;
    const row = (cols.find(c => c.name !== txt) || { name: cols.length ? txt : 'First Name' }).name;
    return 'In value transformations such as Table.TransformColumns, pass the current value with _, for example {' + q(txt) + ', each Text.Upper(_), type text}. '
      + 'In row-context expressions such as Table.AddColumn and Table.SelectRows, refer to columns by name, for example each ' + f(row) + '.';
  }
  /* The fx side of the inputs: the cleaning recipes and type map as steps (PWF.recipeSteps), their code, and every function
     the query may call by name (the library functions used, all of them when the person has them, and their own). */
  function fxInfo(inp){
    const cols = parseColumns(inp.columns);
    const rs = typeof PWF === 'undefined' ? null : PWF.recipeSteps({ cols, fx: inp.fx, typeMap: inp.typeMap, typeHow: inp.typeHow, culture: inp.culture }, 'PromotedHeaders');
    const code = rs ? PWF.render(rs, (c, prev) => typeMap(c, prev, inp.culture)) : '';
    const known = typeof PWF === 'undefined' ? [] : PWF.known({ recipes: rs, haveFx: inp.haveFx, myFns: inp.myFns });
    return { cols, rs, code, known };
  }
  // {"First Name", "Last Name"} from the person's own columns when there are some
  function colListExample(cols){
    const n = cols.slice(0, 2).map(c => c.name);
    return '{' + (n.length ? n : ['First Name', 'Last Name']).map(x => '"' + x.replace(/"/g, '""') + '"').join(', ') + '}';
  }
  function prompt(inp){
    const L = [];
    const src = SOURCES.find(s => s[0] === inp.source) || SOURCES[SOURCES.length - 1];
    const fromExisting = inp.start === 'existing' && !!(inp.existing || '').trim();
    const db = fromExisting ? !!inp.existingDb : DB.has(inp.source);
    const cols = parseColumns(inp.columns), params = parseParams(inp.params), merges = parseMerges(inp.merges), fx = fxInfo(inp);
    L.push('You are an expert in Power Query M. Write one Power Query query for Power BI that does what is asked below.');
    L.push('The query must work first time, be easy for another developer to maintain, and be as short as it can be while still doing everything asked. Leave out anything that isn’t asked for.');
    L.push('', 'TASK (the user’s request: all the query has to do)', (inp.goal || '(not given)').trim());
    L.push('', 'STARTING POINT');
    if (inp.start === 'existing' && (inp.existing || '').trim()) {
      L.push('Build on this existing query. Keep its steps as they are, including the source step (same connector and arguments), and keep what it already does unless the request says otherwise. The naming and parameter rules below apply to the steps you add:', '```', inp.existing.trim(), '```');
    } else {
      L.push('Source: ' + src[1] + '.');
      if ((inp.sourceDetail || '').trim()) L.push('Details: ' + inp.sourceDetail.trim());
      if (inp.source === 'query') L.push('Reference the other query by its name as the first step (Source = QueryName); don’t repeat its steps.');
    }
    L.push('', 'CONTEXT (facts about the data, not things to do)');
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
    if (fx.known.length) {
      L.push('', 'FUNCTIONS THAT ALREADY EXIST (queries in this file: call them by name)');
      fx.known.forEach(f => L.push('- ' + f.sig + (f.does ? ': ' + f.does : '')));
    }
    if ((inp.culture || '').trim()) L.push('', 'Culture for types and dates: ' + inp.culture.trim());
    L.push('', 'RULES');
    L.push('It must work:');
    L.push('- Use only the column names listed above (exact spelling and case) and columns the query itself creates. If you need a column that isn’t listed, don’t guess: say so under QUESTIONS.');
    L.push('- Each step builds on an earlier step, and the query returns its last step after "in".');
    const typed = inp.typeMap && cols.length, viaFx = fx.rs && fx.rs.fns.includes('fxApplyTypes');
    if (fx.rs) {
      L.push('- Clean ' + (typed ? 'and type ' : '') + 'the data with these steps. They are required (the user asked for them), so add them even if the TASK doesn\u2019t mention them. Put them right after the step where the column names are final (after promoting headers or renaming), replace PromotedHeaders with that step\u2019s name, and keep them as they are otherwise: the steps, their order, the column lists' + (typed ? ', the type pairs' + (viaFx ? '' : ', the default of type text for any other column') : '') + ' and the options. Every later step builds on ' + fx.rs.last + '. Change one only if the TASK says so.' + (typed ? ' Give each newly created column its type in the fourth argument of Table.AddColumn.' : ''), '```', fx.code, '```');
      if (!typed) L.push('- If the TASK requires changing existing column types, make all such changes in one Table.TransformColumnTypes step' + ((inp.culture || '').trim() ? ' with the culture above' : '') + '. Do not add a type-conversion step when no existing column types need to change. Give each newly created column its type in the fourth argument of Table.AddColumn.');
    } else if (typed) {
      L.push('- Set the column types with this type map. It is required (the user asked for it), so add it even if the TASK doesn\u2019t mention types. Put it right after the step where the column names are final (after promoting headers or renaming), replace PromotedHeaders with that step\u2019s name, and keep it as it is otherwise: the pairs, the default of type text for any other column, and one Table.TransformColumnTypes. Every later step builds on ChangeTypes. Change a pair\u2019s type only if the TASK says so. Give each newly created column its type in the fourth argument of Table.AddColumn.', '```', typeMap(cols, 'PromotedHeaders', inp.culture), '```');
    } else L.push('- If the TASK requires changing existing column types, make all such changes in one Table.TransformColumnTypes step' + ((inp.culture || '').trim() ? ' with the culture above' : '') + '. Do not add a type-conversion step when no existing column types need to change. Give each newly created column its type in the fourth argument of Table.AddColumn.');
    if (fx.known.length) L.push('- Call the functions under FUNCTIONS THAT ALREADY EXIST by name with the arguments shown. Don\u2019t copy their code into the query or write your own version of them. Use one wherever it does what the TASK needs. Give column names as a list of text in double quotes with no square brackets, for example ' + colListExample(cols) + ', not {' + colListExample(cols).slice(1, -1).replace(/"([^"]*)"/g, '"[$1]"') + '}. A name these functions don\u2019t find is skipped without an error, so a wrong name silently does nothing.');
    L.push('- Use each correctly for where it is evaluated. ' + eachRule(cols));
    L.push('- Handle nulls and errors only where the request says to expect them. Don’t wrap everything in try … otherwise.');
    L.push('- ' + (!inp.makeParams ? 'Keep the source values as given.' : fromExisting ? 'Keep the existing source step as it is. Don’t type a server, database, file path or URL into any step you add: use an existing parameter, or add a new parameter under PARAMETERS and use its name.' : 'Don’t type a server, database, file path or URL into the query. Use an existing parameter, or add a new parameter under PARAMETERS and use its name.'));
    L.push('It must be easy to maintain:');
    L.push('- Name every step with a single descriptive word, no spaces and no #"..." quoting (PascalCase when it needs two words, for example Source, Filtered, Typed, RecentOrders). Say what the step achieves, not which button made it. Don\u2019t name a step after a function library (Table, List, Text, Number, Date, DateTime, Duration, Time, Record, Value, Type), for example WithDuration, not Duration.');
    L.push('- If the TASK names columns to remove, remove them in one Table.RemoveColumns with MissingField.Ignore as the third argument, so a column that is already gone doesn\u2019t break the refresh. If the TASK says which columns to keep, use Table.SelectColumns with an explicit list. Do not add a column step unless the TASK changes the columns.');
    L.push('- Refer to columns by name, never by position.');
    L.push('- Add a short // comment on the line above a step only when why it’s there isn’t obvious from its name and code. No comments that repeat the code.');
    L.push('It must be short:');
    L.push('- One step per kind of change the TASK needs: all row conditions in one Table.SelectRows, all renames in one Table.RenameColumns, all type changes in one Table.TransformColumnTypes.');
    L.push('- No automatic "Changed Type" or leftover steps, no sort unless asked (row order isn’t kept in the model), no index or buffer steps unless they are needed and explained in a comment.');
    L.push('- When the TASK filters rows or limits columns, do it as early as possible.' + (db ? ' The source is a database: keep every step that can be sent to it (query folding) before any step that can’t, and avoid Table.Buffer, Table.AddIndexColumn and custom functions over rows before the filters.' : ''));
    L.push('Formatting (the style of powerqueryformatter.com):');
    L.push('- "let" and "in" on their own lines at the left margin. Each step on its own line, indented 4 spaces, ending with a comma except the last. The step name after "in" indented 4 spaces.');
    L.push('- If a function call doesn’t fit in about 100 characters, put each argument on its own line indented 4 more spaces, with the closing ) on its own line at the indentation of the line that opened it.');
    L.push('- Lists { } and records [ ] that don’t fit on one line: one item per line, the same way. Column-and-type pairs one per line: {"Column", type text}.');
    L.push('- One space after commas and around = and operators. Spaces only, no tabs, no trailing spaces.');
    L.push('', 'FINAL VALIDATION', 'Before producing the answer, silently validate the final M query:');
    VALIDATION.concat(fx.known.length ? [FN_CHECK] : []).forEach(x => L.push('- ' + x));
    L.push('If any check fails, correct the query before replying. Do not report an unvalidated query.');
    L.push('', 'REPLY FORMAT (a template: replace the placeholder lines with your answer)');
    L.push('Reply with these blocks only, nothing before or after them:');
    L.push('@@@ QUERY @@@', 'let', '    ...', 'in', '    LastStep', '@@@ END @@@');
    L.push('@@@ STEPS @@@', 'StepName: one short sentence on what the step does and why', '(one line per step, in order)', '@@@ END @@@');
    L.push('@@@ PARAMETERS @@@', 'Name | Type | Value', '(only parameters that must be created; leave the block empty if none)', '@@@ END @@@');
    L.push('@@@ QUESTIONS @@@', 'Anything you had to assume, or need to know to finish the query. Leave empty if none.', '@@@ END @@@');
    return L.join('\n');
  }

  const VALIDATION = ['It is syntactically valid Power Query M.', 'Every function has the required arguments.', 'Every each expression uses the correct context: _ for the current value or [Column] for row context.',
    'All parentheses (), braces {}, brackets [], quotes, and commas are correctly paired and positioned.', 'Every step references an existing earlier step.', 'The in expression returns the final step.',
    'No step was added solely because it appeared in an example or rule when the TASK did not require that operation.', 'No columns, types, values, paths, URLs, parameters, or business rules were invented.',
    'The query performs everything in TASK and nothing beyond TASK.'];
  const FN_CHECK = 'Every function called by name is a Power Query function or is listed under FUNCTIONS THAT ALREADY EXIST.';
  /* The follow-up when the query doesn't work: the error from Desktop (or what's wrong) and the page's findings, the current
     query as the starting point, and change only what the fix needs. The reply comes back in the same format, plus CHANGES. */
  function fixPrompt(inp, reply, findings, problem){
    const L = [], cols = parseColumns(inp.columns), prob = (problem || '').trim(), fx = fxInfo(inp);
    const found = (findings || []).filter(f => f.level === 'err' || f.level === 'warn');
    L.push('You are an expert in Power Query M. The query under STARTING POINT doesn\u2019t work yet. Fix it.');
    L.push('', 'TASK (what to fix)', prob ? 'Fix this problem from Power BI Desktop: ' + prob + (found.length ? '\nAlso fix the problems found when the query was checked, listed under CONTEXT.' : '') : 'Fix the problems found when the query was checked, listed under CONTEXT.');
    L.push('', 'CONTEXT (facts, not things to do)', 'What the query is for: ' + ((inp.goal || '').trim() || '(not given)'));
    if (prob) L.push('', 'ERROR OR PROBLEM IN POWER BI DESKTOP (as the user gave it)', prob);
    if (found.length) { L.push('', 'PROBLEMS FOUND WHEN THE QUERY WAS CHECKED'); found.forEach(f => L.push('- ' + f.title + (f.detail ? ': ' + f.detail.replace(/\s+/g, ' ') : ''))); }
    if (cols.length) { L.push('', 'COLUMNS AVAILABLE AT THE START (exact names)'); cols.forEach(c => L.push('- ' + c.name + (c.type ? ' (' + c.type + ')' : ''))); }
    if (fx.known.length) { L.push('', 'FUNCTIONS THAT ALREADY EXIST (queries in this file: call them by name)'); fx.known.forEach(f => L.push('- ' + f.sig + (f.does ? ': ' + f.does : ''))); }
    if ((reply.params || []).length) { L.push('', 'PARAMETERS THE QUERY USES'); reply.params.forEach(p => L.push('- ' + p.name + (p.type ? ' (' + p.type + ')' : ''))); }
    L.push('', 'STARTING POINT', 'The current query:', '```', reply.code.trim(), '```');
    L.push('', 'RULES');
    L.push('- Change only what the fix needs. Keep every other step as it is: its name, its place and its code. Keep the source step, the parameters' + (fx.rs ? ', and the cleaning and type steps (' + fx.rs.fns.concat(fx.rs.typeCode ? ['TypePairs'] : []).join(', ') + ') unless the problem is in them' : inp.typeMap ? ', and the type map (TypePairs and the steps after it) unless the problem is in it' : '') + '.' + (fx.known.length ? ' A "wasn\u2019t recognized" error for a function listed under FUNCTIONS THAT ALREADY EXIST means the function query isn\u2019t in the file yet or has another name: say so under QUESTIONS instead of rewriting it.' : ''));
    L.push('- Find the cause before changing anything. Common ones: "The column \u2026 of the table wasn\u2019t found" means a name differs in spelling, spaces or case from the columns above; "We couldn\u2019t convert to Number/Date" or DataFormat.Error means a column is typed as a number or date but holds text or blanks; "The name \u2026 wasn\u2019t recognized" means a misspelled function or step name; "Token Comma expected", "Token Eof expected" or "Token \u2026 expected" mean a missing comma, bracket or quote near that place; "We cannot apply field access to the type \u2026" means [Column] was used where the value is not a row (use _); a column name in a list written with square brackets, such as {"[First Name]"}, names a column that doesn\u2019t exist: write {"First Name"}.');
    L.push('- Use each correctly for where it is evaluated: in Table.TransformColumns the current value is _; in Table.AddColumn and Table.SelectRows refer to columns by name, for example each [Column].');
    L.push('- If the error doesn\u2019t say enough to find the cause, give your best fix and say under QUESTIONS what you need to know.');
    L.push('', 'FINAL VALIDATION', 'Before producing the answer, silently validate the final M query:');
    VALIDATION.concat(fx.known.length ? [FN_CHECK] : [], ['Only the steps the fix needs were changed; every other step is exactly as it was.']).forEach(x => L.push('- ' + x));
    L.push('If any check fails, correct the query before replying. Do not report an unvalidated query.');
    L.push('', 'REPLY FORMAT (a template: replace the placeholder lines with your answer)');
    L.push('Reply with these blocks only, nothing before or after them:');
    L.push('@@@ QUERY @@@', 'let', '    ...', 'in', '    LastStep', '@@@ END @@@');
    L.push('@@@ CHANGES @@@', 'StepName: what you changed and why', '(one line per changed step)', '@@@ END @@@');
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
      : b.kind === 'QUESTIONS' ? /^\s*Anything you had to assume, or need to know to finish the query\. Leave empty if none\.\s*$/.test(b.body)
      : b.kind === 'CHANGES' ? /StepName: what you changed and why/.test(b.body) : false;
    const all = blocks(t), bs = all.filter(b => !example(b)).reverse();
    const qb = bs.find(b => b.kind === 'QUERY' || b.kind === 'CODE');
    let code = qb ? qb.body.replace(/^[ \t]*```[\w-]*[ \t]*$/gm, '').replace(/^\s*\n|\s+$/g, '') : '';
    if (!code) { const m = t.match(/```(?:m|powerquery|pq)?\s*\n([\s\S]*?\blet\b[\s\S]*?)```/i); if (m) code = m[1].trim(); else if (/^\s*let\b[\s\S]*\bin\b/.test(t)) code = t.trim(); }
    const lines = b => (b ? b.body.replace(/^[ \t]*```[\w-]*[ \t]*$/gm, '').split('\n').map(s => s.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean) : []);
    const steps = lines(bs.find(b => b.kind === 'STEPS')).map(l => { const m = l.match(/^#?"?([^":]+?)"?\s*:\s*(.+)$/); return m ? { name: m[1].trim(), text: m[2].trim() } : null; }).filter(Boolean);
    const params = lines(bs.find(b => b.kind === 'PARAMETERS')).filter(l => !/^name\s*\|/i.test(l) && /\|/.test(l)).map(l => { const c = l.split('|').map(s => s.trim()); return { name: c[0].replace(/^#"(.*)"$/, '$1'), type: c[1] || 'Text', value: c.slice(2).join('|') }; }).filter(p => p.name && !/^\(/.test(p.name));
    const questions = lines(bs.find(b => b.kind === 'QUESTIONS')).filter(l => !/^\(?leave empty|^none\.?$|^n\/a$/i.test(l));
    // a fix reply lists what it changed
    const changes = lines(bs.find(b => b.kind === 'CHANGES')).filter(l => !/^none\.?$|^n\/a$/i.test(l));
    // only the prompt's format example, no answer: the prompt was pasted back, or Copilot stopped before answering
    if (!code && all.some(example))
      return { code: '', steps: [], params: [], questions: [], error: 'This has only the prompt’s format example, not a query from Copilot. If you pasted the prompt, send it to Copilot and paste its answer here. If Copilot repeated the format without answering, ask it to fill in the blocks.' };
    return { code, steps, params, questions, changes, error: code ? null : 'No @@@ QUERY @@@ block was found. Paste Copilot’s whole reply, or ask it to answer in the format the prompt gives.' };
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
    // (the Explainer's note on Table.RemoveColumns is replaced by the MissingField.Ignore check below)
    healthChecks(q).forEach(c => { if (/default name|Removes columns by name/.test(c.title)) return; add(c.level === 'warn' ? 'warn' : 'info', c.title, c.detail, c.step); });
    // deeper checks: made-up functions, argument counts, each context, step order, library names, the type map
    if (typeof PWL !== 'undefined') PWL.lint(code, q, inp, parseColumns(inp.columns)).forEach(c => add(c.level, c.title, c.detail, c.step));
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
    if (!out.some(c => c.level === 'err' || c.level === 'warn')) add('ok', 'Reads correctly', q.steps.length + ' steps; brackets and quotes balance, every function and step reference exists, each is used in the right context, and the query returns its last step.');
    return { q, list: out };
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  return { SOURCES, DB, typeMap, fxInfo, fixPrompt, parseColumns, parseParams, parseMerges, prompt, parseReply, checks, columnUse };
})();
