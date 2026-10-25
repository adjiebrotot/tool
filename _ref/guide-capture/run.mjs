// Records a tool's guide clips from the REAL tool with Playwright.
//
//   node _ref/guide-capture/run.mjs <tool folder> [scene ...] [--theme light|dark]
//   node _ref/guide-capture/run.mjs loadflow-simulator quickstart --theme dark
//
// Reads <tool>/guides/_capture/scenes.mjs (TOOL: how to open the tool; SCENES: what each clip does),
// records a video per scene and theme, cuts and crops it with ffmpeg and writes
// <tool>/guides/media/<scene>-<theme>.webm / .mp4 / .webp plus media/manifest.json (the times of
// the steps each clip shows, which guide-shared.js uses to light the matching step in the list).
// Needs Playwright for Node with Chromium, and ffmpeg (libvpx-vp9 and libx264) on the PATH.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { pw, serve, openScene, finish, still, ROOT } from './lib.mjs';

const args = process.argv.slice(2);
const tool = args[0];
if (!tool || !existsSync(join(ROOT, tool, 'guides', '_capture', 'scenes.mjs'))) {
  console.log('usage: node _ref/guide-capture/run.mjs <tool folder> [scene ...] [--theme light|dark]');
  process.exit(2);
}
const themeArg = args.includes('--theme') ? args[args.indexOf('--theme') + 1] : null;
const names = args.slice(1).filter((a, i, l) => !a.startsWith('--') && l[i - 1] !== '--theme');
const themes = themeArg ? [themeArg] : ['light', 'dark'];
const { TOOL, SCENES } = await import(pathToFileURL(join(ROOT, tool, 'guides', '_capture', 'scenes.mjs')).href);
const todo = SCENES.filter(s => !names.length || names.includes(s.name));
const MEDIA = join(ROOT, tool, 'guides', 'media');
mkdirSync(MEDIA, { recursive: true });

const manifestFile = join(MEDIA, 'manifest.json');
const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {};
const { server, origin } = await serve();
const browser = await pw.chromium.launch();
let bad = 0;
for (const sc of todo) {
  for (const theme of themes) {
    const S = await openScene(browser, origin, theme, TOOL, { record: !sc.still, h: sc.h, w: sc.w, hash: sc.hash, storage: sc.storage });
    let r;
    try {
      const out = await sc.run(S);
      r = sc.still ? await still(S, MEDIA, sc.name, out) : await finish(S, MEDIA, sc.name, out.crop, out);
    } catch (e) {
      console.log('FAILED', sc.name, theme, e.message);
      try { await S.page.screenshot({ path: join(MEDIA, '..', '_capture', 'fail-' + sc.name + '-' + theme + '.png') }); } catch (x) {}
      await S.ctx.close().catch(() => {});
      bad++;
      continue;
    }
    (manifest[sc.name] = manifest[sc.name] || {})[theme] = r;
    console.log(sc.name, theme, r.duration ? r.duration + 's' : '', (r.marks ? r.marks.length + ' marks' : 'still'), r.errors.length ? 'ERRORS ' + JSON.stringify(r.errors) : '');
  }
}
writeFileSync(manifestFile, JSON.stringify(manifest, null, 1) + '\n');
await browser.close();
server.close();
process.exit(bad ? 1 : 0);
