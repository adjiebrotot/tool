// Builds map/wages.json: three pay yardsticks for every city in the Cost of
// Living dataset, so the salary map's Scaled salary mode can carry your salary
// to another city as the same multiple of its pay.
//
//   avg     average monthly NET salary in the city, in its own currency
//   ratio   the country's median over mean earnings, so median = avg * ratio
//   min     the statutory minimum wage that applies in the city, a month, gross
//
// ── Average net salary: per city, from Numbeo ────────────────────────────────
// Numbeo's Local Purchasing Power Index is the city's average net salary over
// the price of its Cost of Living Plus Rent basket, against New York's
// (https://www.numbeo.com/common/motivation_and_methodology.jsp). So
//
//   avg_city (USD) = LPP/100 * (CoL+Rent)/100 * New York's average net salary
//
// which reproduces the salaries on Numbeo's own city pages to within about 2%
// (Houston, San Francisco, Salt Lake City, London, Zurich, Berlin and Perth
// were checked). It is a city figure, not a country one: New York and Houston,
// Sydney and Hobart, Mumbai and Patna each get their own. Save these pages into
// one folder:
//
//   https://www.numbeo.com/cost-of-living/rankings_current.jsp      as rank.html
//   https://www.numbeo.com/cost-of-living/rankings.jsp?title=<T>    as rank_<T>.html
//     for T in 2026-mid 2026 2025-mid 2025 2024-mid 2024 2023-mid 2023 2022
//   https://open.er-api.com/v6/latest/USD                            as fx.json
//
// A city missing from the current table takes the newest older table that has
// it, measured against another city of its own country found in both tables
// (same currency, so no exchange rate enters). Only where its country has no
// such city is it read against New York directly, in US dollars of that year.
// Either way it is marked with the table it came from.
//
// ── Median: the country's median over mean ───────────────────────────────────
// ILOSTAT's mean and median monthly earnings of employees (same survey, same
// year, local currency). Download both into the folder:
//
//   https://sdmx.ilo.org/rest/data/ILO,DF_EAR_EMTA_SEX_CUR_NB,1.0/all?startPeriod=2015
//     (Accept: application/vnd.sdmx.data+csv)   as DF_EAR_EMTA_SEX_CUR_NB.csv
//   https://sdmx.ilo.org/rest/data/ILO,DF_EAR_EMTM_SEX_CUR_NB,1.0/all?startPeriod=2015
//                                                 as DF_EAR_EMTM_SEX_CUR_NB.csv
//
// Earnings are skewed right, so a median at or above 95% of the mean is a
// survey artefact (Bosnia's 2025 median reads 115% of its mean) and is dropped.
// Three economies ILO lacks come from their statistics offices (RATIO_NATIONAL).
// A country with neither gets null, never a neighbour's ratio, and the page
// says "no estimate".
//
// ── Minimum wage: the city's own, its state's, or the country's ──────────────
// MIN below, by hand, each with its source and the date it took effect. Where
// a state, province, prefecture or city sets its own (the United States,
// Canada, China, Japan, Indonesia, India, Russia, Mexico, the Philippines,
// Thailand, Switzerland) the city takes that one. Hourly rates are a month of
// 40-hour weeks (x 40 x 52 / 12), daily rates 26 working days, weekly x 52/12,
// unless the country's own law converts otherwise (noted). A country with no
// statutory minimum, or only a symbolic one, gets null and a reason.
//
//   node build-wages.mjs <folder>
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2];
if (!SRC) { console.error('usage: node build-wages.mjs <folder>'); process.exit(2); }

const DATA = JSON.parse(readFileSync(join(HERE, '..', '..', 'cost_of_living_indices_aggregated.json'), 'utf8')).data;
const BUNDLED = Object.fromEntries(JSON.parse(readFileSync(join(HERE, '..', '..', 'currency_rates.json'), 'utf8')).data.map(r => [r.currency, r.usd_rate]));
const OUT = join(HERE, '..', 'wages.json');

// New York's average monthly net salary on its Numbeo page, the day the
// current table was saved.
const NYC_NET_USD = 5278.25;
const NUMBEO_DATE = '2026-10-13';

// ═══════════════════════════════════════════════════════════
// AVERAGE NET SALARY
// ═══════════════════════════════════════════════════════════
const SNAPS = ['2026-mid', '2026', '2025-mid', '2025', '2024-mid', '2024', '2023-mid', '2023', '2022'];
function readRank(file){
  const html = readFileSync(join(SRC, file), 'utf8');
  const out = {};
  for(const row of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []){
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim());
    if(cells.length < 8) continue;
    const v = cells.slice(2, 8).map(Number);
    if(v.some(x => !isFinite(x))) continue;
    // CoL, Rent, CoL+Rent, Groceries, Restaurants, LPP
    out[cells[1]] = v[2] * v[5] / 1e4;
  }
  if(Object.keys(out).length < 100) throw new Error(file + ': no rankings table found');
  return out;
}
const CUR = readRank('rank.html');
const OLD = Object.fromEntries(SNAPS.map(t => [t, readRank('rank_' + t + '.html')]));
const fxJson = JSON.parse(readFileSync(join(SRC, 'fx.json'), 'utf8'));
const FX = fxJson.rates;   // units per USD, the day the table was saved
const FX_DATE = new Date(fxJson.time_last_update_unix * 1000).toISOString().slice(0, 10);
const usdTo = cur => FX[cur] || BUNDLED[cur] || null;

