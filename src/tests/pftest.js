const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ acceptDownloads: true }); await ctx.grantPermissions(['clipboard-read', 'clipboard-write']); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  const pages = { 'kpi-measure-builder': ['promptView', 'response'], 'measure-describer': ['promptView', 'reply'], 'prep-for-ai-writer': ['insPromptView', 'insReply'], 'dax-reviewer': ['promptView', 'reply'], 'power-query-explainer': ['exPromptView', 'exReply'], 'about-this-report': ['promptView', 'aiInput'] };
  for (const [pg, [pid, rid]] of Object.entries(pages)) {
    await p.goto('http://localhost:8765/' + pg + '.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
    const nb = await p.locator('.codebox-bar .r button', { hasText: 'Download file' }).count();
    const nr = await p.locator('.suite-reply').count();
    let dl = '';
    const btn = p.locator('#' + pid).locator('xpath=ancestor::div[contains(@class,"codebox")]').locator('button', { hasText: 'Download file' });
    const promptLen = (await p.locator('#' + pid).textContent()).trim().length;
    if (promptLen && await btn.isVisible().catch(() => false)) { const [d] = await Promise.all([p.waitForEvent('download'), btn.click()]); const path = 'dl_' + pg + '.txt'; await d.saveAs(path); const t = fs.readFileSync(path, 'utf8'); dl = d.suggestedFilename() + ' ' + t.length + ' ' + /one single response/.test(t); }
    // reply file
    const rowInput = p.locator('#' + rid).locator('xpath=preceding-sibling::div[contains(@class,"suite-reply")][1]').locator('input[type=file]');
    let rep = '';
    if (await rowInput.count()) { await rowInput.setInputFiles('reply_test.docx'); await p.waitForTimeout(300); rep = JSON.stringify((await p.locator('#' + rid).inputValue()).slice(0, 40)); }
    console.log(pg, '| buttons', nb, '| reply rows', nr, '| prompt', promptLen, '| dl', dl, '| docx->', rep);
  }
  // copy adds the one-reply line (DAX reviewer)
  await p.goto('http://localhost:8765/dax-reviewer.html'); await p.waitForTimeout(300);
  const cb = p.locator('[data-copy=prompt]'); if (await cb.isVisible()) { await cb.click(); await p.waitForTimeout(200); const clip = await p.evaluate(() => navigator.clipboard.readText()); console.log('copy has line:', /one single response/.test(clip)); }
  console.log('errors', errs); await b.close();
})();
