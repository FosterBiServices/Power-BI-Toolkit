
/*TB-CORE-START*/
/* ---------- Theme Builder: a full Power BI theme from a few colors ---------- */
const TB = (function(){
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const hexOk = h => /^#?[0-9a-f]{6}$/i.test(String(h || '').trim());
  const norm = h => { h = String(h || '').trim(); if (/^#?[0-9a-f]{3}$/i.test(h)) h = h.replace('#', '').split('').map(c => c + c).join(''); h = h.replace('#', ''); return /^[0-9a-f]{6}$/i.test(h) ? '#' + h.toUpperCase() : null; };
  const toRgb = h => { h = norm(h).slice(1); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255); };
  const toHex = rgb => '#' + rgb.map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
  const lin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const delin = c => c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  /* OKLab / OKLCH */
  function toOklab(h){
    const [r, g, b] = toRgb(h).map(lin);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  }
  function labToRgbLin([L, a, b]){
    const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  }
  const toLch = h => { const [L, a, b] = toOklab(h); return [L, Math.hypot(a, b), (Math.atan2(b, a) * 180 / Math.PI + 360) % 360]; };
  function fromLch(L, C, H){ // reduce chroma until it fits in sRGB
    for (let c = C; c >= 0; c -= 0.005) {
      const rgb = labToRgbLin([L, c * Math.cos(H * Math.PI / 180), c * Math.sin(H * Math.PI / 180)]);
      if (rgb.every(v => v >= -0.0005 && v <= 1.0005)) return toHex(rgb.map(v => delin(clamp(v, 0, 1))));
    }
    return toHex(labToRgbLin([L, 0, 0]).map(v => delin(clamp(v, 0, 1))));
  }
  const deltaE = (a, b) => { const x = toOklab(a), y = toOklab(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) * 100; };
  const lum = h => { const [r, g, b] = toRgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const mix = (a, b, t) => { const x = toRgb(a).map(lin), y = toRgb(b).map(lin); return toHex(x.map((v, i) => delin(v * (1 - t) + y[i] * t))); };
  const isDark = h => lum(h) < 0.18;
  // Move a color's lightness until it reaches the contrast ratio against the background
  function readable(fg, bg, ratio){
    if (contrast(fg, bg) >= ratio) return norm(fg);
    const [L, C, H] = toLch(fg), dark = !isDark(bg);
    for (let i = 1; i <= 60; i++) { const c = fromLch(clamp(L + (dark ? -1 : 1) * i * 0.01, 0, 1), C, H); if (contrast(c, bg) >= ratio) return c; }
    return dark ? '#000000' : '#FFFFFF';
  }
  // Colorblind check: Viénot/Brettel deuteranopia simulation (linear RGB)
  function deutan(h){
    const [r, g, b] = toRgb(h).map(lin);
    return toHex([0.29275 * r + 0.70725 * g, 0.29275 * r + 0.70725 * g, -0.02234 * r + 0.02234 * g + b].map(v => delin(clamp(v, 0, 1))));
  }

  /* Suggested colors stay out of the greens, reds and ambers (OKLCH hue), which readers take as good, bad and warning */
  const SAFE_FROM = 185, SAFE_TO = 335;
  function family(h){
    const [L, C, H] = toLch(h);
    if (C < 0.04) return '';
    if (H >= 115 && H < 170) return 'green';
    if (H < 45 || H >= 345) return 'red';
    if (H >= 45 && H < 110) return 'amber';
    return '';
  }
  /* Palette: the brand colors first, then new hues spread around the wheel at a similar lightness and strength */
  function palette(seeds, n, style){
    seeds = seeds.map(norm).filter(Boolean);
    if (!seeds.length) return [];
    if (style === 'shades') {
      const [L, C, H] = toLch(seeds[0]); const out = [];
      for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : i / (n - 1); out.push(fromLch(clamp(0.32 + t * 0.52, 0, 0.95), C * (1 - t * 0.45), (H + (seeds[1] ? (toLch(seeds[1])[2] - H) * t * 0.35 : 0) + 360) % 360)); }
      out[0] = seeds[0]; return out;
    }
    const lch = seeds.map(toLch);
    const Lt = clamp(lch.reduce((s, x) => s + x[0], 0) / lch.length, 0.52, 0.7);
    const Ct = clamp(lch.reduce((s, x) => s + x[1], 0) / lch.length, 0.09, 0.16);
    const out = seeds.slice(0, n);
    // candidates: safe hues x a few lightness levels; pick the one furthest (in OKLab) from every color so far
    const cands = [];
    for (let h = SAFE_FROM; h <= SAFE_TO; h += 4) for (const dl of [-0.12, -0.04, 0.05, 0.14]) cands.push(fromLch(clamp(Lt + dl, 0.4, 0.8), Ct, h));
    const used = new Set(out);
    while (out.length < n) {
      let best = null, bestD = -1;
      for (const c of cands) { if (used.has(c)) continue; const d = Math.min(...out.map(x => deltaE(x, c))); if (d > bestD) { bestD = d; best = c; } }
      if (!best) break;
      out.push(best); used.add(best);
    }
    return out;
  }

  /* A plain name for a color, for the alternatives list */
  function colorName(h){
    const [L, C, H] = toLch(h);
    const tone = L < 0.42 ? 'Dark ' : L > 0.74 ? 'Light ' : '';
    if (C < 0.045) return tone + (H > 200 && H < 300 && C > 0.015 ? 'slate' : 'grey');
    const f = family(h); if (f) return tone + f;
    const n = H < 210 ? 'teal' : H < 235 ? (L < 0.55 ? 'steel blue' : 'sky blue') : H < 268 ? 'blue' : H < 288 ? 'indigo' : H < 312 ? 'purple' : 'plum';
    return tone + n;
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  /* Other colors for data color i, for when the suggested one doesn't suit.
     Each one fits the brand, stays out of green, red and amber, can be seen on the background
     (3:1, the minimum for chart marks) and stands apart from every other data color, so the rest can stay. */
  function alternatives(colors, i, bg, k){
    colors = colors.map(norm); bg = norm(bg) || '#FFFFFF'; k = k || 5;
    const cur = colors[i], brand = colors[0], others = colors.filter((c, j) => j !== i && c);
    if (!cur || !brand) return [];
    const [Lc] = toLch(cur), [Lb, Cb, Hb] = toLch(brand);
    const Ct = clamp(Cb, 0.09, 0.16), dark = isDark(bg);
    const minD = c => others.length ? Math.min(...others.map(o => deltaE(o, c))) : 99;
    const out = [];
    // strict first (3:1 contrast, well apart); relaxed only to fill the list when the palette is crowded,
    // and never less apart from the others than the color it replaces
    let need = 3, gap = 10;
    const curD = minD(cur);
    const ok = c => c && !family(c) && contrast(c, bg) >= need && deltaE(c, cur) >= 8 && minD(c) >= gap && out.every(x => deltaE(x.hex, c) >= 9);
    const add = (c, why) => { if (out.length < k && ok(c)) { out.push({ hex: c, name: cap(colorName(c)), why }); return true; } return false; };
    const Ls = [0, -0.07, 0.07, -0.14, 0.14].map(d => clamp(Lc + d, 0.3, 0.88));
    // the most distinct from the other colors, preferring a lightness close to the color it replaces
    const best = (pool, why) => {
      const scored = pool.filter(ok).map(c => [c, minD(c) - Math.abs(toLch(c)[0] - Lc) * 40]);
      scored.sort((x, y) => y[1] - x[1]); return scored.length ? add(scored[0][0], why) : false;
    };
    const inSafe = h => h >= SAFE_FROM && h <= SAFE_TO;
    const pool = []; for (let h = SAFE_FROM; h <= SAFE_TO; h += 5) Ls.forEach(L => pool.push(fromLch(L, Ct, h)));
    const APART = 'Stands apart from your other data colors, so its series is easy to pick out';
    for (const [n, g] of [[3, 10], [2.2, Math.min(7, curD)]]) {
      need = n; gap = g;
      // 1. a lighter or darker shade of the brand: always goes with it
      const lighter = dark ? Lb < 0.7 : Lb < 0.5;
      if (!out.some(x => x.shade)) for (const d of [0.14, 0.2, 0.26, 0.32]) if (add(fromLch(clamp(Lb + (lighter ? d : -d), 0.3, 0.9), Cb * (lighter ? 0.85 : 1), Hb), (lighter ? 'A lighter' : 'A darker') + ' shade of your brand color, so it always goes with it')) { out[out.length - 1].shade = true; break; }
      // 2. next to the brand on the color wheel
      if (!family(brand) && !out.some(x => x.near)) { const near = [30, -30, 45, -45, 60, -60].map(d => (Hb + d + 360) % 360).filter(inSafe); if (best(near.flatMap(h => Ls.map(L => fromLch(L, Ct, h))), 'Next to your brand color on the color wheel, so the two sit well together')) out[out.length - 1].near = true; }
      // 3. hues that stand apart from everything already in the palette
      for (let m = 0; m < 2; m++) best(pool, APART);
      // 4. a quiet slate in the brand's hue: good for a total, a target or an "other" series
      if (!out.some(x => x.slate) && best(Ls.map(L => fromLch(L, 0.035, Hb)), 'A quiet grey in your brand\u2019s hue, for a less important series such as Other or a target')) out[out.length - 1].slate = true;
      while (out.length < k && best(pool, APART));
      if (out.length >= k) break;
    }
    return out.map(x => ({ hex: x.hex, name: x.name, why: x.why }));
  }

  /* Every color the theme uses, derived from a few choices */
  function roles(o){
    const page = norm(o.background) || '#FFFFFF';
    // Visuals: transparent (the page shows through) or their own solid color
    const vis = o.visualBg && o.visualBg !== 'transparent' ? norm(o.visualBg) : '';
    const bg = vis || page;           // what text and chart marks sit on
    const dark = isDark(bg);
    const neutralText = dark ? '#F3F2F1' : '#252423';
    const dataColors = (o.dataColors || []).map(norm).filter(Boolean);
    const brand = dataColors[0] || norm(o.brand) || '#1F6FB2';
    const text = o.textMode === 'neutral' ? neutralText : o.textMode === 'custom' && norm(o.textColor) ? norm(o.textColor) : readable(brand, bg, 4.5);
    const good = norm(o.good) || '#2E7D32', bad = norm(o.bad) || '#C62828', neutral = norm(o.neutral) || '#8C8C8C';
    return {
      background: bg, page, visual: vis, dark, brand, text, dataColors, good, bad, neutral,
      grey70: mix(neutralText, bg, 0.35),   // secondary text, second-level elements
      grey45: mix(neutralText, bg, 0.55),   // light labels
      grey10: mix(neutralText, bg, 0.9),    // borders, first-level elements
      goodText: readable(good, bg, 4.5), badText: readable(bad, bg, 4.5), neutralText: readable(neutral, bg, 4.5)
    };
  }

  const PAGE_OBJECTS = ['textbox', 'shape', 'image', 'actionButton'];

  /* Visual settings: one set for all visuals, then the same kind of choices for each group of visual types.
     Each setting lists its choices and where it goes in visualStyles: [visual type or '' for every type, object, property].
     '' writes to "*" and to every type whose template already sets that property, so "All visuals" really reaches them all. */
  const ONOFF = [['on', 'Show'], ['off', 'Hide']];
  const px = ns => ns.map(n => [String(n), n + ' px']), pt = ns => ns.map(n => [String(n), n + ' pt']);
  const VIS_SETTINGS = {
    title: { label: 'Title', opts: ONOFF, def: 'on', set: [['', 'title', 'show']] },
    titleSize: { label: 'Title size', opts: pt([10, 12, 14, 16, 18, 20]), def: '18', set: [['', 'title', 'fontSize']] },
    titleAlign: { label: 'Title alignment', opts: [['left', 'Left'], ['center', 'Center'], ['right', 'Right']], def: 'left', set: [['', 'title', 'alignment']] },
    border: { label: 'Border', opts: ONOFF, def: 'off', set: [['', 'border', 'show']] },
    radius: { label: 'Rounded corners', opts: [['0', 'Square']].concat(px([4, 8, 12, 16])), def: '2', set: [['', 'border', 'radius']] },
    shadow: { label: 'Shadow', opts: ONOFF, def: 'off', set: [['', 'dropShadow', 'show']] },
    padding: { label: 'Padding', opts: px([0, 4, 8, 12, 16]), def: '4', set: [['', 'padding', 'top'], ['', 'padding', 'bottom'], ['', 'padding', 'left'], ['', 'padding', 'right']] },
    legend: { label: 'Legend', opts: ONOFF, def: 'off', set: [['', 'legend', 'show']] },
    legendPos: { label: 'Legend position', opts: [['Top', 'Top left'], ['TopCenter', 'Top center'], ['Bottom', 'Bottom left'], ['BottomCenter', 'Bottom center'], ['Right', 'Right'], ['Left', 'Left']], def: 'Top', set: [['', 'legend', 'position']] },
    // only charts: cards also call their value "labels"
    labels: { label: 'Data labels', opts: ONOFF, def: 'on', set: [['', 'labels', 'show']], charts: true },
    gridlines: { label: 'Gridlines', opts: ONOFF, def: 'on', set: [['', 'valueAxis', 'gridlineShow'], ['', 'categoryAxis', 'gridlineShow']] },
    axisTitles: { label: 'Axis titles', opts: ONOFF, def: 'off', set: [['', 'categoryAxis', 'showAxisTitle'], ['', 'valueAxis', 'showAxisTitle']] },
    // cards
    valueSize: { label: 'Value size', opts: pt([18, 20, 24, 28, 32, 40]), def: '24', set: [['card', 'labels', 'fontSize'], ['cardVisual', 'value', 'fontSize']] },
    cardLabel: { label: 'Label under the value', opts: ONOFF, def: 'on', set: [['card', 'categoryLabels', 'show'], ['cardVisual', 'label', 'show']] },
    labelSize: { label: 'Label size', opts: pt([9, 10, 11, 12, 14, 16]), def: '10', set: [['card', 'categoryLabels', 'fontSize'], ['cardVisual', 'label', 'fontSize'], ['multiRowCard', 'categoryLabels', 'fontSize']] },
    accentBar: { label: 'Accent bar', opts: ONOFF, def: 'on', set: [['cardVisual', 'accentBar', 'show'], ['multiRowCard', 'card', 'barShow']] },
    // tables and matrixes
    header: { label: 'Column headers', opts: [['brand', 'Filled with the text color'], ['light', 'Light grey fill'], ['plain', 'No fill, bold text']], def: 'brand', set: [] },
    fontSize: { label: 'Text size', opts: pt([8, 9, 10, 11, 12, 14]), def: '10', set: [['tableEx', 'columnHeaders', 'fontSize'], ['tableEx', 'values', 'fontSize'], ['tableEx', 'total', 'fontSize'], ['tableEx', 'grid', 'textSize'], ['pivotTable', 'columnHeaders', 'fontSize'], ['pivotTable', 'rowHeaders', 'fontSize'], ['pivotTable', 'values', 'fontSize'], ['pivotTable', 'total', 'fontSize'], ['pivotTable', 'columnTotal', 'fontSize'], ['pivotTable', 'rowTotal', 'fontSize'], ['pivotTable', 'subTotals', 'fontSize'], ['pivotTable', 'grid', 'textSize']] },
    banded: { label: 'Banded rows', opts: ONOFF, def: 'off', set: [] },
    rowPadding: { label: 'Row padding', opts: px([2, 3, 5, 8, 10]), def: '5', set: [['tableEx', 'grid', 'rowPadding'], ['pivotTable', 'grid', 'rowPadding']] },
    gridH: { label: 'Row lines', opts: ONOFF, def: 'on', set: [['tableEx', 'grid', 'gridHorizontal'], ['pivotTable', 'grid', 'gridHorizontal']] },
    gridV: { label: 'Column lines', opts: ONOFF, def: 'off', set: [['tableEx', 'grid', 'gridVertical'], ['pivotTable', 'grid', 'gridVertical']] },
    // slicers
    slicerStyle: { label: 'Style', opts: [['Basic', 'List'], ['Dropdown', 'Dropdown']], def: 'Basic', set: [['slicer', 'data', 'mode']] },
    slicerHeader: { label: 'Header', opts: ONOFF, def: 'on', set: [['slicer', 'header', 'show']] },
    slicerText: { label: 'Text size', opts: pt([9, 10, 11, 12, 14]), def: '10', set: [['slicer', 'header', 'textSize'], ['slicer', 'items', 'textSize']] },
    // lines
    lineWidth: { label: 'Line width', opts: px([1, 2, 3, 4, 5]), def: '3', set: [['', 'lineStyles', 'strokeWidth']] },
    markers: { label: 'Markers', opts: ONOFF, def: 'off', set: [['', 'lineStyles', 'showMarker']] }
  };
  const BOX = ['title', 'titleSize', 'titleAlign', 'border', 'radius', 'shadow', 'padding'];
  const CHART = BOX.concat(['legend', 'legendPos', 'labels', 'gridlines', 'axisTitles']);
  const VIS_ALL = CHART;
  const VIS_GROUPS = [
    { id: 'cards', name: 'Cards and KPIs', types: ['card', 'cardVisual', 'multiRowCard', 'kpi'], defs: { title: 'off' }, keys: BOX.concat(['valueSize', 'cardLabel', 'labelSize', 'accentBar']) },
    { id: 'tables', name: 'Tables and matrixes', types: ['tableEx', 'pivotTable'], keys: BOX.concat(['header', 'fontSize', 'banded', 'rowPadding', 'gridH', 'gridV']) },
    { id: 'slicers', name: 'Slicers', types: ['slicer'], defs: { title: 'off' }, keys: BOX.concat(['slicerStyle', 'slicerHeader', 'slicerText']) },
    { id: 'bars', name: 'Bar and column charts', types: ['clusteredColumnChart', 'clusteredBarChart', 'columnChart', 'barChart', 'hundredPercentStackedColumnChart', 'hundredPercentStackedBarChart', 'ribbonChart', 'waterfallChart'], keys: CHART },
    { id: 'lines', name: 'Line, area and combo charts', types: ['lineChart', 'areaChart', 'stackedAreaChart', 'lineStackedColumnComboChart', 'lineClusteredColumnComboChart'], keys: CHART.concat(['lineWidth', 'markers']) },
    { id: 'parts', name: 'Pie, donut, treemap and funnel', types: ['pieChart', 'donutChart', 'treemap', 'funnel'], keys: BOX.concat(['legend', 'legendPos', 'labels']) }
  ];
  const TYPE_NAMES = { card: 'Card (classic)', cardVisual: 'Card', multiRowCard: 'Multi-row card', kpi: 'KPI', tableEx: 'Table', pivotTable: 'Matrix', slicer: 'Slicer', clusteredColumnChart: 'Clustered column', clusteredBarChart: 'Clustered bar', columnChart: 'Stacked column', barChart: 'Stacked bar', hundredPercentStackedColumnChart: '100% stacked column', hundredPercentStackedBarChart: '100% stacked bar', ribbonChart: 'Ribbon', waterfallChart: 'Waterfall', lineChart: 'Line', areaChart: 'Area', stackedAreaChart: 'Stacked area', lineStackedColumnComboChart: 'Line and stacked column', lineClusteredColumnComboChart: 'Line and clustered column', pieChart: 'Pie', donutChart: 'Donut', treemap: 'Treemap', funnel: 'Funnel' };
  // Keep only settings and choices the page knows, so a saved or junk value can't reach the theme
  function cleanVis(v){
    const ok = (keys, src) => { const out = {}; if (src && typeof src === 'object') keys.forEach(k => { const x = src[k]; if (typeof x === 'string' && VIS_SETTINGS[k].opts.some(o => o[0] === x)) out[k] = x; }); return out; };
    v = v && typeof v === 'object' ? v : {};
    const groups = {}; VIS_GROUPS.forEach(g => { const s = ok(g.keys, v.groups && v.groups[g.id]); if (Object.keys(s).length) groups[g.id] = s; });
    return { all: ok(VIS_ALL, v.all), groups };
  }
  // The value a visual group ends up with: its own choice, else the all-visuals choice, else the template's
  function visValue(vis, group, key){
    vis = cleanVis(vis); const g = vis.groups[group] || {}, gr = VIS_GROUPS.find(x => x.id === group);
    return g[key] || vis.all[key] || (gr && gr.defs && gr.defs[key]) || VIS_SETTINGS[key].def;
  }
  const solid = h => ({ solid: { color: h } });
  function applyVis(vs, vis, r){
    vis = cleanVis(vis);
    const val = (k, x) => VIS_SETTINGS[k].opts[0][0] === 'on' ? x === 'on' : /^\d+$/.test(x) ? +x : x;
    const entry = (type, obj, make) => {
      const s = vs[type] = vs[type] || {}; s['*'] = s['*'] || {};
      let a = s['*'][obj];
      if (!Array.isArray(a) || !a.length || !a[0] || typeof a[0] !== 'object') { if (!make) return null; a = s['*'][obj] = [type === 'cardVisual' ? { $id: 'default' } : {}]; }
      return a[0];
    };
    const write = (types, k, x, onlySet) => VIS_SETTINGS[k].set.forEach(([t, obj, prop]) => (t ? types.filter(y => y === t) : types).forEach(type => {
      if (type !== '*' && !schemaHas(type, obj, prop)) return;
      const e = entry(type, obj, !onlySet || type === '*'); if (!e) return;
      if (onlySet && type !== '*' && !(prop in e)) return;
      e[prop] = val(k, x);
    }));
    const special = (types, k, x) => {
      if (k === 'header') {
        const fill = x === 'brand' ? r.text : x === 'light' ? r.grey10 : r.background;
        const text = x === 'brand' ? r.background : readable(r.dataColors[0] || r.brand, x === 'light' ? r.grey10 : r.background, 4.5);
        types.forEach(t => { const e = entry(t, 'columnHeaders', true); e.backColor = solid(fill); e.fontColor = solid(text); e.bold = x === 'plain'; });
      }
      if (k === 'banded') types.forEach(t => { const e = entry(t, 'values', true); e.backColorPrimary = solid(r.background); e.backColorSecondary = solid(x === 'on' ? mix(r.grey10, r.background, 0.45) : r.background); });
    };
    const every = Object.keys(vs).filter(t => t !== 'page' && PAGE_OBJECTS.indexOf(t) < 0);
    if (every.indexOf('*') < 0) every.unshift('*');
    const charts = VIS_GROUPS.filter(g => g.keys.indexOf('labels') >= 0).reduce((a, g) => a.concat(g.types), []);
    Object.keys(vis.all).forEach(k => VIS_SETTINGS[k].charts ? write(charts, k, vis.all[k], false) : write(every, k, vis.all[k], true));
    VIS_GROUPS.forEach(g => { const s = vis.groups[g.id]; if (s) Object.keys(s).forEach(k => { write(g.types, k, s[k], false); special(g.types, k, s[k]); }); });
  }

  /* ---------- Microsoft's theme schema (TB_SCHEMA, when the page has it): every card and property of every visual ---------- */
  const SCH = () => typeof TB_SCHEMA !== 'undefined' ? TB_SCHEMA : null;
  const objCache = {};
  // { card name: { title, props: { property: [kind, title, ...] } } } for a visual type; "*" (all visuals) gets every card
  function schemaObjects(type){
    const S = SCH(); if (!S) return null;
    if (objCache[type]) return objCache[type];
    const out = {}, add = i => { const [name, title, pi] = S.o[i]; const o = out[name] = out[name] || { title: title, props: {} }; if (!o.title) o.title = title; Object.assign(o.props, S.p[pi]); };
    if (S.t[type]) S.t[type].forEach(add); else if (type === '*') Object.keys(S.t).forEach(t => S.t[t].forEach(add)); else return null;
    return objCache[type] = out;
  }
  const schemaTypes = () => { const S = SCH(); return S ? Object.keys(S.t) : []; };
  // true when the schema knows the property for the type (or there's no schema to ask)
  function schemaHas(type, obj, prop){
    const so = schemaObjects(type); if (!so) return true;
    return !!(so[obj] && (!prop || so[obj].props[prop]));
  }
  const isFill = v => !!(v && typeof v === 'object' && v.solid && typeof v.solid === 'object' && v.solid.color !== undefined
    && (typeof v.solid.color === 'string' ? !!norm(v.solid.color) : !!(v.solid.color && v.solid.color.expr && v.solid.color.expr.ThemeDataColor && Number.isInteger(v.solid.color.expr.ThemeDataColor.ColorId))));
  // a value that fits the property's kind, or undefined
  function fitValue(spec, v){
    if (!spec) return undefined;
    const k = spec[0];
    if (k === 'b') return typeof v === 'boolean' ? v : undefined;
    if (k === 'n' || k === 'i') { if (typeof v !== 'number' || !isFinite(v)) return undefined; if (k === 'i') v = Math.round(v); if (spec[2] != null && v < spec[2]) v = spec[2]; if (spec[3] != null && v > spec[3]) v = spec[3]; return v; }
    if (k === 's') return typeof v === 'string' && v.length <= 500 ? v : undefined;
    if (k === 'e') return spec[2].some(o => o[0] === v) ? v : undefined;
    if (k === 'c') { if (isFill(v)) return typeof v.solid.color === 'string' ? { solid: { color: norm(v.solid.color) } } : { solid: { color: { expr: { ThemeDataColor: { ColorId: v.solid.color.expr.ThemeDataColor.ColorId, Percent: +v.solid.color.expr.ThemeDataColor.Percent || 0 } } } } }; return undefined; }
    return undefined;
  }
  /* Property changes: { visual type: { card: { property: value } } }, written last so they win over everything else */
  function cleanCustom(c){
    const out = {}; if (!c || typeof c !== 'object' || Array.isArray(c)) return out;
    Object.keys(c).forEach(t => { const so = schemaObjects(t), ct = c[t]; if (!so || !ct || typeof ct !== 'object') return;
      Object.keys(ct).forEach(k => { const [o, st] = splitCard(k), props = so[o] && so[o].props, co = ct[k]; if (!props || !co || typeof co !== 'object') return;
        if (st && (!stateOk(t, o) || !STATE_RX.test(st) || st === 'default')) return;
        Object.keys(co).forEach(p => { if (p === '$id') return; const v = fitValue(props[p], co[p]); if (v !== undefined) { out[t] = out[t] || {}; out[t][k] = out[t][k] || {}; out[t][k][p] = v; } }); }); });
    return out;
  }
  function applyCustom(vs, custom){
    Object.keys(custom).forEach(t => Object.keys(custom[t]).forEach(k => {
      const [o, st] = splitCard(k);
      const s = vs[t] = vs[t] || {}; s['*'] = s['*'] || {};
      let a = s['*'][o];
      if (!Array.isArray(a) || !a.length || !a[0] || typeof a[0] !== 'object') a = s['*'][o] = [];
      let e = st ? a.find(x => x && x.$id === st) : a.find(x => x && (x.$id === undefined || x.$id === 'default'));
      if (!e) { e = st || t === 'cardVisual' ? { $id: st || 'default' } : {}; if (st) a.push(e); else a.unshift(e); }
      // once a card has a state entry, its plain entry is marked default too, as Power BI's own themes do
      if (st) a.forEach(x => { if (x && typeof x === 'object' && x.$id === undefined) x.$id = 'default'; });
      Object.assign(e, JSON.parse(JSON.stringify(custom[t][k])));
    }));
  }
  const countCustom = c => Object.keys(c || {}).reduce((n, t) => n + Object.keys(c[t]).reduce((m, o) => m + Object.keys(c[t][o]).length, 0), 0);

  /* ---------- Settings from a visual in a report: PBIR visual.json, or the older report.json ---------- */
  // A report stores each value as an expression: Literal 'text', 12D, 3L, true. Colors are a solid fill of one.
  function literal(v){
    if (!v || typeof v !== 'object') return undefined;
    const lit = v.expr && v.expr.Literal; if (!lit || typeof lit.Value !== 'string') return undefined;
    const x = lit.Value;
    if (x === 'true' || x === 'false') return x === 'true';
    if (/^-?\d+(\.\d+)?[DLM]?$/.test(x)) return parseFloat(x);
    const m = /^'([\s\S]*)'$/.exec(x); if (m) return m[1].replace(/''/g, "'");
    return undefined;
  }
  function reportValue(spec, v){
    if (!spec) return undefined;
    if (spec[0] === 'c') {
      const c = v && v.solid && v.solid.color; if (!c) return undefined;
      if (c.expr && c.expr.ThemeDataColor) return fitValue(spec, { solid: { color: c } });
      const h = typeof c === 'string' ? c : literal(c); return typeof h === 'string' && norm(h) ? { solid: { color: norm(h) } } : undefined;
    }
    let x = literal(v);
    // Desktop saves some sizes as text ('10'), not as a number (10D)
    if ((spec[0] === 'n' || spec[0] === 'i') && typeof x === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(x)) x = parseFloat(x);
    return fitValue(spec, x);
  }
  /* A card can hold styles for a state (hover, selected, pressed...) as its own entry in the theme, marked $id.
     Settings keep them as "card@state", e.g. "value@interaction:hover". */
  const STATE_RX = /^[A-Za-z][A-Za-z:\-]{0,59}$/;
  // the schema marks the cards that take $id; Power BI's own base theme also gives states to the other cards of
  // those visuals (an advanced slicer's fill on hover), so any card of a visual with states can have them
  function stateOk(type, o){
    const so = schemaObjects(type); if (!so || !so[o]) return false;
    return !!so[o].props.$id || Object.keys(so).some(k => so[k].props.$id && k !== 'title' && k !== 'subTitle');
  }
  const splitCard = k => { const i = k.indexOf('@'); return i < 0 ? [k, ''] : [k.slice(0, i), k.slice(i + 1)]; };
  const STATE_WORDS = { 'interaction:hover': 'hover', 'interaction:press': 'pressed', 'interaction:rest': 'not hovered', 'selection:selected': 'selected', 'selection:selected-interaction:rest': 'selected, not hovered', 'selection:selected-interaction:hover': 'selected, hovered', 'selection:unselected': 'not selected' };
  const stateName = s => !s || s === 'default' ? '' : STATE_WORDS[s] || s.replace(/^(interaction|selection):/, '').replace(/-/g, ', ').replace(/:/g, ' ');
  // the field or measure a value is linked to, from a report expression
  function linkedTo(v){
    let found = '';
    const walk = (x, d) => { if (found || !x || typeof x !== 'object' || d > 12) return;
      ['Measure', 'Column', 'Aggregation', 'HierarchyLevel'].some(k => { const m = x[k]; if (m && typeof m.Property === 'string') { found = m.Property; return true; } return false; });
      if (!found) Object.keys(x).forEach(k => walk(x[k], d + 1)); };
    walk(v, 0); return found;
  }
  // Each visual's formatting as theme settings, with what couldn't be carried over: one line per reason
  const SKIP_PROPS = { title: ['text'], subTitle: ['text'], header: ['text'], visualLink: ['bookmark', 'webUrl', 'navigationSection', 'drillthroughSection'] };
  const WHY = [
    ['field', 'Set for one series, field or value (a theme sets every one alike)'],
    ['linked', 'Linked to a field, measure or rule'],
    ['filter', 'The slicer\u2019s current selection (not formatting)'],
    ['state', 'Styles for a state this card can\u2019t hold in a theme'],
    ['schema', 'Not a theme setting for this kind of visual'],
    ['value', 'A value a theme can\u2019t hold']];
  function visualSettings(type, groups){
    const so = schemaObjects(type), settings = {}, why = {};
    const nameOf = (o, p) => { const c = so && so[o]; return ((c && c.title) || o) + (p ? ' \u203a ' + ((c && c.props[p] && c.props[p][1]) || p) : ''); };
    const skip = (k, text) => { (why[k] = why[k] || []).push(text); };
    Object.keys(groups).forEach(o => { const arr = groups[o]; if (!Array.isArray(arr)) return;
      arr.forEach(entry => {
        if (!entry || typeof entry !== 'object' || !entry.properties || typeof entry.properties !== 'object') return;
        const sel = entry.selector && typeof entry.selector === 'object' ? entry.selector : null;
        // a selector with only an id (and hierarchyMatching) is a state; data or metadata picks one series or field
        const perField = sel && Object.keys(sel).some(k => k !== 'id' && k !== 'hierarchyMatching');
        // an emptied value (a field link cleared in the Format pane leaves '') holds nothing to copy or report
        const props = Object.keys(entry.properties).filter(p => (SKIP_PROPS[o] || []).indexOf(p) < 0 && literal(entry.properties[p]) !== '');
        if (!props.length) return;
        if (perField) {
          const m = typeof sel.metadata === 'string' ? sel.metadata.replace(/^[^.]*\./, '') : '';
          const fields = props.map(p => linkedTo(entry.properties[p])).filter(Boolean);
          skip(fields.length === props.length ? 'linked' : 'field', nameOf(o) + (m ? ' for ' + m : '') + (fields.length ? ' (' + [...new Set(fields)].join(', ') + ')' : ''));
          return;
        }
        const state = sel && typeof sel.id === 'string' && sel.id !== 'default' ? sel.id : '';
        const st = state ? ' (' + stateName(state) + ')' : '';
        if (state && so && so[o] && (!stateOk(type, o) || !STATE_RX.test(state))) { skip('state', nameOf(o) + st); return; }
        const key = state ? o + '@' + state : o;
        props.forEach(p => {
          if (type !== 'page' && o === 'general' && p === 'filter') { skip('filter', ''); return; }
          const spec = so && so[o] && so[o].props[p];
          if (!spec || p === '$id') { skip('schema', nameOf(o, p) + st); return; }
          const v = reportValue(spec, entry.properties[p]);
          if (v === undefined) { const f = linkedTo(entry.properties[p]); skip(f ? 'linked' : 'value', nameOf(o, p) + st + (f ? ' (' + f + ')' : '')); return; }
          settings[key] = settings[key] || {}; settings[key][p] = v;
        });
      }); });
    return { settings, why };
  }
  // the reasons as lines: "Reason: a, b, c"
  function whyLines(why){
    return WHY.filter(([k]) => why[k]).map(([k, label]) => { const items = [...new Set(why[k].filter(Boolean))]; return label + (items.length ? ': ' + items.join(', ') : ''); });
  }
  const titleOfVisual = vc => { const t = vc && vc.title && vc.title[0] && vc.title[0].properties && literal(vc.title[0].properties.text); return typeof t === 'string' ? t : ''; };
  // files: [{ path, text }] from a PBIP folder, visual.json files or a pasted report.json. Returns the visuals found.
  function readVisuals(files){
    const out = [], pages = {};
    const parse = t => { try { return JSON.parse(String(t).replace(/^\uFEFF/, '')); } catch (e) { return null; } };
    files.forEach(f => { if (/(^|[\/\\])page\.json$/i.test(f.path)) { const j = parse(f.text); if (j && j.displayName) pages[f.path.replace(/[\/\\]page\.json$/i, '')] = String(j.displayName); } });
    // pages.json's pageOrder lists the page folders in the report's tab order
    const order = {};
    files.forEach(f => { if (/(^|[\/\\])pages\.json$/i.test(f.path)) { const j = parse(f.text); if (j && Array.isArray(j.pageOrder)) j.pageOrder.forEach((n, i) => { if (typeof n === 'string') order[n] = i; }); } });
    const num = x => typeof x === 'number' && isFinite(x) ? x : 0;
    let rank = 0, pos = {};
    const add = (type, objects, vco, page, name) => {
      if (typeof type !== 'string' || !type) return;
      const known = !!schemaObjects(type);
      const a = visualSettings(type, objects || {}), b = visualSettings(type, vco || {});
      const settings = a.settings; Object.keys(b.settings).forEach(o => settings[o] = Object.assign(settings[o] || {}, b.settings[o]));
      const why = {}; [a.why, b.why].forEach(w => Object.keys(w).forEach(k => why[k] = (why[k] || []).concat(w[k])));
      const skipped = known ? whyLines(why) : ['A custom visual: Microsoft\u2019s theme schema doesn\u2019t cover it, so its settings can\u2019t be checked or copied'];
      out.push({ type, page: page || '', name: name || titleOfVisual(vco) || titleOfVisual(objects) || '', known, settings: known ? settings : {}, skipped, count: known ? countCustom({ x: settings }) : 0, rank, y: num(pos.y), x: num(pos.x), n: out.length });
    };
    files.forEach(f => {
      const j = parse(f.text); if (!j || typeof j !== 'object') return;
      if (j.visual && typeof j.visual === 'object') {   // PBIR: definition/pages/<page>/visuals/<visual>/visual.json
        const dir = f.path.replace(/[\/\\]visuals[\/\\][^\/\\]+[\/\\]visual\.json$/i, ''), id = dir.split(/[\/\\]/).pop();
        rank = order[id] !== undefined ? order[id] : 1e6; pos = j.position || {};
        add(j.visual.visualType, j.visual.objects, j.visual.visualContainerObjects, pages[dir] || '', '');
      } else if (Array.isArray(j.sections)) {          // older report.json: each visual's config is a JSON string
        j.sections.forEach((sec, si) => (sec.visualContainers || []).forEach(vc => {
          const c = typeof vc.config === 'string' ? parse(vc.config) : vc.config, sv = c && c.singleVisual;
          rank = typeof sec.ordinal === 'number' ? sec.ordinal : si; pos = vc;
          if (sv) add(sv.visualType, sv.objects, sv.vcObjects, sec.displayName || '', '');
        }));
      } else if (j.visualType || j.singleVisual) {     // a visual's config pasted on its own
        const sv = j.singleVisual || j; rank = 1e6; pos = {}; add(sv.visualType, sv.objects, sv.vcObjects || sv.visualContainerObjects, '', '');
      }
    });
    // in the report's page order, then top to bottom and left to right on each page
    out.sort((a, b) => a.rank - b.rank || (a.page < b.page ? -1 : a.page > b.page ? 1 : 0) || a.y - b.y || a.x - b.x || a.n - b.n);
    return out.map(({ rank, y, x, n, ...v }) => v);
  }

  /* The themes in a PBIP report folder: its custom theme (StaticResources/RegisteredResources) and the Power BI
     base theme (StaticResources/SharedResources/BaseThemes). report.json's themeCollection says which ones it uses. */
  function findThemes(files){
    const parse = t => { try { return JSON.parse(String(t).replace(/^\uFEFF/, '')); } catch (e) { return null; } };
    const base = p => p.split(/[\/\\]/).pop();
    let used = null;
    files.forEach(f => { if (!/(^|[\/\\])report\.json$/i.test(f.path)) return; const j = parse(f.text); if (!j) return;
      let tc = j.themeCollection; if (!tc && typeof j.config === 'string') { const c = parse(j.config); tc = c && c.themeCollection; }
      if (tc && typeof tc === 'object') used = { custom: tc.customTheme && tc.customTheme.name, base: tc.baseTheme && tc.baseTheme.name }; });
    const out = [];
    files.forEach(f => {
      const kind = /[\/\\]RegisteredResources[\/\\][^\/\\]+\.json$/i.test(f.path) ? 'custom' : /[\/\\]BaseThemes[\/\\][^\/\\]+\.json$/i.test(f.path) ? 'base' : '';
      if (!kind) return;
      const r = readTheme(f.text); if (r.error) return;
      const file = base(f.path), stem = file.replace(/\.json$/i, '');
      const inUse = !used || (kind === 'custom' ? used.custom === file || used.custom === stem : used.base === stem || used.base === file);
      out.push({ kind, file, name: r.name || stem, used: inUse, text: f.text });
    });
    // the custom theme in use first, then the base theme in use; themes the report no longer uses are left out
    return out.filter(t => t.used).sort((a, b) => (a.kind === 'custom' ? 0 : 1) - (b.kind === 'custom' ? 0 : 1));
  }

  /* ---------- Start from a theme file ---------- */
  function readTheme(text){
    let t; try { t = JSON.parse(String(text).replace(/^\uFEFF/, '')); } catch (e) { return { error: 'This isn\u2019t valid JSON.' }; }
    if (!t || typeof t !== 'object' || Array.isArray(t)) return { error: 'This isn\u2019t a theme file.' };
    const dc = Array.isArray(t.dataColors) ? t.dataColors.map(norm).filter(Boolean) : [];
    if (!dc.length && !(t.visualStyles && typeof t.visualStyles === 'object')) return { error: 'No dataColors or visualStyles found, so this doesn\u2019t look like a Power BI theme.' };
    const pageBg = (() => { try { const c = t.visualStyles.page['*'].background[0].color.solid.color; return typeof c === 'string' ? norm(c) : null; } catch (e) { return null; } })();
    const bg = norm(t.background);
    const tc = t.textClasses && typeof t.textClasses === 'object' ? (t.textClasses.label || t.textClasses.callout || t.textClasses.title) : null;
    const patch = { name: typeof t.name === 'string' ? t.name.slice(0, 120) : '' };
    if (dc.length) { patch.seeds = [dc[0]]; patch.count = Math.min(Math.max(dc.length, 1), 40); patch.colors = dc.slice(0, 40); }
    if (pageBg) { patch.background = pageBg; patch.visualBg = bg && bg !== pageBg ? bg : 'transparent'; } else if (bg) { patch.background = bg; patch.visualBg = 'transparent'; }
    if (norm(t.foreground)) { patch.textMode = 'custom'; patch.textColor = norm(t.foreground); }
    ['good', 'neutral', 'bad'].forEach(k => { if (norm(t[k])) patch[k] = norm(t[k]); });
    if (tc && typeof tc.fontFace === 'string' && tc.fontFace.trim()) patch.font = tc.fontFace.split(',')[0].replace(/['"]/g, '').trim().slice(0, 60);
    const base = {}; ['visualStyles', 'textClasses', 'icons'].forEach(k => { if (t[k] && typeof t[k] === 'object') base[k] = t[k]; });
    return { patch, base, name: patch.name };
  }

  function build(o){
    const r = roles(o);
    const map = { 1: r.text, 9: r.bad, 10: r.good, 11: r.neutral, 15: r.grey45, 16: r.grey10, 17: r.grey70 };
    const hex = n => (map[n] || r.dataColors[n - 1] || r.text).replace('#', '');
    const font = (o.font || 'Segoe UI').trim() || 'Segoe UI';
    const kpi = { '#006100': r.goodText, '#9C6500': r.neutralText, '#9C0006': r.badText };
    const walk = v => {
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === 'object') { const out = {}; for (const k of Object.keys(v)) out[k] = walk(v[k]); return out; }
      if (typeof v === 'string') {
        if (v === 'Segoe UI') return font;
        if (kpi[v]) return kpi[v];
        return v.replace(/\{themecolor(\d+)\}/g, (_, n) => hex(+n));
      }
      return v;
    };
    // a theme file the user started from replaces the built-in visual styles, text classes and icons
    const b = o.base && typeof o.base === 'object' ? o.base : null;
    const t = walk(JSON.parse(JSON.stringify(b ? Object.assign({}, TB_TEMPLATE, { visualStyles: b.visualStyles || {}, textClasses: b.textClasses || TB_TEMPLATE.textClasses, icons: b.icons || TB_TEMPLATE.icons }) : TB_TEMPLATE)));
    if (!t.visualStyles || typeof t.visualStyles !== 'object' || Array.isArray(t.visualStyles)) t.visualStyles = {};
    // Power BI's visual type is "treemap"; styles under "treeMap" are ignored
    if (t.visualStyles && t.visualStyles.treeMap) { t.visualStyles.treemap = Object.assign({}, t.visualStyles.treeMap, t.visualStyles.treemap || {}); delete t.visualStyles.treeMap; }
    t.name = (o.name || 'My theme').trim() || 'My theme';
    t.dataColors = r.dataColors;
    t.background = r.background;
    t.foreground = r.text;
    t.tableAccent = r.brand;
    t.hyperlink = readable(r.brand, r.background, 4.5);
    t.good = r.good; t.neutral = r.neutral; t.bad = r.bad;
    t.maximum = r.brand; t.center = mix(r.brand, r.background, 0.5); t.minimum = mix(r.brand, r.background, 0.88);
    t.null = r.grey45;
    t.foregroundNeutralSecondary = r.grey70; t.foregroundNeutralTertiary = r.grey45;
    t.backgroundLight = mix(r.grey10, r.background, 0.5); t.backgroundNeutral = r.grey10;
    // The theme's background color is the visuals' color; the page gets its own
    const vs = t.visualStyles = t.visualStyles || {};
    if (r.visual) Object.keys(vs).forEach(v => { if (v === 'page') return; const b = vs[v] && vs[v]['*'] && vs[v]['*'].background; if (Array.isArray(b)) b.forEach(x => { x.show = true; x.transparency = 0; }); });
    // Text boxes, shapes, images and buttons sit on the page, so they stay see-through
    if (r.visual) PAGE_OBJECTS.forEach(v => { const s = vs[v] = vs[v] || {}; s['*'] = s['*'] || {}; s['*'].background = [{ show: false, transparency: 100 }]; });
    // Combo chart marker size: big enough for a marker to read as a labeled bubble over each column
    const bub = Math.round(+o.bubble || 0);
    applyVis(vs, o.vis, r);
    if (bub > 0) { const cc = vs.lineClusteredColumnComboChart = vs.lineClusteredColumnComboChart || {}; cc['*'] = cc['*'] || {}; const ls = cc['*'].lineStyles; cc['*'].lineStyles = [Object.assign({}, Array.isArray(ls) && ls[0] || {}, { markerSize: bub })]; }
    const pg = vs.page = vs.page || {}; pg['*'] = pg['*'] || {};
    pg['*'].background = [{ color: { solid: { color: r.page } }, transparency: 0 }];
    pg['*'].outspace = [{ color: { solid: { color: r.page } }, transparency: 0 }];
    applyCustom(vs, cleanCustom(o.custom));
    // keep a tidy key order: name and colors first, then the rest of the template
    const head = ['name', 'dataColors', 'background', 'foreground', 'foregroundLight', 'foregroundNeutralSecondary', 'foregroundNeutralTertiary', 'backgroundLight', 'backgroundNeutral', 'tableAccent', 'hyperlink', 'good', 'neutral', 'bad', 'maximum', 'center', 'minimum', 'null', 'firstLevelElements', 'secondLevelElements'];
    const out = {}; head.forEach(k => { if (k in t) out[k] = t[k]; }); Object.keys(t).forEach(k => { if (!(k in out)) out[k] = t[k]; });
    return { theme: out, roles: r };
  }

  function checks(o){
    const r = roles(o), out = [], add = (level, text) => out.push({ level, text });
    if (!r.dataColors.length) { add('err', 'Add at least one brand color.'); return out; }
    const first = r.dataColors[0];
    const cf = contrast(first, r.background);
    if (cf < 4.5) add('warn', 'Titles, labels and table headers use your first data color, ' + first + ', and it’s hard to read on the ' + (r.visual ? 'visual ' : '') + 'background (contrast ' + cf.toFixed(1) + ':1, 4.5:1 is the minimum for text). Put a darker brand color first, or change the background.');
    const low = r.dataColors.filter((c, i) => contrast(c, r.background) < 1.6).map(c => c);
    if (low.length) add('warn', 'These data colors almost disappear against the background: ' + low.join(', ') + '. Bars and lines in them will be hard to see.');
    const close = [];
    for (let i = 0; i < r.dataColors.length; i++) for (let j = i + 1; j < r.dataColors.length; j++) if (deltaE(r.dataColors[i], r.dataColors[j]) < 8) close.push((i + 1) + ' and ' + (j + 1));
    if (close.length) add('warn', 'Some data colors are very alike (colors ' + close.join('; ') + '), so their series will be hard to tell apart.');
    const fam = r.dataColors.map((c, i) => [i + 1, c, family(c)]).filter(x => x[2]);
    if (fam.length) add('info', 'Some data colors look ' + [...new Set(fam.map(x => x[2]))].join(', ') + ' (' + fam.map(x => 'color ' + x[0] + ', ' + x[1]).join('; ') + '). Readers often take green as good, red as bad and amber as a warning, so these can suggest a meaning the data doesn\u2019t have. Fine if they\u2019re your brand colors.');
    if (deltaE(deutan(r.good), deutan(r.bad)) < 12) add('warn', 'Your good and bad colors look almost the same to people with red-green color blindness (about 1 in 12 men). Blue for good and orange for bad is a common safe pair.');
    if (contrast(r.text, r.background) < 4.5) add('warn', 'The text color is hard to read on the ' + (r.visual ? 'visual ' : '') + 'background (' + contrast(r.text, r.background).toFixed(1) + ':1).');
    if (r.visual && contrast(r.text, r.page) < 3) add('warn', 'Text boxes, shapes and buttons stay see-through, so their text sits on the page background, and the text color is hard to read there (' + contrast(r.text, r.page).toFixed(1) + ':1). Use a visual background closer to the page, or change the page.');
    if (r.visual && deltaE(r.visual, r.page) < 2) add('info', 'The visual background is almost the same color as the page, so visuals won\u2019t stand out from it. Pick Transparent, or a color a step lighter or darker than the page.');
    return out;
  }
  return { splitCard, stateName, schemaObjects, schemaTypes, schemaHas, fitValue, cleanCustom, countCustom, readVisuals, readTheme, findThemes, VIS_SETTINGS, VIS_ALL, VIS_GROUPS, TYPE_NAMES, cleanVis, visValue, family, colorName, alternatives, norm, hexOk, palette, roles, build, checks, contrast, readable, mix, isDark, deltaE, deutan };
})();
/*TB-CORE-END*/
