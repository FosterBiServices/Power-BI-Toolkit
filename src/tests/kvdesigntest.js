const { chromium } = require('playwright');
// Card designs (whole-card SVG measures), reference labels right of the value, card colors, hidden options
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/kpi-visualizer.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  const balanced = t => { let d = 0; for (const c of t.replace(/"(?:[^"]|"")*"/g, '')) { if (c === '(') d++; if (c === ')') d--; if (d < 0) return false; } return d === 0; };
  for (const id of ['dcols', 'dtarget', 'dbadge', 'dlolli', 'dfill', 'ddetail']) {
    await p.click('[data-opt="' + id + '"]');
    const tmdl = await p.locator('#tmdlView').innerText(), test = await p.locator('#testView').innerText();
    const svgOk = await p.locator('.kv-opt.on .kv-design svg').count();
    console.log(id.padEnd(8), '| preview svg', svgOk, '| Card measure', /measure 'Sales Card'/.test(tmdl), '| no holes', !/[\u0001\u0002]/.test(tmdl), '| parens', balanced(test), '| %25', tmdl.includes('"%25"'), '| trend field', await p.locator('#trendWrap').isVisible());
  }
  await p.locator('.kv-opt.on').screenshot({ path: 'kvd_detail.png' });
  await p.locator('#options').screenshot({ path: 'kvd_options.png' });
  // a KPI with no target: target designs are not shown at all
  await p.selectOption('#kpiPick', '3');
  const names = (await p.locator('#options .kv-opt h3').allInnerTexts()).join(' | ');
  console.log('Orders shows target options:', /Bullet|target bar|fill gauge|Progress/.test(names), '(expect false) | off cards', await p.locator('.kv-opt.off').count(), '| needs text', /Needs/.test(await p.locator('#options').innerText()));
  // reference labels to the right of the value
  await p.selectOption('#kpiPick', '0'); await p.click('[data-opt="cardvar"]');
  console.log('refPos shown', await p.locator('#refPosWrap').isVisible());
  await p.click('label:has(#refRight)');
  console.log('right preview', await p.locator('.kv-opt.on .kv-rr .kv-refs .kv-lab').count(), '| steps say Horizontal', (await p.locator('#steps').innerText()).includes('Arrangement to Horizontal'));
  await p.locator('.kv-opt.on').screenshot({ path: 'kvd_right.png' });
  await p.click('[data-opt="dcols"]'); console.log('refPos hidden for designs', await p.locator('#refPosWrap').isHidden());
  // card colors: change the accent and background, the script follows
  await p.locator('[data-ink="accent"]').evaluate(e => { e.value = '#5B3A8E'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.locator('[data-ink="bg"]').evaluate(e => { e.value = '#FAF7F0'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  const t2 = await p.locator('#tmdlView').innerText();
  console.log('accent in script', t2.includes('#5B3A8E'), '| bg in script', t2.includes('#FAF7F0'), '| old accent gone', !t2.includes('#118DFF'));
  await p.reload(); console.log('after reload accent', await p.locator('[data-ink="accent"]').inputValue(), '(expect #5b3a8e)');
  await p.click('#inkReset'); console.log('reset accent', await p.locator('[data-ink="accent"]').inputValue());
  // row: list card
  await p.click('label:has(#modeRow)'); await p.click('[data-opt="rlist"]');
  const t3 = await p.locator('#tmdlView').innerText();
  console.log('list card measure', t3.includes("measure 'KPI List Card'"), '| vars per KPI', /_Value4 =/.test(t3), '| parens', balanced(await p.locator('#testView').innerText()));
  await p.locator('.kv-opt.on').screenshot({ path: 'kvd_list.png' });
  await p.setViewportSize({ width: 390, height: 800 }); await p.click('label:has(#modeOne)');
  console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  console.log('errors', errs); await b.close();
})();
