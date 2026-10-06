
/* ---------- Layout Designer: background and wireframe (SVG) ---------- */
const LR = (() => {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const idName = s => String(s || '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'item';
  const f = v => Math.round(v * 100) / 100;
  // a small seeded random so sketches don't change on every redraw
  const rnd = seed => { let s = 0; for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 8) / 16777216; }; };

  /* Drop shadow like Figma's: x, y, blur, spread, color, opacity (%) */
  const SH_DEFAULT = { x: 0, y: 4, blur: 16, spread: 0, color: '#1F3A5F', opacity: 35 };
  function shadowOf(st){ return Object.assign({}, SH_DEFAULT, st.sh || {}); }
  function shadowDefs(st){
    if (!st.shadow) return '';
    const s = shadowOf(st), sp = Math.max(0, +s.spread || 0);
    return '<defs><filter id="lo-shadow" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">'
      + (sp ? '<feMorphology in="SourceAlpha" operator="dilate" radius="' + sp + '" result="sp"/>' : '')
      + '<feOffset in="' + (sp ? 'sp' : 'SourceAlpha') + '" dx="' + (+s.x || 0) + '" dy="' + (+s.y || 0) + '" result="off"/>'
      + '<feGaussianBlur in="off" stdDeviation="' + Math.max(0, (+s.blur || 0) / 2) + '" result="blur"/>'
      + '<feFlood flood-color="' + (s.color || '#000000') + '" flood-opacity="' + Math.max(0, Math.min(100, +s.opacity || 0)) / 100 + '"/>'
      + '<feComposite in2="blur" operator="in" result="shadow"/><feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
  }

  /* Header image (Colored band or Full-width bar): { src, w, h } with the image's own size */
  function headerImage(st){
    const i = st.hdrImg;
    return (st.header === 'band' || st.header === 'bleed') && i && i.src && i.w > 0 && i.h > 0 ? i : null;
  }

  /* ----- the page background: page fill, header, side panel, a card behind each visual ----- */
  function background(L, c, col, st, opts){
    opts = opts || {};
    const W = c.w, H = c.h, r = +st.radius || 0, out = [];
    const defs = shadowDefs(st);
    const rect = (id, x, y, w, h, fill, extra) => '<rect id="' + id + '" x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '"' + (r && !(extra || '').includes('rx=') ? ' rx="' + r + '"' : '') + ' fill="' + fill + '"' + (extra || '') + '/>';
    out.push('<rect id="Page" x="0" y="0" width="' + W + '" height="' + H + '" fill="' + col.page + '"/>');
    if (opts.afterPage) out.push(opts.afterPage);
    const border = st.border ? ' stroke="' + col.border + '" stroke-width="1"' : '';
    const sh = st.shadow ? ' filter="url(#lo-shadow)"' : '';
    const hdr = L.items.find(o => o.id === 'header');
    if (hdr && st.header !== 'none') {
      // a header image fills the band like Figma's image fill (cover), as a pattern Figma reads back as an image fill
      const img = headerImage(st), box = st.header === 'bleed' ? [0, 0, W, hdr.y + hdr.h] : [hdr.x, hdr.y, hdr.w, hdr.h];
      const fill = img ? 'url(#lo-header-fill)' : col.header;
      let defs2 = '';
      if (img) {
        const [, , bw, bh] = box, k = Math.max(bw / img.w, bh / img.h), ox = (bw - k * img.w) / 2, oy = (bh - k * img.h) / 2;
        defs2 = '<defs><pattern id="lo-header-fill" patternContentUnits="objectBoundingBox" width="1" height="1"><use xlink:href="#lo-header-image" transform="matrix(' + [k / bw, 0, 0, k / bh, ox / bw, oy / bh].map(v => +v.toFixed(6)).join(' ') + ')"/></pattern>'
          + '<image id="lo-header-image" width="' + img.w + '" height="' + img.h + '" preserveAspectRatio="none" xlink:href="' + img.src + '"/></defs>';
      }
      if (defs2) out.push(defs2);
      if (st.header === 'bleed') out.push(rect('Header', box[0], box[1], box[2], box[3], fill, ' rx="0"'));
      else if (st.header === 'line') out.push(rect('Header-line', hdr.x, hdr.y + hdr.h - 3, hdr.w, 3, col.accent, ' rx="1.5"'));
      else out.push(rect('Header', box[0], box[1], box[2], box[3], fill, sh));
    }
    const logo = L.items.find(o => o.id === 'logo');
    if (logo && logo.src && c.header.logo && c.header.logo.inBg) out.push('<image id="Logo" xlink:href="' + logo.src + '" x="' + f(logo.x) + '" y="' + f(logo.y) + '" width="' + f(logo.w) + '" height="' + f(logo.h) + '" preserveAspectRatio="xMidYMid meet"/>');
    const side = L.items.find(o => o.id === 'side');
    if (side && st.side !== 'none') out.push(rect('Side-panel', side.x, side.y, side.w, side.h, col.sidePanel, sh + border));
    if (st.cards !== 'none') {
      const g = ['<g id="Visual-cards">'];
      L.items.filter(o => !o.band && (o.region !== 'header' || o.type === 'card') && (o.region !== 'side' || st.side === 'none')).forEach(o => g.push(rect('Card-' + idName(o.title || LO.typeOf(o.type).label), o.x, o.y, o.w, o.h, col.card, sh + border)));
      // cells with no visual still get a (blank) container, so the page keeps its rhythm
      (L.empty || []).forEach(([a, b]) => { const G = L.grid; g.push(rect('Card-empty-' + (a + 1) + '-' + (b + 1), G.x[a], G.y[b], G.w[a], G.h[b], col.card, sh + border)); });
      g.push('</g>'); out.push(g.join(''));
    }
    if (opts.inner) return defs + out.join('');
    return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' + defs + out.join('') + '</svg>';
  }

  /* ----- a sketch of each visual type inside its box ----- */
  function sketch(o, col, font){
    const pad = Math.min(12, o.w * 0.06, o.h * 0.08), titleH = o.h > 70 && o.title && !['card', 'kpi', 'slicer', 'text', 'button', 'image'].includes(LO.typeOf(o.type).kind) ? 22 : 0;
    const x = o.x + pad, y = o.y + pad + titleH, w = Math.max(4, o.w - 2 * pad), h = Math.max(4, o.h - 2 * pad - titleH);
    const d = col.data, R = rnd(o.id + o.type), s = [];
    const t = (tx, ty, txt, size, fill, anchor, weight) => '<text x="' + f(tx) + '" y="' + f(ty) + '" font-size="' + size + '" fill="' + fill + '" font-family="' + font + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + (weight ? ' font-weight="' + weight + '"' : '') + '>' + esc(txt) + '</text>';
    if (titleH) s.push(t(o.x + pad, o.y + pad + 13, o.title, 12, col.text, '', 600));
    const kind = LO.typeOf(o.type).kind;
    const axis = () => s.push('<line x1="' + f(x) + '" x2="' + f(x + w) + '" y1="' + f(y + h) + '" y2="' + f(y + h) + '" stroke="' + col.muted + '" stroke-width="1" opacity=".5"/>');
    if (kind === 'card' && o.h < 56) {
      // compact card (header): label on the left, value on the right, on its own tile
      s.push('<rect x="' + f(o.x) + '" y="' + f(o.y) + '" width="' + f(o.w) + '" height="' + f(o.h) + '" rx="' + Math.min(6, o.h / 3) + '" fill="' + col.card + '"/>');
      const vs = Math.min(18, Math.max(10, o.h * 0.5));
      s.push(t(o.x + 10, o.y + o.h / 2 + 4, o.title || 'Measure', Math.min(11, o.h * 0.34), col.muted), t(o.x + o.w - 10, o.y + o.h / 2 + vs * 0.35, ['$4.2M', '18.9K', '38.2%', '2,418', '$221', '94.1%'][(o.idx || 0) % 6], vs, d[0], 'end', 700));
    } else if (kind === 'card') {
      const big = Math.max(12, Math.min(34, h * 0.42, w / 5));
      s.push(t(o.x + o.w / 2, o.y + o.h / 2 + big * 0.2, ['$4.2M', '18.9K', '38.2%', '2,418', '$221', '94.1%'][((o.idx || 0) + (o.region === 'strip' ? 0 : 3)) % 6], big, d[0], 'middle', 700));
      s.push(t(o.x + o.w / 2, o.y + o.h / 2 + big * 0.2 + 18, o.title || 'Measure', 11, col.muted, 'middle'));
    } else if (kind === 'kpi') {
      const big = Math.max(12, Math.min(30, h * 0.36));
      s.push(t(o.x + o.w / 2, o.y + o.h * 0.42, '$4.2M', big, d[0], 'middle', 700));
      s.push(t(o.x + o.w / 2, o.y + o.h * 0.42 + 15, 'Goal: $4.0M (+5.0%)', 10, col.good, 'middle'));
      let p = ''; for (let i = 0; i < 12; i++) p += f(x + i * w / 11) + ',' + f(y + h - 4 - (0.3 + 0.6 * i / 11 + R() * 0.1) * Math.min(h * 0.28, 26)) + ' ';
      s.push('<polyline points="' + p + '" fill="none" stroke="' + d[0] + '" stroke-width="1.5" opacity=".6"/>');
    } else if (kind === 'multicard') {
      const n = Math.max(1, Math.min(4, Math.floor(h / 34))); for (let i = 0; i < n; i++) { const yy = y + i * h / n; s.push(t(x, yy + 16, ['$4.2M', '18.9K', '38.2%', '2,418'][i], 15, d[0], '', 700), t(x, yy + 29, ['Sales', 'Orders', 'Margin', 'Customers'][i], 10, col.muted)); }
    } else if (['column', 'stackcol', 'combo', 'waterfall'].includes(kind)) {
      const n = Math.max(3, Math.min(12, Math.floor(w / 26))), bw = w / n * 0.62; let run = h * 0.35;
      for (let i = 0; i < n; i++) {
        const bx = x + i * w / n + (w / n - bw) / 2;
        if (kind === 'waterfall') { const up = i === 0 || i === n - 1 || R() > 0.35, v = (0.08 + R() * 0.18) * h; const top = i === 0 ? h * 0.4 : i === n - 1 ? run : up ? run + v : run; const hh = i === 0 || i === n - 1 ? top : v; s.push('<rect x="' + f(bx) + '" y="' + f(y + h - top) + '" width="' + f(bw) + '" height="' + f(Math.max(2, hh)) + '" fill="' + (i === 0 || i === n - 1 ? d[0] : up ? col.good : col.bad) + '" rx="1"/>'); run = i === 0 ? h * 0.4 : up ? run + v : Math.max(4, run - v); if (run > h * 0.95) run = h * 0.6; continue; }
        const v = (0.3 + R() * 0.65) * h;
        if (kind === 'stackcol') { const a = v * (0.4 + R() * 0.3); s.push('<rect x="' + f(bx) + '" y="' + f(y + h - a) + '" width="' + f(bw) + '" height="' + f(a) + '" fill="' + d[0] + '"/><rect x="' + f(bx) + '" y="' + f(y + h - v) + '" width="' + f(bw) + '" height="' + f(v - a) + '" fill="' + d[1 % d.length] + '"/>'); }
        else s.push('<rect x="' + f(bx) + '" y="' + f(y + h - v) + '" width="' + f(bw) + '" height="' + f(v) + '" fill="' + d[0] + '" rx="1"/>');
      }
      if (kind === 'combo') { let p = ''; for (let i = 0; i < n; i++) p += f(x + (i + 0.5) * w / n) + ',' + f(y + h * (0.15 + R() * 0.3)) + ' '; s.push('<polyline points="' + p + '" fill="none" stroke="' + d[1 % d.length] + '" stroke-width="2"/>'); }
      axis();
    } else if (kind === 'bar' || kind === 'stackbar') {
      const n = Math.max(3, Math.min(10, Math.floor(h / 20))), bh = h / n * 0.62, lw = Math.min(70, w * 0.25);
      for (let i = 0; i < n; i++) { const by = y + i * h / n + (h / n - bh) / 2, v = (0.95 - i * 0.6 / n - R() * 0.1) * (w - lw); s.push('<rect x="' + f(x + lw * 0.15) + '" y="' + f(by + bh * 0.25) + '" width="' + f(lw * 0.7) + '" height="' + f(bh * 0.5) + '" fill="' + col.muted + '" opacity=".35" rx="2"/>');
        if (kind === 'stackbar') { const a = v * 0.55; s.push('<rect x="' + f(x + lw) + '" y="' + f(by) + '" width="' + f(a) + '" height="' + f(bh) + '" fill="' + d[0] + '"/><rect x="' + f(x + lw + a) + '" y="' + f(by) + '" width="' + f(v - a) + '" height="' + f(bh) + '" fill="' + d[1 % d.length] + '"/>'); }
        else s.push('<rect x="' + f(x + lw) + '" y="' + f(by) + '" width="' + f(Math.max(4, v)) + '" height="' + f(bh) + '" fill="' + d[0] + '" rx="1"/>'); }
    } else if (kind === 'line' || kind === 'area') {
      const n = 12;
      [0, 1].forEach(k => { let p = [], v = 0.35 + R() * 0.2; for (let i = 0; i < n; i++) { v = Math.min(0.95, Math.max(0.08, v + (R() - 0.42) * 0.18)); p.push([x + i * w / (n - 1), y + h - (k ? v * 0.6 : v) * h]); }
        const pts = p.map(q => f(q[0]) + ',' + f(q[1])).join(' ');
        if (kind === 'area' && !k) s.push('<polygon points="' + f(x) + ',' + f(y + h) + ' ' + pts + ' ' + f(x + w) + ',' + f(y + h) + '" fill="' + d[0] + '" opacity=".25"/>');
        s.push('<polyline points="' + pts + '" fill="none" stroke="' + d[k % d.length] + '" stroke-width="' + (k ? 1.6 : 2.2) + '" stroke-linejoin="round"/>'); });
      axis();
    } else if (kind === 'scatter') {
      for (let i = 0; i < 26; i++) { const a = R(), b = Math.min(1, Math.max(0, a * 0.8 + (R() - 0.5) * 0.35)); s.push('<circle cx="' + f(x + a * w) + '" cy="' + f(y + h - b * h) + '" r="' + f(2 + R() * 4) + '" fill="' + d[i % 3 % d.length] + '" opacity=".75"/>'); }
      axis();
    } else if (kind === 'pie' || kind === 'donut') {
      const rr = Math.min(w * 0.5, h) / 2 * 0.95, cx = x + Math.min(w * 0.3, rr + 4), cy = y + h / 2, parts = [34, 24, 17, 13, 12]; let a0 = -Math.PI / 2;
      parts.forEach((p, i) => { const a1 = a0 + p / 100 * Math.PI * 2, lg = a1 - a0 > Math.PI ? 1 : 0, ri = kind === 'donut' ? rr * 0.58 : 0;
        const P = (r, a) => f(cx + r * Math.cos(a)) + ' ' + f(cy + r * Math.sin(a));
        s.push('<path d="M' + P(rr, a0) + ' A' + f(rr) + ' ' + f(rr) + ' 0 ' + lg + ' 1 ' + P(rr, a1) + (ri ? ' L' + P(ri, a1) + ' A' + f(ri) + ' ' + f(ri) + ' 0 ' + lg + ' 0 ' + P(ri, a0) : ' L' + f(cx) + ' ' + f(cy)) + 'Z" fill="' + d[i % d.length] + '" stroke="' + col.card + '" stroke-width="1"/>'); a0 = a1;
        if (w > rr * 2 + 70) s.push('<circle cx="' + f(cx + rr + 18) + '" cy="' + f(cy - rr * 0.6 + i * Math.min(16, rr * 0.3)) + '" r="4" fill="' + d[i % d.length] + '"/><rect x="' + f(cx + rr + 27) + '" y="' + f(cy - rr * 0.6 + i * Math.min(16, rr * 0.3) - 3) + '" width="' + f(Math.min(60, w * 0.2)) + '" height="6" rx="3" fill="' + col.muted + '" opacity=".35"/>'); });
    } else if (kind === 'treemap') {
      const tiles = (x0, y0, w0, h0, vals, k) => { if (!vals.length) return; if (vals.length === 1) { s.push('<rect x="' + f(x0 + 1) + '" y="' + f(y0 + 1) + '" width="' + f(w0 - 2) + '" height="' + f(h0 - 2) + '" fill="' + d[k % d.length] + '"/>'); return; }
        const tot = vals.reduce((a, b) => a + b, 0), a = vals[0] / tot; if (w0 >= h0) { tiles(x0, y0, w0 * a, h0, [vals[0]], k); tiles(x0 + w0 * a, y0, w0 * (1 - a), h0, vals.slice(1), k + 1); } else { tiles(x0, y0, w0, h0 * a, [vals[0]], k); tiles(x0, y0 + h0 * a, w0, h0 * (1 - a), vals.slice(1), k + 1); } };
      tiles(x, y, w, h, [34, 22, 16, 12, 9, 7], 0);
    } else if (kind === 'funnel') {
      const n = 5; for (let i = 0; i < n; i++) { const bw = w * (0.95 - i * 0.16); s.push('<rect x="' + f(x + (w - bw) / 2) + '" y="' + f(y + i * h / n + 2) + '" width="' + f(bw) + '" height="' + f(h / n - 4) + '" fill="' + d[0] + '" opacity="' + (1 - i * 0.13) + '" rx="1"/>'); }
    } else if (kind === 'gauge') {
      const rr = Math.min(w / 2, h) * 0.9, cx = x + w / 2, cy = y + h * 0.92;
      const arc = (a0, a1, colr) => s.push('<path d="M' + f(cx + rr * Math.cos(a0)) + ' ' + f(cy + rr * Math.sin(a0)) + ' A' + f(rr) + ' ' + f(rr) + ' 0 0 1 ' + f(cx + rr * Math.cos(a1)) + ' ' + f(cy + rr * Math.sin(a1)) + '" fill="none" stroke="' + colr + '" stroke-width="' + f(rr * 0.28) + '"/>');
      arc(Math.PI, 2 * Math.PI, col.muted + '55'); arc(Math.PI, Math.PI * 1.68, d[0]);
      s.push(t(cx, cy - 4, '68%', Math.max(11, rr * 0.3), col.text, 'middle', 700));
    } else if (kind === 'map') {
      s.push('<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '" fill="' + col.muted + '" opacity=".12" rx="2"/>');
      let p = 'M' + f(x + w * 0.12) + ' ' + f(y + h * 0.3); for (let i = 1; i <= 8; i++) p += ' L' + f(x + w * (0.12 + i * 0.1)) + ' ' + f(y + h * (0.22 + R() * 0.2)); for (let i = 8; i >= 0; i--) p += ' L' + f(x + w * (0.12 + i * 0.1)) + ' ' + f(y + h * (0.7 + R() * 0.15)); s.push('<path d="' + p + 'Z" fill="' + col.muted + '" opacity=".22"/>');
      for (let i = 0; i < 9; i++) s.push('<circle cx="' + f(x + w * (0.18 + R() * 0.7)) + '" cy="' + f(y + h * (0.3 + R() * 0.45)) + '" r="' + f(3 + R() * Math.min(12, h * 0.06)) + '" fill="' + d[0] + '" opacity=".7"/>');
    } else if (kind === 'table' || kind === 'matrix') {
      const rh = 20, n = Math.max(1, Math.floor(h / rh) - 1), cols = Math.max(2, Math.min(6, Math.floor(w / 90)));
      s.push('<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + rh + '" fill="' + d[0] + '" rx="2"/>');
      for (let j = 0; j < cols; j++) s.push('<rect x="' + f(x + j * w / cols + 6) + '" y="' + f(y + 7) + '" width="' + f(w / cols * 0.5) + '" height="6" rx="3" fill="' + col.card + '" opacity=".85"/>');
      for (let i = 0; i < n; i++) { const yy = y + rh * (i + 1);
        if (kind === 'matrix' && i % 4 === 0) s.push('<rect x="' + f(x) + '" y="' + f(yy) + '" width="' + f(w) + '" height="' + rh + '" fill="' + d[0] + '" opacity=".08"/>');
        s.push('<line x1="' + f(x) + '" x2="' + f(x + w) + '" y1="' + f(yy + rh) + '" y2="' + f(yy + rh) + '" stroke="' + col.muted + '" stroke-width=".6" opacity=".35"/>');
        for (let j = 0; j < cols; j++) s.push('<rect x="' + f(x + j * w / cols + 6 + (kind === 'matrix' && j === 0 && i % 4 ? 8 : 0)) + '" y="' + f(yy + 7) + '" width="' + f(w / cols * (0.3 + R() * 0.35)) + '" height="6" rx="3" fill="' + col.text + '" opacity=".28"/>'); }
    } else if (kind === 'slicer' && o.h < 52) {
      // compact dropdown: the field name inside the box
      s.push('<rect x="' + f(o.x) + '" y="' + f(o.y) + '" width="' + f(o.w) + '" height="' + f(o.h) + '" rx="' + Math.min(6, o.h / 3) + '" fill="' + col.card + '" stroke="' + col.muted + '" stroke-opacity=".5"/>');
      s.push(t(o.x + 10, o.y + o.h / 2 + 4, (o.title || 'Slicer') + ': All', Math.min(12, Math.max(9, o.h * 0.36)), col.text), '<path d="M' + f(o.x + o.w - 18) + ' ' + f(o.y + o.h / 2 - 2) + ' l5 5 l5 -5" fill="none" stroke="' + col.muted + '" stroke-width="1.5"/>');
    } else if (kind === 'slicer') {
      s.push(t(o.x + pad, o.y + pad + 12, o.title || 'Slicer', 11, col.muted));
      const bh = Math.min(28, o.h - pad * 2 - 18);
      if (bh > 8) { s.push('<rect x="' + f(o.x + pad) + '" y="' + f(o.y + pad + 18) + '" width="' + f(o.w - 2 * pad) + '" height="' + f(bh) + '" rx="4" fill="' + col.card + '" stroke="' + col.muted + '" stroke-opacity=".5"/>');
        s.push(t(o.x + pad + 8, o.y + pad + 18 + bh / 2 + 4, 'All', 11, col.text), '<path d="M' + f(o.x + o.w - pad - 16) + ' ' + f(o.y + pad + 18 + bh / 2 - 2) + ' l5 5 l5 -5" fill="none" stroke="' + col.muted + '" stroke-width="1.5"/>'); }
    } else if (kind === 'text') {
      s.push(t(o.x + pad, o.y + o.h / 2 + 6, o.title || 'Text', Math.max(12, Math.min(22, o.h * 0.4)), col.headerText || col.text, '', 700));
    } else if (kind === 'button') {
      s.push('<rect x="' + f(o.x + pad) + '" y="' + f(o.y + pad) + '" width="' + f(o.w - 2 * pad) + '" height="' + f(o.h - 2 * pad) + '" rx="6" fill="' + d[0] + '"/>', t(o.x + o.w / 2, o.y + o.h / 2 + 4, o.title || 'Button', 12, col.card, 'middle', 600));
    } else if (kind === 'image' && o.logo) {
      if (o.src) s.push('<image xlink:href="' + o.src + '" x="' + f(o.x) + '" y="' + f(o.y) + '" width="' + f(o.w) + '" height="' + f(o.h) + '" preserveAspectRatio="xMidYMid meet"/>');
      else s.push('<rect x="' + f(o.x) + '" y="' + f(o.y) + '" width="' + f(o.w) + '" height="' + f(o.h) + '" rx="4" fill="' + col.card + '" fill-opacity=".25" stroke="' + col.headerText + '" stroke-opacity=".6" stroke-dasharray="4 3"/>', t(o.x + o.w / 2, o.y + o.h / 2 + 4, 'LOGO', Math.min(12, o.h * 0.4), col.headerText, 'middle', 700));
    } else if (kind === 'image') {
      s.push('<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '" fill="' + col.muted + '" opacity=".15" rx="2"/><path d="M' + f(x) + ' ' + f(y) + ' L' + f(x + w) + ' ' + f(y + h) + ' M' + f(x + w) + ' ' + f(y) + ' L' + f(x) + ' ' + f(y + h) + '" stroke="' + col.muted + '" stroke-opacity=".4"/>');
    } else if (kind === 'decomp') {
      const lv = 3; for (let i = 0; i < lv; i++) for (let j = 0; j <= i + 1; j++) { const bx = x + i * w / lv + 6, by = y + j * Math.min(28, h / 4); s.push('<rect x="' + f(bx) + '" y="' + f(by) + '" width="' + f(w / lv * (0.7 - j * 0.1)) + '" height="10" fill="' + d[0] + '" opacity="' + (1 - j * 0.2) + '" rx="2"/>'); }
    } else {
      s.push('<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '" fill="none" stroke="' + col.muted + '" stroke-dasharray="4 3"/>', t(o.x + o.w / 2, o.y + o.h / 2, LO.typeOf(o.type).label, 11, col.muted, 'middle'));
    }
    return s.join('');
  }

  /* ----- the wireframe: background + sketches (+ grid, labels, selection) ----- */
  function wireframe(L, c, col, st, opts){
    opts = opts || {};
    const font = "'" + (opts.font || 'Segoe UI').replace(/'/g, '') + "', 'Segoe UI', Arial, sans-serif";
    const W = c.w, H = c.h, out = [];
    let guides = '';
    if (opts.grid) {
      const g = L.grid, gl = [];
      g.x.forEach((x, i) => gl.push('<rect x="' + f(x) + '" y="' + f(g.top) + '" width="' + f(g.w[i]) + '" height="' + f(g.bottom - g.top) + '" fill="' + col.accent + '" opacity=".05"/>'));
      g.y.forEach((y, i) => gl.push('<rect x="' + f(g.left) + '" y="' + f(y) + '" width="' + f(g.right - g.left) + '" height="' + f(g.h[i]) + '" fill="' + col.accent + '" opacity=".04"/>'));
      guides = '<g id="Grid">' + gl.join('') + '</g>';
    }
    // grid guides sit on the page, under the visual cards, so they never tint a visual
    out.push(background(L, c, col, st, { inner: true, afterPage: guides }));
    if (opts.empty) L.empty.forEach(([a, b]) => { const g = L.grid; out.push('<g class="cell" data-cell="' + a + ',' + b + '" tabindex="0" role="button" aria-label="Add a visual in column ' + (a + 1) + ', row ' + (b + 1) + '"><rect x="' + f(g.x[a] + 2) + '" y="' + f(g.y[b] + 2) + '" width="' + f(g.w[a] - 4) + '" height="' + f(g.h[b] - 4) + '" rx="6" fill="' + col.accent + '" fill-opacity=".04" stroke="' + col.accent + '" stroke-opacity=".45" stroke-dasharray="6 5"/><text x="' + f(g.x[a] + g.w[a] / 2) + '" y="' + f(g.y[b] + g.h[b] / 2 + 5) + '" text-anchor="middle" font-size="14" fill="' + col.accent + '" font-family="' + font + '">+ Add a visual</text></g>'); });
    const hdr = L.items.find(o => o.id === 'header');
    const ttl = L.items.find(o => o.id === 'title');
    if (hdr && ttl) {
      const onBand = st.header === 'band' || st.header === 'bleed';
      out.push('<text id="Header-title" x="' + f(ttl.x) + '" y="' + f(hdr.y + hdr.h / 2 + ttl.fontSize * 0.34) + '" font-size="' + ttl.fontSize + '" font-weight="700" fill="' + (onBand ? col.headerText : col.text) + '" font-family="' + font + '">' + esc(ttl.title) + '</text>');
    }
    L.items.filter(o => !o.band).forEach(o => {
      const sel = opts.selected === o.id;
      out.push('<g class="vis" data-id="' + o.id + '"' + (opts.hit ? ' tabindex="0" role="button" aria-label="' + esc((o.title || LO.typeOf(o.type).label) + ', ' + LO.typeOf(o.type).label) + '"' : '') + ' id="' + (opts.ids === false ? '' : 'Visual-' + idName(o.title || LO.typeOf(o.type).label)) + '">' + (o.tile ? '<rect x="' + f(o.x) + '" y="' + f(o.y) + '" width="' + f(o.w) + '" height="' + f(o.h) + '" rx="' + Math.min(+st.radius || 0, 8, o.h / 3) + '" fill="' + col.card + '"' + (st.shadow ? ' filter="url(#lo-shadow)"' : '') + '/>' : '') + sketch(o, o.logo && !(st.header === 'band' || st.header === 'bleed') ? Object.assign({}, col, { headerText: col.text }) : col, font)
        + (opts.hit ? '<rect x="' + f(o.x) + '" y="' + f(o.y) + '" width="' + f(o.w) + '" height="' + f(o.h) + '" fill="transparent"' + (sel ? ' stroke="' + col.select + '" stroke-width="3"' : '') + (st.radius ? ' rx="' + st.radius + '"' : '') + '/>' : '') + '</g>');
      const zone = o.zone || (o.type === 'slicer' ? '30' : '');
      if (opts.zones && zone) { const zc = { '3': '#0B7A75', '30': '#1F6FB2', '300': '#5B3E96' }[zone], zt = zone + ' s', zw = 12 + zt.length * 6.4, zh = 18, zx = o.x + o.w - zw - 6, zy = o.y + 6;
        if (o.w > zw + 12 && o.h > zh + 8) out.push('<g class="zone"><rect x="' + f(zx) + '" y="' + f(zy) + '" width="' + f(zw) + '" height="' + zh + '" rx="9" fill="' + zc + '"/><text x="' + f(zx + zw / 2) + '" y="' + f(zy + 12.5) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#FFFFFF" font-family="' + font + '">' + zt + '</text></g>'); }
      if (opts.dims && o.h >= 44) out.push('<text x="' + f(o.x + o.w - 6) + '" y="' + f(o.y + o.h - 6) + '" font-size="10" text-anchor="end" fill="' + col.muted + '" font-family="Consolas, monospace">' + Math.round(o.w) + '×' + Math.round(o.h) + ' @ ' + Math.round(o.x) + ',' + Math.round(o.y) + '</text>');
    });
    const defs = st.shadow ? '' : '';
    return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '"' + (opts.cls ? ' class="' + opts.cls + '"' : '') + '>' + defs + out.join('') + '</svg>';
  }

  return { background, wireframe, sketch, idName, shadowOf, headerImage, SH_DEFAULT };
})();
