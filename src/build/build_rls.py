from _env import open, S, P, ROOT
p=open(P+'prep-for-ai-writer.html').read().split('\n')
if p[3].startswith('<link rel="icon"'): p = p[:2] + [p[2] + '\n' + p[3]] + p[4:]
L=lambda a,b:'\n'.join(p[a-1:b])
core=open(S+'builder_core.js').read(); rl=open(S+'rls_core.js').read(); ex=open(S+'rls_ex.js').read(); ui=open(S+'rls_ui.js').read(); body=open(S+'rls_body.html').read()
head='<title>RLS Role Generator</title>\n<meta name="description" content="Build Power BI row-level security roles from your model export: fixed values, per-user rows or an access table, as a TMDL script with a test query.">\n'+L(3,6)
css=L(7,217)+'\n'+L(303,312)+'''
/* ---------- RLS Role Generator ---------- */
.msg.info{background:var(--info-soft);color:var(--info)}
.btn.small{padding:4px 10px;font-size:13px}
.kinds{margin:0;padding-left:1.2em;display:flex;flex-direction:column;gap:6px;font-size:14px;line-height:1.5}
.kinds code{font-family:var(--mono);font-size:12.5px}
#roles{display:flex;flex-direction:column;gap:14px}
.role{border:1px solid var(--line);border-radius:12px;background:var(--surface-2);padding:14px;display:flex;flex-direction:column;gap:12px;min-width:0}
.role-head{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:flex-end;justify-content:space-between}
.role-head .grow{flex:1;min-width:200px}
.role-head input{width:100%;max-width:360px;font-family:var(--sans);font-size:16px;font-weight:600}
.role-head .btns{display:flex;gap:6px}
ol.rules{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.rule{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:10px;min-width:0}
.rule-head{display:flex;align-items:center;gap:10px}
.rn{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--accent-soft);color:var(--accent);font-size:12px;font-weight:700}
.rt{font-weight:600;font-size:14px;flex:1}
.rrow{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:flex-end}
.rrow .field{flex:1;min-width:170px}
.rule input[type=text],.rule select{width:100%;font-family:var(--sans)}
.rule textarea{width:100%;font-family:var(--mono);font-size:13px;min-height:70px;resize:vertical}
.rule textarea.dax{min-height:90px}
.chk{display:flex;gap:8px;align-items:flex-start;font-size:13.5px}
.chk input{margin-top:3px;accent-color:var(--accent)}
.ib{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:6px;width:28px;height:28px;cursor:pointer;flex:none}
.ib:hover{border-color:var(--err);color:var(--err)}
.ib:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.addrule{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.reach-in{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:13px}
.reach-in .rl{font-weight:600;color:var(--muted);margin-right:2px}
.reach-in .rl:not(:first-child){margin-left:8px}
.tchip{border-radius:999px;padding:2px 10px;font-size:12.5px;font-family:var(--mono);border:1px solid transparent}
.tchip.d{background:var(--accent);color:#fff}
.tchip.v{background:var(--accent-soft);color:var(--accent);border-color:color-mix(in srgb,var(--accent) 30%,transparent)}
.tchip.o{background:var(--surface);color:var(--muted);border-color:var(--line)}
.rchecks{display:flex;flex-direction:column;gap:6px}
.rchecks:empty,.reach:empty{display:none}
#outBox{display:flex;flex-direction:column;gap:14px;min-width:0}
#outBox[hidden]{display:none!important}
#outBox>*{min-width:0;max-width:100%}
#testUser{width:300px;max-width:100%;font-family:var(--sans)}
'''
logo=p[318]
src=head+'\n'+css+'\n</style>\n\n<div class="wrap">\n\n  <header class="top">\n    <div class="brandbar">\n'+logo+'\n'+body+'\n<script>\n'+core+'\n'+rl+'\n'+ex+'\n'+ui+'</script>\n'
assert '</script>' not in (core+rl+ex+ui)
open(P+'rls-role-generator.html','w').write(src)
print(len(src))
