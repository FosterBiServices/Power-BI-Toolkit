// Save to a PBIP folder shows under every TMDL script box (with each page's example) and nowhere else.
// PARKED: skips while the feature isn't in the build (see CLAUDE.md, Parked)
if (!require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'sample-data-maker.html'), 'utf8').includes('pbipPlan')) { console.log('parked: Save to a PBIP folder is not in the build'); console.log('errors', []); process.exit(0); }
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const pg of ['time-intelligence-builder', 'field-parameter-builder', 'rls-role-generator', 'kpi-visualizer', 'date-table-generator', 'chart-patterns', 'about-this-report', 'power-query-explainer', 'model-linter', 'theme-builder']) {
    const p = await (await b.newContext()).newPage(); p.on('pageerror', e => errs.push(pg + ': ' + e.message));
    await p.goto('http://localhost:8765/' + pg + '.html'); await p.waitForTimeout(700);
    const r = await p.evaluate(() => Array.from(document.querySelectorAll('.codebox')).map(bx => ({ t: (bx.querySelector('.codebox-bar .t') || {}).textContent || '', script: /^\s*createOrReplace\s*\n/.test((bx.querySelector('pre') || {}).textContent || ''),
      btn: Array.from(bx.querySelectorAll('button')).some(x => x.textContent === 'Save to a PBIP folder' && !x.hidden) })));
    const bad = r.filter(x => x.script !== x.btn);
    console.log(pg.padEnd(26), '| scripts', r.filter(x => x.script).length, '| buttons', r.filter(x => x.btn).length, bad.length ? '| MISMATCH ' + JSON.stringify(bad) : '');
    await p.close();
  }
  console.log('errors', errs); await b.close();
})();
