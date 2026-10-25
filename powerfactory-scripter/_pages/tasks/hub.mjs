// The hub: how to automate PowerFactory studies with Python, linking every guide.
export default async function ({ specs, ORDER, page, PERSON, BASE, UPDATED, pre, esc, all, script }) {
  const BLURB = {
    'getting-started': 'Where the powerfactory module is, GetApplication and GetApplicationExt, and a first load flow.',
    'load-flow': 'Run ComLdf, read every busbar voltage and branch loading, save CSV and Excel.',
    'contingency-analysis': 'Take each line and transformer out in turn and rank the overloads.',
    'short-circuit': 'IEC 60909 at every busbar with ComShc: Ikss, ip and Skss.',
    'hosting-capacity': 'The method step by step, then a hosting capacity map from one script.',
    'parameter-sweep': 'Sweep an input over a range: a PV curve to the nose and a QV curve.',
    'rms-emt-simulation': 'ComInc and ComSim in a loop, curves from ElmRes, plotted.',
  };
  const cards = ORDER.map(s => `    <li><a href="${s}/"><strong>${esc(specs[s].card)}</strong><span>${esc(BLURB[s])}</span></a></li>`).join('\n');
  const skeleton = script("hub_pattern");
  const body = `    <p class="dx-lead">PowerFactory studies are automated with its Python API: a script activates a study case, runs the calculation commands (load flow, short circuit, RMS or EMT simulation) in a loop over study cases, outages or values, reads the results and saves tables and graphs. Each guide below solves one study with a script tested on PowerFactory's example projects, and opens the same study in the <a href="../builder/">Workflow Builder</a>, which writes the Python for you from blocks.</p>
    <section class="dx-sec dx-answer" aria-labelledby="guides">
  <h2 id="guides">Guides, one study each</h2>
  <ul class="dx-cards">
${cards}
  </ul>
</section>
    <section class="dx-sec" aria-labelledby="pattern">
  <h2 id="pattern">The pattern every automation follows</h2>
  <p>Whatever the study, a PowerFactory script does the same seven things. This one is a minimal N-1 loop; the guides fill each step in for their study.</p>
  ${pre(skeleton)}
  <ol class="dx-prose">
    <li><strong>Connect</strong>: <code>GetApplicationExt()</code> from your own Python, <code>GetApplication()</code> inside PowerFactory.</li>
    <li><strong>Activate the project and study case</strong>: they decide the grids, the scenario and the variations.</li>
    <li><strong>Get the command</strong> from the study case: <code>ComLdf</code>, <code>ComShc</code>, <code>ComInc</code> and <code>ComSim</code>.</li>
    <li><strong>Loop</strong> over what the study varies: study cases, outages, a dispatch, a fault location, a clearing time.</li>
    <li><strong>Run and check</strong>: <code>Execute()</code> returns 0 when it worked; anything else is a result to record, not a crash.</li>
    <li><strong>Read the results</strong> with <code>GetAttribute</code>, by the attribute's name (<a href="../reference/">attribute reference</a>).</li>
    <li><strong>Put everything back</strong> in <code>finally</code>, because every change is saved in the project.</li>
  </ol>
</section>
    <section class="dx-sec" aria-labelledby="two-ways">
  <h2 id="two-ways">Write it, or have it written</h2>
  <ul class="dx-prose">
    <li><strong>Write the Python yourself</strong> with the API: the guides give a working script per study and the <a href="../reference/">attribute reference</a> gives every attribute name of ${Object.keys(all).length} PowerFactory classes, with units.</li>
    <li><strong>Draw it in the <a href="../builder/">Workflow Builder</a></strong>: wire blocks for the study, the loops and the checks, and download one Python file. It finds the PowerFactory module, connects inside or in engine mode, keeps a log, saves tables and graphs, and puts back every value it changed. Each guide has an "Open in the Builder" button that loads its study as a Quick Start; <a href="../guides/">how to use the Builder</a> shows the rest.</li>
  </ul>
</section>
    <section class="dx-sec" aria-labelledby="first">
  <h2 id="first">What is worth automating first</h2>
  <ul class="dx-prose">
    <li><strong>The same study on many cases</strong>: every study case, every operation scenario, every year of a plan.</li>
    <li><strong>Screening</strong>: <a href="contingency-analysis/">N-1 outages</a>, <a href="short-circuit/">fault levels at every busbar</a>, <a href="hosting-capacity/">hosting capacity at every busbar</a>.</li>
    <li><strong>Searches</strong>: the largest dispatch that passes, a critical clearing time, a hosting capacity: a few runs with bisection instead of hundreds by hand.</li>
    <li><strong>Reporting</strong>: the same tables and graphs, in the same layout, every time the model changes.</li>
  </ul>
</section>
    <section class="dx-sec" aria-labelledby="faq">
  <h2 id="faq">Questions</h2>
  <h3>Can PowerFactory be automated with Python?</h3>
  <p>Yes. PowerFactory installs a Python module, <code>powerfactory</code>, that reaches every object and command of a project: scripts run inside PowerFactory as Python commands, or from your own Python with PowerFactory in the background.</p>
  <h3>Does scripting need a special licence?</h3>
  <p>The licence has to include scripting. Without it, starting PowerFactory from Python fails with <code>ExitError</code> 3010.</p>
  <h3>Python or DPL?</h3>
  <p>DPL is PowerFactory's own scripting language and runs only inside it. Python reaches the same objects and adds the Python world: pandas for tables, matplotlib for graphs, SciPy for optimisation.</p>
  <h3>Do I need to know Python?</h3>
  <p>Not for the studies the <a href="../builder/">Workflow Builder</a> covers: it writes the script from blocks. Reading the generated file is a good way to learn the API.</p>
</section>`;
  const desc = 'How to automate PowerFactory studies with Python: load flow, N-1, short circuit, hosting capacity, PV and QV curves, RMS and EMT. Tested scripts, free builder.';
  const plain = (h) => String(h).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
  const jsonld = [{
    '@context': 'https://schema.org', '@type': 'TechArticle',
    headline: 'How to automate PowerFactory studies with Python', description: desc,
    url: BASE + 'python/', inLanguage: 'en', dateModified: UPDATED,
    dependencies: 'DIgSILENT PowerFactory 2024 (Python 3.12 API)',
    keywords: 'how to automate powerfactory studies, PowerFactory Python, PowerFactory automation, PowerFactory scripting, DIgSILENT Python API',
    isPartOf: { '@type': 'WebApplication', name: 'PowerFactory Scripter', url: BASE },
    hasPart: ORDER.map(s => ({ '@type': 'TechArticle', name: specs[s].h1Plain || plain(specs[s].h1), url: BASE + `python/${s}/` })),
    author: PERSON, publisher: { '@id': PERSON['@id'] },
  }, {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: [
      ['Can PowerFactory be automated with Python?', 'Yes. PowerFactory installs a Python module, powerfactory, that reaches every object and command of a project: scripts run inside PowerFactory as Python commands, or from your own Python with PowerFactory in the background.'],
      ['Does scripting need a special licence?', 'The licence has to include scripting. Without it, starting PowerFactory from Python fails with ExitError 3010.'],
      ['Python or DPL?', 'DPL is PowerFactory\'s own scripting language and runs only inside it. Python reaches the same objects and adds the Python world: pandas for tables, matplotlib for graphs, SciPy for optimisation.'],
      ['Do I need to know Python?', 'Not for the studies the Workflow Builder covers: it writes the script from blocks. Reading the generated file is a good way to learn the API.'],
    ].map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  }];
  return {
    file: 'python/index.html', url: 'python/',
    html: page({ path: 'python/', title: 'How to automate PowerFactory studies with Python | Adjie Brotools', h1: 'How to automate PowerFactory studies with Python', desc, ogTitle: 'How to automate PowerFactory studies with Python', crumbs: [['Python automation', 'python/']], jsonld, body }),
  };
}
