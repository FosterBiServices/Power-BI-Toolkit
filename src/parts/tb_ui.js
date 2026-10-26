
/* ---------- Theme Builder page ---------- */
const $ = id => document.getElementById(id);
const PREFIX = 'ktb.';
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

const BG_PRESETS = [['White', '#FFFFFF'], ['Off-white', '#F7F7F5'], ['Light grey', '#EEF0F3'], ['Dark', '#1F1F1F'], ['Navy dark', '#111827']];
const VIS_PRESETS = [['Transparent', 'transparent'], ['White', '#FFFFFF'], ['Light grey', '#F3F4F6'], ['Soft grey', '#E9EBEE'], ['Dark grey', '#2B2B2B']];
const SENT_PRESETS = [['Excel conditional formatting', '#006100', '#9C5700', '#9C0006'], ['Green / red', '#0F6E3A', '#8C8C8C', '#E8615A'], ['Blue / orange (color-blind safe)', '#1D6FA3', '#8C8C8C', '#E07B39']];
const blankCfg = () => ({ name: '', seeds: ['#1F6FB2'], style: 'varied', count: 8, overrides: {}, background: '#FFFFFF', visualBg: 'transparent', textMode: 'brand', textColor: '#252423', font: 'Segoe UI', good: '#006100', neutral: '#9C5700', bad: '#9C0006', bubble: 0, vis: { all: {}, groups: {} }, custom: {}, base: null, baseName: '' });
const EX_CFG = () => Object.assign(blankCfg(), { name: 'Contoso Retail', seeds: ['#1F6FB2', '#7A4FA3'], visualBg: '#F3F4F6',
  vis: { all: { titleSize: '14', radius: '8' }, groups: { cards: { valueSize: '28' }, tables: { header: 'light', banded: 'on' } } } });
const state = { example: false, cfg: blankCfg(), out: {}, alt: -1 };

function persist(){ store.set('cfg', JSON.stringify(state.example ? blankCfg() : state.cfg)); }
function setExample(on){ state.example = on; $('exampleBanner').hidden = !on; }
function leaveExample(){ if (state.example) setExample(false); }

function dataColors(){
  const c = state.cfg;
  const base = TB.palette(c.seeds, +c.count || 8, c.style);
  return base.map((h, i) => TB.norm(c.overrides[i]) || h);
}
function opts(){ const c = state.cfg; return { name: c.name, dataColors: dataColors(), background: c.background, visualBg: c.visualBg, textMode: c.textMode, textColor: c.textColor, font: c.font, good: c.good, neutral: c.neutral, bad: c.bad, bubble: +c.bubble || 0, vis: c.vis, custom: c.custom, base: c.base }; }

// what text and chart marks sit on: the visual background, or the page when visuals are transparent
function surface(){ const c = state.cfg; return TB.norm(c.visualBg) || TB.norm(c.background) || '#FFFFFF'; }

/* a color picker paired with a hex box */
function colorRow(key, label, value, extra){
  return '<div class="crow-in"><label class="cpick"><input type="color" data-c="' + key + '" value="' + esc(TB.norm(value) || '#000000') + '" aria-label="' + esc(label) + '"></label>'
    + '<div class="cmeta"><span class="clabel">' + esc(label) + '</span><input type="text" class="hex" data-h="' + key + '" value="' + esc(TB.norm(value) || value || '') + '" spellcheck="false" aria-label="' + esc(label) + ' hex code"></div>' + (extra || '') + '</div>';
}
function badge(fg, bg){
  const r = TB.contrast(fg, bg), cls = r >= 4.5 ? 'ok' : r >= 3 ? 'warn' : 'err';
  return '<span class="cr ' + cls + '" title="Contrast with the background it sits on. 4.5:1 or more works for text, 3:1 or more for bars and lines.">' + r.toFixed(1) + ':1</span>';
}
function renderSeeds(){
  const c = state.cfg;
  $('seeds').innerHTML = c.seeds.map((s, i) => '<div class="seed">' + colorRow('seed' + i, i ? 'Brand color ' + (i + 1) : 'Main brand color', s, i ? '<button type="button" class="ib" data-rmseed="' + i + '" aria-label="Remove brand color ' + (i + 1) + '">&#10005;</button>' : '') + '</div>').join('');
  $('addSeed').hidden = c.seeds.length >= 3;
  const counts = [6, 8, 10, 12]; if (counts.indexOf(+c.count) < 0) counts.push(+c.count);
  $('count').innerHTML = counts.sort((a, b) => a - b).map(n => '<option>' + n + '</option>').join('');
  $('style').value = c.style; $('count').value = String(c.count);
  $('baseNote').hidden = !c.base;
  if (c.base) $('baseNote').innerHTML = 'Started from your theme file' + (c.baseName ? ', <b>' + esc(c.baseName) + '</b>' : '') + '. Its visual styles are the starting point. <button type="button" class="linkbtn" id="dropBase">Use the built-in styles instead</button>';
  if (document.activeElement !== $('tName')) $('tName').value = c.name;
}
// Suggested (not brand) colors get "Other options"; a shades palette is a ladder of one hue, so it has none
const canAlt = i => state.cfg.style !== 'shades' && i >= state.cfg.seeds.length;
function renderSwatches(){
  const c = state.cfg, dc = dataColors();
  if (!canAlt(state.alt) || state.alt >= dc.length) state.alt = -1;
  $('swatches').innerHTML = dc.map((h, i) => '<div class="sw' + (c.overrides[i] ? ' changed' : '') + '">' + colorRow('dc' + i, (i + 1) + (i < c.seeds.length ? ' · brand' : ''), h, badge(h, surface()))
    + (canAlt(i) ? '<button type="button" class="linkbtn alt-btn" data-alt="' + i + '" aria-expanded="' + (state.alt === i) + '" aria-controls="altPanel">Other options</button>' : '') + '</div>'
    + (state.alt === i ? '<div class="alt-panel" id="altPanel" role="region" aria-label="Other options for color ' + (i + 1) + '"></div>' : '')).join('');
  renderAlt();
  $('resetPalette').hidden = !Object.keys(c.overrides).length;
}
/* Other colors for the open swatch: they fit the brand and the colors around them, so only this one changes */
function renderAlt(){
  const box = $('altPanel'), i = state.alt; if (!box || i < 0) return;
  const c = state.cfg, dc = dataColors(), cur = dc[i];
  const alts = TB.alternatives(dc, i, surface());
  const base = TB.palette(c.seeds, +c.count || 8, c.style)[i];
  box.innerHTML = '<div class="alt-head"><span><b>Instead of ' + esc(cur) + '</b> <span class="muted">(color ' + (i + 1) + ')</span></span><button type="button" class="ib" data-altclose aria-label="Close other options">&#10005;</button></div>'
    + '<p class="note small">Each one suits your brand, stays clear of green, red and amber, can be seen on the background, and stands apart from your other data colors, so the rest of the palette can stay as it is.</p>'
    + (alts.length ? '<div class="alt-list">' + alts.map(a => '<button type="button" class="alt" data-pick="' + a.hex + '"><span class="alt-dot" style="background:' + a.hex + '"></span><span class="alt-txt"><b>' + esc(a.name) + '</b> <span class="mono">' + a.hex + '</span><span class="alt-why">' + esc(a.why) + '</span></span></button>').join('') + '</div>'
      : '<div class="msg info">Your palette is full enough that no other color stands apart from the rest. Try fewer data colors.</div>')
    + (c.overrides[i] && base ? '<div class="reply-actions"><button type="button" class="linkbtn" data-pick="' + base + '">Go back to the suggested color, ' + base + '</button></div>' : '');
}
function renderSettings(){
  const c = state.cfg;
  $('bgPresets').innerHTML = BG_PRESETS.map(([n, h]) => '<button type="button" class="chip" data-bg="' + h + '" aria-pressed="' + (TB.norm(c.background) === h) + '"><span class="dot" style="background:' + h + '"></span>' + esc(n) + '</button>').join('');
  $('bgRow').innerHTML = colorRow('background', 'Page background', c.background);
  const vis = TB.norm(c.visualBg);
  $('visPresets').innerHTML = VIS_PRESETS.map(([n, h]) => '<button type="button" class="chip" data-vis="' + h + '" aria-pressed="' + (h === 'transparent' ? !vis : vis === h) + '"><span class="dot' + (h === 'transparent' ? ' clear' : '') + '" style="background:' + (h === 'transparent' ? '#fff' : h) + '"></span>' + esc(n) + '</button>').join('');
  $('visRow').hidden = !vis;
  $('visRow').innerHTML = colorRow('visualBg', 'Visual background', vis || '#FFFFFF');
  $('textMode').value = c.textMode;
  $('textRow').hidden = c.textMode !== 'custom';
  $('textRow').innerHTML = colorRow('textColor', 'Text color', c.textColor, badge(c.textColor, surface()));
  if (![...$('font').options].some(o => o.value === c.font)) { const op = document.createElement('option'); op.textContent = c.font; $('font').appendChild(op); }
  $('font').value = c.font;
  $('bubble').value = String(+c.bubble || 0);
  $('sentPresets').innerHTML = SENT_PRESETS.map(([n, g, u, b], i) => '<button type="button" class="chip" data-sent="' + i + '" aria-pressed="' + (TB.norm(c.good) === g && TB.norm(c.neutral) === u && TB.norm(c.bad) === b) + '"><span class="dot" style="background:' + g + '"></span>' + (i ? '' : '<span class="dot" style="background:' + u + '"></span>') + '<span class="dot" style="background:' + b + '"></span>' + esc(n) + '</button>').join('');
  $('goodRow').innerHTML = colorRow('good', 'Good / increase', c.good);
  $('neutralRow').innerHTML = colorRow('neutral', 'Neutral / other', c.neutral);
  $('badRow').innerHTML = colorRow('bad', 'Bad / decrease', c.bad);
}

