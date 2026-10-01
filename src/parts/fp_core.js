
/*FP-CORE-START*/
/* ---------- Field Parameter Builder: TMDL for a field parameter or a SWITCH measure selector ---------- */
const FP_META = ['{', '  "version": 3,', '  "kind": 2', '}'];
function fpNames(cfg){
  const t = (cfg.table || '').trim();
  return { table: t, display: t, fields: t + ' Fields', order: t + ' Order', group: (cfg.groupName || 'Group').trim() };
}
function fpRef(it){ return qName(it.table) + bracket(it.name); }
function fpMeasureRef(it){ return bracket(it.name); }
function fpLabel(it){ return (it.label || '').trim() || it.name; }
function fpItemsInModel(model, cfg){
  return (cfg.items || []).map(it => {
    const src = it.kind === 'column'
      ? model.columns.find(c => lc(c.table) === lc(it.table) && lc(c.name) === lc(it.name))
      : model.measures.find(m => lc(m.name) === lc(it.name));
    return Object.assign({}, it, { found: !!src, table: src ? src.table : it.table, format: it.kind === 'measure' && src ? (src.formatString || '') : '' });
  });
}
function fpCheck(model, cfg){
  const out = [];   // { level: 'err'|'warn'|'info', text }
  const n = fpNames(cfg), items = fpItemsInModel(model, cfg);
  const add = (level, text) => out.push({ level, text });
  if (!n.table) add('err', 'Give the table a name.');
  else if (/[.,;:\/\\*|?&%$!+=()\[\]{}<>"]/.test(n.table) || /^\s|\s$/.test(cfg.table || '')) add('err', 'The table name can’t contain . , ; : / \\ * | ? & % $ ! + = ( ) [ ] { } < > or quotes.');
  const existing = model.tables.find(t => lc(t.name) === lc(n.table));
  if (n.table && existing) {
    const isSelector = model.columns.some(c => lc(c.table) === lc(n.table) && lc(c.name) === lc(n.order));
    if (isSelector) add('warn', 'The model already has a switcher table named ' + qName(n.table) + '. Applying the script replaces it with this version.');
    else add('err', 'The model already has a table named ' + qName(n.table) + ', and applying the script would replace it, data and all. Choose another name.');
  }
  if (cfg.groupOn) {
    if (!n.group) add('err', 'Give the group column a name.');
    else if ([n.display, n.fields, n.order].some(x => lc(x) === lc(n.group))) add('err', 'The group column needs a name different from the table’s other columns.');
  }
  if (cfg.type === 'switch') {
    const mn = (cfg.measureName || '').trim();
    if (!mn) add('err', 'Give the measure a name.');
    else {
      const clash = model.measures.find(m => lc(m.name) === lc(mn));
      if (clash && lc(clash.table) !== lc(n.table)) add('err', 'A measure named ' + bracket(mn) + ' already exists in ' + qName(clash.table) + '. Measure names must be unique in the model.');
      else if (clash) add('warn', bracket(mn) + ' already exists in this table; applying replaces it.');
      if (model.columns.some(c => lc(c.name) === lc(mn) && lc(c.table) === lc(n.table))) add('err', 'The measure can’t have the same name as a column in its table.');
      if ([n.display, n.order, cfg.groupOn ? n.group : null].some(x => x && lc(x) === lc(mn))) add('err', 'The measure can’t have the same name as one of the table’s columns (' + [n.display, n.order].concat(cfg.groupOn ? [n.group] : []).map(bracket).join(', ') + ').');
    }
  }
  if (!items.length) add('err', 'Add at least one ' + (cfg.type === 'switch' ? 'measure' : 'measure or column') + ' in Step 3.');
  const missing = items.filter(i => !i.found);
  if (missing.length) add('err', 'Not in the model export: ' + missing.map(fpRef).join(', ') + '. Remove ' + (missing.length === 1 ? 'it' : 'them') + ' or paste a fresh export.');
  if (cfg.type === 'switch' && items.some(i => i.kind === 'column')) add('err', 'A SWITCH measure can only switch between measures. Remove the columns, or build a field parameter instead.');
  const seen = new Map(); items.forEach(i => { const k = lc(fpLabel(i)); seen.set(k, (seen.get(k) || 0) + 1); });
  const dups = [...seen].filter(([, c]) => c > 1).map(([k]) => k);
  if (dups.length) add(cfg.type === 'switch' ? 'err' : 'warn', 'These labels appear more than once: ' + dups.map(d => '“' + items.find(i => lc(fpLabel(i)) === d).label + '”').join(', ') + (cfg.type === 'switch' ? '. Each option needs its own label.' : '. The slicer will show them as separate items with the same text.'));
  const dupFields = new Set(); items.forEach((i, x) => { if (items.findIndex(j => j.kind === i.kind && lc(j.table) === lc(i.table) && lc(j.name) === lc(i.name)) !== x) dupFields.add(fpRef(i)); });
  if (dupFields.size) add('warn', 'Added more than once: ' + [...dupFields].join(', ') + '.');
  if (cfg.type === 'field' && items.some(i => i.kind === 'column') && items.some(i => i.kind === 'measure')) add('info', 'This parameter mixes columns and measures. That works, but a visual usually needs one of each kind in different wells, so most people keep them in separate parameters.');
  if (cfg.type === 'switch' && cfg.dynFormat && !items.some(i => i.format)) add('info', 'None of these measures has a format string in the export, so the measure keeps the default format.');
  return out;
}
function fpTmdl(model, cfg){
  const n = fpNames(cfg), items = fpItemsInModel(model, cfg);
  const T = TAB, L = ['createOrReplace', '', T + 'table ' + tmdlName(n.table), ''];
  const col = (name, props) => { L.push(T + T + 'column ' + tmdlName(name)); props.forEach(p => L.push(p === '' ? '' : T + T + T + p)); L.push(''); };
  const tuple = (it, i, parts) => '(' + parts.join(', ') + ')';
  if (cfg.type === 'switch') {
    const mn = (cfg.measureName || '').trim();
    const pick = 'SELECTEDVALUE ( ' + qName(n.table) + bracket(n.order) + (cfg.fallback === 'blank' ? '' : ', 0') + ' )';
    const E = T.repeat(4);
    L.push(T + T + 'measure ' + tmdlName(mn) + ' =');
    L.push(E + 'VAR _Choice = ' + pick, E + 'RETURN', E + '    SWITCH (', E + '        _Choice,');
    items.forEach((it, i) => L.push(E + '        ' + i + ', ' + fpMeasureRef(it) + ','));
    L.push(E + '        BLANK ()', E + '    )');
    const fmts = items.map((it, i) => [i, it.format]).filter(x => x[1]);
    if (cfg.dynFormat && fmts.length) {
      const F = T.repeat(5);
      L.push(T + T + T + 'formatStringDefinition =');
      L.push(F + 'SWITCH (', F + '    ' + pick + ',');
      fmts.forEach(([i, f]) => L.push(F + '    ' + i + ', ' + daxString(f) + ','));
      L.push(F + '    SELECTEDMEASUREFORMATSTRING ()', F + ')');
    }
    if ((cfg.folder || '').trim()) L.push(T + T + T + 'displayFolder: ' + tmdlValue(normFolder(cfg.folder)));
    L.push('');
    col(n.display, ['dataType: string', 'isDataTypeInferred', 'summarizeBy: none', 'sourceColumn: [Value1]', 'sortByColumn: ' + tmdlName(n.order)]);
    col(n.order, ['dataType: int64', 'isDataTypeInferred', 'isHidden', 'formatString: 0', 'summarizeBy: none', 'sourceColumn: [Value2]']);
    if (cfg.groupOn) col(n.group, ['dataType: string', 'isDataTypeInferred', 'summarizeBy: none', 'sourceColumn: [Value3]']);
  } else {
    col(n.display, ['dataType: string', 'isDataTypeInferred', 'summarizeBy: none', 'sourceColumn: [Value1]', 'sortByColumn: ' + tmdlName(n.order), '', 'relatedColumnDetails', T + 'groupByColumn: ' + tmdlName(n.fields)]);
    col(n.fields, ['dataType: string', 'isDataTypeInferred', 'isHidden', 'summarizeBy: none', 'sourceColumn: [Value2]', 'sortByColumn: ' + tmdlName(n.order), '', 'extendedProperty ParameterMetadata ='].concat(FP_META.map(x => T + T + x)));
    col(n.order, ['dataType: int64', 'isDataTypeInferred', 'isHidden', 'formatString: 0', 'summarizeBy: sum', 'sourceColumn: [Value3]']);
    if (cfg.groupOn) col(n.group, ['dataType: string', 'isDataTypeInferred', 'summarizeBy: none', 'sourceColumn: [Value4]']);
  }
  const S = T.repeat(5);
  L.push(T + T + 'partition ' + tmdlName(n.table) + ' = calculated', T + T + T + 'mode: import', T + T + T + 'source =', S + '{');
  items.forEach((it, i) => {
    const parts = cfg.type === 'switch' ? [daxString(fpLabel(it)), String(i)] : [daxString(fpLabel(it)), 'NAMEOF ( ' + fpRef(it) + ' )', String(i)];
    if (cfg.groupOn) parts.push(daxString((it.group || '').trim()));
    L.push(S + '    ' + tuple(it, i, parts) + (i < items.length - 1 ? ',' : ''));
  });
  L.push(S + '}');
  return L.join('\n') + '\n';
}
function fpTestQuery(model, cfg){
  const items = fpItemsInModel(model, cfg).filter(i => i.found);
  if (!items.length) return '';
  const I = '    ';
  if (cfg.type === 'switch') {
    return ['// Run in DAX query view before applying: one row per option with the value the measure will return.',
      '// An error names the measure that doesn’t exist.',
      'EVALUATE',
      'SELECTCOLUMNS (',
      I + '{'].concat(items.map((it, i) => I + I + '(' + daxString(fpLabel(it)) + ', ' + i + ')' + (i < items.length - 1 ? ',' : '')))
      .concat([I + '},', I + '"Option", [Value1],', I + '"Order", [Value2],', I + '"Value",', I + I + 'SWITCH (', I + I + I + '[Value2],'])
      .concat(items.map((it, i) => I + I + I + i + ', ' + fpMeasureRef(it) + ','))
      .concat([I + I + I + 'BLANK ()', I + I + ')', ')']).join('\n');
  }
  return ['// Run in DAX query view before applying. Each row should list the field’s full name;',
    '// an error means one of the names doesn’t exist in the model.',
    'EVALUATE',
    '{'].concat(items.map((it, i) => I + '(' + daxString(fpLabel(it)) + ', NAMEOF ( ' + fpRef(it) + ' ), ' + i + ')' + (i < items.length - 1 ? ',' : ''))).concat(['}']).join('\n');
}
/*FP-CORE-END*/
