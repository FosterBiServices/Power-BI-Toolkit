from _env import open, S, P, ROOT
p=open(P+'prep-for-ai-writer.html').read().split('\n')
if p[3].startswith('<link rel=\"icon\"'): p = p[:2] + [p[2] + '\n' + p[3]] + p[4:]
body=open(S+'mq_body.html').read().replace('<footer>Runs in your browser. Nothing is sent anywhere; your entries are saved on this device only.</footer>','<footer>Everything runs in this page. Your queries and inputs are saved only in this browser.</footer>')
ui=open(S+'mq_ui.js').read()
core=open(S+'mq_core.js').read().replace('/*MQ-CORE-END*/', open(S+'mq_model.js').read()+'/*MQ-CORE-END*/')
L=lambda a,b:'\n'.join(p[a-1:b])
head='<title>Power Query Explainer</title>\n<meta name="description" content="Explain Power Query (M) queries step by step with Copilot, one query or the whole model, or get a cleaner version checked against the original.">\n'+L(3,6)
css=L(7,217)+'\n'+L(145,149)+'\n'+L(175,176)+'\n'+L(180,180)+'\n'+L(219,265)+'\n'+L(281,289)+'\n'+L(303,312)+'''
/* ---------- Power Query Explainer ---------- */
.tok-qid{color:var(--info)}
.modebar{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.modebar button{display:flex;flex-direction:column;gap:3px;text-align:left;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:12px;padding:12px 16px;cursor:pointer}
.modebar button .tn{font-family:var(--cond);font-weight:600;font-size:18px}
.modebar button .td{font-size:13px;color:var(--muted)}
.modebar button[aria-selected="true"]{border:2px solid var(--accent);padding:11px 15px;background:var(--accent-soft);box-shadow:inset 0 -4px 0 var(--gold)}
.modebar button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
@media (max-width:560px){.modebar{grid-template-columns:1fr}}
.mode{display:flex;flex-direction:column;gap:22px}
.mode[hidden]{display:none!important}
.smap td.n,.smap td.num{color:var(--muted);font-variant-numeric:tabular-nums;width:1%}
.smap td.uses{font-family:var(--mono);font-size:12.5px;color:var(--muted);overflow-wrap:anywhere}
.smap tr.flagged td.nm{color:var(--warn)}
.smap td .pill{margin:1px 0}
.mtable td.ck,.mtable th.ck{width:56px;text-align:center}
.mtable td.nm{white-space:normal;overflow-wrap:anywhere}
.mtable td.uses{overflow-wrap:normal;min-width:110px}
.mtable .why{display:block;font-family:var(--sans);font-size:11.5px;color:var(--muted)}
.mtable td.act{width:1%;text-align:right}
.mtable .btn{padding:3px 10px;font-size:12.5px}
.mcheck{display:flex;flex-direction:column;gap:14px}
.findings h3,.params h3,#clChanges h3{margin-bottom:8px}
.flist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.flist li{display:grid;grid-template-columns:86px minmax(0,1fr);gap:10px;align-items:start;border:1px solid var(--line);border-radius:8px;padding:9px 12px;background:var(--surface);font-size:14px}
.flist li .pill{justify-self:start;margin-top:2px}
.flist li p{color:var(--muted);font-size:13.5px;margin-top:2px}
@media (max-width:520px){.flist li{grid-template-columns:1fr;gap:4px}}
.snote{margin-top:4px;font-size:13px;color:var(--warn)}
.more{display:flex;flex-direction:column;gap:10px}
.more .lab{display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:500}
.more .lab .hint{font-weight:400;color:var(--muted)}
#exOut,#clOut,.mresults{display:flex;flex-direction:column;gap:14px}
#exOut[hidden],#clOut[hidden],.mresults[hidden]{display:none!important}
.mlist2{display:flex;flex-direction:column;gap:8px}
details.mq summary{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}
details.mq .mqn{font-family:var(--mono);font-size:13.5px;font-weight:500}
details.mq .codebox-bar .linkbtn{margin-right:4px}
.params{display:flex;flex-direction:column;gap:10px}
.changes{margin:0;padding-left:1.2em;display:flex;flex-direction:column;gap:3px;font-size:14px}
pre.diff{padding:8px 0}
.dl{display:block;padding:0 14px 0 0}
.dl .dm{display:inline-block;width:26px;text-align:center;color:var(--muted);user-select:none}
.dl.add{background:var(--ok-soft)}
.dl.add .dm{color:var(--ok)}
.dl.del{background:var(--err-soft);text-decoration:line-through;text-decoration-color:color-mix(in srgb,var(--err) 45%,transparent)}
.dl.del .dm{color:var(--err)}
'''
logo=p[318]
src=head+'\n'+css+'\n</style>\n\n<div class="wrap">\n\n  <header class="top">\n    <div class="brandbar">\n'+logo+'\n'+body+'\n<script>\n'+core+'\n'+ui+'</script>\n'
open(P+'power-query-explainer.html','w').write(src)
print(len(src))
