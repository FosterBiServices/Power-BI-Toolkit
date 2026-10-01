
/* ---------- Model Linter: rules checked against the model export ---------- */
const ML = (() => {
  const low = s => (s || '').toLowerCase();
  const NUMERIC = /^(int64|integer|whole number|double|decimal|decimal number|fixed decimal number|currency|number)$/i;

  // Parse the export, keeping the extra columns the linter uses
  function parse(text){
    const res = { tables: [], columns: [], measures: [], rels: [], model: null, has: {}, error: null };
    const lines = (text || '').replace(/\r/g, '').split('\n');
    let h = -1, map = {};
    for (let i = 0; i < Math.min(lines.length, 15); i++) {
      const cells = lines[i].split('\t').map(c => low(unquoteCell(c.trim())).replace(/^.*\[|\]$/g, ''));
      if (cells.includes('kind') && cells.includes('table') && cells.includes('name')) { h = i; cells.forEach((c, j) => { map[c] = j; }); break; }
    }
    if (h < 0) { res.error = 'The header row (Kind, Table, Name…) wasn’t found. Run the export query below, select Copy above the results grid, and paste here.'; return res; }
    res.has = { summarize: 'summarize' in map, sortBy: 'sortby' in map, hierarchies: 'hierarchies' in map };
    const get = (c, k) => map[k] === undefined ? '' : restore(unquoteCell((c[map[k]] || '').trim()));
    let modelRow = false, measureFlagsSeen = false;
    for (let i = h + 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const c = lines[i].split('\t'), kind = low(get(c, 'kind')), table = get(c, 'table'), name = get(c, 'name'), flags = low(get(c, 'flags'));
      if (/^(localdatetable_|datetabletemplate_)/i.test(table)) continue;
      if (kind === 'table') res.tables.push({ name, hidden: /\bhidden\b/.test(flags), category: get(c, 'type'), expression: get(c, 'expression') });
      else if (kind === 'column') {
        if (/^RowNumber-/i.test(name)) continue;
        res.columns.push({ table, name, dataType: get(c, 'type'), folder: get(c, 'folder'), hidden: /\bhidden\b/.test(flags), key: /\bkey\b/.test(flags),
          expression: get(c, 'expression'), summarize: get(c, 'summarize'), sortBy: get(c, 'sortby'), hierarchies: get(c, 'hierarchies') });
      } else if (kind === 'measure') {
        if (/text|dynamic-format/.test(flags)) measureFlagsSeen = true;
        res.measures.push({ table, name, formatString: get(c, 'type'), folder: get(c, 'folder'), hidden: /\bhidden\b/.test(flags),
          text: /\btext\b/.test(flags), dynamicFormat: /dynamic-format/.test(flags), expression: get(c, 'expression') });
      } else if (kind === 'relationship') {
        res.rels.push({ fromTable: table, fromColumn: name, toTable: get(c, 'totable'), toColumn: get(c, 'tocolumn'), card: get(c, 'type'),
          both: /both/.test(flags), inactive: /inactive/.test(flags) });
      } else if (kind === 'model') { modelRow = true; res.model = { name, discourage: /discourage-implicit/.test(flags) }; }
    }
    res.has.model = modelRow;
    res.has.upgraded = res.has.summarize && modelRow;
    if (!res.tables.length && !res.columns.length && !res.measures.length) res.error = 'No tables, columns or measures were found under the header row.';
    return res;
  }

  /* Column references in DAX: 'Table'[Col], Table[Col], or bare [Col] */
  // blank out comments and string literals in one pass, so "--" or "//" inside a string (a URL, say)
  // doesn't hide the rest of the line, and a name inside a string isn't read as a reference
  function stripDaxText(e){
    const s = e || ''; let out = '', i = 0;
    while (i < s.length) {
      const c = s[i], n = s[i + 1];
      if (c === '"') { let j = i + 1; while (j < s.length) { if (s[j] === '"') { if (s[j + 1] === '"') { j += 2; continue; } break; } j++; } out += '""'; i = j + 1; continue; }
      if (c === "'") { let j = i + 1; while (j < s.length) { if (s[j] === "'") { if (s[j + 1] === "'") { j += 2; continue; } break; } j++; } out += s.slice(i, j + 1); i = j + 1; continue; }
      if (c === '[') { const j = s.indexOf(']', i + 1); let k = j; while (k >= 0 && s[k + 1] === ']') k = s.indexOf(']', k + 2); if (k < 0) { out += s.slice(i); break; } out += s.slice(i, k + 1); i = k + 1; continue; }
      if ((c === '/' && n === '/') || (c === '-' && n === '-')) { const j = s.indexOf('\n', i); out += ' '; i = j < 0 ? s.length : j; continue; }
      if (c === '/' && n === '*') { const j = s.indexOf('*/', i + 2); out += ' '; i = j < 0 ? s.length : j + 2; continue; }
      out += c; i++;
    }
    return out;
  }
  // names that appear only as text (inside a string or comment): worth a look before deleting
  function textMentions(m, name){
    const needle = low(name), re = new RegExp('(^|[^\\w])' + needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w])(?!\\s*\\()', 'i');
    return m.measures.filter(x => low(x.name) !== needle && re.test((x.expression || '').replace(/\[(?:[^\]]|\]\])*\]/g, '[]').replace(/'(?:[^']|'')*'/g, "''")) && !refs(x.expression).some(r => low(r.col) === needle)).map(x => x.name);
  }
  function refs(expr){
    const out = [], re = /(?:'((?:[^']|'')+)'|([A-Za-z_À-￿][\w.À-￿]*))?\s*\[((?:[^\]]|\]\])+)\]/g;
    const s = stripDaxText(expr); let m;
    while ((m = re.exec(s))) out.push({ table: m[1] ? m[1].replace(/''/g, "'") : m[2] || '', col: m[3].replace(/\]\]/g, ']') });
    return out;
  }
  const key = (t, c) => low(t) + '\u0001' + low(c);

  // Why each column counts as used inside the model
  function usage(m){
    const tables = new Set(m.tables.map(t => low(t.name)).concat(m.columns.map(c => low(c.table))));
    const byName = {}; m.columns.forEach(c => { (byName[low(c.name)] = byName[low(c.name)] || []).push(c); });
    const used = new Map();
    const mark = (t, c, why) => { const k = key(t, c); if (!used.has(k)) used.set(k, new Set()); used.get(k).add(why); };
    const scan = (expr, homeTable, why) => refs(expr).forEach(r => {
      if (r.table && tables.has(low(r.table))) mark(r.table, r.col, why);
      else (byName[low(r.col)] || []).forEach(c => mark(c.table, c.name, why)); // bare [Col]: could be any column of that name
    });
    m.measures.forEach(x => scan(x.expression, x.table, 'measure'));
    m.columns.forEach(x => { if (x.expression) scan(x.expression, x.table, 'calculated column'); });
    m.tables.forEach(t => { if (t.expression) scan(t.expression, t.name, 'calculated table'); });
    (m.extraExprs || []).forEach(x => scan(x.expr, x.table, x.why));
    m.rels.forEach(r => { mark(r.fromTable, r.fromColumn, 'relationship'); mark(r.toTable, r.toColumn, 'relationship'); });
    (m.deps || []).forEach(d => { if (/column/i.test(d.refType) && d.refTable && !(low(d.type).includes('column') && low(d.table) === low(d.refTable) && low(d.object) === low(d.ref))) mark(d.refTable, d.ref, 'dependency'); });
    m.columns.forEach(x => { if (x.sortBy) mark(x.table, x.sortBy, 'sort by'); if (x.hierarchies) mark(x.table, x.name, 'hierarchy'); });
    return used;
  }

  // Why each measure counts as used: other measures, calculated columns and tables (field parameters), the report
  function measureUsage(m, rep){
    const byName = new Map(m.measures.map(x => [low(x.name), x]));
    const used = new Map();
    const mark = (n, why) => { const k = low(n); if (!byName.has(k)) return; if (!used.has(k)) used.set(k, new Set()); used.get(k).add(why); };
    const scan = (expr, why, self) => refs(expr).forEach(r => { if (!self || low(r.col) !== low(self)) mark(r.col, why); });
    m.measures.forEach(x => scan(x.expression, 'measure', x.name));
    m.columns.forEach(x => { if (x.expression) scan(x.expression, 'calculated column'); });
    m.tables.forEach(t => { if (t.expression) scan(t.expression, 'calculated table or field parameter'); });
    (m.extraExprs || []).forEach(x => scan(x.expr, x.why));
    (m.deps || []).forEach(d => { if (/measure/i.test(d.refType) && !(low(d.type) === 'measure' && low(d.object) === low(d.ref))) mark(d.ref, 'dependency: ' + low(d.type).replace(/_/g, ' ')); });
    if (rep) { (rep.refs || []).forEach(r => mark(r[1], 'report')); (rep.exprs || []).forEach(e => scan(e, 'report-level measure')); }
    return used;
  }

  const RULES = [
    { id: 'folder', title: 'Measures without a display folder', short: 'No display folder',
      why: 'In a table with more than a handful of measures, folders are how report authors find the one they want. Measures outside a folder sit in one long list at the top of the table.',
      fix: 'In Model view, select several measures at once (Ctrl+click), then set <b>Display folder</b> in the Properties pane. Use <code>\\</code> for subfolders.' },
    { id: 'format', title: 'Measures without a format string', short: 'No format string',
      why: 'Without a format, a measure shows raw numbers such as 0.2381 or 1234567.891, and each visual has to be formatted by hand.',
      fix: 'In Model view, select the measures and set <b>Format</b> in the Properties pane (Whole number, Decimal, Percentage, Currency), or pick them in the Data pane and use the Measure tools ribbon.' },
    { id: 'keys', title: 'Visible key columns', short: 'Visible key',
      why: 'Key columns only exist to join tables. Left visible, they clutter the field list and invite authors to filter or count on the wrong side of a relationship.',
      fix: 'In Model view, select the columns and turn on <b>Is hidden</b> in the Properties pane (or right-click, <b>Hide in report view</b>).' },
    { id: 'bidir', title: 'Bidirectional relationships', short: 'Both directions',
      why: 'Filters flowing both ways can make results ambiguous, slow queries down, and block other relationships from being active. Most models need them only in rare cases, such as a bridge table.',
      fix: 'In Model view, double-click the relationship and set <b>Cross filter direction</b> to <b>Single</b>. Where a measure truly needs the other direction, use <code>CROSSFILTER ( … , Both )</code> inside that measure instead.' },
    { id: 'implicit', title: 'Implicit measures', short: 'Implicit measure',
      why: 'A numeric column set to summarize lets authors drag it into a visual and get an automatic Sum or Count: an implicit measure that bypasses your explicit measures, their formats and their logic.',
      fix: 'Turn on <b>Discourage implicit measures</b>: in Model view, select the model in the Data pane’s <b>Model</b> tab and switch it on in Properties. For single columns, set <b>Summarize by</b> to <b>None</b> in the Properties pane (you can select several at once).' },
    { id: 'unused', title: 'Unused columns', short: 'Unused column',
      why: 'Every column is loaded and compressed whether anyone uses it or not. Removing unused ones makes the model smaller and faster to refresh.',
      fix: 'Remove the column in Power Query (Choose columns or Remove columns), not just in the model, so it isn’t loaded at all. Add report pages in Step 1 to check visible columns against them, and check any other reports on the model before removing a column.' },
    { id: 'unusedm', title: 'Unused measures', short: 'Unused measure', needsReport: true,
      why: 'Measures nobody uses still have to be kept working, tested and explained. Old versions and experiments pile up and make the right measure harder to find.',
      fix: 'Check other reports on this model first (they can’t be seen from here), then delete the measure in Power BI Desktop, or move it to an <b>_Archive</b> display folder and hide it for a while if you’re unsure.' },
    { id: 'alttext', title: 'Visuals without alt text', short: 'No alt text', needsReport: true, group: 'report',
      why: 'Screen readers read a visual’s alt text to describe it. Without it, people using one hear only the visual type.',
      fix: 'Select the visual, open <b>Format &gt; General &gt; Alt text</b>, and describe what the visual shows and the point it makes (up to 250 characters). Use <b>fx</b> to build it from a measure so it stays current.' },
    { id: 'title', title: 'Charts and tables with the title turned off', short: 'Title off', needsReport: true, group: 'report',
      why: 'A title says what a chart shows and is announced by screen readers. A text box above the chart looks the same but isn’t tied to it.',
      fix: 'Turn on <b>Format &gt; General &gt; Title</b>, or, if a text box does the job, add alt text to the chart so screen readers still know what it is.' },
    { id: 'hiddenvis', title: 'Hidden visuals no bookmark shows', short: 'Hidden visual', needsReport: true, group: 'report',
      why: 'A hidden visual still loads with the page in some cases and makes the page harder to maintain. If no bookmark ever shows it, nobody sees it.',
      fix: 'Open <b>View &gt; Selection</b>, find the visual (it has a crossed-out eye) and delete it, or add it to the bookmark that should show it.' },
    { id: 'bookmarks', title: 'Bookmarks no button or navigator uses', short: 'Unused bookmark', needsReport: true, group: 'report',
      why: 'Old bookmarks keep old filters and visibility settings. Changing the page later can make them show the wrong thing if someone opens them.',
      fix: 'Open <b>View &gt; Bookmarks</b> and delete the ones you no longer need. Keep any that readers open from the Bookmarks pane on purpose.' },
    { id: 'emptypages', title: 'Empty pages', short: 'Empty page', needsReport: true, group: 'report',
      why: 'An empty page shows up in the page list and looks unfinished.',
      fix: 'Delete the page, or hide it (right-click the page tab, <b>Hide page</b>) if you’re still building it.' },
    { id: 'crowded', title: 'Pages with many visuals', short: 'Crowded page', needsReport: true, group: 'report',
      why: 'Every visual runs its own query and has to be drawn. On a crowded page, visuals wait for each other, so the page takes longer to be ready, and readers have more to take in.',
      fix: 'Combine cards into one multi-row card or new card visual, move detail to a drill-through or tooltip page, and use buttons or a field parameter to swap visuals instead of showing them all at once.' }
  ];

  const numeric = t => NUMERIC.test((t || '').trim());
  const TYPE_NAMES = { tableEx: 'Table', pivotTable: 'Matrix', cardVisual: 'Card', card: 'Card', multiRowCard: 'Multi-row card', kpi: 'KPI', image: 'Image', map: 'Map', filledMap: 'Filled map', azureMap: 'Azure map', decompositionTreeVisual: 'Decomposition tree' };
  const typeName = t => TYPE_NAMES[t] || (t ? t.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase()) : 'Visual');
  const looksKey = n => /(key|id|sk|code)$/i.test(n.replace(/[\s_]+/g, '')) || /^(id|key)\b/i.test(n);

  function lint(m, cfg){
    const on = id => !cfg.off || !cfg.off[id];
    if (cfg.deps) m = Object.assign({}, m, { deps: cfg.deps });
    // calculated tables (field parameters) read from the semantic model's TMDL in the PBIP folder
    if (cfg.report && (cfg.report.modelExprs || []).length) m = Object.assign({}, m, { extraExprs: cfg.report.modelExprs.map(x => ({ expr: x.expr, table: x.table, why: x.calcGroup ? 'calculation group' : 'calculated table or field parameter' })) });
    if (cfg.deps) m = Object.assign({}, m, { deps: cfg.deps });
    const out = [], notes = {};
    const add = (rule, sev, kind, table, name, detail, uid) => out.push({ rule, sev, kind, table, name, detail, id: rule + '|' + kind + '|' + low(table) + '|' + low(name) + (uid ? '|' + uid : '') });
    const hiddenTable = new Set(m.tables.filter(t => t.hidden).map(t => low(t.name)));
    const visible = x => !x.hidden && !hiddenTable.has(low(x.table));

    if (on('folder')) {
      const perTable = {}; m.measures.forEach(x => { perTable[low(x.table)] = (perTable[low(x.table)] || 0) + 1; });
      m.measures.filter(visible).filter(x => !(x.folder || '').trim()).forEach(x =>
        add('folder', 'warn', 'Measure', x.table, x.name, 'No display folder. ' + (perTable[low(x.table)] > 1 ? perTable[low(x.table)] + ' measures in this table.' : 'The only measure in this table.')));
    }
    if (on('format')) {
      m.measures.filter(visible).filter(x => !(x.formatString || '').trim() && !x.dynamicFormat && !x.text).forEach(x =>
        add('format', 'warn', 'Measure', x.table, x.name, 'No format string.'));
      if (!m.has.upgraded) notes.format = 'Measures with a dynamic format string, or that return text, also show here. The updated export query tells them apart.';
    }
    if (on('keys')) {
      const seen = new Set();
      const colOf = (t, n) => m.columns.find(c => low(c.table) === low(t) && low(c.name) === low(n));
      m.rels.forEach(r => {
        const many = /^many/i.test(r.card) || !/:/.test(r.card);
        [[r.fromTable, r.fromColumn, many ? 'many' : 'one', r.toTable], [r.toTable, r.toColumn, /:many$/i.test(r.card) ? 'many' : 'one', r.fromTable]].forEach(([t, n, side, other]) => {
          const c = colOf(t, n); const k = key(t, n); if (!c || seen.has(k) || !visible(c)) return; seen.add(k);
          if (side === 'many') add('keys', 'warn', 'Column', t, n, 'Visible foreign key: it links this table to ' + other + '. Authors should use the columns of ' + other + ' instead.');
          else add('keys', looksKey(n) ? 'warn' : 'info', 'Column', t, n, 'Visible key on the one side of the relationship with ' + other + '.' + (looksKey(n) ? '' : ' Keep it visible if people read it as a label (a code or name, say).'));
        });
      });
      m.columns.filter(c => c.key && visible(c) && !seen.has(key(c.table, c.name))).forEach(c => add('keys', 'info', 'Column', c.table, c.name, 'Marked as the table’s key column and visible.'));
    }
    if (on('bidir')) {
      m.rels.filter(r => r.both).forEach(r => {
        const oneToOne = /^one:one$/i.test(r.card);
        add('bidir', oneToOne ? 'info' : 'warn', 'Relationship', r.fromTable, r.fromColumn + ' → ' + qName(r.toTable) + bracket(r.toColumn),
          (oneToOne ? 'One-to-one: these always filter both ways. Check the two tables shouldn’t be one table.' : r.card.replace(':', ' to ') + ', filtering both directions.') + (r.inactive ? ' (inactive)' : ''));
      });
    }
    if (on('implicit')) {
      if (!m.has.model) notes.implicit = 'This export doesn’t say whether Discourage implicit measures is on' + (m.has.summarize ? '' : ', or how each column summarizes') + '. Run the updated export query to check it.';
      else if (!m.model.discourage) add('implicit', 'warn', 'Model', '', m.model.name || 'Model', 'Discourage implicit measures is off, so any numeric column can be dragged into a visual and summed.');
      if (m.has.model && m.model.discourage) notes.implicit = '✓ Discourage implicit measures is on, so report authors can’t create implicit measures. Column settings don’t matter.';
      else if (m.has.summarize) {
        m.columns.filter(c => visible(c) && numeric(c.dataType) && c.summarize && !/^none$/i.test(c.summarize)).forEach(c =>
          add('implicit', 'warn', 'Column', c.table, c.name, 'Numeric column set to ' + (/^default$/i.test(c.summarize) ? 'the default (Sum)' : c.summarize) + '.'));
      }
    }
    if (on('unused')) {
      const used = usage(m);
      const rep = cfg.report && cfg.report.refs ? cfg.report : null;
      const inReport = new Set(); if (rep) rep.refs.forEach(r => inReport.add(key(r[0], r[1])));
      // Field parameter tables are used through the report: 'X', 'X Fields', 'X Order'
      const names = new Set(m.columns.map(c => key(c.table, c.name)));
      const fieldParam = new Set(m.columns.filter(c => names.has(key(c.table, c.name + ' Fields')) && names.has(key(c.table, c.name + ' Order'))).map(c => low(c.table)));
      const where = 'measure, calculated column, relationship' + (m.has.sortBy ? ', sort order' : '') + (m.has.hierarchies ? ' or hierarchy' : '');
      const pagesTxt = rep ? rep.pages + ' report page' + (rep.pages === 1 ? '' : 's') : '';
      let visibleUnused = 0, savedByReport = 0;
      m.columns.filter(c => !used.has(key(c.table, c.name)) && !fieldParam.has(low(c.table))).forEach(c => {
        if (rep && inReport.has(key(c.table, c.name))) { savedByReport++; return; }
        if (!visible(c)) add('unused', 'warn', 'Column', c.table, c.name, 'Hidden and not used anywhere in the model' + (rep ? ' or on the ' + pagesTxt + ' checked' : '') + '. Likely safe to remove.');
        else if (rep) add('unused', 'warn', 'Column', c.table, c.name, 'Visible, but not used by any ' + where + ', or on the ' + pagesTxt + ' checked.');
        else if (cfg.visibleUnused) add('unused', 'info', 'Column', c.table, c.name, 'Visible and not used by any ' + where + '. Check report pages before removing it.');
        else visibleUnused++;
      });
      notes.visibleUnused = rep ? 0 : visibleUnused;
      const extra = [];
      if (!m.has.sortBy) extra.push('This export doesn’t list sort-by columns or hierarchies, so a hidden column that only sorts another (Month Number, say) shows as unused. Run the updated export query to rule those out.');
      if (rep) {
        extra.push('Checked against ' + pagesTxt + ' in ' + rep.reports.join(', ') + (savedByReport ? '; ' + savedByReport + ' column' + (savedByReport === 1 ? ' is' : 's are') + ' used only there' : '') + '. Other reports on the published model, Excel workbooks and dashboards can’t be seen, so check with their owners before removing a column.');
        const objs = new Set(m.columns.map(c => key(c.table, c.name)).concat(m.measures.map(x => key(x.table, x.name))));
        const tabs = new Set(m.tables.map(t => low(t.name)));
        const known = rep.refs.filter(r => objs.has(key(r[0], r[1])) || (r[2] && tabs.has(low(r[0]))));
        if (rep.refs.length >= 5 && known.length < rep.refs.length / 2) extra.push('⚠ Only ' + known.length + ' of the ' + rep.refs.length + ' fields on these report pages are in this model export. The report may be built on a different model.');
        else {
          const missing = rep.refs.filter(r => !r[2] && tabs.has(low(r[0])) && !objs.has(key(r[0], r[1])));
          if (missing.length) extra.push('The report uses ' + missing.length + ' field' + (missing.length === 1 ? '' : 's') + ' this export doesn’t have (' + missing.slice(0, 6).map(r => qName(r[0]) + bracket(r[1])).join(', ') + (missing.length > 6 ? ', …' : '') + '): report-level measures, or visuals that are already broken.');
        }
      }
      if (extra.length) notes.unused = extra.join(' ');
    }
    const rep = cfg.report && cfg.report.refs ? cfg.report : null;
    if (on('unusedm')) {
      if (!rep) {
        const used = measureUsage(m, null), n = m.measures.filter(x => !used.has(low(x.name))).length;
        notes.unusedm = 'Needs report pages: a measure can be used only on a visual, so add the report\u2019s PBIP folder in Step 1. ' + (n ? n + ' measure' + (n === 1 ? ' isn\u2019t' : 's aren\u2019t') + ' used by any other measure, calculated column or field parameter.' : '');
      } else {
        const used = measureUsage(m, rep);
        const noCalcTables = !m.tables.some(t => t.expression) && !(m.extraExprs || []).length;
        m.measures.filter(x => !used.has(low(x.name))).forEach(x => {
          const t = textMentions(m, x.name);
          add('unusedm', t.length ? 'info' : 'warn', 'Measure', x.table, x.name, (x.hidden ? 'Hidden. ' : '') + 'Not used by any other measure, calculated column, field parameter, or visual, filter or formatting on the ' + rep.pages + ' report page' + (rep.pages === 1 ? '' : 's') + ' checked.' + (t.length ? ' Its name does appear as text (in a string or comment) in ' + t.slice(0, 3).map(n => '[' + n + ']').join(', ') + (t.length > 3 ? ' and ' + (t.length - 3) + ' more' : '') + ': check those before deleting it.' : ''));
        });
        const bits = ['Checked against ' + rep.pages + ' page' + (rep.pages === 1 ? '' : 's') + ' in ' + rep.reports.join(', ') + '. Other reports on the published model, Excel workbooks and dashboards can\u2019t be seen from here.'];
        const objs = new Set(m.columns.map(c => key(c.table, c.name)).concat(m.measures.map(x => key(x.table, x.name))));
        const known = rep.refs.filter(r => objs.has(key(r[0], r[1])) || m.measures.some(x => low(x.name) === low(r[1])));
        if (rep.refs.length >= 5 && known.length < rep.refs.length / 2) bits.push('\u26a0 Only ' + known.length + ' of the ' + rep.refs.length + ' fields on these pages are in this model export, so the report may be built on a different model and this list isn\u2019t reliable.');
        if (!m.deps) bits.push('For the model\u2019s own dependency list (the most complete check), paste the dependencies query results in Step 1.');
        else bits.push('Dependencies from Power BI are included (' + m.deps.length + ' rows).');
        if (noCalcTables) bits.push('This export doesn\u2019t include calculated table definitions, so measures used only in a field parameter may show here. Run the updated export query, or choose the project folder that also holds the semantic model.');
        notes.unusedm = bits.join(' ');
      }
    }
    // report checks: only with PBIR report pages
    const d = rep && rep.detail;
    const REPORT_RULES = ['alttext', 'title', 'hiddenvis', 'bookmarks', 'emptypages', 'crowded'];
    if (!d) REPORT_RULES.forEach(id => { if (on(id)) notes[id] = rep && rep.legacy ? 'This report uses the older single-file format (report.json), so these checks can\u2019t run. Save it with the PBIR format (Options > Preview features) to check it.' : 'Needs report pages: add the report\u2019s PBIP folder in Step 1.'; });
    else {
      const pageLabel = p => p.name + (rep.reports.length > 1 ? ' (' + p.report + ')' : '');
      const CHARTS = /^(barChart|clusteredBarChart|stackedBarChart|hundredPercentStackedBarChart|columnChart|clusteredColumnChart|stackedColumnChart|hundredPercentStackedColumnChart|lineChart|areaChart|stackedAreaChart|hundredPercentStackedAreaChart|lineClusteredColumnComboChart|lineStackedColumnComboChart|ribbonChart|waterfallChart|funnel|scatterChart|pieChart|donutChart|treemap|map|filledMap|azureMap|shapeMap|tableEx|pivotTable|decompositionTreeVisual|keyDriversVisual|gauge)$/;
      const NO_ALT = /^(textbox|basicShape|shape|actionButton|pageNavigator|bookmarkNavigator|slicer|advancedSlicerVisual|listSlicer|textSlicer)$/i;
      const DECOR = /^(textbox|basicShape|shape|image|actionButton|pageNavigator|bookmarkNavigator)$/i;
      d.pages.forEach(p => {
        const vis = p.visuals.filter(v => !v.group);
        if (on('alttext')) vis.filter(v => !v.hidden && !NO_ALT.test(v.type) && !v.alt).forEach(v => add('alttext', 'info', 'Visual', pageLabel(p), v.label, 'No alt text' + (v.titleOff ? ', and the title is off' : '') + '.' + (v.label !== typeName(v.type) ? ' ' + typeName(v.type) + '.' : ''), v.id));
        if (on('title')) vis.filter(v => !v.hidden && CHARTS.test(v.type) && v.titleOff).forEach(v => add('title', v.alt ? 'info' : 'warn', 'Visual', pageLabel(p), v.label, 'Title turned off' + (v.alt ? ', but it has alt text.' : ' and no alt text, so nothing says what it shows.'), v.id));
        if (on('hiddenvis')) vis.filter(v => v.hidden && !v.inBookmark).forEach(v => add('hiddenvis', 'info', 'Visual', pageLabel(p), v.label, 'Hidden, and no bookmark shows it.' + (v.label !== typeName(v.type) ? ' ' + typeName(v.type) + '.' : ''), v.id));
        if (on('emptypages') && !vis.length) add('emptypages', p.hidden ? 'info' : 'warn', 'Page', pageLabel(p), p.name, 'No visuals' + (p.hidden ? ' (hidden page).' : '.'), p.id);
        if (on('crowded')) {
          const data = vis.filter(v => !v.hidden && !DECOR.test(v.type)).length, lim = +cfg.crowded || 12;
          if (data > lim) add('crowded', data > lim * 1.5 ? 'warn' : 'info', 'Page', pageLabel(p), p.name, data + ' visuals that load data (the limit set is ' + lim + ').', p.id);
        }
      });
      if (on('bookmarks')) d.bookmarks.filter(b => !b.used).forEach(b => add('bookmarks', 'info', 'Bookmark', b.report, b.label, 'No button or bookmark navigator uses it' + (b.group ? ' (group ' + b.group + ')' : '') + '. Readers can still open it from the Bookmarks pane.', b.id));
      if (on('crowded')) notes.crowded = 'Counts visuals that load data (not text boxes, shapes, images or buttons). Change the limit above if your pages are designed around more.';
    }
    return { findings: out, notes };
  }

  /* Fields used on report pages, from the report files of a PBIP folder (PBIR or the older report.json).
     files: Map path -> text. Returns { reports, pages, visuals, refs: [[table, name, isLevel]] } */
  function reportUsage(files){
    const refs = new Map(), reports = new Set(), pages = new Set(); let visuals = 0, readable = 0;
    const isObj = n => n && typeof n === 'object' && !Array.isArray(n);
    const addRef = (t, n, lvl) => { if (t && n) refs.set(key(t, n), [t, n, lvl ? 1 : 0]); };
    const doc = data => {
      const aliases = {};
      const collect = n => { if (isObj(n)) { for (const it of Array.isArray(n.From) ? n.From : []) if (isObj(it) && it.Name && it.Entity) aliases[it.Name] = it.Entity; Object.values(n).forEach(collect); } else if (Array.isArray(n)) n.forEach(collect); };
      collect(data);
      const ent = ex => { const s = isObj(ex) && ex.SourceRef; return isObj(s) ? (s.Entity || aliases[s.Source || ''] || '') : ''; };
      const walk = n => {
        if (typeof n === 'string') { const t = n.trim(); if ((t[0] === '{' || t[0] === '[') && t.length > 20 && /"(Property|Entity)"/.test(t)) { try { doc(JSON.parse(t)); } catch (e) {} } return; }
        if (isObj(n)) {
          if ('Property' in n && typeof n.Property === 'string') addRef(ent(n.Expression), n.Property);
          if ('Level' in n && isObj(n.Expression) && isObj(n.Expression.Hierarchy)) addRef(ent(n.Expression.Hierarchy.Expression), n.Level, true);
          Object.values(n).forEach(walk);
        } else if (Array.isArray(n)) n.forEach(walk);
      };
      walk(data);
    };
    // details for the report checks (PBIR only)
    const pg = new Map(), bms = [], bmText = [], navs = [], exprs = [], modelExprs = []; let legacy = false;
    const lit = o => { const v = o && o.expr && o.expr.Literal && o.expr.Literal.Value; return typeof v === 'string' ? v.replace(/^'(.*)'$/s, '$1').replace(/''/g, "'") : v; };
    const prop = (objs, obj, p) => { const a = objs && objs[obj]; const x = Array.isArray(a) && a[0] && a[0].properties; return x ? x[p] : undefined; };
    const page = (r, id) => { const k = r + '|' + id; if (!pg.has(k)) pg.set(k, { report: r, id, name: id, hidden: false, visuals: [], order: 1e4 }); return pg.get(k); };
    for (const [path, text] of files) {
      // calculated tables (field parameters) in the semantic model's TMDL, for measure usage
      if (/\.SemanticModel\/definition\/tables\/[^\/]+\.tmdl$/i.test(path) && /^\tcalculationGroup\b/m.test(text)) { const t = (text.match(/^table\s+(.+?)\s*$/m) || [])[1] || ''; modelExprs.push({ table: t.replace(/^'(.*)'$/, '$1'), expr: text, calcGroup: true }); continue; }
      if (/\.SemanticModel\/definition\/tables\/[^\/]+\.tmdl$/i.test(path) && /=\s*calculated\s*$/m.test(text)) { const t = (text.match(/^table\s+(.+?)\s*$/m) || [])[1] || ''; modelExprs.push({ table: t.replace(/^'(.*)'$/, '$1'), expr: text.slice(text.search(/^\tpartition\b/m)) }); continue; }
      const m = path.match(/(?:^|\/)([^\/]+)\.Report\//i); if (!m || !/\.json$/i.test(path)) continue;
      let data; try { data = JSON.parse(text.replace(/^﻿/, '')); } catch (e) { continue; }
      readable++; reports.add(m[1]);
      if (/\/pages\/[^\/]+\/page\.json$/i.test(path)) pages.add(path);
      if (/\/visuals\/[^\/]+\/visual\.json$/i.test(path)) visuals++;
      if (/\.Report\/report\.json$/i.test(path) && Array.isArray(data.sections)) data.sections.forEach((sec, i) => { pages.add(path + '#' + i); visuals += (sec.visualContainers || []).length; });
      doc(data);
      const r = m[1];
      let x;
      if (/\.Report\/report\.json$/i.test(path) && Array.isArray(data.sections)) legacy = true;
      if ((x = path.match(/\/pages\/([^\/]+)\/page\.json$/i))) { const p = page(r, x[1]); p.name = data.displayName || x[1]; p.hidden = /hidden/i.test(data.visibility || ''); p.path = path; }
      if ((x = path.match(/\/pages\/pages\.json$/i)) && Array.isArray(data.pageOrder)) data.pageOrder.forEach((id, i) => { page(r, id).order = i; });
      if ((x = path.match(/\/pages\/([^\/]+)\/visuals\/([^\/]+)\/visual\.json$/i))) {
        const v = data.visual || {}, o = v.visualContainerObjects || {}, type = v.visualType || (data.visualGroup ? 'group' : '');
        const title = lit(prop(o, 'title', 'text')), alt = prop(o, 'general', 'altText');
        const altOk = alt && (typeof lit(alt) === 'string' ? lit(alt).trim() : true);
        const fl = new Set(); const walkF = n => { if (typeof n === 'string') { const t = n.trim(); if ((t[0] === '{' || t[0] === '[') && t.length > 20 && /"Property"/.test(t)) { try { walkF(JSON.parse(t)); } catch (e) {} } return; } if (isObj(n)) { if (typeof n.Property === 'string') fl.add(low(n.Property)); Object.values(n).forEach(walkF); } else if (Array.isArray(n)) n.forEach(walkF); }; walkF(data);
        page(r, x[1]).visuals.push({ fields: [...fl], id: data.name || x[2], type, group: !!data.visualGroup, hidden: !!data.isHidden, alt: !!altOk, titleOff: lit(prop(o, 'title', 'show')) === 'false', label: (typeof title === 'string' && title.trim()) || (data.visualGroup && data.visualGroup.displayName) || typeName(type) });
        if (/bookmarkNavigator/i.test(type)) navs.push({ report: r, text });
        bmText.push({ report: r, text: /bookmarkNavigator/i.test(type) ? '' : text });
      }
      if (/\/bookmarks\/bookmarks\.json$/i.test(path) && Array.isArray(data.items)) {
        const walkB = (items, group) => items.forEach(it => { if (!it || !it.name) return; if (Array.isArray(it.children)) walkB(it.children, it.displayName || it.name); else { const y = bms.find(z => z.report === r && z.name === it.name); if (y) { y.group = group || ''; if (it.displayName) y.label = it.displayName; } else bms.push({ report: r, name: it.name, group: group || '', label: it.displayName || it.name }); } });
        walkB(data.items, '');
        data.items.filter(it => it && Array.isArray(it.children)).forEach(g => g.children.forEach(c => { const b = bms.find(y => y.report === r && y.name === c.name); if (b) b.groupName = g.name; }));
      }
      if (/\/bookmarks\/[^\/]+\.bookmark\.json$/i.test(path)) { const b = data.name; bmText.push({ report: r, bookmark: true, text }); if (b) { const y = bms.find(z => z.report === r && z.name === b); if (y && data.displayName) y.label = data.displayName; else if (!y) bms.push({ report: r, name: b, group: '', label: data.displayName || b }); } }
      if (/\/reportExtensions\.json$/i.test(path)) { const walkE = n => { if (isObj(n)) { if (typeof n.expression === 'string') exprs.push(n.expression); Object.values(n).forEach(walkE); } else if (Array.isArray(n)) n.forEach(walkE); }; walkE(data); }
    }
    // bookmark labels from their own files, and which ones a button or navigator uses
    bms.forEach(b => {
      const own = bmText.filter(t => !t.bookmark && t.report === b.report).some(t => t.text.includes(b.name));
      const nav = navs.filter(n => n.report === b.report).some(n => !bms.some(o => o.groupName && n.text.includes(o.groupName)) || (b.groupName && n.text.includes(b.groupName)));
      b.used = own || nav; b.id = b.report + '|' + b.name;
    });
    const bmAll = bmText.filter(t => t.bookmark).map(t => t.text).join('\n');
    pg.forEach(p => p.visuals.forEach(v => { if (v.hidden) v.inBookmark = bmAll.includes(v.id); }));
    const detail = legacy && !pg.size ? null : { pages: [...pg.values()].filter(p => p.path).sort((a, b) => a.report.localeCompare(b.report) || a.order - b.order), bookmarks: bms.map(({ report, name, group, label, used, id }) => ({ report, name, group, label, used, id })) };
    if (detail) detail.pages.forEach(p => { delete p.path; });
    return { reports: [...reports].sort(), pages: pages.size, visuals, files: readable, refs: [...refs.values()], exprs, modelExprs, legacy: legacy && !pg.size, detail };
  }

  /* A folder can hold several projects: one entry per .Report folder, each with the semantic model its
     definition.pbir points to (byPath), so each report can be checked on its own. */
  function reportList(files){
    const roots = new Set();
    for (const p of files.keys()) { const m = p.match(/^(.*?[^\/]+\.Report)\//i); if (m) roots.add(m[1]); }
    const names = [...roots].map(r => r.split('/').pop().replace(/\.Report$/i, ''));
    return [...roots].sort().map(root => {
      const name = root.split('/').pop().replace(/\.Report$/i, ''), parent = root.split('/').slice(0, -1).join('/');
      let model = '';
      const pbir = files.get(root + '/definition.pbir');
      if (pbir) { try { const d = JSON.parse(pbir.replace(/^\uFEFF/, '')); const bp = d && d.datasetReference && d.datasetReference.byPath && d.datasetReference.byPath.path; if (bp) { const parts = (parent ? parent.split('/') : []); bp.replace(/\\/g, '/').split('/').forEach(s => { if (s === '..') parts.pop(); else if (s && s !== '.') parts.push(s); }); model = parts.join('/'); } } catch (e) {} }
      const sub = new Map();
      for (const [p, t] of files) if (p.startsWith(root + '/') || (model && p.startsWith(model + '/'))) sub.set(p, t);
      const u = reportUsage(sub);
      return Object.assign(u, { id: root, name, label: name + (names.filter(n => n === name).length > 1 ? ' (' + (parent.split('/').pop() || parent) + ')' : ''), model: model ? model.split('/').pop() : '', live: !pbir || !model });
    }).filter(r => r.files);
  }
  // several reports checked together, as one
  function mergeReports(list){
    if (!list.length) return null;
    if (list.length === 1) return list[0];
    const refs = new Map(); list.forEach(r => r.refs.forEach(x => refs.set(low(x[0]) + '\u0001' + low(x[1]), x)));
    const me = new Map(); list.forEach(r => (r.modelExprs || []).forEach(x => me.set(low(x.table), x)));
    const details = list.filter(r => r.detail);
    return { reports: list.map(r => r.label || r.reports.join(', ')), pages: list.reduce((a, r) => a + r.pages, 0), visuals: list.reduce((a, r) => a + r.visuals, 0), files: list.reduce((a, r) => a + r.files, 0),
      refs: [...refs.values()], exprs: [].concat(...list.map(r => r.exprs || [])), modelExprs: [...me.values()], legacy: list.every(r => r.legacy),
      detail: details.length ? { pages: [].concat(...details.map(r => r.detail.pages)), bookmarks: [].concat(...details.map(r => r.detail.bookmarks)) } : null };
  }
  // share of a report's fields that are in this model export (to spot a report built on another model)
  function matchScore(m, r){
    if (!m || !r || !r.refs.length) return null;
    const objs = new Set(m.columns.map(c => key(c.table, c.name)).concat(m.measures.map(x => key(x.table, x.name))));
    const mn = new Set(m.measures.map(x => low(x.name)));
    return r.refs.filter(x => objs.has(key(x[0], x[1])) || mn.has(low(x[1]))).length / r.refs.length;
  }

  /* INFO.CALCDEPENDENCY: the engine's own list of what each object uses */
  const DEPS_QUERY = [
    '// Model Linter: dependencies (what each measure, column and table uses)',
    '// Run in DAX query view, then select Copy above the results grid.',
    'EVALUATE',
    'SELECTCOLUMNS (',
    '\tINFO.CALCDEPENDENCY (),',
    '\t"ObjectType", [OBJECT_TYPE],',
    '\t"Table", [TABLE],',
    '\t"Object", [OBJECT],',
    '\t"RefType", [REFERENCED_OBJECT_TYPE],',
    '\t"RefTable", [REFERENCED_TABLE],',
    '\t"RefObject", [REFERENCED_OBJECT]',
    ')'
  ].join('\n');
  function parseDeps(text){
    const lines = (text || '').replace(/\r/g, '').split('\n'); let map = null; const out = [];
    for (const l of lines) {
      if (!l.trim()) continue;
      const c = l.split('\t').map(x => unquoteCell(x.trim()));
      if (!map) { const h = c.map(x => low(x).replace(/^.*\[|\]$/g, '')); if (h.includes('refobject') || h.includes('referenced_object')) { map = {}; h.forEach((x, j) => { map[x] = j; }); } continue; }
      const g = k => c[map[k]] || '';
      out.push({ type: g('objecttype') || g('object_type'), table: g('table'), object: g('object'), refType: g('reftype') || g('referenced_object_type'), refTable: g('reftable') || g('referenced_table'), ref: g('refobject') || g('referenced_object') });
    }
    return map ? { rows: out } : { error: 'The header row (ObjectType, Table, Object, RefType, RefTable, RefObject) wasn\u2019t found. Use the Copy button above the results grid.' };
  }

  // everything that uses a measure or column, for the "Where is it used?" lookup
  function whereUsed(m, name, cfg){
    cfg = cfg || {};
    const n = low(name.replace(/^.*\[|\]$/g, '').trim()), out = [];
    if (!n) return out;
    const hit = e => refs(e).some(r => low(r.col) === n);
    m.measures.forEach(x => { if (low(x.name) !== n && hit(x.expression)) out.push({ kind: 'Measure', where: qName(x.table) + bracket(x.name) }); });
    m.columns.forEach(x => { if (x.expression && hit(x.expression)) out.push({ kind: 'Calculated column', where: qName(x.table) + bracket(x.name) }); });
    m.tables.forEach(t => { if (t.expression && hit(t.expression)) out.push({ kind: 'Calculated table or field parameter', where: qName(t.name) }); });
    const rep = cfg.report;
    ((rep && rep.modelExprs) || []).forEach(x => { if (hit(x.expr) && !out.some(o => o.where === qName(x.table))) out.push({ kind: x.calcGroup ? 'Calculation group' : 'Calculated table or field parameter', where: qName(x.table) + ' (from the semantic model files)' }); });
    (cfg.deps || []).forEach(d => { if (low(d.ref) === n && !(low(d.object) === n)) out.push({ kind: 'Power BI dependency', where: (d.type || '').replace(/_/g, ' ').toLowerCase() + ' ' + (d.table ? qName(d.table) : '') + bracket(d.object || '') }); });
    if (rep && rep.detail) rep.detail.pages.forEach(p => p.visuals.forEach(v => { if ((v.fields || []).includes(n)) out.push({ kind: 'Report visual', where: p.name + ' \u203a ' + v.label + (v.hidden ? ' (hidden)' : '') }); }));
    else if (rep && rep.refs.some(r => low(r[1]) === n)) out.push({ kind: 'Report', where: 'Used on the report pages checked' });
    ((rep && rep.exprs) || []).forEach(e => { if (hit(e)) out.push({ kind: 'Report-level measure', where: 'reportExtensions.json' }); });
    textMentions(m, name.replace(/^.*\[|\]$/g, '').trim()).forEach(x => out.push({ kind: 'Named as text (string or comment)', where: bracket(x) }));
    return out;
  }

  return { parse, lint, whereUsed, DEPS_QUERY, parseDeps, stripDaxText, refs, usage, measureUsage, reportUsage, reportList, mergeReports, matchScore, RULES, numeric, typeName };
})();
