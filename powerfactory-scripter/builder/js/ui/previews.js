// Mock previews on the blocks whose output is a picture or a file: the graphs, the heat map, the
// 3D graph, the convergence curve and the tables. Each shows what the script will make, drawn
// from the block's settings and wires: the reader's names go where the script puts them (title,
// axis titles, legend, column headers, the file name, the loop values that start each row),
// and the values are mock, in grey. The words follow runtime/outputs.py and base.py (legend
// names, "Passes" / "Fails", a row's loop columns then Status then its own columns).
//
// previewSpec() is plain data, so the canvas caches it with the rest of a block's decorations;
// renderPreview() draws it with React. Nothing here loads a block file (a block file that fails
// to load must only leave its own blocks Missing).

import { getBlock, settingsOf, portsOf } from '../core/registry.js';
import { parseValues, columnName, columnList } from '../core/blockkit.js';
import * as ops from './ops.js';

const rowsOf = (v) => (Array.isArray(v) ? v.filter(r => r && typeof r === 'object') : []);
const str = (v) => String(v === undefined || v === null ? '' : v).trim();
const num = (v) => { const x = Number(String(v === undefined || v === null ? '' : v).replace(',', '.')); return v === '' || !Number.isFinite(x) ? null : x; };
const fmt = (v) => (typeof v === 'number' ? String(+v.toPrecision(6)) : String(v));
const withUnit = (label, unit) => (label && unit && !label.includes('(' + unit + ')') ? `${label} (${unit})` : label);
const tableName = (s) => str(s.table) || 'Results';

// The name of the value wired into each input of a block, by handle id.
function wiredNames(wf, node) {
  const m = new Map();
  for (const e of wf.edges) {
    if (e.to !== node.id) continue;
    const sp = ops.portAt(wf, e.from, e.out, 'out');
    const sn = ops.nodeById(wf, e.from);
    if (!sn || !sp || sp.stray) continue;
    const sdef = getBlock(sn.type);
    let first = false;
    try { first = !!(sdef && (portsOf(sn).outputs[0] || {}).id === sp.port.id); } catch (err) { first = false; }
    m.set(ops.handleIdOf(wf, node.id, e.in, 'in'), { name: columnName({ nodeLabel: str(sn.label), title: sdef ? sdef.title : '', first, port: sp.port }), node: sn });
  }
  return m;
}

// The first values a loop takes, when its settings say them (a range, typed values, a count, the
// two ends a search starts from); else none, and the preview shows "…".
function loopSamples(node) {
  if (!node) return [];
  let s;
  try { s = settingsOf(node); } catch (err) { return []; }
  switch (node.type) {
    case 'flow.range': {
      const a = num(s.from), b = num(s.to), st = num(s.step) || 1, out = [];
      if (a === null) return [];
      for (let k = 0; k < 3; k++) {
        const v = a + k * st;
        if (b !== null && (st > 0 ? v > b + 1e-9 : v < b - 1e-9)) break;
        out.push(fmt(v));
      }
      return out;
    }
    case 'flow.list': return (s.source || 'values') === 'values' ? parseValues(s.values).slice(0, 3).map(fmt) : [];
    case 'flow.repeat': case 'flow.until': return ['1', '2', '3'];
    case 'opt.limit': { const lo = num(s.lower), hi = num(s.upper); return lo === null || hi === null ? [] : [fmt(lo), fmt(hi), fmt((lo + hi) / 2)]; }
    default: return [];
  }
}

// Curves, lines or columns from a list setting: the row's own name, else the name of the value
// wired into it, else "Curve 2". Rows with nothing wired only show while nothing is wired at all
// (the script skips them), so a fresh block still shows its shape.
function namedRows(rows, wired, word, addWired) {
  const all = rows.map((r, k) => ({ name: str(r.name) || (wired.get(r.id) || {}).name || `${word} ${k + 1}`, on: wired.has(r.id) }));
  if (addWired) all.push({ name: addWired, on: true });
  const on = all.filter(r => r.on);
  return (on.length ? on : all).map(r => r.name);
}

