from _env import open, S, P, ROOT
p=open(P+'prep-for-ai-writer.html').read().split('\n')
if p[3].startswith('<link rel=\"icon\"'): p = p[:2] + [p[2] + '\n' + p[3]] + p[4:]
L=lambda a,b:'\n'.join(p[a-1:b])
core=open(S+'builder_core.js').read(); rv=open(S+'rv_core.js').read(); ex=open(S+'ex_rows.js').read(); ui=open(S+'rv_ui.js').read(); body=open(S+'rv_body.html').read()
head='<title>DAX Reviewer</title>\n<meta name="description" content="Review a Power BI DAX measure against your own checklist: instant checks on the page, a full review from Copilot, and a tested rewrite.">\n'+L(3,6)
css=L(7,217)+'\n'+L(145,149)+'\n'+L(175,176)+'\n'+L(219,265)+'\n'+L(303,312)+'''
.dr-model{display:flex;flex-direction:column;gap:10px}
/* ---------- DAX Reviewer ---------- */
.cfg{display:flex;flex-wrap:wrap;gap:12px 22px;align-items:flex-end}
.rules{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:10px;background:var(--surface);overflow:hidden}
.rule{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 16px;align-items:start;padding:9px 12px;border-bottom:1px solid var(--line)}
.rule:last-child{border-bottom:0}
.rule.off{opacity:.55}
.rchk{display:flex;gap:10px;align-items:flex-start;font-size:14px;cursor:pointer}
.rchk input{margin-top:3px;flex:none}
.rchk b{display:block;font-weight:600}
.rtext{display:block;font-size:12.5px;color:var(--muted);line-height:1.45;margin-top:1px}
.rmeta{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.rmeta select{font-size:12.5px;padding:3px 6px}
.by{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;border-radius:999px;padding:2px 8px;white-space:nowrap}
.by.page{background:var(--ok-soft);color:var(--ok)}
.by.ai{background:var(--info-soft);color:var(--info)}
@media (max-width:600px){.rule{grid-template-columns:1fr}.rmeta{justify-content:flex-start;padding-left:25px}}
.addrule{display:flex;flex-direction:column;gap:8px;border:1px dashed var(--line);border-radius:10px;padding:12px}
.addrule .field.grow input{width:100%;font-family:var(--sans)}
textarea.short-ta{min-height:60px;font-family:var(--sans);font-size:14px}
label.lab{display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:500}
label.lab .hint{font-weight:400;color:var(--muted)}
.flist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.flist li{display:grid;grid-template-columns:74px minmax(0,1fr);gap:10px;align-items:start;border:1px solid var(--line);border-radius:8px;padding:9px 12px;background:var(--surface);font-size:14px}
.flist li .pill{justify-self:start;margin-top:2px}
.flist li p{margin-top:3px;color:var(--ink);font-size:13.5px}
.flist li > div{min-width:0}
.flist li.dismissed{opacity:.6}
.flist li.dismissed > div > b:first-child{text-decoration:line-through}
.flist .dis{color:var(--info)!important}
code.where{display:block;margin-top:4px;font-size:12.5px;background:var(--code-bg);border:1px solid var(--line);border-radius:6px;padding:4px 8px;overflow-x:auto;white-space:pre}
@media (max-width:520px){.flist li{grid-template-columns:1fr;gap:4px}}
pre.numbered{padding:8px 0}
pre.numbered .ln{display:block;padding:0 14px 0 0}
pre.numbered .ln.hit{background:var(--warn-soft)}
pre.numbered .no{display:inline-block;width:38px;text-align:right;padding-right:12px;color:var(--muted);user-select:none}
.report{display:flex;flex-direction:column;gap:14px}
.report[hidden],#rewriteBox[hidden]{display:none!important}
#rewriteBox{display:flex;flex-direction:column;gap:12px}
.changes{margin:0;padding-left:1.2em;display:flex;flex-direction:column;gap:3px;font-size:14px}
pre.diff{padding:8px 0}
.dl{display:block;padding:0 14px 0 0}
.dl .dm{display:inline-block;width:26px;text-align:center;color:var(--muted);user-select:none}
.dl.add{background:var(--ok-soft)}
.dl.del{background:var(--err-soft);text-decoration:line-through;text-decoration-color:color-mix(in srgb,var(--err) 45%,transparent)}
#tBy{width:100%}
#pickM{max-width:100%;min-width:280px}
.scanwrap{max-height:420px;overflow:auto}
table.scan td.num{text-align:center;font-variant-numeric:tabular-nums;width:1%}
table.scan td.hi{color:var(--err);font-weight:600}
table.scan td.rl{font-size:12.5px;color:var(--muted)}
table.scan td.nm{white-space:normal;overflow-wrap:anywhere}
#scanFilter{width:260px;font-family:var(--sans)}
#scanBox[hidden],#pickWrap[hidden]{display:none!important}
'''
logo=p[318]
src=head+'\n'+css+'\n</style>\n\n<div class="wrap">\n\n  <header class="top">\n    <div class="brandbar">\n'+logo+'\n'+body+'\n<script>\n'+core+'\n'+rv+'\n'+ex+'\n'+ui+'</script>\n'
open(P+'dax-reviewer.html','w').write(src)
print(len(src))
