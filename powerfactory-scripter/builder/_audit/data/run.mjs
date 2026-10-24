// Tests for reading a case table in the page (js/core/tabledata.js) and for the .zip the
// Download button writes (js/core/zip.js).
//
// Run from the repository root (D:\Repository\tool):
//   node powerfactory-scripter/builder/_audit/data/run.mjs
//
// What it proves:
//   (a) the page reads a CSV, a semicolon CSV with decimal commas and an .xlsx the same way
//       runtime/base.py read_table does, so the columns the page offers are the ones the run
//       writes. The same fixtures are read by Python with read_table and the two are compared.
//   (b) a .zip written by zip.js is read back by Python's zipfile (a real unpacker).
//
// Needs Python 3.12 as "python" with openpyxl (the fixtures are made by make_fixtures.py).

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILDER = path.resolve(HERE, '..', '..');
const imp = (rel) => import(pathToFileURL(path.join(BUILDER, rel)).href);

const { describeFile, parseCsvGrid, tableFromGrid, guessSeparator, cellValue } = await imp('js/core/tabledata.js');
const { makeZip, readZip, crc32 } = await imp('js/core/zip.js');
for (const f of ['start', 'flow', 'values', 'model', 'study', 'check', 'result', 'search', 'advanced']) await imp(`js/blocks/${f}.js`);
const { loadWorkflow, serialize, embedInPython, extractFromPython } = await imp('js/core/workflow.js');
const { generate } = await imp('js/core/codegen.js');
const { RUNTIME_FILES } = await imp('js/core/runtime-loader.js');
const RUNTIME = {};
for (const f of RUNTIME_FILES) {
  const rp = path.join(BUILDER, 'runtime', f);
  if (fs.existsSync(rp)) RUNTIME[f] = fs.readFileSync(rp, 'utf8');
}
const gen = (wf) => generate(wf, { runtime: RUNTIME });

const results = [];
class Fail extends Error {}
const ok = (cond, msg) => { if (!cond) throw new Fail(msg || 'expected true'); };
const eq = (a, b, msg) => { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Fail(`${msg || 'value'}:\n  got      ${x}\n  expected ${y}`); };
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, msg: e instanceof Fail ? e.message : (e && e.stack) || String(e) }); }
}

const bytesOf = (name) => new Uint8Array(fs.readFileSync(path.join(HERE, name)));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pfb-data-'));

// ---------------------------------------------------------------------------------------------
// What Python makes of the same files, through the real runtime helper.

function pythonRead(args) {
  const base = fs.readFileSync(path.join(BUILDER, 'runtime', 'base.py'), 'utf8');
  // The runtime files name their imports in "# @imports" markers (the generator collects them),
  // so the whole file only runs with those lines put back in front of it.
  const imports = [...new Set((base.match(/^# @imports (.+)$/gm) || []).map(l => l.slice(11).trim()))];
  const script = path.join(TMP, 'read.py');
  fs.writeFileSync(script, [
    'import json, sys',
    ...imports,
    base,
    'args = json.loads(sys.argv[1])',
    'out = []',
    'for a in args:',
    '    t = read_table(a["name"], a["path"], sheet=a.get("sheet", ""), layout=a.get("layout", "rows"),',
    '                   header=a.get("header", 1), decimal_comma=a.get("decimal_comma", False))',
    '    out.append({"columns": list(t.columns), "rows": [dict(r) for r in t.rows]})',
    'print("<<JSON>>" + json.dumps(out))',
  ].join('\n'));
  const r = spawnSync('python', ['-I', script, JSON.stringify(args)], { encoding: 'utf8' });
  const m = /<<JSON>>(.*)/.exec(r.stdout || '');
  if (!m) throw new Error('python read failed: ' + (r.stderr || r.stdout || r.error));
  return JSON.parse(m[1]);
}

// The page keeps empty cells as null and Python as None: the same thing once through JSON.
const shape = (t) => ({ columns: t.columns, rows: t.rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === undefined ? null : v]))) });

// ---------------------------------------------------------------------------------------------

