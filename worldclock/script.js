/* ============================================================
   WORLD CLOCK — script.js
   Every clock on the map is read from the browser's own copy of
   the IANA time zone database (Intl.DateTimeFormat), so daylight
   saving is right today and on any date Time Travel picks. Nothing
   here hard-codes an offset.

   The map is zones.json: timezone-boundary-builder polygons, one
   per IANA zone, clipped to Natural Earth land (see _build/). It is
   drawn on two canvases in a plain Mercator projection: the base
   (sea, land, borders) redraws on pan and zoom, the label layer
   (clocks, hover, the time zone strip) also redraws on every tick.
   ============================================================ */
(function () {
'use strict';

const $ = id => document.getElementById(id);
const app = $('app');
const baseCv = $('baseCanvas'), labelCv = $('labelCanvas');
const bctx = baseCv.getContext('2d'), lctx = labelCv.getContext('2d');
const hitCtx = document.createElement('canvas').getContext('2d');
const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

// ── PROJECTION ───────────────────────────────────────────────────────────
// Mercator in "base units": the world is W wide. Meridians stay vertical,
// so the hour bands of the Time zones view are straight.
const W = 1024, RAD = Math.PI / 180, RW = W / (2 * Math.PI);
const projX = lon => (lon + 180) / 360 * W;
const projY = lat => W / 2 - RW * Math.log(Math.tan(Math.PI / 4 + Math.max(-85, Math.min(85, lat)) * RAD / 2));
const unprojX = x => x / W * 360 - 180;
const unprojY = y => (2 * Math.atan(Math.exp((W / 2 - y) / RW)) - Math.PI / 2) / RAD;
// The map runs from 82°N to 60°S. Antarctica keeps no clocks worth reading.
const Y0 = projY(82), Y1 = projY(-60), H = Y1 - Y0;

// Douglas–Peucker tolerance per level of detail, in base units. The coarse
// level serves the world view; the full data only once a base unit is
// several pixels wide.
const LOD_TOL = [0.35, 0.1, 0];
const MAX_K = 120;
// The Time zones view is a world view: zoom in past this multiple of the
// world zoom and the map hands back to Jurisdictions.
const TZ_MAX_ZOOM = 2.4;
const STRIP_H = 40;

// ── NAMES ────────────────────────────────────────────────────────────────
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON = MONTHS.map(m => m.slice(0, 3));
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const COUNTRY = { HK: 'Hong Kong', MO: 'Macau', MM: 'Myanmar', CD: 'DR Congo', CG: 'Congo', PS: 'Palestine', CI: 'Côte d’Ivoire', VA: 'Vatican City', FM: 'Micronesia', UM: 'US Outlying Islands' };
const CITY = {
  'America/St_Johns': 'St John’s', 'Asia/Ho_Chi_Minh': 'Ho Chi Minh City', 'Atlantic/Canary': 'Canary Islands',
  'Atlantic/Azores': 'Azores', 'Atlantic/Madeira': 'Madeira', 'Pacific/Galapagos': 'Galápagos', 'Pacific/Easter': 'Easter Island',
  'America/Argentina/Buenos_Aires': 'Buenos Aires', 'America/Indiana/Indianapolis': 'Indianapolis',
  'America/Kentucky/Louisville': 'Louisville', 'Australia/Lord_Howe': 'Lord Howe Island', 'Pacific/Chatham': 'Chatham Islands',
};
// Cities people search for that are not the name of a zone.
const EXTRA_PLACES = {
  'San Francisco': 'America/Los_Angeles', 'Seattle': 'America/Los_Angeles', 'Las Vegas': 'America/Los_Angeles', 'San Diego': 'America/Los_Angeles',
  'Washington DC': 'America/New_York', 'Boston': 'America/New_York', 'Atlanta': 'America/New_York', 'Miami': 'America/New_York',
  'Dallas': 'America/Chicago', 'Houston': 'America/Chicago', 'Austin': 'America/Chicago', 'Montreal': 'America/Toronto', 'Ottawa': 'America/Toronto',
  'Calgary': 'America/Edmonton', 'Rio de Janeiro': 'America/Sao_Paulo', 'Brasilia': 'America/Sao_Paulo',
  'Edinburgh': 'Europe/London', 'Manchester': 'Europe/London', 'Frankfurt': 'Europe/Berlin', 'Munich': 'Europe/Berlin', 'Milan': 'Europe/Rome',
  'Barcelona': 'Europe/Madrid', 'Geneva': 'Europe/Zurich', 'Abu Dhabi': 'Asia/Dubai', 'Mumbai': 'Asia/Kolkata', 'New Delhi': 'Asia/Kolkata',
  'Bengaluru': 'Asia/Kolkata', 'Bangalore': 'Asia/Kolkata', 'Chennai': 'Asia/Kolkata', 'Hyderabad': 'Asia/Kolkata', 'Beijing': 'Asia/Shanghai',
  'Shenzhen': 'Asia/Shanghai', 'Guangzhou': 'Asia/Shanghai', 'Hanoi': 'Asia/Ho_Chi_Minh', 'Osaka': 'Asia/Tokyo', 'Kyoto': 'Asia/Tokyo',
  'Busan': 'Asia/Seoul', 'Surabaya': 'Asia/Jakarta', 'Bandung': 'Asia/Jakarta', 'Yogyakarta': 'Asia/Jakarta', 'Medan': 'Asia/Jakarta',
  'Bali': 'Asia/Makassar', 'Denpasar': 'Asia/Makassar', 'Penang': 'Asia/Kuala_Lumpur', 'Canberra': 'Australia/Sydney',
  'Gold Coast': 'Australia/Brisbane', 'Cairns': 'Australia/Brisbane', 'Wellington': 'Pacific/Auckland', 'Christchurch': 'Pacific/Auckland',
  'Cape Town': 'Africa/Johannesburg',
};

// ── STATE ────────────────────────────────────────────────────────────────
let zones = [], byId = new Map(), aliases = {};
let arcsLod = [], arcCat = [], arcBox = [], arcOwners = [], meshCache = [];
let userTz = 'UTC', userFmt = null, userZone = null, userPlace = 'UTC', userOff = 0;
let view = 'jur';
let T = null;                  // d3 zoom transform
let zoom = null, minK = 1, flying = false;
let vw = 0, vh = 0, DPR = 1;
let hover = null, cardZone = null, cardPinned = false, cardAt = [0, 0], cardMap = null;
let showSeconds = false;
let displayMs = Date.now();
let travel = null, travelZone = null, tweenRaf = 0, tweening = false;
let lastMinute = -1, offsetSig = '';
let obstacles = [], padTop = 90, padBottom = 90;
let C = {}, hatchCache = new Map(), twCache = new Map();
let ready = false;

const p2 = n => String(n).padStart(2, '0');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const mod = (a, n) => ((a % n) + n) % n;

// ── TIME ─────────────────────────────────────────────────────────────────
function makeFmt(tz) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
  } catch (e) { return null; }
}

// Minutes the zone's wall clock is ahead of GMT at instant ms.
function offsetAt(fmt, ms) {
  const t = Math.floor(ms / 1000) * 1000;
  let y = 0, mo = 0, d = 0, h = 0, mi = 0, s = 0;
  for (const p of fmt.formatToParts(t)) {
    switch (p.type) {
      case 'year': y = +p.value; break;
      case 'month': mo = +p.value; break;
      case 'day': d = +p.value; break;
      case 'hour': h = +p.value % 24; break;
      case 'minute': mi = +p.value; break;
      case 'second': s = +p.value; break;
    }
  }
  return Math.round((Date.UTC(y, mo - 1, d, h, mi, s) - t) / 60000);
}

// The wall clock at instant ms for a zone offset, as calendar fields.
function wall(ms, off) {
  const d = new Date(ms + off * 60000);
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate(), wd: d.getUTCDay(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() };
}
const clock = w => p2(w.h) + ':' + p2(w.mi) + (showSeconds ? ':' + p2(w.s) : '');
const dayKey = w => w.y * 10000 + w.mo * 100 + w.d;
function gmt(off) {
  const a = Math.abs(off), h = Math.floor(a / 60), m = a % 60;
  return 'GMT' + (off < 0 ? '-' : '+') + h + (m ? ':' + p2(m) : '');
}
function span(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return (h ? h + ' h' : '') + (h && m ? ' ' : '') + (m ? m + ' min' : '');
}

