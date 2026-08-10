'use strict';
/* ============================================================
   RANDOM PICKER
   Four picking modes sharing one choices list:
     wheel  — spinning wheel, uniform over choices
     dice   — 6-sided die, uniform, capped at 6 choices
     slot   — 3-reel slot machine, uniform over choices
     galton — bean machine, deliberately NON-uniform (binomial)

   FAIRNESS RULE (wheel / dice / slot): the winner is picked with
   Math.random() BEFORE any animation starts. The animation is then
   driven to land on that pre-chosen result — it never decides the
   outcome itself.

   GALTON RULE: no picking upfront. Each row is a genuine fair coin
   flip (Math.random() < 0.5) as the ball falls, so the bin (and the
   distribution across many drops) is a real binomial(rows, 0.5)
   random walk, not a scripted shape.
   ============================================================ */

const $ = id => document.getElementById(id);
const ITEM_H = 64; // must match .reel-item height in style.css

function cssVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}
function getPalette() {
  return ['--line-a', '--line-b', '--line-c', '--line-d', '--line-e', '--accent', '--accent2', '--accent3', '--gold']
    .map(cssVar)
    .filter(Boolean);
}
function contrastColor(hex) {
  hex = (hex || '').trim();
  let r, g, b;
  if (/^#([0-9a-f]{3})$/i.test(hex)) {
    const m = hex.slice(1);
    r = parseInt(m[0] + m[0], 16); g = parseInt(m[1] + m[1], 16); b = parseInt(m[2] + m[2], 16);
  } else if (/^#([0-9a-f]{6})$/i.test(hex)) {
    r = parseInt(hex.slice(1, 3), 16); g = parseInt(hex.slice(3, 5), 16); b = parseInt(hex.slice(5, 7), 16);
  } else {
    return '#0b1220';
  }
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#15202e' : '#ffffff';
}
function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
function sizeCanvasForDPR(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const cssW = rect.width || canvas.width;
  const cssH = rect.height || canvas.height;
  const w = Math.max(1, Math.round(cssW * dpr));
  const h = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  return { w, h, dpr, cssW, cssH };
}
function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

// ── STATE ────────────────────────────────────────────────────────────────
let currentMode = 'wheel';
let choices = [];
let animating = false;
let persistApi = null;

// ── CHOICES PARSING ─────────────────────────────────────────────────────
function parseChoices() {
  return $('choicesInput').value
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
}

function updateSidebarUI() {
  $('choiceCount').textContent = choices.length + (choices.length === 1 ? ' choice' : ' choices');
  $('choiceCount').classList.toggle('low', choices.length < 2);
  $('minWarning').classList.toggle('visible', choices.length < 2);

  const diceTab = document.querySelector('.mode-tab[data-mode="dice"]');
  const diceTooMany = choices.length > 6;
  diceTab.classList.toggle('mode-tab-disabled', diceTooMany);
  diceTab.title = diceTooMany ? 'Dice mode supports up to 6 choices only.' : '';
  $('diceWarning').classList.toggle('visible', currentMode === 'dice' && diceTooMany);

  if (currentMode === 'dice' && diceTooMany) {
    setMode('wheel');
    return;
  }
  updateActionAvailability();
}

function updateActionAvailability() {
  const btn = $('actionBtn');
  let disabled = animating;
  if (choices.length < 2) disabled = true;
  if (currentMode === 'dice' && choices.length > 6) disabled = true;
  btn.disabled = disabled;
}

// ── MODE SWITCHING ──────────────────────────────────────────────────────
const ACTION_LABEL = { wheel: 'Spin the wheel', dice: 'Roll the dice', slot: 'Pull the lever', galton: 'Drop the ball' };

function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-tab').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  document.querySelectorAll('.stage').forEach(s => s.classList.toggle('active', s.id === 'stage-' + mode));
  $('actionBtn').textContent = ACTION_LABEL[mode] || 'Go';
  $('diceWarning').classList.toggle('visible', mode === 'dice' && choices.length > 6);
  updateActionAvailability();
  if (persistApi) persistApi.schedule();
}

document.querySelectorAll('.mode-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    if (animating) return;
    if (btn.classList.contains('mode-tab-disabled')) return;
    setMode(btn.dataset.mode);
  });
});

// ── WHEEL ────────────────────────────────────────────────────────────────
let wheelRotation = 0;

