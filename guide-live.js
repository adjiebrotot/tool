/* GUIDE PAGES, LIVE (beside guide-shared.js, on a guide whose <body> names its scenes:
   data-guide-live="scenes.js"): every demo on the page is the real tool, running in a frame and
   driven by a script, instead of a recorded clip. Nothing to record, nothing to store: a guide
   costs its scenes file, and a reader who has opened the tool already has the rest cached.

   The scenes (<tool>/guides/scenes.js, an ES module exporting TOOL and SCENES) are scripts
   against the tool, written with the helpers below (S.click, S.drag, S.fill, S.choose ...).
   A scene sets itself up before S.begin(), at once and behind a veil; from S.begin() it plays
   at a person's pace, a pointer moving and clicking; each S.mark() is the next step of the
   guide's list under the demo, which lights up. At the end it waits and plays again from a
   fresh load of the tool.

   The tool opens as <tool>/?demo (guide-demo.js): storage of its own, never the reader's, no
   analytics, no dialogs, and this page never jumps. A demo plays only while on screen, one at a
   time, and not until asked for readers who prefer reduced motion. Pause stops it, and the
   reader can then try the tool in place; Play goes on, or starts over after a try. A click on a
   step plays the scene up to it at once and on from there. Once the guide itself has loaded, a
   frame loads as its demo comes near and goes when it is far, at most MAX at a time; they load
   one after another, the one a reader is looking at first.

   A scene can point the camera (S.focus): the frame zooms in on the part a step is about, up
   to ZOOM times, and pans to keep the pointer in sight; S.focus() shows all of it again. Live
   pages stay sharp at any zoom, as a video would not. A reader trying the tool sees all of it.

   The screen's picture (.gd-shot-frame[data-shot]) is the scene marked still: the tool at that
   size, with its parts outlined where the scene's boxes are.

   A tool with a second page on the same inputs (Rent vs Own's Sensitivity, the DCA Portfolio
   mode, the Cost of Living Map) shows both in one guide: a scene with its own `path` (relative
   to the guide, and may carry a query or a hash) opens that page instead of TOOL.path, with
   its own `ready(win)` when the page differs, and `seen` keys added to TOOL.seen.

   _ref/guide-check.mjs plays every scene of a guide and fails on a broken one, and
   _ref/presolve.mjs solves ahead whatever a scene runs, so a demo never fetches the solver.
   Both drive the page through window.GuideLive. */
