# Capacity Expansion Planner: notes for the AI section

Hand-written. `node _ref/agent-doc.mjs` merges these notes with the fields it reads from the
page and writes `capacity-expansion-planner/agent.txt`, the AI section in `index.html` and the lines in
`llms.txt`. Edit here, never the generated text, then run the generator. Text above the first
heading (this) is not published. The headings are the same as in `rentvsownhouse/agent-notes.md`.

Two things are specific to this tool. The plan is not a form: a Quick Start loads one and a link
changes a technology by its visible name (`tech.<name>.<param>`, a family of keys the adapter reads
in `script.js`), changes the demand shape (`loadShape`) or replaces the plan whole (`json`). The
names and units in all three are the saved ones (`cx-core.js`: `CX.DEFAULTS`, `CX.SPEC`), the same
as the tool's scenario files. The demand, years, carbon price and the rest are ordinary fields.
The solve is heavy and the reader should ask for the answer, so every link carries `run=0`: it
opens the plan without solving it, and Run plan stays lit until the reader presses it. A link
without `run` solves, as the tool does.

## Decides

Which plants and batteries to build, how big and in which year, so that a growing demand is met hour by hour at the least cost over the whole plan. It plans from a first year to a last year in decision years, with a few typical days a season, and reports what to build, the energy by source, the cost by year and the emissions.

## Most important

- cxPeak
- cxGrowth
- cxCarbon
- cxStart
- cxEnd
- cxClimate
- cxNetZero
- cxNzYear

## Fields

- cxCur: The currency symbol shown beside every cost. It only relabels the figures and never converts them, so give every cost in one currency and set its symbol here (Rp, the euro sign and so on). Every Quick Start puts it back on $, and its technology costs are in US dollars.
- cxPeak: The highest hour of demand in the first year, in MW. Typical 100 to 50,000.
- cxGrowth: How fast that peak grows each year, in % a year (negative if it shrinks).
- cxClimate: The seasons a year is sampled by, and which hemisphere's: sum and sum-n peak in summer, win and win-n in winter, trop and trop-n are tropical. Without -n the seasons are the southern hemisphere's (summer is December to February), with -n the northern (summer is June to August). Choose by where the user is and when their demand peaks.
- cxStart: The first year of the plan, a whole year (2000 to 2100). Costs and the carbon price are those of this year.
- cxEnd: The last year of the plan (2000 to 2150), at least the first year. Decision years run from the first year in steps of cxStep, and each stands for the years up to the next. A longer plan with smaller steps takes longer to solve.
- cxStep: Years between investment decisions: 1, 2, 3, 5 or 10. The Quick Starts use 5.
- cxDetail: simple or detailed. Detailed shows more of each technology's card (fixed O&M, lifetime, cost change, earliest year, build limit, unit size, availability). Send detailed whenever a link changes one of those with tech.<name>.<param>, so the user can see it.
- cxShed: On (the default): demand the plants cannot serve is cut at the value of lost load instead of making the plan infeasible. Off: such a plan is reported as a problem and not solved.
- cxVoll: The value of lost load: what a MWh not served costs, per MWh in the currency of cxCur. It caps the price of power, since shedding is the last resort. Used only while cxShed is on. Typical 5,000 to 30,000 (the default is 20,000). Leave it out unless the user gives one.
- cxCarbon: The carbon price in the first year, per tonne of CO2 in the currency of cxCur. 0 means none. A plant pays it on every tonne it emits.
- cxCarbonGrow: How fast the carbon price rises each year, in % a year, compounded from the first year. 0 keeps it flat.
- cxNetZero: On: from the year in cxNzYear on, no plant that emits CO2 may run. Off (the default): no such rule. Turn it on only when the user states a net-zero or no-emissions year.
- cxNzYear: The decision year from which no plant may emit (2000 to 2150). Used only while cxNetZero is on.
- cxRateMode: How the discount rate is given. real: cxRate is used and cxInflation is not. nominal: cxNomRate is used. Leave it on real unless the user gives a nominal rate.
- cxRate: The real discount rate, in % a year (0 to 15). Used when cxRateMode is real. Costs from later years are discounted to the first year at it.
- cxNomRate: The nominal discount rate, in % a year (0 to 25). Used when cxRateMode is nominal, together with cxInflation.
- cxInflation: Inflation, in % a year (0 to 15). Used with a nominal rate.
- cxStress: On adds a still, overcast peak day to each period, so the plan also has to serve demand with almost no sun or wind. Leave it out unless the user asks for a dunkelflaute or a worst case.
- cxTime: The solver's time limit, in seconds (10, 30, 60 or 300). Leave it out.
- cxGap: How close to the best possible cost the solver must prove its answer when plants come in whole units. 0.0001 is 0.01%, 0.001 is 0.1%, 0.01 is 1%. Leave it out.

