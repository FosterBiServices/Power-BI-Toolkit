// Prep for AI Writer: export the items Copilot wasn't sure about, to confirm with the business
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 900 }, acceptDownloads: true }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/prep-for-ai-writer.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  const tabs = await p.locator('[role=tab]').allInnerTexts(); console.log('tabs', tabs.join(' | '));
  const dl = async sel => { const [d] = await Promise.all([p.waitForEvent('download'), p.click(sel)]); const f = await d.path(); return { name: d.suggestedFilename(), text: require('fs').readFileSync(f, 'utf8') }; };
  for (const t of await p.locator('[role=tab]').all()) {
    await t.click(); await p.waitForTimeout(200);
    if (await p.locator('#dExportChecks').isVisible()) { console.log('descriptions button:', await p.locator('#dExportChecks').innerText()); const r = await dl('#dExportChecks'); console.log(r.name, '\n' + r.text.trim()); }
    if (await p.locator('#insExportChecks').isVisible()) { const r = await dl('#insExportChecks'); console.log(r.name, '\n' + r.text.trim()); }
  }
  console.log('errors', errs.filter(e => !/ERR_CERT/.test(e))); await b.close();
})();
