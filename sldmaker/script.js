(function(){
'use strict';

/* ════════════════════════════════════════════════════════════
   SLD MAKER — single line diagram builder
   ════════════════════════════════════════════════════════════ */

const SVGNS = 'http://www.w3.org/2000/svg';
const BOARD_W = 1400, BOARD_H = 900;
const SNAP_MAX = 80;          // px radius to snap a line endpoint to a terminal
const STUB = 24;              // orthogonal lead length out of a terminal

// Watermark logo (logos/logo.svg) preloaded for PNG export
const WM_LOGO_SRC = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDY4MCA2ODAiIHJvbGU9ImltZyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8dGl0bGU+QXJjaGVkIEEgTG9nbzwvdGl0bGU+CiAgPGRlc2M+QSBzbGVlayB3aGl0ZSBsZXR0ZXIgQSB3aG9zZSBsZWdzIGZvbGxvdyB0aGUgY2lyY2xlIGN1cnZhdHVyZSwgc3Bhbm5pbmcgODAlIG9mIHRoZSBjaXJjbGUgaGVpZ2h0PC9kZXNjPgoKICA8Y2lyY2xlIGN4PSIzNDAiIGN5PSIzNDAiIHI9IjMwMCIgZmlsbD0iIzAwNTJjYyIvPgoKICA8IS0tIExlZnQgbGVnOiAxMTPCsCB0byAyNDXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyNDIsNTcwIEEgMjUwLDI1MCAwIDAgMSAyMzQsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFRvcCBhcmNoOiAyNDXCsCB0byAyOTXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyMzQsMTEzIEEgMjUwLDI1MCAwIDAgMSA0NDYsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFJpZ2h0IGxlZzogMjk1wrAgdG8gNjfCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSA0NDYsMTEzIEEgMjUwLDI1MCAwIDAgMSA0MzgsNTcwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIENyb3NzYmFyIC0tPgogIDxsaW5lIHgxPSIxMTMiIHkxPSIzNTQiIHgyPSI1NjciIHkyPSIzNTQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNDIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K';
const wmLogoImg = new Image(); wmLogoImg.src = WM_LOGO_SRC;

/* ── Symbol definitions ───────────────────────────────────────
   Each symbol is drawn centred at local (0,0). `inner` returns the
   SVG markup (no colour — stroke=currentColor inherited from .sym).
   `terminals` are connection points {x,y,dir}. `bar` (busbar) is a
   horizontal connection segment. `bbox` is the local bounding box. */
const DEFAULT_NAMES = {
  transformer2:'TR', generator:'G', busbar:'BB', load:'LD', transformer3:'TR3',
  motor:'M', windturbine:'WTG', solarpv:'PV', inverter:'INV', battery:'BESS', breaker:'CB'
};
const SYM = {
  transformer2:{
    label:'2-Winding Transformer',
    bbox:{x:-14,y:-32,w:28,h:64},
    terminals:[{x:0,y:-30,dir:'up'},{x:0,y:30,dir:'down'}],
    inner:()=>`<line x1="0" y1="-30" x2="0" y2="-19"/><circle cx="0" cy="-9" r="11"/><circle cx="0" cy="9" r="11"/><line x1="0" y1="19" x2="0" y2="30"/>`
  },
  generator:{
    label:'Synchronous Generator',
    bbox:{x:-18,y:-32,w:36,h:64},
    terminals:[{x:0,y:-30,dir:'up'},{x:0,y:30,dir:'down'}],
    inner:()=>`<line x1="0" y1="-30" x2="0" y2="-17"/><circle cx="0" cy="0" r="17"/><path d="M-9 0 q4.5 -9 9 0 t9 0"/><line x1="0" y1="17" x2="0" y2="30"/>`
  },
  busbar:{
    label:'Busbar',
    bbox:{x:-48,y:-7,w:96,h:14},
    bar:{x1:-46,x2:46,y:0},
    terminals:[],
    inner:()=>`<rect x="-46" y="-3.5" width="92" height="7" rx="1.5" fill="currentColor" stroke="none"/>`
  },
  load:{
    label:'Load',
    bbox:{x:-14,y:-31,w:28,h:48},
    terminals:[{x:0,y:-30,dir:'up'}],
    inner:()=>`<line x1="0" y1="-30" x2="0" y2="-14"/><path d="M-13 -14 L13 -14 L0 14 Z" fill="none"/>`
  },
  transformer3:{
    label:'3-Winding Transformer',
    bbox:{x:-22,y:-32,w:44,h:64},
    terminals:[{x:0,y:-30,dir:'up'},{x:-11,y:30,dir:'down'},{x:11,y:30,dir:'down'}],
    inner:()=>`<line x1="0" y1="-30" x2="0" y2="-21"/><circle cx="0" cy="-10" r="11"/><circle cx="-11" cy="8" r="11"/><circle cx="11" cy="8" r="11"/><line x1="-11" y1="19" x2="-11" y2="30"/><line x1="11" y1="19" x2="11" y2="30"/>`
  },
  motor:{
    label:'Motor',
    bbox:{x:-18,y:-32,w:36,h:64},
    terminals:[{x:0,y:-30,dir:'up'},{x:0,y:30,dir:'down'}],
    inner:()=>`<line x1="0" y1="-30" x2="0" y2="-17"/><circle cx="0" cy="0" r="17"/><text class="sym-text" x="0" y="5.5" text-anchor="middle" font-family="DM Sans,sans-serif" font-size="17" font-weight="700" fill="currentColor" stroke="none">M</text><line x1="0" y1="17" x2="0" y2="30"/>`
  },
  windturbine:{
    label:'Wind Turbine',
    bbox:{x:-16,y:-22,w:32,h:54},
    terminals:[{x:0,y:30,dir:'down'}],
    inner:()=>`<circle cx="0" cy="-6" r="15"/><line x1="0" y1="-6" x2="0" y2="-20"/><line x1="0" y1="-6" x2="12" y2="2"/><line x1="0" y1="-6" x2="-12" y2="2"/><circle cx="0" cy="-6" r="2.4" fill="currentColor" stroke="none"/><line x1="0" y1="9" x2="0" y2="30"/>`
  },
  solarpv:{
    label:'Solar PV',
    bbox:{x:-18,y:-18,w:36,h:50},
    terminals:[{x:0,y:30,dir:'down'}],
    inner:()=>`<rect x="-16" y="-16" width="32" height="32" rx="1" fill="none"/><path d="M-16 -16 L0 3 L16 -16" fill="none"/><line x1="0" y1="16" x2="0" y2="30"/>`
  },
  inverter:{
    label:'Inverter',
    bbox:{x:-18,y:-32,w:36,h:64},
    terminals:[{x:0,y:-30,dir:'up'},{x:0,y:30,dir:'down'}],
    inner:()=>`<line x1="0" y1="-30" x2="0" y2="-16"/><rect x="-16" y="-16" width="32" height="32" rx="1" fill="none"/><line x1="-16" y1="16" x2="16" y2="-16"/><path d="M-12 -6 q2 -5 4 0 t4 0"/><line x1="2" y1="7" x2="12" y2="7"/><line x1="2" y1="11" x2="12" y2="11"/><line x1="0" y1="16" x2="0" y2="30"/>`
  },
  battery:{
    label:'Battery Storage (BESS)',
    bbox:{x:-18,y:-32,w:36,h:64},
    terminals:[{x:0,y:-30,dir:'up'},{x:0,y:30,dir:'down'}],
    inner:()=>`<line x1="0" y1="-30" x2="0" y2="-16"/><rect x="-16" y="-16" width="32" height="32" rx="1" fill="none"/><path d="M2 -11 L-6 2 L0 2 L-2 11 L7 -2 L1 -2 Z" fill="currentColor" stroke="none"/><line x1="0" y1="16" x2="0" y2="30"/>`
  },
  breaker:{
    label:'Circuit Breaker',
    bbox:{x:-9,y:-31,w:18,h:62},
    terminals:[{x:0,y:-30,dir:'up'},{x:0,y:30,dir:'down'}],
    inner:(el)=>`<line x1="0" y1="-30" x2="0" y2="-9"/><rect x="-7" y="-9" width="14" height="18" rx="1.5" fill="${el&&el.open?'none':'currentColor'}" stroke="currentColor"/><line x1="0" y1="9" x2="0" y2="30"/>`
  },
};
const PALETTE_ORDER = ['transformer2','generator','busbar','load','transformer3','motor','windturbine','solarpv','inverter','battery','breaker'];
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
function localToWorld(el, lx, ly){
  const s=el.scale, r=el.rot*Math.PI/180, cs=Math.cos(r), sn=Math.sin(r);
  const sx=lx*s, sy=ly*s;
  return { x: el.x + sx*cs - sy*sn, y: el.y + sx*sn + sy*cs };
}
function rotDir(dir, rot){
  const base={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[dir]||[0,1];
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
// world point + leave-direction for a connection {elId, kind, idx|lx}
function connPoint(conn, other){
  const el=getEl(conn.elId); if(!el) return null;
  const def=SYM[el.type];
  if(conn.kind==='bar'){
    const w=localToWorld(el, conn.lx, def.bar.y);
    let dir={x:0,y:1};
    if(other){ dir = (other.y < w.y) ? {x:0,y:-1} : {x:0,y:1}; }
    return {x:w.x, y:w.y, dir};
  }
  const t=def.terminals[conn.idx]||{x:0,y:0,dir:'down'};
  const w=localToWorld(el, t.x, t.y);
  return {x:w.x, y:w.y, dir:rotDir(t.dir, el.rot)};
}
function nearestConn(pt, excludeElId){
  let best=null, bd=Infinity;
  for(const el of S.elements){
    if(el.id===excludeElId) continue;
    const def=SYM[el.type];
    if(def.bar){
      const a=localToWorld(el,def.bar.x1,def.bar.y), b=localToWorld(el,def.bar.x2,def.bar.y);
      const n=nearestOnSeg(pt,a,b), d=dist(pt,n.point);
      if(d<bd){ bd=d; best={elId:el.id, kind:'bar', lx:def.bar.x1+(def.bar.x2-def.bar.x1)*n.t, world:n.point}; }
    }
    (def.terminals||[]).forEach((t,i)=>{
      const w=localToWorld(el,t.x,t.y), d=dist(pt,w);
      if(d<bd){ bd=d; best={elId:el.id, kind:'term', idx:i, world:w}; }
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
  if(line.mode==='scribble' && line.raw && line.raw.length>=2){
    const p0=connPoint(line.from), p1=connPoint(line.to);
    if(!p0||!p1) return [];
    return similarityMap(line.raw, line.raw[0], line.raw[line.raw.length-1],
                         {x:p0.x,y:p0.y},{x:p1.x,y:p1.y});
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
    transform:`translate(${el.x} ${el.y}) rotate(${el.rot}) scale(${el.scale})`,
    style:`color:${displayColor(el)}`});
  const sym=el2('g',{class:'sym'});
  sym.innerHTML=SYM[el.type].inner(el);
  g.appendChild(sym);
  if(el.name){
    const def=SYM[el.type];
    const ly=def.bbox.y+def.bbox.h+13;
    const t=el2('text',{class:'el-label',x:0,y:ly});
    t.textContent=el.name;
    g.appendChild(t);
  }
  layerEls.appendChild(g);
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
    const t=el2('text',{class:'line-label',x:mid.x,y:mid.y-6}); t.textContent=line.name;
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

/* ── Selection overlay (bbox + rotate/scale handles) ──────── */
function renderOverlay(){
  layerOverlay.innerHTML='';
  if(!S.selected || S.selected.kind!=='element') return;
  const el=getEl(S.selected.id); if(!el) return;
  const def=SYM[el.type], bb=def.bbox;
  const corners=[
    localToWorld(el,bb.x,bb.y), localToWorld(el,bb.x+bb.w,bb.y),
    localToWorld(el,bb.x+bb.w,bb.y+bb.h), localToWorld(el,bb.x,bb.y+bb.h)];
  const poly=el2('polygon',{class:'sel-box',
    points:corners.map(c=>`${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')});
  layerOverlay.appendChild(poly);
  // rotate handle above top-mid
  const topMid=localToWorld(el,bb.x+bb.w/2,bb.y-20);
  const topAnchor=localToWorld(el,bb.x+bb.w/2,bb.y);
  const line=el2('line',{x1:topAnchor.x,y1:topAnchor.y,x2:topMid.x,y2:topMid.y,
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
function escapeHtml(s){ return (s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

/* ════════════════════════════════════════════════════════════
   COORDINATE conversion (pointer → board)
   ════════════════════════════════════════════════════════════ */
function boardPt(evt){
  const r=board.getBoundingClientRect();
  return { x:(evt.clientX-r.left)/r.width*BOARD_W, y:(evt.clientY-r.top)/r.height*BOARD_H };
}

/* ════════════════════════════════════════════════════════════
   ELEMENT CRUD
   ════════════════════════════════════════════════════════════ */
function addElement(type,x,y,scale){
  const el={id:uid('e'),type,x:Math.round(x),y:Math.round(y),rot:0,scale:scale||1,
    name:DEFAULT_NAMES[type]+(countType(type)+1), tags:[], voltage:'', color:'',
    open: type==='breaker'? false : undefined};
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
  const typeOpts=PALETTE_ORDER.map(t=>`<option value="${t}" ${t===el.type?'selected':''}>${SYM[t].label}</option>`).join('');
  inspBody.innerHTML=
    field('Type',`<select id="fType">${typeOpts}</select>`)+
    field('Name',`<input type="text" id="fName" value="${escapeHtml(el.name)}" placeholder="Label…">`)+
    field('Tags (comma separated)',`<input type="text" id="fTags" value="${escapeHtml(el.tags.join(', '))}" placeholder="e.g. feeder-1, MV">`)+
    field('Voltage (kV)',`<input type="text" id="fVolt" value="${escapeHtml(el.voltage)}" placeholder="e.g. 11">`)+
    (el.type==='breaker'? field('State',`<button class="btn btn-block" id="fToggle">${el.open?'◻ Open — click to close':'◼ Closed — click to open'}</button>`):'')+
    field('Rotation',`<div class="row"><input type="range" id="fRot" min="0" max="360" step="5" value="${el.rot}"><span class="rng-val" id="fRotV">${el.rot}°</span></div>`)+
    field('Size',`<div class="row"><input type="range" id="fScale" min="0.5" max="3" step="0.1" value="${el.scale}"><span class="rng-val" id="fScaleV">${el.scale.toFixed(1)}×</span></div>`)+
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
  $('#fScale').oninput=e=>{ el.scale=+e.target.value; $('#fScaleV').textContent=el.scale.toFixed(1)+'×'; markDirty(); renderAll(); };
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
    field('Colour'+(S.colorMode!=='none'?' (overridden by colour coding)':''),
      `<div class="color-row"><input type="color" id="lColor" value="${line.color||'#243049'}">${swatchRow()}</div>`)+
    `<div class="insp-hint">Routing: ${line.mode==='scribble'?'follows your scribble':'auto orthogonal'}. Connects <b>${connName(line.from)}</b> → <b>${connName(line.to)}</b>.</div>`+
    `<button class="btn btn-block" id="lFlip" style="margin-top:10px">↔ Toggle routing style</button>`+
    `<button class="btn btn-danger btn-block" id="lDelete">🗑 Delete line</button>`;
  $('#lName').oninput=e=>{ line.name=e.target.value; markDirty(); renderAll(); };
  $('#lTags').oninput=e=>{ line.tags=e.target.value.split(',').map(s=>s.trim()).filter(Boolean); markDirty(); renderAll(); };
  $('#lVolt').oninput=e=>{ line.voltage=e.target.value.trim(); markDirty(); renderAll(); };
  $('#lColor').oninput=e=>{ line.color=e.target.value; markDirty(); renderAll(); };
  inspBody.querySelectorAll('.swatch').forEach(s=>s.onclick=()=>{ line.color=s.dataset.color; $('#lColor').value=s.dataset.color; markDirty(); renderAll(); });
  $('#lFlip').onclick=()=>{ line.mode = line.mode==='scribble' ? 'click' : (line.raw? 'scribble':'click'); markDirty(); renderAll(); renderInspector(); };
  $('#lDelete').onclick=()=>deleteLine(line.id);
}
function connName(c){ const el=getEl(c.elId); return el? el.name||SYM[el.type].label : '?'; }

$('#inspClose').onclick=clearSelection;

/* ════════════════════════════════════════════════════════════
   POINTER INTERACTION on the SVG board
   ════════════════════════════════════════════════════════════ */
let drag=null;          // element move
let pendingLine=null;   // first endpoint in click-line mode
let scribble=null;      // active freehand capture

svg.addEventListener('pointerdown', onPointerDown);

function onPointerDown(e){
  if(e.button!==0) return;
  const pt=boardPt(e);
  const elNode=e.target.closest('.sld-el');
  const lineNode=e.target.closest('[data-line]');

  if(S.mode==='select'){
    if(elNode){
      const el=getEl(elNode.dataset.id);
      // breaker toggle if clicked without dragging — handled on pointerup
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
  if(S.mode==='line-scribble' || S.mode==='scribble'){
    scribble={pts:[pt], el:null};
    scribble.el=el2('polyline',{class:'scribble-path',points:`${pt.x},${pt.y}`});
    layerOverlay.appendChild(scribble.el);
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
}

svg.addEventListener('pointermove', e=>{
  const pt=boardPt(e);
  if(drag){
    const dx=pt.x-drag.start.x, dy=pt.y-drag.start.y;
    if(Math.abs(dx)>2||Math.abs(dy)>2) drag.moved=true;
    drag.el.x=Math.round(drag.ox+dx); drag.el.y=Math.round(drag.oy+dy);
    markDirty(); renderAll();
  } else if(scribble){
    scribble.pts.push(pt);
    scribble.el.setAttribute('points', scribble.pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
  }
});

svg.addEventListener('pointerup', e=>{
  if(drag){
    if(drag.breaker && !drag.moved){ drag.el.open=!drag.el.open; markDirty(); renderAll(); renderInspector(); }
    drag=null;
    return;
  }
  if(scribble){
    const pts=scribble.pts.slice();
    layerOverlay.innerHTML=''; const sc=scribble; scribble=null; renderOverlay();
    if(pts.length<3){ return; }
    if(S.mode==='scribble') finishScribbleElement(pts);
    else finishScribbleLine(pts);
  }
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
  const def=SYM[el.type]; const diag=Math.hypot(def.bbox.w,def.bbox.h)/2;
  const move=ev=>{ const p=boardPt(ev); const d=dist({x:el.x,y:el.y},p);
    el.scale=Math.max(0.5,Math.min(3, d/diag)); markDirty(); renderAll();
    if($('#fScale')){$('#fScale').value=el.scale;$('#fScaleV').textContent=el.scale.toFixed(1)+'×';} };
  const up=()=>{ svg.removeEventListener('pointermove',move); svg.removeEventListener('pointerup',up); };
  svg.addEventListener('pointermove',move); svg.addEventListener('pointerup',up);
}

/* ════════════════════════════════════════════════════════════
   LINE CREATION
   ════════════════════════════════════════════════════════════ */
function createLine(from, to, mode, raw){
  const f={elId:from.elId, kind:from.kind, idx:from.idx, lx:from.lx};
  const t={elId:to.elId,   kind:to.kind,   idx:to.idx,   lx:to.lx};
  const line={id:uid('l'), name:'', tags:[], voltage:'', color:'', mode, from:f, to:t};
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

/* ── Scribble → element recognition ──────────────────────── */
function recognizeShape(pts){
  let minx=Infinity,miny=Infinity,maxx=-Infinity,maxy=-Infinity;
  for(const p of pts){ minx=Math.min(minx,p.x);maxx=Math.max(maxx,p.x);miny=Math.min(miny,p.y);maxy=Math.max(maxy,p.y); }
  const w=maxx-minx, h=maxy-miny, diag=Math.hypot(w,h);
  const closed=dist(pts[0],pts[pts.length-1]) < 0.28*diag;
  const simp=simplify(pts, Math.max(6,diag*0.06));
  let corners=Math.max(0, simp.length-1); // segments
  if(!closed && w>2.0*h) return {type:'busbar', w, h, cx:(minx+maxx)/2, cy:(miny+maxy)/2};
  if(closed){
    if(corners<=3) return {type:'load', w, h, cx:(minx+maxx)/2, cy:(miny+maxy)/2};
    if(corners===4 || corners===5){
      const aspect=w/Math.max(1,h);
      return {type: aspect>0.8&&aspect<1.25?'battery':'load', w, h, cx:(minx+maxx)/2, cy:(miny+maxy)/2};
    }
    return {type:'generator', w, h, cx:(minx+maxx)/2, cy:(miny+maxy)/2};
  }
  return {type:'generator', w, h, cx:(minx+maxx)/2, cy:(miny+maxy)/2};
}
function finishScribbleElement(pts){
  const r=recognizeShape(pts);
  const def=SYM[r.type];
  const natural=Math.max(def.bbox.w,def.bbox.h);
  const scale=Math.max(0.6,Math.min(3, Math.max(r.w,r.h)/natural));
  const el=addElement(r.type, r.cx, r.cy, scale);
  toast('Recognised: '+def.label+' — change type in panel if wrong','success');
}

/* ════════════════════════════════════════════════════════════
   PALETTE (drag & drop)
   ════════════════════════════════════════════════════════════ */
function buildPalette(){
  const wrap=$('#paletteScroll');
  wrap.innerHTML=PALETTE_ORDER.map(t=>{
    const d=SYM[t];
    const icon=`<svg viewBox="-50 -38 100 76" class="sym"><g class="sym" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${d.inner({open:false})}</g></svg>`;
    return `<div class="pal-item" draggable="true" data-type="${t}">${icon}<span class="pal-label">${d.label}</span></div>`;
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
  S.mode=m; pendingLine=null; layerOverlay.innerHTML=''; renderOverlay();
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
    $('#mapMoveBtn').style.display='';
    ensureMap();
  } else {
    board.classList.add('blank');
    $('#mapMoveBtn').style.display='none';
    board.classList.remove('map-move'); S.mapMove=false;
    $('#mapMoveBtn').textContent='🗺 Move map'; $('#mapMoveBtn').classList.remove('active');
  }
}
function ensureMap(){
  if(S.map){ setTimeout(()=>S.map.invalidateSize(),50); return; }
  if(typeof L==='undefined'){ toast('Map library failed to load','error'); return; }
  S.map=L.map('mapLayer',{zoomControl:true,attributionControl:true,
    dragging:false,scrollWheelZoom:false}).setView(S.mapView||[-33.8688,151.2093], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19, crossOrigin:true,
    attribution:'© OpenStreetMap'}).addTo(S.map);
  S.map.on('moveend zoomend',()=>{ const c=S.map.getCenter(); S.mapView=[c.lat,c.lng,S.map.getZoom()]; markDirty(); });
  setTimeout(()=>S.map.invalidateSize(),60);
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
  // Fresh standalone SVG with explicit colours (light theme) — no white bg.
  let body='';
  // lines
  S.lines.forEach(line=>{
    const pts=linePoints(line); if(pts.length<2) return;
    const d=pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    body+=`<polyline points="${d}" fill="none" stroke="${displayColor(line,true)}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
    if(line.name){ const m=pts[Math.floor(pts.length/2)];
      body+=`<text x="${m.x}" y="${(m.y-6).toFixed(1)}" font-family="DM Sans,sans-serif" font-size="10.5" font-weight="600" fill="#1A2236" text-anchor="middle" paint-order="stroke" stroke="#ffffff" stroke-width="3">${escapeHtml(line.name)}</text>`; }
  });
  // elements
  S.elements.forEach(el=>{
    const col=displayColor(el,true);
    body+=`<g transform="translate(${el.x} ${el.y}) rotate(${el.rot}) scale(${el.scale})" style="color:${col}"><g fill="none" stroke="${col}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${SYM[el.type].inner(el)}</g></g>`;
    if(el.name){ const def=SYM[el.type]; const w=localToWorld(el,def.bbox.x+def.bbox.w/2,def.bbox.y+def.bbox.h);
      body+=`<text x="${w.x.toFixed(1)}" y="${(w.y+12).toFixed(1)}" font-family="DM Sans,sans-serif" font-size="11" font-weight="600" fill="#1A2236" text-anchor="middle">${escapeHtml(el.name)}</text>`; }
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
    // composite map tiles via html2canvas, then overlay vector SVG
    try{
      const mapCanvas=await html2canvas($('#mapLayer'),{useCORS:true,allowTaint:false,
        backgroundColor:null,scale,logging:false});
      ctx.drawImage(mapCanvas,0,0,W,H);
    }catch(err){ console.warn('map capture failed',err);
      ctx.fillStyle='#aad3df'; ctx.fillRect(0,0,W,H); }
  }
  // vector overlay
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
    S.elements=(d.elements||[]).map(e=>({rot:0,scale:1,tags:[],voltage:'',color:'',name:'', ...e}));
    S.lines=(d.lines||[]).map(l=>({name:'',tags:[],voltage:'',color:'',mode:'click', ...l}));
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
  // a tiny starter so the canvas isn't empty on first load
  const g=addElement('generator',300,200,1); g.name='G1'; g.voltage='11';
  const t=addElement('transformer2',300,420,1); t.name='TR1'; t.voltage='11';
  const b=addElement('busbar',300,620,1); b.name='BB-11kV'; b.voltage='11';
  createLine({elId:g.id,kind:'term',idx:1},{elId:t.id,kind:'term',idx:0},'click');
  createLine({elId:t.id,kind:'term',idx:1},{elId:b.id,kind:'bar',lx:0},'click');
  clearSelection(); markClean();
}
buildPalette();
renderAll();
seedDemo();

})();
