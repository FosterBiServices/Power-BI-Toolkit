// Save to a PBIP folder: the button shows under TMDL scripts only, the plan merges into the model's files
// (new tables, measures into an existing _Measures, relationships, model.tmdl), and Save writes them.
// The folder is an in-memory stand-in for the File System Access API, filled from savepbip/.
// PARKED: skips while the feature isn't in the build (see CLAUDE.md, Parked)
if (!require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'sample-data-maker.html'), 'utf8').includes('pbipPlan')) { console.log('parked: Save to a PBIP folder is not in the build'); console.log('errors', []); process.exit(0); }
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const read = d => { const o = {}; const walk = (p, rel) => fs.readdirSync(p, { withFileTypes: true }).forEach(e => e.isDirectory() ? walk(path.join(p, e.name), rel + e.name + '/') : (o[rel + e.name] = fs.readFileSync(path.join(p, e.name), 'utf8'))); walk(d, ''); return o; };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext()).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  const files = read(path.join(__dirname, 'savepbip')); const files0 = files['Sample Sales.SemanticModel/definition/tables/_Measures.tmdl'];
  await p.addInitScript(files => {
    // a directory handle over a flat { 'a/b.tmdl': text } map
    const dir = (name, pre) => ({ kind: 'directory', name,
      async *entries(){ const seen = new Set(); for (const k of Object.keys(window.__fs)) { if (!k.startsWith(pre)) continue; const rest = k.slice(pre.length), i = rest.indexOf('/');
        if (i < 0) yield [rest, file(rest, k)]; else { const n = rest.slice(0, i); if (!seen.has(n)) { seen.add(n); yield [n, dir(n, pre + n + '/')]; } } } },
      async getDirectoryHandle(n){ return dir(n, pre + n + '/'); },
      async getFileHandle(n){ return file(n, pre + n); } });
    const file = (name, key) => ({ kind: 'file', name, async getFile(){ return new File([window.__fs[key] || ''], name); },
      async createWritable(){ let t = ''; return { write: async x => { t += x; }, close: async () => { window.__fs[key] = t; window.__written.push(key); } }; } });
    window.__fs = files; window.__written = [];
    window.showDirectoryPicker = async () => dir('Sample Sales', '');
  }, files);
  await p.goto('http://localhost:8765/sample-data-maker.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.click('label.mode:has(input[value=make])'); await p.click('[data-ind="hr"]'); await p.click('[data-ind="retail"]');
  await p.click('#tablePicks input[data-tbl="Date"]'); await p.click('label:has(input[name=mtable][value=add])'); await p.waitForTimeout(200);
  const btn = '.codebox:has(#tmdlView) button:has-text("Save to a PBIP folder")';
  console.log('button shows on the TMDL box', await p.isVisible(btn));
  await p.click(btn); await p.waitForTimeout(300);
  console.log('plan:', (await p.textContent('.sc-save')).replace(/\s+/g, ' ').slice(0, 300)); console.log('measures line:', await p.evaluate(() => Array.from(document.querySelectorAll('.sc-save li')).map(l => l.textContent).filter(t => /_Measures/.test(t)).join(' | ')), '| mtable', await p.evaluate(() => /ref table _Measures/.test(state.tmdl)));
  await p.click('[data-sc-go]'); await p.waitForTimeout(300);
  console.log('after save:', (await p.textContent('.sc-save')).trim().slice(0, 120));
  const r = await p.evaluate(() => ({ w: window.__written, m: window.__fs['Sample Sales.SemanticModel/definition/model.tmdl'], meas: window.__fs['Sample Sales.SemanticModel/definition/tables/_Measures.tmdl'],
    rel: window.__fs['Sample Sales.SemanticModel/definition/relationships.tmdl'], emp: window.__fs['Sample Sales.SemanticModel/definition/tables/Employees.tmdl'] }));
  console.log('written', r.w.length, r.w.map(x => x.split('/').slice(2).join('/')).join(', '));
  console.log('model.tmdl lists Employees', /^ref table Employees$/m.test(r.m), '| _Measures: measures before', (files0.match(/^\tmeasure /gm) || []).length, 'after', (r.meas.match(/^\tmeasure /gm) || []).length, '(expect 3 more) | HR folder', /displayFolder: (Employees|Requisitions|Applications|Absences|Interviews)/.test(r.meas), '| Headcount left out (reads Date)', !/measure Headcount/.test(r.meas));
  console.log('relationships: old kept', /Sales\.CustomerKey/.test(r.rel), '| Employees to Departments added', /Employees\.DepartmentKey/.test(r.rel), '| Employees file starts', JSON.stringify(r.emp.split('\n').slice(0, 2)));
  // a second save is a no-op for relationships and replaces measures (no duplicates)
  await p.click(btn); await p.waitForTimeout(300);
  console.log('second plan:', (await p.textContent('.sc-save')).replace(/\s+/g, ' ').slice(0, 300));
  // DAX query boxes don't get the button
  console.log('buttons on the page', await p.$$eval('.codebox button', x => x.filter(b => b.textContent === 'Save to a PBIP folder' && !b.hidden).length), '(expect 1)');
  console.log('errors', errs); await b.close();
})();
