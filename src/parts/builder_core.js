/*CORE-START*/
const NL_MARK = '\u21B5';
const TAB = '\t';

const CLEAN = (col, tabRepl) => 'SUBSTITUTE ( SUBSTITUTE ( SUBSTITUTE ( ' + col + ', UNICHAR ( 13 ), "" ), UNICHAR ( 10 ), UNICHAR ( 8629 ) ), UNICHAR ( 9 ), "' + tabRepl + '" )';
const DAX_QUERY = [
'// KPI Measure Builder: model export',
'// Run in DAX query view, then select Copy above the results grid.',
'EVALUATE',
'// Lookups that find which remote model (if any) each table comes from',
'VAR _tableIds = SELECTCOLUMNS ( INFO.TABLES (), "TID", [ID], "TName", [Name] )',
'VAR _remoteParts =',
'\tSELECTCOLUMNS (',
'\t\tFILTER ( INFO.PARTITIONS (), [ExpressionSourceID] > 0 ),',
'\t\t"PTID", [TableID],',
'\t\t"PEID", [ExpressionSourceID]',
'\t)',
'VAR _expressions = SELECTCOLUMNS ( INFO.EXPRESSIONS (), "EID", [ID], "EName", [Name] )',
'VAR _tables =',
'\tSELECTCOLUMNS (',
'\t\tINFO.VIEW.TABLES (),',
'\t\t"Kind", "Table",',
'\t\t"Table", [Name],',
'\t\t"Name", [Name],',
'\t\t"Type", [DataCategory],',
'\t\t"Folder", "",',
'\t\t"Flags", IF ( [IsHidden], "hidden", "" ) & IF ( [IsPrivate], " private", "" ),',
'\t\t"Description", ' + CLEAN('[Description]', ' ') + ',',
'\t\t"Expression", "",',
'\t\t"ToTable", "",',
'\t\t"ToColumn", "",',
'\t\t"Storage", [StorageMode],',
'\t\t"Source",',
'\t\t\tVAR _tn = [Name]',
'\t\t\tVAR _tid = MAXX ( FILTER ( _tableIds, [TName] = _tn ), [TID] )',
'\t\t\tVAR _eid = MAXX ( FILTER ( _remoteParts, [PTID] = _tid ), [PEID] )',
'\t\t\tRETURN CONCATENATEX ( FILTER ( _expressions, [EID] = _eid ), [EName], ", " )',
'\t)',
'VAR _columns =',
'\tSELECTCOLUMNS (',
'\t\tINFO.VIEW.COLUMNS (),',
'\t\t"Kind", "Column",',
'\t\t"Table", [Table],',
'\t\t"Name", [Name],',
'\t\t"Type", [DataType],',
'\t\t"Folder", [DisplayFolder],',
'\t\t"Flags", IF ( [IsHidden], "hidden", "" ) & IF ( [IsKey], " key", "" ),',
'\t\t"Description", ' + CLEAN('[Description]', ' ') + ',',
'\t\t"Expression", ' + CLEAN('[Expression]', '    ') + ',',
'\t\t"ToTable", "",',
'\t\t"ToColumn", "",',
'\t\t"Storage", "",',
'\t\t"Source", ""',
'\t)',
'VAR _measures =',
'\tSELECTCOLUMNS (',
'\t\tINFO.VIEW.MEASURES (),',
'\t\t"Kind", "Measure",',
'\t\t"Table", [Table],',
'\t\t"Name", [Name],',
'\t\t"Type", [FormatString],',
'\t\t"Folder", [DisplayFolder],',
'\t\t"Flags", IF ( [IsHidden], "hidden", "" ),',
'\t\t"Description", ' + CLEAN('[Description]', ' ') + ',',
'\t\t"Expression", ' + CLEAN('[Expression]', '    ') + ',',
'\t\t"ToTable", "",',
'\t\t"ToColumn", "",',
'\t\t"Storage", "",',
'\t\t"Source", ""',
'\t)',
'VAR _relationships =',
'\tSELECTCOLUMNS (',
'\t\tINFO.VIEW.RELATIONSHIPS (),',
'\t\t"Kind", "Relationship",',
'\t\t"Table", [FromTable],',
'\t\t"Name", [FromColumn],',
'\t\t"Type", [FromCardinality] & ":" & [ToCardinality],',
'\t\t"Folder", "",',
'\t\t"Flags", [CrossFilteringBehavior] & IF ( [IsActive], "", " inactive" ),',
'\t\t"Description", "",',
'\t\t"Expression", "",',
'\t\t"ToTable", [ToTable],',
'\t\t"ToColumn", [ToColumn],',
'\t\t"Storage", "",',
'\t\t"Source", ""',
'\t)',
'RETURN',
'\tUNION ( _tables, _columns, _measures, _relationships )',
'ORDER BY [Kind], [Table], [Name]'
].join('\n');

