# Valuate Everything: notes for the AI section

Hand-written. `node _ref/agent-doc.mjs` merges these notes with the fields it reads from the
page and writes `valuateeverything/agent.txt`, the AI section in `index.html` and the line in
`llms.txt`. Edit here, never the generated text, then run the generator. Text above the first
heading (this) is not published. Same headings as `rentvsownhouse/agent-notes.md`.

The table (the listings, the columns they sit in, the items to buy) is not a form field: it is
the tool's state. A link writes it with the list keys under Compact lists, which this tool's
adapter reads (`agentPatch` in `valuateeverything/script.js`), or whole in `json`.

## Decides

What a secondhand item, a house or a hotel night should cost, fitted to the listings the user has seen (the price against features such as year, kilometres or size), and how far the asking price of each item the user is weighing up sits from that fair price.

## Most important

- itemWhat
- currency
- columns
- listings
- items
- model
- inflation

## Fields

- itemWhat: What the user is valuing, in a few words (Toyota Corolla, Sony A7 body). It names the table and the chart. Always send it: each Quick Start carries its own.
- currency: The currency symbol on every price. It only relabels the figures and never converts them, so give the listings and the asking prices in this one currency, the local one for the place. Send the symbol ($, £, €, Rp, RM, ¥, ₹ and so on from the list), not the name beside it. A code such as GBP is read as the symbol it stands for. One symbol can stand for several currencies: $ is the Australian, US and New Zealand dollar.
- inflation: How much a price seen in an earlier data year is lifted to today's money, % a year. It counts only when the table has a Data year column; without one every listing is taken as seen this year. Use the local inflation rate, 2 to 4 in most rich countries (the Quick Starts leave it at 3).
- model: How the price is fitted to the features. linear (the default): each feature adds a fixed amount. log: each feature changes the price by a fixed percentage, which suits things that lose a share of their value each year, such as cars and cameras. ridge: linear, steadier with few listings or with features that move together, such as age and kilometres; its strength is lambda. quadratic: lets the line bend and needs many more listings than features. Use linear unless the user asks for another.
- lambda: How hard ridge pulls every effect toward zero. Used only with model=ridge. Leave it out unless the user asks.
- viewDim: Display only: the chart in 2D or 3D. Leave it out unless the user asks for a 3D view.

## Hide

- entryMode
- curYear
- showData

## Quick Starts

Four worked tables built from real listings and sales gathered in October 2026: used Camry Hybrids in Australia, houses sold in Morley, Perth, Sony A7 bodies in the UK, and hotel nights in Perth. Each brings its listings, its columns and two example items to buy.

Start from the one closest to what the user is valuing. Its listings are the market the model is fitted to, so keep them only when the user's item is in that market, and say in the assumptions that the Quick Start's listings are being used. For anything else, start from the nearest one and send columns, listings and items, which replace its table whole. Never invent listings: use only the ones the user gave. A Quick Start's two example items stay in the results unless the link sends items, so always send items for the thing the user asks about.

## Example

Request: is a 2019 Toyota Corolla with 60,000 km at $24,500 fairly priced? here are 6 listings I found: 2019, 58,000 km, $24,990; 2019, 72,500 km, $22,990; 2018, 81,000 km, $21,500; 2020, 45,000 km, $27,490; 2020, 63,000 km, $25,500; 2018, 95,000 km, $19,990

Link:
- qs=camry
- itemWhat=Toyota Corolla
- columns=Year:year,Odometer:number:km
- listings=24990:2019:58000;22990:2019:72500;21500:2018:81000;27490:2020:45000;25500:2020:63000;19990:2018:95000
- why.listings=The six listings the user gave, in dollars, with the price first, then the year and the odometer
- items=2019 Corolla:24500:2019:60000
- why.items=The car the user is weighing up, at the asking price they gave
- note=Toyota Corolla, October 2026

