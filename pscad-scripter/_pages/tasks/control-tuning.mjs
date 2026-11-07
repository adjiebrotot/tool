// Guide: disturb a control, fit the damping of the ringdown, search for the gain that settles it.
export default async function ({ builderScript, builderBlock, pre, table }) {
  const b = await builderScript('damping', ({ set }) => set('n1', {
    project: 'C:/work/mycase.pscx',
  }));

  const READS = [
    ['Damping ratio', 'A ringdown fitted through its envelope peaks. Above about 0.05 is usually called well damped; a negative ratio means the oscillation is growing.'],
    ['Overshoot', 'How far past the final value the first swing goes, as a fraction of the step. A control that is too fast overshoots.'],
    ['Rise time', 'How long the response takes to cross from near the start to near the end. A control that is too slow has a long one.'],
    ['Settling time', 'How long until the response stays inside a band around its final value. The number a specification usually quotes.'],
    ['Final value', 'Where it ended up. A steady state error says the control is not holding its set point.'],
  ];

  return {
    slug: 'control-tuning', crumb: 'Control tuning',
    card: 'Tune a control in PSCAD by searching the gain',
    title: 'PSCAD control tuning with Python: damping, overshoot and a gain search',
    h1: 'Tune a control in PSCAD by searching the gain',
    desc: 'Disturb a control in PSCAD from Python, fit the damping ratio of the ringdown, read overshoot and rise time, and search for the gain that settles it.',
    lead: `Tuning a control against an EMT model is a loop: <strong>change a gain, disturb the system, run, and measure how the response came back</strong>. Doing it by eye off a graph is slow and inconsistent, and the thing being judged, how well damped a ringdown is, is exactly the kind of number a script measures better than a person. This page is how to get that number, and how to let a search use it.`,
    whatTitle: 'What a tuning run measures',
    methodTitle: 'The method',
    qsTitle: 'Damping of a ringdown',
    level: 'Advanced',
    keywords: ['pscad control tuning', 'pscad damping ratio', 'pscad ringdown', 'pscad overshoot rise time', 'pscad optimise gain', 'controller tuning EMT', 'pscad pss tuning'],
    about: ['PSCAD', 'Control tuning', 'Damping ratio', 'Electromagnetic transient simulation'],
    sections: {
      what: `  <p>A control is judged on how it answers a disturbance. In an EMT model the disturbance is a component you already have: a short fault, a step on a set point, a switched load. What comes back is a waveform, and the tuning question is what shape that waveform has.</p>
  ${table([{ h: 'What is read' }, { h: 'What it says' }].map((c, i) => ({ ...c, fn: r => r[i] })), READS)}
  <p>The one that decides most tuning arguments is the <strong>damping ratio</strong>. It is fitted from the envelope of the ringdown: take the successive peaks, fit the exponential they decay along, and the ratio falls out of the rate of that decay against the oscillation's own frequency. Two things about it are worth saying plainly.</p>
  <ul class="dx-prose">
    <li><strong>A negative ratio is a real answer, not an error.</strong> It means the peaks are growing: the oscillation is unstable. A tuning script that treats a negative ratio as a failed measurement will hide the one result that matters most.</li>
    <li><strong>A flat signal has no ratio at all.</strong> If the disturbance did not excite anything, there are no peaks to fit, and the honest output is "no ringdown", not a damping ratio of zero. Zero means marginally stable, which is a very different statement.</li>
  </ul>`,
      method: `  <h3>One tuning run</h3>
  <ol class="dx-steps">
    <li><strong>Write the gain</strong> on the control component.</li>
    <li><strong>Disturb the system</strong> at a time well after the case has settled. A short fault is the usual choice because it excites everything; a set point step is cleaner when you only want one loop's response.</li>
    <li><strong>Run long enough for the ringdown to decay</strong>, or to clearly fail to. Ten seconds is a common choice for an electromechanical mode.</li>
    <li><strong>Read the channel</strong> the mode shows up in: machine speed for an electromechanical oscillation, a terminal voltage for an exciter, a power flow for a damping controller.</li>
    <li><strong>Fit the damping</strong>, and read overshoot and settling time from the same waveform.</li>
    <li><strong>Record the row</strong>, and put the gain back.</li>
  </ol>
  ${pre(`mark = px_mark()
px_set(exciter, "KA", gain)

set_fault(app, "master:tpflt", at=1.0, duration=0.05)     # a short kick
run = px_run(app, duration=10.0, step=50, plot_step=250)

speed = run.series("Machine Speed")
d = damping(speed, after=1.1)        # .ratio, .frequency, .stable, .why
o = overshoot(speed, after=1.1)      # .overshoot, .rise_time, .settling_time

table("Damping").add({
    "Gain": gain,
    "Damping ratio": d.ratio,
    "Mode (Hz)": d.frequency,
    "Overshoot": o.overshoot,
    "Settling (s)": o.settling_time,
})
px_undo(mark)`)}
  <h3>Letting a search pick the gain</h3>
  <p>Once a single run gives a number, a search can drive it. Two kinds are worth knowing apart.</p>
  <ul class="dx-prose">
    <li><strong>Optimise</strong> looks for the gain that gives the best number: the highest damping ratio, or the shortest settling time. It is the right tool when every candidate is acceptable and you want the best of them.</li>
    <li><strong>Find limit</strong> looks for the boundary: the largest gain that is still stable, the smallest that still meets a settling time. It is the right tool when the answer is a limit rather than an optimum, and it is much cheaper, because bisection halves the bracket every try.</li>
  </ul>
  ${pre(`# Optimise: each try gets a gain, runs, and reports one number back.
def attempt(gain):
    mark = px_mark()
    px_set(exciter, "KA", gain)
    run = px_run(app, duration=10.0, step=50, plot_step=250)
    d = damping(run.series("Machine Speed"), after=1.1)
    px_undo(mark)
    return d.ratio if d.ratio is not None else -1.0    # no ringdown is not a win`)}
  <p class="dx-note">Give the search a bracket you believe in. An EMT run per try is expensive, so the range matters more here than it would on an algebraic model, and a search told to look between 1 and 10,000 will spend most of its tries in places no engineer would.</p>
  <h3>Tuning more than one gain</h3>
  <p>Two gains make a surface rather than a curve, and the number of runs goes up fast. A grid is honest and slow; a search that chooses where to look next is faster and needs a sensible starting point. Either way, the results table holds one row per try with both gains on it, so the surface can be drawn afterwards without re-running anything.</p>`,
      builder: builderBlock(b,
        'The damping Quick Start is one tuning run: a disturbance, a long run, a channel, the damping fit and a verdict. Wrapping it in Optimise or Find limit turns it into a search without the body changing. This is the file the Builder writes:',
        [
          'The disturbance is a <strong>50 ms fault</strong> at 1 s: short enough to be a kick rather than a study in its own right, late enough that the case has settled.',
          'The run is <strong>10 seconds</strong>, so an electromechanical mode has room to decay or clearly not to.',
          'The <strong>Damping of a ringdown</strong> block fits the envelope peaks after the disturbance and gives back the ratio, the mode frequency and whether it calls it stable.',
          'A negative ratio comes through as a negative number and reads as not stable, rather than being clamped or treated as an error.',
          'A flat signal gives no ratio at all, with a reason, so a disturbance that did not excite the mode is visible instead of being recorded as perfect damping.',
          'The <strong>Pass / fail</strong> block turns the ratio into a verdict, which is what a Find limit search needs each try to report.',
        ], 'damping_of_a_ringdown.py'),
      pitfalls: [
        '<strong>Measuring from before the disturbance.</strong> The fit has to start after the kick, or the settled part before it flattens the envelope and the ratio comes out too high.',
        '<strong>A run that ends while it is still ringing.</strong> A fit over two peaks is not a fit. If the ratio moves a lot when the run gets longer, the run was too short.',
        '<strong>Treating a negative damping ratio as an error.</strong> It is the answer: the oscillation is growing. Record it and let the verdict fail.',
        '<strong>Treating "no ringdown" as perfect damping.</strong> A disturbance that excited nothing produces no peaks. That is a flaw in the test, not a well tuned control.',
        '<strong>Reading the wrong channel.</strong> A mode that does not appear in the channel you recorded cannot be measured. Record the quantity the mode actually moves.',
        '<strong>A search with no run budget.</strong> Every try is a full EMT run. Bound the number of tries, and prefer Find limit over Optimise when the answer is a boundary.',
        '<strong>Leaving the last gain written.</strong> The gain a search tried last is not the gain it recommends, and it is written in the case. Undo each try, and write the chosen value deliberately at the end.',
      ],
      faq: [
        ['How do I measure damping in PSCAD?', 'Disturb the system, run long enough for the oscillation to decay, and fit the envelope through the successive peaks of the recorded channel. The damping ratio comes from the rate of that decay against the oscillation\u2019s own frequency. A negative ratio means the peaks are growing.'],
        ['What damping ratio is good enough?', 'It depends on the grid code or the study brief, but around 0.05 is a common threshold for calling an electromechanical mode well damped. What matters more for a script is being consistent: fit it the same way, from the same channel, over the same window, every run.'],
        ['Should I use Optimise or Find limit to tune a gain?', 'Optimise when you want the best value of a number, such as the highest damping ratio. Find limit when the answer is a boundary, such as the largest gain that is still stable: bisection halves the bracket every try, which matters when each try is a full EMT run.'],
        ['What disturbance should I use for a tuning run?', 'A short fault excites everything and is easy to repeat, which suits finding modes. A step on a set point is cleaner when you want one loop\u2019s response and nothing else. Either way, apply it well after the case has settled.'],
      ],
    },
  };
}
