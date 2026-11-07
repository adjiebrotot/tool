// What the reference pages say about the Master Library beyond the data in
// ../reference/components.json (read out of a running PSCAD by
// _audit/reference/build_reference.py): the order the groups are shown in, one plain sentence
// on the definitions an engineer reaches for most, and the parameters worth naming first.
//
// Every parameter named here is checked against the definition's own data when the pages are
// built, so a name that PSCAD does not have stops the build rather than reaching a page.
//
// A page's URL is its definition name, lower case, with anything that is not a letter or a
// digit turned into a hyphen (master:xfmr-3p2w -> reference/xfmr-3p2w/): a frozen handle once
// published, so rename the words on the page and leave the address alone.

export const UPDATED = '2026-11-07';

// [the group as components.json gives it, the heading, one line under it]. A group that is in
// the data and not here is shown last under its own name, so a new PSCAD never drops a page.
export const CATEGORIES = [
  ['Sources', 'Sources', 'Voltage and current sources, and the wind, PV and battery sources a converter study starts from.'],
  ['Machines', 'Machines, exciters and governors', 'Synchronous and induction machines, and the exciters, governors and turbines that drive them.'],
  ['Transformers', 'Transformers', 'Single and three phase transformers, classical and UMEC, autotransformers, instrument transformers and the SVC.'],
  ['Lines and cables', 'Lines and cables', 'Overhead line and cable cross-sections, conductors, ground properties and the PI sections.'],
  ['Passive', 'Passive components and loads', 'Resistors, inductors and capacitors, fixed and configurable loads, filters, arresters and surge generators.'],
  ['Switching', 'Breakers and faults', 'Breakers, faults, isolation switches, and the timed logic that operates them during a run.'],
  ['Protection', 'Protection', 'Relays, current transformers and CCVTs.'],
  ['Meters', 'Meters and output', 'Output channels, multimeters, RMS and THD meters, the phase locked loop and the signal taps.'],
  ['Control', 'Control blocks', 'The Continuous System Model Functions: gains, integrators, limiters, comparators, logic and transfer functions.'],
  ['Runtime', 'Runtime', 'File Read, Optimum Run and the other components that read or write while the case is running.'],
  ['Other', 'Everything else', 'The rest of the Master Library, including the HVDC and power electronics building blocks and the page furniture.'],
];

