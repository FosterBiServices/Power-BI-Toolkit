// Layout Designer: fixed column widths and row heights in px (the others share what's left), and the warning when all are fixed and don't fit
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1300, height: 950 } }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const U = 'http://localhost:8765/';
  await p.goto(U + 'layout-designer.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.click('#sizesBox summary'); await p.click('[data-tpl=blank]');
  const g = () => p.evaluate(() => { const G = LO.layout(state.cfg).grid; return { w: G.w, x: G.x, h: G.h, left: G.left, right: G.right }; });
  const msgs = () => p.locator('#layoutMsg').innerText();
  let s = await g(); console.log('even', s.w.join(','), '| room', s.right - s.left);
  // fix column 1 at 500 px: the other two share the rest, gaps and margin kept
  await p.fill('#colW input[data-px][data-i="0"]', '500'); s = await g();
  console.log('col 1 = 500', s.w.join(','), '(expect 500,370,370) | right edge', s.x[2] + s.w[2], '(expect', s.right, ') | gap', s.x[1] - s.x[0] - s.w[0], '(expect 10)');
  console.log('pct 1 disabled', await p.locator('#colW input:not([data-px])[data-i="0"]').isDisabled(), '| summary', await p.locator('#sizesSum').innerText());
  // a % typed in column 2 moves only columns 2 and 3; column 1 stays 500
  await p.locator('#colW input[data-px][data-i="0"]').press('Tab');
  await p.fill('#colW input:not([data-px])[data-i="1"]', '20'); s = await g(); console.log('col 2 at 20%', s.w.join(','), '(expect 500 first)');
  // it's remembered after a reload and when the page width changes
  await p.reload(); s = await g(); console.log('reload', s.w.join(','), '| colPx', JSON.stringify(await p.evaluate(() => state.cfg.grid.colPx)));
  await p.selectOption('#pSize', '1'); s = await g(); console.log('wider page', s.w.join(','), '(expect 500 first, the others wider)'); await p.selectOption('#pSize', '0');
  // adding a column keeps column 1 fixed
  await p.locator('#cols').focus(); await p.fill('#cols', '4'); s = await g(); console.log('4 cols', s.w.join(','), '| colPx', JSON.stringify(await p.evaluate(() => state.cfg.grid.colPx)));
  await p.fill('#cols', '3');
  // drag the handle beside the fixed column: it stays fixed at its new width
  const svg = p.locator('#canvas svg'); await svg.scrollIntoViewIfNeeded(); const box = await svg.boundingBox(), k = box.width / 1280, G = await p.evaluate(() => state.L.grid);
  const hx = box.x + (G.x[0] + G.w[0] + 5) * k, hy = box.y + (G.y[0] + G.h[0] / 2) * k;
  await p.mouse.move(hx, hy); await p.mouse.down(); await p.mouse.move(box.x + (G.left + (G.right - G.left) / 3) * k, hy, { steps: 6 }); await p.mouse.up();
  s = await g(); console.log('dragged', s.w.join(','), '| colPx', JSON.stringify(await p.evaluate(() => state.cfg.grid.colPx)));
  // too wide: warns that the others have no room
  await p.fill('#colW input[data-px][data-i="0"]', '1200'); console.log('too wide:', await msgs());
  // all three fixed, not adding up: warning and Fit to the page
  await p.fill('#colW input[data-px][data-i="0"]', '400'); await p.fill('#colW input[data-px][data-i="1"]', '400'); await p.fill('#colW input[data-px][data-i="2"]', '300');
  await p.locator('#colW input[data-px][data-i="2"]').press('Tab');
  s = await g(); console.log('all fixed', s.w.join(','), '| msg:', await msgs(), '| fit chip', await p.locator('#colW [data-pre=fit]').count());
  await p.locator('.designer').screenshot({ path: 'lofixed_1.png' });
  await p.fill('#colW input[data-px][data-i="2"]', '600'); await p.locator('#colW input[data-px][data-i="2"]').press('Tab'); console.log('too wide, all fixed:', await msgs());
  await p.click('#colW [data-pre=fit]'); s = await g(); console.log('fitted', s.w.join(','), 'sum', s.w.reduce((a, c) => a + c, 0), '(expect', s.right - s.left - 20, ') | msgs', JSON.stringify(await msgs()));
  // × lets column 3 resize; Even clears everything
  await p.click('#colW [data-unfix][data-i="2"]'); console.log('unfixed 3', JSON.stringify(await p.evaluate(() => state.cfg.grid.colPx)), '| widths', (await g()).w.join(','));
  await p.click('#colW [data-pre=even]'); console.log('even again', (await g()).w.join(','), '| colPx', JSON.stringify(await p.evaluate(() => state.cfg.grid.colPx)));
  // rows work the same way
  await p.fill('#rowH input[data-px][data-i="0"]', '200'); s = await g(); console.log('row 1 = 200', s.h.join(','));
  // phone width: no horizontal scroll
  await p.setViewportSize({ width: 390, height: 900 }); console.log('390 scroll', await p.evaluate(() => document.documentElement.scrollWidth), '(expect 390)');
  await p.locator('#sizesBox').screenshot({ path: 'lofixed_2.png' });
  console.log('errors', JSON.stringify(errs)); await b.close();
})();