function unquoteCell(s){
  if (s.length >= 2 && s[0] === '"' && s[s.length-1] === '"') {
    const inner = s.slice(1, -1);
    if (!/(^|[^"])"([^"]|$)/.test(inner.replace(/""/g, ''))) return inner.replace(/""/g, '"');
  }
  return s;
}
function restore(s){ return (s || '').split(NL_MARK).join('\n'); }
function lc(s){ return (s || '').toLowerCase(); }

function parseModel(text){
  const res = { tables: [], columns: [], measures: [], rels: [], error: null, skipped: 0 };
  const raw = (text || '').replace(/\r/g, '');
  if (!raw.trim()) return res;
  const lines = raw.split('\n');
  let hIdx = -1, map = {};
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const cells = lines[i].split('\t').map(c => lc(unquoteCell(c.trim())).replace(/^\[|\]$/g, '').replace(/^.*\[|\]$/g, ''));
    if (cells.includes('kind') && cells.includes('table') && cells.includes('name')) {
      hIdx = i; cells.forEach((c, j) => { map[c] = j; }); break;
    }
  }
  if (hIdx < 0) {
    res.error = 'The header row (Kind, Table, Name…) wasn\u2019t found. Use the Copy button above the results grid so the column names come along, and make sure the query from Step 1 is the one you ran.';
    return res;
  }
  const get = (cells, k) => map[k] === undefined ? '' : restore(unquoteCell((cells[map[k]] || '').trim()));
  const tablesSeen = new Map();
  for (let i = hIdx + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const c = lines[i].split('\t');
    const kind = lc(get(c, 'kind'));
    const table = get(c, 'table');
    const name = get(c, 'name');
    const flags = lc(get(c, 'flags'));
    if (/^(localdatetable_|datetabletemplate_)/i.test(table)) { res.skipped++; continue; }
    if (kind === 'table') {
      if (flags.includes('private')) { res.skipped++; continue; }
      const t = { name, category: get(c, 'type'), hidden: flags.includes('hidden'), description: get(c, 'description'),
        storage: get(c, 'storage'), source: get(c, 'source') };
      res.tables.push(t); tablesSeen.set(lc(name), t);
    } else if (kind === 'column') {
      if (/^RowNumber-/i.test(name)) { res.skipped++; continue; }
      res.columns.push({ table, name, dataType: get(c, 'type'), hidden: flags.includes('hidden'), key: flags.includes('key'),
        description: get(c, 'description'), expression: get(c, 'expression') });
    } else if (kind === 'measure') {
      res.measures.push({ table, name, formatString: get(c, 'type'), folder: get(c, 'folder'), hidden: flags.includes('hidden'),
        description: get(c, 'description'), expression: get(c, 'expression') });
    } else if (kind === 'relationship') {
      const card = get(c, 'type').split(':');
      const toT = get(c, 'totable');
      if (/^(localdatetable_|datetabletemplate_)/i.test(toT)) { res.skipped++; continue; }
      res.rels.push({ fromTable: table, fromColumn: name, toTable: toT, toColumn: get(c, 'tocolumn'),
        fromCard: card[0] || '', toCard: card[1] || '', both: /both/i.test(flags), inactive: /inactive/.test(flags) });
    }
  }
  // tables referenced by columns/measures but missing a table row
  for (const x of [...res.columns, ...res.measures]) {
    if (x.table && !tablesSeen.has(lc(x.table))) { const t = { name: x.table, category: '', hidden: false, description: '' }; res.tables.push(t); tablesSeen.set(lc(x.table), t); }
  }
  res.tables.sort((a, b) => a.name.localeCompare(b.name));
  if (!res.tables.length && !res.columns.length) res.error = 'The header row was found but no model rows came with it. Paste the full results.';
  annotateSources(res);
  return res;
}

/* ---------- composite models ----------
   A source group is the set of tables that come from one source. Import tables form one group;
   each DirectQuery source (a SQL database, a remote semantic model) is its own group; Dual tables
   belong to the import group and their DirectQuery source. A relationship between tables that share
   no group, or any many-to-many relationship, is a limited relationship. */
function remoteLabel(source){
  return (source || '').replace(/^DirectQuery to (AS|PBI|Analysis Services)\s*-\s*/i, '').trim();
}
function sourceGroups(t){
  const mode = lc(t.storage);
  const src = t.source ? 'remote:' + lc(t.source) : '';
  if (mode === 'dual') return ['import', src || 'directquery'];
  if (mode === 'directquery') return [src || 'directquery'];
  if (mode === 'directlake') return [src || 'directlake'];
  return [src || 'import'];
}
function annotateSources(model){
  const byName = new Map(model.tables.map(t => [lc(t.name), t]));
  const groups = new Set();
  model.tables.forEach(t => { t.groups = sourceGroups(t); t.remote = !!t.source; groups.add(t.groups[0]); });
  model.composite = groups.size > 1;
  model.hasRemote = model.tables.some(t => t.remote);
  model.rels.forEach(r => {
    const a = byName.get(lc(r.fromTable)), b = byName.get(lc(r.toTable));
    const cross = a && b && !a.groups.some(g => b.groups.includes(g));
    r.crossSource = !!cross;
    r.limited = !!cross || (lc(r.fromCard) === 'many' && lc(r.toCard) === 'many');
  });
  return model;
}
// Measures the export can't see (for example from a remote model), pasted one name per line.
function parseExtraMeasures(text){
  return (text || '').replace(/\r/g, '').split('\n')
    .map(l => l.replace(/^\s*([-*•]|\d+[.)])\s*/, '').split(/\s(=|\|)\s|\t/)[0].trim())
    .map(l => l.replace(/^'[^']*'\s*(?=\[)/, '').replace(/^\[(.*)\]$/, '$1').trim())
    .filter(Boolean);
}
function withExtraMeasures(model, names){
  if (!names.length) return model;
  const have = new Set(model.measures.map(m => lc(m.name)));
  const extra = [...new Set(names)].filter(n => !have.has(lc(n))).map(n => ({ table: '', name: n, formatString: '', folder: '', hidden: false, description: '', expression: '', remote: true }));
  return Object.assign({}, model, { measures: model.measures.concat(extra), extraCount: extra.length });
}

function storageTag(t){
  const bits = [];
  if (t.remote) bits.push('from remote model ' + qName(remoteLabel(t.source)));
  else if (t.storage && lc(t.storage) !== 'import') bits.push(t.storage);
  else bits.push('Import');
  return bits.join(', ');
}

function qName(n){ return "'" + n.replace(/'/g, "''") + "'"; }
function bracket(n){ return '[' + n.replace(/\]/g, ']]') + ']'; }
function oneLine(s){ return (s || '').replace(/\s+/g, ' ').trim(); }

// Tables a DAX expression references directly: 'Table'[Col], Table[Col], 'Table', or a bare table name as a function argument.
function tableRefs(expr, model){
  const out = new Set();
  if (!expr) return out;
  const code = stripDax(expr);
  const known = new Map(model.tables.map(t => [lc(t.name), t.name]));
  let r;
  const quoted = /'((?:[^']|'')+)'/g;
  while ((r = quoted.exec(code))) { const n = r[1].replace(/''/g, "'"); if (known.has(lc(n))) out.add(known.get(lc(n))); }
  const bare = /(^|[^\w'\]])([A-Za-z_][A-Za-z0-9_]*)\s*(?=[\[,)])/g;
  while ((r = bare.exec(code))) { if (known.has(lc(r[2]))) out.add(known.get(lc(r[2]))); }
  return out;
}

// Existing measures worth sending: when only some tables are selected, drop measures that only use unselected tables.
function measuresForPrompt(model, tables){
  if (!tables) return { list: model.measures, dropped: 0 };
  const sel = new Set(tables.map(lc));
  if (model.tables.every(t => sel.has(lc(t.name)))) return { list: model.measures, dropped: 0 };
  const list = model.measures.filter(m => {
    if (m.remote) return true;
    const refs = [...tableRefs(m.expression, model)];
    return !refs.length || refs.some(t => sel.has(lc(t)));
  });
  return { list, dropped: model.measures.length - list.length };
}

/* ---------- table suggestions for big models ---------- */
const STOP_WORDS = new Set(('the and for with from per by of to in on at an or vs versus over under between than that this these those each all any '
  + 'total totals count counts number numbers average avg sum rate rates percent percentage pct ratio share amount value values '
  + 'using based only excluding including exclude include measure measures calculate calculated show new like who which where when '
  + 'not without have has had are was were will would should can could how many much more less most least into out what is it its be '
  + 'distinct unique minus plus divided times grand overall current selected same so as do does '
  + 'filter filtered filtering type types split broken breakdown separate separately individual one').split(/\s+/));
const TIME_WORDS = new Set(('year years yearly month months monthly week weeks weekly day days daily quarter quarters quarterly date dates '
  + 'ytd mtd qtd yoy mom qoq wow prior previous last rolling trailing trend period periods fiscal ly py since ago growth change '
  + 'annual annualized cumulative running').split(/\s+/));
function stem(w){
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}
function wordsOf(s){
  return (s || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(stem);
}
function wordMatch(a, b){ return a === b || (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5)); }

function suggestTables(model, requestsText, targetTable){
  const raw = (requestsText || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const tokens = [...new Set(raw.map(stem).filter(w => w.length >= 3 && !/^\d+$/.test(w) && !STOP_WORDS.has(w) && !TIME_WORDS.has(w)))];
  const wantsTime = raw.some(w => TIME_WORDS.has(w) || TIME_WORDS.has(stem(w)));
  const picked = new Map(); // table name -> reason
  const hit = (words) => tokens.find(t => words.some(w => wordMatch(t, w)));
  for (const t of model.tables) {
    const tw = hit(wordsOf(t.name));
    if (tw) { picked.set(t.name, 'name matches “' + tw + '”'); continue; }
    for (const c of model.columns) {
      if (lc(c.table) !== lc(t.name)) continue;
      const cw = hit(wordsOf(c.name));
      if (cw) { picked.set(t.name, 'column ' + bracket(c.name) + ' matches “' + cw + '”'); break; }
    }
  }
  for (const m of model.measures) {
    const mw = hit(wordsOf(m.name));
    if (!mw) continue;
    for (const t of tableRefs(m.expression, model)) if (!picked.has(t)) picked.set(t, 'used by measure ' + bracket(m.name));
  }
  const matched = new Set(picked.keys());
  // bring in the dimensions each matched table filters through (many side -> one side)
  for (const r of model.rels) {
    const from = model.tables.find(t => lc(t.name) === lc(r.fromTable));
    const to = model.tables.find(t => lc(t.name) === lc(r.toTable));
    if (!from || !to) continue;
    const manyToOne = lc(r.toCard) === 'one' || !r.toCard;
    if (matched.has(from.name) && manyToOne && !picked.has(to.name)) picked.set(to.name, 'related to ' + qName(from.name));
    if (matched.has(to.name) && lc(r.fromCard) === 'one' && lc(r.toCard) === 'many' && !picked.has(from.name)) picked.set(from.name, 'related to ' + qName(to.name));
  }
  if (wantsTime) model.tables.filter(t => lc(t.category) === 'time').forEach(t => { if (!picked.has(t.name)) picked.set(t.name, 'date table (time words in requests)'); });
  const home = model.tables.find(t => lc(t.name) === lc(targetTable || ''));
  if (home && picked.size && !picked.has(home.name)) picked.set(home.name, 'home table for new measures');
  return { picked, matchedCount: matched.size, tokens };
}

/* ---------- column values ----------
   The export has names only. For filters on specific text values, the user can run a second small
   query that lists the values of chosen columns, and paste the result back. */
const VALUES_LIMIT = 50;

// 'Table'[Column] / Table[Column] / [Column] (if unique) lines -> canonical column refs
function parseColumnList(text, model){
  const out = [], bad = [], seen = new Set();
  for (let line of (text || '').replace(/\r/g, '').split('\n')) {
    line = line.replace(/^\s*([-*•]|\d+[.)])\s*/, '').trim();
    if (!line) continue;
    let tn = null, cn = null, r;
    if ((r = line.match(/^'((?:[^']|'')+)'\s*\[((?:[^\]]|\]\])+)\]/))) { tn = r[1].replace(/''/g, "'"); cn = r[2].replace(/\]\]/g, ']'); }
    else if ((r = line.match(/^([A-Za-z_][\w ]*?)\s*\[((?:[^\]]|\]\])+)\]/))) { tn = r[1].trim(); cn = r[2].replace(/\]\]/g, ']'); }
    else if ((r = line.match(/^\[((?:[^\]]|\]\])+)\]$/)) || (r = [null, line])) { cn = r[1].replace(/\]\]/g, ']'); }
    let col;
    if (tn) col = model.columns.find(c => lc(c.table) === lc(tn) && lc(c.name) === lc(cn));
    else {
      const hits = model.columns.filter(c => lc(c.name) === lc(cn));
      if (hits.length === 1) col = hits[0];
    }
    if (!col) { bad.push(line); continue; }
    const ref = qName(col.table) + bracket(col.name);
    if (seen.has(lc(ref))) continue;
    seen.add(lc(ref));
    out.push({ table: col.table, column: col.name, ref });
  }
  return { cols: out, bad };
}

