// The hub: how to automate PSCAD studies with Python, linking every guide.
export default async function ({ specs, ORDER, page, PERSON, BASE, UPDATED, pre, esc, adSlot, definitionCount, pscadVersion }) {
  const BLURB = {
    'getting-started': 'The Automation Library, connecting, opening a case, the build, one run, reading a channel.',
    'build-and-run': 'Build the case, read the compiler back, set the time step and run the EMT simulation.',
    'fault-studies': 'Sweep a fault duration for ride through, then bisect it for a critical clearing time.',
    'parameter-sweep': 'Change one parameter over a range, run each value, and collect the results in one table.',
    'harmonics': 'THD and a harmonic spectrum from the recorded waveform, and the plot step that limits them.',
    'snapshots-and-batch': 'Run once to a settled state, start every later run from it, and run cases several at a time.',
    'control-tuning': 'Disturb a control, fit the damping of the ringdown, and search for the gain that settles it.',
  };
  const n = definitionCount();
  const v = pscadVersion();
  const cards = ORDER.map(s => `    <li><a href="${s}/"><strong>${esc(specs[s].card)}</strong><span>${esc(BLURB[s])}</span></a></li>`).join('\n');
  const skeleton = `import mhi.pscad

pscad = mhi.pscad.connect()                   # or launch()
project = pscad.project("mycase")

fault = project.find_all("master:tfaultn")[0]
before = fault.parameters()                   # so it can be put back

rows = []
try:
    for duration in (0.08, 0.12, 0.16, 0.20):
        fault.parameters(DF=duration)         # 1. change the model
        project.build()                       # 2. Fortran, every time it changed
        project.run()                         # 3. the time domain run
        v = read_channel(project, "Vpcc")     # 4. read the recorded waveform
        rows.append({"Fault (s)": duration,   # 5. take the number off it
                     "Lowest voltage": min(v)})
finally:
    fault.parameters(**before)                # 6. leave the case as you found it`;
  const body = `    <p class="dx-lead">PSCAD is automated through its <strong>Automation Library</strong>, the Python package <code>mhi.pscad</code>. A script opens a case, writes the parameters of the components already drawn in it, builds the case into Fortran, runs the EMT simulation, and reads the waveforms the run recorded. Every study on this page is that same loop with a different thing varied and a different number taken off the waveform. Each guide opens the same study in the <a href="../builder/">Workflow Builder</a>, which writes the Python for you from blocks.</p>
    <section class="dx-sec dx-answer" aria-labelledby="guides">
  <h2 id="guides">Guides, one study each</h2>
  <ul class="dx-cards">
${cards}
  </ul>
</section>
    <section class="dx-sec" aria-labelledby="pattern">
  <h2 id="pattern">The pattern every PSCAD automation follows</h2>
  <p>PSCAD has one calculation: build the case and run it in the time domain. There is no load flow to call, no short-circuit command and no frequency-domain harmonic scan, so every study is a loop of runs over something changed in the model, with the answer read out of the recorded waveform afterwards.</p>
  ${pre(skeleton)}
  <ol class="dx-prose">
    <li><strong>Connect</strong>: <code>mhi.pscad.connect()</code> for the PSCAD that is open, <code>launch()</code> to start one, <code>application()</code> from inside PSCAD.</li>
    <li><strong>Change the model</strong>, because there is no event list: a fault, a trip or a set-point change is a component already in the case, and a study writes its parameters.</li>
    <li><strong>Build</strong>: the case is Fortran, and it has to be compiled again after anything that changes the generated code.</li>
    <li><strong>Run</strong>: duration in seconds, the solution step and the plot step in microseconds.</li>
    <li><strong>Read the channels</strong>: the output channels in the case are written ten to a <code>.out</code> file with a <code>.inf</code> index naming them.</li>
    <li><strong>Check and record</strong>: an RMS, a THD, a nadir or a damping ratio, worked out from the waveform and written into a table.</li>
    <li><strong>Put everything back</strong>, because a parameter a script writes is written in the case, not in a session.</li>
  </ol>
</section>
${adSlot()}
    <section class="dx-sec" aria-labelledby="two-ways">
  <h2 id="two-ways">Write it, or have it written</h2>
  <ul class="dx-prose">
    <li><strong>Write the Python yourself</strong>: the guides give the method and a working script per study, and the <a href="../reference/">component reference</a> gives every parameter of ${n ? n.toLocaleString('en-AU') : ''} Master Library definitions${v ? `, read out of PSCAD ${esc(v)} itself` : ''}, with units, ranges and defaults.</li>
    <li><strong>Draw it in the <a href="../builder/">Workflow Builder</a></strong>: wire blocks for the model, the run, the checks and the loops, and download one Python file. It finds the Automation Library, connects or launches, reports the compiler's own errors, reads the channels, keeps a log, saves tables and graphs, and puts back every parameter, layer state and substitution it changed. Each guide has an "Open in the Builder" button that loads its study as a Quick Start.</li>
  </ul>
</section>
    <section class="dx-sec" aria-labelledby="first">
  <h2 id="first">What is worth automating first</h2>
  <ul class="dx-prose">
    <li><strong>Anything that is the same run many times over</strong>: <a href="fault-studies/">every fault duration</a>, <a href="parameter-sweep/">every value of a parameter</a>, every network arrangement.</li>
    <li><strong>Runs that take long enough to be worth not watching</strong>: an EMT run takes as long as it takes, and a sweep of them is an afternoon of starting the next one by hand.</li>
    <li><strong>Searches</strong>: a <a href="fault-studies/">critical clearing time</a> or the <a href="control-tuning/">gain that just settles</a>, found by bisection in a handful of runs rather than a grid of them.</li>
    <li><strong>The reading of the waveform</strong>: an <a href="harmonics/">RMS, a THD or a damping ratio</a> worked out the same way every time, instead of by eye off a graph.</li>
  </ul>
</section>
    <section class="dx-sec" aria-labelledby="faq">
  <h2 id="faq">Questions</h2>
  <h3>Can PSCAD be automated with Python?</h3>
  <p>Yes. PSCAD has an automation server, and the Automation Library (<code>pip install mhi-pscad</code>) is the Python package that drives it: open a workspace and a project, read and write any component's parameters, build, run, and read the results the run recorded.</p>
  <h3>Can I run a load flow or a short circuit in PSCAD from Python?</h3>
  <p>No, and not from the interface either. PSCAD is an electromagnetic transient simulator: the only calculation is a time-domain run. A fault level comes out of applying a fault and reading the current; a steady state comes out of running until the case settles.</p>
  <h3>Why does a PSCAD case have to be built before it runs?</h3>
  <p>A PSCAD case is compiled into Fortran and linked into an executable that EMTDC runs. Anything that changes the generated code, including most parameter changes, needs the case built again, and a build error is a compiler error with a line in the generated source.</p>
  <h3>Do I need to know Python?</h3>
  <p>Not for the studies the <a href="../builder/">Workflow Builder</a> covers: it writes the script from blocks. Reading the file it writes is a good way to learn the Automation Library.</p>
</section>`;
  const desc = 'How to automate PSCAD studies with Python: build and run, fault ride through, critical clearing time, parameter sweeps, harmonics and THD, snapshots, batch runs and control tuning.';
  const plain = (h) => String(h).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
  const FAQ = [
    ['Can PSCAD be automated with Python?', 'Yes. PSCAD has an automation server, and the Automation Library (pip install mhi-pscad) is the Python package that drives it: open a workspace and a project, read and write any component’s parameters, build, run, and read the results the run recorded.'],
    ['Can I run a load flow or a short circuit in PSCAD from Python?', 'No, and not from the interface either. PSCAD is an electromagnetic transient simulator: the only calculation is a time-domain run. A fault level comes out of applying a fault and reading the current; a steady state comes out of running until the case settles.'],
    ['Why does a PSCAD case have to be built before it runs?', 'A PSCAD case is compiled into Fortran and linked into an executable that EMTDC runs. Anything that changes the generated code, including most parameter changes, needs the case built again, and a build error is a compiler error with a line in the generated source.'],
    ['Do I need to know Python?', 'Not for the studies the Workflow Builder covers: it writes the script from blocks. Reading the file it writes is a good way to learn the Automation Library.'],
  ];
  const jsonld = [{
    '@context': 'https://schema.org', '@type': 'TechArticle',
    headline: 'How to automate PSCAD studies with Python', description: desc,
    url: BASE + 'python/', inLanguage: 'en', dateModified: UPDATED,
    dependencies: 'PSCAD 5 with the EMTDC solver, and the PSCAD Automation Library (mhi-pscad) on Python 3.7 or newer',
    keywords: 'how to automate pscad studies, PSCAD Python, PSCAD automation, mhi.pscad, PSCAD Automation Library, EMTDC scripting, PSCAD batch simulation',
    isPartOf: { '@type': 'WebApplication', name: 'PSCAD Scripter', url: BASE },
    hasPart: ORDER.map(s => ({ '@type': 'TechArticle', name: specs[s].h1Plain || plain(specs[s].h1), url: BASE + `python/${s}/` })),
    author: PERSON, publisher: { '@id': PERSON['@id'] },
  }, {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  }];
  return {
    file: 'python/index.html', url: 'python/',
    html: page({ path: 'python/', title: 'How to automate PSCAD studies with Python | Adjie Brotools', h1: 'How to automate PSCAD studies with Python', desc, ogTitle: 'How to automate PSCAD studies with Python', ogType: 'website', crumbs: [['Python automation', 'python/']], jsonld, body }),
  };
}
