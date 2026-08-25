'use strict';
/* ============================================================
   RANDOM PICKER
   Four picking modes sharing one choices list:
     wheel  — spinning wheel, uniform over choices
     dice   — 3D six-sided die (three.js), a true 1-in-6 per face
     slot   — 3-reel slot machine, pays out on ~75% of pulls
     galton — bean machine, deliberately NON-uniform (binomial)

   FAIRNESS RULE (wheel / dice / slot): the outcome is picked with
   Math.random() BEFORE any animation starts. The animation is then
   driven to land on that pre-chosen result — it never decides the
   outcome itself.

   NO-WIN RULE (slot / dice): these two modes can come up empty, like the
   machines they imitate.
     slot — SLOT_WIN_CHANCE of pulls land three of a kind and return a
       winner; the rest land a mismatched combination and return
       { noWin: true }. Which choice wins is still uniform: the payout
       roll only decides whether the pull pays at all.
     dice — the die is rolled honestly, every face 1/6. Face f picks
       choice f; with fewer than six choices the faces past the end of
       the list belong to nobody and return { noWin: true }.

   GALTON RULE: no picking upfront. Each row is a genuine fair coin
   flip (Math.random() < 0.5) as the ball falls, so the bin (and the
   distribution across many drops) is a real binomial(rows, 0.5)
   random walk, not a scripted shape.

   Every winning pick resolves to { index, name } so the winning line can
   be removed from the list afterwards even when names are duplicated; a
   slot pull that does not pay resolves to { noWin: true } instead.
   ============================================================ */

const $ = id => document.getElementById(id);
const SLOT_ITEM_H = 64; // must match .reel-item height in style.css

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

// ── EASING ───────────────────────────────────────────────────────────────
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeOutQuint(t) { return 1 - Math.pow(1 - t, 5); }
function smoothstep(t) { return t * t * (3 - 2 * t); }
// Overshoots ~1% just before settling, which is what gives the reels their
// mechanical snap-back at the end of a spin.
function easeOutBackSoft(t) { const c1 = 0.55, c3 = c1 + 1, u = t - 1; return 1 + c3 * u * u * u + c1 * u * u; }

function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ── STATE ────────────────────────────────────────────────────────────────
let currentMode = 'wheel';
let choices = [];
let animating = false;
let persistApi = null;
let lastPick = null; // { index, name } — drives the "remove from list" action

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
  $('galtonBatchBtn').disabled = animating || choices.length < 2;
}

// ── MODE SWITCHING ──────────────────────────────────────────────────────
const ACTION_LABEL = { wheel: 'Spin the wheel', dice: 'Roll the dice', slot: 'Pull the lever', galton: 'Drop the ball' };

function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-tab').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  document.querySelectorAll('.stage').forEach(s => s.classList.toggle('active', s.id === 'stage-' + mode));
  $('actionBtn').textContent = ACTION_LABEL[mode] || 'Go';
  $('diceWarning').classList.toggle('visible', mode === 'dice' && choices.length > 6);
  hideNoWinFlash();
  updateActionAvailability();
  // Canvases sized while hidden read back as 0, so refresh once visible.
  if (mode === 'dice') refreshDice();
  if (mode === 'galton') { invalidateGaltonBoard(); drawGaltonBoard(null); }
  if (mode === 'wheel') buildWheel();
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
    const mid = start + seg / 2;
    ctx.rotate(mid);
    // Flip labels on the left half so they never read upside down.
    const flipped = Math.cos(mid) < 0;
    if (flipped) { ctx.rotate(Math.PI); ctx.textAlign = 'left'; } else { ctx.textAlign = 'right'; }
    ctx.textBaseline = 'middle';
    ctx.fillStyle = contrastColor(color);
    ctx.font = `700 ${fontSize}px "DM Sans", sans-serif`;
    let label = choices[i];
    if (label.length > maxLen) label = label.slice(0, maxLen - 1) + '…';
    ctx.fillText(label, flipped ? -(r - 14) : r - 14, 0);
    ctx.restore();
  }
}

function spinWheel() {
  return new Promise(resolve => {
    const n = choices.length;
    const idx = Math.floor(Math.random() * n); // ← winner chosen first, uniformly
    const result = { index: idx, name: choices[idx] };
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
      resolve(result);
    }, { once: true });
  });
}

