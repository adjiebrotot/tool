// Builds ../zones.json, the map the World Clock draws. Run it again when a new
// timezone-boundary-builder release is out.
//
//   npm i --no-save mapshaper@0.6 polylabel@2 topojson-client@3
//   node build.mjs --zones combined.json --land ne_10m_land.shp \
//     --islands ne_10m_minor_islands.shp --release 2026d [--zoneinfo /usr/share/zoneinfo]
//
// --zones    timezones.geojson.zip from
//            https://github.com/evansiroky/timezone-boundary-builder/releases, unzipped
// --land     Natural Earth 1:10m land, and
// --islands  its minor islands (https://www.naturalearthdata.com/downloads/10m-physical-vectors/).
//            Use Natural Earth's own shapefiles: world-atlas's land-10m is cut for a
//            sphere, and its rings that cross the date line slice every zone they meet.
// --zoneinfo supplies zone.tab, for each zone's country and principal city, and
//            tzdata.zi, for the old names a browser may still report (Asia/Calcutta).
//
// Steps: drop Antarctica (its zones, and the territorial claims some countries'
// zones carry down to the pole), clip every zone to land so the map shows real
// coastlines rather than 12-mile territorial waters, simplify to about 2 km, and
// give each zone a label point: the visual centre of the polygon holding its
// principal city (or of its largest polygon), worked out in Mercator so it looks
// centred on the map the page draws.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import polylabel from 'polylabel';
import * as topojson from 'topojson-client';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const { zones: src, land, islands, release = 'unknown', zoneinfo = '/usr/share/zoneinfo' } = args;
if (!src || !land || !islands) {
  console.error('usage: node build.mjs --zones combined.json --land ne_10m_land.shp --islands ne_10m_minor_islands.shp [--release tag] [--zoneinfo dir]');
  process.exit(1);
}

const mapshaper = path.join(here, 'node_modules/.bin/mapshaper-xl');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'worldclock-'));
const pre = path.join(tmp, 'pre.json');
const landOne = path.join(tmp, 'land.json');
const clipped = path.join(tmp, 'clipped.json');
const run = argv => execFileSync(mapshaper, argv, { stdio: 'inherit' });

// A light first pass so clipping 7.7M vertices takes seconds, not minutes.
run(['8gb', '-i', src, 'name=zones',
  '-filter', '!tzid.startsWith("Antarctica/") && tzid != "Etc/UTC"',
  '-simplify', 'interval=400', 'keep-shapes',
  '-o', pre, 'format=geojson']);
// One land layer: Natural Earth's land and minor islands (atolls, so Tuvalu
// and Kiribati keep a shape), merged, since Natural Earth cuts its largest
// landmasses into strips that would otherwise show as false coastlines.
run(['4gb', '-i', land, islands, 'combine-files', '-merge-layers', 'force',
  '-dissolve2', '-o', landOne, 'format=geojson']);
run(['4gb', '-i', pre, 'name=zones',
  '-clip', 'bbox=-180,-60,180,85',
  '-clip', landOne,
  '-simplify', 'interval=2000', 'keep-shapes',
  '-filter-slivers', 'min-area=2km2',
  '-o', clipped, 'format=topojson', 'quantization=100000']);

// zone.tab: country code and principal city of every zone.
const tab = {};
for (const line of fs.readFileSync(path.join(zoneinfo, 'zone.tab'), 'utf8').split('\n')) {
  if (!line || line[0] === '#') continue;
  const [cc, coord, id] = line.split('\t');
  const m = coord.match(/^([+-])(\d{2})(\d{2})(\d{2})?([+-])(\d{3})(\d{2})(\d{2})?$/);
  const dms = (s, d, mi, se) => (s === '-' ? -1 : 1) * (+d + mi / 60 + (se || 0) / 3600);
  tab[id] = { cc, city: [dms(m[5], m[6], m[7], m[8]), dms(m[1], m[2], m[3], m[4])] };
}

const mercY = lat => (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const latOf = y => (360 / Math.PI) * Math.atan(Math.exp((y * Math.PI) / 180)) - 90;
const project = poly => poly.map(ring => ring.map(([x, y]) => [x, mercY(y)]));
const ringArea = r => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); };
const polyArea = p => ringArea(p[0]) - p.slice(1).reduce((s, h) => s + ringArea(h), 0);
const inRing = ([x, y], r) => {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const polygonsOf = g => !g ? [] : g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];

function labelPoint(geometry, city) {
  const polys = polygonsOf(geometry).map(project);
  if (!polys.length) return null;
  const areas = polys.map(polyArea);
  const max = Math.max(...areas);
  const c = [city[0], mercY(city[1])];
  // The city's own polygon if it is a real share of the zone (Java for
  // Jakarta, not Sumatra), otherwise the largest one. A coastal city can sit
  // just off a simplified coastline, so "its own" allows half a degree.
  let pick = areas.indexOf(max), best = 0.5;
  polys.forEach((p, i) => {
    if (areas[i] < 0.2 * max) return;
    const d = inRing(c, p[0]) ? 0 : Math.sqrt(Math.min(...p[0].map(([x, y]) => (x - c[0]) ** 2 + (y - c[1]) ** 2)));
    if (d < best) { best = d; pick = i; }
  });
  const [x, y] = polylabel(polys[pick], 0.02);
  return [+x.toFixed(3), +latOf(y).toFixed(3)];
}

const preById = Object.fromEntries(JSON.parse(fs.readFileSync(pre, 'utf8')).features.map(f => [f.properties.tzid, f.geometry]));
const topo = JSON.parse(fs.readFileSync(clipped, 'utf8'));
const obj = topo.objects.zones;
const features = topojson.feature(topo, obj).features;

obj.geometries.forEach((g, i) => {
  const id = g.properties.tzid;
  const t = tab[id];
  if (!t) throw new Error('not in zone.tab: ' + id);
  // A zone with no land left at 1:10m (an atoll, Monaco) keeps a point so the
  // page can still draw it as a dot.
  const lp = labelPoint(features[i].geometry, t.city) || labelPoint(preById[id], t.city);
  g.properties = { id, cc: t.cc, lp };
});

// Old names that are links to a zone on the map, both ways: a browser may
// report the old name for the user's zone, and an old browser may only know
// the old name of a renamed zone (Europe/Kiev for Europe/Kyiv).
const ids = new Set(obj.geometries.map(g => g.properties.id));
const aliases = {};
for (const line of fs.readFileSync(path.join(zoneinfo, 'tzdata.zi'), 'utf8').split('\n')) {
  const m = line.match(/^L (\S+) (\S+)$/);
  if (m && ids.has(m[1]) && !ids.has(m[2])) aliases[m[2]] = m[1];
}

topo.meta = {
  source: 'timezone-boundary-builder ' + release + ', clipped to Natural Earth 1:10m land and minor islands',
  license: 'Boundaries: ODbL 1.0, (c) OpenStreetMap contributors. Land: Natural Earth, public domain.',
  aliases,
};
const out = path.join(here, '..', 'zones.json');
fs.writeFileSync(out, JSON.stringify(topo));
console.log('wrote', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB,', obj.geometries.length, 'zones,', Object.keys(aliases).length, 'aliases');
fs.rmSync(tmp, { recursive: true, force: true });
