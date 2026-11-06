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
  asks for), CONTEXT, STARTING POINT, RULES, and REPLY FORMAT (marked as a template). Power Query Writer adds a
  FINAL VALIDATION section before REPLY FORMAT (the owner's choice: Copilot checks the whole M query before replying), and its
  rules only ask for a type or column-selection step when the TASK needs one. suite.js
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
- **Branding: Foster BI Services** (the product stays "SF Power BI Toolkit"). Logo files are in `src/brand/`
  (from the owner's logo redesign, content-credential metadata stripped). Colors: navy `#0A2D5A` (`--brand`, `--band`,
  light `--accent`), gold `#F2A900` (`--gold`, dark `--accent`), dark gold `#B07A00` (the logo's SERVICES). Tool pages show
  the square icon in the banner and as the favicon; the home page shows the white full logo (`@@HOMELOGO@@` in
  home_body.html, filled by build_site.py from `src/brand/foster-bi-logo-services-white.svg`). The old SF shield is gone.
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
- Reading the model export: use `readModel` from builder_core. It's the one reader and keeps every export column
  and flag (summarize, sortBy, hierarchies, measure text/dynamic-format, relationship card, the `_model` row, `has`).
  `parseModel` is the view most tools use: the same objects without private tables, plus a table row for every
  table with columns or measures, and composite-model source groups. `readModel(text, { keepAuto: true })` keeps auto
  date tables and RowNumber columns (Model Documenter's "show auto"). `daxRefs(expr)` lists the `'Table'[Name]` and
  `[Name]` references in DAX (strings and comments skipped, `RETURN [x]` is bare); `daxMeasureRefs` and
  `measureDeps(model, list, depth)` give the measures a DAX expression or a list of measures depends on. Every tool reads the export
  and scans DAX references through these: no tool has its own export parser. A PBIP folder becomes export rows
  (`S.pbipExport`) and then goes through `readModel` too. The other TMDL readers read what the export doesn't
  carry: Model Documenter's folder mode (partitions, M sources, report pages), About This Report's data sources and
  Power Query Explainer's queries. Model Documenter also keeps its DAX tokenizer for its syntax checks.
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
  user can switch. Measures whose tables (or measures) are left out of the script are dropped, and the page says which
  (and which relationships) under the table list (`SD.leftOut`).
  Several industries can go in one model (`SD_IND.combine`, `state.make.inds` in the order picked). They share one Date
  table; a table or measure name an earlier industry already uses gets the industry's name in front (`Finance Customers`,
  `Finance Gross Margin %`) and that industry's measures are rewritten to match. A size two industries both have
  (`num_customers`) becomes one per industry (`num_customers_retail`, `num_customers_finance`): `SD.pmap` renames
  settings while an industry is built, so builders must call `P()` and `n()` inside the industry function, not at load.
  Per-industry choices (`off`, `tab`) are saved under the industries joined with `+`; sizes stay per industry.
  In plain calculated tables the settings are VARs chained straight into the table's own `VAR _Rows ... RETURN` (no
  RETURN of their own, since a table with no settings would start with a bare RETURN, which Desktop rejects).
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
- A paste with no header row (cells copied from the grid without the column names) is read in the export query's
  column order when its rows start with a kind the export makes (`EXPORT_COLS` in builder_core, `S.withHeader` in
  suite.js, which puts the header back before saving). Check: `headerlesstest.js`.
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

- Sample Data Maker: a script with two or more industries combined (renamed tables and measures, per-industry sizes),
  and the plain calculated tables after the RETURN fix (Accounts, Cost Centers and Departments failed before it).
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
  `report.json`. A selector with only an `id` (and `hierarchyMatching`) is a state (`interaction:hover`, `selection:selected`...):
  it's kept as `cfg.custom[type]["card@state"]` and written as that card's `$id` entry, as Power BI's own base themes do
  (any card of a visual whose schema has `$id` anywhere, since the schema leaves it off some, e.g. an advanced slicer's fillCustom).
  Sizes Desktop saves as text (`'10'`) are read as numbers. Entries for one series or field (`data` or `metadata`
  selectors), values linked to a field or rule, a slicer's current selection (`general.filter`), title and header text,
  and properties the schema doesn't list stay behind, each visual listing one line per reason. Custom visuals can't be
  copied (the schema doesn't cover them). The visual list starts with nothing checked (Check all, Uncheck all, a box per
  page and Find act on the visuals shown), since a report can have 100+ visuals and you may want one.
  NOT yet checked in Desktop: importing a theme with state (`$id`) entries copied from a list or advanced slicer. Starting from a theme file uses its
  visualStyles, textClasses and icons in place of `tb_template.js`; its colors fill Steps 1 and 2, so the colors the
  page works out (table accent, hyperlink, gradient) follow them. Owner prefers no Copilot here.
  Picking a PBIP folder (Step 1, or Copy settings from a visual) finds the theme the report uses (`findThemes`: report.json
  `themeCollection`, custom theme in StaticResources/RegisteredResources, base theme in SharedResources/BaseThemes) and asks:
  start from it, use only its colors (colors, text, good/bad, font; visual settings stay), or keep what's there.
  ThemeDataColor is named as Power BI's color picker does: ColorId 0 the theme's background, 1 its foreground, 2+ data
  color (ColorId - 1), with the hex from the current theme and the Percent as % lighter or darker.
  A Step 1 pick also fills Step 3's visual list, so the folder isn't picked twice. The list follows pages.json `pageOrder`,
  then each visual's position (top to bottom, left to right).
- Chart Patterns: the TMDL scripts, the Format-pane steps and the combo chart marker size in a theme
  (written from the PBIP skills in Power-BI-Portfolio/AI/skills, not yet built by hand in Desktop).

Power Query Writer: types follow the owner's **type map** pattern (`PW.typeMap(cols, prev, culture)`): TypePairs, only the
pairs whose columns exist, every other column text, one Table.TransformColumnTypes (ChangeTypes). With columns pasted,
"Set column types with a type map" is on by default; the prompt then gives Copilot the filled-in block as a required step,
and Step 2 shows it to copy. Types come from the pasted rows (whole number -> Int64.Type, number, date, datetime, logical,
otherwise text). Unticked, the rule is the conditional one (a type step only when the TASK changes types). Check: `pwtypetest.js`.

Power Query Writer fx functions (`src/fx/*.pq`): fxApplyTypes (the type map as a function), fxRemoveBlankRows, fxTrimText,
fxSetCase, fxToDate, fxTextToNumber, fxAddDateTimeFromPairs (the owner's own, fixed), fxReplaceNulls, fxDedupe. Each is a
blank query: comment lines saying what it does and an example, then the function itself (no Documentation
metadata wrapper, so pasting it into a blank query's Advanced Editor needs no edits), with an optional Options record. build_pw.py puts their code in `PWF_CODE`.
`src/fx/fxTests.pq` is the Desktop test (45 checks on messy rows): create the nine functions as queries, load fxTests as a
table and every Pass must be true. Change a function only with that test run again in Desktop.
Recipes (`src/parts/pw_fx.js`, `PWF`): Step 2 "Cleaning steps" ticks recipes and picks columns (dates and date-times come
picked); `PWF.recipeSteps` writes the calling steps in a fixed order (blank rows, trim, case, dates, numbers, split, empty
values, types, duplicates last) and the type pairs after them (converted columns typed, new "X date"/"X time" columns added,
a kept split original stays text). The type map calls fxApplyTypes by default; "Write the type map as steps" gives the
inline TypePairs version after the recipes. The prompt lists FUNCTIONS THAT ALREADY EXIST (the ones used, all nine when
"The toolkit's fx functions are in my file" is ticked, and the person's own from "Functions you already have", one per
line: `name(args): what it does`), requires the steps as given, and adds a FINAL VALIDATION line for calls by name. The
page shows each function used, to add once. Checks: calls of listed functions with argument counts, an fx call that isn't
listed, recipe steps missing, the fxApplyTypes pairs, and column names written with square brackets inside quotes
("[First Name]", from a real Copilot reply: the functions skip a name they don't find, so it silently does nothing; the
prompt now says to give names as quoted text without brackets). Check: `pwfxtest.js` (the full chain also passed in Desktop).

Power Query Writer reply checks (`src/parts/pw_lint.js`, `PWL.lint`, added to pw_core in build_pw.py): functions that don't
exist (Table, List, Text, Record and Duration are listed in full; `ALIAS` maps names Copilot invents, such as Table.FilterRows,
to the real one) and argument counts (`ARITY`, about 350 functions); `[Column]` inside Table.TransformColumns and
`Text.Upper(_)`-style calls inside Table.AddColumn/SelectRows; steps that use a later step; step names that hide a library
(Duration, Table...); Table.RemoveColumns without MissingField.Ignore; and the type map coming back changed. Unbalanced
brackets and quotes are already reported by parseM. The prompt now asks for MissingField.Ignore when the TASK removes
named columns and forbids library names for steps (from the first real Copilot test, `src/tests/pw_reply_copilot.txt`).
Check: `pwlinttest.js`.

Power Query Writer fix loop (`PW.fixPrompt(inp, reply, findings, problem)`): under Step 4, "Didn't work in Power BI
Desktop?" takes the Desktop error or a plain description; with it, or with any Fix/Check finding, the page writes a
follow-up prompt (the current query as STARTING POINT, the error and findings in CONTEXT, change only what the fix needs,
keep the type map, common Power Query errors and their causes, the shared FINAL VALIDATION list `VALIDATION` plus "every
other step is as it was"). The reply comes back in the same format plus a CHANGES block, pasted into the same reply box;
the page shows "What Copilot changed" and checks it again. Registered in suite.js PROMPTS (pwFixView -> pwReply).
Check: `pwfixtest.js`.

Theme Builder: **Start from my logo** reads the image in the page (never saved), and `TB.logoColors(rgba)` returns its main
colors (white, black and grey backgrounds and see-through pixels left out, close shades merged, each the average of
its pixels) with their share; the biggest non-grey ones (up to 3, at least 5%) come ticked and become the brand colors.
The green/red/amber note skips brand colors (`opts().brandColors`), since the person chose them. Other options vary
the brand shade by data color position, so the lists don't all open with the same color. Check: `tbfixtest.js`.

Layout Designer: a suggestion that changes the page size (Taller page, Larger page, or the 16:9 start when the page
isn't 16:9) is never the Best fit and its card says "Changes your page from W x H to W x H". A logo added in Step 1 is
drawn on the background by default (`header.logo.inBg`), and Step 4 says when the background has no logo and where to
put an Image visual. Visuals can be renamed in Step 4's positions table (`renameItem`, by layout id: g2, g2.1, t0, s1,
h0, l3, title). Check: `lofixtest.js`.

Model Linter skips measures that return text (labels, SVG images, HTML) in the format string check: the export flags
them, a PBIP folder's Image URL and Web URL measures are flagged by suite.js, and `ML.returnsText` reads the expression
for the rest. A date column on the one side of a relationship (Date[Date]) isn't a visible key; on the many side it's info.

Checked on a real model in Power BI Desktop 2.158 (Oct 2026): the About This Report data
sources query, the Model Linter dependencies query, the shared export, and Model Compare on a
before/after change. Power Query Writer gave a working query from Copilot on a real
Excel-based query. On that build INFO.VIEW.MEASURES leaves FormatString empty, so the export
reads measure format strings from INFO.MEASURES.

The owner keeps a progress doc and checklist in Claude (claude.ai); it isn't in this repo.

## Parked (built, then taken out; possible future updates)

- **Save to a PBIP folder** (`src/parts/pbip_save.js`): a button under every TMDL script that merges it into a PBIP
  folder's model files (tables, `_Measures`, relationships, functions, roles, `model.tmdl`) after showing the list of
  changes; Chrome/Edge write in place, other browsers get a .zip. `S.pbipPlan(script, files)` is the pure merge.
  Taken out (Nov 2026) because it overwrites the person's own project files. Options when it comes back: a .zip only,
  a backup copy of each file first, or in place as built. Checks: `pbipsavetest.js`, `pbipbtntest.js` (fixture
  `src/tests/savepbip/`); they skip while it's parked.
- **Layout Designer: Add as a page to a PBIP report** (`src/parts/lo_pbir.js`, `LPB`): writes the layout as a PBIR page
  (page.json with the background PNG, a visual.json per box with type, position and title, no fields), registers the
  images in report.json and adds the page to pages.json. Uses pbip_save.js's folder flow. Check: `lopbirtest.js`.
  Neither was opened in Power BI Desktop.
