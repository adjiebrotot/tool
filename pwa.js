/* Makes the site an installable app (PWA): registers the service worker and
 * drives any [data-pwa-install] button on the page. Loaded by every page.
 *
 * Chrome and Edge fire beforeinstallprompt when the site can be installed; the
 * button then opens the browser's own install dialog. iOS has no such event,
 * so there the button explains the Share > Add to Home Screen route instead.
 * Nothing shows once the app is already running installed.
 */
(function () {
  if (!('serviceWorker' in navigator)) return;
  var script = document.currentScript;
  var root = script ? new URL('.', script.src) : new URL('/', location.href);

  window.addEventListener('load', function () {
    navigator.serviceWorker.register(new URL('sw.js', root).href, { scope: root.pathname })
      .catch(function () {});
  });

  var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var deferred = null;

  function buttons() { return document.querySelectorAll('[data-pwa-install]'); }
  function show(on) { buttons().forEach(function (b) { b.hidden = !on; }); }

  window.addEventListener('beforeinstallprompt', function (e) {
    deferred = e;
    show(true);
  });
  window.addEventListener('appinstalled', function () {
    deferred = null;
    show(false);
  });

  document.addEventListener('DOMContentLoaded', function () {
    if (standalone) return show(false);
    if (ios) show(true);
    buttons().forEach(function (b) {
      b.addEventListener('click', function () {
        if (deferred) {
          deferred.prompt();
          deferred.userChoice.finally(function () { deferred = null; show(false); });
        } else if (ios) {
          var hint = document.getElementById(b.getAttribute('aria-controls'));
          if (hint) hint.hidden = !hint.hidden;
          b.setAttribute('aria-expanded', hint && !hint.hidden ? 'true' : 'false');
        }
      });
    });
  });
})();
