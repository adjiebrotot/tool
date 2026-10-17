# Capacity Expansion Planner: explainer video

`capacity-expansion-planner-explainer.mp4` is an 82-second explainer of the tool (1920x1080,
30 fps, no sound). Its charts and figures are the tool's own answer to the **Growing grid**
Quick Start, captured from the page, so the video says what the tool says.

```sh
node capacity-expansion-planner/_video/capture.mjs      # solve the plan, write data.js, boxes.js, shots/
node capacity-expansion-planner/_video/render.mjs "$PWD/capacity-expansion-planner/_video/capacity-expansion-planner-explainer.mp4"
node capacity-expansion-planner/_video/render.mjs preview 9 35 56   # stills, in prev/
```

Run `capture.mjs` again after a change to the tool, so the video shows the tool as it is.

| Seconds | Chapter | What it shows |
| --- | --- | --- |
| 0 to 5 | Title | What to build, and when |
| 5 to 16 | The question | Peak demand growing 3% a year, the coal plant retiring in 2036, the gap it leaves |
| 16 to 28 | The inputs | The Demand, Supply, Policy and Assumptions tabs, from the page |
| 28 to 41 | Hour by hour | 2046's summer day built up source by source, then the four seasons and the still, overcast day with their weights |
| 41 to 52 | The optimiser | Every technology in every decision year, sized at once for the least present cost |
| 52 to 63 | The answer | Capacity by decision year and the four results |
| 63 to 75 | In the tool | Quick Start, Run plan, the answer, the charts, the typical days, costs and tables |
| 75 to 82 | Outro | Runs in the browser, the examples, the address |

`story.html` holds every scene; the colours, fonts and hatched, dotted fills follow the tool's
charts. Like `_audit`, this folder starts with an underscore, so GitHub Pages leaves it off
the site.
