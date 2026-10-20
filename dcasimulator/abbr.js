/* ── ABBREVIATIONS: this tool's terms (SharedAbbr in ../shared.js) ──
   Loaded right after shared.js on every page of this tool, so no other tool
   downloads them and the same letters can mean something else elsewhere.
   The scope key works as in shared.js: the folder covers its sub-pages, a
   'folder/sub-page' key covers one page. Site-wide terms ('*') stay in
   shared.js. */

/* ── DCA Scenario Explorer, Portfolio mode and the ticker reference ── */
SharedAbbr.glossary('dcasimulator', {
  ADX:   ['Average Directional Index', 'how strong a trend is, whichever way it points'],
  DCA:   ['Dollar-Cost Averaging', 'investing a set amount on a set schedule instead of all at once'],
  EMA:   ['Exponential Moving Average', 'a moving average that weights recent prices most, so it turns faster than a plain one'],
  ESG:   ['Environmental, Social and Governance', 'a screen some funds apply to what they are allowed to hold'],
  IRR:   ['Internal Rate of Return', 'the annual rate at which your deposits and the final value balance out'],
  MA:    ['Moving Average', 'the average price over a rolling window, which smooths the day-to-day noise out of a trend'],
  MACD:  ['Moving Average Convergence Divergence', 'the gap between two moving averages, read as a trend signal'],
  MWR:   ['Money-Weighted Return', 'the growth of your actual money, so the timing of every deposit counts'],
  OHLC:  ['Open, High, Low, Close', 'the four prices a candlestick shows for one period'],
  REIT:  ['Real Estate Investment Trust', 'a listed trust that owns income-producing property'],
  RSI:   ['Relative Strength Index', 'a 0 to 100 momentum gauge. Low readings read as oversold'],
  TWR:   ['Time-Weighted Return', 'the growth of the asset itself, ignoring when money went in'],
  UCITS: ['Undertakings for Collective Investment in Transferable Securities', 'the European fund standard, common on cross-border ETFs']
});
SharedAbbr.glossary('dcasimulator/ticker', {
  ASX:    ['Australian Securities Exchange'],
  BSE:    ['Bombay Stock Exchange'],
  HKEX:   ['Hong Kong Exchanges and Clearing'],
  IDX:    ['Indonesia Stock Exchange', 'Bursa Efek Indonesia'],
  CAC:    ['Cotation Assistée en Continu', 'the CAC 40 is the headline index of the Paris exchange'],
  KOSDAQ: ['Korea Securities Dealers Automated Quotations', 'the Korea Exchange board for smaller and growth companies'],
  KOSPI:  ['Korea Composite Stock Price Index', 'the main board of the Korea Exchange'],
  LSE:    ['London Stock Exchange'],
  NASDAQ: ['National Association of Securities Dealers Automated Quotations', 'the US exchange where most technology names list'],
  NSE:    ['National Stock Exchange of India'],
  NYSE:   ['New York Stock Exchange'],
  SGX:    ['Singapore Exchange'],
  SIX:    ['Swiss Infrastructure and Exchange', 'the Swiss stock exchange'],
  TSE:    ['Tokyo Stock Exchange'],
  XETRA:  ['Exchange Electronic Trading', 'the electronic market of the Frankfurt Stock Exchange']
});
