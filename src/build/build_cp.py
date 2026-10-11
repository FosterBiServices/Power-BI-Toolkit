from _env import open, S, P, ROOT
p=open(P+'prep-for-ai-writer.html').read().split('\n')
if p[3].startswith('<link rel=\"icon\"'): p = p[:2] + [p[2] + '\n' + p[3]] + p[4:]
L=lambda a,b:'\n'.join(p[a-1:b])
core=open(S+'builder_core.js').read(); cp=open(S+'cp_core.js').read(); ex=open(S+'cp_ex.js').read(); ui=open(S+'cp_ui.js').read(); body=open(S+'cp_body.html').read()
head='<title>Chart Patterns</title>\n<meta name="description" content="Power BI bar, column and line charts with extra labels, bubbles, paging or a highlighted time window: the measures as a TMDL script and the steps to build each chart.">\n'+L(3,6)
css=L(7,217)+'\n'+L(281,289)+'\n'+L(303,312)+'''
/* ---------- Chart Patterns ---------- */
.msg.info{background:var(--info-soft);color:var(--info)}
.reply-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.cp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:14px}
.cp-grouphead{grid-column:1/-1;display:flex;flex-direction:column;gap:2px;margin-top:6px}
.cp-grouphead h3{margin:0;font-size:16px}.cp-grouphead p{margin:0}
.cp-opt{display:flex;flex-direction:column;gap:8px;border:1px solid var(--line);border-radius:12px;background:var(--surface);padding:14px;min-width:0}
.cp-opt.on{border:2px solid var(--accent);padding:13px;box-shadow:inset 0 -4px 0 var(--gold)}
.cp-opt p{margin:0}
.cp-opt .btn{align-self:flex-start;margin-top:auto}
.cp-opt-head{display:flex;flex-direction:column;gap:2px}
.cp-opt-head h3{margin:0;font-size:16px}
.cp-canvas{background:#FFFFFF;border:1px solid var(--line);border-radius:8px;padding:10px;min-width:0;overflow:hidden;font-family:"Segoe UI",var(--sans)}
.cp-canvas svg{display:block;width:100%;height:auto;max-height:280px}
.cp-canvas.sm svg{max-height:170px}
.cp-fields{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr));gap:10px 16px}
.cp-fields input{width:100%;font-family:var(--sans)}
.cp-look{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:18px;align-items:start}
@media (max-width:760px){.cp-look{grid-template-columns:1fr}}
.cp-lookset{display:flex;flex-direction:column;gap:12px;min-width:0}
.cp-lookset .lbl{display:block;font-size:13.5px;font-weight:500;margin-bottom:4px}
.cp-colors{display:flex;flex-direction:column;gap:8px}
.cp-crow{display:flex;flex-wrap:wrap;gap:8px;align-items:center;border:1px solid var(--line);border-radius:8px;background:var(--surface);padding:6px 10px;font-size:13.5px}
.cp-crow input[type=color]{width:34px;height:26px;padding:0;border:1px solid var(--line);border-radius:4px;background:none}
.cp-crow .hex{width:96px;font-family:var(--mono);font-size:13px}
.cp-crow .hex.bad{border-color:var(--err)}
.cp-extra{display:flex;flex-wrap:wrap;gap:10px 16px}
.cp-extra input[type=number]{width:110px}
#outBox{display:flex;flex-direction:column;gap:10px;min-width:0}
#outBox>*{min-width:0;max-width:100%}
#outBox h3{margin:10px 0 0}
#outBox .note{margin:0}
#checks{display:flex;flex-direction:column;gap:8px}
.cp-steps{display:flex;flex-direction:column;gap:8px;padding-left:1.3em;margin:0;max-width:85ch}
.cp-grp{display:flex;flex-direction:column;gap:8px;margin-bottom:8px}
.cp-grp h4{margin:0;font-family:var(--cond);font-size:16px;color:var(--accent)}
.cp-sw{display:inline-block;width:12px;height:12px;border-radius:3px;border:1px solid rgba(0,0,0,.25);vertical-align:-1px;margin-right:4px}
.cp-pre{margin:6px 0;white-space:pre;overflow-x:auto}
.cp-theme{display:flex;flex-direction:column;gap:10px;border:1px solid var(--line);border-left:4px solid var(--warn);border-radius:10px;padding:12px 14px;background:var(--surface)}
.cp-theme h3{margin:0!important}
.cp-theme p{margin:0}
.cp-file{display:inline-flex;margin-left:6px}
.cp-check{margin:0;padding-left:1.3em;display:flex;flex-direction:column;gap:4px;max-width:85ch}
'''
logo=p[318]
src=head+'\n'+css+'\n</style>\n\n<div class="wrap">\n\n  <header class="top">\n    <div class="brandbar">\n'+logo+'\n'+body+'\n<script>\n'+core+'\n'+cp+'\n'+ex+'\n'+ui+'</script>\n'
assert '</script>' not in (core+cp+ex+ui)
open(P+'chart-patterns.html','w').write(src)
print(len(src))
