// A PBIP folder connected on the home page is used by every tool: model tools, report pages, Power Query Explainer and Theme Builder
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path');
(async () => {
  // a project with Contoso Sales' model and Theme Sample's report (theme files in StaticResources)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'homepbip-')), root = path.join(dir, 'Contoso Sales');
  fs.cpSync('pqpbip/Contoso Sales/Contoso Sales.SemanticModel', path.join(root, 'Contoso Sales.SemanticModel'), { recursive: true });
  fs.cpSync('tbpbip/Theme Sample.Report', path.join(root, 'Contoso Sales.Report'), { recursive: true });
  fs.copyFileSync('pqpbip/Contoso Sales/Contoso Sales.pbip', path.join(root, 'Contoso Sales.pbip'));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  const U = x => 'http://localhost:8765/' + x + '.html';
  await p.goto(U('index')); await p.evaluate(() => localStorage.clear()); await p.reload();
  console.log('home opens:', await p.locator('#connectBox').evaluate(d => d.open), '| panes hidden:', await p.locator('#homePbip').isHidden(), await p.locator('#homeExport').isHidden(), '(expect true | true true)');
  await p.click('#homeChoose [data-hc=pbip]');
  await p.setInputFiles('#homeFolder', root); await p.waitForTimeout(500);
  console.log('read:', (await p.locator('#homePbipMsg').innerText()).slice(0, 80), '(expect Read Contoso Sales)');
  console.log('shared:', await p.evaluate(() => { const v = SF_SUITE.get(); return v && v.source + ' ' + v.name; }), '(expect pbip Contoso Sales)');
  console.log('status:', await p.locator('#connectTitle').innerText(), '|', await p.locator('#savedTitle').innerText(), '|', await p.locator('#clearSaved').innerText());
  await p.screenshot({ path: 'homepbip.png', fullPage: false });
  await p.reload(); await p.click('#connectBox > summary'); console.log('after reload pane:', await p.locator('#homePbip').isVisible(), '(expect true)');
  // model tools open on it
  for (const t of ['kpi-measure-builder', 'model-linter', 'dax-reviewer', 'chart-patterns']) {
    await p.goto(U(t)); await p.waitForTimeout(250);
    const c = await p.locator('.sc-choose [aria-checked=true] .tn').innerText().catch(() => '-');
    const rows = await p.evaluate(() => (document.getElementById('modelInput') || { value: '' }).value.split('\n').filter(Boolean).length);
    const rep = t === 'model-linter' ? ' | report: ' + (await p.locator('#repMsg').innerText().catch(() => '')).slice(0, 60) : '';
    console.log(t.padEnd(22), c, '| rows', rows, '(expect PBIP folder, rows > 0)' + rep);
  }
  // Power Query Explainer: one click
  await p.goto(U('power-query-explainer')); await p.waitForTimeout(250);
  console.log('PQE button:', await p.locator('#useSharedPbip').textContent(), '(expect Use Contoso Sales)');
  await p.click('#modeModelBtn').catch(() => {}); await p.click('#useSharedPbip'); await p.waitForTimeout(400);
  console.log('PQE read:', (await p.locator('#pbipMsg').innerText()).slice(0, 90));
  // Theme Builder: the theme and visuals, from the stored files (StaticResources kept for it)
  await p.goto(U('theme-builder')); await p.waitForTimeout(250);
  console.log('TB buttons:', await p.locator('#useSharedTheme').textContent(), '|', await p.locator('#useSharedReport').isHidden() === false, '(expect Use Contoso Sales | true)');
  await p.locator('#themeBox summary').click(); await p.click('#useSharedTheme'); await p.waitForTimeout(400);
  console.log('TB theme ask:', (await p.locator('#themeAsk1').innerText()).slice(0, 100).replace(/\n/g, ' '), '| step1 msg:', (await p.locator('#themeMsg').innerText()).slice(0, 80));
  // Disconnect on the home page
  await p.goto(U('index')); await p.click('#connectBox > summary'); await p.click('#clearSaved');
  console.log('after disconnect:', await p.evaluate(() => SF_SUITE.get()), '|', await p.locator('#homePbipMsg').innerText());
  // export choice still works
  await p.click('#homeChoose [data-hc=export]');
  await p.fill('#exportInput', fs.readFileSync('ex_export.tsv', 'utf8')); await p.dispatchEvent('#exportInput', 'input');
  console.log('export saved:', await p.evaluate(() => { const v = SF_SUITE.get(); return v && (v.source || 'export'); }), '|', await p.locator('#savedTitle').innerText());
  // phone width: no horizontal scroll
  await p.setViewportSize({ width: 390, height: 800 }); await p.click('#homeChoose [data-hc=pbip]');
  console.log('390px scroll:', await p.evaluate(() => document.documentElement.scrollWidth), '(expect 390)');
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('errors', errs); await b.close();
})();