function valuesQuery(cols){
  if (!cols.length) return '';
  const part = c => 'SELECTCOLUMNS ( TOPN ( ' + VALUES_LIMIT + ', DISTINCT ( ' + c.ref + ' ), ' + c.ref + ', ASC ), '
    + '"Column", "' + c.ref.replace(/"/g, '""') + '", "Value", ' + c.ref + ' & "", "Distinct", COUNTROWS ( DISTINCT ( ' + c.ref + ' ) ) )';
  const body = cols.length === 1 ? part(cols[0]) : 'UNION (\n' + cols.map(c => '\t' + part(c)).join(',\n') + '\n)';
  return ['// KPI Measure Builder: column values (first ' + VALUES_LIMIT + ' per column)',
    '// Run in DAX query view, then select Copy above the results grid.',
    'EVALUATE', body, 'ORDER BY [Column], [Value]'].join('\n');
}

// Pasted results -> Map(lc ref -> { ref, values, distinct })
function parseValues(text){
  const map = new Map();
  const lines = (text || '').replace(/\r/g, '').split('\n');
  let h = -1, idx = {};
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cells = lines[i].split('\t').map(c => lc(unquoteCell(c.trim())).replace(/^.*\[|\]$/g, ''));
    if (cells.includes('column') && cells.includes('value')) { h = i; cells.forEach((c, j) => { idx[c] = j; }); break; }
  }
  if (h < 0) return map;
  for (let i = h + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const c = lines[i].split('\t');
    const ref = unquoteCell((c[idx.column] || '').trim());
    if (!ref) continue;
    const v = unquoteCell((c[idx.value] || '').replace(/^\s+|\s+$/g, ''));
    const d = parseInt((c[idx.distinct] || '').trim(), 10);
    const k = lc(ref);
    if (!map.has(k)) map.set(k, { ref, values: [], distinct: isNaN(d) ? null : d });
    map.get(k).values.push(v);
  }
  return map;
}

