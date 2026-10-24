// Tests for the graph style (js/core/graphstyle.js, runtime/outputs.py, ui/graphstyle.js).
//
// Run from the repository root (D:\Repository\tool):
//   node powerfactory-scripter/builder/_audit/graphstyle/run.mjs
//
// What it proves:
//   (a) the rules: a saved style that is missing, partial, unknown or wrong never throws and
//       always gives a whole style (a key left out takes the Adjie Brotools value);
//   (b) the frozen handles (keys, select values, template and ramp ids) are still there;
//   (c) the page and the script agree: _PO_DEFAULT is the "brotools" template, the ramps, the
//       choices and the ranges are the same, Python's _po_st reads every case the way
//       normalizeStyle does, and the line colours match _po_colors;
//   (d) the generator writes GRAPH_STYLE only for a script that draws a graph, a workflow saved
//       before graph styles draws in the default, and GRAPH_STYLE edited in a .py is read back;
//   (e) the study package brings DM Sans when the graphs use it;
//   (f) matplotlib draws every template (PNG of the right size, transparent, SVG and PDF copies,
//       DM Sans picked up from a fonts folder beside the script), when matplotlib is installed;
//   (g) the page: the button in the workflow's settings and on a graph block, the modal, a
//       template, a choice, a colour, undo, Escape, phone width, no console errors (Playwright).
//
// Needs Python 3.12 as "python" (matplotlib for (f)); Playwright as the ui suite has it for (g).
// Prints "graph style tests: N passed, M failed" and exits 1 on any failure.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILDER = path.resolve(HERE, '..', '..');
const ROOT = path.resolve(BUILDER, '..', '..');
const imp = (rel) => import(pathToFileURL(path.join(BUILDER, rel)).href);

const G = await imp('js/core/graphstyle.js');
for (const f of ['start', 'flow', 'values', 'model', 'study', 'check', 'result', 'search', 'advanced']) await imp(`js/blocks/${f}.js`);
const W = await imp('js/core/workflow.js');
const { generate } = await imp('js/core/codegen.js');
const { RUNTIME_FILES } = await imp('js/core/runtime-loader.js');
const { needsGraphFonts, graphFontEntries, buildPackage, GRAPH_FONTS } = await imp('js/ui/package.js');
const { readZip } = await imp('js/core/zip.js');
const { baseReserved } = await imp('js/core/names.js');
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
const skipped = [];
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pfb-gs-'));

// A workflow from a Quick Start (frt draws graphs, ldf-cases does not).
const template = (id) => W.loadWorkflow(JSON.parse(fs.readFileSync(path.join(BUILDER, 'templates', id + '.json'), 'utf8'))).wf;

// Python with the runtime loaded the way the tests of the analysis half load it.
function python(code, args = []) {
  const script = path.join(TMP, 'py_' + Math.random().toString(36).slice(2) + '.py');
  fs.writeFileSync(script, [
    'import json, os, sys',
    'sys.path.insert(0, ' + JSON.stringify(path.join(BUILDER, '_audit', 'runtime', 'live')) + ')',
    'import loader',
    'LIB = loader.parse(["base.py", "signals.py", "outputs.py", "optimise.py"])',
    code,
  ].join('\n'));
  const r = spawnSync('python', [script, ...args], { encoding: 'utf8', cwd: TMP });
  const m = /<<JSON>>(.*)/.exec(r.stdout || '');
  if (!m) throw new Fail('python did not answer: ' + (r.stderr || r.stdout).slice(-1500));
  return JSON.parse(m[1]);
}
const hasPython = spawnSync('python', ['-c', 'print(1)'], { encoding: 'utf8' }).status === 0;
const hasMpl = hasPython && spawnSync('python', ['-c', 'import matplotlib, numpy'], { encoding: 'utf8' }).status === 0;

// ---------------------------------------------------------------------------------------------
// (a) The rules

