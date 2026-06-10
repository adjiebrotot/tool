(function(){
// Watermark logo (logos/logo.svg), preloaded for use in canvas/SVG/chart exports
const WM_LOGO_SRC = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDY4MCA2ODAiIHJvbGU9ImltZyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8dGl0bGU+QXJjaGVkIEEgTG9nbzwvdGl0bGU+CiAgPGRlc2M+QSBzbGVlayB3aGl0ZSBsZXR0ZXIgQSB3aG9zZSBsZWdzIGZvbGxvdyB0aGUgY2lyY2xlIGN1cnZhdHVyZSwgc3Bhbm5pbmcgODAlIG9mIHRoZSBjaXJjbGUgaGVpZ2h0PC9kZXNjPgoKICA8Y2lyY2xlIGN4PSIzNDAiIGN5PSIzNDAiIHI9IjMwMCIgZmlsbD0iIzAwNTJjYyIvPgoKICA8IS0tIExlZnQgbGVnOiAxMTPCsCB0byAyNDXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyNDIsNTcwIEEgMjUwLDI1MCAwIDAgMSAyMzQsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFRvcCBhcmNoOiAyNDXCsCB0byAyOTXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyMzQsMTEzIEEgMjUwLDI1MCAwIDAgMSA0NDYsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFJpZ2h0IGxlZzogMjk1wrAgdG8gNjfCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSA0NDYsMTEzIEEgMjUwLDI1MCAwIDAgMSA0MzgsNTcwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIENyb3NzYmFyIC0tPgogIDxsaW5lIHgxPSIxMTMiIHkxPSIzNTQiIHgyPSI1NjciIHkyPSIzNTQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNDIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K';
const wmLogoImg = new Image();
wmLogoImg.src = WM_LOGO_SRC;
const _wmMeasureCtx = document.createElement('canvas').getContext('2d');
function measureWmText(text, font){ _wmMeasureCtx.font = font; return _wmMeasureCtx.measureText(text).width; }
function wmPlotlyImage(){
  return { source: WM_LOGO_SRC, xref:'paper', yref:'paper', x:1, y:0.07, xanchor:'right', yanchor:'bottom',
    sizex:0.035, sizey:0.05, sizing:'contain', opacity:0.22, layer:'above' };
}
const $=id=>document.getElementById(id);
const SCENARIO_COLORS=['--line-a','--line-b','--line-c','--line-d','--line-e','--line-f'];
function cssVar(n){return getComputedStyle(document.body).getPropertyValue(n).trim();}
let currentCurrencySymbol='$';

function moneySymbol(){return currentCurrencySymbol||'$';}
function moneyWithSymbol(n,{minimumFractionDigits=0,maximumFractionDigits=0}={}){
  const abs=Math.abs(Number(n||0));
  const formatted=abs.toLocaleString('en-US',{minimumFractionDigits,maximumFractionDigits});
  return moneySymbol()+formatted;
}

const fmt={
  currency(v,compact=false){
    const n=Number(v||0),abs=Math.abs(n),sign=n<0?'−':'';
    if(compact&&abs>=1e9)return sign+moneySymbol()+(abs/1e9).toFixed(2)+'b';
    if(compact&&abs>=1e6)return sign+moneySymbol()+(abs/1e6).toFixed(2)+'m';
    if(compact&&abs>=1e3)return sign+moneySymbol()+(abs/1e3).toFixed(0)+'k';
    return sign+moneyWithSymbol(abs,{maximumFractionDigits:0});
  },
  currencyExact(v){const n=Number(v||0);return(n<0?'−':'')+moneyWithSymbol(Math.abs(n),{minimumFractionDigits:2,maximumFractionDigits:2});},
  pct(v,d=2){const n=Number(v||0);const p=Math.abs(n)<=1?n*100:n;return p.toFixed(d)+'%';},
  num(v,d=0){return Number(v||0).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});},
  fmtInput(v){const n=parseFloat(String(v).replace(/,/g,''));if(isNaN(n))return'0';if(n===Math.floor(n))return Math.floor(n).toLocaleString('en-US');return n.toLocaleString('en-US',{maximumFractionDigits:2});}
};

/* Auto-format number inputs */
function parseNumInput(el){return parseFloat(String(el.value).replace(/,/g,''))||0;}
function setupFmtInputs(){
  document.querySelectorAll('.fmt-num').forEach(el=>{
    el.addEventListener('focus',()=>{const raw=parseFloat(String(el.value).replace(/,/g,''));if(!isNaN(raw))el.value=raw;});
    el.addEventListener('blur',()=>{const raw=parseFloat(String(el.value).replace(/,/g,''));el.value=(!isNaN(raw)&&raw>0)?fmt.fmtInput(raw):'0';rerender();});
    el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.target.blur();}});
  });
}

let scenarios=[], editingIdx=-1, activeAmortIdx=0, sensMode='2d';
let baseRiskFreeRate=4.5; // global risk-free rate from Base tab

function periodsPerYear(f){return{weekly:52,fortnightly:26,monthly:12,yearly:1}[f]||12;}
function freqLabel(f){return{weekly:'week',fortnightly:'fortnight',monthly:'month',yearly:'year'}[f]||'period';}
function termUnitLabel(f){return{weekly:'weeks',fortnightly:'weeks',monthly:'months',yearly:'years'}[f]||'periods';}
function termToYears(termPeriods,f){return termPeriods/periodsPerYear(f);}

// Default term in periods based on freq (5 years in each unit)
function defaultTerm(freq){return{weekly:260,fortnightly:130,monthly:60,yearly:5}[freq]||60;}

function defaultScenario(name,rate){
  const freq='monthly';
  return{name:name||'Scenario '+(scenarios.length+1),financeRate:rate||5,downPaymentPct:0,termPeriods:defaultTerm(freq),freq,feeAmt:0,feeType:'fixed'};
}

/*
 ══════════════════════════════════════════════════════════
 FINANCIAL ENGINE — VERIFIED MATHEMATICS
 ══════════════════════════════════════════════════════════

 1. PERIOD RATE (compound conversion — NOT simple r/n):
    r_period = (1 + r_annual)^(1/ppy) − 1

 2. AMORTIZATION PAYMENT (standard annuity formula):
    If r > 0:  PMT = P × r(1+r)^n / ((1+r)^n − 1)
    If r = 0:  PMT = P / n
    where P=principal, r=period rate, n=total periods

 3. EACH PERIOD:
    interest_i  = balance_i × r_period
    principal_i = PMT − interest_i
    balance_{i+1} = balance_i − principal_i

 4. INVESTMENT GROWTH (financing path):
    Start with: availableCash − downPayment − originationFee
    Each period: investBal = investBal × (1 + rf_period) − PMT
    rf_period = (1 + rf_annual)^(1/ppy) − 1

 5. CASH PURCHASE BASELINE:
    leftover = availableCash − purchaseCost
    endWealth = leftover × (1 + rf_annual)^termYears

 6. NET BENEFIT = financing_endWealth − cash_endWealth
    Positive ⟹ financing preserves more wealth

 7. INFLATION: real = nominal / (1 + inflation)^years
 ══════════════════════════════════════════════════════════
*/

function computeAmortization(principal, annualRate, termPeriods, freq){
  const ppy=periodsPerYear(freq);
  const n=Math.round(termPeriods);
  const r=Math.pow(1+annualRate/100, 1/ppy)-1; // compound period rate

  if(principal<=0||n<=0) return{payment:0,schedule:[],totalInterest:0,totalPaid:0,periods:0,periodRate:0};

  let pmt;
  if(r===0) pmt=principal/n;
  else{
    const factor=Math.pow(1+r,n);
    pmt=principal*(r*factor)/(factor-1); // standard annuity formula
  }

  let bal=principal, totalInt=0;
  const schedule=[];
  for(let i=1;i<=n;i++){
    const intPart=bal*r;
    let prinPart=pmt-intPart;
    // Final payment: clear exact remaining balance
    if(i===n){prinPart=bal; const finalPmt=intPart+bal; schedule.push({num:i,startBal:bal,interest:intPart,principal:prinPart,payment:finalPmt,endBal:0}); totalInt+=intPart; bal=0;}
    else{if(prinPart>bal)prinPart=bal; const endBal=Math.max(0,bal-prinPart); schedule.push({num:i,startBal:bal,interest:intPart,principal:prinPart,payment:pmt,endBal}); totalInt+=intPart; bal=endBal;}
  }
  const totalPaid=schedule.reduce((s,p)=>s+p.payment,0);
  return{payment:pmt,schedule,totalInterest:totalInt,totalPaid,periods:n,periodRate:r};
}

