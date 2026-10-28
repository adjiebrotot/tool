// The Graph style preview: a sample graph drawn as SVG the way runtime/outputs.py lays it out
// with matplotlib (tight_layout's padding, the key's places, the tick spacing of MaxNLocator,
// the value axis ending on a tick), from the same style, so what the reader picks here is what
// the script draws. It is a likeness, not matplotlib: text widths come from the browser's own
// font, and a computer without the chosen font draws with the one it falls back to.
//
// previewSvg(style, { kind, width, thumb }) -> SVG markup. kind: one of PREVIEW_KINDS, a graph
// the script draws: 'series' (three frequency traces, an event, a limit and the nadir), 'many'
// (twelve passes on one graph: the paler second round and the ramp), 'xy' (2D lines with a dot
// at each value), 'points', 'bars', 'conv' (an Optimise search, try by try), 'heat' (a heat map
// and its colour bar), 'surface', 'wire' and 'points3d' (3D graphs).
// thumb: a small card for a template (no words; the title as a bar).

import { normalizeStyle, seriesColors, rampAt, mixColor, luminance, RAMPS, LINE_DASHES, fontCss } from '../core/graphstyle.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n2 = (v) => (Math.round(v * 100) / 100).toString();

// ---- Text widths, in points, from the browser's font.
let ctx2d = null;
function textWidth(text, sizePt, family, bold) {
  if (!ctx2d) { try { ctx2d = document.createElement('canvas').getContext('2d'); } catch (e) { ctx2d = null; } }
  if (!ctx2d) return String(text).length * sizePt * 0.55;
  ctx2d.font = (bold ? '700 ' : '400 ') + '100px ' + family;
  return ctx2d.measureText(String(text)).width * sizePt / 100;
}

// The height matplotlib gives a line of text: from the top of "l" to the foot of "p", in points.
function textHeight(sizePt, family) {
  if (!ctx2d) textWidth('', sizePt, family);
  if (!ctx2d) return sizePt;
  ctx2d.font = '400 100px ' + family;
  const m = ctx2d.measureText('lp');
  const h = (m.actualBoundingBoxAscent || 0) + (m.actualBoundingBoxDescent || 0);
  return h > 0 ? h * sizePt / 100 : sizePt;
}

// ---- Sample data (the same traces the audit renders with matplotlib, for comparing).
function dip(t, depth = 0.9, tau = 1.2, rec = 0.35) {
  if (t < 1) return 50;
  const x = t - 1;
  return 50 - depth * (1 - Math.exp(-x / tau)) * Math.exp(-x / 6) - rec * (1 - Math.exp(-x / 3)) + 0.05 * Math.sin(x * 2) * Math.exp(-x / 3);
}
// A fixed sequence of numbers in [0, 1), so a sample of scattered points looks the same each time.
function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const r3 = (v) => Math.round(v * 1000) / 1000;
const TS = Array.from({ length: 401 }, (_, i) => i * 0.05);
const loss = (a, b) => r3(0.8 + a * a / 40000 + b * b / 9000);
const GRID3 = { xs: [100, 125, 150, 175, 200, 225, 250, 275, 300], ys: [-50, -25, 0, 25, 50, 75, 100] };
const SAMPLES = {
  series: () => ({
    title: 'Frequency after G2 trip', xlabel: 'Time (s)', ylabel: 'Frequency (Hz)', xtight: true,
    lines: [[0.9, 1.2, 0.35], [0.75, 1.0, 0.3], [0.6, 0.8, 0.25]].map((p, i) => ({ label: 'Bus ' + [5, 7, 9][i] + ' m:fehz', x: TS, y: TS.map(t => dip(t, ...p)) })),
    event: { x: 1, label: 'G2 trip' }, limit: { y: 49.2, label: 'UFLS 49.2 Hz' }, mark: { line: 0, label: 'Nadir 49.26 Hz' },
  }),
  many: () => ({
    title: 'Frequency, every pass', xlabel: 'Time (s)', ylabel: 'Frequency (Hz)', xtight: true,
    lines: Array.from({ length: 12 }, (_, i) => ({ label: 'Dispatch (MW) = ' + (100 + 25 * i), x: TS, y: TS.map(t => dip(t, 0.35 + 0.06 * i, 1.1, 0.12 + 0.025 * i)) })),
  }),
  // plot_xy / plot_table, kind "line": a dot at each value (the style's "Points on 2D lines").
  xy: () => {
    const xs = Array.from({ length: 13 }, (_, i) => 100 + 25 * i);
    return {
      title: 'Nadir against dispatch', xlabel: 'Dispatch (MW)', ylabel: 'Nadir (Hz)', dots: true,
      lines: [['Base', 0], ['N-1', 0.12], ['Low inertia', 0.22]].map(([label, d]) => ({ label, x: xs, y: xs.map(p => r3(49.9 - d - 0.0021 * (p - 100) - 0.0000018 * (p - 100) ** 2)) })),
      limit: { y: 49.2, label: 'UFLS 49.2 Hz' },
    };
  },
  // plot_xy / plot_table, kind "scatter".
  points: () => {
    const rnd = seeded(7);
    const group = (label, off) => {
      const x = [], y = [];
      for (let i = 0; i < 18; i++) { const hh = 2 + rnd() * 6; x.push(r3(hh)); y.push(r3(48.95 + off + 0.09 * hh + (rnd() - 0.5) * 0.14)); }
      return { label, x, y, mark: 'dot', noLine: true };
    };
    return { title: 'Nadir against inertia', xlabel: 'Inertia H (s)', ylabel: 'Nadir (Hz)', lines: [group('Base', 0.12), group('N-1', -0.05)] };
  },
  bars: () => ({
    title: 'Line loading', ylabel: 'Loading (%)', cats: ['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5'],
    bars: [{ label: 'Base', y: [62, 81, 95, 71, 55] }, { label: 'N-1', y: [74, 97, 108, 85, 63] }],
    limit: { y: 100, label: '100 %' },
  }),
  // plot_convergence, kind "optimise": the score of every try, the tries that were not
  // candidates, the failed ones as crosses along the bottom, and the best so far.
  conv: () => {
    const rnd = seeded(11);
    const good = { x: [], y: [] }, other = { x: [], y: [] }, failed = { x: [], y: [] };
    let best = Infinity;
    const bx = [], by = [];
    for (let i = 1; i <= 30; i++) {
      const s = r3(20 + 110 * Math.exp(-i / 7) + rnd() * 18);
      if ([6, 13, 19].includes(i)) { failed.x.push(i); failed.y.push(0.02); continue; }
      if ([4, 9, 16, 23].includes(i)) { other.x.push(i); other.y.push(r3(s + 12)); continue; }
      good.x.push(i); good.y.push(s);
      best = Math.min(best, s); bx.push(i); by.push(best);
    }
    return {
      title: 'Optimise: score per try', xlabel: 'Try', ylabel: 'Score', integer: true, colors2: true,
      lines: [
        { label: 'Score of the try', ...good, mark: 'dot', size: 6, noLine: true, ci: 0 },
        { label: 'Not a candidate (a check failed)', ...other, mark: 'ring', size: 6, noLine: true, color: '#898781' },
        { label: 'Failed or no score', ...failed, mark: 'x', size: 7, noLine: true, color: '#d03b3b', axesY: true },
        { label: 'Best so far', x: bx, y: by, step: true, lw: 1.1, ci: 1 },
      ],
    };
  },
  heat: () => {
    const xs = [100, 150, 200, 250, 300], ys = [-50, 0, 50, 100];
    return { title: 'Losses', xlabel: 'Dispatch (MW)', ylabel: 'Q (Mvar)', zlabel: 'Loss (MW)', xs, ys, z: ys.map(b => xs.map(a => Math.round((0.8 + a * a / 40000 + Math.abs(b) / 120) * 1000) / 1000)) };
  },
  // plot_3d over a grid of x and y: a surface (with its colour bar) or a wire frame.
  surface: () => ({ title: 'Losses', xlabel: 'Dispatch (MW)', ylabel: 'Q (Mvar)', zlabel: 'Loss (MW)', d3: 'surface', ...GRID3, z: GRID3.ys.map(b => GRID3.xs.map(a => loss(a, b))) }),
  wire: () => ({ title: 'Losses', xlabel: 'Dispatch (MW)', ylabel: 'Q (Mvar)', zlabel: 'Loss (MW)', d3: 'wire', ...GRID3, z: GRID3.ys.map(b => GRID3.xs.map(a => loss(a, b))) }),
  // plot_3d of points that do not fill a grid (or kind "scatter"): dots coloured by z.
  points3d: () => {
    const rnd = seeded(5);
    const pts = Array.from({ length: 40 }, () => { const a = 100 + rnd() * 200, b = -50 + rnd() * 150; return [r3(a), r3(b), loss(a, b)]; });
    return { title: 'Losses', xlabel: 'Dispatch (MW)', ylabel: 'Q (Mvar)', zlabel: 'Loss (MW)', d3: 'points', pts };
  },
};

