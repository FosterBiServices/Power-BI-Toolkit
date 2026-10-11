const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1250, height: 950 }, acceptDownloads: true }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/chart-patterns.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  const tmdl = () => p.locator('#tmdlView').textContent();
  console.log('banner', await p.locator('#exampleBanner').isVisible(), '| patterns', await p.locator('.cp-opt').count(), '(expect true 5) | menu has it', await p.locator('#suiteSwitch option[value="chart-patterns.html"]').count());
  console.log('example script:', (await tmdl()).split('\n').slice(0, 6).join(' / '));
  await p.screenshot({ path: 'cp_1.png', fullPage: true });
  for (const id of ['labels', 'stacked', 'bubbles', 'paging', 'window']) {
    await p.click('[data-pick=' + id + ']');
    const t = await tmdl(), steps = await p.locator('#steps li').count();
    console.log(id, '| measures', (t.match(/^\t\tmeasure /gm) || []).length, '| tables', (t.match(/^\ttable /gm) || []).length, '| steps', steps, '| theme step', await p.locator('#themeStep').isVisible(), '| errs', await p.locator('#checks .msg.err').count());
  }
  console.log('window table:', /table 'Window Dates'[\s\S]*source = VALUES \( 'Date'\[Date\] \)/.test(await tmdl()), '(expect true)');
  await p.click('[data-pick=paging]'); await p.evaluate(() => document.getElementById('s2').scrollIntoView()); await p.screenshot({ path: 'cp_paging.png' });
  await p.click('#preview [data-page="2"]'); console.log('page 2 preview shows #6:', (await p.locator('#preview').innerHTML()).includes('>#6<'), '(expect true)');
  // bubbles: theme file
  await p.click('[data-pick=bubbles]');
  const theme = path.join(__dirname, 'cp_theme_in.json'); fs.writeFileSync(theme, JSON.stringify({ name: 'Mine', dataColors: ['#123456'], visualStyles: { lineClusteredColumnComboChart: { '*': { title: [{ text: 'x' }] } } } }));
  await p.setInputFiles('#themeFile', theme);
  await p.selectOption('#x_bubble', '35');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#themeDl')]); const out = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  console.log('theme download', dl.suggestedFilename(), JSON.stringify(out.visualStyles.lineClusteredColumnComboChart), '| name kept', out.name, '(expect markerSize 35 and title kept)');
  await p.evaluate(() => document.getElementById('s5').scrollIntoView()); await p.screenshot({ path: 'cp_bubbles_out.png', fullPage: false });
  fs.unlinkSync(theme);
  // typing into an example field keeps only what was typed; the other example fields go
  await p.click('[data-pick=labels]');
  const m = p.locator('#f_measure'); await m.click(); await m.press('End'); await m.type('X');
  console.log('typed into example:', JSON.stringify(await p.locator('#f_measure').inputValue()), '| category', JSON.stringify(await p.locator('#f_category').inputValue()), '| banner', await p.locator('#exampleBanner').isVisible(), '| out hidden', await p.locator('#outBox').isHidden());
  // with the model
  await p.goto('http://localhost:8765/index.html'); await p.fill('#exportInput', fs.readFileSync(path.join(__dirname, 'ex_export.tsv'), 'utf8')); await p.waitForTimeout(200);
  await p.goto('http://localhost:8765/chart-patterns.html'); if (await p.locator('[data-suite=use]').count()) await p.click('[data-suite=use]');
  console.log('model stats:', await p.locator('#modelStats').innerText(), '| measure field after connect', JSON.stringify(await p.locator('#f_measure').inputValue()));
  await p.fill('#f_measure', 'Total Sales'); await p.fill('#f_category', "'Product'[Category]");
  console.log('model: fmt', await p.locator('#f_fmt').inputValue(), '| table', await p.locator('#f_table').inputValue(), '| checks:', (await p.locator('#checks').innerText()).slice(0, 60));
  console.log('subtitle uses fmt:', (await tmdl()).includes('FORMAT ( _value, "\\$#,0" )'));
  await p.fill('#f_category', "'Product'[Colour]"); console.log('bad column:', await p.locator('#checks .msg.err').innerText());
  await p.fill('#f_category', "'Product'[Category]");
  await p.click('[data-pick=paging]'); await p.fill('#f_item', "'Customer'[Customer Name]"); await p.fill('#f_key', "'Customer'[CustomerKey]");
  console.log('paging checks:', (await p.locator('#checks').innerText()).slice(0, 80), '| ALL keys', (await tmdl()).includes("ALL ( 'Customer'[CustomerKey], 'Customer'[Customer Name] )"));
  await p.reload(); console.log('saved after reload: measure', await p.locator('#f_measure').inputValue(), '| pattern', await p.locator('.cp-opt.on h3').innerText());
  // clear entries
  await p.click('#clearEntries'); await p.click('#clearYes'); await p.reload();
  console.log('after clear: banner', await p.locator('#exampleBanner').isVisible(), '| measure', JSON.stringify(await p.locator('#f_measure').inputValue()), '(expect false "")');
  await p.evaluate(() => localStorage.clear()); await p.setViewportSize({ width: 390, height: 800 }); await p.reload();
  for (const id of ['labels', 'paging', 'window']) { await p.click('[data-pick=' + id + ']'); console.log('mobile hscroll', id, await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)); }
  await p.screenshot({ path: 'cp_m.png', fullPage: true });
  console.log('errors', errs); await b.close();
})();
