# Salary Map — audit harness

Serves the repo over localhost and drives the real map page headless, with
service workers blocked and every outside request refused unless a test
mocks it.

`run.mjs` replays every city from the raw JSON files, without the page's
code, and holds the page to the replay to a relative 1e-9: each city's living
cost (your budget scaled by its index at the rate the index was priced at),
the market rate, the required salary (the comparator's formulas: living cost
over one minus your savings ratio, or living cost plus your savings at
today's rate), Global salary mode's savings and ratio, and the living cost
against yours that the colours are drawn on. It runs seven plans across
Simple (housing in and out) and Detailed lifestyles, both targets and Global
salary mode, one of them spending more than it earns, and adds a gas row so
that 33 cities without a gas price have to say "no estimate" rather than
guess.

It then opens the comparator itself and drives it through its own controls.
Its five Quick Start budgets have their twins on the map, and every required
salary and savings ratio the comparator's table shows has to read the same
on the map; four Simple-mode pairs (both targets, housing in and out, same
and different currencies) have to agree on living cost and required salary.

The colours: cheaper is blue, dearer amber, and red only in Global salary
mode and only where savings go below zero; your city is the neutral middle;
the cheapest and the dearest city wear the deepest shade of their arm; and
changing the view never repaints a city, because every view's figure is
ordered by the one number the colours use, which is also checked.

It also checks that the card and the map label lead with your currency and
put the city's own in brackets (none for a city in your currency), that no
label overlaps another or leaves the map, the modes and views (Global salary
has no salary view and opens on Nominal savings, each mode keeps the view it
was left on), that each Quick Start opens the same over a messy page as on a
fresh one, a mocked live rate (money crossing a border moves, local prices
hold still), the gestures (a drag pans, Ctrl and the wheel zooms, a plain
wheel scrolls the page, a click pins a card), a reload, and that a 390px
phone gets no sideways scroll.

The ⤢ button is held to the full-screen view it promises, on a desktop and a
390px phone: the map card fills the window edge to edge, the map takes most
of it and the canvas is refitted to it, the legend ("Living cost against …,
for the same lifestyle") and the View selector stay on screen above the map
and still switch the view, a plain wheel zooms there (there is no page to
scroll), Esc closes a pinned card first and then puts the map back at the
height it had in the page.

Every city's location (`../city_coords.json`, built by
`../_build/build-coords.mjs` from GeoNames) has to land inside its own
country on the World Clock's map, or within 10 km of its coast. Northern
Vietnam and Kosovo are filed under a neighbour's time zone polygon there, so
cities in them are held to their own country's bounding box instead.

The borders come from time zones, which are not countries, so they are held
to the zone file too. Asia/Urumqi is laid over Asia/Shanghai and Asia/Hebron
over Asia/Jerusalem, and tzdb files northern Vietnam under Asia/Bangkok: no
line may cut Xinjiang off from China, ring settlement areas inside the West
Bank, or run across Vietnam. Where two countries' zones overlap the border is
disputed (Abyei and Kafia Kingi, Kalapani), and both claim lines must stay.

Run: `node run.mjs`
