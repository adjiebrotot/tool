// The Indonesian guide's live demos: the English guide's scenes (../scenes.js), played against
// the tool's Indonesian page (../../id/). guide-id.js moves the paths and storage keys over;
// the words below are the ones a scene finds by text, as the Indonesian page shows them.
// Check both guides with  node _ref/guide-check.mjs pisahvsgabung
import * as EN from '../scenes.js';
import { indonesian } from '../../../guide-id.js';

export const { TOOL, SCENES } = indonesian(EN, {
  // The chart's Share menu (shared.js, makeShare's TEXT.id).
  words: { 'Download as PNG': 'Unduh sebagai PNG', 'Share as link': 'Bagikan sebagai tautan', 'Embed as HTML': 'Sematkan sebagai HTML' },
});
