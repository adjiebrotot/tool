// Guide: the PowerFactory Python API, from nothing to a first result.
export default async function ({ results, script, builderScript, builderBlock, pre, esc }) {
  const r = results('getting_started');
  const b = await builderScript('ldf-cases', ({ set }) => set('n1', { project: 'Nine-bus System' }));
  const out = r.stdout.join('\n');
  const CALLS = [
    ['powerfactory.GetApplication()', 'Inside PowerFactory, the program the Python command runs in. From your own Python it starts PowerFactory in engine mode; None when it cannot.'],
    ['powerfactory.GetApplicationExt()', 'Starts PowerFactory in engine mode from your own Python, and raises powerfactory.ExitError with a code when it cannot. Once per Python process.'],
    ['app.ActivateProject(name)', 'Activates a project of the current user by its name; returns 0 when it worked.'],
    ['app.GetActiveStudyCase()', 'The active study case (IntCase); its Activate() switches to another.'],
    ['app.GetProjectFolder("study")', 'A folder of the active project: "study" for study cases, "equip" for the type library, "scen" for operation scenarios.'],
    ['app.GetFromStudyCase("ComLdf")', 'A command or object of the active study case by class: ComLdf, ComShc, ComInc, ComSim, ElmRes, IntEvt.'],
    ['app.GetCalcRelevantObjects("*.ElmLne")', 'Every object of a class in the active grids; the name can be a pattern, as in "Line 4*.ElmLne".'],
    ['obj.GetContents("*.IntCase", 1)', 'The objects stored inside obj that match; 1 also searches the folders below.'],
    ['obj.GetAttribute("m:u")', 'Reads an input parameter or a result. obj.loc_name and obj.plini read the same way.'],
    ['obj.SetAttribute("plini", 140.0)', 'Writes an input parameter. It changes the project.'],
    ['cmd.Execute()', 'Runs a command (load flow, short circuit, simulation); 0 means success.'],
    ['obj.CreateObject("ElmGenstat", name)', 'Creates an object inside obj; obj.Delete() removes one.'],
    ['obj.GetClassName(), obj.GetParent()', 'The class of an object and the object it is stored in.'],
    ['app.ResetCalculation()', 'Drops the results in memory, as the reset button does; needed before deleting what a calculation used.'],
    ['app.SetAttributeModeInternal(1)', 'Reads and writes values in internal units (seconds for times) until it is set back to 0.'],
  ];
  return {
    slug: 'getting-started', crumb: 'Getting started', card: 'PowerFactory Python API: getting started', short: 'the PowerFactory Python API',
    title: 'PowerFactory Python API: getting started with GetApplication',
    h1: 'PowerFactory Python API: getting started',
    desc: 'Start scripting PowerFactory in Python: the powerfactory module, GetApplication and GetApplicationExt, the calls you use most, and a first load flow.',
    lead: `PowerFactory comes with a Python module, <code>powerfactory</code>. Inside PowerFactory, <code>powerfactory.GetApplication()</code> gives you the running program; from your own Python, <code>powerfactory.GetApplicationExt()</code> starts it in the background and tells you why when it cannot. Everything after that is objects: activate a project, run a command such as <code>ComLdf</code>, and read any value with <code>GetAttribute</code>.`,
    whatTitle: 'What the PowerFactory Python API is',
    qs: 'ldf-cases', qsTitle: 'Load flow on every study case',
    refs: ['ElmTerm', 'ElmLne', 'ElmLod'],
    level: 'Beginner',
    keywords: ['python api in powerfactory', 'GetApplication', 'GetApplicationExt', 'powerfactory module', 'PowerFactory engine mode', 'PowerFactory Python script', 'ComPython'],
    about: ['DIgSILENT PowerFactory', 'Python', 'Application programming interface'],
    sections: {
      what: `  <p>The API is a compiled module, <code>powerfactory.pyd</code>, installed with PowerFactory in one folder per Python version, for example <code>C:\\Program Files\\DIgSILENT\\PowerFactory 2024\\Python\\3.12</code>. The Python that imports it must be that version. There are two ways to run a script:</p>
  <ul class="dx-prose">
    <li><strong>Inside PowerFactory</strong>, as a Python command (<code>ComPython</code>) in the project: <code>powerfactory.GetApplication()</code> returns the program you are looking at, with its active project and study case.</li>
    <li><strong>From your own Python</strong> (a terminal, VS Code, Jupyter): add the folder to <code>sys.path</code>, import the module and call <code>powerfactory.GetApplicationExt()</code>. It starts PowerFactory without a window, the engine mode, which is what batch studies use. <code>GetApplication()</code> starts it too, but only returns None when something is wrong, where <code>GetApplicationExt()</code> raises <code>powerfactory.ExitError</code> with a code that says what.</li>
  </ul>
  <p>Everything PowerFactory holds is an object with a class name: elements such as <a href="../../reference/ElmLne/"><code>ElmLne</code></a> (a line) and <a href="../../reference/ElmTerm/"><code>ElmTerm</code></a> (a busbar), types such as <a href="../../reference/TypLne/"><code>TypLne</code></a>, commands such as <code>ComLdf</code> (load flow), and study cases (<code>IntCase</code>). Each object reads and writes its values with <code>GetAttribute</code> and <code>SetAttribute</code>; the <a href="../../reference/">attribute reference</a> lists every name.</p>`,
      method: `  <ol class="dx-steps">
    <li><strong>Find the module folder</strong> for your PowerFactory, and run Python of the same version (3.12 for this folder).</li>
    <li><strong>Connect</strong>: <code>GetApplicationExt()</code> outside PowerFactory, <code>GetApplication()</code> inside it.</li>
    <li><strong>Activate the project</strong> with <code>app.ActivateProject(name)</code>, then the study case you want. The study case decides the grids, the operation scenario and the variations every calculation uses.</li>
    <li><strong>Find objects</strong> with <code>GetCalcRelevantObjects("*.ElmTerm")</code>, or by name with <code>GetCalcRelevantObjects("Load A.ElmLod")</code>.</li>
    <li><strong>Run a command</strong>: <code>app.GetFromStudyCase("ComLdf").Execute()</code>. It returns 0 when it worked.</li>
    <li><strong>Read the results</strong> with <code>GetAttribute</code>, by the attribute's name and prefix (<code>m:u</code> for a busbar voltage).</li>
  </ol>
  <h3>A first script</h3>
  ${pre(script('getting_started'), '<code>getting_started.py</code>')}
  <h3>What it prints on the Nine-bus example</h3>
  <pre><code>${esc(out)}</code></pre>
  <h3>The calls you use most</h3>
  <div class="dx-tw"><table><thead><tr><th>Call</th><th>What it does</th></tr></thead><tbody>
${CALLS.map(([c, w]) => `<tr><td><code>${esc(c)}</code></td><td>${esc(w)}</td></tr>`).join('\n')}
</tbody></table></div>
  <p class="dx-note">Every call in this table was used in the scripts on these pages, run on PowerFactory 2024's example projects.</p>`,
      builder: builderBlock(b,
        'A script the Builder writes is the same API with the chores done: it finds the module folder for the Python that runs it, connects inside PowerFactory or in engine mode, stops with a plain message when the licence or the database is not free, and puts back every value it changed. This is its load flow on every study case, filled in for the Nine-bus example:',
        [
          '<code>RUN_MODE = "auto"</code> runs inside PowerFactory when the file is started there, and in engine mode otherwise. <code>PF_API_PATH</code> stays empty: the script looks for <code>Python\\&lt;version&gt;</code> under <code>Program Files\\DIgSILENT</code> itself.',
          '<code>pf_connect()</code> calls <code>GetApplicationExt()</code> under a watchdog (<code>CONNECT_TIMEOUT</code>), turns <code>ExitError</code> codes into plain words, then activates <code>PROJECT</code> and <code>STUDY_CASE</code>.',
          '<code>CHECK_ONLY = True</code> connects, finds every element the workflow names, says what it found and stops without running anything: a safe first run on a new project.',
          'The workflow itself is <code>main()</code>, one commented step per block; the helpers below it come from the Builder\'s runtime and are copied in only when a block needs them.',
          'Every run writes a new folder with its results tables and a <code>run.log</code>.',
        ], 'load_flow_on_every_study_case.py'),
      pitfalls: [
        '<strong>The Python version must match the module folder.</strong> Importing <code>powerfactory</code> from the 3.12 folder into another Python fails with an import error. Use the matching interpreter, for example <code>py -3.12 script.py</code>.',
        '<strong>One engine per Python process.</strong> Start it once and keep <code>app</code>: a second call in the same process hands back the session already running. In Jupyter, restart the kernel for a fresh one.',
        '<strong>The database can be held by another PowerFactory.</strong> With a local database, a PowerFactory window that is open (or an engine that has not exited) makes <code>GetApplicationExt()</code> fail with <code>ExitError</code> 4002. Close it and wait about 45 s.',
        '<strong>Licence errors are <code>ExitError</code> too</strong>: 3000 no licence found, 3018 no free seat, 3010 a licence without scripting.',
        '<strong>Changes are saved.</strong> There is no "do not save" for an engine session: <code>SetAttribute</code>, <code>CreateObject</code> and <code>Delete</code> change the project. Put values back in a <code>finally</code> block, or work on a copy of the project.',
        '<strong>A project name is exact</strong> and letter case counts. <code>ActivateProject</code> returns non-zero when no project of that name belongs to the current user.',
      ],
      faq: [
        ['What is the difference between GetApplication and GetApplicationExt?', 'Both return the application object, and from your own Python both start PowerFactory in engine mode. When PowerFactory cannot start, <code>GetApplication()</code> returns None, while <code>GetApplicationExt()</code> raises <code>powerfactory.ExitError</code> with an error code (4002 database in use, 3000 no licence). Inside PowerFactory, use <code>GetApplication()</code>.'],
        ['Where is the PowerFactory Python module?', 'In the PowerFactory installation, one folder per Python version, such as <code>C:\\Program Files\\DIgSILENT\\PowerFactory 2024\\Python\\3.12</code>. Add that folder to <code>sys.path</code> before <code>import powerfactory</code>.'],
        ['Which Python version does PowerFactory 2024 use?', 'PowerFactory 2024 installs the module for Python 3.8, 3.9, 3.10, 3.11 and 3.12, one folder each. Use any of them; the scripts on these pages were run with Python 3.12.'],
        ['Can I run PowerFactory from Jupyter or VS Code?', 'Yes: in engine mode with <code>GetApplicationExt()</code>, once per Python process, with the matching Python version.'],
      ],
    },
  };
}
