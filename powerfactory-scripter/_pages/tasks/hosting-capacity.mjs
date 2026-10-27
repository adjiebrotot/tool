// Guide: hosting capacity, the method in general, then in PowerFactory.
export default async function ({ results, script, builderScript, builderBlock, pre, esc }) {
  const r = results('hosting_capacity');
  const res = r.data.results.slice().sort((a, b) => a['Hosting capacity (MW)'] - b['Hosting capacity (MW)']);
  const { barChart, table } = await import('../lib.mjs');
  const f = (v, d) => Number(v).toFixed(d);
  const b = await builderScript('hosting-capacity', ({ set }) => {
    set('n1', { project: '39 Bus New England System', studyCase: '1. Power Flow' });
    set('n3', { attr: 'uknom', op: '>=', value: '100' });
    set('n4', { lower: 0, upper: 2000, tol: 5 });
  });
  const lo = res[0], hi = res[res.length - 1];
  const limiters = {};
  for (const x of res) { const k = x['Limited by'].replace(/ loaded to .*$/, ''); (limiters[k] = limiters[k] || []).push(x.Busbar); }
  const byLine = Object.entries(limiters).sort((a, c) => c[1].length - a[1].length);
  const mw = (v) => Math.round(v).toLocaleString('en-AU');
  return {
    slug: 'hosting-capacity', crumb: 'Hosting capacity', card: 'Hosting capacity study', short: 'hosting capacity',
    title: 'Hosting capacity study: how to automate it in PowerFactory',
    h1: 'How to do a hosting capacity study, and automate it in PowerFactory',
    h1Plain: 'How to do a hosting capacity study, and automate it in PowerFactory',
    desc: 'How to do a hosting capacity study, step by step: operating cases, limits, the test generator, bisection, the map. Then a tested PowerFactory script.',
    lead: `<strong>Hosting capacity</strong> is the most new generation (or load) a point of the network can take before a limit is broken: a thermal rating, a voltage limit, a fault level. To find it, connect the new generation at that point and raise it until the first limit breaks; a bisection search does it in about ten load flows. Repeat it at every busbar and you have a <strong>hosting capacity map</strong>. On PowerFactory's 39-bus example it runs from ${mw(lo['Hosting capacity (MW)'])} MW to ${mw(hi['Hosting capacity (MW)'])} MW, depending on the busbar.`,
    whatTitle: 'What hosting capacity is',
    methodTitle: 'How to do a hosting capacity study',
    qs: 'hosting-capacity', qsTitle: 'Hosting capacity at every busbar',
    refs: ['ElmGenstat', 'ElmPvsys', 'ElmTerm', 'ElmLne', 'ElmTr2', 'ElmSym'],
    level: 'Intermediate',
    keywords: ['how to do hosting capacity study', 'hosting capacity analysis', 'hosting capacity map', 'DER hosting capacity', 'PowerFactory hosting capacity', 'hosting capacity Python', 'network headroom'],
    about: ['Hosting capacity', 'Distributed energy resources', 'Power system planning', 'DIgSILENT PowerFactory'],
    sections: {
      what: `  <p>Hosting capacity answers one question for a network owner, a developer or a student: <em>how much can connect here without breaking anything?</em> It is found per connection point and per kind of connection (generation such as solar, wind and batteries exporting, or new load), and depends on the operating state the network is in.</p>
  <p>Distribution network service providers publish hosting capacity maps so that applicants see where capacity is left; transmission planners compute it per substation for connection enquiries. The limits that set it are the same everywhere:</p>
  <ul class="dx-prose">
    <li><strong>Thermal</strong>: no line, cable or transformer above its rating (at transmission level, also after any single outage).</li>
    <li><strong>Steady-state voltage</strong>: every busbar within its band. Export raises the voltage near the connection, which is what limits rooftop solar on long LV and MV feeders.</li>
    <li><strong>Voltage step</strong>: the change when the new connection trips or connects, often a few percent.</li>
    <li><strong>Fault level</strong>: switchgear still able to break the higher fault current; and for inverters, enough system strength.</li>
    <li><strong>Protection and power quality</strong>: reverse power through a transformer, protection reach and grading, harmonics and flicker.</li>
  </ul>
  <p>The first two are found with load flows and are what most hosting capacity studies, and this page, compute. The others are checks on top.</p>`,
      method: `  <p>The method does not depend on the software. Every step below is one decision you write down in the study report.</p>
  <ol class="dx-steps">
    <li><strong>Choose the operating cases.</strong> The limit depends on the state of the network: for new generation the hardest case is usually minimum demand with the existing generation high (voltage rise, reverse flow); for new load, maximum demand. Run each case.</li>
    <li><strong>Set the limits</strong> from the planning standard: the rating each branch may reach and the voltage band each busbar must keep.</li>
    <li><strong>Model the connection</strong> as a generator at the connection point, at the power factor it will run at (unity here).</li>
    <li><strong>Decide where its power goes.</strong> In a distribution network the upstream grid takes it (the slack). In a transmission network, other generators turn down: pro rata, as here, or in merit order. This choice changes the answer, so state it.</li>
    <li><strong>Search for the largest output that passes.</strong> Start from a passing value (0 MW) and a failing one (the most that could ever connect), try the middle, keep the half where the limit lies, and stop when the gap is within the tolerance. From 0 to 2,000 MW with a 5 MW tolerance that is 11 load flows (the two ends and 9 halvings), against 400 for a sweep in 5 MW steps.</li>
    <li><strong>Record the hosting capacity and what limited it</strong> (the binding constraint), then repeat at every candidate busbar: the result is the hosting capacity map.</li>
    <li><strong>Test the sensitivities</strong>: another power factor, other demand cases, an outage, the projects already in the queue.</li>
  </ol>
  <h3>In PowerFactory</h3>
  <p>The new generation is a static generator (<a href="../../reference/ElmGenstat/"><code>ElmGenstat</code></a>) connected through a new cubicle (<code>StaCubic</code>) on the busbar, at constant reactive power 0. Each try sets its active power <code>pgini</code>, turns the existing synchronous generators down by the same total, runs <code>ComLdf</code>, and checks <code>c:loading</code> on every line and transformer and <code>m:u</code> on every busbar. Everything is put back and the test generator deleted after each busbar.</p>
  ${pre(script('hosting_capacity'), '<code>hosting_capacity.py</code>')}
  <h3>Result: the hosting capacity map of the 39-bus example</h3>
  <p>The 30 busbars of 100 kV and above take between <strong>${mw(lo['Hosting capacity (MW)'])} MW (${esc(lo.Busbar)})</strong> and <strong>${mw(hi['Hosting capacity (MW)'])} MW (${esc(hi.Busbar)})</strong>, ${f(r.seconds, 1)} s of load flows in all. Every one is limited by a line rating, not by voltage: at transmission level, a generator at unity power factor moves the voltage little. The base case already loads Line 21 - 22 to 99.1 %, so busbars that push power through it can take almost nothing (Bus 22 and Bus 23), and ${esc(byLine[0][0])} sets the limit of ${byLine[0][1].length} busbars (${byLine[0][1].map(esc).join(', ')}).</p>
  ${barChart({ title: 'Hosting capacity of each 345, 230 and 138 kV busbar of the 39-bus example', bars: res.map(x => ({ label: x.Busbar, v: x['Hosting capacity (MW)'] })), y: { label: 'Hosting capacity', unit: 'MW', min: 0 }, h: 400, caption: 'Largest output of a new generator at unity power factor with every line and transformer within 100 % of rating and every busbar between 0.9 and 1.1 p.u.; existing generation turned down pro rata.' })}
  ${table([{ h: 'Busbar', key: 'Busbar' }, { h: 'Hosting capacity', unit: 'MW', num: true, fn: x => mw(x['Hosting capacity (MW)']) }, { h: 'Limited by', key: 'Limited by' }], res)}`,
      builder: builderBlock(b,
        'The Builder\'s Quick Start is the same study as blocks: a For each element loop over the busbars, a Find limit search inside it, a test generator, and three limit checks. Run on the 39-bus example with the busbars of 100 kV and above, it gives every busbar within 7.5 MW of the script above. This is its file for that example:',
        [
          '<strong>Step 2</strong> reads <code>pgini</code> of every synchronous generator, and "Total dispatch" adds them up: the existing generation that will make room.',
          '<strong>Step 3</strong> loops over the busbars that match <code>CONNECTION_POINT_EL</code>; for this example a filter keeps those with <code>uknom</code> of 100 kV or more.',
          '<strong>Step 4</strong>, Find limit, calls <code>try_n4</code> with one output after another and halves the gap between <code>GENERATION_LOWER</code> and <code>GENERATION_UPPER</code> down to <code>GENERATION_TOL</code>. A try whose load flow does not converge counts as a fail.',
          'Inside each try, <code>add_test_generator</code> connects (or moves) the static generator, "Share kept" works out 1 minus the output over the total dispatch, and Scale sets every generator to that share of its original <code>pgini</code>; <code>pf_undo</code> puts them back after the try.',
          'The three checks (<code>LINE_THERMAL_LIMIT_HI</code>, the transformer limit, <code>VOLTAGE_LIMITS_LO</code> and <code>_HI</code>) are combined with And blocks into the pass or fail the search reads.',
          'After the search, the busbar\'s row gets the hosting capacity and the search status; after the loop, the bar chart is drawn and the test generator deleted.',
        ], 'hosting_capacity_at_every_busbar.py'),
      pitfalls: [
        '<strong>One operating case is one answer.</strong> Hosting capacity at minimum demand and at maximum demand can differ several times over. Run the cases that stress each limit, and report the lowest.',
        '<strong>The balancing rule changes the result.</strong> With a single slack taking every megawatt, the slack machine\'s own transformer soon becomes the "limit" at every busbar. Turn existing generation down (pro rata, as here) or let an upstream grid take it, and say which.',
        '<strong>Bisection assumes one crossing.</strong> It finds the edge between pass and fail when output only makes things worse. If more output first relieves a line and then loads it the other way, check a few points either side of the answer.',
        '<strong>Check the ratings.</strong> <code>c:loading</code> is measured against the rating in the model, the type\'s rated current times the element\'s derating. An out-of-date rating gives an out-of-date hosting capacity.',
        '<strong>Unity power factor is a choice.</strong> A connection that absorbs reactive power, or controls voltage, moves the voltage limit a long way: on LV and MV feeders it is often the difference that matters.',
        '<strong>Leave the network as you found it.</strong> Put the dispatch back and delete the test generator and its cubicle after each busbar (after <code>ResetCalculation()</code>), as the script does in <code>finally</code>.',
        '<strong>Load flow limits are not the whole story.</strong> Fault level, protection, voltage step and power quality limits can bind first; treat this result as an upper bound until they are checked.',
      ],
      faq: [
        ['What is hosting capacity?', 'The largest amount of new generation or load that can connect at a point of the network without breaking a limit, such as a thermal rating or a voltage limit, in the operating cases studied.'],
        ['How is hosting capacity calculated?', 'Connect the new generation at the point, raise its output, and run a load flow at each step until the first limit breaks. A bisection search finds the edge in about ten load flows. The largest output that passes is the hosting capacity.'],
        ['What limits hosting capacity?', 'Usually thermal ratings of lines and transformers and voltage rise; also voltage step on connection, fault level, protection and power quality.'],
        ['What is a hosting capacity map?', 'The hosting capacity of every connection point in a network, shown on a map or a chart, often with the limit that binds at each point.'],
        ['How do I do a hosting capacity study in PowerFactory?', 'Add a static generator (<code>ElmGenstat</code>) at the busbar, set its <code>pgini</code>, run <code>ComLdf</code>, check <code>c:loading</code> and <code>m:u</code>, and search the largest <code>pgini</code> that passes. The script and the Builder Quick Start on this page do it for every busbar.'],
      ],
    },
  };
}
