// Power Query Explainer, whole model: a PBIP folder (TMDL and model.bim) and the business-friendly document
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1250, height: 950 }, acceptDownloads: true }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|fonts/.test(m.text())) errs.push(m.text()); });
  await p.goto('http://localhost:8765/power-query-explainer.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.click('#modeModelBtn');
  // example: business document already filled in
  console.log('example: step5', await p.locator('#mStep5').isVisible(), '| progress', (await p.locator('#bProgress').innerText()).replace(/\s+/g, ' '), '(expect 3 of 3) | title', await p.inputValue('#bTitle'));
  await p.click('#bPreviewBox summary');
  const fr = p.frameLocator('#bPreview');
  console.log('preview h1:', await fr.locator('h1').innerText(), '| tables h3:', (await fr.locator('h3').allInnerTexts()).join(', '));
  console.log('preview personal note:', /personal folder on one computer/.test(await fr.locator('body').innerText()), '| settings row:', (await fr.locator('table').last().innerText()).replace(/\s+/g, ' ').slice(0, 80));
  await p.screenshot({ path: 'mq_1.png', fullPage: true });
  // downloads
  const [d1] = await Promise.all([p.waitForEvent('download'), p.click('#bDocx')]); await d1.saveAs('dl_mq.docx'); console.log('docx name:', d1.suggestedFilename());
  const [d2] = await Promise.all([p.waitForEvent('download'), p.click('#bHtml')]); await d2.saveAs('dl_mq.html'); console.log('html name:', d2.suggestedFilename());
  try { console.log('docx check:', execFileSync('python3', ['-c', [
    'import zipfile,xml.dom.minidom as m', 'z=zipfile.ZipFile("dl_mq.docx")', 'n=z.namelist()',
    '[m.parseString(z.read(x)) for x in n if x.endswith(".xml") or x.endswith(".rels")]',
    'd=z.read("word/document.xml").decode()', 'print(len(n),"parts, xml ok,", d.count("<w:p>"),"paragraphs,", d.count("<w:tbl>"),"tables,", "Heading2" in d)'].join('\n')]).toString().trim(), '(expect 7 parts, xml ok, 2 tables)'); } catch (e) { console.log('docx check failed', e.message); }

  // a PBIP folder with two semantic models: TMDL and an older model.bim
  await p.setInputFiles('#pbipInput', path.join(__dirname, 'pqpbip'));
  await p.waitForSelector('#pbipMsg .msg.ok');
  console.log('pbip:', await p.locator('#pbipMsg').innerText());
  console.log('pick visible', await p.locator('#pbipPickWrap').isVisible(), '| options', (await p.locator('#pbipPick option').allInnerTexts()).join(', '), '| banner', await p.locator('#exampleBanner').isVisible());
  const rows = await p.locator('#mBody tr').evaluateAll(tr => tr.map(r => r.querySelector('.nm').textContent.trim() + '=' + r.querySelector('.fmt').textContent.trim()));
  console.log('queries:', rows.join(' | '), '(expect Customer List, Sales, Targets tables; Products not loaded; fnTrim function; ServerName, StartDate parameters; no Date, no ShouldNotLoad)');
  console.log('step counts:', (await p.locator('#mBody td.num').allInnerTexts()).join(','), '| title', await p.inputValue('#bTitle'));
  console.log('model findings:', (await p.locator('#mFindings').innerText()).replace(/\n+/g, ' | ').slice(0, 300));
  console.log('biz progress:', (await p.locator('#bProgress').innerText()).replace(/\s+/g, ' '), '(expect 0 of 3)');
  const bp = await p.locator('#bPromptView').innerText();
  console.log('biz prompt sections:', ['## TASK', '## CONTEXT', '## RULES', '## REPLY FORMAT', '## STARTING POINT: table 1: Customer List'].map(s => bp.includes(s)).join(','), '| sources line:', (bp.match(/Data read from: .*/g) || []).join(' || '));
  console.log('uses line:', (bp.match(/Uses: .*/g) || []).join(' || '));
  console.log('doc msg:', await p.locator('#bDocMsg').innerText());
  const ft = await fr.locator('body').innerText();
  console.log('fallback doc steps:', (await fr.locator('ul').first().allInnerTexts()).join(' / ').slice(0, 300));
  console.log('fallback has sources table:', /SQL Server database “SalesDW”/.test(ft), /a shared network folder/.test(ft), '| settings', /StartDate\s+2023-01-01/.test(ft));
  // paste a business reply (one table; template block repeated must be skipped)
  const reply = '```\n@@@ TABLE @@@\nTABLE: Table name\nPURPOSE: What this table is for in the reports.\n@@@ END @@@\n@@@ TABLE @@@\nTABLE: Sales\nPURPOSE: Every sale since the start date.\nSOURCE: The SalesDW database.\nROW: One sale.\nSTEPS:\n- Leaves out sales before the start date.\n- Adds each product\'s category.\nCHECK: Only if readers should know something.\n@@@ END @@@\n```';
  await p.fill('#bReply', reply); await p.click('#bAdd');
  console.log('reply msg:', await p.locator('#bReplyMsg').innerText(), '| progress', (await p.locator('#bProgress').innerText()).replace(/\s+/g, ' '), '(expect 1 of 3)');
  await p.click('#bPreviewBox summary'); await p.click('#bPreviewBox summary');
  const ft2 = await fr.locator('body').innerText();
  console.log('doc uses reply:', /Every sale since the start date/.test(ft2), '| template CHECK dropped:', !/Only if readers/.test(ft2), '| template block skipped:', !/What this table is for/.test(ft2));
  // comments back in one go: a TMDL script for queries read from TMDL
  const mr = '```\n@@@ SUMMARY @@@\nQUERY: Sales\nTEXT: Sales from SalesDW.\n@@@ END @@@\n' + ['Source', 'dbo_FactSales', 'Filtered Rows', 'Merged Queries', 'Expanded Products'].map(n => '@@@ STEP @@@\nQUERY: Sales\nNAME: ' + n + '\nCOMMENT: Does ' + n + '.\n@@@ END @@@').join('\n')
    + '\n@@@ STEP @@@\nQUERY: Products\nNAME: Source\nCOMMENT: Connects.\n@@@ END @@@\n```';
  await p.fill('#mReply', mr); await p.click('#mAdd');
  console.log('tmdl box', await p.locator('#mTmdlBox').isVisible(), '|', await p.locator('#mTmdlTitle').innerText(), '(expect 2 queries)');
  const script = await p.locator('#mTmdlView').innerText();
  console.log(script.split('\n').slice(0, 14).map(l => l.replace(/\t/g, '→')).join('\n'));
  // the script read back gives the same queries, with the comments, and keeps each object's other lines
  const back = await p.evaluate(sc => { const r = pbipTmdlQueries(sc); return r.tables.map(t => t.name + ':' + t.parts.map(x => x.name + '[' + x.props.join('|') + '] comments=' + (x.code.match(/\/\/ /g) || []).length).join()).concat(r.exprs.map(e => e.name + '[' + e.props.join('|') + ']')).join(' || '); }, script);
  console.log('round trip:', back);
  // TMDL copied from TMDL view, pasted in the box
  const tv = 'createOrReplace\n\n\ttable Orders\n\t\tlineageTag: 9\n\n\t\tpartition Orders = m\n\t\t\tmode: import\n\t\t\tsource =\n\t\t\t\t\tlet\n\t\t\t\t\t    Source = Csv.Document(File.Contents("\\\\share\\orders.csv"))\n\t\t\t\t\tin\n\t\t\t\t\t    Source\n\n\texpression Region = "West" meta [IsParameterQuery=true, Type="Text", IsParameterQueryRequired=true]\n\t\tlineageTag: 7\n';
  await p.fill('#mInput', tv);
  console.log('pasted TMDL:', (await p.locator('#mBody tr').evaluateAll(tr => tr.map(r => r.querySelector('.nm').textContent.trim() + '=' + r.querySelector('.fmt').textContent.trim()))).join(' | '), '| msg', JSON.stringify(await p.locator('#mMsg').innerText()));
  await p.setInputFiles('#pbipInput', path.join(__dirname, 'pqpbip')); await p.waitForSelector('#pbipMsg .msg.ok');
  // second model in the folder
  await p.selectOption('#pbipPick', '1'); await p.waitForTimeout(200);
  console.log('legacy:', await p.locator('#pbipMsg').innerText(), '| rows', (await p.locator('#mBody tr .nm').allInnerTexts()).join(', '));
  // persists across reload
  await p.reload(); await p.click('#modeModelBtn');
  console.log('after reload rows', await p.locator('#mBody tr').count(), '| mode model', await p.locator('#modeModel').isVisible());
  await p.setViewportSize({ width: 390, height: 800 }); console.log('mobile hscroll', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await p.screenshot({ path: 'mq_2.png', fullPage: true });
  // Clear entries empties everything and stays empty
  await p.click('#clearEntries'); await p.click('#clearYes'); await p.reload();
  console.log('after clear: input', (await p.inputValue('#mInput')).length, '| step5', await p.locator('#mStep5').isVisible(), '| title', JSON.stringify(await p.inputValue('#bTitle')));
  console.log('errors', errs); await b.close();
})();
