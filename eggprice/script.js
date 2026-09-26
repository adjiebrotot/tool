'use strict';
/* ============================================================
   EGG PRICE — script.js
   The table holds the packs. Every edit reruns EggMath (eggmath.js)
   for each pack and redraws three things:
     • the 3D eggs, to scale against each other and cut open, with the
       shell and egg cost of each pack under its egg
     • the maths for the selected egg: its profile, the volume slices,
       and the chain from pack weight to shell weight
     • the computed columns of the table
   One recompute is well under a millisecond, so there is no Simulate
   button: the page follows the table as you type.
   ============================================================ */

const $ = id => document.getElementById(id);
const M = window.EggMath;
const SHOW_T = 4;          // shell drawn this many times thicker than it is, or it would be a hairline
const COL_MIN = 150;       // px per egg column before the stage scrolls sideways
const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

const DEFAULT_ROWS = [
  { name: 'Medium',      eggs: 12, grams: 500, price: 4.9 },
  { name: 'Large',       eggs: 12, grams: 600, price: 6 },
  { name: 'Extra Large', eggs: 12, grams: 700, price: 7.2 },
  { name: 'Jumbo',       eggs: 12, grams: 800, price: 8.05 },
];

let rows = DEFAULT_ROWS.map(r => ({ ...r }));
let sel = -1;              // selected row for the maths panel; -1 follows the best buy
let packs = [], best = -1;
let persist = null;

const cssVar = n => getComputedStyle(document.body).getPropertyValue(n).trim();
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = {
  money: v => '$' + v.toFixed(2),
  perG: v => isFinite(v) ? '$' + v.toFixed(4) : '—',
  num: (v, d) => Number(v).toLocaleString('en-AU', { minimumFractionDigits: d, maximumFractionDigits: d }),
  pct: (v, d = 1) => (v * 100).toFixed(d) + '%',
};
const num = v => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : NaN; };

// ── COMPUTE ──────────────────────────────────────────────────────────────
function compute() {
  packs = rows.map(r => M.pack({ eggs: num(r.eggs), grams: num(r.grams), price: num(r.price) }));
  best = -1;
  packs.forEach((p, i) => { if (p && isFinite(p.netPerG) && (best < 0 || p.netPerG < packs[best].netPerG)) best = i; });
}
const selIndex = () => (sel >= 0 && sel < rows.length && packs[sel]) ? sel : best;

// ── TABLE ────────────────────────────────────────────────────────────────
function renderTable() {
  $('packBody').innerHTML = rows.map((r, i) => `
    <tr data-i="${i}">
      <td><input class="txt-input cell-name" data-k="name" value="${esc(r.name)}" aria-label="Size name"></td>
      <td><div class="currency-wrap cell-eggs"><input class="currency-input" data-k="eggs" type="text" inputmode="numeric" value="${esc(r.eggs)}" aria-label="Eggs in the pack"></div></td>
      <td><div class="currency-wrap"><input class="currency-input has-suffix" data-k="grams" type="text" inputmode="decimal" value="${esc(r.grams)}" aria-label="Pack weight in grams"><span class="suffix">g</span></div></td>
      <td><div class="currency-wrap"><span class="prefix">$</span><input class="currency-input" data-k="price" type="text" inputmode="decimal" value="${esc(r.price)}" aria-label="Pack price"></div></td>
      <td class="mono c-gross"></td>
      <td class="mono c-net"></td>
      <td><button class="row-del" title="Remove this size" aria-label="Remove this size"${rows.length < 2 ? ' disabled' : ''}>✕</button></td>
    </tr>`).join('');
  fillTable();
}
function fillTable() {
  $('packBody').querySelectorAll('tr').forEach(tr => {
    const i = +tr.dataset.i, p = packs[i];
    tr.querySelector('.c-gross').textContent = p ? fmt.perG(p.grossPerG) : '—';
    const net = tr.querySelector('.c-net');
    net.textContent = p ? fmt.perG(p.netPerG) : '—';
    net.classList.toggle('is-best', i === best);
    tr.classList.toggle('bad', !p);
  });
}
$('packBody').addEventListener('input', e => {
  const k = e.target.dataset.k, tr = e.target.closest('tr');
  if (!k || !tr) return;
  rows[+tr.dataset.i][k] = e.target.value;
  update();
});
$('packBody').addEventListener('click', e => {
  const b = e.target.closest('.row-del');
  if (!b || rows.length < 2) return;
  const i = +b.closest('tr').dataset.i;
  rows.splice(i, 1);
  if (sel === i) sel = -1; else if (sel > i) sel--;
  renderAll();
});
$('addBtn').addEventListener('click', () => {
  const last = rows[rows.length - 1] || DEFAULT_ROWS[1];
  rows.push({ name: 'Size ' + (rows.length + 1), eggs: last.eggs, grams: last.grams, price: last.price });
  renderAll();
  const inputs = $('packBody').querySelectorAll('.cell-name');
  const inp = inputs[inputs.length - 1];
  if (inp) { inp.focus(); inp.select(); }
});
$('resetBtn').addEventListener('click', () => {
  rows = DEFAULT_ROWS.map(r => ({ ...r }));
  sel = -1;
  renderAll();
});

