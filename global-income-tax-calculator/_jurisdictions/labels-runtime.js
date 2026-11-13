/* How the Indonesian page words the engine's text. labels.mjs copies this function into
   ../labels-id.js with the data it makes; the check (_audit/labels-id.mjs) runs that file.

   The engine writes its lines in English ("CPF, employee share (20%)"). The Indonesian
   for each comes from the country pages' content files (content/<slug>.id.json,
   lineLabels: English -> Indonesian), so one translation serves the country page and the
   calculator. A label is matched as a template: its numbers (and in the United States
   its state's name) are taken out, so one entry words every rate, cap and state the
   engine can write, and the figures go back in as the calculator shows them (1,234.5,
   as in the form). The sums are never touched: only the words change. */
function gscLabelsRuntime(){
  'use strict';
  var NUM = /\d+(?:,\d{3})*(?:\.\d+)?/g;
  var LETTERS = 'ABCDEFGH';
  function esc(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  // The key of a text: its numbers become {0}, {1} ..., the names given become {A}, {B} ...
  function parts(text, names){
    var nums = [], found = [];
    var key = String(text).replace(NUM, function(m){ nums.push(m); return '{' + (nums.length - 1) + '}'; });
    if(names && names.length){
      var re = new RegExp('\\b(' + names.slice().sort(function(a, b){ return b.length - a.length; }).map(esc).join('|') + ')\\b', 'g');
      key = key.replace(re, function(m){ found.push(m); return '{' + LETTERS[found.length - 1] + '}'; });
    }
    return { key: key, nums: nums, names: found };
  }
  function fill(tpl, p){
    return tpl.replace(/\{(\d+|[A-H])\}/g, function(m, k){
      var v = /\d/.test(k) ? p.nums[+k] : p.names[LETTERS.indexOf(k)];
      return v == null ? m : v;
    });
  }
  // data: { names: { CC: [...] }, map: { CC: { key: template }, '*': {...} }, lit: { CC: { text: text } } }
  // tr(text, cc) is the Indonesian, or null when there is none.
  function make(data){
    function look(cc, key){
      var t = (data.map[cc] || {})[key];
      return t == null ? (data.map['*'] || {})[key] : t;
    }
    return function tr(text, cc){
      if(text == null || text === '') return text;
      var lit = (data.lit[cc] || {})[text];
      if(lit == null) lit = (data.lit['*'] || {})[text];
      if(lit != null) return lit;
      var p = parts(text, data.names[cc]), t = look(cc, p.key);
      if(t == null && !/[A-Za-z]/.test(p.key.replace(/\{[^}]*\}/g, ''))) return text;   // figures alone (a year): nothing to word
      if(t == null && data.names[cc]){ p = parts(text); t = look(cc, p.key); }
      return t == null ? null : fill(t, p);
    };
  }
  return { parts: parts, fill: fill, make: make };
}
// @end-runtime
if(typeof module !== 'undefined' && module.exports) module.exports = gscLabelsRuntime();
