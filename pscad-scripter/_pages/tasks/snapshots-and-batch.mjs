// Guide: snapshots (snapshot) and simulation sets (parallel): the two ways a PSCAD study saves
// time.
export default async function ({ builderScript, builderBlock, builderExtra, pre }) {
  const snap = await builderScript('snapshot', ({ set }) => set('n1', {
    project: 'C:/Studies/hvdc/hvdc.pscx',
  }));
  const par = await builderScript('parallel', ({ set }) => set('n1', {
    project: 'C:/Studies/hvdc/hvdc.pscx',
  }));

  return {
    slug: 'snapshots-and-batch', crumb: 'Snapshots and batch runs',
    card: 'Snapshots, simulation sets and batch runs',
    title: 'PSCAD snapshots and simulation sets with Python: faster batch runs',
    h1: 'Snapshots, simulation sets and batch runs in PSCAD',
    desc: 'Save a PSCAD snapshot once the case has settled and start each run from it, then run cases side by side in a simulation set: the two ways to cut a study\'s run time.',
    lead: 'An EMT study spends much of its time on things it does not need: the same start-up simulated again for every case, and one case at a time on a machine with many cores. A <strong>snapshot</strong> fixes the first: initialise once, save the state, start every case from it. A <strong>simulation set</strong> fixes the second: PSCAD runs its cases several at a time.',
    whatTitle: 'Where a PSCAD study\'s time goes',
    qsTitle: 'Initialise once, then branch',
    level: 'Intermediate',
    keywords: ['pscad snapshot python', 'pscad simulation set', 'pscad parallel runs', 'pscad volley', 'pscad batch run python', 'pscad start from snapshot'],
    about: ['PSCAD', 'Snapshot', 'Parallel computing', 'Batch processing'],
    sections: {
      what: `  <p>A PSCAD case starts from zero: sources ramp up, machines are released, controls find their operating point. For a large case with converters that can take seconds of simulated time, and minutes of real time, before anything the study cares about happens. A study of twenty fault cases pays that twenty times.</p>
  <p>A <strong>snapshot</strong> is the whole state of the case at one instant, saved to a <code>.snp</code> file. A run started from it carries on from that instant, at that simulated time, so the start-up is paid once.</p>
  <p>A <strong>simulation set</strong> is a list of cases, or of one case with different settings, that PSCAD runs as a batch. Its <strong>volley</strong> is how many run at the same time, each its own process. That is where a PSCAD study gets real parallelism: four cases in a volley of four finish in about the time of one, as long as the machine has the cores and the licence allows it.</p>`,
      method: `  <h3>Initialise once, then branch</h3>
  <ol class="dx-steps">
    <li><strong>Run to a settled state</strong> with a snapshot time set, and the run saves the state there.</li>
    <li><strong>Switch the start</strong> to that snapshot file. Every run from then on starts from it, until it is switched back.</li>
    <li><strong>Time each event after the snapshot</strong>: a run from a snapshot taken at 2 s starts at 2 s, so a fault at 0.1 s is already in the past.</li>
  </ol>
  ${pre(`snapshot = snapshot_save(app, at=2.0)            # the next run saves the state at 2 s
px_run(app, duration=2.2, step=50, plot_step=250)  # initialise, once

snapshot_use(app, snapshot)                        # every run from here starts at 2 s
for duration in num_range(0.08, 0.2, 0.04):
    mark = px_mark()
    set_fault(app, "master:tfaultn", "", at=2.1, duration=duration)
    run = px_run(app, duration=2, step=50, plot_step=250)
    table("Snapshot").add({"Lowest voltage": peak(run.series("Vbus"), kind="min").value})
    px_undo(mark)
snapshot_off(app)                                  # back to starting from zero`)}
  <h3>Several cases at once</h3>
  ${pre(`sim_set = simset_create(app, "batch", ["case_a", "case_b", "case_c", "case_d"], volley=4)
simset_override(app, sim_set, None, duration=5)    # every task: 5 s, without touching the cases
result = simset_run(app, sim_set)                  # builds and runs its own tasks
print(result.ok, result.seconds)`)}
  <p>The cases in a set must be loaded in the workspace. Load them with the case, or list them under Libraries in the Builder's Start block. The volley is best kept at or below the number of processor cores.</p>`,
      builder: builderBlock(snap,
        'The Initialise once, then branch Quick Start saves a snapshot at 2 s, initialises once, then runs three fault durations from the snapshot and tables the lowest voltage of each. This is the file with the case set to <code>C:/Studies/hvdc/hvdc.pscx</code>:',
        [
          '<code>snapshot_save(app, 2, None, "")</code> sets the case to save one snapshot at 2 s, named after the case, and the Initialise run of 2.2 s writes it.',
          '<code>snapshot_use(app, snapshot)</code> switches the start to the file. The runs in the loop pass no snapshot of their own and keep starting from it.',
          'The fault is at 2.1 s, 0.1 s after the snapshot. Each pass writes its duration on the Timed Fault Logic and puts it back after.',
          'At the end, <code>finish(app)</code> puts the case\'s start and snapshot settings back as they were found, with every other setting the workflow changed.',
        ], 'initialise_once_then_branch.py') + '\n' + builderExtra(par,
        'The Run several cases at once Quick Start makes a simulation set of the case in use with a volley of 4, overrides its duration to 5 s, runs it and tables how it went. List your own cases in the set:',
        'run_several_cases_at_once.py'),
      pitfalls: [
        '<strong>An event timed before the snapshot.</strong> A run from a snapshot starts at the snapshot\'s time. Anything timed before it never happens. Add the snapshot time to every event time.',
        '<strong>A snapshot from a different build.</strong> A snapshot holds the state of one build of the case. Change the case\'s structure (a component added, a definition changed) and take the snapshot again.',
        '<strong>A snapshot before the case has settled.</strong> Every run then starts mid-transient. Look at a run with no event first and take the snapshot after it has reached steady state.',
        '<strong>A volley larger than the machine.</strong> More processes than cores slow each other down, and each needs its own licence seat where the licence counts them.',
        '<strong>A simulation set changes PSCAD, not only the case.</strong> The set is kept in the workspace. The Builder deletes the sets it made at the end unless told to keep them.',
      ],
      faq: [
        ['How do I start a PSCAD run from a snapshot in Python?', 'Run once with a snapshot time set so the run saves a .snp file, then set the case\'s start to that file (StartType FROM_SNAP_FILE and startup_filename in the project\'s settings) and run again. The run carries on from the snapshot\'s time.'],
        ['Can PSCAD run simulations in parallel?', 'Yes, through a simulation set: its volley says how many tasks run at the same time, each as its own process. A Python loop on its own runs one case after another.'],
        ['What is the difference between a simulation set and Multiple Run?', 'Multiple Run repeats one case inside one run of its executable, stepping variables. A simulation set runs several cases, or one case with different settings, as separate processes, several at a time.'],
      ],
    },
    builderTitle: 'The full Python scripts from the Builder',
  };
}
