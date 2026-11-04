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

/* Series palettes. 'brotools' is DEFAULT_COLORS, the colours a series took before
   palettes existed, so state saved without a palette draws as it always did. */
const PALETTES = {
  brotools: DEFAULT_COLORS,
  tableau:  ['#4E79A7','#F28E2B','#E15759','#76B7B2','#59A14F','#EDC948','#B07AA1','#FF9DA7','#9C755F','#BAB0AC'],
  okabe:    ['#0072B2','#D55E00','#009E73','#E69F00','#CC79A7','#56B4E9','#000000','#F0E442'],
  vivid:    ['#2563EB','#F97316','#10B981','#E11D48','#8B5CF6','#EAB308','#0EA5E9','#64748B'],
};
const FONTS = {
  dm:    "'DM Sans',sans-serif",
  arial: 'Arial,Helvetica,sans-serif',
  segoe: "'Segoe UI',system-ui,Arial,sans-serif",
  times: "'Times New Roman',Times,serif",
};
const DASHES = ['solid','dash','dot','dashdot'];

/* ─── STYLE TEMPLATES ──────────────────────────────────────────────────────────
   The Style tab opens with a template picker, as the Sankey Creator's does. A
   template sets every style control at once (STYLE_FIELDS says which control
   each key is). The picker is derived, never saved: the controls are what
   travel in the mini cache and the link, and it shows the template they add
   up to, else Custom. A control missing from older saved state keeps its
   default, which is the first template, so older work draws as it did. */
const STYLE_FIELDS = {
  bg:'gBg', palette:'gPalette', font:'gFont', fs:'gFS', ts:'gTS', ta:'gTA',
  grid:'gGrid', gridStyle:'gGridStyle', frame:'gFrame', ticks:'gTicks',
  lw:'gLW', points:'gPoints', dash:'gDash', legend:'gLegend', legendBox:'gLegendBox',
  mSize:'markerSize', mOp:'markerOpacity',
};
const STYLE_DEFAULT = {
  bg:'auto', palette:'brotools', font:'dm', fs:12, ts:16, ta:'center',
  grid:'both', gridStyle:'solid', frame:'none', ticks:'none',
  lw:2.5, points:true, dash:'solid', legend:'right', legendBox:true,
  mSize:6, mOp:0.85,
};
const STYLE_RANGE = { fs:[8,28], ts:[10,40], lw:[0.5,8], mSize:[2,20], mOp:[0.1,1] };
const TEMPLATES = [
  {id:'brotools', name:'Adjie Brotools', desc:'The site\u2019s own look: soft pastel lines, DM Sans, a light grid, the key on the right.', s:{}},
  {id:'brotools-night', name:'Adjie Brotools, night', desc:'The site at night: a dark sheet with pastel lines, for dark slides.', s:{bg:'dark'}},
  {id:'minimal', name:'Minimal', desc:'Value lines only, no points, the key above the chart.', s:{bg:'white', palette:'tableau', font:'arial', ts:14, ta:'left', grid:'y', frame:'bottom', lw:1.8, points:false, legend:'top', legendBox:false}},
  {id:'report', name:'Report', desc:'For a printed report: Times text, a full frame, colour-blind safe lines.', s:{bg:'white', palette:'okabe', font:'times', fs:11, ts:13, gridStyle:'dash', frame:'box', ticks:'inside', lw:1.5, legend:'inside', mSize:5, mOp:0.9}},
  {id:'slides', name:'Presentation', desc:'Large text and thick lines, to read from the back of the room.', s:{bg:'white', palette:'vivid', font:'segoe', fs:16, ts:24, ta:'left', grid:'y', frame:'bottom', lw:4, points:false, legend:'top', legendBox:false, mSize:10}},
];
const templateStyle = t => Object.assign({}, STYLE_DEFAULT, t.s);

function readStyle() {
  const out = {};
  Object.keys(STYLE_FIELDS).forEach(k => {
    const el = document.getElementById(STYLE_FIELDS[k]), d = STYLE_DEFAULT[k];
    if (!el) { out[k] = d; return; }
    if (typeof d === 'boolean') out[k] = !!el.checked;
    else if (typeof d === 'number') {
      const n = parseFloat(el.value), r = STYLE_RANGE[k];
      out[k] = isFinite(n) ? Math.min(r[1], Math.max(r[0], n)) : d;
    } else out[k] = el.value || d;
  });
  return out;
}
function writeStyle(st) {
  Object.keys(STYLE_FIELDS).forEach(k => {
    const el = document.getElementById(STYLE_FIELDS[k]);
    if (!el || st[k] === undefined) return;
    if (el.type === 'checkbox') el.checked = !!st[k]; else el.value = st[k];
  });
}
function matchTemplate(st) {
  return TEMPLATES.find(t => { const ts = templateStyle(t); return Object.keys(ts).every(k => ts[k] === st[k]); }) || null;
}
function syncTemplateBox() {
  const m = matchTemplate(readStyle());
  document.getElementById('gTemplate').value = m ? m.id : 'custom';
  document.getElementById('gTemplateTip').setAttribute('data-tip', m ? m.desc : 'Your own mix of settings. Pick a template to set them all at once.');
}
// A series with no colour of its own takes its place in the chosen palette.
function seriesDefault(i) {
  const p = PALETTES[document.getElementById('gPalette').value] || PALETTES.brotools;
  return p[i % p.length];
}

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
  2:'Line graph: X axis + one or more Y series',
  3:'3D scatter: X, Y, Z axes; Z depth colour-coded',
  4:'3D scatter + W column colour-coded as heat map',
};
// The 4D view: 'heatmap' is how 4D always drew, so state saved before the
// animation existed (no g4dMode) opens as it did.
const DIM_HELP_ANIM = 'Z over X and Y, one frame per value of a time column, played on the chart and saved as a GIF';
function is4dAnim() { return S.dim === 4 && document.getElementById('g4dMode').value === 'anim'; }
function syncAnimUI() {
  const four = S.dim === 4, anim = is4dAnim();
  document.getElementById('mode4dRow').style.display = four ? '' : 'none';
  document.getElementById('animGroup').style.display = anim ? '' : 'none';
  document.getElementById('orbitRow').style.display = document.getElementById('g4dCam').value === 'orbit' ? '' : 'none';
  document.getElementById('dimHelp').textContent = anim ? DIM_HELP_ANIM : DIM_HELP[S.dim];
}

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
    syncAnimUI();
    if (S.headers.length) buildAxesUI();
    refreshStyleTab();
    markStale();
  };
});

// The heat map and the animation pick different columns, so a change of view
// lays the axes out afresh, as a change of dimension does.
document.getElementById('g4dMode').addEventListener('change', () => {
  syncAnimUI();
  if (S.headers.length) buildAxesUI();
});
document.getElementById('g4dCam').addEventListener('change', syncAnimUI);

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

// ─── SAMPLE DATASET ───────────────────────────────────────────────────────────
/* A damped spring (1 kg mass, released 1 m from rest), sampled every 0.1 s.
   The columns are ordered so every dimension's default picks tell the story:
   2D draws position and velocity against time, 3D turns the same three into a
   spiral winding down the time axis, and 4D colours that spiral by the energy
   it is losing. Built as CSV text so it goes through the same parser a file does. */
