
/* ---------- Layout Designer: colors and PNG ---------- */
const LX = (() => {
  const norm = h => TB.norm(h);
  const pickText = bg => TB.contrast('#FFFFFF', bg) >= TB.contrast('#252423', bg) ? '#FFFFFF' : '#252423';

  // Everything the drawings need, from a few base colors
  function derive(b){
    const page = norm(b.page) || '#F3F4F6', card = norm(b.card) || '#FFFFFF', dark = TB.isDark(card);
    const text = norm(b.text) || (dark ? '#F3F2F1' : '#252423');
    const data = (b.data && b.data.length ? b.data : TB.palette([norm(b.accent) || '#1F6FB2'], 8, 'varied')).map(norm).filter(Boolean);
    const accent = norm(b.accent) || data[0];
    const header = norm(b.header) || accent;
    return { page, card, header, headerText: norm(b.headerText) || pickText(header), sidePanel: norm(b.sidePanel) || card,
      border: norm(b.border) || TB.mix(text, card, 0.85), text, muted: TB.mix(text, card, 0.45), accent, data,
      good: norm(b.good) || '#1D6FA3', bad: norm(b.bad) || '#E07B39', select: TB.isDark(page) ? '#FFD166' : '#E8A317' };
  }

  // A light page with white cards, or a dark page with lighter cards, from any brand color
  function suggestedFromAccent(accent){ return { page: '#F3F4F6', card: '#FFFFFF', accent, header: accent, text: '#252423' }; }

  /* From the Theme Builder's saved settings (same site, same browser) */
  function fromThemeBuilder(){
    let cfg = null; try { cfg = JSON.parse(localStorage.getItem('ktb.cfg') || 'null'); } catch (e) {}
    if (!cfg || !cfg.seeds || !cfg.seeds.length) return null;
    const base = TB.palette(cfg.seeds, +cfg.count || 8, cfg.style || 'varied');
    const data = base.map((h, i) => norm((cfg.overrides || {})[i]) || h);
    const r = TB.roles({ dataColors: data, background: cfg.background, visualBg: cfg.visualBg, textMode: cfg.textMode, textColor: cfg.textColor, good: cfg.good, neutral: cfg.neutral, bad: cfg.bad });
    const page = r.page, vis = r.visual;
    // transparent visuals in the theme: suggest cards a step off the page
    const card = vis || (TB.isDark(page) ? TB.mix('#FFFFFF', page, 0.9) : (TB.contrast(page, '#FFFFFF') < 1.05 ? '#FFFFFF' : '#FFFFFF'));
    const pageOut = vis ? page : (TB.isDark(page) ? page : (TB.contrast(page, '#FFFFFF') < 1.05 ? '#F3F4F6' : page));
    return { name: (cfg.name || '').trim() || 'Theme Builder theme', base: { page: pageOut, card, accent: data[0], header: data[0], text: r.text, data, good: r.good, bad: r.bad, font: cfg.font } };
  }

  /* From a report theme JSON (any theme, not only ones made here) */
  function fromThemeJson(text){
    let t; try { t = JSON.parse(text); } catch (e) { return { error: 'That isn’t valid JSON. Paste the whole theme file, from { to }.' }; }
    const colorOf = v => { if (!v) return null; if (typeof v === 'string') return norm(v); if (v.solid && v.solid.color) return colorOf(v.solid.color); if (v.color) return colorOf(v.color); return null; };
    const data = (t.dataColors || []).map(colorOf).filter(Boolean);
    if (!data.length && !t.background && !t.foreground) return { error: 'No dataColors, background or foreground were found. Is this a Power BI report theme file?' };
    const vs = t.visualStyles || {};
    const get = (v, obj) => { try { return vs[v]['*'][obj][0]; } catch (e) { return null; } };
    const pageBg = get('page', 'background'), visBg = get('*', 'background'), outspace = get('page', 'outspace');
    const pageColor = colorOf(pageBg && pageBg.color) || colorOf(outspace && outspace.color) || colorOf(t.background) || '#FFFFFF';
    const visShown = visBg && visBg.show !== false && !(visBg.transparency >= 100);
    const card = visShown ? (colorOf(visBg.color) || colorOf(t.background) || '#FFFFFF') : '#FFFFFF';
    const page = visShown ? pageColor : (TB.isDark(pageColor) ? pageColor : (TB.contrast(pageColor, '#FFFFFF') < 1.05 ? '#F3F4F6' : pageColor));
    let font = null; try { font = t.textClasses.title.fontFace || t.textClasses.label.fontFace; } catch (e) {}
    const accent = data[0] || colorOf(t.tableAccent) || '#1F6FB2';
    return { name: t.name || 'Theme file', base: { page, card, accent, header: accent, text: colorOf(t.foreground) || (TB.isDark(card) ? '#F3F2F1' : '#252423'), data: data.length ? data : null, good: colorOf(t.good), bad: colorOf(t.bad), font: font && String(font).split(',')[0].replace(/['"]/g, '').trim() } };
  }

  /* ----- SVG -> PNG ----- */
  function png(svg, w, h, scale){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { const cv = document.createElement('canvas'); cv.width = Math.round(w * scale); cv.height = Math.round(h * scale); const cx = cv.getContext('2d'); cx.scale(scale, scale); cx.drawImage(img, 0, 0, w, h); cv.toBlob(b => b ? resolve(b) : reject(new Error('PNG failed')), 'image/png'); };
      img.onerror = () => reject(new Error('The drawing couldn’t be turned into a PNG.'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }

  /* ----- an image the user adds (logo, header image) -----
     PNG and JPEG up to maxSide stay as they are. Anything else (SVG, GIF, WebP), or a bigger
     picture, is redrawn as a PNG (JPEG for photos), so Figma, PowerPoint and the PNGs all take it. */
  function readImage(src, maxSide){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) { w = 600; h = 200; }
        const jpeg = /^data:image\/jpe?g/i.test(src), keep = (jpeg || /^data:image\/png/i.test(src)) && Math.max(w, h) <= maxSide;
        if (keep) return resolve({ src, w, h });
        const k = Math.min(maxSide / Math.max(w, h), /^data:image\/svg/i.test(src) ? Math.max(1, 600 / Math.max(w, h)) : 1);
        const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        try { resolve({ src: jpeg ? cv.toDataURL('image/jpeg', 0.9) : cv.toDataURL('image/png'), w: cv.width, h: cv.height }); } catch (e) { reject(new Error('That file couldn’t be read as an image.')); }
      };
      img.onerror = () => reject(new Error('That file couldn’t be read as an image.'));
      img.src = src;
    });
  }

  return { derive, suggestedFromAccent, fromThemeBuilder, fromThemeJson, png, readImage };
})();
