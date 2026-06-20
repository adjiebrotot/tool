(function () {
  'use strict';

  /* ════════════════════════════════════════════════════════════════
     Markdown Reader & Markdown → PDF Converter
     - Renders Markdown with optional LaTeX, code highlighting,
       Mermaid diagrams/charts, and an auto Table of Contents.
     - Exports a high-quality, paginated, vector PDF via the browser's
       native print pipeline. Pages are composed manually so we can:
         * keep headings with their following content (no orphan headings)
         * split long paragraphs / lists across pages
         * split tables across pages and REPEAT the header rows
         * stamp a "Made using…" watermark on random pages only
     - PDF is ALWAYS rendered in LIGHT mode (dark is display-only).
     ════════════════════════════════════════════════════════════════ */

  // ── Watermark logo (logos/logo.svg), base64-inlined so the PDF is self-contained ──
  const WM_LOGO_SRC = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDY4MCA2ODAiIHJvbGU9ImltZyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8dGl0bGU+QXJjaGVkIEEgTG9nbzwvdGl0bGU+CiAgPGRlc2M+QSBzbGVlayB3aGl0ZSBsZXR0ZXIgQSB3aG9zZSBsZWdzIGZvbGxvdyB0aGUgY2lyY2xlIGN1cnZhdHVyZSwgc3Bhbm5pbmcgODAlIG9mIHRoZSBjaXJjbGUgaGVpZ2h0PC9kZXNjPgoKICA8Y2lyY2xlIGN4PSIzNDAiIGN5PSIzNDAiIHI9IjMwMCIgZmlsbD0iIzAwNTJjYyIvPgoKICA8IS0tIExlZnQgbGVnOiAxMTPCsCB0byAyNDXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyNDIsNTcwIEEgMjUwLDI1MCAwIDAgMSAyMzQsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFRvcCBhcmNoOiAyNDXCsCB0byAyOTXCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSAyMzQsMTEzIEEgMjUwLDI1MCAwIDAgMSA0NDYsMTEzIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIFJpZ2h0IGxlZzogMjk1wrAgdG8gNjfCsCBjbG9ja3dpc2Ugb24gcj0yNTAgLS0+CiAgPHBhdGggZD0iTSA0NDYsMTEzIEEgMjUwLDI1MCAwIDAgMSA0MzgsNTcwIiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQ2IiBzdHJva2UtbGluZWNhcD0iYnV0dCIvPgoKICA8IS0tIENyb3NzYmFyIC0tPgogIDxsaW5lIHgxPSIxMTMiIHkxPSIzNTQiIHgyPSI1NjciIHkyPSIzNTQiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iNDIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K';

  // ── Page geometry (px @96dpi ≈ A4) ──
  const PAGE_W = 794;            // 210mm
  const PAGE_H = 1123;           // 297mm
  const PAD_X  = 64;
  const PAD_Y  = 72;
  // Conservative content height — leaves a little slack so margin-collapse /
  // sub-pixel rounding never bleeds into a phantom extra page.
  const CONTENT_H = PAGE_H - PAD_Y * 2 - 14;
  const CONTENT_W = PAGE_W - PAD_X * 2;
  // Minimum vertical room that must remain after a heading for it to stay on a
  // page. If less than this is left, the heading is pushed to the next page so
  // it is never stranded alone at the bottom (requirement 3).
  const MIN_AFTER_HEADING = 120;

  // ── State ──
  const state = {
    text: '',
    latex: true,
    code: true,
    diagram: true,
    toc: true,
    editing: false
  };

  // ── Element refs ──
  let mdBody, docScroll, workspace, dropZone, fileInput, themeToggle,
      pdfStage, overlay, overlayMsg, hljsLight, hljsDark, editToggle, mdEditor;

  /* ────────────────────────────────────────────────────────────────
     THEME
     ──────────────────────────────────────────────────────────────── */
  function applyTheme(light) {
    document.body.classList.toggle('light', light);
    if (themeToggle) themeToggle.textContent = light ? '🌙 Dark' : '☀️ Light';
    if (hljsLight) hljsLight.disabled = !light;
    if (hljsDark)  hljsDark.disabled  = light;
    try { localStorage.setItem('md2pdf-theme', light ? 'light' : 'dark'); } catch (e) {}
  }

  /* ────────────────────────────────────────────────────────────────
     RENDER PIPELINE
     ──────────────────────────────────────────────────────────────── */
  function slugify(s, used) {
    let base = (s || 'section').toLowerCase().trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-') || 'section';
    let id = base, i = 1;
    while (used.has(id)) { id = base + '-' + (++i); }
    used.add(id);
    return id;
  }

  function assignHeadingIds(root) {
    const used = new Set();
    root.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => {
      if (!h.id) h.id = slugify(h.textContent, used);
      else used.add(h.id);
    });
  }

  function insertTOC(root) {
    const heads = Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6'))
      .filter(h => !h.closest('.md-toc'));
    if (heads.length < 2) return; // not worth a TOC

    const toc = document.createElement('nav');
    toc.className = 'md-toc';
    const title = document.createElement('div');
    title.className = 'md-toc-title';
    title.textContent = 'Table of Contents';
    const ul = document.createElement('ul');
    heads.forEach(h => {
      const lvl = parseInt(h.tagName.substring(1), 10);
      const li = document.createElement('li');
      li.className = 'lvl-' + lvl;
      const a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent;
      li.appendChild(a);
      ul.appendChild(li);
    });
    toc.appendChild(title);
    toc.appendChild(ul);
    root.insertBefore(toc, root.firstChild);
  }

  function prepMermaidBlocks(root) {
    root.querySelectorAll('pre > code.language-mermaid, pre > code.lang-mermaid')
      .forEach(code => {
        const pre = code.parentElement;
        const div = document.createElement('div');
        div.className = 'mermaid';
        div.textContent = code.textContent;
        pre.replaceWith(div);
      });
  }

  function highlightCode(root) {
    if (typeof hljs === 'undefined') return;
    root.querySelectorAll('pre code').forEach(code => {
      if (code.closest('.mermaid')) return;
      try { hljs.highlightElement(code); } catch (e) {}
    });
  }

  function renderMath(root) {
    if (typeof renderMathInElement === 'undefined') return;
    try {
      renderMathInElement(root, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false,
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
      });
    } catch (e) {}
  }

  function runMermaid(root) {
    if (typeof mermaid === 'undefined') return;
    const nodes = Array.from(root.querySelectorAll('.mermaid'));
    if (!nodes.length) return;
    nodes.forEach((n, i) => n.id = 'mmd-' + Date.now().toString(36) + '-' + i);
    try {
      mermaid.run({ nodes }).catch(() => {});
    } catch (e) {}
  }

  // Wrap each table in a horizontally scrollable box that can be dragged/panned
  // (screen view only). Wide tables no longer push a scrollbar to the very
  // bottom of the document — they pan in place. The wrapper is stripped before
  // PDF pagination, so export is unaffected.
  function enhanceTables(root) {
    root.querySelectorAll('table').forEach(table => {
      const parent = table.parentNode;
      if (parent && parent.classList && parent.classList.contains('table-scroll')) return;
      const wrap = document.createElement('div');
      wrap.className = 'table-scroll';
      parent.insertBefore(wrap, table);
      wrap.appendChild(table);
      enableDragScroll(wrap);
    });
    markScrollableTables(root);
    // Re-measure once layout/fonts settle so borderline tables are caught.
    requestAnimationFrame(() => markScrollableTables(root));
  }

  // Flag wrappers whose table actually overflows so the grab cursor only shows
  // when there is something to pan to.
  function markScrollableTables(root) {
    root.querySelectorAll('.table-scroll').forEach(wrap => {
      wrap.classList.toggle('is-scrollable', wrap.scrollWidth > wrap.clientWidth + 1);
    });
  }

  // Click-and-drag horizontal panning for a scroll container.
  function enableDragScroll(el) {
    let down = false, startX = 0, startLeft = 0, moved = false;
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0 || !el.classList.contains('is-scrollable')) return;
      down = true; moved = false;
      startX = e.clientX;
      startLeft = el.scrollLeft;
      el.classList.add('dragging');
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
    });
    el.addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      el.scrollLeft = startLeft - dx;
    });
    const end = e => {
      if (!down) return;
      down = false;
      el.classList.remove('dragging');
      try { el.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    // Swallow the click that follows a real drag so panning doesn't trigger
    // link navigation inside the table.
    el.addEventListener('click', e => {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
    }, true);
  }

  /* ────────────────────────────────────────────────────────────────
     STICKY TABLE HEADERS  (screen view only)
     While a long table is scrolled past the top of the document view, a
     floating clone of its header row is pinned to the top so column
     meanings stay visible all the way down to the last row. This is a
     pure on-screen affordance: the floating clone lives in the scroll
     container (not in #mdBody), so PDF pagination — which reads the bare
     <table> from #mdBody — never sees it and the export is unchanged.
     ──────────────────────────────────────────────────────────────── */
  let stickyFloat = null;   // floating header container (lazily created)
  let stickyActive = null;  // the .table-scroll currently mirrored
  let stickyRaf = 0;

  function getStickyFloat() {
    if (stickyFloat && stickyFloat.isConnected) return stickyFloat;
    stickyFloat = document.createElement('div');
    stickyFloat.className = 'md-sticky-thead md-body';
    stickyFloat.setAttribute('aria-hidden', 'true');
    docScroll.appendChild(stickyFloat);
    return stickyFloat;
  }

  function clearStickyHeader() {
    if (stickyFloat) {
      stickyFloat.classList.remove('visible');
      stickyFloat.innerHTML = '';
    }
    stickyActive = null;
  }

  // Mirror a wrapper's table into the floating header. The whole table is
  // cloned (then vertically clipped to the header row by the container) so
  // the cloned columns line up with the real ones automatically.
  function buildStickyClone(wrap) {
    const table = wrap.querySelector(':scope > table');
    if (!table) return;
    const float = getStickyFloat();
    float.innerHTML = '';
    const clone = table.cloneNode(true);
    clone.style.width = table.offsetWidth + 'px';
    clone.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    float.appendChild(clone);
  }

  function updateStickyHeader() {
    stickyRaf = 0;
    if (state.editing || !workspace.classList.contains('active')) { clearStickyHeader(); return; }
    const wraps = mdBody.querySelectorAll('.table-scroll');
    if (!wraps.length) { clearStickyHeader(); return; }

    const anchorTop = docScroll.getBoundingClientRect().top;
    let chosen = null, chosenHead = 0;
    for (const wrap of wraps) {
      const table = wrap.querySelector(':scope > table');
      const thead = table && table.querySelector('thead');
      if (!thead) continue;
      const r = table.getBoundingClientRect();
      const hH = thead.getBoundingClientRect().height;
      // Header floats once the real header has scrolled above the view top
      // and stays until the last row reaches the top.
      if (r.top < anchorTop - 1 && r.bottom > anchorTop + hH) {
        chosen = wrap; chosenHead = hH; break;
      }
    }
    if (!chosen) { clearStickyHeader(); return; }

    if (chosen !== stickyActive) {
      buildStickyClone(chosen);
      stickyActive = chosen;
    }
    const float = getStickyFloat();
    const wrapRect = chosen.getBoundingClientRect();
    float.style.top = anchorTop + 'px';
    float.style.left = wrapRect.left + 'px';
    float.style.width = chosen.clientWidth + 'px';
    float.style.height = chosenHead + 'px';
    float.scrollLeft = chosen.scrollLeft; // keep horizontal pan in sync
    float.classList.add('visible');
  }

  function scheduleSticky() {
    if (stickyRaf) return;
    stickyRaf = requestAnimationFrame(updateStickyHeader);
  }

  function render() {
    if (!state.text) return;
    let html;
    try {
      html = marked.parse(state.text, { gfm: true, breaks: false, headerIds: false, mangle: false });
    } catch (e) {
      html = '<p>Could not parse this Markdown.</p>';
    }
    if (typeof DOMPurify !== 'undefined') {
      html = DOMPurify.sanitize(html, { ADD_ATTR: ['start', 'align', 'colspan', 'rowspan', 'target'] });
    }
    mdBody.innerHTML = html;

    assignHeadingIds(mdBody);
    if (state.toc) insertTOC(mdBody);
    if (state.diagram) prepMermaidBlocks(mdBody);
    if (state.code) highlightCode(mdBody);
    if (state.latex) renderMath(mdBody);
    if (state.diagram) runMermaid(mdBody);
    enhanceTables(mdBody);

    // Content changed — drop any stale floating header and re-evaluate.
    clearStickyHeader();
    scheduleSticky();
  }

  /* ────────────────────────────────────────────────────────────────
     PDF PAGINATION
     ──────────────────────────────────────────────────────────────── */
  const ctx = { content: null };

  function newPage() {
    const page = document.createElement('div');
    page.className = 'pdf-page';
    const content = document.createElement('div');
    content.className = 'pdf-page-content md-body';
    page.appendChild(content);
    pdfStage.appendChild(page);
    ctx.content = content;
    return content;
  }

  function overflowing() {
    return ctx.content.scrollHeight > CONTENT_H;
  }

  // Does this table overflow `maxWidth`? We clone it into an offscreen probe
  // constrained to exactly `maxWidth`, mirroring the real page, and check
  // whether the table is forced wider than that (its min-content exceeds the
  // available width even with full text wrapping). This is deterministic —
  // measuring "natural width" inside a shrink-to-fit container is not, because
  // browsers resolve a width:100% table's percentage against such a container
  // inconsistently.
  function tableOverflows(table, maxWidth) {
    const probe = document.createElement('div');
    probe.className = 'md-body';
    probe.style.cssText =
      'position:absolute;visibility:hidden;left:-99999px;top:0;width:' + maxWidth + 'px';
    const clone = table.cloneNode(true);
    probe.appendChild(clone);
    document.body.appendChild(probe);
    const exceeds = clone.scrollWidth > maxWidth + 1;
    document.body.removeChild(probe);
    return exceeds;
  }

  // Shrink a table's font size and cell padding (in place) until it fits
  // within maxWidth, or until a minimum readable size is reached.
  function shrinkTableToFit(table, maxWidth) {
    let fontSize = 0.92;
    let padX = 12;
    let padY = 8;
    const minFont = 0.55;
    while (tableOverflows(table, maxWidth) && fontSize > minFont) {
      fontSize = Math.round((fontSize - 0.05) * 100) / 100;
      padX = Math.max(3, padX - 1);
      padY = Math.max(2, padY - 0.5);
      table.style.fontSize = fontSize + 'rem';
      table.querySelectorAll('th,td').forEach(c => {
        c.style.padding = padY + 'px ' + padX + 'px';
      });
    }
  }

  function isHeading(node) {
    return node.nodeType === 1 && /^H[1-6]$/.test(node.tagName);
  }

  // Remove trailing heading(s) from the current page (so a heading that would
  // otherwise be left alone follows its content onto the next page). Only peels
  // if non-heading content remains, to avoid emptying the page entirely.
  function peelTrailingHeadings() {
    const c = ctx.content;
    const peeled = [];
    while (c.lastElementChild && isHeading(c.lastElementChild)) {
      let hasOther = false;
      for (const el of c.children) { if (!isHeading(el)) { hasOther = true; break; } }
      if (!hasOther) break;
      peeled.unshift(c.removeChild(c.lastElementChild));
    }
    return peeled;
  }

  // Break a string of words into individual " word" text nodes; clone inline
  // elements as atomic tokens. Used to flow long paragraphs across pages.
  function tokenize(node) {
    const tokens = [];
    node.childNodes.forEach(child => {
      if (child.nodeType === 3) {
        const parts = child.textContent.split(/(\s+)/);
        parts.forEach(p => { if (p.length) tokens.push(document.createTextNode(p)); });
      } else {
        tokens.push(child.cloneNode(true));
      }
    });
    return tokens;
  }

  // Flow an inline-content block (paragraph, etc.) across pages by words.
  function splitInline(node) {
    const tokens = tokenize(node);
    let seg = node.cloneNode(false);
    ctx.content.appendChild(seg);
    for (const tok of tokens) {
      seg.appendChild(tok);
      if (overflowing()) {
        seg.removeChild(tok);
        if (!seg.childNodes.length) {
          // a single token taller than a page — accept it (clipped)
          seg.appendChild(tok);
          continue;
        }
        newPage();
        seg = node.cloneNode(false);
        ctx.content.appendChild(seg);
        // skip leading whitespace token at the top of a fresh segment
        if (!(tok.nodeType === 3 && !tok.textContent.trim())) seg.appendChild(tok);
      }
    }
  }

  // Split a list across pages, one <li> at a time, preserving numbering.
  function splitList(list) {
    const items = Array.from(list.children).filter(el => el.tagName === 'LI');
    const ordered = list.tagName === 'OL';
    let startAt = ordered ? (parseInt(list.getAttribute('start'), 10) || 1) : 1;
    let counter = startAt;

    function freshList(start) {
      const l = list.cloneNode(false);
      if (ordered) l.setAttribute('start', start);
      ctx.content.appendChild(l);
      return l;
    }
    let cur = freshList(counter);
    for (const li of items) {
      cur.appendChild(li);
      if (overflowing()) {
        cur.removeChild(li);
        if (!cur.children.length) { cur.appendChild(li); counter++; continue; }
        newPage();
        cur = freshList(counter);
        cur.appendChild(li);
      }
      counter++;
    }
  }

  // Split a table across pages, repeating the header rows on every page.
  function splitTable(table) {
    const thead = table.querySelector('thead');
    let rows;
    const tbody = table.querySelector('tbody');
    if (tbody) rows = Array.from(tbody.children).filter(r => r.tagName === 'TR');
    else rows = Array.from(table.querySelectorAll('tr')).filter(r => !thead || !thead.contains(r));

    function freshTable() {
      const t = table.cloneNode(false);
      if (thead) t.appendChild(thead.cloneNode(true));
      const tb = document.createElement('tbody');
      t.appendChild(tb);
      ctx.content.appendChild(t);
      return tb;
    }
    let body = freshTable();
    for (const row of rows) {
      body.appendChild(row);
      if (overflowing()) {
        body.removeChild(row);
        if (!body.children.length) { body.appendChild(row); continue; }
        newPage();
        body = freshTable();
        body.appendChild(row);
      }
    }
  }

  // Shrink oversized atomic media (images / diagrams) to fit one page.
  function fitMedia(node) {
    node.querySelectorAll && node.querySelectorAll('img, svg').forEach(m => {
      m.style.maxHeight = (CONTENT_H - 10) + 'px';
      m.style.maxWidth = '100%';
      m.style.height = 'auto';
    });
    if (node.tagName === 'IMG' || node.tagName === 'SVG') {
      node.style.maxHeight = (CONTENT_H - 10) + 'px';
      node.style.height = 'auto';
    }
  }

  function splittable(node) {
    const t = node.tagName;
    return t === 'TABLE' || t === 'UL' || t === 'OL' ||
           t === 'P' || t === 'BLOCKQUOTE' || /^H[1-6]$/.test(t);
  }

  // Flow a block across pages starting on the CURRENT page (which may already
  // hold content, e.g. a preceding heading). Splittable blocks are divided;
  // atomic media is scaled to fit and accepted.
  function flowBlock(node) {
    const t = node.tagName;
    if (t === 'TABLE') return splitTable(node);
    if (t === 'UL' || t === 'OL') return splitList(node);
    if (t === 'P' || t === 'BLOCKQUOTE' || /^H[1-6]$/.test(t)) return splitInline(node);
    fitMedia(node);
    ctx.content.appendChild(node);
  }

  // Place a block alone on an (assumed empty) page; split if taller than a page.
  function placeOnEmpty(node) {
    ctx.content.appendChild(node);
    if (!overflowing()) return;
    ctx.content.removeChild(node);
    flowBlock(node);
  }

  function pageOnlyHeadings() {
    const c = ctx.content;
    if (!c.childElementCount) return false;
    for (const el of c.children) { if (!isHeading(el)) return false; }
    return true;
  }

  function placeBlock(node) {
    // Tables wider than the page get their font size and cell padding
    // shrunk in place until they fit within the page width.
    if (node.tagName === 'TABLE' && tableOverflows(node, CONTENT_W)) {
      shrinkTableToFit(node, CONTENT_W);
    }
    if (ctx.content.childElementCount === 0) {
      placeOnEmpty(node);
      return;
    }
    // Heading guard: ensure enough room remains after it for following content,
    // so a heading is never stranded alone at the foot of a page (req. 3).
    if (isHeading(node)) {
      ctx.content.appendChild(node);
      const room = CONTENT_H - ctx.content.scrollHeight;
      if (overflowing() || room < MIN_AFTER_HEADING) {
        ctx.content.removeChild(node);
        newPage();
        ctx.content.appendChild(node);
      }
      return;
    }
    // Normal block.
    ctx.content.appendChild(node);
    if (overflowing()) {
      ctx.content.removeChild(node);
      if (pageOnlyHeadings()) {
        // The page holds nothing but heading(s): flow this block right after
        // them so the heading keeps its content instead of being orphaned.
        if (splittable(node)) { flowBlock(node); }
        else {
          // Atomic block can't be split — move the heading(s) along with it.
          const moved = peelAllHeadings();
          newPage();
          moved.forEach(h => ctx.content.appendChild(h));
          placeOnEmpty(node);
        }
      } else {
        const moved = peelTrailingHeadings();
        newPage();
        moved.forEach(h => ctx.content.appendChild(h));
        placeOnEmpty(node);
      }
    }
  }

  // Remove every (heading-only) child from the current page.
  function peelAllHeadings() {
    const c = ctx.content;
    const peeled = [];
    while (c.firstElementChild) peeled.push(c.removeChild(c.firstElementChild));
    return peeled;
  }

  function buildPages(sourceBody) {
    pdfStage.innerHTML = '';
    newPage();
    const blocks = Array.from(sourceBody.children);
    blocks.forEach(b => {
      // Unwrap the screen-only drag/scroll box so the PDF paginates the bare
      // table exactly as before (header repetition, shrink-to-fit, etc.).
      if (b.classList && b.classList.contains('table-scroll')) {
        const t = b.querySelector(':scope > table');
        if (t) { placeBlock(t.cloneNode(true)); return; }
      }
      placeBlock(b.cloneNode(true));
    });
    // Drop a trailing empty page if one was created.
    const last = pdfStage.lastElementChild;
    if (last && !last.querySelector('.pdf-page-content').childElementCount) last.remove();
  }

  function addWatermarks() {
    const pages = Array.from(pdfStage.querySelectorAll('.pdf-page'));
    const n = pages.length;
    if (!n) return;

    // Random pages only — never every page (requirement 5).
    let count;
    if (n === 1) count = 1;
    else count = Math.min(n - 1, Math.max(1, Math.round(n * 0.4)));

    const idx = pages.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    idx.slice(0, count).forEach(i => {
      const wm = document.createElement('div');
      wm.className = 'pdf-watermark';
      const img = document.createElement('img');
      img.src = WM_LOGO_SRC;
      img.alt = '';
      const span = document.createElement('span');
      span.textContent = 'Made using tool.adjiebrotots.com/mdtopdf';
      wm.appendChild(img);
      wm.appendChild(span);
      pages[i].appendChild(wm);
    });
  }

  function raf2() {
    return new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
  }

  let afterPrintBound = null;
  async function downloadPDF() {
    if (state.editing) setEditing(false);
    if (!state.text) return;
    showOverlay('Laying out pages…');
    const wasDark = !document.body.classList.contains('light');
    if (wasDark) applyTheme(true); // PDF is always light
    await raf2();

    try {
      buildPages(mdBody);
      addWatermarks();
      await raf2();
    } catch (e) {
      console.error(e);
      hideOverlay();
      if (wasDark) applyTheme(false);
      alert('Sorry — something went wrong laying out the PDF.');
      return;
    }

    const cleanup = () => {
      pdfStage.innerHTML = '';
      if (wasDark) applyTheme(false);
      hideOverlay();
      window.removeEventListener('afterprint', afterPrintBound);
      afterPrintBound = null;
    };
    afterPrintBound = cleanup;
    window.addEventListener('afterprint', afterPrintBound);

    hideOverlay();
    // Let the overlay paint-out before opening the modal print dialog.
    await raf2();
    window.print();
  }

  /* ────────────────────────────────────────────────────────────────
     EDIT / VIEW TOGGLE
     ──────────────────────────────────────────────────────────────── */
  function setEditing(on) {
    state.editing = on;
    docScroll.classList.toggle('editing', on);
    if (on) {
      clearStickyHeader();
      mdEditor.value = state.text;
      editToggle.textContent = '👁 Preview';
      mdEditor.focus();
    } else {
      state.text = mdEditor.value;
      editToggle.textContent = '✏️ Edit';
      render();
    }
  }

  /* ────────────────────────────────────────────────────────────────
     FILE LOADING
     ──────────────────────────────────────────────────────────────── */
  function loadText(text) {
    state.text = text;
    state.editing = false;
    docScroll.classList.remove('editing');
    editToggle.textContent = '✏️ Edit';
    workspace.classList.add('active');
    dropZone.style.display = 'none';
    render();
    docScroll.scrollTop = 0;
  }

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => loadText(String(e.target.result || ''));
    reader.readAsText(file);
  }

  function showOverlay(msg) { overlayMsg.textContent = msg || ''; overlay.classList.add('visible'); }
  function hideOverlay() { overlay.classList.remove('visible'); }

  /* ────────────────────────────────────────────────────────────────
     SAMPLE DOCUMENT
     ──────────────────────────────────────────────────────────────── */
  const SAMPLE = [
    '# Markdown → PDF — Feature Tour',
    '',
    'This sample demonstrates every feature of the reader. Toggle **LaTeX**, **Code**, **Diagrams & Charts**, and the **Table of Contents** in the toolbar above, then press **Download PDF** to see the print-ready output.',
    '',
    '## Typography & Emphasis',
    '',
    'You can write *italic*, **bold**, ***bold italic***, `inline code`, and [links](https://tool.adjiebrotots.com/). Lists work too:',
    '',
    '- First idea, with a reasonable amount of supporting text so the line wraps.',
    '- Second idea',
    '  - A nested point',
    '  - Another nested point',
    '- Third idea',
    '',
    '1. Step one',
    '2. Step two',
    '3. Step three',
    '',
    '> Blockquotes are styled with an accent border and a soft background tint.',
    '',
    '## Mathematics with LaTeX',
    '',
    'Inline math such as $E = mc^2$ renders cleanly within a sentence. Display equations are centred:',
    '',
    '$$ \\int_{0}^{\\infty} e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2} $$',
    '',
    'The quadratic formula: $x = \\dfrac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$.',
    '',
    '## Code with Syntax Highlighting',
    '',
    '```javascript',
    'function fib(n) {',
    '  let [a, b] = [0, 1];',
    '  for (let i = 0; i < n; i++) [a, b] = [b, a + b];',
    '  return a;',
    '}',
    'console.log(fib(10)); // 55',
    '```',
    '',
    '```python',
    'def greet(name: str) -> str:',
    '    return f"Hello, {name}!"',
    '```',
    '',
    '## Diagrams & Charts',
    '',
    'A flowchart:',
    '',
    '```mermaid',
    'flowchart LR',
    '  A[Markdown file] --> B{Features on?}',
    '  B -->|Yes| C[Render LaTeX, code, diagrams]',
    '  B -->|No| D[Plain render]',
    '  C --> E[Paginate]',
    '  D --> E',
    '  E --> F[Download PDF]',
    '```',
    '',
    'And a pie chart:',
    '',
    '```mermaid',
    'pie title Time spent',
    '  "Writing" : 45',
    '  "Editing" : 30',
    '  "Formatting" : 25',
    '```',
    '',
    '## Tables',
    '',
    '| Feature              | Default | Affects PDF |',
    '|----------------------|:-------:|:-----------:|',
    '| LaTeX                |   On    |     Yes     |',
    '| Code highlighting    |   On    |     Yes     |',
    '| Diagrams & Charts    |   On    |     Yes     |',
    '| Table of Contents    |   On    |     Yes     |',
    '| Watermark            |   —     | Random pages|',
    '',
    '## Long Section for Pagination',
    '',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    '',
    'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.',
    '',
    'Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur.',
    '',
    '### A subsection',
    '',
    'At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga.',
    '',
    'Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus.',
    ''
  ].join('\n');

  /* ────────────────────────────────────────────────────────────────
     INIT
     ──────────────────────────────────────────────────────────────── */
  function init() {
    mdBody      = document.getElementById('mdBody');
    docScroll   = document.getElementById('docScroll');
    workspace   = document.getElementById('workspace');
    dropZone    = document.getElementById('dropZone');
    fileInput   = document.getElementById('fileInput');
    themeToggle = document.getElementById('themeToggle');
    pdfStage    = document.getElementById('pdfStage');
    overlay     = document.getElementById('pdfOverlay');
    overlayMsg  = document.getElementById('pdfOverlayMsg');
    hljsLight   = document.getElementById('hljsLight');
    hljsDark    = document.getElementById('hljsDark');
    editToggle  = document.getElementById('editToggleBtn');
    mdEditor    = document.getElementById('mdEditor');

    if (typeof marked !== 'undefined') marked.setOptions({ gfm: true });
    if (typeof mermaid !== 'undefined') {
      mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
    }

    // Theme — default LIGHT (per design brief); honour a saved preference.
    let saved = 'light';
    try { saved = localStorage.getItem('md2pdf-theme') || 'light'; } catch (e) {}
    applyTheme(saved !== 'dark');

    themeToggle.addEventListener('click', () => {
      applyTheme(!document.body.classList.contains('light'));
    });

    // File input + drag/drop
    fileInput.addEventListener('change', e => handleFile(e.target.files[0]));
    ['dragenter', 'dragover'].forEach(ev =>
      dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach(ev =>
      dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.remove('dragover'); }));
    dropZone.addEventListener('drop', e => {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });

    document.getElementById('sampleBtn').addEventListener('click', e => {
      e.stopPropagation();
      loadText(SAMPLE);
    });

    document.getElementById('newFileBtn').addEventListener('click', () => {
      state.text = '';
      state.editing = false;
      docScroll.classList.remove('editing');
      editToggle.textContent = '✏️ Edit';
      mdEditor.value = '';
      mdBody.innerHTML = '';
      clearStickyHeader();
      workspace.classList.remove('active');
      dropZone.style.display = '';
      fileInput.value = '';
    });

    editToggle.addEventListener('click', () => setEditing(!state.editing));

    document.getElementById('downloadBtn').addEventListener('click', downloadPDF);

    // Feature toggles → re-render.
    const toggleMap = { tgLatex: 'latex', tgCode: 'code', tgDiagram: 'diagram', tgToc: 'toc' };
    Object.keys(toggleMap).forEach(id => {
      const el = document.getElementById(id);
      el.addEventListener('change', () => { state[toggleMap[id]] = el.checked; render(); });
    });

    // Re-evaluate which tables overflow when the viewport width changes.
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        markScrollableTables(mdBody);
        stickyActive = null; // widths may have changed — force a fresh clone
        scheduleSticky();
      }, 150);
    });

    // Keep the floating table header pinned/synced while scrolling. Capture
    // phase also catches horizontal pans inside the per-table scroll boxes
    // (scroll events don't bubble).
    docScroll.addEventListener('scroll', scheduleSticky, true);

    // Smooth-scroll TOC anchors inside the scroll container.
    mdBody.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const target = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
