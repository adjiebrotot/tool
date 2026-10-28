# PowerFactory Scripter: the reading pages

`build.mjs` writes two sets of static pages for search engines and answer engines, and for the
engineers who land on them:

| Pages | What they are | Made from |
|---|---|---|
| `../reference/` and `../reference/<Class>/` | the attribute reference: every name for `GetAttribute` / `SetAttribute`, one page per class (73), with units, meaning and a Python example | `../variables/` (the data the Builder's attribute suggestions read), `classes.mjs` |
| `../python/` and `../python/<slug>/` | the study guides: a hub and one page per study (7), each built the same way | `tasks/<slug>.mjs`, `scripts/*.py`, `results/*.json`, the Builder's Quick Starts |
| `../python/<slug>/*.py` | the full script the Builder writes for the guide's Quick Start | generated on build |

This folder starts with `_`, so the site (GitHub Pages with Jekyll) does not publish it.

## Fast on purpose

A page is plain HTML with one small stylesheet, `../docs.css`, on the site's tokens (`dark.css`,
`light.css`) and `theme.js`. No `shared.css`, no `shared.js`, no chart library: charts are inline
SVG drawn when the page is written, Python is highlighted when the page is written, and the only
script on a page is the theme toggle (and, on a reference page, a small filter over its tables).
The largest page is about 20 kB gzipped.

## Rebuild

From the repo root:

```
node powerfactory-scripter/_pages/build.mjs             # writes every page
node powerfactory-scripter/_pages/build.mjs --sitemap   # also puts their URLs in sitemap.xml
```

It stops when a curated attribute in `classes.mjs` is not in the data, a class has no entry in
`classes.mjs`, a result was not left as found, or a page has an em-dash in its text.

## Every number and every line of Python was run

- **Guide scripts** (`scripts/*.py`) are what the pages show, character for character. They run on
  PowerFactory 2024's example projects (Nine-bus System, 39 Bus New England System), through the
  sandbox copies the Builder's live tests use:
  `python <pfrun.py> powerfactory-scripter/_pages/run_scripts.py [name,...]` writes
  `results/<name>.json` (what the script computed and printed, and the sandbox audit).
- **Reference snippets** run with
  `python <pfrun.py> powerfactory-scripter/_pages/check_snippets.py [Class,...]`, on every class
  the sandboxes hold, putting back what they set.
- **Quick Starts** behind the guides' "Open in the Builder" (`builder/#qs=<id>`) are tested by
  `builder/_audit/templates/run.mjs`, whose live checks for `hosting-capacity`, `pv-curve` and
  `rms-batch` compare the Builder's own results with `results/*.json`.

`<pfrun.py>` is the local lock runner that keeps to one PowerFactory engine at a time, the same one
`PFB_PFRUN` points the Builder's live tests at.

## Frozen

The page addresses (`reference/<Class>/`, `python/<slug>/`, in `tasks.mjs` `ORDER`) and the
Quick Start ids the guides link to are kept for good once published. Change the words, not those.
