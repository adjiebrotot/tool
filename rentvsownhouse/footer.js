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
      '.page-footer{margin:0 auto;padding:0 0 24px;}',
      '.page-footer-info{margin-top:8px;padding:16px 18px;background:var(--card-bg);border:1px solid var(--border);border-radius:14px;}',
      '.page-footer-info p{margin:0 0 12px;color:var(--muted);line-height:1.6;font-size:.9rem;}',
      '.page-footer-info p:last-child{margin-bottom:0;}',
      '.page-footer-info a{color:var(--accent-strong);}',
    ].join('');
    document.head.appendChild(style);
  }

  window.renderRVOFooter = function(logosPath, containerId){
    logosPath  = logosPath  || '../logos/';
    containerId = containerId || 'siteFooterContent';
    var el = document.getElementById(containerId);
    if(!el) return;
    el.innerHTML = '<p>'
      + '<strong>Disclaimer:</strong> This tool is provided on an “as is” and “as available” basis, free of charge, without any representations or warranties of any kind, whether express or implied. Any outputs, results, interpretations, or decisions made using this tool are solely the responsibility of the user. Users are responsible for obtaining their own professional advice before making any decisions.'
      + '</p>'
      + '<p>'
      + 'If you encounter any bugs or technical issues, please report them to <a href="mailto:adjiebrotots@gmail.com">adjiebrotots@gmail.com</a>. If you’re interested, confused, or would like help learning how to use the tool, feel free to email me as well 🙂'
      + '</p>'
      + '<div style="margin-top:1.25rem;padding-top:1rem;border-top:1px solid var(--border);display:grid;grid-template-columns:auto 1fr;column-gap:14px;row-gap:4px;align-items:center">'
      +   '<img src="' + logosPath + 'australian.png" alt="Australian Made" style="grid-row:1/3;height:36px;width:auto;object-fit:contain">'
      +   '<div style="display:flex;align-items:center;gap:10px">'
      +     '<img src="' + logosPath + 'gpl.png" alt="GNU GPL" style="height:16px;width:auto;flex-shrink:0;border-radius:3px">'
      +     '<span style="color:var(--muted);font-size:0.85rem">Licensed under <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener">GNU GPL</a> — free to use, modify, and share with source code disclosed.</span>'
      +   '</div>'
      +   '<div style="display:flex;align-items:center;gap:10px">'
      +     '<img src="' + logosPath + 'indonesian.png" alt="100% Indonesia" style="height:16px;width:auto;flex-shrink:0;border-radius:3px">'
      +     '<span style="color:var(--muted);font-size:0.85rem">Made in Australia by Indonesian engineer.</span>'
      +   '</div>'
      + '</div>';
  };
})();
