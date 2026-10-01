from _env import open, S, P, ROOT
p=open(P+'prep-for-ai-writer.html').read().split('\n')
if p[3].startswith('<link rel="icon"'): p = p[:2] + [p[2] + '\n' + p[3]] + p[4:]
L=lambda a,b:'\n'.join(p[a-1:b])
tb=open(S+'tb_core.js').read(); lo=open(S+'lo_core.js').read(); lr=open(S+'lo_render.js').read(); lx=open(S+'lo_out.js').read(); lp=open(S+'lo_pptx.js').read(); ls=open(S+'lo_suggest.js').read(); ui=open(S+'lo_ui.js').read(); body=open(S+'lo_body.html').read()
head='<title>Layout Designer</title>\n<meta name="description" content="Plan a Power BI report page on an even grid: wireframe with sample visuals, exact positions and a designed background image.">\n'+L(3,6)
css=L(7,217)+'\n'+L(303,312)+'''
/* ---------- Layout Designer ---------- */
.msg.info{background:var(--info-soft);color:var(--info)}
.btn.small{padding:4px 10px;font-size:13px}
.cfg{display:flex;flex-wrap:wrap;gap:12px 22px;align-items:flex-end}
.cfg input[type=text]{width:240px;max-width:100%;font-family:var(--sans)}
.field.sm input{width:90px}
input[type=number]{font-family:var(--sans)}
.chk{display:flex;gap:8px;align-items:center;font-size:14px}
.chk.inline{padding-bottom:8px}
.chk input{accent-color:var(--accent);width:16px;height:16px;margin:0}
.sub{margin:4px 0 0;font-size:15px}
.areas{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
@media (max-width:760px){.areas{grid-template-columns:1fr}}
.area{border:1px solid var(--line);border-radius:10px;background:var(--surface-2);padding:12px 14px;display:flex;flex-direction:column;gap:10px;min-width:0}
.area select{width:100%}
.pair{display:flex;gap:12px;flex-wrap:wrap}
.pair[hidden]{display:none}
.hdrbox{border:1px solid var(--line);border-radius:12px;background:var(--surface-2);padding:14px;display:flex;flex-direction:column;gap:12px}
.hdrbox[hidden]{display:none}
.hdrbox .sub{margin:0}
.hdrbox .note{margin:0}
.hgrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
@media (max-width:1000px){.hgrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:560px){.hgrid{grid-template-columns:1fr}}
.hcol{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:10px;min-width:0}
.hcol h4{margin:0;font-size:14px;font-weight:700}
.hcol h4 .chk{font-weight:700}
.hcol input[type=text]{width:100%;font-family:var(--sans)}
.hcol.off>*:not(h4){opacity:.45;pointer-events:none}
.logo-more{display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.logo-more[hidden]{display:none}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.filebtn{cursor:pointer}
input:focus-visible + .filebtn,.filebtn:focus-within{outline:2px solid var(--accent);outline-offset:2px}
.chk.small{font-size:13px}
.lim{margin:0}
.suggest{border:1px solid var(--accent);border-left:4px solid var(--accent);border-radius:10px;background:var(--surface)}
.suggest>summary{cursor:pointer;padding:12px 14px;font-size:15px}
.suggest>summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.suggest-body{padding:0 14px 14px;display:flex;flex-direction:column;gap:12px}
.suggest-body .note{margin:0;max-width:95ch}
.sgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
@media (max-width:820px){.sgrid{grid-template-columns:1fr}}
.sq{border:1px solid var(--line);border-radius:10px;background:var(--surface-2);padding:10px 12px;display:flex;flex-direction:column;gap:10px;min-width:0;margin:0}
.sq legend{font-weight:700;font-size:14px;padding:0 4px}
.sq select{width:100%}
.sg-out{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.sg-out:empty{display:none}
.sg{border:1px solid var(--line);border-radius:10px;background:var(--surface-2);padding:12px;display:flex;flex-direction:column;gap:8px;min-width:0}
.sg.rec{border-color:var(--accent);box-shadow:inset 0 3px 0 var(--gold)}
.sg h4{margin:0;font-size:15px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.sg .rec-tag{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;background:var(--accent);color:#fff;border-radius:999px;padding:2px 8px}
.sg .blurb{margin:0;font-size:13.5px;color:var(--muted)}
.sg svg{width:100%;height:auto;display:block;border:1px solid var(--line);border-radius:6px}
.sg ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px;font-size:13px;line-height:1.45}
.sg li b{display:inline-block;min-width:46px;border-radius:999px;padding:1px 7px;margin-right:6px;color:#fff;text-align:center;font-size:11.5px}
.sg li b.z3{background:#0B7A75}.sg li b.z30{background:#1F6FB2}.sg li b.z300{background:#5B3E96}
.sg .msg{font-size:12.5px}
.sg-note{grid-column:1/-1}
.pptx-card{flex-direction:row;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 20px}
.pptx-txt{flex:1;min-width:240px;display:flex;flex-direction:column;gap:6px}
.pptx-txt h3{margin:0}
.shadowbox{border:1px solid var(--line);border-radius:10px;background:var(--surface-2);padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.shadowbox .cfg[hidden]{display:none}
.crow-in{display:flex;gap:8px;align-items:center}
.cpick.sm{width:30px;height:30px}
.lim:empty{display:none}
.lim.hit{color:var(--warn);font-weight:600}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.designer{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:14px;align-items:start}
@media (max-width:900px){.designer{grid-template-columns:1fr}}
.canvas-wrap{min-width:0}
.canvas svg{width:100%;height:auto;display:block;border:1px solid var(--line);border-radius:8px;background:#fff}
.canvas .vis,.canvas .cell{cursor:pointer;outline:none}
.canvas .vis:hover rect:last-child{stroke:var(--gold);stroke-width:2}
.canvas .vis:focus-visible rect:last-child,.canvas .cell:focus-visible rect{stroke:var(--gold);stroke-width:3;stroke-dasharray:none}
.editor{border:1px solid var(--line);border-radius:10px;background:var(--surface-2);padding:12px;display:flex;flex-direction:column;gap:10px;min-width:0}
.editor h3{margin:0}
.editor input[type=text],.editor select{width:100%;font-family:var(--sans)}
.grid2e{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.grid2e input{width:100%}
.editor .btns,.quick{display:flex;flex-wrap:wrap;gap:6px}
.quick{border-top:1px solid var(--line);padding-top:10px}
.danger-t{color:var(--err)}
.mono{font-family:var(--mono)}
.msgs{display:flex;flex-direction:column;gap:6px}
.msgs:empty{display:none}
.colors{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px}
.crow{display:flex;gap:10px;align-items:center;border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:8px 10px}
.crow.changed{border-color:var(--accent);box-shadow:inset 0 -3px 0 var(--gold)}
.cpick{flex:none;width:36px;height:36px;border-radius:8px;overflow:hidden;border:1px solid var(--line);cursor:pointer;display:block}
.cpick input{width:56px;height:56px;margin:-10px;border:0;padding:0;cursor:pointer;background:none}
.cmeta{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.clabel{font-size:12px;color:var(--muted)}
input.hex{width:100px!important;font-family:var(--mono);font-size:13px;padding:4px 7px}
input.hex.bad{border-color:var(--err);background:var(--err-soft)}
.sw-data{display:flex;gap:4px;align-items:center;grid-column:1/-1;flex-wrap:wrap}
.sw-data span:not(.small){width:22px;height:22px;border-radius:5px;border:1px solid rgba(0,0,0,.12)}
.sw-data .small{margin-left:6px}
#srcBox{display:flex;flex-direction:column;gap:8px}
#srcBox textarea{min-height:110px}
.figma{display:flex}
label.chk.figma{align-items:flex-start;border:1px dashed var(--line);border-radius:10px;padding:10px 12px}
label.chk.figma input{margin-top:3px}
.figma-only{display:none!important}
body.figma .figma-only{display:revert!important}
body.figma .figma-box{display:flex!important}
.figma-box{flex-direction:column;gap:6px;border:1px solid var(--line);border-radius:10px;padding:12px 14px;background:var(--surface-2)}
.figma-box h3{margin:0}
.outs{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
.out-card{border:1px solid var(--line);border-radius:12px;background:var(--surface);padding:12px;display:flex;flex-direction:column;gap:10px;min-width:0}
.out-card h3{margin:0}
.out-card .note{margin:0}
.thumb svg{width:100%;height:auto;display:block;border:1px solid var(--line);border-radius:6px}
.btns{display:flex;flex-wrap:wrap;gap:8px}
.tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:8px}
table.pos{border-collapse:collapse;width:100%;font-size:13px;background:var(--surface)}
table.pos th,table.pos td{padding:6px 10px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap}
table.pos td.num,table.pos th:nth-child(n+3){text-align:right;font-variant-numeric:tabular-nums;font-family:var(--mono);font-size:12.5px}
.apply code{font-family:var(--mono);font-size:12.5px}

'''
logo=p[318]
src=head+'\n'+css+'\n</style>\n\n<div class="wrap">\n\n  <header class="top">\n    <div class="brandbar">\n'+logo+'\n'+body+'\n<script>\n'+tb+'\n'+lo+'\n'+lr+'\n'+lx+'\n'+lp+'\n'+ls+'\n'+ui+'</script>\n'
assert '</script>' not in (tb+lo+lr+lx+lp+ls+ui)
open(P+'layout-designer.html','w').write(src)
print(len(src))
