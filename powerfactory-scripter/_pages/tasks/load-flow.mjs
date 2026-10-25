// Guide: PowerFactory load flow with Python, and the results to CSV and Excel.
export default async function ({ results, script, builderScript, builderBlock, pre, esc }) {
  const r = results('load_flow');
  const { buses, branches } = r.data;
  const { barChart, table } = await import('../lib.mjs');
  const f = (v, d) => Number(v).toFixed(d);
  const b = await builderScript('ldf-cases', ({ set }) => set('n1', { project: 'Nine-bus System' }));
  const worst = branches.reduce((a, x) => (x['Loading (%)'] > a['Loading (%)'] ? x : a));
  const low = buses.reduce((a, x) => (x['Voltage (p.u.)'] < a['Voltage (p.u.)'] ? x : a));
  return {
    slug: 'load-flow', crumb: 'Load flow', card: 'Load flow and results to CSV or Excel', short: 'a load flow',
    title: 'PowerFactory Python load flow: run it and export results to CSV and Excel',
    h1: 'PowerFactory load flow with Python, and the results in CSV or Excel',
    desc: 'Run a PowerFactory load flow from Python with ComLdf, read busbar voltages and line loadings, and save them to CSV and Excel. Tested script and results.',
    lead: `In PowerFactory's Python API a load flow is one call: <code>app.GetFromStudyCase("ComLdf").Execute()</code>, which returns <strong>0 when it converged</strong>. The results are then attributes: <code>m:u</code> for a busbar's voltage, <code>c:loading</code> for a line's loading. This page runs it on the Nine-bus example and saves every busbar and branch to CSV and Excel.`,
    whatTitle: 'What a load flow gives you',
    qs: 'ldf-cases', qsTitle: 'Load flow on every study case',
    refs: ['ElmTerm', 'ElmLne', 'ElmTr2', 'ElmSym', 'ElmLod'],
    keywords: ['powerfactory python load flow', 'ComLdf Execute', 'PowerFactory export results to Excel', 'PowerFactory results to CSV', 'm:u', 'c:loading', 'iopt_net'],
    about: ['Load flow', 'DIgSILENT PowerFactory', 'Python'],
    sections: {
      what: `  <p>A load flow (power flow) solves the steady state of the network for one operating point: the voltage magnitude and angle at every busbar, and from them the active and reactive power, current and loading of every line, transformer and generator. It is the base of almost every other study: contingency analysis repeats it per outage, hosting capacity repeats it per injection, a PV curve repeats it per load level.</p>
  <p>In PowerFactory the load flow is a command object, <code>ComLdf</code>, stored in the study case. The study case decides what it solves: which grids are active, which operation scenario and which variations apply. Python only activates the case, sets the command's options, runs it and reads the answers.</p>`,
      method: `  <ol class="dx-steps">
    <li><strong>Connect.</strong> <code>powerfactory.GetApplicationExt()</code> from your own Python (PowerFactory starts in the background), or <code>powerfactory.GetApplication()</code> inside a Python command in PowerFactory.</li>
    <li><strong>Activate the project and the study case</strong> with <code>app.ActivateProject(name)</code> and the case's <code>Activate()</code>.</li>
    <li><strong>Get the load flow command</strong> with <code>app.GetFromStudyCase("ComLdf")</code> and set the options of this run: <code>iopt_net</code> (0 balanced AC, 1 unbalanced, 2 DC), <code>iopt_lim</code> (reactive power limits), <code>iopt_at</code> (automatic taps).</li>
    <li><strong>Run it.</strong> <code>Execute()</code> returns 0 when the load flow converged. Anything else means there is no valid result to read.</li>
    <li><strong>Read the results</strong> with <code>GetAttribute</code>: <code>m:u</code>, <code>m:Ul</code> and <code>m:phiu</code> on terminals (<code>ElmTerm</code>), <code>c:loading</code>, <code>m:P:bus1</code> and <code>c:Ploss</code> on lines (<code>ElmLne</code>), with <code>:bushv</code> or <code>:buslv</code> on transformers.</li>
    <li><strong>Save them</strong> as rows: the <code>csv</code> module for CSV, pandas for Excel. Put the command's options back so the study case stays as it was.</li>
  </ol>
  <h3>The script</h3>
  <p>This runs as it is on the Nine-bus System, one of the example projects that come with PowerFactory 2024. Change <code>PROJECT</code> and <code>STUDY_CASE</code> for your own.</p>
  ${pre(script('load_flow'), '<code>load_flow.py</code>')}
  <h3>Result on the Nine-bus example</h3>
  <p>The whole script, files included, runs in ${f(r.seconds, 1)} s. The most loaded branch is <strong>${esc(worst.Branch)} at ${f(worst['Loading (%)'], 1)} %</strong>, and the lowest voltage is <strong>${f(low['Voltage (p.u.)'], 4)} p.u. at ${esc(low.Busbar)}</strong>, the busbar of the largest load.</p>
  ${barChart({ title: 'Loading of every line and transformer in the Nine-bus example after the load flow', bars: branches.map(x => ({ label: x.Branch, v: x['Loading (%)'], c: x.Class === 'ElmTr2' ? 2 : 1 })), y: { label: 'Loading', unit: '%', min: 0, max: 100 }, keys: [['k1', 'Line (ElmLne)'], ['k2', 'Transformer (ElmTr2)']], caption: 'Read with c:loading after the load flow.' })}
  ${table([{ h: 'Busbar', key: 'Busbar' }, { h: 'Nominal', unit: 'kV', num: true, fn: x => f(x['Nominal (kV)'], 1) }, { h: 'Voltage', unit: 'p.u.', num: true, fn: x => f(x['Voltage (p.u.)'], 4) }, { h: 'Voltage', unit: 'kV', num: true, fn: x => f(x['Voltage (kV)'], 2) }, { h: 'Angle', unit: 'deg', num: true, fn: x => f(x['Angle (deg)'], 2) }], buses)}
  ${table([{ h: 'Branch', key: 'Branch' }, { h: 'Class', fn: x => `<code>${x.Class}</code>`, html: true }, { h: 'Loading', unit: '%', num: true, fn: x => f(x['Loading (%)'], 1) }, { h: 'P', unit: 'MW', num: true, fn: x => f(x['P (MW)'], 1) }, { h: 'Q', unit: 'Mvar', num: true, fn: x => f(x['Q (Mvar)'], 1) }, { h: 'Losses', unit: 'MW', num: true, fn: x => f(x['Losses (MW)'], 2) }], branches)}
  <p class="dx-note">P and Q are read at terminal i of each line (<code>:bus1</code>) and at the HV side of each transformer (<code>:bushv</code>); a negative value flows into the branch from the other end. The script also wrote <code>load_flow_buses.csv</code>, <code>load_flow_branches.csv</code> and <code>load_flow_results.xlsx</code>.</p>`,
      builder: builderBlock(b,
        'The Builder writes the same study for <strong>every study case</strong> of a project, with one row per case: its lowest and highest busbar voltage and where they are. On the Nine-bus example its 8 study cases give 8 rows; the one case with no grid in it keeps its row with the reason the load flow did not converge. This is the file it writes for the example (only <code>PROJECT</code> filled in):',
        [
          '<strong>SETTINGS</strong> at the top are the only lines to edit: the project, the study case to start from, where the run folder goes, and <code>TABLE_FORMAT</code> (<code>"csv"</code>, <code>"xlsx"</code> or <code>"both"</code>).',
          '<strong>Step 2</strong> lists the study cases that match <code>STUDY_CASE_PATTERN</code> and activates each in turn (<code>each_case</code>).',
          '<strong>Step 3</strong>, <code>run_load_flow</code>, runs the case\'s own <code>ComLdf</code>. When it does not converge, <code>case_skipped</code> keeps the row with the reason and the loop goes on to the next case.',
          '<strong>Step 4</strong> reads <code>m:u</code> of every busbar in service and energised, and keeps the lowest and highest with where they are.',
          '<strong>Step 5</strong> adds the row to the "Load flow" table, saved at the end as CSV or Excel in a new run folder, next to a <code>run.log</code>.',
          '<code>finish(app)</code> puts back every value the workflow changed and the study case it started from.',
        ], 'load_flow_on_every_study_case.py'),
      pitfalls: [
        '<strong>Check <code>Execute()</code> before reading.</strong> 0 means converged. After a failed load flow the <code>m:</code> and <code>c:</code> values are not a solution, yet <code>GetAttribute</code> still returns numbers.',
        '<strong>Branch results need the end.</strong> <code>m:P</code> on a line raises <code>AttributeError</code>: write <code>m:P:bus1</code> or <code>m:P:bus2</code>, and <code>m:P:bushv</code> or <code>m:P:buslv</code> on a 2-winding transformer. <code>c:loading</code> has no end.',
        '<strong>Angles include transformer phase shifts.</strong> Bus 4 of the Nine-bus example reads 147.8 deg because generator transformer T1 shifts the angle by 150 deg. Compare angles on the same side of a transformer.',
        '<strong>Changed options are saved in the project.</strong> <code>SetAttribute</code> on <code>ComLdf</code> changes the study case for good, so the script keeps the old values and puts them back in <code>finally</code>.',
        '<strong><code>GetFromStudyCase</code> makes what is missing.</strong> If the study case has no <code>ComLdf</code>, it silently creates one with default options. Check <code>case.GetContents("*.ComLdf")</code> when the options matter.',
        '<strong>Excel needs pandas and openpyxl in the Python that runs the script.</strong> The CSV files need nothing beyond the standard library.',
      ],
      faq: [
        ['How do I run a load flow in PowerFactory with Python?', 'Activate the study case, then call <code>app.GetFromStudyCase("ComLdf").Execute()</code>. It returns 0 when the load flow converged.'],
        ['How do I read busbar voltages after the load flow?', 'Loop over <code>app.GetCalcRelevantObjects("*.ElmTerm")</code> and read <code>GetAttribute("m:u")</code> for per unit, <code>"m:Ul"</code> for line-line kV and <code>"m:phiu"</code> for the angle in degrees.'],
        ['How do I export PowerFactory load flow results to Excel?', 'Read the values into a list of dictionaries, then write it with <code>pandas.DataFrame(rows).to_excel("results.xlsx")</code> (pandas and openpyxl installed), or with the <code>csv</code> module for CSV.'],
        ['What does iopt_net mean on ComLdf?', 'The network representation of the load flow: 0 balanced AC (positive sequence), 1 unbalanced three-phase AC, 2 DC load flow.'],
      ],
    },
  };
}
