// Guide: N-1 contingency analysis in PowerFactory with Python.
export default async function ({ results, script, builderScript, builderBlock, pre, esc }) {
  const r = results('contingency');
  const rows = r.data.rows;
  const { barChart, table } = await import('../lib.mjs');
  const f = (v, d) => Number(v).toFixed(d);
  const b = await builderScript('n-1', ({ set }) => set('n1', { project: '39 Bus New England System', studyCase: '1. Power Flow' }));
  const base = rows[0];
  const outs = rows.slice(1);
  const over = outs.filter(x => x['Highest loading (%)'] > 100).sort((a, c) => c['Highest loading (%)'] - a['Highest loading (%)']);
  const top = outs.filter(x => x.Converged === 'yes').sort((a, c) => c['Highest loading (%)'] - a['Highest loading (%)']).slice(0, 12);
  const nLines = outs.filter(x => /^Line /.test(x.Outage)).length;
  const get = (name) => outs.find(x => x.Outage === name);
  const l2122 = get('Line 21 - 22'), l2324 = get('Line 23 - 24'), l1619 = get('Line 16 - 19');
  return {
    slug: 'contingency-analysis', crumb: 'N-1 contingency analysis', card: 'N-1 contingency analysis', short: 'an N-1 contingency analysis',
    title: 'PowerFactory contingency analysis with Python: an N-1 script that works',
    h1: 'N-1 contingency analysis in PowerFactory with Python',
    desc: 'An N-1 contingency analysis script for PowerFactory: take each line and transformer out, run the load flow, rank the overloads. Tested, with results.',
    lead: `An N-1 screening in Python is a loop: take one line or transformer out of service with <code>SetAttribute("outserv", 1)</code>, run the load flow, record the highest loading and the lowest voltage, and put the element back. On PowerFactory's 39-bus example, <strong>${over.length} of ${outs.length} outages overload a branch</strong>, the worst to ${f(over[0]['Highest loading (%)'], 1)} %.`,
    whatTitle: 'What N-1 contingency analysis is',
    qs: 'n-1', qsTitle: 'N-1 screening',
    refs: ['ElmLne', 'ElmTr2', 'ElmTerm', 'ElmSym', 'EvtOutage'],
    level: 'Intermediate',
    keywords: ['powerfactory contingency python', 'N-1 contingency analysis PowerFactory', 'outserv', 'ComSimoutage', 'PowerFactory N-1 script', 'contingency screening'],
    about: ['Contingency analysis', 'N-1 criterion', 'DIgSILENT PowerFactory', 'Python'],
    sections: {
      what: `  <p>The N-1 criterion asks that the network stays within its limits after the loss of any one element: a line, a cable, a transformer or a generator. A contingency analysis checks it by solving the network once per outage. The steady-state screening on this page uses the load flow and two limits: no branch above its thermal rating, and no busbar voltage outside its band.</p>
  <p>PowerFactory has a built-in command for it, Contingency Analysis (<code>ComSimoutage</code>), with its contingency cases in <code>ComOutage</code> objects. A Python loop does the same with nothing to set up, and is easy to change: add a check, export a table in your own layout, or run it for every study case.</p>`,
      method: `  <ol class="dx-steps">
    <li><strong>Run the base case</strong> load flow, and record it: an outage is judged against it.</li>
    <li><strong>List the outages</strong>: every line and network transformer in service (<code>outserv == 0</code>). A generator's own transformer is a loss of generation; study those separately (see Pitfalls).</li>
    <li><strong>For each outage</strong>, set <code>outserv</code> to 1 and run the load flow. A load flow that does not converge is a result too: record it and go on.</li>
    <li><strong>Record the worst values</strong>: the highest <code>c:loading</code> of the branches still in service and the lowest <code>m:u</code> of the energised busbars, with where they are.</li>
    <li><strong>Put the element back</strong> in a <code>finally</code> block, so an error never leaves the project with an outage in it.</li>
    <li><strong>Rank</strong> the outages by loading and save the table.</li>
  </ol>
  <h3>The script</h3>
  ${pre(script('contingency'), '<code>contingency.py</code>')}
  <h3>Result on the 39-bus example</h3>
  <p>The base case already loads <strong>${esc(base['Most loaded'])} to ${f(base['Highest loading (%)'], 1)} %</strong>. Of the ${outs.length} outages (${nLines} lines and ${outs.length - nLines} network transformers), ${over.length} push a branch above 100 %. The two worst are each other's parallel path: with ${esc(l2122.Outage)} out, ${esc(l2122['Most loaded'])} carries ${f(l2122['Highest loading (%)'], 1)} %, and with ${esc(l2324.Outage)} out, ${esc(l2324['Most loaded'])} carries ${f(l2324['Highest loading (%)'], 1)} %. ${l1619 ? `${esc(l1619.Outage)} is the only link of generators G 04 and G 05 to the rest of the grid: without it their export is lost, the slack machine makes it up, and its transformer ${esc(l1619['Most loaded'])} reaches ${f(l1619['Highest loading (%)'], 1)} %.` : ''}</p>
  ${barChart({ title: 'Highest branch loading after each of the 12 worst outages of the 39-bus example', bars: top.map(x => ({ label: x.Outage, v: x['Highest loading (%)'] })), y: { label: 'Highest branch loading', unit: '%', min: 0 }, limit: { y: 100, label: '100 % of rating' }, caption: 'One bar per outage: the most loaded line or transformer left in service.' })}
  ${table([{ h: 'Outage', key: 'Outage' }, { h: 'Most loaded branch', key: 'Most loaded' }, { h: 'Loading', unit: '%', num: true, fn: x => f(x['Highest loading (%)'], 1) }, { h: 'Lowest voltage', unit: 'p.u.', num: true, fn: x => f(x['Lowest voltage (p.u.)'], 3) }, { h: 'At', key: 'Lowest at' }], [base, ...over])}
  <p class="dx-note">The base case, then every outage that overloads a branch, worst first. Every outage converged.</p>`,
      builder: builderBlock(b,
        'The Builder\'s N-1 Quick Start runs the same loop with its Contingency block, which also takes out generator transformers, and keeps line and transformer loading in separate columns. On this example it gives the same numbers: 158.3 % with Line 21 - 22 out, 108.0 % with Line 10 - 11 out. This is its file for the 39-bus example:',
        [
          '<strong>Step 2</strong> runs the base load flow; <strong>step 3</strong>, the Contingency block, gives the base case first and then one pass per line and transformer in service, putting each element back after its pass.',
          '<strong>Steps 4 to 7</strong> run the load flow and read the highest line loading, the lowest busbar voltage and the highest transformer loading, each with where it is (busbars out of service or not energised are left out).',
          '<strong>Step 8</strong> adds one row per outage; an outage whose load flow does not converge keeps its row with the reason.',
          'After all passes, "Table column" picks the outage with the highest line loading and "Print a message" writes it to the log.',
        ], 'n-1_screening.py'),
      pitfalls: [
        '<strong>Always put the element back.</strong> Set <code>outserv</code> to 0 in a <code>finally</code> block. A script stopped between the two calls leaves the project with the line out of service, and every later study wrong.',
        `<strong>A single slack takes up every lost megawatt.</strong> Taking out a generator's own transformer loses the generator, and on this example the slack machine G 02 then carries it all: its transformer Trf 06 - 31 reaches 211 % when Trf 29 - 38 (G 09) is out. That is the balancing rule speaking, not the network. Study generator outages with a distributed slack or as their own contingency set.`,
        '<strong>Islanded busbars read 0 p.u.</strong> An outage that cuts part of the network off leaves its busbars at exactly 0, and <code>IsEnergized()</code> can still return 1 for them after a load flow. Leave out busbars at 0 p.u. when you look for the lowest voltage.',
        '<strong>A load flow that does not converge is a finding, not an error.</strong> Record it and go on: it often means voltage collapse or an island without a reference.',
        '<strong>Which rating is 100 %?</strong> <code>c:loading</code> uses the rating in the model (the type\'s rated current with the element\'s derating). Post-contingency short-term ratings are higher: use a different limit, or a separate check, for them.',
        '<strong><code>outserv</code> is not switching.</strong> It removes the element from the calculation. To model the breakers that clear it, open them (<code>on_off</code> of <code>ElmCoup</code>, or the switch in the cubicle) instead.',
      ],
      faq: [
        ['How do I run a contingency analysis in PowerFactory with Python?', 'Loop over the lines and transformers: <code>SetAttribute("outserv", 1)</code>, run <code>app.GetFromStudyCase("ComLdf").Execute()</code>, read <code>c:loading</code> and <code>m:u</code>, then set <code>outserv</code> back to 0 in a <code>finally</code> block.'],
        ['How do I take an element out of service in a PowerFactory script?', 'Set its input parameter <code>outserv</code> to 1 with <code>obj.SetAttribute("outserv", 1)</code>, and back to 0 to return it to service.'],
        ['What is the N-1 criterion?', 'A planning and operating rule: the network must stay within its thermal and voltage limits after the loss of any single element, such as a line, transformer or generator.'],
        ['Does PowerFactory have its own contingency analysis?', 'Yes, the Contingency Analysis command (<code>ComSimoutage</code>). A Python loop is a lighter way to the same screening that is easy to adapt; the Builder\'s N-1 Quick Start writes one for you.'],
      ],
    },
  };
}
