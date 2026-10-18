// Sample Data Maker: example masking keeps links, a masked download reads back, CSV day-first dates,
// Make new data for every industry, Clear entries, mobile width.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  // Offline? Point XLSX_FILE at a local xlsx.full.min.js (0.18.5) to stand in for the CDN copy.
  if (process.env.XLSX_FILE) await p.route(/cdnjs\.cloudflare\.com.*xlsx/, r => r.fulfill({ path: process.env.XLSX_FILE, contentType: 'application/javascript' }));
  await p.goto('http://localhost:8765/sample-data-maker.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(800);
  console.log('example banner', await p.isVisible('#exampleBanner'), '| tables', await p.$$eval('.tcard', x => x.length), '(expect 3)', '| links', await p.$$eval('#linkList [data-sug]', x => x.length), '(expect 2)');
  console.log('choices', await p.$$eval('#colCards select', s => s.map(x => x.value).join(',')));
  const keys = await p.evaluate(() => { const r = maskResult(); const ids = new Set(r.tables[0].rows.map(x => x[0].v)), pc = new Set(r.tables[2].rows.map(x => x[0].v));
    return { cust: r.tables[1].rows.every(x => ids.has(x[1].v)), prod: r.tables[1].rows.every(x => pc.has(x[2].v)), changed: r.tables[0].rows[0][1].v !== state.tables[0].rows[0][1].v, shift: r.shift }; });
  console.log('masked keys still match', keys.cust, keys.prod, '| names changed', keys.changed, '| shift weeks', keys.shift / 7);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-dl="Sales example.xlsx"]')]);
  const f = __dirname + '/sd_masked.xlsx'; await dl.saveAs(f); console.log('download', dl.suggestedFilename());
  await p.setInputFiles('#fileInput', [f, __dirname + '/sd_staff.csv']); await p.waitForTimeout(800);
  console.log('after load: banner', await p.isVisible('#exampleBanner'), '| files', await p.$$eval('.fchip', x => x.map(y => y.textContent.replace(/\s+/g, ' ').trim())));
  const rb = await p.evaluate(() => { const c = state.tables.find(t => t.sheet === 'Customers'), o = state.tables.find(t => t.sheet === 'Orders'), s = state.tables.find(t => t.sheet === 'sd_staff');
    const ids = new Set(c.rows.map(x => x[0].v)); return { links: o.rows.every(x => ids.has(x[1].v)), dateKind: c.rows[0][5].k, staff: state.treats[s.id].join(','), hire: SDM.show(s.rows[0][2]), sugs: state.sugs.length }; });
  console.log('read back: orders match customers', rb.links, '| date cell', rb.dateKind, '(expect date) | staff choices', rb.staff, '| staff hire', rb.hire, '(expect 15/01/2020) | links', rb.sugs);
  const staffHire = await p.evaluate(() => { const i = state.tables.findIndex(t => t.sheet === 'sd_staff'); const r = maskResult(); const ids = new Set(r.tables[i].rows.map(x => x[0].v)); return [SDM.show(r.tables[i].rows[0][2]), r.tables[i].rows.every(x => x[4].k === 'empty' || ids.has(x[4].v))]; });
  console.log('staff masked hire', staffHire[0], '(a whole number of weeks from 15/01/2020) | Manager ID still finds Employee ID', staffHire[1]);
  // make new data
  await p.click('label.mode:has(input[value=make])'); await p.waitForTimeout(300);
  for (const id of ['retail', 'hr', 'finance', 'health', 'mfg', 'service']) {
    await p.click('[data-ind="' + id + '"]'); await p.waitForTimeout(150);
    const r = await p.evaluate(() => ({ tabs: document.querySelectorAll('#makeTabs [data-tab]').length, rows: document.querySelectorAll('#makePreview tbody tr').length, t: state.tmdl }));
    console.log(id, 'tables', r.tabs, '| preview rows', r.rows, '| functions', (r.t.match(/^\tfunction /gm) || []).length, '| relationships', (r.t.match(/^\trelationship /gm) || []).length, '| measures', (r.t.match(/^\t\tmeasure /gm) || []).length, '| DataGoblins', /DataGoblins/.test(r.t));
  }
  await p.click('label:has(input[name=style][value=inline])'); await p.waitForTimeout(150);
  console.log('plain tables: functions', await p.evaluate(() => (state.tmdl.match(/^\tfunction /gm) || []).length), '(expect 0) | VAR seed', await p.evaluate(() => /VAR seed = 1/.test(state.tmdl)));
  await p.fill('#endDate', '2019-01-01'); await p.dispatchEvent('#endDate', 'change'); await p.waitForTimeout(150);
  console.log('end before start message', await p.textContent('#makeMsg'));
  await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(200);
  console.log('mobile hscroll (make)', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await p.screenshot({ path: __dirname + '/sd_make_mobile.png', fullPage: true });
  await p.click('label.mode:has(input[value=mask])'); await p.waitForTimeout(200);
  console.log('mobile hscroll (mask)', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.screenshot({ path: __dirname + '/sd_mask.png', fullPage: true });
  await p.click('#clearEntries'); await p.click('#clearYes'); await p.waitForTimeout(300);
  console.log('after clear: tables', await p.$$eval('.tcard', x => x.length), '| mode', await p.evaluate(() => state.mode));
  await p.reload(); await p.waitForTimeout(600); console.log('reload stays empty', await p.$$eval('.tcard', x => x.length) === 0, '| banner', await p.isVisible('#exampleBanner'));
  console.log('errors', errs); await b.close();
})();
