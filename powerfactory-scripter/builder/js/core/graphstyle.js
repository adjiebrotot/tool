// The graph style: how every graph a workflow draws looks (Workflow > Graph style).
//
// Saved on the workflow as `graph` (DESIGN section 3), in full, so a workflow keeps the look it
// was saved with even if a template here is changed later. A workflow without it (every
// workflow saved before graph styles existed) draws in the default, the Adjie Brotools style.
// The generator writes the style into the script's SETTINGS as GRAPH_STYLE, and runtime/
// outputs.py reads it (_po_st), checking every value the same way normalizeStyle does here.
//
// Frozen handles (CLAUDE.md "Change an existing tool with the least damage"): the workflow key
// `graph`, the style's keys below, the template ids, the select values (strings) and the ramp
// ids. Rename the words a reader sees, never these. A key added later takes the default's value
// when a saved style has none, so it must default to the way graphs looked before it.
//
// Plain ES module, no DOM.

export const DEFAULT_TEMPLATE = 'brotools';

// The Adjie Brotools style: the site's own charts (light.css chart tokens, the neutral series
// sequence of SharedPalette: --line-a, --gold, --line-c, --line-d, --line-e), in DM Sans, the
// bold title centred as on an exported PNG, the key under the graph. Keep it equal to
// _PO_DEFAULT in runtime/outputs.py.
const BROTOOLS = {
  template: 'brotools',
  colors: ['#5A91E8', '#B45309', '#4A9E87', '#C46A7E', '#9B59B6'],
  ramp: 'blue',
  background: '#FFFFFF',
  plot_background: '#FFFFFF',
  text: '#14203A',
  muted: '#4C5B76',
  grid: '#C8D4E8',
  axis: '#C8D4E8',
  font: 'DM Sans',
  font_size: 9.5,
  title_size: 13,
  title_bold: true,
  title_align: 'center',
  grid_axes: 'both',
  grid_style: 'solid',
  frame: 'left-bottom',
  ticks: 'out',
  thousands: true,
  line_width: 2,
  markers: 'auto',
  line_styles: 'solid',
  legend: 'bottom',
  legend_frame: false,
  width: 10,
  height: 5.6,
  dpi: 150,
  transparent: false,
  also_save: '',
};

export const STYLE_KEYS = Object.keys(BROTOOLS);
export const COLOR_KEYS = ['background', 'plot_background', 'text', 'muted', 'grid', 'axis'];
export const RANGES = {
  font_size: [5, 30], title_size: [5, 48], line_width: [0.3, 8],
  width: [2, 30], height: [1.5, 20], dpi: [50, 600],
};
export const MAX_COLORS = 12;

// Colour ramps for heat maps, 3D graphs and more lines than the series colours hold, low to
// high. Keep them equal to _PO_RAMPS in runtime/outputs.py.
export const RAMPS = {
  blue: { name: 'Adjie Brotools blue', stops: ['#EAF2FF', '#BCD3F7', '#8FB5FF', '#5A91E8', '#3A71C8', '#0052CC', '#1A3F86', '#14203A'] },
  night: { name: 'Night blue (for a dark background)', stops: ['#1C2942', '#1F3E73', '#2D67C7', '#5A91E8', '#8DBBFF', '#C4DCFF', '#EAF1FF'] },
  viridis: { name: 'Viridis', stops: ['#440154', '#472D7B', '#3B528B', '#2C728E', '#21918C', '#28AE80', '#5EC962', '#ADDC30', '#FDE725'] },
  cividis: { name: 'Cividis (colour-blind safe)', stops: ['#00224E', '#123570', '#3B496C', '#575D6D', '#707173', '#8A8779', '#A69D75', '#C4B56C', '#E4CF5B', '#FEE838'] },
  magma: { name: 'Magma', stops: ['#000004', '#1C1044', '#4F127B', '#812581', '#B5367A', '#E55064', '#FB8761', '#FEC287', '#FCFDBF'] },
  coolwarm: { name: 'Cool to warm (for values either side of a middle)', stops: ['#3B4CC0', '#6788EE', '#9ABBFF', '#C9D7F0', '#EDD1C2', '#F7A889', '#E26952', '#B40426'] },
  greys: { name: 'Greys (for print)', stops: ['#F7F7F7', '#D9D9D9', '#BDBDBD', '#969696', '#737373', '#525252', '#252525'] },
  classic: { name: 'Builder classic blue', stops: ['#CDE2FB', '#B7D3F6', '#9EC5F4', '#86B6EF', '#6DA7EC', '#5598E7', '#3987E5', '#2A78D6', '#256ABF', '#1C5CAB', '#184F95', '#104281', '#0D366B'] },
};

