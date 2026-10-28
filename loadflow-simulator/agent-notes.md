# Load Flow Simulator: notes for the AI section

Hand-written. `node _ref/agent-doc.mjs` merges these notes with the fields it reads from the
page and writes `loadflow-simulator/agent.txt`, the AI section in `index.html` and the lines in
`llms.txt`. Edit here, never the generated text, then run the generator. Text above the first
heading (this) is not published. The headings are the same as in `rentvsownhouse/agent-notes.md`.

Two things are specific to this tool. The network is not a form: a Quick Start loads one and a
link changes its parts by name (`el.<name>.<param>`, a family of keys the adapter reads in
`script.js`) or replaces it whole (`json`). The names and units in both are the saved ones
(`lf-core.js`: `LF.DEFAULTS`, `LF.SPEC`), the same as the tool's scenario files.

## Decides

How a power network behaves at one operating point: the voltage at every bus, the active and reactive power on every line, transformer and link, the losses, and which buses or branches fall outside their limits. It solves an AC (Newton-Raphson) or DC load flow on a single-line diagram.

## Most important

- lfMethod
- lfDistSlack
- lfVmin
- lfVmax
- lfLoadMax

## Fields

- lfMethod: ac solves the full network, with losses, reactive power and voltage magnitudes. dc is the linear approximation: power only, no losses, every voltage 1 p.u. Use ac unless the user asks for a DC load flow.
- lfTol: How close to balanced every bus must be before the AC run stops. Leave it out.
- lfSeed: The AC run's starting guess. dc (the default) starts from the DC answer, which also suits phase-shifting transformers; flat starts from 1 p.u. at 0 degrees. Leave it out unless the user asks.
- lfDistSlack: Off (the default): the slack unit alone picks up whatever balances the network. On: every generator in an island shares it, in the proportion lfSlackW sets. Turn it on only when the user asks for a distributed slack.
- lfSlackW: Used only while lfDistSlack is on. p_set shares in proportion to each unit's dispatch (p_set), p_nom to its rating (p_nom).
- lfVmin: The lowest bus voltage before the diagram flags a bus, in p.u. It only reads the result and never changes it. 0.95 is the default; use the user's grid-code limit when they give one.
- lfVmax: The highest bus voltage before a bus is flagged, in p.u. 1.05 is the default; same note as lfVmin.
- lfLoadMax: The share of its rating a line, transformer or link may carry before it is flagged, in %. 100 is the default; use a lower figure when the user wants headroom.
- colourBy: Display only: what the diagram colours. Leave it out.

## Hide

- animP
- animQ
- lb_Bus_name
- lb_Bus_vpu
- lb_Bus_vkv
- lb_Bus_ang
- lb_Bus_p
- lb_Bus_q
- lb_Line_name
- lb_Line_p
- lb_Line_q
- lb_Line_s
- lb_Line_load
- lb_Line_loss
- lb_Line_i
- lb_Transformer_name
- lb_Transformer_p
- lb_Transformer_q
- lb_Transformer_s
- lb_Transformer_load
- lb_Transformer_loss
- lb_Transformer_i
- lb_Transformer_tap
- lb_Generator_name
- lb_Generator_p
- lb_Generator_q
- lb_Generator_pf
- lb_Load_name
- lb_Load_p
- lb_Load_q
- lb_Load_pf
- lb_ShuntImpedance_name
- lb_ShuntImpedance_p
- lb_ShuntImpedance_q
- lb_StorageUnit_name
- lb_StorageUnit_p
- lb_StorageUnit_q
- lb_Link_name
- lb_Link_p
- lb_Link_loss

## Quick Starts

There are four networks. wscc9 is the WSCC 9-bus transmission system (three generators, three loads, a 230 kV ring). 3bus is a small meshed 110 kV ring with a grid connection, a power station and a town. feeder is a 20/0.4 kV distribution feeder with three street pillars and rooftop solar. hvdc is two 220 kV areas joined by an HVDC link.

Start from the one closest to the user's network, then change its parts by name with the el.<name>.<param> keys. Their names, buses and ratings are under QUICK START FIGURES, so read the part the user means from there: in wscc9 the load at bus 5 is Load A, at bus 6 Load B and at bus 8 Load C. A Quick Start also puts the solver options and limits back on their defaults, so send those keys after it. Without qs the tool starts from wscc9. A network that differs structurally, with other buses or lines, goes in json.

## Example

Request: using tool.adjiebrotots.com/loadflow-simulator, on the WSCC 9-bus case, what happens to the voltages if the load at bus 5 rises to 150 MW?

Link:
- qs=wscc9
- el.LoadA.p_set=150
- why.el.LoadA.p_set=The load at bus 5 is Load A in the WSCC 9-bus case; the user's 150 MW replaces its active power
- note=WSCC 9-bus case, load at bus 5 raised to 150 MW

Assumptions:
1. Network: the WSCC 9-bus Quick Start (qs=wscc9), unchanged apart from the load below.
2. Load at bus 5: Load A, the load on bus 5 in that case. Its active power is set to 150 MW (el.LoadA.p_set) and its reactive power stays at the Quick Start's figure.
3. Solver and limits: the Quick Start's own: the {lfMethod} method (ac is the full AC load flow), voltage limits of {lfVmin} to {lfVmax} p.u. and a branch loading limit of {lfLoadMax}%.

