/* ---------- Model Documenter core: a JavaScript port of Local TMDL Documenter (Python) ----------
   Mirrors parser.py, partition_support.py, dax_checks.py, diagram_v21.py, v25_sections.py,
   v26_lineage.py, v27_validation.py, report_pages.py and documentation.py.
   Files are passed in as a Map of 'folder/sub/file.tmdl' -> text, so the parser is synchronous. */
var MD = (function () {
  'use strict';

  /* ---------- small helpers that match Python behaviour ---------- */
  const cf = s => String(s == null ? '' : s).toLowerCase();                 // str.casefold()
  const esc = v => String(v == null || v === false ? '' : v)                  // html.escape(quote=True)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  const splitlines = t => { const a = String(t).split(/\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/); if (a.length && a[a.length - 1] === '' ) a.pop(); return a; };
  const indentOf = line => line.length - line.replace(/^\s+/, '').length;
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const cmpTuple = (a, b) => { for (let i = 0; i < Math.min(a.length, b.length); i++) { const c = typeof a[i] === 'number' ? a[i] - b[i] : cmp(a[i], b[i]); if (c) return c; } return a.length - b.length; };
  const sortBy = (arr, key) => arr.slice().sort((x, y) => { const a = key(x), b = key(y); return Array.isArray(a) ? cmpTuple(a, b) : (typeof a === 'number' ? a - b : cmp(a, b)); });
  const sortCf = arr => sortBy(arr, s => cf(s));
  const stripChars = (s, ch) => { let a = 0, b = s.length; while (a < b && ch.includes(s[a])) a++; while (b > a && ch.includes(s[b - 1])) b--; return s.slice(a, b); };
  const W = '[\\p{L}\\p{N}_]';                                               // Python's unicode \w
  function fmtG(n) {                                                           // format(n, 'g')
    if (!isFinite(n)) return String(n);
    if (n === 0) return '0';
    const exp = Math.floor(Math.log10(Math.abs(n)));
    if (exp < -4 || exp >= 6) { let s = n.toExponential(5).replace(/\.?0+e/, 'e'); return s.replace(/e([+-])(\d)$/, 'e$10$2'); }
    return String(parseFloat(n.toPrecision(6)));
  }
  function dedent(text) {                                                      // textwrap.dedent
    const lines = text.split('\n').map(l => (/^[ \t]+$/.test(l) ? '' : l));
    let margin = null;
    for (const l of lines) {
      const m = /^([ \t]*)[^ \t]/.exec(l); if (!m) continue;
      const ind = m[1];
      if (margin === null) margin = ind;
      else if (ind.startsWith(margin)) { /* keep */ }
      else if (margin.startsWith(ind)) margin = ind;
      else { let i = 0; while (i < margin.length && i < ind.length && margin[i] === ind[i]) i++; margin = margin.slice(0, i); }
    }
    return margin ? lines.map(l => (l.startsWith(margin) ? l.slice(margin.length) : l)).join('\n') : lines.join('\n');
  }

  /* ---------- domain ---------- */
  const Table = (name, o = {}) => Object.assign({ name, columns: [], measures: [], partitions: [], description: '', is_hidden: false }, o);
  const newProject = (o = {}) => Object.assign({ name: 'Model', compatibility_level: '', culture: '', tables: new Map(), relationships: [], expressions: [], pages: [], warnings: [], source: 'folder' }, o);
  const setdefault = (map, k, v) => { if (!map.has(k)) map.set(k, v); return map.get(k); };

  /* ---------- dax_checks.py ---------- */
  class DaxSyntaxError extends Error {}
  const KEYWORDS = new Set(['return', 'var', 'in', 'not', 'and', 'or', 'true', 'false', 'asc', 'desc', 'define', 'evaluate', 'measure', 'order', 'by', 'column', 'table']);
  const CLOSERS = { ')': '(', '}': '{' };
  const VAR_NAME = /\bVAR\s+([A-Za-z_][\p{L}\p{N}_]*)/giu;
  function tokenize(expression) {
    const tokens = []; let index = 0; const length = expression.length;
    const scanQuoted = (quote, closer, label) => {
      let end = index + 1;
      while (end < length) {
        if (expression[end] === closer) { if (end + 1 < length && expression[end + 1] === closer) { end += 2; continue; } return end; }
        end++;
      }
      throw new DaxSyntaxError('Unterminated ' + label + ' starting with ' + quote + expression.slice(index + 1, index + 25));
    };
    while (index < length) {
      const ch = expression[index], pair = expression.slice(index, index + 2);
      if (/\s/.test(ch)) index++;
      else if (pair === '//' || pair === '--') { const e = expression.indexOf('\n', index); index = e === -1 ? length : e; }
      else if (pair === '/*') { const e = expression.indexOf('*/', index + 2); if (e === -1) throw new DaxSyntaxError('Unterminated /* comment.'); index = e + 2; }
      else if (ch === '"') { const e = scanQuoted('"', '"', 'string literal'); tokens.push({ kind: 'string', text: expression.slice(index + 1, e).replace(/""/g, '"'), start: index, end: e + 1 }); index = e + 1; }
      else if (ch === "'") { const e = scanQuoted("'", "'", 'quoted table name'); tokens.push({ kind: 'table', text: expression.slice(index + 1, e).replace(/''/g, "'"), start: index, end: e + 1 }); index = e + 1; }
      else if (ch === '[') { const e = scanQuoted('[', ']', 'bracket reference'); tokens.push({ kind: 'bracket', text: expression.slice(index + 1, e).replace(/\]\]/g, ']'), start: index, end: e + 1 }); index = e + 1; }
      else if (/\p{L}/u.test(ch) || ch === '_') { let e = index + 1; while (e < length && /[A-Za-z0-9_.]/.test(expression[e])) e++; tokens.push({ kind: 'ident', text: expression.slice(index, e), start: index, end: e }); index = e; }
      else { tokens.push({ kind: 'punct', text: ch, start: index, end: index + 1 }); index++; }
    }
    return tokens;
  }
  function nestingError(tokens) {
    const stack = [];
    for (const t of tokens) {
      if (t.kind !== 'punct') continue;
      if (t.text === '(' || t.text === '{') stack.push(t.text);
      else if (CLOSERS[t.text]) {
        if (!stack.length || stack[stack.length - 1] !== CLOSERS[t.text]) return "Unexpected '" + t.text + "' with no matching '" + CLOSERS[t.text] + "'.";
        stack.pop();
      }
    }
    return stack.length ? stack.length + " unclosed '" + stack[stack.length - 1] + "'." : null;
  }
  function qualifier(tokens, position, variables) {
    const prev = position ? tokens[position - 1] : null;
    if (prev && prev.kind === 'table') return prev.text;
    if (prev && prev.kind === 'ident' && prev.end === tokens[position].start && !KEYWORDS.has(cf(prev.text)) && !variables.has(cf(prev.text))) return prev.text;
    return null;
  }
  const varNames = expr => new Set([...String(expr).matchAll(VAR_NAME)].map(m => cf(m[1])));
  function measureReferences(expression) {
    let tokens;
    try { tokens = tokenize(expression || ''); } catch (e) { if (e instanceof DaxSyntaxError) return [[], []]; throw e; }
    const local = new Set(tokens.filter(t => t.kind === 'string').map(t => cf(t.text)));
    const variables = varNames(expression || '');
    const q = new Set(), u = new Set();
    tokens.forEach((t, i) => {
      if (t.kind !== 'bracket') return;
      const prev = i ? tokens[i - 1] : null;
      if (prev && prev.kind === 'punct' && prev.text === '.') return;
      const qual = qualifier(tokens, i, variables); const name = t.text.trim();
      if (qual !== null) q.add(qual + '[' + name + ']');
      else if (!local.has(cf(name)) && !/^value\d*$/.test(cf(name))) u.add(name);
    });
    return [sortCf([...q]), sortCf([...u])];
  }
  function checkMeasure(measureName, expression, modelTables) {
    if (!(expression || '').trim()) return ['Measure has no DAX expression.'];
    let tokens;
    try { tokens = tokenize(expression); } catch (e) { if (e instanceof DaxSyntaxError) return ['DAX syntax error: ' + e.message]; throw e; }
    if (!tokens.length) return ['Measure has no DAX expression (only comments).'];
    const errors = [];
    const nesting = nestingError(tokens); if (nesting) errors.push('DAX syntax error: ' + nesting);
    const tables = new Map(modelTables.map(t => [cf(t.name), t]));
    const fieldsBy = new Map([...tables].map(([k, t]) => [k, new Set([...t.columns, ...t.measures].map(i => cf(i.name)))]));
    const allMeasures = new Set(modelTables.flatMap(t => t.measures.map(m => cf(m.name))));
    const allColumns = new Set(modelTables.flatMap(t => t.columns.map(c => cf(c.name))));
    const local = new Set(tokens.filter(t => t.kind === 'string').map(t => cf(t.text)));
    const variables = varNames(expression);
    const uT = [], uF = [], uR = [];
    tokens.forEach((t, i) => {
      if (t.kind !== 'bracket') return;
      const prev = i ? tokens[i - 1] : null; const name = t.text.trim(); const key = cf(name);
      if (prev && prev.kind === 'punct' && prev.text === '.') return;
      const qual = qualifier(tokens, i, variables);
      if (qual !== null) {
        const tk = cf(qual);
        if (!tables.has(tk)) uT.push(qual);
        else if (!fieldsBy.get(tk).has(key)) uF.push("'" + qual + "'[" + name + ']');
        return;
      }
      if (key === cf(measureName)) errors.push('Measure references itself.');
      else if (!allMeasures.has(key) && !allColumns.has(key) && !local.has(key) && !/^value\d*$/.test(key)) uR.push('[' + name + ']');
    });
    const uniq = a => [...new Set(a)].sort(cmp);
    if (uT.length) errors.push('References table(s) not in the model: ' + uniq(uT).join(', ') + '.');
    if (uF.length) errors.push('References column(s)/measure(s) that do not exist: ' + uniq(uF).join(', ') + '.');
    if (uR.length) errors.push('References unknown measure(s)/column(s): ' + uniq(uR).join(', ') + '.');
    return errors;
  }

  /* ---------- partition_support.py ---------- */
  const UNDETECTED = 'Other / not detected';
  const cleanName = v => { v = v.trim(); return v.length > 1 && v[0] === "'" && v[v.length - 1] === "'" ? v.slice(1, -1).replace(/''/g, "'") : v; };
  function parsePartitionBlocks(text) {
    const lines = splitlines(text); const out = [];
    const partitionRe = /^(\s*)partition\s+(.+?)(?:\s*=\s*(\S+))?\s*$/i;
    const declRe = /^(\s*)(table|column|measure|hierarchy|partition|relationship|expression|role|perspective)\b/i;
    const propRe = /^\s*([A-Za-z][A-Za-z0-9]*)\s*:\s*(.*?)\s*$/;
    const sourceRe = /^\s*source\s*(?:=\s*(.*?))?\s*$/i;
    let index = 0;
    while (index < lines.length) {
      const header = partitionRe.exec(lines[index]);
      if (!header) { index++; continue; }
      const startIndex = index, baseIndent = header[1].length; index++;
      const block = [lines[startIndex]];
      while (index < lines.length) { const c = declRe.exec(lines[index]); if (c && c[1].length <= baseIndent) break; block.push(lines[index]); index++; }
      const props = {}; let sourceStart = null, firstSource = '';
      for (let r = 1; r < block.length; r++) {
        const sm = sourceRe.exec(block[r]);
        if (sm) { sourceStart = r; firstSource = (sm[1] || '').trim(); break; }
        const pm = propRe.exec(block[r]); if (pm) props[cf(pm[1])] = pm[2].trim();
      }
      let expression = ''; const sourceProps = {};
      if (sourceStart !== null) {
        const sourceIndent = indentOf(block[sourceStart]); const sl = [];
        if (firstSource.startsWith('```')) {
          const rem = firstSource.slice(3);
          if (rem.replace(/\s+$/, '').endsWith('```')) sl.push(rem.replace(/\s+$/, '').slice(0, -3));
          else {
            if (rem.trim()) sl.push(rem);
            for (const line of block.slice(sourceStart + 1)) { if (line.trim().endsWith('```')) { sl.push(line.replace(/\s+$/, '').slice(0, -3)); break; } sl.push(line); }
          }
        } else {
          if (firstSource) sl.push(firstSource);
          for (const line of block.slice(sourceStart + 1)) { if (line.trim() && indentOf(line) <= sourceIndent) break; sl.push(line); }
        }
        expression = dedent(sl.join('\n')).trim();
        if (!firstSource) for (const line of sl) { const pm = propRe.exec(line); if (pm) sourceProps[cf(pm[1])] = pm[2].trim(); }
      }
      out.push({ name: cleanName(header[2]), source_type: (header[3] || '').trim(), mode: props.mode || '', expression, source_properties: sourceProps, line_number: startIndex + 1 });
    }
    return out;
  }
  const M_CONNECTORS = [
    [/\bQuick_?Base\w*(?:\.\w+)?\s*\(|quickbase\.com/i, 'Quickbase'],
    [/\bSql\.Databases?\s*\(/i, 'SQL Server'], [/\bOracle\.Database\s*\(/i, 'Oracle'],
    [/\bPostgreSQL\.Database\s*\(/i, 'PostgreSQL'], [/\bMySQL\.Database\s*\(/i, 'MySQL'],
    [/\bSnowflake\.Databases\s*\(/i, 'Snowflake'], [/\b(?:Databricks|DatabricksMultiCloud)\.\w+\s*\(/i, 'Databricks'],
    [/\bGoogleBigQuery\.Database\s*\(/i, 'Google BigQuery'], [/\bAmazonRedshift\.Database\s*\(/i, 'Amazon Redshift'],
    [/\bTeradata\.Database\s*\(/i, 'Teradata'], [/\bSapHana\.Database\s*\(/i, 'SAP HANA'],
    [/\bSapBusinessWarehouse\.\w+\s*\(/i, 'SAP BW'], [/\bDB2\.Database\s*\(/i, 'IBM Db2'],
    [/\bSybase\.Database\s*\(/i, 'Sybase'], [/\bAnalysisServices\.Databases?\s*\(/i, 'Analysis Services'],
    [/\b(?:AzureDataExplorer|Kusto)\.\w+\s*\(/i, 'Azure Data Explorer'], [/\bLakehouse\.Contents\s*\(/i, 'Fabric Lakehouse'],
    [/\b(?:Fabric\.Warehouse|Warehouse\.Contents)\s*\(/i, 'Fabric Warehouse'], [/\b(?:PowerPlatform|PowerBI)\.Dataflows\s*\(/i, 'Power Platform Dataflow'],
    [/\b(?:CommonDataService\.Database|Cds\.Entities|Dataverse\.Contents)\s*\(/i, 'Dataverse'], [/\bSalesforce\.(?:Data|Reports)\s*\(/i, 'Salesforce'],
    [/\bOdbc\.(?:DataSource|Query)\s*\(/i, 'ODBC'], [/\bOleDb\.(?:DataSource|Query)\s*\(/i, 'OLE DB'],
    [/\bExchange\.Contents\s*\(/i, 'Exchange'], [/\bActiveDirectory\.Domains\s*\(/i, 'Active Directory'],
    [/\bSharePoint\.(?:Files|Contents|Tables)\s*\(/i, 'SharePoint'], [/\bAzureStorage\.\w+\s*\(/i, 'Azure Storage'],
    [/\bFolder\.(?:Files|Contents)\s*\(/i, 'Folder'], [/\bExcel\.(?:Workbook|CurrentWorkbook)\s*\(/i, 'Excel Workbook'],
    [/\bCsv\.Document\s*\(/i, 'CSV'], [/\bParquet\.Document\s*\(/i, 'Parquet'], [/\bAccess\.Database\s*\(/i, 'Access Database'],
    [/\bPdf\.Tables\s*\(/i, 'PDF'], [/\bOData\.Feed\s*\(/i, 'OData'], [/\bWeb\.(?:Contents|Page|BrowserContents)\s*\(/i, 'Web'],
    [/\bJson\.Document\s*\(/i, 'JSON'], [/\bXml\.(?:Tables|Document)\s*\(/i, 'XML'], [/\bFile\.Contents\s*\(/i, 'File']
  ];
  const ENTERED_DATA = /\bBinary\.Decompress\s*\(\s*Binary\.FromText\s*\(/i;
  const GENERATED_M = /#table\s*\(|\bTable\.From(?:Rows|Records|List|Columns)\s*\(|\bList\.(?:Dates|Numbers|Generate)\s*\(/i;
  const PARAMETER_QUERY = /\bIsParameterQuery\s*=\s*true/i;
  const M_STEP = /^\s*,?\s*(#"(?:[^"]|"")+"|[A-Za-z_][\p{L}\p{N}_.]*)\s*=(?!=)/gmu;
  const M_TOKEN = /#"((?:[^"]|"")+)"|"(?:[^"]|"")*"|(?<![\p{L}\p{N}_.])([A-Za-z_][\p{L}\p{N}_]*(?:\.[A-Za-z_][\p{L}\p{N}_]*)*)/gu;
  function stripComments(text, dax) {
    const out = []; let i = 0; const n = text.length;
    while (i < n) {
      const ch = text[i], pair = text.slice(i, i + 2);
      if (ch === '"') { let e = i + 1; while (e < n) { if (text[e] === '"') { if (e + 1 < n && text[e + 1] === '"') { e += 2; continue; } break; } e++; } out.push(text.slice(i, e + 1)); i = e + 1; }
      else if (pair === '//' || (dax && pair === '--')) { const e = text.indexOf('\n', i); i = e === -1 ? n : e; }
      else if (pair === '/*') { const e = text.indexOf('*/', i + 2); i = e === -1 ? n : e + 2; }
      else { out.push(ch); i++; }
    }
    return out.join('');
  }
  const withoutStrings = t => t.replace(/"(?:[^"]|"")*"/g, '""');
  function classifyDax(expression) {
    const code = withoutStrings(stripComments(expression, true));
    if (/\bNAMEOF\s*\(/i.test(code)) return 'Field Parameter (DAX)';
    if (/\bCALENDAR(?:AUTO)?\s*\(/i.test(code)) return 'Date Table (DAX)';
    if (/\bGENERATESERIES\s*\(/i.test(code)) return 'Parameter Series (DAX)';
    if (/^\s*(?:\{|DATATABLE\s*\(|ROW\s*\()/i.test(code)) return 'Static Data (DAX)';
    if (!code.trim()) return 'Empty Calculated Table';
    return 'Calculated Table (DAX)';
  }
  function callArguments(code, m) {
    if (!m[0].replace(/\s+$/, '').endsWith('(')) {
      const s = code.lastIndexOf('"', m.index - 1), e = code.indexOf('"', m.index + m[0].length);
      return s !== -1 && e !== -1 && m.index > 0 ? [code.slice(s + 1, e)] : [];
    }
    const lits = []; let depth = 1, i = m.index + m[0].length;
    while (i < code.length && depth && lits.length < 2) {
      const ch = code[i];
      if (ch === '"') {
        let e = i + 1;
        while (e < code.length && !(code[e] === '"' && code.slice(e + 1, e + 2) !== '"')) e += code.slice(e, e + 2) === '""' ? 2 : 1;
        lits.push(code.slice(i + 1, e).replace(/""/g, '"')); i = e + 1; continue;
      }
      depth += ch === '(' ? 1 : ch === ')' ? -1 : 0; i++;
    }
    return lits;
  }
  const unquoteIdent = t => (t.startsWith('#"') ? t.slice(2, -1).replace(/""/g, '"') : t);
  function classifyM(expression, queries, selfName, visited) {
    const code = stripComments(expression, false);
    if (ENTERED_DATA.test(code)) return ['Entered Data (Power Query)', []];
    for (const [re, label] of M_CONNECTORS) { const m = re.exec(code); if (m) return [label, callArguments(code, m)]; }
    const steps = new Set([...code.matchAll(M_STEP)].map(m => unquoteIdent(m[1])));
    const referenced = [];
    for (const m of code.matchAll(M_TOKEN)) {
      const quoted = m[1], bare = m[2];
      const name = quoted ? quoted.replace(/""/g, '"') : bare;
      if (name && queries.has(name) && !steps.has(name) && !referenced.includes(name)) referenced.push(name);
    }
    const kinds = new Set(); let args = [];
    for (const name of referenced) {
      if (visited.has(name)) continue;
      const target = queries.get(name);
      if (PARAMETER_QUERY.test(target)) continue;
      const [kind, targs] = classifyM(target, queries, name, new Set([...visited, name]));
      if (kind !== UNDETECTED) { kinds.add(kind); args = args.length ? args : targs; }
    }
    if (kinds.size) {
      const specific = [...kinds].filter(k => k !== 'Generated in Power Query');
      return [(specific.length ? specific : [...kinds]).sort(cmp).join(' + '), args];
    }
    if (GENERATED_M.test(code) || /#date\s*\(/i.test(code)) return ['Generated in Power Query', []];
    return [UNDETECTED, []];
  }
  function detectSource(expression, sourceType, queries, selfName, mode) {
    const kind = cf((sourceType || '').trim());
    if (kind === 'calculated') return [classifyDax(expression || ''), []];
    if (kind === 'entity' || cf(mode || '') === 'directlake') return ['Direct Lake', []];
    if (kind === 'calculationgroup') return ['Calculation Group', []];
    if (kind === 'query') return ['Legacy Provider Query', []];
    if (!(expression || '').trim()) return [UNDETECTED, []];
    return classifyM(expression, queries || new Map(), selfName || '', new Set([selfName || '']));
  }

  /* ---------- parser.py ---------- */
  const ID = "(?:'(?:''|[^'])*'|[^.\\s]+)";
  const ENDPOINT = new RegExp('^\\s*(fromColumn|toColumn)\\s*:\\s*(' + ID + ')\\.(' + ID + ')\\s*$', 'i');
  const DECL = /^(\s*)(table|column|measure|relationship|expression)\s+(.+?)(?:\s*=\s*(.*))?$/i;
  const PROP = /^\s*([A-Za-z][A-Za-z0-9]*)\s*:\s*(.*?)\s*$/;
  const FLAG = /^\s*([A-Za-z][A-Za-z0-9]*)\s*$/;
  const clean = cleanName;
  function* blocks(text) {
    const lines = splitlines(text); let index = 0;
    while (index < lines.length) {
      const m = DECL.exec(lines[index]);
      if (!m) { index++; continue; }
      const indent = m[1].length, start = index; index++;
      while (index < lines.length) { const c = DECL.exec(lines[index]); if (c && c[1].length <= indent) break; index++; }
      yield [start + 1, lines.slice(start, index), m];
    }
  }
  function properties(block) {
    const lines = block.slice(1).filter(l => l.trim() && !l.trim().startsWith('///'));
    if (!lines.length) return {};
    const child = Math.min(...lines.map(indentOf)); const out = {};
    for (const l of lines) {
      if (indentOf(l) !== child) continue;
      const m = PROP.exec(l);
      if (m) out[cf(m[1])] = m[2].trim();
      else { const f = FLAG.exec(l); if (f) out[cf(f[1])] = 'true'; }
    }
    return out;
  }
  function docComment(lines, index) {
    const c = []; index--;
    while (index >= 0 && lines[index].trim().startsWith('///')) { c.unshift(lines[index].trim().slice(3).trim()); index--; }
    return c.join(' ').trim();
  }
  function expressionBody(block, header) {
    const first = header[4] || ''; const body = first ? [first] : []; const base = header[1].length;
    for (const line of block.slice(1)) {
      const ind = indentOf(line);
      if (line.trim() && ((PROP.test(line) && ind <= base + 2) || (FLAG.test(line) && ind <= base + 1))) break;
      if (line.trim().startsWith('///') && ind <= base) break;
      body.push(line.length >= base + 2 ? line.slice(base + 2) : line);
    }
    return stripChars(body.join('\n').trim(), '`');
  }
  let FIXES = true;
  const truthy = v => cf(v || 'false') === 'true';

  /* Virtual folder: Map path -> text; paths use '/' */
  function vfs(files) {
    const paths = [...files.keys()];
    const isDir = p => paths.some(f => f.startsWith(p + '/'));
    const exists = p => files.has(p) || isDir(p);
    const under = p => paths.filter(f => f.startsWith(p + '/'));
    const children = p => { const s = new Set(); for (const f of under(p)) s.add(p + '/' + f.slice(p.length + 1).split('/')[0]); return [...s].sort(cmp); };
    const allDirs = p => { const s = new Set(); for (const f of under(p)) { const parts = f.slice(p.length + 1).split('/'); for (let i = 1; i < parts.length; i++) s.add(p + '/' + parts.slice(0, i).join('/')); } return [...s].sort(cmp); };
    const base = p => p.split('/').pop();
    const parent = p => p.split('/').slice(0, -1).join('/');
    const join = (a, b) => { const out = a ? a.split('/') : []; for (const seg of b.replace(/\\/g, '/').split('/')) { if (!seg || seg === '.') continue; if (seg === '..') out.pop(); else out.push(seg); } return out.join('/'); };
    return { files, paths, isDir, exists, under, children, allDirs, base, parent, join, read: p => { if (!files.has(p)) throw new ProjectError('Cannot read ' + p); return files.get(p); } };
  }
  class ProjectError extends Error {}
  const anyTmdl = (fs, p) => fs.under(p).some(f => f.toLowerCase().endsWith('.tmdl'));

  function discover(fs, selected) {
    const name = fs.base(selected);
    let cands = name === 'definition' && anyTmdl(fs, selected) ? [selected] : [];
    const direct = fs.children(selected).filter(d => d.endsWith('.SemanticModel') && fs.isDir(d + '/definition')).map(d => d + '/definition');
    const deep = fs.allDirs(selected).filter(d => fs.base(d) === 'definition' && fs.parent(d).endsWith('.SemanticModel'));
    cands = cands.concat(direct, deep);
    if (name.endsWith('.SemanticModel') && fs.isDir(selected + '/definition')) cands.unshift(selected + '/definition');
    let semantic = cands.find(p => fs.isDir(p) && anyTmdl(fs, p)) || null;
    if (!semantic && anyTmdl(fs, selected)) semantic = selected;
    if (!semantic) throw new ProjectError('No semantic model (TMDL) was found in this folder. Choose the PBIP project folder or its .SemanticModel folder, and check the project is saved in the TMDL format.');
    const searchRoot = name.endsWith('definition') ? null : selected;
    let report = null;
    if (searchRoot) {
      const rd = fs.children(searchRoot).filter(d => d.endsWith('.Report') && fs.isDir(d + '/definition')).map(d => d + '/definition')
        .concat(fs.allDirs(searchRoot).filter(d => fs.base(d) === 'definition' && fs.parent(d).endsWith('.Report')));
      report = rd.find(p => fs.isDir(p)) || null;
    }
    return [semantic, report];
  }
  function discoverFromPbip(fs, pbipPath) {
    const pbip = JSON.parse(fs.read(pbipPath));
    let reportRoot = null;
    for (const a of pbip.artifacts || []) { if (a && a.report) { if (a.report.path) { reportRoot = fs.join(fs.parent(pbipPath), a.report.path); break; } } }
    if (reportRoot === null) throw new ProjectError('No report reference found in PBIP.');
    if (!fs.exists(reportRoot)) throw new ProjectError('Report path not found:\n' + reportRoot);
    let def = reportRoot + '/definition.pbir';
    if (!fs.files.has(def)) def = reportRoot + '/definition/definition.pbir';
    if (!fs.files.has(def)) throw new ProjectError('Cannot locate PBIR:\n' + reportRoot);
    const pbir = JSON.parse(fs.read(def));
    const rel = ((pbir.datasetReference || {}).byPath || {}).path;
    if (!rel) throw new ProjectError('This report connects to a published semantic model, so the model isn’t in the project. Choose the model’s own .SemanticModel folder, or use the saved model export.');
    const semanticRoot = fs.join(fs.parent(def), rel);
    if (!fs.exists(semanticRoot)) throw new ProjectError('Semantic model not found:\n' + semanticRoot);
    const semDef = semanticRoot + '/definition';
    if (!fs.exists(semDef)) throw new ProjectError('Semantic definition not found:\n' + semDef);
    return [semDef, reportRoot];
  }
  const NON_DEF = new Set(['cultures', 'perspectives', 'roles']);
  function modelFiles(fs, project) {
    const root = project.semantic_root;
    return fs.under(root).filter(f => f.toLowerCase().endsWith('.tmdl')).filter(f => {
      const parts = f.slice(root.length + 1).split('/').slice(0, -1).map(cf);
      return !parts.some(p => NON_DEF.has(p));
    }).sort((a, b) => cmp(cf(a), cf(b)));
  }
  function parseTmdl(fs, project) {
    const files = modelFiles(fs, project);
    if (!files.length) throw new ProjectError('No TMDL files found.');
    for (const path of files) {
      const text = fs.read(path), tl = splitlines(text);
      for (const [ln, block, m] of blocks(text)) {
        const kind = cf(m[2]), name = clean(m[3]), props = properties(block);
        if (kind === 'table') setdefault(project.tables, name, Table(name, { description: docComment(tl, ln - 1) || props.description || '', is_hidden: truthy(props.ishidden) }));
        else if (kind === 'relationship') {
          const ends = {};
          for (const line of block.slice(1)) { const e = ENDPOINT.exec(line); if (e) ends[cf(e[1])] = [clean(e[2]), clean(e[3])]; }
          if (!ends.fromcolumn || !ends.tocolumn) { project.warnings.push(fs.base(path) + ':' + ln + ': relationship ' + name + ' missing endpoint'); continue; }
          project.relationships.push({ name, from_table: ends.fromcolumn[0], from_column: ends.fromcolumn[1], to_table: ends.tocolumn[0], to_column: ends.tocolumn[1],
            from_cardinality: props.fromcardinality || 'many', to_cardinality: props.tocardinality || 'one', cross_filtering: props.crossfilteringbehavior || 'oneDirection', is_active: cf(props.isactive || 'true') !== 'false' });
        } else if (kind === 'expression') project.expressions.push({ name, expression: expressionBody(block, m) });
      }
    }
    for (const path of files) {
      const lines = splitlines(fs.read(path)); let cur = null, tIndent = -1, index = 0;
      while (index < lines.length) {
        const m = DECL.exec(lines[index]);
        if (!m) { index++; continue; }
        const indent = m[1].length, kind = cf(m[2]), name = clean(m[3]);
        if (kind === 'table') { cur = setdefault(project.tables, name, Table(name)); tIndent = indent; index++; continue; }
        if (cur && indent > tIndent && (kind === 'column' || kind === 'measure')) {
          const start = index; index++;
          // Fix: the object also ends at any sibling line (partition, hierarchy, annotation...), not only at the
          // next column/measure. The Python original let the last column or measure run into the partition.
          while (index < lines.length) { const n = DECL.exec(lines[index]), l = lines[index]; if (n && n[1].length <= indent) break; if (FIXES && l.trim() && !l.trim().startsWith('///') && indentOf(l) <= indent) break; index++; }
          const block = lines.slice(start, index), props = properties(block);
          const description = docComment(lines, start) || props.description || '';
          if (kind === 'column') cur.columns.push({ name, data_type: props.datatype || '', format_string: props.formatstring || '', description, summarize_by: props.summarizeby || '', sort_by: props.sortbycolumn || '', source_column: props.sourcecolumn || '', is_hidden: truthy(props.ishidden), is_key: truthy(props.iskey) });
          else {
            const dax = expressionBody(block, m); const [colRefs, br] = measureReferences(dax);
            cur.measures.push({ name, expression: dax, format_string: props.formatstring || '', display_folder: props.displayfolder || '', description, is_hidden: truthy(props.ishidden), column_refs: colRefs, measure_refs: br.filter(r => cf(r) !== cf(name)) });
          }
          continue;
        }
        index++;
      }
    }
    const modelFile = project.semantic_root + '/model.tmdl';
    if (fs.files.has(modelFile)) {
      const t = fs.read(modelFile);
      const lv = /compatibilityLevel\s*:\s*(\d+)/i.exec(t), cu = /culture\s*:\s*([^\s]+)/i.exec(t);
      project.compatibility_level = lv ? lv[1] : ''; project.culture = cu ? cu[1] : '';
    }
  }
  function sourceEntity(expression, aliases) {
    if (!expression || typeof expression !== 'object' || Array.isArray(expression)) return '';
    const s = expression.SourceRef;
    if (!s || typeof s !== 'object' || Array.isArray(s)) return '';
    return s.Entity || aliases[s.Source || ''] || '';
  }
  const isObj = n => n && typeof n === 'object' && !Array.isArray(n);
  function parseVisualFields(data) {
    const aliases = {};
    const collect = node => {
      if (isObj(node)) { for (const it of Array.isArray(node.From) ? node.From : []) if (isObj(it) && it.Name && it.Entity) aliases[it.Name] = it.Entity; Object.values(node).forEach(collect); }
      else if (Array.isArray(node)) node.forEach(collect);
    };
    collect(data);
    const refs = new Set();
    const walk = node => {
      if (isObj(node)) {
        const ex = node.Expression;
        if ('Property' in node) { const e = sourceEntity(ex, aliases); if (e) refs.add(e + '[' + node.Property + ']'); }
        if ('Level' in node && isObj(ex) && isObj(ex.Hierarchy)) { const h = ex.Hierarchy; const e = sourceEntity(h.Expression, aliases); if (e) refs.add(e + '[' + (h.Hierarchy || '') + '].[' + node.Level + ']'); }
        Object.values(node).forEach(walk);
      } else if (Array.isArray(node)) node.forEach(walk);
    };
    walk(data);
    return [...refs].sort(cmp);
  }
  function visualTitle(visual) {
    const items = (((visual.visualContainerObjects || {}).title) || []).concat(((visual.objects || {}).title) || []);
    for (const it of items) {
      const v = ((((((it || {}).properties || {}).text || {}).expr || {}).Literal || {}).Value) || '';
      if (v) return stripChars(v, "'");
    }
    return '';
  }
  const num = (v, d) => { const n = parseFloat(v); return (v === undefined || v === null || v === '' || v === 0 || isNaN(n) || n === 0) ? d : n; };
  function parsePbir(fs, project) {
    if (!project.report_root) return;
    let defRoot = project.report_root;
    for (const c of [project.report_root + '/definition', project.report_root]) if (fs.isDir(c + '/pages')) { defRoot = c; break; }
    const pagesRoot = defRoot + '/pages';
    if (!fs.isDir(pagesRoot)) { project.warnings.push('No report pages folder found under ' + project.report_root); return; }
    const pageDirs = new Map(fs.children(pagesRoot).filter(p => fs.files.has(p + '/page.json')).map(p => [fs.base(p), p]));
    let order = [];
    const pj = pagesRoot + '/pages.json';
    if (fs.files.has(pj)) { try { order = (JSON.parse(fs.read(pj)).pageOrder || []).filter(n => pageDirs.has(n)); } catch (e) { project.warnings.push('Invalid JSON ' + pj + ': ' + e.message); } }
    order = order.concat([...pageDirs.keys()].filter(n => !order.includes(n)).sort(cmp));
    for (const pageName of order) {
      const dir = pageDirs.get(pageName), pjson = dir + '/page.json'; let pd;
      try { pd = JSON.parse(fs.read(pjson)); } catch (e) { project.warnings.push('Invalid JSON ' + pjson + ': ' + e.message); continue; }
      const page = { name: fs.base(dir), display_name: pd.displayName !== undefined ? pd.displayName : fs.base(dir), width: num(pd.width, 1280), height: num(pd.height, 720), is_hidden: pd.visibility === 'HiddenInViewMode', visuals: [] };
      const raw = new Map(); const vroot = dir + '/visuals';
      for (const vdir of fs.isDir(vroot) ? fs.children(vroot).filter(fs.isDir) : []) {
        const p = vdir + '/visual.json'; if (!fs.files.has(p)) continue;
        let data; try { data = JSON.parse(fs.read(p)); } catch (e) { project.warnings.push('Invalid JSON ' + p + ': ' + e.message); continue; }
        raw.set(data.name !== undefined ? data.name : fs.base(vdir), data);
      }
      const absolute = (name, seen) => {
        const d = raw.get(name), pos = d.position || {};
        let x = parseFloat(pos.x || 0) || 0, y = parseFloat(pos.y || 0) || 0;
        const par = d.parentGroupName;
        if (raw.has(par) && !seen.includes(par)) { const [px, py] = absolute(par, seen.concat([name])); x += px; y += py; }
        return [x, y];
      };
      for (const [name, data] of raw) {
        const pos = data.position || {}, visual = data.visual || {}, isGroup = 'visualGroup' in data;
        const [x, y] = absolute(name, []);
        page.visuals.push({ page: page.display_name, name, visual_type: isGroup ? 'group' : (visual.visualType !== undefined ? visual.visualType : (data.visualType !== undefined ? data.visualType : 'unknown')),
          x, y, width: parseFloat(pos.width || 0) || 0, height: parseFloat(pos.height || 0) || 0, fields: isGroup ? [] : parseVisualFields(data),
          z: parseFloat(pos.z || 0) || 0, is_hidden: !!data.isHidden, is_group: isGroup, parent_group: data.parentGroupName || '',
          title: isGroup ? ((data.visualGroup || {}).displayName || '') : visualTitle(visual) });
      }
      page.visuals = sortBy(page.visuals, v => v.z);
      project.pages.push(page);
    }
  }
  function parsePartitions(fs, project) {
    for (const path of modelFiles(fs, project)) {
      const text = fs.read(path);
      const names = [...text.matchAll(/^\s*table\s+(.+?)\s*$/gim)].map(m => clean(m[1]));
      if (!names.length) continue;
      const table = project.tables.get(names[0]); if (!table) continue;
      const existing = new Set(table.partitions.map(p => p.name));
      for (const p of parsePartitionBlocks(text)) {
        if (existing.has(p.name)) continue;
        table.partitions.push({ name: p.name, mode: p.mode, source_type: p.source_type, expression: p.expression, source_kind: UNDETECTED, source_file: path, line_number: p.line_number });
        existing.add(p.name);
      }
    }
    const queries = new Map(project.expressions.map(e => [e.name, e.expression]));
    for (const t of project.tables.values()) {
      const mp = t.partitions.filter(p => ['', 'm'].includes(cf(p.source_type)));
      if (mp.length && !queries.has(t.name)) queries.set(t.name, mp[0].expression);
    }
    for (const t of project.tables.values()) for (const p of t.partitions) p.source_kind = detectSource(p.expression, p.source_type, queries, t.name, p.mode)[0];
  }
  function finish(fs, project) { parseTmdl(fs, project); parsePartitions(fs, project); parsePbir(fs, project); return project; }
  function loadProject(files, selected) {
    const fs = vfs(files);
    const [semantic, report] = discover(fs, selected);
    const modelFolder = fs.base(semantic) === 'definition' ? fs.parent(semantic) : semantic;
    return finish(fs, newProject({ semantic_root: semantic, report_root: report, name: fs.base(modelFolder).replace(/\.SemanticModel$/, '') }));
  }
  function loadProjectFromPbip(files, pbipPath) {
    const fs = vfs(files);
    const [semantic, report] = discoverFromPbip(fs, pbipPath);
    return finish(fs, newProject({ semantic_root: semantic, report_root: report, name: fs.base(fs.parent(semantic)).replace(/\.SemanticModel$/, '') }));
  }

  /* Every model the chosen folder holds, with the report that uses it (for the page's project picker) */
  function listProjects(files, selected) {
    const fs = vfs(files), out = [], used = new Set();
    const pbirs = fs.paths.filter(p => /\/definition\.pbir$/i.test(p)).sort(cmp);
    for (const def of pbirs) {
      let pbir; try { pbir = JSON.parse(fs.read(def)); } catch (e) { continue; }
      const reportRoot = /\/definition\/definition\.pbir$/i.test(def) ? fs.parent(fs.parent(def)) : fs.parent(def);
      const rel = ((pbir.datasetReference || {}).byPath || {}).path;
      const reportName = fs.base(reportRoot).replace(/\.Report$/, '');
      if (!rel) { out.push({ id: reportRoot, label: reportName + ' (connects to a published model)', error: 'This report connects to a published semantic model, so the model isn\u2019t in the project. Choose the model\u2019s own .SemanticModel folder, or use the saved model export.' }); continue; }
      const sem = fs.join(fs.parent(def), rel) + '/definition';
      if (!anyTmdl(fs, sem)) { out.push({ id: reportRoot, label: reportName + ' (model not in this folder)', error: 'The model this report uses (' + rel + ') isn\u2019t inside the folder you chose. Choose the folder that holds both the .Report and .SemanticModel folders.' }); continue; }
      const modelName = fs.base(fs.parent(sem)).replace(/\.SemanticModel$/, '');
      used.add(sem);
      out.push({ id: reportRoot, label: reportName === modelName ? modelName : reportName + ' (model: ' + modelName + ')', semantic: sem, report: reportRoot, name: modelName });
    }
    for (const d of fs.allDirs(selected).concat([selected])) {
      if (fs.base(d) !== 'definition' || !fs.parent(d).endsWith('.SemanticModel') || used.has(d) || !anyTmdl(fs, d)) continue;
      const modelName = fs.base(fs.parent(d)).replace(/\.SemanticModel$/, '');
      out.push({ id: d, label: modelName + ' (model only, no report)', semantic: d, report: null, name: modelName });
    }
    if (!out.some(o => o.semantic)) {
      try { const [sem, rep] = discover(fs, selected); const mf = fs.base(sem) === 'definition' ? fs.parent(sem) : sem; out.push({ id: sem, label: fs.base(mf).replace(/\.SemanticModel$/, '') || 'Model', semantic: sem, report: rep, name: fs.base(mf).replace(/\.SemanticModel$/, '') || 'Model' }); } catch (e) { /* nothing usable */ }
    }
    return out;
  }
  function loadModel(files, choice) {
    const fs = vfs(files);
    return finish(fs, newProject({ semantic_root: choice.semantic, report_root: choice.report, name: choice.name }));
  }

  /* ---------- the toolkit's shared model export (INFO.VIEW) ---------- */
  function projectFromExport(text, modelName) {
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    const unq = s => { s = s.trim(); if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') s = s.slice(1, -1).replace(/""/g, '"'); return s; };
    const restore = s => s.split('↵').join('\n');
    let map = null; const project = newProject({ name: modelName || 'Model', source: 'export', semantic_root: '', report_root: null, compatibility_level: 'Not in the export', culture: 'Not in the export' });
    const rows = [];
    for (const l of lines) {
      if (!l.trim()) continue;
      const c = l.split('\t');
      if (!map) {
        const low = c.map(x => unq(x).toLowerCase().replace(/^.*\[|\]$/g, ''));
        if (low.includes('kind') && low.includes('table') && low.includes('name')) { map = {}; low.forEach((k, i) => { map[k] = i; }); }
        continue;
      }
      const g = k => (map[k] === undefined ? '' : restore(unq(c[map[k]] || '')));
      rows.push({ kind: g('kind').toLowerCase(), table: g('table'), name: g('name'), type: g('type'), folder: g('folder'), flags: g('flags').toLowerCase(), description: g('description'), expression: g('expression'), totable: g('totable'), tocolumn: g('tocolumn'), storage: g('storage'), source: g('source') });
    }
    if (!map) throw new ProjectError('The header row (Kind, Table, Name…) wasn’t found. Paste the results of the toolkit export query, with headers.');
    const hidden = f => /\bhidden\b/.test(f);
    for (const r of rows) if (r.kind === 'table') {
      const t = setdefault(project.tables, r.table || r.name, Table(r.table || r.name));
      t.description = r.description; t.is_hidden = hidden(r.flags);
      if (r.storage || r.source) t.partitions.push({ name: t.name, mode: r.storage || '', source_type: r.source ? 'Remote model' : 'Not in export', expression: '', source_kind: r.source ? 'Remote semantic model (' + r.source + ')' : 'Not in export', source_file: '', line_number: 0 });
    }
    for (const r of rows) {
      if (r.kind === 'column') setdefault(project.tables, r.table, Table(r.table)).columns.push({ name: r.name, data_type: r.type, format_string: '', description: r.description, summarize_by: '', sort_by: '', source_column: '', is_hidden: hidden(r.flags), is_key: /\bkey\b/.test(r.flags), expression: r.expression });
      else if (r.kind === 'measure') {
        const [colRefs, br] = measureReferences(r.expression);
        setdefault(project.tables, r.table, Table(r.table)).measures.push({ name: r.name, expression: r.expression, format_string: r.type, display_folder: r.folder, description: r.description, is_hidden: hidden(r.flags), column_refs: colRefs, measure_refs: br.filter(x => cf(x) !== cf(r.name)) });
      } else if (r.kind === 'relationship') {
        const [fc, tc] = (r.type || 'many:one').split(':');
        const crossRaw = r.flags.replace(/\binactive\b/, '').trim();
        project.relationships.push({ name: r.table + '[' + r.name + '] → ' + r.totable + '[' + r.tocolumn + ']', from_table: r.table, from_column: r.name, to_table: r.totable, to_column: r.tocolumn,
          from_cardinality: cf(fc || 'many'), to_cardinality: cf(tc || 'one'), cross_filtering: /both/.test(crossRaw) ? 'bothDirections' : /automatic/.test(crossRaw) ? 'automatic' : 'oneDirection', is_active: !/\binactive\b/.test(r.flags) });
      }
    }
    return project;
  }

  /* ---------- diagram_v21.py ---------- */
  const isAutoDate = n => { n = cf(n.trim()); return n.startsWith('localdatetable_') || n.startsWith('datetabletemplate_'); };
  function isMeasuresTable(t) {
    const n = cf(t.name.trim());
    if (['_measures', 'measures', 'measure table', 'measure tables'].includes(n)) return true;
    return t.measures.length > 0 && !t.columns.some(c => !c.is_hidden);
  }
  function diagram(project, showAuto, includeMeasuresTables) {
    const names = sortCf([...project.tables.keys()]).filter(n => (showAuto || !isAutoDate(n)) && (includeMeasuresTables || !isMeasuresTable(project.tables.get(n))));
    const visible = new Set(names);
    const rels = project.relationships.filter(r => visible.has(r.from_table) && visible.has(r.to_table));
    if (!names.length) return '<p>No tables are available for the selected diagram options.</p>';
    const degree = {}, many = {}, one = {}; names.forEach(n => { degree[n] = 0; many[n] = 0; one[n] = 0; });
    for (const r of rels) {
      degree[r.from_table]++; degree[r.to_table]++;
      if (cf(r.from_cardinality) === 'many') many[r.from_table]++;
      if (cf(r.to_cardinality) === 'many') many[r.to_table]++;
      if (cf(r.from_cardinality) === 'one') one[r.from_table]++;
      if (cf(r.to_cardinality) === 'one') one[r.to_table]++;
    }
    const connected = names.filter(n => degree[n] > 0), disconnected = names.filter(n => degree[n] === 0);
    const byDeg = a => sortBy(a, n => [-degree[n], cf(n)]);
    let left = byDeg(connected.filter(n => many[n] >= one[n]));
    let right = byDeg(connected.filter(n => !left.includes(n)));
    if (!left.length && right.length) { const s = Math.max(1, Math.floor(right.length / 2)); left = right.slice(0, s); right = right.slice(s); }
    if (!right.length && left.length > 1) { const s = Math.floor((left.length + 1) / 2); right = left.slice(s); left = left.slice(0, s); }
    const cw = 250, ch = 64, lx = 55, rx = 795, top = 70, gap = 100;
    const rowCount = Math.max(left.length, right.length, 1);
    const discRows = Math.floor((disconnected.length + 2) / 3);
    const discTop = top + rowCount * gap + 60;
    const height = Math.max(360, discTop + discRows * 90 + 70), width = 1100;
    const pos = {};
    left.forEach((n, i) => { pos[n] = [lx, top + i * gap]; });
    right.forEach((n, i) => { pos[n] = [rx, top + i * gap]; });
    disconnected.forEach((n, i) => { pos[n] = [55 + (i % 3) * 345, discTop + Math.floor(i / 3) * 90]; });
    const endpoint = (n, side) => { const [x, y] = pos[n]; return side === 'right' ? [x + cw, y + ch / 2] : [x, y + ch / 2]; };
    const edges = [], par = {};
    for (const r of rels) {
      const fx = pos[r.from_table][0], tx0 = pos[r.to_table][0];
      const [start, fin] = fx <= tx0 ? [endpoint(r.from_table, 'right'), endpoint(r.to_table, 'left')] : [endpoint(r.from_table, 'left'), endpoint(r.to_table, 'right')];
      const key = [r.from_table, r.to_table].sort(cmp).join('\u0000');
      const pi = par[key] || 0; par[key] = pi + 1;
      const off = (pi - 1) * 12; const [sx, sy] = start, [tx, ty] = fin;
      const curve = Math.max(90, Math.abs(tx - sx) * 0.38);
      const color = r.is_active ? '#1a3a5c' : '#c62828', dash = r.is_active ? '' : ' stroke-dasharray="7,5"';
      const ms = cf(r.cross_filtering).includes('both') ? ' marker-start="url(#arrow-start)"' : '';
      const tip = esc(r.from_table + '[' + r.from_column + '] -> ' + r.to_table + '[' + r.to_column + '] | ' + r.from_cardinality + ':' + r.to_cardinality + ' | ' + r.cross_filtering + ' | ' + (r.is_active ? 'Active' : 'Inactive'));
      const sl = cf(r.from_cardinality) === 'many' ? '*' : '1', fl = cf(r.to_cardinality) === 'many' ? '*' : '1';
      edges.push('<g class="relationship-edge"><title>' + tip + '</title><path d="M ' + sx + ' ' + sy + ' C ' + (sx + curve) + ' ' + (sy + off) + ', ' + (tx - curve) + ' ' + (ty + off) + ', ' + tx + ' ' + ty + '" fill="none" stroke="' + color + '" stroke-width="2"' + dash + ' marker-end="url(#arrow-end)"' + ms + '/>'
        + '<text x="' + (sx + (tx >= sx ? 16 : -16)) + '" y="' + (sy - 8) + '" text-anchor="middle" class="cardinality">' + sl + '</text>'
        + '<text x="' + (tx + (tx >= sx ? -16 : 16)) + '" y="' + (ty - 8) + '" text-anchor="middle" class="cardinality">' + fl + '</text></g>');
    }
    const nodes = names.map(n => {
      const [x, y] = pos[n], t = project.tables.get(n);
      const [role, head] = many[n] > one[n] ? ['Fact / many-side', '#1f4e79'] : one[n] > many[n] ? ['Dimension / one-side', '#2f855a'] : ['Bridge / standalone', '#6b7280'];
      return '<g class="table-node"><title>' + esc(n) + ' | ' + esc(role) + '</title><rect x="' + x + '" y="' + y + '" width="' + cw + '" height="' + ch + '" rx="7" fill="#fff" stroke="#d0ccc4" stroke-width="1.5"/>'
        + '<rect x="' + x + '" y="' + y + '" width="' + cw + '" height="32" rx="7" fill="' + head + '"/><rect x="' + x + '" y="' + (y + 22) + '" width="' + cw + '" height="10" fill="' + head + '"/>'
        + '<text x="' + (x + cw / 2) + '" y="' + (y + 21) + '" text-anchor="middle" fill="#fff" class="node-title">' + esc([...n].slice(0, 34).join('')) + '</text>'
        + '<text x="' + (x + 10) + '" y="' + (y + 51) + '" class="node-meta">' + t.columns.length + ' columns · ' + t.measures.length + ' measures</text></g>';
    });
    const standalone = disconnected.length ? '<text x="55" y="' + (discTop - 18) + '" class="standalone">Standalone tables (' + disconnected.length + ')</text>' : '';
    const notes = [];
    if (!showAuto) { const c = [...project.tables.keys()].filter(isAutoDate).length; if (c) notes.push(c + ' auto date table(s) hidden'); }
    if (!includeMeasuresTables) { const c = [...project.tables.values()].filter(isMeasuresTable).length; if (c) notes.push(c + ' measures table(s) hidden'); }
    const hiddenNote = notes.length ? '<text x="' + (width - 45) + '" y="30" text-anchor="end" class="note-svg">' + esc(notes.join(' · ')) + '</text>' : '';
    return '<svg viewBox="0 0 ' + width + ' ' + height + '" class="diagram" role="img" aria-label="Semantic model relationship diagram">'
      + '<defs><marker id="arrow-end" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#1a3a5c"/></marker><marker id="arrow-start" markerWidth="8" markerHeight="8" refX="1" refY="4" orient="auto-start-reverse"><path d="M8,0 L0,4 L8,8 z" fill="#1a3a5c"/></marker></defs>'
      + '<style>.node-title{font:600 12px Segoe UI}.node-meta{font:11px Segoe UI;fill:#666}.cardinality{font:700 12px Segoe UI;fill:#1a3a5c;paint-order:stroke;stroke:#fff;stroke-width:3px}.standalone{font:600 13px Segoe UI;fill:#666}.note-svg{font:11px Segoe UI;fill:#666}</style>'
      + hiddenNote + edges.join('') + standalone + nodes.join('')
      + '<g transform="translate(55,' + (height - 44) + ')"><line x1="0" y1="0" x2="30" y2="0" stroke="#1a3a5c" stroke-width="2"/><text x="38" y="4" class="node-meta">Active</text><line x1="100" y1="0" x2="130" y2="0" stroke="#c62828" stroke-width="2" stroke-dasharray="7,5"/><text x="138" y="4" class="node-meta">Inactive</text><text x="230" y="4" class="node-meta">1 = one · * = many · arrows = filter direction</text></g></svg>';
  }

  /* ---------- v25_sections.py ---------- */
  const counter = () => new Map();
  const inc = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  function sourceInventory(project, tables) {
    const rows = [], sc = counter(), mc = counter();
    for (const t of sortBy(tables, t => cf(t.name))) for (const p of t.partitions) {
      const kind = p.source_kind || UNDETECTED, mode = p.mode || 'Not specified', st = p.source_type || 'Not specified';
      inc(sc, kind); inc(mc, mode);
      rows.push('<tr><td>' + esc(t.name) + '</td><td>' + esc(p.name) + '</td><td>' + esc(mode) + '</td><td>' + esc(st) + '</td><td>' + esc(kind) + '</td></tr>');
    }
    if (!rows.length) return '<h2 id="source-inventory">Source Inventory</h2><p>No table partitions were detected for the selected documentation scope.</p>';
    const cards = sortBy([...sc], e => cf(e[0])).map(([s, c]) => '<div class="stat"><b>' + c + '</b><span>' + esc(s) + '</span></div>').join('');
    const modes = sortBy([...mc], e => e[0]).map(([m, c]) => m + ': ' + c).join(', ');
    return '<h2 id="source-inventory">Source Inventory</h2><div class="grid">' + cards + '</div><p><b>Partition modes:</b> ' + esc(modes) + '</p><table><thead><tr><th>Table</th><th>Partition</th><th>Mode</th><th>Partition Type</th><th>Detected Source</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>';
  }
  function relationshipMatrix(project, included) {
    const rels = project.relationships.filter(r => included.has(r.from_table) && included.has(r.to_table));
    if (!rels.length) return '<h2 id="relationship-matrix">Relationship Matrix</h2><p>No relationships were found for the selected documentation scope.</p>';
    const rows = sortBy(rels, r => [cf(r.from_table), cf(r.to_table), cf(r.name)]).map((r, i) => '<tr class="relationship-row"><td>' + (i + 1) + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.from_table) + '</td><td>' + esc(r.from_column) + '</td><td>' + esc(r.to_table) + '</td><td>' + esc(r.to_column) + '</td><td>' + esc(r.from_cardinality + ' : ' + r.to_cardinality) + '</td><td>' + esc(r.cross_filtering) + '</td><td>' + (r.is_active ? 'Active' : 'Inactive') + '</td></tr>');
    return '<h2 id="relationship-matrix">Relationship Matrix</h2><p>Use the field below to filter by table, column, relationship, cardinality, direction, or status.</p><input id="relationship-filter" class="matrix-filter" type="search" placeholder="Filter relationships" oninput="filterRelationshipMatrix()"><div class="table-scroll"><table id="relationship-matrix-table"><thead><tr><th>#</th><th>Relationship</th><th>From Table</th><th>From Column</th><th>To Table</th><th>To Column</th><th>Cardinality</th><th>Filter Direction</th><th>Status</th></tr></thead><tbody>'
      + rows.join('') + '</tbody></table></div><script>function filterRelationshipMatrix(){const q=document.getElementById("relationship-filter").value.toLowerCase();document.querySelectorAll("#relationship-matrix-table tbody tr").forEach(row=>{row.style.display=row.innerText.toLowerCase().includes(q)?"":"none";});}<\/script>';
  }

  /* ---------- v26_lineage.py ---------- */
  const MEASURE_TOKEN = /(?<![\p{L}\p{N}_'])\[([^\]]+)\]/gu;
  const QUALIFIED_COLUMN = /(?:'((?:''|[^'])+)'|([A-Za-z_][\p{L}\p{N}_ ]*))\s*\[([^\]]+)\]/gu;
  function buildLineage(project, tables) {
    const nodes = new Map(), nameIndex = new Map();
    for (const t of tables) for (const m of t.measures) {
      const key = t.name + '[' + m.name + ']';
      nodes.set(key, { key, table: t.name, name: m.name, expression: m.expression || '', deps: new Set(), cols: new Set(), usedBy: new Set(), visuals: new Set(), unresolved: new Set() });
      const k = cf(m.name); if (!nameIndex.has(k)) nameIndex.set(k, []); nameIndex.get(k).push(key);
    }
    for (const n of nodes.values()) {
      const colNames = new Set();
      for (const m of n.expression.matchAll(QUALIFIED_COLUMN)) { const tn = (m[1] || m[2] || '').replace(/''/g, "'").trim(), cn = m[3].trim(); n.cols.add(tn + '[' + cn + ']'); colNames.add(cf(cn)); }
      for (const m of n.expression.matchAll(MEASURE_TOKEN)) {
        const cand = m[1].trim(); if (colNames.has(cf(cand))) continue;
        const hits = nameIndex.get(cf(cand)) || [];
        if (hits.length === 1 && hits[0] !== n.key) n.deps.add(hits[0]);
        else if (hits.length !== 1) n.unresolved.add(cand);
      }
    }
    for (const n of nodes.values()) for (const d of n.deps) if (nodes.has(d)) nodes.get(d).usedBy.add(n.key);
    for (const p of project.pages) for (const v of p.visuals) { const label = p.display_name + ': ' + v.name + ' (' + v.visual_type + ')'; for (const f of v.fields) if (nodes.has(f)) nodes.get(f).visuals.add(label); }
    return [nodes, findCycles(nodes)];
  }
  function findCycles(nodes) {
    const state = new Map(), stack = [], cycles = new Map();
    const canonical = cyc => { const body = cyc.slice(0, -1); let best = null; for (let i = 0; i < body.length; i++) { const r = body.slice(i).concat(body.slice(0, i)); if (!best || cmpTuple(r, best) < 0) best = r; } return best.concat([best[0]]); };
    const visit = key => {
      state.set(key, 1); stack.push(key);
      for (const d of nodes.get(key).deps) {
        if (!nodes.has(d)) continue;
        if (!state.get(d)) visit(d);
        else if (state.get(d) === 1 && stack.includes(d)) { const c = canonical(stack.slice(stack.indexOf(d)).concat([d])); cycles.set(c.join('\u0000'), c); }
      }
      stack.pop(); state.set(key, 2);
    };
    for (const k of sortCf([...nodes.keys()])) if (!state.get(k)) visit(k);
    return [...cycles.values()].sort(cmpTuple);
  }
  function transitive(start, nodes) {
    const seen = new Set(), pending = [...nodes.get(start).deps];
    while (pending.length) { const k = pending.pop(); if (seen.has(k) || !nodes.has(k)) continue; seen.add(k); pending.push(...nodes.get(k).deps); }
    return sortCf([...seen]);
  }
  function lineageHtml(project, tables) {
    const [nodes, cycles] = buildLineage(project, tables);
    if (!nodes.size) return '<h2 id="measure-lineage">Measure Lineage</h2><p>No measures were found in the selected documentation scope.</p>';
    const all = [...nodes.values()];
    const orphaned = all.filter(n => !n.usedBy.size && !n.visuals.size);
    const unresolvedCount = all.reduce((s, n) => s + n.unresolved.size, 0);
    const cards = '<div class="grid"><div class="stat"><b>' + nodes.size + '</b><span>Measures analyzed</span></div><div class="stat"><b>' + all.reduce((s, n) => s + n.deps.size, 0) + '</b><span>Measure dependencies</span></div><div class="stat"><b>' + orphaned.length + '</b><span>Potentially unused</span></div><div class="stat"><b>' + cycles.length + '</b><span>Dependency cycles</span></div><div class="stat"><b>' + unresolvedCount + '</b><span>Unresolved references</span></div></div>';
    const rows = [], details = [];
    for (const n of sortBy(all, n => [cf(n.table), cf(n.name)])) {
      const deps = sortCf([...n.deps]), impacts = sortCf([...n.usedBy]), vis = sortCf([...n.visuals]), tr = transitive(n.key, nodes);
      const status = !impacts.length && !vis.length ? 'Potentially unused' : 'Used';
      rows.push('<tr class="lineage-row"><td>' + esc(n.table) + '</td><td>' + esc(n.name) + '</td><td>' + esc(deps.join(', ') || 'None') + '</td><td>' + esc(impacts.join(', ') || 'None') + '</td><td>' + vis.length + '</td><td>' + status + '</td></tr>');
      details.push('<details><summary>' + esc(n.key) + '</summary><div class="inside"><p><b>Direct measure dependencies:</b> ' + esc(deps.join(', ') || 'None') + '</p><p><b>All downstream dependencies:</b> ' + esc(tr.join(', ') || 'None') + '</p><p><b>Column dependencies:</b> ' + esc([...n.cols].sort(cmp).join(', ') || 'None detected') + '</p><p><b>Used by measures:</b> ' + esc(impacts.join(', ') || 'None') + '</p><p><b>Used by visuals:</b> ' + esc(vis.join('; ') || 'None detected') + '</p><p><b>Unresolved bracket references:</b> ' + esc([...n.unresolved].sort(cmp).join(', ') || 'None') + '</p></div></details>');
    }
    const cyc = cycles.length ? '<h3>Dependency Cycles</h3><ul>' + cycles.map(c => '<li>' + esc(c.join(' -> ')) + '</li>').join('') + '</ul>' : '';
    let unused = '<h3>Potentially Unused Measures</h3>';
    unused += orphaned.length ? '<ul>' + sortBy(orphaned, n => cf(n.key)).map(n => '<li>' + esc(n.key) + '</li>').join('') + '</ul>' : '<p>No potentially unused measures were detected.</p>';
    return '<h2 id="measure-lineage">Measure Lineage and Impact Analysis</h2><p>Lineage is derived from exact bracket references in parsed DAX and exact Table[Field] references in parsed report visuals. Review unresolved references before using the results for deletion decisions.</p>'
      + cards + '<input id="lineage-filter" class="matrix-filter" type="search" placeholder="Filter measures or dependencies" oninput="filterLineage()"><div class="table-scroll"><table id="measure-lineage-table"><thead><tr><th>Table</th><th>Measure</th><th>Depends On</th><th>Used By</th><th>Visuals</th><th>Status</th></tr></thead><tbody>'
      + rows.join('') + '</tbody></table></div>' + cyc + unused + '<h3>Measure Details</h3>' + details.join('')
      + '<script>function filterLineage(){const q=document.getElementById("lineage-filter").value.toLowerCase();document.querySelectorAll("#measure-lineage-table tbody tr").forEach(row=>{row.style.display=row.innerText.toLowerCase().includes(q)?"":"none";});}<\/script>';
  }

  /* ---------- v27_validation.py ---------- */
  const relLabel = r => r.from_table + '[' + r.from_column + '] -> ' + r.to_table + '[' + r.to_column + ']';
  const relDetail = r => ' From ' + r.from_table + '[' + r.from_column + '] (' + r.from_cardinality + ') to ' + r.to_table + '[' + r.to_column + '] (' + r.to_cardinality + '); ' + (cf(r.cross_filtering).includes('both') ? 'both directions' : 'single direction') + ', ' + (r.is_active ? 'active' : 'inactive') + '.';
  function analyzeModel(project, tables) {
    const F = [], add = (severity, category, object_name, message, recommendation) => F.push({ severity, category, object_name, message, recommendation });
    const included = new Set(tables.map(t => t.name));
    const modelTables = [...project.tables.values()];
    for (const t of tables) for (const m of t.measures) for (const msg of checkMeasure(m.name, m.expression, modelTables)) add('Error', 'DAX Errors', t.name + '[' + m.name + ']', msg, 'Fix the measure expression; visuals using this measure will fail to render.');
    const connected = new Set();
    for (const r of project.relationships) if (included.has(r.from_table) && included.has(r.to_table)) { connected.add(r.from_table); connected.add(r.to_table); }
    for (const t of tables) if (!connected.has(t.name)) {
      const outside = project.relationships.filter(r => r.from_table === t.name || r.to_table === t.name).map(relLabel);
      let msg = 'Table is disconnected in the selected documentation scope.';
      if (outside.length) msg += ' Relationships to tables outside the scope: ' + outside.join('; ') + '.';
      add('Warning', 'Relationships', t.name, msg, 'Confirm that the table is intentionally standalone or used through measures only.');
    }
    const epCount = new Map(), epLabel = new Map();
    for (const r of project.relationships) {
      if (!included.has(r.from_table) || !included.has(r.to_table)) continue;
      const k = [r.from_table, r.from_column, r.to_table, r.to_column].map(cf).join('\u0000');
      epCount.set(k, (epCount.get(k) || 0) + 1); if (!epLabel.has(k)) epLabel.set(k, relLabel(r));
      const nm = relLabel(r), d = relDetail(r);
      if (!r.is_active) add('Info', 'Relationships', nm, 'Relationship is inactive.' + d, 'Confirm that DAX intentionally activates this relationship when needed.');
      if (cf(r.cross_filtering).includes('both')) add('Warning', 'Relationships', nm, 'Relationship uses bidirectional filtering.' + d, 'Review filter propagation and ambiguity risk; retain only when intentional.');
      if (cf(r.from_cardinality) === 'many' && cf(r.to_cardinality) === 'many') add('Warning', 'Relationships', nm, 'Relationship is many-to-many.' + d, 'Validate the grain and confirm that many-to-many behavior is required.');
    }
    for (const [k, c] of epCount) if (c > 1) add('Warning', 'Relationships', epLabel.get(k), c + ' relationship definitions use the same endpoints.', 'Review whether each duplicate-endpoint relationship is necessary.');
    for (const t of tables) if (isAutoDate(t.name)) add('Info', 'Technical Tables', t.name, 'Auto date table detected.', 'Consider an explicit date dimension for governed enterprise models.');
    const modes = counter(), kinds = counter();
    for (const t of tables) for (const p of t.partitions) { inc(modes, cf(p.mode || 'Not specified')); inc(kinds, p.source_kind || UNDETECTED); }
    const meaningful = [...modes.keys()].filter(m => m && m !== 'not specified');
    if (meaningful.length > 1) add('Info', 'Storage', 'Semantic model', 'Multiple partition storage modes were detected: ' + meaningful.sort(cmp).join(', ') + '.', 'Confirm that mixed storage modes are intentional and tested for expected behavior.');
    if (kinds.get(UNDETECTED)) add('Info', 'Sources', 'Source Inventory', kinds.get(UNDETECTED) + ' partition source(s) could not be classified by the current connector rules.', 'Review the Power Query section and extend connector detection when needed.');
    const [nodes, cycles] = buildLineage(project, tables);
    const members = new Set(cycles.flat());
    for (const c of cycles) add('Error', 'DAX Errors', c.join(' -> '), 'Circular measure dependency detected.', 'Resolve the dependency cycle before model processing or deployment.');
    for (const n of nodes.values()) if (!members.has(n.key) && !n.usedBy.size && !n.visuals.size) add('Warning', 'Measures', n.key, 'Measure is potentially unused by parsed measures and visuals.', 'Review external usage before deprecating or deleting the measure.');
    const rank = { Error: 0, Warning: 1, Info: 2 };
    return sortBy(F, f => [rank[f.severity] !== undefined ? rank[f.severity] : 3, cf(f.category), cf(f.object_name), cf(f.message)]);
  }
  function validationHtml(project, tables) {
    const f = analyzeModel(project, tables), sev = counter(), cat = counter();
    f.forEach(x => { inc(sev, x.severity); inc(cat, x.category); });
    const cards = '<div class="grid"><div class="stat"><b>' + (sev.get('Error') || 0) + '</b><span>Errors</span></div><div class="stat"><b>' + (sev.get('Warning') || 0) + '</b><span>Warnings</span></div><div class="stat"><b>' + (sev.get('Info') || 0) + '</b><span>Informational</span></div><div class="stat"><b>' + f.length + '</b><span>Total findings</span></div></div>';
    const summary = sortBy([...cat], e => e[0]).map(([c, n]) => c + ': ' + n).join(', ') || 'No findings';
    let rows = f.map(x => '<tr class="validation-row"><td><span class="severity ' + cf(x.severity) + '">' + esc(x.severity) + '</span></td><td>' + esc(x.category) + '</td><td>' + esc(x.object_name) + '</td><td>' + esc(x.message) + '</td><td>' + esc(x.recommendation) + '</td></tr>').join('');
    if (!rows) rows = '<tr><td colspan="5">No validation findings for the selected scope.</td></tr>';
    return '<h2 id="model-validation">Model Validation</h2><p>Validation findings are review candidates generated from the selected documentation scope. Informational and warning findings do not prove that the model is incorrect.</p>'
      + cards + '<p><b>Findings by category:</b> ' + esc(summary) + '</p><h3>Validation Findings</h3><div class="validation-controls"><input id="validation-filter" class="matrix-filter" type="search" placeholder="Filter validation findings" oninput="filterValidation()"><select id="validation-severity" onchange="filterValidation()"><option value="">All severities</option><option>Error</option><option>Warning</option><option>Info</option></select></div><div class="table-scroll"><table id="validation-table"><thead><tr><th>Severity</th><th>Category</th><th>Object</th><th>Finding</th><th>Recommendation</th></tr></thead><tbody>'
      + rows + '</tbody></table></div><script>function filterValidation(){const q=document.getElementById("validation-filter").value.toLowerCase();const s=document.getElementById("validation-severity").value.toLowerCase();document.querySelectorAll("#validation-table tbody tr").forEach(row=>{const text=row.innerText.toLowerCase();const severity=row.cells[0]?row.cells[0].innerText.toLowerCase():"";row.style.display=(text.includes(q)&&(!s||severity.includes(s)))?"":"none";});}<\/script>';
  }

  /* ---------- report_pages.py ---------- */
  function fieldKinds(project) {
    const k = new Map();
    for (const t of project.tables.values()) { for (const c of t.columns) k.set(cf(t.name + '[' + c.name + ']'), 'Column'); for (const m of t.measures) k.set(cf(t.name + '[' + m.name + ']'), 'Measure'); }
    return k;
  }
  const fieldKind = (f, k) => (f.includes('].[') ? 'Hierarchy level' : k.get(cf(f)) || 'Not in model');
  const pyFixed = (n, d) => { const k = Math.pow(10, d), m = n * k, fl = Math.floor(m); const r = m - fl === 0.5 ? (fl % 2 === 0 ? fl : fl + 1) : Math.round(m); return (r / k).toFixed(d); };  // Python rounds ties to even
  const f0 = n => pyFixed(n, 0);
  function pageCanvas(page) {
    const w = Math.max(page.width, 1), h = Math.max(page.height, 1);
    const boxes = page.visuals.map(v => {
      const cls = ['vbox']; if (v.is_group) cls.push('group'); if (v.is_hidden) cls.push('hidden');
      const tip = ['ID: ' + v.name, 'Type: ' + v.visual_type, v.title ? 'Title: ' + v.title : '', v.fields.length ? 'Fields: ' + v.fields.join(', ') : '', v.is_hidden ? 'Hidden' : ''].filter(Boolean).join('\n');
      return '<div class="' + cls.join(' ') + '" title="' + esc(tip) + '" style="left:' + pyFixed(v.x / w * 100, 3) + '%;top:' + pyFixed(v.y / h * 100, 3) + '%;width:' + pyFixed(Math.max(v.width, 1) / w * 100, 3) + '%;height:' + pyFixed(Math.max(v.height, 1) / h * 100, 3) + '%"><b>' + esc(v.visual_type) + '</b><code>' + esc(v.name) + '</code></div>';
    });
    return '<div class="page" style="aspect-ratio:' + fmtG(w) + '/' + fmtG(h) + '">' + boxes.join('') + '</div>';
  }
  function pageVisualTable(page) {
    const rows = sortBy(page.visuals, v => [v.y, v.x]).map(v => '<tr><td><code>' + esc(v.name) + '</code></td><td>' + esc(v.visual_type) + (v.is_hidden ? ' (hidden)' : '') + '</td><td>' + esc(v.title) + '</td><td>' + f0(v.x) + ', ' + f0(v.y) + ' · ' + f0(v.width) + ' × ' + f0(v.height) + '</td><td>' + (esc(v.fields.join(', ')) || '—') + '</td></tr>').join('');
    const groups = page.visuals.filter(v => v.is_group).length;
    const count = (page.visuals.length - groups) + ' visuals' + (groups ? ', ' + groups + ' groups' : '');
    return '<details><summary>Visual details (' + count + ')</summary><div class="inside table-scroll"><table><thead><tr><th>Visual ID</th><th>Type</th><th>Title</th><th>Position (x, y · w × h)</th><th>Fields</th></tr></thead><tbody>' + rows + '</tbody></table></div></details>';
  }
  function reportPagesHtml(project) {
    const pages = project.pages, visuals = pages.flatMap(p => p.visuals.filter(v => !v.is_group));
    const groups = pages.reduce((s, p) => s + p.visuals.filter(v => v.is_group).length, 0), hiddenPages = pages.filter(p => p.is_hidden).length;
    const cards = '<div class="grid"><div class="stat"><b>' + pages.length + '</b><span>Pages</span></div><div class="stat"><b>' + hiddenPages + '</b><span>Hidden pages</span></div><div class="stat"><b>' + visuals.length + '</b><span>Visuals</span></div><div class="stat"><b>' + groups + '</b><span>Visual groups</span></div></div>';
    const html = pages.map((p, i) => {
      const pv = p.visuals.filter(v => !v.is_group);
      return '<h3>' + (i + 1) + '. ' + esc(p.display_name) + (p.is_hidden ? ' <span class="badge">Hidden</span>' : '') + '</h3><p class="muted">' + pv.length + ' visuals · ' + fmtG(p.width) + ' × ' + fmtG(p.height) + ' · page ID <code>' + esc(p.name) + '</code></p>' + pageCanvas(p) + pageVisualTable(p);
    });
    return '<h2 id="pages">Report Pages</h2><p>Each box is a visual, labelled with its type and visual ID. Dashed outlines are groups; faded boxes are hidden visuals. Hover a box for its title and fields.</p>' + cards + html.join('');
  }
  function visualUsageHtml(project) {
    const kinds = fieldKinds(project), usage = new Map();
    for (const p of project.pages) for (const v of p.visuals) for (const f of v.fields) { if (!usage.has(f)) usage.set(f, []); usage.get(f).push([p, v]); }
    if (!usage.size) return '<h2 id="usage">Visual Usage</h2><p>No field references were found in report visuals.</p>';
    const rows = sortCf([...usage.keys()]).map(f => {
      const uses = usage.get(f);
      const usedIn = sortBy(uses, u => [cf(u[0].display_name), u[1].name]).map(([p, v]) => esc(p.display_name) + ' › ' + esc(v.title || v.visual_type) + ' <code>' + esc(v.name) + '</code>').join('<br>');
      return '<tr><td>' + esc(f) + '</td><td>' + fieldKind(f, kinds) + '</td><td>' + uses.length + '</td><td>' + new Set(uses.map(u => u[0].name)).size + '</td><td>' + usedIn + '</td></tr>';
    });
    return '<h2 id="usage">Visual Usage</h2><p>' + usage.size + ' fields are referenced by report visuals, including filters and conditional formatting.</p><input id="usage-filter" class="matrix-filter" type="search" placeholder="Filter fields, pages, or visual IDs" oninput="filterUsage()"><div class="table-scroll"><table id="usage-table" class="top"><thead><tr><th>Field</th><th>Kind</th><th>Visuals</th><th>Pages</th><th>Used In</th></tr></thead><tbody>'
      + rows.join('') + '</tbody></table></div><script>function filterUsage(){const q=document.getElementById("usage-filter").value.toLowerCase();document.querySelectorAll("#usage-table tbody tr").forEach(row=>{row.style.display=row.innerText.toLowerCase().includes(q)?"":"none";});}<\/script>';
  }

  /* ---------- documentation.py ---------- */
  function redact(value) {
    return String(value).replace(/(password|pwd|token|secret|apikey|accesskey)\s*=\s*[^;,\n\r]+/gi, m => m.split('=')[0] + '=[REDACTED]')
      .replace(/Authorization\s*:\s*[^\n\r]+/gi, m => (m.includes('=') ? m.split('=')[0] + '=[REDACTED]' : 'Authorization: [REDACTED]'));
  }
  const slug = v => cf(v).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
  const PRESETS = { 'Business Documentation': 'business', 'Developer Documentation': 'developer', Custom: 'custom' };
  function sectionVisibility(o, project) {
    const profile = (o.profile || 'Custom').trim(), dev = profile === 'Developer Documentation';
    const hasReport = !FIXES || !project || project.pages.length > 0;   // fix: don't promise report pages the project doesn't have
    return { report: hasReport && (dev || (profile === 'Custom' && o.include_report)), power_query: dev || (profile === 'Custom' && o.include_power_query), validation: dev || profile === 'Custom' };
  }
  function documentationTitle(o, project) {
    const shown = sectionVisibility(o, project), profile = (o.profile || 'Custom').trim();
    const subject = shown.report ? 'Model & Report Documentation' : 'Semantic Model Documentation';
    const audience = { 'Business Documentation': 'Business', 'Developer Documentation': 'Developer' }[profile] || '';
    const title = (audience + ' ' + subject).trim();
    const included = [['report pages & visual usage', shown.report], ['DAX expressions', o.include_dax], ['Power Query', shown.power_query], ['model validation', shown.validation], ['hidden objects', o.include_hidden], ['measures tables', o.include_measures_tables], ['auto date tables', o.show_auto_date_tables]].filter(x => x[1]).map(x => x[0]);
    return [title, included];
  }
  const defaultFilename = (project, o) => project.name + ' - ' + documentationTitle(o, project)[0].replace(/&/g, 'and') + '.html';
  const CSS = 'body{font-family:Segoe UI,Arial;max-width:1100px;margin:auto;padding:40px 24px;background:#fafaf8;color:#2c2c2c;line-height:1.5}h1,h2,h3{color:#1a3a5c}h2{margin-top:40px;border-bottom:3px solid #c89632;padding-bottom:8px}.toc{columns:2}.toc a{display:block;color:#1a3a5c;text-decoration:none}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px}.stat{background:#fff;border:1px solid #ddd;border-radius:8px;padding:16px;text-align:center}.stat b{display:block;font-size:28px;color:#1a3a5c}.stat span{color:#666}table{width:100%;border-collapse:collapse;margin:12px 0 22px;font-size:13px}th{background:#1a3a5c;color:#fff;text-align:left;padding:9px}td{padding:8px;border-bottom:1px solid #ddd}details{margin:8px 0;border:1px solid #ddd;border-radius:6px}summary{cursor:pointer;padding:10px;background:#f5f2ed;color:#1a3a5c;font-weight:600}.inside{padding:12px 16px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f2ed;border-left:4px solid #c89632;padding:12px;font:12px Consolas}.rel{display:flex;gap:10px;align-items:center;padding:10px;border:1px solid #ddd;border-radius:6px;margin:6px 0}.rel em{font-size:11px;background:#eef2f5;padding:2px 7px;border-radius:10px}.diagram{width:100%;border:1px solid #ddd;background:#fff}.page{position:relative;background:#f5f5f5;border:1px solid #bbb;margin:12px 0;overflow:hidden}.matrix-filter{width:100%;max-width:520px;padding:10px 12px;margin:8px 0 14px;border:1px solid #bbb;border-radius:6px;font:14px Segoe UI}.table-scroll{overflow-x:auto}.relationship-row:hover{background:#f4f7fa}.validation-controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.validation-controls select{padding:10px;border:1px solid #bbb;border-radius:6px}.severity{font-weight:700;padding:3px 8px;border-radius:12px;font-size:11px}.severity.error{background:#fde2e2;color:#9b1c1c}.severity.warning{background:#fff3cd;color:#7a5200}.severity.info{background:#e8f1fb;color:#1f4e79}.coverage-bar{min-width:160px;height:10px;background:#e5e7eb;border-radius:5px;overflow:hidden}.coverage-bar span{display:block;height:100%;background:#2f855a}.page{width:100%;background:#fff}.vbox{position:absolute;box-sizing:border-box;border:1px solid #6a1b9a;background:rgba(106,27,154,.08);font-size:9px;line-height:1.25;overflow:hidden;padding:2px 3px;color:#3b1356}.vbox b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vbox code{font:8px Consolas;color:#555;word-break:break-all}.vbox.group{border:1px dashed #1a3a5c;background:transparent;color:#1a3a5c}.vbox.hidden{opacity:.45;border-style:dashed}.vbox:hover{background:rgba(200,150,50,.25);z-index:9999}.badge{font-size:11px;background:#eef2f5;color:#1a3a5c;padding:2px 8px;border-radius:10px;vertical-align:middle}.muted{color:#666;margin-top:-6px}.subtitle{color:#555;margin-top:-10px}table.top td{vertical-align:top}@media print{body{max-width:none}h2{break-before:page}details{break-inside:avoid}}';
  const scopeTables = (project, o) => [...project.tables.values()].filter(t => (o.include_hidden || !t.is_hidden) && (o.include_measures_tables || !isMeasuresTable(t)));
  function generateHtml(project, o, opts = {}) {
    const shown = sectionVisibility(o, project);
    const tables = [...project.tables.values()].filter(t => (o.include_hidden || !t.is_hidden) && (o.include_measures_tables || !isMeasuresTable(t)));
    const measures = tables.flatMap(t => t.measures.filter(m => o.include_hidden || !m.is_hidden).map(m => [t, m]));
    const visuals = project.pages.flatMap(p => p.visuals.filter(v => !v.is_group));
    const included = new Set(tables.map(t => t.name));
    const scoped = project.relationships.filter(r => included.has(r.from_table) && included.has(r.to_table));
    const toc = ['<a href="#overview">Model Overview</a>', '<a href="#diagram">Relationship Diagram</a>', '<a href="#tables">Table Inventory</a>', '<a href="#measures">Measure Catalog</a>', '<a href="#measure-lineage">Measure Lineage</a>', '<a href="#relationships">Relationships</a>', '<a href="#relationship-matrix">Relationship Matrix</a>', '<a href="#source-inventory">Source Inventory</a>'];
    if (shown.validation) toc.push('<a href="#model-validation">Model Validation</a>');
    if (shown.report && project.pages.length) toc.push('<a href="#pages">Report Pages</a>', '<a href="#usage">Visual Usage</a>');
    const partCount = tables.reduce((s, t) => s + t.partitions.length, 0);
    const hasM = partCount && project.source !== 'export';
    if (shown.power_query && (hasM || project.expressions.length)) toc.push('<a href="#power-query">Power Query</a>');
    const S = [];
    const colCount = tables.reduce((s, t) => s + t.columns.filter(c => o.include_hidden || !c.is_hidden).length, 0);
    const cards = '<div class="grid">' + [[tables.length, 'Tables'], [colCount, 'Columns'], [measures.length, 'Measures'], [scoped.length, 'Relationships'], [project.pages.length, 'Pages'], [visuals.length, 'Visuals']].map(([v, l]) => '<div class="stat"><b>' + v + '</b><span>' + l + '</span></div>').join('') + '</div>';
    S.push('<h2 id="overview">Model Overview</h2>' + cards + '<table><tr><th>Property</th><th>Value</th></tr><tr><td>Compatibility Level</td><td>' + esc(project.compatibility_level) + '</td></tr><tr><td>Culture</td><td>' + esc(project.culture) + '</td></tr></table>');
    S.push('<h2 id="diagram">Relationship Diagram</h2>' + diagram(project, o.show_auto_date_tables, o.include_measures_tables));
    const th = [];
    for (const t of sortBy(tables, t => cf(t.name))) {
      const cols = t.columns.filter(c => o.include_hidden || !c.is_hidden);
      const hasD = cols.some(c => c.description);
      const rows = cols.map(c => '<tr><td>' + esc(c.name) + '</td><td>' + esc(c.data_type) + '</td><td>' + esc(c.sort_by) + '</td><td>' + esc(c.summarize_by) + '</td><td>' + esc(c.format_string) + '</td><td>' + (c.is_hidden ? 'Hidden' : '') + '</td>' + (hasD ? '<td>' + esc(c.description) + '</td>' : '') + '</tr>').join('');
      const mc = t.measures.filter(m => o.include_hidden || !m.is_hidden).map(m => '<details><summary>' + esc(m.name) + '</summary><div class="inside">' + (m.description ? '<p>' + esc(m.description) + '</p>' : '') + '<p><b>Folder:</b> ' + esc(m.display_folder) + ' &nbsp; <b>Format:</b> ' + esc(m.format_string) + '</p>' + (o.include_dax ? '<pre>' + esc(redact(m.expression)) + '</pre>' : '') + '<p><b>Columns:</b> ' + esc(m.column_refs.join(', ') || 'None detected') + '</p><p><b>Measures:</b> ' + esc(m.measure_refs.join(', ') || 'None detected') + '</p></div></details>').join('');
      th.push('<h3 id="' + slug(t.name) + '">' + esc(t.name) + '</h3>' + (t.description ? '<p>' + esc(t.description) + '</p>' : '') + '<details><summary>Columns (' + cols.length + ')</summary><div class="inside"><table><tr><th>Column</th><th>Data Type</th><th>Sort By</th><th>Summarize</th><th>Format</th><th>Status</th>' + (hasD ? '<th>Description</th>' : '') + '</tr>' + rows + '</table></div></details>' + mc);
    }
    S.push('<h2 id="tables">Table Inventory</h2>' + th.join(''));
    S.push('<h2 id="measures">Measure Catalog</h2><table><tr><th>#</th><th>Measure</th><th>Table</th><th>Display Folder</th><th>Format</th></tr>' + measures.map(([t, m], i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(m.name) + '</td><td>' + esc(t.name) + '</td><td>' + esc(m.display_folder) + '</td><td>' + esc(m.format_string) + '</td></tr>').join('') + '</table>');
    S.push(lineageHtml(project, tables));
    if (shown.validation) S.push(validationHtml(project, tables));
    S.push('<h2 id="relationships">Relationships</h2>' + scoped.map(r => '<div class="rel"><span>' + esc(r.from_table) + '[' + esc(r.from_column) + ']</span><b>→</b><span>' + esc(r.to_table) + '[' + esc(r.to_column) + ']</span><em>' + esc(r.from_cardinality) + ':' + esc(r.to_cardinality) + '</em><em>' + esc(r.cross_filtering) + '</em><em>' + (r.is_active ? 'Active' : 'Inactive') + '</em></div>').join(''));
    S.push(relationshipMatrix(project, included));
    S.push(sourceInventory(project, tables));
    if (shown.power_query && (hasM || project.expressions.length)) {
      const q = [];
      for (const t of sortBy(tables, t => cf(t.name))) for (const p of t.partitions) q.push('<details><summary>' + esc(t.name) + ' · ' + esc(p.name) + '</summary><div class="inside"><p><b>Mode:</b> ' + esc(p.mode || 'Not specified') + ' &nbsp; <b>Partition type:</b> ' + esc(p.source_type || 'Not specified') + ' &nbsp; <b>Detected source:</b> ' + esc(p.source_kind) + '</p><pre>' + esc(redact(p.expression)) + '</pre></div></details>');
      if (project.expressions.length) q.push('<h3>Shared Expressions</h3>' + project.expressions.map(e => '<details><summary>Shared expression · ' + esc(e.name) + '</summary><div class="inside"><pre>' + esc(redact(e.expression)) + '</pre></div></details>').join(''));
      S.push('<h2 id="power-query">Power Query</h2><p>' + partCount + ' table partition(s) documented.</p>' + q.join(''));
    }
    if (shown.report && project.pages.length) { S.push(reportPagesHtml(project)); S.push(visualUsageHtml(project)); }
    const warnings = project.warnings.map(w => '<li>' + esc(w) + '</li>').join('');
    if (warnings) S.push('<h2 id="validation">Validation Notes</h2><ul>' + warnings + '</ul>');
    const [title, inc2] = documentationTitle(o, project);
    const scope = 'Includes model overview, tables, measures, lineage, relationships, and sources' + (inc2.length ? ', plus ' + inc2.join(', ') : '') + '.';
    const date = opts.date || new Date().toISOString().slice(0, 10);
    const css = (opts.css || CSS) + (opts.extraCss || '');
    const footer = opts.footer || 'Generated locally by Local TMDL Documenter V2.';
    const note = opts.note ? '<p class="subtitle">' + esc(opts.note) + '</p>' : '';
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>' + esc(project.name) + ' — ' + esc(title) + '</title><style>' + css + '</style></head><body>' + (opts.header || '') + '<h1>' + esc(project.name) + ' — ' + esc(title) + '</h1><p class="subtitle">' + esc(scope) + '</p>' + note + '<p>Local documentation generated on ' + date + '</p><h2>Table of Contents</h2><div class="toc">' + toc.join('') + '</div>' + S.join('') + '<footer><p>' + esc(footer) + '</p></footer></body></html>';
  }

  return { scopeTables, setFixes: v => { FIXES = !!v; }, listProjects, loadModel, loadProject, loadProjectFromPbip, projectFromExport, generateHtml, defaultFilename, documentationTitle, sectionVisibility, analyzeModel, isMeasuresTable, isAutoDate, vfs, ProjectError, CSS, _: { tokenize, measureReferences, checkMeasure, detectSource, parsePartitionBlocks, dedent, fmtG, esc, redact } };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = MD;