// Series colours to fill the swatches from.
export const PALETTES = [
  { id: 'brotools', name: 'Adjie Brotools', colors: BROTOOLS.colors },
  { id: 'night', name: 'Adjie Brotools, night', colors: ['#8DBBFF', '#FFD28C', '#8FCDBD', '#F1C0D0', '#C9A7EB'] },
  { id: 'tableau', name: 'Tableau 10', colors: ['#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F', '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC'] },
  { id: 'okabe', name: 'Okabe-Ito (colour-blind safe)', colors: ['#0072B2', '#D55E00', '#009E73', '#E69F00', '#CC79A7', '#56B4E9', '#000000'] },
  { id: 'vivid', name: 'Vivid', colors: ['#2563EB', '#F97316', '#10B981', '#E11D48', '#8B5CF6', '#EAB308', '#0EA5E9', '#64748B'] },
  { id: 'classic', name: 'Builder classic', colors: ['#2A78D6', '#EB6834', '#1BAF7A', '#EDA100', '#E87BA4', '#008300', '#6250D6', '#E34948'] },
  { id: 'greys', name: 'Greys (for print)', colors: ['#111111', '#555555', '#888888', '#B0B0B0'] },
];

// The line patterns in turn when line_styles is "vary" (null: solid), as dash and gap lengths
// in multiples of the line width. Keep equal to _PO_LINE_DASHES in runtime/outputs.py.
export const LINE_DASHES = [null, [4, 2], [1, 1.6], [4, 1.6, 1, 1.6], [7, 2], [4, 1.6, 1, 1.6, 1, 1.6]];