// Numbeo's name for a dataset city, where the two differ.
const NUMBEO_ALIAS = {
  'Arhus|Denmark': 'Aarhus, Denmark',
  'Taipei|Taiwan (China)': 'Taipei, Taiwan', 'New Taipei City|Taiwan (China)': 'New Taipei City, Taiwan',
  'Kaohsiung|Taiwan (China)': 'Kaohsiung, Taiwan',
  'Rostov-na-donu|Russia': 'Rostov-on-Don (Rostov-na-donu), Russia',
  'Batumi|Georgia': 'Batumi, Ajara, Georgia',
  'Qingdao|China': 'Qingdao, Shandong, China',
};
const numbeoName = c => NUMBEO_ALIAS[c.city + '|' + c.country] || c.city + ', ' + c.country;
const byCountry = {};
DATA.forEach(c => { (byCountry[c.country] = byCountry[c.country] || []).push(c); });

function averageOf(c){
  const k = numbeoName(c), rate = usdTo(c.currency);
  if(!rate) throw new Error('no exchange rate for ' + c.currency);
  if(CUR[k] != null) return { avg: CUR[k] * NYC_NET_USD * rate, from: 'current' };
  for(const t of SNAPS){
    const old = OLD[t][k];
    if(old == null) continue;
    // Another city of the same country in both tables carries it forward.
    const anchor = byCountry[c.country].map(numbeoName).find(n => n !== k && CUR[n] != null && OLD[t][n] != null);
    if(anchor) return { avg: CUR[anchor] * NYC_NET_USD * rate * old / OLD[t][anchor], from: t };
    return { avg: old * NYC_NET_USD * rate, from: t, vsNyc: true };
  }
  return { avg: null, from: null };
}

