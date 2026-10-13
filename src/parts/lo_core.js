
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
    { id: 'blank', name: 'Empty grid (3 × 2)', cfg: { side: { pos: 'none' }, strip: { on: false, h: 100, items: [] }, grid: { cols: 3, rows: 2 }, items: [] } }
  ];

  function base(){
    return { name: 'Sales overview', w: 1280, h: 720, margin: 10, gap: 10, rounding: 'fit',
      header: { on: true, h: 50, title: 'Sales overview', slicerW: 180, slicerH: 32, cardW: 150, cardH: 40, items: [], logo: { on: false, w: 120, h: 32, src: '', inBg: false } },
      side: { pos: 'none', w: 220, itemH: 64, items: [] },
      labels: { on: false, w: 140, items: [] },
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
    c.labels = keep && keep.labels ? JSON.parse(JSON.stringify(keep.labels)) : { on: false, w: 140, items: [] };
    c.grid = Object.assign({}, s.grid, keep && keep.grid && keep.grid.grow ? { grow: keep.grid.grow } : {});
    c.items = s.items.map(x => Object.assign({}, x));
    return tidy(upgrade(c));
  }

  /* n sizes filling `total` with `gap` between them, in proportion to `weights` (even when left out).
     fit: whole pixels that add up exactly (spare pixels go to the sizes that lost the most to rounding, the first ones on ties);
     roundup: every size rounded up, as on the Alignment page (can run a pixel or two past the edge) */
  function split(total, n, gap, rounding, weights){
    if (n <= 0) return [];
    const avail = total - gap * (n - 1);
    const wt = Array.isArray(weights) && weights.length === n && weights.every(v => +v > 0) ? weights.map(Number) : Array(n).fill(1);
    const sum = wt.reduce((a, b) => a + b, 0), raw = wt.map(v => avail * v / sum);
    if (rounding === 'roundup') return raw.map(v => Math.ceil(v - 1e-9));
    if (rounding === 'exact') return raw.map(v => Math.round(v * 100) / 100);
    const out = raw.map(v => Math.floor(v + 1e-9)); let rem = Math.round(avail - out.reduce((a, b) => a + b, 0));
    const order = raw.map((v, i) => [v - out[i], i]).sort((a, b) => (Math.abs(b[0] - a[0]) < 1e-9 ? 0 : b[0] - a[0]) || a[1] - b[1]);
    for (let k = 0; rem > 0 && k < order.length; k++, rem--) out[order[k][1]]++;
    return out;
  }
  /* Merge columns (and rows) that no visual starts or ends on: a map spanning two of three even columns
     becomes a two-column grid about 2/3 + 1/3, so the column count matches what's on the page. Only for a full grid (no empty cells). */
  function tidy(c){
    const g = c.grid, its = c.items;
    const full = () => { const n = {}; its.forEach(x => { for (let a = x.c; a < x.c + x.cs; a++) for (let b = x.r; b < x.r + x.rs; b++) n[a + ',' + b] = 1; }); return Object.keys(n).length === g.cols * g.rows; };
    if (!its.length || its.some(x => x.c + x.cs > g.cols || x.r + x.rs > g.rows) || !full()) return c;
    // sizes in pixels, so a merged column keeps the gap it covered and still lines up with the card strip
    const G = layout(c).grid, gap = +c.gap || 0;
    [['c', 'cs', 'cols', 'colW', G.w], ['r', 'rs', 'rows', 'rowH', G.h]].forEach(([p, sp, n, wk, px]) => {
      const w = px.slice();
      for (let i = g[n] - 2; i >= 0; i--) {
        if (its.some(x => x[p] + x[sp] - 1 === i || x[p] === i + 1)) continue;
        its.forEach(x => { if (x[p] > i) x[p]--; else if (x[p] + x[sp] - 1 > i) x[sp]--; });
        w.splice(i, 2, w[i] + gap + w[i + 1]); g[n]--;
      }
      const t = w.reduce((a, b) => a + b, 0), pc = w.map(v => Math.round(v / t * 10000) / 100);
      if (w.length < px.length) { g[wk] = isEven(pc) ? null : pc; g[wk === 'colW' ? 'colPx' : 'rowPx'] = null; }
    });
    return c;
  }
  // grid.colW / grid.rowH: relative sizes of the columns and rows; null (or the wrong length) means even
  const weightsOf = (arr, n) => Array.isArray(arr) && arr.length === n && arr.every(v => +v > 0) ? arr.map(Number) : null;
  const isEven = arr => !arr || arr.every(v => Math.abs(v - arr[0]) < 1e-9);
  // grid.colPx / grid.rowPx: sizes in px the user fixed (null where a column or row is sized for them); null when none is fixed
  const fixedOf = (arr, n) => Array.isArray(arr) && arr.length === n && arr.some(v => +v > 0) ? arr.map(v => +v > 0 ? +v : null) : null;
  /* Sizes along one axis: fixed ones keep their px, the others share what's left (by their weights), so margin and gap stay put.
     When every one is fixed, `left` is the room they leave empty (or, below 0, how far they run past the margin). */
  function sized(total, n, gap, rounding, weights, fx){
    if (!fx) return { s: split(total, n, gap, rounding, weights) };
    const avail = total - gap * (n - 1), used = fx.reduce((a, v) => a + (v || 0), 0), free = [];
    fx.forEach((v, i) => { if (v == null) free.push(i); });
    if (!free.length) return { s: fx.slice(), all: true, left: avail - used, used, avail };
    const fw = weights ? free.map(i => weights[i]) : free.map(() => 1), ft = fw.reduce((a, b) => a + b, 0);
    const rest = avail - used, ws = split(rest + gap * (free.length - 1), free.length, gap, rounding, fw), s = fx.slice();
    free.forEach((i, k) => { s[i] = Math.max(1, ws[k]); });
    // the smallest share the others get of what's left, to work out how much bigger the page needs to be
    return { s, rest, free: free.length, freeAt: free, used, avail, minShare: Math.min(...fw) / ft };
  }
  const MIN_SHARE = 0.1;   // a column or row sized for the user under 10% of the grid gets a warning
  const starts = (origin, sizes, gap) => { const out = []; let x = origin; sizes.forEach(s => { out.push(x); x += s + gap; }); return out; };

  // Everything on the page, positioned: [{ id, region, type, title, x, y, w, h }] + problems
  function layout(c){
    const W = +c.w, H = +c.h, m = +c.margin, g = +c.gap, R = c.rounding;
    const out = [], probs = [];
    const hdr = c.header.on ? +c.header.h : 0;
    let top = m + (hdr ? hdr + g : 0);
    const side = c.side.pos === 'left' || c.side.pos === 'right' ? +c.side.w : 0;
    let left = m + (c.side.pos === 'left' ? side + g : 0);
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
    // row labels: a column down the left of the grid, one box beside each row
    const lab = c.labels && c.labels.on ? Math.max(40, +c.labels.w || 140) : 0, labX = left;
    { const d = lab ? lab + g : 0; left += d; }
    const gcw = right - left;
    const SC = sized(gcw, cols, g, R, weightsOf(c.grid.colW, cols), fixedOf(c.grid.colPx, cols)), SR = sized(H - m - top, rows, g, R, weightsOf(c.grid.rowH, rows), fixedOf(c.grid.rowPx, rows));
    const gw = SC.s, gh = SR.s, roomFor = {};
    [[SC, 'column', 'width', 'Columns', 'on the right'], [SR, 'row', 'height', 'Rows', 'at the bottom']].forEach(([S, one, dim, Many, edge]) => {
      const px = v => Math.round(v * 100) / 100 + ' px';
      if (S.all && Math.abs(S.left) > 0.5) probs.push({ level: 'warn', text: 'Every ' + one + ' has a ' + dim + ' set, and together they come to ' + px(S.used) + ', but the grid has ' + px(S.avail) + ' (after the margin and gaps). '
        + (S.left > 0 ? 'That leaves ' + px(S.left) + ' empty ' + edge : 'The last ' + one + ' runs ' + px(-S.left) + ' past the margin ' + edge) + ', so the spacing isn’t even. Change a ' + dim + ', clear one so it fills the rest, or choose “Fit to the page”.' });
      else if (S.free) {
        /* a column (or row) sized for the user under 10% of the grid: say which, and how big the page needs to be
           for it to get 10% while the set sizes stay as they are */
        const small = S.freeAt.filter(i => S.s[i] < S.avail * MIN_SHARE);
        if (small.length) {
          const need = S.minShare > MIN_SHARE ? S.used * S.minShare / (S.minShare - MIN_SHARE) : null, ax = one === 'column' ? 'w' : 'h';
          const to = need ? Math.ceil((+c[ax] + need - S.avail) / 10) * 10 : null;
          if (to) roomFor[ax] = to;
          const lo = Math.min(...small.map(i => S.s[i]));
          probs.push({ level: S.rest <= 0 ? 'err' : 'warn', text: (small.length === 1 ? Many.slice(0, -1) : Many) + ' ' + small.map(i => i + 1).join(', ') + (small.length === 1 ? ' is' : ' are') + ' only ' + px(lo) + ' (' + Math.round(lo / S.avail * 1000) / 10 + '% of the grid), because the ' + dim + 's you set take ' + px(S.used) + ' of ' + px(S.avail) + '. '
            + (to ? 'Make the page at least ' + to + ' px ' + (ax === 'w' ? 'wide' : 'tall') + ' (“Make room” under ' + one + ' ' + dim + 's), or make a set ' + dim + ' smaller.' : 'Make a set ' + dim + ' smaller.') });
        }
      }
    });
    const gx = starts(left, gw, g), gy = starts(top, gh, g);
    // a label can cover several rows (a group of rows under one name); the rows it covers have no label of their own
    if (lab) for (let r = 0; r < rows; ) { const s = labelSpan(c, r, rows);
      out.push({ id: 'l' + r, region: 'labels', idx: r, type: 'textbox', title: labelOf(c, r), x: labX, y: gy[r], w: lab, h: gy[r + s - 1] + gh[r + s - 1] - gy[r], rs: s }); r += s; }
    const grid = { cols, rows, x: gx, y: gy, w: gw, h: gh, left, top, right, bottom: H - m };
    const taken = {};
    c.items.forEach((x, i) => {
      const c0 = x.c, r0 = x.r, cs = Math.max(1, x.cs || 1), rs = Math.max(1, x.rs || 1);
      if (c0 >= cols || r0 >= rows) { probs.push({ level: 'warn', text: '“' + (x.title || typeOf(x.type).label) + '” is outside the ' + cols + ' × ' + rows + ' grid, so it’s left out.' }); return; }
      const c1 = Math.min(cols, c0 + cs) - 1, r1 = Math.min(rows, r0 + rs) - 1;
      for (let a = c0; a <= c1; a++) for (let b = r0; b <= r1; b++) { const k = a + ',' + b; if (taken[k] !== undefined) probs.push({ level: 'warn', text: '“' + (x.title || typeOf(x.type).label) + '” overlaps “' + (c.items[taken[k]].title || typeOf(c.items[taken[k]].type).label) + '”.' }); taken[k] = i; }
      const box = { id: 'g' + i, region: 'grid', idx: i, type: x.type, title: x.title, zone: x.zone, x: gx[c0], y: gy[r0], w: gx[c1] + gw[c1] - gx[c0], h: gy[r1] + gh[r1] - gy[r0], c: c0, r: r0, cs: c1 - c0 + 1, rs: r1 - r0 + 1 };
      // a cell split into smaller boxes (a cluster of cards): same gap between them, each its own visual
      const sc = x.sub ? Math.max(1, Math.min(6, x.sub.cols | 0 || 1)) : 1, sr = x.sub ? Math.max(1, Math.min(6, x.sub.rows | 0 || 1)) : 1;
      if (sc * sr < 2) { out.push(box); return; }
      const sw = split(box.w, sc, g, R), sh = split(box.h, sr, g, R), sx = starts(box.x, sw, g), sy = starts(box.y, sh, g);
      for (let b = 0; b < sr; b++) for (let a = 0; a < sc; a++) { const k = b * sc + a, s = (x.sub.items || [])[k] || {};
        out.push(Object.assign({}, box, { id: 'g' + i + '.' + k, parent: 'g' + i, sub: k, type: s.type || x.type, title: s.title != null ? s.title : (x.title || typeOf(x.type).label) + ' ' + (k + 1), x: sx[a], y: sy[b], w: sw[a], h: sh[b] })); }
      if (Math.min(...sw, ...sh) < 30) probs.push({ level: 'warn', text: '“' + (x.title || typeOf(x.type).label) + '” is split into boxes under 30 px. Split it into fewer, or make it bigger.' });
    });
    // sanity
    if (gw.some(v => v < 60) || gh.some(v => v < 60)) probs.push({ level: 'warn', text: 'Some grid cells are under 60 px (' + Math.min(...gw) + ' × ' + Math.min(...gh) + '). Use fewer columns or rows, or a smaller gap.' });
    if (gcw <= 0 || H - m - top <= 0) probs.push({ level: 'err', text: 'The header, strip and side panel leave no room for the grid.' });
    const over = R !== 'roundup' || (SC.all && SC.left < 0) || (SR.all && SR.left < 0) ? [] : out.filter(o => !o.band && (o.x + o.w > W + 0.01 || o.y + o.h > H + 0.01));
    if (over.length) probs.push({ level: 'info', text: 'Rounding up puts ' + over.length + ' visual' + (over.length === 1 ? '' : 's') + ' up to ' + Math.ceil(Math.max(...over.map(o => Math.max(o.x + o.w - W, o.y + o.h - H)))) + ' px past the page edge. Choose “Fill exactly” to keep everything inside.' });
    const empty = []; for (let a = 0; a < cols; a++) for (let b = 0; b < rows; b++) if (taken[a + ',' + b] === undefined) empty.push([a, b]);
    return { items: out, grid, probs, empty, limits, roomFor };
  }

  /* ---------- row by row: each row with its own visuals and widths ---------- */
  // the page as rows: per grid row, its pieces left to right (visuals, or empty cells: idx null) and where each ends (px from the grid's left)
  function rowsOf(c){
    const L = layout(c), G = L.grid, room = G.right - G.left, out = [];
    for (let r = 0; r < G.rows; r++) {
      const ps = L.items.filter(o => o.region === 'grid' && !o.sub && o.r <= r && r < o.r + o.rs).map(o => ({ c: o.c, cs: o.cs, idx: o.idx }))
        .concat(L.empty.filter(e => e[1] === r).map(e => ({ c: e[0], cs: 1, idx: null }))).sort((a, b) => a.c - b.c);
      const pieces = []; let next = 0;
      ps.forEach(p => { if (p.c >= next) { pieces.push(p); next = p.c + p.cs; } });
      const ends = pieces.map((p, k) => k === pieces.length - 1 ? room : G.x[p.c + p.cs - 1] + G.w[p.c + p.cs - 1] - G.left);
      out.push({ pieces, ends, widths: pieces.map((p, k) => ends[k] - (k ? ends[k - 1] + (+c.gap || 0) : 0)) });
    }
    return out;
  }
  /* Build the grid from rows: each row is { ends } (px, as rowsOf gives) or { n, w } (how many, relative widths; even when left out),
     plus items: what goes in each piece ({ type, title, zone }, or null for an empty cell).
     Columns are cut wherever any row has a gap, so every row keeps its own widths; a visual over the same columns in rows
     next to each other (the same object) stays one visual that spans them. Row heights are left as they are. */
  function byRows(c, rows){
    const G = layout(c).grid, room = G.right - G.left, gap = +c.gap || 0;
    const endsOf = r => {
      if (r.ends) return r.ends.slice(0, -1).concat([room]);
      const n = Math.max(1, Math.min(12, r.n | 0 || 1)), ws = split(room, n, gap, 'fit', weightsOf(r.w, n)); let x = 0;
      return ws.map((v, k) => { x += v; const e = k === n - 1 ? room : x; x += gap; return e; });
    };
    const E0 = rows.map(endsOf);
    // every row's cuts on one line; cuts closer than the gap (plus a little) share one, so no column is a sliver
    const E = [];
    E0.flat().filter(e => e < room).sort((a, b) => a - b).forEach(e => { if (!E.length ? e > gap + 12 : e - E[E.length - 1] > gap + 12) E.push(e); });
    E.push(room);
    const at = e => E.reduce((best, v, j) => Math.abs(v - e) < Math.abs(E[best] - e) ? j : best, 0);
    const colw = E.map((e, j) => e - (j ? E[j - 1] + gap : 0));
    const items = [], last = new Map();
    E0.forEach((ends, r) => {
      let c0 = 0;
      ends.forEach((e, k) => {
        const c1 = Math.max(c0, at(e)), src = (rows[r].items || [])[k];
        if (c1 < c0 || (k && at(ends[k - 1]) === c1)) return;   // squeezed out by a neighbouring cut
        if (src) {
          const prev = last.get(src);
          if (prev && prev.r + prev.rs === r && prev.c === c0 && prev.c + prev.cs - 1 === c1) prev.rs++;
          // a visual that spanned rows now cut differently stays in its first row; the rest of it becomes a new visual
          else { const it = Object.assign({}, prev ? { type: 'clusteredColumnChart', title: 'New visual' } : src, { c: c0, r, cs: c1 - c0 + 1, rs: 1 }); items.push(it); if (!prev) last.set(src, it); }
        }
        c0 = c1 + 1;
      });
    });
    const g = c.grid;
    g.cols = E.length; g.rows = rows.length; g.colW = isEven(colw) ? null : colw; g.colPx = null;
    c.items = items;
    return c;
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
    }), (L.empty || []).map(([a, b]) => {
      // grid cells with no visual yet: their background box, so a visual can be placed on it later
      const G = L.grid, o = { x: G.x[a], y: G.y[b], w: G.w[a], h: G.h[b] }, p = cards ? inset(o, st.radius) : null;
      return ['Empty box (column ' + (a + 1) + ', row ' + (b + 1) + ')', cards ? 'Background box' : 'Grid cell', r2(o.x), r2(o.y), r2(o.w), r2(o.h)]
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
  const labelSpan = (c, r, rows) => { const it = ((c.labels || {}).items || [])[r]; return Math.max(1, Math.min(rows - r, it && +it.span || 1)); };
  // the row whose label covers row r
  const labelAt = (c, r) => { const rows = Math.max(1, +c.grid.rows || 1); for (let k = 0; k < rows; k += labelSpan(c, k, rows)) if (r < k + labelSpan(c, k, rows)) return k; return r; };
  const labelOf = (c, r) => { const it = ((c.labels || {}).items || [])[r]; return it && it.title != null ? it.title : 'Section ' + (r + 1); };
  function upgrade(c){
    c.labels = Object.assign({ on: false, w: 140, items: [] }, c.labels || {});
    const h = c.header = Object.assign({ slicerW: 180, slicerH: 32, cardW: 150, cardH: 40, items: [], logo: { on: false, w: 120, h: 32, src: '', inBg: false } }, c.header || {});
    if (h.itemW && !c.header._m) { h.slicerW = h.itemW; h.slicerH = h.itemH || 32; }
    delete h.itemW; delete h.itemH;
    h.items = (h.items || []).map(x => ({ type: x.type === 'card' || x.type === 'cardVisual' || x.type === 'kpi' ? 'card' : 'slicer', title: x.title }));
    setHeaderCounts(h, h.items.filter(x => x.type === 'card').length, h.items.filter(x => x.type === 'slicer').length);
    return c;
  }

  return { TYPES, TYPE, typeOf, PAGE_SIZES, TEMPLATES, base, fromTemplate, split, sized, weightsOf, fixedOf, isEven, tidy, layout, rowsOf, byRows, positionsTsv, inset, setHeaderCounts, upgrade, setMeasure, labelOf, labelSpan, labelAt };
})();
