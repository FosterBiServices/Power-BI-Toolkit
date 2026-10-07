# SF Power BI Toolkit

Single-file HTML tools for Power BI developers, published with GitHub Pages at
https://fosterbiservices.github.io/Power-BI-Toolkit/ . People are already testing it, so
**never rename, move or delete a published page** (`index.html` or any tool `.html` at the
repo root). Links must keep working.

The owner works where Microsoft Copilot is the only AI allowed. The AI-assisted tools write a
prompt the user takes to Copilot, then check the reply pasted back. Nothing calls an AI API.

## Standing rules for every tool

- Examples use generic customer and sales data (Customer, Sales, Product, Date, Region...).
  Never real client names or data.
- Each page loads with example data so it shows what it does. Typing or loading anything of
  the user's own replaces the whole example (not a mix of both). Text typed into a field that held
  example text keeps only what was typed (`SF_SUITE.ownText`), and every other example field
  is cleared, so no example content reaches a Copilot prompt.
- Every Copilot prompt uses the same sections: TASK (the user's request, or what the tool
  asks for), CONTEXT, STARTING POINT, RULES, and REPLY FORMAT (marked as a template). suite.js
  adds `READ_RULE` to every copied or downloaded prompt: only TASK is the task, and sample or
  example content (including the reply template) is never a requirement. Reply parsers skip
  blocks that are only the reply template, in case Copilot repeats it.
- A **Clear entries** button in the banner, with a confirm step. It empties the page, removes
  everything the page saved in the browser (its own `localStorage` prefix), and leaves a flag
  (`<prefix>blank`) so a reload stays empty instead of bringing the example back.
- **Connect first.** A tool that reads the model starts with "Connect your model" as Step 1 (a PBIP
  folder, the model export, or no model where that works), then the task. Don't ask about
  measures or tables before the user has chosen how to connect.
- Tools that read the model use the **shared model export**: one DAX query the user runs once
  in DAX query view. It's saved on the home page and every tool picks it up (see suite.js).
- Home link and **Switch tool** menu on every page (added by suite.js).
- The disclaimer on the home page stays.
- No green, red or amber in **suggested colors** (palettes, themes, wireframes); they read as
  good, bad and warning. UI status colors for ok, error and warning are fine. KPI Visualizer's
  KPI status colors default to Excel's good, neutral and bad styles (the owner's choice).
