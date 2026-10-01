"""Shared paths for the build scripts, so they run from the repo on any machine.

src/parts/  the pieces each tool page is built from (CSS, HTML body, JS)
src/pages/  each tool page before the shared suite is added. Three are edited by hand:
            prep-for-ai-writer.html (also the template the others copy their head, CSS and
            logo from, by line number), kpi-measure-builder.html and measure-describer.html.
            sheet-recon.html is a finished page with @@SUITE@@ where the shared script goes.
repo root   the published site (index.html and one .html per tool)
"""
import builtins, os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.dirname(HERE)
S = os.path.join(SRC, 'parts') + os.sep
P = os.path.join(SRC, 'pages') + os.sep
ROOT = os.path.dirname(SRC)


def open(file, mode='r', *args, **kw):
    """UTF-8 everywhere (Windows defaults to cp1252); read any line ending, write LF."""
    if 'b' not in mode:
        kw.setdefault('encoding', 'utf-8')
        if any(c in mode for c in 'wax'):
            kw.setdefault('newline', '\n')
    return builtins.open(file, mode, *args, **kw)
