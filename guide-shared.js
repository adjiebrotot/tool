/* GUIDE PAGES (shared across the tools' "How to use" guides, <tool>/guides/): plays the clips
   recorded from the real tool. Each .gd-demo[data-demo="<name>"] gets a video (media/<name>-<light|dark>.webm and .mp4, a
   .webp poster), a small bar with Play / Pause and Full screen, and its steps become live: the one
   the clip is showing is lit, and a click on a step jumps the clip to it. The times of the steps
   come from media/manifest.json (written by _ref/guide-capture/run.mjs, or the PowerFactory
   Builder's own _capture/capture.mjs). The screen's screenshot (.gd-shot-frame[data-shot]) swaps
   with the theme too, and pointing at a part in its key lights that part's box. Clips play only while they are
   on screen, and not at all (until asked) for readers who prefer reduced motion. Everything here
   is an extra: without it the page reads as text with the steps listed. */
(function () {
  'use strict';

  var MEDIA = 'media/';
  var body = document.body;
  // What the clips were recorded from, for their names: "the Builder", "the tool".
  var SRC = body.getAttribute('data-guide-src') || 'tool';

  // The sun and moon button (theme.js draws it and keeps the choice; this flips the page).
  var tgl = document.getElementById('themeToggle');
  if (tgl) tgl.addEventListener('click', function () { body.classList.toggle('light'); });
  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var theme = function () { return body.classList.contains('light') ? 'light' : 'dark'; };
  var manifest = null;
  var demos = [];

  // ---- One demo
  function Demo(root) {
    var name = root.getAttribute('data-demo');
    var w = +root.getAttribute('data-w') || 1280, h = +root.getAttribute('data-h') || 720;
    var fig = root.querySelector('.gd-screen');
    var capEl = fig.querySelector('.gd-cap');
    var cap = capEl ? capEl.textContent : '';
    if (capEl) capEl.remove();

    if (w < 1280) fig.style.setProperty('--mw', w + 'px');
    var view = document.createElement('div');
    view.className = 'gd-view';
    view.style.setProperty('--ar', w + ' / ' + h);
    var video = document.createElement('video');
    video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'none';
    video.setAttribute('muted', ''); video.setAttribute('playsinline', '');
    video.setAttribute('disablepictureinpicture', '');
    video.setAttribute('aria-label', cap ? cap + ' (recorded from the ' + SRC + ')' : 'Recorded from the ' + SRC);
    video.width = w; video.height = h;
    view.appendChild(video);

    var bar = document.createElement('div');
    bar.className = 'gd-bar';
    var label = document.createElement('span');
    label.className = 'gd-cap';
    label.textContent = cap;
    var play = button('Play', 'Play or pause the clip');
    var full = button('Full screen', 'Show the clip full screen');
    bar.appendChild(label); bar.appendChild(play); bar.appendChild(full);
    fig.appendChild(view); fig.appendChild(bar);
    if (!(video.requestFullscreen || video.webkitEnterFullscreen)) full.hidden = true;

    var steps = [].slice.call(root.querySelectorAll('.gd-steps > li'));
    var d = { name: name, video: video, steps: steps, userPaused: false, visible: false, active: -1, marks: [], theme: null };

    function button(text, title) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'btn-secondary btn-sm'; b.textContent = text; b.title = title;
      return b;
    }
    function setLabel() { play.textContent = video.paused ? 'Play' : 'Pause'; }

    // The poster, once the clip is near the screen (and again when the theme changes).
    d.near = false;
    d.poster = function () { if (d.near) video.poster = MEDIA + name + '-' + theme() + '.webp'; };

    // Sources for the current theme (the clip of the other theme is never fetched).
    d.load = function () {
      var t = theme();
      if (d.theme === t) return;
      var resume = d.theme !== null ? video.currentTime : 0;
      var wasPlaying = d.theme !== null && !video.paused;
      d.theme = t;
      while (video.firstChild) video.removeChild(video.firstChild);
      var base = MEDIA + name + '-' + t;
      [['.webm', 'video/webm'], ['.mp4', 'video/mp4']].forEach(function (f) {
        var s = document.createElement('source');
        s.src = base + f[0]; s.type = f[1];
        video.appendChild(s);
      });
      d.poster();
      d.marks = marksFor(name, t);
      if (resume || wasPlaying) {
        video.preload = 'auto';
        video.addEventListener('loadedmetadata', function once() {
          video.removeEventListener('loadedmetadata', once);
          try { video.currentTime = resume; } catch (e) { /* not yet seekable */ }
          if (wasPlaying) go();
        });
      }
      video.load();
    };
    function go() { var p = video.play(); if (p && p.catch) p.catch(function () { /* blocked: the Play button is there */ }); }
    d.update = function () {
      var t = video.currentTime, k = -1;
      for (var i = 0; i < d.marks.length; i++) if (t >= d.marks[i] - 0.05) k = i;
      if (k === d.active) return;
      d.active = k;
      steps.forEach(function (li, i) {
        li.classList.toggle('is-active', i === k);
        if (i === k) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      });
    };
    d.sync = function () {
      d.marks = marksFor(name, theme());
      steps.forEach(function (li, i) {
        var live = i < d.marks.length;
        li.classList.toggle('is-live', live);
        if (live) li.tabIndex = 0; else li.removeAttribute('tabindex');
      });
      d.update();
    };
    d.want = function () {
      if (d.visible && !d.userPaused && !reduce.matches) go(); else if (!d.visible) video.pause();
    };

    play.addEventListener('click', function () {
      if (video.paused) { d.userPaused = false; d.load(); go(); } else { d.userPaused = true; video.pause(); }
    });
    full.addEventListener('click', function () {
      d.load();
      if (video.requestFullscreen) video.requestFullscreen().catch(function () {});
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
      go();
    });
    video.addEventListener('play', setLabel);
    video.addEventListener('pause', setLabel);
    video.addEventListener('timeupdate', d.update);
    steps.forEach(function (li, i) {
      function jump() {
        if (i >= d.marks.length) return;
        d.load(); d.userPaused = false;
        var at = d.marks[i] + 0.05;
        if (video.readyState > 0) { video.currentTime = at; go(); }
        else { video.preload = 'auto'; video.addEventListener('loadedmetadata', function once() { video.removeEventListener('loadedmetadata', once); video.currentTime = at; go(); }); go(); }
      }
      li.addEventListener('click', jump);
      li.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jump(); } });
    });
    setLabel();
    return d;
  }

  function marksFor(name, t) {
    var m = manifest && manifest[name] && manifest[name][t];
    return m && m.marks ? m.marks.map(function (x) { return x.t; }) : [];
  }

  // ---- The screen: a screenshot per theme, its parts outlined
  var shot = document.querySelector('.gd-shot-frame');
  var shotImg = null;
  var shotName = shot && shot.getAttribute('data-shot') || 'layout';
  var shotW = shot && +shot.getAttribute('data-w') || 1280, shotH = shot && +shot.getAttribute('data-h') || 720;
  if (shot) shot.style.setProperty('--ar', shotW + ' / ' + shotH);
  function paintShot() {
    if (!shot) return;
    if (!shotImg) {
      shotImg = document.createElement('img');
      shotImg.alt = ''; shotImg.width = shotW; shotImg.height = shotH; shotImg.decoding = 'async';
      shot.insertBefore(shotImg, shot.firstChild);
    }
    shotImg.src = MEDIA + shotName + '-' + theme() + '.webp';
  }
  // Pointing at (or focusing) a part in the key lights its box on the picture.
  [].forEach.call(document.querySelectorAll('.gd-key li[data-b]'), function (li) {
    var box = shot && shot.querySelector('.gd-box[data-b="' + li.getAttribute('data-b') + '"]');
    if (!box) return;
    function lit(on) { return function () { box.classList.toggle('is-lit', on); }; }
    li.addEventListener('mouseenter', lit(true)); li.addEventListener('mouseleave', lit(false));
    li.addEventListener('focusin', lit(true)); li.addEventListener('focusout', lit(false));
  });

  // ---- Start
  [].forEach.call(document.querySelectorAll('.gd-demo[data-demo]'), function (el) { demos.push(Demo(el)); });
  paintShot();

  if ('IntersectionObserver' in window) {
    var nearIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var d = demos.filter(function (x) { return x.video.parentNode === en.target; })[0];
        if (d && !d.near) { d.near = true; d.poster(); nearIo.unobserve(en.target); }
      });
    }, { rootMargin: '700px 0px' });
    demos.forEach(function (d) { nearIo.observe(d.video.parentNode); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var d = demos.filter(function (x) { return x.video.parentNode === en.target; })[0];
        if (!d) return;
        d.visible = en.isIntersecting;
        if (d.visible) d.load();
        d.want();
      });
    }, { threshold: 0.4 });
    demos.forEach(function (d) { io.observe(d.video.parentNode); });
  } else {
    demos.forEach(function (d) { d.near = true; d.load(); });
  }

  // The times of the steps arrive after the page is up.
  fetch(MEDIA + 'manifest.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (m) {
    manifest = m;
    demos.forEach(function (d) { d.sync(); });
  }).catch(function () { /* the steps still read as a list */ });

  // Day or night: the clip of the other theme takes over where this one was.
  if (window.MutationObserver) {
    var last = theme();
    new MutationObserver(function () {
      if (theme() === last) return;
      last = theme();
      paintShot();
      demos.forEach(function (d) { if (d.theme !== null) { d.load(); d.sync(); } else d.poster(); });
    }).observe(body, { attributes: true, attributeFilter: ['class'] });
  }
  if (reduce.addEventListener) reduce.addEventListener('change', function () { demos.forEach(function (d) { if (reduce.matches) d.video.pause(); else d.want(); }); });
})();