// The instant a wall-clock time names in a zone. A time that happens twice
// (clocks going back) is read as the first one; a time that never happens
// (clocks going forward) is read with the old offset, so it lands just past
// the jump, as a phone's calendar does.
function wallToInstant(fmt, y, mo, d, h, mi) {
  const local = Date.UTC(y, mo - 1, d, h, mi);
  const before = offsetAt(fmt, local - 864e5), after = offsetAt(fmt, local + 864e5);
  const hits = [];
  for (const o of before === after ? [before] : [before, after]) {
    const t = local - o * 60000;
    if (offsetAt(fmt, t) === o) hits.push(t);
  }
  return hits.length ? Math.min(...hits) : local - before * 60000;
}

// Is the zone on daylight saving, and when do its clocks next change?
const dstCache = new Map();
function dstInfo(z, ms) {
  const key = z.i + ':' + Math.floor(ms / 36e5);
  if (dstCache.has(key)) return dstCache.get(key);
  const fmt = z.fmt, cur = offsetAt(fmt, ms);
  const yr = wall(ms, cur).y;
  const jan = offsetAt(fmt, Date.UTC(yr, 0, 1)), jul = offsetAt(fmt, Date.UTC(yr, 6, 1));
  let next = null, prev = cur;
  for (let day = 1; day <= 400 && !next; day++) {
    const t2 = ms + day * 864e5, o = offsetAt(fmt, t2);
    if (o === prev) continue;
    let lo = t2 - 864e5, hi = t2;
    while (hi - lo > 60000) {
      const mid = Math.floor((lo + hi) / 120000) * 60000;
      if (mid <= lo) break;
      if (offsetAt(fmt, mid) === prev) lo = mid; else hi = mid;
    }
    next = { at: hi, from: prev, to: o };
  }
  const info = { inDst: jan !== jul && cur > Math.min(jan, jul), observes: jan !== jul, next };
  if (dstCache.size > 2000) dstCache.clear();
  dstCache.set(key, info);
  return info;
}

// ── COLOURS ──────────────────────────────────────────────────────────────
function readColors() {
  const cs = getComputedStyle(document.body);
  const v = n => cs.getPropertyValue(n).trim();
  C = {
    sea: v('--wc-sea'), seaAlt: v('--wc-sea-alt'), land: v('--wc-land'), you: v('--wc-you'),
    coast: v('--wc-coast'), border: v('--wc-border'), inner: v('--wc-inner'), timeLine: v('--wc-time-line'),
    hover: v('--wc-hover'), hoverLine: v('--wc-hover-line'),
    label: v('--wc-label'), muted: v('--wc-label-muted'), youText: v('--wc-you-text'),
    panel: v('--panel'), line: v('--border'),
    tz: [0, 1, 2, 3, 4, 5].map(i => v('--wc-tz-' + i)),
  };
  hatchCache.clear();
}
const tzIndex = off => mod(Math.floor(off / 60), 6);
// A zone on a half or quarter hour is striped in the colours of the two
// whole hours it sits between, as on a printed time zone map.
function hatch(i) {
  const key = i + ':' + DPR;
  if (hatchCache.has(key)) return hatchCache.get(key);
  const s = Math.round(9 * DPR), c = document.createElement('canvas');
  c.width = c.height = s;
  const x = c.getContext('2d');
  x.fillStyle = C.tz[i]; x.fillRect(0, 0, s, s);
  x.strokeStyle = C.tz[(i + 1) % 6]; x.lineWidth = s * 0.34;
  x.beginPath();
  for (const o of [-s, 0, s]) { x.moveTo(o, s); x.lineTo(o + s, 0); }
  x.stroke();
  const pat = bctx.createPattern(c, 'repeat');
  hatchCache.set(key, pat);
  return pat;
}
function tzFill(off, forText) {
  const i = tzIndex(off);
  if (off % 60 === 0 || forText) return C.tz[i];
  const pat = hatch(i);
  if (pat.setTransform) pat.setTransform(new DOMMatrix([1 / (T.k * DPR), 0, 0, 1 / (T.k * DPR), 0, 0]));
  return pat;
}
function zoneFill(z, forText) {
  if (view === 'tz' && z.fmt) return tzFill(z.off, forText);
  return z === userZone ? C.you : C.land;
}

