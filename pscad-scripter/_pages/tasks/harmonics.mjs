// Guide: THD and a harmonic spectrum out of a time domain run, and the plot step that limits them.
export default async function ({ builderScript, builderBlock, pre, table }) {
  const b = await builderScript('harmonics', ({ set }) => set('n1', {
    project: 'C:/work/mycase.pscx',
  }));

  const STEPS = [
    ['1000 us', '500 Hz', 'Too coarse for harmonics. Enough for an envelope, nothing more.'],
    ['250 us', '2 kHz', 'About the 40th harmonic of 50 Hz. The usual choice for a harmonic study.'],
    ['50 us', '10 kHz', 'Comfortably past any harmonic order a grid code asks for.'],
    ['20 us', '25 kHz', 'For switching ripple and anything above the audible range.'],
  ];

  return {
    slug: 'harmonics', crumb: 'Harmonics and THD',
    card: 'Harmonics and THD from a PSCAD EMT run',
    title: 'PSCAD harmonics and THD with Python: a spectrum from the time domain',
    h1: 'Harmonics and THD from a PSCAD EMT run',
    desc: 'Get total harmonic distortion and a harmonic spectrum out of PSCAD with Python: run in the time domain, window the waveform, take a DFT and read the orders back.',
    lead: `PSCAD has <strong>no frequency domain harmonic scan</strong>. There is no command that returns a spectrum, because PSCAD solves in the time domain and nothing else. A harmonic study is therefore a normal EMT run, with the spectrum worked out from the waveform the run recorded. That makes two things matter more than they would elsewhere: <strong>the plot step</strong>, which sets how far up the spectrum is real, and <strong>the window</strong>, which sets whether the numbers mean anything at all.`,
    whatTitle: 'Why there is no harmonic scan',
    methodTitle: 'The method',
    qsTitle: 'Harmonics and THD from an EMT run',
    level: 'Intermediate',
    keywords: ['pscad thd', 'pscad harmonics python', 'pscad harmonic spectrum', 'pscad fft', 'total harmonic distortion pscad', 'EMT harmonics', 'pscad plot step harmonics'],
    about: ['PSCAD', 'Total harmonic distortion', 'Harmonic analysis', 'Electromagnetic transient simulation'],
    sections: {
      what: `  <p>A load flow tool can answer a harmonic question directly, by injecting a current at each order and solving the network at that frequency. PSCAD cannot, and does not try: it integrates the network in the time domain, one step at a time. What comes out is a waveform, and a waveform holds its harmonics implicitly.</p>
  <p>Getting them out is a <strong>discrete Fourier transform over a whole number of cycles</strong> of the settled waveform. That is a small amount of arithmetic, and it is the only honest route. The things that go wrong are not in the transform; they are in what it is given.</p>
  <ul class="dx-prose">
    <li><strong>The plot step caps the spectrum.</strong> A channel recorded every 250 us has a sampling rate of 4 kHz, so nothing above 2 kHz exists in it. Orders above that are not small, they are absent, and anything that appears up there is an artefact.</li>
    <li><strong>The window has to be a whole number of cycles</strong> of the fundamental, and it has to sit in the settled part of the run. A window that starts during the initialisation transient measures the transient.</li>
    <li><strong>The fundamental has to be the right one.</strong> A case running at 60 Hz windowed as 50 Hz spreads every order across its neighbours and the THD comes out high and meaningless.</li>
  </ul>
  <p>PSCAD also has an <a href="../../reference/thd/">on-line THD component</a> that does this inside the run. It is useful when you want THD plotted against time; a script that takes the transform afterwards can choose its own window and keep the whole spectrum.</p>`,
      method: `  <h3>What the plot step lets you see</h3>
  ${table([{ h: 'Plot step' }, { h: 'Highest real frequency' }, { h: 'What it is good for' }].map((c, i) => ({ ...c, fn: r => r[i] })), STEPS)}
  <p class="dx-note">The solution step matters too, but differently: it has to be small enough to solve the switching that creates the harmonics in the first place. A converter solved at 50 us and recorded at 250 us gives a spectrum that is real up to 2 kHz and a solution that is honest about where the harmonics came from.</p>
  <h3>Running, windowing, transforming</h3>
  <ol class="dx-steps">
    <li><strong>Run long enough to settle, plus whole cycles to measure.</strong> One second at 50 Hz is fifty cycles; the last ten of them are usually a good window.</li>
    <li><strong>Record at a plot step that covers the orders you need</strong>, from the table above.</li>
    <li><strong>Read the channel</strong> back as a series of time and value.</li>
    <li><strong>Take the window</strong>: a whole number of cycles, ending at the end of the run.</li>
    <li><strong>Transform</strong>, and read the orders off as a fraction of the fundamental.</li>
    <li><strong>Record THD and the orders that matter</strong>, usually 2nd to 50th, each as its own column.</li>
  </ol>
  ${pre(`run = px_run(app, duration=1.0, step=20, plot_step=250)
v = run.series("Vbus")

h = spectrum(v, f0=50.0, cycles=10)      # the last 10 cycles of the settled waveform
print(h.thd)                              # as a fraction: 0.031 is 3.1 %
print(h.order(5), h.order(7))             # the orders people ask about first

table("Harmonics").add({
    "THD (%)": h.thd * 100,
    "5th (%)": h.order(5) * 100,
    "7th (%)": h.order(7) * 100,
    "11th (%)": h.order(11) * 100,
    "13th (%)": h.order(13) * 100,
})`)}
  <h3>THD over a sweep</h3>
  <p>The useful harmonic study is rarely one number. It is THD against something: the number of converters on, the short circuit level at the connection point, the filter that is in service. That is <a href="../parameter-sweep/">a sweep</a> with a spectrum at the end of each pass, and a table with one row per pass.</p>
  ${pre(`for mva in (500, 1000, 2000, 5000):
    mark = px_mark()
    px_set(source, "MVA", mva, unit="MVA")
    run = px_run(app, duration=1.0, step=20, plot_step=250)
    h = spectrum(run.series("Vbus"), f0=50.0, cycles=10)
    table("Harmonics").add({"Short circuit (MVA)": mva, "THD (%)": h.thd * 100})
    px_undo(mark)`)}
  <h3>What to look at</h3>
  <p>The THD number is the headline, but the <strong>shape of the spectrum says what is happening</strong>. A six pulse converter puts its energy at the 5th, 7th, 11th and 13th; energy at even orders or at the 3rd says something is unbalanced or has a DC offset; a broad floor with no clear orders usually means the window was wrong or the waveform had not settled.</p>`,
      builder: builderBlock(b,
        'The harmonics Quick Start is a run, a channel and a THD block, with the spectrum drawn as a bar chart and the orders written into a table. This is the file the Builder writes:',
        [
          'The run is set up with a <strong>20 us solution step</strong> and a <strong>250 us plot step</strong>: fine enough to solve the switching, recorded finely enough to resolve up to about 2 kHz.',
          'The <strong>Harmonic distortion (THD)</strong> block takes the DFT over a whole number of cycles of the settled part of the waveform, so there is nothing to line up by hand.',
          'Its outputs are the THD and the individual orders, so one block feeds both the headline number and the per-order columns of the table.',
          'The <strong>Draw 2D graph</strong> block plots order against magnitude, which is the spectrum as a report wants it.',
          'The fundamental is read from the case rather than assumed, so a 60 Hz model does not need the script edited.',
        ], 'harmonics_and_thd.py'),
      pitfalls: [
        '<strong>Expecting a harmonic load flow.</strong> There is not one. Every harmonic number in PSCAD comes out of a time domain waveform, so the run has to be long enough, settled, and recorded finely enough before any of it means anything.',
        '<strong>A plot step that hides the orders you are reporting.</strong> At 1000 us nothing above 500 Hz exists. Reporting a 25th harmonic from that recording is reporting noise.',
        '<strong>Windowing the initialisation.</strong> An EMT case starts from zero. A window that includes the first cycles measures the start-up, not the steady state. Window the end of the run, or <a href="../snapshots-and-batch/">start from a snapshot</a>.',
        '<strong>A window that is not a whole number of cycles.</strong> The energy of each order leaks into its neighbours and every number comes out wrong in a way that looks plausible.',
        '<strong>The wrong fundamental.</strong> 50 Hz assumed on a 60 Hz case, or a case running slightly off nominal, smears the spectrum. Read the frequency from the case.',
        '<strong>Comparing THD measured different ways.</strong> THD as a fraction of the fundamental and THD as a fraction of the RMS are different numbers. Say which one the column is.',
      ],
      faq: [
        ['How do I get THD out of PSCAD?', 'Run the case in the time domain, record the voltage or current on an output channel, and take a discrete Fourier transform over a whole number of cycles of the settled waveform. PSCAD has no frequency domain harmonic scan, so this is the only route; PSCAD also has an on-line THD component if you want it plotted against time.'],
        ['Can PSCAD do a harmonic load flow or frequency scan?', 'No. PSCAD solves in the time domain and has no harmonic load flow command. A harmonic impedance scan is done by injecting a current at a swept frequency and running the case at each one, which is a parameter sweep rather than a single calculation.'],
        ['What plot step do I need for harmonics in PSCAD?', 'The plot step sets the sampling rate of the recorded channel, so the highest real frequency is half of one over the plot step. 250 us resolves to about 2 kHz, which is roughly the 40th harmonic of 50 Hz; 50 us resolves to about 10 kHz.'],
        ['Why is my PSCAD THD much higher than expected?', 'Usually the window. A window that is not a whole number of cycles, or one that includes the start-up transient before the case has settled, spreads energy across every order and inflates the THD. Check the fundamental you windowed with matches the case as well.'],
      ],
    },
  };
}
