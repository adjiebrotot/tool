# Sample assets

Graph images embedded in `../index.html`.

- `sample-03-rotor-angle-stable.png` — G2 rotor angle (`c:firel`) vs time at a
  0.1 s fault-clearing time: a damped swing that settles (Stable).
- `sample-03-rotor-angle-unstable.png` — G2 rotor angle vs time at a 1.0 s
  fault-clearing time: the angle runs away and saturates at ±180° (Not Stable).

Both are the `G2_rotor_angle_max` plots the Sample 3 script writes to
`{output_dir}/graph/`.

- `sample-05-optim-scatter.png`: the 60 Bayesian evaluations for Sample 5, plotted
  over filter tuning order (`nres`) and rated power (`qtotn`), coloured by busbar
  THD. Shows the parallel-resonance ridge and the optimum in the low-THD corner.
- `sample-06-inrush-low.png`: phase A HV current (`TRF1_I_HV_A`) vs time at a
  0.012 s closing time (small inrush, closes near the voltage peak).
- `sample-06-inrush-high.png`: phase A HV current vs time at a 0.016 s closing time
  (large inrush, closes near a voltage zero).
- `sample-06-inrush-3phase.png`: all three HV phase currents at a 0.016 s closing
  time, showing the offset, slowly decaying transformer inrush.
