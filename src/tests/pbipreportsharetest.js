// A PBIP folder read in any tool also gives Model Linter, About This Report and Model Documenter its report pages
// (and Model Documenter the whole project), so none of them asks for the folder again
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  const U = x => 'http://localhost:8765/' + x + '.html';
  const fresh = async () => { await p.goto(U('index')); await p.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('sfpbi'); }); await p.reload(); };
  const rep = async () => (await p.locator('#repMsg').innerText()).replace(/\s+/g, ' ').slice(0, 70);
  const choice = async () => p.locator('.sc-choose [aria-checked=true] .tn').innerText().catch(() => '-');

  // read in a tool that doesn't use report pages
  await fresh(); await p.goto(U('kpi-measure-builder'));
  await p.click('.sc-choose [data-sc=pbip]');
  await p.setInputFiles('.sc-pbip input[type=file]', 'pbiptest/Retail Sales'); await p.waitForTimeout(600);
  console.log('read in KPI Measure Builder:', (await p.locator('.sc-msg').innerText()).slice(0, 45));

  await p.goto(U('model-linter')); await p.waitForTimeout(600);
  console.log('linter:', await choice(), '| report pages:', await rep(), '(expect PBIP folder, Retail Sales: 1 page)');
  await p.reload(); await p.waitForTimeout(600);
  console.log('linter reload:', await rep());
  await p.click('#clearReport'); await p.reload(); await p.waitForTimeout(600);
  console.log('linter after Remove + reload:', JSON.stringify(await rep()), '(expect "")');

  await p.goto(U('about-this-report')); await p.waitForTimeout(600);
  console.log('about:', await choice(), '| report pages:', await rep(), '(expect Retail Sales: 1 page)');

  await p.goto(U('model-documenter')); await p.waitForTimeout(600);
  const md = async () => (await p.locator('#folderMsg').innerText()).split('\n')[0] + ' | folder tab ' + await p.locator('#tabFolder').getAttribute('aria-selected');
  console.log('documenter:', await md(), '(expect 5 tables, 1 report pages, folder tab true)');
  await p.reload(); await p.waitForTimeout(600);
  console.log('documenter reload:', await md());
  await p.click('#tabExport'); await p.reload(); await p.waitForTimeout(600);
  console.log('documenter left on Export:', await p.locator('#tabExport').getAttribute('aria-selected'), '(expect true)');
  await p.click('#tabFolder'); await p.waitForTimeout(200);
  await p.click('#clearEntries'); await p.click('#clearYes'); await p.reload(); await p.waitForTimeout(600);
  console.log('documenter after Clear entries:', JSON.stringify((await p.locator('#folderMsg').innerText()).slice(0, 40)), '(expect no folder read)');

  // read in Model Documenter: every other tool gets the model, and the report tools the pages
  await fresh(); await p.goto(U('model-documenter'));
  await p.setInputFiles('#folderInput', 'pbiptest/Retail Sales'); await p.waitForTimeout(800);
  console.log('read in documenter:', (await p.locator('#folderMsg').innerText()).split('\n')[0]);
  await p.goto(U('model-linter')); await p.waitForTimeout(600);
  console.log('linter:', await choice(), '| model rows', (await p.locator('#modelInput').inputValue()).split('\n').length, '| report pages:', await rep());
  await p.goto(U('measure-describer')); await p.waitForTimeout(400);
  console.log('measure describer:', await choice(), '| has Total Sales', (await p.locator('#modelInput').inputValue()).includes('Total Sales'));

  // a different folder replaces the report pages from the first one
  await p.goto(U('validation-query-builder')); await p.click('.sc-choose [data-sc=pbip]');
  await p.setInputFiles('.sc-pbip input[type=file]', 'pqpbip/Contoso Sales'); await p.waitForTimeout(600);
  await p.goto(U('about-this-report')); await p.waitForTimeout(600);
  console.log('about after another folder:', await rep(), '(expect Contoso Sales)');
  // the folder picker (Chrome, Edge) reads the .Report folder too: a stand-in picker with the same files
  const fs = require('fs'), path = require('path'), tree = {};
  const walk = (d, o) => { for (const n of fs.readdirSync(d)) { const f = path.join(d, n); if (fs.statSync(f).isDirectory()) walk(f, o[n] = {}); else o[n] = fs.readFileSync(f, 'utf8'); } };
  walk('pbiptest/Retail Sales', tree);
  await fresh(); await p.goto(U('model-linter'));
  await p.evaluate(t => {
    const dir = (name, o) => ({ kind: 'directory', name, async *entries(){ for (const [k, v] of Object.entries(o)) yield [k, typeof v === 'string' ? { kind: 'file', name: k, getFile: async () => new File([v], k) } : dir(k, v)]; } });
    window.showDirectoryPicker = async () => dir('Retail Sales', t);
  }, tree);
  await p.click('.sc-choose [data-sc=pbip]'); await p.click('[data-sc-pick]'); await p.waitForTimeout(800);
  console.log('folder picker:', (await p.locator('.sc-msg').innerText()).slice(0, 40), '| report pages:', await rep(), '(expect Retail Sales: 1 page)');
  console.log('errors', errs); await b.close();
})();
