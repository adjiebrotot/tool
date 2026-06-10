'use strict';
// Watermark logo (logos/logo.svg), preloaded for use in canvas/SVG exports
const WM_LOGO_SRC = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDY4MCA2ODAiIHJvbGU9ImltZyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8dGl0bGU+QXJjaGVkIEEgTG9nbzwvdGl0bGU+CiAgPGRlc2M+QSBzbGVlayB3aGl0ZSBsZXR0ZXIgQSB3aG9zZSBsZWdzIGZvbGxvdyB0aGUgY2lyY2xlIGN1cnZhdHVyZSwgc3Bhbm5pbmcgODAlIG9mIHRoZSBjaXJjbGUgaGVpZ2h0PC9kZXNjPgoKICA8Y2lyY2xlIGN4PSIzNDAiIGN5PSIzNDAiIHI9IjMwMCIgZmlsbD0iIzAwNTJjYyIvPgoKICA8IS0tIExlZnQgbGVnOiAxMTPCsCB0byAyNDXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyNDIsNTcwIEEgMjUwLDI1MCAwIDAgMSAyMzQsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFRvcCBhcmNoOiAyNDXCsCB0byAyOTXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyMzQsMTEzIEEgMjUwLDI1MCAwIDAgMSA0NDYsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFJpZ2h0IGxlZzogMjk1wrAgdG8gNjfCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSA0NDYsMTEzIEEgMjUwLDI1MCAwIDAgMSA0MzgsNTcwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIENyb3NzYmFyIC0tPgogIDxsaW5lIHgxPSIxMTMiIHkxPSIzNTQiIHgyPSI1NjciIHkyPSIzNTQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNDIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K';
const EXPORT_WATERMARK_TEXT = 'Made using tool.adjiebrotots.com/jsonvisualiser';
const wmLogoImg = new Image();
wmLogoImg.src = WM_LOGO_SRC;
const _wmMeasureCtx = document.createElement('canvas').getContext('2d');
function measureWmText(text, font){ _wmMeasureCtx.font = font; return _wmMeasureCtx.measureText(text).width; }
// ─── STATE ───────────────────────────────────────────────────────────────────
let parsedData = null;
let currentFileName = '';
let currentFileSize = 0;
let nodeIdCounter = 0;
let rootDescriptor = null;

// ─── UTILS ───────────────────────────────────────────────────────────────────
function $(id){ return document.getElementById(id); }

function setLoadMethodMode(activeMethod){
  const inputs = $('loadInputs');
  if(!inputs) return;
  inputs.classList.toggle('has-selection', Boolean(activeMethod));
  inputs.querySelectorAll('.load-method').forEach(section => {
    section.classList.toggle('active', section.dataset.loadMethod === activeMethod);
  });
}

function expandLoadMethod(method){
  if(!method) return;
  setLoadMethodMode(method);
}

function getType(val){
  if(val === null) return 'null';
  if(Array.isArray(val)) return 'array';
  return typeof val;
}
function isPrimitive(type){ return type==='string'||type==='number'||type==='boolean'||type==='null'; }
function hasIndexKey(key){ return key !== null && /^\d+$/.test(String(key)); }

function formatPreviewValue(value, type){
  if(type === 'string'){
    const preview = value.length > 80 ? value.slice(0, 80) + '…' : value;
    return JSON.stringify(preview);
  }
  if(type === 'number' || type === 'boolean' || type === 'null') return JSON.stringify(value);
  if(type === 'array') return `[${value.length}]`;
  if(type === 'object') return `{${Object.keys(value).length}}`;
  return String(value);
}

function getBranchPreview(desc){
  // Numeric/indexed object nodes are the only branches that lack their own
  // meaningful label. Give those collapsed nodes context by borrowing the first
  // child entry, but keep named branches (e.g. ElmPvsys) unchanged.
  if(!hasIndexKey(desc.key) || desc.type !== 'object' || desc.rawRef === null) return null;
  const firstKey = desc.childKeys && desc.childKeys[0];
  if(firstKey === undefined) return null;
  const firstValue = desc.rawRef[firstKey];
  return { key: firstKey, value: formatPreviewValue(firstValue, getType(firstValue)) };
}

function appendBranchPreview(node, preview){
  if(!preview) return null;
  const wrapper = document.createElement('span');
  wrapper.className = 'node-preview';

  const keySpan = document.createElement('span');
  keySpan.className = 'node-preview-key';
  keySpan.textContent = preview.key;
  wrapper.appendChild(keySpan);

  const colon = document.createElement('span');
  colon.className = 'node-colon';
  colon.textContent = ':';
  wrapper.appendChild(colon);

  const valueSpan = document.createElement('span');
  valueSpan.className = 'node-preview-value';
  valueSpan.textContent = preview.value;
  wrapper.appendChild(valueSpan);

  node.appendChild(wrapper);
  return wrapper;
}

function syncBranchPreviewState(nodeEl){
  if(!nodeEl.classList.contains('has-preview')) return;
  const isExpanded = nodeEl.classList.contains('is-expanded');
  const previewEl = nodeEl.querySelector('.node-preview');
  const colonEl = nodeEl.querySelector('.node-key-colon');
  if(previewEl) previewEl.hidden = isExpanded;
  if(colonEl) colonEl.hidden = !isExpanded;
}

function syncBranchPreviewStates(rootEl = document){
  rootEl.querySelectorAll('.tj-node.has-preview').forEach(syncBranchPreviewState);
}

