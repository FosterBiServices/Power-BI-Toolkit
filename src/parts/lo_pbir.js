/* PARKED (Nov 2026): not included in the build. The owner chose not to write into people's PBIP folders for now;
   see CLAUDE.md, Parked. To bring it back: add it to build_lo.py after lo_suggest.js, plus a Step 4 button that calls SF_SUITE.pbipSave with LPB.page and LPB.plan
   (needs pbip_save.js back too). */
/* ---------- Layout Designer: the layout as a report page (PBIR) ----------
   One page.json with the background PNG, and one visual.json per box: the visual type, its position and title,
   no fields yet (each shows "Select or drag fields" in Desktop). On drawn cards a visual sits in its card's inner box
   with its own background off, so the card in the background shows through. Text boxes get their text.
   The header band, page title and empty cells are part of the background PNG, so they get no visual. */
const LPB = (() => {
  const PAGE = 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json';
  const VIS = 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.4.0/schema.json';
  const L = v => ({ expr: { Literal: { Value: typeof v === 'boolean' ? String(v) : typeof v === 'number' ? v + 'D' : "'" + String(v).replace(/'/g, "''") + "'" } } });
  const hex = n => { let s = ''; const a = new Uint8Array(n); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => { a[i] = Math.random() * 256; }); a.forEach(b => { s += b.toString(16).padStart(2, '0'); }); return s.slice(0, n * 2); };
  const r0 = v => Math.round(v * 100) / 100;
  const img = name => ({ expr: { ResourcePackageItem: { PackageName: 'RegisteredResources', PackageType: 1, ItemName: name } } });

  // which boxes become visuals, and where (the same rule as positions: cards use their inner box)
  function boxes(Lay, st){
    st = st || {};
    const cards = st.cards !== 'none', onCard = o => cards && !o.band && !o.logo && (o.region !== 'header' || o.tile) && (o.region !== 'side' || st.side === 'none');
    const parents = new Set(Lay.items.filter(o => o.parent).map(o => o.parent));
    return Lay.items.filter(o => !o.band && !parents.has(o.id) && o.type).map(o => {
      const p = onCard(o) ? LO.inset(o, st.radius) : 0;
      return { o, card: onCard(o), x: r0(o.x + p), y: r0(o.y + p), w: r0(o.w - 2 * p), h: r0(o.h - 2 * p) };
    });
  }

  function visualJson(b, i, opts){
    const o = b.o, title = o.title || LO.typeOf(o.type).label, name = hex(10);
    const vco = {};
    const v = { visualType: o.type };
    if (o.type === 'textbox') {
      v.objects = { general: [{ properties: { paragraphs: [{ textRuns: [{ value: title, textStyle: opts.textStyle || {} }] }] } }] };
    } else if (o.logo) {
      v.objects = { general: [{ properties: { imageUrl: img(opts.logoName) } }], imageScaling: [{ properties: { imageScalingType: L('Fit') } }] };
      vco.title = [{ properties: { show: L(false) } }];
      vco.general = [{ properties: { altText: L('Logo') } }];
    } else {
      vco.title = [{ properties: { show: L(true), text: L(title) } }];
      vco.general = [{ properties: { altText: L(title) } }];
    }
    if (b.card || o.logo) { vco.background = [{ properties: { show: L(false) } }]; vco.border = [{ properties: { show: L(false) } }]; vco.dropShadow = [{ properties: { show: L(false) } }]; }
    if (Object.keys(vco).length) v.visualContainerObjects = vco;
    const z = (o.logo ? 5000 : 1000) + i;
    return { name, json: { $schema: VIS, name, position: { x: b.x, y: b.y, z, height: b.h, width: b.w, tabOrder: z }, visual: v } };
  }

  /* -> { id, files: [{ path, text }] } with paths inside the .Report folder.
     opts: { name: page display name, bgName, logoName (when the logo is a visual), textStyle } */
  function page(Lay, cfg, st, opts){
    const id = hex(10), base = 'definition/pages/' + id;
    const pg = { $schema: PAGE, name: id, displayName: opts.name || cfg.name || 'New page', displayOption: 'FitToPage', height: Math.round(cfg.h), width: Math.round(cfg.w) };
    if (opts.bgName) pg.objects = { background: [{ properties: { image: { image: { name: L(opts.bgName), url: img(opts.bgName), scaling: L('Fit') } }, transparency: L(0) } }] };
    const files = [{ path: base + '/page.json', text: JSON.stringify(pg, null, 2) }];
    const list = boxes(Lay, st).filter(b => !(b.o.logo && !opts.logoName));
    list.forEach((b, i) => { const v = visualJson(b, i, opts); files.push({ path: base + '/visuals/' + v.name + '/visual.json', text: JSON.stringify(v.json, null, 2) }); });
    return { id, files, visuals: list.length };
  }

  /* merge into the report: pages.json gets the page, report.json registers the images.
     files: { 'definition/pages/pages.json': text, 'definition/report.json': text } (as read from the .Report folder)
     extra: [{ path, text|bytes }] images to add under StaticResources/RegisteredResources */
  function plan(files, made, images){
    const changes = [], errors = [];
    const rj = files['definition/report.json'];
    if (rj === undefined) return { changes, errors: ['This report has no definition/report.json, so it isn’t in the PBIR format. In Desktop, turn on File > Options > Preview features > Store reports using enhanced metadata format (PBIR), save as .pbip, then try again.'] };
    let rep; try { rep = JSON.parse(rj); } catch (e) { return { changes, errors: ['definition/report.json couldn’t be read.'] }; }
    let pj; try { pj = JSON.parse(files['definition/pages/pages.json'] || 'null'); } catch (e) { pj = null; }
    pj = pj || { $schema: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json', pageOrder: [] };
    pj.pageOrder = (pj.pageOrder || []).concat(made.id); if (!pj.activePageName) pj.activePageName = made.id;
    const pkgs = rep.resourcePackages = rep.resourcePackages || [];
    let reg = pkgs.find(p => p.name === 'RegisteredResources');
    if (!reg) { reg = { name: 'RegisteredResources', type: 'RegisteredResources', items: [] }; pkgs.push(reg); }
    reg.items = reg.items || [];
    images.forEach(im => { if (!reg.items.some(x => x.name === im.name)) reg.items.push({ name: im.name, path: im.name, type: 'Image' }); });
    made.files.forEach(f => changes.push(/page\.json$/.test(f.path) ? { path: f.path, text: f.text, isNew: true, what: 'the page' } : { path: f.path, text: f.text, isNew: true, group: 'definition/pages/' + made.id + '/visuals' }));
    images.forEach(im => changes.push({ path: 'StaticResources/RegisteredResources/' + im.name, text: im.bytes, isNew: true, what: im.what }));
    changes.push({ path: 'definition/pages/pages.json', text: JSON.stringify(pj, null, 2), isNew: files['definition/pages/pages.json'] === undefined, what: 'adds the page to the page order' });
    changes.push({ path: 'definition/report.json', text: JSON.stringify(rep, null, 2), what: 'registers ' + images.map(i => i.name).join(' and ') });
    return { changes, errors };
  }
  return { boxes, page, plan };
})();
