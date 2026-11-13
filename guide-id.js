/* GUIDE PAGES IN INDONESIAN (<tool>/guides/id/, beside guide-live.js): the English guide's
   scenes, played against the tool's Indonesian page. A guide's id/scenes.js is a few lines:

     import * as EN from '../scenes.js';
     import { indonesian } from '../../../guide-id.js';
     export const { TOOL, SCENES } = indonesian(EN, { words: { 'Download as PNG': 'Unduh sebagai PNG' } });

   so a change to a scene plays in both languages, and _ref/guide-check.mjs checks both.
   What changes on the way:
   - paths: every page a scene opens becomes its Indonesian twin (<page>id/, the site's rule),
     relative to the id guide: TOOL.path '../' becomes '../../id/', '../sensitivity/' becomes
     '../../sensitivity/id/', a query or a hash kept. o.paths names any other mapping.
   - storage: a page's own key ('abt:ctrl:/<tool>/', the Inputs card left open) moves to the
     id page's address; the tours' seen keys gain their Indonesian twins (pvg-tour-v3-seen and
     pvg-id-tour-v3-seen), plus any in o.seen.
   - words: a scene that finds a part by its text ({ text, in }, S.choose) or types a search
     (S.fill) names it in English; o.words (targets and choices) and o.fills (typed text) give
     the Indonesian page's words. Anything else a scene names (ids, classes, data-* values,
     Quick Start keys) is the same on both pages. */
export function indonesian(EN, o = {}) {
  const words = o.words || {}, fills = o.fills || {}, paths = o.paths || {};
  // '../' -> '../../id/', '../sensitivity/?x#y' -> '../../sensitivity/id/?x#y'
  const path = p => {
    if (p == null) return p;
    if (p in paths) return paths[p];
    return '../' + String(p).replace(/^([^?#]*?)\/?([?#].*)?$/, (m, a, rest) => (a ? a + '/' : '') + 'id/' + (rest || ''));
  };
  const storage = st => st && Object.fromEntries(Object.entries(st).map(([k, v]) => [k.replace(/^(abt:ctrl:.*\/)$/, '$1id/'), v]));
  const seen = list => list && [...new Set([...list, ...list.map(k => k.replace(/^([\w]+)-tour-/, '$1-id-tour-'))])];

  // The helpers a scene is given, with its English words swapped for the page's.
  const word = t => typeof t === 'string' && t in words ? words[t] : t;
  const target = t => Array.isArray(t) ? t.map(target)
    : t && typeof t === 'object' && !t.nodeType && typeof t.text === 'string' && t.text in words ? { ...t, text: words[t.text] } : t;
  function wrap(S) {
    const W = Object.create(S);
    for (const k of ['$', 'find', 'box', 'centre', 'moveTo', 'click', 'dblclick', 'scrollTo', 'reveal', 'focus']) {
      W[k] = (t, ...rest) => S[k](target(t), ...rest);
    }
    W.drag = (a, b, opt) => S.drag(target(a), target(b), opt);
    W.fill = (t, text, opt) => S.fill(target(t), typeof text === 'string' && text in fills ? fills[text] : text, opt);
    W.choose = (t, text, opt) => S.choose(target(t), word(text), opt);
    return W;
  }

  const TOOL = { ...EN.TOOL, path: path(EN.TOOL.path), storage: storage(EN.TOOL.storage),
    seen: [...new Set([...(seen(EN.TOOL.seen) || []), ...(o.seen || [])])], ...(o.tool || {}) };
  const SCENES = EN.SCENES.map(sc => ({
    ...sc,
    ...(sc.path != null ? { path: path(sc.path) } : {}),
    ...(sc.storage ? { storage: storage(sc.storage) } : {}),
    ...(sc.seen ? { seen: seen(sc.seen) } : {}),
    run: (S, ...rest) => sc.run(wrap(S), ...rest),
  }));
  return { TOOL, SCENES };
}
