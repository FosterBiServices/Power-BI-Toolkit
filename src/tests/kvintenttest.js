// KPI Visualizer: suggestions start from what the reader should get, and context lines work without a target.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/kpi-visualizer.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  const heads = async () => (await p.locator('#options .kv-grouphead h3').allInnerTexts()).join(' | ');
  const first = async () => (await p.locator('#options .kv-opt h3').allInnerTexts()).slice(0, 4).join(', ');
  console.log('Sales intent:', await p.locator('#k0_intent').inputValue(), '(expect goal) | heads:', await heads());
  await p.selectOption('#kpiPick', '3');
  console.log('Orders intent:', await p.locator('#k3_intent').inputValue(), '(expect context) | heads:', await heads(), '| first:', await first());
  console.log('chosen:', await p.locator('#buildName').innerText(), '| preview ctx:', (await p.locator('.kv-opt.on .kv-ctx').allInnerTexts()).join(' / '));
  const tm = await p.locator('#tmdlView').innerText();
  console.log('tmdl: Context 1', tm.includes("'Orders Context 1'"), '| Context 2', tm.includes("'Orders Context 2'"), '| DISTINCTCOUNT', tm.includes("DISTINCTCOUNT ( 'Customer'[Customer Key] )"), '| no status', !tm.includes('Status'));
  console.log(tm.slice(tm.indexOf("measure 'Orders Context 2'")).split('\n').slice(0, 5).join('\n'));
  for (const id of ['ctxsub', 'ctxtip', 'html', 'cardvar']) {
    const btn = p.locator('[data-opt="' + id + '"]'); if (!(await btn.count())) { console.log(id, 'not offered'); continue; }
    await btn.click();
    const groups = await p.locator('#steps .kv-grp').evaluateAll(gs => gs.map(g => g.querySelector('h4').textContent + ' ' + g.querySelectorAll(':scope > ol > li').length));
    const t = await p.locator('#steps').innerText();
    console.log(id.padEnd(8), '|', groups.join(' / '), '| mentions Context 1', t.includes('Orders Context 1'), '| broken', /undefined|NaN|null/.test(t));
  }
  await p.click('[data-opt="ctxtip"]'); await p.locator('.kv-opt.on').screenshot({ path: 'kv_ctxtip.png' });
  await p.click('[data-opt="ctxsub"]'); await p.locator('.kv-opt.on').screenshot({ path: 'kv_ctxsub.png' });
  // own KPI with no target: context purpose, then add a context line
  await p.click('#clearAll'); await p.click('#addKpi');
  await p.fill('#k0_measure', 'Customer Count'); await p.fill('#k0_label', 'Customers');
  console.log('own intent:', await p.locator('#k0_intent').inputValue(), '(expect number) | target field shown', await p.locator('#k0_target').count(), '(expect 0) | first:', await first());
  await p.selectOption('#k0_intent', 'context');
  console.log('context, no lines: heads', await heads());
  await p.click('[data-act=addctx]');
  console.log('added kind:', await p.locator('#k0_ctx0kind').inputValue(), '(expect share)');
  await p.fill('#k0_ctx0ref', "'Region'[Region]"); await p.selectOption('#k0_ctx0kind', 'rank');
  console.log('rank kept column:', await p.locator('#k0_ctx0ref').inputValue(), '(expect kept: both use a column)');
  await p.fill('#homeTable', '_Measures');
  console.log('first after line:', await first(), '| preview', (await p.locator('.kv-opt.on .kv-ctx').allInnerTexts()).join(' / '));
  const tm2 = await p.locator('#tmdlView').innerText();
  console.log('rank DAX:', tm2.includes("RANKX ( ALL ( 'Region'[Region] )"), '| HASONEVALUE', tm2.includes('HASONEVALUE'));
  await p.selectOption('#k0_intent', 'goal'); console.log('goal shows target field', await p.locator('#k0_target').count(), '| heads', await heads());
  await p.reload(); console.log('after reload ctx kind', await p.locator('#k0_ctx0kind').inputValue(), '| intent', await p.locator('#k0_intent').inputValue());
  await p.setViewportSize({ width: 390, height: 800 }); console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await p.locator('#kpis').screenshot({ path: 'kv_ctxed_m.png' });
  console.log('errors', errs); await b.close();
})();
