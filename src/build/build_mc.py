from _env import open, S, P, ROOT
p=open(P+'prep-for-ai-writer.html').read().split('\n')
if p[3].startswith('<link rel="icon"'): p = p[:2] + [p[2] + '\n' + p[3]] + p[4:]
L=lambda a,b:'\n'.join(p[a-1:b])
core=open(S+'builder_core.js').read(); mc=open(S+'mc_core.js').read(); ex=open(S+'mc_ex.js').read(); ui=open(S+'mc_ui.js').read(); body=open(S+'mc_body.html').read()
head='<title>Model Compare</title>\n<meta name="description" content="Compare two Power BI model exports: added, removed, renamed and changed tables, columns, measures and relationships, with DAX differences and release notes.">\n'+L(3,6)
css=L(7,217)+'\n'+L(303,312)+'''
/* ---------- Model Compare ---------- */
.msg.info{background:var(--info-soft);color:var(--info)}
.btn.small{padding:4px 10px;font-size:13px}
.btn[disabled]{opacity:.45;cursor:default}
input.txt{font-family:var(--sans);font-size:14px;width:320px;max-width:100%}
textarea.short{min-height:80px}
.pickrow{display:flex;flex-wrap:wrap;gap:10px}
.tipline{margin:0}
.linkbtn{all:unset;color:var(--accent);text-decoration:underline;cursor:pointer}
.linkbtn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.field .seg,.step-body>.seg{align-self:flex-start}
.hist{display:flex;flex-direction:column;gap:6px}
.hrow{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--line);border-radius:8px;background:var(--surface);padding:8px 12px;cursor:pointer}
.hrow.on{border-color:var(--accent);background:var(--accent-soft)}
.hrow input{margin-top:3px;accent-color:var(--accent)}
.hb{display:flex;flex-direction:column;gap:2px;min-width:0}
.ht{font-weight:600;font-size:14px}
.hs{font-size:13px;color:var(--muted)}
.imp{display:inline-block;font-size:11.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;border-radius:4px;padding:1px 6px;vertical-align:1px}
.imp.attention{background:#E3E8F7;color:#233C86}
.imp.change{background:#E2F1F3;color:#0F5E66}
.imp.house{background:var(--surface-2);color:var(--muted);border:1px solid var(--line)}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .imp.attention{background:#23305A;color:#C9D5FA}:root:not([data-theme="light"]) .imp.change{background:#15393D;color:#A6E0E6}}
.sum-bar{display:flex;flex-direction:column;gap:4px;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:10px 14px;font-size:14px}
.sum-bar .imp{margin-left:4px}
.okc{color:var(--ok)}
.filters{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between}
.filters .chip{font-family:var(--sans);font-size:13px;cursor:pointer}
#changes{display:flex;flex-direction:column;gap:16px}
.cgrp{display:flex;flex-direction:column;gap:8px}
.cgrp h3{margin:0;font-size:15px;display:flex;gap:8px;align-items:center}
.chg{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:10px 14px;display:flex;flex-direction:column;gap:8px;min-width:0}
.chg-head{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}
.ctype{font-size:12px;font-weight:700;border-radius:999px;padding:2px 9px}
.t-added{background:#E2F1F3;color:#0F5E66}.t-removed{background:#EEE8F7;color:#4B2E83}.t-renamed{background:#E3E8F7;color:#233C86}.t-changed{background:var(--surface-2);color:var(--ink);border:1px solid var(--line)}
.kindtag{font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);border:1px solid var(--line);border-radius:4px;padding:1px 5px}
.lbl{font-family:var(--mono);font-size:13.5px;font-weight:600;overflow-wrap:anywhere}
.chg .muted .mono{font-family:var(--mono);font-size:12.5px}
.why{margin:0;font-size:13.5px;color:var(--ink);background:var(--surface-2);border-radius:6px;padding:6px 10px}
table.pd{font-size:13.5px}
table.pd td{overflow-wrap:anywhere}
.long{display:block;max-height:5.2em;overflow:auto}
.dax-h{font-size:12.5px;font-weight:600;color:var(--muted);margin-bottom:4px}
.diff{font-family:var(--mono);font-size:12.5px;line-height:1.55;border:1px solid var(--line);border-radius:8px;overflow:auto;max-height:420px;background:var(--code-bg)}
.dl{white-space:pre;padding:0 10px 0 0;min-width:max-content}
.dl .g{display:inline-block;width:22px;text-align:center;color:var(--muted);user-select:none}
.dl.d{background:#F1ECF8}.dl.a{background:#E4F2F4}
.dl.d mark{background:#DCCDF1;color:inherit;border-radius:2px}.dl.a mark{background:#BFE3E8;color:inherit;border-radius:2px}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .dl.d{background:#2A2238}:root:not([data-theme="light"]) .dl.a{background:#173236}:root:not([data-theme="light"]) .dl.d mark{background:#4A3A66}:root:not([data-theme="light"]) .dl.a mark{background:#23565C}}
details.daxd summary{cursor:pointer;font-size:13.5px;color:var(--accent)}
details.daxd pre{margin:6px 0 0;max-height:300px;overflow:auto}
.codebox-bar .r{display:flex;gap:6px;flex-wrap:wrap}
#notesView{white-space:pre-wrap}
@media (max-width:640px){.filters{flex-direction:column;align-items:flex-start}}
'''
logo=p[318]
src=head+'\n'+css+'\n</style>\n\n<div class="wrap">\n\n  <header class="top">\n    <div class="brandbar">\n'+logo+'\n'+body+'\n<script>\n'+core+'\n'+mc+'\n'+ex+'\n'+ui+'</script>\n'
assert '</script>' not in (core+mc+ex+ui)
open(P+'model-compare.html','w').write(src)
print(len(src))
