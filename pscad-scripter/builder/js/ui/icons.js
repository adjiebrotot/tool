// An icon for every block (palette, canvas header, inspector, quick-add), drawn like the site's
// .tico icons: 24 x 24, stroke currentColor, round ends. The pictures follow PSCAD's own where it
// has one, so a reader who knows the workspace recognises them: a component is the box with its
// pins, a layer the stack of sheets, a global substitution the $ name, an input control the
// slider, a snapshot the camera, a graph the frame around a curve, a fault the strike to ground.
//
// A family shares one base picture and a corner badge says what the block does with it:
//   loop  "For each ..."      plus   "Add / create ..."   check  "Use / activate ..."
//   save  "Save ..."          clock  something timed      read   reads a value back
//   cross a delete or a stop  play   runs something       pencil writes a value
//   power turns something on or off                       layer  onto a layer
// With a badge the base is drawn smaller in the top-left and the badge sits on a small
// knockout disc (--pxb-icon-cut, set per place in style.css) so it reads at 16 px.

// ---- Base pictures --------------------------------------------------------------------------
const B = {
  // PSCAD objects: what the workspace and the canvas hold
  comp: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.6"/><path d="M2.5 9.5h4M2.5 14.5h4M17.5 12h4"/>',
  copy: '<rect x="9" y="3.5" width="11.5" height="9" rx="1.5"/><rect x="3.5" y="11.5" width="11.5" height="9" rx="1.5" fill="var(--pxb-icon-cut, var(--panel))"/>',
  wire: '<path d="M4.5 6.5h6.5v11h8"/><circle cx="4" cy="6.5" r="1.5" fill="currentColor"/><circle cx="20" cy="17.5" r="1.5" fill="currentColor"/>',
  bus: '<path d="M3 12h18" stroke-width="3.4"/><path d="M7 12V6.4M12 12V6.4M17 12V6.4M9.5 12v5.6M14.5 12v5.6"/>',
  channel: '<path d="M2.5 12h4"/><rect x="6.5" y="6" width="15" height="12" rx="1.6"/><path d="M9.3 14.5c1.2-5 2.4-5 3.6 0s2.4 5 3.6 0 1.4-1.9 2.1-1"/>',
  graphframe: '<rect x="2.5" y="4" width="19" height="16" rx="1.8"/><path d="M2.5 8.2h19"/><path d="M5.8 16.6c2.4 0 2.9-5.8 5.3-5.8s2.9 3.9 5.8 3.9h1.3"/>',
  layers: '<path d="M12 2.8 21.5 7 12 11.2 2.5 7z"/><path d="M2.5 12 12 16.2 21.5 12"/><path d="M2.5 17 12 21.2 21.5 17"/>',
  subst: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M14.8 8.6h-4.4a2.1 2.1 0 0 0 0 4.2h2.5a2.1 2.1 0 0 1 0 4.2H8.2M11.6 6.7v10.6"/>',
  project: '<path d="M5 3.5h9l5 5v12H5z"/><path d="M14 3.5v5h5"/><path d="M7.5 15.5h2.6M13.9 15.5h2.6"/><rect x="10.1" y="13.5" width="3.8" height="4" rx=".9"/>',
  projectcopy: '<path d="M9 2.5h6.5L19 6v9H9z"/><path d="M15.5 2.5V6H19"/><path d="M15 15v6.5H5V8h4"/>',
  scen: '<circle cx="7.5" cy="7.5" r="3" fill="currentColor"/><circle cx="16.5" cy="7.5" r="3"/><circle cx="7.5" cy="16.5" r="3"/><circle cx="16.5" cy="16.5" r="3"/>',
  // Input controls: the slider, and the limits its handle runs between
  slider: '<rect x="2.5" y="6.5" width="19" height="11" rx="2.2"/><path d="M5.5 12h13"/><rect x="13.1" y="8.5" width="3.6" height="7" rx="1.1" fill="var(--pxb-icon-cut, var(--panel))"/>',
  sliderlim: '<path d="M6 12h12"/><circle cx="12" cy="12" r="2.7"/><path d="M4.2 6.5v11M19.8 6.5v11" stroke-width="2.8"/>',
  // Set and read a parameter
  setattr: '<rect x="3" y="13.5" width="18" height="7" rx="1.6"/><path d="M14.5 3.5l3.5 3.5-6.5 6.5H8V10z"/>',
  getattr: '<path d="M3.5 16.5a8.5 8.5 0 1 1 17 0"/><path d="M12 16.5l4-5"/><circle cx="12" cy="16.5" r="1.4" fill="currentColor"/><path d="M6.5 11l1.2 1M17.5 11l-1.2 1M12 8.5V10"/>',
  undo: '<path d="M8.5 8H4V3.5"/><path d="M4.5 8a8 8 0 1 1-.6 7.5"/>',
  // Build and run
  build: '<circle cx="12" cy="12" r="4.2"/><path d="M12 7.8V4.7M12 16.2v3.1M16.2 12h3.1M7.8 12H4.7M15 9l2.2-2.2M6.8 17.2 9 15M15 15l2.2 2.2M6.8 6.8 9 9" stroke-width="2.8"/>',
  emt: '<path d="M2.5 12c1.2-6.5 2.4-6.5 3.6 0s2.4 6.5 3.6 0 2.4-6.5 3.6 0 2.4 6.5 3.6 0 2.4-6.5 3.6 0"/>',
  switch: '<path d="M2.5 14h4.4M17.1 14h4.4"/><path d="M8.4 13.2l8-7.2"/><circle cx="7.9" cy="14" r="1.9"/><circle cx="16.1" cy="14" r="1.9"/>',
  fault: '<path d="M12 2.5v4"/><path d="M14 6 9.6 12.4h3.2L11.2 17"/><path d="M6.5 17.5h11M9 20h6"/>',
  snapshot: '<rect x="2.8" y="7" width="18.4" height="12.5" rx="2"/><path d="M8.4 7l1.4-2.5h4.4L15.6 7"/><circle cx="12" cy="13.2" r="3.6"/>',
  simset: '<rect x="2.8" y="4.5" width="18.4" height="15" rx="2"/><path d="M6 8.3l2.6 1.7L6 11.7z" fill="currentColor"/><path d="M6 13.3l2.6 1.7L6 16.7z" fill="currentColor"/><path d="M10.8 10h7.2M10.8 15h7.2"/>',
  mrun: '<rect x="2.8" y="5" width="18.4" height="14" rx="1.8"/><path d="M5.8 16.2h3.1V13h3.1V9.8h3.1V6.9h3.1"/>',
  mruncount: '<rect x="2.8" y="5" width="18.4" height="14" rx="1.8"/><path d="M6 8l2.6 1.7L6 11.4z" fill="currentColor"/><path d="M6 13.1l2.6 1.7L6 16.5z" fill="currentColor"/><path d="M11 9.7h6.5M11 14.8h6.5"/>',
  // Checks on a waveform
  rms: '<path d="M2.5 14c1.9-8.5 3.8-8.5 5.7 0s3.8 8.5 5.7 0 3.8-8.5 5.7 0"/><path d="M2.5 10h19" stroke-dasharray="3 2.4"/>',
  thd: '<path d="M3 20.5h18" opacity=".45"/><path d="M5 20.5V4.5M9.3 20.5V15M13.6 20.5V12M17.9 20.5v-4.2"/>',
  seq: '<path d="M12 13V4M10.3 5.7 12 4l1.7 1.7"/><path d="m12 13-7.8 4.5M6.6 17.7l-2.4-.2-.1-2.4"/><path d="m12 13 7.8 4.5M17.4 17.7l2.4-.2.1-2.4"/><circle cx="12" cy="13" r="1.2" fill="currentColor"/>',
  unbal: '<circle cx="12" cy="12" r="9" stroke-dasharray="2.2 2.4"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><path d="M12 12V3.3M12 12l-4.4 2M12 12l5 4.8"/>',
  overshoot: '<path d="M2.5 19.5h4.2c2.2 0 2.8-12 5.1-12 2 0 2.2 8 4 8s2-4 5.7-4"/><path d="M2.5 11h19" stroke-dasharray="2.4 2"/><circle cx="11.6" cy="7.6" r="1.8" fill="currentColor"/>',
  damping: '<path d="M2.5 12c1.5-9 3-9 4.5 0 1.5 6.3 3 6.3 4.5 0 1.5-4.4 3-4.4 4.5 0 1.5 3 3 3 4.5 0"/>',
  despike: '<path d="M2.5 16h5.5l1.5-11 1.5 11h10.5"/><path d="M14.5 4.5l5 5M19.5 4.5l-5 5"/>',
  nadir: '<path d="M2.5 6.5c4.5 0 5 10.5 9.5 10.5s5-8 9.5-8"/><circle cx="12" cy="17" r="2" fill="currentColor"/><path d="M12 21.5v-1.5" />',
  peak: '<path d="M2.5 17.5c4.5 0 5-10.5 9.5-10.5s5 8 9.5 8"/><circle cx="12" cy="7" r="2" fill="currentColor"/>',
  settle: '<path d="M2.5 19c3 0 3-14 6-14s3 9 5.5 9 3-2.5 7.5-2.5"/><path d="M14 9h7.5M14 14.5h7.5" stroke-dasharray="2 2.2"/>',
  rocof: '<path d="M2.5 6c6 0 7 12 13 12h6"/><path d="M4.5 3l9.5 15.5" stroke-dasharray="2.4 2"/>',
  at: '<path d="M2.5 15c3.5 0 4.5-8 9.5-8s6 6 9.5 6"/><path d="M14 3.5v17" stroke-dasharray="2 2"/><circle cx="14" cy="8.3" r="1.8" fill="currentColor"/>',
  final: '<path d="M2.5 18c3 0 3-12 7-12s4 6 7 6h3"/><circle cx="20.5" cy="12" r="1.9" fill="currentColor"/>',
  cross: '<path d="M2.5 18c5 0 6-12 12-12h7"/><path d="M2.5 11h19" stroke-dasharray="2.2 2.2"/><circle cx="9.6" cy="11" r="1.8" fill="currentColor"/>',
  limit: '<path d="M2.5 5.5h19M2.5 18.5h19" stroke-dasharray="2.4 2"/><path d="M3.5 13c3-4 5 3 8.5 0s5 2.5 8.5-1"/>',
  verdict: '<path d="M12 2.8l7.5 3.2v5.5c0 5-3.5 8.3-7.5 9.9-4-1.6-7.5-4.9-7.5-9.9V6z"/><path d="M8.5 12l2.5 2.5 4.6-5"/>',
  // results
  table: '<rect x="3" y="4" width="18" height="16" rx="1.8"/><path d="M3 9h18M3 14.5h18M10 9v11"/>',
  tablecol: '<rect x="3" y="4" width="18" height="16" rx="1.8"/><path d="M3 9h18M3 14.5h18"/><rect x="10.5" y="4" width="5" height="16" fill="currentColor" opacity=".35" stroke="none"/><path d="M10.5 4v16M15.5 4v16"/>',
  fileread: '<path d="M6 2.5h8.5l4 4v15H6z"/><path d="M14.5 2.5v4h4"/><path d="M8.5 11.5h7.5M8.5 15h7.5M8.5 18.5h7.5M12 11.5v7"/>',
  chart: '<path d="M3.5 3.5v17h17"/><path d="M6.5 15c2-4 3.5-8 6-8s3 5 7 2"/><path d="M6.5 18c3-2 6-2 13-5" opacity=".55"/>',
  xy: '<path d="M3.5 3.5v17h17"/><circle cx="8" cy="15" r="1.3" fill="currentColor"/><circle cx="11" cy="11.5" r="1.3" fill="currentColor"/><circle cx="14.5" cy="12.5" r="1.3" fill="currentColor"/><circle cx="18" cy="7.5" r="1.3" fill="currentColor"/><path d="M6.5 17.5l13-12" opacity=".5"/>',
  chart3d: '<path d="M12 2.8l8.5 4.7v9L12 21.2l-8.5-4.7v-9z"/><path d="M12 12l8.5-4.5M12 12v9.2M12 12L3.5 7.5"/>',
  heat: '<rect x="3" y="3" width="18" height="18" rx="1.8"/><rect x="3" y="3" width="6" height="6" fill="currentColor" opacity=".25" stroke="none"/><rect x="9" y="9" width="6" height="6" fill="currentColor" opacity=".6" stroke="none"/><rect x="15" y="15" width="6" height="6" fill="currentColor" opacity=".9" stroke="none"/><rect x="15" y="3" width="6" height="6" fill="currentColor" opacity=".45" stroke="none"/><rect x="3" y="15" width="6" height="6" fill="currentColor" opacity=".45" stroke="none"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
  conv: '<path d="M3.5 3.5v17h17"/><path d="M6 6.5c2 0 2 5 4 5s2 3 4 3 2.5 1.5 6.5 1.5"/><circle cx="20.5" cy="16" r="1.5" fill="currentColor"/>',
  wavefile: '<path d="M6 2.5h8.5l4 4v15H6z"/><path d="M14.5 2.5v4h4"/><path d="M8 15c1-3 2-3 3 0s2 3 3 0 1.5-2 2.5-1"/>',
  // flow
  start: '<circle cx="12" cy="12" r="9"/><path d="M10 8l6 4-6 4z" fill="currentColor"/>',
  if: '<path d="M12 2.5l9.5 9.5-9.5 9.5L2.5 12z"/><path d="M10 9.8a2.1 2.1 0 1 1 3 1.9c-.6.3-1 .8-1 1.5v.4M12 16v.4"/>',
  range: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.6 3.8v3.4h-3.4"/><path d="M9.5 10v5M12.5 10v5M15 10v5" opacity=".9"/>',
  items: '<path d="M10 6.5h10.5M10 12h10.5M10 17.5h10.5"/><circle cx="5.5" cy="6.5" r="1.4" fill="currentColor"/><circle cx="5.5" cy="12" r="1.4" fill="currentColor"/><circle cx="5.5" cy="17.5" r="1.4" fill="currentColor"/>',
  repeat: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.6 3.8v3.4h-3.4"/><path d="M10 9.5l4 5M14 9.5l-4 5"/>',
  until: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.6 3.8v3.4h-3.4"/><path d="M8.8 12.2l2.2 2.2 4.2-4.4"/>',
  next: '<path d="M4.5 5.5l9 6.5-9 6.5z"/><path d="M18.5 5.5v13"/>',
  break: '<circle cx="12" cy="12" r="9"/><rect x="8.5" y="8.5" width="7" height="7" rx="1.2"/>',
  stop: '<path d="M8.3 2.8h7.4l5.5 5.5v7.4l-5.5 5.5H8.3l-5.5-5.5V8.3z"/><path d="M8.5 12h7"/>',
  log: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9.5l3 2.5-3 2.5M12.5 15H17"/>',
  varset: '<rect x="3.5" y="10" width="17" height="10.5" rx="2"/><path d="M12 2.5v10M8.5 9l3.5 3.5L15.5 9"/>',
  varget: '<rect x="3.5" y="10" width="17" height="10.5" rx="2"/><path d="M12 13.5v-11M8.5 6L12 2.5 15.5 6"/>',
  // values and maths
  number: '<path d="M9.5 3.5 7.5 20.5M16.5 3.5l-2 17M4.5 9h15.5M3.5 15H19"/>',
  text: '<path d="M5 7V4.5h14V7M12 4.5v15M9 19.5h6"/>',
  bool: '<rect x="2.5" y="6.5" width="19" height="11" rx="5.5"/><circle cx="16" cy="12" r="3.2" fill="currentColor"/>',
  list: '<path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12"/><path d="M3.5 6.5h1.5M3.5 12h1.5M3.5 17.5h1.5"/>',
  numrange: '<path d="M3 12h18"/><path d="M5.5 7.5v9M18.5 7.5v9"/><circle cx="10" cy="12" r="1.3" fill="currentColor"/><circle cx="14" cy="12" r="1.3" fill="currentColor"/>',
  arith: '<path d="M7 3.5v6M4 6.5h6M14 6.5h6M4.8 14.8l4.4 4.4M9.2 14.8l-4.4 4.4M14 17h6"/><circle cx="17" cy="14.2" r=".8" fill="currentColor"/><circle cx="17" cy="19.8" r=".8" fill="currentColor"/>',
  formula: '<path d="M11 3.5c-2.5 0-2.6 1.6-3.1 4.5L6 20.5M4.5 9.5h5.5"/><path d="M13.5 9l6.5 9M20 9l-6.5 9"/>',
  func: '<path d="M2.5 13.5h3l3 7 5-17h8"/>',
  compare: '<path d="M6 5l12 5-12 5M6 20h12"/>',
  logic: '<path d="M5 4.5h6a7.5 7.5 0 0 1 0 15H5z"/><path d="M1.8 9H5M1.8 15H5M18.5 12h3.7"/>',
  max: '<path d="M4.5 20.5v-6M9.5 20.5v-9M14.5 20.5v-4M19.5 20.5V8"/><path d="M17 5.5l2.5-2.5L22 5.5"/>',
  min: '<path d="M4.5 20.5v-9M9.5 20.5v-6M14.5 20.5V9M19.5 20.5v-3"/><path d="M17 11l2.5 2.5L22 11"/>',
  mean: '<path d="M4.5 20.5v-9M9.5 20.5v-5M14.5 20.5V7M19.5 20.5v-7"/><path d="M2.5 12.5h19" stroke-dasharray="2.2 2"/>',
  median: '<path d="M4.5 20.5v-3M9.5 20.5v-6M19.5 20.5V5"/><path d="M14.5 20.5V10" stroke-width="2.8"/>',
  sum: '<path d="M18 5H6.5l6 7-6 7H18"/>',
  count: '<path d="M5.5 5v14M9.5 5v14M13.5 5v14M17.5 5v14"/><path d="M3 15.5l18-7"/>',
  std: '<path d="M2.5 17c3.5 0 4.5-12 9.5-12s6 12 9.5 12"/><path d="M7.5 21h9M7.5 19.6v2.8M16.5 19.6v2.8"/><path d="M12 5v12" stroke-dasharray="2 2"/>',
  pct: '<path d="M4 20.5v-3M8 20.5v-6M12 20.5v-9M16 20.5v-12"/><path d="M19.5 3v18" stroke-dasharray="2.2 2"/>',
  textfmt: '<path d="M8 4c-2 0-2.4 1-2.4 3.2S4 11 3.5 12c.5 1 2.1 2.6 2.1 4.8S6 20 8 20M16 4c2 0 2.4 1 2.4 3.2S20 11 20.5 12c-.5 1-2.1 2.6-2.1 4.8S18 20 16 20"/><path d="M10 10h4M10 14h4"/>',
  // searches and advanced
  optimise: '<circle cx="11" cy="13" r="7.5"/><circle cx="11" cy="13" r="3.5"/><circle cx="11" cy="13" r=".9" fill="currentColor"/><path d="M13.5 10.5l7-7M17 3.5h3.5V7"/>',
  findlimit: '<path d="M4 4.5v15M20 4.5v15"/><path d="M7 12h3.5M8.7 9.6 11 12l-2.3 2.4M17 12h-3.5M15.3 9.6 13 12l2.3 2.4"/>',
  report: '<path d="M5.5 21V3.5M5.5 4h12l-2.6 4.2L17.5 12.5h-12"/>',
  python: '<path d="M8 7.5 3.5 12 8 16.5M16 7.5l4.5 4.5-4.5 4.5M13.5 5l-3 14"/>',
  note: '<path d="M4.5 4h15v10.5L14 20H4.5z"/><path d="M14 20v-5.5h5.5"/><path d="M8 8.5h8M8 12h5"/>',
  missing: '<path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><path d="M12 17.5v.5"/><circle cx="12" cy="12" r="9" stroke-dasharray="2.5 2"/>',
};

