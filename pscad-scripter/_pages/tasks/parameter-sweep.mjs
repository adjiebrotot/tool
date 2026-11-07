// Guide: change one parameter over a range, run each value, collect the results.
export default async function ({ builderScript, builderBlock, pre }) {
  const b = await builderScript('sweep', ({ set }) => set('n1', {
    project: 'C:/work/mycase.pscx',
  }));

  return {
    slug: 'parameter-sweep', crumb: 'Parameter sweep',
    card: 'Sweep a parameter in PSCAD and collect the results',
    title: 'PSCAD parameter sweep with Python: one value per run, one table',
    h1: 'Sweep a parameter in PSCAD and collect the results',
    desc: 'Change one PSCAD component parameter over a range from Python, run the EMT simulation for each value, read a channel back and collect every pass in one results table.',
    lead: `A sweep is the first thing worth automating in PSCAD, because an EMT run takes as long as it takes and a sweep of them is an afternoon of starting the next one by hand. The script is short: <strong>write the parameter, build, run, read a channel, take a number off it, record the row, put the parameter back</strong>. What makes it worth getting right is the last step, and the units.`,
    whatTitle: 'What a sweep changes',
    methodTitle: 'The method',
    qsTitle: 'Sweep one parameter',
    level: 'Beginner',
    keywords: ['pscad parameter sweep', 'pscad python loop', 'pscad batch simulation', 'pscad multiple run', 'sweep pscad parameter python', 'pscad results table'],
    about: ['PSCAD', 'Parameter sweep', 'Electromagnetic transient simulation'],
    sections: {
      what: `  <p>A PSCAD sweep writes one parameter on one component before each run. The parameter is named exactly as the component's dialog names it, and the <a href="../../reference/">component reference</a> lists every one with its unit, range and default: <code>R</code> on a <a href="../../reference/resistor/">resistor</a>, <code>Tmva</code> on a <a href="../../reference/xfmr-3p2w/">transformer</a>, <code>Es</code> on a <a href="../../reference/source3/">source</a>.</p>
  <p>Two things about PSCAD values are worth knowing before the first sweep.</p>
  <ul class="dx-prose">
    <li><strong>A value carries its unit in its text.</strong> A resistance reads back as <code>2.5 [ohm]</code>, not as <code>2.5</code>. PSCAD keeps the unit that was written rather than normalising it, so a value written as <code>2500 [mohm]</code> stays in milliohms and reads back that way. Write the unit you mean.</li>
    <li><strong>A written value is written in the case</strong>, not in a session. There is no read-only mode: the last value of a sweep becomes the case's new setting unless the script puts it back.</li>
  </ul>
  <p>PSCAD also has its own <a href="../../reference/mrun/">Multiple Run</a> component, which runs the case once per combination without the script restarting it. It is faster for a small self-contained sweep. A script loop is easier to read, easier to check, and the only option once the sweep has to change several things or decide what to try next, so these guides use the loop.</p>`,
      method: `  <ol class="dx-steps">
    <li><strong>Find the component once</strong>, before the loop. Finding it every pass is wasted time and hides a model that has two of them.</li>
    <li><strong>Open a mark</strong> at the top of each pass so the pass can be undone at the bottom.</li>
    <li><strong>Write the parameter</strong>, in the unit it already carries.</li>
    <li><strong>Run.</strong> PSCAD builds the case again by itself when the change needs it.</li>
    <li><strong>Read the channel</strong> the study cares about, and take one number off it.</li>
    <li><strong>Add a row.</strong> The loop value is added for you, so the table always says which pass a row came from.</li>
    <li><strong>Undo the mark</strong>, so the next pass starts from the case as it was.</li>
  </ol>
  ${pre(`load = px_find(app, "master:resistor", "Load")       # once, before the loop

for value in num_range(1.0, 10.0, 1.0):
    mark = px_mark()
    px_set(load, "R", value, unit="ohm")

    run = px_run(app, duration=1.0, step=50, plot_step=250)
    v = run.series("Vbus")
    worst = peak(v, kind="abs")

    table("Sweep").add({
        "R (ohm)": value,
        "Peak voltage": worst.value,
        "At (s)": worst.time,
    })
    px_undo(mark)`)}
  <h3>Sweeping two things at once</h3>
  <p>Nest the loops. The results table records both loop values on every row, so a two dimensional sweep comes out as a long table that pivots into a surface rather than as a grid you have to reassemble.</p>
  ${pre(`for r in num_range(1.0, 10.0, 1.0):
    for mva in (100, 200, 400):
        mark = px_mark()
        px_set(load, "R", r, unit="ohm")
        px_set(source, "MVA", mva, unit="MVA")
        run = px_run(app)
        table("Sweep").add({"Peak": peak(run.series("Vbus"), kind="abs").value})
        px_undo(mark)`)}
  <h3>Sweeping something that is not a number</h3>
  <p>A Choice parameter takes a symbolic value, not the label the dialog shows. The <a href="../../reference/">component reference</a> lists both for every Choice, so a sweep over winding connections writes <code>YD1="Y"</code> and <code>YD1="D"</code> rather than the words beside them.</p>
  ${pre(`for connection in ("Y", "D"):
    px_set(xfmr, "YD1", connection)`)}
  <h3>What the table is for</h3>
  <p>One row per pass, every loop value on the row, and the numbers the checks produced. It is saved as CSV or Excel into the run folder when the script ends, so the sweep leaves something that can be plotted, diffed against the last model, and attached to a report without being retyped.</p>`,
      builder: builderBlock(b,
        'The sweep Quick Start is the loop, wired: a component, a range, a parameter write, a run, a channel and a table. Point the component at yours and change the range, and it is your sweep. This is the file the Builder writes:',
        [
          'The <strong>Component</strong> block finds the component once and hands it to the <strong>Set parameter</strong> block, so it is found before the loop rather than inside it.',
          'The <strong>For a range of numbers</strong> block is the sweep. Its value output goes into Set parameter, so the range is in one place.',
          '<code>px_set</code> records the old value as it writes, which is what makes the undo at the end of the pass cheap and exact.',
          'Every pass is wrapped in <code>px_mark()</code> and <code>px_undo(mark)</code>, so the parameter goes back before the next value is written and the case ends as it started.',
          'The <strong>Add row</strong> block writes the loop value as well as the check, so the table says which pass each row came from without being told.',
          '<strong>Draw graph from results table</strong> plots the collected column against the swept one after the loop, which is the picture a sweep is usually for.',
        ], 'parameter_sweep.py'),
      pitfalls: [
        '<strong>Dropping the unit.</strong> <code>px_set(obj, "R", 2.5)</code> writes 2.5 in whatever unit the parameter already carries. If that is milliohms, the sweep is a thousand times off and nothing complains. Name the unit.',
        '<strong>Not putting the value back.</strong> A PSCAD parameter a script writes is written in the case. Without the undo, the case on disk ends up holding the last value of the sweep.',
        '<strong>Finding the component inside the loop.</strong> It costs a search per pass and, worse, it hides the case where two components match: the script quietly works on whichever came first.',
        '<strong>A range that steps past its end.</strong> Floating point means a range from 0.1 to 0.5 in steps of 0.1 may give four values or five. Where the end point matters, list the values instead.',
        '<strong>Sweeping something that needs a rebuild and not allowing for the time.</strong> Some parameters are used when the Fortran is generated, so writing them costs a build per pass. The first pass of a sweep will tell you which kind you have.',
        '<strong>Reading a channel the case does not record.</strong> The sweep runs to the end and the column is empty. Run once with <code>run.names()</code> printed, and copy the titles from there.',
      ],
      faq: [
        ['How do I sweep a parameter in PSCAD with Python?', 'Find the component once, then loop: write the parameter with its unit, run the case, read the channel you care about, take a number off it and add a row. Put the parameter back at the end of each pass, because a value a script writes is written in the case itself.'],
        ['Should I use the Multiple Run component or a Python loop?', 'The Multiple Run component is faster for a small, self-contained sweep because PSCAD does not restart the case between runs. A Python loop is easier to read and check, and it is the only option once the sweep changes several things, reads results between passes, or decides what to try next.'],
        ['How do I write a value with its unit in PSCAD?', 'Write it as text with the unit in brackets: "250 [MVA]", "2.5 [ohm]". PSCAD keeps the unit you wrote rather than converting it, so a value written in milliohms stays in milliohms and reads back that way.'],
        ['How do I sweep a dropdown parameter?', 'A Choice parameter is written with its symbolic value rather than the label shown in the dialog. The component reference lists the symbolic value beside the label for every Choice in the Master Library.'],
      ],
    },
  };
}