function buildSampleCSV() {
  const w0 = 1.5, g = 0.12, wd = Math.sqrt(w0*w0 - g*g);
  const lines = ['Time (s),Position (m),Velocity (m/s),Energy (J)'];
  for (let i = 0; i <= 200; i++) {
    const t = i / 10, e = Math.exp(-g*t), c = Math.cos(wd*t), s = Math.sin(wd*t);
    const x = e * c, v = e * (-g*c - wd*s);
    const E = 0.5 * (v*v + w0*w0*x*x);
    lines.push([t.toFixed(1), x.toFixed(4), v.toFixed(4), E.toFixed(4)].join(','));
  }
  return lines.join('\n');
}

document.getElementById('sampleBtn').onclick = () => {
  document.getElementById('fileName').textContent = '📄 sample-damped-spring.csv';
  document.getElementById('headerRow').value = 1;
  S.headerRow = 1;
  document.getElementById('chartTitle').value = 'Damped spring';
  parseCSV(buildSampleCSV());
  // buildAxesUI picks its defaults on the next tick; add Velocity to the 2D
  // series after that, then draw.
  setTimeout(() => {
    const y = document.getElementById('axisY');
    if (y && y.multiple && y.options[2]) y.options[2].selected = true;
    buildSeriesColourPickers();
    renderChart();
  }, 0);
};

/* A ripple over a 21 × 21 grid, 20 frames of one period, so the loop is
   seamless: the 4D animation's sample, with time first so it is picked as
   the animated column. */
function buildAnimSampleCSV() {
  const lines = ['t,X,Y,Z'], N = 20, G = 21;
  for (let k = 0; k < N; k++) {
    const t = 2 * Math.PI * k / N;
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const x = -5 + 10 * i / (G - 1), y = -5 + 10 * j / (G - 1), r = Math.hypot(x, y);
      const z = Math.cos(1.1 * r - t) * Math.exp(-r * r / 40) + 0.25 * Math.sin(0.6 * x + t) * Math.cos(0.6 * y);
      lines.push([t.toFixed(2), x.toFixed(2), y.toFixed(2), z.toFixed(3)].join(','));
    }
  }
  return lines.join('\n');
}

document.getElementById('sampleAnimBtn').onclick = () => {
  document.getElementById('fileName').textContent = '📄 sample-ripple-4d.csv';
  document.getElementById('headerRow').value = 1;
  S.headerRow = 1;
  document.getElementById('chartTitle').value = '4D data: Z(X, Y) evolving over time';
  // A clean start: every animation setting back to its default.
  document.getElementById('g4dMode').value = 'anim';
  document.getElementById('g4dShape').value = 'surface';
  document.getElementById('g4dFps').value = 8;
  document.getElementById('g4dCam').value = 'orbit';
  document.getElementById('g4dOrbit').value = 30;
  ANIM.camera = null;
  document.querySelector('.dim-btn[data-dim="4"]').click();
  parseCSV(buildAnimSampleCSV());
  setTimeout(renderChart, 0);
};

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
  markStale();
  // Auto-switch to Axes tab
  document.querySelectorAll('.ctrl-tab,.ctrl-panel').forEach(el => el.classList.remove('active'));
  document.querySelector('[data-tab="axes"]').classList.add('active');
  document.getElementById('tab-axes').classList.add('active');
}

function getDataRows() {
  if (!S.raw) return [];
  return S.raw.slice(S.headerRow).filter(r => r.some(c => c !== ''));
}

