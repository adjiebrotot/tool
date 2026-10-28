# ED/UC Simulator: notes for the AI section

Hand-written. `node _ref/agent-doc.mjs` merges these notes with the fields it reads from the
page and writes `ed-uc-simulator/agent.txt`, the AI section in `index.html` and the lines in
`llms.txt`. Edit here, never the generated text, then run the generator. Text above the first
heading (this) is not published. The headings are the same as in `rentvsownhouse/agent-notes.md`.

Two things are specific to this tool. The network is not a form: a Quick Start loads one and a
link changes its parts by name (`el.<name>.<param>`, a family of keys the adapter reads in
`script.js`) or replaces it whole (`json`). The names and units in both are the saved ones
(`ed-core.js`: `ED.DEFAULTS`, `ED.SPEC`), the same as the tool's scenario files. The solve options
and the horizon are ordinary fields. The tool always solves a link's network, so `run` has no
effect here.

## Decides

How a power network is run over a stretch of hours at least cost: how much each generator, storage unit and HVDC link produces or moves in every hour, which units are switched on (unit commitment), what the operation costs, and the price of power at every bus (nodal prices), where a full line splits them. It solves on a single-line diagram, in economic dispatch or unit commitment mode.

## Most important

- edMode
- edSpan
- edSpanUnit
- edStart
- edLimits
- edShed
- edVoll
- edCur

## Fields

- edCur: The currency symbol shown beside every cost and price. It only relabels the figures and never converts them, so give every cost in one currency and set its symbol here (Rp, the euro sign and so on). Every Quick Start puts it back on $.
- edMode: How the network is solved. uc: each committable unit is on or off in each hour, with its start-up costs, minimum output and up and down times (exact). lin: the same with on or off relaxed to a share from 0 to 1 (quick; its cost is a lower bound). edm: every unit is on in every hour, between its minimum stable loading and its rating, cheapest first, with no start-ups or up and down times. ed: economic dispatch with no minimum output, every unit anywhere from zero to its rating. Use edm for nodal prices and plain economic dispatch, and uc when the user asks about start-ups, unit commitment or minimum up and down times. pjm5 opens as edm and the other Quick Starts as uc.
- edSpan: The length of the horizon, in the unit edSpanUnit sets: 1 to 30 days, or 1 to 720 hours. The hours are solved together, so storage and commitment carry over from one to the next. Days past 30 are pulled to 30 and reported.
- edSpanUnit: h for hours or d for days. The Quick Starts use days (a day, or three). Send edSpanUnit and edSpan together whenever the user's horizon is not in whole days, for example 36 hours is edSpan=36 with edSpanUnit=h.
- edStart: The first hour of the horizon, as YYYY-MM-DDTHH:00 (a whole hour). The built-in demand shapes follow the weekday and are lower at the weekend, so it matters for a horizon that crosses one. The default is 2026-01-01T00:00, a Thursday. Leave it out unless the user gives a date.
- edLimits: On (the default): lines, transformers and links carry no more than their ratings, so a full one splits the price on either side. Off: no branch limit binds. Turn it off only when the user asks to ignore the limits.
- edShed: On (the default): load the units cannot reach is cut at the value of lost load instead of making the problem infeasible. Off: such a case is reported as a problem and not solved.
- edVoll: The value of lost load: what a MWh not served costs, per MWh in the currency of edCur. It caps the price, since shedding is the last resort. Used only while edShed is on. Typical 3,000 to 20,000 (the default is 10,000). Leave it out unless the user gives one.
- edGap: Used only when edMode is uc. How close to the best possible cost the solver must prove its answer before it stops. 0.0001 is 0.01%, 0.001 is 0.1%, 0.01 is 1%. Leave it out.
- edTime: The solver's time limit, in seconds (10, 30, 60 or 300). Leave it out.

## Hide

- edHour
- animP
- colourBy
- storePick
- lb_Bus_name
- lb_Bus_price
- lb_Bus_p
- lb_Line_name
- lb_Line_p
- lb_Line_load
- lb_Transformer_name
- lb_Transformer_p
- lb_Transformer_load
- lb_Generator_name
- lb_Generator_p
- lb_Generator_status
- lb_Generator_cost
- lb_Load_name
- lb_Load_p
- lb_StorageUnit_name
- lb_StorageUnit_p
- lb_StorageUnit_soc
- lb_StorageUnit_socbar
- lb_Link_name
- lb_Link_p
- lb_Link_loss

