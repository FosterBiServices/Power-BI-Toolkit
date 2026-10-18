/* ---------- Sample Data Maker: a small expression language that writes DAX and runs in the page ----------
   Each column is built from the helpers below. A helper returns { d, f, refs }: d(ctx) writes the DAX,
   f(row, env) works out the same value in JavaScript (for the preview), refs lists the columns it reads.
   Random numbers come from one seeded hash, the same in DAX and here, so the preview shows the rows
   Power BI will build. The idea of DAX functions that build seeded sample tables comes from the
   DataGoblins.SampleData DAX library; these functions are written from scratch. */
const SD = (() => {
  const PKG = 'FosterBIServices.SampleData';
  const FN_RANDOM = PKG + '.Random';
  const q = s => '"' + String(s).replace(/"/g, '""') + '"';
  const numLit = v => { const s = String(+(+v).toPrecision(12)); return s.startsWith('.') ? '0' + s : s.startsWith('-.') ? '-0' + s.slice(1) : s; };
  const node = (d, f, refs, op) => ({ d, f, refs: refs || [], op: !!op });
  const uniq = a => Array.from(new Set(a));
  const lit = v => node(() => typeof v === 'string' ? q(v) : typeof v === 'boolean' ? (v ? 'TRUE()' : 'FALSE()') : v === null ? 'BLANK()' : numLit(v), () => v);
  const lift = x => x && typeof x === 'object' && x.d ? x : lit(x);
  const wrap = (n, c) => n.op ? '( ' + n.d(c) + ' )' : n.d(c);
  const refsOf = (...ns) => uniq([].concat(...ns.map(n => n.refs)));
  const frac = x => x - Math.floor(x);
  const rand = (k, s, seed) => frac(Math.sin(k * 12.9898 + s * 78.233 + seed * 37.719) * 43758.5453);
  const roundHalfAway = (x, n) => { const m = Math.pow(10, n); const r = Math.round(Math.abs(x) * m + 1e-9) / m; return x < 0 ? -r : r; };
  // dates are serial numbers, as in Excel and DAX: days since 30 Dec 1899
  const serial = (y, m, d) => Date.UTC(y, m - 1, d) / 86400000 + 25569;
  const ymd = s => { const t = new Date(Math.round((s - 25569) * 86400000)); return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()]; };
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekday2 = s => { const t = new Date(Math.round((s - 25569) * 86400000)).getUTCDay(); return t === 0 ? 7 : t; };

  const X = {};
  X.lit = lit;
  X.P = name => node(() => name, (r, e) => e.p[name]);
  X.C = name => node(() => '[' + name + ']', r => r[name], [name]);
  X.blank = () => lit(null);
  // seeded random number from 0 up to 1, from a whole-number key and a stream number (one stream per use)
  X.R = (k, s) => { k = lift(k); return node(c => c.mode === 'udf' ? FN_RANDOM + '( ' + k.d(c) + ', ' + s + ', seed )' : 'MOD( SIN( ' + wrap(k, c) + ' * 12.9898 + ' + s + ' * 78.233 + seed * 37.719 ) * 43758.5453, 1 )', (r, e) => rand(k.f(r, e), s, e.seed), k.refs); };
  const bin = (sym, fn) => (a, b) => { a = lift(a); b = lift(b); return node(c => wrap(a, c) + ' ' + sym + ' ' + wrap(b, c), (r, e) => fn(a.f(r, e), b.f(r, e)), refsOf(a, b), true); };
  const nz = v => v === null || v === undefined ? 0 : v;
  X.add = bin('+', (a, b) => nz(a) + nz(b));
  X.sub = bin('-', (a, b) => nz(a) - nz(b));
  X.mul = bin('*', (a, b) => nz(a) * nz(b));
  X.div = bin('/', (a, b) => nz(a) / nz(b));
  X.lt = bin('<', (a, b) => nz(a) < nz(b));
  X.le = bin('<=', (a, b) => nz(a) <= nz(b));
  X.gt = bin('>', (a, b) => nz(a) > nz(b));
  X.ge = bin('>=', (a, b) => nz(a) >= nz(b));
  X.eq = bin('=', (a, b) => a === b);
  X.and = bin('&&', (a, b) => !!a && !!b);
  X.or = bin('||', (a, b) => !!a || !!b);
  X.cat = (...ns) => { ns = ns.map(lift); return node(c => ns.map(n => wrap(n, c)).join(' & '), (r, e) => ns.map(n => { const v = n.f(r, e); return v === null ? '' : String(v); }).join(''), refsOf(...ns), true); };
  const fn = (name, jsf) => (...ns) => { ns = ns.map(lift); return node(c => name + '( ' + ns.map(n => n.d(c)).join(', ') + ' )', (r, e) => jsf(...ns.map(n => n.f(r, e))), refsOf(...ns)); };
  X.int = fn('INT', a => Math.floor(nz(a)));
  X.round = (a, n) => fn('ROUND', (x, m) => roundHalfAway(nz(x), m))(a, n);
  X.min = fn('MIN', (a, b) => a === null ? b : b === null ? a : Math.min(a, b));
  X.max = fn('MAX', (a, b) => a === null ? b : b === null ? a : Math.max(a, b));
  X.pow = fn('POWER', (a, b) => Math.pow(nz(a), b));
  X.mod = fn('MOD', (a, b) => { const m = nz(a) % b; return m !== 0 && (m < 0) !== (b < 0) ? m + b : m; });
  X.sin = fn('SIN', a => Math.sin(nz(a)));
  X.pi = () => node(() => 'PI()', () => Math.PI);
  X.iff = (t, a, b) => fn('IF', (x, y, z) => x ? y : (z === undefined ? null : z))(...(b === undefined ? [t, a] : [t, a, b]));
  X.isblank = fn('ISBLANK', a => a === null || a === undefined || a === '');
  X.coalesce = fn('COALESCE', (a, b) => a === null || a === undefined ? b : a);
  X.date = fn('DATE', (y, m, d) => serial(y, m, d));
  X.year = fn('YEAR', a => ymd(a)[0]);
  X.month = fn('MONTH', a => ymd(a)[1]);
  X.quarter = fn('QUARTER', a => Math.ceil(ymd(a)[1] / 3));
  X.weekday = a => fn('WEEKDAY', x => weekday2(x))(a, 2);
  X.eom = fn('EOMONTH', (a, n) => { const [y, m] = ymd(a); return serial(y, m + n + 1, 0); });
  X.lower = fn('LOWER', a => String(a).toLowerCase());
  X.pad = (a, pat) => { a = lift(a); return node(c => 'FORMAT( ' + a.d(c) + ', ' + q(pat) + ' )', (r, e) => String(Math.floor(nz(a.f(r, e)))).padStart(pat.length, '0'), a.refs); };
  X.fmtDate = (a, pat) => { a = lift(a); return node(c => 'FORMAT( ' + a.d(c) + ', ' + q(pat) + ' )', (r, e) => { const v = a.f(r, e), [y, m] = ymd(v); return pat === 'mmm' ? MON[m - 1] : pat === 'mmmm' ? MONTH[m - 1] : pat === 'ddd' ? DAY[weekday2(v) - 1] : pat === 'mmm yyyy' ? MON[m - 1] + ' ' + y : String(v); }, a.refs); };
  // the item at a zero-based position in a list
  X.at = (list, idx) => { idx = lift(idx); return node(c => 'SWITCH( ' + idx.d(c) + ', ' + list.slice(0, -1).map((v, i) => i + ', ' + lit(v).d(c)).join(', ') + ', ' + lit(list[list.length - 1]).d(c) + ' )', (r, e) => list[Math.max(0, Math.min(list.length - 1, nz(idx.f(r, e))))], idx.refs); };
  // a random item: named lists become their own small DAX functions (PKG.List.<name>)
  X.pick = (list, rn) => {
    rn = lift(rn);
    const named = typeof list === 'string', items = named ? LISTS[list] : list;
    const body = c => 'SWITCH( INT( ' + wrap(rn, c) + ' * ' + items.length + ' ), ' + items.slice(0, -1).map((v, i) => i + ', ' + lit(v).d(c)).join(', ') + ', ' + lit(items[items.length - 1]).d(c) + ' )';
    return node(c => { if (named && c.mode === 'udf') { c.lists.add(list); return PKG + '.List.' + list + '( ' + rn.d(c) + ' )'; } return body(c); },
      (r, e) => items[Math.min(items.length - 1, Math.floor(rn.f(r, e) * items.length))], rn.refs);
  };
  // a random item where each one has its own chance: [[value, weight], ...]
  X.wpick = (pairs, rn) => {
    rn = lift(rn);
    const tot = pairs.reduce((s, p) => s + p[1], 0); let acc = 0;
    const cut = pairs.map(p => { acc += p[1] / tot; return +acc.toFixed(6); });
    return node(c => 'SWITCH( TRUE(), ' + pairs.slice(0, -1).map((p, i) => wrap(rn, c) + ' < ' + numLit(cut[i]) + ', ' + lit(p[0]).d(c)).join(', ') + ', ' + lit(pairs[pairs.length - 1][0]).d(c) + ' )',
      (r, e) => { const v = rn.f(r, e); for (let i = 0; i < pairs.length - 1; i++) if (v < cut[i]) return pairs[i][0]; return pairs[pairs.length - 1][0]; }, rn.refs);
  };

  /* shared word lists. The first 30 first names are usually given to women, the next 30 to men. */
  const LISTS = {
    FirstName: ['Ava', 'Olivia', 'Emma', 'Sophia', 'Isabella', 'Mia', 'Amelia', 'Harper', 'Evelyn', 'Aria', 'Chloe', 'Layla', 'Nora', 'Zoe', 'Hannah', 'Priya', 'Elena', 'Grace', 'Leah', 'Maya', 'Ruby', 'Clara', 'Ines', 'Sara', 'Lucia', 'Amara', 'Yara', 'Naomi', 'Freya', 'Mei',
      'Liam', 'Noah', 'Mateo', 'Lucas', 'Ethan', 'Aiden', 'Leo', 'James', 'Omar', 'Daniel', 'Kai', 'Samuel', 'Ravi', 'Diego', 'Felix', 'Jonah', 'Marcus', 'Tariq', 'Andre', 'Victor', 'Kenji', 'Hugo', 'Theo', 'Malik', 'Oscar', 'Elias', 'Arjun', 'Tomas', 'Ivan', 'Kwame'],
    LastName: ['Smith', 'Garcia', 'Chen', 'Patel', 'Johnson', 'Nguyen', 'Kim', 'Lopez', 'Brown', 'Silva', 'Martin', 'Rossi', 'Novak', 'Cohen', 'Okafor', 'Haddad', 'Ivanova', 'Larsen', 'Moreau', 'Tanaka',
      'Walker', 'Hughes', 'Reyes', 'Fischer', 'Kowalski', 'Andersen', 'Murphy', 'Bianchi', 'Costa', 'Sato', 'Wright', 'Mensah', 'Dubois', 'Jensen', 'Ortiz', 'Shah', 'Park', 'Nash', 'Bennett', 'Price',
      'Ward', 'Gray', 'Hayes', 'Rivera', 'Ali', 'Byrne', 'Clarke', 'Doyle', 'Ellis', 'Grant', 'Holt', 'Khan', 'Lund', 'Meyer', 'Owens', 'Quinn', 'Reid', 'Stone', 'Vargas', 'Young'],
    City: ['Springfield', 'Riverton', 'Lakewood', 'Fairview', 'Greenville', 'Madison', 'Clinton', 'Georgetown', 'Franklin', 'Arlington', 'Salem', 'Bristol', 'Ashland', 'Milton', 'Oxford', 'Dover', 'Burlington', 'Kingston', 'Newport', 'Clayton', 'Hudson', 'Marion', 'Auburn', 'Dayton', 'Glendale'],
    CompanyA: ['Blue', 'Summit', 'Harbor', 'Maple', 'Iron', 'Silver', 'Cedar', 'Bright', 'Northern', 'Golden', 'Red', 'Pine', 'Swift', 'Stone', 'Clear', 'Prime', 'River', 'Oak', 'Crest', 'Lakeside'],
    CompanyB: ['Ridge', 'Field', 'Works', 'Point', 'Bay', 'Path', 'Peak', 'Line', 'Gate', 'Wave', 'Brook', 'Forge', 'Bridge', 'Grove', 'Hill', 'Valley'],
    CompanyC: ['Supply', 'Foods', 'Logistics', 'Systems', 'Partners', 'Retail', 'Health', 'Labs', 'Group', 'Traders', 'Industries', 'Services']
  };
  X.LISTS = LISTS;
  const LIST_DESC = { FirstName: 'first names', LastName: 'last names', City: 'city names', CompanyA: 'first words of a company name', CompanyB: 'second words of a company name', CompanyC: 'last words of a company name' };
  // a person's name that no other key in the table shares (up to 3,600 keys): first, last and the first-name position
  X.nameIndex = k => X.mod(X.add(X.mul(lift(k), 1201), X.mul(X.P('seed'), 97)), 3600);
  X.firstOf = ix => X.at(LISTS.FirstName, X.int(X.div(ix, 60)));
  X.lastOf = ix => X.at(LISTS.LastName, X.mod(X.add(X.mul(X.mod(ix, 60), 7), X.int(X.div(ix, 60))), 60));
  X.company = (k, s) => X.cat(X.pick('CompanyA', X.R(k, s)), ' ', X.pick('CompanyB', X.R(k, s + 1)), ' ', X.pick('CompanyC', X.R(k, s + 2)));
  X.days = () => X.add(X.int(X.sub(X.P('end_date'), X.P('start_date'))), 1);

  /* ---------- tables ----------
     A table is a list of stages: one source, then cols / expand / filter, in order. Its meta lists the
     columns it returns: { n: name, t: int|dec|text|date|bool, f: format, d: description, h: hidden, s: sort by,
     sum: summarize by sum }. Columns whose names start with _ are helpers and are dropped at the end. */
  function levels(cols, known){
    const names = new Set(cols.map(c => c[0])), lv = {};
    const get = (n, seen) => { if (lv[n] !== undefined) return lv[n]; if (seen.has(n)) throw new Error('loop at ' + n); seen.add(n); const c = cols.find(x => x[0] === n); let l = 0; c[1].refs.forEach(r => { if (names.has(r) && r !== n) l = Math.max(l, get(r, seen) + 1); else if (!known.has(r)) throw new Error('unknown column ' + r + ' in ' + n); }); return (lv[n] = l); };
    cols.forEach(c => get(c[0], new Set()));
    const out = []; cols.forEach(c => { (out[lv[c[0]]] = out[lv[c[0]]] || []).push(c); });
    return out;
  }
  const IND = '    ';
  function sourceDax(s, c){
    if (s.series) return 'SELECTCOLUMNS( GENERATESERIES( 1, ' + lift(s.series).d(c) + ', 1 ), "_k", [Value] )';
    if (s.calendar) return 'CALENDAR( ' + s.calendar[0].d(c) + ', ' + s.calendar[1].d(c) + ' )';
    if (s.data) {
      const T = { int: 'INTEGER', dec: 'DOUBLE', text: 'STRING', date: 'DATETIME', bool: 'BOOLEAN' };
      return 'DATATABLE(\n' + IND + IND + s.data.cols.map(x => q(x[0]) + ', ' + T[x[1]]).join(',\n' + IND + IND) + ',\n' + IND + IND + '{\n'
        + s.data.rows.map(r => IND + IND + IND + '{ ' + r.map(v => typeof v === 'string' ? q(v) : numLit(v)).join(', ') + ' }').join(',\n') + '\n' + IND + IND + '}\n' + IND + ')';
    }
    if (s.grid) return 'CROSSJOIN(\n' + s.grid.map(g => IND + IND + (g.days ? 'SELECTCOLUMNS( CALENDAR( ' + g.days[0].d(c) + ', ' + g.days[1].d(c) + ' ), ' + q(g.as) + ', [Date] )' : 'SELECTCOLUMNS( GENERATESERIES( ' + (g.from === 0 ? '0' : '1') + ', ' + lift(g.n).d(c) + ', 1 ), ' + q(g.as) + ', [Value] )')).join(',\n') + '\n' + IND + ')';
    throw new Error('no source');
  }
  function sourceCols(s){
    if (s.series) return ['_k'];
    if (s.calendar) return ['Date'];
    if (s.data) return s.data.cols.map(x => x[0]);
    return s.grid.map(g => g.as);
  }
  // the DAX table expression: VAR steps, then the columns in meta
  const norm = t => { t.stages.forEach(st => { if (st.cols) st.cols = st.cols.map(c => [c[0], lift(c[1])]); }); return t; };
  function tableDax(t, c){
    norm(t);
    const L = [], known = new Set(sourceCols(t.stages[0]));
    let cur = '_Rows', step = 0;
    L.push('VAR _Rows =', IND + sourceDax(t.stages[0], c));
    t.stages.slice(1).forEach(st => {
      if (st.cols) {
        levels(st.cols, known).forEach(group => {
          const nm = '_Step' + (++step);
          L.push('VAR ' + nm + ' =', IND + 'ADDCOLUMNS(', IND + IND + cur + ',');
          group.forEach((col, i) => L.push(IND + IND + q(col[0]) + ', ' + col[1].d(c) + (i < group.length - 1 ? ',' : '')));
          L.push(IND + ')');
          group.forEach(col => known.add(col[0]));
          cur = nm;
        });
      } else if (st.expand) {
        const nm = '_Step' + (++step);
        L.push('VAR ' + nm + ' =', IND + 'GENERATE(', IND + IND + cur + ',', IND + IND + 'SELECTCOLUMNS( GENERATESERIES( 1, ' + lift(st.expand).d(c) + ', 1 ), ' + q(st.as) + ', [Value] )', IND + ')');
        known.add(st.as); cur = nm;
      } else if (st.filter) {
        const nm = '_Step' + (++step);
        L.push('VAR ' + nm + ' =', IND + 'FILTER( ' + cur + ', ' + st.filter.d(c) + ' )');
        cur = nm;
      }
    });
    L.push('RETURN', IND + 'SELECTCOLUMNS(', IND + IND + cur + ',');
    t.meta.forEach((m, i) => L.push(IND + IND + q(m.n) + ', [' + m.n + ']' + (i < t.meta.length - 1 ? ',' : '')));
    L.push(IND + ')');
    return L.join('\n');
  }
  // the same rows in JavaScript (limit: stop after this many rows of the source, for big previews)
  function tableRows(t, env, limit){
    norm(t);
    const s = t.stages[0]; let rows = [];
    if (s.series) { const n = Math.max(0, Math.floor(lift(s.series).f({}, env))); for (let k = 1; k <= n && (!limit || k <= limit); k++) rows.push({ _k: k }); }
    else if (s.calendar) { const a = s.calendar[0].f({}, env), b = s.calendar[1].f({}, env); for (let d = a; d <= b; d++) rows.push({ Date: d }); }
    else if (s.data) rows = s.data.rows.map(r => { const o = {}; s.data.cols.forEach((x, i) => { o[x[0]] = r[i]; }); return o; });
    else if (s.grid) {
      const parts = s.grid.map(g => { const out = []; if (g.days) { const a = g.days[0].f({}, env), b = g.days[1].f({}, env); for (let d = a; d <= b; d++) out.push(d); } else { const n = Math.floor(lift(g.n).f({}, env)); for (let i = g.from === 0 ? 0 : 1; i <= n; i++) out.push(i); } return out; });
      const walk = (i, o) => { if (limit && rows.length >= limit) return; if (i === parts.length) { rows.push(Object.assign({}, o)); return; } for (const v of parts[i]) { o[s.grid[i].as] = v; walk(i + 1, o); if (limit && rows.length >= limit) return; } };
      walk(0, {});
    }
    t.stages.slice(1).forEach(st => {
      if (st.cols) { const known = new Set(Object.keys(rows[0] || {})); levels(st.cols, known.size ? known : new Set(st.cols.flatMap(c => c[1].refs))).forEach(g => rows.forEach(r => g.forEach(c => { r[c[0]] = c[1].f(r, env); }))); }
      else if (st.expand) { const o = []; rows.forEach(r => { const n = Math.floor(st.expand.f(r, env)); for (let i = 1; i <= n; i++) o.push(Object.assign({}, r, { [st.as]: i })); }); rows = o; }
      else if (st.filter) rows = rows.filter(r => st.filter.f(r, env));
    });
    return rows.map(r => { const o = {}; t.meta.forEach(m => { o[m.n] = r[m.n] === undefined ? null : r[m.n]; }); return o; });
  }

  /* ---------- TMDL ---------- */
  const tn = s => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s) ? s : "'" + s.replace(/'/g, "''") + "'";
  const daxTable = s => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s) && !/^(Date|Calendar|Time)$/i.test(s) ? s : "'" + s.replace(/'/g, "''") + "'";
  const TT = { int: 'int64', dec: 'double', text: 'string', date: 'dateTime', bool: 'boolean' };
  const FMT = { int: '0', date: 'Short Date' };
  // a stable id from text, shaped like a GUID, so the same model gets the same relationship ids every time
  function gid(text){
    let h = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b];
    for (let i = 0; i < text.length; i++) h = h.map((x, j) => Math.imul(x ^ text.charCodeAt(i), 16777619 + j * 2654435761) >>> 0);
    const hx = h.map(x => x.toString(16).padStart(8, '0')).join('');
    return hx.slice(0, 8) + '-' + hx.slice(8, 12) + '-4' + hx.slice(13, 16) + '-a' + hx.slice(17, 20) + '-' + hx.slice(20, 32);
  }
  function fnParams(t){ return t.params.map(p => p[0] + ' : ' + p[1]).join(', '); }
  // calling a table function: Name( 500, DATE( 2024, 1, 1 ), ..., seed )
  function argText(v, type){
    if (type === 'DATETIME') { const [y, m, d] = ymd(v); return 'DATE( ' + y + ', ' + m + ', ' + d + ' )'; }
    return numLit(v);
  }
  function callOf(t, args){ return t.fn + '(' + (t.params.length ? ' ' + t.params.map(p => argText(args[p[0]], p[1])).join(', ') + ' ' : '') + ')'; }
  function fnBlock(name, desc, params, body){
    const L = ['\t/// ' + desc, '\tfunction ' + tn(name) + ' = ```', '\t\t\t-- ' + desc, '\t\t\t(' + (params ? ' ' + params + ' ' : '') + ')', '\t\t\t=>'];
    body.split('\n').forEach(l => L.push('\t\t\t' + IND + l));
    L.push('\t\t\t```', '', '\t\tannotation DAXLIB_PackageId = ' + PKG, '', '\t\tannotation DAXLIB_PackageVersion = 1.0.0', '');
    return L;
  }
  const RANDOM_BODY = '-- One seeded random number from 0 up to 1 for each key and stream (the same inputs always give the same number)\nMOD( SIN( row_key * 12.9898 + stream * 78.233 + seed * 37.719 ) * 43758.5453, 1 )';
  /* model: { tables: [...], rels: [[fromTable, fromCol, toTable, toCol, active]], measures: { table: [...] } }
     opts: { mode: 'udf'|'inline', args: { param: value }, measures: true, tables: [names to include] } */
  function script(model, opts){
    const c = { mode: opts.mode, lists: new Set() };
    const tables = model.tables.filter(t => !opts.tables || opts.tables.includes(t.name));
    const bodies = tables.map(t => tableDax(t, c));
    const L = ['createOrReplace', ''];
    if (opts.mode === 'udf') {
      L.push(...fnBlock(FN_RANDOM, 'Seeded random number from 0 up to 1. Used by every ' + PKG + ' table function.', 'row_key, stream, seed', RANDOM_BODY));
      Array.from(c.lists).sort().forEach(n => {
        const items = LISTS[n];
        L.push(...fnBlock(PKG + '.List.' + n, 'Picks one of ' + items.length + ' ' + LIST_DESC[n] + ' from a random number from 0 up to 1.', 'r', 'SWITCH(\n' + IND + 'INT( r * ' + items.length + ' ),\n' + items.slice(0, -1).map((v, i) => IND + i + ', ' + q(v) + ',').join('\n') + '\n' + IND + q(items[items.length - 1]) + '\n)'));
      });
      tables.forEach((t, i) => L.push(...fnBlock(t.fn, t.desc, fnParams(t), bodies[i])));
    }
    tables.forEach((t, i) => {
      L.push('\t/// ' + t.desc, '\ttable ' + tn(t.name));
      if (t.isDate) L.push('\t\tdataCategory: Time');
      L.push('');
      (opts.measures !== false ? (model.measures[t.name] || []) : []).forEach(m => {
        L.push('\t\t/// ' + m.d);
        if (m.x.includes('\n')) { L.push('\t\tmeasure ' + tn(m.n) + ' = ```'); m.x.split('\n').forEach(l => L.push('\t\t\t\t' + l)); L.push('\t\t\t\t```'); }
        else L.push('\t\tmeasure ' + tn(m.n) + ' = ' + m.x);
        L.push('\t\t\tformatString: ' + m.f, '\t\t\tdisplayFolder: KPIs', '');
      });
      t.meta.forEach(m => {
        L.push('\t\t/// ' + m.d, '\t\tcolumn ' + tn(m.n), '\t\t\tdataType: ' + TT[m.t], '\t\t\tisDataTypeInferred');
        if (m.key) L.push('\t\t\tisKey');
        const f = m.f || FMT[m.t];
        if (f) L.push('\t\t\tformatString: ' + f);
        if (m.h) L.push('\t\t\tisHidden');
        L.push('\t\t\tsummarizeBy: ' + (m.sum ? 'sum' : 'none'), '\t\t\tisNameInferred', '\t\t\tsourceColumn: [' + m.n + ']');
        if (m.s) L.push('\t\t\tsortByColumn: ' + tn(m.s));
        L.push('');
      });
      L.push('\t\tpartition ' + tn(t.name) + ' = calculated', '\t\t\tmode: import');
      if (opts.mode === 'udf') L.push('\t\t\tsource = ' + callOf(t, opts.args));
      else {
        L.push('\t\t\tsource =');
        L.push('\t\t\t\t-- ' + t.desc);
        t.params.forEach(p => L.push('\t\t\t\tVAR ' + p[0] + ' = ' + argText(opts.args[p[0]], p[1])));
        L.push('\t\t\t\tRETURN');
        bodies[i].split('\n').forEach(l => L.push('\t\t\t\t' + IND + l));
      }
      L.push('');
    });
    const names = new Set(tables.map(t => t.name));
    model.rels.filter(r => names.has(r[0]) && names.has(r[2])).forEach(r => {
      L.push('\trelationship ' + gid(r.slice(0, 4).join('|')), '\t\tfromColumn: ' + tn(r[0]) + '.' + tn(r[1]), '\t\ttoColumn: ' + tn(r[2]) + '.' + tn(r[3]));
      if (r[4] === false) L.push('\t\tisActive: false');
      L.push('');
    });
    return L.join('\n').replace(/\n+$/, '\n');
  }
  // a DAX query that builds every table, for DAX query view (DEFINE FUNCTION + EVALUATE)
  function query(model, opts, tableName, top){
    const c = { mode: 'udf', lists: new Set() };
    const t = model.tables.find(x => x.name === tableName);
    const body = tableDax(t, c);
    const fd = (name, params, b) => 'FUNCTION ' + name + ' = (' + (params ? ' ' + params + ' ' : '') + ') =>\n' + b.split('\n').map(l => IND + l).join('\n');
    const parts = [fd(FN_RANDOM, 'row_key, stream, seed', RANDOM_BODY)];
    Array.from(c.lists).sort().forEach(n => parts.push(fd(PKG + '.List.' + n, 'r', 'SWITCH( INT( r * ' + LISTS[n].length + ' ), ' + LISTS[n].slice(0, -1).map((v, i) => i + ', ' + q(v)).join(', ') + ', ' + q(LISTS[n][LISTS[n].length - 1]) + ' )')));
    parts.push(fd(t.fn, fnParams(t), body));
    return 'DEFINE\n' + parts.join('\n\n') + '\n\nEVALUATE\n' + (top ? 'TOPN( ' + top + ', ' + callOf(t, opts.args) + ' )' : callOf(t, opts.args)) + '\n';
  }
  return Object.assign(X, { PKG, serial, ymd, rand, tableDax, tableRows, script, query, callOf, gid, daxTable, MON });
})();
