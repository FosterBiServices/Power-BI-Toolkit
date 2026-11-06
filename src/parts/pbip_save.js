/* PARKED (Nov 2026): not included in the build. The owner chose not to write into people's PBIP folders for now;
   see CLAUDE.md, Parked. To bring it back: append it to suite in build_site.py (suite=open(S+'suite.js').read()+open(S+'pbip_save.js').read()). */
/* ---------- Save a TMDL script into a PBIP folder ----------
   Every code box that holds a TMDL script (createOrReplace...) gets "Save to a PBIP folder". The script is split into
   its objects and merged into the semantic model's definition folder the way TMDL view would apply it:
   table: replaces tables/<table>.tmdl (or adds it)        ref table: adds or replaces its measures, columns... in that file
   relationship: added to relationships.tmdl (skipped when one already joins the same two columns)
   function / expression: added or replaced in functions.tmdl / expressions.tmdl     role: roles/<role>.tmdl
   model.tmdl gets a "ref table" line for each new table when it lists its tables that way.
   Nothing is written until the person sees the list of changes and confirms. Chrome and Edge write the files in place;
   other browsers read the folder and download the changed files as a .zip to copy over it. */
(function(){
  const S = window.SF_SUITE; if (!S) return;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const unq = s => { s = (s || '').trim(); return /^'.*'$/.test(s) ? s.slice(1, -1).replace(/''/g, "'") : s; };
  const qn = n => /^[A-Za-z_][\w]*$/.test(n) ? n : "'" + n.replace(/'/g, "''") + "'";
  const HEAD = /^(ref\s+)?(table|relationship|function|expression|role|perspective|culture|dataSource|queryGroup|annotation)\s+('(?:[^']|'')*'|[^\s=]+)/;
  const CHILD = /^\t(measure|column|partition|hierarchy|annotation|calculationGroup|changedProperty|extendedProperty)\s+('(?:[^']|'')*'|[^\s=]+)?/;
  const lc = s => (s || '').toLowerCase();
  const trimEnd = a => { while (a.length && !a[a.length - 1].trim()) a.pop(); return a; };

  // a script (TMDL view, with or without createOrReplace) -> top-level blocks { ref, kind, name, lines } at file indentation
  function split(text){
    let lines = String(text || '').replace(/\r/g, '').split('\n');
    const ci = lines.findIndex(l => /^(createOrReplace|create|alter)\s*$/.test(l));
    if (ci >= 0) lines = lines.slice(ci + 1).map(l => l.replace(/^\t/, ''));
    const out = []; let doc = [], cur = null;
    lines.forEach(l => {
      if (/^\/\/\//.test(l)) { doc.push(l); cur = null; return; }
      const h = HEAD.exec(l);
      if (h) { cur = { ref: !!h[1], kind: h[2], name: unq(h[3]), lines: doc.concat(l) }; doc = []; out.push(cur); return; }
      if (cur) cur.lines.push(l);
    });
    out.forEach(b => trimEnd(b.lines));
    return out;
  }
  // a table file -> { head: lines up to the first child, kids: [{ kind, name, lines }] }
  function kids(lines){
    const head = [], list = []; let doc = [], cur = null;
    lines.forEach(l => {
      if (/^\t\/\/\//.test(l)) { doc.push(l); return; }
      const c = CHILD.exec(l);
      if (c) { cur = { kind: c[1], name: unq(c[2] || ''), lines: doc.concat(l) }; doc = []; list.push(cur); return; }
      if (doc.length) { (cur ? cur.lines : head).push(...doc); doc = []; }
      (cur ? cur.lines : head).push(l);
    });
    list.forEach(k => trimEnd(k.lines));
    return { head: trimEnd(head), kids: list };
  }
  const joinKids = (head, list, nl) => head.concat(...list.map(k => [''].concat(k.lines))).join(nl) + nl;
  const relEnds = lines => { const g = k => { const m = new RegExp('^\\t' + k + ':\\s*(.+)$').exec(lines.find(l => new RegExp('^\\t' + k + ':').test(l)) || ''); return m ? lc(m[1].replace(/'/g, '')) : ''; }; return g('fromColumn') + '>' + g('toColumn'); };

  /* script + the definition folder's files ({ 'tables/Sales.tmdl': text, 'model.tmdl': text, ... }) ->
     { changes: [{ path, text, what, isNew }], skipped: [text], errors: [text] } */
  S.pbipPlan = (script, files) => {
    const blocks = split(script), changes = new Map(), skipped = [], errors = [], what = {};
    const sample = files['model.tmdl'] || Object.values(files)[0] || '', nl = /\r\n/.test(sample) ? '\r\n' : '\n';
    const cur = p => changes.has(p) ? changes.get(p).text : files[p];
    const put = (p, text, w) => { const isNew = files[p] === undefined; changes.set(p, { path: p, text, isNew }); (what[p] = what[p] || []).push(w); };
    const lines = p => (cur(p) || '').replace(/\r/g, '').split('\n');
    // which file holds each table (by its first line, since a file name can differ from the table's name)
    const tableFile = {};
    Object.keys(files).filter(p => /^tables\/[^/]+\.tmdl$/i.test(p)).forEach(p => { const h = HEAD.exec((files[p].replace(/\r/g, '').split('\n').find(l => HEAD.test(l)) || '')); if (h) tableFile[lc(unq(h[3]))] = p; });
    const safe = n => n.replace(/[\\/:*?"<>|]/g, '_');
    const newTables = [], newRoles = [];
    blocks.forEach(b => {
      if (b.kind === 'table') {
        const p = tableFile[lc(b.name)];
        if (b.ref) {
          if (!p) { errors.push('Table ' + b.name + ' isn’t in this model, so its ' + kids(b.lines).kids.length + ' item(s) can’t be added to it.'); return; }
          const have = kids(lines(p)), add = kids(b.lines).kids; let n = 0, r = 0;
          add.forEach(k => { const i = have.kids.findIndex(x => x.kind === k.kind && lc(x.name) === lc(k.name)); if (i >= 0) { have.kids[i] = k; r++; } else { have.kids.push(k); n++; } });
          put(p, joinKids(have.head, have.kids, nl), b.name + ': ' + [n ? 'adds ' + n : '', r ? 'replaces ' + r : ''].filter(Boolean).join(', ') + ' (' + Array.from(new Set(add.map(k => k.kind + 's'))).join(', ') + ')');
        } else {
          const path = p || 'tables/' + safe(b.name) + '.tmdl';
          put(path, b.lines.join(nl) + nl, (p ? 'replaces table ' : 'adds table ') + b.name);
          if (!p) { newTables.push(b.name); tableFile[lc(b.name)] = path; }
        }
      } else if (b.kind === 'relationship') {
        const p = 'relationships.tmdl', all = split(cur(p) || ''), ends = relEnds(b.lines);
        if (all.some(x => x.kind === 'relationship' && relEnds(x.lines) === ends && lc(x.name) !== lc(b.name))) { skipped.push('A relationship already joins ' + ends.replace('>', ' to ')); return; }
        const i = all.findIndex(x => x.kind === 'relationship' && lc(x.name) === lc(b.name));
        if (i >= 0) all[i] = b; else all.push(b);
        put(p, all.map(x => x.lines.join(nl)).join(nl + nl) + nl, (i >= 0 ? 'replaces' : 'adds') + ' a relationship (' + ends.replace('>', ' to ') + ')');
      } else if (b.kind === 'function' || b.kind === 'expression') {
        const p = b.kind === 'function' ? 'functions.tmdl' : 'expressions.tmdl', all = split(cur(p) || '');
        const i = all.findIndex(x => x.kind === b.kind && lc(x.name) === lc(b.name));
        if (i >= 0) all[i] = b; else all.push(b);
        put(p, all.map(x => x.lines.join(nl)).join(nl + nl) + nl, (i >= 0 ? 'replaces ' : 'adds ') + b.kind + ' ' + b.name);
      } else if (b.kind === 'role') {
        const p = 'roles/' + safe(b.name) + '.tmdl';
        put(p, b.lines.join(nl) + nl, (files[p] !== undefined ? 'replaces' : 'adds') + ' role ' + b.name);
        if (files[p] === undefined) newRoles.push(b.name);
      } else skipped.push('A ' + b.kind + ' (' + b.name + ') isn’t saved to files here: paste it in TMDL view.');
    });
    // model.tmdl lists tables and roles with "ref table X" lines: add the new ones after the last of their kind
    const m = cur('model.tmdl');
    if (m !== undefined && (newTables.length || newRoles.length)) {
      const ml = m.replace(/\r/g, '').split('\n');
      [['table', newTables], ['role', newRoles]].forEach(([kind, names]) => {
        let last = -1; ml.forEach((l, i) => { if (new RegExp('^ref ' + kind + ' ').test(l)) last = i; });
        if (last < 0 || !names.length) return;
        const known = new Set(ml.filter(l => l.startsWith('ref ' + kind + ' ')).map(l => lc(unq(l.slice(5 + kind.length)))));
        const add = names.filter(n => !known.has(lc(n))).map(n => 'ref ' + kind + ' ' + qn(n));
        if (add.length) { ml.splice(last + 1, 0, ...add); }
      });
      const t = ml.join(nl); if (t !== m.replace(/\r\n/g, '\n').split('\n').join(nl)) put('model.tmdl', t, 'lists the new ' + (newTables.length ? 'tables' : 'roles'));
    }
    // leave out files that come out the same as they are now (the script was saved before)
    const norm = t => (t || '').replace(/\r/g, '').replace(/\s+$/, '');
    const out = Array.from(changes.values()).filter(c => files[c.path] === undefined || norm(files[c.path]) !== norm(c.text));
    return { changes: out.map(c => Object.assign(c, { what: what[c.path] })), skipped, errors, same: changes.size - out.length };
  };
  S.pbipSplit = split;

  // ---------- a .zip with no compression (for browsers that can't write to a folder) ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  S.zip = files => {
    const enc = new TextEncoder(), parts = [], central = []; let off = 0;
    files.forEach(f => {
      const name = enc.encode(f.path), data = typeof f.text === 'string' ? enc.encode(f.text) : f.text, crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [12, 0x21, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, name.length, 2]].forEach(([o, v, n]) => n === 4 ? h.setUint32(o, v, true) : h.setUint16(o, v, true));
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [14, 0x21, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, name.length, 2], [42, off, 4]].forEach(([o, v, n]) => n === 4 ? c.setUint32(o, v, true) : c.setUint16(o, v, true));
      central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + data.length;
    });
    const size = central.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: 'application/zip' });
  };

  // ---------- finding and reading the project ----------
  // kind 'model': each *.SemanticModel/definition folder, all its .tmdl files (tables/ and roles/ too)
  // kind 'report': each *.Report folder, only the files `want` lists (paths inside the .Report folder)
  const readText = async f => { const b = new Uint8Array(await f.arrayBuffer()); return new TextDecoder(b[0] === 0xFF && b[1] === 0xFE ? 'utf-16le' : 'utf-8').decode(b).replace(/^﻿/, ''); };
  const SKIPDIR = /^(\.git|node_modules|\.pbi|StaticResources)$/;
  async function targetsFromHandle(root, kind){
    const found = [];
    const look = async (dir, path, depth) => {
      const parent = path.split('/').slice(-2, -1)[0] || '';
      if (kind === 'model' && dir.name === 'definition' && /\.SemanticModel$/i.test(parent)) { found.push({ dir, label: parent }); return; }
      if (kind === 'report' && /\.Report$/i.test(dir.name)) { found.push({ dir, label: dir.name }); return; }
      if (depth > 3) return;
      for await (const [n, h] of dir.entries()) if (h.kind === 'directory' && !SKIPDIR.test(n) && !(kind === 'model' && /\.Report$/i.test(n)) && !(kind === 'report' && /\.SemanticModel$/i.test(n))) await look(h, path + '/' + n, depth + 1);
    };
    await look(root, root.name, 0);
    return found;
  }
  async function fileAt(dir, path){ const parts = path.split('/'); let d = dir; for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p); return (await d.getFileHandle(parts[parts.length - 1])).getFile(); }
  async function readTarget(dir, kind, want){
    const files = {};
    if (kind === 'report') { for (const p of want || []) { try { files[p] = await readText(await fileAt(dir, p)); } catch (e) {} } return files; }
    const walk = async (d, pre) => { for await (const [n, h] of d.entries()) { if (h.kind === 'directory') { if (/^(tables|roles|cultures|perspectives)$/i.test(n) && !pre) await walk(h, n + '/'); } else if (/\.tmdl$/i.test(n)) files[pre + n] = await readText(await h.getFile()); } };
    await walk(dir, '');
    return files;
  }
  async function writeTarget(dir, changes){
    for (const c of changes) {
      const parts = c.path.split('/'); let d = dir;
      for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true });
      const fh = await d.getFileHandle(parts[parts.length - 1], { create: true }), w = await fh.createWritable();
      await w.write(c.text); await w.close();
    }
  }
  // fallback: a folder picked with <input webkitdirectory> -> { label: { prefix, files: [{ rel, file }] } }
  function targetsFromList(list, kind){
    const by = {}, re = kind === 'model' ? /^(.*?([^/]+\.SemanticModel)\/definition)\/(.+\.tmdl)$/i : /^(.*?([^/]+\.Report))\/(.+)$/i;
    list.forEach(f => { const p = (f.webkitRelativePath || f.name).replace(/\\/g, '/'), m = re.exec(p); if (m) (by[m[2]] = by[m[2]] || { prefix: m[1], files: [] }).files.push({ rel: m[3], file: f }); });
    return by;
  }

  /* The save flow, shared by every "save into a PBIP folder" button.
     o: { btn, panel, kind: 'model'|'report', want: [paths to read] (report), plan: (files, label) => { changes, errors, skipped, same },
          done: label => html after saving, prefer: () => folder label to pick first when there are several } */
  S.pbipSave = o => {
    const { btn, panel, kind } = o;
    const input = document.createElement('input'); input.type = 'file'; input.hidden = true; input.webkitdirectory = true; input.multiple = true; panel.before(input);
    const say = (cls, html) => { panel.hidden = false; panel.innerHTML = '<div class="msg ' + cls + '">' + html + '</div>'; };
    const what = kind === 'model' ? 'semantic model' : 'report';
    // one line per file, or one line for a group of files (a page's visuals)
    const lines = ch => { const seen = {}; return ch.map(c => {
      if (c.group) { if (seen[c.group]) return ''; seen[c.group] = 1; const n = ch.filter(x => x.group === c.group).length; return '<li>' + esc(c.group) + ': ' + n + ' new file' + (n === 1 ? '' : 's') + '</li>'; }
      return '<li><code>' + esc(c.path) + '</code>' + (c.isNew ? ' (new)' : '') + (c.what ? ': ' + esc([].concat(c.what).join('; ')) : '') + '</li>'; }).join(''); };
    async function offer(targets, pick){
      const names = Object.keys(targets); if (!names.length) { say('err', 'No ' + what + ' was found there. Choose the folder that holds the .pbip file.'); return; }
      const want = o.prefer && o.prefer(), label = pick || names.find(n => want && lc(n) === lc(want)) || names[0];
      let plan; try { plan = await o.plan(await targets[label].read(), label); } catch (e) { say('err', esc(e && e.message || e)); return; }
      const sel = names.length > 1 ? ' <label class="small">' + (kind === 'model' ? 'Model' : 'Report') + ' <select data-sc-model>' + names.map(n => '<option' + (n === label ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select></label>' : '';
      const notes = (plan.errors || []).concat(plan.skipped || []);
      if (!plan.changes.length) { say((plan.errors || []).length ? 'err' : plan.same ? 'ok' : 'warn', '<b>' + (plan.same && !(plan.errors || []).length ? '&#10003; Everything here is already in ' + esc(label) + '.' : 'Nothing to save in ' + esc(label) + '.') + '</b>' + sel + notes.map(x => '<br>' + esc(x)).join('')); }
      else {
        panel.hidden = false;
        panel.innerHTML = '<div class="msg info"><b>' + esc(label) + '</b>: ' + plan.changes.length + ' file' + (plan.changes.length === 1 ? '' : 's') + ' will change.' + sel
          + '<ul>' + lines(plan.changes) + '</ul>'
          + (notes.length ? '<div class="small">' + notes.map(esc).join('<br>') + '</div>' : '')
          + '<div class="small">Close the report in Power BI Desktop first. If it’s open, Desktop keeps its own copy and overwrites these files when it saves.</div></div>'
          + '<div class="row"><button type="button" class="btn primary" data-sc-go>' + (targets[label].write ? 'Save the changes' : 'Download the changed files (.zip)') + '</button><button type="button" class="btn" data-sc-cancel>Cancel</button></div>';
        panel.querySelector('[data-sc-cancel]').onclick = () => { panel.hidden = true; btn.focus(); };
        panel.querySelector('[data-sc-go]').onclick = async () => {
          try {
            if (targets[label].write) { await targets[label].write(plan.changes); say('ok', '&#10003; Saved ' + plan.changes.length + ' file' + (plan.changes.length === 1 ? '' : 's') + ' in <b>' + esc(label) + '</b>. ' + (o.done ? o.done(label) : 'Open the .pbip in Power BI Desktop to see the changes.')); }
            else {
              const pre = targets[label].prefix, blob = S.zip(plan.changes.map(c => ({ path: pre + '/' + c.path, text: c.text })));
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = label.replace(/\.(SemanticModel|Report)$/i, '') + ' - changes.zip'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
              say('ok', '&#10003; Downloaded. Unzip it into the folder you chose (the paths match) and replace the files when asked.');
            }
          } catch (e) { say('err', 'Couldn’t save: ' + esc(e && e.message || e) + '. Check that the folder isn’t read-only and Desktop has closed the report.'); }
        };
      }
      const s = panel.querySelector('[data-sc-model]'); if (s) s.onchange = () => offer(targets, s.value);
    }
    btn.addEventListener('click', async () => {
      if (window.showDirectoryPicker) {
        let root; try { root = await window.showDirectoryPicker({ id: 'sf-pbip-save', mode: 'readwrite' }); } catch (e) { if (e && e.name === 'AbortError') return; input.click(); return; }
        try {
          const ts = await targetsFromHandle(root, kind), targets = {};
          ts.forEach(t => { targets[t.label] = { read: () => readTarget(t.dir, kind, o.want), write: ch => writeTarget(t.dir, ch) }; });
          await offer(targets);
        } catch (e) { say('err', 'Couldn’t read that folder: ' + esc(e && e.message || e)); }
      } else input.click();
    });
    input.addEventListener('change', async () => {
      const by = targetsFromList(Array.from(input.files || []), kind), targets = {}; input.value = '';
      Object.keys(by).forEach(k => { targets[k] = { prefix: by[k].prefix, read: async () => { const f = {}; for (const x of by[k].files) if (kind === 'model' || (o.want || []).includes(x.rel)) f[x.rel] = await readText(x.file); return f; } }; });
      await offer(targets);
    });
  };

  // ---------- the button under every TMDL code box ----------
  const CSS = '.sc-save{margin-top:10px;display:flex;flex-direction:column;gap:8px}.sc-save ul{margin:4px 0 0 18px;padding:0}.sc-save li{margin:2px 0}.sc-save .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}';
  S.pbipCss = () => { if (document.getElementById('sc-save-css')) return; const s = document.createElement('style'); s.id = 'sc-save-css'; s.textContent = CSS; document.head.appendChild(s); };
  const isScript = t => /^\s*createOrReplace\s*\n/.test(t || '');
  function attach(pre){
    const box = pre.closest('.codebox'); if (!box || box.dataset.scSave) return;
    const bar = box.querySelector('.codebox-bar .r') || box.querySelector('.codebox-bar'); if (!bar) return;
    box.dataset.scSave = '1'; S.pbipCss();
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn'; btn.textContent = 'Save to a PBIP folder'; btn.hidden = true;
    btn.title = 'Add this script to a Power BI project (.pbip) folder’s model files';
    bar.insertBefore(btn, bar.firstChild);
    const panel = document.createElement('div'); panel.className = 'sc-save'; panel.hidden = true; box.after(panel);
    const sync = () => { btn.hidden = !isScript(pre.textContent); if (btn.hidden) panel.hidden = true; };
    new MutationObserver(sync).observe(pre, { childList: true, characterData: true, subtree: true }); sync();
    S.pbipSave({ btn, panel, kind: 'model', plan: files => S.pbipPlan(pre.textContent, files),
      prefer: () => { const v = S.get && S.get(); return v && v.name ? v.name + '.SemanticModel' : ''; },
      done: () => 'Open the .pbip in Power BI Desktop to see the changes' + (/^\tfunction /m.test(pre.textContent) ? ' (DAX functions need the DAX user-defined functions preview turned on)' : '') + '.' });
  }
  const scan = () => document.querySelectorAll('.codebox pre').forEach(attach);
  if (!document.body.dataset.home) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan(); }
})();
