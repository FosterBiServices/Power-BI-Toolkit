from _env import open, S, P, ROOT
p=open(P+'prep-for-ai-writer.html').read().split('\n')
if p[3].startswith('<link rel=\"icon\"'): p = p[:2] + [p[2] + '\n' + p[3]] + p[4:]
L=lambda a,b:'\n'.join(p[a-1:b])
core=open(S+'builder_core.js').read(); fp=open(S+'fp_core.js').read(); ex=open(S+'fp_ex.js').read(); ui=open(S+'fp_ui.js').read(); body=open(S+'fp_body.html').read()
head='<title>Field Parameter Builder</title>\n<meta name="description" content="Build a Power BI field parameter or a SWITCH measure selector from your model export, and get the TMDL script to add it.">\n'+L(3,6)
css=L(7,217)+'\n'+L(281,289)+'\n'+L(303,312)+'''
/* ---------- Field Parameter Builder ---------- */
.msg.info{background:var(--info-soft);color:var(--info)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.tabbar button[aria-checked="true"]{border:2px solid var(--accent);padding:11px 15px;background:var(--accent-soft);box-shadow:inset 0 -4px 0 var(--gold)}
.only-switch[hidden],#destBox[hidden],#groupNameWrap[hidden],#outBox[hidden],#selEmpty[hidden]{display:none!important}
.cfg{display:flex;flex-wrap:wrap;gap:12px 22px;align-items:flex-end}
.cfg input[type=text]{width:230px;font-family:var(--sans)}
.opts{display:flex;flex-wrap:wrap;gap:8px 22px;align-items:center}
.field.inline{display:inline-flex}
#groupName{width:160px;font-family:var(--sans)}
.picker2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:18px;align-items:start}
@media (max-width:820px){.picker2{grid-template-columns:1fr}}
.pane-l,.pane-r{display:flex;flex-direction:column;gap:8px;min-width:0}
.pick-head{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;justify-content:space-between}
.pick-head h3{margin:0}
.pick-head .search{flex:1;min-width:160px;font-family:var(--sans)}
.mlist{border:1px solid var(--line);border-radius:8px;max-height:420px;overflow:auto;background:var(--surface)}
.mrow2{display:grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:"k n a" "k m a";gap:1px 10px;align-items:center;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--line);padding:7px 12px;cursor:pointer;color:var(--ink);font:inherit}
.mrow2:last-child{border-bottom:0}
.mrow2:hover{background:var(--surface-2)}
.mrow2:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.mrow2 .kind{grid-area:k}.mrow2 .mname{grid-area:n}.mrow2 .mmeta{grid-area:m}.mrow2 .add{grid-area:a;font-size:12.5px;color:var(--accent);font-weight:600;white-space:nowrap}
.mrow2.added .add{color:var(--ok)}
.mname{font-family:var(--mono);font-size:13px;overflow-wrap:anywhere}
.mmeta{font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kind{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:5px;font-size:11px;font-weight:700}
.kind.measure{background:var(--accent-soft);color:var(--accent)}
.kind.column{background:var(--ok-soft);color:var(--ok)}
ol.sel{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.srow{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;border:1px solid var(--line);border-radius:8px;background:var(--surface);padding:8px 10px}
.srow.missing{border-color:color-mix(in srgb,var(--err) 45%,transparent)}
.ord{font-family:var(--mono);font-size:12px;color:var(--muted);width:20px;text-align:center}
.sbody{display:flex;flex-direction:column;gap:6px;min-width:0}
.sref{font-size:12.5px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;overflow-wrap:anywhere}
.sin{display:flex;gap:8px;flex-wrap:wrap}
.sin label{flex:1;min-width:120px;display:flex}
.sin input{width:100%;font-family:var(--sans)}
.sbtns{display:flex;gap:4px}
.ib{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:6px;width:30px;height:30px;cursor:pointer;font-size:14px;line-height:1}
.ib:hover:not(:disabled){border-color:var(--accent);color:var(--accent)}
.ib:disabled{opacity:.35;cursor:default}
.ib:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
@media (max-width:520px){.srow{grid-template-columns:minmax(0,1fr) auto}.ord{display:none}}
  .dest-hint{width:100%;font-size:12.5px}
.home-t{display:inline-block;padding:7px 0;font-size:13.5px}
#outBox{display:flex;flex-direction:column;gap:12px;min-width:0}
#outBox>*{min-width:0;max-width:100%}
#outBox h3{margin:6px 0 0}
#checks{display:flex;flex-direction:column;gap:8px}
'''
logo=p[318]
src=head+'\n'+css+'\n</style>\n\n<div class="wrap">\n\n  <header class="top">\n    <div class="brandbar">\n'+logo+'\n'+body+'\n<script>\n'+core+'\n'+fp+'\n'+ex+'\n'+ui+'</script>\n'
assert '</script>' not in (core+fp+ex+ui)
open(P+'field-parameter-builder.html','w').write(src)
print(len(src))
