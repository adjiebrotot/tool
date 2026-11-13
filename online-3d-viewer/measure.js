/* The ruler: distances and areas picked on the model.

   A click on the model places a point. Near the pointer it snaps, the way a
   CAD program does, to what a reader means to measure from (snap.js reads
   the parts' edges, arcs and flat faces): a corner or the end of an edge, an
   edge's midpoint, the centre of a circle, arc or hole, the centre of a flat
   face, the foot of the perpendicular from the last point to a face or an
   edge, or a point on an edge; else the surface itself. On a mesh with no
   such edges, the corners of the triangle under the pointer. The hover
   marker's shape and tag say which; Shift places a point freely.
   Distance: two points make one measurement. Area: the corners of a
   polygon, closed on its first point, a double-click or Enter.

   Points are kept in the file's own axes and unit (the viewer's `orient`
   group: no scale, only the Up turn and the centring move), so flipping Up
   keeps them on the model, and ΔX / ΔY / ΔZ read along the file's axes.

   Lines and labels are drawn on a 2D canvas over the 3D view after each
   frame, and again onto the PNG (Viewer.decorate), so a saved picture
   shows them too. A drag still turns the view: only a click places. */

import * as THREE from 'three';
import { snapIndex, CORNER, END, MID, CENTRE } from './snap.js';

const SNAP_PX = 12;          // a corner, midpoint or centre this close to the pointer is taken instead
const EDGE_PX = 7;           // an edge this close pulls the point onto it
const TOUCH_REACH = 1.75;    // a finger is less exact than a mouse: reach further
const SIGHT_TESTS = 6;       // targets behind the surface under the pointer checked for being in view, at most
const KINDS = { [CORNER]: 'corner', [END]: 'end', [MID]: 'mid', [CENTRE]: 'centre' };
const CLOSE_PX = 12;         // a click this close to the first corner closes an area
const SAME_PX = 4;           // a click on the last point (the second click of a double-click) finishes an area
const TAP_PX = 5;            // a press that moves further than this is a drag, not a click
const HOVER_TRIS = 400000;   // above this, no live preview under a moving mouse (each test costs too much)

export class Measure {
  /** format(number) → text; onChange(state) after every change; onExit() for Esc with nothing to cancel. */
  constructor(viewer, { format, onChange, onExit } = {}) {
    this.v = viewer;
    this.format = format || (x => String(+x.toPrecision(5)));
    this.onChange = onChange || (() => {});
    this.onExit = onExit || (() => {});
    this.active = false;
    this.mode = 'distance';
    this.items = [];     // finished: { kind: 'distance' | 'area', pts: [Vector3 in file axes] }
    this.draft = [];     // the one being placed
    this.hover = null;   // pick() under a mouse, while active: { p, snapped, kind, path?, centre?, … }
    this.unit = '';
    this.colours = { line: '#3B82F6', halo: '#FFFFFF', text: '#14203A', panel: '#FFFFFF', border: '#C8D4E8' };
    this.ray = new THREE.Raycaster();
    this.sight = new THREE.Raycaster();
    this._free = false;  // Shift held: place without snapping

    const c = this.canvas = document.createElement('canvas');
    c.className = 'measure-canvas';
    c.setAttribute('aria-hidden', 'true');
    viewer.renderer.domElement.after(c);
    viewer.onFrame = () => this._paint();
    viewer.decorate = (ctx, w, h, scale) => this.draw(ctx, w, h, scale);

    const el = viewer.renderer.domElement;
    this._down = new Map();
    el.addEventListener('pointerdown', e => this._pointerDown(e));
    el.addEventListener('pointerup', e => this._pointerUp(e));
    el.addEventListener('pointercancel', e => this._down.delete(e.pointerId));
    el.addEventListener('pointermove', e => this._pointerMove(e));
    el.addEventListener('pointerleave', () => { if (this.hover) { this.hover = null; this._changed(false); } });
    window.addEventListener('keydown', e => this._key(e));
    const shift = e => { if (e.key === 'Shift' && this._free !== (e.type === 'keydown')) { this._free = e.type === 'keydown'; this._hoverAgain(); } };
    window.addEventListener('keydown', shift);
    window.addEventListener('keyup', shift);
    window.addEventListener('blur', () => { if (this._free) { this._free = false; this._hoverAgain(); } });
  }

