/* ---------- Power Query Writer: reusable fx functions and cleaning recipes ----------
   The functions live in src/fx/*.pq (tested in Power BI Desktop with src/fx/fxTests.pq); build_pw.py puts their code in
   PWF_CODE. A recipe is a cleaning step that calls one of them. recipeSteps() turns the ticked recipes (and the type map,
   as a call to fxApplyTypes) into the steps Copilot is told to use as they are. */
const PWF = (() => {
  // name, arguments [required, total], the signature shown to Copilot, and what it does (one line)
  const LIB = [
    ['fxApplyTypes', 2, 3, 'fxApplyTypes(InputTable as table, TypePairs as list, optional Options as record) as table', 'Sets column types from {column, type} pairs in one step; pairs for missing columns are skipped; every other column is text (Options: DefaultType, null leaves them as they are; Culture).'],
    ['fxRemoveBlankRows', 1, 1, 'fxRemoveBlankRows(InputTable as table) as table', 'Removes rows where every value is null, empty or only spaces.'],
    ['fxTrimText', 1, 3, 'fxTrimText(InputTable as table, optional Columns as list, optional Options as record) as table', 'Trims text (every column when Columns is null), removes non-breaking spaces and control characters, empty text becomes null (Options: Clean, BlankToNull, CollapseSpaces).'],
    ['fxSetCase', 3, 3, 'fxSetCase(InputTable as table, Columns as list, Case as text) as table', 'Upper, lower or proper case for text in the columns named; Case is "Upper", "Lower" or "Proper".'],
    ['fxToDate', 2, 3, 'fxToDate(InputTable as table, Columns as list, optional Options as record) as table', 'Turns the columns into dates from dates, date-times, Excel serial numbers or text; unreadable values become null (Options: Culture, Format).'],
    ['fxTextToNumber', 2, 3, 'fxTextToNumber(InputTable as table, Columns as list, optional Options as record) as table', 'Turns text such as "$1,234.50", "(45)" or "12%" into numbers; unreadable values become null (Options: Culture, WholeNumber).'],
    ['fxAddDateTimeFromPairs', 2, 3, 'fxAddDateTimeFromPairs(InputTable as table, Pairs as list, optional Options as record) as table', 'For each {source column, name} pair adds "<name> date" and "<name> time" columns from a date-time (Options: KeepOriginalColumns, Overwrite, Culture).'],
    ['fxReplaceNulls', 3, 3, 'fxReplaceNulls(InputTable as table, Columns as list, Value as any) as table', 'Replaces null with Value in the columns named.'],
    ['fxDedupe', 2, 3, 'fxDedupe(InputTable as table, KeyColumns as list, optional Options as record) as table', 'Keeps one row per key: the first, or the last with KeepLast = true (Options: KeepLast, IgnoreCase).']
  ].map(([name, min, max, sig, does]) => ({ name, min, max, sig, does, code: (typeof PWF_CODE !== 'undefined' && PWF_CODE[name]) || '' }));
  const BY = new Map(LIB.map(f => [f.name, f]));

  /* The recipes, in the order their steps run: tidy the text, convert it, then fill gaps; types after that and duplicates last
     (keys compare once they're typed). cols: does it take columns; all: no columns means every column. */
  const RECIPES = [
    { id: 'blank', fx: 'fxRemoveBlankRows', step: 'NoBlankRows', label: 'Remove blank rows', hint: 'Rows where every value is empty.' },
    { id: 'trim', fx: 'fxTrimText', step: 'Trimmed', label: 'Trim text', hint: 'Spaces at either end, non-breaking spaces and line breaks; empty text becomes null. Pick columns, or none for every column.', cols: true, all: true },
    { id: 'case', fx: 'fxSetCase', step: 'Cased', label: 'Upper, lower or proper case', cols: true },
    { id: 'date', fx: 'fxToDate', step: 'Dates', label: 'Convert to dates', hint: 'Text, date-times and Excel serial numbers. Values that can’t be read become empty instead of errors. Uses the culture under Other queries, parameters and culture.', cols: true },
    { id: 'num', fx: 'fxTextToNumber', step: 'Numbers', label: 'Convert text to numbers', hint: 'Ignores currency signs, spaces and %, and reads (45) as -45.', cols: true },
    { id: 'split', fx: 'fxAddDateTimeFromPairs', step: 'DateTimes', label: 'Split date-times into date and time columns', hint: 'Adds “Column date” and “Column time” for each column picked. Values that can’t be read become empty. A kept original column stays text.', cols: true },
    { id: 'nulls', fx: 'fxReplaceNulls', step: 'NullsReplaced', label: 'Replace empty values', cols: true },
    { id: 'dedupe', fx: 'fxDedupe', step: 'Deduped', label: 'Remove duplicate rows', hint: 'Pick the columns that make a row unique.', cols: true }
  ];
  const blankOpts = () => ({ blank: { on: false }, trim: { on: false, cols: [], collapse: false }, case: { on: false, cols: [], how: 'Proper' },
    date: { on: false, cols: [], format: '' }, num: { on: false, cols: [], whole: false }, split: { on: false, cols: [], keep: true },
    nulls: { on: false, cols: [], value: '' }, dedupe: { on: false, cols: [], last: false, nocase: false } });

  const q = n => '"' + String(n).replace(/"/g, '""') + '"';
  const list = cs => '{' + cs.map(q).join(', ') + '}';
  const rec = o => { const k = Object.keys(o).filter(x => o[x] != null); return k.length ? '[' + k.map(x => x + ' = ' + o[x]).join(', ') + ']' : ''; };
  // a value typed in the page: a number stays a number, true/false a logical, anything else text
  const lit = v => { const t = String(v == null ? '' : v).trim(); return /^-?\d+(\.\d+)?$/.test(t) ? t : /^(true|false)$/i.test(t) ? t.toLowerCase() : q(t); };
  const M_TYPE = { 'whole number': 'Int64.Type', number: 'type number', date: 'type date', datetime: 'type datetime', time: 'type time', logical: 'type logical', text: 'type text' };

  // the ticked recipes that can run (a recipe that needs columns needs at least one picked, except Trim text)
  function active(fx, cols){
    const have = new Set((cols || []).map(c => c.name));
    return RECIPES.map(r => ({ r, o: Object.assign({}, blankOpts()[r.id], (fx || {})[r.id] || {}) }))
      .map(x => Object.assign(x, { cs: (x.o.cols || []).filter(c => have.has(c)) }))
      .filter(x => x.o.on && (!x.r.cols || x.r.all || x.cs.length));
  }
  // the column types after the recipes: the pasted types, with the converted columns and the new date and time columns
  function finalTypes(cols, acts){
    const out = cols.map(c => ({ name: c.name, type: c.type }));
    const set = (n, t) => { const c = out.find(x => x.name === n); if (c) c.type = t; else out.push({ name: n, type: t }); };
    acts.forEach(({ r, o, cs }) => {
      if (r.id === 'date') cs.forEach(c => set(c, 'date'));
      if (r.id === 'num') cs.forEach(c => set(c, o.whole ? 'whole number' : 'number'));
      // a kept original stays text: the date and time columns are the typed copies, and typing it again would turn
      // values that can't be read into errors
      if (r.id === 'split') { cs.forEach(c => { set(c + ' date', 'date'); set(c + ' time', 'time'); }); cs.forEach(c => { const i = out.findIndex(x => x.name === c); if (i >= 0) { if (o.keep === false) out.splice(i, 1); else out[i].type = 'text'; } }); }
    });
    return out;
  }
  const typePairs = cols => cols.map(c => ({ name: c.name, m: M_TYPE[c.type] || 'type text' }));

  /* The steps to paste after the step where the column names are final (prev). inp: { fx, columns (parsed), typeMap,
     typeHow ('fx' or 'steps'), culture }. Returns { code, last, fns: names of the library functions used, pairs } or null. */
  function recipeSteps(inp, prev){
    const cols = inp.cols || [], acts = active(inp.fx, cols), P = prev || 'PromotedHeaders', I = '    ', I2 = I + I;
    const culture = (inp.culture || '').trim(), useTypes = !!inp.typeMap && cols.length > 0;
    if (!acts.length && !(useTypes && inp.typeHow !== 'steps')) return null;
    const lines = [], fns = [];
    let cur = P;
    const step = (name, expr, fn) => { lines.push(I + name + ' = ' + expr); cur = name; if (fn && !fns.includes(fn)) fns.push(fn); };
    const before = acts.filter(x => x.r.id !== 'dedupe'), dd = acts.find(x => x.r.id === 'dedupe');
    before.forEach(({ r, o, cs }) => {
      const C = culture ? q(culture) : null;
      if (r.id === 'blank') step(r.step, r.fx + '(' + cur + ')', r.fx);
      if (r.id === 'trim') { const opt = rec({ CollapseSpaces: o.collapse ? 'true' : null }); step(r.step, r.fx + '(' + cur + (cs.length || opt ? ', ' + (cs.length ? list(cs) : 'null') : '') + (opt ? ', ' + opt : '') + ')', r.fx); }
      if (r.id === 'case') step(r.step, r.fx + '(' + cur + ', ' + list(cs) + ', ' + q(['Upper', 'Lower', 'Proper'].includes(o.how) ? o.how : 'Proper') + ')', r.fx);
      if (r.id === 'date') { const opt = rec({ Culture: C, Format: (o.format || '').trim() ? q(o.format.trim()) : null }); step(r.step, r.fx + '(' + cur + ', ' + list(cs) + (opt ? ', ' + opt : '') + ')', r.fx); }
      if (r.id === 'num') { const opt = rec({ Culture: C, WholeNumber: o.whole ? 'true' : null }); step(r.step, r.fx + '(' + cur + ', ' + list(cs) + (opt ? ', ' + opt : '') + ')', r.fx); }
      if (r.id === 'split') { const opt = rec({ KeepOriginalColumns: o.keep === false ? 'false' : null, Culture: C }); step(r.step, r.fx + '(' + cur + ', {' + cs.map(c => '{' + q(c) + ', ' + q(c) + '}').join(', ') + '}' + (opt ? ', ' + opt : '') + ')', r.fx); }
      if (r.id === 'nulls') step(r.step, r.fx + '(' + cur + ', ' + list(cs) + ', ' + ((o.value || '').trim() ? lit(o.value) : '""') + ')', r.fx);
    });
    const types = finalTypes(cols, acts), pairs = typePairs(types);
    let typeCode = '';
    if (useTypes && inp.typeHow !== 'steps') {
      // one pair per line; Copilot is told to keep them
      const body = pairs.map(p => I2 + '{' + q(p.name) + ', ' + p.m + '}').join(',\n');
      step('ChangeTypes', 'fxApplyTypes(\n' + I2 + cur + ',\n' + I2 + '{\n' + body.replace(/^/gm, I) + '\n' + I2 + '}' + (culture ? ',\n' + I2 + '[Culture = ' + q(culture) + ']' : '') + '\n' + I + ')', 'fxApplyTypes');
    } else if (useTypes) {
      // the type map as steps (PW.typeMap), after the cleaning steps
      typeCode = 'steps'; lines.push('@@TYPEMAP@@'); cur = 'ChangeTypes';
    }
    if (dd) { const opt = rec({ KeepLast: dd.o.last ? 'true' : null, IgnoreCase: dd.o.nocase ? 'true' : null }); step(dd.r.step, dd.r.fx + '(' + cur + ', ' + list(dd.cs) + (opt ? ', ' + opt : '') + ')', dd.r.fx); }
    const prevOfTypes = (() => { const i = lines.indexOf('@@TYPEMAP@@'); return i > 0 ? lines[i - 1].trim().split(' ')[0] : P; })();
    return { lines, last: cur, fns, pairs, types, typeCode, prevOfTypes };
  }
  // the code itself, with the type map steps filled in by PW.typeMap when they are steps
  function render(rs, typeMapFn){
    return rs.lines.map(l => l === '@@TYPEMAP@@' ? typeMapFn(rs.types, rs.prevOfTypes) : l).join(',\n');
  }

  /* Functions the person already has in the file, one per line: "fxName(Arg1, optional Arg2): what it does" (the part after
     the name is optional). Returns [{ name, min, max, sig, does }]. */
  function parseMine(text){
    return (text || '').replace(/\r/g, '').split('\n').map(l => l.trim().replace(/^[-*•]\s*/, '')).filter(Boolean).map(l => {
      const m = l.match(/^#?"?([A-Za-z_][A-Za-z0-9_.]*)"?\s*(?:\(([^)]*)\))?\s*(?:[:=\-–—]\s*(.*))?$/);
      if (!m) return null;
      const args = m[2] == null ? null : m[2].split(',').map(s => s.trim()).filter(Boolean);
      const opt = args ? args.filter(a => /^optional\b/i.test(a)).length : 0;
      return { name: m[1], min: args ? args.length - opt : null, max: args ? args.length : null, sig: m[1] + (m[2] != null ? '(' + m[2].trim() + ')' : ''), does: (m[3] || '').trim(), mine: true };
    }).filter(Boolean);
  }
  // every function the query may call by name: the library functions the recipes use (or all of them when the person
  // has them), and their own
  function known(inp){
    const rs = inp.recipes, names = new Set(inp.haveFx ? LIB.map(f => f.name) : (rs ? rs.fns : []));
    const out = LIB.filter(f => names.has(f.name));
    parseMine(inp.myFns).forEach(f => { if (!out.some(x => x.name === f.name)) out.push(f); });
    return out;
  }
  return { LIB, BY, RECIPES, blankOpts, active, recipeSteps, render, parseMine, known, M_TYPE };
})();
