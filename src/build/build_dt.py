import re
from _env import open, S, P, ROOT
p=open(P+'prep-for-ai-writer.html').read().split('\n')
if p[3].startswith('<link rel=\"icon\"'): p = p[:2] + [p[2] + '\n' + p[3]] + p[4:]
L=lambda a,b:'\n'.join(p[a-1:b])
mq=open(S+'mq_core.js').read()
a=mq.index('function mTokenize'); b=mq.index('function lineOf')
tok=mq[a:b]
core=open(S+'dt_core.js').read()
ui=open(S+'dt_ui.js').read()
body=open(S+'dt_body.html').read()
head='<title>Date Table Generator</title>\n<meta name="description" content="Build a Power BI date table with your fiscal year, weeks and holidays, as DAX, Power Query (M) or a TMDL script.">\n'+L(3,6)
css=L(7,217)+'\n'+L(175,176)+'\n'+L(219,265)+'\n'+L(303,312)+'''
.dt-finder{display:flex;flex-direction:column;gap:10px}
/* ---------- Date Table Generator ---------- */
.cfg{display:flex;flex-wrap:wrap;gap:14px 22px;align-items:flex-end}
.cfg[hidden],.field[hidden],.chk[hidden],.hpick[hidden]{display:none!important}
.flabel{font-size:12.5px;color:var(--muted);font-weight:500}
input.num{width:110px}
input[type=number],input[type=date]{font-family:var(--mono);font-size:14px;color:var(--ink);background:var(--code-bg);border:1px solid var(--line);border-radius:6px;padding:6px 9px}
input[type=number]:focus,input[type=date]:focus{outline:2px solid var(--accent);outline-offset:1px;border-color:transparent}
.chips .chip{font-family:var(--sans)}
.hpick{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:6px 16px;border:1px solid var(--line);border-radius:8px;padding:10px 12px;background:var(--surface)}
label.c{display:flex;gap:7px;align-items:center;font-size:14px}
label.c:has(input:disabled){color:var(--muted)}
.hprev .list-head{margin-bottom:6px}
.hprev h3{display:flex;gap:8px;align-items:center}
.hprev select{font-family:var(--cond);font-size:15px;font-weight:600}
tr.wkend td{color:var(--muted)}
.colgroups{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
fieldset.cgroup{border:1px solid var(--line);border-radius:10px;padding:8px 12px 12px;margin:0;display:flex;flex-direction:column;gap:6px;background:var(--surface)}
fieldset.cgroup legend{font-family:var(--cond);font-weight:600;font-size:14px;padding:0 6px;color:var(--accent)}
.jump{display:flex;gap:6px;flex-wrap:wrap}
details.extra{border:1px solid var(--line);border-radius:8px;background:var(--surface);margin-top:8px}
details.extra summary{cursor:pointer;padding:9px 12px;font-size:14px;font-weight:500}
.extra-body{padding:0 12px 12px;display:flex;flex-direction:column;gap:10px}
.dclist{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:4px 16px}
.dclist .dct{grid-column:1/-1;font-family:var(--cond);font-weight:600;font-size:13.5px;color:var(--accent);margin-top:6px}
#startColsWrap .codebox{max-width:none}
textarea.short-ta{min-height:64px;max-width:520px}
#startColsWrap{max-width:620px}
table.prev th,table.prev td{white-space:nowrap}
table.prev th.hid{font-style:italic}
table.prev tr.out td{opacity:.55}
table.prev tr.hol td{background:var(--warn-soft)}
.apply ol{margin-bottom:6px}
'''
logo=p[318]
src=head+'\n'+css+'\n</style>\n\n<div class="wrap">\n\n  <header class="top">\n    <div class="brandbar">\n'+logo+'\n'+body+'\n<script>\n'+tok+'\n'+core+'\n'+ui+'</script>\n'
open(P+'date-table-generator.html','w').write(src)
print(len(src))