function computeScenario(sc, purchaseCost, availableCash, riskFreeRate, inflationRate, inflationEnabled){
  const downPct=Math.min(100,Math.max(0,sc.downPaymentPct||0));
  const requestedDown=purchaseCost*(downPct/100);
  const down=Math.min(requestedDown,purchaseCost,availableCash);
  const financed=purchaseCost-down;
  const termYears=termToYears(sc.termPeriods,sc.freq);
  if(financed<=0) return computeScenarioAsCash(purchaseCost,availableCash,sc,riskFreeRate,inflationRate,inflationEnabled);

  const ppy=periodsPerYear(sc.freq);
  const n=Math.round(sc.termPeriods);
  let fee=sc.feeType==='pct'?financed*(sc.feeAmt/100):Math.max(0,sc.feeAmt);
  const cashAfterUpfront=availableCash-down-fee;
  if(cashAfterUpfront<0) return null;

  const amort=computeAmortization(financed,sc.financeRate,sc.termPeriods,sc.freq);
  const rfPeriod=Math.pow(1+riskFreeRate/100,1/ppy)-1;
  let investBal=cashAfterUpfront;
  const timeline=[{period:0,investBal:cashAfterUpfront,loanBal:financed,wealth:cashAfterUpfront-financed,cumInterest:0,cumPaid:0}];
  let cumInt=0,cumPaid=0;

  for(let i=0;i<n;i++){
    investBal=investBal*(1+rfPeriod); // grow first
    const pmt=amort.schedule[i]?amort.schedule[i].payment:amort.payment;
    investBal-=pmt; // then pay
    cumInt+=(amort.schedule[i]?amort.schedule[i].interest:0);
    cumPaid+=pmt;
    const loanBal=amort.schedule[i]?amort.schedule[i].endBal:0;
    timeline.push({period:i+1,investBal,loanBal,wealth:investBal-loanBal,cumInterest:cumInt,cumPaid});
  }

  const endWealth=investBal;
  const totalFinanceCost=amort.totalInterest+fee;
  const totalOOP=down+fee+amort.totalPaid;
  let inflAdj=null;
  if(inflationEnabled&&inflationRate>0){
    const rd=Math.pow(1+inflationRate/100,termYears);
    inflAdj={endWealthReal:endWealth/rd,totalFinanceCostReal:totalFinanceCost/rd};
  }
  return{down,financed,fee,amort,endWealth,totalInterest:amort.totalInterest,totalFee:fee,totalFinanceCost,payment:amort.payment,totalOOP,timeline,negCarry:riskFreeRate<sc.financeRate,inflAdj,cashAfter:cashAfterUpfront,n,ppy,termYears,termPeriods:sc.termPeriods,riskFreeRate,financeRate:sc.financeRate,freq:sc.freq};
}

function computeScenarioAsCash(purchaseCost,availableCash,sc,riskFreeRate,inflationRate,inflationEnabled){
  const leftover=Math.max(0,availableCash-purchaseCost);
  const ppy=periodsPerYear(sc.freq);
  const n=Math.round(sc.termPeriods);
  const termYears=termToYears(sc.termPeriods,sc.freq);
  const rfP=Math.pow(1+riskFreeRate/100,1/ppy)-1;
  let bal=leftover;
  const timeline=[{period:0,investBal:leftover,loanBal:0,wealth:leftover,cumInterest:0,cumPaid:0}];
  for(let i=0;i<n;i++){bal*=(1+rfP);timeline.push({period:i+1,investBal:bal,loanBal:0,wealth:bal,cumInterest:0,cumPaid:0});}
  let inflAdj=null;
  if(inflationEnabled&&inflationRate>0) inflAdj={endWealthReal:bal/Math.pow(1+inflationRate/100,termYears)};
  return{down:purchaseCost,financed:0,fee:0,amort:{payment:0,schedule:[],totalInterest:0,totalPaid:0,periods:0,periodRate:0},endWealth:bal,totalInterest:0,totalFee:0,totalFinanceCost:0,payment:0,totalOOP:purchaseCost,timeline,negCarry:false,inflAdj,cashAfter:leftover,n,ppy,termYears,termPeriods:sc.termPeriods,riskFreeRate,financeRate:sc.financeRate,freq:sc.freq};
}

function computeCashBaseline(purchaseCost,availableCash,termYears,riskFreeRate,inflationRate,inflationEnabled){
  const leftover=Math.max(0,availableCash-purchaseCost);
  const endWealth=leftover*Math.pow(1+riskFreeRate/100,termYears);
  let inflAdj=null;
  if(inflationEnabled&&inflationRate>0) inflAdj={endWealthReal:endWealth/Math.pow(1+inflationRate/100,termYears)};
  return{endWealth,investedCash:leftover,inflAdj};
}

function quickNetBenefit(sc,purchaseCost,availableCash,riskFreeRate,inflationRate,inflationEnabled,objective){
  const res=computeScenario(sc,purchaseCost,availableCash,riskFreeRate,inflationRate,inflationEnabled);
  if(!res)return null;
  const cb=computeCashBaseline(purchaseCost,availableCash,res.termYears,riskFreeRate,inflationRate,inflationEnabled);
  const nb=res.endWealth-cb.endWealth;
  if(objective==='netBenefit')return nb;
  if(objective==='totalInterest')return res.totalInterest;
  if(objective==='totalFinanceCost')return res.totalFinanceCost;
  if(objective==='endWealth')return res.endWealth;
  if(objective==='inflAdjNetBenefit'){if(!res.inflAdj||!cb.inflAdj)return nb;return(res.inflAdj.endWealthReal||0)-(cb.inflAdj.endWealthReal||0);}
  return nb;
}

/* ─── Rendering ─── */
let chartInstance=null,sensChartInstance=null,latestResults=null;

