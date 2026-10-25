# Design Reference

This file documents the **Adjie family design system**: the tokens, components and
rules shared by www.adjiebrotots.com, this site and blog.adjiebrotots.com. The
three sites draw from one palette (the one the www homepage paints its skyline
in) and one set of devices; www wears them loudest, the tools and the blog
quieter.

**The family, in one screen**

- **Palette.** Navy ink on a sky ground by day (`#14203A` on `#F0F4FF`), the same
  sky at night (`#EAF1FF` on `#0F1728`). One blue in shades: `#0052CC` brand,
  `#3A71C8` fills and links, `#5A91E8` large marks only (it fails AA as text). Gold
  (`#B45309` / `#FFD28C`) is the warm opposite of the blue, the sun and the
  highlighter; teal is third. Roughly 60% ground, 30% ink and panels, 10% accent.
  Neutrals are tinted towards the navy, never flat grey.
- **The wordmark.** "Adjie" in ink, the rest (`Brotot`, `Brotools`, `Brotot Blog`)
  in `--brand`, solid, beside the circled-A logo. Never a gradient.
- **The family bar.** Logo and wordmark left; Home (www), Blog, Tools and the
  round sun and moon toggle right; the current site underlined.
- **The sticker.** What a reader can press wears an ink outline and a hard offset
  shadow (`--sticker`, 2px; www's homepage uses 3 to 4px and a tilt) that grows as
  it lifts on hover and goes flat when pressed. Surfaces at rest are flat: a step
  in tone, never a soft glow. Only what floats (menu, tooltip, dialog, sheet)
  wears `--shadow-lg`.
- **Type.** DM Sans for everything, on a major-third scale (`--fs-*`, 16px body).
  DM Mono only for figures that must line up (DM Sans has no tabular figures).
  Caveat for one handwritten aside a page at most, drawn from a `data-note`
  attribute so it never becomes page text. Small labels are sentence case, never
  tiny tracked capitals.
- **Day or night** follows the reader's pick, shared by the three sites through
  the `abt-theme` cookie on `.adjiebrotots.com` (`theme.js` here), else the
  device setting (www alone falls back to the clock in Perth).

Fonts: **DM Sans** (sans-serif) + **DM Mono** (figures) + **Caveat** (one aside),
served from `assets/fonts/` through `fonts.css`, never a font CDN.
Tokens live in `dark.css` (default) and `light.css` (applied via `body.light`).
Shared, theme-independent components live in `shared.css` / `shared.js`. Dropdowns live
in their own pair, `dropdown.css` / `dropdown.js`, so the home page (which loads neither
shared file) uses the very same ones.

To use this system in a new page, load `theme.js` straight after `<body class="light">`
(it picks day or night before the first paint and draws the toggle), include the
shared stylesheets and scripts (in this order), then layer your own page-specific
overrides on top:

```html
<body class="light">
<script src="theme.js"></script>
...
<link rel="stylesheet" href="dark.css">
<link rel="stylesheet" href="light.css">
<link rel="stylesheet" href="shared.css">   <!-- imports dropdown.css -->
<link rel="stylesheet" href="style.css">  <!-- your page-specific overrides -->
...
<script src="dropdown.js"></script>         <!-- before shared.js -->
<script src="shared.js"></script>
<script src="script.js"></script>
```

And add the font import at the top of your page's `style.css` (the path is
relative to the stylesheet):

```css
@import url('../fonts.css');
```

---

## Finance Tool Skeleton (the rules every finance tool keeps)

Every finance tool on the site (Rent vs Own and its Sensitivity page, Pisah vs
Gabung, Borrowing Capacity, Finance vs Cash, Financial Freedom, the DCA Scenario
Explorer and Portfolio, Cost of Living) is built on one skeleton, so what a
reader learns on one page carries to the next. `_ref/form-check.mjs` holds the
pages to it; a new finance tool joins its `PAGES` list and the `FINANCE` list in
`shared.js` (which switches on SharedBounds' native limits and SharedSlider's
automatic pass).

### The seven rules

1. **Group** related inputs in a `.field-group`, generic before specific.
2. **Self-explanatory titles, tooltips for the explanation.** Keep the field's
   own term, including the jargon the reader will meet elsewhere (Risk-Free
   Rate, Binding constraint, Pisah Harta, Net equity), and give it a one-line
   plain tooltip. Do not rename jargon into a sentence. Abbreviations are the
   exception: spell them out with the term in brackets ("Income cover (NSR)",
   "safe withdrawal rate (SWR)", "Estimated", not "Est.").
3. **The control fits the value.** A figure the reader knows exactly is typed;
   a guess (growth, inflation, a what-if) is a slider; a small count is a
   segmented control (`SharedSeg.fromSelect`, the `<select>` stays the field the
   tool reads and saves).
4. **The same structure on every tool** (below).
5. **Every input and output states its unit** (below).
6. **The form enforces the bounds** (below).
7. **Colour means the same thing everywhere** (below).

### Layout

Inputs, top to bottom: Quick Start and save/open, a first tab with the four to
six figures anyone knows (**Currency first**), topic tabs, then a last tab
called **Assumptions** (inflation, growth, simulation settings, fill timing).
Keep old tab ids when a tab is renamed (`data-tab="settings"` / `#tab-settings`
stay on Financial Freedom and DCA), so saved tabs and scenario files still land.

Outputs, top to bottom: the one-sentence answer (`.verdict`), three or four KPI
cards with the answer first, the main chart, other charts, per-option tiles,
tables (folded), and last the **What this assumes** card.

A display option that changes how results READ (today's money, chart metric,
candlesticks) sits beside the results it changes, never in the input panel.

### The answer: `.verdict` and `SharedVerdict`

```js
SharedVerdict.set('verdict', { tone: '', title: 'Owning ends <span class="v-num">$84,200</span> ahead after 30 years.', body: '…' });
```

