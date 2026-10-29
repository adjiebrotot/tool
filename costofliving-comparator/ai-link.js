/* AI assistant links for the Cost of Living Comparator and its Map.

   Both pages read a #load link an AI assistant wrote (SharedAgent, shared.js; the
   adapter is each page's own script). These are the few helpers they share, none of
   them maths: finding a city by the name a person types, and reading the one list of
   expense rows. Nothing here changes a figure, and nothing is invented: a name that
   is not in the page's own city list, or that fits more than one city, is reported
   and left out.

   window.ColAI = {
     cities(raw, list)      "Melbourne,Jakarta" -> { entries: [{ text, key, city, status, options }] }
                            status: ok | ambiguous | none; key is "City|Country" as the page keys it
     label(city, list)      the shortest name that finds this city again ("Sydney", "London, United Kingdom")
     choice(raw, words, alias)  a key, its label or an alias -> the key of words ({ key: label }), or null
     rows(raw, api, o)      "rent:3500,groceries:600:to1=700" -> { rows: [{ catId, amount, ov, unit, qty, per }], text }
                          unit, qty and per only when o.units ({ unit(catId, text), period(text) }) reads them
     catId(text)            an expense category by id or name, or ''
     money(n)               8000 -> "8,000"
     decode(raw)            a link's value, percent-decoded (+ is a space)
   } */
(function(root){
'use strict';

// The expense categories both pages share, and the other names a person might write.
var CAT_NAMES = {
  rent: ['rent'], groceries: ['groceries', 'grocery'], eating_out: ['eating out', 'dining out', 'restaurants'],
  utilities: ['utilities', 'utility'], electricity: ['electricity', 'electric'], water: ['water'],
  gas_util: ['gas', 'gas utility'], fuel: ['fuel', 'petrol', 'gasoline'], medical: ['medical', 'medical care'],
  health_insurance: ['health insurance'], remittance: ['remittance', 'remittances'],
  intl_travel: ['international travel', 'intl travel', 'travel'], other: ['other']
};
var CAT_LABEL = {
  rent: 'Rent', groceries: 'Groceries', eating_out: 'Eating out', utilities: 'Utilities', electricity: 'Electricity',
  water: 'Water', gas_util: 'Gas', fuel: 'Fuel', medical: 'Medical care', health_insurance: 'Health insurance',
  remittance: 'Remittance', intl_travel: 'International travel', other: 'Other'
};
var MAX_ROWS = 20, MAX_AMOUNT = 100000000000;

var FOLD = { 'ß': 'ss', 'ø': 'o', 'ł': 'l', 'đ': 'd', 'ı': 'i', 'æ': 'ae', 'œ': 'oe' };
// Lower case, no accents, letters and digits only, single spaces.
function norm(s){
  s = String(s == null ? '' : s).toLowerCase();
  if(s.normalize) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/[ßøłđıæœ]/g, function(c){ return FOLD[c]; });
  return s.replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
function decode(s){
  s = String(s == null ? '' : s).replace(/\+/g, ' ');
  try { return decodeURIComponent(s); }
  catch(e){ return s.replace(/(?:%[0-9A-Fa-f]{2})+/g, function(m){ try { return decodeURIComponent(m); } catch(e2){ return m; } }); }
}
function clip(s, n){ s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > (n || 40) ? s.slice(0, n || 40) + '...' : s; }
function money(n){ return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }); }

/* ── Choices ── */
// raw: a link's value; words: { key: label }; alias: optional { other name: key }. The key, the label
// as the page shows it, or an alias, ignoring case.
function choice(raw, words, alias){
  var s = norm(decode(raw)), keys = Object.keys(words), i;
  if(!s) return null;
  for(i = 0; i < keys.length; i++) if(norm(keys[i]) === s) return keys[i];
  for(i = 0; i < keys.length; i++) if(norm(words[keys[i]]) === s) return keys[i];
  if(alias) for(i in alias) if(norm(i) === s && words[alias[i]] != null) return alias[i];
  return null;
}

