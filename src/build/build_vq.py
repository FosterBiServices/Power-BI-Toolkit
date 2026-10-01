from _env import open, S, P, ROOT
p=open(P+'prep-for-ai-writer.html').read().split('\n')
if p[3].startswith('<link rel=\"icon\"'): p = p[:2] + [p[2] + '\n' + p[3]] + p[4:]
L=lambda a,b:'\n'.join(p[a-1:b])
core=open(S+'builder_core.js').read()
vq=open(S+'vq_core.js').read()
ex=open(S+'ex_rows.js').read()
ui=open(S+'vq_ui.js').read()
body=open(S+'vq_body.html').read()
head='<title>Validation Query Builder</title>\n<meta name="description" content="Build DAX queries that validate Power BI measures, totals, relationships and tables, from your own model export.">\n'+L(3,6)
css=L(7,217)+'\n'+L(175,176)+'\n'+L(219,265)+'\n'+L(303,312)+'''
/* ---------- Validation Query Builder ---------- */
.checks{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}
.checks button{display:flex;flex-direction:column;gap:4px;text-align:left;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:12px;padding:12px 14px;cursor:pointer}
.checks .tn{font-family:var(--cond);font-weight:600;font-size:16.5px}
.checks .td{font-size:12.5px;color:var(--muted);line-height:1.45}
.checks button[aria-checked="true"]{border:2px solid var(--accent);padding:11px 13px;background:var(--accent-soft);box-shadow:inset 0 -4px 0 var(--gold)}
.checks button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.setup{display:flex;flex-direction:column;gap:16px}
.cfg{display:flex;flex-wrap:wrap;gap:12px 22px;align-items:flex-end}
.flabel{font-size:12.5px;color:var(--muted);font-weight:500}
input.num,input[type=number]{font-family:var(--mono);font-size:14px;color:var(--ink);background:var(--code-bg);border:1px solid var(--line);border-radius:6px;padding:6px 9px;width:110px}
.field .note{font-size:12.5px}
.pick{display:flex;flex-direction:column;gap:6px}
.pick-head{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center}
.pick-head .search{width:240px;font-family:var(--sans)}
.pick .mlist{max-height:260px}
.pick .mrow{grid-template-columns:auto minmax(0,1fr) auto}
.addrow select{min-width:260px}
.tchips{margin-top:6px}
.filters-box{display:flex;flex-direction:column;gap:8px;border:1px solid var(--line);border-radius:10px;padding:12px;background:var(--surface)}
.frow{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.frow input[type=text]{width:150px;font-family:var(--sans)}
.frow input.wide{width:260px}
.frow select{max-width:260px}
.pair .pnum{font-family:var(--cond);font-weight:600;color:var(--gold-ink);background:var(--gold);border-radius:50%;width:22px;height:22px;display:grid;place-items:center;font-size:12.5px;flex:none}
.pair select{max-width:230px}
.filters-box .linkbtn{align-self:flex-start}
.rlist{border:1px solid var(--line);border-radius:8px;background:var(--surface);max-height:320px;overflow:auto}
.rrow{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:7px 12px;border-bottom:1px solid var(--line);font-size:14px;cursor:pointer}
.rrow:last-child{border-bottom:0}
#outs{display:flex;flex-direction:column;gap:14px}
#work{display:flex;flex-direction:column;gap:22px}
#work[hidden]{display:none!important}
'''
logo=p[318]
src=head+'\n'+css+'\n</style>\n\n<div class="wrap">\n\n  <header class="top">\n    <div class="brandbar">\n'+logo+'\n'+body+'\n<script>\n'+core+'\n'+vq+'\n'+ex+'\n'+ui+'</script>\n'
open(P+'validation-query-builder.html','w').write(src)
print(len(src))
