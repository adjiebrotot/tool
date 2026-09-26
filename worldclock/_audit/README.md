# World Clock — audit

`run.mjs` drives the real page in headless Chromium, as users in nine time zones
at a fixed "now", and checks every clock it shows against Python's `zoneinfo`.
`zoneinfo` reads the system's compiled tz database, not the copy inside
Chromium's ICU, so the replay does not share the page's code or its data.

- **W1** The header reads `DD MMMM YYYY HH:mm (GMT+X, Place)` and is the right time.
- **W2** Every clock on the map, for every one of the 407 zones: `HH:mm` matches
  `zoneinfo`, and a `DD MMM` line appears exactly when that place's date is not
  the user's.
- **W3** Time Travel: a wall time typed for a place lands on the instant
  `zoneinfo` gives (a repeated time is the first one, a skipped time lands just
  past the jump), and the whole map follows. Covers 3pm Perth to Melbourne,
  DST starts and ends in both hemispheres, Lord Howe's 30-minute shift and New
  Year at +14.
- **W4** Show seconds turns every clock to `HH:mm:ss`, and survives a reload.
- **W5** The place card's offset, daylight-saving state, and the day and size of
  the next clock change all match `zoneinfo`.
- **W6** Each user opens on their own region with neighbours in other offsets
  in view: Perth on Australia, Singapore on South-East Asia, London on Europe,
  and so on, on a desktop and on a phone. An old zone name (`Asia/Calcutta`)
  still finds its region.
- **W7** Time zones is a world view: choosing it zooms out, and zooming back in
  returns to Jurisdictions.
- **W8** The map data: every label point sits inside its own shape, Chromium
  knows every zone, and no border edge spans the map (the date-line slicing
  that a sphere-cut land layer causes).

- **W9** Microstates and atolls fold into a bigger neighbour on the same
  clock: one label for Italy, none for the Vatican, San Marino, Monaco or
  Malta; atolls get no clock on the world view while Hawaii and New Zealand
  keep theirs. A border is drawn as a time border exactly when `zoneinfo`
  puts different clocks on its two sides, checked in late September and again
  in November, when NSW and South Australia have started daylight saving and
  Queensland and the Northern Territory have not.

- **W10** The night shade follows the sun: the page's subsolar point agrees
  with NOAA's solar calculator, and over a 4° grid of the world view every
  place where NOAA puts the sun up is unshaded, every place with the sun more
  than 12° below the horizon is fully shaded, and twilight sits in between.
  Checked now and at the June solstice (midnight sun north of the Arctic
  Circle, night at 58°S).

Run: `node run.mjs`. The first run caches d3 in `_ref/.libcache/`; later runs
are offline. Exits non-zero if any check fails.

If `zoneinfo` and Chromium carry different tz database releases, a W2 or W3
failure names the zones that differ. That is a version gap between the two
databases, not a page bug, and the fix is to re-run on matching releases.
