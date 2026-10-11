/* ---------- Chart Patterns: core-visual charts with extra labels, paging or a highlighted window ---------- */
// A column as typed or picked: 'Product'[Category] or Product[Category]
function cpCol(s){
  const m = String(s || '').trim().match(/^'?((?:[^'\[]|'')*?)'?\s*\[([^\]]+)\]$/);
  return m && m[1].trim() ? { table: m[1].replace(/''/g, "'").trim(), column: m[2].trim() } : null;
}
function cpTbl(n){ return qName(n); }   // a table in DAX, always quoted (Date is a function name too)
function cpRef(c){ return cpTbl(c.table) + bracket(c.column); }
function cpMeasure(s){ return String(s || '').trim().replace(/^\[|\]$/g, ''); }
function cpHex(c){ const m = String(c || '').trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i); if (!m) return ''; let h = m[1]; if (h.length === 3) h = h.split('').map(x => x + x).join(''); return '#' + h.toUpperCase(); }
function cpMix(a, b, t){ const x = [1, 3, 5].map(i => parseInt(cpHex(a).slice(i, i + 2), 16)), y = [1, 3, 5].map(i => parseInt(cpHex(b).slice(i, i + 2), 16)); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase(); }
function cpLum(h){ const c = [1, 3, 5].map(i => parseInt(cpHex(h).slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function cpOn(h){ return cpLum(h) > 0.4 ? '#252423' : '#FFFFFF'; }   // readable text on a fill
function cpDaxStr(s){ return '"' + String(s).replace(/"/g, '""') + '"'; }
function cpNum(v){ const a = Math.abs(v); return a >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : a >= 1e3 ? Math.round(v / 1e3) + 'K' : String(Math.round(v)); }

const CP_GROUPS = [
  { id: 'share', name: 'Compare items and show each one’s share', note: 'A bar or column per item, with a second label such as the item’s % of the total.' },
  { id: 'many', name: 'Too many items for one chart', note: 'Show a page of items at a time, ranked, with page buttons.' },
  { id: 'time', name: 'One stretch of time on a trend', note: 'Shade a date range on a line chart and label only the points inside it.' }
];

/* Each pattern: what it shows, when to use it, the fields it needs, the new measures and tables, and the steps to build the chart */
const CP_PATTERNS = [
  { id: 'labels', group: 'share', name: 'Labels above the bars', kind: 'Clustered bar chart',
    what: 'Each bar has its item’s name and % of total on a line above it, and its value just past the end. The axis can go, because every bar is labeled.',
    when: 'Up to about 12 items, when readers want the value and the share without a legend or axis.',
    avoid: 'Many items or long names: the labels crowd. Use Top N per page instead.',
    needs: ['measure', 'category'] },
  { id: 'stacked', group: 'share', name: '% of total next to each bar', kind: 'Stacked bar or column chart',
    what: 'Each bar has its value inside, and its % of total sits in a neat column between the names and the bars. The % sits on a hidden piece of the bar, so it lines up on every row.',
    when: 'A few categories where the share matters as much as the amount.',
    avoid: 'Very long lists, or when readers only need the amounts.',
    needs: ['measure', 'category'], orient: true },
  { id: 'bubbles', group: 'share', name: 'Bubbles over the columns', kind: 'Line and clustered column chart',
    what: 'Columns with their value, and a bubble floating above each one holding its % of total, joined to the column by a thin stem.',
    when: 'A handful of items on a page with room above the columns, when the share should stand out.',
    avoid: 'Narrow visuals: the bubbles need space. It also needs a change to your report theme.',
    needs: ['measure', 'category'], theme: true },
  { id: 'paging', group: 'many', name: 'Top N per page', kind: 'Stacked bar chart with two slicers',
    what: 'Items ranked by value, a page at a time (say 5 per page), each bar with a #rank badge and a value badge. Readers pick how many per page and which page.',
    when: 'Long lists such as customers or products, where a scroll bar would hide most of them.',
    avoid: 'Short lists that fit on one chart.',
    needs: ['measure', 'item'] },
  { id: 'window', group: 'time', name: 'Highlight a time window', kind: 'Line chart and a date slicer',
    what: 'A Between date slicer shades a range on a line chart and labels only the points inside it. The rest of the line stays visible for context.',
    when: 'Showing a campaign, a season or a period of change against the full history.',
    avoid: 'Charts that aren’t over time, or a date axis that isn’t continuous.',
    needs: ['measure', 'date', 'axis'] }
];
const cpPattern = id => CP_PATTERNS.find(p => p.id === id) || CP_PATTERNS[0];

const CP_DEF = { measure: 'Sales', fmt: '', category: "'Product'[Category]", item: "'Customer'[Customer Name]", date: "'Date'[Date]", axis: "'Date'[Month]",
  table: '_Measures', folder: 'Chart Patterns', orient: 'bar', pct: '0.0%', headroom: 20, perPage: 5, maxItems: 20, maxPages: 50, bubble: 30,
  bar: '#1F6FB2', accent: '#5B4B9A', label: '#404040' };

/* ---------- the names of everything new ---------- */
function cpNames(p, f){
  const v = cpMeasure(f.measure) || 'Value', cat = (cpCol(f.category) || {}).column || 'Item', it = (cpCol(f.item) || {}).column || 'Item';
  const N = { pct: v + ' % of Total', subtitle: v + ' Subtitle' };
  if (p.id === 'labels') Object.assign(N, { spacer: v + ' Label Spacer', selected: 'Selected ' + cat });
  if (p.id === 'stacked') Object.assign(N, { spacer: v + ' % Spacer' });
  if (p.id === 'bubbles') Object.assign(N, { label: v + ' Bubble Label', marker: v + ' Bubble Position', axisMax: v + ' Bubble Axis Max' });
  if (p.id === 'paging') Object.assign(N, { rank: it + ' Rank', rankLabel: it + ' Rank Label', spacer: v + ' Rank Badge',
    axisMax: v + ' Page Axis Max', axisMin: v + ' Page Axis Min', subtitle: v + ' Page Subtitle',
    itemsTable: 'Items per Page', itemsValue: 'Items per Page Value', itemFilter: 'Item Filter', pagesTable: 'Page Number', pagesValue: 'Page Number Value', pageFilter: 'Page Filter' });
  if (p.id === 'window') Object.assign(N, { dates: 'Window Dates', start: 'Window Start', end: 'Window End', calc: 'In Window' });
  return N;
}

/* ---------- checks before anything is written ---------- */
function cpCheck(p, f, model){
  const out = [], add = (level, text) => out.push({ level, text });
  const v = cpMeasure(f.measure);
  if (!v) add('err', 'Enter the measure to chart.');
  const cols = { category: 'the category column', item: 'the column with the items to rank', date: 'the date column for the slicer', axis: 'the date column on the chart’s axis' };
  p.needs.filter(n => cols[n]).forEach(n => { if (!cpCol(f[n])) add('err', 'Enter ' + cols[n] + ' as \'Table\'[Column].'); });
  if (!model) return out;
  const hasM = n => model.measures.some(m => lc(m.name) === lc(n));
  const hasC = c => c && model.columns.some(x => lc(x.table) === lc(c.table) && lc(x.name) === lc(c.column));
  if (v && !hasM(v)) add('err', 'The model has no measure called [' + v + '].');
  p.needs.filter(n => cols[n]).forEach(n => { const c = cpCol(f[n]); if (c && !hasC(c)) add('err', 'The model has no column ' + cpRef(c) + '.'); });
  if (f.table.trim() && !model.tables.some(t => lc(t.name) === lc(f.table.trim()))) add('err', 'The model has no table called ' + f.table.trim() + ' for the new measures.');
  const N = cpNames(p, f), taken = Object.keys(N).filter(k => !/Table$|^dates$|^calc$/.test(k)).map(k => N[k]).filter(hasM);
  if (taken.length) add('warn', 'The model already has ' + taken.map(x => '[' + x + ']').join(', ') + '. The script replaces ' + (taken.length > 1 ? 'them' : 'it') + '.');
  const tbl = [N.itemsTable, N.pagesTable, N.dates].filter(Boolean).filter(t => model.tables.some(x => lc(x.name) === lc(t)));
  if (tbl.length) add('warn', 'The model already has a table called ' + tbl.join(' and ') + '. The script replaces it.');
  if (p.id === 'paging') { const c = cpCol(f.item); if (c && v) { const m = model.measures.find(x => lc(x.name) === lc(v)); if (m && !tableReaches(model, c.table, m.table)) add('warn', c.table + ' doesn’t look related to the table behind [' + v + ']. The ranking needs that relationship.'); } }
  return out;
}
// true when a relationship path exists (or the measure sits in a measures-only table, so it can't be told)
function tableReaches(model, a, b){
  if (lc(a) === lc(b) || !model.rels.length) return true;
  if (!model.columns.some(c => lc(c.table) === lc(b))) return true;
  try { return !!relPath(model, a, b, true); } catch (e) { return true; }
}

/* ---------- measures and tables ---------- */
function cpOut(p, f){
  const N = cpNames(p, f), V = bracket(cpMeasure(f.measure)), fmt = (f.fmt || '#,0').replace(/"/g, '');
  const cat = cpCol(f.category), it = cpCol(f.item);
  const M = [], T = [], m = (name, expression, formatString) => M.push({ name, expression, formatString: formatString || '' });
  const pct = (all) => m(N.pct, 'DIVIDE ( ' + V + ', CALCULATE ( ' + V + ', ' + all + ' ) )', f.pct || '0.0%');
  const subtitle = (lead, total) => m(N.subtitle, 'VAR _value = ' + total + '\nRETURN\n' + cpDaxStr(lead) + ' & FORMAT ( _value, ' + cpDaxStr(fmt) + ' )');
  const vName = cpMeasure(f.measure);
  if (p.id === 'labels') {
    m(N.spacer, 'IF ( ISBLANK ( ' + V + ' ), BLANK (), 0 )', '0');
    m(N.selected, 'SELECTEDVALUE ( ' + cpRef(cat) + ' )');
    pct('ALLSELECTED ( ' + cpRef(cat) + ' )');
    subtitle(vName + ': ', V);
  }
  if (p.id === 'stacked') {
    subtitle(vName + ': ', V);
    m(N.spacer, 'VAR _longest =\n    CALCULATE (\n        MAXX ( VALUES ( ' + cpRef(cat) + ' ), ' + V + ' ),\n        ALLSELECTED ( ' + cpRef(cat) + ' )\n    )\nRETURN\n    IF ( ISBLANK ( ' + V + ' ), BLANK (), _longest * ' + (Math.max(1, +f.headroom || 20) / 100) + ' )');
    pct('ALLSELECTED ( ' + cpRef(cat) + ' )');
  }
  if (p.id === 'bubbles') {
    const maxv = 'MAXX ( ALLSELECTED ( ' + cpRef(cat) + ' ), ' + V + ' )';
    pct('REMOVEFILTERS ( ' + cpRef(cat) + ' )');
    m(N.label, 'VAR _max = ' + maxv + '\nRETURN\n    IF ( NOT ISBLANK ( ' + V + ' ), _max * 1.6 )');
    m(N.marker, 'VAR _max = ' + maxv + '\nRETURN\n    IF ( NOT ISBLANK ( ' + V + ' ), _max * 1.7 )');
    m(N.axisMax, 'VAR _max = ' + maxv + '\nRETURN\n    _max * 2.2');
    subtitle(vName + ' (all ' + lc(cat.column) + '): ', 'CALCULATE ( ' + V + ', REMOVEFILTERS ( ' + cpRef(cat) + ' ) )');
  }
  if (p.id === 'paging') {
    // A unique rank with no gaps: ties are broken by name, so every page holds exactly its share.
    // ALL ( item ) keeps the rank from following the chart's own Item Filter.
    const I = cpRef(it);
    m(N.rank, 'IF (\n    ISBLANK ( ' + V + ' ) || NOT HASONEVALUE ( ' + I + ' ),\n    BLANK (),\n    RANK (\n        ALL ( ' + I + ' ),\n        ORDERBY ( ' + V + ', DESC, ' + I + ', ASC )\n    )\n)', '0');
    m(N.rankLabel, 'VAR _rank = ' + bracket(N.rank) + '\nRETURN\n    IF ( ISBLANK ( _rank ), BLANK (), "#" & FORMAT ( _rank, "#,0" ) )');
    m(N.axisMax, 'CALCULATE ( MAXX ( VALUES ( ' + cpRef(it) + ' ), ' + V + ' ), REMOVEFILTERS ( ' + cpTbl(it.table) + ' ) ) * 1.15', '0');
    m(N.axisMin, '-0.2 * ' + bracket(N.axisMax), '0');
    m(N.spacer, 'IF ( ISBLANK ( ' + V + ' ), BLANK (), -0.15 * ' + bracket(N.axisMax) + ' )');
    m(N.subtitle, 'VAR _all = CALCULATE ( ' + V + ', REMOVEFILTERS ( ' + I + ' ) )\nRETURN\n    "Shown: " & FORMAT ( ' + V + ', ' + cpDaxStr(fmt) + ' ) & " | All: " & FORMAT ( _all, ' + cpDaxStr(fmt) + ' )');
    const per = Math.max(1, Math.round(+f.perPage || 5)), maxI = Math.max(per, Math.round(+f.maxItems || 20)), maxP = Math.max(2, Math.round(+f.maxPages || 50));
    T.push({ name: N.itemsTable, column: N.itemsTable, source: 'GENERATESERIES ( 1, ' + maxI + ', 1 )', measures: [
      { name: N.itemsValue, expression: 'SELECTEDVALUE ( ' + cpTbl(N.itemsTable) + bracket(N.itemsTable) + ', ' + per + ' )', formatString: '0' },
      { name: N.itemFilter, expression: 'VAR _page = ' + bracket(N.pagesValue) + '\nVAR _items = ' + bracket(N.itemsValue) + '\nVAR _rank = ' + bracket(N.rank) + '\nRETURN\n    IF ( ISBLANK ( ' + V + ' ), 0,\n        IF ( _rank > ( _page - 1 ) * _items && _rank <= _page * _items, 1, 0 )\n    )', formatString: '0' }] });
    T.push({ name: N.pagesTable, column: N.pagesTable, source: 'GENERATESERIES ( 1, ' + maxP + ', 1 )', measures: [
      { name: N.pagesValue, expression: 'SELECTEDVALUE ( ' + cpTbl(N.pagesTable) + bracket(N.pagesTable) + ', 1 )', formatString: '0' },
      { name: N.pageFilter, expression: 'VAR _count =\n    COUNTROWS ( FILTER ( ALL ( ' + I + ' ), NOT ISBLANK ( ' + V + ' ) ) )\nVAR _pages = ROUNDUP ( DIVIDE ( _count, ' + bracket(N.itemsValue) + ' ), 0 )\nRETURN\n    IF ( SELECTEDVALUE ( ' + cpTbl(N.pagesTable) + bracket(N.pagesTable) + ' ) <= _pages, 1, 0 )', formatString: '0' }] });
  }
  if (p.id === 'window') {
    const d = cpCol(f.date), dc = { table: N.dates, column: d.column };
    m(N.start, 'MIN ( ' + cpRef(dc) + ' )', 'General Date');
    m(N.end, 'MAX ( ' + cpRef(dc) + ' )', 'General Date');
    T.push({ name: N.dates, column: d.column, dateFrom: (/^[A-Za-z_][A-Za-z0-9_]*$/.test(d.table) ? d.table : qName(d.table)) + bracket(d.column), source: 'VALUES ( ' + cpRef(d) + ' )', measures: [] });
  }
  return { names: N, measures: M, tables: T };
}

function cpTmdl(out, f){
  const table = (f.table || '_Measures').trim(), folder = normFolder(f.folder);
  const lines = [toTmdl(out.measures, { mode: 'script', targetTable: table, folder }).replace(/\n+$/, '')];
  out.tables.forEach(t => {
    const L = ['', TAB + 'table ' + tmdlName(t.name)];
    t.measures.forEach(x => {
      const ex = exprLines(x.expression);
      if (ex.length <= 1) L.push(TAB + TAB + 'measure ' + tmdlName(x.name) + ' = ' + (ex[0] || '').trim());
      else { L.push(TAB + TAB + 'measure ' + tmdlName(x.name) + ' ='); ex.forEach(l => L.push(l ? TAB.repeat(4) + l : '')); }
      if (x.formatString) L.push(TAB.repeat(3) + 'formatString: ' + x.formatString);
      if (folder) L.push(TAB.repeat(3) + 'displayFolder: ' + tmdlValue(folder));
      L.push('');
    });
    L.push(TAB + TAB + 'column ' + tmdlName(t.column));
    if (t.dateFrom) L.push(TAB.repeat(3) + 'dataType: dateTime', TAB.repeat(3) + 'formatString: Short Date', TAB.repeat(3) + 'summarizeBy: none', TAB.repeat(3) + 'isNameInferred', TAB.repeat(3) + 'sourceColumn: ' + t.dateFrom);
    else L.push(TAB.repeat(3) + 'dataType: int64', TAB.repeat(3) + 'formatString: 0', TAB.repeat(3) + 'summarizeBy: none', TAB.repeat(3) + 'sourceColumn: [Value]');
    L.push('', TAB + TAB + 'partition ' + tmdlName(t.name) + ' = calculated', TAB.repeat(3) + 'mode: import', TAB.repeat(3) + 'source = ' + t.source);
    lines.push(L.join('\n'));
  });
  return lines.join('\n') + '\n';
}

function cpTest(p, f, out){
  const N = out.names, V = bracket(cpMeasure(f.measure)), cols = (list) => list.map(n => TAB + TAB + cpDaxStr(n) + ', ' + bracket(n)).join(',\n');
  const by = (c, list) => ['// Run in DAX query view after applying the script. One row per item.', 'EVALUATE', 'SUMMARIZECOLUMNS (', TAB + cpRef(c) + ',', TAB + cpDaxStr(cpMeasure(f.measure)) + ', ' + V + ',', cols(list).replace(/^\t/gm, ''), ')', 'ORDER BY ' + cpDaxStr(cpMeasure(f.measure)) + ' DESC'].join('\n');
  if (p.id === 'labels') return by(cpCol(f.category), [N.spacer, N.selected, N.pct]);
  if (p.id === 'stacked') return by(cpCol(f.category), [N.spacer, N.pct]);
  if (p.id === 'bubbles') return by(cpCol(f.category), [N.pct, N.label, N.marker, N.axisMax]);
  if (p.id === 'paging') return by(cpCol(f.item), [N.rank, N.rankLabel, N.spacer, N.axisMax, N.axisMin]).replace('One row per item.', 'One row per item. Rank should run 1, 2, 3 with no repeats or gaps.');
  return ['// Run in DAX query view after applying the script.', '// Start and End should be the first and last dates in ' + N.dates + '.', 'EVALUATE', 'ROW (', TAB + '"Start", ' + bracket(N.start) + ',', TAB + '"End", ' + bracket(N.end) + ',', TAB + '"Dates", COUNTROWS ( ' + cpTbl(N.dates) + ' )', ')'].join('\n');
}

/* ---------- the steps to build the chart in Power BI ---------- */
// Each group: [heading, [steps]]; steps are HTML (names escaped by the caller's esc)
function cpSteps(p, f, out, esc){
  const N = out.names, v = esc(cpMeasure(f.measure)), b = s => '<b>' + esc(s) + '</b>', q = s => '<code>' + esc(s) + '</code>';
  const sw = h => '<span class="cp-sw" style="background:' + h + '"></span>' + q(h);
  const bar = cpHex(f.bar) || CP_DEF.bar, acc = cpHex(f.accent) || CP_DEF.accent, lab = cpHex(f.label) || CP_DEF.label;
  const horiz = p.id === 'labels' || f.orient !== 'column', cat = cpCol(f.category), it = cpCol(f.item);
  const valueAxis = horiz ? 'X-axis' : 'Y-axis', catAxis = horiz ? 'Y-axis' : 'X-axis';
  const G = [];
  if (p.id === 'labels') {
    G.push(['Add the chart', [
      'Add a ' + b(horiz ? 'Clustered bar chart' : 'Clustered column chart') + '. Put ' + q(cpRef(cat)) + ' on the ' + b(catAxis) + ' and, in this order, ' + q('[' + N.spacer + ']') + ' then ' + q('[' + cpMeasure(f.measure) + ']') + ' on the ' + b(valueAxis) + '.',
      'Sort it by ' + b(cpMeasure(f.measure)) + ', descending (the ' + b('...') + ' menu on the visual > Sort axis).']]);
    G.push(['Format it', [
      b(catAxis) + ': off. ' + b(valueAxis) + ': off. ' + b('Legend') + ': off.',
      b('Bars') + ' > ' + b('Layout') + ': set ' + b('Space between series') + ' to 25 and ' + b('Space between categories') + ' to 25.',
      b('Data labels') + ': on.',
      'In ' + b('Data labels') + ', set ' + b('Apply settings to') + ' to ' + b(cpMeasure(f.measure)) + ': Position ' + b('Outside end') + ', Value color ' + sw(lab) + ', ' + b('Italic') + ' on, Background off. The value sits just past the end of the bar.',
      'Set ' + b('Apply settings to') + ' to ' + b(N.spacer) + '. In ' + b('Value') + ', set ' + b('Field') + ' to ' + q('[' + N.selected + ']') + '. Turn ' + b('Detail') + ' on and set its ' + b('Field') + ' to ' + q('[' + N.pct + ']') + '. The spacer is an empty bar in the slot above each real bar, so its label sits on its own line above the bar.',
      b('Title') + ': your title. ' + b('Subtitle') + ': on, then select ' + b('fx') + ', Format style ' + b('Field value') + ', and pick ' + q('[' + N.subtitle + ']') + '.',
      b('Bars') + ' > ' + b('Color') + ': ' + sw(bar) + ' for ' + b(cpMeasure(f.measure)) + '.']]);
  }
  if (p.id === 'stacked') {
    G.push(['Add the chart', [
      'Add a ' + b(horiz ? 'Stacked bar chart' : 'Stacked column chart') + '. Put ' + q(cpRef(cat)) + ' on the ' + b(catAxis) + ' and, in this order, ' + q('[' + N.spacer + ']') + ' then ' + q('[' + cpMeasure(f.measure) + ']') + ' on the ' + b(valueAxis) + '. The spacer comes first, so it sits at the start of every bar.',
      'Sort it by ' + b(cpMeasure(f.measure)) + ', descending.']]);
    G.push(['Format it', [
      b(catAxis) + ': on, title off. ' + b(valueAxis) + ': off. ' + b('Legend') + ': off. ' + b('Total labels') + ': off.',
      b(horiz ? 'Bars' : 'Columns') + ' > ' + b('Color') + ': ' + b(N.spacer) + ' ' + sw('#FFFFFF') + ' (the same as your visual background, so it disappears) and ' + b(cpMeasure(f.measure)) + ' ' + sw(bar) + '.',
      b('Data labels') + ': on. For ' + b(cpMeasure(f.measure)) + ': position ' + b('Center') + ', color ' + sw(cpOn(bar)) + ', bold.',
      'Set ' + b('Apply settings to') + ' to ' + b(N.spacer) + '. In ' + b('Value') + ', set ' + b('Field') + ' to ' + q('[' + N.pct + ']') + ', color ' + sw(lab) + ', size 10. That puts the % in a column between the names and the bars.',
      b('Title') + ': your title. ' + b('Subtitle') + ': on, then select ' + b('fx') + ', Format style ' + b('Field value') + ', and pick ' + q('[' + N.subtitle + ']') + '.']]);
  }
  if (p.id === 'bubbles') {
    const sub = list => '<ul class="cp-sub">' + list.map(x => '<li>' + x + '</li>').join('') + '</ul>';
    G.push(['Add the chart', [
      'Add a ' + b('Line and clustered column chart') + '. Put ' + q(cpRef(cat)) + ' on the ' + b('X-axis') + ', ' + q('[' + cpMeasure(f.measure) + ']') + ' on ' + b('Column y-axis') + ', and ' + q('[' + N.marker + ']') + ' then ' + q('[' + N.label + ']') + ' on ' + b('Line y-axis') + '. Both of these go on the Line y-axis, not the Column y-axis.',
      'Sort it by ' + b(cpMeasure(f.measure)) + ', descending.']]);
    G.push(['Format it', [
      b('Y-axis') + ': off. In ' + b('Y-axis') + ' > ' + b('Range') + ', select ' + b('fx') + ' next to ' + b('Maximum') + ', Format style ' + b('Field value') + ', and pick ' + q('[' + N.axisMax + ']') + '. This leaves room above the columns.',
      b('Secondary y-axis') + ': off, so the bubbles use the same scale as the columns.',
      b('Legend') + ': off. ' + b('Columns') + ' > ' + b('Color') + ': ' + sw(bar) + '.',
      b('Lines') + ': for both ' + b(N.marker) + ' and ' + b(N.label) + ', turn the line off (only markers show).',
      b('Markers') + ': on. In ' + b('Apply settings to') + ', pick each series in turn:' + sub([
        b(N.marker) + ': ' + b('Show for this series') + ' on, shape circle, color ' + sw(cpMix(bar, '#FFFFFF', 0.8)) + '.',
        b(N.label) + ': ' + b('Show for this series') + ' off.']) + 'Leave the marker size alone: the theme sets it (below).',
      b('Data labels') + ': on. In ' + b('Apply settings to') + ', pick each series in turn:' + sub([
        b(cpMeasure(f.measure)) + ': position ' + b('Outside end') + ', color ' + sw(lab) + '.',
        b(N.marker) + ': ' + b('Show for this series') + ' off.',
        b(N.label) + ': ' + b('Show for this series') + ' on, position ' + b('Above') + ', size 9. In ' + b('Value') + ', set ' + b('Field') + ' to ' + q('[' + N.pct + ']') + ' (the % of total), color ' + sw(lab) + '. The % lands in the bubble.']),
      b('Title') + ': your title. ' + b('Subtitle') + ': on, ' + b('fx') + ' > ' + b('Field value') + ' > ' + q('[' + N.subtitle + ']') + '.']]);
    G.push(['Add the stems', [
      'Open the ' + b('Analytics') + ' pane (the magnifying glass) > ' + b('Error bars') + ' > series ' + b(cpMeasure(f.measure)) + ': turn it on.',
      'In ' + b('Options') + ', set ' + b('Upper bound') + ' to ' + q('[' + N.marker + ']') + ' and leave Lower bound empty. Turn ' + b('Make limits relative to measure') + ' off if you see it.',
      b('Bar') + ': on, color ' + sw(cpMix(bar, '#FFFFFF', 0.55)) + ', width 1. ' + b('Tooltip') + ': off. The stem now runs from the top of each column up to its bubble.']]);
  }
  if (p.id === 'paging') {
    G.push(['Add the chart', [
      'Add a ' + b('Stacked bar chart') + '. Put ' + q(cpRef(it)) + ' on the ' + b('Y-axis') + ' and, in this order, ' + q('[' + N.spacer + ']') + ' then ' + q('[' + cpMeasure(f.measure) + ']') + ' on the ' + b('X-axis') + '.',
      'Sort it by ' + b(N.rank) + ', ascending (add ' + q('[' + N.rank + ']') + ' to ' + b('Tooltips') + ' first if it isn’t in the sort list), or by ' + b(cpMeasure(f.measure)) + ', descending.',
      'In the ' + b('Filters') + ' pane, drag ' + q('[' + N.itemFilter + ']') + ' to ' + b('Filters on this visual') + ', choose ' + b('is') + ' ' + q('1') + ', and select ' + b('Apply filter') + '.']]);
    G.push(['Format it', [
      b('X-axis') + ': off. In ' + b('X-axis') + ' > ' + b('Range') + ', select ' + b('fx') + ' next to ' + b('Minimum') + ' and pick ' + q('[' + N.axisMin + ']') + ', and next to ' + b('Maximum') + ' pick ' + q('[' + N.axisMax + ']') + ' (Format style ' + b('Field value') + '). Bars then keep the same scale on every page.',
      b('Legend') + ': off. ' + b('Total labels') + ': off.',
      b('Bars') + ' > ' + b('Color') + ': ' + b(N.spacer) + ' ' + sw('#FFFFFF') + ' (or your visual background), ' + b(cpMeasure(f.measure)) + ' ' + sw(bar) + '.',
      b('Data labels') + ': on. For ' + b(N.spacer) + ': in ' + b('Value') + ', set ' + b('Field') + ' to ' + q('[' + N.rankLabel + ']') + ', color ' + sw(lab) + '. That’s the #rank badge.',
      'For ' + b(cpMeasure(f.measure)) + ': position ' + b('Inside end') + ', color ' + sw(cpOn(acc)) + ', size 8, Background on with color ' + sw(acc) + ' and transparency 0. That’s the value badge.',
      b('Title') + ': your title. ' + b('Subtitle') + ': on, ' + b('fx') + ' > ' + b('Field value') + ' > ' + q('[' + N.subtitle + ']') + '.']]);
    G.push(['Add the slicers', [
      'Add a ' + b('Slicer') + ' with ' + q(cpRef({ table: N.itemsTable, column: N.itemsTable })) + '. In ' + b('Slicer settings') + ', set ' + b('Style') + ' to ' + b('Single value') + '. Turn the slider off and the header off. Put a text box next to it: ' + q('Items per page:') + '.',
      'Add a second ' + b('Slicer') + ' with ' + q(cpRef({ table: N.pagesTable, column: N.pagesTable })) + '. In ' + b('Slicer settings') + ', set ' + b('Style') + ' to ' + b('Tile') + ' (horizontal), turn ' + b('Single select') + ' on and ' + b('Show "Select all"') + ' off. Header off.',
      'With the page slicer selected, drag ' + q('[' + N.pageFilter + ']') + ' to ' + b('Filters on this visual') + ', choose ' + b('is') + ' ' + q('1') + ', and apply. Only pages that have items show.',
      'Select page ' + b('1') + ' in it. Optional: select the chart and both slicers and group them (' + b('Format') + ' > ' + b('Group') + ').']]);
  }
  if (p.id === 'window') {
    const ax = cpCol(f.axis);
    G.push(['Add the slicer', [
      'Add a ' + b('Slicer') + ' with ' + q(cpRef({ table: N.dates, column: cpCol(f.date).column })) + '. In ' + b('Slicer settings') + ', set ' + b('Style') + ' to ' + b('Between') + '. Header off.',
      'Drag the handles to the window you want to show. The table isn’t related to anything, so the slicer only moves the window; it doesn’t filter the chart.']]);
    G.push(['Change your line chart', [
      'Use a ' + b('Line chart') + ' with ' + q(cpRef(ax)) + ' on the ' + b('X-axis') + ' and ' + q('[' + cpMeasure(f.measure) + ']') + ' on the ' + b('Y-axis') + '. In ' + b('X-axis') + ', set ' + b('Type') + ' to ' + b('Continuous') + '.',
      'Add ' + q('[' + N.start + ']') + ' and ' + q('[' + N.end + ']') + ' to ' + b('Tooltips') + '. A visual calculation can only use fields that are on the visual.',
      'Select the chart, then ' + b('New visual calculation') + ' (Home ribbon). Name it ' + q(N.calc) + ' and enter:<pre class="cp-pre">' + esc(N.calc + ' =\nIF (\n    [' + ax.column + '] >= [' + N.start + ']\n        && [' + ax.column + '] <= [' + N.end + '],\n    [' + cpMeasure(f.measure) + ']\n)') + '</pre>If your axis field shows a different name on the visual, use that name.']]);
    G.push(['Format it', [
      b('Lines') + ': for ' + b(N.calc) + ', turn the line off. ' + b('Markers') + ': on for ' + b(N.calc) + ' (size 4, color ' + sw(acc) + '), off for ' + b(cpMeasure(f.measure)) + '.',
      b('Data labels') + ': on, color ' + sw(acc) + ', size 8. Then for ' + b(cpMeasure(f.measure)) + ', turn ' + b('Show for this series') + ' off, so only points in the window are labeled.',
      b('Y-axis') + ': off. ' + b('Legend') + ': off.']]);
    G.push(['Shade the window', [
      'Open the ' + b('Analytics') + ' pane > ' + b('X-axis constant line') + ' > ' + b('Add line') + '. Name it ' + q('Window end') + '. Next to ' + b('Value') + ', select ' + b('fx') + ', Format style ' + b('Field value') + ', field ' + q(cpRef({ table: N.dates, column: cpCol(f.date).column })) + ', summarization ' + b('Latest') + ' (or Maximum).',
      'Turn ' + b('Shade area') + ' on: ' + b('Before') + ', color ' + sw(acc) + ', transparency 85. ' + b('Position') + ': Behind. Line width 1.',
      'Add a second line, ' + q('Window start') + ', the same way with summarization ' + b('Earliest') + ' (or Minimum). ' + b('Shade area') + ': Before, color ' + sw('#FFFFFF') + ' (your visual background), transparency 0, Behind. It covers the shade before the window, so only the window stays tinted.']]);
  }
  return G;
}

function cpChecks(p, f, out){
  const N = out.names, v = cpMeasure(f.measure);
  if (p.id === 'labels') return ['Each bar has its value in italics past its end, and the name and % sit on a line above the bar.', 'No second bar is visible next to each bar.', 'The % values add up to 100% across the bars.'];
  if (p.id === 'stacked') return ['The % values line up in a column between the names and the bars.', 'No colored piece shows under the %: the spacer matches the background.', 'The value is inside each bar, and no total label shows past it.'];
  if (p.id === 'bubbles') return ['The bubbles are round and big enough to hold the %. If they’re small dots, the theme step below isn’t done.', 'A thin stem joins each column to its bubble, and no line runs between the bubbles.', 'No bubble or label is cut off at the top.'];
  if (p.id === 'paging') return ['The chart shows ' + (f.perPage || 5) + ' bars, ranked, each with a #rank badge and a value badge.', 'Changing items per page changes the bars and the number of pages.', 'On the last page, the bars are shorter than on page 1. If every page fills the chart edge to edge, the X-axis range isn’t using ' + N.axisMin + ' and ' + N.axisMax + '.', 'The page slicer offers no empty pages.'];
  return ['Moving the slicer handles moves the shaded band.', 'Only points inside the band have labels and markers.', 'The line still shows the full history: the slicer doesn’t filter the chart. If it does, ' + N.dates + ' has been related to another table; remove that relationship.'];
}

/* ---------- theme: the combo chart marker size ---------- */
function cpThemeMerge(themeText, size){
  const t = JSON.parse(themeText);
  if (!t || typeof t !== 'object' || Array.isArray(t)) throw new Error('not a theme');
  const vs = t.visualStyles = t.visualStyles && typeof t.visualStyles === 'object' ? t.visualStyles : {};
  const cc = vs.lineClusteredColumnComboChart = vs.lineClusteredColumnComboChart || {};
  const star = cc['*'] = cc['*'] || {};
  const ls = Array.isArray(star.lineStyles) && star.lineStyles.length ? star.lineStyles : [{}];
  ls[0] = Object.assign({}, ls[0], { markerSize: size });
  star.lineStyles = ls;
  return JSON.stringify(t, null, 2);
}
function cpThemeSnippet(size){ return '"lineClusteredColumnComboChart": {\n  "*": {\n    "lineStyles": [ { "markerSize": ' + size + ' } ]\n  }\n}'; }

/* ---------- previews (example numbers, your colors) ---------- */
function cpSvgLabels(rows, f){
  // a clustered bar chart: the empty spacer bar takes the slot above each real bar and carries the name and % label
  const bar = cpHex(f.bar) || CP_DEF.bar, acc = cpHex(f.accent) || CP_DEF.accent, lab = cpHex(f.label) || CP_DEF.label, tot = rows.reduce((s, r) => s + r[1], 0), mx = rows[0][1];
  const W = 420, rh = 40, H = rows.length * rh + 6;
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Preview">' + rows.map((r, i) => { const w = r[1] / mx * 330, y = 4 + i * rh;
    return '<text x="4" y="' + (y + 11) + '" font-size="10.5" fill="' + lab + '"><tspan font-weight="600">' + r[0] + '</tspan> ' + (r[1] / tot * 100).toFixed(1) + '%</text>'
      + '<rect x="4" y="' + (y + 16) + '" width="' + w + '" height="16" fill="' + bar + '" rx="2"/><text x="' + (w + 9) + '" y="' + (y + 28) + '" font-size="10" font-style="italic" fill="' + lab + '">' + cpNum(r[1]) + '</text>'; }).join('') + '</svg>';
}
function cpSvgStacked(rows, f){
  // the spacer comes first and matches the background, so the % sits in a column before each bar
  const bar = cpHex(f.bar) || CP_DEF.bar, lab = cpHex(f.label) || CP_DEF.label, on = cpOn(bar), tot = rows.reduce((s, r) => s + r[1], 0), mx = rows[0][1], hr = Math.max(1, +f.headroom || 20) / 100;
  if (f.orient === 'column') {
    const W = 420, H = 230, step = (W - 20) / rows.length, bw = Math.min(50, step - 14), base = H - 22, k = (base - 10) / (mx * (1 + hr)), s0 = mx * hr * k;
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Preview">' + rows.map((r, i) => { const h = r[1] * k, x = 10 + i * step + (step - bw) / 2, y = base - s0 - h;
      return '<text x="' + (x + bw / 2) + '" y="' + (base - s0 / 2 + 4) + '" font-size="10" text-anchor="middle" fill="' + lab + '">' + Math.round(r[1] / tot * 100) + '%</text><rect x="' + x + '" y="' + y + '" width="' + bw + '" height="' + h + '" fill="' + bar + '"/><text x="' + (x + bw / 2) + '" y="' + (y + h / 2 + 4) + '" font-size="9.5" text-anchor="middle" fill="' + on + '" font-weight="600">' + cpNum(r[1]) + '</text><text x="' + (x + bw / 2) + '" y="' + (H - 6) + '" font-size="10" text-anchor="middle" fill="#605E5C">' + r[0] + '</text>'; }).join('') + '</svg>';
  }
  const W = 420, rh = 30, H = rows.length * rh + 8, x0 = 70, k = (W - x0 - 10) / (mx * (1 + hr)), s0 = mx * hr * k;
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Preview">' + rows.map((r, i) => { const w = r[1] * k, y = 6 + i * rh;
    return '<text x="' + (x0 - 6) + '" y="' + (y + 15) + '" font-size="10" text-anchor="end" fill="#605E5C">' + r[0] + '</text><text x="' + (x0 + s0 / 2) + '" y="' + (y + 15) + '" font-size="10" text-anchor="middle" fill="' + lab + '">' + Math.round(r[1] / tot * 100) + '%</text>'
      + '<rect x="' + (x0 + s0) + '" y="' + (y + 3) + '" width="' + w + '" height="18" fill="' + bar + '"/><text x="' + (x0 + s0 + w / 2) + '" y="' + (y + 16) + '" font-size="9.5" text-anchor="middle" fill="' + on + '" font-weight="600">' + cpNum(r[1]) + '</text>'; }).join('') + '</svg>';
}
function cpSvgBubbles(rows, f){
  const bar = cpHex(f.bar) || CP_DEF.bar, lab = cpHex(f.label) || CP_DEF.label, tot = rows.reduce((s, r) => s + r[1], 0), mx = rows[0][1];
  const W = 420, H = 240, base = H - 22, k = (base - 6) / (mx * 2.2), step = (W - 20) / rows.length, bw = Math.min(44, step - 18), rad = Math.max(10, Math.min(20, (+f.bubble || 30) / 2));
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Preview">' + rows.map((r, i) => { const h = r[1] * k, x = 10 + i * step + step / 2, by = base - mx * 1.7 * k;
    return '<line x1="' + x + '" x2="' + x + '" y1="' + (base - h) + '" y2="' + by + '" stroke="' + cpMix(bar, '#FFFFFF', 0.55) + '" stroke-width="1.2"/><rect x="' + (x - bw / 2) + '" y="' + (base - h) + '" width="' + bw + '" height="' + h + '" fill="' + bar + '" rx="2"/><text x="' + x + '" y="' + (base - h - 4) + '" font-size="9.5" text-anchor="middle" fill="' + lab + '">' + cpNum(r[1]) + '</text>'
      + '<circle cx="' + x + '" cy="' + by + '" r="' + rad + '" fill="' + cpMix(bar, '#FFFFFF', 0.8) + '"/><text x="' + x + '" y="' + (by + 3.5) + '" font-size="9" text-anchor="middle" fill="' + lab + '" font-weight="600">' + (r[1] / tot * 100).toFixed(1) + '%</text><text x="' + x + '" y="' + (H - 8) + '" font-size="10" text-anchor="middle" fill="#605E5C">' + r[0] + '</text>'; }).join('') + '</svg>';
}
function cpSvgPaging(rows, f, page){
  const bar = cpHex(f.bar) || CP_DEF.bar, acc = cpHex(f.accent) || CP_DEF.accent, lab = cpHex(f.label) || CP_DEF.label, per = Math.max(1, Math.min(8, +f.perPage || 5)), mx = rows[0][1] * 1.15;
  const pages = Math.ceil(rows.length / per), pg = Math.min(page || 1, pages), show = rows.slice((pg - 1) * per, pg * per);
  const W = 420, rh = 30, top = 4, H = per * rh + 44, x0 = 150, k = (W - x0 - 10) / (mx * 1.2), zero = x0 + mx * 0.2 * k;
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Preview">';
  show.forEach((r, i) => { const y = top + i * rh, w = r[1] * k, rk = (pg - 1) * per + i + 1;
    s += '<text x="' + (x0 - 6) + '" y="' + (y + 17) + '" font-size="10" text-anchor="end" fill="#605E5C">' + r[0] + '</text><text x="' + (zero - mx * 0.075 * k) + '" y="' + (y + 17) + '" font-size="10" text-anchor="middle" fill="' + lab + '" font-weight="600">#' + rk + '</text>'
      + '<rect x="' + zero + '" y="' + (y + 5) + '" width="' + w + '" height="18" fill="' + bar + '" rx="2"/><rect x="' + (zero + w - 40) + '" y="' + (y + 7) + '" width="36" height="14" rx="7" fill="' + acc + '"/><text x="' + (zero + w - 22) + '" y="' + (y + 17.5) + '" font-size="9" text-anchor="middle" fill="' + cpOn(acc) + '">' + cpNum(r[1]) + '</text>'; });
  const py = H - 22;
  s += '<text x="4" y="' + (py + 13) + '" font-size="10" fill="#605E5C">Items per page: ' + per + '</text>';
  for (let i = 1; i <= pages; i++) s += '<g data-page="' + i + '" style="cursor:pointer"><rect x="' + (150 + (i - 1) * 26) + '" y="' + py + '" width="22" height="18" rx="3" fill="' + (i === pg ? bar : '#FFFFFF') + '" stroke="' + bar + '"/><text x="' + (161 + (i - 1) * 26) + '" y="' + (py + 13) + '" font-size="10" text-anchor="middle" fill="' + (i === pg ? cpOn(bar) : bar) + '">' + i + '</text></g>';
  return s + '</svg>';
}
function cpSvgWindow(series, f){
  const acc = cpHex(f.accent) || CP_DEF.accent, bar = cpHex(f.bar) || CP_DEF.bar, W = 420, H = 200, n = series.length, mx = Math.max(...series.map(x => x[1])) * 1.1, mn = Math.min(...series.map(x => x[1])) * 0.85;
  const X = i => 14 + i * (W - 28) / (n - 1), Y = v => H - 26 - (v - mn) / (mx - mn) * (H - 50), a = Math.round(n * 0.5), b = Math.round(n * 0.75);
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Preview"><rect x="' + X(a) + '" y="8" width="' + (X(b) - X(a)) + '" height="' + (H - 34) + '" fill="' + acc + '" opacity=".15"/>'
    + '<line x1="' + X(a) + '" x2="' + X(a) + '" y1="8" y2="' + (H - 26) + '" stroke="' + acc + '" stroke-width="1"/><line x1="' + X(b) + '" x2="' + X(b) + '" y1="8" y2="' + (H - 26) + '" stroke="' + acc + '" stroke-width="1"/>'
    + '<polyline fill="none" stroke="' + bar + '" stroke-width="2" points="' + series.map((x, i) => X(i) + ',' + Y(x[1])).join(' ') + '"/>';
  for (let i = a; i <= b; i++) s += '<circle cx="' + X(i) + '" cy="' + Y(series[i][1]) + '" r="3" fill="' + acc + '"/><text x="' + X(i) + '" y="' + (Y(series[i][1]) - 7) + '" font-size="8.5" text-anchor="middle" fill="' + acc + '">' + cpNum(series[i][1]) + '</text>';
  series.forEach((x, i) => { if (i % 3 === 0) s += '<text x="' + X(i) + '" y="' + (H - 10) + '" font-size="9" text-anchor="middle" fill="#605E5C">' + x[0] + '</text>'; });
  return s + '</svg>';
}
