(function(){
'use strict';

// ═══════════════════════════════════════════════════════════
// DATA (loaded async)
// ═══════════════════════════════════════════════════════════
let CITIES = [];
let RATES = {};
let META_COL = '';
let META_RATE = '';

// Build lookup
const CITY_MAP = {};

async function loadData() {
  const [colRes, rateRes] = await Promise.all([
    fetch('cost_of_living_indices_aggregated.json'),
    fetch('currency_rates.json')
  ]);
  const colJson = await colRes.json();
  const rateJson = await rateRes.json();

  META_COL = parseMonthYear(colJson.metadata.updated_on);
  META_RATE = parseMonthYear(rateJson.metadata.updated_on);

  CITIES = colJson.data.map(c => ({
    city: c.city,
    country: c.country,
    currency: c.currency,
    coli_no_housing: c.coli_no_housing,
    coli_with_housing: c.coli_with_housing,
    housing_index: c.housing_index,
    rent_index_med: c.rent_index && c.rent_index.med != null ? c.rent_index.med : null,
    groceries_index: c.groceries_index,
    eating_out_index: c.eating_out_index,
    lpp: c.local_purchasing_power_index,
    elec: c.utilities_index && c.utilities_index.electricity ? c.utilities_index.electricity.Median || null : null,
    water: c.utilities_index && c.utilities_index.water ? c.utilities_index.water.Median || null : null,
    gas: c.utilities_index && c.utilities_index.gas ? c.utilities_index.gas.Median || null : null,
    fuel: c.utilities_index && c.utilities_index.fuel ? c.utilities_index.fuel.Median || null : null,
  })).filter(c => c.city && c.country);
  CITIES.sort((a, b) => a.city.localeCompare(b.city));
  CITIES.forEach(c => { CITY_MAP[c.city+'|'+c.country] = c; });

  rateJson.data.forEach(r => { RATES[r.currency] = r.usd_rate; });

  const el = document.getElementById('dataUpdatedText');
  if(el) el.textContent = `Cost of living data updated ${META_COL}, currency rates updated ${META_RATE}.`;

  init();
}

function parseMonthYear(dateStr) {
  if(!dateStr) return '';
  const parts = dateStr.split('-');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return (months[parseInt(parts[1],10)-1] || parts[1]) + ' ' + parts[0];
}

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════
const S = {
  mode: 'simple', goal: 'save', housing: 'include', savingsTarget: 'ratio',
  fromKey: '', toKey: '',
  fromSalary: 0, toSalary: 0, fromExpense: 0,
  customFxSimple: null,      // null = use DB; number = fromCurr per 1 toCurr (e.g. IDR per AUD)
  fxShock: 0,                // simple mode: % move in the DESTINATION currency's strength (−20…+20)
  // Detailed
  detailFromKey: '', detailToCities: [], detailToSalaries: [],
  detailFromSalary: 0,
  detailRows: [{catId:'rent', fromAmount:0, overrides:{}}],
  customFxDetailed: [],      // per-destination: null = use DB; number = fromCurr per 1 destCurr
};
let persist = null; // mini cache handle (assigned at init)

// ═══════════════════════════════════════════════════════════
// FORMATTERS
// ═══════════════════════════════════════════════════════════
function fmtN(v,d=0){
  if(v==null||!isFinite(v))return'—';
  return Number(v).toLocaleString('en-AU',{minimumFractionDigits:d,maximumFractionDigits:d});
}
function fmtC(v,curr,compact=false){
  if(v==null||!isFinite(v))return'—';
  const n=Number(v), abs=Math.abs(n), sign=n<0?'-':'';
  if(compact&&abs>=1e9)return sign+curr+' '+(abs/1e9).toFixed(1)+'B';
  if(compact&&abs>=1e6)return sign+curr+' '+(abs/1e6).toFixed(1)+'M';
  return sign+curr+' '+fmtN(abs);
}
function fmtP(v,d=1){return(v!=null&&isFinite(v))?Number(v).toFixed(d)+'%':'—';}
// Format an FX rate so it always carries meaningful precision. Large rates
// (e.g. 1 AUD = 10,800 IDR) show 2 decimals; sub-1 rates (e.g. 1 IDR =
// 0.000055 AUD) expand the decimals so at least 2 significant figures survive
// instead of collapsing to "0.00".
function fmtFx(v){
  if(!isFinite(v)||v===null||v<=0)return'—';
  if(v>=1)return fmtN(v,2);
  const d=Math.min(12,Math.max(2,-Math.floor(Math.log10(v))+1));
  return Number(v).toLocaleString('en-AU',{minimumFractionDigits:2,maximumFractionDigits:d});
}

// ═══════════════════════════════════════════════════════════
// NUMBER INPUT HELPERS
// ═══════════════════════════════════════════════════════════
function parseNum(val) {
  if(typeof val === 'number') return isFinite(val) ? val : 0;
  const cleaned = String(val ?? '').replace(/,/g,'').replace(/[^\d.-]/g,'').trim();
  if(cleaned === '' || cleaned === '-') return 0;
  const n = Number(cleaned);
  return isFinite(n) ? n : 0;
}
// Money fields keep cents and keep a minus sign: "6543.21" must stay 6,543.21
// (not 654,321) and "-5000" must stay −5,000 (not +5,000).
const MONEY_FMT = {maxDecimals:2, allowNegative:true};
function liveMoney(el) {
  if(!el) return;
  // An empty field stays empty — otherwise clearing an overridden cell would
  // type a "0" override instead of reverting to the estimate.
  if(String(el.value ?? '').trim() === '') return;
  SharedFmt.liveFormat(el, MONEY_FMT);
}
function formatMoneyValue(val) {
  const n = parseNum(val);
  if(!isFinite(n)) return '';
  return n.toLocaleString('en-AU', {minimumFractionDigits:0, maximumFractionDigits:2});
}
function formatMoneyInput(el) {
  if(!el) return;
  const raw = String(el.value ?? '').replace(/,/g,'').trim();
  if(raw === '') { el.value = ''; return; }
  el.value = formatMoneyValue(raw);
}

// ═══════════════════════════════════════════════════════════
// CITY UTILITIES
// ═══════════════════════════════════════════════════════════
function getCity(key){return key?CITY_MAP[key]:null;}
function cityKey(c){return c.city+'|'+c.country;}
function cityDisplay(c){return c.city+', '+c.country;}

// Returns 0 (falsy) for a currency with no known USD rate so the conversion
// guards below fire and the UI shows "—" instead of silently converting 1:1.
function getRate(curr){return RATES[curr]||0;}

// Returns number of fromCurr per 1 toCurr using DB rates (DST/SRC notation)
function getDefaultFxRate(fromCurr, toCurr){
  const fr=getRate(fromCurr), tr=getRate(toCurr);
  if(!tr)return 0;
  return fr/tr;
}

// Convert expense from one city to another.
// customRate: fromCurr per toCurr (null = use DB).
// Returns null when no honest estimate exists (a missing index or a missing FX
// rate) so the caller renders "—" instead of a fabricated number.
function convertExpense(amount, fromCity, toCity, indexKey, customRate){
  if(!fromCity||!toCity)return null;
  if(!amount)return 0;
  const fi=getIdx(fromCity,indexKey), ti=getIdx(toCity,indexKey);
  if(fi==null||ti==null||fi<=0)return null;
  if(customRate!=null&&customRate>0){
    return amount/customRate*(ti/fi);
  }
  const fr=getRate(fromCity.currency), tr=getRate(toCity.currency);
  if(!fr||!tr)return null;
  return amount/fr*(ti/fi)*tr;
}

function convertCurr(amount,fromCurr,toCurr){
  const fr=getRate(fromCurr), tr=getRate(toCurr);
  if(!fr||!tr)return NaN; // unknown rate → let the display fall back to "—"
  return amount/fr*tr;
}

// Composite "utilities" weights (they must sum to 1 for a complete city).
const UTIL_PARTS=[['electricity','elec',0.5],['water','water',0.2],['gas','gas',0.3]];

// Index lookup. `idx` is null when the dataset has no value for that component
// (never a stand-in of 100, the base city's level), which would silently invent
// data. For the utilities composite the surviving weights are renormalised and
// the dropped components are reported in `missing` so the UI can say so.
function idxInfo(city, key){
  if(!city)return{idx:null,missing:[]};
  const val=v=>({idx:(v!=null&&v>0)?v:null,missing:[]});
  if(key==='rent')return val(city.rent_index_med);
  if(key==='groceries')return val(city.groceries_index);
  if(key==='eating_out')return val(city.eating_out_index);
  if(key==='electricity')return val(city.elec);
  if(key==='water')return val(city.water);
  if(key==='gas_util')return val(city.gas);
  if(key==='fuel')return val(city.fuel);
  if(key==='coli_no_housing')return val(city.coli_no_housing);
  if(key==='coli_with_housing')return val(city.coli_with_housing);
  if(key==='currency_only')return{idx:100,missing:[]}; // no index applies, FX only
  if(key==='utilities'){
    let acc=0,wt=0; const missing=[];
    UTIL_PARTS.forEach(([label,prop,w])=>{
      const v=city[prop];
      if(v!=null&&v>0){acc+=w*v;wt+=w;} else missing.push(label);
    });
    return{idx:wt>0?acc/wt:null,missing};
  }
  return{idx:null,missing:[]};
}
function getIdx(city, key){return idxInfo(city,key).idx;}

function coliKey(){return S.housing==='include'?'coli_with_housing':'coli_no_housing';}

// ═══════════════════════════════════════════════════════════
// CUSTOM FX GUARDS
// A custom rate only means something between two different currencies. These
// readers are the ONLY way the engine sees a custom rate, so a rate left over
// from an earlier city can never be applied invisibly.
// ═══════════════════════════════════════════════════════════
function usableFx(rate,fromCity,toCity){
  if(!fromCity||!toCity||fromCity.currency===toCity.currency)return null;
  return(rate!=null&&rate>0&&isFinite(rate))?rate:null;
}
function simpleFx(fromCity,toCity){return usableFx(S.customFxSimple,fromCity,toCity);}
function detailFx(ci,fromCity,toCity){return usableFx(S.customFxDetailed[ci],fromCity,toCity);}

// Drops custom rates that no longer apply (city cleared, or both sides now on
// the same currency). Called on every city change and on cache restore.
function pruneCustomFx(){
  S.fxShock=fxShockPct();   // a cached value from an older build can be out of range
  if(!simpleFx(getCity(S.fromKey),getCity(S.toKey)))S.customFxSimple=null;
  if(!Array.isArray(S.customFxDetailed))S.customFxDetailed=[];
  if(!Array.isArray(S.detailToCities)||!S.detailToCities.length)S.detailToCities=[''];
  S.customFxDetailed.length=S.detailToCities.length;
  const df=getCity(S.detailFromKey);
  S.detailToCities.forEach((k,i)=>{
    if(!detailFx(i,df,getCity(k)))S.customFxDetailed[i]=null;
  });
}

// ═══════════════════════════════════════════════════════════
// FX SHOCK (simple mode)
//
// S.fxShock is a percentage move in the DESTINATION currency's strength against
// the source currency, applied on top of whatever base rate is in force (the
// bundled one, or the user's custom rate).
//
// Local prices are sticky and the exchange rate is not. A weaker Rupiah does
// not reprice a Perth lunch in AUD, and it does not reprice a Jakarta lunch in
// IDR either. What it changes is only the bridge between the two: the Perth
// lunch costs an Indonesian more IDR, while an Australian notices nothing.
//
// The maths already works this way. The cost-of-living indices are USD-
// normalised against a base city (this dataset is rebased to Perth = 100, not
// Numbeo's New York; the choice does not matter because it cancels below), so
// index_c = P_c / (e_c * P_base) * 100, where P is the local price of the
// basket and e is units of local currency per USD. Substituting that into the
// estimate makes both the base and the FX terms cancel outright:
//
//   est = expense * (e_dst/e_src) * (I_dst/I_src)  =  expense * P_dst/P_src
//
// A ratio of LOCAL prices, with no rate left in it. So the destination's cost
// in its own currency, and the savings ratio built from it, must hold still
// under any rate the user can touch. Only figures that cross the two currencies
// reprice. Two rules follow, and both are enforced in simpleMults():
//
//   1. The shock slider never reaches the estimate.
//   2. Neither does the custom FX rate. It is a market rate for converting
//      money across the border, NOT a correction to the rate the indices were
//      priced at (that one is Numbeo's, baked into the index, and unknowable
//      from here). Letting it move the estimate would say a Perth lunch got
//      dearer in AUD because the Rupiah slipped, which is exactly wrong.
// ═══════════════════════════════════════════════════════════
const FX_SHOCK_LIMIT = 20;   // +/-%, wide enough for a realistic swing

function fxShockPct(){
  const v = Number(S.fxShock);
  if(!isFinite(v)) return 0;
  return Math.max(-FX_SHOCK_LIMIT, Math.min(FX_SHOCK_LIMIT, Math.round(v)));
}
// 1 (no shock) when the shock cannot mean anything: a city is unset, or both
// sides already share a currency.
function fxShockMult(fromCity,toCity){
  if(!fromCity||!toCity||fromCity.currency===toCity.currency) return 1;
  return 1 + fxShockPct()/100;
}
// Every multiplier simple mode needs, all quoted as fromCurr per 1 toCurr.
// NaN propagates from a missing rate so the UI renders the "no data" dash
// rather than a wrong 1:1 conversion.
function simpleMults(fromCity,toCity){
  const fr = getRate(fromCity?fromCity.currency:''), tr = getRate(toCity?toCity.currency:'');
  const cfx = simpleFx(fromCity,toCity);
  // The rate the indices were priced at. Falls back to the user's rate only
  // when the dataset has none at all, since some rate beats no estimate.
  const priced = (fr&&tr) ? fr/tr : (cfx || NaN);
  // The rate money actually crosses at: the user's if given, then the scenario.
  const market = (cfx || priced) * fxShockMult(fromCity,toCity);
  return {
    priced, market,
    idxMult:    1/priced,   // src->dst, index estimate only (local prices are sticky)
    fromToMult: 1/market,   // src->dst, for money crossing the border
    toFromMult: market,     // dst->src, for money crossing the border
  };
}

// A destination cell override is an amount in that destination's currency, so
// it stops meaning anything the moment the column changes currency.
function clearColOverrides(ci){
  const k=String(ci);
  S.detailRows.forEach(r=>{if(r.overrides)delete r.overrides[k];});
}
function currOf(city){return city?city.currency:'';}

// ═══════════════════════════════════════════════════════════
// CITY PICKER WIDGET
// ═══════════════════════════════════════════════════════════
function buildCityPicker(containerId, currentKey, onSelect){
  const wrap = document.getElementById(containerId);
  if(!wrap) return;
  const current = getCity(currentKey);
  const input = document.createElement('input');
  input.type='text'; input.className='city-search'; input.placeholder='Search city…';
  input.autocomplete='off';
  if(current){input.value=cityDisplay(current);input.classList.add('has-value');}
  const drop = document.createElement('div');
  drop.className='city-dropdown';
  const btnClear=document.createElement('button');
  btnClear.type='button'; btnClear.className='city-clear'; btnClear.textContent='×';
  btnClear.setAttribute('tabindex','-1'); btnClear.setAttribute('aria-label','Clear');
  btnClear.addEventListener('mousedown',e=>{
    e.preventDefault();
    input.value=''; input.classList.remove('has-value');
    drop.classList.remove('open');
    onSelect(null);
    input.focus();
  });
  wrap.innerHTML=''; wrap.appendChild(input); wrap.appendChild(btnClear); wrap.appendChild(drop);

  let focusIdx=-1;
  function renderDrop(q){
    const lq=q.toLowerCase();
    const filtered=CITIES.filter(c=>c.city.toLowerCase().includes(lq)||c.country.toLowerCase().includes(lq)||c.currency.toLowerCase().includes(lq)).slice(0,60);
    drop.innerHTML=filtered.map((c,i)=>`<div class="city-opt" data-key="${cityKey(c)}" data-idx="${i}"><strong>${c.city}</strong>, ${c.country}</div>`).join('');
    focusIdx=-1;
    drop.querySelectorAll('.city-opt').forEach(el=>{
      el.addEventListener('mousedown',e=>{
        e.preventDefault();
        const key=el.dataset.key;
        const city=getCity(key);
        input.value=cityDisplay(city); input.classList.add('has-value');
        drop.classList.remove('open');
        onSelect(key);
      });
    });
  }

  input.addEventListener('focus',()=>{renderDrop(input.value);drop.classList.add('open');});
  input.addEventListener('input',()=>{renderDrop(input.value);drop.classList.add('open');input.classList.remove('has-value');});
  input.addEventListener('keydown',e=>{
    const opts=drop.querySelectorAll('.city-opt');
    if(e.key==='ArrowDown'){focusIdx=Math.min(focusIdx+1,opts.length-1);}
    else if(e.key==='ArrowUp'){focusIdx=Math.max(focusIdx-1,-1);}
    else if(e.key==='Enter'&&focusIdx>=0){opts[focusIdx].dispatchEvent(new MouseEvent('mousedown'));return;}
    else if(e.key==='Escape'){drop.classList.remove('open');return;}
    opts.forEach((o,i)=>o.classList.toggle('focused',i===focusIdx));
    if(focusIdx>=0)opts[focusIdx].scrollIntoView({block:'nearest'});
  });
  document.addEventListener('click',e=>{if(!wrap.contains(e.target))drop.classList.remove('open');},{passive:true});
}

// ═══════════════════════════════════════════════════════════
// EXPENSE CATEGORIES (Detailed mode)
// ═══════════════════════════════════════════════════════════
const CATS=[
  {id:'rent',label:'🏠 Rent',index:'rent',tip:'Monthly rent (median estimate using rent index)'},
  {id:'groceries',label:'🛒 Groceries',index:'groceries',tip:'Supermarket & grocery shopping'},
  {id:'eating_out',label:'🍽️ Eating Out',index:'eating_out',tip:'Restaurants, cafes, takeaway'},
  {id:'utilities',label:'⚡ Utilities',index:'utilities',tip:'Composite utility cost: 50% electricity + 20% water + 30% gas'},
  {id:'electricity',label:'💡 Electricity',index:'electricity',tip:'Electricity bills (residential)'},
  {id:'water',label:'💧 Water',index:'water',tip:'Water & sewage bills'},
  {id:'gas_util',label:'🔥 Gas',index:'gas_util',tip:'Gas utility bills'},
  {id:'fuel',label:'⛽ Fuel',index:'fuel',tip:'Vehicle fuel costs (petrol/diesel)'},
  {id:'remittance',label:'💸 Remittance',index:'currency_only',tip:'International money transfers — the amount is fixed globally; only the exchange rate applies when comparing cities.'},
  {id:'intl_travel',label:'✈️ International Travel',index:'currency_only',tip:'International travel costs (e.g. flights booked abroad) — price is fixed globally; only the exchange rate applies when comparing cities.'},
  {id:'other',label:'🌐 Other',index:'coli_no_housing',tip:'General living expenses'},
];

// ═══════════════════════════════════════════════════════════
// RENDER ORCHESTRATOR
// ═══════════════════════════════════════════════════════════
function render(){
  pruneCustomFx();                // never carry a custom rate that no longer applies
  if(persist) persist.schedule(); // render is the universal funnel — save the current S
  // Housing row visibility
  document.getElementById('housingRow').style.display=S.mode==='simple'?'flex':'none';
  document.getElementById('simpleCityCard').style.display=S.mode==='simple'?'flex':'none';
  syncSwapButton();

  if(S.mode==='simple'){
    renderSimpleFxSection(getCity(S.fromKey),getCity(S.toKey));
  } else {
    const fxCard=document.getElementById('simpleFxCard');
    if(fxCard)fxCard.style.display='none';
  }
  renderAnalysisArea();
}

// Results only. Kept separate from render() so dragging the FX slider can
// refresh the numbers without rebuilding (and so killing the drag of) the
// slider element itself.
function renderAnalysisArea(){
  const area=document.getElementById('analysisArea');
  if(S.mode==='simple'){
    const from=getCity(S.fromKey), to=getCity(S.toKey);
    if(!from||!to){
      area.innerHTML=`<div class="card placeholder"><div class="icon">🗺️</div><div>Select a <strong>From</strong> and <strong>To</strong> city above to begin your analysis.</div></div>`;
      return;
    }
    S.goal==='save'?renderSimpleSave(area,from,to):renderSimpleEarn(area,from,to);
  } else {
    renderDetailed(area);
  }
}

function renderSimpleFxSection(from,to){
  const card=document.getElementById('simpleFxCard');
  if(!card)return;
  if(!from||!to||from.currency===to.currency){card.style.display='none';return;}
  const fc=from.currency, tc=to.currency;
  const defRate=getDefaultFxRate(fc,tc);
  const defFmt=defRate?fmtFx(defRate):'—';
  const pct=fxShockPct();
  card.style.display='flex';
  card.innerHTML=`
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;width:100%;">
      <span style="font-size:0.78rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;">Custom FX Rate</span>
      <span style="font-size:0.88rem;white-space:nowrap;">1&nbsp;<strong>${tc}</strong>&nbsp;=</span>
      <input type="text" inputmode="decimal" class="num-input" id="simpleFxInput"
        value="${S.customFxSimple!=null?S.customFxSimple:''}"
        placeholder="${defFmt}"
        style="width:130px;"/>
      <span style="font-size:0.88rem;font-family:'DM Mono',monospace;white-space:nowrap;"><strong>${fc}</strong></span>
      <span style="font-size:0.78rem;color:var(--muted);white-space:nowrap;">Default: ${defFmt}&nbsp;${fc}</span>
    </div>
    <div class="fx-shock ${pct?'shocked':''}" id="fxShockBlock">
      <div class="fx-shock-head">
        <span class="fx-shock-title">What if ${tc} moves?</span>
        <span class="fx-shock-val" id="fxShockVal">${fxShockReadout(from,to)}</span>
      </div>
      <input type="range" id="fxShockSlider" min="-${FX_SHOCK_LIMIT}" max="${FX_SHOCK_LIMIT}" step="1" value="${pct}"
        aria-label="Exchange rate scenario, percent change in ${tc} against ${fc}"/>
      <div class="fx-shock-note">
        <span>${to.city} costs stay the same in ${tc}. Only ${fc} conversions move.</span>
        <button type="button" class="fx-shock-reset" id="fxShockReset">Reset</button>
      </div>
    </div>`;
  const inp=document.getElementById('simpleFxInput');
  if(inp){
    inp.addEventListener('input',()=>{
      const raw=String(inp.value).replace(/,/g,'').trim();
      const v=parseFloat(raw);
      S.customFxSimple=(isFinite(v)&&v>0)?v:null;
      if(persist)persist.schedule();
    });
    inp.addEventListener('blur',()=>{render();});
  }
  const sl=document.getElementById('fxShockSlider');
  if(sl){
    // Refresh the readout and the results in place. A full render() here would
    // replace the range input mid-drag and the gesture would die.
    sl.addEventListener('input',()=>{
      S.fxShock=Number(sl.value)||0;
      updateFxShockUI(from,to);
      renderAnalysisArea();
      if(persist)persist.schedule();
    });
  }
  const rst=document.getElementById('fxShockReset');
  if(rst)rst.addEventListener('click',()=>{
    S.fxShock=0;
    if(sl)sl.value='0';
    updateFxShockUI(from,to);
    renderAnalysisArea();
    if(persist)persist.schedule();
  });
}

// "+8%  1 AUD = 13,667 IDR": the scenario and the rate it implies.
function fxShockReadout(from,to){
  const pct=fxShockPct();
  const M=simpleMults(from,to);
  const rate=isFinite(M.market)?fmtFx(M.market)+' '+from.currency:'—';
  return `${pct>0?'+':''}${pct}%  ·  1 ${to.currency} = ${rate}`;
}

// In-place refresh of just the readout (never the range input, which would kill
// the drag).
function updateFxShockUI(from,to){
  const val=document.getElementById('fxShockVal');
  if(val)val.textContent=fxShockReadout(from,to);
  const blk=document.getElementById('fxShockBlock');
  if(blk)blk.classList.toggle('shocked',!!fxShockPct());
}

// ═══════════════════════════════════════════════════════════
// SIMPLE – I CAN SAVE
// ═══════════════════════════════════════════════════════════
function renderSimpleSave(area,from,to){
  const fc=from.currency, tc=to.currency;
  const fs=S.fromSalary||0, fe=S.fromExpense||0, ts=S.toSalary||0;
  const ck=coliKey();
  const fi=getIdx(from,ck), ti=getIdx(to,ck);
  const M=simpleMults(from,to);
  const fromToMult=M.fromToMult, toFromMult=M.toFromMult;
  // The estimate uses the priced-at rate, never the custom rate or the scenario:
  // it is a ratio of local prices, which no currency move touches. See the FX
  // SHOCK note above.
  const te=!fe?0:(fi&&ti?fe*M.idxMult*(ti/fi):NaN);
  const fSav=fs-fe, tSav=ts-te;
  // A savings ratio needs a positive salary to divide by — otherwise show "—"
  // rather than a made-up 0%.
  const fRatio=fs>0?fSav/fs*100:null, tRatio=ts>0?tSav/ts*100:null;

  // Cross-currency display (uses custom FX if set)
  const xc=(a,c1,c2)=>{if(c1===c2)return a;return(c1===fc)?a*fromToMult:a*toFromMult;};
  const cc=(a,c1,c2)=>c1!==c2?`<div class="field-approx">≈ ${fmtC(xc(a,c1,c2),c2)}</div>`:'';

  area.innerHTML=`
<section class="analysis-card card">
  <div class="compare-cols">
    <div class="col-card">
      <div class="col-header">📍 ${from.city}, ${from.country}</div>
      <div class="col-sub">${fc}</div>
      <div class="field-row">
        <div class="field-label">Net Monthly Salary</div>
        <div class="input-wrap"><span class="curr-tag">${fc}</span><input type="text" inputmode="decimal" class="num-input" id="ss_fs" value="${formatMoneyValue(fs)||''}" placeholder="0"/></div>
        ${cc(fs,fc,tc)}
      </div>
      <div class="field-row">
        <div class="field-label">Monthly Expenses</div>
        <div class="input-wrap"><span class="curr-tag">${fc}</span><input type="text" inputmode="decimal" class="num-input" id="ss_fe" value="${formatMoneyValue(fe)||''}" placeholder="0"/></div>
        ${cc(fe,fc,tc)}
      </div>
      <div class="field-row">
        <div class="field-label">Monthly Savings</div>
        <div class="sav-block ${fSav>=0?'positive':'negative'}">
          <div class="sav-val">${fmtC(fSav,fc)}</div>
          ${cc(fSav,fc,tc)}
          <div class="sav-ratio">${fRatio!=null?fmtP(fRatio)+' savings ratio':'—'}</div>
        </div>
      </div>
    </div>
    <div class="col-card">
      <div class="col-header">🏁 ${to.city}, ${to.country}</div>
      <div class="col-sub">${tc}</div>
      <div class="field-row">
        <div class="field-label">Net Monthly Salary</div>
        <div class="input-wrap"><span class="curr-tag">${tc}</span><input type="text" inputmode="decimal" class="num-input" id="ss_ts" value="${formatMoneyValue(ts)||''}" placeholder="0"/></div>
        ${cc(ts,tc,fc)}
      </div>
      <div class="field-row">
        <div class="field-label">
          Est. Monthly Expenses
          <span class="tip-icon" data-tip="Estimated using ${S.housing==='include'?'full cost-of-living':'non-housing cost-of-living'} index ratio between cities. Data updated ${META_COL}.${estTipFx(from,to)}">?</span>
        </div>
        <div class="sav-block neutral">
          <div class="sav-val mono">${fmtC(te,tc)}</div>
          ${cc(te,tc,fc)}
        </div>
      </div>
      <div class="field-row">
        <div class="field-label">Monthly Savings</div>
        <div class="sav-block ${tSav>=0?'positive':'negative'}">
          <div class="sav-val">${fmtC(tSav,tc)}</div>
          ${cc(tSav,tc,fc)}
          <div class="sav-ratio">${tRatio!=null?fmtP(tRatio)+' savings ratio':'—'}</div>
        </div>
      </div>
    </div>
  </div>
  <div class="summary-box" id="ss_summary">${buildSaveSummary(from,to,fc,tc,fromToMult,toFromMult,fSav,tSav,fRatio,tRatio)}</div>
</section>`;

  const fsEl = document.getElementById('ss_fs');
  if(fsEl) {
    fsEl.addEventListener('input', e => { liveMoney(e.target); S.fromSalary = parseNum(e.target.value); });
    fsEl.addEventListener('blur', e => { formatMoneyInput(e.target); render(); });
  }
  const feEl = document.getElementById('ss_fe');
  if(feEl) {
    feEl.addEventListener('input', e => { liveMoney(e.target); S.fromExpense = parseNum(e.target.value); });
    feEl.addEventListener('blur', e => { formatMoneyInput(e.target); render(); });
  }
  const tsEl = document.getElementById('ss_ts');
  if(tsEl) {
    tsEl.addEventListener('input', e => { liveMoney(e.target); S.toSalary = parseNum(e.target.value); });
    tsEl.addEventListener('blur', e => { formatMoneyInput(e.target); render(); });
  }
}

function buildSaveSummary(from,to,fc,tc,fromToMult,toFromMult,fSav,tSav,fRatio,tRatio){
  if(!S.fromSalary&&!S.toSalary)return'Enter your salaries above to see the comparison summary.';
  // Nominal-savings gap, expressed in the destination currency (and the source
  // currency), converted with the same custom-aware FX the on-screen cells use.
  const nomDiffTC=tSav-fSav*fromToMult;
  const nomDiffFC=nomDiffTC*toFromMult;
  const ratDiff=tRatio-fRatio;
  const nomPos=nomDiffTC>=0, ratPos=ratDiff>=0;
  const contradict=(nomPos!==ratPos)&&Math.abs(ratDiff)>0.5&&Math.abs(nomDiffTC)>0.5;
  const toName=`<strong>${to.city}</strong>`;
  let nomTxt='', ratTxt='';
  if(Math.abs(nomDiffTC)<0.5){nomTxt=`Living in ${toName} gives roughly the <strong>same nominal savings</strong> as ${from.city}`;}
  else if(nomPos){nomTxt=`Living in ${toName} gives you <span style="color:var(--positive-em);font-weight:700;">${fmtC(Math.abs(nomDiffTC),tc)}${fc!==tc?' (≈ '+fmtC(Math.abs(nomDiffFC),fc)+')':''}</span> <strong>more</strong> in monthly savings`;}
  else{nomTxt=`Living in ${toName} gives you <span style="color:var(--negative-em);font-weight:700;">${fmtC(Math.abs(nomDiffTC),tc)}${fc!==tc?' (≈ '+fmtC(Math.abs(nomDiffFC),fc)+')':''}</span> <strong>less</strong> in monthly savings`;}
  if(Math.abs(ratDiff)<0.5){ratTxt=`with a similar savings ratio (${fmtP(tRatio)} vs ${fmtP(fRatio)})`;}
  else if(ratPos){ratTxt=`<strong>and</strong> a higher savings ratio (${fmtP(tRatio)} vs ${fmtP(fRatio)}, +${fmtP(Math.abs(ratDiff))})`;}
  else{ratTxt=`${contradict?'<strong>but</strong>':'<strong>and</strong>'} a lower savings ratio (${fmtP(tRatio)} vs ${fmtP(fRatio)}, −${fmtP(Math.abs(ratDiff))})`;}
  // The nominal gap crosses currencies, so it is the half that moves with the
  // slider; the ratio comparison is FX-free.
  return `${nomTxt}, ${ratTxt}.`+fxShockLine(from,to,true);
}

// ═══════════════════════════════════════════════════════════
// SIMPLE – I NEED TO EARN
// ═══════════════════════════════════════════════════════════
function renderSimpleEarn(area,from,to){
  const fc=from.currency, tc=to.currency;
  const fs=S.fromSalary||0, fe=S.fromExpense||0;
  const ck=coliKey();
  const fi=getIdx(from,ck), ti=getIdx(to,ck);
  const M=simpleMults(from,to);
  const fromToMult=M.fromToMult, toFromMult=M.toFromMult;
  const fSav=fs-fe, fRatio=fs>0?fSav/fs:0;
  const te=!fe?0:(fi&&ti?fe*M.idxMult*(ti/fi):NaN);

  // toReq === null means "no single answer" (see reqSalNote): matching a 100%
  // savings ratio, or a ratio against zero destination expenses, is true at any
  // salary, so quoting a number (the old "SGD 0") would be nonsense.
  let toReq=null,toSav=null,toRatio=null;
  if(S.savingsTarget==='ratio'){
    if(isFinite(te)&&te>0&&fRatio<1)toReq=te/(1-fRatio);
  } else {
    const fSavInTo=fSav*fromToMult;
    if(isFinite(te)&&isFinite(fSavInTo))toReq=te+fSavInTo;
  }
  if(toReq!=null){toSav=toReq-te; toRatio=toReq>0?toSav/toReq*100:0;}

  const xc=(a,c1,c2)=>{if(c1===c2)return a;return(c1===fc)?a*fromToMult:a*toFromMult;};
  const cc=(a,c1,c2)=>(c1!==c2&&a!=null)?`<div class="field-approx">≈ ${fmtC(xc(a,c1,c2),c2)}</div>`:'';
  const fRatPct=fRatio*100;
  const reqTip=toReq!=null?'':reqSalNote(te,fRatio,to,tc);

  area.innerHTML=`
<section class="analysis-card card">
  <div class="target-row">
    <span style="font-size:0.85rem;color:var(--muted);">Target:</span>
    <div class="seg-group" id="targetGroup">
      <button class="seg-btn ${S.savingsTarget==='ratio'?'active':''}" data-val="ratio">Savings ratio</button>
      <button class="seg-btn ${S.savingsTarget==='nominal'?'active':''}" data-val="nominal">Nominal savings</button>
    </div>
  </div>
  <div class="compare-cols">
    <div class="col-card">
      <div class="col-header">📍 ${from.city}, ${from.country}</div>
      <div class="col-sub">${fc}</div>
      <div class="field-row">
        <div class="field-label">Net Monthly Salary</div>
        <div class="input-wrap"><span class="curr-tag">${fc}</span><input type="text" inputmode="decimal" class="num-input" id="se_fs" value="${formatMoneyValue(fs)||''}" placeholder="0"/></div>
        ${cc(fs,fc,tc)}
      </div>
      <div class="field-row">
        <div class="field-label">Monthly Expenses</div>
        <div class="input-wrap"><span class="curr-tag">${fc}</span><input type="text" inputmode="decimal" class="num-input" id="se_fe" value="${formatMoneyValue(fe)||''}" placeholder="0"/></div>
        ${cc(fe,fc,tc)}
      </div>
      <div class="field-row">
        <div class="field-label">Monthly Savings</div>
        <div class="sav-block ${fSav>=0?'positive':'negative'}">
          <div class="sav-val">${fmtC(fSav,fc)}</div>
          ${cc(fSav,fc,tc)}
          <div class="sav-ratio">${fmtP(fRatPct)} savings ratio</div>
        </div>
      </div>
    </div>
    <div class="col-card">
      <div class="col-header">🏁 ${to.city}, ${to.country}</div>
      <div class="col-sub">${tc}</div>
      <div class="field-row">
        <div class="field-label">Required Net Salary${reqTip?` <span class="tip-icon" data-tip="${reqTip}">?</span>`:''}</div>
        <div class="sav-block positive">
          <div class="req-val">${fmtC(toReq,tc)}</div>
          ${cc(toReq,tc,fc)}
        </div>
      </div>
      <div class="field-row">
        <div class="field-label">
          Est. Monthly Expenses
          <span class="tip-icon" data-tip="Estimated using ${S.housing==='include'?'full cost-of-living':'non-housing cost-of-living'} index ratio. Data updated ${META_COL}.${estTipFx(from,to)}">?</span>
        </div>
        <div class="sav-block neutral">
          <div class="sav-val mono">${fmtC(te,tc)}</div>
          ${cc(te,tc,fc)}
        </div>
      </div>
      <div class="field-row">
        <div class="field-label">Monthly Savings</div>
        <div class="sav-block ${toSav==null?'neutral':(toSav>=0?'positive':'negative')}">
          <div class="sav-val">${fmtC(toSav,tc)}</div>
          ${cc(toSav,tc,fc)}
          <div class="sav-ratio">${toRatio!=null?fmtP(toRatio)+' savings ratio':'—'}</div>
        </div>
      </div>
    </div>
  </div>
  <div class="summary-box">${buildEarnSummary(from,to,fc,tc,M,toReq,fSav,fRatPct,toRatio,te,fRatio)}</div>
</section>`;

  const sefsEl = document.getElementById('se_fs');
  if(sefsEl) {
    sefsEl.addEventListener('input', e => { liveMoney(e.target); S.fromSalary = parseNum(e.target.value); });
    sefsEl.addEventListener('blur', e => { formatMoneyInput(e.target); render(); });
  }
  const sefeEl = document.getElementById('se_fe');
  if(sefeEl) {
    sefeEl.addEventListener('input', e => { liveMoney(e.target); S.fromExpense = parseNum(e.target.value); });
    sefeEl.addEventListener('blur', e => { formatMoneyInput(e.target); render(); });
  }
  document.getElementById('targetGroup').querySelectorAll('.seg-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{S.savingsTarget=btn.dataset.val;render();});
  });
}

// Why a required salary has no single answer. Also used as the tooltip next to
// the "—" so the user is told, not left guessing.
function reqSalNote(te,fRatio,to,tc){
  if(!isFinite(te))return`No exchange rate for ${tc}, so the ${to.city} expenses cannot be estimated.`;
  if(S.savingsTarget==='ratio'&&(te<=0||fRatio>=1))
    return`With no monthly expenses your savings ratio is 100% at any salary, so no single salary matches it. Add your expenses, or switch the target to nominal savings.`;
  return`Not enough data to work out a required salary for ${to.city}.`;
}

function buildEarnSummary(from,to,fc,tc,M,toReq,fSav,fRatPct,toRatio,te,fRatio){
  if(!S.fromSalary)return'Enter your current salary and expenses to calculate what you need to earn in '+to.city+'.';
  if(toReq==null)return reqSalNote(te,fRatio,to,tc);
  const cross=fc!==tc?' (≈ '+fmtC(toReq*M.toFromMult,fc)+')':'';
  if(S.savingsTarget==='ratio'){
    // A ratio target is FX-free on both sides: the required salary and the
    // expenses it has to cover are both in the destination currency.
    return`To maintain the same <strong>${fmtP(fRatPct)}</strong> savings ratio in <strong>${to.city}</strong>, you need a net monthly salary of <strong>${fmtC(toReq,tc)}</strong>${cross}.`
      +fxShockLine(from,to,false);
  } else {
    const fSavInTo=fSav*M.fromToMult;
    const cross2=fc!==tc?' (≈ '+fmtC(fSav,fc)+')':'';
    return`To maintain the same nominal savings of <strong>${fmtC(fSavInTo,tc)}</strong>${cross2} in <strong>${to.city}</strong>, you need a net monthly salary of <strong>${fmtC(toReq,tc)}</strong>${cross}.`
      +fxShockLine(from,to,true);
  }
}

// Appended to the estimated-expenses tooltip while the slider is off zero, so
// the one figure the shock does NOT move is explained rather than suspected.
function estTipFx(from,to){
  if(!fxShockPct()||fxShockMult(from,to)===1)return'';
  return` The FX scenario does not change this: it is a ratio of local prices, and a currency move does not reprice ${to.city}'s shops.`;
}

// Appended to a summary while the slider is off zero, so a scenario figure is
// never mistaken for the live one. `exposed` says whether the headline number
// moves with the rate; for a savings-ratio target it does not.
function fxShockLine(from,to,exposed){
  const pct=fxShockPct();
  if(!pct||fxShockMult(from,to)===1)return'';   // no shock, or same currency both sides
  return`<br><span style="opacity:.85;">💱 <strong>Scenario:</strong> ${to.currency} ${Math.abs(pct)}% `
    +`${pct>0?'stronger':'weaker'}. `
    +(exposed?`This figure moves with the rate.`:`This ${to.currency} figure does not move with the rate.`)
    +`</span>`;
}

// ═══════════════════════════════════════════════════════════
// DETAILED MODE
// ═══════════════════════════════════════════════════════════
function renderDetailed(area){
  if(!S.detailToCities||S.detailToCities.length===0) S.detailToCities=[''];
  if(!S.detailToSalaries||S.detailToSalaries.length!==S.detailToCities.length){
    S.detailToSalaries=S.detailToCities.map((_,i)=>S.detailToSalaries?.[i]||0);
  }
  if(!S.detailRows||S.detailRows.length===0) S.detailRows=[{catId:'rent',fromAmount:0,overrides:{}}];
  pruneCustomFx();
  if(persist) persist.schedule();

  const fromCity=getCity(S.detailFromKey);
  const toCities=S.detailToCities.map(k=>getCity(k));

  area.innerHTML=`<section class="analysis-card card" id="detailSec">${buildDetailHTML(fromCity,toCities)}</section>`;
  wireDetail(fromCity,toCities);
}

function buildDetailHTML(fromCity,toCities){
  const fc=fromCity?fromCity.currency:'—';
  const tcs=toCities.map(c=>c?c.currency:'—');

  // City search headers using inline selects for detail mode
  let thFrom=`<th class="city-th">
    <div style="font-size:0.72rem;color:var(--muted);margin-bottom:3px;">📍 FROM CITY</div>
    <div class="city-picker" id="dtFromPicker" style="min-width:160px;"></div>
    <div class="sub-num" style="margin-top:3px;">${fc}</div>
  </th>`;

  let thTos=toCities.map((tc,i)=>{
    const destCurr=tcs[i];
    return`<th class="city-th">
    <div style="font-size:0.72rem;color:var(--muted);margin-bottom:3px;display:flex;align-items:center;gap:6px;">
      <span>🏁 DESTINATION ${i+1}</span>
      <button class="btn-remove rmv-city-btn" data-ci="${i}" title="Remove destination">✕</button>
    </div>
    <div class="city-picker" id="dtToPicker${i}" style="min-width:140px;"></div>
    <div class="sub-num" style="margin-top:3px;">${destCurr}</div>
  </th>`;
  }).join('');

  // FX Rate row (custom) — one cell per destination; empty when not needed
  const anyFx=toCities.some((tc,i)=>tc&&fromCity&&tcs[i]!==fc);
  let fxFrom=`<td></td>`;
  let fxTos=toCities.map((tc,i)=>{
    const destCurr=tcs[i];
    if(!tc||!fromCity||destCurr===fc)return`<td class="num-td"></td>`;
    const defFx=fmtFx(getDefaultFxRate(fc,destCurr));
    const curCustomFx=detailFx(i,fromCity,tc);
    return`<td class="num-td">
      <div style="display:flex;align-items:center;gap:4px;justify-content:flex-end;flex-wrap:wrap;">
        <span style="font-size:0.75rem;white-space:nowrap;">1&nbsp;<strong>${destCurr}</strong>&nbsp;=</span>
        <input type="text" inputmode="decimal" class="num-input dt-fx-inp" data-ci="${i}"
          value="${curCustomFx!=null?curCustomFx:''}"
          placeholder="${defFx}"
          style="width:80px;padding:4px 6px;font-size:0.78rem;"/>
        <span style="font-size:0.75rem;font-family:'DM Mono',monospace;"><strong>${fc}</strong></span>
      </div>
      <div class="sub-num" style="text-align:right;margin-top:2px;">Default: ${defFx} ${fc}</div>
    </td>`;
  }).join('');

  let thAdd=`<th><button class="btn-add" id="addCityBtn">+ City</button></th>`;

  // Goal toggle
  const goalHtml=`<div style="margin-bottom:14px;">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <span style="font-size:0.85rem;color:var(--muted);">I want to know:</span>
      <div class="seg-group" id="dtGoalGroup">
        <button class="seg-btn ${S.goal==='save'?'active':''}" data-val="save">My savings</button>
        <button class="seg-btn ${S.goal==='earn'?'active':''}" data-val="earn">Required salary</button>
      </div>
    </div>
    ${S.goal==='earn'?`<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px;">
      <span style="font-size:0.85rem;color:var(--muted);">Target:</span>
      <div class="seg-group" id="dtTargetGroup">
        <button class="seg-btn ${S.savingsTarget==='ratio'?'active':''}" data-val="ratio">Savings ratio</button>
        <button class="seg-btn ${S.savingsTarget==='nominal'?'active':''}" data-val="nominal">Nominal savings</button>
      </div>
    </div>`:''}
  </div>`;

  // Salary row
  let salFrom=`<td><div class="input-wrap"><span class="curr-tag" style="font-size:0.78rem;">${fc}</span><input type="text" inputmode="decimal" class="num-input" id="dt_fs" value="${formatMoneyValue(S.detailFromSalary)||''}" placeholder="0" style="width:110px;"/></div></td>`;
  let salTos=toCities.map((tc,i)=>{
    const curr=tc?tc.currency:'—';
    if(S.goal==='earn'){
      const req=calcReqSal(i,fromCity,tc);
      const why=(req==null&&fromCity&&tc)?` <span class="tip-icon" data-tip="${reqSalNoteDetail(i,fromCity,tc)}">?</span>`:'';
      return`<td class="num-td"><span style="color:var(--positive-em);font-weight:700;">${fmtC(req,curr)}</span><br><span class="sub-num">required${why}</span></td>`;
    }
    return`<td><div class="input-wrap"><span class="curr-tag" style="font-size:0.78rem;">${curr}</span><input type="text" inputmode="decimal" class="num-input dt-to-sal" data-ci="${i}" value="${formatMoneyValue(S.detailToSalaries[i])||''}" placeholder="0" style="width:100px;"/></div></td>`;
  }).join('');

  // Expense rows
  let expRows=S.detailRows.map((row,ri)=>{
    const cat=CATS.find(c=>c.id===row.catId)||CATS[0];
    const fv=row.fromAmount||0;
    let cols=`<td class="cat-td">
      <div style="display:flex;align-items:center;gap:6px;">
        <select class="cat-sel" data-ri="${ri}">${CATS.map(c=>`<option value="${c.id}" ${c.id===row.catId?'selected':''}>${c.label}</option>`).join('')}</select>
        <span class="tip-icon" data-tip="${cat.tip}">?</span>
      </div>
    </td>
    <td><div class="input-wrap"><span class="curr-tag" style="font-size:0.78rem;">${fc}</span><input type="text" inputmode="decimal" class="num-input dt-from-exp" data-ri="${ri}" value="${formatMoneyValue(fv)||''}" placeholder="0" style="width:110px;"/></div></td>`;

    toCities.forEach((tc,ci)=>{
      if(!tc||!fromCity){cols+=`<td class="num-td">—</td>`;return;}
      // Overrides are keyed by destination column only (they already live on the
      // row object), so they survive inserting/removing OTHER expense rows.
      const ovKey=String(ci);
      const isOv=row.overrides&&(ovKey in row.overrides);
      const cfxCi=detailFx(ci,fromCity,tc);
      const calc=calcExp(fv,fromCity,tc,cat.index,cfxCi);   // null = no estimate
      const hasCalc=calc!=null&&isFinite(calc);
      const dispVal=isOv?row.overrides[ovKey]:calc;
      const backToFc=hasCalc?(cfxCi?calc*cfxCi:convertCurr(calc,tc.currency,fc)):null;
      cols+=`<td class="num-td ${isOv?'overridden':''}">
        <div style="display:flex;align-items:center;gap:4px;justify-content:flex-end;">
          <span class="curr-tag" style="font-size:0.73rem;">${tc.currency}</span>
          <input type="text" inputmode="decimal" class="num-input dt-to-exp" data-ri="${ri}" data-ci="${ci}"
            value="${dispVal!=null&&dispVal>0?formatMoneyValue(dispVal):''}"
            placeholder="${hasCalc?(calc>0?Math.round(calc):'0'):'—'}"
            title="Edit to override estimate"
            style="width:90px;${isOv?'background:var(--override-bg);border-color:var(--override-border);':''}"/>
        </div>
        ${isOv?'':(hasCalc
          ?`<div class="sub-num" style="text-align:right;margin-top:2px;">≈ ${fmtC(backToFc,fc)}${renormTip(fromCity,tc,cat)}</div>`
          :`<div class="sub-num" style="text-align:right;margin-top:2px;">no data <span class="tip-icon" data-tip="${noEstimateReason(fromCity,tc,cat)}">?</span></div>`)}
      </td>`;
    });

    cols+=`<td><button class="btn-remove rmv-row-btn" data-ri="${ri}">${S.detailRows.length>1?'✕':''}</button></td>`;
    return`<tr data-ri="${ri}">${cols}</tr>`;
  }).join('');

  // Savings row
  const fTotalExp=S.detailRows.reduce((s,r)=>s+(r.fromAmount||0),0);
  const fSav=(S.detailFromSalary||0)-fTotalExp;
  const fRat=S.detailFromSalary>0?fSav/S.detailFromSalary*100:0;
  let savFrom=`<td class="num-td">
    <div style="color:${fSav>=0?'var(--positive-em)':'var(--negative-em)'};font-weight:700;">${fmtC(fSav,fc)}</div>
    <div class="sub-num">${fmtP(fRat)} ratio</div>
  </td>`;
  let savTos=toCities.map((tc,ci)=>{
    if(!tc)return`<td class="num-td">—</td>`;
    const curr=tc.currency;
    const totExp=destTotalExp(ci,fromCity,tc);
    let toSal=S.goal==='earn'?calcReqSal(ci,fromCity,tc):(S.detailToSalaries[ci]||0);
    const sav=(totExp==null||toSal==null)?null:toSal-totExp;
    const rat=(sav!=null&&toSal>0)?sav/toSal*100:null;
    return`<td class="num-td">
      <div style="color:${sav!=null&&sav<0?'var(--negative-em)':'var(--positive-em)'};font-weight:700;">${fmtC(sav,curr)}</div>
      <div class="sub-num">${rat!=null?fmtP(rat)+' ratio':'—'}</div>
    </td>`;
  }).join('');

  return`
${goalHtml}
<div class="detail-scroll">
  <table class="dt">
    <thead>
      <tr>
        <th>Category</th>
        ${thFrom}
        ${thTos}
        ${thAdd}
      </tr>
    </thead>
    <tbody>
      <tr class="salary-tr">
        <td class="cat-td" style="font-weight:700;">💵 Net Income</td>
        ${salFrom}${salTos}
        <td></td>
      </tr>
      ${anyFx?`<tr class="fx-tr">
        <td class="cat-td">💱 FX Rate (custom)</td>
        ${fxFrom}${fxTos}
        <td></td>
      </tr>`:''}
      ${expRows}
      <tr>
        <td colspan="${3 + toCities.length}" style="padding:6px 8px;border-top:1px dashed var(--border);">
          <button class="btn-add" id="addRowBtn" style="width:100%;">+ Add expense row</button>
        </td>
      </tr>
      <tr class="savings-tr">
        <td class="cat-td">💰 Savings</td>
        ${savFrom}${savTos}
        <td></td>
      </tr>
    </tbody>
  </table>
</div>
<div class="util-note" style="margin-top:8px;">Data in cells with <span style="display:inline-block;padding:1px 6px;background:var(--override-bg);border:1px solid var(--override-border);border-radius:3px;font-size:0.75rem;font-family:'DM Mono',monospace;">yellow background</span> has been manually overridden. Clear the field to revert to the calculated estimate.</div>`;
}

// null = no honest estimate for this cell (missing index or missing FX rate).
function calcExp(fromAmt,fromCity,toCity,indexKey,customRate){
  return convertExpense(fromAmt,fromCity,toCity,indexKey,customRate??null);
}

// Why a cell has no estimate, for the on-demand tooltip.
function noEstimateReason(fromCity,toCity,cat){
  const label=cat.label.replace(/^\S+\s/,'');
  if(getIdx(toCity,cat.index)==null)return`No ${label.toLowerCase()} data for ${toCity.city} in the dataset. Type your own figure to override.`;
  if(getIdx(fromCity,cat.index)==null)return`No ${label.toLowerCase()} data for ${fromCity.city} in the dataset. Type your own figure to override.`;
  if(!getRate(fromCity.currency))return`No exchange rate for ${fromCity.currency}. Type your own figure to override.`;
  if(!getRate(toCity.currency))return`No exchange rate for ${toCity.currency}. Type your own figure to override.`;
  return`No estimate available. Type your own figure to override.`;
}

// Flags a utilities estimate that had to drop a component. Renormalised, never
// filled in with a stand-in index.
function renormTip(fromCity,toCity,cat){
  if(cat.index!=='utilities')return'';
  const miss=[...new Set(idxInfo(fromCity,'utilities').missing.concat(idxInfo(toCity,'utilities').missing))];
  if(!miss.length)return'';
  const kept=UTIL_PARTS.filter(p=>!miss.includes(p[0])).map(p=>p[0]).join(' and ');
  return` <span class="tip-icon" data-tip="No ${miss.join(' or ')} price data for ${miss.some(m=>idxInfo(toCity,'utilities').missing.includes(m))?toCity.city:fromCity.city}. The estimate renormalises the remaining weights over ${kept}.">!</span>`;
}

// Total destination expenses for one column. null when any row cannot be
// estimated, so savings and required salary say "—" instead of quietly
// treating an unknown cost as zero.
function destTotalExp(ci,fromCity,toCity){
  const customFx=detailFx(ci,fromCity,toCity);
  const ovKey=String(ci);
  let tot=0, known=true;
  S.detailRows.forEach(row=>{
    if(row.overrides&&(ovKey in row.overrides)){tot+=row.overrides[ovKey]||0;return;}
    const cat=CATS.find(c=>c.id===row.catId)||CATS[0];
    const v=calcExp(row.fromAmount||0,fromCity,toCity,cat.index,customFx);
    if(v==null||!isFinite(v)){known=false;return;}
    tot+=v;
  });
  return known?tot:null;
}

function reqSalNoteDetail(ci,fromCity,toCity){
  if(destTotalExp(ci,fromCity,toCity)==null)
    return`Some ${toCity.city} costs cannot be estimated, so the total is unknown. Override those cells to get a figure.`;
  if(S.savingsTarget==='ratio')
    return`With no expenses entered your savings ratio is 100% at any salary, so no single salary matches it. Add your expenses, or switch the target to nominal savings.`;
  return`No exchange rate for ${toCity.currency}, so your savings cannot be converted.`;
}

// null = no single required salary (see reqSalNoteDetail).
function calcReqSal(ci,fromCity,toCity){
  if(!fromCity||!toCity)return null;
  const customFx=detailFx(ci,fromCity,toCity);
  const totToExp=destTotalExp(ci,fromCity,toCity);
  if(totToExp==null)return null;
  const totFromExp=S.detailRows.reduce((s,r)=>s+(r.fromAmount||0),0);
  const fSav=(S.detailFromSalary||0)-totFromExp;
  const fRat=S.detailFromSalary>0?fSav/S.detailFromSalary:0;
  if(S.savingsTarget==='ratio'){
    // A 100% source ratio (or zero destination expenses) is matched at ANY
    // salary, so there is no number to quote.
    if(totToExp<=0||fRat>=1)return null;
    return totToExp/(1-fRat);
  }
  const fSavInTo=customFx?fSav/customFx:convertCurr(fSav,fromCity.currency,toCity.currency);
  if(!isFinite(fSavInTo))return null;
  return totToExp+fSavInTo;
}

function wireDetail(fromCity,toCities){
  // From picker — a custom rate is quoted in the FROM currency, so changing that
  // currency invalidates every custom rate. Clear them instead of just hiding
  // the row, or a stale rate keeps dividing into the results unseen.
  buildCityPicker('dtFromPicker',S.detailFromKey,key=>{
    const prevCurr=currOf(getCity(S.detailFromKey));
    S.detailFromKey=key;
    if(currOf(getCity(key))!==prevCurr)S.customFxDetailed=S.detailToCities.map(()=>null);
    pruneCustomFx();
    renderDetailArea();
  });

  // To pickers — a cell override is an amount in the destination currency, so
  // it is cleared when that column changes currency (never relabelled).
  toCities.forEach((_,i)=>{
    const pickerId=`dtToPicker${i}`;
    if(document.getElementById(pickerId)){
      buildCityPicker(pickerId,S.detailToCities[i],key=>{
        const prevCurr=currOf(getCity(S.detailToCities[i]));
        S.detailToCities[i]=key;
        S.customFxDetailed[i]=null;
        if(currOf(getCity(key))!==prevCurr)clearColOverrides(i);
        renderDetailArea();
      });
    }
  });

  // Add city — keep the per-destination arrays the same length as the city list
  // so custom rates and overrides stay keyed to their own column.
  const acBtn=document.getElementById('addCityBtn');
  if(acBtn)acBtn.addEventListener('click',()=>{S.detailToCities.push('');S.detailToSalaries.push(0);S.customFxDetailed.push(null);renderDetailArea();});

  // Remove city
  document.querySelectorAll('.rmv-city-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const ci=+btn.dataset.ci;
      S.detailToCities.splice(ci,1); S.detailToSalaries.splice(ci,1); S.customFxDetailed.splice(ci,1);
      // Overrides are keyed by destination column — drop the removed column and
      // shift the higher columns down one.
      S.detailRows.forEach(r=>{const nb={};Object.entries(r.overrides||{}).forEach(([k,v])=>{const oci=Number(k);if(oci!==ci)nb[String(oci>ci?oci-1:oci)]=v;});r.overrides=nb;});
      renderDetailArea();
    });
  });

  // Add expense row
  const arBtn=document.getElementById('addRowBtn');
  if(arBtn)arBtn.addEventListener('click',()=>{S.detailRows.push({catId:'other',fromAmount:0,overrides:{}});renderDetailArea();});

  // Remove expense row
  document.querySelectorAll('.rmv-row-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const ri=+btn.dataset.ri;
      if(S.detailRows.length>1){S.detailRows.splice(ri,1);renderDetailArea();}
    });
  });

  // Cat selects
  document.querySelectorAll('.cat-sel').forEach(sel=>{
    sel.addEventListener('change',()=>{S.detailRows[+sel.dataset.ri].catId=sel.value;renderDetailArea();});
  });

  // From expense inputs
  document.querySelectorAll('.dt-from-exp').forEach(inp=>{
    inp.addEventListener('input', () => { liveMoney(inp); S.detailRows[+inp.dataset.ri].fromAmount = parseNum(inp.value); });
    inp.addEventListener('blur', e => { formatMoneyInput(e.target); renderDetailArea(); });
  });

  // To expense inputs (override)
  document.querySelectorAll('.dt-to-exp').forEach(inp=>{
    inp.addEventListener('input',()=>{ liveMoney(inp); });
    inp.addEventListener('change',()=>{
      const ri=+inp.dataset.ri, ci=+inp.dataset.ci;
      const key=String(ci);
      if(!S.detailRows[ri].overrides)S.detailRows[ri].overrides={};
      const v=parseNum(inp.value);
      if(inp.value===''||inp.value.replace(/,/g,'').trim()===''){delete S.detailRows[ri].overrides[key];}
      else{S.detailRows[ri].overrides[key]=v;}
      renderDetailArea();
    });
    inp.addEventListener('blur', e => { formatMoneyInput(e.target); });
  });

  // FX rate inputs (per destination)
  document.querySelectorAll('.dt-fx-inp').forEach(inp=>{
    inp.addEventListener('input',()=>{
      const ci=+inp.dataset.ci;
      const raw=String(inp.value).replace(/,/g,'').trim();
      const v=parseFloat(raw);
      S.customFxDetailed[ci]=(isFinite(v)&&v>0)?v:null;
      if(persist)persist.schedule();
    });
    inp.addEventListener('blur',()=>{renderDetailArea();});
  });

  // From salary
  const dtfs=document.getElementById('dt_fs');
  if(dtfs) {
    dtfs.addEventListener('input', () => { liveMoney(dtfs); S.detailFromSalary = parseNum(dtfs.value); });
    dtfs.addEventListener('blur', e => { formatMoneyInput(e.target); renderDetailArea(); });
  }

  // To salaries
  document.querySelectorAll('.dt-to-sal').forEach(inp=>{
    inp.addEventListener('input', () => { liveMoney(inp); S.detailToSalaries[+inp.dataset.ci] = parseNum(inp.value); });
    inp.addEventListener('blur', e => { formatMoneyInput(e.target); renderDetailArea(); });
  });

  // Goal toggle
  const dtGoal=document.getElementById('dtGoalGroup');
  if(dtGoal)dtGoal.querySelectorAll('.seg-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{S.goal=btn.dataset.val;renderDetailArea();});
  });

  // Target toggle (earn mode)
  const dtTarget=document.getElementById('dtTargetGroup');
  if(dtTarget)dtTarget.querySelectorAll('.seg-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{S.savingsTarget=btn.dataset.val;renderDetailArea();});
  });
}

