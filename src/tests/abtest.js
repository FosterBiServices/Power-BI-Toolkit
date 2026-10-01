const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1300, height: 950 } }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const U = 'http://localhost:8765/';
  await p.goto(U + 'about-this-report.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  console.log('banner', await p.locator('#exampleBanner').isVisible(), '| stats', await p.locator('#modelStats').innerText(), '| src', await p.locator('#srcMsg').innerText());
  console.log('secbar', await p.locator('#secBar').innerText());
  console.log('kpis', await p.locator('.krow').count(), '| sources', await p.locator('.srow').count());
  await p.screenshot({ path: 'ab_1.png', fullPage: true });
  // edit name -> drafts follow
  await p.fill('#bName', 'Revenue Pulse'); console.log('summary draft:', (await p.locator('[data-draft=summary]').inputValue()).slice(0, 60), '| banner', await p.locator('#exampleBanner').isVisible());
  // a name of your own replaces the whole example (expect name Revenue Pulse, model empty, prompt without example measures)
  console.log('own name:', await p.inputValue('#bName'), '| model', JSON.stringify(await p.inputValue('#modelInput')), '| prompt has Total Sales', (await p.evaluate(() => (document.getElementById('promptView') || {}).textContent || '')).includes('Total Sales'));
  // back to the example for the rest of the checks
  await p.evaluate(() => localStorage.clear()); await p.reload();
  // use alternative wording
  await p.locator('[data-use=summary]').first().click(); console.log('alt used:', (await p.locator('[data-draft=summary]').inputValue()).slice(0, 50), '| reset btn', await p.locator('[data-reset=summary]').count());
  // add a question suggestion
  const qn = await p.locator('[data-add=questions]').count(); if (qn) await p.locator('[data-add=questions]').first().click();
  // kpi rename
  await p.locator('[data-klabel="Total Sales"]').fill('Net sales'); console.log('kpi focus', await p.evaluate(() => document.activeElement.dataset.klabel));
  // remove / add kpi
  await p.locator('[data-krem="Total Cost"]').click(); await p.locator('#sec-kpis details summary').click(); await p.locator('[data-kadd="Margin %"]').click();
  console.log('kpis now', await p.locator('.krow').count());
  // source rename, add
  await p.locator('.srow [data-slabel]').first().fill('Sales data warehouse');
  await p.fill('#srcAdd', 'Budget workbook from Finance'); await p.click('#srcAddBtn');
  console.log('preview:\n' + (await p.locator('#preview').innerText()).slice(0, 1400));
  // copy text
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  await p.click('#copyText'); const t = await p.evaluate(() => navigator.clipboard.readText()); console.log('copied lines', t.split('\n').length);
  // HTML measure
  await p.locator('#htmlBox summary').click(); await p.selectOption('#hRefresh', 'Last Refresh');
  const tm = await p.locator('#tmdlView').innerText(); console.log('tmdl head:', tm.split('\n').slice(0, 6).join('\n'), '\n refresh in tmdl', /FORMAT \( \[Last Refresh\]/.test(tm));
  fs.writeFileSync('ab_tmdl.txt', tm);
  // copilot
  await p.locator('#aiBox summary').first().click();
  const reply = JSON.stringify({ report_summary: 'Revenue Pulse shows how net sales and orders are tracking, by region and segment.', business_value: 'Helps sales managers act sooner.', audience: 'Sales managers and finance', key_questions: ['Are we on track?', 'Which Sales[Region] is behind?'], measure_meanings: { 'Net sales': 'Sales after discounts.', 'Bogus': 'x' }, evidence_gaps: ['The business goal'] });
  await p.fill('#aiInput', reply); console.log('ai out:', (await p.locator('#aiOut').innerText()).slice(0, 400));
  await p.click('[data-aiuse=all]'); console.log('after use: summary', await p.locator('[data-draft=summary]').inputValue(), '| meaning', await p.locator('[data-kmean="Total Sales"]').inputValue());
  await p.screenshot({ path: 'ab_2.png', fullPage: true });
  // persistence
  await p.reload(); console.log('persist name', await p.locator('#bName').inputValue(), '| banner', await p.locator('#exampleBanner').isVisible(), '| kpis', await p.locator('.krow').count());
  // clear entries
  await p.click('#clearEntries'); await p.click('#clearYes'); console.log('cleared: model', await p.locator('#modelInput').inputValue() === '', '| kpi', await p.locator('#sec-kpis').innerText().then(s => s.slice(-60)));
  await p.reload(); console.log('stays blank', await p.locator('#modelInput').inputValue() === '', await p.locator('#exampleBanner').isVisible());
  await p.setViewportSize({ width: 375, height: 800 }); await p.evaluate(() => localStorage.clear()); await p.reload();
  console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await p.screenshot({ path: 'ab_m.png', fullPage: true });
  console.log('errors', errs); await b.close();
})();
