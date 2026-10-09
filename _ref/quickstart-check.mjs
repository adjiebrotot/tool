/* Quick Start has to be a clean reset.
   ---------------------------------------------------------------------------
   Seven tools ship Quick Start scenarios and no Reset button, on one claim: any
   scenario already returns the form to a clean, known state, so a separate
   Reset would only be a worse version of the same thing. That claim is only
   true while every scenario opens from the defaults rather than from whatever
   the reader left on screen — and it is easy to break, because a scenario that
   forgets one field, one mode or one hidden collection still LOOKS right.

   So this checks it rather than trusting it. For each preset:

     A. load the page clean, click the preset, snapshot the form
     B. load the page again, mangle every visible control, THEN click the same
        preset, snapshot the form

   A and B must be identical. Hidden scratch rows behind a mode the scenario
   switched away from are not compared: they are not part of the state the
   scenario claims, and the engine reads its own state object, not them. What
   the reader can see, and the verdict drawn from it, must match to the letter.

   Run: node _ref/quickstart-check.mjs   (QS_ALL=1: every Rent vs Own scenario)
*/
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Tools whose Reset button was dropped because Quick Start covers it. A tool
// that keeps its Reset (sankeycreator) has no claim to check. pisahvsgabung's
// "Equal incomes" example is its starting point, so it is the way back there.
// dcasimulator and its portfolio page are not here: their scenarios fetch live
// market data, so a clean-room replay would be a network test rather than a
// state test.
const TOOLS = (process.env.ONLY ? process.env.ONLY.split(',') : ['borrowingcapacity', 'rentvsownhouse', 'financialfreedom', 'financingvscash', 'pisahvsgabung', 'valuateeverything']);

/* Where a tool seeds a detailed list from the simple field it replaces, the two
   have to agree at the moment of switching — that is the documented promise of
   the switch, and it is the one thing the A-versus-B comparison below cannot
   see, because a scenario can be wrong the same way on both runs. Each pair is
   [the simple field, the first row of the detailed view that stands in for it].
   Checked after a scenario has been applied, which is when the seeding runs. */
const MIRRORS = {
  rentvsownhouse: [
    ['mortgageRate',    '#ratePeriodRows .rp-rate'],
    ['setupCost',       '#ownSetupCostRows .ci-amount'],
    ['ownOngoingCost',  '#ownOngoingCostRows .ci-amount'],
    ['rentOngoingCost', '#rentOngoingCostRows .ci-amount']
  ]
};

/* How a tool's scenarios are listed and picked, where they are not a row of
   .quick-start-btn pills. Rent vs Own has too many for pills (a city, then one
   of that city's homes), so it is driven through its own two controls the way
   a reader would: type the city into the search, press its row, then choose
   the home. Both functions run in the page. */
const PICKERS = {
  rentvsownhouse: {
    // By default one scenario per city, chosen so every home type is also
    // covered: the reset path is the same code for all of them, and what
    // varies (a city's frequencies, currency, a home's figures) is all hit.
    // QS_ALL=1 drives every one of them. rentvsownhouse/_audit/
    // quickstart-data.mjs checks every scenario's figures against the form.
    list: process.env.QS_ALL ? `function(){ return window.RVO_QS.all(); }` : `function(){
      var Q = window.RVO_QS, seen = {}, out = [];
      Q.data.cities.forEach(function(c){
        var homes = Q.homes(c.key);
        var t = homes.filter(function(k){ return !seen[k]; })[0] || Q.defaultType(c.key);
        seen[t] = 1;
        out.push(Q.id(c.key, t));
      });
      return out;
    }`,
    pick: `async function(sid){
      var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
      var parts = sid.split('/'), city = window.RVO_QS.city(parts[0]);
      var input = document.getElementById('qsCity');
      input.focus();
      input.value = city.city;
      input.dispatchEvent(new Event('input', {bubbles: true}));
      await sleep(20);
      var row = document.querySelector('#qsCityList .combo-opt[data-key="' + parts[0] + '"]');
      if(!row) throw new Error('no city row for ' + sid);
      row.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true}));
      await sleep(20);
      var sel = document.getElementById('qsType');
      if(sel.value !== parts[1]){ sel.value = parts[1]; sel.dispatchEvent(new Event('change', {bubbles: true})); }
      if(sel.value !== parts[1]) throw new Error('no home ' + parts[1] + ' for ' + parts[0]);
    }`,
    // Hundreds of scenarios: one scribbled page serves them all, scribbled
    // again before each, rather than a fresh page apiece.
    reuseDirty: true
  }
};
const PILLS = {
  list: `function(){ return Array.prototype.map.call(document.querySelectorAll('.quick-start-btn'), function(b){ return b.dataset.preset || b.dataset.city; }); }`,
  pick: `async function(key){ document.querySelector('.quick-start-btn[data-preset="' + key + '"], .quick-start-btn[data-city="' + key + '"]').click(); }`
};

