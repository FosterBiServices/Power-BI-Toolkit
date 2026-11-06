// Layout Designer fixes: a taller or larger page is never the Best fit and says it changes the page size;
// a logo added to the header is drawn on the background (and Step 4 says when it isn't); visuals can be renamed
// in the positions table.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext()).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/layout-designer.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(400);
  // ---- suggestions: 30 bars with no scroll limit don't fit a 1280 x 720 page ----
  await p.evaluate(() => { document.getElementById('suggestBox').open = true; });
  await p.click('#sgGo'); await p.fill('#sgvShow2', ''); await p.fill('#sgvN2', '30'); await p.waitForTimeout(200);
  const cards = await p.$$eval('#sgOut .sg', a => a.map(x => ({ name: x.querySelector('h4').childNodes[0].textContent, best: !!x.querySelector('.rec-tag'), size: (x.querySelector('.sg-size') || {}).textContent || '' })));
  cards.forEach(c => console.log('  ' + c.name.padEnd(40) + (c.best ? ' BEST FIT' : '         ') + (c.size ? ' | ' + c.size : '')));
  console.log('best fit changes the size:', cards.some(c => c.best && c.size), '(expect false) | size-changing cards say so:', cards.filter(c => /Taller|Larger/.test(c.name)).every(c => c.size), '| page still', await p.evaluate(() => state.cfg.w + 'x' + state.cfg.h));
  // ---- logo ----
  await p.check('#logoOn'); await p.waitForTimeout(100);
  console.log('logo box, no image: note says', JSON.stringify((await p.textContent('#bgLogoNote')).slice(0, 60)));
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAICAYAAADwdn+XAAAAGUlEQVR42mNk+M9Qz0AEYBxVSF+FAAAt5wr5/1uRxQAAAABJRU5ErkJggg==', 'base64');
  await p.setInputFiles('#logoFile', { name: 'logo.png', mimeType: 'image/png', buffer: png }); await p.waitForTimeout(500);
  console.log('after adding a logo: drawn on the background', await p.isChecked('#logoInBg'), '| in the background SVG', await p.evaluate(() => /<image id="Logo"/.test(state.out.bg)), '| note empty', await p.evaluate(() => $('bgLogoNote').textContent === ''));
  await p.uncheck('#logoInBg'); await p.waitForTimeout(150);
  console.log('unticked: note', JSON.stringify((await p.textContent('#bgLogoNote')).slice(0, 70)), '| in SVG', await p.evaluate(() => /<image id="Logo"/.test(state.out.bg)));
  // ---- rename in the positions table ----
  const ren = await p.$$eval('#posTable input.ren', a => a.map(i => i.value));
  console.log('renamable rows', ren.length, '| first', ren.slice(0, 4).join(', '));
  const first = await p.$('#posTable input.ren[data-ren^="g"]'); const id = await first.getAttribute('data-ren');
  await first.fill('Revenue by month'); await first.dispatchEvent('change'); await p.waitForTimeout(200);
  console.log('renamed', id, '->', await p.evaluate(i => state.L.items.find(o => o.id === i).title, id), '| in wireframe', await p.evaluate(() => state.out.wf.includes('Revenue by month')), '| in copied positions', await p.evaluate(() => state.out.tsv.includes('Revenue by month')));
  const h = await p.$('#posTable input.ren[data-ren^="h"]');
  if (h) { const hid = await h.getAttribute('data-ren'); await h.fill('Net Income'); await h.dispatchEvent('change'); await p.waitForTimeout(150); console.log('header tile', hid, '->', await p.evaluate(i => state.L.items.find(o => o.id === i).title, hid)); }
  await p.reload(); await p.waitForTimeout(400);
  console.log('after reload kept', await p.evaluate(i => (state.L.items.find(o => o.id === i) || {}).title, id));
  await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(200);
  console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  console.log('errors', errs); await b.close();
})();