// Text columns whose names share words with the requests, best matches first
function suggestValueColumns(model, requestsText, limit){
  const raw = (requestsText || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const tokens = [...new Set(raw.map(stem).filter(w => w.length >= 3 && !STOP_WORDS.has(w) && !TIME_WORDS.has(w)))];
  const scored = [];
  for (const c of model.columns) {
    if (!/^(string|text)$/i.test(c.dataType || '') || c.key) continue;
    const cw = wordsOf(c.name);
    const score = tokens.filter(t => cw.some(w => wordMatch(t, w))).length;
    if (score) scored.push({ c, score });
  }
  scored.sort((a, b) => b.score - a.score || a.c.name.length - b.c.name.length);
  return scored.slice(0, limit || 6).map(x => qName(x.c.table) + bracket(x.c.name));
}

function daxString(v){ return '"' + v.replace(/"/g, '""') + '"'; }

/* ---------- relationship paths ----------
   Filters flow from the one side (ToTable) to the many side (FromTable); both ways only when the
   relationship filters both directions. */
function hopFlows(r, fromT, toT){
  if (lc(fromT) === lc(r.toTable) && lc(toT) === lc(r.fromTable)) return true;
  return !!r.both;
}
function relPath(model, a, b, allowInactive){
  if (lc(a) === lc(b)) return [];
  const rels = model.rels.filter(r => allowInactive || !r.inactive);
  const prev = new Map([[lc(a), null]]);
  const queue = [a];
  while (queue.length) {
    const cur = queue.shift();
    for (const r of rels) {
      let next = null;
      if (lc(r.fromTable) === lc(cur)) next = r.toTable; else if (lc(r.toTable) === lc(cur)) next = r.fromTable;
      if (!next || prev.has(lc(next))) continue;
      prev.set(lc(next), { from: cur, rel: r, to: next });
      if (lc(next) === lc(b)) {
        const hops = []; let k = lc(b);
        while (prev.get(k)) { const h = prev.get(k); hops.unshift(h); k = lc(h.from); }
        return hops;
      }
      queue.push(next);
    }
  }
  return null;
}
function describePath(model, a, b){
  let hops = relPath(model, a, b, false), inactive = false;
  if (!hops) { hops = relPath(model, a, b, true); inactive = !!hops; }
  if (!hops) return { text: 'No relationship path connects ' + qName(a) + ' and ' + qName(b) + '. Relating them needs TREATAS or a relationship change.', tables: [], ok: false, forward: false, back: false };
  const names = [a].concat(hops.map(h => h.to));
  const forward = hops.every(h => hopFlows(h.rel, h.from, h.to));
  const back = hops.slice().reverse().every(h => hopFlows(h.rel, h.to, h.from));
  const limited = hops.some(h => h.rel.limited);
  const inact = hops.filter(h => h.rel.inactive);
  const parts = [names.map(qName).join(' → ') + '.'];
  parts.push('A filter on ' + qName(a) + ' reaches ' + qName(b) + ': ' + (forward ? 'yes' : 'NO') + '. A filter on ' + qName(b) + ' reaches ' + qName(a) + ': ' + (back ? 'yes' : 'NO') + '.');
  if (inactive) parts.push('Uses INACTIVE relationship(s) ' + inact.map(h => qName(h.rel.fromTable) + bracket(h.rel.fromColumn) + ' → ' + qName(h.rel.toTable) + bracket(h.rel.toColumn)).join(', ') + '; activate with USERELATIONSHIP.');
  if (limited) parts.push('Includes a LIMITED relationship.');
  return { text: parts.join(' '), tables: names, ok: true, forward, back, inactive };
}

/* ---------- detailed measures ---------- */
const COMBINE = {
  sum: ['Sum', 'add up the per-row results (SUMX)'],
  max: ['Largest', 'take the largest per-row result (MAXX)'],
  min: ['Smallest', 'take the smallest per-row result (MINX)'],
  avg: ['Average', 'average the per-row results (AVERAGEX)'],
  count: ['Count rows with a result', 'count the rows whose result is not blank'],
  auto: ['Let Copilot decide', 'combine the per-row results in the way that fits the goal, and say how in NOTES']
};
function blankDetail(){ return { name: '', goal: '', tables: [], iterate: '', combine: 'sum', from: '', to: '', filters: '', example: '', edge: '', other: '' }; }

function detailTables(model, d){
  const set = new Map();
  const add = n => { const t = model.tables.find(x => lc(x.name) === lc(n)); if (t) set.set(lc(t.name), t.name); };
  (d.tables || []).forEach(add);
  const col = r => { const m = /^'((?:[^']|'')+)'\[/.exec(r || ''); return m ? m[1].replace(/''/g, "'") : null; };
  [d.iterate, d.from.startsWith('col:') ? d.from.slice(4) : '', d.to.startsWith('col:') ? d.to.slice(4) : ''].map(col).filter(Boolean).forEach(add);
  return [...set.values()];
}
function detailPaths(model, d){
  const ts = detailTables(model, d);
  const out = [];
  for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) out.push(describePath(model, ts[i], ts[j]));
  return out;
}
function windowEnd(v, d, dateCol){
  if (v === 'sel') return 'the selected date, meaning ' + (dateCol ? 'MAX ( ' + dateCol + ' )' : 'the latest date') + ' in the current filter context';
  if (v === 'periodStart') return 'the first date of the selected period' + (dateCol ? ', meaning MIN ( ' + dateCol + ' )' : '');
  if (v === 'periodEnd') return 'the last date of the selected period' + (dateCol ? ', meaning MAX ( ' + dateCol + ' )' : '');
  if (v.startsWith('col:')) return 'the value of ' + v.slice(4) + (d.iterate ? ' for the current row of the iteration' : ' in the current context');
  return '';
}
function detailSection(model, d, n, dateCol){
  const L = [];
  L.push('### Detailed measure D' + n + (d.name ? ': ' + d.name : ''));
  L.push('Goal: ' + (d.goal || '(not described)').trim());
  const ts = detailTables(model, d);
  if (ts.length) L.push('Tables involved: ' + ts.map(qName).join(', '));
  const paths = detailPaths(model, d);
  if (paths.length) { L.push('How these tables connect (from the model’s relationships):'); paths.forEach(p => L.push('- ' + p.text)); }
  if (d.iterate) {
    const c = COMBINE[d.combine] || COMBINE.sum;
    L.push('Calculation shape: this is ONE measure. Iterate over each value of ' + d.iterate + ', calculate the result for that value, then ' + c[1] + '.');
  }
  if (d.from || d.to) {
    const f = windowEnd(d.from, d, dateCol) || 'no lower limit', t = windowEnd(d.to, d, dateCol) || 'no upper limit';
    L.push('Date window: from ' + f + ', up to and including ' + t + '.' + (d.iterate && (d.from.startsWith('col:') || d.to.startsWith('col:')) ? ' The window is different for each row of the iteration.' : ''));
    if (d.from === 'sel' || d.to === 'sel' || d.from === 'periodEnd' || d.to === 'periodEnd' || d.from === 'periodStart' || d.to === 'periodStart')
      L.push('Capture the selected date(s) in VARs before iterating. Inside the calculation, remove the slicer’s own date filter and apply this window instead.');
  }
  if (d.filters.trim()) L.push('Filters to keep or ignore: ' + oneLine(d.filters));
  if (d.example.trim()) L.push('Worked example: ' + oneLineKeepBreaks(d.example).split('\n').join(' / '));
  if (d.edge.trim()) L.push('Edge cases: ' + oneLineKeepBreaks(d.edge).split('\n').join(' / '));
  if (d.other.trim()) L.push('Other notes: ' + oneLineKeepBreaks(d.other).split('\n').join(' / '));
  return L;
}
function hasDetails(details){ return (details || []).some(d => (d.goal || '').trim() || (d.name || '').trim()); }

