// Power Query Writer's Columns box: tab-separated (Copy Entire Table), comma or semicolon (CSV, Copy preview data) with
// quoted cells, a leading row-number column left out, and "Name: type" lines from the names-and-types step.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/power-query-writer.html'); await p.waitForTimeout(300);
  const t = s => p.evaluate(x => PW.parseColumns(x).map(c => c.name + ':' + c.type).join(' | '), s);
  console.log('csv:', await t('Order ID,Customer Name,Amount,Order Date\n1,"Smith, Jo",12.5,2024-01-02\n2,Lee,7,2024-01-03'), '(expect 4 columns, Customer Name text)');
  console.log('row numbers:', await t('\tOrder ID\tAmount\n1\tA1\t3\n2\tA2\t4'), '(expect Order ID:text | Amount:whole number)');
  console.log('semicolons:', await t('Order ID;Amount\nA1;3\nA2;4'), '(expect Order ID:text | Amount:whole number)');
  console.log('step lines:', await t('Order ID: number\nCustomer: text\nNotes: any\nWhen: datetime'), '(expect Notes with no type)');
  console.log('tabs:', await t('Order ID\tAmount\n1\t2'));
  console.log('step shown', /Table\.Schema\(PreviousStep\)/.test(await p.locator('#colStepView').textContent()));
  console.log('errors', errs); await b.close(); })();