// ── DICE (three.js) ──────────────────────────────────────────────────────
/* BoxGeometry material order is [+X, -X, +Y, -Y, +Z, -Z].
   Faces are laid out so opposite sides sum to 7, like a real die. */
const DIE_FACE_ORDER = [1, 6, 2, 5, 3, 4];
const DIE_LOOK_Y = 0.6;
const DIE_HALF_DIAG = Math.sqrt(3); // a 2-unit cube on its corner needs this much room
let FACE_NORMAL = null; // built after THREE loads
let three = null;

// World-space half extents the camera can actually see at the die's plane, so
// the roll can be sized to the canvas instead of overshooting it.
function dieViewExtents() {
  const cam = three.camera;
  const dist = cam.position.distanceTo(new THREE.Vector3(0, DIE_LOOK_Y, 0));
  const halfH = dist * Math.tan((cam.fov * Math.PI / 180) / 2);
  return { halfW: halfH * cam.aspect, halfH };
}

function themeDieColors() {
  return {
    body: cssVar('--panel-raised') || '#ffffff',
    bevel: cssVar('--border') || '#e0e6f0',
    pip: cssVar('--negative-em') || '#e63939'
  };
}

function makeFaceTexture(pips, col) {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');

  g.fillStyle = col.bevel;
  g.fillRect(0, 0, S, S);
  roundRectPath(g, 9, 9, S - 18, S - 18, 42);
  g.fillStyle = col.body;
  g.fill();

  const sheen = g.createLinearGradient(0, 0, S, S);
  sheen.addColorStop(0, 'rgba(255,255,255,0.20)');
  sheen.addColorStop(0.55, 'rgba(255,255,255,0)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.10)');
  roundRectPath(g, 9, 9, S - 18, S - 18, 42);
  g.fillStyle = sheen;
  g.fill();

  const A = 0.27, M = 0.5, B = 0.73;
  const LAYOUT = {
    1: [[M, M]],
    2: [[A, A], [B, B]],
    3: [[A, A], [M, M], [B, B]],
    4: [[A, A], [B, A], [A, B], [B, B]],
    5: [[A, A], [B, A], [M, M], [A, B], [B, B]],
    6: [[A, A], [B, A], [A, M], [B, M], [A, B], [B, B]]
  };
  const r = S * 0.076;
  (LAYOUT[pips] || []).forEach(([px, py]) => {
    const x = px * S, y = py * S;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = col.pip; g.fill();
    const inner = g.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.12, x, y, r);
    inner.addColorStop(0, 'rgba(0,0,0,0.30)');
    inner.addColorStop(1, 'rgba(0,0,0,0)');
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = inner; g.fill();
  });

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
  return tex;
}

function makeShadowTexture() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.40)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.17)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}

function applyDieTextures() {
  if (!three) return;
  const col = themeDieColors();
  if (Array.isArray(three.die.material)) {
    three.die.material.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
  }
  three.die.material = DIE_FACE_ORDER.map(face => new THREE.MeshStandardMaterial({
    map: makeFaceTexture(face, col),
    roughness: 0.42,
    metalness: 0.04
  }));
}

