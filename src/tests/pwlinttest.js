// Power Query Writer: the deeper reply checks. Copilot's real reply (Nov 2026, services workbook, type map) and a
// broken one: made-up function, wrong argument count, [Column] in TransformColumns, Text.Upper(_) in AddColumn,
// a step out of order, a changed type map, and an unclosed bracket.
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext()).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/power-query-writer.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);
  const cols = 'CREATE DATE\tACTUAL BEGIN DATE\tACTUAL END DATE\tUSER ID\tSTATE ID\tOFFICE\tSERVICE\tCOMPLETION STATUS\tPROGRAM\tCOMMENTS\n2024-01-05\t2024-01-08\t2024-03-01\t1001\tA12\tNorth\tTraining\tComplete\tWIOA\tok';
  const run = (reply, typeMap) => p.evaluate(([c, r, tm]) => { const inp = Object.assign({}, inputs(), { columns: c, typeMap: tm, makeParams: true }); const x = PW.parseReply(r); return PW.checks(x.code, inp).list.map(k => k.level + ' | ' + k.title + (k.level === 'ok' ? '' : ' | ' + (k.detail || '').slice(0, 150))); }, [cols, reply, typeMap]);
  const good = fs.readFileSync(__dirname + '/pw_reply_copilot.txt', 'utf8');
  console.log('Copilot reply:\n  ' + (await run(good, true)).join('\n  '));
  const bad = good.replace('Table.SelectRows(', 'Table.FilterRows(')
    .replace('Table.TransformColumnTypes(PromotedHeaders, AllTypePairs)', 'Table.TransformColumnTypes(PromotedHeaders, AllTypePairs, "en-US", 1)')
    .replace('{"USER ID", Int64.Type},', '{"USER ID", type text},').replace('{"PROGRAM", type text},\n', '')
    .replace('    RemovedComments = Table.RemoveColumns(Duration, {"COMMENTS"})', '    Upper = Table.TransformColumns(Duration, {{"OFFICE", each Text.Upper([OFFICE]), type text}}),\n    Proper = Table.AddColumn(Upper, "P", each Text.Proper(_), type text),\n    RemovedComments = Table.RemoveColumns(Later, {"COMMENTS"}, MissingField.Ignore),\n    Later = Proper');
  console.log('Broken reply:\n  ' + (await run(bad, true)).join('\n  '));
  console.log('Unclosed bracket:', (await run(good.replace('Table.SelectRows(', 'Table.SelectRows(('), true)).join(' | ').slice(0, 160));
  // the page example's reply: no false alarms
  const ex = await p.evaluate(() => { const x = PW.parseReply(PW_EX.reply || ''); return x ? PW.checks(x.code, inputs()).list.filter(k => k.level === 'err').map(k => k.title) : 'no example reply'; });
  console.log('example reply errors:', JSON.stringify(ex), '(expect [])');
  console.log('arity table entries', await p.evaluate(() => Object.keys(PWL.ARITY).length));
  console.log('errors', errs); await b.close();
})();
