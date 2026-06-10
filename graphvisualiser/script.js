// Watermark logo (logos/logo.svg), used in Plotly chart export watermarks
const WM_LOGO_SRC = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDY4MCA2ODAiIHJvbGU9ImltZyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8dGl0bGU+QXJjaGVkIEEgTG9nbzwvdGl0bGU+CiAgPGRlc2M+QSBzbGVlayB3aGl0ZSBsZXR0ZXIgQSB3aG9zZSBsZWdzIGZvbGxvdyB0aGUgY2lyY2xlIGN1cnZhdHVyZSwgc3Bhbm5pbmcgODAlIG9mIHRoZSBjaXJjbGUgaGVpZ2h0PC9kZXNjPgoKICA8Y2lyY2xlIGN4PSIzNDAiIGN5PSIzNDAiIHI9IjMwMCIgZmlsbD0iIzAwNTJjYyIvPgoKICA8IS0tIExlZnQgbGVnOiAxMTPCsCB0byAyNDXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyNDIsNTcwIEEgMjUwLDI1MCAwIDAgMSAyMzQsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFRvcCBhcmNoOiAyNDXCsCB0byAyOTXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyMzQsMTEzIEEgMjUwLDI1MCAwIDAgMSA0NDYsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFJpZ2h0IGxlZzogMjk1wrAgdG8gNjfCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSA0NDYsMTEzIEEgMjUwLDI1MCAwIDAgMSA0MzgsNTcwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIENyb3NzYmFyIC0tPgogIDxsaW5lIHgxPSIxMTMiIHkxPSIzNTQiIHgyPSI1NjciIHkyPSIzNTQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNDIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K';
function wmPlotlyImage(){
  return { source: WM_LOGO_SRC, xref:'paper', yref:'paper', x:1, y:0.07, xanchor:'right', yanchor:'bottom',
    sizex:0.035, sizey:0.05, sizing:'contain', opacity:0.22, layer:'above' };
}
// ─── STATE ────────────────────────────────────────────────────────────────────
const S = {
  raw: null,
  headers: [],
  dim: 2,
  headerRow: 1,
  colormap: 'Viridis',
  seriesColors: {},  // colIdx → hex
};

const DEFAULT_COLORS = [
  '#8DBBFF','#FF8B8B','#8FCDBD','#F1C0D0','#FFD28C',
  '#B3D1FF','#c49bff','#7fcfff','#a8e6cf','#ffaaa5'
];

const COLORMAPS = [
  {name:'Viridis', grad:'linear-gradient(90deg,#440154,#31688e,#35b779,#fde725)'},
  {name:'Plasma',  grad:'linear-gradient(90deg,#0d0887,#cc4778,#f89540,#f0f921)'},
  {name:'Inferno', grad:'linear-gradient(90deg,#000004,#bc3754,#f98e09,#fcffa4)'},
  {name:'Magma',   grad:'linear-gradient(90deg,#000004,#b63679,#fb8861,#fcfdbf)'},
  {name:'Hot',     grad:'linear-gradient(90deg,#000,#f00,#ff0,#fff)'},
  {name:'Jet',     grad:'linear-gradient(90deg,#00008f,#0000ff,#00ffff,#ffff00,#ff0000,#8f0000)'},
  {name:'RdBu',    grad:'linear-gradient(90deg,#053061,#4393c3,#f7f7f7,#d6604d,#67001f)'},
  {name:'YlOrRd',  grad:'linear-gradient(90deg,#ffffcc,#fd8d3c,#f03b20,#bd0026)'},
];

const DIM_HELP = {
  2:'Line graph — X axis + one or more Y series',
  3:'3D scatter — X, Y, Z axes; Z depth colour-coded',
  4:'3D scatter + W column colour-coded as heat map',
};

// ─── THEME ────────────────────────────────────────────────────────────────────
document.getElementById('themeToggle').onclick = () => {
  document.body.classList.toggle('light');
  document.getElementById('themeToggle').textContent =
    document.body.classList.contains('light') ? '🌙 Dark' : '☀️ Light';
  if (S.raw) renderChart();
};

// ─── TABS ─────────────────────────────────────────────────────────────────────
document.querySelectorAll('.ctrl-tab').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.ctrl-tab,.ctrl-panel').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    // Refresh colour pickers when switching to Style tab
    if (btn.dataset.tab === 'style') refreshStyleTab();
  };
});

// ─── DIMENSION BUTTONS ────────────────────────────────────────────────────────
document.querySelectorAll('.dim-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.dim-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    S.dim = +btn.dataset.dim;
    document.getElementById('dimHelp').textContent = DIM_HELP[S.dim];
    if (S.headers.length) buildAxesUI();
    refreshStyleTab();
  };
});

