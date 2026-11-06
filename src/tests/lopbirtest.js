// Layout Designer: Add as a page to a PBIP report. Writes page.json, a visual.json per box (type, position, title,
// no fields), the background PNG, and registers it in report.json and pages.json. In-memory folder from savepbip/.
// PARKED: skips while the feature isn't in the build (see CLAUDE.md, Parked)
if (!require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'layout-designer.html'), 'utf8').includes('LPB')) { console.log('parked: Add as a page to a PBIP report is not in the build'); console.log('errors', []); process.exit(0); }
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const read = d => { const o = {}; const walk = (p, rel) => fs.readdirSync(p, { withFileTypes: true }).forEach(e => e.isDirectory() ? walk(path.join(p, e.name), rel + e.name + '/') : (o[rel + e.name] = fs.readFileSync(path.join(p, e.name), 'utf8'))); walk(d, ''); return o; };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext()).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(files => {
    const dir = (name, pre) => ({ kind: 'directory', name,
      async *entries(){ const seen = new Set(); for (const k of Object.keys(window.__fs)) { if (!k.startsWith(pre)) continue; const rest = k.slice(pre.length), i = rest.indexOf('/');
        if (i < 0) yield [rest, file(rest, k)]; else { const n = rest.slice(0, i); if (!seen.has(n)) { seen.add(n); yield [n, dir(n, pre + n + '/')]; } } } },
      async getDirectoryHandle(n){ return dir(n, pre + n + '/'); },
      async getFileHandle(n, o){ if (!(pre + n in window.__fs) && !(o && o.create)) throw new Error('NotFound'); return file(n, pre + n); } });
    const file = (name, key) => ({ kind: 'file', name, async getFile(){ return new File([window.__fs[key] || ''], name); },
      async createWritable(){ let t = []; return { write: async x => { t.push(x); }, close: async () => { window.__fs[key] = typeof t[0] === 'string' ? t.join('') : t[0]; window.__written.push(key); } }; } });
    window.__fs = files; window.__written = [];
    window.showDirectoryPicker = async () => dir('Sample Sales', '');
  }, read(path.join(__dirname, 'savepbip')));
  await p.goto('http://localhost:8765/layout-designer.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
  await p.fill('#pbirName', 'Sales overview test');
  await p.click('#pbirSave'); await p.waitForSelector('#pbirPanel [data-sc-go]');
  console.log('plan:', (await p.textContent('#pbirPanel')).replace(/\s+/g, ' ').slice(0, 600));
  await p.click('#pbirPanel [data-sc-go]'); await p.waitForTimeout(500);
  console.log('after:', (await p.textContent('#pbirPanel')).trim().slice(0, 140));
  const r = await p.evaluate(() => {
    const W = window.__written, R = 'Sample Sales.Report/';
    const pages = JSON.parse(window.__fs[R + 'definition/pages/pages.json']), rep = JSON.parse(window.__fs[R + 'definition/report.json']);
    const id = pages.pageOrder[pages.pageOrder.length - 1], pg = JSON.parse(window.__fs[R + 'definition/pages/' + id + '/page.json']);
    const vis = W.filter(k => k.includes('/pages/' + id + '/visuals/')).map(k => JSON.parse(window.__fs[k]));
    const reg = rep.resourcePackages.find(x => x.name === 'RegisteredResources').items.map(x => x.name);
    const bg = pg.objects.background[0].properties.image.image.url.expr.ResourcePackageItem.ItemName, png = window.__fs[R + 'StaticResources/RegisteredResources/' + bg];
    const boxes = LPB.boxes(state.L, state.look.style).length;
    return { n: pages.pageOrder.length, name: pg.displayName, size: pg.width + 'x' + pg.height, bg, reg: reg.includes(bg), png: png && png.byteLength ? 'PNG ' + png.byteLength + ' bytes, starts ' + Array.from(png.slice(1, 4)).map(c => String.fromCharCode(c)).join('') : 'missing',
      vis: vis.length, boxes, types: Array.from(new Set(vis.map(v => v.visual.visualType))).join(','), titled: vis.filter(v => v.visual.visualType !== 'textbox').every(v => v.visual.visualContainerObjects.title[0].properties.text || v.visual.visualContainerObjects.title[0].properties.show),
      inside: vis.every(v => v.position.x >= 0 && v.position.y >= 0 && v.position.x + v.position.width <= pg.width + 0.5 && v.position.y + v.position.height <= pg.height + 0.5),
      sample: JSON.stringify(vis.find(v => v.visual.visualType !== 'textbox')).slice(0, 400) };
  });
  console.log('pages', r.n, '(expect 11) | name', r.name, '| size', r.size, '| background', r.bg, 'registered', r.reg, '|', r.png);
  console.log('visuals', r.vis, '(expect', r.boxes + ') | types', r.types, '| titled', r.titled, '| all inside the page', r.inside);
  console.log('sample', r.sample);
  console.log('errors', errs); await b.close();
})();