`tone` is `''` for a fair comparison of options (rent or own, two loans, two
portfolios), `good` / `bad` / `warn` only for a pass or miss against a goal the
reader set. Handle ties and missing input in words ("ended level", "enter both
salaries"), never with a dash inside the sentence. When the options put
different money in, compare the return on it, not the final value (the DCA
verdicts).

### Units

The unit is the field's affix, never the label: currency before the number
(`.prefix`), everything else after it (`.suffix`). Vocabulary: `%`, `%/yr`,
`yrs`, `/mo`, `/yr`, `days`, `×`, `months`, `paths`, `points`. A per-period
amount pairs with a period select (`a week / a month / a year`), and the amount
follows its period (`SharedFreq`). The same holds for any control that changes
a field's unit when the two are comparable: money and a "%" of something, a
monthly and a weekly cadence, a household total with a share and each person's
own figure. The field is restated in the new unit so it describes the same
money ($32,000 on an $800,000 price becomes 4%, not 32,000%), rounded to the
field's own precision, and a switch back gives back what was typed. Only the
reader's own switch converts; a Quick Start or an opened file sets its figures
with its units. `_ref/unit-check.mjs` holds every such switch to the tool's
answer, which must not move. A field whose unit sits in a table's column
header declares it with `data-unit`; a field with no unit at all (a seed, a day
of month) carries `data-unitless`. Sentence-style rows ("From age 28 to 33",
"Grows 3 %/yr from today") keep the unit words in the sentence.

Outputs: every y axis names its unit (`Price ($)`, `Total tax (Rp a year)`,
`Balance, today's money`), every x axis is titled, and every table shows its
unit in its column headers (`.th-unit`, or `$ a month` in the label) or in its
cells (`$1,200`). A `.unit-note` over a table is for what neither can carry (the
currency of year columns, today's or future money, a running total) and is one
short sentence; a table whose headers and cells already say it all has none.
It never restates the title, explains a self-evident column or gives a usage
hint.

### Bounds

A typed number declares its range: native `min` / `max` / `step` on a number
field, `data-min` / `data-max` on a money text field. `SharedBounds` pulls a
value past either end back on change and says so ("Max 30 %/yr"); a blank field
stays blank. A field whose unit changes with a select (a share of living or an
amount) moves its `data-max` with it. `data-unbounded` opts out a threshold in
the price's own units. Sliders show both ends under them and take a typed value
in their readout (`SharedSlider`; call `SharedSlider.enhance(range)` for a
slider built after load, with `data-readout` naming its readout).

### Detail

One Simple/Detailed control per group it changes, labelled **Detail**, first in
that group. It carries no tip: Simple and Detailed say what they are, and the
fields that appear say the rest.

### Colour

Options a reader weighs (rent or own, separate or joint, loan offers,
scenarios, portfolios, assets) take the neutral sequence from `SharedPalette`:
blue, gold, teal, rose, purple, light blue, never red. Red and the positive blue
stay for direction: money out, a loss, a bar to clear. A picked colour is stored;
an unpicked one is a palette slot resolved in the current theme, so it follows
dark and light. Nothing is typed in as a hex: candles and histograms read
`--line-c` / `--line-b`, cash reads `--muted`, status boxes read the
`--info-*` / `--error-*` / `--success-*` / `--warning-*` tokens.

Why blue and gold first: CIEDE2000 distance under full-severity colour-vision
deficiency (Machado 2009):

| Pair | Theme | Normal | Protan | Deutan | Tritan |
| --- | --- | --- | --- | --- | --- |
| blue / gold | light | 49.2 | 55.9 | 55.9 | 69.5 |
| blue / gold | dark | 44.2 | 45.2 | 48.8 | 40.9 |
| blue / teal | light | 33.8 | 32.3 | 26.4 | **8.1** |
| blue / teal | dark | 27.5 | 25.5 | 21.1 | **6.2** |
| blue / purple | light | 27.8 | 14.8 | **9.4** | 51.8 |

Blue and gold stay apart for every kind; teal fails tritanopia and the light
purple fails deuteranopia, so they come later in the sequence. In dark mode
gold is also the warning text colour, so a gold series never carries a warning
meaning of its own.

### Tables and caveats

A year-by-year table, or any long table of working under the answer, opens
closed behind a chevron (`SharedFold.attach(card, {key, bodies})`): an
icon-only `▾` button, last in the head row after the `⬇ CSV` button, that turns
over when open; the title toggles it too. Its CSV button exports it either way.
Every tool closes with a `.assumes-card` listing what the answer rests on,
folded the same way and closed by default (`shared.js` folds every
`.assumes-card` at load, so the HTML stays an `<h2>` and a list), built by a
`renderAssumptions` call on every redraw from the reader's own plan rather than
written into the HTML:

- **Only what this plan uses.** A line belongs to a figure the reader entered,
  a choice they made, or a rule that touched their numbers. A feature left off,
  a cost left at nil or a field never shown says nothing (no Rent-Then-Buy line
  unless it is on, no fee line for a loan with no fee).
- **The figure, not the fact.** "Inflation is 2.5% a year", "the $640,000 loan
  is at a fixed 6%", "Living costs are $3,575 a month, the HEM benchmark for a
  couple in Perth", never "Inflation is modelled".
- **Nothing obvious.** Drop a line the reader could not have doubted, or one
  that only restates how the page is laid out.
- **Short.** Bold lead, one sentence after it; a longer reason goes in an (i)
  tip. Before there is anything to describe, one line says what to enter.

### Page text

No em-dashes in page text, tips or placeholders; a lone `—` marking an empty
cell is fine. When a tour changes, bump its `seenKey` version so returning
readers see it again (checks treat any `<tool>-tour-vN-seen` as seen).

### Tour steps

A tour shows where things are; the page and its (i) tips explain them.

- **Tour and Guide.** The header button reads `🧭 Tour`. A tool with a guide page
  (`<tool>/guides/`, built on `guide-shared.css` and `guide-shared.js`, its clips recorded
  from the real tool by `_ref/guide-capture/`) passes `guide: 'guides/'` in `window.__TOUR`:
  a `📖 Guide` button then sits beside Tour, and the last step, which has no Skip, offers
  "See guide for more details" with a `See Guide` button above Back and Done.

- **Short.** A lead line, or a `<ul>` of two to four points, each a fragment
  (`Simulated: model an asset from its return and volatility`). About 30 words
  at most.
- **Bold sparingly.** At most one or two terms a step: the control the reader
  must find or the one idea to remember. Never every option in a list.
- **End to end.** Start, inputs, run, answer, details, in the order a first
  visit meets them, so the reader knows each feature exists and where.

---

## CSS Variables & Theming

### `dark.css` (default — applies to `:root`)

```css
:root {
  --bg:#0F1728;--panel:#162033;--panel-raised:#1C2942;--text:#EAF1FF;--muted:#A8B6CF;--border:#2C3A52;
  --accent:#8DBBFF;--accent-strong:#B3D1FF;--accent2:#8FCDBD;--accent3:#FF8B8B;--gold:#FFD28C;
  --brand:#8DBBFF;--ink-line:#8DBBFF;
  --input-bg:rgba(255,255,255,0.06);--card-bg:rgba(255,255,255,0.03);--bg-subtle:#111C2F;--text-inv:#0F1728;
  /* Surfaces at rest are flat: a step in tone, never a glow. Only what really
     floats (a menu, a tooltip, a dialog, a bottom sheet) wears --shadow-lg. */
  --shadow:none;
  --shadow-sm:none;
  --shadow-lg:0 10px 30px rgba(2,6,16,0.55);
  /* The sticker: a hard offset in the ink line, the www homepage's signature,
     worn quieter here by buttons and cards a reader can press. */
  --sticker:2px 2px 0 var(--ink-line);
  --sticker-hover:3px 3px 0 var(--ink-line);
  /* A filled blue button needs an offset that differs from its own fill. */
  --sticker-accent:2px 2px 0 #3A71C8;--sticker-accent-hover:3px 3px 0 #3A71C8;
  /* Two corner sizes and the pill: --radius-sm for controls, --radius-lg for
     surfaces. The in-between names stay as aliases so older rules still read. */
  --radius-sm:8px;--radius-md:8px;--radius-lg:14px;--radius-xl:14px;--radius-2xl:14px;--radius-pill:999px;
  /* Type scale: a major third (1.25) on 16px. Five steps do the visible work. */
  --fs-xs:.8125rem;--fs-sm:.875rem;--fs-base:1rem;--fs-md:1.25rem;--fs-lg:1.5625rem;--fs-xl:1.953rem;--fs-2xl:2.441rem;
  /* Directional data colours */
  --positive:#0052CC;--positive-em:#7FB2FF;--negative:#E63939;--negative-em:#FF8B8B;
  --positive-bg:#10284D;--negative-bg:#4A1C1C;
  --positive-border:#2D67C7;--negative-border:#C85F5F;
  /* Aliases for legacy data-pos/data-neg naming */
  --data-pos:var(--positive);--data-pos-em:var(--positive-em);--data-pos-bg:var(--positive-bg);--data-pos-border:var(--positive-border);
  --data-neg:var(--negative);--data-neg-em:var(--negative-em);--data-neg-bg:var(--negative-bg);--data-neg-border:var(--negative-border);
  /* Status/feedback colours */
  --success-bg:#103529;--success-text:#9BE7B4;
  --error-bg:#4A1D26;--error-text:#FFB3BA;
  --warning-bg:#4A3412;--warning-text:#FFD28C;
  --info-bg:#132E56;--info-text:#A8C9FF;--info-border:#2D67C7;
  /* Chart tokens (dark) */
  --chart-text:#A8B6CF;--chart-grid:#2C3A52;
  /* Chart line colours */
  --line-a:#8DBBFF;--line-b:#FF8B8B;--line-c:#8FCDBD;--line-d:#F1C0D0;--line-e:#C9A7EB;
  --line-rtb-rent:#FFD28C;--line-rtb-own:#8DBBFF;
  /* Abbreviations (dashed underline + hover definition, see shared.css/.abbr) */
  --abbr-line:rgba(168,182,207,.42);--abbr-line-hover:rgba(141,187,255,.85);--abbr-hover-bg:rgba(141,187,255,.10);
  /* Scrollbars (see shared.css): both bars wear these colours site-wide */
  --scrollbar-thumb:#3C4C68;--scrollbar-thumb-hover:#5B7398;
  /* Motion */
  --motion-fast:150ms;--motion-base:250ms;--motion-slow:400ms;
  --transition-fast:var(--motion-fast);--transition-base:var(--motion-base);
}
```

### `light.css` (applied via `body.light`)

```css
body.light {
  --bg:#F0F4FF;--panel:#FFFFFF;--panel-raised:#FFFFFF;--text:#14203A;--muted:#4C5B76;--border:#DCE3F0;
  --accent:#3A71C8;--accent-strong:#0052CC;--accent2:#1F7F63;--accent3:#E66A6A;--gold:#B45309;
  --brand:#0052CC;--ink-line:#14203A;
  --input-bg:rgba(20,32,58,0.045);--card-bg:rgba(255,255,255,0.85);--bg-subtle:#F8FBFF;--text-inv:#FFFFFF;
  --shadow:none;
  --shadow-sm:none;
  --shadow-lg:0 10px 30px rgba(20,32,58,0.16);
  /* Redeclared, not inherited: a var() inside a token resolves where it is set. */
  --sticker:2px 2px 0 var(--ink-line);
  --sticker-hover:3px 3px 0 var(--ink-line);
  /* A filled blue button needs an offset that differs from its own fill. */
  --sticker-accent:2px 2px 0 #14203A;--sticker-accent-hover:3px 3px 0 #14203A;
  /* Directional data colours */
  --positive:#0052CC;--positive-em:#0052CC;--negative:#E63939;--negative-em:#C6382F;
  --positive-bg:#EAF2FF;--negative-bg:#FDECEC;
  --positive-border:#8FB5FF;--negative-border:#F3A5A5;
  /* Aliases for legacy data-pos/data-neg naming */
  --data-pos:var(--positive);--data-pos-em:var(--positive-em);--data-pos-bg:var(--positive-bg);--data-pos-border:var(--positive-border);
  --data-neg:var(--negative);--data-neg-em:var(--negative-em);--data-neg-bg:var(--negative-bg);--data-neg-border:var(--negative-border);
  /* Status/feedback colours */
  --success-bg:#C8F7C5;--success-text:#1A4A18;
  --error-bg:#FFB3BA;--error-text:#4A1018;
  --warning-bg:#FFF0D9;--warning-text:#7A4A00;
  --info-bg:#EAF2FF;--info-text:#174A9C;--info-border:#8FB5FF;
  /* Chart tokens (light) — dedicated per spec, NOT text.secondary */
  --chart-text:#4C5B76;--chart-grid:#C8D4E8;
  /* Abbreviations (dashed underline + hover definition, see shared.css/.abbr) */
  --abbr-line:rgba(110,124,142,.50);--abbr-line-hover:rgba(58,113,200,.85);--abbr-hover-bg:rgba(90,145,232,.09);
  /* Scrollbars (see shared.css): both bars wear these colours site-wide */
  --scrollbar-thumb:#C3D0E6;--scrollbar-thumb-hover:#9AB2D8;
  /* Chart line colours */
  --line-a:#5A91E8;--line-b:#E63939;--line-c:#4A9E87;--line-d:#C46A7E;--line-e:#9B59B6;
  --line-rtb-rent:#B45309;--line-rtb-own:#5A91E8;
}
```

**CRITICAL**: Never hardcode hex colours in JS rendering code (e.g. chart series) — always read
from CSS variables so colours adapt to both themes:

```js
const lineA = getComputedStyle(document.documentElement).getPropertyValue('--line-a').trim();
```

---

## Base Reset & Body

```css
*,*::before,*::after { box-sizing: border-box; min-width: 0; }

body {
  margin: 0;
  font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
  font-size: 15px;
  line-height: 1.5;
  color: var(--text);
  background: var(--bg);
  transition: background var(--transition-base), color var(--transition-base);
  overflow-x: hidden;
}

.mono { font-family: 'DM Mono', monospace; font-variant-numeric: tabular-nums; }
```

---

## Typography

```css
/* The scale (dark.css): a major third on 16px. */
--fs-xs:.8125rem; --fs-sm:.875rem; --fs-base:1rem; --fs-md:1.25rem; --fs-lg:1.5625rem; --fs-xl:1.953rem; --fs-2xl:2.441rem;

body { font-size: 16px; }
h1 { margin: 0 0 8px; font-size: var(--fs-xl); font-weight: 800; letter-spacing: -0.02em; }
h2 { margin: 0 0 10px; font-size: var(--fs-md); font-weight: 700; letter-spacing: -0.01em; }
h3 { margin: 0 0 8px; font-size: var(--fs-xs); color: var(--muted); font-weight: 700; }
p, .muted { color: var(--muted); line-height: 1.5; margin: 0; }
```

Labels (`h3`, `.group-title`, metric and tile labels) are sentence case at 13px,
never uppercase with tracking. Uppercase stays only where the content itself is
written that way (a ticker, a slot-machine marquee).

---

## Layout

```css
.container { max-width: 1400px; margin: 0 auto; padding: 24px; }

.card         { background: var(--card-bg);     border: 1px solid var(--border); border-radius: var(--radius-xl); box-shadow: var(--shadow); }
.panel        { background: var(--panel);       border: 1px solid var(--border); border-radius: var(--radius-xl); box-shadow: var(--shadow); }
.panel-raised { background: var(--panel-raised); border: 1px solid var(--border); border-radius: var(--radius-xl); box-shadow: var(--shadow-lg); }

.header {
  padding: 22px 28px;
  margin-bottom: 18px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

/* Two-column: sidebar (360px) + main (rest) */
.layout { display: grid; grid-template-columns: 360px 1fr; gap: 18px; }

/* Sidebar sticks while scrolling; with a .ctrl-scroll inside it is also capped
   to the viewport so its tab bar can stay pinned (see Control Panel below). */
.controls { padding: 0; position: sticky; top: 16px; align-self: start; overflow: hidden; }

.canvas-wrap { position: relative; width: 100%; height: 380px; }
```

### Responsive Breakpoints

```css
@media (max-width: 1100px) {
  .layout, .bottom, .metrics { grid-template-columns: 1fr; }
  .controls { position: static; }
  .canvas-wrap { height: 380px !important; }
  .summary-grid { grid-template-columns: repeat(2, 1fr); }
  .header { flex-direction: column; gap: 10px; padding: 16px 18px; }
  .container { padding: 16px; }
}

@media (max-width: 600px) {
  h1 { font-size: 1.35rem; }
  .container { padding: 10px; }
  .summary-grid { grid-template-columns: 1fr 1fr; }
  .metrics { grid-template-columns: 1fr; }
  .btn-row { flex-direction: column; }
  .header { padding: 14px 16px; }
}
```

---

## Dark / Light Toggle Button (in header)

```html
<button class="btn-theme" id="themeToggle">🌙 Dark</button>
```

The tool keeps its own click handler (it re-draws the charts); `theme.js` does the
rest: it sets the starting class from the reader's pick (cookie `abt-theme`, shared
with www and the blog), else the tool's old key, else the device setting; it keeps
the old keys (`pf-theme`, `fvc-theme`, `jv-theme`) in step; it saves a reader's
click (never one from code, such as an embed asking for its theme); and it redraws
the button as the round sun and moon of the other two sites, whatever text the
tool writes into it. A page that flips `body.dark` instead of `body.light` says so
with `<body data-dark-class="dark">`.

**One header button, every page, all three sites.** 36px tall, 14px semibold text,
12px sides, 8px corners, a 1.5px ink outline and the 2px sticker; the theme toggle
is the same height, round and icon-only (the sun by day, the moon at night; its
label says what a press does: "Switch to night" / "Switch to day"). The language
switch is a globe and the other language's code (`ID` / `EN`), the same on the
tools and the blog. The way back is `← Other Tools` (or `← Back to …` on a
sub-page) with `class="btn-theme btn-back"`. The links in the family bar (Home,
Blog, Tools) are 36px tall too. www's homepage keeps its louder 44px toggle.

```css
/* shared.css: the header buttons wear the sticker. */
.btn-theme { height: 36px; padding: 0 12px; font-size: 14px; font-weight: 600;
  background: var(--panel); border: 1.5px solid var(--ink-line); color: var(--text);
  border-radius: var(--radius-sm); box-shadow: var(--sticker); }
.btn-theme:hover  { transform: translate(-1px,-1px); box-shadow: var(--sticker-hover); }
.btn-theme:active { transform: translate(1px,1px); box-shadow: 0 0 0 var(--ink-line); }
.btn-theme.theme-ico { width: 36px; height: 36px; border-radius: var(--radius-pill); }
```

```js
$('themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('light');
  $('themeToggle').textContent = document.body.classList.contains('light') ? '🌙 Dark' : '☀️ Light';
});
```

---

## Control Panel (Sidebar)

### Tab Bar

The tab bar is **locked to the top of the card**: wrap the tabs and the panels in
`.ctrl-scroll` and that wrapper becomes the only part that scrolls, so the tabs
stay reachable however far down the panel you are. Anything placed *before*
`.ctrl-scroll` (a quick-start row) stays put as well.

```html
<aside class="controls card">
  <div class="quick-start-row">…</div>      <!-- optional, stays on top -->
  <div class="ctrl-scroll">
    <div class="ctrl-tabs">
      <button class="ctrl-tab active" data-tab="inputs"><svg class="tico" …></svg> Inputs</button>
      <button class="ctrl-tab" data-tab="advanced"><svg class="tico" …></svg> Advanced</button>
    </div>
    <div class="ctrl-panel active" id="tab-inputs">…</div>
    <div class="ctrl-panel" id="tab-advanced">…</div>
  </div>
</aside>
```

```css
/* All three live in shared.css — a tool only opts in with .ctrl-scroll */
.controls:has(.ctrl-scroll) { display: flex; flex-direction: column; max-height: calc(100vh - 32px); }
.ctrl-scroll { flex: 0 1 auto; min-height: 0; overflow-y: auto; }
.ctrl-tabs { display: flex; border-bottom: 1px solid var(--border);
             position: sticky; top: 0; z-index: 3; background: var(--panel); }
.ctrl-tab {
  flex: 1; padding: 13px 10px; text-align: center; font-weight: 700; font-size: 0.88rem;
  cursor: pointer; color: var(--muted); background: transparent; border: none;
  border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all var(--transition-fast);
  font-family: inherit;
}
.ctrl-tab.active { color: var(--text); border-bottom-color: var(--accent); }
.ctrl-panel { display: none; padding: 16px 18px 20px; }
.ctrl-panel.active { display: block; }
```

### The card opens folded (SharedCtrl)

A `.controls` card that is a direct child of `.layout` opens **folded**, so a
reader lands on the answer, not on forty fields. shared.js does it; a tool writes
nothing. Beside the results the card folds to a 56px "Inputs" rail (the open
icon above the word, set vertically; no glyph, which would read as Settings) and the results take the width;
stacked above them on a phone it folds to one "Inputs" bar. Open and Hide are one
icon, two chevrons pointing the way the card moves: right or down to open, left or
up to hide. The open icon lights up and pulses three times on arrival; there is no
callout and no label on the button. Open, Hide sits at the end of the Quick Start
row, beside save and open, so the fold adds no row of its own; the scenario
buttons drop to a line of their own under it. The choice is kept per page
on this device (`abt:ctrl:<path>`); nothing in the fold is a field, so the mini
cache, scenario files and Share links never see it.

Anything that needs the card on screen holds it open, then lets go:
`SharedCtrl.hold('tour', true)` … `SharedCtrl.hold('tour', false)`. The tour
does this for its whole run; the load flow inspector does it while something is
selected in the sheet. `SharedCtrl.open()` opens it for good. A browser check that
drives fields inside the card seeds the open state in its init script
(`localStorage.setItem('abt:ctrl:' + location.pathname…, '1')`), as every check
in `_ref/` does.

A sidebar with four or more tabs stacks the icon above the label: add `stacked`
to the tab bar (`<div class="ctrl-tabs stacked">`) and shared.css turns each
button into a centred column. `borrowingcapacity/` and `financialfreedom/` do this.

### Tab Icons (`.tico`) — never emoji

Tab icons are **hand-drawn inline SVG**, not emoji: emoji carry the platform's own
palette and metrics, so they break the page's colour system and sit differently on
every device. A `.tico` is a 24×24 glyph drawn with `stroke="currentColor"`, so it
follows the button's colour in both themes and lights up with the active tab.

```html
<button class="ctrl-tab" data-tab="caps">
  <svg class="tico" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3.5 4h17"/><path d="M12 20.5V8.5"/><path d="M7.2 13.3 12 8.5l4.8 4.8"/>
  </svg><span>Caps</span>
</button>
```

- **Draw the meaning, not the emoji.** The glyph replacing 🔬 on a Sensitivity tab is a
  tuning dial, not a microscope; the one replacing 📐 on a Caps tab is an arrow stopped
  by a ceiling. Ask what the tab *does*, then draw that.
- **Reuse only for the same job.** Settings is the same gear everywhere. Anything else
  gets its own glyph, so two tabs never share a picture for two different things.
- **Keep the optical weight even.** Stroke 1.8 suits most shapes; a thin diagonal
  (a staircase, an axis pair) needs 2.0–2.2 to sit next to a solid one.
- `.tico` is styled in shared.css; a tool only sizes it when a tab bar needs
  something other than 1.35em.

Emoji outside a tab bar are fine where they are decoration rather than an icon
(the 🧭 tour launcher, a 👋 welcome, a 🙂 in a footer line, the footer flags).
The theme toggle is the one exception: it is the drawn sun and moon of the
family bar (`theme.js`), the same on all three sites. Buttons follow the same rule: see
**Buttons and Icons** for the one picture each job gets.

### Field Group (grouping rows in a control panel)

Related rows in a control panel go in a `.field-group`: a tinted, rounded box with a
small sentence-case `.group-title` in the strong accent. Styled in shared.css, so a tool writes only the markup.
Put a lone setting that belongs to no group (a currency picker at the top of a tab)
outside any box rather than in a one-row group.

```html
<div class="field-group">
  <div class="group-title">Costs of Owning</div>
  <div class="field-row">…Costs Mode…</div>
  <div class="fg-sub" id="ownCostsSimple">   <!-- rows shown/hidden together -->
    <div class="field-row">…Setup Cost…</div>
    <div class="field-row">…Ongoing Costs…</div>
  </div>
  <div class="fg-body">…free-form content that is not a row…</div>
</div>
```

- Every `.field-row`, `.toggle-row` and `.slider-block` in a group is ruled off from
  the one above it, the first included, so hiding a row never leaves a doubled or
  missing hairline. Drop any inline `border-top:none;padding-top:0` a row carried as
  the first thing in its panel.
- `.fg-sub` is a plain wrapper for a run of rows that show or hide as one (a Simple /
  Detailed mode). Its rows are ruled like the group's own.
- The first group in a `.ctrl-panel` sits flush with the panel's padding.

The older bare `.section-label` (an uppercase label with an underline, rows loose
below it) is still used for headings that sit over something other than form rows,
such as the loaded-asset chips in the DCA Data tab. Do not use it to head form rows.

### Slider Block

```html
<div class="slider-block">
  <div class="slider-head">
    <div class="slider-label">Annual growth rate</div>
    <div class="slider-value" id="growthRateValue">7.00%</div>
  </div>
  <input id="growthRate" type="range" min="0" max="20" step="0.1" value="7" />
  <div class="help">Expected annual return compounded each year.</div>
</div>
```

```css
.slider-block { padding: 12px 0 16px; border-top: 1px solid var(--border); }
.slider-block:first-of-type { border-top: none; padding-top: 4px; }
.slider-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 7px; }
.slider-label { font-weight: 700; font-size: 0.9rem; }
.slider-value {
  color: var(--accent);
  font-weight: 700;
  font-family: 'DM Mono', monospace;
  font-variant-numeric: tabular-nums;
  font-size: 0.9rem;
}
input[type=range] { width: 100%; accent-color: var(--accent); cursor: pointer; }
.help { color: var(--muted); font-size: 0.82rem; margin-top: 5px; line-height: 1.4; }
```

### Field Row / Number / Text / Currency Inputs

```html
<div class="field-row">
  <div class="field-label">Starting amount</div>
  <div class="affix-wrap">
    <span class="prefix">$</span>
    <input class="affix-input" id="startingValue" type="text" inputmode="decimal" value="500,000" />
  </div>
  <div class="field-sub">Initial investment or purchase price in dollars.</div>
</div>
```

```css
.field-row { display: flex; flex-direction: column; gap: 5px; padding: 10px 0 14px; border-top: 1px solid var(--border); }
.field-row:first-of-type { border-top: none; }
.field-label { font-weight: 700; font-size: 0.9rem; }
.field-sub { color: var(--muted); font-size: 0.8rem; line-height: 1.35; margin-top: 2px; }

.num-input {
  background: var(--input-bg);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text);
  font-family: 'DM Sans', sans-serif;
  font-size: 0.92rem;
  font-weight: 500;
  padding: 10px 13px;
  width: 100%;
  outline: none;
  transition: border-color var(--transition-fast);
  font-variant-numeric: tabular-nums;
}
.num-input:focus { border-color: var(--accent); background: var(--panel); }

.txt-input {
  background: var(--input-bg);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text);
  font-family: 'DM Sans', sans-serif;
  font-size: 0.92rem;
  font-weight: 500;
  padding: 10px 13px;
  width: 100%;
  outline: none;
  transition: border-color var(--transition-fast);
}
.txt-input:focus { border-color: var(--accent); background: var(--panel); }
.txt-input::placeholder { color: var(--muted); }

/* Affix input: any number or text field, with optional prefix/suffix unit
   labels (none at all is fine: the input then keeps its plain inset).
   .prefix = currency symbol, before the number ("$", "Rp").
   .suffix = percentage or other unit, after the number ("%", "yrs", "/mo");
   the input also gets .has-suffix. A field with a $/% selector switches
   side with SharedFmt.setAffix(wrap, prefix, suffix) — never put "%" in a
   .prefix. */
.affix-wrap { position: relative; }
.affix-wrap .prefix,
.affix-wrap .suffix {
  position: absolute; top: 50%; transform: translateY(-50%);
  color: var(--muted); font-weight: 700; font-size: 0.88rem; pointer-events: none;
}
.affix-wrap .prefix { left: 11px; }
.affix-wrap .suffix { right: 11px; }
.affix-input {
  background: var(--input-bg);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text);
  font-family: 'DM Sans', sans-serif;
  font-size: 0.92rem;
  font-weight: 500;
  padding: 10px 13px;
  width: 100%;
  outline: none;
  transition: border-color var(--transition-fast);
  font-variant-numeric: tabular-nums;
}
.affix-input:focus { border-color: var(--accent); background: var(--panel); }
.affix-wrap :where(.prefix:not([hidden])) ~ .affix-input { padding-left: 32px; } /* only when a prefix shows */
.affix-wrap .affix-input.has-suffix { padding-left: 13px; padding-right: 42px; }
.affix-wrap .prefix:not([hidden]) ~ .affix-input.has-suffix { padding-left: 32px; }
.affix-wrap .prefix[hidden], .affix-wrap .suffix[hidden] { display: none; }
```

For live thousand-separator formatting, use `shared.js`:

```js
SharedFmt.attachCurrencyInput(document.getElementById('startingValue'), { maxDecimals: 0 });
// To read the numeric value back:
const value = SharedFmt.parseFormatted(document.getElementById('startingValue').value);
```

### Dropdowns: one look, two kinds (`dropdown.css`, `dropdown.js`)

Every dropdown on the site, the home page included, comes from one pair of
files at the root: `dropdown.css` (imported by `shared.css`; the home page links
it) and `dropdown.js` (loaded just before `shared.js`). Which kind a list gets
depends on the list, not on the tool:

| The list | Use | Search |
| --- | --- | --- |
| Short and fixed: periods, currencies, a scenario, a font, a few loaded tickers | a plain `<select>` | no |
| Database-sized, painful to scroll one by one: hundreds of cities, time zones, PowerFactory variables | a searchable combobox (`.combo-input` + `.combo-list`) | yes |

If the whole list would fit on the page, it is a plain select. Search is only
for the database-looking ones.

**A plain select needs no class.** Every `<select>` gets the field look:
DM Sans named outright (so a select in a mono table cell or an uppercase header
still matches), weight 500, `--input-bg`, a 1.5px `--border`, `--radius-md`, the
chevron, and `--accent` on focus. `.sel-input` is the full-width form field and
`.sel-sm` the compact one. When a select is clicked with a mouse, `dropdown.js`
opens its list in the shared `.combo-list` panel: no lines between rows, the row
under the pointer or arrow keys filled with `--accent`, and the chosen row in
bold. A pick sets the select and fires `input` then `change`, the same as the
browser's own list, so nothing that reads, sets or saves the select changes.
Keyboard and touch keep the browser's own picker (screen readers, the phone's
sheet). Add `data-native` to a select to opt it out.

