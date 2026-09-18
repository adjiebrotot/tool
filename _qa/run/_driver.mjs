// Shared harness plumbing for phase 2 (execution).
//
// Runners drive the REAL pages. Third-party CDN scripts are stubbed because the
// sandbox has no access to them and because a chart library is not under test;
// the Chart.js stub records every config so plotted series can be inspected.
//
// A runner NEVER imports anything from _qa/plan/. It reads its contract, drives
// the page, and writes what it saw. Scoring happens elsewhere.
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const QA = join(REPO, '_qa');

const STUBS = `
window.__charts = [];
class Chart {
  constructor(ctx, cfg){ this.ctx=ctx; this.config=cfg; this.data=(cfg&&cfg.data)||{datasets:[]};
    this.options=(cfg&&cfg.options)||{}; this.scales={}; window.__charts.push(this); }
  update(){} destroy(){ const i=window.__charts.indexOf(this); if(i>=0) window.__charts.splice(i,1); }
  resetZoom(){} getDatasetMeta(){ return {data:[]}; } isDatasetVisible(){ return true; }
  toBase64Image(){ return 'data:image/png;base64,'; }
}
Chart.register=function(){}; Chart.defaults={font:{},plugins:{}}; Chart.registry={plugins:{items:[]}};
window.Chart=Chart;
window.__plotly=[];
window.Plotly={ newPlot:async(el,data,layout)=>{window.__plotly.push({data,layout});}, react:async(el,data,layout)=>{window.__plotly.push({data,layout});},
  relayout:async()=>{}, downloadImage:async()=>{}, toImage:async()=>'data:,', purge:()=>{} };
window.html2canvas = async () => ({ toDataURL: () => 'data:image/png;base64,' });
window.jspdf = { jsPDF: function(){ return { addImage(){}, save(){}, text(){}, addPage(){} }; } };
`;

/** Launch a browser + page with CDN stubbed. Returns {browser, page, errors}. */
export async function boot({ headless = true } = {}) {
  const browser = await pw.chromium.launch({ headless, args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.addInitScript(STUBS);
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith('file://') || url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) return route.continue();
    if (/\.css(\?|$)/.test(url)) return route.fulfill({ contentType: 'text/css', body: '' });
    return route.fulfill({ contentType: 'application/javascript', body: '/* cdn stubbed by _qa */' });
  });
  return { browser, page, errors };
}

/** Pages that fetch their own JSON need an origin. Serves the repo on 127.0.0.1. */
export async function serveRepo(port = 8712) {
  const proc = spawn('/opt/node22/bin/node', [
    '/opt/node22/lib/node_modules/http-server/bin/http-server', REPO, '-p', String(port), '-s', '-c-1'
  ], { stdio: 'ignore', detached: false });
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/index.html`); if (r.ok) break; } catch { }
    await new Promise(r => setTimeout(r, 200));
  }
  return { url: `http://127.0.0.1:${port}`, stop: () => { try { proc.kill('SIGKILL'); } catch { } } };
}

export const fileUrl = rel => pathToFileURL(join(REPO, rel)).href;

/** Read a contract file. Runners are allowed this and nothing else from _qa. */
export const contract = name => JSON.parse(readFileSync(join(QA, 'contract', `${name}.contract.json`), 'utf8'));

/** Parse a money/number string as rendered ("$1,234.56", "Rp 1.500.000", "−12%"). */
export function money(s) {
  if (s == null) return NaN;
  if (typeof s === 'number') return s;
  let t = String(s).replace(/[−–—]/g, '-').trim();
  const neg = /^\(.*\)$/.test(t) || t.startsWith('-');
  t = t.replace(/[()]/g, '');
  // Indonesian format uses . as the thousands separator and , as the decimal.
  const dots = (t.match(/\./g) || []).length, commas = (t.match(/,/g) || []).length;
  if (dots > 1 || (dots === 1 && commas === 1 && t.lastIndexOf(',') > t.lastIndexOf('.'))) {
    t = t.replace(/\./g, '').replace(',', '.');
  } else {
    t = t.replace(/,/g, '');
  }
  const n = parseFloat(t.replace(/[^0-9.eE+\-]/g, ''));
  if (!Number.isFinite(n)) return NaN;
  return neg && n > 0 ? -n : n;
}

/** Set an input/select by DOM id and fire the events a page listens for. */
export async function setById(page, id, value) {
  return page.evaluate(({ id, value }) => {
    const el = document.getElementById(id);
    if (!el) return { ok: false, reason: 'no such element: ' + id };
    const tag = el.tagName.toLowerCase();
    if (tag === 'select') {
      el.value = String(value);
      if (el.value !== String(value)) {
        const opt = [...el.options].find(o => o.textContent.trim() === String(value));
        if (opt) el.value = opt.value; else return { ok: false, reason: 'no option ' + value + ' on ' + id };
      }
    } else if (el.type === 'checkbox' || el.type === 'radio') {
      el.checked = !!value;
    } else {
      el.value = String(value);
    }
    for (const ev of ['input', 'change', 'blur']) el.dispatchEvent(new Event(ev, { bubbles: true }));
    return { ok: true, now: el.type === 'checkbox' ? el.checked : el.value };
  }, { id, value });
}

export async function textById(page, id) {
  return page.evaluate(id => { const el = document.getElementById(id); return el ? el.textContent.trim() : null; }, id);
}

export async function clickById(page, id) {
  return page.evaluate(id => { const el = document.getElementById(id); if (!el) return false; el.click(); return true; }, id);
}

/** Write the observed results for a tool. */
export function emit(tool, cases, extra = {}) {
  mkdirSync(join(QA, 'results'), { recursive: true });
  const out = { tool, ran_utc: new Date().toISOString(), ...extra, cases };
  writeFileSync(join(QA, 'results', `${tool}.actual.json`), JSON.stringify(out, null, 2));
  const n = Object.keys(cases).length;
  const bad = Object.values(cases).filter(c => c.error).length;
  console.log(`\n${tool}: executed ${n} case(s), ${bad} could not run -> _qa/results/${tool}.actual.json`);
}

/** Run one case body, capturing a throw as an error rather than losing the run. */
export async function runCase(bag, id, fn) {
  try { bag[id] = { observed: await fn() }; }
  catch (e) { bag[id] = { error: String(e && e.message || e) }; }
  const s = bag[id].error ? 'ERR ' : 'ran ';
  console.log(`  ${s} ${id}${bag[id].error ? '  ' + bag[id].error : ''}`);
  return bag[id];
}
