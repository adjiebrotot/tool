/* ──────────────────────────────────────────────────────────────────────────
   Shared Design System — common formatting helpers
   Included by tools via <script src="../shared.js"></script>
   (load before the tool's own script.js)
   ────────────────────────────────────────────────────────────────────────── */
(function(global){
  function formatThousands(value, opts){
    opts = opts || {};
    var maxDecimals = opts.maxDecimals || 0;
    var allowNegative = !!opts.allowNegative;
    var s = String(value == null ? '' : value);
    var neg = allowNegative && /^\s*-/.test(s);
    if (maxDecimals <= 0) {
      var n = parseInt(s.replace(/[^0-9]/g,''), 10) || 0;
      var out = n.toLocaleString('en-US');
      return (neg && n !== 0) ? '-' + out : out;
    }
    s = s.replace(/[^0-9.]/g,'');
    var dot = s.indexOf('.');
    var intPart, decPart;
    if (dot === -1) { intPart = s; decPart = null; }
    else {
      intPart = s.slice(0, dot);
      decPart = s.slice(dot+1).replace(/\./g,'').slice(0, maxDecimals);
    }
    intPart = intPart.replace(/^0+(?=\d)/, '');
    if (intPart === '') intPart = '0';
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    var out = intPart + (decPart !== null ? '.' + decPart : '');
    if (neg && !/^0(\.0*)?$/.test(out)) out = '-' + out;
    return out;
  }

  function parseFormatted(value){
    var cleaned = String(value == null ? '' : value).replace(/,/g,'').trim();
    var n = parseFloat(cleaned);
    return isFinite(n) ? n : 0;
  }

  function liveFormat(el, opts){
    var pos = el.selectionStart;
    var oldLen = el.value.length;
    el.value = formatThousands(el.value, opts);
    var newLen = el.value.length;
    var newPos = Math.max(0, pos + (newLen - oldLen));
    if (document.activeElement === el) el.setSelectionRange(newPos, newPos);
  }

  function attachCurrencyInput(el, opts){
    opts = opts || {};
    el.addEventListener('input', function(){
      liveFormat(this, opts);
      if (typeof opts.onChange === 'function') opts.onChange(this);
    });
    el.addEventListener('blur', function(){
      liveFormat(this, opts);
      if (typeof opts.onChange === 'function') opts.onChange(this);
    });
  }

  global.SharedFmt = {
    formatThousands: formatThousands,
    parseFormatted: parseFormatted,
    liveFormat: liveFormat,
    attachCurrencyInput: attachCurrencyInput
  };
})(window);
