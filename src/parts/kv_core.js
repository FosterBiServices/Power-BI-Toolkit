/* ---------- KPI Visualizer: logic (previews, DAX, TMDL) ---------- */
// Excel's conditional formatting styles: Good, Neutral and Bad (fill and text)
const KV_EXCEL = { good: { fill: '#C6EFCE', text: '#006100' }, neutral: { fill: '#FFEB9C', text: '#9C5700' }, bad: { fill: '#FFC7CE', text: '#9C0006' } };
// Excel's 3-color scale (red, yellow, green) as fills, with dark text
const KV_SCALE = { good: { fill: '#63BE7B', text: '#1E4620' }, neutral: { fill: '#FFEB84', text: '#5C4A00' }, bad: { fill: '#F8696B', text: '#5A0A0B' } };
// Card colors for everything that isn't status: the starting values, which the user changes in Step 4
const KV_INK_DEF = { bg: '#FFFFFF', text: '#252423', muted: '#605E5C', line: '#8A8886', track: '#E6E6E6', accent: '#118DFF' };
const KV_INK_KEYS = [['bg', 'Background'], ['text', 'Text'], ['muted', 'Labels'], ['line', 'Trend lines'], ['track', 'Tracks and dividers'], ['accent', 'Accent']];

function kvHex(c){ const m = String(c || '').trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i); if (!m) return ''; let h = m[1]; if (h.length === 3) h = h.split('').map(x => x + x).join(''); return '#' + h.toUpperCase(); }
function kvMix(a, b, t){
  const p = h => [1, 3, 5].map(i => parseInt(kvHex(h).slice(i, i + 2), 16));
  const x = p(a), y = p(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase();
}
function kvLum(h){ const c = [1, 3, 5].map(i => parseInt(kvHex(h).slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function kvContrast(a, b){ const x = kvLum(a), y = kvLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
// A status pair from one theme color: the color as text (darkened until readable on its fill), a light fill
function kvPair(color){
  const c = kvHex(color); if (!c) return null;
  const fill = kvMix(c, '#FFFFFF', 0.78);
  let text = c, i = 0; while (kvContrast(text, fill) < 4.5 && i < 12) { text = kvMix(text, '#000000', 0.12); i++; }
  return { fill, text };
}
// The card colors chosen (cfg.ink), each falling back to its starting value
function kvInk(cfg){ const o = (cfg && cfg.ink) || {}, P = {}; Object.keys(KV_INK_DEF).forEach(x => { P[x] = kvHex(o[x]) || KV_INK_DEF[x]; }); return P; }
// Card colors from a Power BI theme JSON (foreground, background, dataColors), or Theme Builder's saved settings
function kvThemeInk(obj){
  if (!obj || typeof obj !== 'object') return null;
  const vis = obj.visualBg && obj.visualBg !== 'transparent' ? kvHex(obj.visualBg) : '';
  const bg = vis || kvHex(obj.background) || '';
  const dark = bg && kvLum(bg) < 0.2;
  const text = kvHex(obj.foreground) || (obj.textMode === 'custom' && kvHex(obj.textColor)) || (bg ? (dark ? '#F3F2F1' : '#252423') : '');
  const accent = kvHex((obj.dataColors || [])[0]) || kvHex(obj.brand) || kvHex(obj.tableAccent);
  if (!bg && !text && !accent) return null;
  const P = kvInk({ ink: { bg, text, accent } });
  P.muted = kvHex(obj.foregroundNeutralSecondary) || kvMix(P.text, P.bg, 0.35);
  P.line = kvHex(obj.foregroundNeutralTertiary) || kvMix(P.text, P.bg, 0.5);
  P.track = kvHex(obj.backgroundNeutral) || kvMix(P.text, P.bg, 0.88);
  return P;
}
// good / neutral / bad from a Power BI theme JSON, or Theme Builder's saved settings
function kvThemeColors(obj){
  if (!obj || typeof obj !== 'object') return null;
  const g = kvPair(obj.good), n = kvPair(obj.neutral), b = kvPair(obj.bad);
  return g && b ? { good: g, neutral: n || KV_EXCEL.neutral, bad: b } : null;
}

/* ---------- numbers ---------- */
function kvNum(s){ const t = String(s == null ? '' : s).replace(/[$€£¥,\s]/g, ''); if (!t) return null; const pct = /%$/.test(t); const v = parseFloat(t.replace(/%$/, '')); return isFinite(v) ? (pct ? v / 100 : v) : null; }
function kvIsPct(fmt){ return /%/.test(fmt || ''); }
function kvFmt(v, fmt, compact){
  if (v == null || !isFinite(v)) return '';
  const f = fmt || '#,0', dec = ((f.split(';')[0].match(/\.(0+)/) || ['', ''])[1] || '').length;
  if (kvIsPct(f)) return (v * 100).toFixed(dec) + '%';
  const cur = (f.match(/[$€£¥]/) || [''])[0], neg = v < 0, a = Math.abs(v);
  let s;
  if (compact && a >= 1e3) {
    const [d, u] = a >= 1e9 ? [1e9, 'bn'] : a >= 1e6 ? [1e6, 'M'] : [1e3, 'K'];
    const x = a / d; s = x.toFixed(x >= 100 ? 0 : x >= 10 ? 1 : 2) + u;
  } else s = a.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return (neg ? '-' : '') + cur + s;
}
const kvSigned = (d, dec) => (d > 0 ? '+' : d < 0 ? '-' : '') + (Math.abs(d) * 100).toFixed(dec == null ? 1 : dec) + '%';
const kvClamp = (x, a, b) => Math.max(a, Math.min(b, x));

/* ---------- a KPI ---------- */
function kvBlankKpi(){ return { label: '', measure: '', format: '', better: 'higher', intent: '', target: '', compare: '', compareLabel: 'last year', ctx: [], pv: { value: '', target: '', compare: '', trend: '' } }; }
// What the reader should get from the KPI. Options that fit it come first.
const KV_INTENTS = [
  { id: 'goal', name: 'How it’s doing against a target' },
  { id: 'change', name: 'How it changed since an earlier period' },
  { id: 'trend', name: 'Which way it’s heading' },
  { id: 'context', name: 'Extra context next to the number, with no good or bad' },
  { id: 'number', name: 'Just the number' }
];
function kvIntent(k){ return KV_INTENTS.some(x => x.id === k.intent) ? k.intent : (k.target || '').trim() ? 'goal' : (k.compare || '').trim() ? 'change' : 'number'; }
// Context lines: a short neutral line next to the value ("18% of total", "#3 of 12", "As of 30 Sep 2026")
const KV_CTX_KINDS = [
  { id: 'measure', name: 'Another measure', ref: 'Measure', ph: 'Customer Count', fmt: '#,0', after: '' },
  { id: 'share', name: 'Share of the total', ref: 'Of all values in (column)', ph: "'Product'[Category]", after: ' of total' },
  { id: 'rank', name: 'Rank', ref: 'Among the values in (column)', ph: "'Region'[Region]", after: '' },
  { id: 'per', name: 'Per item (like per customer)', ref: 'Count the values in (column)', ph: "'Customer'[Customer Key]", fmt: '#,0.0', after: ' per item' },
  { id: 'period', name: 'An earlier period, as a number', ref: 'Measure', ph: 'Sales LY', before: 'Last year: ' },
  { id: 'asof', name: 'As-of date (latest date with data)', ref: 'Date column', ph: "'Date'[Date]", before: 'As of ' },
  { id: 'text', name: 'Fixed text', ref: '', ph: '', before: 'Excludes returns' }
];
const KV_CTX_MAX = 2;
const kvCtxKind = c => KV_CTX_KINDS.find(x => x.id === (c && c.kind)) || KV_CTX_KINDS[0];
function kvBlankCtx(kind){ const d = kvCtxKind({ kind: kind || 'measure' }); return { kind: d.id, ref: '', fmt: d.fmt || '', before: d.before || '', after: d.after || '', pv: '' }; }
const kvCtx = k => (k.ctx || []).filter(c => c && (c.kind === 'text' ? (c.before || c.after || '').trim() : (c.ref || '').trim()));
const kvColName = ref => { const m = String(ref || '').match(/^'?(.*?)'?\[(.*)\]$/); return m ? { table: m[1], column: m[2] } : null; };
const KV_ASOF = (() => { const d = new Date(); d.setDate(0); return d.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] + ' ' + d.getFullYear(); })();
// Preview text for a context line (made-up numbers unless one was typed)
function kvCtxSample(k, c){
  const n = kvNums(k), pv = kvNum(c.pv);
  const mid = { measure: () => kvFmt(pv != null ? pv : 1240, c.fmt || '#,0'), share: () => '18%', rank: () => '#3 of 12', per: () => kvFmt(pv != null ? pv : 1.8, c.fmt || '#,0.0'),
    period: () => kvFmt(n.c != null && isFinite(n.c) ? n.c : n.v * 0.93, k.format, true), asof: () => KV_ASOF, text: () => '' }[c.kind] || (() => '');
  return ((c.before || '') + mid() + (c.after || '')).trim();
}
const kvIsNumText = s => /^-?[\d,]*\.?\d+%?$/.test(String(s || '').trim());
function kvHas(k){
  const target = !!(k.target || '').trim(), compare = !!(k.compare || '').trim();
  return { target, compare, base: target || compare, pct: kvIsPct(k.format), ctx: kvCtx(k).length > 0 };
}
function kvName(k){ return (k.label || '').trim() || (k.measure || '').trim().replace(/^\[|\]$/g, '') || 'KPI'; }
// "12, 14, 15" or "12 14 15" or one per line; "1,200,000" stays one number when there are no spaces
function kvTrend(text){
  const t = String(text || '').trim(); if (!t) return [];
  const parts = /[\s;|]/.test(t) ? t.split(/[\s;|]+/).map(x => x.replace(/,$/, '')) : /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t) ? [t] : t.split(',');
  return parts.map(kvNum).filter(x => x != null);
}
// Numbers for the previews: the ones typed, or made-up ones (flagged) where nothing was typed
function kvNums(k){
  const h = kvHas(k), pct = h.pct;
  let sample = false;
  let v = kvNum(k.pv.value); if (v == null) { sample = true; v = pct ? 0.342 : /[$€£¥]/.test(k.format) ? 1240000 : 18400; }
  let t = null, c = null;
  if (h.target) { t = kvIsNumText(k.target) ? kvNum(k.target) : kvNum(k.pv.target); if (t == null) { sample = true; t = pct ? v + (k.better === 'lower' ? -0.02 : 0.015) : v / (k.better === 'lower' ? 0.97 : 0.96); } }
  if (h.compare) { c = kvIsNumText(k.compare) ? kvNum(k.compare) : kvNum(k.pv.compare); if (c == null) { sample = true; c = pct ? v - (k.better === 'lower' ? -0.01 : 0.021) : v / (k.better === 'lower' ? 0.95 : 1.062); } }
  let trend = kvTrend(k.pv.trend);
  if (trend.length < 2) {
    sample = true;
    const w = [0.84, 0.88, 0.86, 0.91, 0.9, 0.94, 0.92, 0.97, 0.95, 0.99, 0.97, 1];
    trend = w.map(x => pct ? v - (1 - x) * 0.3 * v : v * x);
  }
  return { v, t, c, trend, sample };
}
// status of x against base: 'good' | 'neutral' | 'bad' | ''
function kvStatus(x, base, better, band){
  if (x == null || base == null || base === 0) return '';
  const d = (x - base) / Math.abs(base), s = better === 'lower' ? -d : d, b = (+band || 0) / 100;
  return s >= b && s !== 0 ? 'good' : s <= -b && s !== 0 ? 'bad' : 'neutral';
}

/* ---------- SVG pictures (the same geometry the DAX measures draw) ---------- */
const kvF = x => (Math.round(x * 10) / 10).toString();
function kvSvgBullet(n, color, P){
  const max = Math.max(n.v, n.t, 0) * 1.15 || 1, vw = kvClamp(n.v / max, 0, 1) * 112, tx = 4 + kvClamp(n.t / max, 0, 1) * 112;
  return '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="24" viewBox="0 0 120 24"><rect x="4" y="6" width="112" height="12" fill="' + P.track + '"/><rect x="4" y="8" width="' + kvF(vw) + '" height="8" fill="' + color + '"/><rect x="' + kvF(tx - 1) + '" y="3" width="2" height="18" fill="' + P.text + '"/></svg>';
}
function kvSvgProgress(n, color, P){
  const p = n.t ? n.v / n.t : 0, w = kvClamp(p, 0, 1) * 88;
  return '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="24" viewBox="0 0 120 24"><rect x="2" y="8" width="88" height="8" rx="4" fill="' + P.track + '"/><rect x="2" y="8" width="' + kvF(w) + '" height="8" rx="4" fill="' + color + '"/><text x="118" y="16" text-anchor="end" font-family="Segoe UI, sans-serif" font-size="11" fill="' + P.text + '">' + Math.round(p * 100) + '%</text></svg>';
}
function kvSvgSpark(n, color, P){
  const t = n.trend.slice(-12), N = t.length, lo = Math.min(...t), hi = Math.max(...t), r = hi === lo ? 1 : hi - lo;
  const pts = t.map((y, i) => [2 + i * 116 / Math.max(N - 1, 1), 29 - (y - lo) * 26 / r]);
  const last = pts[pts.length - 1];
  return '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="32" viewBox="0 0 120 32"><polyline points="' + pts.map(p => kvF(p[0]) + ',' + kvF(p[1])).join(' ') + '" fill="none" stroke="' + P.line + '" stroke-width="1.5" stroke-linejoin="round"/><circle cx="' + kvF(last[0]) + '" cy="' + kvF(last[1]) + '" r="2.5" fill="' + color + '"/></svg>';
}
function kvSvgVarBar(d, color, P){
  const w = kvClamp(Math.abs(d) / 0.25, 0, 1) * 50, x = d >= 0 ? 60 : 60 - w;
  const tx = d >= 0 ? 57 : 63, anchor = d >= 0 ? 'end' : 'start';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="24" viewBox="0 0 120 24"><rect x="' + kvF(x) + '" y="6" width="' + kvF(w) + '" height="12" fill="' + color + '"/><rect x="59.5" y="2" width="1" height="20" fill="' + P.text + '"/><text x="' + tx + '" y="16" text-anchor="' + anchor + '" font-family="Segoe UI, sans-serif" font-size="10" fill="' + P.text + '">' + kvSigned(d, 0) + '</text></svg>';
}
function kvSvgSlope(d, color, P){
  const dy = kvClamp(d / 0.25, -1, 1) * 11, y1 = 16 + dy, y2 = 16 - dy;
  return '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="32" viewBox="0 0 120 32"><line x1="10" y1="' + kvF(y1) + '" x2="110" y2="' + kvF(y2) + '" stroke="' + color + '" stroke-width="2"/><circle cx="10" cy="' + kvF(y1) + '" r="3" fill="' + P.line + '"/><circle cx="110" cy="' + kvF(y2) + '" r="3.5" fill="' + color + '"/></svg>';
}
function kvSvgWaffle(p, color, P){
  const f = Math.round(kvClamp(p, 0, 1) * 100);
  let s = '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">';
  for (let i = 0; i < 100; i++) s += '<rect x="' + (i % 10) * 6 + '" y="' + (9 - Math.floor(i / 10)) * 6 + '" width="5" height="5" fill="' + (i < f ? color : P.track) + '"/>';
  return s + '</svg>';
}
function kvSvgGauge(n, color, P){
  const max = Math.max(n.v, n.t) * 1.25 || 1, a = p => Math.PI * (1 - kvClamp(p, 0, 1));
  const pt = (p, r) => [60 + r * Math.cos(a(p)), 56 - r * Math.sin(a(p))];
  const arc = (p, col) => { const e = pt(p, 44); return '<path d="M16,56 A44,44 0 0 1 ' + kvF(e[0]) + ',' + kvF(e[1]) + '" fill="none" stroke="' + col + '" stroke-width="14"/>'; };
  const t1 = pt(n.t / max, 34), t2 = pt(n.t / max, 54);
  return '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="62" viewBox="0 0 120 62">' + arc(1, P.track) + arc(n.v / max, color) + '<line x1="' + kvF(t1[0]) + '" y1="' + kvF(t1[1]) + '" x2="' + kvF(t2[0]) + '" y2="' + kvF(t2[1]) + '" stroke="' + P.text + '" stroke-width="2"/></svg>';
}
function kvSvgArea(n, P){
  const t = n.trend.slice(-12), N = t.length, lo = Math.min(...t) * 0.9, hi = Math.max(...t), r = hi === lo ? 1 : hi - lo;
  const pts = t.map((y, i) => kvF(i * 200 / Math.max(N - 1, 1)) + ',' + kvF(46 - (y - lo) * 40 / r));
  return '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="48" viewBox="0 0 200 48" preserveAspectRatio="none"><polygon points="0,48 ' + pts.join(' ') + ' 200,48" fill="' + kvMix(P.line, P.bg, 0.7) + '"/><polyline points="' + pts.join(' ') + '" fill="none" stroke="' + P.line + '" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>';
}

/* ---------- Card designs: a whole card drawn by one SVG measure (layouts from PowerViz KPI templates) ---------- */
// A design writes its SVG once. In the preview each hole is the preview's number or text; in the measure it's a
// DAX variable. Every color comes from Step 4 (status colors and card colors).
const KV_DFONT = "font-family='Segoe UI, Arial, sans-serif'";
// "1.2M", "$12.6K": the value with K, M or bn and one decimal, the way the measure formats it
function kvFmtC(v, fmt){
  if (v == null || !isFinite(v)) return '';
  if (kvIsPct(fmt) || Math.abs(v) < 1e3) return kvFmt(v, fmt);
  const cur = ((fmt || '').match(/[$€£¥]/) || [''])[0], a = Math.abs(v), [d, u] = a >= 1e9 ? [1e9, 'bn'] : a >= 1e6 ? [1e6, 'M'] : [1e3, 'K'];
  return (v < 0 ? '-' : '') + cur + (a / d).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + u;
}
function kvDaxFmtC(x, fmt){
  const f = fmt || '#,0';
  if (kvIsPct(f)) return ['IF ( ISBLANK ( ' + x + ' ), "", FORMAT ( ' + x + ', ' + daxString(f) + ' ) )'];
  const cur = ((f.match(/\\?[$€£¥]/) || [''])[0]), one = daxString(cur + '#,0.0');
  return ['SWITCH (', '    TRUE (),', '    ISBLANK ( ' + x + ' ), "",',
    '    ABS ( ' + x + ' ) >= 1E9, FORMAT ( ' + x + ' / 1E9, ' + one + ' ) & "bn",',
    '    ABS ( ' + x + ' ) >= 1E6, FORMAT ( ' + x + ' / 1E6, ' + one + ' ) & "M",',
    '    ABS ( ' + x + ' ) >= 1E3, FORMAT ( ' + x + ' / 1E3, ' + one + ' ) & "K",',
    '    FORMAT ( ' + x + ', ' + daxString(f) + ' )', ')'];
}
const kvXml = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;');
// The pieces a design can use, for one KPI. dax: true gives holes and collects the DAX variables they need.
function kvDesignCtx(k, cfg, dax, sfx){
  sfx = sfx || '';
  const n = kvNums(k), h = kvHas(k), P = kvInk(cfg), C = cfg.colors, band = (+cfg.band || 0) / 100, fmt = k.format;
  const tc = (cfg.trendCol || '').trim() || "'Date'[Month Start]", N = Math.max(2, Math.min(36, +cfg.periods || 12));
  const defs = new Map(), vn = x => x + sfx;
  const def = (name, lines) => { name = vn(name); if (!defs.has(name)) { const L = Array.isArray(lines) ? lines : [lines]; defs.set(name, L.length > 1 ? ['VAR ' + name + ' ='].concat(L.map(l => '    ' + l)) : ['VAR ' + name + ' = ' + L[0]]); } return name; };
  const hole = name => '\u0001' + name + '\u0002';
  const W = which => which === 't' ? 'target' : which === 'c' ? 'compare' : h.target ? 'target' : 'compare';
  const baseNum = which => W(which) === 'target' ? n.t : n.c;
  const vsName = which => W(which) === 'target' ? 'vs target' : 'vs ' + ((k.compareLabel || '').trim() || 'last period');
  const baseName = which => W(which) === 'target' ? 'Target' : ((k.compareLabel || '').trim() || 'Last period').replace(/^./, c => c.toUpperCase());
  // DAX variables
  const dValue = () => def('_Value', kvRef(k.measure));
  const dBase = which => W(which) === 'target' ? def('_Target', kvRef(k.target)) : def('_Compare', kvRef(k.compare));
  const tag = which => W(which) === 'target' ? 'T' : 'C';
  const dVar = which => { const v = dValue(), b = dBase(which); return def('_Var' + tag(which), 'IF ( NOT ISBLANK ( ' + v + ' ) && NOT ISBLANK ( ' + b + ' ) && ' + b + ' <> 0, DIVIDE ( ' + v + ' - ' + b + ', ABS ( ' + b + ' ) ) )'); };
  const dStatus = (which, part) => { const x = dVar(which), s = k.better === 'lower' ? '-' + x : x;
    return def('_' + (part === 'fill' ? 'Fill' : 'Col') + tag(which), ['SWITCH (', '    TRUE (),', '    ISBLANK ( ' + x + ' ), "' + (part === 'fill' ? P.track : P.muted) + '",', '    ' + s + ' >= ' + band + ' && ' + s + ' > 0, "' + C.good[part] + '",', '    ' + s + ' <= -' + band + ' && ' + s + ' < 0, "' + C.bad[part] + '",', '    "' + C.neutral[part] + '"', ')']); };
  const dTrend = () => {
    const v = dValue();
    def('_Data', ['TOPN (', '    ' + N + ',', '    FILTER ( ADDCOLUMNS ( VALUES ( ' + tc + ' ), "@v", ' + kvRef(k.measure) + ' ), NOT ISBLANK ( [@v] ) ),', '    ' + tc + ', DESC', ')']);
    def('_N', 'COUNTROWS ( ' + vn('_Data') + ' )'); def('_Lo', 'MINX ( ' + vn('_Data') + ', [@v] )'); def('_Hi', 'MAXX ( ' + vn('_Data') + ', [@v] )');
    def('_Range', 'IF ( ' + vn('_Hi') + ' = ' + vn('_Lo') + ', 1, ( ' + vn('_Hi') + ' - ' + vn('_Lo') + ' ) * 1.25 )');
    def('_Floor', vn('_Lo') + ' - IF ( ' + vn('_Hi') + ' = ' + vn('_Lo') + ', 0.5, ( ' + vn('_Hi') + ' - ' + vn('_Lo') + ' ) * 0.25 )');
    return def('_Pts', 'ADDCOLUMNS ( ' + vn('_Data') + ', "@x", RANKX ( ' + vn('_Data') + ', ' + tc + ', , ASC ) )');
  };
  // preview trend: the last N numbers, with the same scale as the measure
  const pts = () => { const t = n.trend.slice(-N), lo = Math.min(...t), hi = Math.max(...t), range = hi === lo ? 1 : (hi - lo) * 1.25, floor = lo - (hi === lo ? 0.5 : (hi - lo) * 0.25); return { t, N: t.length, range, floor }; };
  const yOf = (v, s, y, hh) => y + hh - (v - s.floor) * hh / s.range;
  const z = {
    n, h, P, C, k,
    name: kvXml(kvName(k)), vsName, baseName,
    has: which => W(which) === 'target' ? h.target : h.compare,
    value(){ return dax ? hole(def('_ValueText', kvDaxFmtC(dValue(), fmt))) : kvXml(kvFmtC(n.v, fmt)); },
    base(which){ return dax ? hole(def('_' + W(which).replace(/^./, c => c.toUpperCase()) + 'Text', kvDaxFmtC(dBase(which), fmt))) : kvXml(kvFmtC(baseNum(which), fmt)); },
    // "▲ +6.2%"
    vary(which){
      if (dax) { const x = dVar(which); return hole(def('_Var' + tag(which) + 'Text', 'IF ( ISBLANK ( ' + x + ' ), "", SWITCH ( TRUE (), ' + x + ' > 0, UNICHAR ( 9650 ), ' + x + ' < 0, UNICHAR ( 9660 ), UNICHAR ( 9658 ) ) & " " & FORMAT ( ' + x + ', "+0.0%;-0.0%;0.0%" ) )')); }
      const b = baseNum(which); if (b == null || !b) return ''; const d = (n.v - b) / Math.abs(b); return kvArrow(d) + ' ' + kvSigned(d);
    },
    color(which, part){
      part = part || 'text';
      if (dax) return hole(dStatus(which, part));
      const st = kvStatus(n.v, baseNum(which), k.better, cfg.band); return st ? C[st][part] : (part === 'fill' ? P.track : P.muted);
    },
    pct(){ if (dax) { const p = def('_Pct', 'DIVIDE ( ' + dValue() + ', ' + dBase('t') + ' )'); return hole(def('_PctText', 'FORMAT ( ' + p + ', "0%" )')); } return n.t ? Math.round(n.v / n.t * 100) + '%' : ''; },
    // a length that grows with % of target, up to len
    pctLen(len){ if (dax) { const p = def('_Pct', 'DIVIDE ( ' + dValue() + ', ' + dBase('t') + ' )'); return hole(def('_Len' + len, kvFx('MAX ( 0, MIN ( 1, ' + p + ' ) ) * ' + len))); } return kvF(n.t ? kvClamp(n.v / n.t, 0, 1) * len : 0); },
    // where a fill that rises with % of target starts, for a shape from y to y + len
    pctTop(y, len){ if (dax) { const p = def('_Pct', 'DIVIDE ( ' + dValue() + ', ' + dBase('t') + ' )'); return hole(def('_Top' + y, kvFx(y + len + ' - MAX ( 0, MIN ( 1, ' + p + ' ) ) * ' + len))); } return kvF(y + len - (n.t ? kvClamp(n.v / n.t, 0, 1) * len : 0)); },
    // a status badge (a pill with the % change), right-aligned at x; nothing when there's no change to show
    badge(which, x, y){
      const w = 70, el = (fill, col, t) => "<rect x='" + (x - w) + "' y='" + y + "' width='" + w + "' height='22' rx='11' fill='" + fill + "'/><text x='" + (x - w / 2) + "' y='" + (y + 15) + "' text-anchor='middle' " + KV_DFONT + " font-size='12' font-weight='600' fill='" + col + "'>" + t + '</text>';
      if (dax) { const t = this.vary(which), f = this.color(which, 'fill'), c = this.color(which), tv = t.replace(/\u0001|\u0002/g, '');
        return hole(def('_Badge' + tag(which), 'IF ( ' + tv + ' = "", "", ' + kvDaxJoin(el(f, c, t)) + ' )')); }
      const t = this.vary(which); return t ? el(this.color(which, 'fill'), this.color(which), t) : '';
    },
    // trend shapes in the box x, y, w, hh
    line(x, y, w, hh){
      if (dax) { const p = dTrend(); return hole(def('_Line', ['CONCATENATEX (', '    ' + p + ',', '    ' + kvFx(x + ' + ( [@x] - 1 ) * ' + w + ' / MAX ( ' + vn('_N') + ' - 1, 1 )') + ' & "," & ' + kvFx(y + hh + ' - ( [@v] - ' + vn('_Floor') + ' ) * ' + hh + ' / ' + vn('_Range')) + ',', '    " ",', '    [@x], ASC', ')'])); }
      const s = pts(); return s.t.map((v, i) => kvF(x + i * w / Math.max(s.N - 1, 1)) + ',' + kvF(yOf(v, s, y, hh))).join(' ');
    },
    lastY(y, hh){
      if (dax) { dTrend(); return hole(def('_LastY', kvFx(y + hh + ' - ( MAXX ( TOPN ( 1, ' + vn('_Data') + ', ' + tc + ', DESC ), [@v] ) - ' + vn('_Floor') + ' ) * ' + hh + ' / ' + vn('_Range')))); }
      const s = pts(); return kvF(yOf(s.t[s.t.length - 1], s, y, hh));
    },
    // stems and dots, one per period
    lollipops(x, y, w, hh, color){
      const el = (cx, cy) => "<line x1='" + cx + "' y1='" + (y + hh) + "' x2='" + cx + "' y2='" + cy + "' stroke='" + P.line + "' stroke-width='1.5'/><circle cx='" + cx + "' cy='" + cy + "' r='3.5' fill='" + color + "'/>";
      if (dax) { const p = dTrend(); return hole(def('_Lollipops', ['CONCATENATEX (', '    ' + p + ',', '    VAR _X = ' + kvFx(x + ' + ( [@x] - 0.5 ) * ' + w + ' / ' + vn('_N')), '    VAR _Y = ' + kvFx(y + hh + ' - ( [@v] - ' + vn('_Floor') + ' ) * ' + hh + ' / ' + vn('_Range')), '    RETURN', '        ' + kvDaxJoin(el(hole('_X'), hole('_Y'))) + ',', '    "",', '    [@x], ASC', ')'])); }
      const s = pts(); return s.t.map((v, i) => el(kvF(x + (i + 0.5) * w / s.N), kvF(yOf(v, s, y, hh)))).join('');
    },
    ctxText(i){ const c = kvCtx(k)[i]; if (!c) return ''; return dax ? hole(def('_Context' + (i + 1), bracket(kvCtxName(k, i)))) : kvXml(kvCtxSample(k, c)); },
    defs: () => [...defs.values()].flat(), valueVar: () => dValue()
  };
  return z;
}
const kvTxt = (x, y, size, color, text, extra) => "<text x='" + x + "' y='" + y + "' " + KV_DFONT + " font-size='" + size + "' fill='" + color + "'" + (extra || '') + '>' + text + '</text>';
const kvCardBg = (w, hh, P, accent) => ["<defs><clipPath id='kvc'><rect width='" + w + "' height='" + hh + "' rx='10'/></clipPath></defs>", "<rect x='0.5' y='0.5' width='" + (w - 1) + "' height='" + (hh - 1) + "' rx='10' fill='" + P.bg + "' stroke='" + P.track + "'/>"].concat(accent ? ["<rect width='6' height='" + hh + "' fill='" + P.accent + "' clip-path='url(#kvc)'/>"] : []);
// Card designs: size, what they need (score as in KV_OPTIONS), and the SVG as a list of elements
const KV_DESIGNS = {
  dbadge: { w: 260, h: 150, svg: z => {
    const P = z.P, x = 16, top = 92, hh = 58;
    return kvCardBg(260, 150, P).concat([
      kvTxt(x, 28, 13, P.muted, z.name), kvTxt(x, 62, 28, P.text, z.value(), " font-weight='600'")],
      z.h.base ? [z.badge('b', 244, 14), kvTxt(244, 52, 11, P.muted, kvXml(z.vsName('b')), " text-anchor='end'")] : [],
      ["<g clip-path='url(#kvc)'><polygon points='0," + (top + hh) + ' ' + z.line(0, top, 260, hh) + ' 260,' + (top + hh) + "' fill='" + P.accent + "' fill-opacity='0.18'/>",
        "<polyline points='" + z.line(0, top, 260, hh) + "' fill='none' stroke='" + P.accent + "' stroke-width='2' stroke-linejoin='round'/></g>"]); } },
  dcols: { w: 300, h: 140, svg: z => {
    const P = z.P, cols = ['t', 'c'].filter(w => z.has(w)), cw = 264 / cols.length;
    return kvCardBg(300, 140, P, true).concat([kvTxt(20, 28, 13, P.muted, z.name), kvTxt(20, 60, 28, P.text, z.value(), " font-weight='600'"),
      "<line x1='20' y1='76' x2='284' y2='76' stroke='" + P.track + "'/>"],
      cols.map((w, j) => { const cx = kvF(20 + j * cw); return (j ? "<line x1='" + kvF(14 + j * cw) + "' y1='86' x2='" + kvF(14 + j * cw) + "' y2='132' stroke='" + P.track + "'/>" : '')
        + kvTxt(cx, 96, 11, P.muted, kvXml(z.vsName(w))) + kvTxt(cx, 116, 15, z.color(w), z.vary(w), " font-weight='600'") + kvTxt(cx, 132, 11, P.muted, kvXml(z.baseName(w)) + ' ' + z.base(w)); })); } },
  dtarget: { w: 260, h: 150, svg: z => {
    const P = z.P;
    return kvCardBg(260, 150, P, true).concat([kvTxt(20, 28, 13, P.muted, z.name), kvTxt(20, 62, 28, P.text, z.value(), " font-weight='600'")],
      z.h.compare ? [kvTxt(20, 86, 12, z.color('c'), z.vary('c'), " font-weight='600'") + kvTxt(244, 86, 12, P.muted, kvXml(z.vsName('c')), " text-anchor='end'")] : [],
      [kvTxt(20, 114, 11, P.muted, 'Target ' + z.base('t')), kvTxt(244, 114, 12, P.text, z.pct(), " text-anchor='end' font-weight='600'"),
        "<rect x='20' y='122' width='224' height='10' rx='5' fill='" + P.track + "'/>", "<rect x='20' y='122' width='" + z.pctLen(224) + "' height='10' rx='5' fill='" + z.color('t') + "'/>"]); } },
  dlolli: { w: 260, h: 170, svg: z => {
    const P = z.P;
    return kvCardBg(260, 170, P).concat([kvTxt(16, 28, 13, P.muted, z.name), kvTxt(16, 60, 28, P.text, z.value(), " font-weight='600'"),
      kvTxt(16, 84, 12, P.muted, kvXml(z.baseName('c')) + ' ' + z.base('c')), kvTxt(244, 84, 12, z.color('c'), z.vary('c'), " text-anchor='end' font-weight='600'"),
      z.lollipops(16, 98, 228, 58, P.accent)]); } },
  dfill: { w: 260, h: 130, svg: z => {
    const P = z.P, cx = 205, cy = 65, r = 44;
    return kvCardBg(260, 130, P).concat([kvTxt(16, 28, 13, P.muted, z.name), kvTxt(16, 62, 28, P.text, z.value(), " font-weight='600'"),
      kvTxt(16, 86, 11, P.muted, 'Target ' + z.base('t')), kvTxt(16, 106, 12, z.color('t'), z.vary('t'), " font-weight='600'"),
      "<clipPath id='kvf'><circle cx='" + cx + "' cy='" + cy + "' r='" + r + "'/></clipPath>",
      "<circle cx='" + cx + "' cy='" + cy + "' r='" + r + "' fill='" + P.track + "'/>",
      "<rect x='" + (cx - r) + "' y='" + z.pctTop(cy - r, 2 * r) + "' width='" + 2 * r + "' height='" + 2 * r + "' fill='" + z.color('t', 'fill') + "' clip-path='url(#kvf)'/>",
      "<circle cx='" + cx + "' cy='" + cy + "' r='" + r + "' fill='none' stroke='" + z.color('t') + "' stroke-width='2'/>",
      kvTxt(cx, cy + 6, 18, P.text, z.pct(), " text-anchor='middle' font-weight='600'")]); } },
  ddetail: { w: 280, h: 170, svg: z => {
    const P = z.P, D = [];
    if (z.h.target) D.push([kvXml(z.baseName('t')), z.base('t')]);
    if (z.h.compare) D.push([kvXml(z.baseName('c')), z.base('c')]);
    kvCtx(z.k).slice(0, KV_CTX_MAX).forEach((c, i) => D.push([kvXml(kvCtxTipName(c, i)), z.ctxText(i)]));
    const d = D.slice(0, 3), cw = 248 / Math.max(d.length, 1);
    return kvCardBg(280, 170, P).concat([kvTxt(16, 26, 13, P.muted, z.name), kvTxt(16, 58, 28, P.text, z.value(), " font-weight='600'")],
      d.map((x, j) => kvTxt(kvF(16 + j * cw), 80, 11, P.muted, x[0]) + kvTxt(kvF(16 + j * cw), 98, 13, P.text, x[1], " font-weight='600'")),
      ["<polyline points='" + z.line(16, 112, 248, 44) + "' fill='none' stroke='" + P.accent + "' stroke-width='2' stroke-linejoin='round'/>",
        "<circle cx='264' cy='" + z.lastY(112, 44) + "' r='3.5' fill='" + P.accent + "'/>"]); } }
};
const kvDesignUsesTrend = id => ['dbadge', 'dlolli', 'ddetail'].includes(id);
function kvDesignSvg(id, k, cfg){
  const d = KV_DESIGNS[id], z = kvDesignCtx(k, cfg, false);
  return "<svg xmlns='http://www.w3.org/2000/svg' width='" + d.w + "' height='" + d.h + "' viewBox='0 0 " + d.w + ' ' + d.h + "'>" + d.svg(z).join('') + '</svg>';
}
// Text with holes as one DAX expression: "<text ...>" & _ValueText & "</text>"
const kvDaxJoin = e => e.split(/\u0001([^\u0002]*)\u0002/).map((p, i) => i % 2 ? p : p ? daxString(p) : '').filter(Boolean).join(' & ');
function kvDaxSvgLines(els, open){
  const L = ['VAR _Svg =', '    ' + daxString(open)];
  els.filter(Boolean).forEach(e => L.push('        & ' + kvDaxJoin(e)));
  L.push('        & "</svg>"');
  return L;
}
const kvSvgDataUri = cond => ['RETURN', '    IF ( ' + cond + ', "data:image/svg+xml;utf8," & SUBSTITUTE ( SUBSTITUTE ( _Svg, "%", "%25" ), "#", "%23" ) )'];
function kvDesignMeasure(id, k, cfg){
  const d = KV_DESIGNS[id], z = kvDesignCtx(k, cfg, true), els = d.svg(z), v = z.valueVar();
  const open = "<svg xmlns='http://www.w3.org/2000/svg' width='" + d.w + "' height='" + d.h + "' viewBox='0 0 " + d.w + ' ' + d.h + "'>";
  const o = KV_OPTIONS.find(x => x.id === id);
  return { name: kvMName(k, 'Card'), dataCategory: 'ImageUrl', usesTrend: kvDesignUsesTrend(id),
    description: o.name + ': the whole card as one picture, ' + d.w + ' x ' + d.h + ' pixels. Colors come from the KPI Visualizer; change them there and paste the script again.',
    expression: z.defs().concat(kvDaxSvgLines(els, open), kvSvgDataUri('NOT ISBLANK ( ' + v + ' )')).join('\n') };
}
// A row of KPIs as one list card: name, value and a status badge per KPI
const KV_LIST_ROW = 46;
function kvListEls(kpis, cfg, dax){
  const P = kvInk(cfg), hh = 16 + KV_LIST_ROW * kpis.length, E = kvCardBg(280, hh, P), zs = [];
  kpis.forEach((k, i) => {
    const z = kvDesignCtx(k, cfg, dax, String(i + 1)), y = 8 + i * KV_LIST_ROW; zs.push(z);
    if (i) E.push("<line x1='16' y1='" + y + "' x2='264' y2='" + y + "' stroke='" + P.track + "'/>");
    E.push(kvTxt(16, y + 18, 12, P.muted, z.name), kvTxt(16, y + 39, 20, P.text, z.value(), " font-weight='600'"));
    if (z.h.base) E.push(z.badge('b', 264, y + 14));
  });
  return { E, zs, w: 280, h: hh };
}
function kvListSvg(kpis, cfg){ const r = kvListEls(kpis, cfg, false); return "<svg xmlns='http://www.w3.org/2000/svg' width='" + r.w + "' height='" + r.h + "' viewBox='0 0 " + r.w + ' ' + r.h + "'>" + r.E.join('') + '</svg>'; }
function kvListMeasure(kpis, cfg){
  const r = kvListEls(kpis, cfg, true), defs = [], seen = new Set();
  r.zs.forEach(z => z.defs().forEach(l => { if (!seen.has(l)) { seen.add(l); defs.push(l); } }));
  const open = "<svg xmlns='http://www.w3.org/2000/svg' width='" + r.w + "' height='" + r.h + "' viewBox='0 0 " + r.w + ' ' + r.h + "'>";
  return { name: 'KPI List Card', dataCategory: 'ImageUrl', description: 'Your KPIs in one list card, ' + r.w + ' x ' + r.h + ' pixels: name, value and status for each.',
    expression: defs.concat(kvDaxSvgLines(r.E, open), kvSvgDataUri('TRUE ()')).join('\n') };
}

/* ---------- the options ---------- */
// need: what the KPI must have. score: how well it fits (higher first). kind: native | svg | core
const KV_OPTIONS = [
  { id: 'cardvar', for: ['goal', 'change'], name: 'Card with variance', kind: 'native', need: 'base',
    nmc: ['The value', 'An arrow and % vs target (or vs last period) in Excel-style status colors', 'The target or comparison named in the label'],
    fits: 'Almost every headline KPI. The reader gets the number and whether it’s good in one glance.',
    avoid: 'Very small tiles: the reference label needs room under or beside the value.',
    score: h => h.base ? 92 : -1 },
  { id: 'bullet', for: ['goal'], name: 'Bullet chart', kind: 'svg', need: 'target',
    nmc: ['The value (on the card, or a column next to it)', 'The bar’s color, and where it ends against the target mark', 'How far from the target it is'],
    fits: 'A value against a target, in a card or in a table row. Compact, and easy to compare down a column.',
    avoid: 'KPIs with no target, or a target that changes meaning by period without the reader knowing.',
    score: h => h.target ? 95 : -1 },
  { id: 'spark', for: ['trend', 'change'], name: 'Card with a sparkline', kind: 'svg', need: '',
    nmc: ['The value', 'The color of the last point (when there’s a target or comparison)', 'The last 12 periods of trend'],
    fits: 'When the direction matters as much as the number: is it getting better or worse?',
    avoid: 'KPIs with very few periods of history, or that are only measured once a year.',
    score: h => h.base ? 80 : 88 },
  { id: 'varbar', for: ['goal', 'change'], name: 'Variance bar', kind: 'svg', need: 'base',
    nmc: ['The % above or below', 'Bar direction and color', 'A fixed scale, so rows can be compared'],
    fits: 'Showing how far above or below target several KPIs or regions are, side by side in a table.',
    avoid: 'Using it alone: show the value too, or readers know the gap but not the size.',
    score: h => h.base ? 76 : -1 },
  { id: 'waffle', for: ['goal'], name: 'Waffle chart', kind: 'svg', need: 'pct',
    nmc: ['The % (on the card)', 'Squares filled out of 100, colored by status when there’s a target', 'Part of a whole'],
    fits: 'Percentages that are a share of something: margin %, on-time %, share of customers. Easy for any reader.',
    avoid: 'Values over 100% or below zero, and amounts that aren’t a share.',
    score: h => h.pct ? 74 : h.target ? 38 : -1 },
  { id: 'progress', for: ['goal'], name: 'Progress bar', kind: 'svg', need: 'target',
    nmc: ['The % of target reached', 'The bar’s color', 'How much is left to go'],
    fits: 'Amounts that build up toward a goal: year-to-date sales against the annual target, tickets closed this month.',
    avoid: 'KPIs where lower is better, or rates that don’t accumulate (a margin % isn’t “progress”).',
    score: h => h.target ? (h.pct ? 45 : 82) : -1 },
  { id: 'slope', for: ['change'], name: 'Slope chart', kind: 'svg', need: 'compare',
    nmc: ['The value (on the card)', 'Up or down, in status color', 'Where it was in the earlier period'],
    fits: 'A before and after story: this year against last year, this month against the same month last year.',
    avoid: 'More than two points in time; use a sparkline for that.',
    score: h => h.compare ? 66 : -1 },
  { id: 'kpi', for: ['goal', 'trend'], name: 'KPI visual', kind: 'native', need: 'target',
    nmc: ['The value', 'The visual’s good, neutral and bad colors against the goal', 'A trend chart behind the value and the goal distance'],
    fits: 'A quick native option when you have a target and a date axis, and no time for SVG.',
    avoid: 'Rows of KPIs: it’s hard to line several up neatly, and the trend can’t be turned off without losing the target.',
    score: h => h.target ? 60 : -1 },
  { id: 'core', for: ['trend'], name: 'Card and area chart (no SVG)', kind: 'core',
    need: '', nmc: ['The value on a new card', 'A reference label in status color', 'A small area chart under it'],
    fits: 'When SVG measures aren’t allowed or you want everything to stay editable in the format pane.',
    avoid: 'Busy pages: it’s two visuals per KPI to keep aligned.',
    score: h => 56 },
  { id: 'dcols', for: ['goal', 'change'], name: 'Card with comparison columns', kind: 'design', need: 'base',
    nmc: ['The value', 'The % vs target and vs your comparison, each in its status color', 'Each target or comparison value in its column'],
    fits: 'A headline KPI judged against more than one thing, like the target and last year, in one card.',
    avoid: 'Narrow spaces: each comparison needs its own column.',
    score: h => h.target && h.compare ? 86 : h.base ? 64 : -1 },
  { id: 'dtarget', for: ['goal'], name: 'Card with a target bar', kind: 'design', need: 'target',
    nmc: ['The value', 'A bar filled to the % of target, in status color', 'The target, and the change vs your comparison'],
    fits: 'Amounts that build toward a target, when you also want the change since an earlier period.',
    avoid: 'KPIs where lower is better: a fuller bar reads as better.',
    score: h => h.target ? (h.pct ? 50 : 78) : -1 },
  { id: 'dbadge', for: ['trend', 'change', 'goal'], name: 'Card with a change badge and trend', kind: 'design', need: '',
    nmc: ['The value', 'A badge with the % change in status color', 'The trend as an area across the bottom'],
    fits: 'A headline KPI where readers want the number, whether it’s up or down, and the recent trend at once.',
    avoid: 'KPIs with very little history.',
    score: h => h.base ? 72 : 62 },
  { id: 'dlolli', for: ['change', 'trend'], name: 'Card with last period and lollipops', kind: 'design', need: 'compare',
    nmc: ['The value', 'The % vs your comparison in status color', 'The comparison value, and one lollipop per period'],
    fits: 'Comparing with an earlier period while showing how each period went.',
    avoid: 'Many periods in a small card: keep it to about 12.',
    score: h => h.compare ? 68 : -1 },
  { id: 'dfill', for: ['goal'], name: 'Card with a fill gauge', kind: 'design', need: 'target',
    nmc: ['The value', 'A circle filled to the % of target, in status color', 'The target and the % vs target'],
    fits: 'A single goal KPI on a summary page, where the fill reads at a glance.',
    avoid: 'Comparing KPIs with each other: fill levels are harder to compare than bars.',
    score: h => h.target ? (h.pct ? 40 : 58) : -1 },
  { id: 'ddetail', for: ['context', 'goal', 'change', 'trend'], name: 'Card with detail numbers and a trend', kind: 'design', need: 'base',
    nmc: ['The value', 'None on its own: the details give the scale', 'Up to three smaller numbers (target, comparison, context) and a trend line'],
    fits: 'A header card that gives the main number with a few related ones underneath.',
    avoid: 'Long context lines: each detail gets a third of the card’s width.',
    score: h => h.base || h.ctx ? 66 : -1 },
  { id: 'html', for: ['goal', 'change', 'context', 'number'], name: 'HTML card', kind: 'html', need: '',
    nmc: ['The value', 'An arrow and % in a colored status pill', 'The target or comparison under it'],
    fits: 'When you want a card styled exactly your way, like the status pill, and your organization allows the HTML Content visual from AppSource.',
    avoid: 'Reports where custom visuals aren’t allowed; use a card with variance. Text in it isn’t clickable for drill-through.',
    score: h => h.base ? 50 : 40 },
  { id: 'ctxlabel', for: ['context', 'number'], name: 'Card with context labels', kind: 'native', need: 'ctx',
    nmc: ['The value', 'Nothing good or bad: context only', 'Your context lines under the value, in grey'],
    fits: 'Giving the number scale or perspective without judging it: share of total, rank, per customer, as-of date.',
    avoid: 'More than two lines: the card gets busy. Put the rest in the tooltip.',
    score: h => h.ctx ? 90 : -1 },
  { id: 'ctxsub', for: ['context', 'number'], name: 'Card with a context subtitle', kind: 'native', need: 'ctx',
    nmc: ['The value', 'Nothing good or bad: context only', 'Your first context line as the visual’s subtitle'],
    fits: 'Context that frames the whole card, like an as-of date or what’s included, above the number.',
    avoid: 'Context about the value itself (like a rank): it reads better right under the value.',
    score: h => h.ctx ? 70 : -1 },
  { id: 'ctxtip', for: ['context', 'number'], name: 'Context in the tooltip', kind: 'native', need: 'ctx',
    nmc: ['The value', 'Nothing good or bad: context only', 'Your context lines when readers hover'],
    fits: 'Clean cards on a busy page, with the detail one hover away.',
    avoid: 'Anything readers must see: tooltips are hidden on touch screens and in printed or exported pages.',
    score: h => h.ctx ? 55 : -1 },
  { id: 'card', for: ['number'], name: 'Plain card', kind: 'native', need: '',
    nmc: ['The value', 'None: nothing tells the reader if it’s good or bad', 'None'],
    fits: 'Counts and totals that only give scale (number of customers, rows loaded).',
    avoid: 'Any KPI people are judged on: without a target or comparison, the reader can’t tell if it’s good.',
    score: h => h.base ? 30 : 84 },
  { id: 'gauge', for: ['goal'], name: 'Gauge', kind: 'native', need: 'target',
    nmc: ['The value', 'The filled arc against the target mark', 'Min and max of the scale'],
    fits: 'A single KPI that people expect as a dial, like utilization or capacity.',
    avoid: 'Most of the time: it takes a lot of space for one number, and arcs are harder to compare than bars. A bullet chart says the same in a line.',
    score: h => h.target ? 22 : -1 }
];
const KV_ROW_OPTIONS = [
  { id: 'rcards', name: 'Card strip', kind: 'native', fits: 'A row of headline KPIs across the top of a page, with each one’s status under its value.', avoid: 'More than 5 or 6 KPIs in one row.' },
  { id: 'rspark', name: 'Card strip with sparklines', kind: 'svg', fits: 'A row where the trend of each KPI matters, not only today’s number.', avoid: 'KPIs with very little history.' },
  { id: 'rbullet', name: 'Card strip with bullet charts', kind: 'svg', fits: 'A row where every KPI has a target.', avoid: 'Rows where only some KPIs have targets; those cards show no bullet.' },
  { id: 'rlist', name: 'List card', kind: 'design', fits: 'Several KPIs stacked in one card: each name, value and a status badge.', avoid: 'More than 5 KPIs: the card gets tall.' },
  { id: 'rtable', name: 'Scorecard table', kind: 'svg', fits: 'Many KPIs, or KPIs people scan as a list: one row each with value, status, bullet and trend.', avoid: 'Two or three KPIs: cards read faster.' }
];
function kvMeets(o, h){ return o.score(h) >= 0; }
// Options that fit the KPI's purpose first, then the rest; ones its fields can't support last
function kvRanked(k){
  const h = kvHas(k), it = kvIntent(k);
  return KV_OPTIONS.map(o => { const sc = o.score(h); return { o, s: sc, ok: sc >= 0, fit: sc >= 0 && (o.for || []).includes(it) && (it !== 'context' || h.ctx) }; })
    .sort((a, b) => (b.ok - a.ok) || (b.fit - a.fit) || (b.s - a.s));
}

/* ---------- previews ---------- */
// cfg.colors: { good: {fill,text}, neutral, bad }, cfg.band: % close to target that counts as neutral
function kvLook(k, cfg){
  const n = kvNums(k), h = kvHas(k), base = h.target ? n.t : h.compare ? n.c : null;
  const st = kvStatus(n.v, base, k.better, cfg.band), d = base ? (n.v - base) / Math.abs(base) : 0;
  const stc = kvStatus(n.v, n.c, k.better, cfg.band), dc = n.c ? (n.v - n.c) / Math.abs(n.c) : 0;
  const P = kvInk(cfg), col = s => s ? cfg.colors[s] : { fill: P.track, text: P.text };
  const vsWhat = h.target ? 'vs target' : 'vs ' + ((k.compareLabel || '').trim() || 'last period');
  return { n, h, st, d, stc, dc, c: col(st), cc: col(stc), vsWhat, P };
}
const kvArrow = d => d > 0 ? '▲' : d < 0 ? '▼' : '►';
// A card's reference label colors its text only; a pill (background) is drawn only where Power BI can draw it (HTML)
function kvLabelHtml(L, small, pill){ return L.st ? '<span class="kv-lab' + (small ? ' sm' : '') + (pill ? ' pill' : '') + '" style="' + (pill ? 'background:' + L.c.fill + ';' : '') + 'color:' + L.c.text + '">' + kvArrow(L.d) + ' ' + kvSigned(L.d) + ' ' + esc(L.vsWhat) + '</span>' : ''; }
// The HTML card, with inline styles, as the HTML Content visual shows it (and as a file you can copy)
// The card is built for the visual's size (cfg.htmlW x cfg.htmlH): the value text gets as big as fits, and the
// other text, gaps and padding follow it, never below KV_HTML_MIN_PX.
// Layouts: stack (all lines under each other), side (name and value left, details right), grid (details in two columns)
const KV_HTML_W = 320, KV_HTML_H = 200, KV_HTML_MIN_PX = 12, KV_HTML_EDGE = 8, KV_HTML_VMIN = 24, KV_HTML_VMAX = 200;
const KV_HTML_LAYOUTS = [{ id: 'stack', name: 'Stacked', tip: 'Everything in one column. Suits tall or square visuals.' }, { id: 'side', name: 'Side by side', tip: 'Name and value on the left, details on the right. Suits wide, short visuals.' }, { id: 'grid', name: 'Grid', tip: 'Details in two columns under the value. Suits wide visuals with several details.' }];
// Pixel sizes for a value font size v
function kvHtmlSizes(v){
  const r = (f, min) => Math.max(min, Math.round(f * v)), det = Math.max(KV_HTML_MIN_PX, Math.round(v * 0.5));
  return { v, name: Math.max(KV_HTML_MIN_PX, Math.round(v * 0.4)), det, padV: r(0.32, 6), padH: r(0.44, 8), gap: r(0.44, 8), dgap: r(0.18, 4), pillV: Math.max(2, Math.round(det * 0.12)), pillH: Math.max(4, Math.round(det * 0.4)), radius: Math.max(3, Math.round(det * 0.25)) };
}
function kvHtmlStyle(v, lay, h, P){
  const z = kvHtmlSizes(v), px = n => n + 'px';
  P = P || KV_INK_DEF;
  return {
    box: 'font-family:Segoe UI,Arial,sans-serif;font-size:' + px(z.det) + ';line-height:1.3;background:' + P.bg + ';padding:' + px(z.padV) + ' ' + px(z.padH) + ';box-sizing:border-box;width:100%' + (h ? ';min-height:' + h + 'px' : '') + (lay === 'side' ? ';display:flex;align-items:center;gap:' + px(z.gap) : h ? ';display:flex;flex-direction:column;justify-content:center' : ''),
    name: 'font-size:' + px(z.name) + ';color:' + P.muted,
    value: 'font-size:' + px(z.v) + ';font-weight:600;color:' + P.text + ';line-height:1.2;white-space:nowrap',
    details: lay === 'grid' ? 'display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:' + px(z.dgap) + ' ' + px(z.gap) + ';margin-top:' + px(z.dgap)
      : 'display:flex;flex-direction:column;align-items:flex-start;gap:' + px(z.dgap) + (lay === 'side' ? ';border-left:1px solid ' + P.track + ';padding-left:' + px(z.gap) : ';margin-top:' + px(z.dgap)),
    pill: 'justify-self:start;padding:' + px(z.pillV) + ' ' + px(z.pillH) + ';border-radius:' + px(z.radius) + ';font-size:' + px(z.det) + ';font-weight:600;white-space:nowrap',
    sub: 'font-size:' + px(z.det) + ';color:' + P.muted };
}
// Rough text width in pixels for Segoe UI (and Arial), by character class
function kvTextW(t, fs, bold){
  let w = 0;
  for (const ch of String(t)) w += /[0-9$#€£]/.test(ch) ? 0.56 : /[,.:;'!|il ]/.test(ch) ? 0.27 : /[%]/.test(ch) ? 0.85 : /[▲▼►]/.test(ch) ? 0.8 : /[mwMW]/.test(ch) ? 0.85 : /[A-Z]/.test(ch) ? 0.64 : /[a-z]/.test(ch) ? 0.5 : 0.58;
  return w * fs * (bold ? 1.06 : 1);
}
const kvHtmlEsc = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
const kvHtmlSub = k => { const h = kvHas(k); return h.target ? 'Target ' : h.compare ? ((k.compareLabel || '').trim() || 'Last period') + ' ' : ''; };
// The detail lines under the value: the status pill, the target or comparison, then context lines
function kvHtmlDetails(k, cfg){
  const L = kvLook(k, cfg), n = L.n, sub = kvHtmlSub(k), D = [];
  if (L.h.base) D.push({ pill: true, text: kvArrow(L.d) + ' ' + kvSigned(L.d) + ' ' + L.vsWhat, show: !!L.st, len: L.vsWhat.length + 9 });
  if (sub) D.push({ text: sub + kvFmt(L.h.target ? n.t : n.c, k.format) });
  kvCtx(k).forEach(c => D.push({ text: kvCtxSample(k, c) }));
  return D;
}
const kvHtmlLayoutsFor = k => KV_HTML_LAYOUTS.filter(o => o.id === 'stack' || (o.id === 'side' ? kvHtmlDetails(k, { colors: KV_EXCEL, band: 0 }).length >= 1 : kvHtmlDetails(k, { colors: KV_EXCEL, band: 0 }).length >= 2));
// What the card needs (pixels) with value font size v, from the preview's text plus room for one more digit
function kvHtmlNeed(k, cfg, lay, v){
  const L = kvLook(k, cfg), D = kvHtmlDetails(k, cfg), z = kvHtmlSizes(v);
  const headW = Math.max(kvTextW(kvName(k), z.name), kvTextW(kvFmt(L.n.v, k.format) + '0', v, true)), headH = z.name * 1.3 + v * 1.2;
  const dw = D.map(d => d.pill ? kvTextW(d.text, z.det, true) + 2 * z.pillH : kvTextW(d.text, z.det)), dh = D.map(d => d.pill ? z.det * 1.3 + 2 * z.pillV : z.det * 1.3);
  const maxW = Math.max(0, ...dw), maxH = Math.max(0, ...dh), colH = dh.reduce((a, b) => a + b, 0) + z.dgap * Math.max(0, D.length - 1);
  if (!D.length || lay === 'stack') return { w: Math.max(headW, maxW) + 2 * z.padH, h: 2 * z.padV + headH + (D.length ? z.dgap + colH : 0) };
  if (lay === 'side') return { w: 2 * z.padH + headW + 2 * z.gap + 1 + maxW, h: 2 * z.padV + Math.max(headH, colH) };
  const rows = Math.ceil(D.length / 2);
  return { w: 2 * z.padH + Math.max(headW, 2 * maxW + z.gap), h: 2 * z.padV + headH + z.dgap + rows * maxH + z.dgap * (rows - 1) };
}
// The biggest value size that fits the visual in one layout; if even the smallest doesn't fit, the visual size it needs
function kvHtmlFitFor(k, cfg, lay){
  const W = Math.max(40, +cfg.htmlW || KV_HTML_W), H = Math.max(40, +cfg.htmlH || KV_HTML_H);
  const fits = v => { const n = kvHtmlNeed(k, cfg, lay, v); return n.w <= (W - KV_HTML_EDGE) * 0.98 && n.h <= (H - KV_HTML_EDGE) * 0.98; };
  const at = v => { const n = kvHtmlNeed(k, cfg, lay, v); return { w: Math.ceil((n.w / 0.98 + KV_HTML_EDGE) / 10) * 10, h: Math.ceil((n.h / 0.98 + KV_HTML_EDGE) / 10) * 10 }; };
  let lo = KV_HTML_VMIN, hi = KV_HTML_VMAX;
  const tooSmall = !fits(lo);
  if (!tooSmall) { while (lo < hi) { const m = Math.ceil((lo + hi) / 2); if (fits(m)) lo = m; else hi = m - 1; } }
  const v = lo, z = kvHtmlSizes(v);
  return { lay, W, H, v, fit: tooSmall ? 0 : v, tooSmall, smallest: Math.min(z.name, z.det), value: v, minSize: at(KV_HTML_VMIN), comfy: at(32), size: tooSmall ? at(KV_HTML_VMIN) : { w: W, h: H } };
}
// The layout picked (cfg.htmlLayout), or the one that gives the biggest text at this size
function kvHtmlBest(k, cfg){
  const all = kvHtmlLayoutsFor(k).map(o => kvHtmlFitFor(k, cfg, o.id));
  return all.every(f => f.tooSmall) ? all.reduce((a, b) => b.minSize.w * b.minSize.h < a.minSize.w * a.minSize.h ? b : a) : all.reduce((a, b) => b.fit > a.fit * 1.05 ? b : a);
}
function kvHtmlLayout(k, cfg){
  const ok = kvHtmlLayoutsFor(k).some(o => o.id === cfg.htmlLayout);
  return ok ? kvHtmlFitFor(k, cfg, cfg.htmlLayout) : kvHtmlBest(k, cfg);
}
function kvHtmlCard(k, cfg, lay){
  const L = kvLook(k, cfg), l = lay || (cfg.htmlScale ? { v: 32, lay: 'stack' } : kvHtmlLayout(k, cfg)), S = kvHtmlStyle(l.v, l.lay, l.size && l.size.h - KV_HTML_EDGE, kvInk(cfg)), D = kvHtmlDetails(k, cfg);
  const head = "<div style='" + S.name + "'>" + kvHtmlEsc(kvName(k)) + '</div>' + "<div style='" + S.value + "'>" + kvHtmlEsc(kvFmt(L.n.v, k.format)) + '</div>';
  const det = D.filter(d => !d.pill || d.show).map(d => d.pill ? "<div style='" + S.pill + ';background:' + L.c.fill + ';color:' + L.c.text + "'>" + kvHtmlEsc(d.text) + '</div>' : "<div style='" + S.sub + "'>" + kvHtmlEsc(d.text) + '</div>').join('');
  return "<div style='" + S.box + "'>" + (l.lay === 'side' && D.length ? '<div>' + head + '</div>' : head) + (D.length ? "<div style='" + S.details + "'>" + det + '</div>' : '') + '</div>';
}
const kvCtxHtml = k => kvCtx(k).map(c => '<div class="kv-ctx">' + esc(kvCtxSample(k, c)) + '</div>').join('');
// opts.refs: the reference labels, under the value or (opts.right) to its right
function kvCardHtml(k, L, inner, opts){
  opts = opts || {};
  const v = opts.noValue ? '' : '<div class="kv-cv">' + esc(kvFmt(L.n.v, k.format, true)) + '</div>', refs = opts.refs || '';
  const mid = opts.right && refs ? '<div class="kv-rr">' + v + '<div class="kv-refs">' + refs + '</div></div>' : v + refs;
  return '<div class="kv-card' + (opts.wide ? ' wide' : '') + '"><div class="kv-cl">' + esc(kvName(k)) + '</div>' + mid + (inner || '') + '</div>';
}
const kvRight = cfg => cfg.refPos === 'right';
function kvPreview(id, k, cfg){
  const L = kvLook(k, cfg), n = L.n, P = L.P, sc = L.st ? L.c.text : P.text;
  switch (id) {
    case 'card': return kvCardHtml(k, L);
    case 'cardvar': return kvCardHtml(k, L, '', { refs: kvLabelHtml(L) + kvCtxHtml(k), right: kvRight(cfg) });
    case 'ctxlabel': return kvCardHtml(k, L, '', { refs: kvCtxHtml(k), right: kvRight(cfg) });
    case 'ctxsub': { const c = kvCtx(k)[0]; return '<div class="kv-card"><div class="kv-ttl">' + esc(kvName(k)) + '</div>' + (c ? '<div class="kv-subt">' + esc(kvCtxSample(k, c)) + '</div>' : '') + '<div class="kv-cv">' + esc(kvFmt(n.v, k.format, true)) + '</div></div>'; }
    case 'ctxtip': return '<div class="kv-tipwrap">' + kvCardHtml(k, L) + '<div class="kv-tip" aria-hidden="true"><div><span>' + esc(kvName(k)) + '</span><b>' + esc(kvFmt(n.v, k.format)) + '</b></div>' + kvCtx(k).map((c, i) => '<div><span>' + esc(kvCtxTipName(c, i)) + '</span><b>' + esc(kvCtxSample(k, ['period', 'asof'].includes(c.kind) ? Object.assign({}, c, { before: '' }) : c)) + '</b></div>').join('') + '</div></div>';
    case 'bullet': return kvCardHtml(k, L, '<div class="kv-svg">' + kvSvgBullet(n, sc, P) + '</div><div class="kv-sub">Target ' + esc(kvFmt(n.t, k.format, true)) + '</div>', { refs: kvLabelHtml(L), right: kvRight(cfg) });
    case 'progress': return kvCardHtml(k, L, '<div class="kv-svg">' + kvSvgProgress(n, sc, P) + '</div><div class="kv-sub">of ' + esc(kvFmt(n.t, k.format, true)) + ' target</div>', { refs: kvLabelHtml(L), right: kvRight(cfg) });
    case 'spark': return kvCardHtml(k, L, '<div class="kv-svg">' + kvSvgSpark(n, sc, P) + '</div><div class="kv-sub">Last ' + Math.min(n.trend.length, 12) + ' months</div>', { refs: kvLabelHtml(L), right: kvRight(cfg) });
    case 'varbar': return kvCardHtml(k, L, '<div class="kv-svg">' + kvSvgVarBar(L.d, sc, P) + '</div><div class="kv-sub">' + esc(L.vsWhat) + '</div>', { refs: kvLabelHtml(L), right: kvRight(cfg) });
    case 'slope': return kvCardHtml(k, L, '<div class="kv-svg">' + kvSvgSlope(L.dc, L.stc ? L.cc.text : P.text, P) + '</div><div class="kv-sub">' + esc(kvFmt(n.c, k.format, true)) + ' ' + esc((k.compareLabel || 'before').trim()) + ' → now</div>');
    case 'waffle': { const p = L.h.pct ? n.v : (n.t ? n.v / n.t : 0); return kvCardHtml(k, L, '<div class="kv-row"><div class="kv-svg">' + kvSvgWaffle(p, L.st ? L.c.text : P.muted, P) + '</div><div class="kv-sub">' + (L.h.pct ? '' : Math.round(p * 100) + '% of target') + '</div></div>', { refs: kvLabelHtml(L), right: kvRight(cfg) }); }
    case 'gauge': return kvCardHtml(k, L, '<div class="kv-svg">' + kvSvgGauge(n, sc, P) + '</div><div class="kv-sub">Target ' + esc(kvFmt(n.t, k.format, true)) + '</div>');
    case 'kpi': return '<div class="kv-card"><div class="kv-cl">' + esc(kvName(k)) + '</div><div class="kv-kpi"><div class="kv-area">' + kvSvgArea(n, P) + '</div><div class="kv-cv" style="color:' + sc + '">' + esc(kvFmt(n.v, k.format, true)) + ' <span class="kv-ic">' + (L.st === 'good' ? '✔' : L.st === 'bad' ? '!' : '') + '</span></div></div><div class="kv-sub">Goal: ' + esc(kvFmt(n.t, k.format, true)) + ' (' + kvSigned(L.d) + ')</div></div>';
    case 'dcols': case 'dtarget': case 'dbadge': case 'dlolli': case 'dfill': case 'ddetail': return '<div class="kv-svg kv-design">' + kvDesignSvg(id, k, cfg) + '</div>';
    case 'html': return '<div class="kv-html">' + kvHtmlCard(k, Object.assign({}, cfg, { htmlScale: 1 })) + '</div>';
    case 'core': return kvCardHtml(k, L, '<div class="kv-area">' + kvSvgArea(n, P) + '</div>', { refs: kvLabelHtml(L), right: kvRight(cfg) });
  }
  return '';
}
function kvRowPreview(id, kpis, cfg){
  if (id === 'rlist') return '<div class="kv-svg kv-design">' + kvListSvg(kpis, cfg) + '</div>';
  if (id === 'rtable') {
    return '<div class="kv-tablewrap"><table class="kv-table"><thead><tr><th>KPI</th><th>Value</th><th>Status</th><th>Target</th><th>Trend</th></tr></thead><tbody>' + kpis.map(k => {
      const L = kvLook(k, cfg), P = L.P, sc = L.st ? L.c.text : P.text;
      return '<tr><td>' + esc(kvName(k)) + '</td><td class="num">' + esc(kvFmt(L.n.v, k.format, true)) + '</td><td' + (L.st ? ' style="background:' + L.c.fill + '"' : '') + '>' + (kvLabelHtml(L, true) || '<span class="muted">–</span>') + '</td><td>' + (L.h.target ? kvSvgBullet(L.n, sc, P) : '') + '</td><td>' + kvSvgSpark(L.n, sc, P) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }
  return '<div class="kv-strip">' + kpis.map(k => {
    const L = kvLook(k, cfg), P = L.P, sc = L.st ? L.c.text : P.text;
    const img = id === 'rspark' ? kvSvgSpark(L.n, sc, P) : id === 'rbullet' && L.h.target ? kvSvgBullet(L.n, sc, P) : '';
    return kvCardHtml(k, L, img ? '<div class="kv-svg">' + img + '</div>' : '', { refs: kvLabelHtml(L, true), right: kvRight(cfg) });
  }).join('') + '</div>';
}

/* ---------- DAX ---------- */
function kvRef(x){
  const s = String(x || '').trim();
  if (!s) return '';
  if (kvIsNumText(s)) { const v = kvNum(s); return String(v); }
  if (/^\[.*\]$/.test(s) || /^'.*'\[.*\]$/.test(s) || /^[A-Za-z_][\w ]*\[.*\]$/.test(s)) return s;
  return bracket(s);
}
const kvMName = (k, suffix) => kvName(k) + ' ' + suffix;
const kvSvgReturn = (cond) => ['RETURN', '    IF ( ' + cond + ', "data:image/svg+xml;utf8," & SUBSTITUTE ( _Svg, "#", "%23" ) )'];
const kvFx = x => 'FORMAT ( ' + x + ', "0.0", "en-US" )';
function kvStatusMeasures(k, cfg){
  const h = kvHas(k), v = kvRef(k.measure), base = kvRef(h.target ? k.target : k.compare);
  const band = ((+cfg.band || 0) / 100).toString(), C = cfg.colors, vs = h.target ? 'vs target' : 'vs ' + ((k.compareLabel || '').trim() || 'last period');
  const varN = kvMName(k, 'Var %'), stN = kvMName(k, 'Status');
  return [
    { name: varN, formatString: '+0.0%;-0.0%;0.0%', description: 'How far ' + kvName(k) + ' is ' + (h.target ? 'from its target' : 'from ' + vs.slice(3)) + ', as a % of it.',
      expression: ['VAR _Value = ' + v, 'VAR _Base = ' + base, 'RETURN', '    IF ( NOT ISBLANK ( _Value ) && NOT ISBLANK ( _Base ) && _Base <> 0, DIVIDE ( _Value - _Base, ABS ( _Base ) ) )'].join('\n') },
    { name: stN, description: 'Good, Neutral or Bad. Within ' + cfg.band + '% counts as Neutral; ' + (k.better === 'lower' ? 'lower' : 'higher') + ' is better.',
      expression: ['VAR _Var = ' + bracket(varN), 'VAR _Score = ' + (k.better === 'lower' ? '-_Var' : '_Var'), 'RETURN', '    SWITCH (', '        TRUE (),', '        ISBLANK ( _Var ), BLANK (),', '        _Score >= ' + band + ' && _Score > 0, "Good",', '        _Score <= -' + band + ' && _Score < 0, "Bad",', '        "Neutral"', '    )'].join('\n') },
    { name: kvMName(k, 'Status Color'), description: 'Text color for the status (conditional formatting: Field value).',
      expression: ['SWITCH (', '    ' + bracket(stN) + ',', '    "Good", "' + C.good.text + '",', '    "Neutral", "' + C.neutral.text + '",', '    "Bad", "' + C.bad.text + '"', ')'].join('\n') },
    { name: kvMName(k, 'Status Fill'), description: 'Background color for the status (conditional formatting: Field value).',
      expression: ['SWITCH (', '    ' + bracket(stN) + ',', '    "Good", "' + C.good.fill + '",', '    "Neutral", "' + C.neutral.fill + '",', '    "Bad", "' + C.bad.fill + '"', ')'].join('\n') },
    { name: kvMName(k, 'Status Label'), description: 'An arrow and the % ' + vs + ', for a card reference label or a table column.',
      expression: ['VAR _Var = ' + bracket(varN), 'VAR _Arrow =', '    SWITCH ( TRUE (), _Var > 0, UNICHAR ( 9650 ), _Var < 0, UNICHAR ( 9660 ), UNICHAR ( 9658 ) )', 'RETURN', '    IF ( NOT ISBLANK ( _Var ), _Arrow & " " & FORMAT ( _Var, "+0.0%;-0.0%;0.0%" ) & " ' + vs.replace(/"/g, '""') + '" )'].join('\n') }
  ];
}
const kvColorVar = (k, h, P) => h.base ? 'VAR _Color = COALESCE ( ' + bracket(kvMName(k, 'Status Color')) + ', "' + P.text + '" )' : 'VAR _Color = "' + P.text + '"';
function kvSvgMeasure(id, k, cfg){
  const h = kvHas(k), v = kvRef(k.measure), t = kvRef(k.target), c = kvRef(k.compare), D = [];
  const svgOpen = (w, hh) => '"<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'' + w + '\' height=\'' + hh + '\' viewBox=\'0 0 ' + w + ' ' + hh + '\'>"';
  const tc = (cfg.trendCol || '').trim() || "'Date'[Month Start]", N = Math.max(2, Math.min(36, +cfg.periods || 12));
  const m = { dataCategory: 'ImageUrl' }, P = kvInk(cfg);
  if (id === 'bullet') {
    m.name = kvMName(k, 'Bullet'); m.description = 'Bullet chart: the bar is ' + kvName(k) + ', the dark mark is the target. Set the visual’s image size to 120 x 24.';
    D.push('VAR _Value = ' + v, 'VAR _Target = ' + t, 'VAR _Max = MAX ( MAX ( _Value, _Target ), 0 ) * 1.15', 'VAR _ValueW = MAX ( 0, MIN ( 1, DIVIDE ( _Value, _Max ) ) ) * 112', 'VAR _TargetX = 4 + MAX ( 0, MIN ( 1, DIVIDE ( _Target, _Max ) ) ) * 112', kvColorVar(k, h, P),
      'VAR _Svg =', '    ' + svgOpen(120, 24), '        & "<rect x=\'4\' y=\'6\' width=\'112\' height=\'12\' fill=\'' + P.track + '\'/>"', '        & "<rect x=\'4\' y=\'8\' width=\'" & ' + kvFx('_ValueW') + ' & "\' height=\'8\' fill=\'" & _Color & "\'/>"', '        & "<rect x=\'" & ' + kvFx('_TargetX - 1') + ' & "\' y=\'3\' width=\'2\' height=\'18\' fill=\'' + P.text + '\'/>"', '        & "</svg>"', ...kvSvgReturn('NOT ISBLANK ( _Value ) && NOT ISBLANK ( _Target )'));
  } else if (id === 'progress') {
    m.name = kvMName(k, 'Progress'); m.description = 'Progress bar: ' + kvName(k) + ' as a % of its target. Image size 120 x 24.';
    D.push('VAR _Pct = DIVIDE ( ' + v + ', ' + t + ' )', 'VAR _W = MAX ( 0, MIN ( 1, _Pct ) ) * 88', kvColorVar(k, h, P),
      'VAR _Svg =', '    ' + svgOpen(120, 24), '        & "<rect x=\'2\' y=\'8\' width=\'88\' height=\'8\' rx=\'4\' fill=\'' + P.track + '\'/>"', '        & "<rect x=\'2\' y=\'8\' width=\'" & ' + kvFx('_W') + ' & "\' height=\'8\' rx=\'4\' fill=\'" & _Color & "\'/>"', '        & "<text x=\'118\' y=\'16\' text-anchor=\'end\' font-family=\'Segoe UI, sans-serif\' font-size=\'11\' fill=\'' + P.text + '\'>" & FORMAT ( _Pct, "0%" ) & "</text>"', '        & "</svg>"', ...kvSvgReturn('NOT ISBLANK ( _Pct )'));
  } else if (id === 'spark') {
    m.name = kvMName(k, 'Sparkline'); m.description = 'The last ' + N + ' periods of ' + kvName(k) + ' by ' + tc + ', with the last point in status color. Image size 120 x 32.';
    D.push('VAR _Data =', '    TOPN (', '        ' + N + ',', '        FILTER ( ADDCOLUMNS ( VALUES ( ' + tc + ' ), "@v", ' + v + ' ), NOT ISBLANK ( [@v] ) ),', '        ' + tc + ', DESC', '    )',
      'VAR _N = COUNTROWS ( _Data )', 'VAR _Lo = MINX ( _Data, [@v] )', 'VAR _Hi = MAXX ( _Data, [@v] )', 'VAR _Range = IF ( _Hi = _Lo, 1, _Hi - _Lo )',
      'VAR _Pts = ADDCOLUMNS ( _Data, "@x", RANKX ( _Data, ' + tc + ', , ASC ) )',
      'VAR _Line =', '    CONCATENATEX (', '        _Pts,', '        ' + kvFx('2 + ( [@x] - 1 ) * 116 / MAX ( _N - 1, 1 )') + ' & "," & ' + kvFx('29 - ( [@v] - _Lo ) * 26 / _Range') + ',', '        " ",', '        [@x], ASC', '    )',
      'VAR _LastV = MAXX ( FILTER ( _Pts, [@x] = _N ), [@v] )', 'VAR _LastY = 29 - ( _LastV - _Lo ) * 26 / _Range', kvColorVar(k, h, P),
      'VAR _Svg =', '    ' + svgOpen(120, 32), '        & "<polyline points=\'" & _Line & "\' fill=\'none\' stroke=\'' + P.line + '\' stroke-width=\'1.5\' stroke-linejoin=\'round\'/>"', '        & "<circle cx=\'118\' cy=\'" & ' + kvFx('_LastY') + ' & "\' r=\'2.5\' fill=\'" & _Color & "\'/>"', '        & "</svg>"', ...kvSvgReturn('_N >= 2'));
  } else if (id === 'varbar') {
    m.name = kvMName(k, 'Variance Bar'); m.description = 'Variance bar: % ' + (h.target ? 'vs target' : 'vs ' + (k.compareLabel || 'last period')) + '; full width is ±25%. Image size 120 x 24.';
    D.push('VAR _Var = ' + bracket(kvMName(k, 'Var %')), 'VAR _Scale = 0.25 // full width = +/-25%', 'VAR _W = MIN ( ABS ( _Var ) / _Scale, 1 ) * 50', 'VAR _X = IF ( _Var >= 0, 60, 60 - _W )', kvColorVar(k, h, P),
      'VAR _Svg =', '    ' + svgOpen(120, 24), '        & "<rect x=\'" & ' + kvFx('_X') + ' & "\' y=\'6\' width=\'" & ' + kvFx('_W') + ' & "\' height=\'12\' fill=\'" & _Color & "\'/>"', '        & "<rect x=\'59.5\' y=\'2\' width=\'1\' height=\'20\' fill=\'' + P.text + '\'/>"', '        & "<text x=\'" & IF ( _Var >= 0, 57, 63 ) & "\' y=\'16\' text-anchor=\'" & IF ( _Var >= 0, "end", "start" ) & "\' font-family=\'Segoe UI, sans-serif\' font-size=\'10\' fill=\'' + P.text + '\'>" & FORMAT ( _Var, "+0%;-0%;0%" ) & "</text>"', '        & "</svg>"', ...kvSvgReturn('NOT ISBLANK ( _Var )'));
  } else if (id === 'slope') {
    const band = ((+cfg.band || 0) / 100).toString(), C = cfg.colors;
    m.name = kvMName(k, 'Slope'); m.description = 'Slope from ' + ((k.compareLabel || '').trim() || 'the earlier period') + ' to now, colored by whether it got better. Image size 120 x 32.';
    D.push('VAR _Now = ' + v, 'VAR _Before = ' + c, 'VAR _Change = DIVIDE ( _Now - _Before, ABS ( _Before ) )', 'VAR _Score = ' + (k.better === 'lower' ? '-_Change' : '_Change'),
      'VAR _Color =', '    SWITCH ( TRUE (), _Score >= ' + band + ' && _Score > 0, "' + C.good.text + '", _Score <= -' + band + ' && _Score < 0, "' + C.bad.text + '", "' + C.neutral.text + '" )',
      'VAR _Dy = MAX ( -1, MIN ( 1, _Change / 0.25 ) ) * 11', 'VAR _Y1 = ' + kvFx('16 + _Dy'), 'VAR _Y2 = ' + kvFx('16 - _Dy'),
      'VAR _Svg =', '    ' + svgOpen(120, 32), '        & "<line x1=\'10\' y1=\'" & _Y1 & "\' x2=\'110\' y2=\'" & _Y2 & "\' stroke=\'" & _Color & "\' stroke-width=\'2\'/>"', '        & "<circle cx=\'10\' cy=\'" & _Y1 & "\' r=\'3\' fill=\'' + P.line + '\'/>"', '        & "<circle cx=\'110\' cy=\'" & _Y2 & "\' r=\'3.5\' fill=\'" & _Color & "\'/>"', '        & "</svg>"', ...kvSvgReturn('NOT ISBLANK ( _Now ) && NOT ISBLANK ( _Before )'));
  } else if (id === 'waffle') {
    m.name = kvMName(k, 'Waffle'); m.description = 'Waffle chart: ' + (h.pct ? kvName(k) : kvName(k) + ' as a % of target') + ' in squares out of 100. Image size 60 x 60.';
    D.push('VAR _Pct = ' + (h.pct ? v : 'DIVIDE ( ' + v + ', ' + t + ' )'), 'VAR _Filled = ROUND ( MAX ( 0, MIN ( 1, _Pct ) ) * 100, 0 )', h.base ? kvColorVar(k, h, P) : 'VAR _Color = "' + P.muted + '"',
      'VAR _Cells =', '    CONCATENATEX (', '        GENERATESERIES ( 0, 99 ),', '        "<rect x=\'" & MOD ( [Value], 10 ) * 6 & "\' y=\'" & ( 9 - INT ( [Value] / 10 ) ) * 6', '            & "\' width=\'5\' height=\'5\' fill=\'" & IF ( [Value] < _Filled, _Color, "' + P.track + '" ) & "\'/>",', '        "",', '        [Value], ASC', '    )',
      'VAR _Svg = ' + svgOpen(60, 60) + ' & _Cells & "</svg>"', ...kvSvgReturn('NOT ISBLANK ( _Pct )'));
  } else return null;
  m.expression = D.join('\n');
  return m;
}
function kvHtmlMeasure(k, cfg){
  const l = kvHtmlLayout(k, cfg), KV_HTML = kvHtmlStyle(l.v, l.lay, l.size.h - KV_HTML_EDGE, kvInk(cfg)), h = kvHas(k), fmt = daxString(k.format || '#,0'), q = x => x.replace(/"/g, '""'), sub = kvHtmlSub(k), n = kvCtx(k).length;
  const hasD = h.base || !!sub || n > 0, side = l.lay === 'side' && hasD;
  const D = ['VAR _Value = ' + kvRef(k.measure)];
  if (h.base) D.push('VAR _Label = ' + bracket(kvMName(k, 'Status Label')), 'VAR _Color = ' + bracket(kvMName(k, 'Status Color')), 'VAR _Fill = ' + bracket(kvMName(k, 'Status Fill')));
  if (sub) D.push('VAR _Base = ' + kvRef(h.target ? k.target : k.compare));
  kvCtx(k).forEach((c, i) => D.push('VAR _Context' + (i + 1) + ' = ' + bracket(kvCtxName(k, i))));
  D.push('// Styles for a visual ' + l.size.w + ' x ' + l.size.h + ' pixels, ' + KV_HTML_LAYOUTS.find(o => o.id === l.lay).name.toLowerCase() + ': change sizes, colors and the font here',
    'VAR _BoxStyle = "' + KV_HTML.box + '"', 'VAR _NameStyle = "' + KV_HTML.name + '"', 'VAR _ValueStyle = "' + KV_HTML.value + '"');
  if (hasD) D.push('VAR _DetailStyle = "' + KV_HTML.details + '"');
  if (h.base) D.push('VAR _PillStyle = "' + KV_HTML.pill + ';background:" & _Fill & ";color:" & _Color');
  if (sub || n) D.push('VAR _SubStyle = "' + KV_HTML.sub + '"');
  const I = side ? '    ' : '';
  const opt = (test, html) => ['                & IF (', '                    NOT ISBLANK ( ' + test + ' ),', '                    ' + html, '                )'];
  D.push('RETURN', '    IF (', '        NOT ISBLANK ( _Value ),', '        "<div style=\'" & _BoxStyle & "\'>"');
  if (side) D.push('            & "<div>"');
  D.push(I + '            & "<div style=\'" & _NameStyle & "\'>' + q(kvHtmlEsc(kvName(k))) + '</div>"',
    I + '            & "<div style=\'" & _ValueStyle & "\'>" & FORMAT ( _Value, ' + fmt + ' ) & "</div>"');
  if (side) D.push('            & "</div>"');
  if (hasD) {
    D.push('            & "<div style=\'" & _DetailStyle & "\'>"');
    const o2 = opt;
    if (h.base) D.push(...o2('_Label', '"<div style=\'" & _PillStyle & "\'>" & _Label & "</div>"'));
    if (sub) D.push(...o2('_Base', '"<div style=\'" & _SubStyle & "\'>' + q(kvHtmlEsc(sub)) + '" & FORMAT ( _Base, ' + fmt + ' ) & "</div>"'));
    kvCtx(k).forEach((c, i) => D.push(...o2('_Context' + (i + 1), '"<div style=\'" & _SubStyle & "\'>" & _Context' + (i + 1) + ' & "</div>"')));
    D.push('                & "</div>"');
  }
  D.push('            & "</div>"', '    )');
  return { name: kvMName(k, 'HTML Card'), description: 'The whole card as HTML, for the HTML Content visual (from AppSource). Built for a visual ' + l.size.w + ' x ' + l.size.h + ' pixels.', expression: D.join('\n') };
}
const kvCtxName = (k, i) => kvMName(k, 'Context ' + (i + 1));
const kvCtxTipName = (c, i) => ({ measure: 'Also', share: 'Share of total', rank: 'Rank', per: 'Per item', period: (c.before || 'Earlier').replace(/:\s*$/, ''), asof: 'As of', text: 'Note' }[c.kind] || 'Context ' + (i + 1));
// A measure that returns one context line as text, so a reference label, subtitle or tooltip can show it
function kvCtxMeasure(k, c, i){
  const v = kvRef(k.measure), r = (c.ref || '').trim(), col = kvColName(r), pre = c.before ? daxString(c.before) + ' & ' : '', post = c.after ? ' & ' + daxString(c.after) : '';
  const line = x => '    IF ( NOT ISBLANK ( _X ), ' + pre + x + post + ' )';
  let D, what;
  switch (c.kind) {
    case 'measure': D = ['VAR _X = ' + kvRef(r), 'RETURN', line('FORMAT ( _X, ' + daxString(c.fmt || '#,0') + ' )')]; what = kvRef(r) + ' as context'; break;
    case 'share': D = ['VAR _Value = ' + v, 'VAR _All = CALCULATE ( ' + v + ', REMOVEFILTERS ( ' + r + ' ) )', 'VAR _X = DIVIDE ( _Value, _All )', 'RETURN', line('FORMAT ( _X, "0%" )')]; what = 'Share of the total across ' + r + ' (100% until something filters ' + r + ')'; break;
    case 'rank': D = ['VAR _Value = ' + v, 'VAR _X =', '    IF ( HASONEVALUE ( ' + r + ' ) && NOT ISBLANK ( _Value ), RANKX ( ALL ( ' + r + ' ), ' + v + ', , ' + (k.better === 'lower' ? 'ASC' : 'DESC') + ' ) )', 'VAR _Count = COUNTROWS ( FILTER ( ALL ( ' + r + ' ), NOT ISBLANK ( ' + v + ' ) ) )', 'RETURN', line('"#" & _X & " of " & _Count')]; what = 'Rank among ' + r + ' (blank unless one ' + (col ? col.column : 'value') + ' is selected)'; break;
    case 'per': D = ['VAR _X = DIVIDE ( ' + v + ', DISTINCTCOUNT ( ' + r + ' ) )', 'RETURN', line('FORMAT ( _X, ' + daxString(c.fmt || '#,0.0') + ' )')]; what = kvName(k) + ' per ' + (col ? col.column : r); break;
    case 'period': D = ['VAR _X = ' + kvRef(r), 'RETURN', line('FORMAT ( _X, ' + daxString(k.format || '#,0') + ' )')]; what = kvRef(r) + ', shown as a number'; break;
    case 'asof': D = ['VAR _X = MAXX ( FILTER ( VALUES ( ' + r + ' ), NOT ISBLANK ( ' + v + ' ) ), ' + r + ' )', 'RETURN', line('FORMAT ( _X, "d mmm yyyy" )')]; what = 'The latest ' + r + ' with ' + kvName(k); break;
    default: D = [daxString(((c.before || '') + (c.after || '')).trim())]; what = 'Fixed text';
  }
  return { name: kvCtxName(k, i), description: 'Context line for ' + kvName(k) + ': ' + what + '.', expression: D.join('\n') };
}
// measures an option needs for one KPI
function kvOptionMeasures(id, k, cfg){
  const h = kvHas(k), out = [];
  if (!(k.measure || '').trim()) return out;
  const svgId = { rspark: 'spark', rbullet: 'bullet' }[id] || id;
  const needStatus = h.base && !['card', 'kpi', 'slope', 'ctxlabel', 'ctxsub', 'ctxtip'].includes(id);
  if (needStatus) out.push(...kvStatusMeasures(k, cfg).filter(m => !/ Status Fill$/.test(m.name) || id === 'rtable' || id === 'html'));
  if (['ctxlabel', 'ctxsub', 'ctxtip', 'cardvar', 'html'].includes(id)) kvCtx(k).slice(0, KV_CTX_MAX).forEach((c, i) => out.push(kvCtxMeasure(k, c, i)));
  if (['ctxlabel', 'ctxsub', 'ctxtip'].includes(id)) return out;
  if (id === 'html') { out.push(kvHtmlMeasure(k, cfg)); return out; }
  if (KV_DESIGNS[id]) { if (id === 'ddetail') kvCtx(k).slice(0, KV_CTX_MAX).forEach((c, i) => out.push(kvCtxMeasure(k, c, i))); out.push(kvDesignMeasure(id, k, cfg)); return out; }
  if (id === 'rlist') return out;
  if (id === 'rtable') { if (h.target) out.push(kvSvgMeasure('bullet', k, cfg)); out.push(kvSvgMeasure('spark', k, cfg)); }
  else if (id === 'rbullet' && !h.target) { /* nothing to draw */ }
  else { const s = kvSvgMeasure(svgId, k, cfg); if (s) out.push(s); }
  return out;
}

/* ---------- TMDL ---------- */
function kvMeasureLines(m, T){
  const L = [], ind = T + T;
  if (m.description) L.push(ind + '/// ' + m.description);
  const lines = exprLines(m.expression);
  if (lines.length <= 1) L.push(ind + 'measure ' + tmdlName(m.name) + ' = ' + (lines[0] || '').trim());
  else { L.push(ind + 'measure ' + tmdlName(m.name) + ' ='); lines.forEach(l => L.push(l ? T.repeat(4) + l : '')); }
  if (m.formatStringDefinition) { L.push(ind + T + 'formatStringDefinition ='); exprLines(m.formatStringDefinition).forEach(l => L.push(l ? T.repeat(5) + l : '')); }
  if (m.formatString) L.push(ind + T + 'formatString: ' + tmdlValue(m.formatString));
  if (m.dataCategory) L.push(ind + T + 'dataCategory: ' + m.dataCategory);
  if (m.folder) L.push(ind + T + 'displayFolder: ' + tmdlValue(m.folder));
  L.push('');
  return L;
}
// every measure for the current choice: [{ ...measure, folder }]
function kvPlan(kpis, cfg, optionId){
  const out = [], seen = new Set(), base = normFolder(cfg.folder || '');
  kpis.forEach(k => kvOptionMeasures(optionId, k, cfg).forEach(m => {
    if (seen.has(lc(m.name))) return; seen.add(lc(m.name));
    out.push(Object.assign({}, m, { folder: [base, kvName(k)].filter(Boolean).join('\\') }));
  }));
  if (optionId === 'rlist' && kpis.some(k => (k.measure || '').trim())) out.push(Object.assign(kvListMeasure(kpis.filter(k => (k.measure || '').trim()), cfg), { folder: base }));
  return out;
}
const kvScoreTable = cfg => (cfg.scoreTable || '').trim() || 'KPI Scorecard';
function kvScorecard(kpis, cfg){
  // measures that live in the scorecard table and switch on the KPI row
  const tn = kvScoreTable(cfg), pick = 'SELECTEDVALUE ( ' + qName(tn) + '[KPI] )';
  const sw = (fn, other) => ['SWITCH (', '    ' + pick + ','].concat(kpis.map((k, i) => '    ' + daxString(kvName(k)) + ', ' + fn(k) + (i < kpis.length - 1 || other ? ',' : ''))).concat(other ? ['    ' + other] : []).concat([')']).join('\n');
  const st = k => kvHas(k).base;
  const ms = [
    { name: 'KPI Value', description: 'The value of the KPI on this row, in its own format.', expression: sw(k => kvRef(k.measure)),
      formatStringDefinition: sw(k => daxString(k.format || '#,0'), 'SELECTEDMEASUREFORMATSTRING ()') },
    { name: 'KPI Status Label', description: 'Arrow and % vs target or comparison.', expression: sw(k => st(k) ? bracket(kvMName(k, 'Status Label')) : 'BLANK ()') },
    { name: 'KPI Status Color', description: 'Status text color, for conditional formatting (Field value).', expression: sw(k => st(k) ? bracket(kvMName(k, 'Status Color')) : 'BLANK ()') },
    { name: 'KPI Status Fill', description: 'Status background color, for conditional formatting (Field value).', expression: sw(k => st(k) ? bracket(kvMName(k, 'Status Fill')) : 'BLANK ()') },
    { name: 'KPI Bullet', description: 'Bullet chart for the KPI on this row (blank when it has no target).', dataCategory: 'ImageUrl', expression: sw(k => kvHas(k).target ? bracket(kvMName(k, 'Bullet')) : 'BLANK ()') },
    { name: 'KPI Trend', description: 'Sparkline for the KPI on this row.', dataCategory: 'ImageUrl', expression: sw(k => bracket(kvMName(k, 'Sparkline'))) }
  ];
  return { table: tn, measures: ms };
}
function kvTmdl(kpis, cfg, optionId){
  const T = TAB, plan = kvPlan(kpis, cfg, optionId);
  const L = ['createOrReplace', ''];
  if (plan.length) { L.push(T + 'ref table ' + tmdlName((cfg.table || '').trim()), ''); plan.forEach(m => L.push(...kvMeasureLines(m, T))); }
  if (optionId === 'rtable') {
    const s = kvScorecard(kpis, cfg);
    L.push(T + 'table ' + tmdlName(s.table), '');
    s.measures.forEach(m => L.push(...kvMeasureLines(m, T)));
    L.push(T + T + 'column KPI', T + T + T + 'dataType: string', T + T + T + 'isDataTypeInferred', T + T + T + 'summarizeBy: none', T + T + T + 'sourceColumn: [Value1]', T + T + T + 'sortByColumn: Order', '');
    L.push(T + T + 'column Order', T + T + T + 'dataType: int64', T + T + T + 'isDataTypeInferred', T + T + T + 'isHidden', T + T + T + 'formatString: 0', T + T + T + 'summarizeBy: none', T + T + T + 'sourceColumn: [Value2]', '');
    L.push(T + T + 'partition ' + tmdlName(s.table) + ' = calculated', T + T + T + 'mode: import', T + T + T + 'source =', T.repeat(5) + '{');
    kpis.forEach((k, i) => L.push(T.repeat(5) + '    (' + daxString(kvName(k)) + ', ' + (i + 1) + ')' + (i < kpis.length - 1 ? ',' : '')));
    L.push(T.repeat(5) + '}', '');
  }
  while (L.length && L[L.length - 1] === '') L.pop();
  return L.join('\n') + '\n';
}
// A query that defines the measures without changing the model, so they can be checked first
function kvTestQuery(kpis, cfg, optionId){
  const plan = kvPlan(kpis, cfg, optionId); if (!plan.length) return '';
  const tq = qName((cfg.table || '').trim()), I = '    ';
  const L = ['// Run in DAX query view. It defines the new measures for this query only; nothing in the model changes.', 'DEFINE'];
  plan.forEach(m => { L.push(I + 'MEASURE ' + tq + bracket(m.name) + ' ='); exprLines(m.expression).forEach(l => L.push(l ? I + I + l.replace(/\t/g, I) : '')); });
  L.push('EVALUATE', 'ROW (');
  const cols = plan.map(m => I + daxString(m.name) + ', ' + bracket(m.name));
  L.push(cols.join(',\n'), ')');
  return L.join('\n') + '\n';
}
function kvChecks(kpis, cfg, optionId, model){
  const out = [], add = (level, text) => out.push({ level, text });
  if (!kpis.length) { add('info', 'Add a KPI in Step 2.'); return out; }
  kpis.forEach((k, i) => { if (!(k.measure || '').trim()) add('err', 'KPI ' + (i + 1) + (k.label ? ' (' + k.label + ')' : '') + ' has no measure. Type the measure’s name so the DAX can use it.'); });
  const usesCtx = ['ctxlabel', 'ctxsub', 'ctxtip', 'cardvar', 'html', 'ddetail'].includes(optionId);
  if (usesCtx) kpis.forEach(k => (k.ctx || []).forEach((c, j) => {
    const d = kvCtxKind(c), r = (c.ref || '').trim(), where = kvName(k) + ', context ' + (j + 1);
    if (c.kind !== 'text' && !r) add('warn', where + ' has no ' + d.ref.toLowerCase() + ' yet, so it’s left out.');
    else if (['share', 'rank', 'per', 'asof'].includes(c.kind) && !kvColName(r)) add('err', where + ': type the column as \'Table\'[Column], for example ' + d.ph + '.');
    else if (model && kvColName(r) && ['share', 'rank', 'per', 'asof'].includes(c.kind)) { const cn = kvColName(r); if (!model.columns.some(x => lc(x.table) === lc(cn.table) && lc(x.name) === lc(cn.column))) add('err', where + ': ' + r + ' isn’t in the model export.'); }
  }));
  const plan = kvPlan(kpis, cfg, optionId);
  if (plan.length && !(cfg.table || '').trim()) add('err', 'Type the table the new measures go in (Step 5).');
  const names = kpis.map(k => lc(kvName(k))), dup = names.filter((x, i) => names.indexOf(x) !== i);
  if (dup.length) add('err', 'Two KPIs have the same name: ' + [...new Set(dup)].join(', ') + '. Give each its own label; the new measures are named after it.');
  if (model) {
    const ms = new Map(model.measures.map(m => [lc(m.name), m]));
    const tables = new Set(model.tables.map(t => lc(t.name)));
    const refName = s => { const x = String(s || '').trim(); if (!x || kvIsNumText(x)) return ''; const m = x.match(/\[(.*)\]$/); return m ? m[1] : x; };
    kpis.forEach(k => [k.measure, k.target, k.compare].forEach(r => { const n = refName(r); if (n && !ms.has(lc(n)) && !model.columns.some(c => lc(c.name) === lc(n))) add('warn', bracket(n) + ' isn’t in the model export. Check the name, or ignore this if you’re adding it.'); }));
    if ((cfg.table || '').trim() && !tables.has(lc(cfg.table.trim()))) add('err', 'There’s no table called ' + cfg.table.trim() + ' in the model export.');
    const clash = plan.filter(m => { const e = ms.get(lc(m.name)); return e && lc(e.table) !== lc((cfg.table || '').trim()); });
    if (clash.length) add('err', 'These names are already used by measures in another table: ' + clash.map(m => m.name).join(', ') + '. Change the KPI label so the new names are different.');
    const same = plan.filter(m => { const e = ms.get(lc(m.name)); return e && lc(e.table) === lc((cfg.table || '').trim()); });
    if (same.length) add('warn', 'The script replaces these measures, which are already in ' + cfg.table.trim() + ': ' + same.map(m => m.name).join(', ') + '.');
    const tc = (cfg.trendCol || '').match(/^'?(.*?)'?\[(.*)\]$/);
    if (plan.some(m => /Sparkline/.test(m.name) || m.usesTrend) && tc && !model.columns.some(c => lc(c.table) === lc(tc[1]) && lc(c.name) === lc(tc[2]))) add('err', 'The trend column ' + cfg.trendCol.trim() + ' isn’t in the model export.');
    if (optionId === 'rtable' && tables.has(lc(kvScoreTable(cfg)))) add('warn', 'A table called ' + kvScoreTable(cfg) + ' is already in the model. The script replaces it.');
  }
  if (plan.some(m => /Sparkline/.test(m.name) || m.usesTrend) && /\[[^\]]*\]$/.test(cfg.trendCol || '') && !/month|period|week|quarter|year/i.test((cfg.trendCol.match(/\[([^\]]*)\]$/) || [])[1])) add('info', 'Trend by ' + cfg.trendCol.trim() + ' shows the last ' + (cfg.periods || 12) + ' values of that column (days, if it\u2019s a date). For months, use a column with one date per month, like \'Date\'[Month Start].');
  if (plan.some(m => /Sparkline/.test(m.name) || m.usesTrend) && !/\[.+\]$/.test((cfg.trendCol || '').trim())) add('err', 'Type the trend column as \'Table\'[Column], for example \'Date\'[Month Start].');
  return out;
}
