const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1250, height: 950 }, acceptDownloads: true }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/theme-builder.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  console.log('banner', await p.locator('#exampleBanner').isVisible(), '| swatches', await p.locator('#swatches .sw').count(), '| checks:', await p.locator('#checks').innerText());
  await p.screenshot({ path: 'tb_1.png', fullPage: true });
  // type a hex in brand color keeps focus
  const hx = p.locator('[data-h=seed0]'); await hx.click(); await hx.fill('#003F88');
  console.log('focus kept:', await p.evaluate(() => document.activeElement.dataset.h), '| dc0', await p.locator('[data-h=dc0]').inputValue());
  // override swatch 3
  await p.locator('[data-h=dc2]').fill('#7A1F5C'); console.log('override marked', await p.locator('#swatches .sw.changed').count(), '| json has', (await p.locator('#jsonView').textContent()).includes('#7A1F5C'));
  // yellow brand -> warning
  await p.locator('[data-h=seed0]').fill('#F5C518'); console.log('yellow warn:', (await p.locator('#checks').innerText()).slice(0, 90));
  await p.locator('[data-h=seed0]').fill('#003F88');
  // dark background
  await p.click('[data-bg="#1F1F1F"]'); console.log('dark bg json background:', JSON.parse(await p.locator('#jsonView').textContent()).background, '| fg', JSON.parse(await p.locator('#jsonView').textContent()).foreground);
  await p.screenshot({ path: 'tb_dark.png', fullPage: false, clip: { x: 0, y: 0, width: 1250, height: 950 } });
  await p.evaluate(() => document.getElementById('s3').scrollIntoView()); await p.screenshot({ path: 'tb_dark_prev.png' });
  // font
  await p.selectOption('#font', 'Calibri'); const j = JSON.parse(await p.locator('#jsonView').textContent());
  console.log('font:', j.textClasses.title.fontFace, '| no Segoe left:', !JSON.stringify(j).includes('"Segoe UI"'), '| no placeholders:', !JSON.stringify(j).includes('themecolor'), '| dataColors', j.dataColors.length);
  await p.fill('#tName', 'Northwind Blue');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#download')]); console.log('download', dl.suggestedFilename());
  // count / style
  await p.selectOption('#count', '12'); await p.selectOption('#style', 'shades'); console.log('12 shades', await p.locator('#swatches .sw').count());
  await p.evaluate(() => localStorage.clear()); await p.setViewportSize({ width: 375, height: 800 }); await p.reload();
  console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  console.log('errors', errs); await b.close();
})();
