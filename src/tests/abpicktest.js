const { chromium } = require('playwright');
// About This Report: Step 2 picks the key measures, and the other drafts follow the picks
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1300, height: 950 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8765/about-this-report.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  const steps = await p.locator('.step h2').allInnerTexts(); console.log('steps', steps.join(' | '));
  const chosen = () => p.locator('.kchosen b').allInnerTexts();
  console.log('suggested', (await chosen()).join(', '), '| all measures', await p.locator('[data-kpick]').count());
  // untick all, then pick two by hand: the summary names only those
  await p.click('#kNone'); console.log('after untick all', (await chosen()).length, '(expect 0) | section', await p.locator('#sec-kpis .sec-body').innerText());
  const names = await p.locator('[data-kpick]').evaluateAll(l => l.map(x => x.dataset.kpick));
  await p.locator('[data-kpick="' + names[names.length - 1] + '"]').check(); await p.locator('[data-kpick="' + names[0] + '"]').check();
  console.log('picked', (await chosen()).join(', '), '| focus kept', await p.evaluate(() => document.activeElement.dataset.kpick));
  console.log('summary:', await p.locator('[data-draft=summary]').inputValue());
  console.log('prompt key measures:', (await p.locator('#promptView').textContent()).match(/key_measures[^\]]*\]/));
  // search and description filter
  await p.fill('#kFind', 'sales'); console.log('search "sales" shows', await p.locator('[data-kfind]:visible').count());
  await p.fill('#kFind', ''); const g = await p.locator('#kGrp option').allInnerTexts(); console.log('groups', g.join(' | '));
  await p.selectOption('#kGrp', g[1]); console.log('in ' + g[1], await p.locator('[data-kfind]:visible').count()); await p.selectOption('#kGrp', '');
  await p.check('#kDesc'); console.log('with a description', await p.locator('[data-kfind]:visible').count(), 'of', await p.locator('[data-kfind]').count());
  // move up, persist, suggest again
  await p.locator('[data-kup="1"]').click(); console.log('after move up', (await chosen()).join(', '));
  await p.reload(); console.log('after reload', (await chosen()).join(', '), '| desc filter kept', await p.isChecked('#kDesc'));
  await p.click('#kAuto'); console.log('suggest again', (await chosen()).length);
  await p.screenshot({ path: 'abpick_1.png', fullPage: true });
  await p.setViewportSize({ width: 390, height: 800 });
  console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await p.screenshot({ path: 'abpick_m.png', fullPage: true });
  console.log('errors', errs); await b.close();
})();
