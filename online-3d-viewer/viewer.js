/* The 3D view: one three.js scene that shows the common model (model.js).

   It draws only when something changes (a drag, a zoom, a playing
   animation), so an idle model costs nothing. The model is turned so its up
   axis is up, set on the grid, and framed from the front right. Colours come
   from the page's theme tokens, so day and night both read well. */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const VIEW_DIR = new THREE.Vector3(0.95, 0.7, 1.15).normalize();
const EDGE_BUDGET = 3e6;   // triangles: above this, feature edges would cost more than they show

export class Viewer {
  constructor(host) {
    this.host = host;
    const renderer = this.renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.domElement.className = 'viewer-canvas';
    renderer.domElement.setAttribute('aria-label', '3D view of the model. Drag to turn, scroll or pinch to zoom, right-drag or two fingers to pan.');
    renderer.domElement.setAttribute('role', 'img');
    host.prepend(renderer.domElement);

    const scene = this.scene = new THREE.Scene();
    const camera = this.camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
    scene.add(camera);

    // Light: soft sky and ground, a light that follows the camera so the
    // faces turned to the reader are always lit, and a room to reflect
    // (metal and glossy glTF materials look flat without one).
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x6f7a8c, 0.75);
    scene.add(this.hemi);
    this.head = new THREE.DirectionalLight(0xffffff, 1.9);    // upper left of the reader
    this.head.position.set(-0.9, 1.1, 0.9);
    this.fill = new THREE.DirectionalLight(0xffffff, 0.45);   // low right, softens the shadow side
    this.fill.position.set(1, -0.4, 0.6);
    for (const l of [this.head, this.fill]) { camera.add(l); camera.add(l.target); l.target.position.set(0, 0, -1); }
    this.key = new THREE.DirectionalLight(0xffffff, 0.35);    // from above, fixed to the model
    scene.add(this.key, this.key.target);
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = this.envMap;
    scene.environmentIntensity = 0.4;

    this.pivot = new THREE.Group();     // placed so the model sits centred on the grid
    this.orient = new THREE.Group();    // turned so the model's up axis is up
    this.pivot.add(this.orient);
    scene.add(this.pivot);

    const controls = this.controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.screenSpacePanning = true;
    controls.zoomToCursor = true;
    controls.addEventListener('change', () => this.request());

