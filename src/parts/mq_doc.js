
/* ---------- whole model: business-friendly explanation ---------- */
const CONNECTOR_NAMES = {
  'Sql.Database': 'SQL Server database', 'Sql.Databases': 'SQL Server', 'Oracle.Database': 'Oracle database', 'PostgreSQL.Database': 'PostgreSQL database',
  'MySQL.Database': 'MySQL database', 'Snowflake.Databases': 'Snowflake', 'GoogleBigQuery.Database': 'Google BigQuery', 'AmazonRedshift.Database': 'Amazon Redshift',
  'Teradata.Database': 'Teradata database', 'Databricks.Catalogs': 'Databricks', 'Odbc.Query': 'ODBC data source', 'Odbc.DataSource': 'ODBC data source',
  'OleDb.DataSource': 'OLE DB data source', 'AzureDataExplorer.Contents': 'Azure Data Explorer', 'AnalysisServices.Database': 'Analysis Services model',
  'Access.Database': 'Access database', 'Excel.Workbook': 'Excel workbook', 'Csv.Document': 'CSV file', 'Json.Document': 'JSON file', 'Xml.Tables': 'XML file',
  'Pdf.Tables': 'PDF file', 'Folder.Files': 'Folder of files', 'Folder.Contents': 'Folder of files', 'SharePoint.Files': 'SharePoint site',
  'SharePoint.Contents': 'SharePoint site', 'SharePoint.Tables': 'SharePoint list', 'Web.Contents': 'Web address', 'Web.Page': 'Web page', 'OData.Feed': 'OData feed',
  'Lakehouse.Contents': 'Fabric lakehouse', 'PowerPlatform.Dataflows': 'Dataflow', 'PowerBI.Dataflows': 'Dataflow', 'Salesforce.Data': 'Salesforce',
  'Salesforce.Reports': 'Salesforce reports', 'Dataverse.Contents': 'Dataverse', 'CommonDataService.Database': 'Dataverse'
};
const CONNECTOR_RE = new RegExp('\\b(' + Object.keys(CONNECTOR_NAMES).map(k => k.replace('.', '\\.')).join('|') + ')\\s*\\(');
function placeKind(v){
  if (/^[A-Za-z]:\\Users\\[^\\]+\\/i.test(v)) return { where: 'a personal folder on one computer', personal: true };
  if (/^[A-Za-z]:\\/.test(v)) return { where: 'a drive on one computer', personal: true };
  if (/^\\\\/.test(v)) return { where: 'a shared network folder', personal: false };
  if (/sharepoint\.com/i.test(v)) return { where: 'SharePoint', personal: false };
  if (/^https?:\/\//i.test(v)) return { where: 'a web address', personal: false };
  return { where: '', personal: false };
}
const fileName = v => v.replace(/[\\\/]+$/, '').split(/[\\\/]/).pop();
const quoteName = s => '“' + s + '”';
// the value a parameter holds, readable: #date(2024, 2, 1) -> 2024-02-01
function paramDisplay(it){
  const s = stripMComments(it.code).replace(/\s+meta\s*\[[\s\S]*$/, '').trim();
  if (/^"([^"]|"")*"$/.test(s)) return s.slice(1, -1).replace(/""/g, '"');
  const d = /^#date\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(s);
  if (d) return d[1] + '-' + d[2].padStart(2, '0') + '-' + d[3].padStart(2, '0');
  return s;
}
// Where one query reads its own data: [{ label, where, personal }]
function querySources(it, byName){
  const out = [];
  if (!it.q) return out;
  const params = [...byName.values()].filter(x => x.type === 'parameter');
  it.q.steps.forEach(s => {
    const m = CONNECTOR_NAMES[s.fn] ? [null, s.fn] : CONNECTOR_RE.exec(s.expr);
    if (!m) return;
    const fn = m[1], kind = CONNECTOR_NAMES[fn];
    // values typed in the step, or held by a parameter the step uses, in the order they appear
    const pv = new Map(params.map(p => [p.name, p])), tk = mTokenize(s.expr), vals = [];
    if (!tk.error) tk.toks.forEach(t => {
      if (t.t === 'str') vals.push(t.v.slice(1, -1).replace(/""/g, '"'));
      else if ((t.t === 'id' || t.t === 'qid') && pv.has(t.t === 'qid' ? qidName(t.v) : t.v)) vals.push(paramDisplay(pv.get(t.t === 'qid' ? qidName(t.v) : t.v)));
    });
    if (DB_SOURCES.test(fn) || /^(AnalysisServices|Lakehouse|Dataverse|CommonDataService)/.test(fn)) {
      const db = vals[1], srv = vals[0];
      out.push({ label: kind + (db ? ' ' + quoteName(db) : ''), where: srv ? 'server ' + srv : '', personal: false });
    } else {
      const path = vals.find(v => /^[A-Za-z]:\\|^\\\\|^https?:\/\//i.test(v)) || vals.find(v => /\.\w{2,5}$/.test(v)) || '';
      const pk = placeKind(path);
      const nm = path ? fileName(path) : '';
      out.push({ label: kind + (nm && !/^https?:/i.test(path) ? ' ' + quoteName(nm) : ''), where: pk.where || (/^https?:/i.test(path) ? path : ''), personal: pk.personal });
    }
  });
  const seen = new Set();
  return out.filter(x => { const k = x.label + '|' + x.where; if (seen.has(k)) return false; seen.add(k); return true; });
}
// Every source behind a table, following the queries it uses: [{ label, where, personal, via }]
function tableSources(it, byName){
  const out = [], done = new Set();
  const walk = (x, via) => {
    if (done.has(x.name)) return; done.add(x.name);
    querySources(x, byName).forEach(s => out.push(Object.assign({ via }, s)));
    x.deps.forEach(d => { const y = byName.get(d); if (y && y.type !== 'function' && y.type !== 'parameter') walk(y, y.type === 'table' ? d : (via || d)); });
  };
  walk(it, '');
  const seen = new Set();
  return out.filter(x => { const k = x.label + '|' + x.where; if (seen.has(k)) return false; seen.add(k); return true; });
}
// A plain phrase for a step, used when Copilot hasn't written one. '' = leave it out (technical only).
function plainStep(s, deps){
  const cols = [...s.expr.matchAll(/\[([^\]]+)\]/g)].map(m => m[1].replace(/^#"(.*)"$/, '$1')).filter((v, i, a) => a.indexOf(v) === i && !/=/.test(v));
  const list = a => a.slice(0, 5).join(', ') + (a.length > 5 ? ' and ' + (a.length - 5) + ' more' : '');
  const str = s.strings;
  switch (s.fn) {
    case 'Table.SelectRows': return 'Keeps only some rows' + (cols.length ? ', based on ' + list(cols) : '') + '.';
    case 'Table.RemoveColumns': return 'Leaves out ' + (str.length ? 'these columns: ' + list(str) : 'some columns') + '.';
    case 'Table.SelectColumns': return 'Keeps only ' + (str.length ? 'these columns: ' + list(str) : 'some columns') + '.';
    case 'Table.RenameColumns': { const p = []; for (let i = 0; i + 1 < str.length; i += 2) p.push(str[i] + ' to ' + str[i + 1]); return 'Renames ' + (p.length ? list(p) : 'columns') + '.'; }
    case 'Table.AddColumn': return 'Adds a column' + (str[0] ? ' ' + quoteName(str[0]) : '') + (cols.length ? ', worked out from ' + list(cols) : '') + '.';
    case 'Table.NestedJoin': case 'Table.Join': case 'Table.FuzzyNestedJoin': { const d = (deps || []).find(n => s.expr.includes(n)); return 'Looks up matching details from ' + (d ? quoteName(d) : 'another table') + '.'; }
    case 'Table.ExpandTableColumn': case 'Table.ExpandRecordColumn': return 'Brings in ' + (str.length > 1 ? list(str.slice(1).filter((v, i, a) => a.indexOf(v) === i)) : 'columns') + ' from the looked-up data.';
    case 'Table.Combine': return 'Stacks rows from several sources into one table.';
    case 'Table.Group': return 'Groups rows and works out totals' + (str.length ? ' by ' + list(str.slice(0, 2)) : '') + '.';
    case 'Table.Distinct': return 'Removes duplicate rows.';
    case 'Table.ReplaceValue': return 'Replaces some values' + (str.length ? ' in ' + list(str.filter(v => v).slice(-1)) : '') + '.';
    case 'Table.FillDown': return 'Fills blank cells with the value above.';
    case 'Table.FillUp': return 'Fills blank cells with the value below.';
    case 'Table.UnpivotOtherColumns': case 'Table.Unpivot': return 'Turns columns into rows, so each value gets its own row.';
    case 'Table.Pivot': return 'Turns rows into columns.';
    case 'Table.Skip': case 'Table.RemoveFirstN': return 'Leaves out the first rows.';
    case 'Table.FirstN': return 'Keeps only the first rows.';
    case 'Table.RemoveLastN': return 'Leaves out the last rows.';
    case 'Table.RemoveRowsWithErrors': return 'Leaves out rows with errors.';
    case 'Table.ReplaceErrorValues': return 'Replaces errors with a fixed value.';
    case 'Table.TransformColumns': return 'Tidies the values in ' + (str.length ? list(str) : 'some columns') + '.';
    case 'Table.SplitColumn': return 'Splits ' + (str[0] ? quoteName(str[0]) : 'a column') + ' into several columns.';
    case 'Table.CombineColumns': return 'Joins several columns into one.';
    case 'Table.AddIndexColumn': return 'Numbers the rows.';
    case 'Table.AddFuzzyClusterColumn': return 'Groups similar values together.';
    default: return '';
  }
}

function businessPrompt(batch, o){
  const opts = Object.assign({ title: '' }, o || {});
  const L = [];
  L.push('You are writing a plain-language guide to how a Power BI model prepares its data, for business readers who use the reports but don’t work in Power BI.');
  L.push('');
  L.push('## TASK');
  L.push('For each table under STARTING POINT, explain in plain words what data it holds, where it comes from, and what is done to it before it reaches the reports.');
  L.push('');
  L.push('## CONTEXT');
  if (opts.title) L.push('- Model or report: ' + opts.title);
  L.push('- The readers know the business, not the tools. They want to know what the numbers include, what they leave out, and where they come from.');
  L.push('- Each table’s Power Query code is under STARTING POINT, with the sources read from the code and the other queries and settings it uses.');
  L.push('');
  L.push('## RULES');
  L.push('- Write for someone who has never opened Power BI Desktop. No code, function names or step names, and no terms like query, M, merge, join, data type, null or schema. Say “blank” for null, and “looked up from” or “combined with” for merges.');
  L.push('- Name the real columns, values and conditions from the code where they change what the numbers include: which rows are left out, how a value is worked out, what is combined.');
  L.push('- Leave out purely technical steps: setting types, using the first row as headers, reordering and sorting. Mention a rename only if readers would look for the old name.');
  L.push('- Don’t invent business reasons the code doesn’t show. If the reason for a rule isn’t clear, say what it does and add a CHECK line asking the data owner to confirm it.');
  L.push('- For files, give the file name and the kind of place (a personal folder, a shared folder, SharePoint), not the full path.');
  L.push('- Short sentences. PURPOSE: one or two sentences. ROW: one sentence. STEPS: two to six lines, one change each.');
  L.push('');
  L.push('## REPLY FORMAT (a template: replace the placeholder text with your answer)');
  L.push('Put your ENTIRE answer inside ONE code block. Write nothing before or after the code block. One TABLE block per table, using each table name exactly as given:');
  L.push('');
  L.push('@@@ TABLE @@@');
  L.push('TABLE: Table name');
  L.push('PURPOSE: What this table is for in the reports.');
  L.push('SOURCE: Where the data comes from, in plain words.');
  L.push('ROW: What one row stands for.');
  L.push('STEPS:');
  L.push('- One line for each change that matters to the numbers.');
  L.push('CHECK: Only if readers or the data owner should know or confirm something.');
  L.push('@@@ END @@@');
  batch.forEach((b, i) => {
    L.push('');
    L.push('## STARTING POINT: table ' + (i + 1) + ': ' + b.name);
    if (b.sources.length) L.push('Data read from: ' + b.sources.join('; '));
    if (b.uses.length) L.push('Uses: ' + b.uses.join('; '));
    L.push('Code:');
    L.push(b.code.trim());
  });
  L.push('');
  L.push('=== END OF PROMPT ===');
  return L.join('\n');
}
function parseBusiness(text){
  const t = cleanReply(text).replace(/[‘’]/g, "'");
  const res = { tables: [], error: null };
  if (!t.trim()) return res;
  const L = ['TABLE', 'PURPOSE', 'SOURCE', 'ROW', 'STEPS', 'CHECK'];
  // skip the reply template, in case Copilot repeats it
  answerBlocks(t).filter(b => b.kind === 'TABLE' && !b.body.includes('TABLE: Table name')).forEach(b => {
    const table = field(b.body, 'TABLE', L).replace(/^'(.*)'$/s, '$1').replace(/^"(.*)"$/s, '$1').trim();
    const steps = field(b.body, 'STEPS', L).split('\n').map(l => oneLine(l.replace(/^\s*(?:[-*•–]|\d+[.)])\s*/, ''))).filter(Boolean);
    const r = { table, purpose: oneLine(field(b.body, 'PURPOSE', L)), source: oneLine(field(b.body, 'SOURCE', L)), row: oneLine(field(b.body, 'ROW', L)), steps, check: oneLine(field(b.body, 'CHECK', L)) };
    if (/^only if\b/i.test(r.check) || /^(none|n\/a|-)\.?$/i.test(r.check)) r.check = '';
    if (r.purpose || r.source || r.steps.length) res.tables.push(r);
  });
  if (!res.tables.length) res.error = 'No @@@ TABLE @@@ blocks were found. Make sure Copilot answered inside one code block, and paste its whole answer.';
  return res;
}

/* ----- the document: a list of blocks, written out as a web page or a Word file ----- */
// opts: { title, date, biz: name -> Copilot block, comments: name -> [{ name, comment }] or null, behind: bool }
function businessDoc(m, opts){
  const o = Object.assign({ title: '', date: '', biz: {}, comments: null, behind: true }, opts || {});
  const byName = new Map(m.items.map(i => [i.name, i]));
  const tables = m.items.filter(i => i.type === 'table');
  const params = m.items.filter(i => i.type === 'parameter');
  const helpers = m.items.filter(i => i.type === 'query' || i.type === 'function');
  const title = o.title.trim() || 'this model';
  const D = [];
  D.push({ t: 'title', text: 'How the data in ' + title + ' is prepared' });
  D.push({ t: 'sub', text: 'A plain-language guide for people who use the reports: where the data comes from and what is done to it before you see it.' + (o.date ? ' ' + o.date + '.' : '') });

  // sources across the model
  const srcMap = new Map();
  tables.forEach(t => tableSources(t, byName).forEach(s => {
    const k = s.label + '|' + s.where;
    if (!srcMap.has(k)) srcMap.set(k, { label: s.label, where: s.where, personal: s.personal, used: [] });
    if (!srcMap.get(k).used.includes(t.name)) srcMap.get(k).used.push(t.name);
  }));
  D.push({ t: 'h1', text: 'In short' });
  D.push({ t: 'p', text: 'The reports use ' + tables.length + ' table' + (tables.length === 1 ? '' : 's') + (srcMap.size ? ', filled from ' + srcMap.size + ' data source' + (srcMap.size === 1 ? '' : 's') : '') + '. Each time the data is refreshed, Power BI reads the sources again and repeats the same preparation steps, so the reports always follow the rules described here.' });
  if (srcMap.size) D.push({ t: 'table', head: ['Data source', 'Where it is', 'Used for'], rows: [...srcMap.values()].map(s => [s.label, s.where || '–', s.used.join(', ')]) });

  D.push({ t: 'h1', text: 'The tables' });
  tables.forEach(t => {
    const b = o.biz[t.name];
    D.push({ t: 'h2', text: t.name });
    if (b && b.purpose) D.push({ t: 'p', text: b.purpose });
    const srcs = tableSources(t, byName);
    const srcText = b && b.source ? b.source : srcs.length ? srcs.map(s => s.label + (s.where ? ' (' + s.where + ')' : '') + (s.via ? ', through ' + s.via : '')).join('; ') + '.' : '';
    if (srcText) D.push({ t: 'p', label: 'Where the data comes from', text: srcText });
    if (b && b.row) D.push({ t: 'p', label: 'One row is', text: b.row });
    const steps = b && b.steps.length ? b.steps : t.q ? t.q.steps.map(s => plainStep(s, t.deps)).filter((v, i, a) => v && a.indexOf(v) === i) : [];
    if (steps.length) { D.push({ t: 'h3', text: 'What is done to the data' }); D.push({ t: 'ul', items: steps }); }
    const know = [];
    if (b && b.check) know.push(b.check);
    srcs.filter(s => s.personal).forEach(s => know.push(s.label + ' is in ' + s.where + ', so the data can only be refreshed where that file is.'));
    if (know.length) { D.push({ t: 'h3', text: 'Worth knowing' }); D.push({ t: 'ul', items: know }); }
    const cm = o.comments && o.comments[t.name];
    if (cm && cm.length) { D.push({ t: 'h3', text: 'Step by step' }); D.push({ t: 'ol', items: cm.map(c => c.comment) }); }
    if (!b) D.push({ t: 'note', text: 'Read from the code. No plain-language description has been added for this table yet.' });
  });

  if (o.behind && params.length) {
    D.push({ t: 'h1', text: 'Settings' });
    D.push({ t: 'p', text: 'These values are stored once in the model and used by the tables, so they can be changed in one place.' });
    D.push({ t: 'table', head: ['Setting', 'Current value', 'Used by'], rows: params.map(p => [p.name, paramDisplay(p) || '–', p.usedBy.join(', ') || 'Nothing yet']) });
  }
  if (o.behind && helpers.length) {
    D.push({ t: 'h1', text: 'Behind the scenes' });
    D.push({ t: 'p', text: 'These are preparation steps that don’t appear in the reports themselves but feed the tables above.' });
    D.push({ t: 'ul', items: helpers.map(h => {
      const s = querySources(h, byName).map(x => x.label + (x.where ? ' (' + x.where + ')' : '')).join('; ');
      const used = h.usedBy.length ? 'used by ' + h.usedBy.join(', ') : 'not used by any table';
      return h.name + ': ' + (h.type === 'function' ? 'a reusable rule, ' + used + '.' : (s ? 'reads ' + s + ', ' : '') + used + '.');
    }) });
  }
  D.push({ t: 'h1', text: 'Words used in this guide' });
  D.push({ t: 'ul', items: [
    'Table: a set of rows and columns the reports use, like a sheet in Excel.',
    'Data source: the database, file or system the data is read from.',
    'Refresh: Power BI reads the data sources again and repeats these steps, so the reports show the latest data.',
    'Setting: a value stored once in the model, such as a start date or a file location.'
  ] });
  D.push({ t: 'note', text: 'Written from the model’s Power Query code' + (Object.keys(o.biz).length ? ', with plain-language text drafted by Copilot' : '') + '. Check it with the report owner before you rely on it.' });
  return D;
}

function docHtml(D){
  const e = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const title = (D.find(b => b.t === 'title') || { text: 'Data guide' }).text;
  const body = D.map(b => {
    switch (b.t) {
      case 'title': return '<h1 class="title">' + e(b.text) + '</h1>';
      case 'sub': return '<p class="sub">' + e(b.text) + '</p>';
      case 'h1': return '<h2>' + e(b.text) + '</h2>';
      case 'h2': return '<h3>' + e(b.text) + '</h3>';
      case 'h3': return '<h4>' + e(b.text) + '</h4>';
      case 'p': return '<p>' + (b.label ? '<b>' + e(b.label) + ':</b> ' : '') + e(b.text) + '</p>';
      case 'note': return '<p class="note">' + e(b.text) + '</p>';
      case 'ul': case 'ol': return '<' + b.t + '>' + b.items.map(i => '<li>' + e(i) + '</li>').join('') + '</' + b.t + '>';
      case 'table': return '<table><thead><tr>' + b.head.map(h => '<th>' + e(h) + '</th>').join('') + '</tr></thead><tbody>' + b.rows.map(r => '<tr>' + r.map(c => '<td>' + e(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
      default: return '';
    }
  }).join('\n');
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + e(title) + '</title><style>'
    + 'body{font-family:"Segoe UI",Calibri,Arial,sans-serif;color:#1f2933;line-height:1.5;max-width:780px;margin:32px auto;padding:0 18px;font-size:15px;background:#fff}'
    + 'h1.title{font-size:28px;color:#1f3864;margin:0 0 6px}.sub{color:#52606d;margin:0 0 24px}h2{font-size:21px;color:#1f3864;border-bottom:1px solid #d9e2ec;padding-bottom:4px;margin:30px 0 10px}'
    + 'h3{font-size:18px;color:#2f5496;margin:24px 0 6px}h4{font-size:15px;margin:14px 0 4px}p{margin:6px 0}ul,ol{margin:4px 0 8px;padding-left:22px}li{margin:2px 0}'
    + 'table{border-collapse:collapse;width:100%;margin:8px 0;font-size:14px}th,td{border:1px solid #cbd2d9;padding:6px 8px;text-align:left;vertical-align:top}th{background:#e8eef7}'
    + '.note{color:#52606d;font-style:italic;font-size:14px}@media print{body{margin:0}}'
    + '</style></head><body>\n' + body + '\n</body></html>\n';
}

// a stored (uncompressed) zip, enough for a Word file
const ZIP_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function zipStored(entries){
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = ZIP_CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  for (const [path, content] of entries) {
    const name = enc.encode(path), data = enc.encode(content), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(12, 0x21, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true); cd.setUint16(14, 0x21, true);
    cd.setUint32(16, crc, true); cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true); cd.setUint16(28, name.length, true); cd.setUint32(42, off, true);
    central.push(new Uint8Array(cd.buffer), name);
    off += 30 + name.length + data.length;
  }
  const size = central.reduce((a, b) => a + b.length, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true); end.setUint32(12, size, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
function docxParts(D){
  const x = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const run = (t, b) => '<w:r>' + (b ? '<w:rPr><w:b/></w:rPr>' : '') + '<w:t xml:space="preserve">' + x(t) + '</w:t></w:r>';
  const para = (style, runs, extra) => '<w:p><w:pPr>' + (style ? '<w:pStyle w:val="' + style + '"/>' : '') + (extra || '') + '</w:pPr>' + runs + '</w:p>';
  const STY = { title: 'Title', sub: 'Subtitle', h1: 'Heading1', h2: 'Heading2', h3: 'Heading3', note: 'Note' };
  const body = D.map(b => {
    if (STY[b.t]) return para(STY[b.t], run(b.text));
    if (b.t === 'p') return para('', (b.label ? run(b.label + ': ', true) : '') + run(b.text));
    if (b.t === 'ul' || b.t === 'ol') return b.items.map(i => para(b.t === 'ul' ? 'ListBullet' : 'ListNumber', run(i), '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="' + (b.t === 'ul' ? 1 : D.indexOf(b) + 2) + '"/></w:numPr>')).join('');
    if (b.t === 'table') {
      const n = b.head.length, wcol = Math.floor(9360 / n);
      const cell = (t, h) => '<w:tc><w:tcPr><w:tcW w:w="' + wcol + '" w:type="dxa"/>' + (h ? '<w:shd w:val="clear" w:color="auto" w:fill="E8EEF7"/>' : '') + '</w:tcPr>' + para('TableText', run(t, h)) + '</w:tc>';
      return '<w:tbl><w:tblPr><w:tblStyle w:val="Grid"/><w:tblW w:w="5000" w:type="pct"/></w:tblPr><w:tblGrid>' + b.head.map(() => '<w:gridCol w:w="' + wcol + '"/>').join('') + '</w:tblGrid>'
        + '<w:tr><w:trPr><w:tblHeader/></w:trPr>' + b.head.map(h => cell(h, true)).join('') + '</w:tr>'
        + b.rows.map(r => '<w:tr>' + r.map(c => cell(c, false)).join('') + '</w:tr>').join('') + '</w:tbl>' + para('', '');
    }
    return '';
  }).join('');
  const doc = HEAD + '<w:document ' + W + '><w:body>' + body + '<w:sectPr><w:pgMar w:top="1260" w:right="1260" w:bottom="1260" w:left="1260" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>';
  const st = (id, name, ppr, rpr, type) => '<w:style w:type="' + (type || 'paragraph') + '" w:styleId="' + id + '"><w:name w:val="' + name + '"/>' + (id !== 'Normal' && type !== 'table' ? '<w:basedOn w:val="Normal"/><w:qFormat/>' : '') + (ppr ? '<w:pPr>' + ppr + '</w:pPr>' : '') + (rpr ? '<w:rPr>' + rpr + '</w:rPr>' : '') + '</w:style>';
  const B = s => '<w:top w:val="single" w:sz="4" w:space="0" w:color="' + s + '"/><w:left w:val="single" w:sz="4" w:space="0" w:color="' + s + '"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="' + s + '"/><w:right w:val="single" w:sz="4" w:space="0" w:color="' + s + '"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="' + s + '"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="' + s + '"/>';
  const styles = HEAD + '<w:styles ' + W + '><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="1F2933"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
    + st('Normal', 'Normal', '', '')
    + st('Title', 'Title', '<w:spacing w:after="80"/>', '<w:sz w:val="48"/><w:szCs w:val="48"/><w:color w:val="1F3864"/>')
    + st('Subtitle', 'Subtitle', '<w:spacing w:after="320"/>', '<w:color w:val="52606D"/>')
    + st('Heading1', 'heading 1', '<w:keepNext/><w:spacing w:before="400" w:after="120"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="2" w:color="D9E2EC"/></w:pBdr><w:outlineLvl w:val="0"/>', '<w:b/><w:sz w:val="32"/><w:szCs w:val="32"/><w:color w:val="1F3864"/>')
    + st('Heading2', 'heading 2', '<w:keepNext/><w:spacing w:before="320" w:after="80"/><w:outlineLvl w:val="1"/>', '<w:b/><w:sz w:val="27"/><w:szCs w:val="27"/><w:color w:val="2F5496"/>')
    + st('Heading3', 'heading 3', '<w:keepNext/><w:spacing w:before="160" w:after="40"/><w:outlineLvl w:val="2"/>', '<w:b/>')
    + st('ListBullet', 'List Bullet', '<w:spacing w:after="40"/><w:ind w:left="360" w:hanging="360"/>', '')
    + st('ListNumber', 'List Number', '<w:spacing w:after="40"/><w:ind w:left="360" w:hanging="360"/>', '')
    + st('Note', 'Note', '<w:spacing w:before="120"/>', '<w:i/><w:color w:val="52606D"/><w:sz w:val="20"/><w:szCs w:val="20"/>')
    + st('TableText', 'Table Text', '<w:spacing w:after="0"/>', '<w:sz w:val="20"/><w:szCs w:val="20"/>')
    + '<w:style w:type="table" w:styleId="Grid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders>' + B('CBD2D9') + '</w:tblBorders><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>'
    + '</w:styles>';
  // numbering: 1 = bullets; each numbered list gets its own instance so it starts at 1
  const lists = D.filter(b => b.t === 'ol').map(b => D.indexOf(b) + 2);
  const numbering = HEAD + '<w:numbering ' + W + '>'
    + '<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>'
    + '<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>'
    + '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>'
    + lists.map(id => '<w:num w:numId="' + id + '"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>').join('')
    + '</w:numbering>';
  const title = (D.find(b => b.t === 'title') || { text: '' }).text;
  return [
    ['[Content_Types].xml', HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>'],
    ['_rels/.rels', HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>'],
    ['docProps/core.xml', HEAD + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>' + x(title) + '</dc:title></cp:coreProperties>'],
    ['word/_rels/document.xml.rels', HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>'],
    ['word/document.xml', doc],
    ['word/styles.xml', styles],
    ['word/numbering.xml', numbering]
  ];
}
function docxBlob(D){ return zipStored(docxParts(D)); }
