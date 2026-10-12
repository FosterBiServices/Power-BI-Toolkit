// A date table built in DAX (CALENDAR, CALENDARAUTO, GENERATESERIES of dates) and not marked as a date table
// is found by every tool that looks for one.
const { chromium } = require('playwright');
const H = ['Kind', 'Table', 'Name', 'Type', 'Folder', 'Flags', 'Description', 'Expression', 'ToTable', 'ToColumn', 'Summarize', 'SortBy', 'Hierarchies', 'Storage', 'Source'];
const row = o => H.map(h => o[h] || '').join('\t');
const model = expr => [H.join('\t'),
  row({ Kind: 'Table', Table: 'Sales', Name: 'Sales', Storage: 'Import' }),
  row({ Kind: 'Table', Table: 'Calendar', Name: 'Calendar', Expression: expr, Storage: 'Import' }),
  row({ Kind: 'Table', Table: '_Measures', Name: '_Measures', Storage: 'Import' }),
  row({ Kind: 'Column', Table: 'Sales', Name: 'Order Date', Type: 'DateTime' }),
  row({ Kind: 'Column', Table: 'Sales', Name: 'Amount', Type: 'Decimal' }),
  row({ Kind: 'Column', Table: 'Calendar', Name: 'Date', Type: 'DateTime' }),
  row({ Kind: 'Column', Table: 'Calendar', Name: 'Year', Type: 'Int64' }),
  row({ Kind: 'Measure', Table: '_Measures', Name: 'Total Sales', Type: '#,0', Expression: 'SUM ( Sales[Amount] )' }),
  row({ Kind: 'Relationship', Table: 'Sales', Name: 'Order Date', Type: 'Many:One', Flags: 'OneDirection', ToTable: 'Calendar', ToColumn: 'Date' })].join('\n');