  // ── State ──
  setActive(on) {
    this.active = !!on;
    if (!this.active) { this.draft = []; this.hover = null; }
    this.v.host.classList.toggle('measuring', this.active);
    this._changed();
  }

  setMode(mode) {
    if (mode !== 'distance' && mode !== 'area') return;
    if (mode !== this.mode) this.draft = [];
    this.mode = mode;
    this._changed();
  }

  setUnit(unit) { this.unit = unit || ''; this._changed(); }
  setColours(c) { Object.assign(this.colours, c); this._changed(false); }

  /** Take back the last point placed, or else the last measurement. */
  undo() {
    if (this.draft.length) this.draft.pop();
    else this.items.pop();
    this._changed();
  }

  remove(i) { this.items.splice(i, 1); this._changed(); }
  cancel() { this.draft = []; this._changed(); }
  clear() { this.items = []; this.draft = []; this.hover = null; this._changed(); }

  /** Close the area being drawn (it needs three corners). */
  finish() {
    if (this.mode !== 'area' || this.draft.length < 3) return false;
    this.items.push({ kind: 'area', pts: this.draft });
    this.draft = [];
    this._changed();
    return true;
  }

  /** Place a point (in the file's axes) as a click would. */
  add(p) {
    if (!this.v.model) return;
    this.draft.push(p.clone());
    if (this.mode === 'distance' && this.draft.length === 2) {
      this.items.push({ kind: 'distance', pts: this.draft });
      this.draft = [];
    }
    this._changed();
  }

  /** What the panel shows: every measurement's figures, and the one in progress. */
  state() {
    return {
      active: this.active,
      mode: this.mode,
      unit: this.unit,
      items: this.items.map(it => figures(it.kind, it.pts)),
      draft: { kind: this.mode, count: this.draft.length },
    };
  }

  _changed(tell = true) {
    if (tell) this.onChange(this.state());
    this.v.request();
  }

