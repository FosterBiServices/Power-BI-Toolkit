// Model Documenter: severities (inactive = Info, both directions = Error), unresolved references
// (row-context columns, names an expression makes and [Value] resolve; a name that matches nothing is an Error),
// Relationships + Relationship Matrix right under the diagram, and the Measure Catalog's search.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/model-documenter.html'); await p.waitForTimeout(300);
  const r = await p.evaluate(() => {
    const files = new Map(Object.entries(EX_FILES));
    const k = [...files.keys()].find(f => /tables\/Sales\.tmdl$/.test(f));
    files.set(k, files.get(k).replace('\tpartition Sales', [
      '\tmeasure RowCtx = SUMX(Sales, [Quantity] * [Net Amount])',
      '\tmeasure Made = SUMX(ADDCOLUMNS(VALUES(Sales[CustomerKey]), "CustTotal", [RowCtx]), [CustTotal])',
      '\tmeasure Vals = MAXX({1,2}, [Value])',
      '\tmeasure Broken = [No Such Measure] + 1',
      '', '\tpartition Sales'].join('\n')));
    const root = EX_ROOT, proj = MD.listProjects(files, root)[0];
    const project = MD.loadModel(files, proj);
    const html = MD.generateHtml(project, { profile: 'Developer Documentation', include_measures_tables: true, include_dax: true }, { date: '2026-01-01' });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rows = [...doc.querySelectorAll('#validation-table tbody tr')].map(tr => [...tr.cells].map(c => c.textContent));
    const ids = [...doc.querySelectorAll('h2[id]')].map(h => h.id);
    const unres = [...doc.querySelectorAll('.stat')].find(s => /Unresolved/.test(s.textContent)).querySelector('b').textContent;
    return {
      inactive: rows.filter(r => /inactive\./.test(r[3]) && /Relationship is inactive/.test(r[3])).map(r => r[0]),
      both: rows.filter(r => /bidirectional/.test(r[3])).map(r => r[0]),
      daxErr: rows.filter(r => r[1] === 'DAX Errors').map(r => r[0] + ' ' + r[2] + ': ' + r[3]),
      unres, order: ids.slice(0, 5), html
    };
  });
  console.log('inactive', r.inactive, '(expect Info)');
  console.log('both directions', r.both, '(expect Error)');
  console.log('DAX errors', r.daxErr, '(expect only Sales[Broken])');
  console.log('unresolved references', r.unres, '(expect 1)');
  console.log('section order', r.order.join(' > '), '(expect overview > diagram > relationships > relationship-matrix > tables)');
  // the Measure Catalog's search: type part of a formula, the match shows with its formula open
  const d = await b.newPage(); d.on('pageerror', e => errs.push('doc: ' + e.message));
  await d.setContent(r.html); await d.fill('#measure-filter', 'addcolumns'); 
  const vis = await d.$$eval('#measure-catalog tbody tr', rows => rows.filter(x => x.style.display !== 'none').map(x => x.cells[1].querySelector('summary').textContent + (x.querySelector('details').open ? ' (open)' : '')));
  console.log('search "addcolumns"', vis, '(expect [ Made (open) ])');
  await d.fill('#inventory-filter', 'addcolumns');
  const inv = await d.evaluate(() => [...document.querySelectorAll('.tinv')].filter(t => t.style.display !== 'none').map(t => t.querySelector('h3').textContent + ': ' + [...t.querySelectorAll('details.mitem')].filter(m => m.style.display !== 'none').map(m => m.querySelector('summary').textContent + (m.open ? ' (open)' : '')).join(', ')));
  console.log('inventory search "addcolumns"', inv, '(expect [ Sales: Made (open) ])');
  await d.fill('#inventory-filter', 'net amount');
  const inv2 = await d.evaluate(() => [...document.querySelectorAll('.tinv')].filter(t => t.style.display !== 'none').map(t => { const c = t.querySelector('details.cols'); return t.querySelector('h3').textContent + ' cols ' + (c && c.open ? 'open ' : '') + [...c.querySelectorAll('tr')].slice(1).filter(r => r.style.display !== 'none').map(r => r.cells[0].textContent).join('|'); }));
  console.log('inventory search "net amount"', inv2, '(expect Sales with Net Amount, plus tables whose measures use it)');
  await d.fill('#inventory-filter', 'customer');
  console.log('table name shows all of it', await d.evaluate(() => { const t = [...document.querySelectorAll('.tinv')].find(x => x.querySelector('h3').textContent === 'Customer'); return t.style.display !== 'none' && [...t.querySelectorAll('tr,details.mitem')].every(x => x.style.display !== 'none'); }), '(expect true)');
  await d.fill('#inventory-filter', 'zzz'); console.log('inventory no match note', await d.isVisible('#inventory-none'), '(expect true)');
  await d.fill('#inventory-filter', '');
  await d.fill('#measure-filter', 'zzz'); console.log('no match note shown', await d.isVisible('#measure-none'), '(expect true)');
  await d.setViewportSize({ width: 390, height: 800 }); await d.fill('#measure-filter', '');
  console.log('390px hscroll', await d.evaluate(() => document.documentElement.scrollWidth > innerWidth), '(expect false)');
  console.log('errors', errs); await b.close();
})();
