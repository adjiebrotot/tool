# Jurisdiction pages: the writers' brief

Each country has one page per language under `global-income-tax-calculator/<slug>/` (English)
and `<slug>/id/` (Indonesian), written by `node _ref/jurisdiction-pages.mjs` from:

- `scenarios.mjs`: the worked examples' inputs (one key per example, kept for good).
- `../engine.js`: every amount in an example's table. Writers never type the table.
- `content/<slug>.<lang>.json`: the prose, written per language from this brief.

`node global-income-tax-calculator/_jurisdictions/dump.mjs <slug>` prints each example's
engine result (every line, the take-home, the share of gross and the marginal rate).

## Who the pages are for

- **English page:** an expat or skilled migrant thinking about moving to the country,
  searching "how to calculate income tax in <country>", "<country> tax for <visa or status>",
  "take-home pay on <amount> in <city>". Plain international English (no idioms that only
  work in one country), British spelling to match the site.
- **Indonesian page:** an Indonesian who wants to work there (the #KaburAjaDulu crowd:
  working holiday, skilled visas, nurses, Specified Skilled Workers, students who work,
  professionals with an offer), searching "cara menghitung pajak di <negara>", "gaji bersih
  di <negara>", "pajak <status> <negara>". For Indonesia itself: Indonesians and expats
  working in Indonesia ("cara menghitung PPh 21"). Written natively, never translated from
  the English page. Same facts and numbers; examples' framing and stress may differ.

These are **search landing pages, not blog posts**: answer first, scannable, factual, short
paragraphs. No personal anecdotes, no first-person stories, no opinion columns. Address the
reader directly where it helps ("you", "kamu"). No em-dashes (—) anywhere.

## Accuracy rules (most important)

1. **The law section comes from the engine and its sources.** Read the country's function in
   `../engine.js` (its brackets, rates, caps, allowances, comments) and the `SRC` entries it
   cites. State only rules you can see there or that are standard, well-known and stable
   facts you are sure of (for example "Australia taxes residents on worldwide income").
   If a rate or threshold is not in the engine and you are not certain, leave it out.
2. **Numbers in the example prose must match the engine output** given in the dump: copy
   them (rounded as the page rounds, to whole units). Prefer explaining *why* the result is
   what it is (which rule bites) over repeating the table.
3. **Strategies must be legal, mainstream and proven**, the kind a government page or a
   Big Four guide describes (Australia: salary sacrifice into super for permanent residents,
   with the warning that temporary residents get super back only through DASP, taxed at
   35% (65% for working holiday makers) when they leave; UK: pension salary sacrifice,
   the £100,000 allowance taper; US: 401(k) and HSA; Canada: RRSP; Singapore: SRS, CPF
   top-ups; Japan: iDeCo, furusato nozei; Germany: Riester, Altersvorsorge via employer;
   Switzerland: pillar 3a; Netherlands: 30% ruling conditions; Indonesia: zakat through an
   official body, DPLK pension). Give a contribution cap or limit only if you are sure of the
   current figure; otherwise describe it without the number. No aggressive schemes, no
   offshore tricks, nothing that only works for the wealthy unless clearly labelled.
4. **What the calculator does not model** comes from the engine's notes, `info` lines, the
   tool's limits (employment income only, one full year in one job, no bonuses or equity, no
   tax treaties, one city where rules are local) and anything the country function ignores.
5. **Sources:** official authorities first. Use the URLs in engine.js `SRC` for that country,
   plus other official pages you are sure exist (a ministry home page is safer than a deep
   link you are not sure of). Never invent a deep URL. 3 to 6 sources.
6. If a fact you want would be stale, wrong or a guess, leave it out. Shorter and right beats
   longer and wrong.

## Titles and search (SEO and GEO)

- `title` (under 60 characters): the search phrase first, the year, the promise.
  e.g. "Australian Income Tax 2026-27: How to Calculate It" / "Cara Menghitung Pajak
  Penghasilan di Australia 2026-27".
- `h1`: a question or phrase people type, e.g. "How to calculate income tax in Australia
  (2026-27)" / "Cara menghitung pajak penghasilan di Australia (2026-27)".
- `description` (120 to 155 characters): the direct answer plus what the page shows.
- `lede`: two or three sentences that answer the question on their own (AI answers quote
  this): the tax system in one line, the key rates, one concrete figure from an example.
