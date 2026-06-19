(function(){'use strict';
/* ═══ STATE ═══════════════════════════════════════════════════════ */
let csvRows=null, lhsMap={}, rhsMap={}, genDataMap={}, results=[], demand=1500;
let csvOk=false, genOk=false, xlsxOk=false;

/* ═══ DOM ═════════════════════════════════════════════════════════ */
const $=id=>document.getElementById(id);
const E={
  xlsxInput:$('xlsxInput'), xlsxName:$('xlsxName'),
  demandInp:$('demandInp'), contSearch:$('contSearch'),
  contSel:$('contSel'), contCount:$('contCount'),
  activeOnly:$('activeOnly'), checkBtn:$('checkBtn'),
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
    pill(E.spCsv,'ok',`✓ ${csvRows.length} unique constraints`);
    buildContingencyDd();
  },error:e=>pill(E.spCsv,'er','CSV error: '+e.message)});
}
function dedupe(rows){
  const m={};
  for(const r of rows){const id=r['Constraint Equation ID'];const v=parseInt(r['Constraint Equation Version'])||0;if(!m[id]||v>m[id]._v)m[id]={...r,_v:v};}
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

/* ═══ CONTINGENCY DROPDOWN ════════════════════════════════════════ */
function buildContingencyDd(){
  const onlyAct=E.activeOnly.checked;
  const pool=onlyAct?csvRows.filter(r=>r['Constraint Set ID']&&r['Constraint Set ID']!=''):csvRows;
  const counts={};
  for(const r of pool){const c=(r['Contingency']||'').trim()||'NIL';counts[c]=(counts[c]||0)+1;}
  const sorted=Object.keys(counts).sort((a,b)=>a==='NIL'?-1:b==='NIL'?1:a.localeCompare(b));
  const q=E.contSearch.value.toLowerCase(), cur=E.contSel.value||'NIL';
  E.contSel.innerHTML='';
  let shown=0;
  for(const c of sorted){
    if(q&&!c.toLowerCase().includes(q)) continue;
    const o=document.createElement('option');
    o.value=c; o.textContent=`${c}  (${counts[c]})`;
    if(c===cur) o.selected=true;
    E.contSel.appendChild(o); shown++;
  }
  if(!E.contSel.value&&E.contSel.options[0]) E.contSel.options[0].selected=true;
  const sel=E.contSel.value;
  E.contCount.textContent=`${shown} contingencies · ${counts[sel]||0} constraints for "${sel}"`;
}

/* ═══ GENERATOR VALUE LOOKUP ══════════════════════════════════════
   Reg Raise = Max − dispatch   (clamped ≥ 0)
   Reg Lower = dispatch − Min   (clamped ≥ 0)
════════════════════════════════════════════════════════════════════ */
function getVal(gen, ptNorm){
  const disp=lhsMap[gen];
  const gd=genDataMap[gen];
  if(ptNorm==='energy'){
    if(disp!==undefined) return{val:disp,src:'lhs'};
    const nd=`${gen}.energy.sentOut`;
    if(rhsMap[nd]!==undefined) return{val:rhsMap[nd],src:'rhs-nd'};
    return{val:0,src:'default'};
  }
  if(ptNorm==='regulationraise'){
    if(disp!==undefined&&gd) return{val:Math.max(0,gd.max-disp),src:'calc'};
    if(disp!==undefined)     return{val:0,src:'default'};
    return{val:0,src:'default'};
  }
  if(ptNorm==='regulationlower'){
    if(disp!==undefined&&gd) return{val:Math.max(0,disp-gd.min),src:'calc'};
    if(disp!==undefined)     return{val:0,src:'default'};
    return{val:0,src:'default'};
  }
  return{val:0,src:'default'};
}

/* ═══ EVALUATION ══════════════════════════════════════════════════ */
const RX=/^([+-])\s*([+-]?[\d.]+)\s+x\s+(\w+)\.(energy|regulationRaise|regulationLower)\.setpoint/i;

function evalLHS(formula){
  if(!formula) return{total:0,terms:[],missing:false};
  let total=0,missing=false; const terms=[];
  for(const raw of formula.split('\t')){
    const m=raw.trim().match(RX); if(!m) continue;
    const outer=m[1]==='-'?-1:1, coeff=outer*parseFloat(m[2]);
    const gen=m[3], ptOrig=m[4], ptNorm=ptOrig.toLowerCase();
    const info=getVal(gen,ptNorm);
    if(info.src==='default') missing=true;
    const contrib=coeff*info.val; total+=contrib;
    terms.push({coeff,gen,ptOrig,ptNorm,val:info.val,src:info.src,contrib});
  }
  return{total,terms,missing};
}

function evalRHS(script,dem){
  const info={rMVA:0,ls:0,lc:0,off:0,total:0};
  if(!script) return info;
  for(const line of script.split('\n')){
    const cl=line.split('#')[0].trim().replace(/[,)]+$/,'');
    if(!cl||cl.startsWith('def ')||cl==='return (') continue;
    if(cl.includes('terms[')){
      const m=cl.match(/([+-]?\s*[\d.]+)\s*\*/);
      if(m) info.ls=parseFloat(m[1].replace(/\s/g,''))||0;
    } else if(/[\d.]+\s*\*[\s\d.]+\*[\s\d.]+\*[\s\d.]+\/[\s\d.]+/.test(cl)){
      const m=cl.match(/([+-]?\s*[\d.]+)\s*\*\s*([\d.]+)\s*\*\s*([\d.]+)\s*\*\s*([\d.]+)\s*\/\s*([\d.]+)/);
      if(m) info.rMVA=parseFloat(m[1])*parseFloat(m[2])*parseFloat(m[3])*parseFloat(m[4])/parseFloat(m[5]);
    } else {
      const m=cl.match(/^([+-]?\s*[\d.]+)$/);
      if(m) info.off=parseFloat(m[1].replace(/\s/g,''))||0;
    }
  }
  info.lc=info.ls*dem; info.total=info.rMVA+info.lc+info.off;
  return info;
}

