// What the reference pages say about each class beyond the data in ../variables/: the name
// PowerFactory 2024 gives it (Application.GetClassDescription), a category for the index, one
// plain sentence on what it is, the type class it points to, the attributes engineers reach for
// most, and the input data the SetAttribute example writes. Every attribute named here is
// checked against the class's data file when the pages are built (a missing one stops the build).
//
// A page's URL is its class name (reference/ElmLne/): a frozen handle once published.

export const CATEGORIES = [
  ['branches', 'Lines, cables and transformers'],
  ['nodes', 'Terminals and switching'],
  ['gen', 'Generators and sources'],
  ['loads', 'Loads and compensation'],
  ['pe', 'Power electronics and HVDC'],
  ['control', 'Dynamic models, control and protection'],
  ['groups', 'Grids, areas and other groupings'],
  ['data', 'Results and measurement data'],
  ['types', 'Types (shared equipment data)'],
  ['events', 'Simulation events'],
];

// common: [attr, note?]  (attr exactly as typed in GetAttribute; result variables with their
// terminal suffix). set: [attr, value, comment] for the SetAttribute example.
export const CLASSES = {
  // ---- Branches
  ElmLne: { name: 'Line', cat: 'branches', type: 'TypLne', what: 'An overhead line or cable between two terminals. Its impedance per km and rated current sit in the line type (TypLne) it points to through typ_id; the element holds the length, the number of parallel lines and the derating.',
    common: [['c:loading', 'thermal loading'], ['m:P:bus1', 'active power at terminal i'], ['m:Q:bus1'], ['m:I:bus1', 'current at terminal i'], ['c:Ploss', 'losses'], ['dline', 'length'], ['nlnum'], ['fline'], ['outserv'], ['typ_id']],
    set: ['outserv', 1, 'take the line out of service'] },
  ElmLnesec: { name: 'Line Sub-Section', cat: 'branches', what: 'One section of a line that is split into sections, each with its own type and length.', set: ['dline', 2.5, 'section length in km'] },
  ElmTr2: { name: '2-Winding Transformer', cat: 'branches', type: 'TypTr2', what: 'A two-winding transformer between an HV and an LV terminal. Rating, impedance and tap changer data sit in its type (TypTr2); the element holds the tap position and the number of parallel units.',
    common: [['c:loading'], ['m:P:bushv', 'active power at the HV side'], ['m:Q:bushv'], ['m:I:buslv', 'current at the LV side'], ['c:Ploss'], ['nntap', 'tap position (input)'], ['c:nntap', 'tap position after the load flow'], ['ntnum'], ['outserv'], ['typ_id']],
    set: ['nntap', 2, 'move the tap to position 2'] },
  ElmTr3: { name: '3-Winding Transformer', cat: 'branches', type: 'TypTr3', what: 'A three-winding transformer with HV, MV and LV terminals; ratings and impedances sit in its type (TypTr3).',
    common: [['c:loading', 'highest loading of the three windings'], ['m:P:bushv'], ['m:P:busmv'], ['m:P:buslv'], ['n3tap_h', 'HV tap position'], ['outserv'], ['typ_id']], set: ['outserv', 1, 'take the transformer out of service'] },
  ElmTr4: { name: '4-Winding Transformer', cat: 'branches', type: 'TypTr4', what: 'A four-winding transformer with one HV and three LV terminals; ratings and impedances sit in its type (TypTr4).', set: ['outserv', 1, 'take the transformer out of service'] },
  ElmTrmult: { name: 'Multi-Winding Transformer', cat: 'branches', what: 'A transformer with any number of windings, such as the transformer of a multi-pulse converter.', set: ['outserv', 1, 'take the transformer out of service'] },
  ElmTrb: { name: 'Booster Transformer', cat: 'branches', what: 'A booster transformer of a railway supply, which forces the return current into the return conductor.', set: ['outserv', 1, 'take it out of service'] },
  ElmVoltreg: { name: 'Step-Voltage Regulator', cat: 'branches', what: 'A step-voltage regulator: an autotransformer with a tap changer that holds the voltage along a distribution feeder.', set: ['outserv', 1, 'take it out of service'] },
  ElmSind: { name: 'Series Reactor', cat: 'branches', what: 'A series reactor between two terminals, used to limit short-circuit currents or to share load between parallel paths.', set: ['outserv', 1, 'take it out of service'] },
  ElmZpu: { name: 'Common Impedance', cat: 'branches', what: 'A common impedance between two terminals, often the equivalent left by a network reduction.', set: ['outserv', 1, 'take it out of service'] },
  ElmBranch: { name: 'Branch', cat: 'branches', what: 'A branch: one element that holds a chain of lines, switches and terminals, reported as a whole with its total impedance, length and rating.', set: ['loc_name', 'Branch A-B', 'rename the branch'] },
  ElmCabsys: { name: 'Cable System', cat: 'branches', what: 'A cable system: several cables laid together, with the coupling between their cores and sheaths.', set: ['outserv', 1, 'take it out of service'] },
  ElmTow: { name: 'Line Couplings', cat: 'branches', what: 'Line couplings: the mutual coupling between line circuits that share towers, computed from a tower type.', set: ['outserv', 1, 'take it out of service'] },

  // ---- Nodes and switching
  ElmTerm: { name: 'Terminal', cat: 'nodes', what: 'A terminal: a busbar, a junction node or an internal node. Node results are read here: voltage magnitude and angle after a load flow, fault levels after a short circuit, frequency during an RMS simulation.',
    common: [['m:u', 'voltage, p.u.'], ['m:Ul', 'line-line voltage, kV'], ['m:phiu', 'voltage angle'], ['m:du', 'deviation from nominal'], ['uknom', 'nominal voltage'], ['m:Ikss', 'initial short-circuit current'], ['m:Skss'], ['m:ip', 'peak short-circuit current'], ['m:fehz', 'frequency (RMS simulation)'], ['outserv'], ['iUsage', 'busbar, junction or internal node']],
    set: ['outserv', 1, 'take the terminal out of service'] },
  ElmCoup: { name: 'Breaker/Switch', cat: 'nodes', type: 'TypSwitch', what: 'A breaker or switch between two terminals inside a substation. on_off says whether it is closed (1) or open (0).',
    common: [['on_off', '1 closed, 0 open'], ['aUsage', 'breaker, disconnector, load switch...'], ['m:I:bus1'], ['m:P:bus1']], set: ['on_off', 0, 'open the breaker'] },
  ElmGndswt: { name: 'Grounding Switch', cat: 'nodes', what: 'A grounding (earthing) switch at a terminal.', set: ['on_off', 1, 'close the grounding switch'] },
  ElmNec: { name: 'NEC/NER', cat: 'nodes', what: 'A neutral earthing compensator or resistor (NEC/NER) that earths the neutral of a network.', set: ['outserv', 1, 'take it out of service'] },

  // ---- Generators and sources
  ElmSym: { name: 'Synchronous Machine', cat: 'gen', type: 'TypSym', what: 'A synchronous machine, generator or motor. Reactances, time constants and inertia sit in its type (TypSym); the element holds the dispatch, the control mode and the number of parallel machines.',
    common: [['m:P:bus1', 'active power output'], ['m:Q:bus1', 'reactive power output'], ['c:loading'], ['pgini', 'active power dispatch'], ['qgini'], ['usetp', 'voltage setpoint'], ['ip_ctrl', 'reference machine'], ['av_mode', 'local controller'], ['ngnum'], ['outserv'], ['s:speed', 'speed (RMS simulation)'], ['c:firel', 'rotor angle (RMS simulation)']],
    set: ['pgini', 120.0, 'dispatch 120 MW'] },
  ElmGenstat: { name: 'Static Generator', cat: 'gen', what: 'A static generator: a converter-connected source (wind, solar, battery, fuel cell) modelled as a controllable injection of active and reactive power.',
    common: [['m:P:bus1'], ['m:Q:bus1'], ['c:loading'], ['pgini'], ['qgini'], ['sgn', 'rating'], ['cosn'], ['av_mode'], ['ngnum'], ['outserv']], set: ['pgini', 50.0, 'dispatch 50 MW'] },
  ElmPvsys: { name: 'PV System', cat: 'gen', what: 'A PV system: a photovoltaic plant and its inverter. Its power inputs are in kW and kVA, not MW.',
    common: [['m:P:bus1'], ['m:Q:bus1'], ['c:loading'], ['pgini', 'active power, kW'], ['qgini'], ['sgn', 'rating, kVA'], ['av_mode'], ['ngnum'], ['outserv']], set: ['pgini', 800.0, 'dispatch 800 kW'] },
  ElmAsm: { name: 'Asynchronous Machine', cat: 'gen', type: 'TypAsm', what: 'An asynchronous (induction) machine, run as a motor or a generator.',
    common: [['m:P:bus1'], ['m:Q:bus1'], ['c:loading'], ['s:slip', 'slip'], ['pgini'], ['i_mot', 'generator or motor'], ['outserv'], ['s:speed', 'speed (RMS simulation)']], set: ['pgini', 2.0, 'active power 2 MW'] },
  ElmAsmsc: { name: 'Doubly-Fed Induction Machine', cat: 'gen', what: 'A doubly-fed induction machine (DFIG): an induction machine whose rotor is fed through a converter, as in many wind turbines.', set: ['pgini', 2.0, 'active power 2 MW'] },
  ElmXnet: { name: 'External Grid', cat: 'gen', what: 'An external grid: the network beyond the edge of the model, set by its short-circuit power and a voltage setpoint. It is often the slack of the load flow.',
    common: [['m:P:bus1', 'slack active power'], ['m:Q:bus1'], ['bustp', 'SL, PV or PQ'], ['usetp'], ['snss', 'maximum short-circuit power'], ['snssmin'], ['outserv']], set: ['usetp', 1.02, 'voltage setpoint 1.02 p.u.'] },
  ElmVac: { name: 'AC Voltage Source', cat: 'gen', what: 'An AC voltage source behind an impedance, used for ideal sources and test circuits.', set: ['outserv', 1, 'take it out of service'] },
  ElmIac: { name: 'AC Current Source', cat: 'gen', what: 'An AC current source, often used to inject harmonic currents in harmonic studies.', set: ['outserv', 1, 'take it out of service'] },
  ElmDcu: { name: 'DC Voltage Source', cat: 'gen', what: 'A DC voltage source at a DC terminal.', set: ['outserv', 1, 'take it out of service'] },

  // ---- Loads and compensation
  ElmLod: { name: 'General Load', cat: 'loads', type: 'TypLod', what: 'A general load. Its P and Q are set on the element; how they change with voltage and frequency is set in the load type (TypLod).',
    common: [['m:P:bus1'], ['m:Q:bus1'], ['m:I:bus1'], ['plini', 'active power demand'], ['qlini', 'reactive power demand'], ['scale0', 'scaling factor'], ['slini'], ['coslini'], ['outserv'], ['typ_id']], set: ['plini', 140.0, 'demand 140 MW'] },
  ElmLodlv: { name: 'Low-Voltage Load', cat: 'loads', type: 'TypLodlv', what: 'A low-voltage load, made of fixed and variable parts as in a residential feeder.', set: ['outserv', 1, 'take it out of service'] },
  ElmLodmv: { name: 'MV Load', cat: 'loads', what: 'An MV load: the load of a distribution transformer, which may also hold embedded generation.', set: ['outserv', 1, 'take it out of service'] },
  ElmTrain: { name: 'Train', cat: 'loads', what: 'A train: a railway load that draws power from the traction supply as it moves.', set: ['outserv', 1, 'take it out of service'] },
  ElmShnt: { name: 'Shunt/Filter', cat: 'loads', what: 'A shunt: a capacitor bank, a reactor or a tuned filter, with switchable steps.',
    common: [['m:Q:bus1', 'reactive power'], ['shtype', 'R-L, C, R-L-C...'], ['qcapn', 'rated reactive power, capacitive'], ['qrean', 'rated reactive power, inductive'], ['ncapa', 'steps in service'], ['ncapx', 'number of steps'], ['ushnm'], ['outserv']], set: ['ncapa', 2, 'switch in 2 steps'] },
  ElmFilter: { name: 'Harmonic Filter', cat: 'loads', what: 'A harmonic filter, tuned to absorb harmonic currents at chosen orders.', set: ['outserv', 1, 'take it out of service'] },
  ElmSvs: { name: 'Static Var System', cat: 'loads', what: 'A static var system (SVC): thyristor-controlled reactors and switched capacitors that hold a voltage setpoint.',
    common: [['m:Q:bus1'], ['usetp'], ['i_ctrl'], ['qmax'], ['qmin'], ['outserv']], set: ['usetp', 1.01, 'voltage setpoint 1.01 p.u.'] },

  // ---- Power electronics and HVDC
  ElmVsc: { name: 'PWM Converter/2 DC-Connections', cat: 'pe', what: 'A PWM voltage-source converter with an AC terminal and two DC terminals (DC+ and DC-), as in a VSC-HVDC station.', set: ['outserv', 1, 'take the converter out of service'] },
  ElmVscmono: { name: 'PWM Converter/1 DC-Connection', cat: 'pe', what: 'A PWM voltage-source converter with an AC terminal and one DC terminal.', set: ['outserv', 1, 'take the converter out of service'] },
  ElmRecmono: { name: 'Rectifier/Inverter/1 DC-Connection', cat: 'pe', what: 'A line-commutated rectifier or inverter with an AC terminal and one DC terminal.', set: ['outserv', 1, 'take it out of service'] },

  // ---- Dynamic models, control and protection
  ElmDsl: { name: 'DSL Model', cat: 'control', what: 'A DSL model: one instance of a dynamic model definition (BlkDef), such as a governor, an exciter or a plant controller, used in RMS and EMT simulations. Its parameters are a list in params, in the order of the definition.', set: ['outserv', 1, 'switch the model off'] },
  ElmComp: { name: 'Composite Model', cat: 'control', what: 'A composite model: the frame that wires DSL models, measurement devices and network elements together into one plant model.', set: ['outserv', 1, 'switch the plant model off'] },
  ElmMdl: { name: 'Modelica Model', cat: 'control', what: 'A Modelica model: a dynamic model written in Modelica and used in RMS and EMT simulations.', set: ['outserv', 1, 'switch the model off'] },
  ElmStactrl: { name: 'Station Control', cat: 'control', what: 'A station controller: it shares the reactive power or voltage control of a station between several machines.', set: ['outserv', 1, 'switch the controller off'] },
  ElmSecctrl: { name: 'Power-Frequency Controller', cat: 'control', what: 'A power-frequency controller: secondary (AGC) control that shares a power change between generators to bring frequency and interchange back.', set: ['outserv', 1, 'switch the controller off'] },
  StaPll: { name: 'PLL Phase/Frequency Measurement', cat: 'control', what: 'A phase-locked loop (PLL) measurement device: it measures the phase angle and frequency at a terminal for dynamic models.', set: ['outserv', 1, 'switch it off'] },
  ElmRelay: { name: 'Relay', cat: 'control', what: 'A relay: a protection device built from measurement, timer and logic blocks, which trips breakers in a simulation or a protection study.', set: ['outserv', 1, 'switch the relay off'] },

  // ---- Groupings
  ElmNet: { name: 'Grid', cat: 'groups', what: 'A grid: the container that holds a network\'s elements. It carries the nominal frequency and grid summary results such as total generation, load and losses.',
    common: [['frnom', 'nominal frequency'], ['c:Pgen', 'total generation'], ['c:Pload', 'total load'], ['c:Ploss', 'total losses']], set: ['frnom', 50.0, 'nominal frequency 50 Hz'] },
  ElmArea: { name: 'Area', cat: 'groups', what: 'An area: a group of elements for summary results (generation, load, losses, interchange) and area-wide actions.', set: ['loc_name', 'Area North', 'rename the area'] },
  ElmZone: { name: 'Zone', cat: 'groups', what: 'A zone: a group of elements for summary results and for scaling loads and generation of one part of the network together.', set: ['loc_name', 'Zone 1', 'rename the zone'] },
  ElmFeeder: { name: 'Feeder', cat: 'groups', what: 'A feeder: the radial path that starts at one cubicle, used for voltage profiles, feeder load scaling and feeder results.', set: ['loc_name', 'Feeder 1', 'rename the feeder'] },
  ElmSubstat: { name: 'Substation', cat: 'groups', what: 'A substation: the container for the busbars, breakers and bays of one site.', set: ['loc_name', 'Substation A', 'rename the substation'] },
  ElmTrfstat: { name: 'Secondary Substation', cat: 'groups', what: 'A secondary substation: an MV/LV substation with its transformer, as found along distribution feeders.', set: ['loc_name', 'Kiosk 12', 'rename it'] },
  ElmBoundary: { name: 'Boundary', cat: 'groups', what: 'A boundary: a cut through the network that defines an interior region, for interchange flows and network reduction.', set: ['loc_name', 'Boundary 1', 'rename it'] },
  ElmBbone: { name: 'Backbone', cat: 'groups', what: 'A backbone: the main path between feeders in a distribution network, used to study meshing and restoration.', set: ['loc_name', 'Backbone 1', 'rename it'] },
  ElmBmu: { name: 'Virtual Power Plant', cat: 'groups', what: 'A virtual power plant: a group of generators dispatched together towards one active power setpoint.', set: ['loc_name', 'VPP 1', 'rename it'] },

  // ---- Results and data
  ElmRes: { name: 'Results', cat: 'data', what: 'A results object: it stores the variables recorded during a calculation or simulation (chosen with IntMon objects), one column per variable and one row per time step or case.', set: ['loc_name', 'My results', 'rename it'] },
  ElmFile: { name: 'Measurement File', cat: 'data', what: 'A measurement file: it reads a time series from a file and feeds it into a simulation as a signal.', set: ['outserv', 1, 'switch it off'] },

  // ---- Types
  TypLne: { name: 'Line Type', cat: 'types', what: 'A line type: the electrical data shared by every line that uses it, per km (R\', X\', B\'), with the rated voltage and rated current.',
    common: [['uline', 'rated voltage'], ['sline', 'rated current'], ['rline'], ['xline'], ['bline'], ['rline0'], ['xline0'], ['cohl_', 'cable or overhead line'], ['frnom']], set: ['sline', 1.2, 'rated current 1.2 kA'] },
  TypTr2: { name: '2-Winding Transformer Type', cat: 'types', what: 'A 2-winding transformer type: rated power and voltages, short-circuit voltage, losses, vector group and tap changer.',
    common: [['strn', 'rated power'], ['utrn_h'], ['utrn_l'], ['uktr', 'short-circuit voltage'], ['pcutr', 'copper losses'], ['pfe'], ['curmg'], ['tr2cn_h'], ['tr2cn_l'], ['nt2ag', 'phase shift'], ['dutap', 'voltage per tap'], ['nntap0'], ['ntpmn'], ['ntpmx']], set: ['strn', 200.0, 'rated power 200 MVA'] },
  TypTr3: { name: '3-Winding Transformer Type', cat: 'types', what: 'A 3-winding transformer type: rated powers and voltages of the three windings, short-circuit voltages between them, losses and tap changers.',
    common: [['strn3_h', 'rated power, HV winding'], ['strn3_m'], ['strn3_l'], ['utrn3_h', 'rated voltage, HV winding'], ['utrn3_m'], ['utrn3_l'], ['uktr3_h', 'short-circuit voltage HV-MV'], ['uktr3_m']], set: ['strn3_h', 250.0, 'HV rated power 250 MVA'] },
  TypTr4: { name: '4-Winding Transformer Type', cat: 'types', what: 'A 4-winding transformer type: ratings, impedances, losses and tap changers of the four windings.',
    common: [['sn_h0', 'rated power, HV winding'], ['sn_l1'], ['sn_l2'], ['sn_l3'], ['un_h0', 'rated voltage, HV winding'], ['un_l1']], set: ['sn_h0', 300.0, 'HV rated power 300 MVA'] },
  TypSym: { name: 'Synchronous Machine Type', cat: 'types', what: 'A synchronous machine type: rated power and voltage, power factor, the synchronous, transient and subtransient reactances and time constants, and the inertia H.',
    common: [['sgn'], ['ugn'], ['cosn'], ['xd'], ['xq'], ['xds'], ['xdss'], ['tds'], ['tdss'], ['h', 'inertia constant'], ['xl'], ['rstr']], set: ['h', 4.5, 'inertia constant 4.5 s'] },
  TypAsm: { name: 'Asynchronous Machine Type - old', cat: 'types', what: 'An asynchronous machine type in its older form: ratings, impedances and the torque characteristic of an induction machine.',
    common: [['sgn', 'rated power, kVA'], ['ugn'], ['aiazn', 'locked rotor current'], ['tag'], ['xm'], ['xdss'], ['rstr']], set: ['ugn', 6.6, 'rated voltage 6.6 kV'] },
  TypLod: { name: 'General Load Type', cat: 'types', what: 'A general load type: how a load\'s P and Q change with voltage and frequency (the exponents and coefficients of its static model) and its dynamic share.',
    common: [['kpu'], ['kqu'], ['aP'], ['bP'], ['systp'], ['loddy']], set: ['kpu', 2.0, 'voltage exponent e_cP of P'] },
  TypLodlv: { name: 'LV Load Type', cat: 'types', what: 'A low-voltage load type: the data shared by low-voltage loads.',
    common: [['Smax', 'maximum load per customer']], set: ['Smax', 5.0, 'maximum load per customer 5 kVA'] },
  TypSwitch: { name: 'Switch Type', cat: 'types', what: 'A switch type: the ratings of a breaker or switch, such as rated current, breaking current and opening time.',
    common: [['Inom'], ['Ibnom', 'rated breaking current'], ['Ipnom'], ['t_open']], set: ['Ibnom', 40.0, 'rated breaking current 40 kA'] },
  TypTow: { name: 'Tower Type', cat: 'types', what: 'A tower type: the position of each conductor and earth wire on a tower and the conductor types, from which line impedances and couplings are computed.',
    common: [['frnom'], ['rearth', 'earth resistivity'], ['gearth'], ['xy_c', 'circuit coordinates'], ['xy_e']], set: ['rearth', 100.0, 'earth resistivity 100 Ohm*m'] },
  TypGeo: { name: 'Tower Geometry Type', cat: 'types', what: 'A tower geometry type: the coordinates of the conductors on a tower, without the conductor data.',
    common: [['xy_cc', 'circuit coordinates'], ['xy_e', 'earth wire coordinates']], set: ['loc_name', 'Geometry A', 'rename the type'] },

  // ---- Events
  EvtShc: { name: 'Short-Circuit Event', cat: 'events', what: 'A short-circuit event: it applies (or clears) a fault on a terminal or a line at a set time of an RMS or EMT simulation.',
    common: [['p_target', 'the terminal or line'], ['time', 'when, in seconds'], ['i_shc', 'fault type'], ['R_f'], ['X_f'], ['i_clearShc'], ['outserv']] },
  EvtSwitch: { name: 'Switch Event', cat: 'events', what: 'A switch event: it opens or closes a breaker, or switches a whole element, at a set time of a simulation.',
    common: [['p_target', 'breaker or element'], ['time'], ['i_switch', 'open or close'], ['i_allph'], ['outserv']] },
  EvtParam: { name: 'Parameter Event', cat: 'events', what: 'A parameter event: it sets any input parameter of an element (a setpoint, a gain) to a new value at a set time of a simulation.',
    common: [['p_target'], ['time'], ['variable', 'parameter name'], ['value', 'new value, as text']] },
  EvtLod: { name: 'Load Event', cat: 'events', what: 'A load event: it steps or ramps the active and reactive power of a load, in percent, at a set time of a simulation.',
    common: [['p_target'], ['time'], ['iopt_type'], ['dP', 'change of P, %'], ['dQ']] },
  EvtGen: { name: 'Dispatch Event', cat: 'events', what: 'A dispatch event: it changes the active and reactive power of a generator at a set time of a simulation.',
    common: [['p_target'], ['time'], ['dP', 'change of P, MW'], ['dQ']] },
  EvtOutage: { name: 'Outage Event', cat: 'events', what: 'An outage event: it takes an element out of service (or brings it back) at a set time of a simulation.',
    common: [['p_target'], ['time'], ['i_what']] },
  EvtTap: { name: 'Tap Event', cat: 'events', what: 'A tap event: it moves the tap of a transformer or a shunt at a set time of a simulation.',
    common: [['p_target'], ['time'], ['ntap']] },
  EvtSym: { name: 'Synchronous Machine Event', cat: 'events', what: 'A synchronous machine event: at a set time of a simulation it adds mechanical torque to a synchronous machine, changes its maximum apparent power, or takes some of its parallel machines out.',
    common: [['p_target'], ['time'], ['addmt', 'additional torque'], ['newS'], ['outNgnum', 'parallel machines on outage']] },
};

