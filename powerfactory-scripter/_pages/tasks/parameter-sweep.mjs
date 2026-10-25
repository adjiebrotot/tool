// Guide: parameter sweeps in PowerFactory with Python, shown with PV and QV curves.
export default async function ({ results, script, builderScript, builderBlock, pre, esc }) {
  const pv = results('pv_curve').data.curve;
  const qv = results('qv_curve').data.curve;
  const { lineChart, table } = await import('../lib.mjs');
  const f = (v, d) => Number(v).toFixed(d);
  const b = await builderScript('pv-curve', ({ set }) => set('n1', { project: 'Nine-bus System', studyCase: '01- Load Flow' }));
  const nose = pv[pv.length - 1];
  const bottom = qv.reduce((a, x) => (x['Q (Mvar)'] < a['Q (Mvar)'] ? x : a));
  const q0 = qv.reduce((a, x) => (Math.abs(x['Q (Mvar)']) < Math.abs(a['Q (Mvar)']) ? x : a));
  return {
    slug: 'parameter-sweep', crumb: 'Parameter sweep, PV and QV curves', card: 'Parameter sweep: PV and QV curves', short: 'a parameter sweep',
    title: 'PowerFactory parameter sweep with Python: PV curve and QV curve scripts',
    h1: 'Parameter sweeps in PowerFactory with Python: PV and QV curves',
    desc: 'Parameter sweeps in PowerFactory with Python: a PV curve to the nose by load scaling and a QV curve with a fictitious condenser. Tested scripts, results.',
    lead: `A parameter sweep sets one input to a series of values, reruns the calculation for each and records the results. The two classic sweeps are the <strong>PV curve</strong> (scale the load up until the load flow fails: the nose is the loadability limit) and the <strong>QV curve</strong> (hold a busbar at a voltage and read the reactive power it takes: the bottom is the reactive margin). On the Nine-bus example the nose is at <strong>${f(nose['Load (MW)'], 0)} MW, ${f(nose.Scale, 2)} times the base load</strong>, and Bus 5's QV curve bottoms out at <strong>${f(bottom['Q (Mvar)'], 0)} Mvar</strong>.`,
    whatTitle: 'What a parameter sweep is',
    qs: 'pv-curve', qsTitle: 'PV curve by load scaling',
    refs: ['ElmLod', 'ElmTerm', 'ElmGenstat', 'TypLod'],
    level: 'Intermediate',
    keywords: ['powerfactory parameter sweep', 'PV curve PowerFactory', 'QV curve PowerFactory', 'voltage stability PowerFactory Python', 'load scaling', 'nose curve', 'loadability'],
    about: ['Parameter sweep', 'PV curve', 'QV curve', 'Voltage stability', 'DIgSILENT PowerFactory'],
    sections: {
      what: `  <p>A sweep answers "what happens as this changes?": loading against demand growth, losses against a tap position, a fault level against the number of units in service. The pattern is always the same: keep the original value, set the next one, run, check it converged, read, and put the original back at the end.</p>
  <p>Voltage stability uses two sweeps:</p>
  <ul class="dx-prose">
    <li><strong>PV curve</strong>: the voltage of a busbar against the power delivered, as the load (or a transfer) grows. The voltage falls slowly, then faster, until the load flow has no solution: the tip of the curve, the nose, is the maximum loadability. The distance from today\'s load to the nose is the loadability margin.</li>
    <li><strong>QV curve</strong>: the reactive power a fictitious condenser must inject to hold a busbar at each voltage. Where the curve bottoms out is the critical voltage; how far that bottom lies below zero is the reactive power margin of the busbar.</li>
  </ul>`,
      method: `  <ol class="dx-steps">
    <li><strong>Keep the original values</strong> of everything the sweep changes, before the first step.</li>
    <li><strong>Set the next value</strong> from the original, not from the previous step (multiplying the previous value compounds).</li>
    <li><strong>Run and check</strong>: <code>Execute()</code> returns 0 when the load flow converged. For a PV curve the first failure is the end of the curve; for most sweeps it is a point to record and pass.</li>
    <li><strong>Read what you sweep for</strong>: busbar voltages <code>m:u</code>, the delivered load <code>m:P:bus1</code>, a condenser's reactive power <code>m:Q:bus1</code>.</li>
    <li><strong>Put everything back</strong> in a <code>finally</code> block, and delete any object the sweep made.</li>
  </ol>
  <h3>PV curve: scale every load to the nose</h3>
  <p>Each step multiplies the active and reactive power of the three loads by the same factor, so their power factor stays as it is. The extra power comes from the slack generator; generator reactive limits follow the study case (ignored in this example).</p>
  ${pre(script('pv_curve'), '<code>pv_curve.py</code>')}
  ${lineChart({ title: 'PV curves of the three load busbars of the Nine-bus example as all loads scale up', series: [['Bus 5', 1], ['Bus 6', 2], ['Bus 8', 3]].map(([n, c]) => ({ name: n, c, pts: pv.map(p => [p['Load (MW)'], p[n]]) })), x: { label: 'Total load', unit: 'MW' }, y: { label: 'Busbar voltage', unit: 'p.u.' }, caption: `Steps of 5 % of the base load (315 MW). The last point that converges, ${f(nose['Load (MW)'], 0)} MW, is the nose; Bus 5 is the weakest busbar at ${f(nose['Bus 5'], 3)} p.u.` })}
  <h3>QV curve: a fictitious condenser at Bus 5</h3>
  <p>A static generator with no active power, in voltage control, holds Bus 5 at each voltage from 1.10 p.u. down; the reactive power it injects is the curve. It is rated far above what it will need, so it never limits, and deleted at the end.</p>
  ${pre(script('qv_curve'), '<code>qv_curve.py</code>')}
  ${lineChart({ title: 'QV curve of Bus 5 of the Nine-bus example', series: [{ name: 'Bus 5', c: 1, pts: qv.map(p => [p['Voltage (p.u.)'], p['Q (Mvar)']]), dots: true }], x: { label: 'Bus 5 voltage', unit: 'p.u.' }, y: { label: 'Reactive power injected', unit: 'Mvar' }, limits: [{ y: 0, label: 'Q = 0' }], caption: `Today's operating point is where the curve crosses zero (about ${f(q0['Voltage (p.u.)'], 2)} p.u.). The bottom, ${f(bottom['Q (Mvar)'], 0)} Mvar at ${f(bottom['Voltage (p.u.)'], 2)} p.u., is the critical point: Bus 5 has about ${f(-bottom['Q (Mvar)'], 0)} Mvar of reactive power margin.` })}
  ${table([{ h: 'Load scaling', num: true, fn: x => f(x.Scale, 2) }, { h: 'Total load', unit: 'MW', num: true, fn: x => f(x['Load (MW)'], 0) }, { h: 'Bus 5', unit: 'p.u.', num: true, fn: x => f(x['Bus 5'], 4) }, { h: 'Bus 6', unit: 'p.u.', num: true, fn: x => f(x['Bus 6'], 4) }, { h: 'Bus 8', unit: 'p.u.', num: true, fn: x => f(x['Bus 8'], 4) }], pv.filter((x, i) => i % 4 === 0 || i === pv.length - 1))}`,
      builder: builderBlock(b,
        'The Builder\'s PV curve Quick Start is the same sweep as a loop of blocks, ending at the first load flow that fails. On the Nine-bus example it gives the same 28 points and the same nose at 2.35 times the base load. This is its file for that example:',
        [
          '<strong>Step 2</strong> is a "For a range of numbers" loop over the scaling factor, from <code>LOAD_SCALING_FROM</code> to <code>LOAD_SCALING_TO</code> in steps of <code>LOAD_SCALING_STEP</code>; it puts the loads back after every pass.',
          '<strong>Step 3</strong>, Scale, sets <code>plini</code> and <code>qlini</code> of every load to the factor times its original value.',
          '<strong>Step 4</strong> runs the load flow. When it does not converge, "Stop the loop" ends the sweep with a message in the log: the nose.',
          '<strong>Step 6</strong> reads the lowest busbar voltage and where it is; <strong>step 7</strong> adds the row.',
          'After the loop, "Draw graph from results table" saves the PV curve as a PNG.',
        ], 'pv_curve_by_load_scaling.py'),
      pitfalls: [
        '<strong>The last converged point is an estimate of the nose.</strong> A load flow can also fail for numerical reasons. Use a smaller step near the end, or the continuation method, when the exact margin matters.',
        '<strong>Scale P and Q together</strong> to keep each load\'s power factor; scaling only P sweeps the power factor too.',
        '<strong>Where the extra power comes from shapes the curve.</strong> Here the slack takes it all. A transfer from one area to another, or generator reactive limits (<code>iopt_lim</code> on <code>ComLdf</code>), move the nose.',
        '<strong>Voltage-dependent loads draw less as the voltage falls.</strong> Record the delivered power <code>m:P:bus1</code>, not the setpoint <code>plini</code>, on the x axis.',
        '<strong>The QV condenser must never limit.</strong> Rate it well above the reactive power it will need, run without its limits, and delete it (after <code>ResetCalculation()</code>) when the sweep ends.',
        '<strong>Put the inputs back from the stored originals</strong> in <code>finally</code>, so a stopped sweep never leaves the loads scaled.',
      ],
      faq: [
        ['What is a PV curve?', 'The voltage of a busbar plotted against the power delivered as load or transfer grows. Its tip, the nose, is the maximum loadability; beyond it the load flow has no solution.'],
        ['What is a QV curve?', 'The reactive power a fictitious condenser must inject to hold a busbar at each voltage. The bottom of the curve marks the critical voltage, and its depth below zero is the reactive power margin.'],
        ['How do I run a parameter sweep in PowerFactory with Python?', 'Store the original value, then for each step set it with <code>SetAttribute</code>, run the calculation, check that <code>Execute()</code> returned 0 and read the results. Put the original back in a <code>finally</code> block.'],
        ['How do I scale all loads in PowerFactory with Python?', 'Loop over <code>app.GetCalcRelevantObjects("*.ElmLod")</code> and set <code>plini</code> and <code>qlini</code> to the factor times their original values. The load\'s scaling factor <code>scale0</code> is another way.'],
      ],
    },
  };
}
