// The Indonesian guide's live demos: the English guide's scenes (../scenes.js), played against
// the tool's Indonesian pages (../../id/ and ../../sensitivity/id/). guide-id.js moves the paths
// and storage keys over; the words below are the ones a scene finds by text, as the Indonesian
// pages show them. The Sensitivity page's search finds a home by its English words too, so
// 'perth house' needs no twin. Check both guides with  node _ref/guide-check.mjs rentvsownhouse
import * as EN from '../scenes.js';
import { indonesian } from '../../../guide-id.js';

export const { TOOL, SCENES } = indonesian(EN, {
  words: {
    '2BR house': 'Rumah 2KT',                 // quickstart-data.js, house-2br short.id
    'a month': 'per bulan',                   // the rent's period (#rentFreq)
    // The chart's Share menu (shared.js, makeShare's TEXT.id).
    'Download as PNG': 'Unduh sebagai PNG', 'Share as link': 'Bagikan sebagai tautan', 'Embed as HTML': 'Sematkan sebagai HTML',
  },
});