function initThree() {
  if (typeof THREE === 'undefined') {
    $('diceFallback').hidden = false;
    $('diceCanvas').style.display = 'none';
    return null;
  }
  FACE_NORMAL = {
    1: new THREE.Vector3(1, 0, 0), 6: new THREE.Vector3(-1, 0, 0),
    2: new THREE.Vector3(0, 1, 0), 5: new THREE.Vector3(0, -1, 0),
    3: new THREE.Vector3(0, 0, 1), 4: new THREE.Vector3(0, 0, -1)
  };

  const canvas = $('diceCanvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  if (THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 2.1, 7.2);
  camera.lookAt(0, DIE_LOOK_Y, 0); // resting die sits low in frame, leaving headroom for the bounce

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(3.5, 6.5, 4.5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.3);
  fill.position.set(-4.5, 2, -3);
  scene.add(fill);

  const die = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), []);
  scene.add(die);

  // Soft contact shadow. A real shadow map reads as a hard wedge at this
  // shallow camera angle, so the blob is both prettier and cheaper.
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 4.4),
    new THREE.MeshBasicMaterial({ map: makeShadowTexture(), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.0;
  scene.add(shadow);

  return { renderer, scene, camera, die, shadow };
}

function refreshDice() {
  if (!three) return;
  const wrap = $('diceScene');
  const w = wrap.clientWidth || 340;
  const h = wrap.clientHeight || 300;
  three.renderer.setSize(w, h, false);
  three.camera.aspect = w / h;
  three.camera.updateProjectionMatrix();
  three.renderer.render(three.scene, three.camera);
}

/* The legend is the face map, so it always shows all six faces: the ones
   past the end of the list are the rolls that pick nobody. */
function buildDiceLegend() {
  const el = $('diceLegend');
  el.innerHTML = '';
  const n = Math.min(choices.length, 6);
  for (let f = 1; f <= 6; f++) {
    const mapped = f <= n;
    const item = document.createElement('span');
    item.className = 'leg-item' + (mapped ? '' : ' leg-empty');
    item.dataset.face = String(f);
    const face = document.createElement('span');
    face.className = 'leg-face';
    face.textContent = String(f);
    item.appendChild(face);
    item.appendChild(document.createTextNode(' ' + (mapped ? choices[f - 1] : 'nobody')));
    el.appendChild(item);
  }
  const odds = $('diceOdds');
  if (odds) {
    odds.textContent = n >= 6
      ? 'All six faces hold a choice, so every roll picks someone.'
      : `${n} of the 6 faces hold a choice, so ${6 - n} in 6 rolls pick nobody.`;
  }
}

// Shadow tightens and darkens as the die drops back towards the table.
function updateDieShadow() {
  if (!three || !three.shadow) return;
  const k = Math.max(0, 1 - three.die.position.y / 3);
  three.shadow.position.x = three.die.position.x;
  three.shadow.scale.setScalar(0.72 + 0.4 * k);
  three.shadow.material.opacity = 0.3 + 0.7 * k;
}

// Die rests at y = 0; the bounce curve starts high and decays to the table.
function dieBounceY(t, amp) {
  return Math.abs(Math.cos(Math.PI * t * 3.2)) * amp * Math.pow(1 - t, 1.7);
}

function rollDice() {
  return new Promise(resolve => {
    const n = Math.min(choices.length, 6);
    const face = 1 + Math.floor(Math.random() * 6); // ← an honest d6, every face 1/6
    const idx = face <= n ? face - 1 : -1;          // faces past the list belong to nobody
    const result = idx >= 0 ? { index: idx, name: choices[idx] } : { noWin: true, face };
    if (!three) { resolve(result); return; }

    const die = three.die;
    const qStart = die.quaternion.clone();
    // Rotation that brings the winning face's normal to +Z, straight at the camera.
    const align = new THREE.Quaternion().setFromUnitVectors(FACE_NORMAL[face], new THREE.Vector3(0, 0, 1));
    const spinZ = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1), Math.floor(Math.random() * 4) * Math.PI / 2);
    const qEnd = new THREE.Quaternion().multiplyQuaternions(spinZ, align);

    const axis = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
    const turns = 3 + Math.floor(Math.random() * 2);
    const dur = 2200;
    // Keep the whole tumble inside the canvas, whatever the stage is sized to.
    const view = dieViewExtents();
    const travel = Math.max(0.7, Math.min(2.4, view.halfW - DIE_HALF_DIAG - 0.25));
    const startX = -(travel * (0.78 + Math.random() * 0.22));
    const amp = Math.max(0.5, Math.min(1.5, DIE_LOOK_Y + view.halfH - DIE_HALF_DIAG - 0.25));
    const t0 = performance.now();
    const qSlerp = new THREE.Quaternion(), qTumble = new THREE.Quaternion();

    function frame(now) {
      const t = Math.min(1, (now - t0) / dur);
      const e = easeOutQuint(t);
      // Slerp toward the target while an extra tumble unwinds to exactly zero,
      // so the die always settles on the pre-chosen face.
      qSlerp.copy(qStart).slerp(qEnd, e);
      qTumble.setFromAxisAngle(axis, turns * Math.PI * 2 * (1 - e));
      die.quaternion.multiplyQuaternions(qSlerp, qTumble);
      die.position.x = startX * (1 - easeOutCubic(t));
      die.position.y = dieBounceY(t, amp);
      updateDieShadow();
      three.renderer.render(three.scene, three.camera);
      if (t < 1) requestAnimationFrame(frame);
      else {
        die.position.x = 0; die.position.y = 0;
        die.quaternion.copy(qEnd);
        updateDieShadow();
        three.renderer.render(three.scene, three.camera);
        document.querySelectorAll('#diceLegend .leg-item').forEach(el => {
          el.classList.toggle('hit', el.dataset.face === String(face));
        });
        resolve(result);
      }
    }
    requestAnimationFrame(frame);
  });
}