await test('no style, junk and partial styles all give a whole style; never throws', () => {
  const d = G.defaultStyle();
  for (const junk of [undefined, null, 0, 'graph', [], [1, 2], true, { colors: 'red' }, { font_size: 'big' }]) {
    const s = G.normalizeStyle(junk);
    eq(Object.keys(s), G.STYLE_KEYS, 'every key, in order, for ' + JSON.stringify(junk));
  }
  eq(G.normalizeStyle(undefined), d, 'nothing is the default');
  eq(G.normalizeStyle({ legend: 'top' }), { ...d, legend: 'top' }, 'a key left out takes the default');
  eq(G.styleOf({ nodes: [] }), d, 'a workflow without `graph` (saved before graph styles) draws in the default');
});

await test('each value is checked: colours, numbers, choices, booleans, the font', () => {
  const d = G.defaultStyle();
  const s = G.normalizeStyle({
    background: '#abc', text: 'navy', grid: '#12345', axis: '#A1b2C3',
    font_size: 2, title_size: '15', line_width: true, dpi: 299.6, width: null,
    legend: 'somewhere', grid_axes: 'y', also_save: 'svg', ramp: 'rainbow',
    title_bold: 'yes', thousands: false, font: '  Calibri  ', template: 7,
    colors: ['#f00', 'blue', '#00FF00', 12], unknown_key: 1,
  });
  eq(s.background, '#AABBCC', '#RGB grows to #RRGGBB, upper case');
  eq([s.text, s.grid], [d.text, d.grid], 'a colour that is not hex keeps the default');
  eq(s.axis, '#A1B2C3', 'case of a hex code');
  eq(s.font_size, 5, 'a number below its range is brought up to it');
  eq(s.title_size, 15, 'a number written as text is read');
  eq([s.line_width, s.width], [d.line_width, d.width], 'true and null are not numbers');
  eq(s.dpi, 300, 'dpi is whole');
  eq([s.legend, s.grid_axes, s.also_save, s.ramp], [d.legend, 'y', 'svg', d.ramp], 'choices');
  eq([s.title_bold, s.thousands], [d.title_bold, false], 'booleans are strict');
  eq(s.font, 'Calibri', 'the font is trimmed');
  eq(s.template, d.template, 'a template that is not text keeps the default');
  eq(s.colors, ['#FF0000', '#00FF00'], 'line colours that are not hex are left out');
  ok(!('unknown_key' in s), 'a key this version does not know is dropped');
  eq(G.normalizeStyle({ colors: ['x'] }).colors, d.colors, 'no usable line colour keeps the default ones');
  eq(G.normalizeStyle({ colors: Array(20).fill('#111111') }).colors.length, G.MAX_COLORS, 'at most ' + G.MAX_COLORS + ' colours');
  eq(G.unusableKeys({ text: 'navy', font_size: 'big', legend: 'top', nope: 1, colors: ['#fff', 'x'] }).sort(), ['colors', 'font_size', 'text'], 'unusable keys are named');
});

await test('templates: whole, valid, distinct; names and matching', () => {
  const ids = G.TEMPLATES.map(t => t.id);
  eq(new Set(ids).size, ids.length, 'template ids are unique');
  eq(ids[0], G.DEFAULT_TEMPLATE, 'the default comes first');
  for (const t of G.TEMPLATES) {
    eq(Object.keys(t.style), G.STYLE_KEYS, t.id + ' has every key');
    eq(G.normalizeStyle(t.style), t.style, t.id + ' is already valid');
    eq(t.style.template, t.id, t.id + ' names itself');
    eq(G.matchTemplate(t.style).id, t.id, t.id + ' is found again');
    eq(G.styleName(t.style), t.name, 'the name of ' + t.id);
  }
  eq(G.styleName({ ...G.styleFromTemplate('report'), legend: 'none' }), 'Report, changed', 'a changed template');
  eq(G.styleName({ ...G.defaultStyle(), template: 'gone', dpi: 77 }), 'Your own style', 'a style from nowhere');
  eq(G.styleFromTemplate('no-such-template'), G.defaultStyle(), 'an unknown template id gives the default');
  eq(G.pixelsOf(G.defaultStyle()), [1500, 840], 'the default PNG size');
});