function runCheck(){
  if(!csvRows||!xlsxOk){alert('Please load constraint equations and upload a dispatch XLSX first.');return;}
  demand=parseFloat(E.demandInp.value)||1500;
  const sel=E.contSel.value||'NIL', onlyAct=E.activeOnly.checked;
  let pool=csvRows.filter(r=>(r['Contingency']||'').trim()===sel);
  if(onlyAct) pool=pool.filter(r=>r['Constraint Set ID']&&r['Constraint Set ID']!='');
  results=pool.map(row=>{
    const lhs=evalLHS(row['Left Hand Side']);
    const rhs=evalRHS(row['Right Hand Side Script'],demand);
    const op=(row['Equation Operator']||'').toLowerCase();
    const violated=op.includes('less')?lhs.total>rhs.total:lhs.total<rhs.total;
    const margin=rhs.total-lhs.total;
    return{id:row['Constraint Equation ID'],monitored:row['Monitored Element'],
           cont:sel,lhs,rhs,violated,margin,row};
  });
  results.sort((a,b)=>a.margin-b.margin);
  render(sel);
}

/* ═══ RENDER ══════════════════════════════════════════════════════ */
function render(label){
  E.emptyState.style.display='none';
  E.resultsArea.style.display='flex';
  E.dlBtn.style.display='inline-block';
  const viol=results.filter(r=>r.violated), pass=results.filter(r=>!r.violated);
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
  E.kpiPass.textContent=results.length?((pass.length/results.length*100).toFixed(1)+'%'):'—';
  E.kpiTotal.textContent=`${results.length} constraints checked`;
  E.kpiWorst.textContent=worst!==null?f2(worst)+' MW':'—';
  E.kpiContLbl.textContent=`Contingency: ${label}`;
  // Banner
  if(viol.length===0){E.banner.className='banner ok';E.banner.innerHTML=`✅ All <strong>${results.length}</strong> constraints satisfied for "<strong>${label}</strong>".`;}
  else{E.banner.className='banner viol';E.banner.innerHTML=`⚠️ The Dispatch violates <strong>${viol.length}</strong> of <strong>${results.length}</strong> Constraint Equations for "<strong>${label}</strong>".`;}
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
  const mw=r.lhs.missing?'<span title="Some values defaulted to 0" style="color:var(--wn-txt);font-size:.67rem"> ⚠</span>':'';
  return `<td class="idx">${idx}</td>
    <td><span class="idc mono" title="${r.id}">${r.id}</span></td>
    <td class="elc">${r.monitored||'—'}</td>
    <td class="lrc ${cls}"><span class="lv">${lf}${mw}</span><span class="op">${op}</span><span class="rv">${rf}</span></td>
    <td class="mgc ${mCls}">${sgn(r.margin)}</td>
    <td style="text-align:center">${badge} <button class="xbtn" data-p="${pfx}" data-i="${idx-1}" style="margin-left:5px">▶ Show</button></td>`;
}

