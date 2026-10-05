import os
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
 'kpi-measure-builder':"SF_SUITE.hook({ input: 'modelInput', prefix: 'kmb.' });",
 'measure-describer':"SF_SUITE.hook({ input: 'modelInput', prefix: 'kmd.' });",
 'prep-for-ai-writer':"SF_SUITE.hook({ input: 'modelInput', prefix: 'kpa.' });",
 'validation-query-builder':"SF_SUITE.hook({ input: 'modelInput', prefix: 'kvq.' });",
 'dax-reviewer':"SF_SUITE.hook({ input: 'modelInput', prefix: 'kdr.', open: 'modelBox' });",
 'date-table-generator':"SF_SUITE.hook({ input: 'dcInput', prefix: 'kdt.', mode: 'dates', open: 'finder' });",
 'time-intelligence-builder':"SF_SUITE.hook({ input: 'modelInput', prefix: 'kti.', open: 'modelBox' });",
 'field-parameter-builder':"SF_SUITE.hook({ input: 'modelInput', prefix: 'kfp.', open: 'modelBox' });",
 'rls-role-generator':"SF_SUITE.hook({ input: 'modelInput', prefix: 'krl.', open: 'modelBox' });",
 'model-linter':"SF_SUITE.hook({ input: 'modelInput', prefix: 'kml.', open: 'modelBox' });",
 'about-this-report':"SF_SUITE.hook({ input: 'modelInput', prefix: 'kab.', open: 'modelBox' });",
 'model-compare':"SF_SUITE.hook({ input: 'modelInput', prefix: 'kmc.', open: 'modelBox' }); window.mcSuite && window.mcSuite(SF_SUITE);",
 'model-documenter':"SF_SUITE.hook({ input: 'exInput', prefix: 'kmdoc.' });",
 'kpi-visualizer':"SF_SUITE.hook({ input: 'modelInput', prefix: 'kkv.', open: 'modelBox' });",
 'theme-builder':"",
 'layout-designer':"",
 'power-query-explainer':"",
 'power-query-writer':"",
}
for name,hook in HOOKS.items():
    src=open(P+name+'.html').read()
    k=src.rindex('</script>')
    src=src[:k]+suite+('\n'+hook+'\n' if hook else '')+src[k:]
    open(OUT+'/'+name+'.html','w').write(upgrade(wrap(src)).replace('// KPI Measure Builder: model export', '// SF Power BI Toolkit: model export'))
# Sheet Recon: a finished page (added in another chat); only the shared suite is refreshed
_sr=open(P+'sheet-recon.html').read()
open(OUT+'/sheet-recon.html','w').write(upgrade(_sr.replace('@@SUITE@@', suite.rstrip('\n').lstrip('\n'))))
# home page
p=open(P+'prep-for-ai-writer.html').read().split('\n')
if p[3].startswith('<link rel=\"icon\"'): p = p[:2] + [p[2] + '\n' + p[3]] + p[4:]
L=lambda a,b:'\n'.join(p[a-1:b])
core=open(S+'builder_core.js').read()
head='<title>SF Power BI Toolkit</title>\n<meta name="description" content="Power BI tools for building and checking models with or without Copilot. Export your model once and every tool uses it.">\n'+L(3,6)
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
.paths{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media (max-width:640px){.paths{grid-template-columns:1fr}}
.path{display:flex;flex-direction:column;gap:4px;text-decoration:none;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:10px;padding:14px 16px}
.path:hover{border-color:var(--accent);background:var(--accent-soft)}
.path:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.path .pn{font-family:var(--cond);font-weight:600;font-size:18px;color:var(--accent)}
.path .pd{font-size:14px;color:var(--muted);line-height:1.45}
.group-head{display:flex;flex-direction:column;gap:6px;border-top:2px solid var(--line);padding-top:22px;scroll-margin-top:16px}
.group-head h2{margin:0}
.group-head p{margin:0;max-width:75ch}
#freeH{scroll-margin-top:16px}
.about ul{margin:0;padding-left:1.2em;display:flex;flex-direction:column;gap:6px;max-width:80ch}
.disclaimer{border:1px solid color-mix(in srgb,var(--warn) 40%,transparent);background:var(--warn-soft);border-radius:12px;padding:16px 20px;scroll-margin-top:16px}
.disclaimer h2{margin:0}
.disc-top a{color:inherit;font-weight:600}
.msg.info{background:var(--info-soft);color:var(--info)}
'''
logo=p[318]
body=open(S+'home_body.html').read(); ui=open(S+'home_ui.js').read()
src=head+'\n'+css+'\n</style>\n\n<div class="wrap">\n\n  <header class="top">\n    <div class="brandbar">\n'+logo+'\n'+body+'\n<script>\ndocument.body.dataset.home = "1";\n'+core+'\n'+suite+'\n'+ui+'</script>\n'
open(OUT+'/index.html','w').write(upgrade(wrap(src)).replace('// KPI Measure Builder: model export', '// SF Power BI Toolkit: model export'))
open(OUT+'/.nojekyll','w').write('')
open(OUT+'/README.md','w').write(open(S+'site_readme.md').read())
print('Built', len(HOOKS)+2, 'pages and README.md into', OUT)
