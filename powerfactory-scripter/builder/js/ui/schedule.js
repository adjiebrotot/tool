// The schedule editor: the steps of a dynamic event, as a table and as a graph of the same
// rows. Whatever is changed in one is what the other draws, because both read and write the one
// setting value: [{ id, t, v }], times in seconds, values in the parameter's own unit.
//
// The graph draws what the simulation does: the value holds until the next step, so the line is
// a staircase. Before the first step the value is whatever the model has, drawn as a dashed
// lead-in. A point can be dragged (sideways for the time, up and down for the value), a click in
// the empty plot area adds a step there, and a point goes with Delete or its row's bin. The
// table is the way with the keyboard; the graph is the way with the mouse. Both write the whole
// list back, so a row keeps its id and the script's order never surprises anyone.
//
// spec = { st, value, set(rows), done(), fid }

import { el, esc, tipText, iconButton } from './dom.js';

const W = 300, H = 132, PAD_L = 42, PAD_R = 10, PAD_T = 12, PAD_B = 22;
const PW = W - PAD_L - PAD_R, PH = H - PAD_T - PAD_B;
const SVG_NS = 'http://www.w3.org/2000/svg';

const num = (v, dflt = 0) => (Number.isFinite(Number(v)) ? Number(v) : dflt);
function parse(text) {
  const t = String(text === undefined || text === null ? '' : text).trim().replace(/\s/g, '').replace(',', '.');
  if (t === '' || !/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) return NaN;
  return Number(t);
}

export const scheduleRows = (v) => (Array.isArray(v) ? v : [])
  .filter(r => r && typeof r === 'object')
  .map((r, i) => ({ id: typeof r.id === 'string' && r.id ? r.id : 's' + (i + 1), t: num(r.t), v: num(r.v) }));

// The rows in time order: what the script writes, and what the graph draws.
export const sortedSteps = (v) => scheduleRows(v).slice().sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

function nextId(rows) {
  const used = new Set(rows.map(r => r.id));
  let k = 1;
  while (used.has('s' + k)) k++;
  return 's' + k;
}

function ticks(lo, hi, n = 4) {
  if (!(hi > lo)) return [lo];
  const raw = (hi - lo) / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || mag * 10;
  const out = [];
  for (let x = Math.ceil(lo / step) * step; x <= hi + step / 1000; x += step) out.push(Math.round(x / step) * step);
  return out;
}
const fmt = (x) => {
  if (!Number.isFinite(x)) return '0';
  const a = Math.abs(x);
  if (a === 0) return '0';
  if (a >= 100000 || a < 0.001) return x.toPrecision(3);
  return String(Math.round(x * 10000) / 10000);
};

function bounds(steps, st) {
  const ts = steps.map(s => s.t), vs = steps.map(s => s.v);
  const t0 = 0;
  const tmax = Math.max(1, ...(ts.length ? ts : [1]));
  const t1 = tmax + Math.max(0.25, tmax * 0.18);
  let v0 = Math.min(...(vs.length ? vs : [0, 1]));
  let v1 = Math.max(...(vs.length ? vs : [0, 1]));
  if (typeof st.min === 'number') v0 = Math.min(v0, st.min);
  if (typeof st.max === 'number') v1 = Math.max(v1, st.max);
  if (!(v1 - v0 > 1e-9)) { const p = Math.max(Math.abs(v1) * 0.25, 0.1); v0 -= p; v1 += p; }
  else { const p = (v1 - v0) * 0.2; v0 -= p; v1 += p; }
  return { t0, t1, v0, v1 };
}

