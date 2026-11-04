/* The Buy Me a Coffee widget, fitted to the site.
 *
 * The widget (cdnjs.buymeacoffee.com widget.prod.min.js, its own <script> tag on
 * every page) draws a 64px orange circle at the bottom right with inline styles
 * and z-index 9999, over everything. This file, loaded with `defer` next to it:
 *
 *  - dresses it as the site's primary sticker button: the accent fill, the ink
 *    outline and the hard offset shadow, 52px, in both themes (the tokens of
 *    light.css / dark.css, with the light values as fallback);
 *  - puts it 16px from the bottom-right corner, as every other floating control,
 *    and under dialogs, tours and the consent banner (z-index 50);
 *  - keeps clear of what is already there: when a fixed bar, toast, banner or
 *    panel (or, on an app page that does not scroll, its footer bar) takes the
 *    bottom right, the button goes to the bottom left if that corner is free,
 *    else it rises above whatever is in the way; when tall panels fill both
 *    corners it takes the nearest free spot along the bottom;
 *  - on a canvas-style tool (the bmc.js <script> carries data-bmc-drag), lets the
 *    reader drag it anywhere; the spot is kept for that page in localStorage;
 *  - on a tool whose footer is a bar floating over the canvas (data-bmc-dock
 *    names it, as the World Clock's .wc-foot), sits inside that bar at its right
 *    end whenever the bar is open and wide enough, and floats as above otherwise;
 *  - leaves blank room under the footer of a page that scrolls, so the end of
 *    the page is never under it;
 *  - stays out of a tool embedded on another site;
 *  - for a reader in Indonesia (the browser's time zone is WIB, WITA or WIT),
 *    opens Trakteer instead of Buy Me a Coffee: the same circle, with
 *    Trakteer's coffee cup, opening Trakteer's tip modal in a full-screen
 *    iframe, as Trakteer's own overlay script does (without its long pill
 *    button). `?tip=trakteer` or `?tip=bmc` in the address forces either one.
 *
 * The tool site (tool.adjiebrotots.com/bmc.js) and the blog (assets/js/bmc.js)
 * keep the same file: change both together.
 */