// ---- Ticks as matplotlib's MaxNLocator picks them (steps 1, 2, 2.5, 5, 10).
function niceTicks(lo, hi, nbins, integer) {
  if (!(hi > lo)) return [lo];
  const raw = (hi - lo) / Math.max(1, nbins);
  const mag = 10 ** Math.floor(Math.log10(raw));
  for (const s of [1, 2, 2.5, 5, 10, 20]) {
    const step = s * mag;
    if (integer && step < 1 || integer && !Number.isInteger(Math.round(step * 1e9) / 1e9)) continue;
    const first = Math.floor(lo / step + 1e-9) * step, last = Math.ceil(hi / step - 1e-9) * step;
    if ((last - first) / step <= nbins + 1e-9) {
      const out = [];
      for (let v = first; v <= last + step * 1e-6; v += step) out.push(Math.round(v / step) * step);
      return out;
    }
  }
  return [lo, hi];
}
function fmtTick(v, ticks, thousands, yearAxis) {
  const step = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) : 1;
  const e = Math.floor(Math.log10(step) + 1e-9), mant = Math.round(step / 10 ** e * 1000) / 1000;
  const dec = Math.max(0, Math.min(6, -e + (Number.isInteger(mant) ? 0 : 1)));
  let t = Math.abs(v) < step * 1e-9 ? (0).toFixed(dec) : v.toFixed(dec);
  if (thousands && !yearAxis) t = t.replace(/^(-?)(\d{4,})/, (m, s, d) => s + Number(d).toLocaleString('en-US'));
  return t.replace(/^-/, '−');
}

// Where a mark's label may go around its point, as outputs.py _po_mark_spots has them: points
// right and up from the point, how the label hangs from there, and what being further out costs.
export const MARK_SPOTS = (() => {
  const out = [[9, 0, 'left', 'center', 2], [-9, 0, 'right', 'center', 4]];
  for (let d = 4; d < 50; d += 2) {
    for (const [dx, ha, side] of [[6, 'left', 0], [-6, 'right', 2], [0, 'center', 3]]) {
      if (ha === 'center' && d < 8) continue;
      out.push([dx, -d, ha, 'top', d * 0.8 + side], [dx, d, ha, 'bottom', d * 0.8 + side + 4]);
    }
  }
  return out;
})();

// Where a key inside the graph may go, in turn (outputs.py _PO_INSIDE_LOCS): the first that
// covers nothing drawn is taken; with none clear the key goes under the graph.
export const INSIDE_LOCS = ['upper right', 'upper left', 'lower left', 'lower right', 'center right', 'center left', 'upper center', 'lower center'];

// Every line a pass of one loop ("Dispatch (MW) = 100" ...): the loop's name as the key's
// title, each line named by its value (outputs.py _po_key_title). Null otherwise.
export function keyTitle(labels) {
  const parts = labels.map(v => { const s = String(v), i = s.indexOf(' = '); return i < 0 ? null : [s.slice(0, i), s.slice(i + 3)]; });
  if (parts.length < 2 || parts.some(p => !p || !p[0].trim() || p[1].includes(' = '))) return null;
  return parts.every(p => p[0] === parts[0][0]) ? parts[0][0] : null;
}

// The length of the segment (x0, y0)-(x1, y1) inside box [left, top, right, bottom].
function segIn(x0, y0, x1, y1, b) {
  const dx = x1 - x0, dy = y1 - y0;
  let lo = 0, hi = 1;
  for (const [p, q] of [[-dx, x0 - b[0]], [dx, b[2] - x0], [-dy, y0 - b[1]], [dy, b[3] - y0]]) {
    if (p === 0) { if (q < 0) return 0; continue; }
    const u = q / p;
    if (p < 0) lo = Math.max(lo, u); else hi = Math.min(hi, u);
    if (lo > hi) return 0;
  }
  return (hi - lo) * Math.hypot(dx, dy);
}
const overlaps = (a, b) => Math.min(a[2], b[2]) > Math.max(a[0], b[0]) && Math.min(a[3], b[3]) > Math.max(a[1], b[1]);

// The spot that crosses the least (outputs.py _po_place_marks): segments are lines to keep
// clear of, boxes other words, frame the plot. Returns the label's box [left, top, right, bottom].
function placeLabel(cx, cy, w, h, segs, boxes, frame) {
  const pad = 3;
  let best = null;
  for (const [dx, dy, ha, va, further] of MARK_SPOTS) {
    const x = cx + dx, y = cy - dy;
    const x0 = ha === 'left' ? x : ha === 'right' ? x - w : x - w / 2;
    const y0 = va === 'top' ? y : va === 'bottom' ? y - h : y - h / 2;
    const b = [x0 - pad, y0 - pad, x0 + w + pad, y0 + h + pad];
    const area = Math.max(1, (b[2] - b[0]) * (b[3] - b[1]));
    const inside = Math.max(0, Math.min(b[2], frame[2]) - Math.max(b[0], frame[0])) * Math.max(0, Math.min(b[3], frame[3]) - Math.max(b[1], frame[1]));
    let cost = (area - inside) / area * 1000 + further;
    for (const o of boxes) {
      const ow = Math.min(b[2], o[2]) - Math.max(b[0], o[0]), oh = Math.min(b[3], o[3]) - Math.max(b[1], o[1]);
      if (ow > 0 && oh > 0) cost += 400 + ow * oh / area * 400;
    }
    let run = 0;
    for (const sg of segs) run += segIn(sg[0], sg[1], sg[2], sg[3], b);
    if (run > 0) cost += 150 + 8 * run;
    if (!best || cost < best.cost) best = { cost, box: [x0, y0, x0 + w, y0 + h] };
  }
  return best.box;
}

