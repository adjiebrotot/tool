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

function renderCustomFnLibrary() {
  const host = document.getElementById('custom-fn-list');
  const lib  = window.CUSTOM_FN_LIBRARY;
  if (!host || !lib) return;

  const categories = window.CUSTOM_FN_CATEGORIES || [...new Set(lib.map(e => e.category))];
  host.innerHTML = categories.map(category => {
    const cards = lib.filter(e => e.category === category).map(entry => `
      <div class="fn-card" id="fn-${entry.id}">
        <div class="fn-card-head">
          <span class="fn-card-name">${escapeHtml(entry.fnName)}</span>
          <span class="fn-card-badge">${escapeHtml(entry.study)}</span>
        </div>
        <p class="fn-card-summary">${escapeHtml(entry.summary)}</p>
        <ul class="assumption-list fn-card-args">
          ${(entry.args || []).map(a => `<li><code>${escapeHtml(a.name)}</code> ${escapeHtml(a.hint)}</li>`).join('')}
        </ul>
        <pre class="fn-card-code">${escapeHtml(entry.code)}</pre>
        <div class="fn-card-foot">
          <span>Returns ${escapeHtml(entry.returns)}</span>
          ${(entry.tune || []).length
            ? `<span>Edit in the body: ${entry.tune.map(c => `<code>${escapeHtml(c)}</code>`).join(' ')}</span>`
            : ''}
        </div>
      </div>`).join('');
    return `<div class="fn-cat">
        <div class="fn-cat-title">${escapeHtml(category)}</div>
        ${cards}
      </div>`;
  }).join('');

  const count = document.getElementById('custom-fn-count');
  if (count) count.textContent = lib.length;
}

/* A link such as samples/#custom-fn-library must open the card it points at,
   because every card but the FAQ and the model list starts collapsed. */
function openCardFromHash() {
  const id = (location.hash || '').replace('#', '');
  if (!id) return;
  const card = document.getElementById(id);
  if (!card || !card.classList.contains('section-card')) return;
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