/* ── Equation Panel ── */
function buildPanel(r){
  const miss=r.lhs.missing?'<div class="miss-note">⚠ Some generator setpoints not found — values defaulted to 0 MW.</div>':'';
  const opTxt=r.violated?`<span style="color:var(--neg)">&#62; VIOLATED</span>`:'≤';
  return `${miss}
<div class="eq-sec"><div class="eq-lbl">LHS — Generator Dispatch Sensitivity Terms</div>
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

const SYM={energy:'●',regulationraise:'▲',regulationlower:'▼'};
const TAG={energy:'Energy',regulationraise:'Reg↑',regulationlower:'Reg↓'};
function termCls(pt){return pt==='energy'?'energy':pt==='regulationraise'?'regRaise':'regLower';}

function buildLhsHtml(terms){
  if(!terms.length) return '<span style="color:var(--muted)">No terms parsed</span>';
  return terms.map(t=>{
    const cls=termCls(t.ptNorm), sign=t.coeff>=0?'+':'−';
    const sym=SYM[t.ptNorm]||'?', tag=TAG[t.ptNorm]||t.ptNorm;
    const valStr=t.src==='default'
      ?`<span class="tc-v" style="color:var(--wn-txt)">(missing)</span>`
      :`<span class="tc-v">=&thinsp;${f2(t.val)}</span>`;
    return `<span class="tsign">${sign}</span>`+
      `<span class="tc ${cls}" title="${t.gen}.${t.ptOrig}.setpoint = ${f2(t.val)} MW">`+
      `<span class="tc-sym">${sym}</span><span class="tc-c">${Math.abs(t.coeff).toFixed(4)}×</span>${t.gen}<span style="opacity:.6;font-size:.65rem;margin-left:2px">[${tag}]</span>${valStr}</span>`;
  }).join(' ');
}

function buildRhsHtml(rhs){
  const parts=[];
  if(rhs.rMVA!==0)
    parts.push(`<span class="tc rating"><span class="tc-sym">⬡</span>${f2(rhs.rMVA)} MW<span style="opacity:.6;font-size:.65rem;margin-left:2px">[Rating]</span></span>`);
  if(rhs.ls!==0){
    const s=rhs.lc>=0?'+':'−';
    parts.push(`<span class="tsign">${s}</span><span class="tc load"><span class="tc-sym">≈</span><span class="tc-c">${Math.abs(rhs.ls).toFixed(4)}×</span>demand<span style="opacity:.6;font-size:.65rem;margin-left:2px">[Load]</span><span class="tc-v">=&thinsp;${f2(Math.abs(rhs.lc))}</span></span>`);
  }
  if(rhs.off!==0){
    const s=rhs.off>=0?'+':'−';
    parts.push(`<span class="tsign">${s}</span><span class="tc offset"><span class="tc-sym">±</span>${Math.abs(rhs.off).toFixed(4)}<span style="opacity:.6;font-size:.65rem;margin-left:2px">[Offset]</span></span>`);
  }
  return parts.length?parts.join(' '):'<span style="color:var(--muted)">Could not parse RHS script</span>';
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
/* Strip emoji and convert typographic dashes/minus/delta to plain ASCII so the
   downloaded CSV is clean simple text (no "â€”" / "Î”" / "âˆ’" mojibake). */
function cleanCSV(text){
  return String(text||'')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/[‒–—―−]/g, '-')
    .replace(/Δ/g, 'd');
}
function exportCsv(){
  if(!results.length) return;
  const hdr=['Status','Contingency','Constraint Equation ID','Monitored Element','LHS (MW)','RHS (MW)','Margin (MW)'];
  const rows=results.map(r=>[r.violated?'VIOLATED':'OK',r.cont,`"${r.id}"`,`"${r.monitored||''}"`,f4(r.lhs.total),f4(r.rhs.total),f4(r.margin)].join(','));
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
E.contSearch.oninput=()=>{if(csvOk) buildContingencyDd();};
E.activeOnly.onchange=()=>{if(csvOk) buildContingencyDd();};
E.contSel.onchange=()=>{
  const pool=E.activeOnly.checked?csvRows.filter(r=>r['Constraint Set ID']&&r['Constraint Set ID']!=''):csvRows;
  const cnt=pool.filter(r=>(r['Contingency']||'').trim()===E.contSel.value).length;
  E.contCount.textContent=`${cnt} constraints for "${E.contSel.value}"`;
};
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

/* ═══ INIT ════════════════════════════════════════════════════════ */
Promise.all([fetchCsv(), fetchGenData()]);
})();
