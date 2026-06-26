# Design Reference

This file documents the **Generic Soft UI Design System** — a reusable, theme-aware
component and token library for building data-driven dashboards, calculators, and
visualisation tools. It is domain-agnostic and can be dropped into any web project.

Fonts: **DM Sans** (sans-serif) + **DM Mono** (monospace).
Tokens live in `dark.css` (default) and `light.css` (applied via `body.light`).
Shared, theme-independent components live in `shared.css` / `shared.js`.

To use this system in a new page, include the shared stylesheets and scripts (in this
order), then layer your own page-specific overrides on top:

```html
<link rel="stylesheet" href="dark.css">
<link rel="stylesheet" href="light.css">
<link rel="stylesheet" href="shared.css">
<link rel="stylesheet" href="style.css">  <!-- your page-specific overrides -->
...
<script src="shared.js"></script>
<script src="script.js"></script>
```

And add the font import at the top of your page's `style.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500;600&display=swap');
```

---

## CSS Variables & Theming

### `dark.css` (default — applies to `:root`)

```css
:root {
  --bg:#0F1728; --panel:#162033; --panel-raised:#1C2942; --text:#EAF1FF; --muted:#A8B6CF; --border:#2C3A52;
  --accent:#8DBBFF; --accent-strong:#B3D1FF; --accent2:#8FCDBD; --accent3:#FF8B8B; --gold:#FFD28C;
  --input-bg:rgba(255,255,255,0.06); --card-bg:rgba(255,255,255,0.03); --bg-subtle:#111C2F; --text-inv:#0F1728;

  --shadow:    0 2px 16px rgba(120,160,220,0.12);
  --shadow-sm: 0 1px 8px rgba(120,160,220,0.08);
  --shadow-lg: 0 4px 32px rgba(120,160,220,0.18);

  --radius-sm:8px; --radius-md:10px; --radius-lg:12px; --radius-xl:14px; --radius-2xl:20px; --radius-pill:999px;

  /* Directional data colours */
  --positive:#0052CC; --positive-em:#7FB2FF; --negative:#E63939; --negative-em:#FF8B8B;
  --positive-bg:#10284D; --negative-bg:#4A1C1C;
  --positive-border:#2D67C7; --negative-border:#C85F5F;

  /* Aliases (legacy data-pos/data-neg naming) */
  --data-pos:var(--positive); --data-pos-em:var(--positive-em); --data-pos-bg:var(--positive-bg); --data-pos-border:var(--positive-border);
  --data-neg:var(--negative); --data-neg-em:var(--negative-em); --data-neg-bg:var(--negative-bg); --data-neg-border:var(--negative-border);

  /* Status / feedback colours */
  --success-bg:#103529; --success-text:#9BE7B4;
  --error-bg:#4A1D26;   --error-text:#FFB3BA;
  --warning-bg:#4A3412; --warning-text:#FFD28C;
  --info-bg:#132E56;    --info-text:#A8C9FF; --info-border:#2D67C7;

  /* Chart tokens */
  --chart-text:#A8B6CF; --chart-grid:#2C3A52;

  /* Chart line colours (scenarios) */
  --line-a:#8DBBFF; --line-b:#FF8B8B; --line-c:#8FCDBD; --line-d:#F1C0D0; --line-e:#FFD28C;
  --line-rtb-rent:#FF8B8B; --line-rtb-own:#8DBBFF;

  /* Motion */
  --motion-fast:150ms; --motion-base:250ms; --motion-slow:400ms;
  --transition-fast:var(--motion-fast); --transition-base:var(--motion-base);
}
```

### `light.css` (applied via `body.light`)

```css
body.light {
  --bg:#F0F4FF; --panel:#FFFFFF; --panel-raised:#FFFFFF; --text:#2D3436; --muted:#7F8C8D; --border:#E0E6F0;
  --accent:#5A91E8; --accent-strong:#3A71C8; --accent2:#2E9E7A; --accent3:#FFD6E0; --gold:#B45309;
  --input-bg:rgba(0,0,0,0.04); --card-bg:rgba(255,255,255,0.85); --bg-subtle:#F8FBFF; --text-inv:#FFFFFF;

  --shadow:    0 2px 16px rgba(120,160,220,0.12);
  --shadow-sm: 0 1px 8px rgba(120,160,220,0.08);
  --shadow-lg: 0 4px 32px rgba(120,160,220,0.18);

  /* Directional data colours */
  --positive:#0052CC; --positive-em:#0052CC; --negative:#E63939; --negative-em:#E63939;
  --positive-bg:#EAF2FF; --negative-bg:#FDECEC;
  --positive-border:#8FB5FF; --negative-border:#F3A5A5;

  /* Aliases (legacy data-pos/data-neg naming) */
  --data-pos:var(--positive); --data-pos-em:var(--positive-em); --data-pos-bg:var(--positive-bg); --data-pos-border:var(--positive-border);
  --data-neg:var(--negative); --data-neg-em:var(--negative-em); --data-neg-bg:var(--negative-bg); --data-neg-border:var(--negative-border);

  /* Status / feedback colours */
  --success-bg:#C8F7C5; --success-text:#1A4A18;
  --error-bg:#FFB3BA;   --error-text:#4A1018;
  --warning-bg:#FFF0D9; --warning-text:#7A4A00;
  --info-bg:#EAF2FF;    --info-text:#174A9C; --info-border:#8FB5FF;

  /* Chart tokens */
  --chart-text:#4A5A6A; --chart-grid:#C8D4E8;

  /* Chart line colours (scenarios) */
  --line-a:#5A91E8; --line-b:#E63939; --line-c:#4A9E87; --line-d:#C46A7E; --line-e:#9B59B6;
  --line-rtb-rent:#E63939; --line-rtb-own:#5A91E8;
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
h1 { margin: 0 0 8px; font-size: 2rem; font-weight: 800; letter-spacing: -0.02em; }
h2 { margin: 0 0 10px; font-size: 1.15rem; font-weight: 700; }
h3 {
  margin: 0 0 8px;
  font-size: 0.75rem;
  color: var(--muted);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
p, .muted { color: var(--muted); line-height: 1.5; margin: 0; }
```

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

/* Sidebar sticks while scrolling */
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

```css
.btn-theme {
  background: var(--input-bg);
  border: 1px solid var(--border);
  color: var(--muted);
  border-radius: var(--radius-md);
  padding: 8px 14px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
  font-family: inherit;
}
.btn-theme:hover { border-color: var(--accent); color: var(--text); }
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

```html
<div class="ctrl-tabs">
  <button class="ctrl-tab active" data-tab="inputs">📊 Inputs</button>
  <button class="ctrl-tab" data-tab="advanced">⚙️ Advanced</button>
</div>
<div class="ctrl-panel active" id="tab-inputs">…</div>
<div class="ctrl-panel" id="tab-advanced">…</div>
```

```css
.ctrl-tabs { display: flex; border-bottom: 1px solid var(--border); }
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

### Section Label

```css
.section-label {
  font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--accent); margin: 14px 0 8px; padding-bottom: 5px; border-bottom: 1px solid var(--border);
}
.section-label:first-child { margin-top: 0; }
```

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
  <div class="currency-wrap">
    <span class="prefix">$</span>
    <input class="currency-input" id="startingValue" type="text" inputmode="decimal" value="500,000" />
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

/* Currency input: prefix/suffix unit labels */
.currency-wrap { position: relative; }
.currency-wrap .prefix,
.currency-wrap .suffix {
  position: absolute; top: 50%; transform: translateY(-50%);
  color: var(--muted); font-weight: 700; font-size: 0.88rem; pointer-events: none;
}
.currency-wrap .prefix { left: 11px; }
.currency-wrap .suffix { right: 11px; }
.currency-input {
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
.currency-input:focus { border-color: var(--accent); background: var(--panel); }
.currency-wrap .currency-input { padding-left: 32px; }
.currency-wrap .currency-input.has-suffix { padding-left: 13px; padding-right: 42px; }
.currency-wrap .prefix ~ .currency-input.has-suffix { padding-left: 32px; }
```

For live thousand-separator formatting, use `shared.js`:

```js
SharedFmt.attachCurrencyInput(document.getElementById('startingValue'), { maxDecimals: 0 });
// To read the numeric value back:
const value = SharedFmt.parseFormatted(document.getElementById('startingValue').value);
```

### Dropdown / Select (`.sel-input`)

```css
.sel-input {
  background: var(--input-bg);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text);
  font-family: inherit;
  font-size: 0.92rem;
  font-weight: 600;
  padding: 10px 13px;
  width: 100%;
  outline: none;
  transition: border-color var(--transition-fast);
  cursor: pointer;
  appearance: none; -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23A8B6CF'%3E%3Cpath d='M2 4l4 4 4-4'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
}
.sel-input:focus { border-color: var(--accent); }

/* CRITICAL: hard-code option colours — browsers ignore CSS variables on <option> */
.sel-input option            { background: #162033; color: #EAF1FF; }
body.light .sel-input option { background: #ffffff;  color: #2D3436; }
```

### Segmented Control Group (`.seg-group`)

A group of mutually-exclusive toggle buttons styled as a single segmented control
(e.g. "Simple / Detailed", "Save / Earn").

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

### Searchable Combobox / City Picker (`.city-picker`)

A fully custom searchable dropdown for selecting from a long list (e.g. cities, accounts,
symbols). Features live search, clear button, and keyboard support.

#### HTML

```html
<div class="city-block">
  <label>📍 From city</label>
  <div class="city-picker" id="fromPicker">
    <input class="city-search" type="text" placeholder="Search cities…" autocomplete="off" />
    <button class="city-clear" aria-label="Clear selection">✕</button>
    <div class="city-dropdown">
      <!-- Options populated by JS -->
      <div class="city-opt">
        <div>New York</div>
        <div class="opt-sub">United States</div>
      </div>
      <div class="city-opt">
        <div>Sydney</div>
        <div class="opt-sub">Australia</div>
      </div>
    </div>
  </div>
</div>
```

#### CSS

```css
/* Container & search input */
.city-picker { position: relative; }
.city-search {
  width: 100%;
  background: var(--input-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  font-size: 0.9rem;
  font-family: inherit;
  color: var(--text);
  outline: none;
  transition: border-color 150ms;
}
.city-search:focus { border-color: var(--accent-strong); }

/* When a value is selected, highlight the input */
.city-search.has-value { border-color: var(--accent-strong); background: var(--positive-bg); padding-right: 28px; }

/* Clear button (✕) */
.city-clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: var(--muted);
  font-size: 1rem;
  line-height: 1;
  padding: 2px 3px;
  display: none;
  z-index: 1;
}
.city-clear:hover { color: var(--text); }
.city-search.has-value ~ .city-clear { display: block; }

/* Dropdown menu */
.city-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  max-height: 220px;
  overflow-y: auto;
  z-index: 200;
  display: none;
}
.city-dropdown.open { display: block; }

/* Individual option */
.city-opt {
  padding: 7px 12px;
  font-size: 0.86rem;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  transition: background 100ms;
}
.city-opt:last-child { border-bottom: none; }
.city-opt:hover, .city-opt.focused { background: var(--positive-bg); color: var(--positive-em); }

/* Subtitle (e.g. country) */
.city-opt .opt-sub { font-size: 0.75rem; color: var(--muted); }
```

#### JavaScript (Pattern)

```js
const cities = [
  { name: 'New York', sub: 'United States', value: 'nyc' },
  { name: 'Sydney', sub: 'Australia', value: 'syd' },
  { name: 'London', sub: 'United Kingdom', value: 'lon' },
  // ...
];

const picker = document.getElementById('fromPicker');
const search = picker.querySelector('.city-search');
const dropdown = picker.querySelector('.city-dropdown');
const clearBtn = picker.querySelector('.city-clear');
let selectedValue = null;

function renderOptions(filter = '') {
  dropdown.innerHTML = cities
    .filter(c => c.name.toLowerCase().includes(filter.toLowerCase()))
    .map(c => `
      <div class="city-opt" data-value="${c.value}">
        <div>${c.name}</div>
        <div class="opt-sub">${c.sub}</div>
      </div>
    `).join('');

  picker.querySelectorAll('.city-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      selectedValue = opt.dataset.value;
      search.value = cities.find(c => c.value === selectedValue).name;
      search.classList.add('has-value');
      dropdown.classList.remove('open');
    });
  });
}

search.addEventListener('input', (e) => {
  renderOptions(e.target.value);
  dropdown.classList.add('open');
});

search.addEventListener('focus', () => {
  renderOptions(search.value);
  dropdown.classList.add('open');
});

document.addEventListener('click', (e) => {
  if (!picker.contains(e.target)) dropdown.classList.remove('open');
});

clearBtn.addEventListener('click', () => {
  search.value = '';
  selectedValue = null;
  search.classList.remove('has-value');
  dropdown.classList.remove('open');
  renderOptions();
});

renderOptions();
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

## Tooltips

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

/* Trigger icon */
.tip-wrap { position: relative; display: inline-flex; align-items: center; gap: 4px; cursor: help; }
.tip-icon {
  display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px;
  border-radius: 50%; background: var(--input-bg); border: 1px solid var(--border); color: var(--muted);
  font-size: 0.7rem; font-weight: 800; cursor: help; flex-shrink: 0; line-height: 1; font-style: normal;
}
.tip-icon:hover { border-color: var(--accent); color: var(--accent); }
.tip-icon.warn { background: rgba(245,158,11,.18); color: var(--gold); border-color: rgba(245,158,11,.3); }
.tip-icon.warn:hover { border-color: var(--gold); }
```

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
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
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
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
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
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.table-wrap { overflow: auto; max-height: 400px; }
tr:hover td { background: rgba(141,187,255,0.04); }
body.light tr:hover td { background: rgba(90,145,232,0.04); }
```

For sticky headers / a frozen first column on wide tables, make the header cells
`position: sticky; top: 0;` (and the first column `position: sticky; left: 0;`) with a
solid background so rows scroll underneath them.

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
| Primary/default scenario line | `--line-a` / `--accent` |
| Secondary scenario line | `--line-b` |
| Third scenario line | `--line-c` / `--accent2` (mint) |
| Fourth scenario line | `--line-d` / `--accent3` (rose) |
| Fifth scenario line | `--line-e` (gold) |
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
- Red family (`--negative`, `--accent3` dark) → critical negative / destructive / error
- Mint (`--accent2`) → secondary supportive / calm / soft success
- Rose / gold (`--accent3` light, `--gold`) → accent / warm emphasis / tertiary
- Monospace (`DM Mono`) → all numeric values and data

---

## Border Radius & Motion Tokens

```css
--radius-sm: 8px;    /* small chips, inputs */
--radius-md: 10px;   /* buttons, inputs, selects */
--radius-lg: 12px;   /* callout boxes, highlighted stats */
--radius-xl: 14px;   /* cards, panels, tiles */
--radius-2xl: 20px;  /* large surfaces */
--radius-pill: 999px;/* badges, deltas, toggles */

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
and a hover read-out box. The title row's `.chart-actions` hold export + reset-zoom buttons.

```html
<section class="chart-card card">
  <div class="section-title">
    <div><h2>Value Over Time</h2></div>
    <div class="chart-actions">
      <div class="btn-cluster">
        <button class="btn-secondary" id="pngBtn"       title="Download PNG">⬇ PNG</button>
        <button class="btn-secondary" id="copyBtn"      title="Copy PNG to clipboard">⧉</button>
        <button class="btn-secondary" id="resetZoomBtn" title="Reset zoom">⟳</button>
      </div>
    </div>
  </div>
  <div class="legend" id="chartLegend"></div>          <!-- custom HTML legend -->
  <div class="canvas-wrap"><canvas id="chartCanvas"></canvas></div>
  <div class="hover-box" id="chartHoverBox">Hover to inspect data points.</div>
</section>
```

```css
.chart-card    { padding: 20px; margin-bottom: 18px; }
.chart-actions { display: flex; justify-content: flex-end; align-items: center; gap: 10px 16px; flex-wrap: wrap; }
.btn-cluster   { display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0; }

/* Custom legend (replaces Chart.js's built-in legend) */
.legend        { display: flex; gap: 14px; flex-wrap: wrap; margin: 10px 0 14px; font-size: .86rem; }
.legend-item   { display: flex; align-items: center; gap: 7px; cursor: pointer; opacity: 1; transition: opacity .15s; }
.legend-item.hidden { opacity: .35; }                /* dimmed when its series is toggled off */
.dot           { width: 11px; height: 11px; border-radius: 999px; flex-shrink: 0; }

/* Canvas wrapper — fixed height so a responsive canvas has a definite box to fill */
.canvas-wrap   { position: relative; width: 100%; height: 420px; border: 1px solid var(--border); border-radius: 14px; overflow: hidden; background: var(--card-bg); }

/* Persistent hover read-out beneath the chart */
.hover-box     { margin-top: 10px; color: var(--muted); font-size: .86rem; min-height: 22px; }

@media (max-width: 1100px) { .canvas-wrap { height: 340px; } }
@media (max-width: 600px)  { .canvas-wrap { height: 280px; } .chart-actions { justify-content: flex-start; } }
```

> **Why a custom HTML legend?** It lets each entry click-toggle its series, doubles as the
> source for PNG-export legends, and is styled with the same tokens as the rest of the page.

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

    tooltip: {
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
    },

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
