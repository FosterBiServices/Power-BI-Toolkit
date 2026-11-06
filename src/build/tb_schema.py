"""Compact Microsoft's report theme JSON schema into src/parts/tb_schema.js for Theme Builder.

The schema comes from https://github.com/microsoft/powerbi-desktop-samples/tree/main/Report%20Theme%20JSON%20Schema
Download a version and run:  python src/build/tb_schema.py reportThemeSchema-2.159.json
It keeps, for every visual type, its formatting cards (objects) and each property's kind, title and choices,
so the page can offer every property and check imported settings. Not run by build.py (it needs the download).
"""
import json, sys, os, re
src = sys.argv[1]
ver = re.search(r'(\d+\.\d+)', os.path.basename(src)).group(1)
s = json.load(open(src, encoding='utf-8')); D = s['definitions']
def ref(x):
    while isinstance(x, dict) and '$ref' in x:
        x = dict(D[x['$ref'].split('/')[-1]], **{k: v for k, v in x.items() if k != '$ref'})
    return x
def kind(p):
    r = p.get('$ref', '').split('/')[-1]
    title = p.get('title', '')
    if r in ('fill', 'colorOrThemeColor', 'color'): return ['c', title]
    if r == 'fontSize': return ['n', title, 6, 45]
    q = ref(p)
    if 'oneOf' in q and all('const' in o for o in q['oneOf']):
        return ['e', title, [[o['const'], o.get('title', str(o['const']))] for o in q['oneOf']]]
    t = q.get('type')
    if t == 'boolean': return ['b', title]
    if t in ('number', 'integer'):
        k = ['i' if t == 'integer' else 'n', title]
        if 'minimum' in q or 'maximum' in q: k += [q.get('minimum'), q.get('maximum')]
        return k
    if t == 'string': return ['s', title]
    return ['x', title]
def objects(defn):
    out = {}
    parts = [defn] + [ref(a) for a in ref(defn).get('allOf', [])]
    for part in parts:
        for name, o in ref(part).get('properties', {}).items():
            if name == '*': continue
            items = ref(ref(o).get('items', {}))
            props = {k: kind(v) for k, v in items.get('properties', {}).items()}
            if props: out.setdefault(name, [o.get('title', ''), {}])[1].update(props)
    return out
P, PI, O, OI, T = [], {}, [], {}, {}
for vt, v in s['properties']['visualStyles']['properties'].items():
    star = ref(v['properties']['*'])
    objs = objects(star)
    idx = []
    for name in sorted(objs):
        title, props = objs[name]
        pk = json.dumps(props, sort_keys=True)
        if pk not in PI: PI[pk] = len(P); P.append(props)
        ok = json.dumps([name, title, PI[pk]])
        if ok not in OI: OI[ok] = len(O); O.append([name, title, PI[pk]])
        idx.append(OI[ok])
    T[vt] = idx
out = {'v': ver, 't': T, 'o': O, 'p': P}
js = '/* Report theme schema ' + ver + ' (Microsoft, powerbi-desktop-samples), compacted by src/build/tb_schema.py */\nconst TB_SCHEMA = ' + json.dumps(out, separators=(',', ':'), ensure_ascii=False) + ';\n'
open(os.path.join(os.path.dirname(__file__), '..', 'parts', 'tb_schema.js'), 'w', encoding='utf-8').write(js)
print(len(js), 'bytes;', len(T), 'visual types,', len(O), 'objects,', len(P), 'property sets')
