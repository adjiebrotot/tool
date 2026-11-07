/* ── ABBREVIATIONS: this tool's terms (SharedAbbr in ../shared.js) ──
   Loaded right after shared.js on every page of this tool, so no other tool
   downloads them and the same letters can mean something else elsewhere.
   The scope key works as in shared.js: the folder covers its sub-pages, a
   'folder/sub-page' key covers one page. Site-wide terms ('*') stay in
   shared.js.

   Subject-matter jargon only: the vocabulary of EMT simulation and of PSCAD
   itself. No file formats (.out, .pscx, CSV), no everyday computing words,
   and no units sitting next to a number. A unit is explained by its column
   header or its field, not by an underline under every figure. */

/* ── PSCAD Scripter ── */
SharedAbbr.glossary('pscad-scripter', {
  AC:    ['Alternating Current', 'a supply whose current reverses direction each cycle'],
  API:   ['Application Programming Interface', 'here, the PSCAD Automation Library a script drives PSCAD through'],
  CCT:   ['Critical Clearing Time', 'the longest a fault can last before the machines lose synchronism'],
  DC:    ['Direct Current', 'a supply whose current flows one way'],
  DFT:   ['Discrete Fourier Transform', 'the sum that turns a window of a waveform into its harmonics'],
  EMT:   ['Electromagnetic Transient', 'a simulation of the instantaneous waveforms themselves, not of phasors'],
  EMTDC: ['Electromagnetic Transients including DC', 'the solver PSCAD compiles a case for and runs it on'],
  FFT:   ['Fast Fourier Transform', 'the quick way to compute a Discrete Fourier Transform'],
  FRT:   ['Fault Ride Through', 'staying connected and recovering through a fault, as a grid code requires'],
  HV:    ['High Voltage'],
  HVDC:  ['High Voltage Direct Current', 'a DC link used to move bulk power or tie two AC systems together'],
  LV:    ['Low Voltage'],
  LVRT:  ['Low Voltage Ride Through', 'the voltage against time curve a plant has to stay above through a fault'],
  MHI:   ['Manitoba Hydro International', 'the company that makes PSCAD and publishes its Automation Library'],
  MMC:   ['Modular Multilevel Converter', 'the converter most modern HVDC and large STATCOM schemes use'],
  PLL:   ['Phase Locked Loop', 'the control block a converter tracks the grid angle with'],
  'p.u.': ['per unit', 'a quantity scaled against its rated base, so 1.0 is nameplate'],
  RMS:   ['Root Mean Square', 'the effective value of a waveform over a cycle, what a meter reads'],
  RoCoF: ['Rate of Change of Frequency', 'how fast the frequency moves, in Hz per second'],
  SG:    ['Synchronous Generator', 'the rotating machine most large power stations use'],
  SSCI:  ['Sub-Synchronous Control Interaction', 'an oscillation below mains frequency between a converter control and the network'],
  SSR:   ['Sub-Synchronous Resonance', 'an oscillation below mains frequency between a machine shaft and a series-compensated line'],
  STATCOM: ['Static Synchronous Compensator', 'a converter that holds voltage by exchanging reactive power'],
  SVC:   ['Static Var Compensator', 'a thyristor-switched reactor and capacitor set that holds voltage'],
  THD:   ['Total Harmonic Distortion', 'how much harmonic content distorts a waveform, as a share of the fundamental'],
  TRV:   ['Transient Recovery Voltage', 'the voltage that appears across a breaker just after it interrupts'],
  VSC:   ['Voltage Source Converter', 'the converter type that sets its own AC voltage, as against a line-commutated one'],
});