// ---- Corner badges --------------------------------------------------------------------------
const BADGE = {
  loop: '<path d="M22.3 18.8a3.9 3.9 0 1 1-1.2-3"/><path d="M22.4 14.3v2.4H20"/>',
  plus: '<path d="M18.5 14.8v7.4M14.8 18.5h7.4"/>',
  check: '<path d="M15 18.7l2.4 2.4 4.6-5"/>',
  save: '<path d="M18.5 14.3v5.4M16 17.4l2.5 2.5 2.5-2.5M15 22.3h7"/>',
  clock: '<circle cx="18.5" cy="18.5" r="4"/><path d="M18.5 16.4v2.3l1.6 1"/>',
  cross: '<path d="M15.6 15.6l5.8 5.8M21.4 15.6l-5.8 5.8"/>',
  play: '<path d="M16.5 15l5.5 3.5-5.5 3.5z" fill="currentColor"/>',
  read: '<path d="M14.5 18.5h7.5M19 15.5l3 3-3 3"/>',
  pencil: '<path d="M21.3 14.4l1.5 1.5-5.2 5.2-2 .5.5-2z"/>',
  power: '<path d="M20.4 16.2a3.9 3.9 0 1 1-3.8 0"/><path d="M18.5 14.1v3.7"/>',
  layer: '<path d="M18.5 14.1 22.8 16l-4.3 1.9-4.3-1.9z"/><path d="M14.2 19.3l4.3 1.9 4.3-1.9"/>',
};

