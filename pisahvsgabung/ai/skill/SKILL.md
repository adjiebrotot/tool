---
name: brotools-pisahvsgabung
description: "Opens Adjie Brotools' Pisah vs Gabung Harta (https://tool.adjiebrotots.com/pisahvsgabung/) on the user's own scenario with one link, and the tool computes the answer. Use when the user asks about Indonesian married couples' PPh 21 income tax: whether Pisah Harta (PH/MT) or Gabung Harta (joint) pays less, for given salaries, deductions and dependants. Requests often come in Indonesian. Also use when they mention tool.adjiebrotots.com/pisahvsgabung."
---

# Pisah vs Gabung Harta on tool.adjiebrotots.com

Pisah vs Gabung Harta is a free calculator that runs in the user's browser. This skill turns the user's question into **one link** that opens the tool on their scenario. The tool, not you, works out the result: its figures come from its own model and data, and anything you work out separately can differ from what the user then sees.

## What it decides

- **PPh 21: Pisah Harta vs Gabung Harta** (`pisahvsgabung`): Whether a married couple in Indonesia pays less PPh 21 income tax with Gabung Harta (the husband's tax return uses PTKP K, and the wife's employer withholds final tax on her salary with her own PTKP) or with Pisah Harta (PH or MT: the tax is worked out on their combined net income and shared by each spouse's net income), from each spouse's yearly gross salary, deductions and dependants, and the household salary at which the cheaper way changes. Requests often come in Indonesian: write the assumptions in the language the user wrote in.

Indonesian versions take the same keys and Quick Starts. Use them when the user writes in Indonesian: `pisahvsgabung/id` (https://tool.adjiebrotots.com/pisahvsgabung/id/).

## Workflow

1. **Pick the page.** Read the user's request and choose the page above that answers it. Open its reference (`references/<page>.md`, listed under Files) and read the LINK FORMAT, the most important keys and the Quick Starts. The reference is long: read the parts you need.
2. **Separate what the user said from what you must choose.** Every figure the user gave goes in as they gave it (convert units or periods only to match the field, and say so).
3. **Fill every other input that matters with a researched assumption.**
   - If you can search the web, do it for figures that change over time or by place. For this tool that usually means the current PPh 21 rules, PTKP amounts and tax brackets (DJP, the tax law), and typical salaries and deductions in Indonesia. Prefer official and primary sources and note each source and its date.
   - If you cannot search, use your own knowledge and say it is an estimate as of your knowledge date.
   - Start from the nearest Quick Start (`qs`) for the user's place and case, and keep its figures unless you have a better one for this user. Send only what differs from it.
   - Prefer what the user said earlier in the conversation over general figures. Never invent a figure the user gave differently.
4. **Build the link with the script** (it checks every key, range and choice, and encodes the link exactly):
   ```bash
   python3 scripts/build_link.py --fields pisahvsgabung --find <words>     # look up keys
   python3 scripts/build_link.py --quickstarts pisahvsgabung --find <words> # look up Quick Starts
   python3 scripts/build_link.py spec.json                                   # build the link
   ```
   `spec.json` holds `page`, `qs`, `set` (key: value, in the units the field shows on screen, numbers written plainly: `800000`, `6.5`, never `800,000` or `6,5`), `why` (key: your reason, 200 characters at most, shown to the user beside the value; a list key or `json` can have one too), `note` (one line, such as the place and date). If it prints NOT BUILT, fix what it lists and run it again. Use the link it prints exactly as printed.
   The script checks every form field: its key, range, step and choices. List keys and `json` are checked by the tool when the link opens, so write them exactly in the syntax the reference gives (its COMPACT LISTS and JSON sections), with the names it lists. A Quick Start sets only what its line in the reference lists; when a list key (a set of tickers, portfolios or offers) replaces what the Quick Start holds, send every setting you want with it.
   If you cannot run code, build the link by hand from the LINK FORMAT in the reference, using only keys and values listed there, and check each value against its range.
5. **Reply in the format below, and stop.**

## Reply format

Your whole reply has these four parts, in this order, written in the user's language (keys and the link stay as they are):

1. **Your inputs**: a short list of what the user stated, each with the value that goes in the link.
2. **Assumptions**: a numbered list (or a table: Input | Value | Source or rationale), one entry per input you chose, each with its value and its source with the date for anything you looked up, or "estimate" and your reason for anything from your own knowledge. Put the same reason, shortened, in that key's `why`.
3. **The link**, as a clickable Markdown link to tool.adjiebrotots.com/pisahvsgabung/..., and again inside a code block so the user can copy it if their chat app breaks a long link.
4. The sentence: **Open the link to see the result.** You may add one line inviting the user to correct any assumption, and then you will send a new link.

**Do not state results.** No verdict, figure, estimate, range, "roughly", "likely", or preview of what the tool will show, not even if the user asks. The only numbers in your reply are the inputs in the link. If the user asks what the answer is, explain that the tool works it out from these inputs and the link opens it, and offer to change any input.

If the request is outside what this tool does, say so, give the tool's address and help the user as you normally would.

## Link format (summary)

```
https://tool.adjiebrotots.com/pisahvsgabung/#load&v=1&qs=<quick start>&<key>=<value>&why.<key>=<reason>&note=<one line>
```
- `#load` then `key=value` pairs joined by `&`, each value percent-encoded. `v=1` always.
- Values in the units the field shows: `6.1` for 6.1 %, `800000` for 800,000. A choice takes its listed value.
- The tool starts from the Quick Start (or its defaults) and applies each key. Keys not named keep their base value.
- Out of range numbers are pulled into range and unknown keys are skipped, and the tool tells the user. The script stops you before either happens.
- Never use the keys `s`, `open` or `embed`.

## Worked example

**User:** pakai tool.adjiebrotots.com/pisahvsgabung, suami gaji Rp 25 juta sebulan, istri Rp 18 juta, punya 2 anak: lebih hemat pisah harta atau gabung?

**Spec** (`pisahvsgabung`):

```json
{
  "page": "pisahvsgabung",
  "set": {
    "dependents": "2",
    "husbandSalaryInput": "300000000",
    "wifeSalaryInput": "216000000"
  },
  "why": {
    "dependents": "Dua anak, sesuai yang disebutkan",
    "husbandSalaryInput": "Gaji suami Rp 25 juta sebulan dikali 12 bulan",
    "wifeSalaryInput": "Gaji istri Rp 18 juta sebulan dikali 12 bulan"
  },
  "qs": "double",
  "note": "Dua penghasilan, 2 anak, Oktober 2026"
}
```

**Reply:**

**Assumptions**

1. Rumah tangga: dua penghasilan, jadi tautan dimulai dari Quick Start Double income family (qs=double), yang mengisi gaji suami dan gaji istri sendiri-sendiri, dengan PTKP dan lapisan tarif sesuai ketentuan.
2. Gaji setahun: suami Rp 300,000,000 (Rp 25 juta dikali 12) dan istri Rp 216,000,000 (Rp 18 juta dikali 12), karena alat ini memakai gaji kotor setahun. THR, gaji ke-13, dan bonus tidak disebutkan, jadi tidak ditambahkan.
3. Tanggungan: 2 anak, sesuai yang disebutkan.
4. Pengurang seperti iuran pensiun tidak disebutkan, jadi tetap Rp 0 untuk suami dan Rp 0 untuk istri. Biaya jabatan tetap dihitung otomatis.

[Open Pisah vs Gabung Harta on this scenario](https://tool.adjiebrotots.com/pisahvsgabung/#load&v=1&qs=double&dependents=2&why.dependents=Dua%20anak,%20sesuai%20yang%20disebutkan&husbandSalaryInput=300000000&why.husbandSalaryInput=Gaji%20suami%20Rp%2025%20juta%20sebulan%20dikali%2012%20bulan&wifeSalaryInput=216000000&why.wifeSalaryInput=Gaji%20istri%20Rp%2018%20juta%20sebulan%20dikali%2012%20bulan&note=Dua%20penghasilan,%202%20anak,%20Oktober%202026)

```
https://tool.adjiebrotots.com/pisahvsgabung/#load&v=1&qs=double&dependents=2&why.dependents=Dua%20anak,%20sesuai%20yang%20disebutkan&husbandSalaryInput=300000000&why.husbandSalaryInput=Gaji%20suami%20Rp%2025%20juta%20sebulan%20dikali%2012%20bulan&wifeSalaryInput=216000000&why.wifeSalaryInput=Gaji%20istri%20Rp%2018%20juta%20sebulan%20dikali%2012%20bulan&note=Dua%20penghasilan,%202%20anak,%20Oktober%202026
```

Open the link to see the result.

## Files

- `references/pisahvsgabung.md`: PPh 21: Pisah Harta vs Gabung Harta. Every key with its label, unit, range and default, the Quick Starts and what each sets, list and json syntaxes, and an example.
- `references/pisahvsgabung-id.md`: PPh 21: Pisah Harta vs Gabung Harta (Indonesian page). Every key with its label, unit, range and default, the Quick Starts and what each sets, list and json syntaxes, and an example.
- `references/params.json`: the same keys as data (what the script checks against).
- `scripts/build_link.py`: builds and checks the link. `python3 scripts/build_link.py --help` explains it.

Source: https://tool.adjiebrotots.com/pisahvsgabung/ai/ (this skill, kept up to date with the tool).
