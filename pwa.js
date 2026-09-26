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

  var registration = null;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register(new URL('sw.js', root).href, { scope: root.pathname })
      .then(function (reg) { registration = reg; })
      .catch(function () {});
  });

  /* An installed app can sit open in the background for days, showing the
   * page as it was when it loaded. GitHub Pages stamps every file of a deploy
   * with the deploy time (Last-Modified), so when the app comes back to the
   * foreground (or every half hour while in view) ask the server for this
   * page's stamp; if it is newer than the one this page loaded with, offer a
   * reload. Online only, and never more than once every 10 minutes. */
  var loadedAt = Date.parse(document.lastModified);
  var lastCheck = Date.now();
  var CHECK_GAP = 10 * 60 * 1000;

  function checkForUpdate() {
    if (document.visibilityState !== 'visible' || !navigator.onLine) return;
    if (Date.now() - lastCheck < CHECK_GAP) return;
    lastCheck = Date.now();
    if (registration) registration.update().catch(function () {});
    fetch(location.href, { method: 'HEAD', cache: 'no-store' }).then(function (res) {
      var stamp = Date.parse(res.headers.get('Last-Modified'));
      if (res.ok && stamp && loadedAt && stamp - loadedAt > 1000) showReload();
    }).catch(function () {});
  }

  function showReload() {
    if (document.getElementById('pwa-update')) return;
    var bar = document.createElement('div');
    bar.id = 'pwa-update';
    bar.setAttribute('role', 'status');
    bar.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483000;' +
      'display:flex;align-items:center;gap:12px;max-width:calc(100% - 32px);padding:8px 14px;' +
      'border:1px solid var(--border,#d0d7e2);border-radius:10px;background:var(--panel,#fff);' +
      'color:var(--text,#2d3436);box-shadow:0 4px 20px rgba(0,0,0,.15);font:inherit;font-size:0.9rem;';
    bar.innerHTML = '<span>A newer version is out.</span>' +
      '<button type="button" style="padding:0;border:0;background:none;font:inherit;font-weight:700;' +
      'color:var(--accent-strong,var(--accent,#3a71c8));text-decoration:underline;cursor:pointer">Reload</button>';
    bar.querySelector('button').addEventListener('click', function () { location.reload(); });
    document.body.appendChild(bar);
  }

  document.addEventListener('visibilitychange', checkForUpdate);
  window.addEventListener('online', checkForUpdate);
  setInterval(checkForUpdate, 30 * 60 * 1000);

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
