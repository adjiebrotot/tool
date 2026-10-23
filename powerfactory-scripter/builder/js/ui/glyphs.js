// Small line drawings for the kinds of block (palette, canvas header, inspector), drawn like the
// site's .tico icons (24 x 24, stroke currentColor). One picture per kind, so a reader learns
// "the circle arrow repeats" once. Strings, so React can take them as innerHTML too.

const P = {
  start: '<path d="M8 5.5v13l10-6.5z"/>',
  action: '<path d="M4 12h12"/><path d="M12 7l5 5-5 5"/>',
  branch: '<path d="M6 4v6a4 4 0 0 0 4 4h8"/><path d="M6 10v10"/><path d="M15 11l3 3-3 3"/>',
  loop: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4v4h-4"/>',
  callback: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
  pure: '<path d="M15 4.5h-1.5A2.5 2.5 0 0 0 11 7v12.5"/><path d="M7.5 10.5h7"/>',
  terminal: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  note: '<path d="M5 4.5h14v10l-5 5H5z"/><path d="M14 19.5v-5h5"/>',
  missing: '<path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><path d="M12 17.5v.5"/>',
  pin: '<path d="M9 3.5h6l-1 6.5 3 3H7l3-3z"/><path d="M12 13v7.5"/>',
};

export function glyph(kind, cls = 'pfb-glyph') {
  const p = P[kind] || P.action;
  return '<svg class="' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + p + '</svg>';
}

// What the inspector calls each kind of block, in a reader's words.
export const KIND_WORDS = {
  start: 'Start', action: 'Step', branch: 'Decision', loop: 'Loop', callback: 'Search',
  pure: 'Calculator', terminal: 'Ends a route', note: 'Note',
};
