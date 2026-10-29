// AI links for the Workflow Builder (SharedAgent in shared.js, Phase 3 of _ref/ai-drive-plan.md).
//
// A reader asks a chatbot for a PowerFactory script; the chatbot reads builder/agent.txt and
// replies with a link that opens the Builder on a workflow:
//
//   builder/#load&v=1&qs=n-1&blk.n1.project=Nine-bus%20System&blk.n5.trafos=false&why.blk.n5.trafos=...
//
// The Builder has no form fields (the workflow is saved whole in the mini cache, Persist extra),
// so every key here is one the adapter reads:
//   qs / template   a worked example (templates/index.json) to start from. They are one thing:
//                   qs is the standard name, template is the name the router (../index.html)
//                   looks for.
//   blk.<id>.<setting>   one setting of one block, by the block's id and the setting's saved key
//                   (blk.n5.trafos=false; blk.n7.el.name=L* for the name of an element setting;
//                   blk.start.project reaches the Start block whatever its id; blk.n5.label).
//   graph.<key>     the graph style (core/graphstyle.js): graph.template, graph.dpi ...
//   json            a whole workflow, in the form Save writes (ui/files.js, core/workflow.js).
//
// Each works on the saved form (the snapshot's __extra is W.serialize's output) and the result is
// loaded back through main.js's restore, which calls loadWorkflow and store.reset's sibling
// replaceWorkflow: the same validated path a file takes, so a link meets every migration and
// every bound a saved workflow does.
//
// The link is untrusted, and its workflow ends up as a script the reader may run on a machine
// with PowerFactory. So a link never carries Python code (the Python code block's `code`, which
// would run as written) nor the folder the script imports PowerFactory's module from (apiPath);
// both stay at their defaults and are said in the banner.
//
// Registered at once (app.js imports this file): SharedAgent starts when the page's own scripts
// have run, but the editor boots a little later, so ready() waits for window.PFB.

import * as R from '../core/registry.js';
import * as W from '../core/workflow.js';
import * as G from '../core/graphstyle.js';

