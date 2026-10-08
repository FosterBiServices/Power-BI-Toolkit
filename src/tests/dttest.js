const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 950 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/date-table-generator.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  // Is DST is off by default
  console.log('dst off by default:', !(await p.locator('#outView').innerText()).includes('Is DST'), '(expect true)');
  // changeover days, US and UK/EU, with the pre-2007 US rule
  const cases = await p.evaluate(() => [
    ['us', '2026-03-07'], ['us', '2026-03-08'], ['us', '2026-10-31'], ['us', '2026-11-01'],
    ['us', '2006-04-01'], ['us', '2006-04-02'], ['us', '2006-10-28'], ['us', '2006-10-29'],
    ['eu', '2026-03-28'], ['eu', '2026-03-29'], ['eu', '2026-10-24'], ['eu', '2026-10-25'], ['eu', '2026-01-15']
  ].map(([r, d]) => r + ' ' + d + ' ' + isDst(new Date(d + 'T00:00:00Z'), r)).join(' | '));
  console.log('cases:', cases);
  console.log('(expect us: F T T F, 2006: F T T F; eu: F T T F F)');
  await p.locator('[data-col=isDST]').check();
  const dax = await p.locator('#outView').innerText();
  console.log('dax:', dax.split('\n').filter(l => /dst|DST/.test(l)).map(l => l.trim()).join('\n     '));
  await p.locator('input[name=lang][value=m]').check({ force: true });
  const m = await p.locator('#outView').innerText();
  console.log('m:', m.split('\n').filter(l => /dst|DST|weekend =|hol =/.test(l)).map(l => l.trim()).join('\n   '));
  await p.selectOption('#dstRegion', 'eu');
  const m2 = await p.locator('#outView').innerText();
  console.log('eu m:', m2.split('\n').filter(l => /dstStart =|dstEnd =/.test(l)).map(l => l.trim()).join(' | '));
  // preview around the US start Sunday
  await p.selectOption('#dstRegion', 'us');
  await p.fill('#previewFrom', '2026-03-06'); await p.locator('#previewFrom').dispatchEvent('change');
  const hdr = await p.locator('#prevHead th').allTextContents(); const ci = hdr.indexOf('Is DST');
  const vals = await p.locator('#prevBody tr').evaluateAll((rs, ci) => rs.map(r => r.children[0].textContent.slice(0, 10) + '=' + r.children[ci].textContent), ci);
  console.log('preview:', vals.join(' '), '(expect TRUE from 2026-03-08)');
  await p.screenshot({ path: 'dt_dst.png', fullPage: true });
  await p.evaluate(() => localStorage.clear()); await p.setViewportSize({ width: 390, height: 800 }); await p.reload();
  console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), '(expect false)');
  console.log('errors', errs); await b.close();
})();
