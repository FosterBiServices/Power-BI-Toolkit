# SF Power BI Toolkit

Browser-based tools for building, documenting and checking Power BI semantic models, with or without Copilot.

**Open the toolkit:** https://fosterbiservices.github.io/Power-BI-Toolkit/

Every page is a single HTML file that runs entirely in your browser. There is nothing to install, no sign-in, and no server: your model details are never uploaded. When a tool uses Copilot, it writes a prompt that you paste into Copilot yourself, then it checks the reply you paste back.

## The tools

| Tool | What it does | Uses your model export | Copilot |
| --- | --- | :---: | :---: |
| [KPI Measure Builder](https://fosterbiservices.github.io/Power-BI-Toolkit/kpi-measure-builder.html) | Describe measures in plain English. Copilot writes the DAX; the page checks every table, column and measure name and outputs tab-indented TMDL for your measures folder. | ✓ | ✓ |
| [Measure Describer](https://fosterbiservices.github.io/Power-BI-Toolkit/measure-describer.html) | Copilot writes descriptions for your measures in batches; you review them and save them to the model from DAX query view. | ✓ | ✓ |
| [Prep for AI Writer](https://fosterbiservices.github.io/Power-BI-Toolkit/prep-for-ai-writer.html) | AI instructions, synonyms, and table and column descriptions that help Copilot in Power BI answer questions about your model. | ✓ | ✓ |
| [DAX Reviewer](https://fosterbiservices.github.io/Power-BI-Toolkit/dax-reviewer.html) | Reviews a measure against a checklist you control (DIVIDE vs /, FILTER over whole tables, variables, context transition and more). Instant checks on every measure, a Copilot review, and a rewrite tested against the original. | ✓ | ✓ |
| [Validation Query Builder](https://fosterbiservices.github.io/Power-BI-Toolkit/validation-query-builder.html) | DAX queries that check measure results, totals, reconciliation with source columns, relationship keys and table profiles. Several measures at once. | ✓ | — |
| [Time Intelligence Builder](https://fosterbiservices.github.io/Power-BI-Toolkit/time-intelligence-builder.html) | Year to date, quarter and month to date, last year, growth, rolling 12 months and more, with your fiscal year, as TMDL: measures for the measures you pick, or one calculation group. Includes a test query. | ✓ | — |
| [Field Parameter Builder](https://fosterbiservices.github.io/Power-BI-Toolkit/field-parameter-builder.html) | Pick and order measures or columns and get the TMDL for a measure switcher: a Power BI field parameter, or a SWITCH measure with a selector table and dynamic format string. Includes a test query. | ✓ | — |
| [Model Linter](https://fosterbiservices.github.io/Power-BI-Toolkit/model-linter.html) | Best Practice Analyzer-style checks on the model export: measures without a display folder or format string, visible key columns, bidirectional relationships, implicit measures and unused columns. Each finding explains why it matters and how to fix it; ignore what's intended and copy the rest to Excel. | ✓ | — |
| [Model Documenter](https://fosterbiservices.github.io/Power-BI-Toolkit/model-documenter.html) | One HTML document for the whole model: tables, measures, lineage, relationships, data sources, model checks and report pages. Reads a PBIP project folder in the browser, or works from your model export. | ✓ | — |
| [Power Query Explainer](https://fosterbiservices.github.io/Power-BI-Toolkit/power-query-explainer.html) | Comments every step of a Power Query (M) query, or produces a cleaner version checked against the original. One query or the whole model; custom functions are excluded automatically. | Own export | ✓ |
| [Date Table Generator](https://fosterbiservices.github.io/Power-BI-Toolkit/date-table-generator.html) | A date table with your fiscal year, weeks, month sort and filter columns, and rule-based holidays, as DAX, Power Query or a TMDL script. Can start and end with the dates in your data. | Date columns | — |
| [Theme Builder](https://fosterbiservices.github.io/Power-BI-Toolkit/theme-builder.html) | A complete Power BI report theme from one brand color: data palette, text, background, good/neutral/bad colors, font, text styles, icons and formatting for 27 visual types, with readability and color-blindness checks and a live preview. | — | — |

## Getting started

1. Open the [home page](https://fosterbiservices.github.io/Power-BI-Toolkit/).
2. **Export your model.** Copy the DAX query from Step 1, run it in **DAX query view** in Power BI Desktop, and select **Copy** above the results. The query reads the model's definition (tables, columns, measures, relationships), not your data.
3. **Paste it once** in Step 2. It's saved in your browser and every tool picks it up as it opens.
4. Choose a tool. Each one walks you through its own numbered steps.

Tip: rename the query tab in DAX query view (for example *Toolkit export*) and keep it. It's saved with the report, so refreshing the export later is just **Run** and **Copy**.

## Good to know

- **Your data stays with you.** The pages make no network requests with your content. The saved export lives in your browser's local storage for this site only, so it isn't shared with other browsers, other computers or other people.
- **One export at a time.** Pasting a model export into any tool also replaces the saved one, so every tool stays on the same model. Remove it any time from the home page.
- **Each tool keeps its own work** (requests, replies, settings) in your browser. **Clear entries** on a tool empties that tool only.
- **Examples.** Every tool opens with customer and sales sample content so you can see how it works. Your own paste replaces it.
- **Size limit.** Browsers allow about 5 MB of saved data per site. A very large model export may not fit; in that case paste it into each tool directly.
- **Always test before you change a model.** Generated DAX, M and TMDL are checked by the pages where possible, but run them against a copy or use the comparison and validation queries the tools provide before updating a production model.

## Requirements

- Power BI Desktop with **DAX query view** (and **TMDL view** for the TMDL outputs).
- For the Model Documenter's full document: the report saved as a **Power BI Project (PBIP)** with the TMDL model format (and the PBIR report format for report pages).
- A modern browser (Edge, Chrome or Firefox).
- Copilot is optional. The tools marked Copilot above work with any Copilot chat you have access to (Microsoft 365 Copilot or Copilot in Power BI).

## Repository layout

```
index.html                     Home page: shared model export and links to every tool
kpi-measure-builder.html
measure-describer.html
prep-for-ai-writer.html
dax-reviewer.html
validation-query-builder.html
power-query-explainer.html
date-table-generator.html
theme-builder.html
time-intelligence-builder.html
field-parameter-builder.html
model-documenter.html
model-linter.html
.nojekyll                      Tells GitHub Pages to serve the files as they are
```

Each page is self-contained: styles, scripts and the shared-export code are inside the HTML file, so any single page can also be downloaded and opened on its own. Opened from a local folder, some browsers won't share the saved export between pages; the hosted site doesn't have that limitation.

## Updating the site

Replace the changed HTML file(s) with the new version (same file name), then commit and push:

```powershell
git add .
git commit -m "Update tools"
git push
```

GitHub Pages republishes automatically within a minute or two. The site is served from the `main` branch, root folder (**Settings → Pages → Deploy from a branch**).