function rerender(){
  const purchaseCost=Math.max(0,parseNumInput($('purchaseCost')));
  let availableCash=parseNumInput($('availableCash'));
  if(availableCash<=0)availableCash=purchaseCost;
  const inflationEnabled=$('inflationToggle').checked;
  const inflationRate=parseFloat($('inflationRate').value)||0;
  const riskFreeRate=parseFloat($('baseRf').value)||0;
  baseRiskFreeRate=riskFreeRate;
  $('inflationRow').style.display=inflationEnabled?'':'none';
  const optTarget=$('optTarget').value;
  currentCurrencySymbol=$('currencySymbol').value||'$';
  $('scFeeType').querySelector('option[value="fixed"]').textContent=moneySymbol();

  let warn='';
  const cashShortfall = availableCash < purchaseCost;
  if(cashShortfall){
    warn='⚠ Available cash ('+fmt.currencyExact(availableCash)+') is less than the purchase cost ('+fmt.currencyExact(purchaseCost)+'). Financing something you cannot afford upfront is not modelled here — please increase your available cash or reduce the purchase cost.';
    $('warnBanner').style.display='block';$('warnBanner').textContent=warn;
    $('negCarryBanner').style.display='none';
    // Clear all outputs
    ['kpiBest','kpiNetBenefit','kpiInterest','kpiCashWealth'].forEach(id=>{$(id).textContent='—';$(id).style.color=cssVar('--text');});
    ['kpiBestSub','kpiNetSub','kpiIntSub','kpiCashSub'].forEach(id=>{$(id).textContent='';});
    if(chartInstance){chartInstance.destroy();chartInstance=null;}
    $('chartLegend').innerHTML='';
    $('compTableWrap').innerHTML='<p class="muted">Adjust inputs above to run the simulation.</p>';
    $('amortTabs').innerHTML='';
    $('amortTableWrap').innerHTML='<p class="muted">Adjust inputs above to run the simulation.</p>';
    return;
  }
  $('warnBanner').style.display='none';

  const results=[];let anyNegCarry=false;
  scenarios.forEach((sc,i)=>{
    const res=computeScenario(sc,purchaseCost,availableCash,riskFreeRate,inflationRate,inflationEnabled);
    if(res){res.name=sc.name;res.idx=i;res.colorVar=SCENARIO_COLORS[i%SCENARIO_COLORS.length];if(res.negCarry)anyNegCarry=true;}
    results.push(res);
  });
  $('negCarryBanner').style.display=anyNegCarry?'block':'none';
  $('negCarryBanner').textContent=anyNegCarry?'⚠ Negative carry: finance rate exceeds risk-free rate. Financing will likely cost more than investing.':'';

  results.forEach(r=>{if(!r)return;const cb=computeCashBaseline(purchaseCost,availableCash,r.termYears,riskFreeRate,inflationRate,inflationEnabled);r.cashBaseWealth=cb.endWealth;r.netBenefit=r.endWealth-cb.endWealth;if(r.inflAdj&&cb.inflAdj)r.inflAdj.netBenefitReal=(r.inflAdj.endWealthReal||0)-(cb.inflAdj.endWealthReal||0);});

  const valid=results.filter(r=>r);
  let bestIdx=-1;
  if(valid.length){
    if(optTarget==='netBenefit')bestIdx=valid.reduce((b,r)=>r.netBenefit>(results[b]?.netBenefit??-Infinity)?r.idx:b,valid[0].idx);
    else if(optTarget==='lowestInterest')bestIdx=valid.reduce((b,r)=>r.totalInterest<(results[b]?.totalInterest??Infinity)?r.idx:b,valid[0].idx);
    else if(optTarget==='lowestCost')bestIdx=valid.reduce((b,r)=>r.totalFinanceCost<(results[b]?.totalFinanceCost??Infinity)?r.idx:b,valid[0].idx);
  }
  const allNeg=valid.every(r=>r.netBenefit<0);
  const bestResult=bestIdx>=0?results[bestIdx]:null;
  const maxTerm=valid.reduce((m,r)=>Math.max(m,r.termYears),5);
  const cashBase=computeCashBaseline(purchaseCost,availableCash,maxTerm,riskFreeRate,inflationRate,inflationEnabled);
  latestResults={results,cashBase,bestIdx,allNeg,purchaseCost,availableCash,maxTerm,inflationEnabled,inflationRate,riskFreeRate};

  // KPIs
  if(allNeg||!bestResult){$('kpiBest').textContent='Cash Purchase';$('kpiBest').style.color=cssVar('--accent2');$('kpiBestSub').textContent=valid.length?'No financing scenario beats paying cash.':'Add scenarios to compare.';}
  else{$('kpiBest').textContent=bestResult.name;$('kpiBest').style.color=cssVar(bestResult.colorVar);$('kpiBestSub').textContent='Based on '+$('optTarget').selectedOptions[0].text.toLowerCase()+'.';}
  if(bestResult){const nb=bestResult.netBenefit;$('kpiNetBenefit').textContent=fmt.currency(nb,true);$('kpiNetBenefit').style.color=nb>=0?cssVar('--positive-em'):cssVar('--negative-em');$('kpiNetSub').textContent=nb>=0?'Financing is more wealth-efficient':'Cash purchase preserves more wealth';$('kpiInterest').textContent=fmt.currency(bestResult.totalInterest,true);$('kpiInterest').style.color=cssVar('--text');$('kpiIntSub').textContent=fmt.currencyExact(bestResult.payment)+'/'+freqLabel(bestResult.freq);}
  else{$('kpiNetBenefit').textContent='—';$('kpiNetBenefit').style.color=cssVar('--text');$('kpiNetSub').textContent='';$('kpiInterest').textContent='—';$('kpiInterest').style.color=cssVar('--text');$('kpiIntSub').textContent='';}
  $('kpiCashWealth').textContent=fmt.currency(cashBase.endWealth,true);$('kpiCashWealth').style.color=cssVar('--text');$('kpiCashSub').textContent=`After ${maxTerm.toFixed(1)} yr at ${fmt.pct(riskFreeRate/100)} risk-free`;

  renderMainChart(results);renderComparisonTable(results);renderAmortTabs(results);updateSensScenarioDropdown();
}

function renderMainChart(results){
  const metric=$('chartMetric').value;
  const titles={wealth:'Ending Wealth Over Time',netBenefit:'Net Benefit vs Cash Purchase',investmentValue:'Investment Value Over Time',loanBalance:'Loan Balance Over Time'};
  $('chartTitle').textContent=titles[metric]||'Chart';
  const maxN=results.reduce((m,r)=>r?Math.max(m,r.n):m,0);
  if(maxN===0){if(chartInstance){chartInstance.destroy();chartInstance=null;}return;}
  const labels=[];for(let i=0;i<=maxN;i++)labels.push(i);
  const datasets=[],legendItems=[];
  if(metric==='wealth'){
    const v0=results.find(r=>r);
    if(v0){const ppy=v0.ppy,rfP=Math.pow(1+latestResults.riskFreeRate/100,1/ppy)-1,left=Math.max(0,latestResults.availableCash-latestResults.purchaseCost);const cd=[];let b=left;for(let i=0;i<=maxN;i++){cd.push(b);b*=(1+rfP);}
    datasets.push({label:'Cash Purchase',data:cd,borderColor:cssVar('--muted'),backgroundColor:'transparent',borderWidth:2,borderDash:[6,4],pointRadius:0,pointHoverRadius:4,tension:.3,fill:false});legendItems.push({label:'Cash Purchase',color:cssVar('--muted'),dash:true});}
  }
  const maxNResult=results.find(r=>r&&r.n===maxN);
  const freqLabelMap={weekly:'Week',fortnightly:'Fortnight',monthly:'Month',yearly:'Year'};
  const xAxisLabel=maxNResult?freqLabelMap[maxNResult.freq]||'Period':'Period';
  const yAxisLabel={wealth:`Wealth (${moneySymbol()})`,netBenefit:`Net Benefit (${moneySymbol()})`,investmentValue:`Investment Value (${moneySymbol()})`,loanBalance:`Loan Balance (${moneySymbol()})`}[metric]||`Value (${moneySymbol()})`;
  results.forEach(r=>{if(!r)return;const color=cssVar(r.colorVar);const data=[];
    const rfP_r=Math.pow(1+latestResults.riskFreeRate/100,1/r.ppy)-1;
    const left=Math.max(0,latestResults.availableCash-latestResults.purchaseCost);
    const lastT=r.timeline[r.timeline.length-1];
    for(let p=0;p<=maxN;p++){
      if(p<r.timeline.length){const t=r.timeline[p];
        if(metric==='wealth')data.push(t.wealth);
        else if(metric==='netBenefit')data.push(t.wealth-left*Math.pow(1+rfP_r,p));
        else if(metric==='investmentValue')data.push(t.investBal);
        else if(metric==='loanBalance')data.push(t.loanBal);
      } else {
        // Loan paid off — continue compounding leftover invest balance at risk-free rate
        const extra=p-(r.timeline.length-1);const grownWealth=lastT.investBal*Math.pow(1+rfP_r,extra);
        if(metric==='wealth')data.push(grownWealth);
        else if(metric==='netBenefit')data.push(grownWealth-left*Math.pow(1+rfP_r,p));
        else if(metric==='investmentValue')data.push(grownWealth);
        else if(metric==='loanBalance')data.push(0);
      }
    }
    datasets.push({label:r.name,data,borderColor:color,backgroundColor:color+'22',borderWidth:2.5,pointRadius:0,pointHoverRadius:5,tension:.3,fill:false});legendItems.push({label:r.name,color});
  });
  const le=$('chartLegend');le.innerHTML='';legendItems.forEach(l=>{const d=document.createElement('div');d.className='legend-item';d.innerHTML=`<span class="dot" style="background:${l.color};${l.dash?'border:2px dashed '+l.color+';background:transparent;':''}"></span><span>${l.label}</span>`;le.appendChild(d);});
  const gc=cssVar('--chart-grid'),mc=cssVar('--chart-text'),tc=cssVar('--text');
  const cfg={type:'line',data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,animation:{duration:300},interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{callbacks:{title:c=>`${xAxisLabel} ${c[0].label}`,label:c=>`  ${c.dataset.label}: ${fmt.currency(c.parsed.y,true)}`},backgroundColor:'#1e1e2e',titleColor:tc,bodyColor:mc,borderColor:gc,borderWidth:1,padding:10,onAfterBody:items=>{if(!items.length)return;$('hoverBox').textContent=`${xAxisLabel} ${items[0].label}  —  `+items.map(i=>`${i.dataset.label}: ${fmt.currency(i.parsed.y,true)}`).join('  |  ');}},zoom:{pan:{enabled:true,mode:'x'},zoom:{wheel:{enabled:true,speed:.08},pinch:{enabled:true},mode:'x'}}},scales:{x:{title:{display:true,text:xAxisLabel,color:mc,font:{size:12}},ticks:{color:mc,maxTicksLimit:12,font:{size:11}},grid:{color:gc}},y:{title:{display:true,text:yAxisLabel,color:mc,font:{size:12}},ticks:{color:mc,font:{size:11},callback:v=>fmt.currency(v,true)},grid:{color:gc}}}}};
  if(chartInstance){chartInstance.data=cfg.data;chartInstance.options.scales.x.ticks.color=mc;chartInstance.options.scales.x.grid.color=gc;chartInstance.options.scales.x.title.color=mc;chartInstance.options.scales.x.title.text=xAxisLabel;chartInstance.options.scales.y.ticks.color=mc;chartInstance.options.scales.y.grid.color=gc;chartInstance.options.scales.y.title.color=mc;chartInstance.options.scales.y.title.text=yAxisLabel;chartInstance.update('none');}
  else chartInstance=new Chart($('chartCanvas'),cfg);
}

