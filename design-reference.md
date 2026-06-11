# Design Reference

This file documents the **Generic Soft UI Design System** used across tools in this repo
(e.g. `dcasimulator`, `rentvsownhouse`, `financingvscash`).

Fonts: **DM Sans** (sans-serif) + **DM Mono** (monospace).
Tokens live in `dark.css` (default) and `light.css` (applied via `body.light`).
Shared, theme-independent components live in `shared.css` / `shared.js`.

To use this system in a new page, include (in this order):

```html
<link rel="stylesheet" href="../dark.css">
<link rel="stylesheet" href="../light.css">
<link rel="stylesheet" href="../shared.css">
<link rel="stylesheet" href="style.css">  <!-- your page-specific overrides -->
...
<script src="../shared.js"></script>
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

## Tooltips (`shared.css` + `shared.js`)

Add a `#globalTooltip` container is auto-created by `shared.js`. To trigger a tooltip on any element,
add `data-tip` with HTML content:

```html
<span class="tip-wrap">
  Field label
  <span class="tip-icon" data-tip="This is a helpful explanation.<br>Spans multiple lines.">i</span>
</span>
```

```css
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

```js
// shared.js auto-initialises the global tooltip on DOMContentLoaded
SharedTooltip.init();
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

For sticky headers / frozen first column on wide tables, see `rentvsownhouse/sensitivity/style.css`
(`.table-wrap thead th { position: sticky; ... }`).

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
--radius-lg: 12px;   /* boxes (e.g. cagr-box) */
--radius-xl: 14px;   /* cards, panels, tiles */
--radius-2xl: 20px;  /* large surfaces */
--radius-pill: 999px;/* badges, deltas, toggles */

--motion-fast: 150ms; /* hover/focus transitions */
--motion-base: 250ms; /* theme switch, toggles */
--motion-slow: 400ms; /* larger animations */
```
