// Power Query Writer: the type map. Shown once columns are pasted, types from the pasted rows (text otherwise),
// in the prompt as a required step when ticked (the conditional rule when not), and a reply that uses it checks clean.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext()).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/power-query-writer.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  await p.fill('#goal', 'Keep only completed services from 2024 on.');
  await p.fill('#columns', ''); console.log('no columns: box hidden', await p.isHidden('#typeMapBox'));
  await p.fill('#columns', 'CREATE DATE\tUSER ID\tSTATE ID\tOFFICE\tCOMPLETION STATUS\n2024-01-05\t1001\tA12\tNorth\tComplete\n2024-02-11\t1002\tB07\tSouth\tOpen');
  await p.waitForTimeout(150);
  console.log('ticked by default', await p.isChecked('#typeMap'));
  console.log('type map:\n' + await p.evaluate(() => $('typeMapCode').textContent));
  const pr = await p.evaluate(() => state.prompt);
  console.log('prompt: required type map', /Set the column types with this type map\. It is required/.test(pr), '| pairs in prompt', /\{"USER ID", Int64\.Type\}/.test(pr), '| conditional rule absent', !/If the TASK requires changing existing column types/.test(pr));
  await p.uncheck('#typeMap'); await p.waitForTimeout(100);
  const pr2 = await p.evaluate(() => state.prompt);
  console.log('unticked: conditional rule back', /If the TASK requires changing existing column types/.test(pr2), '| no type map', !/TypePairs = \{/.test(pr2));
  await p.check('#typeMap');
  await p.evaluate(() => { $('moreBox').open = true; }); await p.fill('#culture', 'en-US'); await p.waitForTimeout(100);
  console.log('culture reaches the type step', await p.evaluate(() => /Table\.TransformColumnTypes\(PromotedHeaders, AllTypePairs, "en-US"\)/.test($('typeMapCode').textContent)));
  await p.fill('#culture', '');
  // a reply that uses the type map
  const tm = await p.evaluate(() => PW.typeMap(PW.parseColumns($('columns').value), 'PromotedHeaders'));
  const reply = '@@@ QUERY @@@\nlet\n    Source = Excel.Workbook(File.Contents(FilePath), null, true),\n    Sheet = Source{[Item = "Services", Kind = "Sheet"]}[Data],\n    PromotedHeaders = Table.PromoteHeaders(Sheet, [PromoteAllScalars = true]),\n'
    + tm + ',\n    Completed = Table.SelectRows(ChangeTypes, each [COMPLETION STATUS] = "Complete" and [CREATE DATE] >= #date(2024, 1, 1))\nin\n    Completed\n@@@ END @@@\n@@@ STEPS @@@\nSource: opens the workbook\n@@@ END @@@\n@@@ PARAMETERS @@@\n@@@ END @@@\n@@@ QUESTIONS @@@\n@@@ END @@@';
  await p.fill('#pwReply', reply); await p.waitForTimeout(300);
  console.log('reply checks:', (await p.$$eval('#checks .chk, #checks .msg, #checkList li, .check', a => a.map(x => x.textContent.replace(/\s+/g, ' ').trim().slice(0, 110)))).join(' || ') || (await p.textContent('#pwChecks').catch(() => '')).slice(0, 400));
  console.log('errors', errs); await b.close();
})();