// Loop values and Status first, then the table's own columns: one row of runtime base.py.
function tableCols(wf, gen, node, s, wired) {
  const regions = ((gen && gen.regions) || {})[node.id] || [];
  const cols = [];
  if (s.ctx !== false) for (const r of regions) cols.push({ name: r.label, loop: true, vals: loopSamples(ops.nodeById(wf, r.id)) });
  if (s.onSkip !== false && regions.length) cols.push({ name: 'Status', status: true });
  rowsOf(s.cols).forEach((r, k) => cols.push({ name: str(r.name) || (wired.get(r.id) || {}).name || `Column ${k + 1}` }));
  if (wired.has('add')) cols.push({ name: wired.get('add').name });
  return cols;
}

const saveName = (stem, name, fmtKey) => {
  const base = str(stem) || name;
  return fmtKey === 'xlsx' ? base + '.xlsx' : fmtKey === 'both' ? base + '.csv and .xlsx' : base + '.csv';
};

export function previewSpec(wf, gen, node) {
  const def = getBlock(node && node.type);
  if (!def || !PREVIEWS[node.type]) return null;
  let s;
  try { s = settingsOf(node); } catch (err) { return null; }
  try { return { id: node.id, ...PREVIEWS[node.type](s, { wf, gen, node, wired: wiredNames(wf, node), title: str(s.title) || str(node.label) }) }; } catch (err) { return null; }
}

