/* STEP layers: which level (layer) each part of a STEP file is on.

   CAD programs that work in levels or layers (MicroStation, AutoCAD,
   Solid Edge, NX) write them to STEP as PRESENTATION_LAYER_ASSIGNMENT
   ('name', 'description', (items…)), where the items are the solids, shells
   or shape representations on that layer. OpenCascade's reader (occt.js)
   keeps the parts and their colours but drops the layers, so they are read
   here from the file's text and matched to the parts afterwards.

   A part is found from its solid by walking up the file's own links:
   solid → the shape representation listing it (→ the one a
   SHAPE_REPRESENTATION_RELATIONSHIP ties it to) → SHAPE_DEFINITION_REPRESENTATION
   → PRODUCT_DEFINITION_SHAPE → PRODUCT_DEFINITION → its formation → PRODUCT,
   whose name (or id) is the name OpenCascade gives the part's mesh. The
   solid's own colour (STYLED_ITEM → … → COLOUR_RGB) tells apart two solids of
   one product on different layers. */

// Records worth keeping: everything else in the file is geometry.
const KEEP = /^(PRESENTATION_LAYER_ASSIGNMENT|STYLED_ITEM|OVER_RIDING_STYLED_ITEM|PRESENTATION_STYLE_ASSIGNMENT|SURFACE_STYLE_USAGE|SURFACE_SIDE_STYLE|SURFACE_STYLE_FILL_AREA|FILL_AREA_STYLE|FILL_AREA_STYLE_COLOUR|COLOUR_RGB|DRAUGHTING_PRE_DEFINED_COLOUR|[A-Z_]*SHAPE_REPRESENTATION|SHAPE_REPRESENTATION_RELATIONSHIP|SHAPE_DEFINITION_REPRESENTATION|PRODUCT_DEFINITION_SHAPE|PRODUCT_DEFINITION|PRODUCT_DEFINITION_FORMATION[A-Z_]*|PRODUCT)$/;

// The named colours of STEP's draughting schema, in sRGB.
const NAMED = { red: [1, 0, 0], green: [0, 1, 0], blue: [0, 0, 1], yellow: [1, 1, 0], magenta: [1, 0, 1], cyan: [0, 1, 1], black: [0, 0, 0], white: [1, 1, 1] };

/** The arguments of one record, as nested arrays: strings as { s }, references
    as numbers (#12 → 12), numbers and enumerations as raw text, $ and * as null. */
function parseArgs(src, at) {
  const stack = [[]];
  let i = at;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '(') { const a = []; stack[stack.length - 1].push(a); stack.push(a); }
    else if (c === ')') { stack.pop(); if (stack.length === 1) break; }
    else if (c === "'") {
      let s = '';
      for (i++; i < src.length; i++) {
        if (src[i] === "'") { if (src[i + 1] === "'") { s += "'"; i++; } else break; }
        else s += src[i];
      }
      stack[stack.length - 1].push({ s: decode(s) });
    } else if (c === '#') {
      let j = i + 1;
      while (j < src.length && src.charCodeAt(j) >= 48 && src.charCodeAt(j) <= 57) j++;
      stack[stack.length - 1].push(+src.slice(i + 1, j));
      i = j - 1;
    } else if (c === '$' || c === '*') stack[stack.length - 1].push(null);
    else if (c !== ',' && c > ' ') {
      let j = i;
      while (j < src.length && !/[,()\s]/.test(src[j])) j++;
      stack[stack.length - 1].push(src.slice(i, j));
      i = j - 1;
    }
  }
  return stack[0][0] || [];
}

/* STEP strings write characters beyond ASCII as \X2\hhhh…\X0\ (UTF-16) or
   \X\hh (ISO 8859-1), and a backslash as \\. */
