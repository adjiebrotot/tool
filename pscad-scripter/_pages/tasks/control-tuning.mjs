// Guide: control tuning. Overshoot and rise time of a step response, and the damping of a
// ringdown (damping).
export default async function ({ builderScript, builderBlock, pre }) {
  const b = await builderScript('damping', ({ set }) => set('n1', {
    project: 'C:/Studies/statcom/statcom.pscx',
  }));

  return {
    slug: 'control-tuning', crumb: 'Control tuning',
    card: 'Control tuning: overshoot, rise time and damping',
    title: 'PSCAD control tuning with Python: overshoot, rise time and damping ratio',
    h1: 'Control tuning in PSCAD with Python: overshoot, rise time and damping',
    desc: 'Measure a PSCAD step response\'s overshoot and rise time and a ringdown\'s damping ratio and frequency in Python, and fail a run whose oscillation is growing.',
    lead: 'A control review asks a few numbers of every response: <strong>how far a step overshoots, how fast it rises, and whether the oscillation after a disturbance dies away</strong>. In PSCAD all three come out of the recorded waveform. A script that reads them can retune a gain, run again, and keep going until the numbers pass.',
    whatTitle: 'What a control check reads from a run',
    qsTitle: 'Damping of a ringdown',
    level: 'Advanced',
    keywords: ['pscad damping ratio', 'pscad control tuning python', 'pscad overshoot rise time', 'ringdown analysis', 'control interaction emt', 'subsynchronous oscillation pscad'],
    about: ['Control engineering', 'Damping ratio', 'PSCAD', 'Control interaction'],
    sections: {
      what: `  <p><strong>A step response</strong> is a set-point change or a disturbance that a controlled quantity follows to a new value. Its overshoot is how far it goes past the final value, as a percentage of the step, and its rise time how long it takes from 10 % to 90 % of the step.</p>
  <p><strong>A ringdown</strong> is the oscillation after a disturbance. Its peaks fall away along an exponential when it is damped and grow when it is not. The damping ratio is read from that exponential and the frequency from the spacing of the peaks: a negative ratio is an oscillation that is growing, which is what a converter control interaction or a subsynchronous oscillation looks like in an EMT run.</p>`,
      method: `  <ol class="dx-steps">
    <li><strong>Disturb the case</strong> with what the requirement names: a set-point step on a constant, a short fault, a switching.</li>
    <li><strong>Run long enough</strong> to see several periods of the slowest mode you care about.</li>
    <li><strong>Start the analysis after the disturbance itself</strong>, so its own step is not read as the first peak.</li>
    <li><strong>Check and record</strong>: overshoot and rise time against their limits, a damping ratio above the minimum.</li>
  </ol>
  <h3>Overshoot and rise time of a step</h3>
  ${pre(`ref = px_find(app, "master:const", "Vref")
px_set(ref, "Value", 1.02)                         # the step, on a constant read by the control
run = px_run(app, duration=3, step=50, plot_step=100)
r = overshoot(run.series("Vrms"), t_event=1.0)
print(r.value, r.rise)                             # overshoot in %, rise time in s`)}
  <p>A step needs a time: the constant here is written before the run, so the step is where the case's own logic switches to it. Wire the set-point through a timed component, or step it from a snapshot.</p>
  <h3>Damping of a ringdown</h3>
  ${pre(`set_fault(app, "master:tfaultn", "", at=1.0, duration=0.05)   # a short disturbance
run = px_run(app, duration=10, step=50, plot_step=500)
d = damping(run.series("Machine Speed"), t_start=1.2, t_end=None, min_peaks=3)
print(d.value, d.frequency, d.stable)              # ratio, Hz, ratio above zero`)}`,
      builder: builderBlock(b,
        'The Damping of a ringdown Quick Start applies a 50 ms disturbance at 1 s, runs for 10 s, reads the damping ratio and the frequency of the oscillation from 1.2 s on, and passes the run when the ratio is at least 0.03. This is the file with the case set to <code>C:/Studies/statcom/statcom.pscx</code>:',
        [
          '<code>set_fault(app, "master:tfaultn", "", 1, 0.05, ...)</code> is the disturbance: a 50 ms fault on the Timed Fault Logic, put back at the end.',
          'The 500 us plot step keeps a 10 s run small, and is fine for electromechanical modes of a few hertz. Lower it for a faster control mode.',
          '<code>damping(machine_speed, t_start=1.2, ...)</code> starts 0.15 s after the fault clears and needs at least three peaks to fit; with fewer it says the signal may not be oscillating rather than giving a number.',
          '<code>verdict(damping_result.value, "ge", 0.03, 0)</code> is the pass test: 3 % damping or more. A ratio of none (nothing to fit) is reported as no data and takes the fail side.',
        ], 'damping_of_a_ringdown.py'),
      pitfalls: [
        '<strong>The disturbance read as the first peak.</strong> Start the window after the fault has cleared, or the ratio describes the fault, not the oscillation.',
        '<strong>Two modes at once.</strong> The fit assumes one dominant oscillation. When two modes beat, the peaks do not lie on one exponential; filter the signal or read a quantity where one mode dominates.',
        '<strong>A plot step too coarse for the mode.</strong> Each period needs many samples for its peaks to be found. A 500 us plot step suits a mode of a few hertz, not a control mode of a few hundred.',
        '<strong>A run too short.</strong> Fewer than three peaks after the window starts gives no answer. Run until the slowest mode has shown several periods.',
      ],
      faq: [
        ['How do I measure damping in PSCAD?', 'Record the quantity that oscillates, run past the disturbance for several periods, find the peaks after the disturbance has cleared and fit them with an exponential. The decay rate and the period give the damping ratio; a negative ratio is a growing oscillation.'],
        ['How do I measure overshoot and rise time from a PSCAD run?', 'Find the value before the step and the final value after it, then the highest point past the final value as a percentage of the step (the overshoot), and the time from 10 % to 90 % of the step (the rise time). The Builder\'s Overshoot and rise time block does it from any recorded channel.'],
        ['Can a script retune a controller in PSCAD?', 'Yes. Write the gain on its component, run, read the response, and repeat. The Builder\'s Optimise block searches the gains for you against the checks you wire into it.'],
      ],
    },
  };
}