// ─── FILE UPLOAD ──────────────────────────────────────────────────────────────
const uploadZone = document.getElementById('uploadZone');
uploadZone.addEventListener('dragover',  e => { e.preventDefault(); uploadZone.classList.add('drag'); });
uploadZone.addEventListener('dragleave', ()  => uploadZone.classList.remove('drag'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault(); uploadZone.classList.remove('drag');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
document.getElementById('fileInput').onchange  = e => { if (e.target.files[0]) handleFile(e.target.files[0]); };
document.getElementById('headerRow').oninput   = e => {
  S.headerRow = Math.max(1, +e.target.value || 1);
  if (S.raw) parseWithHeader();
};

function handleFile(file) {
  document.getElementById('fileName').textContent = '📄 ' + file.name;
  const ext = file.name.split('.').pop().toLowerCase();
  const reader = new FileReader();
  if (ext === 'csv' || ext === 'tsv') {
    reader.onload = ev => parseCSV(ev.target.result, ext === 'tsv');
    reader.readAsText(file);
  } else {
    reader.onload = ev => parseExcel(ev.target.result);
    reader.readAsArrayBuffer(file);
  }
}

function detectDelimiter(text) {
  const first = text.split('\n')[0];
  const counts = {
    ',':(first.match(/,/g)||[]).length,
    ';':(first.match(/;/g)||[]).length,
    '\t':(first.match(/\t/g)||[]).length,
    '|':(first.match(/\|/g)||[]).length,
  };
  return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
}

function splitCSVLine(line, delim) {
  const result=[]; let cur=''; let inQ=false;
  for (let i=0;i<line.length;i++) {
    const c=line[i];
    if (c==='"') { if(inQ&&line[i+1]==='"'){cur+='"';i++;} else inQ=!inQ; }
    else if (c===delim&&!inQ) { result.push(cur.trim()); cur=''; }
    else cur+=c;
  }
  result.push(cur.trim()); return result;
}

function parseCSV(text, tsv=false) {
  const delim = tsv ? '\t' : detectDelimiter(text);
  const lines  = text.split(/\r?\n/).filter(l=>l.trim());
  S.raw = lines.map(l => splitCSVLine(l, delim));
  parseWithHeader();
}

function parseExcel(buffer) {
  const wb = XLSX.read(buffer, {type:'array'});
  const ws  = wb.Sheets[wb.SheetNames[0]];
  S.raw = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
  parseWithHeader();
}

function parseWithHeader() {
  if (!S.raw || S.raw.length < S.headerRow) { showError('Header row exceeds file length.'); return; }
  S.headers = S.raw[S.headerRow - 1].map((h,i) => (h!==''?String(h):`Col${i+1}`));
  onDataLoaded();
}

function onDataLoaded() {
  setStatus(`${S.headers.length} columns · ${getDataRows().length} rows`, 'success');
  buildAxesUI();
  buildColormapGrid();
  document.getElementById('renderBtn').disabled = false;
  // Auto-switch to Axes tab
  document.querySelectorAll('.ctrl-tab,.ctrl-panel').forEach(el => el.classList.remove('active'));
  document.querySelector('[data-tab="axes"]').classList.add('active');
  document.getElementById('tab-axes').classList.add('active');
}

function getDataRows() {
  if (!S.raw) return [];
  return S.raw.slice(S.headerRow).filter(r => r.some(c => c !== ''));
}

// ─── AXES UI ──────────────────────────────────────────────────────────────────
function buildAxesUI() {
  const c    = document.getElementById('axesContent');
  const opts = S.headers.map((h,i) => `<option value="${i}">${h}</option>`).join('');

  if (S.dim === 2) {
    c.innerHTML = `
      <div class="field-group">
        <label>X Axis</label>
        <select id="axisX">${opts}</select>
      </div>
      <div class="field-group">
        <label>Y Axis <span style="color:var(--muted);font-weight:400;font-size:.78rem">(Ctrl/Cmd = multi-select)</span></label>
        <select id="axisY" multiple size="7" style="height:auto;font-size:.83rem">${opts}</select>
        <div class="help">Each selected column becomes a separate line.</div>
      </div>`;
    setTimeout(() => {
      const sel = document.getElementById('axisY');
      if (sel && sel.options[1]) sel.options[1].selected = true;
      sel.addEventListener('change', buildSeriesColourPickers);
    }, 0);

  } else if (S.dim === 3) {
    c.innerHTML = `
      <div class="field-group"><label>X Axis</label><select id="axisX">${opts}</select></div>
      <div class="field-group"><label>Y Axis</label><select id="axisY">${opts}</select></div>
      <div class="field-group"><label>Z Axis</label><select id="axisZ">${opts}</select></div>`;
    setTimeout(() => {
      const y=document.getElementById('axisY'), z=document.getElementById('axisZ');
      if(y&&y.options[1]) y.options[1].selected=true;
      if(z&&z.options[2]) z.options[2].selected=true;
    }, 0);

  } else {
    c.innerHTML = `
      <div class="field-group"><label>X Axis</label><select id="axisX">${opts}</select></div>
      <div class="field-group"><label>Y Axis</label><select id="axisY">${opts}</select></div>
      <div class="field-group">
        <label>Z Axis <span style="color:var(--muted);font-size:.78rem">(height)</span></label>
        <select id="axisZ">${opts}</select>
      </div>
      <div class="field-group">
        <label>W Axis <span style="color:var(--muted);font-size:.78rem">(colour map)</span></label>
        <select id="axisW">${opts}</select>
        <div class="help">This column will be colour-coded as a heat overlay.</div>
      </div>`;
    setTimeout(() => {
      const y=document.getElementById('axisY'), z=document.getElementById('axisZ'), w=document.getElementById('axisW');
      if(y&&y.options[1]) y.options[1].selected=true;
      if(z&&z.options[2]) z.options[2].selected=true;
      if(w&&w.options[3]) w.options[3].selected=true;
    }, 0);
  }

  refreshStyleTab();
}

// ─── STYLE TAB ────────────────────────────────────────────────────────────────
function refreshStyleTab() {
  const is2d = S.dim === 2;
  document.getElementById('seriesColourSection').style.display = is2d ? 'block' : 'none';
  document.getElementById('heatmapSection').style.display      = is2d ? 'none'  : 'block';
  if (is2d) buildSeriesColourPickers();
}

function getSelected2dYCols() {
  const sel = document.getElementById('axisY');
  if (!sel || !sel.multiple) return [];
  return Array.from(sel.selectedOptions).map(o => +o.value);
}

function buildSeriesColourPickers() {
  if (S.dim !== 2) return;
  const list  = document.getElementById('colorSeriesList');
  const yCols = getSelected2dYCols();

  if (!yCols.length) {
    list.innerHTML = '<div style="color:var(--muted);font-size:.83rem">Select Y columns in Axes tab first.</div>';
    return;
  }

  // Assign defaults for new columns
  yCols.forEach(ci => {
    if (!S.seriesColors[ci]) S.seriesColors[ci] = DEFAULT_COLORS[ci % DEFAULT_COLORS.length];
  });

  list.innerHTML = yCols.map(ci => `
    <div class="color-series-row">
      <span class="color-series-name" title="${S.headers[ci]}">${S.headers[ci]}</span>
      <input type="color" class="color-series-picker" data-col="${ci}" value="${S.seriesColors[ci]}"/>
    </div>`).join('');

  list.querySelectorAll('input[type=color]').forEach(inp => {
    inp.oninput = e => { S.seriesColors[+e.target.dataset.col] = e.target.value; };
  });
}

function buildColormapGrid() {
  document.getElementById('colormapGrid').innerHTML = COLORMAPS.map(cm => `
    <button class="colormap-btn${S.colormap===cm.name?' active':''}" data-cmap="${cm.name}" onclick="selectColormap('${cm.name}')">
      <div class="colormap-preview" style="background:${cm.grad}"></div>
      ${cm.name}
    </button>`).join('');
}

function selectColormap(name) {
  S.colormap = name;
  document.querySelectorAll('.colormap-btn').forEach(b => b.classList.toggle('active', b.dataset.cmap===name));
}

// ─── AXIS SELECTIONS ──────────────────────────────────────────────────────────
function getAxisSelections() {
  const xEl=document.getElementById('axisX');
  const yEl=document.getElementById('axisY');
  const zEl=document.getElementById('axisZ');
  const wEl=document.getElementById('axisW');
  return {
    x: xEl ? +xEl.value : 0,
    y: yEl ? (yEl.multiple ? Array.from(yEl.selectedOptions).map(o=>+o.value) : [+yEl.value]) : [1],
    z: zEl ? +zEl.value : null,
    w: wEl ? +wEl.value : null,
  };
}

function getColumnValues(col, rows, numeric=true) {
  return rows.map(r => {
    const v = r[col];
    if (numeric) { const n=parseFloat(String(v).replace(/,/g,'')); return isNaN(n)?null:n; }
    return v;
  });
}

// ─── RENDER ───────────────────────────────────────────────────────────────────
document.getElementById('renderBtn').onclick = renderChart;

function renderChart() {
  const rows = getDataRows();
  if (!rows.length) { showError('No data rows found.'); return; }

  const ax    = getAxisSelections();
  const title = document.getElementById('chartTitle').value || (S.dim + 'D Chart');
  const mSize = +document.getElementById('markerSize').value   || 6;
  const mOpa  = +document.getElementById('markerOpacity').value || 0.85;

  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('plotDiv').style.display    = 'block';
  document.getElementById('savePng').style.display    = 'inline-flex';
  document.getElementById('copyPng').style.display    = 'inline-flex';

  const isLight  = document.body.classList.contains('light');
  const paperBg  = 'rgba(0,0,0,0)';
  const plotBg   = isLight ? 'rgba(255,255,255,0.5)' : 'rgba(22,32,51,0.5)';
  const fontColor= isLight ? '#2D3436' : '#EAF1FF';
  const gridColor= isLight ? '#E0E6F0' : '#2C3A52';

  let traces=[], layout={};

  /* ── 2D ── */
  if (S.dim === 2) {
    const xVals = getColumnValues(ax.x, rows, false);
    const xName = S.headers[ax.x];
    const yCols = ax.y.length ? ax.y : [1];

    buildSeriesColourPickers(); // ensure pickers are in sync

    traces = yCols.map((ci, idx) => {
      const color = S.seriesColors[ci] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
      return {
        x: xVals,
        y: getColumnValues(ci, rows),
        type:'scatter', mode:'lines+markers',
        name: S.headers[ci],
        line:{color, width:2.5},
        marker:{color, size:5},
        hovertemplate:`<b>${S.headers[ci]}</b><br>${xName}: %{x}<br>Value: %{y}<extra></extra>`,
      };
    });
    layout = {
      title:{text:title,font:{color:fontColor,size:16,family:"'DM Sans',sans-serif"},x:.5,xanchor:'center'},
      xaxis:{title:xName,color:fontColor,gridcolor:gridColor,linecolor:gridColor,tickfont:{color:fontColor}},
      yaxis:{title:yCols.length===1?S.headers[yCols[0]]:'Value',color:fontColor,gridcolor:gridColor,linecolor:gridColor,tickfont:{color:fontColor}},
      paper_bgcolor:paperBg, plot_bgcolor:plotBg,
      font:{family:"'DM Sans',sans-serif",color:fontColor},
      legend:{bgcolor:'rgba(0,0,0,0)',bordercolor:gridColor,borderwidth:1,font:{color:fontColor}},
      margin:{l:60,r:30,t:55,b:55},
      hovermode:'closest',
    };
    setInfoRow(`${rows.length} rows`, `${yCols.length} series`, `X: ${xName}`);

  /* ── 3D ── */
  } else if (S.dim === 3) {
    const xV=getColumnValues(ax.x,rows), yV=getColumnValues(ax.y,rows), zV=getColumnValues(ax.z,rows);
    traces = [{
      x:xV, y:yV, z:zV,
      type:'scatter3d', mode:'markers',
      marker:{
        size:mSize, color:zV, colorscale:'Viridis', opacity:mOpa,
        colorbar:{title:{text:S.headers[ax.z],font:{color:fontColor}},tickfont:{color:fontColor}},
      },
      hovertemplate:`${S.headers[ax.x]}: %{x}<br>${S.headers[ax.y]}: %{y}<br>${S.headers[ax.z]}: %{z}<extra></extra>`,
    }];
    layout = {
      title:{text:title,font:{color:fontColor,size:16,family:"'DM Sans',sans-serif"},x:.5,xanchor:'center'},
      scene:{
        xaxis:{title:S.headers[ax.x],color:fontColor,gridcolor:gridColor,backgroundcolor:plotBg},
        yaxis:{title:S.headers[ax.y],color:fontColor,gridcolor:gridColor,backgroundcolor:plotBg},
        zaxis:{title:S.headers[ax.z],color:fontColor,gridcolor:gridColor,backgroundcolor:plotBg},
        bgcolor:plotBg,
      },
      paper_bgcolor:paperBg,
      font:{family:"'DM Sans',sans-serif",color:fontColor},
      margin:{l:0,r:0,t:55,b:0},
    };
    setInfoRow(`${rows.length} pts`, `${S.headers[ax.x]} × ${S.headers[ax.y]} × ${S.headers[ax.z]}`);

  /* ── 4D ── */
  } else {
    const xV=getColumnValues(ax.x,rows), yV=getColumnValues(ax.y,rows),
          zV=getColumnValues(ax.z,rows), wV=getColumnValues(ax.w,rows);
    traces = [{
      x:xV, y:yV, z:zV,
      type:'scatter3d', mode:'markers',
      marker:{
        size:mSize, color:wV, colorscale:S.colormap, opacity:mOpa, showscale:true,
        colorbar:{title:{text:S.headers[ax.w]+' (W)',font:{color:fontColor}},tickfont:{color:fontColor}},
      },
      hovertemplate:`${S.headers[ax.x]}: %{x}<br>${S.headers[ax.y]}: %{y}<br>${S.headers[ax.z]}: %{z}<br><b>${S.headers[ax.w]}: %{marker.color:.4g}</b><extra></extra>`,
    }];
    layout = {
      title:{text:`${title}  <span style="font-size:11px;opacity:.6">(colour → ${S.headers[ax.w]})</span>`,font:{color:fontColor,size:16,family:"'DM Sans',sans-serif"},x:.5,xanchor:'center'},
      scene:{
        xaxis:{title:S.headers[ax.x],color:fontColor,gridcolor:gridColor,backgroundcolor:plotBg},
        yaxis:{title:S.headers[ax.y],color:fontColor,gridcolor:gridColor,backgroundcolor:plotBg},
        zaxis:{title:S.headers[ax.z],color:fontColor,gridcolor:gridColor,backgroundcolor:plotBg},
        bgcolor:plotBg,
      },
      paper_bgcolor:paperBg,
      font:{family:"'DM Sans',sans-serif",color:fontColor},
      margin:{l:0,r:0,t:55,b:0},
    };
    setInfoRow(`${rows.length} pts`, `${S.colormap} map`, `W: ${S.headers[ax.w]}`);
  }

  Plotly.react('plotDiv', traces, layout, {
    responsive:true, displayModeBar:true,
    modeBarButtonsToRemove:['sendDataToCloud','editInChartStudio'],
    toImageButtonOptions:{format:'png',filename:title.replace(/\s+/g,'_'),scale:2},
  });

  document.getElementById('chartPanelTitle').textContent = title;
  setStatus('Rendered', 'success');
}

// ─── SAVE PNG ─────────────────────────────────────────────────────────────────
async function withPngWatermark(callback) {
  const wmAnnotation = {
    xref:'paper', yref:'paper', x:1, y:0, xanchor:'right', yanchor:'bottom',
    showarrow:false, text:'Made using tool.adjiebrotots.com/graphvisualiser',
    font:{ size:10, color:'rgba(60,60,60,0.22)', family:'DM Sans, sans-serif' },
  };
  await Plotly.relayout('plotDiv', { annotations:[wmAnnotation], images:[wmPlotlyImage()] });
  try { return await callback(); }
  finally { await Plotly.relayout('plotDiv', { annotations:[], images:[] }); }
}
async function copyPlotlyPngToClipboard(plotId, options) {
  if(!navigator.clipboard || !window.ClipboardItem) throw new Error('Clipboard image copy is not supported in this browser.');
  const dataUrl = await Plotly.toImage(plotId, options);
  const blob = await (await fetch(dataUrl)).blob();
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
document.getElementById('savePng').onclick = async () => {
  const title = document.getElementById('chartTitle').value || 'graph';
  await withPngWatermark(() => Plotly.downloadImage('plotDiv', {
    format:'png', filename:title.replace(/\s+/g,'_'), scale:3, width:1440, height:760
  }));
};
document.getElementById('copyPng').onclick = async () => {
  try {
    await withPngWatermark(() => copyPlotlyPngToClipboard('plotDiv', {
      format:'png', scale:3, width:1440, height:760
    }));
    setStatus('PNG copied', 'success');
  } catch(err) { setStatus('PNG copy failed: ' + err.message, 'error'); }
};

// ─── UI HELPERS ───────────────────────────────────────────────────────────────
function setStatus(msg, type='info') {
  const map={success:'badge-success',error:'badge-error',info:'badge-info',warning:'badge-warning'};
  document.getElementById('statusBadge').innerHTML = `<span class="badge ${map[type]||'badge-info'}">${msg}</span>`;
}
function showError(msg) { setStatus(msg,'error'); }

function setInfoRow(...chips) {
  const el = document.getElementById('infoRow');
  el.style.display = 'flex';
  el.innerHTML = chips.map(c=>`<div class="info-chip"><strong>${c}</strong></div>`).join('');
}
