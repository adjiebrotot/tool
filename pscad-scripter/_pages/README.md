# PSCAD Scripter: the reading pages

`build.mjs` writes two sets of static pages for search engines and answer engines, and for the
engineers who land on them:

| Pages | What they are | Made from |
|---|---|---|
| `../reference/` and `../reference/<slug>/` | the component reference: every Master Library definition, one page each, with its parameters, their units, ranges, defaults and what each one means, and the Python that finds and writes them | `../reference/components.json`, `definitions.mjs` |
| `../python/` and `../python/<slug>/` | the study guides: a hub and one page per study, each built the same way | `tasks/<slug>.mjs`, the Builder's Quick Starts |
| `../python/<slug>/*.py` | the full script the Builder writes for the guide's Quick Start | generated on build, by running the real generator over the template |

This folder starts with `_`, so the site (GitHub Pages with Jekyll) does not publish it.

## Fast on purpose

A page is plain HTML with one small stylesheet, `../docs.css`, on the site's tokens (`dark.css`,
`light.css`) and `theme.js`. No `shared.css`, no `shared.js`, no chart library: charts are inline
SVG drawn when the page is written, Python is highlighted when the page is written, and the only
script on a page is the theme toggle (and, on a reference page, a small filter over its tables).

## Rebuild

From the repo root:

```
node pscad-scripter/_pages/build.mjs             # writes every page
node pscad-scripter/_pages/build.mjs --sitemap   # also puts their URLs in sitemap.xml
node pscad-scripter/_pages/build.mjs --urls      # print the URLs instead
```

It stops when a page has an em-dash or an en-dash in its text, and when a curated definition in
`definitions.mjs` is not in the reference data.

## Where the data comes from

`../reference/components.json` is not typed by hand. It is read out of a **running PSCAD** by
`../builder/_audit/reference/build_reference.py`, which walks the Master Library's definitions,
parses each one's parameter form, and asks a live instance of each component for the symbolic
values its Choice parameters take (those cannot be worked out from the form text: PSCAD's
"Behind the Source Impedance" is `BEHIND_SOURCE_IMPEDANCE`, and "R-R//L" is `RR_L`). Rebuild it
with PSCAD installed:

```
python pscad-scripter/builder/_audit/reference/build_reference.py
```

The header of each written file records which PSCAD it was read from, and the pages say so.

## The Python on the pages is the Python the Builder writes

A guide's "full script" is not hand-written. `tasks.mjs` runs the Builder's own generator
(`../builder/js/core/codegen.js`) over the real Quick Start template the guide links to, so the
page and the Builder can never drift apart. The Quick Starts themselves are checked by
`node pscad-scripter/builder/_audit/templates/build.mjs --check`, which generates and compiles
every one of them.

## Frozen

The page addresses (`reference/<slug>/`, `python/<slug>/`) and the Quick Start ids the guides
link to are kept for good once published. `definitions.mjs` `slugOf()` is what turns a definition
key into its address, so that function is frozen too. Change the words, not those.
