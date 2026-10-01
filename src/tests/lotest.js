const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1300, height: 950 }, acceptDownloads: true }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const U = 'http://localhost:8765/';
  await p.goto(U + 'theme-builder.html'); await p.evaluate(() => localStorage.clear());
  await p.goto(U + 'layout-designer.html');
  console.log('banner', await p.locator('#exampleBanner').isVisible(), '| vis', await p.locator('#canvas .vis').count(), '| cells', await p.locator('#canvas .cell').count(), '| msgs', await p.locator('#layoutMsg').innerText());
  console.log('src msg:', (await p.locator('#srcBox').innerText()).slice(0, 80));
  await p.screenshot({ path: 'lo_1.png', fullPage: true });
  // click a visual, change type & span
  await p.locator('#canvas .vis').filter({ has: p.locator('text=Sales by category') }).first().click();
  console.log('editor:', (await p.locator('#editor h3').innerText()), await p.locator('#edTitle').inputValue());
  await p.selectOption('#edType', 'donutChart'); await p.fill('#edTitle', 'Channel mix');
  console.log('focus stays', await p.evaluate(() => document.activeElement.id), '| banner', await p.locator('#exampleBanner').isVisible());
  // empty cells: make grid 3 cols -> empty cell appears; click it
  await p.fill('#cols', '3'); console.log('cells now', await p.locator('#canvas .cell').count());
  await p.locator('#canvas .cell').first().click(); console.log('added:', await p.locator('#edTitle').inputValue(), await p.locator('#canvas .vis').count());
  await p.fill('#edCs', '1');
  // overlap check
  await p.fill('#edC', '1'); await p.fill('#edR', '1'); console.log('overlap msg:', await p.locator('#layoutMsg').innerText());
  await p.click('[data-act=del]');
  // theme builder source: save a theme there, come back
  await p.goto(U + 'theme-builder.html'); await p.fill('[data-h=seed0]', '#7A1F5C'); await p.fill('#tName', 'Plum');
  await p.goto(U + 'layout-designer.html'); console.log('tb src:', (await p.locator('#srcBox').innerText()).slice(0, 60), '| accent', await p.locator('[data-h=accent]').inputValue());
  // theme file source
  await p.selectOption('#colorSrc', 'file'); await p.fill('#themeText', JSON.stringify({ name: 'Corp', dataColors: ['#0B5394', '#E69138'], background: '#FFFFFF', foreground: '#222222', visualStyles: { page: { '*': { background: [{ color: { solid: { color: '#EEEEEE' } }, transparency: 0 }] } } } }));
  console.log('file src:', (await p.locator('#srcBox .msg').innerText()), '| page', await p.locator('[data-h=page]').inputValue(), '| focus', await p.evaluate(() => document.activeElement.id));
  await p.fill('[data-h=card]', '#FAFAFA'); console.log('override kept focus', await p.evaluate(() => document.activeElement.dataset.h), await p.locator('.crow.changed').count());
  // figma toggle
  await p.check('#figmaOn'); console.log('figma buttons visible', await p.locator('[data-copy=bg-svg]').isVisible());
  // downloads
  const dl = async sel => { const [d] = await Promise.all([p.waitForEvent('download'), p.click(sel)]); const f = 'lo_dl_' + d.suggestedFilename().replace(/\s/g, '_'); await d.saveAs(f); return f; };
  console.log(await dl('[data-dl=bg-png2]'), await dl('[data-dl=wf-png]'), await dl('[data-dl=bg-svg]'));
  console.log('pos rows', await p.locator('#posTable tbody tr').count());
  await p.evaluate(() => document.getElementById('s4').scrollIntoView()); await p.screenshot({ path: 'lo_4.png' });
  await p.setViewportSize({ width: 375, height: 800 }); await p.reload(); console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await p.screenshot({ path: 'lo_m.png', fullPage: false });
  console.log('errors', errs); await b.close();
})();
