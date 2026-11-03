// Theme Builder fixes: Start from my logo picks the logo's colors; a brand color isn't flagged as amber/red/green;
// Other options don't open with the same color for every data color.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext()).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/theme-builder.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(400);
  // a logo: navy shield and a gold bar on white
  const b64 = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 200; c.height = 120; const x = c.getContext('2d');
    x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, 200, 120); x.fillStyle = '#01305C'; x.fillRect(20, 10, 90, 100); x.fillStyle = '#C99700'; x.fillRect(120, 40, 60, 30); return c.toDataURL('image/png').split(',')[1]; });
  await p.setInputFiles('#logoFile', { name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') }); await p.waitForSelector('#logoUse');
  console.log('logo colors:', (await p.$$eval('.logo-col', a => a.map(l => l.textContent.replace(/\s+/g, ' ').trim() + (l.querySelector('input').checked ? ' [x]' : '')))).join(' | '));
  await p.click('#logoUse'); await p.waitForTimeout(200);
  console.log('brand colors now', JSON.stringify(await p.evaluate(() => state.cfg.seeds)), '(expect navy then gold) |', (await p.textContent('#logoCols')).trim().slice(0, 60));
  // the gold brand color isn't flagged as amber; a suggested color would be
  const notes = await p.evaluate(() => TB.checks(opts()).map(x => x.text).filter(t => /look (amber|red|green)/.test(t)));
  console.log('amber note about a brand color:', notes.length ? notes[0].slice(0, 120) : 'none', '(expect none)');
  console.log('a suggested amber is still flagged:', await p.evaluate(() => TB.checks(Object.assign(opts(), { dataColors: opts().dataColors.concat('#E8A317') })).some(x => /look amber/.test(x.text) && /#E8A317/.test(x.text))));
  // Other options: the first suggestion differs between data colors
  const firsts = await p.evaluate(() => { const dc = dataColors(); return dc.map((c, i) => i < state.cfg.seeds.length ? null : (TB.alternatives(dc, i, surface())[0] || {}).hex).filter(Boolean); });
  console.log('first other option for each suggested color', firsts.join(', '), '| all different', new Set(firsts).size === firsts.length);
  const shades = await p.evaluate(() => { const dc = dataColors(); return dc.map((c, i) => i < state.cfg.seeds.length ? null : TB.alternatives(dc, i, surface()).filter(a => /shade of your brand/.test(a.why)).map(a => a.hex)[0]).filter(Boolean); });
  console.log('brand shades offered', shades.join(', '), '| distinct', new Set(shades).size, 'of', shades.length);
  await p.click('[data-alt="2"]'); await p.waitForTimeout(150);
  console.log('panel opens', await p.isVisible('#altPanel'), '| options', await p.$$eval('#altPanel .alt', a => a.length));
  await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(150);
  console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  console.log('errors', errs); await b.close();
})();
