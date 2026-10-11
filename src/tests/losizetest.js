// Layout Designer: column widths and row heights (typed, presets, dragged), and 3-30-300 suggestions from a list of visuals
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1300, height: 950 } }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const U = 'http://localhost:8765/';
  await p.goto(U + 'layout-designer.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  // split() with weights: whole pixels that add up, padding untouched
  console.log('split 1:2', JSON.stringify(await p.evaluate(() => LO.split(1260, 2, 10, 'fit', [1, 2]))), '(expect [417,833])');
  console.log('split even', JSON.stringify(await p.evaluate(() => LO.split(1260, 3, 10, 'fit'))), '(expect [414,413,413])');
  // a blank 3 x 2 grid, then 1/3 + 2/3 rows
  await p.click('[data-tpl=blank]');
  const sizes = () => p.evaluate(() => { const g = LO.layout(state.cfg).grid; return { w: g.w, h: g.h, x: g.x, y: g.y }; });
  let s = await sizes(); console.log('even cols', s.w.join(','), '| rows', s.h.join(','));
  await p.locator('#rowH [data-pre="1,2"]').click(); s = await sizes();
  console.log('rows 1/3 + 2/3', s.h.join(','), '| gap kept', s.y[1] - (s.y[0] + s.h[0]), '(expect 10)', '| pressed', await p.locator('#rowH [data-pre="1,2"]').getAttribute('aria-pressed'));
  // type 50% into column 1: the others share the rest
  await p.fill('#colW [data-i="0"]', '50'); s = await sizes();
  console.log('col 1 at 50%', s.w.join(','), '| inputs', await p.$$eval('#colW input', a => a.map(x => x.value).join(' / ')));
  // drag the handle between columns 1 and 2 to about a quarter of the grid
  const svg = p.locator('#canvas svg'); const box = await svg.boundingBox(); const W = await p.evaluate(() => state.cfg.w);
  const k = box.width / W, G = await p.evaluate(() => state.L.grid);
  const hx = box.x + (G.x[0] + G.w[0] + 5) * k, hy = box.y + ((G.top + G.bottom) / 2) * k;
  await p.mouse.move(hx, hy); await p.mouse.down(); await p.mouse.move(box.x + (G.left + (G.right - G.left) * 0.26) * k, hy, { steps: 6 }); await p.mouse.up();
  s = await sizes(); console.log('after drag', s.w.join(','), '| colW', JSON.stringify(await p.evaluate(() => state.cfg.grid.colW)), '(expect col 1 at 25%)');
  // keyboard on a row handle
  await p.locator('[data-gut=r0]').focus(); await p.keyboard.press('ArrowDown'); console.log('row handle key', JSON.stringify(await p.evaluate(() => state.cfg.grid.rowH)), '| focus', await p.evaluate(() => document.activeElement.getAttribute('data-gut')));
  // positions table follows
  console.log('positions rows', await p.locator('#posTable tbody tr').count());
  // changing the column count resets widths to even
  await p.fill('#cols', '4'); console.log('4 cols resets', JSON.stringify(await p.evaluate(() => state.cfg.grid.colW)), '(expect null)');
  // saved and restored
  await p.locator('#rowH [data-pre="2,1"]').click(); await p.reload(); console.log('restored rowH', JSON.stringify(await p.evaluate(() => state.cfg.grid.rowH)));
  await p.screenshot({ path: 'losize_1.png', fullPage: false, clip: { x: 0, y: (await p.locator('#s2').boundingBox()).y - 20, width: 1300, height: 900 } });

  // ---- suggestions ----
  await p.evaluate(() => { document.getElementById('suggestBox').open = true; });
  console.log('default visuals', await p.locator('#sgList .sgv').count(), '| hint 3:', await p.locator('[data-hint="2"]').innerText());
  await p.click('#sgGo');
  const cards = async () => p.$$eval('#sgOut .sg', a => a.map(x => x.querySelector('h4').innerText.replace(/\n/g, ' ') + ' :: ' + [...x.querySelectorAll('li')].find(l => l.innerText.startsWith('Page')).innerText.slice(0, 90)));
  console.log('suggestions:\n  ' + (await cards()).join('\n  '));
  console.log('tips:', (await p.locator('.sg-tips').innerText()).slice(0, 300));
  // too many bars with no scroll limit -> a taller page or details on drill-through
  await p.fill('#sgvShow2', ''); await p.fill('#sgvN2', '30');
  console.log('after 30 bars, no limit:\n  ' + (await cards()).join('\n  '));
  console.log('drill note', await p.locator('#sgDetail').count());
  // donut with 9 slices gets advice; non-scrolling types disable "before scrolling"
  await p.click('#sgAdd'); await p.selectOption('#sgvType3', 'donutChart'); await p.fill('#sgvN3', '9');
  console.log('donut show disabled', await p.locator('#sgvShow3').isDisabled(), '| hint', await p.locator('[data-hint="3"]').innerText());
  await p.locator('[data-usesg="0"]').click();
  console.log('used: grid', JSON.stringify(await p.evaluate(() => state.cfg.grid)), '| page', await p.evaluate(() => state.cfg.w + 'x' + state.cfg.h), '| msgs', JSON.stringify(await p.locator('#layoutMsg').innerText()));
  // old saved answers still load
  await p.evaluate(() => localStorage.setItem('klo.sg', JSON.stringify({ kpis: 3, targets: 'none', trend: true, breakdowns: 2, geo: true, heatmap: false, detail: 'drill', filters: 2, filterPlace: 'auto' })));
  await p.reload(); await p.evaluate(() => { document.getElementById('suggestBox').open = true; });
  console.log('old answers ->', await p.$$eval('#sgList select', a => a.map(x => x.value).join(', ')), '(expect lineChart, map, clusteredBarChart)');
  await p.click('#sgGo'); await p.evaluate(() => document.getElementById('sgOut').scrollIntoView());
  await p.screenshot({ path: 'losize_2.png', fullPage: false });
  await p.setViewportSize({ width: 390, height: 800 }); await p.reload(); await p.evaluate(() => { document.getElementById('suggestBox').open = true; });
  console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await p.evaluate(() => document.getElementById('sgList').scrollIntoView()); await p.screenshot({ path: 'losize_m.png' });
  console.log('errors', errs); await b.close();
})();
