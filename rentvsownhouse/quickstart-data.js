/* ── QUICK START DATA ─────────────────────────────────────────────────────────
   Rent vs Own: every Quick Start scenario, and the one place its figures live.

   Read by three pages, so a figure changed here changes all of them at once:
     ./                          the calculator's Quick Start (city, then home)
     ./sensitivity/              the first column's Quick Start picker
     ./quickstart-assumptions/   the table of every figure below, with sources

   A scenario is a CITY and a HOME TYPE. Its form values are resolved in
   three layers, the most specific winning:
     defaults   below: what every scenario shares (frequencies, loan type…)
     city       the city's own loan, tax and market figures
     home       the figures for that home type in that city

   Shape of a city:
     key, city, country, countryId (Indonesian name), countryCode, region,
     aliases (extra words the search matches), currencySymbol (one of the
     SharedCurrency symbols in shared.js), currencyCode (for the record),
     asOf (month of the newest figure, YYYY-MM), buyer (who the figures are for)
     downPaymentPct, mortgageRate, mortgageTerm, riskFreeRate, horizon,
     sellingCostPct, rentFreq, rentInflation, ownOngoingInflation,
     rentOngoingInflation                               (city-wide form values)
     homes:        { <type key>: home }    the types that exist in this market
     unavailable:  { <type key>: reason }  the types that do not, and why
     notes:        { <field or topic>: one sentence on where it comes from }
     sources:      [ { name, url } ]
   Shape of a home:
     propertyPrice, rentAmount (per the city's rentFreq), houseGrowth (%/yr),
     setupCost (% of THIS price: progressive duty differs by price),
     ownOngoingCost, rentOngoingCost (per year), sqm (internal floor area),
     landSqm (houses), where, setupCalc and costCalc (the arithmetic), and
     optional sources. Any city-wide form value may be overridden on a home.

   Every type key appears once per city, in homes or in unavailable, so the
   assumptions page can say why a type is missing rather than leave a gap.
   rentvsownhouse/_audit/quickstart-data.mjs holds the data to these rules.
   ────────────────────────────────────────────────────────────────────────── */