## Quick Starts

There are four networks. pjm5 is the PJM 5-bus system from Li and Bo (2010): five buses, six lines, five generators and three loads, solved as an economic dispatch over a day. uc3 is a coal unit, a combined cycle and a peaker on one bus, solved as a unit commitment over a day. solar is a solar farm, a battery and two gas units serving homes and shops, solved as a unit commitment over a day. areas is a windy north and a gas-fired south joined by a 250 MW HVDC link, solved as a unit commitment over three days.

Start from the one closest to the user's network, then change its parts by name with the el.<name>.<param> keys. Their names, buses and ratings are under QUICK START FIGURES, so read the part the user means from there: in pjm5 the generator at bus E is Brighton, at bus A are Alta and Park City, at bus C Solitude and at bus D Sundance. A Quick Start also puts the options (edMode, the horizon, edStart, the limits, edCur and the rest) back on their own values, so send those keys after it. Without qs the tool starts from pjm5. A network that differs structurally, with other buses, lines or devices, goes in json.

## Example

Request: using tool.adjiebrotots.com/ed-uc-simulator, in the PJM 5-bus case, how do prices change if the Brighton generator's cost rises to $40/MWh?

Link:
- qs=pjm5
- el.Brighton.marginal_cost=40
- why.el.Brighton.marginal_cost=The user's new marginal cost for Brighton, in $ per MWh
- note=PJM 5-bus case, Brighton's marginal cost raised to $40/MWh

Assumptions:
1. Network: the PJM 5-bus Quick Start (qs=pjm5), unchanged apart from the cost below.
2. Brighton: the generator at bus E. Its marginal cost is set to $40 per MWh (el.Brighton.marginal_cost); its rating and every other part stay as in the Quick Start.
3. Solve: the Quick Start's own: mode {edMode} (edm is economic dispatch) over {edSpan} {edSpanUnit} (d is days), with line limits and load shedding as the tool defaults them.

## Compact lists

- `el.<name>.<param>=<value>`

