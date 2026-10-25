// Shared helpers for the guide's captures: a static server, a page with a visible cursor, smooth
// pointer moves, and video trimming/encoding. See capture.mjs.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { existsSync, statSync, createReadStream, readFileSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join, normalize, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import os from 'node:os';

const require = createRequire(import.meta.url);
export const pw = require('playwright');

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '..', '..', '..');       // the repo root
export const MEDIA = resolve(HERE, '..', 'media');
export const PAGE_PATH = '/powerfactory-scripter/builder/';
export const W = 1280, H = 720;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.py': 'text/plain',
  '.txt': 'text/plain', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml' };

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

// highlight.js is the one thing the builder takes from a CDN (the Python tab's colours). Fetched once
// with curl and served from here, so the clips show the page as a reader sees it; without it the
// code is plain text.
let hljsBody;
function hljs() {
  if (hljsBody === undefined) {
    const f = join(os.tmpdir(), 'pfg-hljs-11.9.0.js');
    if (!existsSync(f)) spawnSync('curl', ['-sS', '-m', '30', '-o', f, 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js']);
    hljsBody = existsSync(f) && statSync(f).size > 50000 ? readFileSync(f) : null;
  }
  return hljsBody;
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
    window.addEventListener('mousemove', e => { c.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; r.style.left = '0'; r._x = e.clientX; r._y = e.clientY; }, true);
    window.addEventListener('mousedown', e => {
      r.style.transition = 'none'; r.style.opacity = '.9'; r.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px) scale(.4)';
      requestAnimationFrame(() => requestAnimationFrame(() => { r.style.transition = 'transform .35s ease-out, opacity .45s ease-out'; r.style.opacity = '0'; r.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px) scale(1.15)'; }));
    }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mk); else mk();
})();`;

// A scene: opens the builder in a theme, records the video, exposes the helpers.
export async function openScene(browser, origin, theme, opts = {}) {
  const rawDir = mkdtempSync(join(os.tmpdir(), 'pfg-raw-'));
  const ctx = await browser.newContext({
    viewport: { width: W, height: opts.h || H }, deviceScaleFactor: 1, acceptDownloads: true, colorScheme: theme,
    ...(opts.record === false ? {} : { recordVideo: { dir: rawDir, size: { width: W, height: opts.h || H } } }),
  });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => {
    const body = /highlight\.min\.js/.test(r.request().url()) ? hljs() : null;
    return body ? r.fulfill({ status: 200, contentType: 'text/javascript', body }) : r.abort();
  });
  await ctx.addInitScript(([t]) => {
    try { localStorage.setItem('abt-theme', t); localStorage.setItem('pf-builder-tour-v1-seen', '1'); localStorage.setItem('abt-consent', 'denied'); } catch (e) {}
  }, [theme]);
  if (opts.record !== false) await ctx.addInitScript(CURSOR);
  const page = await ctx.newPage();
  const t0 = Date.now();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(origin + PAGE_PATH);
  await page.waitForFunction(() => window.PFB && window.PFB.ready);
  await page.evaluate(() => window.PFB.canvasReady);
  await page.evaluate(() => window.PFB.runtimeReady);
  await sleep(500);
  const S = { page, ctx, theme, t0, rawDir, errors, marks: [], start: 0, cur: { x: 640, y: 360 } };
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
  // Mark the start of the shown part, and name the moments the guide's steps point at.
  S.begin = () => { S.start = Date.now(); };
  S.mark = (label) => { S.marks.push({ t: +((Date.now() - S.start) / 1000).toFixed(2), label }); };
  S.pause = sleep;
  return S;
}

// Close the scene, then cut the video to the shown part, crop it and encode webm + mp4 + poster.
export async function finish(S, name, crop, o = {}) {
  const { page, ctx } = S;
  const dur = (Date.now() - S.start) / 1000;
  const vid = page.video();
  await ctx.close();
  const raw = await vid.path();
  const lead = (S.start - S.t0) / 1000;
  const out = join(MEDIA, `${name}-${S.theme}`);
  const [x, y, w, h] = crop;
  const vf = `crop=${w}:${h}:${x}:${y},fps=${o.fps || 15}${o.scale ? ',scale=' + o.scale + ':-2:flags=lanczos' : ''}`;
  const ss = ['-ss', (lead + (o.trim ?? 0.35)).toFixed(2), '-t', (dur - (o.trim ?? 0.35)).toFixed(2)];
  const run = (args) => { const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' }); if (r.status) throw new Error('ffmpeg failed'); };
  run([...ss, '-i', raw, '-vf', vf, '-an', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String(o.crf ?? 40), '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', out + '.webm']);
  run([...ss, '-i', raw, '-vf', vf + ',format=yuv420p', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(o.crfMp4 ?? 33), '-movflags', '+faststart', out + '.mp4']);
  // The poster: a frame where the scene says it best (posterAt, in seconds into the shown part).
  const at = o.posterAt ?? (dur - 1.2);
  run(['-ss', (lead + 0.35 + at).toFixed(2), '-i', raw, '-vf', vf.replace(/,fps=\d+/, ''), '-frames:v', '1', '-c:v', 'libwebp', '-quality', '80', out + '.webp']);
  rmSync(S.rawDir, { recursive: true, force: true });
  return { name, theme: S.theme, duration: +(dur - 0.35).toFixed(2), marks: S.marks.map(m => ({ ...m, t: Math.max(0, +(m.t - 0.35).toFixed(2)) })), width: o.scale ? o.scale : w, height: o.scale ? Math.round(h * o.scale / w / 2) * 2 : h, errors: S.errors };
}

// A still: the page as it is now, as a webp (and the boxes of what it names, as percentages).
export async function still(S, name, o = {}) {
  const png = join(S.rawDir, name + '.png');
  await S.page.screenshot({ path: png });
  const out = join(MEDIA, `${name}-${S.theme}.webp`);
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-c:v', 'libwebp', '-quality', String(o.quality ?? 82), out], { stdio: 'inherit' });
  if (r.status) throw new Error('ffmpeg failed');
  const boxes = o.boxes ? await S.page.evaluate((m) => Object.fromEntries(Object.entries(m).map(([k, sel]) => {
    const e = document.querySelector(sel); if (!e) return [k, null];
    const b = e.getBoundingClientRect();
    return [k, { x: +(b.x / innerWidth * 100).toFixed(2), y: +(b.y / innerHeight * 100).toFixed(2), w: +(b.width / innerWidth * 100).toFixed(2), h: +(b.height / innerHeight * 100).toFixed(2) }];
  })), o.boxes) : null;
  await S.ctx.close();
  rmSync(S.rawDir, { recursive: true, force: true });
  return { name, theme: S.theme, boxes, errors: S.errors };
}