// ---------------------------------------------------------------------------------------------
// (b) Frozen handles: saved workflows, .py files and GRAPH_STYLE lines are keyed on these.

await test('frozen handles are still there', () => {
  const KEYS = ['template', 'colors', 'ramp', 'background', 'plot_background', 'text', 'muted', 'grid', 'axis', 'font',
    'font_size', 'title_size', 'title_bold', 'title_align', 'grid_axes', 'grid_style', 'frame', 'ticks', 'thousands',
    'line_width', 'markers', 'legend', 'legend_frame', 'width', 'height', 'dpi', 'transparent', 'also_save'];
  for (const k of KEYS) ok(G.STYLE_KEYS.includes(k), 'style key "' + k + '"');
  const CHOICES = {
    title_align: ['center', 'left'], grid_axes: ['both', 'y', 'x', 'none'], grid_style: ['solid', 'dashed', 'dotted'],
    frame: ['left-bottom', 'box', 'bottom', 'none'], ticks: ['out', 'in', 'none'], markers: ['auto', 'always', 'never'],
    legend: ['bottom', 'top', 'right', 'inside', 'none'], also_save: ['', 'svg', 'pdf'],
  };
  for (const [k, vals] of Object.entries(CHOICES)) for (const v of vals) ok(G.CHOICES[k].some(([x]) => x === v), k + ' value "' + v + '"');
  for (const id of ['brotools', 'brotools-night', 'minimal', 'report', 'slides', 'classic']) ok(G.templateById(id), 'template "' + id + '"');
  for (const id of ['blue', 'night', 'viridis', 'cividis', 'magma', 'coolwarm', 'greys', 'classic']) ok(G.RAMPS[id], 'ramp "' + id + '"');
  ok(baseReserved().has('GRAPH_STYLE'), 'GRAPH_STYLE is reserved, so a pinned setting never takes its name');
});

// ---------------------------------------------------------------------------------------------
// (c) The page and the script agree

const CASES = [
  undefined, {}, { legend: 'top', font: 'Arial' }, G.styleFromTemplate('report'), G.styleFromTemplate('brotools-night'),
  { background: '#abc', text: 'navy', grid: '#12345', font_size: 2, title_size: '15', line_width: true, dpi: 299.6,
    legend: 'somewhere', ramp: 'rainbow', title_bold: 'yes', thousands: false, font: '  Calibri  ', template: 7,
    colors: ['#f00', 'blue', '#00FF00', 12], unknown_key: 1, width: 1000, height: -3 },
  { colors: [], also_save: 'pdf', transparent: true, markers: 'never', ticks: 'none', frame: 'box' },
];

await test('Python reads every style the way the page does (_po_st = normalizeStyle)', () => {
  if (!hasPython) { skipped.push('python'); return; }
  const got = python([
    'out = []',
    'for case in json.loads(sys.argv[1]):',
    '    g = {"OUTPUT_DIR": ' + JSON.stringify(TMP) + '}',
    '    if case is not None:',
    '        g["GRAPH_STYLE"] = case',
    '    NS = loader.load(None, g, LIB)',
    '    out.append(NS["_po_st"]())',
    'NS = loader.load(None, {"OUTPUT_DIR": ' + JSON.stringify(TMP) + '}, LIB)',
    'print("<<JSON>>" + json.dumps({"cases": out, "default": NS["_PO_DEFAULT"], "ramps": NS["_PO_RAMPS"],',
    '      "choices": {k: list(v) for k, v in NS["_PO_CHOICES"].items()}, "ranges": {k: list(v) for k, v in NS["_PO_RANGES"].items()},',
    '      "hex": list(NS["_PO_HEX_KEYS"])}))',
  ].join('\n'), [JSON.stringify(CASES.map(c => (c === undefined ? null : c)))]);
  const num = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v)));
  eq(num(got.default), num(G.defaultStyle()), '_PO_DEFAULT is the brotools template');
  eq(got.ramps, Object.fromEntries(Object.entries(G.RAMPS).map(([k, r]) => [k, r.stops])), 'the ramps');
  eq(got.choices, Object.fromEntries(Object.entries(G.CHOICES).map(([k, v]) => [k, v.map(([x]) => x)])), 'the choices');
  eq(got.ranges, G.RANGES, 'the ranges');
  eq(got.hex, G.COLOR_KEYS, 'the colour keys');
  CASES.forEach((c, i) => eq(num(got.cases[i]), num(G.normalizeStyle(c)), 'case ' + i + ' ' + String(JSON.stringify(c)).slice(0, 80)));
});

