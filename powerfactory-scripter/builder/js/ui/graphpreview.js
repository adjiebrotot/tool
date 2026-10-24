// The Graph style preview: a sample graph drawn as SVG the way runtime/outputs.py lays it out
// with matplotlib (tight_layout's padding, the key's places, the tick spacing of MaxNLocator,
// the value axis ending on a tick), from the same style, so what the reader picks here is what
// the script draws. It is a likeness, not matplotlib: text widths come from the browser's own
// font, and a computer without the chosen font draws with the one it falls back to.
//
// previewSvg(style, { kind, width, thumb }) -> SVG markup. kind: 'series' (three frequency
// traces, an event, a limit and the nadir), 'bars' (grouped bars), 'many' (twelve passes on one
// graph: the paler second round and the ramp) or 'heat' (a heat map and its colour bar).
// thumb: a small card for a template (no words; the title as a bar).

import { normalizeStyle, seriesColors, rampAt, luminance, RAMPS, LINE_DASHES, fontCss } from '../core/graphstyle.js';

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

// ---- Sample data (the same traces the audit renders with matplotlib, for comparing).
function dip(t, depth = 0.9, tau = 1.2, rec = 0.35) {
  if (t < 1) return 50;
  const x = t - 1;
  return 50 - depth * (1 - Math.exp(-x / tau)) * Math.exp(-x / 6) - rec * (1 - Math.exp(-x / 3)) + 0.05 * Math.sin(x * 2) * Math.exp(-x / 3);
}
const TS = Array.from({ length: 401 }, (_, i) => i * 0.05);
const SAMPLES = {
  series: () => ({
    title: 'Frequency after G2 trip', xlabel: 'Time (s)', ylabel: 'Frequency (Hz)', xtight: true,
    lines: [[0.9, 1.2, 0.35], [0.75, 1.0, 0.3], [0.6, 0.8, 0.25]].map((p, i) => ({ label: 'Bus ' + [5, 7, 9][i] + ' m:fehz', x: TS, y: TS.map(t => dip(t, ...p)) })),
    event: { x: 1, label: 'G2 trip' }, limit: { y: 49.2, label: 'UFLS 49.2 Hz' }, mark: { line: 0, label: 'Nadir 49.26 Hz' },
    inside: 'ur',
  }),
  many: () => ({
    title: 'Frequency, every pass', xlabel: 'Time (s)', ylabel: 'Frequency (Hz)', xtight: true,
    lines: Array.from({ length: 12 }, (_, i) => ({ label: 'Dispatch (MW) = ' + (100 + 25 * i), x: TS, y: TS.map(t => dip(t, 0.35 + 0.06 * i, 1.1, 0.12 + 0.025 * i)) })),
    inside: 'ur',
  }),
  bars: () => ({
    title: 'Line loading', ylabel: 'Loading (%)', cats: ['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5'],
    bars: [{ label: 'Base', y: [62, 81, 95, 71, 55] }, { label: 'N-1', y: [74, 97, 108, 85, 63] }],
    limit: { y: 100, label: '100 %' }, inside: 'ul',
  }),
  heat: () => {
    const xs = [100, 150, 200, 250, 300], ys = [-50, 0, 50, 100];
    return { title: 'Losses', xlabel: 'Dispatch (MW)', ylabel: 'Q (Mvar)', zlabel: 'Loss (MW)', xs, ys, z: ys.map(b => xs.map(a => Math.round((0.8 + a * a / 40000 + Math.abs(b) / 120) * 1000) / 1000)) };
  },
};

