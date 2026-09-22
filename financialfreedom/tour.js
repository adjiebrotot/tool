/* Guided-tour config for the Financial Freedom Calculator.
   The shared engine (../tour-shared.js) reads this object. Every step has to
   describe what is actually on screen, so the steps that talk about a panel
   open that panel first. */
window.__TOUR = {
  seenKey: 'ff-tour-v3-seen',
  launchLabel: '🧭 Take a tour',
  steps: [
    {
      target: null,
      title: '👋 How much is enough?',
      body: 'This tour shows how to find <strong>the pot you need before you can stop ' +
            'working</strong>, and <strong>the age you actually reach it</strong>. ' +
            'It takes about a minute.'
    },
    {
      target: '.quick-start-row',
      title: '① Start from a worked plan',
      body: 'One click fills every tab with a saver who already exists: a ' +
            '<strong>moderate</strong> 40% saver, a <strong>frugal</strong> one living on a ' +
            'third of their pay, a <strong>geoarbitrageur</strong> retiring to Bali on 40% of ' +
            'what home costs, a high earner who never spends capital, a legacy to hand on, ' +
            'and a <strong>late starter</strong> leaning on the age pension. ' +
            'Then change any figure over the top of it.'
    },
    {
      target: '#tab-you',
      onEnter: function () {
        var tab = document.querySelector('.ctrl-tab[data-tab="you"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '② Your money in and out',
      body: 'Your ages, what you <strong>spend</strong>, and what you <strong>save</strong>. ' +
            'You can enter savings directly, or enter your net income and let the tool work ' +
            'out the gap. Those are two different models and the note under the field says ' +
            'which one is running.'
    },
    {
      target: '#tab-invest',
      onEnter: function () {
        var tab = document.querySelector('.ctrl-tab[data-tab="invest"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '③ What the money is invested in',
      body: 'What you already hold, and what it earns. Pick a preset to start from long-run ' +
            'historical figures, or type a ticker and ' +
            'press <strong>Fetch</strong> to measure them from real prices. ' +
            '<strong>Volatility</strong> decides how wide the range of outcomes is, ' +
            'and it is what puts a crash into some of the simulated futures.'
    },
    {
      target: '#tab-goal',
      onEnter: function () {
        var tab = document.querySelector('.ctrl-tab[data-tab="goal"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '④ What should the money do?',
      body: '<strong>Just Die</strong> runs the pot down to nothing at your life expectancy. ' +
            '<strong>Leave a Legacy</strong> keeps a set amount. <strong>Die Rich</strong> ' +
            'spends only the real growth, so it lasts forever. The three need very different ' +
            'amounts, and this is where a government pension goes too — per week, month or ' +
            'year, and with a switch for whether it rises with inflation, because plenty of ' +
            'countries pay a flat figure that never does.'
    },
    {
      target: '#boardPath',
      onEnter: function () {
        var tab = document.querySelector('.ctrl-tab[data-tab="you"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '⑤ Path to freedom — how early could you stop?',
      body: 'The red line is the pot you would need if you stopped at that age, which falls ' +
            'as you get older because there are fewer years left to fund. The blue line is ' +
            'what your investment grows to, and <strong>nothing is ever withdrawn from it ' +
            'here</strong>. <strong>Where they cross is your answer.</strong> The band is the ' +
            'range of simulated futures and the dotted line is what you have put in, so the ' +
            'gap between them is the growth doing the work.'
    },
    {
      target: '#retireSlider',
      title: '⑥ Cashflows — drag the retirement age',
      body: 'This slider is the whole of Cashflows. It runs from <strong>stop today</strong> ' +
            'to <strong>never stop</strong>, and everything below it — the verdict directly ' +
            'under the handle, the four cards, the chart and the table — is measured at ' +
            'whatever age you leave it on. ' +
            '<strong>Path to freedom</strong> does not move, because how early you ' +
            '<em>could</em> stop does not depend on when you <em>choose</em> to.'
    },
    {
      target: '#boardCash .chart-card',
      title: '⑦ Where the money comes from, and goes',
      body: 'Income against spending, with the gap filled: green while you save it, red once ' +
            'the pot has to cover it. The balance it leaves behind runs in the panel ' +
            'underneath, on the same years, so you can read straight down from a flow to ' +
            'what it did to the pot — below zero included, if the money runs out. ' +
            '<strong>Retire earlier and the slide starts sooner.</strong>'
    },
    {
      target: '#boardCash .detail-section',
      title: '⑧ The table adds up',
      body: 'Every row is a cash flow statement: the balance at that age, then the income, ' +
            'the spending, what was saved or drawn, and the investment return that closes ' +
            'the year. <strong>Balance plus Saved plus Growth is the next row\u2019s ' +
            'Balance</strong>, to the cent, in whichever money you are reading.'
    },
    {
      target: null,
      title: '✅ That is the whole thing',
      body: 'Nothing leaves your browser, and your inputs are remembered for next time. ' +
            'Replay this tour any time via <strong>Take a tour</strong> in the header.'
    }
  ]
};
