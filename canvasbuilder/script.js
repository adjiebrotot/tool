(function(){
'use strict';
// Watermark logo (logos/logo.svg), preloaded for use in canvas exports
const WM_LOGO_SRC = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDY4MCA2ODAiIHJvbGU9ImltZyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8dGl0bGU+QXJjaGVkIEEgTG9nbzwvdGl0bGU+CiAgPGRlc2M+QSBzbGVlayB3aGl0ZSBsZXR0ZXIgQSB3aG9zZSBsZWdzIGZvbGxvdyB0aGUgY2lyY2xlIGN1cnZhdHVyZSwgc3Bhbm5pbmcgODAlIG9mIHRoZSBjaXJjbGUgaGVpZ2h0PC9kZXNjPgoKICA8Y2lyY2xlIGN4PSIzNDAiIGN5PSIzNDAiIHI9IjMwMCIgZmlsbD0iIzAwNTJjYyIvPgoKICA8IS0tIExlZnQgbGVnOiAxMTPCsCB0byAyNDXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyNDIsNTcwIEEgMjUwLDI1MCAwIDAgMSAyMzQsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFRvcCBhcmNoOiAyNDXCsCB0byAyOTXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyMzQsMTEzIEEgMjUwLDI1MCAwIDAgMSA0NDYsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFJpZ2h0IGxlZzogMjk1wrAgdG8gNjfCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSA0NDYsMTEzIEEgMjUwLDI1MCAwIDAgMSA0MzgsNTcwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIENyb3NzYmFyIC0tPgogIDxsaW5lIHgxPSIxMTMiIHkxPSIzNTQiIHgyPSI1NjciIHkyPSIzNTQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNDIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K';
const wmLogoImg = new Image();
wmLogoImg.src = WM_LOGO_SRC;

/* ══ SECTION DEFS ═══════════════════════════════════ */
const BMC = [
  {id:'key-partners',          label:'Key Partners',          icon:'🤝', cls:'bmc-key-partners'},
  {id:'key-activities',        label:'Key Activities',        icon:'⚙️', cls:'bmc-key-activities'},
  {id:'key-resources',         label:'Key Resources',         icon:'💎', cls:'bmc-key-resources'},
  {id:'value-propositions',    label:'Value Propositions',    icon:'💡', cls:'bmc-value-props'},
  {id:'customer-relationships',label:'Customer Relationships',icon:'❤️', cls:'bmc-customer-rel'},
  {id:'channels',              label:'Channels',              icon:'📡', cls:'bmc-channels'},
  {id:'customer-segments',     label:'Customer Segments',     icon:'👥', cls:'bmc-customer-seg'},
  {id:'cost-structure',        label:'Cost Structure',        icon:'💸', cls:'bmc-cost-structure'},
  {id:'revenue-streams',       label:'Revenue Streams',       icon:'📈', cls:'bmc-revenue-streams'},
];
const VPC = [
  {id:'gain-creators',     label:'Gain Creators',      icon:'🚀', cls:'vpc-gain-creators',     side:'left'},
  {id:'products-services', label:'Products & Services',icon:'📦', cls:'vpc-products-services', side:'left'},
  {id:'pain-relievers',    label:'Pain Relievers',     icon:'💊', cls:'vpc-pain-relievers',    side:'left'},
  {id:'gains',             label:'Gains',              icon:'✨', cls:'vpc-gains',             side:'right'},
  {id:'customer-jobs',     label:'Customer Jobs',      icon:'💼', cls:'vpc-customer-jobs',     side:'right'},
  {id:'pains',             label:'Pains',              icon:'😤', cls:'vpc-pains',             side:'right'},
];

/* ══ STATE ═══════════════════════════════════════════ */
const S = {
  canvasType:'bmc', canvasName:'Untitled Canvas',
  isDirty:false, sections:{}, selectedItem:null,
  defaultFontSize:13, nextId:1,
  cellSizes:{ bmc:[1,1,0.52], vpc:[1,1,1], vpcColFrac:0.5, bmcColFracs:[1,1,1,1,1] },
};
function mkSections(t){ const out={};(t==='bmc'?BMC:VPC).forEach(s=>out[s.id]=[]); return out; }
function curSecs(){ return S.canvasType==='bmc'?BMC:VPC; }
function hasContent(){ return Object.values(S.sections).some(a=>a.length>0); }

/* ══ DIRTY ═══════════════════════════════════════════ */
function markDirty(){ S.isDirty=true; document.getElementById('dirtyDot').classList.add('visible'); }
function markClean(){ S.isDirty=false; document.getElementById('dirtyDot').classList.remove('visible'); }

/* ══ RENDER ══════════════════════════════════════════ */
function renderCanvas(){
  const w = document.getElementById('canvasWrapper');
  w.innerHTML=''; hideFloatingBar();
  S.canvasType==='bmc' ? renderBMC(w) : renderVPC(w);
}

function renderBMC(container){
  const g = document.createElement('div');
  g.className='bmc-grid'; g.id='theCanvas';
  BMC.forEach(s=>g.appendChild(makeCell(s)));
  [0,1].forEach(row=>{
    const rz=document.createElement('div');
    rz.className='bmc-row-resizer'; rz.dataset.row=row;
    g.appendChild(rz);
  });
  [0,1,2,3].forEach(col=>{
    const rz=document.createElement('div');
    rz.className='bmc-col-resizer'; rz.dataset.col=col;
    g.appendChild(rz);
  });
  container.appendChild(g);
  requestAnimationFrame(()=>{
    applyBMCColWidths(g);
    applyBMCRowHeights(g);
    setupBMCColResizers(g);
    setupBMCRowResizers(g);
  });
}

function renderVPC(container){
  const vpc = document.createElement('div');
  vpc.className='vpc-container'; vpc.id='theCanvas';

  // Left: 3 stacked rows with drag-resize handles between them
  const left = document.createElement('div');
  left.className='vpc-left';
  const leftSecs=VPC.filter(s=>s.side==='left');
  leftSecs.forEach((s,i)=>{
    left.appendChild(makeCell(s));
    if(i<leftSecs.length-1){
      const rz=document.createElement('div');
      rz.className='vpc-row-resizer'; rz.dataset.row=i;
      left.appendChild(rz);
    }
  });

  // Connector arrow (decorative)
  const conn = document.createElement('div');
  conn.className='vpc-connector';
  conn.innerHTML=`<svg viewBox="0 0 28 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 10 L20 10 M14 4 L20 10 L14 16" stroke="var(--border)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
  left.appendChild(conn);

  // Right: host containing circle-wrap (clipped bg) + items-overlay (overflow:visible)
  const right = document.createElement('div');
  right.className='vpc-right';

  const host = document.createElement('div');
  host.className='vpc-circle-host'; host.id='vpcCircleHost';

  const cw = document.createElement('div');
  cw.className='vpc-circle-wrap'; cw.id='vpcCircle';

  const overlay = document.createElement('div');
  overlay.className='vpc-items-overlay'; overlay.id='vpcItemsOverlay';

  VPC.filter(s=>s.side==='right').forEach(s=>{
    // Background cell in cw — colored section + header only, no interactive body
    const bgCell=document.createElement('div');
    bgCell.className=`canvas-cell ${s.cls}`; bgCell.dataset.sectionId=s.id;
    const hd=document.createElement('div'); hd.className='cell-hd';
    hd.innerHTML=`<span class="cell-title">${s.label}</span><span class="cell-icon">${s.icon}</span>`;
    bgCell.appendChild(hd);
    cw.appendChild(bgCell);

    // Overlay section — text items live here, overflow:visible so they can poke outside circle
    const osec=document.createElement('div');
    osec.className=`vpc-overlay-section ${s.cls}-overlay`;

    const body=document.createElement('div');
    body.className='cell-body'; body.dataset.sectionId=s.id;
    const hint=document.createElement('div');
    hint.className='add-hint'; hint.textContent='+ dbl-click to add';
    body.appendChild(hint);

    (S.sections[s.id]||[]).forEach(item=>body.appendChild(makeItemEl(s.id,item)));

    body.addEventListener('dblclick',e=>{
      if(e.target.closest('.text-item')) return;
      const r=body.getBoundingClientRect();
      addItem(s.id,Math.max(4,e.clientX-r.left-55),Math.max(4,e.clientY-r.top-14),body);
    });
    body.addEventListener('click',e=>{ if(!e.target.closest('.text-item')) deselectAll(); });

    osec.appendChild(body);
    overlay.appendChild(osec);
  });

  host.appendChild(cw);
  host.appendChild(overlay);
  right.appendChild(host);

  // Column resizer between left and right panels
  const colRz=document.createElement('div');
  colRz.className='vpc-col-resizer'; colRz.id='vpcColResizer';

  vpc.appendChild(left);
  vpc.appendChild(colRz);
  vpc.appendChild(right);
  container.appendChild(vpc);

  requestAnimationFrame(()=>{
    applyVPCColWidths(vpc);
    sizeVPCCircle();
    applyVPCLeftRowHeights(left);
    setupVPCRowResizers(left);
    setupVPCColResizer(vpc, colRz);
  });
}

/* Size the VPC circle host (and its children cw + overlay) */
function sizeVPCCircle(){
  const right = document.querySelector('.vpc-right');
  const host  = document.getElementById('vpcCircleHost');
  const cw    = document.getElementById('vpcCircle');
  if(!right||!cw) return;
  const pw = right.clientWidth - 48;   // padding 24px each side
  const ph = right.clientHeight - 48;
  const sz = Math.max(Math.min(pw, ph), 180);
  if(host){ host.style.width=sz+'px'; host.style.height=sz+'px'; }
  cw.style.width  = sz+'px';
  cw.style.height = sz+'px';
}

/* ══ COLUMN + ROW SIZE HELPERS ══════════════════════ */
function applyVPCColWidths(vpc){
  if(!vpc) vpc=document.getElementById('theCanvas');
  if(!vpc||!vpc.classList.contains('vpc-container')) return;
  const totalW=vpc.clientWidth;
  const resizerW=5;
  const availW=Math.max(totalW-resizerW,300);
  const frac=Math.max(0.2,Math.min(0.8,S.cellSizes.vpcColFrac));
  const leftW=Math.round(frac*availW);
  const rightW=availW-leftW;
  vpc.style.gridTemplateColumns=`${leftW}px ${resizerW}px ${rightW}px`;
}

function setupVPCColResizer(vpc, rz){
  let startX, startFrac;
  rz.addEventListener('mousedown',e=>{
    startX=e.clientX; startFrac=S.cellSizes.vpcColFrac;
    rz.classList.add('dragging');
    document.body.style.userSelect='none'; document.body.style.cursor='col-resize';
    const onMove=ev=>{
      const dx=ev.clientX-startX;
      const availW=Math.max(vpc.clientWidth-5,300);
      S.cellSizes.vpcColFrac=Math.max(0.2,Math.min(0.8,startFrac+dx/availW));
      applyVPCColWidths(vpc);
      sizeVPCCircle();
      markDirty();
    };
    const onUp=()=>{
      rz.classList.remove('dragging');
      document.body.style.userSelect=''; document.body.style.cursor='';
      document.removeEventListener('mousemove',onMove);
      document.removeEventListener('mouseup',onUp);
    };
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
    e.preventDefault(); e.stopPropagation();
  });
}

/* ══ ROW HEIGHT HELPERS ══════════════════════════════ */
function applyVPCLeftRowHeights(left){
  if(!left) left=document.querySelector('.vpc-left');
  if(!left) return;
  const totalH=left.clientHeight;
  const resizerH=5;
  const availH=Math.max(totalH-2*resizerH,60);
  const [f1,f2,f3]=S.cellSizes.vpc;
  const sum=f1+f2+f3;
  const h1=Math.round((f1/sum)*availH);
  const h2=Math.round((f2/sum)*availH);
  const h3=availH-h1-h2;
  left.style.gridTemplateRows=`${h1}px ${resizerH}px ${h2}px ${resizerH}px ${h3}px`;
}

function applyBMCRowHeights(grid){
  if(!grid) grid=document.getElementById('theCanvas');
  if(!grid||!grid.classList.contains('bmc-grid')) return;
  const totalH=grid.clientHeight;
  if(totalH<=0) return;
  const [f1,f2,f3]=S.cellSizes.bmc;
  const sum=f1+f2+f3;
  const h1=Math.round((f1/sum)*totalH);
  const h2=Math.round((f2/sum)*totalH);
  const h3=totalH-h1-h2;
  grid.style.gridTemplateRows=`${h1}px ${h2}px ${h3}px`;
  grid.querySelectorAll('.bmc-row-resizer').forEach(rz=>{
    rz.style.top=(parseInt(rz.dataset.row)===0?h1:h1+h2)+'px';
  });
}

function setupVPCRowResizers(left){
  left.querySelectorAll('.vpc-row-resizer').forEach(rz=>{
    const rowIdx=parseInt(rz.dataset.row);
    let startY,f0,f1,f2;
    rz.addEventListener('mousedown',e=>{
      startY=e.clientY; [f0,f1,f2]=[...S.cellSizes.vpc];
      rz.classList.add('dragging');
      document.body.style.userSelect='none'; document.body.style.cursor='row-resize';
      const onMove=ev=>{
        const dy=ev.clientY-startY;
        const availH=Math.max(left.clientHeight-10,60);
        const sum=f0+f1+f2;
        const delta=(dy/availH)*sum;
        if(rowIdx===0) S.cellSizes.vpc=[Math.max(0.1,f0+delta),Math.max(0.1,f1-delta),f2];
        else           S.cellSizes.vpc=[f0,Math.max(0.1,f1+delta),Math.max(0.1,f2-delta)];
        applyVPCLeftRowHeights(left); markDirty();
      };
      const onUp=()=>{
        rz.classList.remove('dragging');
        document.body.style.userSelect=''; document.body.style.cursor='';
        document.removeEventListener('mousemove',onMove);
        document.removeEventListener('mouseup',onUp);
      };
      document.addEventListener('mousemove',onMove);
      document.addEventListener('mouseup',onUp);
      e.preventDefault(); e.stopPropagation();
    });
  });
}

function setupBMCRowResizers(grid){
  grid.querySelectorAll('.bmc-row-resizer').forEach(rz=>{
    const rowIdx=parseInt(rz.dataset.row);
    let startY,f0,f1,f2;
    rz.addEventListener('mousedown',e=>{
      startY=e.clientY; [f0,f1,f2]=[...S.cellSizes.bmc];
      rz.classList.add('dragging');
      document.body.style.userSelect='none'; document.body.style.cursor='row-resize';
      const onMove=ev=>{
        const dy=ev.clientY-startY;
        const totalH=grid.clientHeight;
        const sum=f0+f1+f2;
        const delta=(dy/totalH)*sum;
        if(rowIdx===0) S.cellSizes.bmc=[Math.max(0.1,f0+delta),Math.max(0.1,f1-delta),f2];
        else           S.cellSizes.bmc=[f0,Math.max(0.1,f1+delta),Math.max(0.1,f2-delta)];
        applyBMCRowHeights(grid); markDirty();
      };
      const onUp=()=>{
        rz.classList.remove('dragging');
        document.body.style.userSelect=''; document.body.style.cursor='';
        document.removeEventListener('mousemove',onMove);
        document.removeEventListener('mouseup',onUp);
      };
      document.addEventListener('mousemove',onMove);
      document.addEventListener('mouseup',onUp);
      e.preventDefault(); e.stopPropagation();
    });
  });
}

function applyBMCColWidths(grid){
  if(!grid) grid=document.getElementById('theCanvas');
  if(!grid||!grid.classList.contains('bmc-grid')) return;
  const totalW=grid.clientWidth;
  if(totalW<=0) return;
  const fracs=S.cellSizes.bmcColFracs;
  const sum=fracs.reduce((a,b)=>a+b,0);
  // 5 groups × 2 equal grid columns each
  const groupWidths=fracs.map(f=>Math.round((f/sum)*totalW));
  grid.style.gridTemplateColumns=groupWidths.map(w=>{
    const half=Math.floor(w/2); return `${half}px ${w-half}px`;
  }).join(' ');
  // Position 4 col resizers at cumulative group boundaries
  let acc=0;
  const cumW=[];
  for(let i=0;i<4;i++){ acc+=groupWidths[i]; cumW.push(acc); }
  grid.querySelectorAll('.bmc-col-resizer').forEach(rz=>{
    rz.style.left=cumW[parseInt(rz.dataset.col)]+'px';
  });
}

function setupBMCColResizers(grid){
  grid.querySelectorAll('.bmc-col-resizer').forEach(rz=>{
    const colIdx=parseInt(rz.dataset.col);
    let startX, startFracs;
    rz.addEventListener('mousedown',e=>{
      startX=e.clientX; startFracs=[...S.cellSizes.bmcColFracs];
      rz.classList.add('dragging');
      document.body.style.userSelect='none'; document.body.style.cursor='col-resize';
      const onMove=ev=>{
        const dx=ev.clientX-startX;
        const totalW=grid.clientWidth;
        const sum=startFracs.reduce((a,b)=>a+b,0);
        const delta=(dx/totalW)*sum;
        const nf=[...startFracs];
        nf[colIdx]  =Math.max(0.15,startFracs[colIdx]  +delta);
        nf[colIdx+1]=Math.max(0.15,startFracs[colIdx+1]-delta);
        S.cellSizes.bmcColFracs=nf;
        applyBMCColWidths(grid);
        markDirty();
      };
      const onUp=()=>{
        rz.classList.remove('dragging');
        document.body.style.userSelect=''; document.body.style.cursor='';
        document.removeEventListener('mousemove',onMove);
        document.removeEventListener('mouseup',onUp);
      };
      document.addEventListener('mousemove',onMove);
      document.addEventListener('mouseup',onUp);
      e.preventDefault(); e.stopPropagation();
    });
  });
}

/* ══ CELL FACTORY ════════════════════════════════════ */
function makeCell(sec){
  const cell = document.createElement('div');
  cell.className=`canvas-cell ${sec.cls}`;
  cell.dataset.sectionId = sec.id;

  const hd = document.createElement('div');
  hd.className='cell-hd';
  hd.innerHTML=`<span class="cell-title">${sec.label}</span><span class="cell-icon">${sec.icon}</span>`;

  const body = document.createElement('div');
  body.className='cell-body';
  body.dataset.sectionId=sec.id;

  const hint = document.createElement('div');
  hint.className='add-hint';
  hint.textContent='+ dbl-click to add';

  cell.appendChild(hd);
  cell.appendChild(body);
  cell.appendChild(hint);

  // Populate saved items
  (S.sections[sec.id]||[]).forEach(item=>body.appendChild(makeItemEl(sec.id,item)));

  // Add item on dblclick
  body.addEventListener('dblclick', e=>{
    if(e.target.closest('.text-item')) return;
    const r=body.getBoundingClientRect();
    addItem(sec.id, Math.max(4,e.clientX-r.left-55), Math.max(4,e.clientY-r.top-14), body);
  });
  body.addEventListener('click', e=>{ if(!e.target.closest('.text-item')) deselectAll(); });
  return cell;
}

/* ══ ITEM ELEMENT ════════════════════════════════════ */
function makeItemEl(sectionId, item){
  const el=document.createElement('div');
  el.className='text-item';
  el.dataset.itemId=item.id;
  el.dataset.sectionId=sectionId;
  el.style.left     = item.x+'px';
  el.style.top      = item.y+'px';
  el.style.fontSize = item.fontSize+'px';
  if(item.fontFamily) el.style.fontFamily = item.fontFamily;

  const handle=document.createElement('span');
  handle.className='drag-handle';
  handle.innerHTML='&#8942;&#8942;';
  handle.title='Drag to move';

  const text=document.createElement('span');
  text.className='item-text';
  text.contentEditable='true';
  text.spellcheck=false;
  // Use innerHTML to preserve rich text formatting
  text.innerHTML = item.value||'';

  const del=document.createElement('span');
  del.className='item-del';
  del.innerHTML='&times;';
  del.title='Delete';

  el.appendChild(handle); el.appendChild(text); el.appendChild(del);

  el.addEventListener('click',  e=>{ e.stopPropagation(); selectItem(sectionId,item.id); });
  text.addEventListener('focus',()=> selectItem(sectionId,item.id));
  text.addEventListener('input',()=>{ item.value=text.innerHTML; markDirty(); });
  text.addEventListener('keydown',e=>{
    if(e.key==='Escape') text.blur();
    // Allow Enter for line breaks within contentEditable (default behaviour)
  });
  text.addEventListener('mousedown',e=>e.stopPropagation()); // don't trigger drag
  del.addEventListener('click',e=>{ e.stopPropagation(); deleteItem(sectionId,item.id); });
  setupDrag(handle, el, sectionId, item);
  return el;
}

/* ══ ITEM CRUD ═══════════════════════════════════════ */
function addItem(sectionId, x, y, bodyEl){
  const id='i'+(S.nextId++);
  const item={id, value:'', fontSize:S.defaultFontSize, fontFamily:'', x, y};
  if(!S.sections[sectionId]) S.sections[sectionId]=[];
  S.sections[sectionId].push(item);
  markDirty();
  const el=makeItemEl(sectionId,item);
  bodyEl.appendChild(el);
  const textEl=el.querySelector('.item-text');
  requestAnimationFrame(()=>{
    textEl.focus();
    const r=document.createRange(); r.selectNodeContents(textEl); r.collapse(false);
    const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
  });
  selectItem(sectionId,id);
}

function deleteItem(sectionId, itemId){
  S.sections[sectionId]=(S.sections[sectionId]||[]).filter(i=>i.id!==itemId);
  markDirty();
  document.querySelector(`.text-item[data-item-id="${itemId}"]`)?.remove();
  if(S.selectedItem?.itemId===itemId){ S.selectedItem=null; hideFloatingBar(); }
}

function selectItem(sectionId, itemId){
  document.querySelectorAll('.text-item.selected').forEach(e=>e.classList.remove('selected'));
  S.selectedItem={sectionId,itemId};
  const el=document.querySelector(`.text-item[data-item-id="${itemId}"]`);
  if(!el) return;
  el.classList.add('selected');
  const item=(S.sections[sectionId]||[]).find(i=>i.id===itemId);
  if(item){
    document.getElementById('floatFontSize').value = item.fontSize;
    document.getElementById('floatFont').value = item.fontFamily||'';
    showFloatingBar(el);
  }
}

function deselectAll(){
  document.querySelectorAll('.text-item.selected').forEach(e=>e.classList.remove('selected'));
  S.selectedItem=null; hideFloatingBar();
}

/* ══ FLOATING BAR ════════════════════════════════════ */
function showFloatingBar(itemEl){
  const bar=document.getElementById('floatingBar');
  const r=itemEl.getBoundingClientRect();
  // Position above item, clamp to viewport
  let top=r.top-44, left=r.left;
  if(top<4) top=r.bottom+6;
  if(left+280>window.innerWidth) left=window.innerWidth-284;
  if(left<4) left=4;
  bar.style.top=top+'px'; bar.style.left=left+'px';
  bar.classList.add('visible');
}
function hideFloatingBar(){ document.getElementById('floatingBar').classList.remove('visible'); }

/* Format buttons — use mousedown+preventDefault to keep contenteditable focus */
document.querySelectorAll('.fbar-btn[data-cmd]').forEach(btn=>{
  btn.addEventListener('mousedown', e=>{
    e.preventDefault(); // keep focus in contenteditable
    document.execCommand(btn.dataset.cmd, false, null);
    // Save updated HTML
    if(S.selectedItem){
      const {sectionId,itemId}=S.selectedItem;
      const item=(S.sections[sectionId]||[]).find(i=>i.id===itemId);
      const textEl=document.querySelector(`.text-item[data-item-id="${itemId}"] .item-text`);
      if(item&&textEl){ item.value=textEl.innerHTML; markDirty(); }
    }
  });
});

/* Font family */
document.getElementById('floatFont').addEventListener('mousedown',e=>e.stopPropagation());
document.getElementById('floatFont').addEventListener('change', e=>{
  if(!S.selectedItem) return;
  const {sectionId,itemId}=S.selectedItem;
  const item=(S.sections[sectionId]||[]).find(i=>i.id===itemId);
  if(!item) return;
  item.fontFamily=e.target.value;
  const el=document.querySelector(`.text-item[data-item-id="${itemId}"]`);
  if(el) el.style.fontFamily=e.target.value||'';
  markDirty();
});

/* Font size */
document.getElementById('floatFontSize').addEventListener('mousedown',e=>e.stopPropagation());
document.getElementById('floatFontSize').addEventListener('change', e=>{
  const size=parseInt(e.target.value);
  S.defaultFontSize=size;
  if(!S.selectedItem) return;
  const {sectionId,itemId}=S.selectedItem;
  const item=(S.sections[sectionId]||[]).find(i=>i.id===itemId);
  if(!item) return;
  item.fontSize=size;
  const el=document.querySelector(`.text-item[data-item-id="${itemId}"]`);
  if(el) el.style.fontSize=size+'px';
  markDirty();
});

/* Delete via floating bar */
document.getElementById('floatDelBtn').addEventListener('click',()=>{
  if(S.selectedItem) deleteItem(S.selectedItem.sectionId,S.selectedItem.itemId);
});

/* ══ DRAG ════════════════════════════════════════════ */
let drag=null;
function setupDrag(handle, el, sectionId, item){
  handle.addEventListener('mousedown', e=>{
    e.preventDefault(); e.stopPropagation();
    selectItem(sectionId,item.id);
    drag={el,item,sx:e.clientX,sy:e.clientY,ox:item.x,oy:item.y};
    el.classList.add('dragging');
  });
}
document.addEventListener('mousemove', e=>{
  if(!drag) return;
  const nx=Math.max(0,drag.ox+(e.clientX-drag.sx));
  const ny=Math.max(0,drag.oy+(e.clientY-drag.sy));
  drag.item.x=nx; drag.item.y=ny;
  drag.el.style.left=nx+'px'; drag.el.style.top=ny+'px';
  if(S.selectedItem?.itemId===drag.item.id) showFloatingBar(drag.el);
  markDirty();
});
document.addEventListener('mouseup',()=>{
  if(drag){ drag.el.classList.remove('dragging'); drag=null; }
});

/* ══ CANVAS NAME ═════════════════════════════════════ */
document.getElementById('canvasNameInput').addEventListener('input',e=>{
  S.canvasName=e.target.value||'Untitled Canvas'; markDirty();
});

/* ══ CANVAS TYPE SWITCH ══════════════════════════════ */
document.getElementById('canvasTypeSelect').addEventListener('change', e=>{
  const nw=e.target.value;
  if(nw===S.canvasType) return;
  const doit=()=>{
    S.canvasType=nw; S.sections=mkSections(nw);
    S.selectedItem=null; markClean(); renderCanvas();
    setTimeout(triggerScrollHint,400);
  };
  if(S.isDirty&&hasContent()){
    e.target.value=S.canvasType;
    showConfirm('⚠️','Unsaved Changes',
      `The ${S.canvasType==='bmc'?'Business Model Canvas':'Value Proposition Canvas'} has unsaved changes. Switching will clear the canvas. Proceed?`,
      ()=>{ e.target.value=nw; doit(); }, null);
  } else doit();
});

/* ══ CONFIRM MODAL ═══════════════════════════════════ */
let _ok=null, _cancel=null;
function showConfirm(icon,title,msg,onOk,onCancel){
  document.getElementById('confirmIcon').textContent=icon;
  document.getElementById('confirmTitle').textContent=title;
  document.getElementById('confirmMsg').textContent=msg;
  document.getElementById('confirmOverlay').classList.add('open');
  _ok=onOk; _cancel=onCancel;
}
document.getElementById('confirmOk').addEventListener('click',()=>{
  document.getElementById('confirmOverlay').classList.remove('open'); if(_ok)_ok();
});
document.getElementById('confirmCancel').addEventListener('click',()=>{
  document.getElementById('confirmOverlay').classList.remove('open'); if(_cancel)_cancel();
});

/* ══ EXPORT PNG — always light mode, solid white background ══ */
async function renderCanvasBuilderPng() {
  deselectAll();
  const canvas=document.getElementById('theCanvas');
  if(!canvas) return null;

  await new Promise(r=>setTimeout(r,60));
  const result=await html2canvas(canvas,{
    backgroundColor:'#ffffff',
    scale:2, useCORS:true, logging:false, allowTaint:true, removeContainer:true,
    onclone:clonedDoc=>{
      clonedDoc.body.classList.add('light');
      const clonedCanvas=clonedDoc.getElementById('theCanvas');
      if(clonedCanvas) clonedCanvas.classList.add('export-light-theme');
    },
  });
  const wCtx=result.getContext('2d');
  wCtx.save();
  wCtx.globalAlpha=0.22;
  wCtx.font='500 33px "DM Sans",sans-serif';
  wCtx.fillStyle='#1a1a1a';
  wCtx.textAlign='right';
  wCtx.textBaseline='bottom';
  {
    const wmText='Made using tool.adjiebrotots.com/canvasbuilder';
    const wmX=result.width-36, wmY=result.height-36;
    const wmTextW=wCtx.measureText(wmText).width;
    const wmLogoSize=39;
    if(wmLogoImg.complete && wmLogoImg.naturalWidth){
      wCtx.drawImage(wmLogoImg, wmX-wmTextW-12-wmLogoSize, wmY-wmLogoSize+6, wmLogoSize, wmLogoSize);
    }
    wCtx.fillText(wmText,wmX,wmY);
  }
  wCtx.restore();
  return result;
}
async function copyCanvasPngToClipboard(canvas) {
  if(!navigator.clipboard || !window.ClipboardItem) throw new Error('Clipboard image copy is not supported in this browser.');
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if(!blob) throw new Error('Could not create PNG blob.');
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
document.getElementById('savePngBtn').addEventListener('click', async()=>{
  document.getElementById('exportOverlay').classList.add('open');
  try {
    const result=await renderCanvasBuilderPng();
    if(!result) return;
    const link=document.createElement('a');
    const safe=(S.canvasName||'canvas').replace(/[^a-z0-9\-_ ]/gi,'').trim()||'canvas';
    link.download=safe+'-'+S.canvasType+'.png';
    link.href=result.toDataURL('image/png');
    link.click();
    showToast('PNG saved ✓','success'); markClean();
  } catch(err){
    console.error(err);
    showToast('PNG export failed','error');
  } finally {
    document.getElementById('exportOverlay').classList.remove('open');
  }
});
document.getElementById('copyPngBtn').addEventListener('click', async()=>{
  document.getElementById('exportOverlay').classList.add('open');
  try {
    const result=await renderCanvasBuilderPng();
    if(!result) return;
    await copyCanvasPngToClipboard(result);
    showToast('PNG copied ✓','success'); markClean();
  } catch(err){
    console.error(err);
    showToast('PNG copy failed','error');
  } finally {
    document.getElementById('exportOverlay').classList.remove('open');
  }
});

/* ══ EXPORT JSON ═════════════════════════════════════ */
document.getElementById('saveJsonBtn').addEventListener('click',()=>{
  const data={'canvas-name':S.canvasName,'canvas-type':S.canvasType,'cell-sizes':S.cellSizes,'_source':'tool.adjiebrotots.com/canvasbuilder'};
  curSecs().forEach(sec=>{
    data[sec.id]=(S.sections[sec.id]||[]).map(item=>({
      value: item.value,
      'font-size': item.fontSize,
      'font-family': item.fontFamily||'',
      location:{x:Math.round(item.x),y:Math.round(item.y)},
    }));
  });
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const link=document.createElement('a');
  const safe=(S.canvasName||'canvas').replace(/[^a-z0-9\-_ ]/gi,'').toLowerCase().replace(/\s+/g,'-')||'canvas';
  link.download=safe+'-'+S.canvasType+'.json';
  link.href=URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('JSON saved ✓','success'); markClean();
});

/* ══ IMPORT JSON ═════════════════════════════════════ */
document.getElementById('loadJsonBtn').addEventListener('click',()=>document.getElementById('jsonFileInput').click());
document.getElementById('jsonFileInput').addEventListener('change',e=>{
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=ev=>{
    try{ doLoad(JSON.parse(ev.target.result)); }
    catch{ showToast('Invalid JSON file','error'); }
  };
  r.readAsText(f); e.target.value='';
});

function doLoad(data){
  const apply=()=>{
    const type=data['canvas-type']==='vpc'?'vpc':'bmc';
    S.canvasType=type; S.canvasName=data['canvas-name']||'Untitled Canvas';
    S.sections=mkSections(type); S.nextId=1;
    document.getElementById('canvasTypeSelect').value=type;
    document.getElementById('canvasNameInput').value=S.canvasName;
    const cs=data['cell-sizes'];
    if(cs){
      const ok3=(a)=>Array.isArray(a)&&a.length===3&&a.every(n=>typeof n==='number'&&n>0);
      const ok5=(a)=>Array.isArray(a)&&a.length===5&&a.every(n=>typeof n==='number'&&n>0);
      S.cellSizes={
        bmc: ok3(cs.bmc)?cs.bmc:[1,1,0.52],
        vpc: ok3(cs.vpc)?cs.vpc:[1,1,1],
        vpcColFrac: (typeof cs.vpcColFrac==='number'&&cs.vpcColFrac>0&&cs.vpcColFrac<1)?cs.vpcColFrac:0.5,
        bmcColFracs: ok5(cs.bmcColFracs)?cs.bmcColFracs:[1,1,1,1,1],
      };
    }
    const secs=type==='bmc'?BMC:VPC;
    secs.forEach(sec=>{
      const raw=data[sec.id];
      if(!Array.isArray(raw)) return;
      S.sections[sec.id]=raw.map(r=>({
        id:'i'+(S.nextId++),
        value: r.value||'',
        fontSize: r['font-size']||13,
        fontFamily: r['font-family']||'',
        x: r.location?.x??10,
        y: r.location?.y??10,
      }));
    });
    S.selectedItem=null; markClean(); renderCanvas();
    showToast('Canvas loaded ✓','success');
  };
  if(S.isDirty&&hasContent())
    showConfirm('📂','Load Canvas','Loading will replace the current canvas. Proceed?',apply,null);
  else apply();
}

/* ══ THEME TOGGLE ════════════════════════════════════ */
document.getElementById('themeBtn').addEventListener('click',()=>{
  const isLight=document.body.classList.toggle('light');
  document.getElementById('themeBtn').textContent=isLight?'🌙 Dark':'☀️ Light';
});

/* ══ KEYBOARD ════════════════════════════════════════ */
document.addEventListener('keydown',e=>{
  if(e.key==='Escape') deselectAll();
  if((e.key==='Delete'||e.key==='Backspace')&&S.selectedItem
     &&!document.activeElement?.closest('.item-text, input, select, textarea'))
    deleteItem(S.selectedItem.sectionId,S.selectedItem.itemId);
});
document.addEventListener('click',e=>{
  if(!e.target.closest('.canvas-wrapper')&&!e.target.closest('#floatingBar')) deselectAll();
});

/* ══ RESIZE ══════════════════════════════════════════ */
const ro=new ResizeObserver(()=>{
  if(S.canvasType==='vpc'){
    const vpc=document.getElementById('theCanvas');
    if(vpc) applyVPCColWidths(vpc);
    sizeVPCCircle();
    const left=document.querySelector('.vpc-left');
    if(left) applyVPCLeftRowHeights(left);
  } else {
    const grid=document.getElementById('theCanvas');
    applyBMCColWidths(grid);
    applyBMCRowHeights(grid);
  }
});
ro.observe(document.getElementById('canvasWrapper'));

/* ══ TOAST ═══════════════════════════════════════════ */
function showToast(msg,type='success'){
  document.querySelectorAll('.toast').forEach(t=>t.remove());
  const t=document.createElement('div');
  t.className=`toast ${type}`; t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),2300);
}

/* ══ SCROLL HINT ═════════════════════════════════════ */
function triggerScrollHint(){
  if(window.innerWidth>=920) return;
  const h=document.getElementById('scrollHint');
  const c=h.cloneNode(true); c.id='scrollHint'; h.replaceWith(c);
}

/* ══ INIT ════════════════════════════════════════════ */
S.sections=mkSections(S.canvasType);
renderCanvas();
setTimeout(triggerScrollHint,800);

})();
