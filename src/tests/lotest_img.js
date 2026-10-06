// Layout Designer: images in Copy for Figma, header image on the band, PNG at the page size
const { chromium } = require('playwright'); const fs = require('fs');
const pngSize = f => { const b = fs.readFileSync(f); return b.readUInt32BE(16) + 'x' + b.readUInt32BE(20); };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1300, height: 950 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const U = 'http://localhost:8765/';
  await p.goto(U + 'layout-designer.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  // custom page size
  await p.selectOption('#pSize', 'custom'); await p.fill('#pW', '1400'); await p.fill('#pH', '800');
  // an SVG logo and a header image
  const svgLogo = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="#1F6FB2"/></svg>';
  await p.check('#logoOn');
  await p.setInputFiles('#logoFile', { name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svgLogo) });
  await p.waitForFunction(() => /data:image\/png/.test(document.getElementById('wfThumb').innerHTML));
  console.log('logo stored as png', await p.evaluate(() => /^data:image\/png/.test(JSON.parse(localStorage.getItem('klo.cfg')).header.logo.src)));
  console.log('header image control shown (band)', await p.locator('#hdrImgWrap').isVisible());
  const band = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="200"><defs><linearGradient id="g"><stop offset="0" stop-color="#2C408E"/><stop offset="1" stop-color="#728DE3"/></linearGradient></defs><rect width="800" height="200" fill="url(#g)"/></svg>';
  await p.setInputFiles('#hdrImgFile', { name: 'band.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(band) });
  await p.waitForFunction(() => /lo-header-fill/.test(document.getElementById('bgThumb').innerHTML));
  console.log('header info:', await p.locator('#hdrImgInfo').innerText(), '| remove shown', await p.locator('#hdrImgClear').isVisible());
  await p.screenshot({ path: 'lo_img_1.png', fullPage: true });
  // Copy for Figma
  await p.check('#figmaOn');
  await p.click('[data-copy=wf-svg]'); const wf = await p.evaluate(() => navigator.clipboard.readText());
  console.log('wf copy: xlink ns', wf.includes('xmlns:xlink'), '| logo image', /<image xlink:href="data:image\/png/.test(wf), '| header pattern', wf.includes('url(#lo-header-fill)'));
  await p.click('[data-copy=bg-svg]'); const bg = await p.evaluate(() => navigator.clipboard.readText());
  console.log('bg copy: header image', bg.includes('id="lo-header-image"') && /xlink:href="data:image\/png/.test(bg));
  // PNGs
  const dl = async sel => { const [d] = await Promise.all([p.waitForEvent('download'), p.click(sel)]); const f = 'lo_dl_' + d.suggestedFilename().replace(/\s/g, '_'); await d.saveAs(f); return f; };
  for (const s of ['wf-png', 'wf-png2', 'bg-png1', 'bg-png2']) { const f = await dl('[data-dl=' + s + ']'); console.log(s, f, pngSize(f)); }
  console.log('(expect 1400x800, 2800x1600, 1400x800, 2800x1600)');
  // pptx carries the header image
  const px = await dl('[data-dl=pptx]'); const z = fs.readFileSync(px).toString('latin1');
  console.log('pptx header media', z.includes('ppt/media/header.png'), '| logo media', z.includes('ppt/media/logo.png'), '| srcRect', z.includes('<a:srcRect'));
  // style without a band hides the control; image survives a reload
  await p.selectOption('#hdrStyle', 'line'); console.log('control hidden (line)', !(await p.locator('#hdrImgWrap').isVisible()), '| no pattern', !(await p.locator('#bgThumb').innerHTML()).includes('lo-header-fill'));
  await p.selectOption('#hdrStyle', 'bleed'); await p.reload();
  console.log('after reload (bleed)', (await p.locator('#bgThumb').innerHTML()).includes('lo-header-fill'));
  await p.screenshot({ path: 'lo_img_2.png' });
  await p.click('#hdrImgClear'); console.log('removed', !(await p.locator('#bgThumb').innerHTML()).includes('lo-header-fill'));
  await p.setViewportSize({ width: 390, height: 800 }); await p.reload(); console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  console.log('errors', errs); await b.close();
})();
