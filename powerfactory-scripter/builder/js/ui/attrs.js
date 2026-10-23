// Attribute suggestions for `attr` settings. The reference data itself is loaded by
// core/attrdata.js (element_params.json, variables/elements/*.json), which the blocks also ask
// what a unit is, so the files are read once however they are first wanted.
// Each suggestion shows the description first and the code second ("Voltage, Magnitude  m:u").
// A result variable read at a terminal of a branch carries a ":busN" suffix in the data; the list
// offers the class's real terminals instead (ElmTr2 :bushv / :buslv ...), never the placeholder.

import { loadParams, loadClass } from '../core/attrdata.js';

// The terminals a result variable can be read at, per class (DESIGN 8).
export const BUS_SUFFIXES = {
  ElmLne: [':bus1', ':bus2'], ElmCoup: [':bus1', ':bus2'], ElmZpu: [':bus1', ':bus2'],
  ElmSind: [':bus1', ':bus2'], ElmScap: [':bus1', ':bus2'], ElmBranch: [':bus1', ':bus2'],
  ElmTr2: [':bushv', ':buslv'], ElmTr3: [':bushv', ':busmv', ':buslv'],
  ElmVsc: [':busac'], ElmVscmono: [':busac'],
};
const SUFFIX_WORDS = { ':bus1': 'at terminal i', ':bus2': 'at terminal j', ':bushv': 'at the HV side', ':busmv': 'at the MV side', ':buslv': 'at the LV side', ':busac': 'at the AC side' };
export const suffixesFor = (cls) => BUS_SUFFIXES[cls] || [':bus1'];

const STUDY_WORDS = {
  load_flow: 'Load flow results', load_flow_dc: 'DC load flow results', short_circuit: 'Short-circuit results',
  dynamic_rms: 'RMS simulation results', dynamic_emt: 'EMT simulation results', modal_analysis: 'Modal analysis results',
  opf: 'Optimal power flow results', basic: 'Basic data', frequency_sweep: 'Frequency sweep results', harmonics: 'Harmonic results',
};

// All suggestions for one class: [{ value, main, sub, chip, group }].
// opts.attrs: 'any' (default) | 'results' | 'params'; opts.study: a result group to put first.
async function allFor(cls, opts) {
  const out = [];
  const want = opts.attrs || 'any';
  if (want !== 'params') {
    const data = await loadClass(cls);
    const rv = data && data.result_vars;
    if (rv && typeof rv === 'object') {
      const groups = Object.keys(rv).sort((a, b) => (a === opts.study ? -1 : b === opts.study ? 1 : 0));
      for (const g of groups) {
        const byPrefix = rv[g] || {};
        for (const list of Object.values(byPrefix)) {
          for (const v of Array.isArray(list) ? list : []) {
            if (!v || typeof v.var !== 'string') continue;
            // Per-phase variants (suffix ":Ph" or ":busN:Ph", unbalanced runs only) are left out:
            // their phase naming is not verified, and the balanced variable is listed anyway.
            if (v.suffix && String(v.suffix).includes(':Ph')) continue;
            const base = { main: v.desc || v.var, sub: v.unit ? 'in ' + v.unit : '', group: STUDY_WORDS[g] || g };
            if (v.suffix) {
              for (const sfx of suffixesFor(cls)) out.push({ ...base, value: v.var + sfx, chip: v.var + sfx, main: (v.desc || v.var) + ' ' + (SUFFIX_WORDS[sfx] || sfx) });
            } else out.push({ ...base, value: v.var, chip: v.var });
          }
        }
      }
    }
  }
  if (want !== 'results') {
    const params = await loadParams();
    const list = params && Array.isArray(params[cls]) ? params[cls] : [];
    for (const v of list) {
      if (!v || typeof v.var !== 'string') continue;
      // Input data is offered as the plain attribute name ("plini", as the blocks' examples
      // write it; PowerFactory takes it with or without "e:"). The "b:" entries are derived
      // basic data, not attributes a script sets, so they are not offered.
      if (!v.var.startsWith('e:')) continue;
      const name = v.var.slice(2);
      out.push({ value: name, chip: name, main: v.desc || name, sub: v.unit && !/^(Sta|Elm|Typ|Int)/.test(v.unit) ? 'in ' + v.unit : '', group: 'Input data' });
    }
  }
  const seen = new Set();
  return out.filter(x => (seen.has(x.value) ? false : (seen.add(x.value), true)));
}

const cache = new Map();
export async function attrSuggestions(cls, query, opts = {}) {
  if (!cls) return [];
  const key = cls + '|' + (opts.attrs || 'any') + '|' + (opts.study || '');
  if (!cache.has(key)) cache.set(key, allFor(cls, opts));
  const all = await cache.get(key);
  const q = String(query || '').trim().toLowerCase();
  if (!q) return all.slice(0, 80);
  const words = q.split(/\s+/);
  const hits = all.filter(x => { const t = (x.main + ' ' + x.value).toLowerCase(); return words.every(w => t.includes(w)); });
  hits.sort((a, b) => (b.value.toLowerCase().startsWith(q) ? 1 : 0) - (a.value.toLowerCase().startsWith(q) ? 1 : 0));
  return hits.slice(0, 80);
}