/* CDN libraries are stubbed so this runs offline; the pages only need Chart to
   exist, not to draw. */
const STUB = `
class Chart {
  constructor(ctx, cfg){
    this.config = cfg;
    this.data = (cfg && cfg.data) || {datasets: []};
    this.options = (cfg && cfg.options) || {};
    this.scales = this.options.scales || {};
    this._hidden = {};
  }
  update(){} destroy(){} resetZoom(){} zoomScale(){}
  isDatasetVisible(i){ return !this._hidden[i]; }
  setDatasetVisibility(i, v){ this._hidden[i] = !v; }
  getDatasetMeta(){ return {data: [], hidden: false}; }
}
Chart.register = function(){};
Chart.Interaction = {modes: {}};
Chart.helpers = {getRelativePosition: function(e){ return e; }};
window.Chart = Chart;
window.Plotly = {newPlot: async function(){}, react: async function(){}, relayout: async function(){}};
try { localStorage.clear(); } catch(e){}
// Every tour reads "<tool>-tour-v<N>-seen"; a returning visitor has seen it.
(function(){ var get = Storage.prototype.getItem;
  Storage.prototype.getItem = function(k){ return /-tour-v\d+-seen$/.test(k) ? '1' : get.call(this, k); }; })();`;

/* Everything the reader can reach, plus the verdict the page draws from it.
   Every control tab is opened in turn, because most of a tool's form is behind
   one at any moment and a scenario that forgets a field on a tab nobody is
   looking at is exactly the failure this is here to catch. A control still
   hidden with its own tab open is behind a MODE the scenario switched away
   from: scratch state the engine does not read, so not part of what it claims.
   Tab clicks only change what is on screen, so the snapshot leaves nothing
   behind but the tab it started on. */
const SNAPSHOT = `async function(){
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var out = {}, seen = 0;
  var collect = function(){
    document.querySelectorAll('input,select,textarea').forEach(function(el){
      if(!el.offsetParent && el.type !== 'hidden') return;
      var near = el.closest('[id]');
      var key = el.id || ((near ? near.id : '?') + '/' + el.className.split(' ')[0] + '#' + (seen++));
      if(!(key in out)) out[key] = (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value;
    });
  };
  var sweepTabs = async function(){
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.ctrl-tab'));
    var opened = tabs.filter(function(t){ return t.classList.contains('active'); })[0];
    collect();
    for(var i = 0; i < tabs.length; i++){ tabs[i].click(); await sleep(40); collect(); }
    if(opened) opened.click();
    return tabs.length;
  };
  out['@tabs'] = await sweepTabs();
  out['@fields'] = seen;

  /* Then the advanced views, which a scenario switches AWAY from rather than
     filling in. Their rows are seeded from the scenario the first time they are
     opened, so this is where a scenario that wrote the form but not the state
     behind it gives itself away — the rows come up carrying the plan before
     it. Done last, because opening them is a change in its own right. */
  var prefix = 'adv:';
  var segs = Array.prototype.slice.call(document.querySelectorAll('.seg-btn,.mode-btn'));
  for(var k = 0; k < segs.length; k++){
    if(!segs[k].classList.contains('active')){ segs[k].click(); await sleep(60); }
  }
  await sleep(200);
  var advSeen = 0;
  collect = function(){
    document.querySelectorAll('input,select,textarea').forEach(function(el){
      if(!el.offsetParent && el.type !== 'hidden') return;
      var near = el.closest('[id]');
      var key = prefix + (el.id || ((near ? near.id : '?') + '/' + el.className.split(' ')[0] + '#' + (advSeen++)));
      if(!(key in out)) out[key] = (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value;
    });
  };
  await sweepTabs();
  out['@advFields'] = advSeen;
  out['@highlighted'] = Array.prototype.map
    .call(document.querySelectorAll('.quick-start-btn.active'),
          function(b){ return b.dataset.preset || b.dataset.city; }).join(',');
  var qsCity = document.getElementById('qsCity'), qsType = document.getElementById('qsType');
  if(qsCity) out['@picked'] = qsCity.value + ' / ' + (qsType ? qsType.value : '');
  var v = document.getElementById('verdict');
  if(v) out['@verdict'] = v.textContent.replace(/\\s+/g, ' ').trim().slice(0, 300);
  return out;
}`;

/* Flip every segmented control off its default, then scribble over every
   visible field. Deliberately blunt: the point is to leave nothing at its
   default, so anything a scenario forgets to write shows up as a difference. */
