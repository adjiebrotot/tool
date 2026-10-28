# Pisah vs Gabung: notes for the AI section

Hand-written. `node _ref/agent-doc.mjs` merges these notes with the fields it reads from the
page and writes `pisahvsgabung/agent.txt` and `id/agent.txt`, the AI section in `index.html`
and `id/index.html`, and the lines in `llms.txt`. Edit here, never the generated text, then run
the generator. Text above the first heading (this) is not published. The English and the
Indonesian page share these notes, so Indonesian words sit beside the English ones.

The page supplies each field's label, unit, range, default, options and tip, so these notes
add only what the page cannot say. Headings, as for every tool: Decides, Most important,
Fields, Hide, Quick Starts, Example, Compact lists, Json. See `rentvsownhouse/agent-notes.md`.

## Decides

Whether a married couple in Indonesia pays less PPh 21 income tax with Gabung Harta (the husband's tax return uses PTKP K, and the wife's employer withholds final tax on her salary with her own PTKP) or with Pisah Harta (PH or MT: the tax is worked out on their combined net income and shared by each spouse's net income), from each spouse's yearly gross salary, deductions and dependants, and the household salary at which the cheaper way changes. Requests often come in Indonesian: write the assumptions in the language the user wrote in.

## Most important

- inputMode
- husbandSalaryInput
- wifeSalaryInput
- totalSalaryInput
- splitPct
- dependents
- husbandDeductionInput
- wifeDeductionInput
- deductionInput

## Fields

- dependents: Dependants (tanggungan) the household supports, usually children, 0 to 3; more than three count as three. Each one adds to the PTKP.
- husbandSalaryInput: The husband's gross salary (gaji kotor suami) for a year, in rupiah, before any tax. A monthly salary (gaji sebulan) times 12, plus THR, a 13th month and bonus when the user gives them. Counts when income is entered Each spouse (inputMode=individual); send it with wifeSalaryInput.
- wifeSalaryInput: The wife's gross salary (gaji kotor istri) for a year, in rupiah, worked out the same way. 0 for a wife with no salary. Counts when income is entered Each spouse.
- totalSalaryInput: Both spouses' gross salaries together for a year, in rupiah. Counts when income is entered as Total and split (inputMode=total), with splitPct. Use it only when the user gives a household total and not each salary.
- splitPct: The wife's share of totalSalaryInput, in % as a whole number: 0 means the husband earns it all, 50 an equal split. Counts only in Total and split.
- deductionInput: Deductions (pengurang) for both spouses together, in rupiah a year, taken off gross income before PTKP and shared by what each earns. Mainly the pension contributions an employee pays (iuran pensiun, and the employee's own JHT and JP of BPJS Ketenagakerjaan), never the employer's share. Biaya jabatan is separate (biayaJabatan). Leave at 0 unless the user gives them or says they pay these, and say so when you assume any. Counts only in Total and split.
- husbandDeductionInput: The husband's own deductions (pengurang), as for deductionInput. Counts only in Each spouse.
- wifeDeductionInput: The wife's own deductions (pengurang), as for deductionInput. Counts only in Each spouse.
- biayaJabatan: Biaya jabatan, the allowance for the cost of holding a job: 5% of each spouse's gross salary, at most Rp 6,000,000 a year, taken off before PTKP. Keep it true. Send false only when the deductions the user gives already include biaya jabatan.
- ptkpBase: PTKP (penghasilan tidak kena pajak, the tax-free allowance) for one taxpayer with no dependants, TK/0, in rupiah a year. The tool opens on the statutory amount, Rp 54,000,000. Leave it out unless the user names a different amount.
- ptkpMarried: Added to the husband's PTKP for being married (K), in rupiah a year. Statutory Rp 4,500,000. Leave it out unless the user names a different amount.
- ptkpSpouse: Added when the wife's income is combined with her husband's (I), in rupiah a year. Statutory Rp 54,000,000. Leave it out unless the user names a different amount.
- ptkpDependent: Added for each dependant, in rupiah a year. Statutory Rp 4,500,000. Leave it out unless the user names a different amount.

## Hide

## Quick Starts

Three households, each with the statutory PTKP and tax brackets. Start from the closest one and send the user's own figures. Use double when both spouses earn a salary (it is entered for each spouse), single when only one earns (a household total, with the wife's share 0), and even for a household total shared by a percentage (even is the page's own start). A Quick Start sets its own way of entering income; a link that names the salary fields of the other way switches to it.

## Example

Request: pakai tool.adjiebrotots.com/pisahvsgabung, suami gaji Rp 25 juta sebulan, istri Rp 18 juta, punya 2 anak: lebih hemat pisah harta atau gabung?

Link:
- qs=double
- dependents=2
- why.dependents=Dua anak, sesuai yang disebutkan
- husbandSalaryInput=300000000
- why.husbandSalaryInput=Gaji suami Rp 25 juta sebulan dikali 12 bulan
- wifeSalaryInput=216000000
- why.wifeSalaryInput=Gaji istri Rp 18 juta sebulan dikali 12 bulan
- note=Dua penghasilan, 2 anak, Oktober 2026

Assumptions:
1. Rumah tangga: dua penghasilan, jadi tautan dimulai dari Quick Start Double income family (qs=double), yang mengisi gaji suami dan gaji istri sendiri-sendiri, dengan PTKP dan lapisan tarif sesuai ketentuan.
2. Gaji setahun: suami Rp {husbandSalaryInput} (Rp 25 juta dikali 12) dan istri Rp {wifeSalaryInput} (Rp 18 juta dikali 12), karena alat ini memakai gaji kotor setahun. THR, gaji ke-13, dan bonus tidak disebutkan, jadi tidak ditambahkan.
3. Tanggungan: {dependents} anak, sesuai yang disebutkan.
4. Pengurang seperti iuran pensiun tidak disebutkan, jadi tetap Rp {husbandDeductionInput} untuk suami dan Rp {wifeDeductionInput} untuk istri. Biaya jabatan tetap dihitung otomatis.

## Compact lists

- `inputMode=total|individual`
- `brackets=<upTo>:<rate>,<upTo>:<rate>,...,:<rate>`

Items are separated by `,` and their parts by `:`, both typed as they are. Numbers are plain (60000000, 12.5), with no thousands separators.

inputMode: the way income is entered. `total` is Total and split (totalSalaryInput and splitPct, also written "Total dan porsi"); `individual` is Each spouse (husbandSalaryInput and wifeSalaryInput, also "Per pasangan"). A link that names a salary or deduction field of one way switches to that way by itself, so inputMode is only needed to say it outright. The fields of the other way do not count and are listed as not applied. When the way changes, the figures the link does not set are carried over from the other way, as the page's own buttons do. For example:
`inputMode=individual`

brackets: the PPh 21 tax brackets (lapisan tarif), each bracket's upper limit in rupiah a year and its rate in %, from the lowest. The last bracket has no upper limit: write it `:<rate>` (a limit given there is ignored). Limits must rise, at most 5 brackets, rates 0 to 100 in steps of 0.01. It replaces the whole ladder. The tool opens on the statutory ladder (UU HPP, 2022), which is
`brackets=60000000:5,250000000:15,500000000:25,5000000000:30,:35`
The brackets are set by law: leave brackets out unless the user gives different ones, for example to try a proposed change. Never guess them. A ladder of three brackets, 5% up to Rp 60,000,000, 15% up to Rp 250,000,000 and 35% above:
`brackets=60000000:5,250000000:15,:35`

## Json
