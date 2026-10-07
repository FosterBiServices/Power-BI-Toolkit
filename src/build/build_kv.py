from _env import open, S, P, ROOT
p=open(P+'prep-for-ai-writer.html').read().split('\n')
if p[3].startswith('<link rel=\"icon\"'): p = p[:2] + [p[2] + '\n' + p[3]] + p[4:]
L=lambda a,b:'\n'.join(p[a-1:b])
core=open(S+'builder_core.js').read(); kv=open(S+'kv_core.js').read(); ex=open(S+'kv_ex.js').read(); ui=open(S+'kv_ui.js').read(); body=open(S+'kv_body.html').read()
head='<title>KPI Visualizer</title>\n<meta name="description" content="Compare ways to show a Power BI KPI: cards, bullet charts, sparklines, progress bars and more, with build steps and SVG measures as a TMDL script.">\n'+L(3,6)
css=L(7,217)+'\n'+L(281,289)+'\n'+L(303,312)+'''
/* ---------- KPI Visualizer ---------- */
.msg.info{background:var(--info-soft);color:var(--info)}
.kv-modes{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center}
.kv-modes .lbl{font-size:13.5px;color:var(--muted);font-weight:500}
.kv-kpis{display:flex;flex-direction:column;gap:12px}
.kv-ed{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:10px 14px 12px;display:flex;flex-direction:column;gap:10px;min-width:0}
.kv-ed-head{display:flex;justify-content:space-between;align-items:center}
.kv-fields{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,180px),1fr));gap:10px 14px}
.kv-fields .field.wide{grid-column:1/-1}
.kv-fields input,.kv-fields select{width:100%;font-family:var(--sans)}
.kv-pv summary{cursor:pointer;font-size:13.5px;color:var(--accent);font-weight:500}
.kv-pv .kv-fields{margin-top:10px}
.ib{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:6px;width:30px;height:30px;cursor:pointer;font-size:14px;line-height:1}
.ib:hover{border-color:var(--accent);color:var(--accent)}
.ib:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.reply-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
#pickBox{display:flex;flex-direction:column;gap:8px}
#pickBox .search{font-family:var(--sans);max-width:360px}
.mlist{border:1px solid var(--line);border-radius:8px;max-height:320px;overflow:auto;background:var(--surface)}
.mrow2{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"n a" "m a";gap:1px 10px;align-items:center;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid var(--line);padding:7px 12px;cursor:pointer;color:var(--ink);font:inherit}
.mrow2:last-child{border-bottom:0}
.mrow2:hover{background:var(--surface-2)}
.mrow2:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.mrow2 .mname{grid-area:n;font-family:var(--mono);font-size:13px;overflow-wrap:anywhere}
.mrow2 .mmeta{grid-area:m;font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mrow2 .add{grid-area:a;font-size:12.5px;color:var(--accent);font-weight:600;white-space:nowrap}
.mrow2.added .add{color:var(--ok)}
.kv-colors{display:flex;flex-direction:column;gap:8px}
.kv-crow{display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center;border:1px solid var(--line);border-radius:8px;background:var(--surface);padding:8px 12px}
.kv-cname{font-weight:600;width:64px}
.kv-cin{display:inline-flex;gap:6px;align-items:center;font-size:13px}
.kv-cin input[type=color]{width:34px;height:26px;padding:0;border:1px solid var(--line);border-radius:4px;background:none}
.inline-f span{display:flex;gap:8px;align-items:center;font-size:13.5px;flex-wrap:wrap}
.kv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr));gap:14px}
.kv-opt{display:flex;flex-direction:column;gap:8px;border:1px solid var(--line);border-radius:12px;background:var(--surface);padding:14px;min-width:0}
.kv-opt.wide{grid-column:1/-1}
.kv-opt.on{border:2px solid var(--accent);padding:13px;box-shadow:inset 0 -4px 0 var(--gold)}
.kv-opt.off{opacity:.75;border-style:dashed}
.kv-opt .btn{align-self:flex-start;margin-top:auto}
.kv-opt p{margin:0}
.kv-opt-head{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;justify-content:space-between}
.kv-opt-head h3{margin:0;font-size:16px}
.kv-canvas{background:#F3F2F1;border-radius:8px;padding:12px;display:flex;justify-content:center;min-width:0;overflow:hidden;color:#252423}
.kv-card{background:#FFFFFF;border-radius:6px;padding:10px 14px;display:flex;flex-direction:column;gap:4px;min-width:150px;max-width:100%;box-shadow:0 1px 2px rgba(0,0,0,.12);font-family:"Segoe UI",var(--sans)}
.kv-cl{font-size:12px;color:#605E5C}
.kv-cv{font-size:26px;font-weight:600;line-height:1.15;color:#252423;font-variant-numeric:tabular-nums}
.kv-sub{font-size:11.5px;color:#605E5C}
.kv-ctx{font-size:12px;color:#605E5C}
.kv-intent select{max-width:100%}
.kv-ctxbox{display:flex;flex-direction:column;gap:8px;border-top:1px dashed var(--line);padding-top:10px}
.kv-ctxbox.closed{flex-direction:row;flex-wrap:wrap;align-items:center;gap:6px 10px}
.kv-ctxbox h4{margin:0;font-size:14px}.kv-ctxbox p{margin:0}
.kv-ctxed{display:flex;gap:8px;align-items:flex-start;background:var(--surface-2);border-radius:8px;padding:8px 10px}
.kv-ctxed .kv-fields{flex:1;min-width:0}
.kv-grouphead{grid-column:1/-1;display:flex;flex-direction:column;gap:2px;margin-top:6px}
.kv-grouphead h3{margin:0;font-size:16px}.kv-grouphead p{margin:0}
.kv-ttl{font-size:14px;font-weight:600;color:#252423}
.kv-subt{font-size:12px;color:#605E5C;margin-bottom:2px}
.kv-tipwrap{display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap}
.kv-tip{background:#FFFFFF;border:1px solid #C8C6C4;border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,.18);padding:6px 10px;font-size:12px;display:flex;flex-direction:column;gap:3px;margin-top:18px}
.kv-tip div{display:flex;gap:14px;justify-content:space-between}.kv-tip span{color:#605E5C}.kv-tip b{font-weight:600;color:#252423}
.kv-svg{line-height:0}
.kv-svg svg{max-width:100%;height:auto}
.kv-row{display:flex;gap:10px;align-items:center}
.kv-lab{display:inline-block;align-self:flex-start;font-size:12px;font-weight:600;border-radius:4px;padding:2px 7px;white-space:nowrap}
.kv-lab.sm{font-size:11px;padding:1px 6px}
.kv-lab:not(.pill){padding-left:0;padding-right:0}
.kv-html{overflow-x:auto;max-width:100%}
.kv-html>div{box-shadow:0 1px 2px rgba(0,0,0,.12);border-radius:6px}
.kv-kpi{position:relative;min-height:56px;display:flex;align-items:center}
.kv-kpi .kv-area{position:absolute;inset:auto 0 0 0;opacity:.8}
.kv-kpi .kv-cv{position:relative}
.kv-ic{font-size:16px}
.kv-area{line-height:0;margin-top:4px}
.kv-strip{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;width:100%}
.kv-strip .kv-card{flex:1 1 150px}
.kv-strip .kv-lab{white-space:normal}
.kv-tablewrap{width:100%;overflow-x:auto}
.kv-table{border-collapse:collapse;background:#FFFFFF;font-family:"Segoe UI",var(--sans);font-size:13px;width:100%;color:#252423}
.kv-table th{text-align:left;font-weight:600;color:#605E5C;font-size:12px;border-bottom:1px solid #C8C6C4;padding:6px 8px}
.kv-table td{border-bottom:1px solid #EDEBE9;padding:4px 8px;vertical-align:middle;white-space:nowrap}
.kv-table td.num{text-align:right;font-variant-numeric:tabular-nums}
.kv-table svg{display:block}
.kv-h3{margin:0;font-size:15px}
.kv-nmc{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin:0;font-size:13px}
.kv-nmc dt{font-weight:600;color:var(--accent)}
.kv-nmc dd{margin:0;color:var(--muted)}
.cfg{display:flex;flex-wrap:wrap;gap:12px 22px;align-items:flex-end}
.cfg input[type=text]{width:230px;max-width:100%;font-family:var(--sans)}
.kv-steps{display:flex;flex-direction:column;gap:8px;padding-left:1.3em;margin:0;max-width:80ch}
.kv-steps ul{margin:6px 0 0;padding-left:1.2em;display:flex;flex-direction:column;gap:4px}
.kv-setup{display:flex;flex-direction:column;gap:16px}
#setupHead{font-size:18px;margin:10px 0 0}
.kv-grp{display:flex;flex-direction:column;gap:8px}
.kv-grp h4{margin:0;font-family:var(--cond);font-size:16px;color:var(--accent)}
.kv-grp p{margin:0;max-width:80ch}
#outBox{display:flex;flex-direction:column;gap:12px;min-width:0}
#outBox>*{min-width:0;max-width:100%}
#outBox h3{margin:6px 0 0}
#checks{display:flex;flex-direction:column;gap:8px}
#kpiPickWrap select{max-width:320px}
'''
logo=p[318]
src=head+'\n'+css+'\n</style>\n\n<div class="wrap">\n\n  <header class="top">\n    <div class="brandbar">\n'+logo+'\n'+body+'\n<script>\n'+core+'\n'+kv+'\n'+ex+'\n'+ui+'</script>\n'
assert '</script>' not in (core+kv+ex+ui)
open(P+'kpi-visualizer.html','w').write(src)
print(len(src))