// key -> { what: one plain sentence, common: [parameter names, most useful first] }.
// Only for the definitions a reader is likely to arrive on from a search; every other page is
// written from PSCAD's own description and parameter list alone.
export const NOTABLE = {
  // ---- Breakers and faults
  'master:tpflt': {
    what: 'The three phase fault component. It is drawn into the case between the faulted point and ground, and the phases it applies, its on and off resistance and whether it is grounded are its own parameters. Its timing comes from the Timed Fault Logic beside it, or from a signal wired into it.',
    common: ['Ctype', 'A', 'B', 'C', 'G', 'Grnd', 'RON', 'ROFF', 'CLVL'],
  },
  'master:tfaultn': {
    what: 'The Timed Fault Logic that drives a fault component: when the fault is applied and how long it lasts. A fault ride through study sweeps its duration, and a critical clearing time search bisects it.',
    common: ['TF', 'DF'],
  },
  'master:fault_sw': {
    what: 'A single phase fault between one conductor and ground, with its own on and off resistance.',
    common: ['ROn', 'ROff', 'CLVL', 'Name'],
  },
  'master:breaker3': {
    what: 'The three phase breaker. Each pole has its own state, and a pre-insertion resistor can be switched in ahead of the main contacts. Its timing comes from the Timed Breaker Logic beside it, or from a signal.',
    common: ['BOpen1', 'BOpen2', 'BOpen3', 'Ctrl', 'ENAB', 'PRER', 'CLVL'],
  },
  'master:breaker1': {
    what: 'A single phase breaker, with a closed and an open resistance and an optional pre-insertion resistor.',
    common: ['RON', 'ROFF', 'ENAB', 'PRER', 'TD', 'CLVL'],
  },
  'master:tbreakn': {
    what: 'The Timed Breaker Logic that drives a breaker: its starting state and the times it operates.',
    common: ['INIT', 'NUMS', 'TO1', 'TO2'],
  },
  'master:var_switch': {
    what: 'The Two State Switch input control: a switch on the case that a reader, or a script, flips between two output values while the case runs.',
    common: ['Value', 'Max', 'Min', 'conv'],
  },
  // ---- Sources and machines
  'master:source3': {
    what: 'The three phase voltage source behind an impedance: the usual grid equivalent at the edge of a study. Its magnitude, frequency and impedance are set here, or taken from signals when it is put under external control.',
    common: ['Es', 'F0', 'MVA', 'Ctrl', 'Imp', 'PS', 'F'],
  },
  'master:wind_source': {
    what: 'A wind speed source: a mean speed with optional gust, ramp and noise components, for driving a wind turbine model.',
    common: ['BWV', 'Gust', 'Ramp', 'Noise', 'MAXG', 'T1G', 'TG'],
  },
  'master:sync_machine': {
    what: 'The synchronous machine. Its rating, inertia and reactances are set here, and an exciter and a governor are wired to it as separate components. Its speed and rotor angle are the signals a transient stability check reads.',
    common: ['H', 'Ibase', 'D', 'Cnfg', 'AGFC'],
  },
  // ---- Transformers
  'master:xfmr-3p2w': {
    what: 'The three phase two winding transformer, classical model. Rating, winding voltages, leakage reactance, losses, the winding connections and the saturation data are all on the one component.',
    common: ['Tmva', 'f', 'V1', 'V2', 'Xl', 'YD1', 'YD2', 'Lead', 'CuL', 'NLL', 'Enab', 'Tap'],
  },
  // ---- Passive
  'master:resistor': { what: 'A resistor branch. One parameter, and the unit travels with the value.', common: ['R'] },
  'master:inductor': { what: 'An inductor branch, written in henries unless another unit is given with the value.', common: ['L'] },
  'master:capacitor': { what: 'A capacitor branch, written in microfarads unless another unit is given with the value.', common: ['C'] },
  // ---- Meters and output
  'master:pgb': {
    what: 'The Output Channel: the component that records a signal so a run can be plotted and read back afterwards. A script reads a channel by the title shown here, and the recorded values land in the .out files beside the case.',
    common: ['Scale', 'Max', 'Min', 'enab', 'mrun', 'UseSignalName'],
  },
  'master:multimeter': {
    what: 'The multimeter: instantaneous and RMS voltage and current, active and reactive power and phase angle from one three phase measurement point, each on its own output.',
    common: ['BaseV', 'BaseA', 'S', 'Freq', 'RMS', 'IRMS', 'MeasP', 'MeasQ', 'MeasPh'],
  },
  'master:rms3ph': {
    what: 'The three phase RMS meter: a sliding window RMS of a three phase voltage, which is what a fault ride through check compares against its limit.',
    common: ['freq', 'NSAM', 'Scale', 'Ts', 'Type'],
  },
  'master:thd': {
    what: 'The harmonic distortion calculator: the total harmonic distortion of a signal, worked out from the time domain waveform while the run goes on.',
    common: ['Mode', 'Size'],
  },
  'master:power': {
    what: 'The real and reactive power meter, with a smoothing time constant on its outputs.',
    common: ['P', 'Q', 'TS', 'DIR'],
  },
  // ---- Runtime
  'master:mrun': {
    what: 'The Multiple Run component: PSCAD runs the case once per combination of the variables set here, without the script restarting it each time. Useful when the sweep is small and self contained; a script loop is easier to read when it is not.',
    common: ['ENAB', 'IType1', 'IType2', 'IType3'],
  },
};

// The index's lookup table: [what you want, definition key, parameter names, unit, note].
export const QUICK = [
  ['Fault timing, for a ride through sweep', 'master:tfaultn', 'TF, DF', 's', 'Time to apply, duration'],
  ['Which phases a fault takes down', 'master:tpflt', 'Ctype, A, B, C, G', '', 'Fault type and the phases in it'],
  ['Fault resistance', 'master:tpflt', 'RON, ROFF', 'ohm', 'On and off resistance'],
  ['Breaker operating times', 'master:tbreakn', 'TO1, TO2', 's', 'First and second operation'],
  ['Breaker pole state', 'master:breaker3', 'BOpen1, BOpen2, BOpen3', '', 'Per pole, open or closed'],
  ['Source voltage and frequency', 'master:source3', 'Es, F0', 'kV, Hz', 'Line to line RMS'],
  ['Source short-circuit level', 'master:source3', 'MVA', 'MVA', 'Three phase base MVA'],
  ['Transformer rating', 'master:xfmr-3p2w', 'Tmva', 'MVA', 'Three phase'],
  ['Transformer winding voltages', 'master:xfmr-3p2w', 'V1, V2', 'kV', 'Line to line RMS'],
  ['Transformer leakage reactance', 'master:xfmr-3p2w', 'Xl', 'pu', 'Positive sequence'],
  ['Transformer winding connection', 'master:xfmr-3p2w', 'YD1, YD2', '', 'Star or delta, per winding'],
  ['Machine inertia', 'master:sync_machine', 'H', 's', 'Inertia constant'],
  ['Resistance, inductance, capacitance', 'master:resistor', 'R, L, C', 'ohm, H, uF', 'One per branch component'],
  ['A recorded signal a script reads back', 'master:pgb', 'Scale, Max, Min', '', 'Output Channel'],
  ['RMS voltage of a three phase point', 'master:rms3ph', 'freq, NSAM, Scale', 'Hz, , kV', 'Sliding window'],
  ['Harmonic distortion of a waveform', 'master:thd', 'Mode, Size', '', 'From the time domain'],
  ['Wind speed, with gusts', 'master:wind_source', 'BWV, MAXG, T1G', 'm/s, m/s, s', 'Mean, gust peak, gust start'],
];
