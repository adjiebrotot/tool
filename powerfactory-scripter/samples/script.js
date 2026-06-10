(function initTheme() {
  const btn = document.getElementById('themeToggle');
  const apply = (light) => {
    document.body.classList.toggle('light', light);
    btn.textContent = light ? '🌙 Dark' : '☀️ Light';
  };
  apply(localStorage.getItem('pf-theme') === 'light');
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


document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.section-card').forEach((card) => {
    const header = card.querySelector('.section-header');
    const body = card.querySelector('.section-body');
    if (!header || !body || card.id === 'faq') return;
    header.classList.add('collapsed');
    body.classList.add('hidden');
  });
});

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
