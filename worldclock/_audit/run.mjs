// World Clock — end-to-end audit.
// Drives the REAL page headless, as users in several time zones at a fixed
// "now", and checks every clock it shows against an independent replay:
// Python's zoneinfo, which reads the system's compiled tz database rather than
// the copy inside Chromium's ICU. Nothing here reuses the page's own maths.
//
//   W1  the header reads "DD MMMM YYYY HH:mm (GMT+X, Place)" and is the right time
//   W2  every clock on the map: HH:mm matches zoneinfo for every zone, and a
//       "DD MMM" date line appears exactly when that place's date differs
//       from the user's
//   W3  Time Travel: a wall time typed for a place is the instant zoneinfo
//       gives it (a repeated time is the first one, a skipped time lands just
//       past the jump), and every clock on the map follows, across DST starts
//       and ends in both hemispheres, a 30-minute shift and the +14 date line
//   W4  Show seconds: every clock becomes HH:mm:ss, and the choice survives a reload
//   W5  the place card: offset, daylight-saving state, and the day and size of
//       the next clock change all match zoneinfo
//   W6  the opening view: each user lands zoomed in on their own region with
//       neighbours in other offsets in view (Perth → Australia, Singapore →
//       South-East Asia, London → Europe …)
//   W7  Time zones is a world view: choosing it zooms out to the world, and
//       zooming back in hands the map back to Jurisdictions
//   W8  the map data: every zone's label sits inside its own shape, the
//       browser knows every zone, and no border runs the width of the map
//       (the date-line slicing a sphere-cut land layer causes)
//   W9  microstates and atolls fold into a bigger neighbour on the same
//       clock (one label for Italy and the Vatican), and a border is drawn as
//       a time border exactly when the clocks on its two sides differ, so it
//       changes with daylight saving
//   W10 the night shade: wherever NOAA's solar position puts the sun up the
//       map is unshaded, wherever it is well below the horizon the shade is
//       full, and the twilight between fades from one to the other; checked
//       at the fixed "now" and again at the June solstice (polar day and night)
//
// Run: node run.mjs  (the first run fetches d3 into _ref/.libcache/; after that
// it runs offline). Exits non-zero if any check fails.
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = pw;
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const NOW = Date.UTC(2026, 8, 25, 6, 0, 0);   // Fri 25 Sep 2026 06:00 UTC, days before the southern DST start

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '  PASS  ' : '✗ FAIL  ') + name + (detail ? '  — ' + detail : ''));
  ok ? pass++ : fail++;
};

// ── d3, cached like _ref/chart-check.mjs caches its chart libraries ────────
const D3 = 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js';
const LIBS = join(ROOT, '_ref', '.libcache');
mkdirSync(LIBS, { recursive: true });
if (!existsSync(join(LIBS, basename(D3)))) {
  try { writeFileSync(join(LIBS, basename(D3)), await (await fetch(D3)).text()); }
  catch (e) { console.error('d3 is not cached and could not be fetched: ' + e.message); process.exit(2); }
}
const d3Body = readFileSync(join(LIBS, basename(D3)), 'utf8');

