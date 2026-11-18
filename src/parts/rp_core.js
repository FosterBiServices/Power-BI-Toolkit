/* ---------- Relationship Planner: how filters flow, what-if changes, goals in plain words ----------
   Filters flow along ACTIVE relationships from the one side to the many side (Customer -> Sales).
   A bidirectional relationship, and every one-to-one, also sends them back. A many-to-many with a
   single direction filters from its "to" table to its "from" table, as Power BI stores it.
   Two different routes from one table to another is ambiguity. */
const RP = (() => {
  const low = s => (s || '').toLowerCase();
  const MAX_STEPS = 60000, MAX_DEPTH = 12, MAX_PATHS = 12;
  const relKey = r => [r.fromTable, r.fromColumn, r.toTable, r.toColumn].map(low).join('\u0001');
  const BRIDGE = /^(bridge|brg|xref|map)[ _]|[ _](bridge|xref|map)$/i;
  const DATE_NAME = /^(date|dates|calendar|dim ?date|date table)$/i;

  /* ---------- the model, from the shared reader (parseModel in builder_core) ---------- */
  function fromParsed(m){
    const names = new Map();
    const add = n => { if (n && !names.has(low(n))) names.set(low(n), n); };
    (m.tables || []).forEach(t => add(t.name));
    const cols = new Map();
    (m.columns || []).forEach(c => { add(c.table); const k = low(c.table); if (!cols.has(k)) cols.set(k, []); cols.get(k).push(c.name); });
    const rels = [];
    (m.rels || []).forEach(r => {
      add(r.fromTable); add(r.toTable);
      const fc = low(r.fromCard), tc = low(r.toCard);
      let x = { fromTable: names.get(low(r.fromTable)), fromColumn: r.fromColumn, toTable: names.get(low(r.toTable)), toColumn: r.toColumn };
      let card = fc === 'one' && tc === 'one' ? '1:1' : fc === 'many' && tc === 'many' ? 'M:M' : 'M:1';
      if (fc === 'one' && tc === 'many') x = { fromTable: x.toTable, fromColumn: x.toColumn, toTable: x.fromTable, toColumn: x.fromColumn };
      rels.push(Object.assign(x, { card, both: !!r.both, active: !r.inactive }));
    });
    const dates = new Set();
    (m.tables || []).forEach(t => { if ((typeof isDateTable === 'function' && isDateTable(t)) || DATE_NAME.test(t.name)) dates.add(low(t.name)); });
    rels.forEach(r => { r.key = relKey(r); });
    return { tables: [...names.values()].sort((a, b) => a.localeCompare(b)), rels, cols, dates, added: new Set() };
  }
  const canon = (model, n) => model.tables.find(t => low(t) === low(n)) || null;
  const flowsBoth = r => r.both || r.card === '1:1';

  /* ---------- changes (what-if) ----------
     { op: 'add', one: [table, column], many: [table, column], both }   a new relationship (new tables are made)
     { op: 'dir', key, both }  { op: 'active', key, active }  { op: 'remove', key }   on an existing one */
  function apply(model, changes){
    const out = { tables: model.tables.slice(), rels: model.rels.map(r => Object.assign({}, r)), cols: new Map(model.cols), dates: model.dates, added: new Set(model.added), skipped: [] };
    (changes || []).forEach((c, i) => {
      if (c.op === 'add') {
        const [ot, oc] = c.one || [], [mt, mc] = c.many || [];
        if (!ot || !mt || !oc || !mc || low(ot) === low(mt)) { out.skipped.push(i); return; }
        [ot, mt].forEach(t => { if (!canon(out, t)) { out.tables.push(t); out.tables.sort((a, b) => a.localeCompare(b)); out.added.add(low(t)); } });
        const r = { fromTable: canon(out, mt), fromColumn: mc, toTable: canon(out, ot), toColumn: oc, card: c.card === 'M:M' ? 'M:M' : c.card === '1:1' ? '1:1' : 'M:1', both: !!c.both, active: c.active !== false, isNew: true, change: i };
        r.key = relKey(r);
        if (out.rels.some(x => x.key === r.key)) { out.skipped.push(i); return; }
        out.rels.push(r);
        return;
      }
      const r = out.rels.find(x => x.key === c.key);
      if (!r) { out.skipped.push(i); return; }
      if (c.op === 'dir') { r.both = !!c.both; r.changed = true; r.change = i; }
      else if (c.op === 'active') { r.active = !!c.active; r.changed = true; r.change = i; }
      else if (c.op === 'remove') out.rels.splice(out.rels.indexOf(r), 1);
    });
    return out;
  }

  /* ---------- the filter graph ---------- */
  function graph(model){
    const adj = new Map(model.tables.map(t => [low(t), []]));
    const edge = (a, b, r) => { if (!adj.has(low(a))) adj.set(low(a), []); adj.get(low(a)).push({ to: b, rel: r }); };
    model.rels.forEach(r => { if (!r.active) return; edge(r.toTable, r.fromTable, r); if (flowsBoth(r)) edge(r.fromTable, r.toTable, r); });
    const linked = new Set(); model.rels.forEach(r => { if (r.active) { linked.add(low(r.fromTable)); linked.add(low(r.toTable)); } });
    return { model, adj, linked, reachC: new Map(), ambC: new Map(), cut: new Set() };
  }
  // tables a filter on src reaches: lower name -> { name, hops, from, rel }
  function reach(g, src){
    const k = low(src);
    if (g.reachC.has(k)) return g.reachC.get(k);
    const out = new Map(), seen = new Set([k]), q = [[k, 0]];
    while (q.length) {
      const [cur, d] = q.shift();
      for (const e of g.adj.get(cur) || []) {
        const n = low(e.to); if (seen.has(n)) continue;
        seen.add(n); out.set(n, { name: e.to, hops: d + 1, from: cur, rel: e.rel }); q.push([n, d + 1]);
      }
    }
    g.reachC.set(k, out);
    return out;
  }
  // every simple path src -> dst (shortest first), as [{ to, rel }]
  function paths(g, src, dst){
    const found = [], target = low(dst), stack = [[low(src), [], new Set([low(src)])]];
    let steps = 0;
    while (stack.length && found.length < MAX_PATHS && steps++ < MAX_STEPS) {
      const [node, path, seen] = stack.pop();
      if (path.length >= MAX_DEPTH) continue;
      for (const e of g.adj.get(node) || []) {
        const n = low(e.to); if (seen.has(n)) continue;
        const p = path.concat([{ to: e.to, rel: e.rel }]);
        if (n === target) found.push(p); else { const s2 = new Set(seen); s2.add(n); stack.push([n, p, s2]); }
      }
    }
    return found.sort((a, b) => a.length - b.length);
  }
  // tables src reaches by more than one route: lower name -> [path, path, ...]
  function ambiguity(g, src){
    const k = low(src);
    if (g.ambC.has(k)) return g.ambC.get(k);
    const count = new Map(), stack = [[k, new Set([k]), 0]];
    let steps = 0;
    while (stack.length) {
      if (++steps > MAX_STEPS) { g.cut.add(src); break; }
      const [node, seen, d] = stack.pop();
      if (d >= MAX_DEPTH) continue;
      for (const e of g.adj.get(node) || []) {
        const n = low(e.to); if (seen.has(n)) continue;
        count.set(n, (count.get(n) || 0) + 1);
        const s2 = new Set(seen); s2.add(n); stack.push([n, s2, d + 1]);
      }
    }
    const out = new Map();
    count.forEach((c, n) => { if (c > 1) out.set(n, paths(g, src, (reach(g, src).get(n) || {}).name || n)); });
    g.ambC.set(k, out);
    return out;
  }
  // every pair of tables with more than one route, once per pair and source
  function allAmbiguity(g){
    const out = [];
    g.model.tables.forEach(s => { if (!g.linked.has(low(s))) return; ambiguity(g, s).forEach((ps, n) => out.push({ from: s, to: (reach(g, s).get(n) || {}).name || n, paths: ps })); });
    return out;
  }

  /* ---------- roles: fact (only on the many side), lookup (only on the one side), both, none ---------- */
  function roles(model){
    const many = new Set(), one = new Set(), nMany = new Map(), bothMany = new Set();
    model.rels.forEach(r => {
      many.add(low(r.fromTable)); one.add(low(r.toTable)); nMany.set(low(r.fromTable), (nMany.get(low(r.fromTable)) || 0) + 1);
      if (r.both && r.card !== '1:1') bothMany.add(low(r.fromTable));
      if (r.card === '1:1') { many.add(low(r.toTable)); one.add(low(r.fromTable)); }
    });
    const out = new Map();
    model.tables.forEach(t => {
      const k = low(t);
      // a bridge: named like one, or only on the many side of two or more relationships, one of them both ways
      const bridge = many.has(k) && (BRIDGE.test(t) || (!one.has(k) && (nMany.get(k) || 0) >= 2 && bothMany.has(k)));
      out.set(k, model.dates.has(k) ? 'date' : bridge ? 'bridge' : many.has(k) && one.has(k) ? 'both' : many.has(k) ? 'fact' : one.has(k) ? 'lookup' : 'none');
    });
    return out;
  }
  const ROLE_WORD = { fact: 'fact', lookup: 'lookup', both: 'lookup and fact', bridge: 'bridge', date: 'date', none: 'no relationships' };
  function facts(model){ const r = roles(model); return model.tables.filter(t => r.get(low(t)) === 'fact'); }

  /* ---------- words ---------- */
  const arrow = r => flowsBoth(r) ? ' ⇄ ' : ' → ';
  function pathText(src, p){ return src + p.map(s => arrow(s.rel) + s.to).join(''); }
  function relText(r){ return r.toTable + '[' + r.toColumn + ']' + arrow(r) + r.fromTable + '[' + r.fromColumn + ']'; }
  function relWords(r){
    const dir = r.card === '1:1' ? 'one-to-one, filters both ways' : r.card === 'M:M' ? 'many-to-many, ' + (r.both ? 'filters both ways' : 'filters from ' + r.toTable + ' to ' + r.fromTable)
      : r.both ? 'filters both ways' : 'filters from ' + r.toTable + ' to ' + r.fromTable;
    return dir + (r.active ? '' : ', inactive');
  }

  // Why a filter on src doesn't reach dst
  function whyNot(g, src, dst){
    const model = g.model;
    const und = (activeOnly) => {
      const adj = new Map();
      model.rels.forEach(r => { if (activeOnly && !r.active) return; [[r.toTable, r.fromTable], [r.fromTable, r.toTable]].forEach(([a, b]) => { if (!adj.has(low(a))) adj.set(low(a), []); adj.get(low(a)).push({ to: b, rel: r, from: a }); }); });
      const prev = new Map([[low(src), null]]), q = [low(src)];
      while (q.length) {
        const cur = q.shift();
        for (const e of adj.get(cur) || []) {
          const n = low(e.to); if (prev.has(n)) continue;
          prev.set(n, e); if (n === low(dst)) { const hops = []; let k = n; while (prev.get(k)) { const h = prev.get(k); hops.unshift(h); k = low(h.from); } return hops; }
          q.push(n);
        }
      }
      return null;
    };
    let hops = und(true);
    if (!hops) {
      const ih = und(false);
      if (ih) return { kind: 'inactive', hops: ih, rels: ih.filter(h => !h.rel.active).map(h => h.rel) };
      return { kind: 'none' };
    }
    const r = reach(g, src);
    for (let i = 0; i < hops.length; i++) {
      const h = hops[i];
      const ok = (low(h.from) === low(h.rel.toTable) && low(h.to) === low(h.rel.fromTable)) || flowsBoth(h.rel);
      if (!ok) return { kind: 'direction', hops, at: i, rel: h.rel, upto: i === 0 ? src : hops[i - 1].to, reachedUpTo: i === 0 || r.has(low(hops[i - 1].to)) };
    }
    return { kind: 'direction', hops, at: 0, rel: hops[0].rel, upto: src };
  }

  /* ---------- goals in plain words ---------- */
  const ESC = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const isWord = ch => !!ch && /[\p{L}\p{N}_]/u.test(ch);
  // table names mentioned in a sentence: longest names first, plural or singular, quoted or not
  function mentions(text, names){
    const t = text.replace(/[‘’]/g, "'");
    const taken = new Array(t.length).fill(false), out = [];
    names.slice().sort((a, b) => b.length - a.length).forEach(n => {
      const forms = new Set([n, n + 's', n + 'es', n.replace(/ies$/i, 'y'), n.replace(/s$/i, ''), n.replace(/ies$/i, 'ys')].filter(x => x.length > 1));
      forms.forEach(f => {
        const re = new RegExp(ESC(f), 'gi'); let m;
        while ((m = re.exec(t))) {
          const a = m.index, b = a + m[0].length;
          if (isWord(t[a - 1]) || isWord(t[b])) continue;
          if (taken.slice(a, b).some(Boolean)) continue;
          for (let i = a; i < b; i++) taken[i] = true;
          out.push({ name: n, at: a, end: b });
        }
      });
    });
    return out.sort((x, y) => x.at - y.at);
  }
  const VERB = /\b(filter(?:s|ed|ing)?|slic(?:e|es|ed|ing)|reach(?:es|ed)?|narrow(?:s|ed)?|affect(?:s|ed)?|driv(?:e|es|en)|flows? (?:in)?to|cascades? to|propagates? to)\b/i;
  const PASSIVE = /\b(?:is|are|be|being|been|gets?|got)\s+(?:not\s+|never\s+)?(?:filtered|sliced|reached|narrowed|affected|driven)\s+by\b/i;
  const NEG = /\b(not|never|no longer|cannot|nothing)\b|n['’]t\b/i;
  const EXCEPT = /\b(except(?: for)?|but not|other than|apart from|excluding|besides|minus|without)\b/i;
  const ALL = /\b(every|all|each|everything|entire|whole|rest of)\b/i;
  function parseGoals(text, model){
    const names = model.tables;
    return (text || '').replace(/\r/g, '').split('\n').map((raw, i) => {
      const line = raw.replace(/^\s*([-*•]|\d+[.)])\s*/, '').trim();
      if (!line || /^(#|\/\/)/.test(line)) return null;
      const g = { line, n: i + 1 };
      if (/ambigu|two (routes|paths|ways)|more than one (route|path|way)|only one (route|path|way)/i.test(line) && !VERB.test(line.replace(/ambigu\w*/ig, ''))) {
        g.kind = /\ballow|\bfine\b|\bok\b|\bokay\b/i.test(line) && !/\bnot\b/i.test(line) ? 'allowAmbiguity' : 'noAmbiguity';
        return g;
      }
      const pm = PASSIVE.exec(line), vm = pm ? null : VERB.exec(line);
      if (!pm && !vm) { g.kind = 'unknown'; g.why = 'No verb found. Write it as “A should filter B” or “A should not filter B”.'; return g; }
      const at = (pm || vm).index, end = at + (pm || vm)[0].length;
      // active: "A should filter B"; passive: "B should be filtered by A"
      const subj = pm ? [end, line.length] : [0, at], targ = pm ? [0, at] : [end, line.length];
      const ms = mentions(line, names);
      const inside = (m, r) => m.at >= r[0] && m.end <= r[1];
      g.neg = NEG.test(line.slice(0, end));
      const subjects = ms.filter(m => inside(m, subj));
      if (!subjects.length) {
        const w = line.slice(subj[0], subj[1]).replace(/\b(should|must|needs? to|has to|have to|will|can|does|do|is|are|be|the|a|an|new|table|tables|only|also|not|never|always|by)\b/gi, ' ').replace(/[^\p{L}\p{N}_ ]/gu, ' ').trim().split(/\s+/).filter(Boolean)[0];
        g.kind = 'unknown'; g.missing = w || '';
        g.why = w ? '\u201c' + w + '\u201d isn\u2019t a table in your model or your changes yet.' : 'Name the table that does the filtering.';
        return g;
      }
      g.from = [...new Set(subjects.map(m => m.name))];
      const tText = line.slice(targ[0], targ[1]);
      const ex = EXCEPT.exec(tText);
      const exAt = ex ? targ[0] + ex.index : targ[1];
      const exNames = new Set(ms.filter(m => m.at >= exAt && m.end <= targ[1]).map(m => m.name));
      g.except = [...exNames];
      g.withDates = /\binclud\w*\s+(the\s+)?(dates?|calendar)\b/i.test(line);
      const scopeText = line.slice(targ[0], exAt);
      const named = ms.filter(m => m.at >= targ[0] && m.end <= exAt).map(m => m.name).filter(n => !g.from.includes(n));
      if (ALL.test(scopeText) || (!named.length && /\b(report|model|everywhere|anything)\b/i.test(scopeText))) {
        g.scope = /\bfacts?\b/i.test(scopeText) ? 'facts' : /\b(lookups?|dimensions?|dims?)\b/i.test(scopeText) ? 'lookups' : 'all';
        g.to = [];
      } else {
        g.scope = 'list';
        g.to = [...new Set(named)];
        if (!g.to.length) { g.kind = 'unknown'; g.why = 'No table found ' + (pm ? 'before' : 'after') + ' \u201c' + (pm || vm)[0] + '\u201d. Name the tables, or say \u201cevery table\u201d or \u201cevery fact table\u201d.'; return g; }
      }
      g.kind = g.neg ? 'notFilters' : 'filters';
      return g;
    }).filter(Boolean);
  }
  // the tables a goal is about
  function targets(goal, model, src){
    const r = roles(model), ex = new Set((goal.except || []).map(low));
    let list;
    if (goal.scope === 'list') list = goal.to.slice();
    else {
      const g = graph(model);
      list = model.tables.filter(t => {
        const k = low(t), role = r.get(k);
        if (low(t) === low(src) || !g.linked.has(k)) return false;
        if (role === 'date' && !goal.withDates) return false;
        if (goal.scope === 'facts') return role === 'fact';
        if (goal.scope === 'lookups') return role === 'lookup';
        return true;
      });
    }
    return list.filter(t => !ex.has(low(t)) && low(t) !== low(src));
  }

  /* ---------- checking goals, with advice tested by trying each fix ---------- */
  function evaluate(model, goals, opts){
    opts = opts || {};
    const g = graph(model);
    const amb = allAmbiguity(g);
    const res = { model, graph: g, ambiguity: amb, goals: [], cut: [...g.cut] };
    (goals || []).forEach(goal => {
      if (goal.kind === 'unknown' || goal.kind === 'noAmbiguity' || goal.kind === 'allowAmbiguity') { res.goals.push({ goal, items: [] }); return; }
      goal.from.forEach(src => {
        const tg = targets(goal, model, src), rch = reach(g, src), am = ambiguity(g, src);
        const items = tg.map(t => {
          const k = low(t), hit = rch.get(k);
          if (goal.kind === 'filters') {
            if (!hit) return { table: t, ok: false, why: whyNot(g, src, t) };
            if (am.has(k)) return { table: t, ok: false, ambiguous: am.get(k) };
            return { table: t, ok: true, path: paths(g, src, t)[0] };
          }
          if (hit) return { table: t, ok: false, path: paths(g, src, t)[0], all: paths(g, src, t) };
          return { table: t, ok: true };
        });
        const notConnected = goal.scope !== 'list' ? model.tables.filter(t => !g.linked.has(low(t)) && low(t) !== low(src)) : [];
        res.goals.push({ goal, src, items, notConnected, skippedDates: goal.scope !== 'list' && !goal.withDates ? model.tables.filter(t => model.dates.has(low(t)) && low(t) !== low(src) && g.linked.has(low(t))) : [] });
      });
    });
    return res;
  }
  // how many goal items fail (for comparing fixes)
  function score(model, goals){
    const e = evaluate(model, goals);
    let bad = 0; e.goals.forEach(x => x.items.forEach(i => { if (!i.ok) bad++; }));
    return { bad, amb: e.ambiguity.length, ev: e };
  }
  // failing goal items as keys, so two versions of the model can be compared item by item
  function failing(ev){
    const out = new Map();
    ev.goals.forEach(x => x.items.forEach(i => { if (!i.ok) out.set(x.goal.n + '|' + low(x.src) + '|' + low(i.table), { line: x.goal.line, src: x.src, table: i.table, kind: x.goal.kind }); }));
    return out;
  }
  // Try each candidate (a full list of changes) and say what it fixes and what it breaks
  // what each table filters, to see what a change takes away
  function reachAll(g){ const out = new Map(); g.model.tables.forEach(t => out.set(low(t), { name: t, set: new Set(reach(g, t).keys()) })); return out; }
  function tryFixes(base, changes, goals, candidates, mustFix){
    const m0 = apply(base, changes), ev0 = evaluate(m0, goals), f0 = failing(ev0), r0 = reachAll(ev0.graph);
    return candidates.map(c => {
      const ev = evaluate(apply(base, c.changes), goals), f1 = failing(ev), r1 = reachAll(ev.graph);
      const fixed = [...f0.keys()].filter(k => !f1.has(k)).map(k => f0.get(k));
      const broke = [...f1.keys()].filter(k => !f0.has(k)).map(k => f1.get(k));
      // tables that stop filtering others (a goal saying they shouldn't is already counted in fixed)
      const lost = [];
      r0.forEach((v, k) => { const after = r1.get(k); const gone = [...v.set].filter(x => !after || !after.set.has(x)); if (gone.length) lost.push({ table: v.name, n: gone.length, tables: gone.map(x => (r0.get(x) || { name: x }).name) }); });
      lost.sort((a, b) => b.n - a.n);
      const lostN = lost.reduce((s, x) => s + x.n, 0);
      return Object.assign({}, c, { fixed, broke, lost, lostN, ambBefore: ev0.ambiguity.length, ambAfter: ev.ambiguity.length, solves: mustFix ? !f1.has(mustFix) : true,
        score: fixed.length - broke.length - lostN / 2 - Math.max(0, ev.ambiguity.length - ev0.ambiguity.length) / 2 });
    }).filter(c => c.solves).sort((a, b) => (b.score - a.score) || (a.ambAfter - b.ambAfter));
  }

  /* ---------- advice for one failing goal item ----------
     base: the model as read; changes: the current what-if list; goals: parsed goals; x: the evaluated goal; item: one table in it.
     Returns { text, fixes: [{ title, changes, fixed, broke, ambBefore, ambAfter }], code: [{ title, dax, note }] } */
  function advise(base, changes, goals, x, item){
    const model = apply(base, changes), g = graph(model), src = x.src, t = item.table;
    const key = x.goal.n + '|' + low(src) + '|' + low(t);
    const out = { text: [], fixes: [], code: [] };
    const cands = [], seen = new Set();
    const addCand = (title, list) => { const k = JSON.stringify(list); if (seen.has(k)) return; seen.add(k); cands.push({ title, changes: list }); };
    const relCands = (rels, mode) => rels.forEach(r => {
      if (r.isNew && r.change != null) addCand('Leave out the new relationship ' + relText(r), changes.filter((c, i) => i !== r.change));
      else if (flowsBoth(r) && r.card !== '1:1') addCand('Set ' + r.toTable + ' – ' + r.fromTable + ' to single direction', changes.concat([{ op: 'dir', key: r.key, both: false }]));
      else if (mode !== 'noOff') addCand('Turn off ' + r.toTable + '[' + r.toColumn + '] – ' + r.fromTable + '[' + r.fromColumn + '] (keep it for USERELATIONSHIP)', changes.concat([{ op: 'active', key: r.key, active: false }]));
    });
    const role = roles(model);
    if (x.goal.kind === 'filters' && item.ambiguous) {
      const ps = item.ambiguous;
      out.text.push('A filter on ' + src + ' has ' + ps.length + ' routes to ' + t + '. Power BI uses only one, so totals can change depending on which. Desktop also refuses to make a new relationship active when it would create a second route.');
      ps.slice(0, 3).forEach(p => out.text.push('Route: ' + pathText(src, p)));
      const onPaths = new Map(); ps.slice(0, 4).forEach(p => p.forEach(s => onPaths.set(s.rel.key, s.rel)));
      relCands([...onPaths.values()]);
    } else if (x.goal.kind === 'filters') {
      const w = item.why;
      // a direct relationship when the target carries the source's key column
      const directCands = () => {
        const srcKeys = new Set(model.rels.filter(r => low(r.toTable) === low(src)).map(r => r.toColumn));
        changes.forEach(c => { if (c.op === 'add' && low(c.one[0]) === low(src)) srcKeys.add(c.one[1]); });
        const tCols = model.cols.get(low(t)) || [];
        // not the target's own key (its one side), and not a name every table has (id, key)
        const ownKeys = new Set(model.rels.filter(r => low(r.toTable) === low(t)).map(r => low(r.toColumn)));
        let n = 0;
        srcKeys.forEach(k => {
          if (/^(id|key|pk|code|name|guid|uid)$/i.test(k)) return;
          const hit = tCols.find(c => low(c) === low(k) && !ownKeys.has(low(c)));
          if (hit) { n++; addCand('Add ' + src + '[' + k + '] \u2192 ' + t + '[' + hit + '] (' + t + ' has a ' + hit + ' column)', changes.concat([{ op: 'add', one: [src, k], many: [t, hit], both: false }])); }
        });
        return n;
      };
      if (w.kind === 'none') {
        out.text.push('No relationship connects ' + src + ' and ' + t + ', not even an inactive one.');
        if (!directCands()) out.text.push('Add a relationship from ' + src + ' to ' + t + ' (or to a table that filters ' + t + ') in Step 3 to test it.');
      } else if (w.kind === 'inactive') {
        out.text.push('Only an inactive relationship connects them: ' + w.rels.map(relText).join(', ') + '. A measure can still use it with USERELATIONSHIP, which is often the right answer for a second date or role.');
        w.rels.forEach(r => { addCand('Turn on ' + relText(r), changes.concat([{ op: 'active', key: r.key, active: true }])); out.code.push({ title: 'Use it in one measure', dax: userelSnippet(r) }); });
        directCands();
      } else {
        const r = w.rel, last = w.at === w.hops.length - 1;
        const there = w.at === 0 ? src : w.hops[w.at - 1].to, next = w.hops[w.at].to;
        out.text.push((low(there) === low(src) ? 'A filter on ' + src + ' can\u2019t go on to ' + next : 'A filter on ' + src + ' reaches ' + there + ', but can\u2019t go on to ' + next) + ': the ' + r.toTable + ' \u2013 ' + r.fromTable + ' relationship ' + relWords(r) + '.');
        out.text.push('Closest connection: ' + [src].concat(w.hops.map(h => h.to)).join(' \u2013 '));
        const direct = directCands();
        if (last) {
          addCand('Set ' + r.toTable + ' \u2013 ' + r.fromTable + ' to both directions', changes.concat([{ op: 'dir', key: r.key, both: true }]));
          const rt = role.get(low(t));
          if (rt === 'lookup' || rt === 'both' || rt === 'bridge') out.code.push({ title: 'Show only the ' + t + ' rows that have data (no relationship change)', dax: hasDataMeasure(t, there), note: 'Add this measure to the filters of the ' + t + ' visual or slicer and set it to 1. A filter on ' + src + ' reaches ' + there + ', so only ' + t + ' rows with matching ' + there + ' rows stay.' });
          out.code.push({ title: 'Or only in the measures that need it', dax: crossfilterSnippet(r), note: 'CROSSFILTER turns on both directions for this one calculation, so the rest of the model keeps its single-direction filters.' });
        } else {
          out.text.push('Getting there would mean going up from ' + there + ' to ' + next + ' and back down: ' + t + ' would be filtered by whichever ' + next + ' rows match ' + src + '\u2019s ' + there + ' rows, which is rarely what you want. ' + (direct ? 'Relate them directly instead.' : 'Relate ' + src + ' to ' + t + ' (or to a table that filters it) directly instead.'));
        }
        const srcAdd = changes.find(c => c.op === 'add' && low(c.one[0]) === low(src));
        const keyCol = srcAdd ? srcAdd.one[1] : null;
        if (keyCol && (model.cols.get(low(t)) || []).some(c => low(c) === low(keyCol))) out.code.push({ title: 'Filter ' + t + ' by its own ' + keyCol + ' (no relationship)', dax: treatasMeasure(t, src, keyCol), note: 'Add it to the filters of a ' + t + ' visual and set it to 1. Use this when a relationship would give a second route.' });
      }
    } else if (x.goal.kind === 'notFilters') {
      out.text.push('A filter on ' + src + ' reaches ' + t + (item.all && item.all.length > 1 ? ' by ' + item.all.length + ' routes' : '') + '.');
      (item.all || [item.path]).slice(0, 3).forEach(p => out.text.push('Route: ' + pathText(src, p)));
      const onPaths = new Map(); (item.all || [item.path]).slice(0, 4).forEach(p => p.forEach(s => onPaths.set(s.rel.key, s.rel)));
      relCands([...onPaths.values()]);
    }
    out.fixes = tryFixes(base, changes, goals, cands, key).slice(0, 4);
    out.tried = cands.length;
    return out;
  }
  // advice for an ambiguity found anywhere in the model (not tied to a goal)
  function adviseAmbiguity(base, changes, goals, amb){
    const cands = [], seen = new Set();
    amb.paths.slice(0, 4).forEach(p => p.forEach(s => {
      const r = s.rel; if (seen.has(r.key)) return; seen.add(r.key);
      if (r.isNew && r.change != null) cands.push({ title: 'Leave out the new relationship ' + relText(r), changes: changes.filter((c, i) => i !== r.change) });
      else if (flowsBoth(r) && r.card !== '1:1') cands.push({ title: 'Set ' + r.toTable + ' – ' + r.fromTable + ' to single direction', changes: changes.concat([{ op: 'dir', key: r.key, both: false }]) });
      else cands.push({ title: 'Turn off ' + r.toTable + '[' + r.toColumn + '] – ' + r.fromTable + '[' + r.fromColumn + ']', changes: changes.concat([{ op: 'active', key: r.key, active: false }]) });
    }));
    const pairGone = c => { const g = graph(apply(base, c.changes)); return !ambiguity(g, amb.from).has(low(amb.to)); };
    return tryFixes(base, changes, goals, cands.filter(pairGone)).slice(0, 4);
  }

  /* ---------- planning a table that many tables will carry a key for (Location, Region...) ---------- */
  function defaultCarriers(model, newTable){
    const g = graph(model), r = roles(model);
    // bridges built in Power Query (named bridge_..., ..._xref) don't carry keys; a source table shaped like a bridge can
    return model.tables.filter(t => low(t) !== low(newTable) && g.linked.has(low(t)) && r.get(low(t)) !== 'date' && !BRIDGE.test(t));
  }
  // tables reached only by going from the one side to the many side (no step back up a both-ways relationship)
  function forwardReach(g, src){
    const out = new Set(), q = [low(src)], seen = new Set(q);
    while (q.length) {
      const cur = q.shift();
      for (const e of g.adj.get(cur) || []) {
        const n = low(e.to); if (seen.has(n)) continue;
        if (low(e.rel.fromTable) !== n && e.rel.card !== '1:1') continue;
        seen.add(n); out.add(n); q.push(n);
      }
    }
    return out;
  }
  function plan(model, newTable, key, carriers, prefer){
    carriers = (carriers && carriers.length ? carriers : defaultCarriers(model, newTable)).filter(t => canon(model, t));
    const want = carriers.slice();
    const spec = t => ({ op: 'add', one: [newTable, key], many: [t, key], both: false });
    let chosen = [], cur = model;
    const rejected = new Map();
    const tryLink = t => { const m = apply(cur, [spec(t)]); const g = graph(m); return { m, g, amb: ambiguity(g, newTable) }; };
    (prefer || []).filter(t => canon(model, t)).forEach(t => {
      if (chosen.includes(t)) return;
      const x = tryLink(t);
      if (x.amb.size) { const [n, ps] = [...x.amb.entries()][0]; rejected.set(low(t), { at: (reach(x.g, newTable).get(n) || {}).name || n, paths: ps.slice(0, 2) }); return; }
      chosen.push(t); cur = x.m;
    });
    for (;;) {
      const g0 = graph(cur), have = chosen.length ? reach(g0, newTable) : new Map();
      let best = null;
      carriers.forEach((t, idx) => {
        if (chosen.includes(t) || have.has(low(t))) return;
        const x = tryLink(t); if (x.amb.size) return;
        const rr = reach(x.g, newTable), fw = forwardReach(x.g, newTable);
        const fresh = w => !have.has(low(w)) && !chosen.includes(w);
        const gain = want.filter(w => (rr.has(low(w)) || low(w) === low(t)) && fresh(w)).length;
        // prefer links whose filter flows the normal way (one side to many side) to each table it reaches
        const fgain = want.filter(w => (fw.has(low(w)) || low(w) === low(t)) && fresh(w)).length;
        const sc = [fgain, gain, -idx];
        const better = (a, b2) => { for (let i = 0; i < a.length; i++) { if (a[i] !== b2[i]) return a[i] > b2[i]; } return false; };
        if (gain && (!best || better(sc, best.sc))) best = { t, sc, m: x.m };
      });
      if (!best) break;
      chosen.push(best.t); cur = best.m;
    }
    const g = graph(cur), rch = chosen.length ? reach(g, newTable) : new Map();
    const rows = carriers.map(t => {
      const k = low(t);
      if (chosen.includes(t)) return { table: t, status: 'link' };
      if (rch.has(k)) { const p = paths(g, newTable, t)[0]; return { table: t, status: 'filtered', path: p, by: p && p[0] ? p[0].to : newTable }; }
      const x = tryLink(t);
      if (x.amb.size) { const [n, ps] = [...x.amb.entries()][0]; return { table: t, status: 'conflict', at: (reach(x.g, newTable).get(n) || {}).name || n, paths: ps.slice(0, 2), preferred: rejected.has(k) }; }
      return { table: t, status: 'unreached' };
    });
    const order = { link: 0, filtered: 1, conflict: 2, unreached: 3 };
    rows.sort((a, b) => order[a.status] - order[b.status] || a.table.localeCompare(b.table));
    return { newTable, key, links: chosen, changes: chosen.map(spec), rows, missed: rows.filter(r => r.status === 'conflict' || r.status === 'unreached').map(r => r.table), total: carriers.length, model: cur };
  }

  /* ---------- DAX for the usual workarounds ---------- */
  const q = n => "'" + n.replace(/'/g, "''") + "'";
  const b = n => '[' + n.replace(/\]/g, ']]') + ']';
  function treatasMeasure(lookup, newTable, key, lookupKey){
    return lookup + ' in selected ' + newTable + ' =\nINT (\n\tNOT ISEMPTY (\n\t\tCALCULATETABLE (\n\t\t\t' + q(lookup) + ',\n\t\t\tTREATAS ( VALUES ( ' + q(newTable) + b(key) + ' ), ' + q(lookup) + b(lookupKey || key) + ' )\n\t\t)\n\t)\n)';
  }
  function hasDataMeasure(lookup, fact){ return lookup + ' has ' + fact + ' rows =\nINT ( NOT ISEMPTY ( ' + q(fact) + ' ) )'; }
  function crossfilterSnippet(r){ return 'CALCULATE (\n\t[Your measure],\n\tCROSSFILTER ( ' + q(r.fromTable) + b(r.fromColumn) + ', ' + q(r.toTable) + b(r.toColumn) + ', BOTH )\n)'; }
  function userelSnippet(r){ return 'CALCULATE (\n\t[Your measure],\n\tUSERELATIONSHIP ( ' + q(r.fromTable) + b(r.fromColumn) + ', ' + q(r.toTable) + b(r.toColumn) + ' )\n)'; }

  // the steps in Power BI Desktop for one change
  function desktopSteps(base, c){
    if (c.op === 'add') {
      const card = c.card === 'M:M' ? 'Many to many (*:*)' : c.card === '1:1' ? 'One to one (1:1)' : 'Many to one (*:1)';
      const isNewTable = !canon(base, c.one[0]);
      return (isNewTable ? 'Add the ' + c.one[0] + ' table (one row per ' + c.one[1] + '), and the ' + c.many[1] + ' column to ' + c.many[0] + ' if it isn’t there yet. ' : '')
        + 'In Model view, select Manage relationships > New: ' + c.many[0] + '[' + c.many[1] + '] to ' + c.one[0] + '[' + c.one[1] + '], cardinality ' + card + ', cross filter direction ' + (c.both ? 'Both' : 'Single') + ', active.';
    }
    const r = base.rels.find(x => x.key === c.key);
    if (!r) return 'This relationship isn’t in the model any more.';
    const name = r.fromTable + '[' + r.fromColumn + '] to ' + r.toTable + '[' + r.toColumn + ']';
    if (c.op === 'dir') return 'In Model view, double-click the ' + name + ' line and set Cross filter direction to ' + (c.both ? 'Both' : 'Single') + '.';
    if (c.op === 'active') return 'In Model view, double-click the ' + name + ' line and ' + (c.active ? 'tick' : 'clear') + ' Make this relationship active.';
    if (c.op === 'remove') return 'In Model view, right-click the ' + name + ' line and select Delete.';
    return '';
  }
  function changeText(base, c){
    if (c.op === 'add') return 'Add ' + c.one[0] + '[' + c.one[1] + ']' + (c.both ? ' ⇄ ' : ' → ') + c.many[0] + '[' + c.many[1] + ']' + (c.both ? ' (both directions)' : '') + (canon(base, c.one[0]) ? '' : ' (new table)');
    const r = base.rels.find(x => x.key === c.key);
    const nm = r ? r.toTable + '[' + r.toColumn + '] – ' + r.fromTable + '[' + r.fromColumn + ']' : '(a relationship no longer in the model)';
    if (c.op === 'dir') return 'Set ' + nm + ' to ' + (c.both ? 'both directions' : 'single direction');
    if (c.op === 'active') return (c.active ? 'Turn on ' : 'Turn off ') + nm;
    if (c.op === 'remove') return 'Remove ' + nm;
    return '';
  }

  return { fromParsed, apply, graph, reach, paths, ambiguity, allAmbiguity, roles, facts, ROLE_WORD, whyNot, parseGoals, targets, evaluate, score, tryFixes, failing, advise, adviseAmbiguity,
    plan, defaultCarriers, pathText, relText, relWords, flowsBoth, treatasMeasure, hasDataMeasure, crossfilterSnippet, userelSnippet, desktopSteps, changeText, canon, relKey, mentions };
})();
