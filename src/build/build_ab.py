from _env import open, S, P, ROOT
p=open(P+'prep-for-ai-writer.html').read().split('\n')
if p[3].startswith('<link rel="icon"'): p = p[:2] + [p[2] + '\n' + p[3]] + p[4:]
L=lambda a,b:'\n'.join(p[a-1:b])
core=open(S+'builder_core.js').read(); ab=open(S+'ab_core.js').read(); ex=open(S+'ab_ex.js').read(); ui=open(S+'ab_ui.js').read(); body=open(S+'ab_body.html').read()
head='<title>About This Report</title>\n<meta name="description" content="Suggestions for a Power BI report\'s About page: what to include and why, with plain-language drafts from your model, data sources, and an optional HTML measure.">\n'+L(3,6)
css=L(7,217)+'\n'+L(303,312)+'''
/* ---------- About This Report ---------- */
.msg.info{background:var(--info-soft);color:var(--info)}
.msg ul{margin:4px 0 4px 18px;padding:0}
.btn.small{padding:4px 10px;font-size:13px}
.btn[disabled]{opacity:.45;cursor:default}
input.txt{font-family:var(--sans);font-size:14px;width:100%}
input[type=number]{font-family:var(--sans);font-size:14px;color:var(--ink);background:var(--code-bg);border:1px solid var(--line);border-radius:6px;padding:6px 8px;width:80px}
textarea.short{min-height:74px}
.more2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
.addbox{border:1px dashed var(--line);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;background:var(--surface);min-width:0}
.addbox h3{margin:0;font-size:16px}
.addbox .note{margin:0}
.addbox .btns{display:flex;gap:8px;flex-wrap:wrap}
.drop{border:1px dashed var(--line);border-radius:8px;padding:10px;text-align:center;font-size:13px;color:var(--muted)}
.drop.over{border-color:var(--accent);background:var(--accent-soft);color:var(--accent)}
.basics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 16px}
.basics .wide{grid-column:1/-1}
.basics .chips .chip{font-family:var(--sans);font-size:13.5px;cursor:pointer}
.addaud,.addsrc{display:flex;gap:8px;align-items:center;margin-top:6px;max-width:520px}
.sum-bar{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;justify-content:space-between;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:10px 14px;font-size:14px}
.sum-bar .btns,.out-bar .btns{display:flex;gap:8px;flex-wrap:wrap}
.secs{display:flex;flex-direction:column;gap:10px}
.sec{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:12px 14px;display:flex;flex-direction:column;gap:6px;min-width:0}
.sec.is-off{background:var(--surface-2)}
.sec.is-off .sec-t,.sec.is-off .sec-why{color:var(--muted)}
.sec-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px}
.sec-main{display:flex;align-items:center;gap:10px;cursor:pointer}
.sec-main input{width:18px;height:18px;accent-color:var(--accent);margin:0}
.sec-t{font-weight:600;font-size:15.5px}
.tag{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;border-radius:4px;padding:2px 6px}
.tag.rec{background:var(--accent-soft);color:var(--accent)}
.tag.opt{border:1px solid var(--line);color:var(--muted)}
.sec-title{margin-left:auto;display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted)}
.sec-title input.txt{width:190px;font-size:13px;padding:4px 8px}
.sec.is-off .sec-title{display:none}
.sec-why{margin:0 0 0 28px;font-size:13.5px;color:var(--muted);line-height:1.5;max-width:82ch}
.sec-body{display:flex;flex-direction:column;gap:8px;margin-left:28px;min-width:0}
.sec-body .note{margin:0}
textarea.draft{font-family:var(--sans);font-size:14.5px;line-height:1.5;min-height:0}
.alts{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.alts:empty{display:none}
.alts-l{font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;width:100%}
.alt{font-family:var(--sans);font-size:13px;text-align:left;border:1px dashed var(--line);background:var(--surface);color:var(--ink);border-radius:8px;padding:6px 10px;cursor:pointer;max-width:100%;line-height:1.4}
.alt:hover{border-color:var(--accent);background:var(--accent-soft)}
.alt.add{border-radius:999px}
.kset{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;font-size:13.5px}
.kset label{display:flex;gap:6px;align-items:center}
.krow,.srow{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:start;padding:8px 0;border-top:1px solid var(--line)}
.krow>input,.srow>input{width:18px;height:18px;margin-top:8px;accent-color:var(--accent)}
.krow.is-off .kfields,.srow.is-off .kfields{opacity:.55}
.kfields{display:grid;grid-template-columns:minmax(140px,1fr) minmax(0,2fr);gap:6px 8px;min-width:0}
.srow .kfields{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.kwhy{grid-column:1/-1;font-size:12.5px;color:var(--muted);line-height:1.45}
.kwhy .mono{font-size:12px}
.hintw{color:var(--info)}
.kbtns{display:flex;gap:6px;margin-top:4px}
details.more{margin-top:4px}
ul.cand{list-style:none;margin:0;padding:0}
ul.cand li{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:6px 0;border-top:1px solid var(--line);font-size:14px}
ul.cand li.ex b{font-weight:500;color:var(--muted)}
.airow{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-top:1px solid var(--line);padding:8px 0;font-size:14px}
.aival{margin-top:2px;line-height:1.5}
.aival ul{margin:0;padding-left:18px}
.out-bar{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;justify-content:space-between}
.about{background:#FFFFFF;color:#1F2937;border:1px solid var(--line);border-radius:10px;padding:18px 22px;font-size:15px;line-height:1.55;max-width:820px}
.about h3.ab-name{margin:0 0 4px;font-size:21px;color:#1F3A5F}
.about h4{margin:16px 0 4px;font-size:15.5px;color:#1F3A5F}
.about h4:first-child{margin-top:0}
.about p{margin:0}
.about ul{margin:0;padding-left:20px}
.about li{margin:0 0 3px}
.ab-callout{background:#EDF1F6;border-left:4px solid #1F3A5F;border-radius:8px;padding:10px 12px;margin:14px 0 2px}
.ab-callout b{color:#1F3A5F}
.ab-chips{display:flex;flex-wrap:wrap;gap:6px}
.ab-chips span{padding:3px 10px;border-radius:12px;font-size:14px}
.ab-chips small{opacity:.8}
.ab-chips .c0{background:#E8EEF7;color:#1F3A5F}.ab-chips .c1{background:#EEE8F7;color:#4B2E83}.ab-chips .c2{background:#E2F1F3;color:#0F5E66}.ab-chips .c3{background:#E6F0FA;color:#1D5B94}.ab-chips .c4{background:#F0ECF8;color:#5B3E96}
.html-prev{padding:10px 12px}
.hgrid2{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 14px}
.colrow{display:flex;gap:6px;align-items:center}
.colrow input[type=color]{width:38px;height:34px;border:1px solid var(--line);border-radius:6px;background:var(--surface);padding:2px;flex:none}
.codebox-bar .r{display:flex;gap:6px;flex-wrap:wrap}
@media (max-width:640px){.basics,.hgrid2{grid-template-columns:minmax(0,1fr)}.sec-why,.sec-body{margin-left:0}.sec-title{margin-left:0;width:100%}.sec-title input.txt{flex:1;width:auto}.kfields,.srow .kfields{grid-template-columns:minmax(0,1fr)}.krow,.srow{grid-template-columns:auto minmax(0,1fr)}.kbtns{grid-column:2}.about{padding:14px}}
'''
logo=p[318]
src=head+'\n'+css+'\n</style>\n\n<div class="wrap">\n\n  <header class="top">\n    <div class="brandbar">\n'+logo+'\n'+body+'\n<script>\n'+core+'\n'+ab+'\n'+ex+'\n'+ui+'</script>\n'
assert '</script>' not in (core+ab+ex+ui)
open(P+'about-this-report.html','w').write(src)
print(len(src))
