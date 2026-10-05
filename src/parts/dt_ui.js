
/* ---------- state + UI ---------- */
const $ = id => document.getElementById(id);
const PREFIX = 'kdt.';
const store = {
  get(k){ try { return localStorage.getItem(PREFIX + k); } catch (e) { return null; } },
  set(k, v){ try { localStorage.setItem(PREFIX + k, v); } catch (e) {} }
};
function localToday(){ const n = new Date(); return D(n.getFullYear(), n.getMonth() + 1, n.getDate()); }
const TODAY = localToday();
function defaults(){
  const fy = fyNumber(fiscalStartYear(TODAY, 7), { fyStart: 7, fyNaming: 'end' });
  return { tableName: 'Date', fyStart: 7, fyNaming: 'end', fyStyle: 'fy', align: 'fiscal', startYear: fy - 3, startMode: 'fixed', startSnap: 'exact', startCols: '', dcPaste: '', endMode: 'fixed', endSnap: 'exact', endYear: fy + 1, rollYears: 1,
    weekStart: 'mon', weekend: [0, 6], country: 'us', holidays: {}, observed: true, custom: '', cols: {}, monthFiscalOrder: false, monthFilterStyle: 'long' };
}
let cfg = defaults();
const ui = { lang: 'dax', form: 'code', previewFrom: '', holYear: null };
const out = { text: '' };

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
const DAX_KW = /\b(VAR|RETURN|GENERATE|CALENDAR|ROW|DATATABLE|DATE|YEAR|MONTH|QUARTER|WEEKDAY|WEEKNUM|DAY|FORMAT|MOD|QUOTIENT|IF|IN|NOT|ISBLANK|MAXX|FILTER|EOMONTH|INT|TODAY|RIGHT|DATETIME|STRING|FALSE|TRUE)\b/g;
const TMDL_KW = /^(\s*)(createOrReplace|table|column|partition|dataType|dataCategory|isKey|isHidden|formatString|summarizeBy|sourceColumn|sortByColumn|isNameInferred|isDataTypeInferred|mode|source)\b/;
function hlCode(code, lang){
  if (lang === 'm' && typeof mTokenize === 'function') {
    const tk = mTokenize(code);
    if (!tk.error) {
      const KW = new Set(['let', 'in', 'each', 'if', 'then', 'else', 'and', 'or', 'not', 'type', 'table', 'true', 'false', 'null']);
      return tk.toks.map(t => t.t === 'comment' ? '<span class="tok-com">' + esc(t.v) + '</span>' : t.t === 'str' ? '<span class="tok-str">' + esc(t.v) + '</span>' : t.t === 'id' && KW.has(t.v) ? '<span class="tok-kw">' + esc(t.v) + '</span>' : esc(t.v)).join('');
    }
  }
  return code.split('\n').map(line => {
    if (/^\s*\/\//.test(line)) return '<span class="tok-com">' + esc(line) + '</span>';
    if (lang === 'tmdl') return esc(line).replace(TMDL_KW, '$1<span class="tok-kw">$2</span>');
    return esc(line).replace(/(&quot;.*?&quot;|"[^"]*")/g, '<span class="tok-str">$1</span>').replace(DAX_KW, '<span class="tok-kw">$1</span>');
  }).join('\n');
}
function fmtDate(dt){ return dt.getUTCDate() + ' ' + MONTHS[dt.getUTCMonth()].slice(0, 3) + ' ' + dt.getUTCFullYear(); }
function persist(){ store.set('cfg', JSON.stringify(cfg)); store.set('ui', JSON.stringify({ lang: ui.lang, form: ui.form })); }

/* ---------- controls ---------- */
function buildControls(){
  $('fyStart').innerHTML = MONTHS.map((m, i) => '<option value="' + (i + 1) + '">' + m + '</option>').join('');
  const groups = [];
  DT_COLUMNS.forEach(c => { if (!groups.includes(c.group)) groups.push(c.group); });
  $('colGroups').innerHTML = groups.map(g => '<fieldset class="cgroup"><legend>' + esc(g) + '</legend>'
    + (g === 'Calendar' ? '<label class="c"><input type="checkbox" checked disabled> Date</label>' : '')
    + DT_COLUMNS.filter(c => c.group === g && !c.hide).map(c => '<label class="c"><input type="checkbox" data-col="' + c.key + '"> ' + esc(c.name) + '</label>').join('')
    + (g === 'Relative to today' ? '<p class="note">Update each time the table refreshes. Offsets: 0 = this day, month or year. Month Filter shows "Current" for this month.</p>' : '') + '</fieldset>').join('');
}
function syncControls(){
  $('tableName').value = cfg.tableName; $('fyStart').value = String(cfg.fyStart); $('fyStyle').value = cfg.fyStyle;
  $('startYear').value = cfg.startYear; $('startCols').value = cfg.startCols; $('dcInput').value = cfg.dcPaste || '';  $('endYear').value = cfg.endYear; $('rollYears').value = String(cfg.rollYears);
  $('country').value = cfg.country; $('observed').checked = cfg.observed; $('custom').value = cfg.custom; $('fiscalOrder').checked = cfg.monthFiscalOrder; $('mfStyle').value = cfg.monthFilterStyle;
  [['fyNaming', cfg.fyNaming], ['align', cfg.align], ['startMode', cfg.startMode], ['endMode', cfg.endMode], ['weekStart', cfg.weekStart], ['lang', ui.lang], ['form', ui.form]]
    .forEach(([n, v]) => document.querySelectorAll('input[name=' + n + ']').forEach(r => { r.checked = r.value === v; }));
  document.querySelectorAll('[data-col]').forEach(cb => { const c = DT_COLUMNS.find(x => x.key === cb.dataset.col); cb.checked = cfg.cols[c.key] !== undefined ? cfg.cols[c.key] : c.on; });
}

/* ---------- render ---------- */
function render(){
  const fiscal = cfg.fyStart > 1;
  document.querySelectorAll('.fyonly').forEach(el => { el.hidden = !fiscal; });
  $('endFixed').hidden = cfg.endMode !== 'fixed' && cfg.endMode !== 'data'; $('endRolling').hidden = cfg.endMode !== 'rolling';
  $('endYearLbl').textContent = cfg.endMode === 'data' ? 'If there\u2019s no data yet, end in' : 'Last year';
  const fromData = cfg.startMode === 'data' || cfg.endMode === 'data';
  $('startColsWrap').hidden = !fromData;
  const yw = cfg.align === 'fiscal' && cfg.fyStart > 1 ? 'fiscal year' : 'year';
  const parts = [];
  if (cfg.startMode === 'data') parts.push(cfg.startSnap === 'year' ? 'starts on the first day of the ' + yw + ' that holds the earliest of these dates' : 'starts on the earliest of these dates');
  if (cfg.endMode === 'data') parts.push(cfg.endSnap === 'exact' ? 'ends on the latest of them' : 'ends on the last day of the ' + yw + ' that holds the latest of them');
  $('startColsNote').textContent = 'The table ' + parts.join(' and ') + ', and follows the data when it refreshes. Use the names from your model; for Power Query, the query name and column name.';
  renderFinder();
  $('startYearLbl').textContent = cfg.startMode === 'data' ? 'If there\u2019s no data yet, start in' : 'First year';

  // fiscal example
  const cur = fiscalStartYear(TODAY, cfg.fyStart);
  const fs = D(cur, cfg.fyStart, 1), fe = addDays(D(cur + (fiscal ? 1 : 1), cfg.fyStart, 1), -1);
  const q1e = addDays(D(cur, cfg.fyStart + 3, 1), -1);
  $('fyExample').innerHTML = fiscal
    ? '<b>This fiscal year:</b> ' + fmtDate(fs) + ' to ' + fmtDate(fe) + ' is <b>' + esc(fyLabel(cur, cfg)) + '</b>. Its first quarter (FQ1) runs to ' + fmtDate(q1e) + '.'
    : '<b>Fiscal year = calendar year.</b> ' + esc(fyLabel(cur, cfg)) + ' runs from 1 Jan to 31 Dec ' + cur + '.';

  // range
  const r = computeRange(cfg, TODAY);
  const rm = [];
  let ok = true;
  if (!(cfg.startYear >= 1900 && cfg.startYear <= 2200)) { rm.push(msg('err', 'Enter a first year between 1900 and 2200.')); ok = false; }
  if (cfg.endMode === 'fixed' && !(cfg.endYear >= 1900 && cfg.endYear <= 2200)) { rm.push(msg('err', 'Enter a last year between 1900 and 2200.')); ok = false; }
  if (fromData) {
    const sc = parseStartCols(cfg.startCols);
    if (sc.errors.length) rm.push(msg('warn', sc.errors.map(esc).join('<br>')));
    if (!sc.cols.length) { rm.push(msg('err', 'Add at least one date column, like Sales[Order Date].')); ok = false; }
  }
  if (ok && r.end < r.start && !r.dynamic) { rm.push(msg('err', 'The last year is before the first year.')); ok = false; }
  if (ok && r.end < r.start && r.dynamic) rm.push(msg('warn', 'Today is before the start, so for now the table would hold a single day.'));
  if (ok && (cfg.startMode === 'data' || cfg.endMode === 'data')) rm.push(msg('info', 'The table runs ' + (cfg.startMode === 'data' ? 'from the earliest date in your data' : '') + (cfg.startMode === 'data' && cfg.endMode === 'data' ? ' to the latest one' : cfg.endMode === 'data' ? 'to the latest date in your data' : '') + ', with no extra days. Mark as date table still works; year-to-date and prior-year measures simply have nothing outside that span.'));
  if (ok && (cfg.endMode === 'today' || cfg.endMode === 'yesterday')) rm.push(msg('info', 'The table stops at ' + cfg.endMode + '. Rows in your data dated after that won&rsquo;t match a date, and measures such as year-to-date simply stop there.'));
  if (ok && r.days > 366 * 60) rm.push(msg('warn', 'That&rsquo;s ' + Math.round(r.days / 365) + ' years. A date table only needs the years your data covers, plus any future years you plan for.'));
  const sTxt = r.fromData ? 'the start of your data' : '<b>' + fmtDate(r.start) + '</b>';
  const eTxt = r.endFromData ? 'the end of your data' : '<b>' + fmtDate(r.end) + '</b>' + (r.dynamic && cfg.endMode !== 'fixed' ? ' <span class="muted">(as of today)</span>' : '');
  const stand = [r.fromData ? 'start ' + fmtDate(r.start) : '', r.endFromData ? 'end ' + fmtDate(r.end) : ''].filter(Boolean).join(', ');
  $('rangeStats').innerHTML = ok ? '<span class="stat">From ' + sTxt + ' to ' + eTxt + '</span>'
    + (stand ? '<span class="stat">Preview uses ' + stand + '</span>' : '<span class="stat"><b>' + Math.max(r.days, 1).toLocaleString() + '</b> rows</span>')
    + (r.dynamic ? '<span class="stat remote">' + (r.fromData && cfg.endMode !== 'fixed' ? 'Both ends update' : r.fromData ? 'The start updates' : r.endFromData ? 'The end follows your data' : 'The end moves forward') + ' when the table refreshes</span>' : '') : '';
  $('rangeMsg').innerHTML = rm.join('');
  state.ok = ok;

  // weekend chips
  const order = cfg.weekStart === 'sun' ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 0];
  $('weekendChips').innerHTML = order.map(d => '<button type="button" class="chip" data-wd="' + d + '" aria-pressed="' + cfg.weekend.includes(d) + '">' + DAYS[d].slice(0, 3) + '</button>').join('');

  // holidays
  $('holPick').hidden = cfg.country !== 'us'; $('observedWrap').hidden = cfg.country !== 'us';
  $('holPick').innerHTML = US_HOLIDAYS.map(h => '<label class="c"><input type="checkbox" data-hol="' + h.key + '"' + ((cfg.holidays[h.key] !== undefined ? cfg.holidays[h.key] : h.on) ? ' checked' : '') + '> ' + esc(h.name) + '</label>').join('');
  const pc = parseCustomHolidays(cfg.custom);
  $('customMsg').innerHTML = pc.errors.length ? msg('warn', 'These lines are skipped:<ul>' + pc.errors.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul>') : (pc.list.length ? msg('ok', pc.list.length + ' holiday' + (pc.list.length > 1 ? 's' : '') + ' of your own added.') : '');
  if (!ok) { $('outView').textContent = ''; out.text = ''; $('outMsg').innerHTML = msg('err', 'Fix the date range in Step 2 first.'); return; }

  const y0 = r.start.getUTCFullYear(), y1 = r.end.getUTCFullYear();
  if (!ui.holYear || ui.holYear < y0 || ui.holYear > y1) ui.holYear = Math.min(Math.max(TODAY.getUTCFullYear(), y0), y1);
  const years = []; for (let y = y0; y <= y1; y++) years.push(y);
  $('holYear').innerHTML = years.map(y => '<option' + (y === ui.holYear ? ' selected' : '') + '>' + y + '</option>').join('');
  const hy = buildHolidays(cfg, ui.holYear, ui.holYear);
  $('holCount').textContent = hy.length + ' holiday' + (hy.length === 1 ? '' : 's') + (hy.filter(h => cfg.weekend.includes(h.date.getUTCDay())).length ? ', ' + hy.filter(h => cfg.weekend.includes(h.date.getUTCDay())).length + ' on a weekend' : '');
  $('holBody').innerHTML = hy.length ? hy.map(h => '<tr' + (cfg.weekend.includes(h.date.getUTCDay()) ? ' class="wkend"' : '') + '><td class="nm">' + ymd(h.date) + '</td><td>' + DAYS[h.date.getUTCDay()] + '</td><td>' + esc(h.name) + '</td></tr>').join('') : '<tr><td colspan="3" class="muted">No holidays in ' + ui.holYear + '.</td></tr>';

  // columns
  const allHol = holidaysFor(cfg, r, TODAY);
  const cols = outputColumns(cfg, allHol.length > 0);
  document.querySelectorAll('[data-col]').forEach(cb => {
    const c = DT_COLUMNS.find(x => x.key === cb.dataset.col);
    cb.disabled = !!(c.needsHol && !allHol.length);
    cb.closest('label').title = cb.disabled ? 'Add some holidays in Step 3 first' : '';
  });
  $('fiscalOrderEx').textContent = MONTHS[cfg.fyStart - 1].slice(0, 3) + ' first, sorted by Fiscal Month Number';
  $('mfStyleWrap').hidden = !cols.some(c => c.key === 'monthFilter');
  const autos = cols.filter(c => c.auto);
  let colNote = $('colNote'); if (!colNote) { colNote = document.createElement('div'); colNote.id = 'colNote'; $('colGroups').after(colNote); }
  colNote.innerHTML = autos.length ? '<p class="note">Added for sorting' + (autos.some(c => c.hidden) ? ' (hidden)' : '') + ': ' + autos.map(c => '<b>' + esc(c.name) + '</b>').join(', ') + '.</p>' : '';

  // preview
  if (!ui.previewFrom) ui.previewFrom = ymd(addDays(yearStart(fyNumber(fiscalStartYear(TODAY, cfg.fyStart), cfg) + (fiscal ? 1 : 1), cfg, fiscal), -3));
  if (new Date(ui.previewFrom + 'T00:00:00Z') > r.end) ui.previewFrom = ymd(addDays(r.end, -6));
  $('previewFrom').value = ui.previewFrom;
  const holMap = new Map(allHol.map(h => [ymd(h.date), h.name]));
  const p0 = new Date(ui.previewFrom + 'T00:00:00Z');
  const show = [{ key: 'date', name: 'Date' }].concat(cols);
  $('prevHead').innerHTML = '<tr>' + show.map(c => '<th' + (c.hidden ? ' class="hid" title="Hidden in the model"' : '') + '>' + esc(c.name) + '</th>').join('') + '</tr>';
  const rows = [];
  if (!isNaN(p0)) for (let i = 0; i < 7; i++) {
    const dt = addDays(p0, i);
    const inRange = dt >= r.start && dt <= r.end;
    const v = rowValues(dt, cfg, holMap, TODAY);
    rows.push('<tr class="' + (inRange ? '' : 'out') + (v.hol ? ' hol' : '') + '">' + show.map(c => {
      if (c.key === 'date') return '<td class="nm">' + ymd(dt) + (inRange ? '' : ' <span class="muted">(outside the range)</span>') + '</td>';
      const val = c.js(v);
      return '<td>' + (typeof val === 'boolean' ? (val ? 'TRUE' : '<span class="muted">FALSE</span>') : val === '' ? '<span class="muted">&ndash;</span>' : esc(val)) + '</td>';
    }).join('') + '</tr>');
  }
  $('prevBody').innerHTML = rows.join('');

  // output
  const tbl = (cfg.tableName || 'Date').trim() || 'Date';
  let g, lang = ui.lang;
  if (ui.form === 'tmdl') g = tmdlScript(Object.assign({}, cfg, { tableName: tbl }), lang, TODAY);
  else { g = lang === 'dax' ? daxCode(cfg, TODAY) : mCode(cfg, TODAY); if (lang === 'dax') g = Object.assign({}, g, { code: tbl + ' =\n' + g.code }); }
  out.text = g.code;
  $('outTitle').textContent = ui.form === 'tmdl' ? 'TMDL script (' + (lang === 'dax' ? 'DAX' : 'Power Query') + ' table)' : lang === 'dax' ? 'DAX calculated table' : 'Power Query (M) query';
  $('outCount').textContent = g.code.split('\n').length.toLocaleString() + ' lines';
  $('outView').innerHTML = hlCode(g.code, ui.form === 'tmdl' ? 'tmdl' : lang);
  const notes = [];
  if (!/^[A-Za-z_][A-Za-z0-9_ ]*$/.test(tbl)) notes.push(msg('warn', 'Keep the table name to letters, numbers, spaces and underscores to avoid quoting problems.'));
  if (holidayPlan(cfg).any) notes.push(msg('info', 'Holidays are worked out in the code from their rules (third Monday in January, Easter and so on) for every year the table covers, so they keep up when the dates move. Only one-off dates you typed are fixed.'));
  if (fromData) notes.push(msg('info', lang === 'dax' ? 'The table reads ' + esc(parseStartCols(cfg.startCols).cols.map(x => x.table + '[' + x.column + ']').join(', ')) + ' when it refreshes. If Power BI reports a circular dependency after you relate it to that table, switch to fixed years.' : 'Power Query loads ' + esc([...new Set(parseStartCols(cfg.startCols).cols.map(x => x.table))].join(', ')) + ' a second time to read its dates, which can slow refresh on big tables. The names must match your query names.'));
  if (cols.some(c => c.rel) || ['rolling', 'today', 'yesterday'].includes(cfg.endMode)) notes.push(msg('info', 'Today&rsquo;s date is read when the table refreshes. In the Power BI service that&rsquo;s UTC, so near midnight it can be a day off from your local date.'));
  if (!allHol.length && cfg.country !== 'none') notes.push(msg('warn', 'No holidays are selected, so the holiday columns are left out.'));
  $('outMsg').innerHTML = notes.join('');

  // apply steps
  const sorts = g.cols.filter(c => c.sortTarget).map(c => '<li>Select <b>' + esc(c.name) + '</b>, then <b>Column tools &gt; Sort by column &gt; ' + esc(colName(c.sortTarget)) + '</b>.</li>').join('');
  const hides = g.cols.filter(c => c.hidden).map(c => '<b>' + esc(c.name) + '</b>').join(', ');
  const setup = '<li><b>Table tools &gt; Mark as date table</b>, and choose <b>Date</b>.</li>' + sorts
    + (hides ? '<li>Right-click ' + hides + ' and select <b>Hide in report view</b>.</li>' : '')
    + '<li>Set number columns such as Year to <b>Don&rsquo;t summarize</b> (Column tools &gt; Summarization).</li>';
  const rel = '<li>In Model view, drag <b>' + esc(tbl) + '[Date]</b> onto the date column of each fact table (one-to-many, single direction).</li>';
  let steps;
  if (ui.form === 'tmdl') steps = '<b>Add it with TMDL view</b><ol><li>Select <b>TMDL view</b> on the left rail and open a new tab (<b>+</b>).</li><li>Paste the script and select <b>Preview</b>. It should only add a table called <b>' + esc(tbl) + '</b>. If a table with that name already exists, it&rsquo;s replaced, which can remove its relationships; use a new name instead.</li><li>Select <b>Apply</b>, then right-click the table in the Data pane and select <b>Refresh data</b>.</li><li>Sort orders, hidden columns, formats and the date-table setting are already in the script.</li>' + rel + '</ol>';
  else if (lang === 'dax') steps = '<b>Add it as a calculated table</b><ol><li>Select <b>Modeling &gt; New table</b> (in Table view: <b>Table tools &gt; New table</b>).</li><li>Select everything in the formula bar, paste, and press <b>Enter</b>. The first line names the table <b>' + esc(tbl) + '</b>.</li>' + setup + rel + '</ol>';
  else steps = '<b>Add it as a Power Query query</b><ol><li>Select <b>Home &gt; Transform data</b>, then <b>New Source &gt; Blank Query</b>.</li><li>Open <b>Advanced Editor</b>, press <b>Ctrl+A</b>, paste and select <b>Done</b>.</li><li>Rename the query to <b>' + esc(tbl) + '</b>, then <b>Close &amp; Apply</b>.</li>' + setup + rel + '</ol>';
  $('applyBox').innerHTML = steps + '<p class="note">Tip: turn off <b>Auto date/time</b> (File &gt; Options and settings &gt; Options &gt; Current file &gt; Data load) once this table is in place, so Power BI stops making hidden date tables.</p>';
}
const state = { ok: true };

/* ---------- date column finder ---------- */
function renderFinder(){
  const p = parseDateCols(cfg.dcPaste);
  $('dcMsg').innerHTML = p.error ? msg('err', esc(p.error)) : p.cols.length ? msg('ok', p.cols.length + ' date column' + (p.cols.length === 1 ? '' : 's') + ' found. Tick the ones that hold real business dates, such as order or invoice dates.') + (cfg.startMode !== 'data' && cfg.endMode !== 'data' && parseStartCols(cfg.startCols).cols.length ? msg('info', 'To use the ticked columns, set Start to <b>Earliest date in my data</b> or End to <b>Latest date in my data</b> in Step 2.') : '') : '';
  const cur = new Set(parseStartCols(cfg.startCols).cols.map(x => (x.table + '[' + x.column + ']').toLowerCase()));
  let last = '';
  $('dcList').innerHTML = p.cols.map((c, i) => {
    const head = c.table !== last ? '<div class="dct">' + esc(c.table) + '</div>' : ''; last = c.table;
    return head + '<label class="c"><input type="checkbox" data-dc="' + i + '"' + (cur.has((c.table + '[' + c.column + ']').toLowerCase()) ? ' checked' : '') + '> ' + esc(c.column) + (c.hidden ? ' <span class="muted">(hidden)</span>' : '') + '</label>';
  }).join('');
  const ticked = parseStartCols(cfg.startCols).cols;
  const use = ticked.length ? ticked : p.cols;
  $('dcRange').hidden = !use.length;
  ui.rangeQuery = use.length ? dateRangeQuery(use) : '';
  $('dcRangeTitle').textContent = 'DAX query: date ranges for ' + (ticked.length ? ticked.length + ' listed' : 'all ' + use.length) + ' column' + (use.length === 1 ? '' : 's');
  $('dcRangeView').textContent = ui.rangeQuery;
}

/* ---------- events ---------- */
function init(){
  buildControls();
  try { const s = JSON.parse(store.get('cfg') || 'null'); if (s && typeof s === 'object') cfg = Object.assign(defaults(), s); } catch (e) {}
  cfg.startSnap = 'exact'; cfg.endSnap = 'exact'; // ranges from your data use the exact first and last dates
  try { const u = JSON.parse(store.get('ui') || 'null'); if (u) { if (u.lang === 'dax' || u.lang === 'm') ui.lang = u.lang; if (u.form === 'code' || u.form === 'tmdl') ui.form = u.form; } } catch (e) {}
  syncControls(); render();
  const change = () => { persist(); render(); };
  $('tableName').addEventListener('input', () => { cfg.tableName = $('tableName').value; change(); });
  $('fyStart').addEventListener('change', () => { cfg.fyStart = +$('fyStart').value; ui.previewFrom = ''; change(); });
  $('fyStyle').addEventListener('change', () => { cfg.fyStyle = $('fyStyle').value; change(); });
  $('startYear').addEventListener('input', () => { cfg.startYear = parseInt($('startYear').value, 10); change(); });
  $('endYear').addEventListener('input', () => { cfg.endYear = parseInt($('endYear').value, 10); change(); });
  $('rollYears').addEventListener('change', () => { cfg.rollYears = +$('rollYears').value; change(); });
  $('startCols').addEventListener('input', () => { cfg.startCols = $('startCols').value; change(); });
  $('dcQueryView').textContent = DATE_COLS_QUERY;
  $('copyDcQuery').addEventListener('click', e => copyText(DATE_COLS_QUERY, e.currentTarget));
  $('copyDcRange').addEventListener('click', e => { if (ui.rangeQuery) copyText(ui.rangeQuery, e.currentTarget); });
  $('dcInput').addEventListener('input', () => { cfg.dcPaste = $('dcInput').value; change(); });
  $('dcList').addEventListener('change', e => {
    const cb = e.target.closest('[data-dc]'); if (!cb) return;
    const found = parseDateCols(cfg.dcPaste).cols[+cb.dataset.dc];
    const cur = parseStartCols(cfg.startCols).cols;
    const key = x => (x.table + '[' + x.column + ']').toLowerCase();
    const kept = cur.filter(x => key(x) !== key(found));
    if (cb.checked) kept.push(found);
    cfg.startCols = kept.map(x => (/[^A-Za-z0-9_ ]/.test(x.table) ? "'" + x.table.replace(/'/g, "''") + "'" : x.table) + '[' + x.column + ']').join('\n');
    $('startCols').value = cfg.startCols; change();
  });
  ['fyNaming', 'align', 'startMode', 'endMode', 'weekStart'].forEach(n => document.querySelectorAll('input[name=' + n + ']').forEach(r => r.addEventListener('change', () => { cfg[n] = r.value; if (n === 'endMode') ui.previewFrom = ''; change(); })));
  ['lang', 'form'].forEach(n => document.querySelectorAll('input[name=' + n + ']').forEach(r => r.addEventListener('change', () => { ui[n] = r.value; change(); })));
  $('weekendChips').addEventListener('click', e => {
    const b = e.target.closest('[data-wd]'); if (!b) return;
    const d = +b.dataset.wd; cfg.weekend = cfg.weekend.includes(d) ? cfg.weekend.filter(x => x !== d) : cfg.weekend.concat(d); change();
  });
  $('country').addEventListener('change', () => { cfg.country = $('country').value; change(); });
  $('observed').addEventListener('change', () => { cfg.observed = $('observed').checked; change(); });
  $('holPick').addEventListener('change', e => { const cb = e.target.closest('[data-hol]'); if (!cb) return; cfg.holidays[cb.dataset.hol] = cb.checked; change(); });
  $('custom').addEventListener('input', () => { cfg.custom = $('custom').value; change(); });
  $('holYear').addEventListener('change', () => { ui.holYear = +$('holYear').value; render(); });
  $('colGroups').addEventListener('change', e => { const cb = e.target.closest('[data-col]'); if (!cb) return; cfg.cols[cb.dataset.col] = cb.checked; change(); });
  $('mfStyle').addEventListener('change', () => { cfg.monthFilterStyle = $('mfStyle').value; change(); });
  $('fiscalOrder').addEventListener('change', () => { cfg.monthFiscalOrder = $('fiscalOrder').checked; change(); });
  $('previewFrom').addEventListener('change', () => { ui.previewFrom = $('previewFrom').value; render(); });
  document.querySelector('.jump').addEventListener('click', e => {
    const b = e.target.closest('[data-jump]'); if (!b) return;
    const fiscal = cfg.fyStart > 1;
    if (b.dataset.jump === 'today') ui.previewFrom = ymd(TODAY);
    if (b.dataset.jump === 'fy') ui.previewFrom = ymd(addDays(yearStart(fyNumber(fiscalStartYear(TODAY, cfg.fyStart), cfg) + 1, cfg, fiscal), -3));
    if (b.dataset.jump === 'hol') {
      const from = new Date((ui.previewFrom || ymd(TODAY)) + 'T00:00:00Z');
      const hs = buildHolidays(cfg, from.getUTCFullYear(), from.getUTCFullYear() + 2);
      const nx = hs.find(h => h.date > addDays(from, 3));
      if (nx) ui.previewFrom = ymd(addDays(nx.date, -3));
    }
    render();
  });
  $('copyOut').addEventListener('click', e => { if (out.text) copyText(out.text, e.currentTarget); });
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
    cfg = defaults(); ui.lang = 'dax'; ui.form = 'code'; ui.previewFrom = ''; ui.holYear = null;
    syncControls(); render();
    show(false); done.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => { done.hidden = true; }, 6000);
  });
})();
