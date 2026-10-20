/* ── ABBREVIATIONS: this tool's terms (SharedAbbr in ../shared.js) ──
   Loaded right after shared.js on every page of this tool, so no other tool
   downloads them and the same letters can mean something else elsewhere.
   The scope key works as in shared.js: the folder covers its sub-pages, a
   'folder/sub-page' key covers one page. Site-wide terms ('*') stay in
   shared.js. */

/* ── ED/UC Simulator ──
   The same readers as the Load Flow Simulator, so the field's own units and
   words (MW, MWh, p.u., DC, HVDC) are left alone. */
SharedAbbr.glossary('ed-uc-simulator', {
  'ED/UC': ['Economic Dispatch and Unit Commitment', 'sharing the load among units, and deciding which units run in each hour'],
  PJM:   ['PJM Interconnection', 'the US grid operator whose 5-bus test system is a textbook example of nodal prices'],
  PyPSA: ['Python for Power System Analysis', 'the open-source power system toolbox this engine is ported from'],
  VoLL:  ['Value of Lost Load', 'what a MWh of demand left unserved is taken to cost']
});