A tool may **size** a dropdown (width, padding, font-size, `--radius-sm` on a
compact one, and `--sel-pad` / `--sel-chev` to move the chevron in), but never
re-colour, re-border or re-font it, and never writes its own `option` colours.
`_ref/dropdown-check.mjs` holds every page to this.

The spec, for reference (all of it is in `dropdown.css`; a tool writes none of it):

| Part | Values |
| --- | --- |
| Field (`select`, `.combo-input`) | DM Sans, weight 500, `.92rem`, padding `10px 13px`, `--input-bg`, `1.5px solid var(--border)`, `--radius-md`, `--accent` border on focus, `--motion-fast` |
| Chevron | 12px, `--muted` colour per theme (`--sel-chevron`), `right 10px` (`--sel-chev`), text kept clear by `padding-right: 30px` (`--sel-pad`) |
| Compact field (`.sel-sm`, toolbars, table cells) | `.82rem`, padding `6px 10px`, `--radius-sm`, `--sel-pad: 26px`, `--sel-chev: 8px` |
| Open list (`.combo-list`) | `--panel`, `1.5px solid var(--border)`, `--radius-sm`, `--shadow-lg`, padding `4px`, max height 280px, DM Sans weight 400, z-index 9500 |
| Row (`.combo-opt`) | padding `6px 10px`, radius 5px, no dividers; hover / `.focused`: `--accent` fill with `--text-inv` text; `.selected`: weight 600 |
| Chip (`.combo-chip`) | pill, `.72rem`, weight 500, `--input-bg` fill, 1px `--border`, `--muted` text; outlined in the row's colour when the row is lit |
| Second line (`.combo-sub`) / group label (`.combo-group`) | `.76rem` `--muted` / `.7rem` uppercase `--muted`, weight 700 |

```css
/* A compact select in a toolbar or table cell: size only. */
.ctrl-select { font-size: .82rem; padding: 6px 10px; border-radius: var(--radius-sm); --sel-pad: 26px; --sel-chev: 8px; }
```

### Searchable Combobox (`.combo-input` + `.combo-list`)

For a database-sized list only (see the table above). The field is a text input
with `.combo-input`, which looks exactly like a select without the chevron; the
list is a `.combo-list` of `.combo-opt` rows, the same panel `dropdown.js` uses
for a plain select. Search matches every typed word anywhere in the row's text
(city, state, country, currency), so "paris france" works.

Each row puts its label in `.combo-main`. A short tag that helps scanning (a
country, a unit) goes in a `.combo-chip` on the right; a second line (a
description, a UTC offset) goes in a `.combo-sub`, with the two lines wrapped in
`.combo-text`. Mark the row the arrow keys are on with `.focused`, the current
value with `.selected`, and say "nothing found" with a `.combo-empty`.

```html
<div class="city-picker">
  <input class="city-search combo-input" type="text" placeholder="Search city…" autocomplete="off">
  <div class="city-dropdown combo-list" role="listbox">
    <div class="combo-opt selected" role="option"><span class="combo-main">Santa Barbara, CA</span><span class="combo-chip">United States</span></div>
    <div class="combo-opt" role="option"><span class="combo-text"><span class="combo-main">Jakarta</span><span class="combo-sub">Indonesia · GMT+7</span></span></div>
  </div>
</div>
```

