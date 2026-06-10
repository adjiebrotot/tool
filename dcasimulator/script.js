(function(){
'use strict';
// Watermark logo (logos/logo.svg), preloaded for use in canvas/SVG exports
const WM_LOGO_SRC = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDY4MCA2ODAiIHJvbGU9ImltZyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8dGl0bGU+QXJjaGVkIEEgTG9nbzwvdGl0bGU+CiAgPGRlc2M+QSBzbGVlayB3aGl0ZSBsZXR0ZXIgQSB3aG9zZSBsZWdzIGZvbGxvdyB0aGUgY2lyY2xlIGN1cnZhdHVyZSwgc3Bhbm5pbmcgODAlIG9mIHRoZSBjaXJjbGUgaGVpZ2h0PC9kZXNjPgoKICA8Y2lyY2xlIGN4PSIzNDAiIGN5PSIzNDAiIHI9IjMwMCIgZmlsbD0iIzAwNTJjYyIvPgoKICA8IS0tIExlZnQgbGVnOiAxMTPCsCB0byAyNDXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyNDIsNTcwIEEgMjUwLDI1MCAwIDAgMSAyMzQsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFRvcCBhcmNoOiAyNDXCsCB0byAyOTXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyMzQsMTEzIEEgMjUwLDI1MCAwIDAgMSA0NDYsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFJpZ2h0IGxlZzogMjk1wrAgdG8gNjfCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSA0NDYsMTEzIEEgMjUwLDI1MCAwIDAgMSA0MzgsNTcwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIENyb3NzYmFyIC0tPgogIDxsaW5lIHgxPSIxMTMiIHkxPSIzNTQiIHgyPSI1NjciIHkyPSIzNTQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNDIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K';
const wmLogoImg = new Image();
wmLogoImg.src = WM_LOGO_SRC;
const _wmMeasureCtx = document.createElement('canvas').getContext('2d');
function measureWmText(text, font){ _wmMeasureCtx.font = font; return _wmMeasureCtx.measureText(text).width; }

/* ─── CONSTANTS ─── */
const LINE_COLORS     = ['--line-a','--line-b','--line-c','--line-d','--line-e','--line-f'];
const LINE_COLOR_HEX  = ['#3b82f6','#ef4444','#22c55e','#f59e0b','#a855f7','#06b6d4'];
const COLOR_NAMES     = ['Blue','Red','Green','Gold','Purple','Cyan'];
const DATE_BASED_STYLES = ['monthly-date','weekly-day'];
const FORWARD_STYLES    = ['monthly-top','monthly-bottom','weekly-top','weekly-bottom'];
const MOMENTUM_STYLES   = ['momentum-peak','momentum-dip'];
const STYLE_ORDER = [...DATE_BASED_STYLES, ...FORWARD_STYLES, ...MOMENTUM_STYLES];
const WEEKDAY_OPTIONS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const DEFAULT_RANDOM_SEED = 25823952204;

/* ─── STATE ─── */
let securities = [];
let simResults = [];
let latestRows = [];
let priceChartInstance = null;
let equityChartInstance = null;
let sensitivityChartInstance = null;
let activeDetailSec = 0;
let showDeposited = true;
let currentCurrencySymbol = '$';
let secIdCounter = 0;
let runDebounceTimer = null;
let currentRandomSeed = DEFAULT_RANDOM_SEED;

/* ─── PRICE CACHE ─── */
// Keyed by ticker. Stores the widest date range ever fetched so simulations
// can filter from memory without re-fetching (only expand when needed).
let priceCache = {};
// { 'AAPL': { dates: [...], prices: [...], cachedStart: 'YYYY-MM-DD', cachedEnd: 'YYYY-MM-DD' } }
let tickerFetchInFlight = {};

/* ─── HELPERS ─── */
const $ = id => document.getElementById(id);
function cssVar(n){ return getComputedStyle(document.body).getPropertyValue(n).trim(); }
function getSecColor(sec){ return sec.colorHex || cssVar(sec.colorVar); }
function showStatus(el, msg, type){
  el.className = 'status-bar status-'+type;
  el.innerHTML = (type==='loading'?'<span class="spinner"></span>':'')+msg;
}
function hideStatus(el){ el.className='status-bar'; el.textContent=''; }

function scheduleRun(){ /* no-op – simulation is manual via ▶ Simulate */ }

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
    }
    inp.style.display='none';valSpan.style.display='';
  }
  inp.addEventListener('blur',commit);
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();inp.blur();}else if(e.key==='Escape'){inp.value='';commit();}});
}
function getActiveTab(){ const t=document.querySelector('.ctrl-tab.active'); return t?t.dataset.tab:'securities'; }
function updateSimBtn(){ const b=$('simBtn'); if(!b)return; b.textContent=getActiveTab()==='sensitivity'?'🔬 Analyse':'▶ Simulate'; }
function sanitizeSeed(v){
  const n = Number(v);
  if(!Number.isFinite(n)) return DEFAULT_RANDOM_SEED;
  return Math.floor(Math.abs(n));
}

const fmt = {
  currency(v, compact=false){
    const sym=currentCurrencySymbol;
    const n=Number(v||0), abs=Math.abs(n), sign=n<0?'−':'';
    if(compact&&abs>=1e9) return sign+sym+(abs/1e9).toFixed(2)+'b';
    if(compact&&abs>=1e6) return sign+sym+(abs/1e6).toFixed(2)+'m';
    if(compact&&abs>=1e3) return sign+sym+(abs/1e3).toFixed(0)+'k';
    return sign+sym+Math.round(abs).toLocaleString('en-US');
  },
  pct(v,d=2){ const n=Number(v||0); return (Math.abs(n)<=1?n*100:n).toFixed(d)+'%'; },
  num(v,d=0){ return Number(v||0).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}); },
  date(d){ return d instanceof Date ? d.toISOString().slice(0,10) : d; },
};

/* ─── DATE UTILS ─── */
function parseDate(s){ const [y,m,d]=s.split('-'); return new Date(+y,+m-1,+d); }
function addDays(d,n){ const r=new Date(d); r.setDate(r.getDate()+n); return r; }
function isoDate(d){ return d.toISOString().slice(0,10); }
function dayOfWeek(d){ return d.getDay(); } // 0=Sun
function getWeekdayInWeek(d, day){ // find given weekday (1=Mon..5=Fri) in the week of d
  const r=new Date(d);
  const dow=r.getDay()||7; // Mon=1..Sun=7
  const diff=(day)-(dow<=5?dow:5);
  r.setDate(r.getDate()+diff);
  return r;
}