  // ── Picking ──
  _pointerDown(e) {
    if (!this.active) return;
    this._down.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button, multi: this._down.size > 0 });
    if (this._down.size > 1) for (const d of this._down.values()) d.multi = true;   // a pinch is never a click
  }

  _pointerUp(e) {
    const d = this._down.get(e.pointerId);
    this._down.delete(e.pointerId);
    if (!this.active || !d || d.multi || d.button !== 0) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_PX) return;
    this._place(e.clientX, e.clientY, { free: e.shiftKey, reach: e.pointerType === 'mouse' ? 1 : TOUCH_REACH });
  }

  _pointerMove(e) {
    if (!this.active || e.pointerType !== 'mouse' || e.buttons) return;
    if (!this.v.model || this.v.model.stats.triangles > HOVER_TRIS) return;
    this._hoverAt = [e.clientX, e.clientY];
    this._free = e.shiftKey;
    this._hoverAgain();
  }

  _hoverAgain() {
    if (!this._hoverAt || this._hoverRaf || !this.active) return;
    this._hoverRaf = requestAnimationFrame(() => {
      this._hoverRaf = 0;
      if (!this.active || !this._hoverAt) return;
      this.hover = this.pick(this._hoverAt[0], this._hoverAt[1], { free: this._free });
      this._changed(false);
    });
  }

  _place(cx, cy, opts) {
    const hit = this.pick(cx, cy, opts);
    if (!hit) return;
    const rect = this.v.renderer.domElement.getBoundingClientRect();
    if (this.mode === 'area' && this.draft.length) {
      const last = this._screen(this.draft[this.draft.length - 1], rect.width, rect.height);
      if (last && Math.hypot(last.x - (cx - rect.left), last.y - (cy - rect.top)) <= SAME_PX) { this.finish(); return; }
      if (this.draft.length >= 3) {
        const first = this._screen(this.draft[0], rect.width, rect.height);
        if (first && Math.hypot(first.x - (cx - rect.left), first.y - (cy - rect.top)) <= CLOSE_PX) { this.finish(); return; }
      }
    }
    this.add(hit.p);
  }

  /** The parts the ruler can snap to (their snap index is read on first use). */
  _targets() {
    const model = this.v.model;
    if (this._for !== model) {
      this._for = model;
      this._list = [];
      if (model) model.content.traverse(o => {
        if (!o.geometry || o.userData.o3vEdge) return;
        const morphs = o.geometry.morphAttributes && o.geometry.morphAttributes.position;
        if ((o.isMesh && !o.isSkinnedMesh && !morphs) || o.isLine) this._list.push(o);
      });
      this._set = new Set(this._list);
    }
    return this._list;
  }

  /** The model point under a screen position, in the file's axes, snapped
      to the nearest target that suits (see the top of this file).
      opts: free (no snapping), reach (× the snap distances). */
  pick(cx, cy, opts = {}) {
    const v = this.v;
    if (!v.model) return null;
    const el = v.renderer.domElement;
    const rect = el.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    const sx = cx - rect.left, sy = cy - rect.top;
    const ndc = new THREE.Vector2((sx / W) * 2 - 1, -(sy / H) * 2 + 1);
    const reach = opts.reach || 1;
    // What one screen pixel spans per unit of distance from the camera, and at the point the view turns about.
    const k = 2 * Math.tan(THREE.MathUtils.degToRad(v.camera.fov) / 2) / H;
    const px = v.camera.position.distanceTo(v.controls.target) * k;
    this.ray.setFromCamera(ndc, v.camera);
    this.ray.params.Points.threshold = px * 6;
    this.ray.params.Line.threshold = px * 5;
    v.scene.updateMatrixWorld();
    const hits = this.ray.intersectObject(v.model.content, true).filter(h => shown(h.object));
    const h = hits[0] || null;
    const R = this.ray.ray;
    this._targets();

    const cands = [];
    const add = (w, kind, tier, limit, extra) => {
      const s = toScreen(w, v.camera, W, H);
      const d = s ? Math.hypot(s.x - sx, s.y - sy) : Infinity;
      if (d <= limit) cands.push(Object.assign({ w, kind, tier, d }, extra));
    };
    const near = SNAP_PX * reach, onEdge = EDGE_PX * reach;
    const fromW = this.draft.length ? this._world(this.draft[this.draft.length - 1]) : null;

    if (!opts.free) {
      // Under the pointer: a cloud's point, a line's two ends, a mesh triangle's corners.
      if (h) {
        const o = h.object, M = matrixOf(o, h.instanceId);
        const pos = o.geometry.getAttribute('position');
        const corner = i => {
          const w = new THREE.Vector3();
          if (o.isMesh && o.getVertexPosition) o.getVertexPosition(i, w); else w.fromBufferAttribute(pos, i);
          return w.applyMatrix4(M);
        };
        if (o.isPoints && h.index != null && h.index < pos.count) add(corner(h.index), 'point', 1, Infinity);
        else if (o.isLine && h.index != null) { for (const i of [h.index, h.index + 1]) if (i < pos.count) add(corner(i), 'vertex', 1, near); }
        else if (o.isMesh && h.face) {
          const idx = this._set.has(o) ? snapIndex(o) : null;
          // A CAD file's inner tessellation corners are not features; any other mesh's corners are all it has.
          if (!(idx && idx.cad)) for (const i of [h.face.a, h.face.b, h.face.c]) if (i < pos.count) add(corner(i), 'vertex', 1, near);
        }
      }

      // Every part near the pointer: its corners, midpoints, centres and edges.
      const tanP = near * k * 1.6, tanE = onEdge * k * 1.6;   // cones round the pointer's ray, with room for slanted views
      const lo = new THREE.Vector3(), ld = new THREE.Vector3(), inv = new THREE.Matrix4(), sph = new THREE.Sphere(), c = new THREE.Vector3();
      for (const o of this._list) {
        if (!shown(o)) continue;
        if (o.isInstancedMesh && (!h || h.object !== o || h.instanceId == null)) continue;   // only the copy under the pointer
        const M = matrixOf(o, o.isInstancedMesh ? h.instanceId : null);
        const g = o.geometry;
        if (!g.boundingSphere) g.computeBoundingSphere();
        sph.copy(g.boundingSphere).applyMatrix4(M);
        c.subVectors(sph.center, R.origin);
        const tc = c.dot(R.direction), wide = sph.radius + Math.max(tc + sph.radius, 0) * tanP;
        if (tc < -sph.radius || c.lengthSq() - tc * tc > wide * wide) continue;
        const idx = snapIndex(o);
        if (!idx) continue;
        inv.copy(M).invert();
        lo.copy(R.origin).applyMatrix4(inv);
        ld.copy(R.origin).add(R.direction).applyMatrix4(inv).sub(lo).normalize();
        const sp = idx.sp, sk = idx.spKind;
        for (let i = 0; i < sk.length; i++) {
          const x = sp[i * 3] - lo.x, y = sp[i * 3 + 1] - lo.y, z = sp[i * 3 + 2] - lo.z;
          const t = x * ld.x + y * ld.y + z * ld.z;
          if (t <= 0 || x * x + y * y + z * z - t * t > t * t * tanP * tanP) continue;
          add(new THREE.Vector3(sp[i * 3], sp[i * 3 + 1], sp[i * 3 + 2]).applyMatrix4(M), KINDS[sk[i]], 1, near, { o, M, idx, ri: idx.spRun[i] });
        }
        const sg = idx.seg, sr = idx.segRun;
        for (let i = 0; i < sr.length; i++) {
          const j = i * 6;
          const ax = sg[j] - lo.x, ay = sg[j + 1] - lo.y, az = sg[j + 2] - lo.z;
          const ux = sg[j + 3] - sg[j], uy = sg[j + 4] - sg[j + 1], uz = sg[j + 5] - sg[j + 2];
          // The point of the segment nearest the ray.
          const a = ux * ux + uy * uy + uz * uz, b = ux * ld.x + uy * ld.y + uz * ld.z;
          const d = ux * ax + uy * ay + uz * az, e = ld.x * ax + ld.y * ay + ld.z * az;
          const den = a - b * b;
          let f = den > a * 1e-12 ? (b * e - d) / den : 0;
          f = f < 0 ? 0 : f > 1 ? 1 : f;
          const x = ax + f * ux, y = ay + f * uy, z = az + f * uz;
          const t = x * ld.x + y * ld.y + z * ld.z;
          if (t <= 0 || x * x + y * y + z * z - t * t > t * t * tanE * tanE) continue;
          const p = new THREE.Vector3(x + lo.x, y + lo.y, z + lo.z);
          const run = idx.runs[sr[i]];
          if (run.r) onCircle(p, run);   // on an arc, the curve itself rather than its chord
          add(p.applyMatrix4(M), 'edge', 3, onEdge, { o, M, idx, ri: sr[i] });
        }
      }

      // The flat face under the pointer: its centre, and the perpendicular foot from the last point.
      if (h && h.object.isMesh && h.faceIndex != null && this._set.has(h.object)) {
        const o = h.object, idx = snapIndex(o);
        const f = idx && idx.face ? idx.face[h.faceIndex] : -1;
        if (f >= 0 && idx.faces.flat[f]) {
          const M = matrixOf(o, h.instanceId);
          const C = new THREE.Vector3().fromArray(idx.faces.centre, f * 3), n = new THREE.Vector3().fromArray(idx.faces.normal, f * 3);
          add(C.clone().applyMatrix4(M), 'face', 2, near, { o, M, idx, f });
          if (fromW) {
            const A = fromW.clone().applyMatrix4(inv.copy(M).invert());
            const off = n.dot(A) - n.dot(C);
            if (Math.abs(off) > idx.ext * 1e-6) add(A.addScaledVector(n, -off).applyMatrix4(M), 'perp', 2, near, { o, M, idx, f });
          }
        }
      }
      // …and to a straight edge near the pointer.
      if (fromW) {
        const seen = new Set();
        for (const cd of cands.slice()) {
          if (cd.kind !== 'edge' || seen.has(cd.idx.runs[cd.ri])) continue;
          const run = cd.idx.runs[cd.ri];
          seen.add(run);
          if (run.kind !== 'line') continue;
          const A = new THREE.Vector3().fromArray(run.pts, 0), B = new THREE.Vector3().fromArray(run.pts, run.pts.length - 3);
          const F = fromW.clone().applyMatrix4(inv.copy(cd.M).invert());
          const u = B.clone().sub(A), L2 = u.lengthSq();
          const f = L2 > 0 ? F.clone().sub(A).dot(u) / L2 : -1;
          if (f < 0 || f > 1) continue;
          const foot = A.addScaledVector(u, f);
          if (foot.distanceTo(F) > cd.idx.ext * 1e-6) add(foot.applyMatrix4(cd.M), 'perp', 2, near, { o: cd.o, M: cd.M, idx: cd.idx, ri: cd.ri });
        }
      }
    }

    // The strongest kind, then the nearest, that is in view (not behind the model).
    // (A triangle's bare corner gives way to the same point read as a corner, an end or a centre.)
    const rank = c => c.d + (c.kind === 'vertex' ? 0.5 : 0);
    cands.sort((a, b) => a.tier - b.tier || rank(a) - rank(b));
    let best = null, tests = 0;
    for (const cd of cands) {
      const dist = cd.w.distanceTo(R.origin), tol = dist * k * 3 + v.radius * 1e-6;
      if (h && dist <= h.distance + tol) { best = cd; break; }
      if (tests++ >= SIGHT_TESTS) break;
      this.sight.set(R.origin, cd.w.clone().sub(R.origin).normalize());
      this.sight.near = 0;
      this.sight.far = Math.max(dist - tol, 0);
      if (!this.sight.intersectObject(v.model.content, true).some(x => x.object.isMesh && shown(x.object))) { best = cd; break; }
    }
    if (!best && !h) return null;
    const w = best ? best.w : (h.pointOnLine || h.point).clone();
    const toFile = p => v.orient.worldToLocal(p);
    const out = { p: toFile(w.clone()), snapped: !!best, kind: best ? best.kind : 'surface' };
    if (best && best.ri != null && best.ri >= 0) {
      // The edge it belongs to, drawn while hovering, and its centre if it is round.
      const run = best.idx.runs[best.ri];
      const at = i => toFile(new THREE.Vector3().fromArray(run.pts, i).applyMatrix4(best.M));
      out.path = [];
      for (let i = 0; i < run.pts.length; i += 3) out.path.push(at(i));
      out.shape = run.kind;
      if (run.centre) {
        out.centre = toFile(new THREE.Vector3().fromArray(run.centre).applyMatrix4(best.M));
        if (run.r) out.radius = out.centre.distanceTo(out.path[0]);
      }
    }
    return out;
  }

  _key(e) {
    if (!this.active || e.defaultPrevented || e.altKey || e.metaKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.key === 'Escape') {
      if (this.draft.length) this.cancel(); else this.onExit();
      e.preventDefault();
    } else if (e.key === 'Enter' && this.mode === 'area' && this.draft.length >= 3 && (!t || t.tagName !== 'BUTTON')) {
      this.finish();
      e.preventDefault();
    } else if ((e.key === 'Backspace' && !e.ctrlKey) || (e.key.toLowerCase() === 'z' && e.ctrlKey && !e.shiftKey)) {
      if (this.draft.length || this.items.length) { this.undo(); e.preventDefault(); }
    }
  }

  // ── Drawing ──
  _world(p) { return this.v.orient.localToWorld(p.clone()); }
  _screen(p, w, h) { return toScreen(this._world(p), this.v.camera, w, h); }

  _paint() {
    const c = this.canvas, host = this.v.host;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    if (c.width !== Math.round(w * ratio) || c.height !== Math.round(h * ratio)) { c.width = Math.round(w * ratio); c.height = Math.round(h * ratio); }
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    if (!this.items.length && !this.draft.length && !this.hover) return;
    this.draw(ctx, c.width, c.height, ratio, true);
  }

  /** Draw every measurement onto a 2D context of w × h device pixels, `scale` of them per CSS pixel. */
  draw(ctx, w, h, scale, live = false) {
    if (!this.v.model) return;
    const cw = w / scale, ch = h / scale;
    const S = p => this._screen(p, cw, ch);
    const col = this.colours;
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const labels = [];
    const many = this.items.length > 1;

    const path = (pts, close, dashed) => {
      for (const [width, colour] of [[4.5, col.halo], [2, col.line]]) {
        ctx.beginPath();
        let open = false;
        const all = close ? pts.concat([pts[0]]) : pts;
        for (const s of all) {
          if (!s) { open = false; continue; }
          if (open) ctx.lineTo(s.x, s.y); else { ctx.moveTo(s.x, s.y); open = true; }
        }
        ctx.setLineDash(dashed ? [6, 5] : []);
        ctx.globalAlpha = width > 3 ? 0.75 : 1;
        ctx.lineWidth = width;
        ctx.strokeStyle = colour;
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    };
    const fill = pts => {
      if (pts.length < 3 || pts.some(s => !s)) return;
      ctx.beginPath();
      pts.forEach((s, i) => (i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y)));
      ctx.closePath();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = col.line;
      ctx.fill();
      ctx.globalAlpha = 1;
    };
    const dot = (s, r = 4) => {
      if (!s) return;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fillStyle = col.line;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = col.halo;
      ctx.stroke();
    };
    const mid = ss => {
      const v = ss.filter(Boolean);
      if (!v.length) return null;
      return { x: v.reduce((a, s) => a + s.x, 0) / v.length, y: v.reduce((a, s) => a + s.y, 0) / v.length };
    };
    const u = this.unit, u2 = this.unit ? this.unit + '²' : '';
    const text = (x, unit) => this.format(x) + (unit ? ' ' + unit : '');

    this.items.forEach((it, i) => {
      const ss = it.pts.map(S);
      const f = figures(it.kind, it.pts);
      const tag = many ? (i + 1) + ' · ' : '';
      if (it.kind === 'area') {
        fill(ss); path(ss, true); ss.forEach(s => dot(s, 3));
        const centre = S(centroid(it.pts));
        if (centre) labels.push([centre, tag + text(f.value, u2)]);
      } else {
        path(ss, false); ss.forEach(s => dot(s));
        const m = ss[0] && ss[1] ? mid(ss) : null;
        if (m) labels.push([m, tag + text(f.value, u)]);
      }
    });

    // The one being placed, with a rubber band to the pointer.
    const d = this.draft.slice();
    const hov = live && this.hover ? this.hover.p : null;
    if (d.length) {
      const pts = hov ? d.concat([hov]) : d;
      const ss = pts.map(S);
      if (this.mode === 'area') {
        if (pts.length >= 3) fill(ss);
        path(ss, false);
        if (hov && pts.length >= 3) path([ss[ss.length - 1], ss[0]], false, true);
        d.forEach((p, i) => dot(ss[i], i === 0 && d.length >= 3 ? 5.5 : 3.5));
        if (pts.length >= 3) { const c = S(centroid(pts)); if (c) labels.push([c, text(figures('area', pts).value, u2)]); }
      } else {
        path(ss, false, !!hov);
        dot(ss[0]);
        if (hov && ss[0] && ss[1]) labels.push([mid(ss), text(pts[0].distanceTo(pts[1]), u)]);
      }
    }
    if (hov) this._drawHover(ctx, S, cw, ch);

    // Labels last, so no line crosses one.
    ctx.font = '600 12px "DM Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [s, t] of labels) {
      if (!s) continue;
      const tw = ctx.measureText(t).width + 14, th = 20;
      const x = Math.min(Math.max(s.x, tw / 2 + 2), cw - tw / 2 - 2), y = Math.min(Math.max(s.y - 14, th / 2 + 2), ch - th / 2 - 2);
      ctx.beginPath();
      roundRect(ctx, x - tw / 2, y - th / 2, tw, th, 6);
      ctx.globalAlpha = 0.94;
      ctx.fillStyle = col.panel;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
      ctx.strokeStyle = col.line;
      ctx.stroke();
      ctx.fillStyle = col.text;
      ctx.fillText(t, x, y + 0.5);
    }
    ctx.restore();
  }
}