function renderComparisonTable(results){
  const valid=results.filter(r=>r);if(!valid.length){$('compTableWrap').innerHTML='<p class="muted">Add financing scenarios to compare.</p>';return;}
  const inflOn=latestResults.inflationEnabled,pc=latestResults.purchaseCost;
  let h='<table><thead><tr><th>Metric</th><th>Cash Purchase</th>';valid.forEach(r=>{h+='<th>'+r.name+'</th>';});h+='</tr></thead><tbody>';
  const rows=[
    ['Down Payment (%)','—',r=>fmt.pct((r.down/latestResults.purchaseCost)||0,2)],
    ['Down Payment Amount','—',r=>fmt.currency(r.down)],['Financed Amount','—',r=>fmt.currency(r.financed)],
    ['Periodic Payment','—',r=>r.payment>0?fmt.currencyExact(r.payment)+'/'+freqLabel(r.freq):'—'],
    ['Total Interest Paid',fmt.currency(0),r=>fmt.currencyExact(r.totalInterest)],['Total Fees Paid',fmt.currency(0),r=>fmt.currencyExact(r.totalFee)],
    ['Total Financing Cost',fmt.currency(0),r=>fmt.currencyExact(r.totalFinanceCost)],['Total Out-of-Pocket',fmt.currency(pc),r=>fmt.currencyExact(r.totalOOP)],
    ['Ending Wealth',r=>fmt.currencyExact(r.cashBaseWealth),r=>fmt.currencyExact(r.endWealth)],
    ['Net Benefit vs Cash','Baseline',r=>{const v=r.netBenefit;return`<span style="color:${v>=0?cssVar('--positive-em'):cssVar('--negative-em')};font-weight:700">${fmt.currencyExact(v)}</span>`;}],
  ];
  if(inflOn)rows.push(['Inflation-Adj Net Benefit','Baseline',r=>{if(!r.inflAdj||r.inflAdj.netBenefitReal===undefined)return'—';const v=r.inflAdj.netBenefitReal;return`<span style="color:${v>=0?cssVar('--positive-em'):cssVar('--negative-em')};font-weight:700">${fmt.currencyExact(v)}</span>`;}]);
  rows.forEach(([label,cashVal,fn])=>{
    const cv=typeof cashVal==='function'?cashVal(valid[0]):cashVal;
    h+=`<tr><td>${label}</td><td>${cv}</td>`;valid.forEach(r=>{h+='<td>'+fn(r)+'</td>';});h+='</tr>';
  });
  h+='</tbody></table>';$('compTableWrap').innerHTML=h;
}

function renderAmortTabs(results){
  const valid=results.filter(r=>r&&r.amort.schedule.length>0);const tb=$('amortTabs');tb.innerHTML='';
  if(!valid.length){$('amortTableWrap').innerHTML='<p class="muted">No financing scenarios with payments.</p>';return;}
  if(activeAmortIdx>=valid.length)activeAmortIdx=0;
  valid.forEach((r,i)=>{const b=document.createElement('button');b.className='tab-btn'+(i===activeAmortIdx?' active':'');b.textContent=r.name;b.addEventListener('click',()=>{activeAmortIdx=i;renderAmortTabs(results);});tb.appendChild(b);});
  const r=valid[activeAmortIdx];
  const periodHdr=freqLabel(r.freq).charAt(0).toUpperCase()+freqLabel(r.freq).slice(1)+' #';
  let h='<table><thead><tr><th>'+periodHdr+'</th><th>Start Balance</th><th>Interest</th><th>Principal</th><th>Payment</th><th>End Balance</th></tr></thead><tbody>';
  let tI=0,tP=0,tPmt=0;
  r.amort.schedule.forEach(p=>{tI+=p.interest;tP+=p.principal;tPmt+=p.payment;h+=`<tr><td>${fmt.num(p.num)}</td><td>${fmt.currencyExact(p.startBal)}</td><td>${fmt.currencyExact(p.interest)}</td><td>${fmt.currencyExact(p.principal)}</td><td>${fmt.currencyExact(p.payment)}</td><td>${fmt.currencyExact(p.endBal)}</td></tr>`;});
  h+=`<tr style="font-weight:800;border-top:2px solid var(--accent);"><td>Total</td><td></td><td>${fmt.currencyExact(tI)}</td><td>${fmt.currencyExact(tP)}</td><td>${fmt.currencyExact(tPmt)}</td><td></td></tr>`;
  if(r.totalFee>0)h+=`<tr><td colspan="6" style="text-align:left;color:var(--muted);">+ Origination Fee: ${fmt.currencyExact(r.totalFee)}</td></tr>`;
  h+=`<tr><td colspan="6" style="text-align:left;color:var(--muted);">= Grand Total: ${fmt.currencyExact(tPmt+r.totalFee+r.down)} (incl. ${fmt.currencyExact(r.down)} down)</td></tr>`;
  h+='</tbody></table>';$('amortTableWrap').innerHTML=h;
}

function updateSensScenarioDropdown(){const s=$('sensScenario'),p=s.value;s.innerHTML='';scenarios.forEach((sc,i)=>{const o=document.createElement('option');o.value=i;o.textContent=sc.name;s.appendChild(o);});if(p&&parseInt(p)<scenarios.length)s.value=p;}

