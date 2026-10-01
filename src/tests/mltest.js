const { chromium } = require('playwright'); const fs = require('fs');
const NEW = fs.readFileSync('ml_ex.tsv', 'utf8'), OLD = fs.readFileSync('ex_export.tsv', 'utf8');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1250, height: 950 } }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  const U = 'http://localhost:8765/';
  await p.goto(U + 'model-linter.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  console.log('banner', await p.locator('#exampleBanner').isVisible(), '|', await p.locator('#sumBar .sum-txt').innerText());
  console.log('rules:', (await p.locator('#rules .rule-main').allInnerTexts()).join(' | ').replace(/\n/g, ' '));
  await p.screenshot({ path: 'ml_1.png', fullPage: true });
  // ignore one, toggle rule, visible unused
  await p.locator('[data-ign]').first().click(); console.log('after ignore:', await p.locator('#sumBar .sum-txt').innerText());
  await p.check('#visibleUnused'); console.log('visible unused:', await p.locator('#sumBar .sum-txt').innerText());
  await p.uncheck('[data-rule=unused]'); console.log('unused off:', await p.locator('#sumBar .sum-txt').innerText());
  // paste old export
  await p.fill('#modelInput', OLD); console.log('old msg:', (await p.locator('#modelMsg').innerText()).slice(0, 80), '| banner', await p.locator('#exampleBanner').isVisible(), '|', await p.locator('#sumBar .sum-txt').innerText());
  await p.screenshot({ path: 'ml_2.png', fullPage: true });
  // every tool with the new-format shared export
  await p.goto(U + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.fill('#exportInput', NEW); await p.waitForTimeout(300);
  console.log('home saved:', (await p.locator('#savedStats').innerText()).replace(/\n/g, ' '), '| cards', await p.locator('#tools .tool').count());
  for (const t of ['kpi-measure-builder', 'measure-describer', 'prep-for-ai-writer', 'dax-reviewer', 'validation-query-builder', 'time-intelligence-builder', 'field-parameter-builder', 'model-documenter', 'model-linter', 'date-table-generator']) {
    const n = errs.length; await p.goto(U + t + '.html'); await p.waitForTimeout(250);
    const bar = await p.locator('.suite-bar').first().innerText().catch(() => '-');
    console.log(t, '|', bar.replace(/\n/g, ' ').slice(0, 90), '| errs', errs.length - n);
  }
  await p.goto(U + 'model-linter.html'); console.log('linter from shared:', await p.locator('#sumBar .sum-txt').innerText());
  await p.setViewportSize({ width: 375, height: 800 }); await p.reload(); console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await p.screenshot({ path: 'ml_m.png', fullPage: false });
  console.log('errors', errs); await b.close();
})();