// ── MAP DATA ─────────────────────────────────────────────────────────────
function simplify(a, tol) {
  const n = a.length / 2;
  if (!tol || n <= 2) return a;
  const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
  const stack = [0, n - 1], t2 = tol * tol;
  while (stack.length) {
    const b = stack.pop(), s = stack.pop();
    const ax = a[2 * s], ay = a[2 * s + 1], dx = a[2 * b] - ax, dy = a[2 * b + 1] - ay, L = dx * dx + dy * dy;
    let max = 0, idx = -1;
    for (let i = s + 1; i < b; i++) {
      const px = a[2 * i] - ax, py = a[2 * i + 1] - ay;
      let u = L ? (px * dx + py * dy) / L : 0;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const ex = px - u * dx, ey = py - u * dy, d = ex * ex + ey * ey;
      if (d > max) { max = d; idx = i; }
    }
    if (max > t2) { keep[idx] = 1; stack.push(s, idx, idx, b); }
  }
  let m = 0;
  for (let i = 0; i < n; i++) m += keep[i];
  const out = new Float64Array(m * 2);
  for (let i = 0, j = 0; i < n; i++) if (keep[i]) { out[j++] = a[2 * i]; out[j++] = a[2 * i + 1]; }
  return out;
}
function arcsAt(l) {
  if (!arcsLod[l]) arcsLod[l] = arcsLod[LOD_TOL.length - 1].map(a => simplify(a, LOD_TOL[l]));
  return arcsLod[l];
}
function ringPoints(ring, arcs) {
  const pts = [];
  ring.forEach((i, j) => {
    const a = arcs[i < 0 ? ~i : i], n = a.length / 2;
    if (i >= 0) for (let p = j ? 1 : 0; p < n; p++) pts.push(a[2 * p], a[2 * p + 1]);
    else for (let p = n - (j ? 2 : 1); p >= 0; p--) pts.push(a[2 * p], a[2 * p + 1]);
  });
  return pts;
}
function zonePath(z, l) {
  if (z.paths[l]) return z.paths[l];
  const arcs = arcsAt(l), path = new Path2D();
  for (const poly of z.polys) for (const ring of poly) {
    const pts = ringPoints(ring, arcs);
    if (pts.length < 6) continue;
    path.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) path.lineTo(pts[i], pts[i + 1]);
    path.closePath();
  }
  return (z.paths[l] = path);
}
// Borders, bucketed by kind and by grid cell so a zoomed-in view strokes
// only the cells it can see. Kind 0 coast; 1 a country border and 2 a state
// line, both with the same time on each side; 3 a border the clock changes
// across. Kinds follow the clocks (see updateBorders), so a line can turn
// into a time border when one side starts daylight saving.
function meshes(l) {
  if (meshCache[l]) return meshCache[l];
  const arcs = arcsAt(l), GX = 16, GY = 8, cells = new Map();
  arcs.forEach((a, i) => {
    const kind = arcCat[i], bb = arcBox[i];
    if (kind < 0 || a.length < 4) return;
    const gx = Math.min(GX - 1, Math.max(0, Math.floor((bb[0] + bb[2]) / 2 / W * GX)));
    const gy = Math.min(GY - 1, Math.max(0, Math.floor(((bb[1] + bb[3]) / 2 - Y0) / H * GY)));
    const key = kind * 1000 + gy * GX + gx;
    let c = cells.get(key);
    if (!c) cells.set(key, c = { kind, path: new Path2D(), box: [Infinity, Infinity, -Infinity, -Infinity] });
    c.path.moveTo(a[0], a[1]);
    for (let p = 2; p < a.length; p += 2) c.path.lineTo(a[p], a[p + 1]);
    c.box[0] = Math.min(c.box[0], bb[0]); c.box[1] = Math.min(c.box[1], bb[1]);
    c.box[2] = Math.max(c.box[2], bb[2]); c.box[3] = Math.max(c.box[3], bb[3]);
  });
  return (meshCache[l] = [...cells.values()].sort((a, b) => a.kind - b.kind));
}
const ringArea = pts => { let s = 0; for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) s += (pts[j] + pts[i]) * (pts[j + 1] - pts[i + 1]); return Math.abs(s / 2); };
function inRing(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const regionNames = (() => { try { return new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) { return null; } })();
function countryName(cc) {
  if (COUNTRY[cc]) return COUNTRY[cc];
  try { return (regionNames && regionNames.of(cc)) || cc; } catch (e) { return cc; }
}
function cityName(id) {
  if (CITY[id]) return CITY[id];
  const parts = id.split('/'), last = parts[parts.length - 1].replace(/_/g, ' ');
  return parts.length === 3 && parts[1] !== 'Argentina' ? last + ', ' + parts[1].replace(/_/g, ' ') : last;
}

function build(topo) {
  aliases = (topo.meta && topo.meta.aliases) || {};
  const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
  const full = topo.arcs.map(arc => {
    const out = new Float64Array(arc.length * 2);
    let x = 0, y = 0;
    for (let i = 0; i < arc.length; i++) {
      x += arc[i][0]; y += arc[i][1];
      out[2 * i] = projX(x * sx + tx); out[2 * i + 1] = projY(y * sy + ty);
    }
    return out;
  });
  arcsLod = []; arcsLod[LOD_TOL.length - 1] = full;
  arcBox = full.map(a => {
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    for (let i = 0; i < a.length; i += 2) {
      if (a[i] < b[0]) b[0] = a[i]; if (a[i] > b[2]) b[2] = a[i];
      if (a[i + 1] < b[1]) b[1] = a[i + 1]; if (a[i + 1] > b[3]) b[3] = a[i + 1];
    }
    return b;
  });
  const owners = full.map(() => []);
  const geoms = topo.objects.zones.geometries;
  const reverseAlias = {};
  for (const [old, cur] of Object.entries(aliases)) (reverseAlias[cur] = reverseAlias[cur] || []).push(old);
  const perCc = {};
  geoms.forEach(g => { perCc[g.properties.cc] = (perCc[g.properties.cc] || 0) + 1; });

  zones = geoms.map((g, i) => {
    const pr = g.properties;
    const polys = g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
    polys.forEach(p => p.forEach(r => r.forEach(a => { const o = owners[a < 0 ? ~a : a]; if (!o.includes(i)) o.push(i); })));
    // The name the browser knows it by: the zone itself, else an old name
    // for it (an older browser may know Europe/Kiev but not Europe/Kyiv).
    let tz = null, fmt = null;
    for (const cand of [pr.id].concat(reverseAlias[pr.id] || [])) { fmt = makeFmt(cand); if (fmt) { tz = cand; break; } }
    const country = countryName(pr.cc), city = cityName(pr.id);
    const z = {
      i, id: pr.id, cc: pr.cc, tz, fmt, name: city, country, city, trueArea: 0,
      lp: pr.lp, lpx: pr.lp ? projX(pr.lp[0]) : 0, lpy: pr.lp ? projY(pr.lp[1]) : 0,
      polys, paths: [], hasGeom: polys.length > 0, parts: [], lpArea: 0,
      bbox: [Infinity, Infinity, -Infinity, -Infinity], off: 0, timeStr: '', dateStr: '',
    };
    let bestArea = 0;
    for (const poly of polys) {
      const outer = ringPoints(poly[0], full);
      const b = [Infinity, Infinity, -Infinity, -Infinity];
      for (let p = 0; p < outer.length; p += 2) {
        if (outer[p] < b[0]) b[0] = outer[p]; if (outer[p] > b[2]) b[2] = outer[p];
        if (outer[p + 1] < b[1]) b[1] = outer[p + 1]; if (outer[p + 1] > b[3]) b[3] = outer[p + 1];
      }
      for (let q = 0; q < 2; q++) { z.bbox[q] = Math.min(z.bbox[q], b[q]); z.bbox[q + 2] = Math.max(z.bbox[q + 2], b[q + 2]); }
      const area = ringArea(outer), lat = unprojY((b[1] + b[3]) / 2);
      // Mercator inflates area by 1/cos²(latitude); undo it for comparisons.
      const trueArea = area * Math.cos(lat * RAD) ** 2;
      z.trueArea += trueArea;
      z.parts.push({ box: b, lon: unprojX((b[0] + b[2]) / 2), lat, area: trueArea });
      // Label size follows the polygon the label sits in.
      if (inRing(z.lpx, z.lpy, outer)) z.lpArea = Math.max(z.lpArea, area);
      bestArea = Math.max(bestArea, area);
    }
    if (!z.lpArea) z.lpArea = bestArea;
    z.search = norm([country, city, pr.id.replace(/_/g, ' ')].concat((reverseAlias[pr.id] || []).map(a => a.split('/').pop().replace(/_/g, ' '))).join(' | '));
    return z;
  });
  arcOwners = owners;
  arcCat = owners.map(() => -2);
  zones.forEach(z => {
    byId.set(z.id, z);
    // A zone with nothing but coastline is an island and is drawn as a dot
    // once it is too small to see. A zone with no land left at this scale
    // (an atoll, Monaco) is a dot too, unless it sits inside another zone.
    z.island = z.hasGeom
      ? z.polys.every(p => p.every(r => r.every(a => owners[a < 0 ? ~a : a].length === 1)))
      : !zones.some(o => o.hasGeom && o !== z && o.bbox[0] <= z.lpx && z.lpx <= o.bbox[2] && o.bbox[1] <= z.lpy && z.lpy <= o.bbox[3] && hitCtx.isPointInPath(zonePath(o, 2), z.lpx, z.lpy, 'evenodd'));
    z.showable = !!z.fmt && (z.hasGeom || z.island);
  });
  // A zone is named after its country when it is most of that country
  // (China, not Shanghai; Spain, not Madrid), after its city otherwise
  // (Perth, Sydney). Shares are only compared when no island of that country
  // is too small to have a shape here: Kiritimati is not most of Kiribati just
  // because Tarawa's atoll cannot be drawn. An enclave (Büsingen) does not count.
  const ccArea = {}, ccKnown = {};
  zones.forEach(z => {
    ccArea[z.cc] = (ccArea[z.cc] || 0) + z.trueArea;
    ccKnown[z.cc] = ccKnown[z.cc] !== false && (z.hasGeom || !z.island);
  });
  zones.forEach(z => { if (perCc[z.cc] === 1 || (ccKnown[z.cc] && z.trueArea >= 0.75 * ccArea[z.cc])) z.name = z.country; });

  // Microstates and atolls fold into a bigger neighbour: a place under
  // 5,000 km² with a larger zone within 300 km gets no clock of its own
  // while the two read the same time (Vatican City and Italy, Jersey and the
  // UK, Singapore and Malaysia). Lord Howe or the Chathams, on a clock of
  // their own, keep theirs.
  const KM_PER_UNIT = 40075 / W;
  zones.forEach(z => {
    z.km2 = z.trueArea * KM_PER_UNIT * KM_PER_UNIT;
    z.near = [];
  });
  zones.forEach(z => {
    if (z.km2 >= 5000 || !z.lp) return;
    const reach = 300 / KM_PER_UNIT / Math.cos(z.lp[1] * RAD);
    for (const o of zones) {
      if (o === z || !o.hasGeom || o.km2 <= z.km2) continue;
      const b = o.bbox;
      if (z.lpx < b[0] - reach || z.lpx > b[2] + reach || z.lpy < b[1] - reach || z.lpy > b[3] + reach) continue;
      let best = Infinity;
      for (const poly of o.polys) {
        const pts = ringPoints(poly[0], full);
        for (let q = 0; q < pts.length; q += 2) best = Math.min(best, (pts[q] - z.lpx) ** 2 + (pts[q + 1] - z.lpy) ** 2);
      }
      if (Math.sqrt(best) <= reach || hitCtx.isPointInPath(zonePath(o, 2), z.lpx, z.lpy, 'evenodd')) z.near.push(o);
    }
  });
}
const folded = z => z !== userZone && z.near.some(o => o.fmt && o.off === z.off);

// Border kinds from the clocks on either side, now.
function updateBorders() {
  let changed = false;
  for (let i = 0; i < arcOwners.length; i++) {
    const o = arcOwners[i];
    let kind = -1;
    if (o.length === 1) kind = 0;
    else if (o.length === 2) {
      const a = zones[o[0]], b = zones[o[1]];
      kind = a.fmt && b.fmt && a.off !== b.off ? 3 : a.cc === b.cc ? 2 : 1;
    }
    if (arcCat[i] !== kind) { arcCat[i] = kind; changed = true; }
  }
  if (changed) meshCache = [];
  return changed;
}

// ── THE USER ─────────────────────────────────────────────────────────────
function resolveUser() {
  try { userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { userTz = 'UTC'; }
  userFmt = makeFmt(userTz) || makeFmt('UTC');
  userZone = byId.get(userTz) || byId.get(aliases[userTz]) || null;
  if (userZone && !userZone.fmt) userZone = null;
  userPlace = userZone ? userZone.name : /UTC|GMT|Universal|Zulu/.test(userTz) ? 'UTC' : cityName(userTz);
}

// ── CLOCKS ───────────────────────────────────────────────────────────────
function computeOffsets() {
  let sig = '';
  for (const z of zones) if (z.fmt) { z.off = offsetAt(z.fmt, displayMs); sig += z.off + ','; }
  const changed = sig !== offsetSig;
  offsetSig = sig;
  return changed;
}
function refreshTime(force) {
  if (!ready) return;
  const minute = Math.floor(displayMs / 60000);
  let offChanged = false;
  if (force || minute !== lastMinute) {
    lastMinute = minute;
    offChanged = computeOffsets();
    if (offChanged) updateBorders();
  }
  userOff = offsetAt(userFmt, displayMs);
  const uw = wall(displayMs, userOff), uKey = dayKey(uw);
  let changed = false;
  for (const z of zones) {
    if (!z.fmt) continue;
    const w = wall(displayMs, z.off);
    const t = clock(w), d = dayKey(w) === uKey ? '' : p2(w.d) + ' ' + MON[w.mo];
    if (t !== z.timeStr || d !== z.dateStr) { z.timeStr = t; z.dateStr = d; changed = true; }
  }
  renderNow(uw);
  if (changed || offChanged) requestDraw(offChanged);
  if (cardZone && !$('placeCard').hidden) renderCard();
}
const nowEls = {};
function renderNow(w) {
  if (!nowEls.date) {
    $('nowText').innerHTML = '<span class="wc-now-date"></span> <span class="wc-now-clock"></span> <span class="wc-now-zone"></span>';
    nowEls.date = $('nowText').querySelector('.wc-now-date');
    nowEls.clock = $('nowText').querySelector('.wc-now-clock');
    nowEls.zone = $('nowText').querySelector('.wc-now-zone');
  }
  const date = p2(w.d) + ' ' + MONTHS[w.mo] + ' ' + w.y, zoneTxt = '(' + gmt(userOff) + ', ' + userPlace + ')', c = clock(w);
  if (nowEls.date.textContent !== date) nowEls.date.textContent = date;
  if (nowEls.clock.textContent !== c) nowEls.clock.textContent = c;
  if (nowEls.zone.textContent !== zoneTxt) nowEls.zone.textContent = zoneTxt;
}
let tickTimer = 0;
function tick() {
  clearTimeout(tickTimer);
  if (!travel && !tweening) { displayMs = Date.now(); refreshTime(false); }
  tickTimer = setTimeout(tick, 1000 - (Date.now() % 1000) + 10);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

// ── DRAWING ──────────────────────────────────────────────────────────────
let needBase = false, rafId = 0;
function requestDraw(base) {
  if (base !== false) needBase = true;
  if (!rafId) rafId = requestAnimationFrame(frame);
}
function frame() {
  rafId = 0;
  if (!ready) return;
  if (needBase) drawBase();
  needBase = false;
  drawLabels();
}
function lodFor(k) {
  for (let l = 0; l < LOD_TOL.length - 1; l++) if (LOD_TOL[l] * k <= 0.5) return l;
  return LOD_TOL.length - 1;
}
function copies() {
  const wk = W * T.k, out = [];
  for (let c = Math.floor(-T.x / wk); c <= Math.floor((vw - T.x) / wk); c++) out.push(c);
  return out;
}
function bandX(lon, c) { return T.x + (projX(lon) + c * W) * T.k; }

function drawBase() {
  const ctx = bctx, k = T.k, l = lodFor(k);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = C.sea;
  ctx.fillRect(0, 0, vw, vh);
  const cs = copies();
  if (view === 'tz') {
    // Nautical hour bands in the sea, 15° each, centred on every 15th meridian.
    ctx.fillStyle = C.seaAlt;
    for (const c of cs) for (let n = -11; n <= 11; n += 2) {
      const a = bandX((n - 0.5) * 15, c), b = bandX((n + 0.5) * 15, c);
      if (b > 0 && a < vw) ctx.fillRect(a, 0, b - a, vh);
    }
  }
  for (const c of cs) {
    const ox = T.x + c * W * k;
    ctx.setTransform(DPR * k, 0, 0, DPR * k, DPR * ox, DPR * T.y);
    const x0 = -ox / k, x1 = (vw - ox) / k, y0 = -T.y / k, y1 = (vh - T.y) / k;
    for (const z of zones) {
      const b = z.bbox;
      if (!z.hasGeom || b[2] < x0 || b[0] > x1 || b[3] < y0 || b[1] > y1) continue;
      ctx.fillStyle = zoneFill(z);
      ctx.fill(zonePath(z, l), 'evenodd');
    }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    let kind = -1;
    for (const cell of meshes(l)) {
      const b = cell.box;
      if (b[2] < x0 || b[0] > x1 || b[3] < y0 || b[1] > y1) continue;
      if (cell.kind !== kind) {
        kind = cell.kind;
        if (kind === 0) { ctx.strokeStyle = C.coast; ctx.lineWidth = 0.8 / k; ctx.setLineDash([]); }
        else if (kind === 3) { ctx.strokeStyle = C.timeLine; ctx.lineWidth = (k > minK * 2.5 ? 1.8 : 1.3) / k; ctx.setLineDash([]); }
        else if (kind === 1) { ctx.strokeStyle = C.border; ctx.lineWidth = 0.9 / k; ctx.setLineDash([]); }
        // Same-time state lines are dashed once there is room for the dashes.
        else { ctx.strokeStyle = C.inner; ctx.lineWidth = 0.9 / k; ctx.setLineDash(k > minK * 2.5 ? [3 / k, 2.5 / k] : []); }
      }
      ctx.stroke(cell.path);
    }
    ctx.setLineDash([]);
    if (view === 'tz') {
      // The 180th meridian, where the ±12 bands meet and the date flips.
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const x = T.x + (c + 1) * W * k;
      if (x > -2 && x < vw + 2) {
        ctx.strokeStyle = C.label; ctx.globalAlpha = 0.35; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, vh); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
    }
  }
}

const F_NAME = '600 10.5px "DM Sans", system-ui, sans-serif';
const F_TIME = '600 13px "DM Mono", ui-monospace, monospace';
const F_YOU = '700 14px "DM Mono", ui-monospace, monospace';
const F_DATE = '500 10px "DM Mono", ui-monospace, monospace';
const F_STRIP = '600 10.5px "DM Sans", system-ui, sans-serif';
function tw(font, s) {
  const key = font + '|' + (font.indexOf('Mono') > 0 ? s.replace(/\d/g, '0') : s);
  let w = twCache.get(key);
  if (w === undefined) { lctx.font = font; w = lctx.measureText(s).width; twCache.set(key, w); }
  return w;
}
const screenSize = (z, k) => Math.max(z.bbox[2] - z.bbox[0], z.bbox[3] - z.bbox[1]) * k;
// Islands too small to see get a dot, and a label pinned just above them
// out over the sea. On the world view only islands of 5,000 km² or more do
// (Hawaii, Fiji, New Zealand); atolls wait until you zoom in. Your own zone
// always does.
const regional = k => k > minK * 2;
const pinnable = (z, k) => z.island && (regional(k) || z === userZone || z.km2 >= 5000);
const isDotNow = (z, k) => pinnable(z, k) && (!z.hasGeom || screenSize(z, k) < 5);
const isPinNow = (z, k) => pinnable(z, k) && (!z.hasGeom || screenSize(z, k) < 40 || z.lpArea * k * k < 260);
let lastLabels = [];

function drawLabels() {
  const ctx = lctx, k = T.k, cs = copies();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, vw, vh);
  if (hover && hover.hasGeom) {
    for (const c of cs) {
      ctx.setTransform(DPR * k, 0, 0, DPR * k, DPR * (T.x + c * W * k), DPR * T.y);
      const p = zonePath(hover, lodFor(k));
      ctx.fillStyle = C.hover; ctx.fill(p, 'evenodd');
      ctx.strokeStyle = C.hoverLine; ctx.lineWidth = 1.6 / k; ctx.stroke(p);
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  const cands = [];
  for (const c of cs) {
    const ox = T.x + c * W * k;
    for (const z of zones) {
      if (!z.showable || !z.lp || folded(z)) continue;
      const sx = ox + z.lpx * k, sy = T.y + z.lpy * k;
      if (sx < -120 || sx > vw + 120 || sy < -60 || sy > vh + 60) continue;
      const dot = isDotNow(z, k);
      if (dot) {
        ctx.beginPath(); ctx.arc(sx, sy, z === hover ? 4.5 : 3.2, 0, 2 * Math.PI);
        ctx.fillStyle = zoneFill(z, true); ctx.fill();
        ctx.lineWidth = z === hover || z === userZone ? 2 : 1.2;
        ctx.strokeStyle = z === hover ? C.hoverLine : z === userZone ? C.youText : C.coast; ctx.stroke();
      }
      const area = z.lpArea * k * k, pin = isPinNow(z, k);
      cands.push({ z, sx, sy, dot, pin, area, pri: z === userZone ? Infinity : pin ? area * 0.25 : area });
    }
  }
  cands.sort((a, b) => b.pri - a.pri);

  const placed = [], tzv = view === 'tz';
  const hits = b => {
    for (const o of obstacles) if (b.x < o[2] && b.x + b.w > o[0] && b.y < o[3] && b.y + b.h > o[1]) return true;
    for (const p of placed) if (b.x < p.x + p.w + 3 && b.x + b.w + 3 > p.x && b.y < p.y + p.h + 2 && b.y + b.h + 2 > p.y) return true;
    return false;
  };
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  for (const cd of cands) {
    const z = cd.z, you = z === userZone;
    if (!z.timeStr) continue;
    if (!cd.pin && !you && cd.area < 260) continue;
    const head = tzv ? gmt(z.off) : z.name;
    const timeFont = you ? F_YOU : F_TIME;
    const tries = you || cd.pin || tzv || cd.area > 2200 ? [true, false] : [false];
    for (const withName of tries) {
      const lines = [];
      if (withName) lines.push({ t: head, f: F_NAME, h: 13, c: you && !tzv ? C.youText : C.muted });
      lines.push({ t: z.timeStr, f: timeFont, h: you ? 17 : 15, c: you ? C.youText : C.label });
      if (z.dateStr) lines.push({ t: z.dateStr, f: F_DATE, h: 12, c: C.muted });
      let w = 0, h = 0;
      for (const ln of lines) { w = Math.max(w, tw(ln.f, ln.t)); h += ln.h; }
      w += 6; h += 2;
      // A pinned label clears the island: its own dot, or half its height.
      const lift = cd.pin ? (cd.dot ? 7 : Math.max(7, (z.lpy - z.bbox[1]) * T.k + 4)) : 0;
      const box = { x: cd.sx - w / 2, y: cd.pin ? cd.sy - lift - h : cd.sy - h / 2, w, h, key: head };
      if (box.x < 2 || box.y < 2 || box.x + w > vw - 2 || box.y + h > vh - 2 || hits(box)) continue;
      if (tzv && placed.some(p => p.key === head && Math.hypot(p.x - box.x, p.y - box.y) < 260)) break;
      // One clock is enough for neighbouring zones of one country that read
      // the same time (Argentina's provinces, Indiana's counties).
      if (!tzv && !you && placed.some(p => p.cc === z.cc && p.time === z.timeStr && Math.hypot(p.cx - cd.sx, p.cy - cd.sy) < 90)) break;
      Object.assign(box, { id: z.id, cc: z.cc, time: z.timeStr, cx: cd.sx, cy: cd.sy });
      placed.push(box);
      const halo = zoneFill(z, true);
      if (cd.pin) {
        ctx.fillStyle = halo; ctx.globalAlpha = 0.92;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(box.x - 2, box.y, box.w + 4, box.h, 6); else ctx.rect(box.x - 2, box.y, box.w + 4, box.h);
        ctx.fill(); ctx.globalAlpha = 1;
      }
      let y = box.y + 1;
      for (const ln of lines) {
        ctx.font = ln.f;
        if (!cd.pin) { ctx.lineWidth = 3.2; ctx.strokeStyle = halo; ctx.strokeText(ln.t, cd.sx, y + ln.h / 2); }
        ctx.fillStyle = ln.c; ctx.fillText(ln.t, cd.sx, y + ln.h / 2);
        y += ln.h;
      }
      break;
    }
  }
  lastLabels = placed.map(p => p.id);
  if (tzv) drawStrip(ctx, cs);
}

// Time zones view: the strip along the top reads the time in each nautical
// hour band. Its colours are the colours of the land on that offset.
function drawStrip(ctx, cs) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = C.panel;
  ctx.fillRect(0, 0, vw, STRIP_H);
  const bandW = 15 / 360 * W * T.k;
  // Too narrow to label every band: label every other one.
  const step = bandW < 30 ? 2 : 1;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const c of cs.concat([cs[cs.length - 1] + 1, cs[0] - 1])) {
    for (let n = -12; n <= 12; n++) {
      const a = bandX(Math.max(-180, (n - 0.5) * 15), c), b = bandX(Math.min(180, (n + 0.5) * 15), c);
      if (b < 0 || a > vw) continue;
      ctx.fillStyle = C.tz[tzIndex(n * 60)];
      ctx.fillRect(a, 0, b - a, STRIP_H);
      ctx.fillStyle = C.line; ctx.fillRect(Math.round(a), 0, 1, STRIP_H);
      const half = Math.abs(n) === 12, room = half ? bandW / 2 : bandW * step;
      if (n % step || room < 22) continue;
      const cx = (a + b) / 2;
      ctx.fillStyle = C.muted; ctx.font = F_STRIP;
      ctx.fillText(room >= 60 ? gmt(n * 60) : n === 0 ? '0' : (n > 0 ? '+' : '−') + Math.abs(n), cx, 12);
      const tm = clock(wall(displayMs, n * 60));
      if (tw(F_TIME, tm) + 6 <= room) { ctx.fillStyle = C.label; ctx.font = F_TIME; ctx.fillText(tm, cx, 27); }
    }
  }
  ctx.fillStyle = C.line; ctx.fillRect(0, STRIP_H - 1, vw, 1);
}

// ── ZOOM / PAN ───────────────────────────────────────────────────────────
// North and south the map stops at its crop lines, but may slide until they
// meet the cards on top and the controls below, so a place near the edge (New
// Zealand, Patagonia) can still be brought clear of them.
function constrain(t) {
  const k = t.k;
  const lo = vh - Math.max(0, padBottom - 10) - Y1 * k, hi = Math.max(0, padTop - 10) - Y0 * k;
  const y = lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, t.y));
  return y === t.y ? t : d3.zoomIdentity.translate(t.x, y).scale(k);
}
function centreX() { return (vw / 2 - T.x) / T.k; }
// Of the endless copies of a place to the left and right, the nearest one.
function nearCopy(x) { const c = centreX(); return x + Math.round((c - x) / W) * W; }
function boxTransform(box) {
  const padL = 16, padR = vw > 640 ? 64 : 16;
  const aw = Math.max(80, vw - padL - padR), ah = Math.max(80, vh - padTop - padBottom);
  const bw = box[2] - box[0], bh = box[3] - box[1];
  const k = Math.max(minK, Math.min(MAX_K, Math.min(aw / bw, ah / bh)));
  const cx = nearCopy((box[0] + box[2]) / 2), cy = (box[1] + box[3]) / 2;
  return constrain(d3.zoomIdentity.translate(padL + aw / 2 - cx * k, padTop + ah / 2 - cy * k).scale(k));
}
function worldTransform(cx) {
  const y = (padTop + vh - padBottom) / 2 - (Y0 + H / 2) * minK;
  return constrain(d3.zoomIdentity.translate(vw / 2 - cx * minK, y).scale(minK));
}
const km = (lon1, lat1, lon2, lat2) => {
  const a = Math.sin((lat2 - lat1) * RAD / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin((lon2 - lon1) * RAD / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
};
// Your country, as much of it as lies within 4,000 km of you, widened to at
// least 60° by 30° (44° wide on a phone) so that a small or single-zone country shows its
// neighbours: Singapore opens on South-East Asia, Perth on Australia.
function focusBox() {
  const z = userZone;
  if (!z || !z.lp) return null;
  const own = [];
  for (const o of zones) {
    if (o.cc !== z.cc) continue;
    for (const p of o.parts) { const d = km(p.lon, p.lat, z.lp[0], z.lp[1]); if (d <= 4000) own.push([p, d]); }
  }
  // Specks far from you (sub-Antarctic islands, Easter Island for Santiago)
  // do not stretch the frame.
  const big = Math.max(0, ...own.map(([p]) => p.area));
  let b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [p, d] of own) {
    if (p.area < big * 0.005 && d > 600) continue;
    const shift = Math.round((z.lpx - (p.box[0] + p.box[2]) / 2) / W) * W;
    b = [Math.min(b[0], p.box[0] + shift), Math.min(b[1], p.box[1]), Math.max(b[2], p.box[2] + shift), Math.max(b[3], p.box[3])];
  }
  if (!isFinite(b[0])) b = [z.lpx, z.lpy, z.lpx, z.lpy];
  let cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
  // Phones get a tighter frame: on a narrow screen 60° leaves your own
  // country small.
  const minW = W * (vw < 700 ? 44 : 60) / 360;
  const w = Math.max(b[2] - b[0], minW) * 1.06, h = Math.max(b[3] - b[1], W / 12) * 1.06;
  // Widening adds room; spend it on the side where the neighbours are (a
  // Londoner sees Europe, not the Atlantic). The country stays in view.
  // Each neighbouring jurisdiction pulls by the square root of its size, so
  // Fiji and Tonga still count for a New Zealander next to all of Australia.
  let sx = 0, sy = 0, sw = 0;
  for (const o of zones) {
    if (o.cc === z.cc) continue;
    let ox = 0, oy = 0, oa = 0;
    for (const p of o.parts) {
      if (km(p.lon, p.lat, z.lp[0], z.lp[1]) > 3000) continue;
      ox += (projX(p.lon) + Math.round((z.lpx - projX(p.lon)) / W) * W) * p.area; oy += projY(p.lat) * p.area; oa += p.area;
    }
    if (!oa) continue;
    const wgt = Math.sqrt(oa);
    sx += ox / oa * wgt; sy += oy / oa * wgt; sw += wgt;
  }
  // At most half the spare room, so your own country never ends up pinned
  // to an edge of the screen.
  if (sw) {
    const room = (a, lim) => Math.max(-lim, Math.min(lim, a));
    cx += room(sx / sw - cx, (w / 1.06 - (b[2] - b[0])) / 4);
    cy += room(sy / sw - cy, (h / 1.06 - (b[3] - b[1])) / 4);
  }
  return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
}
function homeTransform() {
  const box = focusBox();
  return box ? boxTransform(box) : worldTransform(centreX());
}
function flyTo(target, dur) {
  const sel = d3.select(labelCv);
  if (reduceMotion || !dur) { sel.interrupt(); sel.call(zoom.transform, target); return Promise.resolve(); }
  flying = true;
  return sel.transition().duration(dur).ease(d3.easeCubicInOut).call(zoom.transform, target)
    .end().catch(() => {}).then(() => { flying = false; });
}
function onZoom(ev) {
  T = ev.transform;
  if (view === 'tz' && !flying && T.k > minK * TZ_MAX_ZOOM) setView('jur');
  if (!cardPinned) hideCard();
  else followCard();
  requestDraw(true);
}

// ── HOVER / TAP ──────────────────────────────────────────────────────────
function zoneAt(sx, sy) {
  const k = T.k;
  let best = null, bestD = 12 * 12;
  for (const c of copies()) {
    const ox = T.x + c * W * k;
    for (const z of zones) {
      if (!z.showable || folded(z) || !isDotNow(z, k)) continue;
      const d = (ox + z.lpx * k - sx) ** 2 + (T.y + z.lpy * k - sy) ** 2;
      if (d < bestD) { bestD = d; best = z; }
    }
  }
  if (best) return best;
  const bx = mod((sx - T.x) / k, W), by = (sy - T.y) / k;
  for (const z of zones) {
    const b = z.bbox;
    if (!z.hasGeom || bx < b[0] || bx > b[2] || by < b[1] || by > b[3]) continue;
    if (hitCtx.isPointInPath(zonePath(z, 2), bx, by, 'evenodd')) return z;
  }
  return null;
}
function relText(z) {
  if (z === userZone) return 'Your time zone';
  const d = z.off - userOff;
  return d === 0 ? 'Same time as you' : span(Math.abs(d)) + (d > 0 ? ' ahead of you' : ' behind you');
}
function zoneLongName(z) {
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: z.tz, timeZoneName: 'long' }).formatToParts(displayMs).find(x => x.type === 'timeZoneName');
    return p && !/^GMT/.test(p.value) ? p.value : '';
  } catch (e) { return ''; }
}
function renderCard() {
  const z = cardZone, card = $('placeCard');
  const close = cardPinned ? '<button class="wc-x" data-close aria-label="Close">✕</button>' : '';
  let html = '<div class="wc-card-head"><div><div class="wc-card-name">' + esc(z.name) + '</div>' +
    (z.name !== z.country ? '<div class="wc-card-country">' + esc(z.country) + '</div>' : '') + '</div>' + close + '</div>';
  if (!z.fmt) {
    html += '<div class="wc-card-row">This browser does not know the time zone ' + esc(z.id) + '.</div>';
  } else {
    const w = wall(displayMs, z.off), long = zoneLongName(z), info = dstInfo(z, displayMs);
    html += '<div class="wc-card-time">' + clock(w) + '</div>' +
      '<div class="wc-card-date">' + DAYS[w.wd] + ' ' + p2(w.d) + ' ' + MONTHS[w.mo] + ' ' + w.y + '</div>' +
      '<div class="wc-card-row"><strong>' + gmt(z.off) + '</strong>' + (long ? ' · ' + esc(long) : '') + '</div>' +
      '<div class="wc-card-zone">' + esc(z.id) + '</div>';
    let dst = info.inDst ? 'On daylight saving time now.' : info.observes || info.next ? 'On standard time now.' : 'No daylight saving.';
    if (info.next) {
      const at = wall(info.next.at - 60000, info.next.from), d = info.next.to - info.next.from;
      dst += ' Clocks go ' + (d > 0 ? 'forward ' : 'back ') + span(Math.abs(d)) + ' on ' + DAYS[at.wd].slice(0, 3) + ' ' + p2(at.d) + ' ' + MON[at.mo] + ' ' + at.y + '.';
    }
    html += '<div class="wc-card-row">' + dst + '</div><div class="wc-card-rel">' + relText(z) + '</div>';
  }
  card.innerHTML = html;
  placeCard();
}
function placeCard() {
  const card = $('placeCard'), [x, y] = cardAt;
  const w = card.offsetWidth, h = card.offsetHeight;
  let left = x + 16, top = y + 16;
  if (left + w > vw - 8) left = x - w - 16;
  if (top + h > vh - 8) top = y - h - 16;
  card.style.transform = 'translate(' + Math.max(8, left) + 'px,' + Math.max(8, top) + 'px)';
}
// A pinned card rides with the spot that was tapped, and closes once
// that spot is dragged off the map, so it never floats over somewhere else.
function followCard() {
  if (!cardZone || !cardMap) return;
  const x = T.x + cardMap[0] * T.k, y = T.y + cardMap[1] * T.k;
  if (x < 0 || y < 0 || x > vw || y > vh) { hideCard(); setHover(null); return; }
  cardAt = [x, y];
  placeCard();
}
function showCard(z, x, y, pin) {
  cardZone = z; cardPinned = !!pin; cardAt = [x, y];
  cardMap = [(x - T.x) / T.k, (y - T.y) / T.k];
  const card = $('placeCard');
  card.hidden = false;
  card.classList.toggle('pinned', cardPinned);
  renderCard();
}
function hideCard() {
  cardZone = null; cardPinned = false;
  $('placeCard').hidden = true;
}
function setHover(z) {
  if (z === hover) return;
  hover = z;
  labelCv.classList.toggle('over-place', !!z);
  requestDraw(false);
}
// Safari's click carries no pointerType, so remember what pressed.
let lastPointer = 'mouse';
labelCv.addEventListener('pointerdown', e => { lastPointer = e.pointerType || 'mouse'; }, true);
function localXY(e) { const r = labelCv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
labelCv.addEventListener('pointermove', e => {
  if (!ready || e.pointerType !== 'mouse' || e.buttons) return;
  const [x, y] = localXY(e), z = zoneAt(x, y);
  setHover(z);
  if (cardPinned) return;
  if (z) showCard(z, x, y, false); else hideCard();
});
labelCv.addEventListener('pointerleave', () => { setHover(null); if (!cardPinned) hideCard(); });
labelCv.addEventListener('click', e => {
  if (!ready) return;
  const [x, y] = localXY(e), z = zoneAt(x, y);
  if (!$('travelPanel').hidden && z && z.fmt) setTravelPlace(z);
  if (z) { setHover(z); showCard(z, x, y, lastPointer !== 'mouse'); }
  else { setHover(null); hideCard(); }
});
$('placeCard').addEventListener('click', e => { if (e.target.closest('[data-close]')) { hideCard(); setHover(null); } });

// ── VIEW ─────────────────────────────────────────────────────────────────
const TIP_VIEW = {
  jur: '<strong>Jurisdictions:</strong> every place that sets its own clock. A bold line marks where the time changes. Hover or tap a place for details.',
  tz: '<strong>Time zones:</strong> places coloured by their offset from GMT right now, so daylight saving moves a place into the next colour.',
};
function setView(v) {
  view = v;
  app.classList.toggle('tz', v === 'tz');
  document.querySelectorAll('#viewGroup .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.val === v));
  $('viewTip').setAttribute('data-tip', TIP_VIEW[v]);
  requestAnimationFrame(updateObstacles);
  requestDraw(true);
}
$('viewGroup').addEventListener('click', e => {
  const b = e.target.closest('.seg-btn');
  if (!b || !ready || b.dataset.val === view) return;
  if (b.dataset.val === 'tz' && T.k > minK * TZ_MAX_ZOOM * 0.8) {
    setView('tz');
    flyTo(worldTransform(centreX()), 1100);
  } else setView(b.dataset.val);
});

// ── TIME TRAVEL ──────────────────────────────────────────────────────────
function tweenTo(target, done) {
  cancelAnimationFrame(tweenRaf);
  if (reduceMotion) { tweening = false; displayMs = target; refreshTime(true); if (done) done(); return; }
  const from = displayMs, t0 = performance.now();
  const dur = Math.min(1400, 500 + 120 * Math.log10(1 + Math.abs(target - from) / 60000));
  tweening = true;
  const step = now => {
    const u = Math.min(1, (now - t0) / dur), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    displayMs = from + (target - from) * e;
    refreshTime(true);
    if (u < 1) tweenRaf = requestAnimationFrame(step);
    else { tweening = false; if (done) done(); }
  };
  tweenRaf = requestAnimationFrame(step);
}
function setTravelling(on) {
  $('travelling').hidden = !on;
  $('travelBtn').classList.toggle('on', on);
  requestAnimationFrame(updateObstacles);
}
function travelFmt() { return travelZone ? travelZone.fmt : userFmt; }
function fillTravelFields(ms) {
  const fmt = travelFmt(), w = wall(ms, offsetAt(fmt, ms));
  $('travelDate').value = w.y + '-' + p2(w.mo + 1) + '-' + p2(w.d);
  $('travelTime').value = p2(w.h) + ':' + p2(w.mi);
}
let applyTimer = 0;
function applyTravel() {
  clearTimeout(applyTimer);
  applyTimer = setTimeout(() => {
    const dv = $('travelDate').value, tv = $('travelTime').value, fmt = travelFmt();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dv) || !/^\d{2}:\d{2}/.test(tv) || !fmt) return;
    const [y, mo, d] = dv.split('-').map(Number), [h, mi] = tv.split(':').map(Number);
    if (y < 1971 || y > 2099) return;
    const target = wallToInstant(fmt, y, mo, d, h, mi);
    travel = { ms: target };
    setTravelling(true);
    tweenTo(target);
  }, 180);
}
function backToNow() {
  clearTimeout(applyTimer);
  travel = null;
  setTravelling(false);
  tweenTo(Date.now(), () => tick());
  if (!$('travelPanel').hidden) fillTravelFields(Date.now());
}
function openTravel(open) {
  const panel = $('travelPanel');
  panel.hidden = !open;
  $('travelBtn').setAttribute('aria-expanded', String(open));
  if (open) {
    if (!travel) fillTravelFields(displayMs);
    showPlace();
  }
  requestAnimationFrame(updateObstacles);
}
$('travelBtn').addEventListener('click', () => openTravel($('travelPanel').hidden));
$('travelClose').addEventListener('click', () => openTravel(false));
$('backNow').addEventListener('click', backToNow);
$('backNowChip').addEventListener('click', backToNow);
['input', 'change'].forEach(ev => {
  $('travelDate').addEventListener(ev, applyTravel);
  $('travelTime').addEventListener(ev, applyTravel);
});

