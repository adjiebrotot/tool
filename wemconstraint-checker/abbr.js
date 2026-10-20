/* ── ABBREVIATIONS: this tool's terms (SharedAbbr in ../shared.js) ──
   Loaded right after shared.js on every page of this tool, so no other tool
   downloads them and the same letters can mean something else elsewhere.
   The scope key works as in shared.js: the folder covers its sub-pages, a
   'folder/sub-page' key covers one page. Site-wide terms ('*') stay in
   shared.js. */

/* ── WEM Constraint Checker (Western Australian electricity market) ── */
SharedAbbr.glossary('wemconstraint-checker', {
  LHS: ['Left-Hand Side', 'the flow side of the constraint equation, what is actually flowing'],
  MW:  ['Megawatt', 'a million watts of active power'],
  RHS: ['Right-Hand Side', 'the limit side of the constraint equation, what the flow has to stay under'],
  WEM: ['Wholesale Electricity Market', 'the Western Australian electricity market']
});
