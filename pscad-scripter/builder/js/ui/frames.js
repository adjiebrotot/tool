// The outline of a loop frame that hugs its blocks rather than boxing them in: every block's box
// grown by a margin, the gaps between neighbours closed (a morphological closing on an 8-unit
// grid: a gap narrower than `bridge` fills in, a wide empty area beside a row stays out), traced
// as rounded outlines. A row of blocks becomes one band, a block under the row joins it as an
// L; blocks too far apart stay one frame, joined by a thin corridor (`corridor` units across).
// Plain functions, no DOM.

const CELL = 8;

// rects: [{ x1, y1, x2, y2 }] in canvas units. Returns null for no rects, else
// { d (SVG path, even-odd), box (bounds of the outline), tabs ([{ x, y }]: the left end of each
// piece's top edge, where its name tab sits on the line), hit(x, y) (inside the frame?) }.
export function frameShape(rects, { pad = 14, bridge = 80, radius = 12, corridor = 16 } = {}) {
  if (!rects.length) return null;
  const r = Math.max(1, Math.ceil(bridge / 2 / CELL));
  let bx1 = Infinity, by1 = Infinity, bx2 = -Infinity, by2 = -Infinity;
  for (const q of rects) { bx1 = Math.min(bx1, q.x1 - pad); by1 = Math.min(by1, q.y1 - pad); bx2 = Math.max(bx2, q.x2 + pad); by2 = Math.max(by2, q.y2 + pad); }
  const gx0 = Math.floor(bx1 / CELL) - r - 2, gy0 = Math.floor(by1 / CELL) - r - 2;
  const w = Math.ceil(bx2 / CELL) + r + 2 - gx0, h = Math.ceil(by2 / CELL) + r + 2 - gy0;
  let a = new Uint8Array(w * h);
  for (const q of rects) {
    const cx1 = Math.floor((q.x1 - pad) / CELL) - gx0, cx2 = Math.ceil((q.x2 + pad) / CELL) - gx0;
    const cy1 = Math.floor((q.y1 - pad) / CELL) - gy0, cy2 = Math.ceil((q.y2 + pad) / CELL) - gy0;
    for (let y = cy1; y < cy2; y++) a.fill(1, y * w + cx1, y * w + cx2);
  }
  // Closing: grow by r cells, then shrink by r cells (each a running count along rows, then columns).
  const pass = (src, alongRows, grow) => {
    const out = new Uint8Array(w * h), n = 2 * r + 1;
    const lines = alongRows ? h : w, len = alongRows ? w : h;
    const at = alongRows ? (i, k) => i * w + k : (i, k) => k * w + i;
    for (let i = 0; i < lines; i++) {
      let count = 0;
      for (let k = -r; k < len + r; k++) {
        const kin = k + r, kout = k - r - 1;
        if (kin >= 0 && kin < len) count += src[at(i, kin)];
        if (kout >= 0 && kout < len) count -= src[at(i, kout)];
        if (k >= 0 && k < len) out[at(i, k)] = grow ? (count > 0 ? 1 : 0) : (count === n ? 1 : 0);
      }
    }
    return out;
  };
  a = pass(pass(a, true, true), false, true);
  a = pass(pass(a, true, false), false, false);
  // What counts as inside for hit(): the closing alone, so a block crossed by a corridor below
  // does not read as drawn inside the frame.
  const body = a;
  a = joinPieces(a, w, h, Math.max(1, Math.round(corridor / CELL)));
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && a[y * w + x] === 1;
  const inBody = (x, y) => x >= 0 && y >= 0 && x < w && y < h && body[y * w + x] === 1;

  // Trace the edges between filled and empty cells into closed loops (clockwise round the filled
  // side), then drop the points in the middle of straight runs.
  const out = new Map();
  const add = (x1, y1, x2, y2) => { const k = x1 + ',' + y1; if (!out.has(k)) out.set(k, []); out.get(k).push([x2, y2]); };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!on(x, y)) continue;
    if (!on(x, y - 1)) add(x, y, x + 1, y);
    if (!on(x + 1, y)) add(x + 1, y, x + 1, y + 1);
    if (!on(x, y + 1)) add(x + 1, y + 1, x, y + 1);
    if (!on(x - 1, y)) add(x, y + 1, x, y);
  }
  const loops = [];
  for (const [k0, list0] of out) {
    while (list0.length) {
      const [sx, sy] = k0.split(',').map(Number);
      const pts = [[sx, sy]];
      let cur = list0.pop();
      while (cur && !(cur[0] === sx && cur[1] === sy)) {
        pts.push(cur);
        const nx = out.get(cur[0] + ',' + cur[1]);
        cur = nx && nx.length ? nx.pop() : null;
      }
      const simple = pts.filter((p, i) => {
        const q = pts[(i - 1 + pts.length) % pts.length], s = pts[(i + 1) % pts.length];
        return !((q[0] === p[0] && p[0] === s[0]) || (q[1] === p[1] && p[1] === s[1]));
      });
      if (simple.length >= 4) loops.push(simple.map(([x, y]) => [(gx0 + x) * CELL, (gy0 + y) * CELL]));
    }
  }

  // Rounded corners, the same radius inside and out (smaller where an edge is short).
  const fx = (v) => (Math.round(v * 10) / 10).toString();
  let d = '', box = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
  const tabs = [];
  for (const L of loops) {
    const n = L.length;
    L.forEach((v, i) => {
      const p = L[(i - 1 + n) % n], q = L[(i + 1) % n];
      const d1 = Math.hypot(p[0] - v[0], p[1] - v[1]), d2 = Math.hypot(q[0] - v[0], q[1] - v[1]);
      const rr = Math.min(radius, d1 / 2, d2 / 2);
      const s = [v[0] + (p[0] - v[0]) / d1 * rr, v[1] + (p[1] - v[1]) / d1 * rr];
      const e = [v[0] + (q[0] - v[0]) / d2 * rr, v[1] + (q[1] - v[1]) / d2 * rr];
      d += (i ? 'L' : 'M') + fx(s[0]) + ' ' + fx(s[1]) + 'Q' + fx(v[0]) + ' ' + fx(v[1]) + ' ' + fx(e[0]) + ' ' + fx(e[1]);
      box = { x1: Math.min(box.x1, v[0]), y1: Math.min(box.y1, v[1]), x2: Math.max(box.x2, v[0]), y2: Math.max(box.y2, v[1]) };
    });
    d += 'Z';
    // An outer outline runs clockwise (a hole the other way): its top edge, left end first.
    const area = L.reduce((s, v, i) => { const q = L[(i + 1) % n]; return s + v[0] * q[1] - q[0] * v[1]; }, 0);
    if (area > 0) {
      const top = Math.min(...L.map(v => v[1]));
      const left = Math.min(...L.filter((v, i) => v[1] === top && L[(i + 1) % n][1] === top).map(v => v[0]));
      tabs.push({ x: left, y: top });
    }
  }
  tabs.sort((s, t) => s.y - t.y || s.x - t.x);
  const hit = (x, y) => inBody(Math.floor(x / CELL) - gx0, Math.floor(y / CELL) - gy0);
  return { d, box, tabs, hit };
}