const PREVIEWS = {
  'out.plot.series'(s, c) {
    const regions = ((c.gen && c.gen.regions) || {})[c.node.id] || [];
    let legend = namedRows(rowsOf(s.lines), c.wired, 'Curve', c.wired.has('add') ? c.wired.get('add').name || 'Curve' : null);
    let curves = legend.length;
    if (s.collect === 'loop' && regions.length) {
      const L = regions[regions.length - 1], vals = loopSamples(ops.nodeById(c.wf, L.id));
      legend = [0, 1, 2].map(k => `${L.label} = ${vals[k] !== undefined ? vals[k] : '…'}`);
      curves = 3;
    }
    const limits = rowsOf(s.limits).filter(r => num(r.value) !== null).map(r => str(r.label) || fmt(num(r.value)));
    if (c.wired.has('limit')) limits.push(c.wired.get('limit').name || 'Limit');
    return {
      chart: 'series', title: c.title, x: 'Time (s)', y: withUnit(str(s.ylabel), str(s.unit)) || (curves === 1 ? legend[0] : ''),
      legend: curves > 1 || str(s.ylabel) ? legend : [], curves: Math.max(1, curves),
      limits: limits.slice(0, 2), mark: c.wired.has('mark') ? 'Nadir' : '', event: !!(s.events !== false || c.wired.has('t_event')),
      note: c.wired.has('note') ? c.wired.get('note').name : '',
    };
  },
  'out.plot.xy'(s, c) {
    const legend = namedRows(rowsOf(s.lines), c.wired, 'Y values', c.wired.has('add') ? c.wired.get('add').name : null);
    return {
      chart: s.kind === 'bar' ? 'bar' : s.kind === 'scatter' ? 'scatter' : 'line', title: c.title,
      x: withUnit(str(s.xlabel), str(s.xunit)) || (c.wired.get('x') || {}).name || 'X values',
      y: withUnit(str(s.ylabel), str(s.yunit)) || (legend.length === 1 ? legend[0] : ''),
      legend: legend.length > 1 ? legend : [], curves: Math.max(1, legend.length),
    };
  },
  'out.plot.table'(s, c) {
    const ys = columnList(s.ys), group = str(s.group);
    const cols = ys.length ? ys : ['Columns to draw'];
    const legend = group ? [`${cols.length > 1 ? cols[0] + ', ' : ''}${group} = …`, `${cols.length > 1 ? cols[0] + ', ' : ''}${group} = …`] : (cols.length > 1 ? cols : []);
    return {
      chart: s.kind === 'bar' ? 'bar' : s.kind === 'scatter' ? 'scatter' : 'line', title: c.title,
      x: str(s.x) || 'X axis column', y: withUnit(str(s.ylabel) || (cols.length === 1 && ys.length ? cols[0] : ''), str(s.yunit)),
      legend, curves: Math.max(1, legend.length || 1),
    };
  },
  'out.plot.3d'(s, c) {
    return {
      chart: s.kind === 'scatter' ? 'points3d' : s.kind === 'wireframe' ? 'wire3d' : 'surface', title: c.title,
      x: withUnit(str(s.xlabel), str(s.xunit)) || (c.wired.get('x') || {}).name || 'X',
      y: withUnit(str(s.ylabel), str(s.yunit)) || (c.wired.get('y') || {}).name || 'Y',
      z: withUnit(str(s.zlabel), str(s.zunit)) || (c.wired.get('z') || {}).name || 'Height',
    };
  },
  'out.plot.heatmap'(s, c) {
    return {
      chart: 'heat', title: c.title, cells: s.annotate !== 'no',
      x: withUnit(str(s.xlabel), str(s.xunit)) || (c.wired.get('x') || {}).name || 'X values',
      y: withUnit(str(s.ylabel), str(s.yunit)) || (c.wired.get('y') || {}).name || 'Y values',
      z: withUnit(str(s.zlabel), str(s.zunit)) || (c.wired.get('z') || {}).name || 'Values',
    };
  },
  'out.plot.conv'(s, c) {
    const src = c.wired.get('history');
    let kind = s.kind;
    if (kind !== 'limit' && kind !== 'optimise') kind = src && src.node.type === 'opt.optimise' ? 'optimise' : 'limit';
    const searched = src ? str(settingsOf(src.node).name) || str(src.node.label) : '';
    return kind === 'limit'
      ? { chart: 'conv-limit', title: c.title || 'Find limit: value per step', x: 'Step', y: withUnit(str(s.ylabel) || searched || 'Value tried', str(s.unit)), legend: ['Passes', 'Fails', 'Bracket holding the limit'], legendAt: 'bottom' }
      : { chart: 'conv-opt', title: c.title || 'Optimise: score per try', x: 'Try', y: withUnit(str(s.ylabel) || 'Score', str(s.unit)), legend: ['Score of the try', 'Best so far'] };
  },
  'out.table.add'(s, c) {
    const name = tableName(s);
    const save = c.wf.nodes.find(m => m.type === 'out.table.save' && tableName(settingsOf(m)) === name);
    const ss = save ? settingsOf(save) : null;
    // No Save results table for it: saved at the end of the run, as Start's table format says.
    const start = c.wf.nodes.find(m => m.type === 'start');
    const fmt = start && getBlock('start') ? settingsOf(start).tableFmt : 'csv';
    return { table: true, caption: ss ? saveName(ss.stem, name, ss.fmt) : saveName('', name, fmt), note: ss ? '' : 'saved at the end', cols: tableCols(c.wf, c.gen, c.node, s, c.wired) };
  },
  'out.table.save'(s, c) {
    const name = tableName(s);
    const cols = [], seen = new Set();
    for (const m of c.wf.nodes) {
      if (m.type !== 'out.table.add') continue;
      const ms = settingsOf(m);
      if (tableName(ms) !== name) continue;
      for (const col of tableCols(c.wf, c.gen, m, ms, wiredNames(c.wf, m))) if (!seen.has(col.name)) { seen.add(col.name); cols.push(col); }
    }
    return { table: true, caption: saveName(s.stem, name, s.fmt), cols: cols.length ? cols : [{ name: 'Column 1' }, { name: 'Column 2' }] };
  },
  'out.series.save'(s, c) {
    const curves = namedRows(rowsOf(s.lines), c.wired, 'Curve', c.wired.has('add') ? c.wired.get('add').name : null);
    return { table: true, caption: (str(s.stem) || 'time_series') + '.csv', cols: [{ name: 'Time (s)', time: true }, ...curves.map(n => ({ name: n }))] };
  },
};

// ---------------------------------------------------------------------------------------------
// Drawing. One SVG 200 units wide (it scales with the block, about 1:1 on a narrow one), the
// plot area inside the title and axis titles; colours come from CSS classes (style.css .pfb-pv),
// so both themes follow.