(function () {
  'use strict';

  var body = document.body;
  var SRC = body.getAttribute('data-guide-live');
  if (!SRC) return;

  var MAX = 4;              // frames alive at once
  var ZOOM = 2.2;           // the closest a camera goes: this many times the whole frame
  var GAP = 2500;           // ms from the end of a scene to its next run
  var PID = 31;             // the guide's pointer (guide-demo.js keeps its capture)
  var ABORT = { abort: true };
  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var theme = function () { return body.classList.contains('light') ? 'light' : 'dark'; };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var frame1 = function () { return new Promise(function (r) { requestAnimationFrame(function () { r(); }); }); };

  // _ref/guide-check.mjs and _ref/presolve.mjs set GuideLiveManual before the page loads: no
  // demo then plays or goes by itself, only through run().
  var API = window.GuideLive = { demos: [], scenes: null, onNote: null, manual: !!window.GuideLiveManual };
  var mod = null, demos = API.demos, lastFocus = null;

  /* ---- One demo (or the still screen) ------------------------------------------------------ */
  function Demo(root, still) {
    var name = still ? root.getAttribute('data-shot') || 'layout' : root.getAttribute('data-demo');
    var w = +root.getAttribute('data-w') || 1280, h = +root.getAttribute('data-h') || 720;
    var d = { name: name, still: still, root: root, frame: null, run: null, state: 'idle',
      ratio: 0, active: false, asked: false, userPaused: false, tried: false, forced: false };
    var view, veil, guard, play, steps = [], cap = '';

    if (still) {
      view = root;
      view.style.setProperty('--ar', w + ' / ' + h);
    } else {
      var fig = root.querySelector('.gd-screen');
      var capEl = fig.querySelector('.gd-cap');
      cap = capEl ? capEl.textContent : '';
      if (capEl) capEl.remove();
      if (w < 1280) fig.style.setProperty('--mw', w + 'px');
      view = document.createElement('div');
      view.className = 'gd-view';
      view.style.setProperty('--ar', w + ' / ' + h);
      var bar = document.createElement('div');
      bar.className = 'gd-bar';
      var label = document.createElement('span');
      label.className = 'gd-cap';
      label.textContent = cap;
      play = button('Play', 'Play or pause the demo');
      var full = button('Full screen', 'Show the demo full screen');
      bar.appendChild(label); bar.appendChild(play); bar.appendChild(full);
      fig.appendChild(view); fig.appendChild(bar);
      if (!(view.requestFullscreen || view.webkitRequestFullscreen)) full.hidden = true;
      guard = document.createElement('div');
      guard.className = 'gd-guard';
      view.appendChild(guard);
      steps = [].slice.call(root.querySelectorAll('.gd-steps > li'));

      play.addEventListener('click', function () {
        if (d.run && d.run.begun && !d.run.paused) { d.userPaused = true; d.want(); return; }
        d.asked = true; d.userPaused = false;
        if (d.state === 'idle' || d.state === 'ended' || d.state === 'failed' || d.tried) d.load(-1);
        else d.want();
      });
      full.addEventListener('click', function () {
        var f = view.requestFullscreen || view.webkitRequestFullscreen;
        var p = f.call(view);
        if (p && p.catch) p.catch(function () {});
        d.asked = true; d.userPaused = false;
        if (d.state === 'idle' || d.state === 'ended') d.load(-1); else d.want();
      });
      steps.forEach(function (li, i) {
        li.classList.add('is-live');
        li.tabIndex = 0;
        function jump() { d.asked = true; d.userPaused = false; d.load(i); }
        li.addEventListener('click', jump);
        li.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jump(); } });
      });
    }
    veil = document.createElement('div');
    veil.className = 'gd-veil';
    veil.textContent = still ? '' : 'Live demo';
    view.appendChild(veil);

    function button(text, title) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'btn-secondary btn-sm'; b.textContent = text; b.title = title;
      return b;
    }
    function setVeil(on, text) {
      veil.classList.toggle('is-off', !on);
      if (text != null) veil.textContent = text;
      if (d.frame) d.frame.style.opacity = on ? '0' : '1';
    }
    function setLabel() {
      if (!play) return;
      var r = d.run, going = r && r.begun && !r.paused && !r.fast;
      play.textContent = going ? 'Pause' : 'Play';
      var trying = !!(r && r.begun && r.paused && d.userPaused);
      guard.hidden = !(going || (r && r.fast));
      root.classList.toggle('is-trying', trying);
      label.textContent = trying ? 'Paused: try the tool here, or press Play' : cap;
    }
    d.lit = function (k) {
      steps.forEach(function (li, i) {
        li.classList.toggle('is-active', i === k);
        if (i === k) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      });
    };

    // The frame keeps the tool's own size, scaled so the part on show (cam, in frame pixels; null:
    // all of it) fills the space it has (the whole screen, in full screen).
    var cam = null, held = null;
    function fit() {
      if (!d.frame) return;
      var W = view.clientWidth, H = view.clientHeight;
      if (!W || !H) return;
      var c = cam || { x: 0, y: 0, w: w, h: h }, k = Math.min(W / c.w, H / c.h);
      d.frame.style.transform = 'translate(' + ((W - c.w * k) / 2 - c.x * k) + 'px,' + ((H - c.h * k) / 2 - c.y * k) + 'px) scale(' + k + ')';
    }
    // Move the camera to a part (a box in frame pixels, with room around it), or to all of it.
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    d.region = function (b, pad) {
      if (!b) return null;
      var rw = Math.max(b.width + 2 * pad, w / ZOOM), rh = rw * h / w;
      if (rh < b.height + 2 * pad) { rh = b.height + 2 * pad; rw = rh * w / h; }
      if (rw >= w * 0.92 || rh >= h * 0.92) return null;
      var cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      return { x: clamp(cx - rw / 2, 0, w - rw), y: clamp(cy - rh / 2, 0, h - rh), w: rw, h: rh };
    };
    d.show = function (c, ms) {
      cam = c;
      if (d.frame) d.frame.style.transition = ms ? 'transform ' + ms + 'ms cubic-bezier(.4, 0, .2, 1), opacity 150ms' : 'opacity 150ms';
      fit();
    };
    d.cam = function () { return cam; };
    // Keep the pointer in sight: a point outside the part on show pans the camera to it.
    d.follow = function (x, y, ms) {
      if (!cam) return;
      var m = Math.min(cam.w, cam.h) * 0.12;
      if (x >= cam.x + m && x <= cam.x + cam.w - m && y >= cam.y + m && y <= cam.y + cam.h - m) return;
      d.show({ x: clamp(x - cam.w / 2, 0, w - cam.w), y: clamp(y - cam.h / 2, 0, h - cam.h), w: cam.w, h: cam.h }, ms);
    };
    if (window.ResizeObserver) new ResizeObserver(fit).observe(view);

    d.scene = function () { return mod && mod.SCENES.filter(function (s) { return s.name === name; })[0]; };

    // A fresh tool, played up to step `upTo` at once (-1: none, Infinity: all of it).
    d.load = function (upTo) {
      var sc = d.scene();
      if (!sc) return null;
      // One tool loads at a time (turn()): a demo nobody is looking at waits its turn, and the
      // one a reader is looking at goes first, a demo still loading off screen stepping back.
      var first = d.forced || d.asked || d.active;
      if (!first && demos.some(function (x) { return x !== d && x.state === 'loading'; })) { queue(d); return null; }
      if (first) demos.forEach(function (x) { if (x !== d && x.state === 'loading' && !x.forced && !x.asked && !x.active) { x.stop(); queue(x); } });
      d.stop();
      if (!still) room(d);
      var seed = { 'abt-theme': theme(), 'abt-consent': 'denied' };
      (mod.TOOL.seen || []).concat(sc.seen || []).forEach(function (k) { seed[k] = '1'; });
      var st = sc.storage || mod.TOOL.storage || {};
      Object.keys(st).forEach(function (k) { seed[k] = st[k]; });
      var f = document.createElement('iframe');
      f.title = still ? 'The tool' : 'Live demo: ' + cap;
      f.setAttribute('aria-hidden', 'true');
      f.tabIndex = -1;
      f.setAttribute('data-storage', JSON.stringify(seed));
      f.style.width = w + 'px'; f.style.height = h + 'px';
      f.src = demoUrl(sc.path || mod.TOOL.path);
      view.insertBefore(f, view.firstChild);
      d.frame = f; d.tried = false; cam = null; held = null;
      var r = d.run = { upTo: upTo == null ? -1 : upTo, idx: -1, fast: true, begun: false, paused: false, aborted: false,
        wake: null, cur: { x: w / 2, y: h / 2 }, over: null, down: null, marks: [], errors: [], t0: Date.now(), done: null };
      r.finished = new Promise(function (res) { r.done = res; });
      d.state = 'loading';
      setVeil(true, still ? '' : upTo >= 0 ? 'Going to step ' + (Math.min(upTo, steps.length - 1) + 1) + '…' : 'Loading the tool…');
      fit(); setLabel(); d.lit(-1);
      f.addEventListener('load', function () { if (d.run === r) go(r, sc); }, { once: true });
      return r.finished;
    };
    d.stop = function () {
      var r = d.run;
      if (r) { r.aborted = true; if (r.wake) r.wake(); }
      if (d.frame) { if (document.activeElement === d.frame) giveFocusBack(); d.frame.remove(); }
      unqueue(d);
      if (d.state === 'loading') turnSoon();
      d.frame = null; d.run = null; d.state = 'idle';
      setVeil(true, still ? '' : 'Live demo');
      setLabel();
    };

    async function go(r, sc) {
      var S = Helpers(d, r);
      var win = d.frame.contentWindow, out = null;
      try {
        if (!win.localStorage || !win.localStorage.__demo) throw new Error('the tool did not open as a demo (guide-demo.js)');
        win.addEventListener('error', function (e) { r.errors.push(String(e.message || e)); });
        win.addEventListener('unhandledrejection', function (e) { r.errors.push('unhandled: ' + (e.reason && e.reason.message || e.reason)); });
        decorate(win, d, still);
        var ready = sc.ready || mod.TOOL.ready;
        await S.until(function () { return ready(win); }, 60000, 'the tool to be ready');
        await S.wait(300);
        out = await sc.run(S);
        if (still) {
          syncTheme(d);
          if (out && out.boxes) place(view, out.boxes, S.win);
          await S.wait(200);
          setVeil(false);
        }
      } catch (e) {
        if (e === ABORT || r.aborted) return;
        r.error = e && e.message || String(e);
        if (window.console) console.warn('Guide demo "' + name + '": ' + r.error);
      }
      if (r.aborted || d.run !== r) return;
      r.end = Date.now();
      d.state = r.error ? 'failed' : 'ended';
      turnSoon();
      r.fast = false; r.paused = true;
      setVeil(false); setLabel();
      if (document.activeElement === d.frame) giveFocusBack();
      if (reduce.matches) d.asked = false;
      r.done({ name: name, marks: r.marks, steps: steps.length, error: r.error || null, errors: r.errors, ms: r.end - r.t0 });
      // Again from the start, after a breath, while it is still the one on screen.
      if (!still && !r.error && !API.manual) setTimeout(function () {
        if (d.run === r && d.shouldPlay() && !reduce.matches) d.load(-1);
      }, GAP);
    }

    d.begin = function (r) {
      r.begun = true;
      r.fast = r.idx < r.upTo;
      syncTheme(d);
      if (!r.fast) setVeil(false);
      d.state = 'playing';
      turnSoon();
      if (!r.fast) r.paused = !d.shouldPlay();
      setLabel();
    };
    d.mark = function (r) {
      d.lit(r.idx);
      if (r.fast && r.idx >= r.upTo) { r.fast = false; setVeil(false); r.paused = !d.shouldPlay(); setLabel(); }
    };
    d.shouldPlay = function () {
      if (d.forced) return true;
      if (API.manual || document.hidden) return false;
      return d.active && !d.userPaused && (d.asked || !reduce.matches);
    };
    // Play or hold, as the page now stands.
    d.want = function () {
      if (still) return;
      var r = d.run;
      if (!r) { if (d.shouldPlay()) d.load(-1); return; }
      if (d.state === 'ended' && d.shouldPlay() && (d.asked || !reduce.matches) && Date.now() - r.end > GAP) { d.load(-1); return; }
      if (!r.begun || r.fast || d.state !== 'playing') { setLabel(); return; }
      var hold = !d.shouldPlay();
      if (!hold && d.tried) { d.load(-1); return; }
      if (r.paused !== hold) { r.paused = hold; if (!hold && r.wake) r.wake(); }
      // A reader trying the tool sees all of it; Play puts the camera back.
      if (hold && d.userPaused && cam) { held = cam; d.show(null, 400); }
      else if (!hold && held) { var c = held; held = null; d.show(c, 400); }
      setLabel();
    };
    d.fit = fit;
    return d;
  }

  /* ---- The helpers a scene is written with ------------------------------------------------
     A target is a CSS selector, an element, a function giving one, or { text, in } (the
     deepest element under `in` whose text holds `text`). Points are frame pixels. */
  function Helpers(d, r) {
    var S = {}, F = d.frame;
    Object.defineProperty(S, 'win', { get: function () { return F.contentWindow; } });
    Object.defineProperty(S, 'doc', { get: function () { return F.contentDocument; } });

    async function hold() {
      for (;;) {
        if (r.aborted || d.run !== r) throw ABORT;
        if (!r.paused) return;
        await new Promise(function (res) { r.wake = res; });
      }
    }
    // The only way time passes in a scene: paused, it waits; set up or skipped, it takes a frame.
    S.wait = async function (ms) {
      await hold();
      keepFocus(d);
      if (r.fast) { await frame1(); return; }
      var end = Date.now() + (ms || 0);
      for (;;) {
        var left = end - Date.now();
        if (left <= 0) return;
        await sleep(Math.min(left, 100));
        if (r.paused) { var t = Date.now(); await hold(); end += Date.now() - t; }
        if (r.aborted) throw ABORT;
      }
    };
    S.until = async function (fn, ms, what) {
      var spent = 0;
      for (;;) {
        await hold();
        var v = null;
        try { v = fn(S.win, S); } catch (e) { v = null; }
        if (v) return v;
        if (spent > (ms || 20000)) throw new Error('waited too long for ' + (what || 'the tool'));
        await sleep(50); spent += 50;
      }
    };

    function resolve(t) {
      var doc = S.doc;
      if (!t) return null;
      if (typeof t === 'string') return doc.querySelector(t);
      if (typeof t === 'function') return t(S);
      if (t.nodeType === 1) return t;
      if (t.text) {
        // The innermost elements holding the text: the one that says just that, else the first.
        var all = [].slice.call(doc.querySelectorAll((t.in ? t.in + ' ' : '') + '*')).filter(function (e) {
          return e.textContent.indexOf(t.text) >= 0 && shown(e);
        });
        var inner = all.filter(function (e) { return !all.some(function (x) { return x !== e && e.contains(x); }); });
        return inner.filter(function (e) { return e.textContent.trim() === t.text; })[0] || inner[0] || null;
      }
      return null;
    }
    function shown(e) {
      if (!e || !e.isConnected) return false;
      var b = e.getBoundingClientRect();
      return b.width > 0 && b.height > 0 && S.win.getComputedStyle(e).visibility !== 'hidden';
    }
    function describe(t) { return typeof t === 'string' ? t : t && t.text ? '"' + t.text + '"' : 'a part of the tool'; }
    S.$ = resolve;
    S.find = function (t, ms) {
      var el = null;
      return S.until(function () { el = resolve(t); return shown(el) && el; }, ms || 8000, describe(t));
    };
    S.box = async function (t) { var b = (await S.find(t)).getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; };
    S.centre = async function (t, dx, dy) { var b = await S.box(t); return { x: b.x + b.width / 2 + (dx || 0), y: b.y + b.height / 2 + (dy || 0) }; };
    S.checked = function (sel) { var e = S.doc.querySelector(sel); return !!(e && e.checked); };

    /* The pointer: a drawn cursor and the events a mouse would send. */
    function fire(target, type, x, y, o) {
      o = o || {};
      var Win = S.win, ptr = type.indexOf('pointer') === 0;
      var C = ptr ? Win.PointerEvent || Win.MouseEvent : Win.MouseEvent;
      var quiet = /enter|leave/.test(type);
      var init = { bubbles: !quiet, cancelable: !quiet, composed: true, view: Win, clientX: x, clientY: y,
        screenX: x, screenY: y, button: 0, buttons: o.buttons || 0, detail: o.detail || 0, relatedTarget: o.related || null };
      if (ptr) { init.pointerId = PID; init.pointerType = 'mouse'; init.isPrimary = true; init.width = 1; init.height = 1; init.pressure = o.buttons ? 0.5 : 0; }
      var ev = new C(type, init);
      target.dispatchEvent(ev);
      return ev;
    }
    function under(x, y) { return S.doc.elementFromPoint(x, y) || S.doc.documentElement; }
    // Leaving one element for another: out and leave, then over and enter, as a browser sends them.
    function pass(from, to, x, y) {
      if (from === to) return;
      if (from && from.isConnected) {
        fire(from, 'pointerout', x, y, { related: to }); fire(from, 'mouseout', x, y, { related: to });
        for (var a = from; a && !(to && a.contains(to)); a = a.parentElement) { fire(a, 'pointerleave', x, y, { related: to }); fire(a, 'mouseleave', x, y, { related: to }); }
      }
      if (to) {
        fire(to, 'pointerover', x, y, { related: from }); fire(to, 'mouseover', x, y, { related: from });
        var chain = [];
        for (var b = to; b && !(from && from.isConnected && b.contains(from)); b = b.parentElement) chain.unshift(b);
        chain.forEach(function (e) { fire(e, 'pointerenter', x, y, { related: from }); fire(e, 'mouseenter', x, y, { related: from }); });
      }
      r.over = to;
    }
    function move(x, y) {
      cursor(S.doc, x, y);
      var dn = r.down;
      if (dn && !r.drag && dn.drag) dragStart(x, y);
      if (r.drag) { dragOver(x, y); return; }
      var cap = S.win.__demoCapture, el = under(x, y);
      if (!cap) pass(r.over, el, x, y);
      var t = cap || el;
      fire(t, 'pointermove', x, y, { buttons: dn ? 1 : 0 });
      if (!dn || dn.compat) fire(t, 'mousemove', x, y, { buttons: dn ? 1 : 0 });
    }
    // n: the press's count, 2 for the second press of a double-click.
    function press(x, y, n) {
      var el = under(x, y);
      pass(r.over, el, x, y);
      S.win.__demoCapture = null;
      var pd = fire(el, 'pointerdown', x, y, { buttons: 1 });
      r.down = { target: el, compat: !pd.defaultPrevented, drag: el.closest ? el.closest('[draggable="true"]') : null };
      if (r.down.compat) {
        var md = fire(el, 'mousedown', x, y, { buttons: 1, detail: n || 1 });
        if (!md.defaultPrevented) focusFor(el);
      }
      ring(S.doc, x, y);
    }
    // Returns what the click went to (null: no click, as after a drag).
    function release(x, y, n) {
      var dn = r.down;
      if (!dn) return null;
      r.down = null;
      if (r.drag) { dragEnd(x, y); return null; }
      var cap = S.win.__demoCapture, el = cap || under(x, y);
      fire(el, 'pointerup', x, y, {});
      if (dn.compat) fire(el, 'mouseup', x, y, { detail: n || 1 });
      S.win.__demoCapture = null;
      // The click goes to what both the press and the release were on.
      var c = dn.target;
      while (c && !c.contains(el)) c = c.parentElement;
      if (c && c.isConnected) { fire(c, 'click', x, y, { detail: n || 1 }); return c; }
      return null;
    }
    /* A press on a draggable element that moves becomes an HTML drag, as a browser makes it: the
       pointer is cancelled, drag events take over from the mouse's, a picture of the element
       follows the pointer, and the drop goes where the last dragover said yes. */
    function fireDrag(target, type, x, y, dt) {
      var Win = S.win, init = { bubbles: true, cancelable: !/^drag(end|leave)$/.test(type), composed: true,
        view: Win, clientX: x, clientY: y, screenX: x, screenY: y, dataTransfer: dt };
      var ev;
      try { ev = new Win.DragEvent(type, init); } catch (e) { ev = new Win.MouseEvent(type, init); }
      target.dispatchEvent(ev);
      return ev;
    }
    function dragStart(x, y) {
      var src = r.down.drag, Win = S.win, dt = null;
      try { dt = new Win.DataTransfer(); } catch (e) { /* an old browser: the drop reads nothing */ }
      r.down.drag = null;
      if (fireDrag(src, 'dragstart', x, y, dt).defaultPrevented) return;
      fire(src, 'pointercancel', x, y, {});
      // The picture: a copy, in the colours it has where it is (its own or the panel's behind it).
      var b = src.getBoundingClientRect(), g = src.cloneNode(true), cs = Win.getComputedStyle(src), bg = 'transparent';
      for (var a = src; a && a.nodeType === 1; a = a.parentElement) {
        var c = Win.getComputedStyle(a).backgroundColor;
        if (c && c !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(c)) { bg = c; break; }
      }
      g.removeAttribute('id');
      g.style.cssText = 'position:fixed;left:0;top:0;margin:0;width:' + b.width + 'px;z-index:2147483645;pointer-events:none;opacity:.85;box-sizing:border-box;' +
        'color:' + cs.color + ';font:' + cs.font + ';background:' + bg + ';border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.2)';
      S.doc.documentElement.appendChild(g);
      r.drag = { src: src, dt: dt, over: null, ok: false, ghost: g, dx: b.left - x, dy: b.top - y };
    }
    function dragOver(x, y) {
      var g = r.drag, el = under(x, y);
      g.ghost.style.transform = 'translate(' + (x + g.dx) + 'px,' + (y + g.dy) + 'px)';
      if (el !== g.over) {
        if (g.over && g.over.isConnected) fireDrag(g.over, 'dragleave', x, y, g.dt);
        fireDrag(el, 'dragenter', x, y, g.dt);
        g.over = el;
      }
      g.ok = fireDrag(el, 'dragover', x, y, g.dt).defaultPrevented;
    }
    function dragEnd(x, y) {
      var g = r.drag;
      r.drag = null;
      g.ghost.remove();
      if (g.ok) fireDrag(under(x, y), 'drop', x, y, g.dt);
      else if (g.over && g.over.isConnected) fireDrag(g.over, 'dragleave', x, y, g.dt);
      fireDrag(g.src, 'dragend', x, y, g.dt);
    }
    // A press on a field focuses it (the only time a demo takes the keyboard from the page);
    // a press anywhere else takes the focus away, as it does in a browser.
    function focusFor(el) {
      var f = el.closest ? el.closest('input, textarea, [contenteditable]') : null;
      var ae = S.doc.activeElement;
      if (f && !f.disabled && !/^(checkbox|radio|range|button|submit|reset|color|file|image)$/.test(f.type)) { if (ae !== f) take(f); }
      else if (ae && ae !== S.doc.body && ae.blur) ae.blur();
    }
    function take(el) { S.win.__demoFocus = true; try { el.focus(); } finally { S.win.__demoFocus = false; } }

    S.glide = async function (x, y, ms) {
      var a = r.cur, n = r.fast ? 1 : Math.max(6, Math.round((ms == null ? 650 : ms) / 16));
      d.follow(x, y, r.fast ? 0 : Math.max(400, ms == null ? 650 : ms));
      for (var i = 1; i <= n; i++) {
        var k = i / n, e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        await hold();
        move(a.x + (x - a.x) * e, a.y + (y - a.y) * e);
        if (!r.fast) await sleep((ms == null ? 650 : ms) / n);
      }
      r.cur = { x: x, y: y };
      if (r.fast) await S.wait(0);
    };
    S.moveTo = async function (t, o) {
      o = o || {};
      var c = o.at || await S.centre(t, o.dx, o.dy);
      await S.glide(c.x, c.y, o.ms);
      return c;
    };
    S.click = async function (t, o) {
      o = o || {};
      var el = t ? await S.find(t) : null;
      var c = o.at || await S.centre(el, o.dx, o.dy);
      await S.glide(c.x, c.y, o.ms);
      await S.wait(120);
      await hold();
      press(c.x, c.y);
      await S.wait(70);
      await hold();
      release(c.x, c.y);
      await S.wait(o.after == null ? 350 : o.after);
      return el;
    };
    S.dblclick = async function (t, o) {
      o = o || {};
      var el = t ? await S.find(t) : null;
      var c = o.at || await S.centre(el, o.dx, o.dy);
      await S.glide(c.x, c.y, o.ms);
      await S.wait(120);
      var hit = null;
      for (var n = 1; n <= 2; n++) {
        await hold();
        press(c.x, c.y, n);
        await S.wait(60);
        await hold();
        hit = release(c.x, c.y, n);
        if (n === 1) await S.wait(90);
      }
      if (hit) fire(hit, 'dblclick', c.x, c.y, { detail: 2 });
      await S.wait(o.after == null ? 500 : o.after);
      return el;
    };
    S.drag = async function (from, to, o) {
      o = o || {};
      var a = from.x !== undefined ? from : await S.centre(from);
      await S.glide(a.x, a.y, o.ms1 == null ? 600 : o.ms1);
      await S.wait(150);
      await hold();
      press(a.x, a.y);
      await S.wait(120);
      move(a.x + 8, a.y + 6);
      await S.wait(60);
      var b = to.x !== undefined ? to : await S.centre(to);
      await S.glide(b.x, b.y, o.ms2 == null ? 800 : o.ms2);
      await S.wait(o.hold == null ? 250 : o.hold);
      await hold();
      release(b.x, b.y);
      await S.wait(o.after == null ? 500 : o.after);
    };
    // A range input's thumb, taken to a value.
    S.slide = async function (t, value, o) {
      o = o || {};
      var el = await S.find(t), Win = S.win;
      var min = el.min === '' ? 0 : +el.min, max = el.max === '' ? 100 : +el.max, from = +el.value;
      var b = el.getBoundingClientRect(), y = b.top + b.height / 2;
      var xOf = function (v) { return b.left + 8 + (b.width - 16) * (v - min) / (max - min); };
      await S.glide(xOf(from), y, o.ms1 == null ? 600 : o.ms1);
      await S.wait(150);
      await hold();
      press(xOf(from), y);
      var n = r.fast ? 1 : Math.max(6, Math.round((o.ms == null ? 1000 : o.ms) / 40));
      for (var i = 1; i <= n; i++) {
        var k = i / n, e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        el.value = from + (value - from) * e;
        el.dispatchEvent(new Win.Event('input', { bubbles: true }));
        move(xOf(+el.value), y);
        await S.wait((o.ms == null ? 1000 : o.ms) / n);
      }
      el.dispatchEvent(new Win.Event('change', { bubbles: true }));
      r.cur = { x: xOf(+el.value), y: y };
      release(r.cur.x, y);
      await S.wait(o.after == null ? 700 : o.after);
    };

    /* The keyboard. */
    var CODES = { Escape: 'Escape', Tab: 'Tab', Enter: 'Enter', ' ': 'Space' };
    S.key = async function (key, o) {
      o = o || {};
      var doc = S.doc, Win = S.win, t = doc.activeElement || doc.body;
      var init = { key: key, code: CODES[key] || (key.length === 1 ? 'Key' + key.toUpperCase() : key), bubbles: true, cancelable: true, composed: true, view: Win, ctrlKey: !!o.ctrl, shiftKey: !!o.shift };
      var kd = new Win.KeyboardEvent('keydown', init);
      t.dispatchEvent(kd);
      if (key === 'Tab' && !kd.defaultPrevented && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) {
        t.dispatchEvent(new Win.Event('change', { bubbles: true }));
        t.blur();
      }
      t.dispatchEvent(new Win.KeyboardEvent('keyup', init));
      await S.wait(o.after == null ? 150 : o.after);
    };
    // Into a field: click it, replace what it holds a key at a time, then leave it (Tab). With
    // { click: false } it types into the field as it is (one the tool has just opened), and
    // { end: 'Enter' } ends with that key instead (null: stays in the field).
    S.fill = async function (t, text, o) {
      o = o || {};
      var el = o.click === false ? await S.find(t) : await S.click(t, { after: 250 });
      if (!/^(INPUT|TEXTAREA)$/.test(el.tagName)) el = el.querySelector('input, textarea');
      var Win = S.win, v = '';
      if (S.doc.activeElement !== el) take(el);
      try { el.select(); } catch (e) {}
      for (var i = 0; i < text.length; i++) {
        var ch = text[i], init = { key: ch, bubbles: true, cancelable: true, composed: true, view: Win };
        await hold();
        el.dispatchEvent(new Win.KeyboardEvent('keydown', init));
        v += ch;
        el.value = v;
        el.dispatchEvent(new (Win.InputEvent || Win.Event)('input', { bubbles: true, inputType: 'insertText', data: ch }));
        el.dispatchEvent(new Win.KeyboardEvent('keyup', init));
        await S.wait(o.delay == null ? 140 : o.delay);
      }
      if (o.end !== null) await S.key(o.end || 'Tab', { after: o.after == null ? 700 : o.after });
      else await S.wait(o.after == null ? 700 : o.after);
    };
    // A select's option, picked from the site's own list (dropdown.js) as a reader would.
    S.choose = async function (t, text, o) {
      o = o || {};
      var sel = await S.find(t), Win = S.win;
      await S.click(sel, { after: 700 });
      var opt = resolve({ text: text, in: '.combo-list' });
      if (opt) opt = opt.closest('.combo-opt') || opt;
      // A long list scrolls the option into its view first, as a reader would.
      if (opt && shown(opt)) { await S.reveal(opt, 0.5, 500); await S.click(opt, { after: 0 }); }
      else {
        await S.key('Escape', { after: 100 });
        for (var i = 0; i < sel.options.length; i++) if (sel.options[i].text.indexOf(text) >= 0) { sel.selectedIndex = i; break; }
        sel.dispatchEvent(new Win.Event('input', { bubbles: true }));
        sel.dispatchEvent(new Win.Event('change', { bubbles: true }));
      }
      if (S.doc.activeElement && S.doc.activeElement !== S.doc.body && S.doc.activeElement.blur) S.doc.activeElement.blur();
      await S.wait(o.after == null ? 900 : o.after);
    };

    /* Scrolling: the page, so a part sits `top` px from the top; or the panel holding a part
       (the Inputs card), so it sits at `at` of the panel's height. */
    S.scrollTo = async function (t, top, ms) {
      var el = await S.find(t), Win = S.win;
      Win.scrollTo({ top: el.getBoundingClientRect().top + Win.pageYOffset - (top == null ? 90 : top), behavior: r.fast ? 'auto' : 'smooth' });
      await S.wait(ms == null ? 700 : ms);
    };
    S.scrollTop = async function (ms) { S.win.scrollTo({ top: 0, behavior: r.fast ? 'auto' : 'smooth' }); await S.wait(ms == null ? 700 : ms); };
    S.reveal = async function (t, at, ms) {
      var el = await S.until(function () { return resolve(t); }, 8000, describe(t)), Win = S.win, c = el.parentElement;
      while (c && c !== S.doc.body) {
        var oy = Win.getComputedStyle(c).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && c.scrollHeight > c.clientHeight + 1) break;
        c = c.parentElement;
      }
      if (c && c !== S.doc.body) {
        var top = el.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop - c.clientHeight * (at == null ? .5 : at);
        c.scrollTo({ top: top, behavior: r.fast ? 'auto' : 'smooth' });
      }
      await S.wait(ms == null ? 800 : ms);
    };

    /* The camera: S.focus(target or [targets], { pad, ms }) zooms in on them (a box
       { x, y, width, height } in frame pixels works too); S.focus() shows all of the tool. */
    S.focus = async function (t, o) {
      o = o || {};
      var ms = r.fast ? 0 : (o.ms == null ? 700 : o.ms), b = null;
      if (t) {
        var list = [].concat(t), bs = [];
        for (var i = 0; i < list.length; i++) {
          var x = list[i];
          bs.push(x && x.width !== undefined && x.nodeType === undefined && typeof x !== 'function' ? x : await S.box(x));
        }
        var x0 = Math.min.apply(null, bs.map(function (q) { return q.x; })), y0 = Math.min.apply(null, bs.map(function (q) { return q.y; }));
        var x1 = Math.max.apply(null, bs.map(function (q) { return q.x + q.width; })), y1 = Math.max.apply(null, bs.map(function (q) { return q.y + q.height; }));
        b = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
      }
      d.show(d.region(b, o.pad == null ? 28 : o.pad), ms);
      await S.wait(o.after == null ? ms : o.after);
    };

    /* The scene's own moments. */
    S.begin = function () { if (!r.begun) { cursor(S.doc, r.cur.x, r.cur.y, true); d.begin(r); } };
    S.mark = function (label) { r.idx++; r.marks.push(label); d.mark(r); };
    // A moment the scripts that drive this page want to hear of (presolve.mjs: 'solved').
    S.note = async function (tag) { if (API.onNote) await API.onNote(tag, S.win, d.name); };
    return S;
  }

  // The page a scene opens, as a demo: ?demo joins whatever query the path already has.
  function demoUrl(p) {
    var u = new URL(p, location.href);
    u.search = u.search ? u.search + '&demo' : '?demo';
    return u.href;
  }

  /* ---- In the frame: the cursor, and what a reader's try means -------------------------- */
  var CURSOR = '<svg width="22" height="26" viewBox="0 0 14 21" style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))"><path d="M0 0V17.5L4.6 13.4L7.6 20.2L10.6 18.9L7.7 12.2H13.6Z" fill="#fff" stroke="#14203A" stroke-width="1.2" stroke-linejoin="round"/></svg>';
  function decorate(win, d, still) {
    var doc = win.document;
    var st = doc.createElement('style');
    // No scrollbars (a reader scrolls the guide, not the frame), and the guide's cursor.
    st.textContent = 'html{scrollbar-width:none}html::-webkit-scrollbar{display:none}' +
      '#gd-cur{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;will-change:transform;display:none}' +
      '#gd-ring{position:fixed;left:0;top:0;z-index:2147483646;pointer-events:none;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid #3A71C8;opacity:0}';
    doc.head.appendChild(st);
    if (still) return;
    var c = doc.createElement('div');
    c.id = 'gd-cur';
    c.innerHTML = CURSOR;
    var g = doc.createElement('div');
    g.id = 'gd-ring';
    doc.documentElement.appendChild(g);
    doc.documentElement.appendChild(c);
    // The reader's own hand in the frame (while it is paused): Play then starts over.
    function tried(e) { if (e.isTrusted) d.tried = true; }
    doc.addEventListener('pointerdown', tried, true);
    doc.addEventListener('keydown', tried, true);
  }
  function cursor(doc, x, y, show) {
    var c = doc.getElementById('gd-cur');
    if (!c) return;
    if (show) c.style.display = 'block';
    c.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  }
  function ring(doc, x, y) {
    var g = doc.getElementById('gd-ring'), win = doc.defaultView;
    if (!g) return;
    g.style.transition = 'none'; g.style.opacity = '.9'; g.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(.4)';
    win.requestAnimationFrame(function () {
      win.requestAnimationFrame(function () {
        g.style.transition = 'transform .35s ease-out, opacity .45s ease-out';
        g.style.opacity = '0'; g.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(1.15)';
      });
    });
  }

  // The parts of the screen, outlined where the tool has them now (in % of the frame). A part is
  // a selector, a list of them, or a box { x, y, width, height } in frame pixels.
  function place(view, boxes, win) {
    var doc = win.document, W = win.innerWidth, H = win.innerHeight;
    Object.keys(boxes).forEach(function (k, i) {
      var box = view.querySelector('.gd-box[data-b="' + (i + 1) + '"]');
      var rs = [].concat(boxes[k]).map(function (s) {
        if (typeof s === 'string') { var e = doc.querySelector(s); return e && e.getBoundingClientRect(); }
        return s && { left: s.x, top: s.y, right: s.x + s.width, bottom: s.y + s.height };
      }).filter(Boolean);
      if (!box || !rs.length) return;
      var x = Math.max(0, Math.min.apply(null, rs.map(function (b) { return b.left; })));
      var y = Math.max(0, Math.min.apply(null, rs.map(function (b) { return b.top; })));
      var rt = Math.min(W - 4, Math.max.apply(null, rs.map(function (b) { return b.right; })));
      var bt = Math.min(H - 4, Math.max.apply(null, rs.map(function (b) { return b.bottom; })));
      box.style.setProperty('--x', (x / W * 100).toFixed(2) + '%');
      box.style.setProperty('--y', (y / H * 100).toFixed(2) + '%');
      box.style.setProperty('--w', ((rt - x) / W * 100).toFixed(2) + '%');
      box.style.setProperty('--h', ((bt - y) / H * 100).toFixed(2) + '%');
    });
  }

  // Day or night: the tool's own toggle (its handler re-draws its charts; theme.js keeps a click
  // from code out of the reader's choice).
  function syncTheme(d) {
    try {
      var doc = d.frame && d.frame.contentDocument;
      if (!doc || !doc.body) return;
      var light = doc.body.classList.contains('light');
      if (light === (theme() === 'light')) return;
      var t = doc.getElementById('themeToggle');
      if (t) t.click(); else doc.body.classList.toggle('light', theme() === 'light');
    } catch (e) {}
  }

  /* ---- The page's focus stays the reader's ---------------------------------------------
     A demo typing into a field focuses it in its frame, which takes the keyboard from the
     page. Once it has left the field, the focus goes back where it was. */
  document.addEventListener('focusin', function (e) { if (e.target.tagName !== 'IFRAME') lastFocus = e.target; });
  function giveFocusBack() {
    if (lastFocus && lastFocus.isConnected && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    else if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  function keepFocus(d) {
    var f = d.frame;
    if (!f || document.activeElement !== f || (d.run && d.run.paused && d.userPaused)) return;
    var inner = f.contentDocument && f.contentDocument.activeElement;
    if (!inner || !/^(INPUT|TEXTAREA)$/.test(inner.tagName)) giveFocusBack();
  }

  // Frames are heavy: at most MAX, the ones nearest the reader kept.
  function room(d) {
    var alive = demos.filter(function (x) { return x !== d && x.frame && !x.forced; });
    if (alive.length < MAX) return;
    var mid = window.innerHeight / 2;
    alive.sort(function (a, b) {
      var da = Math.abs(a.root.getBoundingClientRect().top - mid), db = Math.abs(b.root.getBoundingClientRect().top - mid);
      return db - da;
    });
    alive.slice(0, alive.length - MAX + 1).forEach(function (x) { x.stop(); });
  }

  // A tool loading takes the page's one thread for a moment, and two at once take twice as long
  // each: they load one at a time, the waiting one nearest the middle of the screen next.
  var waiting = [];
  function queue(d) { if (waiting.indexOf(d) < 0) waiting.push(d); }
  function unqueue(d) { var i = waiting.indexOf(d); if (i >= 0) waiting.splice(i, 1); }
  function turn() {
    if (!waiting.length || demos.some(function (x) { return x.state === 'loading'; })) return;
    var mid = window.innerHeight / 2;
    var gap = function (x) { var b = x.root.getBoundingClientRect(); return Math.abs(b.top + b.height / 2 - mid); };
    waiting.sort(function (a, b) { return gap(a) - gap(b); });
    var d = waiting.shift();
    if (!d.frame) d.load(-1);
  }
  // After the moment that ended a load (a frame's own load starts in the same moment).
  function turnSoon() { setTimeout(turn, 0); }

  // The one most on screen plays; the rest hold.
  function pick() {
    var best = null;
    demos.forEach(function (d) { if (!d.still && d.ratio >= 0.4 && (!best || d.ratio > best.ratio)) best = d; });
    demos.forEach(function (d) { d.active = d === best; d.want(); });
  }

  /* ---- For the scripts that drive this page: play one scene now, to its end ------------- */
  API.run = function (name, o) {
    o = o || {};
    var d = demos.filter(function (x) { return x.name === name; })[0];
    if (!d) return Promise.resolve({ name: name, error: 'no demo or screen called ' + name + ' on this page' });
    d.forced = true; d.asked = true; d.userPaused = false;
    var p = d.load(o.fast === false ? -1 : Infinity);
    return p ? p.then(function (res) { d.forced = false; if (!o.keep) d.stop(); return res; })
      : Promise.resolve({ name: name, error: 'no scene called ' + name + ' in ' + SRC });
  };

  /* ---- Start ------------------------------------------------------------------------------ */
  [].forEach.call(document.querySelectorAll('.gd-shot-frame[data-shot]'), function (el) {
    var n = el.querySelector('noscript');
    if (n) n.remove();
    demos.push(Demo(el, true));
  });
  [].forEach.call(document.querySelectorAll('.gd-demo[data-demo]'), function (el) { demos.push(Demo(el, false)); });

  API.ready = import(new URL(SRC, location.href).href).then(function (m) {
    mod = API.scenes = m;
    if (API.manual) return;
    // The guide first: its frames start once the page itself has loaded.
    if (document.readyState === 'complete') watch(); else window.addEventListener('load', watch, { once: true });
  }).catch(function (e) {
    if (window.console) console.warn('Guide demos: the scenes did not load (' + (e && e.message) + ')');
    demos.forEach(function (d) { var v = d.root.querySelector('.gd-veil'); if (v) v.textContent = 'The demo could not load. Open the tool to try it.'; });
  });
  function watch() {
    if ('IntersectionObserver' in window) {
      // Near: the frame loads and sets the scene up, so it is there when the reader is.
      var nearIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var d = byView(en.target);
          if (d && en.isIntersecting && !d.frame) d.load(-1);
        });
      }, { rootMargin: '600px 0px' });
      // Far: the frame goes.
      var farIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { var d = byView(en.target); if (d && !en.isIntersecting) { unqueue(d); if (d.frame) d.stop(); } });
      }, { rootMargin: '1800px 0px' });
      var seeIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { var d = byView(en.target); if (d) d.ratio = en.isIntersecting ? en.intersectionRatio : 0; });
        pick();
      }, { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] });
      demos.forEach(function (d) { nearIo.observe(d.root); farIo.observe(d.root); if (!d.still) seeIo.observe(d.root.querySelector('.gd-view')); });
    } else {
      demos.forEach(function (d) { if (d.still) d.load(-1); });
    }
  }
  function byView(el) {
    return demos.filter(function (d) { return d.root === el || (!d.still && d.root.querySelector('.gd-view') === el); })[0];
  }

  // Day or night, the reader's tab hidden or back, a reader asking for less motion.
  if (window.MutationObserver) {
    var last = theme();
    new MutationObserver(function () {
      if (theme() === last) return;
      last = theme();
      demos.forEach(function (d) { if (d.run && (d.run.begun || d.still) && d.state !== 'loading') syncTheme(d); });
    }).observe(body, { attributes: true, attributeFilter: ['class'] });
  }
  document.addEventListener('visibilitychange', function () { demos.forEach(function (d) { d.want(); }); });
  if (reduce.addEventListener) reduce.addEventListener('change', function () { demos.forEach(function (d) { d.want(); }); });
  document.addEventListener('fullscreenchange', function () { demos.forEach(function (d) { d.fit(); }); });
})();
