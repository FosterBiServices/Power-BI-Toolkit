// Power Query Writer cleaning recipes: the fx functions. The type map calls fxApplyTypes by default; ticked recipes become
// required steps in the prompt with the functions listed; the page shows each function to add once; a reply that uses the
// steps checks clean; missing steps, functions that aren't listed and wrong argument counts are found; the person's own
// functions are accepted; choices survive a reload; no sideways scrolling on a phone.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/power-query-writer.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  await p.fill('#goal', 'Keep rows for the North office.');
  await p.fill('#columns', 'CREATE DATE\tUSER ID\tOFFICE\tAMOUNT\tWHEN\tNOTES\n2024-01-05\t1001\t north \t$1,234.50\t2024-01-05 15:15\tok\n2024-01-06\t1002\tSOUTH\t(45)\t2024-02-11 08:00\t');
  await p.waitForTimeout(150);
  console.log('recipes shown', await p.isVisible('#fxBox'), '| count', await p.$$eval('.recipe', a => a.length));
  console.log('type map only:', JSON.stringify(await p.evaluate(() => $('fxStepsCode').textContent.split('\n')[0])), '| functions', await p.evaluate(() => Array.from(document.querySelectorAll('#fxFns summary code')).map(x => x.textContent).join(',')));
  const tick = async id => { await p.check('.recipe[data-r="' + id + '"] input[data-on]'); await p.waitForTimeout(80); };
  const pick = async (id, col) => { await p.click('.recipe[data-r="' + id + '"] button[data-col="' + col + '"]'); await p.waitForTimeout(80); };
  await tick('blank'); await tick('trim');
  await tick('case'); await pick('case', 'OFFICE'); await p.selectOption('.recipe[data-r="case"] select', 'Upper');
  await tick('date'); console.log('date defaults to the date columns', await p.getAttribute('.recipe[data-r="date"] button[data-col="CREATE DATE"]', 'aria-pressed'));
  await tick('num'); await pick('num', 'AMOUNT'); await p.check('.recipe[data-r="num"] input[data-opt="whole"]');
  await tick('split'); console.log('split defaults to the date-time columns', await p.getAttribute('.recipe[data-r="split"] button[data-col="WHEN"]', 'aria-pressed'));
  await tick('nulls'); await pick('nulls', 'OFFICE'); await p.fill('.recipe[data-r="nulls"] input[data-opt="value"]', 'Unknown');
  await tick('dedupe'); await pick('dedupe', 'USER ID'); await p.check('.recipe[data-r="dedupe"] input[data-opt="last"]');
  await p.waitForTimeout(150);
  const code = await p.evaluate(() => $('fxStepsCode').textContent);
  console.log('steps:\n' + code);
  const pr = await p.evaluate(() => state.prompt);
  console.log('prompt: rule', /Clean and type the data with these steps\. They are required/.test(pr), '| builds on Deduped', /Every later step builds on Deduped\./.test(pr), '| code in it', pr.includes(code),
    '| functions listed', (pr.match(/^- fx[A-Za-z]+\(/gm) || []).length, '| call-by-name rule', /Call the functions under FUNCTIONS THAT ALREADY EXIST by name/.test(pr), '| validation line', /Every function called by name is a Power Query function or is listed/.test(pr));
  console.log('functions to add', await p.evaluate(() => Array.from(document.querySelectorAll('#fxFns summary code')).map(x => x.textContent).join(',')), '| code is the function', await p.evaluate(() => /^let\n    fxTrimText = \(InputTable as table/.test(PWF.BY.get('fxTrimText').code)));
  // a reply that uses the steps as given
  const q = 'let\n    Source = Excel.Workbook(File.Contents(FilePath), null, true),\n    Sheet = Source{[Item = "Data", Kind = "Sheet"]}[Data],\n    PromotedHeaders = Table.PromoteHeaders(Sheet, [PromoteAllScalars = true]),\n' + code + ',\n    North = Table.SelectRows(Deduped, each [OFFICE] = "NORTH")\nin\n    North';
  const wrap = c => '@@@ QUERY @@@\n' + c + '\n@@@ END @@@\n@@@ STEPS @@@\n@@@ END @@@\n@@@ PARAMETERS @@@\n@@@ END @@@\n@@@ QUESTIONS @@@\n@@@ END @@@';
  const lst = async () => p.$$eval('#checkList li', a => a.map(x => x.querySelector('.pill').textContent + ' ' + x.querySelector('b').textContent));
  await p.fill('#pwReply', wrap(q)); await p.waitForTimeout(250);
  console.log('clean reply:', (await lst()).join(' / '));
  await p.fill('#pwReply', wrap(q.replace(/    Trimmed = fxTrimText\(NoBlankRows\),\n/, '').replace('fxSetCase(Trimmed', 'fxSetCase(NoBlankRows'))); await p.waitForTimeout(250);
  console.log('step removed:', (await lst()).filter(x => /^(Fix|Check)/.test(x)).join(' / '));
  await p.fill('#pwReply', wrap(q.replace('    North = Table.SelectRows(Deduped, each [OFFICE] = "NORTH")', '    Phones = fxCleanPhone(Deduped, {"NOTES"}),\n    North = Table.SelectRows(Phones, each [OFFICE] = "NORTH")').replace('in\n    North', 'in\n    North'))); await p.waitForTimeout(250);
  console.log('unknown fx:', (await lst()).filter(x => /^(Fix|Check)/.test(x)).join(' / '));
  await p.evaluate(() => { $('moreBox').open = true; }); await p.fill('#myFns', 'fxCleanPhone(InputTable, Columns): keeps the digits'); await p.waitForTimeout(250);
  console.log('listed as mine:', (await lst()).filter(x => /^(Fix|Check)/.test(x)).join(' / ') || 'nothing to fix', '| in prompt', /^- fxCleanPhone\(InputTable, Columns\): keeps the digits$/m.test(await p.evaluate(() => state.prompt)));
  await p.fill('#pwReply', wrap(q.replace('fxSetCase(Trimmed, {"OFFICE"}, "Upper")', 'fxSetCase(Trimmed, {"OFFICE"})'))); await p.waitForTimeout(250);
  console.log('wrong argument count:', await p.evaluate(() => Array.from(document.querySelectorAll('#checkList li')).map(x => x.textContent).filter(t => /Wrong number/.test(t)).join('').slice(0, 140)));
  // the fix prompt keeps the cleaning steps
  await p.fill('#pwError', "Expression.Error: The import fxTrimText matches no exports."); await p.waitForTimeout(200);
  const fx = await p.evaluate(() => state.fix);
  console.log('fix prompt: keeps steps', /and the cleaning and type steps \(fxRemoveBlankRows, fxTrimText/.test(fx), '| lists functions', /FUNCTIONS THAT ALREADY EXIST/.test(fx), '| not-recognized hint', /function query isn.t in the file yet/.test(fx));
  await p.fill('#pwError', '');
  // the type map as steps after the cleaning steps
  await p.check('#typeSteps'); await p.waitForTimeout(150);
  const code2 = await p.evaluate(() => $('fxStepsCode').textContent);
  console.log('as steps: TypePairs after NullsReplaced', /ExistingCols = Table\.ColumnNames\(NullsReplaced\)/.test(code2), '| AMOUNT whole', /\{"AMOUNT", Int64\.Type\}/.test(code2), '| WHEN time', /\{"WHEN time", type time\}/.test(code2), '| kept WHEN stays text', /\{"WHEN", type text\}/.test(code2), '| Deduped on ChangeTypes', /Deduped = fxDedupe\(ChangeTypes/.test(code2), '| fxApplyTypes gone', !/fxApplyTypes/.test(code2));
  await p.uncheck('#typeSteps');
  await p.check('#haveFx'); await p.waitForTimeout(100);
  console.log('all functions listed when I have them', ((await p.evaluate(() => state.prompt)).match(/^- fx[A-Za-z]+\(InputTable/gm) || []).length);
  // reload keeps the choices
  await p.reload(); await p.waitForTimeout(300);
  console.log('after reload: steps kept', (await p.evaluate(() => $('fxStepsCode').textContent)) === code, '| case', await p.$eval('.recipe[data-r="case"] select', s => s.value));
  // phone
  const m = await (await b.newContext({ viewport: { width: 390, height: 800 } })).newPage(); await m.goto('http://localhost:8765/power-query-writer.html');
  await m.evaluate(v => localStorage.setItem('kpw.v', v), await p.evaluate(() => localStorage.getItem('kpw.v'))); await m.reload(); await m.waitForTimeout(300);
  await m.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
  console.log('mobile hscroll', await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth));
  await m.evaluate(() => $('recipes').scrollIntoView()); await m.screenshot({ path: 'pwfx_mobile.png' });
  console.log('errors', errs); await b.close();
})();
