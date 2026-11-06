// Prep for AI Writer: copy and download the name lists, rename columns in Power Query, leave helper tables and
// measures out of the whole page, and the pointer to Measure Describer for measure descriptions.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1250, height: 900 }, acceptDownloads: true });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/prep-for-ai-writer.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  // example: rename suggestions and the Power Query step
  await p.click('#renameBox summary');
  const ren = await p.$$eval('#renBody tr', trs => trs.map(t => t.querySelector('.nm').firstChild.textContent + ' -> ' + t.querySelector('[data-act=to]').value));
  console.log('rename rows', ren.join(' | '), '(expect ORD_STS_CD -> Order Status Code, Name -> Customer Name / Product Name)');
  console.log('steps', (await p.$$eval('#renCode pre', ps => ps.map(x => x.textContent))).join('\n      '));
  await p.fill('#renBody tr:first-child [data-act=to]', 'Order Status');
  console.log('edited step has new name', (await p.textContent('#renCode')).includes('"Order Status"'), '(expect true)');
  // copy one list, download them all
  await p.click('details.flag[data-f=cryptic] summary'); await p.click('[data-flagcopy=cryptic]'); await p.waitForTimeout(200);
  console.log('copied cryptic list:\n' + await p.evaluate(() => navigator.clipboard.readText()));
  const [d] = await Promise.all([p.waitForEvent('download'), p.click('#readyCsv')]);
  console.log(d.suggestedFilename() + '\n' + fs.readFileSync(await d.path(), 'utf8').trim());
  // your own model with a paging table
  const rows = fs.readFileSync('ex_export.tsv', 'utf8').trim().split('\n');
  const head = rows[0].split('\t'), mk = o => head.map(h => o[h] || '').join('\t');
  const extra = [mk({ Kind: 'Table', Table: 'Page Selector', Name: 'Page Selector' }), mk({ Kind: 'Column', Table: 'Page Selector', Name: 'Page', Type: 'Int64' }),
    mk({ Kind: 'Column', Table: 'Page Selector', Name: 'PAGE_SIZE', Type: 'Int64' }),
    mk({ Kind: 'Measure', Table: 'Page Selector', Name: 'Rows On Page', Expression: 'SELECTEDVALUE ( \'Page Selector\'[PAGE_SIZE] )' }),
    mk({ Kind: 'Measure', Table: head.includes('Folder') ? rows.find(r => r.startsWith('Measure')).split('\t')[1] : 'Sales', Name: 'Show Row', Folder: 'Paging', Expression: 'IF ( RANKX ( ALL ( \'Page Selector\' ), [Rows On Page] ) > 0, 1 )' })];
  await p.evaluate(v => { const t = document.getElementById('modelInput'); t.value = v; t.dispatchEvent(new Event('input', { bubbles: true })); }, rows.concat(extra).join('\n')); await p.waitForTimeout(300);
  const has = async () => { const pr = await p.textContent('#insPromptView'); const fl = await p.textContent('#flags'); return 'prompt: Page Selector ' + pr.includes('Page Selector') + ', Show Row ' + pr.includes('[Show Row]') + ' | flags PAGE_SIZE ' + fl.includes('PAGE_SIZE'); };
  console.log('before leaving out ->', await has());
  console.log('leave-out box open', await p.evaluate(() => document.getElementById('skipBox').open), '(expect true)');
  await p.click('[data-skipt="Page Selector"]'); await p.waitForTimeout(200);
  console.log('hint', await p.textContent('#skipHint'));
  await p.click('#skipUsing'); await p.waitForTimeout(200);
  console.log('after leaving out ->', await has(), '(expect all false)', '| summary', await p.textContent('#skipSum'));
  console.log('descriptions list has Page Selector', (await p.textContent('#dList')).includes('Page Selector'), '(expect false)');
  await p.reload(); await p.waitForTimeout(300);
  console.log('after reload ->', await has(), '| summary', await p.textContent('#skipSum'));
  // put the table back
  await p.click('[data-skipt="Page Selector"]'); await p.waitForTimeout(200);
  console.log('put back ->', await has(), '(expect Page Selector true, Show Row false: still left out by name)');
  // leave a table out straight from a list
  await p.click('details.flag[data-f=cryptic] summary').catch(() => {});
  if (!(await p.evaluate(() => document.querySelector('details.flag[data-f=cryptic]').open))) await p.click('details.flag[data-f=cryptic] summary');
  await p.click('[data-qskipt="Page Selector"]'); await p.waitForTimeout(200);
  console.log('left out from the list ->', await has(), '(expect Page Selector false, PAGE_SIZE false)');
  // measures: where to describe them
  console.log('measure note:', await p.textContent('#measureNote'));
  await p.click('#tabDesc'); console.log('descriptions tab:', await p.textContent('#dMeasureNote'), '| link', await p.getAttribute('#dMeasureNote a', 'href'));
  // phone width
  await p.setViewportSize({ width: 390, height: 900 }); await p.click('#tabIns'); await p.waitForTimeout(200);
  console.log('scroll width at 390', await p.evaluate(() => document.documentElement.scrollWidth), '(expect 390)');
  await p.screenshot({ path: 'pfnames_390.png', fullPage: true });
  // Clear entries empties the left-out list
  await p.setViewportSize({ width: 1250, height: 900 });
  await p.click('#clearEntries'); await p.click('#clearYes'); await p.waitForTimeout(200);
  console.log('after clear: skip', JSON.stringify(await p.evaluate(() => JSON.parse(localStorage.getItem('kpa.state')).skip)));
  console.log('errors', errs); await b.close();
})();