function getVisibleNodeText(nodeEl){
  return [...nodeEl.childNodes].reduce((parts, child) => {
    if(child.nodeType === Node.TEXT_NODE) return parts + child.textContent;
    if(child.nodeType !== Node.ELEMENT_NODE) return parts;
    if(child.hidden) return parts;
    const style = window.getComputedStyle(child);
    if(style.display === 'none' || style.visibility === 'hidden') return parts;
    if(child.classList.contains('node-toggle')) return parts;
    return parts + child.textContent;
  }, '').replace(/\s+/g, ' ').trim();
}

function formatBytes(b){
  if(b < 1024) return b+' B';
  if(b < 1024*1024) return (b/1024).toFixed(1)+' KB';
  return (b/(1024*1024)).toFixed(2)+' MB';
}

function countDepth(val, d=0){
  if(d > 20) return d; // cap for perf
  if(val === null || typeof val !== 'object') return d;
  const children = Array.isArray(val) ? val.slice(0,5) : Object.values(val).slice(0,10);
  return children.reduce((max, c) => Math.max(max, countDepth(c, d+1)), d);
}

function countNodes(val, d=0){
  if(d > 8) return 1; // cap recursion for perf
  if(val === null || typeof val !== 'object') return 1;
  const entries = Array.isArray(val) ? val.slice(0,100) : Object.values(val).slice(0,100);
  return 1 + entries.reduce((s,c) => s + countNodes(c, d+1), 0);
}

// ─── STATUS HELPERS ──────────────────────────────────────────────────────────
function showStatus(id, msg){
  ['statusLoading','statusSuccess','statusError'].forEach(s => {
    const el = $(s);
    el.classList.remove('visible');
    el.textContent = '';
  });
  const el = $(id);
  if(el){ el.textContent = msg; el.classList.add('visible'); }
}
function hideStatus(){
  ['statusLoading','statusSuccess','statusError'].forEach(s => {
    $(s).classList.remove('visible');
  });
}

// ─── THEME TOGGLE ────────────────────────────────────────────────────────────
const themeBtn = $('themeToggle');
themeBtn.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark');
  themeBtn.textContent = isDark ? '☀️ Light' : '🌙 Dark';
  localStorage.setItem('jv-theme', isDark ? 'dark' : 'light');
});
(function initTheme(){
  const saved = localStorage.getItem('jv-theme');
  if(saved === 'dark'){ document.body.classList.add('dark'); themeBtn.textContent = '☀️ Light'; }
})();

// ─── DROP ZONE & FILE INPUT ──────────────────────────────────────────────────
const dropZone = $('dropZone');
const fileInput = $('fileInput');

document.querySelectorAll('[data-method-toggle]').forEach(btn => {
  btn.addEventListener('click', () => expandLoadMethod(btn.dataset.methodToggle));
});

$('browseBtn').addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('keydown', (e) => { if(e.key==='Enter'||e.key===' ') fileInput.click(); });

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if(file) loadFile(file);
});

fileInput.addEventListener('change', () => {
  if(fileInput.files[0]) loadFile(fileInput.files[0]);
  fileInput.value = '';
});

function loadFile(file){
  currentFileName = file.name;
  currentFileSize = file.size;
  showLoading('Reading file...');
  const reader = new FileReader();
  reader.onload = (e) => handleRawJSON(e.target.result, file.name, file.size, 'file');
  reader.onerror = () => showError('Failed to read file.');
  reader.readAsText(file);
}

// ─── URL FETCH ───────────────────────────────────────────────────────────────
$('fetchBtn').addEventListener('click', () => {
  const url = $('urlInput').value.trim();
  if(!url){ showStatus('statusError','Please enter a URL.'); return; }
  showLoading('Fetching...');
  fetch(url)
    .then(r => {
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    })
    .then(text => {
      const name = url.split('/').pop().split('?')[0] || 'fetched.json';
      handleRawJSON(text, name, text.length, 'url');
    })
    .catch(err => showError('Fetch failed: ' + err.message + '. Check CORS headers on the target server.'));
});

$('urlInput').addEventListener('keydown', (e) => { if(e.key==='Enter') $('fetchBtn').click(); });

// ─── DIRECT JSON PASTE ───────────────────────────────────────────────────────
$('loadTextBtn').addEventListener('click', () => {
  const text = $('jsonTextInput').value.trim();
  if(!text){ showStatus('statusError','Please paste JSON text.'); return; }
  showLoading('Parsing pasted JSON...');
  handleRawJSON(text, 'pasted-json.json', text.length, 'paste');
});

$('jsonTextInput').addEventListener('keydown', (e) => {
  if((e.ctrlKey || e.metaKey) && e.key === 'Enter') $('loadTextBtn').click();
});

// ─── LOADING / ERROR STATES ──────────────────────────────────────────────────
function showLoading(msg='Parsing JSON...'){
  $('emptyState').style.display = 'none';
  $('loadingOverlay').classList.add('visible');
  $('loadingText').textContent = msg;
  $('treeHeader').style.display = 'none';
  $('treeViewport').style.display = 'none';
}

function showError(msg){
  $('loadingOverlay').classList.remove('visible');
  $('emptyState').style.display = 'flex';
  showStatus('statusError', msg);
}

