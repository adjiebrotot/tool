// Guide: short-circuit calculations in PowerFactory with Python.
export default async function ({ results, script, builderScript, builderBlock, pre, esc }) {
  const r = results('short_circuit');
  const rows = r.data.rows;
  const { barChart, table } = await import('../lib.mjs');
  const f = (v, d) => Number(v).toFixed(d);
  const b = await builderScript('shc-buses', ({ set }) => set('n1', { project: 'Nine-bus System' }));
  const hv = rows.filter(x => x['Nominal (kV)'] >= 100);
  const top = hv.reduce((a, x) => (x['Ikss (kA)'] > a['Ikss (kA)'] ? x : a));
  const b5 = rows.find(x => x.Busbar === 'Bus 5');
  return {
    slug: 'short-circuit', crumb: 'Short circuit', card: 'Short-circuit automation', short: 'a short-circuit calculation',
    title: 'PowerFactory short circuit in Python: IEC 60909 fault levels',
    h1: 'Short-circuit automation in PowerFactory with Python',
    desc: 'Run IEC 60909 short-circuit calculations in PowerFactory from Python with ComShc: a fault at every busbar, Ikss, ip and Skss saved to CSV. Tested script.',
    lead: `In Python, a short-circuit calculation is the study case's <code>ComShc</code> command: set the method (<code>iopt_mde = 1</code> for <strong>IEC 60909</strong>), the fault type (<code>iopt_shc = "3psc"</code>) and the location (<code>iopt_allbus = 2</code> for <strong>every busbar</strong>), call <code>Execute()</code>, then read <code>m:Ikss</code>, <code>m:ip</code> and <code>m:Skss</code> on each busbar.`,
    whatTitle: 'What a short-circuit calculation gives you',
    qs: 'shc-buses', qsTitle: 'Short circuit at every busbar',
    refs: ['ElmTerm', 'ElmLne', 'ElmSym', 'ElmXnet', 'EvtShc'],
    level: 'Intermediate',
    keywords: ['powerfactory short circuit python', 'ComShc', 'IEC 60909 PowerFactory', 'fault level every busbar', 'm:Ikss', 'iopt_mde', 'iopt_allbus'],
    about: ['Short circuit', 'IEC 60909', 'DIgSILENT PowerFactory', 'Python'],
    sections: {
      what: `  <p>A short-circuit calculation gives the current that flows into a fault, and the currents and voltages around it. The maximum currents size equipment: the breaking capacity of breakers, the peak and thermal withstand of busbars and cables, and the fault level a new connection adds to. The minimum currents check that protection still sees a fault.</p>
  <p>PowerFactory has several methods in one command, <code>ComShc</code>: <strong>IEC 60909</strong> and its German twin VDE 0102 (an equivalent voltage source at the fault with a voltage factor c, no load flow needed), <strong>ANSI</strong> (IEEE C37), and the <strong>complete method</strong>, which superimposes the fault on a load flow. The results on a faulted busbar include the initial symmetrical current <code>m:Ikss</code> (I<sub>k</sub>"), the peak current <code>m:ip</code> and the initial short-circuit power <code>m:Skss</code> (S<sub>k</sub>" = √3 U<sub>n</sub> I<sub>k</sub>").</p>`,
      method: `  <ol class="dx-steps">
    <li><strong>Activate the study case</strong> whose grids and operating state you want faulted.</li>
    <li><strong>Get the command</strong> with <code>app.GetFromStudyCase("ComShc")</code> and keep its settings to put back.</li>
    <li><strong>Choose the method and the fault</strong>: <code>iopt_mde</code> 1 for IEC 60909; <code>iopt_shc</code> <code>"3psc"</code> three-phase, <code>"2psc"</code> two-phase, <code>"spgf"</code> single-phase to ground, <code>"2pgf"</code> two-phase to ground; <code>iopt_cur</code> 0 for maximum or 1 for minimum currents.</li>
    <li><strong>Choose where</strong>: <code>iopt_allbus = 2</code> faults every busbar in turn in one run, or <code>iopt_allbus = 0</code> with <code>shcobj</code> set to one busbar or line.</li>
    <li><strong>Run</strong> with <code>Execute()</code> (0 means it worked) and read <code>m:Ikss</code>, <code>m:ip</code> and <code>m:Skss</code> on each faulted <code>ElmTerm</code>.</li>
    <li><strong>Save</strong> the rows to CSV, and put the command's settings back.</li>
  </ol>
  <h3>The script</h3>
  ${pre(script('short_circuit'), '<code>short_circuit.py</code>')}
  <h3>Result on the Nine-bus example</h3>
  <p>The highest fault level on the 230 kV network is at <strong>${esc(top.Busbar)}: ${f(top['Ikss (kA)'], 2)} kA, ${f(top['Skss (MVA)'], 0)} MVA</strong>. The generator terminals (13.8 to 18 kV) see around 50 kA, because the same power at a lower voltage is a larger current. As a check, ${esc(b5.Busbar)} gives S<sub>k</sub>" = √3 × 230 kV × ${f(b5['Ikss (kA)'], 3)} kA = ${f(Math.sqrt(3) * 230 * b5['Ikss (kA)'], 1)} MVA, the ${f(b5['Skss (MVA)'], 1)} MVA PowerFactory reports.</p>
  ${barChart({ title: 'Initial three-phase short-circuit current at each 230 kV busbar of the Nine-bus example, IEC 60909 maximum', bars: hv.map(x => ({ label: x.Busbar, v: x['Ikss (kA)'] })), y: { label: 'Initial short-circuit current Ikss', unit: 'kA', min: 0 }, caption: 'IEC 60909, maximum currents, a three-phase fault at each busbar in turn. Read with m:Ikss.' })}
  ${table([{ h: 'Busbar', key: 'Busbar' }, { h: 'Nominal', unit: 'kV', num: true, fn: x => f(x['Nominal (kV)'], 1) }, { h: 'Ikss', unit: 'kA', num: true, fn: x => f(x['Ikss (kA)'], 2) }, { h: 'ip', unit: 'kA', num: true, fn: x => f(x['ip (kA)'], 2) }, { h: 'Skss', unit: 'MVA', num: true, fn: x => f(x['Skss (MVA)'], 0) }], rows)}`,
      builder: builderBlock(b,
        'The Builder\'s Quick Start does the same with a loop: a fault at one busbar per pass, the results into a table, and a bar chart of the fault currents at the end. It gives the same 2.256 kA at Bus 5 of the Nine-bus example. This is its file, filled in for that example:',
        [
          '<strong>Step 2</strong> finds every busbar in service that matches <code>BUSBAR_EL</code> (<code>*</code> for all) and loops over them.',
          '<strong>Step 3</strong>, <code>run_short_circuit</code>, sets <code>ComShc</code> for this run only (IEC 60909, three-phase, maximum, the fault at this pass\'s busbar through <code>shcobj</code>) and puts the settings back.',
          '<strong>Steps 4 and 5</strong> read <code>m:Ikss</code> in kA and <code>m:Skss</code> in MVA at the faulted busbar; step 6 adds the row.',
          'After the loop, two "Table column" blocks pull the busbar names and the currents out of the table, and "Draw 2D graph" saves the bar chart as a PNG in the Adjie Brotools style.',
        ], 'short_circuit_at_every_busbar.py'),
      pitfalls: [
        '<strong>Set the method every time.</strong> The Nine-bus example\'s short-circuit command is set to VDE 0102 (<code>iopt_mde</code> 0). A script that does not set <code>iopt_mde</code> gets whatever the study case holds.',
        '<strong><code>iopt_shc</code> is text, not a number</strong>: <code>"3psc"</code>, <code>"2psc"</code>, <code>"spgf"</code>, <code>"2pgf"</code>.',
        '<strong>With one fault location, another busbar\'s <code>m:Ikss</code> is not its fault level.</strong> Only the faulted busbar carries its own fault current. Use <code>iopt_allbus = 2</code>, or loop and fault each busbar, to get a fault level everywhere.',
        '<strong>Maximum and minimum currents answer different questions.</strong> Maximum (<code>iopt_cur</code> 0) rates equipment; minimum (1) checks protection reaches. Run both when you need both.',
        '<strong>ANSI gives other result names</strong> than IEC 60909, so a script written for one method may raise <code>AttributeError</code> with the other. Check the busbar\'s short-circuit results in the <a href="../../reference/ElmTerm/#short-circuit">ElmTerm reference</a>.',
        '<strong>Put the command\'s settings back</strong> (the script does it in <code>finally</code>), or the next person to open the study case gets your method and fault type.',
      ],
      faq: [
        ['How do I run a short circuit in PowerFactory with Python?', 'Get the command with <code>app.GetFromStudyCase("ComShc")</code>, set <code>iopt_mde</code>, <code>iopt_shc</code>, <code>iopt_cur</code> and the location (<code>iopt_allbus</code> or <code>shcobj</code>), then call <code>Execute()</code>. It returns 0 when it worked.'],
        ['How do I get the fault level at every busbar?', 'Set <code>iopt_allbus</code> to 2 before <code>Execute()</code>, then read <code>m:Ikss</code> (kA) and <code>m:Skss</code> (MVA) on every <code>ElmTerm</code>.'],
        ['What does iopt_mde mean?', 'The calculation method of <code>ComShc</code>: 0 VDE 0102, 1 IEC 60909, 2 ANSI, 3 the complete method, 4 IEC 61363.'],
        ['What are Ikss, ip and Skss?', 'Ikss (I<sub>k</sub>") is the initial symmetrical short-circuit current, ip the peak short-circuit current, and Skss (S<sub>k</sub>") the initial short-circuit power, √3 U<sub>n</sub> I<sub>k</sub>".'],
      ],
    },
  };
}
