#!/usr/bin/env node
// Checks that the AI references are reachable on the LIVE site, the way a chatbot's browser
// fetches them: a plain GET, no script run, with a browser's and each AI reader's
// User-Agent. agent-check holds the files in the repo; this holds what the server sends.
//
// For each page in PAGES (_ref/agent-lib.mjs), and for every User-Agent below:
//   <page>/agent.txt   200, text/plain, no Content-Disposition, the page's title line first
//                      and AI_RULES in the body;
//   <page>/agent.html  200, text/html, AI_RULES in its pre.agent-rules, no script;
//   <page>/            200, and its HTML links to agent.html with a plain <a href>.
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
import { AI_RULES, PAGES, ROOT, SITE } from './agent-lib.mjs';

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
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let pass = 0, fail = 0;
function check(name, ok, why = '') {
  if (ok) pass++;
  else { fail++; console.log(`  FAIL ${name}${why ? ': ' + why : ''}`); }
}
async function get(path, ua) {
  try {
    const r = await fetch(SITE + path, { headers: { 'User-Agent': ua }, redirect: 'follow' });
    return { status: r.status, type: r.headers.get('content-type') || '', disp: r.headers.get('content-disposition') || '', body: await r.text() };
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

console.log(`agent-live-check: ${SITE}, ${pages.length} pages, ${Object.keys(AGENTS).length} User-Agents`);
const robots = await get('/robots.txt', AGENTS.browser);
check('/robots.txt is 200 text/plain', robots.status === 200 && robots.type.startsWith('text/plain'), said(robots));
for (const path of ['/llms.txt', '/sitemap.xml']) {
  const r = await get(path, AGENTS.browser);
  check(`${path} is 200`, r.status === 200, said(r));
}

for (const P of pages) {
  console.log(`── ${P.url}`);
  const txtLocal = local(P.page + '/agent.txt');
  const htmlLocal = local(P.page + '/agent.html');
  const title = (txtLocal || '').split('\n')[0];
  const href = `<a href="${SITE + P.url}agent.html">`;
  for (const [name, ua] of Object.entries(AGENTS)) {
    for (const path of [P.url, P.url + 'agent.txt', P.url + 'agent.html']) {
      if (robots.status === 200) check(`robots.txt lets ${name} fetch ${path}`, !robotsBlocks(robots.body, ua, path));
    }
    const txt = await get(P.url + 'agent.txt', ua);
    check(`${name}: agent.txt is 200 text/plain`, txt.status === 200 && txt.type.startsWith('text/plain'), said(txt));
    check(`${name}: agent.txt is not a download`, !/attachment/i.test(txt.disp), txt.disp);
    check(`${name}: agent.txt is the reference, AI_RULES included`, txt.body.startsWith(title) && txt.body.includes(AI_RULES),
      txt.body.slice(0, 80).replace(/\s+/g, ' '));
    check(`${name}: agent.txt matches the repo`, txt.body === txtLocal, 'not deployed yet, or changed since');
    const html = await get(P.url + 'agent.html', ua);
    check(`${name}: agent.html is 200 text/html`, html.status === 200 && html.type.startsWith('text/html'), said(html));
    check(`${name}: agent.html carries AI_RULES, with no script`,
      html.body.includes(`<pre class="agent-rules">${esc(AI_RULES)}</pre>`) && !/<script/i.test(html.body), html.body.slice(0, 80).replace(/\s+/g, ' '));
    check(`${name}: agent.html matches the repo`, html.body === htmlLocal, 'not deployed yet, or changed since');
    const page = await get(P.url, ua);
    check(`${name}: the page is 200 and links to agent.html`, page.status === 200 && page.body.includes(href), said(page));
  }
}

console.log(`\nagent-live-check: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
