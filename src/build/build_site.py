import os, base64
from _env import open, S, P, ROOT
from query_patch import upgrade
# Writes the published files straight into the repo root. It only overwrites the page files
# it builds; it never deletes anything (the repo root also holds .git, src/ and CLAUDE.md).
OUT=ROOT
suite=open(S+'suite.js').read()
def wrap(src):
    i=src.index('</style>')+len('</style>')
    return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'+src[:i]+'\n</head>\n<body>\n'+src[i:].lstrip('\n')+'\n</body>\n</html>\n'
HOOKS={
 'kpi-measure-builder':"SF_SUITE.hook({ input: 'modelInput', prefix: 'kmb.', connect: { step: 's1', title: 'Connect your model', exportOnly: ['section[aria-labelledby=\"s1\"] .how', 'section[aria-labelledby=\"s1\"] .codebox', 'section[aria-labelledby=\"s1\"] .note'], retitle: { s2: ['Your model', 'What was read from your model. For the export, paste the results here straight from the Copy button.'] } } });",
 'measure-describer':"SF_SUITE.hook({ input: 'modelInput', prefix: 'kmd.', connect: { step: 's1', title: 'Connect your model', exportOnly: ['section[aria-labelledby=\"s1\"] .how', 'section[aria-labelledby=\"s1\"] .codebox', 'section[aria-labelledby=\"s1\"] .note'], retitle: { s2: ['Your model', 'What was read from your model. For the export, paste the results here straight from the Copy button.'] } } });",
 'prep-for-ai-writer':"SF_SUITE.hook({ input: 'modelInput', prefix: 'kpa.', connect: { step: 's1', title: 'Connect your model', exportOnly: ['section[aria-labelledby=\"s1\"] .how', 'section[aria-labelledby=\"s1\"] .codebox', 'section[aria-labelledby=\"s1\"] .note'], retitle: { s2: ['Your model', 'What was read from your model. For the export, paste the results here straight from the Copy button.'] } } });",
 'validation-query-builder':"SF_SUITE.hook({ input: 'modelInput', prefix: 'kvq.', connect: { step: 's1', title: 'Connect your model', exportOnly: ['section[aria-labelledby=\"s1\"] .how', 'section[aria-labelledby=\"s1\"] .codebox', 'section[aria-labelledby=\"s1\"] .note'], retitle: { s2: ['Your model', 'What was read from your model. For the export, paste the results here straight from the Copy button.'] } } });",
 'dax-reviewer':"SF_SUITE.hook({ input: 'modelInput', prefix: 'kdr.', connect: { step: 's0', none: 'Review the measure on its own. Names aren\u2019t checked.', exportOnly: ['#modelBox'], lede: 'Optional. With your model, the page can pick measures from it, tell columns from measures, check every name exists, and give Copilot the formulas of the measures this one uses.' } });",
 'date-table-generator':"SF_SUITE.hook({ input: 'dcInput', prefix: 'kdt.', mode: 'dates', connect: { step: 's0', none: 'Set the years yourself, or type your date columns in Step 2.', exportOnly: ['#finder > .how', '#finder > .codebox'], lede: 'Optional. With your model, tick the date columns your data uses, and the table can start and end with your data.' } });",
 'time-intelligence-builder':"SF_SUITE.hook({ input: 'modelInput', prefix: 'kti.', open: 'modelBox', connect: { step: 's1', title: 'Connect your model', exportOnly: ['#modelBox'], open: 'modelBox' } });",
 'field-parameter-builder':"SF_SUITE.hook({ input: 'modelInput', prefix: 'kfp.', open: 'modelBox', connect: { step: 's1', title: 'Connect your model', exportOnly: ['#modelBox'], open: 'modelBox' } });",
 'rls-role-generator':"SF_SUITE.hook({ input: 'modelInput', prefix: 'krl.', open: 'modelBox', connect: { step: 's1', title: 'Connect your model', exportOnly: ['#modelBox'], open: 'modelBox' } });",
 'model-linter':"SF_SUITE.hook({ input: 'modelInput', prefix: 'kml.', open: 'modelBox', connect: { step: 's1', title: 'Connect your model', report: true, exportOnly: ['#modelBox'], open: 'modelBox' } });",
 'about-this-report':"SF_SUITE.hook({ input: 'modelInput', prefix: 'kab.', open: 'modelBox', connect: { step: 's1', title: 'Connect your model', report: true, exportOnly: ['#modelBox'], open: 'modelBox' } });",
 'model-compare':"SF_SUITE.hook({ input: 'modelInput', prefix: 'kmc.', open: 'modelBox', connect: { step: 's1', lede: 'The model after your changes: from a PBIP folder, read straight from your project, or the export query you run in DAX query view.', exportOnly: ['#modelBox'], open: 'modelBox' } }); window.mcSuite && window.mcSuite(SF_SUITE);",
 'model-documenter':"SF_SUITE.hook({ input: 'exInput', prefix: 'kmdoc.' }); window.mdSuite && mdSuite(SF_SUITE);",
 'kpi-visualizer':"SF_SUITE.hook({ input: 'modelInput', prefix: 'kkv.', connect: { step: 's1', none: 'Type each KPI\u2019s measure name yourself. Names aren\u2019t checked.', exportOnly: ['#queryBox'], open: 'queryBox', lede: 'With your model, you pick KPIs from your measures (including ones in a measures table) and every name is checked before you copy the script.' } });",
 'chart-patterns':"SF_SUITE.hook({ input: 'modelInput', prefix: 'kcp.', connect: { step: 's1', none: 'Type the measure and column names yourself. Names aren\\u2019t checked.', exportOnly: ['#queryBox'], open: 'queryBox', lede: 'With your model, you pick the measure and columns from lists and every name is checked before you copy the script.' } });",
 'theme-builder':"",
 'layout-designer':"",
 'power-query-explainer':"",
 'power-query-writer':"SF_SUITE.hook({ input: 'modelInput', prefix: 'kpw.', open: 'modelBox', connect: { step: 's0', report: true, none: 'Paste the query and columns yourself in Step 3.', exportOnly: ['#modelBox'], open: 'modelBox', lede: 'Optional. With your model, you pick the table to build on and the tables to merge with, and its columns come along. A PBIP folder also brings each table\\u2019s query, and the functions already in it.' } });",
 'sample-data-maker':"",
}
for name,hook in HOOKS.items():
    src=open(P+name+'.html').read()
    k=src.rindex('</script>')
    src=src[:k]+suite+('\n'+hook+'\n' if hook else '')+src[k:]
    open(OUT+'/'+name+'.html','w').write(upgrade(wrap(src)).replace('// KPI Measure Builder: model export', '// Foster BI Toolkit: model export'))
