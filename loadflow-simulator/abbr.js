/* ── ABBREVIATIONS: this tool's terms (SharedAbbr in ../shared.js) ──
   Loaded right after shared.js on every page of this tool, so no other tool
   downloads them and the same letters can mean something else elsewhere.
   The scope key works as in shared.js: the folder covers its sub-pages, a
   'folder/sub-page' key covers one page. Site-wide terms ('*') stay in
   shared.js. */

/* ── Load Flow Simulator ──
   Its readers work in power systems, so the field's own units and words
   (p.u., MW, MVAr, kV, AC, DC, HV, HVDC, PV, PQ) are left alone. Only the
   names a power engineer may not have met are explained. */
SharedAbbr.glossary('loadflow-simulator', {
  PyPSA: ['Python for Power System Analysis', 'the open-source power system toolbox this engine is ported from'],
  WSCC:  ['Western Systems Coordinating Council', 'the US body whose 9-bus test system became a textbook standard']
});