await test('line colours: the page\'s preview and the script pick the same', () => {
  if (!hasPython) { skipped.push('python'); return; }
  const styles = G.TEMPLATES.map(t => t.style);
  const got = python([
    'out = []',
    'for st in json.loads(sys.argv[1]):',
    '    NS = loader.load(None, {"OUTPUT_DIR": ' + JSON.stringify(TMP) + ', "GRAPH_STYLE": st}, LIB)',
    '    NS["_PO"]["st"] = NS["_po_st"]()',
    '    out.append([NS["_po_colors"](n) for n in range(1, 31)])',
    'print("<<JSON>>" + json.dumps(out))',
  ].join('\n'), [JSON.stringify(styles)]);
  const rgb = (c) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  styles.forEach((st, si) => {
    for (let n = 1; n <= 30; n++) {
      const js = G.seriesColors(st, n), py = got[si][n - 1];
      eq(js.length, py.length, st.template + ' n=' + n);
      js.forEach((c, i) => ok(rgb(c).every((v, k) => Math.abs(v - rgb(py[i])[k]) <= 1), `${st.template} n=${n} line ${i}: ${c} vs ${py[i]}`));
    }
  });
});

// ---------------------------------------------------------------------------------------------
// (d) The generator and Open

const styleBlock = (code) => {
  const lines = code.split('\n');
  const a = lines.findIndex(l => l.startsWith('GRAPH_STYLE = {'));
  if (a < 0) return null;
  const b = lines.findIndex((l, i) => i > a && l.startsWith('}'));
  return { a, b, lines };
};