// ─── MAIN ENTRY ──────────────────────────────────────────────────────────────
function handleRawJSON(text, name, size, loadMethod){
  // Defer parse so loading UI renders first
  setTimeout(() => {
    try {
      const data = JSON.parse(text);
      parsedData = data;
      currentFileName = name;
      currentFileSize = size;
      renderTree(data, name, size, text.length, loadMethod);
    } catch(err) {
      showError('Invalid JSON: ' + err.message);
    }
  }, 30);
}

// ─── RENDER TREE ─────────────────────────────────────────────────────────────
function renderTree(data, name, size, byteLen, loadMethod){
  nodeIdCounter = 0;
  rootDescriptor = null;
  const root = $('treeRoot');
  root.innerHTML = '';

  // Hide loading, show tree
  $('loadingOverlay').classList.remove('visible');
  $('treeHeader').style.display = 'flex';
  $('treeViewport').style.display = 'block';

  // Compute stats (fast, capped)
  const type = getType(data);
  const depth = countDepth(data);
  const topCount = type === 'array' ? data.length : (type === 'object' ? Object.keys(data).length : 0);

  // Update header
  $('treeHeaderTitle').textContent = name;
  $('treeHeaderMeta').textContent =
    formatBytes(byteLen) + ' · ' +
    (type === 'array' ? `[${topCount}]` : type === 'object' ? `{${topCount}}` : type) +
    ' · depth ~' + depth;

  // Show file info panel
  $('fileInfoSection').style.display = 'block';
  $('fileInfoGrid').innerHTML = `
    <span class="info-label">File</span><span class="info-value" title="${escHtml(name)}">${escHtml(name)}</span>
    <span class="info-label">Size</span><span class="info-value">${formatBytes(byteLen)}</span>
    <span class="info-label">Root type</span><span class="info-value">${type}</span>
    <span class="info-label">Top keys</span><span class="info-value">${topCount}</span>
    <span class="info-label">Est. depth</span><span class="info-value">${depth}</span>
  `;

  // Show controls
  $('controlsCard').style.display = 'block';
  $('downloadPngBtn').disabled = false;
  $('copyPngBtn').disabled = false;
  $('downloadSvgBtn').disabled = false;
  $('downloadNote').classList.add('visible');

  // Keep the successful load method expanded and collapse the unused inputs.
  setLoadMethodMode(loadMethod);

  // Render root node
  const desc = createDescriptor(data, null);
  rootDescriptor = desc;
  renderNode(desc, root);

  // Auto-expand root if it has children
  if(!isPrimitive(desc.type) && desc.childCount > 0){
    const rootNodeEl = root.querySelector('.tj-node');
    if(rootNodeEl) rootNodeEl.click();
  }

  // Reset pan/zoom to home position
  resetView();

  hideStatus();
  showStatus('statusSuccess', `Loaded ${name} (${formatBytes(byteLen)})`);
}

// ─── DESCRIPTOR FACTORY ──────────────────────────────────────────────────────
function createDescriptor(value, key){
  const type = getType(value);
  const desc = {
    id: nodeIdCounter++,
    key: key !== null && key !== undefined ? String(key) : null,
    type,
    rawRef: value,
    childCount: type === 'array' ? value.length : (type === 'object' ? Object.keys(value).length : 0),
    childKeys: type === 'object' ? Object.keys(value) : null,
    renderedCount: 0,
    expanded: false,
    containerEl: null,   // set when first expanded
    nodeEl: null,
    childDescriptors: [],
  };
  return desc;
}

// ─── RENDER NODE ─────────────────────────────────────────────────────────────
function renderNode(desc, parentEl){
  const item = document.createElement('div');
  item.className = 'tj-item';

  const node = document.createElement('div');
  node.className = `tj-node tj-${desc.type}`;
  desc.nodeEl = node;
  node.setAttribute('role', 'button');
  node.setAttribute('tabindex', '0');

  const branchPreview = getBranchPreview(desc);
  if(branchPreview) node.classList.add('has-preview');

  // Key label
  if(desc.key !== null){
    const keySpan = document.createElement('span');
    keySpan.className = 'node-key';
    keySpan.textContent = desc.key;
    node.appendChild(keySpan);
    const colon = document.createElement('span');
    colon.className = branchPreview ? 'node-colon node-key-colon' : 'node-colon';
    colon.textContent = ':';
    node.appendChild(colon);
  }

  if(isPrimitive(desc.type)){
    // Primitive value
    const rawVal = desc.type === 'null' ? 'null' : JSON.stringify(desc.rawRef);
    const valSpan = document.createElement('span');
    valSpan.className = 'node-value';
    if(desc.type === 'string' && desc.rawRef.length > 120){
      valSpan.textContent = JSON.stringify(desc.rawRef.slice(0,120)) + '…';
      valSpan.className += ' expandable-str';
      valSpan.title = 'Click to expand';
      let expanded = false;
      valSpan.addEventListener('click', (e) => {
        e.stopPropagation();
        expanded = !expanded;
        valSpan.textContent = expanded ? JSON.stringify(desc.rawRef) : JSON.stringify(desc.rawRef.slice(0,120)) + '…';
      });
    } else {
      valSpan.textContent = rawVal;
    }
    node.appendChild(valSpan);
  } else {
    // Object or array: show a useful first-entry preview for unnamed array branches,
    // then badge + optional toggle.
    appendBranchPreview(node, branchPreview);
    syncBranchPreviewState(node);
    const badge = document.createElement('span');
    badge.className = 'node-badge';
    badge.textContent = desc.type === 'array' ? `[${desc.childCount}]` : `{${desc.childCount}}`;
    node.appendChild(badge);

    if(desc.childCount > 0){
      const toggle = document.createElement('span');
      toggle.className = 'node-toggle';
      toggle.textContent = '▶';
      node.appendChild(toggle);
      node.classList.add('expandable');

      // Children container (lazy)
      const childrenEl = document.createElement('div');
      childrenEl.className = 'tj-children';
      childrenEl.style.display = 'none';
      desc.containerEl = childrenEl;
      item.appendChild(node);
      item.appendChild(childrenEl);

      node.addEventListener('click', () => toggleNode(desc, node, childrenEl));
      node.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggleNode(desc, node, childrenEl); }
      });
      parentEl.appendChild(item);
      return;
    }
  }

  item.appendChild(node);
  parentEl.appendChild(item);
}

