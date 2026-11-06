// Model Linter: no format-string finding for measures that return text, an SVG image or HTML,
// and no visible-key finding for the Date table's own date (a fact table's date is info, not a warning).
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext()).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/model-linter.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  const r = await p.evaluate(() => {
    const T = (...c) => c.join('\t');
    const rows = [T('Kind', 'Table', 'Name', 'Type', 'Folder', 'Flags', 'Description', 'Expression', 'ToTable', 'ToColumn', 'Summarize', 'SortBy', 'Hierarchies', 'Storage', 'Source'),
      T('Table', 'Sales', 'Sales'), T('Table', 'Date', 'Date', 'Time'),
      T('Column', 'Sales', 'Order Date', 'DateTime', '', '', '', '', '', '', 'None'),
      T('Column', 'Sales', 'Amount', 'Double', '', '', '', '', '', '', 'None'),
      T('Column', 'Date', 'Date', 'DateTime', '', 'key', '', '', '', '', 'None'),
      T('Measure', 'Sales', 'Total Sales', '', 'Sales', '', '', 'SUM( Sales[Amount] )'),
      T('Measure', 'Sales', 'As Of Label', '', 'Report', '', '', '"Data to " & FORMAT( MAX( Sales[Order Date] ), "mmm yyyy" )'),
      T('Measure', 'Sales', 'Trend SVG', '', 'Report', '', '', 'VAR _svg = "data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\'></svg>" RETURN _svg'),
      T('Measure', 'Sales', 'Label', '', 'Report', '', '', 'VAR _t = FORMAT( [Total Sales], "#,0" ) RETURN _t'),
      T('Measure', 'Sales', 'Flagged Text', '', 'Report', 'text', '', '[Label]'),
      T('Relationship', 'Sales', 'Order Date', 'Many:One', '', '', '', '', 'Date', 'Date'),
      T('Model', 'Model', 'Model')];
    const m = ML.parse(rows.join('\n'));
    const res = ML.lint(m, {});
    const out = res.findings || res.out || res;
    const list = Array.isArray(out) ? out : (res.list || []);
    return { fmt: list.filter(f => f.rule === 'format').map(f => f.name), keys: list.filter(f => f.rule === 'keys').map(f => f.table + '[' + f.name + '] ' + f.sev), note: (res.notes || {}).format || '',
      plain: ML.returnsText('SUM( Sales[Amount] )'), ifText: ML.returnsText('IF( [x] > 0, "Up", "Down" ) & ""') };
  });
  console.log('format findings', JSON.stringify(r.fmt), '(expect ["Total Sales"])');
  console.log('format note', r.note);
  console.log('key findings', JSON.stringify(r.keys), '(expect only Sales[Order Date] info)');
  console.log('SUM is text', r.plain, '(expect false) | & "" is text', r.ifText, '(expect true)');
  console.log('errors', errs); await b.close();
})();
