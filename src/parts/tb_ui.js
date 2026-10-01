
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
const SENT_PRESETS = [['Green / red', '#0F6E3A', '#8C8C8C', '#E8615A'], ['Blue / orange (color-blind safe)', '#1D6FA3', '#8C8C8C', '#E07B39']];
const blankCfg = () => ({ name: '', seeds: ['#1F6FB2'], style: 'varied', count: 8, overrides: {}, background: '#FFFFFF', visualBg: 'transparent', textMode: 'brand', textColor: '#252423', font: 'Segoe UI', good: '#0F6E3A', neutral: '#8C8C8C', bad: '#E8615A' });
const EX_CFG = () => Object.assign(blankCfg(), { name: 'Contoso Retail', seeds: ['#1F6FB2', '#7A4FA3'], visualBg: '#F3F4F6' });
const state = { example: false, cfg: blankCfg(), out: {} };

function persist(){ store.set('cfg', JSON.stringify(state.example ? blankCfg() : state.cfg)); }
function setExample(on){ state.example = on; $('exampleBanner').hidden = !on; }
function leaveExample(){ if (state.example) setExample(false); }

function dataColors(){
  const c = state.cfg;
  const base = TB.palette(c.seeds, +c.count || 8, c.style);
  return base.map((h, i) => TB.norm(c.overrides[i]) || h);
}
function opts(){ const c = state.cfg; return { name: c.name, dataColors: dataColors(), background: c.background, visualBg: c.visualBg, textMode: c.textMode, textColor: c.textColor, font: c.font, good: c.good, neutral: c.neutral, bad: c.bad }; }

// what text and chart marks sit on: the visual background, or the page when visuals are transparent
function surface(){ const c = state.cfg; return TB.norm(c.visualBg) || TB.norm(c.background) || '#FFFFFF'; }

/* a color picker paired with a hex box */
function colorRow(key, label, value, extra){
  return '<div class="crow-in"><label class="cpick"><input type="color" data-c="' + key + '" value="' + esc(TB.norm(value) || '#000000') + '" aria-label="' + esc(label) + '"></label>'
    + '<div class="cmeta"><span class="clabel">' + esc(label) + '</span><input type="text" class="hex" data-h="' + key + '" value="' + esc(TB.norm(value) || value || '') + '" spellcheck="false" aria-label="' + esc(label) + ' hex code"></div>' + (extra || '') + '</div>';
}
function badge(fg, bg){
  const r = TB.contrast(fg, bg), cls = r >= 4.5 ? 'ok' : r >= 3 ? 'warn' : 'err';
  return '<span class="cr ' + cls + '" title="Contrast with the background it sits on">' + r.toFixed(1) + ':1</span>';
}
function renderSeeds(){
  const c = state.cfg;
  $('seeds').innerHTML = c.seeds.map((s, i) => '<div class="seed">' + colorRow('seed' + i, i ? 'Brand color ' + (i + 1) : 'Main brand color', s, i ? '<button type="button" class="ib" data-rmseed="' + i + '" aria-label="Remove brand color ' + (i + 1) + '">&#10005;</button>' : '') + '</div>').join('');
  $('addSeed').hidden = c.seeds.length >= 3;
  $('style').value = c.style; $('count').value = String(c.count);
  if (document.activeElement !== $('tName')) $('tName').value = c.name;
}
function renderSwatches(){
  const c = state.cfg, dc = dataColors();
  $('swatches').innerHTML = dc.map((h, i) => '<div class="sw' + (c.overrides[i] ? ' changed' : '') + '">' + colorRow('dc' + i, (i + 1) + (i < c.seeds.length ? ' · brand' : ''), h, badge(h, surface())) + '</div>').join('');
  $('resetPalette').hidden = !Object.keys(c.overrides).length;
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
  $('font').value = c.font;
  $('sentPresets').innerHTML = SENT_PRESETS.map(([n, g, u, b], i) => '<button type="button" class="chip" data-sent="' + i + '" aria-pressed="' + (TB.norm(c.good) === g && TB.norm(c.bad) === b) + '"><span class="dot" style="background:' + g + '"></span><span class="dot" style="background:' + b + '"></span>' + esc(n) + '</button>').join('');
  $('goodRow').innerHTML = colorRow('good', 'Good / increase', c.good);
  $('neutralRow').innerHTML = colorRow('neutral', 'Neutral / other', c.neutral);
  $('badRow').innerHTML = colorRow('bad', 'Bad / decrease', c.bad);
}

