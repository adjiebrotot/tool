// Guide: the build and the run themselves. What the Fortran build is, what a build error means,
// the two time steps, and what a run leaves behind.
export default async function ({ builderScript, builderBlock, pre, table }) {
  const b = await builderScript('build-check', ({ set }) => set('n1', {
    project: 'C:/work/mycase.pscx',
  }));

  const STEPS = [
    ['Duration', 'seconds', 'How long the simulation runs in simulated time. An EMT run of 5 s is a long run; most studies are under 10 s.'],
    ['Solution time step', 'microseconds', 'The EMTDC step. 50 us is the usual choice. Switching devices and travelling waves want it smaller; it sets how long the run takes more than anything else does.'],
    ['Channel plot step', 'microseconds', 'How often an output channel is written. 250 us is the usual choice. It does not change the solution, only what is recorded, and it is what limits how far up a harmonic spectrum is real.'],
  ];

  return {
    slug: 'build-and-run', crumb: 'Build and run',
    card: 'Build a PSCAD case and run it from Python',
    title: 'Build and run a PSCAD case from Python (EMTDC, Fortran, time step)',
    h1: 'Build a PSCAD case and run it from Python',
    desc: 'Compile a PSCAD case with its Fortran compiler, read the build errors back, set the duration and the two time steps, run the EMT simulation and read the output channels.',
    lead: `A PSCAD case is not interpreted: it is <strong>translated into Fortran, compiled and linked into an executable</strong> that EMTDC runs. That is why a script has to build before it runs, why a build error is a compiler error, and why changing a parameter can cost a rebuild. This page is what the build and the run actually do, what the two time steps mean, and how to get the compiler's own words back into your script rather than a traceback.`,
    whatTitle: 'What building a PSCAD case means',
    methodTitle: 'Building, then running',
    qsTitle: 'Build the case and report its errors',
    level: 'Beginner',
    keywords: ['pscad build case python', 'pscad build error', 'EMTDC fortran compile', 'pscad time step', 'pscad plot step', 'pscad run from python', 'mhi.pscad build'],
    about: ['PSCAD', 'EMTDC', 'Fortran', 'Electromagnetic transient simulation'],
    sections: {
      what: `  <p>When PSCAD builds a case it writes a Fortran source file for every page of the schematic, calls the Fortran compiler on them, and links the result with the EMTDC libraries into one executable beside the case. The run is that executable; PSCAD only starts it and reads what it writes.</p>
  <p>Two things follow, and both show up in a script.</p>
  <ul class="dx-prose">
    <li><strong>A build error is a compiler error.</strong> It names a generated Fortran file and a line in it, not your schematic. The usual causes are a component with a parameter it cannot use, a signal wired to nothing, or two signals with the same name on a page. The message is worth putting in your results rather than throwing away.</li>
    <li><strong>A build is not free.</strong> A clean build of a large case is minutes. Most parameter changes do not need one, but anything that changes the generated code does, and PSCAD decides that for itself. A script that runs in a loop should let PSCAD decide rather than forcing a clean build every pass.</li>
  </ul>
  <p>There is a third thing worth knowing before the first script: <strong>the build leaves a folder beside the case</strong>, named after the compiler (<code>mycase.gf46</code> for GFortran 4.6). It holds the generated Fortran, the object files and the executable, and it is large. Keep scripted cases out of a repository, or ignore that folder.</p>`,
      method: `  <h3>Build, and read what the compiler said</h3>
  <p><code>px_build</code> compiles the case and hands back a result rather than raising: <code>.ok</code>, <code>.errors</code>, <code>.warnings</code>, <code>.messages</code> and <code>.seconds</code>. A case that does not build is a result to record, not a crash.</p>
  ${pre(`build = px_build(app, clean=False)

print(build.ok, build.seconds)
for line in build.errors:
    log(line, "warn")
for line in build.warnings:
    log(line)`)}
  <p class="dx-note">PSCAD replaces a project's message list at the start of every clean, build and run rather than appending to it, so there is no delta to track: whatever <code>messages()</code> holds after a build belongs to that build.</p>
  <h3>A clean build, and when it is worth it</h3>
  <p><code>clean=True</code> throws the previous build away first. It is the honest thing to do after a component definition has changed, after a library has been swapped, or when a build failure makes no sense; it is wasted time inside a loop.</p>
  ${pre(`px_build(app, clean=True)     # first pass: start from nothing
for value in values:
    px_set(load, "P", value, unit="MW")
    px_run(app, duration=2, step=50, plot_step=250)   # builds again only if it has to`)}
  <h3>The run, and its three numbers</h3>
  ${table([{ h: 'Setting' }, { h: 'Unit' }, { h: 'What it does' }].map((c, i) => ({ ...c, fn: r => r[i] })), STEPS)}
  <p>They are written together, and a script usually writes them once before the loop rather than per run:</p>
  ${pre(`sim_settings(app, duration=5.0, step=50, plot_step=250)   # s, us, us

run = px_run(app)                 # or px_run(app, duration=2, step=20, plot_step=100)
print(run.status, run.t_end)
print(run.names())                # every channel the run recorded`)}
  <p>A run that stops early is still a result. <code>run.status</code> says why and <code>run.t_end</code> is how far it got, so an unstable case leaves a row saying it went unstable at 1.8 s instead of an exception.</p>
  <h3>What a run leaves behind, and how it is read</h3>
  <p>Output channels are written to plain text files beside the case, <strong>ten channels to a <code>.out</code> file</strong>, with a <code>.inf</code> index naming them in order. A three phase channel becomes three columns, named <code>Desc:1</code> to <code>Desc:3</code>.</p>
  ${pre(`v = run.series("Vpcc")        # by the channel's title, as the .inf index names it
print(v.unit, len(v.t))       # the unit comes from the index, not from a guess

a = run.series("Iline:1")     # one phase of a three phase channel
missing = run.series("Typo")  # an empty Series and one warning, never an error`)}
  <p class="dx-note">A channel name the run did not record gives back an empty Series rather than raising, so one wrong name in a long sweep does not lose the rest of the results. The warning says which name, and <code>run.names()</code> lists what was actually there.</p>`,
      builder: builderBlock(b,
        'The smallest useful workflow is a build on its own: open the case, compile it, and write what the compiler said into a table. It is worth running first on any case you have not scripted before, because it separates "the model does not build" from "the script is wrong". This is the file the Builder writes:',
        [
          '<code>CHECK_ONLY = True</code> at the top connects, finds every component the workflow names, reports what it found and stops before building. Run it that way once on a new case.',
          '<code>px_build(app, None, True, False)</code> is the clean build: throw the previous one away, then compile.',
          'The build block has two outputs, <strong>Built</strong> and <strong>Did not build</strong>, and both are wired. A case that fails to compile leaves a row with the compiler errors in it rather than ending the script.',
          'The errors and warnings go into the table as text, so a run over several cases ends with one file saying which built and what the others said.',
          '<code>finish(app)</code> in the <code>finally</code> saves the table into a new run folder and writes <code>run.log</code> beside it, whatever happened on the way.',
        ], 'build_and_run.py'),
      pitfalls: [
        '<strong>The case builds and the run dies with "is not recognized".</strong> Some hardened environments set <code>NoDefaultCurrentDirectoryInExePath</code>, PSCAD inherits it, and so do the batch files EMTDC generates, which call <code>&lt;case&gt;.exe</code> with no path in front of it. Clear that variable for the run; the generated scripts do it for you.',
        '<strong>A rebuild you did not expect.</strong> PSCAD decides for itself whether a change needs the Fortran written again. Writing a parameter that is used at build time triggers one; writing a value that is only read at run time does not. In a sweep this shows up as a few slow passes among fast ones, which is normal.',
        '<strong>The plot step is not the solution step.</strong> Making the plot step smaller records more points and changes nothing about the answer; making the solution step smaller changes the answer and the run time. If a waveform looks coarse, the plot step is the one to change first.',
        '<strong>A long run with a small plot step writes a lot.</strong> Ten seconds at 50 us is 200,000 points per channel. Record what you need and leave the rest of the channels disabled.',
        '<strong>Build errors scroll past.</strong> They are in the project\'s message list, and PSCAD replaces that list on the next build, so read them into your results on the spot rather than afterwards.',
        '<strong>Two cases built at once in the same folder collide.</strong> Each build writes into the same folder beside the <code>.pscx</code>. Run cases in parallel as a simulation set, or give each its own copy.',
      ],
      faq: [
        ['Why does PSCAD have to build a case before running it?', 'A PSCAD case is translated into Fortran, compiled and linked into an executable that EMTDC runs. The build is that translation and compilation. Anything that changes the generated code needs it done again, and PSCAD works out for itself whether a given change does.'],
        ['What does a PSCAD build error mean?', 'It is a Fortran compiler error against the generated source, so it names a generated file and a line, not a part of your schematic. The usual causes are a component given a parameter it cannot use, a signal wired to nothing, or two signals sharing a name on one page.'],
        ['What time step should I use in PSCAD?', '50 us for the solution step suits most power system studies. Power electronics with fast switching, travelling waves and surge studies want smaller. The plot step, which only sets how often a channel is recorded, is usually 250 us and does not change the solution.'],
        ['How do I read a PSCAD output channel in Python?', 'Run the case, then read the channel by the title shown on its Output Channel component. The values are written ten channels to a .out file with a .inf index naming them in order, and a three phase channel appears as three columns named Desc:1 to Desc:3.'],
      ],
    },
  };
}
