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
  for (const id of ['html', 'bullet', 'cardvar', 'spark', 'varbar', 'progress', 'slope', 'kpi', 'core', 'card', 'gauge']) await show(id);
  await p.click('[data-opt="html"]');
  const tm = await p.locator('#tmdlView').innerText();
  console.log('html: measure', tm.includes("'Sales HTML Card'"), '| fill in script', tm.includes('Status Fill'), '| file box', await p.locator('#htmlBox').isVisible(), '| file has pill', (await p.locator('#htmlView').innerText()).includes('border-radius:6px'));
  console.log('html size: field', await p.locator('#htmlSize').isVisible(), '| medium value 48px', tm.includes('font-size:48px'), '| fills width', tm.includes('width:100%'), '| size step', (await p.locator('#steps').innerText()).includes('Size it'));
  await p.selectOption('#htmlSize', 'XL'); const tx = await p.locator('#tmdlView').innerText();
  console.log('html XL: value 96px', tx.includes('font-size:96px'), '| file 96px', (await p.locator('#htmlView').innerText()).includes('font-size:96px'), '| step says 720', (await p.locator('#steps').innerText()).includes('720'), '(expect all true)');
  await p.reload(); console.log('html size kept after reload', await p.inputValue('#htmlSize'), '(expect XL)'); await p.click('[data-opt="html"]').catch(() => {});
  console.log(tm.slice(tm.indexOf("measure 'Sales HTML Card'")).split('\n').slice(0, 16).join('\n'));
  await p.locator('.kv-opt.on').scrollIntoViewIfNeeded(); await p.locator('.kv-opt.on').screenshot({ path: 'kv_html.png' });
  await p.click('[data-opt="cardvar"]');
  console.log('cardvar: fill in script', (await p.locator('#tmdlView').innerText()).includes('Status Fill'), '(expect false) | label bg', await p.locator('.kv-opt.on .kv-lab').first().evaluate(e => getComputedStyle(e).backgroundColor), '(expect transparent)');
  await p.locator('.kv-opt.on').screenshot({ path: 'kv_cardvar.png' });
  await p.selectOption('#kpiPick', '1'); await show('waffle');
  await p.click('label:has(#modeRow)');
  for (const id of ['rcards', 'rspark', 'rbullet', 'rtable']) await show(id);
  await p.click('[data-opt="rspark"]'); await p.locator('#setupHead').scrollIntoViewIfNeeded(); await p.screenshot({ path: 'kv_setup.png' });
  await p.setViewportSize({ width: 390, height: 800 }); console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  console.log('errors', errs); await b.close();
})();
