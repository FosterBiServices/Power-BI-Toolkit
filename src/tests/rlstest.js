const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1250, height: 950 } })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); const U = 'http://localhost:8765/rls-role-generator.html';
  await p.goto(U); await p.evaluate(() => localStorage.clear()); await p.reload();
  console.log('banner', await p.locator('#exampleBanner').isVisible(), '| roles', await p.locator('.role').count(), '| out', await p.locator('#outBox').isVisible());
  console.log('reach0:', (await p.locator('#reach0').innerText()).replace(/\n/g, ' '));
  console.log('chk0:', await p.locator('#rchk0').innerText());
  console.log('suite/ai/footer', await p.locator('.suite-bar').count(), await p.locator('#suiteDisc').count(), 'query upgraded', (await p.locator('#exportView').textContent()).includes('INFO.LEVELS'));
  await p.screenshot({ path: 'rls_1.png', fullPage: true });
  // typing keeps focus
  const n = p.locator('#rn0'); await n.click(); await n.pressSequentially(' X'); console.log('focus kept', await p.evaluate(() => document.activeElement.id), '| tmdl has', (await p.locator('#tmdlView').textContent()).includes("role 'West Region X'"));
  // add values rule with bad column
  await p.click('[data-add="2:values"]'); await p.fill('[data-rule="2:0"] [data-f=table]', 'Date'); await p.locator('[data-rule="2:0"] [data-f=table]').dispatchEvent('change');
  console.log('focused after table change:', await p.evaluate(() => document.activeElement.dataset.f), '| col list', await p.locator('[data-rule="2:0"] [data-f=column]').getAttribute('list'));
  await p.fill('[data-rule="2:0"] [data-f=column]', 'Year'); await p.fill('[data-rule="2:0"] [data-f=values]', '2025\nabc');
  console.log('err:', await p.locator('#rchk2').innerText(), '| out hidden', await p.locator('#outBox').isHidden());
  await p.fill('[data-rule="2:0"] [data-f=values]', '2025'); console.log('fixed, out', await p.locator('#outBox').isVisible());
  await p.fill('#testUser', 'bo@contoso.com'); console.log('test user in query', (await p.locator('#testView').textContent()).includes('"bo@contoso.com"'));
  await p.click('[data-rmrule="2:0"]'); await p.click('#addRole'); console.log('roles', await p.locator('.role').count(), '| focus', await p.evaluate(() => document.activeElement.id));
  console.log(await p.locator('#outMsg').innerText());
  await p.setViewportSize({ width: 375, height: 800 }); await p.reload(); console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await p.screenshot({ path: 'rls_m.png', fullPage: true });
  await p.goto('http://localhost:8765/index.html'); console.log('home cards', await p.locator('#tools .tool').count());
  console.log('errors', errs); await b.close();
})();
