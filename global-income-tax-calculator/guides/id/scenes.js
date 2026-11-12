// The Indonesian guide's live demos: the English guide's scenes (../scenes.js), played against
// the Indonesian calculator (../../id/). guide-id.js moves the paths and storage keys over; the
// words below are the ones a scene finds or types by text, as the Indonesian page shows them.
// Check both guides with  node _ref/guide-check.mjs global-income-tax-calculator
import * as EN from '../scenes.js';
import { indonesian } from '../../../guide-id.js';

export const { TOOL, SCENES } = indonesian(EN, {
  // The country search: the Indonesian page lists the United Kingdom as Inggris.
  fills: { 'king': 'inggris' },
  words: {
    'United Kingdom': 'Inggris',
    'US dollar (USD)': '(USD)',               // the display currency, found by its code
  },
});
