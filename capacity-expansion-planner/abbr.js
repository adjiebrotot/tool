/* ── ABBREVIATIONS: this tool's terms (SharedAbbr in ../shared.js) ──
   Loaded right after shared.js on every page of this tool, so no other tool
   downloads them and the same letters can mean something else elsewhere.
   The scope key works as in shared.js: the folder covers its sub-pages, a
   'folder/sub-page' key covers one page. Site-wide terms ('*') stay in
   shared.js. */

/* ── Capacity Expansion Planner ──
   Planners and students of the power sector: the field's own units (MW,
   GWh, kW) are left alone, its cost and technology shorthand is not. */
SharedAbbr.glossary('capacity-expansion-planner', {
  'O&M': ['Operation and Maintenance', 'the staff, parts and servicing a plant needs to keep running'],
  PV:    ['Photovoltaic', 'solar panels that turn sunlight straight into electricity'],
  EV:    ['Electric Vehicle', 'a car charged from the grid, which adds to the evening demand'],
  PyPSA: ['Python for Power System Analysis', 'the open-source power system toolbox this engine is ported from'],
  VoLL:  ['Value of Lost Load', 'what a MWh of demand left unserved is taken to cost'],
  OCGT:  ['Open-Cycle Gas Turbine', 'a gas turbine on its own: cheap to build and quick to start, but it burns more gas per MWh, so it suits the few peak hours'],
  CCGT:  ['Combined-Cycle Gas Turbine', 'a gas turbine whose hot exhaust raises steam for a second turbine: dearer to build, but it burns far less gas per MWh'],
  LCOE:  ['Levelised Cost of Energy', 'every year’s cost over every year’s energy served, both discounted: the flat price per MWh that would pay for the whole plan']
});
