// Capacity Expansion Planner explainer video: render step.
//
//   node capacity-expansion-planner/_video/render.mjs out.mp4        the whole video
//   node capacity-expansion-planner/_video/render.mjs preview 9 35   stills at those seconds, in prev/
//
// Every frame of story.html is a function of its time (renderAt), so each one is
// drawn, captured and piped to ffmpeg in order: 1920x1080, 30 fps, H.264.
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
const dir = path.dirname(new URL(import.meta.url).pathname);
const mode = process.argv[2] || 'preview';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
p.on('pageerror', e => console.log('PAGEERR', e.message));
p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await p.goto('file://' + dir + '/story.html', { waitUntil: 'networkidle' });
await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.complete ? 1 : new Promise(r => i.onload = i.onerror = r))); });
if (mode === 'preview') {
  const times = process.argv.slice(3).map(Number);
  fs.mkdirSync(path.join(dir, 'prev'), { recursive: true });
  for (const t of times) { await p.evaluate(t => renderAt(t), t); await p.screenshot({ path: path.join(dir, `prev/f${String(t).replace('.', '_')}.png`) }); }
} else {
  const fps = 30, dur = await p.evaluate(() => DURATION), n = Math.round(dur * fps);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mode], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < n; i++) {
    await p.evaluate(t => renderAt(t), i / fps);
    const buf = await p.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 300 === 0) console.log('frame', i, '/', n);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
}
await b.close();
