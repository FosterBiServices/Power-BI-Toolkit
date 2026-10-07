const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  const URL = 'http://localhost:8765/kpi-visualizer.html';
  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload();
  const opts = async () => (await p.locator('#options .kv-opt h3').allInnerTexts()).join(' | ');
  console.log('banner', await p.locator('#exampleBanner').isVisible(), '| kpis', await p.locator('.kv-ed').count(), '(expect 4)');
  console.log('options for Sales:', await opts());
  console.log('chosen:', await p.locator('#buildName').innerText(), '(expect Bullet chart)');
  const tmdl = await p.locator('#tmdlView').innerText();
  console.log('tmdl: ref table', tmdl.includes("ref table _Measures"), '| ImageUrl', tmdl.includes('dataCategory: ImageUrl'), '| excel good', tmdl.includes('#006100'), '| no green/red in tracks', !/#(00FF00|FF0000)/i.test(tmdl));
  const test = await p.locator('#testView').innerText();
  console.log('test query: DEFINE', test.includes('DEFINE'), '| MEASURE', (test.match(/MEASURE /g) || []).length, '(expect 5)');
  await p.screenshot({ path: 'kv_1.png', fullPage: true });
  // each option builds without page errors
  for (const id of ['cardvar', 'spark', 'varbar', 'progress', 'slope', 'kpi', 'core', 'card', 'gauge']) {
    const btn = p.locator('[data-opt="' + id + '"]'); if (await btn.count()) await btn.click();
  }
  // KPI without target: Orders
  await p.selectOption('#kpiPick', '3');
  console.log('Orders off options:', (await p.locator('#options .kv-opt.off h3').allInnerTexts()).join(', '));
  // lower is better: Return Rate status should be bad (4.6% vs 4% target)
  await p.selectOption('#kpiPick', '2'); await p.click('[data-opt="cardvar"]');
  console.log('Return Rate label:', await p.locator('.kv-opt.on .kv-lab').first().innerText(), '(expect down arrow? no: up +15.0% vs target, in bad colors)');
  console.log('label color', await p.locator('.kv-opt.on .kv-lab').first().evaluate(e => getComputedStyle(e).color), '(expect rgb(156, 0, 6))');
  // row mode
  await p.click('label:has(#modeRow)');
  console.log('row options:', await opts());
  await p.click('[data-opt="rtable"]');
  const t2 = await p.locator('#tmdlView').innerText();
  console.log('scorecard: table', t2.includes("table 'KPI Scorecard'"), '| KPI Value', t2.includes('measure \'KPI Value\''), '| rows', (t2.match(/\("(Sales|Gross Margin %|Return Rate|Orders)", \d\)/g) || []).length, '(expect 4)');
  await p.screenshot({ path: 'kv_2.png', fullPage: true });
  // colors: theme JSON
  await p.click('[data-preset="json"]'); await p.fill('#themeJson', JSON.stringify({ name: 'Brand', good: '#1F6FB2', neutral: '#8C8C8C', bad: '#D9730D' }));
  console.log('theme msg:', await p.locator('#presetMsg').innerText(), '| tmdl drops Excel colors', !(await p.locator('#tmdlView').innerText()).includes('#006100'));
  await p.fill('#themeJson', '{bad json'); console.log('bad json:', await p.locator('#presetMsg').innerText());
  await p.click('[data-preset="excel"]');
  // typing into the example keeps only what was typed
  await p.click('label:has(#modeOne)');
  await p.locator('#k0_label').click(); await p.keyboard.press('End'); await p.keyboard.type(' Net');
  console.log('after typing: banner', await p.locator('#exampleBanner').isVisible(), '| kpis', await p.locator('.kv-ed').count(), '| label', JSON.stringify(await p.locator('#k0_label').inputValue()), '(expect "Net") | measure', JSON.stringify(await p.locator('#k0_measure').inputValue()));
  await p.fill('#k0_measure', 'Net Revenue'); await p.fill('#k0_target', 'Revenue Budget');
  console.log('own KPI options:', (await opts()).slice(0, 80), '| sample msg', await p.locator('#sampleMsg').innerText().then(t => !!t));
  console.log('checks without table:', await p.locator('#checks').innerText());
  await p.fill('#homeTable', 'Sales'); console.log('out shown', await p.locator('#outBox').isVisible());
  // reload keeps own KPIs
  await p.reload(); console.log('after reload label', await p.locator('#k0_label').inputValue(), '| banner', await p.locator('#exampleBanner').isVisible());
  // export from home: picker lists measures (including ones in _Measures), with checks
  await p.goto('http://localhost:8765/index.html'); await p.fill('#exportInput', fs.readFileSync('ex_export.tsv', 'utf8')); await p.waitForTimeout(200);
  await p.evaluate(() => { Object.keys(localStorage).filter(k => k.startsWith('kkv.')).forEach(k => localStorage.removeItem(k)); });
  await p.goto(URL);
  console.log('with saved export: banner', await p.locator('#exampleBanner').isVisible(), '| kpis', await p.locator('.kv-ed').count(), '| measures listed', await p.locator('#avail .mrow2').count());
  await p.locator('#avail .mrow2').first().click();
  console.log('picked:', await p.locator('#k0_measure').inputValue(), '| table', await p.locator('#homeTable').inputValue(), '| trend', await p.locator('#trendCol').inputValue(), '| checks', (await p.locator('#checks').innerText()).slice(0, 120));
  console.log('source after export:', await p.locator('.sc-choose [aria-checked=true] .tn').innerText(), '(expect Model export)');
  // PBIP folder: measures from the semantic model, including the measures table
  await p.click('.sc-choose [data-sc=pbip]');
  await p.setInputFiles('.sc-pbip input[type=file]', 'pqpbip/Contoso Sales'); await p.waitForTimeout(300);
  console.log('pbip stats:', (await p.locator('#modelStats').innerText()).replace(/\n/g, ' '), '| listed', (await p.locator('#avail .mname').allInnerTexts()).join(', '), '| msg', await p.locator('#modelMsg').innerText());
  await p.reload(); console.log('pbip after reload:', (await p.locator('#modelStats').innerText()).replace(/\n/g, ' '), '| source', await p.locator('.sc-choose [aria-checked=true] .tn').innerText());
  await p.click('.sc-choose [data-sc=none]'); console.log('no model: listed', await p.locator('#avail .mrow2').count(), '| pick hidden', await p.locator('#pickBox').isHidden());
  // clear entries
  await p.click('#clearEntries'); await p.click('#clearYes');
  console.log('cleared: kpis', await p.locator('.kv-ed').count(), '| banner', await p.locator('#exampleBanner').isVisible());
  await p.reload(); console.log('after reload: kpis', await p.locator('.kv-ed').count(), '(expect 0)');
  // mobile
  await p.evaluate(() => localStorage.clear()); await p.setViewportSize({ width: 390, height: 800 }); await p.reload();
  console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await p.click('label:has(#modeRow)'); console.log('mobile row hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await p.screenshot({ path: 'kv_m.png', fullPage: true });
  console.log('errors', errs); await b.close();
})();
