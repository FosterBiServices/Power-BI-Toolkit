
/* ---------- home page ---------- */
const TOOLS = [
  { file: 'kpi-measure-builder.html', name: 'KPI Measure Builder', desc: 'Describe measures in plain English. Copilot writes the DAX; the page checks every name and outputs tab-indented TMDL into your measures folder.', tags: ['exp', 'ai'] },
  { file: 'measure-describer.html', name: 'Measure Describer', desc: 'Copilot writes descriptions for your measures in batches; you review them and save them to the model from DAX query view.', tags: ['exp', 'ai'] },
  { file: 'prep-for-ai-writer.html', name: 'Prep for AI Writer', desc: 'AI instructions, synonyms and table and column descriptions that help Copilot in Power BI answer questions about your model.', tags: ['exp', 'ai'] },
  { free: true, file: 'dax-reviewer.html', name: 'DAX Reviewer', desc: 'Paste a measure and review it against your own checklist. Instant checks on every measure, a Copilot review, and a rewrite tested against the original.', tags: ['exp', 'ai'] },
  { file: 'validation-query-builder.html', name: 'Validation Query Builder', desc: 'DAX queries that check measure results, totals, reconciliation with source columns, relationship keys and table profiles.', tags: ['exp', 'noai'] },
  { file: 'time-intelligence-builder.html', name: 'Time Intelligence Builder', desc: 'Year to date, last year, growth, rolling 12 months and more, with your fiscal year: as measures for the measures you pick, or one calculation group. Tested with a DAX query first.', tags: ['exp', 'noai'] },
  { file: 'field-parameter-builder.html', name: 'Field Parameter Builder', desc: 'Pick measures or columns, label and order them, and get the TMDL for a measure switcher: a field parameter, or a SWITCH measure that keeps each measure\u2019s format.', tags: ['exp', 'noai'] },
  { file: 'rls-role-generator.html', name: 'RLS Role Generator', desc: 'Row-level security roles from fixed values, each user\u2019s own rows or an access table, as a TMDL script with a test query and a check of which tables each role really restricts.', tags: ['exp', 'noai'] },
  { file: 'model-linter.html', name: 'Model Linter', desc: 'Best-practice checks on your model: folders, format strings, visible keys, bidirectional relationships, implicit measures, unused columns and measures. Add a PBIP folder for report checks: alt text, titles, hidden visuals, unused bookmarks, crowded pages.', tags: ['exp', 'noai'] },
  { file: 'about-this-report.html', name: 'About This Report', desc: 'What to put on a report\u2019s About page and why: a summary, who it\u2019s for, questions it answers, key measures in plain words, data sources, freshness and owner, drafted from your model. Optional HTML measure.', tags: ['exp', 'aiopt'] },
  { file: 'model-compare.html', name: 'Model Compare', desc: 'What changed between two model exports: tables, columns, measures and relationships added, removed, renamed or changed, with DAX differences side by side and release notes to copy.', tags: ['exp', 'noai'] },
  { file: 'model-documenter.html', name: 'Model Documenter', desc: 'One HTML document for the whole model: tables, measures, lineage, relationships, sources, model checks and report pages. Reads your PBIP folder in the browser.', tags: ['pbip', 'noai'] },
  { free: true, file: 'power-query-explainer.html', name: 'Power Query Explainer', desc: 'Comment every step of a Power Query query, or get a cleaner version checked against the original. One query, or the whole model read from a PBIP folder, with a plain-language guide for business readers.', tags: ['ai'] },
  { free: true, file: 'power-query-writer.html', name: 'Power Query Writer', desc: 'Describe a query in plain words and get a Copilot prompt that writes it: working, easy to maintain and short, with one-word step names and tidy formatting. Copilot\u2019s reply is checked before you use it.', tags: ['ai'] },
  { free: true, file: 'date-table-generator.html', name: 'Date Table Generator', desc: 'A date table with your fiscal year, weeks and holidays, as DAX, Power Query or a TMDL script. Can start and end with your data.', tags: ['dates', 'noai'] },
  { free: true, file: 'layout-designer.html', name: 'Layout Designer', desc: 'Plan a page on an even grid, or get three 3-30-3 layout suggestions from a few questions. Wireframe with sample visuals, exact positions, a designed background image, and Figma and PowerPoint exports.', tags: ['noai'] },
  { free: true, file: 'kpi-visualizer.html', name: 'KPI Visualizer', desc: 'Say what readers should get from a KPI, then compare ways to show it or a row of them: context labels, cards with variance, bullet charts, sparklines, progress bars, waffles, an HTML card and a scorecard table, each with when to use it, build steps and SVG measures in Excel-style status colors. Reads a PBIP folder or your export, or none.', tags: ['opt', 'noai'] },
  { free: true, file: 'theme-builder.html', name: 'Theme Builder', desc: 'A full report theme from one brand color: data palette, text, background, good and bad colors, font and styles for every common visual, checked for readability and color blindness.', tags: ['noai'] },
  { free: true, file: 'sheet-recon.html', name: 'Sheet Recon', desc: 'Compare two tables from Excel or CSV by key: rows found on only one side and every changed value. Cleans DAX column names, dates, numbers and blanks first.', tags: ['files', 'noai'] },
];
const TAG = { files: '<span class="tag exp">Your Excel or CSV files</span>', opt: '<span class="tag opt">Export optional</span>', pbip: '<span class="tag exp">PBIP folder or your export</span>', exp: '<span class="tag exp">Uses your export</span>', dates: '<span class="tag exp">Date columns from your export</span>', ai: '<span class="tag ai">Copilot</span>', aiopt: '<span class="tag noai">Copilot optional</span>', noai: '<span class="tag noai">No AI</span>' };
const $ = id => document.getElementById(id);
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function msg(level, html){ return '<div class="msg ' + level + '">' + html + '</div>'; }
function copyText(text, btn){
  const done = () => { const o = btn.dataset.label || btn.textContent; btn.dataset.label = o; btn.textContent = 'Copied'; btn.classList.add('done'); setTimeout(() => { btn.textContent = o; btn.classList.remove('done'); }, 1600); };
  const fallback = () => { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta); if (ok) done(); };
  try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
}
function renderSaved(){
  const v = SF_SUITE.get();
  $('saved').hidden = !v;
  if (!v) return;
  const m = parseModel(v.text);
  const d = new Date(v.savedAt);
  $('savedWhen').textContent = (v.name ? v.name + ' · ' : '') + (v.source === 'pbip' ? 'read from its PBIP folder ' : 'saved ') + d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  $('savedStats').innerHTML = '<span class="stat"><b>' + m.tables.length + '</b> tables</span><span class="stat"><b>' + m.columns.length + '</b> columns</span><span class="stat"><b>' + m.measures.length + '</b> measures</span><span class="stat"><b>' + m.rels.length + '</b> relationships</span>' + (m.composite ? '<span class="stat remote">Composite model</span>' : '');
  if (!$('modelName').value) $('modelName').value = v.name || '';
  const h = SF_SUITE.history ? SF_SUITE.history().length : 0;
  $('savedHist').hidden = !h;
  $('savedHist').innerHTML = h ? h + ' earlier export' + (h === 1 ? ' is' : 's are') + ' kept too, so <a href="model-compare.html">Model Compare</a> can show what changed. Saving a new export keeps the one it replaces.' : '';
}
function renderTools(){
  const card = t => '<a class="tool" href="' + t.file + '"><span class="tn">' + esc(t.name) + '</span><span class="td">' + esc(t.desc) + '</span><span class="tags">' + (t.free ? t.tags.map(x => x === 'exp' || x === 'dates' ? 'opt' : x) : t.tags.filter(x => x !== 'exp')).map(x => TAG[x]).join('') + '</span></a>';
  const FREE_ORDER = ['theme-builder.html', 'layout-designer.html', 'kpi-visualizer.html', 'date-table-generator.html', 'power-query-writer.html', 'power-query-explainer.html', 'dax-reviewer.html', 'sheet-recon.html'];
  $('toolsFree').innerHTML = TOOLS.filter(t => t.free).sort((a, b) => FREE_ORDER.indexOf(a.file) - FREE_ORDER.indexOf(b.file)).map(card).join('');
  $('tools').innerHTML = TOOLS.filter(t => !t.free).map(card).join('');
  return;
  $('tools').innerHTML = TOOLS.map(t => '<a class="tool" href="' + t.file + '"><span class="tn">' + esc(t.name) + '</span><span class="td">' + esc(t.desc) + '</span><span class="tags">' + t.tags.map(x => TAG[x]).join('') + '</span></a>').join('');
}
function save(){
  const text = $('exportInput').value;
  if (!text.trim()) return;
  const m = parseModel(text);
  if (m.error) { $('saveMsg').innerHTML = msg('err', esc(m.error)); return; }
  if (!SF_SUITE.set(text, $('modelName').value.trim())) { $('saveMsg').innerHTML = msg('err', 'This export is too large to save in the browser (the limit is about 5 MB). The tools still work if you paste it into each one.'); return; }
  $('exportInput').value = '';
  $('saveMsg').innerHTML = msg('ok', 'Saved. Open any tool below and it&rsquo;s already loaded.');
  renderSaved();
}
function init(){
  document.body.dataset.home = '1';
  $('queryView').textContent = DAX_QUERY;
  $('copyQuery').addEventListener('click', e => copyText(DAX_QUERY, e.currentTarget));
  $('exportInput').addEventListener('input', save);
  $('modelName').addEventListener('input', () => { const v = SF_SUITE.get(); if (v) { SF_SUITE.set(v.text, $('modelName').value.trim()); renderSaved(); } });
  $('clearSaved').addEventListener('click', () => { SF_SUITE.clear(); $('modelName').value = ''; $('saveMsg').innerHTML = msg('info', 'The saved export is removed. Each tool keeps its own copy until you clear that tool.'); renderSaved(); });
  window.addEventListener('storage', renderSaved);
  renderTools(); renderSaved();
}
init();
