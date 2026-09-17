/* ================================================================
   PRE-MADE CUSTOM FUNCTIONS
   ----------------------------------------------------------------
   Ready-to-use bodies for an Output Variable of type
   "Custom Calculation". The picker above each custom function editor
   (script.js → buildOutputVarHTML) and the library section on the
   Samples & Guides page (samples/index.html) both render from this
   file, so a function is written once and shown in both places.

   Rules every entry follows, the same rules a user-written function
   must follow:
     1. One top-level `def`, and it returns exactly ONE scalar
        (a number, a string, a bool, or None). Never a tuple.
     2. Arguments are named after Input Variables or Scalar/Timeseries
        Output Variables, or an earlier Custom Calculation. The generated
        script passes _row.get("<arg name>", None) from the result row, so
        an argument that does not match a variable name arrives as None.
     3. Every argument is None-checked and every division is guarded.
        The whole result row is discarded if the function raises.
     4. Anything a user would want to change (a limit, a price, a
        rating) is an UPPER_CASE constant on the first lines of the
        body, not a magic number buried in the maths.

   Entry schema
     id       : kebab-case key, unique
     fnName   : the Python function name (matches the `def` line)
     label    : short name shown in the picker
     category : picker <optgroup> and samples-page grouping
     summary  : one line, what it returns and when to use it
     returns  : what lands in the CSV column
     args     : [{ name, hint }], hint says which PF attribute to feed it
     tune     : constants the user is expected to edit (display only)
     study    : which Study Type it suits
     code     : the Python body, inserted into the editor verbatim
================================================================ */

