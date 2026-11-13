# Global Income Tax Calculator: audit

Two harnesses, both run from the repository root.

| Run | What it holds |
| --- | --- |
| `node global-income-tax-calculator/_audit/run.mjs` | The engine (`engine.js`) against the spec. Replays all 422 golden cases (`golden-v11.json`, written by `gsc_reference_model.py`, spec v11) to ±1 unit of local currency: income tax, employee contributions and net. Then the Layer A anchors (spec §5.1), the line items adding up to the totals with a known source and status, the taxable income the breakdown builds from gross pay (the lines marked `base`) landing on the engine's own, 50 net-to-gross round trips for each of 33 presets, the caps of Layer D and the guards. |
| `node global-income-tax-calculator/_audit/page.mjs` | The page. Types 47 golden cases into the real form (country, every field, a monthly amount) and reads the figures the page shows, then net to gross, the display currency and per-month views, a period switch that must not move the answer, three jobs kept over a reload, the eleven states not loaded left out of the state list, and a job saved with one of them showing its reason instead of a figure. Needs Chart.js cached in `_ref/.libcache/` (run `node _ref/chart-check.mjs` once). |

The Indonesian page (`id/`, baked from `index.html` by `_ref/bake-id.mjs`) has two more:

| Run | What it holds |
| --- | --- |
| `node global-income-tax-calculator/_audit/labels-id.mjs` | Every text the engine writes (line labels, bracket adjustments, notes, reasons, the tax year and place), collected by running each country through every option of the form alone and in pairs at 80 pay levels and net to gross (`engine-strings.mjs`), has its Indonesian in `labels-id.js`, keeps every figure of the English, and `labels-id.js` matches the content files' `lineLabels` it is made from (`_jurisdictions/labels.mjs`). A new engine label fails here until its Indonesian is in that country's `content/<slug>.id.json`. |
| `node global-income-tax-calculator/_audit/lang-parity.mjs` | The two pages are one tool: every Quick Start gives the same jobs, figures and chart on both; work saved on one opens unchanged on the other, both ways (numbers such as 123,456.78 included); a Share link and an AI `#load` link open the same on both, including a select named by its English words on `id/`. Needs Chart.js cached like `page.mjs`. |

Regenerate the golden file with `python3 gsc_reference_model.py` in this folder; it writes
`golden.json`. Rename it over `golden-v11.json` only when the spec moves to a new version.

## What this tool adds to spec v11

Each is checked by `run.mjs` against its own source, not against the v11 golden file:

- **Belgium, expat regime and ONSS**: 35% of gross is free of income tax with no cap (Law of
  18 December 2025, from income 2025), but social security did not follow: only 30%, at most
  90,000 a year, is free of ONSS (Deloitte Belgium, 23 Dec 2025). The two golden expat cases
  above 70,000 are replayed with that split.
- **Taiwan, employment insurance**: a new field, twEi (default yes, the v11 behaviour). Foreign
  employees not married to a national and without permanent residence are outside employment
  insurance and pay labour insurance alone, 11.5% x 20% (BLI; MOL).
- **Taiwan, national health insurance cap**: NT$313,000 a month (v11: 219,500). The NHIA
  premium table says "自114年1月1日起，投保金額最高一級調整為313,000元" (from 1 Jan 2025 the top
  insured amount is NT$313,000). The four golden cases at NT$6,000,000 are replayed with it.
- **UAE, GPSSA employer share**: the employer owes 15%; only under AED 20,000 a month does the
  government pay 2.5 points of it (GPSSA, main features of Federal Decree-Law 57 of 2023). The
  amount was already 15% on top; the line now says who pays it at each level of pay.
- **Illinois is loaded** (v11 gated it). 4.95% on wages less an exemption of 2,925 a person
  (5,850 joint), with no exemption at all above federal AGI 250,000 (500,000 joint). Official:
  Illinois Department of Revenue, Q&A 851 ("For tax year beginning January 1, 2026, it is $2,925
  per exemption"; "not allowed if a taxpayer's federal adjusted gross income (AGI) exceeds
  $500,000 ... or $250,000 for all other returns") and the Illinois Comptroller's Payroll
  Bulletin 1-26 (rate remains 4.95%). The golden case `IL_S_gated` is replayed as 12,585.21 tax.
- **France above RFR 250,000** (v11 returned NOT_SUPPORTED). The CEHR is added: 3% of RFR from
  250,000 to 500,000 and 4% above for a single person; 3% from 500,000 to 1,000,000 and 4% above
  for a couple. Official: service-public.gouv.fr F31130 (checked 15 April 2026, citing loi
  n° 2026-103), whose worked example (RFR 400,000 single, 4,500) is an anchor. The CDHR (a 20%
  floor on the average rate, which the same page says applies to 2025 and 2026 income) is
  tested with its plain formula; its reductions only lower it, so a case under the floor pays
  none, and a case over it stays NOT_SUPPORTED. No salaried case reached it in testing.
- **Ontario Tax Reduction, "2 x" shape** (v11: assumption badge). EY's Ontario Budget 2026
  summary (30 March 2026) says income up to taxable 18,930 pays no Ontario tax and the reduction
  is clawed back up to 24,870. With the basic personal amount alone, the "2 x" formula gives both
  figures exactly; the one-times formula would put the first at 15,959. Now secondary.
- **Idaho**: the 5.3% rate holds for 2026 (HB 40 of 2025; no sign the 2026 bill H 589 passed).
  The zero-bracket amount is still the 2025 figure, and the page says so.
- **Spain, 4 or more children**: the minimums for the 4th child onward (4,500 state, 4,950
  Madrid) from the spec's table, which the v11 model capped at 3 children.
- **Italy, impatriate**: the excluded income is capped at 600,000, as the spec states.
- **Australia, no work deduction** (v11 took a flat A$1,000 off a resident's salary). Work-related
  expenses are claimed on the return at tax time and differ a lot between people, so they no
  longer lower the take-home pay shown. The six resident golden cases (`AU|pr|*`, `AU|temp|*`)
  are replayed on the full salary: resident rates, LITO and, for `pr`, the 2% Medicare levy.
- **Tax by bracket.** Each tax line worked out on marginal brackets carries them
  (`line.brackets`), and the breakdown table lists them under the line. `run.mjs` checks that
  the brackets run from 0 to the base without a gap and that they, the credits and surcharges
  listed with them, and the rounding left over make the line.

## Still open

Unchanged from spec v11 §7, and shown on the page as "not loaded" or with a badge: Alabama,
Connecticut, Maine, Minnesota, New Mexico, Ohio, Oregon, Rhode Island, South Carolina, Utah and
Wisconsin (Ohio and Utah were looked at: secondary sources disagree on the 2026 exemption tiers
and the taxpayer-credit base, so they stay gated); Swiss cantons other than Zurich; Spanish
regions other than Madrid; Italian regions other than Lombardy; two-earner households in
Belgium and Switzerland; the Zurich single 120,000 deviation; the Italian impatriate credit
base; Malaysian LINDUNG relief for expats; Arkansas's low-income tables; Vermont's and DC's
2026 amounts.