// ── EGG CARDS (under each 3D egg) ────────────────────────────────────────
function renderCards() {
  const s = selIndex();
  $('eggCards').style.gridTemplateColumns = `repeat(${rows.length}, minmax(0, 1fr))`;
  $('eggCards').innerHTML = rows.map((r, i) => {
    const p = packs[i];
    if (!p) return `<div class="egg-card bad" data-i="${i}"><div class="ec-name">${esc(r.name || '—')}</div><div class="ec-sub">—</div></div>`;
    const shellPct = p.egg.shellShare * 100;
    const vsBest = best >= 0 && i !== best ? p.netPerG / packs[best].netPerG - 1 : 0;
    return `
      <div class="egg-card${i === best ? ' best' : ''}${i === s ? ' sel' : ''}" data-i="${i}" role="button" tabindex="0">
        ${i === best ? '<span class="badge badge-success ec-badge">Best buy</span>' : `<span class="delta negative ec-badge">▲ +${fmt.pct(vsBest)}</span>`}
        <div class="ec-name">${esc(r.name || 'Size ' + (i + 1))}</div>
        <div class="ec-sub mono">${fmt.num(p.eggs, 0)} × ${fmt.num(p.egg.W, 1)} g</div>
        <div class="ec-bar" aria-hidden="true"><span class="ec-bar-egg" style="flex:${100 - shellPct}"></span><span class="ec-bar-shell" style="flex:${shellPct}"></span></div>
        <div class="ec-row"><span class="sw sw-egg"></span><span>Egg</span><b class="mono">${fmt.money(p.contentCost)}</b></div>
        <div class="ec-row"><span class="sw sw-shell"></span><span>Shell</span><b class="mono">${fmt.money(p.shellCost)}</b></div>
        <div class="ec-net mono">${fmt.perG(p.netPerG)}<span>/g egg</span></div>
      </div>`;
  }).join('');
}
function pick(i) {
  if (!packs[i]) return;
  sel = i;
  renderCards(); renderMath(); sync3DSelection();
  if (persist) persist.schedule();
}
$('eggCards').addEventListener('click', e => { const c = e.target.closest('.egg-card'); if (c) pick(+c.dataset.i); });
$('eggCards').addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const c = e.target.closest('.egg-card'); if (c) { e.preventDefault(); pick(+c.dataset.i); }
});

