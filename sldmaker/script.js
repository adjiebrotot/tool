(function(){
'use strict';

/* ════════════════════════════════════════════════════════════
   SLD MAKER — single line diagram builder
   ════════════════════════════════════════════════════════════ */

const SVGNS = 'http://www.w3.org/2000/svg';
const BOARD_W = 1400, BOARD_H = 900;
const SNAP_MAX = 80;          // px radius to snap a line endpoint to a terminal
const STUB = 24;              // orthogonal lead length out of a terminal
const LEAD = 14;              // fixed-length connection lead out of a symbol body (scale-independent)
const DIRV = {up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};

// Watermark logo (logos/logo.svg) preloaded for PNG export
const WM_LOGO_SRC = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDY4MCA2ODAiIHJvbGU9ImltZyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8dGl0bGU+QXJjaGVkIEEgTG9nbzwvdGl0bGU+CiAgPGRlc2M+QSBzbGVlayB3aGl0ZSBsZXR0ZXIgQSB3aG9zZSBsZWdzIGZvbGxvdyB0aGUgY2lyY2xlIGN1cnZhdHVyZSwgc3Bhbm5pbmcgODAlIG9mIHRoZSBjaXJjbGUgaGVpZ2h0PC9kZXNjPgoKICA8Y2lyY2xlIGN4PSIzNDAiIGN5PSIzNDAiIHI9IjMwMCIgZmlsbD0iIzAwNTJjYyIvPgoKICA8IS0tIExlZnQgbGVnOiAxMTPCsCB0byAyNDXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyNDIsNTcwIEEgMjUwLDI1MCAwIDAgMSAyMzQsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFRvcCBhcmNoOiAyNDXCsCB0byAyOTXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyMzQsMTEzIEEgMjUwLDI1MCAwIDAgMSA0NDYsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFJpZ2h0IGxlZzogMjk1wrAgdG8gNjfCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSA0NDYsMTEzIEEgMjUwLDI1MCAwIDAgMSA0MzgsNTcwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIENyb3NzYmFyIC0tPgogIDxsaW5lIHgxPSIxMTMiIHkxPSIzNTQiIHgyPSI1NjciIHkyPSIzNTQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNDIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K';
const wmLogoImg = new Image(); wmLogoImg.src = WM_LOGO_SRC;

/* ── Symbol definitions ───────────────────────────────────────
   Each symbol body is drawn centred at local (0,0), UNSCALED. At
   render time the body is wrapped in a scale() group while the
   connection leads are drawn OUTSIDE that group so they keep a
   fixed length regardless of element size. `leads` are attach
   points on the body edge {x,y,dir}; the terminal sits LEAD px
   beyond the attach point. `@FILL` is replaced with an opaque
   fill so symbols are not see-through. `bbox` is the body box. */
const DEFAULT_NAMES = {
  transformer2:'TR', generator:'G', busbar:'BB', load:'LD', transformer3:'TR3',
  motor:'M', windturbine:'WTG', solarpv:'PV', inverter:'INV', battery:'BESS', breaker:'CB', node:'N'
};
const SYM = {
  transformer2:{
    label:'2-Winding Transformer',
    bbox:{x:-12,y:-20,w:24,h:40},
    leads:[{x:0,y:-20,dir:'up'},{x:0,y:20,dir:'down'}],
    body:()=>`<circle cx="0" cy="-9" r="11" fill="@FILL"/><circle cx="0" cy="9" r="11" fill="@FILL"/>`
  },
  generator:{
    label:'Synchronous Generator',
    bbox:{x:-17,y:-17,w:34,h:34},
    leads:[{x:0,y:17,dir:'down'}],
    body:()=>`<circle cx="0" cy="0" r="17" fill="@FILL"/><path d="M-9 0 q4.5 -9 9 0 t9 0" fill="none"/>`
  },
  busbar:{
    label:'Busbar',
    bbox:{x:-46,y:-3.5,w:92,h:7},
    bar:true,
    leads:[],
    body:()=>''  // drawn specially (length scales, thickness fixed)
  },
  load:{
    label:'Load',
    bbox:{x:-13,y:-14,w:26,h:28},
    leads:[{x:0,y:-14,dir:'up'}],
    body:()=>`<path d="M-13 -14 L13 -14 L0 14 Z" fill="@FILL"/>`
  },
  transformer3:{
    label:'3-Winding Transformer',
    bbox:{x:-22,y:-21,w:44,h:40},
    leads:[{x:0,y:-21,dir:'up'},{x:-11,y:19,dir:'down'},{x:11,y:19,dir:'down'}],
    body:()=>`<circle cx="0" cy="-10" r="11" fill="@FILL"/><circle cx="-11" cy="8" r="11" fill="@FILL"/><circle cx="11" cy="8" r="11" fill="@FILL"/>`
  },
  motor:{
    label:'Motor',
    bbox:{x:-17,y:-17,w:34,h:34},
    leads:[{x:0,y:-17,dir:'up'}],
    body:()=>`<circle cx="0" cy="0" r="17" fill="@FILL"/><text class="sym-text" x="0" y="5.5" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="17" font-weight="700" fill="currentColor" stroke="none">M</text>`
  },
  windturbine:{
    label:'Wind Turbine',
    bbox:{x:-15,y:-21,w:30,h:30},
    leads:[{x:0,y:9,dir:'down'}],
    body:()=>`<circle cx="0" cy="-6" r="15" fill="@FILL"/><line x1="0" y1="-6" x2="0" y2="-20"/><line x1="0" y1="-6" x2="12" y2="2"/><line x1="0" y1="-6" x2="-12" y2="2"/><circle cx="0" cy="-6" r="2.4" fill="currentColor" stroke="none"/>`
  },
  solarpv:{
    label:'Solar PV',
    bbox:{x:-16,y:-16,w:32,h:32},
    leads:[{x:0,y:16,dir:'down'}],
    body:()=>`<rect x="-16" y="-16" width="32" height="32" rx="1" fill="@FILL"/><path d="M-16 -16 L0 3 L16 -16" fill="none"/>`
  },
  inverter:{
    label:'Inverter',
    bbox:{x:-16,y:-16,w:32,h:32},
    leads:[{x:0,y:-16,dir:'up'},{x:0,y:16,dir:'down'}],
    body:()=>`<rect x="-16" y="-16" width="32" height="32" rx="1" fill="@FILL"/><line x1="-16" y1="16" x2="16" y2="-16"/><path d="M-12 -6 q2 -5 4 0 t4 0" fill="none"/><line x1="2" y1="7" x2="12" y2="7"/><line x1="2" y1="11" x2="12" y2="11"/>`
  },
  battery:{
    label:'Battery Storage (BESS)',
    bbox:{x:-16,y:-16,w:32,h:32},
    leads:[{x:0,y:-16,dir:'up'}],
    body:()=>`<rect x="-16" y="-16" width="32" height="32" rx="1" fill="@FILL"/><path d="M2 -11 L-6 2 L0 2 L-2 11 L7 -2 L1 -2 Z" fill="currentColor" stroke="none"/>`
  },
  breaker:{
    label:'Circuit Breaker',
    bbox:{x:-7,y:-9,w:14,h:18},
    leads:[{x:0,y:-9,dir:'up'},{x:0,y:9,dir:'down'}],
    body:(el)=>`<rect x="-7" y="-9" width="14" height="18" rx="1.5" fill="${el&&el.open?'@FILL':'currentColor'}" stroke="currentColor"/>`
  },
  node:{
    label:'Node (junction)',
    bbox:{x:-5,y:-5,w:10,h:10},
    leads:[{x:0,y:0,dir:'down'}],
    isNode:true,
    body:()=>`<circle cx="0" cy="0" r="4.5" fill="currentColor" stroke="none"/>`
  },
};
const PALETTE_ORDER = ['transformer2','generator','busbar','load','transformer3','motor','windturbine','solarpv','inverter','battery','breaker','node'];
const COLORS = ['#E6194B','#3CB44B','#4363D8','#F58231','#911EB4','#0DA9A0','#F032E6','#9A6324','#469990','#800000','#808000','#000075','#E6A817','#7A4FD0'];
const SWATCHES = ['#243049','#E6194B','#3CB44B','#4363D8','#F58231','#911EB4','#0DAA8E','#E6A817','#6B7A99'];

/* ── State ─────────────────────────────────────────────────── */
const S = {
  bgType:'blank', name:'Untitled SLD',
  elements:[], lines:[],
  colorMode:'none', mode:'select',
  selected:null,            // {kind:'element'|'line', id}
  nextId:1, isDirty:false,
  map:null, mapView:null, mapMove:false,
};
const uid = (p)=> p+(S.nextId++);
const getEl   = id => S.elements.find(e=>e.id===id);
const getLine = id => S.lines.find(l=>l.id===id);
const clamp = (v,lo,hi)=>Math.max(lo,Math.min(hi,v));

/* ── DOM refs ──────────────────────────────────────────────── */
const $ = s => document.querySelector(s);
const board=$('#sldBoard'), svg=$('#svgLayer');
const layerLines=$('#layerLines'), layerEls=$('#layerEls'), layerOverlay=$('#layerOverlay');
const appMain=$('#appMain'), inspector=$('#inspector'), inspBody=$('#inspBody'), inspTitle=$('#inspTitle');

/* ── Dirty tracking ────────────────────────────────────────── */
function markDirty(){ S.isDirty=true; $('#dirtyDot').classList.add('visible'); }
function markClean(){ S.isDirty=false; $('#dirtyDot').classList.remove('visible'); }

/* ════════════════════════════════════════════════════════════
   GEOMETRY HELPERS
   ════════════════════════════════════════════════════════════ */
// local (already-scaled) point → world, applying element rotation + translation
function lrot(el, lx, ly){
  const r=el.rot*Math.PI/180, cs=Math.cos(r), sn=Math.sin(r);
  return { x: el.x + lx*cs - ly*sn, y: el.y + lx*sn + ly*cs };
}
function rotDir(dir, rot){
  const base=DIRV[dir]||[0,1];
  const r=rot*Math.PI/180, cs=Math.cos(r), sn=Math.sin(r);
  return {x: base[0]*cs - base[1]*sn, y: base[0]*sn + base[1]*cs};
}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function nearestOnSeg(p,a,b){
  const dx=b.x-a.x, dy=b.y-a.y, L=dx*dx+dy*dy;
  let t = L? ((p.x-a.x)*dx+(p.y-a.y)*dy)/L : 0;
  t=Math.max(0,Math.min(1,t));
  return {t, point:{x:a.x+dx*t, y:a.y+dy*t}};
}
function busHalf(el){ return 46*el.scale; }

// World terminal point + leave-direction for a terminal index
function termPoint(el, idx, other){
  const def=SYM[el.type];
  if(def.isNode){
    let dir={x:0,y:1};
    if(other){ const dx=other.x-el.x, dy=other.y-el.y, L=Math.hypot(dx,dy)||1; dir={x:dx/L,y:dy/L}; }
    return {x:el.x, y:el.y, dir};
  }
  const leads=def.leads||[];
  const ld=leads[Math.min(idx,leads.length-1)]||{x:0,y:0,dir:'down'};
  const ax=ld.x*el.scale, ay=ld.y*el.scale;
  const d=DIRV[ld.dir]||[0,1];
  const ex=ax+d[0]*LEAD, ey=ay+d[1]*LEAD;
  const w=lrot(el,ex,ey);
  return {x:w.x, y:w.y, dir:rotDir(ld.dir, el.rot)};
}
// world point + leave-direction for a connection {elId, kind, idx|t}
function connPoint(conn, other){
  const el=getEl(conn.elId); if(!el) return null;
  if(conn.kind==='bar'){
    const half=busHalf(el);
    const lx=-half + (conn.t==null?0.5:conn.t)*2*half;
    const w=lrot(el, lx, 0);
    let dir={x:0,y:1};
    if(other){ dir = (other.y < w.y) ? {x:0,y:-1} : {x:0,y:1}; }
    return {x:w.x, y:w.y, dir};
  }
  return termPoint(el, conn.idx||0, other);
}
function nearestConn(pt, excludeElId){
  let best=null, bd=Infinity;
  for(const el of S.elements){
    if(el.id===excludeElId) continue;
    const def=SYM[el.type];
    if(def.bar){
      const half=busHalf(el);
      const a=lrot(el,-half,0), b=lrot(el,half,0);
      const n=nearestOnSeg(pt,a,b), d=dist(pt,n.point);
      if(d<bd){ bd=d; best={elId:el.id, kind:'bar', t:n.t, world:n.point}; }
      continue;
    }
    if(def.isNode){
      const d=dist(pt,{x:el.x,y:el.y});
      if(d<bd){ bd=d; best={elId:el.id, kind:'term', idx:0, world:{x:el.x,y:el.y}}; }
      continue;
    }
    (def.leads||[]).forEach((ld,i)=>{
      const p=termPoint(el,i), d=dist(pt,p);
      if(d<bd){ bd=d; best={elId:el.id, kind:'term', idx:i, world:{x:p.x,y:p.y}}; }
    });
  }
  return bd<=SNAP_MAX ? best : null;
}

/* ── Orthogonal auto-routing (click mode) ─────────────────── */
function routeOrtho(from, to){
  const p1=connPoint(to);                    // resolve end first (for busbar dir)
  const p0=connPoint(from, p1);
  const p1b=connPoint(to, p0);
  const a={x:p0.x+p0.dir.x*STUB, y:p0.y+p0.dir.y*STUB};
  const b={x:p1b.x+p1b.dir.x*STUB, y:p1b.y+p1b.dir.y*STUB};
  const pts=[{x:p0.x,y:p0.y}, a];
  const horiz0=Math.abs(p0.dir.x)>Math.abs(p0.dir.y);
  if(Math.abs(a.x-b.x)>1 && Math.abs(a.y-b.y)>1){
    pts.push( horiz0 ? {x:b.x,y:a.y} : {x:a.x,y:b.y} );
  }
  pts.push(b, {x:p1b.x,y:p1b.y});
  return dedupe(pts);
}
function dedupe(pts){
  const out=[];
  for(const p of pts){
    const last=out[out.length-1];
    if(!last || Math.hypot(last.x-p.x,last.y-p.y)>0.5) out.push(p);
  }
  if(out.length<3) return out;
  // remove collinear middle points
  const res=[out[0]];
  for(let i=1;i<out.length-1;i++){
    const a=res[res.length-1], b=out[i], c=out[i+1];
    const cross=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    if(Math.abs(cross)>0.5) res.push(b);
  }
  res.push(out[out.length-1]);
  return res;
}
// Similarity transform mapping captured scribble onto current terminals
function similarityMap(pts, A0,A1, B0,B1){
  const ax=A1.x-A0.x, ay=A1.y-A0.y, da=ax*ax+ay*ay;
  if(da<1e-6) return pts.map(()=>({x:B0.x,y:B0.y}));
  const bx=B1.x-B0.x, by=B1.y-B0.y;
  const kr=(bx*ax+by*ay)/da, ki=(by*ax-bx*ay)/da;
  return pts.map(p=>{ const vx=p.x-A0.x, vy=p.y-A0.y;
    return { x:B0.x + (kr*vx - ki*vy), y:B0.y + (ki*vx + kr*vy) }; });
}
function linePoints(line){
  const p0r=connPoint(line.from), p1r=connPoint(line.to);
  if(!p0r||!p1r) return [];
  if(line.waypoints && line.waypoints.length){
    const p0=connPoint(line.from, line.waypoints[0]);
    const p1=connPoint(line.to, line.waypoints[line.waypoints.length-1]);
    return dedupe([{x:p0.x,y:p0.y}, ...line.waypoints.map(w=>({x:w.x,y:w.y})), {x:p1.x,y:p1.y}]);
  }
  if(line.mode==='scribble' && line.raw && line.raw.length>=2){
    return similarityMap(line.raw, line.raw[0], line.raw[line.raw.length-1],
                         {x:p0r.x,y:p0r.y},{x:p1r.x,y:p1r.y});
  }
  return routeOrtho(line.from, line.to);
}
// Douglas–Peucker simplification
function simplify(pts, eps){
  if(pts.length<3) return pts.slice();
  const keep=new Array(pts.length).fill(false);
  keep[0]=keep[pts.length-1]=true;
  (function rec(s,e){
    let md=0, idx=-1;
    const a=pts[s], b=pts[e];
    for(let i=s+1;i<e;i++){
      const n=nearestOnSeg(pts[i],a,b), d=dist(pts[i],n.point);
      if(d>md){ md=d; idx=i; }
    }
    if(md>eps && idx>0){ keep[idx]=true; rec(s,idx); rec(idx,e); }
  })(0,pts.length-1);
  return pts.filter((_,i)=>keep[i]);
}

/* ════════════════════════════════════════════════════════════
   COLOUR LOGIC
   ════════════════════════════════════════════════════════════ */
function colorKey(item){
  if(S.colorMode==='voltage') return (item.voltage||'').toString().trim();
  if(S.colorMode==='tag')     return (item.tags&&item.tags[0])||'';
  return '';
}
function buildColorMap(){
  if(S.colorMode==='none') return null;
  const keys=new Set();
  S.elements.forEach(e=>{ const k=colorKey(e); if(k) keys.add(k); });
  S.lines.forEach(l=>{ const k=colorKey(l); if(k) keys.add(k); });
  const sorted=[...keys].sort((a,b)=>{
    const na=parseFloat(a), nb=parseFloat(b);
    if(!isNaN(na)&&!isNaN(nb)) return na-nb;
    return a.localeCompare(b);
  });
  const map={};
  sorted.forEach((k,i)=> map[k]=COLORS[i%COLORS.length]);
  return map;
}
let COLOR_MAP=null;
function inkDefault(){ return getComputedStyle(document.body).getPropertyValue('--sld-ink').trim()||'#243049'; }
function displayColor(item, forExport){
  if(COLOR_MAP){ const k=colorKey(item); if(k && COLOR_MAP[k]) return COLOR_MAP[k]; }
  if(item.color) return item.color;
  return forExport ? '#243049' : inkDefault();
}

/* ════════════════════════════════════════════════════════════
   RENDER
   ════════════════════════════════════════════════════════════ */
function el2(tag,attrs){ const e=document.createElementNS(SVGNS,tag);
  for(const k in attrs) e.setAttribute(k,attrs[k]); return e; }

// Inner markup (children of the element <g>): scaled body + fixed-length leads.
function elementInner(el, fill){
  const def=SYM[el.type];
  if(def.bar){
    const len=92*el.scale;
    return `<rect x="${(-len/2).toFixed(1)}" y="-3.5" width="${len.toFixed(1)}" height="7" rx="2" fill="currentColor" stroke="none"/>`;
  }
  if(def.isNode){
    return def.body().replace(/@FILL/g,fill);
  }
  const bodyStr=def.body(el).replace(/@FILL/g,fill);
  let leads='';
  (def.leads||[]).forEach(ld=>{
    const ax=ld.x*el.scale, ay=ld.y*el.scale;
    const d=DIRV[ld.dir]||[0,1];
    const ex=ax+d[0]*LEAD, ey=ay+d[1]*LEAD;
    leads+=`<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}"/>`;
  });
  return `<g class="sym"><g transform="scale(${el.scale})">${bodyStr}</g>${leads}</g>`;
}

function renderAll(){
  COLOR_MAP=buildColorMap();
  layerLines.innerHTML=''; layerEls.innerHTML='';
  S.lines.forEach(renderLine);
  S.elements.forEach(renderElement);
  renderOverlay();
  renderLegend();
}
function renderElement(el){
  const g=el2('g',{class:'sld-el','data-id':el.id,
    transform:`translate(${el.x} ${el.y}) rotate(${el.rot})`,
    style:`color:${displayColor(el)}`});
  g.innerHTML=elementInner(el,'var(--sld-fill)');
  layerEls.appendChild(g);
  renderLabel(el);
}
// default label position (below the element body), straight regardless of rotation
function labelPos(el){
  if(el.labelDx!=null && el.labelDy!=null) return {x:el.x+el.labelDx, y:el.y+el.labelDy};
  const def=SYM[el.type];
  let below;
  if(def.bar) below = 3.5 + 15;
  else if(def.isNode) below = 13;
  else below = (def.bbox.y+def.bbox.h)*el.scale + LEAD + 13;
  return {x:el.x, y:el.y+below};
}
function renderLabel(el){
  if(!el.name) return;
  const p=labelPos(el);
  const t=el2('text',{class:'el-label','data-label':el.id, x:p.x.toFixed(1), y:p.y.toFixed(1),
    'font-size':(el.labelSize||12)});
  t.textContent=el.name;
  layerEls.appendChild(t);
}
function renderLine(line){
  const pts=linePoints(line); if(pts.length<2) return;
  const ptStr=pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const hit=el2('polyline',{class:'sld-line-hit',points:ptStr,'data-line':line.id});
  const pl=el2('polyline',{class:'sld-line',points:ptStr,'data-line':line.id,
    stroke:displayColor(line)});
  layerLines.appendChild(hit); layerLines.appendChild(pl);
  if(line.name){
    const mid=pts[Math.floor(pts.length/2)];
    const t=el2('text',{class:'line-label',x:mid.x,y:mid.y-6,'font-size':(line.labelSize||11)});
    t.textContent=line.name;
    layerLines.appendChild(t);
  }
}
function renderLegend(){
  const lg=$('#legend');
  if(!COLOR_MAP || Object.keys(COLOR_MAP).length===0){ lg.classList.remove('show'); return; }
  const unit=S.colorMode==='voltage'?' kV':'';
  lg.innerHTML=`<div class="legend-title">${S.colorMode==='voltage'?'Voltage':'Tag'}</div>`+
    Object.entries(COLOR_MAP).map(([k,c])=>
      `<div class="legend-row"><span class="legend-sw" style="background:${c}"></span>${escapeHtml(k)}${unit}</div>`).join('');
  lg.classList.add('show');
}

/* ── Selection overlay (bbox + rotate/scale handles + waypoints) ──── */
function elBBoxCorners(el){
  const def=SYM[el.type];
  if(def.bar){ const half=busHalf(el);
    return [lrot(el,-half,-5),lrot(el,half,-5),lrot(el,half,5),lrot(el,-half,5)]; }
  if(def.isNode){ const r=8;
    return [lrot(el,-r,-r),lrot(el,r,-r),lrot(el,r,r),lrot(el,-r,r)]; }
  const bb=def.bbox, s=el.scale;
  return [lrot(el,bb.x*s,bb.y*s),lrot(el,(bb.x+bb.w)*s,bb.y*s),
          lrot(el,(bb.x+bb.w)*s,(bb.y+bb.h)*s),lrot(el,bb.x*s,(bb.y+bb.h)*s)];
}
function renderOverlay(){
  layerOverlay.innerHTML='';
  if(!S.selected) return;
  if(S.selected.kind==='line'){ renderLineOverlay(getLine(S.selected.id)); return; }
  const el=getEl(S.selected.id); if(!el) return;
  const corners=elBBoxCorners(el);
  const poly=el2('polygon',{class:'sel-box',
    points:corners.map(c=>`${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')});
  layerOverlay.appendChild(poly);
  if(SYM[el.type].isNode) return;  // node: no rotate/scale handles
  // rotate handle above the top-mid edge
  const mid01={x:(corners[0].x+corners[1].x)/2, y:(corners[0].y+corners[1].y)/2};
  const dir=rotDir('up', el.rot);
  const topMid={x:mid01.x+dir.x*22, y:mid01.y+dir.y*22};
  const line=el2('line',{x1:mid01.x,y1:mid01.y,x2:topMid.x,y2:topMid.y,
    stroke:'var(--accent-strong)','stroke-width':1.2});
  layerOverlay.appendChild(line);
  const rh=el2('g',{class:'handle rot'}); rh.appendChild(el2('circle',{cx:topMid.x,cy:topMid.y,r:6}));
  rh.addEventListener('pointerdown',e=>startRotate(e,el));
  layerOverlay.appendChild(rh);
  // scale handle at bottom-right corner
  const sc=corners[2];
  const sh=el2('g',{class:'handle scale'});
  sh.appendChild(el2('rect',{x:sc.x-5,y:sc.y-5,width:10,height:10,rx:2}));
  sh.addEventListener('pointerdown',e=>startScale(e,el));
  layerOverlay.appendChild(sh);
}
function renderLineOverlay(line){
  if(!line || !line.waypoints) return;
  line.waypoints.forEach((w,i)=>{
    const h=el2('g',{class:'handle wp'});
    h.appendChild(el2('circle',{cx:w.x,cy:w.y,r:6}));
    h.addEventListener('pointerdown',e=>startWaypointDrag(e,line,i));
    h.addEventListener('contextmenu',e=>{ e.preventDefault(); deleteWaypoint(line,i); });
    layerOverlay.appendChild(h);
  });
}
function escapeHtml(s){ return (s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* ════════════════════════════════════════════════════════════
   COORDINATE conversion (pointer → board) + MAP GEO
   ════════════════════════════════════════════════════════════ */
function boardPt(evt){
  const r=board.getBoundingClientRect();
  return { x:(evt.clientX-r.left)/r.width*BOARD_W, y:(evt.clientY-r.top)/r.height*BOARD_H };
}
function geoFromPx(x,y){ if(!S.map) return null; const ll=S.map.containerPointToLatLng([x,y]); return [ll.lat,ll.lng]; }
function pxFromGeo(g){ const p=S.map.latLngToContainerPoint(L.latLng(g[0],g[1])); return {x:p.x,y:p.y}; }
// Assign geo coords to anything that lacks one (called on entering map mode)
function attachGeo(){
  if(S.bgType!=='map'||!S.map) return;
  S.elements.forEach(e=>{ if(!e.geo) e.geo=geoFromPx(e.x,e.y); });
  S.lines.forEach(l=>{ if(l.waypoints) l.waypoints.forEach(w=>{ if(!w.geo) w.geo=geoFromPx(w.x,w.y); }); });
}
// Re-derive pixel coords from geo (called on map pan/zoom) so elements stick to the ground
function refreshGeo(){
  if(S.bgType!=='map'||!S.map) return;
  S.elements.forEach(e=>{ if(e.geo){ const p=pxFromGeo(e.geo); e.x=p.x; e.y=p.y; } });
  S.lines.forEach(l=>{ if(l.waypoints) l.waypoints.forEach(w=>{ if(w.geo){ const p=pxFromGeo(w.geo); w.x=p.x; w.y=p.y; } }); });
}
function syncElGeo(el){ if(S.bgType==='map'&&S.map) el.geo=geoFromPx(el.x,el.y); }

/* ════════════════════════════════════════════════════════════
   ELEMENT CRUD
   ════════════════════════════════════════════════════════════ */
function addElement(type,x,y,scale){
  const el={id:uid('e'),type,x:Math.round(x),y:Math.round(y),rot:0,scale:scale||1,
    name:DEFAULT_NAMES[type]+(countType(type)+1), tags:[], voltage:'', color:'',
    labelDx:null, labelDy:null, labelSize:12,
    open: type==='breaker'? false : undefined};
  syncElGeo(el);
  S.elements.push(el); markDirty(); renderAll();
  select('element',el.id);
  return el;
}
function countType(type){ return S.elements.filter(e=>e.type===type).length; }
function deleteElement(id){
  S.elements=S.elements.filter(e=>e.id!==id);
  S.lines=S.lines.filter(l=>l.from.elId!==id && l.to.elId!==id);
  if(S.selected&&S.selected.id===id) clearSelection();
  markDirty(); renderAll();
}
function deleteLine(id){
  S.lines=S.lines.filter(l=>l.id!==id);
  if(S.selected&&S.selected.id===id) clearSelection();
  markDirty(); renderAll();
}

/* ════════════════════════════════════════════════════════════
   SELECTION + INSPECTOR
   ════════════════════════════════════════════════════════════ */
function select(kind,id){ S.selected={kind,id}; appMain.classList.add('has-sel');
  inspector.classList.add('open'); renderOverlay(); renderInspector(); }
function clearSelection(){ S.selected=null; appMain.classList.remove('has-sel');
  inspector.classList.remove('open'); layerOverlay.innerHTML=''; }

function field(label, inner){ return `<div class="field"><label>${label}</label>${inner}</div>`; }
function swatchRow(){ return `<div class="swatches">${SWATCHES.map(c=>`<span class="swatch" data-color="${c}" style="background:${c}"></span>`).join('')}</div>`; }

function renderInspector(){
  if(!S.selected) return;
  if(S.selected.kind==='element') renderElInspector(getEl(S.selected.id));
  else renderLineInspector(getLine(S.selected.id));
}
function renderElInspector(el){
  if(!el) return; inspTitle.textContent='Element';
  const def=SYM[el.type];
  const typeOpts=PALETTE_ORDER.map(t=>`<option value="${t}" ${t===el.type?'selected':''}>${SYM[t].label}</option>`).join('');
  const isNode=def.isNode;
  inspBody.innerHTML=
    field('Type',`<select id="fType">${typeOpts}</select>`)+
    field('Name',`<input type="text" id="fName" value="${escapeHtml(el.name)}" placeholder="Label…">`)+
    field('Tags (comma separated)',`<input type="text" id="fTags" value="${escapeHtml(el.tags.join(', '))}" placeholder="e.g. feeder-1, MV">`)+
    field('Voltage (kV)',`<input type="text" id="fVolt" value="${escapeHtml(el.voltage)}" placeholder="e.g. 11">`)+
    (el.type==='breaker'? field('State',`<button class="btn btn-block" id="fToggle">${el.open?'◻ Open — click to close':'◼ Closed — click to open'}</button>`):'')+
    field('Rotation',`<div class="row"><input type="range" id="fRot" min="0" max="360" step="5" value="${el.rot}"><span class="rng-val" id="fRotV">${el.rot}°</span></div>`)+
    (isNode? '' : field('Size',`<div class="row"><input type="range" id="fScale" min="0.5" max="4" step="0.1" value="${el.scale}"><span class="rng-val" id="fScaleV">${el.scale.toFixed(1)}×</span></div>`))+
    field('Label size',`<div class="row"><input type="range" id="fLblSize" min="8" max="30" step="1" value="${el.labelSize||12}"><span class="rng-val" id="fLblV">${el.labelSize||12}px</span></div>`)+
    `<button class="btn btn-block" id="fLblReset" style="margin-bottom:13px">↺ Reset label position</button>`+
    field('Colour'+(S.colorMode!=='none'?' (overridden by colour coding)':''),
      `<div class="color-row"><input type="color" id="fColor" value="${el.color||'#243049'}">${swatchRow()}</div>`)+
    `<button class="btn btn-danger btn-block" id="fDelete">🗑 Delete element</button>`;
  bindElInspector(el);
}
function bindElInspector(el){
  $('#fType').onchange=e=>{ el.type=e.target.value; if(el.type==='breaker'&&el.open===undefined)el.open=false; markDirty(); renderAll(); renderInspector(); };
  $('#fName').oninput=e=>{ el.name=e.target.value; markDirty(); renderAll(); };
  $('#fTags').oninput=e=>{ el.tags=e.target.value.split(',').map(s=>s.trim()).filter(Boolean); markDirty(); renderAll(); };
  $('#fVolt').oninput=e=>{ el.voltage=e.target.value.trim(); markDirty(); renderAll(); };
  const tog=$('#fToggle'); if(tog) tog.onclick=()=>{ el.open=!el.open; markDirty(); renderAll(); renderInspector(); };
  $('#fRot').oninput=e=>{ el.rot=+e.target.value; $('#fRotV').textContent=el.rot+'°'; markDirty(); renderAll(); };
  const sc=$('#fScale'); if(sc) sc.oninput=e=>{ el.scale=+e.target.value; $('#fScaleV').textContent=el.scale.toFixed(1)+'×'; markDirty(); renderAll(); };
  $('#fLblSize').oninput=e=>{ el.labelSize=+e.target.value; $('#fLblV').textContent=el.labelSize+'px'; markDirty(); renderAll(); };
  $('#fLblReset').onclick=()=>{ el.labelDx=null; el.labelDy=null; markDirty(); renderAll(); };
  $('#fColor').oninput=e=>{ el.color=e.target.value; markDirty(); renderAll(); };
  inspBody.querySelectorAll('.swatch').forEach(s=>s.onclick=()=>{ el.color=s.dataset.color; $('#fColor').value=s.dataset.color; markDirty(); renderAll(); });
  $('#fDelete').onclick=()=>deleteElement(el.id);
}
function renderLineInspector(line){
  if(!line) return; inspTitle.textContent='Line';
  inspBody.innerHTML=
    field('Name',`<input type="text" id="lName" value="${escapeHtml(line.name)}" placeholder="Label…">`)+
    field('Tags (comma separated)',`<input type="text" id="lTags" value="${escapeHtml(line.tags.join(', '))}" placeholder="e.g. cable-1">`)+
    field('Voltage (kV)',`<input type="text" id="lVolt" value="${escapeHtml(line.voltage)}" placeholder="e.g. 11">`)+
    field('Label size',`<div class="row"><input type="range" id="lLblSize" min="8" max="28" step="1" value="${line.labelSize||11}"><span class="rng-val" id="lLblV">${line.labelSize||11}px</span></div>`)+
    field('Colour'+(S.colorMode!=='none'?' (overridden by colour coding)':''),
      `<div class="color-row"><input type="color" id="lColor" value="${line.color||'#243049'}">${swatchRow()}</div>`)+
    `<div class="insp-hint">Routing: ${line.waypoints&&line.waypoints.length?'custom route ('+line.waypoints.length+' node'+(line.waypoints.length>1?'s':'')+')':(line.mode==='scribble'?'follows your scribble':'auto orthogonal')}. Connects <b>${connName(line.from)}</b> → <b>${connName(line.to)}</b>.<br>Double-click the line to add a route node; drag nodes to bend it; right-click a node to delete.</div>`+
    `<button class="btn btn-block" id="lFlip" style="margin-top:10px">↔ Toggle routing style</button>`+
    (line.waypoints&&line.waypoints.length?`<button class="btn btn-block" id="lClearWp">⌫ Clear route nodes</button>`:'')+
    `<button class="btn btn-danger btn-block" id="lDelete">🗑 Delete line</button>`;
  $('#lName').oninput=e=>{ line.name=e.target.value; markDirty(); renderAll(); };
  $('#lTags').oninput=e=>{ line.tags=e.target.value.split(',').map(s=>s.trim()).filter(Boolean); markDirty(); renderAll(); };
  $('#lVolt').oninput=e=>{ line.voltage=e.target.value.trim(); markDirty(); renderAll(); };
  $('#lLblSize').oninput=e=>{ line.labelSize=+e.target.value; $('#lLblV').textContent=line.labelSize+'px'; markDirty(); renderAll(); };
  $('#lColor').oninput=e=>{ line.color=e.target.value; markDirty(); renderAll(); };
  inspBody.querySelectorAll('.swatch').forEach(s=>s.onclick=()=>{ line.color=s.dataset.color; $('#lColor').value=s.dataset.color; markDirty(); renderAll(); });
  $('#lFlip').onclick=()=>{ line.mode = line.mode==='scribble' ? 'click' : (line.raw? 'scribble':'click'); markDirty(); renderAll(); renderInspector(); };
  const cw=$('#lClearWp'); if(cw) cw.onclick=()=>{ line.waypoints=[]; markDirty(); renderAll(); renderOverlay(); renderInspector(); };
  $('#lDelete').onclick=()=>deleteLine(line.id);
}
function connName(c){ const el=getEl(c.elId); return el? el.name||SYM[el.type].label : '?'; }

$('#inspClose').onclick=clearSelection;

/* ════════════════════════════════════════════════════════════
   POINTER INTERACTION on the SVG board
   ════════════════════════════════════════════════════════════ */
let drag=null;          // element move
let labelDrag=null;     // label move
let pendingLine=null;   // first endpoint in click-line mode
let scribble=null;      // active freehand stroke
let scribbleStrokes=[]; // accumulated strokes (graceful multi-stroke recognition)
let scribbleTimer=null;
const SCRIBBLE_PAUSE=650;

svg.addEventListener('pointerdown', onPointerDown);

function onPointerDown(e){
  if(e.button!==0) return;
  const pt=boardPt(e);
  const labelNode=e.target.closest('[data-label]');
  const elNode=e.target.closest('.sld-el');
  const lineNode=e.target.closest('[data-line]');

  if(S.mode==='select'){
    if(labelNode){
      const el=getEl(labelNode.dataset.label);
      const p=labelPos(el);
      labelDrag={el, start:pt, ox:p.x-el.x, oy:p.y-el.y};
      svg.setPointerCapture(e.pointerId); e.preventDefault();
      return;
    }
    if(elNode){
      const el=getEl(elNode.dataset.id);
      select('element',el.id);
      drag={el, start:pt, ox:el.x, oy:el.y, moved:false, breaker:el.type==='breaker'};
      svg.setPointerCapture(e.pointerId);
      e.preventDefault();
    } else if(lineNode){
      select('line', lineNode.dataset.line);
    } else {
      clearSelection();
    }
    return;
  }
  if(S.mode==='line'){
    const c=nearestConn(pt);
    if(!c){ toast('Click closer to an element terminal','error'); return; }
    if(!pendingLine){ pendingLine=c; showTempMark(c.world); }
    else{
      if(c.elId===pendingLine.elId){ toast('Pick a different element','error'); return; }
      createLine(pendingLine, c, 'click');
      pendingLine=null; layerOverlay.innerHTML=''; renderOverlay();
    }
    return;
  }
  if(S.mode==='line-scribble'){
    scribble={pts:[pt], el:null};
    scribble.el=el2('polyline',{class:'scribble-path',points:`${pt.x},${pt.y}`});
    layerOverlay.appendChild(scribble.el);
    svg.setPointerCapture(e.pointerId); e.preventDefault();
    return;
  }
  if(S.mode==='scribble'){
    if(scribbleTimer){ clearTimeout(scribbleTimer); scribbleTimer=null; }
    scribble={pts:[pt], el:null};
    scribble.el=el2('polyline',{class:'scribble-path',points:`${pt.x},${pt.y}`});
    layerOverlay.appendChild(scribble.el);
    svg.setPointerCapture(e.pointerId); e.preventDefault();
  }
}

svg.addEventListener('pointermove', e=>{
  const pt=boardPt(e);
  if(labelDrag){
    const dx=pt.x-labelDrag.start.x, dy=pt.y-labelDrag.start.y;
    labelDrag.el.labelDx=clamp(labelDrag.ox+dx,-160,160);
    labelDrag.el.labelDy=clamp(labelDrag.oy+dy,-160,160);
    markDirty(); renderAll();
  } else if(drag){
    const dx=pt.x-drag.start.x, dy=pt.y-drag.start.y;
    if(Math.abs(dx)>2||Math.abs(dy)>2) drag.moved=true;
    drag.el.x=Math.round(drag.ox+dx); drag.el.y=Math.round(drag.oy+dy);
    syncElGeo(drag.el);
    markDirty(); renderAll();
  } else if(scribble){
    scribble.pts.push(pt);
    scribble.el.setAttribute('points', scribble.pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
  }
});

svg.addEventListener('pointerup', e=>{
  if(labelDrag){ labelDrag=null; return; }
  if(drag){
    if(drag.breaker && !drag.moved){ drag.el.open=!drag.el.open; markDirty(); renderAll(); renderInspector(); }
    drag=null;
    return;
  }
  if(scribble){
    const pts=scribble.pts.slice();
    const sc=scribble; scribble=null;
    if(S.mode==='line-scribble'){
      layerOverlay.innerHTML=''; renderOverlay();
      if(pts.length>=3) finishScribbleLine(pts);
      return;
    }
    // element scribble — accumulate strokes, recognise after a pause
    if(pts.length>=2) scribbleStrokes.push(pts);
    if(scribbleTimer) clearTimeout(scribbleTimer);
    scribbleTimer=setTimeout(()=>{ scribbleTimer=null; finishScribbleElement(); }, SCRIBBLE_PAUSE);
  }
});

// double-click a line to add a route node; double-click empty in scribble mode is ignored
svg.addEventListener('dblclick', e=>{
  if(S.mode!=='select') return;
  const lineNode=e.target.closest('[data-line]');
  if(!lineNode) return;
  const line=getLine(lineNode.dataset.line); if(!line) return;
  addWaypoint(line, boardPt(e));
});

function showTempMark(p){
  const m=el2('circle',{cx:p.x,cy:p.y,r:6,class:'term-dot'});
  layerOverlay.appendChild(m);
}

/* ── Element rotate / scale handle drags ─────────────────── */
function startRotate(e,el){
  e.stopPropagation(); svg.setPointerCapture(e.pointerId);
  const move=ev=>{ const p=boardPt(ev);
    let ang=Math.atan2(p.x-el.x, -(p.y-el.y))*180/Math.PI; // 0 = up
    if(ev.shiftKey) ang=Math.round(ang/15)*15;
    el.rot=Math.round((ang+360)%360); markDirty(); renderAll(); if($('#fRot')){$('#fRot').value=el.rot;$('#fRotV').textContent=el.rot+'°';} };
  const up=()=>{ svg.removeEventListener('pointermove',move); svg.removeEventListener('pointerup',up); };
  svg.addEventListener('pointermove',move); svg.addEventListener('pointerup',up);
}
function startScale(e,el){
  e.stopPropagation(); svg.setPointerCapture(e.pointerId);
  const def=SYM[el.type];
  let diag;
  if(def.bar) diag=46;
  else diag=Math.hypot(def.bbox.w,def.bbox.h)/2;
  const move=ev=>{ const p=boardPt(ev); const d=dist({x:el.x,y:el.y},p);
    el.scale=clamp(d/diag,0.5,4); markDirty(); renderAll();
    if($('#fScale')){$('#fScale').value=el.scale;$('#fScaleV').textContent=el.scale.toFixed(1)+'×';} };
  const up=()=>{ svg.removeEventListener('pointermove',move); svg.removeEventListener('pointerup',up); };
  svg.addEventListener('pointermove',move); svg.addEventListener('pointerup',up);
}

/* ── Line waypoint (route node) editing ──────────────────── */
function addWaypoint(line, pt){
  if(!line.waypoints) line.waypoints=[];
  // insert at the nearest segment so the route stays sensible
  const pts=linePoints(line);
  let bestSeg=0, bd=Infinity;
  for(let i=0;i<pts.length-1;i++){
    const n=nearestOnSeg(pt,pts[i],pts[i+1]), d=dist(pt,n.point);
    if(d<bd){ bd=d; bestSeg=i; }
  }
  // map segment index in rendered pts to waypoint insert index
  // rendered pts = [start, ...waypoints, end]; segment i sits before waypoint index i
  const insertIdx=Math.min(bestSeg, line.waypoints.length);
  const wp={x:Math.round(pt.x), y:Math.round(pt.y)};
  if(S.bgType==='map'&&S.map) wp.geo=geoFromPx(wp.x,wp.y);
  line.waypoints.splice(insertIdx,0,wp);
  markDirty(); select('line',line.id); renderAll(); renderOverlay();
}
function deleteWaypoint(line,i){
  line.waypoints.splice(i,1);
  markDirty(); renderAll(); renderOverlay(); renderInspector();
}
function startWaypointDrag(e,line,i){
  e.stopPropagation(); svg.setPointerCapture(e.pointerId);
  const move=ev=>{ const p=boardPt(ev);
    line.waypoints[i].x=Math.round(p.x); line.waypoints[i].y=Math.round(p.y);
    if(S.bgType==='map'&&S.map) line.waypoints[i].geo=geoFromPx(p.x,p.y);
    markDirty(); renderAll(); renderOverlay(); };
  const up=()=>{ svg.removeEventListener('pointermove',move); svg.removeEventListener('pointerup',up); };
  svg.addEventListener('pointermove',move); svg.addEventListener('pointerup',up);
}

/* ════════════════════════════════════════════════════════════
   LINE CREATION
   ════════════════════════════════════════════════════════════ */
function createLine(from, to, mode, raw){
  const f={elId:from.elId, kind:from.kind, idx:from.idx, t:from.t};
  const t={elId:to.elId,   kind:to.kind,   idx:to.idx,   t:to.t};
  const line={id:uid('l'), name:'', tags:[], voltage:'', color:'', labelSize:11, mode, from:f, to:t, waypoints:[]};
  if(mode==='scribble' && raw) line.raw=raw;
  S.lines.push(line); markDirty(); renderAll(); select('line',line.id);
}
function finishScribbleLine(pts){
  const start=nearestConn(pts[0]);
  const end=nearestConn(pts[pts.length-1], start?start.elId:null);
  if(!start||!end){ toast('Scribble must start and end on elements','error'); return; }
  if(start.elId===end.elId){ toast('Start and end must differ','error'); return; }
  const simp=simplify(pts, 7);
  createLine(start,end,'scribble',simp);
}

/* ── Scribble → element recognition (multi-stroke, graceful) ── */
function strokeInfo(pts){
  let minx=Infinity,miny=Infinity,maxx=-Infinity,maxy=-Infinity;
  for(const p of pts){ minx=Math.min(minx,p.x);maxx=Math.max(maxx,p.x);miny=Math.min(miny,p.y);maxy=Math.max(maxy,p.y); }
  const w=maxx-minx, h=maxy-miny, diag=Math.hypot(w,h);
  const closed=dist(pts[0],pts[pts.length-1]) < 0.32*diag;
  const simp=simplify(pts, Math.max(6,diag*0.06));
  const corners=Math.max(0, simp.length-1);
  let shape;
  if(!closed && (w>1.8*h || h>1.8*w)) shape='line';
  else if(closed && corners<=3) shape='triangle';
  else if(closed && corners<=5){ const a=w/Math.max(1,h); shape=(a>0.7&&a<1.4)?'rect':'triangle'; }
  else shape='circle';
  return {w,h,diag,closed,shape, cx:(minx+maxx)/2, cy:(miny+maxy)/2, minx,miny,maxx,maxy};
}
function recognizeMulti(strokes){
  const infos=strokes.map(strokeInfo);
  let minx=Infinity,miny=Infinity,maxx=-Infinity,maxy=-Infinity;
  infos.forEach(i=>{ minx=Math.min(minx,i.minx);maxx=Math.max(maxx,i.maxx);miny=Math.min(miny,i.miny);maxy=Math.max(maxy,i.maxy); });
  const cx=(minx+maxx)/2, cy=(miny+maxy)/2, w=maxx-minx, h=maxy-miny;
  const circles=infos.filter(i=>i.shape==='circle').length;
  const triangles=infos.filter(i=>i.shape==='triangle').length;
  const rects=infos.filter(i=>i.shape==='rect').length;
  const lines=infos.filter(i=>i.shape==='line').length;
  let type='generator';
  if(strokes.length>=3 && circles>=2) type='transformer3';
  else if(strokes.length===2 && circles>=1) type='transformer2';
  else if(circles===1 && strokes.length===1) type='generator';
  else if(triangles>=1 && circles===0 && rects===0) type='load';
  else if(rects>=1 && circles===0) type='battery';
  else if(lines>=1 && circles===0 && rects===0 && triangles===0) type='busbar';
  else if(circles>=2) type='transformer2';
  return {type, cx, cy, w, h};
}
function finishScribbleElement(){
  const strokes=scribbleStrokes.slice(); scribbleStrokes=[];
  layerOverlay.innerHTML=''; renderOverlay();
  if(!strokes.length) return;
  const r=recognizeMulti(strokes);
  const def=SYM[r.type];
  let scale=1;
  if(def.bar) scale=clamp(Math.max(r.w,r.h)/92, 0.6, 4);
  else { const natural=Math.max(def.bbox.w,def.bbox.h); scale=clamp(Math.max(r.w,r.h)/natural, 0.6, 4); }
  addElement(r.type, r.cx, r.cy, scale);
  toast('Recognised: '+def.label+' — change type in panel if wrong','success');
}

/* ════════════════════════════════════════════════════════════
   PALETTE (drag & drop)
   ════════════════════════════════════════════════════════════ */
function paletteIcon(t){
  const d=SYM[t];
  // build a small preview using the same body + leads model
  let inner;
  if(d.bar){ inner=`<rect x="-30" y="-3" width="60" height="6" rx="2" fill="currentColor" stroke="none"/>`; }
  else if(d.isNode){ inner=`<circle cx="0" cy="0" r="5" fill="currentColor" stroke="none"/>`; }
  else {
    let leads='';
    (d.leads||[]).forEach(ld=>{ const ax=ld.x,ay=ld.y,dv=DIRV[ld.dir]||[0,1];
      leads+=`<line x1="${ax}" y1="${ay}" x2="${ax+dv[0]*LEAD}" y2="${ay+dv[1]*LEAD}"/>`; });
    inner=d.body({open:false}).replace(/@FILL/g,'var(--sld-fill)')+leads;
  }
  return `<svg viewBox="-40 -40 80 80" class="sym"><g class="sym" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`;
}
function buildPalette(){
  const wrap=$('#paletteScroll');
  wrap.innerHTML=PALETTE_ORDER.map(t=>{
    const d=SYM[t];
    return `<div class="pal-item" draggable="true" data-type="${t}">${paletteIcon(t)}<span class="pal-label">${d.label}</span></div>`;
  }).join('');
  wrap.querySelectorAll('.pal-item').forEach(it=>{
    it.addEventListener('dragstart',e=>{ e.dataTransfer.setData('text/sld', it.dataset.type);
      e.dataTransfer.effectAllowed='copy'; });
  });
}
board.addEventListener('dragover',e=>{ if(e.dataTransfer.types.includes('text/sld')){ e.preventDefault(); e.dataTransfer.dropEffect='copy'; } });
board.addEventListener('drop',e=>{
  const type=e.dataTransfer.getData('text/sld'); if(!type) return;
  e.preventDefault(); const p=boardPt(e);
  setMode('select'); addElement(type,p.x,p.y,1);
});

/* ════════════════════════════════════════════════════════════
   MODE SWITCHING
   ════════════════════════════════════════════════════════════ */
function setMode(m){
  S.mode=m; pendingLine=null; scribbleStrokes=[]; if(scribbleTimer){clearTimeout(scribbleTimer);scribbleTimer=null;}
  layerOverlay.innerHTML=''; renderOverlay();
  $('#modeBar').querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===m));
  if(m!=='select') clearSelection();
}
$('#modeBar').querySelectorAll('.mode-btn').forEach(b=> b.onclick=()=>setMode(b.dataset.mode));

/* ════════════════════════════════════════════════════════════
   TOOLBAR controls
   ════════════════════════════════════════════════════════════ */
$('#sldNameInput').oninput=e=>{ S.name=e.target.value||'Untitled SLD'; markDirty(); };
$('#colorModeSelect').onchange=e=>{ S.colorMode=e.target.value; renderAll(); if(S.selected)renderInspector(); };

$('#bgSelect').onchange=e=>{ setBackground(e.target.value); };
$('#mapMoveBtn').onclick=()=>{ S.mapMove=!S.mapMove; board.classList.toggle('map-move',S.mapMove);
  $('#mapMoveBtn').classList.toggle('active',S.mapMove);
  $('#mapMoveBtn').textContent=S.mapMove?'🔒 Lock map':'🗺 Move map';
  if(S.map){ if(S.mapMove){S.map.dragging.enable();S.map.scrollWheelZoom.enable();}
    else{S.map.dragging.disable();S.map.scrollWheelZoom.disable();} } };

function setBackground(type){
  S.bgType=type; markDirty();
  if(type==='map'){
    board.classList.remove('blank');
    $('#mapLayer').style.display='';
    $('#mapMoveBtn').style.display='';
    ensureMap();
  } else {
    board.classList.add('blank');
    $('#mapLayer').style.display='none';   // fix: hide the map when switching back to blank
    $('#mapMoveBtn').style.display='none';
    board.classList.remove('map-move'); S.mapMove=false;
    $('#mapMoveBtn').textContent='🗺 Move map'; $('#mapMoveBtn').classList.remove('active');
    renderAll();
  }
}
function ensureMap(){
  if(S.map){ setTimeout(()=>{ S.map.invalidateSize(); attachGeo(); refreshGeo(); renderAll(); },50); return; }
  if(typeof L==='undefined'){ toast('Map library failed to load','error'); return; }
  S.map=L.map('mapLayer',{zoomControl:true,attributionControl:true,
    dragging:false,scrollWheelZoom:false}).setView(S.mapView?[S.mapView[0],S.mapView[1]]:[-33.8688,151.2093], S.mapView&&S.mapView[2]||13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19, crossOrigin:true,
    attribution:'© OpenStreetMap'}).addTo(S.map);
  S.map.on('move zoom',()=>{ refreshGeo(); renderAll(); });
  S.map.on('moveend zoomend',()=>{ const c=S.map.getCenter(); S.mapView=[c.lat,c.lng,S.map.getZoom()];
    refreshGeo(); renderAll(); markDirty(); });
  setTimeout(()=>{ S.map.invalidateSize(); attachGeo(); refreshGeo(); renderAll(); },60);
}

/* ════════════════════════════════════════════════════════════
   CONFIRM MODAL
   ════════════════════════════════════════════════════════════ */
let _ok=null,_cancel=null;
function showConfirm(icon,title,msg,onOk,onCancel){
  $('#confirmIcon').textContent=icon; $('#confirmTitle').textContent=title; $('#confirmMsg').textContent=msg;
  $('#confirmOverlay').classList.add('open'); _ok=onOk; _cancel=onCancel;
}
$('#confirmOk').onclick=()=>{ $('#confirmOverlay').classList.remove('open'); if(_ok)_ok(); };
$('#confirmCancel').onclick=()=>{ $('#confirmOverlay').classList.remove('open'); if(_cancel)_cancel(); };

/* ════════════════════════════════════════════════════════════
   PNG EXPORT
   ════════════════════════════════════════════════════════════ */
function buildExportSVG(){
  let body='';
  // lines
  S.lines.forEach(line=>{
    const pts=linePoints(line); if(pts.length<2) return;
    const d=pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    body+=`<polyline points="${d}" fill="none" stroke="${displayColor(line,true)}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
    if(line.name){ const m=pts[Math.floor(pts.length/2)];
      body+=`<text x="${m.x}" y="${(m.y-6).toFixed(1)}" font-family="DM Sans,sans-serif" font-size="${line.labelSize||11}" font-weight="600" fill="#1A2236" text-anchor="middle" paint-order="stroke" stroke="#ffffff" stroke-width="3">${escapeHtml(line.name)}</text>`; }
  });
  // elements
  S.elements.forEach(el=>{
    const col=displayColor(el,true);
    body+=`<g transform="translate(${el.x} ${el.y}) rotate(${el.rot})" style="color:${col}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${elementInner(el,'#ffffff')}</g>`;
    if(el.name){ const p=labelPos(el);
      body+=`<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" font-family="DM Sans,sans-serif" font-size="${el.labelSize||12}" font-weight="600" fill="#1A2236" text-anchor="middle">${escapeHtml(el.name)}</text>`; }
  });
  // legend
  if(COLOR_MAP && Object.keys(COLOR_MAP).length){
    const entries=Object.entries(COLOR_MAP); const unit=S.colorMode==='voltage'?' kV':'';
    const lw=150, lh=22+entries.length*18, lx=24, ly=BOARD_H-lh-24;
    body+=`<g><rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" rx="8" fill="#ffffff" stroke="#DDE4F2" stroke-width="1.5"/>`;
    body+=`<text x="${lx+12}" y="${ly+16}" font-family="DM Sans,sans-serif" font-size="9" font-weight="800" fill="#6B7A99" letter-spacing="0.8">${S.colorMode==='voltage'?'VOLTAGE':'TAG'}</text>`;
    entries.forEach(([k,c],i)=>{ const yy=ly+30+i*18;
      body+=`<rect x="${lx+12}" y="${yy-9}" width="12" height="12" rx="3" fill="${c}"/>`+
            `<text x="${lx+30}" y="${yy+1}" font-family="DM Sans,sans-serif" font-size="11" font-weight="600" fill="#1A2236">${escapeHtml(k)}${unit}</text>`; });
    body+=`</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BOARD_W}" height="${BOARD_H}" viewBox="0 0 ${BOARD_W} ${BOARD_H}">${body}</svg>`;
}
function drawWatermark(ctx,W,H){
  ctx.save(); ctx.globalAlpha=0.55;
  ctx.font='500 26px "DM Sans",sans-serif'; ctx.fillStyle='#5a6a86';
  ctx.textAlign='right'; ctx.textBaseline='bottom';
  const txt='Made using tool.adjiebrotots.com/sldmaker';
  const x=W-28, y=H-26, tw=ctx.measureText(txt).width, ls=30;
  if(wmLogoImg.complete && wmLogoImg.naturalWidth) ctx.drawImage(wmLogoImg, x-tw-10-ls, y-ls+4, ls, ls);
  ctx.fillText(txt,x,y); ctx.restore();
}
async function renderPng(){
  COLOR_MAP=buildColorMap();
  const scale=2, W=BOARD_W*scale, H=BOARD_H*scale;
  const out=document.createElement('canvas'); out.width=W; out.height=H;
  const ctx=out.getContext('2d');
  if(S.bgType==='map'){
    try{
      const mapCanvas=await html2canvas($('#mapLayer'),{useCORS:true,allowTaint:false,
        backgroundColor:null,scale,logging:false});
      ctx.drawImage(mapCanvas,0,0,W,H);
    }catch(err){ console.warn('map capture failed',err);
      ctx.fillStyle='#aad3df'; ctx.fillRect(0,0,W,H); }
  }
  const svgStr=buildExportSVG();
  const img=await loadSVG(svgStr);
  ctx.drawImage(img,0,0,W,H);
  drawWatermark(ctx,W,H);
  return out;
}
function loadSVG(str){
  return new Promise((res,rej)=>{
    const blob=new Blob([str],{type:'image/svg+xml;charset=utf-8'});
    const url=URL.createObjectURL(blob); const img=new Image();
    img.onload=()=>{ URL.revokeObjectURL(url); res(img); };
    img.onerror=e=>{ URL.revokeObjectURL(url); rej(e); };
    img.src=url;
  });
}
$('#savePngBtn').onclick=async()=>{
  clearSelection(); $('#exportOverlay').classList.add('open');
  try{ const c=await renderPng();
    const link=document.createElement('a');
    const safe=(S.name||'sld').replace(/[^a-z0-9\-_ ]/gi,'').trim()||'sld';
    link.download=safe+'.png'; link.href=c.toDataURL('image/png'); link.click();
    toast('PNG saved ✓','success'); markClean();
  }catch(err){ console.error(err); toast('PNG export failed','error'); }
  finally{ $('#exportOverlay').classList.remove('open'); }
};
$('#copyPngBtn').onclick=async()=>{
  clearSelection(); $('#exportOverlay').classList.add('open');
  try{ const c=await renderPng();
    if(!navigator.clipboard||!window.ClipboardItem) throw new Error('clipboard unsupported');
    const blob=await new Promise(r=>c.toBlob(r,'image/png'));
    await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
    toast('PNG copied ✓','success');
  }catch(err){ console.error(err); toast('PNG copy failed','error'); }
  finally{ $('#exportOverlay').classList.remove('open'); }
};

/* ════════════════════════════════════════════════════════════
   SAVE / LOAD JSON
   ════════════════════════════════════════════════════════════ */
$('#saveJsonBtn').onclick=()=>{
  const data={ _source:'tool.adjiebrotots.com/sldmaker', name:S.name, background:S.bgType,
    mapView:S.mapView, colorMode:S.colorMode, elements:S.elements, lines:S.lines };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const link=document.createElement('a');
  const safe=(S.name||'sld').replace(/[^a-z0-9\-_ ]/gi,'').toLowerCase().replace(/\s+/g,'-')||'sld';
  link.download=safe+'.json'; link.href=URL.createObjectURL(blob); link.click();
  URL.revokeObjectURL(link.href); toast('Saved ✓','success'); markClean();
};
$('#loadJsonBtn').onclick=()=>$('#jsonFileInput').click();
$('#jsonFileInput').onchange=e=>{ const f=e.target.files[0]; if(!f) return;
  const r=new FileReader(); r.onload=ev=>{ try{ doLoad(JSON.parse(ev.target.result)); }
    catch{ toast('Invalid JSON','error'); } }; r.readAsText(f); e.target.value=''; };
function doLoad(d){
  const apply=()=>{
    S.name=d.name||'Untitled SLD'; S.colorMode=d.colorMode||'none';
    S.elements=(d.elements||[]).map(e=>({rot:0,scale:1,tags:[],voltage:'',color:'',name:'',
      labelDx:null,labelDy:null,labelSize:12, ...e}));
    S.lines=(d.lines||[]).map(l=>({name:'',tags:[],voltage:'',color:'',mode:'click',labelSize:11,waypoints:[], ...l}));
    let maxN=1; [...S.elements,...S.lines].forEach(o=>{ const n=parseInt((o.id||'').slice(1)); if(n>=maxN)maxN=n+1; });
    S.nextId=maxN;
    $('#sldNameInput').value=S.name; $('#colorModeSelect').value=S.colorMode;
    S.mapView=d.mapView||S.mapView;
    $('#bgSelect').value=d.background||'blank'; clearSelection();
    if(S.map){ S.map.remove(); S.map=null; }
    setBackground(d.background||'blank');
    if(S.mapView && S.map) S.map.setView([S.mapView[0],S.mapView[1]], S.mapView[2]||13);
    renderAll(); markClean(); toast('Loaded ✓','success');
  };
  if(S.isDirty && (S.elements.length||S.lines.length))
    showConfirm('📂','Load diagram','Loading will replace the current diagram. Proceed?',apply,null);
  else apply();
}

/* ════════════════════════════════════════════════════════════
   THEME / KEYBOARD / TOAST
   ════════════════════════════════════════════════════════════ */
$('#themeBtn').onclick=()=>{ const light=document.body.classList.toggle('light');
  $('#themeBtn').textContent=light?'🌙 Dark':'☀️ Light'; renderAll(); };
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){ if(pendingLine){pendingLine=null;layerOverlay.innerHTML='';renderOverlay();} else clearSelection(); }
  if((e.key==='Delete'||e.key==='Backspace') && S.selected &&
     !document.activeElement?.closest('input,select,textarea')){
    e.preventDefault();
    S.selected.kind==='element'?deleteElement(S.selected.id):deleteLine(S.selected.id);
  }
  if((e.key==='v'||e.key==='V') && !document.activeElement?.closest('input,select,textarea')) setMode('select');
});
function toast(msg,type='success'){ document.querySelectorAll('.toast').forEach(t=>t.remove());
  const t=document.createElement('div'); t.className='toast '+type; t.textContent=msg;
  document.body.appendChild(t); setTimeout(()=>t.remove(),2300); }

/* ════════════════════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════════════════════ */
function seedDemo(){
  const g=addElement('generator',300,200,1); g.name='G1'; g.voltage='11';
  const t=addElement('transformer2',300,420,1); t.name='TR1'; t.voltage='11';
  const b=addElement('busbar',300,620,1); b.name='BB-11kV'; b.voltage='11';
  createLine({elId:g.id,kind:'term',idx:0},{elId:t.id,kind:'term',idx:0},'click');
  createLine({elId:t.id,kind:'term',idx:1},{elId:b.id,kind:'bar',t:0.5},'click');
  clearSelection(); markClean();
}
buildPalette();
renderAll();
seedDemo();

})();
