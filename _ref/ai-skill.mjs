// The "Use in AI" pieces of each tool, written by _ref/agent-doc.mjs from the same model it
// reads off the pages (fields, Quick Starts, notes). Nothing here is hand-edited output.
//
// Per tool (TOOLS below), under <tool>/ai/:
//   index.html                 the page people see: download the skill, how to install it in
//                              Claude, ChatGPT and Grok (animated), a worked conversation, ads
//   <skill>.zip                the skill: one folder <skill>/ holding everything under skill/
//   skill/SKILL.md             what the assistant reads first (YAML name + description)
//   skill/references/<p>.md    one per page of the tool: every key, range, default, Quick
//                              Start and example (the text agent.txt used to carry)
//   skill/references/params.json  the same keys as data, read by the script
//   skill/scripts/build_link.py   builds and checks the #load link (source: _ref/ai-skill/)
// The unzipped skill/ folder is published too, so an assistant that browses can read it.
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
   use     when an assistant should reach for the skill (the YAML description's trigger) */
export const TOOLS = [
  { tool: 'rentvsownhouse', research: 'mortgage and loan rates, rents and prices, tax, duty and fee schedules, inflation, salaries and fees for the user\'s place and date (central banks, tax offices, statistics agencies, lenders)', main: 'rentvsownhouse', name: 'Rent vs Own',
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
  { tool: 'pscad-scripter', research: 'the PSCAD component definitions and parameter names (the tool\'s component reference), the grid code\'s fault ride-through curve or harmonic limits, and the user\'s case, component Names and output channel names as they gave them', main: 'pscad-scripter/builder', name: 'PSCAD Scripter',
    extra: 'Never write the PSCAD Python script yourself, not even part of it: the tool writes it from the link, and the user downloads it there.',
    use: 'writing PSCAD Python automation scripts (mhi.pscad, EMTDC): build and run a case, fault ride-through, critical clearing time, parameter sweeps over values, layers and substitution sets, harmonics and THD, snapshots and simulation sets, damping and control tuning, built as a workflow the tool turns into one ready-to-run script.' },
];

export const toolOf = page => page.split('/')[0];
export const skillName = T => 'brotools-' + T.tool;
// A page's reference file: rentvsownhouse/sensitivity/id -> rentvsownhouse-sensitivity-id.md
export const refName = page => page.replace(/\//g, '-') + '.md';
export const aiUrl = T => SITE + '/' + T.tool + '/ai/';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
  L.push('---', `name: ${name}`, `description: ${desc.replace(/\s+/g, ' ')}`, '---', '');
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
  return m ? m[1].replace(/\s(width|height|style)="[^"]*"/g, '').replace('<svg', '<svg width="1em" height="1em"') : '';
}

// A value as people read it: 800000 as 800,000.
const shown = v => /^(1[89]|2[0-2])\d\d$/.test(String(v)) ? String(v) : /^-?\d+(\.\d+)?$/.test(String(v)) ? Number(v).toLocaleString('en-US', { maximumFractionDigits: 4 }) : String(v);

// The demo conversation: the main page's "AI page example" notes section, else its Example.
function demoRows(M, demo) {
  const state = demo.state || {};
  const why = Object.fromEntries(demo.pairs.filter(([k]) => k.startsWith('why.')).map(([k, v]) => [k.slice(4), v]));
  const said = String(demo.request).replace(/[,$]/g, '');
  const rows = [];
  for (const [k, v] of demo.pairs) {
    if (k === 'v' || k === 'note' || k === 'json' || k === 'run' || k.startsWith('why.')) continue;
    const f = M.byKey[k];
    let label = k === 'qs' ? 'Quick Start' : f ? (f.label || k) : k;
    let value = k === 'qs' ? v : f && f.options ? ((f.options.find(o => o.value === v) || {}).label || v)
      : f && f.money && Number.isFinite(Number(v)) ? Number(v).toLocaleString('en-US', { maximumFractionDigits: 4 }) : shown(v);
    if (f && !f.options) {
      // A unit another field sets (setupCost with setupCostType): that field's choice, as it opens.
      const by = (f.pairs || []).map(x => M.byKey[x]).find(x => x && x.options);
      const opt = by && by.options.find(o => o.value === String(state[by.key]));
      if (opt) value = opt.label === '$' ? (f.prefix || '') + value : opt.label === '%' ? value + '%' : (f.prefix || '') + value + ' ' + opt.label;
      else {
        const unit = f.input === 'range' ? f.unit : f.suffix;
        if (unit) value += ' ' + unit;
        if (f.prefix) value = f.prefix + value;
      }
    }
    // Stated by the user: the value as written, as 180k or 1.2m, or a choice's words, in the request.
    const n = Number(v);
    const forms = [String(v)];
    if (Number.isFinite(n) && n >= 1000) forms.push(n / 1000 + 'k', n / 1e6 + 'm', n / 1e6 + ' million');
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

export function aiPage(T, models, demo) {
  const M = models.find(m => m.P.page === T.main) || models[0];
  const name = skillName(T);
  const zipName = name + '.zip';
  const url = aiUrl(T);
  const title = `Use ${T.name} in your AI`;
  const desc = `Download the ${T.name} skill for Claude, ChatGPT or Grok. Your AI researches the assumptions and sends one link that opens ${T.name} on your scenario.`;
  demo = { ...demo, link: canonicalLink(M.base, demo.pairs) };
  const rows = demoRows(M, demo);
  const guide = existsSync(join(ROOT, T.tool, 'guides', 'index.html'));
  const H = [];
  H.push(`<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Generated by _ref/agent-doc.mjs (_ref/ai-skill.mjs) from ${esc(M.P.notes)} and the tool itself: edit those, then run it. -->
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
  <script src="../../consent.js" defer></script>

<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)} | Adjie Brotools</title>
<meta name="description" content="${attr(desc)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${attr(url)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(desc)}">
<meta property="og:url" content="${attr(url)}">
<meta property="og:site_name" content="Adjie Brotot Tools">
<meta property="og:image" content="https://tool.adjiebrotots.com/og/${attr(T.tool)}.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${attr(title)}">
<meta name="twitter:description" content="${attr(desc)}">
<script type="application/ld+json">
${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'HowTo', name: title, url, description: desc, inLanguage: 'en',
    isPartOf: { '@type': 'WebApplication', name: T.name, url: SITE + '/' + T.tool + '/' },
    step: [
      { '@type': 'HowToStep', name: 'Download the skill', text: `Download ${zipName} from this page.` },
      { '@type': 'HowToStep', name: 'Install it in your AI', text: 'Upload the zip as a skill in Claude, ChatGPT or Grok and switch it on.' },
      { '@type': 'HowToStep', name: 'Ask your question', text: `Ask your question. The AI lists your inputs and its assumptions and sends a link that opens ${T.name} on your scenario.` },
    ],
  }, null, 2)}
</script>
<link rel="icon" type="image/svg+xml" href="../../logos/logo.svg">
<link rel="manifest" href="../../manifest.webmanifest">
<link rel="apple-touch-icon" href="../../logos/apple-touch-icon.png">
<script src="../../pwa.js" defer></script>
<link rel="preload" href="../../assets/fonts/dm-sans.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="../../fonts.css">
<link rel="stylesheet" href="../../dark.css">
<link rel="stylesheet" href="../../light.css">
<link rel="stylesheet" href="../../shared.css">
<link rel="stylesheet" href="../../guide-shared.css">
<link rel="stylesheet" href="../../ai-page.css">
</head>
<body class="light">
<!--email_off-->
<script src="../../theme.js"></script>
<div class="container gd ai">

  <nav class="gd-top" aria-label="Site">
    <a class="btn-theme btn-back" href="../">← ${esc(T.name)}</a>
    <div class="gd-top-r">
      <a class="btn-primary gd-open gd-open-top" href="${attr(zipName)}" download>Download skill</a>
      <button class="btn-theme" id="themeToggle" type="button">🌙 Dark</button>
    </div>
  </nav>

  <main>
    <header class="gd-hero">
      <h1>${glyph(T, M)}Use ${esc(T.name)} in your AI</h1>
      <p class="gd-lead">Install one skill in Claude, ChatGPT or Grok, then ask your question in plain words. Your AI looks up what you did not say, lists every assumption with its source, and replies with one link that opens ${esc(T.name)} on your scenario. The tool works out the answer, so the figures you see are the tool's, not the chatbot's.</p>
      <div class="gd-hero-btns">
        <a class="btn-primary gd-open ai-dl" href="${attr(zipName)}" download><span aria-hidden="true">⬇</span>&nbsp;Download ${esc(zipName)}</a>
        <a class="gd-skip" href="../">Open the tool</a>
      </div>
      <p class="ai-files">A .zip skill: <code>SKILL.md</code> (how to answer), <code>references/</code> (every input, its range and the Quick Starts) and <code>scripts/build_link.py</code> (builds and checks the link). <a href="skill/SKILL.md">Read SKILL.md</a></p>
    </header>

    <section class="gd-sec card" id="install" aria-labelledby="install-h">
      <h2 id="install-h">Install the skill</h2>
      <p class="gd-sub">Pick your assistant. The demo plays the steps; press a step to jump to it.</p>
      <div class="ai-install" data-zip="${attr(zipName)}" data-skill="${attr(name)}">
        <div class="ai-tabs" role="tablist" aria-label="Assistant">
          <button type="button" role="tab" class="ai-tab" data-app="claude" aria-selected="true">Claude</button>
          <button type="button" role="tab" class="ai-tab" data-app="chatgpt" aria-selected="false">ChatGPT</button>
          <button type="button" role="tab" class="ai-tab" data-app="grok" aria-selected="false">Grok</button>
        </div>
        <div class="gd-demo">
          <figure class="gd-screen">
            <div class="ai-stage" aria-hidden="true"></div>
            <div class="gd-bar"><span class="gd-cap ai-cap"></span><button type="button" class="btn-sm btn-theme ai-play">Pause</button></div>
          </figure>
          <ol class="gd-steps ai-steps"></ol>
        </div>
      </div>
      <p class="gd-note">Menus move as these apps update; look for <strong>Skills</strong> in Settings. Skills need the app's code tool switched on (Claude: <strong>Code execution and file creation</strong>). No skill support on your plan? Attach <code>${esc(zipName)}</code> or <a href="skill/SKILL.md">SKILL.md</a> to the chat and say "use this skill".</p>
    </section>

    <!-- In-article ad: between cards (.ad-slot in shared.css) -->
    <div class="ad-slot">
      <ins class="adsbygoogle" style="display:block; text-align:center;" data-ad-layout="in-article" data-ad-format="fluid" data-ad-client="ca-pub-8730116101825381" data-ad-slot="1433722275"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>

    <section class="gd-sec card" id="use" aria-labelledby="use-h">
      <h2 id="use-h">How to use it</h2>
      <p class="gd-sub">Ask as you would ask a friend. With the skill on, the AI keeps your figures, researches the rest, and hands you the link. It does not give the answer itself: the tool does, once you open the link.</p>
      <div class="ai-chat" aria-label="An example conversation">
        <div class="ai-msg ai-user"><p>${esc(demo.request)}</p></div>
        <div class="ai-work">
          <span class="ai-chip">Using skill <strong>${esc(name)}</strong></span>
          ${(demo.searches || []).map(s => `<span class="ai-chip">Searched: ${esc(s)}</span>`).join('\n          ')}
          <span class="ai-chip">Ran <code>scripts/build_link.py</code>: link checked</span>
        </div>
        <div class="ai-msg ai-bot">
          ${rows.some(r => r.user) ? `<h3>Your inputs</h3>
          <ul>${rows.filter(r => r.user).map(r => `<li>${esc(r.label)}: <strong>${esc(r.value)}</strong></li>`).join('')}</ul>` : ''}
          <h3>Assumptions</h3>
          <ol>${demo.assumptions.map(a => `<li>${esc(a)}</li>`).join('')}</ol>
          <h3>Your scenario</h3>
          <p><a class="ai-link" href="${attr(demo.link)}" target="_blank" rel="noopener">Open ${esc(T.name)} on this scenario</a></p>
          <pre class="ai-code"><code>${esc(demo.link)}</code></pre>
          <p><strong>Open the link to see the result.</strong></p>
        </div>
        <div class="ai-chat-bar"><button type="button" class="btn-sm btn-theme ai-replay">Replay</button><a class="btn-sm btn-primary" href="${attr(demo.link)}" target="_blank" rel="noopener">Open this scenario</a></div>
      </div>
      <ul class="gd-facts">
        <li><strong>Your figures stay yours.</strong> Anything you state goes in as you said it; correct any assumption and the AI sends a new link.</li>
        <li><strong>Checked before you see it.</strong> The skill's script checks every input's name, range and choices before the AI sends the link, so it opens the scenario listed.</li>
        <li><strong>The tool shows what the AI chose.</strong> When the link opens, a banner lists each value the AI set and why, with an Undo back to your own inputs.</li>
      </ul>
    </section>

    <!-- Multiplex ad: before the closing buttons (.ad-slot in shared.css) -->
    <div class="ad-slot">
      <ins class="adsbygoogle" style="display:block" data-ad-format="autorelaxed" data-ad-client="ca-pub-8730116101825381" data-ad-slot="4659267360"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>

    <section class="gd-end">
      <p>Ready to try it?</p>
      <a class="btn-primary gd-open" href="${attr(zipName)}" download>Download the skill</a>
      ${guide ? '<a class="gd-skip" href="../guides/">Read the guide</a>' : ''}
      <a class="gd-skip" href="../">Open the tool</a>
    </section>
  </main>

  <footer>
    <p class="footer-collab"><strong>A hobby project, open to collaboration.</strong> This tool is free to use. If your organisation could use a custom tool or training, <a href="mailto:hi@adjiebrotots.com?subject=Collaboration">let’s talk</a>. Bugs or questions: <a href="mailto:hi@adjiebrotots.com">hi@adjiebrotots.com</a> 🙂</p>
    <p class="footer-links"><a href="../../disclaimer/">Disclaimer</a> · <a href="../../privacy/">Privacy Policy</a> · <a href="https://blog.adjiebrotots.com/">Blog</a></p>
    <div class="gd-made">
      <img loading="lazy" src="../../logos/australian.png" alt="Australian flag" class="gd-flag">
      <div><img loading="lazy" src="../../logos/gpl.png" alt="GNU GPL"><span>Licensed under <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener">GNU GPL</a>, free to use, modify, and share with source code disclosed.</span></div>
      <div><img loading="lazy" src="../../logos/indonesian.png" alt="Indonesian badge"><span>Made in Australia by <a href="https://www.adjiebrotots.com/about/" rel="author">Adjie Brotosukmono</a>, an Indonesian engineer.</span></div>
    </div>
  </footer>
</div>
<script src="../../shared.js" defer></script>
<script src="../../ai-page.js" defer></script>
<!--/email_off-->
</body>
</html>
`);
  return H.join('\n');
}

/* ── llms.txt section ─────────────────────────────────────────────────────── */
export function llmsLines() {
  const L = [];
  for (const T of TOOLS) {
    L.push(`- ${T.name}: ${aiUrl(T)} (skill: ${aiUrl(T)}${skillName(T)}.zip; read directly: ${aiUrl(T)}skill/SKILL.md)`);
  }
  return L;
}
export { AI_RULES };