// ── THE MATHS PANEL ──────────────────────────────────────────────────────
function renderMath() {
  if (!$('mathBox').open) { const q = packs[selIndex()]; $('mathEgg').textContent = q ? (rows[selIndex()].name || 'Size ' + (selIndex() + 1)) : ''; return; }
  const i = selIndex(), svg = $('mathSvg');
  const p = packs[i];
  if (!p) { svg.innerHTML = ''; $('mathSteps').innerHTML = ''; $('mathEgg').textContent = ''; return; }
  const e = p.egg;
  // One scale for every egg, so switching eggs shows the size change.
  const Lmax = Math.max(...packs.filter(Boolean).map(q => q.egg.L));
  const k = 290 / Lmax, cx = 250, cy = 128;
  const X = x => cx + x * k, Y = y => cy - y * k;
  const tv = M.T_SHELL * SHOW_T, Li = e.L - 2 * tv;

  const curve = (L, n = 120) => {
    const pts = M.profilePoints(L, n);
    const top = pts.map(([x, y]) => `${X(x).toFixed(2)},${Y(y).toFixed(2)}`);
    const bot = pts.slice().reverse().map(([x, y]) => `${X(x).toFixed(2)},${Y(-y).toFixed(2)}`);
    return 'M' + top.join('L') + 'L' + bot.join('L') + 'Z';
  };

  // Volume slices: π·y²·dx discs across the egg.
  const N = 18, dx = e.L / N;
  let slices = '';
  for (let j = 0; j < N; j++) {
    const x0 = -e.L / 2 + j * dx, r = M.profile(x0 + dx / 2, e.L);
    slices += `<rect class="m-slice${j % 2 ? ' alt' : ''}" x="${X(x0).toFixed(2)}" y="${Y(r).toFixed(2)}" width="${(dx * k).toFixed(2)}" height="${(2 * r * k).toFixed(2)}"/>`;
  }
  // Widest point, for the breadth line.
  let xB = 0, rB = 0;
  M.profilePoints(e.L, 400).forEach(([x, y]) => { if (y > rB) { rB = y; xB = x; } });
  const yL = Y(-e.B / 2) + 24;

  svg.innerHTML = `
    <defs>
      <marker id="arw" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 1 L9 5 L0 9 z" class="m-arrow"/>
      </marker>
      <clipPath id="eggClip"><path d="${curve(Li)}"/></clipPath>
    </defs>
    <path class="m-shell" d="${curve(e.L)} ${curve(Li)}" fill-rule="evenodd"/>
    <g clip-path="url(#eggClip)">${slices}</g>
    <path class="m-outline" d="${curve(e.L)}"/>
    <path class="m-inner" d="${curve(Li)}"/>
    <line class="m-axis" x1="${X(-e.L / 2) - 14}" y1="${cy}" x2="${X(e.L / 2) + 14}" y2="${cy}"/>
    <text class="m-lbl" x="${X(e.L / 2) + 18}" y="${cy + 4}">x</text>
    <line class="m-dim" x1="${X(-e.L / 2)}" y1="${yL}" x2="${X(e.L / 2)}" y2="${yL}" marker-start="url(#arw)" marker-end="url(#arw)"/>
    <text class="m-lbl m-mid" x="${cx}" y="${yL + 18}">L ${fmt.num(e.L * 10, 1)} mm</text>
    <line class="m-dim" x1="${X(xB)}" y1="${Y(rB)}" x2="${X(xB)}" y2="${Y(-rB)}" marker-start="url(#arw)" marker-end="url(#arw)"/>
    <text class="m-lbl" x="${X(xB) + 7}" y="${Y(rB * 0.45)}">B ${fmt.num(e.B * 10, 1)} mm</text>
    <text class="m-lbl m-y" x="${X(e.L * 0.2)}" y="${Y(M.profile(e.L * 0.2, e.L)) - 10}">y(x)</text>
    <text class="m-lbl m-t" x="${X(-e.L / 2) - 6}" y="${cy - 8}" text-anchor="end">t</text>
  `;

  const name = esc(rows[i].name || 'Size ' + (i + 1));
  $('mathEgg').textContent = rows[i].name || 'Size ' + (i + 1);
  // Values in LaTeX: \htmlClass lets the page's tokens colour them, so the
  // maths follows the theme like everything else.
  const R = v => `\\htmlClass{mx-r}{${v}}`;
  const C = v => `\\htmlClass{mx-c}{${v}}`;
  const n = (v, d) => fmt.num(v, d).replace(/,/g, '{,}');
  const u = t => `\\ \\text{${t}}`;
  // Each step is a list of parts that wrap as whole pieces on a narrow screen.
  const steps = [
    ['Shape', [`y(x) = \\frac{B}{2}\\sqrt{\\frac{L^2 - 4x^2}{L^2 + 8wx + 4w^2}}`, `B = ${C(M.SHAPE.breadth + 'L')},\\ \\ w = ${C(M.SHAPE.shift + 'L')}`]],
    [name, [`W = \\frac{${n(p.grams, 0)}${u('g')}}{${n(p.eggs, 0)}}`, `= ${R(n(e.W, 1) + u('g'))}`]],
    ['Volume', [`V = \\pi\\int_{-L/2}^{L/2} y^2\\,dx`, `= \\frac{W}{\\rho_{\\text{egg}}}`, `= \\frac{${n(e.W, 1)}}{${C(M.RHO_EGG)}}`, `= ${R(n(e.V, 1) + u('cm') + '^3')}`]],
    ['Size', [`L = \\sqrt[3]{\\frac{V}{${C(n(M.UNIT.cV, 4))}}}`, `= ${R(n(e.L * 10, 1) + u('mm'))}`, `B = ${C(M.SHAPE.breadth)}\\,L`, `= ${R(n(e.B * 10, 1) + u('mm'))}`]],
    ['Surface', [`S = 2\\pi\\int_{-L/2}^{L/2} y\\sqrt{1 + y'^2}\\,dx`, `= ${C(n(M.UNIT.cS, 3))}\\,L^2`, `= ${R(n(e.S, 1) + u('cm') + '^2')}`]],
    ['Shell', [`m_{\\text{shell}} = S\\,t\\,\\rho_{\\text{shell}}`, `= ${n(e.S, 1)} \\times ${C(M.T_SHELL + u('cm'))} \\times ${C(M.RHO_SHELL)}`, `= ${R(n(e.shell, 2) + u('g'))}`, `(${n(e.shellShare * 100, 1)}\\%)`]],
    ['Egg', [`m_{\\text{egg}} = W - m_{\\text{shell}}`, `= ${n(e.W, 1)} - ${n(e.shell, 2)}`, `= ${R(n(e.content, 1) + u('g'))}`]],
    ['Price', [`\\frac{\\$${n(p.price, 2)}}{${n(p.eggs, 0)} \\times ${n(e.content, 1)}${u('g')}}`, `= ${R('\\$' + p.netPerG.toFixed(4) + '/\\text{g}')}`]],
  ];
  const box = $('mathSteps');
  box.innerHTML = steps.map(([lbl, parts]) => `<div class="mx-row"><div class="mx-lbl">${lbl}</div><div class="mx-f">${parts.map((t, k) => `<span class="mx-p${k && !t.startsWith('=') && !t.startsWith('(') ? ' mx-new' : ''}"></span>`).join('')}</div></div>`).join('');
  const opts = { displayMode: false, throwOnError: false, strict: false, trust: c => c.command === '\\htmlClass' };
  box.querySelectorAll('.mx-f').forEach((el, j) => {
    el.querySelectorAll('.mx-p').forEach((span, k) => {
      const tex = steps[j][1][k];
      if (window.katex) {
        try { katex.render('\\displaystyle ' + tex, span, opts); return; } catch (err) { /* plain source below */ }
      }
      span.textContent = tex;
      span.classList.add('mx-raw');
    });
  });
}

