# SF Power BI Toolkit

Browser-based tools for building, documenting and checking Power BI semantic models, with or without Copilot.

**Open the toolkit:** https://fosterbiservices.github.io/Power-BI-Toolkit/

Every page is a single HTML file that runs entirely in your browser. There is nothing to install, no sign-in, and no server: your model details are never uploaded. When a tool uses Copilot, it writes a prompt that you paste into Copilot yourself, then it checks the reply you paste back.

## The tools

### No model needed

Open these and start. Some also use your saved model export if there is one.

| Tool | What it does | Model export | Copilot |
| --- | --- | :---: | :---: |
| [DAX Reviewer](https://fosterbiservices.github.io/Power-BI-Toolkit/dax-reviewer.html) | Reviews a measure against a checklist you control (DIVIDE vs /, FILTER over whole tables, variables, context transition and more). Instant checks on every measure, a Copilot review, and a rewrite tested against the original. | Optional | ✓ |
| [Power Query Writer](https://fosterbiservices.github.io/Power-BI-Toolkit/power-query-writer.html) | Describe a query in plain words (with the source, the starting columns, other queries and existing parameters) and get a Copilot prompt that writes it to work first time, stay easy to maintain and be as short as possible: one-word step names, short comments only where needed, explicit column lists and types, parameters instead of typed-in paths, query folding kept, and formatting in the style of powerqueryformatter.com. Copilot's reply is checked on the page: step references, naming, repeated steps, column names against the ones you gave, parameters and formatting. | — | ✓ |
| [Power Query Explainer](https://fosterbiservices.github.io/Power-BI-Toolkit/power-query-explainer.html) | Comments every step of a Power Query (M) query, or produces a cleaner version checked against the original. One query or the whole model, read from a PBIP folder or its own export; custom functions are excluded automatically. Writes a plain-language guide for business readers as a Word document. | Own export or a PBIP folder | ✓ |
| [Date Table Generator](https://fosterbiservices.github.io/Power-BI-Toolkit/date-table-generator.html) | A date table with your fiscal year, weeks, month sort and filter columns, and rule-based holidays, as DAX, Power Query or a TMDL script. Can start and end with the dates in your data. | Optional (date columns) | — |
| [Sheet Recon](https://fosterbiservices.github.io/Power-BI-Toolkit/sheet-recon.html) | Compares two tables from Excel or CSV (two files, or two sheets of one workbook) by a key you choose, including composite keys. Cleans both sides first: DAX column names like Sales[Amount], dates such as Sept 25, 2026, numbers and blanks. Shows rows found on only one side and every changed value, and downloads the results as Excel. | Excel or CSV files | — |
| [Layout Designer](https://fosterbiservices.github.io/Power-BI-Toolkit/layout-designer.html) | Plan a report page on an even grid (margin, gap, header with logo, cards and slicers, side panel, card strip, columns and rows). Answer a few questions for three layouts that follow the 3-30-3 framework (3 seconds: KPIs, 30 seconds: patterns, 300 seconds: details), or start from a layout and place and span visuals yourself. Get a wireframe with sample visuals, every visual's position, a designed background image (PNG/SVG), a Figma-ready copy and a PowerPoint with the layout as editable shapes. Colors from the Theme Builder, any theme file, or your own. | — | — |
| [Theme Builder](https://fosterbiservices.github.io/Power-BI-Toolkit/theme-builder.html) | A complete Power BI report theme from one brand color: data palette, text, background, good/neutral/bad colors, font, text styles, icons and formatting for 27 visual types, with readability and color-blindness checks and a live preview. | — | — |

### Tools that use your model

Export your model once from the home page (Steps 1 and 2); each of these tools loads it as it opens.

| Tool | What it does | Model export | Copilot |
| --- | --- | :---: | :---: |
| [KPI Measure Builder](https://fosterbiservices.github.io/Power-BI-Toolkit/kpi-measure-builder.html) | Describe measures in plain English. Copilot writes the DAX; the page checks every table, column and measure name and outputs tab-indented TMDL for your measures folder. | ✓ | ✓ |
| [Measure Describer](https://fosterbiservices.github.io/Power-BI-Toolkit/measure-describer.html) | Copilot writes descriptions for your measures in batches; you review them and save them to the model from DAX query view. | ✓ | ✓ |
| [Prep for AI Writer](https://fosterbiservices.github.io/Power-BI-Toolkit/prep-for-ai-writer.html) | AI instructions, synonyms, and table and column descriptions that help Copilot in Power BI answer questions about your model. | ✓ | ✓ |
| [Validation Query Builder](https://fosterbiservices.github.io/Power-BI-Toolkit/validation-query-builder.html) | DAX queries that check measure results, totals, reconciliation with source columns, relationship keys and table profiles. Several measures at once. | ✓ | — |
| [Time Intelligence Builder](https://fosterbiservices.github.io/Power-BI-Toolkit/time-intelligence-builder.html) | Year to date, quarter and month to date, last year, growth, rolling 12 months and more, with your fiscal year, as TMDL: measures for the measures you pick, or one calculation group. Includes a test query. | ✓ | — |
| [Field Parameter Builder](https://fosterbiservices.github.io/Power-BI-Toolkit/field-parameter-builder.html) | Pick and order measures or columns and get the TMDL for a measure switcher: a Power BI field parameter, or a SWITCH measure with a selector table and dynamic format string. Includes a test query. | ✓ | — |
| [RLS Role Generator](https://fosterbiservices.github.io/Power-BI-Toolkit/rls-role-generator.html) | Row-level security roles from fixed values, each user's own rows (USERPRINCIPALNAME) or an access table, as a TMDL script. Shows which tables each role restricts through your relationships, warns about tables left open, and writes a test query. | ✓ | — |
| [Model Linter](https://fosterbiservices.github.io/Power-BI-Toolkit/model-linter.html) | Best Practice Analyzer-style checks on the model export: measures without a display folder or format string, visible key columns, bidirectional relationships, implicit measures, unused columns and unused measures. Add a report's PBIP folder and it also checks every visual, filter and bookmark for column and measure usage (field parameters included when the folder holds the semantic model), and runs report checks: visuals without alt text, charts with the title off, hidden visuals no bookmark shows, bookmarks nothing uses, empty pages and pages with more visuals than your limit. Each finding explains why it matters and how to fix it; ignore what's intended and copy the rest to Excel. | ✓ | — |
| [About This Report](https://fosterbiservices.github.io/Power-BI-Toolkit/about-this-report.html
model-compare.html) | Suggestions for a report's About page: which parts to include and why (summary, business value, who it's for, questions it answers, key measures in plain words, how to use it, data sources, freshness, notes, owner), each drafted from your model and edited by you. Key measures are ranked with the About This Report Generator rules; data sources are named from a second query or a PBIP folder. Copy as text or Markdown; an HTML measure for an HTML content visual is optional. Copilot can polish the wording. | ✓ | Optional |
| [Model Compare](https://fosterbiservices.github.io/Power-BI-Toolkit/model-compare.html) | What changed between two model exports: tables, columns, measures and relationships added, removed, renamed or changed, with the DAX differences side by side and each change marked as "check reports", "change" or "housekeeping". The toolkit keeps your last few saved exports, so the "before" is usually already there. Copy release notes as Markdown or plain text, or the list for Excel. | ✓ | — |
| [Model Documenter](https://fosterbiservices.github.io/Power-BI-Toolkit/model-documenter.html) | One HTML document for the whole model: tables, measures, lineage, relationships, data sources, model checks and report pages. Reads a PBIP project folder in the browser, or works from your model export. | ✓ | — |

## Getting started

1. Open the [home page](https://fosterbiservices.github.io/Power-BI-Toolkit/).
2. **Export your model.** Copy the DAX query from Step 1, run it in **DAX query view** in Power BI Desktop, and select **Copy** above the results. The query reads the model's definition (tables, columns, measures, relationships), not your data.
3. **Paste it once** in Step 2. It's saved in your browser and every tool picks it up as it opens.
4. Choose a tool. Each one walks you through its own numbered steps.

Tip: rename the query tab in DAX query view (for example *Toolkit export*) and keep it. It's saved with the report, so refreshing the export later is just **Run** and **Copy**.

## Good to know

- **Long prompts go to Copilot as a file.** Every Copilot prompt has a **Download file** button: attach the .txt in Copilot and send the short message the page gives you. Prompts ask Copilot for one reply, as a downloadable file if it's too long for the chat, and every reply box can open that file (.txt, .md, .json or Word).

- **Your data stays with you.** The pages make no network requests with your content. The saved export lives in your browser's local storage for this site only, so it isn't shared with other browsers, other computers or other people.
- **One export at a time.** Pasting a model export into any tool also replaces the saved one, so every tool stays on the same model. Remove it any time from the home page.
- **Each tool keeps its own work** (requests, replies, settings) in your browser. **Clear entries** on a tool empties that tool only.
- **Examples.** Every tool opens with customer and sales sample content so you can see how it works. Your own paste replaces it.
- **Size limit.** Browsers allow about 5 MB of saved data per site. A very large model export may not fit; in that case paste it into each tool directly.
- **Always test before you change a model.** Generated DAX, M and TMDL are checked by the pages where possible, but run them against a copy or use the comparison and validation queries the tools provide before updating a production model.

## Disclaimer

- **AI can make mistakes.** Copilot replies can be wrong, incomplete or refer to objects that don't exist. The pages check what they can, but not every error in logic or meaning.
- **Check all of the work.** Everything the toolkit produces (DAX, Power Query, TMDL scripts, descriptions, themes, documents and lint findings), with or without AI, is a starting point to review. Confirm results against figures you trust.
- **Test on a copy first.** Back up your report or keep it under version control (PBIP and Git), and apply scripts to a copy before a production model.
- **No warranty, no liability.** The toolkit is provided free and "as is", without warranty of any kind, express or implied. Foster BI Services accepts no liability for incorrect information, errors, data loss, downtime, or any other loss or damage arising from its use or from relying on its output. Use it at your own discretion and risk.
- **Follow your organization's policies.** Only paste prompts into AI tools your organization approves. Model exports contain no data rows, but names, formulas and descriptions may still be confidential.
- **Shared computers.** Work is saved in the browser. On a shared computer, use **Clear entries** on each tool and remove the saved export from the home page when you finish.
- **Not a Microsoft product.** This toolkit isn't affiliated with or endorsed by Microsoft. Power BI and Copilot are trademarks of Microsoft Corporation.

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
power-query-writer.html
date-table-generator.html
theme-builder.html
layout-designer.html
sheet-recon.html
time-intelligence-builder.html
field-parameter-builder.html
model-documenter.html
model-linter.html
rls-role-generator.html
about-this-report.html
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