// ── SLOT MACHINE ─────────────────────────────────────────────────────────
/* Reels are driven by one requestAnimationFrame loop: accelerate, cruise
   with a motion blur, then decelerate onto a position computed from the
   pre-chosen winner. */
const SLOT_V_MAX = 2900;  // px/s
const SLOT_ACCEL = 11000; // px/s²
const slotReels = [];

function shuffledIndices(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* PAYOUT ODDS. 75/25 is the balance point: a quarter of pulls coming up empty
   is often enough that the machine feels like a machine and a win feels earned,
   while still resolving most decisions on the first pull. 80/20 makes losses
   forgettable; 70/30 starts to feel like the tool is stalling you. */
const SLOT_WIN_CHANCE = 0.75;
const SLOT_NEAR_MISS_SHARE = 0.6; // of the no-win pulls, how many show two of a kind
const SLOT_LAST_REEL_ODD = 0.7;   // of those near misses, how many break on reel 3

// Choice indices grouped by the text they display. A losing payline has to look
// wrong on screen, not just differ by index, and duplicate lines are allowed.
function nameGroups() {
  const groups = new Map();
  choices.forEach((c, i) => {
    if (!groups.has(c)) groups.set(c, []);
    groups.get(c).push(i);
  });
  return [...groups.values()];
}

function pickFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* Decides the pull before the reels move: either a winning choice index, or the
   three indices the reels should land on for a combination that does not pay. */
function planSlotPull() {
  const winner = { win: true, index: Math.floor(Math.random() * choices.length) };
  if (Math.random() < SLOT_WIN_CHANCE) return winner;

  const groups = nameGroups();
  // With fewer than two distinct labels every payline reads as three of a kind,
  // so a "no match" would just look broken. Pay out instead.
  if (groups.length < 2) return winner;

  const pool = shuffledIndices(groups.length).map(g => groups[g]);
  if (groups.length < 3 || Math.random() < SLOT_NEAR_MISS_SHARE) {
    // Near miss: two of a kind, the odd symbol usually on the last reel to stop.
    const pair = pickFrom(pool[0]);
    const odd = pickFrom(pool[1]);
    const combo = [pair, pair, pair];
    combo[Math.random() < SLOT_LAST_REEL_ODD ? 2 : Math.floor(Math.random() * 2)] = odd;
    return { win: false, combo };
  }
  return { win: false, combo: [pickFrom(pool[0]), pickFrom(pool[1]), pickFrom(pool[2])] };
}

function initSlotReels() {
  for (let r = 0; r < 3; r++) {
    slotReels[r] = {
      el: $('reel' + r),
      strip: document.querySelector('#reel' + r + ' .reel-strip'),
      pos: 0, vel: 0, loopLen: 0, state: 'idle', order: [],
      from: 0, to: 0, t0: 0, stopDelay: 0, stopDur: 0
    };
  }
}

function applyReel(R) {
  const off = R.loopLen ? -(((R.pos % R.loopLen) + R.loopLen) % R.loopLen) : 0;
  R.strip.style.transform = `translate3d(0,${off}px,0)`;
  const b = Math.min(7, Math.abs(R.vel) / 420);
  R.strip.style.filter = b > 0.25 ? `blur(${b.toFixed(2)}px)` : 'none';
}

function buildSlotStrips() {
  const n = choices.length;
  slotReels.forEach((R, i) => {
    R.strip.innerHTML = '';
    R.vel = 0;
    R.state = 'idle';
    if (n === 0) {
      R.loopLen = 0;
      const d = document.createElement('div');
      d.className = 'reel-item'; d.textContent = '—';
      R.strip.appendChild(d);
      applyReel(R);
      return;
    }
    // Each reel gets its own symbol order so the three columns do not read as
    // one duplicated strip. R.order[j] is the choice index shown at strip slot j.
    R.order = shuffledIndices(n);
    const reps = Math.max(2, Math.ceil((n + 6) / n) + 1);
    for (let k = 0; k < reps; k++) {
      for (let j = 0; j < n; j++) {
        const d = document.createElement('div');
        d.className = 'reel-item';
        d.textContent = choices[R.order[j]];
        R.strip.appendChild(d);
      }
    }
    R.loopLen = n * SLOT_ITEM_H;
    R.pos = ((i * 2 + 1) * SLOT_ITEM_H) % R.loopLen; // stagger the idle offsets
    applyReel(R);
  });
}

function pullLever() {
  const lever = $('slotLever');
  lever.classList.add('pulled');
  setTimeout(() => lever.classList.remove('pulled'), 210);
}

function spinSlot() {
  return new Promise(resolve => {
    const n = choices.length;
    const plan = planSlotPull(); // ← outcome chosen first, before anything moves
    const combo = plan.win ? [plan.index, plan.index, plan.index] : plan.combo;
    const result = plan.win ? { index: plan.index, name: choices[plan.index] } : { noWin: true };
    // Strip slot j sits on the payline when (pos mod loopLen) === (j - 1) * itemH,
    // so each reel stops at the slot where its own order holds its target symbol.
    slotReels.forEach((R, i) => {
      const j = Math.max(0, R.order.indexOf(combo[i]));
      R.targetMod = (((j - 1) % n) + n) % n * SLOT_ITEM_H;
    });

    pullLever();

    const stopDelays = [1100, 1600, 2100];
    const stopDurs = [780, 840, 920];
    const t0 = performance.now();
    let last = t0, done = 0;

    slotReels.forEach((R, i) => {
      R.state = 'accel';
      R.vel = 0;
      R.stopDelay = stopDelays[i];
      R.stopDur = stopDurs[i];
    });

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const elapsed = now - t0;

      slotReels.forEach(R => {
        if (R.state === 'accel') {
          R.vel = Math.min(SLOT_V_MAX, R.vel + SLOT_ACCEL * dt);
          R.pos += R.vel * dt;
          if (R.vel >= SLOT_V_MAX) R.state = 'cruise';
        } else if (R.state === 'cruise') {
          R.pos += R.vel * dt;
          if (elapsed >= R.stopDelay) {
            const cur = R.pos;
            let P = Math.ceil(cur / R.loopLen) * R.loopLen + 2 * R.loopLen + R.targetMod;
            const minTravel = R.vel * (R.stopDur / 1000) * 0.55;
            while (P < cur + minTravel) P += R.loopLen;
            R.from = cur; R.to = P; R.t0 = now; R.state = 'stopping';
          }
        } else if (R.state === 'stopping') {
          const t = Math.min(1, (now - R.t0) / R.stopDur);
          const prev = R.pos;
          R.pos = R.from + (R.to - R.from) * easeOutBackSoft(t);
          R.vel = (R.pos - prev) / Math.max(dt, 1e-4);
          if (t >= 1) {
            R.pos = R.to; R.vel = 0; R.state = 'done';
            R.el.classList.add('landed');
            setTimeout(() => R.el.classList.remove('landed'), 300);
            done++;
          }
        }
        applyReel(R);
      });

      if (done < 3) requestAnimationFrame(frame);
      else resolve(result);
    }
    requestAnimationFrame(frame);
  });
}

