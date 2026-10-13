// Builds health_price_index.json: how dear health care is next to everyday
// prices, per country, for the Medical Care and Health Insurance rows.
//
// Source: the World Bank's International Comparison Program, ICP 2021
// (https://www.worldbank.org/en/programs/icp, CC BY 4.0). The ICP prices one
// basket of health goods and services in every economy: GP and specialist
// consultations, dental care, pharmaceuticals, medical products and hospital
// services. Download two price level indices (World = 100) into one folder:
//
//   https://api.worldbank.org/v2/sources/90/country/all/series/9080000/Classification/PX.WL/time/YR2021?format=json&per_page=1000
//     save as health.json   (ACTUAL HEALTH)
//   https://api.worldbank.org/v2/sources/90/country/all/series/9260000/Classification/PX.WL/time/YR2021?format=json&per_page=1000
//     save as consumption.json   (household consumption, without housing)
//
//   node build-health.mjs <folder>
//
// What ships is their ratio. Both indices are quoted at the same 2021 exchange
// rate, so the rate cancels and the ratio is a pure relative price (PPP for
// health over PPP for everyday consumption), true in any currency and any
// year the relative price holds. The page multiplies it by each city's own
// cost-of-living index excluding housing, which is current and priced at the
// bundled exchange rate like every other index. So a 2021 exchange rate never
// reaches an estimate, and a city dearer than its country's average is dearer
// for care too.
//
// A country the ICP did not price gets null, never a stand-in, so the page says
// "no estimate" for it. The script stops on any dataset country it cannot find
// in the ICP list at all, so a new dataset release never drops one silently.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2];
if (!SRC) { console.error('usage: node build-health.mjs <folder>'); process.exit(2); }

// Dataset country -> ICP economy name, where they differ.
const ALIAS = {
  'Bahamas': 'Bahamas, The',
  'Bosnia And Herzegovina': 'Bosnia and Herzegovina',
  'Czech Republic': 'Czechia',
  'Egypt': 'Egypt, Arab Rep.',
  'Hong Kong (China)': 'Hong Kong SAR, China',
  'Iran': 'Iran, Islamic Rep.',
  'Ivory Coast': "Cote d'Ivoire",
  'Kosovo (Disputed Territory)': 'Kosovo',
  'Kyrgyzstan': 'Kyrgyz Republic',
  'Macao (China)': 'Macao SAR, China',
  'Palestine': 'West Bank and Gaza',
  'Russia': 'Russian Federation',
  'Slovakia': 'Slovak Republic',
  'South Korea': 'Korea, Rep.',
  'Syria': 'Syrian Arab Republic',
  'Taiwan (China)': 'Taiwan, China',
  'Trinidad And Tobago': 'Trinidad and Tobago',
  'Turkey': 'Turkiye',
  'Vietnam': 'Viet Nam',
};
// Not an ICP economy at all. Kept to null rather than borrowed from a neighbour.
const NOT_IN_ICP = new Set(['Jersey']);

function load(file){
  const j = JSON.parse(readFileSync(join(SRC, file), 'utf8'));
  const m = new Map();
  j.source.data.forEach(r => m.set(r.variable[0].value, r.value));
  return m;
}
const health = load('health.json'), cons = load('consumption.json');
const col = JSON.parse(readFileSync(join(HERE, '..', 'cost_of_living_indices_aggregated.json'), 'utf8'));
const countries = [...new Set(col.data.map(c => c.country))].sort();

const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
const data = [], lost = [], unpriced = [];
countries.forEach(country => {
  const name = ALIAS[country] || country;
  if (!health.has(name) && !NOT_IN_ICP.has(country)) { lost.push(country); return; }
  const h = health.get(name), g = cons.get(name);
  const ok = h > 0 && g > 0;
  if (!ok) unpriced.push(country);
  data.push({
    country,
    health_pli: ok ? round(h, 2) : null,
    consumption_pli: ok ? round(g, 2) : null,
    health_ratio: ok ? round(h / g, 4) : null,
  });
});
if (lost.length) { console.error('No ICP economy for: ' + lost.join(', ') + '. Add it to ALIAS or NOT_IN_ICP.'); process.exit(1); }

writeFileSync(join(HERE, '..', 'health_price_index.json'), JSON.stringify({
  metadata: {
    source: 'World Bank, International Comparison Program (ICP) 2021',
    url: 'https://www.worldbank.org/en/programs/icp',
    licence: 'CC BY 4.0',
    year: 2021,
    health_pli: 'Price level index, actual health (World = 100)',
    consumption_pli: 'Price level index, household consumption without housing (World = 100)',
    health_ratio: 'health_pli / consumption_pli: health prices relative to everyday prices, free of any exchange rate',
  },
  data,
}) + '\n');
console.log(data.length + ' countries, ' + unpriced.length + ' without an ICP health price: ' + unpriced.join(', '));
