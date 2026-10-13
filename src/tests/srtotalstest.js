// Sheet Recon: Totals by key (group both sides, total the numbers, compare the totals).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  // Offline? Point XLSX_FILE at a local xlsx.full.min.js (0.18.5) to stand in for the CDN copy.
  if (process.env.XLSX_FILE) await p.route(/cdnjs\.cloudflare\.com.*xlsx/, r => r.fulfill({ path: process.env.XLSX_FILE, contentType: 'application/javascript' }));
  await p.goto('http://localhost:8765/sheet-recon.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1200);
  const stats = () => p.$$eval('#summary .stat .n', n => n.map(x => x.textContent).join(','));
  console.log('row by row example', await stats(), '| total with hidden', await p.$eval('#aggFnWrap', e => e.hidden));
  await p.selectOption('#o-mode', 'totals'); await p.waitForTimeout(500);
  console.log('example sheets', await p.$eval('#source-sheet', s => s.value), '/', await p.$eval('#target-sheet', s => s.value), '(expect Budget by month / Budget by year)');
  console.log('keyline', await p.textContent('#keyline'), '| roll', await p.$eval('#keyline [data-roll]', s => s.value), '(expect year)');
  console.log('totals stats', await stats(), '(expect 3,1,0,1: identical, differ, only S, only T)');
  console.log('meta', await p.textContent('#summary .meta'));
  await p.click('#tabs [data-tab="diff"]'); await p.waitForTimeout(200);
  console.log('diff cell', await p.$eval('#grid td.d', t => t.innerText.replace(/\n/g, ' | ')), '(expect Diff +4,500)');
  await p.selectOption('#o-aggFn', 'count'); await p.waitForTimeout(500);
  console.log('count stats', await stats(), '(expect 0,4,0,1: 12 months vs 1 row)');
  await p.selectOption('#o-aggFn', 'sum'); await p.selectOption('#keyline [data-roll]', ''); await p.waitForTimeout(500);
  console.log('no roll stats', await stats(), '(expect 0,0,48,5)');
  await p.selectOption('#keyline [data-roll]', 'year'); await p.waitForTimeout(500);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#exportResults')]);
  console.log('download', dl.suggestedFilename());
  await p.selectOption('#o-mode', 'rows'); await p.waitForTimeout(500);
  console.log('back to rows', await p.$eval('#source-sheet', s => s.value), await stats(), '| keyline', await p.textContent('#keyline'));
  await p.selectOption('#o-mode', 'totals'); await p.waitForTimeout(500);
  console.log('totals again keeps roll', await p.$eval('#keyline [data-roll]', s => s.value), await stats());
  // own files: months as "Jan 2026" against FY2026, one N/A
  await p.setInputFiles('#fileInput', ['sr_month.csv', 'sr_year.csv']); await p.waitForTimeout(1000);
  await p.selectOption('#o-mode', 'rows'); await p.waitForTimeout(300); await p.selectOption('#o-mode', 'totals'); await p.waitForTimeout(500);
  console.log('own files keyline', await p.textContent('#keyline'));
  // Month and Fiscal Year don't pair by name: pair them, then group by them
  const row = await p.$$eval('#mapBody tr[data-i]', rs => rs.findIndex(r => r.querySelector('[data-f="src"]').selectedOptions[0].textContent === 'Month'));
  await p.selectOption(`#mt${row}`, { label: 'Fiscal Year' }); await p.waitForTimeout(200);
  const r2 = await p.$$eval('#mapBody tr[data-i]', rs => rs.findIndex(r => r.querySelector('[data-f="src"]').selectedOptions[0].textContent === 'Month'));
  if (!(await p.isChecked(`#mk${r2}`))) await p.check(`#mk${r2}`);
  await p.waitForTimeout(300);
  const roll = await p.$('#keyline [data-roll]'); if (roll) await roll.selectOption('year'); await p.waitForTimeout(500);
  console.log('own keyline', await p.textContent('#keyline'));
  console.log('own stats', await p.evaluate(() => [...document.querySelectorAll('#summary .stat .n')].map(x => x.textContent).join(',')), '(expect 1,1,0,0: Fabrikam 800 vs 850)');
  console.log('not-number note', await p.$eval('#summary', s => (s.querySelector('.warnbox') || {}).textContent || 'none'));
  await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(200);
  console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await p.screenshot({ path: 'srtotals.png', fullPage: true });
  console.log('errors', errs); await b.close();
})();