// ─── TOGGLE NODE ─────────────────────────────────────────────────────────────
function toggleNode(desc, nodeEl, childrenEl){
  if(desc.expanded){
    desc.expanded = false;
    childrenEl.style.display = 'none';
    nodeEl.classList.remove('is-expanded');
    syncBranchPreviewState(nodeEl);
  } else {
    desc.expanded = true;
    childrenEl.style.display = 'flex';
    nodeEl.classList.add('is-expanded');
    syncBranchPreviewState(nodeEl);
    if(desc.renderedCount === 0){
      if(desc.type === 'object') renderObjectChildren(desc, childrenEl);
      else renderArrayChunk(desc, childrenEl, 5);
    }
  }
}

// ─── RENDER OBJECT CHILDREN ──────────────────────────────────────────────────
function renderObjectChildren(desc, containerEl){
  const keys = desc.childKeys;
  const FIRST = Math.min(5, keys.length);
  for(let i = 0; i < FIRST; i++){
    const child = createDescriptor(desc.rawRef[keys[i]], keys[i]);
    desc.childDescriptors.push(child);
    renderNode(child, containerEl);
  }
  desc.renderedCount = FIRST;
  if(keys.length > FIRST) updateObjectPagination(desc, containerEl);
}

function updateObjectPagination(desc, containerEl){
  const existing = containerEl.querySelector('.pagination-row');
  if(existing) existing.remove();
  const remaining = desc.childKeys.length - desc.renderedCount;
  if(remaining <= 0) return;

  const row = document.createElement('div');
  row.className = 'pagination-row';

  getPageButtonConfigs(remaining).forEach(({ label, count }) => {
    const btn = makePageBtn(label, () => {
      const actual = count === -1 ? remaining : count;
      if(count === -1 && remaining > 500){
        if(!confirm(`Render all ${remaining} remaining items? This may be slow.`)) return;
      }
      const keys = desc.childKeys;
      const start = desc.renderedCount;
      const end = Math.min(start + actual, keys.length);
      for(let i = start; i < end; i++){
        const child = createDescriptor(desc.rawRef[keys[i]], keys[i]);
        desc.childDescriptors.push(child);
        renderNode(child, containerEl);
      }
      desc.renderedCount = end;
      updateObjectPagination(desc, containerEl);
    });
    row.appendChild(btn);
  });

  const countLabel = document.createElement('span');
  countLabel.className = 'pagination-count';
  countLabel.textContent = `${desc.renderedCount}/${desc.childKeys.length} keys`;
  row.appendChild(countLabel);
  containerEl.appendChild(row);
}

// ─── RENDER ARRAY CHUNK ──────────────────────────────────────────────────────
function renderArrayChunk(desc, containerEl, count){
  const start = desc.renderedCount;
  const end = Math.min(start + count, desc.childCount);
  for(let i = start; i < end; i++){
    const child = createDescriptor(desc.rawRef[i], i);
    desc.childDescriptors.push(child);
    renderNode(child, containerEl);
  }
  desc.renderedCount = end;
  updateArrayPagination(desc, containerEl);
}

function updateArrayPagination(desc, containerEl){
  const existing = containerEl.querySelector('.pagination-row');
  if(existing) existing.remove();
  const remaining = desc.childCount - desc.renderedCount;
  if(remaining <= 0) return;

  const row = document.createElement('div');
  row.className = 'pagination-row';

  getPageButtonConfigs(remaining).forEach(({ label, count }) => {
    const btn = makePageBtn(label, () => {
      const actual = count === -1 ? remaining : count;
      if(count === -1 && remaining > 500){
        if(!confirm(`Render all ${remaining} remaining items? This may be slow.`)) return;
      }
      renderArrayChunk(desc, containerEl, actual);
    });
    row.appendChild(btn);
  });

  const countLabel = document.createElement('span');
  countLabel.className = 'pagination-count';
  countLabel.textContent = `${desc.renderedCount}/${desc.childCount} items`;
  row.appendChild(countLabel);
  containerEl.appendChild(row);
}

// ─── ADAPTIVE PAGE BUTTON CONFIGS ────────────────────────────────────────────
function getPageButtonConfigs(remaining){
  if(remaining > 100) return [
    { label: 'Next 10', count: 10 },
    { label: 'Next 50', count: 50 },
    { label: `All (${remaining})`, count: -1 },
  ];
  if(remaining > 20) return [
    { label: 'Next 10', count: 10 },
    { label: 'Next 20', count: 20 },
    { label: `All (${remaining})`, count: -1 },
  ];
  if(remaining > 10) return [
    { label: 'Next 5', count: 5 },
    { label: 'Next 10', count: 10 },
    { label: `All (${remaining})`, count: -1 },
  ];
  if(remaining > 5) return [
    { label: 'Next 5', count: 5 },
    { label: `All (${remaining})`, count: -1 },
  ];
  return [{ label: `All (${remaining})`, count: -1 }];
}

