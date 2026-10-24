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
  suite.js adds a **Clear all pages** choice to that confirm (and the home page has one): it
  clears every prefix in `S.PREFIXES`, the shared export, its history and the PBIP folder handle,
  and sets every page's blank flag. A new tool's prefix goes in `S.PREFIXES`.
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
  Each holds its own copy of `builder_core.js` between `/*CORE-START*/` and `/*CORE-END*/` (only
  the "Copy the prompt again from Step N" line differs), so a change to builder_core goes into those
  three pages too.
- Date tables: use `isDateTable` / `dateTablesOf` from builder_core. A table counts when it is marked
  (data category Time) or is a calculated table built with CALENDAR, CALENDARAUTO or a GENERATESERIES
  of dates, since many models never mark theirs.
- Sample Data Maker (`sd_*`): `sd_core.js` is a small expression language. Each column is written once
  and gives both the DAX and the JavaScript that previews the same rows (one seeded hash,
  `MOD( SIN(...) * 43758.5453, 1 )`, in both), so the preview matches what Power BI builds. `sd_ind.js`
  holds the industries; `sd_mask.js` the masking. Generated functions are named
  `FosterBIServices.SampleData.*` with `DAXLIB_PackageId = FosterBIServices.SampleData`. The idea comes
  from the DataGoblins.SampleData DAX library; nothing is copied from it, and nothing generated names it.
  DAX rules found in Desktop: `key` can't be a function parameter name (hence `row_key`), and a
  TRUE/FALSE column can't hold BLANK (it turns FALSE), so boolean columns use `and(...)`, never
  `iff(..., blank())`, or the preview won't match.
  Measures all go in a `_Measures` table, with a display folder named for the table each one counts
  (the owner's choice). The page checks the model saved on the home page: if it has `_Measures`, the
  script uses `ref table _Measures` (adds, keeps what's there); otherwise it creates the table. The
  user can switch. Measures whose tables (or measures) are left out of the script are dropped.
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
3. `suite.js` `S.GROUPS` (its group and place: the home page and the Switch tool menu both follow it),
   `S.NEXT` (its What next links, and links to it from related tools), `S.PREFIXES` (Clear all pages),
   plus `AI_TOOLS` and `PROMPTS` if it writes a Copilot prompt.
4. `home_ui.js` TOOLS card (`free: true` = works without the model export; `tags`).
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
  export. Desktop leaves `dataType` out of TMDL for calculated tables' columns and calculated
  columns, so `guessType` works it out from the format string and annotations (dates must read as dates). The choice is saved as `<prefix>connect`.
  Settings per page are in build_site.py HOOKS. Reading a different PBIP folder than the page last used
  (`<prefix>modelFrom`) clicks the page's `#clearAll` first (`S.freshStart`), so picks and pasted results for
  the earlier model don't linger; re-reading the same folder keeps them. Tools also drop saved picks the
  current model doesn't have.
  `connect.report: true` (Model Linter, About This Report) also reads the folder's report files and
  sends them to the page as a `sf-pbip-folder` event, so report pages come from the same pick.
  A folder read in any tool is saved as the shared export with `source: 'pbip'`, so every other tool
  opens on it (unless it chose No model or its own export). The folder picker's handle is kept in
  IndexedDB (`sfpbi`, store `h`, key `pbip`) for the **Read it again** button.
- Home link and Switch tool menu, grouped by `S.GROUPS` (Design the report, Shape the data, Build the
  model, Check it, Explain it: the order a report gets built). `S.TOOLS` is the flat list made from it.
  The home page shows the same groups, under a **Connect your model once** box (the export query and
  paste) that folds to one status line once a model is saved.
- **What next** links above every tool's footer (`S.NEXT`).
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
| chart-patterns | kcp. | optional, or a PBIP folder | no |
| theme-builder | ktb. | no | no |
| layout-designer | klo. | no | no |
| sheet-recon | ksr. (Clear entries flag only; files are never stored) | no | no |
| sample-data-maker | ksd. (settings only; files are never stored) | no | no |

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
needs internet (or set `XLSX_FILE` to a local `xlsx.full.min.js` 0.18.5; `npm pack xlsx@0.18.5`
has it in `package/dist/` when cdnjs is blocked but npm isn't).

Two checks cover every page at once: `fuzztest.js` puts empty, junk, markup, broken exports and
junk files into every field and presses every button (no script errors, and typed markup never
runs; about an hour, so it asks run.js for more time with a `// time limit: N minutes` line), and
`storagetest.js` sets every saved key to junk and reloads (the page still opens). Run a new tool
through both.

## Not yet checked in real Power BI or Copilot

- Prompt files in Copilot (attaching the downloaded prompt; Copilot's file reply).
- Sample Data Maker's Make new data: applying the TMDL script in TMDL view (tables, relationships,
  measures), including `ref table _Measures` into a report that already has one. The DAX itself is checked: every table function of all six industries, run as a DAX
  query in Desktop (Oct 2026), gave the same row counts, sums and distinct counts as the page preview.
- KPI Visualizer's reusable card functions (`kv_fn.js`): applying the TMDL script in TMDL view, and the HTML
  cards' hover tooltips in the HTML Content visual. The first version (43 functions, with Color and format helpers) ran as
  DAX queries on a real model in Desktop (Oct 2026), but its TMDL failed to apply (expression indented at the properties'
  level, then "duplicate annotation under the root"). The owner then asked for: only the chosen card's functions (a
  card or small chart, SVG image or HTML, the owner's choice), colors, band and number shortening written into the
  functions from the tool (no Color or format functions), no annotations, and the summary card's lines showing only
  the two numbers its pill compares. Then: the card list holds only cards (bullet, progress, sparkline and variance bar
  are built as a function from their own options, "Build it as"), cards are drawn at the visual size the user types
  (suggested size when empty), Compare with defaults to the month before and offers no target for a prior-period KPI,
  and the HTML fits its visual with no scroll bar (`max-height:96vh`; custom visuals run in their own frame). That rewrite, the expression three tabs in, and the new bullet, progress,
  sparkline, variance bar and rolling tile functions haven't been run in Desktop yet. Names can't use `KPI` or `Text`
  as a segment (reserved in DAX queries), hence `FosterBIServices.KPICards.*`.
- Theme Builder's visual settings (Step 3): importing a theme with them in Desktop. They're written from the theme
  JSON schema's property names (`title`, `border`, `dropShadow`, `padding`, `legend`, `labels`, `valueAxis`, `lineStyles`,
  `columnHeaders`, `values`, `grid`, slicer `data.mode`...). "All visuals" goes to `"*"` and also overwrites the same
  property where the template sets it for one visual type, so it reaches them all; data labels only go to chart types,
  since cards call their value `labels` too. A kind of visual (`VIS_GROUPS` in tb_core.js) wins over All visuals.
  Every property comes from `tb_schema.js`, Microsoft's report theme schema compacted by `src/build/tb_schema.py`
  (download a newer `reportThemeSchema-2.x.json` from microsoft/powerbi-desktop-samples and run it; build.py doesn't).
  Property changes (`cfg.custom`) are written last and win over everything. Copy settings from a visual reads PBIR
  `visual.json` (`objects` and `visualContainerObjects`, Literal values and ThemeDataColor fills) or an older
  `report.json`; entries for one series or field (a selector other than `id: default`), values set by a field or rule,
  title text and properties the schema doesn't list for that visual stay behind. Starting from a theme file uses its
  visualStyles, textClasses and icons in place of `tb_template.js`; its colors fill Steps 1 and 2, so the colors the
  page works out (table accent, hyperlink, gradient) follow them. Owner prefers no Copilot here.
  Picking a PBIP folder (Step 1, or Copy settings from a visual) finds the theme the report uses (`findThemes`: report.json
  `themeCollection`, custom theme in StaticResources/RegisteredResources, base theme in SharedResources/BaseThemes) and asks:
  start from it, use only its colors (colors, text, good/bad, font; visual settings stay), or keep what's there.
- Chart Patterns: the TMDL scripts, the Format-pane steps and the combo chart marker size in a theme
  (written from the PBIP skills in Power-BI-Portfolio/AI/skills, not yet built by hand in Desktop).

Checked on a real model in Power BI Desktop 2.158 (Oct 2026): the About This Report data
sources query, the Model Linter dependencies query, the shared export, and Model Compare on a
before/after change. Power Query Writer gave a working query from Copilot on a real
Excel-based query. On that build INFO.VIEW.MEASURES leaves FormatString empty, so the export
reads measure format strings from INFO.MEASURES.

The owner keeps a progress doc and checklist in Claude (claude.ai); it isn't in this repo.
