/* Guided-tour config for the Financial Freedom Calculator.
   The shared engine (../tour-shared.js) reads this object. Every step has to
   describe what is actually on screen, so the steps that talk about a panel
   open that panel first. v4 follows the redesign: Settings became
   Assumptions (inflation and the simulation), the money switch moved beside
   the results, and the table opens behind Show table, so readers who took v3
   are offered it again. */
window.__TOUR = {
  seenKey: 'ff-tour-v4-seen',
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
            'third of their pay, earning and spending in stages through a hustle age and a relax age, a ' +
            '<strong>geoarbitrageur</strong> retiring to Bali on 40% of what home costs, a high ' +
            'earner who never spends capital, a <strong>young family</strong> with two kids ' +
            'ahead and a legacy to hand on, and a <strong>late starter</strong> leaning on the ' +
            'age pension. Then change any figure over the top of it.'
    },
    {
      target: '#tab-you',
      onEnter: function () {
        var tab = document.querySelector('.ctrl-tab[data-tab="you"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '② Your money in and out',
      body: 'Your ages, then <strong>Money in</strong>: savings entered directly, or your net ' +
            'income with the gap worked out for you, and a government pension if you will get ' +
            'one. Set its <strong>Detail</strong> to <strong>Detailed</strong> for income ' +
            'stages, such as study, a hustle or part-time work, each growing from its own ' +
            'start; a pension is just a stage still paid after you stop work. ' +
            'Then <strong>Money out</strong>: living ' +
            'expenses now and retirement expenses once you stop. Set its ' +
            '<strong>Detail</strong> to <strong>Detailed</strong> and those two become the first ' +
            'and last of a list of life stages, with yours between them in age order: kids, a ' +
            'hustle, slower later years. Every field shows its unit, and a figure past its ' +
            'limits is pulled back when you leave it.'
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
            'amounts.'
    },
    {
      target: '#tab-settings',
      onEnter: function () {
        var tab = document.querySelector('.ctrl-tab[data-tab="settings"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '⑤ The guesses about the future',
      body: '<strong>Assumptions</strong> comes last because nobody knows these for sure: ' +
            '<strong>inflation</strong>, which lifts your spending and the pot you need with ' +
            'it, and how the <strong>simulated futures</strong> are drawn. The note under ' +
            'inflation shows what it does to your own spending by the time you stop.'
    },
    {
      target: '#simBtn',
      title: '⑥ Then press Simulate',
      body: 'A thousand simulated futures is real work, so the page does not redo it on ' +
            'every keystroke. Set the whole plan first (the form keeps up as you type), ' +
            'then press <strong>Simulate</strong> to run it. While anything is unanswered ' +
            'the results below step back and this button lights up, so you never read a ' +
            'verdict that belongs to numbers you have already changed. ' +
            'A <strong>Quick Start</strong> runs itself, and so does the retirement ' +
            'slider in step ⑧: sweeping that one is the question, not an assumption.'
    },
    {
      target: '#boardPath',
      onEnter: function () {
        var tab = document.querySelector('.ctrl-tab[data-tab="you"]');
        if (tab && !tab.classList.contains('active')) tab.click();
      },
      title: '⑦ Path to freedom: how early could you stop?',
      body: 'The red line is the pot you would need if you stopped at that age, which falls ' +
            'as you get older because there are fewer years left to fund. The blue line is ' +
            'what your investment grows to, and <strong>nothing is ever withdrawn from it ' +
            'here</strong>. <strong>Where they cross is your answer.</strong> The band is the ' +
            'range of simulated futures and the dotted line is what you have put in, so the ' +
            'gap between them is the growth doing the work. <strong>Show in today\u2019s ' +
            'money</strong>, beside the heading, reads every figure on the page in today\u2019s ' +
            'money or in the money of each year.'
    },
    {
      target: '#retireSlider',
      title: '⑧ Cashflows: drag the retirement age',
      body: 'This slider is the whole of Cashflows. It runs from <strong>stop today</strong> ' +
            'to <strong>never stop</strong>, and everything below it (the verdict directly ' +
            'under the handle, the four cards, the chart and the table) is measured at ' +
            'whatever age you leave it on, as you drag it. Click the age to type one. ' +
            'It <strong>starts on the crossing above</strong>: the earliest age this plan ' +
            'works. That is solved on the average return, so it opens near a coin flip: ' +
            '<strong>drag right and watch the chance climb</strong>, because the years of ' +
            'margin are what you are really buying. ' +
            '<strong>Path to freedom</strong> does not move, because how early you ' +
            '<em>could</em> stop does not depend on when you <em>choose</em> to.'
    },
    {
      target: '#boardCash .chart-card',
      title: '⑨ Where the money comes from, and goes',
      body: 'Income against spending, with the gap filled: green while you save it, red once ' +
            'the pot has to cover it. The balance it leaves behind runs in the panel ' +
            'underneath, on the same years, so you can read straight down from a flow to ' +
            'what it did to the pot, below zero included if the money runs out. ' +
            '<strong>Retire earlier and the slide starts sooner.</strong>'
    },
    {
      target: '#boardCash .detail-section',
      title: '⑩ The table adds up',
      body: 'Year by year opens from <strong>Show table</strong>, and the CSV button exports ' +
            'it either way. Every row is a cash flow statement: the balance at that age, then ' +
            'the income, the spending, what was saved or drawn, and the investment return that ' +
            'closes the year. <strong>Balance plus Saved plus Growth is the next row\u2019s ' +
            'Balance</strong>, to the cent, in whichever money you are reading.'
    },
    {
      target: null,
      title: '✅ That is the whole thing',
      body: 'Nothing leaves your browser, and your inputs are remembered for next time. ' +
            'Replay this tour any time via the <strong>🧭</strong> button in the header.'
    }
  ]
};