// The fonts offered. Any family name works in the script; one this computer lacks falls back to
// a family of the same kind (outputs.py _po_family), and DM Sans comes with the study package.
export const FONTS = [
  { value: 'DM Sans', label: 'DM Sans (the site\u2019s font)', css: "'DM Sans', system-ui, sans-serif" },
  { value: 'Segoe UI', label: 'Segoe UI (Windows)', css: "'Segoe UI', system-ui, sans-serif" },
  { value: 'Arial', label: 'Arial', css: 'Arial, Helvetica, sans-serif' },
  { value: 'Calibri', label: 'Calibri (Office)', css: "Calibri, Carlito, 'Segoe UI', sans-serif" },
  { value: 'Times New Roman', label: 'Times New Roman (serif)', css: "'Times New Roman', Times, serif" },
  { value: 'Cambria', label: 'Cambria (serif, Office)', css: "Cambria, Caladea, Georgia, serif" },
  { value: 'DejaVu Sans', label: 'DejaVu Sans (matplotlib\u2019s own)', css: "'DejaVu Sans', Verdana, sans-serif" },
];
const SERIF = ['times new roman', 'times', 'cambria', 'georgia', 'garamond', 'book antiqua', 'palatino linotype', 'liberation serif', 'nimbus roman', 'stixgeneral', 'dejavu serif', 'serif'];
export const fontCss = (name) => {
  const f = FONTS.find(x => x.value === name);
  if (f) return f.css;
  const q = "'" + String(name).replace(/['\\]/g, '') + "'";
  return q + (SERIF.includes(String(name).toLowerCase()) ? ', serif' : ', system-ui, sans-serif');
};

// The choices of the select keys: [value, words]. The values are frozen.
export const CHOICES = {
  title_align: [['center', 'Centre'], ['left', 'Left']],
  grid_axes: [['both', 'Both ways'], ['y', 'Across only (value lines)'], ['x', 'Up only (time lines)'], ['none', 'None']],
  grid_style: [['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']],
  frame: [['left-bottom', 'Left and bottom'], ['box', 'All four sides'], ['bottom', 'Bottom only'], ['none', 'None']],
  ticks: [['out', 'Outside'], ['in', 'Inside'], ['none', 'None']],
  markers: [['auto', 'Up to 40 points'], ['always', 'Always'], ['never', 'Never']],
  line_styles: [['solid', 'All solid'], ['vary', 'Solid, dashed, dotted ... in turn (for black and white print)']],
  legend: [['bottom', 'Under the graph'], ['top', 'Above the graph'], ['right', 'Right of the graph'], ['inside', 'Inside, where it fits'], ['none', 'No key']],
  also_save: [['', 'Nothing else'], ['svg', 'An SVG too (vector, for editing)'], ['pdf', 'A PDF too (vector, for LaTeX and print)']],
};

// The templates, in the order the modal shows them. Each is a whole style. `group: 'standard'`
// marks the ones that follow a publisher's or a program's house style; the modal lists them
// apart. Sizes follow the publisher's column widths (IEEE 3.5 in and 7.16 in, Elsevier 90 mm
// and 190 mm); the dpi is the most the style allows (600), which line art asks for.
export const TEMPLATES = [
  {
    id: 'brotools', name: 'Adjie Brotools', desc: 'The site\u2019s own charts: soft blue grid, the key under the graph.',
    style: BROTOOLS,
  },
  {
    id: 'brotools-night', name: 'Adjie Brotools, night', desc: 'The site at night, for slides with a dark background.',
    style: {
      ...BROTOOLS, template: 'brotools-night',
      colors: ['#8DBBFF', '#FFD28C', '#8FCDBD', '#F1C0D0', '#C9A7EB'], ramp: 'night',
      background: '#0F1728', plot_background: '#0F1728', text: '#EAF1FF', muted: '#A8B6CF', grid: '#2C3A52', axis: '#2C3A52',
    },
  },
  {
    id: 'minimal', name: 'Minimal', desc: 'Value lines only, no frame, the key above the graph.',
    style: {
      ...BROTOOLS, template: 'minimal',
      colors: ['#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F', '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC'], ramp: 'viridis',
      text: '#1F1F1F', muted: '#6B6B6B', grid: '#E6E6E6', axis: '#BDBDBD',
      font: 'Arial', title_size: 14, title_bold: false, title_align: 'left',
      grid_axes: 'y', frame: 'bottom', ticks: 'none', line_width: 1.8, legend: 'top',
    },
  },
  {
    id: 'report', name: 'Report', desc: 'For a printed report: serif text, a full frame, colour-blind safe lines.',
    style: {
      ...BROTOOLS, template: 'report',
      colors: ['#0072B2', '#D55E00', '#009E73', '#E69F00', '#CC79A7', '#56B4E9', '#000000'], ramp: 'cividis',
      text: '#000000', muted: '#222222', grid: '#D4D4D4', axis: '#000000',
      font: 'Times New Roman', font_size: 9, title_size: 10.5, title_bold: false,
      grid_style: 'dashed', frame: 'box', ticks: 'in', thousands: false,
      line_width: 1.2, legend: 'inside', legend_frame: true,
      width: 6.5, height: 3.8, dpi: 300,
    },
  },
  {
    id: 'slides', name: 'Presentation', desc: 'Large text and thick lines at 16:9, to read from the back of the room.',
    style: {
      ...BROTOOLS, template: 'slides',
      colors: ['#2563EB', '#F97316', '#10B981', '#E11D48', '#8B5CF6', '#EAB308', '#0EA5E9', '#64748B'],
      text: '#0F172A', muted: '#475569', grid: '#E2E8F0', axis: '#94A3B8',
      font: 'Segoe UI', font_size: 13, title_size: 20, title_align: 'left',
      grid_axes: 'y', frame: 'bottom', ticks: 'none', line_width: 3, legend: 'top',
      width: 13.33, height: 7.5,
    },
  },
  {
    id: 'classic', name: 'Builder classic', desc: 'How the Builder drew graphs before graph styles.',
    style: {
      ...BROTOOLS, template: 'classic',
      colors: ['#2A78D6', '#EB6834', '#1BAF7A', '#EDA100', '#E87BA4', '#008300', '#6250D6', '#E34948'], ramp: 'classic',
      text: '#0B0B0B', muted: '#52514E', grid: '#E1E0D9', axis: '#C3C2B7',
      font: 'DejaVu Sans', font_size: 9, title_size: 12, title_bold: false, title_align: 'left',
      thousands: false, line_width: 1.5, legend: 'inside', dpi: 120,
    },
  },
  {
    id: 'ieee', name: 'IEEE, one column', group: 'standard',
    desc: 'IEEE Transactions and conference papers: 3.5 in wide, Times 8 pt, a full frame with ticks inside, lines that stay apart in black and white.',
    style: {
      ...BROTOOLS, template: 'ieee',
      colors: ['#000000', '#0072B2', '#D55E00', '#009E73', '#CC79A7', '#E69F00'], ramp: 'greys',
      text: '#000000', muted: '#000000', grid: '#C8C8C8', axis: '#000000',
      font: 'Times New Roman', font_size: 8, title_size: 8, title_bold: false,
      grid_style: 'dotted', frame: 'box', ticks: 'in', thousands: false,
      line_width: 1, line_styles: 'vary', legend: 'inside', legend_frame: true,
      width: 3.5, height: 2.6, dpi: 600, also_save: 'pdf',
    },
  },
  {
    id: 'ieee-wide', name: 'IEEE, two columns', group: 'standard',
    desc: 'An IEEE figure across both columns: 7.16 in wide, otherwise as IEEE, one column.',
    style: {
      ...BROTOOLS, template: 'ieee-wide',
      colors: ['#000000', '#0072B2', '#D55E00', '#009E73', '#CC79A7', '#E69F00'], ramp: 'greys',
      text: '#000000', muted: '#000000', grid: '#C8C8C8', axis: '#000000',
      font: 'Times New Roman', font_size: 8, title_size: 8, title_bold: false,
      grid_style: 'dotted', frame: 'box', ticks: 'in', thousands: false,
      line_width: 1, line_styles: 'vary', legend: 'inside', legend_frame: true,
      width: 7.16, height: 3, dpi: 600, also_save: 'pdf',
    },
  },
  {
    id: 'elsevier', name: 'Elsevier, one column', group: 'standard',
    desc: 'Elsevier journals (Electric Power Systems Research, IJEPES): 90 mm wide, Arial 8 pt, colour-blind safe lines, the key in a box.',
    style: {
      ...BROTOOLS, template: 'elsevier',
      colors: ['#0072B2', '#D55E00', '#009E73', '#E69F00', '#CC79A7', '#56B4E9', '#000000'], ramp: 'cividis',
      text: '#000000', muted: '#000000', grid: '#DDDDDD', axis: '#000000',
      font: 'Arial', font_size: 8, title_size: 8, title_bold: false,
      grid_axes: 'none', frame: 'box', ticks: 'in', thousands: false,
      line_width: 1, legend: 'inside', legend_frame: true,
      width: 3.54, height: 2.6, dpi: 600, also_save: 'pdf',
    },
  },
  {
    id: 'matlab', name: 'MATLAB', group: 'standard',
    desc: 'The look of a MATLAB figure with grid on: its line colours, Arial (Helvetica on Windows), a full frame with ticks inside, the key in a box.',
    style: {
      ...BROTOOLS, template: 'matlab',
      colors: ['#0072BD', '#D95319', '#EDB120', '#7E2F8E', '#77AC30', '#4DBEEE', '#A2142F'], ramp: 'viridis',
      text: '#000000', muted: '#262626', grid: '#DFDFDF', axis: '#262626',
      font: 'Arial', font_size: 9, title_size: 11, title_bold: true,
      frame: 'box', ticks: 'in', thousands: false,
      line_width: 1.2, legend: 'inside', legend_frame: true,
      width: 5.6, height: 4.2,
    },
  },
  {
    id: 'matplotlib', name: 'Matplotlib', group: 'standard',
    desc: 'matplotlib\u2019s own defaults: Tableau colours, DejaVu Sans, a full frame, no grid.',
    style: {
      ...BROTOOLS, template: 'matplotlib',
      colors: ['#1F77B4', '#FF7F0E', '#2CA02C', '#D62728', '#9467BD', '#8C564B', '#E377C2', '#7F7F7F', '#BCBD22', '#17BECF'], ramp: 'viridis',
      text: '#000000', muted: '#000000', grid: '#B0B0B0', axis: '#000000',
      font: 'DejaVu Sans', font_size: 10, title_size: 12, title_bold: false,
      grid_axes: 'none', frame: 'box', thousands: false,
      line_width: 1.5, legend: 'inside', legend_frame: true,
      width: 6.4, height: 4.8, dpi: 150,
    },
  },
  {
    id: 'ggplot', name: 'ggplot2', group: 'standard',
    desc: 'R\u2019s ggplot2: a grey panel with white grid lines, no frame, the key at the right.',
    style: {
      ...BROTOOLS, template: 'ggplot',
      colors: ['#F8766D', '#00BA38', '#619CFF', '#C77CFF', '#00BFC4', '#B79F00', '#F564E3'], ramp: 'viridis',
      plot_background: '#EBEBEB', text: '#000000', muted: '#4D4D4D', grid: '#FFFFFF', axis: '#333333',
      font: 'Arial', font_size: 9, title_size: 12, title_bold: false, title_align: 'left',
      frame: 'none', thousands: false, line_width: 1.2, legend: 'right',
      width: 7, height: 4.3,
    },
  },
  {
    id: 'office', name: 'Excel and Office', group: 'standard',
    desc: 'A chart as Excel and PowerPoint draw it: Office colours, Calibri, value lines only, the key under the graph.',
    style: {
      ...BROTOOLS, template: 'office',
      colors: ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47', '#264478', '#9E480E'], ramp: 'blue',
      text: '#595959', muted: '#595959', grid: '#D9D9D9', axis: '#BFBFBF',
      font: 'Calibri', font_size: 9, title_size: 14, title_bold: false,
      grid_axes: 'y', frame: 'bottom', ticks: 'none', line_width: 2.25,
      width: 6, height: 3.6,
    },
  },
];

export const templateById = (id) => TEMPLATES.find(t => t.id === id) || null;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const clone = (s) => ({ ...s, colors: [...s.colors] });

// "#RRGGBB" from "#RGB" or "#RRGGBB" (any case), else null.
export function hexColor(v) {
  let t = String(v === undefined || v === null ? '' : v).trim();
  if (/^#[0-9a-f]{3}$/i.test(t)) t = '#' + t.slice(1).split('').map(c => c + c).join('');
  return /^#[0-9a-f]{6}$/i.test(t) ? t.toUpperCase() : null;
}

// The default style (a fresh copy).
export function defaultStyle() { return clone(BROTOOLS); }

// A template's style (a fresh copy); the default for an id this version does not know.
export function styleFromTemplate(id) {
  const t = templateById(id);
  return clone(t ? t.style : BROTOOLS);
}

// A whole, valid style from anything: a saved `graph`, GRAPH_STYLE read back from a .py, or
// nothing. A key left out, or a value that cannot be used, takes the default's value (the same
// rule as outputs.py _po_st); a key this version does not know is dropped. Never throws.
export function normalizeStyle(raw) {
  const r = isObj(raw) ? raw : {};
  const st = defaultStyle();
  for (const key of STYLE_KEYS) {
    if (!(key in r)) continue;
    const v = r[key], d = BROTOOLS[key];
    if (key === 'colors') {
      const good = (Array.isArray(v) ? v : []).map(hexColor).filter(Boolean).slice(0, MAX_COLORS);
      if (good.length) st.colors = good;
    } else if (COLOR_KEYS.includes(key)) {
      const c = hexColor(v);
      if (c) st[key] = c;
    } else if (key in RANGES) {
      if (typeof v === 'boolean' || v === null || v === '') continue;
      const n = Number(v);
      if (Number.isFinite(n)) st[key] = Math.min(Math.max(n, RANGES[key][0]), RANGES[key][1]);
    } else if (key in CHOICES) {
      const sv = String(v);
      if (CHOICES[key].some(([cv]) => cv === sv)) st[key] = sv;
    } else if (key === 'ramp') {
      if (Object.prototype.hasOwnProperty.call(RAMPS, String(v))) st[key] = String(v);
    } else if (typeof d === 'boolean') {
      if (typeof v === 'boolean') st[key] = v;
    } else if (typeof v === 'string' && v.trim()) {
      st[key] = v.trim().slice(0, 60);
    }
  }
  st.dpi = Math.round(st.dpi);
  return st;
}

// The keys of a raw style whose value cannot be used (normalizeStyle replaces them with the
// default's): for a note when a hand-edited GRAPH_STYLE is read back. A number out of range is
// usable (it is brought into range).
export function unusableKeys(raw) {
  const r = isObj(raw) ? raw : {};
  const bad = [];
  for (const key of Object.keys(r)) {
    if (!STYLE_KEYS.includes(key)) continue;
    const v = r[key], d = BROTOOLS[key];
    let ok;
    if (key === 'colors') ok = Array.isArray(v) && v.length > 0 && v.every(c => hexColor(c));
    else if (COLOR_KEYS.includes(key)) ok = !!hexColor(v);
    else if (key in RANGES) ok = typeof v === 'number' && Number.isFinite(v);
    else if (key in CHOICES) ok = CHOICES[key].some(([cv]) => cv === String(v));
    else if (key === 'ramp') ok = Object.prototype.hasOwnProperty.call(RAMPS, String(v));
    else if (typeof d === 'boolean') ok = typeof v === 'boolean';
    else ok = typeof v === 'string' && !!v.trim();
    if (!ok) bad.push(key);
  }
  return bad;
}

// The style a workflow draws with.
export const styleOf = (wf) => normalizeStyle(wf && wf.graph);

export function sameStyle(a, b) {
  const x = normalizeStyle(a), y = normalizeStyle(b);
  return STYLE_KEYS.every(k => (k === 'colors' ? x.colors.join() === y.colors.join() : x[k] === y[k]));
}

// The template a style is, whole, or null when it was changed after being picked.
export function matchTemplate(style) {
  const s = normalizeStyle(style);
  return TEMPLATES.find(t => sameStyle(t.style, s)) || null;
}

// "Adjie Brotools", or "Report, changed" for a template with changes.
export function styleName(style) {
  const s = normalizeStyle(style);
  const t = matchTemplate(s);
  if (t) return t.name;
  const from = templateById(s.template);
  return from ? from.name + ', changed' : 'Your own style';
}

// Pixels of the saved PNG.
export const pixelsOf = (style) => {
  const s = normalizeStyle(style);
  return [Math.round(s.width * s.dpi), Math.round(s.height * s.dpi)];
};

// ---------------------------------------------------------------------------------------------
// GRAPH_STYLE in the script

// What each key holds, in the words its SETTINGS comment uses.
const PY_NOTES = {
  template: 'where this style started (a name only)',
  colors: 'in order; more lines repeat them, paler',
  ramp: Object.keys(RAMPS).join(', '),
  font_size: 'points, for the axis numbers (the rest follows)',
  title_size: 'points',
  line_width: 'points',
  width: 'inches',
  height: 'inches',
  dpi: 'the PNG is width x dpi pixels wide',
  transparent: 'True: no background (for slides)',
  thousands: 'True: 1,200 rather than 1200',
};

// The SETTINGS lines for a style: a comment, then GRAPH_STYLE = { ... } over one line per key.
// workflow.js readGraphStyle reads the same lines back when a .py is opened.
export function pyStyleLines(style, { pyLit, commentLines }) {
  const s = normalizeStyle(style);
  const out = [];
  out.push(...commentLines('How every graph of this run looks: set in the Builder (select nothing, then Graph style). ' +
    'Colours are hex codes. A value that cannot be used falls back to the Adjie Brotools style.'));
  out.push('GRAPH_STYLE = {');
  for (const key of STYLE_KEYS) {
    let note = PY_NOTES[key] || '';
    if (key in CHOICES) note = CHOICES[key].map(([v]) => (v === '' ? '""' : v)).join(', ');
    else if (typeof s[key] === 'boolean' && !note) note = 'True or False';
    const line = '    ' + pyLit(key) + ': ' + pyLit(s[key]) + ',';
    out.push(note ? line.padEnd(Math.max(line.length + 2, 52)) + '# ' + note : line);
  }
  out.push('}');
  return out;
}

// ---------------------------------------------------------------------------------------------
// Colours, as outputs.py picks them (_po_colors, _po_ramp_at, _po_mix, _po_lum), so the page's
// preview shows the colours the script draws.

export function mixColor(c1, c2, w) {
  const a = [1, 3, 5].map(i => parseInt(c1.slice(i, i + 2), 16));
  const b = [1, 3, 5].map(i => parseInt(c2.slice(i, i + 2), 16));
  // Python's round() rounds halves to even; the colours differ by at most one step either way.
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * w).toString(16).padStart(2, '0')).join('');
}

export function luminance(c) {
  const ch = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function rampAt(stops, pos) {
  const p = Math.min(Math.max(Number(pos) || 0, 0), 1) * (stops.length - 1);
  const a = Math.floor(p), b = Math.min(a + 1, stops.length - 1);
  return mixColor(stops[a], stops[b], p - a);
}

// The colours of n lines on one graph: the style's colours, then the same again paler, then
// the ramp (without its end nearest the background).
export function seriesColors(style, n) {
  const s = normalizeStyle(style);
  const base = s.colors, k = base.length;
  if (n <= k) return base.slice(0, n);
  if (n <= 2 * k) return base.concat(base.map(c => mixColor(c, s.plot_background, 0.42))).slice(0, n);
  const ramp = RAMPS[s.ramp].stops;
  const bg = luminance(s.plot_background);
  const [lo, hi] = Math.abs(luminance(ramp[0]) - bg) < Math.abs(luminance(ramp[ramp.length - 1]) - bg) ? [0.25, 1] : [0, 0.75];
  return Array.from({ length: n }, (_, j) => rampAt(ramp, lo + (hi - lo) * (j / Math.max(1, n - 1))));
}