(function () {
  'use strict';
  var D = document, R = D.documentElement;
  var EDGE = 16, SIZE = 52, GAP = 12, RESERVE = EDGE + SIZE + EDGE, PANEL_MIN = 380;
  var me = D.currentScript || D.querySelector('script[src$="bmc.js"]');
  var DRAG = !!(me && me.hasAttribute('data-bmc-drag'));
  var DOCK = me && me.getAttribute('data-bmc-dock'), DS = 32; /* the button's size inside a footer bar */
  var KEY = 'bmc-pos:' + location.pathname;

  /* Trakteer for a reader in Indonesia, Buy Me a Coffee for everyone else. */
  var TRAKTEER = {
    url: 'https://trakteer.id/v1/adjiebrotot/tip/embed/modal',
    icon: 'https://edge-cdn.trakteer.id/images/mix/coffee.png',
    title: 'Dukung saya di Trakteer'
  };
  var TIP = (function () {
    var m = /[?&]tip=(trakteer|bmc)\b/.exec(location.search);
    if (m) return m[1] === 'trakteer';
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      return /^Asia\/(Jakarta|Pontianak|Makassar|Ujung_Pandang|Jayapura)$/.test(tz);
    } catch (e) { return false; }
  })();
  var TITLE = TIP ? TRAKTEER.title : 'Buy me a coffee';

  var css = D.createElement('style');
  css.id = 'bmc-fit';
  if (R.classList.contains('abt-embed') || /(?:^#|&)embed=/.test(location.hash) && window.self !== window.top) {
    css.textContent = '#bmc-wbtn,#bmc-note,#bmc-iframe{display:none!important;}';
    (D.head || R).appendChild(css);
    return;
  }
  var R_ = 'max(' + EDGE + 'px,env(safe-area-inset-right))', L_ = 'max(' + EDGE + 'px,env(safe-area-inset-left))';
  var B_ = 'calc(' + EDGE + 'px + env(safe-area-inset-bottom) + var(--bmc-lift,0px))';
  css.textContent =
    '#bmc-wbtn{width:' + SIZE + 'px!important;height:' + SIZE + 'px!important;box-sizing:border-box!important;' +
      'left:auto!important;right:calc(' + R_ + ' + var(--bmc-dx,0px))!important;bottom:' + B_ + '!important;' +
      'background:var(--accent,#3A71C8)!important;border:1.5px solid var(--ink-line,#14203A)!important;' +
      'box-shadow:var(--sticker-accent,2px 2px 0 #14203A)!important;z-index:50!important;' +
      'transition:bottom .25s ease,left .25s ease,right .25s ease,transform .15s ease,box-shadow .15s ease,opacity .2s ease,visibility .2s!important;}' +
    'html.bmc-left #bmc-wbtn{right:auto!important;left:calc(' + L_ + ' + var(--bmc-dx,0px))!important;}' +
    '#bmc-wbtn:hover{transform:translate(-1px,-1px)!important;box-shadow:var(--sticker-accent-hover,3px 3px 0 #14203A)!important;}' +
    '#bmc-wbtn:active{transform:translate(2px,2px)!important;box-shadow:0 0 0 transparent!important;}' +
    '#bmc-wbtn img{width:28px!important;height:28px!important;pointer-events:none;}' +
    '#bmc-wbtn svg path{fill:var(--text-inv,#fff);}' +
    /* Trakteer's red cup reads on a pale circle, not on the accent blue: a light
       blue in both themes, with the same ink outline and sticker shadow. */
    'html.bmc-tr #bmc-wbtn{background:#EAF1FF!important;}' +
    'html.bmc-tr #bmc-wbtn img{width:32px!important;height:32px!important;object-fit:contain;}' +
    'html.bmc-tr-wait #bmc-wbtn{animation:bmc-wait 1s ease-in-out infinite alternate;}' +
    '@keyframes bmc-wait{to{opacity:.55;}}' +
    '#bmc-tr{display:none;position:fixed;inset:0;z-index:9999999;}' +
    '#bmc-tr iframe{width:100%;height:100%;border:0;display:block;background:transparent;}' +
    'html.bmc-drag #bmc-wbtn{touch-action:none;cursor:grab!important;}' +
    'html.bmc-dragging #bmc-wbtn{transition:none!important;cursor:grabbing!important;transform:none!important;box-shadow:var(--sticker-accent-hover,3px 3px 0 #14203A)!important;}' +
    /* The thank-you note beside the button, in the site's card style. */
    '#bmc-note{left:auto!important;right:calc(' + R_ + ' + var(--bmc-dx,0px) + ' + (SIZE + GAP) + 'px)!important;' +
      'bottom:' + B_ + '!important;z-index:49!important;' +
      'max-width:min(260px,calc(100vw - ' + (EDGE * 2 + SIZE + GAP) + 'px))!important;padding:10px 14px!important;' +
      'background:var(--panel-raised,var(--panel,#fff))!important;color:var(--text,#14203A)!important;' +
      'border:1.5px solid var(--ink-line,#14203A)!important;border-radius:var(--radius-md,8px)!important;' +
      'box-shadow:var(--sticker,2px 2px 0 #14203A)!important;font:500 14px/1.45 "DM Sans",system-ui,sans-serif!important;transform-origin:left bottom!important;}' +
    'html:not(.bmc-left) #bmc-note{transform-origin:right bottom!important;}' +
    'html.bmc-left #bmc-note{right:auto!important;left:calc(' + L_ + ' + var(--bmc-dx,0px) + ' + (SIZE + GAP) + 'px)!important;}' +
    'html.bmc-note-flip #bmc-note{display:none!important;}' +
    /* The support panel opens above the button, on its side. */
    '@media (min-width:480px){#bmc-iframe{left:var(--bmc-pl,auto)!important;right:var(--bmc-pr,' + EDGE + 'px)!important;' +
      'bottom:var(--bmc-pb,' + RESERVE + 'px)!important;max-height:calc(100vh - var(--bmc-pb,' + RESERVE + 'px) - 16px)!important;}}' +
    /* Inside a floating footer bar: a smaller button at the bar's right end. */
    '.bmc-dock-host{position:relative!important;box-sizing:border-box!important;min-height:' + (DS + 8) + 'px!important;' +
      'padding-right:' + (DS + 16) + 'px!important;display:flex!important;flex-direction:column!important;justify-content:center!important;}' +
    'html.bmc-docked #bmc-wbtn{position:absolute!important;left:auto!important;right:6px!important;top:50%!important;bottom:auto!important;' +
      'width:' + DS + 'px!important;height:' + DS + 'px!important;margin-top:-' + (DS / 2) + 'px!important;}' +
    'html.bmc-docked #bmc-wbtn img{width:18px!important;height:18px!important;}' +
    'html.bmc-docked #bmc-wbtn svg{width:12px!important;height:12px!important;}' +
    'html.bmc-docked #bmc-note{left:auto!important;right:var(--bmc-nr,' + EDGE + 'px)!important;bottom:var(--bmc-nb,' + RESERVE + 'px)!important;transform-origin:right bottom!important;}' +
    'html.bmc-off #bmc-wbtn,html.bmc-off #bmc-note{opacity:0!important;visibility:hidden!important;pointer-events:none!important;}' +
    '@media (prefers-reduced-motion:reduce){#bmc-wbtn{transition:none!important;}#bmc-wbtn:hover,#bmc-wbtn:active{transform:none!important;}}' +
    '@media print{#bmc-wbtn,#bmc-note,#bmc-iframe,#bmc-tr{display:none!important;}}';
  (D.head || R).appendChild(css);

  var btn, mine = [], footer = null, reserved = 0, queued = false, last = 0, manual = null;

  function isMine(el) {
    for (var i = 0; i < mine.length; i++) if (mine[i] && mine[i].contains(el)) return true;
    return false;
  }
  function pos(el) { return getComputedStyle(el).position; }
  /* Something a reader sees in the corner: text, a picture or a control (not a
     background, a backdrop or a wrapper). */
  var CONTENT = /^(IMG|SVG|CANVAS|VIDEO|BUTTON|INPUT|SELECT|TEXTAREA|IFRAME|PICTURE)$/;
  function isContent(el) {
    if (CONTENT.test(el.tagName.toUpperCase())) return true;
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && /\S/.test(n.nodeValue)) return true;
    return false;
  }
  /* A document page can scroll; an app laid out on the screen (overflow hidden) cannot. */
  function canScroll() {
    var a = getComputedStyle(R).overflowY, b = getComputedStyle(D.body).overflowY;
    return !/hidden|clip/.test(a) && !/hidden|clip/.test(b);
  }

  /* The page's own footer, at the end of the flow (not a fixed bar). */
  function findFooter() {
    var all = D.querySelectorAll('footer'), f = null;
    for (var i = all.length - 1; i >= 0 && !f; i--) {
      var a = all[i], ok = a.offsetParent !== null;
      for (var p = a; ok && p && p !== D.body; p = p.parentElement) { var ps = pos(p); if (ps === 'fixed' || ps === 'absolute' || ps === 'sticky') ok = false; }
      if (ok) f = a;
    }
    return f;
  }

  /* Leave RESERVE px of blank page under the footer of a page that can scroll,
     so the end of the page is never under the button. */
  function reserve() {
    if (!footer || !footer.isConnected) footer = findFooter();
    var want = footer && canScroll() ? RESERVE : 0;
    if (want === reserved || !footer) return;
    if (footer.bmcBase === undefined) footer.bmcBase = parseFloat(getComputedStyle(footer).marginBottom) || 0;
    footer.style.marginBottom = want ? (footer.bmcBase + want) + 'px' : '';
    reserved = want;
  }

  /* What a corner holds at a given lift: the top of the highest thing in the way. */
  function blocker(left, dx, lift, still) {
    var W = R.clientWidth, H = innerHeight, top = Infinity, area = W * H;
    var x0 = left ? EDGE + dx - 6 : W - EDGE - dx - SIZE - 6, x1 = x0 + SIZE + 12, y1 = H - EDGE - lift + 6, y0 = y1 - SIZE - 12;
    for (var x = x0; x <= x1 + 0.5; x += (x1 - x0) / 3) for (var y = y0; y <= y1 + 0.5; y += (y1 - y0) / 3) {
      var hits = D.elementsFromPoint(Math.max(0, Math.min(x, W - 1)), Math.max(0, Math.min(y, H - 1)));
      for (var i = 0; i < hits.length; i++) {
        var el = hits[i];
        if (el === D.body || el === R || isMine(el)) continue;
        if (el.closest && el.closest('svg') && el.tagName.toUpperCase() !== 'SVG') el = el.closest('svg');
        /* On an app page its footer, and a small card or bar floating over the
           canvas, count as a whole, background and all; elsewhere only what
           they show counts. */
        if (!isContent(el) && !(still && (el.closest('footer') || inFloat(el, area)))) continue;
        /* The box that holds it: a fixed bar, toast or panel as a whole. */
        var box = null, page = false;
        for (var p = el; p && p !== D.body; p = p.parentElement) {
          var ps = pos(p);
          if (ps === 'fixed') { var b = p.getBoundingClientRect(); if (b.width * b.height < area * 0.6) box = b; else page = true; break; }
          if (ps === 'absolute' && still && !box) box = p.getBoundingClientRect();
        }
        if (!box && (page || still)) { var fb = el.closest('footer'); box = (fb || el).getBoundingClientRect(); }
        if (!box) continue;
        var r = el.getBoundingClientRect();
        if (r.height > H * 0.45 && r.width > W * 0.45) continue; /* a map or a chart the page is drawn on */
        if (box.top < top) top = box.top;
      }
    }
    return top;
  }
  /* Inside a small positioned card or bar (under a fifth of the screen). */
  function inFloat(el, area) {
    for (var p = el; p && p !== D.body; p = p.parentElement) {
      var ps = pos(p);
      if (ps === 'absolute' || ps === 'fixed') { var b = p.getBoundingClientRect(); return b.width * b.height < area * 0.2; }
    }
    return false;
  }
  /* How far the button must rise in a corner, or Infinity when it cannot fit. */
  function liftFor(left, dx, still) {
    var lift = 0;
    for (var k = 0; k < 3; k++) {
      var top = blocker(left, dx, lift, still);
      if (top === Infinity) return lift;
      lift = Math.max(lift, Math.ceil(innerHeight - top + GAP - EDGE));
      if (lift > innerHeight * 0.45) return Infinity;
    }
    return lift;
  }

  function place(left, dx, lift, off) {
    R.classList.toggle('bmc-left', left);
    R.classList.toggle('bmc-off', off);
    R.style.setProperty('--bmc-dx', dx + 'px');
    R.style.setProperty('--bmc-lift', lift + 'px');
    /* The panel (420px wide) opens above the button when there is room, else
       beside it, full height, on whichever side it fits. */
    var W = R.clientWidth, PW = 420, above = EDGE + lift + SIZE + EDGE;
    var bl = left ? EDGE + dx : W - EDGE - dx - SIZE, br = bl + SIZE, pl, pb;
    if (innerHeight - above >= PANEL_MIN) { pb = above; pl = left ? bl : br - PW; }
    else { pb = EDGE; pl = br + GAP + PW <= W - EDGE ? br + GAP : bl - GAP - PW >= EDGE ? bl - GAP - PW : W - EDGE - PW; }
    pl = Math.max(EDGE, Math.min(pl, W - EDGE - PW));
    R.style.setProperty('--bmc-pb', pb + 'px');
    R.style.setProperty('--bmc-pl', pl + 'px');
    R.style.setProperty('--bmc-pr', 'auto');
    /* The note goes beside the button; with no room beside it, it is left out. */
    R.classList.toggle('bmc-note-flip', R.clientWidth - (EDGE + dx + SIZE + GAP) < 200);
  }

  function clampManual() {
    var W = R.clientWidth, H = innerHeight;
    manual.dx = Math.max(0, Math.min(manual.dx, W - 2 * EDGE - SIZE));
    manual.lift = Math.max(0, Math.min(manual.lift, H - 2 * EDGE - SIZE));
  }

  /* A footer bar has room when it is open (not folded to a tab), wide, and
     more than one line of text tall. */
  function roomy(host) {
    var hr = host.getBoundingClientRect();
    if (!hr.width || hr.width < 300 || hr.bottom > innerHeight + 1) return false;
    var t = Infinity, b = -Infinity;
    for (var c = host.firstElementChild; c; c = c.nextElementSibling) {
      if (c === btn) continue;
      var r = c.getBoundingClientRect();
      if (r.height > 0) { t = Math.min(t, r.top); b = Math.max(b, r.bottom); }
    }
    return b - t >= 26;
  }
  function dock(host) {
    if (btn.parentElement !== host) host.appendChild(btn);
    if (!host.classList.contains('bmc-dock-host')) host.classList.add('bmc-dock-host');
    R.classList.add('bmc-docked'); R.classList.remove('bmc-left', 'bmc-off');
    btn.title = TITLE;
    var W = R.clientWidth, H = innerHeight, br = btn.getBoundingClientRect(), fr = host.getBoundingClientRect(), PW = 420;
    var nb = H - fr.top + GAP;
    R.style.setProperty('--bmc-nr', Math.max(EDGE, W - br.right) + 'px');
    R.style.setProperty('--bmc-nb', nb + 'px');
    R.style.setProperty('--bmc-pb', (H - nb >= PANEL_MIN ? nb : EDGE) + 'px');
    R.style.setProperty('--bmc-pl', Math.max(EDGE, Math.min(br.right - PW, W - EDGE - PW)) + 'px');
    R.style.setProperty('--bmc-pr', 'auto');
    R.classList.toggle('bmc-note-flip', false);
  }
  function undock() {
    if (!R.classList.contains('bmc-docked')) return;
    var host = btn.parentElement;
    D.body.appendChild(btn);
    if (host && host.classList) host.classList.remove('bmc-dock-host');
    R.classList.remove('bmc-docked');
    if (DRAG) btn.title = TITLE + ' (drag to move)';
  }

  function update() {
    queued = false; last = Date.now();
    if (!btn || !btn.isConnected) return;
    if (mine[2] && mine[2].offsetWidth > 0) return; /* the support panel is open */
    if (DOCK) {
      var host = D.querySelector(DOCK);
      if (host && roomy(host)) return dock(host);
      undock();
    }
    reserve();
    if (manual) { clampManual(); place(manual.left, manual.dx, manual.lift, false); return; }
    var still = !canScroll() || R.scrollHeight <= innerHeight + 2;
    var right = liftFor(false, 0, still);
    if (right === 0) return place(false, 0, 0, false);
    var left = liftFor(true, 0, still);
    if (left === 0) return place(true, 0, 0, false);
    if (left !== Infinity || right !== Infinity) return left < right ? place(true, 0, left, false) : place(false, 0, right, false);
    /* Both corners are full (tall panels on both sides): the nearest free spot
       along the bottom, working in from the right. */
    var W = R.clientWidth, best = null;
    for (var dx = SIZE + GAP; dx <= W - 2 * EDGE - SIZE && !best; dx += SIZE + GAP) {
      var l = liftFor(false, dx, still);
      if (l !== Infinity) best = { dx: dx, lift: l };
    }
    if (best) place(false, best.dx, best.lift, false); else place(false, 0, 0, true);
  }
  function soon() {
    if (queued) return;
    queued = true;
    var wait = Math.max(0, 120 - (Date.now() - last));
    setTimeout(function () { requestAnimationFrame(update); }, wait);
  }

  /* Dragging, on a canvas-style tool. A press that moves is a drag, never a click. */
  function draggable() {
    R.classList.add('bmc-drag');
    btn.title = TITLE + ' (drag to move)';
    try { var saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved && typeof saved.dx === 'number') manual = { left: !!saved.left, dx: saved.dx, lift: saved.lift }; } catch (e) {}
    var start = null, moved = false, swallow = false;
    btn.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || R.classList.contains('bmc-docked')) return;
      var r = btn.getBoundingClientRect();
      start = { x: e.clientX, y: e.clientY, l: r.left, t: r.top, id: e.pointerId };
      moved = false;
    });
    addEventListener('pointermove', function (e) {
      if (!start || e.pointerId !== start.id) return;
      var dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!moved && dx * dx + dy * dy < 36) return;
      if (!moved) { moved = true; R.classList.add('bmc-dragging'); try { btn.setPointerCapture(e.pointerId); } catch (er) {} }
      var W = R.clientWidth, H = innerHeight;
      var l = Math.max(EDGE, Math.min(start.l + dx, W - EDGE - SIZE)), t = Math.max(EDGE, Math.min(start.t + dy, H - EDGE - SIZE));
      var isLeft = l + SIZE / 2 < W / 2;
      manual = { left: isLeft, dx: isLeft ? l - EDGE : W - l - SIZE - EDGE, lift: H - t - SIZE - EDGE };
      place(manual.left, manual.dx, manual.lift, false);
      e.preventDefault();
    }, { passive: false });
    function end(e) {
      if (!start || e.pointerId !== start.id) return;
      start = null;
      if (!moved) return;
      R.classList.remove('bmc-dragging');
      swallow = true; setTimeout(function () { swallow = false; }, 400);
      try { localStorage.setItem(KEY, JSON.stringify(manual)); } catch (er) {}
    }
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);
    addEventListener('click', function (e) {
      if (swallow && btn.contains(e.target)) { swallow = false; e.stopPropagation(); e.preventDefault(); }
    }, true);
  }

  /* Trakteer in place of Buy Me a Coffee: the button shows Trakteer's cup and a
     click (caught before the widget's own) opens Trakteer's tip modal. The modal
     page opens itself when it loads, and on a later click when asked to; it says
     when it closes. */
  function trakteer(note) {
    R.classList.add('bmc-tr');
    btn.title = TITLE;
    btn.setAttribute('aria-label', TITLE);
    var img = btn.querySelector('img');
    if (img) { img.src = TRAKTEER.icon; img.alt = 'Trakteer'; }
    var box = null, frame = null;
    function open(e) {
      e.stopImmediatePropagation(); e.preventDefault();
      if (!box) {
        box = D.createElement('div');
        box.id = 'bmc-tr';
        frame = D.createElement('iframe');
        frame.title = TITLE;
        frame.setAttribute('allow', 'payment');
        R.classList.add('bmc-tr-wait');
        frame.onload = function () { R.classList.remove('bmc-tr-wait'); };
        frame.src = TRAKTEER.url + '?embedId=0&ref=' + encodeURIComponent(location.href);
        box.appendChild(frame);
        D.body.appendChild(box);
        mine.push(box);
      }
      box.style.display = 'block';
      try { frame.contentWindow.postMessage({ type: 'embed.openModal' }, '*'); } catch (er) {}
    }
    addEventListener('message', function (e) {
      if (!box || e.source !== frame.contentWindow || !e.data || e.data.type !== 'embed.modalClosed') return;
      setTimeout(function () { box.style.display = 'none'; }, 200);
    });
    btn.addEventListener('click', open, true);
    if (note) note.addEventListener('click', open, true);
  }

  function start() {
    btn = D.getElementById('bmc-wbtn');
    if (!btn) return false;
    var frame = D.getElementById('bmc-iframe');
    var note = btn.nextElementSibling;
    if (note && !note.id) note.id = 'bmc-note';
    mine = [btn, note, frame && frame.parentElement];
    if (TIP) trakteer(note);
    if (DRAG) draggable();
    update();
    addEventListener('scroll', soon, { passive: true });
    addEventListener('resize', soon);
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) if (!isMine(list[i].target)) return soon();
    }).observe(D.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open', 'aria-expanded'] });
    setTimeout(soon, 1500); /* after web fonts and late layout */
    return true;
  }
  function wait() {
    if (start()) return;
    var mo = new MutationObserver(function () { if (start()) mo.disconnect(); });
    mo.observe(D.body, { childList: true });
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', function () { setTimeout(wait, 0); });
  else wait();
})();
