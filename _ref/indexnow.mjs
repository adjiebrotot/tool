// Tells Bing, Yandex, Seznam and Naver (IndexNow) which pages changed, so they recrawl them
// within hours instead of waiting for the sitemap. Bing's index also feeds Copilot and
// ChatGPT search. The key below is public by design: each site serves it as /<key>.txt
// (tool, www and blog each keep a copy at their root).
//   node _ref/indexnow.mjs https://tool.adjiebrotots.com/borrowingcapacity/ [more URLs...]
//   node _ref/indexnow.mjs --sitemap tool.adjiebrotots.com    # every URL in that site's live sitemap
// Run it after a change is live (GitHub Pages has deployed), never before.
const KEY = 'b0d0caf3041fb3bc31de6f2b11f90e93';
const HOSTS = ['tool.adjiebrotots.com', 'www.adjiebrotots.com', 'blog.adjiebrotots.com'];

const args = process.argv.slice(2);
let urls = [];
if (args[0] === '--sitemap') {
  const host = args[1];
  if (!HOSTS.includes(host)) throw new Error(`--sitemap takes one of ${HOSTS.join(', ')}`);
  const xml = await (await fetch(`https://${host}/sitemap.xml`)).text();
  urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
} else {
  urls = args;
}
if (!urls.length) { console.log('No URLs. See the usage at the top of this file.'); process.exit(1); }

// One request per host: IndexNow takes a batch only when every URL is on the same host.
const byHost = {};
for (const u of urls) {
  const host = new URL(u).host;
  if (!HOSTS.includes(host)) throw new Error(`${u} is not on ${HOSTS.join(', ')}`);
  (byHost[host] = byHost[host] || []).push(u);
}
for (const [host, list] of Object.entries(byHost)) {
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key: KEY, keyLocation: `https://${host}/${KEY}.txt`, urlList: list }),
  });
  // 200 and 202 both mean accepted; 403 means the key file is not live on that host yet.
  console.log(`${host}: ${list.length} URL(s), HTTP ${res.status} ${res.statusText}`);
}
