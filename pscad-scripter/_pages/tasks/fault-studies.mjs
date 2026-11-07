// Guide: fault ride through over a range of fault durations, then the critical clearing time
// found by bisection. Two Quick Starts: frt on the page, cct beside it.
export default async function ({ builderScript, builderBlock, builderExtra, pre }) {
  const b = await builderScript('frt', ({ set }) => set('n1', {
    project: 'C:/work/mycase.pscx',
  }));
  const c = await builderScript('cct', ({ set }) => set('n1', {
    project: 'C:/work/mycase.pscx',
  }));

  return {
    slug: 'fault-studies', crumb: 'Fault studies',
    card: 'Fault ride through and critical clearing time in PSCAD',
    title: 'PSCAD fault ride through and critical clearing time with Python',
    h1: 'Fault ride through and critical clearing time in PSCAD',
    desc: 'Sweep a fault duration in PSCAD from Python: apply the fault, run the EMT simulation, read the voltage dip and the speed nadir, then bisect the duration for a critical clearing time.',
    lead: `A fault study in PSCAD is a loop of runs. There is <strong>no event list to fill</strong>: the fault is a component already drawn in the case, and the study writes its start time and its duration before each run. Ride through asks what happens over a range of durations; a critical clearing time asks for the longest one the machine survives, which is a search rather than a sweep. Both are the same three blocks with a different thing wrapped around them.`,
    whatTitle: 'How a fault is applied in PSCAD',
    methodTitle: 'The method, both ways round',
    qsTitle: 'Fault ride through over fault durations',
    level: 'Intermediate',
    keywords: ['pscad fault ride through', 'pscad critical clearing time', 'pscad fault python', 'tfaultn', 'tpflt', 'LVRT PSCAD', 'pscad fault duration sweep', 'EMT fault study'],
    about: ['PSCAD', 'Fault ride through', 'Critical clearing time', 'Electromagnetic transient simulation'],
    sections: {
      what: `  <p>A fault in PSCAD is two components. The <a href="../../reference/tpflt/">Three Phase Fault</a> (<code>master:tpflt</code>) is the fault itself: which phases it takes down, whether it goes to ground, and its on and off resistance. Beside it sits the <a href="../../reference/tfaultn/">Timed Fault Logic</a> (<code>master:tfaultn</code>), which holds <strong>when the fault is applied (<code>TF</code>) and how long it lasts (<code>DF</code>)</strong>, both in seconds.</p>
  <p>So the study writes two numbers on one component and runs. Nothing else about the fault changes between passes, which is what makes the sweep cheap to write and easy to trust: the only difference between one row and the next is a duration.</p>
  <p>The same shape covers a breaker: the <a href="../../reference/breaker3/">3 Phase Breaker</a> is driven by the Timed Breaker Logic beside it, whose <code>TO1</code> and <code>TO2</code> are the times it operates.</p>
  <p>What you read back depends on what the study is for.</p>
  <ul class="dx-prose">
    <li><strong>Ride through</strong> asks whether the plant stayed connected and whether the voltage recovered: the lowest point of the voltage at the connection point, and how long it took to come back.</li>
    <li><strong>Stability</strong> asks whether the machine stayed in step: the nadir of its speed, and whether it came back to the nominal rather than running away.</li>
    <li><strong>A critical clearing time</strong> asks for the longest fault the machine survives, which is the boundary between a pass and a fail.</li>
  </ul>`,
      method: `  <h3>Ride through: a sweep</h3>
  <p>Every duration in the range is run, and each pass writes a row. The sweep is worth running first even when you only want the critical clearing time, because it shows the shape of the answer and tells you the range to search in.</p>
  <ol class="dx-steps">
    <li><strong>Loop over the durations</strong> you care about. Grid codes usually set the ones that matter, so the range is a list rather than a guess.</li>
    <li><strong>Write the fault timing</strong> on the Timed Fault Logic before each run. Apply the fault well after the case has settled, not at <code>t = 0</code>.</li>
    <li><strong>Run</strong> long enough to see the recovery, not just the fault. A fault cleared at 1.2 s in a 5 s run leaves nearly four seconds of recovery to look at.</li>
    <li><strong>Read the channels</strong>: the voltage at the connection point, and the machine speed.</li>
    <li><strong>Take a number off each</strong>: the lowest voltage, and the speed nadir.</li>
    <li><strong>Add a row</strong>, and put the fault timing back before the next pass.</li>
  </ol>
  ${pre(`for duration in (0.08, 0.12, 0.16, 0.20, 0.24):
    mark = px_mark()                                   # so this pass can be undone
    start, clear = set_fault(app, "master:tpflt", at=1.0, duration=duration)

    run = px_run(app, duration=5.0, step=50, plot_step=250)
    v = run.series("Vpcc")
    w = run.series("Machine Speed")

    dip = peak(v, kind="min")                          # .value and .time
    nadir = nadir_of(w)

    table("FRT").add({
        "Fault duration (s)": duration,
        "Cleared at (s)": clear,
        "Lowest voltage": dip.value,
        "Speed nadir": nadir.value,
        "Reached (s)": run.t_end,
    })
    px_undo(mark)`)}
  <h3>Critical clearing time: a search</h3>
  <p>A critical clearing time is the <strong>largest fault duration that still passes</strong>. Running a fine grid to find it wastes runs: most of them are a long way from the boundary. Bisection halves the gap each time, so a boundary to 10 ms inside a 50 ms to 500 ms range takes about six runs instead of forty-five.</p>
  <p>The search needs one thing the sweep does not: <strong>a verdict per run</strong>. Something has to say pass or fail, and it has to say it the same way every time. For a synchronous machine the usual test is whether the speed comes back; for a converter it is whether the plant stayed connected.</p>
  ${pre(`# Find limit: the largest duration where the verdict is still a pass.
#   try a duration -> apply, run, read, decide -> report pass or fail
#   the search narrows the bracket until it is inside the tolerance

def attempt(duration):
    mark = px_mark()
    set_fault(app, "master:tpflt", at=1.0, duration=duration)
    run = px_run(app, duration=5.0, step=50, plot_step=250)
    speed = run.series("Machine Speed")
    px_undo(mark)
    return final_value(speed) < 1.02 and run.status == "finished"   # stayed in step`)}
  <p class="dx-note">The verdict has to be honest about a run that did not finish. A case that goes unstable often stops early, and treating "did not finish" as a pass puts the critical clearing time above the real one, which is the dangerous direction to be wrong in.</p>
  <h3>What to look at in the results</h3>
  <p>The table is the point of the sweep, but two things in it are worth reading before anything else. The <strong>first duration that fails</strong> brackets the critical clearing time without a search. And a <strong>speed nadir that keeps falling while the voltage dip stays the same</strong> says the machine is losing synchronism rather than the network getting weaker, which is a different problem.</p>`,
      builder: builderBlock(b,
        'The ride through Quick Start is the sweep, wired: a loop over the durations, the fault, the run, two channels, two checks and a results table. This is the file the Builder writes, with the case set to your own path:',
        [
          'The <strong>For a range of numbers</strong> block is the sweep. Its <em>Each pass</em> output runs the body once per value and its value output feeds the fault duration, so there is one place to change the range.',
          '<code>set_fault(...)</code> writes <code>TF</code> and <code>DF</code> on the Timed Fault Logic and hands back the start and the clear time, so the row records when the fault actually cleared rather than what was asked for.',
          'Both run outputs are wired. A run that stops early still reaches the table, with <code>run.t_end</code> saying how far it got.',
          'The two <strong>Read a channel</strong> blocks name the channels by their titles as the case records them, so these are the two lines to change for your own model.',
          'Each pass sits between <code>px_mark()</code> and <code>px_undo(mark)</code>, so the fault timing goes back to what it was before the next duration is written. The case is left as it was found.',
          'The graph block draws the voltage against time for every pass on one figure, which is the picture a ride through report wants.',
        ], 'fault_ride_through.py') + '\n  <h3>The same study as a search</h3>\n' + builderExtra(c, 'The critical clearing time Quick Start is the same three blocks with <strong>Find limit</strong> in place of the loop, and a <strong>Pass / fail</strong> block giving the verdict each try reports back. Find limit halves the bracket on every try, so the boundary costs a handful of runs:', 'critical_clearing_time.py'),
      pitfalls: [
        '<strong>Applying the fault before the case has settled.</strong> An EMT case starts from zero and takes time to reach steady state. A fault at 0.1 s measures the initialisation, not the fault. Let the case settle first, or <a href="../snapshots-and-batch/">start every run from a snapshot</a>.',
        '<strong>Ending the run at the clearing time.</strong> The interesting part of a ride through is the recovery. A 5 s run with the fault at 1 s gives it room; a 1.5 s run does not.',
        '<strong>Reading the lowest voltage off the instantaneous waveform.</strong> An instantaneous phase voltage passes through zero every half cycle, so its minimum is meaningless. Read the dip off an <a href="../../reference/rms3ph/">RMS meter</a> channel, or take the RMS of the waveform in the script.',
        '<strong>Leaving the fault timing written.</strong> Every parameter a script writes is written in the case. Undo each pass, or the last duration in the sweep becomes the case\'s new setting.',
        '<strong>A critical clearing time with no tolerance.</strong> Bisection converges on a boundary; it needs to be told how close is close enough. Ten milliseconds is usually finer than the model justifies.',
        '<strong>A verdict that reads a channel the run did not record.</strong> That gives an empty series, and an empty series must not read as a pass. Check the run recorded the channel before trusting the search.',
      ],
      faq: [
        ['How do I apply a fault in PSCAD from Python?', 'Write the timing on the Timed Fault Logic component beside the fault: TF is the time the fault is applied and DF is how long it lasts, both in seconds. PSCAD has no event list, so the fault is a component already drawn in the case and the script changes its parameters before each run.'],
        ['How do I find a critical clearing time in PSCAD?', 'Bisect the fault duration. Run with a duration, decide pass or fail from the result, and halve the bracket each time. A boundary to within 10 ms inside a 50 to 500 ms range takes about six runs, where a fine grid would take dozens.'],
        ['What do I measure for fault ride through?', 'The RMS voltage at the connection point, for the depth of the dip and how long recovery takes, and the machine speed or the converter\u2019s own flags for whether the plant stayed in step and stayed connected. Read the dip from an RMS meter channel, not from the instantaneous waveform.'],
        ['How long should the run be after the fault clears?', 'Long enough to see whether it recovers. A fault cleared at 1.2 s in a 5 s run leaves nearly four seconds of recovery, which is usually enough to tell a settled machine from one that is slowly losing step.'],
      ],
    },
  };
}