/* ─── Sensitivity Engine ─── */
function runSensitivity(){
  const scIdx=parseInt($('sensScenario').value);if(isNaN(scIdx)||!scenarios[scIdx])return;
  const baseSc={...scenarios[scIdx]};const obj=$('sensObjective').value;const varX=$('sensVarX').value;
  const xS=parseFloat($('sensXStart').value)||0,xE=parseFloat($('sensXEnd').value)||10;
  const steps=Math.max(5,Math.min(50,parseInt($('sensSteps').value)||20));
  const pc=parseNumInput($('purchaseCost'))||50000;let ac=parseNumInput($('availableCash'));if(ac<=0)ac=pc;
  const inflOn=$('inflationToggle').checked,inflR=parseFloat($('inflationRate').value)||0;
  const rfRate=parseFloat($('baseRf').value)||0;

  function applyVar(sc,vn,val){
    const m={...sc};
    if(vn==='financeRate')m.financeRate=val;
    else if(vn==='riskFreeRate'){/* now a global, override via closure */m._rfOverride=val;}
    else if(vn==='downPayment')m.downPaymentPct=Math.min(100,Math.max(0,val));
    else if(vn==='termYears')m.termPeriods=Math.max(1,Math.round(Math.max(0.25,val)*periodsPerYear(m.freq)));
    return m;
  }
  function getNetBenefit(m,pc,ac,inflR,inflOn,obj){
    const rf=m._rfOverride!==undefined?m._rfOverride:rfRate;
    return quickNetBenefit(m,pc,ac,rf,inflR,inflOn,obj);
  }
  const xVals=[];for(let i=0;i<steps;i++)xVals.push(xS+i*(xE-xS)/(steps-1));

  if(sensMode==='2d'){
    $('sens2dSection').style.display='';$('sens3dSection').style.display='none';
    const objL=$('sensObjective').selectedOptions[0].text,xL=$('sensVarX').selectedOptions[0].text;
    $('sens2dTitle').textContent=`${objL} vs ${xL}`;
    const data=xVals.map(x=>{const m=applyVar(baseSc,varX,x);const v=getNetBenefit(m,pc,ac,inflR,inflOn,obj);return v!==null?v:0;});
    const labels=xVals.map(x=>x.toFixed(2));const color=cssVar(SCENARIO_COLORS[scIdx%SCENARIO_COLORS.length]);
    const gc=cssVar('--chart-grid'),mc=cssVar('--chart-text');
    const datasets=[{label:objL,data,borderColor:color,backgroundColor:color+'22',borderWidth:2.5,pointRadius:2,pointHoverRadius:5,tension:.3,fill:false},{label:'Zero',data:xVals.map(()=>0),borderColor:cssVar('--muted'),borderWidth:1,borderDash:[4,4],pointRadius:0,fill:false}];
    $('sensLegend').innerHTML=`<div class="legend-item"><span class="dot" style="background:${color}"></span><span>${baseSc.name}</span></div>`;
    const cfg={type:'line',data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,animation:{duration:300},interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{callbacks:{title:c=>`${xL}: ${c[0].label}`,label:c=>`${c.dataset.label}: ${fmt.currency(c.parsed.y,true)}`}},zoom:{pan:{enabled:true,mode:'x'},zoom:{wheel:{enabled:true,speed:.08},pinch:{enabled:true},mode:'x'}}},scales:{x:{title:{display:true,text:xL,color:mc},ticks:{color:mc,font:{size:11}},grid:{color:gc}},y:{title:{display:true,text:objL,color:mc},ticks:{color:mc,font:{size:11},callback:v=>fmt.currency(v,true)},grid:{color:gc}}}}};
    if(sensChartInstance){sensChartInstance.data=cfg.data;sensChartInstance.options=cfg.options;sensChartInstance.update('none');}
    else sensChartInstance=new Chart($('sensCanvas'),cfg);
  } else {
    // ═══ 3D SURFACE PLOT ═══
    $('sens2dSection').style.display='none';$('sens3dSection').style.display='';
    const varY=$('sensVarY').value;
    const yS=parseFloat($('sensYStart').value)||0,yE=parseFloat($('sensYEnd').value)||8;
    const yVals=[];for(let i=0;i<steps;i++)yVals.push(yS+i*(yE-yS)/(steps-1));
    const xL=$('sensVarX').selectedOptions[0].text,yL=$('sensVarY').selectedOptions[0].text,zL=$('sensObjective').selectedOptions[0].text;
    $('sens3dTitle').textContent=`3D Surface: ${zL}`;

    // Build z matrix [y][x]
    const zData=[];
    for(let yi=0;yi<steps;yi++){const row=[];for(let xi=0;xi<steps;xi++){let m=applyVar(baseSc,varX,xVals[xi]);m=applyVar(m,varY,yVals[yi]);const v=getNetBenefit(m,pc,ac,inflR,inflOn,obj);row.push(v!==null?v:0);}zData.push(row);}

    const isLight=document.body.classList.contains('light');
    const plotData=[{type:'surface',x:xVals,y:yVals,z:zData,
      colorscale:[[0,'#E63939'],[0.25,'#FFD28C'],[0.5,'#F8FBFF'],[0.75,'#8FCDBD'],[1,'#8DBBFF']],
      contours:{z:{show:true,usecolormap:true,highlightcolor:'#fff',project:{z:false}}},
      hovertemplate:`${xL}: %{x:.2f}<br>${yL}: %{y:.2f}<br>${zL}: ${moneySymbol()}%{z:,.0f}<extra></extra>`
    }];
    const layout={autosize:true,margin:{l:0,r:0,t:0,b:0},
      paper_bgcolor:isLight?'#FFFFFF':'#162033',
      scene:{
        xaxis:{title:xL,color:isLight?'#2D3436':'#A8B6CF',gridcolor:isLight?'#E0E6F0':'#2C3A52'},
        yaxis:{title:yL,color:isLight?'#2D3436':'#A8B6CF',gridcolor:isLight?'#E0E6F0':'#2C3A52'},
        zaxis:{title:zL,color:isLight?'#2D3436':'#A8B6CF',gridcolor:isLight?'#E0E6F0':'#2C3A52',tickprefix:moneySymbol(),tickformat:',.0f'},
        bgcolor:isLight?'#F0F4FF':'#0F1728',
        camera:{eye:{x:1.8,y:1.8,z:1.2}}
      },
      font:{family:'DM Sans',color:isLight?'#2D3436':'#EAF1FF'}
    };
    Plotly.newPlot('plotly3d',plotData,layout,{responsive:true,displayModeBar:true,displaylogo:false});
  }
}

/* ─── Scenario Management ─── */
function renderScenarioList(){
  const list=$('scenarioList');list.innerHTML='';
  scenarios.forEach((sc,i)=>{
    const div=document.createElement('div');div.className='scenario-card'+(editingIdx===i?' active':'');const color=cssVar(SCENARIO_COLORS[i%SCENARIO_COLORS.length]);
    div.innerHTML=`<div class="sc-header"><div class="sc-name"><span class="sc-dot" style="background:${color}"></span>${sc.name}</div><div class="sc-actions"><button class="sc-btn" data-action="edit" data-idx="${i}">Edit</button><button class="sc-btn" data-action="dup" data-idx="${i}">Dup</button><button class="sc-btn del" data-action="del" data-idx="${i}">✕</button></div></div><div class="sc-summary">${fmt.pct(sc.financeRate/100)} rate · ${sc.termPeriods} ${termUnitLabel(sc.freq)} ${sc.freq} · ${fmt.pct((sc.downPaymentPct||0)/100,0)} down</div>`;
    div.querySelectorAll('.sc-btn').forEach(btn=>{btn.addEventListener('click',e=>{e.stopPropagation();const a=btn.dataset.action,idx=parseInt(btn.dataset.idx);if(a==='edit')openEditor(idx);else if(a==='dup'){scenarios.push({...scenarios[idx],name:scenarios[idx].name+' (copy)'});renderScenarioList();rerender();}else if(a==='del'){scenarios.splice(idx,1);if(editingIdx===idx){editingIdx=-1;$('scenarioEditor').style.display='none';}renderScenarioList();rerender();}});});
    div.addEventListener('click',()=>openEditor(i));list.appendChild(div);
  });
}

function updateTermLabel(freq){
  const unit=termUnitLabel(freq);
  // Update the label text node (first child of tip-wrap)
  const lbl=$('termLabel');
  lbl.firstChild.textContent='Term ('+unit+') ';
  const sub=$('termSub');
  if(freq==='weekly')sub.textContent='Number of weekly payments (e.g. 260 = 5 years).';
  else if(freq==='fortnightly')sub.textContent='Number of fortnightly payments (e.g. 130 = 5 years).';
  else if(freq==='monthly')sub.textContent='Number of monthly payments (e.g. 60 = 5 years).';
  else sub.textContent='Number of yearly payments (e.g. 5 = 5 years).';
}

