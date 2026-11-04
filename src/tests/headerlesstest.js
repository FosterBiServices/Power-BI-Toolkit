// The model export pasted without its header row (cells copied from the grid without the column names):
// the home page reads it in the export query's column order and saves it with the header put back.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  const row = a => a.concat(Array(15 - a.length).fill('')).join('\t');
  const rows = [
    row(['Column', 'Sales', 'Amount', 'Decimal', '', '', '', '', '', '', 'Sum']),
    row(['Column', 'Sales', 'Order Date', 'DateTime']),
    row(['Column', 'Customer', 'Customer Key', 'Int64']),
    row(['Measure', 'Sales', 'Total Sales', '\\$#,0', '', '', '', 'SUM ( Sales[Amount] )']),
    row(['Relationship', 'Sales', 'Customer Key', 'Many:One', '', 'OneDirection', '', '', 'Customer', 'Customer Key']),
    row(['Table', 'Customer', 'Customer', 'Regular', '', '', '', '', '', '', '', '', '', 'Import']),
    row(['Table', 'Sales', 'Sales', 'Regular', '', '', '', '', '', '', '', '', '', 'Import'])
  ].join('\n');
  await p.evaluate(() => { document.getElementById('connectBox').open = true; });
  await p.fill('#exportInput', rows);
  console.log('message:', (await p.locator('#saveMsg').innerText()).trim(), '(expect Saved)');
  console.log('stats:', (await p.locator('#savedStats').innerText()).replace(/\s+/g, ' '), '(expect 2 tables, 3 columns, 1 measures, 1 relationships)');
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('sfpbi.shared.model')).text.split('\n')[0]);
  console.log('saved header:', saved.startsWith('Kind\tTable\tName'), '(expect true)');
  // a tool opens on it
  await p.goto('http://localhost:8765/measure-describer.html');
  const t = await p.evaluate(() => document.body.innerText);
  console.log('tool sees Total Sales:', t.includes('Total Sales'), '(expect true)');
  // junk without a header still says so
  await p.goto('http://localhost:8765/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(() => { document.getElementById('connectBox').open = true; });
  await p.fill('#exportInput', 'Sales\t100\nCustomers\t20');
  console.log('junk:', (await p.locator('#saveMsg').innerText()).includes('header row'), '(expect true)');
  console.log('errors', errs); await b.close();
})();
