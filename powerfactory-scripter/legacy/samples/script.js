(function initTheme() {
  const btn = document.getElementById('themeToggle');
  const apply = (light) => {
    document.body.classList.toggle('light', light);
    btn.textContent = light ? '🌙 Dark' : '☀️ Light';
  };
  apply(localStorage.getItem('pf-theme') !== 'dark');
  btn.addEventListener('click', () => {
    const next = !document.body.classList.contains('light');
    apply(next);
    localStorage.setItem('pf-theme', next ? 'light' : 'dark');
  });
})();

function toggleSection(id) {
  const card = document.getElementById(id);
  const header = card.querySelector('.section-header');
  const body = card.querySelector('.section-body');
  if (!body) return;
  const collapsed = header.classList.contains('collapsed');
  if (collapsed) {
    header.classList.remove('collapsed');
    body.classList.remove('hidden');
  } else {
    header.classList.add('collapsed');
    body.classList.add('hidden');
  }
}


/* ================================================================
   CUSTOM FUNCTION LIBRARY
   Rendered from ../custom-functions.js, the same file the Scripter's
   "Insert a pre-made function" picker reads, so this page and the
   tool can never drift apart.
================================================================ */
function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
  }[c]));
}

/* Python syntax colouring for the library cards, so a pre-made function reads
   here exactly as it does in the Ace editor the Scripter shows it in. */
const PY_KEYWORDS = new Set(['and','as','assert','async','await','break','class','continue',
  'def','del','elif','else','except','finally','for','from','global','if','import','in','is',
  'lambda','nonlocal','not','or','pass','raise','return','try','while','with','yield']);
const PY_CONSTANTS = new Set(['True', 'False', 'None']);
const PY_BUILTINS = new Set(['abs','all','any','bool','dict','enumerate','float','int','len',
  'list','max','min','print','range','round','set','sorted','str','sum','tuple','zip',
  'isinstance','getattr','hasattr','Exception','ValueError','TypeError','ZeroDivisionError','self']);

function highlightPython(code) {
  const token = /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?''')|("(?:\\[\s\S]|[^"\\\n])*"|'(?:\\[\s\S]|[^'\\\n])*')|(\d[\w.]*)|([A-Za-z_]\w*)|(\s+)|([^\s\w]+)/g;
  let out = '', m, prevWord = '';
  while ((m = token.exec(code)) !== null) {
    const [raw, comment, docString, string, number, word, space] = m;
    const text = escapeHtml(raw);
    if (word) {
      if (prevWord === 'def' || prevWord === 'class') out += '<span class="py-def">' + text + '</span>';
      else if (PY_KEYWORDS.has(word))                 out += '<span class="py-kw">' + text + '</span>';
      else if (PY_CONSTANTS.has(word))                out += '<span class="py-const">' + text + '</span>';
      else if (PY_BUILTINS.has(word))                 out += '<span class="py-builtin">' + text + '</span>';
      else if (code[token.lastIndex] === '(')         out += '<span class="py-call">' + text + '</span>';
      else                                            out += text;
      prevWord = word;
      continue;
    }
    if (comment)                   out += '<span class="py-com">' + text + '</span>';
    else if (docString || string)  out += '<span class="py-str">' + text + '</span>';
    else if (number)               out += '<span class="py-num">' + text + '</span>';
    else if (space)                out += text;
    else                           out += '<span class="py-op">' + text + '</span>';
    if (!space) prevWord = '';
  }
  return out;
}

function renderCustomFnLibrary() {
  const host = document.getElementById('custom-fn-list');
  const lib  = window.CUSTOM_FN_LIBRARY;
  if (!host || !lib) return;

  const categories = window.CUSTOM_FN_CATEGORIES || [...new Set(lib.map(e => e.category))];
  host.innerHTML = categories.map(category => {
    const entries = lib.filter(e => e.category === category);
    const cards = entries.map(entry => `
      <div class="fn-card" id="fn-${entry.id}">
        <div class="fn-card-head">
          <span class="fn-card-name">${escapeHtml(entry.fnName)}</span>
          <span class="fn-card-badge">${escapeHtml(entry.study)}</span>
        </div>
        <p class="fn-card-summary">${escapeHtml(entry.summary)}</p>
        <ul class="assumption-list fn-card-args">
          ${(entry.args || []).map(a => `<li><code>${escapeHtml(a.name)}</code> ${escapeHtml(a.hint)}</li>`).join('')}
        </ul>
        <pre class="fn-card-code"><code>${highlightPython(entry.code)}</code></pre>
        <div class="fn-card-foot">
          <span>Returns ${escapeHtml(entry.returns)}</span>
          ${(entry.tune || []).length
            ? `<span>Edit in the body: ${entry.tune.map(c => `<code>${escapeHtml(c)}</code>`).join(' ')}</span>`
            : ''}
        </div>
      </div>`).join('');
    return `<div class="fn-cat">
        <button type="button" class="fn-cat-title collapsed" aria-expanded="false" onclick="toggleFnCat(this)">
          <span class="fn-cat-caret">&#9662;</span>
          <span class="fn-cat-name">${escapeHtml(category)}</span>
          <span class="fn-cat-count">${entries.length}</span>
        </button>
        <div class="fn-cat-body hidden">${cards}</div>
      </div>`;
  }).join('');

  const count = document.getElementById('custom-fn-count');
  if (count) count.textContent = lib.length;
}

/* Every category starts collapsed, so the library opens as a short index of
   what is on offer rather than fourteen screens of code. */
function toggleFnCat(titleEl) {
  const body = titleEl.nextElementSibling;
  if (!body) return;
  const open = !titleEl.classList.toggle('collapsed');
  body.classList.toggle('hidden', !open);
  titleEl.setAttribute('aria-expanded', String(open));
}

/* A link such as samples/#custom-fn-library must open the card it points at,
   because every card but the FAQ and the model list starts collapsed. */
function openCardFromHash() {
  const id = (location.hash || '').replace('#', '');
  if (!id) return;
  const card = document.getElementById(id);
  if (!card) return;

  /* A deep link to one function, samples/#fn-<id>, has to open the library
     card and the collapsed category that function sits in as well. */
  if (card.classList.contains('fn-card')) {
    const library = document.getElementById('custom-fn-library');
    if (library) {
      library.querySelector('.section-header')?.classList.remove('collapsed');
      library.querySelector('.section-body')?.classList.remove('hidden');
    }
    const title = card.closest('.fn-cat')?.querySelector('.fn-cat-title');
    if (title && title.classList.contains('collapsed')) toggleFnCat(title);
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  if (!card.classList.contains('section-card')) return;
  const header = card.querySelector('.section-header');
  const body   = card.querySelector('.section-body');
  if (header && body) {
    header.classList.remove('collapsed');
    body.classList.remove('hidden');
  }
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.section-card').forEach((card) => {
    const header = card.querySelector('.section-header');
    const body = card.querySelector('.section-body');
    if (!header || !body || card.id === 'faq' || card.id === 'models') return;
    header.classList.add('collapsed');
    body.classList.add('hidden');
  });
  renderCustomFnLibrary();
  openCardFromHash();
});

window.addEventListener('hashchange', openCardFromHash);

function toggleFaq(questionEl) {
  const answer = questionEl.nextElementSibling;
  const open = answer.classList.contains('open');
  if (open) {
    answer.classList.remove('open');
    questionEl.classList.remove('open');
  } else {
    answer.classList.add('open');
    questionEl.classList.add('open');
  }
}
