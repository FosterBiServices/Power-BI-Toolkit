const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1250, height: 950 } })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/model-linter.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  console.log('before:', await p.locator('#sumBar .sum-txt').innerText());
  await p.setInputFiles('#repInput', 'pbiptest/Sales Overview');
  await p.waitForTimeout(500);
  console.log('rep:', await p.locator('#repMsg').innerText());
  console.log('after:', await p.locator('#sumBar .sum-txt').innerText(), '| banner', await p.locator('#exampleBanner').isVisible());
  console.log((await p.locator('[data-grp=unused]').innerText()).replace(/\n+/g, ' | '));
  await p.locator('#repBox').scrollIntoViewIfNeeded(); await p.screenshot({ path: 'mlrep.png' });
  await p.reload(); console.log('after reload:', (await p.locator('#repMsg').innerText()).slice(0, 60));
  await p.click('#clearReport'); console.log('removed:', await p.locator('#sumBar .sum-txt').innerText(), '| subopt checkbox back', await p.locator('#visibleUnused').count());
  console.log('errors', errs); await b.close();
})();
