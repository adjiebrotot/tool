// Guide: sweeping a component parameter (sweep), and the two PSCAD ways to hold variants in one
// case: layers (layers) and global substitution sets (substitutions).
export default async function ({ builderScript, builderBlock, builderExtra, pre }) {
  const sweep = await builderScript('sweep', ({ set }) => set('n1', {
    project: 'C:/Studies/filter/filter.pscx',
  }));
  const layers = await builderScript('layers', ({ set }) => set('n1', {
    project: 'C:/Studies/substation/substation.pscx',
  }));

  return {
    slug: 'parameter-sweep', crumb: 'Parameter sweep',
    card: 'Sweep a PSCAD parameter with Python',
    title: 'Sweep a PSCAD parameter with Python: values, layers and substitution sets',
    h1: 'Sweep a PSCAD parameter with Python',
    desc: 'Run a PSCAD case once per value of a component parameter from Python, then once per layer and once per global substitution set, and table what a channel did.',
    lead: 'A sweep is the simplest study there is: <strong>write a value, run, read, put it back</strong>, once for each value. PSCAD adds two ways of holding variants that a sweep can go over as well: <strong>layers</strong>, which switch whole groups of components in and out, and <strong>global substitution sets</strong>, which give every <code>$(name)</code> in the case a different value at once.',
    whatTitle: 'What a parameter sweep in PSCAD is',
    qsTitle: 'Sweep one parameter',
    level: 'Beginner',
    keywords: ['pscad parameter sweep python', 'pscad sweep script', 'pscad layers python', 'pscad global substitution', 'mhi.pscad parameters', 'pscad multiple run python'],
    about: ['PSCAD', 'Parameter sweep', 'Sensitivity analysis', 'Python'],
    sections: {
      what: `  <p>Every component in a PSCAD case has parameters, read and written from Python as a dictionary: <code>comp.parameters()</code> gives them, <code>comp.parameters(R="12.5 [ohm]")</code> writes one. A sweep writes one parameter over a range of values and runs the case for each, recording what an output channel did.</p>
  <p>Two things make a sweep in PSCAD different from a hand edit. A value that carries a unit is written with it, and PSCAD keeps the unit it is given. And each write <strong>changes the case on disk</strong> when it is saved, so the script records each value it replaces and puts it back.</p>
  <p>PSCAD's own <a href="../../reference/master-mrun/">Multiple Run</a> component sweeps up to six variables inside one run of the executable. A Python sweep is slower to start each run, but it can change anything in the case, including what Multiple Run cannot reach: a layer, a substitution set, a component's definition, the run settings.</p>`,
      method: `  <ol class="dx-steps">
    <li><strong>Find the component</strong> by definition and Name, and check the parameter's name and unit in the <a href="../../reference/">component reference</a>.</li>
    <li><strong>Loop over the values.</strong> Each pass opens a mark, writes the value, runs, reads, records a row, and undoes the mark.</li>
    <li><strong>Graph the result</strong> against the swept value from the table.</li>
  </ol>
  <h3>One parameter over a range</h3>
  ${pre(`resistor = px_find(app, "master:resistor", "Rload")
for r in num_range(1, 10, 1):
    mark = px_mark()
    px_set(resistor, "R", r, unit="ohm")      # written in the unit R already carries
    run = px_run(app, duration=1, step=50, plot_step=250)
    table("Sweep").add({"R (ohm)": r, "Peak": peak(run.series("Vbus"), kind="abs").value})
    px_undo(mark)
plot_table("Sweep", "R (ohm)", ["Peak"])`)}
  <h3>Every layer, one at a time</h3>
  <p>A layer is a named group of components that is enabled or disabled together, so one case can hold several network arrangements: a line in or out, a second transformer, a different filter. Going over the layers puts each one in while the others are out.</p>
  ${pre(`for name in each_layer(app, layer_list(app, "*"), "Enabled", "Disabled"):
    run = px_run(app, duration=2, step=50, plot_step=250)
    table("Arrangements").add({"Peak": peak(run.series("Vbus"), kind="abs").value})`)}
  <h3>Every global substitution set</h3>
  <p>A global substitution is a named value that any component parameter written as <code>$(name)</code> takes, and a set holds one value for each. Switching the active set changes every one of them at once, which is how one case covers several parameter sets: a weak and a strong grid, summer and winter.</p>
  ${pre(`for name in each_gs_set(app, [n for n in gs_sets(app) if n]):
    run = px_run(app, duration=2, step=50, plot_step=250)
    table("Sets").add({"Final value": final_value(run.series("Vbus"))})`)}
  <p>Make the sets once in PSCAD, or load them from a CSV with <code>gs_load</code>. A case with no named sets has one set whose name is empty, which is why the loop leaves it out.</p>`,
      builder: builderBlock(sweep,
        'The Sweep one parameter Quick Start steps a resistor\'s <code>R</code> from 1 to 10, runs the case for each value and tables the peak of a channel, with a graph of the peak against the value. Change the component, the parameter and the channel to your own. This is the file with the case set to <code>C:/Studies/filter/filter.pscx</code>:',
        [
          '<code>px_find(app, "master:resistor", "", "one")</code> wants exactly one resistor. Give a Name when the case has several; with none, the error lists the Names it found.',
          '<code>px_set(resistor, "R", value, None)</code> writes the value in the unit <code>R</code> already carries and records the old one.',
          'A pass that does not build or stops early is skipped with a note in the table, and the next value is tried.',
          '<code>plot_table("Sweep", "Value", ["Peak"])</code> draws the table\'s Peak column against the swept value when the loop ends.',
        ], 'sweep_one_parameter.py') + '\n' + builderExtra(layers,
        'The Run every network arrangement Quick Start goes over the layers instead: each layer in turn is enabled and the others disabled, and each arrangement is run and tabled:',
        'run_every_arrangement.py'),
      pitfalls: [
        '<strong>A unit you did not mean.</strong> PSCAD stores a written unit as given: write <code>"2500 [mohm]"</code> and the parameter is in mohm from then on. <code>px_set</code> writes in the unit the parameter already carries, converting from the one you name.',
        '<strong>A value read as a plain number loses its unit.</strong> A unit-carrying value comes back as a number whose unit is only in its text. Read it as text first, or use <code>px_get</code> with a unit.',
        '<strong>A Choice written as its words.</strong> A Choice takes its symbol, the capitals in the reference, such as <code>"YES"</code> or <code>"RR_L"</code>, not the words in the dialog.',
        '<strong>A component that is in the case twice.</strong> <code>find_all</code> gives every instance, on every page and inside every module. Name the one to change, or the sweep writes on all of them.',
        '<strong>Enabling a component needs PSCAD 5.0.2.</strong> <code>Component.enabled</code> is not there on 5.0.0; <code>enable()</code> and <code>disable()</code> are, which is what the runtime uses.',
      ],
      faq: [
        ['How do I change a component parameter in PSCAD from Python?', 'Find the component with <code>project.find_all("master:resistor")</code> (or by its Name), then call <code>comp.parameters(R="12.5 [ohm]")</code>. <code>comp.parameters()</code> with no arguments gives every parameter and its current value.'],
        ['What is the difference between a Python sweep and Multiple Run?', 'Multiple Run steps up to six variables inside the case, in one go of the executable. A Python sweep starts a run per value and can change anything in the case between runs, including layers, substitution sets and the run settings.'],
        ['How do I switch layers in PSCAD from a script?', 'Set the layer\'s state on the project, enabled or disabled, then run. The Builder\'s runtime does it with <code>layer_set(app, name, "Enabled")</code> and puts every layer back the way it found it at the end.'],
      ],
    },
    builderTitle: 'The full Python scripts from the Builder',
  };
}
