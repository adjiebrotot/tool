/* Guided-tour config for the Financial Freedom Calculator.
   The shared engine (../tour-shared.js) reads this object. Every step has to
   describe what is actually on screen, so the steps that talk about a panel
   open that panel first. */
window.__TOUR = {
  seenKey: 'ff-tour-v1-seen',
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
      target: '#tab-you',
      onEnter: function () {
        var tab = document.querySelector('.ctrl-tab[data-tab="you"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '① Your money in and out',
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
      title: '② What the money is invested in',
      body: 'Pick a preset to start from long-run historical figures, or type a ticker and ' +
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
      title: '③ What should the money do?',
      body: '<strong>Just Die</strong> runs the pot down to nothing at your life expectancy. ' +
            '<strong>Leave a Legacy</strong> keeps a set amount. <strong>Die Rich</strong> ' +
            'spends only the real growth, so it lasts forever. The three need very different ' +
            'amounts, and this is where a government pension goes too.'
    },
    {
      target: '.metrics',
      onEnter: function () {
        var tab = document.querySelector('.ctrl-tab[data-tab="you"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '④ Read the answer',
      body: '<strong>Amount needed</strong> is the pot at your target retirement age. ' +
            '<strong>Financially free at</strong> is the earliest you could stop. ' +
            '<strong>Chance it works</strong> is usually near a coin flip at the amount ' +
            'needed, because a single average return ignores the order the good and bad ' +
            'years arrive in. The <strong>confidence pot</strong> is the number to plan around.'
    },
    {
      target: '.chart-card',
      title: '⑤ Where the lines cross',
      body: 'The blue line is what you will have. The red line is the pot you would need if ' +
            'you stopped at that age, which falls as you get older because there are fewer ' +
            'years left to fund. <strong>Where they cross is your answer.</strong> The shaded ' +
            'band is the range of simulated futures, and the dotted line is what you have ' +
            'put in: it goes flat the month you retire, and turns down when the growth stops ' +
            'covering the draw.'
    },
    {
      target: '.chart-card + .chart-card',
      title: '⑥ Where the money comes from',
      body: 'Income against spending, over the same years. While you work the gap is what ' +
            'you save; once you stop, income falls to the pension or nothing and the same ' +
            'gap becomes what the pot has to cover every year. <strong>That second area is ' +
            'what the whole plan is for.</strong>'
    },
    {
      target: null,
      title: '✅ That is the whole thing',
      body: 'Nothing leaves your browser, and your inputs are remembered for next time. ' +
            'Replay this tour any time via <strong>Take a tour</strong> in the header.'
    }
  ]
};
