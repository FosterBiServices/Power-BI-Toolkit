
/* ---------- Layout Designer: grid, placement, templates ---------- */
const LO = (() => {
  // Visual types: PBIR visualType, label, sketch kind
  const TYPES = [
    ['card', 'Card', 'card'], ['cardVisual', 'Card (new)', 'card'], ['multiRowCard', 'Multi-row card', 'multicard'], ['kpi', 'KPI', 'kpi'], ['gauge', 'Gauge', 'gauge'],
    ['clusteredColumnChart', 'Column chart', 'column'], ['columnChart', 'Stacked column chart', 'stackcol'], ['clusteredBarChart', 'Bar chart', 'bar'], ['barChart', 'Stacked bar chart', 'stackbar'],
    ['lineChart', 'Line chart', 'line'], ['areaChart', 'Area chart', 'area'], ['lineClusteredColumnComboChart', 'Line and column chart', 'combo'],
    ['waterfallChart', 'Waterfall', 'waterfall'], ['ribbonChart', 'Ribbon chart', 'stackcol'], ['scatterChart', 'Scatter chart', 'scatter'],
    ['pieChart', 'Pie chart', 'pie'], ['donutChart', 'Donut chart', 'donut'], ['treemap', 'Treemap', 'treemap'], ['funnel', 'Funnel', 'funnel'],
    ['map', 'Map', 'map'], ['filledMap', 'Filled map', 'map'], ['azureMap', 'Azure map', 'map'],
    ['tableEx', 'Table', 'table'], ['pivotTable', 'Matrix', 'matrix'],
    ['slicer', 'Slicer', 'slicer'], ['textbox', 'Text box', 'text'], ['image', 'Image', 'image'], ['actionButton', 'Button', 'button'], ['decompositionTreeVisual', 'Decomposition tree', 'decomp']
  ];
  const TYPE = Object.fromEntries(TYPES.map(t => [t[0], { id: t[0], label: t[1], kind: t[2] }]));
  const typeOf = id => TYPE[id] || { id, label: id, kind: 'generic' };

  const PAGE_SIZES = [['1280 × 720 (16:9)', 1280, 720], ['1920 × 1080 (16:9, large)', 1920, 1080], ['1280 × 960 (4:3)', 1280, 960], ['1280 × 1280 (tall)', 1280, 1280], ['816 × 1056 (Letter)', 816, 1056]];

  const it = (type, title, c, r, cs, rs) => ({ type, title, c, r, cs: cs || 1, rs: rs || 1 });
  const TEMPLATES = [
    { id: 'kpi', name: 'KPI strip, charts and a table', cfg: { side: { pos: 'none' }, strip: { on: true, h: 100, items: [['card', 'Sales'], ['card', 'Orders'], ['card', 'Customers'], ['card', 'Margin %']] }, grid: { cols: 3, rows: 2 },
      items: [it('clusteredColumnChart', 'Sales by month', 0, 0, 2), it('donutChart', 'Sales by channel', 2, 0), it('tableEx', 'Top customers', 0, 1, 3)] } },
    { id: 'panel', name: 'Slicer panel on the left', cfg: { side: { pos: 'left', w: 220, itemH: 64, items: [['slicer', 'Year'], ['slicer', 'Region'], ['slicer', 'Segment'], ['slicer', 'Category']] }, strip: { on: true, h: 100, items: [['card', 'Sales'], ['card', 'Orders'], ['card', 'Avg order value']] }, grid: { cols: 2, rows: 2 },
      items: [it('lineChart', 'Sales trend', 0, 0, 2), it('clusteredBarChart', 'Sales by category', 0, 1), it('tableEx', 'Customer detail', 1, 1)] } },
    { id: 'exec', name: 'Executive summary', cfg: { header: { h: 60, items: [['slicer', 'Year'], ['slicer', 'Region']] }, side: { pos: 'none' }, strip: { on: true, h: 110, items: [['kpi', 'Sales vs target'], ['card', 'Orders'], ['card', 'Customers'], ['card', 'Margin %'], ['card', 'Returns']] }, grid: { cols: 3, rows: 1 },
      items: [it('lineChart', 'Sales this year and last year', 0, 0, 2), it('clusteredBarChart', 'Sales by region', 2, 0)] } },
    { id: 'map', name: 'Map with details', cfg: { side: { pos: 'none' }, strip: { on: true, h: 100, items: [['card', 'Sales'], ['card', 'Customers'], ['card', 'Stores']] }, grid: { cols: 3, rows: 2 },
      items: [it('map', 'Sales by city', 0, 0, 2, 2), it('clusteredBarChart', 'Top regions', 2, 0), it('tableEx', 'Store detail', 2, 1)] } },
    { id: 'detail', name: 'Detail table with filters', cfg: { side: { pos: 'left', w: 240, itemH: 64, items: [['slicer', 'Date'], ['slicer', 'Region'], ['slicer', 'Customer'], ['slicer', 'Product'], ['slicer', 'Channel']] }, strip: { on: false, h: 100, items: [] }, grid: { cols: 1, rows: 1 },
      items: [it('pivotTable', 'Sales detail', 0, 0)] } },
    { id: 'quad', name: 'Four quadrants', cfg: { side: { pos: 'none' }, strip: { on: false, h: 100, items: [] }, grid: { cols: 2, rows: 2 },
      items: [it('clusteredColumnChart', 'Sales by month', 0, 0), it('lineChart', 'Orders trend', 1, 0), it('clusteredBarChart', 'Sales by category', 0, 1), it('scatterChart', 'Margin vs sales', 1, 1)] } },
    { id: 'blank', name: 'Blank grid (3 × 2)', cfg: { side: { pos: 'none' }, strip: { on: false, h: 100, items: [] }, grid: { cols: 3, rows: 2 }, items: [] } }
  ];

  function base(){
    return { name: 'Sales overview', w: 1280, h: 720, margin: 10, gap: 10, rounding: 'fit',
      header: { on: true, h: 50, title: 'Sales overview', slicerW: 180, slicerH: 32, cardW: 150, cardH: 40, items: [], logo: { on: false, w: 120, h: 32, src: '', inBg: false } },
      side: { pos: 'none', w: 220, itemH: 64, items: [] },
      strip: { on: true, h: 100, items: [] },
      grid: { cols: 3, rows: 2 }, items: [] };
  }
  function fromTemplate(id, keep){
    const t = TEMPLATES.find(x => x.id === id) || TEMPLATES[0];
    const c = base();
    if (keep) ['name', 'w', 'h', 'margin', 'gap', 'rounding'].forEach(k => { c[k] = keep[k]; }), c.header = Object.assign({ slicerW: 180, slicerH: 32, cardW: 150, cardH: 40, items: [], logo: { on: false, w: 120, h: 32, src: '', inBg: false } }, JSON.parse(JSON.stringify(keep.header)));
    if (t.cfg.header) Object.assign(c.header, { on: true }, JSON.parse(JSON.stringify(t.cfg.header)), { items: (t.cfg.header.items || []).map(([type, title]) => ({ type, title })) });
    const s = t.cfg;
    c.side = Object.assign({ pos: 'none', w: 220, itemH: 64, items: [] }, JSON.parse(JSON.stringify(s.side)));
    c.side.items = (s.side.items || []).map(([type, title]) => ({ type, title }));
    c.strip = { on: s.strip.on, h: s.strip.h, items: (s.strip.items || []).map(([type, title]) => ({ type, title })) };
    c.grid = Object.assign({}, s.grid);
    c.items = s.items.map(x => Object.assign({}, x));
    return upgrade(c);
  }

  /* n sizes filling `total` with `gap` between them.
     fit: whole pixels that add up exactly (spare pixels go to the first ones);
     roundup: every size rounded up, as on the Alignment page (can run a pixel or two past the edge) */
  function split(total, n, gap, rounding){
    if (n <= 0) return [];
    const avail = total - gap * (n - 1);
    if (rounding === 'roundup') return Array(n).fill(Math.ceil(avail / n));
    if (rounding === 'exact') return Array(n).fill(Math.round(avail / n * 100) / 100);
    const b = Math.floor(avail / n), rem = avail - b * n;
    return Array.from({ length: n }, (_, i) => b + (i < rem ? 1 : 0));
  }
  const starts = (origin, sizes, gap) => { const out = []; let x = origin; sizes.forEach(s => { out.push(x); x += s + gap; }); return out; };

  // Everything on the page, positioned: [{ id, region, type, title, x, y, w, h }] + problems
  function layout(c){
    const W = +c.w, H = +c.h, m = +c.margin, g = +c.gap, R = c.rounding;
    const out = [], probs = [];
    const hdr = c.header.on ? +c.header.h : 0;
    let top = m + (hdr ? hdr + g : 0);
    const side = c.side.pos === 'left' || c.side.pos === 'right' ? +c.side.w : 0;
    const left = m + (c.side.pos === 'left' ? side + g : 0);
    const right = W - m - (c.side.pos === 'right' ? side + g : 0);
    const cw = right - left;
    let limits = null;
    if (hdr) {
      out.push({ id: 'header', region: 'header', type: 'textbox', title: c.header.title || '', x: m, y: m, w: W - 2 * m, h: hdr, band: true });
      /* Header, left to right: [inset] logo [logo gap] title ... [inset] cards, slicers [pad].
         The title keeps the width it needs; logo and items share what's left, so nothing overlaps. */
      const inset = 12, logoGap = 24, pad = Math.max(4, Math.min(10, g)), maxH = Math.max(8, hdr - 8);
      const fs = Math.max(14, Math.min(24, hdr * 0.42));
      const titleNeed = c.header.title ? Math.ceil(measure(c.header.title, fs)) : 0;
      const lg = c.header.logo || {}, hi = c.header.items || [];
      const nC = hi.filter(x => x.type === 'card').length, nS = hi.length - nC;
      const reqC = [Math.max(40, +c.header.cardW || 150), Math.min(Math.max(16, +c.header.cardH || 40), maxH)];
      const reqS = [Math.max(40, +c.header.slicerW || 180), Math.min(Math.max(16, +c.header.slicerH || 32), maxH)];
      // logo size at the clamped height, keeping its proportions
      let lh = 0, lw = 0;
      if (lg.on) { const wantH = Math.max(8, +lg.h || 32), wantW = Math.max(8, +lg.w || 120); lh = Math.min(wantH, maxH); lw = wantW * lh / wantH; }
      const room = (W - 2 * m) - inset - (titleNeed ? titleNeed + inset : 0) - (lg.on ? logoGap : 0) - pad - (hi.length ? inset : 0) - Math.max(0, hi.length - 1) * g;
      const cardMaxW = nC ? Math.floor((room - lw - nS * reqS[0]) / nC) : null;
      const cW = nC ? Math.max(40, Math.min(reqC[0], cardMaxW)) : 0;
      const slicerMaxW = nS ? Math.floor((room - lw - nC * cW) / nS) : null;
      const sW = nS ? Math.max(40, Math.min(reqS[0], slicerMaxW)) : 0;
      const logoMaxW = lg.on ? Math.floor(room - nC * cW - nS * sW) : null;
      if (lg.on && lw > logoMaxW) { const k = Math.max(8, logoMaxW) / lw; lw *= k; lh *= k; }
      limits = { itemMaxH: maxH, logoMaxH: maxH, cardMaxW, slicerMaxW, logoMaxW, titleNeed };
      if ((nC && cardMaxW < 40) || (nS && slicerMaxW < 40)) probs.push({ level: 'warn', text: 'There isn’t room in the header for ' + (nC ? nC + ' card' + (nC === 1 ? '' : 's') : '') + (nC && nS ? ' and ' : '') + (nS ? nS + ' slicer' + (nS === 1 ? '' : 's') : '') + ' beside the ' + (lg.on ? 'logo and ' : '') + 'title. Use fewer, a shorter title, or a wider page.' });
      let titleX = m + inset;
      if (lg.on) {
        out.push({ id: 'logo', region: 'header', type: 'image', title: 'Logo', x: m + inset, y: m + (hdr - lh) / 2, w: lw, h: lh, src: lg.src || '', logo: true });
        titleX = m + inset + lw + logoGap;
      }
      const titleAt = out.length;
      let right = W - m - inset;
      if (hi.length) {
        const total = nC * cW + nS * sW + (hi.length - 1) * g; let x = W - m - pad - total;
        right = x - inset;
        hi.forEach((it, i) => { const [iw, ih] = it.type === 'card' ? [cW, reqC[1]] : [sW, reqS[1]]; out.push({ id: 'h' + i, region: 'header', idx: i, type: it.type, title: it.title, x, y: m + (hdr - ih) / 2, w: iw, h: ih, tile: true }); x += iw + g; });
      }
      if (c.header.title) out.splice(titleAt, 0, { id: 'title', region: 'header', type: 'textbox', title: c.header.title, x: titleX, y: m, w: Math.max(0, right - titleX), h: hdr, band: true, fontSize: fs });
    }
    if (side) {
      const sx = c.side.pos === 'left' ? m : W - m - side, sh = H - m - top;
      out.push({ id: 'side', region: 'side', type: '', title: 'Side panel', x: sx, y: top, w: side, h: sh, band: true });
      const ih = +c.side.itemH || 64; let y = top + g;
      c.side.items.forEach((x, i) => {
        if (y + ih > top + sh - g + 0.01) { probs.push({ level: 'warn', text: 'The side panel is too short for ' + c.side.items.length + ' items of ' + ih + ' px; ' + (c.side.items.length - i) + ' left off the page.' }); y = Infinity; return; }
        out.push({ id: 's' + i, region: 'side', idx: i, type: x.type, title: x.title, zone: x.zone, x: sx + g, y, w: side - 2 * g, h: ih }); y += ih + g;
      });
    }
    if (c.strip.on && c.strip.items.length) {
      const sh = +c.strip.h, ws = split(cw, c.strip.items.length, g, R), xs = starts(left, ws, g);
      c.strip.items.forEach((x, i) => out.push({ id: 't' + i, region: 'strip', idx: i, type: x.type, title: x.title, zone: x.zone, x: xs[i], y: top, w: ws[i], h: sh }));
      top += sh + g;
    }
    const cols = Math.max(1, +c.grid.cols || 1), rows = Math.max(1, +c.grid.rows || 1);
    const gw = split(cw, cols, g, R), gh = split(H - m - top, rows, g, R);
    const gx = starts(left, gw, g), gy = starts(top, gh, g);
    const grid = { cols, rows, x: gx, y: gy, w: gw, h: gh, left, top, right, bottom: H - m };
    const taken = {};
    c.items.forEach((x, i) => {
      const c0 = x.c, r0 = x.r, cs = Math.max(1, x.cs || 1), rs = Math.max(1, x.rs || 1);
      if (c0 >= cols || r0 >= rows) { probs.push({ level: 'warn', text: '“' + (x.title || typeOf(x.type).label) + '” is outside the ' + cols + ' × ' + rows + ' grid, so it’s left out.' }); return; }
      const c1 = Math.min(cols, c0 + cs) - 1, r1 = Math.min(rows, r0 + rs) - 1;
      for (let a = c0; a <= c1; a++) for (let b = r0; b <= r1; b++) { const k = a + ',' + b; if (taken[k] !== undefined) probs.push({ level: 'warn', text: '“' + (x.title || typeOf(x.type).label) + '” overlaps “' + (c.items[taken[k]].title || typeOf(c.items[taken[k]].type).label) + '”.' }); taken[k] = i; }
      out.push({ id: 'g' + i, region: 'grid', idx: i, type: x.type, title: x.title, zone: x.zone, x: gx[c0], y: gy[r0], w: gx[c1] + gw[c1] - gx[c0], h: gy[r1] + gh[r1] - gy[r0], c: c0, r: r0, cs: c1 - c0 + 1, rs: r1 - r0 + 1 });
    });
    // sanity
    if (gw.some(v => v < 60) || gh.some(v => v < 60)) probs.push({ level: 'warn', text: 'Some grid cells are under 60 px (' + Math.min(...gw) + ' × ' + Math.min(...gh) + '). Use fewer columns or rows, or a smaller gap.' });
    if (cw <= 0 || H - m - top <= 0) probs.push({ level: 'err', text: 'The header, strip and side panel leave no room for the grid.' });
    const over = out.filter(o => !o.band && (o.x + o.w > W + 0.01 || o.y + o.h > H + 0.01));
    if (over.length) probs.push({ level: 'info', text: 'Rounding up puts ' + over.length + ' visual' + (over.length === 1 ? '' : 's') + ' up to ' + Math.ceil(Math.max(...over.map(o => Math.max(o.x + o.w - W, o.y + o.h - H)))) + ' px past the page edge. Choose “Fill exactly” to keep everything inside.' });
    const empty = []; for (let a = 0; a < cols; a++) for (let b = 0; b < rows; b++) if (taken[a + ',' + b] === undefined) empty.push([a, b]);
    return { items: out, grid, probs, empty, limits };
  }

  let measure = (text, size) => String(text).length * size * 0.56;
  const setMeasure = fn => { measure = fn; };
  const r2 = v => Math.round(v * 100) / 100;
  // a visual's area inside its card: clear of the rounded corners, with the same padding the wireframe's sample visuals use
  function inset(o, radius){ return Math.max(Math.min(12, o.w * 0.06, o.h * 0.08), Math.ceil((+radius || 0) * 0.3)); }
  function positionsTsv(L, st){
    st = st || {};
    const cards = st.cards !== 'none', onCard = o => cards && !o.band && !o.logo && (o.region !== 'header' || o.tile) && (o.region !== 'side' || st.side === 'none');
    return ['Visual\tType\tX\tY\tWidth\tHeight\tInner X\tInner Y\tInner width\tInner height'].concat(L.items.filter(o => !o.band || o.id === 'header' || o.id === 'title').map(o => {
      const p = onCard(o) ? inset(o, st.radius) : null;
      return [o.id === 'header' ? 'Header band' : o.title || typeOf(o.type).label, o.id === 'header' ? 'Shape / background' : o.id === 'title' ? 'Title (drawn on the background)' : o.logo ? 'Image (logo)' : typeOf(o.type).label, r2(o.x), r2(o.y), r2(o.w), r2(o.h)]
        .concat(p == null ? ['', '', '', ''] : [r2(o.x + p), r2(o.y + p), r2(o.w - 2 * p), r2(o.h - 2 * p)]).join('\t');
    })).join('\n');
  }

  // Header holds only cards and slicers: set how many of each (cards first), keeping their names
  const HDR_NAMES = { card: ['Sales', 'Orders', 'Customers', 'Margin %', 'Returns', 'Stores', 'Units', 'Avg order'], slicer: ['Year', 'Region', 'Segment', 'Category', 'Channel', 'Month', 'Product', 'Customer'] };
  function setHeaderCounts(h, cards, slicers){
    const now = t => (h.items || []).filter(x => x.type === t);
    const fill = (t, n) => { const cur = now(t).slice(0, n); for (let i = cur.length; i < n; i++) cur.push({ type: t, title: HDR_NAMES[t][i % 8] }); return cur; };
    h.items = fill('card', Math.max(0, Math.min(8, cards | 0))).concat(fill('slicer', Math.max(0, Math.min(8, slicers | 0))));
  }
  function upgrade(c){
    const h = c.header = Object.assign({ slicerW: 180, slicerH: 32, cardW: 150, cardH: 40, items: [], logo: { on: false, w: 120, h: 32, src: '', inBg: false } }, c.header || {});
    if (h.itemW && !c.header._m) { h.slicerW = h.itemW; h.slicerH = h.itemH || 32; }
    delete h.itemW; delete h.itemH;
    h.items = (h.items || []).map(x => ({ type: x.type === 'card' || x.type === 'cardVisual' || x.type === 'kpi' ? 'card' : 'slicer', title: x.title }));
    setHeaderCounts(h, h.items.filter(x => x.type === 'card').length, h.items.filter(x => x.type === 'slicer').length);
    return c;
  }

  return { TYPES, TYPE, typeOf, PAGE_SIZES, TEMPLATES, base, fromTemplate, split, layout, positionsTsv, inset, setHeaderCounts, upgrade, setMeasure };
})();
