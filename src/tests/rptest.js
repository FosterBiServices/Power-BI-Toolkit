// Relationship Planner: the example (a Region table linked twice, a bridge that leaks), tested fixes,
// the plan for a new shared table, goals kept over a model change, Clear entries, and 390px wide.
const { chromium } = require('playwright'); const fs = require('fs');
const OLD = fs.readFileSync('ex_export.tsv', 'utf8');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1250, height: 950 } }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  const U = 'http://localhost:8765/relationship-planner.html';
  const txt = async sel => (await p.locator(sel).first().innerText()).replace(/\s+/g, ' ').trim();
  const goals = async () => (await p.locator('#goalResults .goal').evaluateAll(gs => gs.map(g => (g.classList.contains('pass') ? 'OK ' : g.classList.contains('fail') ? 'FAIL ' : '? ') + g.querySelector('.gl').innerText.replace(/\s+/g, ' ')))).join(' | ');
  await p.goto(U); await p.evaluate(() => localStorage.clear()); await p.reload();
  console.log('banner', await p.locator('#exampleBanner').isVisible(), '| changes', await p.locator('.chlist li').count(), '(expect true | 2)');
  console.log('health:', await txt('.healthbar'), '(expect 1 ambiguous route)');
  console.log('flow:', await txt('.flowsum'));
  console.log('goals:', await goals());
  console.log('  (expect FAIL No ambiguous, FAIL Region fact tables, OK Date, OK Product, FAIL Promotion)');
  await p.screenshot({ path: 'rp_1.png', fullPage: true });
  // the ambiguous route into Sales: open it, take the best fix
  const sales = p.locator('details.adv[data-item="Sales"]');
  await sales.locator('summary').click(); await p.waitForTimeout(150);
  console.log('advice Sales:', (await sales.locator('.adv-body').innerText()).replace(/\s+/g, ' ').slice(0, 260));
  await sales.locator('[data-usefix="0"]').click(); await p.waitForTimeout(150);
  console.log('after fix: changes', await p.locator('.chlist li').count(), '| health', await txt('.healthbar'), '(expect 1 change, 0 ambiguous)');
  // Budget isn't reached: the advice should relate Region to Budget directly
  const bud = p.locator('details.adv[data-goal="0"][data-item="Budget"]');
  await bud.locator('summary').click(); await p.waitForTimeout(150);
  const bt = (await bud.locator('.adv-body').innerText()).replace(/\s+/g, ' ');
  console.log('advice Budget mentions direct link', /Add Region\[Region\] → Budget\[Region\]/.test(bt), '| warns about going through Sales', /rarely what you want/.test(bt));
  await bud.locator('[data-usefix="0"]').click(); await p.waitForTimeout(150);
  console.log('goals now:', await goals());
  console.log('effect:', (await txt('#changeEffect')).slice(0, 200));
  console.log('desktop steps', await p.locator('#desktopSteps li').count());
  // plan a new shared table
  await p.locator('#planBox > summary').click();
  await p.fill('#plTable', 'Territory'); await p.fill('#plKey', 'TerritoryKey'); await p.waitForTimeout(500);
  console.log('plan:', (await txt('.planhead p')).slice(0, 160));
  console.log('plan rows:', (await p.locator('table.plan tbody tr').evaluateAll(rs => rs.map(r => r.cells[0].innerText + ':' + r.cells[1].innerText.split(' ')[0]))).join(', '));
  await p.click('#planUse'); await p.waitForTimeout(150);
  console.log('changes after plan', await p.locator('.chlist li').count());
  await p.fill('#goalInput', 'Territory should filter every table\nBudget should not be filtered by Promotion\nRegion filters Customer\nSomething filters Sales\nno ambiguity');
  await p.waitForTimeout(400);
  console.log('goals plan:', await goals());
  await p.screenshot({ path: 'rp_2.png', fullPage: true });
  // quick add
  await p.selectOption('#qFrom', 'Date'); await p.selectOption('#qTo', 'every fact table'); await p.click('#qAdd'); await p.waitForTimeout(300);
  console.log('quick add last line:', (await p.inputValue('#goalInput')).split('\n').pop());
  // reload keeps it (the example was left when a change was made? no: example stays until own model)
  // own model: goals typed stay, example changes go
  await p.reload(); await p.fill('#goalInput', 'Customer should filter Sales'); await p.waitForTimeout(300);
  await p.click('.sc-choose [data-sc=export]').catch(() => {});
  await p.fill('#modelInput', OLD); await p.waitForTimeout(300);
  console.log('own model: banner', await p.locator('#exampleBanner').isVisible(), '| changes', await p.locator('.chlist li').count(), '| goals text', JSON.stringify(await p.inputValue('#goalInput')), '| results', await goals());
  await p.reload(); await p.waitForTimeout(200);
  console.log('after reload: goals text', JSON.stringify(await p.inputValue('#goalInput')), '| flow', await txt('.flowsum'));
  // Clear entries stays empty on reload
  await p.click('#clearEntries'); await p.click('#clearYes'); await p.reload(); await p.waitForTimeout(200);
  console.log('cleared: banner', await p.locator('#exampleBanner').isVisible(), '| model', JSON.stringify(await p.inputValue('#modelInput')), '| goals', await txt('#goalResults'));
  // 390px with the example and an advice box open
  await p.evaluate(() => localStorage.clear()); await p.setViewportSize({ width: 390, height: 844 }); await p.reload();
  await p.locator('details.adv[data-item="Sales"] summary').click(); await p.locator('#planBox > summary').click(); await p.fill('#plTable', 'Territory'); await p.fill('#plKey', 'TerritoryKey'); await p.waitForTimeout(500);
  console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), '(expect false)');
  await p.screenshot({ path: 'rp_m.png', fullPage: true });
  console.log('errors', errs); await b.close();
})();