const MANGLE = `async function(){
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var fire = function(el){
    el.dispatchEvent(new Event('input', {bubbles: true}));
    el.dispatchEvent(new Event('change', {bubbles: true}));
  };
  var segs = document.querySelectorAll('.seg-btn,.mode-btn');
  for(var i = 0; i < segs.length; i++){
    if(!segs[i].classList.contains('active')){ segs[i].click(); await sleep(30); }
  }
  var n = 0, els = document.querySelectorAll('input,select,textarea');
  for(var j = 0; j < els.length && n < 150; j++){
    var el = els[j];
    if(!el.offsetParent) continue;
    if(el.type === 'checkbox'){ el.checked = !el.checked; fire(el); }
    else if(el.type === 'radio'){ el.checked = true; fire(el); }
    else if(el.tagName === 'SELECT'){
      var alt = Array.prototype.find.call(el.options, function(o){ return o.value !== el.value; });
      if(alt){ el.value = alt.value; fire(el); }
    }
    else if(el.type === 'range'){ el.value = String(Math.round((+el.min + +el.max) / 2) + 1); fire(el); }
    else if(el.type === 'number'){ el.value = String(Math.round(((parseFloat(el.value) || 1) * 1.37 + 1) * 10) / 10); fire(el); }
    else if(el.type === 'text'){ el.value = '7,777'; fire(el); }
    n++;
  }
  await sleep(400);
}`;

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  console.log((ok ? '  PASS  ' : '✗ FAIL  ') + name + (detail ? '  — ' + detail : ''));
  ok ? pass++ : fail++;
};

const browser = await chromium.launch();

async function open(tool){
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('   PAGEERROR ' + tool + ': ' + String(e).split('\n')[0]));
  await page.route('**://*/**', r => r.request().url().startsWith('file:')
    ? r.continue()
    : r.fulfill({status: 200, contentType: 'application/javascript', body: ''}));
  await page.addInitScript(STUB);
  await page.goto(pathToFileURL(join(ROOT, tool, 'index.html')).href, {waitUntil: 'load'});
  await page.waitForTimeout(900);
  return page;
}

for(const tool of TOOLS){
  console.log('\n── ' + tool + ' ──');
  const picker = PICKERS[tool] || PILLS;
  const clean = await open(tool);
  const presets = await clean.evaluate(list => eval('(' + list + ')')(), picker.list);

  check(tool + ' ships Quick Start scenarios and no Reset button',
    presets.length > 0 && await clean.evaluate(() => !document.getElementById('resetBtn')),
    presets.length + ' scenarios');

  let shared = picker.reuseDirty ? await open(tool) : null;
  for(const key of presets){
    const ref = await clean.evaluate(async ([key, pick, snap]) => {
      await eval('(' + pick + ')')(key);
      await new Promise(r => setTimeout(r, 500));
      return await eval('(' + snap + ')')();
    }, [key, picker.pick, SNAPSHOT]);

    const dirty = shared || await open(tool);
    const got = await dirty.evaluate(async ([key, pick, snap, mangle]) => {
      await eval('(' + mangle + ')')();
      await eval('(' + pick + ')')(key);
      await new Promise(r => setTimeout(r, 500));
      return await eval('(' + snap + ')')();
    }, [key, picker.pick, SNAPSHOT, MANGLE]);
    if(!shared) await dirty.close();

    const diffs = Object.keys(Object.assign({}, ref, got))
      .filter(k => String(ref[k]) !== String(got[k]));
    check('"' + key + '" carries nothing over from the plan before it',
      diffs.length === 0,
      diffs.length
        ? diffs.slice(0, 5).map(k => `${k} ${JSON.stringify(got[k])} ≠ ${JSON.stringify(ref[k])}`).join(' | ')
        : Object.keys(ref).length + ' controls identical');

    const pairs = MIRRORS[tool];
    if(pairs){
      const seeded = await clean.evaluate(async ([key, pick, pairs]) => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        await eval('(' + pick + ')')(key);
        await sleep(500);
        const segs = Array.prototype.slice.call(document.querySelectorAll('.seg-btn,.mode-btn'));
        for(const b of segs){ if(!b.classList.contains('active')){ b.click(); await sleep(60); } }
        await sleep(200);
        const norm = v => String(v == null ? '' : v).replace(/[^0-9.\-]/g, '');
        return pairs.map(([simpleId, advSel]) => {
          const a = document.getElementById(simpleId);
          const b = document.querySelector(advSel);
          return {simpleId, simple: a ? norm(a.value) : null, advanced: b ? norm(b.value) : null};
        });
      }, [key, picker.pick, pairs]);
      // A scenario that ships its own rate schedule (a staged loan) opens on
      // it rather than seeding one from the single rate, so its first period
      // is the promo or fixed rate, not the term average the simple field holds.
      const staged = tool === 'rentvsownhouse' && await clean.evaluate(k => !!(window.RVO_QS.preset(k) || {}).ratePeriods, key);
      const off = seeded.filter(m => m.simple !== m.advanced && !(staged && m.simpleId === 'mortgageRate'));
      check('"' + key + '" seeds its detailed views from its own figures',
        off.length === 0,
        off.length
          ? off.map(m => `${m.simpleId} ${m.advanced} vs ${m.simple}`).join(' | ')
          : seeded.map(m => m.simpleId + '=' + m.simple).join(', '));
    }
  }
  if(shared) await shared.close();
  await clean.close();
}

await browser.close();
console.log(`\nQuick Start check: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