// The study groups of a result file, in page order, with their heading and short name.
export const GROUPS = [
  ['load_flow', 'Load flow results', 'ComLdf'],
  ['short_circuit', 'Short-circuit results', 'ComShc'],
  ['dynamic_rms', 'RMS simulation results', 'ComInc and ComSim, RMS'],
  ['dynamic_emt', 'EMT simulation results', 'ComInc and ComSim, EMT'],
  ['load_flow_dc', 'DC load flow results', 'ComLdf, DC'],
  ['modal_analysis', 'Modal analysis results', 'ComMod'],
  ['opf', 'Optimal power flow results', 'ComOpf'],
  ['basic', 'Basic data', ''],
];
// Clearer words for a few descriptions PowerFactory gives as a dialog label only.
export const DESC_OVERRIDES = {
  'e:time': 'Execution time (absolute)', 'e:mtime': 'Execution time (absolute, in minutes)', 'e:hrtime': 'Execution time (absolute, in hours)',
  'e:dtime': 'Execution time (relative to now)', 'e:dmtime': 'Execution time (relative to now, in minutes)', 'e:dhrtime': 'Execution time (relative to now, in hours)',
  'e:tact': 'Now (current simulation time)', 'e:mtact': 'Now (current simulation time, in minutes)', 'e:hrtact': 'Now (current simulation time, in hours)',
};
export const PREFIX_WORDS = {
  e: 'Input parameter (element data)', m: 'Currents, voltages and powers', c: 'Calculation parameter', n: 'Bus result at a terminal',
  s: 'Signal (state or model variable)', b: 'Basic data (derived from the input)', r: 'Reference parameter', t: 'Type parameter, read through the element',
};
