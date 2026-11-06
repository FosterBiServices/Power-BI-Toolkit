// Saved entries that went bad (cut short, from an older version, or edited by hand) must not stop a page from
// opening. Each page is used once so it saves its entries, then every key it saved, and the shared export, is set
// to junk and the page is reloaded. Prints the script errors per page (expect none) and whether the page still drew.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const PAGES = fs.readdirSync(ROOT).filter(f => /\.html$/.test(f)).map(f => f.replace(/\.html$/, ''));
const JUNK = ['{"cut short', '[1,2', 'null', '42', '"text"', '{}', '[]', '{"rows": "x", "picks": 5, "cards": [null]}'];
(async () => {
  const b = await chromium.launch(); const bad = [];
  for (const page of PAGES) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); const errs = [];
    if (process.env.XLSX_FILE) await p.route(/cdnjs\.cloudflare\.com.*xlsx/, r => r.fulfill({ path: process.env.XLSX_FILE, contentType: 'application/javascript' }));
    p.on('pageerror', e => errs.push(e.message.split('\n')[0] + ' @' + ((e.stack || '').split('\n').find(l => /at /.test(l)) || '').trim().replace(/http:\/\/localhost:8765\//, '').replace(/^at /, '')));
    const url = 'http://localhost:8765/' + page + '.html';
    await p.goto(url); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
    // use the page a little so it saves: type into the first fields, tick the first boxes
    await p.evaluate(() => {
      Array.from(document.querySelectorAll('textarea, input[type=text]')).filter(e => e.offsetParent).slice(0, 3).forEach(e => { e.value += ' x'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
      Array.from(document.querySelectorAll('input[type=checkbox]')).filter(e => e.offsetParent).slice(0, 3).forEach(e => e.click());
    });
    await p.waitForTimeout(300);
    const keys = await p.evaluate(() => Object.keys(localStorage).filter(k => !/blank/.test(k)));
    keys.push('sfpbi.shared.model', 'sfpbi.shared.model.history');
    for (const j of JUNK) {
      await p.evaluate(([ks, v]) => ks.forEach(k => localStorage.setItem(k, v)), [keys, j]);
      await p.reload(); await p.waitForTimeout(250);
    }
    const drew = await p.evaluate(() => document.body.innerText.length > 200);
    const uniq = [...new Set(errs)];
    console.log(page.padEnd(27), '| keys', String(keys.length).padStart(2), '| errors', uniq.length, uniq.length ? JSON.stringify(uniq.slice(0, 6)) : '', '| page drew', drew);
    if (uniq.length || !drew) bad.push(page);
    await ctx.close();
  }
  console.log('errors', bad); await b.close();
})();
