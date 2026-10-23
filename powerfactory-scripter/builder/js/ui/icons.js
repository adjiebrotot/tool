// An icon for every block (palette, canvas header, inspector, quick-add), drawn like the site's
// .tico icons: 24 x 24, stroke currentColor, round ends. The pictures follow PowerFactory's own
// where it has one, so a reader who knows the Data Manager recognises them: a study case is the
// four-panel sheet, an operation scenario the four dots, a variation the sheet with a branch, a
// load flow the busbar with arrows, a short circuit the lightning bolt.
//
// A family shares one base picture and a corner badge says what the block does with it:
//   loop  "For each ..."      plus   "Create ..."      check  "Activate ..."
//   minus "Deactivate ..."    save   "Save ..."         clock  an event at a time
//   cross a trip or outage    play   runs something
// With a badge the base is drawn smaller in the top-left and the badge sits on a small
// knockout disc (--pfb-icon-cut, set per place in style.css) so it reads at 16 px.

// ---- Base pictures --------------------------------------------------------------------------
const B = {
  // PowerFactory objects
  case: '<rect x="4" y="4" width="7" height="7" rx="1.2"/><rect x="13" y="4" width="7" height="7" rx="1.2"/><rect x="4" y="13" width="7" height="7" rx="1.2"/><rect x="13" y="13" width="7" height="7" rx="1.2"/>',
  scen: '<circle cx="7.5" cy="7.5" r="3" fill="currentColor"/><circle cx="16.5" cy="7.5" r="3"/><circle cx="7.5" cy="16.5" r="3"/><circle cx="16.5" cy="16.5" r="3"/>',
  vari: '<rect x="3" y="6" width="10" height="12" rx="1.5"/><path d="M13 12h3M16 7.5v9M16 7.5h4.5M16 16.5h4.5"/><circle cx="20.5" cy="7.5" r=".9" fill="currentColor"/><circle cx="20.5" cy="16.5" r=".9" fill="currentColor"/>',
  element: '<circle cx="12" cy="12" r="6"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>',
  gen: '<circle cx="12" cy="12" r="7.5"/><path d="M7.6 12c1.5-2.8 2.9-2.8 4.4 0s2.9 2.8 4.4 0"/>',
  setattr: '<rect x="3" y="13.5" width="18" height="7" rx="1.6"/><path d="M14.5 3.5l3.5 3.5-6.5 6.5H8V10z"/>',
  getattr: '<path d="M3.5 16.5a8.5 8.5 0 1 1 17 0"/><path d="M12 16.5l4-5"/><circle cx="12" cy="16.5" r="1.4" fill="currentColor"/><path d="M6.5 11l1.2 1M17.5 11l-1.2 1M12 8.5V10"/>',
  dispatch: '<circle cx="9.5" cy="12" r="6.5"/><path d="M5.7 12c1.3-2.4 2.5-2.4 3.8 0s2.5 2.4 3.8 0"/><path d="M20 4.5v15M17.6 7l2.4-2.5L22.4 7M17.6 17l2.4 2.5 2.4-2.5"/>',
  scale: '<path d="M10 14l-6 6M4 15.5V20h4.5M14 10l6-6M20 8.5V4h-4.5"/><rect x="8" y="8" width="8" height="8" rx="1.5"/>',
  switch: '<path d="M2.5 14h4.4M17.1 14h4.4"/><path d="M8.4 13.2l8-7.2"/><circle cx="7.9" cy="14" r="1.9"/><circle cx="16.1" cy="14" r="1.9"/>',
  undo: '<path d="M8.5 8H4V3.5"/><path d="M4.5 8a8 8 0 1 1-.6 7.5"/>',
  line: '<path d="M4 4.5v15M20 4.5v15"/><path d="M4 12h6M14 12h6"/><path d="M10.2 9.2l3.6 5.6M13.8 9.2l-3.6 5.6"/>',
  load: '<path d="M4 4.5h16"/><path d="M12 4.5v6"/><path d="M7 10.5h10L12 19.5z"/>',
  dsl: '<rect x="5.5" y="6" width="13" height="12" rx="1.8"/><path d="M2.5 10h3M2.5 14h3M18.5 12h3"/><path d="M9 14.5c1.5 0 1.3-5 3.2-5M9.2 12h3.3"/>',
  // studies
  ldf: '<path d="M12 3v18" stroke-width="2.8"/><path d="M3 8h6M7 6l2 2-2 2"/><path d="M15 16h6M19 14l2 2-2 2"/><path d="M15 8h6M17 6l-2 2 2 2"/>',
  rms: '<path d="M3 20.5h18" opacity=".45"/><path d="M3 7.5h4.2c2.2 0 2.7 9.5 5.6 9.5 2.6 0 3.4-5 8.2-5"/>',
  emt: '<path d="M2.5 12c1.2-6.5 2.4-6.5 3.6 0s2.4 6.5 3.6 0 2.4-6.5 3.6 0 2.4 6.5 3.6 0 2.4-6.5 3.6 0"/>',
  hldf: '<path d="M2.5 12c1.5-7 3.2-7 4.7 0 .5 2.2 1 2.2 1.5 0s1-2.2 1.5 0c1.5 7 3.2 7 4.7 0 .5-2.2 1-2.2 1.5 0s1 2.2 1.5 0"/>',
  shc: '<path d="M13.5 2.5 5.5 13.5h6l-1.2 8 8.2-11h-6z"/>',
  series: '<path d="M3.5 3.5v17h17"/><path d="M6.5 9c2.5 0 3 7 6 7s3.5-4 7-4"/>',
  // checks on a curve
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
  minus: '<path d="M14.8 18.5h7.4"/>',
  save: '<path d="M18.5 14.3v5.4M16 17.4l2.5 2.5 2.5-2.5M15 22.3h7"/>',
  clock: '<circle cx="18.5" cy="18.5" r="4"/><path d="M18.5 16.4v2.3l1.6 1"/>',
  cross: '<path d="M15.6 15.6l5.8 5.8M21.4 15.6l-5.8 5.8"/>',
  play: '<path d="M16.5 15l5.5 3.5-5.5 3.5z" fill="currentColor"/>',
  read: '<path d="M14.5 18.5h7.5M19 15.5l3 3-3 3"/>',
};

