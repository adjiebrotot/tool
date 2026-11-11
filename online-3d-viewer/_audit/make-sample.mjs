// Builds online-3d-viewer/sample.glb, the model behind "Load a sample model":
// a small gear train on a base plate (three spur gears, shafts, bolts), with
// a looping animation of the gears turning in mesh. Drawn with three.js in
// headless Chromium and written with three's GLTFExporter, so the sample is
// our own and reproducible.   Run: node make-sample.mjs
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ensureDeps, routeCdn } from './serve.mjs';

ensureDeps();
const browser = await pw.chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERROR', e.message));
page.on('console', m => console.log('console:', m.text()));
await routeCdn(page);
await page.setContent(`<!doctype html><script type="importmap">{"imports":{
  "three":"https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js",
  "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/"}}</script>`);

const b64 = await page.evaluate(async () => {
  const THREE = await import('three');
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  const { mergeVertices } = await import('three/addons/utils/BufferGeometryUtils.js');

  const mat = (name, color, metalness, roughness) => {
    const m = new THREE.MeshStandardMaterial({ color, metalness, roughness });
    m.name = name;
    return m;
  };
  const M = {
    plate: mat('Anodised plate', 0x2E3646, 0.35, 0.55),
    blue: mat('Blue anodised aluminium', 0x3A71C8, 0.55, 0.32),
    brass: mat('Brass', 0xC9A23A, 0.85, 0.3),
    teal: mat('Teal anodised aluminium', 0x2F8F7A, 0.55, 0.32),
    steel: mat('Steel', 0xC2C9D3, 0.9, 0.28),
  };

  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.name = 'GearTrain';
  scene.add(root);

  // ── Base plate: rounded rectangle with four bolt holes ──
  const W = 0.26, D = 0.15, T = 0.012, R = 0.012;
  const plate = new THREE.Shape();
  plate.moveTo(-W / 2 + R, -D / 2);
  plate.lineTo(W / 2 - R, -D / 2); plate.quadraticCurveTo(W / 2, -D / 2, W / 2, -D / 2 + R);
  plate.lineTo(W / 2, D / 2 - R); plate.quadraticCurveTo(W / 2, D / 2, W / 2 - R, D / 2);
  plate.lineTo(-W / 2 + R, D / 2); plate.quadraticCurveTo(-W / 2, D / 2, -W / 2, D / 2 - R);
  plate.lineTo(-W / 2, -D / 2 + R); plate.quadraticCurveTo(-W / 2, -D / 2, -W / 2 + R, -D / 2);
  const boltAt = [[-W / 2 + 0.016, -D / 2 + 0.016], [W / 2 - 0.016, -D / 2 + 0.016], [W / 2 - 0.016, D / 2 - 0.016], [-W / 2 + 0.016, D / 2 - 0.016]];
  for (const [x, y] of boltAt) { const h = new THREE.Path(); h.absarc(x, y, 0.0045, 0, Math.PI * 2, true); plate.holes.push(h); }
  const plateGeo = new THREE.ExtrudeGeometry(plate, { depth: T, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0012, bevelSegments: 1, curveSegments: 6 });
  plateGeo.rotateX(-Math.PI / 2);
  plateGeo.translate(0, 0.0012, 0);
  const plateMesh = new THREE.Mesh(plateGeo, M.plate);
  plateMesh.name = 'BasePlate';
  root.add(plateMesh);
  const top = T + 0.0024;

  // ── Bolts: hex heads ──
  boltAt.forEach(([x, y], i) => {
    const g = new THREE.CylinderGeometry(0.0072, 0.0072, 0.005, 6);
    g.translate(0, top + 0.0025, 0);
    const b = new THREE.Mesh(g, M.steel);
    b.position.set(x, 0, -y);
    b.name = 'Bolt' + (i + 1);
    root.add(b);
  });

  // ── Spur gears: module 4 mm, straight flanks, a bore and lightening holes ──
  const MOD = 0.004, FACE = 0.012;
  function gearShape(z) {
    const r = MOD * z / 2, ra = r + MOD, rf = r - 1.25 * MOD;
    const s = new THREE.Shape();
    const step = Math.PI * 2 / z;
    const half = (Math.PI / 2) / z;      // half tooth thickness at the pitch circle, as an angle
    for (let k = 0; k < z; k++) {
      const c = k * step;
      const pts = [
        [rf, c - step / 2 + 0.0001], [rf, c - half * 1.25], [r, c - half], [ra, c - half * 0.55],
        [ra, c + half * 0.55], [r, c + half], [rf, c + half * 1.25],
      ];
      pts.forEach(([rr, a], j) => {
        const x = rr * Math.cos(a), y = rr * Math.sin(a);
        if (k === 0 && j === 0) s.moveTo(x, y); else s.lineTo(x, y);
      });
    }
    s.closePath();
    const bore = new THREE.Path(); bore.absarc(0, 0, 0.0062, 0, Math.PI * 2, true); s.holes.push(bore);
    if (z >= 20) {
      const n = 5, rr = (rf + 0.012) / 2 + 0.002, hr = Math.min(0.009, (rf - 0.014) / 2.6);
      for (let i = 0; i < n; i++) {
        const a = i * Math.PI * 2 / n + Math.PI / n;
        const h = new THREE.Path(); h.absarc(rr * Math.cos(a), rr * Math.sin(a), hr, 0, Math.PI * 2, true); s.holes.push(h);
      }
    }
    return s;
  }
  function gear(name, z, material) {
    const g = new THREE.ExtrudeGeometry(gearShape(z), { depth: FACE, bevelEnabled: false, curveSegments: 10 });
    g.rotateX(-Math.PI / 2);
    const hub = new THREE.CylinderGeometry(0.011, 0.011, 0.006, 32, 1, true);
    hub.translate(0, FACE + 0.003, 0);
    const holder = new THREE.Group();
    holder.name = name;
    const body = new THREE.Mesh(mergeVertices(g, 1e-7), material);
    body.name = name + 'Body';
    const collar = new THREE.Mesh(hub, material);
    collar.name = name + 'Hub';
    holder.add(body, collar);
    return holder;
  }

  const Z = [30, 15, 20];
  const r = Z.map(z => MOD * z / 2);
  const posA = new THREE.Vector2(-0.06, 0.0);
  const posB = new THREE.Vector2(posA.x + r[0] + r[1], 0.0);
  const angBC = Math.PI * 0.32;   // C sits up and to the right of B
  const posC = new THREE.Vector2(posB.x + (r[1] + r[2]) * Math.cos(angBC), posB.y + (r[1] + r[2]) * Math.sin(angBC));
  const gears = [
    { g: gear('Gear30T', Z[0], M.blue), p: posA },
    { g: gear('Gear15T', Z[1], M.brass), p: posB },
    { g: gear('Gear20T', Z[2], M.teal), p: posC },
  ];
  const lift = top + 0.006;
  gears.forEach(({ g, p }) => { g.position.set(p.x, lift, -p.y); root.add(g); });

  // Phases so teeth sit in gaps: gear 2 meshing gear 1 along direction θ.
  const phase = [0, 0, 0];
  const mesh = (i1, i2, theta) => { phase[i2] = theta + Math.PI + Math.PI / Z[i2] - (Z[i1] / Z[i2]) * (theta - phase[i1]); };
  mesh(0, 1, 0);
  mesh(1, 2, angBC);

  // ── Shafts and a motor block under gear A ──
  gears.forEach(({ p }, i) => {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0062, 0.04, 24), M.steel);
    s.geometry.translate(0, top + 0.02, 0);
    s.position.set(p.x, 0, -p.y);
    s.name = 'Shaft' + (i + 1);
    root.add(s);
  });

  // ── Animation: 12 s loop; A turns 2, B 4, C 3 times (ratios 30:15:20) ──
  const dur = 12, steps = 96;
  const times = [], tracks = [];
  for (let i = 0; i <= steps; i++) times.push(dur * i / steps);
  const turns = [2, -4, 3];
  const axis = new THREE.Vector3(0, 1, 0);
  gears.forEach(({ g }, gi) => {
    const values = [];
    const q = new THREE.Quaternion();
    for (const t of times) {
      // Our angles run counter-clockwise seen from above (+Y), in the plate's x / -z plane.
      q.setFromAxisAngle(axis, phase[gi] + turns[gi] * Math.PI * 2 * t / dur);
      values.push(q.x, q.y, q.z, q.w);
    }
    g.quaternion.fromArray(values.slice(0, 4));
    tracks.push(new THREE.QuaternionKeyframeTrack(g.name + '.quaternion', times, values));
  });
  const clip = new THREE.AnimationClip('Gears turning', dur, tracks);

  // Lean geometry: no texture coordinates (nothing is textured), shared corners.
  scene.traverse(o => {
    if (!o.isMesh) return;
    o.geometry.deleteAttribute('uv');
    o.geometry = mergeVertices(o.geometry, 1e-7);
  });
  const glb = await new GLTFExporter().parseAsync(scene, { binary: true, animations: [clip] });
  const u8 = new Uint8Array(glb);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
});

const out = path.join(ROOT, 'online-3d-viewer', 'sample.glb');
fs.writeFileSync(out, Buffer.from(b64, 'base64'));
console.log('wrote ' + out + ' (' + (fs.statSync(out).size / 1024).toFixed(1) + ' KB)');
await browser.close();
