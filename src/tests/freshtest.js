// Connecting a different PBIP folder starts the page from empty entries, so picks and pasted results made for an
// earlier model don't linger ("Not in the model export: ..."). Reading the same folder again keeps them.
const { chromium } = require('playwright');
const H = ['Kind', 'Table', 'Name', 'Type', 'Folder', 'Flags', 'Description', 'Expression', 'ToTable', 'ToColumn', 'Storage', 'Source'];
const row = o => H.map(h => o[h] || '').join('\t');
const OLD = [H.join('\t'),
  row({ Kind: 'Table', Table: 'Students', Name: 'Students', Storage: 'Import' }), row({ Kind: 'Table', Table: 'Date', Name: 'Date', Type: 'Time', Storage: 'Import' }),
  row({ Kind: 'Column', Table: 'Students', Name: 'Enrolled On', Type: 'DateTime' }), row({ Kind: 'Column', Table: 'Date', Name: 'Date', Type: 'DateTime' }),
  row({ Kind: 'Measure', Table: 'Students', Name: 'Enrollments', Type: '#,0', Expression: 'COUNTROWS ( Students )' }),
  row({ Kind: 'Relationship', Table: 'Students', Name: 'Enrolled On', Type: 'Many:One', Flags: 'OneDirection', ToTable: 'Date', ToColumn: 'Date' })].join('\n');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1250, height: 950 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  const U = x => 'http://localhost:8765/' + x + '.html';
  const paste = async (sel, v) => { await p.fill(sel, v); await p.locator(sel).press('End'); await p.locator(sel).type(' '); };
  // Time Intelligence Builder: a pasted export, Enrollments picked, then a different model from a PBIP folder
  await p.goto(U('time-intelligence-builder')); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.click('.sc-choose [data-sc=export]'); await paste('#modelInput', OLD);
  await p.locator('[data-m="Enrollments"]').check().catch(() => {});
  console.log('ti before:', await p.evaluate(() => JSON.parse(localStorage.getItem('kti.cfg') || '{}').measures), '(expect Enrollments)');
  await p.click('.sc-choose [data-sc=pbip]'); await p.setInputFiles('.sc-pbip input[type=file]', 'pqpbip/Contoso Sales'); await p.waitForTimeout(300);
  const ck = await p.locator('#checks').innerText();
  console.log('ti after folder:', await p.evaluate(() => JSON.parse(localStorage.getItem('kti.cfg') || '{}').measures), '| stale warning:', /Enrollments/.test(ck), '| model rows', (await p.inputValue('#modelInput')).split('\n').length, '(expect no Enrollments, false, rows > 1)');
  // picks made on the folder's model stay when the same folder is read again
  const m = await p.locator('#mList [data-m]').first().getAttribute('data-m'); await p.locator('#mList [data-m]').first().check();
  await p.setInputFiles('.sc-pbip input[type=file]', 'pqpbip/Contoso Sales'); await p.waitForTimeout(300);
  console.log('ti same folder again keeps', m + ':', await p.evaluate(n => (JSON.parse(localStorage.getItem('kti.cfg') || '{}').measures || []).includes(n), m), '(expect true)');
  // KPI Measure Builder: pasted validation results from an earlier model are cleared when it connects to the folder another tool read
  await p.goto(U('kpi-measure-builder')); await p.click('.sc-choose [data-sc=export]'); await paste('#modelInput', OLD);
  await p.evaluate(() => { const t = document.getElementById('valResults'); t.value = 'Enrollments\t42'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.goto(U('field-parameter-builder')); await p.click('.sc-choose [data-sc=pbip]'); await p.setInputFiles('.sc-pbip input[type=file]', 'pqpbip/Contoso Sales'); await p.waitForTimeout(300)
  await p.goto(U('kpi-measure-builder')); await p.click('.sc-choose [data-sc=pbip]'); await p.setInputFiles('.sc-pbip input[type=file]', 'pqpbip/Contoso Sales'); await p.waitForTimeout(300);
  console.log('kmb on the shared folder:', JSON.stringify(await p.inputValue('#valResults')), '| model has Enrollments:', (await p.inputValue('#modelInput')).includes('Enrollments'), '(expect "" false)');
  // a saved pick the model doesn't have (even on the same folder) is dropped, not hidden and still checked
  await p.goto(U('time-intelligence-builder'));
  await p.evaluate(() => { const c = JSON.parse(localStorage.getItem('kti.cfg')); c.measures = ['Enrollments']; localStorage.setItem('kti.cfg', JSON.stringify(c)); }); await p.reload();
  console.log('ti stale pick on reload:', /Enrollments/.test(await p.locator('#checks').innerText()), await p.locator('#mList [data-m]:checked').count(), '(expect false 0)');
  // Field Parameter Builder: fields from an earlier model are dropped when a folder's model arrives
  await p.goto(U('field-parameter-builder')); await p.click('.sc-choose [data-sc=export]'); await paste('#modelInput', OLD);
  await p.evaluate(() => { const c = JSON.parse(localStorage.getItem('kfp.cfg')); c.items = [{ kind: 'measure', table: 'Students', name: 'Enrollments', label: 'Enrollments', group: '' }]; localStorage.setItem('kfp.cfg', JSON.stringify(c)); }); await p.reload();
  await p.click('.sc-choose [data-sc=pbip]'); await p.setInputFiles('.sc-pbip input[type=file]', 'pqpbip/Contoso Sales'); await p.waitForTimeout(300);
  console.log('fp after folder:', await p.evaluate(() => JSON.parse(localStorage.getItem('kfp.cfg')).items.length), '| error:', /Not in the model export/.test(await p.locator('body').innerText()), '(expect 0 false)');
  await p.evaluate(() => localStorage.clear());
  console.log('errors', errs); await b.close();
})();