const W = 200;
const cut = (t, n) => { t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const P = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');

// A frequency-like dip after an event at 18 % of the run, settling a little lower; k varies it.
function dip(x, k) {
  const u = Math.max(0, x - 0.18), a = 0.07 + 0.012 * k;
  const alpha = u > 0 ? (u / a) * Math.exp(1 - u / a) : 0;
  const settle = (0.16 - 0.035 * k) * (1 - Math.exp(-u / 0.09));
  const osc = u > 0 ? 0.035 * Math.exp(-u / 0.14) * Math.sin(u * 38) : 0;
  return 0.22 + 0.06 * k + (0.5 - 0.1 * k) * alpha * (1 - settle) + settle * (1 - alpha) + osc;
}
const LINE_SHAPES = [
  (t) => 0.8 - 0.55 * (1 - Math.exp(-t * 2.4)),
  (t) => 0.72 - 0.36 * t,
  (t) => 0.5 + 0.12 * Math.sin(t * 5.2),
  (t) => 0.86 - 0.2 * t * t,
];

function txt(h, key, x, y, text, cls, max, extra) {
  const full = String(text || '');
  return h('text', { key, x, y, className: cls, ...(extra || {}) }, h('title', null, full), cut(full, max));
}

function chart(h, sp) {
  const kids = [];
  const hasX = !!sp.x && !/3d|surface/.test(sp.chart), hasY = !!sp.y && !/3d|surface/.test(sp.chart);
  const zbar = sp.chart === 'heat';
  const H = 120 + (sp.note ? 10 : 0);
  const top = sp.title ? 19 : 8, left = hasY ? 22 : 8, right = zbar ? 28 : 8, bottom = (hasX ? 20 : 8) + (sp.note ? 10 : 0);
  const x0 = left, x1 = W - right, y0 = top, y1 = H - bottom;
  const X = (t) => x0 + t * (x1 - x0), Y = (t) => y0 + t * (y1 - y0);
  if (sp.title) kids.push(txt(h, 'title', W / 2, 12, sp.title, 'pv-title', 36, { textAnchor: 'middle' }));
  if (hasY) kids.push(txt(h, 'y', 0, 0, sp.y, 'pv-ax', 24, { textAnchor: 'middle', transform: `translate(9 ${((y0 + y1) / 2).toFixed(1)}) rotate(-90)` }));
  if (hasX) kids.push(txt(h, 'x', (x0 + x1) / 2, y1 + 14, sp.x, 'pv-ax', 40, { textAnchor: 'middle' }));
  if (sp.note) kids.push(txt(h, 'note', x0, H - 4, sp.note, 'pv-note', 46));
  const axes = () => {
    for (let k = 1; k <= 3; k++) kids.push(h('line', { key: 'g' + k, x1: x0, x2: x1, y1: Y(k / 4), y2: Y(k / 4), className: 'pv-grid' }));
    kids.push(h('path', { key: 'ax', d: `M${x0} ${y0} L${x0} ${y1} L${x1} ${y1}`, className: 'pv-axis' }));
  };

  if (sp.chart === 'series') {
    axes();
    if (sp.event) kids.push(h('line', { key: 'ev', x1: X(0.18), x2: X(0.18), y1: y0, y2: y1, className: 'pv-event' }));
    (sp.limits || []).forEach((l, i) => {
      const yy = Y(i ? 0.1 : 0.9);
      kids.push(h('line', { key: 'lim' + i, x1: x0, x2: x1, y1: yy, y2: yy, className: 'pv-limit' }));
      kids.push(txt(h, 'liml' + i, x1 - 2, yy - 2, l, 'pv-small', 22, { textAnchor: 'end' }));
    });
    for (let k = Math.min(sp.curves, 4) - 1; k >= 0; k--) {
      const pts = [];
      for (let i = 0; i <= 60; i++) pts.push([X(i / 60), Y(Math.min(0.96, dip(i / 60, k)))]);
      kids.push(h('path', { key: 'c' + k, d: P(pts), className: 'pv-line pv-s' + k }));
    }
    if (sp.mark) {
      let best = [0, 0];
      for (let i = 0; i <= 60; i++) { const v = dip(i / 60, 0); if (v > best[1]) best = [i / 60, v]; }
      kids.push(h('circle', { key: 'mk', cx: X(best[0]), cy: Y(best[1]), r: 2.4, className: 'pv-mark' }));
      kids.push(txt(h, 'mkl', X(best[0]) + 5, Y(best[1]) + 3, sp.mark, 'pv-small', 12));
    }
  } else if (sp.chart === 'line' || sp.chart === 'scatter' || sp.chart === 'bar') {
    axes();
    const n = Math.min(sp.curves, 4), N = 6;
    if (sp.chart === 'bar') {
      const gw = (x1 - x0) / 5, bw = Math.min(10, (gw - 6) / n);
      for (let g = 0; g < 5; g++) for (let k = 0; k < n; k++) {
        const v = LINE_SHAPES[k](g / 4), bx = x0 + g * gw + (gw - bw * n) / 2 + k * bw;
        kids.push(h('rect', { key: `b${g}-${k}`, x: bx, y: Y(v), width: Math.max(1, bw - 1), height: y1 - Y(v), className: 'pv-bar pv-s' + k }));
      }
    } else {
      for (let k = n - 1; k >= 0; k--) {
        const pts = [];
        for (let i = 0; i < N; i++) pts.push([X(0.04 + 0.92 * i / (N - 1)), Y(LINE_SHAPES[k](i / (N - 1)))]);
        if (sp.chart === 'line') kids.push(h('path', { key: 'l' + k, d: P(pts), className: 'pv-line pv-s' + k }));
        pts.forEach((p, i) => kids.push(h('circle', { key: `p${k}-${i}`, cx: p[0], cy: p[1], r: sp.chart === 'scatter' ? 2.3 : 1.6, className: 'pv-dot pv-s' + k })));
      }
    }
  } else if (sp.chart === 'surface' || sp.chart === 'wire3d' || sp.chart === 'points3d') {
    const G = sp.chart === 'points3d' ? 5 : 7;
    const hgt = (u, v) => 0.55 * Math.exp(-((u - 0.62) ** 2 + (v - 0.38) ** 2) / 0.09) + 0.25 * (1 - v) * u;
    const cx = W / 2, cy = y0 + 42;
    const pr = (u, v, z) => [cx + (u - v) * 64, cy + (u + v) * 22 - z * 44];
    const o = pr(0, 0, 0), ex = pr(1, 0, 0), ey = pr(0, 1, 0), ez = pr(0, 0, 1);
    kids.push(h('path', { key: 'ax3', d: `M${ez[0]} ${ez[1]} L${o[0]} ${o[1]} L${ex[0]} ${ex[1]} M${o[0]} ${o[1]} L${ey[0]} ${ey[1]}`, className: 'pv-axis' }));
    kids.push(txt(h, 'x3', ex[0] + 4, ex[1] + 10, sp.x, 'pv-ax', 16, { textAnchor: 'end' }));
    kids.push(txt(h, 'y3', ey[0] - 4, ey[1] + 10, sp.y, 'pv-ax', 16, { textAnchor: 'start' }));
    kids.push(txt(h, 'z3', ez[0] - 4, ez[1] + 3, sp.z, 'pv-ax', 14, { textAnchor: 'end' }));
    const at = (i, j) => pr(i / (G - 1), j / (G - 1), hgt(i / (G - 1), j / (G - 1)));
    if (sp.chart === 'surface') {
      for (let s = 2 * (G - 2); s >= 0; s--) for (let i = 0; i < G - 1; i++) {
        const j = s - i;
        if (j < 0 || j > G - 2) continue;
        const q = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
        const z = hgt((i + 0.5) / (G - 1), (j + 0.5) / (G - 1));
        kids.push(h('path', { key: `q${i}-${j}`, d: P(q) + 'Z', className: 'pv-quad', style: { fillOpacity: (0.12 + 0.7 * Math.min(1, z / 0.6)).toFixed(2) } }));
      }
    } else if (sp.chart === 'wire3d') {
      for (let i = 0; i < G; i++) {
        const a = [], b = [];
        for (let j = 0; j < G; j++) { a.push(at(i, j)); b.push(at(j, i)); }
        kids.push(h('path', { key: 'wi' + i, d: P(a), className: 'pv-line pv-s0 pv-thin' }));
        kids.push(h('path', { key: 'wj' + i, d: P(b), className: 'pv-line pv-s0 pv-thin' }));
      }
    } else {
      for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) { const p = at(i, j); kids.push(h('circle', { key: `d${i}-${j}`, cx: p[0], cy: p[1], r: 1.9, className: 'pv-dot pv-s0' })); }
    }
  } else if (sp.chart === 'heat') {
    const C = 6, R = 4, cw = (x1 - x0) / C, ch = (y1 - y0) / R;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const v = 0.5 + 0.5 * Math.sin(c * 0.95 + 0.4) * Math.cos(r * 0.8 - 0.3);
      kids.push(h('rect', { key: `h${r}-${c}`, x: x0 + c * cw + 0.5, y: y0 + r * ch + 0.5, width: cw - 1, height: ch - 1, rx: 1.5, className: 'pv-cell', style: { fillOpacity: (0.1 + 0.75 * v).toFixed(2) } }));
      if (sp.cells) kids.push(h('text', { key: `t${r}-${c}`, x: x0 + c * cw + cw / 2, y: y0 + r * ch + ch / 2 + 2.5, className: 'pv-cellnum' + (v > 0.6 ? ' is-dark' : ''), textAnchor: 'middle' }, String(Math.round(40 + 60 * v))));
    }
    const gid = 'pfbpv-' + String(sp.id).replace(/[^A-Za-z0-9_-]/g, '');
    kids.push(h('defs', { key: 'defs' }, h('linearGradient', { id: gid, x1: 0, y1: 1, x2: 0, y2: 0 },
      h('stop', { offset: '0%', className: 'pv-stop', style: { stopOpacity: 0.1 } }), h('stop', { offset: '100%', className: 'pv-stop', style: { stopOpacity: 0.85 } }))));
    kids.push(h('rect', { key: 'bar', x: x1 + 6, y: y0, width: 6, height: y1 - y0, rx: 2, fill: `url(#${gid})` }));
    kids.push(txt(h, 'z', 0, 0, sp.z, 'pv-ax', 18, { textAnchor: 'middle', transform: `translate(${x1 + 20} ${((y0 + y1) / 2).toFixed(1)}) rotate(90)` }));
  } else if (sp.chart === 'conv-limit') {
    axes();
    const tries = [1, 0, 0.5, 0.75, 0.625, 0.69, 0.66, 0.672], pass = [false, true, true, false, true, false, true, false];
    const n = tries.length, sx = (i) => X(0.05 + 0.9 * i / (n - 1)), sy = (v) => Y(0.1 + 0.8 * (1 - v));
    let lo = 0, hi = 1;
    const band = [];
    tries.forEach((v, i) => { if (i >= 1) { if (pass[i]) lo = v; else hi = v; band.push([i, lo, hi]); } });
    const upper = [], lower = [];
    band.forEach(([i, a, b], k) => {
      const xa = sx(i), xb = k + 1 < band.length ? sx(band[k + 1][0]) : sx(n - 1) + 4;
      upper.push([xa, sy(b)], [xb, sy(b)]); lower.push([xa, sy(a)], [xb, sy(a)]);
    });
    kids.push(h('path', { key: 'band', d: P([...upper, ...lower.reverse()]) + 'Z', className: 'pv-band' }));
    tries.forEach((v, i) => kids.push(h('circle', { key: 'tr' + i, cx: sx(i), cy: sy(v), r: 2.4, className: pass[i] ? 'pv-pass' : 'pv-fail' })));
  } else if (sp.chart === 'conv-opt') {
    axes();
    const sc = [0.82, 0.55, 0.7, 0.42, 0.5, 0.33, 0.38, 0.3, 0.34, 0.28];
    const n = sc.length, sx = (i) => X(0.05 + 0.9 * i / (n - 1)), sy = (v) => Y(0.08 + 0.84 * (1 - v));
    let best = Infinity;
    const step = [];
    sc.forEach((v, i) => { best = Math.min(best, v); if (i) step.push([sx(i), step[step.length - 1][1]]); step.push([sx(i), sy(best)]); });
    kids.push(h('path', { key: 'best', d: P(step), className: 'pv-line pv-s1' }));
    sc.forEach((v, i) => kids.push(h('circle', { key: 's' + i, cx: sx(i), cy: sy(v), r: 2.2, className: 'pv-dot pv-s0' })));
  }

  // The legend: what each mark is, in the reader's words, top right (three rows at most).
  const leg = (sp.legend || []).slice(0, 3);
  if (leg.length) {
    const more = (sp.legend || []).length - leg.length;
    const rows = more > 0 ? [...leg, `+ ${more} more`] : leg;
    const wTxt = Math.min(112, 18 + Math.max(...rows.map(r => Math.min(r.length, 24))) * 3.9);
    const hTxt = rows.length * 9.5 + 4;
    const lx = x1 - wTxt - 2, ly = sp.legendAt === 'bottom' ? y1 - hTxt - 3 : y0 + 2;
    kids.push(h('rect', { key: 'legbg', x: lx, y: ly, width: wTxt, height: hTxt, rx: 3, className: 'pv-legbg' }));
    rows.forEach((r, i) => {
      const yy = ly + 8 + i * 9.5;
      const cls = sp.chart === 'conv-limit' ? ['pv-pass', 'pv-fail', 'pv-band'][i] : null;
      if (i < leg.length) {
        if (cls === 'pv-band') kids.push(h('rect', { key: 'lsw' + i, x: lx + 3, y: yy - 4, width: 9, height: 5, className: 'pv-band' }));
        else if (cls) kids.push(h('circle', { key: 'lsw' + i, cx: lx + 7.5, cy: yy - 1.5, r: 2.2, className: cls }));
        else if (sp.chart === 'scatter' || (sp.chart === 'conv-opt' && i === 0)) kids.push(h('circle', { key: 'lsw' + i, cx: lx + 7.5, cy: yy - 1.5, r: 2, className: 'pv-dot pv-s' + i }));
        else if (sp.chart === 'bar') kids.push(h('rect', { key: 'lsw' + i, x: lx + 3, y: yy - 4, width: 9, height: 5, className: 'pv-bar pv-s' + i }));
        else kids.push(h('line', { key: 'lsw' + i, x1: lx + 3, x2: lx + 12, y1: yy - 1.5, y2: yy - 1.5, className: 'pv-line pv-s' + i }));
      }
      kids.push(txt(h, 'lt' + i, lx + 15, yy + 1, r, 'pv-small', 24));
    });
  }
  return h('svg', { viewBox: `0 0 ${W} ${H}`, className: 'pfb-pv-svg', role: 'img', 'aria-label': 'Preview with mock values' + (sp.title ? ': ' + sp.title : '') }, kids);
}

