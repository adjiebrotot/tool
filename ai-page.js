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
    var NAME = esc(root.getAttribute('data-name') || 'your tool');
    var REF = esc(root.getAttribute('data-ref') || 'tool.md');
    var NFILES = esc(root.getAttribute('data-files') || '4');
    var HUB = esc(root.getAttribute('data-hub') || '/ai/');
    var DESC = 'Opens Adjie Brotools\' ' + NAME + ' (https://tool.adjiebrotots.com/…) on the user\'s own scenario with one link, and the tool computes the answer.';

    /* ---- A small kit for drawing each app's screens (classes .m-* in ai-page.css) ------------ */
    var P = {
      up: '<path d="M12 16V5M7 10l5-5 5 5M5 20h14"/>', plus: '<path d="M12 5v14M5 12h14"/>',
      search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>', chev: '<path d="M7 10l5 5 5-5"/>',
      right: '<path d="M9 6l6 6-6 6"/>', left: '<path d="M19 12H5M11 6l-6 6 6 6"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
      dots: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
      pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', chat: '<path d="M4 5h16v11H9l-5 4z"/>', folder: '<path d="M3 6h6l2 2h10v11H3z"/>',
      doc: '<path d="M6 3h9l4 4v14H6zM14 3v5h5"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
      mic: '<path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3"/>',
      bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>', dl: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', info: '<circle cx="12" cy="12" r="8"/><path d="M12 11v5M12 8v.5"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>', card: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>',
      gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
      bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
      heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>', globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/>',
      help: '<circle cx="12" cy="12" r="8"/><path d="M10 10a2 2 0 1 1 3 1.7c-.7.4-1 .8-1 1.6M12 16.5v.5"/>', out: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>',
      palette: '<circle cx="12" cy="12" r="8"/><circle cx="9" cy="10" r="1"/><circle cx="14" cy="9" r="1"/>', code: '<path d="M9 8l-4 4 4 4M15 8l4 4-4 4"/>',
      cust: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/><path d="M13 7.5h7M4 16.5h7"/>',
      plug: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/><path d="M16.5 4v7M13 7.5h7"/>',
      agent: '<path d="M8 4l-5 8 5 8M16 4l5 8-5 8M14 4l-4 16"/>', book: '<path d="M5 4h4v16H5zM11 4h4v16h-4zM17 5l3 .8-3.5 14-3-.8z"/>',
      image: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 16l5-5 4 4 2-2 5 5"/>', clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
      video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>', newchat: '<path d="M4 20h4L19 9l-4-4L4 16z"/>'
    };
    var ic = function (n, cls) { return '<svg class="m-i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (P[n] || '') + '</svg>'; };
    var T = function (on) { return on ? ' ai-target' : ''; };
    var nav = function (items) {   // [label, icon, 'on' | 'tg' | 'dim' | 'sec' | '|', right]
      return items.map(function (x) {
        if (x === '|') return '<span class="m-hr"></span>';
        if (x[2] === 'sec') return '<span class="m-sec">' + x[0] + '</span>';
        return '<b class="m-nav' + (x[2] === 'on' || x[2] === 'tg' ? ' on' : '') + (x[2] === 'dim' ? ' dim' : '') + (x[2] === 'kid' ? ' kid' : '') + T(x[2] === 'tg') + '">' + (x[1] ? ic(x[1]) : '') + '<span>' + x[0] + '</span>' + (x[3] || '') + '</b>';
      }).join('');
    };
    var mtabs = function (items, on, tg, cls) {
      return '<div class="m-tabs' + (cls ? ' ' + cls : '') + '">' + items.map(function (t, i) { return '<b class="' + (i === on ? 'on' : '') + T(i === tg) + '">' + t + '</b>'; }).join('') + '</div>';
    };
    var btn = function (label, cls, tg) { return '<span class="m-btn ' + (cls || '') + T(tg) + '">' + label + '</span>'; };
    var search = function (ph) { return '<span class="m-search">' + ic('search') + ph + '</span>'; };
    var menu = function (items, hl, pos) {   // items: [label, icon]
      return '<div class="m-menu" style="' + pos + '">' + items.map(function (x, i) {
        if (x === '|') return '<span class="m-hr"></span>';
        return '<b class="' + (i === hl ? 'hl ai-target' : '') + (x[2] ? ' ' + x[2] : '') + '">' + (x[1] ? ic(x[1]) : '') + '<span>' + x[0] + '</span>' + (x[3] ? '<em>' + x[3] + '</em>' : '') + '</b>';
      }).join('') + '</div>';
    };
    var tile = function (color, icon) { return '<span class="m-tile" style="background:' + color + '">' + ic(icon || 'doc') + '</span>'; };
    var card = function (icon, title, sub, plus, extra) {
      return '<div class="m-card">' + icon + '<div class="m-ct"><b>' + title + '</b><small>' + sub + '</small>' + (extra || '') + '</div>' + (plus ? ic('plus', 'm-plus') : '') + '</div>';
    };
    var lines = function (n) { var s = ''; for (var i = 0; i < n; i++) s += '<span class="m-line" style="width:' + (55 + (i * 17) % 40) + '%"></span>'; return s; };
    var zipChip = function (fly) { return '<span class="ai-file' + (fly ? ' fly' : '') + '">🗜 ' + ZIP + '</span>'; };
    var folderChip = function (fly) { return '<span class="ai-file' + (fly ? ' fly' : '') + '">📁 ' + SKILL + '</span>'; };
    var tog = function (tg) { return '<span class="m-tog' + T(tg) + '"></span>'; };
    var screen = function (side, main, cls) { return '<div class="m-app' + (cls ? ' ' + cls : '') + '"><div class="m-side">' + side + '</div><div class="m-main">' + main + '</div></div>'; };

    /* Claude: claude.ai, Settings, Customize, Skills (as on 7 November 2026) */
    var clChat = nav([['New chat', 'newchat'], ['Search', 'search'], ['Chats', 'chat'], ['Projects', 'folder'], ['Artifacts', 'cust'], ['Code', 'code']]) + '<span class="m-grow"></span>';
    var clSet = function (tg) {
      return '<div class="m-modal-bg"></div><div class="m-modal m-cl-set"><div class="m-row m-mh"><b>Settings</b>' + ic('x') + '</div><div class="m-cols">' +
        '<div class="m-side">' + search('Search') + nav([['Account', 'user'], ['Billing', 'card'], ['Usage', 'clock'], '|', ['Appearance', 'palette'], ['Your Claude', 'user'], ['Capabilities', 'gear'], ['Notifications', 'bell'], ['Privacy', 'lock'], ['Wellbeing', 'heart'], '|', ['Customize', 'cust', tg ? 'tg' : 'on'], ['Code', 'code']]) + '<span class="m-grow"></span><span class="m-sec">API keys ↗</span></div>' +
        '<div class="m-main">';
    };
    var clBar = function (tgSkills, tgAdd) {
      return '<div class="m-row m-bar">' + mtabs(['Connectors', 'Skills', 'Plugins'], tgSkills === 'conn' ? 0 : 1, tgSkills === true ? 1 : -1) + '<span class="m-opt">' + mtabs(['Yours', 'Discover'], 1, -1, 'box') + search('Search') + '</span>' + btn(ic('plus') + 'Add' + ic('chev'), 'dark', tgAdd) + '</div>';
    };
    var clFeed = '<div class="m-hero"><small>From Anthropic</small><b>Data</b><small>Query, chart and explain your data in one place.</small>' + btn('Add', 'dark sm') + '</div>' +
      '<b class="m-h3">For you</b><div class="m-grid2">' +
      card(tile('#f0eee6', 'cust'), 'Productivity', 'Manage tasks, plan your day…', true) + card(tile('#f0eee6', 'doc'), 'Product Management', 'Write feature specs, plan roadmaps…', true) +
      card(tile('#f0eee6', 'clock'), 'Sales', 'Prep calls, summarize and follow up…', true) + card(tile('#f0eee6', 'gear'), 'Operations', 'Optimize business operations…', true) + '</div>';
    var clEnd = '</div></div></div>';

    /* Grok: grok.com, Plugins, Skills */
    var gkSide = function (tg) { return '<b class="m-logo">Grok</b>' + lines(5) + '<span class="m-grow"></span>' + nav([['Plugins', 'plug', tg ? 'tg' : 'on'], ['You', 'user']]); };
    var gkTop = function (tgSkills, tgNew) { return '<div class="m-row m-bar">' + mtabs(['Connectors', 'Skills'], tgSkills === 'conn' ? 0 : 1, tgSkills === true ? 1 : -1) + '<span class="m-grow"></span>' + search('Search...') + btn('New Skill', 'dark pill', tgNew) + '</div>'; };
    var gkMine = card(tile('#2b7bf6', 'bolt'), SKILL, 'Opens Adjie Brotools\' ' + NAME + '…', false, '') ;
    var gkList = function (mine) {
      return '<b class="m-h3">Personal</b><div class="m-grid2 m-flat">' + (mine ? '<div class="ai-target">' + gkMine + '</div>' : '') +
        card(tile('#16a394', 'doc'), 'Word Documents', 'Create, read, and edit Word documents (.docx)') + card(tile('#f2711c', 'doc'), 'PDFs', 'Create, merge, split, and extract from PDFs') +
        card(tile('#16a394', 'clock'), 'Presentations', 'Create, read, and edit PowerPoint presentations (.pptx)') + card(tile('#1d8cf8', 'bolt'), 'Skill Creator', 'Build new custom skills through conversation') +
        card(tile('#e8399b', 'cust'), 'Spreadsheets', 'Create, read, and edit spreadsheet files (.xlsx, .csv)') + '</div>';
    };

    /* Gemini: gemini.google.com, Customise, Skills */
    var gmSide = function (tg) {
      return '<b class="m-logo">✦ Gemini</b>' + nav([['New chat', 'newchat'], ['Library', 'book'], ['Images', 'image'], ['Scheduled', 'clock'], ['Customise', 'gear', tg ? 'tg' : 'on'], ['Videos', 'video'], ['Notebooks', '', 'sec'], ['New notebook', 'plus'], ['All', '', 'sec']]) + lines(4);
    };
    var gmHead = function (tgSkills, tgCreate, installed) {
      return mtabs(['Discover', 'Connectors', 'Skills'], 2, tgSkills ? 2 : -1) + '<div class="m-row"><div><b class="m-h2">Skills</b><small class="m-muted">Add or create skills to extend what Gemini can do</small></div><span class="m-row">' + search('Search') + btn('Create' + ic('chev'), 'out pill', tgCreate) + '</span></div>' +
        (installed ? '<b class="m-h3">Installed (1)</b><div class="ai-target">' + card(tile('#e9eef6', 'doc'), SKILL, 'Opens Adjie Brotools\' ' + NAME + '…') + '</div>' : '') +
        '<b class="m-h3">Recommended</b><div class="m-grid2 m-flat">' + card(tile('#e9eef6', 'doc'), 'Match your writing style', 'Learns your voice from your real…', true) + card(tile('#e9eef6', 'doc'), 'Focus your energy', 'Align your workload with your ene…', true) +
        card(tile('#e9eef6', 'doc'), 'Get more perspectives', 'Get 3-5 distinct viewpoints befor…', true) + card(tile('#e9eef6', 'doc'), 'Generate fresh ideas', 'Turn existing content into 5 entire…', true) + '</div>';
    };

    /* Copilot: copilot.microsoft.com, Agents */
    var cpSide = function (agentsOn) {
      return '<b class="m-logo">Copilot</b>' + nav([['New chat', 'newchat'], ['Search', 'search'], ['Library', 'book'], ['Agents', 'agent', agentsOn ? 'on' : '', ic('right', 'm-r')], ['Notebooks', 'doc'], ['Chats', '', 'sec']]) + '<small class="m-muted">No chats yet. Once you start chatting, you can return to past conversations here.</small>';
    };
    var cpCfg = function (tgAdd, withSkill, tgCreate) {
      return '<div class="m-row m-bar"><span class="m-btn out pill">● Agent Builder</span>' + btn('Configure' + ic('chev'), 'ghost') + '<span class="m-row">' + btn('Create', withSkill ? 'dark' : 'off', tgCreate) + ic('dots') + ic('x') + '</span></div>' +
        '<div class="m-row m-start"><span class="m-tile m-cp-ico">' + ic('agent') + '</span><div><b class="m-h2">New Agent ' + ic('pen') + '</b><small class="m-muted">Describe your agent</small></div></div>' +
        '<div class="m-box"><div class="m-row"><b>Instructions ' + ic('info') + '</b><span class="m-btn out sm">Suggest improvements</span></div><div class="m-area">Describe what this agent should do, define its tone, and outline any rules or guidelines it must follow</div></div>' +
        '<div class="m-box"><div class="m-row"><b>Skills ' + ic('info') + '</b>' + btn(ic('plus') + 'Add' + ic('chev'), 'out sm', tgAdd) + '</div>' +
        (withSkill ? '<div class="m-file">' + ic('doc') + '<span>' + SKILL + '</span></div>' : '<div class="m-empty">Add skills to specialize this agent</div>') + '</div>';
    };

    /* ChatGPT: chatgpt.com, Plugins, Skills (Business, Enterprise, Healthcare and Edu workspaces) */
    var gpSide = function (tg) { return '<b class="m-logo">ChatGPT</b>' + nav([['New chat', 'newchat'], ['Search chats', 'search'], ['Library', 'image'], ['Plugins', 'plug', tg ? 'tg' : 'on']]) + lines(4) + '<span class="m-grow"></span>' + nav([['Your workspace', 'user']]); };
    var gpTop = function (tgSkills, tgCreate) { return '<div class="m-row m-bar">' + mtabs(['Plugins', 'Skills'], 1, tgSkills ? 1 : -1) + '<span class="m-grow"></span>' + search('Search') + btn(ic('plus') + 'Create', 'dark pill', tgCreate) + '</div><small class="m-muted">Skills give ChatGPT instructions and files for a task.</small>'; };

    /* Each step: the caption, the step card's title and text, the window it shows (body), and
       win, the title bar's words when the window is not the assistant (a file manager, a terminal).
       .ai-target marks what the pointer presses (the last one on screen). */
    var STEPS = {
      claude: [
        { t: 'Open Settings', p: 'In Claude (web or desktop), press your name at the bottom left, then <strong>Settings</strong>.',
          body: screen(clChat + nav([['You', 'user', 'on']]),
            '<div class="m-center"><b class="m-h1">How can I help you today?</b><span class="m-input">Ask anything</span></div>' +
            menu([['you@example.com', '', 'dim'], ['Settings', 'gear', '', 'Ctrl+Shift+,'], ['Usage', 'clock'], ['Language', 'globe'], ['Get help', 'help'], ['Send feedback', 'chat', 'dim'], '|', ['Upgrade plan', 'up'], ['Get apps and extensions', 'dl'], ['Learn more', 'info'], '|', ['Get API keys', 'code'], ['Log out', 'out']], 1, 'left:.6em;bottom:2.6em;width:46%')) },
        { t: 'Customize', p: 'In the Settings list, open <strong>Customize</strong> near the bottom.',
          body: screen(clChat, '') + clSet(true) + clBar('conn') + lines(6) + clEnd },
        { t: 'Skills', p: 'Open the <strong>Skills</strong> tab, beside Connectors and Plugins.',
          body: screen(clChat, '') + clSet() + clBar(true) + clFeed + clEnd },
        { t: 'Add, then Upload skill', p: 'Press <strong>+ Add</strong> at the top right and choose <strong>Upload skill</strong>.',
          body: screen(clChat, '') + clSet() + clBar(false) + clFeed + menu([['Upload skill', 'up'], ['Create a skill', 'pen'], ['Create with Claude', 'chat']], 0, 'right:.8em;top:3.3em;width:34%') + clEnd },
        { t: 'Drop the zip, then Upload', p: 'Drag <code>' + ZIP + '</code> onto <strong>Skill file</strong> (keep it zipped) and press <strong>Upload</strong>. A security scan runs as it uploads.',
          body: '<div class="m-page"><small class="m-back">' + ic('left') + 'Skills</small><b class="m-h1">Upload a skill</b><small class="m-muted">Add a skill to your workspace. A security scan runs when you upload.</small>' +
            '<b class="m-label">Skill file</b><div class="m-drop">' + ic('up') + zipChip(true) + '<small>Drag and drop skill files here, or browse — you can add several at once</small></div>' +
            '<ul class="m-ul"><li>.md file must contain skill name and description formatted in YAML</li><li>.zip or .skill file must include a SKILL.md file</li></ul>' +
            '<div class="m-row m-soft"><span>Security scan</span><small class="m-muted">Runs when you upload</small></div>' +
            '<div class="m-row m-start">' + btn('Upload', 'dark', true) + btn('Cancel', 'out') + '</div></div>' },
        { t: 'Switch it on', p: 'The skill opens with its switch on. Press <strong>Try in chat</strong>, or start a new chat and ask your question.',
          body: '<div class="m-page"><small class="m-back">' + ic('left') + 'Skills</small><div class="m-row"><div class="m-row m-start">' + tile('#f0eee6', 'doc') + '<div><b class="m-h2">' + SKILL + ' <span class="m-badge">New</span></b><small class="m-muted">by you · v1 · updated just now</small></div></div>' +
            '<span class="m-row">' + btn(ic('chat') + 'Try in chat', 'dark') + tog(true) + ic('dots') + '</span></div>' +
            mtabs(['Overview', 'Contents · ' + NFILES], 1, -1, 'u') +
            '<div class="m-row"><span class="m-select">' + NAME + ' v1 · current' + ic('chev') + '</span><span class="m-row">' + ic('dl') + btn('Edit', 'out') + '</span></div>' +
            '<div class="m-cols m-tree"><div class="m-side">' + nav([['SKILL.md', '', 'on'], ['references', 'folder'], [REF, '', 'kid'], ['params.json', '', 'kid'], ['scripts', 'folder'], ['build_link.py', '', 'kid']]) + '</div>' +
            '<div class="m-main"><small class="m-mono">/SKILL.md</small><b class="m-h2">' + NAME + ' on tool.adjiebrotots.com</b>' + lines(4) + '</div></div></div>' }
      ],
      chatgpt: [
        { t: 'Plugins, then Skills', p: 'In a Business, Enterprise, Healthcare or Edu workspace, open <strong>Plugins</strong> in the sidebar, then the <strong>Skills</strong> tab.',
          body: screen(gpSide(), gpTop(true) + lines(5)) },
        { t: 'Create, then Upload', p: 'Press <strong>Create</strong> and choose <strong>Upload from your computer</strong>. No Upload? Your admin has not allowed skill uploads yet.',
          body: screen(gpSide(), gpTop(false) + lines(5) + menu([['Create with ChatGPT', 'chat'], ['Upload from your computer', 'up']], 1, 'right:1em;top:3.3em;width:42%')) },
        { t: 'Choose the zip', p: 'Pick <code>' + ZIP + '</code>. ChatGPT scans it before it is ready.',
          body: screen(gpSide(), gpTop(false) + lines(5)) + '<div class="m-modal-bg"></div><div class="m-modal"><div class="m-row m-mh"><b>Upload skill</b>' + ic('x') + '</div><div class="m-drop ai-target">' + ic('up') + zipChip(true) + '<small>Scanning…</small></div><div class="ai-scan"><i></i></div></div>' },
        { t: 'Ready', p: 'The skill shows as on. In a new chat, ask your question.',
          body: screen(gpSide(), gpTop(false) + '<div class="m-row m-soft"><div class="m-row m-start">' + tile('#ececec', 'doc') + '<div><b>' + SKILL + '</b><small class="m-muted">Enabled</small></div></div>' + tog(true) + '</div>' + lines(3)) },
        { t: 'Plus or Pro: use Codex', p: 'No Skills in your ChatGPT? With Plus or higher, Codex reads skills: unzip the download into <code>~/.agents/skills/</code> (older Codex: <code>~/.codex/skills/</code>) and ask Codex your question.',
          win: 'Terminal', body: '<div class="ai-term"><span>$ mkdir -p ~/.agents/skills</span><span class="ai-target">$ unzip ' + ZIP + ' -d ~/.agents/skills</span><span>$ codex</span></div>' }
      ],
      grok: [
        { t: 'Open Plugins', p: 'In Grok, press <strong>Plugins</strong> at the bottom left, just above your name.',
          body: screen(gkSide(true), '<div class="m-center"><b class="m-h1">Grok</b><span class="m-input">What do you want to know?</span></div>') },
        { t: 'Skills', p: 'Open the <strong>Skills</strong> tab, beside Connectors.',
          body: screen(gkSide(), gkTop(true) + gkList()) },
        { t: 'New Skill, then Upload skill file', p: 'Press <strong>New Skill</strong> and choose <strong>Upload skill file</strong>.',
          body: screen(gkSide(), gkTop(false) + gkList() + menu([['Write skill manually', 'pen'], ['Upload skill file', 'up'], ['Create skill with Grok', 'chat']], 1, 'right:1em;top:3.3em;width:36%')) },
        { t: 'Drop the zip', p: 'Drop <code>' + ZIP + '</code> in the box (a .zip, .skill or .md file), or click to browse to it.',
          body: screen(gkSide(), gkTop(false) + gkList()) + '<div class="m-modal-bg"></div><div class="m-modal"><div class="m-row m-mh"><b>Upload Skill</b>' + ic('x') + '</div><div class="m-drop tall ai-target">' + ic('up') + zipChip(true) + '<small>Drop a .zip, .skill, or .md file here<br>or click to browse</small></div></div>' },
        { t: 'Ready', p: 'The skill is listed under <strong>Personal</strong>. Ask your question in a new chat.',
          body: screen(gkSide(), gkTop(false) + gkList(true)) }
      ],
      gemini: [
        { t: 'Unzip it first', p: 'Gemini takes files or a folder, not a zip. Extract <code>' + ZIP + '</code>: you get a folder <strong>' + SKILL + '</strong> with <code>SKILL.md</code> inside.',
          win: 'Files', body: screen(nav([['Downloads', 'dl', 'on'], ['Documents', 'doc'], ['Desktop', 'folder']]),
            '<b class="m-h2">Downloads</b><div class="m-row m-soft"><span>🗜 ' + ZIP + '</span><small class="m-muted">Extract all</small></div><div class="m-row m-soft ai-target"><span>📁 ' + SKILL + '</span><small class="m-muted">SKILL.md, references, scripts</small></div>') },
        { t: 'Customise, then Skills', p: 'In Gemini, open <strong>Customise</strong> in the sidebar, then the <strong>Skills</strong> tab.',
          body: screen(gmSide(), gmHead(true)) },
        { t: 'Create, then Upload', p: 'Press <strong>Create</strong> and choose <strong>Upload</strong>.',
          body: screen(gmSide(), gmHead(false) + menu([['Create with Gemini', 'chat'], ['Create manually', 'pen'], ['Upload', 'up']], 2, 'right:1em;top:6.2em;width:34%')) },
        { t: 'Select the folder', p: 'Select the <strong>' + SKILL + '</strong> folder (the one holding <code>SKILL.md</code>) and press <strong>Continue</strong>.',
          body: screen(gmSide(), gmHead(false)) + '<div class="m-modal-bg"></div><div class="m-modal m-gm-up"><b class="m-h2">Upload skill</b><div class="m-drop">' + ic('up') + folderChip(true) + '<small>Drag or select <u>files</u> or a <u>folder</u><br>(PDF, CSV, PY, TXT and MD files)</small></div>' +
            '<small>Make sure that your file meets these requirements:</small><ul class="m-ul"><li>Use kebab case for the skill name in SKILL.md</li><li>Include a SKILL.md file in the main folder</li></ul>' +
            '<div class="m-row m-end">' + btn('Cancel', 'ghost') + btn('Continue', 'soft pill', true) + '</div></div>' },
        { t: 'Check it, then Create', p: 'Gemini fills in the <strong>Name</strong>, <strong>Description</strong> and <strong>Instructions</strong> from <code>SKILL.md</code>. Leave them as they are and press <strong>Create</strong>.',
          body: screen(gmSide(), '<div class="m-row"><small class="m-back">' + ic('left') + 'Skills</small><span class="m-row">' + btn('Add files', 'ghost pill') + btn('Create', 'soft pill', true) + ic('folder') + '</span></div>' +
            '<div class="m-field"><small>Name</small><span>' + SKILL + '</span></div><div class="m-field"><small>Description</small><span>' + DESC + '</span></div><div class="m-field"><small>Instructions</small><span># ' + NAME + ' on tool.adjiebrotots.com</span></div>') },
        { t: 'Ready', p: 'The skill is under <strong>Installed</strong>. Ask your question in a new chat.',
          body: screen(gmSide(), gmHead(false, false, true)) }
      ],
      copilot: [
        { t: 'Agents, then New agent', p: 'Copilot takes skills inside an agent. Open <strong>Agents</strong> in the sidebar and choose <strong>New agent</strong>.',
          body: screen(cpSide(true), '<span class="m-btn ghost">Auto' + ic('chev') + '</span>' + lines(3) +
            menu([['No agents found', '', 'dim'], '|', ['New agent', 'agent'], ['More agents', 'agent']], 2, 'left:.4em;top:3.2em;width:48%')) },
        { t: 'Skip the builder chat', p: 'On <strong>Build your own specialist agent</strong>, press <strong>Skip</strong> to set it up yourself.',
          body: screen(cpSide(), '<div class="m-row"><b class="m-h1"><span class="m-cp-dot"></span>Build your own <span class="m-muted">specialist agent</span></b>' + btn('Skip' + ic('right'), 'out', true) + '</div><span class="m-grow"></span><span class="m-input">' + ic('plus') + 'Message Agent Builder' + ic('mic') + '</span><span class="m-grow"></span>') },
        { t: 'Name it, then add a skill', p: 'Rename <strong>New Agent</strong> (say, <strong>Brotools</strong>). Under <strong>Skills</strong>, press <strong>+ Add</strong> and choose to upload a skill.',
          body: screen(cpSide(), cpCfg(true)) },
        { t: 'Upload the zip', p: 'Choose <code>' + ZIP + '</code> and press <strong>Upload</strong>.',
          body: screen(cpSide(), cpCfg(false)) + '<div class="m-modal-bg"></div><div class="m-modal"><div class="m-row m-mh"><b>Upload skill</b>' + ic('x') + '</div><div class="m-row m-soft">' + zipChip(true) + ic('trash') + '</div>' +
            '<small><b>File requirements</b></small><ul class="m-ul"><li>Must be a SKILL.md file or a .zip package that includes a SKILL.md file.</li><li>SKILL.md must include a skill name and description in YAML</li></ul><div class="m-row m-end">' + btn('Upload', 'dark', true) + '</div></div>' },
        { t: 'Create, and add the rest', p: 'Press <strong>Create</strong>, then chat with the agent. One agent can hold every Brotools skill: add the others from <a href="' + HUB + '">all Brotools skills</a>.',
          body: screen(cpSide(), cpCfg(false, true, true)) }
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
      stage.setAttribute('data-app', app);
      stage.innerHTML = '<div class="ai-win"><div class="ai-win-bar"><i></i><i></i><i></i><span>' + (s.win || NAMES[app]) + '</span></div>' +
        '<div class="ai-win-body">' + s.body + '</div></div>' + cursor;
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
