// The "Use in AI" pieces of each tool, written by _ref/agent-doc.mjs from the same model it
// reads off the pages (fields, Quick Starts, notes). Nothing here is hand-edited output.
//
// Per tool (TOOLS below), under <tool>/ai/:
//   index.html                 the page people see: download the skill, how to install it in
//                              Claude, ChatGPT, Grok, Gemini and Copilot (animated), a worked conversation, ads
//   <skill>.zip                the skill: one folder <skill>/ holding everything under skill/
//   skill/SKILL.md             what the assistant reads first (YAML name + description)
//   skill/references/<p>.md    one per page of the tool: every key, range, default, Quick
//                              Start and example (the text agent.txt used to carry)
//   skill/references/params.json  the same keys as data, read by the script
//   skill/scripts/build_link.py   builds and checks the #load link (source: _ref/ai-skill/)
// The unzipped skill/ folder is published too, so an assistant that browses can read it.
//
// A tool with an Indonesian page (a PAGES entry with lang: 'id', in _ref/agent-lib.mjs) also
// gets <tool>/ai/id/index.html: the same page and the same skill download, every word for
// people in Indonesian (WORDS.id), its links to the Indonesian tool page, guide (when
// <tool>/guides/id/ exists) and the Indonesian hub /ai/id/. Its worked conversation is the
// notes' "## AI page example (id)" (the English one when a tool has none). The English and
// Indonesian pages name each other with hreflang and carry an EN/ID toggle. The hub has the
// same pair: /ai/id/ lists every tool, a tool with no Indonesian page in English, marked EN.
// The skill itself (SKILL.md, the references) stays in English: its reader is the assistant.
//
// The zip is written byte for byte the same on every run (fixed dates, fixed order), so
// node _ref/agent-doc.mjs --check can compare it like any other file.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { ROOT, SITE, AI_RULES, WHY_MAX, buildLink } from './agent-lib.mjs';

/* ── The tools ───────────────────────────────────────────────────────────────
   tool    folder (the AI page is /<tool>/ai/)
   main    the page whose title, glyph and example the AI page shows
   name    the tool's name for people
   nameId  its name on the Indonesian AI page, when the tool has an Indonesian page and a
           name of its own there (default: name); backId, a shorter one for its back button
   use     when an assistant should reach for the skill (the YAML description's trigger) */
export const TOOLS = [
  { tool: 'rentvsownhouse', research: 'mortgage and loan rates, rents and prices, tax, duty and fee schedules, inflation, salaries and fees for the user\'s place and date (central banks, tax offices, statistics agencies, lenders)', main: 'rentvsownhouse', name: 'Rent vs Own', nameId: 'Sewa vs Beli Rumah',
    use: 'buying a home versus renting (and investing the difference), whether a house or apartment is worth buying at a price against a rent, mortgage vs rent comparisons, or how sensitive that answer is to rates, growth and costs. Covers 33 cities with local Quick Starts; has an Indonesian version.' },
  { tool: 'pisahvsgabung', research: 'the current PPh 21 rules, PTKP amounts and tax brackets (DJP, the tax law), and typical salaries and deductions in Indonesia', main: 'pisahvsgabung', name: 'Pisah vs Gabung Harta',
    use: 'Indonesian married couples\' PPh 21 income tax: whether Pisah Harta (PH/MT) or Gabung Harta (joint) pays less, for given salaries, deductions and dependants. Requests often come in Indonesian.' },
  { tool: 'borrowingcapacity', research: 'current Australian lender rates and serviceability buffers (APRA, the lender), HEM living expenses, tax and HECS-HELP repayment thresholds (ATO)', main: 'borrowingcapacity', name: 'Borrowing Capacity',
    use: 'how much an Australian bank would lend for a home loan: borrowing power from income, expenses, dependants, debts, deposit, rate and term, and what limit (serviceability, DTI, LVR, deposit) holds it down.' },
  { tool: 'financingvscash', research: 'the loan offer\'s rate, fees and term (the dealer or lender), savings and deposit rates and inflation for the user\'s country (central bank, statistics agency)', main: 'financingvscash', name: 'Finance vs Cash',
    use: 'whether to pay cash or take finance (car loan, 0% offers, dealer finance, personal loan, buy now pay later) for a purchase while investing the cash, and which loan offer is best.' },
  { tool: 'financialfreedom', research: 'expected returns and inflation, safe withdrawal rates, pension and superannuation rules, life expectancy tables for the user\'s country', main: 'financialfreedom', name: 'Financial Freedom',
    use: 'early retirement and financial independence (FIRE): the earliest age someone can stop working, how long savings last, safe withdrawal, retirement savings plans with Monte Carlo odds.' },
  { tool: 'valuateeverything', research: 'comparable listings only as the user gives them or as you find them on real listing sites (name each one); never invent listings', main: 'valuateeverything', name: 'Valuate Everything',
    use: 'whether an asking price is fair: a used car, a house, a hotel night or any item, fitted against comparable listings (price against year, mileage, size and other features).' },
  { tool: 'costofliving-comparator', research: 'take-home pay after tax, rents, groceries and other costs in each city (statistics agencies, payroll calculators, cost of living surveys), and exchange rates', main: 'costofliving-comparator', name: 'Cost of Living Comparator',
    use: 'moving between cities: how far a salary goes elsewhere, the salary needed in another city to live and save the same, comparing cost of living across many cities or on a world map.' },
  { tool: 'global-income-tax-calculator', research: 'the job\'s pay as the user gave it, and anything the user did not say that the tool asks (residency status, state or province, family); the tool holds the 2026 tax and contribution rules itself, never type them in', main: 'global-income-tax-calculator', name: 'Global Income Tax Calculator', nameId: 'Kalkulator Gaji Bersih dan Pajak Penghasilan', backId: 'Kalkulator Gaji Bersih',
    use: 'take-home pay after income tax and social contributions for a job in one of 31 countries or any US state (gross to net, or the gross needed for a take-home amount), and comparing up to four job offers or cities side by side.' },
  { tool: 'dcasimulator', research: 'the exact ticker symbols (exchange suffixes such as .JK or .AX), fees and the date range the user means; prices load in the tool, never type them in', main: 'dcasimulator', name: 'DCA Scenario Explorer',
    use: 'backtesting regular investing (dollar cost averaging) into stocks, ETFs or crypto on past prices, comparing tickers, schedules and buying rules, and multi-ticker portfolios with rebalancing.' },
  { tool: 'loadflow-simulator', research: 'standards and grid codes (IEEE, IEC, EN 50160, the network operator\'s code), typical line, cable and transformer data, and the operating limits that apply', main: 'loadflow-simulator', name: 'Load Flow Simulator',
    use: 'power system load flow (power flow) studies: bus voltages, line loading and losses on a network such as the IEEE/WSCC 9-bus, a distribution feeder or an HVDC case, AC Newton-Raphson or DC.' },
  { tool: 'ed-uc-simulator', research: 'generator costs, fuel prices and technical limits (ramp rates, minimum up and down times), line ratings and market rules (the operator, IEA, typical plant data)', main: 'ed-uc-simulator', name: 'ED/UC Simulator',
    use: 'power system economic dispatch and unit commitment over hours: which generators run, storage and HVDC schedules, operating cost and nodal prices (LMP) with line congestion.' },
  { tool: 'capacity-expansion-planner', research: 'technology costs and lifetimes (NREL ATB, CSIRO GenCost, IEA, Lazard), carbon prices, demand forecasts and plant capacity factors for the user\'s region', main: 'capacity-expansion-planner', name: 'Capacity Expansion Planner',
    use: 'electricity generation capacity expansion planning: which plants, renewables and batteries to build and when to meet growing demand at least cost, with carbon prices, emissions and costs by year.' },
  { tool: 'powerfactory-scripter', research: 'the PowerFactory object and variable names, the study standard (IEC 60909, the grid code\'s fault ride-through curve), and the user\'s project and study case names as they gave them', main: 'powerfactory-scripter/builder', name: 'PowerFactory Scripter',
    extra: 'Never write the PowerFactory Python script yourself, not even part of it: the tool writes it from the link, and the user downloads it there.',
    use: 'writing DIgSILENT PowerFactory Python scripts: load flow, N-1 contingency, short circuit, RMS/EMT simulation, fault ride-through, critical clearing time, parameter sweeps and result export, built as a workflow the tool turns into one ready-to-run script.' },
  { tool: 'pscad-scripter', domain: 'Engineering', research: 'the PSCAD component definitions and parameter names (the tool\'s component reference), the grid code\'s fault ride-through curve or harmonic limits, and the user\'s case, component Names and output channel names as they gave them', main: 'pscad-scripter/builder', name: 'PSCAD Scripter',
    extra: 'Never write the PSCAD Python script yourself, not even part of it: the tool writes it from the link, and the user downloads it there.',
    use: 'writing PSCAD Python automation scripts (mhi.pscad, EMTDC): build and run a case, fault ride-through, critical clearing time, parameter sweeps over values, layers and substitution sets, harmonics and THD, snapshots and simulation sets, damping and control tuning, built as a workflow the tool turns into one ready-to-run script.' },
];