// The "In" picker: the date and time above are the wall clock in this place.
const pickEls = { input: $('placeSearch'), list: $('placeList') };
let pickItems = [], pickFocus = -1, pickEntries = null;
function showPlace() {
  const inp = pickEls.input;
  inp.value = travelZone ? travelZone.name + (travelZone.name !== travelZone.country ? ', ' + travelZone.country : '') : 'Your time (' + userPlace + ')';
  inp.classList.toggle('has-value', !!travelZone);
}
function entries() {
  if (pickEntries) return pickEntries;
  pickEntries = zones.filter(z => z.fmt).map(z => ({ z, label: z.name, sub: z.name !== z.country ? z.country : '', key: z.search }));
  for (const [place, id] of Object.entries(EXTRA_PLACES)) {
    const z = byId.get(id);
    if (z && z.fmt) pickEntries.push({ z, label: place, sub: z.name + ' time', key: norm(place) });
  }
  pickEntries.sort((a, b) => a.label.localeCompare(b.label));
  return pickEntries;
}
function renderPicker() {
  const q = norm(pickEls.input.value.trim());
  const all = entries();
  if (!q || /^your time/.test(q)) {
    pickItems = (userZone ? [{ z: null, label: 'Your time', sub: userPlace }] : []).concat(all.slice(0, 80));
  } else {
    pickItems = all.filter(e => e.key.includes(q))
      .sort((a, b) => (norm(b.label).startsWith(q) - norm(a.label).startsWith(q)) || a.label.localeCompare(b.label))
      .slice(0, 40);
  }
  pickFocus = -1;
  pickEls.list.innerHTML = pickItems.length
    ? pickItems.map((e, i) => '<div class="city-opt" role="option" data-i="' + i + '"><div>' + esc(e.label) + '</div><div class="opt-sub">' +
        esc([e.sub, gmt(e.z ? e.z.off : userOff)].filter(Boolean).join(' · ')) + '</div></div>').join('')
    : '<div class="city-empty">No place found. Try a country name.</div>';
  pickEls.list.classList.add('open');
}
function choosePick(i) {
  const e = pickItems[i];
  if (!e) return;
  pickEls.list.classList.remove('open');
  setTravelPlace(e.z);
  pickEls.input.blur();
}
function setTravelPlace(z) {
  travelZone = z && z !== userZone ? z : null;
  showPlace();
  if ($('travelDate').value && $('travelTime').value) applyTravel();
}
pickEls.input.addEventListener('focus', () => { pickEls.input.select(); renderPicker(); });
pickEls.input.addEventListener('input', renderPicker);
pickEls.input.addEventListener('blur', () => setTimeout(() => { pickEls.list.classList.remove('open'); showPlace(); }, 150));
pickEls.input.addEventListener('keydown', e => {
  const opts = pickEls.list.querySelectorAll('.city-opt');
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!opts.length) return;
    pickFocus = mod(pickFocus + (e.key === 'ArrowDown' ? 1 : -1), opts.length);
    opts.forEach((o, i) => o.classList.toggle('focused', i === pickFocus));
    opts[pickFocus].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    e.preventDefault(); choosePick(pickFocus < 0 ? 0 : pickFocus);
  } else if (e.key === 'Escape') { pickEls.input.blur(); }
});
pickEls.list.addEventListener('mousedown', e => {
  const o = e.target.closest('.city-opt');
  if (o) { e.preventDefault(); choosePick(+o.dataset.i); }
});
$('placeClear').addEventListener('click', () => setTravelPlace(null));

