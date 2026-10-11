
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

  /* Suggested colors stay out of the greens, reds and ambers (OKLCH hue), which readers take as good, bad and warning.
     Suggestions start past teal (hue 215), which reads as green next to blues. */
  const SAFE_FROM = 215, SAFE_TO = 335;
  function family(h){
    const [L, C, H] = toLch(h);
    if (C < 0.04) return '';
    if (H >= 115 && H < 200) return 'green';
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
    const n = H < 235 ? (L < 0.55 ? 'steel blue' : 'sky blue') : H < 268 ? 'blue' : H < 288 ? 'indigo' : H < 312 ? 'purple' : 'plum';
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
    const t = walk(JSON.parse(JSON.stringify(TB_TEMPLATE)));
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
    if (bub > 0) { const cc = vs.lineClusteredColumnComboChart = vs.lineClusteredColumnComboChart || {}; cc['*'] = cc['*'] || {}; const ls = cc['*'].lineStyles; cc['*'].lineStyles = [Object.assign({}, Array.isArray(ls) && ls[0] || {}, { markerSize: bub })]; }
    const pg = vs.page = vs.page || {}; pg['*'] = pg['*'] || {};
    pg['*'].background = [{ color: { solid: { color: r.page } }, transparency: 0 }];
    pg['*'].outspace = [{ color: { solid: { color: r.page } }, transparency: 0 }];
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
  return { family, colorName, alternatives, norm, hexOk, palette, roles, build, checks, contrast, readable, mix, isDark, deltaE, deutan };
})();
/*TB-CORE-END*/
