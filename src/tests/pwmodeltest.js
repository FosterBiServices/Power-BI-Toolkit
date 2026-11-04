// Power Query Writer with a connected model: Step 1 connects (PBIP folder, export or none); picking a table fills its
// query (PBIP only) and columns with types; tables to merge with come from the model; the fx functions come as one
// TMDL view script that reads back as the same functions, without the ones the model already has.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 900 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/power-query-writer.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  const first = await p.evaluate(() => { const s = document.querySelector('.sc-choose').closest('.step'); return s.querySelector('.step-num b').textContent + ' ' + s.querySelector('h2').textContent; });
  console.log('connect step:', first, '| options', await p.locator('.sc-choose [data-sc]').count(), '(expect 1 Connect your model, 3)');
  console.log('pick hidden without a model', await p.locator('#pickBox').isHidden());
  await p.click('.sc-choose [data-sc=pbip]');
  await p.setInputFiles('.sc-pbip input[type=file]', 'pwpbip/Shop'); await p.waitForTimeout(800);
  await p.click('label:has(input[name=start][value=existing])');
  const opts = await p.locator('#pickTable option').allInnerTexts();
  console.log('tables:', opts.join(' | '), '(expect Customers, Sales; no _Measures)');
  await p.selectOption('#pickTable', 'Sales'); await p.waitForTimeout(200);
  const ex = await p.inputValue('#existing'), cols = await p.inputValue('#columns');
  console.log('example gone', await p.locator('#exampleBanner').isHidden(), '| existing from folder', /^let/.test(ex.trim()), '| columns', cols.split('\n').length, cols.split('\n').slice(0, 3).join(' ; '));
  console.log('pick msg:', (await p.locator('#pickMsg').innerText()).trim());
  await p.check('#moreBox summary >> xpath=..', { force: true }).catch(() => {}); await p.evaluate(() => { document.getElementById('moreBox').open = true; });
  await p.selectOption('#mergePick', 'Customers'); await p.waitForTimeout(100);
  console.log('merges:', await p.inputValue('#merges'));
  await p.fill('#goal', 'Sales lines from 2023 with the customer region.'); await p.waitForTimeout(100);
  console.log('prompt has merge + table cols', await p.evaluate(() => { const t = document.getElementById('pwPromptView').textContent; return /Customers: Customer Key, Customer Name, Region/.test(t); }));
  // a cleaning recipe: the functions as one TMDL script
  await p.check('.recipe[data-r=trim] input[data-on]'); await p.waitForTimeout(200);
  const tmdl = await p.locator('#fxTmdl').textContent();
  console.log('have:', (await p.locator('#fxHave').innerText()).trim(), '(expect fxApplyTypes)');
  console.log('tmdl expressions:', (tmdl.match(/^\texpression \S+/gm) || []).join(', '), '| starts', tmdl.split('\n')[0]);
  const back = await p.evaluate(t => { const r = pbipTmdlQueries(t); return r.exprs.map(e => { const want = PWF.BY.get(e.name).code.replace(/^(\s*\/\/[^\n]*\n)+/, '').trim(); return [e.name, e.code.trim() === want, [e.code.slice(0, 300), want.slice(0, 300)]]; }); }, tmdl);
  console.log('reads back as the same code:', JSON.stringify(back.map(x => x.slice(0, 2))));
  if (back.some(x => !x[1])) console.log(JSON.stringify(back[0][2]).slice(0, 600));
  console.log('descriptions', (tmdl.match(/^\t\/\/\/ /gm) || []).length);
  // reload: the pick and the folder's queries stay
  await p.reload(); await p.waitForTimeout(400);
  console.log('after reload: pick', await p.inputValue('#pickTable'), '| existing kept', /^let/.test((await p.inputValue('#existing')).trim()), '| queries kept', await p.evaluate(() => !!(state.mq && state.mq.queries.length)));
  // the export only: columns but no query
  const text = await p.inputValue('#modelInput');
  await p.click('.sc-choose [data-sc=none]'); await p.waitForTimeout(100);
  console.log('no model: pick hidden', await p.locator('#pickBox').isHidden(), '| queries dropped', await p.evaluate(() => !state.mq));
  await p.click('.sc-choose [data-sc=export]'); await p.fill('#modelInput', text); await p.waitForTimeout(200);
  await p.selectOption('#pickTable', 'Customers'); await p.waitForTimeout(200);
  console.log('export pick msg:', (await p.locator('#pickMsg').innerText()).trim().slice(0, 80), '| columns', (await p.inputValue('#columns')).split('\n').length);
  await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(200);
  console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > 390));
  await p.screenshot({ path: 'pwmodel.png', fullPage: false });
  console.log('errors', errs); await b.close();
})();
