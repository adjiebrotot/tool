// The outline of a loop frame that hugs its blocks rather than boxing them in: every block's box
// grown by a margin, the gaps between neighbours closed (a morphological closing on an 8-unit
// grid: a gap narrower than `bridge` fills in, a wide empty area beside a row stays out), traced
// as rounded outlines. A row of blocks becomes one band, a block under the row joins it as an
// L; blocks too far apart are separate pieces, each outlined. Plain functions, no DOM.

const CELL = 8;

// rects: [{ x1, y1, x2, y2 }] in canvas units. Returns null for no rects, else
// { d (SVG path, even-odd), box (bounds of the outline), tabs ([{ x, y }]: the left end of each
// piece's top edge, where its name tab sits on the line), hit(x, y) (inside the frame?) }.
export function frameShape(rects, { pad = 14, bridge = 80, radius = 12 } = {}) {
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
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && a[y * w + x] === 1;

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
  const hit = (x, y) => on(Math.floor(x / CELL) - gx0, Math.floor(y / CELL) - gy0);
  return { d, box, tabs, hit };
}
