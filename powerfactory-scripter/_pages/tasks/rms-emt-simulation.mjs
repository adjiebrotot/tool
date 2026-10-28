// Guide: RMS and EMT simulations in PowerFactory with Python, run in batches and plotted.
export default async function ({ results, script, builderScript, builderBlock, pre, esc }) {
  const runs = results('rms_batch').data.runs;
  const emt = results('emt_run');
  const { lineChart, table } = await import('../lib.mjs');
  const f = (v, d) => Number(v).toFixed(d);
  const b = await builderScript('rms-batch', ({ set, EL }) => {
    set('n1', { project: '39 Bus New England System', studyCase: '2.3 Simulation Fault Bus 31 Stable' });
    set('n4', { target: EL('ElmTerm', 'Bus 31') });
  });
  // The curves, every second sample (0.02 s): plenty for a page-wide chart.
  const thin = (a) => a.filter((_, i) => i % 2 === 0 || i === a.length - 1);
  const stable = runs.filter(r => r.Stable), lost = runs.filter(r => !r.Stable);
  const w = emt.data;
  const win = w.t.map((t, i) => [t, i]).filter(([t], i) => t >= 0.15 && t <= 0.4 && i % 2 === 0);
  return {
    slug: 'rms-emt-simulation', crumb: 'RMS and EMT simulation', card: 'RMS and EMT simulation batch runs', short: 'a batch of dynamic simulations',
    title: 'PowerFactory RMS and EMT simulation with Python (ComSim)',
    h1: 'RMS and EMT simulations in PowerFactory with Python: batch runs and plots',
    desc: 'Run PowerFactory RMS and EMT simulations from Python with ComInc and ComSim, in a batch, record curves in ElmRes and plot them. Tested scripts.',
    lead: `A dynamic simulation in Python is two commands: <code>ComInc</code> computes the initial conditions and <code>ComSim</code> runs to <code>tstop</code>. Record variables in a results object with <code>ElmRes.AddVariable</code> and read the curves back with <code>FindColumn</code> and <code>GetValue</code>. On the 39-bus example, four runs of one fault cleared after 0.10 to 0.25 s show the <strong>critical clearing time lies between ${f(stable[stable.length - 1]['Clearing time (s)'], 2)} and ${f(lost[0]['Clearing time (s)'], 2)} s</strong>.`,
    whatTitle: 'What RMS and EMT simulations are',
    qs: 'rms-batch', qsTitle: 'RMS runs for several fault durations',
    refs: ['ElmRes', 'EvtShc', 'EvtSwitch', 'ElmSym', 'ElmTerm', 'ElmDsl'],
    level: 'Intermediate',
    keywords: ['powerfactory ComSim python', 'PowerFactory RMS simulation Python', 'PowerFactory EMT simulation Python', 'ComInc', 'ElmRes AddVariable', 'GetValue', 'critical clearing time', 'batch simulation'],
    about: ['RMS simulation', 'EMT simulation', 'Transient stability', 'DIgSILENT PowerFactory', 'Python'],
    sections: {
      what: `  <p>Both are time-domain simulations run by the same two commands, and differ in what they model:</p>
  <ul class="dx-prose">
    <li><strong>RMS</strong> (<code>iopt_sim = "rms"</code>) solves the network as phasors at the fundamental frequency, with time steps of milliseconds. It is the tool for electromechanical behaviour over seconds to minutes: rotor angle stability, frequency after a trip, voltage recovery, controller tuning.</li>
    <li><strong>EMT</strong> (<code>iopt_sim = "ins"</code>, instantaneous values) solves the instantaneous voltages and currents of every phase, with time steps of microseconds. It shows switching transients, fault waveforms with DC offset, harmonics and fast converter control.</li>
  </ul>
  <p>In both, <code>ComInc</code> computes the initial conditions from a load flow, the study case's events (<code>EvtShc</code>, <code>EvtSwitch</code> and others in the event list <code>IntEvt</code>) disturb the system, and <code>ComSim</code> runs it to the stop time. What is recorded goes to a results object, <a href="../../reference/ElmRes/"><code>ElmRes</code></a>. A batch is a loop around them: one run per clearing time, fault location, dispatch or setting.</p>`,
      method: `  <ol class="dx-steps">
    <li><strong>Activate a study case with dynamic models</strong>, and the events you need (here, the case's own fault at Bus 31 and its clearing).</li>
    <li><strong>Make a results object</strong> in the study case and add what to record: <code>res.AddVariable(obj, "c:firel")</code> for a rotor angle, <code>"m:fehz"</code> for a busbar frequency, <code>"m:u:A"</code> for an EMT phase voltage. Point <code>ComInc</code>'s <code>p_resvar</code> to it.</li>
    <li><strong>Set the simulation</strong>: <code>iopt_sim</code> <code>"rms"</code> or <code>"ins"</code> on <code>ComInc</code>, <code>tstop</code> on <code>ComSim</code>, in seconds after <code>app.SetAttributeModeInternal(1)</code>.</li>
    <li><strong>For each run</strong>, change what the batch varies (the clearing event's <code>time</code>), run <code>ComInc</code> (it must return 0) and then <code>ComSim</code>. <code>sim.GetSimulationTime()</code> below <code>tstop</code> means the run stopped early.</li>
    <li><strong>Read the curves</strong>: <code>res.Load()</code>, <code>FindColumn(obj, variable)</code>, <code>GetValue(row, column)</code> (column -1 is time), then <code>res.Release()</code>.</li>
    <li><strong>Put the case back</strong> (settings, event times, <code>p_resvar</code>), reset the calculation, delete the results object, and plot.</li>
  </ol>
  <h3>The RMS batch script</h3>
  ${pre(script('rms_batch'), '<code>rms_batch.py</code>')}
  <h3>Result: four clearing times on the 39-bus example</h3>
  <p>The bolted fault at Bus 31 (the terminal of generator G 02) is cleared after 0.10, 0.15, 0.20 and 0.25 s. The rotor angle spread is the largest minus the smallest rotor angle of the ten generators. Cleared after up to ${f(stable[stable.length - 1]['Clearing time (s)'], 2)} s, the swing peaks at ${f(stable[stable.length - 1]['Peak spread (deg)'], 1)} degrees and dies away; cleared after ${f(lost[0]['Clearing time (s)'], 2)} s, the spread runs up to ${f(lost[0]['Peak spread (deg)'], 0)} degrees, where the angle wraps round: a pole slip. The example's own study cases put the critical clearing time between 0.21 s (stable) and 0.23 s (unstable).</p>
  ${lineChart({ title: 'Rotor angle spread of the 39-bus example after a fault at Bus 31, for four clearing times', series: runs.map((r, i) => ({ name: `Cleared after ${f(r['Clearing time (s)'], 2)} s`, c: i + 1, pts: thin(r.t.map((t, k) => [t, Math.min(r.spread[k], 400)])) })), x: { label: 'Time', unit: 's', min: 0, max: 5 }, y: { label: 'Rotor angle spread', unit: 'deg', min: 0, max: 400 }, limits: [{ y: 180, label: '180 deg', legend: 'Stability limit, 180 deg' }], caption: 'RMS simulation, 0.01 s steps, recorded with c:firel of every ElmSym. The script\'s own PNG draws the same curves with matplotlib in these colours.' })}
  ${table([{ h: 'Clearing time', unit: 's', num: true, fn: x => f(x['Clearing time (s)'], 2) }, { h: 'Peak rotor angle spread', unit: 'deg', num: true, fn: x => f(x['Peak spread (deg)'], 1) }, { h: 'Result', fn: x => (x.Stable ? 'stable' : 'loses synchronism') }], runs)}
  <h3>An EMT run</h3>
  <p>The same API runs an EMT simulation: set <code>iopt_sim</code> to <code>"ins"</code> and record instantaneous phase quantities. This runs the 39-bus example's own EMT case (a two-phase fault at Bus 03 at 0.2 s, three breakers opening at 0.3 s) for 0.5 s and reads the three phase voltages of Bus 03: ${emt.stdout[0].split(';')[0]}, in ${f(emt.seconds, 0)} s.</p>
  ${pre(script('emt_run'), '<code>emt_run.py</code>')}
  ${lineChart({ title: 'EMT phase voltages of Bus 03 of the 39-bus example around a two-phase fault', series: ['A', 'B', 'C'].map((p, i) => ({ name: `Phase ${p}`, c: i + 1, pts: win.map(([t, k]) => [t, w.wave[p][k]]) })), x: { label: 'Time', unit: 's', min: 0.15, max: 0.4 }, y: { label: 'Phase voltage', unit: 'p.u.', min: -1.2, max: 1.2 }, caption: 'Recorded with m:u:A, m:u:B and m:u:C every 10 µs; drawn every 0.8 ms. From 0.2 s phases A and B are shorted together, so they carry the same voltage and their curves lie on top of each other; when the breakers open at the next current zero after 0.3 s, the busbar is dead.' })}`,
      builder: builderBlock(b,
        'The Builder\'s Quick Start makes the same batch from blocks: a list of fault durations, a short circuit added at the busbar, an RMS run, the peak spread and a check, with every run drawn on one graph. On the 39-bus example it gives the same peaks within 2 degrees and the same unstable run. This is its file for the example (the fault at Bus 31):',
        [
          '<strong>Step 2</strong> loops over <code>FAULT_DURATION_VALUES</code> (0.1, 0.15, 0.2 and 0.25 s).',
          '<strong>Step 3</strong>, <code>add_short_circuit</code>, puts a three-phase fault at <code>FAULT_TARGET</code> at 1 s and its clearing (an <code>EvtShc</code> with <code>i_shc</code> 4) after the pass\'s duration; while the workflow\'s own events run, the study case\'s events are switched off.',
          '<strong>Step 4</strong>, <code>run_rms</code>, makes a temporary results object, records the rotor angle spread of every <code>ElmSym</code>, runs <code>ComInc</code> and <code>ComSim</code> to 5 s, reads the curve with <code>GetColumnValues</code> and puts every setting back.',
          '<strong>Step 5</strong> checks the spread against <code>ROTOR_ANGLE_SPREAD_HI</code> (180 degrees); a run that stops early goes on to the check too. <strong>Step 6</strong> adds the row, with the curve\'s peak from the Peak block.',
          '<strong>Step 7</strong> collects one curve per pass and draws them together as a PNG when the loop ends.',
        ], 'rms_runs_for_several_fault_durations.py'),
      pitfalls: [
        '<strong>Times are in the unit the project shows.</strong> <code>SetAttribute("tstop", 5)</code> means 5 ms in a project that shows milliseconds. Call <code>app.SetAttributeModeInternal(1)</code> to write seconds, and set it back to 0.',
        '<strong>Events must be in the event list <code>ComInc</code> reads</strong>, <code>inc.GetAttribute("p_event")</code>. An event made anywhere else does nothing.',
        '<strong>A fault is cleared by a second <code>EvtShc</code></strong> with <code>i_shc</code> 4 at the clearing time. Its <code>i_clearShc</code> option does not clear a fault in an RMS or EMT run.',
        '<strong>Run <code>ComInc</code> before every <code>ComSim</code></strong> and check it returned 0: after a failed initialisation there is nothing valid to simulate, so record the run as failed and go on.',
        '<strong>A run can stop early</strong> when a machine loses synchronism or the solution fails. Compare <code>sim.GetSimulationTime()</code> with <code>tstop</code> and keep the run as a result.',
        '<strong>Unbalanced faults need an unbalanced run.</strong> A balanced RMS simulation applies a single-phase fault as a three-phase one; set <code>iopt_net</code> on <code>ComInc</code> to <code>"rst"</code>.',
        '<strong>Reading is slow value by value.</strong> <code>GetValue</code> is fine for a few curves; for many, <code>GetColumnValues</code> into an <code>IntVec</code> reads a whole column at once.',
        '<strong>Clean up</strong>: <code>ResetCalculation()</code>, then delete the results object you made, and put <code>p_resvar</code> and the event times back.',
      ],
      faq: [
        ['How do I run an RMS simulation in PowerFactory with Python?', 'Get <code>ComInc</code> and <code>ComSim</code> with <code>app.GetFromStudyCase</code>, set <code>iopt_sim</code> to <code>"rms"</code> on <code>ComInc</code> and <code>tstop</code> on <code>ComSim</code>, then call <code>inc.Execute()</code> and <code>sim.Execute()</code>.'],
        ['How do I run an EMT simulation in PowerFactory with Python?', 'The same two commands with <code>iopt_sim</code> set to <code>"ins"</code> (instantaneous values); record phase variables such as <code>m:u:A</code>.'],
        ['How do I read simulation results in Python?', 'Add variables to an <code>ElmRes</code> with <code>AddVariable</code> before the run. After it, call <code>Load()</code>, find a column with <code>FindColumn(obj, variable)</code>, read rows with <code>GetValue(row, column)</code> (column -1 is time) and call <code>Release()</code>.'],
        ['How do I find the critical clearing time with a script?', 'Run the fault with longer and longer clearing times and check the rotor angle spread, or search the edge between stable and unstable by halving the gap. The Builder\'s "Critical clearing time" Quick Start does the search.'],
      ],
    },
  };
}