Assumptions:
1. Market data: only the six listings the user gave, each taken as seen this month, so the table has no Data year column and inflation does not apply. The Camry Quick Start's own listings and cars are replaced, not mixed in.
2. Columns: Year (turned into an age) and Odometer in km, the two features the user gave for every listing.
3. Item: the 2019 Corolla with 60,000 km, at the asking price of $24,500.
4. Currency {currency}, and the {model} model the Quick Start uses, since the user did not ask for another.

## Compact lists

- `columns=<name>:<type>[:<unit>],<name>:<type>[:<unit>],...`
- `listings=<price>:<field>:<field>:...;<price>:<field>:...`
- `items=<name>:<asking>:<value>:<value>:...;<name>:<asking>:...`

The table is Price, then the columns you name, then Data year if you name one. columns names the columns after Price; listings and items follow them. Each of the three replaces what the Quick Start brought, whole: the model is fitted to the market in the link, never to a mix of it and the Quick Start's. Send all three together for a new market. Numbers are plain (24500, 60000, 3.5), with no units, no currency symbol and no thousands separators.

columns: the columns after Price, in table order, separated by `,`, the name and the type and the unit by `:`. type is number, year, bool or datayear (ignore keeps a column in the table but out of the model; do not use it). A number may carry a unit (km, m²). A year column becomes an age at the time the listing was seen; bool is Yes or No, counted as 1 or 0. Add one datayear column, last, only when the listings were seen in different years: each listing then carries the year it was seen, and the tool lifts older prices to today's money with inflation. Leave it out when every listing is current, and the table has no Data year column. At most 14 columns besides Price and Data year. A name may not contain `:`, `,`, `;` or `=`. If columns names the columns the table already has, the table is kept as it is. If it names others, the Quick Start's listings and items are cleared, since they refer to the old columns.
`columns=Year:year,Odometer:number:km,Automatic:bool`
`columns=Bedrooms:number,Land:number:m²,Data year:datayear`

listings: the market data, one listing per `;`, its fields separated by `:` in the table's order: the price first, then one value for every column you named, then the year it was seen if the table has a Data year column (that last field may be left out, or left empty, to mean this year). A price is above 0. A year column takes a whole year from 1900 to 2100. A bool column takes Yes or No (or true, false, 1, 0); empty means No. Every other field is a number. At most 300 listings, and about 16,000 characters in all. A listing that cannot be read is skipped and reported, so send the others as they are.
`listings=24990:2019:58000:Yes;22990:2019:72500:No`
`listings=950000:4:450:2025;880000:3:380:2024`

items: the things the user is weighing up, one per `;`, with the fields separated by `:`: a name, the asking price (empty if the user has none), then one value for every year, number and bool column, in the table's order (not Price, Data year or ignore). Every value is needed. An item is valued at the current year, so a year column takes the item's own year. At most 12 items. A name may not contain `:` or `;`.
`items=2019 Corolla:24500:2019:60000:Yes`
`items=12 Smith St:950000:4:450;Villa B:880000:3:380`

Sending listings with no columns uses the columns the table has now (the Quick Start's, or the default Camry table), so check their order in the Quick Starts section. Sending an empty listings or items clears it. When the same link sends json as well, json sets the table first and these keys then replace parts of it.

## Json

json={"columns":[...],"rows":[...],"items":[...],"chart":{...}} is the whole table in the shape the tool saves it. Prefer columns, listings and items; use json only for a table they cannot write. Write it compactly: no spaces or line breaks.

columns: a list of {"id","name","type","unit"}, where type is price, number, year, bool, ignore or datayear. Price is first and exactly one; Data year, if present, is last and exactly one. Ids are any short unique text (c1, c2, ...). A unit is a currency code such as AUD on the Price column and free text such as km on a number column.
rows: one list of strings per listing, one string per column in the columns' order. A bool is "Yes" or "No"; an empty string is a blank cell. A row with a cell that cannot be read is skipped and reported.
items: a list of {"name","asking","vals"}, where vals maps a column id to its value: a string for a number or year column, true or false for a bool column.
chart: {"x","y","hold"} column ids for the chart's axes and "mean" for hold. Leave it out.