// A table: its file, then its columns with three rows of mock values (a loop column, tinted in
// the loop colour, shows the loop's own first values when its settings say them).
function table(h, sp) {
  const MAX = 4;
  const cols = sp.cols.slice(0, MAX), more = sp.cols.length - cols.length;
  const mock = (col, r, k) => {
    if (col.loop) return col.vals && col.vals[r] !== undefined ? col.vals[r] : '…';
    if (col.status) return 'OK';
    if (col.time) return (r * 0.01).toFixed(2);
    return (((k * 37 + r * 13) % 50) / 10 + 1).toFixed(2);
  };
  const head = cols.map((col, k) => h('th', { key: k, title: col.loop ? col.name + ': the loop\'s value on that pass' : col.name, className: col.loop ? 'is-loop' : '' }, h('span', { className: 'pv-th' }, col.name)));
  if (more > 0) head.push(h('th', { key: 'more', className: 'pv-more', title: sp.cols.slice(MAX).map(c => c.name).join(', ') }, '+' + more));
  const body = [0, 1, 2].map(r => h('tr', { key: r }, cols.map((col, k) => h('td', { key: k, className: col.loop ? 'is-loop' : '' }, mock(col, r, k))), more > 0 ? h('td', { key: 'more', className: 'pv-more' }, '…') : null));
  return h('div', { className: 'pfb-pv-table' },
    h('div', { className: 'pfb-pv-cap' },
      h('svg', { viewBox: '0 0 16 16', width: 11, height: 11, 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round' }, h('path', { d: 'M3.5 1.8h6l3 3v9.4h-9z' }), h('path', { d: 'M9.5 1.8v3h3' })),
      h('span', { className: 'pfb-pv-file', title: sp.caption }, sp.caption), sp.note ? h('span', { className: 'pfb-pv-capnote' }, sp.note) : null),
    h('table', null, h('thead', null, h('tr', null, head)), h('tbody', null, body)));
}

export function renderPreview(h, spec) {
  if (!spec) return null;
  return spec.table ? table(h, spec) : chart(h, spec);
}
