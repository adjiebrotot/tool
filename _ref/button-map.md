# Button Map

Every button on every tool, grouped by the job it does. The rules behind it are
in `design-reference.md`, **Buttons and Icons**; `node _ref/button-check.mjs`
holds the pages to them. When a new tool needs a button, find its job here and
copy that row: same picture, same weight, same words.

Column key: **Picture** is what the reader sees. **Weight** is primary (accent
fill), secondary (soft fill and border), bare (nothing until hovered) or link.

---

## Leaving and closing

| Job | Picture | Weight | Where |
| --- | --- | --- | --- |
| Close a panel, modal or card; nothing is lost | ✕ (`SharedIcon` close) | bare | Finance vs Cash scenario editor (top right) · Rent vs Own Sensitivity chart and compare popups · World Clock Time Travel panel, pinned place card |
| Finish an editor; the work is already kept | `✓ Done`, pinned to the bottom of the scroll | primary | Finance vs Cash scenario editor |
| Close and keep (worded) | `Keep it, close` | primary | Random Picker winner banner |
| Back out of a confirmation | `Cancel` beside the action | secondary | Markdown to PDF print tip (`Cancel` · `Open print dialog`) · Canvas Builder confirm (`Cancel` · `Proceed`) |
| Leave a tour | `Skip tour` | link | every tool with a tour |
| Go to another page | `← Other Tools`, `← Back`, `← Back to checker` | secondary (header) | every tool |

## Deleting and clearing

| Job | Picture | Weight | Where |
| --- | --- | --- | --- |
| Delete one item | bin | bare, red on hover | Finance vs Cash scenario card, rate and repayment periods · Rent vs Own rate periods, cost items, CAGR rows · Sensitivity scenario header, periods, cost items · Financial Freedom stages (both sides) · DCA scenario, ticker chips · Portfolio portfolio, assets, ticker chips · Egg Price sizes · Cost of Living destinations, expense rows · Sankey rows · PowerFactory input variables, element types, output variables, constraints · Canvas Builder item (hover) and format bar |
| Delete with a word | bin + `Remove from list` | secondary | Random Picker winner banner |
| Empty a whole list or document | bin + `Clear` / `Clear all` | secondary or bare-with-label | DCA and Portfolio `Clear all` (loaded assets) · Sankey `Clear` · JSON Visualiser bin (in a boxed row, so boxed) |
| Empty a search field | backspace key, inside the field | bare | Cost of Living From / To / destination pickers · World Clock place search |
| Put a value back to automatic | anticlockwise arrow, on the swatch | badge | Sankey row colour |
| Restore the whole form to defaults | `↺ Reset` / `↺` | secondary | Egg Price · Sankey · PowerFactory (asks first) |

## Making and changing

| Job | Picture | Weight | Where |
| --- | --- | --- | --- |
| Add an item | `+ Add …` / `+` | primary or secondary (dashed for an inline add) | `+ Add Scenario`, `+ Add Period` (Finance vs Cash) · `+ Add Period`, `+ Add setup cost`, `+ Add ongoing cost`, `+ Row` (Rent vs Own) · `+ Scenario` (Sensitivity) · `+ Add stage` (Financial Freedom) · `+` new scenario / portfolio, `+ Add`, `+ Add Simulated Asset` (DCA, Portfolio) · `+ Add size` (Egg Price) · `+ Add Flow` (Sankey) · `+ Add Input Variable`, `+ Add Element Type`, `+ Add Output Variable`, `+ Add Constraint` (PowerFactory) · `+ New file` (Markdown to PDF) |
| Duplicate an item beside itself | two sheets and a plus | bare | Finance vs Cash scenario card · Sensitivity scenario header · DCA scenario · Portfolio portfolio |
| Edit an item | pencil | bare (icon only) or secondary (worded) | Finance vs Cash scenario card · Portfolio `Change method` · Markdown to PDF `Edit` (toggles with eye `Preview`) · DCA and Portfolio `Edit list` |
| Reorder by dragging | `⠿` | bare | Sensitivity scenario columns · Portfolio assets · Cost of Living destination columns |

