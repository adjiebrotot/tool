// The curated layer over ../reference/components.json: the order and words of the categories,
// the address of each definition's page, and a few lines on the definitions a script touches
// most. Everything else on a page (every parameter, its unit, range, default and meaning) is
// read out of PSCAD itself by ../builder/_audit/reference/build_reference.py.
//
// build.mjs stops when a curated definition, or a parameter named in `common`, is not in the data.

// The page address of a definition key: "master:tpflt" -> "master-tpflt",
// "master:xfmr-3p2w" -> "master-xfmr-3p2w". FROZEN: a page address is kept for good once
// published, so this function never changes. Change the words on a page, not this.
export function slugOf(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// The categories, in the index's order. The key is the group PSCAD's own palette files under
// (the "group" of each definition in the data); the words are for the page.
export const CATEGORIES = [
  ['Sources', 'Sources', 'Voltage and current sources, a battery, a photovoltaic and a wind source.'],
  ['Passive', 'Passive branches, loads and filters', 'Resistors, inductors and capacitors, the configurable loads, tuned and high-pass filters, arresters.'],
  ['Transformers', 'Transformers and reactors', 'Classical and UMEC transformers of every winding count, saturable reactors, the SVC, instrument transformers.'],
  ['Lines and cables', 'Lines, cables and towers', 'Tower and cable cross-sections for the line constants program, PI sections, the line and cable interfaces.'],
  ['Machines', 'Machines, exciters and governors', 'Synchronous, induction, permanent magnet and DC machines, with the IEEE exciters, governors and turbines.'],
  ['Switching', 'Faults and switching', 'Faults and the timed fault logic that drives them, breakers and the timed breaker logic, power electronic switches.'],
  ['Protection', 'Protection', 'Relays and the CT and CCVT models they read through.'],
  ['Meters', 'Meters and output', 'Output channels, multimeters, RMS, frequency and power meters, harmonic calculators.'],
  ['Control', 'Control blocks', 'Constants, gains, transfer functions, limiters, logic, sequencers and signal transformations.'],
  ['Runtime', 'Runtime', 'File read, the optimum run and the components that act on the run itself.'],
  ['Other', 'Other components', 'Node labels, MMC cells, gamma controllers and the components PSCAD files under no other group.'],
];

// The definitions a script works with most, with a line on what each one is and the parameters
// people look up first. `common` is [[parameter, note]]; a note may be empty.
export const CURATED = {
  'master:tpflt': {
    what: 'The three phase fault: a fault branch between the phases and to ground, drawn into the case. Which phases are faulted and to what is set here; when it is applied comes from the logic wired to it, usually a Timed Fault Logic, because this component has no time parameters of its own.',
    common: [['A', 'phase A in the fault, YES or NO'], ['B', ''], ['C', ''], ['G', 'to ground'], ['RON', 'the fault resistance while it is on'], ['Ctype', 'INTERNAL uses A, B, C and G; EXTERNAL takes the phases from a signal']],
  },
  'master:tfaultn': {
    what: 'Timed Fault Logic: the block that switches a fault on at a time and off after a duration. A script that times a fault writes these two parameters, which is what the Builder\'s Set a fault block does.',
    common: [['TF', 'when the fault is applied'], ['DF', 'how long it stays on']],
  },
  'master:tfault': {
    what: 'The older timed fault logic, with a repeat option. Like Timed Fault Logic it holds the fault\'s start time and duration.',
    common: [['TF', 'when the fault is applied'], ['DF', 'how long it stays on'], ['REP', 'repeat the fault']],
  },
  'master:breaker3': {
    what: 'The three phase breaker. Its state at the start of the run is set here; when it opens or closes comes from the logic wired to it, usually a Timed Breaker Logic.',
    common: [['RON', 'closed resistance'], ['ROFF', 'open resistance'], ['BOpen1', 'state of pole A at the start'], ['NAME', 'the name of its control signal']],
  },
  'master:tbreakn': {
    what: 'Timed Breaker Logic: switches a breaker at one or two set times. A script that times a switching writes these.',
    common: [['INIT', 'the state at the start of the run'], ['NUMS', 'one or two operations'], ['TO1', 'the first operation'], ['TO2', 'the second']],
  },
  'master:resistor': {
    what: 'A single resistance. With the inductor and the capacitor it is the simplest component to sweep from a script, which is why the Builder\'s Sweep one parameter Quick Start starts on it.',
    common: [['R', '']],
  },
  'master:inductor': { what: 'A single inductance.', common: [['L', '']] },
  'master:capacitor': { what: 'A single capacitance.', common: [['C', '']] },
  'master:source_1': {
    what: 'The single phase voltage source, model 2: an AC or DC source behind an impedance, set by magnitude, phase and frequency or by the power it delivers.',
    common: [['Vm', 'magnitude'], ['f', 'frequency'], ['Ph', 'initial phase'], ['Type', 'what the source impedance is'], ['Tc', 'the ramp up time at the start of the run']],
  },
  'master:source3': {
    what: 'The three phase voltage source, model 1, the usual Thevenin equivalent of a grid in a PSCAD case.',
    common: [['Es', 'magnitude, line to line RMS'], ['F0', 'frequency'], ['Ph', 'phase'], ['MVA', 'base MVA'], ['Ctrl', 'fixed, or controlled from signals']],
  },
  'master:source_3': {
    what: 'The three phase voltage source, model 2: a source behind an R, RL or R//L impedance, set by its terminal values or behind its impedance.',
    common: [['Vbase', 'base voltage, line to line RMS'], ['Sbase', 'base MVA'], ['Type', 'the impedance type'], ['Spec', 'what the given values are'], ['Tc', 'the ramp up time']],
  },
  'master:pgb': {
    what: 'The output channel: what makes a signal recorded in the run\'s output files and plottable on a graph. Its title is the name a script reads the channel by.',
    common: [['Name', 'the title, which is the channel name a script reads'], ['Units', ''], ['Scale', 'multiplies the signal before it is recorded'], ['enab', 'NO: not written to the output files'], ['mrun', 'what is kept across a multiple run']],
  },
  'master:multimeter': {
    what: 'The multimeter: measures voltage, current, power, RMS and phase at a point of a circuit and gives each as a signal, to wire into an output channel.',
    common: [['MeasV', 'instantaneous voltage'], ['MeasI', 'instantaneous current'], ['MeasP', 'active power'], ['MeasQ', 'reactive power'], ['RMS', 'RMS voltage'], ['Freq', 'fundamental frequency']],
  },
  'master:rms3ph': {
    what: 'The three phase RMS meter, analog or digital, per-unitised on a rated voltage.',
    common: [['Scale', 'rated voltage for per-unitising'], ['freq', 'fundamental frequency'], ['Type', 'analog or digital'], ['Ts', 'smoothing time constant']],
  },
  'master:freq-meas': {
    what: 'Measures the frequency, the phase and the RMS of a voltage, the way a PLL does.',
    common: [['F', 'rated frequency'], ['Vbas', 'rated voltage for per-unitising'], ['Cnfg', 'frequency output in Hz or per unit']],
  },
  'master:thd': {
    what: 'The on-line harmonic distortion calculator. It works on the signals of an on-line frequency scanner during the run; a script can also take THD from a recorded waveform afterwards, which is what the Builder\'s Harmonic distortion block does.',
    common: [['Size', 'number of harmonics'], ['Mode', 'per unit or percent']],
  },
  'master:fft': {
    what: 'The on-line frequency scanner: an FFT of a signal during the run, giving the magnitude and phase of each harmonic as signals.',
    common: [],
  },
  'master:xfmr-3p2w': {
    what: 'The classical three phase two winding transformer, with optional saturation.',
    common: [['Enab', 'saturation on or off'], ['CuL', 'copper losses']],
  },
  'master:sync_machine': {
    what: 'The synchronous machine, with its d and q axis data, inertia and the initialisation that starts it as a source and moves it to a machine.',
    common: [['H', 'inertia constant'], ['D', 'friction and windage'], ['Ibase', 'rated line current'], ['Cnfg', 'data entered as generator or equivalent circuit']],
  },
  'master:sqc100': {
    what: 'The squirrel cage induction machine, from typical data or from its own equivalent circuit.',
    common: [['Cnfg', 'how the data is entered'], ['HP', 'size of the machine the per-unit data comes from'], ['D', 'mechanical damping']],
  },
  'master:const': {
    what: 'A real constant: a value a script can write to move a set-point or a gain without touching the model\'s structure.',
    common: [['Value', 'the value it outputs'], ['Name', 'its label']],
  },
  'master:var_switch': {
    what: 'The two state switch: an input control that gives one of two values, which a script can set before a run.',
    common: [['Value', 'the state it starts in'], ['Max', 'the value in the on state'], ['Min', 'the value in the off state']],
  },
  'master:fixed_load': {
    what: 'The fixed load: a load with set real and reactive power that depends on voltage and frequency through its indices.',
    common: [['PO', 'rated real power per phase'], ['QO', 'rated reactive power per phase'], ['VBO', 'rated voltage, line to ground RMS'], ['NP', 'voltage index for P'], ['NQ', 'voltage index for Q']],
  },
  'master:newpi': {
    what: 'The coupled PI section: a short line from its sequence data, entered per metre.',
    common: [['Rp', 'positive sequence resistance'], ['Lp', 'positive sequence inductance'], ['Cp', 'positive sequence capacitance'], ['F', 'rated frequency']],
  },
  'master:mrun': {
    what: 'The Multiple Run component: PSCAD\'s own way to run a case many times, stepping up to six variables and recording up to six channels from each run.',
    common: [['ENAB', 'enabled or disabled'], ['Inc1R', 'the step of variable 1'], ['Max1R', 'the end of its range']],
  },
  'master:fileread': {
    what: 'Reads columns of a data file into the run, replaying a recorded signal as an input.',
    common: [['fname', 'the file'], ['nch', 'number of columns'], ['sfreq', 'sampling frequency']],
  },
  'master:wind_source': {
    what: 'The wind source: a wind speed with gust, ramp and noise components, to drive a wind turbine model.',
    common: [['BWV', 'mean wind speed'], ['T1G', 'gust start'], ['MAXG', 'gust peak'], ['T1R', 'ramp start']],
  },
};
