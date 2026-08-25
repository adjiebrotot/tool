/* =====================================================================
   GUIDED TOUR ENGINE (shared across the Adjie Brotot tools)
   --------------------------------------------------------------------
   A single reusable, dependency-free first-visit walkthrough:
     1. Darkens the whole page except the focused element (spotlight).
     2. Steps through the tool with a short, plain-language tooltip.
     3. Can be skipped at any point.
     4. Only OFFERED on the user's first visit; a localStorage flag
        suppresses it on later visits. A manual "Take a tour" button in
        the header re-launches it on demand.

   Each page defines window.__TOUR BEFORE loading this file:
     window.__TOUR = {
       seenKey:     'unique-per-tool-key',   // localStorage flag
       launchLabel: '🧭 Take a tour',        // header button text (optional)
       labels:      { skip, back, next, start, done, dialog }, // optional
       steps: [ { target, title, body, onEnter } , ... ]
     };
   `target`  : CSS selector of the element to spotlight (null = centered)
   `onEnter` : optional callback run when the step is shown. A step whose
               target lives behind a tab, a panel, or a result that has not
               been produced yet MUST open or produce it here, so the step
               never spotlights something the user cannot see.
   ===================================================================== */
(function () {
  'use strict';

  var CFG = window.__TOUR || {};
  var SEEN_KEY = CFG.seenKey || 'ab-tour-generic-seen';
  var LAUNCH_LABEL = CFG.launchLabel || '🧭 Take a tour';
  var steps = Array.isArray(CFG.steps) ? CFG.steps : [];

  /* Button copy. Defaults are English; the translated pages pass their own
     via __TOUR.labels so the card is not half English, half Indonesian. */
  var L = CFG.labels || {};
  var SKIP_LABEL  = L.skip  || 'Skip tour';
  var BACK_LABEL  = L.back  || 'Back';
  var NEXT_LABEL  = L.next  || 'Next';
  var START_LABEL = L.start || 'Start';
  var DONE_LABEL  = L.done  || 'Done';
  var DIALOG_LABEL = L.dialog || 'Product tour';

  if (!steps.length) return; // nothing to show

  var current = 0;
  var els = null; // { backdrop, spotlight, tooltip }

  /* ---- DOM construction --------------------------------------------- */
  function buildOverlay() {
    var backdrop = document.createElement('div');
    backdrop.className = 'pf-tour-backdrop';

    var spotlight = document.createElement('div');
    spotlight.className = 'pf-tour-spotlight';

    var tooltip = document.createElement('div');
    tooltip.className = 'pf-tour-tooltip';
    tooltip.setAttribute('role', 'dialog');
    tooltip.setAttribute('aria-live', 'polite');
    tooltip.setAttribute('aria-label', DIALOG_LABEL);

    document.body.appendChild(backdrop);
    document.body.appendChild(spotlight);
    document.body.appendChild(tooltip);

    return { backdrop: backdrop, spotlight: spotlight, tooltip: tooltip };
  }

  function teardown() {
    if (!els) return;
    [els.backdrop, els.spotlight, els.tooltip].forEach(function (el) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    window.removeEventListener('resize', reposition);
    window.removeEventListener('scroll', reposition, true);
    document.removeEventListener('keydown', onKeydown, true);
    els = null;
  }

  /* ---- Target resolution -------------------------------------------- */
  /* A step may only spotlight an element that is really on screen. A target
     sitting in an inactive tab, a collapsed panel, or a not-yet-rendered
     result has a zero-size box, and spotlighting one used to punch a 12px
     hole in the top-left corner: the step then appeared to highlight
     nothing at all. Steps that need a panel open it from onEnter, so give
     the page a moment to react before deciding the target is unreachable. */
  var TARGET_WAIT_MS = 900;
  var renderToken = 0;

  function isUsableTarget(el) {
    if (!el || !el.isConnected) return false;
    var cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    var r = el.getBoundingClientRect();
    return r.width >= 4 && r.height >= 4;
  }

  function resolveTarget(selector) {
    var el = selector ? document.querySelector(selector) : null;
    return isUsableTarget(el) ? el : null;
  }

  /* ---- Rendering a step --------------------------------------------- */
  function renderStep() {
    var step = steps[current];
    var token = ++renderToken; // invalidates any in-flight positioning

    if (typeof step.onEnter === 'function') {
      try { step.onEnter(); } catch (e) { /* non-fatal to the tour */ }
    }

    // Draw the card first so its measured size is available for placement.
    renderTooltip(step);

    if (!step.target) { positionCentered(); return; }
    awaitTarget(step.target, token, Date.now());
  }

  function awaitTarget(selector, token, since) {
    if (token !== renderToken || !els) return;
    var el = resolveTarget(selector);
    if (el) { scrollToTarget(el, token); return; }
    if (Date.now() - since < TARGET_WAIT_MS) {
      setTimeout(function () { awaitTarget(selector, token, since); }, 60);
      return;
    }
    // Unreachable target: show the step centred rather than spotlighting
    // an empty corner of the page.
    positionCentered();
  }

  /* Smooth scrolling has no completion event, so follow the element until it
     stops moving instead of guessing with a fixed delay. */
  function scrollToTarget(el, token) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    var lastTop = null, steady = 0, ticks = 0;
    (function settle() {
      if (token !== renderToken || !els) return;
      var top = el.getBoundingClientRect().top;
      steady = (lastTop !== null && Math.abs(top - lastTop) < 0.5) ? steady + 1 : 0;
      lastTop = top;
      positionToTarget(el);
      if (steady < 3 && ++ticks < 25) setTimeout(settle, 60);
    })();
  }

  function renderTooltip(step) {
    var isLast = current === steps.length - 1;
    var isFirst = current === 0;
    els.tooltip.innerHTML =
      '<h4 class="pf-tour-title">' + step.title + '</h4>' +
      '<p class="pf-tour-body">' + step.body + '</p>' +
      '<div class="pf-tour-footer">' +
        '<button type="button" class="pf-tour-skip" data-act="skip">' + SKIP_LABEL + '</button>' +
        '<span class="pf-tour-progress">' + (current + 1) + ' / ' + steps.length + '</span>' +
        '<div class="pf-tour-btns">' +
          (isFirst ? '' : '<button type="button" class="pf-tour-btn pf-tour-btn-ghost" data-act="back">' + BACK_LABEL + '</button>') +
          '<button type="button" class="pf-tour-btn pf-tour-btn-primary" data-act="next">' +
            (isLast ? DONE_LABEL : (isFirst ? START_LABEL : NEXT_LABEL)) +
          '</button>' +
        '</div>' +
      '</div>';

    els.tooltip.querySelectorAll('[data-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var act = btn.getAttribute('data-act');
        if (act === 'skip') return end();
        if (act === 'back') return go(current - 1);
        if (act === 'next') return (isLast ? end() : go(current + 1));
      });
    });
  }

  /* ---- Positioning -------------------------------------------------- */
  /* The "hole" is clamped to the viewport. A target taller or wider than the
     screen would otherwise push the darkened ring off-screen entirely, so the
     step read as nothing being highlighted at all. */
  var PAD = 6, EDGE = 12;

  function positionToTarget(targetEl) {
    if (!els) return;
    var r = targetEl.getBoundingClientRect();
    var vw = window.innerWidth, vh = window.innerHeight;
    var top    = Math.max(EDGE, r.top - PAD);
    var left   = Math.max(EDGE, r.left - PAD);
    var bottom = Math.min(vh - EDGE, r.bottom + PAD);
    var right  = Math.min(vw - EDGE, r.right + PAD);

    // Scrolled entirely out of reach: fall back to a centred step.
    if (bottom - top < 20 || right - left < 20) { positionCentered(); return; }

    var sp = els.spotlight;
    sp.style.display = 'block';
    sp.style.top = top + 'px';
    sp.style.left = left + 'px';
    sp.style.width = (right - left) + 'px';
    sp.style.height = (bottom - top) + 'px';
    els.backdrop.classList.remove('pf-tour-no-target');
    placeTooltipNear({ top: top, bottom: bottom, left: left, right: right });
  }

  function positionCentered() {
    if (!els) return;
    els.spotlight.style.display = 'none';
    els.backdrop.classList.add('pf-tour-no-target');
    var t = els.tooltip;
    t.style.top = '50%';
    t.style.left = '50%';
    t.style.transform = 'translate(-50%, -50%)';
  }

  function placeTooltipNear(r) {
    var t = els.tooltip;
    t.style.transform = 'none';
    var tw = t.offsetWidth || 340;
    var th = t.offsetHeight || 180;
    var gap = 14;
    var vw = window.innerWidth, vh = window.innerHeight;

    // Prefer below the target; fall back to above; else beside it, and only
    // then overlap, so the card never hides what it is describing.
    var top, left = r.left;
    if (r.bottom + gap + th <= vh) {
      top = r.bottom + gap;
    } else if (r.top - gap - th >= 0) {
      top = r.top - gap - th;
    } else {
      top = Math.max(gap, Math.min((vh - th) / 2, vh - th - gap));
      if (r.right + gap + tw <= vw) left = r.right + gap;
      else if (r.left - gap - tw >= 0) left = r.left - gap - tw;
    }

    left = Math.max(gap, Math.min(left, vw - tw - gap));
    t.style.top = top + 'px';
    t.style.left = left + 'px';
  }

  function reposition() {
    if (!els) return;
    var el = resolveTarget(steps[current].target);
    if (el) positionToTarget(el);
    else positionCentered();
  }

  /* ---- Navigation --------------------------------------------------- */
  function go(idx) {
    if (idx < 0 || idx >= steps.length) return;
    current = idx;
    renderStep();
  }

  function onKeydown(e) {
    if (e.key === 'Escape') { e.preventDefault(); end(); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') {
      e.preventDefault();
      (current === steps.length - 1) ? end() : go(current + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(current - 1);
    }
  }

  function start() {
    if (els) return; // already running
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
    current = 0;
    els = buildOverlay();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    document.addEventListener('keydown', onKeydown, true);
    renderStep();
  }

  function end() {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
    teardown();
  }

  /* ---- First-visit detection & wiring ------------------------------- */
  function hasVisited() {
    try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; }
  }

  function addLaunchButton() {
    var nav = document.querySelector('.header-right') || document.querySelector('.header-nav');
    if (!nav || nav.querySelector('[data-pf-tour-launch]')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-pf-tour-launch', '');
    // Match the page's own header buttons so the launcher is visually
    // coherent with the controls around it. Each tool styles .btn-theme a
    // little differently, so we adopt that class instead of hard-coding a
    // look here; .pf-tour-launch is only a fallback when no such button
    // exists on the page.
    var themeBtn = nav.querySelector('#themeToggle');
    var model = themeBtn || nav.querySelector('.btn-theme') || nav.querySelector('button, a');
    if (model && model.className) {
      // Drop the back-link modifier — it belongs to the "Other Tools" link.
      btn.className = model.className.replace(/\bbtn-back\b/g, '').trim();
    }
    if (!btn.className) btn.className = 'pf-tour-launch';
    btn.textContent = LAUNCH_LABEL;
    btn.setAttribute('aria-label', 'Take a guided tour of this tool');
    btn.addEventListener('click', start);
    // Insert before the theme toggle so it sits next to it.
    if (themeBtn && themeBtn.parentNode) themeBtn.parentNode.insertBefore(btn, themeBtn);
    else nav.appendChild(btn);
  }

  function init() {
    addLaunchButton();
    // Offer the tour only on the first visit (after this tour shipped).
    if (!hasVisited()) {
      // Let the app finish its own init/layout first.
      setTimeout(start, 700);
    }
  }

  // Expose for manual triggering / debugging.
  window.pfTour = { start: start, end: end };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