// ---- The preview
export function previewSvg(style0, opts = {}) {
  const st = normalizeStyle(style0);
  const kind = SAMPLES[opts.kind] ? opts.kind : 'series';
  const S = SAMPLES[kind]();
  const thumb = !!opts.thumb;
  const FW = st.width * 72, FH = st.height * 72;           // the figure in points
  const PW = Math.max(60, opts.width || 520), k = PW / FW, PH = FH * k;
  const fam = fontCss(st.font);
  const fs = st.font_size, lab = fs * 1.05, lh = 1.17;    // text sizes (pt) and line height
  const out = [];
  const px = (v) => n2(v * k);
  const text = (x, y, s, size, color, o = {}) => {
    if (thumb) return;
    out.push('<text x="' + px(x) + '" y="' + px(y) + '" font-size="' + px(size) + '" fill="' + color + '"' +
      (o.anchor ? ' text-anchor="' + o.anchor + '"' : '') + (o.bold ? ' font-weight="700"' : '') +
      (o.base ? ' dominant-baseline="' + o.base + '"' : '') + (o.rot ? ' transform="rotate(' + n2(o.rot) + ' ' + px(x) + ' ' + px(y) + ')"' : '') +
      (o.op ? ' opacity="' + o.op + '"' : '') + '>' + esc(s) + '</text>');
  };
  const line = (x1, y1, x2, y2, color, w, dash) => out.push('<line x1="' + px(x1) + '" y1="' + px(y1) + '" x2="' + px(x2) + '" y2="' + px(y2) + '" stroke="' + color + '" stroke-width="' + n2(Math.max(0.5, w * k)) + '"' + (dash ? ' stroke-dasharray="' + dash.map(d => n2(d * k)).join(' ') + '"' : '') + '/>');
  const dashOf = (g) => (g === 'dashed' ? [4 * 0.7, 3 * 0.7] : g === 'dotted' ? [0.7, 2.5 * 0.7] : null);
  // A line's pattern (line_styles "vary"), scaled by the line width as matplotlib does.
  const lineDash = (i, lw) => {
    const d = st.line_styles === 'vary' && i >= 0 ? LINE_DASHES[i % LINE_DASHES.length] : null;
    return d ? ' stroke-dasharray="' + d.map(v => n2(v * lw * k)).join(' ') + '" stroke-linecap="butt"' : ' stroke-linecap="round"';
  };
  // A marker of diameter size (pt): a dot (edged in the plot's colour), a ring or a cross.
  const marker = (x, y, m, color, size, edge) => {
    const r = size / 2;
    if (m === 'x') {
      out.push('<path d="M' + px(x - r) + ' ' + px(y - r) + 'L' + px(x + r) + ' ' + px(y + r) + 'M' + px(x - r) + ' ' + px(y + r) + 'L' + px(x + r) + ' ' + px(y - r) + '" stroke="' + color + '" stroke-width="' + n2(Math.max(0.5, k)) + '" fill="none"/>');
    } else if (m === 'ring') {
      out.push('<circle cx="' + px(x) + '" cy="' + px(y) + '" r="' + px(r) + '" fill="none" stroke="' + color + '" stroke-width="' + n2(Math.max(0.5, k)) + '"/>');
    } else {
      out.push('<circle cx="' + px(x) + '" cy="' + px(y) + '" r="' + px(r) + '" fill="' + color + '"' + (edge ? ' stroke="' + edge.color + '" stroke-width="' + n2(edge.w * k) + '"' : '') + '/>');
    }
  };

  if (S.d3) return preview3d(st, S, { FW, FH, PW, PH, k, fam, fs, lab, lh, thumb, out, px, text, line });

  // Series colours and the legend entries.
  const nSeries = S.lines ? S.lines.length : S.bars ? S.bars.length : 0;
  const colors = S.colors2 ? seriesColors(st, 2) : seriesColors(st, nSeries);
  const lineColor = (l, i) => l.color || (S.colors2 ? colors[l.ci === 1 ? colors.length - 1 : 0] : colors[i]);
  // What each line is drawn as: its line, and a marker (a dot at each value of a 2D line when the
  // style asks for one: always, or "auto" up to 40 values; time series never have them).
  const lwOf = (l) => st.line_width * (l && l.lw || 1);
  const markOf = (l) => {
    if (l.mark === 'dot' && l.noLine && !l.size) return { m: 'dot', size: Math.max(5, st.line_width * 3), edge: { color: st.plot_background, w: 1 } };
    if (l.mark) return { m: l.mark, size: l.size, edge: l.mark === 'dot' ? { color: st.plot_background, w: 1 } : null };
    if (S.dots && (st.markers === 'always' || (st.markers === 'auto' && l.x.length <= 40))) return { m: 'dot', size: Math.max(3.5, st.line_width * 2.2), edge: null };
    return null;
  };
  const allLabels = (S.lines || S.bars || []).map(s => s.label);
  const head = allLabels.length > 1 && st.legend !== 'none' ? keyTitle(allLabels) : null;
  const entries = (S.lines || S.bars || []).map((s, i) => ({
    label: head ? s.label.slice(s.label.indexOf(' = ') + 3) : s.label, color: S.bars ? colors[i] : lineColor(s, i), bar: !!S.bars, i,
    noLine: !!s.noLine, mk: S.lines ? markOf(s) : null, lw: lwOf(s), dash: s.ci === undefined && !s.color && !s.noLine ? i : -1,
  }));
  const legendOn = entries.length > 1 && st.legend !== 'none';

  // ---- The data ranges, as outputs.py sets them.
  let x0, x1, y0, y1, xticks, yticks, xcats = null;
  const yearAxis = false;
  if (S.lines) {
    const xs = S.lines.flatMap(l => l.x);
    const all = S.lines.filter(l => !l.axesY).flatMap(l => l.y).concat(S.limit ? [S.limit.y] : []);
    const xl = Math.min(...xs), xh = Math.max(...xs);
    if (S.xtight) { x0 = xl; x1 = xh; } else { x0 = xl - (xh - xl) * 0.05; x1 = xh + (xh - xl) * 0.05; }
    const lo = Math.min(...all), hi = Math.max(...all), m = (hi - lo) * 0.05;
    y0 = lo - m; y1 = hi + m;
  } else if (S.bars) {
    xcats = S.cats; x0 = -0.6; x1 = S.cats.length - 0.4;
    const hi = Math.max(...S.bars.flatMap(b => b.y), S.limit ? S.limit.y : 0);
    y0 = 0; y1 = hi * 1.05;
  } else {
    x0 = -0.5; x1 = S.xs.length - 0.5; y0 = -0.5; y1 = S.ys.length - 0.5;
  }

  // ---- Space around the axes (tight_layout: pad 1.08 x the font size).
  const pad = 1.08 * fs;
  const tickOut = st.ticks === 'out' ? 4 : 0, tickPad = st.ticks === 'none' ? 6 : 4;
  // Text is as tall as matplotlib lays it out: the height of "lp" in the font.
  const titleH = textHeight(st.title_size, fam), labH = textHeight(lab, fam);
  let topGap = 8;

  // Legend size (matplotlib's: handle 2 em, gap 0.8 em, column gap 1.6 em, border 0.4 em, rows
  // the height of "lp" 0.5 em apart, the title over the columns). Its lines go down the
  // columns, the first columns one longer.
  const rowH = textHeight(fs, fam);
  const entryW = (e) => fs * 2.0 + fs * 0.8 + textWidth(e.label, fs, fam);
  function legendBox(ncol) {
    const n = entries.length, small = Math.floor(n / ncol), large = n % ncol;
    const rows = small + (large ? 1 : 0);
    const cols = [];
    for (let c = 0, at = 0; c < ncol; c++) { const len = c < large ? small + 1 : small; if (len) cols.push(entries.slice(at, at + len)); at += len; }
    const widths = cols.map(col => Math.max(0, ...col.map(entryW)));
    const tH = head ? rowH + fs * 0.5 : 0;
    const body = widths.reduce((a, b) => a + b, 0) + (cols.length - 1) * fs * 1.6;
    return { ncol, rows, cols, widths, tH, body, w: Math.max(body, head ? textWidth(head, fs, fam) : 0) + fs * 0.8, h: rows * rowH + (rows - 1) * fs * 0.5 + fs * 0.8 + tH };
  }
  let leg = null;
  if (legendOn) {
    const n = entries.length;
    if (st.legend === 'bottom' || st.legend === 'top') {
      let nc = Math.min(n, 12);
      for (; nc >= 1; nc--) { leg = legendBox(nc); if (leg.w <= FW * 0.92) break; }
      // Rows filled evenly (12 lines in 11 columns would leave one alone on a second row).
      nc = Math.max(1, nc);
      const even = Math.ceil(n / Math.ceil(n / nc));
      if (even !== nc) leg = legendBox(even);
    } else if (st.legend === 'right') {
      // One column (two past 16 lines), or as many more as keep it within the graph's height.
      for (let nc = n <= 16 ? 1 : 2; nc <= n; nc++) { leg = legendBox(nc); if (leg.h <= FH * 0.8) break; }
    } else leg = legendBox(n <= 10 ? 1 : 2);
  }
  const foot = 16;
  const rectBottom = leg && st.legend === 'bottom' ? foot + leg.h : 14;
  if (leg && st.legend === 'top') topGap += leg.h + 2;

  // Tick labels: a first guess of the axes, the ticks, then the layout again with their widths.
  const yLabelW = labH + 6;
  const xTickH = textHeight(fs, fam);
  let L = pad + yLabelW + 30 + tickOut + tickPad, R = FW - pad, T = pad + titleH + topGap, B = FH - rectBottom - pad - (labH + 6) - xTickH - tickOut - tickPad;
  let cbar = null, xLabels = [], yLabels = [];
  for (let pass = 0; pass < 2; pass++) {
    const axW = R - L, axH = B - T;
    if (S.lines || S.bars) {
      // outputs.py _po_snap: end on a tick, again until the ends stay put.
      const nb = Math.max(1, Math.min(9, Math.floor(axH / (fs * 2))));
      let a = y0, b = y1;
      for (let it = 0; it < 4; it++) {
        const t = niceTicks(a, b, nb), eps = (b - a) * 1e-9;
        const na = Math.max(...t.filter(v => v <= a + eps), t[0]), nbb = Math.min(...t.filter(v => v >= b - eps), t[t.length - 1]);
        if (Math.abs(na - a) <= eps * 10 && Math.abs(nbb - b) <= eps * 10) break;
        a = na; b = nbb;
      }
      yticks = niceTicks(a, b, nb).filter(v => v >= a - 1e-9 && v <= b + 1e-9);
      if (pass === 1) { y0 = a; y1 = b; }
    } else yticks = S.ys.map((_, i) => i);
    if (S.lines) xticks = niceTicks(x0, x1, Math.max(1, Math.min(9, Math.floor(axW / (fs * 3)))), S.integer).filter(v => v >= x0 - 1e-9 && v <= x1 + 1e-9);
    else xticks = (xcats || S.xs).map((_, i) => i);
    yLabels = S.lines || S.bars ? yticks.map(v => fmtTick(v, yticks, st.thousands, yearAxis)) : S.ys.map(String);
    const yTickW = Math.max(...yLabels.map(s => textWidth(s, fs, fam)));
    xLabels = S.lines ? xticks.map(v => fmtTick(v, xticks, st.thousands, yearAxis)) : (xcats || S.xs.map(String));
    const lastHalf = S.lines && S.xtight ? textWidth(xLabels[xLabels.length - 1], fs, fam) / 2 : 0;
    L = pad + (S.ylabel ? yLabelW : 0) + yTickW + tickOut + tickPad;
    R = FW - pad - lastHalf;
    if (S.z) {
      // fig.colorbar(ax=ax): the axes give up 15 % of their width (5 % gap, a bar 1/20 of the height).
      const total = FW - pad - L;
      const cbW = (B - T) / 20;
      const cbTicks = niceTicks(Math.min(...S.z.flat()), Math.max(...S.z.flat()), Math.max(1, Math.min(9, Math.floor((B - T) / (fs * 2)))));
      const cbTickW = Math.max(...cbTicks.map(v => textWidth(fmtTick(v, cbTicks, false, false), fs, fam)));
      const room = cbW + tickOut + tickPad + cbTickW + 6 + lab * lh;
      R = L + Math.max(40, total - room - total * 0.05);
      cbar = { x: R + total * 0.05, w: cbW, ticks: cbTicks };
    }
    if (leg && st.legend === 'right') R = FW - pad - leg.w - (R - L) * 0.02;
    T = pad + titleH + topGap;
    B = FH - rectBottom - pad - (S.xlabel || S.cats ? labH + 6 : 0) - xTickH - tickOut - tickPad;
  }
  const sx = (v) => L + (v - x0) / (x1 - x0) * (R - L);
  const sy = (v) => B - (v - y0) / (y1 - y0) * (B - T);

  // ---- Background, plot area
  const svg = [];
  svg.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n2(PW) + ' ' + n2(PH) + '" width="' + n2(PW) + '" height="' + n2(PH) + '" font-family="' + esc(fam) + '" role="img" aria-label="' + esc(thumb ? 'Sample graph' : 'Sample graph in this style: ' + S.title) + '">');
  if (!st.transparent) svg.push('<rect width="100%" height="100%" fill="' + st.background + '"/>');
  if (!st.transparent) out.push('<rect x="' + px(L) + '" y="' + px(T) + '" width="' + px(R - L) + '" height="' + px(B - T) + '" fill="' + st.plot_background + '"/>');

  // ---- Grid
  const gd = dashOf(st.grid_style);
  const gridAxes = S.z ? 'none' : (S.bars ? (st.grid_axes === 'both' || st.grid_axes === 'y' ? 'y' : 'none') : st.grid_axes);
  if (gridAxes === 'both' || gridAxes === 'y') for (const v of yticks) line(L, sy(v), R, sy(v), st.grid, 0.7, gd);
  if (gridAxes === 'both' || gridAxes === 'x') for (const v of xticks) line(sx(v), T, sx(v), B, st.grid, 0.7, gd);

  // ---- Data
  // What a mark's label and an inside key keep clear of (in points): the lines drawn, the
  // words beside them, and the dots and bars.
  const segs = [], boxes = [], solid = [];
  let markAt = null;
  if (S.lines) {
    if (S.event) {
      const ex = sx(S.event.x), es = fs * 0.85;
      line(ex, T, ex, B, st.muted, 1, [1, 1.65]);
      text(ex + 3 + es * 0.78, T + 3, S.event.label, es, st.muted, { rot: -90, anchor: 'end' });
      segs.push([ex, T, ex, B]);
      boxes.push([ex + 3, T + 3, ex + 3 + es * lh, T + 3 + textWidth(S.event.label, es, fam)]);
    }
    if (S.limit) {
      const ly = sy(S.limit.y), ls = fs * 0.9;
      line(L, ly, R, ly, st.muted, 1.1, [5 * 1.1, 3 * 1.1]);
      text(R - 4, ly - 3, S.limit.label, ls, st.muted, { anchor: 'end' });
      segs.push([L, ly, R, ly]);
      boxes.push([R - 4 - textWidth(S.limit.label, ls, fam), ly - 3 - ls * lh, R - 4, ly - 3]);
    }
    S.lines.forEach((l, i) => {
      const color = lineColor(l, i), lw = lwOf(l);
      const at = (j) => [sx(l.x[j]), l.axesY ? B - l.y[j] * (B - T) : sy(l.y[j])];
      if (!l.noLine) {
        const step = Math.max(1, Math.floor(l.x.length / Math.max(60, (R - L) * k)));
        const pts = [];
        let prev = null;
        for (let j = 0; j < l.x.length; j += step) {
          const p = at(j);
          // A step line (ax.step, where="post") holds each value until the next.
          const run = l.step && prev ? [[p[0], prev[1]], p] : [p];
          for (const q of run) {
            if (prev) segs.push([prev[0], prev[1], q[0], q[1]]);
            prev = q;
            pts.push(px(q[0]) + ',' + px(q[1]));
          }
        }
        out.push('<polyline fill="none" stroke="' + color + '" stroke-width="' + n2(Math.max(0.6, lw * k)) + '" stroke-linejoin="round"' + lineDash(entries[i].dash, lw) + ' points="' + pts.join(' ') + '"/>');
      }
      const mk = markOf(l);
      if (mk) {
        for (let j = 0; j < l.x.length; j++) {
          const [x, y] = at(j);
          marker(x, y, mk.m, color, mk.size, mk.edge);
          solid.push([x - mk.size / 2, y - mk.size / 2, x + mk.size / 2, y + mk.size / 2]);
        }
      }
    });
    if (S.mark) {
      const l = S.lines[S.mark.line];
      let j = 0; l.y.forEach((v, q) => { if (v < l.y[j]) j = q; });
      markAt = [sx(l.x[j]), sy(l.y[j])];
      out.push('<circle cx="' + px(markAt[0]) + '" cy="' + px(markAt[1]) + '" r="' + px(3.5) + '" fill="' + st.text + '" stroke="' + st.plot_background + '" stroke-width="' + n2(1.5 * k) + '"/>');
      solid.push([markAt[0] - 3.5, markAt[1] - 3.5, markAt[0] + 3.5, markAt[1] + 3.5]);
    }
  } else if (S.bars) {
    const nb = S.bars.length, w = 0.8 / nb;
    S.bars.forEach((b, i) => b.y.forEach((v, c) => {
      const xa = sx(c - 0.4 + w * (i + 0.5) - w * 0.46), xb = sx(c - 0.4 + w * (i + 0.5) + w * 0.46);
      out.push('<rect x="' + px(xa) + '" y="' + px(sy(v)) + '" width="' + px(xb - xa) + '" height="' + px(sy(0) - sy(v)) + '" fill="' + colors[i] + '"/>');
      solid.push([xa, sy(v), xb, sy(0)]);
    }));
    if (S.limit) {
      const ly = sy(S.limit.y), ls = fs * 0.9;
      line(L, ly, R, ly, st.muted, 1.1, [5 * 1.1, 3 * 1.1]);
      text(R - 4, ly - 3, S.limit.label, ls, st.muted, { anchor: 'end' });
      segs.push([L, ly, R, ly]);
      boxes.push([R - 4 - textWidth(S.limit.label, ls, fam), ly - 3 - ls * lh, R - 4, ly - 3]);
    }
  } else if (S.z) {
    const stops = RAMPS[st.ramp].stops, flat = S.z.flat(), lo = Math.min(...flat), hi = Math.max(...flat);
    S.z.forEach((row, r) => row.forEach((v, c) => {
      const col = rampAt(stops, (v - lo) / (hi - lo));
      out.push('<rect x="' + px(sx(c - 0.5)) + '" y="' + px(sy(r + 0.5)) + '" width="' + px(sx(c + 0.5) - sx(c - 0.5) + 0.3 / k) + '" height="' + px(sy(r - 0.5) - sy(r + 0.5) + 0.3 / k) + '" fill="' + col + '"/>');
      text(sx(c), sy(r) + fs * 0.85 * 0.35, String(v), fs * 0.85, luminance(col) < 0.36 ? '#FFFFFF' : '#14203A', { anchor: 'middle' });
    }));
    colorBar(out, st, { x: cbar.x, w: cbar.w, top: T, bottom: B, lo, hi, ticks: cbar.ticks, label: S.zlabel }, { fs, lab, lh, fam, px, text, line, k, tickOut, tickPad });
  }

  // ---- The key's place. Inside: the first spot (outputs.py _po_inside_key) that covers no
  // line, dot, bar or word, with its own columns and then one more; with none clear, the
  // graph is drawn again with the key under it, as the script does.
  let keyAt = null;
  if (leg && st.legend === 'inside') {
    const m = fs * 0.5, gap = 3;
    const clear = (b) => !segs.some(s => segIn(s[0], s[1], s[2], s[3], b) > 0) && !boxes.some(o => overlaps(b, o)) && !solid.some(o => overlaps(b, o));
    const n = entries.length, base = n <= 10 ? 1 : 2;
    for (const nc of n >= 4 ? [base, base + 1] : [base]) {
      const box = legendBox(nc);
      for (const loc of INSIDE_LOCS) {
        const lx = loc.includes('right') ? R - m - box.w : loc.includes('left') ? L + m : (L + R) / 2 - box.w / 2;
        const ly = loc.startsWith('upper') ? T + m : loc.startsWith('lower') ? B - m - box.h : (T + B) / 2 - box.h / 2;
        if (clear([lx - gap, ly - gap, lx + box.w + gap, ly + box.h + gap])) { leg = box; keyAt = [lx, ly]; break; }
      }
      if (keyAt) break;
    }
    if (!keyAt) return previewSvg({ ...st, legend: 'bottom' }, opts);
  }

  // ---- Frame and ticks
  const sides = { 'left-bottom': ['left', 'bottom'], box: ['left', 'bottom', 'top', 'right'], bottom: ['bottom'], none: [] }[st.frame];
  if (sides.includes('left')) line(L, T, L, B, st.axis, 0.8);
  if (sides.includes('bottom')) line(L, B, R, B, st.axis, 0.8);
  if (sides.includes('top')) line(L, T, R, T, st.axis, 0.8);
  if (sides.includes('right')) line(R, T, R, B, st.axis, 0.8);
  const tl = st.ticks === 'none' ? 0 : 4, dir = st.ticks === 'in' ? -1 : 1, both = st.frame === 'box' && st.ticks === 'in';
  xticks.forEach((v, i) => {
    const x = sx(v);
    if (tl) { line(x, B, x, B + dir * tl, st.axis, 0.8); if (both) line(x, T, x, T + tl, st.axis, 0.8); }
    text(x, B + tickOut + tickPad + fs * 0.8, xLabels[i], fs, st.muted, { anchor: 'middle' });
  });
  yticks.forEach((v, i) => {
    const y = sy(v);
    if (tl) { line(L, y, L - dir * tl, y, st.axis, 0.8); if (both) line(R, y, R - tl, y, st.axis, 0.8); }
    text(L - tickOut - tickPad, y + fs * 0.35, yLabels[i], fs, st.muted, { anchor: 'end' });
  });

  // ---- Axis labels
  if (S.xlabel) text((L + R) / 2, B + tickOut + tickPad + xTickH + 6 + lab * 0.85, S.xlabel, lab, st.muted, { anchor: 'middle' });
  if (S.ylabel) {
    const yTickW = Math.max(...yLabels.map(s => textWidth(s, fs, fam)));
    text(L - tickOut - tickPad - yTickW - 6 - lab * 0.25, (T + B) / 2, S.ylabel, lab, st.muted, { anchor: 'middle', rot: -90 });
  }

  // ---- The key
  if (leg) {
    let lx, ly;
    if (keyAt) [lx, ly] = keyAt;
    else if (st.legend === 'bottom') { lx = (FW - leg.w) / 2; ly = FH - foot - leg.h; }
    else if (st.legend === 'top') { lx = st.title_align === 'left' ? L : (L + R) / 2 - leg.w / 2; ly = T - fs * 0.4 - leg.h; }
    else { lx = R + (R - L) * 0.02; ly = T; }
    if (st.legend_frame) out.push('<rect x="' + px(lx) + '" y="' + px(ly) + '" width="' + px(leg.w) + '" height="' + px(leg.h) + '" rx="' + px(2) + '" fill="' + st.plot_background + '" stroke="' + st.grid + '" stroke-width="' + n2(0.8 * k) + '"/>');
    if (head) text(lx + leg.w / 2, ly + fs * 0.4 + rowH * 0.78, head, fs, st.text, { anchor: 'middle' });
    let cx = lx + fs * 0.4 + (leg.w - fs * 0.8 - leg.body) / 2;
    leg.cols.forEach((col, c) => {
      col.forEach((e, r) => {
        const cy = ly + fs * 0.4 + leg.tH + r * (rowH + fs * 0.5) + rowH / 2;
        if (e.bar) out.push('<rect x="' + px(cx) + '" y="' + px(cy - fs * 0.35) + '" width="' + px(fs * 2) + '" height="' + px(fs * 0.7) + '" fill="' + e.color + '"/>');
        else {
          if (!e.noLine) out.push('<line x1="' + px(cx) + '" y1="' + px(cy) + '" x2="' + px(cx + fs * 2) + '" y2="' + px(cy) + '" stroke="' + e.color + '" stroke-width="' + n2(Math.max(0.6, e.lw * k)) + '"' + lineDash(e.dash, e.lw) + '/>');
          if (e.mk) marker(cx + fs, cy, e.mk.m, e.color, e.mk.size, e.mk.edge);
        }
        text(cx + fs * 2.8, cy + fs * 0.35, e.label, fs, st.text);
      });
      cx += leg.widths[c] + fs * 1.6;
    });
    if (keyAt) boxes.push([lx, ly, lx + leg.w, ly + leg.h]);
  }

  // ---- The mark's label, placed last so it can keep clear of everything else
  if (markAt && !thumb) {
    const ms = fs * 0.92, w = textWidth(S.mark.label, ms, fam), h = ms * lh;
    const b = placeLabel(markAt[0], markAt[1], w, h, segs, boxes, [L, T, R, B]);
    out.push('<rect x="' + px(b[0] - 1) + '" y="' + px(b[1] - 1) + '" width="' + px(b[2] - b[0] + 2) + '" height="' + px(b[3] - b[1] + 2) + '" fill="' + st.plot_background + '" opacity="0.85"/>');
    text(b[0], b[1] + ms * 0.9, S.mark.label, ms, st.text);
  }

  // ---- Title and credit
  const tx = st.title_align === 'left' ? L : (L + R) / 2;
  const ty = T - topGap - st.title_size * 0.25;
  if (thumb) {
    const w = Math.min(R - L, textWidth(S.title, st.title_size, fam, st.title_bold));
    const h = st.title_size * (st.title_bold ? 0.62 : 0.48);
    out.push('<rect x="' + px(st.title_align === 'left' ? tx : tx - w / 2) + '" y="' + px(ty - h) + '" width="' + px(w) + '" height="' + px(h) + '" rx="' + px(h / 2) + '" fill="' + st.text + '" opacity="0.85"/>');
  } else {
    text(tx, ty, S.title, st.title_size, st.text, { anchor: st.title_align === 'left' ? 'start' : 'middle', bold: st.title_bold });
    credit(text, FW, FH, st);
  }
  return svg.join('') + out.join('') + '</svg>';
}

