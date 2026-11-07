/* AI pages (<tool>/ai/ and /ai/): plays the install demo for Claude, ChatGPT, Grok, Gemini and
   Copilot beside its steps,
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
    var HUB = esc(root.getAttribute('data-hub') || '/ai/');
    var folder = function (fly) { return '<span class="ai-file' + (fly ? ' fly' : '') + '">📁 ' + SKILL + '</span>'; };
    var pills = function (items, on) {
      return '<div class="ai-pills">' + items.map(function (t, i) {
        return '<b class="' + (i === on ? 'on ai-target' : '') + '">' + t + '</b>';
      }).join('') + '</div>';
    };
    // A drop-down that opens under a button at the top right; lit marks the item to press.
    var drop = function (items, lit) {
      return '<div class="ai-menu ai-menu-top">' + items.map(function (t, i) {
        return '<b class="' + (i === lit ? 'ai-target' : '') + '">' + t + '</b>';
      }).join('') + '</div>';
    };
    var head = function (title, btn) { return '<div class="ai-head"><h4>' + title + '</h4>' + (btn ? '<span class="ai-btn">' + btn + '</span>' : '') + '</div>'; };

    /* Each step: the caption, the step card's title and text, and the window it shows.
       side: [items, index lit]; main: the right-hand HTML; .ai-target is where the pointer goes;
       win: the window's title when it is not the assistant (a file manager, a terminal).
       Drawn from each app's own screens as of 7 November 2026 (see the note under the demo). */
    var CL_SIDE = ['Account', 'Capabilities', 'Privacy', 'Customize', 'Code'];
    var GK_SIDE = ['New chat', 'Search', '|', 'Plugins', 'You'];
    var GM_SIDE = ['New chat', 'Library', 'Images', 'Scheduled', 'Customise', 'Videos'];
    var CP_SIDE = ['New chat', 'Search', 'Library', 'Agents', 'Notebooks'];
    var GP_SIDE = ['New chat', 'Search', 'Library', '|', 'Plugins', 'You'];
    var STEPS = {
      claude: [
        { t: 'Open Settings', p: 'In Claude (web or desktop), press your name at the bottom left, then <strong>Settings</strong>.',
          side: [['New chat', 'Search', 'Recents', '|', 'You'], 4], main: '<h4>New chat</h4><p>How can I help you today?</p><div class="ai-menu"><b class="ai-target">Settings</b><b>Usage</b><b>Language</b><b>Get help</b></div>' },
        { t: 'Customize, then Skills', p: 'In the Settings list, open <strong>Customize</strong>, then the <strong>Skills</strong> tab.',
          side: [CL_SIDE, 3], main: pills(['Connectors', 'Skills', 'Plugins'], 1) + '<p>Skills from Anthropic, and the ones you add.</p>' },
        { t: 'Add, then Upload skill', p: 'Press <strong>+ Add</strong> at the top right and choose <strong>Upload skill</strong>.',
          side: [CL_SIDE, 3], main: pills(['Connectors', 'Skills', 'Plugins'], -1) + head('', '+ Add') + drop(['Upload skill', 'Create a skill', 'Create with Claude'], 0) },
        { t: 'Drop the zip, then Upload', p: 'Drag <code>' + ZIP + '</code> onto <strong>Skill file</strong> (keep it zipped) and press <strong>Upload</strong>. A security scan runs as it uploads.',
          side: [CL_SIDE, 3], main: '<h4>Upload a skill</h4><p>Skill file</p><div class="ai-drop hot">' + file(true) + '<span>Drag and drop skill files here, or browse</span></div>' + row('Security scan', '', '<small>Runs when you upload</small>') + '<span class="ai-btn ai-target">Upload</span>' },
        { t: 'Switch it on', p: 'The skill <strong>' + SKILL + '</strong> opens with its switch on. Press <strong>Try in chat</strong>, or start a new chat and ask your question.',
          side: [CL_SIDE, 3], main: '<h4>' + SKILL + '</h4><p>by you · v1 · updated just now</p><div class="ai-head"><span class="ai-btn ghost">Try in chat</span>' + tog(true, true) + '</div>' }
      ],
      chatgpt: [
        { t: 'Plugins, then Skills', p: 'In a Business, Enterprise, Healthcare or Edu workspace, open <strong>Plugins</strong> in the sidebar, then the <strong>Skills</strong> tab.',
          side: [GP_SIDE, 4], main: pills(['Plugins', 'Skills'], 1) + '<p>Skills give ChatGPT instructions and files for a task.</p>' },
        { t: 'Create, then Upload', p: 'Press <strong>Create</strong> and choose <strong>Upload from your computer</strong>. No Upload? Your admin has not allowed skill uploads yet.',
          side: [GP_SIDE, 4], main: pills(['Plugins', 'Skills'], -1) + head('', 'Create') + drop(['Create with ChatGPT', 'Upload from your computer'], 1) },
        { t: 'Choose the zip', p: 'Pick <code>' + ZIP + '</code>. ChatGPT scans it before it is ready.',
          side: [GP_SIDE, 4], main: '<div class="ai-dialog"><h4>Upload skill</h4><div class="ai-drop hot ai-target">' + file(true) + '<span>Scanning…</span></div><div class="ai-scan"><i></i></div></div>' },
        { t: 'Ready', p: 'The skill shows as on. In a new chat, ask your question.',
          side: [GP_SIDE, 4], main: '<h4>Skills</h4>' + row(SKILL, 'Enabled', tog(true, true)) },
        { t: 'Plus or Pro: use Codex', p: 'No Skills in your ChatGPT? With Plus or higher, Codex reads skills: unzip the download into <code>~/.agents/skills/</code> (older Codex: <code>~/.codex/skills/</code>) and ask Codex your question.',
          win: 'Terminal', side: [['Codex'], 0], main: '<div class="ai-term"><span>$ mkdir -p ~/.agents/skills</span><span class="ai-target">$ unzip ' + ZIP + ' -d ~/.agents/skills</span><span>$ codex</span></div>' }
      ],
      grok: [
        { t: 'Open Plugins', p: 'In Grok, press <strong>Plugins</strong> at the bottom left, just above your name.',
          side: [GK_SIDE, 3], main: pills(['Connectors', 'Skills'], -1) + '<p>Personal</p>' },
        { t: 'Skills, then New Skill', p: 'Open the <strong>Skills</strong> tab, press <strong>New Skill</strong> and choose <strong>Upload skill file</strong>.',
          side: [GK_SIDE, 3], main: pills(['Connectors', 'Skills'], 1) + head('', 'New Skill') + drop(['Write skill manually', 'Upload skill file', 'Create skill with Grok'], 1) },
        { t: 'Drop the zip', p: 'Drop <code>' + ZIP + '</code> in the box (a .zip, .skill or .md file), or click to browse to it.',
          side: [GK_SIDE, 3], main: '<div class="ai-dialog"><h4>Upload Skill</h4><div class="ai-drop hot ai-target">' + file(true) + '<span>Drop a .zip, .skill, or .md file here, or click to browse</span></div></div>' },
        { t: 'Ready', p: 'The skill is listed under <strong>Personal</strong>. Ask your question in a new chat.',
          side: [GK_SIDE, 3], main: '<h4>Personal</h4><div class="ai-target">' + row(SKILL, 'Opens Adjie Brotools…', '<small>···</small>') + '</div>' }
      ],
      gemini: [
        { t: 'Unzip it first', p: 'Gemini takes files or a folder, not a zip. Extract <code>' + ZIP + '</code>: you get a folder <strong>' + SKILL + '</strong> with <code>SKILL.md</code> inside.',
          win: 'Files', side: [['Downloads', 'Documents', 'Desktop'], 0], main: '<h4>Downloads</h4>' + row('🗜 ' + ZIP, 'Extract all') + '<div class="ai-target">' + row('📁 ' + SKILL, 'SKILL.md, references, scripts') + '</div>' },
        { t: 'Customise, then Skills', p: 'In Gemini, open <strong>Customise</strong> in the sidebar, then the <strong>Skills</strong> tab.',
          side: [GM_SIDE, 4], main: pills(['Discover', 'Connectors', 'Skills'], 2) + '<p>Add or create skills to extend what Gemini can do.</p>' },
        { t: 'Create, then Upload', p: 'Press <strong>Create</strong> and choose <strong>Upload</strong>.',
          side: [GM_SIDE, 4], main: pills(['Discover', 'Connectors', 'Skills'], -1) + head('Skills', 'Create') + drop(['Create with Gemini', 'Create manually', 'Upload'], 2) },
        { t: 'Select the folder', p: 'Select the <strong>' + SKILL + '</strong> folder (the one holding <code>SKILL.md</code>) and press <strong>Continue</strong>.',
          side: [GM_SIDE, 4], main: '<div class="ai-dialog"><h4>Upload skill</h4><div class="ai-drop hot">' + folder(true) + '<span>Drag or select files or a folder</span></div><span class="ai-btn ai-target">Continue</span></div>' },
        { t: 'Check it, then Create', p: 'Gemini fills in the <strong>Name</strong>, <strong>Description</strong> and <strong>Instructions</strong> from <code>SKILL.md</code>. Leave them as they are and press <strong>Create</strong>.',
          side: [GM_SIDE, 4], main: head('', 'Create').replace('ai-btn', 'ai-btn ai-target') + row('Name', SKILL) + row('Description', 'Opens Adjie Brotools…') + row('Instructions', '# … on tool.adjiebrotots.com') },
        { t: 'Ready', p: 'The skill is under <strong>Installed</strong>. Ask your question in a new chat.',
          side: [GM_SIDE, 4], main: '<h4>Installed (1)</h4><div class="ai-target">' + row(SKILL, 'Opens Adjie Brotools…', '<small>···</small>') + '</div>' }
      ],
      copilot: [
        { t: 'Agents, then New agent', p: 'Copilot takes skills inside an agent. Open <strong>Agents</strong> in the sidebar and choose <strong>New agent</strong>.',
          side: [CP_SIDE, 3], main: '<div class="ai-menu ai-menu-top"><b>No agents found</b><b class="ai-target">New agent</b><b>More agents</b></div>' },
        { t: 'Skip the builder chat', p: 'On <strong>Build your own specialist agent</strong>, press <strong>Skip</strong> to set it up yourself.',
          side: [CP_SIDE, 3], main: head('Build your own specialist agent', 'Skip →').replace('ai-btn', 'ai-btn ghost ai-target') + '<div class="ai-row"><span>Message Agent Builder</span></div>' },
        { t: 'Name it, then add a skill', p: 'Name the agent (say, <strong>Brotools</strong>). Under <strong>Skills</strong>, press <strong>+ Add</strong> and choose to upload a skill.',
          side: [CP_SIDE, 3], main: '<h4>Brotools</h4>' + row('Instructions', 'Describe what this agent should do') + '<div class="ai-head"><span>Skills</span><span class="ai-btn ghost ai-target">+ Add</span></div>' },
        { t: 'Upload the zip', p: 'Choose <code>' + ZIP + '</code> and press <strong>Upload</strong>.',
          side: [CP_SIDE, 3], main: '<div class="ai-dialog"><h4>Upload skill</h4><div class="ai-drop hot">' + file(true) + '<span>A SKILL.md, or a .zip that holds one</span></div><span class="ai-btn ai-target">Upload</span></div>' },
        { t: 'Create, and add the rest', p: 'Press <strong>Create</strong>, then chat with the agent. One agent can hold every Brotools skill: add the others from <a href="' + HUB + '">all Brotools skills</a>.',
          side: [CP_SIDE, 3], main: head('Brotools', 'Create').replace('ai-btn', 'ai-btn ai-target') + '<p>Skills</p>' + row(SKILL, 'Uploaded') }
      ]
    };
    var NAMES = { claude: 'Claude', chatgpt: 'ChatGPT', grok: 'Grok', gemini: 'Gemini', copilot: 'Copilot' };
    // A word about the plan, shown above the steps for the apps that need one.
    var NOTES = {
      claude: 'Skills run on Claude\'s code tool: keep <strong>Code execution and file creation</strong> on (Settings, Capabilities).',
      chatgpt: 'Skills in ChatGPT are for eligible <strong>Business, Enterprise, Healthcare and Edu</strong> workspaces, and an admin may have to allow uploads. Free and personal Plus accounts usually cannot add them; on Plus or higher, use Codex instead (the last step).',
      gemini: 'Gemini uploads a folder, not a zip, so unzip the download first.',
      copilot: 'Make one <strong>Brotools</strong> agent and add every Brotools skill to it, so one chat reaches all the tools. <a href="' + HUB + '">See all Brotools skills</a>.'
    };
    var STEP_MS = 3000;
    var stage = root.querySelector('.ai-stage');
    var cap = root.querySelector('.ai-cap');
    var list = root.querySelector('.ai-steps');
    var playBtn = root.querySelector('.ai-play');
    var tabs = [].slice.call(root.querySelectorAll('.ai-tab'));
    var note = root.querySelector('.ai-app-note');
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
      stage.innerHTML = '<div class="ai-win"><div class="ai-win-bar"><i></i><i></i><i></i><span>' + (s.win || NAMES[app]) + '</span></div>' +
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
      if (note) { note.innerHTML = NOTES[a] || ''; note.hidden = !NOTES[a]; }
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
