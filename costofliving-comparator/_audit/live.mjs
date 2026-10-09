// Cost of Living Comparator: live exchange rate audit.
//
// The page fetches today's market rate from a free, keyless daily feed and
// falls back through a list of sources to the bundled currency_rates.json.
// The feeds are mocked here (no network), so every case is deterministic:
//
//   L1  a live feed is used: the footer names its date and source with a link
//   L2  the index estimate stays on the bundled rate the indices were priced at
//   L3  the default FX rate shown is the live pair
//   L4  the nominal savings gap (money crossing the border) uses the live rate
//   L5  a failing primary feed falls through to the next source
//   L6  every feed failing leaves the bundled rate, and the footer says so
//   L7  a rate wildly off the bundled one (a redenomination) is not trusted:
//       that pair keeps the bundled rate, never a mix of the two
//   L8  a feed older than the bundled file is ignored
//   L9  a rate arriving after the user picked cities redraws the results
//   L10 a saved live rate is reused on reload without asking the feed again,
//       and asked for again once it is older than the refresh window
//
// Run: node live.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

const MIME = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server = http.createServer((req,res)=>{
  const p = join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/,'/index.html'));
  if(!existsSync(p)){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, {'content-type': MIME[extname(p)]||'application/octet-stream'});
  res.end(readFileSync(p));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const PORT = server.address().port;
const PAGE = `http://127.0.0.1:${PORT}/costofliving-comparator/index.html`;

let pass=0, fail=0;
const check=(name,ok,detail)=>{ console.log((ok?'  PASS  ':'✗ FAIL  ')+name+(detail?'  — '+detail:'')); ok?pass++:fail++; };

const col = JSON.parse(readFileSync(join(HERE,'..','cost_of_living_indices_aggregated.json'),'utf8'));
const rates = JSON.parse(readFileSync(join(HERE,'..','currency_rates.json'),'utf8'));
const RATE = Object.fromEntries(rates.data.map(r=>[r.currency,r.usd_rate]));
const BUNDLED_DATE = rates.metadata.updated_on;
const cityIdx = Object.fromEntries(col.data.map(c=>[c.city+'|'+c.country, c]));
const JKT = cityIdx['Jakarta|Indonesia'], PER = cityIdx['Perth|Australia'];
const FS=50000000, FE=30000000, TS=6000;      // IDR, IDR, AUD
const fi=JKT.coli_with_housing, ti=PER.coli_with_housing;
const bundledFx = RATE.IDR/RATE.AUD;          // IDR per AUD, priced-at
const TE = FE*(1/bundledFx)*(ti/fi);          // est. Perth expenses in AUD, always priced-at
const gap = fx => (TS-TE) - (FS-FE)/fx;       // nominal savings gap in AUD at a crossing rate
const num=s=>parseFloat(String(s).replace(/,/g,'').replace(/[^\d.\-]/g,''));

// Feed payloads. `mult` scales the IDR rate (1.1 = Rupiah 10% weaker).
const LIVE_DATE = '2026-10-02';
const unixOf = d => Date.parse(d+'T00:02:32Z')/1000;
function erFeed(mult, date=LIVE_DATE){
  const r = {...RATE, IDR: RATE.IDR*mult};
  return {result:'success', time_last_update_unix: unixOf(date), base_code:'USD', rates: r};
}
function fawazFeed(mult, date=LIVE_DATE){
  const usd = {};
  Object.entries({...RATE, IDR: RATE.IDR*mult}).forEach(([k,v])=>{ usd[k.toLowerCase()] = v; });
  return {date, usd};
}
const ER = 'open.er-api.com', FZ1 = 'currency-api.pages.dev', FZ2 = 'cdn.jsdelivr.net/npm/@fawazahmed0';

const browser = await chromium.launch();