// ── CONTROLS ─────────────────────────────────────────────────────────────
$('showSeconds').addEventListener('change', () => {
  showSeconds = $('showSeconds').checked;
  refreshTime(true);
  requestAnimationFrame(updateObstacles);
});
$('zoomIn').addEventListener('click', () => ready && d3.select(labelCv).transition().duration(250).call(zoom.scaleBy, 1.7));
$('zoomOut').addEventListener('click', () => ready && d3.select(labelCv).transition().duration(250).call(zoom.scaleBy, 1 / 1.7));
$('zoomHome').addEventListener('click', () => { if (!ready) return; if (view === 'tz') setView('jur'); flyTo(homeTransform(), 1000); });
$('themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('light');
  $('themeToggle').textContent = document.body.classList.contains('light') ? '🌙 Dark' : '☀️ Light';
  readColors();
  requestDraw(true);
});

// Labels steer clear of the cards floating on the map, and a region is
// framed in the space between them.
function updateObstacles() {
  const ar = app.getBoundingClientRect();
  obstacles = [];
  document.querySelectorAll('.wc-now, .wc-nav, .wc-zoom, .wc-controls, .wc-foot, #travelPanel').forEach(el => {
    if (el.hidden || !el.offsetParent) return;
    const r = el.getBoundingClientRect();
    obstacles.push([r.left - ar.left - 4, r.top - ar.top - 4, r.right - ar.left + 4, r.bottom - ar.top + 4]);
  });
  if (view === 'tz') obstacles.push([0, 0, vw, STRIP_H]);
  const top = Math.max(document.querySelector('.wc-now').getBoundingClientRect().bottom, document.querySelector('.wc-nav').getBoundingClientRect().bottom) - ar.top;
  const ctl = document.querySelector('.wc-controls').getBoundingClientRect().top - ar.top;
  padTop = top + 10; padBottom = vh - ctl + 10;
  app.style.setProperty('--wc-panel-bottom', (vh - ctl + 8) + 'px');
  requestDraw(false);
}

