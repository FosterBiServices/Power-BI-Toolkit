
/* ---------- Layout Designer: PowerPoint (.pptx) export, built in the browser ---------- */
const LP = (() => {
  const EMU = 9525; // per pixel at 96 dpi
  const e = v => Math.round(v * EMU);
  const xml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hex = c => (TB.norm(c) || '#000000').slice(1);
  const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
  const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

  /* ----- stored zip ----- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(entries, type){
    const enc = new TextEncoder(), parts = [], central = []; let off = 0;
    for (const [path, content] of entries) {
      const name = enc.encode(path), data = typeof content === 'string' ? enc.encode(content) : content, crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(10, 0, true); h.setUint16(12, 0x21, true);
      h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true); cd.setUint16(14, 0x21, true);
      cd.setUint32(16, crc, true); cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true); cd.setUint16(28, name.length, true); cd.setUint32(42, off, true);
      central.push(new Uint8Array(cd.buffer), name);
      off += 30 + name.length + data.length;
    }
    const size = central.reduce((a, b) => a + b.length, 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true); end.setUint32(12, size, true); end.setUint32(16, off, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: type || 'application/zip' });
  }

  /* ----- shapes ----- */
  let nextId = 2;
  const xfrm = (x, y, w, h) => '<a:xfrm><a:off x="' + e(x) + '" y="' + e(y) + '"/><a:ext cx="' + Math.max(1, e(w)) + '" cy="' + Math.max(1, e(h)) + '"/></a:xfrm>';
  function shadowXml(st){
    if (!st.shadow) return '';
    const s = LR.shadowOf(st), dist = Math.hypot(+s.x || 0, +s.y || 0), dir = Math.round(((Math.atan2(+s.y || 0, +s.x || 0) * 180 / Math.PI) + 360) % 360 * 60000);
    return '<a:effectLst><a:outerShdw blurRad="' + e(+s.blur || 0) + '" dist="' + e(dist) + '" dir="' + dir + '" algn="ctr" rotWithShape="0"><a:srgbClr val="' + hex(s.color) + '"><a:alpha val="' + Math.round(Math.max(0, Math.min(100, +s.opacity || 0)) * 1000) + '"/></a:srgbClr></a:outerShdw></a:effectLst>';
  }
  const run = (text, o) => '<a:r><a:rPr lang="en-US" sz="' + Math.round((o.px || 12) * 0.75 * 100) + '"' + (o.bold ? ' b="1"' : '') + ' dirty="0"><a:solidFill><a:srgbClr val="' + hex(o.color) + '"/></a:solidFill><a:latin typeface="' + xml(o.font || 'Segoe UI') + '"/><a:cs typeface="' + xml(o.font || 'Segoe UI') + '"/></a:rPr><a:t>' + xml(text) + '</a:t></a:r>';
  function shape(name, x, y, w, h, o){
    o = o || {};
    const minSide = Math.max(1, Math.min(w, h)), r = +o.radius || 0;
    const geom = r ? '<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ' + Math.min(50000, Math.round(r / minSide * 100000)) + '"/></a:avLst></a:prstGeom>' : '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>';
    const fill = o.fill ? '<a:solidFill><a:srgbClr val="' + hex(o.fill) + '"/></a:solidFill>' : '<a:noFill/>';
    const ln = o.line ? '<a:ln w="' + e(o.lineW || 1) + '"' + '><a:solidFill><a:srgbClr val="' + hex(o.line) + '"/></a:solidFill>' + (o.dash ? '<a:prstDash val="dash"/>' : '') + '</a:ln>' : '<a:ln><a:noFill/></a:ln>';
    const paras = (o.lines || []).map(l => '<a:p>' + (l.align ? '<a:pPr algn="' + l.align + '"/>' : '') + run(l.text, l) + '</a:p>').join('') || '<a:p><a:endParaRPr lang="en-US"/></a:p>';
    const pad = e(o.pad == null ? 8 : o.pad);
    return '<p:sp><p:nvSpPr><p:cNvPr id="' + (nextId++) + '" name="' + xml(name) + '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>' + xfrm(x, y, w, h) + geom + fill + ln + (o.shadow || '') + '</p:spPr>'
      + '<p:txBody><a:bodyPr wrap="square" lIns="' + pad + '" tIns="' + pad + '" rIns="' + pad + '" bIns="' + pad + '" anchor="' + (o.anchor || 't') + '"><a:normAutofit/></a:bodyPr><a:lstStyle/>' + paras + '</p:txBody></p:sp>';
  }
  /* o: { crop: [l, t, r, b] fractions, radius, shadow } */
  const pic = (name, rid, x, y, w, h, o) => { o = o || {};
    const cr = o.crop ? '<a:srcRect' + ['l', 't', 'r', 'b'].map((k, i) => o.crop[i] > 0 ? ' ' + k + '="' + Math.round(o.crop[i] * 100000) + '"' : '').join('') + '/>' : '';
    const r = +o.radius || 0, geom = r ? '<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ' + Math.min(50000, Math.round(r / Math.max(1, Math.min(w, h)) * 100000)) + '"/></a:avLst></a:prstGeom>' : '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>';
    return '<p:pic><p:nvPicPr><p:cNvPr id="' + (nextId++) + '" name="' + xml(name) + '"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="' + rid + '"/>' + cr + '<a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>' + xfrm(x, y, w, h) + geom + (o.shadow || '') + '</p:spPr></p:pic>'; };
  // crop an image of iw x ih so it covers a w x h box, centered (like the SVG pattern)
  const cover = (iw, ih, w, h) => { const ri = iw / ih, rb = w / h; if (ri > rb) { const c = (1 - rb / ri) / 2; return [c, 0, c, 0]; } const c = (1 - ri / rb) / 2; return [0, c, 0, c]; };
  const slideXml = (name, body) => HEAD + '<p:sld ' + NS + '><p:cSld name="' + xml(name) + '"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' + body + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>';

  /* The editable layout: every container is a PowerPoint shape you can move, resize and restyle */
  function layoutSlide(L, c, col, st, font, logoRid, hdrRid){
    const W = c.w, H = c.h, r = +st.radius || 0, sh = shadowXml(st), out = [];
    const border = st.border ? { line: col.border } : {};
    out.push(shape('Page background', 0, 0, W, H, { fill: col.page, pad: 0 }));
    const hdr = L.items.find(o => o.id === 'header');
    const onBand = st.header === 'band' || st.header === 'bleed';
    const hi = hdrRid && LR.headerImage(st);
    if (hdr && hi) { const bleed = st.header === 'bleed', b = bleed ? [0, 0, W, hdr.y + hdr.h] : [hdr.x, hdr.y, hdr.w, hdr.h];
      out.push(pic('Header', hdrRid, b[0], b[1], b[2], b[3], { crop: cover(hi.w, hi.h, b[2], b[3]), radius: bleed ? 0 : r, shadow: bleed ? '' : sh })); }
    else if (hdr && st.header === 'bleed') out.push(shape('Header', 0, 0, W, hdr.y + hdr.h, { fill: col.header, pad: 0 }));
    else if (hdr && st.header === 'band') out.push(shape('Header', hdr.x, hdr.y, hdr.w, hdr.h, Object.assign({ fill: col.header, radius: r, shadow: sh, pad: 0 })));
    else if (hdr && st.header === 'line') out.push(shape('Header underline', hdr.x, hdr.y + hdr.h - 3, hdr.w, 3, { fill: col.accent, pad: 0 }));
    const side = L.items.find(o => o.id === 'side');
    if (side && st.side !== 'none') out.push(shape('Side panel', side.x, side.y, side.w, side.h, Object.assign({ fill: col.sidePanel, radius: r, shadow: sh, pad: 0 }, border)));
    // blank containers for empty cells
    if (st.cards !== 'none') (L.empty || []).forEach(([a, b]) => { const G = L.grid; out.push(shape('Empty cell ' + (a + 1) + ',' + (b + 1), G.x[a], G.y[b], G.w[a], G.h[b], Object.assign({ fill: col.card, radius: r, shadow: sh }, border))); });
    L.items.filter(o => !o.band && !o.logo).forEach(o => {
      const label = LO.typeOf(o.type).label, title = o.title || label;
      const cardBg = st.cards !== 'none' && !(o.region === 'side' && st.side !== 'none');
      const small = o.h < 60;
      const lines = small ? [{ text: title + (o.type === 'slicer' ? '  ▾' : ''), px: Math.min(12, Math.max(8, o.h * 0.34)), color: col.text, bold: o.type !== 'slicer', font }]
        : [{ text: title, px: 12, bold: true, color: col.text, font }, { text: label + ' · ' + Math.round(o.w) + ' × ' + Math.round(o.h), px: 10, color: col.muted, font }];
      out.push(shape((o.region === 'header' ? 'Header ' : '') + label + ' - ' + title, o.x, o.y, o.w, o.h, Object.assign({ fill: cardBg || o.region === 'header' ? col.card : null, radius: Math.min(r, o.h / 3), shadow: cardBg || o.tile ? sh : '', lines, anchor: small ? 'ctr' : 't', pad: small ? 6 : 10 }, cardBg ? border : { line: col.border })));
    });
    const lg = L.items.find(o => o.logo);
    if (lg) out.push(logoRid ? pic('Logo', logoRid, lg.x, lg.y, lg.w, lg.h) : shape('Logo', lg.x, lg.y, lg.w, lg.h, { line: onBand ? col.headerText : col.text, dash: true, lines: [{ text: 'LOGO', px: Math.min(12, lg.h * 0.4), bold: true, color: onBand ? col.headerText : col.text, align: 'ctr', font }], anchor: 'ctr', pad: 2 }));
    const t = L.items.find(o => o.id === 'title');
    if (t) out.push(shape('Title', t.x, t.y, t.w, t.h, { lines: [{ text: t.title, px: t.fontSize, bold: true, color: onBand ? col.headerText : col.text, font }], anchor: 'ctr', pad: 0 }));
    return out.join('');
  }

  const THEME = HEAD + '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Toolkit"><a:themeElements><a:clrScheme name="Toolkit"><a:dk1><a:srgbClr val="252423"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F3A5F"/></a:dk2><a:lt2><a:srgbClr val="F3F4F6"/></a:lt2><a:accent1><a:srgbClr val="1F6FB2"/></a:accent1><a:accent2><a:srgbClr val="7A4FA3"/></a:accent2><a:accent3><a:srgbClr val="00A99C"/></a:accent3><a:accent4><a:srgbClr val="C172B5"/></a:accent4><a:accent5><a:srgbClr val="2C408E"/></a:accent5><a:accent6><a:srgbClr val="728DE3"/></a:accent6><a:hlink><a:srgbClr val="1F6FB2"/></a:hlink><a:folHlink><a:srgbClr val="7A4FA3"/></a:folHlink></a:clrScheme>'
    + '<a:fontScheme name="Toolkit"><a:majorFont><a:latin typeface="Segoe UI"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Segoe UI"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>'
    + '<a:fmtScheme name="Toolkit"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>';
  const EMPTY_TREE = '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree>';
  const rels = list => HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + list.map(([id, type, target]) => '<Relationship Id="' + id + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/' + type + '" Target="' + target + '"/>').join('') + '</Relationships>';
  const b64 = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };

  /* images: { wf: Uint8Array png, bg: Uint8Array png } */
  function build(L, c, col, st, font, images){
    nextId = 2;
    const W = c.w, H = c.h, files = [], slides = [], media = [];
    // logo as a picture when it's a PNG or JPEG
    let logoRid = null;
    const lg = c.header && c.header.logo, m = lg && lg.on && lg.src && /^data:image\/(png|jpe?g);base64,(.*)$/i.exec(lg.src);
    if (m) { const ext = /png/i.test(m[1]) ? 'png' : 'jpeg'; media.push(['ppt/media/logo.' + ext, b64(m[2])]); logoRid = 'rId2'; }
    // header image as a cropped picture
    let hdrRid = null, hdrRel = [];
    const hi = LR.headerImage(st), hm = hi && /^data:image\/(png|jpe?g);base64,(.*)$/i.exec(hi.src);
    if (hm) { const ext = /png/i.test(hm[1]) ? 'png' : 'jpeg'; media.push(['ppt/media/header.' + ext, b64(hm[2])]); hdrRid = 'rId3'; hdrRel = [['rId3', 'image', '../media/header.' + ext]]; }
    slides.push({ name: 'Layout (editable)', body: layoutSlide(L, c, col, st, font, logoRid, hdrRid), rels: [['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml']].concat(logoRid ? [['rId2', 'image', '../media/logo.' + (/png/i.test(m[1]) ? 'png' : 'jpeg')]] : [], hdrRel) });
    if (images && images.wf) { media.push(['ppt/media/wireframe.png', images.wf]); slides.push({ name: 'Wireframe with sample visuals', body: pic('Wireframe', 'rId2', 0, 0, W, H), rels: [['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'image', '../media/wireframe.png']] }); }
    if (images && images.bg) { media.push(['ppt/media/background.png', images.bg]); slides.push({ name: 'Background image', body: pic('Background', 'rId2', 0, 0, W, H), rels: [['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'image', '../media/background.png']] }); }

    files.push(['[Content_Types].xml', HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/>'
      + '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
      + slides.map((s, i) => '<Override PartName="/ppt/slides/slide' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>').join('')
      + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>']);
    files.push(['_rels/.rels', HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>']);
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    files.push(['docProps/core.xml', HEAD + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + xml(c.name || 'Layout') + '</dc:title><dc:creator>SF Power BI Toolkit</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified></cp:coreProperties>']);
    files.push(['docProps/app.xml', HEAD + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>SF Power BI Toolkit</Application><Slides>' + slides.length + '</Slides></Properties>']);
    files.push(['ppt/presentation.xml', HEAD + '<p:presentation ' + NS + ' saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>' + slides.map((s, i) => '<p:sldId id="' + (256 + i) + '" r:id="rId' + (i + 3) + '"/>').join('') + '</p:sldIdLst><p:sldSz cx="' + e(W) + '" cy="' + e(H) + '"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>']);
    files.push(['ppt/_rels/presentation.xml.rels', rels([['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'], ['rId2', 'theme', 'theme/theme1.xml']].concat(slides.map((s, i) => ['rId' + (i + 3), 'slide', 'slides/slide' + (i + 1) + '.xml'])))]);
    files.push(['ppt/slideMasters/slideMaster1.xml', HEAD + '<p:sldMaster ' + NS + '><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>' + EMPTY_TREE + '</p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>']);
    files.push(['ppt/slideMasters/_rels/slideMaster1.xml.rels', rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'theme', '../theme/theme1.xml']])]);
    files.push(['ppt/slideLayouts/slideLayout1.xml', HEAD + '<p:sldLayout ' + NS + ' type="blank" preserve="1"><p:cSld name="Blank">' + EMPTY_TREE + '</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>']);
    files.push(['ppt/slideLayouts/_rels/slideLayout1.xml.rels', rels([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']])]);
    files.push(['ppt/theme/theme1.xml', THEME]);
    slides.forEach((s, i) => { files.push(['ppt/slides/slide' + (i + 1) + '.xml', slideXml(s.name, s.body)]); files.push(['ppt/slides/_rels/slide' + (i + 1) + '.xml.rels', rels(s.rels)]); });
    media.forEach(f => files.push(f));
    return zip(files, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  }
  return { build, zip };
})();