function buildPrompt(model, requestsText, opts){
  const o = Object.assign({ tables: null, hidden: true, formulas: true, descriptions: true, targetTable: '_Measures' }, opts || {});
  const reqs = (requestsText || '').split('\n').map(s => s.replace(/^\s*(\d+[.)]|[-*•])\s*/, '').trim()).filter(Boolean);
  const dateTables = model.tables.filter(t => lc(t.category) === 'time').map(t => t.name);
  const dateTbl = dateTables[0];
  const details = (o.details || []).filter(d => (d.goal || '').trim() || (d.name || '').trim());
  const forced = new Set();
  details.forEach(d => {
    detailTables(model, d).forEach(t => forced.add(lc(t)));
    detailPaths(model, d).forEach(p => p.tables.forEach(t => forced.add(lc(t))));
    if ((d.from || d.to) && dateTbl) forced.add(lc(dateTbl));
  });
  const include = o.tables ? new Set(o.tables.map(lc).concat([...forced])) : null;
  const inc = t => !include || include.has(lc(t));
  const dateColObj = dateTbl && (model.columns.find(c => lc(c.table) === lc(dateTbl) && /^date$/i.test(c.name)) || model.columns.find(c => lc(c.table) === lc(dateTbl) && /date/i.test(c.dataType || '')));
  const dateCol = dateColObj ? qName(dateColObj.table) + bracket(dateColObj.name) : null;
  const L = [];
  L.push('You are an expert in Power BI and DAX. Write DAX measures for the semantic model described below.');
  L.push('');
  L.push('## TASK: measures to write (the user’s requests)');
  reqs.forEach((r, i) => L.push((i + 1) + '. ' + r));
  details.forEach((d, i) => L.push((reqs.length + i + 1) + '. ' + (d.name || 'Detailed measure D' + (i + 1)) + ': see Detailed measure D' + (i + 1) + ' below.'));
  if (!reqs.length && !details.length) L.push('1. (describe the measures you need here)');
  if (details.length) {
    L.push('');
    L.push('## TASK: detailed measures');
    L.push('These are complex. Read every line of each one before writing it.');
    details.forEach((d, i) => { L.push(''); detailSection(model, d, i + 1, dateCol).forEach(x => L.push(x)); });
  }
  L.push('');
  L.push('## RULES');
  L.push('- Use only the tables, columns and measures listed under CONTEXT: model. Do not invent names.');
  L.push("- Reference columns as 'Table'[Column]. Reference measures as [Measure] with no table prefix.");
  L.push('- Reuse an existing measure when it already calculates what you need.');
  L.push('- Use DIVIDE() for division. Use VAR ... RETURN when a measure has more than one step.');
  if (dateTables.length) L.push("- The marked date table is " + dateTables.map(qName).join(', ') + '. Use it for all time intelligence.');
  else L.push('- No table is marked as a date table. For time intelligence, use the date table you can identify from the relationships and state which one in the description.');
  L.push('- Filter through relationships. Do not use FILTER over a whole fact table when a simple column filter works.');
  L.push('- Give each measure a clear Title Case name that is not already used by an existing measure or column.');
  L.push('- FORMAT must be a Power BI format string, for example #,0 or #,0.00 or 0.0% or \\$#,0.');
  if (o.descriptions) L.push('- DESCRIPTION is one plain-English sentence a report user would understand.');
  L.push('- You can see table and column names, not the data. When a filter needs specific text values, use only values listed under "Known column values" or written in the request, spelled exactly as given.');
  L.push('- If a request needs text values you were not given, do not guess them, and do not replace them with a generic filter such as VALUES() or KEEPFILTERS(VALUES()). Write a SKIPPED block whose REASON names the column whose values are needed.');
  L.push('- When a one-line request asks for a separate measure "for each" value of a column, write one measure per value, named with the value, for example "Sales - Consumer". This does not apply to detailed measures, where "iterate over each value" means one measure that loops.');
  if (model.composite) {
    L.push('');
    L.push('## RULES: composite model');
    L.push('This model combines tables from more than one data source. Each table below says where it comes from.');
    L.push('- Relationships marked LIMITED connect different data sources, or are many-to-many. Filters still flow across them.');
    L.push('- Across a LIMITED relationship, do not use RELATED or RELATEDTABLE, and do not iterate the rows of one table while reading columns of a table on the other side.');
    L.push('- Prefer aggregating within one source and then combining the results, for example DIVIDE ( [Measure from one source], [Measure from another source] ).');
    L.push('- Across a LIMITED relationship, rows with no matching key are not grouped under a blank value, so visible rows may not add up to the total.');
  }
  if (details.length) {
    L.push('');
    L.push('## RULES: detailed measures');
    L.push('- Add a NOTES line (2 to 4 plain sentences) explaining your approach, just before DAX:.');
    L.push('- Capture values from the outer filter context, such as the selected date, in VARs BEFORE any iterator. Inside an iterator, CALCULATE and measure references cause context transition, which changes those values.');
    L.push('- Iterate over the smallest table that works: VALUES of the column you iterate over, or SUMMARIZE of the columns you need. Do not iterate a whole fact table unless the request says to.');
    L.push('- Inside the iterator, use CALCULATE (or a measure reference) so the current row becomes a filter. When a date window differs from the slicer selection, remove the date table filter (REMOVEFILTERS on the date table) and apply the window explicitly, for example DATESBETWEEN or a filter on the date column.');
    L.push('- Follow the relationship paths given. If a path does not pass filters in the direction you need, use TREATAS or CROSSFILTER inside CALCULATE, and say so in NOTES.');
    L.push('- Handle the edge cases listed, and make the worked example come out as described.');
    L.push('- Break the DAX into named VAR steps with a short // comment on each.');
  }
  L.push('');
  L.push('## REPLY FORMAT (a template: replace the placeholder text with your answer)');
  L.push('Put your ENTIRE answer inside ONE code block. Write nothing before or after the code block.');
  L.push('Inside the code block, write each measure in exactly this layout:');
  L.push('');
  L.push('@@@ MEASURE @@@');
  L.push('NAME: Measure Name');
  L.push('FORMAT: #,0');
  if (o.descriptions) L.push('DESCRIPTION: One sentence.');
  if (details.length) L.push('NOTES: (detailed measures only) How the calculation works.');
  L.push('DAX:');
  L.push('CALCULATE (');
  L.push('    [Existing Measure],');
  L.push("    'Table'[Column] = \"value\"");
  L.push(')');
  L.push('@@@ END @@@');
  L.push('');
  L.push('Rules for this layout:');
  L.push('- Write the DAX exactly as you would type it in Power BI, on as many lines as you like. Do not escape quotes, brackets or backslashes.');
  L.push('- Do not start the DAX with the measure name and "=".');
  L.push('- Do not use JSON, tables or bullet points.');
  L.push('');
  L.push('If a measure cannot be calculated from this model, do NOT write a placeholder such as BLANK(), 0 or ERROR(). Write a SKIPPED block instead, and say what is missing:');
  L.push('');
  L.push('@@@ SKIPPED @@@');
  L.push('NAME: Measure Name');
  L.push('REASON: What the model is missing, for example a column or relationship.');
  L.push('@@@ END @@@');
  L.push('');
  L.push('## CONTEXT: model');
  L.push('');
  L.push('### Tables and columns');
  for (const t of model.tables) {
    if (!inc(t.name)) continue;
    const cols = model.columns.filter(c => lc(c.table) === lc(t.name) && (o.hidden || !c.hidden));
    const tags = [];
    if (lc(t.category) === 'time') tags.push('date table');
    if (!cols.length && model.measures.some(m => lc(m.table) === lc(t.name))) tags.push('measure table');
    if (model.composite) tags.push(storageTag(t));
    L.push(qName(t.name) + (tags.length ? ' (' + tags.join(', ') + ')' : '') + (t.description ? ': ' + oneLine(t.description) : ''));
    for (const c of cols) {
      const bits = [c.dataType || 'unknown type'];
      if (c.key) bits.push('key');
      if (c.hidden) bits.push('hidden');
      if (c.expression) bits.push('calculated');
      L.push('  - ' + bracket(c.name) + ': ' + bits.join(', ') + (c.description ? ' — ' + oneLine(c.description) : ''));
    }
  }
  const rels = model.rels.filter(r => inc(r.fromTable) && inc(r.toTable));
  if (rels.length) {
    L.push('');
    L.push('### Relationships');
    for (const r of rels) {
      L.push('- ' + qName(r.fromTable) + bracket(r.fromColumn) + ' (' + (r.fromCard || '?') + ') → ' + qName(r.toTable) + bracket(r.toColumn) + ' (' + (r.toCard || '?') + ')'
        + (r.both ? ', filters both directions' : ', single direction')
        + (r.crossSource ? ', LIMITED (crosses data sources)' : r.limited ? ', LIMITED (many-to-many)' : '')
        + (r.inactive ? ', INACTIVE (use USERELATIONSHIP)' : ''));
    }
  }
  if (o.knownValues && o.knownValues.size) {
    L.push('');
    L.push('### Known column values');
    for (const kv of o.knownValues.values()) {
      const shown = kv.values.map(v => v === '' ? '(blank)' : daxString(v)).join(', ');
      const partial = kv.distinct !== null && kv.distinct > kv.values.length;
      L.push('- ' + kv.ref + ': ' + shown + (partial ? ' (first ' + kv.values.length + ' of ' + kv.distinct + ' values; the list is incomplete)' : ''));
    }
  }
  const mp = measuresForPrompt(model, o.tables);
  if (mp.list.length) {
    L.push('');
    L.push('### Existing measures');
    for (const m of mp.list) {
      let line = '- ' + bracket(m.name);
      if (m.remote) { L.push(line + ' (from the remote model; formula not available)'); continue; }
      const home = model.tables.find(t => lc(t.name) === lc(m.table));
      const tags = [];
      if (m.formatString) tags.push('format ' + m.formatString);
      if (home && home.remote) tags.push('from remote model ' + qName(remoteLabel(home.source)));
      if (tags.length) line += ' (' + tags.join('; ') + ')';
      if (o.formulas && m.expression) {
        let e = oneLine(m.expression);
        if (e.length > 300) e = e.slice(0, 300).replace(/\s+\S*$/, '') + ' … [formula shortened]';
        line += ' = ' + e;
      }
      L.push(line);
    }
  }
  if (o.formulas && mp.list.some(m => oneLine(m.expression).length > 300)) {
    L.push('');
    L.push('Formulas marked [formula shortened] are cut to save space. Reuse those measures by name; do not copy their partial formulas.');
  }
  L.push('');
  L.push('=== END OF PROMPT ===');
  return L.join('\n');
}

