
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
  set('cols', c.grid.cols); set('rows', c.grid.rows);
  $('stripH').disabled = !c.strip.on;
}

/* ---------- step 2: canvas + editor ---------- */
function renderTemplates(){ $('templates').innerHTML = LO.TEMPLATES.map(t => '<button type="button" class="chip" data-tpl="' + t.id + '">' + esc(t.name) + '</button>').join(''); }
function renderCanvas(){
  const L = state.L, col = state.col;
  $('canvas').innerHTML = LR.wireframe(L, state.cfg, Object.assign({}, col), state.look.style, { hit: true, empty: true, grid: true, selected: state.sel, dims: state.dims, zones: state.zones, font: state.look.font, ids: false });
  $('layoutMsg').innerHTML = L.probs.map(p => '<div class="msg ' + p.level + '">' + esc(p.text) + '</div>').join('');
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

/* ---------- 3-30-3 suggestions ---------- */
function renderSuggestInputs(){
  const g = state.sg, set = (id, v) => { if (document.activeElement !== $(id)) $(id).value = v; };
  set('sgK', g.kpis); $('sgT').value = g.targets; $('sgTrend').checked = !!g.trend; set('sgB', g.breakdowns); $('sgGeo').checked = !!g.geo; $('sgHeat').checked = !!g.heatmap;
  $('sgD').value = g.detail; set('sgF', g.filters); $('sgP').value = g.filterPlace;
  $('sgGeo').disabled = !(+g.breakdowns > 0);
}
function renderSuggestions(){
  const list = state.sgOut; if (!list) { $('sgOut').innerHTML = ''; return; }
  const esc2 = esc, col = state.col, st = state.look.style;
  let h = list.map((v, i) => {
    const L = LO.layout(v.cfg), svg = LR.wireframe(L, v.cfg, col, st, { zones: true, font: state.look.font, ids: false });
    return '<div class="sg' + (v.recommended ? ' rec' : '') + '"><h4>' + esc2(v.name) + (v.recommended ? '<span class="rec-tag">Best fit</span>' : '') + '</h4><p class="blurb">' + esc2(v.blurb) + '</p>' + svg
      + '<ul>' + v.why.map(([z, t]) => '<li><b class="z' + z.replace(' s', '') + '">' + z + '</b>' + esc2(t) + '</li>').join('') + '</ul>'
      + (v.probs || []).map(p => '<div class="msg ' + p.level + '">' + esc2(p.text) + '</div>').join('')
      + '<div class="btns"><button type="button" class="btn' + (v.recommended ? ' primary' : '') + '" data-usesg="' + i + '">Use this layout</button></div></div>';
  }).join('');
  if (state.sg.detail === 'drill') h += '<div class="msg info sg-note">For the 300-second level, build a drill-through page next: <button type="button" class="btn small" id="sgDetail">Start the detail page</button> lays out a details matrix with a filter panel. In Power BI Desktop, add the fields people drill on to the page&rsquo;s <b>Drill through</b> well.</div>';
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
  state.out.bg = LR.background(L, c, col, st);
  state.out.tsv = LO.positionsTsv(L);
  $('wfThumb').innerHTML = state.out.wf; $('bgThumb').innerHTML = state.out.bg;
  const rows = state.out.tsv.split('\n').map(r => r.split('\t'));
  $('posTable').innerHTML = '<thead><tr>' + rows[0].map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' + rows.slice(1).map(r => '<tr>' + r.map((v, i) => '<td' + (i > 1 ? ' class="num"' : '') + '>' + esc(v) + '</td>').join('') + '</tr>').join('') + '</tbody>';
}

const _mctx = document.createElement('canvas').getContext('2d');
LO.setMeasure((text, size) => { _mctx.font = '700 ' + size + 'px "' + (state.look.font || 'Segoe UI') + '", "Segoe UI", Arial, sans-serif'; return _mctx.measureText(String(text)).width + 4; });
function compute(){ state.col = colors(); state.L = LO.layout(state.cfg); }
function renderAll(){ compute(); renderPage(); renderCanvas(); renderEditor(); renderLook(); renderOut(); }
function refresh(opts){ compute(); renderPage(); renderCanvas(); if (opts && opts.editor) renderEditor(); if (opts && opts.look) renderLook(); else renderColors(); renderOut(); persist(); }

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
  try { const g = JSON.parse(store.get('sg') || 'null'); if (g) state.sg = Object.assign(LS.blankInput(), g); } catch (e) {}
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
  $('templates').addEventListener('click', e => { const b = e.target.closest('[data-tpl]'); if (!b) return; state.cfg = LO.fromTemplate(b.dataset.tpl, state.cfg); state.sel = null; edited({ editor: true }); });
  $('cols').addEventListener('input', () => { state.cfg.grid.cols = Math.min(12, Math.max(1, Math.round(num($('cols').value, 3)))); edited({ editor: true }); });
  $('rows').addEventListener('input', () => { state.cfg.grid.rows = Math.min(12, Math.max(1, Math.round(num($('rows').value, 2)))); edited({ editor: true }); });
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
  // 3-30-3 suggestions
  const sgChange = () => { const g = state.sg;
    g.kpis = Math.max(0, Math.min(8, num($('sgK').value, 4))); g.targets = $('sgT').value; g.trend = $('sgTrend').checked; g.breakdowns = Math.max(0, Math.min(4, num($('sgB').value, 2)));
    g.geo = $('sgGeo').checked && g.breakdowns > 0; g.heatmap = $('sgHeat').checked; g.detail = $('sgD').value; g.filters = Math.max(0, Math.min(8, num($('sgF').value, 3))); g.filterPlace = $('sgP').value;
    store.set('sg', JSON.stringify(g)); renderSuggestInputs(); if (state.sgOut) { state.sgOut = LS.suggest(state.sg, state.cfg); renderSuggestions(); } };
  ['sgK', 'sgB', 'sgF'].forEach(id => $(id).addEventListener('input', sgChange));
  ['sgT', 'sgTrend', 'sgGeo', 'sgHeat', 'sgD', 'sgP'].forEach(id => $(id).addEventListener('change', sgChange));
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