$('slotLever').addEventListener('click', () => { if (currentMode === 'slot') onAction(); });
$('slotLever').addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && currentMode === 'slot') { e.preventDefault(); onAction(); }
});

// ── GALTON BOARD ─────────────────────────────────────────────────────────
let galtonCounts = [];
let lastGaltonKey = '';
let boardCanvas = null;
let boardDirty = true;
let galtonSkip = false; // set by the skip button to fast forward a falling ball

function invalidateGaltonBoard() { boardDirty = true; }

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

// The pegs, bars and labels only change when the data does, so they are
// rendered once into an offscreen canvas and blitted each frame.
function renderGaltonStatic() {
  const canvas = $('galtonCanvas');
  const { cssW, cssH, dpr } = sizeCanvasForDPR(canvas);
  if (!boardCanvas) boardCanvas = document.createElement('canvas');
  boardCanvas.width = canvas.width;
  boardCanvas.height = canvas.height;
  const ctx = boardCanvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const muted = cssVar('--muted'), border = cssVar('--border'), text = cssVar('--text');

  if (choices.length < 2) {
    ctx.fillStyle = muted || '#888';
    ctx.font = '600 14px "DM Sans", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Add at least 2 choices to build the board', cssW / 2, cssH / 2);
    boardDirty = false;
    return;
  }

  const layout = galtonLayout();
  const { rows, slot, binTopY } = layout;

  // Pegs are the structure of the board, so they have to be legible: --border
  // sits almost on top of the board background in both themes, so they are
  // drawn in --muted with a --text rim to lift them off the panel.
  ctx.lineWidth = 1;
  for (let r = 0; r < rows; r++) {
    const y = layout.pegRowY(r);
    for (let j = 0; j <= r; j++) {
      ctx.beginPath(); ctx.arc(layout.pegX(r, j), y, 3.8, 0, Math.PI * 2);
      ctx.fillStyle = muted || '#888';
      ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = text || '#222';
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

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
  boardDirty = false;
}

// Takes a single { x, y } ball, an array of them (batch drops), or null.
function drawGaltonBoard(balls) {
  const canvas = $('galtonCanvas');
  const { dpr } = sizeCanvasForDPR(canvas);
  if (boardDirty || !boardCanvas || boardCanvas.width !== canvas.width || boardCanvas.height !== canvas.height) {
    renderGaltonStatic();
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(boardCanvas, 0, 0);

  const list = !balls ? [] : (Array.isArray(balls) ? balls : [balls]);
  if (list.length) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // --accent3 is a pale pink in the light theme and vanishes on the board,
    // so the ball uses the same red the dice pips do.
    ctx.fillStyle = cssVar('--negative-em') || '#FF8B8B';
    ctx.strokeStyle = 'rgba(0,0,0,.28)';
    ctx.lineWidth = 1;
    for (const p of list) {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r || 6.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
}

function buildGalton() {
  const key = String(choices.length);
  if (key !== lastGaltonKey) {
    lastGaltonKey = key;
    galtonCounts = new Array(Math.max(1, choices.length)).fill(0);
  }
  invalidateGaltonBoard();
  drawGaltonBoard(null);
}

// One fair coin flip per peg row, walked ahead of time so the animation only
// has to replay a path it cannot influence.
function planGaltonPath(layout) {
  const rows = layout.rows;
  const stops = [];
  let s = 0;
  for (let r = 0; r < rows; r++) {
    stops.push({ x: layout.pegX(r, s), y: layout.pegRowY(r) });
    if (Math.random() < 0.5) s += 1; // ← genuine fair coin flip at this peg row
  }
  stops.push({ x: layout.pegX(rows, s), y: layout.binTopY + 4 });
  return { stops, slot: s };
}

// Linear vertical travel plus a sine arc: the ball keeps its momentum through
// every peg instead of easing to a stop at each one.
function ballPositionAt(stops, start, t, hop, lastHop, arc, radius) {
  let from = start;
  let acc = 0;
  for (let i = 0; i < stops.length; i++) {
    const isLast = i === stops.length - 1;
    const dur = isLast ? lastHop : hop;
    if (t < acc + dur || isLast) {
      const p = Math.max(0, Math.min(1, (t - acc) / dur));
      const to = stops[i];
      return {
        x: from.x + (to.x - from.x) * smoothstep(p),
        y: from.y + (to.y - from.y) * p - Math.sin(Math.PI * p) * (isLast ? 0 : arc),
        r: radius
      };
    }
    acc += dur;
    from = stops[i];
  }
  return { x: stops[stops.length - 1].x, y: stops[stops.length - 1].y, r: radius };
}

// Every ball in flight shares one rAF loop, so twenty of them cost the same
// per frame as one. A ball is only counted once it actually reaches its bin.
function animateGaltonDrops(balls, layout, hop, radius) {
  const start = { x: layout.centerX, y: layout.marginTop - 24 };
  const arc = layout.stepY * 0.3;
  const lastHop = hop * 1.3;
  for (const b of balls) b.duration = (b.stops.length - 1) * hop + lastHop;

  function land(b) {
    if (b.landed) return;
    b.landed = true;
    galtonCounts[b.slot] = (galtonCounts[b.slot] || 0) + 1;
    invalidateGaltonBoard();
  }

  return new Promise(resolve => {
    const t0 = performance.now();
    function frame(now) {
      // Skip credits every ball still in the air, so the tally stays right.
      if (galtonSkip) { balls.forEach(land); drawGaltonBoard(null); resolve(); return; }
      const elapsed = now - t0;
      const inFlight = [];
      let done = true;
      for (const b of balls) {
        const t = elapsed - b.delay;
        if (t < 0) { done = false; continue; }      // not launched yet
        if (t >= b.duration) { land(b); continue; } // arrived
        done = false;
        inFlight.push(ballPositionAt(b.stops, start, t, hop, lastHop, arc, radius));
      }
      drawGaltonBoard(inFlight);
      if (done) resolve();
      else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}

// True per-peg random walk: one fair coin flip per row, no shortcuts.
async function dropGaltonBall() {
  if (choices.length < 2) return null;
  const layout = galtonLayout();

  galtonSkip = false;
  $('galtonSkipBtn').hidden = false;

  const path = planGaltonPath(layout);
  const ball = { stops: path.stops, slot: path.slot, delay: 0, landed: false };
  await animateGaltonDrops([ball], layout, Math.max(90, 200 - layout.rows * 6), 6.5);

  $('galtonSkipBtn').hidden = true;
  galtonSkip = false;
  drawGaltonBoard(null);
  return { index: ball.slot, name: choices[ball.slot] };
}

// Removing by index alone would delete the wrong line if the list moved on,
// so confirm the name still matches before touching it.
function resolveRemovalIndex(pick) {
  if (!pick) return -1;
  if (choices[pick.index] === pick.name) return pick.index;
  return choices.indexOf(pick.name);
}

// Batch drop for building up the distribution — same per-row coin flip as a
// single drop, just poured in as a staggered stream instead of one ball.
// Nothing is picked here: a batch fills the histogram, it names no winner.
async function dropGaltonBatch(n) {
  if (choices.length < 2) return;
  const layout = galtonLayout();
  const hop = Math.max(70, 150 - layout.rows * 5);
  const stagger = Math.max(45, hop * 0.55);

  const balls = [];
  for (let i = 0; i < n; i++) {
    const path = planGaltonPath(layout);
    balls.push({ stops: path.stops, slot: path.slot, delay: i * stagger, landed: false });
  }

  galtonSkip = false;
  $('galtonSkipBtn').hidden = false;
  await animateGaltonDrops(balls, layout, hop, 5.4);
  $('galtonSkipBtn').hidden = true;
  galtonSkip = false;
  drawGaltonBoard(null);
}

$('galtonSkipBtn').addEventListener('click', () => { galtonSkip = true; });

$('galtonBatchBtn').addEventListener('click', async () => {
  if (animating || choices.length < 2) return;
  const btn = $('galtonBatchBtn');
  const label = btn.textContent;
  animating = true;
  btn.textContent = 'Dropping…';
  // Locked while balls fall: an edit mid-drop would rebuild the board under
  // them and land them in bins that no longer match their path.
  $('choicesInput').readOnly = true;
  updateActionAvailability();
  try {
    await dropGaltonBatch(20);
  } finally {
    animating = false;
    btn.textContent = label;
    $('choicesInput').readOnly = false;
    updateActionAvailability();
  }
});

// ── HISTORY (session only, not persisted) ───────────────────────────────
let historyArr = [];
const MODE_ICON = { wheel: '🎡', dice: '🎲', slot: '🎰', galton: '⚪' };

function addHistory(mode, name, noWin) {
  historyArr.unshift({ mode, name, noWin: !!noWin });
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
    row.className = 'history-item' + (h.noWin ? ' no-win' : '');
    const icon = document.createElement('span'); icon.className = 'h-icon'; icon.textContent = h.noWin ? '➖' : (MODE_ICON[h.mode] || '🎯');
    const name = document.createElement('span'); name.className = 'h-name'; name.textContent = h.name;
    const num = document.createElement('span'); num.className = 'h-n'; num.textContent = '#' + (historyArr.length - i);
    row.appendChild(icon); row.appendChild(name); row.appendChild(num);
    el.appendChild(row);
  });
}

// ── NO-WIN FEEDBACK (slot + dice) ────────────────────────────────────────
// A pull or roll that picks nobody gets a short slump of the machine and a
// message beside it, instead of the winner overlay.
const FLASH_IDS = ['slotFlash', 'diceFlash'];
const flashTimers = {};

function hideNoWinFlash() {
  FLASH_IDS.forEach(id => {
    clearTimeout(flashTimers[id]);
    const flash = $(id);
    if (!flash) return;
    flash.classList.remove('show');
    flash.hidden = true;
  });
}

function flashNoWin(id, message) {
  const flash = $(id);
  if (!flash) return;
  clearTimeout(flashTimers[id]);
  flash.textContent = message;
  flash.hidden = false;
  flash.classList.remove('show');
  void flash.offsetWidth; // restart the fade-in when two misses land in a row
  flash.classList.add('show');
  flashTimers[id] = setTimeout(hideNoWinFlash, 2800);
}

function slump(el, ms) {
  if (!el) return;
  el.classList.add('lose');
  setTimeout(() => el.classList.remove('lose'), ms);
}

function showNoWin(mode, res) {
  if (mode === 'slot') {
    slump(document.querySelector('.slot-cabinet'), 620);
    flashNoWin('slotFlash', 'No match — pull again');
  } else if (mode === 'dice') {
    slump($('diceScene'), 620);
    flashNoWin('diceFlash', `Rolled a ${res.face} — nobody on that face`);
  }
}

function noWinLabel(mode, res) {
  return mode === 'dice' ? `No winner (face ${res.face})` : 'No match';
}

// ── WINNER OVERLAY + CONFETTI ────────────────────────────────────────────
function showWinner(name) {
  $('winnerName').textContent = name;
  $('winnerOverlay').classList.add('open');
}
function closeWinner() { $('winnerOverlay').classList.remove('open'); }

$('winnerCloseBtn').addEventListener('click', closeWinner);
$('winnerOverlay').addEventListener('click', e => { if (e.target === $('winnerOverlay')) closeWinner(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeWinner(); });

// Removes the exact line that won, which matters when names are duplicated.
function removeChoiceAt(i) {
  if (i == null || i < 0 || i >= choices.length) return;
  const next = choices.slice();
  next.splice(i, 1);
  $('choicesInput').value = next.join('\n');
  recomputeAll();
  if (persistApi) persistApi.schedule();
}

$('winnerRemoveBtn').addEventListener('click', () => {
  if (animating || !lastPick) return;
  removeChoiceAt(resolveRemovalIndex(lastPick));
  lastPick = null;
  closeWinner();
});

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
  hideNoWinFlash();
  // Locked while spinning: a mid-animation edit would rebuild the reels and
  // desync them from the winner already chosen.
  $('choicesInput').readOnly = true;
  let res = null;
  try {
    if (currentMode === 'wheel') res = await spinWheel();
    else if (currentMode === 'dice') res = await rollDice();
    else if (currentMode === 'slot') res = await spinSlot();
    else if (currentMode === 'galton') res = await dropGaltonBall();
  } finally {
    animating = false;
    $('choicesInput').readOnly = false;
    updateActionAvailability();
  }

  if (res && res.noWin) {
    // The machine came up empty: no winner to show, nothing to remove.
    lastPick = null;
    addHistory(currentMode, noWinLabel(currentMode, res), true);
    showNoWin(currentMode, res);
  } else if (res) {
    lastPick = res;
    addHistory(currentMode, res.name);
    showWinner(res.name);
    burstConfetti();
    if (currentMode === 'slot') {
      const cab = document.querySelector('.slot-cabinet');
      cab.classList.add('win');
      setTimeout(() => cab.classList.remove('win'), 540);
    }
  }
}
$('actionBtn').addEventListener('click', onAction);

// ── THEME TOGGLE ─────────────────────────────────────────────────────────
$('themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('light');
  $('themeToggle').textContent = document.body.classList.contains('light') ? '🌙 Dark' : '☀️ Light';
  buildWheel();
  invalidateGaltonBoard();
  drawGaltonBoard(null);
  applyDieTextures();
  refreshDice();
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
  buildSlotStrips();
  buildGalton();
  if (currentMode === 'dice') refreshDice();
}
$('choicesInput').addEventListener('input', recomputeAll);

window.addEventListener('resize', debounce(() => {
  buildWheel();
  invalidateGaltonBoard();
  drawGaltonBoard(null);
  refreshDice();
}, 150));

// ── INIT ─────────────────────────────────────────────────────────────────
persistApi = Persist.init('randompicker', {
  extra: {
    save() { return { mode: currentMode }; },
    restore(ex) { if (ex && ex.mode) currentMode = ex.mode; }
  }
});
initSlotReels();
three = initThree();
applyDieTextures();
setMode(currentMode);
recomputeAll();