function repairJson(s){
  let out = '', inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) { out += ch; esc = false; continue; }
      if (ch === '\\') { out += ch; esc = true; continue; }
      if (ch === '"') { inStr = false; out += ch; continue; }
      if (ch === '\n') { out += '\\n'; continue; }
      if (ch === '\r') continue;
      if (ch === '\t') { out += '\\t'; continue; }
      out += ch;
    } else {
      if (ch === '"') inStr = true;
      out += ch;
    }
  }
  return out.replace(/,\s*([\]}])/g, '$1');
}

function pick(obj, keys){
  const lower = {};
  for (const k of Object.keys(obj)) lower[lc(k).replace(/[\s_-]/g, '')] = obj[k];
  for (const k of keys) if (lower[k] !== undefined && lower[k] !== null) return String(lower[k]);
  return '';
}

// Chat UIs often add markdown escapes (\[ \] \_ \*) when text is copied outside a code block.
function unMarkdown(s){
  let prev;
  do { prev = s; s = s.replace(/(^|[^\\])\\([\[\]_*])/g, '$1$2'); } while (s !== prev);
  return s;
}
function cleanField(v){
  let s = (v || '').trim();
  s = s.replace(/^`+|`+$/g, '').trim();
  if (s.length >= 2 && ((s[0] === '"' && s[s.length - 1] === '"') || (s[0] === "'" && s[s.length - 1] === "'"))) {
    const inner = s.slice(1, -1);
    if (!inner.includes(s[0])) s = inner;
  }
  return s;
}
function toMeasure(name, expr, fmt, desc){
  name = cleanField(name).replace(/^\[(.*)\]$/s, '$1').replace(/^'(.*)'$/s, '$1').trim();
  expr = (expr || '').replace(/\r/g, '');
  // strip a leading "Name =" if Copilot repeated the measure name
  const m = expr.match(/^\s*(?:'([^']+)'|\[([^\]]+)\]|([^=\n(\[]+?))\s*:?=\s*/);
  if (m) { const n = (m[1] || m[2] || m[3] || '').trim(); if (n && lc(n) === lc(name)) expr = expr.slice(m[0].length); }
  return { name, expression: expr, formatString: cleanField(fmt), description: oneLineKeepBreaks(cleanField(desc)) };
}