## Compact lists

- `el.<name>.<param>=<value>`

Each key changes one parameter of one part of the network, found by the name the diagram shows for it (QUICK START FIGURES lists them). Names ignore case, spaces and underscores, so Load A, load a and LoadA are one name; write it without spaces, as el.LoadA.p_set, or with %20. Percent-encode any other awkward character in a name (# & + % /). The parameter is the text after the last dot. A name that no part has, or that two parts share, or a parameter the part does not take, is reported and skipped. A number outside the parameter's range is pulled into it and reported. p and q are accepted for p_set and q_set. Send one key per parameter, and a why.<key> beside each.

Parameters by kind of part, in the units the tool saves them in (the same as in json):

Bus parameters: v_nom (kV, 0.1 to 1500), v_mag_pu_set (p.u., 0.5 to 1.5: the voltage the generators on that bus hold).

Line parameters: length (km, 0 to 5000), num_parallel (identical circuits, a whole number 1 to 20), r (ohm, 0 to 100000), x (ohm, -100000 to 100000), b (siemens, -1 to 1), g (siemens, 0 to 1), s_nom (MVA, 0 to 100000, the rating loading is measured against). A line with a standard type takes its impedance and rating from the type, so for it change length and num_parallel; the others apply to a line with no type.

Transformer parameters: tap_position (whole number -50 to 50, steps from the neutral tap) and num_parallel (1 to 20) apply to a transformer with a standard type. The others apply to one with no type: s_nom (MVA, 0 to 100000), x (per unit on s_nom, -10 to 10), r (per unit on s_nom, 0 to 10), g and b (per unit, -1 to 1), tap_ratio (0.5 to 1.5; 1.05 lifts the tap side by 5%), tap_side (0 the from bus, 1 the to bus), phase_shift (degrees, -360 to 360). model (t or pi) applies to both.

Generator parameters: control (Slack, PV or PQ), p_set (MW, active power; a Slack unit's counts only while lfDistSlack is on), q_set (MVAr, used by a PQ unit), p_nom (MW, rating). A Slack or PV unit holds the voltage set on its bus, so change that with the bus's v_mag_pu_set.

Load parameters: p_set (MW drawn, -100000 to 100000; a negative figure feeds power in), q_set (MVAr drawn, positive for an inductive load).

Shunt parameters (a part named like Shunt 5, class ShuntImpedance): g and b (siemens, -10 to 10; positive b is a capacitor, giving b times the bus voltage in kV squared, in MVAr).

Storage parameters: p_set (MW, positive when discharging into the bus), q_set (MVAr), p_nom (MW, kept for reference).

Link parameters: p_set (MW sent from the first end; negative sends it the other way), efficiency (a fraction, 0.01 to 1, so 0.97 is 97%), p_nom (MW, the rating loading is measured against).

A standard line or transformer type, a part's symbol, adding or removing parts and rewiring are not patches: send the network in json.

## Json

`json=<network>` replaces the network with one of the user's own: the form the tool saves, which is how every Quick Start is written. Use it only for a network that differs structurally from the four Quick Starts (other buses, lines or devices); to change a value on one of them, patch it. A qs before it is replaced. Write it compactly (no spaces or line breaks) and leave out every parameter that is at its default.

{"v":1,"name":"<title>","el":[<part>,<part>,...]}

Each part is {"c":<class>,"id":<whole number>, ...}. The class is Bus, Line, Transformer, Generator, Load, ShuntImpedance, StorageUnit or Link. Every id is a different whole number, across all parts together. A name is only needed to override the automatic one (Bus 3, Load 7, Line 4); the names el.<name>.<param> and the diagram use are these.
- A device (Generator, Load, ShuntImpedance, StorageUnit) names its bus with "bus":<bus id>.
- A branch (Line, Transformer, Link) names both ends with "bus0":<bus id> and "bus1":<bus id>. One with a missing end is left out and reported.
- The other keys are the parameters listed under COMPACT LISTS, in the same units. A Bus needs "v_nom" in kV (its default is 1). A Generator's default control is PQ, so give Slack or PV where it should be one. Give each connected area one Slack generator. Line r, x and s_nom are 0 by default and a line needs a non-zero r or x. A Line or Transformer may name a standard type in "type" only when it is one the tool knows, for example the types used by the Quick Starts; otherwise give the impedance.
- Leave out "at" and the tool lays the buses out in rows from the first bus, with devices and branches placed automatically.
- Generator "grid":1 draws the unit as an external grid; it does not change the result.
At least one bus is needed; the tool solves up to 1000 buses. An unknown class, a missing bus or a number out of range is reported or pulled into range, never a failure. A network that cannot be read at all leaves the tool on its Quick Start.
A radial 33 kV line from a slack to a 30 MW load:
{"v":1,"name":"Radial 33 kV","el":[{"c":"Bus","id":1,"v_nom":33},{"c":"Bus","id":2,"v_nom":33},{"c":"Line","id":3,"bus0":1,"bus1":2,"r":4,"x":8,"s_nom":50},{"c":"Generator","id":4,"bus":1,"control":"Slack"},{"c":"Load","id":5,"bus":2,"p_set":30,"q_set":10}]}