Each key changes one parameter of one part of the network, found by the name the diagram shows for it (QUICK START FIGURES lists them). Names ignore case, spaces and underscores, so Park City, park city and ParkCity are one name; write it with %20 for the space or without it, as el.ParkCity.p_nom. Percent-encode any other awkward character in a name (# & + % /). The parameter is the text after the last dot. A name that no part has, or that two parts share, or a parameter the part does not take, is reported and skipped. A number outside the parameter's range is pulled into it and reported. A part with no name of its own is called by its automatic one (Generator 12, Load 7). Send one key per parameter, and a why.<key> beside each.

Parameters by kind of part, in the units the tool saves them in (the same as in json). A cost is per MWh, per start or per hour in the currency of edCur.

Bus parameters: v_nom (kV, 0.1 to 1500).

Line parameters: r (ohm, 0 to 100000), x (ohm, -100000 to 100000; a line needs a non-zero x) and s_nom (MW, 0 to 100000; 0 means no limit). A line with a standard type takes its impedance and rating from the type, so for it change length (km, 0 to 5000) and num_parallel (identical circuits, a whole number 1 to 20); the Quick Starts' lines have no type.

Transformer parameters: s_nom (MVA, 0 to 100000, above 0), x (per unit on s_nom, -10 to 10, not 0) and r (per unit on s_nom, 0 to 10).

Generator parameters: p_nom (MW, rating, 0 to 100000), marginal_cost (cost per MWh, -10000 to 100000), committable (1 or 0, or on or off: whether unit commitment may switch it off; read only in uc and lin), p_min_pu (minimum stable loading as a fraction of p_nom, 0 to 1, so 0.4 is 40%), start_up_cost and shut_down_cost (cost per start or stop, 0 to 100000000), stand_by_cost (cost per hour while on, 0 to 10000000), min_up_time and min_down_time (hours, whole numbers 0 to 168), ramp_limit_up and ramp_limit_down (the most it may move in an hour, as a fraction of p_nom, 0.01 to 1; 1 means no limit), init (1 if the unit was running before the first hour, else 0) and prof (its availability through the day: flat, or one of pv, pvs, pvw, pveq for solar, wnd for wind). The commitment values apply only to a committable unit.

Load parameters: p_set (MW, the peak demand, 0 to 100000) and prof (the shape through the day and the week: flat, or one of sys for a system day, res residential, com commercial, ind industrial, respv residential with rooftop solar, resev residential with electric cars).

Storage parameters: p_nom (MW, power rating, 0 to 100000), max_hours (hours of energy at full power, 0 to 1000), eff (round-trip efficiency as a fraction, 0.01 to 1, so 0.88 is 88%), soc0 (the starting charge as a fraction of its energy, 0 to 1; used when it is not cyclic) and cyclic (1 if it must end where it started, else 0).

Link parameters (an HVDC link): p_nom (MW, rating, 0 to 100000), efficiency (a fraction, 0.01 to 1, so 0.97 is 97%) and both (1 if it carries power either way, 0 for one way, from the first end).

A line type, a part's symbol, a cost curve, an uploaded hourly series, adding or removing parts and rewiring are not patches: send the network in json.

## Json

`json=<network>` replaces the network with one of the user's own: the form the tool saves, which is how every Quick Start is written. Use it only for a network that differs structurally from the four Quick Starts (other buses, lines or devices); to change a value on one of them, patch it. A qs before it is replaced, but still sets the options, so pick the nearest one or send edMode and the horizon yourself. Write it compactly (no spaces or line breaks) and leave out every parameter that is at its default.

{"v":2,"name":"<title>","el":[<part>,<part>,...]}

Each part is {"c":<class>,"id":<whole number>, ...}. The class is Bus, Line, Transformer, Generator, Load, StorageUnit or Link. Every id is a different whole number, across all parts together. A name is only needed to override the automatic one (Bus 3, Load 7, Generator 4); the names el.<name>.<param> and the diagram use are these.
- A device (Generator, Load, StorageUnit) names its bus with "bus":<bus id>.
- A branch (Line, Transformer, Link) names both ends with "bus0":<bus id> and "bus1":<bus id>. One with a missing end is left out and reported.
- The other keys are the parameters listed under COMPACT LISTS, in the same units. A Bus needs "v_nom" in kV (its default is 1). Give every Line an "x" (and "s_nom" for a limit) and every Transformer an "s_nom" and "x". A Generator costs nothing and has no rating by default, so give "p_nom" and "marginal_cost"; "committable":1 with "p_min_pu", "start_up_cost" and the up and down times makes it a unit that edMode uc or lin commits. A Load needs "p_set" and usually "prof".
- Leave out "at" and the tool lays the buses out in rows from the first bus, with devices and branches placed automatically.
- Generator "style":"pv" or "wind" only draws the unit as solar or wind; its "prof" (pv, wnd) is what makes it follow the sun or the wind.
At least one bus is needed; the tool optimises up to 300 buses and 120 generators. An unknown class, a missing bus or a number out of range is reported or pulled into range, never a failure. A network that cannot be read at all leaves the tool on its Quick Start.
Two buses joined by a line, a gas unit and wind at the first and a town load at the second, solved as a unit commitment over a day (send edMode=uc with it):
{"v":2,"name":"Hub and town","el":[{"c":"Bus","id":1,"name":"Hub","v_nom":110},{"c":"Bus","id":2,"name":"Town","v_nom":110},{"c":"Line","id":3,"bus0":1,"bus1":2,"x":12,"s_nom":120},{"c":"Generator","id":4,"name":"Gas","bus":1,"p_nom":150,"marginal_cost":45,"committable":1,"p_min_pu":0.3,"start_up_cost":2000,"min_up_time":2},{"c":"Generator","id":5,"name":"Wind","bus":1,"p_nom":80,"prof":"wnd","style":"wind"},{"c":"Load","id":6,"name":"Town load","bus":2,"p_set":100,"prof":"res"}]}
