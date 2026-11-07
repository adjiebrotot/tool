// Guide: snapshots (run once to a settled state, start every later run from it) and simulation
// sets (several cases at once). Two Quick Starts: snapshot on the page, parallel beside it.
export default async function ({ builderScript, builderBlock, builderExtra, pre }) {
  const b = await builderScript('snapshot', ({ set }) => set('n1', {
    project: 'C:/work/mycase.pscx',
  }));
  const p = await builderScript('parallel', ({ set }) => set('n1', {
    project: 'C:/work/mycase.pscx',
  }));

  return {
    slug: 'snapshots-and-batch', crumb: 'Snapshots and batch runs',
    card: 'PSCAD snapshots and running cases in a batch',
    title: 'PSCAD snapshots and batch runs with Python (simulation sets, volley)',
    h1: 'PSCAD snapshots and running cases in a batch',
    desc: 'Cut the initialisation out of every PSCAD run with a snapshot, then run several cases at once in a simulation set with a volley, from one Python script.',
    lead: `An EMT case starts from zero every time and spends the first second or two getting to a steady state that is the same on every run of a study. Two things get that time back. A <strong>snapshot</strong> runs the initialisation once and starts every later run from the state it saved. A <strong>simulation set</strong> runs several cases at the same time instead of one after another. Together they turn an overnight sweep into a lunch break.`,
    whatTitle: 'What a snapshot is',
    methodTitle: 'Snapshots, then simulation sets',
    qsTitle: 'Initialise once, then branch',
    level: 'Intermediate',
    keywords: ['pscad snapshot', 'pscad simulation set', 'pscad volley', 'pscad batch run python', 'pscad parallel runs', 'pscad initialisation', 'snapshot file psmx'],
    about: ['PSCAD', 'Snapshot', 'Batch simulation', 'Electromagnetic transient simulation'],
    sections: {
      what: `  <p>A snapshot is the <strong>whole state of the simulation at one instant</strong>, written to a file beside the case. Every capacitor voltage, every inductor current, every controller state. A later run told to start from it begins in that state instead of from zero, so the initialisation does not happen again.</p>
  <p>For a study that varies something <em>after</em> the case has settled, which is most of them, that is the whole initialisation removed from every pass but the first. A case that takes 2 s to settle and 2 s to show the event goes from 4 s of simulation per pass to 2 s: half the work, over twenty passes or two hundred.</p>
  <p>It only works when the thing being varied happens after the snapshot. A sweep over fault durations qualifies, because the case is the same until the fault. A sweep over a transformer rating does not: that changes the steady state the snapshot captured, so the snapshot is wrong for every value but the one it was taken with.</p>
  <h3>And a simulation set</h3>
  <p>A <strong>simulation set</strong> is a list of cases PSCAD runs as a group, and a <strong>volley</strong> is how many of them run at the same time. Each task in the set can override the duration and the time steps, so one set can hold the same case under several conditions. This is the parallelism PSCAD has: not one case split across cores, but several cases running side by side.</p>`,
      method: `  <h3>Taking a snapshot</h3>
  <p>The snapshot is taken at a time, during a run. Tell the case when to take it, run past that time, and the file is written.</p>
  ${pre(`snapshot_at(app, 2.0, name="settled")          # take it at t = 2 s
px_run(app, duration=2.2, step=50, plot_step=250)   # run past it, once`)}
  <h3>Starting from it</h3>
  <p>A run told to start from a snapshot begins at the time the snapshot was taken, not at zero. Times inside the run are still absolute, so a fault at 0.1 s after a snapshot taken at 2 s is written as 2.1 s unless the case is set to restart the clock.</p>
  ${pre(`snapshot_use(app, "settled")

for duration in (0.08, 0.12, 0.16, 0.20):
    mark = px_mark()
    set_fault(app, "master:tpflt", at=2.1, duration=duration)
    run = px_run(app, duration=2.0, step=50, plot_step=250)
    table("Snapshot").add({
        "Fault (s)": duration,
        "Lowest voltage": peak(run.series("Vbus"), kind="min").value,
    })
    px_undo(mark)

snapshot_off(app)      # later runs start from zero again`)}
  <p class="dx-note">Put the case back to starting from zero when the script ends. A case left set to start from a snapshot will quietly use it the next time anyone opens it, including for a study the snapshot does not suit.</p>
  <h3>Running several cases at once</h3>
  <p>A simulation set holds tasks, each one a case, and the volley says how many run together. Four at a time on a four core machine is the usual starting point; more than the machine has cores makes everything slower.</p>
  ${pre(`sim = simset_create(app, "PXB_batch", volley=4)
simset_add(sim, ["caseA", "caseB", "caseC", "caseD"])
simset_override(sim, duration=5.0, step=50)       # the same settings for every task

result = simset_run(sim)
for task in result.tasks:
    table("Batch").add({"Case": task.name, "Status": task.status, "Seconds": task.seconds})`)}
  <p class="dx-note">On PSCAD 5.0.0 the Automation Library has <code>add_tasks</code> but not <code>add_task</code>: add them as a list. The generated scripts do this for you.</p>
  <h3>Which one to reach for</h3>
  <ul class="dx-prose">
    <li><strong>Same case, something varied after it settles</strong>: a snapshot. The saving is the initialisation, every pass.</li>
    <li><strong>Different cases, or variations that change the steady state</strong>: a simulation set. The saving is wall clock time, not simulated time.</li>
    <li><strong>Both</strong>: take a snapshot per case, then run the cases as a set. The two do not get in each other's way.</li>
  </ul>`,
      builder: builderBlock(b,
        'The snapshot Quick Start is the pattern: one run to settle and save, then a loop that branches from the saved state. This is the file the Builder writes:',
        [
          '<strong>Save a snapshot</strong> sets the time the snapshot is taken; the <strong>Initialise</strong> run that follows is the one run that pays for the initialisation.',
          '<strong>Start from a snapshot</strong> comes before the loop, so every pass of the loop begins at the settled state rather than at zero.',
          'The fault time inside the loop is absolute: it is after the snapshot time, not relative to it.',
          'The loop body is the same three blocks as any other sweep, which is the point: the snapshot changes what a run starts from and nothing else.',
          '<strong>Start from zero again</strong> is wired at the end, so the case is not left set to a snapshot that the next study would not want.',
          'The Builder warns when a block changes the model between the snapshot and the run that uses it, because that change is not in the saved state.',
        ], 'snapshot_then_branch.py')
        + '\n  <h3>Running several cases at once</h3>\n'
        + builderExtra(p, 'The batch Quick Start is the other half: a simulation set with a volley, the settings overridden for every task, and a row per case when the set finishes.', 'batch_simulation_set.py'),
      pitfalls: [
        '<strong>A snapshot taken before the case has settled.</strong> Every later run then starts from a transient, and the results are repeatable and wrong. Check the snapshot time against the waveform before trusting it.',
        '<strong>Changing the model after the snapshot and expecting the change to be in it.</strong> The snapshot holds the state as it was. A parameter written afterwards applies from the restart, which is usually what you want for a fault and never what you want for an impedance.',
        '<strong>Times measured from the restart.</strong> The clock does not reset by default: a fault 100 ms after a snapshot taken at 2 s is at 2.1 s.',
        '<strong>Leaving the case set to start from a snapshot.</strong> It is a case setting, not a session one, so it survives the script and the next person to open the case.',
        '<strong>A volley larger than the machine.</strong> Every task is a full EMTDC process. More tasks than cores means they take turns, and the whole set finishes later than a smaller volley would.',
        '<strong>Several tasks building in the same folder.</strong> Each build writes beside the <code>.pscx</code>. Give each task its own copy of the case, or let the set build them in turn before the volley starts.',
      ],
      faq: [
        ['What is a PSCAD snapshot?', 'A file holding the entire state of the simulation at one instant: every capacitor voltage, inductor current and controller state. A run told to start from it begins in that state instead of from zero, which removes the initialisation from every run of a study after the first.'],
        ['When is a snapshot not safe to use?', 'When the thing being varied changes the steady state the snapshot captured. Sweeping a fault duration is fine, because the case is identical until the fault. Sweeping a transformer rating or a source impedance is not: the snapshot holds the state of a different network.'],
        ['How do I run several PSCAD cases at once?', 'Put them in a simulation set and give the set a volley. The volley is how many tasks run at the same time; each task is a full EMTDC process, so a volley of about the number of cores on the machine is the practical limit.'],
        ['Does a snapshot make the simulation faster?', 'It removes simulated time, not solver work per step. A case that takes 2 s to settle and 2 s to show the event runs half as long per pass once the settling is snapshotted, and the saving multiplies by the number of passes.'],
      ],
    },
  };
}
