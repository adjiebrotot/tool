// Captures the guide's clips from the REAL Workflow Builder (../../builder/) with Playwright.
//
//   NODE_PATH=$(npm root -g) node capture.mjs [scene ...] [--theme light|dark]
//
// Serves the repo, drives the builder with real pointer events (a cursor is drawn into the recorded
// page only), records a video per scene and theme, cuts and crops it with ffmpeg and writes
// ../media/<scene>-<theme>.webm / .mp4 / .webp plus ../media/manifest.json (the times of the steps
// each clip shows, which guides/script.js uses to light the matching step in the list).
// Needs Playwright for Node with Chromium, and ffmpeg (libvpx-vp9 and libx264) on the PATH.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pw, serve, MEDIA, openScene, finish, still, sleep } from './lib.mjs';
import { SCENES } from './scenes.mjs';

const args = process.argv.slice(2);
const themeArg = args.includes('--theme') ? args[args.indexOf('--theme') + 1] : null;
const names = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--theme');
const themes = themeArg ? [themeArg] : ['light', 'dark'];
const todo = SCENES.filter(s => !names.length || names.includes(s.name));

const manifestFile = join(MEDIA, 'manifest.json');
const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {};
const { server, origin } = await serve();
const browser = await pw.chromium.launch();
let bad = 0;
for (const sc of todo) {
  for (const theme of themes) {
    const S = await openScene(browser, origin, theme, { record: !sc.still, h: sc.h });
    let r;
    try {
      const out = await sc.run(S);
      r = sc.still ? await still(S, sc.name, out) : await finish(S, sc.name, out.crop, out);
    } catch (e) {
      console.log('FAILED', sc.name, theme, e.message);
      try { await S.page.screenshot({ path: join(MEDIA, '..', '_capture', 'fail-' + sc.name + '-' + theme + '.png') }); } catch (x) {}
      await S.ctx.close().catch(() => {});
      bad++;
      continue;
    }
    (manifest[sc.name] = manifest[sc.name] || {})[theme] = r;
    console.log(sc.name, theme, r.duration + 's', (r.marks ? r.marks.length + ' marks' : 'still'), r.errors.length ? 'ERRORS ' + JSON.stringify(r.errors) : '');
  }
}
writeFileSync(manifestFile, JSON.stringify(manifest, null, 1) + '\n');
await browser.close();
server.close();
process.exit(bad ? 1 : 0);
