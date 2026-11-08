// Sample Data Maker: TV and movie character names (coach names first), Made-up names, and Remove column.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  if (process.env.XLSX_FILE) await p.route(/cdnjs\.cloudflare\.com.*xlsx/, r => r.fulfill({ path: process.env.XLSX_FILE, contentType: 'application/javascript' }));
  await p.goto('http://localhost:8765/sample-data-maker.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(800);
  // mask: the example's 24 customers all get a different coach name
  const m1 = await p.evaluate(() => { const ch = SD.chars(), coach = new Set(SD_NAMES.COACH.map(x => x[0] + ' ' + x[1])), r = maskResult(), names = r.tables[0].rows.map(x => x[1].v);
    return { n: ch.n, nc: ch.nc, coach: names.every(x => coach.has(x)), distinct: new Set(names).size, count: names.length, first: names.slice(0, 4).join(', '), email: r.tables[0].rows[0][2].v, checked: document.querySelector('input[name=namesMask]:checked').value }; });
  console.log('characters', m1.n, '| coach', m1.nc, '| default', m1.checked, '(expect chars) | customers all coach names', m1.coach, '| distinct', m1.distinct, 'of', m1.count, '|', m1.first, '|', m1.email);
  // more people than characters: every name still different
  const big = await p.evaluate(() => { const rows = []; for (let i = 0; i < 1200; i++) rows.push([{ k: 'text', v: 'Person ' + i + ' Smith' }]);
    const t = [{ id: 'b', headers: ['Customer Name'], rows }], r = SDM.run(t, { seed: 5, treats: { b: ['person'] }, links: [], names: 'chars' }), v = r.tables[0].rows.map(x => x[0].v);
    const coach = new Set(SD_NAMES.COACH.map(x => x[0] + ' ' + x[1])); return { distinct: new Set(v).size, coachFirst: v.slice(0, 70).every(x => coach.has(x)), after: v.slice(70, 805).every(x => !coach.has(x)) }; });
  console.log('1,200 people: distinct', big.distinct, '(expect 1200) | first 70 coach', big.coachFirst, '| next 735 not coach', big.after);
  // made-up names
  await p.click('label:has(input[name=namesMask][value=made])'); await p.waitForTimeout(200);
  const m2 = await p.evaluate(() => { const r = maskResult(), f = new Set(SD.LISTS.FirstName); return { madeUp: r.tables[0].rows.every(x => f.has(x[1].v.split(' ')[0])), saved: localStorage.getItem('ksd.names') }; });
  console.log('made-up names', m2.madeUp, '| saved', m2.saved);
  await p.click('label:has(input[name=namesMask][value=chars])'); await p.waitForTimeout(200);
  // Remove column: Signup Date leaves the download; Orders' Customer ID removed, Customers' Customer ID still masked
  await p.selectOption('select[data-t=ex1][data-c="5"]', 'drop'); await p.selectOption('select[data-t=ex2][data-c="1"]', 'drop'); await p.waitForTimeout(200);
  const m3 = await p.evaluate(() => { const r = maskResult(); return { cust: r.tables[0].headers.join(','), ord: r.tables[1].headers.join(','), custId: state.treats.ex1[0], idChanged: r.tables[0].rows[0][0].v !== state.tables[0].rows[0][0].v,
    preview: Array.from(document.querySelectorAll('#maskPreview th')).map(x => x.textContent).join(','), note: Array.from(document.querySelectorAll('#maskPreview .note')).map(x => x.textContent).join(' ') }; });
  console.log('Customers', m3.cust, '| Orders', m3.ord); console.log('Customer ID still', m3.custId, '| masked', m3.idChanged, '| preview', m3.preview, '|', m3.note);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-dl="Sales example.xlsx"]')]);
  const f = __dirname + '/dl_sd_removed.xlsx'; await dl.saveAs(f);
  await p.click('#clearEntries'); await p.click('#clearYes'); await p.waitForTimeout(200);
  await p.setInputFiles('#fileInput', [f]); await p.waitForTimeout(800);
  console.log('read back headers', await p.evaluate(() => state.tables.map(t => t.sheet + ': ' + t.headers.join(',')).join(' | ')));
  // Remove column back to something else follows the linked columns again
  await p.selectOption('select[data-t] >> nth=0', 'drop'); await p.selectOption('select[data-t] >> nth=0', 'keep'); await p.waitForTimeout(100);
  // make: HR employees are characters, coach names first, gender from the character
  await p.click('label.mode:has(input[value=make])'); await p.click('[data-ind="hr"]'); await p.click('[data-ind="retail"]'); await p.waitForTimeout(300);
  const mk = await p.evaluate(() => { const c = makeModel(), t = c.model.tables.find(x => x.name === 'Employees'), rows = SD.tableRows(t, { p: c.args, seed: state.make.seed }), ch = SD.chars();
    const full = SD_NAMES.COACH.concat(SD_NAMES.MEMBER), fem = new Map(full.map(x => [x[0] + ' ' + x[1], !!x[2]])), coach = new Set(SD_NAMES.COACH.map(x => x[0] + ' ' + x[1]));
    return { n: rows.length, coach: rows.slice(0, Math.min(70, rows.length)).every(r => coach.has(r.Employee)), distinct: new Set(rows.map(r => r.Employee)).size, gender: rows.every(r => !fem.has(r.Employee) || (fem.get(r.Employee) ? 'Female' : 'Male') === r.Gender),
      sample: rows.slice(0, 3).map(r => r.Employee + ' (' + r.Gender + ')').join(', '), udf: /function 'FosterBIServices\.SampleData\.Character\.FullName'|function FosterBIServices\.SampleData\.Character\.FullName/.test(state.tmdl) || state.tmdl.includes('Character.FullName = ```') }; });
  console.log('HR employees', mk.n, '| first 70 coach', mk.coach, '| distinct', mk.distinct, '| gender matches', mk.gender, '|', mk.sample, '| Character.FullName function', mk.udf);
  await p.click('label:has(input[name=style][value=inline])'); await p.waitForTimeout(200);
  console.log('plain tables: PATHITEM', await p.evaluate(() => /PATHITEM\( "Rachel\|Monica/.test(state.tmdl)), '| no functions', await p.evaluate(() => !/^\tfunction /m.test(state.tmdl)));
  await p.click('label:has(input[name=namesMake][value=made])'); await p.waitForTimeout(200);
  console.log('made-up: no PATHITEM', await p.evaluate(() => !/PATHITEM/.test(state.tmdl)), '| first employee', await p.evaluate(() => document.querySelector('#makePreview tbody tr') ? 1 : 0), await p.evaluate(() => { const c = makeModel(), t = c.model.tables.find(x => x.name === 'Employees'); return SD.tableRows(t, { p: c.args, seed: state.make.seed }, 1)[0].Employee; }));
  await p.click('label:has(input[name=namesMake][value=chars])');
  await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(200);
  console.log('mobile hscroll (make)', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await p.click('label.mode:has(input[value=mask])'); await p.waitForTimeout(200);
  console.log('mobile hscroll (mask)', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  console.log('errors', errs); await b.close();
})();