The tool keeps only the picker's own states (`.has-value`, the clear button) and
where the list sits. Put it under its field with
`SharedDropdown.place(input, list, {minWidth: 300})` on open, scroll and resize:
it is fixed to the viewport, so a narrow column or a scrolling table cannot clip
it or squeeze it. Working examples: the Cost of Living Comparator's city picker,
the World Clock's place picker, PowerFactory's `PFComboBox`, and Rent vs Own's
Quick Start city (its Sensitivity page puts the search field at the top of the
list, under a bolt in the first column's header).

### Segmented Control Group (`.seg-group`)

A group of mutually-exclusive toggle buttons styled as a single segmented control
(e.g. "Simple / Detailed", "Save / Earn").

Its width is not the author's job: `SharedSegFit` (`shared.js`) measures every
`.seg-group` on the page, including ones drawn later, and sizes it to its line.

- **Alone on its line** in a form column (no wider than 560px) or already drawn
  full width, it fills the line and its buttons share the width (`.seg-fill`),
  so two short options never leave a gap beside them.
- **Too many options for the line**, its buttons tighten first (`.seg-tight`),
  then settle into even rows with the last button spanning what is left
  (`.seg-grid`), so a wrap never leaves one button alone on a second row.
- **Beside its label** (a Detail row, an inline field) it keeps its natural size,
  and so does one in a wide toolbar or a table cell. `data-seg-fit="off"` opts a
  group out.

```html
<div class="toggle-row">
  <span class="toggle-label">I want to do it</span>
  <div class="seg-group" id="modeGroup">
    <button class="seg-btn active" data-val="simple">Simple</button>
    <button class="seg-btn" data-val="detailed">Detailed</button>
  </div>
</div>
```

```css
.seg-group {
  display: inline-flex;
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 3px;
  gap: 2px;
}
.seg-btn {
  background: transparent;
  border: none;
  border-radius: 7px;
  padding: 5px 14px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--muted);
  cursor: pointer;
  transition: all 140ms;
  font-family: inherit;
  white-space: nowrap;
}
.seg-btn.active { background: var(--accent-strong); color: #fff; box-shadow: var(--shadow-sm); }
.seg-btn:hover:not(.active) { color: var(--text); }
```

```js
// Wire up segmented control
document.querySelectorAll('[data-val]').forEach(btn => {
  btn.addEventListener('click', () => {
    const group = btn.closest('.seg-group');
    group.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // Dispatch custom event or call handler
    group.dispatchEvent(new CustomEvent('change', { detail: { value: btn.dataset.val } }));
  });
});
```

### Radio Group (mutually exclusive options)

```html
<div class="field-row">
  <div class="field-label">Strategy</div>
  <div class="field-sub">Choose how to treat option X:</div>
  <div class="radio-group">
    <label class="radio-opt selected">
      <input type="radio" name="strategy" value="optionA" checked />
      <div class="radio-opt-text">
        <strong>Option A — Growth Focus</strong>
        Reinvests all returns back into the asset for maximum compounding.
      </div>
    </label>
    <label class="radio-opt">
      <input type="radio" name="strategy" value="optionB" />
      <div class="radio-opt-text">
        <strong>Option B — Income Focus</strong>
        Takes distributions as cash each year, traded for slower capital growth.
      </div>
    </label>
  </div>
</div>
```

```css
.radio-group { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.radio-opt {
  display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px;
  background: var(--input-bg); border: 1.5px solid var(--border);
  border-radius: var(--radius-md); cursor: pointer; transition: border-color var(--transition-fast);
}
.radio-opt:hover { border-color: var(--accent2); }
.radio-opt.selected { border-color: var(--accent); background: rgba(139,184,248,0.08); }
body.light .radio-opt.selected { background: rgba(139,184,248,0.10); }
.radio-opt input[type=radio] { margin-top: 2px; accent-color: var(--accent); flex-shrink: 0; }
.radio-opt-text { font-size: 0.82rem; line-height: 1.45; color: var(--muted); }
.radio-opt-text strong { color: var(--text); font-weight: 700; display: block; margin-bottom: 2px; font-size: 0.88rem; }
```

### Toggle Switch

```html
<div class="toggle-row">
  <div class="toggle-label">Enable advanced mode</div>
  <label class="toggle-switch">
    <input type="checkbox" id="advancedToggle" />
    <span class="toggle-track"><span class="toggle-knob"></span></span>
  </label>
</div>
```

```css
.toggle-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-top: 1px solid var(--border); }
.toggle-label { font-weight: 700; font-size: 0.88rem; flex: 1; }

.toggle-switch { position: relative; width: 40px; height: 22px; flex-shrink: 0; }
.toggle-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
.toggle-track {
  position: absolute; inset: 0; background: var(--input-bg); border: 1px solid var(--border);
  border-radius: 999px; cursor: pointer; transition: background var(--motion-base);
}
.toggle-switch input:checked + .toggle-track { background: var(--accent); border-color: var(--accent); }
.toggle-track .toggle-knob {
  position: absolute; top: 2px; left: 2px; width: 16px; height: 16px;
  border-radius: 50%; background: #fff; transition: transform var(--motion-base);
}
.toggle-switch input:checked + .toggle-track .toggle-knob { transform: translateX(18px); }
```

### Warning Banner

```html
<div class="warning visible" id="capWarning">Heads up — value exceeds the recommended cap.</div>
```

```css
.warning {
  margin: 0 18px 14px; padding: 10px 13px; border-radius: var(--radius-md);
  background: var(--warning-bg); border: 1px solid rgba(255,210,140,0.3);
  color: var(--warning-text); display: none; font-size: 0.84rem; line-height: 1.5;
}
.warning.visible { display: block; }
```

### Buttons Row

```html
<div class="btn-row">
  <button class="btn-primary" id="resetBtn">↺ Reset to defaults</button>
  <button class="btn-secondary" id="downloadBtn">⬇ Download CSV</button>
</div>
```

#### When Reset and Simulate earn their place

Neither is a default. Both have to be argued for, and the argument is about the
tool, not the layout.

**Simulate** is a gate, and a gate is only worth having when passing through it
costs something. Time one recompute on the real page before deciding:

| One recompute | What to build |
| --- | --- |
| Under ~50ms | No button. The output follows the inputs, debounced if a drag or a held key would thrash it. |
| Roughly 50–150ms | Judgement. A phone is several times slower than the desk it was measured on. |
| Over ~150ms, or it fetches anything | A real gate. Let the reader finish the plan before it runs. |

A gate has to actually gate. A Simulate button that only skips a debounce the
page is already running is a placebo: it tells the reader the answer waited for
them when it did not. And a gated page still has to keep the FORM live —
currency prefixes, a slider's bounds, which fields the chosen mode shows — while
saying plainly that the ANSWER is out of date. `financialfreedom` does this:
`syncForm()` on every keystroke, `markStale()` to dim the results and light the
button, `render()` only from Simulate.

A **sensitivity control stays outside the gate**, however heavy the engine.
Sweeping it *is* the question the reader came to ask, and one you have to press
a button after is not a sensitivity control. Give it a live readout and put the
recompute behind a short debounce so the drag stays smooth. Because that
recompute reads the whole form, it runs anything staged but not yet simulated —
so it clears the stale mark rather than leaving it up, which is honest: what is
on screen afterwards really is the plan the form describes. `financialfreedom`'s
retirement-age slider is the worked example.

Where such a control has a **right answer the page already computes, default it
to that** rather than to a round number, and re-seed it only when a whole plan is
applied — at load, from a Quick Start, or back to the defaults. After that the
control is the reader's and nothing moves it. `financialfreedom` seeds the
retirement age from the plan's own freedom age (`seedRetireAge()`), falling back
to the far end of the scale when a plan never reaches freedom.

**Reset** is redundant the moment the tool has Quick Start scenarios, because
every scenario is a reset with a worked example laid over it — and a worked
example is a better place to land than an empty form. Two conditions before
dropping the button:

1. Each scenario must open from the defaults, not from whatever is on screen
   (`resetAll()` first, then the scenario's own values), so no field, mode or
   hidden collection survives the switch.
2. Anything Reset did that a scenario does not — clearing downloaded data, for
   instance — must live on its own control. `dcasimulator` keeps that on
   **Clear all** in the Data tab.

Every finance tool now has Quick Start scenarios and no Reset: Pisah vs Gabung
dropped its button once its "Equal incomes, no children" scenario covered it. Keep Reset on a tool
with no scenarios, and keep it where it means *empty the canvas* rather than *go
back to the start*
(`sankeycreator`'s Reset restores the demo, Clear empties the table).

```css
.btn-row { display: flex; gap: 10px; flex-wrap: wrap; padding: 14px 18px 18px; border-top: 1px solid var(--border); }

.btn-primary {
  background: var(--accent);
  color: var(--text-inv);
  border: none;
  border-radius: var(--radius-md);
  padding: 11px 22px;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  transition: opacity var(--transition-fast), transform var(--transition-fast);
  font-family: inherit;
  letter-spacing: 0.01em;
}
.btn-primary:hover { opacity: 0.88; }
.btn-primary:active { transform: scale(0.97); }

.btn-secondary {
  background: var(--input-bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 11px 22px;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  transition: border-color var(--transition-fast);
  font-family: inherit;
}
.btn-secondary:hover { border-color: var(--accent); }
.btn-secondary:active { transform: scale(0.97); }
```

---

## Buttons and Icons

A reader who learns a button on one tool should be able to read it on the
next. Four rules make that true, and `node _ref/button-check.mjs` holds every
page to them. `_ref/button-map.md` lists every button on every tool by the job
it does, so a new tool can copy the row it needs instead of inventing one.

### 1. One picture per job

The pictures that carry a meaning are drawn once, in `shared.js`
(`SharedIcon`), and nowhere else. A picture is never lent to another job,
because that is how ✕ came to mean both "close" and "delete" on the same page.

| Job | Picture | Build it with | Never |
| --- | --- | --- | --- |
| **Close** a panel, modal or card. Nothing is lost. | ✕ cross | `SharedIcon.button('close', 'Close')` | ✕ on a delete, a clear, a failed copy, a "don't" list |
| **Delete** a row, scenario, stage, chip, asset | bin | `SharedIcon.button('trash', 'Remove this stage', 'stage-del')` | ✕, ×, ⊗, 🗑 |
| **Clear everything** (empty a table, unload a file) | bin + word | `<button data-icon="trash">Clear</button>` | ✕ Clear |
| **Clear a text field** | backspace key | `SharedIcon.svg('clear')` inside `.city-clear` | ×, ✕ |
| **Duplicate** an item beside itself | two sheets and a plus | `SharedIcon.button('duplicate', 'Duplicate')` | ⧉ (that is copy to clipboard) |
| **Edit** an item | pencil | `SharedIcon.button('edit', 'Edit')` | ✎, ✏️ |
| **Save** the work to a file | floppy disk | `SharedScenario.mount(...)`, or `data-icon="save"` | 💾, ↓ JSON |
| **Open** a file from this device | open folder | `SharedScenario.mount(...)`, or `data-icon="open"` | 📂, 📊, ⬆, ↑, "Upload" (nothing is uploaded) |
| **Show the result** instead of its source | eye | `SharedIcon.svg('view')` | 👁 |
| **Put a value back** to its default | anticlockwise arrow | `SharedIcon.svg('reset')`, or `↺` in a label | |
| **Refresh** loaded data to the latest | two arrows chasing round | `<button data-icon="refresh">Refresh</button>` | ⟳ (that only moves the view), ↺ |
| **Share** a chart | Share ⌄ menu | `SharedShare` folds the chart's `⬇ SVG`, `⬇ PNG`, `⧉` into it | "Export", a row of four buttons |
| **Download** an export | ⬇ + format | `⬇ SVG`, `⬇ PNG`, `⬇ CSV`, `⬇ .py` | ↓, 📥, "Export" |
| **Copy** to the clipboard | ⧉ | `⧉`, titled "Copy PNG to clipboard" | ⧉ on a duplicate |
| **Link** to a chart on its scenario | chain link (drawn in SVG) | the Share menu's Share as link row | 🔗 emoji |
| **Embed** a chart on another site | </> | the Share menu's last row | |
| **Reset the view** (zoom, pan). Your data is untouched. | ⟳ | `⟳` | ⊡ |
| **Restore defaults**. Your inputs are replaced. | ↺ | `↺ Reset` | ⟳ (that only moves the view) |
| **Run** the tool's computation | ▶ | `▶ Simulate`, `▶ Generate Code`, `▶ Check` | ⚡ (that is Quick Start), ⚙ (that is Settings) |
| **Add** a new item | + | `+ Add stage` (ASCII plus) | ＋ (full-width) |
| **Reorder** by dragging | ⠿ | `⠿` grip | |

Emoji are decoration, never an icon: 🧭 tour, 🚀 Time Travel and the footer
flags stay; an emoji standing in for one of the jobs above does not. The theme
toggle is drawn (see the Dark / Light Toggle Button). A status is not a button: a copy that fails says so in words
(`alert('PNG copy failed: …')`), not with a ✕.

Static markup names its icon and `shared.js` draws it at load:

```html
<button type="button" class="btn-bare" data-icon="duplicate" title="Duplicate this portfolio" aria-label="Duplicate this portfolio"></button>
<button class="btn-secondary" data-icon="trash">Remove from list</button>   <!-- icon before the word -->
```

Markup built in JavaScript asks for it directly:

```js
row.innerHTML = '…' + SharedIcon.button('trash', 'Remove this size', 'row-del', rows.length < 2 ? 'disabled' : '');
```

`button(name, label, cls, attrs)` returns a `.btn-bare` with the label as its
tooltip and accessible name; the bin also gets `.is-delete`. A labelled button
with `data-icon` gets `.has-ico`, which spaces the icon from its word. Icons
ignore the pointer, so `e.target` is always the button.

### 2. A button wears only as much as its job needs

| Weight | Looks | Use for |
| --- | --- | --- |
| Primary (`.btn-primary`) | accent fill, `var(--text-inv)` text | the one thing the panel exists to do: Simulate, Done, Generate |
| Secondary (`.btn-secondary`, `.btn-sm`) | soft fill, border | a labelled action: `+ Add Scenario`, `⬇ CSV` |
| Bare (`.btn-bare`) | nothing until hovered | an icon-only button that acts on the thing it sits in: a row, a card, a chip, a column header, a panel's corner |

Bare is the default for an icon-only button. The picture already says what it
does, so a box around it is noise; it is muted at rest, tinted on hover, and
only the bin turns red. `rentvsownhouse/sensitivity`'s duplicate and delete in
each scenario header are the model.

Two exceptions keep a box. An icon-only button in a **row of boxed buttons**
(the chart export cluster `Share ⌄ ⟳`, the header's save and open, the
JSON Visualiser's Expand / Collapse / bin) stays boxed, so the row reads as one
set. And a **labelled** button keeps its box, because a bare word reads as a
label rather than something to press. Never hard-code `white` or `#fff` on an
accent fill: the dark theme's accent is pale.

### 3. The outcome the reader wants is the easiest one to reach

- **Closing keeps the work.** An editor applies each edit as it is made (a
  short debounce, then the same save the old button ran), so every way out
  (Done, ✕, Esc) keeps what was typed. There is no "close without saving" to
  hit by mistake: losing a form is far worse than keeping an edit you can
  change back. `financingvscash`'s scenario editor is the model
  (`applyEditorSoon()`, `closeEditor()`).
- **The way out is always in view.** A form taller than its panel pins its
  primary button to the bottom of whatever is scrolling (`position:sticky;
  bottom:0`), and says in a few words that changes save as you go. On a phone
  that is the bottom of the screen, under the thumb; a card that clips its
  corners uses `overflow:clip`, not `hidden`, so the pin still works.
- **A sidebar ends on screen.** A sticky control card is sized by
  `SharedReach` (`shared.js`) to the room it has from where it starts, so its
  bottom row (Simulate, Load tickers, Reset/Clear) is visible at first load,
  not 150px under the fold until the reader happens to scroll.
- **The main action sits where the eye ends.** A gate (Simulate) lives in the
  sidebar's pinned bottom row; a tool whose output is a separate pane puts the
  action at the top of that pane (PowerFactory's Generate Code).
- **A destructive button is never the easy one.** Delete is a bare bin at the
  end of its row, red only on hover; a reset of the whole form asks first.

### 4. Check it

`node _ref/button-check.mjs` (`ONLY=<path>` for one page) loads every page and
fails on a ✕ drawn as text, a picture lent to another job, a remove without
the bin, an emoji standing in for an icon, an unnamed icon-only button, a
`.btn-bare` with a fill, or a sticky sidebar that hangs under the fold. It
also drives Finance vs Cash's editor on a desktop and a phone and requires
Done on screen halfway down the form and every way out to keep an edit.

---

## Tooltips

### What a tooltip is allowed to say

A tooltip is read standing up, mid-decision, in a bubble 270px wide. So one tip
carries **one thought**: what the field is, plus the single thing a reader would
otherwise get wrong. The budget is **150 characters of rendered text as the aim,
200 at the outside**; past that it is a paragraph wearing a tooltip's clothes and
nobody reads it. `node _ref/tip-check.mjs` holds every page to it (add a path
fragment to run one tool) and prints each page's median, which is the number to
watch.

These rules follow from that:

- **A tip nobody needs is deleted, not shortened.** The bar is a domain fact: a
  definition, a unit, a rule, a formula, a caveat, a behaviour you could not
  guess. "Purchase Cost: the full price of whatever you are buying" teaches
  nothing, so it goes, and the (i) goes with it. Every (i) on the page is a
  promise that something non-obvious is behind it, and a page that keeps that
  promise is one where people keep hovering.
- **Move the fact into the label rather than hiding it in a hover.** When the
  only thing a tip carried was a word missing from the label, put the word in
  the label and drop the tip: "Total Household Gross Salary" plus a tip saying
  the figure is annual became "Total Household Annual Gross Salary".
- **No em-dashes**, here as everywhere else in user-facing copy.
- **A control that names itself gets no tip.** The (i) is for the technical
  and the non-obvious. These never carry one: a Simple/Detailed switch, a
  display toggle (power flow arrows, "Show in chart"), a "Colour by" or "Scale
  by" picker whose options name what they colour, an on/off for a thing's own
  labels, a price, rate, fee or down payment that is exactly what its label says,
  a range's first and last value, a multi-select whose label already says Ctrl/Cmd,
  and a Best/Worst tile. Ask "would a reader say *you don't say*?" If yes, delete it.
- **Don't re-explain what is on screen.** A sub-line under the field, an
  optgroup label, a radio's own description or a KPI's sub-line all count as on
  screen. If the radio buttons already carry a line of their own, the (i) beside
  them says what the group is for, not what each option does, and if the group
  needs nothing said, it has no (i).
- **A dependent field's tip follows the field.** See below.

### Tips that explain options: a list, or the selected one

When a tip explains the options of a control (or the series of a chart, or the
sections of a table), it never runs them together as a paragraph. Two forms,
and the choice is by size:

- **Three options or fewer, each a short clause:** a real list, every item
  opening with the option's name in `<strong>`, colon included. Anything that
  holds for all of them goes before the list as one plain sentence.

  ```html
  <span class="tip-icon" data-tip="<ul><li><strong>Net equity:</strong> the home if sold, minus the loan, plus cash.</li><li><strong>Liquid cash:</strong> cash in the bank.</li><li><strong>Accumulated cost:</strong> what housing has cost so far.</li></ul>">?</span>
  ```

- **More than three, or any one of them needs a long sentence:** the tip
  explains the **selected** option only, in the same `<strong>Name:</strong>`
  form, and the element carries `data-tip-options`. The shared tooltip then adds
  a small muted line under it, "Change the option to see the others explained."
  (Indonesian on an `lang="id"` page), so the reader knows the other options have
  their own. Do not add a clause on what the other option does; that line is the
  pointer. Wiring is as in "Dependent tooltips" below.

  ```html
  <i class="tip-icon" id="tipLoanType" data-tip="" data-tip-options>?</i>
  ```

A list never carries `data-tip-options`, and a tip that follows a control
without naming an option (a state, such as a slider that is inert until a
budget is set) does not carry it either. `tip-check` enforces all of this: two
or more "Name:" runs outside a list fail, a list of more than three items fails,
and a tip that changes with its control and opens with `<strong>Name:</strong>`
fails without `data-tip-options`.

### Dependent tooltips: say the state you are in

A dropdown with seven options used to mean a tip listing all seven, which is the
longest tip on any page and the least read: the options are already on screen in
the dropdown, and six of the seven describe a choice the reader did not make. So
a tip that hangs off a control carries the option that is **selected**, and
`data-tip-options` adds the line saying the others have their own:

```js
const TIP_STUDY_TYPE = {
  steady_state: '<strong>Steady State:</strong> a load flow (ElmLdf) on every iteration. Timeseries outputs are not available.',
  dynamic_rms:  '<strong>Dynamic RMS:</strong> an RMS simulation (ComSim) on every iteration. Timeseries outputs are available.',
};
// from the control's own change handler, and once at start-up
setTip('tt-study-type', TIP_STUDY_TYPE[$('study-type').value] || '');
```

The same shape covers a unit that changes
what a field is asking for (deposit as an amount versus a share of the price), and
a field that is inert until another one is set (a budget-growth slider while the
budget is automatic). Where a tool already keeps a table of tip text, give the
entry variants keyed by state rather than a second element:
`rentvsownhouse/tooltips.js` does this, and `RVO_APPLY_TIPS` reads each element's
`data-tip-variant` (and sets `data-tip-options` for the keys in `RVO_OPTION_TIPS`).

Wire it so the control keeps its own tip current, from the handler that already
runs on change, and leave the markup's `data-tip` empty (`data-tip=""`, plus
`data-tip-options` when it names an option) so an unwired tip shows up as a blank bubble rather than as stale text. `tip-check`
fails on an empty tip for exactly that reason.

### Global Tooltip (Dynamic, triggered by `data-tip`)

Auto-created by `shared.js`. Appears on hover, positioned intelligently to avoid viewport edges.

#### HTML

```html
<span class="tip-wrap">
  Field label
  <span class="tip-icon" data-tip="This is a helpful explanation.<br>Spans multiple lines.">i</span>
</span>
```

#### CSS (from `shared.css`)

```css
/* Global tooltip container */
#globalTooltip {
  position: fixed;
  z-index: 99999;
  pointer-events: none;
  max-width: 270px;
  background: var(--panel-raised, var(--panel));
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 9px 12px;
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--text);
  box-shadow: var(--shadow-lg);
  opacity: 0;
  transition: opacity var(--motion-fast);
  display: none;
}
#globalTooltip strong { color: var(--accent-strong); font-weight: 700; }
#globalTooltip br { display: block; margin-top: 5px; content: ''; }
#globalTooltip.visible { display: block; opacity: 1; }
/* Options listed in a tip, and the line under a selected-option tip */
#globalTooltip ul { margin: 4px 0 0; padding-left: 16px; }
#globalTooltip li { margin: 3px 0 0; }
#globalTooltip .tip-hint { display: block; margin-top: 6px; font-size: .7rem; color: var(--muted); }

/* Arrow pointer */
#globalTooltip .tt-arrow {
  position: absolute;
  bottom: -7px;
  width: 12px;
  height: 7px;
  overflow: hidden;
  transform: translateX(-50%);
}
#globalTooltip .tt-arrow::before {
  content: '';
  display: block;
  width: 10px;
  height: 10px;
  background: var(--panel);
  border: 1px solid var(--border);
  transform: rotate(45deg) translate(-3px, -3px);
}
#globalTooltip.flip-below .tt-arrow { bottom: auto; top: -7px; }
#globalTooltip.flip-below .tt-arrow::before { transform: rotate(45deg) translate(3px, 3px); }

/* Trigger icon. Label and icon are inline text, never flex items, so a label
   that wraps keeps its ? right after the last word. */
.tip-wrap { position: relative; display: inline; cursor: help; }
.tip-icon {
  display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px;
  border-radius: 50%; background: var(--input-bg); border: 1px solid var(--border); color: var(--muted);
  font-size: 0.7rem; font-weight: 800; cursor: help; flex-shrink: 0; line-height: 1; font-style: normal;
  vertical-align: 1px;
}
.tip-icon:hover { border-color: var(--accent); color: var(--accent); }
.tip-icon.warn { background: rgba(245,158,11,.18); color: var(--gold); border-color: rgba(245,158,11,.3); }
.tip-icon.warn:hover { border-color: var(--gold); }
```

The **?** always sits right after the label's last word. Keep the label text and
the icon in a box that is not `display:flex` or `grid` (a `.tip-wrap`, or a
plain `.field-label`): a flex item that wraps stretches to the full width and
strands the icon at the far right. `SharedTooltip` also swaps the space before
each icon for a no-break space, so the icon never drops to a line on its own.

#### JavaScript (from `shared.js`)

```js
// Auto-initialized by shared.js on DOMContentLoaded
SharedTooltip.init();
```

### Static Inline Tooltip (Alternative: `.tip-box`)

For static tooltips anchored to their trigger (no dynamic positioning required).

#### HTML

```html
<div class="tip-wrap">
  <span class="tip-icon">?</span>
  <div class="tip-box">
    <strong>Include housing:</strong> Rent/mortgage is counted in your expenses.<br><br>
    <strong>Exclude housing:</strong> Housing costs are excluded from the comparison.
  </div>
</div>
```

#### CSS

```css
.tip-wrap { position: relative; display: inline-flex; align-items: center; gap: 4px; }

.tip-box {
  position: absolute;
  left: 0;
  top: 100%;
  margin-top: 8px;
  background: var(--panel-raised, var(--panel));
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 10px 12px;
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--text);
  box-shadow: var(--shadow-lg);
  width: 240px;
  pointer-events: auto;
  z-index: 100;
}
.tip-box strong { color: var(--accent-strong); font-weight: 700; }
.tip-box br { display: block; margin-top: 5px; content: ''; }
```

### Abbreviations (automatic, `SharedAbbr`)

Jargon explains itself everywhere: any glossary term found in visible page text
gets a soft dashed grey underline and shows its definition in the global tooltip
on hover. Nothing to mark up, and nothing in the glossary but the vocabulary of
the field the tool works in. `shared.js` wraps each match itself:

```html
<!-- you write -->
<div class="field-label">Maximum LVR</div>

<!-- SharedAbbr renders -->
<div class="field-label">Maximum <abbr class="abbr" data-abbr="LVR"
     data-tip="<strong>Loan-to-Value Ratio</strong><br>the loan as a share of the property value">LVR</abbr></div>
```

#### Tokens and CSS

```css
/* dark.css */  --abbr-line:rgba(168,182,207,.42); --abbr-line-hover:rgba(141,187,255,.85); --abbr-hover-bg:rgba(141,187,255,.10);
/* light.css */ --abbr-line:rgba(110,124,142,.50); --abbr-line-hover:rgba(58,113,200,.85);  --abbr-hover-bg:rgba(90,145,232,.09);

abbr.abbr,.abbr{
  text-decoration-line:underline;
  text-decoration-style:dashed;
  text-decoration-color:var(--abbr-line);
  text-decoration-thickness:1px;
  text-underline-offset:.22em;
  cursor:help;
  border-radius:4px;
  transition:text-decoration-color var(--motion-fast),background-color var(--motion-fast),box-shadow var(--motion-fast);
}
/* Hover tint spread with a shadow, never padding: decorating a word must not
   change the width of the label, cell or column holding it. */
abbr.abbr:hover{
  text-decoration-color:var(--abbr-line-hover);
  background-color:var(--abbr-hover-bg);
  box-shadow:0 0 0 .18em var(--abbr-hover-bg);
}
@media print{ abbr.abbr{ text-decoration-line:none; } }

/* Wrapper used inside a flex/grid parent, see "Keeping it calm" below. */
.abbr-run{ display:inline; }
```

The underline is a tint of `--muted`, so it reads as a hint in both themes
without competing with the text. Hover lifts it to the accent colour and adds a
faint tint. Printing drops it.

#### Adding terms

Only the site-wide terms (`'*'`) live in `shared.js`. Every tool keeps its own
in `<tool>/abbr.js`, loaded right after `shared.js` on each of its pages, so a
page never downloads another tool's terms and the same letters can mean one
thing on one tool and another elsewhere (`PV` is photovoltaic on the Capacity
Expansion Planner, a bus type to a load-flow engineer):

```html
<script src="../shared.js"></script>
<script src="abbr.js"></script>          <!-- ../abbr.js from a sub-page -->
```

```js
// borrowingcapacity/abbr.js
SharedAbbr.glossary('borrowingcapacity', {
  LVR: ['Loan-to-Value Ratio', 'the loan as a share of the property value']
});
// dcasimulator/abbr.js: the tool's scope, and one sub-page's
SharedAbbr.glossary('dcasimulator/ticker', { ASX: ['Australian Securities Exchange'] });
// pisahvsgabung/abbr.js: a tool with an Indonesian page
SharedAbbr.glossary('pisahvsgabung', {
  PTKP: { en: ['Penghasilan Tidak Kena Pajak', 'the slice of income that is not taxed'],
          id: ['Penghasilan Tidak Kena Pajak', 'bagian penghasilan yang tidak dikenai pajak'] }
});
```

- An entry is `[expansion, optional one-line gloss]`, or `{ en, id }` when the
  Indonesian page needs its own wording (picked up from `<html lang="id">`).
- `'*'` applies site-wide; a tool key covers that folder and its sub-pages; a
  `tool/sub-page` key covers one page. The scope comes from the URL, so a new
  tool only needs its own file. `<body data-abbr-scope="…">` overrides it.
- A sub-page with a large vocabulary of its own keeps it in its own
  `abbr.js` beside the page, loaded after the tool's, so the tool's other pages
  do not carry it: `rentvsownhouse/quickstart-assumptions/abbr.js` holds every
  market's agencies, taxes and places for that page alone.
- A page can register its own at runtime: `SharedAbbr.add({ WACC: ['Weighted Average Cost of Capital'] })`.
- **Never define a term in the page itself**, with `<abbr title="…">`, a `title`
  attribute or a `?` icon whose whole tooltip is the expansion. `abbr` is a
  skipped region, so a hand-rolled one silently opts the term out of the layer
  it was meant to join: it reads differently, it has no Indonesian wording, and
  the glossary entry it shadows looks unused. Put the term in the glossary and
  leave the page text plain.
- A term whose text moves with an input (`K/I/0`, `K/I/2`, `K/I/3` — the PTKP
  status codes in `pisahvsgabung`) needs an entry per value the tool can
  produce, since the glossary matches the literal string on screen. Generate the
  set in a loop next to the glossary rather than writing each one out, and drive
  the page copy from the same count so the two cannot drift apart.

#### Keeping it calm

Decoration is skipped inside links, buttons (`button` and anything whose class
reads as one, `[class*="btn"]`), form controls, `code`/`pre`, the page title
(`h1`, `.logo`, `.header-title`), anything that already carries a `data-tip`
(no tooltip inside a tooltip), and any element marked `data-no-abbr`.

Inside a flex or grid parent the run is wrapped in a `<span class="abbr-run">`
first, because splitting a text run there would create extra flex items, extra
gaps, and collapse the space at the seam. One item in, one item out, so the
layout is identical with the decoration and without it.

**Mark user content `data-no-abbr`**: an uploaded table, a rendered document, a
JSON tree, a list of user choices. Site text teaches; user data is left alone.

```html
<tbody id="tableBody" data-no-abbr></tbody>
```

**Subject-matter jargon only.** The glossary explains the field the tool works
in: LVR, PTKP, RMS, RPPI, TWR. It deliberately holds no file formats or everyday
computing words (CSV, PDF, PNG, SVG, JSON, URL, XLSX); everyone meets those at
the download button, and underlining them there would drown the terms that carry
real meaning. Units that sit next to numbers in running prose ("163 MW") are out
for the same reason. `node _ref/abbr-check.mjs` drives every page and prints how
often each term is decorated, which is the clutter budget to check against.

Other API: `SharedAbbr.glossary(scope, map)`, `SharedAbbr.define(term)`, `.terms()`, `.scan(root)`, `.refresh()`,
`.undecorate(root)` (strip the decoration, e.g. from a clone before export),
`.stop()`.

---

## KPI Cards

```html
<section class="metrics">
  <div class="metric card">
    <div class="label">Breakeven year</div>
    <div class="value" id="breakevenMetric">—</div>
  </div>
</section>
```

```css
.metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-bottom: 18px; }
.metric { padding: 12px 14px; min-height: 82px; }
.metric .label {
  color: var(--muted);
  font-size: var(--fs-xs);
  font-weight: 600;
  margin-bottom: 6px;
}
.metric .value {
  font-family: 'DM Mono', monospace;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
}
```

---

## Directional / Delta Display

```html
<span class="delta positive">▲ +$12,400</span>
<span class="delta negative">▼ −$8,200</span>
```

```css
.delta {
  font-family: 'DM Mono', monospace;
  font-weight: 700;
  font-size: 0.88rem;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-variant-numeric: tabular-nums;
}
.delta.positive { color: var(--positive-em); background: var(--positive-bg); border: 1px solid var(--positive-border); }
.delta.negative { color: var(--negative-em); background: var(--negative-bg); border: 1px solid var(--negative-border); }
```

**ACCESSIBILITY RULE**: Never rely on colour alone for directional meaning.
Always pair with a sign (`+` / `−`), arrow (`▲` / `▼`), or explicit descriptor.

---

## Status Badges

```css
.badge { border-radius: var(--radius-pill); padding: 2px 8px; font-size: 0.75rem; font-weight: 700; display: inline-block; }
.badge-success { background: var(--success-bg); color: var(--success-text); }
.badge-error   { background: var(--error-bg);   color: var(--error-text); }
.badge-warning { background: var(--warning-bg); color: var(--warning-text); }
.badge-info    { background: var(--info-bg);    color: var(--info-text); }
```

---

## Summary Tile Grid

```html
<div class="summary-grid">
  <div class="tile">
    <div class="label">Scenario A — Year 30</div>
    <div class="value" id="valueA30">—</div>
  </div>
</div>
```

```css
.summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 12px; }
.tile { padding: 14px; background: var(--input-bg); border: 1px solid var(--border); border-radius: var(--radius-xl); }
.tile .label {
  color: var(--muted);
  font-size: var(--fs-xs);
  font-weight: 600;
  margin-bottom: 6px;
  line-height: 1.3;
}
.tile .value { font-family: 'DM Mono', monospace; font-size: 1.05rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.tile .value.pos { color: var(--data-pos-em); }
.tile .value.neg { color: var(--data-neg-em); }
```

---

## Tables

```css
table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'DM Mono', monospace;
  font-variant-numeric: tabular-nums;
  font-size: 0.88rem;
}
th, td { padding: 9px 7px; border-bottom: 1px solid var(--border); text-align: right; white-space: nowrap; }
th:first-child, td:first-child { text-align: left; white-space: normal; font-family: 'DM Sans', sans-serif; }
th {
  color: var(--text);
  font-family: 'DM Sans', sans-serif;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.005em;
  line-height: 1.3;
  vertical-align: middle;
}
thead th, thead th:first-child { text-align: center; }
thead th { white-space: normal; text-wrap: balance; }
th .th-unit { display: block; font-weight: 400; color: var(--muted); }
.table-wrap { overflow: auto; max-height: 400px; }
tr:hover td { background: rgba(141,187,255,0.04); }
body.light tr:hover td { background: rgba(90,145,232,0.04); }
```

**A header is a label, its unit is the note under it.** The pair mirrors a form
field: the header reads like `.field-label` (DM Sans, text colour, bold) and its
unit like `.field-sub` (regular weight, `--muted`), so a column says
`Peak demand` with a lighter `MW` beneath. Sentence case, never uppercase: the
sans face over DM Mono figures already sets the header apart. Every column
header is centred both ways: over its column, whatever way the figures below
align, and in its row, so a one-line header sits level with the middle of a
two-line one rather than dropping to the bottom. A tool never re-aligns a
column header (no `text-align` on a `thead th`, no inline style); row headers
in the body keep the column's own alignment.

**A long header wraps before the table scrolls.** Figures never wrap, so a
column is never narrower than its widest figure; a column header is free to
break onto more lines (in balanced lines, `text-wrap: balance`) when the table
would otherwise overflow, and stays on one line while there is room. Leave
column headers wrappable: `white-space: nowrap` on a header belongs only to one
that holds a control (a picker, an add button) or to a row whose height a
sticky row below it depends on.

```html
<th>Peak demand <span class="th-unit">MW</span></th>
```

Keep the space before the span: a CSV built from `textContent` then reads
`Peak demand MW`. A tool that keeps its headers as strings for the table and the
CSV alike (`'Peak demand MW'`, `'Margin (MW)'`) renders them with
`SharedTable.head(text)`, which splits off a trailing unit it knows
(MW, MWh, GWh, kV, kA, MVAr, %, °, p.u., `per …`). A spanning group header over several
columns stays `--muted`, one step above the columns it names.

A tool stylesheet sizes and places its headers (padding, sticky, background,
borders, alignment) but never restates their colour, face, weight or case.

For sticky headers / a frozen first column on wide tables, make the header cells
`position: sticky; top: 0;` (and the first column `position: sticky; left: 0;`) with a
solid background so rows scroll underneath them.

---

## Scrollbars

Site-wide, from `shared.css`: **no vertical scrollbar anywhere, a themed horizontal
one where a surface scrolls sideways.** Vertical scrolling already has a gesture on
every device (wheel, trackpad, arrow keys, touch), so the bar is dead weight and the
page keeps its full width. Sideways scrolling has no such gesture on a plain mouse,
so that bar stays, wearing the page's own colours instead of the operating system's.

```css
/* shared.css — already applied to every page */
*::-webkit-scrollbar { width: 0; height: 10px; }              /* width = vertical, height = horizontal */
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb); border-radius: var(--radius-pill);
  border: 2px solid transparent; background-clip: padding-box;
}
*::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover); }
```

`--scrollbar-thumb` / `--scrollbar-thumb-hover` are theme tokens, so the bar reads
as part of the page in dark and light alike.

**A tool stylesheet must not re-style `::-webkit-scrollbar`.** A class selector
outranks the rules above and brings a vertical bar back on that one surface.

**Firefox** styles scrollbars through `scrollbar-width` / `scrollbar-color`, and
neither can pick an axis, so hiding the vertical bar hides the horizontal one too.
There the vertical rule wins everywhere, and a surface that scrolls *sideways only*
asks for the thin themed bar back:

```css
/* The guard keeps this away from Chrome and Safari, where scrollbar-width:none
   would beat the rules above and take the horizontal bar with it. */
@supports not selector(::-webkit-scrollbar) {
  .sens-wrap { scrollbar-width: thin; scrollbar-color: var(--scrollbar-thumb) transparent; }
}
```

`shared.css` ships `.x-scroll` for exactly this, so new markup can just add the class.
A wrapper that scrolls *both* ways (a tall, wide table) keeps both bars hidden in
Firefox: the vertical rule wins.

---

## Number Formatters

Use `SharedFmt` from `shared.js` for input formatting (thousand separators), and the
`fmt` helpers below (define per-page in `script.js`) for display formatting:

```js
const fmt = {
  currency(v, compact = false) {
    const n = Number(v || 0);
    const abs = Math.abs(n);
    const sign = n < 0 ? '−' : '';
    if (compact && abs >= 1e9) return sign + '$' + (abs / 1e9).toFixed(2) + 'b';
    if (compact && abs >= 1e6) return sign + '$' + (abs / 1e6).toFixed(2) + 'm';
    if (compact && abs >= 1e3) return sign + '$' + (abs / 1e3).toFixed(0) + 'k';
    return new Intl.NumberFormat('en-AU', {
      style: 'currency', currency: 'AUD', maximumFractionDigits: 0
    }).format(n);
  },

  pct(v, decimals = 2) {
    const n = Number(v || 0);
    const pctVal = Math.abs(n) <= 1 ? n * 100 : n;
    return pctVal.toFixed(decimals) + '%';
  },

  num(v, decimals = 0) {
    return Number(v || 0).toLocaleString('en-AU', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  },

  // fmt.delta(1200)  → "▲ +$1,200"
  // fmt.delta(-500)  → "▼ −$500"
  delta(v, asCurrency = true) {
    const n = Number(v || 0);
    const arrow = n >= 0 ? '▲' : '▼';
    const sign  = n >= 0 ? '+' : '−';
    const abs   = Math.abs(n);
    const formatted = asCurrency
      ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(abs)
      : abs.toLocaleString('en-AU');
    return `${arrow} ${sign}${formatted}`;
  },

  year(v) { return 'Year ' + v; },
};
```

**RULE**: Never display a raw integer > 999 to the user. Always pass through `fmt.currency()`, `fmt.num()`, or `fmt.pct()`.
**RULE**: For directional values, use `fmt.delta()` and wrap in `.delta.positive` / `.delta.negative`.
**Locale**: Default to `en-AU`. Change to `en-US` / `en-GB` / `en-ID` if the domain warrants it.

---

## Colour Usage Guide

| Purpose | CSS Variable |
|---------|-------------|
| First option line | `--line-a` (blue) |
| Second option line | `--gold` |
| Third, fourth, fifth option lines | `--line-c` (teal), `--line-d` (rose), `--line-e` (purple) |
| Money out, a loss, a bar to clear | `--line-b` / `--negative` (red, never an option) |
| Slider value labels | `--accent` |
| Muted labels / help text | `--muted` |
| Positive deltas (text/badge on dark) | `--positive-em` / `--data-pos-em` |
| Negative deltas (text/badge on dark) | `--negative-em` / `--data-neg-em` |
| Positive data (chart fills, large marks) | `--positive` / `--data-pos` |
| Negative data (chart fills, large marks) | `--negative` / `--data-neg` |
| Borders | `--border` |
| Input backgrounds | `--input-bg` |
| Chart axis text/grid | `--chart-text` / `--chart-grid` |

**Colour semantics**:
- Blue family (`--accent`, `--positive`) → brand leadership + critical positive data
- Red family (`--negative`, `--line-b`) → direction only: money out, a loss, a bar to clear, an error; never an option a reader is choosing between (see Finance Tool Skeleton → Colour)
- Mint (`--accent2`) → secondary supportive / calm / soft success
- Rose (`--accent3`, the same rose in both themes) / gold (`--gold`) → accent / warm emphasis / tertiary
- Monospace (`DM Mono`) → all numeric values and data

---

## Border Radius & Motion Tokens

Two corner sizes and the pill, decided once. The in-between names stay as
aliases so older rules still read.

```css
--radius-sm: 8px;    /* controls: inputs, selects, buttons, chips */
--radius-md: 8px;    /* alias of sm */
--radius-lg: 14px;   /* surfaces: cards, panels, tiles, callouts */
--radius-xl: 14px;   /* alias of lg */
--radius-2xl: 14px;  /* alias of lg */
--radius-pill: 999px;/* badges, deltas, toggles, the round theme button */

--sticker: 2px 2px 0 var(--ink-line);        /* buttons and cards a reader can press */
--sticker-hover: 3px 3px 0 var(--ink-line);  /* lifted on hover */
--sticker-accent: 2px 2px 0 …;               /* a filled blue button: an offset that differs from its fill */
--shadow / --shadow-sm: none;                /* surfaces at rest are flat */
--shadow-lg: 0 10px 30px …;                  /* only what floats: menus, tooltips, dialogs, sheets */

--motion-fast: 150ms; /* hover/focus transitions */
--motion-base: 250ms; /* theme switch, toggles */
--motion-slow: 400ms; /* larger animations */
```

---

## Charts & Graphs

The design system renders charts with **[Chart.js](https://www.chartjs.org/) 4.x**, plus
**[chartjs-plugin-zoom](https://www.chartjs.org/chartjs-plugin-zoom/) 2.x** (driven by
**[Hammer.js](https://hammerjs.github.io/) 2.x**) for panning and pinch/wheel zoom. Include
them before your page script:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/chartjs-plugin-zoom/2.0.1/chartjs-plugin-zoom.min.js"></script>
```

The patterns below cover the three chart families this system uses — **line**, **stacked
area**, and **pie / doughnut** — and the three things that matter most for all of them:

1. **Axis titles & formatting** — every axis is labelled; ticks are run through a formatter.
2. **Legends & hover info** — a custom HTML legend that toggles series, plus a tooltip and a
   persistent hover read-out.
3. **Panning & zooming** — wheel/pinch zoom and drag-to-pan on the x-axis, with a reset button.

### Golden Rules

- **Never hardcode colours in chart config.** Read every colour (series, axis text, grid,
  tooltip background) from CSS variables via `cssVar()` so charts adapt to both themes:
  ```js
  const cssVar = n => getComputedStyle(document.body).getPropertyValue(n).trim();
  const grid = cssVar('--chart-grid'), muted = cssVar('--chart-text'), text = cssVar('--text');
  ```
- **Re-create (or re-theme) charts on theme switch.** CSS variables resolve to fixed values
  when the chart is built, so re-run your `updateChart()` functions inside the theme toggle:
  ```js
  $('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('light');
    if (hasData) { updateLineChart(); updateStackedChart(); }  // re-read tokens
  });
  ```
- **Always format displayed numbers.** Pipe axis ticks and tooltip values through the `fmt`
  helpers (see *Number Formatters*) — never show a raw integer > 999.
- **Use `--line-a … --line-e` for series colours**, in order, so multi-series charts stay
  on-palette and theme-aware.

---

### Chart Card Scaffold (shared HTML + CSS)

Every chart sits in a `.chart-card` with a title row, a custom legend, the canvas wrapper,
and a hover read-out box. The title row is a `.chart-head`: the title on the left, the export
`.btn-cluster` hard right, and nothing else on that row — the subtitle is a SIBLING below it,
so however long it runs it can never push the buttons onto a line of their own.

The cluster is the same on every chart on the site: **Share ⌄** and then **⟳ reset zoom**,
and a table's **⬇ CSV** is the same cluster in a `.detail-head` beside the table it
exports. A chart card that folds (`SharedFold.attach(card, {key, bodies, open: true})`)
ends the cluster with the same `▾` chevron a table has, after ⟳, and opens until the reader
closes it. Share opens the site's dropdown list with **Download as SVG, Download as PNG,
Copy to clipboard, Share as link, Embed as HTML**, in that order (see *Share Menu* below). The markup
still lists the chart's `⬇ SVG`, `⬇ PNG` and `⧉` buttons, because their ids are what the
tool's script binds; `SharedShare` folds them into the menu at load. The buttons are
labelled by a glyph, so each one carries a `title` saying what it does (and
`data-i18n-title` on a translated page).

```html
<section class="chart-card card">
  <div class="chart-head">
    <h2>Value Over Time</h2>
    <div class="btn-cluster">
      <button class="btn-secondary btn-sm"          id="svgBtn"       title="Download this chart as SVG">⬇ SVG</button>
      <button class="btn-secondary btn-sm"          id="pngBtn"       title="Download this chart as PNG">⬇ PNG</button>
      <button class="btn-secondary btn-sm btn-icon" id="copyBtn"      title="Copy PNG to clipboard">⧉</button>
      <button class="btn-secondary btn-sm btn-icon" id="resetZoomBtn" title="Reset zoom">⟳</button>
    </div>
  </div>
  <div class="sub" id="chartSub"></div>                <!-- rare, BELOW the row: see below -->
  <div class="legend" id="chartLegend"></div>          <!-- custom HTML legend -->
  <div class="canvas-wrap"><canvas id="chartCanvas"></canvas></div>
  <div class="hover-box" id="chartHoverBox">Hover to inspect data points.</div>
</section>
```

**A chart has no subtitle by default.** The title, the key, the axis titles and the
hover box say what the chart shows; a line under the title that describes it again
(what is stacked, what a line means, which way is better, where to click) is noise, on
the page and in an embed. A `.sub` is there only for what the chart cannot show and
the reader would otherwise get wrong, and it is one concise sentence: the money basis
where no axis names it ("In future dollars, not adjusted for inflation."), a series
let run off the top, a chart left empty because the run failed. One that only applies
sometimes is set by the script and hidden (`hidden`, or `:empty`) the rest of the time.

`.chart-head`, `.detail-head`, `.btn-cluster`, `.btn-sm` and `.btn-icon` — including the
phone layout, where the cluster takes the full width under the title and its buttons share
it evenly — all live in **`shared.css`**, with the Share menu beside them. A tool sets only what is particular to its own
page (heading size, card padding, the height of its canvas) and never restates that
geometry, or the row drifts apart tool by tool. `node _ref/chart-check.mjs` checks that it
has not.

```css
/* page-specific only — the row itself is shared.css's */
.chart-card    { padding: 20px; margin-bottom: 18px; }
.chart-card>.sub { color: var(--muted); font-size: .8rem; margin: 5px 0 0; line-height: 1.4; }

/* Custom legend (replaces Chart.js's built-in legend). The swatch inside each
   entry is drawn by SharedLegend — `.legend-swatch` is styled in shared.css. */
.legend        { display: flex; gap: 14px; flex-wrap: wrap; margin: 12px 0 14px; font-size: .84rem; }
.legend-item   { display: flex; align-items: center; gap: 7px; cursor: pointer; transition: opacity .15s; }
.legend-item.hidden { opacity: .35; }                /* dimmed when its series is toggled off */

/* Canvas wrapper — fixed height so a responsive canvas has a definite box to fill */
.canvas-wrap   { position: relative; width: 100%; height: 430px; border: 1px solid var(--border); border-radius: 14px; overflow: hidden; background: var(--card-bg); }

/* Persistent hover read-out beneath the chart */
.hover-box     { margin-top: 10px; color: var(--muted); font-size: .84rem; min-height: 22px; }

@media (max-width: 1100px) { .canvas-wrap { height: 360px; } }
@media (max-width: 600px)  { .canvas-wrap { height: 300px; } }
```

---

### Share Menu (`SharedShare`, shared.js)

One button, one word: **Share**. It covers every way a chart leaves the page (two
downloads, the clipboard, an embed), where "Export" would only name the files, and the
button map already keeps "Export" off download buttons. The chevron turns over while the
list is open, as the home page's sub-tool menu does; the list is the site's `.combo-list`,
placed by `SharedDropdown.place(…, {align: 'end'})` so it opens flush under the button,
and it is driven by the keyboard as a menu is (arrows, Home, End, Escape back to Share).

| Row | Does | Rule |
| --- | --- | --- |
| ⬇ Download as SVG | clicks the chart's own `⬇ SVG` | drawn at the desktop size (`SharedExport.atDesktopSize`), so a phone exports the desktop picture |
| ⬇ Download as PNG | clicks `⬇ PNG` | the same |
| ⬇ Download as GIF | clicks `⬇ GIF`, only on an animated chart | shown only while the tool shows its `⬇ GIF` (the Load Flow Simulator, while a flow animates); one loop, the PNG's picture at 1x |
| ⧉ Copy to clipboard | clicks `⧉`, whose handler copies through `SharedShare.copyImage` | the PNG above; "✓ Copied" flashes on Share, a failure says why in words |
| Share as link (chain-link icon) | copies `<tool>/#open=<chart>&s=…` | the same address as the embed's *Links back* below: the tool on the reader's scenario and this chart's view; "✓ Link copied" flashes on Share |
| </> Embed as HTML | opens the embed dialog | an iframe of the embed viewer carrying this chart as data, a credit line, and a one-line sizer |

```js
// Every ⧉ handler: copyImage writes inside the click (Safari needs that).
$('copyBtn').addEventListener('click', () => SharedShare.copyImage(() => chartPng(), $('copyBtn')));
// A cluster built after load (a popup) is folded when it is built.
SharedShare.upgrade(overlay);
```

**An embed is the chart, not the tool.** A reader who embeds a chart wants the chart on
their page: readable, zoomable, switchable between the views it has, and fast. So the frame
never loads the tool. Embed as HTML writes the chart down as data while the tool has it on
screen (`share-snapshot.js`, loaded the first time it is needed), and the **embed viewer**
(`embed/`) draws that with Chart.js, Plotly or plain SVG and `chart-kit.js` alone: no tool
script, no model, no solve, no market data in the other site's frame. A chart opens in the
time Chart.js takes to load, about a fifth of a second, where the whole tool took three to
seven. The code is

```html
<iframe src="https://tool.adjiebrotots.com/embed/#t=c&amp;kit=<tool>&amp;l=en&amp;s=z…" title="<chart title>"
        width="100%" height="<desktop height>" style="border:0;background:transparent" loading="lazy"></iframe>
<p …>Interactive chart: <a href="<tool>/#open=<chart>&amp;s=…">…</a> by Adjie Brotot Tools</p>
<script>addEventListener("message", …)</script>
```

`t` names the libraries the viewer needs (`c` Chart.js, `d` a diagram, `dc` a diagram with
charts under it, `pbasic`/`pcartesian`/`pgl3d`/`pfull` the smallest Plotly bundle with every
trace the figure uses), `kit` the tool whose `chart-kit.js` it draws with, and `l` the
language of its loading line, so the viewer fetches all of them while the page is still
being read, before it has unpacked anything. `s` is the snapshot, deflated alone (`z`):

| The snapshot writes down | How |
| --- | --- |
| The datasets and their looks | every value to eight significant figures (a part in a hundred million, under any pixel); a per-point callback (`pointRadius: ctx => …`) resolved to the values it gave; a line's `segment` callbacks segment by segment; a tool's own record hung on a dataset (the scenario a line came from) left behind past 4 KB |
| The options | as they are, with each function carried by its **ChartKit** name, or dropped where the snapshot carries what it gave (ticks, the hover card) |
| The hover card | baked: the tool's own tooltip callbacks run for every point, and the viewer's hand back their lines. A series' rows are written as the words around each value and the format the value is written in, with only the rows that format gets wrong spelt out, so a decade of daily prices costs a few KB |
| The axis labels | a category axis's labels one by one; a numeric axis's as a table over its whole numbers where that is short (years, hours, an index into dates), and a format learned from the tool's callback for everything else (each decade's prefix, suffix, unit and decimals), its misses kept as they are; a tick's look (a decision year bold, the zero line stronger) as a table by tick |
| The key | every entry's swatch spec, words and the datasets it shows and hides (found by pressing it and pressing it back), and the key's layout (groups, pairs, brackets) as a tree of its boxes' classes and words |
| The views the card offers | every combination of the controls the tool marks `data-embed-mode`, each set, drawn and written down as its own frame, the reader's own view put back after |
| A Plotly chart | its figure (`data`, `layout`) |
| A diagram (`data-share-chart`) | its SVG as a tree of tags and attributes, styles resolved to presentation attributes, framed on its drawing (`drawnBox`, 28 units of margin); a view after the first written as the changes to it |

Everything the snapshot reads, it puts back as it found it: a view pressed to be written down
is pressed back, and whatever a tooltip callback writes into the page while it is run (the
read-out under a chart) is undone, so the reader's page and saved work are untouched.

**A function travels by name.** Data travels; a function does not. A plugin, an interaction
mode, a scale hook, a fitter or a fill a chart needs is registered in `ChartKit`
(`chart-kit.js`), by the site's shared pieces there and by a tool's own in
`<tool>/chart-kit.js`, loaded by the tool before its scripts and by the viewer:

```js
ChartKit.plugin(PLUGIN);                         // a Chart.js plugin, by its id
var skip = ChartKit.fn('cx.skipRef', fn);         // a function, by name
var fit = ChartKit.make('ff.yFit', makeYFit);     // a factory: fit(args…) is tagged with
                                                 // its name and arguments (data, pooled)
ChartKit.hatch(fill, line, down); ChartKit.dots(fill, dot);   // the fills a key can name
```

A tool piece reads its data from its arguments or the chart's own options, never from the
tool's variables (`plugins.edHour.hour`, `plugins.cxBuilt.built`), so a shared chart carries
it. A function the snapshot meets with no name is reported in the console when the reader
embeds (`Embed snapshot left out: …`), and `_ref/share-check.mjs` compares what the viewer
draws with what the tool draws, so a piece left behind shows up there. The names, the
plugin ids and the snapshot's format (`v: 1`) are what old embeds are keyed on: rename the
words, never the name.

**The views a card offers.** A control in the card that switches between views of the
result the tool already computed (a metric, candles or a line, the year of the typical days,
the hour of the diagram, which portfolio) carries `data-embed-mode`, on a select, a checkbox,
a range, a box of buttons, or on buttons themselves (buttons with the same value are one
choice, a lone button a switch). Its value names it for a screen reader when no label does.
Every other control in a card stays as the reader left it and is not in the embed: an
input that changes what is computed belongs to the tool, a click away through the line under
the chart. A slider (the ED/UC hour) is offered with ▶, each of its steps a frame, the
other views as the reader left them.

**The frame is as tall as what it shows.** The iframe's `width` is the other site's column,
so the viewer posts the height it needs (`{ abtEmbed: 'height', height }`) whenever its width
changes it, and the third line of the code sets that height on the very iframe that sent it,
from the site's own origin only. The height is the card laid out at its own height: its
title and views, the key and the watermark at the frame's width, plus the chart at the height
the tool gives it on a desktop, or a diagram as tall as its drawing is at that width (no more
than 1.5×). A site that strips scripts keeps the `height` the iframe carries, worked out for
a 760px column. A view hook's `panels(picked)` adds charts under the main one (the ED/UC
Simulator's ticked charts under its diagram): each drawn once, a view only moving what their
options change with it (the hour marker following the slider).

**While it loads, the frame says so.** One quiet line in the middle of the frame, "Loading
data from tool.adjiebrotots.com…" ("Memuat data dari …" when `l=id`), in place of a blank.

**The watermark lives in the frame.** Under the chart, hard right, the viewer draws the
site's circled A and one line, "Try your own scenarios at tool.adjiebrotots.com/<tool>",
linking back to the tool (opened in a new tab, see *Links back* below). It is the PNG and SVG
watermark's equivalent: small (0.66rem), muted, at 70% opacity until hovered. Being part
of the framed page, which the other site cannot reach into, it cannot be edited out of the
code without dropping the chart too. But a link inside a frame is credited to the
framed page, not to the site that embeds it, so the watermark earns no backlink.

**The backlink lives under the frame.** The code is the iframe and, on the next line, one
credit paragraph: "Interactive chart: <a>DCA Scenario Explorer</a> by Adjie Brotot Tools"
(Indonesian: "Grafik interaktif: … oleh …"). It is a plain, visible, followed link to the
tool's canonical address on the other site's own page, which is what search engines and AI
crawlers credit. Its anchor is the tool's `og:title`, never keywords: search engines treat
keyword-rich links spread through widgets as link spam. It sets only margin, size and
alignment, so it takes the other site's font and link colour. The site can delete it; the
watermark in the frame stays either way, and the dialog asks the reader to keep it.

**Links back open the reader's scenario.** The watermark and the credit link both point at
`<tool>/#open=<chart>&s=…`: the canonical address (the part a crawler credits, since it
ignores the `#hash`) set up on the scenario and view the embed shows. `s` here is the
scenario file the save button writes (`SharedScenario.mount` registers it with
`SharedShare.state`), deflated and base64url-encoded into the `#hash`, which a browser
never sends to a server, so nothing is uploaded. It is deflated against a **dictionary**,
`share-dict-a.txt`: what the tools save on their defaults and Quick Start presets (built by
`node _ref/share-dict.mjs`), so a field name, a default value or a whole preset the
dictionary also holds costs one back-reference of 2 to 4 bytes. That brings a finance
tool's scenario to about 60 to 200 characters, where deflate alone needed 450 to 1,100.
The first letter of `s` says how it was written: `a` for that dictionary, `z` for deflate
alone (the format links were first written in, and still chosen when it comes out shorter)
or `j` for plain JSON. A dictionary is frozen once shipped, since every link made with it
decodes only against those bytes: a better one is the next letter, added to `DICTS` in
`shared.js` beside the old file, which stays. A sent link outlives the tool it was made on,
so `_ref/share-links.json` keeps real links in every format the site has written, and
`share-check.mjs` holds them (F1, F2): each still decodes to exactly what it held, the
dictionary's hash is pinned, and every field, chart and view button a kept link names is
still on the page. Renaming or removing a field therefore fails the check: keep reading the
old name in the tool's load (a migration) before shipping, and add new links to the file
rather than editing old ones. Opened as a page (open mode), the tool drops `#open` from the
address, loads the scenario the way a saved file is loaded (it becomes the reader's own
saved work, so a reload keeps what they change), puts the chart's view back and scrolls the
chart into view. Its strings are made inert (below).

Only the two rows the menu draws itself carry a second line: Share as link ("Opens the
tool on your scenario") and Embed as HTML ("Interactive chart for your site"); the other
three rows say what they do in their label alone.

- A view that lives outside the card names it: `data-share-view="#tab-sens"` on the card
  (Finance vs Cash's sensitivity sweep), and its fields and toggles ride along in a link,
  its `data-embed-mode` controls in an embed.
- A chart the tool draws itself, not Chart.js or Plotly (the Load Flow Simulator's SVG
  diagram), marks its element `data-share-chart` and keeps `data-share-sig` set to a
  signature of what it draws, set only once it has drawn (a failure too, so a snapshot
  settles). The snapshot waits on it; its flow arrows' animation travels with it.
- An animated chart's `⧉` passes `copyImage` a third argument, `{ gif: () => gifBlob,
  onDone: kind => … }`: the GIF goes on the clipboard where the browser takes `image/gif`,
  and elsewhere the PNG goes with an HTML copy carrying the GIF, which mail and documents
  paste animated. `onDone` hears which, so the tool can say so in words.
- A view that has to be opened first (a popup) registers a hook:
  `SharedShare.view('.cm-canvas', { save: () => ({…}), load: v => openIt(v) })`.
- A link names its chart by key for good. A chart merged into another leaves
  `SharedShare.alias(oldKey, newKey)` behind, and its old links open the chart
  it went into (the Capacity Expansion Planner's `buildCanvas`, now part of `capCanvas`).
- Two charts may share one card as two `.chart-panel`s, each with its own head and
  cluster: Share finds the nearest panel, so an embed of either shows that one alone.
- A tool outside `SharedScenario` passes its own `SharedShare.state({ save, load })`; the
  Graph Visualiser's carries the rows of the uploaded file, since nothing else has them.
- A tool that is not a chart, with no picture to download, still shares itself: an empty
  `<div class="btn-cluster" data-share="tool">` in its card gets a menu of **Share as link**
  and **Embed as HTML** alone, always shown, and its dialog, credit line ("Interactive tool:
  … by …") and watermark ("Make your own at …") say *tool* where a chart's say *chart*. A
  tool is the thing it shares (the Random Picker's wheel is spun in the frame), so its
  embed is the whole page in **embed mode**: `<tool>/#embed=<chart>&theme=…&s=…`, the page
  reading the hash before any tool script runs, the mini cache neither restoring nor saving,
  the tour staying away, and only that card shown, filling the frame. It starts as soon as
  the tool's scripts have run and the font is in, giving each step two frames rather than a
  fixed wait, and fetches its dictionary beside the page's other files. The card's own
  element carries `data-share-chart` and `data-share-sig` as a diagram does, and anything the
  frame must show (the tool's main button) lives inside the card. The Random Picker marks
  the stage on screen (`stage-wheel`, `stage-dice`, …), so an embed is that one picker;
  `node randompicker/_audit/embed.mjs` checks it. An old `#embed=` link to a chart opens the
  same way.
- **An embed never calls the market-data Worker.** The viewer runs on this origin, where
  the Worker's origin lock would let it through, and every viewer on the other site would
  be a paid invocation. The prices a chart draws are in the chart it carries, so the frame
  fetches nothing but the viewer and its libraries. A whole-page tool embed in a frame is
  refused the Worker too (`yfFetchPricesBatch`), and a tool on market prices registers
  `SharedShare.data({ save, load })` for a `#open` link, which packs no prices.

**A link is not a file.** A reader opens a file they chose; a link can be sent by anyone.
So nothing that arrives in a link is ever read as markup or code. The viewer puts every
string into the page as text; rebuilds a diagram only from the tags and attributes
`chart-kit.js` lists (shapes, text, paint, and the animation of opacity and transform on
the clock, never a script, an event handler, a link out or foreign content); revives a
function only as one `ChartKit` registered by name; escapes every value of a swatch; lets
Plotly read only plain emphasis and line breaks in its strings; loads a tool kit only from
`<tool>/chart-kit.js` on its own origin; and points its links out only back at this site.
Open mode and a tool's embed mode only switch on as they should (embed mode inside a frame:
opened as a page of its own, the link is just the tool), and every string that arrives
through such a link is made inert before the tool sees it: `<`, `>`, `"`, `'` and the
backtick become look-alikes (‹ › ” ʼ) that can only be text, so no scenario name or column
header can become markup or close a quote in a template. Tools still escape what they
write into `innerHTML`; this is the second lock, not the first.

`node _ref/share-check.mjs` drives every chart's menu on a desktop and a phone, holds a
phone's and a wide monitor's PNG, SVG and copy to the desktop's size, opens every embed in
a page on another site at two widths to prove it shows that one card, draws exactly the
data the reader saw (E3) and what the tool draws in every view it offers (V1), on a
transparent background, sized by its host to what it shows (E14), saying it is loading
until it has drawn (E15), fetching nothing of the tool (E10) and never the Worker (E9),
follows the link back to prove the whole tool opens on that same chart (E12), replays
each embed with every string swapped for markup and script, which has to be drawn as text
and run nothing (E7), and opens links written to attack the viewer, which have to load
and run nothing (E16).

---

### Zoom and the Y Axis (`SharedZoom`, chart-kit.js)

Every zoomable chart makes the reader two promises, and `SharedZoom` keeps them in one
place so they cannot drift apart tool by tool.

**A gesture can never leave the data.** `SharedZoom.options()` returns the whole
`plugins.zoom` block — pan, wheel and pinch, all in `x` at the same speed — with `limits`
built from the extent of what was actually plotted, plus a floor on how far a pinch may go
(about five data points, past which there is nothing left to read).

**The y axis follows the x window.** A linear y axis is sized once, from the whole series,
so zooming into five years of a sixty-year plan leaves them a flat smear against a scale
built for the end of it. `SharedZoom.plugin` refits y to the slice on screen, inside the
same update the gesture triggers — a second update chasing the first would draw the lines
on the old scale under the new ticks.

```js
const chart = new Chart(canvas, {
  type: 'line',
  data: { labels, datasets },
  plugins: [SharedZoom.plugin],
  options: {
    plugins: {
      // `min`/`max` are the data's extent in x units (indices on a category
      // axis); `points` is how many there are, which sets the pinch floor.
      zoom: SharedZoom.options({ min: 0, max: labels.length - 1, points: labels.length }),
      // Which y axes to refit, and how. `includeZero` keeps zero on the axis
      // whichever side of it the window sits; `fixed` leaves an axis pinned to
      // a range of its own (a 0–100 percentage stack) alone.
      sharedYFit: { auto: { axes: ['y'], includeZero: true } },
    },
    scales: { /* … */ },
  },
});
```

A chart that sizes an axis to SOME of its series instead of all of them hangs its own
fitters on the instance — `chart.$fitY = {y: fn(xMin, xMax) -> {min, max}}` — and the same
plugin applies them. A single series that is deliberately allowed to run off the top (a
simulated band's best decile, say) carries `noAutoFit: true` on its dataset, and the chart
says so in its subtitle. A chart whose data is replaced in place rewrites
`options.plugins.zoom` on the update, so the limits travel with the data.

> **Why a custom HTML legend?** It lets each entry click-toggle its series, doubles as the
> source for PNG-export legends, and is styled with the same tokens as the rest of the page.

---

### Legend Swatches (`SharedLegend`)

**A legend is a key, not a colour list.** Whatever the chart draws, the entry shows: a dotted
line is dotted in the key, a dashed line dashed, a shaded range a block, a ring marker a ring,
a candlestick a candle. Never a coloured dot standing in for all of them.

The swatch is therefore **derived from the Chart.js dataset that draws the series**, so a change
to the line cannot leave a stale mark behind in the key:

```js
const item = document.createElement('div');
item.className = 'legend-item';
SharedLegend.attach(item, SharedLegend.fromDataset(datasets[i]), 'Money deposited');
legendEl.appendChild(item);
```

`fromDataset` reads `borderColor`, `borderDash`, `borderWidth`, the fill, and the point style.
Pass a literal spec (or a patch as the second argument) for anything the dataset cannot state —
a per-point callback, a fill that belongs to a neighbouring dataset, a mark the chart plugin
draws itself:

| Field | What it means |
| --- | --- |
| `type` | `line` (default), `area` (a band or fill with no line of its own), `bar`, `point`, `candle` |
| `color` / `colors` | stroke colour; `colors: [a, b]` for a line that changes colour partway |
| `dash`, `width` | Chart.js `borderDash` and `borderWidth`, drawn at the same scale |
| `fill`, `fill2` | fill under the line, or the block itself; `fill2` splits a two-colour band |
| `hatch` | colour of 45° lines over a `bar` or `area` block, for a hatched fill (existing plant under new build) |
| `point` | `{shape: 'circle' | 'ring' | 'triangle' | 'rect', fill, stroke, width, radius}` |

**Every series on the chart needs an entry.** A dashed reference line, a shaded min–max range,
a marker series, an indicator overlay — if it is drawn, it is in the key; if it is toggled off,
its entry goes with it.

`attach` also stashes the spec on the element (`data-swatch`), which is what the exporters read:

```js
const items = SharedLegend.itemsOf('chartLegend');   // [{label, color, swatch}], visible only
const rows  = SharedLegend.layout(items, measure, maxW, SharedLegend.W * OUT, gap, pad);
SharedLegend.paint(ctx, item.swatch, x, cy, OUT);    // PNG
svg.appendChild(SharedLegend.svgNode(item.swatch, x, cy, 1));   // SVG
```

One geometry function feeds the HTML swatch, the PNG and the SVG, so an exported chart carries
exactly the key the page shows. `layout` packs the entries into as many centred rows as they
need — a key wide enough to run off the canvas used to do exactly that — and the watermark gets
a strip of its own beneath them.

---

### Hover Card (`SharedChartTip`)

**The hover is a key too.** Chart.js paints one coloured square per tooltip row whatever the
series is drawn with, so a chart whose key shows a dotted line, a shaded band and a ring marker
answered the hover with three identical squares — the reader had to match rows to series by
colour alone, which is the very thing the legend swatches exist to stop.

So the canvas tooltip is replaced by a shared HTML card whose row marks come from the **same
spec the legend entry is built from**. Wrap the tooltip options you already write:

```js
tooltip: SharedChartTip.options({
  filter: item => !item.dataset.isBand,      // your own filter and callbacks, unchanged
  callbacks: { title: …, label: …, afterBody: … }
})
```

`options()` only adds `enabled: false` and the external renderer, so callbacks, filters and the
`.hover-box` read-out keep working exactly as before. Being an element rather than canvas
pixels, the card is also never clipped by a small canvas, and it is styled from the same tokens
as the rest of the page (`.chart-tip` in `shared.css`).

**A mark the dataset cannot state is pinned on the dataset**, and then the key and the card both
read it from there — via `SharedLegend.specOf(ds)`, which prefers `legendSpec` and otherwise
falls back to `fromDataset`:

```js
// A band is two datasets but one thing on the chart, so both edges carry the block:
const bandSpec = {type: 'area', fill: withAlpha(colour, 0.16)};
datasets.push({label: 'Worst 10%', …, legendSpec: bandSpec});
datasets.push({label: 'Best 10%',  …, legendSpec: bandSpec, fill: '-1'});

SharedLegend.attach(item, SharedLegend.specOf(ds), label);   // the key reads the same spec
```

Use `legendSpec` for a candlestick series (no line to read), a two-colour line, a MACD histogram
whose bars are two colours, a mark a plugin draws — anything `fromDataset` cannot see. Everything
else needs nothing: a bar, a pie slice and a plain line are resolved from the dataset and the
per-element colours Chart.js already resolved for the hovered point.

---

### Shared Options (axes, tooltip, zoom)

These option fragments are reused by the line and stacked charts. Note how **every axis has a
`title`**, **every tick has a `callback` formatter**, and **zoom/pan are constrained to the
x-axis** (the time dimension) so vertical scale stays honest.

```js
const grid = cssVar('--chart-grid'), muted = cssVar('--chart-text'), text = cssVar('--text');

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,                       // fill .canvas-wrap's fixed height
  animation: { duration: 300 },
  interaction: { mode: 'index', intersect: false }, // hover anywhere on the x to read all series

  plugins: {
    legend: { display: false },                     // we render our own HTML legend instead

    // SharedChartTip.options() wraps your own tooltip options: same callbacks,
    // same filter, drawn as the shared HTML card so each row carries the mark
    // its series is drawn with (see *Hover Card* below).
    tooltip: SharedChartTip.options({
      // Theme the tooltip from tokens, not hardcoded colours:
      backgroundColor: cssVar('--panel'), titleColor: text, bodyColor: muted,
      borderColor: grid, borderWidth: 1, padding: 10,
      callbacks: {
        title: ctx => ctx[0]?.label || '',
        label: ctx => `  ${ctx.dataset.label}: ${fmt.currency(ctx.parsed.y, true)}`,
        // Mirror the hovered point(s) into the persistent .hover-box read-out:
        afterBody(items) {
          if (!items.length) return;
          $('chartHoverBox').textContent = `${items[0].label}  —  ` +
            items.map(i => `${i.dataset.label}: ${fmt.currency(i.parsed.y, true)}`).join('  |  ');
        }
      }
    }),

    // Pan + zoom, x-axis only. Wheel + pinch to zoom, drag to pan.
    zoom: {
      pan:  { enabled: true, mode: 'x' },
      zoom: { wheel: { enabled: true, speed: .08 }, pinch: { enabled: true }, mode: 'x' }
    }
  },

  scales: {
    x: {
      title: { display: true, text: 'Date', color: muted, font: { size: 11 } },
      ticks: { color: muted, maxTicksLimit: 12, font: { size: 11 },
               callback: v => labels[Number(v)]?.slice(0, 7) || '' },  // e.g. "2024-01"
      grid:  { color: grid }
    },
    y: {
      title: { display: true, text: 'Value ($)', color: muted, font: { size: 11 } },
      ticks: { color: muted, font: { size: 11 }, callback: v => fmt.currency(v, true) },  // "$1.2m"
      grid:  { color: grid }
    }
  }
};
```

**Reset-zoom button** — wire it to the chart's `resetZoom()`:

```js
$('resetZoomBtn').addEventListener('click', () => { if (chart) chart.resetZoom(); });
```

**Clear the hover-box on mouse-leave** so it doesn't keep showing a stale point:

```js
$('chartCanvas').addEventListener('mouseleave', () => {
  $('chartHoverBox').textContent = 'Hover to inspect data points.';
});
```

---

### 1. Line Chart (one series per scenario)

A multi-series time chart. Series colours come from `--line-a … --line-e`; a faint matching
fill (`color + '22'`) hints the area without obscuring overlapping lines.

```js
function updateLineChart() {
  const grid = cssVar('--chart-grid'), muted = cssVar('--chart-text'), text = cssVar('--text');
  const LINE = ['--line-a','--line-b','--line-c','--line-d','--line-e'].map(cssVar);

  const datasets = scenarios.map((s, i) => ({
    label: s.name,
    data: s.values,
    borderColor: LINE[i % LINE.length],
    backgroundColor: LINE[i % LINE.length] + '22',
    borderWidth: 2.6, pointRadius: 0, pointHoverRadius: 5, tension: 0.15, fill: false
  }));

  renderLegend('chartLegend', datasets, (i, hidden) => {   // see "Custom Legend" below
    chart.setDatasetVisibility(i, !hidden);
    chart.update();
  });

  if (chart) chart.destroy();
  chart = new Chart($('chartCanvas'), { type: 'line', data: { labels, datasets }, options: baseOptions });
}
```

### 2. Stacked Area Chart (composition over time)

Parts that sum to a whole. Set `fill: true`, give every dataset the **same `stack` id**, and
make the y-axis `stacked: true`. The `afterBody` callback adds a **Total** line to the
read-out — essential context for a stack.

```js
const datasets = series.map(s => ({
  label: s.label, data: s.data,
  borderColor: s.color, backgroundColor: s.color + '66',   // 40%-ish fill, opaque enough to read
  borderWidth: 1.2, pointRadius: 0, pointHoverRadius: 4, tension: 0.15,
  fill: true, stack: 'composition'
}));

const options = {
  ...baseOptions,
  plugins: {
    ...baseOptions.plugins,
    tooltip: {
      ...baseOptions.plugins.tooltip,
      callbacks: {
        ...baseOptions.plugins.tooltip.callbacks,
        afterBody(items) {
          if (!items.length) return;
          const total = items.reduce((sum, i) => sum + i.parsed.y, 0);
          $('chartHoverBox').textContent = `${items[0].label}  —  Total: ${fmt.currency(total, true)}  |  ` +
            items.map(i => `${i.dataset.label}: ${fmt.currency(i.parsed.y, true)}`).join('  |  ');
        }
      }
    }
  },
  scales: {
    ...baseOptions.scales,
    y: { ...baseOptions.scales.y, stacked: true, min: 0 }
  }
};

chart = new Chart($('chartCanvas'), { type: 'line', data: { labels, datasets }, options });
```

> **Percentage mode.** To switch a stacked chart to "% of total", normalise each value to
> `v / total * 100`, set the y-axis `max: 100`, and swap the tick/tooltip formatter to
> `fmt.num(v, 0) + '%'`.

### 3. Pie / Doughnut Chart (share breakdown)

For composition at a single point in time. Use a thin gap between slices by setting the
slice border to the panel colour. **In small canvases the built-in tooltip clips at the
canvas edge** — render it as a fixed-position HTML bubble instead (pattern below).

```js
pieChart = new Chart($('pieCanvas').getContext('2d'), {
  type: 'doughnut',
  data: {
    labels: items.map(i => i.name),
    datasets: [{
      data: items.map(i => i.value),
      backgroundColor: items.map(i => i.color),
      borderColor: cssVar('--panel'), borderWidth: 2     // slice separators match the card bg
    }]
  },
  options: {
    responsive: true, maintainAspectRatio: true, cutout: '58%',   // omit cutout for a solid pie
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false, external: htmlPieTooltip,        // see below — avoids edge clipping
        callbacks: { label: c => `${c.label}: ${fmt.num(items[c.dataIndex].value, 1)}%` }
      }
    }
  }
});
```

**Un-clippable HTML tooltip** — a single body-level element, styled like the global tooltip,
positioned in viewport coordinates so it can overflow the (often tiny) pie canvas:

```js
function htmlPieTooltip(context) {
  const { chart, tooltip } = context;
  let el = document.getElementById('pieTip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'pieTip';
    el.style.cssText = 'position:fixed;z-index:99999;pointer-events:none;' +
      'background:var(--panel-raised,var(--panel));border:1px solid var(--border);' +
      'border-radius:var(--radius-lg,10px);padding:6px 10px;font-size:.8rem;line-height:1.4;' +
      'color:var(--text);box-shadow:var(--shadow-lg);opacity:0;transition:opacity .12s;' +
      'white-space:nowrap;transform:translate(-50%,calc(-100% - 10px));';
    document.body.appendChild(el);
  }
  if (!tooltip || tooltip.opacity === 0) { el.style.opacity = '0'; return; }

  const lines = (tooltip.body || []).flatMap(b => b.lines);
  el.innerHTML = lines.map((l, idx) => {
    const c = (tooltip.labelColors && tooltip.labelColors[idx]) || {};
    return `<span style="display:inline-flex;align-items:center;gap:6px">` +
      `<span style="width:10px;height:10px;border-radius:2px;flex-shrink:0;` +
      `background:${c.backgroundColor || 'transparent'}"></span>${l}</span>`;
  }).join('');

  const r = chart.canvas.getBoundingClientRect();
  const halfW = el.offsetWidth / 2 + 8;
  el.style.left = Math.max(halfW, Math.min(r.left + tooltip.caretX, window.innerWidth - halfW)) + 'px';
  el.style.top  = (r.top + tooltip.caretY) + 'px';
  el.style.opacity = '1';
}
```

---

### Custom Legend (clickable series toggle)

The HTML legend mirrors the datasets and toggles each series on click, dimming the entry
when hidden. Build it once per render:

```js
function renderLegend(legendId, datasets, onToggle) {
  const el = $(legendId); el.innerHTML = '';
  datasets.forEach((ds, i) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<span class="dot" style="background:${ds.borderColor}"></span><span>${ds.label}</span>`;
    item.addEventListener('click', () => {
      const hidden = !item.classList.contains('hidden');
      item.classList.toggle('hidden', hidden);
      onToggle(i, hidden);
    });
    el.appendChild(item);
  });
}
```

---

### Axis Titles & Formatting (checklist)

- **Both axes carry a `title`** with `color: cssVar('--chart-text')` and `font.size: 11`.
- **X (time) axis**: cap density with `maxTicksLimit: 12`; format labels in the `callback`
  (e.g. trim an ISO date to `YYYY-MM` with `label.slice(0, 7)`).
- **Y (value) axis**: format ticks through `fmt.currency(v, true)` (compact — `$1.2m`),
  `fmt.num()`, or `fmt.pct()`. Pin `min: 0` for stacked/area charts so the baseline is real.
- **Grid lines** use `--chart-grid`; **axis text** uses `--chart-text`.
- Include the **unit in the axis title** (`Value ($)`, `% of Total`) so a stripped tick
  (`1.2m`) is never ambiguous.

### Legends & Hover Information (checklist)

- Disable Chart.js's built-in `legend`; render the **custom HTML legend** so entries can
  toggle series and match the page's styling.
- Set `interaction: { mode: 'index', intersect: false }` so hovering anywhere on the x-axis
  surfaces **every series** at that point.
- Use tooltip `callbacks.label` to format each value, and `callbacks.afterBody` to feed a
  **persistent `.hover-box`** beneath the chart (and a running **Total** for stacked charts).
- Theme the tooltip from tokens (`--panel`, `--text`, `--chart-text`, `--chart-grid`).

### Panning & Zooming (checklist)

- Register the zoom plugin (loaded globally via the CDN script — Chart.js 4 auto-registers it).
- Constrain to `mode: 'x'` for both `pan` and `zoom` so the value axis stays fixed and
  comparisons remain truthful.
- Enable `wheel` (desktop) and `pinch` (touch) zoom; `speed: .08` is a comfortable wheel rate.
- Always provide a **Reset zoom** button calling `chart.resetZoom()`.