await test('GRAPH_STYLE is written in SETTINGS for a script that draws a graph, and only then', () => {
  const frt = gen(template('frt'));
  const blk = styleBlock(frt.code);
  ok(blk, 'frt draws graphs, so it has GRAPH_STYLE');
  const sA = blk.lines.findIndex(l => /^# ==== SETTINGS/.test(l)), sB = blk.lines.findIndex(l => /^# ==== WORKFLOW/.test(l));
  ok(blk.a > sA && blk.b < sB, 'inside SETTINGS (outside the hashed WORKFLOW section)');
  for (const k of G.STYLE_KEYS) ok(blk.lines.slice(blk.a, blk.b).some(l => l.startsWith('    "' + k + '": ')), 'a line for ' + k);
  ok(!/GRAPH_STYLE/.test(gen(template('ldf-cases')).code), 'ldf-cases draws no graph, so no GRAPH_STYLE');
});

await test('the style written is the workflow\'s, and an old workflow writes the default', () => {
  const wf = template('frt');
  ok(!('graph' in wf), 'a Quick Start carries no style');
  const def = gen(wf).code;
  ok(def.includes('    "template": "brotools",') && def.includes('    "font": "DM Sans",'), 'the default style');
  const mine = { ...wf, graph: { ...G.styleFromTemplate('report'), legend: 'right' } };
  const code = gen(mine).code;
  ok(code.includes('    "template": "report",') && code.includes('    "legend": "right",'), 'the workflow\'s own style');
  ok(code.includes('"graph":'), 'the # PFB1 line carries the style');
  if (hasPython) {
    const py = path.join(TMP, 'gs_compile.py');
    fs.writeFileSync(py, code);
    const r = spawnSync('python', ['-c', 'import ast,sys; ast.parse(open(sys.argv[1], encoding="utf-8").read())', py], { encoding: 'utf8' });
    ok(r.status === 0, 'the script compiles: ' + r.stderr);
  }
});

await test('a style a newer Builder saved keeps its unknown keys through load and save', () => {
  const wf = template('frt');
  const obj = W.serialize({ ...wf, graph: { ...G.defaultStyle(), corner_radius: 4 } });
  const back = W.loadWorkflow(JSON.parse(JSON.stringify(obj))).wf;
  eq(back.graph.corner_radius, 4, 'kept on load');
  eq(W.serialize(back).graph.corner_radius, 4, 'kept on save');
  eq(G.styleOf(back), G.defaultStyle(), 'and drawn with what this version knows');
});

await test('GRAPH_STYLE edited in a .py is read back on Open', () => {
  const code = gen(template('frt')).code;
  let r = W.loadWorkflow(code);
  ok(!('graph' in r.wf), 'an unedited file of a workflow without a style stays without one');
  ok(!r.notes.some(n => /GRAPH_STYLE/.test(n.msg)), 'and says nothing');
  r = W.loadWorkflow(code.replace('    "legend": "bottom",', '    "legend": "inside",').replace('    "dpi": 150,', '    "dpi": 300,'));
  eq([r.wf.graph.legend, r.wf.graph.dpi], ['inside', 300], 'edited values are read');
  ok(r.notes.some(n => n.level === 'info' && /GRAPH_STYLE/.test(n.msg)), 'with a note');
  r = W.loadWorkflow(code.replace('    "text": "#14203A",', '    "text": "dark blue",'));
  ok(r.notes.some(n => n.level === 'warning' && /text/.test(n.msg)), 'a value that cannot be used is named');
  eq(G.styleOf(r.wf).text, G.defaultStyle().text, 'and takes the default');
  r = W.loadWorkflow(code.replace('    "legend": "bottom",', '    "legend": bottom,'));
  ok(r.notes.some(n => n.level === 'warning' && /could not be read back/.test(n.msg)), 'a dict that does not read is said');
  ok(!('graph' in r.wf), 'and the workflow keeps its own style');
  // A workflow with a style: the .py written from it opens with the same style.
  const wf = { ...template('frt'), graph: G.styleFromTemplate('slides') };
  r = W.loadWorkflow(gen(wf).code);
  eq(G.styleOf(r.wf), G.styleFromTemplate('slides'), 'the style comes back from the # PFB1 line');
});

// ---------------------------------------------------------------------------------------------
// (e) The study package

await test('the study package brings DM Sans when the graphs are drawn in it', async () => {
  const wf = template('frt');
  const g = gen(wf);
  ok(needsGraphFonts(wf, g), 'frt draws in DM Sans');
  ok(!needsGraphFonts({ ...wf, graph: G.styleFromTemplate('report') }, g), 'not for Times New Roman');
  ok(!needsGraphFonts(template('ldf-cases'), gen(template('ldf-cases'))), 'not without graphs');
  const fetcher = async (u) => {
    const f = path.join(BUILDER, u);
    return fs.existsSync(f) ? { ok: true, arrayBuffer: async () => fs.readFileSync(f) } : { ok: false };
  };
  const ents = await graphFontEntries(fetcher);
  eq(ents.map(e => e.name), GRAPH_FONTS.map(f => 'fonts/' + f), 'every font file and the licence');
  const pkg = await buildPackage(wf, g, [], { fetch: fetcher });
  const back = await readZip(new Uint8Array(await pkg.blob.arrayBuffer()));
  for (const f of GRAPH_FONTS) ok(back.has('fonts/' + f), 'fonts/' + f + ' in the .zip');
  ok(/fonts\/\s+DM Sans/.test(new TextDecoder().decode(back.get('README.txt'))), 'the README says what the folder is');
  const none = await buildPackage(wf, g, [], { fetch: async () => { throw new Error('offline'); } });
  const back2 = await readZip(new Uint8Array(await none.blob.arrayBuffer()));
  ok(![...back2.keys()].some(k => k.startsWith('fonts/')), 'offline: no fonts, and still a package');
});

// ---------------------------------------------------------------------------------------------
// (f) matplotlib draws every template

await test('matplotlib draws every template: PNG size, transparency, SVG and PDF copies, DM Sans', () => {
  if (!hasMpl) { skipped.push('matplotlib'); return; }
  const fontsDir = path.join(TMP, 'fonts');
  fs.mkdirSync(fontsDir, { recursive: true });
  for (const f of GRAPH_FONTS) fs.copyFileSync(path.join(BUILDER, 'runtime', 'fonts', f), path.join(fontsDir, f));
  const styles = G.TEMPLATES.map(t => t.style).concat([
    { ...G.defaultStyle(), template: 'x-transparent', transparent: true, also_save: 'svg', legend: 'right' },
    { ...G.defaultStyle(), template: 'x-pdf', also_save: 'pdf', legend: 'top', title_align: 'left', grid_axes: 'none', frame: 'none', ticks: 'in' },
  ]);
  const got = python([
    'import math',
    'from PIL import Image',
    'out = []',
    'for st in json.loads(sys.argv[1]):',
    '    NS = loader.load(None, {"OUTPUT_DIR": os.getcwd(), "WORKFLOW_NAME": "gs_" + st["template"], "GRAPH_STYLE": st, "__file__": os.path.join(os.getcwd(), "study.py")}, LIB)',
    '    S = NS["Series"]',
    '    ts = [i * 0.05 for i in range(401)]',
    '    ser = [S(ts, [50 - 0.5 * (1 - math.exp(-max(0, t - 1) / (1 + k))) for t in ts], "Bus %d" % k, "Hz", [(1.0, "Trip")]) for k in range(3)]',
    '    files = [NS["plot_series"](ser, title="Frequency", ylabel="Frequency", limits=[(49.6, "Limit")], stem="s"),',
    '             NS["plot_series"](ser * 5, title="Many", stem="m"),',
    '             NS["plot_xy"](["A", "B", "C"], {"x": [1, 2, 3], "y": [2, 3, 1]}, kind="bar", title="Bars", stem="b"),',
    '             NS["plot_heatmap"]([1, 2, 1, 2], [1, 1, 2, 2], [1, 2, 3, 4], title="Heat", stem="h"),',
    '             NS["plot_3d"]([1, 2, 1, 2], [1, 1, 2, 2], [1, 2, 3, 4], title="Surface", stem="d")]',
    '    info = []',
    '    for f in files:',
    '        if not f:',
    '            info.append(None); continue',
    '        im = Image.open(f)',
    '        extra = [e for e in ("svg", "pdf") if os.path.exists(f[:-4] + "." + e)]',
    '        alpha = im.mode == "RGBA" and im.getextrema()[3][0] == 0',
    '        info.append({"size": list(im.size), "extra": extra, "clear": alpha})',
    '    out.append({"files": info, "family": NS["_po_family"](st["font"])[0], "errors": NS["_LOG"]["errors"]})',
    'print("<<JSON>>" + json.dumps(out))',
  ].join('\n'), [JSON.stringify(styles)]);
  styles.forEach((st, i) => {
    const r = got[i];
    eq(r.errors, 0, st.template + ': no graph failed');
    const want = G.pixelsOf(st);
    r.files.forEach((f, k) => {
      ok(f, st.template + ': graph ' + k + ' drawn');
      ok(Math.abs(f.size[0] - want[0]) <= 2 && Math.abs(f.size[1] - want[1]) <= 2, `${st.template}: graph ${k} is ${f.size} px, expected ${want}`);
      eq(f.extra, st.also_save ? [st.also_save] : [], st.template + ': copies beside graph ' + k);
      eq(f.clear, !!st.transparent, st.template + ': transparent background of graph ' + k);
    });
    if (st.font === 'DM Sans') eq(r.family, 'DM Sans', st.template + ': DM Sans from the fonts folder');
  });
});

// ---------------------------------------------------------------------------------------------
// (g) The page

let pw = null;
try { pw = (await import('file:///D:/opt/node22/lib/node_modules/playwright/index.js')).default; } catch (e) { pw = null; }

if (!pw) skipped.push('Playwright');
else {
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.py': 'text/plain', '.txt': 'text/plain', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json' };
  const server = createServer((req, res) => {
    const rel = path.normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    let file = path.join(ROOT, rel);
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const URL = 'http://127.0.0.1:' + server.address().port + '/powerfactory-scripter/builder/';
  const browser = await pw.chromium.launch();
  async function open(width, height) {
    const ctx = await browser.newContext({ viewport: { width, height } });
    // The guided tour waits for a first visit: this is not one.
    await ctx.addInitScript(() => { try { localStorage.setItem('pf-builder-tour-v1-seen', '1'); localStorage.setItem('abt-theme', 'light'); } catch (e) { /* no storage */ } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {
      if (m.type() !== 'error') return;
      // An off-site file this offline run refuses is not the page's error.
      const where = (m.location() && m.location().url) || '';
      if (/Failed to load resource/.test(m.text()) && where && !where.startsWith('http://127.0.0.1')) return;
      errors.push(m.text());
    });
    // Off-site requests are answered offline, as the repo's own checks do.
    await page.route(u => !u.href.startsWith('http://127.0.0.1'), r => (/\.(js|css)(\?|$)/.test(r.request().url()) ? r.fulfill({ status: 200, body: '' }) : r.abort()));
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForFunction(() => window.PFB && window.PFB.ready);
    await page.evaluate(() => PFB.runtimeReady);
    await page.evaluate(() => PFB.loadTemplate('frt', { quiet: true }));
    await page.evaluate(() => { PFB.select([]); if (PFB.isPhone()) PFB.setSheet(true); });
    await page.waitForTimeout(300);
    return { ctx, page, errors };
  }
  const state = (page) => page.evaluate(() => { PFB.flushGenerate(); return { graph: PFB.getWorkflow().graph || null, code: PFB.store.get().gen.code }; });

  await test('page: Graph style button in the workflow settings opens the modal; a template changes the script', async () => {
    const { ctx, page, errors } = await open(1440, 900);
    try {
      ok(await page.isVisible('#pfbInspector .pfb-gs-open'), 'the button is in the workflow\'s settings');
      eq((await page.textContent('#pfbInspector .pfb-gs-open-name')).trim(), 'Adjie Brotools', 'it names the default style');
      await page.click('#pfbInspector .pfb-gs-open');
      await page.waitForSelector('.pfb-gs-overlay:not([hidden])');
      ok(await page.isVisible('.pfb-gs-canvas svg'), 'a preview is drawn');
      for (const k of ['bars', 'many', 'heat', 'series']) {
        await page.click('.pfb-gs-kinds [data-kind="' + k + '"]');
        ok(await page.isVisible('.pfb-gs-canvas svg'), 'the ' + k + ' preview is drawn');
      }
      eq(await page.$$eval('.pfb-gs-tpl', b => b.map(x => x.dataset.tpl)), G.TEMPLATES.map(t => t.id), 'every template is offered');
      eq(await page.getAttribute('.pfb-gs-tpl[data-tpl="brotools"]', 'aria-pressed'), 'true', 'the default is marked');
      await page.click('.pfb-gs-tpl[data-tpl="report"]');
      let s = await state(page);
      eq(s.graph.template, 'report', 'the workflow holds the template');
      ok(s.code.includes('    "font": "Times New Roman",'), 'the script draws with it');
      await page.selectOption('.pfb-gs-form [data-key="legend"] select', 'right');
      s = await state(page);
      eq(s.graph.legend, 'right', 'a choice');
      eq((await page.textContent('.pfb-gs-name')).trim(), 'Report, changed', 'the modal says it was changed');
      const hex = await page.$('.pfb-gs-form [data-key="grid"] .pfb-gs-hex');
      await hex.fill('#ff8800'); await hex.press('Tab');
      eq((await state(page)).graph.grid, '#FF8800', 'a colour typed as a hex code');
      await page.keyboard.press('Control+z');
      eq((await state(page)).graph.grid, G.styleFromTemplate('report').grid, 'undo');
      eq(await page.inputValue('.pfb-gs-form [data-key="grid"] .pfb-gs-hex'), G.styleFromTemplate('report').grid, 'and the form follows it');
      await page.keyboard.press('Escape');
      ok(await page.evaluate(() => document.querySelector('.pfb-gs-overlay').hidden), 'Escape closes it');
      eq((await state(page)).graph.legend, 'right', 'and keeps the changes');
      eq((await page.textContent('#pfbInspector .pfb-gs-open-name')).trim(), 'Report, changed', 'the button names the style');
      ok(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('pfb-gs-open')), 'the focus goes back to the button');
      // The site's button rules (_ref/button-check.mjs) on the open modal.
      await page.click('#pfbInspector .pfb-gs-open');
      await page.waitForSelector('.pfb-gs-overlay:not([hidden])');
      const bad = await page.evaluate(() => {
        const out = [];
        for (const b of document.querySelectorAll('.pfb-gs-overlay button')) {
          const ico = [...b.querySelectorAll('svg.ico')].map(x => ([...x.classList].find(c => c.startsWith('ico-')) || '').slice(4));
          const text = (b.textContent || '').replace(/\s+/g, ' ').trim();
          const name = (b.getAttribute('aria-label') || b.getAttribute('title') || text).trim();
          if (!text && !b.getAttribute('aria-label') && !b.getAttribute('title')) out.push('icon-only without a name');
          if (ico.includes('close') && !/\b(close)\b/i.test(name)) out.push('cross not on a close: ' + name);
          if (ico.includes('trash') && !/\b(remove|delete|clear)\b/i.test(name)) out.push('bin on something else: ' + name);
          if (/[\u2715\u00d7\u2716]/.test(text)) out.push('cross as text: ' + name);
        }
        return out;
      });
      eq(bad, [], 'the modal\'s buttons keep the site\'s picture rules');
      await page.click('.pfb-gs-foot .btn-primary');
      ok(await page.evaluate(() => document.querySelector('.pfb-gs-overlay').hidden), 'Done closes it');
      // A graph block shows the style too.
      const plot = await page.evaluate(() => PFB.store.get().wf.nodes.find(n => /^out\.plot\./.test(n.type)) || null);
      if (plot) {
        await page.evaluate((id) => PFB.select([id]), plot.id);
        await page.waitForTimeout(200);
        ok(await page.isVisible('#pfbInspector .pfb-gs-open'), 'a graph block offers the style');
      }
      eq(errors, [], 'no console errors');
    } finally { await ctx.close(); }
  });

  await test('page: the modal at phone width (no sideways scroll, Done in view)', async () => {
    const { ctx, page, errors } = await open(375, 812);
    try {
      await page.evaluate(() => PFB.openGraphStyle());
      await page.waitForSelector('.pfb-gs-overlay:not([hidden])');
      await page.waitForTimeout(300);
      const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth,
        dlg: document.querySelector('.pfb-gs').getBoundingClientRect().right,
        done: document.querySelector('.pfb-gs-foot .btn-primary').getBoundingClientRect().bottom, h: window.innerHeight }));
      ok(m.sw <= m.w, 'no sideways scroll: ' + JSON.stringify(m));
      ok(m.dlg <= m.w + 1, 'the modal fits the width');
      ok(m.done <= m.h, 'Done is on screen');
      await page.click('.pfb-gs-tpl[data-tpl="slides"]');
      eq((await state(page)).graph.template, 'slides', 'a template at phone width');
      eq(errors, [], 'no console errors');
    } finally { await ctx.close(); }
  });

  await browser.close();
  server.close();
}

// ---------------------------------------------------------------------------------------------

fs.rmSync(TMP, { recursive: true, force: true });
for (const r of results) console.log((r.ok ? '  PASS  ' : '\u2717 FAIL  ') + r.name + (r.ok ? '' : '\n    ' + String(r.msg).split('\n').join('\n    ')));
if (skipped.length) console.log('Skipped (not installed): ' + [...new Set(skipped)].join(', ') + '.');
const bad = results.filter(r => !r.ok).length;
console.log(`graph style tests: ${results.length - bad} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
