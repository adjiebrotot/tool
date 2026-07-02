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
  // Detailed
  detailFromKey: '', detailToCities: [], detailToSalaries: [],
  detailFromSalary: 0,
  detailRows: [{catId:'rent', fromAmount:0, overrides:{}}],
  customFxDetailed: [],      // per-destination: null = use DB; number = fromCurr per 1 destCurr
};

// ═══════════════════════════════════════════════════════════
// FORMATTERS
// ═══════════════════════════════════════════════════════════
function fmtN(v,d=0){
  if(!isFinite(v)||v===null)return'—';
  return Number(v).toLocaleString('en-AU',{minimumFractionDigits:d,maximumFractionDigits:d});
}
function fmtC(v,curr,compact=false){
  if(!isFinite(v)||v===null)return'—';
  const n=Number(v), abs=Math.abs(n), sign=n<0?'-':'';
  if(compact&&abs>=1e9)return sign+curr+' '+(abs/1e9).toFixed(1)+'B';
  if(compact&&abs>=1e6)return sign+curr+' '+(abs/1e6).toFixed(1)+'M';
  return sign+curr+' '+fmtN(abs);
}
function fmtP(v,d=1){return isFinite(v)?v.toFixed(d)+'%':'—';}
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
function formatMoneyValue(val) {
  const n = parseNum(val);
  if(!isFinite(n)) return '';
  return n.toLocaleString('en-AU', {minimumFractionDigits:0, maximumFractionDigits:0});
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
function cityLabel(c){return c.city+', '+c.country;}
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

// Convert expense from one city to another
// customRate: fromCurr per toCurr (null = use DB)
function convertExpense(amount, fromCity, toCity, indexKey, customRate){
  if(!amount||!fromCity||!toCity)return 0;
  const fi=getIdx(fromCity,indexKey), ti=getIdx(toCity,indexKey);
  if(!fi||!ti)return 0;
  if(customRate!=null&&customRate>0){
    return amount/customRate*(ti/fi);
  }
  const fr=getRate(fromCity.currency), tr=getRate(toCity.currency);
  if(!fr||!tr)return 0;
  return amount/fr*(ti/fi)*tr;
}

function convertCurr(amount,fromCurr,toCurr){
  const fr=getRate(fromCurr), tr=getRate(toCurr);
  if(!fr||!tr)return NaN; // unknown rate → let the display fall back to "—"
  return amount/fr*tr;
}

function getIdx(city, key){
  if(key==='rent')return city.rent_index_med||100;
  if(key==='groceries')return city.groceries_index||100;
  if(key==='eating_out')return city.eating_out_index||100;
  if(key==='utilities')return 0.5*(city.elec||100)+0.2*(city.water||100)+0.3*(city.gas||100);
  if(key==='electricity')return city.elec||100;
  if(key==='water')return city.water||100;
  if(key==='gas_util')return city.gas||100;
  if(key==='fuel')return city.fuel||100;
  if(key==='coli_no_housing')return city.coli_no_housing||100;
  if(key==='coli_with_housing')return city.coli_with_housing||100;
  if(key==='currency_only')return 100;
  return 100;
}

function coliKey(){return S.housing==='include'?'coli_with_housing':'coli_no_housing';}

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
  // Housing row visibility
  document.getElementById('housingRow').style.display=S.mode==='simple'?'flex':'none';
  document.getElementById('simpleCityCard').style.display=S.mode==='simple'?'flex':'none';

  const area=document.getElementById('analysisArea');
  if(S.mode==='simple'){
    const from=getCity(S.fromKey), to=getCity(S.toKey);
    renderSimpleFxSection(from,to);
    if(!from||!to){
      area.innerHTML=`<div class="card placeholder"><div class="icon">🗺️</div><div>Select a <strong>From</strong> and <strong>To</strong> city above to begin your analysis.</div></div>`;
      return;
    }
    S.goal==='save'?renderSimpleSave(area,from,to):renderSimpleEarn(area,from,to);
  } else {
    const fxCard=document.getElementById('simpleFxCard');
    if(fxCard)fxCard.style.display='none';
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
    </div>`;
  const inp=document.getElementById('simpleFxInput');
  if(inp){
    inp.addEventListener('input',()=>{
      const raw=String(inp.value).replace(/,/g,'').trim();
      const v=parseFloat(raw);
      S.customFxSimple=(isFinite(v)&&v>0)?v:null;
    });
    inp.addEventListener('blur',()=>{render();});
  }
}

// ═══════════════════════════════════════════════════════════
// SIMPLE – I CAN SAVE
// ═══════════════════════════════════════════════════════════
function renderSimpleSave(area,from,to){
  const fc=from.currency, tc=to.currency;
  const fr=getRate(fc), tr=getRate(tc);
  const fs=S.fromSalary||0, fe=S.fromExpense||0, ts=S.toSalary||0;
  const ck=coliKey();
  const fi=from[ck]||100, ti=to[ck]||100;
  // Custom FX: S.customFxSimple = fromCurr per 1 toCurr (e.g. IDR per AUD).
  // With no custom rate and a missing DB rate the multipliers are NaN so the
  // estimates render as "—" rather than a wrong 1:1 conversion.
  const cfx=S.customFxSimple;
  const fromToMult=cfx&&cfx>0?(1/cfx):(fr&&tr?tr/fr:NaN);  // FC→TC multiplier
  const toFromMult=cfx&&cfx>0?cfx:(fr&&tr?fr/tr:NaN);        // TC→FC multiplier
  const te=fe?fe*fromToMult*(ti/fi):0;
  const fSav=fs-fe, tSav=ts-te;
  const fRatio=fs>0?fSav/fs*100:0, tRatio=ts>0?tSav/ts*100:0;

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
        <div class="input-wrap"><span class="curr-tag">${fc}</span><input type="text" inputmode="numeric" class="num-input" id="ss_fs" value="${formatMoneyValue(fs)||''}" placeholder="0"/></div>
        ${cc(fs,fc,tc)}
      </div>
      <div class="field-row">
        <div class="field-label">Monthly Expenses</div>
        <div class="input-wrap"><span class="curr-tag">${fc}</span><input type="text" inputmode="numeric" class="num-input" id="ss_fe" value="${formatMoneyValue(fe)||''}" placeholder="0"/></div>
        ${cc(fe,fc,tc)}
      </div>
      <div class="field-row">
        <div class="field-label">Monthly Savings</div>
        <div class="sav-block ${fSav>=0?'positive':'negative'}">
          <div class="sav-val">${fmtC(fSav,fc)}</div>
          ${cc(fSav,fc,tc)}
          <div class="sav-ratio">${fmtP(fRatio)} savings ratio</div>
        </div>
      </div>
    </div>
    <div class="col-card">
      <div class="col-header">🏁 ${to.city}, ${to.country}</div>
      <div class="col-sub">${tc}</div>
      <div class="field-row">
        <div class="field-label">Net Monthly Salary</div>
        <div class="input-wrap"><span class="curr-tag">${tc}</span><input type="text" inputmode="numeric" class="num-input" id="ss_ts" value="${formatMoneyValue(ts)||''}" placeholder="0"/></div>
        ${cc(ts,tc,fc)}
      </div>
      <div class="field-row">
        <div class="field-label">
          Est. Monthly Expenses
          <span class="tip-icon" data-tip="Estimated using ${S.housing==='include'?'full cost-of-living':'non-housing cost-of-living'} index ratio between cities. Data updated ${META_COL}.">?</span>
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
          <div class="sav-ratio">${fmtP(tRatio)} savings ratio</div>
        </div>
      </div>
    </div>
  </div>
  <div class="summary-box" id="ss_summary">${buildSaveSummary(from,to,fc,tc,fromToMult,toFromMult,fSav,tSav,fRatio,tRatio)}</div>
</section>`;

  const fsEl = document.getElementById('ss_fs');
  if(fsEl) {
    fsEl.addEventListener('input', e => { SharedFmt.liveFormat(e.target,{maxDecimals:0}); S.fromSalary = parseNum(e.target.value); });
    fsEl.addEventListener('blur', e => { formatMoneyInput(e.target); render(); });
  }
  const feEl = document.getElementById('ss_fe');
  if(feEl) {
    feEl.addEventListener('input', e => { SharedFmt.liveFormat(e.target,{maxDecimals:0}); S.fromExpense = parseNum(e.target.value); });
    feEl.addEventListener('blur', e => { formatMoneyInput(e.target); render(); });
  }
  const tsEl = document.getElementById('ss_ts');
  if(tsEl) {
    tsEl.addEventListener('input', e => { SharedFmt.liveFormat(e.target,{maxDecimals:0}); S.toSalary = parseNum(e.target.value); });
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
  return `${nomTxt}, ${ratTxt}.`;
}

// ═══════════════════════════════════════════════════════════
// SIMPLE – I NEED TO EARN
// ═══════════════════════════════════════════════════════════
function renderSimpleEarn(area,from,to){
  const fc=from.currency, tc=to.currency;
  const fr=getRate(fc), tr=getRate(tc);
  const fs=S.fromSalary||0, fe=S.fromExpense||0;
  const ck=coliKey();
  const fi=from[ck]||100, ti=to[ck]||100;
  const cfx=S.customFxSimple;
  const fromToMult=cfx&&cfx>0?(1/cfx):(fr&&tr?tr/fr:NaN);
  const toFromMult=cfx&&cfx>0?cfx:(fr&&tr?fr/tr:NaN);
  const fSav=fs-fe, fRatio=fs>0?fSav/fs:0;
  const te=fe?fe*fromToMult*(ti/fi):0;

  let toReq=0,toSav=0,toRatio=0;
  if(S.savingsTarget==='ratio'){
    if(fRatio<1)toReq=te/(1-fRatio); else toReq=te*2;
    toSav=toReq-te; toRatio=toReq>0?toSav/toReq*100:0;
  } else {
    const fSavInTo=fSav*fromToMult;
    toReq=te+fSavInTo; toSav=toReq-te; toRatio=toReq>0?toSav/toReq*100:0;
  }

  const xc=(a,c1,c2)=>{if(c1===c2)return a;return(c1===fc)?a*fromToMult:a*toFromMult;};
  const cc=(a,c1,c2)=>c1!==c2?`<div class="field-approx">≈ ${fmtC(xc(a,c1,c2),c2)}</div>`:'';
  const fRatPct=fRatio*100;

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
        <div class="input-wrap"><span class="curr-tag">${fc}</span><input type="text" inputmode="numeric" class="num-input" id="se_fs" value="${formatMoneyValue(fs)||''}" placeholder="0"/></div>
        ${cc(fs,fc,tc)}
      </div>
      <div class="field-row">
        <div class="field-label">Monthly Expenses</div>
        <div class="input-wrap"><span class="curr-tag">${fc}</span><input type="text" inputmode="numeric" class="num-input" id="se_fe" value="${formatMoneyValue(fe)||''}" placeholder="0"/></div>
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
        <div class="field-label">Required Net Salary</div>
        <div class="sav-block positive">
          <div class="req-val">${fmtC(toReq,tc)}</div>
          ${cc(toReq,tc,fc)}
        </div>
      </div>
      <div class="field-row">
        <div class="field-label">
          Est. Monthly Expenses
          <span class="tip-icon" data-tip="Estimated using ${S.housing==='include'?'full cost-of-living':'non-housing cost-of-living'} index ratio. Data updated ${META_COL}.">?</span>
        </div>
        <div class="sav-block neutral">
          <div class="sav-val mono">${fmtC(te,tc)}</div>
          ${cc(te,tc,fc)}
        </div>
      </div>
      <div class="field-row">
        <div class="field-label">Monthly Savings</div>
        <div class="sav-block ${toSav>=0?'positive':'negative'}">
          <div class="sav-val">${fmtC(toSav,tc)}</div>
          ${cc(toSav,tc,fc)}
          <div class="sav-ratio">${fmtP(toRatio)} savings ratio</div>
        </div>
      </div>
    </div>
  </div>
  <div class="summary-box">${buildEarnSummary(from,to,fc,tc,fr,tr,toReq,fSav,fRatPct,toRatio)}</div>
</section>`;

  const sefsEl = document.getElementById('se_fs');
  if(sefsEl) {
    sefsEl.addEventListener('input', e => { SharedFmt.liveFormat(e.target,{maxDecimals:0}); S.fromSalary = parseNum(e.target.value); });
    sefsEl.addEventListener('blur', e => { formatMoneyInput(e.target); render(); });
  }
  const sefeEl = document.getElementById('se_fe');
  if(sefeEl) {
    sefeEl.addEventListener('input', e => { SharedFmt.liveFormat(e.target,{maxDecimals:0}); S.fromExpense = parseNum(e.target.value); });
    sefeEl.addEventListener('blur', e => { formatMoneyInput(e.target); render(); });
  }
  document.getElementById('targetGroup').querySelectorAll('.seg-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{S.savingsTarget=btn.dataset.val;render();});
  });
}

function buildEarnSummary(from,to,fc,tc,fr,tr,toReq,fSav,fRatPct,toRatio){
  if(!S.fromSalary)return'Enter your current salary and expenses to calculate what you need to earn in '+to.city+'.';
  const cfx=S.customFxSimple;
  const fromToMult=cfx&&cfx>0?(1/cfx):(fr&&tr?tr/fr:NaN);
  const toFromMult=cfx&&cfx>0?cfx:(fr&&tr?fr/tr:NaN);
  const cross=fc!==tc?' (≈ '+fmtC(toReq*toFromMult,fc)+')':'';
  if(S.savingsTarget==='ratio'){
    return`To maintain the same <strong>${fmtP(fRatPct)}</strong> savings ratio in <strong>${to.city}</strong>, you need a net monthly salary of <strong>${fmtC(toReq,tc)}</strong>${cross}.`;
  } else {
    const fSavInTo=fSav*fromToMult;
    const cross2=fc!==tc?' (≈ '+fmtC(fSav,fc)+')':'';
    return`To maintain the same nominal savings of <strong>${fmtC(fSavInTo,tc)}</strong>${cross2} in <strong>${to.city}</strong>, you need a net monthly salary of <strong>${fmtC(toReq,tc)}</strong>${cross}.`;
  }
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
    const curCustomFx=S.customFxDetailed[i]??null;
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
  let salFrom=`<td><div class="input-wrap"><span class="curr-tag" style="font-size:0.78rem;">${fc}</span><input type="text" inputmode="numeric" class="num-input" id="dt_fs" value="${formatMoneyValue(S.detailFromSalary)||''}" placeholder="0" style="width:110px;"/></div></td>`;
  let salTos=toCities.map((tc,i)=>{
    const curr=tc?tc.currency:'—';
    if(S.goal==='earn'){
      const req=calcReqSal(i,fromCity,tc);
      return`<td class="num-td"><span style="color:var(--positive-em);font-weight:700;">${fmtC(req,curr)}</span><br><span class="sub-num">required</span></td>`;
    }
    return`<td><div class="input-wrap"><span class="curr-tag" style="font-size:0.78rem;">${curr}</span><input type="text" inputmode="numeric" class="num-input dt-to-sal" data-ci="${i}" value="${formatMoneyValue(S.detailToSalaries[i])||''}" placeholder="0" style="width:100px;"/></div></td>`;
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
    <td><div class="input-wrap"><span class="curr-tag" style="font-size:0.78rem;">${fc}</span><input type="text" inputmode="numeric" class="num-input dt-from-exp" data-ri="${ri}" value="${formatMoneyValue(fv)||''}" placeholder="0" style="width:110px;"/></div></td>`;

    toCities.forEach((tc,ci)=>{
      if(!tc||!fromCity){cols+=`<td class="num-td">—</td>`;return;}
      // Overrides are keyed by destination column only (they already live on the
      // row object), so they survive inserting/removing OTHER expense rows.
      const ovKey=String(ci);
      const isOv=row.overrides&&(ovKey in row.overrides);
      const cfxCi=S.customFxDetailed[ci]??null;
      const calc=calcExp(fv,fromCity,tc,cat.index,cfxCi);
      const dispVal=isOv?row.overrides[ovKey]:calc;
      const backToFc=cfxCi&&cfxCi>0?calc*cfxCi:convertCurr(calc,tc.currency,fc);
      cols+=`<td class="num-td ${isOv?'overridden':''}">
        <div style="display:flex;align-items:center;gap:4px;justify-content:flex-end;">
          <span class="curr-tag" style="font-size:0.73rem;">${tc.currency}</span>
          <input type="text" inputmode="numeric" class="num-input dt-to-exp" data-ri="${ri}" data-ci="${ci}"
            value="${dispVal>0?formatMoneyValue(dispVal):''}"
            placeholder="${calc>0?Math.round(calc):'0'}"
            title="Edit to override estimate"
            style="width:90px;${isOv?'background:var(--override-bg);border-color:var(--override-border);':''}"/>
        </div>
        ${!isOv&&fromCity&&tc?`<div class="sub-num" style="text-align:right;margin-top:2px;">≈ ${fmtC(backToFc,fc)}</div>`:''}
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
    const customFx=S.customFxDetailed[ci]??null;
    const totExp=S.detailRows.reduce((s,row,ri)=>{
      const ovKey=String(ci);
      if(row.overrides&&(ovKey in row.overrides))return s+(row.overrides[ovKey]||0);
      const cat=CATS.find(c=>c.id===row.catId)||CATS[0];
      return s+calcExp(row.fromAmount||0,fromCity,tc,cat.index,customFx);
    },0);
    let toSal=S.detailToSalaries[ci]||0;
    if(S.goal==='earn')toSal=calcReqSal(ci,fromCity,tc);
    const sav=toSal-totExp;
    const rat=toSal>0?sav/toSal*100:0;
    return`<td class="num-td">
      <div style="color:${sav>=0?'var(--positive-em)':'var(--negative-em)'};font-weight:700;">${fmtC(sav,curr)}</div>
      <div class="sub-num">${fmtP(rat)} ratio</div>
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

function calcExp(fromAmt,fromCity,toCity,indexKey,customRate){
  if(!fromAmt||!fromCity||!toCity)return 0;
  return convertExpense(fromAmt,fromCity,toCity,indexKey,customRate??null);
}

function calcReqSal(ci,fromCity,toCity){
  if(!fromCity||!toCity)return 0;
  const customFx=S.customFxDetailed[ci]??null;
  const totToExp=S.detailRows.reduce((s,row,ri)=>{
    const ovKey=String(ci);
    if(row.overrides&&(ovKey in row.overrides))return s+(row.overrides[ovKey]||0);
    const cat=CATS.find(c=>c.id===row.catId)||CATS[0];
    return s+calcExp(row.fromAmount||0,fromCity,toCity,cat.index,customFx);
  },0);
  const totFromExp=S.detailRows.reduce((s,r)=>s+(r.fromAmount||0),0);
  const fSav=(S.detailFromSalary||0)-totFromExp;
  const fRat=S.detailFromSalary>0?fSav/S.detailFromSalary:0;
  if(S.savingsTarget==='ratio'){
    return fRat<1?totToExp/(1-fRat):totToExp*2;
  } else {
    const fr=getRate(fromCity.currency), tr=getRate(toCity.currency);
    const fSavInTo=customFx&&customFx>0 ? fSav/customFx : (fr&&tr?fSav/fr*tr:0);
    return totToExp+fSavInTo;
  }
}

function wireDetail(fromCity,toCities){
  // From picker
  buildCityPicker('dtFromPicker',S.detailFromKey,key=>{S.detailFromKey=key;renderDetailArea();});

  // To pickers
  toCities.forEach((_,i)=>{
    const pickerId=`dtToPicker${i}`;
    if(document.getElementById(pickerId)){
      buildCityPicker(pickerId,S.detailToCities[i],key=>{S.detailToCities[i]=key;S.customFxDetailed[i]=null;renderDetailArea();});
    }
  });

  // Add city
  const acBtn=document.getElementById('addCityBtn');
  if(acBtn)acBtn.addEventListener('click',()=>{S.detailToCities.push('');S.detailToSalaries.push(0);renderDetailArea();});

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
    inp.addEventListener('input', () => { SharedFmt.liveFormat(inp,{maxDecimals:0}); S.detailRows[+inp.dataset.ri].fromAmount = parseNum(inp.value); });
    inp.addEventListener('blur', e => { formatMoneyInput(e.target); renderDetailArea(); });
  });

  // To expense inputs (override)
  document.querySelectorAll('.dt-to-exp').forEach(inp=>{
    inp.addEventListener('input',()=>{ SharedFmt.liveFormat(inp,{maxDecimals:0}); });
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
    });
    inp.addEventListener('blur',()=>{renderDetailArea();});
  });

  // From salary
  const dtfs=document.getElementById('dt_fs');
  if(dtfs) {
    dtfs.addEventListener('input', () => { SharedFmt.liveFormat(dtfs,{maxDecimals:0}); S.detailFromSalary = parseNum(dtfs.value); });
    dtfs.addEventListener('blur', e => { formatMoneyInput(e.target); renderDetailArea(); });
  }

  // To salaries
  document.querySelectorAll('.dt-to-sal').forEach(inp=>{
    inp.addEventListener('input', () => { SharedFmt.liveFormat(inp,{maxDecimals:0}); S.detailToSalaries[+inp.dataset.ci] = parseNum(inp.value); });
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
}

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
}

loadData();
})();
