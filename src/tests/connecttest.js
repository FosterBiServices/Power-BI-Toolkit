// "Connect your model" (suite.js) on every tool that reads the model: the choice comes first, a PBIP
// folder fills the model like an export, and the export box only shows for the export.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  const PAGES = ['kpi-measure-builder', 'measure-describer', 'prep-for-ai-writer', 'validation-query-builder', 'time-intelligence-builder', 'field-parameter-builder', 'rls-role-generator', 'model-linter', 'model-compare', 'about-this-report', 'kpi-visualizer', 'dax-reviewer', 'date-table-generator'];
  for (const page of PAGES) {
    await p.goto('http://localhost:8765/' + page + '.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
    const n = await p.locator('.sc-choose [data-sc]').count();
    const first = await p.evaluate(() => { const c = document.querySelector('.sc-choose'); const s = c && c.closest('.step'); return s ? s.querySelector('.step-num b').textContent + ' ' + s.querySelector('h2').textContent : 'none'; });
    const ta = await p.evaluate(() => { const c = document.querySelector('.sc-choose'); const s = c && c.closest('.step-body'); const t = s && (s.querySelector('#modelInput, #dcInput') || document.querySelector('#modelInput, #dcInput')); return t ? t.id : ''; });
    const hiddenBefore = await p.locator('#' + ta).isHidden();
    await p.click('.sc-choose [data-sc=export]'); const shownExport = await p.locator('#' + ta).isVisible();
    await p.click('.sc-choose [data-sc=pbip]');
    await p.setInputFiles('.sc-pbip input[type=file]', 'pqpbip/Contoso Sales'); await p.waitForTimeout(400);
    const val = (await p.locator('#' + ta).inputValue()).split('\n').length;
    const msg = (await p.locator('.sc-msg').innerText()).slice(0, 60);
    const hiddenPbip = await p.locator('#' + ta).isHidden();
    await p.reload(); const kept = await p.locator('.sc-choose [aria-checked=true] .tn').innerText().catch(() => '');
    console.log(page.padEnd(26), '| options', n, '| step:', first, '| box hidden before', hiddenBefore, '| export shows box', shownExport, '| pbip rows', val, '| box hidden', hiddenPbip, '| after reload', kept, '|', msg);
  }
  await p.setViewportSize({ width: 390, height: 800 });
  for (const page of ['kpi-measure-builder', 'model-linter', 'dax-reviewer', 'date-table-generator']) { await p.goto('http://localhost:8765/' + page + '.html'); console.log(page, 'mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)); }
  console.log('errors', errs); await b.close();
})();