// ═══════════════════════════════════════════════════════════
// MEDIAN OVER MEAN
// ═══════════════════════════════════════════════════════════
const ISO3 = {
  'Albania':'ALB','Algeria':'DZA','Argentina':'ARG','Armenia':'ARM','Australia':'AUS','Austria':'AUT','Azerbaijan':'AZE',
  'Bahamas':'BHS','Bahrain':'BHR','Bangladesh':'BGD','Belarus':'BLR','Belgium':'BEL','Bermuda':'BMU','Bolivia':'BOL',
  'Bosnia And Herzegovina':'BIH','Botswana':'BWA','Brazil':'BRA','Bulgaria':'BGR','Cambodia':'KHM','Canada':'CAN',
  'Cayman Islands':'CYM','Chile':'CHL','China':'CHN','Colombia':'COL','Costa Rica':'CRI','Croatia':'HRV','Cyprus':'CYP',
  'Czech Republic':'CZE','Denmark':'DNK','Dominican Republic':'DOM','Ecuador':'ECU','Egypt':'EGY','El Salvador':'SLV',
  'Estonia':'EST','Ethiopia':'ETH','Fiji':'FJI','Finland':'FIN','France':'FRA','Georgia':'GEO','Germany':'DEU','Ghana':'GHA',
  'Greece':'GRC','Guatemala':'GTM','Guyana':'GUY','Hong Kong (China)':'HKG','Hungary':'HUN','Iceland':'ISL','India':'IND',
  'Indonesia':'IDN','Iran':'IRN','Iraq':'IRQ','Ireland':'IRL','Israel':'ISR','Italy':'ITA','Ivory Coast':'CIV','Jamaica':'JAM',
  'Japan':'JPN','Jersey':'JEY','Jordan':'JOR','Kazakhstan':'KAZ','Kenya':'KEN','Kosovo (Disputed Territory)':'KOS','Kuwait':'KWT',
  'Kyrgyzstan':'KGZ','Latvia':'LVA','Lebanon':'LBN','Libya':'LBY','Lithuania':'LTU','Luxembourg':'LUX','Macao (China)':'MAC',
  'Malaysia':'MYS','Maldives':'MDV','Malta':'MLT','Mexico':'MEX','Moldova':'MDA','Mongolia':'MNG','Montenegro':'MNE','Morocco':'MAR',
  'Myanmar':'MMR','Namibia':'NAM','Nepal':'NPL','Netherlands':'NLD','New Zealand':'NZL','Nigeria':'NGA','North Macedonia':'MKD',
  'Norway':'NOR','Oman':'OMN','Pakistan':'PAK','Palestine':'PSE','Panama':'PAN','Paraguay':'PRY','Peru':'PER','Philippines':'PHL',
  'Poland':'POL','Portugal':'PRT','Puerto Rico':'PRI','Qatar':'QAT','Romania':'ROU','Russia':'RUS','Rwanda':'RWA','Saudi Arabia':'SAU',
  'Senegal':'SEN','Serbia':'SRB','Singapore':'SGP','Slovakia':'SVK','Slovenia':'SVN','South Africa':'ZAF','South Korea':'KOR',
  'Spain':'ESP','Sri Lanka':'LKA','Sweden':'SWE','Switzerland':'CHE','Syria':'SYR','Taiwan (China)':'TWN','Tanzania':'TZA',
  'Thailand':'THA','Trinidad And Tobago':'TTO','Tunisia':'TUN','Turkey':'TUR','Uganda':'UGA','Ukraine':'UKR',
  'United Arab Emirates':'ARE','United Kingdom':'GBR','United States':'USA','Uruguay':'URY','Uzbekistan':'UZB','Vietnam':'VNM',
  'Zimbabwe':'ZWE',
};
// Statistics offices, where ILOSTAT has no pair. Each is that office's own
// median over its own mean for the same employees.
const RATIO_NATIONAL = {
  'South Korea':    { ratio: 2.78 / 3.63, year: 2023, src: 'Statistics Korea, wage job income' },
  'Malaysia':       { ratio: 2940 / 3803, year: 2025, src: 'DOSM, Salaries & Wages Survey' },
  'Taiwan (China)': { ratio: 546 / 732,   year: 2024, src: 'DGBAS, annual total earnings of employees' },
};
function readIlo(file){
  const text = readFileSync(join(SRC, file), 'utf8').split(/\r?\n/);
  const head = text[0].split(',');
  const col = n => head.indexOf(n);
  const [iA, iS, iC, iT, iV, iSrc] = ['REF_AREA', 'SEX', 'CUR', 'TIME_PERIOD', 'OBS_VALUE', 'SOURCE'].map(col);
  const out = {};
  for(const line of text.slice(1)){
    if(!line) continue;
    // The fields used come before any quoted note, so a plain split is safe.
    const f = line.split(',');
    if(f[iS] !== 'SEX_T' || f[iC] !== 'CUR_TYPE_LCU') continue;
    ((out[f[iA]] = out[f[iA]] || {}))[f[iT]] = { v: Number(f[iV]), src: f[iSrc] };
  }
  return out;
}
const MEAN = readIlo('DF_EAR_EMTA_SEX_CUR_NB.csv'), MED = readIlo('DF_EAR_EMTM_SEX_CUR_NB.csv');
function ratioOf(country){
  if(RATIO_NATIONAL[country]) return RATIO_NATIONAL[country];
  const k = ISO3[country];
  if(!k) throw new Error('no ISO code for ' + country);
  const years = Object.keys(MEAN[k] || {}).filter(y => MED[k] && MED[k][y]).sort().reverse();
  for(const y of years){
    const r = MED[k][y].v / MEAN[k][y].v;
    if(!(r > 0.3 && r < 0.95)) return { ratio: null, year: +y, src: 'ILOSTAT', why: 'its latest survey reports a median at ' + Math.round(r * 100) + '% of the mean, too close to the mean to trust' };
    return { ratio: r, year: +y, src: 'ILOSTAT, ' + MEAN[k][y].src.replace(/ - .*/, '') };
  }
  return { ratio: null, why: 'ILOSTAT has no survey of it that reports both a median and a mean' };
}