window.RVO_QUICKSTART = {
  asOf: "2025-06",

  // Form values every scenario shares unless a city or home says otherwise.
  defaults: {
    downPaymentPct: 20, mortgageTerm: 30, horizon: 30,
    mortgageType: 'pi', costInterestOnly: true,
    setupCostType: 'pct',
    ownOngoingCostFreq: 'yearly', ownOngoingCostType: 'dollar',
    rentFreq: 'monthly',
    rentOngoingCostFreq: 'yearly', rentOngoingCostType: 'dollar',
    monthlyBudget: 0, monthlyBudgetIncrease: 0,
    rtbEnabled: false, rtbBuyYear: 5, initialCash: 0
  },

  forms: {
    apartment: { en: 'Apartment', id: 'Apartemen' },
    house:     { en: 'Landed house', id: 'Rumah tapak' }
  },

  // In the order the pickers list them. label: the option under its form;
  // name: the full name; short: the scenario name on the Sensitivity page.
  types: [
    { key: 'apt-studio',   form: 'apartment', beds: 0,
      label: { en: 'Studio', id: 'Studio' },
      name:  { en: 'Studio apartment', id: 'Apartemen studio' },
      short: { en: 'Studio apartment', id: 'Apartemen studio' } },
    { key: 'apt-1br',      form: 'apartment', beds: 1,
      label: { en: '1 bedroom', id: '1 kamar tidur' },
      name:  { en: '1-bedroom apartment', id: 'Apartemen 1 kamar tidur' },
      short: { en: '1BR apartment', id: 'Apartemen 1KT' } },
    { key: 'apt-2br',      form: 'apartment', beds: 2,
      label: { en: '2 bedrooms', id: '2 kamar tidur' },
      name:  { en: '2-bedroom apartment', id: 'Apartemen 2 kamar tidur' },
      short: { en: '2BR apartment', id: 'Apartemen 2KT' } },
    { key: 'apt-4br',      form: 'apartment', beds: 4,
      label: { en: '4 bedrooms', id: '4 kamar tidur' },
      name:  { en: '4-bedroom apartment', id: 'Apartemen 4 kamar tidur' },
      short: { en: '4BR apartment', id: 'Apartemen 4KT' } },
    { key: 'house-studio', form: 'house', beds: 0,
      label: { en: 'Studio', id: 'Studio' },
      name:  { en: 'Studio landed house', id: 'Rumah tapak studio' },
      short: { en: 'Studio house', id: 'Rumah studio' } },
    { key: 'house-1br',    form: 'house', beds: 1,
      label: { en: '1 bedroom', id: '1 kamar tidur' },
      name:  { en: '1-bedroom landed house', id: 'Rumah tapak 1 kamar tidur' },
      short: { en: '1BR house', id: 'Rumah 1KT' } },
    { key: 'house-2br',    form: 'house', beds: 2,
      label: { en: '2 bedrooms', id: '2 kamar tidur' },
      name:  { en: '2-bedroom landed house', id: 'Rumah tapak 2 kamar tidur' },
      short: { en: '2BR house', id: 'Rumah 2KT' } },
    { key: 'house-4br',    form: 'house', beds: 4,
      label: { en: '4 bedrooms', id: '4 kamar tidur' },
      name:  { en: '4-bedroom landed house', id: 'Rumah tapak 4 kamar tidur' },
      short: { en: '4BR house', id: 'Rumah 4KT' } }
  ],

  cities: [
    {
      key: "perth", city: "Perth", country: "Australia", countryId: "Australia", countryCode: "AU", region: "Oceania",
      aliases: [],
      currencySymbol: "$", currencyCode: "AUD", asOf: "2025-06",
      buyer: "Resident owner-occupier",
      downPaymentPct: 20, mortgageRate: 6.1, mortgageTerm: 30, riskFreeRate: 4.5, horizon: 30, sellingCostPct: 2.5,
      rentFreq: "weekly", rentInflation: 3.5, ownOngoingInflation: 2.5, rentOngoingInflation: 2.5,
      homes: {
        "apt-2br": {
          propertyPrice: 750000, rentAmount: 700, houseGrowth: 4.5, setupCost: 4.33, ownOngoingCost: 8500, rentOngoingCost: 1500, sqm: 80,
          where: "City centre or inner suburbs"
        }
      },
      unavailable: {
        "apt-studio": "Not collected yet.",
        "apt-1br": "Not collected yet.",
        "apt-4br": "Not collected yet.",
        "house-studio": "Not collected yet.",
        "house-1br": "Not collected yet.",
        "house-2br": "Not collected yet.",
        "house-4br": "Not collected yet."
      },
      notes: {
        market: "Seed"
      },
      sources: [

      ]
    },
    {
      key: "melbourne", city: "Melbourne", country: "Australia", countryId: "Australia", countryCode: "AU", region: "Oceania",
      aliases: [],
      currencySymbol: "$", currencyCode: "AUD", asOf: "2025-06",
      buyer: "Resident owner-occupier",
      downPaymentPct: 20, mortgageRate: 6.1, mortgageTerm: 30, riskFreeRate: 4.5, horizon: 30, sellingCostPct: 2.5,
      rentFreq: "weekly", rentInflation: 3, ownOngoingInflation: 2.5, rentOngoingInflation: 2.5,
      homes: {
        "apt-2br": {
          propertyPrice: 800000, rentAmount: 620, houseGrowth: 3, setupCost: 5.69, ownOngoingCost: 9500, rentOngoingCost: 1500, sqm: 80,
          where: "City centre or inner suburbs"
        }
      },
      unavailable: {
        "apt-studio": "Not collected yet.",
        "apt-1br": "Not collected yet.",
        "apt-4br": "Not collected yet.",
        "house-studio": "Not collected yet.",
        "house-1br": "Not collected yet.",
        "house-2br": "Not collected yet.",
        "house-4br": "Not collected yet."
      },
      notes: {
        market: "Seed"
      },
      sources: [

      ]
    },
    {
      key: "sydney", city: "Sydney", country: "Australia", countryId: "Australia", countryCode: "AU", region: "Oceania",
      aliases: [],
      currencySymbol: "$", currencyCode: "AUD", asOf: "2025-06",
      buyer: "Resident owner-occupier",
      downPaymentPct: 20, mortgageRate: 6.1, mortgageTerm: 30, riskFreeRate: 4.5, horizon: 30, sellingCostPct: 2.5,
      rentFreq: "weekly", rentInflation: 3.5, ownOngoingInflation: 2.5, rentOngoingInflation: 2.5,
      homes: {
        "apt-2br": {
          propertyPrice: 1050000, rentAmount: 750, houseGrowth: 3.5, setupCost: 4.21, ownOngoingCost: 11000, rentOngoingCost: 1500, sqm: 80,
          where: "City centre or inner suburbs"
        }
      },
      unavailable: {
        "apt-studio": "Not collected yet.",
        "apt-1br": "Not collected yet.",
        "apt-4br": "Not collected yet.",
        "house-studio": "Not collected yet.",
        "house-1br": "Not collected yet.",
        "house-2br": "Not collected yet.",
        "house-4br": "Not collected yet."
      },
      notes: {
        market: "Seed"
      },
      sources: [

      ]
    },
    {
      key: "singapore", city: "Singapore", country: "Singapore", countryId: "Singapura", countryCode: "SG", region: "Southeast Asia",
      aliases: [],
      currencySymbol: "$", currencyCode: "SGD", asOf: "2025-06",
      buyer: "Resident owner-occupier",
      downPaymentPct: 25, mortgageRate: 2.5, mortgageTerm: 30, riskFreeRate: 3.5, horizon: 30, sellingCostPct: 2,
      rentFreq: "monthly", rentInflation: 3, ownOngoingInflation: 3, rentOngoingInflation: 2.5,
      homes: {
        "apt-2br": {
          propertyPrice: 1800000, rentAmount: 5000, houseGrowth: 4.5, setupCost: 3.61, ownOngoingCost: 7000, rentOngoingCost: 1500, sqm: 80,
          where: "City centre or inner suburbs"
        }
      },
      unavailable: {
        "apt-studio": "Not collected yet.",
        "apt-1br": "Not collected yet.",
        "apt-4br": "Not collected yet.",
        "house-studio": "Not collected yet.",
        "house-1br": "Not collected yet.",
        "house-2br": "Not collected yet.",
        "house-4br": "Not collected yet."
      },
      notes: {
        market: "Seed"
      },
      sources: [

      ]
    },
    {
      key: "kualalumpur", city: "Kuala Lumpur", country: "Malaysia", countryId: "Malaysia", countryCode: "MY", region: "Southeast Asia",
      aliases: [],
      currencySymbol: "RM", currencyCode: "MYR", asOf: "2025-06",
      buyer: "Resident owner-occupier",
      downPaymentPct: 10, mortgageRate: 4.3, mortgageTerm: 30, riskFreeRate: 3.5, horizon: 30, sellingCostPct: 3,
      rentFreq: "monthly", rentInflation: 3, ownOngoingInflation: 3, rentOngoingInflation: 2.5,
      homes: {
        "apt-2br": {
          propertyPrice: 1000000, rentAmount: 4000, houseGrowth: 3, setupCost: 4, ownOngoingCost: 8000, rentOngoingCost: 1500, sqm: 80,
          where: "City centre or inner suburbs"
        }
      },
      unavailable: {
        "apt-studio": "Not collected yet.",
        "apt-1br": "Not collected yet.",
        "apt-4br": "Not collected yet.",
        "house-studio": "Not collected yet.",
        "house-1br": "Not collected yet.",
        "house-2br": "Not collected yet.",
        "house-4br": "Not collected yet."
      },
      notes: {
        market: "Seed"
      },
      sources: [

      ]
    },
    {
      key: "jakarta", city: "Jakarta", country: "Indonesia", countryId: "Indonesia", countryCode: "ID", region: "Southeast Asia",
      aliases: [],
      currencySymbol: "Rp", currencyCode: "IDR", asOf: "2025-06",
      buyer: "Resident owner-occupier",
      downPaymentPct: 20, mortgageRate: 9.5, mortgageTerm: 20, riskFreeRate: 5, horizon: 20, sellingCostPct: 5.5,
      rentFreq: "monthly", rentInflation: 4, ownOngoingInflation: 3.5, rentOngoingInflation: 3.5,
      homes: {
        "apt-2br": {
          propertyPrice: 2000000000, rentAmount: 10000000, houseGrowth: 5.5, setupCost: 6, ownOngoingCost: 21000000, rentOngoingCost: 1000000, sqm: 80,
          where: "City centre or inner suburbs"
        }
      },
      unavailable: {
        "apt-studio": "Not collected yet.",
        "apt-1br": "Not collected yet.",
        "apt-4br": "Not collected yet.",
        "house-studio": "Not collected yet.",
        "house-1br": "Not collected yet.",
        "house-2br": "Not collected yet.",
        "house-4br": "Not collected yet."
      },
      notes: {
        market: "Seed"
      },
      sources: [

      ]
    }
  ]
};