// feeds: {host: payload | 'fail' | {hold: Promise, body}}; counts requests per host.
async function open(feeds, {context}={}){
  const ctx = context || await browser.newContext({serviceWorkers:'block'});
  const page = await ctx.newPage();
  const hits = {};
  page.on('pageerror', e=>console.log('PAGEERROR:', e.message));
  await page.route('**/*', async route=>{
    const u = route.request().url();
    if(u.includes('127.0.0.1')) return route.continue();
    const host = Object.keys(feeds).find(h=>u.includes(h));
    if(!host) return route.fulfill({contentType:'application/javascript', body:'/* stub */'});
    hits[host] = (hits[host]||0)+1;
    let f = feeds[host];
    if(f && f.hold){ await f.hold; f = f.body; }
    if(f === 'fail') return route.fulfill({status:500, body:'down'});
    return route.fulfill({contentType:'application/json', headers:{'access-control-allow-origin':'*'}, body: JSON.stringify(f)});
  });
  await page.goto(PAGE, {waitUntil:'load'});
  await page.waitForFunction(()=>document.getElementById('dataUpdatedText')?.textContent.length>0);
  return {page, ctx, hits};
}
async function pickCity(page, containerId, key){
  await page.evaluate(({containerId,key})=>{
    const wrap=document.getElementById(containerId);
    const input=wrap.querySelector('input.city-search');
    input.value=key.split('|')[0];
    input.dispatchEvent(new Event('input'));
    const opt=[...wrap.querySelectorAll('.city-opt')].find(o=>o.dataset.key===key);
    opt.dispatchEvent(new MouseEvent('mousedown'));
  },{containerId,key});
  await page.waitForTimeout(80);
}
const setVal=async (page,id,v)=>{ await page.evaluate(({id,v})=>{ const el=document.getElementById(id); el.value=v; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('blur')); },{id,v}); await page.waitForTimeout(80); };
async function setup(page){
  await pickCity(page,'fromPicker','Jakarta|Indonesia');
  await pickCity(page,'toPicker','Perth|Australia');
  await setVal(page,'ss_fs', FS.toLocaleString('en-US'));
  await setVal(page,'ss_fe', FE.toLocaleString('en-US'));
  await setVal(page,'ss_ts', TS.toLocaleString('en-US'));
}
// Settled once the footer is past its first draw and no feed is in flight.
const settle = page => page.waitForTimeout(400);
const read = page => page.evaluate(()=>({
  footer: document.getElementById('dataUpdatedText').textContent,
  link: document.querySelector('#dataUpdatedText a')?.href || '',
  ph: document.getElementById('simpleFxInput')?.placeholder || '',
  te: document.querySelectorAll('.col-card')[1]?.querySelectorAll('.sav-val')[0]?.textContent || '',
  summary: document.getElementById('ss_summary')?.textContent || '',
}));
const sumGap = s => { const m = s.match(/AUD\s*([\d,]+)/); return m ? num(m[1]) : NaN; };
const near = (a,b,tol) => Math.abs(a-b) <= tol;

// ── L1–L4: primary feed live, Rupiah 10% weaker than the bundled rate ──
let cachedCtx;
{
  const {page, ctx} = await open({[ER]: erFeed(1.1), [FZ1]: 'fail', [FZ2]: 'fail'});
  await settle(page); await setup(page);
  const g = await read(page);
  const liveFx = bundledFx*1.1;
  check('L1 the footer names the live date and source, with a link',
    /Live exchange rates as of 2 October 2026, from ExchangeRate-API/.test(g.footer) && g.link.includes('exchangerate-api.com'),
    `"${g.footer}" → ${g.link}`);
  check('L2 the index estimate stays on the bundled rate the indices were priced at',
    near(num(g.te), TE, 1), `est ${g.te}, priced-at ${TE.toFixed(0)} (a live-rate estimate would be ${(TE/1.1).toFixed(0)})`);
  check('L3 the default FX rate is the live pair',
    near(num(g.ph), liveFx, 0.01), `placeholder ${g.ph}, live ${liveFx.toFixed(2)}, bundled ${bundledFx.toFixed(2)}`);
  check('L4 the nominal savings gap crosses the border at the live rate',
    near(sumGap(g.summary), Math.abs(gap(liveFx)), 1),
    `summary AUD ${sumGap(g.summary)}, live ${Math.abs(gap(liveFx)).toFixed(0)}, bundled ${Math.abs(gap(bundledFx)).toFixed(0)}`);
  cachedCtx = ctx;
}

// ── L5: primary down → next source ──
{
  const {page, ctx} = await open({[ER]: 'fail', [FZ1]: fawazFeed(1.2), [FZ2]: 'fail'});
  await settle(page); await setup(page);
  const g = await read(page);
  check('L5 a failing primary feed falls through to the next source',
    near(num(g.ph), bundledFx*1.2, 0.01) && /Fawaz Ahmed/.test(g.footer),
    `placeholder ${g.ph} (want ${(bundledFx*1.2).toFixed(2)}); "${g.footer}"`);
  await ctx.close();
}

