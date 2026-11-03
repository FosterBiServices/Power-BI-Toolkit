from _env import open, S, P, ROOT, SRC
p=open(P+'prep-for-ai-writer.html').read().split('\n')
if p[3].startswith('<link rel="icon"'): p = p[:2] + [p[2] + '\n' + p[3]] + p[4:]
L=lambda a,b:'\n'.join(p[a-1:b])
import json, glob, os
# the fx function library (src/fx/*.pq, tested in Desktop with fxTests.pq), by name
fxdir=os.path.join(SRC,'fx')
fxcode={os.path.basename(f)[:-3]:open(f).read().replace('\r','').strip() for f in sorted(glob.glob(os.path.join(fxdir,'fx*.pq'))) if not f.endswith('fxTests.pq')}
assert len(fxcode)==9, sorted(fxcode)
mq=open(S+'mq_core.js').read(); pw='const PWF_CODE = '+json.dumps(fxcode, ensure_ascii=False).replace('</','<\\/')+';\n'+open(S+'pw_fx.js').read()+'\n'+open(S+'pw_core.js').read()+'\n'+open(S+'pw_lint.js').read(); ex=open(S+'pw_ex.js').read(); ui=open(S+'pw_ui.js').read(); body=open(S+'pw_body.html').read()
head='<title>Power Query Writer</title>\n<meta name="description" content="Describe a Power Query query in plain words and get a Copilot prompt that writes it short, maintainable and formatted, then check the reply.">\n'+L(3,6)
css=L(7,217)+'\n'+L(145,149)+'\n'+L(175,176)+'\n'+L(180,180)+'\n'+L(219,265)+'\n'+L(281,289)+'\n'+L(303,312)+'''
/* ---------- Power Query Writer ---------- */
.tok-qid{color:var(--info)}
.msg.info{background:var(--info-soft);color:var(--info)}
.btn.small{padding:4px 10px;font-size:13px}
input.txt{font-family:var(--sans);font-size:14px;width:100%}
textarea.short{min-height:80px}
.step-body>.seg{align-self:flex-start}
.grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:12px 14px}
.grid2[hidden]{display:none}
h3.sub{margin:6px 0 0;font-size:15.5px}
.lab{display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:500}
.lab .hint{font-weight:400;color:var(--muted)}
.chips .chip small{font-family:var(--sans)}
.result{display:flex;flex-direction:column;gap:14px}
.result[hidden]{display:none!important}
.flist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.flist li{display:grid;grid-template-columns:70px minmax(0,1fr);gap:10px;align-items:start;border:1px solid var(--line);border-radius:8px;padding:9px 12px;background:var(--surface);font-size:14px}
.flist li .pill{justify-self:start;margin-top:2px}
.flist li p{color:var(--muted);font-size:13.5px;margin:2px 0 0}
.flist .mono{font-family:var(--mono);font-size:12.5px;color:var(--muted)}
table.steps td.mono{font-family:var(--mono);font-size:13px;white-space:nowrap}
ul.qs{margin:4px 0 6px 18px;padding:0}
a.btn{text-decoration:none;display:inline-flex;align-items:center}
.codebox-bar .r{display:flex;gap:6px;flex-wrap:wrap}
.recipes{display:flex;flex-direction:column;gap:8px}
.recipe{border:1px solid var(--line);border-radius:8px;padding:8px 12px;background:var(--surface)}
.recipe>.opts{margin:0}
.recipe .rbody{display:flex;flex-direction:column;gap:8px;margin:8px 0 2px 24px}
.recipe .rbody[hidden]{display:none}
.colpick{display:flex;flex-wrap:wrap;gap:6px}
.colpick button{font:inherit;font-size:12.5px;padding:3px 9px;border:1px solid var(--line);border-radius:999px;background:var(--bg);color:var(--ink);cursor:pointer;max-width:100%;overflow-wrap:anywhere}
.colpick button[aria-pressed=true]{background:var(--info-soft);border-color:var(--info);color:var(--info);font-weight:600}
.recipe .row{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;font-size:13.5px}
.recipe .row input.txt{width:auto;min-width:0;flex:1 1 140px;max-width:240px}
.recipe select{font:inherit;font-size:13.5px}
@media (max-width:640px){.recipe .rbody{margin-left:0}.grid2{grid-template-columns:minmax(0,1fr)}.flist li{grid-template-columns:1fr;gap:4px}table.steps td.mono{white-space:normal;overflow-wrap:anywhere}}
'''
logo=p[318]
src=head+'\n'+css+'\n</style>\n\n<div class="wrap">\n\n  <header class="top">\n    <div class="brandbar">\n'+logo+'\n'+body+'\n<script>\n'+mq+'\n'+pw+'\n'+ex+'\n'+ui+'</script>\n'
assert '</script>' not in (mq+pw+ex+ui)
open(P+'power-query-writer.html','w').write(src)
print(len(src))