// ═══════════════════════════════════════════════════════════
// MINIMUM WAGE
// One of h (an hour), d (a day), w (a week) or m (a month), in the city's
// currency unless cur says otherwise; or none: why there is no figure.
// ═══════════════════════════════════════════════════════════
const ILO = 'ILOSTAT';
const MIN = {
  'Albania': { m: 50000, year: 2026, src: ILO },
  'Algeria': { m: 24000, year: 2025, src: 'Presidential decree (SNMG)' },
  'Argentina': { m: 391200, year: 2026, src: 'Resolution 4/2026 (SMVM, October 2026)' },
  'Armenia': { m: 85000, year: 2025, src: 'Law on Minimum Monthly Wage' },
  'Australia': { w: 1004.90, year: 2026, src: 'Fair Work Commission, Annual Wage Review 2025-26 (38-hour week)' },
  'Austria': { none: 'Austria has no statutory minimum wage; collective agreements set pay floors by industry' },
  'Azerbaijan': { m: 400, year: 2025, src: 'Presidential decree' },
  'Bahamas': { m: 1125.8, year: 2024, src: ILO },
  'Bahrain': { none: 'Bahrain has no minimum wage for the private sector' },
  'Bangladesh': { none: 'Bangladesh sets minimum wages only by industry, with no national figure' },
  'Belarus': { m: 726, year: 2025, src: 'Ministry of Labour' },
  'Belgium': { m: 2234, year: 2026, src: ILO },
  'Bermuda': { h: 16.40, year: 2023, src: 'Employment (Minimum Hourly Wage) Order 2023' },
  'Bolivia': { m: 2500, year: 2024, src: ILO },
  'Bosnia And Herzegovina': { m: 1000, year: 2025, src: 'Federation of BiH government decision (net)' },
  'Botswana': { m: 1883.03, year: 2024, src: ILO + ' (sectoral)' },
  'Brazil': { m: 1621, year: 2026, src: 'Decree, national minimum wage (five states set higher floors for some trades)' },
  'Bulgaria': { m: 620, cur: 'EUR', year: 2026, src: ILO },
  'Cambodia': { m: 210, cur: 'USD', year: 2026, src: 'Ministry of Labour (garment and footwear sector, the only one set)' },
  'Canada': { none: 'set by province' },
  'Cayman Islands': { h: 8.75, year: 2026, src: 'Labour (Minimum Wage) Order 2025' },
  'Chile': { m: 529000, year: 2025, src: 'Law 21.751' },
  'China': { none: 'set by province' },
  'Colombia': { m: 1750905, year: 2026, src: 'Decree, salario mínimo 2026' },
  'Costa Rica': { m: 358609, year: 2024, src: ILO },
  'Croatia': { m: 1050, year: 2026, src: ILO },
  'Cyprus': { m: 1088, year: 2026, src: ILO },
  'Czech Republic': { m: 22400, year: 2026, src: ILO },
  'Denmark': { none: 'Denmark has no statutory minimum wage; collective agreements set pay floors by industry' },
  'Dominican Republic': { m: 19450, year: 2024, src: ILO + ' (average of the rates by firm size)' },
  'Ecuador': { m: 482, year: 2026, src: 'Ministry of Labour (salario básico unificado)' },
  'Egypt': { m: 7000, year: 2025, src: 'National Wages Council (private sector)' },
  'El Salvador': { m: 408.80, year: 2025, src: 'Executive decree (commerce, services and industry)' },
  'Estonia': { m: 946, year: 2026, src: ILO },
  'Ethiopia': { none: 'Ethiopia has no minimum wage for the private sector' },
  'Fiji': { m: 935.28, year: 2024, src: ILO },
  'Finland': { none: 'Finland has no statutory minimum wage; collective agreements set pay floors by industry' },
  'France': { m: 1867, year: 2026, src: ILO + ' (SMIC)' },
  'Georgia': { none: 'Georgia\'s legal minimum is GEL 20 a month, a 1999 figure that no employer pays' },
  'Germany': { m: 2343, year: 2026, src: ILO },
  'Ghana': { d: 19.97, year: 2025, src: 'National Tripartite Committee' },
  'Greece': { m: 1073, year: 2026, src: ILO },
  'Guatemala': { m: 3343.01, year: 2024, src: ILO },
  'Guyana': { m: 60147, year: 2024, src: ILO },
  'Hong Kong (China)': { h: 43.1, year: 2026, src: 'Minimum Wage Commission (from 1 May 2026)' },
  'Hungary': { m: 322800, year: 2026, src: ILO },
  'Iceland': { none: 'Iceland has no statutory minimum wage; collective agreements set pay floors' },
  'India': { none: 'set by state' },
  'Indonesia': { none: 'set by city or regency' },
  'Iran': { none: 'Iran\'s 2026 rate was raised 60% in March and its approved amount could not be confirmed' },
  'Iraq': { m: 350000, year: 2024, src: ILO },
  'Ireland': { m: 2391, year: 2026, src: ILO },
  'Israel': { m: 6247.67, year: 2025, src: 'Ministry of Economy (from 1 April 2025)' },
  'Italy': { none: 'Italy has no statutory minimum wage; collective agreements set pay floors by industry' },
  'Ivory Coast': { m: 75000, year: 2024, src: ILO },
  'Jamaica': { w: 16000, year: 2025, src: 'National Minimum Wage Order (from 1 June 2025)' },
  'Japan': { none: 'set by prefecture' },
  'Jersey': { h: 13.59, year: 2026, src: 'Employment (Minimum Wage) Order (from 1 April 2026)' },
  'Jordan': { m: 290, year: 2025, src: 'Tripartite Labour Committee' },
  'Kazakhstan': { m: 85000, year: 2025, src: 'Republican budget law' },
  'Kenya': { m: 16033.14, year: 2024, src: ILO + ' (general labourer, cities)' },
  'Kosovo (Disputed Territory)': { m: 350, year: 2023, src: 'Government decision' },
  'Kuwait': { m: 75, year: 2024, src: ILO + ' (private sector)' },
  'Kyrgyzstan': { none: 'Kyrgyzstan\'s legal minimum, KGS 2,534 a month, is far below its subsistence minimum and is used to index benefits, not as a pay floor' },
  'Latvia': { m: 780, year: 2026, src: ILO },
  'Lebanon': { none: 'Lebanon\'s minimum wage has been reset several times since the currency collapsed, and its current figure could not be confirmed' },
  'Libya': { m: 1000, year: 2024, src: ILO },
  'Lithuania': { m: 1153, year: 2026, src: ILO },
  'Luxembourg': { m: 2771, year: 2026, src: ILO },
  'Macao (China)': { m: 7072, year: 2024, src: 'Minimum Wage for Employees Law' },
  'Malaysia': { m: 1700, year: 2025, src: 'Minimum Wages Order 2024 (from 1 February 2025)' },
  'Maldives': { m: 5700, year: 2022, src: ILO },
  'Malta': { m: 994, year: 2026, src: ILO },
  'Mexico': { none: 'set by zone' },
  'Moldova': { m: 6300, year: 2026, src: ILO },
  'Mongolia': { m: 792000, year: 2025, src: 'National Tripartite Committee' },
  'Montenegro': { m: 670, year: 2026, src: ILO },
  'Morocco': { m: 3120, year: 2024, src: ILO + ' (SMIG)' },
  'Myanmar': { d: 4800, year: 2024, src: ILO },
  'Namibia': { h: 18, year: 2025, src: 'National Minimum Wage Order (from 1 January 2025)' },
  'Nepal': { m: 19550, year: 2025, src: 'Minimum Wage Fixation Committee' },
  'Netherlands': { m: 2338, year: 2026, src: ILO },
  'New Zealand': { h: 23.95, year: 2026, src: 'Minimum Wage Order 2026 (from 1 April 2026)' },
  'Nigeria': { m: 70000, year: 2024, src: 'National Minimum Wage (Amendment) Act 2024' },
  'North Macedonia': { m: 38507, year: 2026, src: ILO },
  'Norway': { none: 'Norway has no statutory minimum wage; collective agreements set pay floors by industry' },
  'Oman': { m: 325, year: 2024, src: ILO + ' (Omani nationals only)' },
  'Pakistan': { m: 40000, year: 2025, src: 'Provincial and federal budgets 2025-26 (the same in every province)' },
  'Palestine': { m: 1880, year: 2021, src: 'Council of Ministers decision' },
  'Panama': { m: 482.18, year: 2024, src: ILO },
  'Paraguay': { m: 2899048, year: 2025, src: 'Executive decree (from 1 July 2025)' },
  'Peru': { m: 1130, year: 2025, src: 'Supreme decree (remuneración mínima vital)' },
  'Philippines': { none: 'set by region' },
  'Poland': { m: 4806, year: 2026, src: ILO },
  'Portugal': { m: 1073, year: 2026, src: ILO + ' (14 payments a year, spread over 12)' },
  'Puerto Rico': { h: 10.50, year: 2024, src: 'Act 47-2021 (from 1 July 2024)' },
  'Qatar': { m: 1800, year: 2021, src: 'Law 17 of 2020 (QAR 1,000 basic plus 800 for food and housing when not provided)' },
  'Romania': { m: 4325, year: 2026, src: ILO },
  'Russia': { m: 27093, year: 2026, src: 'Federal law 429-FZ (federal MROT)' },
  'Rwanda': { none: 'Rwanda\'s legal minimum is a 1974 figure of RWF 100 a day that no employer pays' },
  'Saudi Arabia': { m: 4000, year: 2024, src: ILO + ' (Saudi nationals only)' },
  'Senegal': { m: 64175, year: 2024, src: ILO + ' (SMIG)' },
  'Serbia': { m: 87207, year: 2026, src: ILO },
  'Singapore': { none: 'Singapore has no general minimum wage, only floors for some jobs and for firms that hire foreign workers' },
  'Slovakia': { m: 915, year: 2026, src: ILO },
  'Slovenia': { m: 1482, year: 2026, src: ILO },
  'South Africa': { h: 28.79, year: 2025, src: 'National Minimum Wage (from 1 March 2025)' },
  'South Korea': { m: 2156880, year: 2026, src: 'Minimum Wage Commission (KRW 10,320 an hour, 209 paid hours a month)' },
  'Spain': { m: 1425, year: 2026, src: ILO + ' (14 payments a year, spread over 12)' },
  'Sri Lanka': { m: 27000, year: 2025, src: 'National Minimum Wage of Workers (Amendment) Act' },
  'Sweden': { none: 'Sweden has no statutory minimum wage; collective agreements set pay floors by industry' },
  'Switzerland': { none: 'set by canton' },
  'Syria': { none: 'Syria\'s minimum wage has been reset several times since 2024 and its current figure could not be confirmed' },
  'Taiwan (China)': { m: 29500, year: 2026, src: 'Ministry of Labor (from 1 January 2026)' },
  'Tanzania': { m: 150000, year: 2024, src: ILO + ' (manufacturing)' },
  'Thailand': { none: 'set by province' },
  'Trinidad And Tobago': { m: 3550, year: 2024, src: ILO },
  'Tunisia': { m: 491.504, year: 2024, src: ILO + ' (SMIG, 48-hour week)' },
  'Turkey': { m: 33030, year: 2026, src: ILO + ' (gross)' },
  'Uganda': { none: 'Uganda\'s legal minimum is a 1984 figure that no employer pays' },
  'Ukraine': { m: 8647, year: 2026, src: ILO },
  'United Arab Emirates': { none: 'the UAE has no general minimum wage' },
  'United Kingdom': { h: 12.71, year: 2026, src: 'National Living Wage (from 1 April 2026)' },
  'United States': { none: 'set by state and city' },
  'Uruguay': { m: 23604, year: 2025, src: 'Executive decree (from 1 January 2025)' },
  'Uzbekistan': { m: 1271000, year: 2025, src: 'Presidential decree (from 1 February 2025)' },
  'Vietnam': { none: 'set by region' },
  'Zimbabwe': { none: 'Zimbabwe sets minimum wages by industry, in a currency that has changed twice since 2019' },
};