function renderDetailArea(){
  const area=document.getElementById('analysisArea');
  renderDetailed(area);
}

// ═══════════════════════════════════════════════════════════
// GLOBAL TOGGLE WIRING
// ═══════════════════════════════════════════════════════════
function wireGlobalToggles(){
  function wireGroup(groupId, stateKey){
    const grp=document.getElementById(groupId);
    if(!grp)return;
    grp.querySelectorAll('.seg-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        S[stateKey]=btn.dataset.val;
        grp.querySelectorAll('.seg-btn').forEach(b=>b.classList.toggle('active',b===btn));
        render();
      });
    });
  }
  wireGroup('modeGroup','mode');
  wireGroup('goalGroup','goal');
  wireGroup('housingGroup','housing');

  const swapBtn=document.getElementById('swapCities');
  if(swapBtn)swapBtn.addEventListener('click',swapSimpleCities);
}

// ═══════════════════════════════════════════════════════════
// SWAP (simple mode)
// Turns the comparison around: the destination becomes home and home becomes
// the destination. Everything that is tied to a side travels with it — the two
// salaries swap, and the FX inputs are inverted rather than dropped, since both
// are quoted as fromCurr per 1 toCurr and that direction has just flipped.
// The typed monthly expense stays put: it is a figure for the source city and
// has no counterpart on the other side to trade places with.
// ═══════════════════════════════════════════════════════════
function swapSimpleCities(){
  const k=S.fromKey; S.fromKey=S.toKey; S.toKey=k;
  const sal=S.fromSalary; S.fromSalary=S.toSalary; S.toSalary=sal;

  const cfx=Number(S.customFxSimple);
  S.customFxSimple=(isFinite(cfx)&&cfx>0)?1/cfx:null;

  // The shock is a % move in the destination currency's strength, so the same
  // scenario seen from the other side is the reciprocal multiplier.
  const pct=fxShockPct();
  if(pct){
    const inv=(1/(1+pct/100)-1)*100;
    S.fxShock=Math.max(-FX_SHOCK_LIMIT,Math.min(FX_SHOCK_LIMIT,Math.round(inv)));
  }

  buildCityPicker('fromPicker',S.fromKey,key=>{S.fromKey=key;S.customFxSimple=null;render();});
  buildCityPicker('toPicker',S.toKey,key=>{S.toKey=key;S.customFxSimple=null;render();});
  render();
}

