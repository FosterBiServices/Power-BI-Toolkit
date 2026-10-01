
/* ---------- RLS Role Generator: roles -> filters, reach, checks, TMDL ---------- */
const RLS = (() => {
  const low = s => (s || '').toLowerCase();
  const UPN = 'USERPRINCIPALNAME ()';
  const RULE_TYPES = {
    values: 'Fixed values',
    user: 'User\u2019s own rows',
    access: 'Access table',
    dax: 'Custom DAX'
  };
  const blankRule = type => ({ type, table: '', column: '', op: 'in', values: '', accessTable: '', emailCol: '', keyCol: '', secure: true, expr: '' });

  const findTable = (m, t) => m && m.tables.find(x => low(x.name) === low(t));
  const findCol = (m, t, c) => m && m.columns.find(x => low(x.table) === low(t) && low(x.name) === low(c));
  const colRef = (t, c) => qName(t) + bracket(c);
  const kindOf = dt => /int|double|decimal|currency|number/i.test(dt || '') ? 'num' : /bool/i.test(dt || '') ? 'bool' : /date|time/i.test(dt || '') ? 'date' : 'text';
  const valueList = s => (s || '').split('\n').map(v => v.trim()).filter(Boolean);

  // One value typed by the user -> a DAX literal for the column's type, or an error
  function literal(v, dt){
    const k = kindOf(dt);
    if (k === 'num') { const n = v.replace(/,/g, ''); return /^-?\d+(\.\d+)?$/.test(n) ? { dax: n } : { err: '\u201c' + v + '\u201d isn\u2019t a number' }; }
    if (k === 'bool') { return /^(true|yes|1)$/i.test(v) ? { dax: 'TRUE ()' } : /^(false|no|0)$/i.test(v) ? { dax: 'FALSE ()' } : { err: '\u201c' + v + '\u201d isn\u2019t TRUE or FALSE' }; }
    if (k === 'date') { const d = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); return d ? { dax: 'DATE ( ' + +d[1] + ', ' + +d[2] + ', ' + +d[3] + ' )' } : { err: '\u201c' + v + '\u201d isn\u2019t a date as YYYY-MM-DD' }; }
    return { dax: '"' + v.replace(/"/g, '""') + '"' };
  }

  // A rule -> [{ table, expr }] (an access rule can also secure its own table), plus problems
  function compileRule(r, m){
    const out = [], errs = [], warns = [];
    const needCol = (t, c, label) => {
      if (!(t || '').trim() || !(c || '').trim()) { errs.push('Pick the ' + label + '.'); return null; }
      if (m && !findTable(m, t)) { errs.push('There\u2019s no table ' + qName(t) + ' in the model export.'); return null; }
      const col = findCol(m, t, c);
      if (m && !col) { errs.push('There\u2019s no column ' + colRef(t, c) + ' in the model export.'); return null; }
      return col || { dataType: '' };
    };
    if (r.type === 'values') {
      const col = needCol(r.table, r.column, 'table and column to filter');
      const vals = valueList(r.values);
      if (col) {
        if (!vals.length) errs.push('Add at least one value, one per line.');
        const lits = vals.map(v => literal(v, col.dataType));
        lits.filter(x => x.err).forEach(x => errs.push(x.err + ' (' + colRef(r.table, r.column) + ' is ' + (col.dataType || 'text') + ').'));
        if (vals.length && !lits.some(x => x.err)) {
          const inList = colRef(r.table, r.column) + ' IN { ' + lits.map(x => x.dax).join(', ') + ' }';
          out.push({ table: r.table, expr: r.op === 'notin' ? 'NOT ( ' + inList + ' )' : inList });
        }
      }
    } else if (r.type === 'user') {
      const col = needCol(r.table, r.column, 'table and the column that holds each user\u2019s sign-in email');
      if (col) {
        if (col.dataType && kindOf(col.dataType) !== 'text') warns.push(colRef(r.table, r.column) + ' is ' + col.dataType + '; USERPRINCIPALNAME returns text like name@company.com.');
        out.push({ table: r.table, expr: colRef(r.table, r.column) + ' = ' + UPN });
      }
    } else if (r.type === 'access') {
      const e = needCol(r.accessTable, r.emailCol, 'access table and its email column');
      const k = needCol(r.accessTable, r.keyCol, 'access table\u2019s key column (what each user may see)');
      const t = needCol(r.table, r.column, 'table and column the access table controls');
      if (e && k && t) {
        if (low(r.accessTable) === low(r.table)) errs.push('The access table and the table it controls must be different tables.');
        else {
          if (e.dataType && kindOf(e.dataType) !== 'text') warns.push(colRef(r.accessTable, r.emailCol) + ' is ' + e.dataType + '; it should hold sign-in emails.');
          if (k.dataType && t.dataType && kindOf(k.dataType) !== kindOf(t.dataType)) warns.push(colRef(r.accessTable, r.keyCol) + ' (' + k.dataType + ') and ' + colRef(r.table, r.column) + ' (' + t.dataType + ') have different types, so nothing may match.');
          out.push({ table: r.table, expr: colRef(r.table, r.column) + ' IN CALCULATETABLE ( VALUES ( ' + colRef(r.accessTable, r.keyCol) + ' ), ' + colRef(r.accessTable, r.emailCol) + ' = ' + UPN + ' )' });
          if (r.secure) out.push({ table: r.accessTable, expr: colRef(r.accessTable, r.emailCol) + ' = ' + UPN, secure: true });
        }
      }
    } else if (r.type === 'dax') {
      if (!(r.table || '').trim()) errs.push('Pick the table the filter applies to.');
      else if (m && !findTable(m, r.table)) errs.push('There\u2019s no table ' + qName(r.table) + ' in the model export.');
      const ex = (r.expr || '').trim();
      if (!ex) errs.push('Write the DAX filter: a TRUE/FALSE expression evaluated for each row of the table.');
      if (ex && m) {
        const re = /'((?:[^']|'')+)'\s*\[([^\]]+)\]|\b([A-Za-z_][\w]*)\s*\[([^\]]+)\]/g; let x;
        const tables = new Set(m.tables.map(t => low(t.name)));
        while ((x = re.exec(ex.replace(/"(?:[^"]|"")*"/g, '""')))) {
          const t = (x[1] || x[3] || '').replace(/''/g, "'"), c = x[2] || x[4];
          if (tables.has(low(t)) && !findCol(m, t, c)) errs.push('There\u2019s no column ' + colRef(t, c) + ' in the model export.');
        }
        if (/\bUSERNAME\s*\(/i.test(ex)) warns.push('USERNAME() returns DOMAIN\\user in Power BI Desktop but an email in the service. USERPRINCIPALNAME() is the same in both.');
      }
      if (ex && (r.table || '').trim()) out.push({ table: r.table, expr: ex });
    }
    return { filters: out, errs, warns };
  }

  // A role -> one filter per table (rules on the same table are combined with &&)
  function compileRole(role, m){
    const per = new Map(), probs = [];
    (role.rules || []).forEach((r, i) => {
      const c = compileRule(r, m);
      c.errs.forEach(t => probs.push({ level: 'err', rule: i, text: t }));
      c.warns.forEach(t => probs.push({ level: 'warn', rule: i, text: t }));
      c.filters.forEach(f => {
        const key = low(f.table);
        if (!per.has(key)) per.set(key, { table: (findTable(m, f.table) || { name: f.table }).name, exprs: [] });
        per.get(key).exprs.push(f.expr);
      });
    });
    const filters = [...per.values()].map(p => ({ table: p.table, expr: p.exprs.length === 1 ? p.exprs[0] : p.exprs.map(e => /\|\||\n|\bOR\b/i.test(e) ? '( ' + e + ' )' : e).join(' && ') }));
    return { filters, probs };
  }

  /* Which tables a role reaches: security filters flow from the one side to the many side of active
     relationships. Both-direction flow needs "Apply security filter in both directions", which the
     export doesn't show, so those are reported as "maybe". */
  function reach(m, filters){
    const res = new Map(); // table(lower) -> { how: 'direct'|'via'|'maybe', via }
    const q = [];
    filters.forEach(f => { res.set(low(f.table), { how: 'direct', name: f.table }); q.push(low(f.table)); });
    const edges = [];
    (m ? m.rels : []).filter(r => !r.inactive).forEach(r => {
      const oneOne = /^one$/i.test(r.fromCard) && /^one$/i.test(r.toCard);
      edges.push({ from: low(r.toTable), to: low(r.fromTable), name: r.fromTable, via: colRef(r.fromTable, r.fromColumn) + ' \u2192 ' + colRef(r.toTable, r.toColumn), sure: true });
      edges.push({ from: low(r.fromTable), to: low(r.toTable), name: r.toTable, via: colRef(r.fromTable, r.fromColumn) + ' \u2192 ' + colRef(r.toTable, r.toColumn), sure: oneOne, maybe: !oneOne && r.both });
    });
    while (q.length) {
      const t = q.shift(), cur = res.get(t);
      edges.filter(e => e.from === t && (e.sure || e.maybe)).forEach(e => {
        const how = e.sure && cur.how !== 'maybe' ? 'via' : 'maybe';
        const prev = res.get(e.to);
        if (!prev || (prev.how === 'maybe' && how === 'via')) { res.set(e.to, { how, name: e.name, via: e.via, from: cur.name }); q.push(e.to); }
      });
    }
    return res;
  }

  // Tables that hold rows worth securing (tables with columns in the export)
  function dataTables(m){
    const withCols = new Set(m.columns.map(c => low(c.table)));
    return m.tables.filter(t => withCols.has(low(t.name)));
  }
  // Fact-like: on the many side of a relationship and never on the one side
  function factTables(m){
    const many = new Set(), one = new Set();
    m.rels.forEach(r => { if (!/^one$/i.test(r.fromCard)) many.add(low(r.fromTable)); one.add(low(r.toTable)); });
    return new Set([...many].filter(t => !one.has(t)));
  }

  function roleChecks(role, comp, m, allRoles){
    const out = comp.probs.map(p => ({ level: p.level, text: 'Rule ' + (p.rule + 1) + ': ' + p.text }));
    const name = (role.name || '').trim();
    if (!name) out.unshift((role.rules || []).length ? { level: 'err', text: 'Give the role a name.' } : { level: 'info', text: 'Name this role to include it in the script.' });
    else if (allRoles.filter(r => low((r.name || '').trim()) === low(name)).length > 1) out.unshift({ level: 'err', text: 'Two roles are called \u201c' + name + '\u201d. Role names must be unique.' });
    else if (/['"\\]/.test(name)) out.unshift({ level: 'warn', text: 'Avoid quotes and backslashes in role names.' });
    if (name && !(role.rules || []).length) out.push({ level: 'info', text: 'No rules, so this role sees every row. That\u2019s right for a full-access role (managers, say); otherwise add a rule.' });
    if (m && comp.filters.length && !out.some(x => x.level === 'err')) {
      const r = reach(m, comp.filters), facts = factTables(m);
      comp.filters.forEach(f => { if (facts.has(low(f.table)) && !comp.filters.some(g => g !== f && !facts.has(low(g.table)))) out.push({ level: 'info', text: qName(f.table) + ' looks like a fact table. Filtering the dimension it relates to (customers, regions) is usually faster and also secures the dimension\u2019s own rows.' }); });
      const open = dataTables(m).filter(t => !r.has(low(t.name)) || r.get(low(t.name)).how === 'maybe');
      const openFacts = open.filter(t => facts.has(low(t.name)));
      if (openFacts.length) out.push({ level: 'warn', text: 'Not restricted by this role: ' + openFacts.map(t => qName(t.name)).join(', ') + '. People in the role see every row of ' + (openFacts.length === 1 ? 'it' : 'them') + ', because no relationship carries the filter there. Add a rule for ' + (openFacts.length === 1 ? 'that table' : 'each') + ' if its rows are sensitive.' });
      // Access tables hold who-sees-what; hidden tables can still be read with DAX or Analyze in Excel
      const accessTables = new Set(); allRoles.forEach(o => (o.rules || []).forEach(x => { if (x.type === 'access' && x.accessTable) accessTables.add(low(x.accessTable)); }));
      const exposed = [...accessTables].filter(t => findTable(m, t) && !comp.filters.some(f => low(f.table) === t));
      if (exposed.length) out.push({ level: 'warn', text: 'People in this role can read every row of ' + exposed.map(t => qName(findTable(m, t).name)).join(', ') + ', the access table another role uses (who may see what). Hiding a table doesn\u2019t stop DAX queries or Analyze in Excel; add a rule such as a custom DAX filter of FALSE () to block it.' });
      const maybe = [...r.values()].filter(x => x.how === 'maybe');
      if (maybe.length) out.push({ level: 'info', text: maybe.map(x => qName(x.name)).join(', ') + ' would only be filtered through a bidirectional relationship, and only if its \u201cApply security filter in both directions\u201d setting is on.' });
    }
    return out;
  }

  function lines(expr, base){
    const ls = exprLines(expr);
    return ls.length <= 1 ? [' ' + (ls[0] || '').trim()] : ['', ...ls.map(l => l ? TAB.repeat(base) + l : '')];
  }

  function tmdl(roles, m){
    const out = ['createOrReplace', ''];
    roles.forEach(role => {
      const comp = compileRole(role, m);
      out.push(TAB + 'role ' + tmdlName(role.name.trim()));
      out.push(TAB + TAB + 'modelPermission: read');
      comp.filters.forEach(f => {
        const l = lines(f.expr, 4);
        out.push('');
        if (l.length === 1) out.push(TAB + TAB + 'tablePermission ' + tmdlName(f.table) + ' =' + l[0]);
        else { out.push(TAB + TAB + 'tablePermission ' + tmdlName(f.table) + ' ='); l.slice(1).forEach(x => out.push(x)); }
      });
      out.push('');
    });
    while (out.length && out[out.length - 1] === '') out.pop();
    return out.join('\n') + '\n';
  }

  function testQuery(roles, m, user){
    const u = '"' + String(user || 'someone@contoso.com').replace(/"/g, '""') + '"';
    const tables = m ? dataTables(m) : [];
    const out = ['// SF Power BI Toolkit: RLS role test', '// Rows each table shows for each role, next to all rows. The test user replaces USERPRINCIPALNAME ().',
      '// This approximates RLS with filters; confirm with Modeling > View as in Power BI Desktop.', 'DEFINE', TAB + 'VAR _testUser = ' + u, ''];
    roles.forEach(role => {
      const comp = compileRole(role, m);
      const filt = comp.filters.map(f => 'FILTER ( ALL ( ' + qName(f.table) + ' ), ' + f.expr.replace(/USERPRINCIPALNAME\s*\(\s*\)/gi, '_testUser').replace(/\s*\n\s*/g, ' ') + ' )');
      out.push('// Role: ' + role.name.trim());
      const rows = tables.map(t => { const cnt = 'COUNTROWS ( ' + qName(t.name) + ' )';
        return 'ROW ( "Role", ' + daxString(role.name.trim()) + ', "Table", ' + daxString(t.name) + ', "Rows for role", ' + (filt.length ? 'CALCULATE ( ' + cnt + ', ' + filt.join(', ') + ' )' : cnt) + ', "All rows", ' + cnt + ' )'; });
      if (!rows.length) { out.push('// (no tables with columns in the model export)'); }
      else if (rows.length === 1) out.push('EVALUATE', rows[0]);
      else out.push('EVALUATE', 'UNION (', ...rows.map((r, i) => TAB + r + (i < rows.length - 1 ? ',' : '')), ')');
      out.push('');
    });
    while (out.length && out[out.length - 1] === '') out.pop();
    return out.join('\n');
  }

  function valuesQuery(t, c){ return 'EVALUATE\nVALUES ( ' + colRef(t, c) + ' )\nORDER BY ' + colRef(t, c); }

  return { RULE_TYPES, blankRule, compileRule, compileRole, reach, roleChecks, tmdl, testQuery, valuesQuery, factTables, dataTables, kindOf, literal };
})();
