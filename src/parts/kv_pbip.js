/* ---------- KPI Visualizer: measures and columns from a PBIP folder ----------
   Reads the semantic model only (*.SemanticModel/definition/tables/*.tmdl, or model.bim) and turns it
   into the same rows as the model export, so everything else on the page works the same way. */
const KV_SKIP_DIRS = new Set(['.git', 'node_modules', '.pbi', '.vs', 'StaticResources', 'RegisteredResources']);
const kvSkipDir = n => KV_SKIP_DIRS.has(n) || /\.(Report|Dataset)$/i.test(n);
const kvWanted = p => /\.SemanticModel\/(definition\/tables\/[^\/]+\.tmdl|model\.bim)$/i.test(p);
async function kvDecode(file){
  const buf = await file.arrayBuffer();
  let t; try { t = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { t = new TextDecoder('windows-1252').decode(buf); }
  return t.replace(/^﻿/, '');
}
async function kvWalkHandle(dir, prefix, out){
  for await (const [name, h] of dir.entries()) {
    if (h.kind === 'directory') { if (!kvSkipDir(name)) await kvWalkHandle(h, prefix + '/' + name, out); }
    else if (/\.(tmdl|bim)$/i.test(name)) out.push({ path: prefix + '/' + name, file: await h.getFile() });
  }
}
function kvWalkEntry(entry, prefix, out){
  return new Promise(resolve => {
    if (entry.isFile) { if (/\.(tmdl|bim)$/i.test(entry.name)) entry.file(f => { out.push({ path: prefix + '/' + entry.name, file: f }); resolve(); }, () => resolve()); else resolve(); return; }
    if (kvSkipDir(entry.name)) { resolve(); return; }
    const reader = entry.createReader(); const all = [];
    const next = () => reader.readEntries(batch => { if (!batch.length) { Promise.all(all.map(e => kvWalkEntry(e, prefix + '/' + entry.name, out))).then(resolve); return; } all.push(...batch); next(); }, () => resolve());
    next();
  });
}
const kvTmdlUnquote = s => { s = (s || '').trim(); return /^'.*'$/.test(s) ? s.slice(1, -1).replace(/''/g, "'") : /^".*"$/.test(s) ? s.slice(1, -1).replace(/""/g, '"') : s; };
const kvTabs = l => /^\t*/.exec(l)[0].length;
const KV_DECL = /^(\t*)(table|column|measure)\s+('(?:[^']|'')*'|[^\s=]+)/;
// one table file -> { tables, columns, measures }
function kvParseTmdl(text, out){
  const lines = text.replace(/\r/g, '').split('\n');
  let table = null, tIndent = 0, obj = null, oIndent = 0;
  for (const line of lines) {
    const m = KV_DECL.exec(line);
    if (m) {
      const ind = m[1].length, kind = m[2], name = kvTmdlUnquote(m[3]);
      if (kind === 'table') { table = name; tIndent = ind; obj = null; out.tables.push({ name, hidden: false }); continue; }
      if (table && ind > tIndent) { obj = { kind, table, name, type: '', folder: '', hidden: false, key: false }; oIndent = ind; (kind === 'measure' ? out.measures : out.columns).push(obj); continue; }
    }
    const t = line.trim(); if (!t || t.startsWith('///')) continue;
    const ind = kvTabs(line);
    if (obj && ind <= oIndent) obj = null;
    if (obj && ind === oIndent + 1) {
      const p = /^(\w+)\s*:\s*(.*)$/.exec(t);
      if (p) {
        const k = p[1].toLowerCase(), v = kvTmdlUnquote(p[2]);
        if (k === 'formatstring' && obj.kind === 'measure') obj.type = v;
        else if (k === 'datatype' && obj.kind === 'column') obj.type = v;
        else if (k === 'displayfolder') obj.folder = v;
      } else if (/^ishidden$/i.test(t)) obj.hidden = true;
      else if (/^iskey$/i.test(t)) obj.key = true;
    } else if (table && !obj && ind === tIndent + 1 && /^ishidden$/i.test(t)) out.tables[out.tables.length - 1].hidden = true;
  }
}
function kvParseBim(text, out){
  let j; try { j = JSON.parse(text); } catch (e) { return; }
  ((j.model || {}).tables || []).forEach(t => {
    out.tables.push({ name: t.name, hidden: !!t.isHidden });
    (t.columns || []).forEach(c => { if (c.type !== 'rowNumber') out.columns.push({ kind: 'column', table: t.name, name: c.name, type: c.dataType || '', folder: c.displayFolder || '', hidden: !!c.isHidden, key: !!c.isKey }); });
    (t.measures || []).forEach(m => out.measures.push({ kind: 'measure', table: t.name, name: m.name, type: m.formatString || '', folder: m.displayFolder || '', hidden: !!m.isHidden }));
  });
}
const kvDataType = t => ({ datetime: 'DateTime', int64: 'Int64', string: 'String', double: 'Double', decimal: 'Decimal', boolean: 'Boolean', binary: 'Binary' }[(t || '').toLowerCase()] || t);
// files: [{ path, text }] -> { text (export rows), measures, tables, model name } or { error }
function kvReadPbip(files){
  const out = { tables: [], columns: [], measures: [] };
  const sm = files.filter(f => kvWanted(f.path));
  const names = [...new Set(sm.map(f => f.path.match(/([^\/]+)\.SemanticModel\//i)[1]))];
  if (!sm.length) return { error: 'No semantic model was found. Choose the folder that holds the .pbip file and the .SemanticModel folder.' };
  const pick = names[0], mine = sm.filter(f => f.path.includes(pick + '.SemanticModel/'));
  const tm = mine.filter(f => /\.tmdl$/i.test(f.path));
  if (tm.length) tm.forEach(f => kvParseTmdl(f.text, out)); else mine.forEach(f => kvParseBim(f.text, out));
  if (!out.measures.length && !out.columns.length) return { error: 'The semantic model in this folder has no tables that could be read.' };
  const cell = s => String(s || '').replace(/[\t\r\n]+/g, ' ');
  const rows = [['Kind', 'Table', 'Name', 'Type', 'Folder', 'Flags'].join('\t')];
  out.tables.forEach(t => rows.push(['Table', t.name, t.name, '', '', t.hidden ? 'hidden' : ''].map(cell).join('\t')));
  out.columns.forEach(c => rows.push(['Column', c.table, c.name, kvDataType(c.type), c.folder, [c.hidden ? 'hidden' : '', c.key ? 'key' : ''].filter(Boolean).join(' ')].map(cell).join('\t')));
  out.measures.forEach(m => rows.push(['Measure', m.table, m.name, m.type, m.folder, m.hidden ? 'hidden' : ''].map(cell).join('\t')));
  return { text: rows.join('\n'), name: pick, measures: out.measures.length, tables: out.tables.length, others: names.slice(1) };
}