    this.timer = new THREE.Timer();
    this.timer.connect(document);
    this.model = null;
    this.up = 'y';
    this.opts = { wireframe: false, edges: false, grid: true };
    this.theme = { bg: '#EEF2F9', bg2: '#BCC8DB', grid: '#C8D4E8', grid2: '#DCE3F0', model: '#9FB4D3', line: '#14203A', edge: '#14203A' };
    this.radius = 1;
    this.mixer = null;
    this.playing = false;
    this._raf = 0;
    this._tick = this._tick.bind(this);

    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(host);
    this.resize();
  }

  // ── Frame loop (on demand) ──
  request() { if (!this._raf) this._raf = requestAnimationFrame(this._tick); }

  _tick() {
    this._raf = 0;
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.1);
    const moved = this.controls.update();
    this._clip();
    if (this.mixer && this.playing) this.mixer.update(dt);
    this.renderer.render(this.scene, this.camera);
    if (moved || (this.mixer && this.playing)) this.request();
  }

  // Keep the near and far planes snug around what is in view, so a close
  // zoom never cuts the model and a far one never flickers.
  _clip() {
    const d = this.camera.position.distanceTo(this.controls.target);
    const r = this.radius;
    const near = Math.max(d / 400, r * 1e-4);
    const far = d + r * 30;
    if (Math.abs(near - this.camera.near) > near * 0.01 || Math.abs(far - this.camera.far) > far * 0.01) {
      this.camera.near = near;
      this.camera.far = far;
      this.camera.updateProjectionMatrix();
    }
  }

  resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.request();
  }

  // ── Theme ──
  setTheme(t) {
    Object.assign(this.theme, t);
    this.scene.background = gradientTexture(this.theme.bg, this.theme.bg2 || this.theme.bg, this.scene.background);
    if (this.model) { this._paintDefaults(); this._buildGrid(); this._restyleEdges(); }
    this.request();
  }

  // ── Model ──
  setModel(model) {
    this.clear();
    this.model = model;
    this.orient.add(model.content);
    this.up = model.up;
    this._paintDefaults();
    this._sizePoints();
    if (this.opts.wireframe) this.setWireframe(true);
    this._place();
    if (this.opts.edges) this.setEdges(true);
    this.resetView();

    if (model.animations.length) {
      this.mixer = new THREE.AnimationMixer(model.content);
      this.mixer.clipAction(model.animations[0]).play();
      this.playing = true;
      this.timer.update();
    }
    this.request();
  }

  clear() {
    if (this.mixer) { this.mixer.stopAllAction(); this.mixer = null; }
    this.playing = false;
    if (!this.model) return;
    const content = this.model.content;
    this.orient.remove(content);
    disposeTree(content);
    if (this.grid) { this.scene.remove(this.grid); disposeTree(this.grid); this.grid = null; }
    this.box = null;
    this.model = null;
    this.request();
  }

  /** Flip which file axis is up ('y' or 'z'), and frame the model again. */
  setUp(axis) {
    if (!this.model || (axis !== 'y' && axis !== 'z')) return;
    this.up = axis;
    this._place();
    this.resetView();
  }

  _place() {
    this.orient.rotation.set(this.up === 'z' ? -Math.PI / 2 : 0, 0, 0);
    this.pivot.position.set(0, 0, 0);
    this.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.orient);
    if (box.isEmpty()) box.set(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
    const c = box.getCenter(new THREE.Vector3());
    // Centre over the origin and stand on the grid.
    this.pivot.position.set(-c.x, -box.min.y, -c.z);
    this.scene.updateMatrixWorld(true);
    this.box = box.translate(this.pivot.position);
    const sphere = this.box.getBoundingSphere(new THREE.Sphere());
    this.radius = Math.max(sphere.radius, 1e-6);
    this.controls.minDistance = this.radius * 0.01;
    this.controls.maxDistance = this.radius * 60;
    this.key.position.set(this.radius * 2, this.radius * 4, this.radius * 3);
    this._buildGrid();
  }

  /** Frame the model from the front right, a little above: the camera backs
      off until all eight corners of the model's box are in view. */
  resetView() {
    if (!this.box) return;
    const sphere = this.box.getBoundingSphere(new THREE.Sphere());
    const center = this.box.getCenter(new THREE.Vector3());
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const tanH = tanV * this.camera.aspect;
    // Camera basis looking along -VIEW_DIR with world Y up.
    const back = VIEW_DIR.clone();
    const right = new THREE.Vector3(0, 1, 0).cross(back).normalize();
    const up = back.clone().cross(right).normalize();
    let dist = 0;
    const p = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      p.set(i & 1 ? this.box.max.x : this.box.min.x, i & 2 ? this.box.max.y : this.box.min.y, i & 4 ? this.box.max.z : this.box.min.z).sub(center);
      const x = Math.abs(p.dot(right)), y = Math.abs(p.dot(up)), z = p.dot(back);
      dist = Math.max(dist, z + x / tanH, z + y / tanV);
    }
    dist = Math.max(dist * 1.18, sphere.radius * 0.5, 1e-6);
    // Spend whatever turn or pan is still gliding from the last drag, so it
    // does not carry the camera on past the reset.
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.enableDamping = true;
    this.controls.target.copy(center);
    this.camera.position.copy(center).addScaledVector(VIEW_DIR, dist);
    this.camera.near = dist / 400;
    this.camera.far = dist + sphere.radius * 30;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.request();
  }

  _buildGrid() {
    if (this.grid) { this.scene.remove(this.grid); disposeTree(this.grid); this.grid = null; }
    if (!this.box || !this.opts.grid) { this.request(); return; }
    const size = this.box.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.z, size.y * 0.5, 1e-6);
    const cell = niceStep(span / 6);
    const half = Math.ceil((span * 1.1) / cell) * cell;
    const divisions = Math.max(2, Math.round((half * 2) / cell));
    const grid = new THREE.GridHelper(half * 2, divisions, this.theme.grid, this.theme.grid2);
    grid.material.transparent = true;
    grid.material.opacity = 0.85;
    grid.material.depthWrite = false;
    grid.renderOrder = -1;
    grid.position.y = -this.radius * 1e-4;
    grid.userData.cell = cell;
    this.grid = grid;
    this.scene.add(grid);
    this.request();
  }

  _forMaterials(fn) {
    if (!this.model) return;
    this.model.content.traverse(o => {
      if (!o.material || o.userData.o3vEdge) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m) fn(m, o);
    });
  }

  _paintDefaults() {
    const model = new THREE.Color(this.theme.model);
    const line = new THREE.Color(this.theme.line);
    this._forMaterials((m, o) => {
      if (!m.userData.o3vDefault || !m.color) return;
      m.color.copy(o.isMesh ? model : line);
    });
    this.request();
  }

  _sizePoints() {
    const r = this.model.box.isEmpty() ? 1 : this.model.box.getBoundingSphere(new THREE.Sphere()).radius;
    // Sparse clouds get bigger points, dense scans finer ones.
    let count = 0;
    this.model.content.traverse(o => { if (o.isPoints) count += o.geometry.getAttribute('position').count; });
    const size = THREE.MathUtils.clamp(2 * r / Math.sqrt(Math.max(count, 1)), r / 600, r / 90);
    this._forMaterials((m, o) => {
      if (!o.isPoints || !m.userData.o3vPointSize) return;
      m.sizeAttenuation = true;
      m.size = size;
      m.needsUpdate = true;
    });
  }

  setWireframe(on) {
    this.opts.wireframe = !!on;
    this._forMaterials((m, o) => { if (o.isMesh && 'wireframe' in m) m.wireframe = this.opts.wireframe; });
    this.request();
  }

  setGrid(on) { this.opts.grid = !!on; this._buildGrid(); }

  /** Feature edges: lines where neighbouring faces meet at more than 30°.
      Returns false when the model is too heavy for them. */
  setEdges(on) {
    this.opts.edges = !!on;
    if (!this.model) return true;
    this._removeEdges();
    if (!this.opts.edges) { this.request(); return true; }
    if (this.model.stats.triangles > EDGE_BUDGET) { this.request(); return false; }
    const mat = new THREE.LineBasicMaterial({ color: this.theme.edge, transparent: true, opacity: 0.55, depthWrite: false });
    this._edgeMat = mat;
    const meshes = [];
    this.model.content.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && !o.isInstancedMesh && o.geometry) meshes.push(o); });
    for (const mesh of meshes) {
      const eg = edgesOf(mesh.geometry);
      if (!eg) continue;
      const lines = new THREE.LineSegments(eg, mat);
      lines.userData.o3vEdge = true;
      lines.raycast = () => {};
      mesh.add(lines);
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (!m) continue;
        m.polygonOffset = true; m.polygonOffsetFactor = 1; m.polygonOffsetUnits = 1;
      }
    }
    this.request();
    return true;
  }

  _removeEdges() {
    if (!this.model) return;
    const old = [];
    this.model.content.traverse(o => { if (o.userData.o3vEdge) old.push(o); });
    for (const o of old) { o.parent.remove(o); o.geometry.dispose(); }
    if (this._edgeMat) { this._edgeMat.dispose(); this._edgeMat = null; }
  }

  _restyleEdges() { if (this._edgeMat) this._edgeMat.color.set(this.theme.edge); }

  // ── Animation ──
  setPlaying(on) {
    this.playing = !!on && !!this.mixer;
    this.timer.update();
    this.request();
  }

  // ── Picture ──
  /** A PNG of the current view, at twice the screen's pixels where it is lower. */
  snapshot() {
    const r = this.renderer;
    const ratio = r.getPixelRatio();
    const want = Math.max(ratio, 2);
    if (want !== ratio) { r.setPixelRatio(want); r.setSize(this.host.clientWidth, this.host.clientHeight, false); }
    r.render(this.scene, this.camera);
    return new Promise(res => r.domElement.toBlob(b => {
      if (want !== ratio) { r.setPixelRatio(ratio); r.setSize(this.host.clientWidth, this.host.clientHeight, false); this.request(); }
      res(b);
    }, 'image/png'));
  }
}

