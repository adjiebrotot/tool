// Guide: fault studies. Fault ride through over durations (frt) and the critical clearing time
// by bisection (cct).
export default async function ({ builderScript, builderBlock, builderExtra, pre }) {
  const frt = await builderScript('frt', ({ set }) => set('n1', {
    project: 'C:/Studies/wind_farm/wind_farm.pscx',
  }));
  const cct = await builderScript('cct', ({ set }) => set('n1', {
    project: 'C:/Studies/plant/plant.pscx',
  }));

  return {
    slug: 'fault-studies', crumb: 'Fault studies',
    card: 'Fault studies in PSCAD with Python: ride through and critical clearing time',
    title: 'PSCAD fault studies with Python: fault ride through and critical clearing time',
    h1: 'Fault ride through and critical clearing time in PSCAD with Python',
    desc: 'Script PSCAD fault studies in Python: time a fault from a script, run fault ride through over fault durations, and find the critical clearing time by bisection.',
    lead: 'A fault study in PSCAD is a loop around a fault that is <strong>already drawn in the case</strong>: the script writes when it starts and how long it lasts, runs the case, and reads how the voltage dipped and the machines swung. Do that over a range of durations and it is a fault ride through study; halve the gap between a duration that passes and one that fails and it is a critical clearing time.',
    whatTitle: 'How a fault is applied from a script',
    qsTitle: 'Fault ride through over fault durations',
    level: 'Intermediate',
    keywords: ['pscad fault ride through python', 'pscad critical clearing time', 'pscad fault timing script', 'timed fault logic', 'pscad frt study', 'pscad tpflt', 'mhi.pscad fault'],
    about: ['Fault ride through', 'Critical clearing time', 'PSCAD', 'Transient stability'],
    sections: {
      what: `  <p>PSCAD has no event list. A fault is the <a href="../../reference/master-tpflt/">Three Phase Fault</a> component (<code>master:tpflt</code>) drawn at the point to be faulted, and it decides which phases are faulted and through what resistance. <strong>When</strong> it is applied comes from the logic wired into it, usually a <a href="../../reference/master-tfaultn/">Timed Fault Logic</a> block (<code>master:tfaultn</code>), which holds the start time <code>TF</code> and the duration <code>DF</code>.</p>
  <p>So a script times a fault by writing those two parameters, and the Three Phase Fault itself has nothing to time: in PSCAD 5.0.0 it has no time parameters at all. That is the one thing most first fault scripts get wrong.</p>
  ${pre(`flt = project.find_all("master:tfaultn")[0]
flt.parameters(TF="1.0 [s]", DF="0.12 [s]")      # on at 1 s, cleared at 1.12 s

fault = project.find_all("master:tpflt")[0]
fault.parameters(A="YES", B="YES", C="YES", G="YES", RON="0.01 [ohm]")   # what is faulted`)}`,
      method: `  <ol class="dx-steps">
    <li><strong>Let the case settle first.</strong> Put the fault well after the start-up transients have died away, and run long enough after it for the machines and controls to show whether they recover.</li>
    <li><strong>Loop over the durations</strong> to test, or search for the longest one that passes.</li>
    <li><strong>Each pass:</strong> write <code>TF</code> and <code>DF</code>, run, read the channels.</li>
    <li><strong>Check and record:</strong> the lowest voltage, the speed nadir or the highest speed, whether the case rode through.</li>
    <li><strong>Put the fault back</strong> after each pass, so the next one starts from the case as it was.</li>
  </ol>
  <h3>Fault ride through over durations</h3>
  ${pre(`for duration in num_range(0.08, 0.24, 0.04):
    mark = px_mark()
    set_fault(app, "master:tfaultn", "", at=1.0, duration=duration)
    run = px_run(app, duration=5, step=50, plot_step=250)
    v = run.series("Vpcc")
    table("FRT").add({"Fault duration (s)": duration,
                      "Lowest voltage": peak(v, kind="min").value})
    px_undo(mark)`)}
  <p><code>set_fault</code> writes the start and duration on whatever fault component it is given, by the parameter names PSCAD uses for them, and gives back the start and clearing times so the checks and the graphs know where the event was. Given a component with no timing parameters, such as the Three Phase Fault, it stops and lists the parameters that component does have.</p>
  <h3>The critical clearing time by bisection</h3>
  <p>A critical clearing time is the longest fault the case survives. Rather than sweep thirty durations, try the two ends, then keep halving the gap between the longest that passed and the shortest that failed. From 0.05 s to 0.5 s that is about eight runs to 5 ms.</p>
  ${pre(`def one_try(duration):
    trial = Trial({"Fault duration (s)": duration}, "min")
    mark = px_mark()
    try:
        set_fault(app, "master:tfaultn", "", at=1.0, duration=duration)
        run = px_run(app, duration=5, step=50, plot_step=250)
        highest = peak(run.series("Machine Speed"), kind="max").value
        trial.report(ok=highest <= 1.05)          # stays in step
    finally:
        px_undo(mark)
    return trial

cct = find_limit(one_try, 0.05, 0.5, 0.005, passes="low")
print(cct.limit, cct.status)                      # the last duration that passed`)}
  <p>What counts as staying in step is the study's own decision: a speed band, a rotor angle, a voltage that comes back within a time. Make the test the one your connection requirement states.</p>`,
      builder: builderBlock(frt,
        'The Fault ride through Quick Start runs the case for each fault duration from 0.08 s to 0.24 s and tables the voltage dip and the machine speed nadir, with every run\'s speed on one graph. Set the channel names to the ones your case records. This is the file with the case set to <code>C:/Studies/wind_farm/wind_farm.pscx</code>:',
        [
          'The loop is <code>num_range(0.08, 0.24, 0.04)</code>, both ends included. Each pass opens a mark and puts every parameter back in the <code>finally</code>, so a pass never inherits the previous one\'s fault.',
          '<code>set_fault(app, "master:tfaultn", ...)</code> writes the duration of this pass on the Timed Fault Logic. The event it returns goes to <code>px_run</code> so the checks know the fault time and the graph marks it.',
          'A pass that does not build or stops early is skipped with a note in the table, rather than ending the study.',
          '<code>peak(voltage, kind="min")</code> is the voltage dip; <code>nadir(speed, ...)</code> the speed nadir, with whether it turned around.',
          '<code>collect_series</code> keeps each pass\'s speed curve and <code>draw_collected</code> draws them on one graph at the end, one line per duration.',
        ], 'fault_ride_through.py') + '\n' + builderExtra(cct,
        'The Critical clearing time Quick Start does the search: Find limit tries 0.05 s and 0.5 s, then halves towards the boundary until it is within 5 ms, and Stays in step passes a try whose highest machine speed is at most 1.05 p.u.:',
        'critical_clearing_time.py'),
      pitfalls: [
        '<strong>Writing the time on the Three Phase Fault.</strong> It has no time parameters; the time is on the Timed Fault Logic wired to it. The Builder\'s Set a fault block names <code>master:tfaultn</code> for that reason.',
        '<strong>A fault during the start-up.</strong> A case starts from zero and needs time to reach its steady state. A fault at 0.1 s tests the initialisation, not the plant. Look at a run with no fault first and put the fault after it has settled, or start from a snapshot.',
        '<strong>Speed in per unit, a limit in hertz.</strong> A machine speed channel is usually per unit, so a stay-in-step test of 1.05 is 5 % over speed, not 1.05 Hz. Check the unit the channel carries (<code>series.unit</code>).',
        '<strong>A search that stops early.</strong> A try that gives no answer (a run that did not build, a check with no data) ends a bisection with status <code>UNKNOWN</code> by default. Read the status, not only the limit.',
        '<strong>The case changed after the study.</strong> Every write is in the case. Keep the mark and undo around each pass, and <code>UNDO_CHANGES = True</code> for the run as a whole.',
      ],
      faq: [
        ['How do I apply a fault in PSCAD from Python?', 'Write the start time and the duration on the timing logic that drives the fault, usually Timed Fault Logic (<code>master:tfaultn</code>, parameters <code>TF</code> and <code>DF</code>), then run the case. The Three Phase Fault component sets which phases are faulted and the fault resistance.'],
        ['How do I find the critical clearing time in PSCAD?', 'Run the case with a fault of a given duration and test whether it stays stable, then halve the gap between the longest duration that passed and the shortest that failed until it is narrow enough. That takes about eight runs instead of a sweep of thirty.'],
        ['Why does my fault not change between runs?', 'Most often the time is being written on a component that does not use it, or the parameter is written without its unit. Read the value back after writing it, and write the time on the Timed Fault Logic.'],
      ],
    },
    builderTitle: 'The full Python scripts from the Builder',
  };
}
