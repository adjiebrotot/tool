#!/usr/bin/env node
// Checks that the AI references are reachable on the LIVE site, the way a chatbot's browser
// fetches them: a plain GET, no script run, with a browser's and each AI reader's
// User-Agent. agent-check holds the files in the repo; this holds what the server sends.
//
// For each tool in TOOLS (_ref/ai-skill.mjs), and for every User-Agent below:
//   <tool>/ai/                      200, text/html, matches the repo;
//   <tool>/ai/skill/SKILL.md        200, matches the repo (an assistant that browses reads it);
//   <tool>/ai/<skill>.zip           200, the repo's bytes, not served as text/html;
// and for each page in PAGES: 200, and its HTML links to its tool's AI page with a plain <a href>.
// And once: /robots.txt is 200 text/plain and disallows none of those paths for any of the
// User-Agents; /llms.txt and /sitemap.xml are 200.
//
// A body that differs from the repo's file is reported as "not deployed yet" (a fail): run it
// after GitHub Pages has deployed, never before. A User-Agent is spoofable, so a pass here
// does not prove that a provider's own servers get through Cloudflare's bot rules; a fail for
// one User-Agent only does point at them.
//
// Run: node _ref/agent-live-check.mjs [page]     page: part of a PAGES page, e.g. builder
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PAGES, ROOT, SITE } from './agent-lib.mjs';
import { TOOLS, toolOf, skillName, aiUrl } from './ai-skill.mjs';

const AGENTS = {
  browser: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'ChatGPT-User': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
  'OAI-SearchBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot',
  'Claude-User': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)',
  'Perplexity-User': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)',
  'Google-Extended': 'Mozilla/5.0 (compatible; Google-Extended)',
};
const ONLY = process.argv[2] || '';
const pages = PAGES.filter(P => P.page.includes(ONLY));
const tools = TOOLS.filter(T => pages.some(P => toolOf(P.page) === T.tool));

let pass = 0, fail = 0;
function check(name, ok, why = '') {
  if (ok) pass++;
  else { fail++; console.log(`  FAIL ${name}${why ? ': ' + why : ''}`); }
}
async function get(path, ua) {
  try {
    const r = await fetch(SITE + path, { headers: { 'User-Agent': ua }, redirect: 'follow' });
    const buf = Buffer.from(await r.arrayBuffer());
    return { status: r.status, type: r.headers.get('content-type') || '', disp: r.headers.get('content-disposition') || '', body: buf.toString('utf8'), buf };
  } catch (e) {
    return { status: 0, type: '', disp: '', body: '', err: (e.cause && e.cause.code) || e.message };
  }
}
const local = rel => existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), 'utf8') : null;
const said = r => r.err ? r.err : `HTTP ${r.status} ${r.type}`;

// robots.txt: a group for the User-Agent (or *) must not Disallow a path a page needs.
function robotsBlocks(robots, ua, path) {
  const groups = [];
  let cur = null, lastWasAgent = false;
  for (const raw of robots.split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const [, k, v] = m;
    if (/^user-agent$/i.test(k)) {
      if (!lastWasAgent) groups.push(cur = { agents: [], rules: [] });
      cur.agents.push(v.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (cur && /^(allow|disallow)$/i.test(k) && v) cur.rules.push({ allow: /^allow$/i.test(k), path: v });
    }
  }
  const named = groups.filter(g => g.agents.some(a => a !== '*' && ua.toLowerCase().includes(a)));
  const rules = (named.length ? named : groups.filter(g => g.agents.includes('*'))).flatMap(g => g.rules);
  // The longest matching rule wins; on a tie, Allow.
  let best = null;
  for (const r of rules) {
    const re = new RegExp('^' + r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    if (!re.test(path)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
  }
  return !!best && !best.allow;
}

console.log(`agent-live-check: ${SITE}, ${tools.length} tools, ${pages.length} pages, ${Object.keys(AGENTS).length} User-Agents`);
const robots = await get('/robots.txt', AGENTS.browser);
check('/robots.txt is 200 text/plain', robots.status === 200 && robots.type.startsWith('text/plain'), said(robots));
for (const path of ['/llms.txt', '/sitemap.xml']) {
  const r = await get(path, AGENTS.browser);
  check(`${path} is 200`, r.status === 200, said(r));
}

for (const T of tools) {
  const dir = '/' + T.tool + '/ai/';
  console.log(`── ${dir}`);
  const zipName = skillName(T) + '.zip';
  for (const [name, ua] of Object.entries(AGENTS)) {
    for (const path of [dir, dir + 'skill/SKILL.md', dir + zipName]) {
      if (robots.status === 200) check(`robots.txt lets ${name} fetch ${path}`, !robotsBlocks(robots.body, ua, path));
    }
    const page = await get(dir, ua);
    check(`${name}: ${dir} is 200 text/html`, page.status === 200 && page.type.startsWith('text/html'), said(page));
    check(`${name}: ${dir} matches the repo`, page.body === local(T.tool + '/ai/index.html'), 'not deployed yet, or changed since');
    const md = await get(dir + 'skill/SKILL.md', ua);
    check(`${name}: SKILL.md is 200`, md.status === 200, said(md));
    check(`${name}: SKILL.md matches the repo`, md.body === local(T.tool + '/ai/skill/SKILL.md'), 'not deployed yet, or changed since');
    const zip = await get(dir + zipName, ua);
    const zipLocal = existsSync(join(ROOT, T.tool, 'ai', zipName)) ? readFileSync(join(ROOT, T.tool, 'ai', zipName)) : null;
    check(`${name}: ${zipName} is 200 and not a web page`, zip.status === 200 && !zip.type.startsWith('text/html'), said(zip));
    check(`${name}: ${zipName} matches the repo`, !!zip.buf && !!zipLocal && zip.buf.equals(zipLocal), 'not deployed yet, or changed since');
  }
}
for (const P of pages) {
  const T = TOOLS.find(T => T.tool === toolOf(P.page));
  const href = `<a href="${aiUrl(T)}">`;
  const page = await get(P.url, AGENTS.browser);
  check(`${P.url} is 200 and links to ${aiUrl(T)}`, page.status === 200 && page.body.includes(href), said(page));
}

console.log(`\nagent-live-check: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
