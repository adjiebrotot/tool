/* Global Income Tax Calculator, jurisdiction pages (<slug>/ and <slug>/id/, written by
   _ref/jurisdiction-pages.mjs): the sun and moon button. theme.js draws it and keeps the
   choice; this flips the page. It also opens a "Tax in <place>" accordion when a link
   (#tax-in-california) or a footnote's back link points inside it. Everything else on
   these pages is plain HTML. */
(function () {
  'use strict';
  var b = document.getElementById('themeToggle');
  if (b) b.addEventListener('click', function () { document.body.classList.toggle('light'); });
  function openTarget() {
    var id = decodeURIComponent(location.hash.slice(1));
    var el = id && document.getElementById(id);
    var d = el && el.closest ? el.closest('details') : null;
    if (d && !d.open) { d.open = true; el.scrollIntoView(); }
  }
  window.addEventListener('hashchange', openTarget);
  openTarget();
})();