function decode(s) {
  if (s.indexOf('\\') < 0) return s;
  return s
    .replace(/\\X2\\([0-9A-F]+)\\X0\\/gi, (_, h) => String.fromCharCode(...(h.match(/.{4}/g) || []).map(x => parseInt(x, 16))))
    .replace(/\\X\\([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\S\\(.)/g, (_, ch) => String.fromCharCode(ch.charCodeAt(0) + 128))
    .replace(/\\\\/g, '\\');
}

const str = v => (v && typeof v === 'object' && !Array.isArray(v) ? v.s : '');
const refs = v => (Array.isArray(v) ? v.flatMap(refs) : typeof v === 'number' ? [v] : []);

/** Reads the records the layers need from a STEP file's text. */
function readRecords(text) {
  const recs = new Map();
  const data = text.indexOf('DATA;');
  const re = /#(\d+)\s*=\s*([A-Z_][A-Z0-9_]*)?\s*\(/g;
  re.lastIndex = data < 0 ? 0 : data;
  let m;
  while ((m = re.exec(text))) {
    const type = m[2];
    if (!type) continue;   // a complex entity ((A()B()…)): none of the kept kinds is one
    // Skip to the end of the record (a ';' outside a string) in any case.
    if (KEEP.test(type)) recs.set(+m[1], { type, args: parseArgs(text, m.index + m[0].length - 1) });
  }
  return recs;
}

/** The sRGB colour a STYLED_ITEM's surface styles give, or null. */
function styleColour(recs, styleRefs) {
  const seen = new Set();
  const walk = id => {
    if (seen.has(id)) return null;
    seen.add(id);
    const r = recs.get(id);
    if (!r) return null;
    if (r.type === 'COLOUR_RGB') return r.args.slice(1, 4).map(Number);
    if (r.type === 'DRAUGHTING_PRE_DEFINED_COLOUR') return NAMED[str(r.args[0]).toLowerCase()] || null;
    for (const k of refs(r.args)) { const c = walk(k); if (c) return c; }
    return null;
  };
  for (const id of styleRefs) { const c = walk(id); if (c) return c; }
  return null;
}

/**
 * The layers of a STEP file and the parts on them.
 * @param {string} text the whole file
 * @returns {{ layers: {name: string, description: string}[],
 *             parts: Map<string, {layer: string, colour: number[]|null}[]> }}
 *   parts: by product name (and id), the layer of each of its solids in file order.
 */
export function readStepLayers(text) {
  const empty = { layers: [], parts: new Map() };
  if (!text || text.indexOf('PRESENTATION_LAYER_ASSIGNMENT') < 0) return empty;
  const recs = readRecords(text);

  const layers = [];
  const layerOf = new Map();   // item → layer name
  const styled = new Map();    // item → its STYLED_ITEM's style references
  const repItems = new Map();  // representation → its items
  const repsOf = new Map();    // item → representations listing it
  const sdrOf = new Map();     // representation → product definition shape
  const linked = new Map();    // representation → representations tied to it without a placement
  for (const [id, r] of recs) {
    const a = r.args;
    if (r.type === 'PRESENTATION_LAYER_ASSIGNMENT') {
      const name = str(a[0]) || 'Layer ' + (layers.length + 1);
      if (!layers.some(l => l.name === name)) layers.push({ name, description: str(a[1]) });
      for (const it of refs(a[2])) if (!layerOf.has(it)) layerOf.set(it, name);
    } else if (r.type === 'STYLED_ITEM' || r.type === 'OVER_RIDING_STYLED_ITEM') {
      const item = a[2];
      if (typeof item === 'number' && (r.type === 'STYLED_ITEM' || !styled.has(item))) styled.set(item, refs(a[1]));
    } else if (/SHAPE_REPRESENTATION$/.test(r.type)) {
      const items = refs(a[1]);
      repItems.set(id, items);
      for (const it of items) { if (!repsOf.has(it)) repsOf.set(it, []); repsOf.get(it).push(id); }
    } else if (r.type === 'SHAPE_DEFINITION_REPRESENTATION') {
      if (typeof a[1] === 'number' && typeof a[0] === 'number') sdrOf.set(a[1], a[0]);
    } else if (r.type === 'SHAPE_REPRESENTATION_RELATIONSHIP') {
      const [p, q] = [a[2], a[3]];
      if (typeof p === 'number' && typeof q === 'number') {
        for (const [x, y] of [[p, q], [q, p]]) { if (!linked.has(x)) linked.set(x, []); linked.get(x).push(y); }
      }
    }
  }
  if (!layers.length) return empty;

  // A layer may name a STYLED_ITEM or a whole representation rather than a solid.
  for (const [it, name] of [...layerOf]) {
    const r = recs.get(it);
    if (!r) continue;
    if (r.type === 'STYLED_ITEM' && typeof r.args[2] === 'number' && !layerOf.has(r.args[2])) layerOf.set(r.args[2], name);
    if (repItems.has(it)) for (const x of repItems.get(it)) if (!layerOf.has(x)) layerOf.set(x, name);
  }

  // The product a representation belongs to: its own SDR, or one tied to it.
  const productOf = rep => {
    const seen = new Set([rep]);
    const queue = [rep];
    while (queue.length) {
      const r = queue.shift();
      const pds = sdrOf.get(r);
      if (pds != null) {
        const pd = recs.get((recs.get(pds) || { args: [] }).args[2]);
        const pdf = pd && recs.get(pd.args[2]);
        const prod = pdf && recs.get(pdf.args[2]);
        if (prod && prod.type === 'PRODUCT') return { id: str(prod.args[0]), name: str(prod.args[1]) };
      }
      for (const n of linked.get(r) || []) if (!seen.has(n)) { seen.add(n); queue.push(n); }
    }
    return null;
  };

  const parts = new Map();
  const add = (key, rec) => { if (!key) return; if (!parts.has(key)) parts.set(key, []); parts.get(key).push(rec); };
  const items = [...layerOf.keys()].filter(it => { const r = recs.get(it); return !r || !(r.type === 'STYLED_ITEM' || repItems.has(it)); }).sort((x, y) => x - y);
  for (const it of items) {
    const rec = { layer: layerOf.get(it), colour: styled.has(it) ? styleColour(recs, styled.get(it)) : null };
    for (const rep of repsOf.get(it) || []) {
      const p = productOf(rep);
      if (!p) continue;
      add(p.name, rec);
      if (p.id !== p.name) add(p.id, rec);
      break;
    }
  }
  return { layers, parts };
}

/* The linear-light colour of a mesh's part material, as OpenCascade gave it. */
function meshColour(mesh) {
  const m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  return m && m.color && !(m.userData && m.userData.o3vDefault) ? m.color : null;
}
const toLinear = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

/**
 * Tags each mesh under `root` with the layer its solid is on
 * (mesh.userData.o3vLevel). Meshes are matched by name (theirs, or their
 * group's) to the products the file lists, the k-th mesh of a product to its
 * k-th solid; where a
 * product's solids lie on more than one layer, by colour first.
 * @returns {number} how many meshes were placed on a layer
 */
export function tagLayers(root, info) {
  if (!info || !info.layers.length) return 0;
  const used = new Map();   // product name → indices taken
  let tagged = 0;
  root.traverse(o => {
    if (!o.isMesh) return;
    // A product of one solid names its mesh; one of several solids leaves
    // the meshes unnamed in a group of the product's name.
    const key = info.parts.has(o.name) ? o.name : o.parent && info.parts.has(o.parent.name) ? o.parent.name : null;
    if (key == null) return;
    const list = info.parts.get(key);
    const taken = used.get(key) || new Set();
    used.set(key, taken);
    const free = list.map((r, i) => i).filter(i => !taken.has(i));
    if (!free.length) return;
    let pick = free[0];
    if (new Set(free.map(i => list[i].layer)).size > 1) {
      const c = meshColour(o);
      if (c) {
        let best = Infinity;
        for (const i of free) {
          const k = list[i].colour;
          if (!k) continue;
          const d = Math.abs(toLinear(k[0]) - c.r) + Math.abs(toLinear(k[1]) - c.g) + Math.abs(toLinear(k[2]) - c.b);
          if (d < best - 1e-6) { best = d; pick = i; }
        }
      }
    }
    taken.add(pick);
    o.userData.o3vLevel = list[pick].layer;
    tagged++;
  });
  return tagged;
}