// Where the minimum is set below the country. Keys are dataset cities.
const US_FED = { h: 7.25, year: 2009, src: 'Federal minimum wage (the state sets none higher)' };
const us = (h, year, src) => ({ h, year, src });
const ST = {
  AK: us(14.00, 2026, 'Alaska (from 1 July 2026)'), AZ: us(15.15, 2026, 'Arizona'), CA: us(16.90, 2026, 'California'),
  CO: us(15.16, 2026, 'Colorado'), DC: us(18.40, 2026, 'District of Columbia (from 1 July 2026)'),
  FL: us(15.00, 2026, 'Florida (from 30 September 2026)'), HI: us(16.00, 2026, 'Hawaii'), IL: us(15.00, 2025, 'Illinois'),
  MA: us(15.00, 2023, 'Massachusetts'), MD: us(15.00, 2024, 'Maryland'), MI: us(13.73, 2026, 'Michigan'),
  MN: us(11.41, 2026, 'Minnesota'), MO: us(15.00, 2026, 'Missouri'), NE: us(15.00, 2026, 'Nebraska'),
  NM: us(12.00, 2023, 'New Mexico'), NV: us(12.00, 2024, 'Nevada'), NY: us(16.00, 2026, 'New York State, outside New York City'),
  OH: us(11.00, 2026, 'Ohio'), OR: us(15.05, 2025, 'Oregon, standard'), VA: us(12.77, 2026, 'Virginia'),
  WA: us(17.13, 2026, 'Washington State'),
};
const CITY_MIN = {
  'New York, NY': us(17.00, 2026, 'New York City'),
  'San Francisco, CA': us(19.61, 2026, 'San Francisco (from 1 July 2026)'),
  'Los Angeles, CA': us(18.42, 2026, 'City of Los Angeles (from 1 July 2026)'),
  'Oakland, CA': us(17.43, 2026, 'Oakland'),
  'San Jose, CA': us(18.45, 2026, 'San Jose'),
  'San Diego, CA': us(17.75, 2026, 'City of San Diego'),
  'Seattle, WA': us(21.30, 2026, 'Seattle'),
  'Denver, CO': us(19.29, 2026, 'Denver'),
  'Chicago, IL': us(17.05, 2026, 'Chicago (from 1 July 2026)'),
  'Minneapolis, MN': us(16.37, 2026, 'Minneapolis'),
  'Portland, OR': us(16.80, 2026, 'Portland metro (from 1 July 2026)'),
};
const ca = (h, year, src) => ({ h, year, src });
const PROV = {
  'British Columbia': ca(18.25, 2026, 'British Columbia (from 1 June 2026)'),
  'Ontario': ca(17.95, 2026, 'Ontario (from 1 October 2026)'),
  'Alberta': ca(15.00, 2019, 'Alberta'),
  'Quebec': ca(16.60, 2026, 'Quebec (from 1 May 2026)'),
  'Manitoba': ca(16.40, 2026, 'Manitoba (from 1 October 2026)'),
  'Saskatchewan': ca(15.70, 2026, 'Saskatchewan (from 1 October 2026)'),
  'Nova Scotia': ca(17.00, 2026, 'Nova Scotia (from 1 October 2026)'),
  'New Brunswick': ca(15.90, 2026, 'New Brunswick (from 1 April 2026)'),
};
const CA_CITY = {
  'Victoria': 'British Columbia', 'Nanaimo, BC': 'British Columbia', 'Vancouver': 'British Columbia', 'Kamloops': 'British Columbia',
  'Surrey': 'British Columbia', 'Kelowna': 'British Columbia',
  'Toronto': 'Ontario', 'Markham': 'Ontario', 'Ottawa': 'Ontario', 'Hamilton': 'Ontario', 'London': 'Ontario', 'Kitchener': 'Ontario',
  'Mississauga': 'Ontario', 'Kingston': 'Ontario', 'Brampton': 'Ontario', 'St.Catharines': 'Ontario', 'Windsor': 'Ontario',
  'Calgary': 'Alberta', 'Edmonton': 'Alberta', 'Red Deer': 'Alberta',
  'Quebec City': 'Quebec', 'Montreal': 'Quebec', 'Winnipeg': 'Manitoba', 'Saskatoon': 'Saskatchewan', 'Regina': 'Saskatchewan',
  'Halifax': 'Nova Scotia', 'Fredericton': 'New Brunswick',
};
const cn = (m, year, src) => ({ m, year, src });
const LOCAL = {
  // China: each province's first tier, which covers its capital and big cities.
  'Shanghai|China': cn(2740, 2025, 'Shanghai'),
  'Beijing|China': cn(2540, 2025, 'Beijing'),
  'Shenzhen|China': cn(2700, 2026, 'Shenzhen (from 1 September 2026)'),
  'Guangzhou|China': cn(2680, 2026, 'Guangzhou (from 1 September 2026)'),
  'Hangzhou|China': cn(2660, 2025, 'Zhejiang, first tier'),
  'Suzhou|China': cn(2660, 2026, 'Jiangsu, first tier'),
  'Nanjing|China': cn(2660, 2026, 'Jiangsu, first tier'),
  'Chengdu|China': cn(2330, 2025, 'Sichuan, first tier'),
  'Qingdao|China': cn(2400, 2026, 'Shandong, first tier'),
  // Japan: prefectures, from the October 2026 revision.
  'Tokyo|Japan': { h: 1280, year: 2026, src: 'Tokyo (from 1 October 2026)' },
  'Nagoya|Japan': { h: 1195, year: 2026, src: 'Aichi (from 1 October 2026)' },
  'Osaka|Japan': { h: 1231, year: 2026, src: 'Osaka (FY2026 revision)' },
  // Indonesia: the city's own UMK, or Jakarta's provincial UMP.
  'Jakarta|Indonesia': cn(5729876, 2026, 'DKI Jakarta UMP'),
  'Bandung|Indonesia': cn(4737678, 2026, 'Kota Bandung UMK'),
  'Surabaya|Indonesia': cn(5288796, 2026, 'Kota Surabaya UMK'),
  // Russia: the two cities with their own agreement; elsewhere the federal MROT.
  'Moscow|Russia': cn(39730, 2026, 'Moscow regional agreement'),
  'Saint Petersburg|Russia': cn(31250, 2026, 'Saint Petersburg regional agreement'),
  // Mexico: the daily rate times 30.4, the monthly figure Mexican law uses.
  'Tijuana|Mexico': { d: 440.87, days: 30.4, year: 2026, src: 'CONASAMI, northern border zone' },
  // Philippines: the region's non-agricultural daily rate.
  'Makati|Philippines': { d: 755, year: 2026, src: 'Metro Manila, Wage Order NCR-27 (from 25 July 2026)' },
  'Quezon City|Philippines': { d: 755, year: 2026, src: 'Metro Manila, Wage Order NCR-27 (from 25 July 2026)' },
  'Manila|Philippines': { d: 755, year: 2026, src: 'Metro Manila, Wage Order NCR-27 (from 25 July 2026)' },
  'Cebu|Philippines': { d: 540, year: 2025, src: 'Central Visayas, Wage Order ROVII-26' },
  // Thailand: the province's daily rate.
  'Bangkok|Thailand': { d: 400, year: 2025, src: 'Bangkok' },
  'Phuket|Thailand': { d: 400, year: 2025, src: 'Phuket' },
  'Pattaya|Thailand': { d: 400, year: 2025, src: 'Chonburi' },
  'Chiang Mai|Thailand': { d: 380, year: 2025, src: 'Mueang Chiang Mai' },
  // Vietnam: region I covers both cities.
  'Ho Chi Minh City|Vietnam': cn(5310000, 2026, 'Region I, Decree 293/2025'),
  'Hanoi|Vietnam': cn(5310000, 2026, 'Region I, Decree 293/2025'),
  // Switzerland: the cantons that have one.
  'Geneva|Switzerland': { h: 24.59, year: 2026, src: 'Canton of Geneva' },
  'Basel|Switzerland': { h: 22.20, year: 2026, src: 'Canton of Basel-Stadt' },
  // Bosnia: Republika Srpska sets its own.
  'Banja Luka|Bosnia And Herzegovina': cn(900, 2025, 'Republika Srpska (net)'),
  // India: the state's unskilled monthly rate for its top zone. Approximate:
  // each state sets dozens of rates by trade, skill and zone.
  'Delhi|India': cn(18456, 2025, 'Delhi, unskilled'),
  'Gurgaon|India': cn(15220, 2026, 'Haryana, unskilled'),
  'Mumbai|India': cn(14956, 2025, 'Maharashtra zone I, unskilled'),
  'Navi Mumbai|India': cn(14956, 2025, 'Maharashtra zone I, unskilled'),
  'Pune|India': cn(14956, 2025, 'Maharashtra zone I, unskilled'),
  'Bangalore|India': cn(15701, 2026, 'Karnataka zone I, unskilled'),
  'Hyderabad|India': cn(15000, 2025, 'Telangana zone I, unskilled'),
  'Chennai|India': cn(13823, 2026, 'Tamil Nadu zone I, unskilled'),
  'Coimbatore|India': cn(13823, 2026, 'Tamil Nadu zone I, unskilled'),
  'Ahmedabad|India': cn(13013, 2025, 'Gujarat zone I, unskilled'),
  'Vadodara|India': cn(13013, 2025, 'Gujarat zone I, unskilled'),
  'Kochi|India': cn(13500, 2026, 'Kerala, unskilled'),
  'Thiruvananthapuram|India': cn(13500, 2026, 'Kerala, unskilled'),
  'Indore|India': cn(12425, 2026, 'Madhya Pradesh, unskilled'),
  'Bhopal|India': cn(12425, 2026, 'Madhya Pradesh, unskilled'),
};
const NO_LOCAL = {
  'India': 'no reliable figure was found for this state; India sets minimum wages by state, trade and zone',
  'Switzerland': 'this canton has no statutory minimum wage',
};

