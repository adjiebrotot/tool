/* Analytics consent (Google Consent Mode).
 *
 * Each page's gtag snippet sets the defaults before Analytics loads: Analytics
 * cookies are off in the EEA, the UK and Switzerland (Google decides the region
 * from the visitor's IP address) and on elsewhere; advertising storage is off
 * everywhere. A choice saved here is applied by that snippet on the next load.
 *
 * This file asks the question. The banner shows to a visitor with no saved
 * choice whose time zone is in Europe, the browser's only hint of the region.
 * A visitor in the region it misses is still covered: their Analytics stays
 * cookieless by default. The Privacy Policy's "Cookie settings" button calls
 * AbtConsent.open() so anyone can change their choice later.
 */
(function () {
  var KEY = 'abt-consent';

  var TEXT = {
    en: {
      body: 'I use Google Analytics cookies to count visits and see which tools are used. Nothing you type in a tool is included. Is that OK?',
      privacy: 'Privacy Policy',
      accept: 'Accept',
      decline: 'Decline'
    },
    id: {
      body: 'Saya memakai cookie Google Analytics untuk menghitung kunjungan dan melihat alat mana yang dipakai. Apa pun yang Anda ketik di alat tidak ikut terkirim. Bolehkah?',
      privacy: 'Kebijakan Privasi',
      accept: 'Terima',
      decline: 'Tolak'
    }
  };

  function saved() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function save(choice) {
    try { localStorage.setItem(KEY, choice); } catch (e) {}
    if (typeof window.gtag === 'function') window.gtag('consent', 'update', { analytics_storage: choice });
    if (choice === 'denied') clearAnalyticsCookies();
  }

  // Declining removes the _ga cookies a past "Accept" left behind.
  function clearAnalyticsCookies() {
    var host = location.hostname;
    var domains = ['', host, '.' + host, '.' + host.split('.').slice(-2).join('.')];
    document.cookie.split(';').forEach(function (c) {
      var name = c.split('=')[0].trim();
      if (!/^_ga/.test(name)) return;
      domains.forEach(function (d) {
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + (d ? '; domain=' + d : '');
      });
    });
  }

  function inEurope() {
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    return /^Europe\//.test(tz) ||
      /^(Atlantic\/(Reykjavik|Canary|Madeira|Azores|Faroe)|Arctic\/Longyearbyen|Asia\/(Nicosia|Famagusta))$/.test(tz);
  }

  // The Privacy Policy sits at the site root; this file's own URL says where that is.
  var root = (document.currentScript && document.currentScript.src || '').replace(/consent\.js(\?.*)?$/, '');

  function open() {
    if (document.getElementById('abtConsent')) return;
    var lang = (document.documentElement.lang || 'en').slice(0, 2) === 'id' ? 'id' : 'en';
    var t = TEXT[lang];
    var css = document.createElement('style');
    css.textContent =
      '#abtConsent{position:fixed;left:16px;right:16px;bottom:16px;z-index:10000;max-width:520px;margin:0 auto;' +
      'padding:14px 16px;border-radius:14px;border:1px solid var(--border,#DCE3F0);' +
      'background:var(--panel,#fff);color:var(--text,#14203A);box-shadow:0 8px 28px rgba(0,0,0,.18);' +
      'font:400 .85rem/1.5 "DM Sans",system-ui,sans-serif;}' +
      '#abtConsent p{margin:0 0 10px;}' +
      '#abtConsent a{color:var(--accent-strong,var(--accent,#2563EB));text-decoration:none;}' +
      '#abtConsent a:hover{text-decoration:underline;}' +
      '#abtConsent .abt-consent-row{display:flex;gap:8px;justify-content:flex-end;}' +
      '#abtConsent button{font:600 .82rem/1 "DM Sans",system-ui,sans-serif;padding:8px 14px;border-radius:999px;cursor:pointer;' +
      'border:1px solid var(--border,#DCE3F0);background:transparent;color:inherit;}' +
      '#abtConsent button[data-choice="granted"]{background:var(--accent,#2563EB);border-color:var(--accent,#2563EB);color:#fff;}';
    var box = document.createElement('div');
    box.id = 'abtConsent';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-live', 'polite');
    box.setAttribute('aria-label', 'Cookies');
    box.innerHTML =
      '<p>' + t.body + ' <a href="' + root + 'privacy/' + (lang === 'id' ? 'id/' : '') + '">' + t.privacy + '</a></p>' +
      '<div class="abt-consent-row">' +
      '<button type="button" data-choice="denied">' + t.decline + '</button>' +
      '<button type="button" data-choice="granted">' + t.accept + '</button>' +
      '</div>';
    box.addEventListener('click', function (e) {
      var choice = e.target.getAttribute && e.target.getAttribute('data-choice');
      if (!choice) return;
      save(choice);
      box.remove();
      css.remove();
    });
    document.head.appendChild(css);
    document.body.appendChild(box);
  }

  window.AbtConsent = { open: open };

  // Not inside an embed's frame, and only until a choice is saved.
  if (window.top === window.self && !saved() && inEurope()) {
    if (document.body) open();
    else document.addEventListener('DOMContentLoaded', open);
  }
})();
