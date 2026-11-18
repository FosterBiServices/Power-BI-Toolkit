from _env import open, S, P, ROOT
p=open(P+'prep-for-ai-writer.html').read().split('\n')
if p[3].startswith('<link rel="icon"'): p = p[:2] + [p[2] + '\n' + p[3]] + p[4:]
L=lambda a,b:'\n'.join(p[a-1:b])
core=open(S+'builder_core.js').read(); rp=open(S+'rp_core.js').read(); ex=open(S+'rp_ex.js').read(); ui=open(S+'rp_ui.js').read(); body=open(S+'rp_body.html').read()
head='<title>Relationship Planner</title>\n<meta name="description" content="How filters flow through a Power BI model, in plain words: which tables each table filters and why not, what-if relationship changes, goals checked with tested fixes, and ambiguous routes found.">\n'+L(3,6)
css=L(7,217)+'\n'+L(303,312)+'''
/* ---------- Relationship Planner ---------- */
.btn.small{padding:4px 10px;font-size:13px}
.lbl{font-size:13px;font-weight:600;color:var(--muted)}
.warntext{color:var(--warn)}
.okc{color:var(--ok)}
.healthbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.healthbar .hl{font-family:var(--cond);font-weight:600;font-size:15px;margin-right:4px}
.stat.warnstat{background:var(--warn-soft);color:var(--warn);border-color:color-mix(in srgb,var(--warn) 35%,transparent)}
.amblist{display:flex;flex-direction:column;gap:6px}
#health{display:flex;flex-direction:column;gap:10px}
details.adv{border:1px solid var(--line);border-radius:8px;background:var(--surface);min-width:0}
details.adv>summary{padding:7px 12px;cursor:pointer;overflow-wrap:anywhere}
details.adv[open]>summary{border-bottom:1px solid var(--line)}
.adv-body{padding:8px 12px 10px;display:flex;flex-direction:column;gap:6px;min-width:0}
.adv-body p{margin:0;overflow-wrap:anywhere}
.adv-body .mono{font-family:var(--mono);font-size:12.5px}
.fix-h{margin-top:4px!important}
.fixrow{display:flex;gap:10px;align-items:center;justify-content:space-between;border:1px solid var(--line);border-radius:8px;padding:7px 10px;flex-wrap:wrap}
.fixrow>div{min-width:0;flex:1 1 240px;overflow-wrap:anywhere}
.fixrow.best{border-color:color-mix(in srgb,var(--ok) 45%,transparent);background:var(--ok-soft)}
.pickrow{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center}
.pickrow select{max-width:100%;min-width:0}
.flowsum{margin:0}
.hops{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start}
.hop{flex:1 1 170px;min-width:0;display:flex;flex-direction:column;gap:6px}
.hop.src{flex:0 1 170px}
.hop-h{font-size:11.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
.tcard{border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:8px;background:var(--surface);padding:6px 10px;display:flex;flex-direction:column;gap:1px;min-width:0;overflow-wrap:anywhere}
.tcard.src{border-left-color:var(--gold);background:var(--accent-soft)}
.tcard.amb{border-left-color:var(--warn);background:var(--warn-soft)}
.tcard.chg{border-style:dashed}
.tcard .role{font-size:11.5px;color:var(--muted)}
.tcard .via{font-size:12.5px;color:var(--muted)}
.ambtag{font-size:11px;font-weight:700;color:var(--warn)}
.nr-h{margin:8px 0 2px;font-weight:600;font-size:14px}
ul.nr{margin:0;padding-left:1.1em;display:flex;flex-direction:column;gap:3px;font-size:14px}
ul.nr li{overflow-wrap:anywhere}
ul.rels{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px;font-size:14px}
ul.rels li{overflow-wrap:anywhere}
ul.rels li.off{opacity:.65}
ul.rels .mono{font-family:var(--mono);font-size:12.5px}
.chlist{margin:0;padding-left:1.4em;display:flex;flex-direction:column;gap:6px}
.chlist li{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.chlist li>span{min-width:0;flex:1 1 220px;overflow-wrap:anywhere}
.chlist li.skip>span{color:var(--muted)}
.addbox{border:1px dashed var(--line);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:10px;background:var(--surface)}
.addrow2{display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center}
.addrow2 select,.addrow2 input{max-width:100%;min-width:0}
.addgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.addgrid[hidden]{display:none}
.fld{display:flex;flex-direction:column;gap:4px;min-width:0}
.fld input[type=text],.addrow2 input[type=text]{font-family:var(--sans);font-size:14px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--code-bg);color:var(--ink);width:100%;min-width:0;box-sizing:border-box}
.addrow2 input[type=text]{width:220px}
details.extra.inner{background:var(--surface-2)}
.carry{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:4px 12px;font-size:13.5px}
.ck{display:flex;gap:6px;align-items:baseline;overflow-wrap:anywhere;min-width:0}
.ck input{accent-color:var(--accent)}
.planhead{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between}
.planhead p{margin:0;flex:1 1 260px}
table.plan td.how{font-size:13px;overflow-wrap:anywhere}
table.plan .mono{font-family:var(--mono);font-size:12px}
tr.pl-link td:first-child{border-left:3px solid var(--ok)}
tr.pl-conflict td:first-child,tr.pl-unreached td:first-child{border-left:3px solid var(--warn)}
.fix{font-size:13.5px;line-height:1.55;background:var(--surface-2);border-radius:8px;padding:8px 12px;display:flex;flex-direction:column;gap:6px}
.fix p,.fix ul{margin:0}
.fix ul{padding-left:1.2em;display:flex;flex-direction:column;gap:4px}
.effect{background:var(--surface-2);border-radius:10px;padding:10px 14px;font-size:14px}
.effect p{margin:0 0 4px}
.effect ul{margin:0;padding-left:1.2em;display:flex;flex-direction:column;gap:3px;overflow-wrap:anywhere}
.quick{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.quick select{width:auto;max-width:100%;min-width:0}
.pickrow select,.addrow2 select{width:auto}
#goalResults{display:flex;flex-direction:column;gap:10px}
.goal{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:10px 14px;display:flex;flex-direction:column;gap:6px;min-width:0}
.goal.fail{border-left:4px solid var(--warn)}
.goal.pass{border-left:4px solid var(--ok)}
.goal.unk{border-left:4px solid var(--info)}
.goal p{margin:0}
.goal-h{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:baseline}
.gl{font-weight:600;flex:1 1 220px;min-width:0;overflow-wrap:anywhere}
.gsum{font-size:13px;color:var(--muted)}
.mark{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;font-size:12px;font-weight:700;flex:none}
.mark.ok{background:var(--ok-soft);color:var(--ok)}
.mark.no{background:var(--warn-soft);color:var(--warn)}
.mark.q{background:var(--info-soft);color:var(--info)}
details.okl>summary{cursor:pointer;color:var(--ok)}
.goal .tip{margin-top:4px}
#planOut{display:flex;flex-direction:column;gap:10px}
#planOut>p{margin:0}
.opts2{display:flex;flex-direction:column;gap:8px}
.opt{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--line);border-radius:10px;padding:9px 12px;cursor:pointer;background:var(--surface);min-width:0}
.opt.on{border-color:var(--accent);background:var(--accent-soft)}
.opt input{margin-top:4px;accent-color:var(--accent);flex:none}
.opt-b{display:flex;flex-direction:column;gap:3px;min-width:0;overflow-wrap:anywhere}
@media (max-width:520px){.hop,.hop.src{flex:1 1 100%}.addrow2 input[type=text]{width:100%}}
'''
logo=p[318]
src=head+'\n'+css+'\n</style>\n\n<div class="wrap">\n\n  <header class="top">\n    <div class="brandbar">\n'+logo+'\n'+body+'\n<script>\n'+core+'\n'+rp+'\n'+ex+'\n'+ui+'</script>\n'
assert '</script>' not in (core+rp+ex+ui)
open(P+'relationship-planner.html','w').write(src)
print(len(src))