// ---- Ticks as matplotlib's MaxNLocator picks them (steps 1, 2, 2.5, 5, 10).
function niceTicks(lo, hi, nbins) {
  if (!(hi > lo)) return [lo];
  const raw = (hi - lo) / Math.max(1, nbins);
  const mag = 10 ** Math.floor(Math.log10(raw));
  for (const s of [1, 2, 2.5, 5, 10, 20]) {
    const step = s * mag;
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
      (o.base ? ' dominant-baseline="' + o.base + '"' : '') + (o.rot ? ' transform="rotate(' + o.rot + ' ' + px(x) + ' ' + px(y) + ')"' : '') +
      (o.op ? ' opacity="' + o.op + '"' : '') + '>' + esc(s) + '</text>');
  };
  const line = (x1, y1, x2, y2, color, w, dash) => out.push('<line x1="' + px(x1) + '" y1="' + px(y1) + '" x2="' + px(x2) + '" y2="' + px(y2) + '" stroke="' + color + '" stroke-width="' + n2(Math.max(0.5, w * k)) + '"' + (dash ? ' stroke-dasharray="' + dash.map(d => n2(d * k)).join(' ') + '"' : '') + '/>');
  const dashOf = (g) => (g === 'dashed' ? [4 * 0.7, 3 * 0.7] : g === 'dotted' ? [0.7, 2.5 * 0.7] : null);
  // A line's pattern (line_styles "vary"), scaled by the line width as matplotlib does.
  const lineDash = (i) => {
    const d = st.line_styles === 'vary' ? LINE_DASHES[i % LINE_DASHES.length] : null;
    return d ? ' stroke-dasharray="' + d.map(v => n2(v * st.line_width * k)).join(' ') + '" stroke-linecap="butt"' : ' stroke-linecap="round"';
  };

  // Series colours and the legend entries.
  const nSeries = S.lines ? S.lines.length : S.bars ? S.bars.length : 0;
  const colors = seriesColors(st, nSeries);
  const entries = (S.lines || S.bars || []).map((s, i) => ({ label: s.label, color: colors[i], bar: !!S.bars, i }));
  const legendOn = entries.length > 1 && st.legend !== 'none';

  // ---- The data ranges, as outputs.py sets them.
  let x0, x1, y0, y1, xticks, yticks, xcats = null;
  const yearAxis = false;
  if (S.lines) {
    const all = S.lines.flatMap(l => l.y).concat(S.limit ? [S.limit.y] : []);
    x0 = 0; x1 = 20;
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
  const titleH = st.title_size * lh;
  let topGap = 8;

  // Legend size (matplotlib's: handle 2 em, gap 0.8 em, column gap 1.6 em, border 0.4 em).
  const entryW = (e) => fs * 2.0 + fs * 0.8 + textWidth(e.label, fs, fam);
  function legendBox(ncol) {
    const rows = Math.ceil(entries.length / ncol);
    const cols = [];
    for (let c = 0; c < ncol; c++) cols.push(entries.slice(c * rows, (c + 1) * rows));
    const widths = cols.map(col => Math.max(0, ...col.map(entryW)));
    return { ncol, rows, cols, widths, w: widths.reduce((a, b) => a + b, 0) + (ncol - 1) * fs * 1.6 + fs * 0.8, h: rows * fs * lh + (rows - 1) * fs * 0.5 + fs * 0.8 };
  }
  let leg = null;
  if (legendOn) {
    if (st.legend === 'bottom' || st.legend === 'top') {
      for (let nc = Math.min(entries.length, 12); nc >= 1; nc--) { leg = legendBox(nc); if (leg.w <= FW * 0.92) break; }
    } else leg = legendBox(st.legend === 'right' ? (entries.length <= 16 ? 1 : 2) : (entries.length <= 10 ? 1 : 2));
  }
  const foot = 16;
  const rectBottom = leg && st.legend === 'bottom' ? foot + leg.h : 14;
  if (leg && st.legend === 'top') topGap += leg.h + 2;

  // Tick labels: a first guess of the axes, the ticks, then the layout again with their widths.
  const yLabelW = lab * lh + 6;
  const xTickH = fs * lh;
  let L = pad + yLabelW + 30 + tickOut + tickPad, R = FW - pad, T = pad + titleH + topGap, B = FH - rectBottom - pad - (lab * lh + 6) - xTickH - tickOut - tickPad;
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
    if (S.lines) xticks = niceTicks(x0, x1, Math.max(1, Math.min(9, Math.floor(axW / (fs * 3)))));
    else xticks = (xcats || S.xs).map((_, i) => i);
    yLabels = S.lines || S.bars ? yticks.map(v => fmtTick(v, yticks, st.thousands, yearAxis)) : S.ys.map(String);
    const yTickW = Math.max(...yLabels.map(s => textWidth(s, fs, fam)));
    xLabels = S.lines ? xticks.map(v => fmtTick(v, xticks, st.thousands, yearAxis)) : (xcats || S.xs.map(String));
    const lastHalf = S.lines ? textWidth(xLabels[xLabels.length - 1], fs, fam) / 2 : 0;
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
    B = FH - rectBottom - pad - (S.xlabel || S.cats ? lab * lh + 6 : 0) - xTickH - tickOut - tickPad;
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
  // What a mark's label keeps clear of (in points): the lines drawn and the words beside them.
  const segs = [], boxes = [];
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
      const step = Math.max(1, Math.floor(l.x.length / Math.max(60, (R - L) * k)));
      const pts = [];
      let prev = null;
      for (let j = 0; j < l.x.length; j += step) {
        const p = [sx(l.x[j]), sy(l.y[j])];
        if (prev) segs.push([prev[0], prev[1], p[0], p[1]]);
        prev = p;
        pts.push(px(p[0]) + ',' + px(p[1]));
      }
      out.push('<polyline fill="none" stroke="' + colors[i] + '" stroke-width="' + n2(Math.max(0.6, st.line_width * k)) + '" stroke-linejoin="round"' + lineDash(i) + ' points="' + pts.join(' ') + '"/>');
    });
    if (S.mark) {
      const l = S.lines[S.mark.line];
      let j = 0; l.y.forEach((v, q) => { if (v < l.y[j]) j = q; });
      markAt = [sx(l.x[j]), sy(l.y[j])];
      out.push('<circle cx="' + px(markAt[0]) + '" cy="' + px(markAt[1]) + '" r="' + px(3.5) + '" fill="' + st.text + '" stroke="' + st.plot_background + '" stroke-width="' + n2(1.5 * k) + '"/>');
    }
  } else if (S.bars) {
    const nb = S.bars.length, w = 0.8 / nb;
    S.bars.forEach((b, i) => b.y.forEach((v, c) => {
      const xa = sx(c - 0.4 + w * (i + 0.5) - w * 0.46), xb = sx(c - 0.4 + w * (i + 0.5) + w * 0.46);
      out.push('<rect x="' + px(xa) + '" y="' + px(sy(v)) + '" width="' + px(xb - xa) + '" height="' + px(sy(0) - sy(v)) + '" fill="' + colors[i] + '"/>');
    }));
    if (S.limit) {
      line(L, sy(S.limit.y), R, sy(S.limit.y), st.muted, 1.1, [5 * 1.1, 3 * 1.1]);
      text(R - 4, sy(S.limit.y) - 3, S.limit.label, fs * 0.9, st.muted, { anchor: 'end' });
    }
  } else if (S.z) {
    const stops = RAMPS[st.ramp].stops, flat = S.z.flat(), lo = Math.min(...flat), hi = Math.max(...flat);
    S.z.forEach((row, r) => row.forEach((v, c) => {
      const col = rampAt(stops, (v - lo) / (hi - lo));
      out.push('<rect x="' + px(sx(c - 0.5)) + '" y="' + px(sy(r + 0.5)) + '" width="' + px(sx(c + 0.5) - sx(c - 0.5) + 0.3 / k) + '" height="' + px(sy(r - 0.5) - sy(r + 0.5) + 0.3 / k) + '" fill="' + col + '"/>');
      text(sx(c), sy(r) + fs * 0.85 * 0.35, String(v), fs * 0.85, luminance(col) < 0.36 ? '#FFFFFF' : '#14203A', { anchor: 'middle' });
    }));
    // The colour bar
    const cx = cbar.x, cw = cbar.w, gid = 'pfbgs' + Math.random().toString(36).slice(2, 8);
    out.push('<defs><linearGradient id="' + gid + '" x1="0" y1="1" x2="0" y2="0">' + stops.map((c, i) => '<stop offset="' + n2(i / (stops.length - 1)) + '" stop-color="' + c + '"/>').join('') + '</linearGradient></defs>');
    out.push('<rect x="' + px(cx) + '" y="' + px(T) + '" width="' + px(cw) + '" height="' + px(B - T) + '" fill="url(#' + gid + ')" stroke="' + st.axis + '" stroke-width="' + n2(0.8 * k) + '"/>');
    for (const v of cbar.ticks) {
      if (v < lo || v > hi) continue;
      const y = B - (v - lo) / (hi - lo) * (B - T);
      if (tickOut) line(cx + cw, y, cx + cw + tickOut, y, st.axis, 0.8);
      text(cx + cw + tickOut + tickPad, y + fs * 0.35, fmtTick(v, cbar.ticks, false, false), fs, st.muted);
    }
    const cbTickW = Math.max(...cbar.ticks.map(v => textWidth(fmtTick(v, cbar.ticks, false, false), fs, fam)));
    text(cx + cw + tickOut + tickPad + cbTickW + 6 + lab * 0.8, (T + B) / 2, S.zlabel, lab, st.muted, { anchor: 'middle', rot: -90 });
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
    if (st.legend === 'bottom') { lx = (FW - leg.w) / 2; ly = FH - foot - leg.h; }
    else if (st.legend === 'top') { lx = st.title_align === 'left' ? L : (L + R) / 2 - leg.w / 2; ly = T - fs * 0.4 - leg.h; }
    else if (st.legend === 'right') { lx = R + (R - L) * 0.02; ly = T; }
    else {
      const m = fs * 0.5;
      lx = S.inside === 'ul' ? L + m : R - m - leg.w; ly = T + m;
    }
    if (st.legend_frame) out.push('<rect x="' + px(lx) + '" y="' + px(ly) + '" width="' + px(leg.w) + '" height="' + px(leg.h) + '" rx="' + px(2) + '" fill="' + st.plot_background + '" stroke="' + st.grid + '" stroke-width="' + n2(0.8 * k) + '"/>');
    let cx = lx + fs * 0.4;
    leg.cols.forEach((col, c) => {
      col.forEach((e, r) => {
        const cy = ly + fs * 0.4 + r * fs * (lh + 0.5) + fs * lh / 2;
        if (e.bar) out.push('<rect x="' + px(cx) + '" y="' + px(cy - fs * 0.35) + '" width="' + px(fs * 2) + '" height="' + px(fs * 0.7) + '" fill="' + e.color + '"/>');
        else out.push('<line x1="' + px(cx) + '" y1="' + px(cy) + '" x2="' + px(cx + fs * 2) + '" y2="' + px(cy) + '" stroke="' + e.color + '" stroke-width="' + n2(Math.max(0.6, st.line_width * k)) + '"' + lineDash(e.i) + '/>');
        text(cx + fs * 2.8, cy + fs * 0.35, e.label, fs, st.text);
      });
      cx += leg.widths[c] + fs * 1.6;
    });
    if (st.legend === 'inside') boxes.push([lx, ly, lx + leg.w, ly + leg.h]);
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
    text(FW - 6, FH - 6, 'Made with tool.adjiebrotots.com/powerfactory-scripter/builder', 7, st.text, { anchor: 'end', op: 0.25 });
  }
  return svg.join('') + out.join('') + '</svg>';
}

export const PREVIEW_KINDS = [['series', 'Time series'], ['bars', 'Bars'], ['many', 'Many passes'], ['heat', 'Heat map']];
