/* A saved scenario has to open to the same page.
   ---------------------------------------------------------------------------
   Every finance tool carries a floppy-disk and an open-folder button
   (SharedScenario in shared.js): the first writes every input on the page to a
   JSON file, the second reads one back, so a reader can close the tab tonight
   and carry on tomorrow. That promise is only as good as the round trip, and
   the easy way to break it is state that lives in JS rather than in a form
   control (a mode flag, a list of scenarios, edited tax brackets), which a
   snapshot of the form alone would silently drop.

   So for each page:

     A. load it clean, move it well away from its defaults (a Quick Start
        scenario where the tool has one, a handful of edits where it has not),
        snapshot it, and press save
     B. load it clean in a fresh browser, confirm it opened on something
        different, press open and hand it the file from A, snapshot it

   A and B must be identical: every field, every segmented control, and the
   answer the page draws from them. B is then reloaded, and has to come back
   the same again, because an opened file is also what the mini cache keeps.
   Finally a file saved by one tool is offered to another, which has to refuse
   it and leave its own state alone.

   Run: node _ref/scenario-check.mjs [path-fragment]
*/
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { createServer } from 'node:http';
import { readFile, mkdtemp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Each page, how to move it off its defaults, and where it draws its answer.
   `probe` is read as text, so a restored form that computes a different
   answer still shows up. */
const PAGES = [
  { path: 'borrowingcapacity/',        preset: 'couple',       probe: '.metrics' },
  { path: 'financialfreedom/',         preset: 'geoarbitrage', probe: '.metrics' },
  { path: 'financingvscash/',          preset: 'car',          probe: '#verdict' },
  { path: 'rentvsownhouse/',           preset: 'singapore',    probe: '.metrics' },
  { path: 'rentvsownhouse/id/',        preset: 'jakarta',      probe: '.metrics' },
  { path: 'pisahvsgabung/',            preset: 'double',       probe: '.metrics',
    also: `document.getElementById('ptkpDependent').value = '5,000,000';
           document.getElementById('ptkpDependent').dispatchEvent(new Event('input', {bubbles: true}));` },
  { path: 'pisahvsgabung/id/',         preset: 'single',       probe: '.metrics' },
  // The breakdown picker lists the results of the last run, which fails here
  // for want of market data; it is a view of the output, not an input.
  { path: 'dcasimulator/',             preset: 'equity-mmf',   probe: '#secList',  ignore: ['detailSelect'] },
  { path: 'dcasimulator/portfolio/',   preset: 'rebal-freq',   probe: '#pfList',   ignore: ['detailPfSelect'] },
  { path: 'costofliving-comparator/',  probe: '#analysisArea',
    also: `document.querySelector('#modeGroup .seg-btn[data-val="detailed"]').click();
           document.getElementById('swapCities').click();` },
  { path: 'rentvsownhouse/sensitivity/', probe: 'main',
    also: `var y = document.getElementById('yearInput'); y.value = '17';
           y.dispatchEvent(new Event('input', {bubbles: true})); y.dispatchEvent(new Event('change', {bubbles: true}));
           var c = document.getElementById('currencySelect'); c.selectedIndex = (c.selectedIndex + 1) % c.options.length;
           c.dispatchEvent(new Event('change', {bubbles: true}));` }
];

/* CDN libraries are stubbed so this runs offline; the pages only need Chart to
   exist, not to draw. Market data fetches fail, which the DCA pages report as
   a warning; the settings they hold are what is under test here. */
const STUB = `
class Chart {
  constructor(ctx, cfg){ this.config = cfg; this.data = (cfg && cfg.data) || {datasets: []};
    this.options = (cfg && cfg.options) || {}; this.scales = this.options.scales || {}; this._hidden = {}; }
  update(){} destroy(){} resetZoom(){} zoomScale(){} resize(){} stop(){}
  isDatasetVisible(i){ return !this._hidden[i]; }
  setDatasetVisibility(i, v){ this._hidden[i] = !v; }
  getDatasetMeta(){ return {data: [], hidden: false}; }
  toBase64Image(){ return ''; }
}
Chart.register = function(){}; Chart.Interaction = {modes: {}};
Chart.helpers = {getRelativePosition: function(e){ return e; }};
Chart.defaults = {font: {}, plugins: {legend: {}, tooltip: {}}};
window.Chart = Chart;
window.Plotly = {newPlot: async function(){}, react: async function(){}, relayout: async function(){}, purge: function(){}};`;

/* The state the reader can see: every form control with a handle, every
   segmented control that is on, and the page's answer. */
const SNAP = `() => {
  var out = {};
  document.querySelectorAll('input,select,textarea').forEach(function(el, i){
    if(el.type === 'file' || el.closest('[data-no-persist]')) return;
    var near = el.closest('[id]');
    var key = el.id || el.name || ((near ? near.id : '?') + '/' + el.className.split(' ')[0] + '#' + i);
    out[key] = (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value;
  });
  out['@on'] = Array.prototype.map.call(
    document.querySelectorAll('.seg-btn.active,.mode-btn.active,.seg.active,.toggle-btn.active'),
    function(b){ return (b.dataset.val || b.dataset.mode || b.textContent).trim(); }).join('|');
  var p = document.querySelector(PROBE);
  out['@probe'] = p ? p.innerText.replace(/\\s+/g, ' ').trim().slice(0, 1500) : '(no probe)';
  return out;
}`;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
                '.svg': 'image/svg+xml', '.png': 'image/png', '.csv': 'text/csv', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if(p.endsWith('/')) p += 'index.html';
  try {
    const body = await readFile(join(ROOT, p));
    res.writeHead(200, {'content-type': TYPES[extname(p)] || 'application/octet-stream'});
    res.end(body);
  } catch(e){ res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const TMP = await mkdtemp(join(tmpdir(), 'scenario-check-'));

const browser = await chromium.launch();
async function open(path){
  const ctx = await browser.newContext({acceptDownloads: true});
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => { page.__dialogs = (page.__dialogs || []).concat(d.message()); d.dismiss(); });
  await page.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await page.addInitScript(STUB);
  await page.goto(BASE + path, {waitUntil: 'load'});
  await settle(page);
  return { ctx, page, errors };
}
async function settle(page){
  await page.waitForTimeout(700);
  // The guided tour opens on a first visit and covers the page; step out of it.
  for(let i = 0; i < 3; i++){ await page.keyboard.press('Escape'); await page.waitForTimeout(80); }
}
const snap = (page, probe) => page.evaluate(`(${SNAP.replace('PROBE', JSON.stringify(probe))})()`);
function diff(a, b, ignore = []){
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter(k => !ignore.includes(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .map(k => `    ${k}: ${String(JSON.stringify(a[k])).slice(0, 120)}  →  ${String(JSON.stringify(b[k])).slice(0, 120)}`);
}
async function saveFile(page, name){
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.scenario-save')]);
  const file = join(TMP, name);
  await dl.saveAs(file);
  return file;
}
async function loadFile(page, file){
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('.scenario-load')]);
  await fc.setFiles(file);
  await page.waitForTimeout(900);
}

const only = process.argv[2];
let failed = 0;
const files = {};
for(const t of PAGES.filter(t => !only || t.path.includes(only))){
  const fails = [];
  const A = await open(t.path);
  if(!(await A.page.$('.scenario-save')) || !(await A.page.$('.scenario-load'))){
    console.log(`✗ ${t.path}: no save/open buttons`); failed++; await A.ctx.close(); continue;
  }
  const clean = await snap(A.page, t.probe);
  if(t.preset) await A.page.click(`.quick-start-btn[data-preset="${t.preset}"],.quick-start-btn[data-city="${t.preset}"]`);
  if(t.also) await A.page.evaluate(t.also);
  await A.page.waitForTimeout(900);
  const want = await snap(A.page, t.probe);
  if(!diff(clean, want).length) fails.push('moving off the defaults changed nothing, so the check proves nothing');
  const file = await saveFile(A.page, t.path.replace(/\W+/g, '_') + '.json');
  files[t.path] = file;
  await A.ctx.close();

  const B = await open(t.path);
  if(!diff(want, await snap(B.page, t.probe), t.ignore).length) fails.push('a fresh page already matches the saved one, so the check proves nothing');
  await loadFile(B.page, file);
  const got = await snap(B.page, t.probe);
  const d = diff(want, got, t.ignore);
  if(d.length) fails.push('opened file differs from the page that saved it:\n' + d.join('\n'));
  await B.page.reload({waitUntil: 'load'});
  await settle(B.page);
  const back = await snap(B.page, t.probe);
  const d2 = diff(want, back, t.ignore);
  if(d2.length) fails.push('a reload after opening lost the opened scenario:\n' + d2.join('\n'));
  if(B.errors.length) fails.push('page errors: ' + B.errors.join('; '));
  await B.ctx.close();

  if(fails.length){ failed++; console.log(`✗ ${t.path}\n  - ` + fails.join('\n  - ')); }
  else console.log(`✓ ${t.path}  (${Object.keys(want).length - 2} fields round-trip)`);
}

/* A file from one tool offered to another is refused, not half applied. */
if(!only && files['borrowingcapacity/']){
  const t = PAGES.find(p => p.path === 'financingvscash/');
  const C = await open(t.path);
  const before = await snap(C.page, t.probe);
  await loadFile(C.page, files['borrowingcapacity/']);
  const after = await snap(C.page, t.probe);
  const d = diff(before, after);
  if(d.length || !(C.page.__dialogs || []).length){
    failed++;
    console.log('✗ a borrowingcapacity file offered to financingvscash was not refused cleanly' + (d.length ? ':\n' + d.join('\n') : ' (no message)'));
  } else console.log('✓ a file from another tool is refused and changes nothing');
  await C.ctx.close();
}

await browser.close();
server.close();
console.log(failed ? `\n${failed} failing` : '\nall scenario files round-trip');
process.exit(failed ? 1 : 0);