// ── 3D EGGS ──────────────────────────────────────────────────────────────
const gl = (function initThree() {
  const canvas = $('eggCanvas');
  if (typeof THREE === 'undefined') return null;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
  catch (err) { return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -5000, 5000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8b78, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 0.75);
  sun.position.set(-300, 500, 700);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.25);
  fill.position.set(400, 100, 300);
  scene.add(fill);

  const lin = hex => new THREE.Color(hex).convertSRGBToLinear();
  const mat = {
    shellOut: new THREE.MeshStandardMaterial({ color: lin(0xd8a06c), roughness: 0.75, side: THREE.DoubleSide }),
    shellIn: new THREE.MeshStandardMaterial({ color: lin(0xf3e6d3), roughness: 0.9, side: THREE.DoubleSide }),
    shellCut: new THREE.MeshStandardMaterial({ color: lin(0xecd3b4), roughness: 0.9, side: THREE.DoubleSide }),
    white: new THREE.MeshStandardMaterial({ color: lin(0xfbf8f1), roughness: 0.35, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
    yolk: new THREE.MeshStandardMaterial({ color: lin(0xf4a01c), roughness: 0.45, side: THREE.DoubleSide }),
  };
  const shadowTex = (function () {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grd.addColorStop(0, 'rgba(0,0,0,0.32)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });

  // Lathe points (radius, height) for an egg of length L, pointy end up.
  const lathePts = L => M.profilePoints(L, 64).map(([x, y]) => new THREE.Vector2(Math.max(y, 1e-4), x));
  const PHI = Math.PI * 1.5;       // three quarters of the egg; one quarter cut away
  // A flat face in the (radius, height) plane, stood on the cut at angle phi.
  function face(shape, material, phi) {
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), material);
    m.rotation.y = phi - Math.PI / 2;
    return m;
  }
  function bandShape(outer, inner) {
    const s = new THREE.Shape();
    outer.forEach((p, j) => j ? s.lineTo(p.x, p.y) : s.moveTo(p.x, p.y));
    inner.slice().reverse().forEach(p => s.lineTo(p.x, p.y));
    s.closePath();
    return s;
  }
  function halfShape(pts) {
    const s = new THREE.Shape();
    s.moveTo(0, pts[0].y);
    pts.forEach(p => s.lineTo(p.x, p.y));
    s.lineTo(0, pts[pts.length - 1].y);
    s.closePath();
    return s;
  }

  // One egg in centimetres; the group is scaled to pixels at layout.
  function buildEgg(e) {
    const g = new THREE.Group();
    const tv = M.T_SHELL * SHOW_T;
    const out = lathePts(e.L), inn = lathePts(e.L - 2 * tv), alb = lathePts(e.L - 2 * tv - 0.02);
    g.add(new THREE.Mesh(new THREE.LatheGeometry(out, 72, 0, PHI), mat.shellOut));
    g.add(new THREE.Mesh(new THREE.LatheGeometry(inn, 72, 0, PHI), mat.shellIn));
    g.add(face(bandShape(out, inn), mat.shellCut, 0), face(bandShape(out, inn), mat.shellCut, PHI));
    g.add(new THREE.Mesh(new THREE.LatheGeometry(alb, 72, 0, PHI), mat.white));
    g.add(face(halfShape(alb), mat.white, 0), face(halfShape(alb), mat.white, PHI));
    // Yolk: about a third of the egg, sitting a touch toward the blunt end.
    const R = e.B * 0.3, yc = -e.L * 0.04;
    const yolk = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 24, 0, PHI), mat.yolk);
    yolk.position.y = yc;
    g.add(yolk);
    const disc = new THREE.Shape(); disc.moveTo(0, -R); disc.absarc(0, 0, R, -Math.PI / 2, Math.PI / 2, false); disc.lineTo(0, -R);
    [0, PHI].forEach(phi => { const f = face(disc, mat.yolk, phi); f.position.y = yc; g.add(f); });
    return g;
  }

  const eggs = [];   // { pivot, egg, shadow, ring, L, key }
  let W = 0, H = 0, k = 1, colW = 0;
  function dispose(obj) {
    obj.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    scene.remove(obj);
  }
  function sync() {
    // Rebuild only the eggs whose size changed.
    rows.forEach((r, i) => {
      const p = packs[i], key = p ? p.egg.L.toFixed(4) : 'none';
      let slot = eggs[i];
      if (slot && slot.key === key) return;
      if (slot) { dispose(slot.pivot); dispose(slot.shadow); dispose(slot.ring); }
      slot = eggs[i] = { key, L: p ? p.egg.L : 0, B: p ? p.egg.B : 0 };
      slot.pivot = new THREE.Group();
      if (p) slot.pivot.add(slot.egg = buildEgg(p.egg));
      slot.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat);
      slot.shadow.rotation.x = -Math.PI / 2;
      slot.ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.7, 64), ringMat);
      slot.ring.rotation.x = -Math.PI / 2;
      slot.ring.visible = false;
      scene.add(slot.pivot, slot.shadow, slot.ring);
    });
    while (eggs.length > rows.length) { const s = eggs.pop(); dispose(s.pivot); dispose(s.shadow); dispose(s.ring); }
    layout();
  }
  function layout() {
    const wrap = $('stageInner');
    W = wrap.clientWidth; H = canvas.clientHeight;
    if (!W || !H) return;
    renderer.setSize(W, H, false);
    camera.left = -W / 2; camera.right = W / 2; camera.top = H / 2; camera.bottom = -H / 2;
    camera.position.set(0, H * 0.3, 1000); camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    const n = rows.length; colW = W / n;
    const Lmax = Math.max(0.1, ...eggs.map(s => s.L)), Bmax = Math.max(0.1, ...eggs.map(s => s.B));
    k = Math.min((H - 50) / Lmax, colW * 0.62 / Bmax);
    const ground = -H / 2 + 26;
    eggs.forEach((s, i) => {
      const x = -W / 2 + (i + 0.5) * colW;
      s.pivot.position.set(x, ground + s.L * k / 2, 0);
      s.pivot.scale.setScalar(k);
      s.shadow.position.set(x, ground + 0.5, 0);
      s.shadow.scale.set(s.B * k * 1.5, s.B * k * 1.0, 1);
      s.ring.position.set(x, ground + 1, 0);
      s.ring.scale.setScalar(s.B * k * 1.05);
    });
    draw(performance.now());
  }
  function selection() {
    const s = selIndex();
    ringMat.color.set(cssVar('--accent') || '#5A91E8');
    eggs.forEach((e, i) => { e.ring.visible = i === s && !!e.egg; });
    draw(performance.now());
  }
  // Turn the cut toward the camera, and rock gently so the eggs read as solid.
  const BASE = Math.PI / 4 + 0.45;
  function draw(t) {
    eggs.forEach((s, i) => {
      if (s.egg) s.egg.rotation.y = BASE + (reduceMotion ? 0 : 0.4 * Math.sin(t / 1600 + i * 0.9));
    });
    renderer.render(scene, camera);
  }
  let visible = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(en => { visible = en[0].isIntersecting; }).observe(canvas);
  (function loop(t) {
    if (visible && !reduceMotion && !document.hidden) draw(t);
    requestAnimationFrame(loop);
  })(performance.now());
  if ('ResizeObserver' in window) new ResizeObserver(() => layout()).observe($('stageInner'));
  else window.addEventListener('resize', layout);
  canvas.addEventListener('click', e => {
    const r = canvas.getBoundingClientRect();
    pick(Math.floor((e.clientX - r.left) / (r.width / rows.length)));
  });
  return { sync, selection };
})();
document.body.classList.toggle('gl3d', !!gl);
function sync3D() { if (gl) gl.sync(); }
function sync3DSelection() { if (gl) gl.selection(); }