function makePageBtn(label, handler){
  const btn = document.createElement('button');
  btn.className = 'btn-page';
  btn.textContent = label;
  btn.addEventListener('click', (e) => { e.stopPropagation(); handler(); });
  return btn;
}

// ─── EXPAND / COLLAPSE ALL ──────────────────────────────────────────────────
const EXPAND_ALL_WARN_NODE_LIMIT = 2500;
const EXPAND_ALL_WARN_BYTE_LIMIT = 1024 * 1024;

function estimateNodeCountForExpandAll(value, limit = EXPAND_ALL_WARN_NODE_LIMIT + 1){
  const stack = [value];
  let count = 0;
  while(stack.length){
    const current = stack.pop();
    count++;
    if(count >= limit) return count;
    if(current && typeof current === 'object'){
      if(Array.isArray(current)){
        for(let i = current.length - 1; i >= 0; i--) stack.push(current[i]);
      } else {
        const values = Object.values(current);
        for(let i = values.length - 1; i >= 0; i--) stack.push(values[i]);
      }
    }
  }
  return count;
}

function renderAllMissingChildren(desc){
  if(isPrimitive(desc.type) || desc.childCount === 0 || !desc.containerEl) return;
  const pagination = desc.containerEl.querySelector(':scope > .pagination-row');
  if(pagination) pagination.remove();

  if(desc.type === 'object'){
    const keys = desc.childKeys;
    for(let i = desc.renderedCount; i < keys.length; i++){
      const child = createDescriptor(desc.rawRef[keys[i]], keys[i]);
      desc.childDescriptors.push(child);
      renderNode(child, desc.containerEl);
    }
    desc.renderedCount = keys.length;
  } else if(desc.type === 'array'){
    for(let i = desc.renderedCount; i < desc.childCount; i++){
      const child = createDescriptor(desc.rawRef[i], i);
      desc.childDescriptors.push(child);
      renderNode(child, desc.containerEl);
    }
    desc.renderedCount = desc.childCount;
  }
}

function expandDescriptorAndChildren(desc){
  if(isPrimitive(desc.type) || desc.childCount === 0) return;
  desc.expanded = true;
  if(desc.containerEl) desc.containerEl.style.display = 'flex';
  if(desc.nodeEl) desc.nodeEl.classList.add('is-expanded');
  renderAllMissingChildren(desc);
  desc.childDescriptors.forEach(expandDescriptorAndChildren);
}

$('expandAllBtn').addEventListener('click', () => {
  if(!parsedData || !rootDescriptor) return;
  const estimatedNodes = estimateNodeCountForExpandAll(parsedData);
  const isTooBig = estimatedNodes > EXPAND_ALL_WARN_NODE_LIMIT || currentFileSize > EXPAND_ALL_WARN_BYTE_LIMIT;
  if(isTooBig){
    const nodeText = estimatedNodes > EXPAND_ALL_WARN_NODE_LIMIT ? `${EXPAND_ALL_WARN_NODE_LIMIT}+` : estimatedNodes;
    const sizeText = currentFileSize ? ` (${formatBytes(currentFileSize)})` : '';
    if(!confirm(`This JSON is large${sizeText}. Expanding all may render ${nodeText} nodes and can slow or freeze the browser. Continue?`)) return;
  }
  const btn = $('expandAllBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Expanding...';
  setTimeout(() => {
    try {
      expandDescriptorAndChildren(rootDescriptor);
      resetView();
    } finally {
      btn.disabled = false;
      btn.textContent = 'Expand All';
    }
  }, 20);
});

$('collapseAllBtn').addEventListener('click', () => {
  $('treeRoot').querySelectorAll('.tj-node.is-expanded').forEach(nodeEl => {
    nodeEl.click();
  });
});

$('clearBtn').addEventListener('click', () => {
  parsedData = null;
  rootDescriptor = null;
  $('treeRoot').innerHTML = '';
  $('treeHeader').style.display = 'none';
  $('treeViewport').style.display = 'none';
  $('emptyState').style.display = 'flex';
  $('fileInfoSection').style.display = 'none';
  $('controlsCard').style.display = 'none';
  $('downloadNote').classList.remove('visible');
  setLoadMethodMode(null);
  hideStatus();
});

// ─── ESCAPE HTML ─────────────────────────────────────────────────────────────
function escHtml(str){
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── PAN / ZOOM ENGINE ───────────────────────────────────────────────────────
const VP_MIN = 0.1, VP_MAX = 4;
const vp = { x: 24, y: 24, scale: 1, dragging: false, lastX: 0, lastY: 0,
              pinchDist: 0, pinchMidX: 0, pinchMidY: 0 };

const vpEl     = $('treeViewport');
const canvasEl = $('treeCanvas');
const zoomLevelEl = $('zoomLevel');

function applyVP(){
  canvasEl.style.transform = `translate(${vp.x}px,${vp.y}px) scale(${vp.scale})`;
  zoomLevelEl.textContent = Math.round(vp.scale * 100) + '%';
}

function resetView(){
  vp.x = 24; vp.y = 24; vp.scale = 1;
  applyVP();
  showNavHint();
}

function zoomAt(cx, cy, factor){
  const newScale = Math.max(VP_MIN, Math.min(VP_MAX, vp.scale * factor));
  const f = newScale / vp.scale;
  vp.x = cx - (cx - vp.x) * f;
  vp.y = cy - (cy - vp.y) * f;
  vp.scale = newScale;
  applyVP();
}

// Nav hint (fades out after 3s of inactivity)
let hintTimer;
function showNavHint(){
  const h = $('navHint');
  h.classList.remove('fade');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => h.classList.add('fade'), 3000);
}

// Mouse drag
vpEl.addEventListener('mousedown', (e) => {
  if(e.button !== 0) return;
  vp.dragging = true; vp.lastX = e.clientX; vp.lastY = e.clientY;
  vpEl.classList.add('panning');
  // Don't preventDefault on interactive elements — doing so suppresses their click events
  if(!e.target.closest('.tj-node, .btn-page, .expandable-str')) {
    e.preventDefault();
  }
});
window.addEventListener('mousemove', (e) => {
  if(!vp.dragging) return;
  vp.x += e.clientX - vp.lastX;
  vp.y += e.clientY - vp.lastY;
  vp.lastX = e.clientX; vp.lastY = e.clientY;
  applyVP();
});
window.addEventListener('mouseup', () => {
  vp.dragging = false;
  vpEl.classList.remove('panning');
});

// Scroll-wheel zoom (toward cursor)
vpEl.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = vpEl.getBoundingClientRect();
  const cx = e.clientX - r.left;
  const cy = e.clientY - r.top;
  const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  zoomAt(cx, cy, factor);
}, { passive: false });