function openEditor(idx){
  editingIdx=idx;const sc=scenarios[idx];
  if(sc.downPaymentPct===undefined&&sc.downPayment!==undefined){
    sc.downPaymentPct=Math.min(100,Math.max(0,(sc.downPayment/(parseNumInput($('purchaseCost'))||1))*100));
  }
  $('editorTitle').textContent='Edit: '+sc.name;
  $('scName').value=sc.name;
  $('scRate').value=sc.financeRate;
  $('scRateVal').textContent=fmt.pct(sc.financeRate/100);
  $('scDownPct').value=Math.min(100,Math.max(0,sc.downPaymentPct||0));
  $('scDownVal').textContent=fmt.pct(($('scDownPct').value||0)/100,0);
  $('scTerm').value=sc.termPeriods;
  $('scFreq').value=sc.freq;
  updateTermLabel(sc.freq);
  $('scFeeAmt').value=fmt.fmtInput(sc.feeAmt);
  $('scFeeType').value=sc.feeType;
  $('scenarioEditor').style.display='block';
  renderScenarioList();
}

function saveEditor(){
  if(editingIdx<0)return;
  const sc=scenarios[editingIdx];
  sc.name=$('scName').value||'Scenario '+(editingIdx+1);
  const _r=parseFloat($('scRate').value);sc.financeRate=isNaN(_r)?5:_r;
  const downPct=parseFloat($('scDownPct').value);
  sc.downPaymentPct=isNaN(downPct)?0:Math.min(100,Math.max(0,downPct));
  const newFreq=$('scFreq').value;
  // If freq changed, convert termPeriods
  if(newFreq!==sc.freq){sc.freq=newFreq;updateTermLabel(newFreq);}
  sc.termPeriods=Math.max(1,Math.round(parseFloat($('scTerm').value)||defaultTerm(sc.freq)));
  sc.feeAmt=Math.max(0,parseNumInput($('scFeeAmt')));
  sc.feeType=$('scFeeType').value;
  renderScenarioList();rerender();
}

function closeEditor(){editingIdx=-1;$('scenarioEditor').style.display='none';renderScenarioList();}

/* ─── Events ─── */
$('addScenarioBtn').addEventListener('click',()=>{scenarios.push(defaultScenario());openEditor(scenarios.length-1);rerender();});
$('saveScenarioBtn').addEventListener('click',()=>{saveEditor();closeEditor();});
$('cancelScenarioBtn').addEventListener('click',closeEditor);

// Base RF rate slider
['input','change'].forEach(evt=>{$('baseRf').addEventListener(evt,()=>{$('baseRfVal').textContent=fmt.pct(parseFloat($('baseRf').value)/100);rerender();});});

// Finance rate slider in editor — live update display
['input','change'].forEach(evt=>{$('scRate').addEventListener(evt,()=>{$('scRateVal').textContent=fmt.pct(parseFloat($('scRate').value)/100);});});
['input','change'].forEach(evt=>{$('scDownPct').addEventListener(evt,()=>{$('scDownVal').textContent=fmt.pct(parseFloat($('scDownPct').value||0)/100,0);});});

// Freq change updates term label immediately
$('scFreq').addEventListener('change',()=>{updateTermLabel($('scFreq').value);});

['scName','scTerm','scFeeType'].forEach(id=>{['input','change'].forEach(evt=>{$(id).addEventListener(evt,()=>{/* live preview only on save click */});});});
['scFeeAmt'].forEach(id=>{$(id).addEventListener('blur',()=>{/* handled on save */});});
['chartMetric','optTarget'].forEach(id=>{$(id).addEventListener('change',rerender);});
$('currencySymbol').addEventListener('change',rerender);
$('inflationToggle').addEventListener('change',rerender);
$('inflationRate').addEventListener('change',rerender);

