// Parameter suggestions for `attr` settings. The reference data itself is loaded by
// core/attrdata.js (reference/params.json), which the blocks also ask what a unit is, so the
// file is read once however it is first wanted.
//
// Each suggestion shows what the parameter means first and its name second ("Resistance  R"),
// grouped by the category of the component's own dialog in PSCAD, so the list reads the way the
// dialog does. A Choice parameter also shows the words it takes, because those, not the numbers
// the form holds, are what the Automation Library writes.

import { loadParams, paramsOf, optionsOf } from '../core/attrdata.js';

// What a parameter's type means to a reader, for the chip beside its name.
const TYPE_WORDS = {
  Real: 'a number', Integer: 'a whole number', Choice: 'one of a few words',
  Text: 'text', Logical: 'yes or no', Table: 'a table',
};

// All suggestions for one definition: [{ value, main, sub, chip, group }].
// opts.attrs: 'any' (default) | 'inputs' (leave out the ones PSCAD computes).
async function allFor(defn, opts) {
  await loadParams();
  const list = paramsOf(defn);
  if (!Array.isArray(list)) return [];
  const want = opts.attrs || 'any';
  const out = [];
  for (const p of list) {
    if (want === 'inputs' && String(p.intent || '') === 'Output') continue;
    const bits = [];
    if (p.unit) bits.push('in ' + p.unit);
    const opts2 = optionsOf(defn, p.name);
    if (Array.isArray(opts2) && opts2.length) {
      bits.push(opts2.slice(0, 4).map(o => o[0]).join(', ') + (opts2.length > 4 ? ', ...' : ''));
    } else if (TYPE_WORDS[p.type] && !p.unit) {
      bits.push(TYPE_WORDS[p.type]);
    }
    out.push({
      value: p.name, chip: p.name,
      main: p.desc || p.name,
      sub: bits.join(' · '),
      group: p.group || 'Parameters',
    });
  }
  const seen = new Set();
  return out.filter(x => (seen.has(x.value) ? false : (seen.add(x.value), true)));
}

const cache = new Map();

// The suggestions for a definition, filtered by what has been typed. Sorted so a name that
// starts with the query comes before one that only contains it, and the rest keep the order of
// the component's own dialog. Gives [] while the data is not in yet; the combo asks again.
export async function attrSuggestions(defn, query, opts = {}) {
  const key = String(defn || '') + '|' + (opts.attrs || 'any');
  if (!cache.has(key)) cache.set(key, allFor(String(defn || ''), opts));
  let all;
  try {
    all = await cache.get(key);
  } catch (err) {
    cache.delete(key);
    return [];
  }
  const q = String(query || '').trim().toLowerCase();
  if (!q) return all.slice(0, 80);
  const hit = all.filter(x => x.value.toLowerCase().includes(q) || x.main.toLowerCase().includes(q));
  hit.sort((a, b) => {
    const sa = a.value.toLowerCase().startsWith(q) ? 0 : 1;
    const sb = b.value.toLowerCase().startsWith(q) ? 0 : 1;
    return sa - sb;
  });
  return hit.slice(0, 80);
}