// ── RENDER ───────────────────────────────────────────────────────────────
function sizeStage() {
  $('stageInner').style.minWidth = (rows.length * COL_MIN) + 'px';
}
function update() {
  compute();
  fillTable();
  renderCards();
  renderMath();
  sync3D();
  sync3DSelection();
}
function renderAll() {
  compute();
  sizeStage();
  renderTable();
  renderCards();
  renderMath();
  sync3D();
  sync3DSelection();
  if (persist) persist.schedule();
}

$('themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('light');
  $('themeToggle').textContent = document.body.classList.contains('light') ? '🌙 Dark' : '☀️ Light';
  sync3DSelection();
});

$('mathBox').addEventListener('toggle', renderMath);

// ── INIT ─────────────────────────────────────────────────────────────────
renderAll();
persist = Persist.init('eggprice', {
  extra: {
    save() { return { rows, sel }; },
    restore(ex) {
      if (ex && Array.isArray(ex.rows) && ex.rows.length) {
        rows = ex.rows.map(r => ({ name: String(r.name ?? ''), eggs: r.eggs ?? '', grams: r.grams ?? '', price: r.price ?? '' }));
        sel = Number.isInteger(ex.sel) ? ex.sel : -1;
      }
    },
  },
  onRestore: renderAll,
});
