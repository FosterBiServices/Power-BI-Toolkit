const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 950 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/time-intelligence-builder.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  console.log('banner', await p.locator('#exampleBanner').isVisible(), '| date', await p.locator('#dTable').inputValue(), await p.locator('#dCol').inputValue(), '| checks:', await p.locator('#checks').innerText());
  console.log('plan:', await p.locator('#planInfo').innerText(), '| count', await p.locator('#tmdlCount').innerText(), '| testBy', await p.locator('#testBy').inputValue());
  await p.screenshot({ path: 'ti_1.png', fullPage: true });
  const tm = await p.locator('#tmdlView').innerText();
  console.log('latest by default:', await p.locator('#basis').inputValue(), '| anchor:', tm.includes("VAR _Anchor = MAX ( 'Date'[Date] )"), '| PY YTD to same day:', tm.includes('EDATE ( _YearStart, -12 ), _LastYear'), '| PM whole month:', tm.includes('EOMONTH ( _Anchor, -2 ) + 1, EOMONTH ( _Anchor, -1 )'), '(expect latest true true true)');
  await p.selectOption('#fyEnd', '6'); console.log('fy latest:', (await p.locator('#tmdlView').innerText()).includes('MONTH ( _Anchor ) < 7, 1, 0 ), 7, 1 )'), '(expect true)');
  await p.check('#hideFuture'); console.log('anchor capped at today:', (await p.locator('#tmdlView').innerText()).includes('MIN ( MAX ( \'Date\'[Date] ), TODAY () )'), '(expect true)'); await p.uncheck('#hideFuture');
  await p.selectOption('#basis', 'context'); const tc = await p.locator('#tmdlView').innerText();
  console.log('every date:', tc.includes('"06-30"'), tc.includes('_Anchor'), '| calcs kept:', await p.locator('[data-calc]:checked').count(), '(expect true false 4)');
  await p.selectOption('#basis', 'latest');
  await p.locator('[data-calc=qtd]').check(); console.log('qtd warn:', (await p.locator('#checks').innerText()).slice(0, 80));
  await p.locator('[data-name=ytd]').fill('Sales YTD'); console.log('renamed:', (await p.locator('#tmdlView').innerText()).includes("'Total Sales Sales YTD'"));
  await p.locator('[data-name=ytd]').fill('');
  await p.click('#outGroup'); console.log('group checks:', await p.locator('#checks').innerText(), '| first part:', await p.locator('#outBox .part').first().getAttribute('id'), '| count', await p.locator('#tmdlCount').innerText());
  await p.fill('#gTable', 'Sales'); console.log('group clash:', (await p.locator('#checks').innerText()).slice(0, 70)); await p.fill('#gTable', 'Time Intelligence');
  await p.click('#outMeasures'); await p.selectOption('#namePattern', 'prefix'); await p.fill('#target', 'Sales');
  console.log('prefix names:', (await p.locator('#tmdlView').innerText()).split('\n').filter(l => /measure /.test(l)).slice(0, 3).join(' | '));
  // non-date table: pick a date table not marked
  await p.selectOption('#dTable', 'Sales'); console.log('sales date table:', await p.locator('#dCol').inputValue(), '|', (await p.locator('#checks').innerText()).slice(0, 110));
  await p.evaluate(() => localStorage.clear()); await p.setViewportSize({ width: 375, height: 800 }); await p.reload();
  console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  console.log('errors', errs); await b.close();
})();