const toMonth = (e, cur) => {
  let v = e.m != null ? e.m : e.w != null ? e.w * 52 / 12 : e.d != null ? e.d * (e.days || 26) : e.h != null ? e.h * 40 * 52 / 12 : null;
  if(v == null) return null;
  if(e.cur && e.cur !== cur){
    const a = BUNDLED[e.cur], b = BUNDLED[cur];
    if(!a || !b) throw new Error('cannot convert ' + e.cur + ' to ' + cur);
    v = v / a * b;
  }
  return v;
};
function minimumOf(c){
  const key = c.city + '|' + c.country;
  let e = LOCAL[key];
  if(!e && c.country === 'United States'){
    const st = (c.city.match(/, ([A-Z]{2})$/) || [])[1];
    e = CITY_MIN[c.city] || ST[st] || US_FED;
  }
  if(!e && c.country === 'Canada'){
    const p = CA_CITY[c.city];
    if(!p) throw new Error('no province for ' + c.city + ', Canada');
    e = PROV[p];
  }
  if(!e) e = MIN[c.country];
  if(!e) throw new Error('no minimum wage entry for ' + c.country);
  if(e.none){
    if(/^set by/.test(e.none)){
      if(NO_LOCAL[c.country]) return { min: null, why: NO_LOCAL[c.country] };
      if(c.country === 'Mexico') e = { d: 315.04, days: 30.4, year: 2026, src: 'CONASAMI, general zone' };
      else if(c.country === 'Russia') e = MIN.Russia;
      else throw new Error('no local minimum wage for ' + key);
    } else return { min: null, why: e.none };
  }
  return { min: toMonth(e, c.currency), year: e.year, src: e.src };
}

