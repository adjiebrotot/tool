// The hub: how to automate PSCAD studies with Python, linking every guide.
import { adSlot } from '../lib.mjs';
export default async function ({ specs, ORDER, page, PERSON, BASE, UPDATED, pre, esc, definitionCount, pscadVersion }) {
  const BLURB = {
    'getting-started': 'Install mhi-pscad, connect, open a case, build it, run it and read a channel.',
    'build-and-run': 'Compile the case and read the compiler\'s own errors, set the time step and plot step, read the output channels.',
    'fault-studies': 'Fault ride through over fault durations, and the critical clearing time by bisection.',
    'parameter-sweep': 'Step a component parameter through a range, then every layer and every substitution set.',
    'harmonics': 'THD and the harmonic spectrum out of a time-domain run, and what the plot step allows.',
    'snapshots-and-batch': 'Initialise once and branch from a snapshot, and run cases side by side in a simulation set.',
    'control-tuning': 'Overshoot and rise time of a step, and the damping ratio of a ringdown.',
  };
  const cards = ORDER.map(s => `    <li><a href="${s}/"><strong>${esc(specs[s].card)}</strong><span>${esc(BLURB[s])}</span></a></li>`).join('\n');
  const n = definitionCount(), v = pscadVersion();
  const skeleton = `import mhi.pscad

pscad = mhi.pscad.connect()                    # 1. connect (launch() starts a PSCAD)
project = pscad.project("my_case")             # 2. the case, already in the workspace
fault = project.find_all("master:tfaultn")[0]  # 3. the component the study changes

for duration in (0.08, 0.12, 0.16, 0.20):      # 4. the loop
    fault.parameters(DF="%g [s]" % duration)   # 5. change the model
    project.run()                              # 6. build if needed, then run in the time domain
    # 7. read the channels from the .out files, check them, record a row`;
  const body = `    <p class="dx-lead">PSCAD studies are automated with its Python Automation Library, <code>mhi.pscad</code>: a script opens a case, changes components in it, builds and runs it in the time domain, reads the waveforms it recorded and works out what the study asks for. Each guide below covers one kind of study and opens the same study in the <a href="../builder/">Workflow Builder</a>, which writes the whole Python file for you from blocks.</p>
    <section class="dx-sec dx-answer" aria-labelledby="guides">
  <h2 id="guides">Guides, one study each</h2>
  <ul class="dx-cards">
${cards}
  </ul>
</section>
    <section class="dx-sec" aria-labelledby="pattern">
  <h2 id="pattern">The pattern every automation follows</h2>
  <p>PSCAD has one calculation, the EMT run, so every study is the same loop around it. This one times a fault on a Timed Fault Logic block over four durations; the guides fill each step in.</p>
  ${pre(skeleton)}
  <ol class="dx-prose">
    <li><strong>Connect</strong>: <code>mhi.pscad.connect()</code> to the PSCAD that is open, <code>launch()</code> to start one.</li>
    <li><strong>Open the case</strong>: a <code>.pscx</code> in the workspace, with the libraries its components come from.</li>
    <li><strong>Find the components</strong> the study changes, by definition and by Name (<a href="../reference/">component reference</a>).</li>
    <li><strong>Loop</strong> over what the study varies: a fault duration, a parameter, a layer, a substitution set.</li>
    <li><strong>Change the model</strong> by writing parameters. A fault or a switching is a component already drawn in the case: there is no event list.</li>
    <li><strong>Build and run</strong>: the case compiles into Fortran, then EMTDC runs it.</li>
    <li><strong>Read, check, record</strong>: the output channels come back as waveforms; a peak, a nadir, a THD or a damping ratio is worked out from them and written into a table. Then put every parameter back.</li>
  </ol>
</section>
${adSlot()}
    <section class="dx-sec" aria-labelledby="two-ways">
  <h2 id="two-ways">Write it, or have it written</h2>
  <ul class="dx-prose">
    <li><strong>Write the Python yourself</strong> with the Automation Library: the guides show the calls per study, and the <a href="../reference/">component reference</a> lists every parameter of ${n} Master Library definitions${v ? `, read out of PSCAD ${esc(v)}` : ''}, with units and the symbols a Choice takes.</li>
    <li><strong>Draw it in the <a href="../builder/">Workflow Builder</a></strong>: wire blocks for the study, the loops and the checks, and download one Python file. It connects or starts PSCAD, keeps a log, saves tables and graphs, and puts back every value it changed. Each guide has an "Open in the Builder" button that loads its study as a Quick Start.</li>
  </ul>
</section>
    <section class="dx-sec" aria-labelledby="first">
  <h2 id="first">What is worth automating first</h2>
  <ul class="dx-prose">
    <li><strong>Many runs of one case</strong>: every fault duration, every parameter value, every network arrangement held in a layer.</li>
    <li><strong>Searches</strong>: a critical clearing time takes about eight runs by bisection instead of thirty by hand.</li>
    <li><strong>Long start-ups</strong>: a snapshot taken once a case has settled saves simulating the same seconds again for every branch.</li>
    <li><strong>Reading the waveforms</strong>: THD, RMS, sequence components and damping out of every run, written into one table in the same layout every time.</li>
  </ul>
</section>
    <section class="dx-sec" aria-labelledby="faq">
  <h2 id="faq">Questions</h2>
  <h3>Can PSCAD be automated with Python?</h3>
  <p>Yes. The PSCAD Automation Library, <code>pip install mhi-pscad</code>, drives PSCAD from any Python 3.7 or newer: open a workspace and a case, read and write component parameters, build, run and read the result files.</p>
  <h3>Does scripting need a separate licence?</h3>
  <p>No separate scripting licence: the automation server is part of PSCAD. PSCAD still needs a licence certificate before a run will start.</p>
  <h3>Can a script run several cases at once?</h3>
  <p>Yes, through a simulation set: PSCAD runs its cases in volleys, several at a time. A script that only loops runs one case after the other.</p>
  <h3>Do I need to know Python?</h3>
  <p>Not for the studies the <a href="../builder/">Workflow Builder</a> covers: it writes the script from blocks. Reading the generated file is a good way to learn the library.</p>
</section>`;
  const desc = 'How to automate PSCAD studies with Python: build and run, fault ride through and CCT, parameter sweeps, harmonics, snapshots and batch runs, control tuning.';
  const plain = (h) => String(h).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
  const FAQ = [
    ['Can PSCAD be automated with Python?', 'Yes. The PSCAD Automation Library, pip install mhi-pscad, drives PSCAD from any Python 3.7 or newer: open a workspace and a case, read and write component parameters, build, run and read the result files.'],
    ['Does scripting need a separate licence?', 'No separate scripting licence: the automation server is part of PSCAD. PSCAD still needs a licence certificate before a run will start.'],
    ['Can a script run several cases at once?', 'Yes, through a simulation set: PSCAD runs its cases in volleys, several at a time. A script that only loops runs one case after the other.'],
    ['Do I need to know Python?', 'Not for the studies the Workflow Builder covers: it writes the script from blocks. Reading the generated file is a good way to learn the library.'],
  ];
  const jsonld = [{
    '@context': 'https://schema.org', '@type': 'TechArticle',
    headline: 'How to automate PSCAD studies with Python', description: desc,
    url: BASE + 'python/', inLanguage: 'en', dateModified: UPDATED,
    dependencies: 'PSCAD 5 with the EMTDC solver, and the PSCAD Automation Library (mhi-pscad) on Python 3.7 or newer',
    keywords: 'how to automate pscad studies, PSCAD Python, mhi.pscad, PSCAD automation, PSCAD scripting, EMTDC Python',
    isPartOf: { '@type': 'WebApplication', name: 'PSCAD Scripter', url: BASE },
    hasPart: ORDER.map(s => ({ '@type': 'TechArticle', name: specs[s].h1Plain || plain(specs[s].h1), url: BASE + `python/${s}/` })),
    author: PERSON, publisher: { '@id': PERSON['@id'] },
  }, {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  }];
  return {
    file: 'python/index.html', url: 'python/',
    html: page({ path: 'python/', title: 'How to automate PSCAD studies with Python | Adjie Brotools', h1: 'How to automate PSCAD studies with Python', desc, ogTitle: 'How to automate PSCAD studies with Python', crumbs: [['Python automation', 'python/']], jsonld, body }),
  };
}
