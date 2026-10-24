// Bad input on every page: empty, blank, junk, markup, a broken export, a huge paste and junk files go into
// every field and file box, then every button is pressed. Prints, per page, the script errors seen and whether
// typed markup ran (it must never run). FUZZ_PAGES=a,b limits the pages.
// time limit: 90 minutes
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const ALL = fs.readdirSync(ROOT).filter(f => /\.html$/.test(f)).map(f => f.replace(/\.html$/, ''));
const PAGES = process.env.FUZZ_PAGES ? process.env.FUZZ_PAGES.split(',') : ALL;
const XSS = '<img src=x onerror="__xss()">';
const PAYLOADS = [
  ['empty', ''],
  ['blank', '   \n\t \n'],
  ['junk', 'asdf qwer 123 ]]] ((( }}} \u0000 ￿ émoji 📊 \\'],
  ['markup', XSS + ' "quote\' <b>bold</b> ' + XSS],
  ['broken export', 'Kind\tTable\tName\nColumn\t\t\nMeasure\tSales\t\t\t\t\t\t=SUM(\nRelationship\tA\nTable\t' + XSS + '\t' + XSS],
  ['broken dax', 'Total = CALCULATE( SUM( Sales[Amount] , FILTER( ALL(\'Date\'), "'],
  ['broken json', '{"name": "x", "dataColors": [1, null, {"a":'],
  ['huge', ('Customer\tSales\tProduct\tRegion\t1234.5\n').repeat(40000)],
];
const FILES = [
  ['junk.xlsx', Buffer.from('PK\u0003\u0004not really a zip file at all')],
  ['junk.csv', Buffer.from('a,b,"c\n1,,"2"\n\n,,,\n' + XSS)],
  ['junk.json', Buffer.from('{"not": "a theme", "dataColors": "red"')],
  ['empty.txt', Buffer.alloc(0)],
  ['junk.docx', Buffer.from([0, 1, 2, 3, 255, 254, 0, 0])],
  ['junk.bim', Buffer.from('{"model": {"tables": [{"name": null, "columns": "x"}]}}')],
  ['junk.tmdl', Buffer.from('table\n\tcolumn\n\t\t\tmeasure =\npartition = m\n\tsource =\n')],
];
const SKIP_BTN = '#clearAll, #clearYes, #clearAllPages, [data-sc=pbip], #pickReport, #pickFolder';
// each page gets its own browser process, so one page that brings the browser down can't stop the others
if (!process.env.FUZZ_PAGES) {
  const { spawnSync } = require('child_process'), bad = [];
  for (const pg of ALL) {
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, FUZZ_PAGES: pg }, encoding: 'utf8', timeout: 480000 });
    const line = (r.stdout || '').split('\n').find(l => l.startsWith(pg)) || pg.padEnd(27) + ' | the check stopped: ' + ((r.stderr || '').split('\n').find(l => /Error|error/.test(l)) || 'timeout');
    console.log(line); if (!/errors 0 .*markup ran 0/.test(line)) bad.push(pg);
  }
  console.log('errors', bad); process.exit(0);
}
(async () => {
  const fdir = path.join(__dirname, 'dl_fuzz'); fs.mkdirSync(fdir, { recursive: true });
  const fpaths = FILES.map(([n, d]) => { const f = path.join(fdir, n); fs.writeFileSync(f, d); return f; });
  const total = {};
  for (const page of PAGES) {
    const b = await chromium.launch();
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
    if (process.env.XLSX_FILE) await ctx.route(/cdnjs\.cloudflare\.com.*xlsx/, r => r.fulfill({ path: process.env.XLSX_FILE, contentType: 'application/javascript' }));
    // stay on the page: links don't navigate during the check
    await ctx.addInitScript(() => document.addEventListener('click', e => { const a = e.target.closest('a[href]'); if (a && !a.download) e.preventDefault(); }, true));
    let ran = 0; await ctx.exposeBinding('__xss', () => { ran++; });
    const url = 'http://localhost:8765/' + page + '.html', errs = []; let p = null;
    // back to the page if a button opened another one, or a fresh tab if the page crashed
    const home = async () => {
      if (!p || p.isClosed()) {
        p = await ctx.newPage();
        p.on('pageerror', e => { if (p.url().startsWith(url)) errs.push(e.message.split('\n')[0] + ' @' + ((e.stack || '').split('\n').find(l => /at /.test(l)) || '').trim().replace(/http:\/\/localhost:8765\//, '').replace(/^at /, '')); });
        p.on('crash', () => errs.push('page crashed'));
        p.on('dialog', d => d.dismiss().catch(() => {}));
        p.on('download', d => d.cancel().catch(() => {}));
      }
      if (!p.url().startsWith(url)) await p.goto(url).catch(() => {});
      await p.waitForLoadState().catch(() => {});
    };
    await home(); await p.evaluate(() => localStorage.clear()).catch(() => {}); await p.reload().catch(() => {}); await p.waitForTimeout(300);
    const pressAll = async () => {
      await home();
      const n = await p.$$eval('button, [role=button], [role=radio], [role=tab], summary', (els, skip) => els.map((e, i) => (e.dataset.fz = i, !e.matches(skip) && !e.disabled && e.offsetParent !== null ? i : -1)).filter(i => i >= 0), SKIP_BTN).catch(() => []);
      for (const i of n.slice(0, 150)) { if (!p.url().startsWith(url)) break; await p.click('[data-fz="' + i + '"]', { timeout: 400, noWaitAfter: true }).catch(() => {}); }
    };
    for (const [name, text] of PAYLOADS) {
      await home();
      // the huge paste goes only where pastes go (text areas); one-line boxes such as titles get the rest
      await p.evaluate(([t, big]) => {
        for (const el of document.querySelectorAll(big ? 'textarea' : 'textarea, input:not([type]), input[type=text], input[type=search], input[type=number], input[type=date], input[type=color]')) {
          if (el.type === 'number' || el.type === 'date' || el.type === 'color') { el.value = t ? 'x' : ''; } else el.value = t;
          el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        for (const s of document.querySelectorAll('select')) { if (s.options.length) { s.selectedIndex = (s.selectedIndex + 1) % s.options.length; s.dispatchEvent(new Event('change', { bubbles: true })); } }
      }, [text, name === 'huge']).catch(() => {});
      await p.waitForTimeout(100).catch(() => {});
      if (name !== 'huge') await pressAll();
      if (process.env.FUZZ_TRACE) console.error(page, 'done', name, new Date().toISOString().slice(11, 19));
    }
    await home();
    const count = await p.$$eval('input[type=file]', x => x.length).catch(() => 0);
    for (let k = 0; k < count; k++) {
      await home(); const inp = p.locator('input[type=file]').nth(k);
      const multi = await inp.evaluate(e => e.multiple || e.webkitdirectory).catch(() => false);
      for (const f of multi ? [fpaths] : fpaths) { await inp.setInputFiles(f).catch(() => {}); await p.waitForTimeout(150).catch(() => {}); if (process.env.FUZZ_TRACE) console.error(page, 'file box', k, String(f).split('/').pop(), new Date().toISOString().slice(11, 19)); }
    }
    await pressAll(); await p.waitForTimeout(300).catch(() => {});
    // the page clears and reloads without errors after all that
    await home();
    if (await p.$('#clearAll').catch(() => null)) { await p.click('#clearAll', { timeout: 1000 }).catch(() => {}); await p.click('#clearYes', { timeout: 1000 }).catch(() => {}); }
    await p.reload().catch(() => {}); await p.waitForTimeout(300).catch(() => {});
    const uniq = [...new Set(errs)];
    total[page] = { errors: uniq, xss: ran };
    console.log(page.padEnd(27), '| errors', uniq.length, uniq.length ? JSON.stringify(uniq.slice(0, 8)) : '', '| markup ran', ran, '(expect 0)');
    // a page that holds the browser open (a download or file dialog left waiting) can't stall the run
    await Promise.race([b.close().catch(() => {}), new Promise(r => setTimeout(r, 10000))]);
  }
  fs.writeFileSync(path.join(fdir, 'result.json'), JSON.stringify(total, null, 1));
  const errs = Object.entries(total).filter(([, v]) => v.errors.length).map(([k, v]) => k + ': ' + v.errors.join(' / '));
  console.log('errors', errs); process.exit(0);
})();