// One frame is one loop, so it is drawn as one piece: pieces the closing left apart are joined by
// thin corridors (`wide` cells across). One search grows every piece out at once through the
// empty cells; where two growths meet, the cells they started from are the nearest pair of those
// two pieces. The shortest set of such links that joins every piece (Kruskal) is drawn, each as
// an L: along the row of one end, then along the column of the other.
function joinPieces(src, w, h, wide) {
  const a = src.slice(), n = w * h;
  const label = new Int32Array(n).fill(-1), from = new Int32Array(n).fill(-1), dist = new Int32Array(n);
  let pieces = 0, q = [];
  for (let i = 0; i < n; i++) {
    if (!a[i] || label[i] >= 0) continue;
    const stack = [i]; label[i] = pieces;
    while (stack.length) {
      const c = stack.pop(), x = c % w, y = (c - x) / w;
      from[c] = c; q.push(c);
      if (x + 1 < w && a[c + 1] && label[c + 1] < 0) { label[c + 1] = pieces; stack.push(c + 1); }
      if (x > 0 && a[c - 1] && label[c - 1] < 0) { label[c - 1] = pieces; stack.push(c - 1); }
      if (y + 1 < h && a[c + w] && label[c + w] < 0) { label[c + w] = pieces; stack.push(c + w); }
      if (y > 0 && a[c - w] && label[c - w] < 0) { label[c - w] = pieces; stack.push(c - w); }
    }
    pieces++;
  }
  if (pieces < 2) return a;
  const best = new Map();   // "p,q" (p < q) -> { len, s, t }
  const meet = (c, k) => {
    const p = label[c], r = label[k];
    if (p === r) return;
    const key = p < r ? p + ',' + r : r + ',' + p, len = dist[c] + dist[k] + 1, e = best.get(key);
    if (!e || len < e.len) best.set(key, { len, p, r, s: from[c], t: from[k] });
  };
  for (let head = 0; head < q.length; head++) {
    const c = q[head], x = c % w, y = (c - x) / w;
    const step = (k) => {
      if (from[k] < 0) { from[k] = from[c]; label[k] = label[c]; dist[k] = dist[c] + 1; q.push(k); }
      else meet(c, k);
    };
    if (x + 1 < w) step(c + 1);
    if (x > 0) step(c - 1);
    if (y + 1 < h) step(c + w);
    if (y > 0) step(c - w);
  }
  const root = Array.from({ length: pieces }, (_, i) => i);
  const find = (i) => { while (root[i] !== i) i = root[i] = root[root[i]]; return i; };
  const lo = Math.floor((wide - 1) / 2), hi = wide - 1 - lo;
  const fill = (x1, y1, x2, y2) => {
    for (let y = Math.max(0, Math.min(y1, y2)); y <= Math.min(h - 1, Math.max(y1, y2)); y++)
      for (let x = Math.max(0, Math.min(x1, x2)); x <= Math.min(w - 1, Math.max(x1, x2)); x++) a[y * w + x] = 1;
  };
  for (const e of [...best.values()].sort((u, v) => u.len - v.len)) {
    const p = find(e.p), r = find(e.r);
    if (p === r) continue;
    root[p] = r;
    const sx = e.s % w, sy = (e.s - sx) / w, tx = e.t % w, ty = (e.t - tx) / w;
    fill(sx, sy - lo, tx + (tx >= sx ? hi : -lo), sy + hi);
    fill(tx - lo, sy, tx + hi, ty);
  }
  return a;
}