// ── the independent replay: Python zoneinfo ─────────────────────────────────
const PY = String.raw`
import sys, json
from zoneinfo import ZoneInfo
from datetime import datetime, timezone
q = json.load(sys.stdin)
def off(z, ms):
    return int(datetime.fromtimestamp(ms / 1000, tz=timezone.utc).astimezone(ZoneInfo(z)).utcoffset().total_seconds() // 60)
out = {'off': [], 'wall': [], 'next': [], 'std': []}
for z, ms in q.get('off', []):
    try: out['off'].append(off(z, ms))
    except Exception: out['off'].append(None)
for z, y, mo, d, h, mi in q.get('wall', []):
    out['wall'].append(int(datetime(y, mo, d, h, mi, tzinfo=ZoneInfo(z)).timestamp() * 1000))
for z, ms in q.get('next', []):
    cur, found, step = off(z, ms), None, 3600000
    for i in range(1, 400 * 24 + 1):
        t2 = ms + i * step
        o = off(z, t2)
        if o != cur:
            lo, hi = t2 - step, t2
            while hi - lo > 60000:
                mid = (lo + hi) // 120000 * 60000
                if mid <= lo: break
                if off(z, mid) == cur: lo = mid
                else: hi = mid
            found = [hi, cur, o]
            break
    out['next'].append(found)
for z, y in q.get('std', []):
    jan = int(datetime(y, 1, 1, tzinfo=ZoneInfo(z)).utcoffset().total_seconds() // 60)
    jul = int(datetime(y, 7, 1, tzinfo=ZoneInfo(z)).utcoffset().total_seconds() // 60)
    out['std'].append([jan, jul])
print(json.dumps(out))
`;
function py(q) {
  const r = spawnSync('python3', ['-c', PY], { input: JSON.stringify(q), encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error('python3 zoneinfo failed: ' + r.stderr);
  return JSON.parse(r.stdout);
}
const tzdataVersion = (() => { try { return readFileSync('/usr/share/zoneinfo/tzdata.zi', 'utf8').split('\n')[0].replace('# version ', ''); } catch (e) { return '?'; } })();

// Formatting, written out again here rather than borrowed from the page.
const p2 = n => String(n).padStart(2, '0');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const wallOf = (ms, off) => { const d = new Date(ms + off * 60000); return { y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate(), wd: d.getUTCDay(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() }; };
const gmt = off => { const a = Math.abs(off); return 'GMT' + (off < 0 ? '-' : '+') + Math.floor(a / 60) + (a % 60 ? ':' + p2(a % 60) : ''); };

// ── the page ────────────────────────────────────────────────────────────────
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch();

async function openAs(tz, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1440, height: 900 }, timezoneId: tz, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  await ctx.route('**', route => {
    const url = route.request().url();
    if (url.startsWith(ORIGIN)) return route.continue();
    if (url === D3) return route.fulfill({ status: 200, contentType: 'text/javascript', body: d3Body });
    const type = route.request().resourceType();
    if (type === 'script') return route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
    if (type === 'stylesheet') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    return route.abort();
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.setFixedTime(new Date(NOW));
  await page.goto(ORIGIN + '/worldclock/');
  await page.waitForFunction(() => window.__worldclock && window.__worldclock.zones().some(z => z.time), null, { timeout: 30000 });
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}
const hook = (page, fn, arg) => page.evaluate(([f, a]) => window.__worldclock[f](a), [fn, arg]);

// Every clock on the map against zoneinfo at the instant the page shows.
async function checkAllClocks(page, label, userTz) {
  const ms = await hook(page, 'displayMs');
  const zones = (await hook(page, 'zones')).filter(z => z.tz);
  const r = py({ off: zones.map(z => [z.id, ms]).concat([[userTz, ms]]) });
  const userOff = r.off[r.off.length - 1];
  const uw = wallOf(ms, userOff);
  const bad = [];
  let compared = 0;
  zones.forEach((z, i) => {
    const off = r.off[i];
    if (off == null) return;
    compared++;
    const w = wallOf(ms, off);
    const sameDay = w.y === uw.y && w.mo === uw.mo && w.d === uw.d;
    const time = p2(w.h) + ':' + p2(w.mi) + (/:\d\d:\d\d$/.test(z.time) ? ':' + p2(w.s) : '');
    const date = sameDay ? '' : p2(w.d) + ' ' + MONTHS[w.mo].slice(0, 3);
    if (z.off !== off || z.time !== time || z.date !== date) bad.push(`${z.id}: page ${z.time} ${z.date || '-'} (${gmt(z.off)}), zoneinfo ${time} ${date || '-'} (${gmt(off)})`);
  });
  check(`${label}: ${compared} clocks match zoneinfo`, bad.length === 0 && compared > 390, bad.slice(0, 4).join('; ') + (bad.length > 4 ? ` … +${bad.length - 4}` : ''));
  return { ms, zones, userOff };
}

console.log(`World Clock audit — zoneinfo tzdata ${tzdataVersion}, fixed now ${new Date(NOW).toISOString()}`);

// ── W8 the map data ─────────────────────────────────────────────────────────
{
  const topo = JSON.parse(readFileSync(join(HERE, '..', 'zones.json'), 'utf8'));
  const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
  const arcs = topo.arcs.map(a => { let x = 0, y = 0; return a.map(([dx, dy]) => [(x += dx) * sx + tx, (y += dy) * sy + ty]); });
  const ring = r => r.flatMap((i, j) => { const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i]; return j ? a.slice(1) : a; });
  const inside = ([x, y], pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const geoms = topo.objects.zones.geometries;
  const off = [];
  for (const g of geoms) {
    const polys = g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
    if (!polys.length) continue;
    // inside an outer ring and outside that polygon's holes
    const ok = polys.some(p => inside(g.properties.lp, ring(p[0])) && !p.slice(1).some(h => inside(g.properties.lp, ring(h))));
    if (!ok) off.push(g.properties.id);
  }
  check('W8 every zone label sits inside its own shape', off.length === 0, off.join(' '));
  const long = arcs.filter(a => a.some((c, i) => i && Math.abs(c[0] - a[i - 1][0]) > 8)).length;
  check('W8 no border edge spans more than 8° of longitude (no date-line slicing)', long === 0, long + ' found');
  check('W8 every zone has a label point', geoms.every(g => Array.isArray(g.properties.lp)), '');
  check('W8 all of tzdb zone.tab is on the map (bar Antarctica)', geoms.length >= 400, geoms.length + ' zones');
}

// ── Perth: W1, W2, W4, W5, W6, W7, W3 ───────────────────────────────────────
{
  const { ctx, page, errors } = await openAs('Australia/Perth');
  const zones = await hook(page, 'zones');
  check('W8 Chromium knows every zone on the map', zones.every(z => z.tz), zones.filter(z => !z.tz).map(z => z.id).join(' '));

  // W1
  const head = await hook(page, 'now');
  const pw1 = wallOf(NOW, py({ off: [['Australia/Perth', NOW]] }).off[0]);
  const want = `${p2(pw1.d)} ${MONTHS[pw1.mo]} ${pw1.y} ${p2(pw1.h)}:${p2(pw1.mi)} (GMT+8, Perth)`;
  check('W1 header is DD MMMM YYYY HH:mm (GMT+X, Place)', head.trim() === want, `"${head.trim()}" vs "${want}"`);

  // W2
  await checkAllClocks(page, 'W2 now, as a Perth user', 'Australia/Perth');

  // W6
  await checkRegion(page, 'Perth', 'Australia/Perth', ['Australia/Sydney', 'Australia/Adelaide', 'Australia/Darwin', 'Australia/Brisbane']);

  // W5 place cards
  await checkCard(page, 'Australia/Melbourne');
  await checkCard(page, 'Australia/Perth');
  await checkCard(page, 'Australia/Adelaide');
  await checkCard(page, 'Australia/Lord_Howe');

  // W7
  const t0 = await hook(page, 'transform');
  for (let i = 0; i < 3; i++) { await page.click('#zoomOut'); await page.waitForTimeout(300); }
  const worldLabels = await hook(page, 'labels');
  const atolls = ['Pacific/Tarawa', 'Pacific/Funafuti', 'Pacific/Majuro', 'Pacific/Wake', 'Pacific/Midway', 'Pacific/Fakaofo', 'Pacific/Nauru'].filter(id => worldLabels.includes(id));
  check('W9 world view: Hawaii and New Zealand keep a clock, atolls wait for a closer look', worldLabels.includes('Pacific/Honolulu') && worldLabels.includes('Pacific/Auckland') && atolls.length === 0, atolls.join(' '));
  await page.click('#zoomHome');
  await page.waitForTimeout(300);
  await page.click('#viewGroup .seg-btn[data-val=tz]');
  await page.waitForTimeout(200);
  const t1 = await hook(page, 'transform');
  check('W7 choosing Time zones zooms out to the world', (await hook(page, 'view')) === 'tz' && t1.k < t0.k && t1.k <= t1.minK * 1.01, `k ${t0.k.toFixed(2)} → ${t1.k.toFixed(2)} (world ${t1.minK.toFixed(2)})`);
  for (let i = 0; i < 3; i++) { await page.click('#zoomIn'); await page.waitForTimeout(350); }
  check('W7 zooming in hands back to Jurisdictions', (await hook(page, 'view')) === 'jur', 'view ' + await hook(page, 'view'));

  // W9 time borders follow the clocks, checked against zoneinfo
  const kindsAt = async (pairs, ms, label) => {
    const r = py({ off: pairs.flatMap(([a, b]) => [[a, ms], [b, ms]]) });
    const bad = [];
    for (let i = 0; i < pairs.length; i++) {
      const [a, b] = pairs[i], same = r.off[2 * i] === r.off[2 * i + 1];
      const kinds = await page.evaluate(([x, y]) => window.__worldclock.borderKinds(x, y), [a, b]);
      const sameCountry = zones.find(z => z.id === a).cc === zones.find(z => z.id === b).cc;
      const want = !same ? 3 : sameCountry ? 2 : 1;
      if (kinds.length !== 1 || kinds[0] !== want) bad.push(`${a}|${b}: ${JSON.stringify(kinds)}, want ${want}`);
    }
    check(`W9 ${label}: a border is a time border exactly when its two clocks differ`, bad.length === 0, bad.join('; ') || pairs.length + ' borders');
  };
  const PAIRS = [['Australia/Perth', 'Australia/Darwin'], ['Australia/Sydney', 'Australia/Brisbane'], ['Australia/Sydney', 'Australia/Melbourne'],
    ['Australia/Adelaide', 'Australia/Darwin'], ['Australia/Adelaide', 'Australia/Sydney'], ['Europe/Madrid', 'Europe/Lisbon'], ['Europe/Madrid', 'Europe/Paris'],
    // Xinjiang: Urumqi is laid over Shanghai in the source data, and is cut out of it.
    ['Asia/Almaty', 'Asia/Urumqi'], ['Asia/Bishkek', 'Asia/Urumqi'], ['Asia/Dushanbe', 'Asia/Urumqi'], ['Asia/Hovd', 'Asia/Urumqi'],
    ['Asia/Shanghai', 'Asia/Urumqi'], ['Asia/Almaty', 'Asia/Tashkent'], ['Asia/Almaty', 'Asia/Bishkek']];
  await kindsAt(PAIRS, NOW, 'late September');
  const tapped = await page.evaluate(() => [window.__worldclock.zoneAt(85, 42), window.__worldclock.zoneAt(116, 34)]);
  check('W9 a tap in Xinjiang finds Urumqi, not the Shanghai zone under it', tapped[0] === 'Asia/Urumqi' && tapped[1] === 'Asia/Shanghai', tapped.join(' '));

  // W3 Time Travel
  await page.click('#zoomHome');
  await page.click('#travelBtn');
  const travel = async (place, date, time, label, extra) => {
    if (place) {
      await page.click('#placeSearch');
      await page.fill('#placeSearch', place.search);
      await page.waitForTimeout(100);
      const idx = await page.$$eval('#placeList .city-opt', (opts, want) => opts.findIndex(o => o.firstElementChild.textContent === want.name && o.textContent.includes(want.country)), place);
      if (idx < 0) { check(`${label}: found ${place.name} in the picker`, false, ''); return; }
      await page.locator('#placeList .city-opt').nth(idx).dispatchEvent('mousedown');
    }
    await page.fill('#travelDate', date);
    await page.fill('#travelTime', time);
    await page.waitForTimeout(450);
    const [y, mo, d] = date.split('-').map(Number), [h, mi] = time.split(':').map(Number);
    const zone = place ? place.id : 'Australia/Perth';
    const expected = py({ wall: [[zone, y, mo, d, h, mi]] }).wall[0];
    const got = await hook(page, 'displayMs');
    check(`${label}: ${date} ${time} in ${zone} is ${new Date(expected).toISOString().slice(0, 16)}Z`, got === expected, 'page ' + new Date(got).toISOString());
    const { zones: zs } = await checkAllClocks(page, `${label}: map`, 'Australia/Perth');
    if (extra) extra(zs);
  };
  await travel(null, '2026-11-10', '15:00', 'W3 3pm in Perth, 10 Nov', zs => {
    const mel = zs.find(z => z.id === 'Australia/Melbourne');
    check('W3 …is 6pm in Melbourne (daylight saving there, none in WA)', mel.time === '18:00', mel.time);
  });
  // NSW and SA are on daylight saving now, Queensland and the NT are not.
  await kindsAt(PAIRS, await hook(page, 'displayMs'), 'travelled to 10 Nov');
  const P = id => { const z = zones.find(z => z.id === id); return { id, name: z.name, country: z.country, search: z.name }; };
  await travel(P('Australia/Sydney'), '2026-10-04', '02:30', 'W3 a skipped time (Sydney, clocks forward)');
  await travel(P('Australia/Sydney'), '2027-04-04', '02:30', 'W3 a repeated time (Sydney, clocks back)');
  await travel(P('America/New_York'), '2027-03-20', '09:00', 'W3 US on DST, Europe not yet');
  await travel(P('Europe/London'), '2027-10-31', '01:30', 'W3 a repeated time (London)');
  await travel(P('Australia/Lord_Howe'), '2026-10-04', '02:15', 'W3 a 30-minute shift (Lord Howe)');
  await travel(P('Pacific/Kiritimati'), '2027-01-01', '00:00', 'W3 New Year at +14', zs => {
    // The user in Perth is at 18:00 on 31 Dec: Kiritimati is a day ahead of
    // them and says so; Honolulu, same clock face, is on their day and does not.
    const kir = zs.find(z => z.id === 'Pacific/Kiritimati'), hon = zs.find(z => z.id === 'Pacific/Honolulu');
    check('W3 …Kiritimati reads 00:00 01 Jan, Honolulu 00:00 with no date', kir.time === '00:00' && kir.date === '01 Jan' && hon.time === '00:00' && hon.date === '', `${kir.time} ${kir.date} / ${hon.time} ${hon.date || '-'}`);
  });
  await page.click('#backNow');
  await page.waitForTimeout(300);
  check('W3 Back to now returns to the present', (await hook(page, 'displayMs')) === NOW && await page.evaluate(() => document.getElementById('travelling').hidden), '');

  // W4 seconds
  await page.click('#showSeconds');
  await page.waitForTimeout(200);
  const secs = (await hook(page, 'zones')).filter(z => z.tz);
  check('W4 Show seconds turns every clock to HH:mm:ss', secs.every(z => /^\d\d:\d\d:\d\d$/.test(z.time)) && /\d\d:\d\d:\d\d \(/.test(await hook(page, 'now')), '');
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForFunction(() => window.__worldclock && window.__worldclock.zones().some(z => z.time));
  check('W4 …and stays on after a reload', await page.isChecked('#showSeconds') && (await hook(page, 'zones')).filter(z => z.tz).every(z => /^\d\d:\d\d:\d\d$/.test(z.time)), '');
  await checkAllClocks(page, 'W4 with seconds', 'Australia/Perth');

  check('Perth run: no page errors', errors.length === 0, errors.join('; '));
  await ctx.close();
}

// ── W10 the night shade ─────────────────────────────────────────────────────
// NOAA's solar calculator (the spreadsheet's equations: apparent longitude,
// corrected obliquity, equation of time), written out here rather than
// borrowed from the page, which uses the Almanac's shorter series.
function noaaSun(ms) {
  const R = Math.PI / 180, T = (ms / 86400000 + 2440587.5 - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(M * R) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * R) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * R) * 0.000289;
  const om = 125.04 - 1934.136 * T, lam = L0 + C - 0.00569 - 0.00478 * Math.sin(om * R);
  const eps = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(om * R);
  const dec = Math.asin(Math.sin(eps * R) * Math.sin(lam * R)) / R;
  const y = Math.tan(eps * R / 2) ** 2;
  const eot = 4 / R * (y * Math.sin(2 * L0 * R) - 2 * e * Math.sin(M * R) + 4 * e * y * Math.sin(M * R) * Math.cos(2 * L0 * R) - 0.5 * y * y * Math.sin(4 * L0 * R) - 1.25 * e * e * Math.sin(2 * M * R));
  const utcMin = ((ms % 86400000) + 86400000) % 86400000 / 60000;
  const lon = (((720 - utcMin - eot) / 4 + 540) % 360) - 180;
  return { dec, lon, alt: (la, lo) => Math.asin(Math.sin(la * R) * Math.sin(dec * R) + Math.cos(la * R) * Math.cos(dec * R) * Math.cos((lo - lon) * R)) / R };
}
{
  const { ctx, page, errors } = await openAs('Europe/London');
  await page.click('#viewGroup .seg-btn[data-val=tz]');
  await page.waitForTimeout(300);
  const shadeCheck = async label => {
    const ms = await hook(page, 'displayMs'), sun = noaaSun(ms), pg = await hook(page, 'subsolar');
    const dLon = Math.abs(((pg.lon - sun.lon + 540) % 360) - 180);
    check(`W10 ${label}: the sun is overhead at ${sun.dec.toFixed(2)}°, ${sun.lon.toFixed(2)}°`, Math.abs(pg.lat - sun.dec) < 0.05 && dLon < 0.05, `page ${pg.lat.toFixed(3)}°, ${pg.lon.toFixed(3)}°`);
    // Twilight samples are held a couple of degrees clear of the ends of the
    // fade, which the coarse shade grid blurs by about a degree at this zoom.
    const bad = [], seen = { day: 0, night: 0, dusk: 0 };
    for (let lat = -58; lat <= 80; lat += 4) for (let lon = -178; lon <= 178; lon += 4) {
      const v = await page.evaluate(p => window.__worldclock.night(p), [lon, lat]);
      if (v == null) continue;
      const alt = sun.alt(lat, lon);
      if (alt > 1.5) { seen.day++; if (v > 0.02) bad.push(`${lat},${lon} sun at ${alt.toFixed(1)}° shaded ${v.toFixed(2)}`); }
      else if (alt < -13.5) { seen.night++; if (v < 0.96) bad.push(`${lat},${lon} sun at ${alt.toFixed(1)}° shaded ${v.toFixed(2)}`); }
      else if (alt < -2 && alt > -10) { seen.dusk++; if (v < 0.005 || v > 0.995) bad.push(`${lat},${lon} sun at ${alt.toFixed(1)}° (twilight) shaded ${v.toFixed(2)}`); }
    }
    check(`W10 ${label}: day unshaded, night fully shaded, twilight in between`, bad.length === 0 && seen.day > 200 && seen.night > 200 && seen.dusk > 20, `${seen.day} day, ${seen.night} night, ${seen.dusk} twilight samples` + (bad.length ? '; ' + bad.slice(0, 4).join('; ') + (bad.length > 4 ? ` … +${bad.length - 4}` : '') : ''));
    return sun;
  };
  await shadeCheck('now');
  await page.click('#travelBtn');
  await page.fill('#travelDate', '2027-06-21');
  await page.fill('#travelTime', '12:00');
  await page.waitForTimeout(450);
  const sun = await shadeCheck('June solstice');
  const [arctic, antarctic] = await page.evaluate(() => [window.__worldclock.night([150, 75]), window.__worldclock.night([150, -58])]);
  check('W10 June solstice: midnight sun in the Arctic, dark at 58°S', arctic === 0 && antarctic > 0.96 && sun.alt(75, 150) > 0, `75°N ${arctic}, 58°S ${antarctic && antarctic.toFixed(2)}`);
  check('W10 run: no page errors', errors.length === 0, errors.join('; '));
  await ctx.close();
}

// ── W6 other users land on their own region ─────────────────────────────────
for (const [tz, label, must] of [
  ['Asia/Singapore', 'Singapore', ['Asia/Jakarta', 'Asia/Bangkok', 'Asia/Kuala_Lumpur', 'Asia/Manila', 'Asia/Makassar']],
  ['Europe/London', 'London', ['Europe/Paris', 'Europe/Berlin', 'Europe/Dublin', 'Europe/Helsinki']],
  ['America/New_York', 'New York', ['America/Chicago', 'America/Denver', 'America/Los_Angeles']],
  ['Asia/Kolkata', 'Kolkata', ['Asia/Karachi', 'Asia/Kathmandu', 'Asia/Dhaka']],
  ['Asia/Tokyo', 'Tokyo', ['Asia/Seoul', 'Asia/Shanghai', 'Asia/Taipei']],
  ['Pacific/Auckland', 'Auckland', ['Pacific/Chatham', 'Australia/Sydney', 'Pacific/Norfolk']],
  ['America/Santiago', 'Santiago', ['America/Argentina/Buenos_Aires', 'America/Lima']],
  ['Asia/Calcutta', 'an old zone name (Asia/Calcutta)', ['Asia/Karachi', 'Asia/Dhaka']],
  ['Europe/Rome', 'Rome', ['Europe/Paris', 'Europe/Athens', 'Africa/Tunis']],
]) {
  const { ctx, page, errors } = await openAs(tz);
  const userZone = (await hook(page, 'user')).zone;
  await checkRegion(page, label, userZone, must);
  if (tz === 'America/Santiago') await checkCard(page, 'America/Santiago');
  if (tz === 'Europe/London') await checkCard(page, 'Europe/London');
  if (tz === 'Europe/Rome') {
    const shown = await hook(page, 'labels');
    const folded = ['Europe/Vatican', 'Europe/San_Marino', 'Europe/Monaco', 'Europe/Malta', 'Europe/Luxembourg', 'Europe/Busingen'].filter(id => shown.includes(id));
    check('W9 Rome: one clock for Italy, none for the microstates around it', shown.includes('Europe/Rome') && shown.includes('Europe/Paris') && folded.length === 0, folded.length ? 'labelled: ' + folded.join(' ') : '');
  }
  await checkAllClocks(page, `W2 now, as a ${label} user`, tz);
  check(`${label} run: no page errors`, errors.length === 0, errors.join('; '));
  await ctx.close();
}

// A phone opens on the region too.
{
  const { ctx, page } = await openAs('Asia/Singapore', { viewport: { width: 390, height: 844 } });
  await checkRegion(page, 'Singapore on a phone', 'Asia/Singapore', ['Asia/Jakarta', 'Asia/Kuala_Lumpur', 'Asia/Bangkok']);
  await ctx.close();
}

async function checkRegion(page, label, userZone, must) {
  const t = await hook(page, 'transform');
  const vp = page.viewportSize();
  const zones = await hook(page, 'zones');
  const onScreen = async id => {
    const z = zones.find(z => z.id === id);
    const [x, y] = await page.evaluate(([lon, lat]) => window.__worldclock.project(lon, lat), z.lp);
    const W = 1024 * t.k, xs = ((x % W) + W) % W;
    return [xs, xs - W, xs + W].some(xx => xx > 0 && xx < vp.width) && y > 0 && y < vp.height;
  };
  const seen = [];
  for (const z of zones) if (z.lp && z.tz && await onScreen(z.id)) seen.push(z);
  const offsets = new Set(seen.map(z => z.off));
  const missing = [];
  for (const id of must) if (!(await onScreen(id))) missing.push(id);
  check(`W6 ${label}: opens zoomed in on its own region`, t.k >= t.minK * 2.5 && await onScreen(userZone), `zoom ${(t.k / t.minK).toFixed(1)}× the world view`);
  check(`W6 ${label}: neighbours in other offsets are in view`, missing.length === 0 && offsets.size >= 3, `${offsets.size} offsets on screen` + (missing.length ? '; missing ' + missing.join(' ') : ''));
}

async function checkCard(page, id) {
  const z = (await hook(page, 'zones')).find(z => z.id === id);
  const [x, y] = await page.evaluate(([lon, lat]) => window.__worldclock.project(lon, lat), z.lp);
  const W = 1024 * (await hook(page, 'transform')).k, vp = page.viewportSize();
  const xs = [x, x - W, x + W].find(xx => xx > 0 && xx < vp.width);
  await page.mouse.move(5, 5);
  await page.mouse.move(xs, y);
  await page.waitForTimeout(150);
  const card = (await hook(page, 'card')) || '';
  const ms = await hook(page, 'displayMs');
  const cur = py({ off: [[id, ms]] }).off[0];
  const yr = wallOf(ms, cur).y;
  const [[jan, jul]] = py({ std: [[id, yr]] }).std;
  const [next] = py({ next: [[id, ms]] }).next;
  const dst = jan !== jul && cur > Math.min(jan, jul) ? 'On daylight saving time now.' : jan !== jul || next ? 'On standard time now.' : 'No daylight saving.';
  let want = dst;
  if (next) {
    const at = wallOf(next[0] - 60000, next[1]), d = next[2] - next[1], a = Math.abs(d);
    const size = (Math.floor(a / 60) ? Math.floor(a / 60) + ' h' : '') + (Math.floor(a / 60) && a % 60 ? ' ' : '') + (a % 60 ? a % 60 + ' min' : '');
    want += ` Clocks go ${d > 0 ? 'forward' : 'back'} ${size} on ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][at.wd]} ${p2(at.d)} ${MONTHS[at.mo].slice(0, 3)} ${at.y}.`;
  }
  check(`W5 ${id} card: ${gmt(cur)}, "${want}"`, card.includes(z.name) && card.includes(gmt(cur)) && card.includes(want), card.replace(/\n+/g, ' | '));
}

await browser.close();
server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
