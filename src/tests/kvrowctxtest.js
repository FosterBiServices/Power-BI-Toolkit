// KPI Visualizer: context lines show on the row card strips (preview, TMDL and build steps), not only on one KPI.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/kpi-visualizer.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.click('#clearAll'); const ok = p.locator('text=Clear this page'); if (await ok.count()) await ok.first().click();
  await p.click('#addKpi'); await p.fill('#k0_measure', 'Total Sales'); await p.fill('#k0_label', 'Total Sales');
  await p.selectOption('#k0_intent', 'context'); await p.click('[data-act=addctx]'); await p.fill('#k0_ctx0ref', "'Product'[Category]");
  await p.check('#modeRow', { force: true }); await p.fill('#homeTable', '_Measures');
  for (const id of ['rcards', 'rspark', 'rbullet']) {
    const btn = p.locator('[data-opt="' + id + '"]'); if (!(await btn.count())) { console.log(id, 'not offered'); continue; }
    await btn.click();
    console.log(id.padEnd(7), '| preview', (await p.locator('.kv-opt.on .kv-ctx').allInnerTexts()).join(' / '), '(expect 18% of total)',
      '| tmdl', (await p.locator('#tmdlView').innerText()).includes("measure 'Total Sales Context 1'"), '| steps', (await p.locator('#steps').innerText()).includes('Total Sales Context 1'), '(expect true true)');
  }
  console.log('label position offered:', await p.locator('.kv-opt.on [data-refpos]').count(), '(expect 2)');
  console.log('errors', errs); await b.close();
})();
