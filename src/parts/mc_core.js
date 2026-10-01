
/* ---------- Model Compare: what changed between two model exports ----------
   Reads two exports of the toolkit's model export query (any version of it) and lists the changes object by object:
   tables, columns, measures, relationships and model settings, with renames detected and DAX shown side by side. */
const MC = (() => {
  const lc = s => (s || '').toLowerCase();
  // spacing, line breaks and optional quotes around table names don't change what DAX does
  const norm = s => (s || '').replace(/'([A-Za-z_][A-Za-z0-9_]*)'(?=\s*\[)/g, '$1').replace(/\s+/g, ' ').replace(/\s*([(),])\s*/g, '$1').trim();
  const skipName = n => /^RowNumber-/i.test(n);
  const skipTable = t => /^(LocalDateTable_|DateTableTemplate_)/i.test(t);

  // every row as { kind, table, name, props{...} }; columns the export doesn't have stay undefined
  function parse(text){
    const raw = (text || '').replace(/\r/g, '');
    if (!raw.trim()) return null;
    const lines = raw.split('\n');
    let h = -1, map = {};
    for (let i = 0; i < Math.min(lines.length, 15); i++) {
      const cells = lines[i].split('\t').map(c => lc(unquoteCell(c.trim())).replace(/^.*\[|\]$/g, ''));
      if (cells.includes('kind') && cells.includes('table') && cells.includes('name')) { h = i; cells.forEach((c, j) => { map[c] = j; }); break; }
    }
    if (h < 0) return { error: 'The header row (Kind, Table, Name…) wasn’t found. Paste the results of the model export query, copied with the Copy button above the results grid.' };
    const has = k => map[k] !== undefined;
    const out = { rows: [], has: { summarize: has('summarize'), sortby: has('sortby'), hierarchies: has('hierarchies'), storage: has('storage'), source: has('source'), model: false } };
    for (let i = h + 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const c = lines[i].split('\t');
      const g = k => has(k) ? restore(unquoteCell((c[map[k]] || '').trim())) : undefined;
      const kind = lc(g('kind')), table = g('table') || '', name = g('name') || '';
      if (skipTable(table) || skipName(name) || skipTable(g('totable') || '')) continue;
      const flags = lc(g('flags') || '').split(/\s+/).filter(Boolean);
      if (kind === 'table' && flags.includes('private')) continue;
      if (kind === 'model') out.has.model = true;
      out.rows.push({ kind, table, name, type: g('type'), folder: g('folder'), flags, description: g('description'), expression: g('expression'),
        toTable: g('totable'), toColumn: g('tocolumn'), summarize: g('summarize'), sortBy: g('sortby'), hierarchies: g('hierarchies'), storage: g('storage'), source: g('source') });
    }
    out.has.calc = out.rows.some(r => r.kind === 'table' && (r.expression || '').trim());
    if (!out.rows.length) return { error: 'The header row was found but no model rows came with it. Paste the full results.' };
    return out;
  }
  const count = (m, k) => m.rows.filter(r => r.kind === k).length;
  function describe(m){ return { tables: count(m, 'table'), columns: count(m, 'column'), measures: count(m, 'measure'), rels: count(m, 'relationship') }; }

  /* ----- keys and properties ----- */
  const KEY = {
    table: r => lc(r.name),
    column: r => lc(r.table) + '|' + lc(r.name),
    measure: r => lc(r.name),
    relationship: r => [r.table, r.name, r.toTable, r.toColumn].map(lc).join('|'),
    model: () => 'model'
  };
  const flagSet = r => new Set(r.flags);
  const dirOf = r => r.flags.find(f => /direction/.test(f)) || '';
  const DIR = { onedirection: 'single', bothdirections: 'both', automatic: 'automatic' };
  // [id, label, get(row), importance]
  const PROPS = {
    table: [['expression', 'DAX (calculated table or field parameter)', r => r.expression || '', 'change'], ['hidden', 'Hidden', r => flagSet(r).has('hidden'), 'house'], ['category', 'Data category', r => r.type || '', 'house'], ['description', 'Description', r => r.description || '', 'house'],
      ['storage', 'Storage mode', r => r.storage, 'change'], ['source', 'Source model', r => r.source, 'change']],
    column: [['expression', 'DAX (calculated column)', r => r.expression || '', 'change'], ['type', 'Data type', r => r.type || '', 'attention'], ['hidden', 'Hidden', r => flagSet(r).has('hidden'), 'house'],
      ['key', 'Key column', r => flagSet(r).has('key'), 'house'], ['folder', 'Display folder', r => r.folder || '', 'house'], ['description', 'Description', r => r.description || '', 'house'],
      ['summarize', 'Summarize by', r => r.summarize, 'house'], ['sortBy', 'Sort by column', r => r.sortBy, 'change'], ['hierarchies', 'Hierarchies', r => r.hierarchies, 'house']],
    measure: [['expression', 'DAX', r => r.expression || '', 'change'], ['format', 'Format string', r => r.type || '', 'change'], ['dynamic', 'Dynamic format string', r => flagSet(r).has('dynamic-format'), 'change'],
      ['table', 'Home table', r => r.table || '', 'house'], ['folder', 'Display folder', r => r.folder || '', 'house'], ['description', 'Description', r => r.description || '', 'house'], ['hidden', 'Hidden', r => flagSet(r).has('hidden'), 'house']],
    relationship: [['card', 'Cardinality', r => r.type || '', 'attention'], ['dir', 'Cross-filter direction', r => DIR[dirOf(r)] || dirOf(r), 'attention'], ['active', 'Active', r => !flagSet(r).has('inactive'), 'attention']],
    model: [['implicit', 'Discourage implicit measures', r => flagSet(r).has('discourage-implicit'), 'house']]
  };
  const KIND_LABEL = { table: 'Table', column: 'Column', measure: 'Measure', relationship: 'Relationship', model: 'Model' };

  const bracket = n => '[' + n.replace(/\]/g, ']]') + ']';
  const qn = n => "'" + n.replace(/'/g, "''") + "'";
  function label(r){
    if (r.kind === 'table') return qn(r.name);
    if (r.kind === 'column') return qn(r.table) + bracket(r.name);
    if (r.kind === 'measure') return bracket(r.name);
    if (r.kind === 'relationship') return qn(r.table) + bracket(r.name) + ' → ' + qn(r.toTable) + bracket(r.toColumn);
    return 'Model settings';
  }

  // rewrite old names to new ones in a DAX expression, so a rename alone doesn't count as a DAX change
  function renameIn(expr, ren){
    let e = expr || '';
    ren.tables.forEach(([a, b]) => {
      const re = new RegExp("'" + a.replace(/'/g, "''").replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'" + '|(?<![\\w\'\\]])' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=\\s*\\[)', 'gi');
      e = e.replace(re, qn(b));
    });
    ren.columns.forEach(([t, a, b]) => {
      const re = new RegExp("('" + t.replace(/'/g, "''").replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'|" + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')\\s*\\[' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\]', 'gi');
      e = e.replace(re, (m0, tp) => tp + '[' + b + ']');
    });
    ren.measures.forEach(([a, b]) => { e = e.replace(new RegExp('(?<![\\w\'\\]])\\[' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\]', 'gi'), '[' + b + ']'); });
    return e;
  }

  function compare(A, B){
    const by = (m, k) => { const x = new Map(); m.rows.filter(r => r.kind === k).forEach(r => x.set(KEY[k](r), r)); return x; };
    const changes = [];
    const ren = { tables: [], columns: [], measures: [] };
    const push = (c) => { changes.push(c); return c; };

    // tables first (their renames carry into columns and relationships)
    const tA = by(A, 'table'), tB = by(B, 'table');
    const colsOf = (m, t) => m.rows.filter(r => r.kind === 'column' && lc(r.table) === lc(t)).map(r => lc(r.name)).sort().join('|');
    const tGone = [...tA.keys()].filter(k => !tB.has(k)), tNew = [...tB.keys()].filter(k => !tA.has(k));
    tGone.slice().forEach(k => {
      const a = tA.get(k), sig = colsOf(A, a.name);
      if (!sig || sig.split('|').length < 2) return;
      const match = tNew.filter(n => colsOf(B, tB.get(n).name) === sig);
      if (match.length === 1) { const b = tB.get(match[0]); ren.tables.push([a.name, b.name]); tGone.splice(tGone.indexOf(k), 1); tNew.splice(tNew.indexOf(match[0]), 1); push({ kind: 'table', type: 'renamed', obj: b, before: a, what: 'Renamed from ' + qn(a.name), imp: 'attention' }); propDiff('table', a, b); }
    });
    const tMap = new Map(ren.tables.map(([a, b]) => [lc(a), b]));
    const T = t => tMap.get(lc(t)) || t;
    tGone.forEach(k => push({ kind: 'table', type: 'removed', obj: tA.get(k), imp: 'attention' }));
    tNew.forEach(k => push({ kind: 'table', type: 'added', obj: tB.get(k), imp: 'change' }));
    tA.forEach((a, k) => { if (tB.has(k)) propDiff('table', a, tB.get(k)); });

    // columns (keys in A mapped through table renames)
    const cA = new Map(), cB = by(B, 'column');
    A.rows.filter(r => r.kind === 'column').forEach(r => cA.set(lc(T(r.table)) + '|' + lc(r.name), r));
    const cGone = [...cA.keys()].filter(k => !cB.has(k)), cNew = [...cB.keys()].filter(k => !cA.has(k));
    const sameCol = (a, b) => lc(T(a.table)) === lc(b.table) && (a.type || '') === (b.type || '') && ((a.expression && norm(a.expression) === norm(b.expression)) || (a.description && a.description === b.description) || (!a.expression && !b.expression && a.sortBy && a.sortBy === b.sortBy));
    cGone.slice().forEach(k => {
      const a = cA.get(k), match = cNew.filter(n => sameCol(a, cB.get(n)));
      const others = cGone.filter(g => sameCol(cA.get(g), cB.get(match[0] || '') || {}));
      if (match.length === 1 && others.length === 1) { const b = cB.get(match[0]); ren.columns.push([b.table, a.name, b.name]); cGone.splice(cGone.indexOf(k), 1); cNew.splice(cNew.indexOf(match[0]), 1); push({ kind: 'column', type: 'renamed', obj: b, before: a, what: 'Renamed from ' + bracket(a.name), imp: 'attention' }); propDiff('column', a, b); }
    });
    // one column gone and one new in the same table, with the same data type: most likely a rename
    const tablesTouched = new Set(cGone.map(k => lc(T(cA.get(k).table))));
    tablesTouched.forEach(t => {
      const g = cGone.filter(k => lc(T(cA.get(k).table)) === t), n = cNew.filter(k => lc(cB.get(k).table) === t);
      if (g.length === 1 && n.length === 1 && (cA.get(g[0]).type || '') === (cB.get(n[0]).type || '') && !tNew.includes(t)) {
        const a = cA.get(g[0]), b = cB.get(n[0]);
        ren.columns.push([b.table, a.name, b.name]); cGone.splice(cGone.indexOf(g[0]), 1); cNew.splice(cNew.indexOf(n[0]), 1);
        push({ kind: 'column', type: 'renamed', obj: b, before: a, what: 'Probably renamed from ' + bracket(a.name), probable: true, imp: 'attention' }); propDiff('column', a, b);
      }
    });
    cGone.forEach(k => { const a = cA.get(k); if (!tGone.includes(lc(a.table))) push({ kind: 'column', type: 'removed', obj: a, imp: 'attention' }); });
    cNew.forEach(k => { const b = cB.get(k); if (!tNew.includes(lc(b.table))) push({ kind: 'column', type: 'added', obj: b, imp: 'change' }); });
    cA.forEach((a, k) => { if (cB.has(k)) propDiff('column', a, cB.get(k)); });

    // measures (unique names model-wide)
    const mA = by(A, 'measure'), mB = by(B, 'measure');
    const mGone = [...mA.keys()].filter(k => !mB.has(k)), mNew = [...mB.keys()].filter(k => !mA.has(k));
    mGone.slice().forEach(k => {
      const a = mA.get(k); if (norm(a.expression).length < 4) return;
      const ea = norm(renameIn(a.expression, ren));
      const match = mNew.filter(n => norm(mB.get(n).expression) === ea);
      if (match.length === 1) { const b = mB.get(match[0]); ren.measures.push([a.name, b.name]); mGone.splice(mGone.indexOf(k), 1); mNew.splice(mNew.indexOf(match[0]), 1); push({ kind: 'measure', type: 'renamed', obj: b, before: a, what: 'Renamed from ' + bracket(a.name), imp: 'attention' }); }
    });
    mGone.forEach(k => { push({ kind: 'measure', type: 'removed', obj: mA.get(k), imp: 'attention' }); });
    mNew.forEach(k => push({ kind: 'measure', type: 'added', obj: mB.get(k), imp: 'change' }));
    mA.forEach((a, k) => { if (mB.has(k)) propDiff('measure', a, mB.get(k)); });
    ren.measures.forEach(([a, b]) => propDiff('measure', mA.get(lc(a)), mB.get(lc(b)), true));

    // relationships (keys mapped through table and column renames)
    const colRen = c => { const x = ren.columns.find(([t, a]) => lc(t) === lc(T(c[0])) && lc(a) === lc(c[1])); return x ? x[2] : c[1]; };
    const rKey = r => [T(r.table), colRen([r.table, r.name]), T(r.toTable), colRen([r.toTable, r.toColumn])].map(lc).join('|');
    const rA = new Map(A.rows.filter(r => r.kind === 'relationship').map(r => [rKey(r), r])), rB = by(B, 'relationship');
    rA.forEach((a, k) => { if (!rB.has(k)) push({ kind: 'relationship', type: 'removed', obj: a, imp: 'attention' }); else propDiff('relationship', a, rB.get(k)); });
    rB.forEach((b, k) => { if (!rA.has(k)) push({ kind: 'relationship', type: 'added', obj: b, imp: 'change' }); });

    // model settings: only when both exports include them
    const moA = A.rows.find(r => r.kind === 'model'), moB = B.rows.find(r => r.kind === 'model');
    if (moA && moB) propDiff('model', moA, moB);

    function propDiff(kind, a, b, quiet){
      const diffs = [];
      PROPS[kind].forEach(([id, lab, get, imp]) => {
        let va = get(a), vb = get(b);
        if (va === undefined || vb === undefined) return; // not in one of the exports
        if (id === 'expression' && kind === 'table' && !(A.has.calc && B.has.calc)) return; // an older export query has no calculated table DAX
        if (id === 'expression' && kind !== 'relationship') {
          if (va === vb) return;
          const ra = renameIn(va, ren), renamed = ra !== va;
          if (ra.trim() === vb.trim()) { if (!quiet) diffs.push({ id, label: lab, before: va, after: vb, imp: 'house', note: 'Updated for a rename only' }); return; }
          if (norm(ra) === norm(vb)) { diffs.push({ id, label: lab, before: va, after: vb, imp: 'house', note: renamed ? 'Updated for a rename, and layout changes' : 'Layout only (spacing, line breaks or quotes)' }); return; }
          diffs.push({ id, label: lab, before: va, after: vb, imp, code: true });
          return;
        }
        if (id === 'table' && kind === 'measure') { va = T(va); }
        if (id === 'sortBy' || id === 'hierarchies' || id === 'description' || id === 'folder' || id === 'category') { if ((va || '') === (vb || '')) return; }
        if (va === vb) return;
        diffs.push({ id, label: lab, before: va, after: vb, imp });
      });
      if (!diffs.length) return;
      const top = diffs.some(d => d.imp === 'attention') ? 'attention' : diffs.some(d => d.imp === 'change') ? 'change' : 'house';
      const ex = changes.find(c => c.type === 'renamed' && c.obj === b);
      if (ex) { ex.diffs = (ex.diffs || []).concat(diffs); return; }
      push({ kind, type: 'changed', obj: b, before: a, diffs, imp: top });
    }

    const order = { attention: 0, change: 1, house: 2 }, kinds = ['table', 'column', 'measure', 'relationship', 'model'], types = ['removed', 'renamed', 'added', 'changed'];
    changes.forEach(c => { c.id = c.kind + ':' + c.type + ':' + label(c.obj); c.label = label(c.obj); });
    changes.sort((a, b) => kinds.indexOf(a.kind) - kinds.indexOf(b.kind) || types.indexOf(a.type) - types.indexOf(b.type) || a.label.localeCompare(b.label));
    return { changes, renames: ren, summary: summarize(changes) };
  }
  function summarize(changes){
    const s = {};
    changes.forEach(c => { const k = c.kind + '|' + c.type; s[k] = (s[k] || 0) + 1; });
    return s;
  }
  function summaryText(sum){
    const kinds = [['table', 'table', 'tables'], ['column', 'column', 'columns'], ['measure', 'measure', 'measures'], ['relationship', 'relationship', 'relationships'], ['model', 'model setting', 'model settings']];
    const parts = [];
    kinds.forEach(([k, one, many]) => {
      const bits = ['added', 'changed', 'renamed', 'removed'].filter(t => sum[k + '|' + t]).map(t => sum[k + '|' + t] + ' ' + t);
      const n = ['added', 'changed', 'renamed', 'removed'].reduce((a, t) => a + (sum[k + '|' + t] || 0), 0);
      if (bits.length) parts.push(n + ' ' + (n === 1 ? one : many) + ' (' + bits.join(', ') + ')');
    });
    return parts.join('; ');
  }

  /* ----- what each change means for reports ----- */
  function why(c){
    if (c.type === 'removed' && c.kind !== 'relationship' && c.kind !== 'model') return 'Visuals, filters and other reports that use it will break.';
    if (c.type === 'renamed') return 'Visuals in this report follow the rename; other reports built on this model still use the old name and will break.';
    if (c.kind === 'relationship' && c.type === 'removed') return 'Visuals that combine these tables will show wrong or repeated totals.';
    if (c.kind === 'relationship') return 'Changes how filters flow between these tables: check the totals on visuals that use both.';
    if (c.diffs && c.diffs.some(d => d.id === 'type' && c.kind === 'column')) return 'A data type change can change sorting, totals and relationships on this column.';
    return '';
  }

  /* ----- line diff for DAX ----- */
  function diffLines(a, b){
    const A = (a || '').replace(/\r/g, '').split('\n'), B = (b || '').replace(/\r/g, '').split('\n');
    if (A.length * B.length > 250000) return [{ t: 'del', a: a }, { t: 'add', b: b }];
    const n = A.length, m = B.length, L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
    const eq = (x, y) => x.trim() === y.trim();
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = eq(A[i], B[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const out = []; let i = 0, j = 0;
    while (i < n && j < m) { if (eq(A[i], B[j])) { out.push({ t: 'same', a: A[i], b: B[j] }); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) out.push({ t: 'del', a: A[i++] }); else out.push({ t: 'add', b: B[j++] }); }
    while (i < n) out.push({ t: 'del', a: A[i++] }); while (j < m) out.push({ t: 'add', b: B[j++] });
    return out;
  }
  // words that differ between two lines, for highlighting
  function diffWords(a, b){
    const tok = s => s.match(/\s+|[A-Za-z0-9_]+|'[^']*'|\[[^\]]*\]|"[^"]*"|./g) || [];
    const A = tok(a), B = tok(b), n = A.length, m = B.length;
    if (n * m > 40000) return { a: [[a, true]], b: [[b, true]] };
    const L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const oa = [], ob = []; let i = 0, j = 0;
    while (i < n && j < m) { if (A[i] === B[j]) { oa.push([A[i], false]); ob.push([B[j], false]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) oa.push([A[i++], true]); else ob.push([B[j++], true]); }
    while (i < n) oa.push([A[i++], true]); while (j < m) ob.push([B[j++], true]);
    return { a: oa, b: ob };
  }

  /* ----- write-ups ----- */
  const fmtVal = (d, v) => typeof v === 'boolean' ? (d.id === 'active' ? (v ? 'active' : 'inactive') : v ? 'yes' : 'no') : v === '' || v == null ? '(none)' : v;
  function lineFor(c, opt){
    const typeWord = { added: 'Added', removed: 'Removed', renamed: 'Renamed', changed: 'Changed' }[c.type];
    let s = c.kind === 'model' ? c.label : KIND_LABEL[c.kind] + ' ' + c.label;
    if (c.type === 'renamed') s += ' (' + (c.probable ? 'probably renamed from ' : 'was ') + (c.kind === 'table' ? qn(c.before.name) : bracket(c.before.name)) + ')';
    const bits = (c.diffs || []).filter(d => opt.house || d.imp !== 'house').map(d => d.code ? d.label + ' changed' : d.note ? d.label + ': ' + d.note.toLowerCase() : d.label + ': ' + fmtVal(d, d.before) + ' → ' + fmtVal(d, d.after));
    return { typeWord, text: s + (bits.length ? ': ' + bits.join('; ') : ''), code: opt.dax ? (c.diffs || []).filter(d => d.code) : [], added: opt.dax && c.type === 'added' && c.kind === 'measure' ? c.obj.expression : '' };
  }
  function visible(res, opt){ return res.changes.filter(c => opt.house || c.imp !== 'house' || c.type !== 'changed'); }
  function markdown(res, info, opt){
    const L = [], list = visible(res, opt);
    L.push('## Model changes' + (info.name ? ': ' + info.name : ''), '');
    if (info.before || info.after) L.push('Compared ' + (info.before || 'the earlier export') + ' with ' + (info.after || 'the current export') + '.', '');
    L.push(list.length ? '**Summary:** ' + summaryText(summarize(list)) + '.' : 'No changes to tables, columns, measures or relationships.', '');
    const groups = [['attention', 'Check reports that use these'], ['change', 'Changes'], ['house', 'Housekeeping']];
    groups.forEach(([imp, title]) => {
      const g = list.filter(c => c.imp === imp); if (!g.length) return;
      L.push('### ' + title, '');
      g.forEach(c => {
        const x = lineFor(c, opt);
        L.push('- **' + x.typeWord + '** ' + x.text.replace(/([*_])/g, '\\$1') + (imp === 'attention' && why(c) ? '. ' + why(c) : ''));
        x.code.forEach(d => L.push('', '  Before:', '  ```dax', ...String(d.before).split('\n').map(l => '  ' + l), '  ```', '  After:', '  ```dax', ...String(d.after).split('\n').map(l => '  ' + l), '  ```', ''));
        if (x.added) L.push('', '  ```dax', ...x.added.split('\n').map(l => '  ' + l), '  ```', '');
      });
      L.push('');
    });
    return L.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }
  function plain(res, info, opt){
    const L = [], list = visible(res, opt);
    L.push('Model changes' + (info.name ? ': ' + info.name : ''));
    if (info.before || info.after) L.push('Compared ' + (info.before || 'the earlier export') + ' with ' + (info.after || 'the current export') + '.');
    L.push(list.length ? 'Summary: ' + summaryText(summarize(list)) + '.' : 'No changes to tables, columns, measures or relationships.', '');
    [['attention', 'CHECK REPORTS THAT USE THESE'], ['change', 'CHANGES'], ['house', 'HOUSEKEEPING']].forEach(([imp, title]) => {
      const g = list.filter(c => c.imp === imp); if (!g.length) return;
      L.push(title); g.forEach(c => { const x = lineFor(c, opt); L.push('• ' + x.typeWord + ' ' + x.text); }); L.push('');
    });
    return L.join('\n').trim() + '\n';
  }
  function tsv(res){
    const rows = [['Importance', 'Change', 'Object type', 'Table', 'Name', 'Property', 'Before', 'After']];
    const imp = { attention: 'Check reports', change: 'Change', house: 'Housekeeping' };
    const cell = v => String(v == null ? '' : v).replace(/[\t\r\n]+/g, ' ');
    res.changes.forEach(c => {
      const t = c.kind === 'column' || c.kind === 'relationship' ? c.obj.table : c.kind === 'measure' ? c.obj.table : '';
      const n = c.kind === 'relationship' ? c.label : c.obj.name;
      if (c.diffs && c.diffs.length) c.diffs.forEach(d => rows.push([imp[d.imp], c.type, KIND_LABEL[c.kind], t, n, d.label + (d.note ? ' (' + d.note + ')' : ''), fmtVal(d, d.before), fmtVal(d, d.after)]));
      else rows.push([imp[c.imp], c.type, KIND_LABEL[c.kind], t, n, c.type === 'renamed' ? 'Name' : '', c.type === 'renamed' ? c.before.name : '', c.type === 'renamed' ? c.obj.name : '']);
    });
    return rows.map(r => r.map(cell).join('\t')).join('\n');
  }
  // how alike two models are (share of table names in common), to spot a "before" from another model
  function overlap(A, B){
    const a = new Set(A.rows.filter(r => r.kind === 'table').map(r => lc(r.name))), b = new Set(B.rows.filter(r => r.kind === 'table').map(r => lc(r.name)));
    if (!a.size || !b.size) return 0;
    let n = 0; a.forEach(x => { if (b.has(x)) n++; });
    return n / Math.max(a.size, b.size);
  }

  return { parse, describe, compare, why, diffLines, diffWords, markdown, plain, tsv, overlap, summaryText, KIND_LABEL, fmtVal };
})();
