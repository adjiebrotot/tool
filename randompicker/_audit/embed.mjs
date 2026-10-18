// Random Picker — Share and embed audit.
//
// The stage card carries a Share menu (SharedShare, data-share="tool") with
// two rows, Share as link and Embed as HTML, and an embed is one picker on
// its own: the mode the reader had on screen, their choices, its button.
// This drives the real page in headless Chromium, for every mode:
//
//   S1  the menu is in the stage card and lists Share as link, Embed as HTML
//   S2  Share sits clear of the picker, on a desktop and on a phone
//   S3  only the scene on screen is built (one WebGL scene, not four)
//   E1  the code is the iframe of this mode, its credit line and its sizer,
//       worded as a tool
//   E2  opened inside another site's page, the frame shows the stage card
//       alone: that mode, the reader's choices, the button, the watermark
//   E3  every string that came through the link is text: markup in a choice
//       runs nothing
//   E4  the picker works in the frame and writes nothing to the viewer's cache
//   E5  the frame is sized by its host to the card, nothing cut
//   L1  Share as link and the links back open the whole tool on that mode
//       and those choices
//   P1  a cache saved before Share existed (or with a mode that is gone)
//       still opens, with no error
//
// NOGL=1 runs the same checks with WebGL refused, on the 2D versions.
// three.js is fetched once into _ref/.libcache/ (gitignored) and served from
// there afterwards.
//
// Run: node randompicker/_audit/embed.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const LIBS = join(ROOT, '_ref', '.libcache');
const SITE = 'https://tool.adjiebrotots.com';
const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js';
const NOGL = !!process.env.NOGL;

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '  PASS  ' : '✗ FAIL  ') + name + (detail ? '  — ' + detail : ''));
  ok ? pass++ : fail++;
};

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
               '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain', '.webmanifest': 'application/json' };
const site = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let file = join(ROOT, rel);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(r => site.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + site.address().port;
// Another site, on another origin, that pastes the embed code into its page.
let hostPage = '';
const host = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(hostPage); });
await new Promise(r => host.listen(0, 'localhost', r));
const HOST = 'http://localhost:' + host.address().port;

mkdirSync(LIBS, { recursive: true });
const threeFile = join(LIBS, 'three-r134.min.js');
if (!existsSync(threeFile)) writeFileSync(threeFile, Buffer.from(await (await fetch(THREE_URL)).arrayBuffer()));
const threeJs = readFileSync(threeFile);

const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function newPage(viewport, init) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
  await ctx.route('**', route => {
    const url = route.request().url();
    if (url.startsWith(ORIGIN) || url.startsWith(HOST)) return route.continue();
    if (url.includes('three.min.js')) return route.fulfill({ status: 200, contentType: 'text/javascript', body: threeJs });
    return route.abort();
  });
  if (NOGL) await ctx.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...a) { return /webgl/.test(type) ? null : get.call(this, type, ...a); };
  });
  if (init) await ctx.addInitScript(init.fn, init.arg);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  return { ctx, page, errors };
}