// Touch pan + pinch-to-zoom
vpEl.addEventListener('touchstart', (e) => {
  if(e.touches.length === 1){
    vp.lastX = e.touches[0].clientX;
    vp.lastY = e.touches[0].clientY;
  } else if(e.touches.length === 2){
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    vp.pinchDist  = Math.hypot(dx, dy);
    vp.pinchMidX  = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    vp.pinchMidY  = (e.touches[0].clientY + e.touches[1].clientY) / 2;
  }
  // Don't preventDefault for single-finger taps on interactive elements —
  // it would suppress the synthesised click event on mobile.
  if(e.touches.length !== 1 || !e.target.closest('.tj-node, .btn-page, .expandable-str')) {
    e.preventDefault();
  }
}, { passive: false });

vpEl.addEventListener('touchmove', (e) => {
  if(e.touches.length === 1){
    vp.x += e.touches[0].clientX - vp.lastX;
    vp.y += e.touches[0].clientY - vp.lastY;
    vp.lastX = e.touches[0].clientX;
    vp.lastY = e.touches[0].clientY;
    applyVP();
  } else if(e.touches.length === 2){
    const dx   = e.touches[0].clientX - e.touches[1].clientX;
    const dy   = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    const r    = vpEl.getBoundingClientRect();
    zoomAt(midX - r.left, midY - r.top, dist / vp.pinchDist);
    vp.pinchDist = dist;
    // Also pan with pinch midpoint movement
    vp.x += midX - vp.pinchMidX;
    vp.y += midY - vp.pinchMidY;
    vp.pinchMidX = midX; vp.pinchMidY = midY;
    applyVP();
  }
  e.preventDefault();
}, { passive: false });

// Zoom buttons
$('zoomInBtn').addEventListener('click',  () => { const r = vpEl.getBoundingClientRect(); zoomAt(r.width/2, r.height/2, 1.25); });
$('zoomOutBtn').addEventListener('click', () => { const r = vpEl.getBoundingClientRect(); zoomAt(r.width/2, r.height/2, 1/1.25); });
$('zoomFitBtn').addEventListener('click', resetView);
$('zoomLevel').addEventListener('click',  resetView);

// Keyboard shortcuts (when viewport focused)
window.addEventListener('keydown', (e) => {
  if(!parsedData) return;
  if(e.target.tagName === 'INPUT') return;
  if(e.key === '=' || e.key === '+') { const r = vpEl.getBoundingClientRect(); zoomAt(r.width/2, r.height/2, 1.25); e.preventDefault(); }
  if(e.key === '-')                  { const r = vpEl.getBoundingClientRect(); zoomAt(r.width/2, r.height/2, 1/1.25); e.preventDefault(); }
  if(e.key === '0')                  { resetView(); e.preventDefault(); }
});

// ─── EXPORT HELPERS ──────────────────────────────────────────────────────────
// Replaces visible pagination button rows with a static "… N more" placeholder.
// Returns a restore function that puts the original rows back (event listeners intact).
function preparePaginationForExport() {
  const restores = [];
  document.querySelectorAll('.tj-children .pagination-row').forEach(row => {
    // Skip if the parent children container is collapsed
    const parent = row.closest('.tj-children');
    if(parent && parent.style.display === 'none') return;
    const countEl = row.querySelector('.pagination-count');
    if(!countEl) return;
    const match = countEl.textContent.match(/(\d+)\/(\d+)/);
    if(!match) return;
    const remaining = parseInt(match[2]) - parseInt(match[1]);
    if(remaining <= 0) return;

    const placeholder = document.createElement('div');
    placeholder.className = 'export-more-placeholder';
    placeholder.textContent = `… ${remaining} more`;
    row.parentNode.insertBefore(placeholder, row);
    row.style.display = 'none';
    restores.push(() => { row.style.display = ''; placeholder.remove(); });
  });
  return restores;
}