// Preferred format: @@@ MEASURE @@@ ... @@@ END @@@ blocks, no escaping needed.
// @@@ SKIPPED @@@ blocks carry a NAME and REASON for measures Copilot couldn't write.
function parseBlocks(t){
  const out = [];
  const parts = t.split(/@@@\s*(MEASURE|SKIPPED)\s*@@@/i);
  for (let p = 1; p < parts.length; p += 2) {
    const skipped = parts[p].toUpperCase() === 'SKIPPED';
    const body = parts[p + 1].split(/@@@\s*END\s*@@@/i)[0].replace(/^[ \t]*```[\w-]*[ \t]*$/gm, '');
    const re = /(^|\s)(NAME|FORMAT|DESCRIPTION|NOTES|REASON|DAX)[ \t]*:/g;
    const found = {};
    let r;
    while ((r = re.exec(body))) {
      const label = r[2];
      if (found[label]) continue;
      found[label] = { start: r.index + r[1].length, value: re.lastIndex };
      if (label === 'DAX') break; // everything after DAX: belongs to the expression
    }
    const order = Object.entries(found).sort((a, b) => a[1].start - b[1].start);
    const val = {};
    order.forEach(([label, pos], i) => {
      const end = i + 1 < order.length ? order[i + 1][1].start : body.length;
      val[label] = body.slice(pos.value, end);
    });
    if (skipped) {
      if (!found.NAME) continue;
      const m = toMeasure(val.NAME, '', '', '');
      m.skipped = true;
      m.reason = oneLine(cleanField(val.REASON || val.DESCRIPTION || ''));
      out.push(m);
      continue;
    }
    if (!found.NAME && !found.DAX) continue;
    let dax = (val.DAX || '').replace(/^[ \t]*\n/, '');
    const mm = toMeasure(val.NAME || '', dax, val.FORMAT || '', val.DESCRIPTION || '');
    if (val.NOTES) mm.notes = oneLine(cleanField(val.NOTES));
    out.push(mm);
  }
  return out;
}

// DAX that computes nothing: BLANK(), 0, "", TRUE()/FALSE(), ERROR("..."), or only comments.
function isPlaceholder(expr){
  const code = stripDax(expr || '').replace(/\s+/g, '');
  return /^(|BLANK\(\)|0|0\.0+|""|TRUE\(\)|FALSE\(\)|ERROR\(""\))$/i.test(code);
}

// Fallback for JSON-ish replies with unescaped quotes, missing [ or other damage:
// read each value from its key to the next known key, instead of trusting the quoting.
const JSON_KEYS = { name: 'name', measurename: 'name', measure: 'name', expression: 'expression', dax: 'expression', formula: 'expression',
  daxexpression: 'expression', formatstring: 'formatString', format: 'formatString', description: 'description', desc: 'description' };
function lenientJson(t){
  const keyAlt = Object.keys(JSON_KEYS).sort((a, b) => b.length - a.length).join('|');
  const startRe = new RegExp('"(' + keyAlt + ')"\\s*:\\s*"', 'gi');
  const endRe = new RegExp('"\\s*(?:,\\s*"(?:' + keyAlt + ')"\\s*:|\\}\\s*(?=,\\s*\\{|\\]|$))', 'gi');
  const objs = [];
  let cur = null, r, lastEnd = 0;
  while ((r = startRe.exec(t))) {
    if (r.index < lastEnd) continue;
    const field = JSON_KEYS[r[1].toLowerCase()];
    endRe.lastIndex = startRe.lastIndex;
    const e = endRe.exec(t);
    const end = e ? e.index : t.length;
    let v = t.slice(startRe.lastIndex, end);
    v = v.replace(/\\(["\\\/nrt])/g, (m, c) => ({ n: '\n', r: '', t: '\t', '"': '"', '\\': '\\', '/': '/' }[c]));
    if (!cur || field === 'name' && cur.name !== undefined || cur[field] !== undefined) { cur = {}; objs.push(cur); }
    cur[field] = v;
    lastEnd = end;
    startRe.lastIndex = end;
  }
  return objs.map(o => toMeasure(o.name || '', o.expression || '', o.formatString || '', o.description || ''));
}

function parseResponse(text){
  const res = { measures: [], error: null, format: '' };
  let t = (text || '').replace(/\r/g, '').trim();
  if (!t) return res;
  t = unMarkdown(t).replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/\u00A0/g, ' ');

  if (/@@@\s*(MEASURE|SKIPPED)\s*@@@/i.test(t)) {
    res.measures = parseBlocks(t);
    res.format = 'blocks';
    if (!res.measures.length) res.error = 'Measure blocks were found, but none had a NAME or DAX line. Check the reply and paste again.';
    return res;
  }

  // JSON: strict first, then lenient
  const j = t.replace(/^[ \t]*```[\w-]*[ \t]*$/gm, '');
  const a = j.search(/\[\s*\{/), c = j.indexOf('{'), d = j.lastIndexOf('}');
  let body = null;
  if (a >= 0) { const b = j.lastIndexOf(']'); body = j.slice(a, b > a ? b + 1 : undefined); }
  else if (c >= 0 && d > c) body = '[' + j.slice(c, d + 1) + ']';
  if (body) {
    for (const x of [body, repairJson(body)]) {
      try {
        let data = JSON.parse(x);
        if (!Array.isArray(data) && data && Array.isArray(data.measures)) data = data.measures;
        if (!Array.isArray(data)) data = [data];
        res.measures = data.filter(i => i && typeof i === 'object').map(i =>
          toMeasure(pick(i, ['name', 'measurename', 'measure']), pick(i, ['expression', 'dax', 'formula', 'daxexpression', 'definition']),
            pick(i, ['formatstring', 'format']), pick(i, ['description', 'desc'])));
        res.format = 'json';
        break;
      } catch (e) {}
    }
  }
  if (!res.measures.length) { res.measures = lenientJson(j); if (res.measures.length) res.format = 'json-repaired'; }
  if (!res.measures.length) res.error = 'No measures were found in the reply. Copy the prompt again from Step 3 and make sure Copilot answers inside a code block with @@@ MEASURE @@@ blocks.';
  return res;
}
function oneLineKeepBreaks(s){ return (s || '').replace(/\r/g, '').split('\n').map(x => x.trim()).filter(Boolean).join('\n'); }

// Remove comments without touching "//" or "--" inside string literals (URLs, SVG namespaces)
function stripComments(e){
  return (e || '').replace(/"(?:[^"]|"")*"|\/\*[\s\S]*?\*\/|\/\/[^\n]*|--[^\n]*/g, m => m[0] === '"' ? m : ' ');
}
function stripDax(e){
  return stripComments(e).replace(/"(?:[^"]|"")*"/g, '""');
}

function validate(measures, model, opts){
  const target = (opts && opts.targetTable) || '_Measures';
  const hasModel = model && (model.tables.length || model.columns.length);
  const existing = new Map(); (model ? model.measures : []).forEach(m => existing.set(lc(m.name), m));
  const tableSet = new Map(); (model ? model.tables : []).forEach(t => tableSet.set(lc(t.name), t));
  const colsByTable = new Map();
  (model ? model.columns : []).forEach(c => { const k = lc(c.table); if (!colsByTable.has(k)) colsByTable.set(k, new Set()); colsByTable.get(k).add(lc(c.name)); });
  const allColNames = new Set((model ? model.columns : []).map(c => lc(c.name)));
  const batch = new Map();
  const notWritten = m => m.skipped || isPlaceholder(m.expression);
  measures.filter(m => !notWritten(m)).forEach(m => { const k = lc(m.name); batch.set(k, (batch.get(k) || 0) + 1); });
  return measures.map(m => {
    // Copilot said it couldn't write this one, or wrote a placeholder instead of a calculation
    if (m.skipped) {
      return { measure: m, status: 'skip', errors: [], warns: [], infos: [m.reason ? 'Copilot’s reason: ' + m.reason : 'Copilot skipped this measure without giving a reason.'] };
    }
    if (m.expression.trim() && isPlaceholder(m.expression)) {
      const infos = ['The DAX is only ' + oneLine(m.expression) + ', a placeholder rather than a calculation.'];
      if (m.description) infos.push('Copilot’s note: ' + oneLine(m.description));
      return { measure: m, status: 'skip', errors: [], warns: [], infos };
    }
    const errors = [], warns = [], infos = [];
    let replaces = false;
    if (!m.name) errors.push('Missing a name.');
    if (!m.expression.trim()) errors.push('Missing a DAX expression.');
    if (m.name && batch.get(lc(m.name)) > 1) errors.push('This name appears more than once in the reply.');
    if (m.name && /[\[\]]/.test(m.name)) errors.push('Measure names can\u2019t contain [ or ].');
    const ex = existing.get(lc(m.name));
    if (ex) {
      if (ex.remote) errors.push('A measure in the remote model already uses this name. Measure names must be unique across the model.');
      else if (lc(ex.table) === lc(target)) { replaces = true; infos.push('Replaces the existing measure with this name in ' + qName(ex.table) + '.'); }
      else errors.push('Name already used by a measure in ' + qName(ex.table) + '. Measure names must be unique across the model.');
    }
    if (m.name && colsByTable.has(lc(target)) && colsByTable.get(lc(target)).has(lc(m.name))) errors.push('A column in ' + qName(target) + ' already has this name.');
    if (hasModel && m.expression) {
      const code = stripDax(m.expression);
      const seen = new Set();
      const tcRe = /(?:'((?:[^']|'')+)'|([A-Za-z_][A-Za-z0-9_]*))\s*\[((?:[^\]]|\]\])+)\]/g;
      let r;
      while ((r = tcRe.exec(code))) {
        const tn = (r[1] !== undefined ? r[1].replace(/''/g, "'") : r[2]);
        const cn = r[3].replace(/\]\]/g, ']');
        const key = lc(tn) + '|' + lc(cn);
        if (seen.has(key)) continue; seen.add(key);
        if (!tableSet.has(lc(tn))) { warns.push('Table ' + qName(tn) + ' isn\u2019t in the model export.'); continue; }
        const cols = colsByTable.get(lc(tn));
        const isCol = cols && cols.has(lc(cn));
        const isMeas = existing.has(lc(cn)) || batch.has(lc(cn));
        if (!isCol && !isMeas) warns.push(qName(tn) + bracket(cn) + ' isn\u2019t a column in that table.');
      }
      const qtRe = /'((?:[^']|'')+)'(\s*\[)?/g;
      while ((r = qtRe.exec(code))) {
        if (r[2]) continue; // 'Table'[Column] already checked above
        const tn = r[1].replace(/''/g, "'");
        const key = 't|' + lc(tn);
        if (seen.has(key)) continue; seen.add(key);
        if (!tableSet.has(lc(tn))) warns.push('Table ' + qName(tn) + ' isn’t in the model export.');
      }
      const bareRe = /(^|[^\w'\]])\[((?:[^\]]|\]\])+)\]/g;
      while ((r = bareRe.exec(code))) {
        const n = r[2].replace(/\]\]/g, ']');
        const key = 'm|' + lc(n);
        if (seen.has(key)) continue; seen.add(key);
        // skip when this bracket is actually a Table [Column] with a space before it
        const before = code.slice(0, r.index + r[1].length).replace(/\s+$/, '');
        if (/('(?:[^']|'')+'|[A-Za-z_][A-Za-z0-9_]*)$/.test(before) && !/\b(VAR|RETURN|IN|AND|OR|NOT|TRUE|FALSE)$/i.test(before)) {
          const tm = before.match(/('(?:[^']|'')+'|[A-Za-z_][A-Za-z0-9_]*)$/)[1];
          const tn = tm[0] === "'" ? tm.slice(1, -1).replace(/''/g, "'") : tm;
          if (tableSet.has(lc(tn))) continue;
        }
        if (lc(n) === lc(m.name)) { errors.push('The measure refers to itself.'); continue; }
        if (existing.has(lc(n)) || batch.has(lc(n))) continue;
        if (allColNames.has(lc(n))) continue; // column in row context
        warns.push(bracket(n) + ' isn\u2019t a measure in the model or in this reply.');
      }
    }
    if (m.expression && /KEEPFILTERS\s*\(\s*VALUES\s*\(/i.test(stripDax(m.expression))) {
      warns.push('KEEPFILTERS ( VALUES ( ... ) ) keeps the filter already in place, so it changes nothing. If you wanted one measure per value, list the values (Step 3, \u201cColumn values\u201d) and ask again.');
    }
    const kvs = opts && opts.knownValues;
    if (kvs && kvs.size && m.expression) {
      const code = stripComments(m.expression);
      const rx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      for (const kv of kvs.values()) {
        if (kv.distinct !== null && kv.distinct > kv.values.length) continue; // incomplete list: can't judge
        const mm = kv.ref.match(/^'((?:[^']|'')+)'\[(.*)\]$/);
        if (!mm) continue;
        const tn = mm[1].replace(/''/g, "'"), cn = mm[2].replace(/\]\]/g, ']');
        const tPat = "(?:'" + rx(tn.replace(/'/g, "''")) + "'" + (/^[A-Za-z_]\w*$/.test(tn) ? '|' + rx(tn) : '') + ')';
        const colPat = tPat + '\\s*\\[' + rx(cn.replace(/\]/g, ']]')) + '\\]';
        const eqRe = new RegExp(colPat + '\\s*(?:==|=|<>)\\s*"((?:[^"]|"")*)"', 'gi');
        const inRe = new RegExp(colPat + '\\s+IN\\s*\\{([^}]*)\\}', 'gi');
        const known = new Set(kv.values.map(lc));
        const found = [];
        let r;
        while ((r = eqRe.exec(code))) found.push(r[1].replace(/""/g, '"'));
        while ((r = inRe.exec(code))) (r[1].match(/"((?:[^"]|"")*)"/g) || []).forEach(l => found.push(l.slice(1, -1).replace(/""/g, '"')));
        for (const v of new Set(found)) if (!known.has(lc(v))) warns.push(daxString(v) + ' isn\u2019t one of the known values of ' + kv.ref + '.');
      }
    }
    if (m.notes) infos.unshift('Copilot\u2019s approach: ' + m.notes);
    if (!m.formatString) infos.push('No format string. Power BI will use General.');
    let status = 'ok';
    if (errors.length) status = 'err'; else if (warns.length) status = 'warn'; else if (replaces) status = 'replace';
    return { measure: m, status, errors, warns, infos };
  });
}

