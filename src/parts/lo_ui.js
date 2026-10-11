
/* ---------- Layout Designer page ---------- */
const $ = id => document.getElementById(id);
const PREFIX = 'klo.';
const store = {
  get(k){ try { return localStorage.getItem(PREFIX + k); } catch (e) { return null; } },
  set(k, v){ try { localStorage.setItem(PREFIX + k, v); } catch (e) {} }
};
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function copyText(text, btn){
  const done = () => { const o = btn.dataset.label || btn.textContent; btn.dataset.label = o; btn.textContent = 'Copied'; btn.classList.add('done'); setTimeout(() => { btn.textContent = o; btn.classList.remove('done'); }, 1600); };
  const fallback = () => { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta); if (ok) done(); };
  try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
}
function download(blob, name){ const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); }
const slug = s => (String(s || 'page').trim() || 'page').replace(/[<>:"\/\\|?*\x00-\x1f]+/g, '-').replace(/\s+/g, ' ');

const COLOR_KEYS = [['page', 'Page'], ['card', 'Cards'], ['header', 'Header'], ['headerText', 'Header text'], ['sidePanel', 'Side panel'], ['text', 'Text'], ['accent', 'Accent']];
const blankLook = () => ({ src: 'tb', themeText: '', pickAccent: '#1F6FB2', overrides: {}, style: { radius: 8, shadow: true, sh: { x: 0, y: 4, blur: 16, spread: 0, color: '#1F3A5F', opacity: 35 }, header: 'band', cards: 'all', border: false }, font: 'Segoe UI' });
const blankCfg = () => LO.fromTemplate('blank');
const EX_CFG = () => LO.fromTemplate('panel');
const state = { sg: LS.blankInput(), zones: false, example: false, cfg: blankCfg(), look: blankLook(), figma: false, sel: null, dims: true, src: null, out: {} };

function persist(){
  store.set('cfg', JSON.stringify(state.example ? null : state.cfg));
  store.set('look', JSON.stringify(state.example ? null : state.look));
  store.set('figma', state.figma ? '1' : '');
}
function setExample(on){ state.example = on; $('exampleBanner').hidden = !on; }
function leaveExample(){ if (state.example) setExample(false); try { localStorage.removeItem(PREFIX + 'blank'); } catch (e) {} }

/* ---------- colors ---------- */
function source(){
  const l = state.look;
  if (l.src === 'tb') { const t = LX.fromThemeBuilder(); return t ? { ok: true, name: t.name, base: t.base } : { ok: false, msg: 'No theme is saved in the Theme Builder in this browser yet, so these are starting colors. Build one in the <a href="theme-builder.html">Theme Builder</a>, or choose another source.', base: LX.suggestedFromAccent(l.pickAccent) }; }
  if (l.src === 'file') {
    if (!(l.themeText || '').trim()) return { ok: false, msg: 'Paste your theme file&rsquo;s JSON below or choose the file.', base: LX.suggestedFromAccent(l.pickAccent) };
    const t = LX.fromThemeJson(l.themeText); return t.error ? { ok: false, err: true, msg: esc(t.error), base: LX.suggestedFromAccent(l.pickAccent) } : { ok: true, name: t.name, base: t.base };
  }
  return { ok: true, name: '', base: LX.suggestedFromAccent(l.pickAccent), pick: true };
}
function colors(){
  const s = state.src = source();
  const b = Object.assign({}, s.base, state.look.overrides);
  return LX.derive(b);
}

/* ---------- step 1 ---------- */
function renderPage(){
  const c = state.cfg, sizes = LO.PAGE_SIZES;
  $('pSize').innerHTML = sizes.map((s, i) => '<option value="' + i + '">' + esc(s[0]) + '</option>').join('') + '<option value="custom">Custom</option>';
  const i = sizes.findIndex(s => s[1] === +c.w && s[2] === +c.h);
  // 'Custom' stays chosen even while the width and height still match a preset
  const custom = state.customSize || i < 0;
  $('pSize').value = custom ? 'custom' : String(i);
  $('customWrap').hidden = $('customWrap2').hidden = !custom;
  const set = (id, v) => { if (document.activeElement !== $(id)) $(id).value = v; };
  set('pName', c.name); set('pW', c.w); set('pH', c.h); set('margin', c.margin); set('gap', c.gap); $('rounding').value = c.rounding;
  const h = c.header, lg = h.logo || (h.logo = { on: false, w: 120, h: 32, src: '', inBg: false });
  $('hdrOn').checked = h.on; set('hdrH', h.h); $('hdrH').disabled = !h.on; $('hdrBox').hidden = !h.on;
  set('hdrTitle', h.title);
  $('logoOn').checked = !!lg.on; set('logoW', Math.round(lg.w)); set('logoH', Math.round(lg.h));
  $('logoOn').closest('.hcol').classList.toggle('off', !lg.on);
  $('logoClear').hidden = $('logoInBgWrap').hidden = !lg.src; $('logoInBg').checked = !!lg.inBg;
  $('logoFileLbl').textContent = lg.src ? 'Replace the image' : 'Add the logo image';
  $('logoInfo').textContent = lg.src ? 'Width and height keep the image\u2019s proportions.' : 'Optional: shows your logo in the drawings.';
  // header image: Colored band and Full-width bar only
  const st = state.look.style, hi = st.hdrImg;
  $('hdrImgWrap').hidden = !(st.header === 'band' || st.header === 'bleed');
  $('hdrImgClear').hidden = !(hi && hi.src);
  $('hdrImgLbl').textContent = hi && hi.src ? 'Replace the image' : 'Use an image';
  if (!state.hdrImgMsg) $('hdrImgInfo').textContent = hi && hi.src ? 'It fills the header, cropped to fit.' : 'Optional: an image instead of the header color.';
  const n = t => (h.items || []).filter(x => x.type === t).length;
  set('hCardN', n('card')); set('hSlicerN', n('slicer'));
  set('hCardW', h.cardW); set('hCardH', h.cardH); set('hSlicerW', h.slicerW); set('hSlicerH', h.slicerH);
  // what fits, from the layout: shown under each column and used as the inputs' maximum
  const lim = (state.L && state.L.limits) || {};
  const limTxt = (id, w, hMax, reqW, reqH, on) => { const el = $(id); if (!on || w == null) { el.textContent = ''; el.classList.remove('hit'); return; }
    const W = Math.max(40, w); el.textContent = 'Up to ' + W + ' \u00d7 ' + hMax + ' px with this header.'; el.classList.toggle('hit', reqW > W || reqH > hMax); };
  limTxt('cardLim', lim.cardMaxW, lim.itemMaxH, h.cardW, h.cardH, n('card') > 0);
  limTxt('slicerLim', lim.slicerMaxW, lim.itemMaxH, h.slicerW, h.slicerH, n('slicer') > 0);
  limTxt('logoLim', lim.logoMaxW, lim.logoMaxH, lg.w, lg.h, lg.on);
  [['hCardW', lim.cardMaxW], ['hSlicerW', lim.slicerMaxW], ['logoW', lim.logoMaxW]].forEach(([id, v]) => { if (v != null) $(id).max = Math.max(40, v); });
  ['hCardH', 'hSlicerH', 'logoH'].forEach(id => { if (lim.itemMaxH) $(id).max = lim.itemMaxH; });
  $('sidePos').value = c.side.pos; set('sideW', c.side.w); set('sideItemH', c.side.itemH); $('sideCfg').hidden = c.side.pos === 'none';
  $('stripOn').checked = c.strip.on; set('stripH', c.strip.h);
  set('cols', c.grid.cols); set('rows', c.grid.rows); $('grow').value = c.grid.grow === 'stretch' ? 'stretch' : 'cells';
  const undo = state.gridUndo && !c.items.length; $('gridClear').textContent = undo ? 'Bring the visuals back' : 'Empty the grid'; $('gridClear').disabled = !undo && !c.items.length;
  $('stripH').disabled = !c.strip.on;
}

/* ---------- step 2: canvas + editor ---------- */
function renderTemplates(){ $('templates').innerHTML = LO.TEMPLATES.map(t => '<button type="button" class="chip" data-tpl="' + t.id + '">' + esc(t.name) + '</button>').join(''); }
function renderCanvas(){
  const L = state.L, col = state.col;
  $('canvas').innerHTML = LR.wireframe(L, state.cfg, Object.assign({}, col), state.look.style, { hit: true, empty: true, grid: true, handles: true, selected: state.sel, dims: state.dims, zones: state.zones, font: state.look.font, ids: false });
  $('layoutMsg').innerHTML = L.probs.map(p => '<div class="msg ' + p.level + '">' + esc(p.text) + '</div>').join('');
}
/* ---------- column widths and row heights ---------- */
// when the column (or row) count changes: visuals that would hang off the grid are trimmed, and (if chosen) visuals that filled the
// whole width or height grow with it, otherwise a new column gets an empty cell in every row;
// spans are worked out from where they were when the field took focus, so typing "12" (1, then 12) doesn't stretch everything on the way.
let spanBase = null;
function fitSpans(ax, to){
  const sp = ax === 'c' ? 'cs' : 'rs', g = state.cfg.grid, k = ax + (state.cfg.items.length);
  if (!spanBase || spanBase.k !== k) spanBase = { k, w: g[ax === 'c' ? 'colW' : 'rowH'], n: +g[ax === 'c' ? 'cols' : 'rows'], spans: state.cfg.items.map(it => Math.max(1, it[sp] || 1)) };
  state.cfg.items.forEach((it, i) => { const at = it[ax], n = spanBase.spans[i];
    it[sp] = state.cfg.grid.grow === 'stretch' && at === 0 && n === spanBase.n ? to : at < to && at + n > to ? to - at : n; });
  // keep the sizes already set; a new column (or row) gets the average share
  const wk = ax === 'c' ? 'colW' : 'rowH', w0 = LO.weightsOf(spanBase.w, spanBase.n);
  if (!w0) g[wk] = null;
  else { const avg = w0.reduce((a, b) => a + b, 0) / w0.length, w = w0.slice(0, to); while (w.length < to) w.push(avg); setW(ax, w.map(v => v / w.reduce((a, b) => a + b, 0) * 100)); }
}
const PRESETS = { 2: [['1/3 + 2/3', [1, 2]], ['2/3 + 1/3', [2, 1]], ['1/4 + 3/4', [1, 3]], ['3/4 + 1/4', [3, 1]]], 3: [['1/2 + 1/4 + 1/4', [2, 1, 1]], ['1/4 + 1/2 + 1/4', [1, 2, 1]], ['1/4 + 1/4 + 1/2', [1, 1, 2]], ['1/6 + 1/3 + 1/2', [1, 2, 3]]], 4: [['2/5 + 1/5 × 3', [2, 1, 1, 1]], ['1/5 × 3 + 2/5', [1, 1, 1, 2]]] };
const AX = { c: ['cols', 'colW'], r: ['rows', 'rowH'] };
// the grid's column (c) or row (r) sizes as percentages that add up to 100
function pcts(ax){ const g = state.cfg.grid, n = +g[AX[ax][0]], w = LO.weightsOf(g[AX[ax][1]], n) || Array(n).fill(1), t = w.reduce((a, b) => a + b, 0); return w.map(v => v / t * 100); }
function setW(ax, arr){ const g = state.cfg.grid; const r = arr.map(v => Math.round(v * 100) / 100); g[AX[ax][1]] = LO.isEven(r) ? null : r; }
// one column (or row) to `pct` %, the others sharing the rest in their current proportions
function setShare(ax, i, pct){
  const p = pcts(ax), n = p.length; if (n < 2) return;
  const v = Math.max(3, Math.min(100 - 3 * (n - 1), pct)), rest = 100 - p[i];
  setW(ax, p.map((x, j) => j === i ? v : rest > 0 ? x / rest * (100 - v) : (100 - v) / (n - 1)));
}
const fmtPct = v => String(Math.round(v * 10) / 10);
function renderSizes(){
  const sum = ax => { const p = pcts(ax); return p.length < 2 ? '1' : LO.isEven(p) ? p.length + ' even' : p.map(v => Math.round(v)).join(' / '); };
  $('sizesSum').textContent = '(columns ' + sum('c') + ', rows ' + sum('r') + ')';
  ['c', 'r'].forEach(ax => {
    const box = $(ax === 'c' ? 'colW' : 'rowH'), p = pcts(ax), n = p.length, name = ax === 'c' ? 'Column' : 'Row';
    const a = document.activeElement;
    if (a && box.contains(a) && a.matches('input')) { box.querySelectorAll('input[data-i]').forEach(el => { if (el !== a) el.value = fmtPct(p[+el.dataset.i]); }); return; }
    if (n < 2) { box.innerHTML = '<span class="small muted">One ' + name.toLowerCase() + ': it fills the grid.</span>'; return; }
    const g = state.cfg.grid, cur = LO.weightsOf(g[AX[ax][1]], n);
    const same = w => { if (!cur) return false; const t = w.reduce((x, y) => x + y, 0), tc = cur.reduce((x, y) => x + y, 0); return w.every((v, j) => Math.abs(v / t - cur[j] / tc) < 0.002); };
    box.innerHTML = p.map((v, i) => '<label class="wt"><span class="small muted">' + (i + 1) + '</span><input type="number" data-ax="' + ax + '" data-i="' + i + '" min="3" max="' + (100 - 3 * (n - 1)) + '" step="any" value="' + fmtPct(v) + '" aria-label="' + name + ' ' + (i + 1) + ' (% of the grid)"></label>').join('')
      + '<span class="chips sm"><button type="button" class="chip' + (!cur ? ' on' : '') + '" data-ax="' + ax + '" data-pre="even">Even</button>' + (PRESETS[n] || []).map(([lbl, w]) => '<button type="button" class="chip" aria-pressed="' + same(w) + '" data-ax="' + ax + '" data-pre="' + w.join(',') + '">' + esc(lbl) + '</button>').join('') + '</span>';
  });
}
// drag a handle between two columns (or rows) to share their room differently
function moveGutter(ax, i, toPx, free){
  const G = state.L.grid, gap = +state.cfg.gap || 0, p = pcts(ax);
  const availPx = (ax === 'c' ? G.w : G.h).reduce((a, b) => a + b, 0); if (availPx <= 0) return;
  const start = p.slice(0, i).reduce((a, b) => a + b, 0), end = start + p[i] + p[i + 1];
  // where the pointer is, as % of the grid's room (gaps left out)
  let b = (toPx - gap / 2 - (ax === 'c' ? G.x[0] : G.y[0]) - gap * i) / availPx * 100;
  if (!free) b = Math.round(b / (100 / 12)) * (100 / 12);
  const min = Math.max(free ? 1 : 100 / 12, 40 / availPx * 100);
  if (end - start < 2 * min) return;
  b = Math.max(start + min, Math.min(end - min, b));
  const q = p.slice(); q[i] = b - start; q[i + 1] = end - b; setW(ax, q);
}
function typeSelect(id, cur, only){
  const list = only ? LO.TYPES.filter(t => only.includes(t[0])) : LO.TYPES;
  return '<select id="' + id + '">' + list.map(t => '<option value="' + t[0] + '"' + (t[0] === cur ? ' selected' : '') + '>' + esc(t[1]) + '</option>').join('') + '</select>';
}
function selItem(){
  const s = state.sel, c = state.cfg; if (!s) return null;
  if (s === 'header') return c.header.on ? { region: 'header', item: c.header } : null;
  const i = +s.slice(1), arr = s[0] === 'g' ? c.items : s[0] === 't' ? c.strip.items : s[0] === 's' ? c.side.items : s[0] === 'h' ? (c.header.items = c.header.items || []) : null;
  return arr && arr[i] ? { region: s[0], i, item: arr[i], arr } : null;
}
function renderEditor(){
  const c = state.cfg, s = selItem();
  const quick = '<div class="quick">' + (c.strip.on ? '<button type="button" class="btn small" data-act="addStrip">+ Card in the strip</button>' : '') + (c.side.pos !== 'none' ? '<button type="button" class="btn small" data-act="addSide">+ Item in the side panel</button>' : '') + '</div>';
  if (!s) { state.sel = null; $('editor').innerHTML = '<h3>Edit</h3><p class="note small">Click a visual on the page to change its type, title or span, or click an empty cell to add a visual there.</p>' + quick; return; }
  if (s.region === 'header') { $('editor').innerHTML = '<h3>Header</h3><div class="field"><label for="edTitle">Title</label><input type="text" id="edTitle" value="' + esc(c.header.title || '') + '" autocomplete="off"></div><p class="note small">Its height is in Step 1.</p>' + quick; return; }
  const it = s.item, where = s.region === 'g' ? 'Grid' : s.region === 't' ? 'Card strip' : s.region === 'h' ? 'Header' : 'Side panel';
  let h = '<h3>' + (s.region === 'h' ? 'Header ' + (it.type === 'card' ? 'card' : 'slicer') : where + ' visual') + '</h3>'
    + (s.region === 'h' ? '<p class="note small">Header items are cards or slicers. Change how many of each in Step 1.</p>' : '<div class="field"><label for="edType">Visual</label>' + typeSelect('edType', it.type) + '</div>')
    + '<div class="field"><label for="edTitle">Title</label><input type="text" id="edTitle" value="' + esc(it.title || '') + '" autocomplete="off"></div>';
  if (s.region === 'g') {
    const g = c.grid;
    h += '<div class="grid2e"><div class="field"><label for="edC">Column</label><input type="number" id="edC" min="1" max="' + g.cols + '" value="' + (it.c + 1) + '"></div><div class="field"><label for="edR">Row</label><input type="number" id="edR" min="1" max="' + g.rows + '" value="' + (it.r + 1) + '"></div>'
      + '<div class="field"><label for="edCs">Columns wide</label><input type="number" id="edCs" min="1" max="' + g.cols + '" value="' + it.cs + '"></div><div class="field"><label for="edRs">Rows tall</label><input type="number" id="edRs" min="1" max="' + g.rows + '" value="' + it.rs + '"></div></div>';
  }
  h += '<div class="btns">' + (s.region !== 'g' ? '<button type="button" class="btn small" data-act="left" aria-label="Move earlier">&uarr; Earlier</button><button type="button" class="btn small" data-act="right" aria-label="Move later">&darr; Later</button>' : '') + '<button type="button" class="btn small danger-t" data-act="del">Remove</button></div>';
  const o = state.L.items.find(x => x.id === state.sel);
  if (o) h += '<p class="note small mono">x ' + Math.round(o.x * 100) / 100 + ', y ' + Math.round(o.y * 100) / 100 + ' &middot; ' + Math.round(o.w * 100) / 100 + ' &times; ' + Math.round(o.h * 100) / 100 + '</p>';
  $('editor').innerHTML = h + quick;
}

/* ---------- 3-30-300 suggestions ---------- */
// say what the 300 s choice adds, and point out a table already in the list that may be the details
function renderSgNote(){
  const g = state.sg, tbl = (g.visuals || []).find(v => v.type === 'tableEx' || v.type === 'pivotTable');
  $('sgDNote').textContent = g.detail === 'page' ? (g.detailTitle ? 'Your details table “' + g.detailTitle + '” goes on this page.' : 'Adds a details table to this page, on top of your visuals.') + (tbl && !g.detailTitle ? ' If “' + (tbl.title || 'your table') + '” is your details table, choose Not needed.' : '') : g.detail === 'drill' ? 'Nothing extra on this page; lay out the drill-through page after.' : '';
}
function renderSuggestInputs(){
  const g = state.sg, set = (id, v) => { if (document.activeElement !== $(id)) $(id).value = v; };
  set('sgK', g.kpis); $('sgT').value = g.targets;
  $('sgD').value = g.detail; set('sgRows', g.detailRows); $('sgRowsWrap').hidden = g.detail !== 'page';
  renderSgNote();
  set('sgF', g.filters); $('sgP').value = g.filterPlace;
  renderSgList();
}
function sgHint(v){
  const t = LS.vt(v.type), nd = LS.need(v), k = LS.shownOf(v);
  return 'Needs about ' + nd.w + ' × ' + nd.h + ' px' + (t.scrolls && k < +v.n ? ', showing ' + k + ' of ' + v.n + ' ' + t.unit + ' (the rest scroll)' : '') + '.' + (nd.tips.length && !(t.scrolls && k < +v.n && nd.tips.length === 1) ? ' ' + nd.tips[nd.tips.length - 1].replace(/^“[^”]*”:? ?/, '').replace(/^./, c => c.toUpperCase()) : '');
}
function renderSgList(){
  const list = state.sg.visuals, box = $('sgList');
  const a = document.activeElement;
  if (a && box.contains(a) && a.matches('input')) { box.querySelectorAll('[data-hint]').forEach(el => { const v = list[+el.dataset.hint]; if (v) el.textContent = sgHint(v); }); return; }
  box.innerHTML = list.length ? list.map((v, i) => { const t = LS.vt(v.type);
    return '<div class="sgv" data-i="' + i + '">'
      + '<div class="field"><label for="sgvType' + i + '">Visual</label><select id="sgvType' + i + '" data-k="type">' + LS.VTYPES.map(x => '<option value="' + x[0] + '"' + (x[0] === v.type ? ' selected' : '') + '>' + esc(x[1]) + '</option>').join('') + '</select></div>'
      + '<div class="field grow"><label for="sgvTitle' + i + '">Title</label><input type="text" id="sgvTitle' + i + '" data-k="title" value="' + esc(v.title) + '" autocomplete="off"></div>'
      + '<div class="field sm"><label for="sgvN' + i + '">Categories <span class="muted">(' + t.unit + ')</span></label><input type="number" id="sgvN' + i + '" data-k="n" min="1" max="500" value="' + esc(v.n) + '"></div>'
      + '<div class="field sm"><label for="sgvShow' + i + '">Before scrolling</label><input type="number" id="sgvShow' + i + '" data-k="show" min="1" max="500" value="' + (t.scrolls ? esc(v.show) : '') + '" placeholder="' + (t.scrolls ? 'All' : 'n/a') + '"' + (t.scrolls ? '' : ' disabled') + '></div>'
      + '<button type="button" class="btn small danger-t" data-rm="' + i + '" aria-label="Remove ' + esc(v.title || t.label) + '">Remove</button>'
      + '<p class="small muted hint" data-hint="' + i + '">' + esc(sgHint(v)) + '</p>'
      // a table or matrix is usually the 300-second details, not a 30-second pattern: ask
      + ((v.type === 'tableEx' || v.type === 'pivotTable') && !v.ok30 ? '<div class="sg-ask msg info"><span>Is “' + esc(v.title || t.label) + '” your 300 s details (individual records)? In the 30 s level a ' + (v.type === 'pivotTable' ? 'matrix works as a heatmap' : 'table usually slows people down') + '.</span><span class="btns"><button type="button" class="btn small primary" data-as300="' + i + '">Yes, make it the details</button><button type="button" class="btn small" data-keep30="' + i + '">No, keep it here</button></span></div>' : '')
      + '</div>'; }).join('') : '<p class="small muted">No visuals yet. Add the charts this page needs.</p>';
  $('sgAdd').disabled = list.length >= 8;
}
function renderSuggestions(){
  const list = state.sgOut; if (!list) { $('sgOut').innerHTML = ''; return; }
  const col = state.col, st = state.look.style, zc = { '3 s': 'z3', '30 s': 'z30', '300 s': 'z300', 'Page': 'zpg' };
  const tips = (list[0] && list[0].tips) || [];
  let h = '<p class="sg-head note small"><b>These update as you change your answers.</b> Your page below changes only when you click <b>Use this layout</b>.</p>';
  h += tips.length ? '<div class="sg-tips"><h4>Design tips for your visuals</h4><ul>' + tips.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>' : '';
  h += list.map((v, i) => {
    const L = LO.layout(v.cfg), svg = LR.wireframe(L, v.cfg, col, st, { zones: true, font: state.look.font, ids: false });
    return '<div class="sg' + (v.recommended ? ' rec' : '') + '"><h4>' + esc(v.name) + (v.recommended ? '<span class="rec-tag">Best fit</span>' : '') + '</h4><p class="blurb">' + esc(v.blurb) + '</p>' + svg
      + '<ul>' + v.why.map(([z, t]) => '<li><b class="' + (zc[z] || 'zpg') + '">' + z + '</b>' + esc(t) + '</li>').join('') + '</ul>'
      + (v.probs || []).map(p => '<div class="msg ' + p.level + '">' + esc(p.text) + '</div>').join('')
      + '<div class="btns"><button type="button" class="btn' + (v.recommended ? ' primary' : '') + '" data-usesg="' + i + '">Use this layout</button></div></div>';
  }).join('');
  if (state.sg.detail === 'drill' || (state.sg.detail === 'page' && list.some(v => v.drill))) h += '<div class="msg info sg-note">For the 300-second level, build a drill-through page next: <button type="button" class="btn small" id="sgDetail">Start the detail page</button> lays out a details matrix with a filter panel. In Power BI Desktop, add the fields people drill on to the page&rsquo;s <b>Drill through</b> well.</div>';
  $('sgOut').innerHTML = h;
}

/* ---------- step 3 ---------- */
function renderLook(){
  const l = state.look, s = state.src || source(), col = state.col;
  $('colorSrc').value = l.src; $('font').value = l.font;
  let box = '';
  if (l.src === 'file') box += '<div class="field"><label for="themeText">Theme JSON <span class="muted">(paste, or choose the file)</span></label><textarea id="themeText" class="mid" spellcheck="false" placeholder="{ &quot;name&quot;: &quot;My theme&quot;, &quot;dataColors&quot;: [ … ] }">' + esc(l.themeText || '') + '</textarea><div><input type="file" id="themeFile" accept=".json,application/json"></div></div>';
  if (l.src === 'pick') box += '<p class="note small">Pick an accent below; the page, cards and chart colors are suggested from it.</p>';
  if (s.msg) box += '<div class="msg ' + (s.err ? 'err' : 'info') + '">' + s.msg + '</div>';
  else if (s.name) box += '<div class="msg ok">&#10003; Colors from <b>' + esc(s.name) + '</b>' + (s.base.data ? ', ' + s.base.data.length + ' data colors' : '') + '.</div>';
  if (document.activeElement && document.activeElement.id === 'themeText') { const m = $('srcBox').querySelector('.msg'); const n = document.createElement('div'); n.innerHTML = s.msg ? '<div class="msg ' + (s.err ? 'err' : 'info') + '">' + s.msg + '</div>' : (s.name ? '<div class="msg ok">&#10003; Colors from <b>' + esc(s.name) + '</b>.</div>' : ''); if (m) m.replaceWith(...n.childNodes); else $('srcBox').append(...n.childNodes); }
  else $('srcBox').innerHTML = box;
  renderColors();
  const st = l.style; $('radius').value = st.radius; $('hdrStyle').value = st.header; $('cards').value = st.cards; $('border').checked = !!st.border;
  const sh = LR.shadowOf(st); $('shOn').checked = !!st.shadow; $('shCfg').hidden = !st.shadow;
  const setv = (id, v) => { if (document.activeElement !== $(id)) $(id).value = v; };
  setv('shX', sh.x); setv('shY', sh.y); setv('shBlur', sh.blur); setv('shSpread', sh.spread); setv('shColor', sh.color); $('shColorPick').value = TB.norm(sh.color) || '#1F3A5F'; setv('shOp', sh.opacity);
  $('figmaOn').checked = state.figma; document.body.classList.toggle('figma', state.figma);
}
function renderColors(){
  const col = state.col, ov = state.look.overrides;
  const keys = COLOR_KEYS.map(([k, n]) => [k, n, k === 'accent' && state.look.src === 'pick' ? (ov.accent || state.look.pickAccent) : col[k]]);
  const html = keys.map(([k, n, v]) => '<div class="crow' + (ov[k] ? ' changed' : '') + '"><label class="cpick"><input type="color" data-c="' + k + '" value="' + esc(v) + '" aria-label="' + esc(n) + '"></label><span class="cmeta"><span class="clabel">' + esc(n) + '</span><input type="text" class="hex" data-h="' + k + '" value="' + esc(v) + '" spellcheck="false" aria-label="' + esc(n) + ' hex code"></span></div>').join('')
    + '<div class="sw-data">' + col.data.slice(0, 8).map(d => '<span style="background:' + d + '" title="' + d + '"></span>').join('') + '<span class="small muted">chart colors</span></div>'
    + (Object.keys(ov).length ? '<button type="button" class="linkbtn" id="resetColors">Undo my color changes</button>' : '');
  // update in place when a color box has focus
  const a = document.activeElement;
  if (a && (a.dataset.c || a.dataset.h) && $('colors').contains(a)) {
    keys.forEach(([k, n, v]) => { document.querySelectorAll('[data-c="' + k + '"],[data-h="' + k + '"]').forEach(el => { if (el !== a) el.value = v; }); const r = document.querySelector('[data-c="' + k + '"]'); if (r) r.closest('.crow').classList.toggle('changed', !!ov[k]); });
  } else $('colors').innerHTML = html;
}

/* ---------- step 4 ---------- */
function renderOut(){
  const L = state.L, c = state.cfg, col = state.col, st = state.look.style;
  state.out.wf = LR.wireframe(L, c, col, st, { font: state.look.font });
  state.out.bg = LR.background(L, c, col, st, { font: state.look.font });
  state.out.tsv = LO.positionsTsv(L, st);
  $('wfThumb').innerHTML = state.out.wf; $('bgThumb').innerHTML = state.out.bg;
  const rows = state.out.tsv.split('\n').map(r => r.split('\t'));
  $('posTable').innerHTML = '<thead><tr>' + rows[0].map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' + rows.slice(1).map(r => '<tr>' + r.map((v, i) => '<td' + (i > 1 ? ' class="num"' : '') + '>' + esc(v) + '</td>').join('') + '</tr>').join('') + '</tbody>';
}

const _mctx = document.createElement('canvas').getContext('2d');
LO.setMeasure((text, size) => { _mctx.font = '700 ' + size + 'px "' + (state.look.font || 'Segoe UI') + '", "Segoe UI", Arial, sans-serif'; return _mctx.measureText(String(text)).width + 4; });
function compute(){ state.col = colors(); state.L = LO.layout(state.cfg); }
function renderAll(){ compute(); renderPage(); renderCanvas(); renderSizes(); renderEditor(); renderLook(); renderOut(); }
function refresh(opts){ compute(); renderPage(); renderCanvas(); renderSizes(); if (opts && opts.editor) renderEditor(); if (opts && opts.look) renderLook(); else renderColors(); renderOut(); persist(); }

/* ---------- init ---------- */
function resetAll(){ state.customSize = false; state.cfg = blankCfg(); state.look = blankLook(); state.sel = null; setExample(false); renderAll(); }
function init(){
  renderTemplates();
  let cfg = null, look = null; try { cfg = JSON.parse(store.get('cfg') || 'null'); look = JSON.parse(store.get('look') || 'null'); } catch (e) {}
  state.figma = store.get('figma') === '1';
  if (cfg) { state.cfg = LO.upgrade(Object.assign(LO.base(), cfg)); if (look) state.look = Object.assign(blankLook(), look); }
  else if (store.get('blank') !== '1') { state.cfg = EX_CFG(); setExample(true); }
  if (!cfg && look) state.look = Object.assign(blankLook(), look);
  // older saved looks: shadow was 'soft' / 'strong'
  if (typeof state.look.style.shadow === 'string') { state.look.style.shadow = !!state.look.style.shadow; state.look.style.sh = state.look.style.sh || Object.assign({}, LR.SH_DEFAULT); }
  try { const g = JSON.parse(store.get('sg') || 'null'); if (g) state.sg = LS.normInput(g); } catch (e) {}
  if (!cfg) $('suggestBox').open = true;
  renderAll(); renderSuggestInputs();
  // logos saved before they were stored as PNG or JPEG: convert once, so Figma and PowerPoint get them
  const lg0 = state.cfg.header && state.cfg.header.logo;
  if (lg0 && lg0.src && !/^data:image\/(png|jpe?g)/i.test(lg0.src)) LX.readImage(lg0.src, 1200).then(im => { lg0.src = im.src; refresh(); }, () => {});

  const num = (v, d) => { const n = parseFloat(v); return isNaN(n) ? d : n; };
  const edited = opts => { leaveExample(); refresh(opts); };
  // step 1
  $('pName').addEventListener('input', () => { state.cfg.name = $('pName').value; edited(); });
  $('pSize').addEventListener('change', () => { const v = $('pSize').value; state.customSize = v === 'custom'; if (v !== 'custom') { const s = LO.PAGE_SIZES[+v]; state.cfg.w = s[1]; state.cfg.h = s[2]; } $('customWrap').hidden = $('customWrap2').hidden = v !== 'custom'; edited(); });
  [['pW', 'w', 1280], ['pH', 'h', 720], ['margin', 'margin', 10], ['gap', 'gap', 10]].forEach(([id, k, d]) => $(id).addEventListener('input', () => { state.cfg[k] = Math.max(0, num($(id).value, d)); edited(); }));
  $('rounding').addEventListener('change', () => { state.cfg.rounding = $('rounding').value; edited(); });
  $('hdrOn').addEventListener('change', () => { state.cfg.header.on = $('hdrOn').checked; edited({ editor: true }); });
  $('hdrH').addEventListener('input', () => { state.cfg.header.h = Math.max(10, num($('hdrH').value, 50)); edited(); });
  $('hdrTitle').addEventListener('input', () => { state.cfg.header.title = $('hdrTitle').value; edited(); });
  $('hCardN').addEventListener('input', () => { LO.setHeaderCounts(state.cfg.header, num($('hCardN').value, 0), (state.cfg.header.items || []).filter(x => x.type === 'slicer').length); state.sel = null; edited({ editor: true }); });
  $('hSlicerN').addEventListener('input', () => { LO.setHeaderCounts(state.cfg.header, (state.cfg.header.items || []).filter(x => x.type === 'card').length, num($('hSlicerN').value, 0)); state.sel = null; edited({ editor: true }); });
  [['hCardW', 'cardW', 150, 40], ['hCardH', 'cardH', 40, 16], ['hSlicerW', 'slicerW', 180, 40], ['hSlicerH', 'slicerH', 32, 16]].forEach(([id, k, d, min]) => $(id).addEventListener('input', () => { state.cfg.header[k] = Math.max(min, num($(id).value, d)); edited(); }));
  const clampTo = (id, k, obj) => $(id).addEventListener('change', () => { const mx = +$(id).max; const o = obj(); if (mx && o[k] > mx) { o[k] = mx; edited(); } });
  clampTo('hCardW', 'cardW', () => state.cfg.header); clampTo('hCardH', 'cardH', () => state.cfg.header);
  clampTo('hSlicerW', 'slicerW', () => state.cfg.header); clampTo('hSlicerH', 'slicerH', () => state.cfg.header);
  $('logoW').addEventListener('change', () => { const lg = state.cfg.header.logo, mx = +$('logoW').max; if (mx && lg.w > mx) { const k = mx / lg.w; lg.w = mx; lg.h = Math.round(lg.h * k); edited(); } });
  $('logoH').addEventListener('change', () => { const lg = state.cfg.header.logo, mx = +$('logoH').max; if (mx && lg.h > mx) { const k = mx / lg.h; lg.h = mx; lg.w = Math.round(lg.w * k); edited(); } });
  $('logoOn').addEventListener('change', () => { state.cfg.header.logo.on = $('logoOn').checked; edited(); });
  // with an image, width and height keep its proportions
  $('logoW').addEventListener('input', () => { const lg = state.cfg.header.logo; lg.w = Math.max(8, num($('logoW').value, 120)); if (lg.src && lg.ratio) { lg.h = Math.max(8, Math.round(lg.w / lg.ratio)); $('logoH').value = lg.h; } edited(); });
  $('logoH').addEventListener('input', () => { const lg = state.cfg.header.logo; lg.h = Math.max(8, num($('logoH').value, 32)); if (lg.src && lg.ratio) { lg.w = Math.max(8, Math.round(lg.h * lg.ratio)); $('logoW').value = lg.w; } edited(); });
  $('logoInBg').addEventListener('change', () => { state.cfg.header.logo.inBg = $('logoInBg').checked; edited(); });
  $('logoClear').addEventListener('click', () => { state.cfg.header.logo.src = ''; state.cfg.header.logo.ratio = 0; state.cfg.header.logo.inBg = false; $('logoFile').value = ''; edited(); });
  $('logoFile').addEventListener('change', () => {
    const file = $('logoFile').files[0]; if (!file) return;
    if (file.size > 1024 * 1024) { $('logoInfo').textContent = 'That image is over 1 MB. Use a smaller PNG or an SVG.'; $('logoFile').value = ''; return; }
    const rd = new FileReader();
    // stored as PNG or JPEG so Figma and PowerPoint take it; keep the height, set the width from the image's proportions
    rd.onload = () => LX.readImage(rd.result, 1200).then(im => { const lg = state.cfg.header.logo; lg.src = im.src; lg.ratio = im.w / im.h; lg.w = Math.round(lg.h * lg.ratio); edited(); },
      err => { $('logoInfo').textContent = err.message; });
    rd.readAsDataURL(file);
  });
  $('hdrImgFile').addEventListener('change', () => {
    const file = $('hdrImgFile').files[0]; if (!file) return;
    const say = t => { state.hdrImgMsg = !!t; $('hdrImgInfo').textContent = t; };
    if (file.size > 5 * 1024 * 1024) { say('That image is over 5 MB. Use a smaller one.'); $('hdrImgFile').value = ''; return; }
    const rd = new FileReader();
    rd.onload = () => LX.readImage(rd.result, 2560).then(im => {
      say(''); state.look.style.hdrImg = im; edited();
      if ((store.get('look') || '').indexOf(im.src) < 0) say('It shows here, but it\u2019s too big to keep after you close the page. Use a smaller image to keep it.');
    }, err => say(err.message));
    rd.readAsDataURL(file);
  });
  $('hdrImgClear').addEventListener('click', () => { delete state.look.style.hdrImg; state.hdrImgMsg = false; $('hdrImgFile').value = ''; edited(); });
  $('sidePos').addEventListener('change', () => { state.cfg.side.pos = $('sidePos').value; if (state.cfg.side.pos !== 'none' && !state.cfg.side.items.length) state.cfg.side.items = [{ type: 'slicer', title: 'Year' }, { type: 'slicer', title: 'Region' }]; edited({ editor: true }); });
  $('sideW').addEventListener('input', () => { state.cfg.side.w = Math.max(40, num($('sideW').value, 220)); edited(); });
  $('sideItemH').addEventListener('input', () => { state.cfg.side.itemH = Math.max(16, num($('sideItemH').value, 64)); edited(); });
  $('stripOn').addEventListener('change', () => { state.cfg.strip.on = $('stripOn').checked; if (state.cfg.strip.on && !state.cfg.strip.items.length) state.cfg.strip.items = [{ type: 'card', title: 'Sales' }, { type: 'card', title: 'Orders' }, { type: 'card', title: 'Customers' }]; edited({ editor: true }); });
  $('stripH').addEventListener('input', () => { state.cfg.strip.h = Math.max(20, num($('stripH').value, 100)); edited(); });
  // step 2
  $('templates').addEventListener('click', e => { const b = e.target.closest('[data-tpl]'); if (!b) return; state.gridUndo = null; state.cfg = LO.fromTemplate(b.dataset.tpl, state.cfg); state.sel = null; edited({ editor: true }); });
  ['cols', 'rows'].forEach(id => $(id).addEventListener('focus', () => { spanBase = null; }));
  $('sizesBox').open = store.get('sizesOpen') === '1';
  $('sizesBox').addEventListener('toggle', () => store.set('sizesOpen', $('sizesBox').open ? '1' : ''));
  $('grow').addEventListener('change', () => { state.cfg.grid.grow = $('grow').value; spanBase = null; edited(); });
  // empty the grid (visuals and sizes) but keep the columns, rows, header, strip and side panel; once, it can be undone
  $('gridClear').addEventListener('click', () => { const g = state.cfg.grid;
    if (state.gridUndo && !state.cfg.items.length) { const u = state.gridUndo; Object.assign(g, u.grid); state.cfg.items = u.items; state.gridUndo = null; }
    else { state.gridUndo = { grid: JSON.parse(JSON.stringify(g)), items: state.cfg.items }; state.cfg.items = []; g.colW = g.rowH = null; }
    state.sel = null; edited({ editor: true }); });
  $('cols').addEventListener('input', () => { const g = state.cfg.grid, n = Math.min(12, Math.max(1, Math.round(num($('cols').value, 3)))); if (n !== g.cols) fitSpans('c', n); g.cols = n; edited({ editor: true }); });
  $('rows').addEventListener('input', () => { const g = state.cfg.grid, n = Math.min(12, Math.max(1, Math.round(num($('rows').value, 2)))); if (n !== g.rows) fitSpans('r', n); g.rows = n; edited({ editor: true }); });
  // column widths and row heights: typed, presets, or dragged on the canvas
  ['colW', 'rowH'].forEach(id => {
    $(id).addEventListener('input', e => { const t = e.target; if (!t.dataset.ax) return; const v = parseFloat(t.value); if (isNaN(v)) return; setShare(t.dataset.ax, +t.dataset.i, v); edited(); });
    $(id).addEventListener('change', e => { if (e.target.dataset.ax) { const a = e.target; a.blur(); renderSizes(); const n = $(id).querySelector('[data-i="' + a.dataset.i + '"]'); if (n) n.focus(); } });
    $(id).addEventListener('click', e => { const b = e.target.closest('[data-pre]'); if (!b) return; const ax = b.dataset.ax; if (b.dataset.pre === 'even') state.cfg.grid[AX[ax][1]] = null; else setW(ax, b.dataset.pre.split(',').map(Number)); edited(); });
  });
  let drag = null, raf = 0;
  const svgPt = e => { const sv = $('canvas').querySelector('svg'), r = sv.getBoundingClientRect(); return { x: (e.clientX - r.left) * state.cfg.w / r.width, y: (e.clientY - r.top) * state.cfg.h / r.height }; };
  $('canvas').addEventListener('pointerdown', e => { const h = e.target.closest('[data-gut]'); if (!h) return; e.preventDefault(); drag = { ax: h.dataset.gut[0], i: +h.dataset.gut.slice(1) }; document.body.classList.add('dragging', drag.ax === 'c' ? 'drag-c' : 'drag-r'); });
  window.addEventListener('pointermove', e => { if (!drag) return; const pt = svgPt(e), free = e.shiftKey; cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (!drag) return; moveGutter(drag.ax, drag.i, drag.ax === 'c' ? pt.x : pt.y, free); compute(); renderCanvas(); renderSizes(); }); });
  const endDrag = () => { if (!drag) return; drag = null; document.body.classList.remove('dragging', 'drag-c', 'drag-r'); edited(); };
  window.addEventListener('pointerup', endDrag); window.addEventListener('pointercancel', endDrag);
  $('canvas').addEventListener('keydown', e => {
    const h = e.target.closest('[data-gut]'); if (!h) return; const ax = h.dataset.gut[0], i = +h.dataset.gut.slice(1);
    const dir = (ax === 'c' ? { ArrowLeft: -1, ArrowRight: 1 } : { ArrowUp: -1, ArrowDown: 1 })[e.key]; if (!dir) return; e.preventDefault();
    const p = pcts(ax), b = p.slice(0, i + 1).reduce((x, y) => x + y, 0), step = 100 / 12;
    const nb = e.shiftKey ? b + dir : (dir > 0 ? Math.floor(b / step + 1e-6) + 1 : Math.ceil(b / step - 1e-6) - 1) * step;
    const G = state.L.grid, gap = +state.cfg.gap || 0;
    moveGutter(ax, i, (ax === 'c' ? G.x[0] : G.y[0]) + gap * i + gap / 2 + nb / 100 * (ax === 'c' ? G.w : G.h).reduce((x, y) => x + y, 0), e.shiftKey);
    edited(); const n = $('canvas').querySelector('[data-gut="' + ax + i + '"]'); if (n) n.focus();
  });
  $('showDims').addEventListener('change', () => { state.dims = $('showDims').checked; renderCanvas(); });
  const pick = el => {
    const v = el.closest('[data-id]'), cell = el.closest('[data-cell]');
    if (v && v.dataset.id === 'logo') { $('logoW').focus(); return true; }
    if (v) { state.sel = v.dataset.id === state.sel ? null : v.dataset.id; renderCanvas(); renderEditor(); const t = $('edType') || $('edTitle'); if (t && state.sel) t.focus(); return true; }
    if (cell) { const [a, b] = cell.dataset.cell.split(',').map(Number); state.cfg.items.push({ type: 'clusteredColumnChart', title: 'New visual', c: a, r: b, cs: 1, rs: 1 }); state.sel = 'g' + (state.cfg.items.length - 1); edited({ editor: true }); const t = $('edType'); if (t) t.focus(); return true; }
    return false;
  };
  $('canvas').addEventListener('click', e => pick(e.target));
  $('canvas').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && pick(e.target)) e.preventDefault(); });
  $('editor').addEventListener('input', e => {
    const s = selItem(); if (!s) return; const t = e.target;
    if (t.id === 'edTitle') { if (s.region === 'header') state.cfg.header.title = t.value; else s.item.title = t.value; edited(); }
    else if (['edC', 'edR', 'edCs', 'edRs'].includes(t.id)) { const v = Math.max(1, Math.round(num(t.value, 1))); if (t.id === 'edC') s.item.c = v - 1; if (t.id === 'edR') s.item.r = v - 1; if (t.id === 'edCs') s.item.cs = v; if (t.id === 'edRs') s.item.rs = v; edited(); }
  });
  $('editor').addEventListener('change', e => { const s = selItem(); if (s && e.target.id === 'edType') { s.item.type = e.target.value; edited(); } });
  $('editor').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act, c = state.cfg, s = selItem();
    if (a === 'addStrip') { c.strip.items.push({ type: 'card', title: 'New card' }); state.sel = 't' + (c.strip.items.length - 1); }
    else if (a === 'addSide') { c.side.items.push({ type: 'slicer', title: 'New slicer' }); state.sel = 's' + (c.side.items.length - 1); }
    else if (s && a === 'del') { s.arr.splice(s.i, 1); state.sel = null; }
    else if (s && (a === 'left' || a === 'right')) { const j = s.i + (a === 'left' ? -1 : 1); if (j >= 0 && j < s.arr.length) { [s.arr[j], s.arr[s.i]] = [s.arr[s.i], s.arr[j]]; state.sel = state.sel[0] + j; } }
    edited({ editor: true });
    if (/^add/.test(a) && $('edTitle')) { $('edTitle').focus(); $('edTitle').select(); }
  });
  // 3-30-300 suggestions
  const sgSaved = () => { store.set('sg', JSON.stringify(state.sg)); renderSgNote(); state.sgOut = LS.suggest(state.sg, state.cfg); renderSuggestions(); };
  const sgChange = () => { const g = state.sg;
    g.kpis = Math.max(0, Math.min(8, num($('sgK').value, 4))); g.targets = $('sgT').value;
    if ($('sgD').value !== 'page') g.detailTitle = ''; g.detail = $('sgD').value; g.detailRows = Math.max(3, Math.min(50, num($('sgRows').value, 10))); g.filters = Math.max(0, Math.min(8, num($('sgF').value, 3))); g.filterPlace = $('sgP').value;
    renderSuggestInputs(); sgSaved(); };
  ['sgK', 'sgF', 'sgRows'].forEach(id => $(id).addEventListener('input', sgChange));
  ['sgT', 'sgD', 'sgP'].forEach(id => $(id).addEventListener('change', sgChange));
  $('sgList').addEventListener('input', e => {
    const t = e.target, row = t.closest('[data-i]'); if (!row || !t.dataset.k) return; const v = state.sg.visuals[+row.dataset.i]; if (!v) return;
    const k = t.dataset.k;
    if (k === 'title') v.title = t.value;
    else if (k === 'n') v.n = Math.max(1, Math.min(500, Math.round(num(t.value, 1))));
    else if (k === 'show') v.show = t.value === '' ? '' : Math.max(1, Math.min(500, Math.round(num(t.value, 1))));
    else return;
    renderSgList(); sgSaved();
  });
  $('sgList').addEventListener('change', e => {
    const t = e.target, row = t.closest('[data-i]'); if (!row) return; const i = +row.dataset.i, v = state.sg.visuals[i]; if (!v) return;
    if (t.dataset.k === 'type') { v.type = t.value; v.ok30 = false; if (!LS.vt(v.type).scrolls) v.show = ''; if ($('sgList').contains(document.activeElement)) document.activeElement.blur(); renderSgList(); sgSaved(); const n = $('sgvType' + i); if (n) n.focus(); }
  });
  $('sgList').addEventListener('click', e => {
    const y = e.target.closest('[data-as300]'), k = e.target.closest('[data-keep30]'), g = state.sg;
    // move it to the 300 s box: details on this page, named and sized from it
    if (y) { const v = g.visuals.splice(+y.dataset.as300, 1)[0]; g.detail = 'page'; g.detailTitle = v.title || ''; g.detailRows = Math.max(3, Math.min(50, +v.show || +v.n || 10)); renderSuggestInputs(); sgSaved(); $('sgD').focus(); return; }
    if (k) { g.visuals[+k.dataset.keep30].ok30 = true; renderSgList(); sgSaved(); return; }
    const b = e.target.closest('[data-rm]'); if (!b) return; state.sg.visuals.splice(+b.dataset.rm, 1); renderSgList(); sgSaved(); const n = $('sgList').querySelector('[data-rm]') || $('sgAdd'); n.focus(); });
  $('sgAdd').addEventListener('click', () => { const l = state.sg.visuals; if (l.length >= 8) return; l.push({ type: 'clusteredBarChart', title: 'New visual', n: 8, show: '' }); renderSgList(); sgSaved(); const n = $('sgvType' + (l.length - 1)); if (n) n.focus(); });
  $('sgGo').addEventListener('click', () => { state.sgOut = LS.suggest(state.sg, state.cfg); renderSuggestions(); const f = $('sgOut').querySelector('[data-usesg]'); if (f) f.focus(); });
  $('sgOut').addEventListener('click', e => {
    const u = e.target.closest('[data-usesg]');
    if (u) { const v = state.sgOut[+u.dataset.usesg]; state.cfg = LO.upgrade(JSON.parse(JSON.stringify(v.cfg))); state.sel = null; state.zones = true; $('showZones').checked = true; edited({ editor: true }); $('canvas').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    if (e.target.id === 'sgDetail') { state.cfg = LO.upgrade(LS.detailPage(state.cfg)); state.sel = null; edited({ editor: true }); $('canvas').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  });
  $('showZones').addEventListener('change', () => { state.zones = $('showZones').checked; renderCanvas(); });
  // step 3
  $('colorSrc').addEventListener('change', () => { state.look.src = $('colorSrc').value; state.look.overrides = {}; edited({ look: true }); });
  $('font').addEventListener('change', () => { state.look.font = $('font').value; edited(); });
  $('srcBox').addEventListener('input', e => { if (e.target.id === 'themeText') { state.look.themeText = e.target.value; state.look.overrides = {}; edited({ look: true }); } });
  $('srcBox').addEventListener('change', e => { if (e.target.id !== 'themeFile' || !e.target.files[0]) return; e.target.files[0].text().then(t => { state.look.themeText = t.replace(/^﻿/, ''); state.look.overrides = {}; edited({ look: true }); }); });
  $('colors').addEventListener('input', e => {
    const k = e.target.dataset.c || e.target.dataset.h; if (!k) return; const v = TB.norm(e.target.value);
    if (!v) { e.target.classList.add('bad'); return; } e.target.classList.remove('bad');
    if (k === 'accent' && state.look.src === 'pick') { state.look.pickAccent = v; delete state.look.overrides.accent; } else state.look.overrides[k] = v;
    edited();
  });
  $('colors').addEventListener('click', e => { if (e.target.id === 'resetColors') { state.look.overrides = {}; edited({ look: true }); } });
  $('shOn').addEventListener('change', () => { state.look.style.shadow = $('shOn').checked; edited({ look: true }); });
  const shSet = (k, v) => { const st = state.look.style; st.sh = Object.assign(LR.shadowOf(st), { [k]: v }); edited(); };
  [['shX', 'x', 0], ['shY', 'y', 4], ['shBlur', 'blur', 16], ['shSpread', 'spread', 0], ['shOp', 'opacity', 35]].forEach(([id, k, d]) => $(id).addEventListener('input', () => shSet(k, num($(id).value, d))));
  $('shColor').addEventListener('input', () => { const v = TB.norm($('shColor').value); $('shColor').classList.toggle('bad', !v); if (v) { $('shColorPick').value = v; shSet('color', v); } });
  $('shColorPick').addEventListener('input', () => { $('shColor').value = $('shColorPick').value.toUpperCase(); shSet('color', $('shColorPick').value.toUpperCase()); });
  $('shReset').addEventListener('click', () => { state.look.style.sh = Object.assign({}, LR.SH_DEFAULT); edited({ look: true }); });
  [['radius', 'radius'], ['hdrStyle', 'header'], ['cards', 'cards']].forEach(([id, k]) => $(id).addEventListener(id === 'radius' ? 'input' : 'change', () => { state.look.style[k] = id === 'radius' ? Math.max(0, num($(id).value, 0)) : $(id).value; edited(); }));
  $('border').addEventListener('change', () => { state.look.style.border = $('border').checked; edited(); });
  $('figmaOn').addEventListener('change', () => { state.figma = $('figmaOn').checked; document.body.classList.toggle('figma', state.figma); persist(); });
  // step 4
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-dl],[data-copy]'); if (!b) return;
    const c = state.cfg, name = slug(c.name);
    try {
      if (b.dataset.copy === 'tsv') copyText(state.out.tsv, b);
      else if (b.dataset.copy === 'wf-svg') copyText(state.out.wf, b);
      else if (b.dataset.copy === 'bg-svg') copyText(state.out.bg, b);
      else if (b.dataset.dl === 'wf-svg') download(new Blob([state.out.wf], { type: 'image/svg+xml' }), name + ' wireframe.svg');
      else if (b.dataset.dl === 'bg-svg') download(new Blob([state.out.bg], { type: 'image/svg+xml' }), name + ' background.svg');
      else if (b.dataset.dl === 'wf-png') download(await LX.png(state.out.wf, c.w, c.h, 1), name + ' wireframe.png');
      else if (b.dataset.dl === 'wf-png2') download(await LX.png(state.out.wf, c.w, c.h, 2), name + ' wireframe 2x.png');
      else if (b.dataset.dl === 'bg-png2') download(await LX.png(state.out.bg, c.w, c.h, 2), name + ' background 2x.png');
      else if (b.dataset.dl === 'pptx') {
        const bytes = async svg => new Uint8Array(await (await LX.png(svg, c.w, c.h, 2)).arrayBuffer());
        const blob = LP.build(state.L, c, state.col, state.look.style, state.look.font, { wf: await bytes(state.out.wf), bg: await bytes(state.out.bg) });
        download(blob, name + ' layout.pptx');
      }
      else if (b.dataset.dl === 'bg-png1') download(await LX.png(state.out.bg, c.w, c.h, 1), name + ' background.png');
    } catch (err) { const m = document.createElement('div'); m.className = 'msg err'; m.textContent = err.message || String(err); b.closest('.btns').after(m); setTimeout(() => m.remove(), 8000); }
  });
  $('clearAll').addEventListener('click', () => { resetAll(); try { localStorage.setItem(PREFIX + 'blank', '1'); } catch (e) {} persist(); });
}
init();

/* ---------- Clear entries ---------- */
(function(){
  const btn = $('clearEntries'), box = $('clearConfirm'), done = $('clearDone');
  const show = on => { box.hidden = !on; btn.setAttribute('aria-expanded', on); if (on) { done.hidden = true; $('clearNo').focus(); } };
  btn.addEventListener('click', () => show(box.hidden));
  $('clearNo').addEventListener('click', () => { show(false); btn.focus(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) { show(false); btn.focus(); } });
  $('clearYes').addEventListener('click', () => {
    try { Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k)); } catch (e) {}
    resetAll();
    try { localStorage.setItem(PREFIX + 'blank', '1'); } catch (e) {}
    persist();
    show(false); done.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => { done.hidden = true; }, 6000);
  });
})();