// A choice with markup in it: a link may carry anything, and has to draw as text.
const CHOICES = ['Ana', 'Budi', 'Cici <img src=x onerror="window.__pwn=1">', 'Dodo'];
const LOOKALIKE = { '<': '‹', '>': '›', '"': '”', "'": 'ʼ', '`': 'ʼ' };
const inert = s => s.replace(/[<>"'`]/g, c => LOOKALIKE[c]);
const ACTION = { wheel: 'Spin the wheel', dice: 'Roll the dice', slot: 'Pull the lever', galton: 'Drop the ball' };
const SCENE = { wheel: '.wheel3d, .wheel-wrap', dice: '.dice-scene', slot: '.slot3d, .slot-machine', galton: '.galton-wrap' };

// What the stage on screen holds, read the same way on every page.
const STATE = () => ({
  mode: currentMode,
  stages: [...document.querySelectorAll('.stage')].filter(s => s.offsetParent !== null).map(s => s.id),
  choices: parseChoices(),
  built: gl ? Object.keys(gl).filter(k => gl[k]) : null,
  dice: !!three,
  light: document.body.classList.contains('light')
});

async function prepared(viewport, mode, theme) {
  const s = await newPage(viewport);
  await s.page.goto(ORIGIN + '/randompicker/', { waitUntil: 'load' });
  await s.page.fill('#choicesInput', CHOICES.join('\n'));
  await s.page.dispatchEvent('#choicesInput', 'change');
  if (theme === 'dark') await s.page.click('#themeToggle');
  await s.page.click(`.mode-tab[data-mode="${mode}"]`);
  await s.page.waitForTimeout(400);
  return s;
}

const box = (page, sel) => page.evaluate(sel => {
  const el = [...document.querySelectorAll(sel)].find(e => e.offsetParent !== null);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { l: r.left, t: r.top, r: r.right, b: r.bottom };
}, sel);
const apart = (a, b) => !!a && !!b && (a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t);

for (const mode of ['wheel', 'dice', 'slot', 'galton'].filter(m => !process.env.ONLY || m === process.env.ONLY)) {
  const theme = mode === 'wheel' ? 'dark' : 'light';
  console.log(`\n── ${mode} (${theme}${NOGL ? ', no WebGL' : ''}) ──`);
  const R = await prepared({ width: 1440, height: 1000 }, mode, theme);
  const { page } = R;

  /* S1 the menu */
  const menu = await page.evaluate(() => {
    const t = document.querySelector('.stage-card .share-toggle');
    if (!t || t.offsetParent === null) return null;
    t.click();
    const rows = [...document.querySelectorAll('.share-list.is-open .share-opt')].map(b => b.querySelector('.combo-main').textContent.trim());
    t.click();
    return { label: t.textContent.trim(), rows, title: t.title };
  });
  check(`${mode} S1 Share in the stage card lists Share as link, Embed as HTML`,
        !!menu && menu.label === 'Share' && JSON.stringify(menu.rows) === '["Share as link","Embed as HTML"]' && /tool/.test(menu.title),
        menu ? `${menu.label}: ${menu.rows.join(' | ')}` : 'no Share button');

  /* S2 clear of the picker */
  const sb = await box(page, '.stage-card .share-toggle'), sc = await box(page, SCENE[mode]);
  check(`${mode} S2 Share sits clear of the picker on a desktop`, apart(sb, sc), JSON.stringify({ sb, sc }));

  /* S3 only this scene is built */
  // The page opened on the wheel, then the reader switched: those two scenes and no other.
  const st = await page.evaluate(STATE);
  const want3d = NOGL ? null : [...new Set(['wheel', mode === 'dice' ? 'wheel' : mode])].sort();
  const builtOk = NOGL ? st.built === null : JSON.stringify([...st.built].sort()) === JSON.stringify(want3d);
  check(`${mode} S3 the page built only the scenes it has shown`,
        builtOk && st.dice === (mode === 'dice' && !NOGL), JSON.stringify({ built: st.built, dice: st.dice }));

  /* E1 the code */
  const code = await page.evaluate(() => SharedShare.embedCode(document.querySelector('.stage-card .btn-cluster')).then(r => r.code));
  const lines = code.split('\n');
  const src = ((/src="([^"]+)"/.exec(lines[0]) || [])[1] || '').replace(/&amp;/g, '&');
  const openHref = ((/<a href="([^"]+)">/.exec(lines[1] || '') || [])[1] || '').replace(/&amp;/g, '&');
  const canon = SITE + '/randompicker/';
  check(`${mode} E1 the code is the iframe of stage-${mode}, a credit line worded as a tool, and the sizer`,
        lines.length === 3 && /^<iframe [^\n]*><\/iframe>$/.test(lines[0]) && src.startsWith(`${canon}#embed=stage-${mode}&theme=${theme}&s=`) &&
        /<p [^>]*>Interactive tool: <a href="[^"]+">Random Picker: Wheel, Dice and Slots<\/a> by Adjie Brotot Tools<\/p>/.test(lines[1]) &&
        openHref.startsWith(`${canon}#open=stage-${mode}&s=`) && /^<script>[^<]*<\/script>$/.test(lines[2]) && code.length < 2000,
        `${code.length} characters; ${lines[1] ? lines[1].replace(/<[^>]+>/g, '') : ''}`);

  /* L1 Share as link is the links-back address */
  const link = await page.evaluate(() => SharedShare.shareLink(document.querySelector('.stage-card .btn-cluster')));
  check(`${mode} L1 Share as link copies the address the embed links back to`, link === openHref);

  /* E2–E5 the embed, inside another site's page */
  const E = await newPage({ width: 1100, height: 900 });
  hostPage = `<!doctype html><html><head><meta charset="utf-8"><title>Host</title></head>
    <body style="margin:0;padding:24px;background:#f0e9df;font:16px system-ui"><h1>Someone else's page</h1>
    <div style="max-width:760px">${code.split(SITE).join(ORIGIN)}</div><p>After the embed.</p></body></html>`;
  await E.page.goto(HOST + '/', { waitUntil: 'load' });
  const frameEl = await E.page.waitForSelector('iframe');
  const frame = await frameEl.contentFrame();
  const settled = await frame.waitForFunction(() => document.readyState === 'complete' &&
    document.documentElement.classList.contains('abt-embed') && !document.documentElement.classList.contains('abt-embed-wait'),
    null, { timeout: 20000 }).then(() => true, () => false);
  const F = await frame.evaluate(STATE).catch(e => ({ err: e.message }));
  const shown = await frame.evaluate(() => {
    const vis = sel => [...document.querySelectorAll(sel)].some(e => e.offsetParent !== null);
    const mark = document.querySelector('.abt-embed-mark');
    return {
      card: vis('.stage-card'), sidebar: vis('.sidebar'), tabs: vis('.mode-bar'), header: vis('.header'), footer: vis('.page-footer'),
      share: vis('.stage-card .share-toggle'), button: (document.querySelector('#actionBtn') || {}).textContent,
      buttonShown: vis('#actionBtn'), mark: mark && mark.offsetParent !== null ? mark.textContent.trim() : null,
      markHref: mark ? mark.href : '', failed: document.documentElement.classList.contains('abt-embed-failed')
    };
  });
  check(`${mode} E2 the frame shows the stage card alone, on ${mode}, with its button and watermark`,
        settled && !shown.failed && shown.card && !shown.sidebar && !shown.tabs && !shown.header && !shown.footer && !shown.share &&
        shown.buttonShown && shown.button === ACTION[mode] && JSON.stringify(F.stages) === `["stage-${mode}"]` &&
        F.light === (theme === 'light') && shown.mark === 'Make your own at tool.adjiebrotots.com/randompicker' &&
        shown.markHref.replace(ORIGIN, SITE) === openHref,
        JSON.stringify({ settled, ...shown, stages: F.stages, light: F.light }));
  check(`${mode} E3 the reader's choices arrive, markup turned to text, nothing run`,
        JSON.stringify(F.choices) === JSON.stringify(CHOICES.map(inert)) &&
        !(await frame.evaluate(() => window.__pwn)) && E.errors.length === 0,
        JSON.stringify(F.choices) + (E.errors.length ? ' ' + E.errors.join(' | ') : ''));
  if (!NOGL) check(`${mode} E3b the frame builds only the scene it shows`,
        mode === 'dice' ? F.dice && F.built.length === 0 : JSON.stringify(F.built) === `["${mode}"]`, JSON.stringify({ built: F.built, dice: F.dice }));

  // E5: the host's listener sizes the frame to the card.
  await E.page.waitForTimeout(600);
  const need = await frame.evaluate(() => {
    const card = document.querySelector('.stage-card');
    card.style.setProperty('height', 'auto', 'important');
    const h = card.getBoundingClientRect().height;
    card.style.removeProperty('height');
    return Math.ceil(h);
  });
  if (process.env.SHOT) { mkdirSync(process.env.SHOT, { recursive: true }); await E.page.screenshot({ path: join(process.env.SHOT, `embed-${mode}.png`), fullPage: true }); }
  const fit = { frame: await E.page.evaluate(() => document.querySelector('iframe').getBoundingClientRect().height), need };
  check(`${mode} E5 the host sizes the frame to the card, nothing cut and no empty band`,
        fit.frame >= fit.need - 2 && fit.frame <= fit.need + 60, `frame ${fit.frame}px, card needs ${fit.need}px`);
  // E4: play it once, as a visitor on that site would.
  await frame.click('#actionBtn');
  const played = await frame.waitForFunction(() => historyArr.length === 1 && !animating, null, { timeout: 20000 }).then(() => true, () => false);
  const after = await frame.evaluate(() => ({
    pick: historyArr[0], winner: document.querySelector('#winnerOverlay').classList.contains('open'),
    name: document.querySelector('#winnerName').textContent, saved: localStorage.getItem('abt:save:randompicker:v1')
  }));
  const okPick = after.pick && (after.pick.noWin ? !after.winner : after.winner && CHOICES.map(inert).includes(after.name));
  check(`${mode} E4 the picker plays in the frame and leaves the viewer's cache alone`,
        played && okPick && after.saved === null, JSON.stringify(after));
  if (after.winner) await frame.click('#winnerCloseBtn');

  await E.ctx.close();

  // L1: the link back opens the whole tool on that mode and those choices, for a new visitor.
  const O = await newPage({ width: 1440, height: 1000 });
  await O.page.goto(openHref.replace(SITE, ORIGIN), { waitUntil: 'load' });
  const opened = await O.page.waitForFunction(m => currentMode === m && parseChoices().length === 4, mode, { timeout: 10000 }).then(() => true, () => false);
  const os = await O.page.evaluate(STATE);
  const ostate = await O.page.evaluate(() => ({ embed: document.documentElement.classList.contains('abt-embed'), hash: location.hash,
    tabs: !!document.querySelector('.mode-bar').offsetParent }));
  await O.page.waitForTimeout(700);
  const kept = await O.page.evaluate(() => JSON.parse(localStorage.getItem('abt:save:randompicker:v1') || 'null'));
  check(`${mode} L1 the link back opens the whole tool on ${mode} with the reader's choices, and keeps them`,
        opened && JSON.stringify(os.stages) === `["stage-${mode}"]` && JSON.stringify(os.choices) === JSON.stringify(CHOICES.map(inert)) &&
        !ostate.embed && ostate.hash === '' && ostate.tabs && kept && kept.__extra && kept.__extra.mode === mode && O.errors.length === 0,
        JSON.stringify({ opened, stages: os.stages, ...ostate, kept: kept && kept.__extra, errors: O.errors }));
  await O.ctx.close();
  await R.ctx.close();

  /* S2 on a phone */
  const P = await prepared({ width: 390, height: 844 }, mode, 'light');
  const pb = await box(P.page, '.stage-card .share-toggle'), pc = await box(P.page, SCENE[mode]);
  const cardBox = await box(P.page, '.stage-card');
  check(`${mode} S2 Share sits clear of the picker on a phone, inside the card`,
        apart(pb, pc) && pb.l >= cardBox.l && pb.r <= cardBox.r && P.errors.length === 0, JSON.stringify({ pb, pc }));
  await P.ctx.close();
}

/* P1 old saved state */
console.log('\n── saved state ──');
for (const [label, blob, mode] of [
  ['a cache from before Share (slot)', { __fields: { 'v:choicesInput': 'Red\nBlue\nGreen' }, __extra: { mode: 'slot' } }, 'slot'],
  ['a mode that is gone', { __fields: { 'v:choicesInput': 'Red\nBlue' }, __extra: { mode: 'roulette' } }, 'wheel'],
  ['no mode at all', { __fields: { 'v:choicesInput': 'Red\nBlue' } }, 'wheel'],
  ['dice with too many choices', { __fields: { 'v:choicesInput': 'a\nb\nc\nd\ne\nf\ng' }, __extra: { mode: 'dice' } }, 'wheel']
]) {
  const S = await newPage({ width: 1280, height: 900 }, { fn: b => { try { localStorage.setItem('abt:save:randompicker:v1', JSON.stringify(b)); } catch (e) {} }, arg: blob });
  await S.page.goto(ORIGIN + '/randompicker/', { waitUntil: 'load' });
  await S.page.waitForTimeout(400);
  const s = await S.page.evaluate(STATE);
  check(`P1 ${label} opens on ${mode}`, JSON.stringify(s.stages) === `["stage-${mode}"]` && s.mode === mode && S.errors.length === 0,
        JSON.stringify({ stages: s.stages, choices: s.choices.length, errors: S.errors }));
  await S.ctx.close();
}

await browser.close();
site.close(); host.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