// ── The hover marker ──
const TAGS = { corner: 'Corner', end: 'End', vertex: 'Vertex', point: 'Point', mid: 'Midpoint', face: 'Face centre', perp: 'Perpendicular' };

Measure.prototype._drawHover = function (ctx, S, cw, ch) {
  const H = this.hover, col = this.colours;
  const s = S(H.p);
  if (!s) return;
  const stroke = (draw, width = 2) => {
    for (const [w, c, a] of [[width + 2.5, col.halo, 0.85], [width, col.line, 1]]) {
      ctx.beginPath(); draw(); ctx.lineWidth = w; ctx.strokeStyle = c; ctx.globalAlpha = a; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  // The edge, arc or outline the point belongs to.
  if (H.path && H.path.length > 1 && !/^(vertex|corner|end)$/.test(H.kind)) {
    const ps = (H.shape === 'circle' || H.shape === 'loop' ? H.path.concat([H.path[0]]) : H.path).map(S);
    ctx.beginPath();
    let open = false;
    for (const q of ps) { if (!q) { open = false; continue; } if (open) ctx.lineTo(q.x, q.y); else { ctx.moveTo(q.x, q.y); open = true; } }
    ctx.lineWidth = 3;
    ctx.strokeStyle = col.line;
    ctx.globalAlpha = 0.45;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // A round edge shows where its centre is, to move to.
  if (H.centre && H.kind !== 'centre') {
    const c = S(H.centre);
    if (c) stroke(() => { ctx.moveTo(c.x - 5, c.y); ctx.lineTo(c.x + 5, c.y); ctx.moveTo(c.x, c.y - 5); ctx.lineTo(c.x, c.y + 5); }, 1.5);
  }
  const { x, y } = s;
  switch (H.kind) {
    case 'corner': case 'end': case 'vertex': case 'point':
      stroke(() => ctx.rect(x - 5, y - 5, 10, 10)); break;
    case 'mid':
      stroke(() => { ctx.moveTo(x, y - 6.5); ctx.lineTo(x + 6, y + 4.5); ctx.lineTo(x - 6, y + 4.5); ctx.closePath(); }); break;
    case 'centre':
      stroke(() => { ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y); ctx.moveTo(x, y - 9); ctx.lineTo(x, y + 9); }); break;
    case 'face':
      stroke(() => { ctx.moveTo(x, y - 7); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 7, y); ctx.closePath(); }); break;
    case 'perp':
      stroke(() => { ctx.moveTo(x - 6, y - 7); ctx.lineTo(x - 6, y + 6); ctx.lineTo(x + 7, y + 6); ctx.moveTo(x - 6, y); ctx.lineTo(x, y); ctx.lineTo(x, y + 6); }); break;
    case 'edge':
      stroke(() => { ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y - 5); ctx.lineTo(x - 5, y + 5); ctx.lineTo(x + 5, y + 5); ctx.closePath(); }); break;
    default:
      stroke(() => ctx.arc(x, y, 4, 0, Math.PI * 2), 1.5);
  }
  if (H.kind !== 'vertex' && H.kind !== 'point') ctx.beginPath(), ctx.arc(x, y, 1.6, 0, Math.PI * 2), ctx.fillStyle = col.line, ctx.fill();
  const tag = this.tag(H);
  if (!tag) return;
  ctx.font = '600 11px "DM Sans", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(tag).width + 12, th = 18;
  let tx = x + 12, ty = y - 24;
  if (tx + tw > cw - 2) tx = x - 12 - tw;
  if (ty < 2) ty = y + 12;
  ty = Math.min(ty, ch - th - 2);
  ctx.beginPath();
  roundRect(ctx, tx, ty, tw, th, 5);
  ctx.globalAlpha = 0.94;
  ctx.fillStyle = col.panel;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
  ctx.strokeStyle = col.border;
  ctx.stroke();
  ctx.fillStyle = col.text;
  ctx.fillText(tag, tx + 6, ty + th / 2 + 0.5);
};

