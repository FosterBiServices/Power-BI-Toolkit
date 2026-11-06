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
  await p.evaluate(() => document.getElementById('s4').scrollIntoView()); await p.screenshot({ path: 'tb_dark_prev.png' });
  // font
  await p.selectOption('#font', 'Calibri'); const j = JSON.parse(await p.locator('#jsonView').textContent());
  console.log('font:', j.textClasses.title.fontFace, '| no Segoe left:', !JSON.stringify(j).includes('"Segoe UI"'), '| no placeholders:', !JSON.stringify(j).includes('themecolor'), '| dataColors', j.dataColors.length);
  console.log('bubble default: no combo lineStyles', !(j.visualStyles.lineClusteredColumnComboChart['*'].lineStyles), '(expect true)');
  await p.selectOption('#bubble', '30'); const jb = JSON.parse(await p.locator('#jsonView').textContent()); const cc = jb.visualStyles.lineClusteredColumnComboChart['*'];
  console.log('bubble 30:', JSON.stringify(cc.lineStyles), '| title kept', !!cc.title, '(expect [{"markerSize":30}] true)');
  await p.reload(); console.log('bubble saved', await p.locator('#bubble').inputValue(), '(expect 30)');
  await p.fill('#tName', 'Northwind Blue');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#download')]); console.log('download', dl.suggestedFilename());
  // other options for a suggested color (the owner's case: #386AA5 suggested a teal in spot 3)
  await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.click('[data-rmseed="1"]'); await p.locator('[data-h=seed0]').fill('#386AA5');
  const pal = await p.$$eval('#swatches [data-h]', els => els.map(e => e.value));
  console.log('palette', pal.join(' '), '| color 3', pal[2], '(expect #25A79B)', '| brand slot has no Other options:', await p.locator('#swatches .sw').first().locator('[data-alt]').count(), '(expect 0)');
  await p.click('[data-alt="2"]');
  const alts = await p.$$eval('#altPanel .alt', els => els.map(e => e.innerText.replace(/\s+/g, ' ')));
  console.log('options for color 3:', alts.length, '(expect 3-5)'); alts.forEach(a => console.log('   ', a));
  await p.screenshot({ path: 'tb_alt.png', fullPage: false, clip: { x: 0, y: 0, width: 1250, height: 950 } });
  await p.evaluate(() => document.getElementById('altPanel').scrollIntoView()); await p.screenshot({ path: 'tb_alt.png' });
  const pick = await p.locator('#altPanel .alt').nth(1).getAttribute('data-pick');
  await p.locator('#altPanel .alt').nth(1).click();
  const pal2 = await p.$$eval('#swatches [data-h]', els => els.map(e => e.value));
  console.log('picked', pick, '| color 3 now', pal2[2], '| others unchanged:', pal2.every((v, i) => i === 2 || v === pal[i]), '(expect true)', '| panel open:', await p.locator('#altPanel').isVisible(), '| go back link:', await p.locator('#altPanel .linkbtn[data-pick]').count(), '(expect 1)');
  console.log('json has pick', (await p.locator('#jsonView').textContent()).includes(pick), '(expect true)');
  await p.locator('#altPanel .linkbtn[data-pick]').click(); console.log('back to', (await p.$$eval('#swatches [data-h]', els => els.map(e => e.value)))[2], '(expect ' + pal[2] + ')', '| marked changed', await p.locator('#swatches .sw.changed').count(), '(expect 0)');
  await p.click('[data-altclose]'); console.log('closed', await p.locator('#altPanel').count(), '(expect 0)');
  await p.setViewportSize({ width: 390, height: 800 }); await p.click('[data-alt="3"]');
  console.log('390px hscroll with options open', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), '(expect false)');
  await p.evaluate(() => document.getElementById('altPanel').scrollIntoView()); await p.screenshot({ path: 'tb_alt_mobile.png' });
  await p.setViewportSize({ width: 1250, height: 950 });
  console.log('ratio note', (await p.locator('#s2').locator('xpath=../..').innerText()).includes('readable as text'), '(expect true)');
  // good / neutral / bad default to Excel's conditional formatting colors
  await p.evaluate(() => localStorage.clear()); await p.reload();
  const je = JSON.parse(await p.locator('#jsonView').textContent()), js = JSON.stringify(je);
  console.log('excel default', je.good, je.neutral, je.bad, '(expect #006100 #9C5700 #9C0006)', '| preset pressed', await p.locator('[data-sent="0"]').getAttribute('aria-pressed'), '(expect true)');
  console.log('checks:', await p.locator('#checks').innerText());
  await p.evaluate(() => document.getElementById('s4').scrollIntoView()); await p.screenshot({ path: 'tb_excel.png' });
  await p.click('[data-sent="2"]'); console.log('blue/orange', JSON.parse(await p.locator('#jsonView').textContent()).good, '(expect #1D6FA3)');
  // count / style
  await p.selectOption('#count', '12'); await p.selectOption('#style', 'shades'); console.log('12 shades', await p.locator('#swatches .sw').count(), '| shades have no Other options', await p.locator('[data-alt]').count(), '(expect 0)');
  // visual settings: all visuals, then a kind of visual wins over it
  await p.evaluate(() => localStorage.clear()); await p.reload();
  const J = async () => JSON.parse(await p.locator('#jsonView').textContent());
  let jv = await J();
  console.log('example visual settings: card value', jv.visualStyles.cardVisual['*'].value[0].fontSize, '(expect 28) | table banded', JSON.stringify(jv.visualStyles.tableEx['*'].values[0].backColorSecondary) !== JSON.stringify(jv.visualStyles.tableEx['*'].values[0].backColorPrimary), '(expect true) | title size', jv.visualStyles['*']['*'].title[0].fontSize, '(expect 14)');
  await p.click('#resetVis'); jv = await J();
  console.log('undo: title size', jv.visualStyles['*']['*'].title[0].fontSize, '(expect 18) | undo hidden', await p.locator('#resetVis').isHidden(), '(expect true)');
  await p.selectOption('#v-all-legend', 'on'); await p.selectOption('#v-all-legendPos', 'BottomCenter'); await p.selectOption('#v-all-border', 'on'); await p.selectOption('#v-all-labels', 'off'); await p.selectOption('#v-all-title', 'off');
  jv = await J(); const V = jv.visualStyles;
  console.log('all legend', V['*']['*'].legend[0].show, V['*']['*'].legend[0].position, '| clustered column legend (template had off)', V.clusteredColumnChart['*'].legend[0].show, '(expect true BottomCenter true)');
  console.log('all border', V['*']['*'].border[0].show, V.card['*'].border[0].show, '| labels off on charts', V.clusteredColumnChart['*'].labels[0].show, V.pieChart['*'].labels[0].show, '| card value labels untouched', !('show' in V.card['*'].labels[0]), '| * labels kept', V['*']['*'].labels[0].show, '(expect true true false false true true)');
  console.log('group says "same as all":', await p.locator('#v-cards-title option').first().textContent(), '(expect All visuals: Hide)');
  await p.click('#visGroups details[data-g=cards] summary'); await p.selectOption('#v-cards-title', 'on'); await p.selectOption('#v-cards-valueSize', '40'); await p.selectOption('#v-cards-accentBar', 'off');
  await p.click('#visGroups details[data-g=tables] summary'); await p.selectOption('#v-tables-header', 'plain'); await p.selectOption('#v-tables-fontSize', '12'); await p.selectOption('#v-tables-gridV', 'on');
  await p.click('#visGroups details[data-g=lines] summary'); await p.selectOption('#v-lines-lineWidth', '5'); await p.selectOption('#v-lines-markers', 'on');
  await p.click('#visGroups details[data-g=slicers] summary'); await p.selectOption('#v-slicers-slicerStyle', 'Dropdown');
  jv = await J(); const W2 = jv.visualStyles;
  console.log('cards title on', W2.card['*'].title[0].show, W2.cardVisual['*'].title[0].show, W2.kpi['*'].title[0].show, '| other titles off', W2['*']['*'].title[0].show, !('show' in W2.lineChart['*'].title[0]), '(expect true true true false true: line charts follow *)');
  console.log('card value', W2.card['*'].labels[0].fontSize, W2.cardVisual['*'].value[0].fontSize, W2.cardVisual['*'].value[0].$id, '| accent', W2.cardVisual['*'].accentBar[0].show, W2.multiRowCard['*'].card[0].barShow, '(expect 40 40 default false false)');
  console.log('table header plain bold', W2.tableEx['*'].columnHeaders[0].bold, W2.pivotTable['*'].columnHeaders[0].bold, '| font 12', W2.tableEx['*'].values[0].fontSize, W2.pivotTable['*'].rowHeaders[0].fontSize, '| col lines', W2.tableEx['*'].grid[0].gridVertical, '(expect true true 12 12 true)');
  console.log('lines', JSON.stringify(W2.lineChart['*'].lineStyles), JSON.stringify(W2.lineClusteredColumnComboChart['*'].lineStyles), '| slicer', JSON.stringify(W2.slicer['*'].data), '(expect strokeWidth 5, showMarker true; Dropdown)');
  console.log('counts', (await p.locator('#visGroups .vcount').allTextContents()).join(', '), '(expect 3 changed, 3 changed, 1 changed, 2 changed)');
  console.log('no placeholders', !JSON.stringify(jv).includes('themecolor'), '| no undefined', !JSON.stringify(jv).includes('undefined'));
  await p.evaluate(() => document.getElementById('s3').scrollIntoView()); await p.screenshot({ path: 'tb_vis.png' });
  await p.evaluate(() => document.getElementById('s4').scrollIntoView()); await p.screenshot({ path: 'tb_vis_prev.png' });
  await p.reload(); jv = await J();
  console.log('saved after reload', jv.visualStyles.cardVisual['*'].value[0].fontSize, await p.locator('#v-all-legend').inputValue(), '(expect 40 on)');
  await p.click('#visGroups details[data-g=cards] summary'); await p.selectOption('#v-cards-valueSize', ''); jv = await J(); console.log('back to same as all: card value', jv.visualStyles.cardVisual['*'].value[0].fontSize, '(expect 18, the template)');
  await p.evaluate(() => localStorage.setItem('ktb.cfg', JSON.stringify({ seeds: ['#1F6FB2'], vis: { all: { legend: 'maybe', title: 'off' }, groups: { cards: 'x', tables: { header: '<b>' }, nope: { a: 1 } } } }))); await p.reload(); jv = await J();
  console.log('junk visual settings dropped: title', jv.visualStyles['*']['*'].title[0].show, '| legend', jv.visualStyles['*']['*'].legend[0].show, '| counts', await p.locator('#visGroups .vcount').count(), '(expect false false 0)');
  await p.setViewportSize({ width: 390, height: 800 }); await p.click('#visGroups details[data-g=tables] summary');
  console.log('390px hscroll with visual settings open', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), '(expect false)');
  await p.evaluate(() => document.getElementById('s3').scrollIntoView()); await p.screenshot({ path: 'tb_vis_mobile.png' });
  await p.setViewportSize({ width: 1250, height: 950 });
  await p.evaluate(() => localStorage.clear()); await p.setViewportSize({ width: 375, height: 800 }); await p.reload();
  console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  console.log('errors', errs); await b.close();
})();
