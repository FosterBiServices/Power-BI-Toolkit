// Power Query Writer and Explainer: "let" and "in" in a query. Column names with the word "in" (or "let") written
// as [Amount in USD] or type table [Sign in = text] are names, not keywords, so a valid query must read without
// "no matching in". A query that really lacks its "in" (cut off, or a nested let without one) says which.
const { chromium } = require('playwright');
const Q = {
  colIn: 'let\n    Source = Sales,\n    Net = Table.AddColumn(Source, "Net", each [Amount in USD] - [Discount], type number)\nin\n    Net',
  typeIn: 'let\n    Source = Sales,\n    Typed = Value.ReplaceType(Source, type table [Sign in = text, Region = text])\nin\n    Typed',
  colLet: 'let\n    Source = Sales,\n    Kept = Table.SelectRows(Source, each [Days to let] > 0)\nin\n    Kept',
  nestedEach: 'let\n    Source = Sales,\n    Doubled = Table.AddColumn(Source, "X", each let v = [Amount] in v * 2)\nin\n    Doubled',
  nestedStep: 'let\n    Source = let a = 1 in a,\n    Result = Source\nin\n    Result',
  cutComma: 'let\n    Source = Sales,\n    Kept = Table.SelectRows(Source, each [Amount] > 0),',
  cutNoIn: 'let\n    Source = Sales,\n    Kept = Table.SelectRows(Source, each [Amount] > 0)',
  nestedNoIn: 'let\n    Source = Sales,\n    Doubled = Table.AddColumn(Source, "X", each let v = [Amount], w = v * 2)\nin\n    Doubled',
  stepNoIn: 'let\n    Source = let a = 1,\n    Result = Source\nin\n    Result'
};
const want = { colIn: 'Source,Net', typeIn: 'Source,Typed', colLet: 'Source,Kept', nestedEach: 'Source,Doubled', nestedStep: 'Source,Result',
  cutComma: /cut off/, cutNoIn: /no "in" line/, nestedNoIn: /line 3 has no matching "in" before the "\)"/, stepNoIn: /own "let" \(line 2\)/ };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext()).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  let bad = 0;
  for (const page of ['power-query-writer', 'power-query-explainer']) {
    await p.goto('http://localhost:8765/' + page + '.html'); await p.waitForTimeout(300);
    const got = await p.evaluate(qs => Object.fromEntries(Object.entries(qs).map(([k, v]) => { const r = parseM(v); return [k, r.error || r.steps.map(s => s.name).join(',') + ' -> ' + r.result]; })), Q);
    for (const k of Object.keys(Q)) {
      const ok = want[k] instanceof RegExp ? want[k].test(got[k]) : got[k] === want[k] + ' -> ' + want[k].split(',').pop();
      if (!ok) bad++;
      console.log(page.padEnd(22), k.padEnd(11), ok ? 'ok ' : 'BAD', got[k]);
    }
  }
  // the Writer's checks on a reply that reads a column with "in" in its name: no "can't be read"
  const w = await p.goto('http://localhost:8765/power-query-writer.html').then(() => p.waitForTimeout(300)).then(() => p.evaluate(code => {
    const inp = Object.assign({}, inputs(), { columns: 'Amount in USD\tDiscount\n10\t1' });
    return PW.checks(code, inp).list.filter(c => c.level === 'err').map(c => c.title);
  }, Q.colIn));
  console.log('Writer errors on [Amount in USD]:', JSON.stringify(w), '(expect [])'); if (w.length) bad++;
  console.log('prompt asks for let/in:', await p.evaluate(() => /starts with let and ends with in/.test(PW.prompt(inputs()))), '(expect true)');
  console.log(bad ? bad + ' wrong' : 'all as expected');
  if (bad) errs.push(bad + ' wrong');
  console.log('errors', errs); await b.close();
})();