document.querySelectorAll('.ctrl-tab').forEach(btn=>{btn.addEventListener('click',()=>{document.querySelectorAll('.ctrl-tab').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.ctrl-panel').forEach(p=>p.classList.remove('active'));btn.classList.add('active');$('tab-'+btn.dataset.tab).classList.add('active');});});
$('mode2d').addEventListener('click',()=>{sensMode='2d';$('mode2d').classList.add('active');$('mode3d').classList.remove('active');$('sensYBlock').style.display='none';});
$('mode3d').addEventListener('click',()=>{sensMode='3d';$('mode3d').classList.add('active');$('mode2d').classList.remove('active');$('sensYBlock').style.display='';});
$('runSensBtn').addEventListener('click',runSensitivity);

$('themeToggle').addEventListener('click',()=>{document.body.classList.toggle('light');$('themeToggle').textContent=document.body.classList.contains('light')?'🌙 Dark':'☀️ Light';if(chartInstance){chartInstance.destroy();chartInstance=null;}if(sensChartInstance){sensChartInstance.destroy();sensChartInstance=null;}rerender();});
$('chartResetZoom').addEventListener('click',()=>{if(chartInstance)chartInstance.resetZoom();});
$('sensResetZoom').addEventListener('click',()=>{if(sensChartInstance)sensChartInstance.resetZoom();});
$('chartCanvas').addEventListener('mouseleave',()=>{$('hoverBox').textContent='Hover over the chart to inspect a period.';});

$('resetBtn').addEventListener('click',()=>{
  scenarios=[];
  scenarios.push(defaultScenario('60mo Monthly @ 5%',5));
  scenarios.push({...defaultScenario('36mo Monthly @ 7%',7),termPeriods:36,financeRate:7});
  editingIdx=-1;
  $('scenarioEditor').style.display='none';
  $('purchaseCost').value=fmt.fmtInput(50000);
  $('availableCash').value=fmt.fmtInput(50000);
  $('currencySymbol').value='$';
  $('baseRf').value=4.5;
  $('baseRfVal').textContent='4.50%';
  $('inflationToggle').checked=false;
  $('inflationRate').value=2.5;
  $('chartMetric').value='wealth';
  $('optTarget').value='netBenefit';
  $('sens2dSection').style.display='none';
  $('sens3dSection').style.display='none';
  renderScenarioList();rerender();
});

$('downloadBtn').addEventListener('click',()=>{
  const table=$('amortTableWrap').querySelector('table');
  if(!table)return;
  const esc=v=>`"${String(v??'').replace(/"/g,'""')}"`;
  const rows=[...table.querySelectorAll('tr')].map(tr=>
    [...tr.querySelectorAll('th,td')].map(cell=>esc(cell.textContent.trim())).join(',')
  );
  if(!rows.length)return;
  const csv='# Made using tool.adjiebrotots.com/financingvscash\n'+rows.join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='amortization_schedule.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

/* ─── DOWNLOAD CHART PNG ─── */
function downloadChartJsPng(canvasId, filename, chartTitle, legendId, shouldDownload = true) {
  const src = document.getElementById(canvasId);
  if(!src) return;
  const dpr = window.devicePixelRatio || 1;
  const OUT = 3;
  const chartW = Math.round(src.width / dpr * OUT);
  const chartH = Math.round(src.height / dpr * OUT);
  const isLight = document.body.classList.contains('light');
  const bgColor = isLight ? '#ffffff' : '#0F1728';
  const fgColor = isLight ? '#2D3436' : '#EAF1FF';
  const FONT = '"DM Sans", sans-serif';

  const legendItems = [];
  if(legendId){
    const legendEl = document.getElementById(legendId);
    if(legendEl){
      legendEl.querySelectorAll('.legend-item:not(.hidden)').forEach(item => {
        const dot = item.querySelector('.dot');
        const label = item.textContent.trim();
        const color = dot ? window.getComputedStyle(dot).backgroundColor : '#888888';
        if(label) legendItems.push({ label, color });
      });
    }
  }

  const titleFontPx = Math.round(14 * OUT);
  const legendFontPx = Math.round(11 * OUT);
  const titleH = chartTitle ? Math.round(40 * OUT) : 0;
  const legendH = legendItems.length ? Math.round(34 * OUT) : 0;

  const tmp = document.createElement('canvas');
  tmp.width = chartW;
  tmp.height = chartH + titleH + legendH;
  const ctx = tmp.getContext('2d');

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, tmp.width, tmp.height);

  if(chartTitle){
    ctx.font = `700 ${titleFontPx}px ${FONT}`;
    ctx.fillStyle = fgColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(chartTitle, tmp.width / 2, titleH / 2);
  }

  ctx.drawImage(src, 0, titleH, chartW, chartH);

  if(legendItems.length){
    const ly = titleH + chartH;
    const dotR = Math.round(5 * OUT);
    const gap = Math.round(7 * OUT);
    const pad = Math.round(20 * OUT);
    ctx.font = `500 ${legendFontPx}px ${FONT}`;
    ctx.textBaseline = 'middle';
    let totalW = 0;
    legendItems.forEach((item, i) => {
      totalW += dotR * 2 + gap + ctx.measureText(item.label).width + (i < legendItems.length - 1 ? pad : 0);
    });
    let x = Math.max(Math.round(16 * OUT), (tmp.width - totalW) / 2);
    const cy = ly + legendH / 2;
    legendItems.forEach(item => {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(x + dotR, cy, dotR, 0, Math.PI * 2);
      ctx.fill();
      x += dotR * 2 + gap;
      ctx.fillStyle = fgColor;
      ctx.textAlign = 'left';
      ctx.fillText(item.label, x, cy);
      x += ctx.measureText(item.label).width + pad;
    });
  }

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.font = `500 ${Math.round(11 * OUT)}px ${FONT}`;
  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  {
    const wmText = 'Made using tool.adjiebrotots.com/financingvscash';
    const wmX = tmp.width - Math.round(12 * OUT);
    const wmY = tmp.height - Math.round(12 * OUT);
    const wmTextW = ctx.measureText(wmText).width;
    const wmLogoSize = Math.round(13 * OUT);
    if(wmLogoImg.complete && wmLogoImg.naturalWidth){
      ctx.drawImage(wmLogoImg, wmX - wmTextW - Math.round(4 * OUT) - wmLogoSize, wmY - wmLogoSize + Math.round(2 * OUT), wmLogoSize, wmLogoSize);
    }
    ctx.fillText(wmText, wmX, wmY);
  }
  ctx.restore();

  if(shouldDownload){
    const a = document.createElement('a');
    a.href = tmp.toDataURL('image/png');
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
  }
  return tmp;
}
async function copyCanvasPngToClipboard(canvas) {
  if(!navigator.clipboard || !window.ClipboardItem) throw new Error('Clipboard image copy is not supported in this browser.');
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if(!blob) throw new Error('Could not create PNG blob.');
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

function downloadChartJsSvg(canvasId, filename, chartTitle, legendId) {
  const src = document.getElementById(canvasId);
  if(!src) return;
  const dpr = window.devicePixelRatio || 1;
  const chartW = Math.round(src.width / dpr);
  const chartH = Math.round(src.height / dpr);
  const isLight = document.body.classList.contains('light');
  const bgColor = isLight ? '#ffffff' : '#0F1728';
  const fgColor = isLight ? '#2D3436' : '#EAF1FF';
  const FONT = 'DM Sans, sans-serif';
  const legendItems = [];
  if(legendId){
    const legendEl = document.getElementById(legendId);
    if(legendEl){
      legendEl.querySelectorAll('.legend-item:not(.hidden)').forEach(item => {
        const dot = item.querySelector('.dot');
        const label = item.textContent.trim();
        const color = dot ? window.getComputedStyle(dot).backgroundColor : '#888888';
        if(label) legendItems.push({ label, color });
      });
    }
  }
  const titleH = chartTitle ? 40 : 0;
  const legendH = legendItems.length ? 34 : 0;
  const svgW = chartW, svgH = chartH + titleH + legendH;
  const NS = 'http://www.w3.org/2000/svg', xl = 'http://www.w3.org/1999/xlink';
  const svg = document.createElementNS(NS,'svg');
  svg.setAttribute('xmlns',NS); svg.setAttribute('xmlns:xlink',xl);
  svg.setAttribute('width',svgW); svg.setAttribute('height',svgH);
  svg.setAttribute('viewBox',`0 0 ${svgW} ${svgH}`);
  const bgRect = document.createElementNS(NS,'rect');
  bgRect.setAttribute('width',svgW); bgRect.setAttribute('height',svgH); bgRect.setAttribute('fill',bgColor);
  svg.appendChild(bgRect);
  if(chartTitle){
    const t = document.createElementNS(NS,'text');
    t.setAttribute('x',svgW/2); t.setAttribute('y',titleH/2);
    t.setAttribute('text-anchor','middle'); t.setAttribute('dominant-baseline','middle');
    t.setAttribute('font-family',FONT); t.setAttribute('font-size','14'); t.setAttribute('font-weight','700'); t.setAttribute('fill',fgColor);
    t.textContent = chartTitle; svg.appendChild(t);
  }
  const img = document.createElementNS(NS,'image');
  img.setAttribute('x',0); img.setAttribute('y',titleH);
  img.setAttribute('width',chartW); img.setAttribute('height',chartH);
  img.setAttributeNS(xl,'href',src.toDataURL('image/png'));
  svg.appendChild(img);
  if(legendItems.length){
    const dotR=5, gap=7, pad=20;
    const cy = titleH + chartH + legendH/2;
    const mc = document.createElement('canvas').getContext('2d');
    mc.font = '500 11px DM Sans, sans-serif';
    const totalW = legendItems.reduce((s,item,i) => s + dotR*2 + gap + mc.measureText(item.label).width + (i<legendItems.length-1?pad:0), 0);
    let x = Math.max(16, (svgW - totalW) / 2);
    legendItems.forEach(item => {
      const c = document.createElementNS(NS,'circle');
      c.setAttribute('cx',x+dotR); c.setAttribute('cy',cy); c.setAttribute('r',dotR); c.setAttribute('fill',item.color);
      svg.appendChild(c); x += dotR*2 + gap;
      const lt = document.createElementNS(NS,'text');
      lt.setAttribute('x',x); lt.setAttribute('y',cy);
      lt.setAttribute('dominant-baseline','middle'); lt.setAttribute('font-family',FONT);
      lt.setAttribute('font-size','11'); lt.setAttribute('font-weight','500'); lt.setAttribute('fill',fgColor);
      lt.textContent = item.label; svg.appendChild(lt);
      x += mc.measureText(item.label).width + pad;
    });
  }
  const wm = document.createElementNS(NS,'text');
  wm.setAttribute('x',svgW-12); wm.setAttribute('y',svgH-12);
  wm.setAttribute('text-anchor','end'); wm.setAttribute('dominant-baseline','auto');
  wm.setAttribute('font-family',FONT); wm.setAttribute('font-size','11');
  wm.setAttribute('font-weight','500'); wm.setAttribute('fill','#1a1a1a'); wm.setAttribute('opacity','0.22');
  wm.textContent = 'Made using tool.adjiebrotots.com/financingvscash'; svg.appendChild(wm);
  const wmLogoSize = 13;
  const wmTextW = measureWmText(wm.textContent, '500 11px ' + FONT);
  const wmLogo = document.createElementNS(NS,'image');
  wmLogo.setAttribute('href', WM_LOGO_SRC);
  wmLogo.setAttributeNS('http://www.w3.org/1999/xlink','href', WM_LOGO_SRC);
  wmLogo.setAttribute('width', wmLogoSize);
  wmLogo.setAttribute('height', wmLogoSize);
  wmLogo.setAttribute('x', svgW - 12 - wmTextW - 4 - wmLogoSize);
  wmLogo.setAttribute('y', svgH - 12 - wmLogoSize + 2);
  wmLogo.setAttribute('opacity', '0.22');
  svg.appendChild(wmLogo);
  const xml = '<?xml version="1.0" encoding="utf-8"?>\n' + new XMLSerializer().serializeToString(svg);
  const blob = new Blob([xml],{type:'image/svg+xml;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
$('chartPngBtn').addEventListener('click', () => {
  const title = document.getElementById('chartTitle')?.textContent || 'Finance vs Cash Purchase';
  downloadChartJsPng('chartCanvas', 'financing_wealth_chart.png', title, 'chartLegend');
});
$('sens2dPngBtn').addEventListener('click', () => {
  const title = document.getElementById('sens2dTitle')?.textContent || 'Finance vs Cash — 2D Sensitivity';
  downloadChartJsPng('sensCanvas', 'financing_sensitivity_2d.png', title, 'sensLegend');
});
async function withSens3dPngAnnotations(callback) {
  const title3d = document.getElementById('sens3dTitle')?.textContent || 'Finance vs Cash — 3D Sensitivity Surface';
  const titleAnnotation = {
    xref:'paper', yref:'paper', x:0.5, y:1.06, xanchor:'center', yanchor:'bottom',
    showarrow:false, text:`<b>${title3d}</b>`,
    font:{ size:14, color:document.body.classList.contains('light')?'#2D3436':'#EAF1FF', family:'DM Sans, sans-serif' },
  };
  const wmAnnotation = {
    xref:'paper', yref:'paper', x:1, y:0, xanchor:'right', yanchor:'bottom',
    showarrow:false, text:'Made using tool.adjiebrotots.com/financingvscash',
    font:{ size:10, color:'rgba(60,60,60,0.22)', family:'DM Sans, sans-serif' },
  };
  await Plotly.relayout('plotly3d', { annotations:[titleAnnotation, wmAnnotation], images:[wmPlotlyImage()] });
  try { return await callback(); }
  finally { await Plotly.relayout('plotly3d', { annotations:[], images:[] }); }
}
$('sens3dPngBtn').addEventListener('click', async () => {
  await withSens3dPngAnnotations(() => Plotly.downloadImage('plotly3d', { format:'png', filename:'financing_sensitivity_3d', scale:3 }));
});
async function copyPlotlyPngToClipboard(plotId, options) {
  if(!navigator.clipboard || !window.ClipboardItem) throw new Error('Clipboard image copy is not supported in this browser.');
  const dataUrl = await Plotly.toImage(plotId, options);
  const blob = await (await fetch(dataUrl)).blob();
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
$('chartCopyPngBtn').addEventListener('click', async () => {
  const title = document.getElementById('chartTitle')?.textContent || 'Finance vs Cash Purchase';
  try { await copyCanvasPngToClipboard(downloadChartJsPng('chartCanvas', 'financing_wealth_chart.png', title, 'chartLegend', false)); alert('PNG copied to clipboard.'); }
  catch(err){ alert('PNG copy failed: ' + err.message); }
});
$('sens2dCopyPngBtn').addEventListener('click', async () => {
  const title = document.getElementById('sens2dTitle')?.textContent || 'Finance vs Cash — 2D Sensitivity';
  try { await copyCanvasPngToClipboard(downloadChartJsPng('sensCanvas', 'financing_sensitivity_2d.png', title, 'sensLegend', false)); alert('PNG copied to clipboard.'); }
  catch(err){ alert('PNG copy failed: ' + err.message); }
});
$('sens3dCopyPngBtn').addEventListener('click', async () => {
  try { await withSens3dPngAnnotations(() => copyPlotlyPngToClipboard('plotly3d', { format:'png', scale:3 })); alert('PNG copied to clipboard.'); }
  catch(err){ alert('PNG copy failed: ' + err.message); }
});
$('chartSvgBtn').addEventListener('click', () => {
  const title = document.getElementById('chartTitle')?.textContent || 'Finance vs Cash Purchase';
  downloadChartJsSvg('chartCanvas', 'financing_wealth_chart.svg', title, 'chartLegend');
});
$('sens2dSvgBtn').addEventListener('click', () => {
  const title = document.getElementById('sens2dTitle')?.textContent || 'Finance vs Cash — 2D Sensitivity';
  downloadChartJsSvg('sensCanvas', 'financing_sensitivity_2d.svg', title, 'sensLegend');
});
$('sens3dSvgBtn').addEventListener('click', async () => {
  const title3d = document.getElementById('sens3dTitle')?.textContent || 'Finance vs Cash — 3D Sensitivity Surface';
  const titleAnnotation = {
    xref:'paper', yref:'paper', x:0.5, y:1.06, xanchor:'center', yanchor:'bottom',
    showarrow:false, text:`<b>${title3d}</b>`,
    font:{ size:14, color:document.body.classList.contains('light')?'#2D3436':'#EAF1FF', family:'DM Sans, sans-serif' },
  };
  const wmAnnotation = {
    xref:'paper', yref:'paper', x:1, y:0, xanchor:'right', yanchor:'bottom',
    showarrow:false, text:'Made using tool.adjiebrotots.com/financingvscash',
    font:{ size:10, color:'rgba(60,60,60,0.22)', family:'DM Sans, sans-serif' },
  };
  await Plotly.relayout('plotly3d', { annotations:[titleAnnotation, wmAnnotation], images:[wmPlotlyImage()] });
  await Plotly.downloadImage('plotly3d', { format:'svg', filename:'financing_sensitivity_3d' });
  await Plotly.relayout('plotly3d', { annotations:[], images:[] });
});

/* ─── Global Tooltip ─── */
(function(){
  const tip=document.getElementById('globalTooltip');
  let hideTimer=null;
  document.addEventListener('mouseover',e=>{
    const icon=e.target.closest('[data-tip]');
    if(!icon){return;}
    clearTimeout(hideTimer);
    tip.textContent=icon.dataset.tip;
    tip.classList.add('visible');
    const r=icon.getBoundingClientRect();
    const tw=220, margin=8;
    // Position above the icon, centred
    let left=r.left+r.width/2-tw/2;
    let top=r.top-tip.offsetHeight-margin;
    // Clamp horizontally within viewport
    left=Math.max(margin,Math.min(left,window.innerWidth-tw-margin));
    // If would go above viewport, show below instead
    if(top<margin){top=r.bottom+margin;tip.style.setProperty('--arrow-top','true');}
    else{tip.style.removeProperty('--arrow-top');}
    tip.style.left=left+'px';
    tip.style.top=top+'px';
    // Update arrow horizontal position to point at icon
    const arrowLeft=r.left+r.width/2-left;
    tip.style.setProperty('--arrow-left',Math.max(16,Math.min(arrowLeft,tw-16))+'px');
  });
  document.addEventListener('mouseout',e=>{
    const icon=e.target.closest('[data-tip]');
    if(!icon)return;
    hideTimer=setTimeout(()=>tip.classList.remove('visible'),80);
  });
})();

/* ─── Slider Editable ─── */
function makeSliderEditable(valSpan,rangeEl){
  if(!valSpan||!rangeEl)return;
  const inp=document.createElement('input');
  inp.type='text';inp.className='slider-val-edit';
  valSpan.parentNode.insertBefore(inp,valSpan.nextSibling);
  valSpan.addEventListener('click',()=>{
    inp.value=parseFloat(rangeEl.value);
    valSpan.style.display='none';inp.style.display='inline';
    inp.focus();inp.select();
  });
  function commit(){
    const raw=parseFloat(inp.value);
    if(!isNaN(raw)){
      const mn=parseFloat(rangeEl.min),mx=parseFloat(rangeEl.max),st=parseFloat(rangeEl.step)||1;
      const v=+(Math.round(Math.min(mx,Math.max(mn,raw))/st)*st).toFixed(10);
      rangeEl.value=v;
      rangeEl.dispatchEvent(new Event('input',{bubbles:true}));
      rangeEl.dispatchEvent(new Event('change',{bubbles:true}));
    }
    inp.style.display='none';valSpan.style.display='';
  }
  inp.addEventListener('blur',commit);
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();inp.blur();}else if(e.key==='Escape'){inp.value='';commit();}});
}
[['baseRf','baseRfVal'],['scRate','scRateVal'],['scDownPct','scDownVal']
].forEach(([rid,vid])=>makeSliderEditable($(vid),$(rid)));

/* ─── Init ─── */
scenarios.push(defaultScenario('60mo Monthly @ 5%',5));
scenarios.push({...defaultScenario('36mo Monthly @ 7%',7),termPeriods:36,financeRate:7});
setupFmtInputs();renderScenarioList();rerender();
})();