const EXPRS = {
  calendar: 'ADDCOLUMNS (↵    CALENDAR ( DATE ( 2020, 1, 1 ), DATE ( 2026, 12, 31 ) ),↵    "Year", YEAR ( [Date] )↵)',
  auto: 'CALENDARAUTO ()',
  series: 'GENERATESERIES (↵    DATE ( 2020, 1, 1 ),↵    DATE ( 2026, 12, 31 )↵)',
  notDate: 'DISTINCT ( Sales[Order Date] )'
};
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 950 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  const core = ['kpi-measure-builder', 'measure-describer', 'prep-for-ai-writer', 'dax-reviewer', 'about-this-report', 'kpi-visualizer', 'time-intelligence-builder'];
  for (const page of core) {
    await p.goto('http://localhost:8765/' + page + '.html');
    const r = await p.evaluate(E => Object.fromEntries(Object.entries(E).map(([k, x]) => [k, dateTablesOf(parseModel(x)).map(t => t.name).join(',') || '-'])), Object.fromEntries(Object.entries(EXPRS).map(([k, x]) => [k, model(x)])));
    console.log(page.padEnd(26), JSON.stringify(r), '(expect Calendar x3, notDate -)');
  }
  // the Copilot prompt names the calculated date table instead of "No table is marked"
  await p.goto('http://localhost:8765/kpi-measure-builder.html');
  const pr = await p.evaluate(t => buildPrompt(parseModel(t), 'Sales YTD'), model(EXPRS.calendar));
  console.log('prompt rule:', pr.split('\n').find(l => /date table/i.test(l) && /^- /.test(l)), '| tag:', pr.includes("'Calendar' (calculated date table)"));
  // KPI Measure Builder: the note under the model after pasting it
  await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(v => { const t = document.getElementById('modelInput'); t.value = v; t.dispatchEvent(new Event('input', { bubbles: true })); }, model(EXPRS.calendar));
  await p.waitForTimeout(300);
  console.log('kmb note:', (await p.locator('body').innerText()).split('\n').find(l => /^Date table:|No date table|marked as a date table/.test(l)), "(expect Date table: 'Calendar' (calculated, not marked...))");
  // About This Report: the calculated table is a date table, not a dimension
  await p.goto('http://localhost:8765/about-this-report.html');
  console.log('ab roles:', await p.evaluate(t => { const m = parseModel(t); m.tables.find(x => x.name === 'Calendar').name = 'Dim Day'; m.columns.filter(c => c.table === 'Calendar').forEach(c => c.table = 'Dim Day'); return m.tables.filter(isDateTable).map(x => x.name).join(','); }, model(EXPRS.calendar)), '(expect Dim Day)');
  // Time Intelligence Builder: GENERATESERIES table picked and named in the warning
  await p.goto('http://localhost:8765/time-intelligence-builder.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(v => { const t = document.getElementById('modelInput'); t.value = v; t.dispatchEvent(new Event('input', { bubbles: true })); }, model(EXPRS.series));
  console.log('ti:', await p.locator('#dTable').inputValue(), '|', await p.locator('#dTable option:checked').innerText(), '|', (await p.locator('#checks').innerText()).slice(0, 90), '(expect Calendar, calculated date table, GENERATESERIES)');
  // a PBIP folder: the calculated table's multi-line TMDL source is read and the table found
  const tmdl = ['table Calendar', '\tcolumn Date', '\t\tdataType: dateTime', '\t\tsourceColumn: [Date]', '',
    '\tpartition Calendar = calculated', '\t\tmode: import', '\t\tsource =', '\t\t\t\t', '\t\t\t\tVAR _start = DATE ( 2020, 1, 1 )', '\t\t\t\tRETURN',
    '\t\t\t\tADDCOLUMNS (', '\t\t\t\t    CALENDAR ( _start, TODAY () ),', '\t\t\t\t    "Year", YEAR ( [Date] )', '\t\t\t\t)', ''].join('\n');
  const sales = ['table Sales', '\tcolumn \'Order Date\'', '\t\tdataType: dateTime', '\tpartition Sales = m', '\t\tmode: import', '\t\tsource = Sql.Database("s", "d")', ''].join('\n');
  await p.goto('http://localhost:8765/kpi-measure-builder.html');
  console.log('pbip:', await p.evaluate(f => { const x = SF_SUITE.pbipExport(f); return x.error || dateTablesOf(parseModel(x.text)).map(t => t.name).join(','); },
    [{ path: 'R/M.SemanticModel/definition/tables/Calendar.tmdl', text: tmdl }, { path: 'R/M.SemanticModel/definition/tables/Sales.tmdl', text: sales }]), '(expect Calendar)');
  // Desktop leaves dataType out for calculated tables' columns: types come from the format string and annotations
  const noTypes = ['table Date', '\tdataCategory: Time', '', '\tcolumn Date', '\t\tisKey', '\t\tformatString: Short Date', '\t\tsummarizeBy: none', '\t\tsourceColumn: [Date]', '',
    '\t\tannotation UnderlyingDateTimeDataType = Date', '', '\tcolumn Year', '\t\tformatString: 0', '\t\tsummarizeBy: none', '\t\tsourceColumn: [Year]', '',
    '\tcolumn \'Month Name\'', '\t\tsummarizeBy: none', '\t\tsourceColumn: [Month Name]', '', '\tcolumn \'Is Weekend\'', '\t\tformatString: """TRUE"";""TRUE"";""FALSE"""', '\t\tsourceColumn: [Is Weekend]', '',
    '\tcolumn Price', '\t\tsummarizeBy: sum', '\t\tsourceColumn: [Price]', '', '\t\tannotation PBI_FormatHint = {"isGeneralNumber":true}', '',
    '\tcolumn \'Month Start\' = EOMONTH ( [Date], -1 ) + 1', '\t\tformatString: mmm yyyy', '',
    '\tpartition Date = calculated', '\t\tmode: import', '\t\tsource = CALENDARAUTO ()', ''].join('\n');
  console.log('pbip types:', await p.evaluate(f => { const x = SF_SUITE.pbipExport(f); return x.error || parseModel(x.text).columns.map(c => c.name + ' ' + c.dataType).join(', '); },
    [{ path: 'R/M.SemanticModel/definition/tables/Date.tmdl', text: noTypes }]), '(expect Date DateTime, Year Int64, Month Name String, Is Weekend Boolean, Price Double, Month Start DateTime)');
  await p.goto('http://localhost:8765/time-intelligence-builder.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(v => { const t = document.getElementById('modelInput'); t.value = v; t.dispatchEvent(new Event('input', { bubbles: true })); },
    await p.evaluate(f => SF_SUITE.pbipExport(f).text, [{ path: 'R/M.SemanticModel/definition/tables/Date.tmdl', text: noTypes }]));
  console.log('ti date column without dataType:', await p.locator('#dTable').inputValue(), await p.locator('#dCol').inputValue(), '(expect Date Date)');
  await p.evaluate(() => localStorage.clear());
  console.log('errors', errs); await b.close();
})();