## Files

| Job | Picture | Weight | Where |
| --- | --- | --- | --- |
| Save the work to a file | floppy disk | bare in a Quick Start row, boxed in a header or toolbar | every finance tool (`SharedScenario`) · Canvas Builder `Save` · PowerFactory setup |
| Open a file from this device | open folder | as above | every finance tool (`SharedScenario`) · Canvas Builder `Open` · PowerFactory setup · Sensitivity `CSV` · Video to GIF `Open video` · WEM Checker `Open XLSX` · JSON Visualiser drop zone |
| Download an export | `⬇` + format | secondary | chart clusters `⬇ SVG` `⬇ PNG` and tables `⬇ CSV` on every chart tool · Sensitivity `⬇ CSV` and per-scenario `⬇` Own / Rent cashflow · Markdown to PDF `⬇ MD` `⬇ PDF` · Video to GIF `⬇ Download GIF` · PowerFactory `⬇ .py` / `⬇ .ipynb`, `⬇ Download Template (.xlsx)`, samples `⬇ JSON` · Sankey `⬇ CSV`, `⬇ Download CSV Template` · WEM Checker `⬇ CSV` · Canvas Builder `⬇ PNG` (primary: it is that tool's output) |
| Copy to the clipboard | `⧉` | secondary, square | every chart cluster · Canvas Builder · PowerFactory code · JSON Visualiser · Sankey |
| Fetch data from the web | `⤓ Load tickers`, `Fetch` | primary / secondary | DCA and Portfolio · Financial Freedom ticker · JSON Visualiser URL |
| Load a worked example | `Load a sample …` / `Sample` | secondary | Graph Visualiser · JSON Visualiser · Markdown to PDF · Video to GIF · Canvas Builder |

## Running and viewing

| Job | Picture | Weight | Where |
| --- | --- | --- | --- |
| Run the tool's computation | `▶ …` | primary | `▶ Simulate` (DCA, Portfolio, Financial Freedom) · `▶ Generate Code` (PowerFactory) · `▶ Check` (WEM Checker) · `▶ Convert to GIF` (Video to GIF) · `▶ Visualise` (Graph Visualiser) |
| Compute a side answer | worded | primary, small | `Calculate CAGR` (Rent vs Own) |
| Reset a chart's zoom or view | `⟳` | secondary, square | every chart cluster · Finance vs Cash 3D view · JSON Visualiser `⟳ Reset` |
| Zoom | `+` / `−` | secondary, square | JSON Visualiser · World Clock |
| Back to my place / now | crosshair · `↩ Back to now` | secondary | World Clock |
| Show a chart or table | `Show table ▾` · chart icon · `Compare` | secondary / bare | every finance tool's tables · Sensitivity per-scenario chart and `Compare` |
| Play a video | `▶` `◀◀` `▶▶` | secondary, square | Video to GIF player |

## Page furniture

| Job | Picture | Weight | Where |
| --- | --- | --- | --- |
| Quick Start scenarios | worded pills under a bolt | pill | every finance tool · Sankey · PowerFactory |
| Theme | `🌙 Dark` / `☀️ Light` | secondary (header) | every tool |
| Language | `ID` / `EN` | secondary (header) | Rent vs Own, Sensitivity, Pisah vs Gabung |
| Tour | `🧭 Take a tour` | secondary (header) | tools with a tour |
| Expand / collapse | `▾` | link | section headers, FAQ, `More ▾`, PowerFactory output variables |

---

## What changed when the vocabulary was set

| Tool | Before | After | Rule |
| --- | --- | --- | --- |
| Finance vs Cash | card `✎` `⧉` `✕` in bordered boxes | bare pencil, duplicate, bin | 1, 2 |
| Finance vs Cash | period delete `✕` in a filled box | bare bin | 1, 2 |
| Finance vs Cash | editor: `✕` (close without saving) at the top, `Save` / `Cancel` at the end of a long form | edits apply as you go; bare ✕, `✓ Done` pinned to the bottom and Esc all keep the work; no discard | 3 |
| Finance vs Cash | primary buttons with hard-coded white text (unreadable on the dark theme's pale accent) | `var(--text-inv)` | 2 |
| Rent vs Own | rate period `✕` filled box, cost item and CAGR row `✕` in red outline | bare bin | 1, 2 |
| Sensitivity | scenario remove drawn as ✕, period and cost `✕` | bin | 1 |
| Sensitivity | duplicate (sheets) | sheets and a plus, so it is not read as copy to clipboard | 4 |
| Sensitivity | chart popup close in a bordered box | bare ✕ | 2 |
| Sensitivity | per-scenario `⬇` / chart buttons in filled boxes | bare | 2 |
| Sensitivity | `⬆ CSV` (upload) | folder `CSV` (open; nothing is uploaded) | 4 |
| Financial Freedom | stage `✕` in red outline | bare bin | 1, 2 |
| DCA, Portfolio | scenario / portfolio `⧉` `✕` in filled boxes | bare duplicate, bin | 1, 2, 4 |
| DCA, Portfolio | chip `×`, asset `×` in a red box | bin | 1, 2 |
| DCA, Portfolio | `Clear all`, `✎ Edit list`, method `✎` in a box | bin `Clear all`, pencil `Edit list`, bare pencil | 4, 2 |
| Egg Price | size `✕`, `＋ Add size` | bare bin, `+ Add size` | 1, 4 |
| Cost of Living | destination / row `✕`, picker `×` | bin, backspace key | 1 |
| Sankey | row `✕`, colour `×`, `✕ Clear`, `＋ Add Flow` | bin, reset arrow, bin `Clear`, `+ Add Flow` | 1, 4 |
| JSON Visualiser | red-filled `✕` clear, `⊡ Reset`, 🗂️ drop zone | bin (boxed, red on hover), `⟳ Reset`, folder | 1, 2, 4 |
| PowerFactory | four `✕` removes in red boxes | bare bin | 1, 2 |
| PowerFactory | `⚡ Generate Code`, green `⧉`, `↓ .py`, `↓ JSON`, `↑ JSON`, red `↺` | `▶ Generate Code`, `⧉`, `⬇ .py`, floppy, folder, `↺`, all one weight | 4, 2 |
| PowerFactory | validation errors marked `✕` | `⚠` | 1 |
| Canvas Builder | `⊗` and `×` deletes, `💾 Save`, `📂 Load`, `✨ Sample` | bin, floppy `Save`, folder `Open`, `Sample` | 1, 4 |
| Random Picker | `🗑 Remove from list` | bin `Remove from list` | 4 |
| Markdown to PDF | `📂 New file`, `✏️ Edit` / `👁 Preview`, `✕ Avoid …` | `+ New file`, pencil `Edit` / eye `Preview`, `⚠ Avoid …` | 4, 1 |
| Video to GIF | `📂 Load Video`, `⚙ Convert to GIF` | folder `Open video`, `▶ Convert to GIF` | 4 |
| WEM Checker | `📥 Export CSV`, `📊 Upload XLSX`, `⚡ Check` | `⬇ CSV`, folder `Open XLSX`, `▶ Check` | 4 |
| Graph Visualiser | Visualise with a magnifier | `▶ Visualise` | 4 |
| World Clock | place search `✕` | backspace key | 1 |
| Borrowing Capacity | copy failure flashed `✕` | says so in words, like every other tool | 1 |
| Every finance tool | Quick Start save / open in filled boxes | bare | 2 |
| Every tool with a sticky sidebar | the card's last ~150px (Simulate, Load, Reset / Clear) under the fold until the reader scrolled | `SharedReach` sizes the card to the room it has, so its bottom row is on screen at first load | 3 |