function resetWheelRotation() {
  const c = $('wheelCanvas');
  c.style.transition = 'none';
  c.style.transform = 'rotate(0deg)';
  wheelRotation = 0;
}

function buildWheel() {
  const canvas = $('wheelCanvas');
  const { cssW, cssH } = sizeCanvasForDPR(canvas);
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const n = choices.length;
  const cx = cssW / 2, cy = cssH / 2, r = Math.min(cssW, cssH) / 2 - 4;

  if (n === 0) {
    ctx.fillStyle = cssVar('--input-bg') || '#eee';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = cssVar('--muted') || '#888';
    ctx.font = '600 14px "DM Sans", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Add choices to build the wheel', cx, cy);
    return;
  }

  const palette = getPalette();
  const seg = (Math.PI * 2) / n;
  const fontSize = Math.max(11, Math.min(18, 230 / n));
  const maxLen = n <= 8 ? 18 : (n <= 14 ? 12 : 8);

  for (let i = 0; i < n; i++) {
    const start = -Math.PI / 2 + i * seg;
    const end = start + seg;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    const color = palette[i % palette.length] || '#8DBBFF';
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = cssVar('--panel') || '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + seg / 2);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = contrastColor(color);
    ctx.font = `700 ${fontSize}px "DM Sans", sans-serif`;
    let label = choices[i];
    if (label.length > maxLen) label = label.slice(0, maxLen - 1) + '…';
    ctx.fillText(label, r - 14, 0);
    ctx.restore();
  }
}

function spinWheel() {
  return new Promise(resolve => {
    const n = choices.length;
    const idx = Math.floor(Math.random() * n); // ← winner chosen first, uniformly
    const seg = 360 / n;
    const canvas = $('wheelCanvas');

    const current = ((wheelRotation % 360) + 360) % 360;
    const jitter = (Math.random() * 2 - 1) * (seg * 0.32); // stay inside the segment
    let endMod = (360 - (idx + 0.5) * seg + jitter) % 360;
    if (endMod < 0) endMod += 360;
    let delta = ((endMod - current) % 360 + 360) % 360;
    const spins = 5 + Math.floor(Math.random() * 3); // 5–7 extra full turns
    const total = spins * 360 + delta;
    wheelRotation += total;

    canvas.style.transition = 'transform 4800ms cubic-bezier(.12,.67,.14,1)';
    canvas.style.transform = `rotate(${wheelRotation}deg)`;
    canvas.addEventListener('transitionend', function onEnd() {
      canvas.removeEventListener('transitionend', onEnd);
      resolve(choices[idx]);
    }, { once: true });
  });
}

// ── DICE ─────────────────────────────────────────────────────────────────
const FACE_ROT = { 1: { x: 0, y: 0 }, 2: { x: 0, y: -90 }, 3: { x: -90, y: 0 }, 4: { x: 90, y: 0 }, 5: { x: 0, y: 90 }, 6: { x: 0, y: 180 } };
let dieRotX = 0, dieRotY = 0;

function buildDiceLegend() {
  const el = $('diceLegend');
  el.innerHTML = '';
  const n = Math.min(choices.length, 6);
  for (let i = 0; i < n; i++) {
    const item = document.createElement('span');
    item.className = 'leg-item';
    const face = document.createElement('span');
    face.className = 'leg-face';
    face.textContent = String(i + 1);
    item.appendChild(face);
    item.appendChild(document.createTextNode(' ' + choices[i]));
    el.appendChild(item);
  }
}

function normDelta(target, current) { return ((target - current) % 360 + 360) % 360; }

function rollDice() {
  return new Promise(resolve => {
    const n = Math.min(choices.length, 6);
    const idx = Math.floor(Math.random() * n); // ← winner chosen first, uniformly
    const face = idx + 1;
    const base = FACE_ROT[face];

    const curX = ((dieRotX % 360) + 360) % 360;
    const curY = ((dieRotY % 360) + 360) % 360;
    const dX = normDelta(base.x, curX);
    const dY = normDelta(base.y, curY);
    const extraX = (2 + Math.floor(Math.random() * 2)) * 360;
    const extraY = (2 + Math.floor(Math.random() * 2)) * 360;
    dieRotX += extraX + dX;
    dieRotY += extraY + dY;

    const die = $('die');
    die.style.transform = `rotateX(${dieRotX}deg) rotateY(${dieRotY}deg)`;
    die.addEventListener('transitionend', function onEnd() {
      die.removeEventListener('transitionend', onEnd);
      resolve(choices[idx]);
    }, { once: true });
  });
}

