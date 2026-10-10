const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 950 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/time-intelligence-builder.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  console.log('banner', await p.locator('#exampleBanner').isVisible(), '| date', await p.locator('#dTable').inputValue(), await p.locator('#dCol').inputValue(), '| checks:', await p.locator('#checks').innerText());
  console.log('plan:', await p.locator('#planInfo').innerText(), '| count', await p.locator('#tmdlCount').innerText(), '| testBy', await p.locator('#testBy').inputValue());
  await p.screenshot({ path: 'ti_1.png', fullPage: true });
  const tm = await p.locator('#tmdlView').innerText();
  console.log('latest by default:', await p.locator('#basis').inputValue(), '| data date:', await p.locator('#dataDate').inputValue(), '| anchor:', tm.includes("VAR LastVisibleDate = MIN ( MAX ( 'Date'[Date] ), LastDateWithData )"), '| PYTD (SQLBI):', tm.includes("DATEADD ( 'Date'[Date], -1, YEAR ),\n") && tm.includes("'Date'[DateWithSales] = TRUE"), '| PMC:', tm.includes("PARALLELPERIOD ( 'Date'[Date], -1, MONTH )"), '(expect latest Sales|Order Date true true true)');
  console.log('helpers:', tm.includes("column DateWithSales = 'Date'[Date] <= MAX ( 'Sales'[Order Date] )"), tm.includes('measure ShowValueForDates ='), '| test query defines them:', (await p.locator('#testView').innerText()).includes("COLUMN 'Date'[DateWithSales] ="), '(expect true true true)');
  await p.selectOption('#fyEnd', '6'); console.log('fy latest:', (await p.locator('#tmdlView').innerText()).includes('DATESYTD ( \'Date\'[Date], "06-30" )'), '(expect true)');
  await p.selectOption('#basis', 'context'); const tc = await p.locator('#tmdlView').innerText();
  console.log('every date:', tc.includes('"06-30"'), tc.includes('LastVisibleDate'), tc.includes("IF (\n\t\t\t\t\t[ShowValueForDates],"), '| calcs kept:', await p.locator('[data-calc]:checked').count(), '(expect true false true 4)');
  await p.selectOption('#basis', 'latest');
  await p.locator('[data-calc=qtd]').check(); console.log('qtd warn:', (await p.locator('#checks').innerText()).slice(0, 80));
  await p.locator('[data-name=ytd]').fill('Sales YTD'); console.log('renamed:', (await p.locator('#tmdlView').innerText()).includes("'Total Sales Sales YTD'"));
  await p.locator('[data-name=ytd]').fill('');
  await p.click('#outGroup'); const tg = await p.locator('#tmdlView').innerText(); console.log('group inlines ShowValueForDates:', !tg.includes('[ShowValueForDates]'), !tg.includes('measure ShowValueForDates'), tg.includes('column DateWithSales'), '(expect true true true)');
  console.log('group checks:', await p.locator('#checks').innerText(), '| first part:', await p.locator('#outBox .part').first().getAttribute('id'), '| count', await p.locator('#tmdlCount').innerText());
  await p.fill('#gTable', 'Sales'); console.log('group clash:', (await p.locator('#checks').innerText()).slice(0, 70)); await p.fill('#gTable', 'Time Intelligence');
  await p.click('#outMeasures'); await p.selectOption('#namePattern', 'prefix'); await p.fill('#target', 'Sales');
  console.log('prefix names:', (await p.locator('#tmdlView').innerText()).split('\n').filter(l => /measure /.test(l)).slice(0, 3).join(' | '));
  // non-date table: pick a date table not marked
  await p.selectOption('#dTable', 'Sales'); console.log('sales date table:', await p.locator('#dCol').inputValue(), '|', (await p.locator('#checks').innerText()).slice(0, 110));
  // a calculated date table (CALENDARAUTO), not marked: picked over Sales, with its own warning
  const H = ['Kind', 'Table', 'Name', 'Type', 'Folder', 'Flags', 'Description', 'Expression', 'ToTable', 'ToColumn', 'Storage', 'Source'];
  const row = o => H.map(h => o[h] || '').join('\t');
  await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.evaluate(v => { const t = document.getElementById('modelInput'); t.value = v; t.dispatchEvent(new Event('input', { bubbles: true })); }, [H.join('\t'),
    row({ Kind: 'Table', Table: 'Sales', Name: 'Sales', Storage: 'Import' }),
    row({ Kind: 'Table', Table: 'Calendar', Name: 'Calendar', Expression: 'CALENDARAUTO ()', Storage: 'Import' }),
    row({ Kind: 'Column', Table: 'Sales', Name: 'Order Date', Type: 'DateTime' }),
    row({ Kind: 'Column', Table: 'Calendar', Name: 'Date', Type: 'DateTime' }),
    row({ Kind: 'Measure', Table: 'Sales', Name: 'Total Sales', Type: '#,0', Expression: 'SUM ( Sales[Amount] )' }),
    row({ Kind: 'Relationship', Table: 'Sales', Name: 'Order Date', Type: 'Many:One', Flags: 'OneDirection', ToTable: 'Calendar', ToColumn: 'Date' })].join('\n'));
  console.log('calc date table:', await p.locator('#dTable').inputValue(), '|', await p.locator('#dTable option:checked').innerText(), '|', (await p.locator('#checks').innerText()).slice(0, 80), '| data date', await p.locator('#dataDate').inputValue(), '(expect Calendar, calculated date table, CALENDARAUTO warning, Sales|Order Date)');
  await p.evaluate(() => localStorage.clear()); await p.setViewportSize({ width: 375, height: 800 }); await p.reload();
  console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  console.log('errors', errs); await b.close();
})();
