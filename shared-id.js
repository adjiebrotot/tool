/* shared-id.js — Indonesian number format for the Indonesian pages that load it.

   Loaded only by a tool's id/ page (added by _ref/bake-id.mjs), after shared.js and before the
   tool's script.js. It switches SharedNum (shared.js) from English to Indonesian: a reader sees
   and types Rp 250.000.000 and 8,87%, with "." for thousands and "," for decimals.

   What does NOT change is what is stored. The mini cache, a scenario file, a Share link, an AI
   link, an embed and the page's own state (a tool's rows, its defaults) keep the English form
   ("250,000,000", "8.87") on both pages, so a value saved on either page opens as the same number
   on the other, and everything saved before this file existed still opens. The conversion sits at
   the one place a figure crosses between the field and the saved form:

     SharedNum.read(el)       the field's text -> canonical ("8,87" -> "8.87")
     SharedNum.write(el, v)   canonical -> the field's text
     SharedNum.show(s)        canonical text -> the page's ("1,234.5" -> "1.234,5"), for output
     SharedNum.typed(s)       what a reader typed or pasted -> canonical
     SharedNum.text(s)        every canonical figure inside a sentence -> the page's

   shared.js calls these in formatThousands, parseFormatted, liveFormat, Persist, Share, the AI
   link and SharedBounds; a tool's script.js calls them where it reads or writes a field and
   where it words a figure. English pages never load this file, so they behave as they always did.

   Which fields: a text input that shows a figure, that is one with class fmt-num, fmt-pct or
   money-input, data-grouped, data-money="true", data-num, an inputmode of numeric or decimal, or
   one wired by SharedFmt.attachCurrencyInput. A tool names more with SharedNum.fields(selector).

   Typing: "." typed in a field is read as the decimal comma (a numeric keypad, English habit),
   and a pasted figure is read by its shape ("1,234.56" and "1.234,56" both mean 1234.56; "250.000"
   is 250000; "2.5" is 2.5). Dots already in the field are thousands separators.            */
(function(global){
  'use strict';
  var NUM = global.SharedNum;
  if(!NUM || NUM.id) return;
  if(!/^id\b/i.test(document.documentElement.getAttribute('lang') || '')) return;

  var SEL = 'input.fmt-num, input.fmt-pct, input.money-input, input[data-grouped], input[data-money="true"], input[data-num]';
  var extra = [];

  // "," and "." trade places. Its own inverse, so one function converts both ways.
  function swap(s){
    return String(s).replace(/[.,]/g, function(c){ return c === '.' ? ',' : '.'; });
  }

  function field(el){
    if(!el || el.tagName !== 'INPUT') return false;
    var t = (el.type || 'text').toLowerCase();
    if(t !== 'text' && t !== 'tel' && t !== 'search') return false;
    if(el.__abtCurrency || el.matches(SEL) || /^(numeric|decimal)$/.test(el.getAttribute('inputmode') || '')) return true;
    for(var i = 0; i < extra.length; i++) if(el.matches(extra[i])) return true;
    return false;
  }

  // What is in a field, or was typed or pasted into it, as canonical text. The first comma is the
  // decimal one; every dot is a thousands separator.
  function typed(s){
    s = String(s == null ? '' : s);
    var c = s.indexOf(',');
    if(c < 0) return s.replace(/\./g, '');
    return s.slice(0, c).replace(/\./g, '') + '.' + s.slice(c + 1).replace(/[.,]/g, '');
  }

  // Each canonical figure inside a sentence ("125,140", "17.4", "5,101.20") in Indonesian form.
  function text(s){
    return String(s == null ? '' : s).replace(/\d+(?:,\d{3})*(?:\.\d+)?/g, swap);
  }

  NUM.id = true;
  NUM.show = swap;
  NUM.typed = typed;
  NUM.text = text;
  NUM.field = field;
  NUM.read = function(el){ return field(el) ? swap(el.value) : el.value; };
  NUM.write = function(el, v){ el.value = field(el) && v != null ? swap(String(v)) : v; };
  NUM.hasGroup = function(s){ return /\./.test(s); };
  NUM.fields = function(selector){ if(selector && extra.indexOf(selector) < 0) extra.push(selector); };

  // A figure pasted in either convention, as digits with at most one decimal comma.
  function pasted(raw){
    var s = String(raw).replace(/[^\d.,\-−]/g, '');
    var neg = /^[-−]/.test(s) ? '-' : '';
    s = s.replace(/[-−]/g, '');
    var dots = (s.match(/\./g) || []).length, commas = (s.match(/,/g) || []).length;
    if(!dots && !commas) return null;
    var dec = null;                                   // the index of the decimal separator
    if(dots && commas) dec = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
    else if(commas === 1) dec = s.indexOf(',');       // "1,5" is one and a half here
    else if(dots === 1 && !/^\d{1,3}\.\d{3}$/.test(s)) dec = s.indexOf('.');   // "2.5", not "250.000"
    var out = dec == null ? s.replace(/[.,]/g, '') : s.slice(0, dec).replace(/[.,]/g, '') + ',' + s.slice(dec + 1).replace(/[.,]/g, '');
    return neg + out;
  }

  // The initial values in index.html are canonical; show them in the page's form before the tool reads them.
  function convertInitial(){
    var els = document.querySelectorAll('input');
    for(var i = 0; i < els.length; i++){
      var el = els[i];
      if(field(el) && el.value && !el.__idShown){ el.value = swap(el.value); el.__idShown = true; }
    }
  }
  convertInitial();

  // A "." typed into a figure is the decimal comma, unless the field has one already.
  document.addEventListener('input', function(e){
    var el = e.target;
    if(e.inputType !== 'insertText' || e.data !== '.' || !field(el)) return;
    var pos = el.selectionStart, v = el.value;
    if(pos == null || v.charAt(pos - 1) !== '.') return;
    var rest = v.slice(0, pos - 1) + v.slice(pos);
    var again = rest.indexOf(',') >= 0;
    el.value = again ? rest : v.slice(0, pos - 1) + ',' + v.slice(pos);
    var at = again ? pos - 1 : pos;
    try { el.setSelectionRange(at, at); } catch(err){}
  }, true);

  // A pasted figure keeps its meaning whichever way its separators were written.
  document.addEventListener('paste', function(e){
    var el = e.target;
    if(!field(el) || !e.clipboardData) return;
    var out = pasted(e.clipboardData.getData('text'));
    if(out == null) return;
    e.preventDefault();
    try { el.setRangeText(out, el.selectionStart, el.selectionEnd, 'end'); } catch(err){ el.value = out; }
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: out }));
  }, true);
})(typeof window !== 'undefined' ? window : globalThis);