const CUSTOM_FN_LIBRARY = [

  /* ── FLAGS AND VERDICTS ──────────────────────────────────────── */
  {
    id: 'overload-flag',
    fnName: 'overload_flag',
    label: 'Overloading flag',
    category: 'Flags and verdicts',
    summary: 'Flags a branch that is loaded past its limit, so overloaded cases can be filtered in the CSV.',
    returns: 'True / False, or blank when the element could not be read',
    study: 'Any',
    tune: ['LIMIT_PCT'],
    args: [
      { name: 'loading_pct', hint: 'Scalar output of c:loading (%) on an ElmLne, ElmTr2 or ElmTr3' }
    ],
    code: `def overload_flag(loading_pct):
    """True when the branch is loaded above its limit.

    loading_pct : Scalar output of c:loading (%), e.g. on an ElmLne or ElmTr2.
    Returns None when the element could not be read, for example a line that
    is out of service in the contingency case being run.
    """
    LIMIT_PCT = 100.0

    if loading_pct is None:
        return None
    return float(loading_pct) > LIMIT_PCT`
  },

  {
    id: 'voltage-band',
    fnName: 'voltage_band',
    label: 'Voltage violation band',
    category: 'Flags and verdicts',
    summary: 'Sorts a busbar voltage into UNDERVOLTAGE, NORMAL or OVERVOLTAGE against a statutory band.',
    returns: '"UNDERVOLTAGE" / "NORMAL" / "OVERVOLTAGE"',
    study: 'Any',
    tune: ['V_MIN_PU', 'V_MAX_PU'],
    args: [
      { name: 'bus_voltage_pu', hint: 'Scalar output of m:u (pu) on an ElmTerm' }
    ],
    code: `def voltage_band(bus_voltage_pu):
    """Which side of the statutory voltage band a busbar sits on.

    bus_voltage_pu : Scalar output of m:u (pu) on an ElmTerm.
    Edit the two limits to match the band that applies at this voltage level.
    """
    V_MIN_PU = 0.9
    V_MAX_PU = 1.1

    if bus_voltage_pu is None:
        return "NO READ"
    voltage = float(bus_voltage_pu)
    if voltage < V_MIN_PU:
        return "UNDERVOLTAGE"
    if voltage > V_MAX_PU:
        return "OVERVOLTAGE"
    return "NORMAL"`
  },

  {
    id: 'contingency-verdict',
    fnName: 'contingency_verdict',
    label: 'Contingency verdict (thermal + voltage)',
    category: 'Flags and verdicts',
    summary: 'Collapses a thermal check and a voltage check into one verdict per contingency, so an N-1 table can be read at a glance.',
    returns: '"SECURE" / "THERMAL" / "VOLTAGE" / "THERMAL+VOLTAGE"',
    study: 'Steady State',
    tune: ['LIMIT_PCT', 'V_MIN_PU', 'V_MAX_PU'],
    args: [
      { name: 'loading_pct',    hint: 'Scalar output of c:loading (%) on the branch you are watching' },
      { name: 'min_voltage_pu', hint: 'Scalar output of m:u (pu) on the weakest busbar' },
      { name: 'max_voltage_pu', hint: 'Scalar output of m:u (pu) on the busbar that runs highest' }
    ],
    code: `def contingency_verdict(loading_pct, min_voltage_pu, max_voltage_pu):
    """One security verdict per case, from a thermal and a voltage check.

    Each argument must be an output that points at a single element. A
    wildcard output such as *.ElmLne is written to the CSV as one column per
    element, so it cannot be passed into a custom function.
    """
    LIMIT_PCT = 100.0
    V_MIN_PU  = 0.9
    V_MAX_PU  = 1.1

    if loading_pct is None or min_voltage_pu is None or max_voltage_pu is None:
        return "NO READ"

    thermal = float(loading_pct) > LIMIT_PCT
    voltage = float(min_voltage_pu) < V_MIN_PU or float(max_voltage_pu) > V_MAX_PU

    if thermal and voltage:
        return "THERMAL+VOLTAGE"
    if thermal:
        return "THERMAL"
    if voltage:
        return "VOLTAGE"
    return "SECURE"`
  },

  {
    id: 'frt-verdict',
    fnName: 'frt_verdict',
    label: 'Fault ride-through verdict',
    category: 'Flags and verdicts',
    summary: 'Checks a fault ride-through run against a voltage floor and a recovery time limit.',
    returns: '"PASS" / "FAIL VOLTAGE" / "FAIL RECOVERY" / "CHECK HOLD TIME"',
    study: 'Dynamic RMS',
    tune: ['FAULT_TIME_S', 'V_FLOOR_PU', 'RECOVER_LIMIT_S'],
    args: [
      { name: 'min_voltage_pu',  hint: 'Timeseries output, metric Minimum, of m:u (pu) at the connection point' },
      { name: 'recovery_time_s', hint: 'Timeseries output, metric Time Settle, of the same m:u signal (Reference 1.0, Band 0.1, Hold Time longer than the pre-fault window)' }
    ],
    code: `def frt_verdict(min_voltage_pu, recovery_time_s):
    """Pass or fail a fault ride-through run at one connection point.

    min_voltage_pu  : Timeseries "Minimum" of the POC voltage (m:u, pu).
    recovery_time_s : Timeseries "Time Settle" of the same signal, with
                      Reference Value 1.0 and Settle Band 0.1. Set the Hold
                      Time longer than the pre-fault window, otherwise the
                      pre-fault steady state satisfies the band on its own
                      and the metric returns a time before the fault.
    """
    FAULT_TIME_S    = 0.1     # simulation time the fault is applied
    V_FLOOR_PU      = 0.0     # voltage the plant must stay connected through
    RECOVER_LIMIT_S = 0.43    # seconds after the fault to get back into the band

    if min_voltage_pu is None or recovery_time_s is None:
        return "NO READ"
    if float(min_voltage_pu) < V_FLOOR_PU:
        return "FAIL VOLTAGE"
    if recovery_time_s != recovery_time_s:        # NaN: never settled
        return "FAIL RECOVERY"

    recovery = float(recovery_time_s) - FAULT_TIME_S
    if recovery < 0.0:                            # settled before the fault
        return "CHECK HOLD TIME"
    if recovery > RECOVER_LIMIT_S:
        return "FAIL RECOVERY"
    return "PASS"`
  },

  /* ── MARGINS AND HEADROOM ────────────────────────────────────── */
  {
    id: 'worst-bus-voltage',
    fnName: 'worst_bus_voltage',
    label: 'Worst bus voltage of a group',
    category: 'Margins and headroom',
    summary: 'Returns the monitored voltage furthest from nominal, turning several bus columns into one column to sort on.',
    returns: 'The pu voltage of the worst bus',
    study: 'Any',
    tune: ['V_NOM_PU'],
    args: [
      { name: 'voltage_1_pu', hint: 'Scalar output of m:u (pu) on the first busbar' },
      { name: 'voltage_2_pu', hint: 'Scalar output of m:u (pu) on the second busbar' },
      { name: 'voltage_3_pu', hint: 'Scalar output of m:u (pu) on the third busbar' }
    ],
    code: `def worst_bus_voltage(voltage_1_pu, voltage_2_pu, voltage_3_pu):
    """The monitored voltage that sits furthest from nominal.

    Add or remove arguments to match how many busbars you monitor, keeping
    each argument name equal to an Output Variable name. Returns the voltage
    itself, so the sign tells you whether the worst bus is high or low.
    """
    V_NOM_PU = 1.0

    readings = [float(v) for v in (voltage_1_pu, voltage_2_pu, voltage_3_pu)
                if v is not None]
    if not readings:
        return None
    return max(readings, key=lambda v: abs(v - V_NOM_PU))`
  },

  {
    id: 'thermal-headroom',
    fnName: 'thermal_headroom_mw',
    label: 'Thermal headroom (MW)',
    category: 'Margins and headroom',
    summary: 'How many more MW a branch can carry before it hits its rating, from the flow and the loading of the same case.',
    returns: 'MW of headroom, negative once the branch is already overloaded',
    study: 'Steady State',
    tune: ['LIMIT_PCT'],
    args: [
      { name: 'flow_mw',     hint: 'Scalar output of m:P:bus1 (MW) on the branch' },
      { name: 'loading_pct', hint: 'Scalar output of c:loading (%) on the same branch' }
    ],
    code: `def thermal_headroom_mw(flow_mw, loading_pct):
    """MW that can still be added to a branch before it reaches its limit.

    Scales the present flow by the present loading, so it assumes the extra
    MW arrives at the same power factor as the flow already on the branch.
    """
    LIMIT_PCT = 100.0

    if flow_mw is None or loading_pct is None:
        return None
    loading = float(loading_pct)
    if loading <= 0.0:
        return None
    return abs(float(flow_mw)) * (LIMIT_PCT / loading - 1.0)`
  },

  {
    id: 'frequency-margin',
    fnName: 'frequency_margin_hz',
    label: 'Frequency nadir margin (Hz)',
    category: 'Margins and headroom',
    summary: 'Hz between the frequency nadir of a run and the first load-shedding stage.',
    returns: 'Hz of margin, negative when the nadir goes below the stage',
    study: 'Dynamic RMS',
    tune: ['NOMINAL_HZ', 'UFLS_HZ'],
    args: [
      { name: 'min_frequency_pu', hint: 'Timeseries output, metric Minimum, of a pu frequency or speed signal (ElmSym s:fe or s:xspeed)' }
    ],
    code: `def frequency_margin_hz(min_frequency_pu):
    """Distance from the frequency nadir down to the first UFLS stage.

    min_frequency_pu : Timeseries "Minimum" of a pu frequency signal, e.g.
                       ElmSym s:fe. A positive result means the nadir stayed
                       above the stage; a negative result means shedding.
    """
    NOMINAL_HZ = 50.0
    UFLS_HZ    = 49.0

    if min_frequency_pu is None:
        return None
    return float(min_frequency_pu) * NOMINAL_HZ - UFLS_HZ`
  },

  /* ── DERIVED QUANTITIES ──────────────────────────────────────── */
  {
    id: 'power-factor',
    fnName: 'power_factor',
    label: 'Power factor from MW and Mvar',
    category: 'Derived quantities',
    summary: 'Displacement power factor of any element that reports an MW and a Mvar value.',
    returns: 'cos phi between 0 and 1',
    study: 'Any',
    tune: [],
    args: [
      { name: 'active_power_mw',    hint: 'Scalar output of m:P:bus1 (MW)' },
      { name: 'reactive_power_mvar', hint: 'Scalar output of m:Q:bus1 (Mvar) on the same element and terminal' }
    ],
    code: `def power_factor(active_power_mw, reactive_power_mvar):
    """Displacement power factor, 0 to 1, from an MW and a Mvar reading.

    Both readings must come from the same element and the same terminal, so
    m:P:bus1 pairs with m:Q:bus1. Sign is dropped: 0.95 lagging and 0.95
    leading both return 0.95.
    """
    if active_power_mw is None or reactive_power_mvar is None:
        return None
    p = float(active_power_mw)
    q = float(reactive_power_mvar)
    s = (p * p + q * q) ** 0.5
    if s == 0.0:
        return None
    return abs(p) / s`
  },

  {
    id: 'mva-utilisation',
    fnName: 'mva_utilisation_pct',
    label: 'MVA utilisation of a rating (%)',
    category: 'Derived quantities',
    summary: 'Apparent power of an element as a percentage of a rating you type in, for elements that do not report c:loading.',
    returns: 'Percent of the rating',
    study: 'Any',
    tune: ['RATING_MVA'],
    args: [
      { name: 'active_power_mw',     hint: 'Scalar output of m:P:bus1 (MW)' },
      { name: 'reactive_power_mvar', hint: 'Scalar output of m:Q:bus1 (Mvar) on the same element and terminal' }
    ],
    code: `def mva_utilisation_pct(active_power_mw, reactive_power_mvar):
    """Apparent power as a percentage of the rating typed in below.

    Useful where no c:loading exists, for example a static generator or an
    interface where the rating is a commercial limit rather than an
    equipment rating.
    """
    RATING_MVA = 100.0

    if active_power_mw is None or reactive_power_mvar is None:
        return None
    if RATING_MVA == 0.0:
        return None
    p = float(active_power_mw)
    q = float(reactive_power_mvar)
    return 100.0 * (p * p + q * q) ** 0.5 / RATING_MVA`
  },

  {
    id: 'loss-percent',
    fnName: 'loss_percent',
    label: 'Losses as a percentage of generation',
    category: 'Derived quantities',
    summary: 'Network losses divided by total generation, so cases with different dispatch can be compared fairly.',
    returns: 'Percent of generation lost',
    study: 'Steady State',
    tune: [],
    args: [
      { name: 'losses_mw',     hint: 'Scalar output of c:LossP (MW) on the grid ElmNet' },
      { name: 'generation_mw', hint: 'Scalar output of c:GenP (MW) on the same ElmNet, or an input variable holding total dispatch' }
    ],
    code: `def loss_percent(losses_mw, generation_mw):
    """Network losses as a percentage of total generation.

    A raw MW loss figure favours the lightly loaded cases in a sweep. The
    percentage puts every dispatch on the same footing.
    """
    if losses_mw is None or generation_mw is None:
        return None
    generation = float(generation_mw)
    if generation == 0.0:
        return None
    return 100.0 * float(losses_mw) / generation`
  },

  {
    id: 'voltage-unbalance',
    fnName: 'voltage_unbalance_pct',
    label: 'Voltage unbalance factor (%)',
    category: 'Derived quantities',
    summary: 'Negative-sequence over positive-sequence voltage at a busbar, the IEC voltage unbalance factor.',
    returns: 'Percent unbalance',
    study: 'Steady State (unbalanced)',
    tune: [],
    args: [
      { name: 'negative_seq_voltage', hint: 'Scalar output of m:u2 (pu) on an ElmTerm, from an unbalanced load flow' },
      { name: 'positive_seq_voltage', hint: 'Scalar output of m:u1 (pu) on the same ElmTerm' }
    ],
    code: `def voltage_unbalance_pct(negative_seq_voltage, positive_seq_voltage):
    """Voltage unbalance factor, U2 / U1 in percent.

    Both readings come from an unbalanced load flow, so tick the unbalanced
    option in the ComLdf command before running the generated script.
    """
    if negative_seq_voltage is None or positive_seq_voltage is None:
        return None
    u1 = float(positive_seq_voltage)
    if u1 == 0.0:
        return None
    return 100.0 * float(negative_seq_voltage) / u1`
  },

  {
    id: 'angle-difference',
    fnName: 'angle_difference_deg',
    label: 'Voltage angle difference (deg)',
    category: 'Derived quantities',
    summary: 'Angle across a branch or an interface, wrapped to plus or minus 180 degrees, as a stress and synchronising check.',
    returns: 'Degrees, signed',
    study: 'Any',
    tune: [],
    args: [
      { name: 'angle_from_deg', hint: 'Scalar output of m:phiu (deg) on the sending busbar' },
      { name: 'angle_to_deg',   hint: 'Scalar output of m:phiu (deg) on the receiving busbar' }
    ],
    code: `def angle_difference_deg(angle_from_deg, angle_to_deg):
    """Voltage angle across a branch or interface, wrapped to +/-180 degrees.

    The wrap keeps the result readable when the two busbar angles sit either
    side of the +/-180 degree wrap point.
    """
    if angle_from_deg is None or angle_to_deg is None:
        return None
    difference = float(angle_from_deg) - float(angle_to_deg)
    return (difference + 180.0) % 360.0 - 180.0`
  },

  /* ── COST AND SIZING ─────────────────────────────────────────── */
  {
    id: 'annual-loss-cost',
    fnName: 'annual_loss_cost',
    label: 'Annual cost of losses',
    category: 'Cost and sizing',
    summary: 'Prices the losses of each case over a year, so a loss sweep can be compared in money rather than MW.',
    returns: 'Currency per year',
    study: 'Steady State',
    tune: ['HOURS_PER_YEAR', 'LOSS_LOAD_FACTOR', 'ENERGY_PRICE'],
    args: [
      { name: 'losses_mw', hint: 'Scalar output of c:LossP (MW) on the grid ElmNet' }
    ],
    code: `def annual_loss_cost(losses_mw):
    """Yearly cost of the losses at this operating point.

    The loss load factor scales the losses of this one case to an annual
    average, because losses fall with the square of loading and this case is
    usually a peak. Set all three constants to your own study assumptions.
    """
    HOURS_PER_YEAR   = 8760.0
    LOSS_LOAD_FACTOR = 0.35     # annual average losses / losses in this case
    ENERGY_PRICE     = 80.0     # currency per MWh

    if losses_mw is None:
        return None
    return float(losses_mw) * HOURS_PER_YEAR * LOSS_LOAD_FACTOR * ENERGY_PRICE`
  },

  {
    id: 'capacitor-sizing',
    fnName: 'capacitor_mvar_for_target_pf',
    label: 'Capacitor size for a target power factor',
    category: 'Cost and sizing',
    summary: 'Shunt capacitor rating that lifts an element from its present power factor to the target.',
    returns: 'Mvar to install, 0 when the target is already met',
    study: 'Steady State',
    tune: ['TARGET_PF'],
    args: [
      { name: 'active_power_mw',     hint: 'Scalar output of m:P:bus1 (MW)' },
      { name: 'reactive_power_mvar', hint: 'Scalar output of m:Q:bus1 (Mvar) on the same element and terminal' }
    ],
    code: `def capacitor_mvar_for_target_pf(active_power_mw, reactive_power_mvar):
    """Shunt capacitor rating needed to reach the target power factor.

    Q_capacitor = P * (tan(acos(pf_now)) - tan(acos(pf_target))), written as
    the Mvar above the target rather than the change in angle. Returns 0.0
    when the point already sits at or above the target.
    """
    import math

    TARGET_PF = 0.95

    if active_power_mw is None or reactive_power_mvar is None:
        return None
    p = abs(float(active_power_mw))
    q = float(reactive_power_mvar)
    if p == 0.0:
        return 0.0
    q_at_target = p * math.tan(math.acos(TARGET_PF))
    return max(0.0, q - q_at_target)`
  }
];

/* Categories in picker / samples-page order. */
const CUSTOM_FN_CATEGORIES = [
  'Flags and verdicts',
  'Margins and headroom',
  'Derived quantities',
  'Cost and sizing'
];

if (typeof window !== 'undefined') {
  window.CUSTOM_FN_LIBRARY    = CUSTOM_FN_LIBRARY;
  window.CUSTOM_FN_CATEGORIES = CUSTOM_FN_CATEGORIES;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CUSTOM_FN_LIBRARY, CUSTOM_FN_CATEGORIES };
}
