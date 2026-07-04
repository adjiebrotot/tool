(function(){'use strict';
/* ═══ STATE ═══════════════════════════════════════════════════════ */
let csvRows=null, lhsMap={}, rhsMap={}, genDataMap={}, results=[], demand=1500;
let csvOk=false, genOk=false, xlsxOk=false;

/* Constraint-invocation filter reference data + persistent selections.
   The three filters mirror wemulator-lite: a constraint equation is active
   only when its Constraint Set is invoked (NIL is the base set, always on),
   and the active pool can be narrowed by constraint (limit) type and by
   contingency.  Selection Sets survive search/re-render.                 */
let ALL_SETS=[], ALL_LIMITS=[], ALL_CONTS=[], CONTS_BY_SET={};
const SEL_SETS=new Set(), SEL_LIMITS=new Set(), SEL_CONTS=new Set();
let persist=null, cachedSel=null, cacheApplied=false; // mini cache

/* ═══ DOM ═════════════════════════════════════════════════════════ */
const $=id=>document.getElementById(id);
const E={
  xlsxInput:$('xlsxInput'), xlsxName:$('xlsxName'),
  demandInp:$('demandInp'),
  setSearch:$('setSearch'), setList:$('setList'), setIdCount:$('setIdCount'),
  setAll:$('setAll'), setNone:$('setNone'),
  limitList:$('limitList'), limitCount:$('limitCount'),
  limitAll:$('limitAll'), limitNone:$('limitNone'),
  contSearch:$('contSearch'), contList:$('contList'), contCount:$('contCount'),
  contAll:$('contAll'), contNone:$('contNone'),
  invokeSummary:$('invokeSummary'),
  checkBtn:$('checkBtn'),
  resultsArea:$('resultsArea'), emptyState:$('emptyState'), dlBtn:$('dlBtn'),
  spCsv:$('spCsv'), spGen:$('spGen'), spXlsx:$('spXlsx'),
  kpiBalance:$('kpiBalance'), kpiBalanceSub:$('kpiBalanceSub'),
  kpiViol:$('kpiViol'), kpiPass:$('kpiPass'), kpiTotal:$('kpiTotal'),
  kpiWorst:$('kpiWorst'), kpiContLbl:$('kpiContLbl'),
  banner:$('banner'), violBadge:$('violBadge'), passBadge:$('passBadge'),
  violBody:$('violBody'), passBody2:$('passBody2'), violEmpty:$('violEmpty'),
  violFilter:$('violFilter'), passFilter:$('passFilter'),
  passToggle:$('passToggle'), passBodyEl:$('passBody'),
  themeBtn:$('themeBtn'),
};

/* ═══ HELPERS ═════════════════════════════════════════════════════ */
const f2=v=>(+v||0).toFixed(2);
const f4=v=>(+v||0).toFixed(4);
const sgn=v=>(v>=0?'+':'−')+f2(Math.abs(v));
function pill(el,cls,html){el.className='sp '+cls;el.innerHTML='<span class="d"></span>'+html;}

/* ═══ CSV — Constraint Equations ══════════════════════════════════ */
async function fetchCsv(){
  pill(E.spCsv,'in','Loading constraints…');
  try{
    const r=await fetch('./Constraint_Equations.csv');
    if(!r.ok) throw new Error('HTTP '+r.status);
    parseCsv(await r.text());
  }catch(e){
    pill(E.spCsv,'wn','CSV not auto-loaded — ');
    const lbl=document.createElement('label');
    lbl.className='fallback-inp'; lbl.textContent='📁 Upload CSV';
    const inp=document.createElement('input');
    inp.type='file'; inp.accept='.csv'; inp.style.display='none';
    inp.onchange=ev=>{if(!ev.target.files[0])return;
      const fr=new FileReader(); fr.onload=fe=>parseCsv(fe.target.result);
      fr.readAsText(ev.target.files[0]);};
    lbl.appendChild(inp); E.spCsv.appendChild(lbl);
  }
}
function parseCsv(txt){
  Papa.parse(txt,{header:true,skipEmptyLines:true,complete:r=>{
    csvRows=dedupe(r.data); csvOk=true;
    const ids=new Set(csvRows.map(r=>r['Constraint Equation ID'])).size;
    const sets=new Set(csvRows.map(r=>setId(r)).filter(Boolean)).size;
    pill(E.spCsv,'ok',`✓ ${ids} equations · ${sets} constraint sets`);
    buildFilters();
  },error:e=>pill(E.spCsv,'er','CSV error: '+e.message)});
}
/* One row per (equation, constraint set) membership.
   A single equation can belong to several constraint sets, so the dedup
   key is (Constraint Equation ID, Constraint Set ID) — NOT the ID alone.
   Deduping by ID would collapse an equation to one set and drop it from
   every other set it is active in.  (ID,Set) collisions are content-
   identical in the source, so keeping the first is safe.                */
function dedupe(rows){
  const m={};
  for(const r of rows){
    const id=r['Constraint Equation ID'];
    if(!id) continue;
    const key=id+' | '+(r['Constraint Set ID']||'').trim();
    if(!(key in m)) m[key]=r;
  }
  return Object.values(m);
}

/* ═══ Generator Data ══════════════════════════════════════════════ */
async function fetchGenData(){
  pill(E.spGen,'in','Loading generator data…');
  try{
    const r=await fetch('./Generator_Data.csv');
    if(!r.ok) throw new Error('HTTP '+r.status);
    parseGenData(await r.text());
  }catch(e){
    pill(E.spGen,'wn','Generator_Data.csv not found — ');
    const lbl=document.createElement('label');
    lbl.className='fallback-inp'; lbl.textContent='📁 Upload Generator_Data.csv';
    const inp=document.createElement('input');
    inp.type='file'; inp.accept='.csv'; inp.style.display='none';
    inp.onchange=ev=>{if(!ev.target.files[0])return;
      const fr=new FileReader(); fr.onload=fe=>parseGenData(fe.target.result);
      fr.readAsText(ev.target.files[0]);};
    lbl.appendChild(inp); E.spGen.appendChild(lbl);
  }
}
function parseGenData(txt){
  Papa.parse(txt,{header:true,skipEmptyLines:true,complete:r=>{
    genDataMap={};
    for(const row of r.data){
      if(!row.Parameter) continue;
      genDataMap[row.Parameter.trim()]={min:parseFloat(row.Min)||0,max:parseFloat(row.Max)||0};
    }
    genOk=true;
    pill(E.spGen,'ok',`✓ ${Object.keys(genDataMap).length} generator limits loaded`);
  },error:e=>pill(E.spGen,'er','Gen data error: '+e.message)});
}

/* ═══ XLSX ════════════════════════════════════════════════════════ */
function handleXlsx(file){
  const fr=new FileReader();
  fr.onload=e=>{
    try{
      const wb=XLSX.read(e.target.result,{type:'binary'});
      buildMaps(wb); xlsxOk=true;
      E.xlsxName.textContent=file.name;
      pill(E.spXlsx,'ok',`✓ ${Object.keys(lhsMap).length} generator dispatches loaded`);
      const dk='forecast.energy-forecastOperationalDemand-expected';
      if(rhsMap[dk]!==undefined){demand=rhsMap[dk];E.demandInp.value=demand;}
    }catch(err){pill(E.spXlsx,'er','XLSX error: '+err.message);}
  };
  fr.readAsBinaryString(file);
}
function buildMaps(wb){
  lhsMap={}; rhsMap={};
  if(wb.Sheets['LHS'])
    for(const r of XLSX.utils.sheet_to_json(wb.Sheets['LHS']))
      if(r.Parameter){const v=parseFloat(r.Value);if(!isNaN(v))lhsMap[String(r.Parameter).trim()]=v;}
  if(wb.Sheets['RHS'])
    for(const r of XLSX.utils.sheet_to_json(wb.Sheets['RHS']))
      if(r.Parameter){const v=parseFloat(r.Value);if(!isNaN(v))rhsMap[String(r.Parameter).trim()]=v;}
}

/* ═══ CONSTRAINT-INVOCATION FILTERS ═══════════════════════════════
   A constraint equation is ACTIVATED when its Constraint Set is invoked.
   The control room invokes the relevant set(s); every equation belonging
   to an invoked set becomes active.  Equations with no Constraint Set ID
   belong to no set and are therefore never active.

   This mirrors wemulator-lite: multiple sets can be invoked at once (NIL is
   the base set and is always active), and the active pool can be narrowed
   further by constraint (limit) type and by contingency.  An equation is
   checked only when ALL THREE hold:
       set ∈ selected sets   AND   limit type ∈ selected types
                             AND   contingency ∈ selected contingencies
   Constraint type and contingency default to ALL selected, so by default
   nothing is filtered out of the invoked sets.
════════════════════════════════════════════════════════════════════ */
const setId  =r=>(r['Constraint Set ID']||'').trim();
const limitOf=r=>(r['Limit Type']||'').trim()||'Other';
const contOf =r=>(r['Contingency']||'').trim()||'NIL';

function buildFilters(){
  // ── Reference lists derived from the loaded equations ──
  const setSeen=new Set(), limitSeen=new Set(), contSeen=new Set();
  CONTS_BY_SET={};
  for(const r of csvRows){
    const s=setId(r), lt=limitOf(r), c=contOf(r);
    if(s){setSeen.add(s); (CONTS_BY_SET[s]||(CONTS_BY_SET[s]=new Set())).add(c);}
    else (CONTS_BY_SET['']||(CONTS_BY_SET['']=new Set())).add(c);
    limitSeen.add(lt); contSeen.add(c);
  }
  // Sets: NIL first, then alphabetical (blank set IDs are never invocable).
  ALL_SETS=[...setSeen].sort((a,b)=>a==='NIL'?-1:b==='NIL'?1:a.localeCompare(b));
  ALL_LIMITS=[...limitSeen].sort();
  ALL_CONTS=[...contSeen].sort((a,b)=>a==='NIL'?-1:b==='NIL'?1:a.localeCompare(b));

  // ── Defaults: NIL set invoked; all types + all contingencies selected ──
  SEL_SETS.clear(); SEL_SETS.add('NIL');
  SEL_LIMITS.clear(); ALL_LIMITS.forEach(l=>SEL_LIMITS.add(l));
  SEL_CONTS.clear(); ALL_CONTS.forEach(c=>SEL_CONTS.add(c));

  // Mini cache: on the very first load, replace the defaults with the user's
  // previously saved selection (filtered to what this dataset still contains).
  if(cachedSel && !cacheApplied){
    cacheApplied=true;
    const keep=(arr,all)=>Array.isArray(arr)?arr.filter(x=>all.includes(x)):null;
    const s=keep(cachedSel.sets,ALL_SETS), l=keep(cachedSel.limits,ALL_LIMITS), c=keep(cachedSel.conts,ALL_CONTS);
    if(s&&s.length){ SEL_SETS.clear(); SEL_SETS.add('NIL'); s.forEach(x=>SEL_SETS.add(x)); }
    if(l&&l.length){ SEL_LIMITS.clear(); l.forEach(x=>SEL_LIMITS.add(x)); }
    if(c&&c.length){ SEL_CONTS.clear(); c.forEach(x=>SEL_CONTS.add(x)); }
  }

  renderSetList(); renderLimitList(); renderContList(); updateSummary();
}

/* ── Constraint Set list (multi-select; NIL forced on) ── */
function renderSetList(){
  const q=(E.setSearch.value||'').toLowerCase();
  const items=q?ALL_SETS.filter(s=>s.toLowerCase().includes(q)):ALL_SETS;
  E.setList.innerHTML='';
  if(!items.length){E.setList.innerHTML='<span class="chk-empty">No matching sets</span>';}
  const frag=document.createDocumentFragment();
  for(const s of items){
    const isNil=s==='NIL';
    const lbl=document.createElement('label'); if(isNil)lbl.className='nil';
    const chk=document.createElement('input');
    chk.type='checkbox'; chk.value=s;
    chk.checked=SEL_SETS.has(s)||isNil; chk.disabled=isNil;
    if(isNil) SEL_SETS.add('NIL');
    chk.onchange=()=>{
      if(chk.checked){
        SEL_SETS.add(s);
        // Auto-select the contingencies that belong to this newly invoked set.
        (CONTS_BY_SET[s]||[]).forEach(c=>SEL_CONTS.add(c));
      } else SEL_SETS.delete(s);
      renderContList(); updateSetCount(); updateContCount(); updateSummary();
    };
    lbl.appendChild(chk);
    lbl.appendChild(document.createTextNode(' '+s+`  (${(CONTS_BY_SET[s]||new Set()).size?countEq(s):0})`));
    frag.appendChild(lbl);
  }
  E.setList.appendChild(frag);
  updateSetCount();
}
function countEq(s){let n=0;for(const r of csvRows)if(setId(r)===s)n++;return n;}
function updateSetCount(){E.setIdCount.textContent=`${SEL_SETS.size} selected`;}

/* ── Constraint Type list (inline checkboxes) ── */
function renderLimitList(){
  E.limitList.innerHTML='';
  const frag=document.createDocumentFragment();
  for(const lt of ALL_LIMITS){
    const lbl=document.createElement('label');
    const chk=document.createElement('input');
    chk.type='checkbox'; chk.value=lt; chk.checked=SEL_LIMITS.has(lt);
    chk.onchange=()=>{chk.checked?SEL_LIMITS.add(lt):SEL_LIMITS.delete(lt);updateLimitCount();updateSummary();};
    lbl.appendChild(chk); lbl.appendChild(document.createTextNode(' '+lt));
    frag.appendChild(lbl);
  }
  E.limitList.appendChild(frag);
  updateLimitCount();
}
function updateLimitCount(){E.limitCount.textContent=`${SEL_LIMITS.size} selected`;}

/* ── Contingency list (pool follows the invoked sets) ── */
function visibleConts(){
  const vis=new Set();
  for(const s of SEL_SETS)(CONTS_BY_SET[s]||[]).forEach(c=>vis.add(c));
  return ALL_CONTS.filter(c=>vis.has(c));
}
function renderContList(){
  const q=(E.contSearch.value||'').toLowerCase();
  let pool=visibleConts();
  if(q) pool=pool.filter(c=>c.toLowerCase().includes(q));
  E.contList.innerHTML='';
  if(!pool.length){E.contList.innerHTML='<span class="chk-empty">No contingencies for the invoked sets</span>';updateContCount();return;}
  const frag=document.createDocumentFragment();
  for(const c of pool){
    const lbl=document.createElement('label');
    const chk=document.createElement('input');
    chk.type='checkbox'; chk.value=c; chk.checked=SEL_CONTS.has(c);
    chk.onchange=()=>{chk.checked?SEL_CONTS.add(c):SEL_CONTS.delete(c);updateContCount();updateSummary();};
    lbl.appendChild(chk); lbl.appendChild(document.createTextNode(' '+c));
    frag.appendChild(lbl);
  }
  E.contList.appendChild(frag);
  updateContCount();
}
function updateContCount(){
  const pool=visibleConts();
  const deselected=pool.filter(c=>!SEL_CONTS.has(c)).length;
  E.contCount.textContent=deselected===0?'all selected':`${deselected} deselected`;
}

/* ── Live summary of how many equations the current filters invoke ── */
function updateSummary(){
  if(persist) persist.schedule(); // selection changes funnel through here — save them
  if(!csvRows){E.invokeSummary.textContent='—';return;}
  const n=csvRows.filter(r=>SEL_SETS.has(setId(r))&&SEL_LIMITS.has(limitOf(r))&&SEL_CONTS.has(contOf(r))).length;
  E.invokeSummary.textContent=`${n} equation${n===1?'':'s'} invoked · ${SEL_SETS.size} set${SEL_SETS.size===1?'':'s'}`;
}

/* ═══ ENERGY DISPATCH LOOKUP ══════════════════════════════════════
   The dispatch file supplies generator ENERGY setpoints only.  An absent
   generator is simply not running → 0 MW (matches the reference solver's
   dispatch.get(fid, 0.0)).  Regulation/contingency reserve setpoints are
   NOT part of a dispatch, so they cannot be looked up — see evalLHS.
════════════════════════════════════════════════════════════════════ */
function getEnergyVal(gen){
  if(lhsMap[gen]!==undefined) return{val:lhsMap[gen],src:'lhs'};
  const nd=`${gen}.energy.sentOut`;
  if(rhsMap[nd]!==undefined) return{val:rhsMap[nd],src:'rhs-nd'};
  return{val:0,src:'absent'};   // not dispatched ⇒ 0 MW
}

/* ═══ EVALUATION ══════════════════════════════════════════════════
   LHS = Σ coeff · facility.energy.setpoint   (ENERGY terms ONLY).

   Database constraint equations are evaluated on energy terms only,
   exactly as wemulator-lite's solver does:
       [t for t in eq["lhs_terms"] if t["service"] == "energy"]
   regulationRaise/Lower (and contingencyRaise/Lower) terms describe ESS
   reserve setpoints that a plain dispatch does not contain, so they are
   reported for transparency but excluded from the LHS total.  (The old
   tool fabricated them as Max−dispatch / dispatch−Min, which is wrong.)
════════════════════════════════════════════════════════════════════ */
const RX=/^([+-])\s*([+-]?[\d.]+)\s+x\s+(\w+)\.(energy|regulationRaise|regulationLower|contingencyRaise|contingencyLower)\.setpoint/i;

function evalLHS(formula){
  if(!formula) return{total:0,terms:[],missing:false};
  let total=0,missing=false; const terms=[];
  for(const raw of formula.split('\t')){
    const m=raw.trim().match(RX); if(!m) continue;
    const outer=m[1]==='-'?-1:1, coeff=outer*parseFloat(m[2]);
    const gen=m[3], ptOrig=m[4], ptNorm=ptOrig.toLowerCase();
    const isEnergy=ptNorm==='energy';
    let val=0, src='reserve', contrib=0;
    if(isEnergy){
      const info=getEnergyVal(gen);
      val=info.val; src=info.src; contrib=coeff*val;
      total+=contrib;
    }
    terms.push({coeff,gen,ptOrig,ptNorm,val,src,contrib,counted:isEnergy});
  }
  return{total,terms,missing};
}

/* ── RHS script evaluation ─────────────────────────────────────────
   Each constraint carries a Right Hand Side Script of the exact form

       def RHS(terms):
           return (
               +0.95 * terms['…AMP.RATING.NORM'] * 132 * 1.7321 / 1000  # Rating
               -0.1484 * min(45.0, terms['GEN.energy.sentOut'])         # Runback
               +0.0140 * terms['forecast.…OperationalDemand-expected']  # Load
               -12.2591                                                 # Offset
           )

   wemulator-lite evaluates this by EXECUTING the script with
       terms = rhs_params ∪ {demand}
   We mirror that in the browser: the parameter map (terms) is the RHS
   sheet of the uploaded dispatch file (rhsMap), with the demand forecast
   supplied by the demand input.  Every additive line is evaluated and
   summed, and each line is kept with its trailing comment as a label so
   the breakdown can be shown.

   Returns { total, parts:[{label,value}], missingKeys:[…] } or
   null when the RHS cannot be evaluated (a required parameter is absent),
   in which case the equation is reported as "not evaluated" rather than
   guessed — again matching the reference, which skips such equations.   */
const DEMAND_KEY='forecast.energy-forecastOperationalDemand-expected';
const PY_FUNCS=/\b(min|max|abs|round)\s*\(/g;

function evalRHS(script,dem){
  if(!script) return null;
  // Isolate the body of  return ( … )
  const ret=script.indexOf('return (');
  if(ret<0) return null;
  let body=script.slice(ret+8);
  const close=body.lastIndexOf(')');
  if(close>=0) body=body.slice(0,close);

  const parts=[]; const missingKeys=new Set(); let total=0;
  for(const rawLine of body.split('\n')){
    const hash=rawLine.indexOf('#');
    const code=(hash>=0?rawLine.slice(0,hash):rawLine).trim();
    if(!code) continue;
    const label=hash>=0?rawLine.slice(hash+1).trim():'term';
    // Substitute every terms['key'] with its numeric value.
    let resolvable=true;
    const subbed=code.replace(/terms\[\s*(['"])(.*?)\1\s*\]/g,(_,q,key)=>{
      let v;
      if(key===DEMAND_KEY) v=dem;
      else if(rhsMap[key]!==undefined) v=rhsMap[key];
      else { missingKeys.add(key); resolvable=false; v=0; }
      return '('+v+')';
    });
    if(!resolvable) return null;   // required parameter absent ⇒ cannot evaluate
    // Translate the (now numeric) Python expression to JS and evaluate.
    const js=subbed.replace(PY_FUNCS,(m,fn)=>'Math.'+fn+'(');
    let v;
    try{ v=Function('"use strict";return ('+js+');')(); }
    catch(e){ return null; }
    if(typeof v!=='number'||!isFinite(v)) return null;
    parts.push({label,value:v}); total+=v;
  }
  if(!parts.length) return null;
  return{total,parts,missingKeys:[...missingKeys]};
}

function runCheck(){
  if(!csvRows||!xlsxOk){alert('Please load constraint equations and upload a dispatch XLSX first.');return;}
  demand=parseFloat(E.demandInp.value)||1500;
  // ── Activation: invoked set(s) → constraint type → contingency ──
  // An equation is checked only when its set is invoked AND its constraint
  // type AND contingency are both still selected (both default to all).
  const pool=csvRows.filter(r=>
    SEL_SETS.has(setId(r))&&SEL_LIMITS.has(limitOf(r))&&SEL_CONTS.has(contOf(r)));
  results=pool.map(row=>{
    const lhs=evalLHS(row['Left Hand Side']);
    let rhs=evalRHS(row['Right Hand Side Script'],demand);
    // Reference fallback: when the script cannot be evaluated, use Default RHS
    // — but only when it is a real limit (the 9999 sentinel means "no limit").
    const defRhs=parseFloat(row['Default RHS']);
    if(!rhs&&isFinite(defRhs)&&defRhs!==9999){
      rhs={total:defRhs,parts:[{label:'Default RHS',value:defRhs}],missingKeys:[],fromDefault:true};
    }
    const skipped=!rhs;
    const op=(row['Equation Operator']||'').toLowerCase();
    let violated=false, margin=null;
    if(!skipped){
      // LessThanOrEqualTo ⇒ violated when LHS > RHS; otherwise LHS < RHS.
      violated=op.includes('less')?lhs.total>rhs.total:lhs.total<rhs.total;
      margin=rhs.total-lhs.total;
    }
    return{id:row['Constraint Equation ID'],monitored:row['Monitored Element'],
           set:setId(row)||'NIL',cont:contOf(row),limit:limitOf(row),
           lhs,rhs,skipped,violated,margin,defRhs,row};
  });
  // Skipped equations sink to the bottom; evaluated ones sort by margin.
  results.sort((a,b)=>{
    if(a.skipped!==b.skipped) return a.skipped?1:-1;
    if(a.skipped) return 0;
    return a.margin-b.margin;
  });
  render(invokeLabel());
}

/* Human-readable label for the invoked selection, used in banner/KPIs. */
function invokeLabel(){
  const sets=[...SEL_SETS];
  if(sets.length===1) return sets[0];
  if(sets.length<=3) return sets.join(', ');
  return `${sets.length} constraint sets`;
}

/* ═══ RENDER ══════════════════════════════════════════════════════ */
function render(label){
  E.emptyState.style.display='none';
  E.resultsArea.style.display='flex';
  E.dlBtn.style.display='inline-block';
  const viol=results.filter(r=>!r.skipped&&r.violated),
        pass=results.filter(r=>!r.skipped&&!r.violated),
        skip=results.filter(r=>r.skipped);
  const evaluated=viol.length+pass.length;
  const worst=viol.length?Math.min(...viol.map(r=>r.margin)):null;
  // Power Balance KPI
  const totalGen=Object.values(lhsMap).reduce((a,b)=>a+b,0);
  const mismatch=totalGen-demand;
  const pct=demand?Math.abs(mismatch/demand*100):0;
  const balColor=pct<3?'var(--pos)':pct<10?'var(--wn-txt)':'var(--neg)';
  E.kpiBalance.textContent=(mismatch>=0?'+':'')+f2(mismatch)+' MW';
  E.kpiBalance.style.color=balColor;
  E.kpiBalanceSub.textContent=`Gen ${totalGen.toFixed(0)} MW | Load ${demand.toFixed(0)} MW`;
  // Other KPIs
  E.kpiViol.textContent=viol.length;
  E.kpiPass.textContent=evaluated?((pass.length/evaluated*100).toFixed(1)+'%'):'—';
  const skipNote=skip.length?` · ${skip.length} not evaluated`:'';
  E.kpiTotal.textContent=`${evaluated} of ${results.length} evaluated${skipNote}`;
  E.kpiWorst.textContent=worst!==null?f2(worst)+' MW':'—';
  E.kpiContLbl.textContent=`Invoked: ${label}`;
  // Banner
  if(evaluated===0){E.banner.className='banner idle';E.banner.innerHTML=`No equations could be evaluated for "<strong>${label}</strong>". The dispatch file may be missing the required RHS parameters, or the filters excluded every equation.`;}
  else if(viol.length===0){E.banner.className='banner ok';E.banner.innerHTML=`✅ All <strong>${evaluated}</strong> active constraints satisfied when "<strong>${label}</strong>" is invoked.`;}
  else{E.banner.className='banner viol';E.banner.innerHTML=`⚠️ The Dispatch violates <strong>${viol.length}</strong> of <strong>${evaluated}</strong> active Constraint Equations when "<strong>${label}</strong>" is invoked.`;}
  E.violBadge.textContent=viol.length;
  E.passBadge.textContent=pass.length;
  E.violEmpty.style.display=viol.length?'none':'block';
  buildTable('viol',viol,E.violBody);
  buildTable('pass',pass,E.passBody2);
}

function buildTable(pfx,rows,tbody){
  tbody.innerHTML='';
  const frag=document.createDocumentFragment();
  rows.forEach((r,i)=>{
    const dr=document.createElement('tr');
    dr.className='dr'+(r.violated?' viol':'');
    dr.innerHTML=buildRow(r,i+1,pfx);
    frag.appendChild(dr);
    const xr=document.createElement('tr'); xr.className='xr';
    const td=document.createElement('td'); td.colSpan=6;
    const panel=document.createElement('div');
    panel.className='eq-panel'; panel.id=`panel-${pfx}-${i}`;
    panel.innerHTML=buildPanel(r); td.appendChild(panel); xr.appendChild(td);
    frag.appendChild(xr);
  });
  tbody.appendChild(frag);
}

function buildRow(r,idx,pfx){
  const lf=f2(r.lhs.total), rf=f2(r.rhs.total);
  const op=r.violated?'&gt;':'≤', cls=r.violated?'viol':'ok';
  const mCls=r.margin<0?'neg':'pos';
  const badge=r.violated?'<span class="badge b-er">⚠ VIOLATED</span>':'<span class="badge b-ok">✓ OK</span>';
  return `<td class="idx">${idx}</td>
    <td><span class="idc mono" title="${r.id}">${r.id}</span></td>
    <td class="elc">${r.monitored||'—'}</td>
    <td class="lrc ${cls}"><span class="lv">${lf}</span><span class="op">${op}</span><span class="rv">${rf}</span></td>
    <td class="mgc ${mCls}">${sgn(r.margin)}</td>
    <td style="text-align:center">${badge} <button class="xbtn" data-p="${pfx}" data-i="${idx-1}" style="margin-left:5px">▶ Show</button></td>`;
}

/* ── Equation Panel ── */
function buildPanel(r){
  const note=r.rhs&&r.rhs.fromDefault?'<div class="miss-note">RHS script not evaluable — Default RHS used.</div>':'';
  const opTxt=r.violated?`<span style="color:var(--neg)">&#62; VIOLATED</span>`:'≤';
  return `${note}
<div class="eq-sec"><div class="eq-lbl">LHS — Generator Dispatch Sensitivity Terms (energy only)</div>
  <div class="eq-terms">${buildLhsHtml(r.lhs.terms)}</div>
  <div class="eq-tot">Σ LHS = ${f4(r.lhs.total)} MW</div>
</div>
<div class="eq-opr">${opTxt}</div>
<div class="eq-sec"><div class="eq-lbl">RHS — Thermal Limit</div>
  <div class="eq-terms">${buildRhsHtml(r.rhs)}</div>
  <div class="eq-tot">Σ RHS = ${f4(r.rhs.total)} MW</div>
</div>
<div style="margin-top:8px;font-size:.72rem;color:var(--muted)">
  Constraint: <em>${r.id}</em> · Monitored: <em>${r.monitored||'—'}</em> · Demand: ${(+E.demandInp.value||1500).toFixed(0)} MW
</div>`;
}

const SYM={energy:'●',regulationraise:'▲',regulationlower:'▼',contingencyraise:'△',contingencylower:'▽'};
const TAG={energy:'Energy',regulationraise:'Reg↑',regulationlower:'Reg↓',contingencyraise:'Cont↑',contingencylower:'Cont↓'};
function termCls(pt){return pt==='energy'?'energy':pt==='regulationraise'?'regRaise':'regLower';}

function buildLhsHtml(terms){
  if(!terms.length) return '<span style="color:var(--muted)">No terms parsed</span>';
  return terms.map(t=>{
    const cls=termCls(t.ptNorm), sign=t.coeff>=0?'+':'−';
    const sym=SYM[t.ptNorm]||'?', tag=TAG[t.ptNorm]||t.ptNorm;
    // Reserve (non-energy) terms are not part of a dispatch ⇒ shown greyed,
    // excluded from the energy-only LHS total.
    const valStr=t.counted
      ?`<span class="tc-v">=&thinsp;${f2(t.val)}</span>`
      :`<span class="tc-v" style="color:var(--muted)">(reserve · not in LHS)</span>`;
    const extra=t.counted?'':' style="opacity:.5"';
    return `<span class="tsign"${extra}>${sign}</span>`+
      `<span class="tc ${cls}"${extra} title="${t.gen}.${t.ptOrig}.setpoint">`+
      `<span class="tc-sym">${sym}</span><span class="tc-c">${Math.abs(t.coeff).toFixed(4)}×</span>${t.gen}<span style="opacity:.6;font-size:.65rem;margin-left:2px">[${tag}]</span>${valStr}</span>`;
  }).join(' ');
}

const RHS_SYM=[[/rat/i,'⬡','rating'],[/load|demand|scal/i,'≈','load'],[/runback|gen/i,'↘','load'],[/off/i,'±','offset']];
function rhsTag(label){for(const[re,sym,cls]of RHS_SYM)if(re.test(label))return[sym,cls];return['•','offset'];}
function buildRhsHtml(rhs){
  if(!rhs||!rhs.parts.length) return '<span style="color:var(--muted)">Could not evaluate RHS script</span>';
  return rhs.parts.map(p=>{
    const [sym,cls]=rhsTag(p.label), s=p.value>=0?'+':'−';
    return `<span class="tsign">${s}</span><span class="tc ${cls}" title="${p.label}">`+
      `<span class="tc-sym">${sym}</span>${p.label}<span class="tc-v">=&thinsp;${f2(Math.abs(p.value))}</span></span>`;
  }).join(' ');
}

/* ═══ TABLE FILTER ════════════════════════════════════════════════ */
function filterTable(tbody,q){
  tbody.querySelectorAll('tr.dr').forEach(row=>{
    const show=!q||row.textContent.toLowerCase().includes(q.toLowerCase());
    row.style.display=show?'':'none';
    const xr=row.nextElementSibling;
    if(xr&&xr.classList.contains('xr')) xr.style.display=show?'':'none';
  });
}

/* ═══ EXPORT ══════════════════════════════════════════════════════ */
/* Sanitise CSV text to plain ASCII so spreadsheets never render mojibake
   (â€” / Î” / âˆ’). Cosmetic glyphs are deleted; functional glyphs are replaced
   with a safe ASCII equivalent that preserves their meaning:
     - minus sign (−) and en dash (–) → "-"   (negative values stay negative)
     - delta (Δ)                      → "Delta"
     - emoji / pictographs            → removed (cosmetic)
     - em dash (—), figure dash, bar  → removed (cosmetic separators) */
function cleanCSV(text){
  return String(text||'')
    .replace(/[–−]/g, '-')
    .replace(/Δ/g, 'Delta')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/[ \t]*[‒—―][ \t]*/g, ' ');
}
function exportCsv(){
  if(!results.length) return;
  const hdr=['Status','Constraint Set','Contingency','Constraint Equation ID','Monitored Element','LHS (MW)','RHS (MW)','Margin (MW)'];
  const rows=results.map(r=>{
    const status=r.skipped?'NOT EVALUATED':r.violated?'VIOLATED':'OK';
    const rhs=r.skipped?'':f4(r.rhs.total), mgn=r.skipped?'':f4(r.margin);
    return [status,`"${r.set}"`,`"${r.cont}"`,`"${r.id}"`,`"${r.monitored||''}"`,f4(r.lhs.total),rhs,mgn].join(',');
  });
  const blob=new Blob([cleanCSV([hdr.join(','),...rows].join('\n'))],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download='constraint_check.csv';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

/* ═══ EVENTS ══════════════════════════════════════════════════════ */
E.xlsxInput.onchange=e=>{if(e.target.files[0]) handleXlsx(e.target.files[0]);};
document.addEventListener('dragover',e=>e.preventDefault());
document.addEventListener('drop',e=>{
  e.preventDefault();
  const f=Array.from(e.dataTransfer.files).find(f=>/\.xlsx?$/i.test(f.name));
  if(f) handleXlsx(f);
});
// ── Constraint-invocation filters ──
E.setSearch.oninput=()=>{if(csvOk) renderSetList();};
E.contSearch.oninput=()=>{if(csvOk) renderContList();};
E.setAll.onclick=()=>{
  // Invoke every set currently shown by the search filter.
  const q=(E.setSearch.value||'').toLowerCase();
  for(const s of ALL_SETS){
    if(q&&!s.toLowerCase().includes(q)) continue;
    SEL_SETS.add(s); (CONTS_BY_SET[s]||[]).forEach(c=>SEL_CONTS.add(c));
  }
  renderSetList(); renderContList(); updateSummary();
};
E.setNone.onclick=()=>{
  SEL_SETS.clear(); SEL_SETS.add('NIL');   // NIL stays invoked
  renderSetList(); renderContList(); updateSummary();
};
E.limitAll.onclick=()=>{ALL_LIMITS.forEach(l=>SEL_LIMITS.add(l));renderLimitList();updateSummary();};
E.limitNone.onclick=()=>{SEL_LIMITS.clear();renderLimitList();updateSummary();};
E.contAll.onclick=()=>{visibleConts().forEach(c=>SEL_CONTS.add(c));renderContList();updateSummary();};
E.contNone.onclick=()=>{visibleConts().forEach(c=>SEL_CONTS.delete(c));renderContList();updateSummary();};
E.checkBtn.onclick=runCheck;
// Expand rows
document.addEventListener('click',e=>{
  const btn=e.target.closest('.xbtn'); if(!btn) return;
  const panel=document.getElementById(`panel-${btn.dataset.p}-${btn.dataset.i}`); if(!panel) return;
  const open=panel.classList.toggle('open');
  btn.textContent=open?'▼ Hide':'▶ Show'; btn.classList.toggle('open',open);
});
// Passed section toggle
E.passToggle.onclick=()=>{
  E.passToggle.classList.toggle('open');
  E.passBodyEl.classList.toggle('open');
  E.passToggle.querySelector('.arr').textContent=E.passBodyEl.classList.contains('open')?'▲':'▼';
};
E.violFilter.oninput=()=>filterTable(E.violBody,E.violFilter.value);
E.passFilter.oninput=()=>filterTable(E.passBody2,E.passFilter.value);
E.themeBtn.onclick=()=>{
  document.body.classList.toggle('light');
  E.themeBtn.textContent=document.body.classList.contains('light')?'🌙 Dark':'☀️ Light';
};
E.dlBtn.onclick=exportCsv;

/* ═══ MINI CACHE ══════════════════════════════════════════════════
   Persist the demand value (form input) plus the selected constraint sets,
   limit types and contingencies, so a returning user keeps their selection.
   The selection is stashed now and applied once the bundled data finishes
   loading (buildFilters). Search/filter boxes are transient (data-no-persist). */
if (window.Persist) {
  persist = Persist.init('wemconstraint-checker', {
    onRestore: function(){},
    extra: {
      save: function(){ return { sets:[...SEL_SETS], limits:[...SEL_LIMITS], conts:[...SEL_CONTS] }; },
      restore: function(e){ if(e && typeof e === 'object') cachedSel = e; }
    }
  });
}

/* ═══ INIT ════════════════════════════════════════════════════════ */
Promise.all([fetchCsv(), fetchGenData()]);
})();
