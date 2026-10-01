const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext()).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/model-linter.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.locator('#depBox summary').click();
  console.log('query:', (await p.locator('#depsView').innerText()).split('\n').slice(2, 5).join(' '));
  await p.fill('#depInput', 'ObjectType\tTable\tObject\tRefType\tRefTable\tRefObject\nMEASURE\t_Measures\tMargin %\tMEASURE\t_Measures\tTotal Sales');
  console.log('msg:', await p.locator('#depMsg').innerText());
  await p.fill('#depInput', 'junk'); console.log('bad:', await p.locator('#depMsg').innerText());
  console.log('errors', errs); await b.close();
})();
