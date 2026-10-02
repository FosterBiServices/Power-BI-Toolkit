
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
function pbipTmdlQueries(text){
  const lines = text.replace(/\r/g, '').split('\n');
  const tables = [], exprs = [];
  let table = null, part = null;
  for (let i = 0; i < lines.length; ) {
    const line = lines[i], d = pbipTabs(line), t = line.trim();
    let m;
    if (d === 0 && (m = /^table\s+(.+?)\s*$/.exec(t))) { table = { name: pbipUnquote(m[1]), parts: [], policy: '' }; tables.push(table); part = null; i++; continue; }
    if (d === 0 && (m = /^expression\s+(.+?)\s*=(.*)$/.exec(t))) {
      table = null; part = null;
      const e = pbipExpr(lines, i, m[2], 2);
      const x = { name: pbipUnquote(m[1]), code: e.code, resultType: '', kind: 'm' };
      // the expression's own properties, one level in
      let j = e.next;
      for (; j < lines.length; j++) {
        const l = lines[j]; if (l.trim() && pbipTabs(l) === 0) break;
        const a = /^\tannotation\s+PBI_ResultType\s*=\s*(.+?)\s*$/.exec(l); if (a) x.resultType = a[1];
        const k = /^\tkind\s*:\s*(\S+)/.exec(l); if (k) x.kind = k[1].toLowerCase();
      }
      if (x.kind === 'm') exprs.push(x);
      i = j; continue;
    }
    if (d === 0 && t) { table = null; part = null; i++; continue; }
    if (table && d === 1 && (m = /^partition\s+(.+?)\s*=\s*(\S+)\s*$/.exec(t))) { part = { name: pbipUnquote(m[1]), type: m[2].toLowerCase(), depth: d }; i++; continue; }
    if (table && d === 1 && t) part = null;
    if (table && part && part.type === 'm' && d > part.depth && (m = /^source\s*=(.*)$/.exec(t))) {
      const e = pbipExpr(lines, i, m[1], d + 1);
      if (e.code.trim()) table.parts.push({ name: part.name, code: e.code });
      i = e.next; continue;
    }
    // incremental refresh: the query lives in the refresh policy, the partitions are made from it
    if (table && d >= 2 && (m = /^sourceExpression\s*=(.*)$/.exec(t))) { const e = pbipExpr(lines, i, m[1], d + 1); table.policy = e.code; i = e.next; continue; }
    i++;
  }
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
function pbipQueryList(tables, exprs){
  const out = [];
  tables.forEach(t => {
    const parts = t.parts.length ? t.parts : t.policy ? [{ name: t.name, code: t.policy }] : [];
    const seen = new Set();
    parts.forEach((p, k) => {
      if (seen.has(p.code)) return; seen.add(p.code);
      out.push({ name: k === 0 ? t.name : t.name + ' (' + p.name + ')', loaded: true, code: p.code, resultType: 'Table' });
    });
  });
  exprs.filter(e => e.name && e.code.trim()).forEach(e => out.push({ name: e.name, loaded: false, code: e.code, resultType: e.resultType }));
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
      res = { tables, exprs }; format = 'TMDL';
    } else if (g.bim) {
      try { res = pbipBimQueries(g.bim); format = 'model.bim'; } catch (e) { error = 'model.bim couldn’t be read: ' + (e.message || e); }
    }
    out.push({ key, name, format, error, queries: res ? pbipQueryList(res.tables, res.exprs) : [] });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
// the same text the DAX export gives, so a folder and a pasted export go through one path
function queriesToExport(list){
  const cell = s => '"' + String(s).replace(/"/g, '""') + '"';
  const code = c => c.replace(/\r/g, '').replace(/\t/g, '    ').split('\n').join(NL_MARK);
  return 'Kind\tName\tResultType\tCode\n' + list.map(q => [q.loaded ? 'Table' : 'Query', cell(q.name), cell(q.resultType || ''), cell(code(q.code))].join('\t')).join('\n');
}
