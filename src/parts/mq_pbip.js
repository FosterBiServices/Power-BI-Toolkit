
/* ---------- whole model: read every query from a PBIP folder ---------- */
// files: Map of 'folder/sub/file' -> text. Only .tmdl files and model.bim are used.
// Returns [{ key, name, format, queries: [{ name, loaded, code, resultType }] }], one per semantic model in the folder.
function pbipUnquote(v){
  v = (v || '').trim();
  return v.length > 1 && v[0] === "'" && v[v.length - 1] === "'" ? v.slice(1, -1).replace(/''/g, "'") : v;
}
function pbipTabs(line){ const m = /^\t*/.exec(line); return m[0].length; }
// strip the common leading tabs (TMDL indents expressions with tabs; the M code keeps its own spaces)
function pbipDedent(lines){
  const used = lines.filter(l => l.trim());
  const n = used.length ? Math.min(...used.map(pbipTabs)) : 0;
  return lines.map(l => l.slice(Math.min(n, pbipTabs(l)))).join('\n').replace(/^\n+|\s+$/g, '');
}
// An expression that starts after "=" on line i: on the same line, in ``` fences, or on the following lines
// indented at least minTabs. Returns { code, next } where next is the first line after it.
function pbipExpr(lines, i, rest, minTabs){
  rest = (rest || '').trim();
  if (rest.startsWith('```')) {
    const first = rest.slice(3);
    if (first.trim().endsWith('```')) return { code: first.trim().slice(0, -3).trim(), next: i + 1 };
    const out = first.trim() ? [first] : [];
    let j = i + 1;
    for (; j < lines.length; j++) { if (lines[j].trim().endsWith('```')) { out.push(lines[j].replace(/\s*```\s*$/, '')); j++; break; } out.push(lines[j]); }
    return { code: pbipDedent(out), next: j };
  }
  const out = [];
  let j = i + 1;
  for (; j < lines.length; j++) { if (lines[j].trim() && pbipTabs(lines[j]) < minTabs) break; out.push(lines[j]); }
  const body = pbipDedent(out);
  return { code: rest ? (body ? rest + '\n' + body : rest) : body, next: j };
}
// A script copied from TMDL view starts with a command (createOrReplace...) and indents everything one more level
function pbipUnscript(text){
  const lines = text.replace(/\r/g, '').split('\n');
  if (!lines.some(l => /^(createOrReplace|create|alter)\s*$/.test(l))) return lines;
  return lines.filter(l => !/^(createOrReplace|create|alter|delete)\b/.test(l)).map(l => l.replace(/^\t/, ''));
}
function looksTmdl(text){ return /^(createOrReplace|create|alter)\s*$|^(ref\s+)?table\s+\S|^expression\s+\S.*=/m.test(text || '') && !/^[^\n]*\bkind\b[^\n]*\t[^\n]*\bname\b/i.test(text || ''); }
const SOURCE_MARK = '\u00A7source';
function pbipTmdlQueries(text){
  const lines = pbipUnscript(text);
  const tables = [], exprs = [];
  let table = null, part = null, desc = [];
  // keep a partition's or expression's other lines as they are, so a script can put it back unchanged
  const strip = (l, n) => l.slice(Math.min(n, pbipTabs(l)));
  for (let i = 0; i < lines.length; ) {
    const line = lines[i], d = pbipTabs(line), t = line.trim();
    let m;
    if (t.startsWith('///')) { desc.push(strip(line, d)); i++; continue; }
    const before = desc; desc = [];
    if (d === 0 && (m = /^(?:ref\s+)?table\s+(.+?)\s*$/.exec(t))) { table = { name: pbipUnquote(m[1]), parts: [], policy: '' }; tables.push(table); part = null; i++; continue; }
    if (d === 0 && (m = /^expression\s+(.+?)\s*=(.*)$/.exec(t))) {
      table = null; part = null;
      const e = pbipExpr(lines, i, m[2], 2);
      const x = { name: pbipUnquote(m[1]), code: e.code, resultType: '', kind: 'm', desc: before, props: [] };
      // the expression's own properties, one level in
      let j = e.next;
      for (; j < lines.length; j++) {
        const l = lines[j]; if (l.trim() && pbipTabs(l) === 0) break;
        x.props.push(strip(l, 1));
        const a = /^\tannotation\s+PBI_ResultType\s*=\s*(.+?)\s*$/.exec(l); if (a) x.resultType = a[1];
        const k = /^\tkind\s*:\s*(\S+)/.exec(l); if (k) x.kind = k[1].toLowerCase();
      }
      if (x.kind === 'm') exprs.push(x);
      i = j; continue;
    }
    if (d === 0 && t) { table = null; part = null; i++; continue; }
    if (table && d === 1 && (m = /^partition\s+(.+?)\s*=\s*(\S+)\s*$/.exec(t))) {
      part = { name: pbipUnquote(m[1]), type: m[2].toLowerCase(), depth: d, desc: before, props: [], code: '' };
      if (part.type === 'm') table.parts.push(part);
      i++; continue;
    }
    if (table && d === 1 && t) part = null;
    if (table && part && part.type === 'm' && d > part.depth && (m = /^source\s*=(.*)$/.exec(t))) {
      const e = pbipExpr(lines, i, m[1], d + 1);
      part.code = e.code; part.props.push(SOURCE_MARK);
      i = e.next; continue;
    }
    if (table && part && d > part.depth && t) { part.props.push(strip(line, part.depth + 1)); i++; continue; }
    // incremental refresh: the query lives in the refresh policy, the partitions are made from it
    if (table && d >= 2 && (m = /^sourceExpression\s*=(.*)$/.exec(t))) { const e = pbipExpr(lines, i, m[1], d + 1); table.policy = e.code; i = e.next; continue; }
    i++;
  }
  tables.forEach(t => { t.parts = t.parts.filter(p => p.code.trim()); t.parts.forEach(p => { while (p.props.length && !p.props[p.props.length - 1].trim()) p.props.pop(); }); });
  exprs.forEach(x => { while (x.props.length && !x.props[x.props.length - 1].trim()) x.props.pop(); });
  return { tables, exprs };
}
function pbipJoin(v){ return Array.isArray(v) ? v.join('\n') : (v || ''); }
function pbipBimQueries(text){
  const j = JSON.parse(text.replace(/^﻿/, ''));
  const model = j.model || j;
  const tables = (model.tables || []).map(t => ({
    name: t.name || '',
    parts: (t.partitions || []).filter(p => p.source && /^m$/i.test(p.source.type || '')).map(p => ({ name: p.name || '', code: pbipJoin(p.source.expression).trim() })).filter(p => p.code),
    policy: t.refreshPolicy ? pbipJoin(t.refreshPolicy.sourceExpression).trim() : ''
  }));
  const exprs = (model.expressions || []).filter(e => !e.kind || /^m$/i.test(e.kind)).map(e => ({
    name: e.name || '', code: pbipJoin(e.expression).trim(),
    resultType: ((e.annotations || []).find(a => a.name === 'PBI_ResultType') || {}).value || ''
  }));
  return { tables, exprs };
}
// tmdl: read from TMDL, with each partition's and expression's other lines kept, so a TMDL script can put it back
function pbipQueryList(tables, exprs, tmdl){
  const out = [];
  tables.forEach(t => {
    const parts = t.parts.length ? t.parts : t.policy ? [{ name: t.name, code: t.policy }] : [];
    const seen = new Set();
    parts.forEach((p, k) => {
      if (seen.has(p.code)) return; seen.add(p.code);
      out.push({ name: k === 0 ? t.name : t.name + ' (' + p.name + ')', loaded: true, code: p.code, resultType: 'Table',
        table: t.parts.length ? t.name : '', partition: t.parts.length ? p.name : '', props: p.props ? (p.desc || []).map(l => '@' + l).concat(p.props).join('\n') : '', tmdl: !!tmdl && !!t.parts.length });
    });
  });
  exprs.filter(e => e.name && e.code.trim()).forEach(e => out.push({ name: e.name, loaded: false, code: e.code, resultType: e.resultType,
    props: e.props ? (e.desc || []).map(l => '@' + l).concat(e.props).join('\n') : '', tmdl: !!tmdl }));
  return out;
}
function readPbip(files){
  const groups = new Map();
  const keyOf = p => { const m = /^(.*?)\/definition\/.+\.tmdl$/i.exec(p) || /^(.*?)\/model\.bim$/i.exec(p); return m ? m[1] : null; };
  for (const [path, text] of files) {
    const p = path.replace(/\\/g, '/');
    let k = keyOf(p);
    if (k === null && /^definition\/.+\.tmdl$/i.test(p)) k = '';
    if (k === null && /^model\.bim$/i.test(p)) k = '';
    if (k === null) continue;
    if (!groups.has(k)) groups.set(k, { tmdl: [], bim: null });
    if (/\.tmdl$/i.test(p)) groups.get(k).tmdl.push([p, text]); else groups.get(k).bim = text;
  }
  const out = [];
  for (const [key, g] of groups) {
    const name = (key.split('/').pop() || 'Semantic model').replace(/\.(SemanticModel|Dataset)$/i, '');
    let res = null, format = '', error = '';
    if (g.tmdl.length) {
      const tables = [], exprs = [];
      g.tmdl.sort((a, b) => a[0].localeCompare(b[0])).forEach(([, text]) => { const r = pbipTmdlQueries(text); tables.push(...r.tables); exprs.push(...r.exprs); });
      res = { tables, exprs, tmdl: true }; format = 'TMDL';
    } else if (g.bim) {
      try { res = pbipBimQueries(g.bim); format = 'model.bim'; } catch (e) { error = 'model.bim couldn’t be read: ' + (e.message || e); }
    }
    out.push({ key, name, format, error, queries: res ? pbipQueryList(res.tables, res.exprs, res.tmdl) : [] });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
const TAB_MARK = '\u21E5';
// the same text the DAX export gives, so a folder and a pasted export go through one path
function queriesToExport(list){
  const cell = s => '"' + String(s).replace(/"/g, '""') + '"';
  const code = c => c.replace(/\r/g, '').replace(/\t/g, '    ').split('\n').join(NL_MARK);
  return 'Kind\tName\tResultType\tFrom\tTable\tPartition\tProps\tCode\n' + list.map(q => [q.loaded ? 'Table' : 'Query', cell(q.name), cell(q.resultType || ''), q.tmdl ? 'TMDL' : '', cell(q.table || ''), cell(q.partition || ''), cell((q.props || '').replace(/\t/g, TAB_MARK).split('\n').join(NL_MARK)), cell(code(q.code))].join('\t')).join('\n');
}

/* ---------- TMDL script: put commented queries back in one go, in TMDL view ---------- */
function tmdlName(n){ return /^[A-Za-z_][A-Za-z0-9_]*$/.test(n) ? n : "'" + n.replace(/'/g, "''") + "'"; }
// list: [{ item, code }] for items read from TMDL (item.tmdl). Each partition or expression is replaced as a whole,
// with its other lines (mode, lineageTag, queryGroup, annotations) copied back as they were read.
function tmdlScript(list){
  const ind = (n, l) => l.trim() ? '\t'.repeat(n) + l : '';
  const code = (c, n) => c.replace(/\r/g, '').replace(/\s+$/, '').split('\n').map(l => ind(n, l));
  const split = p => { const ls = (p || '').split('\n'); return { desc: ls.filter(l => l.startsWith('@')).map(l => l.slice(1)), props: ls.filter(l => !l.startsWith('@')) }; };
  const L = ['createOrReplace', ''];
  const byTable = new Map();
  list.filter(x => x.item.tmdl && x.item.partition).forEach(x => { if (!byTable.has(x.item.table)) byTable.set(x.item.table, []); byTable.get(x.item.table).push(x); });
  for (const [table, parts] of byTable) {
    L.push(ind(1, 'ref table ' + tmdlName(table)), '');
    parts.forEach(x => {
      const p = split(x.item.props), props = p.props.includes(SOURCE_MARK) ? p.props : p.props.concat([SOURCE_MARK]);
      p.desc.forEach(l => L.push(ind(2, l)));
      L.push(ind(2, 'partition ' + tmdlName(x.item.partition) + ' = m'));
      // the other lines in the order they were read, with the commented code where the source was
      props.forEach(l => { if (l === SOURCE_MARK) L.push(ind(3, 'source ='), ...code(x.code, 5), ''); else L.push(ind(3, l)); });
      L.push('');
    });
  }
  list.filter(x => x.item.tmdl && !x.item.loaded).forEach(x => {
    const p = split(x.item.props);
    p.desc.forEach(l => L.push(ind(1, l)));
    L.push(ind(1, 'expression ' + tmdlName(x.item.name) + ' ='), ...code(x.code, 3));
    p.props.forEach(l => L.push(ind(2, l)));
    L.push('');
  });
  return L.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
