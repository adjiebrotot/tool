// Guide: building a case, its compiler errors, the run settings, and reading output channels.
export default async function ({ builderScript, builderBlock, pre, table }) {
  const b = await builderScript('build-check', ({ set }) => set('n1', {
    project: 'C:/Studies/feeder/feeder.pscx',
  }));

  const SETTINGS = [
    ['duration', 's', 'How long the run simulates. With a snapshot start it carries on from the snapshot time.'],
    ['step', 'us', 'The EMTDC solution time step. 50 us is usual for a network; power electronics wants 1 to 10 us.'],
    ['plot_step', 'us', 'How often a channel is written. It sets the highest frequency the recorded waveform holds, and the size of the files.'],
    ['build', '', '"auto" builds once per script run, "always" before every run, "never" not at all.'],
    ['read', '', '"out" reads the .out files, "curves" the samples off the case\'s graphs, "none" nothing.'],
  ];

  return {
    slug: 'build-and-run', crumb: 'Build and run',
    card: 'Build and run a PSCAD case from Python',
    title: 'Build and run a PSCAD case from Python, and read its channels',
    h1: 'Build and run a PSCAD case from Python',
    desc: 'Compile a PSCAD case from Python and read the compiler errors, set the time step and plot step, run EMTDC and read the output channels from the .out files.',
    lead: 'A PSCAD case is not a data file a solver reads: it is <strong>Fortran that EMTDC compiles</strong> and then runs. So a script has two steps where other simulators have one, a build with errors of its own and a run, and then a third: reading back the channels the run wrote. This page covers all three, and what goes wrong in each.',
    whatTitle: 'What building and running a case means',
    qsTitle: 'Build the case and report its errors',
    level: 'Beginner',
    keywords: ['pscad build from python', 'pscad compile errors', 'emtdc run python', 'pscad output channel', 'pscad .out file', 'pscad plot step', 'mhi.pscad run'],
    about: ['PSCAD', 'EMTDC', 'Python', 'Fortran'],
    sections: {
      what: `  <p>When PSCAD builds a case it writes each page of the model out as Fortran, compiles it with the Fortran compiler PSCAD is set to (GFortran or Intel), and links an executable. The run is that executable: EMTDC steps the network in the time domain and writes the signals that have an <strong>output channel</strong> on them to result files.</p>
  <p>Three things follow for a script. A build can fail where nothing has run yet, with errors that name a component and a page. A run can stop before its end time, which is a result of the study, not a crash of the script. And the only results there are come from output channels: <strong>a signal with no output channel on it is not recorded</strong>, whatever the graphs show while PSCAD is open.</p>`,
      method: `  <ol class="dx-steps">
    <li><strong>Build</strong> with <code>project.build()</code>, or <code>clean()</code> first to throw the old build away. Then read <code>project.messages()</code>: PSCAD replaces the list at the start of every build and run, so what is there is this build's.</li>
    <li><strong>Set the run</strong>: duration, time step and plot step in the project's settings.</li>
    <li><strong>Run</strong> with <code>project.run()</code>, which builds first if the case needs it.</li>
    <li><strong>Read the channels</strong> from the <code>.out</code> files in the build folder, by the names the <code>.inf</code> index gives them.</li>
  </ol>
  <h3>Building, and reading the errors</h3>
  ${pre(`project.clean()                         # optional: start the build from nothing
project.build()
for m in project.messages():            # this build's messages only
    print(m.status, m.text)             # its status (error, warning, normal) and text`)}
  <p>The Builder's runtime wraps this as <code>px_build(app, clean=False)</code>, which gives back <code>.ok</code>, <code>.errors</code>, <code>.warnings</code> and <code>.seconds</code>, and remembers that the case is built so a loop does not compile it again on every pass.</p>
  <h3>The run settings</h3>
  ${table([{ h: 'Setting', fn: r => `<code>${r[0]}</code>`, html: true }, { h: 'Unit', key: 1 }, { h: 'What it does', key: 2 }], SETTINGS.map(r => ({ 0: r[0], 1: r[1] || '·', 2: r[2] })))}
  ${pre(`run = px_run(app, duration=2.0, step=50, plot_step=250)
print(run.status)        # "ok", "early" (stopped before the end) or "failed" (did not build or start)
print(run.t_end)         # the last time written, s
print(run.names())       # every channel the run recorded`)}
  <h3>Reading a channel</h3>
  <p>EMTDC writes ten channels to each <code>.out</code> file, with a <code>.inf</code> index that names them in order. A three phase channel becomes three, named after its title with <code>:1</code>, <code>:2</code> and <code>:3</code>. <code>run.series(name)</code> finds the right column in the right file and gives back the waveform in the channel's own unit; a name the run did not record gives an empty series and a warning that lists the closest names it did record.</p>
  ${pre(`va = run.series("Vbus:1")           # phase A of a three phase channel titled Vbus
print(len(va), va.unit, va.y[-1])   # samples, unit, the last value
worst = peak(va, kind="abs")        # .value, .time`)}`,
      builder: builderBlock(b,
        'The Build the case Quick Start compiles the case and writes one table row either way: built, with the time and the warnings, or not built, with the compiler\'s errors. It is the first file to run on a case you have not scripted before. This is the file with the case set to <code>C:/Studies/feeder/feeder.pscx</code>:',
        [
          '<code>px_build(app, None, True, False)</code> is a clean build: the previous one is thrown away first.',
          'The block\'s <strong>Built</strong> and <strong>Did not build</strong> branches each write their own row into the same table, so the table says what happened even when the case does not compile.',
          'The errors column holds PSCAD\'s own messages, which name the component and the page. A floating input, a signal used before it is defined and a missing library are the usual ones.',
          'Nothing is run: this is the quick check. The other Quick Starts call <code>px_run</code>, which builds once and then runs.',
        ], 'build_the_case.py'),
      pitfalls: [
        '<strong>A signal shown on a graph is not necessarily recorded.</strong> Only signals with an output channel are written to the result files. Add the channel in the case, or the script reads nothing for it.',
        '<strong>The plot step limits the waveform.</strong> A 250 us plot step holds frequencies up to about 2 kHz; anything faster in the run is not in the file. Lower it for harmonics and switching, at the cost of larger files.',
        '<strong>A run that stops early is a result.</strong> EMTDC stops when the network has no solution or a component asks it to, and the script gets <code>status "early"</code> with the time it reached. Record it rather than treating it as an error.',
        '<strong>Old result files are read as new ones</strong> if a run fails before it writes. The runtime clears the case\'s <code>.out</code> files before each run so a failed run reads as empty, not as the previous run.',
        '<strong>A build and a run that works, then "is not recognized".</strong> When <code>NoDefaultCurrentDirectoryInExePath</code> is set in the environment, the batch files EMTDC generates cannot start the case\'s own executable. The generated scripts clear it.',
      ],
      faq: [
        ['How do I build a PSCAD project from Python?', 'Call <code>build()</code> on the project, after <code>clean()</code> when you want a full rebuild, then read <code>messages()</code> for the errors and warnings. <code>run()</code> builds first when the case needs it, so a script that only runs does not have to build separately.'],
        ['Where does PSCAD write the simulation results?', 'To <code>.out</code> files in the case\'s build folder, ten channels to a file, with a <code>.inf</code> file that names each channel in order. The folder is the case\'s build folder beside the <code>.pscx</code>, whose name ends in the compiler\'s (<code>.gf46</code> for GFortran 4.6); the project\'s <code>temp_folder</code> gives its path.'],
        ['Why is my channel missing from the results?', 'It has no output channel component on it, it is disabled, or its title is not the name the script asks for. <code>run.names()</code> lists every channel the run recorded.'],
      ],
    },
  };
}
