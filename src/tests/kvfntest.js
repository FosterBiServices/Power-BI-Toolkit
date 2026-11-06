const { chromium } = require('playwright');
// KPI Visualizer: reusable card functions (DAX user-defined functions), their preview with hover tooltips, and the script
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/kpi-visualizer.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  const balanced = t => { let d = 0; for (const c of t.replace(/"(?:[^"]|"")*"/g, '')) { if (c === '(') d++; if (c === ')') d--; if (d < 0) return false; } return d === 0; };
  const fnNames = t => (t.match(/\n\tfunction '([^']+)'/g) || []).map(x => x.replace(/^\n\tfunction 'FosterBIServices\.KPICards\./, '').replace(/'$/, ''));
  await p.click('[data-opt="fnlib"]');
  console.log('default compare', await p.locator('#fnCompare').inputValue(), '(expect mom) | MoM call', /SummaryCardHtml \( "SALES", \[Total Sales\], "\\\$#,0", FALSE \(\), 295, 170, "MoM", BLANK \(\) \)/.test(await p.locator('#tmdlView').innerText()));
  console.log('fit css', await p.locator('#fnBox .kvc style').first().textContent().then(t => /max-height:96vh/.test(t) && /\.kvc\{overflow:hidden\}/.test(t)), '| padding step', /Padding<\/b> to 0/.test(await p.locator('#steps').innerHTML()));
  await p.selectOption('#fnCompare', 'target');
  const tmdl = await p.locator('#tmdlView').innerText(), test = await p.locator('#testView').innerText();
  console.log('functions', fnNames(tmdl).join(', '), '(expect StartDate, EndDate, Between, MonthColumns, SummaryCardHtml)');
  console.log('no color or format functions', !/Color\.|NeutralBand|ValueText|Compact'|StatusColor|ChangeText|ToImage|ToHtml/.test(tmdl), '| no annotations', !/annotation/.test(tmdl), '| colors written in', tmdl.includes('#118DFF') && tmdl.includes('#C6EFCE'));
  // TMDL layout: function one tab in, its expression three tabs in, nothing at the properties' level
  const body = tmdl.split('\n').filter(l => l && !/^createOrReplace$/.test(l));
  console.log('indent ok', body.every(l => /^\t(\/\/\/ |function |ref table )|^\t\t(measure |\/\/\/ )|^\t\t\t|^\t{4}/.test(l)), '| expression line', /function '[^']+' =\n\t\t\t\( /.test(tmdl));
  console.log('Sales Card measure', /measure 'Sales Card' = FosterBIServices\.KPICards\.SummaryCardHtml \( "SALES", \[Total Sales\], "\\\$#,0", FALSE \(\), 295, 170, "Target", \[Sales Target\] \)/.test(tmdl), '| date column', tmdl.includes("MIN ( 'Date'[Date] )"), '| parens in test', balanced(test), '| FUNCTION in test', (test.match(/\n    FUNCTION /g) || []).length, '(expect 5)');
  console.log('fields shown', await p.locator('#fnDate').isVisible(), await p.locator('#fnStyle').isVisible(), '| trend field hidden', await p.locator('#trendWrap').isHidden(), '| days hidden', await p.locator('#fnDaysWrap').isHidden());
  console.log('As choices', JSON.stringify(await p.locator('#fnOut option').allInnerTexts()));
  // the preview: hover a column, its tooltip shows
  const card = p.locator('#fnBox .kvc').first();
  console.log('preview cards', await p.locator('#fnBox .kvc').count(), '| columns', await card.locator('.kvb').count(), '(expect 12) | tips hidden at rest', await card.locator('.kvt').evaluateAll(ts => ts.every(t => getComputedStyle(t).visibility === 'hidden')));
  await card.locator('.kvbar').nth(9).hover();
  console.log('hover shows', JSON.stringify(await card.locator('.kvt').evaluateAll(ts => ts.filter(t => getComputedStyle(t).visibility === 'visible').map(t => t.textContent))), '(expect Target: …)');
  const lines = async () => (await card.locator('text').allTextContents()).filter(t => /:$/.test(t));
  console.log('target pill', /vs target/.test(await card.innerText()), '| lines', JSON.stringify(await lines()), '(expect Actual:, Target:)');
  await p.locator('#fnBox').screenshot({ path: 'kvfn_summary.png' });
  // Compare with: month over month and year over year: two lines, the two numbers the pill compares
  await p.selectOption('#fnCompare', 'mom');
  const tm = await p.locator('#tmdlView').innerText();
  console.log('MoM call', /SummaryCardHtml \( "SALES", \[Total Sales\], "\\\$#,0", FALSE \(\), 295, 170, "MoM", BLANK \(\) \)/.test(tm), '| MoM pill', /MoM/.test(await card.innerText()), '| lines', JSON.stringify(await lines()), '(expect this month, last month)');
  await p.selectOption('#fnCompare', 'yoy');
  console.log('YoY call', /"YoY", BLANK \(\) \)/.test(await p.locator('#tmdlView').innerText()), '| YoY pill', /YoY/.test(await card.innerText()), '| lines', JSON.stringify(await lines()), '(expect Current:, Last year:) | LY marks', await card.locator('line').count() - 1);
  await card.locator('.kvbar').nth(11).hover();
  console.log('YoY tooltip', JSON.stringify(await card.locator('.kvt').evaluateAll(ts => ts.filter(t => getComputedStyle(t).visibility === 'visible').map(t => t.textContent))));
  await p.locator('#fnBox').screenshot({ path: 'kvfn_yoy.png' });
  await p.selectOption('#kpiPick', '3');
  console.log('Orders (no target) compare list', JSON.stringify(await p.locator('#fnCompare option').allInnerTexts()), '| YoY kept', /"ORDERS", \[Order Count\], "#,0", FALSE \(\), 295, 170, "YoY", BLANK \(\) \)/.test(await p.locator('#tmdlView').innerText()));
  await p.selectOption('#kpiPick', '0');
  console.log('card list', JSON.stringify(await p.locator('#fnStyle option').allInnerTexts()), '| compare list', JSON.stringify(await p.locator('#fnCompare option').allInnerTexts()));
  console.log('prior-period KPI compares', await p.evaluate(() => kvfComparesFor(Object.assign(kvBlankKpi(), { measure: 'X', target: 'X Target', compare: 'X LY', intent: 'change' })).map(x => x.id).join(',')), '(expect mom,yoy)');
  // the visual's size: suggested, or typed
  await p.fill('#fnW', '400'); await p.fill('#fnH', '200');
  console.log('own size call', /SummaryCardHtml \( "SALES", [^\n]*, 400, 200, /.test(await p.locator('#tmdlView').innerText()), '| preview viewBox', await card.locator('svg').first().getAttribute('viewBox'), '| note', await p.locator('#fnSizeNote').innerText());
  await p.locator('#fnBox').screenshot({ path: 'kvfn_size.png' });
  await p.fill('#fnW', '100');
  console.log('too small is raised', await p.locator('#fnSizeNote').innerText());
  await p.fill('#fnW', ''); await p.fill('#fnH', '');
  // Step 4 colors and the band are written into the functions
  await p.locator('[data-ink="accent"]').evaluate(e => { e.value = '#5B3A8E'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.fill('#band', '5'); await p.fill('#fnAsOf', 'Data As Of');
  const t3 = await p.locator('#tmdlView').innerText();
  console.log('accent in columns', t3.includes('"#5B3A8E"'), '| preview bars follow', await card.locator('.kvbar').first().getAttribute('fill'), '| band 0.05', t3.includes('>= 0.05'), '| as of', t3.includes("MIN ( MAX ( 'Date'[Date] ), [Data As Of] )"));
  // SVG image: only the image function, the measure is an Image URL
  await p.selectOption('#fnOut', 'image');
  const t4 = await p.locator('#tmdlView').innerText();
  console.log('image', fnNames(t4).join(', '), '| no Html', !/Html'/.test(t4), '| data URI', t4.includes('data:image/svg+xml;utf8,'), '| Image URL', /dataCategory: ImageUrl/.test(t4));
  // the other cards
  const styles = ['trend', 'rolling', 'snapshot'];
  for (const st of styles) {
    await p.selectOption('#fnStyle', st);
    const t = await p.locator('#tmdlView').innerText(), q = await p.locator('#testView').innerText();
    const ms = (t.match(/measure '[^']+' = [^\n]+/g) || []).map(x => x.replace(/FosterBIServices\.KPICards\./, ''));
    console.log(st, '| functions', fnNames(t).join(', '), '| parens', balanced(q), '| measures', ms.length, '|', ms[0], '| previews', await p.locator('#fnBox .kvc').count(), '| steps', (await p.locator('#steps h4').allInnerTexts()).length);
  }
  await p.selectOption('#fnStyle', 'rolling');
  console.log('days shown', await p.locator('#fnDaysWrap').isVisible(), '| compare hidden', await p.locator('#fnCompareWrap').isHidden());
  await p.fill('#fnDays', '7');
  console.log('7 days', /RollingTile \( "SALES", \[Total Sales\], 7, /.test(await p.locator('#tmdlView').innerText()));
  await p.selectOption('#fnStyle', 'snapshot');
  console.log('snapshot: date fields hidden', await p.locator('#fnDate').isHidden());
  await p.selectOption('#fnOut', 'html');
  // the small charts are built as a function from their own options
  for (const o of ['bullet', 'progress', 'spark', 'varbar']) {
    if (!(await p.locator('[data-opt="' + o + '"]').count())) { console.log(o, 'not listed for this KPI'); continue; }
    await p.click('[data-opt="' + o + '"]');
    const before = await p.locator('#tmdlView').innerText();
    await p.selectOption('#asFn', '1');
    const t = await p.locator('#tmdlView').innerText(), q = await p.locator('#testView').innerText();
    console.log(o, '| measures only', !/\n\tfunction /.test(before), '| as function', fnNames(t).join(', '), '|', ((t.match(/measure '[^']+' = FosterBIServices[^\n]+/) || [''])[0]).replace(/FosterBIServices\.KPICards\./, ''), '| parens', balanced(q), '| fn step', /Turn on DAX functions/.test(await p.locator('#steps').innerText()), '| date field', await p.locator('#fnDate').isVisible());
    await p.selectOption('#asFn', '');
  }
  await p.click('[data-opt="fnlib"]');
  // a lower-is-better percentage KPI
  await p.selectOption('#fnStyle', 'summary'); await p.selectOption('#kpiPick', '2'); await p.selectOption('#fnCompare', 'target');
  console.log('Return Rate (target is a number)', /SummaryCardHtml \( "RETURN RATE", \[Return Rate\], "0\.0%", TRUE \(\), 295, 170, "Target", 0\.04 \)/.test(await p.locator('#tmdlView').innerText()));
  await p.locator('#fnBox').screenshot({ path: 'kvfn_lower.png' });
  // a date column is required and checked
  await p.fill('#fnDate', 'Date');
  console.log('bad date column error', /Type the date column as/.test(await p.locator('#checks').innerText()), '| script hidden', await p.locator('#outBox').isHidden());
  await p.fill('#fnDate', "'Date'[Date]");
  await p.reload(); await p.click('[data-opt="fnlib"]');
  console.log('after reload: style', await p.locator('#fnStyle').inputValue(), '| as', await p.locator('#fnOut').inputValue(), '| as of', await p.locator('#fnAsOf').inputValue());
  await p.setViewportSize({ width: 390, height: 800 });
  console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await p.locator('#fnBox').screenshot({ path: 'kvfn_mobile.png' });
  console.log('errors', errs); await b.close();
})();