const MAX_NODES = 300;
const MAX_EDGES = 1500;
const BOOT_WAIT = 20000;

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => JSON.parse(JSON.stringify(v));
const clip = (s, n = 40) => String(s === undefined || s === null ? '' : s).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const tidy = (s) => String(s === undefined || s === null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
const short = (n) => String(+Number(n).toFixed(6));
const dec = (s) => { try { return decodeURIComponent(String(s).replace(/\+/g, ' ')); } catch (e) { return String(s); } };

let P = null;               // window.PFB, once the editor is up
let templates = [];         // [{ id, title, file }]
let loaded = null;          // { id, title }: the template a link loaded before it applied

/* ── The link, read once more here: a template named by template= has to be on the canvas before
      the blk. keys patch it, whatever order the link writes them in ── */
const HASH = String((typeof location !== 'undefined' && location.hash) || '');
function linkValue(name) {
  let out = null;
  const body = HASH.replace(/^#?load(?:=[^&]*)?(?:[?&/]|$)/, '');
  body.split('&').forEach((p) => {
    const eq = p.indexOf('=');
    if (eq < 0) return;
    if (dec(p.slice(0, eq)).trim().replace(/^amp;/, '') === name) out = dec(p.slice(eq + 1)).trim();
  });
  return out;
}

function whenBooted() {
  return new Promise((resolve) => {
    let done = false;
    const fin = (p) => { if (!done) { done = true; resolve(p); } };
    const go = () => {
      const p = window.PFB;
      if (!p) return fin(null);
      Promise.all([p.canvasReady, p.runtimeReady, p.templatesReady]).then(() => fin(p), () => fin(p));
    };
    if (window.PFB && window.PFB.ready) go();
    else window.addEventListener('pfb:ready', go, { once: true });
    setTimeout(() => fin(window.PFB || null), BOOT_WAIT);
  });
}

const booted = whenBooted();

function findTemplate(text) {
  const t = tidy(text);
  return templates.find((x) => x.id === String(text).trim()) || templates.find((x) => x.id.toLowerCase() === t) ||
    templates.find((x) => tidy(x.title) === t) || null;
}
function ids() { return templates.map((t) => t.id).join(', '); }
async function loadTemplate(t) {
  let ok = false;
  try { ok = await P.loadTemplate(t.id, { ask: false, quiet: true }); } catch (e) { ok = false; }
  if (ok) loaded = { id: t.id, title: t.title };
  return ok;
}

function ready() {
  return booted.then((p) => {
    P = p;
    if (!P) return null;
    templates = P.templates();
    // template=<id> (qs, when the link has one, is applied by preset() instead).
    const want = linkValue('qs') ? null : linkValue('template');
    const t = want ? findTemplate(want) : null;
    return t ? loadTemplate(t) : null;
  });
}

function preset(key) {
  if (!P) return false;
  const t = findTemplate(key);
  if (!t) return false;
  if (loaded && loaded.id === t.id) return t.title;
  return loadTemplate(t).then((ok) => (ok ? t.title : false));
}

/* ── The saved form the link works on ── */
function replaceWith(extra, next) {
  Object.keys(extra).forEach((k) => { delete extra[k]; });
  Object.keys(next).forEach((k) => { extra[k] = next[k]; });
}
// The workflow in the snapshot, else the one on the canvas.
function saved(extra) {
  if (!Array.isArray(extra.nodes)) {
    const s = P ? P.store.get() : null;
    replaceWith(extra, s ? W.serialize({ ...s.wf, view: s.view }) : W.serialize(W.emptyWorkflow()));
  }
  return extra;
}
function blockName(node) { return R.displayName(node) + ' (' + node.id + ')'; }
function qsButton() { return document.getElementById('pfbQsBtn'); }

/* ── qs / template ── */
function template(raw, extra, api) {
  const text = dec(raw), t = findTemplate(text);
  if (!t) { api.error('template: there is no Quick Start "' + clip(text) + '" (they are ' + ids() + ')'); return false; }
  if (api.given('json')) { api.error('template: json replaces the whole workflow, so the Quick Start was not used'); return false; }
  if (!loaded || loaded.id !== t.id) { api.error('template: the link also names qs, which was used instead'); return false; }
  return { label: 'Quick Start', value: t.title, el: qsButton() };
}

/* ── blk.<id>.<setting>=<value> ── */
function findNode(nodes, text) {
  const id = String(text).trim(), low = id.toLowerCase();
  let hit = nodes.find((n) => n.id === id) || nodes.filter((n) => String(n.id).toLowerCase() === low)[0];
  if (!hit && low === 'start') hit = nodes.find((n) => n.type === 'start');
  return hit || null;
}
function nodeIds(nodes) {
  const l = nodes.filter((n) => n.type !== 'note').map((n) => n.id);
  return l.slice(0, 12).join(', ') + (l.length > 12 ? ', and ' + (l.length - 12) + ' more' : '');
}
// A setting by its saved key (any case), or by the key it was renamed from (settingAlias).
function settingOf(def, name) {
  const list = def.settings || [];
  const low = name.toLowerCase();
  return list.find((s) => s.key === name) || list.find((s) => s.key === (def.settingAlias || {})[name]) ||
    list.find((s) => s.key.toLowerCase() === low) || null;
}
function keysOf(def) {
  return (def.settings || []).filter((s) => !['list', 'schedule', 'file', 'code'].includes(s.kind)).map((s) => s.key);
}
const NOT_FROM_A_LINK = (def, st) => st.kind === 'code' ? 'Python code' : (def.type === 'start' && st.key === 'apiPath') ? 'the PowerFactory Python folder' : '';
const YES = /^(true|1|on|yes)$/i, NO = /^(false|0|off|no)$/i;

// Put the link's text into one setting; returns { value } for the banner or null (said through api).
function setSetting(node, def, st, sub, raw, api, key) {
  const text = String(raw).trim();
  const s = isObj(node.s) ? node.s : (node.s = {});
  const bad = (why) => { api.error(key + ': ' + why); return null; };
  const refused = NOT_FROM_A_LINK(def, st);
  if (refused) return bad(refused + ' is not taken from a link: enter it in the block yourself');
  if (st.kind === 'list' || st.kind === 'schedule') return bad((st.label || st.key) + ' is a table, which only json can set');
  if (st.kind === 'file') return bad('an attached data file cannot come from a link');
  if (st.kind === 'element') {
    const cur = isObj(s[st.key]) ? s[st.key] : {};
    const el = { cls: '', name: '', match: 'one', ...cur };
    if (sub === 'cls') {
      if (!/^[A-Za-z][A-Za-z0-9_]{1,40}$/.test(text)) return bad('"' + clip(text) + '" is not a PowerFactory class name such as ElmLne');
      el.cls = text;
    } else if (sub === 'name') {
      el.name = clip(text, 200);
    } else if (sub === 'match') {
      const hit = ['one', 'first', 'all'].find((m) => m === text.toLowerCase());
      if (!hit) return bad('"' + clip(text) + '" is not one of one, first, all');
      el.match = hit;
    } else return bad((st.label || st.key) + ' is an element: write ' + key + '.name, .cls or .match');
    s[st.key] = el;
    return { value: sub === 'cls' ? R.elementClassName(el.cls) : el[sub] };
  }
  if (sub) return bad((st.label || st.key) + ' has no part called "' + clip(sub) + '"');
  if (st.kind === 'number') {
    const n = api.number(text);
    if (!isFinite(n)) return bad('"' + clip(text) + '" is not a number');
    let used = n;
    if (typeof st.min === 'number' && used < st.min) used = st.min;
    if (typeof st.max === 'number' && used > st.max) used = st.max;
    if (used !== n) api.clamp(key, short(n), short(used));
    s[st.key] = used;
    return { value: short(used) + (st.unit ? ' ' + st.unit : '') };
  }
  if (st.kind === 'bool') {
    if (YES.test(text)) { s[st.key] = true; return { value: 'yes' }; }
    if (NO.test(text)) { s[st.key] = false; return { value: 'no' }; }
    return bad('"' + clip(text) + '" is not yes or no (true or false)');
  }
  if (st.kind === 'select') {
    const pairs = R.optionPairs(st), low = text.toLowerCase();
    const hit = pairs.find(([v]) => v === text) || pairs.find(([v]) => v.toLowerCase() === low) ||
      pairs.find(([, label]) => tidy(label) === low) || pairs.find(([, , was]) => was.map(String).includes(text));
    if (!hit) return bad('"' + clip(text) + '" is not one of ' + pairs.map(([v]) => v).join(', '));
    s[st.key] = hit[0];
    return { value: hit[1] };
  }
  // text, textarea, attr: plain text. A line break is only for a list of values.
  const v = st.kind === 'textarea' ? String(raw).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').slice(0, 4000)
    : clip(raw, 400);
  s[st.key] = v;
  return { value: v ? clip(v.replace(/\n/g, ', '), 80) : '(empty)' };
}

function block(raw0, extra, api, key) {
  const raw = dec(raw0);   // a family parser gets the value as the link wrote it, still encoded
  if (!P) { api.error(key + ': the editor did not start'); return false; }
  const rest = key.slice(4), dot = rest.indexOf('.');
  const idText = dot < 0 ? rest : rest.slice(0, dot), pname = dot < 0 ? '' : rest.slice(dot + 1).trim();
  if (!idText.trim() || !pname) { api.error(key + ': write it as blk.<block id>.<setting>, for example blk.n1.project'); return false; }
  const nodes = saved(extra).nodes;
  const node = findNode(nodes, idText);
  if (!node) { api.error(key + ': this workflow has no block "' + clip(idText, 20) + '" (it has ' + nodeIds(nodes) + ')'); return false; }
  if (pname === 'label') {
    node.label = clip(raw, 80);
    return { label: blockName(node) + ': name', value: node.label || '(default)', el: null };
  }
  const def = R.getBlock(node.type);
  if (!def) { api.error(key + ': block ' + node.id + ' is of a kind (' + clip(node.type) + ') this version does not know'); return false; }
  let st = settingOf(def, pname), sub = '';
  if (!st && pname.indexOf('.') > 0) { sub = pname.slice(pname.indexOf('.') + 1).trim().toLowerCase(); st = settingOf(def, pname.slice(0, pname.indexOf('.'))); }
  if (!st) {
    const list = keysOf(def);
    api.error(key + ': ' + R.displayName(node) + ' (' + def.type + ') has no setting "' + clip(pname) + '"' + (list.length ? ' (it has ' + list.join(', ') + ')' : ''));
    return false;
  }
  const res = setSetting(node, def, st, sub, raw, api, key);
  if (!res) return false;
  return { label: blockName(node) + ': ' + (st.label || st.key) + (st.kind === 'element' ? ' (' + sub + ')' : ''), value: res.value, el: null };
}

/* ── graph.<key>=<value>: the style of every graph the script draws ── */
const GRAPH_BOOL = Object.keys(G.defaultStyle()).filter((k) => typeof G.defaultStyle()[k] === 'boolean');
const GRAPH_KEYS = ['template', ...Object.keys(G.RANGES), ...Object.keys(G.CHOICES), ...GRAPH_BOOL];
function graphWords(k) { return 'Graph style: ' + k.replace(/_/g, ' '); }
function graph(raw, extra, api, key) {
  const k = key.slice(6).trim(), text = dec(raw).trim();
  if (!GRAPH_KEYS.includes(k)) { api.error(key + ': the graph style takes ' + GRAPH_KEYS.join(', ')); return false; }
  saved(extra);
  const style = G.normalizeStyle(extra.graph);
  let value;
  if (k === 'template') {
    const low = tidy(text), hit = G.TEMPLATES.find((t) => t.id === text || t.id.toLowerCase() === low || tidy(t.name) === low);
    if (!hit) { api.error(key + ': "' + clip(text) + '" is not one of ' + G.TEMPLATES.map((t) => t.id).join(', ')); return false; }
    extra.graph = G.styleFromTemplate(hit.id);
    return { label: 'Graph style', value: hit.name, el: null };
  }
  if (has(G.RANGES, k)) {
    const n = api.number(text);
    if (!isFinite(n)) { api.error(key + ': "' + clip(text) + '" is not a number'); return false; }
    const [lo, hi] = G.RANGES[k];
    let used = Math.min(Math.max(n, lo), hi);
    if (k === 'dpi') used = Math.round(used);
    if (used !== n) api.clamp(key, short(n), short(used));
    style[k] = used;
    value = short(used);
  } else if (has(G.CHOICES, k)) {
    const low = text.toLowerCase(), hit = G.CHOICES[k].find(([v, words]) => v === text || v.toLowerCase() === low || tidy(words) === low);
    if (!hit) { api.error(key + ': "' + clip(text) + '" is not one of ' + G.CHOICES[k].map(([v]) => v || '(blank)').join(', ')); return false; }
    style[k] = hit[0];
    value = hit[1];
  } else {
    if (YES.test(text)) style[k] = true;
    else if (NO.test(text)) style[k] = false;
    else { api.error(key + ': "' + clip(text) + '" is not yes or no (true or false)'); return false; }
    value = style[k] ? 'yes' : 'no';
  }
  extra.graph = style;
  return { label: graphWords(k), value, el: null };
}

/* ── json: the whole workflow ── */
// Blocks the link gave no place for are laid out left to right by how far they are down the wires.
function layOut(nodes, edges) {
  const place = nodes.filter((n) => !(typeof n.x === 'number' && isFinite(n.x) && typeof n.y === 'number' && isFinite(n.y)));
  if (!place.length) return;
  const depth = {};
  nodes.forEach((n) => { depth[n.id] = 0; });
  for (let pass = 0; pass < nodes.length; pass++) {
    let moved = false;
    edges.forEach((e) => {
      if (!isObj(e) || !has(depth, e.from) || !has(depth, e.to) || e.from === e.to) return;
      if (depth[e.to] < depth[e.from] + 1 && depth[e.from] + 1 < nodes.length) { depth[e.to] = depth[e.from] + 1; moved = true; }
    });
    if (!moved) break;
  }
  const rows = {};
  place.forEach((n) => {
    const d = depth[n.id] || 0, r = rows[d] || 0;
    rows[d] = r + 1;
    n.x = 80 + d * 340;
    n.y = 120 + r * 200;
  });
}
function whole(obj, extra, api) {
  if (!P) { api.error('json: the editor did not start'); return false; }
  if (!isObj(obj) || !Array.isArray(obj.nodes)) {
    api.error('json: send the workflow as {"name":"...","nodes":[...],"edges":[...]}, in the form Save writes'); return false;
  }
  const raw = clone(obj);
  delete raw.files; delete raw.view; delete raw.settings; delete raw.hash;
  if (raw.app === undefined) raw.app = W.APP_ID;
  raw.nodes = raw.nodes.filter(isObj).slice(0, MAX_NODES);
  raw.edges = (Array.isArray(raw.edges) ? raw.edges : []).filter(isObj).slice(0, MAX_EDGES);
  layOut(raw.nodes, raw.edges);
  const res = W.loadWorkflow(raw);
  if (!res.wf) { api.error('json: ' + clip((res.notes[0] || {}).msg || 'the workflow could not be read', 200)); return false; }
  const wf = res.wf, said = [];
  const say = (m) => said.push(m);
  // Only what the Builder has: a kind it does not know, a second Start and a wire that does not fit go.
  const drop = new Set();
  let start = null;
  wf.nodes.forEach((n) => {
    if (!R.getBlock(n.type)) { drop.add(n.id); say('block ' + n.id + ' is of a kind (' + clip(n.type) + ') this tool does not have, so it was left out'); }
    else if (n.type === 'start') { if (start) { drop.add(n.id); say('a workflow has one Start block, so ' + n.id + ' was left out'); } else start = n; }
  });
  wf.nodes = wf.nodes.filter((n) => !drop.has(n.id));
  wf.nodes.forEach((n) => {
    const def = R.getBlock(n.type);
    (def.settings || []).forEach((st) => {
      const what = NOT_FROM_A_LINK(def, st);
      if (!what || !isObj(n.s)) return;
      const dflt = st.default === undefined ? '' : st.default;
      if (n.s[st.key] !== undefined && JSON.stringify(n.s[st.key]) !== JSON.stringify(dflt)) {
        n.s[st.key] = clone(dflt);
        say('block ' + n.id + ': ' + what + ' is not taken from a link, so it stays at its default');
      }
    });
  });
  const byId = new Map(wf.nodes.map((n) => [n.id, n]));
  wf.edges = wf.edges.filter((e) => {
    const a = byId.get(e.from), b = byId.get(e.to);
    if (!a || !b) return false;
    const pa = R.findPort(a, e.out, 'out'), pb = R.findPort(b, e.in, 'in');
    const why = !pa ? a.id + ' has no output "' + clip(e.out, 20) + '"' : !pb ? b.id + ' has no input "' + clip(e.in, 20) + '"' : R.whyNot(pa.type, pb.type);
    if (why) { say('the wire ' + e.from + ' to ' + e.to + ' was left out: ' + why); return false; }
    return true;
  });
  if (!start) {
    const n = W.makeNode(wf, 'start', 80, 120);
    wf.nodes.unshift(n);
    say('the workflow had no Start block, so one was added');
  }
  for (const k of Object.keys(wf)) if (!['app', 'v', 'name', 'nodes', 'edges', 'view', 'graph'].includes(k)) delete wf[k];
  if (isObj(wf.graph)) wf.graph = G.normalizeStyle(wf.graph);
  // What loadWorkflow said that is not about a block or wire already named above.
  res.notes.filter((n) => (n.level === 'warning' || n.level === 'error') && !n.edgeId && !/^Missing block/.test(n.msg)).slice(0, 4).forEach((n) => say(clip(n.msg, 160)));
  said.slice(0, 8).forEach((m) => api.error('json: ' + m));
  if (said.length > 8) api.error('json: and ' + (said.length - 8) + ' more notes');
  replaceWith(extra, W.serialize(wf));
  const words = wf.nodes.filter((n) => n.type !== 'note').length;
  return { label: 'Whole workflow', value: '"' + clip(wf.name, 60) + '": ' + words + ' blocks, ' + wf.edges.length + ' wires', el: null };
}

function describe(key) {
  if (key === 'json') return { label: 'Whole workflow' };
  if (key === 'template') return { label: 'Quick Start', el: qsButton() };
  return null;
}

/* ── For the checks that type into the page as a reader would (PAGES.virtual in _ref/agent-lib.mjs) ── */
function stage(key) {
  const p = window.PFB;
  if (!p) return null;
  const w = p.store.get().wf;
  const m = /^blk\.([^.]+)\.(.+)$/.exec(key);
  if (m) {
    const node = findNode(w.nodes, m[1]);
    return node ? { w, node, param: m[2] } : null;
  }
  return /^graph\./.test(key) ? { w, graphKey: key.slice(6) } : null;
}
window.__PFB_AGENT = {
  ready: booted,
  get(key) {
    const at = stage(key);
    if (!at) return '';
    if (at.graphKey) return String(G.normalizeStyle(at.w.graph)[at.graphKey]);
    return String(R.settingsOf(at.node)[at.param]);
  },
  set(key, value) {
    const at = stage(key), p = window.PFB;
    if (!at) return;
    const n = Number(value);
    if (at.graphKey) p.store.commit({ ...at.w, graph: { ...G.normalizeStyle(at.w.graph), [at.graphKey]: n } });
    else p.store.commit(p.ops.setSetting(at.w, at.node.id, at.param, n));
    p.store.endCoalesce();
  },
};

if (window.SharedAgent) {
  window.SharedAgent.register({
    tool: 'powerfactory-scripter-builder',
    ready,
    preset,
    compact: { template },
    family: { 'blk.': block, 'graph.': graph },
    json: whole,
    describe,
    banner: '#pfbAgent',
  });
}