// A column's name is whatever the file says, so it is text, never markup.
function escHtml(s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── AXES UI ──────────────────────────────────────────────────────────────────
function buildAxesUI() {
  const c    = document.getElementById('axesContent');
  const opts = S.headers.map((h,i) => `<option value="${i}">${escHtml(h)}</option>`).join('');

  // One shared.css .field-row per axis, inside the Axes .field-group.
  const row = (label, id, extra = '') => `
      <div class="field-row">
        <div class="field-label">${label}</div>
        <select class="sel-input" id="${id}"${extra}>${opts}</select>
      </div>`;

  if (S.dim === 2) {
    c.innerHTML =
      row('X axis', 'axisX') +
      row('Y axis <span class="label-note">(Ctrl/Cmd = multi-select)</span> <span class="tip-icon" data-tip="Each column you select is drawn as its own line, all sharing the X axis above. Hold Ctrl or Cmd to select more than one.">?</span>',
          'axisY', ' multiple size="7" style="height:auto;font-size:.83rem"');
    setTimeout(() => {
      const sel = document.getElementById('axisY');
      if (sel && sel.options[1]) sel.options[1].selected = true;
      sel.addEventListener('change', buildSeriesColourPickers);
    }, 0);

  } else if (S.dim === 3) {
    c.innerHTML = row('X axis', 'axisX') + row('Y axis', 'axisY') + row('Z axis', 'axisZ');
    setTimeout(() => {
      const y=document.getElementById('axisY'), z=document.getElementById('axisZ');
      if(y&&y.options[1]) y.options[1].selected=true;
      if(z&&z.options[2]) z.options[2].selected=true;
    }, 0);

  } else if (is4dAnim()) {
    c.innerHTML =
      row('X axis', 'axisX') + row('Y axis', 'axisY') +
      row('Z axis <span class="label-note">(height, colour)</span>', 'axisZ') +
      row('Time <span class="label-note">(animated)</span> <span class="tip-icon" data-tip="Each value of this column is one frame, in order. Its rows are drawn as Z over X and Y; the slider on the chart steps through them.">?</span>', 'axisT');
    setTimeout(() => {
      // Time is the column named like it, else the fourth; X, Y and Z are the
      // first three of the others.
      const n = S.headers.length;
      let t = S.headers.findIndex(h => /^(t|time|date|year|month|day|frame|step|period)\b/i.test(String(h).trim()));
      if (t < 0) t = Math.min(3, n - 1);
      const rest = [...Array(n).keys()].filter(i => i !== t);
      [['axisX', rest[0]], ['axisY', rest[1]], ['axisZ', rest[2]], ['axisT', t]].forEach(([id, i]) => {
        const el = document.getElementById(id);
        if (el && i != null && el.options[i]) el.value = String(i);
      });
    }, 0);

  } else {
    c.innerHTML =
      row('X axis', 'axisX') + row('Y axis', 'axisY') +
      row('Z axis <span class="label-note">(height)</span>', 'axisZ') +
      row('W axis <span class="label-note">(colour map)</span>', 'axisW');
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
    list.innerHTML = '<div class="empty-note">Select Y columns in Axes tab first.</div>';
    return;
  }

  // Assign defaults for new columns
  yCols.forEach(ci => {
    if (!S.seriesColors[ci]) S.seriesColors[ci] = seriesDefault(ci);
  });

  list.innerHTML = yCols.map(ci => `
    <div class="color-series-row">
      <span class="color-series-name" title="${escHtml(S.headers[ci])}">${escHtml(S.headers[ci])}</span>
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
  markStale();
}

// ─── AXIS SELECTIONS ──────────────────────────────────────────────────────────
function getAxisSelections() {
  const xEl=document.getElementById('axisX');
  const yEl=document.getElementById('axisY');
  const zEl=document.getElementById('axisZ');
  const wEl=document.getElementById('axisW');
  const tEl=document.getElementById('axisT');
  const out = {
    x: xEl ? +xEl.value : 0,
    y: yEl ? (yEl.multiple ? Array.from(yEl.selectedOptions).map(o=>+o.value) : [+yEl.value]) : [1],
    z: zEl ? +zEl.value : null,
    w: wEl ? +wEl.value : null,
  };
  if (tEl) out.t = +tEl.value;
  return out;
}

function getColumnValues(col, rows, numeric=true) {
  return rows.map(r => {
    const v = r[col];
    if (numeric) { const n=parseFloat(String(v).replace(/,/g,'')); return isNaN(n)?null:n; }
    return v;
  });
}

// ─── THE VISUALISE GATE ───────────────────────────────────────────────────────
/* The chart is drawn on Visualise, so any change in the sidebar after a draw
   leaves a chart that no longer matches the settings. Say so: the button gets
   a ring and a note, and a chart already on screen steps back until redrawn. */
let drawn = false;
function setVisNote(text, stale) {
  const n = document.getElementById('visNote');
  n.textContent = text;
  n.classList.toggle('is-stale', !!stale);
}
function markStale() {
  if (!S.raw) return;
  document.getElementById('renderBtn').classList.add('needs-run');
  document.body.classList.toggle('is-stale', drawn);
  if (drawn) setStatus('Out of date', 'warning');
  setVisNote(drawn ? 'Settings changed. Press Visualise to redraw' : 'Data loaded. Press Visualise to draw it', true);
}
function clearStale() {
  drawn = true;
  document.getElementById('renderBtn').classList.remove('needs-run');
  document.body.classList.remove('is-stale');
  setVisNote('Chart is up to date', false);
}
// Every setting lives in the sidebar, so one listener covers them all. The
// header row and file input re-parse, which marks stale through onDataLoaded.
['input', 'change'].forEach(ev => document.querySelector('.layout > .controls').addEventListener(ev, e => {
  if (e.target.closest('#renderBtn')) return;
  markStale();
}));

// ─── STYLE TAB WIRING ─────────────────────────────────────────────────────────
// A template sets every style control; any other control re-reads which template
// the controls now add up to. A new palette starts the series colours over.
document.getElementById('gTemplate').addEventListener('change', () => {
  const t = TEMPLATES.find(x => x.id === document.getElementById('gTemplate').value);
  if (!t) { syncTemplateBox(); return; }
  const was = document.getElementById('gPalette').value;
  writeStyle(templateStyle(t));
  if (document.getElementById('gPalette').value !== was) { S.seriesColors = {}; buildSeriesColourPickers(); }
  syncTemplateBox();
});
document.getElementById('gPalette').addEventListener('change', () => { S.seriesColors = {}; buildSeriesColourPickers(); });
document.getElementById('tab-style').addEventListener('change', e => { if (e.target.id !== 'gTemplate') syncTemplateBox(); });
document.getElementById('tab-style').addEventListener('input', e => { if (e.target.id !== 'gTemplate') syncTemplateBox(); });

// ─── RENDER ───────────────────────────────────────────────────────────────────
document.getElementById('renderBtn').onclick = renderChart;

function renderChart() {
  const rows = getDataRows();
  if (!rows.length) { showError('No data rows found.'); return; }

  const ax    = getAxisSelections();
  const title = document.getElementById('chartTitle').value || (S.dim + 'D Chart');
  stopAnim();
  const anim = is4dAnim();
  const mSize = +document.getElementById('markerSize').value   || 6;
  const mOpa  = +document.getElementById('markerOpacity').value || 0.85;

  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('plotDiv').style.display    = 'block';
  ['saveSvg','savePng','copyPng','resetView'].forEach(id => {
    document.getElementById(id).style.display = 'inline-flex';
  });
  document.getElementById('saveGif').style.display = anim ? 'inline-flex' : 'none';
  // A 2D plot has a zoom to reset; a 3D one has a camera to put back.
  document.getElementById('resetView').title = S.dim === 2 ? 'Reset zoom' : 'Reset view';

  const st       = readStyle();
  // Page follows the light or dark page; White and Dark are a sheet of their own.
  const isLight  = st.bg === 'auto' ? document.body.classList.contains('light') : st.bg === 'white';
  const sheet    = st.bg === 'dark' ? '#0F1728' : '#FFFFFF';
  const paperBg  = st.bg === 'auto' ? 'rgba(0,0,0,0)' : sheet;
  const plotBg   = st.bg === 'auto' ? (isLight ? 'rgba(255,255,255,0.5)' : 'rgba(22,32,51,0.5)') : sheet;
  const fontColor= isLight ? '#14203A' : '#EAF1FF';
  const gridColor= isLight ? '#DCE3F0' : '#2C3A52';
  const fam      = FONTS[st.font] || FONTS.dm;
  const titleFont= {color:fontColor, size:st.ts, family:fam};
  const titlePos = st.ta === 'left' ? {xref:'paper', x:0, xanchor:'left'} : {x:.5, xanchor:'center'};
  const baseFont = {family:fam, color:fontColor, size:st.fs};
  const showGrid = st.grid !== 'none';
  // Soft (the default) leaves Plotly's own light axis line, drawn in the grid colour.
  const showline = st.frame !== 'none';
  // One 2D axis: the frame, ticks and grid the Style tab chose.
  const axis2d = (title, gridOn) => ({
    title, color:fontColor, gridcolor:gridColor, griddash:st.gridStyle, showgrid:gridOn, zeroline:showGrid,
    linecolor: showline ? fontColor : gridColor, showline: showline ? true : undefined, mirror: st.frame === 'box',
    ticks: st.ticks === 'none' ? '' : st.ticks, tickcolor:fontColor, tickfont:{color:fontColor, size:st.fs},
  });

  let traces=[], layout={};

  /* ── 2D ── */
  if (S.dim === 2) {
    const xVals = getColumnValues(ax.x, rows, false);
    const xName = S.headers[ax.x];
    const yCols = ax.y.length ? ax.y : [1];

    buildSeriesColourPickers(); // ensure pickers are in sync

    traces = yCols.map((ci, idx) => {
      const color = S.seriesColors[ci] || seriesDefault(idx);
      return {
        x: xVals,
        y: getColumnValues(ci, rows),
        type:'scatter', mode: st.points ? 'lines+markers' : 'lines',
        name: S.headers[ci],
        line:{color, width:st.lw, dash: st.dash === 'vary' ? DASHES[idx % DASHES.length] : 'solid'},
        marker:{color, size:5},
        hovertemplate:`<b>${S.headers[ci]}</b><br>${xName}: %{x}<br>Value: %{y}<extra></extra>`,
      };
    });
    const lg = st.legend;
    const legend = Object.assign({bgcolor:'rgba(0,0,0,0)', bordercolor:gridColor, borderwidth: st.legendBox ? 1 : 0, font:{color:fontColor, size:st.fs}},
      lg === 'top'    ? {orientation:'h', x:0, xanchor:'left', y:1.02, yanchor:'bottom'} :
      lg === 'bottom' ? {orientation:'h', x:0, xanchor:'left', y:-0.16, yanchor:'top'} :
      lg === 'inside' ? {x:.99, xanchor:'right', y:.99, yanchor:'top', bgcolor: isLight ? 'rgba(255,255,255,0.8)' : 'rgba(15,23,40,0.75)'} : {});
    layout = {
      title:Object.assign({text:title, font:titleFont}, titlePos),
      xaxis:axis2d(xName, st.grid === 'both'),
      yaxis:axis2d(yCols.length===1?S.headers[yCols[0]]:'Value', showGrid),
      paper_bgcolor:paperBg, plot_bgcolor:plotBg,
      font:baseFont,
      legend,
      margin:{l:60,r:30,t: lg === 'top' ? 95 : 55,b: lg === 'bottom' ? 100 : 55},
      hovermode:'closest',
    };
    if (lg === 'none') layout.showlegend = false;
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
      title:Object.assign({text:title, font:titleFont}, titlePos),
      scene:{
        xaxis:{title:S.headers[ax.x],color:fontColor,gridcolor:gridColor,backgroundcolor:plotBg,showgrid:showGrid},
        yaxis:{title:S.headers[ax.y],color:fontColor,gridcolor:gridColor,backgroundcolor:plotBg,showgrid:showGrid},
        zaxis:{title:S.headers[ax.z],color:fontColor,gridcolor:gridColor,backgroundcolor:plotBg,showgrid:showGrid},
        bgcolor:plotBg,
      },
      paper_bgcolor:paperBg,
      font:baseFont,
      margin:{l:0,r:0,t:55,b:0},
    };
    setInfoRow(`${rows.length} pts`, `${S.headers[ax.x]} × ${S.headers[ax.y]} × ${S.headers[ax.z]}`);

  /* ── 4D animation ── */
  } else if (anim) {
    const fig = buildAnimFigure(rows, ax, {title, titleFont, titlePos, fontColor, gridColor, plotBg, paperBg, baseFont, showGrid, st, mSize, mOpa,
      solidBg: st.bg === 'auto' ? (isLight ? '#FFFFFF' : '#0F1728') : sheet});
    if (!fig) { ANIM.active = false; document.getElementById('saveGif').style.display = 'none'; return; }
    traces = fig.traces; layout = fig.layout;
    setInfoRow(`${ANIM.steps.length} frames`, `Time: ${S.headers[ax.t]}`, ANIM.kind === 'surface' ? 'Surface' : ANIM.kind === 'trail' ? 'Moving point' : 'Points',
      ANIM.opts.orbit ? `Orbit ${ANIM.opts.spd}°/s` : 'Static view');

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
      title:Object.assign({text:`${title}  <span style="font-size:11px;opacity:.6">(colour → ${S.headers[ax.w]})</span>`, font:titleFont}, titlePos),
      scene:{
        xaxis:{title:S.headers[ax.x],color:fontColor,gridcolor:gridColor,backgroundcolor:plotBg,showgrid:showGrid},
        yaxis:{title:S.headers[ax.y],color:fontColor,gridcolor:gridColor,backgroundcolor:plotBg,showgrid:showGrid},
        zaxis:{title:S.headers[ax.z],color:fontColor,gridcolor:gridColor,backgroundcolor:plotBg,showgrid:showGrid},
        bgcolor:plotBg,
      },
      paper_bgcolor:paperBg,
      font:baseFont,
      margin:{l:0,r:0,t:55,b:0},
    };
    setInfoRow(`${rows.length} pts`, `${S.colormap} map`, `W: ${S.headers[ax.w]}`);
  }

  Plotly.react('plotDiv', traces, layout, {
    responsive:true, displayModeBar:true,
    modeBarButtonsToRemove:['sendDataToCloud','editInChartStudio'],
    toImageButtonOptions:{format:'png',filename:title.replace(/\s+/g,'_'),scale:2},
  }).then(() => {
    bindAxisGuard(traces);
    bindAnimEvents();
    // Twice: the first move can shift Plotly's margins under the second.
    if (anim) fitPlayBar().then(fitPlayBar).then(startAnim); else ANIM.active = false;
  });

  document.getElementById('chartPanelTitle').textContent = title;
  setStatus('Rendered', 'success');
  clearStale();
}

/* ─── 4D ANIMATION ────────────────────────────────────────────────────────────
   One column is time. Each of its values is a frame: that value's rows drawn
   as Z over X and Y (a surface when they make a grid, else points), or, when
   the column has one row per value (a path through time), the whole path
   drawn faintly with a point moving along it. The frames are slider steps on
   the chart itself, each a restyle carrying that frame's data, so the slider
   works with no code behind it, an embedded chart included. ▶ Play and the
   orbiting camera are driven from here. Axis and colour ranges are the whole
   run's, so a frame never rescales. */
const ANIM = {
  active:false, steps:[], labels:[], traceIdx:[0], kind:'', opts:null, fig:null, tName:'',
  idx:0, playing:false, raf:0, busy:false, prev:0, clock:0, camClock:0,
  camera:null,  // the reader's view: dragged on the chart, kept across redraws and in the link
};
function defaultCamera() { return {eye:{x:1.25, y:1.25, z:1.25}, up:{x:0, y:0, z:1}, center:{x:0, y:0, z:0}}; }
function validCamera(c) {
  const ok = v => v && typeof v === 'object' && ['x','y','z'].every(k => isFinite(+v[k]));
  if (!c || typeof c !== 'object' || !ok(c.eye)) return null;
  const pick = v => ({x:+v.x, y:+v.y, z:+v.z});
  return {eye:pick(c.eye), up: ok(c.up) ? pick(c.up) : {x:0, y:0, z:1}, center: ok(c.center) ? pick(c.center) : {x:0, y:0, z:0}};
}
function animOpts() {
  const num = (id, d, lo, hi) => { const n = +document.getElementById(id).value; return isFinite(n) && document.getElementById(id).value !== '' ? Math.min(hi, Math.max(lo, n)) : d; };
  return {
    shape: document.getElementById('g4dShape').value === 'points' ? 'points' : 'surface',
    fps:   num('g4dFps', 8, 1, 30),
    orbit: document.getElementById('g4dCam').value === 'orbit',
    spd:   num('g4dOrbit', 30, -180, 180),
  };
}
function fmtTime(v) {
  if (typeof v !== 'number') return String(v);
  const a = Math.abs(v);
  return (a !== 0 && (a >= 1e6 || a < 1e-3)) ? v.toExponential(2) : String(+v.toFixed(a >= 100 ? 1 : a >= 1 ? 2 : 3));
}
// A frame's rows as a grid: every (x, y) once, at least half the cells filled.
function gridOf(xs, ys, zs) {
  const ux = [...new Set(xs)].sort((a,b) => a-b), uy = [...new Set(ys)].sort((a,b) => a-b);
  if (ux.length < 2 || uy.length < 2 || ux.length * uy.length > 2 * xs.length || ux.length * uy.length > 250000) return null;
  const ix = new Map(ux.map((v,i) => [v,i])), iy = new Map(uy.map((v,i) => [v,i]));
  const z = uy.map(() => new Array(ux.length).fill(null));
  for (let k = 0; k < xs.length; k++) {
    const r = z[iy.get(ys[k])], c = ix.get(xs[k]);
    if (r[c] !== null) return null;
    r[c] = zs[k];
  }
  return {x:ux, y:uy, z};
}

function buildAnimFigure(rows, ax, c) {
  const o = animOpts();
  const xV = getColumnValues(ax.x, rows), yV = getColumnValues(ax.y, rows), zV = getColumnValues(ax.z, rows);
  const tRaw = getColumnValues(ax.t, rows, false).map(v => String(v == null ? '' : v).trim());
  const tNum = tRaw.map(v => { const n = parseFloat(v.replace(/,/g,'')); return v !== '' && isFinite(n) && /^[-+]?[\d.,]+(e[-+]?\d+)?$/i.test(v) ? n : null; });
  const numeric = tRaw.every((v, i) => v === '' || tNum[i] !== null);
  // Rows grouped by time, in time order (a text column keeps the file's order).
  const groups = new Map();
  rows.forEach((r, i) => {
    if (xV[i] === null || yV[i] === null || zV[i] === null || tRaw[i] === '') return;
    const key = numeric ? tNum[i] : tRaw[i];
    if (!groups.has(key)) groups.set(key, {x:[], y:[], z:[]});
    const g = groups.get(key); g.x.push(xV[i]); g.y.push(yV[i]); g.z.push(zV[i]);
  });
  let keys = [...groups.keys()];
  if (numeric) keys.sort((a,b) => a-b);
  if (!keys.length) { showError('No numeric X, Y, Z rows to animate.'); return null; }

  const all = {x:[], y:[], z:[]};
  keys.forEach(k => { const g = groups.get(k); all.x.push(...g.x); all.y.push(...g.y); all.z.push(...g.z); });
  const ext = arr => { let lo = Infinity, hi = -Infinity; arr.forEach(v => { if (v < lo) lo = v; if (v > hi) hi = v; });
    const p = (hi - lo) * 0.03 || Math.abs(hi) * 0.05 || 1; return [lo - p, hi + p]; };
  const zr = ext(all.z), cmin = Math.min(...all.z), cmax = Math.max(...all.z);

  const single = keys.length > 1 && keys.every(k => groups.get(k).x.length === 1);
  let grids = null;
  if (!single && o.shape === 'surface') {
    grids = keys.map(k => { const g = groups.get(k); return gridOf(g.x, g.y, g.z); });
    if (grids.some(g => !g)) grids = null;
  }
  const kind = single ? 'trail' : grids ? 'surface' : 'points';
  const xN = S.headers[ax.x], yN = S.headers[ax.y], zN = S.headers[ax.z], tN = S.headers[ax.t];
  const colorbar = {title:{text:zN, font:{color:c.fontColor}}, tickfont:{color:c.fontColor}, len:0.75};
  const hover = `${xN}: %{x}<br>${yN}: %{y}<br>${zN}: %{z}<extra></extra>`;

  let traces, steps, traceIdx = [0];
  if (kind === 'surface') {
    traces = [{type:'surface', x:grids[0].x, y:grids[0].y, z:grids[0].z, colorscale:S.colormap, cmin, cmax,
      colorbar, hovertemplate:hover, contours:{z:{show:false}}}];
    steps = grids.map(g => ({x:[g.x], y:[g.y], z:[g.z]}));
  } else if (kind === 'points') {
    const g0 = groups.get(keys[0]);
    traces = [{type:'scatter3d', mode:'markers', x:g0.x, y:g0.y, z:g0.z, hovertemplate:hover,
      marker:{size:c.mSize, opacity:c.mOpa, color:g0.z, colorscale:S.colormap, cmin, cmax, showscale:true, colorbar}}];
    steps = keys.map(k => { const g = groups.get(k); return {x:[g.x], y:[g.y], z:[g.z], 'marker.color':[g.z]}; });
  } else {
    const p = k => groups.get(k);
    traces = [
      {type:'scatter3d', mode:'lines', x:all.x, y:all.y, z:all.z, opacity:0.6, hoverinfo:'skip', showlegend:false,
        line:{width:5, color:all.z, colorscale:S.colormap, cmin, cmax}},
      {type:'scatter3d', mode:'markers', x:p(keys[0]).x, y:p(keys[0]).y, z:p(keys[0]).z, showlegend:false, hovertemplate:hover,
        marker:{size:Math.max(8, c.mSize * 1.8), opacity:1, color:p(keys[0]).z, colorscale:S.colormap, cmin, cmax, showscale:true, colorbar,
          line:{color:c.fontColor, width:1}}},
    ];
    traceIdx = [1];
    steps = keys.map(k => ({x:[p(k).x], y:[p(k).y], z:[p(k).z], 'marker.color':[p(k).z]}));
  }
  const labels = keys.map(fmtTime);
  const many = steps.length > 12;
  const sceneAxis = (title, range) => ({title, range, autorange:false, color:c.fontColor, gridcolor:c.gridColor, backgroundcolor:c.plotBg, showgrid:c.showGrid});
  // A first guess at the play bar; fitPlayBar sets it to the pixel once drawn.
  const sliderX = 0.1, sliderLen = 0.88, INSET = PLAYBAR.inset;
  const layout = {
    title:Object.assign({text:c.title, font:c.titleFont, y:0.97, yanchor:'top'}, c.titlePos),
    scene:{
      xaxis:sceneAxis(xN, ext(all.x)), yaxis:sceneAxis(yN, ext(all.y)), zaxis:sceneAxis(zN, zr),
      // A slightly flattened box fills a wide canvas better than a cube.
      bgcolor:c.plotBg, aspectmode:'manual', aspectratio:{x:1, y:1, z:0.75}, camera: ANIM.camera || defaultCamera(),
      domain:{x:[0, 1], y:[0, 1]},
    },
    paper_bgcolor:c.paperBg, font:c.baseFont,
    margin:{l:INSET, r:INSET, t:56, b:94},
    // The slider and ▶ sit on the chart, under the scene.
    sliders:[{
      active:0, x:sliderX, len:sliderLen, xanchor:'left', y:0, yanchor:'top', pad:{t:8, b:0, l:0, r:0},
      currentvalue:{prefix:tN + ' = ', xanchor:'left', offset:8, font:{color:c.fontColor, size:c.st.fs + 1}},
      // With many frames the tick labels would pile up: the current value says which.
      font:{color: many ? 'rgba(0,0,0,0)' : c.fontColor, size:Math.max(8, c.st.fs - 2)},
      bgcolor:c.gridColor, bordercolor:c.gridColor, activebgcolor:c.fontColor, tickcolor:c.gridColor, ticklen: many ? 3 : 6,
      steps: labels.map((l, i) => ({label:l, method:'restyle', args:[steps[i], traceIdx]})),
    }],
    updatemenus:[{
      type:'buttons', showactive:false, x:0, xanchor:'left', y:0, yanchor:'top', pad:{t:0, r:0, l:0, b:0},
      font:{color:c.fontColor, size:c.st.fs}, bgcolor:c.plotBg, bordercolor:c.gridColor,
      buttons:[{label: steps.length > 1 || o.orbit ? PLAYBAR.pause : PLAYBAR.play, method:'skip', args:[null]}],
    }],
  };
  Object.assign(ANIM, {active:true, steps, labels, traceIdx, kind, opts:o, tName:tN, idx:0, solidBg:c.solidBg, title:c.title,
    fig:{traces, layout}});
  return {traces, layout};
}

/* The play bar, set in pixels once the chart is drawn (Plotly places it in
   fractions of a plot area the colour bar has narrowed): ▶ inset from the
   left edge as far as the slider's rail ends from the right, one gap between
   them, the button centred on the rail. Kept on a resize. ▶ Play and
   ❚❚ Pause are given one width (non-breaking spaces, which SVG keeps), so
   the rail does not move when they swap. */
const PLAYBAR = {inset:18, gap:14, railPad:8, play:'▶\u00a0\u00a0\u00a0 Play\u00a0\u00a0\u00a0', pause:'❚❚ Pause'};
function fitPlayBar() {
  const div = document.getElementById('plotDiv'), fl = div._fullLayout;
  if (!ANIM.active || !fl || !fl._size || !(fl.sliders || []).length || !(fl.updatemenus || []).length) return Promise.resolve();
  const btn = div.querySelector('.updatemenu-button'), rail = div.querySelector('.slider-rail-rect');
  if (!btn || !rail) return Promise.resolve();
  const box = div.getBoundingClientRect(), b = btn.getBoundingClientRect(), r = rail.getBoundingClientRect(), sz = fl._size;
  const P = PLAYBAR;
  const start = P.inset + b.width + P.gap - P.railPad, end = box.width - P.inset + P.railPad;
  const dy = (r.top + r.height / 2) - (b.top + b.height / 2);
  const upd = {};
  const set = (k, v, now) => { if (Math.abs(v - now) > 1e-4) upd[k] = v; };
  set('updatemenus[0].x', (P.inset - sz.l) / sz.w, fl.updatemenus[0].x);
  set('sliders[0].x', (start - sz.l) / sz.w, fl.sliders[0].x);
  set('sliders[0].len', (end - start) / sz.w, fl.sliders[0].len);
  if (Math.abs(dy) > 0.5) upd['updatemenus[0].pad.t'] = Math.max(0, (fl.updatemenus[0].pad.t || 0) + dy);
  return Object.keys(upd).length ? Plotly.relayout(div, upd) : Promise.resolve();
}
let playBarTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(playBarTimer);
  playBarTimer = setTimeout(() => { if (ANIM.active) fitPlayBar().then(fitPlayBar); }, 200);
});

function stopAnim() {
  ANIM.playing = false;
  if (ANIM.raf) cancelAnimationFrame(ANIM.raf);
  ANIM.raf = 0;
}
function playLabel(on) {
  return Plotly.relayout('plotDiv', {'updatemenus[0].buttons[0].label': on ? PLAYBAR.pause : PLAYBAR.play});
}
function startAnim() {
  stopAnim();
  // One frame and no orbit: nothing moves, so there is nothing to play.
  if (!ANIM.active || (ANIM.steps.length < 2 && !ANIM.opts.orbit)) { playLabel(false); return; }
  ANIM.playing = true;
  ANIM.prev = performance.now(); ANIM.clock = 0; ANIM.camClock = 0;
  playLabel(true);
  ANIM.raf = requestAnimationFrame(animTick);
}
function orbitCamera(cam, deg) {
  const c = validCamera(cam) || defaultCamera(), e = c.eye;
  const r = Math.hypot(e.x, e.y) || 1.77, a = Math.atan2(e.y, e.x) + deg * Math.PI / 180;
  c.eye = {x:r * Math.cos(a), y:r * Math.sin(a), z:e.z};
  return c;
}
function animTick(now) {
  if (!ANIM.playing) return;
  ANIM.raf = requestAnimationFrame(animTick);
  const dt = Math.min(250, now - ANIM.prev);
  ANIM.prev = now;
  ANIM.clock += dt; ANIM.camClock += dt;
  if (ANIM.busy) return;
  const o = ANIM.opts, period = 1000 / o.fps, n = ANIM.steps.length;
  const due = n > 1 && ANIM.clock >= period;
  // The camera turns smoothly, about 30 times a second, whatever the frame rate.
  const turn = o.orbit && o.spd && ANIM.camClock >= 33;
  if (!due && !turn) return;
  const data = {}, lay = {};
  if (due) {
    ANIM.clock = ANIM.clock % period;
    ANIM.idx = (ANIM.idx + 1) % n;
    Object.assign(data, ANIM.steps[ANIM.idx]);
    lay['sliders[0].active'] = ANIM.idx;
  }
  if (turn) {
    ANIM.camera = orbitCamera(ANIM.camera, o.spd * ANIM.camClock / 1000);
    ANIM.camClock = 0;
    lay['scene.camera'] = ANIM.camera;
  }
  ANIM.busy = true;
  const div = document.getElementById('plotDiv');
  (due ? Plotly.update(div, data, lay, ANIM.traceIdx) : Plotly.relayout(div, lay))
    .catch(() => {}).then(() => { ANIM.busy = false; });
}
let animEventsBound = false;
function bindAnimEvents() {
  if (animEventsBound) return;
  animEventsBound = true;
  const div = document.getElementById('plotDiv');
  // The slider applies its own frame; this only keeps the count in step.
  div.on('plotly_sliderchange', ev => {
    if (!ANIM.active || !ev || !ev.step) return;
    const i = ev.step._index != null ? ev.step._index : ev.slider.steps.indexOf(ev.step);
    if (i >= 0) { ANIM.idx = i; ANIM.clock = 0; }
  });
  div.on('plotly_buttonclicked', () => {
    if (!ANIM.active) return;
    if (ANIM.playing) { stopAnim(); playLabel(false); } else startAnim();
  });
  // The view the reader drags to is the one kept: Static holds it, Orbit turns from it.
  div.on('plotly_relayout', ev => {
    if (ANIM.active && ev && ev['scene.camera']) ANIM.camera = validCamera(ev['scene.camera']) || ANIM.camera;
  });
}

/* ⬇ GIF: the animation redrawn off screen, one picture a frame, encoded with
   gifenc (as the Load Flow Simulator's diagram is). One pass of the time
   frames; with Orbit, passes repeat until the view has gone once round, so
   the GIF loops without a jump where it can (capped at 240 frames). */
async function makeAnimGif(onProgress) {
  if (!ANIM.active || !ANIM.fig) throw new Error('draw the animation first');
  const W = 720, H = 600, MAX = 240, o = ANIM.opts, n = ANIM.steps.length;
  let order = [...Array(n).keys()];
  if (n > MAX) order = [...Array(MAX).keys()].map(i => Math.round(i * (n - 1) / (MAX - 1)));
  const deg = o.orbit ? o.spd / o.fps : 0;
  let total = order.length;
  if (deg) {
    const rev = Math.round(360 / Math.abs(deg));
    if (total < rev) total = Math.min(MAX, Math.ceil(rev / total) * total);
  }
  const loopDeg = deg && total * Math.abs(deg) >= 300 ? 360 / total * Math.sign(deg) : deg;
  const delay = Math.max(20, Math.round(1000 / o.fps));

  const layout = JSON.parse(JSON.stringify(ANIM.fig.layout));
  delete layout.sliders; delete layout.updatemenus;
  Object.assign(layout, {width:W, height:H, paper_bgcolor:ANIM.solidBg, annotations:[wmAnnotation()], images:[wmPlotlyImage()]});
  layout.margin = {l:0, r:0, t:60, b:10};
  const traces = JSON.parse(JSON.stringify(ANIM.fig.traces));
  const box = document.createElement('div');
  box.style.cssText = `position:fixed;left:-${W + 2000}px;top:0;width:${W}px;height:${H}px`;
  document.body.appendChild(box);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d', {willReadFrequently:true});
  const frames = [];
  try {
    await Plotly.newPlot(box, traces, layout, {displayModeBar:false});
    let cam = validCamera(ANIM.camera) || defaultCamera();
    for (let k = 0; k < total; k++) {
      const ti = order[k % order.length];
      const lay = {'scene.camera': cam, 'title.text': `${ANIM.title}   ${ANIM.tName} = ${ANIM.labels[ti]}`};
      await Plotly.update(box, ANIM.steps[ti], lay, ANIM.traceIdx);
      const url = await Plotly.toImage(box, {format:'png', width:W, height:H});
      const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('a frame could not be drawn')); im.src = url; });
      g.fillStyle = ANIM.solidBg; g.fillRect(0, 0, W, H); g.drawImage(img, 0, 0, W, H);
      frames.push(g.getImageData(0, 0, W, H).data);
      if (loopDeg) cam = orbitCamera(cam, loopDeg);
      if (onProgress) onProgress((k + 1) / total * 0.7);
    }
  } finally { Plotly.purge(box); box.remove(); }

  const G = await import('./vendor/gifenc.js');
  // One palette for the loop, from a sample of frames spread across it.
  const pick = [0, 0.33, 0.66, 0.99].map(f => frames[Math.floor(f * (frames.length - 1))]);
  const sample = new Uint8ClampedArray(pick.length * W * H);
  let q = 0;
  pick.forEach(f => { for (let p = 0; p < f.length; p += 16) { sample[q++] = f[p]; sample[q++] = f[p+1]; sample[q++] = f[p+2]; sample[q++] = 255; } });
  const pal = G.quantize(sample.subarray(0, q), 255);
  while (pal.length < 255) pal.push([0, 0, 0]);
  const palette = pal.concat([[255, 0, 255]]);  // index 255: unchanged since the frame before
  const enc = G.GIFEncoder();
  let prev = null;
  for (let i = 0; i < frames.length; i++) {
    const idx = G.applyPalette(frames[i], pal);
    if (i === 0) enc.writeFrame(idx, W, H, {palette, delay, repeat:0});
    else {
      const out = new Uint8Array(idx.length);
      for (let p = 0; p < idx.length; p++) out[p] = idx[p] === prev[p] ? 255 : idx[p];
      enc.writeFrame(out, W, H, {delay, transparent:true, transparentIndex:255, dispose:1});
    }
    prev = idx;
    if (onProgress) onProgress(0.7 + (i + 1) / frames.length * 0.3);
    if (i % 4 === 3) await new Promise(r => setTimeout(r, 0));
  }
  enc.finish();
  return new Blob([enc.bytes()], {type:'image/gif'});
}

/* ─── ZOOM: BOUNDED, AND A Y AXIS THAT FOLLOWS THE X WINDOW ───────────────────
   The same two promises every chart on this site makes, kept here by hand
   because a Plotly plot has no zoom plugin to hand them to: a drag or a scroll
   cannot leave the data, and the y axis is sized to the slice on screen rather
   than to the whole series — otherwise zooming into the left of a fast-growing
   column leaves it flat against a scale built for the right of it.

   2D only. A 3D scene is moved by its camera, not by axis ranges, and its ⟳
   puts that camera back instead. */
let axisGuardBound = false, guardData = null, guarding = false;

function dataExtent(traces, key){
  let lo = null, hi = null;
  traces.forEach(t => (t[key] || []).forEach(v => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    if(!isFinite(n)) return;
    if(lo === null || n < lo) lo = n;
    if(hi === null || n > hi) hi = n;
  }));
  if(lo === null) return null;
  if(hi === lo){ const p = Math.abs(hi) * 0.05 || 1; return [lo - p, hi + p]; }
  return [lo, hi];
}

/* The y extent of everything inside an x window, with one point either side so
   a segment crossing the edge is scaled with the slice it is drawn in. */
function yExtentIn(traces, x0, x1){
  let lo = null, hi = null;
  traces.forEach(t => {
    const xs = t.x || [], ys = t.y || [];
    let before = null, after = null;
    for(let i = 0; i < ys.length; i++){
      const x = typeof xs[i] === 'number' ? xs[i] : parseFloat(xs[i]);
      const y = typeof ys[i] === 'number' ? ys[i] : parseFloat(ys[i]);
      if(!isFinite(y)) continue;
      const xi = isFinite(x) ? x : i;
      if(xi < x0){ before = y; continue; }
      if(xi > x1){ if(after === null) after = y; continue; }
      if(lo === null || y < lo) lo = y;
      if(hi === null || y > hi) hi = y;
    }
    [before, after].forEach(v => {
      if(v === null) return;
      if(lo === null || v < lo) lo = v;
      if(hi === null || v > hi) hi = v;
    });
  });
  if(lo === null) return null;
  const pad = Math.max((hi - lo) * 0.08, Math.abs(hi) * 0.02, 1e-9) || 1;
  return [lo - pad, hi + pad];
}

function bindAxisGuard(traces){
  const div = document.getElementById('plotDiv');
  guardData = (S.dim === 2) ? { traces, x: dataExtent(traces, 'x') } : null;
  if(guardData && guardData.x){
    // Open on the data, so the first drag has an edge to meet.
    const y = yExtentIn(traces, guardData.x[0], guardData.x[1]);
    Plotly.relayout(div, y ? {'xaxis.range': guardData.x.slice(), 'yaxis.range': y}
                           : {'xaxis.range': guardData.x.slice()});
  }
  if(axisGuardBound) return;
  axisGuardBound = true;
  div.on('plotly_relayout', ev => {
    if(guarding || !guardData || !guardData.x) return;
    const hasX = ('xaxis.range[0]' in ev) || ('xaxis.range' in ev);
    const auto = ev['xaxis.autorange'] === true;
    if(!hasX && !auto) return;
    const full = guardData.x;
    let x0 = auto ? full[0] : Number(ev['xaxis.range[0]'] ?? (ev['xaxis.range'] || [])[0]);
    let x1 = auto ? full[1] : Number(ev['xaxis.range[1]'] ?? (ev['xaxis.range'] || [])[1]);
    if(!isFinite(x0) || !isFinite(x1)) return;
    if(x1 < x0){ const t = x0; x0 = x1; x1 = t; }
    // A window wider than the data is pulled back to it; one that has been
    // dragged off an end is slid back inside, keeping its width.
    const width = Math.min(x1 - x0, full[1] - full[0]);
    if(x0 < full[0]){ x0 = full[0]; x1 = x0 + width; }
    if(x1 > full[1]){ x1 = full[1]; x0 = x1 - width; }
    const y = yExtentIn(guardData.traces, x0, x1);
    const update = {'xaxis.range': [x0, x1]};
    if(y) update['yaxis.range'] = y;
    guarding = true;
    Plotly.relayout(div, update).finally(() => { guarding = false; });
  });
}

document.getElementById('resetView').onclick = () => {
  const div = document.getElementById('plotDiv');
  if(S.dim === 2 && guardData && guardData.x){
    const y = yExtentIn(guardData.traces, guardData.x[0], guardData.x[1]);
    Plotly.relayout(div, y ? {'xaxis.range': guardData.x.slice(), 'yaxis.range': y}
                           : {'xaxis.autorange': true, 'yaxis.autorange': true});
  } else {
    // A 3D scene: put the camera back where the plot opened.
    if (ANIM.active) ANIM.camera = defaultCamera();
    Plotly.relayout(div, {'scene.camera': defaultCamera()});
  }
};

// ─── SAVE PNG ─────────────────────────────────────────────────────────────────
function wmAnnotation() {
  return {
    xref:'paper', yref:'paper', x:1, y:0, xanchor:'right', yanchor:'bottom',
    showarrow:false, text:'Made using tool.adjiebrotots.com/graphvisualiser',
    font:{ size:10, color:'rgba(60,60,60,0.22)', family:'DM Sans, sans-serif' },
  };
}
async function withPngWatermark(callback) {
  await Plotly.relayout('plotDiv', { annotations:[wmAnnotation()], images:[wmPlotlyImage()] });
  try { return await callback(); }
  finally { await Plotly.relayout('plotDiv', { annotations:[], images:[] }); }
}
document.getElementById('savePng').onclick = async () => {
  const title = document.getElementById('chartTitle').value || 'graph';
  await withPngWatermark(() => Plotly.downloadImage('plotDiv', {
    format:'png', filename:title.replace(/\s+/g,'_'), scale:3, width:1440, height:760
  }));
};
document.getElementById('saveSvg').onclick = async () => {
  const title = document.getElementById('chartTitle').value || 'graph';
  await withPngWatermark(() => Plotly.downloadImage('plotDiv', {
    format:'svg', filename:title.replace(/\s+/g,'_'), width:1440, height:760
  }));
};
document.getElementById('copyPng').onclick = () => {
  const btn = document.getElementById('copyPng');
  const png = () => withPngWatermark(() => Plotly.toImage('plotDiv', {
    format:'png', scale:3, width:1440, height:760
  }));
  if (!ANIM.active) { SharedShare.copyImage(png, btn); return; }
  // An animation goes on the clipboard as its GIF where the browser takes one.
  SharedShare.copyImage(png, btn, {
    gif: () => makeAnimGif(p => setStatus('Making the GIF… ' + Math.round(p * 100) + '%', 'info')),
    onDone: kind => setStatus(kind === 'gif' ? 'Copied the animated GIF' : 'Copied a still PNG. Use Download as GIF for the animation', 'success'),
  });
};
document.getElementById('saveGif').onclick = async () => {
  const btn = document.getElementById('saveGif');
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    const blob = await makeAnimGif(p => setStatus('Making the GIF… ' + Math.round(p * 100) + '%', 'info'));
    const title = document.getElementById('chartTitle').value || 'graph';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = title.replace(/\s+/g,'_') + '.gif';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    setStatus('GIF saved', 'success');
  } catch (err) {
    showError('The GIF could not be made: ' + (err && err.message || err));
  } finally { btn.disabled = false; }
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
  el.innerHTML = chips.map(c=>`<div class="info-chip"><strong>${escHtml(c)}</strong></div>`).join('');
}

/* ── Mini cache ────────────────────────────────────────────────────────────
   Remember chart-styling preferences (title, marker size/opacity) between
   visits. The data itself comes from an uploaded file that can't be cached, so
   restore is silent — the saved styling applies once the user loads data and a
   chart renders. The header-row field is file-specific (data-no-persist). */
if (window.Persist) Persist.init('graphvisualiser', { onRestore: function(){} });
syncTemplateBox();
syncAnimUI();

/* ── Embed ─────────────────────────────────────────────────────────────────
   An embedded chart (SharedShare in shared.js) has no file to read, so it
   carries the data itself: the rows under the header, the axes picked and
   the styling, and draws what Visualise drew here. */
SharedShare.state({
  save: () => ({
    rows: S.raw ? S.raw.slice(S.headerRow - 1) : null, dim: S.dim,
    colormap: S.colormap, colors: S.seriesColors, axes: getAxisSelections(),
    title: document.getElementById('chartTitle').value,
    size: document.getElementById('markerSize').value,
    opacity: document.getElementById('markerOpacity').value,
    style: readStyle(),
    mode4d: document.getElementById('g4dMode').value,
    anim: {
      shape: document.getElementById('g4dShape').value, fps: document.getElementById('g4dFps').value,
      cam: document.getElementById('g4dCam').value, orbit: document.getElementById('g4dOrbit').value,
      camera: ANIM.camera,
    },
  }),
  load: v => new Promise(resolve => {
    if (!v || !Array.isArray(v.rows) || v.rows.length < 2) return resolve();
    const dimBtn = document.querySelector(`.dim-btn[data-dim="${+v.dim}"]`);
    if (dimBtn) dimBtn.click();
    // A link made before styles existed has none: it draws with the defaults it always had.
    writeStyle(Object.assign({}, STYLE_DEFAULT, v.style && typeof v.style === 'object' ? v.style : {})); syncTemplateBox();
    if (COLORMAPS.some(c => c.name === v.colormap)) S.colormap = v.colormap;
    S.seriesColors = v.colors && typeof v.colors === 'object' ? v.colors : {};
    document.getElementById('chartTitle').value = v.title || '';
    if (v.size) document.getElementById('markerSize').value = v.size;
    if (v.opacity) document.getElementById('markerOpacity').value = v.opacity;
    // A link made before the 4D animation has no mode4d: it is the heat map,
    // as 4D always was. Anything unknown takes the default.
    const an = v.anim && typeof v.anim === 'object' ? v.anim : {};
    document.getElementById('g4dMode').value  = v.mode4d === 'anim' ? 'anim' : 'heatmap';
    document.getElementById('g4dShape').value = an.shape === 'points' ? 'points' : 'surface';
    document.getElementById('g4dFps').value   = isFinite(+an.fps) && +an.fps > 0 ? an.fps : 8;
    document.getElementById('g4dCam').value   = an.cam === 'static' ? 'static' : 'orbit';
    document.getElementById('g4dOrbit').value = an.orbit != null && isFinite(+an.orbit) ? an.orbit : 30;
    ANIM.camera = validCamera(an.camera);
    syncAnimUI();
    document.getElementById('headerRow').value = 1;
    S.headerRow = 1;
    S.raw = v.rows;
    parseWithHeader();
    // buildAxesUI picks its defaults on the next tick; the shared axes go
    // in after that, as the sample dataset's do.
    setTimeout(() => {
      const a = v.axes || {}, pickOne = (id, i) => { const el = document.getElementById(id); if (el && i != null && el.options[i]) el.value = String(i); };
      pickOne('axisX', a.x); pickOne('axisZ', a.z); pickOne('axisW', a.w); pickOne('axisT', a.t);
      const y = document.getElementById('axisY'), ys = Array.isArray(a.y) ? a.y.map(String) : [];
      if (y && ys.length) Array.from(y.options).forEach(o => { o.selected = y.multiple ? ys.includes(o.value) : o.value === ys[0]; });
      buildSeriesColourPickers();
      buildColormapGrid();
      renderChart();
      resolve();
    }, 0);
  })
});

/* The sidebar is the standard foldable control card. A first visit lands with
   it open, because loading a file is the only way in; after that the reader's
   own fold choice is kept by SharedCtrl. */
function openCtrlFirstVisit() {
  try {
    if (window.SharedCtrl && localStorage.getItem('abt:ctrl:' + location.pathname.replace(/index\.html?$/, '').replace(/\/+$/, '/')) === null) SharedCtrl.open();
  } catch (e) {}
}
// shared.js sets the card up on DOMContentLoaded here, so ask after that.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', openCtrlFirstVisit);
else openCtrlFirstVisit();