function credit(text, FW, FH, st) {
  text(FW - 6, FH - 6, 'Made with tool.adjiebrotots.com/powerfactory-scripter/builder', 7, st.text, { anchor: 'end', op: 0.25 });
}

// A colour bar (fig.colorbar): the ramp from lo (bottom) to hi, its ticks and its label.
function colorBar(out, st, cb, g) {
  const { fs, lab, lh, fam, px, text, line, k, tickOut, tickPad } = g;
  const stops = RAMPS[st.ramp].stops, gid = 'pfbgs' + Math.random().toString(36).slice(2, 8);
  out.push('<defs><linearGradient id="' + gid + '" x1="0" y1="1" x2="0" y2="0">' + stops.map((c, i) => '<stop offset="' + n2(i / (stops.length - 1)) + '" stop-color="' + c + '"/>').join('') + '</linearGradient></defs>');
  out.push('<rect x="' + px(cb.x) + '" y="' + px(cb.top) + '" width="' + px(cb.w) + '" height="' + px(cb.bottom - cb.top) + '" fill="url(#' + gid + ')" stroke="' + st.axis + '" stroke-width="' + n2(0.8 * k) + '"/>');
  for (const v of cb.ticks) {
    if (v < cb.lo || v > cb.hi) continue;
    const y = cb.bottom - (v - cb.lo) / (cb.hi - cb.lo) * (cb.bottom - cb.top);
    if (tickOut) line(cb.x + cb.w, y, cb.x + cb.w + tickOut, y, st.axis, 0.8);
    text(cb.x + cb.w + tickOut + tickPad, y + fs * 0.35, fmtTick(v, cb.ticks, false, false), fs, st.muted);
  }
  const tw = Math.max(...cb.ticks.map(v => textWidth(fmtTick(v, cb.ticks, false, false), fs, fam)));
  text(cb.x + cb.w + tickOut + tickPad + tw + 6 + lab * 0.8, (cb.top + cb.bottom) / 2, cb.label, lab, st.muted, { anchor: 'middle', rot: -90 });
  return cb.w + tickOut + tickPad + tw + 6 + lab * lh;
}

