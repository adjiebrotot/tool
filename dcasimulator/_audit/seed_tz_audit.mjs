// DCA Simulator — custom-asset (GBM) determinism & date-handling audit.
// Extracts the seed/GBM functions verbatim from BOTH engines and checks:
//   S1  single-asset tool: the same custom asset must produce the SAME price
//       path regardless of the DCA style/amount being tested (that is the whole
//       point of comparing styles). The seed key includes amount|style|dayOrDate,
//       so it does not.
//   S2  portfolio tool: same custom asset → same path (seed keyed on the asset
//       identity only). Expected to pass — this is the reference behaviour.
//   S3  cross-tool: identical custom asset gives the same path in both tools.
//   TZ  generateGBMPrices mixes UTC parsing (new Date('YYYY-MM-DD')) with local
//       getDay()/weekend filtering: run the same generation under TZ=UTC and
//       TZ=America/New_York and compare the date axes (west-of-UTC users get
//       Saturday-dated points and no Mondays).
// Run: node seed_tz_audit.mjs   (re-execs itself under two TZs for the TZ check)
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const singleSrc = readFileSync(join(HERE, '..', 'script.js'), 'utf8');
const portSrc   = readFileSync(join(HERE, '..', 'portfolio', 'script.js'), 'utf8');

function extract(src, names){
  // pull top-level `function name(...){...}` definitions verbatim
  const out = {};
  for(const name of names){
    const start = src.indexOf('function '+name+'(');
    if(start<0) throw new Error('cannot find '+name);
    let depth=0, i=src.indexOf('{', start);
    let j=i;
    for(; j<src.length; j++){
      if(src[j]==='{') depth++;
      else if(src[j]==='}'){ depth--; if(depth===0) break; }
    }
    out[name]=src.slice(start, j+1);
  }
  return out;
}
function buildEngine(src){
  const fns = extract(src, ['sanitizeSeed','createSeededRng','deriveSeed','generateGBMPrices','parseDate','addDays','isoDate']);
  const body = Object.values(fns).join('\n') +
    '\nreturn {sanitizeSeed, createSeededRng, deriveSeed, generateGBMPrices};';
  // DEFAULT_RANDOM_SEED referenced by sanitizeSeed
  return new Function('DEFAULT_RANDOM_SEED', body)(25823952204);
}

const single = buildEngine(singleSrc);
const port   = buildEngine(portSrc);
const SEED = 25823952204;

let pass=0, fail=0;
const check=(name,ok,detail)=>{ console.log((ok?'  PASS  ':'✗ FAIL  ')+name+(detail?'  — '+detail:'')); ok?pass++:fail++; };

if(process.env.__TZ_CHILD){
  // child mode: print the first 12 generated dates for a fixed seed
  const rng = single.createSeededRng(single.deriveSeed(SEED,'x'));
  const {dates} = single.generateGBMPrices('2024-01-01','2024-01-31', 8, 15, 100, rng);
  console.log(JSON.stringify(dates.slice(0,12)));
  process.exit(0);
}

// ── S1: single-asset tool — same asset, different DCA style/amount ──
{
  // runSimulation seeds with `${name}|${returnPct}|${stdPct}|${amount}|${style}|${dayOrDate}`
  const key = (amount,style,dayOrDate)=>`SIM A|8|15|${amount}|${style}|${dayOrDate}`;
  const gen = k => single.generateGBMPrices('2020-01-01','2020-06-30', 8, 15, 100,
    single.createSeededRng(single.deriveSeed(SEED, k))).prices;
  const a = gen(key(1000,'monthly-date',1));
  const b = gen(key(1000,'weekly-day',1));      // user only switched style
  const c = gen(key(500 ,'monthly-date',1));    // user only changed amount
  const same=(x,y)=>x.length===y.length&&x.every((v,i)=>v===y[i]);
  check('S1 single-asset: price path of a custom asset is independent of DCA style/amount',
    same(a,b)&&same(a,c),
    `same asset, style changed → paths diverge at day 1: ${a[1].toFixed(4)} vs ${b[1].toFixed(4)}; `+
    `amount changed → ${a[1].toFixed(4)} vs ${c[1].toFixed(4)}`);
}

// ── S2: portfolio tool — seed keyed on asset identity only ──
{
  const gen = k => port.generateGBMPrices('2020-01-01','2020-06-30', 8, 15, 100,
    port.createSeededRng(port.deriveSeed(SEED, k))).prices;
  // portfolio seeds with `${name}|${returnPct}|${stdPct}` — no strategy params
  const a = gen('SIM A|8|15'), b = gen('SIM A|8|15');
  check('S2 portfolio: same custom asset → same path', a.every((v,i)=>v===b[i]), '');
}

// ── S3: cross-tool — the same named custom asset should look the same in both ──
{
  const s = single.generateGBMPrices('2020-01-01','2020-06-30', 8, 15, 100,
    single.createSeededRng(single.deriveSeed(SEED, 'SIM A|8|15|1000|monthly-date|1'))).prices;
  const p = port.generateGBMPrices('2020-01-01','2020-06-30', 8, 15, 100,
    port.createSeededRng(port.deriveSeed(SEED, 'SIM A|8|15'))).prices;
  check('S3 cross-tool: identical custom asset renders the same price path in both tools',
    s.length===p.length && s.every((v,i)=>v===p[i]),
    `single-asset seeds on strategy params too, so the two tools show different "history" for the same asset`);
}

// ── TZ: date axis must not depend on the user's timezone ──
{
  const run = tz => execFileSync(process.execPath, [fileURLToPath(import.meta.url)],
    {env:{...process.env, TZ:tz, __TZ_CHILD:'1'}}).toString().trim();
  const utc = JSON.parse(run('UTC'));
  const ny  = JSON.parse(run('America/New_York'));
  const sameAxis = JSON.stringify(utc)===JSON.stringify(ny);
  const dow = d=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(d+'T00:00Z').getUTCDay()];
  check('TZ custom-asset date axis identical in UTC and America/New_York', sameAxis,
    sameAxis?'' :`UTC starts ${utc.slice(0,5).map(d=>d+'('+dow(d)+')').join(' ')} but `+
                 `New York starts ${ny.slice(0,5).map(d=>d+'('+dow(d)+')').join(' ')}`);
}

console.log(`\ndcasimulator seed/tz audit: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
