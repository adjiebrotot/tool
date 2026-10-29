# PowerFactory Scripter (the form): notes for the AI section

Hand-written. `node _ref/agent-doc.mjs` merges these notes with the fields it reads from the page
and writes `powerfactory-scripter/legacy/agent.txt`, the AI section in `index.html` and the lines in
`llms.txt`. Edit here, never the generated text, then run the generator. Text above the first
heading (this) is not published. The headings are the same as in `rentvsownhouse/agent-notes.md`.

Two things are specific to this tool. A Quick Start is a sample configuration
(`samples/json-samples/`, the ones with a button); it brings the tables (input variables, output variables, constraints,
outages), which a link cannot change, so they are not link keys (`index.html` marks them
`data-no-persist`), and neither is the folder the script imports PowerFactory's module from
(`pf-api-path`). The form's other fields are ordinary fields, and a link sets them on top of the
sample (`script.js`, "AI links": the mini cache keeps the whole configuration as its extra, so a
field a link sets goes into that too). The script is written once the link has applied, unless the
link says `run=0`. For a study that needs other inputs or outputs, the Workflow Builder takes a whole
workflow in a link (`powerfactory-scripter/builder/agent.txt`).

## Decides

Which kind of PowerFactory study a Python script runs: a sweep of input values, an optimisation, a run of scenarios from a file, or an outage screening (N-1 or N-2), in which study type (load flow, RMS, EMT or harmonic) and with what options. The tool writes one ready-to-run script from the form, and the user downloads it. It does not run PowerFactory or work out a study result. The script comes from the tool, so a link to it gives the user the whole script.

## Most important

- problem-type
- study-type
- tstop
- optim-algorithm
- optim-max-iter
- coding-style

## Fields

- problem-type: What the script does. brute_force runs every combination of the input variables' values (a sweep). optimisation searches the input variables' ranges for the best value of the output named in optim-objective. custom reads its scenarios from the file in scenario-file-path. contingency takes out each element of the outage list in turn (N-1, or pairs with contingency-n). The inputs and outputs come with the Quick Start, so pick the Quick Start whose problem type is the one wanted.
- study-type: The calculation each run makes in PowerFactory: steady_state (load flow), dynamic_rms, dynamic_emt or harmonic. It must suit the Quick Start's outputs: a time series output needs a dynamic study.
- tstop: Where a dynamic (RMS or EMT) simulation stops, in seconds from its start. Only used by a dynamic study type. Typical 10 to 20 for RMS and a fraction of a second to a few seconds for EMT. A Quick Start with a dynamic study type, or a study-type of dynamic_rms or dynamic_emt without a tstop, opens on that study type's usual 20 s (RMS) or 0.25 s (EMT); send tstop to change it.
- coding-style: python_file is a plain script; notebook is the same code in cells for Jupyter.
- optim-sense: Only for the optimisation problem type: minimise or maximise the objective.
- optim-objective: Only for the optimisation problem type: the name of one of the Quick Start's output variables (QUICK START FIGURES names them under objective). Leave it out to keep the Quick Start's.
- optim-algorithm: Only for the optimisation problem type: the search method. placeholder (Manual) writes a TODO for the user's own search. The scipy ones are local searches; differential_evolution and gp_minimize (Bayesian) search the whole range and suit a result with several local minima.
- optim-max-iter: Only for the optimisation problem type: the most tries the search makes. Typical 30 to 200.
- scenario-file-path: Only for the custom problem type: the path of the spreadsheet or CSV with the scenarios, as the script's computer sees it. Leave it out unless the user gives it.
- contingency-n: Only for the contingency problem type: 1 takes out one element at a time, 2 takes out pairs.
- contingency-combine: Only for the contingency problem type with N-2 and two or more element types in the outage list. Ticked: a pair may mix types, such as a line with a generator. Unticked: pairs form within one type.
- iterate-study-cases: Run the whole study once for each study case in the project.
- iterate-operating-scenarios: Run the whole study once for each operating scenario.
- use-progress-bar: Show a progress bar (tqdm) while the script runs. On by default.
- open-pf-window: Open the PowerFactory window while the script runs (slower). Off by default.
- save-intermediate: Save the results every save-interval-minutes while a long run goes on, so a stop does not lose them.
- save-interval-minutes: Only with save-intermediate on: the minutes between saves.
- pf-username: The PowerFactory user to log in as. Leave it out unless the user gives it: empty means their own.
- output-dir: The folder results are written to. Leave it out unless the user gives it: empty means next to the script.

## Hide

## Quick Starts

The Quick Starts are worked examples on the IEEE 9-bus system, listed with their input and output variables under QUICK START FIGURES. A link cannot change those tables, so pick the one whose study is closest to what the user wants and set the fields on top of it. Its fields are put back to its own values first, so name each field the user wants different. Without qs the form opens as it starts, with one input and one output variable to fill in.

For a study none of them is near (other inputs or outputs, a study built from steps), use the Workflow Builder, which takes a whole workflow in a link: https://tool.adjiebrotots.com/powerfactory-scripter/builder/agent.txt

## Example

Request: using tool.adjiebrotots.com/powerfactory-scripter/legacy, write me a PowerFactory script that finds the generator dispatch giving the lowest system losses, using differential evolution with up to 100 tries, as a notebook

Link:
- qs=sample-02-minimum-system-losses
- optim-algorithm=differential_evolution
- why.optim-algorithm=The search method the user asked for
- optim-max-iter=100
- why.optim-max-iter=The user allows up to 100 tries
- coding-style=notebook
- why.coding-style=The user wants a notebook
- note=Minimum system losses, differential evolution, notebook

Assumptions:
1. Study: the Minimum System Losses Quick Start (qs=sample-02-minimum-system-losses): an optimisation of the G2 and G3 dispatch on the IEEE 9-bus system, minimising the total network losses.
2. Search method: differential evolution (optim-algorithm), as the user asked.
3. Tries: at most 100 (optim-max-iter), as the user allows.
4. Output: a notebook (coding-style) rather than a plain script.
5. Study type, project user, output folder and the rest: left as the Quick Start has them, so it runs a load flow as the user the script is run by and writes next to the script.
