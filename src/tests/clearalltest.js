const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1250, height: 950 } }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|fonts/.test(m.text())) errs.push(m.text()); });
  await p.goto('http://localhost:8765/power-query-writer.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  // own work on two tools and a saved export
  await p.fill('#goal', 'Combine the monthly CSV files'); await p.goto('http://localhost:8765/dax-reviewer.html');
  await p.evaluate(() => { SF_SUITE.set('Kind\tTable\tName\nTable\tSales\tSales', 'Sales model'); localStorage.setItem('kdr.test', 'x'); });
  // per-page Clear entries leaves the other tool and the export alone
  await p.click('#clearEntries'); console.log('buttons:', await p.locator('#clearConfirm .btns button').allInnerTexts());
  await p.click('#clearYes');
  console.log('after page clear: pw goal kept', await p.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('kpw.') && k !== 'kpw.blank')), '| export kept', await p.evaluate(() => !!SF_SUITE.get()), '(expect true true)');
  // Clear all pages
  await p.click('#clearEntries'); await p.click('#clearAllPages');
  const left = await p.evaluate(() => Object.keys(localStorage).filter(k => !/\.blank(At)?$/.test(k)));
  console.log('after clear all: keys left', left, '| export', await p.evaluate(() => !!SF_SUITE.get()), '| done:', await p.locator('#clearDone').innerText(), '(expect only this page\'s empty state, false)');
  await p.goto('http://localhost:8765/power-query-writer.html');
  console.log('pw goal', JSON.stringify(await p.locator('#goal').inputValue()), '| banner', await p.locator('#exampleBanner').isVisible(), '(expect "" false)');
  // home page button
  await p.evaluate(() => SF_SUITE.set('Kind\tTable\tName\nTable\tSales\tSales', 'Sales model'));
  await p.goto('http://localhost:8765/index.html');
  await p.click('#homeClearAll'); await p.click('#homeClearYes');
  console.log('home: export', await p.evaluate(() => !!SF_SUITE.get()), '| saved box hidden', await p.locator('#saved').isHidden(), '|', await p.locator('#homeClearDone').innerText());
  await p.setViewportSize({ width: 390, height: 800 }); await p.goto('http://localhost:8765/model-linter.html'); await p.click('#clearEntries');
  console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await p.screenshot({ path: 'clearall_1.png' });
  console.log('errors', errs); await b.close();
})();
