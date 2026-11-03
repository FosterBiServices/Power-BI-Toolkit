// The shared model reader in builder_core: readModel keeps every export column and flag, parseModel is the view
// most tools use (private tables left out), and daxRefs finds column and measure references. Model Linter reads
// the model through them, so its parse is checked here too.
const { chromium } = require('playwright');
const H = ['Kind', 'Table', 'Name', 'Type', 'Folder', 'Flags', 'Description', 'Expression', 'ToTable', 'ToColumn', 'Summarize', 'SortBy', 'Hierarchies', 'Storage', 'Source'];
const row = o => H.map(h => o[h] || '').join('\t');
const EXPORT = [H.join('\t'),
  row({ Kind: 'Model', Table: '', Name: 'Sales Model', Flags: 'discourage-implicit' }),
  row({ Kind: 'Table', Table: 'Sales', Name: 'Sales', Storage: 'Import' }),
  row({ Kind: 'Table', Table: 'Customer', Name: 'Customer', Flags: 'hidden', Storage: 'Import' }),
  row({ Kind: 'Table', Table: 'Helper', Name: 'Helper', Flags: 'private' }),
  row({ Kind: 'Table', Table: 'LocalDateTable_1', Name: 'LocalDateTable_1', Flags: 'private' }),
  row({ Kind: 'Column', Table: 'Sales', Name: 'Amount', Type: 'Double', Summarize: 'Sum' }),
  row({ Kind: 'Column', Table: 'Sales', Name: 'Order Date', Type: 'DateTime' }),
  row({ Kind: 'Column', Table: 'Sales', Name: 'RowNumber-2662979B', Type: 'Int64', Flags: 'hidden' }),
  row({ Kind: 'Column', Table: 'Customer', Name: 'Region', Type: 'String', SortBy: 'Region Order', Flags: 'hidden key' }),
  row({ Kind: 'Measure', Table: 'Sales', Name: 'Total Sales', Type: '#,0', Folder: 'Sales', Expression: 'SUM ( Sales[Amount] ) // not [Ignored]' }),
  row({ Kind: 'Measure', Table: 'Sales', Name: 'Label', Flags: 'text dynamic-format', Expression: '"[x]" & [Total Sales] & \'Customer\'[Region]' }),
  row({ Kind: 'Relationship', Table: 'Sales', Name: 'Customer Key', Type: 'Many:One', Flags: 'both inactive', ToTable: 'Customer', ToColumn: 'Customer Key' }),
  row({ Kind: 'Relationship', Table: 'Sales', Name: 'Order Date', Type: 'Many:One', ToTable: 'LocalDateTable_1', ToColumn: 'Date' })].join('\n');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/model-linter.html');
  const r = await p.evaluate(text => {
    const m = readModel(text), v = parseModel(text), l = ML.parse(text);
    const lab = m.measures.find(x => x.name === 'Label');
    return {
      readTables: m.tables.map(t => t.name + (t.private ? '(private)' : '')).join(', '),
      viewTables: v.tables.map(t => t.name).join(', '),
      columns: m.columns.map(c => c.name).join(', '),
      region: JSON.stringify((({ hidden, key, sortBy }) => ({ hidden, key, sortBy }))(m.columns.find(c => c.name === 'Region'))),
      label: [lab.text, lab.dynamicFormat].join(' '),
      rels: m.rels.map(x => x.fromTable + '>' + x.toTable + ' ' + x.card + (x.both ? ' both' : '') + (x.inactive ? ' inactive' : '')).join('; '),
      model: JSON.stringify(m.model), has: JSON.stringify(m.has),
      refs: daxRefs(lab.expression).map(x => (x.table ? x.table : '') + '[' + x.col + ']').join(' '),
      refsComment: daxRefs(m.measures[0].expression).map(x => x.table + '[' + x.col + ']').join(' '),
      linterSame: l.tables.length === m.tables.length && l.measures.length === m.measures.length && !!l.model && l.has.upgraded,
      noHeader: parseModel('hello').error ? 'error' : 'none', linterNoHeader: /header row/.test(ML.parse('').error || '')
    };
  }, EXPORT);
  console.log('readModel tables:', r.readTables, '(expect Sales, Customer, Helper(private); no LocalDateTable)');
  console.log('parseModel tables:', r.viewTables, '(expect Customer, Sales)');
  console.log('columns:', r.columns, '(expect Amount, Order Date, Region; no RowNumber)');
  console.log('Region:', r.region, '(expect hidden, key, sortBy Region Order)');
  console.log('Label text, dynamic format:', r.label, '(expect true true)');
  console.log('rels:', r.rels, '(expect only Sales>Customer Many:One both inactive)');
  console.log('model:', r.model, r.has, '(expect discourage true, upgraded true)');
  console.log('daxRefs:', r.refs, '(expect [Total Sales] Customer[Region]; nothing from the string)');
  console.log('daxRefs past a comment:', r.refsComment, '(expect Sales[Amount] only)');
  console.log('Model Linter reads the same model:', r.linterSame, '(expect true)');
  console.log('no header:', r.noHeader, r.linterNoHeader, '(expect error true)');
  await b.close();
  console.log('errors', errs);
})();