await test('a CSV: the header row names the columns, quotes and blank rows follow read_table', async () => {
  const d = await describeFile('cases.csv', bytesOf('cases.csv'), {});
  eq(d.columns, ['Case', 'Generator', 'P (MW)', 'Q (Mvar)', 'Note'], 'columns');
  eq(d.count, 3, 'rows (the blank line is left out)');
  eq(d.rows[0], { Case: 'Summer peak', Generator: 'G 01', 'P (MW)': 120.5, 'Q (Mvar)': 30, Note: 'a, with comma' }, 'first row');
  eq(d.rows[1].Note, '007', 'a code keeps its leading zero as text');
  eq(d.rows[2], { Case: 'Shoulder', Generator: 'G 03', 'P (MW)': 80, 'Q (Mvar)': 0, Note: null }, 'last row');
});

await test('a semicolon CSV with decimal commas', async () => {
  ok(guessSeparator('Case;P (MW);Q (Mvar)') === ';', 'separator');
  const d = await describeFile('cases_semicolon.csv', bytesOf('cases_semicolon.csv'), { decimalComma: true });
  eq(d.columns, ['Case', 'P (MW)', 'Q (Mvar)'], 'columns');
  eq(d.rows, [{ Case: 'A', 'P (MW)': 120.5, 'Q (Mvar)': 30.25 }, { Case: 'B', 'P (MW)': 40, 'Q (Mvar)': -5.5 }], 'rows');
});

await test('an .xlsx: the named sheet, a header row further down, numbers as numbers', async () => {
  const d = await describeFile('cases.xlsx', bytesOf('cases.xlsx'), { sheet: 'Dispatch', header: 2 });
  eq(d.sheets, ['Notes', 'Dispatch'], 'sheet names, in the workbook\'s order');
  eq(d.sheet, 'Dispatch', 'the sheet read');
  eq(d.columns, ['Case', 'G 01 (MW)', 'G 02 (MW)', 'Scale'], 'columns');
  eq(d.rows, [
    { Case: 'Max', 'G 01 (MW)': 150, 'G 02 (MW)': 90, Scale: 1 },
    { Case: 'Min', 'G 01 (MW)': 20, 'G 02 (MW)': 0, Scale: 0.5 },
    { Case: 'Mid', 'G 01 (MW)': 85, 'G 02 (MW)': 45, Scale: 0.75 },
  ], 'rows (the empty row is left out)');
});

await test('the first sheet is read when none is named, and a sheet that is not there says so', async () => {
  const d = await describeFile('cases.xlsx', bytesOf('cases.xlsx'), {});
  eq(d.sheet, 'Notes', 'the first sheet');
  let said = '';
  try { await describeFile('cases.xlsx', bytesOf('cases.xlsx'), { sheet: 'Nope' }); } catch (e) { said = e.message; }
  ok(/no sheet called "Nope"/.test(said) && /"Notes", "Dispatch"/.test(said), said);
});

await test('one case per column (the layout the block calls "columns")', async () => {
  const grid = parseCsvGrid('Name,A,B\nP (MW),10,20\nQ (Mvar),1,2\n');
  const t = tableFromGrid(grid, { layout: 'columns', header: 1 });
  eq(t.columns, ['Name', 'P (MW)', 'Q (Mvar)'], 'columns');
  eq(t.rows, [{ Name: 'A', 'P (MW)': 10, 'Q (Mvar)': 1 }, { Name: 'B', 'P (MW)': 20, 'Q (Mvar)': 2 }], 'rows');
});

await test('an old .xls says what to do instead', async () => {
  let said = '';
  try { await describeFile('cases.xls', new Uint8Array([1, 2, 3]), {}); } catch (e) { said = e.message; }
  ok(/old \.xls file/.test(said) && /Save it as \.xlsx/.test(said), said);
});

await test('two columns with the same name: the second becomes "Name (2)"', async () => {
  const t = tableFromGrid(parseCsvGrid('P,P,Q\n1,2,3\n'), {});
  eq(t.columns, ['P', 'P (2)', 'Q'], 'columns');
  eq(t.rows[0], { P: 1, 'P (2)': 2, Q: 3 }, 'row');
});

await test('a cell is read as read_table reads it', () => {
  eq([cellValue('', false), cellValue(' 12 ', false), cellValue('007', false), cellValue('1.5e3', false), cellValue('x', false), cellValue('1,5', true), cellValue('1 234', false)],
    [null, 12, '007', 1500, 'x', 1.5, 1234], 'values');
});

