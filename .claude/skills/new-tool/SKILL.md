---
name: new-tool
description: Build a new tool for the Adjie Brotools static site (tool.adjiebrotots.com) so it matches the existing tools in design, SEO, language, testing, and footer. Use when the user asks to create, scaffold, or add a new tool/calculator/visualiser to this repo, or asks how new tools should be built here.
---

# Building a new tool

Every tool here is a self-contained static page in its own folder (`<toolname>/index.html`,
`script.js`, `style.css`), 100% client-side, no build step. A new tool should feel like it
belongs next to the existing ones. These are the things that matter most — follow them, but
use judgement; copying a nearby tool that already does something well beats reinventing it.

## 1. Design — use the design reference

`_ref/design-reference.md` is the single source of truth for the look and feel (the "Generic
Soft UI" system: DM Sans / DM Mono, `dark.css` + `light.css` tokens, shared components). Read
it before writing markup, and reuse its components (control panel, tabs, sliders, KPI cards,
tables, tooltips, charts) rather than inventing new ones. Include the shared layers in order:

```html
<link rel="stylesheet" href="../dark.css">
<link rel="stylesheet" href="../light.css">
<link rel="stylesheet" href="../shared.css">
<link rel="stylesheet" href="style.css">   <!-- page-specific only -->
...
<script src="../shared.js"></script>       <!-- helpers: SharedFmt, tooltips, Persist… -->
<script src="script.js"></script>
```

The fastest way to stay consistent is to open the closest existing tool and mirror its
structure. Theme toggle, dark/light behaviour, and fonts should match the others exactly.

## 2. SEO — match the standard head + register the page

Copy the SEO block from an existing tool's `<head>` and adapt it: `<title>`, `<meta
name="description">`, canonical link, Open Graph + Twitter tags, and a JSON-LD `WebApplication`
block. Then register the tool site-wide:

- Add a `<url>` entry to `sitemap.xml`.
- Add the tool to `llms.txt` (and `README.md` if it's a headline tool).
- Keep the Google `gtag` snippet like the other pages.

## 3. Language & descriptions — plain and tight

- **No em-dashes** in user-facing copy. Use a comma, a full stop, or restructure.
- Simple language, but do not dumb down the technical meaning. Say it plainly and correctly.
- No walls of explanation. If a field needs a note, put it in a **tooltip** (`data-tip="…"`,
  rendered by the shared global tooltip), not inline paragraph text.
- If even a tooltip would be long, prefer **dynamic tooltiping** (progressive/on-demand
  detail) over dumping everything at once. Keep the page calm.

## 4. Do not touch the main index.html

The site's root `index.html` is the tool directory/landing page. **Do not add a new tool to it
unless the user explicitly asks.** Build the tool in its own folder and stop there.

## 5. Testing

Scale the rigor to the risk:

- **Finance / tax / engineering tools, or anything with calculation formulas the user will
  trust** — write an audit harness under `<toolname>/_audit/` (a `run.mjs` that drives the real
  page headless and checks the engine against an independent replay of the documented maths,
  plus edge cases). Follow the pattern in `financingvscash/_audit/`, `costofliving-comparator/_audit/`,
  etc. Verify calculation/formula/code integrity, not just that the page renders.
- **Plain utility/visualiser tools with no risky finance/engineering output** — a visual check
  is enough: load the page, exercise the main flow, confirm it looks right and nothing errors.

## 6. Disclaimer footer

- **Finance / tax / engineering tools** — include the full disclaimer footer (the "as is, no
  warranty, get your own professional advice" block) plus licence + made-in, as in
  `financingvscash/index.html` / `rentvsownhouse/footer.js`.
- **Plain tools with no potentially harmful finance/engineering content** — no disclaimer
  needed. Just the licence (GNU GPL) and the "Made in Australia by Indonesian engineer" line.

## Mini cache (nice to have)

Tools remember the user's work between visits via `Persist` in `shared.js`. When inputs map to
state, one line does it: `Persist.init('<toolname>', { onRestore: recompute })`. For state that
isn't in a form control (a JS array, a mode flag), pass an `extra: { save, restore }` and call
the returned `schedule()` after those changes. Mark transient controls (search boxes, editors)
with `data-no-persist`. See any recent tool's `script.js` for a worked example.

For a multi-language tool (an `en` page and an `id/` page sharing one `script.js`), use a
**language-agnostic namespace** (`'pisahvsgabung'`, not `'pisahvsgabung-en'`). `localStorage` is
per-origin, so both pages then share one cache and a user's work follows them across a language
switch instead of resetting.

## Two agents

For a genuinely independent audit, keep building and checking separate:

- **tool-builder** builds/edits the tool.
- **tool-auditor** reviews it against this checklist and, for calculation-heavy tools, verifies
  the maths independently.

Using a fresh auditor that did not write the code makes the audit real rather than a rubber
stamp.