// ── SLOT MACHINE ─────────────────────────────────────────────────────────
function buildIdleSlotReels() {
  for (let r = 0; r < 3; r++) {
    const strip = document.querySelector(`#reel${r} .reel-strip`);
    strip.style.transition = 'none';
    strip.innerHTML = '';
    if (choices.length === 0) {
      const d = document.createElement('div');
      d.className = 'reel-item'; d.textContent = '—';
      strip.appendChild(d);
      strip.style.transform = 'translateY(0px)';
      continue;
    }
    for (let i = 0; i < 5; i++) {
      const d = document.createElement('div');
      d.className = 'reel-item';
      d.textContent = choices[Math.floor(Math.random() * choices.length)];
      strip.appendChild(d);
    }
    strip.style.transform = `translateY(${-ITEM_H}px)`;
  }
}

function buildReelStrip(reelIndex, winner) {
  const strip = document.querySelector(`#reel${reelIndex} .reel-strip`);
  const total = 10 + reelIndex * 3;
  const targetIndex = total - 4 - reelIndex;
  strip.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const d = document.createElement('div');
    d.className = 'reel-item';
    d.textContent = (i === targetIndex) ? winner : choices[Math.floor(Math.random() * choices.length)];
    strip.appendChild(d);
  }
  const finalY = -(targetIndex - 1) * ITEM_H; // winner lands in the centre (payline) row
  return { strip, finalY };
}

function spinSlot() {
  return new Promise(resolve => {
    const n = choices.length;
    const idx = Math.floor(Math.random() * n); // ← winner chosen first, uniformly
    const winner = choices[idx];
    const durations = [1800, 2300, 2900];
    let doneCount = 0;

    for (let r = 0; r < 3; r++) {
      const { strip, finalY } = buildReelStrip(r, winner);
      strip.style.transition = 'none';
      strip.style.transform = 'translateY(0px)';
      // force reflow so the browser registers the reset before animating
      void strip.offsetHeight;
      strip.style.transition = `transform ${durations[r]}ms cubic-bezier(.16,.82,.2,1)`;
      requestAnimationFrame(() => { strip.style.transform = `translateY(${finalY}px)`; });
      strip.addEventListener('transitionend', function onEnd() {
        strip.removeEventListener('transitionend', onEnd);
        doneCount++;
        if (doneCount === 3) resolve(winner);
      }, { once: true });
    }

    const lever = $('slotLever');
    lever.classList.add('pulled');
    setTimeout(() => lever.classList.remove('pulled'), 380);
  });
}

// ── GALTON BOARD ─────────────────────────────────────────────────────────
let galtonCounts = [];
let lastGaltonKey = '';

function galtonLayout() {
  const canvas = $('galtonCanvas');
  const rect = canvas.getBoundingClientRect();
  const cssW = rect.width || 560;
  const cssH = rect.height || (cssW * 360 / 560);
  const rows = Math.max(1, choices.length - 1);
  const marginTop = 26;
  const marginBottom = 90;
  const boardH = Math.max(40, cssH - marginTop - marginBottom);
  const stepY = boardH / rows;
  const usableW = cssW - 50;
  const slot = usableW / rows;
  const centerX = cssW / 2;
  return {
    cssW, cssH, rows, marginTop, stepY, slot, centerX,
    pegX(r, s) { return centerX + (s - r / 2) * slot; },
    pegRowY(r) { return marginTop + r * stepY; },
    binTopY: marginTop + boardH + 24
  };
}

