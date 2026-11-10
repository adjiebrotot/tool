/* Global Income Tax Calculator, jurisdiction pages (<slug>/ and <slug>/id/, written by
   _ref/jurisdiction-pages.mjs): the sun and moon button. theme.js draws it and keeps the
   choice; this flips the page. Everything else on these pages is plain HTML. */
(function () {
  'use strict';
  var b = document.getElementById('themeToggle');
  if (b) b.addEventListener('click', function () { document.body.classList.toggle('light'); });
})();
