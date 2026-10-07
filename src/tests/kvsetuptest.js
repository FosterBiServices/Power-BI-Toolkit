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
  console.log('html: measure', tm.includes("'Sales HTML Card'"), '| fill in script', tm.includes('Status Fill'), '| file box', await p.locator('#htmlBox').isVisible(), '| file has pill', (await p.locator('#htmlView').innerText()).includes('border-radius:'));
  // Every layout preview must fit its frame (no clipped text), at several sizes
  const fits = async tag => { const r = await p.$$eval('.kv-fitfig', fs => fs.map(f => { const fr = f.querySelector('.kv-fitframe'), c = fr.firstElementChild; return f.dataset.hlay + ' ' + fr.style.width + 'x' + fr.style.height + (c.scrollWidth <= fr.clientWidth && c.offsetHeight <= fr.clientHeight - 8 + 1 && c.scrollWidth <= c.clientWidth + 1 ? ' fits' : ' CLIPPED ' + c.scrollWidth + 'x' + c.offsetHeight); })); console.log('html ' + tag + ':', r.join(' | '), '|', await p.locator('#htmlFit .msg').innerText()); };
  console.log('html size: inputs', await p.locator('#htmlW').isVisible(), '| fills width', tm.includes('width:100%'), '| size step', (await p.locator('#steps').innerText()).includes('Size it'));
  await fits('320x200');
  for (const [w, h] of [['600', '160'], ['470', '90'], ['200', '300'], ['900', '500'], ['120', '60']]) { await p.fill('#htmlW', w); await p.fill('#htmlH', h); await fits(w + 'x' + h); }
  console.log('html 120x60: script built for min', (await p.locator('#tmdlView').innerText()).includes('Built for a visual') , '| steps', (await p.locator('#steps').innerText()).match(/set the width to \d+ and the height to \d+/)?.[0]);
  await p.fill('#htmlW', '600'); await p.fill('#htmlH', '160'); await p.click('.kv-fitfig[data-hlay="grid"]');
  const tg = await p.locator('#tmdlView').innerText();
  console.log('grid picked: script grid', tg.includes('grid-template-columns'), '| figure on', await p.locator('.kv-fitfig.on').getAttribute('data-hlay'), '(expect true grid)');
  await p.locator('#htmlFit').screenshot({ path: 'kv_htmlfit.png' });
  await p.setViewportSize({ width: 390, height: 900 }); console.log('html fit mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)); await p.locator('#htmlFit').screenshot({ path: 'kv_htmlfit_m.png' }); await p.setViewportSize({ width: 1280, height: 900 });
  await p.reload(); await p.click('[data-opt="html"]').catch(() => {}); console.log('kept after reload', await p.inputValue('#htmlW'), await p.inputValue('#htmlH'), await p.locator('.kv-fitfig.on').getAttribute('data-hlay'), '(expect 600 160 grid)');
  console.log(tg.slice(tg.indexOf("measure 'Sales HTML Card'")).split('\n').slice(0, 45).join('\n'));
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
