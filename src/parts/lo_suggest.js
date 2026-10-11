/* ---------- Layout Designer: 3-30-300 layout suggestions ----------
   3 seconds: headline KPIs top left, big numbers, status against target.
   30 seconds: the visuals people use to spot patterns, each sized for the categories it shows.
   300 seconds: details on demand: formatted records here or on a drill-through page. */
const LS = (() => {
  const KPI_NAMES = ['Sales', 'Margin %', 'Orders', 'Customers', 'Avg order value', 'Returns', 'Units', 'Growth %'];
  const SLICERS = ['Year', 'Region', 'Product', 'Channel', 'Segment', 'Month', 'Customer', 'Category'];

  /* Visuals people can list for the 30-second level: [visualType, label, what a category is, scrolls in Power BI] */
  const VTYPES = [
    ['clusteredBarChart', 'Bar chart', 'bars', true], ['barChart', 'Stacked bar chart', 'bars', true],
    ['clusteredColumnChart', 'Column chart', 'columns', true], ['columnChart', 'Stacked column chart', 'columns', true],
    ['lineChart', 'Line chart', 'lines', false], ['areaChart', 'Area chart', 'areas', false], ['lineClusteredColumnComboChart', 'Line and column chart', 'columns', true],
    ['waterfallChart', 'Waterfall', 'steps', true], ['funnel', 'Funnel', 'stages', false],
    ['donutChart', 'Donut chart', 'slices', false], ['pieChart', 'Pie chart', 'slices', false], ['treemap', 'Treemap', 'boxes', false],
    ['map', 'Map', 'locations', false], ['scatterChart', 'Scatter chart', 'points', false],
    ['pivotTable', 'Matrix (heatmap)', 'rows', true], ['tableEx', 'Table', 'rows', true]
  ];
  const VT = Object.fromEntries(VTYPES.map(t => [t[0], { id: t[0], label: t[1], unit: t[2], scrolls: t[3] }]));
  const vt = id => VT[id] || { id, label: LO.typeOf(id).label, unit: 'categories', scrolls: false };

  const blankInput = () => ({ kpis: 4, targets: 'some', visuals: [
    { type: 'lineChart', title: 'Sales trend this year vs last', n: 2, show: '' },
    { type: 'clusteredBarChart', title: 'Sales by region', n: 6, show: '' },
    { type: 'clusteredBarChart', title: 'Sales by product', n: 25, show: 10 }
  ], detail: 'page', detailRows: 10, filters: 3, filterPlace: 'auto' });
  // older saved answers had trend / breakdowns / geo / heatmap instead of a list of visuals
  function normInput(g){
    const o = Object.assign(blankInput(), g || {});
    if (!Array.isArray(g && g.visuals)) {
      const v = [];
      if (o.trend) v.push({ type: 'lineChart', title: 'Sales trend this year vs last', n: 2, show: '' });
      const cats = ['Region', 'Product', 'Channel', 'Segment'];
      for (let i = 0; i < Math.max(0, Math.min(4, +o.breakdowns | 0)); i++) v.push(i === 0 && o.geo ? { type: 'map', title: 'Sales by location', n: 20, show: '' } : { type: 'clusteredBarChart', title: 'Sales by ' + cats[i].toLowerCase(), n: 8, show: '' });
      if (o.heatmap) v.push({ type: 'pivotTable', title: 'Heatmap: region × month', n: 8, show: '' });
      o.visuals = v;
    }
    ['trend', 'breakdowns', 'geo', 'heatmap'].forEach(k => delete o[k]);
    o.visuals = o.visuals.slice(0, 8).map(x => ({ type: VT[x.type] ? x.type : 'clusteredBarChart', title: String(x.title || ''), n: Math.max(1, Math.min(500, +x.n || 1)), show: x.show === '' || x.show == null || !(+x.show > 0) ? '' : Math.max(1, Math.min(500, +x.show)) }));
    o.detailRows = Math.max(3, Math.min(50, +o.detailRows || 10));
    return o;
  }

  /* The room a visual needs to be read without squinting, in page pixels (Power BI's default fonts),
     plus advice on how it shows its categories. */
  const shownOf = v => vt(v.type).scrolls && +v.show > 0 ? Math.min(+v.n, +v.show) : +v.n;
  function need(v){
    const t = vt(v.type), n = Math.max(1, +v.n || 1), k = shownOf(v), tips = [];
    let w = 300, h = 220;
    switch (t.unit) {
      case 'bars': w = 300; h = Math.max(180, 70 + k * 26); break;
      case 'columns': case 'steps': w = Math.max(300, 90 + k * 40); h = 240; break;
      case 'lines': case 'areas': w = 400; h = 230; break;
      case 'stages': w = 300; h = Math.max(200, 60 + k * 36); break;
      case 'slices': w = 260; h = 220; break;
      case 'boxes': w = 300; h = 220; break;
      case 'locations': w = 380; h = 300; break;
      case 'points': w = 320; h = 260; break;
      case 'rows': w = v.type === 'pivotTable' ? 460 : 420; h = Math.max(180, 64 + k * 24 + 26); break;
    }
    const name = '“' + (v.title || t.label) + '”';
    if (t.scrolls && k < n) tips.push(name + ' shows ' + k + ' of ' + n + ' ' + t.unit + '; the rest scroll. Sort by value so the biggest come first, or use a Top N filter with an “Others” ' + (t.unit === 'rows' ? 'row' : t.unit.replace(/s$/, '')) + ' so nothing hides.');
    else if (t.scrolls && n > 15) tips.push(name + ' shows all ' + n + ' ' + t.unit + ', which takes about ' + (t.unit === 'columns' || t.unit === 'steps' ? w + ' px of width' : h + ' px of height') + '. Set how many to show before scrolling (10 to 12 reads well), or use a Top N filter.');
    if ((t.unit === 'columns' || t.unit === 'steps') && k > 12) tips.push(name + ': over 12 columns crowd the axis labels. A bar chart fits long lists better.');
    if (t.unit === 'slices' && n > 5) tips.push(name + ' has ' + n + ' slices; past 5 they’re hard to compare. Use a bar chart, or group the small ones into “Others”.');
    if ((t.unit === 'lines' || t.unit === 'areas') && n > 5) tips.push(name + ' has ' + n + ' ' + t.unit + '; past 5 it gets tangled. Highlight one and gray the rest, or use small multiples.');
    if (t.unit === 'boxes' && n > 12) tips.push(name + ': over 12 boxes leave tiny, unlabeled tiles. Group the small ones, or use a bar chart.');
    if (t.unit === 'stages' && n > 7) tips.push(name + ': a funnel reads best with 7 stages or fewer.');
    return { w, h, tips };
  }

  function parts(inp){
    const nK = Math.max(0, Math.min(8, +inp.kpis | 0));
    const nT = inp.targets === 'all' ? nK : inp.targets === 'some' ? Math.min(nK, 2) : 0;
    const strip = Array.from({ length: nK }, (_, i) => ({ type: i < nT ? 'kpi' : 'card', title: KPI_NAMES[i] + (i < nT ? ' vs target' : ''), zone: '3' }));
    const tips = [];
    const v30 = (inp.visuals || []).map(v => { const nd = need(v); tips.push(...nd.tips); return { type: v.type, title: v.title || vt(v.type).label, zone: '30', need: { w: nd.w, h: nd.h } }; });
    const rows = Math.max(3, Math.min(50, +inp.detailRows || 10));
    const detailNeed = { w: 560, h: 64 + rows * 24 + 26 };
    const detail = inp.detail === 'page' ? { type: 'tableEx', title: 'Details: individual records', zone: '300', need: detailNeed } : null;
    const nF = Math.max(0, Math.min(8, +inp.filters | 0));
    const place = inp.filterPlace === 'auto' ? (nF <= 3 ? 'header' : 'side') : inp.filterPlace;
    return { strip, v30, detail, nF, place, nK, nT, tips, rows };
  }

  // base config: keep the page, spacing, header style, logo and title; set header/strip/side from the answers
  function frame(base, p){
    const c = JSON.parse(JSON.stringify(base));
    c.header.on = true;
    LO.setHeaderCounts(c.header, 0, p.place === 'header' ? p.nF : 0);
    c.header.items.forEach((x, i) => { x.title = SLICERS[i] || x.title; });
    c.side = p.place === 'side' && p.nF ? { pos: 'right', w: 220, itemH: 60, items: Array.from({ length: p.nF }, (_, i) => ({ type: 'slicer', title: SLICERS[i] })) } : { pos: 'none', w: 220, itemH: 64, items: [] };
    c.strip = { on: p.strip.length > 0, h: p.nT ? 110 : 100, items: p.strip.map(x => Object.assign({}, x)) };
    return c;
  }
  const at = (x, c, r, cs, rs) => Object.assign({}, x, { c, r, cs: cs || 1, rs: rs || 1 });

  // A: rows of patterns, details across the bottom
  function stacked(p){
    const n = p.v30.length, cols = n >= 3 ? 3 : Math.max(1, n === 2 ? 2 : 1), items = [];
    let r = 0;
    if (n) {
      const rows30 = Math.ceil(n / cols);
      for (let i = 0; i < n; i++) {
        const row = Math.floor(i / cols), inRow = Math.min(cols, n - row * cols), k = i - row * cols;
        // share a short row's width: the first item takes the extra columns
        const span = inRow < cols && k === 0 ? cols - inRow + 1 : 1, c0 = k === 0 ? 0 : k + (cols - inRow);
        items.push(at(p.v30[i], c0, row, span));
      }
      r = rows30;
    }
    if (p.detail) items.push(at(p.detail, 0, r, cols)), r++;
    return { cols, rows: Math.max(1, r), items };
  }
  // B: the lead visual (a trend, if there is one) across the top, the rest (and details) side by side below
  function trendLed(p){
    const li = p.v30.findIndex(x => x.type === 'lineChart' || x.type === 'areaChart' || x.type === 'lineClusteredColumnComboChart');
    const list = li > 0 ? [p.v30[li]].concat(p.v30.filter((_, i) => i !== li)) : p.v30;
    const [lead, ...rest] = list;
    if (!lead) return stacked(p);
    const below = rest.concat(p.detail ? [p.detail] : []);
    const cols = Math.max(1, Math.min(4, below.length || 1)), items = [at(lead, 0, 0, cols)];
    below.slice(0, 4).forEach((x, i) => items.push(at(x, i, 1)));
    // more than 4 below: a third row
    below.slice(4).forEach((x, i) => items.push(at(x, i % cols, 2 + Math.floor(i / cols))));
    return { cols, rows: below.length ? 1 + Math.ceil(below.length / cols) : 1, items };
  }
  // C: patterns on the left, a tall details table (or the lead visual) on the right
  function side(p){
    const right = p.detail || p.v30[0], left = p.detail ? p.v30 : p.v30.slice(1);
    if (!right) return stacked(p);
    if (!left.length) return { cols: 1, rows: 1, items: [at(right, 0, 0)] };
    const rows = Math.min(3, left.length <= 2 ? left.length : 2), perRow = Math.ceil(left.length / rows), cols = perRow + 1, items = [];
    // with a details table it goes on the right; otherwise the lead visual takes a tall column on the left
    const shift = p.detail ? 0 : 1;
    left.forEach((x, i) => { const row = Math.floor(i / perRow), k = i % perRow, inRow = Math.min(perRow, left.length - row * perRow); items.push(at(x, shift + (k === 0 ? 0 : k + (perRow - inRow)), row, k === 0 ? perRow - inRow + 1 : 1)); });
    items.push(at(right, p.detail ? perRow : 0, 0, 1, rows));
    return { cols, rows, items };
  }

  /* Relative sizes snapped to twelfths of the grid, so splits land on clean fractions (1/3 + 2/3, 1/4 + 1/2 + 1/4 ...).
     Returns null when the split is even. */
  function snap12(needs){
    const n = needs.length; if (n < 2) return null;
    const tot = needs.reduce((a, b) => a + b, 0), parts = n <= 6 ? 12 : n * 2;
    const ideal = needs.map(v => v / tot * parts), u = ideal.map(v => Math.max(1, Math.round(v)));
    let s = u.reduce((a, b) => a + b, 0);
    while (s > parts) { let j = -1; u.forEach((v, i) => { if (v > 1 && (j < 0 || v - ideal[i] > u[j] - ideal[j])) j = i; }); if (j < 0) break; u[j]--; s--; }
    while (s < parts) { let j = 0; u.forEach((v, i) => { if (ideal[i] - v > ideal[j] - u[j]) j = i; }); u[j]++; s++; }
    return u.every(v => v === u[0]) ? null : u.map(v => Math.round(v / parts * 10000) / 100);
  }
  /* Size the grid's columns and rows to what each visual needs, and say whether it fits the page. */
  function fitGrid(c){
    const g = +c.gap, cols = c.grid.cols, rows = c.grid.rows;
    const colNeed = Array(cols).fill(160), rowNeed = Array(rows).fill(150);
    c.items.forEach(x => { if (!x.need) return;
      const pw = (x.need.w - g * (x.cs - 1)) / x.cs, ph = (x.need.h - g * (x.rs - 1)) / x.rs;
      for (let a = x.c; a < x.c + x.cs; a++) colNeed[a] = Math.max(colNeed[a], pw);
      for (let b = x.r; b < x.r + x.rs; b++) rowNeed[b] = Math.max(rowNeed[b], ph); });
    c.grid.colW = snap12(colNeed); c.grid.rowH = snap12(rowNeed);
    const L0 = LO.layout(c), G = L0.grid;
    const needH = rowNeed.reduce((a, b) => a + b, 0) + g * (rows - 1), needW = colNeed.reduce((a, b) => a + b, 0) + g * (cols - 1);
    const availH = G.bottom - G.top, availW = G.right - G.left;
    const tight = L0.items.filter(o => o.region === 'grid' && c.items[o.idx] && c.items[o.idx].need && (o.w < c.items[o.idx].need.w * 0.9 || o.h < c.items[o.idx].need.h * 0.9));
    return { needH, needW, availH, availW, overH: needH - availH, overW: needW - availW, tight: tight.map(o => o.title), top: G.top };
  }

  function explain(p, v){
    const w = [];
    w.push(['3 s', p.nK ? p.nK + ' headline KPI' + (p.nK === 1 ? '' : 's') + ' top left in large, bold numbers' + (p.nT ? '; ' + p.nT + ' as KPI visual' + (p.nT === 1 ? '' : 's') + ' showing status against target, colored with your good and bad colors' : '') + '.' + (p.nK > 5 ? ' Five or fewer read at a glance; move the rest to a tooltip or a second page.' : '') : 'No headline KPIs: consider at least one, so the page answers “how are we doing?” at a glance.']);
    const bits = p.v30.map(x => vt(x.type).label.toLowerCase()).reduce((a, b) => { a[b] = (a[b] || 0) + 1; return a; }, {});
    const list = Object.entries(bits).map(([k, n]) => n > 1 ? n + ' ' + k.replace(/chart$/, 'charts').replace(/map$/, 'maps').replace(/table$/, 'tables').replace(/^matrix/, 'matrices') : (/^[aeiou]/.test(k) ? 'an ' : 'a ') + k).join(', ');
    w.push(['30 s', (list ? list.charAt(0).toUpperCase() + list.slice(1) + ', each sized for the categories it shows. Sort bars by value and use conditional formatting to flag the ones below target.' : 'No visuals listed yet: add the charts that explain what drives the KPIs.') + (p.nF ? ' ' + p.nF + ' slicer' + (p.nF === 1 ? '' : 's') + (p.place === 'header' ? ' in the header' : ' in a side panel on the right, so the KPIs keep the top-left spot') + '.' : '')]);
    const drill = 'Details on a drill-through page: right-click a bar or point to see its records. Use “Start the detail page” to lay it out.';
    w.push(['300 s', v.drill ? drill + ' Moving them there gives this page’s visuals the room they need.' : p.detail ? (v.id === 'side' ? 'A tall details table on the right, for scanning individual records next to the charts, away from the top-left KPI spot.' : v.id === 'trend' ? 'A details table beside the other visuals, below the lead visual: individual records, formatted, with totals.' : 'Details across the bottom: individual records, formatted, with totals, below everything that needs a first look.') + ' ' + p.rows + ' rows show before it scrolls.' : drill]);
    const f = v.fit, pg = v.cfg.w + ' × ' + v.cfg.h;
    const taller = +v.cfg.h > Math.round(+v.cfg.w * 9 / 16) + 1;
    w.push(['Page', !v.tall && +v.cfg.h > +v.cfg.w ? pg + ': a portrait page, for print or PDF.' + (f.tight.length ? ' ' + f.tight.length + ' visual' + (f.tight.length === 1 ? ' is' : 's are') + ' squeezed: show fewer categories or move details to a drill-through page.' : '')
      : v.tall || taller ? pg + ': taller than 16:9 so every visual gets the room it needs. People scroll down to see it all; in the Power BI service set View to Fit to width.'
      : v.large ? pg + ': a larger 16:9 page gives side-by-side visuals more room. It still fits a screen; Power BI scales it to fit.'
      : f.tight.length ? pg + ': ' + f.tight.length + ' visual' + (f.tight.length === 1 ? ' is' : 's are') + ' squeezed (' + f.tight.slice(0, 3).map(t => '“' + t + '”').join(', ') + (f.tight.length > 3 ? ' …' : '') + '). Show fewer categories before scrolling, move details to a drill-through page, or use a taller page.'
      : pg + ' (16:9): everything fits on one screen with no scrolling. Columns and rows are sized to what each visual needs; adjust them in the grid below.']);
    return w;
  }

  const sameShape = v => JSON.stringify([v.cfg.w, v.cfg.h, v.cfg.grid, v.cfg.items.map(i => [i.type, i.c, i.r, i.cs, i.rs])]);
  function suggest(inp, base){
    inp = normInput(inp);
    const p = parts(inp);
    const make = (id, name, fn, blurb, opt) => {
      opt = opt || {}; const q = opt.noDetail ? Object.assign({}, p, { detail: null }) : p;
      const g = fn(q), c = frame(base, q); c.grid = { cols: g.cols, rows: g.rows }; c.items = g.items; LO.tidy(c);
      // start from a 16:9 page at the page's width, so the layout fits a screen; taller pages only when the visuals need them
      if (+c.h > Math.round(+c.w * 9 / 16) && +c.h <= +c.w) c.h = Math.round(+c.w * 9 / 16);
      if (opt.large) { c.w = 1920; c.h = 1080; }
      let fit = fitGrid(c);
      if (opt.tall) { c.h = Math.min(4000, Math.ceil((fit.top + fit.needH + +c.margin) / 20) * 20); fit = fitGrid(c); }
      c.items.forEach(x => { delete x.need; });
      return { id, name, blurb, cfg: c, fit, drill: !!opt.noDetail || !p.detail, tall: !!opt.tall, large: !!opt.large };
    };
    const A = make('stacked', 'KPIs, then patterns, then details', stacked, 'Reads top to bottom in the 3-30-300 order. The safest choice.');
    const B = make('trend', 'Trend-led', trendLed, 'The lead visual gets the full width; the rest sit side by side beneath it.');
    const C = make('side', p.detail ? 'Details alongside' : 'One focus visual', side, p.detail ? 'Charts on the left, a tall details table on the right.' : 'The lead visual gets a tall column on the left; the rest sit beside it.');
    // rank: which reads best for these answers
    let order = [A, B, C];
    const hasTrend = p.v30.some(x => /line|area/i.test(x.type));
    if (p.detail && p.v30.length >= 3) order = [C, A, B];
    else if (hasTrend && p.v30.length >= 3 && !p.detail) order = [B, A, C];
    // fits: every visual gets at least 90% of the room it needs
    const fits = v => !v.tight, fns = { stacked, trend: trendLed, side };
    const mk = (...a) => { const v = make(...a); v.tight = v.fit.tight.length > 0; return v; };
    order.forEach(v => { v.tight = v.fit.tight.length > 0; });
    const extra = [];
    const lead = order.find(fits) || order.slice().sort((a, b) => (a.fit.overW > 2) - (b.fit.overW > 2) || a.fit.overH - b.fit.overH)[0];
    // the 300-second level can always move to a drill-through page
    if (p.detail) extra.push(mk(lead.id === 'side' ? 'stacked' : lead.id, 'Details on a drill-through page', lead.id === 'side' ? stacked : fns[lead.id], 'Keeps this page to the 3- and 30-second levels, so the visuals get more room; records move to a drill-through page.', { noDetail: true }));
    if (!order.some(fits)) {
      if (lead.fit.overW > 2 && +base.w < 1920) extra.push(mk(lead.id, 'Larger page', fns[lead.id], 'The same layout on a 1920 × 1080 page, so visuals side by side get their width.', { large: true }));
      if (lead.fit.overH > 2) extra.push(mk(lead.id, 'Taller page', fns[lead.id], 'The same layout on a taller page, so every visual shows its categories without squeezing.', { tall: true }));
    }
    const all = order.concat(extra);
    const ranked = all.filter(fits).concat(extra.filter(v => !fits(v)), order.filter(v => !fits(v)));
    const seen = new Set(), res = [];
    ranked.forEach(v => { const k = sameShape(v); if (!seen.has(k) && res.length < 4) { seen.add(k); res.push(v); } });
    const tips = p.tips.slice();
    const nVis = p.v30.length + (p.detail ? 1 : 0);
    if (nVis > 7) tips.push(nVis + ' visuals below the KPIs compete for attention. Six or fewer reads best: split the page in two, or move some to tooltips or a drill-through page.');
    res.forEach((v, i) => { v.recommended = i === 0 && fits(v); v.why = explain(p, v); v.tips = tips;
      const L = LO.layout(v.cfg); v.probs = L.probs; });
    return res;
  }

  function detailPage(base){
    const c = LO.fromTemplate('detail', base);
    c.name = (base.name || 'Report') + ' – details'; c.header.title = c.name;
    c.items = [{ type: 'pivotTable', title: 'Details: individual records', c: 0, r: 0, cs: 1, rs: 1, zone: '300' }];
    return c;
  }

  return { VTYPES, vt, need, shownOf, blankInput, normInput, suggest, detailPage };
})();