// ── L6: every feed down → bundled ──
{
  const {page, ctx} = await open({[ER]: 'fail', [FZ1]: 'fail', [FZ2]: 'fail'});
  await settle(page); await setup(page);
  const g = await read(page);
  check('L6 with every feed down the bundled rate is used, and the footer says so',
    near(num(g.ph), bundledFx, 0.01) && near(sumGap(g.summary), Math.abs(gap(bundledFx)), 1) && /live rates unavailable/.test(g.footer),
    `placeholder ${g.ph} (bundled ${bundledFx.toFixed(2)}); "${g.footer}"`);
  await ctx.close();
}

// ── L7: IDR 100x off (a redenomination the feed got wrong) ──
{
  const {page, ctx} = await open({[ER]: erFeed(100), [FZ1]: 'fail', [FZ2]: 'fail'});
  await settle(page); await setup(page);
  const g = await read(page);
  check('L7 a rate far off the bundled one is not trusted; the pair stays bundled',
    near(num(g.ph), bundledFx, 0.01) && near(sumGap(g.summary), Math.abs(gap(bundledFx)), 1),
    `placeholder ${g.ph}, bundled ${bundledFx.toFixed(2)}, the bad feed would say ${(bundledFx*100).toFixed(0)}`);
  await ctx.close();
}

// ── L8: a feed dated before the bundled file ──
{
  const old = '2020-01-01';
  const {page, ctx} = await open({[ER]: erFeed(1.1, old), [FZ1]: fawazFeed(1.3, old), [FZ2]: fawazFeed(1.3, old)});
  await settle(page); await setup(page);
  const g = await read(page);
  check('L8 a feed older than the bundled file is ignored',
    near(num(g.ph), bundledFx, 0.01) && /live rates unavailable/.test(g.footer),
    `bundled ${BUNDLED_DATE}, feed ${old}; placeholder ${g.ph}`);
  await ctx.close();
}

// ── L9: the rate arrives after the cities are picked ──
{
  let release; const hold = new Promise(r=>{ release = r; });
  const {page, ctx} = await open({[ER]: {hold, body: erFeed(1.1)}, [FZ1]: 'fail', [FZ2]: 'fail'});
  await setup(page);
  const before = await read(page);
  release(); await settle(page);
  const after = await read(page);
  check('L9 a late live rate redraws the results in place',
    near(num(before.ph), bundledFx, 0.01) && near(num(after.ph), bundledFx*1.1, 0.01)
      && near(sumGap(after.summary), Math.abs(gap(bundledFx*1.1)), 1) && near(num(after.te), TE, 1),
    `placeholder ${before.ph} → ${after.ph}, est ${before.te} → ${after.te}`);
  await ctx.close();
}

// ── L10: reuse of the saved rate, and refresh once stale ──
{
  // Same browser profile as L1, which saved a 1.1x rate. The feed now says 1.5x.
  const {page, hits} = await open({[ER]: erFeed(1.5), [FZ1]: 'fail', [FZ2]: 'fail'}, {context: cachedCtx});
  await settle(page); await setup(page);
  const g = await read(page);
  check('L10a a saved live rate is reused on reload without asking the feed',
    !hits[ER] && near(num(g.ph), bundledFx*1.1, 0.01) && /Live exchange rates/.test(g.footer),
    `feed requests ${hits[ER]||0}, placeholder ${g.ph}`);
  await page.evaluate(()=>{
    const k='costofliving-comparator:live-fx', v=JSON.parse(localStorage.getItem(k));
    v.savedAt -= 7*3600*1000; localStorage.setItem(k, JSON.stringify(v));
  });
  const p2 = await open({[ER]: erFeed(1.5), [FZ1]: 'fail', [FZ2]: 'fail'}, {context: cachedCtx});
  await settle(p2.page); await setup(p2.page);
  const g2 = await read(p2.page);
  check('L10b a saved rate past the refresh window is fetched again',
    p2.hits[ER]===1 && near(num(g2.ph), bundledFx*1.5, 0.01),
    `feed requests ${p2.hits[ER]||0}, placeholder ${g2.ph} (want ${(bundledFx*1.5).toFixed(2)})`);
  await cachedCtx.close();
}

console.log(`\nlive FX audit: ${pass} passed, ${fail} failed`);
await browser.close();
server.close();
process.exit(fail?1:0);
