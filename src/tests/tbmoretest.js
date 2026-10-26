// Theme Builder: every property (from the theme schema), starting from a theme file, and settings copied from PBIP visuals
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1250, height: 950 } })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/theme-builder.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  const J = async () => JSON.parse(await p.locator('#jsonView').textContent());
  console.log('schema types', await p.$$eval('#propType option', o => o.length), '(expect 50+) | default visual', await p.locator('#propType').inputValue(), '(expect card)');
  // every property: a table's column header font size, a color, and a property the template doesn't set
  await p.selectOption('#propType', 'tableEx'); await p.selectOption('#propObj', 'columnHeaders');
  console.log('header rows', await p.locator('#propRows .prow').count(), '| font size placeholder', await p.locator('#pp-columnHeaders-fontSize').getAttribute('placeholder'), '(expect 10)');
  await p.fill('#pp-columnHeaders-fontSize', '13'); await p.locator('#pp-columnHeaders-fontSize').press('Tab');
  await p.fill('#pp-columnHeaders-backColor', '#334455'); await p.locator('#pp-columnHeaders-backColor').press('Tab');
  await p.selectOption('#pp-columnHeaders-wordWrap', 'false');
  let j = await J(); let ch = j.visualStyles.tableEx['*'].columnHeaders[0];
  console.log('header', ch.fontSize, JSON.stringify(ch.backColor), ch.wordWrap, '| family kept', ch.fontFamily, '(expect 13 {"solid":{"color":"#334455"}} false Segoe UI)');
  console.log('changes listed', await p.locator('#customList li').count(), '(expect 3) | count', await p.locator('#customCount').textContent());
  await p.fill('#pp-columnHeaders-fontSize', '99'); await p.locator('#pp-columnHeaders-fontSize').press('Tab');
  console.log('size kept in range', (await J()).visualStyles.tableEx['*'].columnHeaders[0].fontSize, '(expect 45, the schema max)');
  await p.fill('#pp-columnHeaders-backColor', 'blue-ish'); await p.locator('#pp-columnHeaders-backColor').press('Tab');
  console.log('bad hex marked', await p.locator('#pp-columnHeaders-backColor.bad').count(), '| color unchanged', JSON.stringify((await J()).visualStyles.tableEx['*'].columnHeaders[0].backColor), '(expect 1 #334455)');
  // all visuals (*), find
  await p.selectOption('#propType', '*'); await p.fill('#propFind', 'drop shadow');
  console.log('find "drop shadow" in all visuals', await p.locator('#propRows .prow').count(), '(expect some)');
  await p.fill('#propFind', ''); await p.selectOption('#propObj', 'dropShadow'); await p.selectOption('#pp-dropShadow-show', 'true');
  j = await J(); console.log('* dropShadow', j.visualStyles['*']['*'].dropShadow[0].show, '(expect true)');
  // property changes win over visual settings
  await p.selectOption('#v-all-shadow', 'off'); console.log('property beats All visuals', (await J()).visualStyles['*']['*'].dropShadow[0].show, '(expect true)');
  await p.locator('#customList [data-prm^="*|dropShadow"]').click(); console.log('removed: shadow', (await J()).visualStyles['*']['*'].dropShadow[0].show, '(expect false) | listed', await p.locator('#customList li').count(), '(expect 3)');
  await p.reload(); console.log('saved', await p.locator('#customList li').count(), '(expect 3)');
  await p.evaluate(() => document.getElementById('propRows').scrollIntoView()); await p.screenshot({ path: 'tb_props.png' });
  // settings from PBIP visuals
  await p.locator('#reportInput').setInputFiles(path.join(__dirname, 'tbpbip'));
  await p.waitForSelector('#fromVisual .vlist');
  console.log('theme question:', (await p.locator('#themeAsk3').innerText()).split('\n')[0], '(expect the theme Sample Retail)');
  await p.click('#themeAsk3 [data-tuse="keep"]'); console.log('keep: question gone', await p.locator('#themeAsk3').isHidden(), '| colors unchanged', (await J()).dataColors[0], '(expect true, not #2A5C8A)');
  console.log('visuals found', (await p.locator('#fromVisual .vlist > li').allInnerTexts()).map(x => x.split('\n')[0]).join(' | '));
  console.log('left out', (await p.$$eval('#fromVisual .skipped ul', d => d.map(x => [...x.children].map(li => li.textContent).join('; ')))).join(' || '));
  const checked = () => p.$$eval('#fromVisual [data-fv]:checked', x => x.length);
  console.log('none checked at first', await checked(), '| add button', await p.locator('#addFound').innerText(), await p.locator('#addFound').isDisabled(), '(expect 0, Check the visuals to add, true)');
  await p.fill('#fvFind', 'slicer'); console.log('find "slicer": shown', await p.locator('#fromVisual [data-fvi]:visible').count(), '(expect 1)');
  await p.click('#fvAll'); console.log('check all shown', await checked(), '(expect 1)');
  await p.fill('#fvFind', ''); await p.click('#fvNone'); console.log('uncheck all', await checked(), '(expect 0)');
  await p.check('#fromVisual [data-fpage="0"]'); console.log('page box', await checked(), '| button', await p.locator('#addFound').innerText(), '(expect 3, Add the 3 checked visuals...)');
  await p.click('#fvNone'); await p.click('#fvAll');
  await p.click('#addFound'); j = await J(); const V = j.visualStyles;
  const LS = V.listSlicer['*'];
  console.log('slicer states: value', JSON.stringify(LS.value), '(expect default fontSize 10, hover #204060, selected theme color 3, each with $id)');
  console.log('slicer: hover fill', JSON.stringify(LS.fillCustom), '| icon default', JSON.stringify(LS.selectionIcon), '| subtitle size from text', LS.subTitle && LS.subTitle[0].fontSize, '| no measure', !JSON.stringify(LS).includes('Total Sales'), '| no selection', !(LS.general && LS.general[0].filter), '(expect $id interaction:hover 50; #556677; 10; true; true)');
  await p.selectOption('#propType', 'listSlicer'); await p.selectOption('#propObj', 'value');
  console.log('every property: state groups', (await p.locator('#propRows .pgh').allInnerTexts()).join(' | '), '(expect Values, then hover and selected)');
  console.log('column legend', JSON.stringify(V.clusteredColumnChart['*'].legend[0]), '(expect show true, BottomCenter, fontSize 11)');
  console.log('column title', V.clusteredColumnChart['*'].title[0].fontSize, V.clusteredColumnChart['*'].title[0].bold, JSON.stringify(V.clusteredColumnChart['*'].title[0].fontColor), '| no title text copied', V.clusteredColumnChart['*'].title[0].text !== 'Sales by category', '(expect 14 true ThemeDataColor true)');
  console.log('column border', JSON.stringify(V.clusteredColumnChart['*'].border), '| gridlines', V.clusteredColumnChart['*'].valueAxis[0].gridlineShow, '| labels units', V.clusteredColumnChart['*'].labels[0].labelDisplayUnits, '(expect show radius 10; false; 1000)');
  console.log('card value', V.cardVisual['*'].value[0].fontSize, V.cardVisual['*'].value[0].bold, V.cardVisual['*'].value[0].$id, '| accent', V.cardVisual['*'].accentBar[0].show, '| shadow', V.cardVisual['*'].dropShadow[0].show, '| label for one field not copied', V.cardVisual['*'].label[0].show, '(expect 32 true default; false; true; true)');
  console.log('message', await p.locator('#fromVisual .msg').innerText());
  // paste
  await p.locator('details.extra:has(#visualPaste) summary').click(); await p.fill('#visualPaste', 'not json'); await p.click('#visualUse');
  console.log('paste junk:', await p.locator('#fromVisual .msg').innerText());
  // start from a theme file
  await p.locator('#themeBox summary').click(); await p.locator('#themeFile').setInputFiles(path.join(__dirname, 'tb_theme.json'));
  await p.waitForFunction(() => !document.getElementById('baseNote').hidden);
  j = await J();
  console.log('theme: name', j.name, '| colors', j.dataColors.join(' '), '| count', await p.locator('#count').inputValue());
  console.log('theme: fg', j.foreground, '| good', j.good, '| font', await p.locator('#font').inputValue(), j.textClasses.label.fontFace, '| page bg', JSON.stringify(j.visualStyles.page['*'].background[0].color), '(expect #1B2631 #1D6FA3 Lato Lato #F4F6F8)');
  console.log('theme: its styles', j.visualStyles['*']['*'].title[0].fontSize, JSON.stringify(j.visualStyles.slicer['*'].data), '| built-in table style gone', !j.visualStyles.tableEx || !j.visualStyles.tableEx['*'].sparklines, '(expect 13 Dropdown true)');
  console.log('note', await p.locator('#baseNote').innerText());
  await p.selectOption('#v-all-titleSize', '16'); console.log('settings on top of the file', (await J()).visualStyles['*']['*'].title[0].fontSize, '(expect 16)');
  await p.reload(); console.log('file kept after reload', (await J()).visualStyles.slicer['*'].data[0].mode, '(expect Dropdown)');
  await p.click('#dropBase'); j = await J(); console.log('built-in styles back: table sparklines', !!j.visualStyles.tableEx['*'].sparklines, '| colors kept', j.dataColors[1], '(expect true #7B4F9E)');
  await p.locator('#themeBox summary').click(); await p.fill('#themePaste', '{"hello": 1}'); await p.click('#themeUse'); console.log('not a theme:', await p.locator('#themeMsg').innerText());
  // PBIP folder in Step 1: only its colors, visual settings stay
  await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.selectOption('#v-all-titleSize', '20');
  await p.locator('#themeBox summary').click(); await p.locator('#reportThemeInput').setInputFiles(path.join(__dirname, 'tbpbip'));
  await p.waitForSelector('#themeAsk1 [data-tuse]');
  console.log('step 1 question:', (await p.locator('#themeAsk1').innerText()).split('\n')[0]);
  await p.click('#themeAsk1 [data-tuse="colors"]'); j = await J();
  console.log('only colors:', j.dataColors.join(' '), '| fg', j.foreground, '| bad', j.bad, '| title size kept', j.visualStyles['*']['*'].title[0].fontSize, '| built-in styles kept', !!j.visualStyles.tableEx['*'].sparklines, '| no base', await p.locator('#baseNote').isHidden(), '(expect the 7 file colors, #1B2631, #E07B39, 20, true, true)');
  console.log('msg', await p.locator('#themeMsg').innerText());
  await p.locator('#reportThemeInput').setInputFiles(path.join(__dirname, 'tbpbip')); await p.waitForSelector('#themeAsk1 [data-tuse]');
  await p.click('#themeAsk1 [data-tuse="all"]'); j = await J();
  console.log('start from it:', JSON.stringify(j.visualStyles.slicer['*'].data), '| base note', await p.locator('#baseNote').isVisible(), '(expect Dropdown true)');
  await p.locator('#reportThemeInput').setInputFiles(path.join(__dirname, 'pbiptest')); await p.waitForTimeout(500);
  console.log('folder without a theme:', await p.locator('#themeMsg').innerText());
  // junk saved
  await p.evaluate(() => localStorage.setItem('ktb.cfg', JSON.stringify({ seeds: ['#1F6FB2'], count: 'x', custom: { tableEx: { columnHeaders: { fontSize: 'big', bold: 1, backColor: { solid: { color: 'red' } }, nope: true } }, fake: { a: { b: 1 } }, card: 5 }, base: [1, 2] })));
  await p.reload(); j = await J();
  console.log('junk dropped: changes', await p.locator('#customList li').count(), '| base note', await p.locator('#baseNote').isHidden(), '| count', await p.locator('#count').inputValue(), '(expect 0 true 8)');
  await p.setViewportSize({ width: 390, height: 800 }); await p.reload();
  await p.selectOption('#propType', 'pivotTable');
  console.log('390px hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), '(expect false)');
  await p.evaluate(() => document.getElementById('propRows').scrollIntoView()); await p.screenshot({ path: 'tb_props_mobile.png' });
  console.log('errors', errs); await b.close();
})();
