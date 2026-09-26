/* Makes the site an installable app (PWA): registers the service worker and
 * shows any [data-pwa-install] banner on the page. Loaded by every page.
 *
 * Chrome and Edge fire beforeinstallprompt when the site can be installed; the
 * banner's [data-pwa-install-go] link then opens the browser's own install
 * dialog. iOS has no such event, so there the banner (data-mode="ios") gives
 * the Share > Add to Home Screen route instead.
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

  function banners() { return document.querySelectorAll('[data-pwa-install]'); }
  function show(mode) {
    banners().forEach(function (b) {
      b.hidden = !mode;
      if (mode) b.dataset.mode = mode;
    });
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    deferred = e;
    if (!standalone) show('prompt');
  });
  window.addEventListener('appinstalled', function () {
    deferred = null;
    show(null);
  });

  document.addEventListener('DOMContentLoaded', function () {
    if (standalone) return show(null);
    if (ios) show('ios');
    document.querySelectorAll('[data-pwa-install-go]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!deferred) return;
        deferred.prompt();
        deferred.userChoice.finally(function () { deferred = null; show(null); });
      });
    });
  });
})();