/* ---------- visual settings: all visuals, then each kind of visual ---------- */
const optLabel = (k, v) => { const o = TB.VIS_SETTINGS[k].opts.find(x => x[0] === v); return o ? o[1] : v; };
function visField(scope, k){
  const c = state.cfg, spec = TB.VIS_SETTINGS[k], cur = scope === 'all' ? c.vis.all[k] : (c.vis.groups[scope] || {})[k];
  const first = scope === 'all' ? 'Default (' + optLabel(k, spec.def) + ')' : 'All visuals: ' + optLabel(k, TB.visValue({ all: c.vis.all }, scope, k));
  const id = 'v-' + scope + '-' + k;
  return '<div class="field"><label for="' + id + '">' + esc(spec.label) + '</label><select id="' + id + '" data-vg="' + scope + '" data-vk="' + k + '"' + (cur ? ' class="set"' : '') + '><option value="">' + esc(first) + '</option>'
    + spec.opts.map(([v, l]) => '<option value="' + esc(v) + '"' + (cur === v ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select></div>';
}
const visCount = g => Object.keys(state.cfg.vis.groups[g] || {}).length;
function visSummary(g){ const n = visCount(g.id); return '<b>' + esc(g.name) + '</b>' + (n ? ' <span class="vcount">' + n + ' changed</span>' : '') + '<span class="vtypes">' + esc(g.types.map(t => TB.TYPE_NAMES[t] || t).join(', ')) + '</span>'; }
function renderVis(){
  const c = state.cfg;
  $('visAll').innerHTML = TB.VIS_ALL.map(k => visField('all', k)).join('');
  renderVisGroups();
}
function renderVisGroups(){
  const open = new Set([...document.querySelectorAll('#visGroups details[open]')].map(d => d.dataset.g));
  $('visGroups').innerHTML = TB.VIS_GROUPS.map(g => '<details class="vgroup" data-g="' + g.id + '"' + (open.has(g.id) ? ' open' : '') + '><summary>' + visSummary(g) + '</summary><div class="vfields">' + g.keys.map(k => visField(g.id, k)).join('') + '</div></details>').join('');
  $('resetVis').hidden = !Object.keys(state.cfg.vis.all).length && !Object.keys(state.cfg.vis.groups).length;
}

/* ---------- every property, from Microsoft's theme schema ---------- */
const typeName = t => t === '*' ? 'All visuals' : TB.TYPE_NAMES[t] || t.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
const objName = (k, so) => { const [o, st] = TB.splitCard(k); return ((so && so[o] && so[o].title) || o.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase())) + (st ? ' (' + TB.stateName(st) + ')' : ''); };
const propState = { type: 'card', obj: '', find: '' };
// searchable text: names as typed and split into words (dropShadow -> drop shadow)
const words = t => (t + ' ' + t.replace(/([a-z])([A-Z])/g, '$1 $2')).toLowerCase();
// A report's ThemeDataColor, as Power BI's color picker names it: ColorId 0 is the theme's background, 1 its
// foreground (text), 2 and up its data colors 1, 2... Percent is a shade: -0.4 is 40% darker, 0.6 60% lighter.
let tcCache = null;   // the theme the names are read from; each render builds it once
function themeColorName(tc){
  const id = +tc.ColorId, pc = +tc.Percent || 0;
  if (!tcCache) { tcCache = {}; try { tcCache = TB.build(opts()).theme; } catch (e) {} }
  const t = tcCache;
  const hex = id === 0 ? t.background : id === 1 ? t.foreground : (t.dataColors || [])[id - 2];
  return (id === 0 ? 'Background' : id === 1 ? 'Text color' : 'Theme color ' + (id - 1)) + (hex ? ' ' + hex : '') + (pc ? ', ' + Math.round(Math.abs(pc) * 100) + '% ' + (pc > 0 ? 'lighter' : 'darker') : '');
}
function showValue(spec, v){
  if (v === undefined || v === null) return '';
  if (spec && spec[0] === 'b') return v ? 'On' : 'Off';
  if (spec && spec[0] === 'e') { const o = spec[2].find(x => x[0] === v); return o ? o[1] : String(v); }
  if (v && typeof v === 'object') { const c = v.solid && v.solid.color; if (typeof c === 'string') return c; if (c && c.expr && c.expr.ThemeDataColor) return themeColorName(c.expr.ThemeDataColor); return 'set'; }
  return String(v);
}
function renderPropPickers(){
  const types = TB.schemaTypes(); if (!types.length) { $('propType').closest('.box').hidden = true; return; }
  if (propState.type !== '*' && types.indexOf(propState.type) < 0) propState.type = 'card';
  const named = types.filter(t => t !== 'report' && t !== 'page' && t !== 'filter').sort((a, b) => typeName(a).localeCompare(typeName(b)));
  $('propType').innerHTML = ['*', 'page', 'report', 'filter'].concat(named).filter(t => t === '*' || types.indexOf(t) >= 0).map(t => '<option value="' + esc(t) + '"' + (t === propState.type ? ' selected' : '') + '>' + esc(typeName(t)) + (t === '*' ? ' (*)' : t === 'page' || t === 'report' ? ' (the ' + t + ' itself)' : '') + '</option>').join('');
  const so = TB.schemaObjects(propState.type) || {}, objs = Object.keys(so).sort((a, b) => objName(a, so).localeCompare(objName(b, so)));
  if (propState.obj && !so[propState.obj]) propState.obj = '';
  $('propObj').innerHTML = '<option value="">Every card</option>' + objs.map(o => '<option value="' + esc(o) + '"' + (o === propState.obj ? ' selected' : '') + '>' + esc(objName(o, so)) + (objName(o, so).toLowerCase().replace(/ /g, '') === o.toLowerCase() ? '' : ' (' + esc(o) + ')') + '</option>').join('');
  if (document.activeElement !== $('propFind')) $('propFind').value = propState.find;
}
function renderProps(){
  tcCache = null;
  const t = propState.type, so = TB.schemaObjects(t); if (!so) { $('propRows').innerHTML = ''; return; }
  const custom = state.cfg.custom[t] || {}, find = propState.find.trim().toLowerCase();
  // the theme's value without the property changes, to show in grey
  const o = opts(); o.custom = {}; let built = {}; try { built = TB.build(o).theme.visualStyles || {}; } catch (e) {}
  const themeVal = (key, p) => { const [obj, st] = TB.splitCard(key); const read = vt => { const a = built[vt] && built[vt]['*'] && built[vt]['*'][obj]; const e = Array.isArray(a) && (st ? a.find(x => x && x.$id === st) : a.find(x => x && (x.$id === undefined || x.$id === 'default')) || a[0]); return e && e[p] !== undefined ? e[p] : undefined; }; const v = read(t); return v !== undefined || t === '*' || st ? v : read('*'); };
  // each card, then the states copied for it (hover, selected...), right after it
  const states = ob => Object.keys(custom).filter(k => TB.splitCard(k)[0] === ob && k !== ob).sort();
  const objs = [].concat(...(propState.obj ? [propState.obj] : Object.keys(so).sort((a, b) => objName(a, so).localeCompare(objName(b, so)))).filter(ob => so[ob]).map(ob => [ob].concat(states(ob))));
  let html = '', shown = 0;
  objs.forEach(ob => {
    const base = TB.splitCard(ob)[0], props = so[base].props, rows = Object.keys(props).filter(p => props[p][0] !== 'x' && p !== '$id').filter(p => !find || words(p + ' ' + props[p][1] + ' ' + base + ' ' + objName(ob, so)).indexOf(find) >= 0).sort();
    if (!rows.length) return;
    if (shown > 400) return;
    html += '<div class="pgroup"><div class="pgh">' + esc(objName(ob, so)) + ' <span class="mono muted">' + esc(ob.replace('@', ' $id: ')) + '</span></div>';
    rows.forEach(p => {
      shown++;
      const spec = props[p], cur = custom[ob] && custom[ob][p], tv = themeVal(ob, p), ph = showValue(spec, tv), id = 'pp-' + ob + '-' + p, k = spec[0];
      const attrs = ' id="' + esc(id) + '" data-po="' + esc(ob) + '" data-pp="' + esc(p) + '"';
      let input;
      if (k === 'b') input = '<select' + attrs + '><option value="">' + esc(ph ? 'Theme: ' + ph : 'Not set') + '</option><option value="true"' + (cur === true ? ' selected' : '') + '>On</option><option value="false"' + (cur === false ? ' selected' : '') + '>Off</option></select>';
      else if (k === 'e') input = '<select' + attrs + '><option value="">' + esc(ph ? 'Theme: ' + ph : 'Not set') + '</option>' + spec[2].map(([v, l]) => '<option value="' + esc(JSON.stringify(v)) + '"' + (cur === v ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>';
      else if (k === 'c') { const hx = cur && typeof cur.solid.color === 'string' ? cur.solid.color : ''; input = '<span class="pcolor"><label class="cpick sm"><input type="color" data-pcol="' + esc(id) + '" value="' + esc(hx || (typeof tv === 'object' && tv && typeof tv.solid.color === 'string' ? tv.solid.color : '#000000')) + '" aria-label="' + esc((spec[1] || p) + ' color') + '"></label><input type="text" class="hex"' + attrs + ' value="' + esc(hx || (cur ? showValue(spec, cur) : '')) + '" placeholder="' + esc(ph || '#RRGGBB') + '" spellcheck="false"></span>'; }
      else input = '<input type="' + (k === 's' ? 'text' : 'number') + '"' + attrs + (k === 'i' ? ' step="1"' : k === 'n' ? ' step="any"' : '') + (spec[2] != null ? ' min="' + spec[2] + '"' : '') + (spec[3] != null ? ' max="' + spec[3] + '"' : '') + ' value="' + esc(cur === undefined ? '' : cur) + '" placeholder="' + esc(ph || '') + '">';
      html += '<div class="prow' + (cur !== undefined ? ' set' : '') + '"><label for="' + esc(id) + '">' + esc(spec[1] || p) + ' <span class="mono muted">' + esc(p) + '</span></label>' + input + (cur !== undefined ? '<button type="button" class="ib" data-prm="' + esc(t + '|' + ob + '|' + p) + '" aria-label="Clear ' + esc(spec[1] || p) + '">&#10005;</button>' : '') + '</div>';
    });
    html += '</div>';
  });
  $('propRows').innerHTML = html || '<div class="msg info">No property matches. Try another word, or Every card.</div>';
  if (shown > 400) $('propRows').insertAdjacentHTML('beforeend', '<div class="msg info">Showing the first 400. Pick a card or find a property to see the rest.</div>');
}
function renderCustomList(){
  tcCache = null;
  const c = state.cfg.custom, n = TB.countCustom(c), items = [];
  Object.keys(c).forEach(t => { const so = TB.schemaObjects(t) || {}; Object.keys(c[t]).forEach(o => Object.keys(c[t][o]).forEach(p => {
    const b = TB.splitCard(o)[0], spec = so[b] && so[b].props[p];
    items.push('<li><span>' + esc(typeName(t)) + ' &rsaquo; ' + esc(objName(o, so)) + ' &rsaquo; ' + esc((spec && spec[1]) || p) + ': <b>' + esc(showValue(spec, c[t][o][p])) + '</b></span><button type="button" class="ib" data-prm="' + esc(t + '|' + o + '|' + p) + '" aria-label="Remove">&#10005;</button></li>'); })); });
  $('customCount').textContent = n ? '(' + n + ')' : '';
  $('customList').innerHTML = n ? '<ul class="clist">' + items.join('') + '</ul>' : '<p class="note small">None yet.</p>';
  $('resetCustom').hidden = !n;
}
function renderEvery(){ renderPropPickers(); renderProps(); renderCustomList(); }
function setCustom(t, o, p, v){
  const c = state.cfg.custom;
  if (v === undefined) { if (c[t] && c[t][o]) { delete c[t][o][p]; if (!Object.keys(c[t][o]).length) delete c[t][o]; if (!Object.keys(c[t]).length) delete c[t]; } return; }
  c[t] = c[t] || {}; c[t][o] = c[t][o] || {}; c[t][o][p] = v;
}

/* ---------- visuals read from a report ---------- */
// Nothing starts checked: a report can have a hundred visuals and you may want only one. Find, Check all and the
// page boxes act on the visuals shown.
const found = { list: [] };
const canPick = v => v.known && v.count > 0;
function renderFound(msg){
  const box = $('fromVisual'), L = found.list;
  if (!L.length) { box.innerHTML = msg ? '<div class="msg ' + (msg.level || 'warn') + '">' + esc(msg.text) + '</div>' : ''; return; }
  const pages = []; L.forEach((v, i) => { let g = pages.find(x => x.page === v.page); if (!g) pages.push(g = { page: v.page, items: [] }); g.items.push(i); });
  const item = i => { const v = L[i];
    return '<li data-fvi="' + i + '"><label><input type="checkbox" data-fv="' + i + '"' + (canPick(v) ? '' : ' disabled') + '> <b>' + esc(typeName(v.type)) + '</b>' + (v.name ? ' &middot; ' + esc(v.name) : '') + ' <span class="muted">&middot; ' + (v.known ? v.count + ' setting' + (v.count === 1 ? '' : 's') : 'a custom visual') + '</span></label>'
      + (v.skipped.length ? '<details class="skipped"><summary>' + v.skipped.length + ' reason' + (v.skipped.length === 1 ? '' : 's') + ' something was left out</summary><ul class="small muted">' + v.skipped.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></details>' : '') + '</li>'; };
  box.innerHTML = (msg ? '<div class="msg ' + (msg.level || 'ok') + '">' + esc(msg.text) + '</div>' : '')
    + '<div class="vtools"><input type="search" id="fvFind" placeholder="Find a visual by name, kind or page" aria-label="Find a visual">'
    + '<button type="button" class="linkbtn" id="fvAll">Check all</button><button type="button" class="linkbtn" id="fvNone">Uncheck all</button></div>'
    + pages.map((g, gi) => '<div class="vpage" data-fpg="' + gi + '">' + (pages.length > 1 || g.page ? '<label class="vpgh"><input type="checkbox" data-fpage="' + gi + '"' + (g.items.some(i => canPick(L[i])) ? '' : ' disabled') + '> <b>' + esc(g.page || 'No page name') + '</b> <span class="muted">(' + g.items.length + ')</span></label>' : '')
      + '<ul class="vlist">' + g.items.map(item).join('') + '</ul></div>').join('')
    + '<p class="note small" id="fvNoMatch" hidden>No visual matches.</p>'
    + '<p class="note small">If two checked visuals are the same kind, the lower one wins where they differ.</p>'
    + '<div class="reply-actions"><button type="button" class="btn primary" id="addFound" disabled>Add the checked visuals to the theme</button></div>';
  syncFound();
}
// page boxes, the Add button's count and what Find hides
function syncFound(){
  const box = $('fromVisual'), q = (($('fvFind') || {}).value || '').trim().toLowerCase();
  let shown = 0;
  box.querySelectorAll('[data-fvi]').forEach(li => { const v = found.list[+li.dataset.fvi]; const hit = !q || words(typeName(v.type) + ' ' + v.type + ' ' + v.name + ' ' + v.page).indexOf(q) >= 0; li.hidden = !hit; if (hit) shown++; });
  box.querySelectorAll('[data-fpg]').forEach(g => { g.hidden = !g.querySelector('[data-fvi]:not([hidden])');
    const pb = g.querySelector('[data-fpage]'); if (!pb) return;
    const c = [...g.querySelectorAll('[data-fvi]:not([hidden]) [data-fv]:not(:disabled)')], on = c.filter(x => x.checked).length;
    pb.checked = !!c.length && on === c.length; pb.indeterminate = on > 0 && on < c.length; pb.disabled = !c.length; });
  const nm = $('fvNoMatch'); if (nm) nm.hidden = shown > 0;
  const n = box.querySelectorAll('[data-fv]:checked').length, add = $('addFound');
  if (add) { add.disabled = !n; add.textContent = n ? 'Add the ' + (n === 1 ? 'checked visual' : n + ' checked visuals') + ' to the theme' : 'Check the visuals to add'; }
}
/* The theme a PBIP report already uses: ask whether to start from it, take only its colors, or keep what's here */
const pbip = { themes: [] };
function renderThemeAsk(){
  const t = pbip.themes[0];
  document.querySelectorAll('.theme-ask').forEach(el => { el.innerHTML = ''; el.hidden = true; });
  if (!t) return;
  const el = $(pbip.where === 'step1' ? 'themeAsk1' : 'themeAsk3'); if (!el) return;
  el.hidden = false;
  el.innerHTML = '<div class="msg info"><b>This report uses ' + (t.kind === 'custom' ? 'the theme ' + esc(t.name) : 'Power BI\u2019s built-in theme ' + esc(t.name)) + '.</b> '
    + (t.kind === 'custom' ? 'Do you want to use it here?' : 'It has no theme of its own. Use the built-in theme&rsquo;s colors here?')
    + '<div class="reply-actions"><button type="button" class="btn' + (t.kind === 'custom' ? ' primary' : '') + '" data-tuse="all">Start from this theme</button>'
    + '<button type="button" class="btn" data-tuse="colors">Use only its colors</button>'
    + '<button type="button" class="btn' + (t.kind === 'custom' ? '' : ' primary') + '" data-tuse="keep">Keep what I have</button></div>'
    + '<p class="note small">Start from this theme: its colors, font and visual styles replace this page&rsquo;s, and your changes here are added on top, so you can update it and import it back. Only its colors: the data colors, backgrounds, text, good and bad colors and font change, and your visual settings stay.</p></div>';
}
function readFiles(files, how){
  if (how === 'folder' || how === 'step1') { pbip.themes = TB.findThemes(files); pbip.where = how === 'step1' ? 'step1' : 'step3'; renderThemeAsk(); }
  found.list = TB.readVisuals(files);
  if (how === 'step1') {
    // the same pick fills Step 3's visual list, so the folder isn't picked twice
    const n = found.list.length, more = n ? '<div class="msg info">Its ' + n + ' visual' + (n === 1 ? ' is' : 's are') + ' ready in Step 3, under Copy settings from a visual.</div>' : '';
    $('themeMsg').innerHTML = (pbip.themes.length ? '' : '<div class="msg warn">No theme found in that folder. Pick the .Report folder of a PBIP project; its theme files are in StaticResources.</div>') + more;
    if (n) renderFound({ level: 'ok', text: 'Found ' + n + ' visual' + (n === 1 ? '' : 's') + ' in the report you picked in Step 1. Check the ones whose formatting you want in the theme.' });
    return;
  }
  if (!found.list.length) renderFound({ level: 'warn', text: how === 'paste' ? 'No visual found in what you pasted. Paste a visual.json from a PBIP report (definition/pages/.../visuals/.../visual.json).' : 'No visuals found. Pick the .Report folder of a PBIP project, or its visual.json files.' });
  else renderFound({ level: 'ok', text: 'Found ' + found.list.length + ' visual' + (found.list.length === 1 ? '' : 's') + '. Check the ones whose formatting you want in the theme.' });
}
const readAll = list => Promise.all([...list].filter(f => /\.json$/i.test(f.name) && f.size < 5e6).map(f => f.text().then(text => ({ path: f.webkitRelativePath || f.name, text }), () => null))).then(a => a.filter(Boolean));

/* ---------- preview: a sketch of a report page ---------- */
function renderPreview(){
  const o = opts(), r = TB.roles(o), dc = r.dataColors;
  if (!dc.length) { $('preview').innerHTML = ''; return; }
  const col = i => dc[i % dc.length];
  const vv = (g, k) => TB.visValue(state.cfg.vis, g, k);
  const font = "'" + (state.cfg.font || 'Segoe UI').replace(/'/g, '') + "', 'Segoe UI', Arial, sans-serif";
  // a visual's frame: background, border, rounded corners and shadow from the visual settings
  const frame = g => (r.visual ? 'background:' + r.visual + ';box-shadow:0 1px 3px rgba(0,0,0,.12);' : 'background:transparent;box-shadow:none;outline:1px dashed ' + r.grey10 + ';')
    + (vv(g, 'border') === 'on' ? 'border:1px solid ' + TB.mix(r.text, r.background, 0.75) + ';' : '') + 'border-radius:' + vv(g, 'radius') + 'px;'
    + (vv(g, 'shadow') === 'on' ? 'box-shadow:0 3px 10px rgba(0,0,0,.28);' : '') + 'padding:' + (6 + +vv(g, 'padding')) + 'px ' + (8 + +vv(g, 'padding')) + 'px;';
  const titleOf = (g, text) => vv(g, 'title') === 'on' ? '<div class="pv-title" style="color:' + dc[0] + ';font-size:' + Math.round(+vv(g, 'titleSize') * 0.8) + 'px;text-align:' + vv(g, 'titleAlign') + '">' + text + '</div>' : '';
  const cardLbl = vv('cards', 'cardLabel') === 'on', accent = vv('cards', 'accentBar') === 'on';
  const cards = [['Sales', '$4.21M'], ['Orders', '18,940'], ['Margin %', '38.2%']].map(([l, v]) => '<div class="pv-card" style="' + frame('cards') + (accent ? 'border-top:5px solid ' + dc[0] : '') + '">' + titleOf('cards', l)
    + (cardLbl ? '<div class="pv-cl" style="color:' + dc[0] + ';font-size:' + (+vv('cards', 'labelSize') + 2) + 'px">' + l + '</div>' : '') + '<div class="pv-cv" style="color:' + dc[0] + ';font-size:' + Math.round(+vv('cards', 'valueSize')) + 'px">' + v + '</div></div>').join('');
  // clustered columns: 4 months x 3 series
  const vals = [[62, 48, 30], [70, 52, 36], [66, 58, 41], [80, 61, 44]], W = 300, H = 150;
  let bars = ''; vals.forEach((g, i) => g.forEach((v, j) => { const x = 18 + i * 70 + j * 18; bars += '<rect x="' + x + '" y="' + (H - 20 - v * 1.4) + '" width="15" height="' + (v * 1.4) + '" fill="' + col(j) + '" rx="1.5"/>'; }));
  const axis = ['Jan', 'Feb', 'Mar', 'Apr'].map((m, i) => '<text x="' + (40 + i * 70) + '" y="' + (H - 5) + '" font-size="10" fill="' + r.grey70 + '" text-anchor="middle">' + m + '</text>').join('');
  const gridOn = g => vv(g, 'gridlines') === 'on';
  const grid = [40, 70, 100].map(y => '<line x1="10" x2="' + (W - 10) + '" y1="' + y + '" y2="' + y + '" stroke="' + r.grey10 + '" stroke-dasharray="2,3"/>').join('');
  const colChart = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="pv-svg">' + (gridOn('bars') ? grid : '') + bars + axis + '</svg>';
  // lines
  const lp = (pts, c, w) => '<polyline fill="none" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round" points="' + pts.map((v, i) => (15 + i * 45) + ',' + (130 - v)).join(' ') + '"/>';
  const lw = +vv('lines', 'lineWidth'), mk = vv('lines', 'markers') === 'on';
  const dots = (pts, c) => mk ? pts.map((v, i) => '<circle cx="' + (15 + i * 45) + '" cy="' + (130 - v) + '" r="' + (lw + 1.5) + '" fill="' + c + '"/>').join('') : '';
  const lines = [[40, 55, 50, 72, 80, 95, 110], [30, 38, 45, 42, 58, 60, 70], [20, 22, 30, 35, 33, 40, 46]];
  const lineChart = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="pv-svg">' + (gridOn('lines') ? grid : '') + lines.map((l, i) => lp(l, col(i), lw) + dots(l, col(i))).join('') + '</svg>';
  // donut
  const parts = [30, 22, 18, 12, 10, 8]; let a0 = -Math.PI / 2, donut = '';
  parts.forEach((p, i) => { const a1 = a0 + p / 100 * Math.PI * 2, R = 52, r0 = 32, cx = 75, cy = 70, lg = a1 - a0 > Math.PI ? 1 : 0;
    donut += '<path d="M' + (cx + R * Math.cos(a0)) + ' ' + (cy + R * Math.sin(a0)) + ' A' + R + ' ' + R + ' 0 ' + lg + ' 1 ' + (cx + R * Math.cos(a1)) + ' ' + (cy + R * Math.sin(a1)) + ' L' + (cx + r0 * Math.cos(a1)) + ' ' + (cy + r0 * Math.sin(a1)) + ' A' + r0 + ' ' + r0 + ' 0 ' + lg + ' 0 ' + (cx + r0 * Math.cos(a0)) + ' ' + (cy + r0 * Math.sin(a0)) + 'Z" fill="' + col(i) + '" stroke="' + r.background + '" stroke-width="1.5"/>'; a0 = a1; });
  const legend = ['Online', 'Stores', 'Partners', 'Wholesale', 'Outlet', 'Other'].map((n, i) => '<text x="150" y="' + (28 + i * 17) + '" font-size="10" fill="' + r.text + '"><tspan fill="' + col(i) + '">●</tspan> ' + n + '</text>').join('');
  const donutChart = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="pv-svg">' + donut + legend + '</svg>';
  // waterfall with good/bad/total
  const wf = [['Start', 60, 'total'], ['Price', 18, 'up'], ['Volume', 12, 'up'], ['Returns', -14, 'down'], ['Costs', -9, 'down'], ['End', 67, 'total']];
  let run = 0, wfs = '';
  wf.forEach(([n, v, k], i) => { const x = 14 + i * 47; let y0, h;
    if (k === 'total') { y0 = 130 - v * 1.2; h = v * 1.2; run = v; }
    else { const from = run, to = run + v; y0 = 130 - Math.max(from, to) * 1.2; h = Math.abs(v) * 1.2; run = to; }
    const fill = k === 'total' ? r.text : k === 'up' ? r.good : r.bad;
    wfs += '<rect x="' + x + '" y="' + y0 + '" width="34" height="' + h + '" fill="' + fill + '" rx="1.5"/><text x="' + (x + 17) + '" y="145" font-size="9" fill="' + r.grey70 + '" text-anchor="middle">' + n + '</text>'; });
  const wfChart = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="pv-svg">' + wfs + '</svg>';
  const rows = [['North', '$1.42M', '+6.1%', 'good'], ['South', '$0.98M', '-2.4%', 'bad'], ['East', '$1.05M', '+1.2%', 'good'], ['West', '$0.76M', '0.0%', 'neutral']];
  const hd = vv('tables', 'header'), hFill = hd === 'brand' ? dc[0] : hd === 'light' ? r.grey10 : 'transparent', hText = hd === 'brand' ? r.background : TB.readable(dc[0], hd === 'light' ? r.grey10 : r.background, 4.5);
  const band = vv('tables', 'banded') === 'on' ? TB.mix(r.grey10, r.background, 0.45) : '', tpad = +vv('tables', 'rowPadding') + 1;
  const rowLine = vv('tables', 'gridH') === 'on' ? 'border-bottom:1px solid ' + r.grey10 : '', colLine = vv('tables', 'gridV') === 'on' ? 'border-right:1px solid ' + r.grey10 + ';' : '';
  const cell = 'padding:' + tpad + 'px 8px;' + colLine;
  const table = '<table class="pv-table" style="font-size:' + (+vv('tables', 'fontSize') + 2.5) + 'px"><thead><tr>' + ['Region', 'Sales', 'vs LY'].map(h => '<th style="' + cell + 'background:' + hFill + ';color:' + hText + (hd === 'plain' ? ';font-weight:700;border-bottom:2px solid ' + r.grey10 : '') + '">' + h + '</th>').join('') + '</tr></thead><tbody>'
    + rows.map(([a, b, c2, s], i) => '<tr style="' + rowLine + (band && i % 2 ? ';background:' + band : '') + '"><td style="' + cell + 'color:' + dc[0] + '">' + a + '</td><td style="' + cell + 'color:' + dc[0] + '">' + b + '</td><td style="' + cell + 'color:' + (s === 'good' ? r.goodText : s === 'bad' ? r.badText : r.neutralText) + ';font-weight:600">' + c2 + '</td></tr>').join('') + '</tbody></table>';
  const tile = (title, body, g) => '<div class="pv-tile" style="' + frame(g) + '">' + titleOf(g, title) + body + '</div>';
  $('preview').style.cssText = 'background:' + r.page + ';color:' + r.text + ';font-family:' + font;
  $('preview').innerHTML = '<div class="pv-head"><div class="pv-h1" style="color:' + r.text + '">' + esc(state.cfg.name || 'Sales overview') + '</div>'
    + '<div class="pv-slicer">' + ['2024', '2025', '2026'].map((y, i) => '<span style="' + (i === 2 ? 'background:' + dc[0] + ';color:' + r.background : 'border:1px solid ' + r.grey10 + ';color:' + r.text) + '">' + y + '</span>').join('') + '</div></div>'
    + '<div class="pv-cards">' + cards + '</div>'
    + '<div class="pv-grid">' + tile('Sales by month and channel', colChart, 'bars') + tile('Sales trend', lineChart, 'lines') + tile('Sales by channel', donutChart, 'parts') + tile('Sales bridge', wfChart, 'bars') + tile('Sales by region', table, 'tables')
    + tile('Text styles', '<div class="pv-text"><div style="font-size:18px;font-weight:700;color:' + dc[0] + '">Title</div><div style="color:' + r.text + '">Body text and labels</div><div style="color:' + r.grey70 + '">Secondary text</div><div style="color:' + r.grey45 + '">Light label</div><div><a style="color:' + TB.readable(r.brand, r.background, 4.5) + '">A link</a></div></div>', 'all') + '</div>';
}

function renderOut(){
  const o = opts(), checks = TB.checks(o);
  $('checks').innerHTML = checks.map(x => '<div class="msg ' + x.level + '">' + esc(x.text) + '</div>').join('') || '<div class="msg ok">&#10003; Readable text, distinct data colors, and good and bad colors that stay apart for color-blind readers.</div>';
  if (!o.dataColors.length) { state.out = {}; return; }
  const { theme } = TB.build(o);
  state.out.json = JSON.stringify(theme, null, 2);
  state.fileName = ((state.cfg.name || 'My theme').trim() || 'My theme').replace(/[<>:"\/\\|?*\x00-\x1f]/g, '-') + '.json';
  $('fileName').textContent = state.fileName;
  $('jsonSize').textContent = '(' + Math.round(state.out.json.length / 1024) + ' KB)';
  $('jsonView').textContent = state.out.json;
}
function renderAll(){ renderSeeds(); renderSwatches(); renderSettings(); renderVis(); renderEvery(); renderPreview(); renderOut(); }
// Update values in place so the box being typed in (or the open color picker) keeps focus
function syncValues(){
  const c = state.cfg, dc = dataColors();
  const val = k => k.startsWith('seed') ? c.seeds[+k.slice(4)] : k.startsWith('dc') ? dc[+k.slice(2)] : c[k];
  document.querySelectorAll('[data-c],[data-h]').forEach(el => {
    if (el === document.activeElement) return;
    const k = el.dataset.c || el.dataset.h, v = TB.norm(val(k)); if (v) el.value = v;
  });
  document.querySelectorAll('#swatches .sw').forEach((el, i) => { el.classList.toggle('changed', !!c.overrides[i]); const b = el.querySelector('.cr'); if (b) b.outerHTML = badge(dc[i], surface()); });
  const tb = document.querySelector('#textRow .cr'); if (tb) tb.outerHTML = badge(c.textColor, surface());
  document.querySelectorAll('#bgPresets [data-bg]').forEach(b => b.setAttribute('aria-pressed', TB.norm(c.background) === b.dataset.bg));
  const vis = TB.norm(c.visualBg);
  document.querySelectorAll('#visPresets [data-vis]').forEach(b => b.setAttribute('aria-pressed', b.dataset.vis === 'transparent' ? !vis : vis === b.dataset.vis));
  $('visRow').hidden = !vis;
  document.querySelectorAll('#sentPresets [data-sent]').forEach(b => { const p = SENT_PRESETS[+b.dataset.sent]; b.setAttribute('aria-pressed', TB.norm(c.good) === p[1] && TB.norm(c.neutral) === p[2] && TB.norm(c.bad) === p[3]); });
  $('textRow').hidden = c.textMode !== 'custom';
  $('resetPalette').hidden = !Object.keys(c.overrides).length;
}
function refresh(){ syncValues(); renderAlt(); renderPreview(); renderOut(); }

/* ---------- init ---------- */
function setColor(key, hex){
  const c = state.cfg, h = TB.norm(hex); if (!h) return false;
  if (key.startsWith('seed')) c.seeds[+key.slice(4)] = h;
  else if (key.startsWith('dc')) { const i = +key.slice(2), base = TB.palette(c.seeds, +c.count || 8, c.style)[i]; if (base === h) delete c.overrides[i]; else c.overrides[i] = h; }
  else c[key] = h;
  return true;
}
function resetAll(){ state.cfg = blankCfg(); state.alt = -1; setExample(false); renderAll(); }
function init(){
  let cfg = null; try { cfg = JSON.parse(store.get('cfg') || 'null'); } catch (e) {}
  if (cfg && store.get('blank') !== '1' && JSON.stringify(cfg) !== JSON.stringify(blankCfg())) state.cfg = Object.assign(blankCfg(), cfg);
  else if (store.get('blank') !== '1') { state.cfg = EX_CFG(); setExample(true); }
  else if (cfg) state.cfg = Object.assign(blankCfg(), cfg);
  state.cfg.vis = TB.cleanVis(state.cfg.vis);
  state.cfg.custom = TB.cleanCustom(state.cfg.custom);
  const b = state.cfg.base; state.cfg.base = b && typeof b === 'object' && !Array.isArray(b) && b.visualStyles && typeof b.visualStyles === 'object' && !Array.isArray(b.visualStyles) ? b : null;
  if (typeof state.cfg.baseName !== 'string') state.cfg.baseName = '';
  if (!(+state.cfg.count >= 1 && +state.cfg.count <= 40)) state.cfg.count = 8;
  if (!state.cfg.overrides || typeof state.cfg.overrides !== 'object') state.cfg.overrides = {};
  renderAll();
  const change = full => { leaveExample(); try { localStorage.removeItem(PREFIX + 'blank'); } catch (e) {} if (full) renderAll(); else refresh(); persist(); };
  document.addEventListener('input', e => {
    const k = e.target.dataset.c;
    if (k) { if (setColor(k, e.target.value)) { const hx = document.querySelector('[data-h="' + k + '"]'); if (hx) hx.value = TB.norm(e.target.value); if (k.startsWith('seed')) { state.cfg.overrides = {}; } change(false); if (k.startsWith('seed')) { /* seeds re-rendered lazily */ } } return; }
    const h = e.target.dataset.h;
    if (h) { if (setColor(h, e.target.value)) { if (h.startsWith('seed')) state.cfg.overrides = {}; change(false); const p = document.querySelector('[data-c="' + h + '"]'); if (p) p.value = TB.norm(e.target.value); e.target.classList.remove('bad'); } else e.target.classList.add('bad'); }
  });
  document.addEventListener('change', e => { if (e.target.dataset.c && e.target.dataset.c.startsWith('seed')) renderSeeds(); });
  $('tName').addEventListener('input', () => { state.cfg.name = $('tName').value; change(false); });
  $('addSeed').addEventListener('click', () => { const c = state.cfg; if (c.seeds.length < 3) { const p = TB.palette(c.seeds, c.seeds.length + 1, 'varied'); c.seeds.push(p[c.seeds.length]); c.overrides = {}; change(true); } });
  $('seeds').addEventListener('click', e => { const b = e.target.closest('[data-rmseed]'); if (!b) return; state.cfg.seeds.splice(+b.dataset.rmseed, 1); state.cfg.overrides = {}; change(true); });
  $('style').addEventListener('change', () => { state.cfg.style = $('style').value; state.cfg.overrides = {}; change(true); });
  $('count').addEventListener('change', () => { state.cfg.count = +$('count').value; change(true); });
  $('resetPalette').addEventListener('click', () => { state.cfg.overrides = {}; change(true); });
  $('swatches').addEventListener('click', e => {
    const t = e.target.closest('[data-alt]');
    if (t) { const i = +t.dataset.alt; state.alt = state.alt === i ? -1 : i; renderSwatches(); const f = state.alt >= 0 ? document.querySelector('#altPanel [data-pick]') : document.querySelector('[data-alt="' + i + '"]'); if (f) f.focus(); return; }
    if (e.target.closest('[data-altclose]')) { const i = state.alt; state.alt = -1; renderSwatches(); const b = document.querySelector('[data-alt="' + i + '"]'); if (b) b.focus(); return; }
    const pk = e.target.closest('[data-pick]');
    if (pk && state.alt >= 0 && setColor('dc' + state.alt, pk.dataset.pick)) { change(true); const f = document.querySelector('#altPanel [data-pick]'); if (f) f.focus(); }
  });
  $('bgPresets').addEventListener('click', e => { const b = e.target.closest('[data-bg]'); if (!b) return; state.cfg.background = b.dataset.bg; if (state.cfg.textMode === 'custom' && TB.contrast(state.cfg.textColor, surface()) < 4.5) state.cfg.textColor = TB.isDark(surface()) ? '#F3F2F1' : '#252423'; change(false); });
  $('visPresets').addEventListener('click', e => { const b = e.target.closest('[data-vis]'); if (!b) return; state.cfg.visualBg = b.dataset.vis; if (state.cfg.textMode === 'custom' && TB.contrast(state.cfg.textColor, surface()) < 4.5) state.cfg.textColor = TB.isDark(surface()) ? '#F3F2F1' : '#252423'; change(false); });
  $('sentPresets').addEventListener('click', e => { const b = e.target.closest('[data-sent]'); if (!b) return; const p = SENT_PRESETS[+b.dataset.sent]; Object.assign(state.cfg, { good: p[1], neutral: p[2], bad: p[3] }); change(false); });
  $('textMode').addEventListener('change', () => { state.cfg.textMode = $('textMode').value; change(false); });
  $('font').addEventListener('change', () => { state.cfg.font = $('font').value; change(false); });
  // a visual setting: '' goes back to the default (or to All visuals for a kind of visual)
  const onVis = e => {
    const el = e.target.closest('[data-vk]'); if (!el) return;
    const v = state.cfg.vis, g = el.dataset.vg, k = el.dataset.vk;
    const s = g === 'all' ? v.all : (v.groups[g] = v.groups[g] || {});
    if (el.value) s[k] = el.value; else delete s[k];
    if (g !== 'all' && !Object.keys(s).length) delete v.groups[g];
    el.classList.toggle('set', !!el.value);
    if (g === 'all') renderVisGroups();
    else { const d = el.closest('details'), gr = TB.VIS_GROUPS.find(x => x.id === g); if (d && gr) d.querySelector('summary').innerHTML = visSummary(gr); $('resetVis').hidden = !Object.keys(v.all).length && !Object.keys(v.groups).length; }
    change(false);
  };
  $('visAll').addEventListener('change', onVis); $('visGroups').addEventListener('change', onVis);
  $('resetVis').addEventListener('click', () => { state.cfg.vis = { all: {}, groups: {} }; change(true); });
  // every property
  $('propType').addEventListener('change', () => { propState.type = $('propType').value; propState.obj = ''; renderPropPickers(); renderProps(); });
  $('propObj').addEventListener('change', () => { propState.obj = $('propObj').value; renderProps(); });
  $('propFind').addEventListener('input', () => { propState.find = $('propFind').value; renderProps(); });
  const afterCustom = () => { const id = document.activeElement && document.activeElement.id; renderProps(); renderCustomList(); change(false); const el = id && document.getElementById(id); if (el) el.focus(); };
  $('propRows').addEventListener('input', e => { const id = e.target.dataset.pcol; if (id) { const hx = document.getElementById(id); if (hx) hx.value = TB.norm(e.target.value); } });
  $('propRows').addEventListener('change', e => {
    const el = e.target, t = propState.type;
    if (el.dataset.pcol) { const hx = document.getElementById(el.dataset.pcol); if (!hx) return; setCustom(t, hx.dataset.po, hx.dataset.pp, { solid: { color: TB.norm(el.value) } }); return afterCustom(); }
    const o = el.dataset.po, p = el.dataset.pp; if (!o || !p) return;
    const so = TB.schemaObjects(t), spec = so && so[o] && so[o].props[p]; if (!spec) return;
    const raw = el.value.trim(); let v;
    if (raw === '') v = undefined;
    else if (spec[0] === 'b') v = raw === 'true';
    else if (spec[0] === 'e') { try { v = JSON.parse(raw); } catch (x) { v = undefined; } }
    else if (spec[0] === 'c') { if (!TB.norm(raw)) { el.classList.add('bad'); return; } v = { solid: { color: TB.norm(raw) } }; }
    else if (spec[0] === 's') v = raw;
    else v = parseFloat(raw);
    v = v === undefined ? undefined : TB.fitValue(spec, v);
    if (raw !== '' && v === undefined) { el.classList.add('bad'); return; }
    setCustom(t, o, p, v); afterCustom();
  });
  document.addEventListener('click', e => { const b = e.target.closest('[data-prm]'); if (!b) return; const [t, o, p] = b.dataset.prm.split('|'); setCustom(t, o, p, undefined); renderProps(); renderCustomList(); change(false); });
  $('resetCustom').addEventListener('click', () => { state.cfg.custom = {}; renderProps(); renderCustomList(); change(false); });
  // visuals from a report
  $('pickReport').addEventListener('click', () => $('reportInput').click());
  $('openVisual').addEventListener('click', () => $('visualInput').click());
  [['reportInput', 'folder'], ['visualInput', 'files']].forEach(([id, how]) => $(id).addEventListener('change', e => { const fl = e.target.files; if (!fl || !fl.length) return; readAll(fl).then(files => { readFiles(files, how); e.target.value = ''; }); }));
  $('visualUse').addEventListener('click', () => readFiles([{ path: 'visual.json', text: $('visualPaste').value }], 'paste'));
  $('fromVisual').addEventListener('input', e => { if (e.target.id === 'fvFind') syncFound(); });
  $('fromVisual').addEventListener('change', e => {
    const pg = e.target.dataset.fpage;
    if (pg !== undefined) { const g = e.target.closest('[data-fpg]'); g.querySelectorAll('[data-fvi]:not([hidden]) [data-fv]:not(:disabled)').forEach(x => { x.checked = e.target.checked; }); }
    if (pg !== undefined || e.target.dataset.fv !== undefined) syncFound();
  });
  $('fromVisual').addEventListener('click', e => {
    const all = e.target.closest('#fvAll'), none = e.target.closest('#fvNone');
    if (all || none) { $('fromVisual').querySelectorAll('[data-fvi]:not([hidden]) [data-fv]:not(:disabled)').forEach(x => { x.checked = !!all; }); syncFound(); return; }
    if (!e.target.closest('#addFound')) return;
    const picked = [...document.querySelectorAll('#fromVisual [data-fv]:checked')].map(x => found.list[+x.dataset.fv]).filter(v => v && v.known);
    if (!picked.length) return;
    let n = 0; picked.forEach(v => Object.keys(v.settings).forEach(o => Object.keys(v.settings[o]).forEach(p => { setCustom(v.type, o, p, v.settings[o][p]); n++; })));
    found.list = []; propState.type = picked[picked.length - 1].type; propState.obj = ''; propState.find = '';
    renderFound({ level: 'ok', text: 'Added ' + n + ' setting' + (n === 1 ? '' : 's') + ' from ' + picked.length + ' visual' + (picked.length === 1 ? '' : 's') + '. They\u2019re listed under Every property, where you can change or remove them.' });
    renderEvery(); change(false);
  });
  // start from a theme file
  // 'all' starts from the theme (colors, font and visual styles); 'colors' takes only its colors and font
  const COLOR_KEYS = ['seeds', 'count', 'background', 'visualBg', 'textMode', 'textColor', 'good', 'neutral', 'bad', 'font'];
  const useTheme = (text, mode, msgEl) => {
    const r = TB.readTheme(text), msg = msgEl || $('themeMsg');
    if (r.error) { msg.innerHTML = '<div class="msg err">' + esc(r.error) + '</div>'; return; }
    let c;
    if (mode === 'colors') { c = Object.assign({}, state.cfg); COLOR_KEYS.forEach(k => { if (r.patch[k] !== undefined) c[k] = r.patch[k]; }); if (!c.name && r.patch.name) c.name = r.patch.name; c.style = 'varied'; }
    else c = Object.assign(blankCfg(), r.patch, { base: r.base.visualStyles ? r.base : null, baseName: r.name || '' });
    c.overrides = {};
    if (r.patch.colors) { const pal = TB.palette(c.seeds, c.count, c.style); r.patch.colors.forEach((h, i) => { if (i && pal[i] !== h) c.overrides[i] = h; }); }
    delete c.colors;
    state.cfg = c; state.alt = -1;
    msg.innerHTML = '<div class="msg ok">' + (mode === 'colors' ? 'Colors taken from ' + esc(r.name || 'the theme') + '. They&rsquo;re in Steps 1 and 2; your visual settings stayed.' : 'Theme loaded' + (r.name ? ': ' + esc(r.name) : '') + '. Its colors are in Step 2 and its visual styles are the starting point for Step 3.') + '</div>';
    $('themePaste').value = '';
    change(true);
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-tuse]'); if (!b) return;
    const t = pbip.themes[0], box = b.closest('.theme-ask'), mode = b.dataset.tuse;
    pbip.themes = []; renderThemeAsk();
    if (!t || mode === 'keep') return;
    const msg = box && box.id === 'themeAsk1' ? $('themeMsg') : $('themeDone3');
    useTheme(t.text, mode, msg);
  });
  $('pickReportTheme').addEventListener('click', () => $('reportThemeInput').click());
  $('reportThemeInput').addEventListener('change', e => { const fl = e.target.files; if (!fl || !fl.length) return; readAll(fl).then(files => { readFiles(files, 'step1'); e.target.value = ''; }); });
  $('openTheme').addEventListener('click', () => $('themeFile').click());
  $('themeFile').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (!f) return; f.text().then(t => useTheme(t), () => {}); e.target.value = ''; });
  $('themeUse').addEventListener('click', () => useTheme($('themePaste').value));
  $('baseNote').addEventListener('click', e => { if (!e.target.closest('#dropBase')) return; state.cfg.base = null; state.cfg.baseName = ''; change(true); });
  $('bubble').addEventListener('change', () => { state.cfg.bubble = +$('bubble').value || 0; change(false); });
  $('download').addEventListener('click', () => {
    if (!state.out.json) return;
    const url = URL.createObjectURL(new Blob([state.out.json], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = state.fileName; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  });
  $('clearAll').addEventListener('click', () => { resetAll(); try { localStorage.setItem(PREFIX + 'blank', '1'); } catch (e) {} persist(); });
  document.addEventListener('click', e => { const b = e.target.closest('[data-copy]'); if (b && state.out[b.dataset.copy]) copyText(state.out[b.dataset.copy], b); });
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