/* ── RESOLVER ─────────────────────────────────────────────────────────────────
   The one way every page reads the data above, so a scenario loads the same
   form on all of them. A scenario id is "<city key>/<type key>"; a bare city
   key means that city's default home (a 2-bedroom apartment where there is
   one, else its first home).
   ────────────────────────────────────────────────────────────────────────── */
window.RVO_QS = (function(D){
  'use strict';
  // Every form value a scenario sets, in the order the calculator writes them.
  var FIELDS = ['currencySymbol', 'propertyPrice', 'downPaymentPct', 'mortgageRate', 'mortgageTerm',
    'houseGrowth', 'sellingCostPct', 'setupCost', 'setupCostType', 'ownOngoingCost', 'ownOngoingCostFreq',
    'ownOngoingCostType', 'ownOngoingInflation', 'rentAmount', 'rentFreq', 'rentInflation', 'rentOngoingCost',
    'rentOngoingCostFreq', 'rentOngoingCostType', 'rentOngoingInflation', 'riskFreeRate', 'horizon',
    'monthlyBudget', 'monthlyBudgetIncrease', 'mortgageType', 'costInterestOnly', 'rtbEnabled', 'rtbBuyYear',
    'initialCash'];
  var cityBy = {}, typeBy = {};
  D.cities.forEach(function(c){ cityBy[c.key] = c; });
  D.types.forEach(function(t){ typeBy[t.key] = t; });

  function city(k){ return Object.prototype.hasOwnProperty.call(cityBy, k) ? cityBy[k] : null; }
  function type(k){ return Object.prototype.hasOwnProperty.call(typeBy, k) ? typeBy[k] : null; }
  // The home types a city has, in picker order.
  function homes(k){
    var c = city(k);
    return c ? D.types.filter(function(t){ return c.homes && c.homes[t.key]; }).map(function(t){ return t.key; }) : [];
  }
  function defaultType(k){
    var h = homes(k);
    return h.indexOf('apt-2br') >= 0 ? 'apt-2br' : (h[0] || null);
  }
  function id(cityKey, typeKey){ return cityKey + '/' + typeKey; }
  function split(sid){
    var s = String(sid || ''), i = s.indexOf('/');
    return i < 0 ? { city: s, type: defaultType(s) } : { city: s.slice(0, i), type: s.slice(i + 1) };
  }
  function lang(l){ return l === 'id' ? 'id' : 'en'; }
  function typeText(typeKey, part, l){
    var t = type(typeKey);
    return t ? t[part][lang(l)] : typeKey;
  }
  function formText(form, l){ return D.forms[form] ? D.forms[form][lang(l)] : form; }
  function countryText(c, l){ return lang(l) === 'id' && c.countryId ? c.countryId : c.country; }
  // A scenario's form values, or null for a home the city does not have.
  function preset(sid){
    var s = split(sid), c = city(s.city);
    var h = c && c.homes ? c.homes[s.type] : null;
    if(!h) return null;
    var out = {};
    FIELDS.forEach(function(f){
      out[f] = h[f] !== undefined ? h[f] : (c[f] !== undefined ? c[f] : D.defaults[f]);
    });
    out.id = id(c.key, s.type);
    out.cityKey = c.key;
    out.typeKey = s.type;
    return out;
  }
  // "Perth · 2BR apartment": a scenario's name where a short one is needed.
  function label(sid, l){
    var s = split(sid), c = city(s.city);
    return c ? c.city + ' · ' + typeText(s.type, 'short', l) : String(sid);
  }
  // Search as the Cost of Living Comparator's city picker does: every word
  // typed must appear somewhere in the city, its country or its currency,
  // accents ignored, so "zurich" finds Zürich and "uae" finds Dubai.
  function fold(s){
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function terms(q){ return fold(q).split(/[\s,]+/).filter(Boolean); }
  function hay(c){
    return fold([c.city, c.country, c.countryId, c.countryCode, c.currencyCode, c.region]
      .concat(c.aliases || []).join(' '));
  }
  function cityMatches(c, q){
    var h = hay(c);
    return terms(q).every(function(t){ return h.indexOf(t) >= 0; });
  }
  // A city and one of its homes, for a list that offers both at once.
  function homeMatches(c, typeKey, q, l){
    var t = type(typeKey);
    var h = hay(c) + ' ' + fold([t.name.en, t.name[lang(l)], t.short.en, t.short[lang(l)], formText(t.form, 'en'),
      formText(t.form, l), t.form === 'house' ? 'villa townhouse' : 'flat condo unit'].join(' '));
    return terms(q).every(function(x){ return h.indexOf(x) >= 0; });
  }
  // Every scenario id, city by city.
  function all(){
    var out = [];
    D.cities.forEach(function(c){ homes(c.key).forEach(function(t){ out.push(id(c.key, t)); }); });
    return out;
  }
  // Cities in A to Z order, for a picker.
  function sortedCities(l){
    return D.cities.slice().sort(function(a, b){ return a.city.localeCompare(b.city, lang(l)); });
  }
  return {
    data: D, FIELDS: FIELDS, city: city, type: type, homes: homes, defaultType: defaultType,
    id: id, split: split, preset: preset, label: label, typeText: typeText, formText: formText,
    countryText: countryText, cityMatches: cityMatches, homeMatches: homeMatches, all: all,
    sortedCities: sortedCities
  };
})(window.RVO_QUICKSTART);