// ---- Which picture each block takes: [base, badge?] ------------------------------------------
const MAP = {
  start: ['start'],
  // PSCAD: the model on the canvas
  'px.component': ['comp'], 'px.foreach_component': ['comp', 'loop'],
  'px.set': ['setattr'], 'px.get': ['getattr'], 'px.enable': ['comp', 'power'],
  'px.undo': ['undo'], 'px.delete': ['comp', 'cross'], 'px.copy': ['copy'],
  'px.add.component': ['comp', 'plus'], 'px.add.wire': ['wire', 'plus'], 'px.add.bus': ['bus', 'plus'],
  'px.add.channel': ['channel', 'plus'], 'px.add.graph': ['graphframe', 'plus'],
  // PSCAD: layers, scenarios, global substitutions
  'px.layer.set': ['layers', 'power'], 'px.layer.create': ['layers', 'plus'],
  'px.layer.add': ['comp', 'layer'], 'px.layer.foreach': ['layers', 'loop'],
  'px.scen.activate': ['scen', 'check'], 'px.scen.save': ['scen', 'save'], 'px.scen.foreach': ['scen', 'loop'],
  'px.gs.set': ['subst', 'pencil'], 'px.gs.get': ['subst', 'read'],
  'px.gs.setactive': ['subst', 'check'], 'px.gs.foreach': ['subst', 'loop'],
  // PSCAD: input controls and the case itself
  'px.control': ['slider'], 'px.control.limits': ['sliderlim'],
  'px.project.use': ['project', 'check'], 'px.project.save': ['project', 'save'],
  'px.project.saveas': ['projectcopy', 'save'], 'px.project.new': ['project', 'plus'],
  // PSCAD: build, run and the EMT run's own settings
  'px.build': ['build'], 'px.run': ['emt', 'play'], 'px.series': ['channel', 'read'],
  'px.fault': ['fault', 'clock'], 'px.switching': ['switch', 'clock'],
  'px.snap.save': ['snapshot', 'save'], 'px.snap.use': ['snapshot', 'play'], 'px.snap.off': ['snapshot', 'cross'],
  'px.simset.create': ['simset', 'plus'], 'px.simset.override': ['simset', 'pencil'], 'px.simset.run': ['simset', 'play'],
  'px.mrun.sweep': ['mrun'], 'px.mrun.count': ['mruncount'],
  // Power system checks
  'sig.rms': ['rms'], 'sig.thd': ['thd'], 'sig.sequence': ['seq'], 'sig.unbalance': ['unbal'],
  'sig.overshoot': ['overshoot'], 'sig.damping': ['damping'],
  'sig.despike': ['despike'], 'sig.nadir': ['nadir'], 'sig.peak': ['peak'], 'sig.settle': ['settle'],
  'sig.rocof': ['rocof'], 'sig.at': ['at'], 'sig.final': ['final'], 'sig.cross': ['cross'],
  'chk.limit': ['limit'], 'chk.verdict': ['verdict'],
  // Results and graphs
  'out.table.add': ['table', 'plus'], 'out.table.save': ['table', 'save'], 'out.table.column': ['tablecol'],
  'data.read': ['fileread'], 'out.plot.series': ['chart'], 'out.plot.xy': ['xy'], 'out.plot.3d': ['chart3d'],
  'out.plot.heatmap': ['heat'], 'out.plot.table': ['table', 'read'], 'out.plot.conv': ['conv'],
  'out.series.save': ['wavefile'],
  // Flow
  'flow.if': ['if'], 'flow.range': ['range'], 'flow.list': ['items', 'loop'], 'flow.repeat': ['repeat'],
  'flow.until': ['until'], 'flow.next': ['next'], 'flow.break': ['break'], 'flow.stop': ['stop'],
  'flow.log': ['log'], 'var.set': ['varset'], 'var.get': ['varget'],
  // Values and maths
  'val.number': ['number'], 'val.text': ['text'], 'val.bool': ['bool'], 'val.list': ['list'], 'val.range': ['numrange'],
  'math.arith': ['arith'], 'math.formula': ['formula'], 'math.func': ['func'], 'math.compare': ['compare'],
  'math.logic': ['logic'], 'math.max': ['max'], 'math.min': ['min'], 'math.mean': ['mean'], 'math.median': ['median'],
  'math.sum': ['sum'], 'math.count': ['count'], 'math.std': ['std'], 'math.percentile': ['pct'], 'text.format': ['textfmt'],
  // Optimise and search, Advanced
  'opt.optimise': ['optimise'], 'opt.limit': ['findlimit'], 'opt.report': ['report'],
  'adv.python': ['python'], note: ['note'],
};

// A picture for a kind of block when the type has none of its own (a block added later).
const BY_KIND = {
  start: 'start', action: 'setattr', branch: 'if', loop: 'range', callback: 'optimise',
  pure: 'formula', terminal: 'stop', note: 'note', missing: 'missing',
};

const OPEN = '<svg class="@C" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">';

// The SVG for a block type (falls back on its kind, then a plain step).
export function blockIcon(type, kind, cls = 'pxb-glyph') {
  const m = MAP[type] || [BY_KIND[kind] || 'setattr'];
  const base = B[m[0]] || B.setattr;
  const open = OPEN.replace('@C', cls);
  if (!m[1] || !BADGE[m[1]]) return open + base + '</svg>';
  // The base, smaller in the top-left; the badge on a knockout disc in the bottom-right.
  return open +
    '<g transform="translate(.4 .4) scale(.74)" stroke-width="2.35">' + base + '</g>' +
    '<circle cx="18.5" cy="18.5" r="5.6" fill="var(--pxb-icon-cut, var(--panel))" stroke="none"/>' +
    BADGE[m[1]] + '</svg>';
}

// For the tests and the design check page: every type that has its own picture.
export const ICON_TYPES = Object.keys(MAP);
