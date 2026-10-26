// Shared helpers for recording a tool's guide (<tool>/guides/) from the REAL tool with Playwright:
// a static server, a page with a visible cursor, smooth pointer moves, and video trimming and
// encoding with ffmpeg. The PowerFactory Builder's guide has its own copy
// (powerfactory-scripter/guides/_capture/lib.mjs); this one is the same recorder for the tools
// that load their charts from a CDN. Run a tool's captures with run.mjs.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { existsSync, statSync, createReadStream, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, normalize, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import os from 'node:os';

const require = createRequire(import.meta.url);
export const pw = require('playwright');

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '..', '..');                // the repo root
export const W = 1280, H = 720;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.txt': 'text/plain', '.csv': 'text/csv', '.woff2': 'font/woff2', '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json', '.xml': 'application/xml' };

export async function serve() {
  const server = createServer((req, res) => {
    const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    let file = join(ROOT, rel);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { server, origin: 'http://127.0.0.1:' + server.address().port };
}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// The libraries the tools take from cdnjs (Chart.js and its zoom plugin, Hammer, SheetJS), fetched
// once with curl and served from here, so the clips show the page as a reader sees it. Anything
// else from outside (analytics, fonts) is refused.
const cdnCache = new Map();
function cdn(url) {
  if (!/^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\//.test(url)) return null;
  if (!cdnCache.has(url)) {
    const f = join(os.tmpdir(), 'guide-cdn-' + url.replace(/^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\//, '').replace(/[^\w.-]+/g, '_'));
    if (!existsSync(f)) spawnSync('curl', ['-sS', '-m', '60', '-o', f, url]);
    cdnCache.set(url, existsSync(f) && statSync(f).size > 1000 ? readFileSync(f) : null);
  }
  return cdnCache.get(url);
}

// The cursor drawn into the recorded page only (a headless browser records none of its own).
const CURSOR = `(() => {
  const mk = () => {
    if (document.getElementById('gcur')) return;
    const c = document.createElement('div');
    c.id = 'gcur';
    c.innerHTML = '<svg width="22" height="26" viewBox="0 0 14 21" style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))"><path d="M0 0V17.5L4.6 13.4L7.6 20.2L10.6 18.9L7.7 12.2H13.6Z" fill="#fff" stroke="#14203A" stroke-width="1.2" stroke-linejoin="round"/></svg>';
    c.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);will-change:transform';
    const r = document.createElement('div');
    r.id = 'gring';
    r.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483646;pointer-events:none;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid #3A71C8;opacity:0;transform:translate(-100px,-100px) scale(.4)';
    document.documentElement.appendChild(r);
    document.documentElement.appendChild(c);
    window.addEventListener('mousemove', e => { c.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; }, true);
    window.addEventListener('mousedown', e => {
      r.style.transition = 'none'; r.style.opacity = '.9'; r.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px) scale(.4)';
      requestAnimationFrame(() => requestAnimationFrame(() => { r.style.transition = 'transform .35s ease-out, opacity .45s ease-out'; r.style.opacity = '0'; r.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px) scale(1.15)'; }));
    }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mk); else mk();
})();`;

// A scene: opens the tool in a theme, records the video, exposes the helpers.
//   tool: { path: '/loadflow-simulator/', seen: ['loadflow-tour-v1-seen'], ready: async (page) => {} }
export async function openScene(browser, origin, theme, tool, opts = {}) {
  const rawDir = mkdtempSync(join(os.tmpdir(), 'guide-raw-'));
  const w = opts.w || W, h = opts.h || H;
  const ctx = await browser.newContext({
    viewport: { width: w, height: h }, deviceScaleFactor: 1, acceptDownloads: true, colorScheme: theme,
    ...(opts.record === false ? {} : { recordVideo: { dir: rawDir, size: { width: w, height: h } } }),
  });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => {
    const body = cdn(r.request().url());
    return body ? r.fulfill({ status: 200, contentType: 'text/javascript', body }) : r.abort();
  });
  // A first visit, but with the theme set and no first-visit tour or consent banner, plus what
  // the scene asks for in storage (such as the Inputs card left open: abt:ctrl:<path>).
  const storage = opts.storage ?? tool.storage ?? {};
  await ctx.addInitScript(([t, seen, st]) => {
    try {
      if (sessionStorage.getItem('guide-init')) return;
      sessionStorage.setItem('guide-init', '1');
      localStorage.setItem('abt-theme', t); localStorage.setItem('abt-consent', 'denied');
      seen.forEach(k => localStorage.setItem(k, '1'));
      Object.keys(st).forEach(k => localStorage.setItem(k, st[k]));
    } catch (e) {}
  }, [theme, tool.seen || [], storage]);
  if (opts.record !== false) await ctx.addInitScript(CURSOR);
  const page = await ctx.newPage();
  const t0 = Date.now();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(origin + tool.path + (opts.hash || ''));
  if (tool.ready) await tool.ready(page);
  await sleep(500);
  const S = { page, ctx, theme, t0, rawDir, errors, marks: [], start: 0, cur: { x: w / 2, y: h / 2 }, w, h };
  // Pointer moves ease in and out and take real time, so the recording shows them as motion.
  S.glide = async (x, y, ms = 650) => {
    const a = S.cur, n = Math.max(6, Math.round(ms / 16));
    for (let i = 1; i <= n; i++) {
      const k = i / n, e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      await page.mouse.move(a.x + (x - a.x) * e, a.y + (y - a.y) * e);
      await sleep(ms / n);
    }
    S.cur = { x, y };
  };
  S.box = async (sel) => {
    const el = typeof sel === 'string' ? page.locator(sel).first() : sel;
    await el.waitFor({ state: 'visible', timeout: 8000 });
    const b = await el.boundingBox();
    if (!b) throw new Error('no box for ' + sel);
    return b;
  };
  S.centre = async (sel, dx = 0, dy = 0) => { const b = await S.box(sel); return { x: b.x + b.width / 2 + dx, y: b.y + b.height / 2 + dy }; };
  S.moveTo = async (sel, o = {}) => { const c = o.at || await S.centre(sel, o.dx || 0, o.dy || 0); await S.glide(c.x, c.y, o.ms); return c; };
  S.click = async (sel, o = {}) => {
    const c = await S.moveTo(sel, o);
    await sleep(120);
    await page.mouse.down(); await sleep(70); await page.mouse.up();
    await sleep(o.after ?? 350);
    return c;
  };
  S.drag = async (from, to, o = {}) => {
    const a = from.x !== undefined ? from : await S.centre(from);
    await S.glide(a.x, a.y, o.ms1 ?? 600);
    await sleep(150);
    await page.mouse.down();
    await sleep(120);
    await page.mouse.move(a.x + 8, a.y + 6); await sleep(60);
    const b = to.x !== undefined ? to : await S.centre(to);
    await S.glide(b.x, b.y, o.ms2 ?? 800);
    await sleep(o.hold ?? 250);
    await page.mouse.up();
    await sleep(o.after ?? 500);
  };
  S.type = async (sel, text, delay = 85) => {
    await page.locator(sel).first().focus();
    for (const ch of text) { await page.keyboard.type(ch); await sleep(delay); }
  };
  // Scroll the page so an element sits at a given height, smoothly, for the recording.
  S.scrollTo = async (sel, top = 90, ms = 700) => {
    await page.evaluate(([s, t]) => { const e = document.querySelector(s); window.scrollTo({ top: e.getBoundingClientRect().top + scrollY - t, behavior: 'smooth' }); }, [sel, top]);
    await sleep(ms);
  };
  // Mark the start of the shown part, and name the moments the guide's steps point at.
  S.begin = () => { S.start = Date.now(); };
  S.mark = (label) => { S.marks.push({ t: +((Date.now() - S.start) / 1000).toFixed(2), label }); };
  return S;
}

// What one guide clip may weigh (the median clip is about 230 KB).
const MP4_BUDGET_KB = 500;

// Close the scene, then cut the video to the shown part, crop it and encode mp4 + poster.
export async function finish(S, media, name, crop, o = {}) {
  const { page, ctx } = S;
  const dur = (Date.now() - S.start) / 1000;
  const vid = page.video();
  await ctx.close();
  const raw = await vid.path();
  const lead = (S.start - S.t0) / 1000;
  const out = join(media, `${name}-${S.theme}`);
  const [x, y, w, h] = crop;
  const vf = `crop=${w}:${h}:${x}:${y},fps=${o.fps || 15}${o.scale ? ',scale=' + o.scale + ':-2:flags=lanczos' : ''}`;
  const ss = ['-ss', (lead + (o.trim ?? 0.35)).toFixed(2), '-t', (dur - (o.trim ?? 0.35)).toFixed(2)];
  const run = (args) => { const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' }); if (r.status) throw new Error('ffmpeg failed'); };
  run([...ss, '-i', raw, '-vf', vf + ',format=yuv420p', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(o.crfMp4 ?? 33), '-movflags', '+faststart', out + '.mp4']);
  // A clip past the budget is usually a scene doing too much: split it, or pass a lower fps or a higher crfMp4.
  const kb = Math.round(statSync(out + '.mp4').size / 1024);
  if (kb > MP4_BUDGET_KB) console.warn(`  ${name}-${S.theme}.mp4 is ${kb} KB, over the ${MP4_BUDGET_KB} KB budget`);
  // The poster: a frame where the scene says it best (posterAt, in seconds into the shown part).
  const at = o.posterAt ?? (dur - 1.2);
  run(['-ss', (lead + 0.35 + at).toFixed(2), '-i', raw, '-vf', vf.replace(/,fps=\d+/, ''), '-frames:v', '1', '-c:v', 'libwebp', '-quality', '80', out + '.webp']);
  rmSync(S.rawDir, { recursive: true, force: true });
  return { name, theme: S.theme, duration: +(dur - 0.35).toFixed(2), marks: S.marks.map(m => ({ ...m, t: Math.max(0, +(m.t - 0.35).toFixed(2)) })), width: o.scale ? o.scale : w, height: o.scale ? Math.round(h * o.scale / w / 2) * 2 : h, errors: S.errors };
}

// A still: the page as it is now, as a webp (and the boxes of what it names, as percentages).
export async function still(S, media, name, o = {}) {
  const png = join(S.rawDir, name + '.png');
  await S.page.screenshot({ path: png });
  const out = join(media, `${name}-${S.theme}.webp`);
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-c:v', 'libwebp', '-quality', String(o.quality ?? 82), out], { stdio: 'inherit' });
  if (r.status) throw new Error('ffmpeg failed');
  const boxes = o.boxes ? await S.page.evaluate((m) => Object.fromEntries(Object.entries(m).map(([k, sels]) => {
    // A box may cover several elements: the union of their rectangles.
    const rs = [].concat(sels).map(s => document.querySelector(s)).filter(Boolean).map(e => e.getBoundingClientRect());
    if (!rs.length) return [k, null];
    // Kept inside the screenshot: a part running on below it is outlined to its edge.
    const x = Math.max(0, Math.min(...rs.map(b => b.left))), y = Math.max(0, Math.min(...rs.map(b => b.top)));
    const r = Math.min(innerWidth - 4, Math.max(...rs.map(b => b.right))), btm = Math.min(innerHeight - 4, Math.max(...rs.map(b => b.bottom)));
    return [k, { x: +(x / innerWidth * 100).toFixed(2), y: +(y / innerHeight * 100).toFixed(2), w: +((r - x) / innerWidth * 100).toFixed(2), h: +((btm - y) / innerHeight * 100).toFixed(2) }];
  })), o.boxes) : null;
  await S.ctx.close();
  rmSync(S.rawDir, { recursive: true, force: true });
  return { name, theme: S.theme, boxes, errors: S.errors };
}
