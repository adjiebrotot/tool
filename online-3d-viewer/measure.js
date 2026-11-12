/* The ruler: distances and areas picked on the model.

   A click on the model places a point; it snaps to the corner of the
   triangle (or the point, or the end of the line) under the pointer when
   that corner is within a few pixels, so CAD corners measure exactly.
   Distance: two points make one measurement. Area: the corners of a
   polygon, closed on its first point, a double-click or Enter.

   Points are kept in the file's own axes and unit (the viewer's `orient`
   group: no scale, only the Up turn and the centring move), so flipping Up
   keeps them on the model, and ΔX / ΔY / ΔZ read along the file's axes.

   Lines and labels are drawn on a 2D canvas over the 3D view after each
   frame, and again onto the PNG (Viewer.decorate), so a saved picture
   shows them too. A drag still turns the view: only a click places. */

import * as THREE from 'three';

const SNAP_PX = 12;          // a corner this close to the pointer is taken instead
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
    this.hover = null;   // { p, snapped } under a mouse, while active
    this.unit = '';
    this.colours = { line: '#3B82F6', halo: '#FFFFFF', text: '#14203A', panel: '#FFFFFF', border: '#C8D4E8' };
    this.ray = new THREE.Raycaster();

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
    this._place(e.clientX, e.clientY);
  }

  _pointerMove(e) {
    if (!this.active || e.pointerType !== 'mouse' || e.buttons) return;
    if (!this.v.model || this.v.model.stats.triangles > HOVER_TRIS) return;
    this._hoverAt = [e.clientX, e.clientY];
    if (this._hoverRaf) return;
    this._hoverRaf = requestAnimationFrame(() => {
      this._hoverRaf = 0;
      if (!this.active) return;
      this.hover = this.pick(this._hoverAt[0], this._hoverAt[1]);
      this._changed(false);
    });
  }

  _place(cx, cy) {
    const hit = this.pick(cx, cy);
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

  /** The model point under a screen position, in the file's axes, snapped to a near corner. */
  pick(cx, cy) {
    const v = this.v;
    if (!v.model) return null;
    const el = v.renderer.domElement;
    const rect = el.getBoundingClientRect();
    const sx = cx - rect.left, sy = cy - rect.top;
    const ndc = new THREE.Vector2((sx / rect.width) * 2 - 1, -(sy / rect.height) * 2 + 1);
    // What one screen pixel spans at the point the view turns about.
    const px = 2 * v.camera.position.distanceTo(v.controls.target) * Math.tan(THREE.MathUtils.degToRad(v.camera.fov) / 2) / rect.height;
    this.ray.setFromCamera(ndc, v.camera);
    this.ray.params.Points.threshold = px * 6;
    this.ray.params.Line.threshold = px * 5;
    v.scene.updateMatrixWorld();
    const hits = this.ray.intersectObject(v.model.content, true).filter(h => shown(h.object));
    if (!hits.length) return null;
    const h = hits[0];
    const o = h.object;
    let point = (h.pointOnLine || h.point).clone();
    // The corners near the hit: the triangle's three, the point itself, or the segment's two ends.
    const idx = [];
    if (h.face) idx.push(h.face.a, h.face.b, h.face.c);
    else if (o.isPoints && h.index != null) idx.push(h.index);
    else if (o.isLine && h.index != null) idx.push(h.index, h.index + 1);
    let best = null, bestD = SNAP_PX;
    const pos = o.geometry.getAttribute('position');
    const w = new THREE.Vector3(), m = new THREE.Matrix4();
    for (const i of idx) {
      if (i < 0 || i >= pos.count) continue;
      if (o.isMesh && o.getVertexPosition) o.getVertexPosition(i, w); else w.fromBufferAttribute(pos, i);
      if (o.isInstancedMesh && h.instanceId != null) { o.getMatrixAt(h.instanceId, m); w.applyMatrix4(m); }
      w.applyMatrix4(o.matrixWorld);
      const s = toScreen(w, v.camera, rect.width, rect.height);
      if (!s) continue;
      const d = Math.hypot(s.x - sx, s.y - sy);
      if (d <= bestD) { bestD = d; best = w.clone(); }
    }
    if (o.isPoints && !best && h.index != null) best = w.fromBufferAttribute(pos, h.index).applyMatrix4(o.matrixWorld).clone();
    if (best) point = best;
    return { p: v.orient.worldToLocal(point), snapped: !!best };
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
    if (hov) {
      const s = S(hov);
      if (s) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, this.hover.snapped ? 6 : 4, 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = col.line;
        ctx.stroke();
        if (this.hover.snapped) { ctx.beginPath(); ctx.arc(s.x, s.y, 2, 0, Math.PI * 2); ctx.fillStyle = col.line; ctx.fill(); }
      }
    }

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
