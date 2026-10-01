
/* ---------- About This Report: suggestions for a plain-language About page ----------
   Reads the model export (and, optionally, a data sources query or a PBIP folder) and suggests
   what to put in an About this report text: a summary, who it's for, the questions it answers,
   the key measures in plain words, how to use it, data sources, freshness, notes and an owner.
   Everything is a suggestion the author edits. No technical details apart from data sources. */
const AB = (() => {
  const lcs = s => (s || '').toLowerCase();
  const uniq = a => [...new Set(a)];
  const escH = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* ---------- sections: what to include and why ---------- */
  const SECTIONS = [
    { id: 'summary', title: 'About this report', label: 'Report summary', kind: 'text', rec: true,
      why: 'One or two sentences on what the report covers and what it’s for. Put it first: most people read no further.' },
    { id: 'value', title: 'Why it matters', label: 'Business value', kind: 'text', rec: true,
      why: 'The decision or action the report supports. It tells readers why the report is worth their time, and helps owners justify keeping it.' },
    { id: 'audience', title: 'Who it’s for', label: 'Who it’s for', kind: 'text', rec: true,
      why: 'Readers decide in seconds whether a report is meant for them. Naming the audience also sets the level of detail they should expect.' },
    { id: 'questions', title: 'Questions it answers', label: 'Questions it answers', kind: 'list', rec: true,
      why: 'Questions in the reader’s own words beat a list of features. Three to five is plenty.' },
    { id: 'kpis', title: 'Key measures', label: 'Key measures', kind: 'kpis', rec: true,
      why: 'The few numbers that matter most, each with a plain-language meaning, so everyone reads them the same way.' },
    { id: 'howto', title: 'How to use it', label: 'How to use it', kind: 'list', rec: false,
      why: 'Short tips on filtering, hovering and drilling through. Worth it for readers who are new to Power BI.' },
    { id: 'sources', title: 'Data sources', label: 'Data sources', kind: 'sources', rec: true,
      why: 'Where the numbers come from, in names readers recognize. The one technical detail worth including: it builds trust and tells people where to look when numbers disagree.' },
    { id: 'freshness', title: 'Data freshness', label: 'Data freshness', kind: 'text', rec: true,
      why: 'How current the numbers are. The first question people ask when a figure looks wrong.' },
    { id: 'notes', title: 'Notes and definitions', label: 'Notes and definitions', kind: 'list', rec: false,
      why: 'Anything that changes how a number is read: fiscal year start, currency, what’s excluded. Taken from the descriptions in your model where there are some.' },
    { id: 'owner', title: 'Owner and contact', label: 'Owner and contact', kind: 'text', rec: true,
      why: 'Who to ask about the numbers and where to send change requests. Without it, questions go nowhere.' }
  ];

  /* ---------- model reading ---------- */
  // measure flags (text, dynamic-format) aren't kept by parseModel, so read them here
  function measureFlags(text){
    const out = new Map(); const lines = (text || '').replace(/\r/g, '').split('\n');
    let map = null;
    for (const line of lines) {
      const cells = line.split('\t').map(c => lcs(unquoteCell(c.trim())).replace(/^.*\[|\]$/g, ''));
      if (!map) { if (cells.includes('kind') && cells.includes('flags')) { map = {}; cells.forEach((c, j) => { map[c] = j; }); } continue; }
      const raw = line.split('\t'), g = k => unquoteCell((raw[map[k]] || '').trim());
      if (lcs(g('kind')) === 'measure') out.set(lcs(g('table')) + '|' + lcs(g('name')), lcs(g('flags')));
    }
    return out;
  }
  function parse(text){
    const m = parseModel(text);
    if (m.error) return m;
    const fl = measureFlags(text);
    m.measures.forEach(x => { const f = fl.get(lcs(x.table) + '|' + lcs(x.name)) || ''; x.text = /\btext\b/.test(f); });
    return m;
  }

  // table roles: date tables, measure tables, facts (many side), dimensions (one side)
  function roles(model){
    const cols = t => model.columns.filter(c => lcs(c.table) === lcs(t.name));
    const oneSide = new Set(model.rels.filter(r => !r.inactive).map(r => lcs(r.toTable)));
    const manySide = new Set(model.rels.filter(r => !r.inactive).map(r => lcs(r.fromTable)));
    const out = { date: [], measure: [], fact: [], dim: [], other: [] };
    model.tables.forEach(t => {
      const cs = cols(t), vis = cs.filter(c => !c.hidden);
      const hasMeasures = model.measures.some(x => lcs(x.table) === lcs(t.name));
      if (/^time$/i.test(t.category) || /^(date|dates|calendar|dim ?date|date table)$/i.test(t.name)) out.date.push(t);
      else if (hasMeasures && !vis.length) out.measure.push(t);
      else if (t.hidden) out.other.push(t);
      else if (oneSide.has(lcs(t.name))) out.dim.push(t);
      else if (manySide.has(lcs(t.name))) out.fact.push(t);
      else out.other.push(t);
    });
    return out;
  }

  // plain names for the things readers slice by: known attribute columns first, then dimension tables
  const ATTR = /^(region|country|state|city|territory|market|segment|category|sub ?category|channel|brand|department|team|store|branch|division|business unit|product line|customer type|industry|sales ?rep|salesperson|account manager|manager|site|location|warehouse|supplier|vendor|campaign|source)$/i;
  function breakdowns(model){
    const r = roles(model), dims = new Set(r.dim.map(t => lcs(t.name)));
    const attrs = model.columns.filter(c => !c.hidden && ATTR.test(c.name.trim()) && (dims.has(lcs(c.table)) || !r.fact.some(t => lcs(t.name) === lcs(c.table))) && !r.date.some(t => lcs(t.name) === lcs(c.table)));
    const names = uniq(attrs.map(c => c.name.trim()));
    r.dim.forEach(t => { if (!names.some(n => lcs(n) === lcs(t.name))) names.push(t.name); });
    return { terms: names.slice(0, 6), hasDate: r.date.length > 0 || model.columns.some(c => /date/i.test(c.dataType) && !c.hidden) };
  }
  function plural(w){
    const s = w.trim(); if (!s) return s;
    if (/[^aeiou]y$/i.test(s)) return s.slice(0, -1) + 'ies';
    if (/(s|x|z|ch|sh)$/i.test(s)) return s + 'es';
    return s + 's';
  }
  // "Sales Rep" -> "sales reps"; keep acronyms
  const lower = s => s.split(' ').map(w => /^[A-Z0-9]{2,}$/.test(w) ? w : w.toLowerCase()).join(' ');
  const listJoin = (a, and) => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' ' + (and || 'and') + ' ' + a[a.length - 1];
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  /* ---------- key measures (ported from the About This Report Generator rules) ---------- */
  const EXCL_NAME = ['background color', 'font color', 'text color', 'color', 'colour', 'display label', 'label', 'html', 'selected', 'title', 'format', 'switch', 'metric value', 'last refresh', 'tooltip', 'subtitle', 'placeholder', 'dummy', 'blank'];
  const EXCL_FOLDER = ['format', 'html', 'color', 'colour', 'label', 'metadata', 'helper', 'switch', 'title'];
  const COMPOUND = ['DIVIDE(', 'SWITCH(', 'FORMAT('];
  const REF = /(?<![A-Za-z0-9_])\[([^\]]+)\]/g;
  function compound(m){
    const e = (m.expression || '').toUpperCase().replace(/\s+/g, '');
    if (COMPOUND.some(f => e.includes(f))) return true;
    const refs = new Set([...(m.expression || '').matchAll(REF)].map(x => lcs(x[1]))); refs.delete(lcs(m.name));
    return refs.size >= 2 || /\[[^\]]+\]\s*[+\-*/]\s*\[[^\]]+\]/.test(m.expression || '');
  }
  function usedBy(model){
    const n = new Map();
    model.measures.forEach(m => {
      const refs = new Set([...(m.expression || '').matchAll(REF)].map(x => lcs(x[1])));
      refs.forEach(r => { if (r !== lcs(m.name)) n.set(r, (n.get(r) || 0) + 1); });
    });
    return n;
  }
  function kpis(model, report, opt){
    opt = opt || {};
    const uses = usedBy(model), vis = report ? report.counts : null;
    return model.measures.map(m => {
      const name = lcs(m.name), folder = lcs(m.folder);
      let out = '';
      if (m.remote) out = '';
      if (EXCL_NAME.some(t => name.includes(t)) || EXCL_FOLDER.some(t => folder.includes(t))) out = 'Looks like a helper (title, label, color or format)';
      else if (m.text) out = 'Returns text, not a number';
      else if (m.hidden && !opt.hidden) out = 'Hidden in the model';
      const comp = compound(m);
      if (!out && comp && !opt.compound) out = 'Combines other measures (a ratio, variance or time comparison)';
      const u = uses.get(name) || 0, v = vis ? (vis.get(name) || 0) : 0;
      const why = [];
      let score = v * 10 + u * 5;
      if (v) why.push('on ' + v + ' visual' + (v === 1 ? '' : 's'));
      if (u) why.push('used by ' + u + ' other measure' + (u === 1 ? '' : 's'));
      if (/(^|\\)(kpis?|core|key|headline|main)(\\|$)/i.test(m.folder || '')) { score += 4; why.push('in a ' + m.folder + ' folder'); }
      if (m.description) { score += 3; why.push('has a description'); }
      if (m.formatString) score += 1;
      if (vis && !v && !u) score -= 2;
      return { name: m.name, table: m.table, measure: m, score, why, compound: comp, excluded: out, meaning: meaning(m, model) };
    }).sort((a, b) => (!!a.excluded - !!b.excluded) || b.score - a.score || a.name.localeCompare(b.name));
  }
  // a plain-language meaning: the model description first, else a reading of a simple expression
  function meaning(m){
    if (m.description) return m.description.trim();
    const e = oneLine(m.expression || '');
    const col = s => { const x = s.match(/\[([^\]]+)\]\s*$/); return x ? lower(x[1].replace(/([a-z])([A-Z])/g, '$1 $2')) : ''; };
    const thing = s => col(s).replace(/\s*\b(key|id|code|number|no)$/i, '').trim() || col(s);
    let x;
    if ((x = e.match(/^SUM\s*\(\s*([^()]+)\)$/i))) return (/^total\b/.test(col(x[1])) ? cap(col(x[1])) : 'Total ' + col(x[1])) + '.';
    if ((x = e.match(/^AVERAGE\s*\(\s*([^()]+)\)$/i))) return 'Average ' + col(x[1]) + '.';
    if ((x = e.match(/^DISTINCTCOUNT\s*\(\s*([^()]+)\)$/i))) return 'Number of different ' + plural(thing(x[1])) + '.';
    if ((x = e.match(/^COUNTROWS\s*\(\s*'?([^'()]+)'?\s*\)$/i))) return 'Number of ' + lower(x[1].trim()) + ' records.';
    if ((x = e.match(/^MIN\s*\(\s*([^()]+)\)$/i))) return 'Lowest ' + col(x[1]) + '.';
    if ((x = e.match(/^MAX\s*\(\s*([^()]+)\)$/i))) return 'Highest ' + col(x[1]) + '.';
    return '';
  }

  /* ---------- data sources ---------- */
  const SOURCES_QUERY = [
    '// About This Report: data sources',
    '// Run in DAX query view, then select Copy above the results grid.',
    '// Reads the Power Query behind each table; nothing about your data.',
    'EVALUATE',
    'VAR _tables = SELECTCOLUMNS ( INFO.TABLES (), "TID", [ID], "TName", [Name] )',
    'VAR _exprIds = SELECTCOLUMNS ( INFO.EXPRESSIONS (), "EID", [ID], "EName", [Name] )',
    'VAR _partitions =',
    '\tSELECTCOLUMNS (',
    '\t\tINFO.PARTITIONS (),',
    '\t\t"Kind", "Partition",',
    '\t\t"Name", VAR _t = [TableID] RETURN MAXX ( FILTER ( _tables, [TID] = _t ), [TName] ),',
    '\t\t"SourceType", [Type],',
    '\t\t"Via", VAR _e = [ExpressionSourceID] RETURN MAXX ( FILTER ( _exprIds, [EID] = _e ), [EName] ),',
    '\t\t"Refreshed", [RefreshedTime],',
    '\t\t"Text", ' + CLEAN('[QueryDefinition]', ' '),
    '\t)',
    'VAR _policies =',
    '\tSELECTCOLUMNS (',
    '\t\tINFO.REFRESHPOLICIES (),',
    '\t\t"Kind", "Policy",',
    '\t\t"Name", VAR _t = [TableID] RETURN MAXX ( FILTER ( _tables, [TID] = _t ), [TName] ),',
    '\t\t"SourceType", 4,',
    '\t\t"Via", "",',
    '\t\t"Refreshed", BLANK (),',
    '\t\t"Text", ' + CLEAN('[SourceExpression]', ' '),
    '\t)',
    'VAR _queries =',
    '\tSELECTCOLUMNS (',
    '\t\tINFO.EXPRESSIONS (),',
    '\t\t"Kind", "Query",',
    '\t\t"Name", [Name],',
    '\t\t"SourceType", [Kind],',
    '\t\t"Via", "",',
    '\t\t"Refreshed", BLANK (),',
    '\t\t"Text", ' + CLEAN('[Expression]', ' '),
    '\t)',
    'RETURN',
    '\tUNION ( _partitions, _policies, _queries )',
    'ORDER BY [Kind], [Name]'
  ].join('\n');

  // rows: { kind: 'table' | 'query', name, type: 'm' | 'calculated' | 'entity' | 'calcgroup' | '', via, refreshed, text }
  function parseSourcesQuery(text){
    const lines = (text || '').replace(/\r/g, '').split('\n'); let map = null; const rows = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const cells = line.split('\t');
      if (!map) { const h = cells.map(c => lcs(unquoteCell(c.trim())).replace(/^.*\[|\]$/g, '')); if (h.includes('kind') && h.includes('text')) { map = {}; h.forEach((c, j) => { map[c] = j; }); } continue; }
      const g = k => map[k] === undefined ? '' : restore(unquoteCell((cells[map[k]] || '').trim()));
      const kind = lcs(g('kind')), st = g('sourcetype').trim();
      const type = kind === 'query' ? 'm' : st === '2' ? 'calculated' : st === '5' ? 'entity' : st === '7' ? 'calcgroup' : st === '3' ? 'none' : 'm';
      rows.push({ kind: kind === 'query' ? 'query' : 'table', policy: kind === 'policy', name: g('name'), type, via: g('via'), refreshed: g('refreshed'), text: g('text') });
    }
    if (!map) return { error: 'The header row (Kind, Name, SourceType, Via, Refreshed, Text) wasn’t found. Use the Copy button above the results grid so the column names come along.', rows: [] };
    return { rows };
  }
  // the same rows from the .SemanticModel folder of a PBIP (TMDL files)
  function parseTmdl(files){
    const rows = [];
    for (const [path, text] of files) {
      if (!/\.SemanticModel\/definition\/.+\.tmdl$/i.test(path)) continue;
      const t = text.replace(/\r/g, '');
      if (/\/tables\/[^\/]+\.tmdl$/i.test(path)) {
        const nm = (t.match(/^table\s+(.+?)\s*$/m) || [])[1]; if (!nm) continue;
        const name = nm.replace(/^'(.*)'$/, '$1').replace(/''/g, "'");
        const parts = [...t.matchAll(/^\tpartition\s+.+?=\s*(\w+)\s*$/gm)].map(x => lcs(x[1]));
        const type = parts.includes('calculated') ? 'calculated' : parts.includes('entity') ? 'entity' : parts.includes('calculationgroup') || /^\tcalculationGroup\b/m.test(t) ? 'calcgroup' : 'm';
        const via = (t.match(/expressionSource:\s*'?([^'\n]+)'?/) || [])[1] || '';
        rows.push({ kind: 'table', name, type, via, refreshed: '', text: t.slice(t.search(/^\t(partition|refreshPolicy)\b/m) >= 0 ? t.search(/^\t(partition|refreshPolicy)\b/m) : 0) });
      } else if (/\/expressions\.tmdl$/i.test(path)) {
        t.split(/^(?=expression\s)/m).forEach(block => {
          const x = block.match(/^expression\s+('(?:[^']|'')+'|[^\s=]+)\s*=/); if (!x) return;
          rows.push({ kind: 'query', name: x[1].replace(/^'(.*)'$/, '$1').replace(/''/g, "'"), type: 'm', via: '', refreshed: '', text: block });
        });
      }
    }
    return rows;
  }

  // split the arguments of a call that starts at text[i] === '('
  function args(text, i){
    const out = []; let depth = 0, cur = '', str = false;
    for (let k = i; k < text.length; k++) {
      const ch = text[k];
      if (str) { cur += ch; if (ch === '"') { if (text[k + 1] === '"') { cur += '"'; k++; } else str = false; } continue; }
      if (ch === '"') { str = true; cur += ch; continue; }
      if (ch === '(' || ch === '[' || ch === '{') { depth++; if (depth === 1 && ch === '(') continue; }
      if (ch === ')' || ch === ']' || ch === '}') { depth--; if (depth === 0) { out.push(cur.trim()); return { args: out, end: k }; } }
      if (ch === ',' && depth === 1) { out.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur.trim()); return { args: out, end: text.length };
  }
  const lit = (a, params) => { if (!a) return ''; const s = a.match(/^"((?:[^"]|"")*)"$/); if (s) return s[1].replace(/""/g, '"'); const id = a.replace(/^#"(.*)"$/, '$1'); return params && params.has(lcs(id)) ? params.get(lcs(id)) : ''; };
  const firstLit = (a, params) => { const s = (a || '').match(/"((?:[^"]|"")*)"/); if (s) return s[1].replace(/""/g, '"'); const w = (a || '').match(/[A-Za-z_#][\w."#]*/g) || []; for (const x of w) { const v = lit(x, params); if (v) return v; } return ''; };
  const fileName = p => (p || '').replace(/[?#].*$/, '').split(/[\\\/]/).filter(Boolean).pop() || '';
  const host = u => { const m = (u || '').match(/^[a-z]+:\/\/([^\/:?#]+)/i); return m ? m[1] : (u || '').split(/[\/,;]/)[0]; };
  const spSite = u => { const m = (u || '').match(/\/(sites|teams)\/([^\/?#]+)/i); return m ? decodeURIComponent(m[2]).replace(/[-_]+/g, ' ') : host(u); };
  const sqlKind = s => /database\.windows\.net/i.test(s) ? 'Azure SQL Database' : /(datawarehouse\.fabric\.microsoft\.com|datawarehouse\.pbidedicated)/i.test(s) ? 'Fabric SQL endpoint' : /sql\.azuresynapse\.net/i.test(s) ? 'Azure Synapse' : 'SQL Server';

  // connector function -> [type, detail from args]
  const FORMAT_FN = { 'Excel.Workbook': 'Excel workbook', 'Csv.Document': 'CSV file', 'Json.Document': 'JSON file', 'Xml.Tables': 'XML file', 'Xml.Document': 'XML file', 'Pdf.Tables': 'PDF file', 'Parquet.Document': 'Parquet file', 'Access.Database': 'Access database' };
  const CONNECTORS = {
    'Sql.Database': (a, p) => [sqlKind(lit(a[0], p)), lit(a[1], p) || host(lit(a[0], p))],
    'Sql.Databases': (a, p) => [sqlKind(lit(a[0], p)), host(lit(a[0], p))],
    'SharePoint.Files': (a, p) => ['SharePoint', spSite(lit(a[0], p))],
    'SharePoint.Contents': (a, p) => ['SharePoint', spSite(lit(a[0], p))],
    'SharePoint.Tables': (a, p) => ['SharePoint list', spSite(lit(a[0], p))],
    'Folder.Files': (a, p) => ['Folder', fileName(lit(a[0], p))],
    'Folder.Contents': (a, p) => ['Folder', fileName(lit(a[0], p))],
    'Web.Contents': (a, p) => ['Web', host(lit(a[0], p))],
    'Web.Page': () => ['Web page', ''],
    'OData.Feed': (a, p) => ['OData feed', host(lit(a[0], p))],
    'Odbc.DataSource': (a, p) => ['ODBC', ((lit(a[0], p) || '').match(/dsn=([^;]+)/i) || [])[1] || ''],
    'Odbc.Query': (a, p) => ['ODBC', ((lit(a[0], p) || '').match(/dsn=([^;]+)/i) || [])[1] || ''],
    'OleDb.DataSource': () => ['OLE DB', ''],
    'Oracle.Database': (a, p) => ['Oracle', lit(a[0], p)],
    'PostgreSQL.Database': (a, p) => ['PostgreSQL', lit(a[1], p) || lit(a[0], p)],
    'MySQL.Database': (a, p) => ['MySQL', lit(a[1], p) || lit(a[0], p)],
    'Teradata.Database': (a, p) => ['Teradata', lit(a[0], p)],
    'DB2.Database': (a, p) => ['IBM Db2', lit(a[1], p) || lit(a[0], p)],
    'SapHana.Database': (a, p) => ['SAP HANA', lit(a[0], p)],
    'SapBusinessWarehouse.Cubes': (a, p) => ['SAP BW', lit(a[0], p)],
    'Snowflake.Databases': (a, p) => ['Snowflake', host(lit(a[0], p)).split('.')[0]],
    'Databricks.Catalogs': (a, p) => ['Databricks', ''],
    'DatabricksMultiCloud.Catalogs': () => ['Databricks', ''],
    'Databricks.Query': () => ['Databricks', ''],
    'GoogleBigQuery.Database': () => ['Google BigQuery', ''],
    'AmazonRedshift.Database': (a, p) => ['Amazon Redshift', lit(a[1], p)],
    'AzureStorage.Blobs': (a, p) => ['Azure Blob Storage', host(lit(a[0], p)).split('.')[0]],
    'AzureStorage.DataLake': (a, p) => /onelake/i.test(lit(a[0], p)) ? ['Microsoft Fabric OneLake', ''] : ['Azure Data Lake', host(lit(a[0], p)).split('.')[0]],
    'AzureStorage.Tables': () => ['Azure Table Storage', ''],
    'Lakehouse.Contents': () => ['Fabric lakehouse', ''],
    'Fabric.Warehouse': () => ['Fabric warehouse', ''],
    'PowerPlatform.Dataflows': () => ['Power BI dataflow', ''],
    'PowerBI.Dataflows': () => ['Power BI dataflow', ''],
    'Dataflows.Contents': () => ['Power BI dataflow', ''],
    'CommonDataService.Database': (a, p) => ['Dataverse', host(lit(a[0], p)).split('.')[0]],
    'Cds.Entities': (a, p) => ['Dataverse', host(lit(a[0], p)).split('.')[0]],
    'Dataverse.Contents': () => ['Dataverse', ''],
    'Dynamics365BusinessCentral.ApiContentsWithOptions': () => ['Dynamics 365 Business Central', ''],
    'Salesforce.Data': () => ['Salesforce', ''],
    'Salesforce.Reports': () => ['Salesforce', ''],
    'AnalysisServices.Database': (a, p) => ['Analysis Services', lit(a[1], p)],
    'AnalysisServices.Databases': (a, p) => ['Analysis Services', host(lit(a[0], p))],
    'PowerBI.Datamarts': () => ['Power BI datamart', ''],
    'GoogleAnalytics.Accounts': () => ['Google Analytics', ''],
    'VSTS.Feed': () => ['Azure DevOps', ''],
    'VSTS.AnalyticsViews': () => ['Azure DevOps', ''],
    'Exchange.Contents': () => ['Exchange', ''],
    'ActiveDirectory.Domains': () => ['Active Directory', '']
  };
  const FN_RE = new RegExp('(' + Object.keys(CONNECTORS).concat(Object.keys(FORMAT_FN)).map(k => k.replace('.', '\\.')).join('|') + ')\\s*\\(', 'g');

  function scan(text, params){
    const found = [], used = [];
    const t = text || '';
    if (/Binary\.Decompress\s*\(\s*Binary\.FromText/i.test(t) || (/#table\s*\(/.test(t) && !FN_RE.test(t))) { FN_RE.lastIndex = 0; found.push({ type: 'Entered data', detail: '', manual: true }); }
    FN_RE.lastIndex = 0;
    let m;
    while ((m = FN_RE.exec(t))) {
      const at = m.index, fn = m[1], a = args(t, at + m[0].length - 1);
      if (used.some(r => at > r[0] && at < r[1])) continue;
      if (FORMAT_FN[fn]) {
        const inner = t.slice(at + m[0].length, a.end);
        if (/Binary\.Decompress/i.test(inner)) continue;
        const path = firstLit(inner, params);
        if (!path) continue; // a file handed over by a SharePoint or folder step: the site or folder is the source
        const sp = /sharepoint\.com/i.test(path);
        found.push({ type: FORMAT_FN[fn] + (sp ? ' on SharePoint' : ''), detail: decodeURIComponent(fileName(path)) });
        used.push([at, a.end]);
        continue;
      }
      const r = CONNECTORS[fn](a.args, params);
      found.push({ type: r[0], detail: (r[1] || '').trim() });
    }
    return found;
  }

  // group sources across tables, following queries that reference other queries
  function detect(rows, model){
    const queries = new Map(rows.filter(r => r.kind === 'query').map(r => [lcs(r.name), r]));
    const params = new Map();
    queries.forEach((q, k) => { if (/IsParameterQuery\s*=\s*true/i.test(q.text)) { const v = q.text.match(/^\s*(?:expression\s+\S+\s*=\s*)?"((?:[^"]|"")*)"/); if (v) params.set(k, v[1].replace(/""/g, '"')); } });
    const refRe = name => new RegExp('(^|[^\\w."])(' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '|#"' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '")(?![\\w."])');
    const cache = new Map();
    const resolve = (text, via, depth, seen) => {
      let out = scan(text, params);
      if (depth > 6) return out;
      const refs = [];
      queries.forEach((q, k) => { if (params.has(k) || seen.has(k)) return; if ((via && lcs(via) === k) || refRe(q.name).test(text)) refs.push(k); });
      refs.forEach(k => {
        if (!cache.has(k)) { const s = new Set(seen); s.add(k); cache.set(k, resolve(queries.get(k).text, '', depth + 1, s)); }
        out = out.concat(cache.get(k));
      });
      return out;
    };
    const bySrc = new Map(), calc = [], unknown = [];
    let refreshed = '';
    const skip = n => /^(localdatetable_|datetabletemplate_)/i.test(n);
    const tableRows = new Map();
    rows.filter(r => r.kind === 'table' && r.name && !skip(r.name)).forEach(r => {
      const k = lcs(r.name); if (!tableRows.has(k)) tableRows.set(k, []); tableRows.get(k).push(r);
      if (r.refreshed && r.refreshed > refreshed) refreshed = r.refreshed;
    });
    const add = (s, table) => {
      const key = lcs(s.type + '|' + s.detail);
      if (!bySrc.has(key)) bySrc.set(key, { key, type: s.type, detail: s.detail, manual: !!s.manual, tables: [] });
      const b = bySrc.get(key); if (!b.tables.includes(table)) b.tables.push(table);
    };
    tableRows.forEach(list => {
      const name = list[0].name;
      if (list.some(r => r.type === 'calculated' || r.type === 'calcgroup')) { calc.push(name); return; }
      let srcs = [];
      list.forEach(r => { srcs = srcs.concat(resolve(r.text, r.via, 0, new Set())); });
      const seen = new Set(); srcs = srcs.filter(s => { const k = lcs(s.type + '|' + s.detail); if (seen.has(k)) return false; seen.add(k); return true; });
      if (!srcs.length) unknown.push(name); else srcs.forEach(s => add(s, name));
    });
    // remote semantic models, from the model export itself
    if (model) model.tables.filter(t => t.remote).forEach(t => {
      add({ type: 'Power BI semantic model', detail: remoteLabel(t.source) }, t.name);
      const u = unknown.indexOf(t.name); if (u >= 0) unknown.splice(u, 1);
    });
    const list = [...bySrc.values()].map(s => Object.assign(s, { label: sourceLabel(s) }))
      .sort((a, b) => (a.manual - b.manual) || b.tables.length - a.tables.length || a.label.localeCompare(b.label));
    return { sources: list, calc, unknown, refreshed, tables: tableRows.size };
  }
  function sourceLabel(s){
    if (s.manual) return 'Data entered in the report';
    return s.detail ? s.detail + ' (' + s.type + ')' : s.type;
  }
  // without a sources query: remote models only
  function modelOnlySources(model){ return detect([], model); }

  /* ---------- report pages (PBIR or the older report.json) ---------- */
  function readReport(files){
    const pages = new Map(), counts = new Map(), slicerFields = new Set(), reports = new Set();
    let visuals = 0, drill = false;
    const isObj = n => n && typeof n === 'object' && !Array.isArray(n);
    const props = data => {
      const out = new Set();
      const walk = n => {
        if (typeof n === 'string') { const t = n.trim(); if ((t[0] === '{' || t[0] === '[') && t.length > 20 && /"Property"/.test(t)) { try { walk(JSON.parse(t)); } catch (e) {} } return; }
        if (isObj(n)) { if (typeof n.Property === 'string') out.add(n.Property); Object.values(n).forEach(walk); }
        else if (Array.isArray(n)) n.forEach(walk);
      };
      walk(data); return out;
    };
    const visualType = v => (isObj(v.visual) && v.visual.visualType) || (isObj(v.singleVisual) && v.singleVisual.visualType) || '';
    const countVisual = (v, type) => {
      visuals++;
      const ps = props(v);
      ps.forEach(p => counts.set(lcs(p), (counts.get(lcs(p)) || 0) + 1));
      if (/slicer/i.test(type)) ps.forEach(p => slicerFields.add(p));
    };
    for (const [path, text] of files) {
      const rm = path.match(/(?:^|\/)([^\/]+)\.Report\//i); if (!rm || !/\.json$/i.test(path)) continue;
      let data; try { data = JSON.parse(text.replace(/^﻿/, '')); } catch (e) { continue; }
      reports.add(rm[1]);
      const pm = path.match(/\/pages\/([^\/]+)\/page\.json$/i);
      if (pm) {
        const type = isObj(data.pageBinding) ? lcs(data.pageBinding.type) : '';
        if (type === 'drillthrough') drill = true;
        pages.set(rm[1] + '/' + pm[1], { name: data.displayName || pm[1], hidden: /hidden/i.test(data.visibility || ''), tooltip: type === 'tooltip' || /tooltip/i.test(data.type || ''), drill: type === 'drillthrough', order: 0 });
      }
      if (/\/pages\/pages\.json$/i.test(path) && Array.isArray(data.pageOrder)) data.pageOrder.forEach((id, i) => { const p = pages.get(rm[1] + '/' + id); if (p) p.order = i; else pages.set(rm[1] + '/' + id, { order: i, pending: true }); });
      if (/\/visuals\/[^\/]+\/visual\.json$/i.test(path)) countVisual(data, visualType(data));
      if (/\.Report\/report\.json$/i.test(path) && Array.isArray(data.sections)) data.sections.forEach((sec, i) => {
        let cfg = {}; try { cfg = JSON.parse(sec.config || '{}'); } catch (e) {}
        const tooltip = sec.displayOption === 3 || /tooltip/i.test(JSON.stringify(cfg.type || ''));
        const dr = /drillthrough/i.test(JSON.stringify(cfg.filterSortOrder || '')) || !!(cfg.pageBinding || cfg.drillthrough) || /"type":\s*"?Drillthrough/i.test(sec.config || '');
        if (dr) drill = true;
        pages.set(rm[1] + '#' + i, { name: sec.displayName || 'Page ' + (i + 1), hidden: cfg.visibility === 1, tooltip, drill: dr, order: i });
        (sec.visualContainers || []).forEach(vc => { let c = {}; try { c = JSON.parse(vc.config || '{}'); } catch (e) {} countVisual(c, visualType(c)); });
      });
    }
    // merge pageOrder placeholders
    const list = [...pages.values()].filter(p => !p.pending || p.name);
    pages.forEach((p, k) => { if (p.pending && !p.name) pages.delete(k); });
    const shown = list.filter(p => p.name && !p.hidden && !p.tooltip && !p.drill).sort((a, b) => a.order - b.order);
    return { reports: [...reports].sort(), pages: shown.map(p => p.name), allPages: list.length, drill, visuals, counts, slicers: [...slicerFields] };
  }

  /* ---------- drafts ---------- */
  const AUDIENCES = [
    ['Executives', /./], ['Sales managers', /sales|revenue|order|quota|pipeline|opportunit/i], ['Account managers', /customer|account|client/i],
    ['Finance team', /budget|cost|profit|margin|finance|forecast|spend|expense|revenue/i], ['Operations', /inventory|stock|warehouse|shipment|delivery|supplier|production|order/i],
    ['Product managers', /product|category|sku|brand/i], ['Marketing team', /campaign|marketing|lead|channel|web|session/i],
    ['HR business partners', /employee|headcount|hire|attrition|staff|hr\b/i], ['Regional managers', /region|territory|country|store|branch/i], ['Analysts', /./]
  ];
  function audienceSuggestions(model){
    const words = model ? model.tables.map(t => t.name).concat(model.measures.map(m => m.name), model.columns.filter(c => !c.hidden).map(c => c.name)).join(' ') : '';
    return AUDIENCES.filter(a => a[1].test(words)).map(a => a[0]);
  }
  const TARGET = /target|budget|goal|plan|forecast|quota/i;

  function context(st){
    const model = st.model, rep = st.report;
    const name = (st.basics.name || '').trim() || (rep && rep.reports[0]) || '';
    const kp = st.kpiList.filter(k => k.on);
    const kNames = kp.map(k => k.label || k.name);
    const bd = model ? breakdowns(model) : { terms: [], hasDate: false };
    const aud = (st.basics.audience || []).slice();
    const targets = model ? model.measures.filter(m => TARGET.test(m.name) && !m.hidden).map(m => m.name) : [];
    return { name, kNames, kp, bd, aud, targets, model, rep, basics: st.basics, sources: st.sourceList.filter(s => s.on) };
  }
  const reportRef = c => c.name ? 'the ' + c.name + ' report' : 'this report';
  const reportRefCap = c => c.name ? 'The ' + c.name + ' report' : 'This report';
  const kPhrase = (c, n) => listJoin(c.kNames.slice(0, n || 3).map(k => lower(k)));
  const dPhrase = (c, n) => listJoin(c.bd.terms.slice(0, n || 3).map(t => plural(lower(t))));

  const DRAFTS = {
    summary: c => {
      const k = kPhrase(c), d = dPhrase(c);
      const a = reportRefCap(c) + ' gives one view of ' + (k || 'the key numbers') + (d ? ' by ' + d : '') + (c.bd.hasDate ? ', and how they change over time' : '') + '.';
      const b = 'Use ' + reportRef(c) + ' to see how ' + (k || 'the business') + ' ' + (k ? 'are' : 'is') + ' tracking' + (c.targets.length ? ' against ' + lower(c.targets[0]).replace(/^(total|sum of)\s+/, '') : '') + (d ? ' and which ' + dPhrase(c, 2) + ' drive the results' : '') + '.';
      const s = c.sources.map(x => x.label.replace(/\s*\(.*\)$/, ''));
      const cc = reportRefCap(c) + ' brings ' + (s.length ? listJoin(s.slice(0, 3)) + ' data' : 'data from across the business') + ' together to show ' + (k || 'performance') + (d ? ' by ' + dPhrase(c, 2) : '') + '.';
      return [a, b, cc];
    },
    value: c => {
      const who = c.aud.length ? listJoin(c.aud.map(lower)) : 'readers';
      const k1 = c.kNames[0] ? lower(c.kNames[0]) : 'performance';
      return [
        'Helps ' + who + ' spot where ' + k1 + ' is falling behind' + (c.bd.terms[0] ? ', and which ' + plural(lower(c.bd.terms[0])) + ' need attention' : '') + ', so they can act sooner.',
        'Gives ' + who + ' one trusted place to track ' + (kPhrase(c) || 'the key numbers') + ', instead of pulling figures from separate files.',
        'Saves time on routine reporting: the numbers ' + (c.basics.freq && c.basics.freq !== 'live' ? 'refresh ' + freqWord(c.basics.freq) : 'update') + ' with no manual work.'
      ];
    },
    audience: c => {
      const a = c.aud.map(lower);
      return a.length ? ['Built for ' + listJoin(a) + '.', 'For ' + listJoin(a) + ' who need a quick read on ' + (kPhrase(c, 2) || 'performance') + '.'] : ['Built for (add who reads this report, for example sales managers and the finance team).'];
    },
    questions: c => {
      const q = [], k1 = c.kNames[0] ? lower(c.kNames[0]) : '', k2 = c.kNames[1] ? lower(c.kNames[1]) : '';
      if (k1 && c.targets.length) q.push('Are we on track against ' + lower(c.targets[0]).replace(/^(total|sum of)\s+/, '') + '?');
      if (k1 && c.bd.hasDate) q.push('How is ' + k1 + ' changing over time, and how does it compare with last year?');
      c.bd.terms.slice(0, 2).forEach((t, i) => { if (k1) q.push('Which ' + plural(lower(t)) + ' contribute most to ' + (i === 1 && k2 ? k2 : k1) + '?'); });
      if (k2 && c.bd.terms[2]) q.push('How does ' + k2 + ' compare across ' + plural(lower(c.bd.terms[2])) + '?');
      if (c.bd.hasDate) q.push('What changed since last month?');
      if (c.bd.terms.length) q.push('Where are we falling behind, and where are we doing well?');
      return q;
    },
    howto: c => {
      const t = [];
      if (c.rep && c.rep.pages.length > 1) t.push('Pages: ' + listJoin(c.rep.pages) + '.');
      const sl = c.rep ? c.rep.slicers.slice(0, 4) : [];
      t.push(sl.length ? 'Use the slicers to filter by ' + listJoin(sl.map(lower)) + '.' : 'Use the slicers to filter every visual on the page.');
      t.push('Hover over any chart to see exact values.');
      t.push('Select a bar or point to filter the rest of the page; select it again to clear.');
      t.push('Right-click a bar or row and choose Drill through to see the records behind it.');
      t.push('Use the reset button to clear all filters.');
      t.push('Export a table to Excel from its More options (…) menu.');
      return t;
    },
    freshness: c => {
      const f = c.basics.freq, time = (c.basics.time || '').trim();
      if (f === 'live') return ['Data is live: figures update when you open or interact with the report.'];
      if (!f) return ['Data refreshes (add how often, for example daily at 6:00 AM).'];
      return ['Data refreshes ' + freqWord(f) + (time ? ' at ' + time : '') + '.', 'Figures are refreshed ' + freqWord(f) + (time ? ' at ' + time : '') + '; the date on each page shows the latest refresh.'];
    },
    notes: c => {
      const n = [];
      if (!c.model) return n;
      const vis = c.model.columns.filter(col => !col.hidden && col.description && !/^(id|key)$/i.test(col.name));
      vis.slice(0, 6).forEach(col => n.push(col.name + ': ' + col.description.replace(/\.?\s*$/, '.')));
      const fmts = c.kp.map(k => k.measure.formatString || '').join(' ');
      if (/\\?\$/.test(fmts)) n.push('Amounts are shown in dollars ($).');
      else if (/£/.test(fmts)) n.push('Amounts are shown in pounds (£).');
      else if (/€/.test(fmts)) n.push('Amounts are shown in euros (€).');
      if (c.model.columns.some(col => /fiscal/i.test(col.name) && !col.hidden) && !vis.some(col => /fiscal/i.test(col.name))) n.push('Fiscal year starts (add the month).');
      return n;
    },
    owner: c => {
      const o = (c.basics.owner || '').trim(), ct = (c.basics.contact || '').trim();
      if (!o && !ct) return ['Owner: (add a person or team). Questions or change requests: (add an email or Teams channel).'];
      return [(o ? 'Owned by ' + o + '. ' : '') + (ct ? 'Questions or change requests: ' + ct + '.' : ''), (o ? o + ' looks after this report. ' : '') + (ct ? 'Contact ' + ct + ' with questions or to request a change.' : '')].map(s => s.trim());
    }
  };
  function freqWord(f){ return ({ hourly: 'every hour', intraday: 'several times a day', daily: 'every day', weekday: 'every weekday', weekly: 'every week', monthly: 'every month', manual: 'on request' })[f] || f; }
  // which list suggestions are ticked by default
  function defaultPick(id, text, c, i){
    if (id === 'questions') return i < 4;
    if (id === 'howto') return /^Pages:|slicers|Hover/.test(text) || (/Drill through/.test(text) && !!(c.rep && c.rep.drill));
    if (id === 'notes') return !/\(add/.test(text);
    return true;
  }

  /* ---------- compose the final text ---------- */
  function compose(st){
    const c = context(st), out = [];
    SECTIONS.forEach(s => {
      const sec = st.sec[s.id]; if (!sec || !sec.on) return;
      const title = (sec.title || '').trim() || s.title;
      if (s.kind === 'text') { const t = (sec.text != null ? sec.text : (DRAFTS[s.id](c)[0] || '')).trim(); if (t) out.push({ id: s.id, title, kind: 'text', text: t }); }
      else if (s.kind === 'list') { const items = listItems(st, s.id, c); if (items.length) out.push({ id: s.id, title, kind: 'list', items }); }
      else if (s.kind === 'kpis') { const items = c.kp.map(k => ({ name: (k.label || k.name).trim(), text: (k.meaning || '').trim() })).filter(x => x.name); if (items.length) out.push({ id: s.id, title, kind: 'kpis', items }); }
      else if (s.kind === 'sources') { const items = c.sources.map(x => ({ name: x.label.trim(), text: st.showCovers ? (x.covers || '').trim() : '' })).filter(x => x.name); if (items.length) out.push({ id: s.id, title, kind: 'sources', items }); }
    });
    return { name: c.name, sections: out };
  }
  function listItems(st, id, c){
    const sec = st.sec[id];
    if (sec.text != null) return sec.text.split('\n').map(x => x.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean);
    c = c || context(st);
    return DRAFTS[id](c).filter((t, i) => defaultPick(id, t, c, i));
  }

  function toText(doc){
    const L = [];
    if (doc.name) L.push(doc.name, '');
    doc.sections.forEach(s => {
      L.push(s.title.toUpperCase());
      if (s.kind === 'text') L.push(s.text);
      else if (s.kind === 'list') s.items.forEach(i => L.push('• ' + i));
      else s.items.forEach(i => L.push('• ' + i.name + (i.text ? ': ' + i.text : '')));
      L.push('');
    });
    return L.join('\n').trim() + '\n';
  }
  function toMarkdown(doc){
    const L = [];
    if (doc.name) L.push('# ' + doc.name, '');
    const md = s => s.replace(/([*_`\\])/g, '\\$1');
    doc.sections.forEach(s => {
      L.push('## ' + md(s.title), '');
      if (s.kind === 'text') L.push(md(s.text));
      else if (s.kind === 'list') s.items.forEach(i => L.push('- ' + md(i)));
      else s.items.forEach(i => L.push('- **' + md(i.name) + '**' + (i.text ? ': ' + md(i.text) : '')));
      L.push('');
    });
    return L.join('\n').trim() + '\n';
  }

  /* ---------- optional HTML measure (for an HTML content visual) ---------- */
  const CHIPS = [['#E8EEF7', '#1F3A5F'], ['#EEE8F7', '#4B2E83'], ['#E2F1F3', '#0F5E66'], ['#E6F0FA', '#1D5B94'], ['#F0ECF8', '#5B3E96']];
  function tint(hex, a){
    const h = (hex || '#1F3A5F').replace('#', ''); if (!/^[0-9a-f]{6}$/i.test(h)) return '#EEF2F7';
    const c = [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)).map(v => Math.round(255 - (255 - v) * a));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  // returns an array of HTML chunks; a chunk of { dax } is a DAX expression (the last refresh)
  function htmlParts(doc, o){
    o = Object.assign({ font: 16, accent: '#1F3A5F', family: 'Segoe UI', refresh: '', refreshFmt: 'd mmm yyyy h:mm AM/PM', chips: true, title: true }, o || {});
    const A = o.accent, fs = +o.font || 16, parts = [];
    const H = t => "<div style='font-weight:700;color:" + A + ";margin:" + Math.round(fs * 1.1) + "px 0 6px;font-size:" + Math.round(fs * 1.05) + "px;'>" + escH(t) + '</div>';
    parts.push("<div style='font-family:" + escH(o.family.replace(/["';]/g, '')) + ",sans-serif;font-size:" + fs + "px;line-height:1.45;color:#1F2937;box-sizing:border-box;padding:4px 6px;'>");
    if (o.title && doc.name) parts.push("<div style='font-size:" + Math.round(fs * 1.4) + "px;font-weight:700;color:" + A + ";margin:0 0 4px;'>" + escH(doc.name) + '</div>');
    doc.sections.forEach((s, si) => {
      if (s.id === 'value' && s.kind === 'text') { parts.push("<div style='background:" + tint(A, .08) + ";border-left:4px solid " + A + ";border-radius:8px;padding:10px 12px;margin:" + Math.round(fs * .9) + "px 0 4px;'><b style='color:" + A + ";'>" + escH(s.title) + ':</b> ' + escH(s.text) + '</div>'); return; }
      parts.push(si === 0 && !(o.title && doc.name) ? H(s.title).replace(/margin:\d+px/, 'margin:0') : H(s.title));
      if (s.kind === 'text') {
        if (s.id === 'freshness' && o.refresh) { parts.push("<div>" + escH(s.text) + " <span style='color:#6B7280;'>Last refreshed: "); parts.push({ dax: 'FORMAT ( ' + bracket(o.refresh) + ', "' + o.refreshFmt.replace(/"/g, '""') + '" )' }); parts.push('</span></div>'); }
        else parts.push('<div>' + escH(s.text) + '</div>');
      } else if (s.kind === 'list') parts.push("<ul style='margin:0;padding-left:" + Math.round(fs * 1.2) + "px;'>" + s.items.map(i => "<li style='margin:0 0 4px;'>" + escH(i) + '</li>').join('') + '</ul>');
      else if (s.kind === 'sources' && o.chips) parts.push("<div style='display:flex;flex-wrap:wrap;gap:6px;'>" + s.items.map((i, k) => "<span style='background:" + CHIPS[k % CHIPS.length][0] + ';color:' + CHIPS[k % CHIPS.length][1] + ";padding:3px 10px;border-radius:12px;'>" + escH(i.name) + (i.text ? " <span style='opacity:.75;'>· " + escH(i.text) + '</span>' : '') + '</span>').join('') + '</div>');
      else parts.push("<ul style='margin:0;padding-left:" + Math.round(fs * 1.2) + "px;'>" + s.items.map(i => "<li style='margin:0 0 4px;'><b>" + escH(i.name) + '</b>' + (i.text ? ': ' + escH(i.text) : '') + '</li>').join('') + '</ul>');
    });
    parts.push('</div>');
    return parts;
  }
  function toHtml(doc, o){ return htmlParts(doc, o).map(p => typeof p === 'string' ? p : '<i>(last refresh)</i>').join(''); }
  function daxExpr(doc, o){
    const parts = htmlParts(doc, o), out = []; let buf = '';
    const flush = () => { if (buf) out.push('"' + buf.replace(/"/g, '""') + '"'); buf = ''; };
    parts.forEach(p => { if (typeof p === 'string') { buf += p; if (/^<(div style='font-weight|ul|div style='background)/.test(p) || buf.length > 600) flush(); } else { flush(); out.push(p.dax); } });
    flush();
    return out.join(' &\n');
  }
  function tmdl(doc, o){
    return toTmdl([{ name: (o.name || 'About This Report HTML').trim(), expression: daxExpr(doc, o), description: 'HTML for an HTML content visual. Generated from the About This Report page; edit the text there and regenerate.' }], { mode: 'script', targetTable: o.table || '_Measures', folder: o.folder || '' });
  }

  /* ---------- optional Copilot polish ---------- */
  function prompt(st){
    const c = context(st), ctx = {
      report_name: c.name || '(not given)',
      audience: c.aud,
      pages: c.rep ? c.rep.pages : [],
      key_measures: c.kp.map(k => ({ name: k.label || k.name, meaning: k.meaning || '' })),
      things_readers_slice_by: c.bd.terms,
      covers_time: c.bd.hasDate,
      data_sources: c.sources.map(s => s.label),
      refresh: c.basics.freq ? (c.basics.freq === 'live' ? 'live' : freqWord(c.basics.freq)) : '',
      notes: listItems(st, 'notes', c)
    };
    return [
      'You are helping write the "About this report" text for a Power BI report. Readers are business users, not developers.',
      '',
      'Rules:',
      '- Use only the facts in the JSON below. Do not invent numbers, targets, results, owners or data sources.',
      '- Plain language. No DAX, no table or column names in brackets, no technical details apart from the data source names given.',
      '- Refer to key measures by the names given. Do not add measures that are not listed.',
      '- If something needed for a good summary is missing (for example the audience or the business goal), list it under evidence_gaps instead of guessing.',
      '- Keep report_summary to one or two sentences and business_value to one sentence. Give three to five key_questions.',
      '- Reply with JSON only, no code fences, in exactly this shape:',
      '{"report_summary": "", "business_value": "", "audience": "", "key_questions": [""], "measure_meanings": {"<measure name>": ""}, "evidence_gaps": [""]}',
      '',
      'Report facts:',
      JSON.stringify(ctx, null, 2)
    ].join('\n');
  }
  const TECH = /\b(CALCULATE|SUMX|FILTER|DIVIDE|SELECTEDVALUE|DAX|measure table|semantic model|TMDL|M query|Power Query)\b|'[^']+'\[[^\]]+\]|\w\[[^\]]+\]/;
  function parseReply(text, st){
    const c = context(st);
    let t = (text || '').trim().replace(/^```(?:json)?\s*|```\s*$/g, '');
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b < a) return { error: 'No JSON was found in the reply. Ask Copilot to reply with the JSON only, then paste it again.' };
    let j; try { j = JSON.parse(t.slice(a, b + 1)); } catch (e) { try { j = JSON.parse(repairJson(t.slice(a, b + 1))); } catch (e2) { return { error: 'The reply isn’t valid JSON (' + e.message + '). Paste the whole reply, from the first { to the last }.' }; } }
    const str = v => typeof v === 'string' ? v.trim() : '';
    const arr = v => Array.isArray(v) ? v.map(str).filter(Boolean) : [];
    const warns = [];
    const out = { summary: str(j.report_summary), value: str(j.business_value), audience: str(j.audience), questions: arr(j.key_questions), meanings: {}, gaps: arr(j.evidence_gaps) };
    const names = new Map(c.kp.map(k => [lcs(k.label || k.name), k.name]));
    const mm = j.measure_meanings && typeof j.measure_meanings === 'object' ? j.measure_meanings : {};
    Object.keys(mm).forEach(k => { const n = names.get(lcs(k)); if (n) { if (str(mm[k])) out.meanings[n] = str(mm[k]); } else warns.push('“' + k + '” isn’t one of your key measures, so its meaning was left out.'); });
    [['summary', 'The summary'], ['value', 'The business value'], ['audience', 'The audience']].forEach(([k, l]) => { if (out[k] && TECH.test(out[k])) warns.push(l + ' mentions technical details (DAX or column names). Edit it before you use it.'); });
    out.questions.forEach(q => { if (TECH.test(q)) warns.push('A question mentions technical details: “' + q + '”.'); });
    if (/\d{2,}[%$£€kKmM]|\$\s?\d/.test(out.summary + ' ' + out.value)) warns.push('The reply quotes figures. The report’s numbers change, so check them or take them out.');
    return { reply: out, warns };
  }

  return { SECTIONS, parse, roles, breakdowns, kpis, meaning, SOURCES_QUERY, parseSourcesQuery, parseTmdl, detect, modelOnlySources, scan, readReport,
    audienceSuggestions, context, DRAFTS, defaultPick, compose, listItems, toText, toMarkdown, toHtml, daxExpr, tmdl, prompt, parseReply, plural, freqWord };
})();
