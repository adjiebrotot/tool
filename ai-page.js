/* AI pages (<tool>/ai/): plays the install demo for Claude, ChatGPT and Grok beside its steps,
   and the example conversation once it is in view. Every word is in this file or the page; the
   demo windows are drawn here from STEPS, so a menu that moves is a one-line change. */
(function () {
  'use strict';
  var root = document.querySelector('.ai-install');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ---- The install demo ---------------------------------------------------------------- */
  if (root) {
    var ZIP = esc(root.getAttribute('data-zip'));
    var SKILL = esc(root.getAttribute('data-skill'));
    var file = function (fly) { return '<span class="ai-file' + (fly ? ' fly' : '') + '">🗜 ' + ZIP + '</span>'; };
    var tog = function (on, target) { return '<span class="ai-tog' + (on ? ' on' : '') + (target ? ' ai-target' : '') + '"></span>'; };
    var row = function (title, sub, right) { return '<div class="ai-row"><div>' + title + (sub ? '<small>' + sub + '</small>' : '') + '</div>' + (right || '') + '</div>'; };
    var side = function (items, on) {
      return items.map(function (t, i) {
        if (t === '|') return '<span class="ai-gap"></span>';
        return '<b class="' + (i === on ? 'on ai-target' : '') + '">' + t + '</b>';
      }).join('');
    };
    var CHAT_SIDE = ['New chat', 'Search', 'Recents', '|', 'You'];

    /* Each step: the caption, the step card's title and text, and the window it shows.
       side: [items, index lit]; main: the right-hand HTML; .ai-target is where the pointer goes. */
    var STEPS = {
      claude: [
        { t: 'Open Settings', p: 'In Claude (web or desktop), open your name at the bottom left, then <strong>Settings</strong>.',
          side: [CHAT_SIDE, 4], main: '<h4>New chat</h4><p>How can I help you today?</p><div class="ai-menu"><b>Profile</b><b class="ai-target">Settings</b><b>Help</b></div>' },
        { t: 'Turn on code', p: 'Under <strong>Capabilities</strong>, switch on <strong>Code execution and file creation</strong>. Skills need it.',
          side: [['General', 'Account', 'Capabilities', 'Connectors'], 2],
          main: '<h4>Capabilities</h4>' + row('Code execution and file creation', 'Claude can run code and create files', tog(true, true)) },
        { t: 'Upload skill', p: 'Further down, under <strong>Skills</strong>, press <strong>Upload skill</strong>.',
          side: [['General', 'Account', 'Capabilities', 'Connectors'], 2],
          main: '<h4>Skills</h4><p>Teach Claude a task once, use it in every chat.</p><span class="ai-btn ai-target">+ Upload skill</span>' },
        { t: 'Choose the zip', p: 'Pick <code>' + ZIP + '</code> from your downloads. Keep it zipped.',
          side: [['General', 'Account', 'Capabilities', 'Connectors'], 2],
          main: '<div class="ai-dialog"><h4>Upload skill</h4><div class="ai-drop hot ai-target">' + file(true) + '<span>A .zip with a SKILL.md</span></div></div>' },
        { t: 'Switch it on', p: 'The skill <strong>' + SKILL + '</strong> is listed and on. Start a new chat and ask your question.',
          side: [['General', 'Account', 'Capabilities', 'Connectors'], 2],
          main: '<h4>Skills</h4>' + row(SKILL, 'Uploaded just now', tog(true, true)) }
      ],
      chatgpt: [
        { t: 'Open Settings', p: 'In ChatGPT, open your profile at the bottom left, then <strong>Settings</strong>.',
          side: [CHAT_SIDE, 4], main: '<h4>What can I help with?</h4><div class="ai-menu"><b>My plan</b><b class="ai-target">Settings</b><b>Help</b></div>' },
        { t: 'Skills', p: 'Open <strong>Skills</strong> (on some plans it sits under <strong>Personalization</strong> or the Plugins sidebar).',
          side: [['General', 'Personalization', 'Skills', 'Data controls'], 2],
          main: '<h4>Skills</h4><p>Skills give ChatGPT instructions and files for a task.</p><span class="ai-btn ai-target">+ New skill</span>' },
        { t: 'Upload', p: 'Choose <strong>Upload from your computer</strong>.',
          side: [['General', 'Personalization', 'Skills', 'Data controls'], 2],
          main: '<div class="ai-dialog"><h4>New skill</h4>' + row('Create with ChatGPT', 'Describe it in a chat') + '<div class="ai-row ai-target">Upload from your computer<small>.zip with a SKILL.md</small></div></div>' },
        { t: 'Choose the zip', p: 'Pick <code>' + ZIP + '</code>, one zip per skill.',
          side: [['General', 'Personalization', 'Skills', 'Data controls'], 2],
          main: '<div class="ai-dialog"><h4>Upload skill</h4><div class="ai-drop hot ai-target">' + file(true) + '<span>Uploading…</span></div></div>' },
        { t: 'Ready', p: 'The skill shows as on. In a new chat, ask your question, or type its name to call it.',
          side: [['General', 'Personalization', 'Skills', 'Data controls'], 2],
          main: '<h4>Skills</h4>' + row(SKILL, 'Enabled', tog(true, true)) }
      ],
      grok: [
        { t: 'Open Settings', p: 'In Grok, open your profile, then <strong>Settings</strong>.',
          side: [CHAT_SIDE, 4], main: '<h4>What do you want to know?</h4><div class="ai-menu"><b>Profile</b><b class="ai-target">Settings</b><b>Help</b></div>' },
        { t: 'Skills', p: 'Open <strong>Skills</strong> and press <strong>Upload a skill</strong>.',
          side: [['Account', 'Customize', 'Skills', 'Data'], 2],
          main: '<h4>Skills</h4><p>Add a skill to your workspace.</p><span class="ai-btn ai-target">Upload a skill</span>' },
        { t: 'Drop the zip', p: 'Drag <code>' + ZIP + '</code> onto <strong>Skill file</strong>, or browse to it.',
          side: [['Account', 'Customize', 'Skills', 'Data'], 2],
          main: '<div class="ai-dialog"><h4>Upload a skill</h4><p>Skill file</p><div class="ai-drop hot ai-target">' + file(true) + '<span>Drag and drop skill files here, or browse</span></div></div>' },
        { t: 'Security scan', p: 'Grok scans the skill when you upload. It is plain text and one Python script, so it passes.',
          side: [['Account', 'Customize', 'Skills', 'Data'], 2],
          main: '<div class="ai-dialog"><h4>Upload a skill</h4>' + row(file(false), '') + '<p>Security scan</p><div class="ai-scan"><i></i></div><span class="ai-btn ai-target">Upload</span></div>' },
        { t: 'Ready', p: 'The skill is in your workspace. Ask your question in a new chat.',
          side: [['Account', 'Customize', 'Skills', 'Data'], 2],
          main: '<h4>Skills</h4>' + row(SKILL, 'Scan passed', tog(true, true)) }
      ]
    };
    var NAMES = { claude: 'Claude', chatgpt: 'ChatGPT', grok: 'Grok' };
    var STEP_MS = 3000;
    var stage = root.querySelector('.ai-stage');
    var cap = root.querySelector('.ai-cap');
    var list = root.querySelector('.ai-steps');
    var playBtn = root.querySelector('.ai-play');
    var tabs = [].slice.call(root.querySelectorAll('.ai-tab'));
    var app = 'claude', idx = 0, timer = null, playing = !reduce;
    var cursor = '<span class="ai-cursor"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2l15 9-6.5 1.6L16 20l-2.8 1.4-3.3-7.3L4 18z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg></span>';

    function steps() { return STEPS[app]; }
    function drawList() {
      list.innerHTML = steps().map(function (s, i) {
        return '<li class="is-live" tabindex="0" data-i="' + i + '"><h3>' + s.t + '</h3><p>' + s.p + '</p></li>';
      }).join('');
    }
    function show(i) {
      idx = i;
      var s = steps()[i];
      stage.innerHTML = '<div class="ai-win"><div class="ai-win-bar"><i></i><i></i><i></i><span>' + NAMES[app] + '</span></div>' +
        '<div class="ai-win-body"><div class="ai-side">' + side(s.side[0], s.side[1]) + '</div><div class="ai-main">' + s.main + '</div></div></div>' + cursor;
      cap.textContent = NAMES[app] + ': ' + (i + 1) + ' of ' + steps().length + ', ' + s.t;
      [].forEach.call(list.children, function (li, k) { li.classList.toggle('is-active', k === i); });
      place(true);
    }
    // The pointer travels from the middle to the thing to press, then presses it. On a resize
    // (a phone's address bar showing or hiding) it only moves, so nothing replays.
    function place(animate) {
      var cur = stage.querySelector('.ai-cursor');
      if (!cur) return;
      var targets = stage.querySelectorAll('.ai-target');
      var tgt = targets[targets.length - 1];
      var box = stage.getBoundingClientRect();
      if (!tgt) return;
      var r = tgt.getBoundingClientRect();
      var x = r.left - box.left + Math.min(r.width * 0.6, 60), y = r.top - box.top + r.height * 0.55;
      var go = function () { cur.style.transform = 'translate(' + x + 'px,' + y + 'px)'; };
      if (!animate || reduce) { go(); return; }
      cur.style.transform = 'translate(' + box.width * 0.55 + 'px,' + box.height * 0.75 + 'px)';
      requestAnimationFrame(function () { requestAnimationFrame(go); });
      setTimeout(function () { cur.classList.add('press'); }, 800);
    }
    function schedule() {
      clearTimeout(timer);
      if (!playing) return;
      timer = setTimeout(function () { show((idx + 1) % steps().length); schedule(); }, STEP_MS);
    }
    function setPlaying(p) { playing = p; playBtn.textContent = p ? 'Pause' : 'Play'; schedule(); }
    function pick(a) {
      app = a;
      tabs.forEach(function (t) { t.setAttribute('aria-selected', String(t.getAttribute('data-app') === a)); });
      drawList(); show(0); schedule();
    }
    tabs.forEach(function (t) { t.addEventListener('click', function () { pick(t.getAttribute('data-app')); }); });
    list.addEventListener('click', function (e) {
      var li = e.target.closest('li[data-i]');
      if (li) { show(+li.getAttribute('data-i')); setPlaying(false); }
    });
    list.addEventListener('keydown', function (e) {
      var li = e.target.closest('li[data-i]');
      if (li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); show(+li.getAttribute('data-i')); setPlaying(false); }
    });
    playBtn.addEventListener('click', function () { setPlaying(!playing); });
    window.addEventListener('resize', function () { place(false); });
    // Only play while it can be seen.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (!e.isIntersecting) clearTimeout(timer); else schedule(); });
      }).observe(stage);
    }
    pick('claude');
    setPlaying(playing);
  }

  /* ---- The example conversation --------------------------------------------------------- */
  var chat = document.querySelector('.ai-chat');
  if (!chat || reduce) return;
  var parts = [chat.querySelector('.ai-user')]
    .concat([].slice.call(chat.querySelectorAll('.ai-work .ai-chip')))
    .concat([].slice.call(chat.querySelectorAll('.ai-bot > *')))
    .concat([chat.querySelector('.ai-chat-bar')])
    .filter(Boolean);
  var bot = chat.querySelector('.ai-bot');
  var typing = document.createElement('div');
  typing.className = 'ai-typing';
  typing.setAttribute('aria-hidden', 'true');
  typing.innerHTML = '<i></i><i></i><i></i>';
  var timers = [];
  function play() {
    timers.forEach(clearTimeout);
    timers = [];
    chat.classList.add('ai-anim');
    parts.forEach(function (p) { p.classList.add('ai-step'); p.classList.remove('in'); });
    bot.classList.add('ai-step');
    bot.classList.remove('in');
    var t = 200, botQueued = false;
    var at = function (ms, fn) { timers.push(setTimeout(fn, ms)); };
    parts.forEach(function (p) {
      if (p.parentNode === bot && !botQueued) {
        botQueued = true;
        at(t, function () { bot.parentNode.insertBefore(typing, bot); });
        t += 1100;
        at(t, function () { typing.remove(); bot.classList.add('in'); });
      }
      var d = p.classList.contains('ai-user') ? 0 : p.classList.contains('ai-chip') ? 800 : 450;
      t += d;
      at(t, function () { p.classList.add('in'); });
    });
  }
  chat.querySelector('.ai-replay').addEventListener('click', play);
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); play(); }
    }, { threshold: 0.25 });
    // Hidden until it plays, so the first view is not a flash of the finished chat.
    chat.classList.add('ai-anim');
    parts.concat([bot]).forEach(function (p) { p.classList.add('ai-step'); });
    io.observe(chat);
  }
})();
