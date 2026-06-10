(function(){
'use strict';

// Watermark logo (logos/logo.svg), preloaded for use in canvas/SVG exports
const WM_LOGO_SRC = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDY4MCA2ODAiIHJvbGU9ImltZyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8dGl0bGU+QXJjaGVkIEEgTG9nbzwvdGl0bGU+CiAgPGRlc2M+QSBzbGVlayB3aGl0ZSBsZXR0ZXIgQSB3aG9zZSBsZWdzIGZvbGxvdyB0aGUgY2lyY2xlIGN1cnZhdHVyZSwgc3Bhbm5pbmcgODAlIG9mIHRoZSBjaXJjbGUgaGVpZ2h0PC9kZXNjPgoKICA8Y2lyY2xlIGN4PSIzNDAiIGN5PSIzNDAiIHI9IjMwMCIgZmlsbD0iIzAwNTJjYyIvPgoKICA8IS0tIExlZnQgbGVnOiAxMTPCsCB0byAyNDXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyNDIsNTcwIEEgMjUwLDI1MCAwIDAgMSAyMzQsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFRvcCBhcmNoOiAyNDXCsCB0byAyOTXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyMzQsMTEzIEEgMjUwLDI1MCAwIDAgMSA0NDYsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFJpZ2h0IGxlZzogMjk1wrAgdG8gNjfCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSA0NDYsMTEzIEEgMjUwLDI1MCAwIDAgMSA0MzgsNTcwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIENyb3NzYmFyIC0tPgogIDxsaW5lIHgxPSIxMTMiIHkxPSIzNTQiIHgyPSI1NjciIHkyPSIzNTQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNDIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K';
const _wmMeasureCtx = document.createElement('canvas').getContext('2d');
function measureWmText(text, font){ _wmMeasureCtx.font = font; return _wmMeasureCtx.measureText(text).width; }

// ═══════════════════════════════════════════════
//  PALETTES
// ═══════════════════════════════════════════════
const PALETTES = {
  tableau:['#4E79A7','#F28E2B','#E15759','#76B7B2','#59A14F','#EDC948','#B07AA1','#FF9DA7','#9C755F','#BAB0AC'],
  d3cat:  ['#1F77B4','#FF7F0E','#2CA02C','#D62728','#9467BD','#8C564B','#E377C2','#7F7F7F','#BCBD22','#17BECF'],
  pastel: ['#8DBBFF','#FF8B8B','#8FCDBD','#F1C0D0','#FFD28C','#B5A8FF','#A8E6CF','#F9C74F','#C9F0D1','#FFB3BA'],
  vivid:  ['#E63946','#2A9D8F','#E9C46A','#F4A261','#264653','#A8DADC','#457B9D','#6A0572','#F77F00','#7B2D8B'],
  cool:   ['#08519C','#3182BD','#6BAED6','#9ECAE1','#C6DBEF','#238B45','#41AB5D','#74C476','#A1D99B','#C7E9C0'],
  warm:   ['#D73027','#F46D43','#FDAE61','#FEE08B','#7FBC41','#4393C3','#F4A582','#D6604D','#FFEDA0','#FEB24C'],
};

// ═══════════════════════════════════════════════
//  DEFAULTS
// ═══════════════════════════════════════════════
const DEFAULT_ROWS = [
  {source:'Husband Income',  target:'Family Income', value:'5000', color:'#6BA5D7'},
  {source:'Wife Income',     target:'Family Income', value:'4000', color:'#82C4A0'},
  {source:'Family Income',   target:'Housing',       value:'2200', color:''},
  {source:'Family Income',   target:'Food',          value:'900',  color:''},
  {source:'Family Income',   target:'Transport',     value:'600',  color:''},
  {source:'Family Income',   target:'Savings',       value:'1500', color:'#8FCDBD'},
  {source:'Family Income',   target:'Leisure',       value:'remaining', color:''},
  {source:'Housing',         target:'Mortgage',      value:'1600', color:''},
  {source:'Housing',         target:'Utilities',     value:'remaining', color:''},
  {source:'Savings',         target:'Emergency Fund',value:'500',  color:'#8FCDBD'},
  {source:'Savings',         target:'Investments',   value:'remaining', color:'#6BA5D7'},
];
const DEFAULT_S = {align:'justify',pad:20,nw:18,op:42,h:520,scheme:'tableau',label:'auto',linkStyle:'gradient',iter:32,labelBox:false,valueMode:'nominal'};

// ═══════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════
let rows = clone(DEFAULT_ROWS);
let S    = clone(DEFAULT_S);

function clone(x){ return JSON.parse(JSON.stringify(x)); }

// ═══════════════════════════════════════════════
//  DOM
// ═══════════════════════════════════════════════
const $  = id => document.getElementById(id);
const svgEl      = $('sankeySvg');
const tip        = $('tooltip');
const tableBody  = $('tableBody');
const txtIn      = $('textInput');
const errBanner  = $('errBanner');
const emptyState = $('emptyState');

// ═══════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════
function nodeColor(name){
  const pal = PALETTES[S.scheme] || PALETTES.tableau;
  let h = 5381;
  for(let i=0;i<name.length;i++) h=((h<<5)+h)+name.charCodeAt(i)|0;
  return pal[Math.abs(h) % pal.length];
}

function fmtNum(v){
  if(v==null||isNaN(v)) return '—';
  if(v>=1e9) return (v/1e9).toFixed(2).replace(/\.?0+$/,'')+'B';
  if(v>=1e6) return (v/1e6).toFixed(2).replace(/\.?0+$/,'')+'M';
  if(v>=1e3) return (v/1e3).toFixed(1).replace(/\.?0+$/,'')+'K';
  return Number(v).toLocaleString('en-AU',{maximumFractionDigits:2});
}

function hex(c){ return /^#[0-9A-Fa-f]{3,8}$/.test(c); }

function cssVar(name){
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function labelLines(label){
  const lines = String(label ?? '').split('|').map(line=>line.trim());
  return lines.length ? lines : [''];
}

function appendMultilineText(textEl, lines, x, lineHeight){
  lines.forEach((line, i)=>{
    textEl.append('tspan')
      .attr('x', x)
      .attr('dy', i === 0 ? 0 : lineHeight)
      .text(line);
  });
}

function autoResize(ta){
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}

// ═══════════════════════════════════════════════
//  RESOLVE "remaining"
// ═══════════════════════════════════════════════
function resolveRows(rawRows){
  const incoming  = {};
  const explOut   = {};
  const remSrcs   = {};

  rawRows.forEach(r=>{
    const s = (r.source||'').trim();
    const t = (r.target||'').trim();
    if(!s||!t||s===t) return;
    const vStr = (r.value+'').trim().toLowerCase();
    if(vStr==='remaining'){
      remSrcs[s] = (remSrcs[s]||0)+1;
    } else {
      const v = parseFloat(r.value);
      if(!isNaN(v)&&v>0){
        incoming[t] = (incoming[t]||0)+v;
        explOut[s]  = (explOut[s] ||0)+v;
      }
    }
  });

  const out = [];
  rawRows.forEach(r=>{
    const s = (r.source||'').trim();
    const t = (r.target||'').trim();
    if(!s||!t||s===t) return;
    const vStr = (r.value+'').trim().toLowerCase();
    if(vStr==='remaining'){
      const count  = remSrcs[s]||1;
      const avail  = (incoming[s]||0)-(explOut[s]||0);
      const val    = Math.max(0, avail/count);
      out.push({...r, source:s, target:t, resolvedValue:val, wasRemaining:true});
    } else {
      const v = parseFloat(r.value);
      if(!isNaN(v)&&v>0) out.push({...r, source:s, target:t, resolvedValue:v, wasRemaining:false});
    }
  });
  return out;
}

// ═══════════════════════════════════════════════
//  BUILD SANKEY INPUT DATA
// ═══════════════════════════════════════════════
function buildData(resolved){
  const linkMap = new Map();
  resolved.forEach(r=>{
    const k = `${r.source}\x00${r.target}`;
    if(linkMap.has(k)){
      const ex = linkMap.get(k);
      ex.resolvedValue += r.resolvedValue;
      if(!ex.color && r.color) ex.color = r.color;
    } else {
      linkMap.set(k, {...r});
    }
  });
  const dedupe = [...linkMap.values()].filter(r=>r.resolvedValue>0);

  const names   = [...new Set(dedupe.flatMap(r=>[r.source,r.target]))];
  const nodeIdx = new Map(names.map((n,i)=>[n,i]));

  return {
    nodes: names.map(name=>({name})),
    links: dedupe.map(r=>({
      source:      nodeIdx.get(r.source),
      target:      nodeIdx.get(r.target),
      value:       r.resolvedValue,
      customColor: r.color && hex(r.color) ? r.color : null,
      _src:        r.source,
      _tgt:        r.target,
    })),
  };
}

// ═══════════════════════════════════════════════
//  RENDER SANKEY
// ═══════════════════════════════════════════════
let renderTimer = null;
let graph = null;
let sankeyGen = null;
function scheduleRender(){ clearTimeout(renderTimer); renderTimer=setTimeout(doRender,40); }

function doRender(){
  graph = null;
  const resolved = resolveRows(rows);
  updateRemBadges(resolved);

  errBanner.style.display='none';
  d3.select(svgEl).selectAll('*').remove();

  if(!resolved.length){
    emptyState.style.display='flex';
    setKPIs(0,0,0,0);
    return;
  }
  emptyState.style.display='none';

  let data;
  try{ data = buildData(resolved); }
  catch(e){ showErr('Data error: '+e.message); return; }

  // Build node color override: source node name → first custom color from its outgoing links
  const nodeColorOverride = {};
  data.links.forEach(lk=>{
    if(lk.customColor && !(lk._src in nodeColorOverride)){
      nodeColorOverride[lk._src] = lk.customColor;
    }
  });
  function effNodeColor(name){
    return nodeColorOverride[name] || nodeColor(name);
  }

  const wrap = $('svgWrap');
  const W = Math.max(600, wrap.clientWidth||800);
  const H = S.h;
  const mL=130, mR=140, mT=10, mB=16;

  svgEl.setAttribute('viewBox',`0 0 ${W} ${H}`);
  svgEl.setAttribute('width', W);
  svgEl.setAttribute('height', H);

  const alignMap = {justify:d3.sankeyJustify,left:d3.sankeyLeft,right:d3.sankeyRight,center:d3.sankeyCenter};

  let graphResult;
  try{
    const gen = d3.sankey()
      .nodeAlign(alignMap[S.align]||d3.sankeyJustify)
      .nodeWidth(S.nw)
      .nodePadding(S.pad)
      .iterations(S.iter)
      .extent([[mL,mT],[W-mR,H-mB]]);
    sankeyGen = gen;
    graphResult = gen({
      nodes: data.nodes.map(d=>({...d})),
      links: data.links.map(d=>({...d})),
    });
  } catch(e){
    showErr('Layout error: '+(e.message||'Check for cycles or duplicate paths'));
    return;
  }
  graph = graphResult;

  const svg  = d3.select(svgEl);
  const defs = svg.append('defs');
  const op   = S.op/100;

  // Max node value (used for % display mode)
  const maxNodeValue = Math.max(...graph.nodes.map(n=>n.value));

  // Build gradients
  graph.links.forEach((lk,i)=>{
    const sc = effNodeColor(lk.source.name);
    const tc = effNodeColor(lk.target.name);
    if(S.linkStyle==='gradient'){
      const g = defs.append('linearGradient')
        .attr('id',`lg${i}`)
        .attr('gradientUnits','userSpaceOnUse')
        .attr('x1',lk.source.x1).attr('x2',lk.target.x0);
      g.append('stop').attr('offset','0%').attr('stop-color',lk.customColor||sc).attr('stop-opacity',Math.min(op+0.1,0.95));
      g.append('stop').attr('offset','100%').attr('stop-color',tc).attr('stop-opacity',op);
    }
  });

  // ── LINKS ──
  const linkG = svg.append('g');
  linkG.selectAll('path')
    .data(graph.links)
    .join('path')
      .attr('d', d3.sankeyLinkHorizontal())
      .attr('fill','none')
      .attr('stroke',(d,i)=>{
        if(d.customColor&&S.linkStyle!=='gradient') return d.customColor;
        if(S.linkStyle==='gradient') return `url(#lg${i})`;
        if(S.linkStyle==='source')   return effNodeColor(d.source.name);
        return effNodeColor(d.target.name);
      })
      .attr('stroke-opacity', op)
      .attr('stroke-width', d=>Math.max(1,d.width))
      .style('cursor','default')
      .on('mouseenter', function(ev,d){
        d3.select(this).attr('stroke-opacity',Math.min(op+0.28,0.95));
        const pct = d.source.value>0 ? (d.value/d.source.value*100).toFixed(1)+'%' : '—';
        showTip(ev,
          `${d._src} → ${d._tgt}`,
          fmtNum(d.value),
          `${pct} of source · target total: ${fmtNum(d.target.value)}`
        );
      })
      .on('mousemove', moveTip)
      .on('mouseleave', function(ev,d){
        d3.select(this).attr('stroke-opacity',op);
        hideTip();
      });

  // ── NODES ──
  const nodeG = svg.append('g');
  const nodeGroups = nodeG.selectAll('g')
    .data(graph.nodes)
    .join('g')
    .style('cursor','grab');

  nodeGroups.append('rect')
    .attr('class','node-rect')
    .attr('x',d=>d.x0).attr('y',d=>d.y0)
    .attr('width',d=>d.x1-d.x0).attr('height',d=>d.y1-d.y0)
    .attr('fill',d=>effNodeColor(d.name))
    .attr('rx',3).attr('ry',3)
    .on('mouseenter',(ev,d)=>{
      const inV  = d.targetLinks.reduce((s,l)=>s+l.value,0);
      const outV = d.sourceLinks.reduce((s,l)=>s+l.value,0);
      const lines = [];
      if(inV>0)  lines.push(`In: <b>${fmtNum(inV)}</b>`);
      if(outV>0) lines.push(`Out: <b>${fmtNum(outV)}</b>`);
      if(!inV&&!outV) lines.push(`Value: <b>${fmtNum(d.value)}</b>`);
      showTip(ev, d.name, fmtNum(d.value), lines.join(' · '));
    })
    .on('mousemove', moveTip)
    .on('mouseleave', hideTip);

  // ── LABELS ──
  function renderNodeLabel(grp, d){
    grp.selectAll('text').remove();
    grp.selectAll('.label-bg').remove();
    const nodeH  = d.y1 - d.y0;
    const midY   = (d.y0 + d.y1) / 2;
    const onLeft = d.x0 < W / 2;
    const isInside  = S.label === 'inside' || (S.label === 'auto' && nodeH > 36);
    const valOffset = 14;
    const isLight    = document.body.classList.contains('light');
    const textColor  = isLight ? '#000000' : (cssVar('--text')  || '#EAF1FF');
    const mutedColor = isLight ? '#000000' : (cssVar('--muted') || '#A8B6CF');
    const boxBg      = isLight ? 'rgba(255,255,255,0.96)' : 'rgba(15,23,40,0.78)';
    const boxStroke  = isLight ? 'rgba(0,0,0,0.24)'      : 'rgba(234,241,255,0.18)';
    let tx, anchor, nameColor, valColor, nameSize;
    if (isInside) {
      tx = (d.x0 + d.x1) / 2; anchor = 'middle';
      nameColor = isLight ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)';
      valColor  = isLight ? 'rgba(0,0,0,0.60)' : 'rgba(255,255,255,0.70)';
      nameSize  = Math.min(12, nodeH * 0.38);
    } else if (S.label === 'outside' || (S.label === 'auto' && !onLeft)) {
      tx = d.x0 - 7; anchor = 'end';
      nameColor = textColor; valColor = mutedColor; nameSize = 12;
    } else {
      tx = d.x1 + 7; anchor = 'start';
      nameColor = textColor; valColor = mutedColor; nameSize = 12;
    }
    const lines = labelLines(d.name);
    const nameLineHeight = Math.max(13, nameSize * 1.15);
    const nameStartDy = -((lines.length - 1) * nameLineHeight) / 2;
    const nameEl = grp.append('text')
      .attr('x', tx).attr('y', midY + nameStartDy)
      .attr('data-dy', nameStartDy)
      .attr('text-anchor', anchor)
      .attr('dominant-baseline', 'middle')
      .attr('fill', nameColor)
      .attr('font-family', 'DM Sans,system-ui,sans-serif')
      .attr('font-size', nameSize)
      .attr('font-weight', '700')
      .style('pointer-events', 'none');
    appendMultilineText(nameEl, lines, tx, nameLineHeight);

    let valEl = null;
    if (nodeH > 18 && S.valueMode !== 'none') {
      let valText;
      if (S.valueMode === 'percent') {
        valText = maxNodeValue > 0 ? (d.value / maxNodeValue * 100).toFixed(1) + '%' : '—';
      } else {
        valText = fmtNum(d.value);
      }
      const valueDy = nameStartDy + ((lines.length - 1) * nameLineHeight) + valOffset;
      valEl = grp.append('text')
        .attr('x', tx).attr('y', midY + valueDy)
        .attr('data-dy', valueDy)
        .attr('text-anchor', anchor)
        .attr('dominant-baseline', 'middle')
        .attr('fill', valColor)
        .attr('font-family', 'DM Mono,monospace')
        .attr('font-size', Math.min(11, nameSize - 1))
        .attr('font-weight', '400')
        .text(valText)
        .style('pointer-events', 'none');
    }
    if (S.labelBox && !isInside) {
      try {
        const pad = 5;
        const nb  = nameEl.node().getBBox();
        const vb  = valEl ? valEl.node().getBBox() : nb;
        const bx  = Math.min(nb.x, vb.x) - pad;
        const by  = nb.y - pad;
        const bw  = Math.max(nb.x + nb.width, vb.x + vb.width) - Math.min(nb.x, vb.x) + pad * 2;
        const bh  = (valEl ? vb.y + vb.height : nb.y + nb.height) - nb.y + pad * 2;
        grp.insert('rect', 'text')
          .attr('x', bx).attr('y', by)
          .attr('data-dy', by - midY)
          .attr('width', Math.max(0, bw)).attr('height', Math.max(0, bh))
          .attr('rx', 4).attr('ry', 4)
          .attr('fill', boxBg).attr('stroke', boxStroke).attr('stroke-width', 1)
          .attr('class', 'label-bg')
          .style('pointer-events', 'none');
      } catch(e) {}
    }
  }
  nodeGroups.each(function(d) { renderNodeLabel(d3.select(this), d); });

  // ── DRAG ──
  const nodeDrag = d3.drag()
    .on('start', function(event, d) {
      d3.select(this).raise().style('cursor', 'grabbing');
    })
    .on('drag', function(event, d) {
      const nodeH = d.y1 - d.y0;
      const nodeW = d.x1 - d.x0;
      d.y0 = Math.max(mT, Math.min(H - mB - nodeH, d.y0 + event.dy));
      d.y1 = d.y0 + nodeH;
      d.x0 = Math.max(0, Math.min(W - nodeW, d.x0 + event.dx));
      d.x1 = d.x0 + nodeW;
      sankeyGen.update(graph);
      const g = d3.select(this);
      g.select('.node-rect').attr('x', d.x0).attr('y', d.y0);
      renderNodeLabel(g, d);
      linkG.selectAll('path').attr('d', d3.sankeyLinkHorizontal());
      if (S.linkStyle === 'gradient') {
        graph.links.forEach((lk, i) => {
          d3.select(svgEl).select(`#lg${i}`)
            .attr('x1', lk.source.x1).attr('x2', lk.target.x0);
        });
      }
    })
    .on('end', function(event, d) {
      d3.select(this).style('cursor', 'grab');
    });
  nodeGroups.call(nodeDrag).style('touch-action', 'none');

  // ── KPIs ──
  const roots   = graph.nodes.filter(n=>n.targetLinks.length===0);
  const inflow  = roots.reduce((s,n)=>s+n.value,0);
  const maxDepth= Math.max(...graph.nodes.map(n=>n.depth||0));
  setKPIs(graph.nodes.length, graph.links.length, inflow, maxDepth+1);
}

// ═══════════════════════════════════════════════
//  TOOLTIP
// ═══════════════════════════════════════════════
function showTip(ev, title, val, sub){
  tip.innerHTML = `<div class="tt-title">${title}</div><div class="tt-val">${val}</div>${sub?`<div class="tt-row">${sub}</div>`:''}`;
  tip.classList.add('show');
  moveTip(ev);
}
function moveTip(ev){
  const pad=14, tw=tip.offsetWidth||210, th=tip.offsetHeight||80;
  let x=ev.clientX+pad, y=ev.clientY-10;
  if(x+tw>window.innerWidth-8)  x=ev.clientX-tw-pad;
  if(y+th>window.innerHeight-8) y=ev.clientY-th-pad;
  tip.style.left=x+'px'; tip.style.top=y+'px';
}
function hideTip(){ tip.classList.remove('show'); }

function showErr(msg){
  errBanner.textContent='⚠ '+msg;
  errBanner.style.display='block';
  emptyState.style.display='none';
}

function setKPIs(n,l,f,d){
  $('kNodes').textContent = n||'—';
  $('kLinks').textContent = l||'—';
  $('kFlow').textContent  = f?fmtNum(f):'—';
  $('kDepth').textContent = d||'—';
}

// ═══════════════════════════════════════════════
//  REMAINING BADGES
// ═══════════════════════════════════════════════
function updateRemBadges(resolved){
  tableBody.querySelectorAll('.rem-badge').forEach(b=>{ b.style.display='none'; b.textContent=''; });
  resolved.forEach(r=>{
    if(!r.wasRemaining) return;
    tableBody.querySelectorAll('.rem-badge').forEach(b=>{
      if(b.dataset.src===r.source && b.dataset.tgt===r.target){
        b.textContent = '= '+fmtNum(r.resolvedValue);
        b.style.display = 'inline-block';
      }
    });
  });
}

// ═══════════════════════════════════════════════
//  TABLE EDITOR – BUILD UI ROWS
// ═══════════════════════════════════════════════
function buildTableRows(){
  tableBody.innerHTML = '';
  rows.forEach((r,i) => tableBody.appendChild(makeTableRow(r,i)));
}

function makeTableRow(r, i){
  const tr = document.createElement('tr');
  tr.dataset.idx = i;

  // From cell
  const tdFrom = document.createElement('td');
  const taFrom = document.createElement('textarea');
  taFrom.className = 'tc-inp tc-from';
  taFrom.value = r.source || '';
  taFrom.rows = 1;
  taFrom.placeholder = 'Source';
  tdFrom.appendChild(taFrom);
  tr.appendChild(tdFrom);

  // To cell
  const tdTo = document.createElement('td');
  const taTo = document.createElement('textarea');
  taTo.className = 'tc-inp tc-to';
  taTo.value = r.target || '';
  taTo.rows = 1;
  taTo.placeholder = 'Target';
  tdTo.appendChild(taTo);
  tr.appendChild(tdTo);

  // Amount cell (with rem-badge)
  const tdAmt = document.createElement('td');
  tdAmt.className = 'td-amt';
  const amtWrap = document.createElement('div');
  amtWrap.className = 'td-amt-cell';
  const inpAmt = document.createElement('input');
  inpAmt.type = 'text';
  inpAmt.className = 'tc-inp tc-amt';
  inpAmt.value = r.value || '';
  inpAmt.placeholder = 'Value';
  const badge = document.createElement('span');
  badge.className = 'rem-badge';
  badge.dataset.src = r.source || '';
  badge.dataset.tgt = r.target || '';
  const isRem = (r.value+'').trim().toLowerCase() === 'remaining';
  badge.style.display = isRem ? 'inline-block' : 'none';
  amtWrap.appendChild(inpAmt);
  amtWrap.appendChild(badge);
  tdAmt.appendChild(amtWrap);
  tr.appendChild(tdAmt);

  // Color cell
  const hasC = r.color && hex(r.color);
  const tdColor = document.createElement('td');
  tdColor.className = 'td-color';
  const colorCell = document.createElement('div');
  colorCell.className = 'color-cell' + (hasC ? ' has-color' : '');
  const colorPick = document.createElement('input');
  colorPick.type = 'color';
  colorPick.className = 'row-color';
  colorPick.value = hasC ? r.color : '#8DBBFF';
  if(!hasC){ colorPick.style.opacity='0.35'; colorPick.title='Click to set custom colour'; }
  const clearBtn = document.createElement('button');
  clearBtn.className = 'color-clear';
  clearBtn.title = 'Remove custom colour';
  clearBtn.textContent = '×';
  colorCell.appendChild(colorPick);
  colorCell.appendChild(clearBtn);
  tdColor.appendChild(colorCell);
  tr.appendChild(tdColor);

  // Del cell
  const tdDel = document.createElement('td');
  tdDel.className = 'td-del';
  const delBtn = document.createElement('button');
  delBtn.className = 'del-btn';
  delBtn.title = 'Remove row';
  delBtn.innerHTML = '✕';
  tdDel.appendChild(delBtn);
  tr.appendChild(tdDel);

  // Auto-resize textareas on init
  requestAnimationFrame(()=>{ autoResize(taFrom); autoResize(taTo); });

  // Events
  [taFrom, taTo].forEach(ta=>{
    ta.addEventListener('input', ()=>{
      autoResize(ta);
      readFromEditor(); syncText(); scheduleRender();
    });
  });

  inpAmt.addEventListener('input', ()=>{
    readFromEditor(); syncText(); scheduleRender();
  });

  colorPick.addEventListener('input', ()=>{
    rows[i].color = colorPick.value;
    colorCell.classList.add('has-color');
    colorPick.style.opacity = '1';
    colorPick.title = '';
    syncText(); scheduleRender();
  });

  clearBtn.addEventListener('click', ()=>{
    rows[i].color = '';
    colorCell.classList.remove('has-color');
    colorPick.style.opacity = '0.35';
    colorPick.title = 'Click to set custom colour';
    syncText(); scheduleRender();
  });

  delBtn.addEventListener('click', ()=>{
    rows.splice(i, 1);
    buildTableRows(); syncText(); scheduleRender();
  });

  return tr;
}

function readFromEditor(){
  const trs = tableBody.querySelectorAll('tr[data-idx]');
  trs.forEach((tr, i)=>{
    if(!rows[i]) rows[i] = {source:'',target:'',value:'',color:''};
    rows[i].source = tr.querySelector('.tc-from').value.trim();
    rows[i].target = tr.querySelector('.tc-to').value.trim();
    rows[i].value  = tr.querySelector('.tc-amt').value.trim();
    const badge = tr.querySelector('.rem-badge');
    if(badge){
      badge.dataset.src = rows[i].source;
      badge.dataset.tgt = rows[i].target;
      const isNowRem = rows[i].value.trim().toLowerCase() === 'remaining';
      badge.style.display = isNowRem ? 'inline-block' : 'none';
      if(!isNowRem) badge.textContent = '';
    }
  });
}

// ═══════════════════════════════════════════════
//  TEXT TAB SYNC
// ═══════════════════════════════════════════════
function rowsToText(rr){
  return rr.map(r=>{
    const parts = [r.source, r.target, r.value];
    if(r.color && hex(r.color)) parts.push(r.color);
    return parts.join(',');
  }).join('\n');
}

function syncText(){
  txtIn.value = rowsToText(rows);
}

function parseText(text){
  const lines = text.split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#'));
  const result=[];
  const errs=[];
  lines.forEach((line,li)=>{
    const parts = line.split(',').map(p=>p.trim());
    if(parts.length<3){ errs.push(`Line ${li+1}: needs at least source,target,value`); return; }
    const [source,target,value,...rest]=parts;
    const color = rest.find(p=>hex(p))||'';
    result.push({source,target,value,color});
  });
  return {rows:result, errors:errs};
}

let textTimer=null;
txtIn.addEventListener('input',()=>{
  clearTimeout(textTimer);
  $('textStatus').innerHTML='';
  textTimer=setTimeout(()=>{
    const {rows:parsed, errors} = parseText(txtIn.value);
    if(errors.length){
      $('textStatus').innerHTML=`<span class="status-err">⚠ ${errors[0]}</span>`;
    } else {
      $('textStatus').innerHTML=`<span class="status-ok">✓ ${parsed.length} row${parsed.length!==1?'s':''}</span>`;
    }
    rows = parsed;
    buildTableRows();
    scheduleRender();
  }, 300);
});

// ═══════════════════════════════════════════════
//  CSV
// ═══════════════════════════════════════════════
function parseCSV(text){
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(!lines.length) return [];
  const first = lines[0].toLowerCase();
  const hasHeader = first.includes('source')||first.includes('target')||first.includes('from')||first.includes('to');
  const dataLines = hasHeader ? lines.slice(1) : lines;
  return dataLines.map(line=>{
    const parts = line.split(',').map(p=>p.replace(/^["']|["']$/g,'').trim());
    const [source='',target='',value='',...rest]=parts;
    const color = rest.find(p=>hex(p))||'';
    return {source,target,value,color};
  }).filter(r=>r.source&&r.target&&r.value);
}

function handleFile(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e=>{
    const parsed = parseCSV(e.target.result);
    if(!parsed.length){
      $('csvStatus').innerHTML='<span class="status-err">⚠ No valid rows found</span>';
      return;
    }
    rows = parsed;
    buildTableRows();
    syncText();
    scheduleRender();
    $('csvStatus').innerHTML=`<span class="status-ok">✓ Loaded ${parsed.length} rows from ${file.name}</span>`;
  };
  reader.readAsText(file);
}

$('csvFile').addEventListener('change', e=>handleFile(e.target.files[0]));

const csvDrop = $('csvDrop');
csvDrop.addEventListener('dragover', e=>{e.preventDefault();csvDrop.classList.add('dragover');});
csvDrop.addEventListener('dragleave',()=>csvDrop.classList.remove('dragover'));
csvDrop.addEventListener('drop', e=>{
  e.preventDefault(); csvDrop.classList.remove('dragover');
  handleFile(e.dataTransfer.files[0]);
});
csvDrop.addEventListener('click', ()=>$('csvFile').click());

$('downloadTemplate').addEventListener('click',()=>{
  const tpl = `source,target,value,color
Website,Homepage,1000,
Website,Other Pages,500,
Homepage,Sign Up,300,
Homepage,Bounce,remaining,#FF8B8B
Other Pages,Sign Up,100,
Other Pages,Bounce,remaining,#FF8B8B
Sign Up,Converted,180,#8FCDBD
Sign Up,Dropped,remaining,`;
  const blob=new Blob([tpl],{type:'text/csv'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='sankey_template.csv';
  a.click();
  URL.revokeObjectURL(a.href);
});

// ─── Download current work as CSV ───
$('downloadCsvBtn').addEventListener('click',()=>{
  const header = 'source,target,value,color';
  const dataRows = rows.map(r=>{
    const color = r.color && hex(r.color) ? r.color : '';
    // Wrap fields containing commas in quotes
    const esc = v => (v+'').includes(',') ? `"${v}"` : v;
    return [esc(r.source), esc(r.target), esc(r.value), color].join(',');
  }).join('\n');
  const csv = '# Made using tool.adjiebrotots.com/sankeycreator\n' + header + '\n' + dataRows;
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sankey_data.csv';
  a.click();
  URL.revokeObjectURL(a.href);
});

// ═══════════════════════════════════════════════
//  ADD ROW
// ═══════════════════════════════════════════════
$('addRowBtn').addEventListener('click',()=>{
  rows.push({source:'',target:'',value:'',color:''});
  buildTableRows();
  syncText();
  const last = tableBody.lastElementChild;
  if(last){
    last.scrollIntoView({behavior:'smooth',block:'nearest'});
    last.querySelector('.tc-from').focus();
  }
});

// ═══════════════════════════════════════════════
//  TABS
// ═══════════════════════════════════════════════
document.querySelectorAll('.ctrl-tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.ctrl-tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.ctrl-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    $('tab-'+btn.dataset.tab).classList.add('active');
  });
});

// ─── Data sub-tabs ───
document.querySelectorAll('.data-sub-tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const sub = btn.dataset.sub;
    document.querySelectorAll('.data-sub-tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.data-sub-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    $('sub-'+sub).classList.add('active');

    if(sub === 'text'){
      syncText();
    }
    if(sub === 'table'){
      clearTimeout(textTimer);
      const {rows:parsed} = parseText(txtIn.value);
      if(parsed.length){ rows = parsed; }
      buildTableRows();
    }
  });
});

// ═══════════════════════════════════════════════
//  STYLE CONTROLS
// ═══════════════════════════════════════════════
function bindSlider(id, valId, key, fmt, onInput){
  const el=$('s'+id), vEl=$(valId);
  el.addEventListener('input',()=>{
    S[key]=parseFloat(el.value);
    if(vEl) vEl.textContent=fmt(el.value);
    onInput&&onInput();
    scheduleRender();
  });
}
bindSlider('Pad','vPad','pad', v=>v,    null);
bindSlider('NW', 'vNW', 'nw',  v=>v+'px', null);
bindSlider('Op', 'vOp', 'op',  v=>v+'%',  null);
bindSlider('H',  'vH',  'h',   v=>v+'px', null);

$('sColor').addEventListener('change',()=>{ S.scheme=$('sColor').value; scheduleRender(); });
$('sLabel').addEventListener('change',()=>{ S.label=$('sLabel').value;  scheduleRender(); });
$('sLinkStyle').addEventListener('change',()=>{ S.linkStyle=$('sLinkStyle').value; scheduleRender(); });
$('sIter').addEventListener('change',()=>{ S.iter=parseInt($('sIter').value); scheduleRender(); });
$('sLabelBox').addEventListener('change',()=>{ S.labelBox=$('sLabelBox').checked; scheduleRender(); });

document.querySelectorAll('input[name="align"]').forEach(r=>{
  r.addEventListener('change',()=>{ S.align=r.value; scheduleRender(); });
});

document.querySelectorAll('input[name="valueMode"]').forEach(r=>{
  r.addEventListener('change',()=>{ S.valueMode=r.value; scheduleRender(); });
});

// ═══════════════════════════════════════════════
//  RESET / CLEAR
// ═══════════════════════════════════════════════
$('resetBtn').addEventListener('click',()=>{
  rows = clone(DEFAULT_ROWS);
  S    = clone(DEFAULT_S);
  $('sPad').value=S.pad;       $('vPad').textContent=S.pad;
  $('sNW').value=S.nw;         $('vNW').textContent=S.nw+'px';
  $('sOp').value=S.op;         $('vOp').textContent=S.op+'%';
  $('sH').value=S.h;           $('vH').textContent=S.h+'px';
  $('sColor').value=S.scheme;
  $('sLabel').value=S.label;
  $('sLinkStyle').value=S.linkStyle;
  $('sIter').value=S.iter;
  $('sLabelBox').checked=S.labelBox;
  document.querySelector(`input[name="align"][value="${S.align}"]`).checked=true;
  document.querySelector(`input[name="valueMode"][value="${S.valueMode}"]`).checked=true;
  buildTableRows();
  syncText();
  scheduleRender();
});

$('clearBtn').addEventListener('click',()=>{
  rows=[{source:'',target:'',value:'',color:''}];
  buildTableRows();
  syncText();
  scheduleRender();
});

// ═══════════════════════════════════════════════
//  THEME TOGGLE
// ═══════════════════════════════════════════════
$('themeToggle').addEventListener('click',()=>{
  document.body.classList.toggle('light');
  $('themeToggle').textContent = document.body.classList.contains('light') ? '🌙 Dark' : '☀️ Light';
  scheduleRender();
});

// ═══════════════════════════════════════════════
//  EXPORT
// ═══════════════════════════════════════════════
function exportCloneXml(){
  const clone = svgEl.cloneNode(true);
  clone.querySelectorAll('text').forEach(t => t.setAttribute('fill','#1a1a1a'));
  clone.querySelectorAll('.label-bg').forEach(r => r.setAttribute('fill','rgba(255,255,255,0.88)'));
  const W = svgEl.viewBox.baseVal.width || 800;
  const H = svgEl.viewBox.baseVal.height || S.h;
  const titleText = (document.getElementById('diagramTitle')?.value || '').trim();
  const TITLE_H = titleText ? 36 : 0;

  // Expand viewBox to accommodate title at top and watermark at bottom
  clone.setAttribute('viewBox', `0 ${-TITLE_H} ${W} ${H + TITLE_H}`);
  clone.setAttribute('height', H + TITLE_H);

  if(titleText){
    const titleEl = document.createElementNS('http://www.w3.org/2000/svg','text');
    titleEl.setAttribute('x', W / 2); titleEl.setAttribute('y', -10);
    titleEl.setAttribute('text-anchor','middle');
    titleEl.setAttribute('font-family','DM Sans, sans-serif');
    titleEl.setAttribute('font-size','16');
    titleEl.setAttribute('font-weight','700');
    titleEl.setAttribute('fill','#1a1a1a');
    titleEl.textContent = titleText;
    clone.insertBefore(titleEl, clone.firstChild);
  }

  const wm = document.createElementNS('http://www.w3.org/2000/svg','text');
  wm.setAttribute('x', W - 12); wm.setAttribute('y', H - 10);
  wm.setAttribute('text-anchor','end');
  wm.setAttribute('font-family','DM Sans, sans-serif');
  wm.setAttribute('font-size','11');
  wm.setAttribute('fill','#1a1a1a');
  wm.setAttribute('opacity','0.22');
  wm.textContent = 'Made using tool.adjiebrotots.com/sankeycreator';
  clone.appendChild(wm);
  const wmLogoSize = 13;
  const wmTextW = measureWmText(wm.textContent, '11px DM Sans, sans-serif');
  const wmLogo = document.createElementNS('http://www.w3.org/2000/svg','image');
  wmLogo.setAttribute('href', WM_LOGO_SRC);
  wmLogo.setAttributeNS('http://www.w3.org/1999/xlink','href', WM_LOGO_SRC);
  wmLogo.setAttribute('width', wmLogoSize);
  wmLogo.setAttribute('height', wmLogoSize);
  wmLogo.setAttribute('x', W - 12 - wmTextW - 4 - wmLogoSize);
  wmLogo.setAttribute('y', H - 10 - wmLogoSize + 2);
  wmLogo.setAttribute('opacity', '0.22');
  clone.appendChild(wmLogo);
  return new XMLSerializer().serializeToString(clone);
}

$('exportSvgBtn').addEventListener('click',()=>{
  if(!graph) return;
  const xml  = exportCloneXml();
  const blob = new Blob([xml],{type:'image/svg+xml'});
  const a    = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sankey.svg';
  a.click();
  URL.revokeObjectURL(a.href);
});

function renderSankeyPngCanvas() {
  if(!graph) return Promise.resolve(null);
  const W  = svgEl.viewBox.baseVal.width  || 800;
  const H  = svgEl.viewBox.baseVal.height || S.h;
  const xml    = exportCloneXml();
  // exportCloneXml already includes title in viewBox expansion — render the full exported SVG
  const svgB64 = 'data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(xml)));
  const titleText = (document.getElementById('diagramTitle')?.value || '').trim();
  const TITLE_H = titleText ? 36 : 0;
  const TOTAL_H = H + TITLE_H;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = ()=>{
      const canvas = document.createElement('canvas');
      canvas.width = W*3; canvas.height = TOTAL_H*3;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(3,3);
      ctx.drawImage(img,0,0,W,TOTAL_H);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error('Could not render PNG.'));
    img.src=svgB64;
  });
}
async function copyCanvasPngToClipboard(canvas) {
  if(!navigator.clipboard || !window.ClipboardItem) throw new Error('Clipboard image copy is not supported in this browser.');
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if(!blob) throw new Error('Could not create PNG blob.');
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
$('exportPngBtn').addEventListener('click', async()=>{
  const canvas = await renderSankeyPngCanvas();
  if(!canvas) return;
  const a=document.createElement('a');
  a.href=canvas.toDataURL('image/png');
  a.download='sankey.png';
  a.click();
});
$('copyPngBtn').addEventListener('click', async()=>{
  try {
    const canvas = await renderSankeyPngCanvas();
    if(!canvas) return;
    await copyCanvasPngToClipboard(canvas);
    alert('PNG copied to clipboard.');
  } catch(err) { alert('PNG copy failed: ' + err.message); }
});

// ═══════════════════════════════════════════════
//  RESIZE OBSERVER
// ═══════════════════════════════════════════════
const ro = new ResizeObserver(()=>scheduleRender());
ro.observe($('svgWrap'));

// ═══════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════
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
[['sPad','vPad'],['sNW','vNW'],['sOp','vOp'],['sH','vH']
].forEach(([rid,vid])=>makeSliderEditable($(vid),$(rid)));

buildTableRows();
syncText();
scheduleRender();

})();