function addWatermarkToPngCanvas(sourceCanvas){
  const scale = 2;
  const footerH = 36 * scale;
  const sidePad = 12 * scale;
  const wmLogoSize = 13 * scale;
  const fontPx = 11 * scale;
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `500 ${fontPx}px 'DM Sans', sans-serif`;
  const wmTextW = measure.measureText(EXPORT_WATERMARK_TEXT).width;
  const minWidth = Math.ceil(sidePad * 2 + wmLogoSize + 8 * scale + wmTextW);

  const output = document.createElement('canvas');
  output.width = Math.max(sourceCanvas.width, minWidth);
  output.height = sourceCanvas.height + footerH;

  const ctx = output.getContext('2d');
  ctx.clearRect(0, 0, output.width, output.height);
  ctx.drawImage(sourceCanvas, 0, 0);

  const wmX = output.width - sidePad;
  const wmY = output.height - 10 * scale;
  ctx.save();
  ctx.font = `500 ${fontPx}px 'DM Sans', sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.lineWidth = 3 * scale;
  if(wmLogoImg.complete && wmLogoImg.naturalWidth){
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.drawImage(wmLogoImg, wmX - wmTextW - 4 * scale - wmLogoSize, wmY - wmLogoSize + 2 * scale, wmLogoSize, wmLogoSize);
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.strokeText(EXPORT_WATERMARK_TEXT, wmX, wmY);
  ctx.fillStyle = 'rgba(26,26,26,0.55)';
  ctx.fillText(EXPORT_WATERMARK_TEXT, wmX, wmY);
  ctx.restore();
  return output;
}

// ─── DOWNLOAD PNG ────────────────────────────────────────────────────────────
async function renderTreePngCanvas() {
  syncBranchPreviewStates($('treeRoot'));
  const restores = preparePaginationForExport();

  // Reset transform temporarily so html2canvas captures the full untransformed content
  const savedTransform = canvasEl.style.transform;
  canvasEl.style.transform = 'translate(0,0) scale(1)';

  try {
    const result = await html2canvas(canvasEl, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: -window.scrollY,
    });

    return addWatermarkToPngCanvas(result);
  } finally {
    canvasEl.style.transform = savedTransform;
    restores.forEach(fn => fn());
  }
}
async function copyCanvasPngToClipboard(canvas) {
  if(!navigator.clipboard || !window.ClipboardItem) throw new Error('Clipboard image copy is not supported in this browser.');
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if(!blob) throw new Error('Could not create PNG blob.');
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
$('downloadPngBtn').addEventListener('click', async () => {
  const btn = $('downloadPngBtn');
  if(!parsedData) return;
  btn.disabled = true; btn.textContent = '⏳ Rendering...';
  try {
    const result = await renderTreePngCanvas();
    const a = document.createElement('a');
    a.href = result.toDataURL('image/png');
    a.download = (currentFileName.replace(/\.[^.]+$/, '') || 'json-tree') + '-tree.png';
    document.body.appendChild(a); a.click(); a.remove();
  } catch(err) {
    alert('PNG export failed: ' + err.message);
  }
  btn.disabled = false; btn.textContent = '⬇ PNG';
});
$('copyPngBtn').addEventListener('click', async () => {
  const btn = $('copyPngBtn');
  if(!parsedData) return;
  btn.disabled = true; btn.textContent = '⏳';
  try { await copyCanvasPngToClipboard(await renderTreePngCanvas()); alert('PNG copied to clipboard.'); }
  catch(err){ alert('PNG copy failed: ' + err.message); }
  btn.disabled = false; btn.textContent = '⧉ PNG';
});

// ─── DOWNLOAD SVG ────────────────────────────────────────────────────────────
$('downloadSvgBtn').addEventListener('click', () => {
  if(!parsedData) return;
  const btn = $('downloadSvgBtn');
  btn.disabled = true; btn.textContent = '⏳ Building...';

  syncBranchPreviewStates($('treeRoot'));
  const svgRestores = preparePaginationForExport();

  // Reset transform temporarily so getBoundingClientRect gives un-scaled positions
  const savedTransform = canvasEl.style.transform;
  canvasEl.style.transform = 'translate(0,0) scale(1)';

  setTimeout(() => {
    try {
      const isDark = document.body.classList.contains('dark');
      const fg          = isDark ? '#EAF1FF'  : '#2D3436';
      const panelBg     = isDark ? '#1C2942'  : '#FFFFFF';
      const borderColor = isDark ? '#2C3A52'  : '#E0E6F0';
      const connectorColor = isDark ? '#2C3A52' : '#C8D4E8';

      const NS = 'http://www.w3.org/2000/svg';
      const canvasRect = canvasEl.getBoundingClientRect();
      const svgW = canvasEl.scrollWidth  + 48;
      const svgH = canvasEl.scrollHeight + 48;

      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('xmlns', NS); svg.setAttribute('width', svgW); svg.setAttribute('height', svgH);
      svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);

      const treeRootEl = $('treeRoot');
      const offsetX = canvasRect.left;
      const offsetY = canvasRect.top;

      // Connector lines (drawn below nodes). Vertical bar spans from first to last
      // child node centre; each child gets a horizontal line from the bar to its node.
      treeRootEl.querySelectorAll('.tj-children').forEach(childrenEl => {
        if(childrenEl.style.display === 'none') return;
        const cr = childrenEl.getBoundingClientRect();
        const lineX = cr.left - offsetX;
        const childNodes = [...childrenEl.children]
          .filter(child => child.classList.contains('tj-item'))
          .map(child => [...child.children].find(grandchild => grandchild.classList.contains('tj-node')))
          .filter(Boolean);
        if(childNodes.length < 1) return;
        const fr = childNodes[0].getBoundingClientRect();
        const lr = childNodes[childNodes.length - 1].getBoundingClientRect();
        const y1 = fr.top - offsetY + fr.height / 2;
        const y2 = lr.top - offsetY + lr.height / 2;
        if(y1 < y2){
          const vl = document.createElementNS(NS, 'line');
          vl.setAttribute('x1', lineX); vl.setAttribute('y1', y1);
          vl.setAttribute('x2', lineX); vl.setAttribute('y2', y2);
          vl.setAttribute('stroke', connectorColor); vl.setAttribute('stroke-width', '1');
          svg.appendChild(vl);
        }
        childNodes.forEach(nodeEl => {
          const nr = nodeEl.getBoundingClientRect();
          const nx = nr.left - offsetX;
          const ny = nr.top  - offsetY + nr.height / 2;
          const hl = document.createElementNS(NS, 'line');
          hl.setAttribute('x1', lineX); hl.setAttribute('y1', ny);
          hl.setAttribute('x2', nx);    hl.setAttribute('y2', ny);
          hl.setAttribute('stroke', connectorColor); hl.setAttribute('stroke-width', '1');
          svg.appendChild(hl);
        });
      });

      // Node boxes + text
      treeRootEl.querySelectorAll('.tj-node').forEach(nodeEl => {
        const nr = nodeEl.getBoundingClientRect();
        const x = nr.left - offsetX; const y = nr.top - offsetY;
        const cs = window.getComputedStyle(nodeEl);
        const box = document.createElementNS(NS, 'rect');
        box.setAttribute('x', x); box.setAttribute('y', y);
        box.setAttribute('width', nr.width); box.setAttribute('height', nr.height);
        box.setAttribute('rx', '8'); box.setAttribute('fill', panelBg);
        box.setAttribute('stroke', cs.borderColor || borderColor);
        svg.appendChild(box);

        const txt = getVisibleNodeText(nodeEl).slice(0, 90);

        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x + 10); t.setAttribute('y', y + nr.height / 2);
        t.setAttribute('dominant-baseline', 'middle');
        t.setAttribute('font-family', 'DM Mono, monospace');
        t.setAttribute('font-size', '11');
        t.setAttribute('fill', fg);
        t.textContent = txt;
        svg.appendChild(t);
      });

      // "… N more" placeholders for truncated pagination
      treeRootEl.querySelectorAll('.export-more-placeholder').forEach(ph => {
        const pr = ph.getBoundingClientRect();
        if(pr.width === 0) return;
        const pt = document.createElementNS(NS, 'text');
        pt.setAttribute('x', pr.left - offsetX + 8);
        pt.setAttribute('y', pr.top - offsetY + pr.height / 2);
        pt.setAttribute('dominant-baseline', 'middle');
        pt.setAttribute('font-family', 'DM Mono, monospace');
        pt.setAttribute('font-size', '11');
        pt.setAttribute('fill', fg);
        pt.setAttribute('opacity', '0.6');
        pt.textContent = ph.textContent;
        svg.appendChild(pt);
      });

      // Watermark
      const wm = document.createElementNS(NS, 'text');
      wm.setAttribute('x', svgW - 12); wm.setAttribute('y', svgH - 12);
      wm.setAttribute('text-anchor', 'end'); wm.setAttribute('dominant-baseline', 'auto');
      wm.setAttribute('font-family', 'DM Sans, sans-serif'); wm.setAttribute('font-size', '11');
      wm.setAttribute('stroke', '#ffffff');
      wm.setAttribute('stroke-width', '3');
      wm.setAttribute('stroke-opacity', '0.70');
      wm.setAttribute('paint-order', 'stroke');
      wm.setAttribute('fill', '#1a1a1a');
      wm.setAttribute('fill-opacity', '0.45');
      wm.textContent = EXPORT_WATERMARK_TEXT;
      svg.appendChild(wm);
      const wmLogoSize = 13;
      const wmTextW = measureWmText(wm.textContent, '500 11px DM Sans, sans-serif');
      const wmLogo = document.createElementNS(NS, 'image');
      wmLogo.setAttribute('href', WM_LOGO_SRC);
      wmLogo.setAttributeNS('http://www.w3.org/1999/xlink', 'href', WM_LOGO_SRC);
      wmLogo.setAttribute('width', wmLogoSize);
      wmLogo.setAttribute('height', wmLogoSize);
      wmLogo.setAttribute('x', svgW - 12 - wmTextW - 4 - wmLogoSize);
      wmLogo.setAttribute('y', svgH - 12 - wmLogoSize + 2);
      wmLogo.setAttribute('opacity', '0.45');
      svg.appendChild(wmLogo);

      canvasEl.style.transform = savedTransform;
      svgRestores.forEach(fn => fn());

      const xml  = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([xml], { type: 'image/svg+xml' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = (currentFileName.replace(/\.[^.]+$/, '') || 'json-tree') + '-tree.svg';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch(err) {
      canvasEl.style.transform = savedTransform;
      svgRestores.forEach(fn => fn());
      alert('SVG export failed: ' + err.message);
    }
    btn.disabled = false; btn.textContent = '⬇ SVG';
  }, 30);
});
