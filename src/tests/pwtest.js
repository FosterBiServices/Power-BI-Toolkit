const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1250, height: 950 }, acceptDownloads: true }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|fonts/.test(m.text())) errs.push(m.text()); });
  await p.goto('http://localhost:8765/power-query-writer.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  console.log('banner', await p.locator('#exampleBanner').isVisible(), '| chips', await p.locator('#colChips .chip').count(), '|', await p.locator('#promptTitle').innerText());
  console.log('checks:', (await p.locator('#checkList').innerText()).replace(/\n+/g, ' | '));
  console.log('steps rows', await p.locator('table.steps tbody tr').count(), '| questions', await p.locator('.qs li').count(), '| download btn', await p.locator('.codebox-bar button', { hasText: 'Download file' }).count(), '| reply file', await p.locator('.suite-reply').count());
  await p.screenshot({ path: 'pw_1.png', fullPage: true });
  // own request clears example
  await p.fill('#goal', 'Combine the monthly CSV files in a folder, keep Date, Store and Amount'); console.log('after own goal banner', await p.locator('#exampleBanner').isVisible(), '| reply', (await p.locator('#pwReply').inputValue()).length, '| columns', (await p.locator('#columns').inputValue()).length);
  await p.selectOption('#source', 'folder'); await p.fill('#sourceDetail', 'C:\\Data\\Sales');
  console.log('no-col tip:', (await p.locator('#promptMsg').innerText()).slice(0, 60));
  await p.fill('#columns', 'Date\nStore\nAmount: number');
  console.log('prompt has folder + cols:', /Folder of files/.test(await p.locator('#pwPromptView').innerText()), /- Amount \(number\)/.test(await p.locator('#pwPromptView').innerText()));
  await p.fill('#pwReply', '@@@ QUERY @@@\nlet\n  Source = Folder.Files("C:\\Data\\Sales"),\n  #"Filtered Rows" = Table.SelectRows(Source, each [Extension] = ".csv"),\n  Combined = Table.Combine(List.Transform(#"Filtered Rows"[Content], each Csv.Document(_))),\n  Kept = Table.SelectColumns(Combined, {"Date", "Shop", "Amount"})\nin\n  Kept\n@@@ END @@@');
  console.log('bad checks:', (await p.locator('#checkList').innerText()).replace(/\n+/g, ' | ').slice(0, 700));
  await p.reload(); console.log('persist goal', (await p.locator('#goal').inputValue()).slice(0, 20), '| banner', await p.locator('#exampleBanner').isVisible());
  // existing mode
  await p.click('text=Build on an existing query'); await p.fill('#existing', 'let\n    Source = Sql.Database("a", "b")\nin\n    Source');
  console.log('existing:', await p.locator('#existingMsg').innerText(), '| prompt keeps source', /Keep its source step/.test(await p.locator('#pwPromptView').innerText()));
  await p.setViewportSize({ width: 375, height: 800 }); await p.evaluate(() => localStorage.clear()); await p.reload(); console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  console.log('errors', errs); await b.close();
})();
