// Builds map/city_coords.json: a latitude, longitude and population for every
// city in the Cost of Living dataset, so the salary map can place it.
//
// Source: GeoNames (https://www.geonames.org, CC BY 4.0). Download three files
// into one folder and pass that folder:
//
//   https://download.geonames.org/export/dump/cities1000.zip   (unzip it)
//   https://download.geonames.org/export/dump/admin1CodesASCII.txt
//   https://download.geonames.org/export/dump/countryInfo.txt
//
//   node build-coords.mjs <geonames-folder>
//
// Every city is matched inside its own country only (London, Canada can never
// stand in for London), on its name, ASCII name or a listed alternate name.
// "Seattle, WA" and "Nanaimo, BC" are matched inside that state or province.
// Of the places that answer to the name, an exact name beats an alternate one
// and then the most populous wins. A city GeoNames spells another way is named
// in ALIAS; the script stops on any city it cannot place, so a new dataset
// release never ships a city the map silently drops.
//
// The audit (../_audit/run.mjs) checks the result independently: every point
// has to land inside its own country on the World Clock's map.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2];
if (!SRC) { console.error('usage: node build-coords.mjs <geonames-folder>'); process.exit(2); }

const DATA = JSON.parse(readFileSync(join(HERE, '..', '..', 'cost_of_living_indices_aggregated.json'), 'utf8')).data;
const OUT = join(HERE, '..', 'city_coords.json');

// The dataset's country names that are not GeoNames' own.
const COUNTRY_ALIAS = {
  'Bosnia And Herzegovina': 'BA', 'Czech Republic': 'CZ', 'Hong Kong (China)': 'HK', 'Ivory Coast': 'CI',
  'Kosovo (Disputed Territory)': 'XK', 'Macao (China)': 'MO', 'Palestine': 'PS', 'Russia': 'RU',
  'South Korea': 'KR', 'Syria': 'SY', 'Taiwan (China)': 'TW', 'Trinidad And Tobago': 'TT', 'Iran': 'IR',
  'Moldova': 'MD', 'North Macedonia': 'MK', 'Vietnam': 'VN', 'Turkey': 'TR', 'United States': 'US',
  'United Kingdom': 'GB', 'Netherlands': 'NL',
};
// Canadian provinces by their postal abbreviation, as GeoNames numbers them.
const CA_PROV = { AB: '01', BC: '02', MB: '03', NB: '04', NL: '05', NS: '07', ON: '08', PE: '09', QC: '10', SK: '11', YT: '12', NT: '13', NU: '14' };
// A dataset city GeoNames knows by another name: "city|country" -> the name to look for.
const ALIAS = {
  'Kyiv (Kiev)|Ukraine': 'Kyiv',
  'Bangalore|India': 'Bengaluru',
  'Gurgaon|India': 'Gurugram',
  'Saint Petersburg|Russia': 'Saint Petersburg',
  'Washington, DC|United States': 'Washington',
  'St.Catharines|Canada': 'St. Catharines',
  'Kocaeli|Turkey': 'İzmit',          // the province's capital, not a village of that name
};
// A city with two places of one name in its country, where the most
// populous is the wrong one: "city|country" -> the GeoNames id to take.
const PICK = {};

const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

// country name -> ISO code
const ISO = {};
for (const line of readFileSync(join(SRC, 'countryInfo.txt'), 'utf8').split('\n')) {
  if (!line || line[0] === '#') continue;
  const f = line.split('\t');
  ISO[norm(f[4])] = f[0];
}
const isoOf = country => COUNTRY_ALIAS[country] || ISO[norm(country)];

// GeoNames populated places, by country
const byCc = new Map();
for (const line of readFileSync(join(SRC, 'cities1000.txt'), 'utf8').split('\n')) {
  if (!line) continue;
  const f = line.split('\t');
  const rec = {
    id: +f[0], name: f[1], ascii: f[2], alt: f[3] ? f[3].split(',') : [],
    lat: +f[4], lon: +f[5], fcode: f[7], cc: f[8], admin1: f[10], pop: +f[14] || 0,
  };
  if (!byCc.has(rec.cc)) byCc.set(rec.cc, []);
  byCc.get(rec.cc).push(rec);
}

const out = {}, problems = [];
for (const c of DATA) {
  const key = c.city + '|' + c.country;
  const cc = isoOf(c.country);
  if (!cc || !byCc.has(cc)) { problems.push(key + ': no country code'); continue; }
  let name = ALIAS[key] || c.city, admin = null;
  const m = /^(.*), ([A-Z]{2})$/.exec(name);
  if (m && (cc === 'US' || cc === 'CA')) { name = m[1]; admin = cc === 'CA' ? CA_PROV[m[2]] : m[2]; }
  // "Seville (Sevilla)" is either name.
  const br = /^(.*?) \((.*)\)$/.exec(name);
  const wants = (br ? [br[1], br[2]] : [name]).map(norm);
  const pool = byCc.get(cc).filter(r => !admin || r.admin1 === admin);
  // Either spelling may name a village too (Querétaro, Chiapas), so both are
  // pooled and the most populous place wins.
  let hits = pool.filter(r => wants.includes(norm(r.name)) || wants.includes(norm(r.ascii))), how = 'name';
  if (!hits.length) { hits = pool.filter(r => r.alt.some(a => wants.includes(norm(a)))); how = 'alternate'; }
  if (!hits.length) { problems.push(key + ': no place of that name in ' + cc + (admin ? '.' + admin : '')); continue; }
  hits.sort((a, b) => b.pop - a.pop);
  const pick = PICK[key] ? hits.find(h => h.id === PICK[key]) : hits[0];
  if (!pick) { problems.push(key + ': PICK id ' + PICK[key] + ' not among the matches'); continue; }
  // Two big places of one name (more than a third the size of the pick) need a decision.
  const rival = hits.find(h => h !== pick && h.pop > pick.pop / 3 && !PICK[key]);
  if (rival) console.warn('  check ' + key + ': took ' + pick.name + ' (' + pick.pop + ', ' + pick.lat + ',' + pick.lon + '), also ' + rival.name + ' (' + rival.pop + ', ' + rival.lat + ',' + rival.lon + ')');
  out[key] = [Math.round(pick.lat * 1e4) / 1e4, Math.round(pick.lon * 1e4) / 1e4, pick.pop];
  if (how === 'alternate') console.log('  ' + key + ' -> ' + pick.name + ' (alternate name)');
}

if (problems.length) {
  console.error('Could not place ' + problems.length + ' cities:\n  ' + problems.join('\n  '));
  process.exit(1);
}
const keys = Object.keys(out).sort();
const json = '{\n' + keys.map(k => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(out[k])).join(',\n') + '\n}\n';
writeFileSync(OUT, json);
console.log('Wrote ' + keys.length + ' cities to ' + OUT);
