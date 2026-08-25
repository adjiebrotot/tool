/* Guided-tour config for the Rent vs Own tool.
   The shared engine (../tour-shared.js) reads this object. */
window.__TOUR = {
  seenKey: 'rvo-tour-v1-seen',
  launchLabel: '🧭 Take a tour',
  steps: [
    {
      target: null,
      title: '👋 Welcome to Rent vs Own',
      body: 'This quick tour shows how to model the long-term outcome of ' +
            '<strong>renting versus buying a home</strong>, comparing cash, equity, and ' +
            'net wealth over time so you can see which leaves you better off. It takes ' +
            'about a minute.'
    },
    {
      target: '.quick-start-row',
      title: '① Start from a city preset',
      body: 'One click loads realistic prices, rents, and rates for a city such as ' +
            '<strong>Perth</strong>, <strong>Sydney</strong>, <strong>Singapore</strong>, ' +
            'or <strong>Jakarta</strong>. A quick starting point you can then adjust to ' +
            'your own numbers.'
    },
    {
      target: '.ctrl-tabs',
      title: '② Fill in your assumptions',
      body: 'The inputs are grouped into <strong>General</strong> (cash, risk-free rate, ' +
            'time horizon), <strong>Own</strong> (price, deposit, mortgage, costs), and ' +
            '<strong>Rent</strong> (rent, growth, ongoing costs). You can even model a ' +
            'rent-then-buy scenario.'
    },
    {
      target: '.metrics',
      title: '③ See the key numbers',
      body: 'Four KPI cards summarise the run: the <strong>initial cash</strong> you ' +
            'start with, your <strong>yearly housing budget</strong>, the ' +
            '<strong>breakeven year</strong> when owning net equity overtakes renting, ' +
            'and the <strong>equity difference</strong> between buying and renting at ' +
            'the end of your horizon.'
    },
    {
      target: '.chart-card',
      title: '④ Compare over time',
      body: 'Switch the chart between <strong>Net Equity</strong>, ' +
            '<strong>Liquid Cash</strong>, and <strong>Accumulated Cost</strong> to see ' +
            'how each path plays out year by year. Export any view as SVG or PNG.'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: 'That is the workflow, and it runs privately in your browser, free. Want to ' +
            'compare many scenarios at once? Try the <strong>Sensitivity Analysis ' +
            'Tool</strong> linked near the top. Replay this tour any time via ' +
            '<strong>Take a tour</strong>.'
    }
  ]
};