await test('the page and PowerFactory\'s own Python read the same files the same way', () => {
  const py = pythonRead([
    { name: 'A', path: path.join(HERE, 'cases.csv') },
    { name: 'B', path: path.join(HERE, 'cases_semicolon.csv'), decimal_comma: true },
    { name: 'C', path: path.join(HERE, 'cases.xlsx'), sheet: 'Dispatch', header: 2 },
  ]);
  return Promise.all([
    describeFile('cases.csv', bytesOf('cases.csv'), {}),
    describeFile('cases_semicolon.csv', bytesOf('cases_semicolon.csv'), { decimalComma: true }),
    describeFile('cases.xlsx', bytesOf('cases.xlsx'), { sheet: 'Dispatch', header: 2 }),
  ]).then(([a, b, c]) => {
    eq(shape(a), py[0], 'cases.csv');
    eq(shape(b), py[1], 'cases_semicolon.csv');
    eq(shape(c), py[2], 'cases.xlsx');
  });
});

// ---------------------------------------------------------------------------------------------
// A workflow saved before a file could be attached

// Exactly what the Builder wrote before this change: a typed path, no `src`, no `wf.files`.
const OLD = {
  app: 'pf-builder', v: 1, name: 'Old case table',
  nodes: [
    { id: 'n1', type: 'start', x: 0, y: 0, label: '', s: { project: 'Nine-bus System' }, pin: [] },
    { id: 'n2', type: 'data.read', x: 200, y: 0, label: '', s: { table: 'Cases', path: 'C:\\Studies\\cases.xlsx', sheet: 'Dispatch', layout: 'rows', header: 2, decimalComma: false }, pin: ['path'] },
    { id: 'n3', type: 'out.table.column', x: 400, y: 0, label: '', s: { table: 'Cases', col: 'P (MW)' }, pin: [] },
  ],
  edges: [{ id: 'e1', from: 'n1', out: 'next', to: 'n2', in: 'in' }],
  view: { x: 0, y: 0, zoom: 1 },
};