// Nothing to swap until at least one side is set.
function syncSwapButton(){
  const btn=document.getElementById('swapCities');
  if(btn)btn.disabled=!(S.fromKey||S.toKey);
}

// ═══════════════════════════════════════════════════════════
// GUIDED-TOUR DEMO DATA
// The guided tour (tour.js) calls these so each step spotlights a
// populated result — a realistic Jakarta → Perth example — instead of
// an empty "select a city" placeholder. Existing user input is left
// untouched; demo values are only filled in when the fields are blank.
// ═══════════════════════════════════════════════════════════
function findCityKey(name, country){
  if(!CITIES.length) return '';
  const lc=name.toLowerCase(), lcc=country?country.toLowerCase():'';
  const m = CITIES.find(c=>c.city.toLowerCase()===lc && c.country.toLowerCase()===lcc)
         || CITIES.find(c=>c.city.toLowerCase()===lc)
         || CITIES.find(c=>c.city.toLowerCase().includes(lc));
  return m ? cityKey(m) : '';
}
function syncModeButtons(){
  document.querySelectorAll('#modeGroup .seg-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.val===S.mode);
  });
}
function seedSimpleDemo(){
  S.mode='simple';
  if(!S.fromKey || !S.toKey){
    S.fromKey=findCityKey('Jakarta','Indonesia');
    S.toKey=findCityKey('Perth','Australia');
    S.fromSalary=20000000; S.fromExpense=12000000; S.toSalary=6500;
    S.customFxSimple=null; S.fxShock=0;
    buildCityPicker('fromPicker',S.fromKey,key=>{S.fromKey=key;S.customFxSimple=null;render();});
    buildCityPicker('toPicker',S.toKey,key=>{S.toKey=key;S.customFxSimple=null;render();});
  }
  syncModeButtons();
  render();
}
function seedDetailedDemo(){
  S.mode='detailed';
  if(!S.detailFromKey || !S.detailToCities.filter(Boolean).length){
    S.detailFromKey=findCityKey('Jakarta','Indonesia');
    S.detailToCities=[findCityKey('Perth','Australia')];
    S.detailFromSalary=20000000;
    S.detailToSalaries=[6500];
    S.detailRows=[
      {catId:'rent',      fromAmount:5000000, overrides:{}},
      {catId:'groceries', fromAmount:2500000, overrides:{}},
      {catId:'eating_out',fromAmount:1500000, overrides:{}},
      {catId:'utilities', fromAmount:1000000, overrides:{}},
    ];
    S.customFxDetailed=[null];
  }
  syncModeButtons();
  render();
}
window.__COL_TOUR = { seedSimple: seedSimpleDemo, seedDetailed: seedDetailedDemo };

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
function init(){
  S.fromKey=''; S.toKey='';
  S.detailFromKey=''; S.detailToCities=[''];

  buildCityPicker('fromPicker',S.fromKey,key=>{S.fromKey=key;S.customFxSimple=null;render();});
  buildCityPicker('toPicker',S.toKey,key=>{S.toKey=key;S.customFxSimple=null;render();});

  wireGlobalToggles();
  render();

  /* ── Mini cache ──────────────────────────────────────────────────────────
     The whole comparison lives in the JS state object S (selected cities,
     mode/goal/housing, salaries, custom FX and cost overrides), so persist S
     and rebuild the UI from it on revisit. */
  persist = Persist.init('costofliving-comparator', {
    onRestore: function(){
      ['mode','goal','housing'].forEach(function(key){
        var grp=document.getElementById(key+'Group');
        if(grp) grp.querySelectorAll('.seg-btn').forEach(function(b){ b.classList.toggle('active', b.dataset.val===S[key]); });
      });
      buildCityPicker('fromPicker',S.fromKey,key=>{S.fromKey=key;S.customFxSimple=null;render();});
      buildCityPicker('toPicker',S.toKey,key=>{S.toKey=key;S.customFxSimple=null;render();});
      render();
    },
    extra: {
      save: function(){ return S; },
      restore: function(e){ if(e && typeof e==='object') Object.assign(S, e); }
    }
  });
}

loadData();
})();
