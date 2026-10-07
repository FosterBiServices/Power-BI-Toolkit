// KPI Visualizer: every option gets step-by-step setup in Power BI, with no blank or broken names.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/kpi-visualizer.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  const show = async id => {
    const btn = p.locator('[data-opt="' + id + '"]'); if (!(await btn.count())) return console.log(id.padEnd(9), 'not offered');
    await btn.click();
    const groups = await p.locator('#steps .kv-grp').evaluateAll(gs => gs.map(g => g.querySelector('h4').textContent + ' ' + g.querySelectorAll(':scope > ol > li').length));
    const text = await p.locator('#steps').innerText();
    const bad = /undefined|NaN|\[\]|null/.test(text);
    console.log(id.padEnd(9), '|', groups.join(' / '), '| broken text', bad, '| heading shown', await p.locator('#setupHead').isVisible());
  };
  await p.selectOption('#kpiPick', '0');
  for (const id of ['bullet', 'cardvar', 'spark', 'varbar', 'progress', 'slope', 'kpi', 'core', 'card', 'gauge']) await show(id);
  await p.selectOption('#kpiPick', '1'); await show('waffle');
  await p.click('label:has(#modeRow)');
  for (const id of ['rcards', 'rspark', 'rbullet', 'rtable']) await show(id);
  await p.click('[data-opt="rspark"]'); await p.locator('#setupHead').scrollIntoViewIfNeeded(); await p.screenshot({ path: 'kv_setup.png' });
  await p.setViewportSize({ width: 390, height: 800 }); console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  console.log('errors', errs); await b.close();
})();