// ---- Which picture each block takes: [base, badge?] ------------------------------------------
const MAP = {
  start: ['start'],
  // PowerFactory: cases and data
  'pf.element': ['element'], 'pf.foreach_element': ['element', 'loop'],
  'pf.set': ['setattr'], 'pf.get': ['getattr'], 'pf.dispatch': ['dispatch'], 'pf.scale': ['scale'],
  'pf.outserv': ['switch'], 'pf.undo': ['undo'], 'pf.testgen': ['gen', 'plus'],
  'pf.case.activate': ['case', 'check'], 'pf.case.create': ['case', 'plus'], 'pf.case.foreach': ['case', 'loop'],
  'pf.scen.activate': ['scen', 'check'], 'pf.scen.create': ['scen', 'plus'], 'pf.scen.save': ['scen', 'save'],
  'pf.scen.deactivate': ['scen', 'minus'], 'pf.scen.foreach': ['scen', 'loop'],
  'pf.var.activate': ['vari', 'check'], 'pf.var.deactivate': ['vari', 'minus'], 'pf.var.create': ['vari', 'plus'],
  'pf.var.foreach': ['vari', 'loop'],
  // PowerFactory: studies
  'pf.ldf': ['ldf'], 'pf.rms': ['rms', 'play'], 'pf.emt': ['emt', 'play'], 'pf.hldf': ['hldf'], 'pf.shc': ['shc'],
  'sig.series': ['series', 'read'],
  'pf.evt.shc': ['shc', 'clock'], 'pf.evt.switch': ['switch', 'clock'], 'pf.evt.trip': ['gen', 'cross'],
  'pf.evt.load': ['load', 'clock'], 'pf.evt.param': ['dsl', 'clock'],
  'pf.cont.define': ['line'], 'pf.cont.foreach': ['line', 'loop'],
  // Power system checks
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
export function blockIcon(type, kind, cls = 'pfb-glyph') {
  const m = MAP[type] || [BY_KIND[kind] || 'setattr'];
  const base = B[m[0]] || B.setattr;
  const open = OPEN.replace('@C', cls);
  if (!m[1] || !BADGE[m[1]]) return open + base + '</svg>';
  // The base, smaller in the top-left; the badge on a knockout disc in the bottom-right.
  return open +
    '<g transform="translate(.4 .4) scale(.74)" stroke-width="2.35">' + base + '</g>' +
    '<circle cx="18.5" cy="18.5" r="5.6" fill="var(--pfb-icon-cut, var(--panel))" stroke="none"/>' +
    BADGE[m[1]] + '</svg>';
}

// For the tests and the design check page: every type that has its own picture.
export const ICON_TYPES = Object.keys(MAP);
