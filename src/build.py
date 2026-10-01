"""Rebuild the whole site:  python src/build.py

1. Each build/build_<tool>.py turns src/parts/<tool>_* into src/pages/<tool>.html.
2. build/build_site.py adds the shared suite (suite.js) to every page, upgrades the shared
   model export query (query_patch.py), builds index.html and README.md, and writes them
   all to the repo root, which GitHub Pages publishes.

Run one tool's script on its own while working on it, then build_site.py (or this file).
"""
import os, subprocess, sys

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'build')
tools = sorted(f for f in os.listdir(HERE) if f.startswith('build_') and f.endswith('.py') and f != 'build_site.py')
for f in tools + ['build_site.py']:
    r = subprocess.run([sys.executable, os.path.join(HERE, f)], cwd=HERE, capture_output=True, text=True)
    if r.returncode:
        sys.stderr.write(r.stdout + r.stderr)
        sys.exit(f'{f} failed')
    print(f'{f:22} ok')
print(r.stdout.strip())
