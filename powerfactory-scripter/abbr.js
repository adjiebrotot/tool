/* ── ABBREVIATIONS: this tool's terms (SharedAbbr in ../shared.js) ──
   Loaded right after shared.js on every page of this tool, so no other tool
   downloads them and the same letters can mean something else elsewhere.
   The scope key works as in shared.js: the folder covers its sub-pages, a
   'folder/sub-page' key covers one page. Site-wide terms ('*') stay in
   shared.js. */

/* ── PowerFactory Scripter (and its samples page) ── */
SharedAbbr.glossary('powerfactory-scripter', {
  AC:   ['Alternating Current', 'the mains supply, where current reverses direction each cycle'],
  API:  ['Application Programming Interface', 'here, the PowerFactory Python folder a script imports from'],
  EMT:  ['Electromagnetic Transient', 'the instantaneous-value simulation. Slower than RMS, but it keeps switching and waveform detail'],
  HV:   ['High Voltage'],
  LV:   ['Low Voltage'],
  HVDC: ['High Voltage Direct Current', 'a DC link used to move bulk power or tie two AC systems together'],
  IEEE: ['Institute of Electrical and Electronics Engineers', 'the body whose published test systems these presets are built on'],
  /* MW is deliberately absent here: on the samples pages it is a unit next to
     a number ("163 MW", "0.61 MW per MW of G2"), and underlining every one
     would bury the terms that actually need explaining. So are N-1 and N-2:
     the page names the element count next to them every time they appear. */
  Op:   ['Operator', 'the comparison the filter applies to the value, such as = or >'],
  'p.u.': ['per unit', 'a quantity scaled against its rated base, so 1.0 is nameplate'],
  PF:   ['PowerFactory', 'the DIgSILENT PowerFactory power system simulator'],
  RMS:  ['Root Mean Square', 'the phasor-domain dynamic simulation, fast enough for stability studies'],
  SG:   ['Synchronous Generator', 'the rotating machine most large power stations use'],
  THD:  ['Total Harmonic Distortion', 'how much harmonic content distorts a waveform, as a share of the fundamental']
});
