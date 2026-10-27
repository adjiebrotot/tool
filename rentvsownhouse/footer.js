// Shared footer renderer for the Rent vs Own calculator.
// Usage: renderRVOFooter(logosPath)
//   logosPath — path prefix to the /logos/ directory, relative to the calling page.
//               e.g. '../logos/' from rentvsownhouse/index.html
//                    '../../logos/' from rentvsownhouse/sensitivity/index.html
(function(){
  // Inject required CSS once
  if(!document.getElementById('rvo-footer-styles')){
    var style = document.createElement('style');
    style.id = 'rvo-footer-styles';
    style.textContent = [
      '.page-footer{max-width:1600px;margin:0 auto;padding:0 24px 24px;}',
      '.page-footer-info{margin-top:8px;padding:16px 18px;background:var(--card-bg);border:1px solid var(--border);border-radius:14px;}',
      '.page-footer-info p{margin:0 0 12px;color:var(--muted);line-height:1.6;font-size:.9rem;}',
      '.page-footer-info p:last-child{margin-bottom:0;}',
      '.page-footer-info a{color:var(--accent-strong);text-decoration:none;}',
      '.page-footer-info a:hover{text-decoration:underline;}',
    ].join('');
    document.head.appendChild(style);
  }

  // "Updated <date>" from the data-updated stamp _ref/updated.mjs puts on the footer section.
  var MONTHS = {
    en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
    id: ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
  };
  function updated(el, isId){
    var d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(el.getAttribute('data-updated') || '');
    if(!d) return '';
    return ' · <span class="footer-updated">' + (isId ? 'Diperbarui' : 'Updated') + ' <time datetime="' + d[0] + '">'
      + (+d[3]) + ' ' + MONTHS[isId ? 'id' : 'en'][d[2] - 1] + ' ' + d[1] + '</time></span>';
  }

  window.renderRVOFooter = function(logosPath, containerId){
    logosPath  = logosPath  || '../logos/';
    containerId = containerId || 'siteFooterContent';
    var el = document.getElementById(containerId);
    if(!el) return;
    var rootPath = logosPath.replace(/logos\/$/, '');
    // An Indonesian page links the Indonesian Disclaimer and Privacy Policy.
    var isId = document.documentElement.lang === 'id';
    var legal = isId
      ? '<a href="' + rootPath + 'disclaimer/id/">Penafian</a> · <a href="' + rootPath + 'privacy/id/">Kebijakan Privasi</a>'
      : '<a href="' + rootPath + 'disclaimer/">Disclaimer</a> · <a href="' + rootPath + 'privacy/">Privacy Policy</a>';
    el.innerHTML = '<p class="footer-collab"><strong>A hobby project, open to collaboration.</strong> This tool is free and earns me no revenue. If your organisation could use a custom tool or training, <a href="mailto:adjiebrotots@gmail.com?subject=Collaboration">let’s talk</a>. Bugs or questions: <a href="mailto:adjiebrotots@gmail.com">adjiebrotots@gmail.com</a> 🙂</p>'
      + '<p class="footer-links">' + legal + ' · <a href="https://blog.adjiebrotots.com/">Blog</a>' + updated(el, isId) + '</p>'
      + '<div style="margin-top:1.25rem;padding-top:1rem;border-top:1px solid var(--border);display:grid;grid-template-columns:auto 1fr;column-gap:14px;row-gap:4px;align-items:center">'
      +   '<img src="' + logosPath + 'australian.png" alt="Australian flag" style="grid-row:1/3;height:36px;width:auto;object-fit:contain">'
      +   '<div style="display:flex;align-items:center;gap:10px">'
      +     '<img src="' + logosPath + 'gpl.png" alt="GNU GPL" style="height:16px;width:auto;flex-shrink:0;border-radius:3px">'
      +     '<span style="color:var(--muted);font-size:0.76rem">Licensed under <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener">GNU GPL</a>: free to use, modify, and share with source code disclosed.</span>'
      +   '</div>'
      +   '<div style="display:flex;align-items:center;gap:10px">'
      +     '<img src="' + logosPath + 'indonesian.png" alt="Indonesian badge" style="height:16px;width:auto;flex-shrink:0;border-radius:3px">'
      +     '<span style="color:var(--muted);font-size:0.76rem">Made in Australia by <a href="https://www.adjiebrotots.com/about/" rel="author">Adjie Brotosukmono</a>, an Indonesian engineer.</span>'
      +   '</div>'
      + '</div>';
  };
})();