/* EdgesGeometry rounds positions to 4 decimals to find shared corners, which
   would merge the corners of a part smaller than a millimetre in a metre-based
   file; work on a copy scaled up to a comfortable size, then scale back. */
function edgesOf(geometry) {
  const pos = geometry.getAttribute('position');
  if (!pos || pos.count < 3) return null;
  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  const r = geometry.boundingSphere ? geometry.boundingSphere.radius : 1;
  if (!(r > 0)) return null;
  const s = r < 100 ? 1000 / r : 1;
  let src = geometry;
  if (s !== 1) {
    src = new THREE.BufferGeometry();
    src.setAttribute('position', pos.clone());
    if (geometry.index) src.setIndex(geometry.index);
    src.scale(s, s, s);
  }
  const eg = new THREE.EdgesGeometry(src, 30);
  if (s !== 1) { eg.scale(1 / s, 1 / s, 1 / s); src.dispose(); }
  return eg;
}

/* The stage background: a top-to-bottom gradient, drawn into a small
   texture (so it is in the PNG too). The previous one is reused. */
function gradientTexture(top, bottom, previous) {
  const tex = previous && previous.isCanvasTexture ? previous : new THREE.CanvasTexture(document.createElement('canvas'));
  const c = tex.image;
  c.width = 2; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 256);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.colours = top + bottom;
  tex.needsUpdate = true;
  return tex;
}

function niceStep(x) {
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / p;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
}

function disposeTree(root) {
  root.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      if (!m) continue;
      for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose(); }
      m.dispose();
    }
    if (o.skeleton && o.skeleton.boneTexture) o.skeleton.boneTexture.dispose();
  });
}
