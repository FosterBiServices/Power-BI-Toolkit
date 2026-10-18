/* ---------- Sample Data Maker: masking ----------
   A table is { id, file, sheet, headers: [...], rows: [[cell, ...], ...] }, where a cell is
   { k: 'num'|'date'|'tdate'|'text'|'bool'|'empty', v, z } (z: the Excel number format; tdate: a date
   written as text, with its pattern in p). Columns that are linked share one set of fake values, so
   keys still match after masking. Names, companies, emails, phones, cities and addresses use one set
   of fake values across every table, so the same original always gets the same fake value. */
const SDM = (() => {
  const L = SD.LISTS;
  const STREETS = ['Maple', 'Oak', 'Cedar', 'Elm', 'Pine', 'Lake', 'Hill', 'Park', 'River', 'Church', 'Mill', 'Spring', 'Ridge', 'Meadow', 'Forest', 'Sunset', 'Highland', 'Willow', 'Valley', 'Main'];
  const STREET_END = ['Street', 'Avenue', 'Road', 'Lane', 'Drive', 'Court', 'Way', 'Place'];
  const TREATS = [
    ['keep', 'Keep as is'], ['id', 'Fake ID (same shape)'], ['person', 'Person name'], ['company', 'Company name'], ['email', 'Email'], ['phone', 'Phone'],
    ['city', 'City'], ['address', 'Street address'], ['label', 'Numbered labels'], ['scale', 'Scale numbers'], ['date', 'Shift dates'], ['blank', 'Blank it out']];
  const TREAT_NAME = Object.fromEntries(TREATS);

  /* seeded hashing and random numbers */
  function hash(str){ let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function rng(str){ let a = hash(str) || 1; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const pickOf = (r, list) => list[Math.floor(r() * list.length)];

  /* reading cell values */
  const keyOf = c => c.k === 'empty' ? '' : c.k === 'text' ? String(c.v).trim().toLowerCase() : String(c.v);
  const textOf = c => c.k === 'empty' ? '' : c.k === 'tdate' || c.k === 'text' ? String(c.v) : c.k === 'date' ? SD.ymd(c.v).join('-') : String(c.v);
  const NUM_RE = /^\s*-?(\d{1,3}(,\d{3})+|\d+)?(\.\d+)?\s*$/;
  // a date written as text: 2024-01-15, 2024/01/15 10:30, 1/15/2024, 15.01.2024
  const TD_RE = /^\s*(\d{1,4})([-/.])(\d{1,2})\2(\d{1,4})((?:[ T]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:\s?[AaPp][Mm])?)?(?:Z|[+-]\d{2}:?\d{2})?)\s*$/;
  function parseTextDate(s, order){
    const m = TD_RE.exec(s); if (!m) return null;
    let y, mo, d, ord;
    if (m[1].length === 4) { ord = 'ymd'; y = +m[1]; mo = +m[3]; d = +m[4]; }
    else if (m[4].length === 4 || m[4].length === 2) { ord = order || (+m[1] > 12 ? 'dmy' : 'mdy'); y = +m[4]; if (m[4].length === 2) y += y < 50 ? 2000 : 1900; if (ord === 'dmy') { d = +m[1]; mo = +m[3]; } else { mo = +m[1]; d = +m[3]; } }
    else return null;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return { v: SD.serial(y, mo, d), p: { ord, sep: m[2], w: [m[1].length, m[3].length, m[4].length], time: m[5] || '' } };
  }
  function formatTextDate(v, p){
    const [y, mo, d] = SD.ymd(v), pad = (n, w) => String(n).padStart(w, '0');
    const parts = p.ord === 'ymd' ? [pad(y, 4), pad(mo, p.w[1]), pad(d, p.w[2])] : p.ord === 'dmy' ? [pad(d, p.w[0]), pad(mo, p.w[1]), p.w[2] === 2 ? pad(y % 100, 2) : pad(y, 4)] : [pad(mo, p.w[0]), pad(d, p.w[1]), p.w[2] === 2 ? pad(y % 100, 2) : pad(y, 4)];
    return parts.join(p.sep) + p.time;
  }
  // text from a CSV becomes a number or a date when it clearly is one
  function fromText(s, csv){
    if (s === null || s === undefined || String(s).trim() === '') return { k: 'empty' };
    s = String(s);
    if (!csv) return { k: 'text', v: s };
    const t = s.trim();
    if (NUM_RE.test(t) && /\d/.test(t) && !(/^-?0\d/.test(t))) return { k: 'num', v: +t.replace(/,/g, '') };
    if (/^(true|false)$/i.test(t)) return { k: 'bool', v: /^true$/i.test(t) };
    const d = parseTextDate(t); if (d) return { k: 'tdate', v: d.v, p: d.p, raw: s };
    return { k: 'text', v: s };
  }
  // CSV dates: decide day/month order from the whole column (any first part over 12 means day first)
  function fixDateOrder(table){
    table.headers.forEach((h, c) => {
      const cells = table.rows.map(r => r[c]).filter(x => x && x.k === 'tdate' && x.p.ord !== 'ymd');
      if (!cells.length) return;
      const dmy = cells.some(x => +TD_RE.exec(x.raw)[1] > 12) && !cells.some(x => +TD_RE.exec(x.raw)[3] > 12);
      cells.forEach(x => { const d = parseTextDate(x.raw, dmy ? 'dmy' : 'mdy'); if (d) { x.v = d.v; x.p = d.p; } else Object.assign(x, { k: 'text', v: x.raw }); });
    });
  }

  /* ---------- what each column holds ---------- */
  const IDH1 = /(^|[\s_\-.])(id|key|code|no|num|number|nbr|ref|sku|#)$|^(id|key|code|sku)([\s_\-.]|$)/i, IDH2 = /[a-z](ID|Id|Key|Code|No|Number)$/;
  const IDH = { test: h => IDH1.test(h) || IDH2.test(h) };
  const PERSONH = /\b(name|first|last|surname|customer|employee|emp|contact|person|rep|manager|agent|patient|owner|user|staff|buyer|seller|provider|doctor|physician|member|student|teacher|driver|salesperson|supervisor|approver|requester|assignee)\b/i;
  const COMPANYH = /\b(company|vendor|supplier|client|account|business|organi[sz]ation|employer|partner|firm|carrier|distributor|dealer|merchant|payer|insurer|bank)\b/i;
  const COMPANYV = /\b(inc|llc|ltd|limited|corp|corporation|co|company|group|gmbh|plc|bv|ag|partners|holdings|industries|services|solutions|systems|enterprises|associates)\b\.?$/i;
  const PERSONV = /^[A-Z][a-z'\-]+(\s[A-Z]\.?)?(\s[A-Z][a-z'\-]+){1,2}$|^[A-Z][a-z'\-]+,\s?[A-Z][a-z'\-]+$/;
  const KEEPH = /^(year|month|quarter|week|day|fy|fiscal|period|qtr|yr|mth|hour|age)\b/i;
  function profile(table, c){
    const cells = table.rows.map(r => r[c] || { k: 'empty' }), filled = cells.filter(x => x.k !== 'empty');
    const n = filled.length, by = k => filled.filter(x => x.k === k).length;
    const distinct = new Set(filled.map(keyOf)).size;
    const texts = filled.filter(x => x.k === 'text').map(x => String(x.v).trim());
    return { n, distinct, ratio: n ? distinct / n : 0, num: by('num'), date: by('date') + by('tdate'), bool: by('bool'), text: texts.length, texts,
      ints: filled.every(x => x.k !== 'num' || Number.isInteger(x.v)) };
  }
  function detect(table, c){
    const h = String(table.headers[c] || '').trim(), p = profile(table, c), share = x => p.n ? x / p.n : 0;
    if (!p.n) return 'keep';
    if (share(p.date) >= 0.8) return 'date';
    if (share(p.bool) >= 0.8) return 'keep';
    if (share(p.num) >= 0.8) {
      if (KEEPH.test(h)) return 'keep';
      if (IDH.test(h)) return 'id';
      return 'scale';
    }
    const t = p.texts, tshare = x => t.length ? t.filter(x).length / t.length : 0;
    if (/e-?mail/i.test(h) || tshare(v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) >= 0.6) return 'email';
    if (/phone|mobile|tel\b|telephone|fax|cell/i.test(h)) return 'phone';
    if (/address|street|addr\b/i.test(h)) return 'address';
    if (/\b(city|town)\b/i.test(h)) return 'city';
    if (tshare(v => COMPANYV.test(v)) >= 0.3 || (COMPANYH.test(h) && tshare(v => PERSONV.test(v)) < 0.6)) return 'company';
    if (PERSONH.test(h) && tshare(v => PERSONV.test(v)) >= 0.5) return 'person';
    if (IDH.test(h)) return 'id';
    if (tshare(v => /^[A-Za-z]{0,6}[-_ ]?\d{2,}[A-Za-z0-9\-_]*$/.test(v)) >= 0.8) return 'id';
    if (p.distinct <= 25 || p.ratio <= 0.2) return 'keep';
    return 'label';
  }
  const normHead = h => String(h).toLowerCase().replace(/[^a-z0-9]/g, '');
  /* links between tables: columns in different tables whose values match */
  function suggestLinks(tables, treats){
    const cols = [];
    tables.forEach(t => t.headers.forEach((h, c) => {
      const tr = treats[t.id][c];
      if (['date', 'blank', 'email', 'phone', 'address'].includes(tr)) return;
      const p = profile(t, c); if (p.distinct < 2) return;
      if (tr === 'scale' && !(p.ints)) return;
      const set = new Set(t.rows.map(r => r[c]).filter(x => x && x.k !== 'empty').map(keyOf));
      cols.push({ t: t.id, c, h: normHead(h).replace(/(id|key|code|no|number|name)$/, '') || normHead(h), set, uniq: p.ratio >= 0.95, tr });
    }));
    const out = [];
    for (let i = 0; i < cols.length; i++) for (let j = i + 1; j < cols.length; j++) {
      const a = cols[i], b = cols[j];
      // in one table, only a key and a column that points back at it (Manager ID and Employee ID)
      if (a.t === b.t && !((a.uniq || b.uniq) && a.tr !== 'keep' && b.tr !== 'keep')) continue;
      if (a.tr === 'keep' && b.tr === 'keep') continue;
      const [sm, lg] = a.set.size <= b.set.size ? [a, b] : [b, a];
      let hit = 0; sm.set.forEach(v => { if (lg.set.has(v)) hit++; });
      const score = hit / sm.set.size, same = a.h === b.h;
      const numeric = a.tr === 'scale' || b.tr === 'scale';
      const ok = numeric ? score >= 0.9 && (a.uniq || b.uniq) && sm.set.size >= 0.2 * lg.set.size && sm.set.size >= 10
        : (score >= 0.6 && (a.uniq || b.uniq || same)) || (same && score >= 0.3);
      if (ok && a.t === b.t && score < 0.8) continue;
      if (ok && hit >= 2) out.push({ a: [a.t, a.c], b: [b.t, b.c], score, same });
    }
    return out.sort((x, y) => y.score - x.score);
  }

  /* ---------- groups: linked columns share their fake values ---------- */
  function groups(tables, links){
    const parent = {}, idOf = (t, c) => t + ':' + c;
    const find = x => { while (parent[x] !== undefined && parent[x] !== x) x = parent[x]; return x; };
    tables.forEach(t => t.headers.forEach((h, c) => { parent[idOf(t.id, c)] = idOf(t.id, c); }));
    links.forEach(l => { const a = find(idOf(...l.a)), b = find(idOf(...l.b)); if (a !== b) parent[b] = a; });
    const g = {}; Object.keys(parent).forEach(x => { g[x] = find(x); });
    return g;
  }

  /* ---------- fake values ---------- */
  function makeFaker(seed){
    const seen = {}, used = {};
    const once = (kind, key, make) => {
      const m = seen[kind] = seen[kind] || new Map(); if (m.has(key)) return m.get(key);
      const u = used[kind] = used[kind] || new Set();
      let v, i = 0; do { v = make(rng(seed + '|' + kind + '|' + key + '|' + i), i); i++; } while (u.has(String(v).toLowerCase()) && i < 400);
      u.add(String(v).toLowerCase()); m.set(key, v); return v;
    };
    const caseLike = (orig, v) => orig === orig.toUpperCase() && /[A-Z]/.test(orig) ? v.toUpperCase() : orig === orig.toLowerCase() && /[a-z]/.test(orig) ? v.toLowerCase() : v;
    const F = {};
    F.person = orig => once('person', orig.trim().toLowerCase(), (r, i) => {
      const f = pickOf(r, L.FirstName), l = pickOf(r, L.LastName), mid = i > 60 ? ' ' + String.fromCharCode(65 + Math.floor(r() * 26)) + '.' : '';
      const s = orig.trim();
      const v = /,/.test(s) ? l + ', ' + f + mid : !/\s/.test(s) ? f + (i > 60 ? ' ' + l : '') : f + mid + ' ' + l;
      return caseLike(s, v);
    });
    F.company = orig => once('company', orig.trim().toLowerCase(), (r, i) => caseLike(orig.trim(), pickOf(r, L.CompanyA) + ' ' + pickOf(r, L.CompanyB) + ' ' + pickOf(r, L.CompanyC) + (i > 100 ? ' ' + (i - 99) : '')));
    F.email = (orig, person) => once('email', orig.trim().toLowerCase(), (r, i) => {
      const base = person ? person.toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/).filter(Boolean).join('.') : 'user' + String(Math.floor(r() * 90000) + 10000);
      return base + (i ? i + 1 : '') + '@example.com';
    });
    F.phone = orig => once('phone', orig.trim(), r => { let lead = (/^\s*\+\d{1,3}/.exec(orig) || [''])[0]; return lead + orig.slice(lead.length).replace(/\d/g, () => String(Math.floor(r() * 10))); });
    F.city = orig => once('city', orig.trim().toLowerCase(), (r, i) => caseLike(orig.trim(), pickOf(r, L.City) + (i > 40 ? ' ' + (Math.floor(i / 10)) : '')));
    F.address = orig => once('address', orig.trim().toLowerCase(), r => (100 + Math.floor(r() * 9900)) + ' ' + pickOf(r, STREETS) + ' ' + pickOf(r, STREET_END));
    F.id = (group, cell, prefix) => once('id:' + group, keyOf(cell), (r, i) => {
      if (cell.k === 'num' && Number.isInteger(cell.v)) {
        const digits = Math.max(1, String(Math.abs(cell.v)).length) + (i > 200 ? 1 : 0), lo = digits === 1 ? 1 : Math.pow(10, digits - 1);
        return (cell.v < 0 ? -1 : 1) * (lo + Math.floor(r() * (Math.pow(10, digits) - lo)));
      }
      const s = textOf(cell), keep = prefix && s.toLowerCase().startsWith(prefix.toLowerCase()) ? s.slice(0, prefix.length) : '';
      let body = s.slice(keep.length).replace(/[0-9]/g, () => String(Math.floor(r() * 10))).replace(/[a-z]/g, () => String.fromCharCode(97 + Math.floor(r() * 26))).replace(/[A-Z]/g, () => String.fromCharCode(65 + Math.floor(r() * 26)));
      if (i > 200) body += String(i);
      return keep + body;
    });
    F.label = (group, cell, head, order) => once('label:' + group, keyOf(cell), () => head + ' ' + order(keyOf(cell)));
    return F;
  }
  // the longest start every text value in a group shares, up to its last letter or separator (CUST- in CUST-0012)
  function sharedPrefix(values){
    const t = values.filter(v => typeof v === 'string'); if (t.length < 2 || t.length < values.length) return '';
    let p = t[0]; t.forEach(v => { let i = 0; while (i < p.length && i < v.length && p[i].toLowerCase() === v[i].toLowerCase()) i++; p = p.slice(0, i); });
    const m = /^[^0-9]*[^A-Za-z0-9]|^[A-Za-z]+(?=\d)/.exec(p); return m ? m[0] : /^[A-Za-z]+$/.test(p) && t.every(v => /\d/.test(v.slice(p.length))) ? p : '';
  }

  /* ---------- masking ---------- */
  // settings: { seed, treats: { tableId: [treat per column] }, links: [{a:[t,c], b:[t,c]}] }
  function dateShift(seed){ const r = rng(seed + '|dates'); const w = 1 + Math.floor(r() * 8); return (r() < 0.5 ? -1 : 1) * w * 7; }
  function run(tables, settings){
    const seed = String(settings.seed), F = makeFaker(seed), g = groups(tables, settings.links || []);
    const shift = dateShift(seed);
    // the treatment of a group is the first one in it that changes anything
    const gTreat = {};
    tables.forEach(t => t.headers.forEach((h, c) => { const id = g[t.id + ':' + c], tr = settings.treats[t.id][c]; if (!gTreat[id] || (gTreat[id] === 'keep' && tr !== 'keep')) gTreat[id] = tr; }));
    // group facts: shared prefix for IDs, order of first appearance and a header for labels
    const gVals = {}, gHead = {};
    tables.forEach(t => t.headers.forEach((h, c) => { const id = g[t.id + ':' + c]; if (!gHead[id]) gHead[id] = String(h || 'Item').replace(/[\s_\-]*(id|key|code|name|no)$/i, '').trim() || String(h); const arr = gVals[id] = gVals[id] || []; t.rows.forEach(r => { const x = r[c]; if (x && x.k !== 'empty') arr.push(x); }); }));
    const gPrefix = {}, gOrder = {};
    Object.keys(gVals).forEach(id => {
      if (gTreat[id] === 'id') gPrefix[id] = sharedPrefix(gVals[id].map(x => x.k === 'num' ? null : textOf(x)).filter(x => x !== null).concat(gVals[id].some(x => x.k === 'num') ? [0] : []));
      if (gTreat[id] === 'label') { const o = new Map(); gVals[id].forEach(x => { const k = keyOf(x); if (!o.has(k)) o.set(k, o.size + 1); }); gOrder[id] = k => o.get(k); }
    });
    const out = tables.map(t => {
      const tr = t.headers.map((h, c) => gTreat[g[t.id + ':' + c]]);
      // scale: one hidden factor per column (or per group), a little noise per value, the same decimals
      const fac = t.headers.map((h, c) => { const r = rng(seed + '|scale|' + g[t.id + ':' + c]); let f = 0.55 + r() * 1.25; if (Math.abs(f - 1) < 0.06) f += 0.12; return f; });
      const dec = t.headers.map((h, c) => { let d = 0; t.rows.forEach(r => { const x = r[c]; if (x && x.k === 'num' && !Number.isInteger(x.v)) { const s = String(x.v).split('.')[1] || ''; d = Math.max(d, Math.min(4, s.length)); } }); return d; });
      const personCol = tr.indexOf('person');
      const rows = t.rows.map((row, ri) => {
        const fakePerson = personCol >= 0 && row[personCol] && row[personCol].k === 'text' ? F.person(String(row[personCol].v)) : null;
        return t.headers.map((h, c) => {
          const x = row[c] || { k: 'empty' }, id = g[t.id + ':' + c];
          if (x.k === 'empty') return x;
          switch (tr[c]) {
            case 'keep': return x;
            case 'blank': return { k: 'empty' };
            case 'date': return x.k === 'date' ? { k: 'date', v: x.v + shift, z: x.z } : x.k === 'tdate' ? { k: 'tdate', v: x.v + shift, p: x.p } : x;
            case 'scale': {
              if (x.k !== 'num') return x;
              const r = rng(seed + '|noise|' + t.id + '|' + ri + '|' + c), m = Math.pow(10, dec[c]);
              const v = Math.round(x.v * fac[c] * (1 + (r() - 0.5) * 0.06) * m) / m;
              return { k: 'num', v: Object.is(v, -0) ? 0 : v, z: x.z };
            }
            case 'id': { const v = F.id(id, x, gPrefix[id]); return typeof v === 'number' ? { k: 'num', v, z: x.z } : { k: 'text', v }; }
            case 'label': return { k: 'text', v: F.label(id, x, gHead[id], gOrder[id]) };
            case 'person': return { k: 'text', v: F.person(textOf(x)) };
            case 'company': return { k: 'text', v: F.company(textOf(x)) };
            case 'email': return { k: 'text', v: F.email(textOf(x), fakePerson) };
            case 'phone': return { k: 'text', v: F.phone(textOf(x)) };
            case 'city': return { k: 'text', v: F.city(textOf(x)) };
            case 'address': return { k: 'text', v: F.address(textOf(x)) };
            default: return x;
          }
        });
      });
      return Object.assign({}, t, { rows });
    });
    return { tables: out, shift, treat: gTreat, groups: g };
  }
  // what a cell shows in the preview
  function show(x){
    if (!x || x.k === 'empty') return '';
    if (x.k === 'date') { const [y, m, d] = SD.ymd(Math.floor(x.v)); return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }
    if (x.k === 'tdate') return formatTextDate(x.v, x.p);
    if (x.k === 'bool') return x.v ? 'TRUE' : 'FALSE';
    if (x.k === 'num') return x.v.toLocaleString(undefined, { maximumFractionDigits: 4 });
    return String(x.v);
  }
  return { TREATS, TREAT_NAME, fromText, fixDateOrder, detect, profile, suggestLinks, groups, run, show, formatTextDate, parseTextDate, hash, rng, keyOf };
})();