/* ── Cities ── */
function countryForms(country){
  var out = [country], bare = country.replace(/\s*\(.*\)\s*$/, '').trim(), m = /\(([^)]+)\)/.exec(country);
  if(bare && bare !== country) out.push(bare);
  if(m) out.push(m[1]);
  return out;
}
// "New York, NY" -> "New York"; "Queretaro (Santiago de Queretaro)" -> "Queretaro".
function stripCity(name){ return name.replace(/\s*\(.*\)\s*$/, '').replace(/,\s*[A-Z]{2}$/, '').trim(); }
var indexed = null, indexedFor = null;
function index(list){
  if(indexedFor === list && indexed) return indexed;
  var exact = Object.create(null), short = Object.create(null);
  function add(map, k, c){
    k = norm(k);
    if(!k) return;
    var a = map[k] || (map[k] = []);
    if(a.indexOf(c) < 0) a.push(c);
  }
  list.forEach(function(c){
    var forms = countryForms(c.country), s = stripCity(c.city);
    add(exact, c.city, c);
    forms.forEach(function(f){ add(exact, c.city + ' ' + f, c); });
    if(s !== c.city){
      add(short, s, c);
      forms.forEach(function(f){ add(short, s + ' ' + f, c); });
    }
  });
  indexed = { exact: exact, short: short };
  indexedFor = list;
  return indexed;
}
function display(c){ return c.city + ', ' + c.country; }
function key(c){ return c.city + '|' + c.country; }
// One name: the city's full name (with or without its country) first, then its name without a state.
function find(list, text){
  var k = norm(text), ix = index(list);
  if(!k) return { status: 'none' };
  var hit = ix.exact[k] || ix.short[k];
  if(!hit) return { status: 'none' };
  if(hit.length === 1) return { status: 'ok', city: hit[0], key: key(hit[0]) };
  return { status: 'ambiguous', options: hit.map(display) };
}
// "Melbourne,Jakarta", "Austin, TX,Dallas, TX", "London, United Kingdom;Paris": a ; or | between cities
// leaves every comma inside a name; with only commas, the names are matched longest first.
function cities(raw, list){
  var text = decode(raw), entries = [], tokens, i, n;
  if(/[;|]/.test(text)){
    text.split(/[;|]/).forEach(function(t){
      t = t.trim();
      if(!t) return;
      var r = find(list, t);
      r.text = clip(t, 60);
      entries.push(r);
    });
    return { entries: entries };
  }
  tokens = text.split(',').map(function(t){ return t.trim(); }).filter(Boolean);
  for(i = 0; i < tokens.length;){
    var done = false;
    for(n = Math.min(3, tokens.length - i); n >= 1 && !done; n--){
      var cand = tokens.slice(i, i + n).join(', '), r = find(list, cand);
      if(r.status !== 'none'){ r.text = clip(cand, 60); entries.push(r); i += n; done = true; }
    }
    if(!done){ entries.push({ status: 'none', text: clip(tokens[i], 60) }); i++; }
  }
  return { entries: entries };
}
// The shortest name that finds this city again.
function label(c, list){
  var tries = [stripCity(c.city), c.city, display(c)], i;
  for(i = 0; i < tries.length; i++){
    var r = find(list, tries[i]);
    if(r.status === 'ok' && r.city === c) return tries[i];
  }
  return display(c);
}

/* ── Expense rows ── */
function catId(text){
  var s = norm(text), id;
  if(!s) return '';
  for(id in CAT_NAMES) if(norm(id) === s) return id;
  for(id in CAT_NAMES) if(norm(CAT_LABEL[id]) === s) return id;
  for(id in CAT_NAMES) if(CAT_NAMES[id].indexOf(s) >= 0) return id;
  return '';
}
/* "rent:3500,groceries:600:to1=700,eating out:700". Each item is a category, a monthly amount
   and, when o.dests is true, any number of to<N>=<amount> (what destination N costs, in its
   own currency, in place of the estimate). When o.units is given, a part may also be the row's
   unit (weekly, meal), qty=<how many> or per=<their period>: the Comparator's custom frequency.
   Returns { rows: [{ catId, amount, ov: { N: amount } }], text }
   or null when no row could be read. api is the loader's (items, number, clamp, error, unknown). */
function rows(raw, api, o){
  o = o || {};
  var items = api.items(raw), out = [];
  if(items.length > MAX_ROWS) api.error('rows: only the first ' + MAX_ROWS + ' were used');
  items.slice(0, MAX_ROWS).forEach(function(parts){
    var name = parts[0], id = catId(name);
    if(!id){ api.error('rows "' + clip(name) + '": not an expense category, so the row was skipped'); return; }
    var amt = parts.length > 1 && parts[1] !== '' ? api.number(parts[1]) : NaN;
    if(!isFinite(amt)){ api.error('rows "' + CAT_LABEL[id] + '": the amount is missing or not a number, so the row was skipped'); return; }
    var used = Math.min(MAX_AMOUNT, Math.max(0, amt));
    if(used !== amt) api.clamp('rows.' + id, amt, used);
    var row = { catId: id, amount: Math.round(used * 100) / 100, ov: {} };
    parts.slice(2).forEach(function(p){
      var m = /^to\s*(\d+)\s*=\s*(.*)$/i.exec(p), q;
      if(o.units && !m){
        // The custom frequency: a unit (weekly, meal), qty=<how many> and per=<their period>, none of them needed.
        if(p === '') return;
        q = /^(qty|per)\s*=\s*(.*)$/i.exec(p);
        if(q && q[1].toLowerCase() === 'qty'){
          var n = api.number(q[2]);
          if(!isFinite(n) || n <= 0) api.error('rows "' + CAT_LABEL[id] + '" ' + clip(p, 20) + ': qty is not a number above 0, so it was skipped');
          else row.qty = Math.min(MAX_AMOUNT, n);
        } else if(q){
          var per = o.units.period(q[2]);
          if(per) row.per = per; else api.error('rows "' + CAT_LABEL[id] + '" ' + clip(p, 20) + ': per is not weekly, fortnightly, monthly or yearly, so it was skipped');
        } else {
          var u = o.units.unit(id, p);
          if(u) row.unit = u; else api.error('rows "' + CAT_LABEL[id] + '" ' + clip(p, 20) + ': not a frequency or a unit for this row, so it was skipped');
        }
        return;
      }
      if(!m || !o.dests){ api.unknown('rows.' + id + '.' + clip(p, 20)); return; }
      var v = api.number(m[2]);
      if(!isFinite(v) || v < 0){ api.error('rows "' + CAT_LABEL[id] + '" ' + clip(p, 20) + ': not an amount'); return; }
      row.ov[+m[1]] = Math.round(Math.min(MAX_AMOUNT, v) * 100) / 100;
    });
    out.push(row);
  });
  if(!out.length) return null;
  return { rows: out, text: out.map(function(r){ return CAT_LABEL[r.catId] + ' ' + money(r.amount); }).join(', ') };
}

root.ColAI = { cities: cities, label: label, choice: choice, rows: rows, catId: catId, money: money, norm: norm, clip: clip,
  decode: decode, display: display, MAX_AMOUNT: MAX_AMOUNT, CAT_LABEL: CAT_LABEL };
})(window);