/** The words for what a hover point snapped to ('' on the bare surface). */
Measure.prototype.tag = function (H) {
  if (!H || !H.snapped) return '';
  const u = this.unit ? ' ' + this.unit : '';
  if (H.kind === 'centre') {
    if (H.shape === 'circle' && H.radius) return 'Centre · ⌀ ' + this.format(2 * H.radius) + u;
    if (H.shape === 'arc' && H.radius) return 'Centre · R ' + this.format(H.radius) + u;
    return 'Centre';
  }
  if (H.kind === 'edge') return H.shape === 'arc' || H.shape === 'circle' ? 'On arc' : 'On edge';
  if (H.kind === 'mid' && H.shape === 'arc') return 'Arc midpoint';
  return TAGS[H.kind] || '';
};

// ── The figures ──────────────────────────────────────────────────────────

/** Distance: length and ΔX ΔY ΔZ. Area: the polygon's area, perimeter, and whether its corners lie on one plane. */
export function figures(kind, pts) {
  if (kind === 'distance') {
    const [a, b] = pts;
    return { kind, value: a.distanceTo(b), delta: [b.x - a.x, b.y - a.y, b.z - a.z] };
  }
  const n = pts.length;
  let perimeter = 0;
  // Newell's method: half the length of the summed cross products is the
  // polygon's area for a flat polygon in any orientation.
  const N = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    perimeter += p.distanceTo(q);
    N.x += (p.y - q.y) * (p.z + q.z);
    N.y += (p.z - q.z) * (p.x + q.x);
    N.z += (p.x - q.x) * (p.y + q.y);
  }
  const area = N.length() / 2;
  let planar = true;
  if (area > 0) {
    N.normalize();
    const o = centroid(pts, c);
    const off = Math.max(...pts.map(p => Math.abs(N.dot(p) - N.dot(o))));
    planar = off <= perimeter * 1e-3;
  }
  return { kind, value: area, perimeter, corners: n, planar };
}

function centroid(pts, out = new THREE.Vector3()) {
  out.set(0, 0, 0);
  for (const p of pts) out.add(p);
  return out.divideScalar(pts.length || 1);
}

function toScreen(world, camera, w, h) {
  const v = world.clone().applyMatrix4(camera.matrixWorldInverse);
  if (v.z > -camera.near * 0.5) return null;   // behind the camera
  v.applyMatrix4(camera.projectionMatrix);
  return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h };
}

/** Where a part sits in the world (one copy of an instanced part). */
function matrixOf(o, instanceId) {
  if (o.isInstancedMesh && instanceId != null) {
    const m = new THREE.Matrix4();
    o.getMatrixAt(instanceId, m);
    return m.premultiply(o.matrixWorld);
  }
  return o.matrixWorld;
}

/** A point on an arc's chord, moved onto the arc (all in the part's axes). */
function onCircle(p, run) {
  const c = new THREE.Vector3().fromArray(run.centre), n = new THREE.Vector3().fromArray(run.normal);
  p.sub(c);
  p.addScaledVector(n, -p.dot(n));
  const l = p.length();
  if (l > 0) p.multiplyScalar(run.r / l);
  return p.add(c);
}

function shown(o) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return !o.userData.o3vEdge;
}

function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