function tmdlName(n){ return /^[A-Za-z_][A-Za-z0-9_]*$/.test(n) ? n : qName(n); }
function tmdlValue(v){
  if (/"/.test(v) || /^\s|\s$/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}
function exprLines(expr){
  let lines = expr.replace(/\r/g, '').split('\n').map(l => l.replace(/\s+$/, ''));
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  lines = lines.map(l => { const m = l.match(/^[ \t]*/)[0]; return m.replace(/\t/g, '    ') + l.slice(m.length); });
  const ind = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
  return lines.map(l => {
    if (!l.trim()) return '';
    const s = l.slice(isFinite(ind) ? ind : 0);
    const lead = s.match(/^ */)[0].length;
    return TAB.repeat(Math.floor(lead / 4)) + ' '.repeat(lead % 4) + s.slice(lead);
  });
}

function normFolder(f){ return (f || '').trim().replace(/\//g, '\\').replace(/\\{2,}/g, '\\').replace(/^\\|\\$/g, ''); }

function toTmdl(measures, opts){
  const mode = opts.mode || 'script';
  const table = (opts.targetTable || '_Measures').trim();
  const folder = normFolder(opts.folder);
  const base = mode === 'script' ? 2 : 1;
  const out = [];
  if (mode === 'script') { out.push('createOrReplace', '', TAB + 'ref table ' + tmdlName(table), ''); }
  for (const m of measures) {
    const ind = TAB.repeat(base);
    if (m.description) m.description.split('\n').forEach(d => out.push(ind + '/// ' + d.trim()));
    const lines = exprLines(m.expression);
    if (lines.length <= 1) out.push(ind + 'measure ' + tmdlName(m.name) + ' = ' + (lines[0] || '').trim());
    else {
      out.push(ind + 'measure ' + tmdlName(m.name) + ' =');
      lines.forEach(l => out.push(l ? TAB.repeat(base + 2) + l : ''));
    }
    if (m.formatString) out.push(TAB.repeat(base + 1) + 'formatString: ' + tmdlValue(m.formatString));
    if (folder) out.push(TAB.repeat(base + 1) + 'displayFolder: ' + tmdlValue(folder));
    out.push('');
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.join('\n') + '\n';
}

function testQuery(measures){
  if (!measures.length) return '';
  const rows = measures.map((m, i) => TAB + '"' + m.name.replace(/"/g, '""') + '", ' + bracket(m.name) + (i < measures.length - 1 ? ',' : ''));
  return ['// Run in DAX query view after applying the TMDL.', 'EVALUATE', 'ROW (', ...rows, ')'].join('\n');
}
/*CORE-END*/