# Sheet Recon: a finished page (added in another chat); only the shared suite is refreshed
_sr=open(P+'sheet-recon.html').read()
open(OUT+'/sheet-recon.html','w').write(upgrade(_sr.replace('@@SUITE@@', suite.rstrip('\n').lstrip('\n'))))
# home page
p=open(P+'prep-for-ai-writer.html').read().split('\n')
if p[3].startswith('<link rel=\"icon\"'): p = p[:2] + [p[2] + '\n' + p[3]] + p[4:]
L=lambda a,b:'\n'.join(p[a-1:b])
core=open(S+'builder_core.js').read()
head='<title>Foster BI Toolkit</title>\n<meta name="description" content="Power BI tools for building and checking models with or without Copilot. Export your model once and every tool uses it.">\n'+L(3,6)
css=L(7,217)+'''
.saved{display:flex;flex-direction:column;gap:10px;border:1px solid color-mix(in srgb,var(--ok) 35%,transparent);background:var(--ok-soft);border-radius:10px;padding:12px 14px}
.saved[hidden]{display:none!important}
.saved-head{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:baseline}
.saved-title{font-family:var(--cond);font-weight:600;font-size:16px;color:var(--ok)}
.saved .stat{background:var(--surface)}
.reply-actions{display:flex;gap:10px;flex-wrap:wrap}
#modelName{width:260px;font-family:var(--sans)}
.tools-sec,.about{display:flex;flex-direction:column;gap:12px}
.tools{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px}
.tool{display:flex;flex-direction:column;gap:8px;text-decoration:none;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px 18px;border-bottom:3px solid var(--gold);transition:border-color .15s,transform .15s}
.tool:hover{border-color:var(--accent);transform:translateY(-1px)}
.tool:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.tool .tn{font-family:var(--cond);font-weight:600;font-size:19px;color:var(--accent)}
.tool .td{font-size:14px;color:var(--muted);line-height:1.5;flex:1}
.tags{display:flex;flex-wrap:wrap;gap:6px}
.tag{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;border-radius:999px;padding:2px 9px;white-space:nowrap}
.tag.exp{background:var(--accent-soft);color:var(--accent)}
.tag.ai{background:var(--info-soft);color:var(--info)}
.tag.noai{background:var(--ok-soft);color:var(--ok)}
.tag.opt{background:var(--surface-2);color:var(--muted);border:1px solid var(--line)}
.groups{display:flex;flex-direction:column;gap:26px}
.groups .tools-sec h2{margin:0;font-size:22px}
.connect{background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:12px}
.connect>summary{display:flex;flex-direction:column;gap:4px;padding:14px 18px 14px 40px;cursor:pointer;list-style:none;position:relative}
.connect>summary::-webkit-details-marker{display:none}
.connect>summary::before{content:"";position:absolute;left:18px;top:21px;width:8px;height:8px;border-right:2px solid var(--accent);border-bottom:2px solid var(--accent);transform:rotate(-45deg);transition:transform .15s}
.connect[open]>summary::before{transform:rotate(45deg)}
.connect>summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:12px}
.cn-title{font-family:var(--cond);font-weight:600;font-size:19px;color:var(--accent)}
.cn-sub{font-size:14px;color:var(--muted);line-height:1.5}
.connect-body{display:flex;flex-direction:column;gap:16px;padding:0 14px 16px}
.connect-body>.note{margin:0 4px}
.about ul{margin:0;padding-left:1.2em;display:flex;flex-direction:column;gap:6px;max-width:80ch}
.disclaimer{border:1px solid color-mix(in srgb,var(--warn) 40%,transparent);background:var(--warn-soft);border-radius:12px;padding:16px 20px;scroll-margin-top:16px}
.disclaimer h2{margin:0}
.disc-top a{color:inherit;font-weight:600}
.msg.info{background:var(--info-soft);color:var(--info)}
.clear-all-home{display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center;margin-top:8px}
.clear-all-home [hidden]{display:none!important}
#homeClearConfirm{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.btn.danger{background:var(--err);border-color:var(--err);color:#fff}
.btn.danger:hover{filter:brightness(1.08);color:#fff}
.brandbar img.home-logo{display:block;align-self:flex-start;width:auto;height:52px;max-width:100%;border-radius:0;box-shadow:none;margin-bottom:10px}
@media (max-width:520px){.brandbar img.home-logo{height:40px;width:auto}}
'''
body=open(S+'home_body.html').read().replace('@@HOMELOGO@@','data:image/svg+xml;base64,'+base64.b64encode(open(os.path.join(S,'..','brand','foster-bi-logo-services-white.svg'),'rb').read()).decode()); ui=open(S+'home_ui.js').read()
src=head+'\n'+css+'\n</style>\n\n<div class="wrap">\n\n  <header class="top">\n    <div class="brandbar">\n'+body+'\n<script>\ndocument.body.dataset.home = "1";\n'+core+'\n'+suite+'\n'+ui+'</script>\n'
open(OUT+'/index.html','w').write(upgrade(wrap(src)).replace('// KPI Measure Builder: model export', '// Foster BI Toolkit: model export'))
# Data and privacy page: what the toolkit keeps, where, and who can see it (linked from the disclaimer and every footer)
pv_head='<title>Data and privacy - Foster BI Toolkit</title>\n<meta name="description" content="Where the Foster BI Toolkit keeps what you type, paste and open, and who can see it. It stays in your browser.">\n'+L(3,6)
pv_css=L(7,217)+'''
.pv,.pv-sum{display:flex;flex-direction:column;gap:10px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px 20px}
.pv-sum{border-left:4px solid var(--accent)}
.pv h2,.pv-sum h2{margin:0;font-size:22px}
.pv p{margin:0;max-width:80ch;line-height:1.55}
.pv ul,.pv-sum ul{margin:0;padding-left:1.2em;display:flex;flex-direction:column;gap:6px;max-width:80ch;line-height:1.55}
.pv a{overflow-wrap:anywhere}
.pv-table{overflow-x:auto;max-width:100%}
.pv-table table{border-collapse:collapse;width:100%;font-size:14px}
.pv-table th,.pv-table td{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid var(--line)}
.pv-table th{font-family:var(--cond);font-weight:600;color:var(--accent);white-space:nowrap}
@media (max-width:520px){.pv-table th,.pv-table td{padding:6px;font-size:13px}.pv-table th{white-space:normal}}
.clear-all-home{display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center;margin-top:4px}
.clear-all-home [hidden]{display:none!important}
#pvClearConfirm{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.btn.danger{background:var(--err);border-color:var(--err);color:#fff}
.btn.danger:hover{filter:brightness(1.08);color:#fff}
'''
pv_body=open(S+'privacy_body.html').read().replace('@@LOGO@@',p[318].strip())
src=pv_head+'\n'+pv_css+'\n</style>\n\n<div class="wrap">\n\n  <header class="top">\n    <div class="brandbar">\n'+pv_body+'\n<script>\n'+suite+'\n'+open(S+'privacy_ui.js').read()+'</script>\n'
open(OUT+'/data-and-privacy.html','w').write(wrap(src))
open(OUT+'/.nojekyll','w').write('')
open(OUT+'/README.md','w').write(open(S+'site_readme.md').read())
print('Built', len(HOOKS)+3, 'pages and README.md into', OUT)