// ---- A 3D graph (plot_3d) as mplot3d draws it: seen from azimuth -60 and elevation 30, a box
// 4:4:3, the three far panes tinted with the grid on them, the axes' numbers on the near edges,
// and a surface (cells coloured by the ramp, far ones first), a wire frame in the first line
// colour, or dots coloured by z; a colour bar beside the surface and the dots.
function preview3d(st, S, g) {
  const { FW, FH, PW, PH, k, fam, fs, lab, lh, thumb, out, px, text, line } = g;
  const az = -60 * Math.PI / 180, el = 30 * Math.PI / 180;
  const D = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
  const Rv = [-Math.sin(az), Math.cos(az), 0];
  const U = [-Math.sin(el) * Math.cos(az), -Math.sin(el) * Math.sin(az), Math.cos(el)];
  const BOX = [1, 1, 0.75];
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  const pts = S.pts || S.ys.flatMap((b, r) => S.xs.map((a, c) => [a, b, S.z[r][c]]));
  const span = (i) => [Math.min(...pts.map(p => p[i])), Math.max(...pts.map(p => p[i]))];
  const lim = [span(0), span(1), span(2)];
  const ticks = lim.map(([a, b]) => niceTicks(a, b, 5).filter(v => v >= a - 1e-9 && v <= b + 1e-9));
  // A point in the unit box (centred on 0), then on the page (right, up, towards the reader).
  const unit = (p) => p.map((v, i) => ((v - lim[i][0]) / ((lim[i][1] - lim[i][0]) || 1) - 0.5) * BOX[i]);
  const view = (q) => [dot3(q, Rv), dot3(q, U), dot3(q, D)];

  // The page: the title on top, the credit strip at the foot, the colour bar on the right.
  const pad = 1.08 * fs, titleH = st.title_size * lh;
  const AT = pad + titleH + 8, AB = FH - 14 - pad, AL = pad;
  const zs = pts.map(p => p[2]), zlo = Math.min(...zs), zhi = Math.max(...zs);
  const withBar = S.d3 !== 'wire';
  const tickOut = 4, tickPad = 4;
  let AR = FW - pad, cb = null;
  if (withBar) {
    // fig.colorbar(shrink=0.6, pad=0.1): a bar 0.6 of the height, 1/20 as wide.
    const h = (AB - AT) * 0.6, cbTicks = niceTicks(zlo, zhi, Math.max(1, Math.min(9, Math.floor(h / (fs * 2)))));
    const tw = Math.max(...cbTicks.map(v => textWidth(fmtTick(v, cbTicks, false, false), fs, fam)));
    const room = h / 20 + tickOut + tickPad + tw + 6 + lab * lh;
    AR = FW - pad - room - (FW - pad - AL) * 0.06;
    cb = { x: AR + (FW - pad - AL) * 0.04, w: h / 20, top: (AT + AB) / 2 - h / 2, bottom: (AT + AB) / 2 + h / 2, lo: zlo, hi: zhi, ticks: cbTicks, label: S.zlabel };
  }
  // Fit the box (with room for the numbers and the axis titles) in the space left.
  const corners = [];
  for (const a of [-0.5, 0.5]) for (const b of [-0.5, 0.5]) for (const c of [-0.5, 0.5]) corners.push(view([a * BOX[0], b * BOX[1], c * BOX[2]]));
  const cxs = corners.map(c => c[0]), cys = corners.map(c => c[1]);
  const room = fs * 4.2;
  const scale = Math.max(10, Math.min((AR - AL - 2 * room) / (Math.max(...cxs) - Math.min(...cxs)), (AB - AT - 2 * room * 0.8) / (Math.max(...cys) - Math.min(...cys))));
  const ox = (AL + AR) / 2 - (Math.max(...cxs) + Math.min(...cxs)) / 2 * scale;
  const oy = (AT + AB) / 2 + (Math.max(...cys) + Math.min(...cys)) / 2 * scale;
  const toPage = (v) => [ox + v[0] * scale, oy - v[1] * scale];
  const P = (q) => toPage(view(q));
  const half = BOX.map(b => b / 2);

  const svg = [];
  svg.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n2(PW) + ' ' + n2(PH) + '" width="' + n2(PW) + '" height="' + n2(PH) + '" font-family="' + esc(fam) + '" role="img" aria-label="' + esc(thumb ? 'Sample graph' : 'Sample graph in this style: ' + S.title + ', in 3D') + '">');
  if (!st.transparent) svg.push('<rect width="100%" height="100%" fill="' + st.background + '"/>');

  // The far panes: each axis' pane on the side away from the reader.
  const far = D.map((d, i) => (d > 0 ? -half[i] : half[i]));
  const pane = mixColor(st.plot_background, st.grid, 0.35);
  const poly = (qs, fill, stroke, w) => out.push('<polygon points="' + qs.map(q => { const p = P(q); return px(p[0]) + ',' + px(p[1]); }).join(' ') + '" fill="' + fill + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width="' + n2(Math.max(0.3, w * k)) + '" stroke-linejoin="round"' : '') + '/>');
  const at = (i, v) => ((v - lim[i][0]) / ((lim[i][1] - lim[i][0]) || 1) - 0.5) * BOX[i];
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3, m = (i + 2) % 3;
    const q = (a, b) => { const v = [0, 0, 0]; v[i] = far[i]; v[j] = a; v[m] = b; return v; };
    poly([q(-half[j], -half[m]), q(half[j], -half[m]), q(half[j], half[m]), q(-half[j], half[m])], pane, st.axis, 0.8);
    // The grid on this pane: a line at each tick of the two axes it spans.
    for (const [a, b] of [[j, m], [m, j]]) {
      for (const t of ticks[a]) {
        const v1 = [0, 0, 0], v2 = [0, 0, 0];
        v1[i] = v2[i] = far[i]; v1[a] = v2[a] = at(a, t); v1[b] = -half[b]; v2[b] = half[b];
        const p1 = P(v1), p2 = P(v2);
        line(p1[0], p1[1], p2[0], p2[1], st.grid, 0.7);
      }
    }
  }

  // The data.
  const stops = RAMPS[st.ramp].stops, rz = (v) => rampAt(stops, (v - zlo) / ((zhi - zlo) || 1));
  if (S.d3 === 'surface' || S.d3 === 'wire') {
    const Q = (r, c) => unit([S.xs[c], S.ys[r], S.z[r][c]]);
    if (S.d3 === 'surface') {
      const cells = [];
      for (let r = 0; r + 1 < S.ys.length; r++) for (let c = 0; c + 1 < S.xs.length; c++) {
        const qs = [Q(r, c), Q(r, c + 1), Q(r + 1, c + 1), Q(r + 1, c)];
        cells.push({ qs, depth: qs.reduce((s, q) => s + dot3(q, D), 0) / 4, z: (S.z[r][c] + S.z[r][c + 1] + S.z[r + 1][c + 1] + S.z[r + 1][c]) / 4 });
      }
      cells.sort((a, b) => a.depth - b.depth);
      for (const cell of cells) poly(cell.qs, rz(cell.z), st.axis, 0.3);
    } else {
      const c0 = st.colors[0];
      for (let r = 0; r < S.ys.length; r++) for (let c = 0; c + 1 < S.xs.length; c++) { const a = P(Q(r, c)), b = P(Q(r, c + 1)); line(a[0], a[1], b[0], b[1], c0, 0.8); }
      for (let c = 0; c < S.xs.length; c++) for (let r = 0; r + 1 < S.ys.length; r++) { const a = P(Q(r, c)), b = P(Q(r + 1, c)); line(a[0], a[1], b[0], b[1], c0, 0.8); }
    }
  } else {
    const dots = pts.map(p => { const q = unit(p); return { q, depth: dot3(q, D), z: p[2] }; }).sort((a, b) => a.depth - b.depth);
    const r = Math.sqrt(28) / 2;
    for (const d of dots) {
      const p = P(d.q);
      out.push('<circle cx="' + px(p[0]) + '" cy="' + px(p[1]) + '" r="' + px(r) + '" fill="' + rz(d.z) + '" stroke="' + st.muted + '" stroke-width="' + n2(Math.max(0.3, 0.4 * k)) + '"/>');
    }
  }

  // The axes: x along the near bottom edge, y along the other near bottom edge, z up the
  // edge furthest right; numbers and the axis title outward from the box.
  const near = D.map((d, i) => -far[i]);
  const bottom = far[2];
  const centre = toPage(view([0, 0, bottom]));
  const axisEdge = [
    [[-half[0], near[1], bottom], [half[0], near[1], bottom]],
    [[near[0], -half[1], bottom], [near[0], half[1], bottom]],
  ];
  let side = null;
  for (const a of [-half[0], half[0]]) for (const b of [-half[1], half[1]]) { const p = P([a, b, 0]); if (!side || p[0] > side.p[0]) side = { p, a, b }; }
  axisEdge.push([[side.a, side.b, -half[2]], [side.a, side.b, half[2]]]);
  const labels = [S.xlabel, S.ylabel, S.zlabel];
  for (let i = 0; i < 3; i++) {
    const [e0, e1] = axisEdge[i];
    const p0 = P(e0), p1 = P(e1);
    line(p0[0], p0[1], p1[0], p1[1], st.axis, 0.8);
    const mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
    let out2 = i === 2 ? [1, 0] : [mid[0] - centre[0], mid[1] - centre[1]];
    const len = Math.hypot(out2[0], out2[1]) || 1;
    out2 = [out2[0] / len, out2[1] / len];
    for (const t of ticks[i]) {
      const v = e0.slice(); v[i] = at(i, t);
      const p = P(v);
      line(p[0], p[1], p[0] + out2[0] * 3, p[1] + out2[1] * 3, st.axis, 0.8);
      const lx = p[0] + out2[0] * fs * 1.5, ly = p[1] + out2[1] * fs * 1.5;
      text(lx, ly + fs * 0.35, fmtTick(t, ticks[i], st.thousands, false), fs, st.muted, { anchor: i === 2 ? 'start' : 'middle' });
    }
    // The title runs along its axis, read left to right.
    let ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) * 180 / Math.PI;
    if (ang > 90) ang -= 180; else if (ang < -90) ang += 180;
    const tw = Math.max(...ticks[i].map(t => textWidth(fmtTick(t, ticks[i], st.thousands, false), fs, fam)));
    const off = i === 2 ? fs * 1.5 + tw + lab * 1.1 : fs * 3.4;
    if (labels[i]) text(mid[0] + out2[0] * off, mid[1] + out2[1] * off + lab * 0.35, labels[i], lab, st.muted, { anchor: 'middle', rot: i === 2 ? -90 : ang });
  }

  if (cb) colorBar(out, st, cb, { fs, lab, lh, fam, px, text, line, k, tickOut, tickPad });

  // The title (on the 3D axes: centred over them, or at their left) and the credit.
  const tx = st.title_align === 'left' ? AL : (AL + AR) / 2, ty = AT - 8 - st.title_size * 0.25;
  if (thumb) {
    const w = Math.min(AR - AL, textWidth(S.title, st.title_size, fam, st.title_bold)), h = st.title_size * (st.title_bold ? 0.62 : 0.48);
    out.push('<rect x="' + px(st.title_align === 'left' ? tx : tx - w / 2) + '" y="' + px(ty - h) + '" width="' + px(w) + '" height="' + px(h) + '" rx="' + px(h / 2) + '" fill="' + st.text + '" opacity="0.85"/>');
  } else {
    text(tx, ty, S.title, st.title_size, st.text, { anchor: st.title_align === 'left' ? 'start' : 'middle', bold: st.title_bold });
    credit(text, FW, FH, st);
  }
  return svg.join('') + out.join('') + '</svg>';
}

// The sample graphs, in two rows: [id, words, row]. The ids are kept in the reader's browser
// (the last one looked at): add, never rename.
export const PREVIEW_KINDS = [
  ['series', 'Time series', 'lines'], ['many', 'Many passes', 'lines'], ['xy', '2D lines', 'lines'],
  ['points', 'Points', 'lines'], ['bars', 'Bars', 'lines'], ['conv', 'Search', 'lines'],
  ['heat', 'Heat map', 'maps'], ['surface', '3D surface', 'maps'], ['wire', '3D wire frame', 'maps'], ['points3d', '3D points', 'maps'],
];
