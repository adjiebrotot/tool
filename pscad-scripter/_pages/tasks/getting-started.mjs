// Guide: how PSCAD automation works at all. The Automation Library, connecting, opening a case,
// the build, one run, reading a channel.
export default async function ({ builderScript, builderBlock, pre, table }) {
  const b = await builderScript('build-check', ({ set }) => set('n1', {
    project: 'C:/Users/Public/Documents/PSCAD/5.0/Examples/tutorial/vdiv.pscx',
  }));

  const CALLS = [
    ['px_connect()', 'Starts PSCAD or attaches to the one that is open, opens PROJECT and gives back the application. Reads the SETTINGS at the top of the script; calling it again gives the same application.'],
    ['px_find(app, defn, name, match)', 'Finds a component by its definition ("master:resistor"), by its Name, or by both. match "one" wants exactly one, "first" takes the first, "all" gives a list. No match is an error that lists the closest definitions and names in the case.'],
    ['px_get(obj, param, unit=None)', 'Reads one parameter: a number where it is one, else its text. unit converts a unit-carrying value, so a resistance PSCAD holds in ohm can be read in kohm.'],
    ['px_set(obj, param, value, unit=None)', 'Writes one parameter, in the unit the parameter already carries, and records the old value so it can be put back.'],
    ['px_build(app, clean=False)', 'Compiles the case with its Fortran compiler. Gives back a result with .ok, .errors, .warnings, .messages and .seconds.'],
    ['px_run(app, duration, step, plot_step)', 'Builds the case if it needs it, runs the EMT simulation and reads the channels back. duration is in seconds, step and plot_step in microseconds.'],
    ['run.series("Vbus")', 'One output channel of a run as a Series of time and value, in the channel unit the .inf index gives. A name the run did not record gives an empty Series and one warning, never an error.'],
    ['set_fault(app, defn, name, at=, duration=)', 'Writes the start time and the duration on a fault component in the model, and gives back (start, clear). PSCAD has no event list, so this is how a fault is timed.'],
    ['sim_settings(app, duration=, step=, plot_step=)', 'Writes the simulation settings of the case: duration in seconds, the time step and the plot step in microseconds, and the output format.'],
    ['px_mark() and px_undo(mark)', 'Opens a mark and puts back every parameter written since it. One pass of a loop sits between the two, so a sweep leaves the case as it found it.'],
    ['table("FRT").add({...})', 'Adds a row to a results table. The loop values are added for you, and the table is saved to the run folder as CSV or Excel when the run ends.'],
    ['finish(app)', 'The finally of the script: puts back every parameter, layer state and substitution the workflow changed, saves the tables, writes the summary.'],
  ];

  return {
    slug: 'getting-started', crumb: 'Getting started',
    card: 'PSCAD automation with Python: getting started',
    title: 'PSCAD Python automation: getting started with mhi.pscad',
    h1: 'PSCAD automation with Python: getting started',
    desc: 'Drive PSCAD from Python with the Automation Library: install mhi-pscad, connect, open a case, build it, run the EMT simulation and read an output channel.',
    lead: `PSCAD is scripted through its <strong>Automation Library</strong>, a Python package called <code>mhi.pscad</code> that talks to PSCAD over its automation server. <code>mhi.pscad.launch()</code> starts a PSCAD, <code>mhi.pscad.connect()</code> attaches to one already open, and from there a case is opened, built, run and read. This page is the whole path from nothing to a first result, and the calls to learn on the way.`,
    whatTitle: 'What PSCAD automation is',
    qsTitle: 'Build the case and report its errors',
    level: 'Beginner',
    keywords: ['pscad python', 'mhi.pscad', 'mhi-pscad', 'PSCAD Automation Library', 'run PSCAD from Python', 'PSCAD scripting', 'EMTDC', 'pscad automation'],
    about: ['PSCAD', 'EMTDC', 'Python', 'Electromagnetic transient simulation'],
    sections: {
      what: `  <p>The Automation Library is not part of the PSCAD install. It is a Python package, published on PyPI as <code>mhi-pscad</code>, that connects to the automation server inside PSCAD and drives it: load a workspace, open a project, read and write a component's parameters, build, run, read the result files. Any Python 3.7 or newer can do it, and PSCAD itself needs a licence certificate before a run will start.</p>
  <p>What matters most is what PSCAD <em>is</em>. PSCAD is an electromagnetic transient simulator, so <strong>there is no load flow to call, no short-circuit calculation and no frequency-domain harmonic scan</strong>. There is one calculation: build the case into Fortran, run it in the time domain, and read the waveforms it recorded. Everything a study asks for comes out of those waveforms.</p>
  <p>That also changes what a script does to the model. There is no event list to fill: <strong>a fault, a trip or a set-point change is a component already drawn in the case</strong>, and a study changes when it happens by writing that component's parameters. A harmonic spectrum, an RMS voltage and a damping ratio are all read out of the recorded waveform afterwards.</p>
  <p>So every PSCAD automation, whatever the study, is the same seven steps: <strong>connect, change, build, run, read, check, record</strong>.</p>`,
      method: `  <ol class="dx-steps">
    <li><strong>Install the Automation Library</strong> into the Python you will run the script with: <code>py -3.12 -m pip install mhi-pscad</code>. The generated scripts check this before they connect, and end with the exact pip line when something is missing, rather than failing halfway through a study.</li>
    <li><strong>Connect.</strong> <code>px_connect()</code> reads the script's own settings: <code>RUN_MODE</code> <code>"auto"</code> uses the PSCAD that is already open, starts one when there is none, and uses the host PSCAD when the file is run from inside it.</li>
    <li><strong>Open the case.</strong> <code>PROJECT</code> is a <code>.pscx</code> path or the name of a case already in the workspace; <code>WORKSPACE</code> loads a <code>.pswx</code> first and <code>LIBRARIES</code> any <code>.pslx</code> the model's components live in.</li>
    <li><strong>Find what you want to change</strong> by definition name, by the component's Name, or both.</li>
    <li><strong>Read and write parameters</strong>, in the unit PSCAD holds them in.</li>
    <li><strong>Build</strong>, because a PSCAD case is Fortran that EMTDC compiles before it can run.</li>
    <li><strong>Run, then read a channel</strong> and take a number off it.</li>
  </ol>
  <h3>Connecting</h3>
  <p>These are the three ways in. A generated script does not call them directly: it calls <code>px_connect()</code>, which picks one from <code>RUN_MODE</code>, installs the compatibility shim an older PSCAD needs, times the attempt out, and turns a failure into a message that names the installed versions it found.</p>
  ${pre(`import mhi.pscad

pscad = mhi.pscad.launch(minimize=True, splash=False, timeout=120)  # start one
pscad = mhi.pscad.connect()                                         # or use the one that is open
pscad = mhi.pscad.application()                                     # or from inside PSCAD

print(pscad.version, mhi.pscad.VERSION)   # the PSCAD, and the Automation Library
print(pscad.licensed())                   # False means a run will not start`)}
  <h3>Opening the case and finding a component</h3>
  ${pre(`app = px_connect()                      # opens PROJECT from SETTINGS

source = px_find(app, "master:source_1")           # exactly one, or an error listing what is there
resistor = px_find(app, "master:resistor", "Load") # a definition and a Name
channels = px_find(app, "master:pgb", match="all") # every output channel in the case`)}
  <p>A definition name is written lower-case namespace first, as PSCAD writes it: <code>master:source_1</code>, <code>master:resistor</code>, <code>master:tfaultn</code>. A definition of the case itself is just its name. Either argument may hold <code>*</code> and <code>?</code>. The <a href="../../reference/">component reference</a> lists every Master Library definition with its parameters.</p>
  <h3>Reading and writing a parameter</h3>
  <p>PSCAD hands a parameter back as a plain number, as text, or as a value that carries its unit, whose text reads <code>2.5 [ohm]</code>. <code>px_get</code> gives you the number and converts the unit when you ask for one; <code>px_set</code> writes in the unit the parameter already carries, so a resistance PSCAD shows in ohm stays in ohm.</p>
  ${pre(`vm = px_get(source, "Vm", unit="kV")      # a number, in kV
rs = px_get(source, "Rs", unit="ohm")

px_set(resistor, "R", 12.5, unit="ohm")   # recorded, so it can be put back
px_set(source, "Vm", 66.0, unit="kV")`)}
  <h3>Building and running</h3>
  ${pre(`build = px_build(app, clean=False)
if not build.ok:
    for line in build.errors:
        log(line, "warn")
    raise SystemExit("the case does not build")

run = px_run(app, duration=0.2, step=50, plot_step=250)   # seconds, us, us
print(run.status, run.t_end, run.names())`)}
  <p><code>step</code> is the EMTDC time step and <code>plot_step</code> how often a channel is written, both in microseconds, as PSCAD shows them. 50 us and 250 us are the usual pair. <code>px_run</code> builds the case first when it needs it, so a script that only ever runs never calls <code>px_build</code> itself.</p>
  <h3>Reading a channel, then recording it</h3>
  ${pre(`voltage = run.series("Mid Point Voltage")   # a Series: t in s, y in the channel's unit
worst = peak(voltage, kind="abs")           # .value and .time

table("First run").add({
    "Peak voltage": worst.value,
    "At (s)": worst.time,
    "Channel unit": voltage.unit,
})
finish(app)   # puts back what was changed, saves the table, writes the summary`)}
  <h3>The calls you use most</h3>
  ${table([{ h: 'Call', fn: r => `<code>${r[0]}</code>`, html: true }, { h: 'What it does', fn: r => r[1] }], CALLS)}
  <p class="dx-note">These are the Builder's runtime helpers, the functions it copies into the file it writes. Each one is a thin layer over the Automation Library that adds the parts a study needs: the units, the error messages that name what the case actually holds, and the record of every change so the case is left as it was found.</p>`,
      builder: builderBlock(b,
        'The Builder draws a workflow as blocks and writes one Python file from it. The simplest useful one is a build: compile the case and table what the compiler said. This is the file it writes, with the case set to <code>vdiv.pscx</code>, one of the tutorial examples that come with PSCAD:',
        [
          '<strong>SETTINGS</strong> at the top are the only lines to edit. <code>PROJECT</code> is the case; <code>RUN_MODE</code>, <code>PSCAD_VERSION</code> and <code>FORTRAN_VERSION</code> say which PSCAD and which compiler to use; <code>OUTPUT_DIR</code> is where the run folder goes; <code>TABLE_FORMAT</code> is <code>"csv"</code>, <code>"xlsx"</code> or <code>"both"</code>.',
          '<code>preflight([])</code> runs before anything else: it imports every package the script needs and ends with the pip line for whatever is missing.',
          '<code>CHECK_ONLY = True</code> connects, finds every component the workflow names, says what it found and stops without building or running. It is the safe first run on a case you have not scripted before.',
          '<code>px_build(app, None, True, False)</code> is a clean build: the previous build is thrown away first, which is the honest thing after a component definition has changed.',
          'The <strong>Built</strong> output of the build decides which table row is written, so a case that does not build still leaves a row, with the compiler errors in it, instead of a traceback.',
          '<code>finish(app)</code> in the <code>finally</code> puts back everything the workflow changed, saves the results table into a new run folder and writes <code>run.log</code> beside it.',
        ], 'build_the_case.py'),
      pitfalls: [
        '<strong>An Automation Library from 2.3 on needs a shim to drive PSCAD 5.0.0.</strong> That PSCAD sends objects back in the <code>mhi.pscad.common</code> namespace, which the library moved to <code>mhi.common</code>. Without an alias the library\'s receive thread dies with <code>ModuleNotFoundError</code> on the first call that returns such an object (<code>Project.scenarios()</code> is one), and the whole connection goes with it. The generated scripts alias the modules before importing <code>mhi.pscad</code>, which costs nothing on a newer PSCAD.',
        '<strong><code>pscad.settings()</code> is not safe to depend on.</strong> Under Automation Library 3.x on an install with no <code>ProductList.xml</code> it raises, so nothing in the runtime reads or writes PSCAD\'s own settings through it. Set the compiler and the version when you connect instead.',
        '<strong>A build that works and a run that does not.</strong> When <code>NoDefaultCurrentDirectoryInExePath</code> is set in the environment, PSCAD inherits it and so do the <code>.bat</code> files EMTDC generates, which call <code>&lt;case&gt;.exe</code> with no path. The case compiles and the run dies with "is not recognized". The generated scripts clear that variable for the run.',
        '<strong>Everything a script writes is written in the case.</strong> There is no read-only session: <code>px_set</code>, enabling a component and changing a substitution all change the model on disk when it is saved. Keep <code>UNDO_CHANGES = True</code>, or work on a copy of the case.',
        '<strong>A licence is checked at the run, not at the connect.</strong> <code>app.licensed()</code> false means PSCAD holds no certificate: the script connects and builds, then the run fails. Open PSCAD and check the licence, or acquire a certificate before running.',
        '<strong>A built case leaves a build folder beside the <code>.pscx</code>.</strong> It holds the generated Fortran, the object files and the executable, and it is large. Keep cases you script outside a repository, or ignore the build folder.',
      ],
      faq: [
        ['How do I run PSCAD from Python?', 'Install the Automation Library with <code>pip install mhi-pscad</code>, then <code>import mhi.pscad</code> and either <code>mhi.pscad.launch()</code> to start a PSCAD or <code>mhi.pscad.connect()</code> to use the one that is open. Open a case on the application object, build it, run it, and read the channels the run recorded. The <a href="../../builder/">Workflow Builder</a> writes all of that for you.'],
        ['Can I run a load flow or a short circuit in PSCAD with Python?', 'No. PSCAD is an electromagnetic transient simulator: the only calculation is a time-domain run, so there is no load flow command and no short-circuit calculation to call. A fault level comes out of running a fault in the time domain and reading the current, and a steady state comes out of running until the case settles.'],
        ['Which Python do I need for the PSCAD Automation Library?', 'Python 3.7 or newer, and 64-bit to match PSCAD\'s own bitness. The library is an ordinary pip package, so any interpreter you can pip into will do; it does not have to be a Python that ships with PSCAD.'],
        ['Do I need a special licence to script PSCAD?', 'The automation server is part of PSCAD, so no separate scripting licence is needed, but PSCAD still needs a licence certificate before a simulation will start. <code>app.licensed()</code> says whether it holds one.'],
      ],
    },
  };
}