export function scheduleField(spec) {
  const st = spec.st;
  const unit = st.unit ? ' (' + st.unit + ')' : '';
  const box = el('div', { class: 'pfb-sched' });
  const plotWrap = el('div', { class: 'pfb-sched-plotwrap' });
  const table = el('div', { class: 'pfb-sched-table' });
  let cur = scheduleRows(spec.value);
  let drag = null;

  const push = () => spec.set(cur.map(r => ({ id: r.id, t: r.t, v: r.v })));
  const close = () => { if (spec.done) spec.done(); };
  const clampT = (t) => Math.max(0, Math.round(t * 1000) / 1000);
  const clampV = (v) => Math.round(v * 100000) / 100000;

  // ---- Graph
  const mk = (tag, attrs) => { const n = document.createElementNS(SVG_NS, tag); for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, String(v)); return n; };

  function drawPlot() {
    const steps = sortedSteps(cur);
    const B = bounds(steps, st);
    const X = (t) => PAD_L + ((t - B.t0) / (B.t1 - B.t0)) * PW;
    const Y = (v) => PAD_T + (1 - (v - B.v0) / (B.v1 - B.v0)) * PH;
    const svg = mk('svg', {
      class: 'pfb-sched-plot', viewBox: `0 0 ${W} ${H}`, role: 'img',
      'aria-label': steps.length ? `${steps.length} step${steps.length === 1 ? '' : 's'} over time, the last at ${fmt(steps[steps.length - 1].t)} seconds` : 'No steps yet',
    });
    for (const v of ticks(B.v0, B.v1, 3)) {
      if (v < B.v0 - 1e-9 || v > B.v1 + 1e-9) continue;
      svg.appendChild(mk('line', { class: 'pfb-sched-grid', x1: PAD_L, x2: W - PAD_R, y1: Y(v).toFixed(1), y2: Y(v).toFixed(1) }));
      const lab = mk('text', { class: 'pfb-sched-tick', x: PAD_L - 5, y: (Y(v) + 3.4).toFixed(1), 'text-anchor': 'end' });
      lab.textContent = fmt(v);
      svg.appendChild(lab);
    }
    for (const t of ticks(B.t0, B.t1, 4)) {
      if (t < B.t0 - 1e-9 || t > B.t1 + 1e-9) continue;
      svg.appendChild(mk('line', { class: 'pfb-sched-grid', y1: PAD_T, y2: PAD_T + PH, x1: X(t).toFixed(1), x2: X(t).toFixed(1) }));
      const lab = mk('text', { class: 'pfb-sched-tick', y: H - 7, x: X(t).toFixed(1), 'text-anchor': 'middle' });
      lab.textContent = fmt(t);
      svg.appendChild(lab);
    }
    svg.appendChild(mk('line', { class: 'pfb-sched-axis', x1: PAD_L, x2: W - PAD_R, y1: PAD_T + PH, y2: PAD_T + PH }));
    svg.appendChild(mk('line', { class: 'pfb-sched-axis', x1: PAD_L, x2: PAD_L, y1: PAD_T, y2: PAD_T + PH }));
    const xlab = mk('text', { class: 'pfb-sched-axlab', x: W - PAD_R, y: H - 7, 'text-anchor': 'end' });
    xlab.textContent = 's';
    svg.appendChild(xlab);

    if (steps.length) {
      svg.appendChild(mk('path', { class: 'pfb-sched-lead', d: `M ${PAD_L} ${Y(steps[0].v).toFixed(1)} L ${X(steps[0].t).toFixed(1)} ${Y(steps[0].v).toFixed(1)}` }));
      const d = [`M ${X(steps[0].t).toFixed(1)} ${Y(steps[0].v).toFixed(1)}`];
      for (let i = 1; i < steps.length; i++) {
        d.push(`L ${X(steps[i].t).toFixed(1)} ${Y(steps[i - 1].v).toFixed(1)}`);
        d.push(`L ${X(steps[i].t).toFixed(1)} ${Y(steps[i].v).toFixed(1)}`);
      }
      d.push(`L ${(W - PAD_R).toFixed(1)} ${Y(steps[steps.length - 1].v).toFixed(1)}`);
      svg.appendChild(mk('path', { class: 'pfb-sched-line', d: d.join(' ') }));
    } else {
      const hint = mk('text', { class: 'pfb-sched-empty', x: PAD_L + PW / 2, y: PAD_T + PH / 2 + 3, 'text-anchor': 'middle' });
      hint.textContent = 'Click here to add a step';
      svg.appendChild(hint);
    }

    const at = (e) => {
      const r = svg.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
    };
    const onMove = (e) => {
      if (!drag) return;
      e.preventDefault();
      const p = at(e);
      cur = cur.map(r => (r.id === drag ? { ...r, t: clampT(B.t0 + ((p.x - PAD_L) / PW) * (B.t1 - B.t0)), v: clampV(B.v0 + (1 - (p.y - PAD_T) / PH) * (B.v1 - B.v0)) } : r));
      push();
      drawPlot();
      drawTableValues();
    };
    const end = () => {
      if (!drag) return;
      drag = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', end);
      close();
      drawTable();
    };
    for (const s of steps) {
      const g = mk('g', { class: 'pfb-sched-pt' + (drag === s.id ? ' dragging' : ''), tabindex: '0', role: 'button', 'aria-label': `Step at ${fmt(s.t)} seconds, new value ${fmt(s.v)}${unit}. The arrow keys move it; Del takes it out.` });
      g.appendChild(mk('circle', { class: 'pfb-sched-hit', cx: X(s.t).toFixed(1), cy: Y(s.v).toFixed(1), r: 11 }));
      g.appendChild(mk('circle', { class: 'pfb-sched-dot', cx: X(s.t).toFixed(1), cy: Y(s.v).toFixed(1), r: 4.5 }));
      g.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        drag = s.id;
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', end);
      });
      g.addEventListener('keydown', (e) => {
        const dv = (B.v1 - B.v0) / 50, dt = (B.t1 - B.t0) / 50;
        let patch = null;
        if (e.key === 'ArrowUp') patch = { v: clampV(s.v + (e.shiftKey ? dv * 5 : dv)) };
        else if (e.key === 'ArrowDown') patch = { v: clampV(s.v - (e.shiftKey ? dv * 5 : dv)) };
        else if (e.key === 'ArrowRight') patch = { t: clampT(s.t + (e.shiftKey ? dt * 5 : dt)) };
        else if (e.key === 'ArrowLeft') patch = { t: clampT(s.t - (e.shiftKey ? dt * 5 : dt)) };
        else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(s.id); return; }
        if (!patch) return;
        e.preventDefault();
        cur = cur.map(r => (r.id === s.id ? { ...r, ...patch } : r));
        push();
        close();
        drawPlot();
        drawTable();
        const back = plotWrap.querySelectorAll('.pfb-sched-pt')[sortedSteps(cur).findIndex(z => z.id === s.id)];
        if (back) back.focus();
      });
      svg.appendChild(g);
    }
    svg.addEventListener('pointerdown', (e) => {
      const p = at(e);
      if (p.x < PAD_L || p.x > W - PAD_R || p.y < PAD_T || p.y > PAD_T + PH) return;
      cur = [...cur, {
        id: nextId(cur),
        t: clampT(B.t0 + ((p.x - PAD_L) / PW) * (B.t1 - B.t0)),
        v: clampV(B.v0 + (1 - (p.y - PAD_T) / PH) * (B.v1 - B.v0)),
      }];
      push();
      close();
      drawPlot();
      drawTable();
    });
    if (spec.fid) svg.dataset.fid = spec.fid + ':plot';
    plotWrap.textContent = '';
    plotWrap.appendChild(svg);
  }

  function remove(id) {
    cur = cur.filter(r => r.id !== id);
    push();
    close();
    drawPlot();
    drawTable();
  }

  // ---- Table
  // While a drag is running only the numbers are rewritten, so the field being typed in keeps
  // its focus and its caret.
  function drawTableValues() {
    for (const r of cur) {
      for (const key of ['t', 'v']) {
        const i = table.querySelector(`[data-row="${CSS.escape(r.id)}"][data-col="${key}"]`);
        if (i && i !== document.activeElement) i.value = fmt(r[key]);
      }
    }
  }
  function drawTable() {
    table.textContent = '';
    table.appendChild(el('div', { class: 'pfb-sched-row pfb-sched-head' },
      el('span', { text: 'Time (s)' }), el('span', { text: 'New value' + unit }), el('span', { class: 'pfb-sched-sp' })));
    for (const s of sortedSteps(cur)) {
      const cell = (key, label) => {
        const i = el('input', { type: 'text', inputmode: 'decimal', class: 'txt-input pfb-sched-in', value: fmt(s[key]), 'aria-label': label, spellcheck: 'false' });
        i.dataset.row = s.id;
        i.dataset.col = key;
        i.dataset.fid = (spec.fid || 'sched') + ':' + s.id + ':' + key;
        i.addEventListener('input', () => {
          const n = parse(i.value);
          const bad = i.value.trim() !== '' && !Number.isFinite(n);
          i.classList.toggle('pfb-invalid', bad);
          if (!Number.isFinite(n)) return;
          cur = cur.map(r => (r.id === s.id ? { ...r, [key]: key === 't' ? Math.max(0, n) : n } : r));
          push();
          drawPlot();
        });
        i.addEventListener('blur', () => { i.classList.remove('pfb-invalid'); i.value = fmt((cur.find(r => r.id === s.id) || s)[key]); close(); drawTable(); });
        return i;
      };
      const del = iconButton('trash', 'Remove this step', 'sm');
      del.addEventListener('click', () => remove(s.id));
      table.appendChild(el('div', { class: 'pfb-sched-row' }, cell('t', 'Time in seconds'), cell('v', 'New value'), del));
    }
  }

  drawPlot();
  drawTable();
  const add = el('button', { type: 'button', class: 'btn-secondary btn-sm pfb-sched-add', text: '+ Add step' });
  add.addEventListener('click', () => {
    const last = sortedSteps(cur)[cur.length - 1];
    cur = [...cur, { id: nextId(cur), t: last ? Math.round((last.t + 1) * 1000) / 1000 : 1, v: last ? last.v : 1 }];
    push();
    close();
    drawPlot();
    drawTable();
  });
  box.appendChild(plotWrap);
  box.appendChild(table);
  box.appendChild(el('div', { class: 'pfb-sched-foot' }, add,
    el('span', { class: 'pfb-sched-hint' },
      el('span', { text: 'Drag a point, or click the graph to add one.' }),
      el('span', { class: 'tip-icon', 'data-tip': esc(tipText('The new value holds until the next step, the way PowerFactory applies a parameter event. Before the first step the model keeps its own value.')) }, '?'))));
  return box;
}
