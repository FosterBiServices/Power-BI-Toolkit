
/* ---------- Layout Designer: 3-30-3 layout suggestions ----------
   3 seconds: headline KPIs top left, big numbers, status against target.
   30 seconds: trend and breakdowns (bars, map, heatmap) to spot patterns and weak spots.
   300 seconds: details on demand: formatted records here or on a drill-through page. */
const LS = (() => {
  const CATS = ['Region', 'Product', 'Channel', 'Segment'];
  const KPI_NAMES = ['Sales', 'Margin %', 'Orders', 'Customers', 'Avg order value', 'Returns', 'Units', 'Growth %'];
  const blankInput = () => ({ kpis: 4, targets: 'some', trend: true, breakdowns: 2, geo: false, heatmap: false, detail: 'page', filters: 3, filterPlace: 'auto' });

  function parts(inp){
    const nK = Math.max(0, Math.min(8, +inp.kpis | 0));
    const nT = inp.targets === 'all' ? nK : inp.targets === 'some' ? Math.min(nK, 2) : 0;
    const strip = Array.from({ length: nK }, (_, i) => ({ type: i < nT ? 'kpi' : 'card', title: KPI_NAMES[i] + (i < nT ? ' vs target' : ''), zone: '3' }));
    const v30 = [];
    if (inp.trend) v30.push({ type: 'lineChart', title: 'Sales trend this year vs last', zone: '30' });
    const nB = Math.max(0, Math.min(4, +inp.breakdowns | 0));
    for (let i = 0; i < nB; i++) v30.push(i === 0 && inp.geo ? { type: 'map', title: 'Sales by location', zone: '30' } : { type: 'clusteredBarChart', title: 'Sales by ' + CATS[i].toLowerCase(), zone: '30' });
    if (inp.heatmap) v30.push({ type: 'pivotTable', title: 'Heatmap: region × month', zone: '30' });
    const detail = inp.detail === 'page' ? { type: 'tableEx', title: 'Details: individual records', zone: '300' } : null;
    const nF = Math.max(0, Math.min(8, +inp.filters | 0));
    const place = inp.filterPlace === 'auto' ? (nF <= 3 ? 'header' : 'side') : inp.filterPlace;
    return { strip, v30, detail, nF, place, nK, nT };
  }

  // base config: keep the page, spacing, header style, logo and title; set header/strip/side from the answers
  function frame(base, p){
    const c = JSON.parse(JSON.stringify(base));
    c.header.on = true;
    const cards = (c.header.items || []).filter(x => x.type === 'card').length;
    LO.setHeaderCounts(c.header, 0, p.place === 'header' ? p.nF : 0);
    c.header.items.forEach((x, i) => { x.title = ['Year', 'Region', 'Product', 'Channel', 'Segment', 'Month', 'Customer', 'Category'][i] || x.title; });
    c.side = p.place === 'side' && p.nF ? { pos: 'right', w: 220, itemH: 60, items: Array.from({ length: p.nF }, (_, i) => ({ type: 'slicer', title: ['Year', 'Region', 'Product', 'Channel', 'Segment', 'Month', 'Customer', 'Category'][i] })) } : { pos: 'none', w: 220, itemH: 64, items: [] };
    c.strip = { on: p.strip.length > 0, h: p.nT ? 110 : 100, items: p.strip.map(x => Object.assign({}, x)) };
    void cards;
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
  // B: the trend across the top, breakdowns (and details) side by side below
  function trendLed(p){
    const [lead, ...rest] = p.v30;
    if (!lead) return stacked(p);
    const below = rest.concat(p.detail ? [p.detail] : []);
    const cols = Math.max(1, Math.min(4, below.length || 1)), items = [at(lead, 0, 0, cols)];
    below.forEach((x, i) => items.push(at(x, i, 1)));
    return { cols, rows: below.length ? 2 : 1, items };
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

  function explain(p, kind){
    const w = [];
    w.push(['3 s', p.nK ? p.nK + ' headline KPI' + (p.nK === 1 ? '' : 's') + ' top left in large, bold numbers' + (p.nT ? '; ' + p.nT + ' as KPI visual' + (p.nT === 1 ? '' : 's') + ' showing status against target, colored with your good and bad colors' : '') + '.' : 'No headline KPIs: consider at least one, so the page answers “how are we doing?” at a glance.']);
    const bits = p.v30.map(x => x.type === 'lineChart' ? 'a trend line' : x.type === 'map' ? 'a map' : x.type === 'pivotTable' ? 'a heatmap (matrix with conditional formatting)' : 'a bar chart').reduce((a, b) => { a[b] = (a[b] || 0) + 1; return a; }, {});
    const list = Object.entries(bits).map(([k, n]) => n > 1 ? n + ' ' + k.replace(/^a /, '').replace('chart', 'charts') : k).join(', ');
    w.push(['30 s', (list ? list.charAt(0).toUpperCase() + list.slice(1) + ' to spot patterns and weak categories. Sort bars by value and use conditional formatting to flag the ones below target.' : 'No trend or breakdowns yet: add one to explain what drives the KPIs.') + (p.nF ? ' ' + p.nF + ' slicer' + (p.nF === 1 ? '' : 's') + (p.place === 'header' ? ' in the header' : ' in a side panel on the right, so the KPIs keep the top-left spot') + '.' : '')]);
    w.push(['300 s', p.detail ? (kind === 'side' ? 'A tall details table on the right, for scanning individual records next to the charts, away from the top-left KPI spot.' : kind === 'trend' ? 'A details table beside the breakdowns, below the trend: individual records, formatted, with totals.' : 'Details across the bottom: individual records, formatted, with totals, below everything that needs a first look.') : 'Details on a drill-through page: right-click a bar or point to see its records. Use \u201cStart the detail page\u201d to lay it out.']);
    return w;
  }

  function suggest(inp, base){
    const p = parts(inp), out = [];
    const make = (id, name, fn, blurb) => { const g = fn(p), c = frame(base, p); c.grid = { cols: g.cols, rows: g.rows }; c.items = g.items; return { id, name, blurb, cfg: c, why: explain(p, id) }; };
    const A = make('stacked', 'KPIs, then patterns, then details', stacked, 'Reads top to bottom in the 3-30-300 order. The safest choice.');
    const B = make('trend', 'Trend-led', trendLed, 'The trend gets the full width; breakdowns sit side by side beneath it.');
    const C = make('side', p.detail ? 'Details alongside' : 'One focus visual', side, p.detail ? 'Charts on the left, a tall details table on the right.' : 'The lead visual gets a tall column on the left; the rest sit beside it.');
    // rank: which reads best for these answers
    let order = [A, B, C];
    if (p.detail && p.v30.length >= 3) order = [C, A, B];
    else if (inp.trend && p.v30.length >= 3 && !p.detail) order = [B, A, C];
    const seen = new Set(), res = [];
    order.forEach(v => { const k = JSON.stringify(v.cfg.grid) + JSON.stringify(v.cfg.items.map(i => [i.c, i.r, i.cs, i.rs])); if (!seen.has(k)) { seen.add(k); res.push(v); } });
    res.forEach((v, i) => { v.recommended = i === 0; const L = LO.layout(v.cfg); v.probs = L.probs; const small = L.items.filter(o => o.region === 'grid' && (o.h < 140 || o.w < 180)); if (small.length) v.probs = v.probs.concat([{ level: 'info', text: small.length + ' visual' + (small.length === 1 ? ' is' : 's are') + ' small at this page size. A taller page (1280 × 960) or fewer visuals gives them more room.' }]); });
    return res;
  }

  function detailPage(base){
    const c = LO.fromTemplate('detail', base);
    c.name = (base.name || 'Report') + ' – details'; c.header.title = c.name;
    c.items = [{ type: 'pivotTable', title: 'Details: individual records', c: 0, r: 0, cs: 1, rs: 1, zone: '300' }];
    return c;
  }

  return { blankInput, suggest, detailPage };
})();
