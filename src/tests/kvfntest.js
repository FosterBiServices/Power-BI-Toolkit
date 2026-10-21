const { chromium } = require('playwright');
// KPI Visualizer: reusable card functions (DAX user-defined functions), their preview with hover tooltips, and the script
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/kpi-visualizer.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  const balanced = t => { let d = 0; for (const c of t.replace(/"(?:[^"]|"")*"/g, '')) { if (c === '(') d++; if (c === ')') d--; if (d < 0) return false; } return d === 0; };
  await p.click('[data-opt="fnlib"]');
  const tmdl = await p.locator('#tmdlView').innerText(), test = await p.locator('#testView').innerText();
  const fns = (tmdl.match(/\n\tfunction '/g) || []).length;
  console.log('functions', fns, '(expect 43) | KPICards names', /function 'FosterBIServices\.KPICards\.SummaryCardHtml'/.test(tmdl), '| no reserved KPI. segment', !/FosterBIServices\.KPI\./.test(tmdl), '| no Color.Text', !/Color\.Text'/.test(tmdl));
  // Sales has a target, so (auto) its card compares with the target; Orders has only a comparison, so year over year
  console.log('Sales Card measure', /measure 'Sales Card' = FosterBIServices\.KPICards\.SummaryCardHtml \( "SALES", \[Total Sales\], "\\\$#,0", FALSE \(\), "Target", \[Sales Target\] \)/.test(tmdl), '| date column', tmdl.includes("MIN ( 'Date'[Date] )"), '| parens in test', balanced(test), '| FUNCTION in test', (test.match(/\n    FUNCTION /g) || []).length);
  console.log('fields shown', await p.locator('#fnDate').isVisible(), await p.locator('#fnStyle').isVisible(), '| trend field hidden', await p.locator('#trendWrap').isHidden());
  // the preview: hover a column, its tooltip shows
  const card = p.locator('#fnBox .kvc').first();
  console.log('preview cards', await p.locator('#fnBox .kvc').count(), '| columns', await card.locator('.kvb').count(), '(expect 12) | tips hidden at rest', await card.locator('.kvt').evaluateAll(ts => ts.every(t => getComputedStyle(t).visibility === 'hidden')));
  await card.locator('.kvbar').nth(9).hover();
  console.log('hover shows', JSON.stringify(await card.locator('.kvt').evaluateAll(ts => ts.filter(t => getComputedStyle(t).visibility === 'visible').map(t => t.textContent))), '(expect Target: …)');
  console.log('target pill', /vs target/.test(await card.innerText()), '| target marks', await card.locator('line').count() - 1, '(expect 12)');
  await p.locator('#fnBox').screenshot({ path: 'kvfn_summary.png' });
  // Compare with: month over month and year over year for every KPI
  await p.selectOption('#fnCompare', 'mom');
  const tm = await p.locator('#tmdlView').innerText();
  console.log('MoM call', /SummaryCardHtml \( "SALES", \[Total Sales\], "\\\$#,0", FALSE \(\), "MoM", BLANK \(\) \)/.test(tm), '| MoM pill', /MoM/.test(await card.innerText()), '| no marks', await card.locator('line').count() === 1);
  await p.selectOption('#fnCompare', 'yoy');
  console.log('YoY call', /"YoY", BLANK \(\) \)/.test(await p.locator('#tmdlView').innerText()), '| YoY pill', /YoY/.test(await card.innerText()), '| LY marks', await card.locator('line').count() - 1);
  await card.locator('.kvbar').nth(11).hover();
  console.log('YoY tooltip', JSON.stringify(await card.locator('.kvt').evaluateAll(ts => ts.filter(t => getComputedStyle(t).visibility === 'visible').map(t => t.textContent))));
  await p.locator('#fnBox').screenshot({ path: 'kvfn_yoy.png' });
  await p.selectOption('#fnCompare', 'auto');
  await p.selectOption('#kpiPick', '3');
  console.log('Orders auto = YoY', /SummaryCardHtml \( "ORDERS", \[Order Count\], "#,0", FALSE \(\), "YoY", BLANK \(\) \)/.test(await p.locator('#tmdlView').innerText()));
  await p.selectOption('#kpiPick', '0');
  // Step 4 colors flow into the color functions
  await p.locator('[data-ink="accent"]').evaluate(e => { e.value = '#5B3A8E'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  const t2 = await p.locator('#tmdlView').innerText();
  console.log('accent function', /Color\.Accent' =\n\t\t\(\) =>\n\t\t    "#5B3A8E"/.test(t2), '| preview bars follow', await card.locator('.kvbar').first().getAttribute('fill'));
  // the band and the date settings
  await p.fill('#band', '5'); await p.fill('#fnAsOf', 'Data As Of');
  const t3 = await p.locator('#tmdlView').innerText();
  console.log('band 0.05', t3.includes('NeutralBand\' =\n\t\t() =>\n\t\t    0.05'), '| as of', t3.includes("MIN ( MAX ( 'Date'[Date] ), [Data As Of] )"));
  // another card, the image version, and both
  await p.selectOption('#fnStyle', 'trend'); await p.selectOption('#fnOut', 'both');
  const t4 = await p.locator('#tmdlView').innerText();
  console.log('trend + both', /measure 'Sales Card HTML' = FosterBIServices\.KPICards\.TrendTileHtml/.test(t4), /measure 'Sales Card' = FosterBIServices\.KPICards\.TrendTile \(/.test(t4), '| image measure Image URL', /TrendTile \([^\n]*\n(\t\t\t[^\n]*\n)*?\t\t\tdataCategory: ImageUrl/.test(t4));
  await p.selectOption('#fnStyle', 'snapshot');
  console.log('snapshot call', /SnapshotTileHtml \( "SALES", FORMAT \( \[Total Sales\]/.test(await p.locator('#tmdlView').innerText()), '| steps cover HTML and image', await p.locator('#steps h4').allInnerTexts().then(x => x.join(' | ')));
  // a lower-is-better percentage KPI
  await p.selectOption('#fnStyle', 'summary'); await p.selectOption('#fnOut', 'html'); await p.selectOption('#kpiPick', '2');
  const t5 = await p.locator('#tmdlView').innerText();
  console.log('Return Rate (target is a number)', /SummaryCardHtml \( "RETURN RATE", \[Return Rate\], "0\.0%", TRUE \(\), "Target", 0\.04 \)/.test(t5));
  await p.locator('#fnBox').screenshot({ path: 'kvfn_lower.png' });
  // with a model export: a date column is required and checked
  await p.fill('#fnDate', 'Date');
  console.log('bad date column error', /Type the date column as/.test(await p.locator('#checks').innerText()), '| script hidden', await p.locator('#outBox').isHidden());
  await p.fill('#fnDate', "'Date'[Date]");
  await p.reload(); await p.click('[data-opt="fnlib"]');
  console.log('after reload: style', await p.locator('#fnStyle').inputValue(), '| as of', await p.locator('#fnAsOf').inputValue());
  await p.setViewportSize({ width: 390, height: 800 });
  console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await p.locator('#fnBox').screenshot({ path: 'kvfn_mobile.png' });
  console.log('errors', errs); await b.close();
})();
