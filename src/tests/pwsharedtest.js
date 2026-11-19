// Power Query Writer and Power Query Explainer read Power Query code from the shared model export (Query rows):
// a model saved on the home page after a page chose No model is used (the newest connection wins); every table,
// hidden ones and queries that aren't loaded can be picked, labelled; picking one fills its query and columns; a new
// query from another query in the file picks it from a list; the model's parameters and functions reach the prompt;
// TMDL pasted into the model box is read (or added to the saved model); Power Query Explainer uses the same queries.
const { chromium } = require('playwright'); const fs = require('fs');
const NL = '\u21B5';
const base = fs.readFileSync(__dirname + '/ex_export.tsv', 'utf8').replace(/\s+$/, '');
const q = (table, name, type, code) => ['Query', table, name, type, '', '', '', code.split('\n').join(NL), '', ''].join('\t');
const EXPORT = [base,
  'Table\tStaging\tStaging\t\t\thidden\t\t\t\t', 'Column\tStaging\tOrder ID\tInt64\t\thidden\t\t\t\t', 'Column\tStaging\tAmount\tDouble\t\thidden\t\t\t\t',
  q('Sales', 'Sales', 'Table', 'let\n    Source = Sql.Database(ServerName, "SalesDW"),\n    Fact = Source{[Schema="dbo",Item="FactSales"]}[Data]\nin\n    Fact'),
  q('Staging', 'Staging', 'Table', 'let\n    Source = Csv.Document(File.Contents("C:\\data\\stage.csv"))\nin\n    Source'),
  q('', 'stgOrders', 'Table', 'let\n    Source = Excel.Workbook(File.Contents("C:\\data\\orders.xlsx"))\nin\n    Source'),
  q('', 'ServerName', 'Text', '"sql-prod" meta [IsParameterQuery=true, Type="Text", IsParameterQueryRequired=true]'),
  q('', 'fxCleanPhone', 'Function', '(InputTable as table, Columns as list) as table => InputTable')].join('\n');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  // Power Query Writer chose No model earlier; then a model is saved on the home page
  await p.goto('http://localhost:8765/power-query-writer.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  await p.click('.sc-choose [data-sc=none]'); await p.waitForTimeout(100);
  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => document.getElementById('connectBox').open = true);
  await p.fill('#exportInput', EXPORT); await p.waitForTimeout(300);
  console.log('home saved:', (await p.locator('#saved').innerText()).replace(/\s+/g, ' ').slice(0, 140));
  await p.goto('http://localhost:8765/power-query-writer.html'); await p.waitForTimeout(400);
  console.log('used after No model:', await p.evaluate(() => localStorage.getItem('kpw.connect')), '| model', await p.evaluate(() => !!state.model && state.model.queries.length), '(expect export, 5)');
  console.log('start:', await p.evaluate(() => state.v.start), '(expect existing)');
  const opts = await p.locator('#pickTable option').allInnerTexts();
  console.log('pick list:', opts.join(' | '), '(expect Staging (hidden), stgOrders (query, not loaded); no ServerName, fxCleanPhone, _Measures)');
  await p.selectOption('#pickTable', 'Sales'); await p.waitForTimeout(200);
  console.log('Sales: query', /FactSales/.test(await p.inputValue('#existing')), '| columns', (await p.inputValue('#columns')).split('\n').length, '| msg', (await p.locator('#pickMsg').innerText()).trim().slice(0, 60));
  await p.selectOption('#pickTable', 'stgOrders'); await p.waitForTimeout(200);
  console.log('stgOrders: query', /orders\.xlsx/.test(await p.inputValue('#existing')), '| msg', (await p.locator('#pickMsg').innerText()).trim().slice(0, 90));
  await p.selectOption('#pickTable', 'Staging'); await p.waitForTimeout(200);
  console.log('Staging (hidden): query', /stage\.csv/.test(await p.inputValue('#existing')), '| columns', await p.inputValue('#columns'));
  await p.fill('#goal', 'Orders over 100.'); await p.waitForTimeout(100);
  const pr = await p.locator('#pwPromptView').textContent();
  console.log('prompt: parameter', /- ServerName = "sql-prod"/.test(pr), '| function', /fxCleanPhone\(InputTable, Columns\)/.test(pr));
  // a new query whose source is another query in the file
  await p.click('label:has(input[name=start][value=new])'); await p.selectOption('#source', 'query'); await p.waitForTimeout(100);
  console.log('source list shown', await p.locator('#srcQueryBox').isVisible(), '| options', (await p.locator('#srcQuery option').allInnerTexts()).length);
  await p.selectOption('#srcQuery', 'Customer'); await p.waitForTimeout(100);
  console.log('source detail', await p.inputValue('#sourceDetail'), '| columns', (await p.inputValue('#columns')).split('\n').slice(0, 2).join(' ; '));
  await p.selectOption('#source', 'sql'); await p.waitForTimeout(100);
  console.log('list hidden for SQL', await p.locator('#srcQueryBox').isHidden());
  // TMDL pasted into the model box: added to the saved model
  await p.click('.sc-choose [data-sc=export]'); await p.evaluate(() => document.getElementById('modelBox').open = true);
  const TMDL = 'expression stgReturns =\n\t\tlet\n\t\t    Source = Csv.Document(File.Contents("C:\\\\data\\\\returns.csv"))\n\t\tin\n\t\t    Source\n\tlineageTag: x1\n\n\tannotation PBI_ResultType = Table\n';
  await p.locator('#modelInput').fill(TMDL); await p.waitForTimeout(300);
  console.log('tmdl bar:', (await p.locator('.suite-bar').innerText()).trim().slice(0, 140));
  console.log('after tmdl: tables kept', await p.evaluate(() => state.model.tables.length), '| queries', await p.evaluate(() => state.model.queries.map(q => q.name).join(',')));
  console.log('saved has it', await p.evaluate(() => /stgReturns/.test(SF_SUITE.get().text)));
  // Power Query Explainer: the same queries, without its own export
  await p.goto('http://localhost:8765/power-query-explainer.html'); await p.waitForTimeout(300);
  await p.click('#modeModelBtn'); await p.waitForTimeout(100);
  console.log('pqe saved box', await p.locator('#savedQBox').isVisible(), '|', (await p.locator('#savedQNote').innerText()).trim());
  await p.click('#useSavedQ'); await p.waitForTimeout(300);
  console.log('pqe queries:', await p.locator('#mBody tr').count(), '| msg', (await p.locator('#pbipMsg').innerText()).trim());
  await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(200);
  console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > 390));
  await p.goto('http://localhost:8765/power-query-writer.html'); await p.waitForTimeout(300);
  console.log('pw mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > 390));
  console.log('errors', errs); await b.close();
})();