function resize() {
  const oldW = vw, oldH = vh;
  vw = app.clientWidth; vh = app.clientHeight;
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  for (const cv of [baseCv, labelCv]) { cv.width = Math.round(vw * DPR); cv.height = Math.round(vh * DPR); }
  hatchCache.clear();
  minK = Math.min(vw / W, vh / H);
  updateObstacles();
  if (!zoom) return;
  zoom.scaleExtent([minK, MAX_K]).extent([[0, 0], [vw, vh]]);
  const k = Math.max(minK, T.k);
  const t = constrain(d3.zoomIdentity.translate(T.x + (vw - oldW) / 2, T.y + (vh - oldH) / 2).scale(k));
  d3.select(labelCv).call(zoom.transform, t);
  requestDraw(true);
}
let resizeTimer = 0;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 60); });

// ── START ────────────────────────────────────────────────────────────────
function fail(msg) { const el = $('loading'); el.hidden = false; el.textContent = msg; }

function start(topo) {
  build(topo);
  resolveUser();
  showSeconds = $('showSeconds').checked;
  zoom = d3.zoom()
    .scaleExtent([minK, MAX_K])
    .extent([[0, 0], [vw, vh]])
    .constrain(constrain)
    .on('zoom', onZoom);
  T = worldTransform(userZone ? userZone.lpx : W / 2);
  d3.select(labelCv).call(zoom).call(zoom.transform, T);
  ready = true;
  $('loading').hidden = true;
  displayMs = Date.now();
  refreshTime(true);
  requestDraw(true);
  tick();
  // Open on the world for a moment, then fly to where you are.
  if (userZone) setTimeout(() => flyTo(homeTransform(), 1500), reduceMotion ? 0 : 450);
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load(F_TIME), document.fonts.load(F_NAME), document.fonts.load(F_DATE)])
      .then(() => { twCache.clear(); updateObstacles(); requestDraw(false); }).catch(() => {});
  }
  // Test hook for the audit harness: read-only views of the live state.
  window.__worldclock = {
    zones: () => zones.map(z => ({ id: z.id, cc: z.cc, name: z.name, country: z.country, tz: z.tz, off: z.off, time: z.timeStr, date: z.dateStr, lp: z.lp, island: z.island, hasGeom: z.hasGeom, showable: z.showable })),
    user: () => ({ tz: userTz, zone: userZone && userZone.id, place: userPlace, off: userOff }),
    now: () => $('nowText').textContent,
    displayMs: () => displayMs,
    transform: () => ({ x: T.x, y: T.y, k: T.k, minK }),
    focusBox, wallToInstant: (id, y, mo, d, h, mi) => wallToInstant(makeFmt(id), y, mo, d, h, mi),
    project: (lon, lat) => [T.x + projX(lon) * T.k, T.y + projY(lat) * T.k],
    view: () => view,
    card: () => (cardZone ? $('placeCard').innerText : null),
    labels: () => lastLabels.slice(),
    // Kinds of the borders two zones share: 1 country, 2 state line, 3 time border.
    borderKinds: (a, b) => {
      const ia = byId.get(a).i, ib = byId.get(b).i, out = new Set();
      arcOwners.forEach((o, i) => { if (o.length === 2 && o.includes(ia) && o.includes(ib)) out.add(arcCat[i]); });
      return [...out];
    },
  };
}

readColors();
setView('jur');
Persist.init('worldclock', { onRestore() { showSeconds = $('showSeconds').checked; } });
resize();
if (!window.d3) fail('The map library could not load. Check your connection and reload the page.');
else {
  fetch('zones.json')
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(start)
    .catch(err => { console.error(err); fail('The map could not load. Check your connection and reload the page.'); });
}
})();
