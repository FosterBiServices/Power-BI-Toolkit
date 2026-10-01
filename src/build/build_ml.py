from _env import open, S, P, ROOT
p=open(P+'prep-for-ai-writer.html').read().split('\n')
if p[3].startswith('<link rel="icon"'): p = p[:2] + [p[2] + '\n' + p[3]] + p[4:]
L=lambda a,b:'\n'.join(p[a-1:b])
core=open(S+'builder_core.js').read(); ml=open(S+'ml_core.js').read(); ex=open(S+'ml_ex.js').read(); ui=open(S+'ml_ui.js').read(); body=open(S+'ml_body.html').read()
head='<title>Model Linter</title>\n<meta name="description" content="Best-practice checks on a Power BI model export: display folders, format strings, visible keys, bidirectional relationships, implicit measures and unused columns.">\n'+L(3,6)
css=L(7,217)+'\n'+L(303,312)+'''
/* ---------- Model Linter ---------- */
.msg.info{background:var(--info-soft);color:var(--info)}
.btn.small{padding:4px 10px;font-size:13px}
.rules{display:flex;flex-direction:column;gap:8px}
.rule{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:10px 14px;display:flex;flex-direction:column;gap:4px}
.rule.is-off,.rule.needs{background:var(--surface-2)}
.rule.needs .rule-t{color:var(--muted)}
.rules-h{margin:10px 0 0;font-size:15px}
.subopt input[type=number]{width:64px;font-family:var(--sans);font-size:13.5px;padding:3px 6px;border:1px solid var(--line);border-radius:6px;background:var(--code-bg);color:var(--ink)}
.rule.is-off .rule-t,.rule.is-off .rule-why{color:var(--muted)}
.rule-main{display:flex;align-items:center;gap:10px;cursor:pointer;flex-wrap:wrap}
.rule-main input{width:18px;height:18px;accent-color:var(--accent);margin:0}
.rule-t{font-weight:600;font-size:15px}
.rule-why{margin:0 0 0 28px;font-size:13.5px;color:var(--muted);line-height:1.5;max-width:80ch}
.subopt{margin:4px 0 0 28px;font-size:13.5px;display:flex;gap:8px;align-items:flex-start}
.subopt input{margin-top:3px;accent-color:var(--accent)}
.cnt{display:inline-block;min-width:24px;text-align:center;font-size:12px;font-weight:700;border-radius:999px;padding:2px 8px}
.cnt.bad{background:var(--warn-soft);color:var(--warn)}
.cnt.ok{background:var(--ok-soft);color:var(--ok)}
.cnt.off{background:var(--surface-2);color:var(--muted);border:1px solid var(--line);font-weight:500}
.sev{display:inline-block;width:10px;height:10px;border-radius:50%;flex:none;vertical-align:0}
.sev.warn{background:var(--warn)}
.sev.info{background:var(--info)}
.okc{color:var(--ok)}
.sum-bar{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;justify-content:space-between;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:10px 14px}
.sum-bar .btns{display:flex;gap:8px;flex-wrap:wrap}
#results{display:flex;flex-direction:column;gap:10px}
.grp{border:1px solid var(--line);border-radius:10px;background:var(--surface);min-width:0}
.grp.pass{padding:10px 14px;display:flex;flex-direction:column;gap:8px}
.grp-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px}
details.grp>summary.grp-head{padding:10px 14px;cursor:pointer;list-style:none}
details.grp>summary::-webkit-details-marker{display:none}
details.grp>summary::before{content:"\\25B8";color:var(--muted);font-size:12px;transition:transform .15s}
details.grp[open]>summary::before{transform:rotate(90deg)}
details.grp>summary:focus-visible{outline:2px solid var(--accent);outline-offset:-2px;border-radius:10px}
.grp-t{font-weight:600;font-size:15px}
.grp-act{margin-left:auto;display:flex;gap:6px}
.grp-body{padding:0 14px 12px;display:flex;flex-direction:column;gap:10px;min-width:0}
.fix{font-size:13.5px;line-height:1.55;background:var(--surface-2);border-radius:8px;padding:8px 12px}
.fix code{font-family:var(--mono);font-size:12.5px}
ul.fl{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.f{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 2px;border-top:1px solid var(--line)}
.f .sev{margin-top:2px}
.f.ign{opacity:.55}
.f-body{min-width:0;display:flex;flex-direction:column;gap:2px}
.f-obj{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.f-obj .mono{font-family:var(--mono);font-size:13px;overflow-wrap:anywhere}
.f-det{font-size:13px;color:var(--muted);line-height:1.45}
.kindtag{font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);border:1px solid var(--line);border-radius:4px;padding:1px 5px}
.repbox{border:1px dashed var(--line);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;background:var(--surface)}
.rep-head{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;justify-content:space-between}
.rep-head h3{margin:0}
.rep-head .btns{display:flex;gap:8px;flex-wrap:wrap}
.repbox .note{margin:0;max-width:85ch}
.whererow input.txt{font-family:var(--sans);width:420px;max-width:100%}
ul.wl{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
ul.wl li{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
ul.wl .mono{font-family:var(--mono);font-size:13px;overflow-wrap:anywhere}
.f-btns{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.reppick{display:flex;flex-direction:column;gap:6px;margin-bottom:8px}
.reppick p{margin:0}
.reprow{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--line);border-radius:8px;padding:7px 10px;cursor:pointer;font-size:14px}
.reprow:has(input:checked){border-color:var(--accent);background:var(--accent-soft)}
.reprow input{margin-top:3px;accent-color:var(--accent)}
.fit{font-size:11.5px;font-weight:600;border-radius:999px;padding:1px 8px;background:var(--info-soft);color:var(--info);white-space:nowrap}
.fit.ok{background:var(--accent-soft);color:var(--accent)}
.fit.off{background:var(--surface-2);color:var(--muted);border:1px solid var(--line)}
.drop{border:1px dashed var(--line);border-radius:8px;padding:10px;text-align:center;font-size:13px;color:var(--muted)}
.drop.over{border-color:var(--accent);background:var(--accent-soft);color:var(--accent)}
@media (max-width:520px){.grp-act{margin-left:0;width:100%}.f{grid-template-columns:auto minmax(0,1fr)}.f .btn{grid-column:2;justify-self:start}}
'''
logo=p[318]
src=head+'\n'+css+'\n</style>\n\n<div class="wrap">\n\n  <header class="top">\n    <div class="brandbar">\n'+logo+'\n'+body+'\n<script>\n'+core+'\n'+ml+'\n'+ex+'\n'+ui+'</script>\n'
assert '</script>' not in (core+ml+ex+ui)
open(P+'model-linter.html','w').write(src)
print(len(src))
