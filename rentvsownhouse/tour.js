/* Guided-tour config for the Rent vs Own tool.
   The shared engine (../tour-shared.js) reads this object. Every step has to
   describe what is actually on screen, so a step about a tab opens it first. */
window.__TOUR = {
  seenKey: 'rvo-tour-v2-seen',
  launchLabel: '🧭 Take a tour',
  steps: [
    {
      target: null,
      title: '👋 Welcome to Rent vs Own',
      body: 'This quick tour shows how to model the long-term outcome of ' +
            '<strong>renting versus buying a home</strong>, comparing cash, equity and ' +
            'net wealth over time so you can see which leaves you better off. It takes ' +
            'about a minute.'
    },
    {
      target: '.quick-start-row',
      title: '① Start from a city preset',
      body: 'One click loads realistic prices, rents and rates for a city such as ' +
            '<strong>Perth</strong>, <strong>Sydney</strong>, <strong>Singapore</strong> ' +
            'or <strong>Jakarta</strong>. A quick starting point you can then change to ' +
            'your own numbers.'
    },
    {
      target: '.ctrl-tabs',
      onEnter: function () {
        var tab = document.querySelector('.ctrl-tab[data-tab="own"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '② The figures you know first',
      body: '<strong>Home</strong> holds the price, the down payment, the mortgage and ' +
            'the costs of owning. <strong>Rent</strong> holds the rent, its costs, and an ' +
            'optional <strong>Rent-Then-Buy</strong> scenario. <strong>Assumptions</strong> holds ' +
            'the guesses about the future: the risk-free rate your savings earn, house price ' +
            'growth, and the time horizon. Every field shows its unit, and a ' +
            'slider\'s figure can be clicked and typed.'
    },
    {
      target: '#verdict',
      title: '③ The answer in one sentence',
      body: 'Which comes out ahead, by how much and after how long, and the breakeven year ' +
            'when owning pulls ahead for good. Blue is owning and gold is renting, here and on ' +
            'the chart.'
    },
    {
      target: '.metrics',
      title: '④ The key numbers',
      body: 'The <strong>equity difference</strong> between owning and renting at the end, ' +
            'the <strong>breakeven year</strong>, then the initial cash both start with and the ' +
            'monthly housing budget both share.'
    },
    {
      target: '.chart-card',
      title: '⑤ Compare over time',
      body: 'Switch the chart between <strong>Net equity</strong>, <strong>Liquid ' +
            'cash</strong> and <strong>Accumulated cost</strong> to see how each path ' +
            'plays out year by year. The ? beside them says what each one means. Export any ' +
            'view as SVG or PNG.'
    },
    {
      target: '#detailSection',
      title: '⑥ The details, when you want them',
      body: 'The year-by-year cashflow for owning, renting and renting first sits behind ' +
            '<strong>Show table</strong>, and the CSV button exports it either way. ' +
            '<strong>What this assumes</strong>, below it, lists what the model does and ' +
            'does not count.'
    },
    {
      target: null,
      title: '✅ You are all set',
      body: 'That is the workflow, and it runs privately in your browser, free. Want to ' +
            'compare many scenarios at once? Try the <strong>Sensitivity Analysis ' +
            'Tool</strong> linked near the top. Replay this tour any time via ' +
            'the <strong>🧭</strong> button.'
    }
  ]
};
