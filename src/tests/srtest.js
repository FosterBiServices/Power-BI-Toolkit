// Sheet Recon: column search and filter, N/A against blank, Clear entries.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  // Offline? Point XLSX_FILE at a local xlsx.full.min.js (0.18.5) to stand in for the CDN copy.
  if (process.env.XLSX_FILE) await p.route(/cdnjs\.cloudflare\.com.*xlsx/, r => r.fulfill({ path: process.env.XLSX_FILE, contentType: 'application/javascript' }));
  await p.goto('http://localhost:8765/sheet-recon.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1200);
  const vis = () => p.$$eval('#mapBody tr[data-i]', r => r.filter(x => !x.hidden).length);
  console.log('example rows', await vis(), '(expect 7)');
  await p.fill('#mapSearch', 'date'); console.log('search "date"', await vis(), '(expect 1)', await p.textContent('#mapCount'));
  await p.fill('#mapSearch', 'zzz'); console.log('no match row', await p.$eval('#mapBody', t => !!t.querySelector('tr.nomatch')));
  await p.click('[data-clearfilter]'); console.log('cleared', await vis());
  await p.setInputFiles('#fileInput', ['sr_a.csv', 'sr_b.csv']); await p.waitForTimeout(1000);
  const stats = () => p.$$eval('#summary .stat .n', n => n.map(x => x.textContent).join(','));
  console.log('stats', await stats(), '(expect 0,4,0,0)', '| N/A note', await p.$eval('#summary', s => !!s.querySelector('.infobox')));
  await p.click('[data-na-on]'); await p.waitForTimeout(400); console.log('after N/A as blank', await stats(), '(expect 3,1,0,0)');
  await p.click('#clearEntries'); await p.click('#clearYes'); await p.waitForTimeout(300);
  console.log('after clear: files', await p.$$eval('#fileList [data-remove]', x => x.length), '| N/A option reset', !(await p.isChecked('#o-naBlank')));
  await p.reload(); await p.waitForTimeout(1000); console.log('reload stays empty', await p.$$eval('#fileList [data-remove]', x => x.length) === 0);
  await p.setViewportSize({ width: 390, height: 800 }); console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  console.log('errors', errs); await b.close();
})();
