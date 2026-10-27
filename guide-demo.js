/* A GUIDE'S LIVE DEMO: the page a tool's guide plays (<tool>/guides/, guide-live.js) is the
   tool itself, opened in a frame as <tool>/?demo. A tool with such a guide asks for this file
   first thing in its <head>, and only there (one inline line, so a reader's own visit never
   fetches it):

     <script>if(self!==top&&/[?&]demo(&|$)/.test(location.search))document.write('<script src="../guide-demo.js"><\/script>')</script>

   In the demo the tool leaves the reader alone:
   - Storage: localStorage is a new one in memory for this page load, filled by the guide from
     its frame's data-storage (the theme, the tour already seen, no consent question), so the
     tool never opens the reader's saved work and never writes over it, their tour, theme or
     consent. A guide checks localStorage.__demo before it plays, and plays nothing without it.
   - Analytics: the frame is not a visit (the guide page around it was).
   - The guide page: focus() takes the keyboard from the page only when the guide asks
     (window.__demoFocus, a field it types into) or a reader is already in the frame, and it
     and scrollIntoView() move only the frame, so the guide a reader is reading never jumps.
   - Dialogs: confirm() says yes; alert(), prompt() and window.open() do nothing.
   - Files: a file the tool saves (an a[download] it clicks) is saved only when the reader's own
     hand asked for it a moment ago (trying the tool, paused), never for the guide's pointer.
   - Pointer capture works for the guide's own pointer. */
(function () {
  'use strict';
  if (window.self === window.top || !/[?&]demo(?:&|$)/.test(location.search)) return;
  window.ABT_DEMO = true;
  window['ga-disable-G-VYTV157ST0'] = true;

  var data = Object.create(null);
  try {
    var seed = JSON.parse(window.frameElement.getAttribute('data-storage') || '{}');
    Object.keys(seed).forEach(function (k) { data[k] = String(seed[k]); });
  } catch (e) { /* a frame we cannot read: start empty */ }
  var store = {
    __demo: true,
    getItem: function (k) { k = String(k); return k in data ? data[k] : null; },
    setItem: function (k, v) { data[String(k)] = String(v); },
    removeItem: function (k) { delete data[String(k)]; },
    clear: function () { data = Object.create(null); },
    key: function (i) { var ks = Object.keys(data); return i >= 0 && i < ks.length ? ks[i] : null; },
    get length() { return Object.keys(data).length; }
  };
  try { Object.defineProperty(window, 'localStorage', { configurable: true, get: function () { return store; } }); } catch (e) {}

  // Focus without scrolling (the browser would scroll the guide to the frame too), and only
  // when the frame may have the keyboard.
  [window.HTMLElement, window.SVGElement].forEach(function (C) {
    if (!C || !C.prototype.focus) return;
    var focus = C.prototype.focus;
    C.prototype.focus = function (o) {
      if (!window.__demoFocus && !document.hasFocus()) return;
      var opts = {};
      if (o && typeof o === 'object') for (var k in o) opts[k] = o[k];
      opts.preventScroll = true;
      return focus.call(this, opts);
    };
  });
  // Scrolled into view in the frame, at once, with the guide put back where it was.
  var intoView = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (o) {
    var p = window.parent, x = p.pageXOffset, y = p.pageYOffset, opts = { behavior: 'auto' };
    if (o && typeof o === 'object') { for (var k in o) if (k !== 'behavior') opts[k] = o[k]; }
    else opts.block = o === false ? 'end' : 'start';
    intoView.call(this, opts);
    if (p.pageXOffset !== x || p.pageYOffset !== y) p.scrollTo(x, y);
  };

  // The guide's pointer (pointerId 31) has no real pointer behind it, so the browser would refuse
  // to capture it: the capture is kept here instead, and the guide sends the moves and the
  // release to it, as a browser does.
  var EP = Element.prototype, setCap = EP.setPointerCapture, relCap = EP.releasePointerCapture, hasCap = EP.hasPointerCapture;
  if (setCap) {
    EP.setPointerCapture = function (id) { if (id === 31) { window.__demoCapture = this; return; } return setCap.call(this, id); };
    EP.releasePointerCapture = function (id) { if (id === 31) { if (window.__demoCapture === this) window.__demoCapture = null; return; } return relCap.call(this, id); };
    EP.hasPointerCapture = function (id) { return id === 31 ? window.__demoCapture === this : hasCap.call(this, id); };
  }

  // A save starts from a click, but may finish a little later (a zip being made): a reader's
  // press or key in the last few seconds counts as theirs.
  var hand = 0, HAND_MS = 10000;
  ['pointerdown', 'keydown'].forEach(function (t) { window.addEventListener(t, function (e) { if (e.isTrusted) hand = Date.now(); }, true); });
  var theirs = function () { return Date.now() - hand < HAND_MS; };
  var aClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (this.hasAttribute('download') && !theirs()) return; return aClick.call(this); };
  window.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[download]');
    if (a && !e.isTrusted && !theirs()) e.preventDefault();
  }, true);

  window.confirm = function () { return true; };
  window.alert = function () {};
  window.prompt = function () { return null; };
  window.open = function () { return null; };
})();