## Hide

## Quick Starts

There are four plans. grow is a summer-peaking grid of 1,000 MW growing 3% a year, its coal closing in 2036, with gas, solar, wind and batteries to build. nz is the same grid with a carbon price of 40 that rises 5% a year and no CO2 from 2041, with pumped hydro joining the options. coal is a winter-peaking grid of 4,000 MW closing two coal stations, in 2031 and 2041, with gas in 400 MW units. island is a tropical island of 120 MW on diesel, growing 6% a year, with solar, batteries and geothermal to build.

Start from the one closest to the user's grid, then change its technologies by name with the tech.<name>.<param> keys. Their names and figures are under QUICK START FIGURES, so read the technology the user means from there. A Quick Start also puts the options (the years, the demand, the climate, the carbon price, cxCur and the rest) back on its own values, so name each option the user wants different. Without qs the tool starts from grow. A grid that differs structurally, with its own list of technologies, goes in json.

## Example

Request: using tool.adjiebrotots.com/capacity-expansion-planner, with a $50/t carbon price and solar capex at $900/kW, what should the grid build to 2040?

Link:
- qs=grow
- run=0
- cxCarbon=50
- why.cxCarbon=The user's carbon price, in $ per tonne of CO2, from the first year
- tech.solar.capex=900
- why.tech.solar.capex=The user's solar capital cost, in $ per kW
- cxEnd=2040
- why.cxEnd=The user wants the plan to run to 2040
- note=Growing grid, $50/t carbon price, solar at $900/kW, planned to 2040

