// Shared by the audit scripts: serves the repo over HTTP (ES modules and
// workers need a real origin) and answers the page's CDN requests from
// pinned local copies of the same packages, so a run is offline-capable and
// tests exactly the versions the page pins. The copies are installed once
// into a cache folder outside the repo (npm, first run only).
//
//   const { url, close } = await serve();
//   await routeCdn(page);      // Playwright page
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..');

// Must match engines/cdn.js and the import map in index.html.
export const PINNED = { three: '0.186.1', 'occt-import-js': '0.0.23', rhino3dm: '8.32.1' };
export const DEPS = process.env.O3V_DEPS || path.join(os.tmpdir(), 'o3v-audit-deps');

export function ensureDeps() {
  const missing = Object.entries(PINNED).filter(([name, ver]) => {
    try { return JSON.parse(fs.readFileSync(path.join(DEPS, 'node_modules', name, 'package.json'), 'utf8')).version !== ver; }
    catch { return true; }
  });
  if (!missing.length) return true;
  fs.mkdirSync(DEPS, { recursive: true });
  if (!fs.existsSync(path.join(DEPS, 'package.json'))) fs.writeFileSync(path.join(DEPS, 'package.json'), '{"name":"o3v-audit-deps","private":true}');
  try {
    console.log('Installing pinned libraries into ' + DEPS + ' (first run only)…');
    execFileSync('npm', ['install', '--no-audit', '--no-fund', '--prefix', DEPS, ...missing.map(([n, v]) => n + '@' + v)], { stdio: 'inherit' });
    return true;
  } catch (e) {
    console.log('  (npm install failed; CDN requests will go to the network instead)');
    return false;
  }
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.txt': 'text/plain', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

export function serve(port = 0) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => {
    const { port: p } = server.address();
    resolve({ url: 'http://127.0.0.1:' + p, close: () => new Promise(r => server.close(r)), server });
  }));
}

// https://cdn.jsdelivr.net/npm/<pkg>@<ver>/<file>  →  DEPS/node_modules/<pkg>/<file>
// (a jsDelivr ".min.js" is served from the unminified file it is made from)
export async function routeCdn(page, { log } = {}) {
  const stats = { local: 0, network: 0, blocked: [] };
  await page.route('**/*', async route => {
    const url = route.request().url();
    const m = /^https:\/\/cdn\.jsdelivr\.net\/npm\/((?:@[^/]+\/)?[^@/]+)@([^/]+)\/(.+)$/.exec(url);
    if (m) {
      const [, pkg, , rel] = m;
      let file = path.join(DEPS, 'node_modules', pkg, rel.split('?')[0]);
      if (!fs.existsSync(file) && /\.min\.js$/.test(file)) file = file.replace(/\.min\.js$/, '.js');
      if (fs.existsSync(file)) {
        stats.local++;
        return route.fulfill({ status: 200, body: fs.readFileSync(file), headers: { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'access-control-allow-origin': '*' } });
      }
      stats.network++;
      return route.continue();
    }
    if (url.startsWith('http://127.0.0.1') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    // Analytics, ads, the coffee widget: not part of what is tested.
    stats.blocked.push(url);
    if (log) log('blocked ' + url);
    return route.fulfill({ status: 200, body: '', headers: { 'content-type': 'text/javascript' } });
  });
  return stats;
}