- Leave out anything Power BI already does well by default. Two tools were dropped for this
  reason: Visual Interactions (there's a default setting) and a Performance Analyzer reader.
- Ask before changing anything when the owner says to confirm first.
- Plain, short UI text. Mobile: no horizontal scroll at 390px wide.

## How the site is built

```
src/parts/   pieces of each tool: <tool>_body.html, <tool>_core.js (logic), <tool>_ui.js,
             <tool>_ex.js (example data); plus suite.js, builder_core.js, home_body.html,
             home_ui.js, site_readme.md
src/pages/   each tool page before the shared suite is added (input to build_site.py)
src/build/   build_<tool>.py per tool, build_site.py, query_patch.py, _env.py (paths)
src/build.py runs everything
repo root    the published site; index.html, one .html per tool, README.md, .nojekyll
```

Rebuild everything: `python src/build.py` (Python 3, no packages needed). It rewrites the pages
in `src/pages/` and the published files at the repo root, and never deletes anything else.
After a change, check `git diff --stat`: only the pages you meant to change should move.

Edit the parts, not the published HTML at the repo root, or the next build overwrites the edit.

Things to know:
- `src/pages/prep-for-ai-writer.html` is the **template**. The build scripts copy its head,
  CSS blocks and logo **by line number** (`L(3,6)`, `L(7,217)`, `L(303,312)` clear-entries
  CSS, `p[318]` logo). Inserting lines near the top of that file shifts every tool. Add new
  CSS to a tool's own build script instead.
- Edited by hand, no build script: `prep-for-ai-writer.html`, `kpi-measure-builder.html` and
  `measure-describer.html` in `src/pages/`.
- `src/pages/sheet-recon.html` is a finished page (built in another chat) with a `@@SUITE@@`
  line where build_site.py puts suite.js. Edit it directly.
- `build_site.py`: `HOOKS` lists every tool page and the line that connects it to the shared
  export (`SF_SUITE.hook({ input, prefix, open })`). It applies `query_patch.upgrade()` to
  every page, which rewrites the shared export query, then builds `index.html` from
  `home_body.html` + `home_ui.js`, and `README.md` from `site_readme.md`.

### Adding a tool

1. Parts in `src/parts/` (`xx_body.html`, `xx_core.js`, `xx_ui.js`, `xx_ex.js`) and
   `src/build/build_xx.py` (copy a similar one, e.g. build_pw.py or build_mc.py), writing
   `P+'tool-name.html'`.
2. `build_site.py` HOOKS: add `'tool-name': "SF_SUITE.hook({...});"` or `''` if it doesn't use
   the model export.
3. `suite.js` `S.TOOLS` (Switch tool menu order), plus `AI_TOOLS` and `PROMPTS` if it writes a
   Copilot prompt.
4. `home_ui.js` TOOLS card (`free: true` = works without the model export; `tags`), and
   `FREE_ORDER` if free.
5. `site_readme.md`: a row in the table and the file list.
6. A check in `src/tests/`.

## Shared pieces (src/parts/suite.js)

- Shared export in `localStorage['sfpbi.shared.model']`. `S.get()`, `S.set()`, `S.clear()`.
  `S.set` keeps the replaced export in `sfpbi.shared.model.history` (up to 5; `S.history()`,
  `S.clearHistory()`), which Model Compare uses as the "before".
- `S.hook(cfg)` fills a tool's model box from the shared export and saves edits back.
  With `connect: { step, none, exportOnly, lede, retitle }` it also adds the **Connect your
  model** choice (PBIP folder, Model export, optionally No model) to the step whose h2 has id
  `step`, and hides the `exportOnly` elements unless Model export is chosen. `S.pbipExport()`
  turns a PBIP folder's TMDL (or model.bim) into export rows, so the tool reads it like an
  export. The choice is saved as `<prefix>connect`. Settings per page are in build_site.py HOOKS.
  A folder read in any tool is saved as the shared export with `source: 'pbip'`, so every other tool
  opens on it (unless it chose No model or its own export). The folder picker's handle is kept in
  IndexedDB (`sfpbi`, store `h`, key `pbip`) for the **Read it again** button.
- Home link and Switch tool menu (`S.TOOLS`).
- Prompts as files: for every page in `PROMPTS` (prompt element → reply element) each prompt
  box gets **Download file**, a "Send it to Copilot as a file" note, and "Open a reply file"
  (.txt, .md, .json, .csv, .tsv, .docx). Copied and downloaded prompts get `READ_RULE` and
  `ONE_REPLY` appended (one reply, or one downloadable .txt if too long).
- The export query lives in the pages and is rewritten by `query_patch.py`. It returns
  Kind, Table, Name, Type, Folder, Flags, Description, Expression, ToTable, ToColumn,
  Summarize, SortBy, Hierarchies, Storage, Source, plus a `_model` row. Calculated tables'
  DAX comes from `INFO.PARTITIONS()` (Type 2).

## Tools

| Page | Prefix | Uses export | Copilot |
|---|---|---|---|
| kpi-measure-builder | kmb. | yes | yes |
| measure-describer | kmd. | yes | yes |
| prep-for-ai-writer | kpa. | yes | yes |
| dax-reviewer | kdr. | optional | yes |
| validation-query-builder | kvq. | yes | no |
| time-intelligence-builder | kti. | yes | no |
| field-parameter-builder | kfp. | yes | no |
| rls-role-generator | krl. | yes | no |
| model-linter | kml. | yes, or a PBIP folder | no |
| model-compare | kmc. | two exports | no |
| model-documenter | kmdoc. | yes | no |
| about-this-report | kab. | yes | optional |
| power-query-writer | kpw. | no | yes |
| power-query-explainer | kpq. | no (own export, or a PBIP folder) | yes |
| date-table-generator | kdt. | optional | no |
| kpi-visualizer | kkv. | optional, or a PBIP folder | no |
| theme-builder | ktb. | no | no |
| layout-designer | klo. | no | no |
| sheet-recon | ksr. (Clear entries flag only; files are never stored) | no | no |

Every tool that uses the export (yes or optional) also takes a PBIP folder in its Connect your model step.

## Tests

Browser checks with Playwright against a local copy of the site:

```
cd src/tests
npm install
npx playwright install chromium
node run.js          # all checks; serves the repo root on http://localhost:8765
node run.js srtest   # only checks whose file name contains "srtest"
```

Each check prints what it saw and ends with `errors [...]`; empty means no page errors.
Several print values with "(expect ...)" to compare. Screenshots land in `src/tests/` and are
git-ignored; look at them when changing layout. Sheet Recon loads SheetJS from cdnjs, so it
needs internet (or set `XLSX_FILE` to a local `xlsx.full.min.js` 0.18.5).

## Not yet checked in real Power BI or Copilot

- Prompt files in Copilot (attaching the downloaded prompt; Copilot's file reply).

Checked on a real model in Power BI Desktop 2.158 (Oct 2026): the About This Report data
sources query, the Model Linter dependencies query, the shared export, and Model Compare on a
before/after change. Power Query Writer gave a working query from Copilot on a real
Excel-based query. On that build INFO.VIEW.MEASURES leaves FormatString empty, so the export
reads measure format strings from INFO.MEASURES.

The owner keeps a progress doc and checklist in Claude (claude.ai); it isn't in this repo.
