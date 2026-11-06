// Prep for AI Writer with a PBIP folder: synonyms the model already has (cultures/en-US.tmdl) are left out of the review,
// listed in the prompt so Copilot doesn't repeat them, and the culture step works from the folder's culture
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/prep-for-ai-writer.html'); await p.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('sfpbi'); }); await p.reload(); await p.waitForTimeout(300);
  await p.click('.sc-choose [data-sc=pbip]');
  await p.setInputFiles('.sc-pbip input[type=file]', 'pfpbip/Retail Sales'); await p.waitForTimeout(800);
  console.log('read:', (await p.locator('.sc-msg').innerText()).slice(0, 50));
  const pr = await p.textContent('#insPromptView');
  console.log('prompt lists existing:', pr.split('\n').filter(l => /territory|revenue/.test(l)).join(' | '));
  await p.fill('#insReply', "```\n@@@ INSTRUCTIONS @@@\nBusiness context\n- Retail sales.\n@@@ END @@@\n@@@ SYNONYMS @@@\n'Customer'[Region] = territory; area\n[Total Sales] = revenue\n@@@ END @@@\n```"); await p.waitForTimeout(300);
  console.log('note:', await p.textContent('#synNote'));
  console.log('rows:', (await p.$$eval('#synBody tr', t => t.map(r => r.innerText.replace(/\s+/g, ' ')))).join(' || '));
  console.log('culture step:', (await p.textContent('#cultMsg')).slice(0, 220));
  await p.reload(); await p.waitForTimeout(800);
  console.log('after reload note:', await p.textContent('#synNote'));
  console.log('errors', errs); await b.close();
})();