export const toolOf = page => page.split('/')[0];
export const skillName = T => 'brotools-' + T.tool;
// A page's reference file: rentvsownhouse/sensitivity/id -> rentvsownhouse-sensitivity-id.md
export const refName = page => page.replace(/\//g, '-') + '.md';
// lang 'id': the tool's Indonesian AI page.
export const aiUrl = (T, lang = 'en') => SITE + '/' + T.tool + '/ai/' + (lang === 'id' ? 'id/' : '');
// The page an Indonesian AI page is about: the id twin of the tool's main page, else any id page (null: none).
export const idMainOf = (T, models) => models.find(M => M.P.page === T.main + '/id') || models.find(M => M.P.lang === 'id') || null;
const nameIn = (T, lang) => lang === 'id' ? T.nameId || T.name : T.name;

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// A heading never breaks inside "AI-mu" (a line ending "AI-" with "mu" below it).
const keep = h => h.replace(/AI-mu/g, '<span style="white-space:nowrap">AI-mu</span>');
const attr = s => esc(s).replace(/"/g, '&quot;');

/* ── params.json: the keys as data ────────────────────────────────────────── */
const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(+v)) ? null : +v;
function kindOf(f) {
  if (f.type === 'c') return 'checkbox';
  // A select the page fills while it runs (an output variable list) has no fixed choices to check.
  if (f.options && f.options.filter(o => o.value !== '').length < 2 && f.tag === 'select') return 'text';
  if (f.options) return 'choice';
  if (f.input === 'datetime-local') return 'datetime';
  if (f.input === 'range') return 'slider';
  if (f.money) return 'amount';
  if (f.input === 'number' || f.numeric) return 'number';
  if (f.input === 'date') return 'date';
  return 'text';
}
function fieldData(f, M) {
  const kind = kindOf(f);
  // An amount is in the page's currency (its symbol picker), so no symbol is named here.
  const unit = f.input === 'range' ? f.unit : f.money ? '' : [f.prefix, f.suffix].filter(Boolean).join(' ');
  const o = { key: f.key, label: f.label || f.key, group: f.group || '', kind };
  if (f.money) o.currency = true;
  if (unit) o.unit = unit;
  if (kind === 'choice') o.options = f.options.map(x => ({ value: x.value, label: x.label || x.value }));
  if (['number', 'amount', 'slider'].includes(kind)) {
    o.min = num(f.min); o.max = num(f.max);
    // A slider snaps to its step, and a whole-number box takes whole numbers: the script says so.
    const st = num(f.step);
    if (st && (kind === 'slider' || st >= 1)) o.step = st;
  }
  o.default = f.input === 'date' ? 'set from today' : f.type === 'c' ? !!f.value : (f.money ? (num(String(f.value).replace(/[$,_\s]/g, '')) ?? f.value) : f.value);
  // The field that sets its unit: a paired select, or a <key>Unit / <key>Period select beside it (edSpan, retireExpense).
  const by = [...(f.pairs || []), ...[f.key + 'Unit', f.key + 'Period'].filter(k => M.byKey[k] && M.byKey[k].options)].filter((k, i, a) => M.byKey[k] && !M.hide.has(k) && a.indexOf(k) === i);
  if (by.length && f.tag !== 'select') o.unitSetBy = by;
  if (M.important.includes(f.key)) o.important = true;
  return o;
}
function pageData(M) {
  const qs = [];
  if (M.qs) for (const g of M.qs.groups) {
    if (g.key) qs.push({ key: g.key, title: (g.title || g.key) + (g.alias ? ` (loads ${g.alias})` : '') });
    for (const it of g.items) qs.push({ key: it.key, title: (g.title ? g.title + ': ' : '') + it.title });
  }
  return {
    page: M.P.page, url: M.P.url, base: M.base, lang: M.P.lang, title: M.title,
    reference: 'references/' + refName(M.P.page),
    decides: M.notes.sections['decides'] || '',
    important: M.important,
    fields: [
      ...M.fields.filter(f => !M.hide.has(f.key)).map(f => fieldData(f, M)),
      // Compact keys that are plain numbers (PAGES.virtual): checked like a number box.
      ...(M.P.virtual || []).filter(v => !M.byKey[v.key]).map(v => ({ key: v.key, label: v.key, group: '', kind: 'number', min: num(v.min), max: num(v.max), default: v.value })),
    ],
    lists: M.compact.filter(k => !(M.P.virtual || []).some(v => v.key === k)),
    families: M.P.families || [], json: !!M.notes.sections['json'],
    run: /\brun=0\b/.test(JSON.stringify(M.notes.sections)),
    quickStarts: qs,
  };
}

/* ── SKILL.md ─────────────────────────────────────────────────────────────── */
function skillMd(T, models) {
  const main = models.find(M => M.P.page === T.main) || models[0];
  const name = skillName(T);
  const desc = `Opens Adjie Brotools' ${T.name} (${SITE}/${T.tool}/) on the user's own scenario with one link, and the tool computes the answer. Use when the user asks about ${T.use} Also use when they mention tool.adjiebrotots.com/${T.tool}.`;
  if (desc.length > 1024) throw new Error(name + ': description over 1024 characters');
  const L = [];
  // The description is one double-quoted YAML string (a JSON string is one): left bare, its
  // colons ("planning: which plants") make strict parsers such as Copilot's reject the skill.
  L.push('---', `name: ${name}`, `description: ${JSON.stringify(desc.replace(/\s+/g, ' '))}`, '---', '');
  L.push(`# ${T.name} on tool.adjiebrotots.com`, '');
  L.push(`${T.name} is a free calculator that runs in the user's browser. This skill turns the user's question into **one link** that opens the tool on their scenario. The tool, not you, works out the result: its figures come from its own model and data, and anything you work out separately can differ from what the user then sees.`, '');
  L.push('## What it decides', '');
  for (const M of models.filter(M => M.P.lang === 'en')) L.push(`- **${M.title}** (\`${M.P.page}\`): ${M.notes.sections['decides']}`);
  L.push('');
  const ids = models.filter(M => M.P.lang !== 'en');
  if (ids.length) {
    L.push('Indonesian versions take the same keys and Quick Starts. Use them when the user writes in Indonesian: ' +
      ids.map(M => `\`${M.P.page}\` (${M.base})`).join(', ') + '.', '');
  }
  L.push('## Workflow', '');
  L.push(
    '1. **Pick the page.** Read the user\'s request and choose the page above that answers it. Open its reference (`references/<page>.md`, listed under Files) and read the LINK FORMAT, the most important keys and the Quick Starts. The reference is long: read the parts you need.',
    '2. **Separate what the user said from what you must choose.** Every figure the user gave goes in as they gave it (convert units or periods only to match the field, and say so).',
    '3. **Fill every other input that matters with a researched assumption.**',
    `   - If you can search the web, do it for figures that change over time or by place. For this tool that usually means ${T.research}. Prefer official and primary sources and note each source and its date.`,
    '   - If you cannot search, use your own knowledge and say it is an estimate as of your knowledge date.',
    '   - Start from the nearest Quick Start (`qs`) for the user\'s place and case, and keep its figures unless you have a better one for this user. Send only what differs from it.',
    '   - Prefer what the user said earlier in the conversation over general figures. Never invent a figure the user gave differently.',
    '4. **Build the link with the script** (it checks every key, range and choice, and encodes the link exactly):',
    '   ```bash',
    `   python3 scripts/build_link.py --fields ${main.P.page} --find <words>     # look up keys`,
    `   python3 scripts/build_link.py --quickstarts ${main.P.page} --find <words> # look up Quick Starts`,
    '   python3 scripts/build_link.py spec.json                                   # build the link',
    '   ```',
    '   `spec.json` holds `page`, `qs`, `set` (key: value, in the units the field shows on screen, numbers written plainly: `800000`, `6.5`, never `800,000` or `6,5`), `why` (key: your reason, 200 characters at most, shown to the user beside the value; a list key or `json` can have one too), `note` (one line, such as the place and date)' +
      (models.some(M => M.notes.sections['json']) ? ', `json` (an object, for a page whose reference defines it)' : '') +
      (models.some(M => /\brun=0\b/.test(JSON.stringify(M.notes.sections))) ? ' and `run` (0 opens the page without solving, as the reference says)' : '') +
      '. If it prints NOT BUILT, fix what it lists and run it again. Use the link it prints exactly as printed.',
    '   The script checks every form field: its key, range, step and choices. List keys' + (models.some(M => (M.P.families || []).length) ? ', part settings (' + [...new Set(models.flatMap(M => M.P.families || []))].map(f => '`' + f + '...`').join(', ') + ')' : '') + ' and `json` are checked by the tool when the link opens, so write them exactly in the syntax the reference gives (its COMPACT LISTS' + (models.some(M => M.reference && M.reference.length) ? ', REFERENCE' : '') + ' and JSON sections), with the names it lists. A Quick Start sets only what its line in the reference lists; when a list key (a set of tickers, portfolios or offers) replaces what the Quick Start holds, send every setting you want with it.',
    '   If you cannot run code, build the link by hand from the LINK FORMAT in the reference, using only keys and values listed there, and check each value against its range.',
    '5. **Reply in the format below, and stop.**' + (T.extra ? ' ' + T.extra : ''),
    '',
  );
  L.push('## Reply format', '');
  L.push(
    'Your whole reply has these four parts, in this order, written in the user\'s language (keys and the link stay as they are):',
    '',
    '1. **Your inputs**: a short list of what the user stated, each with the value that goes in the link.',
    '2. **Assumptions**: a numbered list (or a table: Input | Value | Source or rationale), one entry per input you chose, each with its value and its source with the date for anything you looked up, or "estimate" and your reason for anything from your own knowledge. Put the same reason, shortened, in that key\'s `why`.',
    `3. **The link**, as a clickable Markdown link to tool.adjiebrotots.com/${T.tool}/..., and again inside a code block so the user can copy it if their chat app breaks a long link.`,
    '4. The sentence: **Open the link to see the result.** You may add one line inviting the user to correct any assumption, and then you will send a new link.',
    '',
    '**Do not state results.** No verdict, figure, estimate, range, "roughly", "likely", or preview of what the tool will show, not even if the user asks. The only numbers in your reply are the inputs in the link. If the user asks what the answer is, explain that the tool works it out from these inputs and the link opens it, and offer to change any input.',
    '',
    'If the request is outside what this tool does, say so, give the tool\'s address and help the user as you normally would.',
    '',
  );
  L.push('## Link format (summary)', '');
  L.push(
    '```',
    `${main.base}#load&v=1&qs=<quick start>&<key>=<value>&why.<key>=<reason>&note=<one line>`,
    '```',
    '- `#load` then `key=value` pairs joined by `&`, each value percent-encoded. `v=1` always.',
    '- Values in the units the field shows: `6.1` for 6.1 %, `800000` for 800,000. A choice takes its listed value.',
    '- The tool starts from the Quick Start (or its defaults) and applies each key. Keys not named keep their base value.',
    '- Out of range numbers are pulled into range and unknown keys are skipped, and the tool tells the user. The script stops you before either happens.',
    '- Never use the keys `s`, `open` or `embed`.',
    '',
  );
  // The worked example, from the main page's notes, in the reply's four parts.
  const ex = main.example;
  const link = canonicalLink(main.base, ex.pairs);
  const said = userInputs(main, ex);
  L.push('## Worked example', '', `**User:** ${ex.request}`, '', `**Spec** (\`${main.P.page}\`):`, '', '```json', JSON.stringify(specOf(main.P.page, ex.pairs), null, 2), '```', '', '**Reply:**', '');
  if (said.length) { L.push('**Your inputs**', ''); said.forEach(r => L.push(`- ${r.label}: ${r.value}`)); L.push(''); }
  L.push('**Assumptions**', '');
  ex.assumptions.forEach((a, i) => L.push(`${i + 1}. ${a}`));
  L.push('', `[Open ${T.name} on this scenario](${link})`, '', '```', link, '```', '', 'Open the link to see the result.', '');
  L.push('## Files', '');
  for (const M of models) L.push(`- \`references/${refName(M.P.page)}\`: ${M.title}${M.P.lang !== 'en' ? ' (Indonesian page)' : ''}. Every key with its label, unit, range and default, the Quick Starts and what each sets, list and json syntaxes, and an example.`);
  L.push('- `references/params.json`: the same keys as data (what the script checks against).',
    '- `scripts/build_link.py`: builds and checks the link. `python3 scripts/build_link.py --help` explains it.', '');
  L.push(`Source: ${aiUrl(T)} (this skill, kept up to date with the tool).`, '');
  return L.join('\n');
}
// Link pairs in the order build_link.py writes them: v, qs, each key then its why, json, run, note.
export function canonical(pairs) {
  const get = k => pairs.find(([x]) => x === k);
  const out = [['v', '1']];
  if (get('qs')) out.push(get('qs'));
  for (const p of pairs) {
    const [k] = p;
    if (['v', 'qs', 'json', 'run', 'note'].includes(k) || k.startsWith('why.')) continue;
    out.push(p);
    if (get('why.' + k)) out.push(get('why.' + k));
  }
  for (const k of ['json', 'run', 'note']) if (get(k)) out.push(get(k));
  return out;
}
export const canonicalLink = (base, pairs) => buildLink(base, canonical(pairs));
// The example's link pairs as a build_link.py spec.
export function specOf(page, pairs) {
  const spec = { page, set: {}, why: {} };
  for (const [k, v] of pairs) {
    if (k === 'v') continue;
    if (k === 'qs' || k === 'note' || k === 'run') spec[k] = v;
    else if (k === 'json') { try { spec.json = JSON.parse(v); } catch (e) { spec.json = v; } }
    else if (k.startsWith('why.')) spec.why[k.slice(4)] = v;
    else spec.set[k] = v;
  }
  if (!Object.keys(spec.why).length) delete spec.why;
  return spec;
}

/* ── The reference of one page (what agent.txt used to be) ────────────────── */
export function referenceMd(txt) {
  return txt;
}

/* ── Zip, byte for byte the same each run ─────────────────────────────────── */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = buf => { let c = 0xFFFFFFFF; for (const b of buf) c = CRC[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
export function zip(files) {   // files: [[path, Buffer|string]]
  const DOS_TIME = 0, DOS_DATE = (2026 - 1980) << 9 | 1 << 5 | 1;   // 2026-01-01 00:00
  const locals = [], centrals = [];
  let offset = 0;
  for (const [path, body] of files) {
    const data = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
    const name = Buffer.from(path, 'utf8');
    const comp = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const exec = path.endsWith('.py');
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(DOS_TIME, 10); lh.writeUInt16LE(DOS_DATE, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(3 << 8 | 20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(DOS_TIME, 12); ch.writeUInt16LE(DOS_DATE, 14); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28);
    ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32); ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(((exec ? 0o100755 : 0o100644) << 16) >>> 0, 38); ch.writeUInt32LE(offset, 42);
    locals.push(lh, name, comp);
    centrals.push(ch, name);
    offset += lh.length + name.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

/* ── Everything one tool's skill holds ────────────────────────────────────── */
export function skillFiles(T, models, refTexts) {
  const name = skillName(T);
  const params = {
    skill: name, tool: T.name, site: SITE, format: 'load link version 1', whyMax: WHY_MAX,
    pages: models.map(pageData),
  };
  const files = [
    ['SKILL.md', skillMd(T, models)],
    ...models.map(M => ['references/' + refName(M.P.page), referenceMd(refTexts.get(M.P.page))]),
    ['references/params.json', JSON.stringify(params, null, 1) + '\n'],
    ['scripts/build_link.py', readFileSync(join(ROOT, '_ref', 'ai-skill', 'build_link.py'), 'utf8')],
  ];
  return { name, files, zip: zip(files.map(([p, b]) => [name + '/' + p, b])) };
}

/* ── The AI page ──────────────────────────────────────────────────────────── */
// The tool's own glyph, from the h1 of its main page.
function glyph(T, M) {
  const html = readFileSync(join(ROOT, M.P.page, 'index.html'), 'utf8');
  const m = /<h1[^>]*>\s*(<svg[\s\S]*?<\/svg>)/.exec(html);
  // Only the <svg> tag's own size and style go: a <rect> inside needs its width and height.
  return m ? m[1].replace(/^<svg[^>]*>/, t => t.replace(/\s(width|height|style)="[^"]*"/g, '').replace('<svg', '<svg width="1em" height="1em"')) : '';
}

// A value as people read it: 800000 as 800,000 (800.000 on an Indonesian page).
const LOCALE = { en: 'en-US', id: 'id-ID' };
const shown = (v, lang = 'en') => /^(1[89]|2[0-2])\d\d$/.test(String(v)) ? String(v) : /^-?\d+(\.\d+)?$/.test(String(v)) ? Number(v).toLocaleString(LOCALE[lang], { maximumFractionDigits: 4 }) : String(v);

// The demo conversation: the main page's "AI page example" notes section, else its Example
// (on an Indonesian AI page, the id page's "AI page example (id)" first).
function demoRows(M, demo, lang = 'en') {
  const state = demo.state || {};
  const why = Object.fromEntries(demo.pairs.filter(([k]) => k.startsWith('why.')).map(([k, v]) => [k.slice(4), v]));
  // Thousands separators out: "$800,000" and "Rp 300.000.000" both read as the number.
  let said = String(demo.request).replace(/[,$]/g, '');
  if (lang === 'id') said = String(demo.request).replace(/(\d)\.(?=\d{3}\b)/g, '$1').replace(/(\d),(\d)/g, '$1.$2');
  // An amount's prefix is the currency the example opens in (Rp for a Jakarta Quick Start), when the page has a symbol field.
  const cur = ['currencySymbol', 'currency'].find(k => M.byKey[k] && !M.byKey[k].money && state[k]);
  const pre = f => f.money && cur ? String(state[cur]) : f.prefix || '';
  const rows = [];
  for (const [k, v] of demo.pairs) {
    if (k === 'v' || k === 'note' || k === 'json' || k === 'run' || k.startsWith('why.')) continue;
    const f = M.byKey[k];
    let label = k === 'qs' ? 'Quick Start' : f ? (f.label || k) : k;
    let value = k === 'qs' ? v : f && f.options ? ((f.options.find(o => o.value === v) || {}).label || v)
      : f && f.money && Number.isFinite(Number(v)) ? Number(v).toLocaleString(LOCALE[lang], { maximumFractionDigits: 4 }) : shown(v, lang);
    if (f && !f.options) {
      // A unit another field sets (setupCost with setupCostType): that field's choice, as it opens.
      const by = (f.pairs || []).map(x => M.byKey[x]).find(x => x && x.options);
      const opt = by && by.options.find(o => o.value === String(state[by.key]));
      if (opt) value = opt.label === '$' ? pre(f) + value : opt.label === '%' ? value + '%' : pre(f) + value + ' ' + opt.label;
      else {
        const unit = f.input === 'range' ? f.unit : f.suffix;
        if (unit) value += ' ' + unit;
        if (pre(f)) value = pre(f) + value;
      }
    }
    // Stated by the user: the value as written, as 180k or 1.2m, or a choice's words, in the request.
    const n = Number(v);
    const forms = [String(v)];
    if (Number.isFinite(n) && n >= 1000) forms.push(n / 1000 + 'k', n / 1e6 + 'm', n / 1e6 + ' million');
    if (lang === 'id' && Number.isFinite(n) && n >= 1e6) forms.push(n / 1e6 + ' juta', n / 1e9 + ' miliar');
    const word = f && f.options && (f.options.find(o => o.value === v) || {}).label;
    const lit = x => '(^|[^\\d.])' + String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\d])';
    const user = k !== 'qs' && (forms.some(x => String(x).length > 1 && new RegExp(lit(x), 'i').test(said)) ||
      (!!word && word.length > 2 && said.toLowerCase().includes(word.toLowerCase())));
    rows.push({ key: k, label, value, source: user ? 'You said' : why[k] || (k === 'qs' ? 'Nearest local starting point' : 'Assumed'), user });
  }
  return rows;
}

// What the user stated in an example: the link's keys whose value is in the request.
export function userInputs(M, ex) {
  // The state the example opens on (Quick Start, then the link), as agent-doc worked it out.
  const state = { ...Object.fromEntries(M.fields.map(f => [f.key, f.value])), ...(M.exampleState || {}) };
  for (const [k, v] of ex.pairs) state[k] = v;
  return demoRows(M, { ...ex, state }).filter(r => r.user);
}

/* ── The install card, shared by every <tool>/ai/ page and the /ai/ hub ────────────────────────
   zip and skill name the download (the hub uses a placeholder); hub is the path to /ai/ from
   the page. The steps themselves are drawn by ai-page.js. */
export const AI_ASOF = '7 November 2026';
// Each assistant's mark on its tab: Claude, ChatGPT and Grok as in jastip-app-js's MCP guide,
// Gemini and Copilot from @lobehub/icons (MIT). ChatGPT and Grok take the tab's text colour.
const AI_LOGOS = {
  claude: '<path fill="#d97757" d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/>',
  chatgpt: '<path fill="currentColor" d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>',
  grok: '<path fill="currentColor" d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815"/>',
  gemini: '<path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="#3186FF"/><path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="url(#ai-lg-gemini-0)"/><path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="url(#ai-lg-gemini-1)"/><path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="url(#ai-lg-gemini-2)"/><defs><linearGradient gradientUnits="userSpaceOnUse" id="ai-lg-gemini-0" x1="7" x2="11" y1="15.5" y2="12"><stop stop-color="#08B962"/><stop offset="1" stop-color="#08B962" stop-opacity="0"/></linearGradient><linearGradient gradientUnits="userSpaceOnUse" id="ai-lg-gemini-1" x1="8" x2="11.5" y1="5.5" y2="11"><stop stop-color="#F94543"/><stop offset="1" stop-color="#F94543" stop-opacity="0"/></linearGradient><linearGradient gradientUnits="userSpaceOnUse" id="ai-lg-gemini-2" x1="3.5" x2="17.5" y1="13.5" y2="12"><stop stop-color="#FABC12"/><stop offset=".46" stop-color="#FABC12" stop-opacity="0"/></linearGradient></defs>',
  copilot: '<path d="M16.295 5.29l-0.242 0.986h-2.32c-1.721 0-3.22 1.197-3.638 2.902l-2.101 8.593H3.798c-2.44 0-4.229-2.342-3.637-4.761l2.106-8.612c0.557-2.274 2.556-3.87 4.85-3.87h5.54c2.44 0 4.23 2.343 3.638 4.761" fill="url(#ai-lg-copilot-0)"/><path d="M16.295 5.29l-0.242 0.986h-2.32c-1.721 0-3.22 1.197-3.638 2.902l-2.101 8.593H3.798c-2.44 0-4.229-2.342-3.637-4.761l2.106-8.612c0.557-2.274 2.556-3.87 4.85-3.87h5.54c2.44 0 4.23 2.343 3.638 4.761" fill="url(#ai-lg-copilot-1)"/><path d="M7.752 18.758l0.242-0.986h2.321c1.72 0 3.22-1.197 3.637-2.903l2.102-8.593h4.196c2.439 0 4.228 2.343 3.637 4.762l-2.107 8.611c-0.556 2.274-2.555 3.87-4.85 3.87h-5.54c-2.44 0-4.229-2.342-3.638-4.761" fill="url(#ai-lg-copilot-2)"/><path d="M7.752 18.758l0.242-0.986h2.321c1.72 0 3.22-1.197 3.637-2.903l2.102-8.593h4.196c2.439 0 4.228 2.343 3.637 4.762l-2.107 8.611c-0.556 2.274-2.555 3.87-4.85 3.87h-5.54c-2.44 0-4.229-2.342-3.638-4.761" fill="url(#ai-lg-copilot-3)"/><defs><radialGradient cx="0" cy="0" gradientTransform="matrix(-9.77133 19.8405 38.9403 15.7727 12.674 0.587)" gradientUnits="userSpaceOnUse" id="ai-lg-copilot-0" r="1"><stop offset=".25" stop-color="#109df2"/><stop offset=".72" stop-color="#aad445"/><stop offset=".97" stop-color="#ffd400"/></radialGradient><radialGradient cx="0" cy="0" gradientTransform="matrix(-9.94414 20.7959 24.6537 12.5336 21.948 4.756)" gradientUnits="userSpaceOnUse" id="ai-lg-copilot-2" r="1"><stop offset=".07" stop-color="#8c48ff"/><stop offset=".5" stop-color="#f2598a"/><stop offset=".9" stop-color="#ffb152"/></radialGradient><linearGradient gradientUnits="userSpaceOnUse" id="ai-lg-copilot-1" x1="8.275" x2="8.177" y1="0.534" y2="17.776"><stop stop-color="#3dcbff"/><stop offset=".25" stop-color="#0588f7" stop-opacity="0"/></linearGradient><linearGradient gradientUnits="userSpaceOnUse" id="ai-lg-copilot-3" x1="15.839" x2="15.829" y1="5.211" y2="9.907"><stop offset=".06" stop-color="#f8adfa"/><stop offset=".71" stop-color="#a86edd" stop-opacity="0"/></linearGradient></defs>',
};
const AI_APPS = [['claude', 'Claude'], ['chatgpt', 'ChatGPT'], ['grok', 'Grok'], ['gemini', 'Gemini'], ['copilot', 'Copilot']];
/* ── Words for people, by page language ─────────────────────────────────────────
   en is what every AI page says; id is the Indonesian AI page and hub (<tool>/ai/id/, /ai/id/),
   written for an Indonesian reader in the blog's voice (saya and kamu, never Anda; "tool" for
   the tools). The assistants' own menu names (Settings, Skills, Upload) stay as the apps show
   them. ai-page.js holds the words of the install demo, in both languages. */
const WORDS = {
  en: {
    htmlLang: 'en', locale: 'en_AU', site: 'Site',
    pageTitle: n => `Use ${n} in your AI`,
    pageDesc: n => `Download the ${n} skill for Claude, ChatGPT, Grok, Gemini or Copilot. Your AI researches the assumptions and sends one link that opens ${n} on your scenario.`,
    stepDownload: 'Download the skill', stepDownloadText: z => `Download ${z} from this page.`,
    stepInstall: 'Install it in your AI', stepInstallText: 'Upload the zip as a skill in Claude, ChatGPT, Grok or Copilot (in Gemini, upload the unzipped folder) and switch it on.',
    stepAsk: 'Ask your question', stepAskText: n => `Ask your question. The AI lists your inputs and its assumptions and sends a link that opens ${n} on your scenario.`,
    dlSkill: 'Download skill', dlZip: z => `Download ${z}`, openTool: 'Open the tool', theme: '🌙 Dark',
    files: 'A .zip skill: <code>SKILL.md</code> (how to answer), <code>references/</code> (every input, its range and the Quick Starts) and <code>scripts/build_link.py</code> (builds and checks the link).',
    installH: 'Install the skill', installSub: 'Pick your assistant. The demo plays the steps; press a step to jump to it.', assistant: 'Assistant', pause: 'Pause',
    installNote: z => `Menus move as these apps update: look for <strong>Skills</strong> (Claude: Settings, Customize; ChatGPT and Grok: Plugins; Gemini: Customise; Copilot: inside an agent). Gemini takes the unzipped folder; the others take the zip as it is. No skill support on your plan? Attach <code>${z}</code> or its <code>SKILL.md</code> to the chat and say "use this skill".`,
    asof: d => `Effective ${d}. AI changes quickly: the UI, plans and features may be different by the time you see this.`,
    chatLabel: 'An example conversation', usingSkill: 'Using skill', searched: 'Searched: ', ran: 'Ran <code>scripts/build_link.py</code>: link checked',
    yourInputs: 'Your inputs', assumptions: 'Assumptions', yourScenario: 'Your scenario', openOn: n => `Open ${n} on this scenario`,
    openToSee: 'Open the link to see the result.', replay: 'Replay', openScenario: 'Open this scenario',
    useH: 'How to use it',
    useSub: 'Ask as you would ask a friend. With the skill on, the AI keeps your figures, researches the rest, and hands you the link. It does not give the answer itself: the tool does, once you open the link.',
    facts: [
      '<strong>Your figures stay yours.</strong> Anything you state goes in as you said it; correct any assumption and the AI sends a new link.',
      '<strong>Checked before you see it.</strong> The skill\'s script checks every input\'s name, range and choices before the AI sends the link, so it opens the scenario listed.',
      '<strong>The tool shows what the AI chose.</strong> When the link opens, a banner lists each value the AI set and why, with an Undo back to your own inputs.',
    ],
    ready: 'Ready to try it?', dlTheSkill: 'Download the skill', readGuide: 'Read the guide', allSkills: 'All Brotools skills',
    collab: '<strong>A hobby project, open to collaboration.</strong> This tool is free to use. If your organisation could use a custom tool or training, <a href="mailto:hi@adjiebrotots.com?subject=Collaboration">let’s talk</a>. Bugs or questions: <a href="mailto:hi@adjiebrotots.com">hi@adjiebrotots.com</a> 🙂',
    links: up => `<a href="${up}disclaimer/">Disclaimer</a> · <a href="${up}privacy/">Privacy Policy</a> · <a href="https://blog.adjiebrotots.com/">Blog</a>`,
    flag: 'Australian flag', gpl: 'Licensed under <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener">GNU GPL</a>, free to use, modify, and share with source code disclosed.',
    badge: 'Indonesian badge', made: 'Made in Australia by <a href="https://www.adjiebrotots.com/about/" rel="author">Adjie Brotosukmono</a>, an Indonesian engineer.',
    toggle: '<a class="btn-theme" id="langToggle" href="id/" hreflang="id" lang="id" title="Baca dalam bahasa Indonesia">ID</a>',
    // The hub
    hubTitle: 'Use Adjie Brotools in your AI',
    hubDesc: n => `Free skills for Claude, ChatGPT, Grok, Gemini and Copilot that open ${n} Adjie Brotools calculators on your own scenario with one link: property, tax, investing, retirement and power systems.`,
    skillOf: n => `${n} skill`, hubHowTo: 'Install a Brotools skill in your AI',
    hubPick: 'Pick a tool', hubPickText: 'Choose a tool below and download its skill (a .zip) from its AI page.',
    hubAskText: 'Ask in plain words. The AI lists your inputs and its assumptions and sends a link that opens the tool on your scenario.',
    crumbHome: 'Adjie Brotools', crumbAi: 'Use in AI', exampleWith: 'Example with',
    getSkill: 'Get the skill', allTools: '← All tools', pickSkill: 'Pick a skill', seeSkills: n => `See the ${n} skills`, howInstall: 'How to install',
    hubFiles: 'Each skill is a .zip: <code>SKILL.md</code> (how to answer), <code>references/</code> (every input, its range and the Quick Starts) and <code>scripts/build_link.py</code> (builds and checks the link). Each tool\'s AI page has the download.',
    toolsH: 'Tools with a skill', toolsSub: 'Open a tool to use it yourself, or get its skill to use it through your AI. In Copilot, one agent can hold all of them.',
    keyword: 'Keyword', searchPh: 'Search skills', showing: n => `Showing ${n} skills.`, noMatch: 'No skill matches that search.', seeAllTools: 'See all tools',
    domain: d => d,
  },
  id: {
    htmlLang: 'id', locale: 'id_ID', site: 'Situs',
    pageTitle: n => `Pakai ${n} di AI-mu`,
    pageDesc: n => `Unduh skill ${n} untuk Claude, ChatGPT, Grok, Gemini, atau Copilot. AI-mu mencari sendiri asumsi yang dibutuhkan, lalu mengirim satu tautan yang membuka ${n} dengan skenariomu.`,
    stepDownload: 'Unduh skill-nya', stepDownloadText: z => `Unduh ${z} dari halaman ini.`,
    stepInstall: 'Pasang di AI-mu', stepInstallText: 'Unggah berkas zip itu sebagai skill di Claude, ChatGPT, Grok, atau Copilot (di Gemini, unggah folder hasil ekstraknya), lalu aktifkan.',
    stepAsk: 'Ajukan pertanyaanmu', stepAskText: n => `Ajukan pertanyaanmu. AI akan menuliskan input darimu dan asumsi yang dipakainya, lalu mengirim tautan yang membuka ${n} dengan skenariomu.`,
    dlSkill: 'Unduh skill', dlZip: z => `Unduh ${z}`, openTool: 'Buka tool-nya', theme: '🌙 Gelap',
    files: 'Skill ini berupa berkas .zip: <code>SKILL.md</code> (cara menjawab), <code>references/</code> (setiap <em>input</em>, rentang nilainya, dan Quick Start) dan <code>scripts/build_link.py</code> (menyusun dan mengecek tautan).',
    installH: 'Pasang skill-nya', installSub: 'Pilih asisten AI-mu. Demo di bawah memutar langkah-langkahnya, dan kamu bisa menekan satu langkah untuk langsung melompat ke sana.', assistant: 'Asisten', pause: 'Jeda',
    installNote: z => `Letak menu bisa berpindah setiap kali aplikasinya diperbarui, jadi carilah <strong>Skills</strong> (Claude: Settings, Customize; ChatGPT dan Grok: Plugins; Gemini: Customise; Copilot: di dalam sebuah <em>agent</em>). Gemini menerima folder hasil ekstrak, sementara yang lain menerima berkas zip apa adanya. Paket langgananmu belum mendukung skill? Lampirkan <code>${z}</code> atau <code>SKILL.md</code>-nya ke <em>chat</em>, lalu tulis "pakai skill ini".`,
    asof: d => `Berlaku per ${d}. AI berubah dengan cepat, jadi tampilan, paket, dan fiturnya mungkin sudah berbeda saat kamu membaca ini.`,
    chatLabel: 'Contoh percakapan', usingSkill: 'Memakai skill', searched: 'Mencari: ', ran: 'Menjalankan <code>scripts/build_link.py</code>: tautan sudah dicek',
    yourInputs: 'Input darimu', assumptions: 'Asumsi', yourScenario: 'Skenariomu', openOn: n => `Buka ${n} dengan skenario ini`,
    openToSee: 'Buka tautannya untuk melihat hasilnya.', replay: 'Putar ulang', openScenario: 'Buka skenario ini',
    useH: 'Cara memakainya',
    useSub: 'Bertanyalah seperti kamu bertanya kepada teman. Begitu skill ini terpasang, AI memakai angka darimu apa adanya, mencari sendiri sisanya, lalu memberimu tautan. AI tidak menjawab sendiri, karena jawabannya baru dihitung oleh <em>tool</em> begitu tautan itu kamu buka.',
    facts: [
      '<strong>Angka darimu tidak diubah.</strong> Semua yang kamu sebutkan masuk persis seperti yang kamu tulis. Kalau ada asumsi yang keliru, koreksi saja, dan AI akan mengirim tautan baru.',
      '<strong>Dicek sebelum sampai kepadamu.</strong> Skrip di dalam skill mengecek nama, rentang, dan pilihan setiap <em>input</em> sebelum AI mengirim tautannya, sehingga yang terbuka memang skenario yang tertulis.',
      '<strong><em>Tool</em> menunjukkan pilihan AI.</strong> Begitu tautan dibuka, sebuah <em>banner</em> mencantumkan setiap nilai yang diisi AI beserta alasannya, lengkap dengan tombol untuk kembali ke <em>input</em>-mu sendiri.',
    ],
    ready: 'Siap mencobanya?', dlTheSkill: 'Unduh skill-nya', readGuide: 'Baca panduannya', allSkills: 'Semua skill Brotools',
    collab: '<strong>Proyek hobi yang terbuka untuk kolaborasi.</strong> <em>Tool</em> ini gratis dipakai. Kalau organisasimu butuh <em>tool</em> khusus atau pelatihan, <a href="mailto:hi@adjiebrotots.com?subject=Collaboration">mari ngobrol</a>. Kalau menemukan <em>bug</em> atau punya pertanyaan, kirim saja ke <a href="mailto:hi@adjiebrotots.com">hi@adjiebrotots.com</a> 🙂',
    links: up => `<a href="${up}disclaimer/id/">Penafian</a> · <a href="${up}privacy/id/">Kebijakan Privasi</a> · <a href="https://blog.adjiebrotots.com/id/" hreflang="id">Blog</a>`,
    flag: 'Bendera Australia', gpl: 'Berlisensi <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener">GNU GPL</a>: kode sumbernya terbuka dan bebas dipakai, diubah, serta dibagikan.',
    badge: 'Lencana Indonesia', made: 'Dibuat di Australia oleh <a href="https://www.adjiebrotots.com/about/" rel="author">Adjie Brotosukmono</a>, insinyur asal Indonesia.',
    toggle: '<a class="btn-theme" id="langToggle" href="../" hreflang="en" lang="en" title="Read in English">EN</a>',
    hubTitle: 'Pakai Adjie Brotools di AI-mu',
    hubDesc: n => `Skill gratis untuk Claude, ChatGPT, Grok, Gemini, dan Copilot yang membuka ${n} kalkulator Adjie Brotools dengan skenariomu sendiri lewat satu tautan: properti, pajak, investasi, pensiun, dan sistem tenaga listrik.`,
    skillOf: n => `Skill ${n}`, hubHowTo: 'Pasang skill Brotools di AI-mu',
    hubPick: 'Pilih tool', hubPickText: 'Pilih salah satu tool di bawah, lalu unduh skill-nya (berkas .zip) dari halaman AI tool itu.',
    hubAskText: 'Bertanyalah dengan bahasa sehari-hari. AI akan menuliskan input darimu dan asumsi yang dipakainya, lalu mengirim tautan yang membuka tool dengan skenariomu.',
    crumbHome: 'Adjie Brotools', crumbAi: 'Pakai di AI', exampleWith: 'Contoh dengan',
    getSkill: 'Ambil skill-nya', allTools: '← Semua tool', pickSkill: 'Pilih skill', seeSkills: n => `Lihat ${n} skill`, howInstall: 'Cara memasang',
    hubFiles: 'Setiap skill berupa berkas .zip: <code>SKILL.md</code> (cara menjawab), <code>references/</code> (setiap <em>input</em>, rentang nilainya, dan Quick Start) dan <code>scripts/build_link.py</code> (menyusun dan mengecek tautan). Unduhannya ada di halaman AI setiap <em>tool</em>.',
    toolsH: 'Tool yang punya skill', toolsSub: 'Buka <em>tool</em>-nya untuk memakainya sendiri, atau ambil skill-nya untuk memakainya lewat AI-mu. Di Copilot, satu <em>agent</em> bisa menampung semuanya.',
    keyword: 'Kata kunci', searchPh: 'Cari skill', showing: n => `Menampilkan ${n} skill.`, noMatch: 'Tidak ada skill yang cocok dengan pencarian itu.', seeAllTools: 'Lihat semua tool',
    // The home page's category names (_ref/bake-home-id.mjs, LABELS)
    domain: d => ({ Engineering: 'Teknik', Finance: 'Keuangan', Visualisation: 'Visualisasi', Others: 'Lainnya' })[d] || d,
    // A card for a tool with no Indonesian page (as on the Indonesian home, id/index.html)
    enOnly: '<span class="tool-lang" lang="en" title="Hanya tersedia dalam bahasa Inggris">EN</span>',
  },
};

export function installSection(zipName, name, hub, show = {}, lang = 'en') {   // show: { name, ref, files } for the demo's skill page
  const W = WORDS[lang];
  return `    <section class="gd-sec card" id="install" aria-labelledby="install-h">
      <h2 id="install-h">${W.installH}</h2>
      <p class="gd-sub">${W.installSub}</p>
      <div class="ai-install" data-zip="${attr(zipName)}" data-skill="${attr(name)}" data-hub="${attr(hub)}"${show.name ? ` data-name="${attr(show.name)}" data-ref="${attr(show.ref)}" data-files="${show.files}"` : ''}>
        <div class="ai-tabs" role="tablist" aria-label="${W.assistant}">
${AI_APPS.map(([k, v], i) => `          <button type="button" role="tab" class="ai-tab" data-app="${k}" aria-selected="${i === 0}"><svg class="ai-logo" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${AI_LOGOS[k]}</svg><span>${v}</span></button>`).join('\n')}
        </div>
        <p class="ai-app-note" hidden></p>
        <div class="gd-demo">
          <figure class="gd-screen">
            <div class="ai-stage" aria-hidden="true"></div>
            <div class="gd-bar"><span class="gd-cap ai-cap"></span><button type="button" class="btn-sm btn-theme ai-play">${W.pause}</button></div>
          </figure>
          <ol class="gd-steps ai-steps"></ol>
        </div>
      </div>
      <p class="gd-note">${W.installNote(esc(zipName))}</p>
      <p class="ai-asof">${W.asof(AI_ASOF)}</p>
    </section>`;
}

/* The page around an AI page's main: head (analytics, ads, SEO, JSON-LD) and footer. up is the
   path back to the site root ('../../' from <tool>/ai/, '../' from /ai/, one more from id/).
   alts: the page's language pair ({ en, id, 'x-default' }), or null for a page with no twin. */
function pageTop({ up, comment, title, desc, url, image, ld, lang = 'en', alts = null }) {
  const W = WORDS[lang];
  const pair = alts ? '\n' + Object.entries(alts).map(([k, v]) => `<link rel="alternate" hreflang="${k}" href="${attr(v)}">`).join('\n') : '';
  const locale = alts ? `\n<meta property="og:locale" content="${W.locale}">\n<meta property="og:locale:alternate" content="${WORDS[lang === 'id' ? 'en' : 'id'].locale}">` : '';
  return `<!DOCTYPE html>
<html lang="${W.htmlLang}">
<head>
  <!-- Generated by _ref/agent-doc.mjs (_ref/ai-skill.mjs) ${comment} -->
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-VYTV157ST0"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    // Analytics cookies wait for a yes in the EEA, the UK and Switzerland (asked by consent.js); ads there are non-personalised until Google's consent message says otherwise.
    gtag('consent', 'default', {analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', region: ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO','GB','CH']});
    gtag('consent', 'default', {analytics_storage: 'granted', ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted'});
    try { var abtConsent = localStorage.getItem('abt-consent'); if (abtConsent) gtag('consent', 'update', {analytics_storage: abtConsent}); } catch (e) {}
    gtag('js', new Date());

    gtag('config', 'G-VYTV157ST0');
  </script>
  <!-- Google AdSense -->
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8730116101825381"
       crossorigin="anonymous"></script>
  <script src="${up}consent.js" defer></script>

<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)} | Adjie Brotools</title>
<meta name="description" content="${attr(desc)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${attr(url)}">${pair}
<meta property="og:type" content="article">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(desc)}">
<meta property="og:url" content="${attr(url)}">
<meta property="og:site_name" content="Adjie Brotot Tools">
<meta property="og:image" content="${attr(image)}">${locale}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${attr(title)}">
<meta name="twitter:description" content="${attr(desc)}">
<script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
</script>
<link rel="icon" type="image/svg+xml" href="${up}logos/logo.svg">
<link rel="manifest" href="${up}manifest.webmanifest">
<link rel="apple-touch-icon" href="${up}logos/apple-touch-icon.png">
<script src="${up}pwa.js" defer></script>
<link rel="preload" href="${up}assets/fonts/dm-sans.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${up}fonts.css">
<link rel="stylesheet" href="${up}dark.css">
<link rel="stylesheet" href="${up}light.css">
<link rel="stylesheet" href="${up}shared.css?v=20261110">
<link rel="stylesheet" href="${up}guide-shared.css">
<link rel="stylesheet" href="${up}ai-page.css">
</head>
<body class="light">
<!--email_off-->
<script src="${up}theme.js"></script>
<div class="container gd ai">
`;
}
function pageEnd(up, lang = 'en') {
  const W = WORDS[lang];
  return `  <footer>
    <p class="footer-collab">${W.collab}</p>
    <p class="footer-links">${W.links(up)}</p>
    <div class="gd-made">
      <img loading="lazy" src="${up}logos/australian.png" alt="${W.flag}" class="gd-flag">
      <div><img loading="lazy" src="${up}logos/gpl.png" alt="GNU GPL"><span>${W.gpl}</span></div>
      <div><img loading="lazy" src="${up}logos/indonesian.png" alt="${W.badge}"><span>${W.made}</span></div>
    </div>
  </footer>
</div>
<script src="${up}dropdown.js" defer></script>
<script src="${up}shared.js?v=20261110" defer></script>
<script src="${up}ai-page.js" defer></script>
<!--/email_off-->
</body>
</html>
`;
}

/* The worked conversation (How to use it): a request, the AI's inputs, assumptions and link. */
// One example conversation. key and hidden: the hub holds one per tool, picked from a dropdown.
// toolName: the tool's name in the page's language.
function chatBlock(toolName, demo, rows, name, key, hidden, lang = 'en') {
  const W = WORDS[lang];
  return `<div class="ai-chat" aria-label="${W.chatLabel}"${key ? ` data-tool="${attr(key)}"` : ''}${hidden ? ' hidden' : ''}>
        <div class="ai-msg ai-user"><p>${esc(demo.request)}</p></div>
        <div class="ai-work">
          <span class="ai-chip">${W.usingSkill} <strong>${esc(name)}</strong></span>
          ${(demo.searches || []).map(s => `<span class="ai-chip">${W.searched}${esc(s)}</span>`).join('\n          ')}
          <span class="ai-chip">${W.ran}</span>
        </div>
        <div class="ai-msg ai-bot">
          ${rows.some(r => r.user) ? `<h3>${W.yourInputs}</h3>
          <ul>${rows.filter(r => r.user).map(r => `<li>${esc(r.label)}: <strong>${esc(r.value)}</strong></li>`).join('')}</ul>` : ''}
          <h3>${W.assumptions}</h3>
          <ol>${demo.assumptions.map(a => `<li>${esc(a)}</li>`).join('')}</ol>
          <h3>${W.yourScenario}</h3>
          <p><a class="ai-link" href="${attr(demo.link)}" target="_blank" rel="noopener">${esc(W.openOn(toolName))}</a></p>
          <pre class="ai-code"><code>${esc(demo.link)}</code></pre>
          <p><strong>${W.openToSee}</strong></p>
        </div>
        <div class="ai-chat-bar"><button type="button" class="btn-sm btn-theme ai-replay">${W.replay}</button><a class="btn-sm btn-primary" href="${attr(demo.link)}" target="_blank" rel="noopener">${W.openScenario}</a></div>
      </div>`;
}
// sub: what goes above the conversation(s); chats: the conversation(s), one per tool on the hub.
function useSection(T, demo, rows, name, sub, chats, lang = 'en') {
  const W = WORDS[lang];
  return `    <section class="gd-sec card" id="use" aria-labelledby="use-h">
      <h2 id="use-h">${W.useH}</h2>
      <p class="gd-sub">${W.useSub}</p>
      ${sub || ''}${chats || chatBlock(nameIn(T, lang), demo, rows, name, null, false, lang)}
      <ul class="gd-facts">
${W.facts.map(f => `        <li>${f}</li>`).join('\n')}
      </ul>
    </section>`;
}

// lang 'id': the Indonesian AI page (<tool>/ai/id/), about the tool's Indonesian page.
export function aiPage(T, models, demo, lang = 'en') {
  const W = WORDS[lang], ID = lang === 'id';
  const idMain = idMainOf(T, models);
  const M = ID ? idMain : models.find(m => m.P.page === T.main) || models[0];
  const name = skillName(T);
  const zipName = name + '.zip';
  const url = aiUrl(T, lang);
  const toolName = nameIn(T, lang);
  const title = W.pageTitle(toolName);
  const desc = W.pageDesc(toolName);
  const alts = idMain ? { en: aiUrl(T), id: aiUrl(T, 'id'), 'x-default': aiUrl(T) } : null;
  // From <tool>/ai/ (or <tool>/ai/id/): the site root, the skill's zip, the tool page, the guide, the hub.
  const up = ID ? '../../../' : '../../';
  const zipHref = (ID ? '../' : '') + zipName;
  const toolHref = ID ? M.P.url.replace('/' + T.tool + '/', '../../') : '../';
  const guide = ID && existsSync(join(ROOT, T.tool, 'guides', 'id', 'index.html')) ? '../../guides/id/'
    : existsSync(join(ROOT, T.tool, 'guides', 'index.html')) ? (ID ? '../../guides/' : '../guides/') : '';
  const hub = up + 'ai/' + (ID ? 'id/' : '');
  const ogId = ID && existsSync(join(ROOT, 'og', T.tool + '-id.jpg'));
  demo = { ...demo, link: canonicalLink(M.base, demo.pairs) };
  const rows = demoRows(M, demo, lang);
  const H = [];
  H.push(pageTop({ up, lang, alts, comment: `from ${esc(M.P.notes)} and the tool itself: edit those, then run it.`, title, desc, url, image: `https://tool.adjiebrotots.com/og/${T.tool}${ogId ? '-id' : ''}.jpg`,
    ld: {
    '@context': 'https://schema.org', '@type': 'HowTo', name: title, url, description: desc, inLanguage: lang,
    isPartOf: { '@type': 'WebApplication', name: toolName, url: SITE + (ID ? M.P.url : '/' + T.tool + '/') },
    step: [
      { '@type': 'HowToStep', name: W.stepDownload, text: W.stepDownloadText(zipName) },
      { '@type': 'HowToStep', name: W.stepInstall, text: W.stepInstallText },
      { '@type': 'HowToStep', name: W.stepAsk, text: W.stepAskText(toolName) },
    ],
  } }) + `
  <nav class="gd-top" aria-label="${W.site}">
    <a class="btn-theme btn-back" href="${attr(toolHref)}">← ${esc(ID && T.backId || toolName)}</a>
    <div class="gd-top-r">
      <a class="btn-primary gd-open gd-open-top" href="${attr(zipHref)}" download>${W.dlSkill}</a>${alts ? `
      ${W.toggle}` : ''}
      <button class="btn-theme" id="themeToggle" type="button">${W.theme}</button>
    </div>
  </nav>

  <main>
    <header class="gd-hero">
      <h1>${glyph(T, M)}${keep(esc(title))}</h1>
      <div class="gd-hero-btns">
        <a class="btn-primary gd-open ai-dl" href="${attr(zipHref)}" download><span aria-hidden="true">⬇</span>&nbsp;${esc(W.dlZip(zipName))}</a>
        <a class="gd-skip" href="${attr(toolHref)}">${W.openTool}</a>
      </div>
      <p class="ai-files">${W.files}</p>
    </header>

${installSection(zipName, name, hub, { name: toolName, ref: refName(M.P.page), files: models.length + 3 }, lang)}

    <!-- In-article ad: between cards (.ad-slot in shared.css) -->
    <div class="ad-slot">
      <ins class="adsbygoogle" style="display:block; text-align:center;" data-ad-layout="in-article" data-ad-format="fluid" data-ad-client="ca-pub-8730116101825381" data-ad-slot="1433722275"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>

${useSection(T, demo, rows, name, null, null, lang)}

    <!-- Multiplex ad: before the closing buttons (.ad-slot in shared.css) -->
    <div class="ad-slot">
      <ins class="adsbygoogle" style="display:block" data-ad-format="autorelaxed" data-ad-client="ca-pub-8730116101825381" data-ad-slot="4659267360"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>

    <section class="gd-end">
      <p>${W.ready}</p>
      <a class="btn-primary gd-open" href="${attr(zipHref)}" download>${W.dlTheSkill}</a>
      ${guide ? `<a class="gd-skip" href="${guide}">${W.readGuide}</a>` : ''}
      <a class="gd-skip" href="${attr(toolHref)}">${W.openTool}</a>
      <a class="gd-skip" href="${hub}">${W.allSkills}</a>
    </section>
  </main>

` + pageEnd(up, lang));
  return H.join('\n');
}

/* ── llms.txt section ─────────────────────────────────────────────────────── */
// models: every page agent-doc read, to name the Indonesian AI pages (none: English lines only).
export function llmsLines(models = []) {
  const L = [];
  for (const T of TOOLS) {
    L.push(`- ${T.name}: ${aiUrl(T)} (skill: ${aiUrl(T)}${skillName(T)}.zip; read directly: ${aiUrl(T)}skill/SKILL.md)`);
  }
  const ids = TOOLS.filter(T => idMainOf(T, models.filter(M => M.P.page.split('/')[0] === T.tool)));
  if (ids.length) {
    L.push('', `The same skills explained for people in Indonesian, every tool listed: ${HUB_URL_ID}`, 'AI pages in Indonesian (each links the tool\'s Indonesian page; the skill is the same):');
    for (const T of ids) L.push(`- ${nameIn(T, 'id')} (${T.name}): ${aiUrl(T, 'id')}`);
  }
  return L;
}
export { AI_RULES };

/* ── The hub, /ai/: every tool with a skill ────────────────────────────────────
   The same three parts as a tool's AI page: how to install a skill, how to use one (the first
   tool's worked example), then each tool with a link to open it and one to its AI page.
   Its Indonesian twin, /ai/id/ (aiHub(list, 'id')), lists every tool too: a tool with an
   Indonesian page links to that page and its Indonesian AI page, by its Indonesian name; any
   other keeps its English name, links in English and is marked EN, as on the Indonesian home.
   Its examples are the Indonesian conversations only. */
export const HUB_URL = SITE + '/ai/';
export const HUB_URL_ID = SITE + '/ai/id/';
function metaDesc(M) {
  const html = readFileSync(join(ROOT, M.P.page, 'index.html'), 'utf8');
  const m = /<meta name="description" content="([^"]*)"/.exec(html);
  return m ? m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"') : '';
}
// A tool's card on the Indonesian home (id/index.html, _ref/bake-home-id.mjs): its description
// written for an Indonesian reader (HTML, with <em> for foreign words), or '' when it has none.
function homeIdDesc(T) {
  const file = join(ROOT, 'id', 'index.html');
  if (!existsSync(file)) return '';
  const html = readFileSync(file, 'utf8');
  for (const m of html.matchAll(/<article\s+class="tool-card"([\s\S]*?)<\/article>/g)) {
    if (!m[1].includes(`data-anim="${T.tool}"`)) continue;
    const d = /<p class="tool-description"[^>]*>([\s\S]*?)<\/p>/.exec(m[1]);
    if (d) return d[1].trim();
  }
  return '';
}
// A tool's category on the home page (data-domain of its card), so the hub groups as the home page does;
// a tool not on the home page names its own (domain in TOOLS).
const DOMAIN_ORDER = ['Engineering', 'Finance', 'Visualisation'];
function domainOf(T) {
  if (T.domain) return T.domain;
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  for (const m of html.matchAll(/<article\s+class="tool-card"([\s\S]*?)<\/article>/g)) {
    if (!m[1].includes(`/${T.tool}/"`)) continue;
    const d = /data-domain="([^"]*)"/.exec(m[1]);
    if (d) return d[1].trim();
  }
  return 'Others';
}
const domainRank = d => { const i = DOMAIN_ORDER.indexOf(d); return i < 0 ? 99 : i; };
export function aiHub(list, lang = 'en') {   // list: [{ T, models, demo, demoId }] in TOOLS order (demoId: the Indonesian AI page's)
  const W = WORDS[lang], ID = lang === 'id';
  const up = ID ? '../../' : '../';
  const title = W.hubTitle;
  const desc = W.hubDesc(list.length);
  const url = ID ? HUB_URL_ID : HUB_URL;
  const anyId = list.some(x => idMainOf(x.T, x.models));
  const alts = anyId ? { en: HUB_URL, id: HUB_URL_ID, 'x-default': HUB_URL } : null;
  const items = list.map(({ T, models, demo, demoId }) => {
    const idM = idMainOf(T, models);
    const own = ID && !!idM;   // this card is in the page's language
    const M = own ? idM : models.find(m => m.P.page === T.main) || models[0];
    const d = own ? demoId || demo : demo;
    const ex = { ...d, link: canonicalLink(M.base, d.pairs) };
    const aboutId = ID ? homeIdDesc(T) : '';
    return { T, M, own, name: skillName(T), title: own ? nameIn(T, 'id') : T.name, glyph: glyph(T, M),
      about: aboutId || esc(metaDesc(M)), aboutLang: ID && !aboutId ? 'en' : '', domain: domainOf(T),
      ai: up + T.tool + '/ai/' + (own ? 'id/' : ''), open: own ? up + M.P.url.replace(/^\//, '') : up + T.tool + '/',
      demo: ex, rows: demoRows(M, ex, own ? 'id' : 'en') };
  });
  // The cards (and the example dropdown) grouped by category, in the home page's order, then by name.
  const groups = [...new Set(items.map(x => x.domain))].sort((a, b) => domainRank(a) - domainRank(b) || a.localeCompare(b));
  const inGroup = (g, xs = items) => xs.filter(x => x.domain === g).sort((a, b) => a.title.localeCompare(b.title));
  // Every tool's own example (the one its AI page shows), picked from a dropdown; the first tool's opens.
  // The Indonesian hub shows the Indonesian conversations only.
  const exItems = ID && items.some(x => x.own) ? items.filter(x => x.own) : items;
  const exGroups = groups.filter(g => exItems.some(x => x.domain === g));
  const exPick = `<div class="ai-ex-pick"><label for="aiExample">${W.exampleWith}</label>
        <select id="aiExample">${exGroups.map(g => `<optgroup label="${attr(W.domain(g))}">${inGroup(g, exItems).map(x => `<option value="${attr(x.T.tool)}"${x === exItems[0] ? ' selected' : ''}>${esc(x.title)}</option>`).join('')}</optgroup>`).join('')}</select></div>
`;
  const chats = exItems.map((x, i) => chatBlock(x.title, x.demo, x.rows, x.name, x.T.tool, i > 0, x.own ? 'id' : lang)).join('\n      ');
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: title, url, description: desc, inLanguage: lang,
        isPartOf: { '@type': 'WebSite', name: 'Adjie Brotools', url: SITE + '/' },
        mainEntity: { '@type': 'ItemList', numberOfItems: items.length,
          itemListElement: items.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: W.skillOf(x.title), url: aiUrl(x.T, x.own ? 'id' : 'en') })) } },
      { '@type': 'HowTo', name: W.hubHowTo, url: url + '#install', inLanguage: lang,
        step: [
          { '@type': 'HowToStep', name: W.hubPick, text: W.hubPickText },
          { '@type': 'HowToStep', name: W.stepInstall, text: W.stepInstallText },
          { '@type': 'HowToStep', name: W.stepAsk, text: W.hubAskText },
        ] },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: W.crumbHome, item: SITE + '/' + (ID ? 'id/' : '') },
        { '@type': 'ListItem', position: 2, name: W.crumbAi, item: url },
      ] },
    ],
  };
  const en = x => ID && !x.own;   // a link to an English page from the Indonesian hub
  const card = x => `        <li class="ai-tool card" data-domain="${attr(x.domain)}">
          <h3${en(x) ? ' lang="en"' : ''}>${x.glyph}${esc(x.title)}</h3>
          <p${x.aboutLang ? ` lang="${x.aboutLang}"` : ''}>${x.about}</p>
          <p class="ai-tool-skill"><code>${esc(x.name)}</code></p>
          <div class="ai-tool-btns">
            <a class="btn-sm btn-primary" href="${attr(ID ? x.ai : `../${x.T.tool}/ai/`)}"${en(x) ? ' hreflang="en"' : ''}>${W.getSkill}</a>
            <a class="btn-sm btn-theme" href="${attr(ID ? x.open : `../${x.T.tool}/`)}"${en(x) ? ' hreflang="en"' : ''}>${W.openTool}</a>${en(x) ? `
            ${W.enOnly}` : ''}
          </div>
        </li>`;
  const cards = groups.map(g => `      <h3 class="ai-group" data-domain="${attr(g)}">${esc(W.domain(g))}</h3>
      <ul class="ai-tools">
${inGroup(g).map(card).join('\n')}
      </ul>`).join('\n');
  return pageTop({ up, lang, alts, comment: 'from TOOLS and each tool\'s main page: edit those, then run it.', title, desc, url,
    image: SITE + '/og/' + (ID && existsSync(join(ROOT, 'og', 'home-id.jpg')) ? 'home-id' : 'home') + '.jpg', ld }) + `
  <nav class="gd-top" aria-label="${W.site}">
    <a class="btn-theme btn-back" href="${up}${ID ? 'id/' : ''}">${W.allTools}</a>
    <div class="gd-top-r">
      <a class="btn-primary gd-open gd-open-top" href="#tools">${W.pickSkill}</a>${alts ? `
      ${W.toggle}` : ''}
      <button class="btn-theme" id="themeToggle" type="button">${W.theme}</button>
    </div>
  </nav>

  <main>
    <header class="gd-hero">
      <h1>${keep(esc(W.hubTitle))}</h1>
      <div class="gd-hero-btns">
        <a class="btn-primary gd-open" href="#tools">${W.seeSkills(items.length)}</a>
        <a class="gd-skip" href="#install">${W.howInstall}</a>
      </div>
      <p class="ai-files">${W.hubFiles}</p>
    </header>

${installSection('brotools-<tool>.zip', 'brotools-<tool>', './', {}, lang)}

    <!-- In-article ad: between cards (.ad-slot in shared.css) -->
    <div class="ad-slot">
      <ins class="adsbygoogle" style="display:block; text-align:center;" data-ad-layout="in-article" data-ad-format="fluid" data-ad-client="ca-pub-8730116101825381" data-ad-slot="1433722275"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>

${useSection(null, null, null, null, exPick + '      ', chats, lang)}

    <section class="gd-sec card" id="tools" aria-labelledby="tools-h">
      <h2 id="tools-h">${W.toolsH}</h2>
      <p class="gd-sub">${W.toolsSub}</p>
      <div class="ai-filter">
        <label for="searchFilter" class="visually-hidden">${W.keyword}</label>
        <input id="searchFilter" name="search" type="search" placeholder="${W.searchPh}" autocomplete="off">
        <p class="ai-count" id="resultsSummary" aria-live="polite">${W.showing(items.length)}</p>
      </div>
${cards}
      <p class="ai-empty" hidden>${W.noMatch}</p>
    </section>

    <!-- Multiplex ad: before the closing buttons (.ad-slot in shared.css) -->
    <div class="ad-slot">
      <ins class="adsbygoogle" style="display:block" data-ad-format="autorelaxed" data-ad-client="ca-pub-8730116101825381" data-ad-slot="4659267360"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>

    <section class="gd-end">
      <p>${W.ready}</p>
      <a class="btn-primary gd-open" href="#tools">${W.pickSkill}</a>
      <a class="gd-skip" href="${up}${ID ? 'id/' : ''}">${W.seeAllTools}</a>
    </section>
  </main>

` + pageEnd(up, lang);
}
