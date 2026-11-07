// Guide: harmonics and THD out of a time-domain run (harmonics).
export default async function ({ builderScript, builderBlock, pre, table }) {
  const b = await builderScript('harmonics', ({ set }) => set('n1', {
    project: 'C:/Studies/inverter/inverter.pscx',
  }));

  const STEP = [
    ['500 us', '1 kHz', '20th at 50 Hz, 16th at 60 Hz'],
    ['250 us', '2 kHz', '40th at 50 Hz, 33rd at 60 Hz'],
    ['100 us', '5 kHz', '100th at 50 Hz, 83rd at 60 Hz'],
    ['50 us', '10 kHz', '200th at 50 Hz, 166th at 60 Hz'],
  ];

  return {
    slug: 'harmonics', crumb: 'Harmonics',
    card: 'Harmonics and THD from a PSCAD run',
    title: 'Harmonics and THD from a PSCAD run with Python',
    h1: 'Harmonics and THD from a PSCAD run',
    desc: 'Work out THD and the harmonic spectrum of a PSCAD waveform in Python: the window, the fundamental, how far the plot step lets the spectrum reach, and a script.',
    lead: 'PSCAD has no frequency-domain harmonic scan to call. <strong>Harmonics come out of the time-domain waveform</strong>: run the case until it has settled, take a whole number of cycles of a voltage or current, and the Fourier transform of that window is the spectrum. THD is the root of the sum of the squares of the harmonics above the fundamental, as a percentage of it.',
    whatTitle: 'Where the harmonics in an EMT run come from',
    qsTitle: 'Harmonics and THD from an EMT run',
    level: 'Intermediate',
    keywords: ['pscad thd python', 'pscad harmonics', 'pscad fft script', 'harmonic spectrum from emt', 'total harmonic distortion pscad', 'pscad power quality'],
    about: ['Harmonics', 'Total harmonic distortion', 'PSCAD', 'Power quality'],
    sections: {
      what: `  <p>An EMT run records the instantaneous waveform, harmonics included: the switching of a converter, the saturation of a transformer and the resonance of a filter are all in it. Reading them out is a discrete Fourier transform of a window of that waveform. Two things decide whether the answer is right.</p>
  <p><strong>The window</strong> has to be a whole number of cycles of the fundamental, or the energy of each harmonic leaks into its neighbours, and it has to be taken once the case is in steady state, not during the start-up or a transient. <strong>The plot step</strong> sets the highest frequency there is to find: a waveform written every 250 us holds nothing above about 2 kHz, however fine the solution time step was.</p>
  <p>PSCAD also has on-line components that do this during the run (the <a href="../../reference/master-fft/">On-Line Frequency Scanner</a> and the <a href="../../reference/master-thd/">Harmonic Distortion Calculator</a>). Doing it in Python afterwards needs nothing added to the case, and any recorded channel can be analysed at any instant.</p>`,
      method: `  <ol class="dx-steps">
    <li><strong>Choose the plot step</strong> for the highest harmonic you need (below).</li>
    <li><strong>Run long enough to settle</strong>, and take the window at the end of the run.</li>
    <li><strong>Take whole cycles</strong>: one or two cycles of the fundamental is the usual window.</li>
    <li><strong>Transform and sum</strong>: each harmonic as a percentage of the fundamental, THD from harmonic 2 upwards.</li>
  </ol>
  <h3>How far the plot step lets the spectrum reach</h3>
  ${table([{ h: 'Plot step', key: 0 }, { h: 'Highest frequency', key: 1 }, { h: 'Highest harmonic', key: 2 }], STEP.map(r => ({ 0: r[0], 1: r[1], 2: r[2] })))}
  <p class="dx-note">The highest frequency is half the rate the channel is written at. Keep a margin below it: the harmonics close to that limit are the least accurate.</p>
  <h3>The calculation</h3>
  ${pre(`v = run.series("Vbus")
h = thd(v, frequency=50, at=None, cycles=2, harmonics=50)   # at=None: the window ends at the end of the run
print(h.value)            # THD, % of the fundamental
print(h.worst, h.worst_order)   # the largest harmonic, %, and its order
print(h.fundamental)      # the magnitude of harmonic 1, in the channel's unit
spectrum = list(zip(h.orders, h.pct))   # every order, for a table or a bar chart`)}
  <p><code>thd</code> takes the <code>cycles</code> whole cycles that end at <code>at</code>, transforms them, and counts THD the way a grid code states it: the square root of the sum of the squares of harmonics 2 upwards, over harmonic 1. The DC component is left out unless <code>include_dc=True</code>.</p>`,
      builder: builderBlock(b,
        'The Harmonics and THD Quick Start runs the case for 1 s with a 20 us step and a 50 us plot step, takes two cycles of a voltage at the end of the run, tables the THD, the worst harmonic and its order, and draws the spectrum as a bar chart. This is the file with the case set to <code>C:/Studies/inverter/inverter.pscx</code>:',
        [
          'The 50 us plot step holds frequencies up to 10 kHz, so the 50 harmonics asked for are well inside what the file has.',
          '<code>thd(vbus, frequency=f_nominal(app), ...)</code> reads the nominal frequency from the case\'s own global substitution when <code>F_NOMINAL</code> is <code>"auto"</code>.',
          'The window ends at the end of the run. Make the run long enough that the case has settled well before that.',
          '<code>plot_xy(thd_result.orders, [thd_result.pct], kind="bar")</code> is the spectrum as a bar chart, each harmonic as a percentage of the fundamental.',
        ], 'harmonics_and_thd.py'),
      pitfalls: [
        '<strong>Harmonics above the plot step\'s limit.</strong> They are not in the file, and the transform folds anything near the limit back down as a false lower harmonic. Lower the plot step, or ask for fewer harmonics.',
        '<strong>A window during a transient.</strong> The start-up of a case, a fault and a step all spread energy across the spectrum. Take the window once the waveform repeats cycle after cycle.',
        '<strong>A fundamental that is not what you said.</strong> The window is cycles of the frequency you give. A case running at 60 Hz analysed at 50 Hz gives a meaningless spectrum. <code>F_NOMINAL = "auto"</code> reads it from the case.',
        '<strong>A three phase channel is three channels.</strong> A channel titled <code>Vbus</code> on a three phase signal is recorded as <code>Vbus:1</code>, <code>Vbus:2</code> and <code>Vbus:3</code>. Analyse each phase, or the one the requirement names.',
      ],
      faq: [
        ['How do I calculate THD from a PSCAD simulation?', 'Record the voltage or current with an output channel, run until the case has settled, then take a whole number of cycles at the end and work out the Fourier transform. THD is the root of the sum of the squares of harmonics 2 upwards, over the fundamental. The Builder\'s Harmonic distortion block does this from any recorded channel.'],
        ['Does PSCAD have a harmonic load flow?', 'No. PSCAD is a time-domain simulator, so harmonics are read from the simulated waveform rather than calculated in the frequency domain. Its on-line frequency scanner does the same during the run.'],
        ['What plot step do I need for harmonics in PSCAD?', 'At least twice the highest frequency you need, with a margin: a 250 us plot step reaches about 2 kHz, a 50 us plot step about 10 kHz.'],
      ],
    },
  };
}
