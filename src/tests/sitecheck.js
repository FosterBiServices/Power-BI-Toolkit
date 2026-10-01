const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(p.url() + ': ' + e.message));
 for (const f of ['index','kpi-measure-builder','measure-describer','prep-for-ai-writer','dax-reviewer','validation-query-builder','model-documenter','power-query-explainer','date-table-generator']) {
   await p.goto('http://localhost:8765/' + f + '.html'); await p.waitForTimeout(200);
   const opts = await p.locator('#suiteSwitch option').count(); console.log(f, 'switch options:', opts, f === 'index' ? '| cards: ' + await p.locator('.tool').count() : '');
 }
 console.log('errors', errs); await b.close(); })();