- **Example titles** are the searches each example answers, one per distinct status or
  case: "How to calculate Australian income tax as a working holiday maker",
  "How much tax does a temporary resident pay in Australia on A$100,000?". Vary the
  wording naturally (how to calculate / how much tax / take-home pay on X); each title must
  describe its own, different calculation. Never stuff keywords, never repeat the same
  title pattern with only one word swapped across all examples, no ALL CAPS, no
  "best"/"ultimate". Indonesian titles the same way ("Cara menghitung pajak *working
  holiday maker* di Australia", "Berapa gaji bersih perawat di Jerman dengan gaji
  €42.000?").
- FAQ questions are real searches ("Do I pay tax on super if I leave Australia?").

## The content file (`content/<slug>.<lang>.json`)

Strings may hold simple inline HTML: `<p>`, `<strong>`, `<em>`, `<a href>`, `<ul><li>`,
`<abbr>` not needed (abbreviations are handled by the site). Links to other pages of this
site are absolute (`https://tool.adjiebrotots.com/...`), external links absolute too.

```json
{
  "slug": "australia",
  "lang": "en",
  "title": "...",
  "h1": "...",
  "description": "...",
  "lede": "<p>...</p>",
  "place": "(Indonesian only) the place the rules are for, in Indonesian, e.g. 'Kanton Zürich'. Omit when the country has no place.",
  "law": {
    "intro": "<p>...</p>",
    "blocks": [
      { "h3": "Tax rates for residents", "html": "<p>...</p>",
        "table": { "head": ["Taxable income", "Rate"], "rows": [["A$0 to A$18,200", "0%"], ["..."]] } },
      { "h3": "Medicare levy", "html": "<p>...</p>" }
    ],
    "sources": [ { "name": "Australian Taxation Office, tax rates for residents", "url": "https://www.ato.gov.au/", "note": "optional few words" } ]
  },
  "examples": [
    { "key": "resident", "title": "How to calculate income tax as an Australian resident on A$100,000",
      "intro": "<p>Who this is, what applies, the steps in words.</p>",
      "after": "<p>Optional: what changes the answer, one or two sentences.</p>" }
  ],
  "strategyIntro": "<p>optional one sentence</p>",
  "strategies": [ { "h3": "...", "html": "<p>...</p>" } ],
  "limits": [ "<strong>Short lead.</strong> One sentence." ],
  "faq": [ { "q": "...", "a": "<p>...</p>" } ],
  "lineLabels": { "(Indonesian only) the engine's English line label": "its Indonesian label" },
  "bmc": "optional: one short fun line for the coffee button, under 90 characters"
}
```

- `examples`: exactly one entry per key in `scenarios.mjs` for the country, in that order.
  The page adds the table (gross, every line, take-home) and an "open in the calculator"
  link under each, so the intro explains and does not list the lines again in full.
- `law.blocks`: 2 to 5 blocks. A rate table wherever the country has brackets. Write
  amounts as the page's language writes them (A$18,200 in English, A$18.200 in Indonesian,
  with the decimal comma: 2,5%).
- `strategies`: 3 to 5, each with who it suits and a caveat.
- `limits`: 4 to 7.
- `faq`: 5 to 8. Link related pages where they really help:
  - The calculator: https://tool.adjiebrotots.com/global-income-tax-calculator/
  - Cost of Living Comparator (what a salary buys in another city): https://tool.adjiebrotots.com/costofliving-comparator/
  - Financial Freedom Calculator: https://tool.adjiebrotots.com/financialfreedom/
  - Indonesia only: Pisah vs Gabung (married couples' PPh 21): https://tool.adjiebrotots.com/pisahvsgabung/ (Indonesian: /pisahvsgabung/id/)
  - Australia only: Borrowing Capacity: https://tool.adjiebrotots.com/borrowingcapacity/
  - Indonesian blog posts (Indonesian pages, where relevant): #KaburAjaDulu, where the
    month-end savings are bigger (Perth, Singapore, Jakarta):
    https://blog.adjiebrotots.com/id/kabur-aja-dulu/ ; husband and wife tax, file jointly or
    separately: https://blog.adjiebrotots.com/id/pajak-suami-istri-gabung-atau-pisah/ ;
    retiring without being a civil servant: https://blog.adjiebrotots.com/id/pensiun-tanpa-jadi-pns/
  - Other country pages: https://tool.adjiebrotots.com/global-income-tax-calculator/<slug>/
    (Indonesian: .../<slug>/id/). Slugs: australia, singapore, united-kingdom, germany,
    united-states, canada, france, netherlands, belgium, switzerland, italy, spain, portugal,
    norway, sweden, finland, estonia, japan, south-korea, china, taiwan, hong-kong,
    indonesia, malaysia, thailand, united-arab-emirates, saudi-arabia, qatar, bahrain,
    kuwait, oman.
- `lineLabels` (Indonesian only): every distinct `label` the dump prints for the country,
  mapped to a short Indonesian label (keep official names such as *Medicare levy*, CPF,
  PAYE, IRPF as they are, italic not needed).

Country names follow the tool: "Taiwan (China)" and "Hong Kong (China)" in English,
"Taiwan (Tiongkok)" and "Hong Kong (Tiongkok)" in Indonesian, "Tiongkok" for China in
Indonesian, "Inggris" for the United Kingdom in Indonesian.

## Indonesian

Load and follow the blog's `bahasa-indonesia` skill (`/home/user/blog/.claude/skills/
bahasa-indonesia/SKILL.md`, its `references/corrections.md` and
`references/word-preferences.md`): written Jakarta Indonesian, *kamu* (never *Anda*), foreign
terms in italics with a short gloss the first time, no calques, sentences that link. The
register here is a clear explainer, not an opinion column, and there is no *saya* narrator.
Use "gaji bersih (*take-home pay*)" the first time, then "gaji bersih". Check with:

```
node global-income-tax-calculator/_jurisdictions/prose.mjs <slug> id > <scratch dir>/x.md
python3 /home/user/blog/.claude/skills/bahasa-indonesia/scripts/cek.py <scratch dir>/x.md
```

and fix every ERROR (REVIEW items: fix unless defensible).

## Done means

- `node _ref/jurisdiction-pages.mjs` runs with no problem lines for your files.
- No em-dash; title and description within length; every example key covered.
- Numbers in prose match the dump.