Assumptions:
1. Grid: the Growing grid Quick Start (qs=grow), with its coal, gas, solar, wind and battery options as it has them.
2. Carbon price: $50 per tonne in {cxStart}, flat (the Quick Start's growth of {cxCarbonGrow}% a year is kept).
3. Solar: the Solar PV technology's capital cost is set to $900 per kW (tech.solar.capex); its other figures stay as in the Quick Start.
4. Horizon: the first year is {cxStart}, the last 2040, with a decision every {cxStep} years.

## Compact lists

- `tech.<name>.<param>=<value>`
- `loadShape=<shape>`

`tech.<name>.<param>` changes one value of one technology, found by the name the tool shows for it (QUICK START FIGURES lists them). Names ignore case, spaces and punctuation, so Solar PV, solar pv and SolarPV are one name; write the space as %20 or leave it out. The parameter is the text after the last dot. The ten technologies the + Add menu offers also answer to their short id: solar, wind, ccgt, ocgt, coal, nuclear, geo, diesel, battery and phes, for the technology that carries the menu's name (Solar PV, Wind, Gas (CCGT), Gas (OCGT), Coal, Nuclear, Geothermal, Diesel engines, Battery, Pumped hydro). When the plan has no technology of that name, the id adds it from the menu with its typical costs, then applies the value; use that to offer a technology the Quick Start lacks, for example tech.nuclear.build=1 or tech.nuclear.capex=6000. A name that no technology has and that is not one of the ten ids, or that two technologies share, or a parameter the technology does not take is reported and skipped. A number outside the parameter's range is pulled into it and reported. Send one key per parameter, and a why.<key> beside each.

Parameters, in the units the tool saves them in (the same as in json). A cost is in the currency of cxCur.

For every technology: exist (MW in service before the first year, 0 to 1,000,000), retire (the year that existing capacity is gone by, 1900 to 2200; 0 means it stays to the end), build (1 or 0: whether more can be built), capex (cost per kW of new capacity, in the first year, 0 to 100,000), fom (fixed O&M per kW a year, existing and new, 0 to 10,000), vom (running cost per MWh, fuel and variable O&M, 0 to 100,000), life (years a new plant runs, 1 to 100), learn (change in capex each year as a fraction, -0.2 to 0.2, so -0.02 is 2% cheaper every year), from (the earliest year it can be built, 1900 to 2200; 0 means the first year), max (most MW in service at once, existing included, 0 to 1,000,000; 0 means no limit) and unit (MW per unit, so it is built in whole units, 0 to 100,000; 0 means any size).

Solar and wind also take cf (capacity factor, the year's output over rating times 8,760 hours, as a fraction 0.01 to 0.95, so 0.22 is 22%). Firm plants (gas, coal, nuclear, geothermal, diesel) also take avail (the share of the rating they can give in any hour, 0.01 to 1) and co2 (tonnes of CO2 per MWh, 0 to 3). Storage (battery, pumped hydro) also takes hours (hours at full power, 0.25 to 1000) and rte (round-trip efficiency as a fraction, 0.1 to 1, so 0.87 is 87%). A technology's kind, name and its solar or wind profile are not patches: send the plan in json.

`loadShape=<shape>` sets the demand through the day: sys (system day), res (residential), com (commercial), ind (industrial), respv (residential with rooftop solar), resev (residential with electric cars) or flat. It replaces whatever shape and edits the plan had. Leave it out to keep the Quick Start's own.

`run=0` opens the plan without solving it. Always add it to a link for this tool, so the reader presses Run plan to see the result and the answer comes from the tool when they ask for it, never straight from the link. Without it the plan is solved as soon as the link opens.

## Json

`json=<plan>` replaces the technologies and the demand shape with ones of the user's own: the form the tool saves, which is how every Quick Start is written. Use it only for a grid whose technologies differ structurally from the four Quick Starts; to change a value on one of them, patch it. A qs before it is replaced, but still sets the demand, years, climate and carbon price, so pick the nearest one or send those fields yourself. Write it compactly (no spaces or line breaks) and leave out every value that is at its default.

{"v":2,"tech":[<technology>,<technology>,...],"load":{"base":"<shape>"}}

Each technology is {"name":"<name>","kind":"<kind>", ...}. The kind is pv (solar), wind, firm (anything dispatchable that burns or flows: gas, coal, nuclear, geothermal, diesel) or storage written as store. A name is only needed to tell technologies apart; the names tech.<name>.<param> and the tool use are these. An id is optional: a technology without a whole-number id, or with a repeated one, is given one.
- The other keys are the parameters listed under COMPACT LISTS, in the same units. A technology costs nothing by default and can be built (build 1), so give capex, fom and vom. Existing capacity is exist, with retire for the year it closes and build 0 if no more may be built. The defaults are: life 25, cf 0.25, avail 1, co2 0, hours 4, rte 0.85, kind firm.
- load is optional, with base one of sys, res, com, ind, respv, resev or flat (sys when left out).
- The plan keeps up to 24 technologies. A number out of range is pulled into range and reported, an unknown key is skipped, and a plan that cannot be read at all, or has no technology, leaves the tool on its Quick Start.
A small grid with an old gas plant, solar and a battery, over two decision years (send cxPeak, cxStart, cxEnd and cxStep with it):
{"v":2,"tech":[{"name":"Old gas","kind":"firm","exist":80,"build":0,"vom":70,"co2":0.5},{"name":"Solar","kind":"pv","capex":900,"fom":15,"life":30,"cf":0.22},{"name":"Battery","kind":"store","capex":1200,"fom":25,"life":15,"hours":4,"rte":0.87}]}