await test('a workflow saved before files could be attached still writes the same script', () => {
  const { wf, notes } = loadWorkflow(JSON.parse(JSON.stringify(OLD)));
  ok(wf, 'it loads: ' + JSON.stringify(notes));
  ok(!notes.some(n => n.level === 'error'), 'with no error: ' + JSON.stringify(notes));
  const g = gen(wf);
  ok(!(g.problems || []).some(p => p.level === 'error'), JSON.stringify(g.problems));
  // The file it names is still the file it reads, with the sheet and the header row it had.
  const line = (g.code.match(/^.*read_table\(.*$/m) || [''])[0];
  ok(/read_table\("Cases", [A-Z_]+, sheet="Dispatch", layout="rows", header=2, decimal_comma=False\)/.test(line), 'the call is unchanged: ' + line);
  // Its pinned path is still a SETTINGS line the reader can edit in the .py.
  ok(g.code.includes(String.raw`= r"C:\Studies\cases.xlsx"`), 'the pinned path is still at the top of the script');
  // And the block still asks for nothing (the file is named, so there is no to-do).
  ok(!(g.problems || []).some(p => p.level === 'todo'), JSON.stringify(g.problems));
  // The new setting took its default and says "no file attached".
  eq(wf.nodes[1].s.src, { name: '', size: 0, sheet: '', sheets: [], cols: [], rows: 0, sig: '' }, 'src default');
});

await test('an attached file travels in the .json and never in the .py', () => {
  const withFile = {
    ...OLD,
    nodes: OLD.nodes.map(n => (n.id === 'n2' ? { ...n, s: { ...n.s, path: 'cases.csv', src: { name: 'cases.csv', size: 12, sheet: '', sheets: [], cols: ['Case', 'P (MW)'], rows: 2, sig: '|rows|1|0' } } } : n)),
    files: { n2: { name: 'cases.csv', mime: 'text/csv', b64: 'Q2FzZSxQIChNVyk=' } },
  };
  const { wf } = loadWorkflow(JSON.parse(JSON.stringify(withFile)));
  ok(wf && wf.files && wf.files.n2, 'the file comes back from a .json');
  const saved = serialize({ ...wf, view: { x: 0, y: 0, zoom: 1 } });
  eq(saved.files, withFile.files, 'and is saved again');
  const py = embedInPython(gen(wf).code, wf, {});
  const pfb1 = (py.match(/^# PFB1 .*$/m) || [''])[0];
  ok(!pfb1.includes('b64') && !pfb1.includes('"files"'), 'the .py carries no file: ' + pfb1.slice(0, 200));
  ok(pfb1.includes('"cols"'), 'but it keeps the columns, so Open still knows them');
  // Opening that .py gives the workflow back, without the file.
  const back = loadWorkflow(extractFromPython(py));
  ok(back.wf && !back.wf.files, 'a .py opens with no attached file');
  eq(back.wf.nodes[1].s.src.cols, ['Case', 'P (MW)'], 'and the columns are still known');
});

// ---------------------------------------------------------------------------------------------
// The study package

await test('a .zip written here is read back by Python\'s own zipfile', async () => {
  const big = 'P (MW),Q (Mvar)\n' + Array.from({ length: 400 }, (_, k) => `${k},${k * 2}`).join('\n') + '\n';
  const blob = await makeZip([
    { name: 'study.py', text: '# a script\nprint("hi")\n' },
    { name: 'study.json', text: '{"app":"pf-builder"}\n' },
    { name: 'cases.xlsx', bytes: bytesOf('cases.xlsx') },
    { name: 'big.csv', text: big },
    { name: 'README.txt', text: 'How to run it\n' },
  ]);
  const zipPath = path.join(TMP, 'package.zip');
  fs.writeFileSync(zipPath, Buffer.from(await blob.arrayBuffer()));
  const script = path.join(TMP, 'unzip.py');
  fs.writeFileSync(script, [
    'import json, sys, zipfile',
    'z = zipfile.ZipFile(sys.argv[1])',
    'bad = z.testzip()',
    'out = {"bad": bad, "names": sorted(z.namelist()),',
    '       "py": z.read("study.py").decode(), "csv_len": len(z.read("big.csv")),',
    '       "xlsx": len(z.read("cases.xlsx")),',
    '       "packed": sorted({i.compress_type for i in z.infolist()})}',
    'print("<<JSON>>" + json.dumps(out))',
  ].join('\n'));
  const r = spawnSync('python', ['-I', script, zipPath], { encoding: 'utf8' });
  const m = /<<JSON>>(.*)/.exec(r.stdout || '');
  ok(m, 'python could not open the zip: ' + (r.stderr || r.stdout));
  const got = JSON.parse(m[1]);
  ok(got.bad === null, 'a damaged entry: ' + got.bad);
  eq(got.names, ['README.txt', 'big.csv', 'cases.xlsx', 'study.json', 'study.py'], 'names');
  eq(got.py, '# a script\nprint("hi")\n', 'the script comes back as it went in');
  eq(got.csv_len, big.length, 'the big file comes back whole');
  eq(got.xlsx, bytesOf('cases.xlsx').length, 'the workbook comes back whole');
  ok(got.packed.includes(8), 'the big files are deflated: ' + JSON.stringify(got.packed));
  // And back through our own reader.
  const back = await readZip(new Uint8Array(fs.readFileSync(zipPath)));
  eq([...back.keys()].sort(), ['README.txt', 'big.csv', 'cases.xlsx', 'study.json', 'study.py'], 'read back here');
  eq(new TextDecoder().decode(back.get('big.csv')), big, 'the big file reads back here too');
});

await test('CRC-32 matches the known value of "123456789"', () => {
  eq(crc32(new TextEncoder().encode('123456789')), 0xCBF43926, 'crc');
});

// ---------------------------------------------------------------------------------------------

fs.rmSync(TMP, { recursive: true, force: true });
for (const r of results) console.log((r.ok ? '  PASS  ' : '\u2717 FAIL  ') + r.name + (r.ok ? '' : '\n    ' + String(r.msg).split('\n').join('\n    ')));
const bad = results.filter(r => !r.ok).length;
console.log(`data tests: ${results.length - bad} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