// ═══════════════════════════════════════════════════════════
// BUILD
// ═══════════════════════════════════════════════════════════
const round = v => v == null ? null : Number(v.toPrecision(6));
const countries = {};
const cities = {};
let old = 0, vsNyc = 0, noMin = 0;
for(const c of DATA){
  if(!countries[c.country]){
    const r = ratioOf(c.country);
    countries[c.country] = { ratio: r.ratio == null ? null : Number(r.ratio.toFixed(4)), ...(r.year ? { ratio_year: r.year } : {}),
      ...(r.ratio != null ? { ratio_src: r.src } : { ratio_why: r.why }) };
  }
  const a = averageOf(c), m = minimumOf(c);
  // A crowd-sourced average below 80% of the city's own gross minimum wage
  // comes from too few contributors to stand for the city (Plymouth's reads
  // GBP 1,595 a month net against a GBP 2,203 minimum).
  if(a.avg != null && m.min != null && a.avg < 0.8 * m.min){
    console.log('dropped the average for ' + c.city + ', ' + c.country + ': ' + Math.round(a.avg) + ' against a minimum of ' + Math.round(m.min));
    a.avg = null; a.from = null; a.vsNyc = false; a.low = true;
  }
  if(a.from && a.from !== 'current') old++;
  if(a.vsNyc) vsNyc++;
  if(m.min == null) noMin++;
  cities[c.city + '|' + c.country] = {
    avg: round(a.avg),
    ...(a.from && a.from !== 'current' ? { avg_from: a.from } : {}),
    ...(a.avg == null ? { avg_why: a.low ? 'Numbeo\'s average for it falls below its own minimum wage, too few contributors to trust' : 'Numbeo has no salary data for it' } : {}),
    min: round(m.min),
    ...(m.min != null ? { min_year: m.year, min_src: m.src } : { min_why: m.why }),
  };
}
const out = {
  metadata: {
    updated_on: NUMBEO_DATE,
    avg: { source: 'Numbeo', url: 'https://www.numbeo.com/cost-of-living/rankings_current.jsp', date: NUMBEO_DATE, fx_date: FX_DATE,
           note: 'Average monthly net salary: Local Purchasing Power x Cost of Living Plus Rent, against New York at USD ' + NYC_NET_USD },
    median: { source: 'ILOSTAT', url: 'https://ilostat.ilo.org/topics/wages/', note: 'Median over mean monthly earnings of employees, by country' },
    min: { note: 'Statutory gross minimum wage a month: hourly x 40 x 52/12, daily x 26, weekly x 52/12' },
  },
  countries,
  cities,
};
writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
const nr = Object.values(countries).filter(c => c.ratio == null).length;
console.log(`${DATA.length} cities: ${old} average salaries from an older table (${vsNyc} read against New York), ${noMin} without a minimum wage; ${nr} of ${Object.keys(countries).length} countries without a median ratio.`);
