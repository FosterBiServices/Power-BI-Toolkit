from _env import open, S, P, ROOT
p=open(P+'prep-for-ai-writer.html').read().split('\n')
if p[3].startswith('<link rel="icon"'): p = p[:2] + [p[2] + '\n' + p[3]] + p[4:]
L=lambda a,b:'\n'.join(p[a-1:b])
tpl=open(S+'tb_template.js',encoding='utf-8').read(); tb=open(S+'tb_core.js').read(); ui=open(S+'tb_ui.js').read(); body=open(S+'tb_body.html').read()
head='<title>Theme Builder</title>\n<meta name="description" content="Build a complete Power BI report theme from one brand color: data palette, text, background, good and bad colors, font and visual styles, checked for readability and color blindness.">\n'+L(3,6)
css=L(7,217)+'\n'+L(303,312)+'''
/* ---------- Theme Builder ---------- */
.msg.info{background:var(--info-soft);color:var(--info)}
#checks{display:flex;flex-direction:column;gap:8px}
.cfg{display:flex;flex-wrap:wrap;gap:12px 22px;align-items:flex-end}
.cfg input[type=text]{width:260px;font-family:var(--sans)}
.seeds{display:flex;flex-wrap:wrap;gap:10px}
.seed,.sw{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:8px 10px}
.sw.changed{border-color:var(--accent);box-shadow:inset 0 -3px 0 var(--gold)}
.swatches{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px}
.crow-in{display:flex;gap:10px;align-items:center}
.cpick{flex:none;width:40px;height:40px;border-radius:8px;overflow:hidden;border:1px solid var(--line);cursor:pointer;display:block}
.cpick input{width:60px;height:60px;margin:-10px;border:0;padding:0;cursor:pointer;background:none}
.cmeta{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.clabel{font-size:12px;color:var(--muted)}
input.hex{width:100px!important;font-family:var(--mono);font-size:13px;padding:4px 7px}
input.hex.bad{border-color:var(--err);background:var(--err-soft)}
.cr{flex:none;font-size:11.5px;font-weight:600;border-radius:999px;padding:2px 8px;font-variant-numeric:tabular-nums}
.cr.ok{background:var(--ok-soft);color:var(--ok)}.cr.warn{background:var(--warn-soft);color:var(--warn)}.cr.err{background:var(--err-soft);color:var(--err)}
.ib{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:6px;width:30px;height:30px;cursor:pointer;flex:none}
.ib:hover{border-color:var(--err);color:var(--err)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media (max-width:760px){.grid2{grid-template-columns:1fr}}
.box{display:flex;flex-direction:column;gap:10px;border:1px solid var(--line);border-radius:12px;padding:14px;background:var(--surface-2)}
.box h3{margin:0}
.box .sub{font-weight:600;font-size:13.5px;margin:4px 0 -4px}
.box .sub .muted{font-weight:400}
.chip .dot.clear{background:repeating-conic-gradient(#ccc 0 25%,#fff 0 50%) 0 0/6px 6px!important}
.box .crow{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:8px 10px}
.box .crow[hidden]{display:none}
.box select{width:100%;max-width:100%}
.grid2>*{min-width:0}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip .dot{display:inline-block;width:12px;height:12px;border-radius:50%;border:1px solid rgba(0,0,0,.2);margin-right:3px;vertical-align:-1px}
.preview{border:1px solid var(--line);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px;overflow:hidden}
.pv-head{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}
.pv-h1{font-size:22px;font-weight:700}
.pv-slicer{display:flex;gap:6px}
.pv-slicer span{font-size:12px;padding:4px 10px;border-radius:4px}
.pv-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.pv-card{border-radius:8px;padding:10px 12px;box-shadow:0 1px 3px rgba(0,0,0,.12);text-align:center}
.pv-cl{font-size:12px}.pv-cv{font-size:24px;font-weight:700}
.pv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}
.pv-tile{border-radius:8px;padding:10px 12px;box-shadow:0 1px 3px rgba(0,0,0,.12);display:flex;flex-direction:column;gap:6px;min-width:0}
.pv-title{font-weight:700;font-size:14px}
.pv-svg{width:100%;height:auto;display:block}
.pv-table{width:100%;border-collapse:collapse;font-size:12.5px;color:inherit;background:transparent}
.pv-table th{text-align:left;padding:6px 8px;font-weight:600;border:0;text-transform:none;letter-spacing:0;font-size:12.5px;font-family:inherit}
.pv-table td{padding:6px 8px;border:0;background:transparent}
.pv-text{display:flex;flex-direction:column;gap:6px;font-size:13px}
@media (max-width:520px){.pv-cards{grid-template-columns:1fr}}
.out-head{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;justify-content:space-between}
.out-head .btns{display:flex;gap:8px;flex-wrap:wrap}
.fname{font-family:var(--mono);font-size:13px;color:var(--muted);overflow-wrap:anywhere}
'''
logo=p[318]
src=head+'\n'+css+'\n</style>\n\n<div class="wrap">\n\n  <header class="top">\n    <div class="brandbar">\n'+logo+'\n'+body+'\n<script>\n'+tpl+'\n'+tb+'\n'+ui+'</script>\n'
assert '</script>' not in (tpl+tb+ui).replace('<\\/script>','')
open(P+'theme-builder.html','w',encoding='utf-8').write(src)
print(len(src))