/* ---------- preview: a sketch of a report page ---------- */
function renderPreview(){
  const o = opts(), r = TB.roles(o), dc = r.dataColors;
  if (!dc.length) { $('preview').innerHTML = ''; return; }
  const col = i => dc[i % dc.length];
  const font = "'" + (state.cfg.font || 'Segoe UI').replace(/'/g, '') + "', 'Segoe UI', Arial, sans-serif";
  const cards = [['Sales', '$4.21M'], ['Orders', '18,940'], ['Margin %', '38.2%']].map(([l, v]) => '<div class="pv-card" style="' + (r.visual ? 'background:' + r.visual + ';' : 'box-shadow:none;outline:1px dashed ' + r.grey10 + ';') + 'border-top:5px solid ' + dc[0] + '"><div class="pv-cl" style="color:' + dc[0] + '">' + l + '</div><div class="pv-cv" style="color:' + dc[0] + '">' + v + '</div></div>').join('');
  // clustered columns: 4 months x 3 series
  const vals = [[62, 48, 30], [70, 52, 36], [66, 58, 41], [80, 61, 44]], W = 300, H = 150;
  let bars = ''; vals.forEach((g, i) => g.forEach((v, j) => { const x = 18 + i * 70 + j * 18; bars += '<rect x="' + x + '" y="' + (H - 20 - v * 1.4) + '" width="15" height="' + (v * 1.4) + '" fill="' + col(j) + '" rx="1.5"/>'; }));
  const axis = ['Jan', 'Feb', 'Mar', 'Apr'].map((m, i) => '<text x="' + (40 + i * 70) + '" y="' + (H - 5) + '" font-size="10" fill="' + r.grey70 + '" text-anchor="middle">' + m + '</text>').join('');
  const grid = [40, 70, 100].map(y => '<line x1="10" x2="' + (W - 10) + '" y1="' + y + '" y2="' + y + '" stroke="' + r.grey10 + '" stroke-dasharray="2,3"/>').join('');
  const colChart = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="pv-svg">' + grid + bars + axis + '</svg>';
  // lines
  const lp = (pts, c, w) => '<polyline fill="none" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round" points="' + pts.map((v, i) => (15 + i * 45) + ',' + (130 - v)).join(' ') + '"/>';
  const lineChart = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="pv-svg">' + grid + lp([40, 55, 50, 72, 80, 95, 110], col(0), 2.5) + lp([30, 38, 45, 42, 58, 60, 70], col(1), 2.5) + lp([20, 22, 30, 35, 33, 40, 46], col(2), 2) + '</svg>';
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
  const table = '<table class="pv-table"><thead><tr>' + ['Region', 'Sales', 'vs LY'].map(h => '<th style="background:' + dc[0] + ';color:' + r.background + '">' + h + '</th>').join('') + '</tr></thead><tbody>'
    + rows.map(([a, b, c2, s]) => '<tr style="border-bottom:1px solid ' + r.grey10 + '"><td style="color:' + dc[0] + '">' + a + '</td><td style="color:' + dc[0] + '">' + b + '</td><td style="color:' + (s === 'good' ? r.goodText : s === 'bad' ? r.badText : r.neutralText) + ';font-weight:600">' + c2 + '</td></tr>').join('') + '</tbody></table>';
  const box = r.visual ? 'background:' + r.visual + ';box-shadow:0 1px 3px rgba(0,0,0,.12)' : 'background:transparent;box-shadow:none;outline:1px dashed ' + r.grey10;
  const tile = (title, body) => '<div class="pv-tile" style="' + box + '"><div class="pv-title" style="color:' + dc[0] + '">' + title + '</div>' + body + '</div>';
  $('preview').style.cssText = 'background:' + r.page + ';color:' + r.text + ';font-family:' + font;
  $('preview').innerHTML = '<div class="pv-head"><div class="pv-h1" style="color:' + r.text + '">' + esc(state.cfg.name || 'Sales overview') + '</div>'
    + '<div class="pv-slicer">' + ['2024', '2025', '2026'].map((y, i) => '<span style="' + (i === 2 ? 'background:' + dc[0] + ';color:' + r.background : 'border:1px solid ' + r.grey10 + ';color:' + r.text) + '">' + y + '</span>').join('') + '</div></div>'
    + '<div class="pv-cards">' + cards + '</div>'
    + '<div class="pv-grid">' + tile('Sales by month and channel', colChart) + tile('Sales trend', lineChart) + tile('Sales by channel', donutChart) + tile('Sales bridge', wfChart) + tile('Sales by region', table)
    + tile('Text styles', '<div class="pv-text"><div style="font-size:18px;font-weight:700;color:' + dc[0] + '">Title</div><div style="color:' + r.text + '">Body text and labels</div><div style="color:' + r.grey70 + '">Secondary text</div><div style="color:' + r.grey45 + '">Light label</div><div><a style="color:' + TB.readable(r.brand, r.background, 4.5) + '">A link</a></div></div>') + '</div>';
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
function renderAll(){ renderSeeds(); renderSwatches(); renderSettings(); renderPreview(); renderOut(); }
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
  document.querySelectorAll('#sentPresets [data-sent]').forEach(b => { const p = SENT_PRESETS[+b.dataset.sent]; b.setAttribute('aria-pressed', TB.norm(c.good) === p[1] && TB.norm(c.bad) === p[3]); });
  $('textRow').hidden = c.textMode !== 'custom';
  $('resetPalette').hidden = !Object.keys(c.overrides).length;
}
function refresh(){ syncValues(); renderPreview(); renderOut(); }

/* ---------- init ---------- */
function setColor(key, hex){
  const c = state.cfg, h = TB.norm(hex); if (!h) return false;
  if (key.startsWith('seed')) c.seeds[+key.slice(4)] = h;
  else if (key.startsWith('dc')) { const i = +key.slice(2), base = TB.palette(c.seeds, +c.count || 8, c.style)[i]; if (base === h) delete c.overrides[i]; else c.overrides[i] = h; }
  else c[key] = h;
  return true;
}
function resetAll(){ state.cfg = blankCfg(); setExample(false); renderAll(); }
function init(){
  let cfg = null; try { cfg = JSON.parse(store.get('cfg') || 'null'); } catch (e) {}
  if (cfg && store.get('blank') !== '1' && JSON.stringify(cfg) !== JSON.stringify(blankCfg())) state.cfg = Object.assign(blankCfg(), cfg);
  else if (store.get('blank') !== '1') { state.cfg = EX_CFG(); setExample(true); }
  else if (cfg) state.cfg = Object.assign(blankCfg(), cfg);
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
  $('bgPresets').addEventListener('click', e => { const b = e.target.closest('[data-bg]'); if (!b) return; state.cfg.background = b.dataset.bg; if (state.cfg.textMode === 'custom' && TB.contrast(state.cfg.textColor, surface()) < 4.5) state.cfg.textColor = TB.isDark(surface()) ? '#F3F2F1' : '#252423'; change(false); });
  $('visPresets').addEventListener('click', e => { const b = e.target.closest('[data-vis]'); if (!b) return; state.cfg.visualBg = b.dataset.vis; if (state.cfg.textMode === 'custom' && TB.contrast(state.cfg.textColor, surface()) < 4.5) state.cfg.textColor = TB.isDark(surface()) ? '#F3F2F1' : '#252423'; change(false); });
  $('sentPresets').addEventListener('click', e => { const b = e.target.closest('[data-sent]'); if (!b) return; const p = SENT_PRESETS[+b.dataset.sent]; Object.assign(state.cfg, { good: p[1], neutral: p[2], bad: p[3] }); change(false); });
  $('textMode').addEventListener('change', () => { state.cfg.textMode = $('textMode').value; change(false); });
  $('font').addEventListener('change', () => { state.cfg.font = $('font').value; change(false); });
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
