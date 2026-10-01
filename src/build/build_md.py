from _env import open, S, P, ROOT
p=open(P+'prep-for-ai-writer.html').read().split('\n')
if p[3].startswith('<link rel=\"icon\"'): p = p[:2] + [p[2] + '\n' + p[3]] + p[4:]
L=lambda a,b:'\n'.join(p[a-1:b])
core=open(S+'builder_core.js').read(); md=open(S+'md_core.js').read(); ex=open(S+'md_example.js').read(); ui=open(S+'md_ui.js').read(); body=open(S+'md_body.html').read()
head='<title>Model Documenter</title>\n<meta name="description" content="Turn a Power BI project (PBIP) or model export into one HTML document: tables, measures, lineage, relationships, sources, model checks and report pages.">\n'+L(3,6)
css=L(7,217)+'\n'+L(281,289)+'\n'+L(303,312)+'''
/* ---------- Model Documenter ---------- */
.msg.info{background:var(--info-soft);color:var(--info)}
.drop{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;border:2px dashed var(--line);border-radius:12px;padding:18px;background:var(--surface)}
.drop.over{border-color:var(--accent);background:var(--accent-soft)}
#projWrap[hidden],#outBox[hidden],#outWait[hidden]{display:none!important}
#projPick{max-width:100%;min-width:280px}
#exName{width:260px;font-family:var(--sans)}
.opts-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px 18px}
.opts-grid label{display:flex;gap:8px;align-items:flex-start;font-size:14px;cursor:pointer;flex-wrap:wrap}
.opts-grid input{margin-top:3px}
.opts-grid .hint{font-size:12px;color:var(--muted)}
.opts-grid .hint[hidden]{display:none}
#outBox{display:flex;flex-direction:column;gap:12px}
.out-head{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;justify-content:space-between}
.out-head .btns{display:flex;gap:8px;flex-wrap:wrap}
.fname{font-family:var(--mono);font-size:13px;color:var(--muted);overflow-wrap:anywhere}
.stat.bad b{color:var(--err)}
#preview{width:100%;height:75vh;min-height:480px;border:1px solid var(--line);border-radius:10px;background:#fafaf8}
'''
logo=p[318]
src=head+'\n'+css+'\n</style>\n\n<div class="wrap">\n\n  <header class="top">\n    <div class="brandbar">\n'+logo+'\n'+body+'\n<script>\n'+core+'\n'+md+'\n'+ex+'\n'+ui+'</script>\n'
open(P+'model-documenter.html','w').write(src)
print(len(src))
