from _env import open, S, P, ROOT
p=open(P+'prep-for-ai-writer.html').read().split('\n')
if p[3].startswith('<link rel="icon"'): p = p[:2] + [p[2] + '\n' + p[3]] + p[4:]
L=lambda a,b:'\n'.join(p[a-1:b])
core=open(S+'builder_core.js').read(); ti=open(S+'ti_core.js').read(); ex=open(S+'fp_ex.js').read(); ui=open(S+'ti_ui.js').read(); body=open(S+'ti_body.html').read()
head='<title>Time Intelligence Builder</title>\n<meta name="description" content="Build Power BI time intelligence (YTD, last year, growth, rolling 12 months) as measures or a calculation group, from your model export, as a TMDL script.">\n'+L(3,6)
css=L(7,217)+'\n'+L(281,289)+'\n'+L(303,312)+'''
/* ---------- Time Intelligence Builder ---------- */
.msg.info{background:var(--info-soft);color:var(--info)}
.tabbar button[aria-checked="true"]{border:2px solid var(--accent);padding:11px 15px;background:var(--accent-soft);box-shadow:inset 0 -4px 0 var(--gold)}
.only-measures[hidden],.only-group[hidden],#outBox[hidden],#destBox[hidden]{display:none!important}
.dest-hint{width:100%;font-size:12.5px}
.dest select{max-width:100%}
.cfg{display:flex;flex-wrap:wrap;gap:12px 22px;align-items:flex-end}
.cfg.col{flex-direction:column;align-items:stretch}
.cfg input[type=text]{width:230px;font-family:var(--sans)}
.cfg input[type=number]{width:90px;font-family:var(--mono);font-size:14px;background:var(--code-bg);border:1px solid var(--line);border-radius:6px;padding:6px 9px;color:var(--ink)}
.cfg select{max-width:100%}
.opts{display:flex;flex-wrap:wrap;gap:8px 22px;align-items:center}
.opts .hint{font-size:12.5px;color:var(--muted)}
.calcs{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px}
.calc{display:flex;flex-direction:column;gap:6px;border:1px solid var(--line);border-radius:10px;padding:9px 11px;background:var(--surface)}
.calc.on{border-color:var(--accent);background:var(--accent-soft)}
.calc .ck{display:flex;gap:8px;align-items:flex-start;cursor:pointer;font-size:14px}
.calc .ck input{margin-top:3px}
.calc .cd{display:block;font-size:12px;color:var(--muted)}
.calc .cname{width:100%;font-family:var(--sans);font-size:13px;padding:5px 8px}
.calc .cname:disabled{opacity:.5}
.sub{display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--line);padding-top:14px}
.sub h3{margin:0}
.picker2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;align-items:start}
@media (max-width:820px){.picker2{grid-template-columns:1fr}}
.pane-l,.pane-r{display:flex;flex-direction:column;gap:8px;min-width:0}
.pane-l .search{width:100%;font-family:var(--sans)}
.mlist{border:1px solid var(--line);border-radius:8px;max-height:360px;overflow:auto;background:var(--surface)}
.mrow{display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-areas:"c n" "c m";gap:1px 10px;align-items:center;padding:7px 12px;border-bottom:1px solid var(--line);cursor:pointer;font-size:14px}
.mrow:last-child{border-bottom:0}
.mrow:hover{background:var(--surface-2)}
.mrow input{grid-area:c}.mrow .mname{grid-area:n}.mrow .mmeta{grid-area:m}
.mname{font-family:var(--mono);font-size:13px;overflow-wrap:anywhere}
.mmeta{font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#outBox{display:flex;flex-direction:column;gap:12px;min-width:0}
#outBox>*,.part>*{min-width:0;max-width:100%}
.part{display:flex;flex-direction:column;gap:12px}
#outBox h3{margin:6px 0 0}
#checks,#dateMsg{display:flex;flex-direction:column;gap:8px}
'''
logo=p[318]
src=head+'\n'+css+'\n</style>\n\n<div class="wrap">\n\n  <header class="top">\n    <div class="brandbar">\n'+logo+'\n'+body+'\n<script>\n'+core+'\n'+ti+'\n'+ex+'\n'+ui+'</script>\n'
assert '</script>' not in (core+ti+ex+ui)
open(P+'time-intelligence-builder.html','w').write(src)
print(len(src))
