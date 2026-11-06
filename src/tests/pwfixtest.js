// Power Query Writer fix loop: a fix prompt from the page's findings and/or the Desktop error, with the current query as
// the starting point; a fixed reply with CHANGES is read and checked again; a clean reply with no error has nothing to fix.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext()).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/power-query-writer.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  const cols = 'CREATE DATE\tACTUAL BEGIN DATE\tACTUAL END DATE\tUSER ID\tSTATE ID\tOFFICE\tSERVICE\tCOMPLETION STATUS\tPROGRAM\tCOMMENTS\n2024-01-05\t2024-01-08\t2024-03-01\t1001\tA12\tNorth\tTraining\tComplete\tWIOA\tok';
  await p.fill('#goal', 'Keep completed services from 2024 on, add Duration Days, remove COMMENTS.'); await p.fill('#columns', cols); await p.check('#typeSteps');
  const reply = fs.readFileSync(__dirname + '/pw_reply_copilot.txt', 'utf8');
  await p.fill('#pwReply', reply); await p.waitForTimeout(300);
  let f = await p.evaluate(() => ({ shown: !$('fixBox').hidden, msg: $('fixMsg').textContent, t: state.fix }));
  console.log('findings only: prompt shown', f.shown, '|', f.msg.slice(0, 90));
  console.log('  has the query', f.t.includes('RemovedComments = Table.RemoveColumns(Duration, {"COMMENTS"})'), '| lists the finding', /MissingField\.Ignore/.test(f.t), '| keeps the type map rule', /and the type map \(TypePairs/.test(f.t), '| CHANGES block asked', /@@@ CHANGES @@@/.test(f.t));
  await p.fill('#pwError', "Expression.Error: The column 'ACTUAL END DATE' of the table wasn't found."); await p.waitForTimeout(200);
  f = await p.evaluate(() => ({ t: state.fix, msg: $('fixMsg').textContent }));
  console.log('with the Desktop error: in TASK', /TASK \(what to fix\)\nFix this problem from Power BI Desktop: Expression\.Error/.test(f.t), '| sections', (f.t.match(/^(TASK|CONTEXT|STARTING POINT|RULES|FINAL VALIDATION|REPLY FORMAT)\b/gm) || []).join(','), '| chars', f.t.length);
  console.log('download button on the fix prompt', await p.evaluate(() => !!Array.from(document.querySelectorAll('.codebox')).find(x => x.querySelector('#pwFixView') && /Download/.test(x.textContent))));
  // Copilot's fixed reply
  const fixed = reply.replace('Table.RemoveColumns(Duration, {"COMMENTS"})', 'Table.RemoveColumns(WithDuration, {"COMMENTS"}, MissingField.Ignore)').replace('    Duration = Table.AddColumn(', '    WithDuration = Table.AddColumn(')
    .replace('@@@ STEPS @@@', '@@@ CHANGES @@@\nRemovedComments: added MissingField.Ignore so a missing COMMENTS column does not break the refresh\nWithDuration: renamed from Duration\n@@@ END @@@\n@@@ STEPS @@@');
  await p.fill('#pwReply', fixed); await p.fill('#pwError', ''); await p.waitForTimeout(300);
  f = await p.evaluate(() => ({ changes: $('changesBox').textContent, shown: !$('fixBox').hidden, msg: $('fixMsg').textContent, checks: Array.from(document.querySelectorAll('#checkList li')).map(l => l.textContent.slice(0, 40)) }));
  console.log('fixed reply: changes shown', /What Copilot changed.*MissingField/.test(f.changes), '| fix prompt hidden', !f.shown, '|', f.msg.slice(0, 40), '| checks', f.checks.join(' / '));
  await p.reload(); await p.waitForTimeout(300);
  console.log('after reload: reply kept', await p.evaluate(() => /WithDuration/.test($('pwReply').value)));
  console.log('errors', errs); await b.close();
})();
