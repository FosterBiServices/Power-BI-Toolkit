
/*SUITE-START*/
/* ---------- SF Power BI Toolkit: one model export shared by every page on the site ---------- */
(function(){
  const KEY = 'sfpbi.shared.model';
  const HOME = 'index.html';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const S = window.SF_SUITE = window.SF_SUITE || {};
  S.get = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && v.text ? v : null; } catch (e) { return null; } };
  // Earlier exports, newest first, kept for Model Compare (up to 5, and only while there's room)
  const HKEY = KEY + '.history';
  S.history = () => { try { const h = JSON.parse(localStorage.getItem(HKEY) || '[]'); return Array.isArray(h) ? h.filter(x => x && x.text) : []; } catch (e) { return []; } };
  const keep = v => {
    let h = [v].concat(S.history().filter(x => x.text !== v.text)).slice(0, 5);
    while (h.length) { try { localStorage.setItem(HKEY, JSON.stringify(h)); return; } catch (e) { h = h.slice(0, -1); } }
    try { localStorage.removeItem(HKEY); } catch (e) {}
  };
  S.clearHistory = () => { try { localStorage.removeItem(HKEY); } catch (e) {} };
  S.set = (text, name) => {
    try {
      const prev = S.get();
      if (prev && prev.text && prev.text.trim() !== (text || '').trim()) keep(prev);
      localStorage.setItem(KEY, JSON.stringify({ text, name: name !== undefined ? name : (prev ? prev.name || '' : ''), savedAt: Date.now() }));
      return true;
    } catch (e) { return false; }
  };
  S.clear = () => { try { localStorage.removeItem(KEY); } catch (e) {} };
  // Header row (Kind, Table, Name) plus at least one row
  S.looksLikeExport = t => {
    const lines = (t || '').replace(/\r/g, '').split('\n');
    const h = lines.slice(0, 15).findIndex(l => { const c = l.toLowerCase().split('\t').map(x => x.replace(/^"|"$/g, '').replace(/^.*\[|\]$/g, '').trim()); return c.includes('kind') && c.includes('table') && c.includes('name'); });
    return h >= 0 && lines.slice(h + 1).some(l => l.trim());
  };
  S.counts = t => {
    const lines = (t || '').replace(/\r/g, '').split('\n');
    const out = { table: 0, column: 0, measure: 0, relationship: 0 };
    let ki = -1;
    for (const l of lines) {
      const c = l.split('\t').map(x => x.replace(/^"|"$/g, '').trim());
      if (ki < 0) { const i = c.map(x => x.toLowerCase().replace(/^.*\[|\]$/g, '')).indexOf('kind'); if (i >= 0 && c.map(x => x.toLowerCase()).some(x => /table/.test(x))) ki = i; continue; }
      const k = (c[ki] || '').toLowerCase(); if (k in out) out[k]++;
    }
    return out;
  };
  S.describe = v => {
    const c = S.counts(v.text), d = new Date(v.savedAt || Date.now());
    const when = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return (v.name ? '<b>' + esc(v.name) + '</b> &middot; ' : '') + c.table + ' tables, ' + c.measure + ' measures &middot; saved ' + esc(when);
  };
  // Date columns from the export, in the Date Table Generator's "Table, Column, Type, Hidden" layout
  S.dateColumns = t => {
    const lines = (t || '').replace(/\r/g, '').split('\n'); let idx = null; const rows = [];
    for (const l of lines) {
      const c = l.split('\t').map(x => x.replace(/^"(.*)"$/, '$1').replace(/""/g, '"').trim());
      if (!idx) { const low = c.map(x => x.toLowerCase().replace(/^.*\[|\]$/g, '')); if (low.includes('kind') && low.includes('table')) idx = { kind: low.indexOf('kind'), table: low.indexOf('table'), name: low.indexOf('name'), type: low.indexOf('type'), flags: low.indexOf('flags') }; continue; }
      if ((c[idx.kind] || '').toLowerCase() !== 'column') continue;
      if (!/date/i.test(c[idx.type] || '') || /^(LocalDateTable_|DateTableTemplate_)/i.test(c[idx.table] || '')) continue;
      rows.push([c[idx.table], c[idx.name], c[idx.type], /hidden/i.test(c[idx.flags] || '') ? 'True' : 'False'].join('\t'));
    }
    return rows.length ? 'Table\tColumn\tType\tHidden\n' + rows.join('\n') : '';
  };

  if (!document.getElementById('suiteCss')) {
    const st = document.createElement('style'); st.id = 'suiteCss';
    st.textContent = '.suite-bar{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between;font-size:13.5px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;padding:8px 12px}.suite-bar[hidden]{display:none!important}.suite-bar .ok{color:var(--ok)}.suite-bar .btn{padding:4px 10px}'
      + '.suite-nav{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;justify-content:space-between;margin-bottom:-8px}'
      + '.suite-nav a.home{display:inline-flex;align-items:center;gap:6px;font-family:var(--sans);font-size:14px;font-weight:600;color:var(--accent);text-decoration:none;border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:6px 14px}'
      + '.suite-nav a.home:hover{border-color:var(--accent);background:var(--accent-soft)}'
      + '.suite-nav a.home:focus-visible,.suite-nav select:focus-visible,.brandbar a.logo-link:focus-visible{outline:2px solid var(--gold);outline-offset:2px}'
      + '.suite-nav .switch{display:inline-flex;align-items:center;gap:8px;font-size:13.5px;color:var(--muted)}'
      + '.suite-nav select{font:inherit;font-size:14px;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:5px 8px;max-width:60vw}'
      + '.brandbar a.logo-link{display:flex;flex:none;border-radius:6px}'
      + '.suite-disc{display:block;margin-top:6px;max-width:90ch;margin-left:auto;margin-right:auto;line-height:1.5}.suite-disc a{color:inherit}'
      + '.suite-ai{font-size:13.5px}'
      + '.suite-file{margin-top:8px}.suite-msg{display:flex;gap:10px;align-items:flex-start;justify-content:space-between;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;padding:8px 12px;font-size:14px}.suite-msg .btn{flex:none}'
      + '.suite-reply{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;margin:4px 0}.suite-reply .btn{padding:4px 10px;font-size:13px}.suite-ok{color:var(--ok)}.suite-err{color:var(--err)}';
    document.head.appendChild(st);
  }
  // Navigation back to the home page and across tools
  S.TOOLS = [
    ['kpi-measure-builder.html', 'KPI Measure Builder'],
    ['measure-describer.html', 'Measure Describer'],
    ['prep-for-ai-writer.html', 'Prep for AI Writer'],
    ['dax-reviewer.html', 'DAX Reviewer'],
    ['validation-query-builder.html', 'Validation Query Builder'],
    ['time-intelligence-builder.html', 'Time Intelligence Builder'],
    ['field-parameter-builder.html', 'Field Parameter Builder'],
    ['rls-role-generator.html', 'RLS Role Generator'],
    ['model-linter.html', 'Model Linter'],
    ['model-compare.html', 'Model Compare'],
    ['model-documenter.html', 'Model Documenter'],
    ['about-this-report.html', 'About This Report'],
    ['power-query-writer.html', 'Power Query Writer'],
    ['power-query-explainer.html', 'Power Query Explainer'],
    ['date-table-generator.html', 'Date Table Generator'],
    ['theme-builder.html', 'Theme Builder'],
    ['layout-designer.html', 'Layout Designer'],
    ['sheet-recon.html', 'Sheet Recon']
  ];
  const top = document.querySelector('header.top');
  if (top && !document.body.dataset.home && !document.getElementById('suiteNav')) {
    const here = (location.pathname.split('/').pop() || '').toLowerCase();
    const nav = document.createElement('nav'); nav.id = 'suiteNav'; nav.className = 'suite-nav'; nav.setAttribute('aria-label', 'Toolkit');
    nav.innerHTML = '<a class="home" href="' + HOME + '"><span aria-hidden="true">&larr;</span> Toolkit home</a>'
      + '<label class="switch"><span>Switch tool</span><select id="suiteSwitch">'
      + S.TOOLS.map(t => '<option value="' + t[0] + '"' + (t[0] === here ? ' selected' : '') + '>' + esc(t[1]) + '</option>').join('')
      + '</select></label>';
    top.insertAdjacentElement('beforebegin', nav);
    nav.querySelector('select').addEventListener('change', e => { location.href = e.target.value; });
    const img = top.querySelector('.brandbar img');
    if (img && !img.closest('a')) { const a = document.createElement('a'); a.href = HOME; a.className = 'logo-link'; a.title = 'Toolkit home'; a.setAttribute('aria-label', 'Toolkit home'); img.replaceWith(a); a.appendChild(img); }
  }

  // Disclaimer: a short notice in every tool's footer, and an AI warning on the Copilot tools
  const AI_TOOLS = ['kpi-measure-builder.html', 'measure-describer.html', 'prep-for-ai-writer.html', 'dax-reviewer.html', 'power-query-explainer.html', 'about-this-report.html', 'power-query-writer.html'];
  if (!document.body.dataset.home && !document.getElementById('suiteDisc')) {
    const f = document.querySelector('footer');
    if (f) { const d = document.createElement('span'); d.id = 'suiteDisc'; d.className = 'suite-disc'; d.innerHTML = 'Generated output can be wrong. Check all of it, and test changes on a copy of your model first. Provided as is, without warranty; you use it at your own discretion and risk. <a href="' + HOME + '#disclaimer">Full disclaimer</a>'; f.appendChild(d); }
    const here2 = (location.pathname.split('/').pop() || '').toLowerCase();
    const hdr = document.querySelector('header.top');
    if (hdr && AI_TOOLS.includes(here2)) { const n = document.createElement('div'); n.className = 'msg warn suite-ai'; n.setAttribute('role', 'note'); n.innerHTML = '<b>AI can make mistakes.</b> This page checks Copilot&rsquo;s reply where it can, but not every error in logic or meaning. Review everything before you use it, only use AI tools your organization approves, and test on a copy of your model first. <a href="' + HOME + '#disclaimer">Disclaimer</a>'; hdr.insertAdjacentElement('afterend', n); }
  }

  // Copilot prompts as files: every prompt can be downloaded as a .txt to attach in Copilot, with a short message
  // to send alongside it, and every reply box can open a reply file (.txt, .md, .json or .docx) Copilot made.
  const ONE_REPLY = '\n\nReply in one single response. If the complete reply is too long to show in full in the chat, put the whole reply, in the format asked for above, in one downloadable .txt file instead of splitting it across messages or shortening it.';
  const ATTACH_MSG = 'Follow the instructions in the attached file exactly. Reply in one single response, in the format the file asks for. If the complete reply won’t fit in the chat, put all of it in one downloadable .txt file.';
  const PROMPTS = {
    'kpi-measure-builder.html': [['promptView', 'response', 'KPI Measure Builder prompt']],
    'measure-describer.html': [['promptView', 'reply', 'Measure Describer prompt']],
    'prep-for-ai-writer.html': [['insPromptView', 'insReply', 'AI instructions prompt'], ['dPromptView', 'dReply', 'Descriptions prompt']],
    'dax-reviewer.html': [['promptView', 'reply', 'DAX Reviewer prompt']],
    'power-query-explainer.html': [['exPromptView', 'exReply', 'Power Query comments prompt'], ['exFollowView', 'exReply', 'Power Query follow-up prompt'], ['clPromptView', 'clReply', 'Power Query cleanup prompt'], ['mPromptView', 'mReply', 'Power Query model prompt']],
    'about-this-report.html': [['promptView', 'aiInput', 'About This Report prompt']],
    'power-query-writer.html': [['pwPromptView', 'pwReply', 'Power Query Writer prompt']]
  };
  const saveText = (name, text) => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text.replace(/\r?\n/g, '\r\n')], { type: 'text/plain;charset=utf-8' })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  // text out of a Word file: unzip word/document.xml (stored or deflated) and keep paragraphs, tabs and breaks
  async function docxText(buf){
    const u = new Uint8Array(buf), dv = new DataView(buf);
    let eocd = -1; for (let i = u.length - 22; i >= Math.max(0, u.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('This doesn’t look like a Word file.');
    let p = dv.getUint32(eocd + 16, true); const n = dv.getUint16(eocd + 10, true);
    for (let k = 0; k < n; k++) {
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u.subarray(p + 46, p + 46 + nl));
      if (name === 'word/document.xml') {
        const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true), data = u.subarray(start, start + csize);
        let xml;
        if (method === 0) xml = new TextDecoder().decode(data);
        else if (typeof DecompressionStream !== 'undefined') xml = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
        else throw new Error('This browser can’t open Word files. Save the reply as a .txt file instead.');
        const t = xml.replace(/<w:tab\/>/g, '\t').replace(/<w:br[^>]*\/>/g, '\n').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '');
        const box = document.createElement('textarea'); box.innerHTML = t; return box.value.replace(/\n{3,}/g, '\n\n').trim();
      }
      p += 46 + nl + el + cl;
    }
    throw new Error('No document text was found in this Word file.');
  }
  S.promptFiles = () => {
    const here = (location.pathname.split('/').pop() || '').toLowerCase(), list = PROMPTS[here];
    if (!list || document.getElementById('suitePromptFiles')) return;
    const mark = document.createElement('span'); mark.id = 'suitePromptFiles'; mark.hidden = true; document.body.appendChild(mark);
    const promptIds = list.map(x => x[0]);
    const promptTexts = () => promptIds.map(id => { const el = document.getElementById(id); return el ? el.textContent.trim() : ''; }).filter(Boolean);
    // copying a prompt adds the one-reply line too
    if (typeof window.copyText === 'function') { const orig = window.copyText; window.copyText = (t, b) => orig(typeof t === 'string' && t.trim() && promptTexts().includes(t.trim()) ? t.trim() + ONE_REPLY : t, b); }
    const replyDone = new Set();
    list.forEach(([pid, rid, label]) => {
      const pre = document.getElementById(pid); if (!pre) return;
      const box = pre.closest('.codebox'), bar = box && box.querySelector('.codebox-bar .r');
      if (bar) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = 'Download file';
        b.title = 'Download this prompt as a .txt file to attach in Copilot';
        b.addEventListener('click', () => {
          const t = pre.textContent.trim(); if (!t) return;
          const bl = document.getElementById('batchLabel'), bn = document.getElementById('batchNav');
          const part = (bl && bn && !bn.hidden) ? ' ' + document.getElementById('batchLabel').textContent.replace(/^Prompt /, 'part ').replace(/ of /, ' of ') : '';
          saveText(label + part + '.txt', t + ONE_REPLY);
        });
        bar.insertBefore(b, bar.firstChild);
        const d = document.createElement('details'); d.className = 'extra suite-file';
        d.innerHTML = '<summary>Send it to Copilot as a file <span class="muted">(for long prompts)</span></summary><div class="extra-body"><ol class="how"><li>Select <b>Download file</b> above.</li><li>In Copilot, attach the file to a new chat.</li><li>Send this message with it:</li></ol>'
          + '<div class="suite-msg"><span>' + esc(ATTACH_MSG) + '</span><button type="button" class="btn">Copy message</button></div>'
          + '<p class="note small">If Copilot answers with a file, download it and select <b>Open a reply file</b> by the reply box. Copying or downloading a prompt adds one line asking Copilot for a single reply, as a file if it’s too long for the chat.</p></div>';
        d.querySelector('.suite-msg button').addEventListener('click', e => { const btn = e.currentTarget; try { navigator.clipboard.writeText(ATTACH_MSG).then(() => { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy message'; }, 1600); }); } catch (err) {} });
        box.insertAdjacentElement('afterend', d);
      }
      const ta = rid && document.getElementById(rid);
      if (ta && !replyDone.has(rid)) {
        replyDone.add(rid);
        const row = document.createElement('div'); row.className = 'suite-reply';
        row.innerHTML = '<button type="button" class="btn small">Open a reply file</button><span class="muted small">.txt, .md, .json or Word file from Copilot</span><input type="file" accept=".txt,.md,.json,.csv,.tsv,.docx,text/plain" hidden>';
        const inp = row.querySelector('input'), msg = document.createElement('span'); msg.className = 'small'; row.appendChild(msg);
        row.querySelector('button').addEventListener('click', () => inp.click());
        inp.addEventListener('change', async () => {
          const f = inp.files[0]; inp.value = ''; if (!f) return;
          try {
            const t = /\.docx$/i.test(f.name) ? await docxText(await f.arrayBuffer()) : (await f.text()).replace(/^﻿/, '');
            ta.value = t; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.dispatchEvent(new Event('change', { bubbles: true }));
            msg.className = 'small suite-ok'; msg.textContent = '✓ ' + f.name + ' loaded';
          } catch (err) { msg.className = 'small suite-err'; msg.textContent = err.message || String(err); }
        });
        ta.insertAdjacentElement('beforebegin', row);
      }
    });
  };
  if (!document.body.dataset.home) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', S.promptFiles); else S.promptFiles(); }

  // cfg: { input: textarea id, prefix: this page's storage prefix, mode: 'export' | 'dates', open: details id to open }
  S.hook = cfg => {
    const ta = document.getElementById(cfg.input); if (!ta) return;
    const mode = cfg.mode || 'export';
    const bar = document.createElement('div'); bar.className = 'suite-bar'; bar.setAttribute('role', 'status');
    ta.insertAdjacentElement('beforebegin', bar);
    const valueFor = v => mode === 'dates' ? S.dateColumns(v.text) : v.text;
    const exampleShowing = () => { const b = document.getElementById('exampleBanner'); return !!(b && !b.hidden); };
    let note = '';
    const hash = t => { let h = 5381; const x = (t || '').trim(); for (let i = 0; i < x.length; i++) h = ((h << 5) + h + x.charCodeAt(i)) | 0; return String(h >>> 0); };
    const followKey = cfg.prefix + 'suiteFollow';
    const remember = () => { try { localStorage.setItem(followKey, hash(ta.value)); } catch (e) {} };
    const following = () => { try { return localStorage.getItem(followKey) === hash(ta.value); } catch (e) { return false; } };
    const render = () => {
      const v = S.get();
      if (!v) { bar.innerHTML = mode === 'dates' ? '' : '<span>Tip: save your model export once on the <a href="' + HOME + '">toolkit home page</a> and every tool picks it up. Pasting one here saves it too.</span>'; bar.hidden = mode === 'dates'; return; }
      bar.hidden = false;
      const same = ta.value.trim() === valueFor(v).trim();
      if (mode === 'dates' && !valueFor(v)) { bar.innerHTML = '<span>The saved model export has no date columns.</span>'; return; }
      bar.innerHTML = same
        ? '<span class="ok">&#10003; ' + (mode === 'dates' ? 'Date columns from the saved model export: ' : 'Using the saved model export: ') + S.describe(v) + (note ? ' &middot; ' + note : '') + '</span>'
        : '<span>' + (mode === 'dates' ? 'Fill this list from the saved model export? ' : 'The toolkit has a saved model export: ') + S.describe(v) + '</span><button type="button" class="btn" data-suite="use">' + (mode === 'dates' ? 'Fill from saved export' : 'Use it') + '</button>';
    };
    const use = () => {
      const v = S.get(); if (!v) return;
      if (exampleShowing()) { const c = document.getElementById('clearAll'); if (c) c.click(); }
      ta.value = valueFor(v);
      if (cfg.open) { const d = document.getElementById(cfg.open); if (d) d.open = true; }
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      try { localStorage.removeItem(cfg.prefix + 'blank'); } catch (e) {}
      remember(); note = ''; render();
    };
    bar.addEventListener('click', e => { if (e.target.closest('[data-suite=use]')) use(); });
    // Pasting an export here saves it for every tool
    ta.addEventListener('input', e => {
      if (e.isTrusted && mode === 'export' && S.looksLikeExport(ta.value)) {
        const prev = S.get();
        if (!prev || prev.text !== ta.value) { const ok = S.set(ta.value, ''); note = ok ? 'saved for the other tools too' : 'too large to share with the other tools (browser storage limit)'; if (ok) remember(); }
      }
      render();
    });
    // On opening: load the saved export when this page shows its example or is empty (and wasn't cleared on purpose)
    const v = S.get();
    let blank = false; try { blank = localStorage.getItem(cfg.prefix + 'blank') === '1'; } catch (e) {}
    // ...or when this page is still on an older saved export it took from the toolkit
    if (v && valueFor(v) && ta.value.trim() !== valueFor(v).trim() && (exampleShowing() || (!ta.value.trim() && !blank) || (ta.value.trim() && following()))) use();
    else render();
    window.addEventListener('storage', e => { if (e.key === KEY) render(); });
  };
})();
/*SUITE-END*/
