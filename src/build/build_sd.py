from _env import open, S, P, ROOT
p=open(P+'prep-for-ai-writer.html').read().split('\n')
if p[3].startswith('<link rel="icon"'): p = p[:2] + [p[2] + '\n' + p[3]] + p[4:]
L=lambda a,b:'\n'.join(p[a-1:b])
core=open(S+'sd_core.js').read(); ind=open(S+'sd_ind.js').read(); mask=open(S+'sd_mask.js').read(); ex=open(S+'sd_ex.js').read(); ui=open(S+'sd_ui.js').read(); body=open(S+'sd_body.html').read()
head='<title>Sample Data Maker</title>\n<meta name="description" content="Mask Excel and CSV files so names, IDs, numbers and dates are fake but links between sheets and files still match, or make an industry sample model for Power BI as DAX functions.">\n'+L(3,6)+'\n<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>'
css=L(7,217)+'\n'+L(303,312)+'''
/* ---------- Sample Data Maker ---------- */
.msg.info{background:var(--info-soft);color:var(--info)}
.modes{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}
.mode{position:relative;display:block;cursor:pointer}
.mode input{position:absolute;opacity:0;pointer-events:none}
.mode>span{display:flex;flex-direction:column;gap:4px;height:100%;border:1px solid var(--line);border-radius:10px;padding:12px 14px;background:var(--surface)}
.mode b{font-family:var(--cond);font-size:17px;font-weight:600;color:var(--accent)}
.mode small{font-size:13.5px;color:var(--muted);line-height:1.5}
.mode input:checked+span{border-color:var(--accent);background:var(--accent-soft);box-shadow:inset 0 -3px 0 var(--gold)}
.mode input:focus-visible+span{outline:2px solid var(--accent);outline-offset:2px}
.drop{border:1.5px dashed var(--line);border-radius:8px;padding:18px;text-align:center;color:var(--muted);cursor:pointer;display:flex;flex-wrap:wrap;gap:4px 8px;justify-content:center;align-items:baseline}
.drop strong{color:var(--ink);font-weight:600}
.drop .hint{width:100%;font-size:12.5px}
.drop.over,.drop:hover{background:var(--accent-soft);border-color:var(--accent)}
.drop:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.files{display:flex;flex-wrap:wrap;gap:8px}
.files:empty{display:none}
.fchip{display:inline-flex;gap:6px;align-items:center;border:1px solid var(--line);background:var(--surface-2);border-radius:999px;padding:4px 6px 4px 12px;font-size:13.5px;max-width:100%;flex-wrap:wrap}
.fchip b{font-weight:600;overflow-wrap:anywhere}
.fchip button{border:0;background:none;color:var(--muted);font-size:16px;line-height:1;padding:0 6px;border-radius:50%}
.fchip button:hover{color:var(--err)}
.cards{display:flex;flex-direction:column;gap:14px}
.tcard{display:flex;flex-direction:column;gap:8px}
.tcard-head{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline}
.tcard-head b{font-family:var(--cond);font-size:16px;color:var(--accent)}
table.cols td{vertical-align:middle}
table.cols td.vals{font-family:var(--mono);font-size:12.5px;color:var(--muted);overflow-wrap:anywhere;min-width:120px}
table.cols td.nm{white-space:normal;overflow-wrap:anywhere;min-width:110px}
table.cols select{min-width:150px}
.howto{margin:0;padding-left:1.2em;display:flex;flex-direction:column;gap:5px;font-size:14px}
.lrow{display:flex;gap:8px;align-items:flex-start;justify-content:space-between;font-size:14px;padding:6px 0;border-bottom:1px solid var(--line)}
label.lrow{justify-content:flex-start;cursor:pointer}
.lrow input{margin-top:3px;flex:none}
.lrow .mono{font-size:13px;overflow-wrap:anywhere}
#linkList{display:flex;flex-direction:column}
.addlink,.cfg,.prevbar{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:flex-end}
.addlink select{width:260px}
.flabel{font-size:12.5px;color:var(--muted);font-weight:500}
input.num{width:120px}
input[type=number],input[type=date]{font-family:var(--mono);font-size:14px;color:var(--ink);background:var(--code-bg);border:1px solid var(--line);border-radius:6px;padding:6px 9px;max-width:100%}
input[type=number]:focus,input[type=date]:focus{outline:2px solid var(--accent);outline-offset:1px;border-color:transparent}
label.c{display:flex;gap:7px;align-items:center;font-size:14px}
.opts{gap:6px 18px}
table.prev th,table.prev td{white-space:nowrap;font-size:13px}
table.prev td{font-family:var(--mono);font-size:12.5px}
.dl{display:flex;flex-wrap:wrap;gap:8px}
.inds{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
.ind{display:flex;flex-direction:column;gap:4px;text-align:left;border:1px solid var(--line);border-radius:10px;padding:12px 14px;background:var(--surface);color:var(--ink);font:inherit;cursor:pointer}
.ind b{font-family:var(--cond);font-size:17px;font-weight:600;color:var(--accent)}
.ind span{font-size:14px}
.ind small{font-size:12.5px;color:var(--muted);line-height:1.45}
.ind:hover{border-color:var(--accent)}
.ind[aria-checked="true"]{border-color:var(--accent);background:var(--accent-soft);box-shadow:inset 0 -3px 0 var(--gold)}
.ind:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.chips .chip{font-family:var(--sans)}
h3.sub{margin:8px 0 2px;font-size:15px}
section.dim .step-body>*:not(.step-head){opacity:.45;pointer-events:none}
@media (max-width:640px){.addlink select{width:100%}.addlink .field{width:100%}table.cols select{min-width:0;width:100%}}
'''
logo=p[318]
src=head+'\n'+css+'\n</style>\n\n<div class="wrap">\n\n  <header class="top">\n    <div class="brandbar">\n'+logo+'\n'+body+'\n<script>\n'+core+'\n'+ind+'\n'+mask+'\n'+ex+'\n'+ui+'</script>\n'
assert '</script>' not in (core+ind+mask+ex+ui)
open(P+'sample-data-maker.html','w').write(src)
print(len(src))
