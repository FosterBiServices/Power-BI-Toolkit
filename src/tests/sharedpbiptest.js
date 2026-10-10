// A PBIP folder read in one tool is shared: every other model tool opens on it without connecting again
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  const U = x => 'http://localhost:8765/' + x + '.html';
  const state = async () => ({ choice: await p.locator('.sc-choose [aria-checked=true] .tn').innerText().catch(() => '-'), msg: (await p.locator('.sc-msg').innerText().catch(() => '')).slice(0, 70), rows: (await p.evaluate(() => { const t = document.querySelector('#modelInput, #dcInput'); return t ? t.value.split('\n').filter(Boolean).length : 0; })) });
  await p.goto(U('kpi-visualizer')); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.click('.sc-choose [data-sc=pbip]');
  await p.setInputFiles('.sc-pbip input[type=file]', 'pqpbip/Contoso Sales'); await p.waitForTimeout(300);
  const sh = await p.evaluate(() => { const v = SF_SUITE.get(); return v && v.source + ' ' + v.name; });
  console.log('read in KPI Visualizer:', sh, '(expect pbip Contoso Sales) |', (await p.locator('.sc-msg').innerText()).includes('Every tool uses it now'));
  for (const t of ['model-linter', 'dax-reviewer', 'kpi-measure-builder', 'date-table-generator', 'time-intelligence-builder']) {
    await p.goto(U(t)); await p.waitForTimeout(150); const s = await state();
    console.log(t.padEnd(26), s.choice, '| rows', s.rows, '|', s.msg, '(expect PBIP folder, rows > 0, Using)');
  }
  // No model stays No model
  await p.goto(U('dax-reviewer')); await p.click('.sc-choose [data-sc=none]'); await p.reload(); console.log('dax-reviewer after No model:', (await state()).choice, '(expect No model)');
  // A pasted export in one tool doesn't pull a PBIP tool off its folder
  await p.goto(U('validation-query-builder')); await p.click('.sc-choose [data-sc=export]');
  await p.fill('#modelInput', require('fs').readFileSync('ex_export.tsv', 'utf8')); await p.dispatchEvent('#modelInput', 'input');
  await p.locator('#modelInput').press('End'); await p.locator('#modelInput').type(' ');
  console.log('shared now:', await p.evaluate(() => SF_SUITE.get().source || 'export'), '(expect export)');
  await p.goto(U('model-linter')); console.log('model-linter after an export elsewhere:', (await state()).choice, '(expect PBIP folder)');
  await p.goto(U('index')); console.log('home:', (await p.locator('#connectTitle').innerText().catch(() => '')), '|', (await p.locator('#connectSub').innerText().catch(() => '')).slice(0, 60), '(expect Connected, saved: the export pasted last)');
  console.log('errors', errs); await b.close();
})();