/* ─── SIMULATED PRICE GENERATION (GBM) ─── */
function createSeededRng(seed){
  let state = seed >>> 0;
  if(state===0) state = 0x6d2b79f5;
  return function(){
    state |= 0;
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function deriveSeed(baseSeed, key=''){
  let h = (sanitizeSeed(baseSeed) >>> 0) || 0x811c9dc5;
  for(let i=0;i<key.length;i++){
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function generateGBMPrices(startDate, endDate, annualReturn, annualStd, startPrice=100, randomFn=Math.random){
  const dates=[];
  const prices=[];
  let d=new Date(startDate);
  const end=new Date(endDate);
  let price=startPrice;
  const dt=1/252;
  const mu=annualReturn/100;
  const sigma=annualStd/100;
  while(d<=end){
    const dow=d.getDay();
    if(dow!==0&&dow!==6){
      dates.push(isoDate(d));
      prices.push(price);
      // GBM step
      const z=(randomFn()*2-1)+(randomFn()*2-1)+(randomFn()*2-1); // approx normal
      price=price*Math.exp((mu-0.5*sigma*sigma)*dt+sigma*Math.sqrt(dt)*z);
    }
    d=addDays(d,1);
  }
  return {dates, prices};
}

/* ─── FETCH PROXY via Yahoo Finance (with proxy fallbacks) ─── */
async function fetchWithTimeout(url, timeoutMs=15000){
  const controller = new AbortController();
  const timeoutId = setTimeout(()=>controller.abort(), timeoutMs);
  try{
    const resp = await fetch(url, {signal: controller.signal, cache:'no-store'});
    return resp;
  } catch(err){
    if(err?.name === 'AbortError') throw new Error('signal timed out');
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchYahooFinance(ticker, startDate, endDate, onAttempt=null){
  const start=Math.floor(new Date(startDate).getTime()/1000);
  const end=Math.floor(new Date(endDate).getTime()/1000+86400);
  const cacheBuster=isoDate(new Date());
  const yfParams=`period1=${start}&period2=${end}&interval=1d&events=history&_cb=${cacheBuster}`;
  const yf1=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?${yfParams}`;
  const yf2=`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?${yfParams}`;
  const proxyCandidates = [
    {
      name: 'allorigins-raw/q1',
      url: `https://api.allorigins.win/raw?url=${encodeURIComponent(yf1)}`,
      parse: async resp => resp.json()
    },
    {
      name: 'corsproxy-io/q1',
      url: `https://corsproxy.io/?url=${encodeURIComponent(yf1)}`,
      parse: async resp => resp.json()
    },
    {
      name: 'allorigins-raw/q2',
      url: `https://api.allorigins.win/raw?url=${encodeURIComponent(yf2)}`,
      parse: async resp => resp.json()
    },
    {
      name: 'corsproxy-io/q2',
      url: `https://corsproxy.io/?url=${encodeURIComponent(yf2)}`,
      parse: async resp => resp.json()
    },
    {
      name: 'allorigins-get/q1',
      url: `https://api.allorigins.win/get?url=${encodeURIComponent(yf1)}`,
      parse: async resp => {
        const wrapper = await resp.json();
        return JSON.parse(wrapper.contents);
      }
    },
    {
      name: 'jina-ai/q1',
      url: `https://r.jina.ai/http://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?${yfParams}`,
      parse: async resp => {
        const txt = await resp.text();
        const jsonStart = txt.indexOf('{');
        return JSON.parse(jsonStart>=0 ? txt.slice(jsonStart) : txt);
      }
    }
  ];

  let data = null;
  let lastError = null;
  const total = proxyCandidates.length;
  for(let i=0; i<total; i++){
    const candidate = proxyCandidates[i];
    if(onAttempt) onAttempt(i+1, total, candidate.name);
    try{
      const resp = await fetchWithTimeout(candidate.url, 12000);
      if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
      data = await candidate.parse(resp);
      if(data?.chart?.result?.[0]) break;
      throw new Error('No chart result');
    }catch(err){
      lastError = err;
      data = null;
    }
  }
  if(!data) throw new Error(`Unable to fetch market data via proxy (${lastError?.message||'unknown error'})`);

  const result=data?.chart?.result?.[0];
  if(!result) throw new Error('No data returned for '+ticker);
  const timestamps=result.timestamp;
  const closes=result.indicators?.adjclose?.[0]?.adjclose || result.indicators?.quote?.[0]?.close;
  if(!timestamps||!closes) throw new Error('Invalid data structure');
  const dates=[], prices=[];
  for(let i=0;i<timestamps.length;i++){
    if(closes[i]==null) continue;
    dates.push(isoDate(new Date(timestamps[i]*1000)));
    prices.push(closes[i]);
  }
  if(!dates.length) throw new Error('No price data in range');
  return {dates, prices};
}

/* ─── SECURITY MANAGEMENT ─── */
function getColor(idx){ return LINE_COLORS[idx % LINE_COLORS.length]; }

function addSecurity(cfg){
  const id = ++secIdCounter;
  const colorIdx = securities.length % LINE_COLORS.length;
  securities.forEach(s => { s.open = false; });
  const sec = {
    id, colorVar: getColor(colorIdx), colorName: COLOR_NAMES[colorIdx],
    colorHex: cfg.colorHex || LINE_COLOR_HEX[colorIdx],
    type: cfg.type, ticker: cfg.ticker||'', name: cfg.name||cfg.ticker||'Custom',
    amount: 500, style: 'monthly-date', dayOrDate: 1,
    returnPct: 8, stdPct: 15,
    momentumPct: 5, momentumEOM: true,
    priceData: null, loaded: false, open: true,
    ...cfg
  };
  // Ensure colorHex from cfg overrides the default set above
  if(cfg.colorHex) sec.colorHex = cfg.colorHex;
  securities.push(sec);
  renderSecList();
  return sec;
}

function removeSecurity(id){
  securities = securities.filter(s=>s.id!==id);
  renderSecList();
}

function renderSecList(){
  const el=$('secList');
  if(!securities.length){
    el.innerHTML='<div style="color:var(--muted);font-size:.82rem;padding:8px 0">No securities added yet.</div>';
    return;
  }
  el.innerHTML='';
  securities.forEach((sec)=>{
    const card=document.createElement('div');
    card.className='sec-card';
    const dataBased=DATE_BASED_STYLES.map(s=>renderStyleOpt(sec,s)).join('');
    const forward=FORWARD_STYLES.map(s=>renderStyleOpt(sec,s)).join('');
    const momentumHtml=MOMENTUM_STYLES.map(s=>renderStyleOpt(sec,s)).join('');
    const isMomentum=MOMENTUM_STYLES.includes(sec.style);
    card.innerHTML=`
      <div class="sec-header" data-id="${sec.id}">
        <span class="color-dot" style="background:${getSecColor(sec)}"></span>
        <span class="sec-name">${sec.name}</span>
        <span class="sec-badge ${sec.type==='ticker'?'badge-ticker':'badge-custom'}">${sec.type==='ticker'?'📊 Ticker':'⚙️ Custom'}</span>
        <span style="color:var(--muted);font-size:.9rem">${sec.open?'▲':'▼'}</span>
      </div>
      <div class="sec-body ${sec.open?'open':''}" id="secBody${sec.id}">
        ${sec.type==='custom'?`
        <div class="sec-row">
          <label>Return (% p.a.) <span class="tip-icon" data-tip="Expected annual return used to generate a simulated price path via Geometric Brownian Motion.">?</span></label>
          <input class="num-input" id="secReturn${sec.id}" type="number" min="-50" max="200" step="0.5" value="${sec.returnPct}" style="max-width:80px"/>
        </div>
        <div class="sec-row">
          <label>Standard deviation (%) <span class="tip-icon" data-tip="Annual volatility (standard deviation). Higher values produce more volatile simulated paths.">?</span></label>
          <input class="num-input" id="secStd${sec.id}" type="number" min="0" max="200" step="0.5" value="${sec.stdPct}" style="max-width:80px"/>
        </div>`:
        `<div class="sec-row" style="align-items:center">
          <span style="font-size:.8rem;color:var(--muted)">Ticker: <strong style="color:var(--text)">${sec.ticker}</strong></span>
          <span class="status-bar ${sec.loaded?'status-ok':''}" style="display:inline-block;font-size:.75rem;padding:2px 8px;margin-left:4px" id="secLoadStatus${sec.id}">${sec.loaded?'✓ Loaded':'Not loaded'}</span>
        </div>`}
        <div class="sec-row">
          <label>Amount per invest <span class="tip-icon" data-tip="Fixed amount invested on each DCA purchase date.">?</span></label>
          <input class="num-input" id="secAmount${sec.id}" type="number" min="1" step="50" value="${sec.amount}" style="max-width:100px"/>
        </div>
        <div style="padding:6px 0 0">
          <div style="font-size:.8rem;font-weight:700;margin-bottom:6px">Investment Style</div>
          <div style="font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);margin:4px 0 4px;padding-bottom:3px;border-bottom:1px solid var(--border)">Date-Based</div>
          <div class="radio-group" style="margin-top:4px">${dataBased}</div>
          <div class="sec-row" id="secDayRow${sec.id}" style="${showDayRow(sec.style)?'':'display:none'}">
            <label id="secDayLabel${sec.id}">${sec.style==='monthly-date'?'Day of month':'Day of week'}</label>
            ${renderDaySelectorInner(sec)}
          </div>
          <div style="font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--accent2);margin:8px 0 4px;padding-bottom:3px;border-bottom:1px solid var(--border)">Momentum</div>
          <div class="radio-group" style="margin-top:4px">${momentumHtml}</div>
          <div id="secMomRow${sec.id}" style="${isMomentum?'':'display:none'}">
            <div style="padding:6px 0 2px">
              <div class="slider-head" style="margin-bottom:4px">
                <span style="font-size:.8rem;color:var(--muted);font-weight:700">Threshold</span>
                <span id="secMomPctVal${sec.id}" class="slider-value">${(+sec.momentumPct).toFixed(1)}%</span>
              </div>
              <input type="range" id="secMomPct${sec.id}" min="0.1" max="50" step="0.1" value="${sec.momentumPct}" style="width:100%;accent-color:var(--accent);cursor:pointer"/>
            </div>
            <label style="display:flex;align-items:center;gap:8px;font-size:.8rem;color:var(--muted);cursor:pointer;padding:2px 0 6px">
              <input type="checkbox" id="secMomEOM${sec.id}" ${sec.momentumEOM?'checked':''} style="accent-color:var(--accent);cursor:pointer;width:14px;height:14px;flex-shrink:0"/>
              Invest at End of Month if target not reached
            </label>
          </div>
          <!-- NOTE: Forward-Looking must always remain at the bottom when new Investment Styles are added -->
          <div style="font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--gold);margin:8px 0 4px;padding-bottom:3px;border-bottom:1px solid var(--border)">Forward-Looking <span class="tip-icon warn" data-tip="⚠️ For demonstration only. These strategies use prices within the period to pick the buy date — they require future knowledge and cannot be replicated in real life.">!</span></div>
          <div class="radio-group" style="margin-top:4px">${forward}</div>
        </div>
        <button class="sec-del" id="secDel${sec.id}" style="margin-top:8px">🗑 Remove</button>
      </div>`;
    el.appendChild(card);

    // Accordion: only one sec-body open at a time
    card.querySelector('.sec-header').addEventListener('click',()=>{
      const willOpen=!sec.open;
      if(willOpen){
        securities.forEach(s=>{
          if(s.id!==sec.id && s.open){
            s.open=false;
            const b=$('secBody'+s.id); if(b) b.classList.remove('open');
            const h=document.querySelector(`.sec-header[data-id="${s.id}"] span:last-child`);
            if(h) h.textContent='▼';
          }
        });
      }
      sec.open=willOpen;
      card.querySelector('.sec-body').classList.toggle('open',sec.open);
      card.querySelector('.sec-header span:last-child').textContent=sec.open?'▲':'▼';
    });
    $(`secDel${sec.id}`).addEventListener('click',()=>{ removeSecurity(sec.id); scheduleRun(); });
    $(`secAmount${sec.id}`).addEventListener('input',e=>{ sec.amount=parseFloat(e.target.value)||100; scheduleRun(); });
    if(sec.type==='custom'){
      $(`secReturn${sec.id}`).addEventListener('input',e=>{ sec.returnPct=parseFloat(e.target.value)||8; scheduleRun(); });
      $(`secStd${sec.id}`).addEventListener('input',e=>{ sec.stdPct=parseFloat(e.target.value)||15; scheduleRun(); });
    }
    // Style radios
    card.querySelectorAll(`input[name="secStyle${sec.id}"]`).forEach(r=>{
      r.addEventListener('change',()=>{
        card.querySelectorAll('.radio-opt').forEach(o=>o.classList.remove('selected'));
        r.closest('.radio-opt').classList.add('selected');
        sec.style=r.value;
        const dayRow=$(`secDayRow${sec.id}`);
        const momRow=$(`secMomRow${sec.id}`);
        sec.dayOrDate=1;
        dayRow.style.display=showDayRow(sec.style)?'':'none';
        if(momRow) momRow.style.display=MOMENTUM_STYLES.includes(sec.style)?'':'none';
        if(showDayRow(sec.style)){
          $(`secDayLabel${sec.id}`).textContent=sec.style==='monthly-date'?'Day of month':'Day of week';
          const old=dayRow.querySelector('input[type=number],select');
          if(old) old.remove();
          dayRow.insertAdjacentHTML('beforeend', renderDaySelectorInner(sec));
          wireDayInput(sec);
        }
        updateSensSecurityDropdown();
        scheduleRun();
      });
    });
    wireDayInput(sec);
    // Momentum controls
    const momPctEl=$(`secMomPct${sec.id}`);
    const momPctValEl=$(`secMomPctVal${sec.id}`);
    const momEOMEl=$(`secMomEOM${sec.id}`);
    if(momPctEl){
      momPctEl.addEventListener('input',e=>{
        sec.momentumPct=parseFloat(e.target.value)||5;
        if(momPctValEl) momPctValEl.textContent=(+sec.momentumPct).toFixed(1)+'%';
        scheduleRun();
      });
      makeSliderEditable(momPctValEl,momPctEl);
    }
    if(momEOMEl){
      momEOMEl.addEventListener('change',e=>{ sec.momentumEOM=e.target.checked; scheduleRun(); });
    }
  });
  // Update color picker default to the next available slot
  const cp=$('newSecColor');
  if(cp) cp.value = LINE_COLOR_HEX[securities.length % LINE_COLOR_HEX.length];
  updateSensSecurityDropdown();
}

function renderStyleOpt(sec,s){
  return `<label class="radio-opt${sec.style===s?' selected':''}" id="secStyleOpt${sec.id}_${s.replace(/-/g,'_')}">
    <input type="radio" name="secStyle${sec.id}" value="${s}" ${sec.style===s?'checked':''}/>
    <div class="radio-opt-text"><strong>${styleLabel(s)}</strong>${styleDesc(s)}</div>
  </label>`;
}

function renderDaySelectorInner(sec){
  if(sec.style==='weekly-day')
    return `<select class="txt-input" id="secDay${sec.id}" style="max-width:170px">${WEEKDAY_OPTIONS.map((d,i)=>`<option value="${i+1}" ${Math.min(7,Math.max(1,sec.dayOrDate))===i+1?'selected':''}>${d}</option>`).join('')}</select>`;
  if(sec.style==='monthly-date')
    return `<input class="num-input" id="secDay${sec.id}" type="number" min="1" max="31" step="1" value="${Math.min(31,Math.max(1,sec.dayOrDate||1))}" style="max-width:80px"/>`;
  return '';
}

function wireDayInput(sec){
  const el=$(`secDay${sec.id}`); if(!el) return;
  ['input','change'].forEach(ev=>el.addEventListener(ev,e=>{ sec.dayOrDate=parseInt(e.target.value)||1; scheduleRun(); }));
}

function renderDaySelector(sec){ return renderDaySelectorInner(sec); }

function styleLabel(s){
  return {'monthly-date':'Monthly (Fixed Date)','monthly-top':'Monthly (Top)','monthly-bottom':'Monthly (Bottom)',
          'weekly-day':'Weekly (Fixed Day)','weekly-top':'Weekly (Top)','weekly-bottom':'Weekly (Bottom)',
          'momentum-peak':'Buy the Peak','momentum-dip':'Buy the Dip'}[s]||s;
}
function styleDesc(s){
  return {'monthly-date':'Buy on a specific day each month.',
          'monthly-top':'Buy on the highest price day of the month.',
          'monthly-bottom':'Buy on the lowest price day of the month.',
          'weekly-day':'Buy on a chosen weekday each week.',
          'weekly-top':'Buy on the peak price day of the week.',
          'weekly-bottom':'Buy on the lowest price day of the week.',
          'momentum-peak':'Invest after an upside of X% from month start.',
          'momentum-dip':'Invest after a downside of X% from month start.'}[s]||'';
}
function showDayRow(s){ return s==='monthly-date'||s==='weekly-day'; }

/* ─── FETCH TICKER DATA ─── */

/* ─── PRICE CACHE HELPERS ─── */
// Ensures priceCache[ticker] covers [requestedStart, requestedEnd].
// Fetches only when the cache is absent or the range must be expanded.
// Returns true on success, throws on failure.
async function ensureTickerCached(ticker, requestedStart, requestedEnd, onAttempt=null){
  const tk = String(ticker||'').trim().toUpperCase();
  if(!tk) throw new Error('Invalid ticker');
  const entry = priceCache[tk];
  if(entry && entry.coverageStart <= requestedStart && entry.coverageEnd >= requestedEnd){
    return; // Cache already covers the full requested range — no fetch needed
  }
  if(tickerFetchInFlight[tk]){
    await tickerFetchInFlight[tk];
    return;
  }
  tickerFetchInFlight[tk] = (async()=>{
    const latestEntry = priceCache[tk];
    if(latestEntry && latestEntry.coverageStart <= requestedStart && latestEntry.coverageEnd >= requestedEnd){
      return;
    }
    const fetchStart = latestEntry ? (latestEntry.coverageStart < requestedStart ? latestEntry.coverageStart : requestedStart) : requestedStart;
    const fetchEnd   = latestEntry ? (latestEntry.coverageEnd   > requestedEnd   ? latestEntry.coverageEnd   : requestedEnd)   : requestedEnd;
    const data = await fetchYahooFinance(tk, fetchStart, fetchEnd, onAttempt);
    if(!data.dates.length) throw new Error('No price data in range');
    priceCache[tk] = {
      dates: data.dates,
      prices: data.prices,
      cachedStart: data.dates[0],
      cachedEnd: data.dates[data.dates.length - 1],
      coverageStart: fetchStart,
      coverageEnd: fetchEnd
    };
  })();
  try{
    await tickerFetchInFlight[tk];
  } finally {
    delete tickerFetchInFlight[tk];
  }
}

// Returns a {dates, prices} slice from the cache filtered to [startDate, endDate].
function getCachedPriceSlice(ticker, startDate, endDate){
  const tk = String(ticker||'').trim().toUpperCase();
  const entry = priceCache[tk];
  if(!entry) return null;
  const si = entry.dates.findIndex(d => d >= startDate);
  const ei = entry.dates.findLastIndex(d => d <= endDate);
  if(si < 0 || ei < 0 || si > ei) return null;
  return { dates: entry.dates.slice(si, ei + 1), prices: entry.prices.slice(si, ei + 1) };
}

function isTickerRangeCovered(ticker, startDate, endDate){
  const tk = String(ticker||'').trim().toUpperCase();
  const entry = priceCache[tk];
  return !!(entry && entry.coverageStart <= startDate && entry.coverageEnd >= endDate);
}

/* ─── FETCH TICKER DATA (for manual "Add Security" flow) ─── */
async function loadTickerData(sec, startDate, endDate){
  const statusEl = $(`secLoadStatus${sec.id}`);
  const covered = isTickerRangeCovered(sec.ticker, startDate, endDate);
  if(covered){
    showStatus($('fetchStatus'), 'Using cached '+sec.ticker+'...','loading');
  } else {
    showStatus($('fetchStatus'), 'Fetching '+sec.ticker+'...','loading');
  }
  try {
    await ensureTickerCached(sec.ticker, startDate, endDate, (attempt, total) => {
      showStatus($('fetchStatus'), `Fetching ${sec.ticker}... (${attempt}/${total})`,'loading');
    });
    sec.loaded = true;
    const entry = priceCache[String(sec.ticker).trim().toUpperCase()];
    if(statusEl){ statusEl.className='status-bar status-ok'; statusEl.textContent='✓ Loaded'; }
    showStatus($('fetchStatus'), sec.ticker+' cached: '+entry.dates.length+' trading days','ok');
    return true;
  } catch(e){
    sec.loaded = false;
    if(statusEl){ statusEl.className='status-bar status-error'; statusEl.textContent='✗ Failed'; }
    showStatus($('fetchStatus'),'Failed to load '+sec.ticker+': '+e.message,'error');
    return false;
  }
}

/* ─── ADD SECURITY BUTTON ─── */
$('addSecBtn').addEventListener('click', async()=>{
  const name = $('newSecName').value.trim();
  const type = document.querySelector('input[name="newSecType"]:checked')?.value || 'custom';
  const colorHex = $('newSecColor').value;

  if(type === 'ticker'){
    const ticker = $('tickerInput').value.trim().toUpperCase();
    if(!ticker){ showStatus($('fetchStatus'),'Please enter a ticker symbol.','error'); return; }
    // Same ticker can appear multiple times (different strategies on the same security).
    // Price data is shared via priceCache, so no duplicate-data cost.
    const sec = addSecurity({type:'ticker', ticker, name: name||ticker, colorHex});
    $('newSecName').value=''; $('tickerInput').value='';
    const sd=$('startDate').value||'2020-01-01';
    const ed=$('endDate').value||isoDate(new Date());
    await loadTickerData(sec, sd, ed);
    renderSecList();
  } else {
    if(!name){ showStatus($('fetchStatus'),'Please enter a security name.','error'); return; }
    addSecurity({type:'custom', name, colorHex});
    $('newSecName').value='';
  }
  scheduleRun();
});

$('tickerInput').addEventListener('keydown',e=>{ if(e.key==='Enter') $('addSecBtn').click(); });
$('newSecName').addEventListener('keydown',e=>{ if(e.key==='Enter') $('addSecBtn').click(); });

// Toggle ticker input visibility based on type selection
document.querySelectorAll('input[name="newSecType"]').forEach(r=>{
  r.addEventListener('change',()=>{
    $('tickerInputRow').style.display = r.value==='ticker' ? '' : 'none';
    document.querySelectorAll('#typeOptCustom,#typeOptTicker').forEach(o=>o.classList.remove('selected'));
    r.closest('.radio-opt').classList.add('selected');
  });
});

/* ─── CURRENCY CHANGE ─── */
$('currencySymbol').addEventListener('change',e=>{
  currentCurrencySymbol=e.target.value;
  if(simResults.length){ updateTables(); updateEquityChart(); }
});
$('randomSeed').addEventListener('input',e=>{
  currentRandomSeed = sanitizeSeed(e.target.value);
  scheduleRun();
});

/* ─── DEFAULT DATE RANGE ─── */
(function initDates(){
  const end=new Date();
  const start=new Date(); start.setFullYear(start.getFullYear()-5);
  $('startDate').value=isoDate(start);
  $('endDate').value=isoDate(end);
})();

/* ─── SIMULATION ENGINE ─── */
function getInvestmentDates(priceData, style, dayOrDate, momentumPct=5, momentumEOM=true){
  const {dates, prices} = priceData;
  const dateIndex = {};
  dates.forEach((d,i)=>dateIndex[d]=i);
  const result=[]; // indices into priceData where purchase happens

  if(style==='monthly-date'){
    // Group by year-month, find closest trading day to dayOrDate
    const months={};
    dates.forEach((d,i)=>{ const ym=d.slice(0,7); if(!months[ym])months[ym]=[]; months[ym].push(i); });
    Object.values(months).forEach(idxs=>{
      const target=dayOrDate;
      // find closest index
      let best=idxs[0];
      idxs.forEach(i=>{
        const day=parseInt(dates[i].slice(8,10));
        if(Math.abs(day-target)<Math.abs(parseInt(dates[best].slice(8,10))-target)) best=i;
      });
      result.push(best);
    });
  } else if(style==='monthly-top'){
    const months={};
    dates.forEach((d,i)=>{ const ym=d.slice(0,7); if(!months[ym])months[ym]=[]; months[ym].push(i); });
    Object.values(months).forEach(idxs=>{
      let best=idxs[0];
      idxs.forEach(i=>{ if(prices[i]>prices[best]) best=i; });
      result.push(best);
    });
  } else if(style==='monthly-bottom'){
    const months={};
    dates.forEach((d,i)=>{ const ym=d.slice(0,7); if(!months[ym])months[ym]=[]; months[ym].push(i); });
    Object.values(months).forEach(idxs=>{
      let best=idxs[0];
      idxs.forEach(i=>{ if(prices[i]<prices[best]) best=i; });
      result.push(best);
    });
  } else if(style==='weekly-day'){
    // Group by ISO week, find closest day
    const weeks={};
    dates.forEach((d,i)=>{
      const dt=parseDate(d);
      const y=dt.getFullYear(), doy=Math.floor((dt-new Date(y,0,1))/86400000);
      const wk=Math.floor((doy+new Date(y,0,1).getDay())/7);
      const key=y+'-'+String(wk).padStart(2,'0');
      if(!weeks[key]) weeks[key]=[];
      weeks[key].push(i);
    });
    const targetDow=Math.min(7,Math.max(1,dayOrDate)); // 1=Mon..7=Sun (nearest trading day)
    Object.values(weeks).forEach(idxs=>{
      let best=idxs[0];
      idxs.forEach(i=>{
        const dow=parseDate(dates[i]).getDay()||7;
        const bestDow=parseDate(dates[best]).getDay()||7;
        if(Math.abs(dow-targetDow)<Math.abs(bestDow-targetDow)) best=i;
      });
      result.push(best);
    });
  } else if(style==='weekly-top'){
    const weeks={};
    dates.forEach((d,i)=>{
      const dt=parseDate(d);
      const y=dt.getFullYear(), doy=Math.floor((dt-new Date(y,0,1))/86400000);
      const wk=Math.floor((doy+new Date(y,0,1).getDay())/7);
      const key=y+'-'+String(wk).padStart(2,'0');
      if(!weeks[key]) weeks[key]=[];
      weeks[key].push(i);
    });
    Object.values(weeks).forEach(idxs=>{
      let best=idxs[0];
      idxs.forEach(i=>{ if(prices[i]>prices[best]) best=i; });
      result.push(best);
    });
  } else if(style==='weekly-bottom'){
    const weeks={};
    dates.forEach((d,i)=>{
      const dt=parseDate(d);
      const y=dt.getFullYear(), doy=Math.floor((dt-new Date(y,0,1))/86400000);
      const wk=Math.floor((doy+new Date(y,0,1).getDay())/7);
      const key=y+'-'+String(wk).padStart(2,'0');
      if(!weeks[key]) weeks[key]=[];
      weeks[key].push(i);
    });
    Object.values(weeks).forEach(idxs=>{
      let best=idxs[0];
      idxs.forEach(i=>{ if(prices[i]<prices[best]) best=i; });
      result.push(best);
    });
  } else if(style==='momentum-peak'||style==='momentum-dip'){
    const months={};
    dates.forEach((d,i)=>{ const ym=d.slice(0,7); if(!months[ym])months[ym]=[]; months[ym].push(i); });
    const threshold=(momentumPct||5)/100;
    Object.values(months).forEach(idxs=>{
      const refPrice=prices[idxs[0]];
      let invested=false;
      for(const i of idxs){
        const p=prices[i];
        if(style==='momentum-peak'&&p>=refPrice*(1+threshold)){
          result.push(i); invested=true; break;
        } else if(style==='momentum-dip'&&p<=refPrice*(1-threshold)){
          result.push(i); invested=true; break;
        }
      }
      if(!invested&&momentumEOM) result.push(idxs[idxs.length-1]);
    });
  }

  // Remove duplicates, sort
  return [...new Set(result)].sort((a,b)=>a-b);
}

function simulateSecurity(sec){
  const {dates, prices} = sec.priceData;
  const investIdxs = getInvestmentDates(sec.priceData, sec.style, sec.dayOrDate, sec.momentumPct, sec.momentumEOM);
  const investSet = new Set(investIdxs);

  let totalUnits=0, totalDeposited=0;
  const rows=[];

  // Build a running state over all trading days
  const investRows=[];
  for(let i=0;i<dates.length;i++){
    if(investSet.has(i)){
      const price=prices[i];
      const units=sec.amount/price;
      totalUnits+=units;
      totalDeposited+=sec.amount;
      investRows.push({
        date:dates[i], price, amountInvested:sec.amount, unitsAdded:units,
        totalUnits, totalDeposited, equity:totalUnits*price,
        returnPct:(totalUnits*price-totalDeposited)/totalDeposited*100
      });
    }
  }

  // Also daily equity for chart
  let runUnits=0, runDeposited=0;
  const dailyRows=[];
  let secInvestIdx=0;
  for(let i=0;i<dates.length;i++){
    if(investSet.has(i)){
      runUnits+=sec.amount/prices[i];
      runDeposited+=sec.amount;
    }
    dailyRows.push({
      date:dates[i], price:prices[i],
      totalUnits:runUnits, totalDeposited:runDeposited,
      equity:runUnits*prices[i]
    });
  }

  return { investRows, dailyRows, finalEquity: runUnits*(prices[prices.length-1]||1), totalDeposited:runDeposited };
}

/* ─── RUN SIMULATION ─── */
async function runSimulation(){
  if(!securities.length){
    showWarning('Add at least one security to run simulation.');
    return;
  }

  const startDate=$('startDate').value;
  const endDate=$('endDate').value;
  if(!startDate||!endDate){ showWarning('Please set start and end dates.'); return; }

  const simBtn=$('simBtn');
  simBtn.disabled=true;
  simBtn.innerHTML='<span class="spinner"></span>Running…';

  try{
  showStatus($('fetchStatus'),'Preparing simulation...','loading');

  // Reset stale data before rebuilding this run.
  securities.forEach(sec => { sec.priceData = null; sec.loaded = false; });

  // Ensure ticker data once per unique ticker.
  const uniqueTickers = [...new Set(securities
    .filter(sec => sec.type==='ticker')
    .map(sec => String(sec.ticker||'').trim().toUpperCase())
    .filter(Boolean))];
  for(const ticker of uniqueTickers){
    const needsFetch = !isTickerRangeCovered(ticker, startDate, endDate);
    if(needsFetch) showStatus($('fetchStatus'),'Fetching '+ticker+'...','loading');
    try {
      await ensureTickerCached(ticker, startDate, endDate, (attempt, total) => {
        showStatus($('fetchStatus'), `Fetching ${ticker}... (${attempt}/${total})`,'loading');
      });
    } catch(e){
      showWarning('Could not load data for '+ticker+': '+e.message);
    }
  }

  // Prepare price data for every security.
  // Custom: regenerate GBM for the requested range (cheap, deterministic).
  // Ticker: assign cached slice for the selected range.
  for(const sec of securities){
    if(sec.type==='custom'){
      const secSeed = deriveSeed(currentRandomSeed, `${sec.name}|${sec.returnPct}|${sec.stdPct}|${sec.amount}|${sec.style}|${sec.dayOrDate}`);
      const secRng = createSeededRng(secSeed);
      sec.priceData = generateGBMPrices(startDate, endDate, sec.returnPct, sec.stdPct, 100, secRng);
      sec.loaded=true;
    } else {
      const statusEl = $(`secLoadStatus${sec.id}`);
      const slice = getCachedPriceSlice(sec.ticker, startDate, endDate);
      if(!slice){ showWarning('No data in selected range for '+sec.ticker+'.'); continue; }
      sec.priceData = slice;
      sec.loaded = true;
      if(statusEl){ statusEl.className='status-bar status-ok'; statusEl.textContent='✓ Loaded'; }
    }
  }

  // Find common date range
  const loadedSecs = securities.filter(s=>s.priceData&&s.priceData.dates.length);
  if(!loadedSecs.length){ showWarning('No securities with data loaded.'); return; }

  const latestStart = loadedSecs.map(s=>s.priceData.dates[0]).sort().pop();
  const earliestEnd = loadedSecs.map(s=>s.priceData.dates[s.priceData.dates.length-1]).sort()[0];

  if(latestStart>=earliestEnd){ showWarning('No overlapping date range between securities.'); return; }

  // Trim all to common range
  for(const sec of loadedSecs){
    const {dates,prices}=sec.priceData;
    const si=dates.findIndex(d=>d>=latestStart);
    const ei=dates.findLastIndex(d=>d<=earliestEnd);
    if(si<0||ei<0) continue;
    sec.priceData={dates:dates.slice(si,ei+1), prices:prices.slice(si,ei+1)};
  }

  showStatus($('dateRangeStatus'),`Date range: ${latestStart} → ${earliestEnd}`,'ok');

  // Run simulations
  simResults=[];
  for(const sec of loadedSecs){
    try {
      const res=simulateSecurity(sec);
      simResults.push({sec, ...res});
    } catch(e){
      console.error('Sim error for '+sec.name, e);
    }
  }

  if(!simResults.length){ showWarning('Simulation produced no results.'); return; }

  hideStatus($('fetchStatus'));
  updatePriceChart();
  updateEquityChart();
  updateTables();
  } finally {
    simBtn.disabled=false;
    updateSimBtn();
  }
}

/* ─── PRICE CHART ─── */
function updatePriceChart(){
  if(!simResults.length) return;
  const allDates=simResults[0].dailyRows.map(r=>r.date);
  const legendEl=$('priceLegend'); legendEl.innerHTML='';
  const hiddenSeries=new Set();
  const gridColor=cssVar('--chart-grid'), mutedColor=cssVar('--chart-text'), textColor=cssVar('--text');

  // Deduplicate by ticker: for fetched securities show one line per unique ticker symbol.
  const seenTickers=new Set();
  const uniqueResults=simResults.filter(res=>{
    const key=res.sec.type==='ticker' ? res.sec.ticker.toUpperCase() : null;
    if(key===null) return true; // custom assets always shown
    if(seenTickers.has(key)) return false;
    seenTickers.add(key);
    return true;
  });

  const datasets=uniqueResults.map((res,idx)=>{
    const first=res.dailyRows[0]?.price||1;
    const color=getSecColor(res.sec);
    // For ticker securities use the ticker symbol as the label, not the scenario name
    const label=res.sec.type==='ticker' ? res.sec.ticker.toUpperCase() : res.sec.name;
    const item=document.createElement('div');
    item.className='legend-item';
    item.innerHTML=`<span class="dot" style="background:${color}"></span><span>${label}</span>`;
    item.addEventListener('click',()=>{
      if(hiddenSeries.has(idx)) hiddenSeries.delete(idx); else hiddenSeries.add(idx);
      item.classList.toggle('hidden',hiddenSeries.has(idx));
      if(priceChartInstance){ priceChartInstance.setDatasetVisibility(idx,!hiddenSeries.has(idx)); priceChartInstance.update(); }
    });
    legendEl.appendChild(item);
    return { label, data:res.dailyRows.map(r=>r.price/first*100),
      borderColor:color, backgroundColor:color+'22', borderWidth:2.5, pointRadius:0, pointHoverRadius:5, tension:0.2, fill:false };
  });

  const yCallback=val=>fmt.num(val,1)+'%';
  const tooltipLabel=ctx=>`  ${ctx.dataset.label}: ${fmt.num(ctx.parsed.y,2)}%`;

  function buildPriceOpts(){ return {
    responsive:true, maintainAspectRatio:false, animation:{duration:300}, interaction:{mode:'index',intersect:false},
    plugins:{ legend:{display:false}, tooltip:{
      callbacks:{ title:ctx=>ctx[0]?.label||'', label:tooltipLabel,
        afterBody(items){ if(items.length) $('priceHoverBox').textContent=`${items[0].label}  —  `+items.map(i=>`${i.dataset.label}: ${fmt.num(i.parsed.y,2)}%`).join('  |  '); }},
      backgroundColor:cssVar('--panel')||'#11172a', titleColor:textColor, bodyColor:mutedColor, borderColor:gridColor, borderWidth:1, padding:10},
      zoom:{pan:{enabled:true,mode:'x'},zoom:{wheel:{enabled:true,speed:.08},pinch:{enabled:true},mode:'x'}}},
    scales:{ x:{title:{display:true,text:'Date',color:mutedColor,font:{family:'inherit',size:11}},ticks:{color:mutedColor,maxTicksLimit:12,font:{family:'inherit',size:11},callback:v=>allDates[Number(v)]?.slice(0,7)||''},grid:{color:gridColor}},
              y:{title:{display:true,text:'Normalised Price (base 100)',color:mutedColor,font:{family:'inherit',size:11}},ticks:{color:mutedColor,font:{family:'inherit',size:11},callback:yCallback},grid:{color:gridColor}}}
  };}

  if(priceChartInstance){
    priceChartInstance.data.labels=allDates; priceChartInstance.data.datasets=datasets;
    priceChartInstance.options.scales.x.ticks.color=mutedColor; priceChartInstance.options.scales.x.grid.color=gridColor;
    priceChartInstance.options.scales.x.ticks.callback=v=>allDates[Number(v)]?.slice(0,7)||'';
    priceChartInstance.options.scales.x.title.color=mutedColor;
    priceChartInstance.options.scales.y.ticks.color=mutedColor; priceChartInstance.options.scales.y.grid.color=gridColor;
    priceChartInstance.options.scales.y.title.color=mutedColor;
    priceChartInstance.update('none');
  } else {
    priceChartInstance=new Chart($('priceCanvas'),{type:'line',data:{labels:allDates,datasets},options:buildPriceOpts()});
  }
}

/* ─── EQUITY CHART ─── */
function updateEquityChart(){
  if(!simResults.length) return;
  const allDates=simResults[0].dailyRows.map(r=>r.date);
  const legendEl=$('equityLegend'); legendEl.innerHTML='';
  const gridColor=cssVar('--chart-grid'), mutedColor=cssVar('--chart-text'), textColor=cssVar('--text');
  const dsIndexMap={};
  const datasets=[];

  simResults.forEach((res,idx)=>{
    const color=getSecColor(res.sec);
    dsIndexMap[idx]={equity:datasets.length};
    datasets.push({ label:res.sec.name+' Equity', data:res.dailyRows.map(r=>r.equity),
      borderColor:color, backgroundColor:color+'22', borderWidth:2.5, pointRadius:0, pointHoverRadius:5,
      tension:0.2, fill:false, _secIdx:idx, _type:'equity' });
    dsIndexMap[idx].deposit=datasets.length;
    datasets.push({ label:res.sec.name+' Deposited', data:res.dailyRows.map(r=>r.totalDeposited),
      borderColor:color, backgroundColor:'transparent', borderWidth:1.5, pointRadius:0, pointHoverRadius:4,
      tension:0.2, fill:false, borderDash:[5,4], _secIdx:idx, _type:'deposit' });

    const item=document.createElement('div');
    item.className='legend-item';
    item.innerHTML=`<span class="dot" style="background:${color}"></span><span>${res.sec.name}</span>`;
    item.addEventListener('click',()=>{
      if(!equityChartInstance) return;
      const visible=equityChartInstance.isDatasetVisible(dsIndexMap[idx].equity);
      equityChartInstance.setDatasetVisibility(dsIndexMap[idx].equity,!visible);
      if(showDeposited) equityChartInstance.setDatasetVisibility(dsIndexMap[idx].deposit,!visible);
      item.classList.toggle('hidden',visible);
      equityChartInstance.update();
    });
    legendEl.appendChild(item);
  });

  const yCallback=val=>fmt.currency(val,true);
  const tooltipLabel=ctx=>equityChartInstance&&!equityChartInstance.isDatasetVisible(ctx.datasetIndex)?null:`  ${ctx.dataset.label}: ${fmt.currency(ctx.parsed.y,true)}`;

  function buildEquityOpts(){ return {
    responsive:true, maintainAspectRatio:false, animation:{duration:300}, interaction:{mode:'index',intersect:false},
    plugins:{ legend:{display:false}, tooltip:{
      filter:item=>equityChartInstance?equityChartInstance.isDatasetVisible(item.datasetIndex):true,
      callbacks:{ title:ctx=>ctx[0]?.label||'', label:ctx=>`  ${ctx.dataset.label}: ${fmt.currency(ctx.parsed.y,true)}`,
        afterBody(items){ if(items.length) $('equityHoverBox').textContent=`${items[0].label}  —  `+items.map(i=>`${i.dataset.label}: ${fmt.currency(i.parsed.y,true)}`).join('  |  '); }},
      backgroundColor:cssVar('--panel')||'#11172a', titleColor:textColor, bodyColor:mutedColor, borderColor:gridColor, borderWidth:1, padding:10},
      zoom:{pan:{enabled:true,mode:'x'},zoom:{wheel:{enabled:true,speed:.08},pinch:{enabled:true},mode:'x'}}},
    scales:{ x:{title:{display:true,text:'Date',color:mutedColor,font:{family:'inherit',size:11}},ticks:{color:mutedColor,maxTicksLimit:12,font:{family:'inherit',size:11},callback:v=>allDates[Number(v)]?.slice(0,7)||''},grid:{color:gridColor}},
              y:{title:{display:true,text:'Portfolio Value ('+currentCurrencySymbol+')',color:mutedColor,font:{family:'inherit',size:11}},ticks:{color:mutedColor,font:{family:'inherit',size:11},callback:yCallback},grid:{color:gridColor}}}
  };}

  if(equityChartInstance){
    equityChartInstance.data.labels=allDates; equityChartInstance.data.datasets=datasets;
    equityChartInstance.options.scales.x.ticks.color=mutedColor; equityChartInstance.options.scales.x.grid.color=gridColor;
    equityChartInstance.options.scales.x.ticks.callback=v=>allDates[Number(v)]?.slice(0,7)||'';
    equityChartInstance.options.scales.x.title.color=mutedColor;
    equityChartInstance.options.scales.y.ticks.color=mutedColor; equityChartInstance.options.scales.y.grid.color=gridColor;
    equityChartInstance.options.scales.y.ticks.callback=yCallback;
    equityChartInstance.options.scales.y.title.color=mutedColor;
    equityChartInstance.options.scales.y.title.text='Portfolio Value ('+currentCurrencySymbol+')';
    equityChartInstance.update('none');
    // re-apply deposited visibility
    datasets.forEach((ds,i)=>{ if(ds._type==='deposit') equityChartInstance.setDatasetVisibility(i,showDeposited); });
    equityChartInstance.update();
  } else {
    equityChartInstance=new Chart($('equityCanvas'),{type:'line',data:{labels:allDates,datasets},options:buildEquityOpts()});
    datasets.forEach((ds,i)=>{ if(ds._type==='deposit') equityChartInstance.setDatasetVisibility(i,showDeposited); });
    equityChartInstance.update();
  }
}

$('priceResetZoom').addEventListener('click',()=>{ if(priceChartInstance) priceChartInstance.resetZoom(); });
$('equityResetZoom').addEventListener('click',()=>{ if(equityChartInstance) equityChartInstance.resetZoom(); });
$('priceCanvas').addEventListener('mouseleave',()=>{ $('priceHoverBox').textContent='Hover to inspect data points.'; });
$('equityCanvas').addEventListener('mouseleave',()=>{ $('equityHoverBox').textContent='Hover to inspect data points.'; });

$('showDepositedToggle').addEventListener('change',e=>{
  showDeposited=e.target.checked;
  if(equityChartInstance&&simResults.length){
    equityChartInstance.data.datasets.forEach((ds,i)=>{ if(ds._type==='deposit') equityChartInstance.setDatasetVisibility(i,showDeposited); });
    equityChartInstance.update();
  }
});

/* ─── TABLES ─── */
function updateTables(){
  if(!simResults.length) return;

  // Summary grid
  const sg=$('summaryGrid');
  sg.innerHTML='';
  simResults.forEach(res=>{
    const roi=(res.finalEquity-res.totalDeposited)/res.totalDeposited;
    sg.innerHTML+=`
      <div class="tile" style="border-left:3px solid ${getSecColor(res.sec)}">
        <div class="label">${res.sec.name}</div>
        <div class="value">${fmt.currency(res.finalEquity,true)}</div>
        <div style="font-size:.75rem;color:var(--muted);margin-top:3px">ROI: ${fmt.pct(roi)} | Dep: ${fmt.currency(res.totalDeposited,true)}</div>
        <div style="font-size:.75rem;color:var(--muted)">Trades: ${res.investRows.length}</div>
      </div>`;
  });

  // Milestone table
  const allDates=simResults[0].dailyRows.map(r=>r.date);
  const totalDays=allDates.length;
  const milestoneIdxs=[0,
    Math.floor(totalDays*.1),Math.floor(totalDays*.2),Math.floor(totalDays*.3),
    Math.floor(totalDays*.5),Math.floor(totalDays*.7),Math.floor(totalDays*.9),totalDays-1
  ].filter((v,i,a)=>a.indexOf(v)===i);

  const thead=$('milestoneTable').querySelector('thead tr');
  thead.innerHTML=`<th>Period</th><th>Date</th>`+simResults.map(r=>`<th>${r.sec.name} Equity</th><th>ROI</th>`).join('');

  const tbody=$('milestoneBody');
  tbody.innerHTML='';
  milestoneIdxs.forEach(idx=>{
    const date=allDates[idx];
    const pct=Math.round(idx/(totalDays-1)*100);
    let row=`<td>${pct}%</td><td>${date}</td>`;
    simResults.forEach(res=>{
      const d=res.dailyRows[idx]||res.dailyRows[res.dailyRows.length-1];
      const roi=d.totalDeposited>0?(d.equity-d.totalDeposited)/d.totalDeposited:0;
      row+=`<td>${fmt.currency(d.equity,true)}</td><td style="color:${roi>=0?'var(--positive)':'var(--negative)'}">${fmt.pct(roi)}</td>`;
    });
    tbody.innerHTML+=`<tr>${row}</tr>`;
  });

  // Detail tabs
  const tabs=$('detailTabs');
  tabs.innerHTML='';
  simResults.forEach((res,i)=>{
    const btn=document.createElement('button');
    btn.className='tab-btn'+(i===activeDetailSec?' active':'');
    btn.textContent=res.sec.name;
    btn.addEventListener('click',()=>{
      tabs.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      activeDetailSec=i;
      renderDetailTable(i);
    });
    tabs.appendChild(btn);
  });
  renderDetailTable(activeDetailSec<simResults.length?activeDetailSec:0);

  latestRows=simResults[0].dailyRows;
}

function renderDetailTable(idx){
  const res=simResults[idx];
  if(!res) return;
  const tbody=$('detailBody');
  tbody.innerHTML='';
  res.investRows.forEach(r=>{
    const color=r.returnPct>=0?'var(--positive)':'var(--negative)';
    tbody.innerHTML+=`<tr>
      <td>${r.date}</td>
      <td>${fmt.currency(r.price)}</td>
      <td>${fmt.currency(r.amountInvested)}</td>
      <td>${r.unitsAdded.toFixed(6)}</td>
      <td>${r.totalUnits.toFixed(6)}</td>
      <td>${fmt.currency(r.equity)}</td>
      <td style="color:${color}">${fmt.pct(r.returnPct/100)}</td>
    </tr>`;
  });
  if(!res.investRows.length) tbody.innerHTML='<tr><td colspan="7" style="color:var(--muted);text-align:center;padding:20px">No investment dates in range.</td></tr>';
}

/* ─── THEME TOGGLE ─── */
$('themeToggle').addEventListener('click',()=>{
  document.body.classList.toggle('light');
  $('themeToggle').textContent=document.body.classList.contains('light')?'🌙 Dark':'☀️ Light';
  if(simResults.length){ updatePriceChart(); updateEquityChart(); }
  if(sensitivityChartInstance){ sensitivityChartInstance.destroy(); sensitivityChartInstance=null; }
  renderSecList();
});

/* ─── SIMULATE / ANALYSE BUTTON ─── */
$('simBtn').addEventListener('click', ()=>{
  if(getActiveTab()==='sensitivity') runSensitivityAnalysis();
  else runSimulation();
});

/* ─── RESET ─── */
$('resetBtn').addEventListener('click',()=>{
  securities=[]; simResults=[]; latestRows=[]; priceCache={}; tickerFetchInFlight={};
  secIdCounter=0;
  currentCurrencySymbol='$';
  currentRandomSeed=DEFAULT_RANDOM_SEED;
  if(priceChartInstance){ priceChartInstance.destroy(); priceChartInstance=null; }
  if(equityChartInstance){ equityChartInstance.destroy(); equityChartInstance=null; }
  if(sensitivityChartInstance){ sensitivityChartInstance.destroy(); sensitivityChartInstance=null; }
  $('sensitivitySection').style.display='none';
  renderSecList();
  $('summaryGrid').innerHTML='';
  $('milestoneBody').innerHTML='<tr><td colspan="8" style="color:var(--muted);text-align:center;padding:20px">Add securities to see milestones.</td></tr>';
  $('detailBody').innerHTML='<tr><td colspan="7" style="color:var(--muted);text-align:center;padding:20px">Add securities to see detailed data.</td></tr>';
  $('detailTabs').innerHTML='';
  $('priceLegend').innerHTML=''; $('equityLegend').innerHTML='';
  $('priceHoverBox').textContent='Add securities and run to view price data.';
  $('equityHoverBox').textContent='Add securities and run to view equity data.';
  $('currencySymbol').value='$';
  $('randomSeed').value=DEFAULT_RANDOM_SEED;
  hideStatus($('fetchStatus')); hideStatus($('dateRangeStatus')); hideWarning();
  initializeDefaultSecurities();
  runSimulation();
});

/* ─── DOWNLOAD CHART PNG ─── */
function downloadChartPng(canvasId, filename, chartTitle, legendId, shouldDownload = true) {
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

  // Collect visible legend items from HTML legend element
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
    const wmText = 'Made using tool.adjiebrotots.com/dcasimulator';
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

function downloadChartSvg(canvasId, filename, chartTitle, legendId, legendItemsOverride) {
  const src = document.getElementById(canvasId);
  if(!src) return;
  const dpr = window.devicePixelRatio || 1;
  const chartW = Math.round(src.width / dpr);
  const chartH = Math.round(src.height / dpr);
  const isLight = document.body.classList.contains('light');
  const bgColor = isLight ? '#ffffff' : '#0F1728';
  const fgColor = isLight ? '#2D3436' : '#EAF1FF';
  const FONT = 'DM Sans, sans-serif';
  const legendItems = legendItemsOverride ? legendItemsOverride.slice() : [];
  if(!legendItemsOverride && legendId){
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
  wm.textContent = 'Made using tool.adjiebrotots.com/dcasimulator'; svg.appendChild(wm);
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
$('pricePngBtn').addEventListener('click', () => downloadChartPng('priceCanvas', 'dca_price_chart.png', 'DCA Scenario Explorer — Security Prices (Normalised to 100)', 'priceLegend'));
$('priceCopyPngBtn').addEventListener('click', async () => {
  try { await copyCanvasPngToClipboard(downloadChartPng('priceCanvas', 'dca_price_chart.png', 'DCA Scenario Explorer — Security Prices (Normalised to 100)', 'priceLegend', false)); alert('PNG copied to clipboard.'); }
  catch(err){ alert('PNG copy failed: ' + err.message); }
});
$('equityPngBtn').addEventListener('click', () => downloadChartPng('equityCanvas', 'dca_portfolio_chart.png', 'DCA Scenario Explorer — Portfolio Value', 'equityLegend'));
$('equityCopyPngBtn').addEventListener('click', async () => {
  try { await copyCanvasPngToClipboard(downloadChartPng('equityCanvas', 'dca_portfolio_chart.png', 'DCA Scenario Explorer — Portfolio Value', 'equityLegend', false)); alert('PNG copied to clipboard.'); }
  catch(err){ alert('PNG copy failed: ' + err.message); }
});
$('sensPngBtn').addEventListener('click', () => {
  const subtitle = document.getElementById('sensChartSubtitle')?.textContent || 'Sensitivity Analysis';
  downloadChartPng('sensCanvas', 'dca_sensitivity_chart.png', 'DCA Sensitivity Analysis — ' + subtitle, null);
});
$('sensCopyPngBtn').addEventListener('click', async () => {
  const subtitle = document.getElementById('sensChartSubtitle')?.textContent || 'Sensitivity Analysis';
  try { await copyCanvasPngToClipboard(downloadChartPng('sensCanvas', 'dca_sensitivity_chart.png', 'DCA Sensitivity Analysis — ' + subtitle, null, false)); alert('PNG copied to clipboard.'); }
  catch(err){ alert('PNG copy failed: ' + err.message); }
});
$('priceSvgBtn').addEventListener('click', () => downloadChartSvg('priceCanvas', 'dca_price_chart.svg', 'DCA Scenario Explorer — Security Prices (Normalised to 100)', 'priceLegend'));
$('equitySvgBtn').addEventListener('click', () => downloadChartSvg('equityCanvas', 'dca_portfolio_chart.svg', 'DCA Scenario Explorer — Portfolio Value', 'equityLegend'));
$('sensSvgBtn').addEventListener('click', () => {
  const subtitle = document.getElementById('sensChartSubtitle')?.textContent || 'Sensitivity Analysis';
  downloadChartSvg('sensCanvas', 'dca_sensitivity_chart.svg', 'DCA Sensitivity Analysis — ' + subtitle, null);
});

/* ─── DOWNLOAD CSV (Detailed Breakdown of active tab) ─── */
$('downloadBtn').addEventListener('click',()=>{
  if(!simResults.length){ showWarning('Run simulation first.'); return; }
  const idx=activeDetailSec<simResults.length?activeDetailSec:0;
  const res=simResults[idx]; if(!res) return;
  const headers=['Date','Price','Amount_Invested','Units_Added','Total_Units','Equity','Return_Pct'];
  const lines=res.investRows.map(r=>[r.date,r.price.toFixed(4),r.amountInvested.toFixed(2),
    r.unitsAdded.toFixed(6),r.totalUnits.toFixed(6),r.equity.toFixed(2),r.returnPct.toFixed(2)].join(','));
  const csv='# Made using tool.adjiebrotots.com/dcasimulator\n'+[headers.join(','),...lines].join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  a.download=`dca_${res.sec.name.replace(/[^a-z0-9]/gi,'_')}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
});

/* ─── WARNINGS ─── */
function showWarning(msg){ const w=$('mainWarning'); w.style.display='block'; w.textContent=msg; }
function hideWarning(){ const w=$('mainWarning'); w.style.display='none'; }

/* ─── GLOBAL TOOLTIP ─── */
(function initTooltip(){
  const tt=document.createElement('div');
  tt.id='globalTooltip';
  tt.innerHTML='<div class="tt-text"></div><div class="tt-arrow"></div>';
  document.body.appendChild(tt);
  const ttText=tt.querySelector('.tt-text');
  const ttArrow=tt.querySelector('.tt-arrow');
  const PAD=8;
  document.addEventListener('mouseover',e=>{
    const icon=e.target.closest('[data-tip]');
    if(!icon){hide();return;}
    const tip=icon.getAttribute('data-tip');
    if(!tip){hide();return;}
    ttText.textContent=tip;
    tt.classList.remove('flip-below');
    tt.style.display='block'; tt.style.opacity='0';
    const rect=icon.getBoundingClientRect();
    const ttW=tt.offsetWidth, ttH=tt.offsetHeight;
    const iconCX=rect.left+rect.width/2;
    let top=rect.top-ttH-10, left=iconCX-ttW/2;
    if(top<PAD){top=rect.bottom+10;tt.classList.add('flip-below');}
    left=Math.max(PAD,Math.min(left,window.innerWidth-ttW-PAD));
    top=Math.max(PAD,Math.min(top,window.innerHeight-ttH-PAD));
    tt.style.left=left+'px'; tt.style.top=top+'px'; tt.style.opacity='1';
    const arrowX=Math.max(10,Math.min(iconCX-left,ttW-10));
    ttArrow.style.left=arrowX+'px';
  });
  document.addEventListener('mouseout',e=>{
    const icon=e.target.closest('[data-tip]');
    if(!icon)return;
    if(!e.relatedTarget||!icon.contains(e.relatedTarget))hide();
  });
  function hide(){tt.style.display='none';}
})();

/* ─── SENSITIVITY ANALYSIS ─── */
function updateSensSecurityDropdown(){
  const sel=$('sensSecurity');
  if(!sel) return;
  const prevId=sel.value;
  sel.innerHTML='';
  if(!securities.length){
    sel.innerHTML='<option value="">— Add securities first —</option>';
    const si=$('sensStyleInfo'); if(si) si.style.display='none';
    const tr=$('sensThresholdRange'); if(tr) tr.style.display='none';
    return;
  }
  securities.forEach(sec=>{
    const opt=document.createElement('option');
    opt.value=sec.id;
    opt.textContent=sec.name+' ('+styleLabel(sec.style)+')';
    sel.appendChild(opt);
  });
  if(prevId && securities.find(s=>s.id==prevId)) sel.value=prevId;
  updateSensStyleInfo();
}

function updateSensStyleInfo(){
  const sel=$('sensSecurity');
  const infoEl=$('sensStyleInfo');
  const threshEl=$('sensThresholdRange');
  if(!sel||!sel.value){ if(infoEl)infoEl.style.display='none'; if(threshEl)threshEl.style.display='none'; return; }
  const sec=securities.find(s=>s.id==sel.value);
  if(!sec){ if(infoEl)infoEl.style.display='none'; if(threshEl)threshEl.style.display='none'; return; }
  const style=sec.style;
  const isMomentum=MOMENTUM_STYLES.includes(style);
  if(style==='monthly-date'){
    infoEl.textContent='Sweeps Day of Month (1 – 28) and shows final portfolio value for each day.';
    infoEl.style.display=''; threshEl.style.display='none';
  } else if(style==='weekly-day'){
    infoEl.textContent='Sweeps Day of Week (Monday – Friday) and shows final portfolio value for each day.';
    infoEl.style.display=''; threshEl.style.display='none';
  } else if(isMomentum){
    infoEl.textContent='Sweeps Threshold (%) across the Start–End range and shows final portfolio value for each level.';
    infoEl.style.display=''; threshEl.style.display='';
  } else {
    infoEl.textContent='Sensitivity is not applicable for "'+styleLabel(style)+'". Use Monthly (Fixed Date), Weekly (Fixed Day), Buy the Peak, or Buy the Dip.';
    infoEl.style.display=''; threshEl.style.display='none';
  }
}

function calcFinalEquityForParams(priceData, style, dayOrDate, momentumPct, momentumEOM, amount){
  const idxs=getInvestmentDates(priceData, style, dayOrDate, momentumPct, momentumEOM);
  if(!idxs.length) return 0;
  let units=0;
  idxs.forEach(i=>{ units+=amount/priceData.prices[i]; });
  return units*priceData.prices[priceData.prices.length-1];
}

async function runSensitivityAnalysis(){
  const sel=$('sensSecurity');
  if(!sel||!sel.value){ showStatus($('sensStatus'),'Select a security first.','error'); return; }
  const sec=securities.find(s=>s.id==sel.value);
  if(!sec){ showStatus($('sensStatus'),'Security not found.','error'); return; }

  const style=sec.style;
  const isMomentum=MOMENTUM_STYLES.includes(style);
  const isWeekly=style==='weekly-day';
  const isMonthly=style==='monthly-date';
  if(!isMomentum&&!isWeekly&&!isMonthly){
    showStatus($('sensStatus'),'Sensitivity not applicable for "'+styleLabel(style)+'".','error'); return;
  }

  const startDate=$('startDate').value||isoDate(new Date(Date.now()-5*365*24*3600*1000));
  const endDate=$('endDate').value||isoDate(new Date());
  const simBtn=$('simBtn');
  simBtn.disabled=true;
  simBtn.innerHTML='<span class="spinner"></span>Analysing…';
  showStatus($('sensStatus'),'Preparing price data...','loading');

  try{
    let priceData;
    if(sec.type==='ticker'){
      try{
        await ensureTickerCached(sec.ticker, startDate, endDate, (attempt, total)=>{
          showStatus($('sensStatus'),`Fetching ${sec.ticker}... (${attempt}/${total})`,'loading');
        });
        priceData=getCachedPriceSlice(sec.ticker, startDate, endDate);
        if(!priceData) throw new Error('No data in selected range');
      }catch(e){
        showStatus($('sensStatus'),'Failed to load '+sec.ticker+': '+e.message,'error'); return;
      }
    } else {
      const secSeed=deriveSeed(currentRandomSeed,`${sec.name}|${sec.returnPct}|${sec.stdPct}|${sec.amount}|${sec.style}|${sec.dayOrDate}`);
      const secRng=createSeededRng(secSeed);
      priceData=generateGBMPrices(startDate, endDate, sec.returnPct, sec.stdPct, 100, secRng);
    }

    if(!priceData||!priceData.prices.length){ showStatus($('sensStatus'),'No price data available.','error'); return; }
    showStatus($('sensStatus'),'Running analysis...','loading');

    const labels=[], values=[];
    if(isMonthly){
      for(let d=1;d<=28;d++){
        labels.push('Day '+d);
        values.push(calcFinalEquityForParams(priceData, style, d, sec.momentumPct, sec.momentumEOM, sec.amount));
      }
    } else if(isWeekly){
      const dayNames=['Mon','Tue','Wed','Thu','Fri'];
      for(let d=1;d<=5;d++){
        labels.push(dayNames[d-1]);
        values.push(calcFinalEquityForParams(priceData, style, d, sec.momentumPct, sec.momentumEOM, sec.amount));
      }
    } else if(isMomentum){
      const sv=Math.max(0.1,parseFloat($('sensThreshStart').value)||1);
      const ev=Math.min(50,parseFloat($('sensThreshEnd').value)||20);
      const step=Math.max(0.1,parseFloat($('sensThreshStep').value)||1);
      if(sv>=ev){ showStatus($('sensStatus'),'Start Value must be less than End Value.','error'); return; }
      const numSteps=Math.round((ev-sv)/step);
      for(let i=0;i<=numSteps;i++){
        const t=Math.round((sv+i*step)*10)/10;
        labels.push(t+'%');
        values.push(calcFinalEquityForParams(priceData, style, sec.dayOrDate, t, sec.momentumEOM, sec.amount));
      }
    }

    if(!labels.length){ showStatus($('sensStatus'),'No data to display.','error'); return; }

    const subtitle=sec.name+' — '+styleLabel(style)+'  |  '+startDate+' → '+endDate;
    renderSensitivityChart(sec, labels, values, subtitle);
    hideStatus($('sensStatus'));
  } finally {
    simBtn.disabled=false;
    updateSimBtn();
  }
}

function renderSensitivityChart(sec, labels, values, subtitle){
  const section=$('sensitivitySection');
  section.style.display='';
  $('sensChartSubtitle').textContent=subtitle;

  const color=getSecColor(sec);
  const gridColor=cssVar('--chart-grid');
  const mutedColor=cssVar('--chart-text');
  const textColor=cssVar('--text');
  const maxVal=Math.max(...values);
  const bgColors=values.map(v=>Math.abs(v-maxVal)<0.01?color+'EE':color+'55');
  const borderColors=values.map(v=>Math.abs(v-maxVal)<0.01?color:color+'99');

  const dataset={
    label:'Final Portfolio Value',
    data:values,
    backgroundColor:bgColors,
    borderColor:borderColors,
    borderWidth:1.5,
    borderRadius:5
  };

  const yTickCb=val=>fmt.currency(val,true);

  if(sensitivityChartInstance){
    sensitivityChartInstance.data.labels=labels;
    sensitivityChartInstance.data.datasets=[dataset];
    sensitivityChartInstance.options.scales.x.ticks.color=mutedColor;
    sensitivityChartInstance.options.scales.x.grid.color=gridColor;
    sensitivityChartInstance.options.scales.x.title.color=mutedColor;
    sensitivityChartInstance.options.scales.y.ticks.color=mutedColor;
    sensitivityChartInstance.options.scales.y.grid.color=gridColor;
    sensitivityChartInstance.options.scales.y.title.color=mutedColor;
    sensitivityChartInstance.options.scales.y.title.text='Final Portfolio Value ('+currentCurrencySymbol+')';
    sensitivityChartInstance.options.scales.y.ticks.callback=yTickCb;
    sensitivityChartInstance.update();
  } else {
    sensitivityChartInstance=new Chart($('sensCanvas'),{
      type:'bar',
      data:{labels,datasets:[dataset]},
      options:{
        responsive:true, maintainAspectRatio:false, animation:{duration:400},
        plugins:{
          legend:{display:false},
          tooltip:{
            callbacks:{
              label:ctx=>'  Final Value: '+fmt.currency(ctx.parsed.y),
              afterBody:items=>{ if(items.length) $('sensHoverBox').textContent=items[0].label+': '+fmt.currency(items[0].parsed.y); }
            },
            backgroundColor:cssVar('--panel')||'#11172a',
            titleColor:textColor, bodyColor:mutedColor,
            borderColor:gridColor, borderWidth:1, padding:10
          }
        },
        scales:{
          x:{title:{display:true,text:'Scenario Value',color:mutedColor,font:{family:'inherit',size:11}},ticks:{color:mutedColor,font:{family:'inherit',size:11}},grid:{color:gridColor}},
          y:{title:{display:true,text:'Final Portfolio Value ('+currentCurrencySymbol+')',color:mutedColor,font:{family:'inherit',size:11}},ticks:{color:mutedColor,font:{family:'inherit',size:11},callback:yTickCb},grid:{color:gridColor},beginAtZero:false}
        }
      }
    });
  }
  // scroll into view
  section.scrollIntoView({behavior:'smooth',block:'nearest'});
}

$('sensSecurity').addEventListener('change', updateSensStyleInfo);

/* ─── CTRL TABS ─── */
document.querySelectorAll('.ctrl-tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.ctrl-tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.ctrl-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    $('tab-'+btn.dataset.tab).classList.add('active');
    updateSimBtn();
  });
});

/* ─── INIT: Add default securities ─── */
function initializeDefaultSecurities(){
  addSecurity({type:'custom',name:'S&P500',returnPct:10,stdPct:18,amount:500,style:'monthly-date',dayOrDate:1});
  addSecurity({type:'custom',name:'Risk-Free 5%',returnPct:5,stdPct:0.5,amount:500,style:'monthly-date',dayOrDate:1});
}

initializeDefaultSecurities();
runSimulation();

})();