function drawGaltonBoard(ballPos) {
  const canvas = $('galtonCanvas');
  const { cssW, cssH, dpr } = sizeCanvasForDPR(canvas);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const muted = cssVar('--muted'), border = cssVar('--border'), text = cssVar('--text'), accent3 = cssVar('--accent3');

  if (choices.length < 2) {
    ctx.fillStyle = muted || '#888';
    ctx.font = '600 14px "DM Sans", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Add at least 2 choices to build the board', cssW / 2, cssH / 2);
    return;
  }

  const layout = galtonLayout();
  const { rows, slot, binTopY } = layout;

  // pegs
  ctx.fillStyle = border || '#ccc';
  for (let r = 0; r < rows; r++) {
    const y = layout.pegRowY(r);
    for (let j = 0; j <= r; j++) {
      const x = layout.pegX(r, j);
      ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2); ctx.fill();
    }
  }

  // histogram + bin labels
  const bins = rows + 1;
  const palette = getPalette();
  const maxCount = Math.max(1, ...galtonCounts);
  const barMaxH = 34;
  const maxLen = bins > 10 ? 6 : 10;

  for (let k = 0; k < bins; k++) {
    const x = layout.pegX(rows, k);
    const bw = Math.max(9, slot * 0.7);
    const count = galtonCounts[k] || 0;
    const bh = Math.round((count / maxCount) * barMaxH);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = palette[k % palette.length] || '#8DBBFF';
    ctx.fillRect(x - bw / 2, binTopY + (barMaxH - bh), bw, bh);
    ctx.globalAlpha = 1;

    if (count > 0) {
      ctx.fillStyle = text || '#222';
      ctx.font = '700 10px "DM Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(String(count), x, binTopY + (barMaxH - bh) - 2);
    }

    ctx.save();
    ctx.translate(x, binTopY + barMaxH + 13);
    if (bins > 8) ctx.rotate(-Math.PI / 5);
    ctx.fillStyle = muted || '#888';
    ctx.font = '600 10px "DM Sans", sans-serif'; ctx.textAlign = bins > 8 ? 'right' : 'center'; ctx.textBaseline = 'top';
    let label = choices[k];
    if (label.length > maxLen) label = label.slice(0, maxLen - 1) + '…';
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  ctx.strokeStyle = border || '#ccc';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(16, binTopY - 1); ctx.lineTo(cssW - 16, binTopY - 1); ctx.stroke();

  if (ballPos) {
    ctx.fillStyle = accent3 || '#FF8B8B';
    ctx.beginPath(); ctx.arc(ballPos.x, ballPos.y, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1; ctx.stroke();
  }
}

function buildGalton() {
  const key = String(choices.length);
  if (key !== lastGaltonKey) {
    lastGaltonKey = key;
    galtonCounts = new Array(Math.max(1, choices.length)).fill(0);
  }
  drawGaltonBoard(null);
}

function animateBall(fromX, fromY, toX, toY, duration) {
  return new Promise(resolve => {
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const e = easeInOutCubic(t);
      drawGaltonBoard({ x: fromX + (toX - fromX) * e, y: fromY + (toY - fromY) * e });
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

// True per-peg random walk: one fair coin flip per row, no shortcuts.
async function dropGaltonBall() {
  if (choices.length < 2) return null;
  const layout = galtonLayout();
  const rows = layout.rows;
  let s = 0;
  let curX = layout.centerX, curY = layout.marginTop - 18;
  drawGaltonBoard({ x: curX, y: curY });

  for (let r = 0; r < rows; r++) {
    const toX = layout.pegX(r, s), toY = layout.pegRowY(r);
    await animateBall(curX, curY, toX, toY, Math.max(110, 240 - rows * 5));
    curX = toX; curY = toY;
    if (Math.random() < 0.5) s += 1; // ← genuine fair coin flip at this peg row
  }

  const bx = layout.pegX(rows, s), by = layout.binTopY + 4;
  await animateBall(curX, curY, bx, by, 260);
  galtonCounts[s] = (galtonCounts[s] || 0) + 1;
  drawGaltonBoard(null);
  return choices[s];
}

// Fast batch drop for building up the distribution — same per-row coin flip,
// just without the per-frame animation.
async function dropGaltonBatch(n) {
  if (choices.length < 2) return;
  const rows = choices.length - 1;
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let r = 0; r < rows; r++) { if (Math.random() < 0.5) s++; }
    galtonCounts[s] = (galtonCounts[s] || 0) + 1;
  }
  drawGaltonBoard(null);
}

$('galtonBatchBtn').addEventListener('click', async () => {
  if (animating || choices.length < 2) return;
  const btn = $('galtonBatchBtn');
  btn.disabled = true;
  await dropGaltonBatch(20);
  btn.disabled = false;
});

// ── HISTORY (session only, not persisted) ───────────────────────────────
let historyArr = [];
const MODE_ICON = { wheel: '🎡', dice: '🎲', slot: '🎰', galton: '⚪' };

function addHistory(mode, name) {
  historyArr.unshift({ mode, name });
  if (historyArr.length > 60) historyArr.length = 60;
  renderHistory();
}
function renderHistory() {
  const el = $('historyList');
  el.innerHTML = '';
  if (historyArr.length === 0) {
    el.innerHTML = '<div class="history-empty">No picks yet.</div>';
    return;
  }
  historyArr.slice(0, 30).forEach((h, i) => {
    const row = document.createElement('div');
    row.className = 'history-item';
    const icon = document.createElement('span'); icon.className = 'h-icon'; icon.textContent = MODE_ICON[h.mode] || '🎯';
    const name = document.createElement('span'); name.className = 'h-name'; name.textContent = h.name;
    const num = document.createElement('span'); num.className = 'h-n'; num.textContent = '#' + (historyArr.length - i);
    row.appendChild(icon); row.appendChild(name); row.appendChild(num);
    el.appendChild(row);
  });
}

// ── WINNER OVERLAY + CONFETTI ────────────────────────────────────────────
function showWinner(name) {
  $('winnerName').textContent = name;
  $('winnerOverlay').classList.add('open');
}
$('winnerCloseBtn').addEventListener('click', () => $('winnerOverlay').classList.remove('open'));
$('winnerOverlay').addEventListener('click', e => { if (e.target === $('winnerOverlay')) $('winnerOverlay').classList.remove('open'); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('winnerOverlay').classList.remove('open'); });

function burstConfetti() {
  const canvas = $('confettiCanvas');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const colors = getPalette();
  const particles = [];
  for (let i = 0; i < 110; i++) {
    particles.push({
      x: innerWidth / 2 + (Math.random() - 0.5) * 160,
      y: innerHeight * 0.32 + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 9,
      vy: -(Math.random() * 9 + 4),
      g: 0.26 + Math.random() * 0.14,
      size: 5 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)] || '#8DBBFF',
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.34,
      life: 0,
      maxLife: 100 + Math.random() * 44
    });
  }

  function frame() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    let alive = false;
    particles.forEach(p => {
      if (p.life >= p.maxLife) return;
      alive = true;
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life++;
      const alpha = Math.max(0, 1 - p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });
    if (alive) requestAnimationFrame(frame);
    else { canvas.style.display = 'none'; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }
  requestAnimationFrame(frame);
}

// ── MAIN ACTION ──────────────────────────────────────────────────────────
async function onAction() {
  if (animating || choices.length < 2) return;
  if (currentMode === 'dice' && choices.length > 6) return;

  animating = true;
  $('actionBtn').disabled = true;
  let winner = null;
  try {
    if (currentMode === 'wheel') winner = await spinWheel();
    else if (currentMode === 'dice') winner = await rollDice();
    else if (currentMode === 'slot') winner = await spinSlot();
    else if (currentMode === 'galton') winner = await dropGaltonBall();
  } finally {
    animating = false;
    updateActionAvailability();
  }

  if (winner != null) {
    addHistory(currentMode, winner);
    showWinner(winner);
    burstConfetti();
    if (currentMode === 'slot') {
      const w = document.querySelector('.slot-window');
      w.classList.add('win');
      setTimeout(() => w.classList.remove('win'), 480);
    }
  }
}
$('actionBtn').addEventListener('click', onAction);

// ── THEME TOGGLE ─────────────────────────────────────────────────────────
$('themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('light');
  $('themeToggle').textContent = document.body.classList.contains('light') ? '🌙 Dark' : '☀️ Light';
  buildWheel();
  drawGaltonBoard(null);
});

// ── RECOMPUTE ON CHOICE EDITS ────────────────────────────────────────────
function recomputeAll() {
  choices = parseChoices();
  updateSidebarUI();
  if (!animating) {
    resetWheelRotation();
    buildWheel();
  }
  buildDiceLegend();
  buildIdleSlotReels();
  buildGalton();
}
$('choicesInput').addEventListener('input', recomputeAll);

window.addEventListener('resize', debounce(() => { buildWheel(); drawGaltonBoard(null); }, 150));

// ── INIT ─────────────────────────────────────────────────────────────────
persistApi = Persist.init('randompicker', {
  extra: {
    save() { return { mode: currentMode }; },
    restore(ex) { if (ex && ex.mode) currentMode = ex.mode; }
  }
});
setMode(currentMode);
recomputeAll();
