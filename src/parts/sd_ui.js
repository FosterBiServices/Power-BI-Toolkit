/* ---------- Sample Data Maker: page ---------- */
const $ = id => document.getElementById(id);
const PREFIX = 'ksd.';
const store = {
  get(k){ try { return localStorage.getItem(PREFIX + k); } catch (e) { return null; } },
  set(k, v){ try { localStorage.setItem(PREFIX + k, v); } catch (e) {} },
  del(k){ try { localStorage.removeItem(PREFIX + k); } catch (e) {} }
};
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function msg(level, html){ return '<div class="msg ' + level + '">' + html + '</div>'; }
function copyText(text, btn){
  const done = () => { const o = btn.dataset.label || btn.textContent; btn.dataset.label = o; btn.textContent = 'Copied'; btn.classList.add('done'); setTimeout(() => { btn.textContent = o; btn.classList.remove('done'); }, 1600); };
  const fallback = () => {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    if (ok) done(); else { btn.textContent = 'Select and copy manually'; setTimeout(() => { btn.textContent = btn.dataset.label || 'Copy'; }, 2200); }
  };
  try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
}
function download(name, blob){
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
const TMDL_KW = /^(\s*)(createOrReplace|table|column|measure|partition|function|relationship|annotation|dataType|dataCategory|isKey|isHidden|isActive|formatString|summarizeBy|sourceColumn|sortByColumn|isNameInferred|isDataTypeInferred|displayFolder|fromColumn|toColumn|mode|source)\b/;
function hlTmdl(code){
  return code.split('\n').map(line => /^\s*(\/\/\/|--)/.test(line) ? '<span class="tok-com">' + esc(line) + '</span>' : esc(line).replace(TMDL_KW, '$1<span class="tok-kw">$2</span>').replace(/(&quot;[^&]*?&quot;)/g, '<span class="tok-str">$1</span>')).join('\n');
}
const randSeed = () => 1 + Math.floor(Math.random() * 999998);
const today = () => { const n = new Date(); return SD.serial(n.getFullYear(), n.getMonth() + 1, n.getDate()); };
const isoOf = s => { const [y, m, d] = SD.ymd(s); return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'); };
const serialOf = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? SD.serial(+m[1], +m[2], +m[3]) : null; };

/* ---------- state ---------- */
function makeDefaults(){
  const t = today(), [y, m] = SD.ymd(t);
  return { ind: 'retail', sizes: {}, start: SD.serial(y - 2, 1, 1), end: SD.serial(y, m, 1) - 1, seed: 1, style: 'udf', measures: true, off: {}, tab: {} };
}
const state = { mode: 'mask', example: false, tables: [], treats: {}, sugs: [], manual: [], seed: randSeed(), prevTable: '', prevSide: 'after', make: makeDefaults(), masked: null, ver: 0, maskedVer: -1 };
let tid = 0;
function persist(){
  store.set('mode', state.mode); store.set('mask', JSON.stringify({ seed: state.seed })); store.set('make', JSON.stringify(state.make));
}
function leaveExample(){ if (!state.example) return; state.example = false; state.tables = []; state.treats = {}; state.sugs = []; state.manual = []; showBanner(); }
function showBanner(){ $('exampleBanner').hidden = !(state.example && state.mode === 'mask'); }

/* ---------- reading files ---------- */
function cellOf(c, csv, d1904){
  if (!c || c.v === undefined || c.v === null || (c.t === 's' && String(c.v).trim() === '')) return { k: 'empty' };
  if (c.t === 'n') return c.z && XLSX.SSF.is_date(c.z) ? { k: 'date', v: c.v + (d1904 ? 1462 : 0), z: c.z } : { k: 'num', v: c.v, z: c.z };
  if (c.t === 'b') return { k: 'bool', v: !!c.v };
  if (c.t === 'e') return { k: 'text', v: c.w || '' };
  if (c.t === 'd') { const d = new Date(c.v); return { k: 'date', v: SD.serial(d.getFullYear(), d.getMonth() + 1, d.getDate()), z: 'yyyy-mm-dd' }; }
  return SDM.fromText(c.v, csv);
}
function sheetToTable(ws, file, sheet, csv, d1904){
  if (!ws || !ws['!ref']) return null;
  const r = XLSX.utils.decode_range(ws['!ref']);
  const at = (R, C) => cellOf(ws[XLSX.utils.encode_cell({ r: R, c: C })], csv, d1904);
  let h = r.s.r; while (h <= r.e.r) { let any = false; for (let C = r.s.c; C <= r.e.c; C++) if (at(h, C).k !== 'empty') { any = true; break; } if (any) break; h++; }
  if (h > r.e.r) return null;
  let lastC = r.e.c; while (lastC > r.s.c && at(h, lastC).k === 'empty') lastC--;
  const seen = {}, headers = [];
  for (let C = r.s.c; C <= lastC; C++) { const x = at(h, C); let name = x.k === 'empty' ? 'Column ' + (C - r.s.c + 1) : SDM.show(x).trim() || 'Column ' + (C - r.s.c + 1); if (seen[name.toLowerCase()]) name += ' ' + (++seen[name.toLowerCase()]); else seen[name.toLowerCase()] = 1; headers.push(name); }
  const rows = [];
  for (let R = h + 1; R <= r.e.r; R++) { const row = []; for (let C = r.s.c; C <= lastC; C++) row.push(at(R, C)); rows.push(row); }
  while (rows.length && rows[rows.length - 1].every(x => x.k === 'empty')) rows.pop();
  const t = { id: 't' + (++tid), file, sheet, csv, d1904, headers, rows, cols: ws['!cols'] };
  if (csv) SDM.fixDateOrder(t);
  return t;
}
async function readFile(f){
  const csv = /\.(csv|tsv|txt)$/i.test(f.name);
  if (typeof XLSX === 'undefined') throw new Error('The spreadsheet reader didn’t load. Check your internet connection and reload the page.');
  const wb = csv ? XLSX.read(await f.text(), { type: 'string', raw: true, FS: /\.tsv$/i.test(f.name) ? '\t' : undefined }) : XLSX.read(await f.arrayBuffer(), { type: 'array', cellNF: true, cellDates: false });
  const d1904 = !!(wb.Workbook && wb.Workbook.WBProps && wb.Workbook.WBProps.date1904);
  return wb.SheetNames.map(s => sheetToTable(wb.Sheets[s], f.name, csv ? f.name.replace(/\.[^.]+$/, '') : s, csv, d1904)).filter(Boolean);
}
async function addFiles(list){
  const out = [], errs = [];
  for (const f of list) {
    try { const ts = await readFile(f); if (!ts.length) errs.push(esc(f.name) + ': no data found.'); out.push(...ts); }
    catch (e) { errs.push(esc(f.name) + ': ' + esc(e.message || 'couldn’t be read.')); }
  }
  if (out.length) {
    leaveExample(); store.del('blank');
    const names = new Set(out.map(t => t.file));
    state.tables = state.tables.filter(t => !names.has(t.file)).concat(out);
    out.forEach(t => { state.treats[t.id] = t.headers.map((h, c) => SDM.detect(t, c)); });
    refreshLinks();
  }
  $('fileMsg').innerHTML = errs.length ? msg('err', errs.join('<br>')) : '';
  changed(); persist();
}
function refreshLinks(){
  const old = new Map(state.sugs.map(s => [s.a.join() + '|' + s.b.join(), s.on]));
  state.sugs = SDM.suggestLinks(state.tables, state.treats).map(s => Object.assign(s, { on: old.has(s.a.join() + '|' + s.b.join()) ? old.get(s.a.join() + '|' + s.b.join()) : true }));
  const ids = new Set(state.tables.map(t => t.id));
  state.manual = state.manual.filter(l => ids.has(l.a[0]) && ids.has(l.b[0]));
}
const links = () => state.sugs.filter(s => s.on).concat(state.manual);
const tableById = id => state.tables.find(t => t.id === id);
function colName(t, c){ const dup = state.tables.filter(x => x.sheet === t.sheet).length > 1; return (dup ? t.file + ' ' : '') + t.sheet + '[' + t.headers[c] + ']'; }

/* ---------- mask: render ---------- */
function maskResult(){
  if (state.maskedVer !== state.ver) { state.masked = state.tables.length ? SDM.run(state.tables, { seed: state.seed, treats: state.treats, links: links() }) : null; state.maskedVer = state.ver; }
  return state.masked;
}
function renderFiles(){
  const files = []; state.tables.forEach(t => { let f = files.find(x => x.name === t.file); if (!f) files.push(f = { name: t.file, sheets: 0, rows: 0 }); f.sheets++; f.rows += t.rows.length; });
  $('fileList').innerHTML = files.map(f => '<span class="fchip"><b>' + esc(f.name) + '</b> <span class="muted">' + f.sheets + (f.sheets === 1 ? ' table' : ' tables') + ', ' + f.rows.toLocaleString() + ' rows</span>'
    + (state.example ? '' : '<button type="button" data-rmfile="' + esc(f.name) + '" aria-label="Remove ' + esc(f.name) + '">&times;</button>') + '</span>').join('');
}
function groupMembers(){
  const g = SDM.groups(state.tables, links()), by = {};
  Object.keys(g).forEach(k => { (by[g[k]] = by[g[k]] || []).push(k); });
  return { g, by };
}
function renderCols(){
  if (!state.tables.length) { $('colCards').innerHTML = '<p class="note">Load a file in Step 2 to see its columns here.</p>'; return; }
  const { g, by } = groupMembers();
  const opts = sel => SDM.TREATS.map(o => '<option value="' + o[0] + '"' + (o[0] === sel ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('');
  $('colCards').innerHTML = state.tables.map(t => '<div class="tcard"><div class="tcard-head"><b>' + esc(t.sheet) + '</b><span class="muted">' + esc(t.file) + ' &middot; ' + t.rows.length.toLocaleString() + ' rows</span></div>'
    + '<div class="tablewrap"><table class="cols"><thead><tr><th>Column</th><th>Values</th><th>Change to</th></tr></thead><tbody>'
    + t.headers.map((h, c) => {
      const vals = []; const seen = new Set();
      for (const r of t.rows) { const x = r[c]; if (!x || x.k === 'empty') continue; const s = SDM.show(x); if (!seen.has(s)) { seen.add(s); vals.push(s.length > 32 ? s.slice(0, 31) + '…' : s); } if (vals.length >= 3) break; }
      const members = by[g[t.id + ':' + c]] || [];
      const linked = members.length > 1 ? '<span class="pill replace" title="' + esc('Linked with ' + members.filter(m => m !== t.id + ':' + c).map(m => { const [ti, ci] = m.split(':'); const tt = tableById(ti); return tt ? colName(tt, +ci) : ''; }).join(', ')) + '">Linked</span>' : '';
      return '<tr><td class="nm">' + esc(h) + ' ' + linked + '</td><td class="vals">' + vals.map(esc).join('<br>') + '</td><td><select data-t="' + t.id + '" data-c="' + c + '" aria-label="' + esc('Change ' + h + ' to') + '">' + opts(state.treats[t.id][c]) + '</select></td></tr>';
    }).join('') + '</tbody></table></div></div>').join('');
}
function renderLinks(){
  const pct = s => Math.round(s.score * 100) + '% of values match' + (s.same ? ', same name' : '');
  const name = l => { const a = tableById(l.a[0]), b = tableById(l.b[0]); return a && b ? esc(colName(a, l.a[1])) + ' &harr; ' + esc(colName(b, l.b[1])) : ''; };
  const rows = state.sugs.map((s, i) => '<label class="lrow"><input type="checkbox" data-sug="' + i + '"' + (s.on ? ' checked' : '') + '> <span><span class="mono">' + name(s) + '</span> <span class="muted">' + pct(s) + '</span></span></label>')
    .concat(state.manual.map((l, i) => '<div class="lrow"><span><span class="mono">' + name(l) + '</span> <span class="muted">added by you</span></span><button type="button" class="linkbtn" data-rmlink="' + i + '">Remove</button></div>'));
  $('linkList').innerHTML = rows.length ? rows.join('') : '<p class="note">' + (state.tables.length > 1 ? 'No links found between these tables. Add one below if two columns hold the same keys.' : 'Links appear here once two or more tables are loaded.') + '</p>';
  const all = []; state.tables.forEach(t => t.headers.forEach((h, c) => all.push('<option value="' + t.id + ':' + c + '">' + esc(colName(t, c)) + '</option>')));
  const keepA = $('linkA').value, keepB = $('linkB').value;
  $('linkA').innerHTML = all.join(''); $('linkB').innerHTML = all.join('');
  if (keepA) $('linkA').value = keepA; if (keepB) $('linkB').value = keepB;
  else if (all.length > 1) $('linkB').selectedIndex = Math.min(1, all.length - 1);
  $('addLink').disabled = state.tables.length < 2;
  $('linkA').closest('.addlink').hidden = state.tables.length < 2;
}
function previewTable(headers, rows, n){
  return '<div class="tablewrap"><table class="prev"><thead><tr>' + headers.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>'
    + rows.slice(0, n).map(r => '<tr>' + r.map(x => '<td>' + esc(typeof x === 'string' ? x : SDM.show(x)) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
}
function renderMaskOut(){
  $('maskSeed').value = state.seed;
  document.querySelectorAll('input[name=prevSide]').forEach(r => { r.checked = r.value === state.prevSide; });
  if (!state.tables.length) { $('prevTable').innerHTML = ''; $('maskPreview').innerHTML = ''; $('downloads').innerHTML = ''; $('maskMsg').innerHTML = ''; return; }
  if (!tableById(state.prevTable)) state.prevTable = state.tables[0].id;
  $('prevTable').innerHTML = state.tables.map(t => '<option value="' + t.id + '"' + (t.id === state.prevTable ? ' selected' : '') + '>' + esc(colName(t, 0).replace(/\[.*$/, '')) + '</option>').join('');
  const res = maskResult(), i = state.tables.findIndex(t => t.id === state.prevTable), t = state.tables[i];
  const rows = state.prevSide === 'before' ? t.rows : res.tables[i].rows;
  $('maskPreview').innerHTML = previewTable(t.headers, rows, 10) + '<p class="note">First ' + Math.min(10, rows.length) + ' of ' + rows.length.toLocaleString() + ' rows.</p>';
  const kept = state.tables.reduce((s, x) => s + state.treats[x.id].filter(v => v === 'keep').length, 0), total = state.tables.reduce((s, x) => s + x.headers.length, 0);
  $('maskMsg').innerHTML = kept === total ? msg('warn', 'Every column is set to <b>Keep as is</b>, so nothing changes. Pick what to change in Step 3.') : '';
  const files = Array.from(new Set(state.tables.map(x => x.file)));
  $('downloads').innerHTML = files.map(f => '<button type="button" class="btn' + (files.length === 1 ? ' primary' : '') + '" data-dl="' + esc(f) + '">Download ' + esc(outName(f)) + '</button>').join('')
    + (files.length > 1 ? '<button type="button" class="btn primary" id="dlAll">Download all ' + files.length + '</button>' : '');
}
const outName = f => f.replace(/\.[^.]+$/, '') + ' (masked).xlsx';
function writeFile(file){
  const res = maskResult(), wb = XLSX.utils.book_new(), used = new Set();
  state.tables.forEach((t, i) => {
    if (t.file !== file) return;
    const rows = res.tables[i].rows;
    const val = x => x.k === 'empty' ? null : x.k === 'tdate' ? SDM.formatTextDate(x.v, x.p) : x.k === 'date' ? x.v - (t.d1904 ? 1462 : 0) : x.v;
    const ws = XLSX.utils.aoa_to_sheet([t.headers].concat(rows.map(r => r.map(val))));
    rows.forEach((r, ri) => r.forEach((x, ci) => {
      const a = XLSX.utils.encode_cell({ r: ri + 1, c: ci }), c = ws[a];
      if (!c) return;
      if (x.k === 'date') { c.t = 'n'; c.z = x.z || 'yyyy-mm-dd'; }
      else if (x.k === 'num' && x.z && x.z !== 'General') c.z = x.z;
    }));
    if (t.cols) ws['!cols'] = t.cols;
    let name = String(t.sheet).replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31) || 'Sheet'; let n = 2; while (used.has(name.toLowerCase())) name = name.slice(0, 28) + ' ' + (n++); used.add(name.toLowerCase());
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  XLSX.writeFile(wb, outName(file), { bookType: 'xlsx' });
}

/* ---------- make: render ---------- */
const sizeOf = (ind, key, def) => { const s = state.make.sizes[ind] || {}; return s[key] !== undefined ? s[key] : def; };
let makeCache = { key: '', model: null, counts: {}, rows: {} };
function makeArgs(model){
  const m = state.make, a = { start_date: m.start, end_date: m.end, seed: m.seed };
  model.sizes.forEach(s => { a[s[0]] = sizeOf(m.ind, s[0], s[2]); });
  return a;
}
function sourceSize(t, env){
  const s = t.stages[0];
  if (s.series) return Math.floor(s.series.f({}, env));
  if (s.calendar) return s.calendar[1].f({}, env) - s.calendar[0].f({}, env) + 1;
  if (s.data) return s.data.rows.length;
  return s.grid.reduce((p, g) => p * (g.days ? g.days[1].f({}, env) - g.days[0].f({}, env) + 1 : Math.floor(g.n.f ? g.n.f({}, env) : g.n) + (g.from === 0 ? 1 : 0)), 1);
}
function makeModel(){
  const m = state.make, key = JSON.stringify([m.ind, m.sizes[m.ind] || {}, m.start, m.end, m.seed]);
  if (makeCache.key === key) return makeCache;
  const ind = SD_IND.get(m.ind), model = ind.make(), args = makeArgs(model), env = { p: args, seed: m.seed };
  const counts = {}, rows = {};
  model.tables.forEach(t => {
    const n = sourceSize(t, env), lim = n > 20000 ? 4000 : 0;
    const r = SD.tableRows(t, env, lim);
    rows[t.name] = r.slice(0, 10);
    counts[t.name] = lim ? { n: Math.round(r.length * n / Math.min(lim, n) / 10) * 10, about: true } : { n: r.length };
  });
  makeCache = { key, model, args, counts, rows, ind };
  return makeCache;
}
function validMake(){
  const m = state.make, e = [];
  if (m.start === null || m.end === null) e.push('Enter a start date and an end date.');
  else if (m.end < m.start) e.push('The end date is before the start date.');
  else if (m.end - m.start > 366 * 20) e.push('Keep it to 20 years or less.');
  else if (SD.ymd(m.start)[0] < 1900) e.push('Start in 1900 or later.');
  if (!(m.seed >= 1 && m.seed <= 999999999 && Number.isInteger(m.seed))) e.push('The seed is a whole number from 1 to 999,999,999.');
  return e;
}
// does the model saved on the home page (export or PBIP folder) have a _Measures table? null when none is saved
function hasMeasuresTable(){
  let v = null; try { v = JSON.parse(localStorage.getItem('sfpbi.shared.model') || 'null'); } catch (e) {}
  if (!v || !v.text) return null;
  const cell = x => x.replace(/^"|"$/g, '').replace(/^.*\[|\]$/g, '').trim();
  let ti = -1;
  for (const l of v.text.replace(/\r/g, '').split('\n')) {
    const c = l.split('\t').map(cell);
    if (ti < 0) { if (c.some(x => x.toLowerCase() === 'kind')) ti = c.findIndex(x => x.toLowerCase() === 'table'); continue; }
    if (c[ti] === SD.MEASURES) return true;
  }
  return false;
}
function renderMake(){
  const m = state.make, ind = SD_IND.get(m.ind);
  $('industries').innerHTML = SD_IND.LIST.map(x => '<button type="button" class="ind" role="radio" aria-checked="' + (x.id === m.ind) + '" data-ind="' + x.id + '"><b>' + esc(x.name) + '</b><span>' + esc(x.blurb) + '</span><small>' + esc(x.kpis) + '</small></button>').join('');
  const model0 = ind.make();
  $('sizes').innerHTML = model0.sizes.map(s => '<div class="field"><label for="sz-' + s[0] + '">' + esc(s[1]) + '</label><input type="number" class="num" id="sz-' + s[0] + '" data-size="' + s[0] + '" min="1" max="' + s[3] + '" value="' + sizeOf(m.ind, s[0], s[2]) + '"></div>').join('');
  $('startDate').value = m.start === null ? '' : isoOf(m.start); $('endDate').value = m.end === null ? '' : isoOf(m.end); $('makeSeed').value = m.seed;
  document.querySelectorAll('input[name=style]').forEach(r => { r.checked = r.value === m.style; });
  $('addMeasures').checked = m.measures;
  const found = hasMeasuresTable();
  const mt = m.mtable || (found ? 'add' : 'new');
  document.querySelectorAll('input[name=mtable]').forEach(r => { r.checked = r.value === mt; });
  $('mtField').hidden = $('mtNote').hidden = !m.measures;
  $('mtNote').innerHTML = found === null
    ? 'No saved model to check. If your report already has a <code>_Measures</code> table, choose <b>Add to my _Measures</b>, or Power BI replaces it and the measures in it.'
    : found ? 'Your saved model has a <code>_Measures</code> table, so the measures are added to it and nothing in it is removed.'
      : 'Your saved model has no <code>_Measures</code> table, so the script creates one.';
  $('styleNote').innerHTML = m.style === 'udf'
    ? 'One DAX function per table (named <code>' + SD.PKG + '.&hellip;</code>), and each table calls its function. Needs DAX user-defined functions, a preview feature in Power BI Desktop.'
    : 'Each table holds its own DAX, with no functions. Works in any recent Power BI Desktop.';
  const errs = validMake();
  const sizeErr = model0.sizes.filter(s => { const v = sizeOf(m.ind, s[0], s[2]); return !(Number.isInteger(v) && v >= 1 && v <= s[3]); }).map(s => esc(s[1]) + ' is a whole number from 1 to ' + s[3].toLocaleString() + '.');
  const all = errs.concat(sizeErr);
  $('makeMsg').innerHTML = all.length ? msg('err', all.join('<br>')) : '';
  const off = m.off[m.ind] || [];
  $('tablePicks').innerHTML = model0.tables.map(t => '<label class="c"><input type="checkbox" data-tbl="' + esc(t.name) + '"' + (off.includes(t.name) ? '' : ' checked') + '> ' + esc(t.name) + '</label>').join('');
  ['m4', 'm5'].forEach(id => { $(id).closest('section').classList.toggle('dim', !!all.length); });
  if (all.length) { $('tmdlView').textContent = ''; state.tmdl = ''; return; }
  const c = makeModel(), on = c.model.tables.filter(t => !off.includes(t.name));
  if (!on.length) { $('makeTabs').innerHTML = ''; $('makePreview').innerHTML = msg('warn', 'Tick at least one table.'); $('tmdlView').textContent = ''; state.tmdl = ''; return; }
  let tab = m.tab[m.ind]; if (!on.some(t => t.name === tab)) tab = (on.find(t => (c.model.measures[t.name] || []).length) || on[0]).name;
  $('makeTabs').innerHTML = on.map(t => '<button type="button" class="chip" role="tab" aria-selected="' + (t.name === tab) + '" aria-pressed="' + (t.name === tab) + '" data-tab="' + esc(t.name) + '">' + esc(t.name) + ' <small>' + (c.counts[t.name].about ? 'about ' : '') + c.counts[t.name].n.toLocaleString() + ' rows</small></button>').join('');
  const t = on.find(x => x.name === tab);
  $('makeDesc').textContent = t.desc;
  const show = (v, meta) => v === null || v === undefined ? '' : meta.t === 'date' ? isoOf(v) : meta.t === 'bool' ? (v ? 'TRUE' : 'FALSE') : meta.t === 'dec' ? (/%/.test(meta.f || '') ? Math.round(v * 1000) / 10 + '%' : v.toLocaleString(undefined, { minimumFractionDigits: /0\.00/.test(meta.f || '') ? 2 : 0, maximumFractionDigits: 2 })) : meta.t === 'int' && meta.f === '#,0' ? v.toLocaleString() : String(v);
  $('makePreview').innerHTML = previewTable(t.meta.map(x => x.n), c.rows[t.name].map(r => t.meta.map(x => show(r[x.n], x))), 10);
  const ms = m.measures ? (c.model.measures[t.name] || []) : [];
  $('makeCols').innerHTML = '<div class="tablewrap"><table><thead><tr><th>Column</th><th>Type</th><th>What it holds</th></tr></thead><tbody>'
    + t.meta.map(x => '<tr><td class="nm">' + esc(x.n) + (x.h ? ' <span class="muted">(hidden)</span>' : '') + '</td><td class="fmt">' + ({ int: 'Whole number', dec: 'Decimal', text: 'Text', date: 'Date', bool: 'True/false' })[x.t] + '</td><td>' + esc(x.d) + '</td></tr>').join('')
    + '</tbody></table></div>' + (ms.length ? '<h3 class="sub">Measures</h3><div class="tablewrap"><table><thead><tr><th>Measure</th><th>What it shows</th></tr></thead><tbody>' + ms.map(x => '<tr><td class="nm">' + esc(x.n) + '</td><td>' + esc(x.d) + '</td></tr>').join('') + '</tbody></table></div>' : '');
  const steps = (m.style === 'udf' ? ['In Power BI Desktop, go to <b>File</b> &gt; <b>Options and settings</b> &gt; <b>Options</b> &gt; <b>Preview features</b>, turn on <b>DAX user-defined functions</b> and restart Desktop.'] : [])
    .concat(['Open a report (a new blank one works) and go to <b>TMDL view</b>.', 'Paste the script into a new tab and select <b>Apply</b>.', 'If a table shows no rows, select <b>Refresh</b> on the Home tab.']);
  $('applySteps').innerHTML = steps.map(s => '<li>' + s + '</li>').join('');
  state.tmdl = SD.script(c.model, { mode: m.style, args: c.args, measures: m.measures, measureTable: mt, tables: on.map(x => x.name) });
  $('tmdlView').innerHTML = hlTmdl(state.tmdl);
}

/* ---------- everything ---------- */
function renderMode(){
  document.querySelectorAll('input[name=mode]').forEach(r => { r.checked = r.value === state.mode; });
  document.querySelectorAll('.mask-only').forEach(el => { el.hidden = state.mode !== 'mask'; });
  document.querySelectorAll('.make-only').forEach(el => { el.hidden = state.mode !== 'make'; });
  showBanner();
}
function renderMask(){ renderFiles(); renderCols(); renderLinks(); renderMaskOut(); }
// linked columns always share one choice: the first one in the group that changes anything
function syncGroups(){
  const { g, by } = groupMembers();
  Object.values(by).forEach(ms => {
    if (ms.length < 2) return;
    const tr = ms.map(m => { const [ti, ci] = m.split(':'); return state.treats[ti][+ci]; });
    const pick = tr.find(x => x !== 'keep') || 'keep';
    ms.forEach(m => { const [ti, ci] = m.split(':'); state.treats[ti][+ci] = pick; });
  });
}
function changed(){ state.ver++; if (state.tables.length) syncGroups(); renderMode(); if (state.mode === 'mask') renderMask(); else renderMake(); }
function resetAll(){
  state.example = false; state.tables = []; state.treats = {}; state.sugs = []; state.manual = []; state.seed = randSeed(); state.prevTable = ''; state.prevSide = 'after';
  state.mode = 'mask'; state.make = makeDefaults(); $('fileMsg').innerHTML = ''; changed();
}
function loadExample(){
  state.example = true; state.tables = sdExample();
  state.tables.forEach(t => { state.treats[t.id] = t.headers.map((h, c) => SDM.detect(t, c)); });
  refreshLinks();
}
function init(){
  const mode = store.get('mode'); if (mode === 'make' || mode === 'mask') state.mode = mode;
  try { const mk = JSON.parse(store.get('make') || 'null'); if (mk) state.make = Object.assign(makeDefaults(), mk); } catch (e) {}
  try { const ms = JSON.parse(store.get('mask') || 'null'); if (ms && ms.seed) state.seed = ms.seed; } catch (e) {}
  if (store.get('blank') !== '1') loadExample();
  changed(); persist();

  document.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener('change', () => { state.mode = r.value; changed(); persist(); }));
  // mask
  const fileInput = $('fileInput');
  $('dropzone').addEventListener('click', () => fileInput.click());
  $('dropzone').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  fileInput.addEventListener('change', () => { if (fileInput.files.length) addFiles(Array.from(fileInput.files)); fileInput.value = ''; });
  let depth = 0;
  window.addEventListener('dragenter', e => { e.preventDefault(); depth++; $('dropzone').classList.add('over'); });
  window.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; $('dropzone').classList.remove('over'); } });
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => { e.preventDefault(); depth = 0; $('dropzone').classList.remove('over'); if (e.dataTransfer && e.dataTransfer.files.length) { if (state.mode !== 'mask') { state.mode = 'mask'; } addFiles(Array.from(e.dataTransfer.files)); } });
  $('fileList').addEventListener('click', e => {
    const b = e.target.closest('[data-rmfile]'); if (!b) return;
    state.tables = state.tables.filter(t => t.file !== b.dataset.rmfile); refreshLinks(); changed();
  });
  $('colCards').addEventListener('change', e => {
    const s = e.target.closest('select[data-t]'); if (!s) return;
    const { g, by } = groupMembers(), me = s.dataset.t + ':' + s.dataset.c;
    (by[g[me]] || [me]).forEach(m => { const [ti, ci] = m.split(':'); if (state.treats[ti]) state.treats[ti][+ci] = s.value; });
    changed();
  });
  $('linkList').addEventListener('change', e => { const c = e.target.closest('[data-sug]'); if (!c) return; state.sugs[+c.dataset.sug].on = c.checked; changed(); });
  $('linkList').addEventListener('click', e => { const b = e.target.closest('[data-rmlink]'); if (!b) return; state.manual.splice(+b.dataset.rmlink, 1); changed(); });
  $('addLink').addEventListener('click', () => {
    const a = $('linkA').value.split(':'), b = $('linkB').value.split(':');
    if (!a[0] || !b[0]) return;
    if (a.join() === b.join()) { $('linkMsg').innerHTML = msg('warn', 'Pick two different columns.'); return; }
    $('linkMsg').innerHTML = '';
    const l = { a: [a[0], +a[1]], b: [b[0], +b[1]] };
    // the link takes the first treatment that changes anything
    const ta = state.treats[l.a[0]][l.a[1]], tb = state.treats[l.b[0]][l.b[1]];
    if (ta === 'keep' && tb !== 'keep') state.treats[l.a[0]][l.a[1]] = tb; else if (tb !== ta) state.treats[l.b[0]][l.b[1]] = ta;
    state.manual.push(l); changed();
  });
  $('maskSeed').addEventListener('change', () => { const v = Math.floor(+$('maskSeed').value); if (v >= 1) { state.seed = v; changed(); persist(); } else $('maskSeed').value = state.seed; });
  $('newSeed').addEventListener('click', () => { state.seed = randSeed(); changed(); persist(); });
  $('prevTable').addEventListener('change', () => { state.prevTable = $('prevTable').value; renderMaskOut(); });
  document.querySelectorAll('input[name=prevSide]').forEach(r => r.addEventListener('change', () => { state.prevSide = r.value; renderMaskOut(); }));
  $('downloads').addEventListener('click', e => {
    if (typeof XLSX === 'undefined') { $('maskMsg').innerHTML = msg('err', 'The spreadsheet writer didn’t load. Check your internet connection and reload the page.'); return; }
    const b = e.target.closest('[data-dl]'); if (b) { writeFile(b.dataset.dl); return; }
    if (e.target.closest('#dlAll')) Array.from(new Set(state.tables.map(t => t.file))).forEach((f, i) => setTimeout(() => writeFile(f), i * 400));
  });
  // make
  const mk = fn => { fn(state.make); changed(); persist(); };
  $('industries').addEventListener('click', e => { const b = e.target.closest('[data-ind]'); if (b) mk(m => { m.ind = b.dataset.ind; }); });
  $('sizes').addEventListener('change', e => { const i = e.target.closest('[data-size]'); if (!i) return; mk(m => { const s = m.sizes[m.ind] = m.sizes[m.ind] || {}; s[i.dataset.size] = Math.floor(+i.value); }); });
  $('startDate').addEventListener('change', () => mk(m => { m.start = serialOf($('startDate').value); }));
  $('endDate').addEventListener('change', () => mk(m => { m.end = serialOf($('endDate').value); }));
  $('makeSeed').addEventListener('change', () => mk(m => { m.seed = Math.floor(+$('makeSeed').value); }));
  document.querySelectorAll('input[name=style]').forEach(r => r.addEventListener('change', () => mk(m => { m.style = r.value; })));
  $('addMeasures').addEventListener('change', () => mk(m => { m.measures = $('addMeasures').checked; }));
  document.querySelectorAll('input[name=mtable]').forEach(r => r.addEventListener('change', () => mk(m => { m.mtable = r.value; })));
  $('tablePicks').addEventListener('change', e => { const c = e.target.closest('[data-tbl]'); if (!c) return; mk(m => { const o = m.off[m.ind] = (m.off[m.ind] || []).filter(x => x !== c.dataset.tbl); if (!c.checked) o.push(c.dataset.tbl); }); });
  $('makeTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) mk(m => { m.tab[m.ind] = b.dataset.tab; }); });
  $('copyTmdl').addEventListener('click', () => { if (state.tmdl) copyText(state.tmdl, $('copyTmdl')); });
  $('dlTmdl').addEventListener('click', () => { if (state.tmdl) download('Sample data - ' + SD_IND.get(state.make.ind).name + '.tmdl', new Blob([state.tmdl], { type: 'text/plain' })); });
  $('clearAll').addEventListener('click', () => { resetAll(); store.set('blank', '1'); persist(); });
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
    store.set('blank', '1');
    persist();
    show(false); done.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => { done.hidden = true; }, 6000);
  });
})();
