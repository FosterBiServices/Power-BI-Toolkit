// Layout Designer: build the page row by row (each row with its own visuals and widths)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1300, height: 950 } }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const U = 'http://localhost:8765/';
  await p.goto(U + 'layout-designer.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.click('#rowsBox summary');
  // the example as rows
  const rows = () => p.evaluate(() => LO.rowsOf(state.cfg).map(r => r.widths.join('+')).join(' | '));
  const vis = () => p.evaluate(() => state.L.items.filter(o => o.region === 'grid').map(o => o.title + ' ' + Math.round(o.x) + ',' + Math.round(o.y) + ' ' + Math.round(o.w) + 'x' + Math.round(o.h)).join(' | '));
  console.log('example rows', await rows(), '| row boxes', await p.locator('#rowsB .rb').count());
  // row 1: 3 visuals; row 2 keeps its 2 (the trend chart's title stays)
  await p.fill('#rowsB [data-r="0"][data-rn]', '3');
  console.log('row 1 = 3', await rows(), '| grid', await p.evaluate(() => state.cfg.grid.cols + ' cols'), '|', await vis());
  console.log('note', await p.locator('#colsNote').isVisible(), '|', await p.locator('#sizesSum').innerText());
  // add a row of 4, then a row of 1
  await p.click('#rbAdd'); await p.fill('#rowsB [data-r="2"][data-rn]', '4'); await p.click('#rbAdd');
  console.log('4 rows', await rows(), '| cols', await p.evaluate(() => state.cfg.grid.cols), '| visuals', await p.locator('#canvas .vis[data-id^=g]').count(), '(expect 3+2+4+1 = 10)');
  console.log('note now', await p.locator('#colsNote').innerText(), '|', await p.locator('#sizesSum').innerText());
  // gaps and right edge the same in every row
  const edges = await p.evaluate(() => { const G = state.L.grid, its = state.L.items.filter(o => o.region === 'grid'); return [...new Set(its.filter(o => o.x === G.left).map(o => o.x))].join() + ' / right ' + [...new Set(its.map(o => Math.round(o.x + o.w)).filter(v => v > G.right - 30))].join() + ' (expect ' + G.right + ')'; });
  console.log('edges', edges);
  // widths in row 2: first at 25%
  await p.fill('#rowsB [data-r="1"][data-rw="0"]', '25'); await p.locator('#rowsB [data-r="1"][data-rw="0"]').press('Tab');
  console.log('row 2 at 25%', await rows(), '| focus on', await p.evaluate(() => document.activeElement.dataset.rw));
  // typing 10 then back to 4 in row 3 keeps the 4 (no visuals lost on the way)
  await p.evaluate(() => state.cfg.items.forEach((x, i) => { x.title = 'V' + i; }));
  await p.locator('#rowsB [data-r="2"][data-rn]').focus(); await p.fill('#rowsB [data-r="2"][data-rn]', '1'); await p.fill('#rowsB [data-r="2"][data-rn]', '10'); await p.fill('#rowsB [data-r="2"][data-rn]', '4');
  console.log('row 3 back to 4', await p.evaluate(() => LO.rowsOf(state.cfg)[2].pieces.map(x => state.cfg.items[x.idx].title).join()));
  // row heights: fix row 1 at 150 px
  await p.fill('#rowsB [data-r="0"][data-rpx]', '150'); await p.locator('#rowsB [data-r="0"][data-rpx]').press('Tab');
  console.log('row 1 150 px', await p.evaluate(() => state.L.grid.h.join(',')), '| msgs', JSON.stringify(await p.locator('#layoutMsg').innerText()));
  // a visual spanning two rows keeps its span when another row changes
  await p.click('[data-tpl=map]'); console.log('map rows', await rows());
  await p.fill('#rowsB [data-r="1"][data-rn]', '3');
  console.log('map after row 2 = 3', await vis());
  // remove row 1
  await p.click('[data-tpl=kpi]'); await p.click('#rowsB [data-r="0"][data-rdel]'); console.log('removed row 1', await rows(), '|', await vis());
  // label column: a box beside each row, the grid moves right by its width and the gap
  await p.click('[data-tpl=blank]'); const g0 = await p.evaluate(() => state.L.grid.left);
  await p.check('#rbLabOn');
  const labs = () => p.evaluate(() => state.L.items.filter(o => o.region === 'labels').map(o => o.title + ' ' + Math.round(o.x) + ',' + Math.round(o.y) + ' ' + Math.round(o.w) + 'x' + Math.round(o.h)).join(' | '));
  console.log('labels', await labs(), '| grid left', g0, '->', await p.evaluate(() => state.L.grid.left), '(expect +150)');
  await p.fill('#rowsB [data-r="1"][data-rlab]', 'Customers'); await p.fill('#rbLabW', '200');
  console.log('renamed, 200 wide', await labs(), '| rows line up', await p.evaluate(() => state.L.items.filter(o => o.region === 'labels').every((o, r) => o.y === state.L.grid.y[r] && o.h === state.L.grid.h[r])));
  // click a label on the page: its title in the editor
  await p.locator('#canvas [data-id="l0"]').click(); await p.fill('#edTitle', 'Sales'); console.log('label edited on the page', await labs());
  // a row added gets a label; a row removed takes its label with it
  await p.click('#rbAdd'); await p.click('#rowsB [data-r="0"][data-rdel]'); console.log('after add + remove row 1', await labs());
  // split a visual into 2 x 2 boxes
  await p.locator('#canvas [data-id="g0"]').click(); await p.fill('#edSc', '2'); await p.fill('#edSr', '2');
  const subs = () => p.evaluate(() => state.L.items.filter(o => o.parent === 'g0').map(o => o.title + ' ' + Math.round(o.w) + 'x' + Math.round(o.h)).join(' | '));
  console.log('split 2x2', await subs(), '| box titles', await p.locator('.sub-t input').count(), '| focus', await p.evaluate(() => document.activeElement.id));
  await p.locator('.sub-t input').nth(1).fill('Orders'); console.log('box 2 renamed', await subs());
  await p.locator('#canvas [data-id="g0.3"]').click(); console.log('clicking a box selects', await p.evaluate(() => state.sel), '(expect null: it was selected) ');
  await p.locator('#canvas [data-id="g0.3"]').click(); console.log('and again', await p.evaluate(() => state.sel), '(expect g0)');
  // the split visual survives a change to the rows
  await p.fill('#rowsB [data-r="0"][data-rn]', '3'); console.log('row 1 = 3 keeps the split', await subs());
  console.log('positions rows', await p.$$eval('#posTable tbody tr', a => a.map(r => r.cells[0].innerText).filter(t => /Orders|Sales|Customers/.test(t)).join(', ')));
  await p.locator('.designer').screenshot({ path: 'lorows_3.png' });
  // saved
  await p.reload(); console.log('after reload', await rows(), '| labels', await labs(), '| open', await p.evaluate(() => document.getElementById('rowsBox').open));
  await p.locator('.designer').screenshot({ path: 'lorows_1.png' });
  await p.setViewportSize({ width: 390, height: 900 }); console.log('390 scroll', await p.evaluate(() => document.documentElement.scrollWidth), '(expect 390)');
  await p.locator('#rowsBox').screenshot({ path: 'lorows_2.png' });
  console.log('errors', JSON.stringify(errs)); await b.close();
})();
