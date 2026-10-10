// A PBIP folder chosen in Connect your model also brings its report pages (Model Linter, About This Report)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  const U = x => 'http://localhost:8765/' + x + '.html';
  for (const t of ['model-linter', 'about-this-report']) {
    await p.goto(U(t)); await p.evaluate(() => localStorage.clear()); await p.reload();
    await p.click('.sc-choose [data-sc=pbip]');
    await p.setInputFiles('.sc-pbip input[type=file]', 'pqpbip/Contoso Sales'); await p.waitForTimeout(600);
    console.log(t.padEnd(18), 'connect:', (await p.locator('.sc-msg').innerText()).slice(0, 50), '| report pages:', (await p.locator('#repMsg').innerText()).replace(/\s+/g, ' ').slice(0, 90), '(expect the report read, no second pick)');
  }
  // other tools still read only the model files
  await p.goto(U('dax-reviewer')); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.click('.sc-choose [data-sc=pbip]');
  await p.setInputFiles('.sc-pbip input[type=file]', 'pqpbip/Contoso Sales'); await p.waitForTimeout(400);
  console.log('dax-reviewer connect:', (await p.locator('.sc-msg').innerText()).slice(0, 50));
  console.log('errors', errs); await b.close();
})();
