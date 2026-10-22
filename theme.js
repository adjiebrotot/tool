/* ──────────────────────────────────────────────────────────────────────────
   Day or night, the same on www.adjiebrotots.com, the blog and every tool.

   Load it straight after <body> (not deferred), so the page is painted in the
   right theme the first time. The choice, in order:
     1. the reader's own pick, kept in the cookie abt-theme on
        .adjiebrotots.com, so picking night on www carries to the blog and the
        tools (a copy sits in localStorage for local testing, where the
        cookie cannot be set);
     2. else the tool's own old key (pf-theme, fvc-theme, jv-theme), so a
        reader who chose before this file existed keeps that choice (read
        once, before this file has ever written those keys itself);
     3. else the device's setting (prefers-color-scheme).
   A tool keeps its own toggle and its own click handler (they re-draw the
   charts). This file only sets the starting class, keeps the old keys in step
   so a tool's own start-up code agrees with it, saves a reader's click, and
   draws the toggle as the round sun and moon the other two sites use.
   Inside an embed (#embed=… in a frame) it does nothing: the embedding page
   asks for its theme, and that is never saved as the reader's choice.
   ────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var KEY = 'abt-theme';
  var LEGACY = ['pf-theme', 'fvc-theme', 'jv-theme'];
  var body = document.body;
  if (!body) return;
  if (/(?:^#|&)embed=/.test(location.hash) && window.self !== window.top) return;

  var SYNCED = 'abt-theme-synced';
  function ok(v) { return v === 'light' || v === 'dark' ? v : null; }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function write(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function saved() {
    var m = /(?:^|;\s*)abt-theme=(light|dark)/.exec(document.cookie);
    if (m) return m[1];
    var v = ok(read(KEY));
    if (v) return v;
    // Once this file has written the old keys they only echo its own guess.
    if (read(SYNCED)) return null;
    for (var i = 0; i < LEGACY.length; i++) { v = ok(read(LEGACY[i])); if (v) return v; }
    return null;
  }

  function save(t) {
    var host = location.hostname, shared = /(^|\.)adjiebrotots\.com$/.test(host);
    document.cookie = KEY + '=' + t + '; max-age=31536000; path=/; SameSite=Lax' +
      (shared ? '; domain=adjiebrotots.com' : '') + (location.protocol === 'https:' ? '; Secure' : '');
    write(KEY, t);
    for (var i = 0; i < LEGACY.length; i++) write(LEGACY[i], t);
  }

  /* Most tools are dark until body.light; the JSON Visualiser is the other way
     round (body.dark over its light default) and says so with data-dark-class. */
  var darkClass = body.getAttribute('data-dark-class');
  function current() {
    if (darkClass) return body.classList.contains(darkClass) ? 'dark' : 'light';
    return body.classList.contains('light') ? 'light' : 'dark';
  }
  function apply(t) {
    if (darkClass) body.classList.toggle(darkClass, t === 'dark');
    else body.classList.toggle('light', t === 'light');
  }

  var pick = saved();
  var want = pick || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  apply(want);
  // A reader's old pick becomes the shared one.
  if (pick && !ok(read(KEY))) save(pick);
  // The tools' own start-up code reads these; keep them saying the same thing.
  for (var i = 0; i < LEGACY.length; i++) write(LEGACY[i], want);
  write(SYNCED, '1');

  var root = document.documentElement;
  function mark() { root.setAttribute('data-abt-theme', current()); }
  mark();
  new MutationObserver(mark).observe(body, { attributes: true, attributeFilter: ['class'] });

  var ID = (root.lang || '').slice(0, 2) === 'id';
  var SUN = '<svg class="ico-sun" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4.4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>';
  var MOON = '<svg class="ico-moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';

  function draw(btn) {
    if (btn.firstElementChild && btn.firstElementChild.classList.contains('ico-sun') && btn.childNodes.length === 2) return;
    btn.innerHTML = SUN + MOON;
  }
  function label(btn) {
    var dark = current() === 'dark';
    var text = ID ? (dark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap') : (dark ? 'Switch to day' : 'Switch to night');
    btn.setAttribute('aria-label', text);
    btn.title = text;
  }

  function upgrade() {
    var btns = document.querySelectorAll('#themeToggle, #themeBtn');
    Array.prototype.forEach.call(btns, function (btn) {
      btn.classList.add('btn-theme', 'theme-ico');
      draw(btn);
      label(btn);
      // A tool's handler writes "Dark" or "Light" into the button after each
      // click; put the icons back and say what the next click does.
      new MutationObserver(function () { draw(btn); label(btn); }).observe(btn, { childList: true, characterData: true, subtree: true });
      new MutationObserver(function () { label(btn); }).observe(body, { attributes: true, attributeFilter: ['class'] });
      // Save only what a reader did (a click from code, such as an embed
      // asking for its theme, is not a choice).
      btn.addEventListener('click', function (e) {
        if (!e.isTrusted) return;
        setTimeout(function () { save(current()); }, 0);
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', upgrade);
  else upgrade();
})();
