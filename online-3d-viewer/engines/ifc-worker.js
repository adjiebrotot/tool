/* Reads an IFC file in a worker, with web-ifc (That Open Company, MPL-2.0,
   https://github.com/ThatOpen/engine_web-ifc) compiled to WebAssembly, and
   turns its building elements into plain arrays the page can draw.

   web-ifc parses the STEP text, follows every element's placement and
   representation (extrusions, swept solids, B-reps, booleans, openings cut
   from walls) and triangulates it. Here each placed triangle set is moved by
   its placement (in 64-bit floats) and filed under its IFC class and colour,
   so a building of 50,000 elements is a few hundred meshes, not 50,000.

   Kept in the file's own axes and unit: web-ifc turns models Y up and into
   metres, and both are undone, so sizes read in the unit the file was drawn
   in and Z points up, as in every BIM tool. Spaces and openings (volumes, not
   things) are left out by web-ifc itself.

   in:  { id, buffer, base }   (base: the web-ifc package URL, pinned)
   out: { id, ok, result } or { id, ok: false, error: 'download-failed' | 'read-failed' | message } */

let lib = null;

async function library(base) {
  if (!lib) {
    lib = (async () => {
      const W = await import(base + 'web-ifc-api.js');
      const api = new W.IfcAPI();
      api.SetWasmPath(base, true);
      await api.Init(undefined, true);   // single-threaded: the page is not cross-origin isolated
      if (api.SetLogLevel && W.LogLevel) api.SetLogLevel(W.LogLevel.LOG_LEVEL_OFF);
      return { W, api };
    })().catch(e => { lib = null; throw e; });
  }
  return lib;
}

self.onmessage = async e => {
  const { id, buffer, base } = e.data;
  let L;
  try { L = await library(base); } catch (err) { self.postMessage({ id, ok: false, error: 'download-failed', detail: String(err && err.message || err) }); return; }
  const { W, api } = L;
  let model = -1;
  try {
    model = api.OpenModel(new Uint8Array(buffer), { COORDINATE_TO_ORIGIN: false });
    if (model < 0) { self.postMessage({ id, ok: false, error: 'read-failed', detail: 'the file was not accepted' }); return; }
    const result = flatten(W, api, model);
    const transfer = [];
    for (const g of result.groups) transfer.push(g.positions.buffer, g.normals.buffer, g.indices.buffer);
    self.postMessage({ id, ok: true, result }, transfer);
  } catch (err) {
    self.postMessage({ id, ok: false, error: 'read-failed', detail: String(err && err.message || err) });
  } finally {
    if (model >= 0) try { api.CloseModel(model); } catch (err) { /* already gone */ }
  }
};

// ── Units ────────────────────────────────────────────────────────────────

const PREFIX = { EXA: 1e18, PETA: 1e15, TERA: 1e12, GIGA: 1e9, MEGA: 1e6, KILO: 1e3, HECTO: 1e2, DECA: 10, DECI: 0.1, CENTI: 0.01, MILLI: 1e-3, MICRO: 1e-6, NANO: 1e-9, PICO: 1e-12 };
const v = x => (x && typeof x === 'object' && 'value' in x ? x.value : x);

/** Metres per file length unit (from the project's unit assignment), or 1. */
function metresPerUnit(W, api, model) {
  const lengthUnit = ids => {
    for (const uid of ids) {
      let u;
      try { u = api.GetLine(model, uid, false); } catch (e) { continue; }
      if (u && v(u.UnitType) === 'LENGTHUNIT') return u;
    }
    return null;
  };
  // The project's own assignment first; any length unit in the file after that.
  let u = null;
  try {
    for (const pid of iter(api.GetLineIDsWithType(model, W.IFCPROJECT))) {
      const p = api.GetLine(model, pid, false);
      const ua = p && p.UnitsInContext && api.GetLine(model, v(p.UnitsInContext), false);
      if (ua && ua.Units) { u = lengthUnit(ua.Units.map(v)); if (u) break; }
    }
  } catch (e) { /* fall through */ }
  if (!u) u = lengthUnit([...iter(api.GetLineIDsWithType(model, W.IFCSIUNIT)), ...iter(api.GetLineIDsWithType(model, W.IFCCONVERSIONBASEDUNIT))]);
  if (!u) return 1;
  if (u.type === W.IFCSIUNIT) return v(u.Name) === 'METRE' ? (PREFIX[v(u.Prefix)] || 1) : 1;
  // A conversion-based unit (FOOT, INCH): a factor times an SI unit.
  try {
    const f = api.GetLine(model, v(u.ConversionFactor), false);
    const amount = Number(v(f.ValueComponent));
    const si = api.GetLine(model, v(f.UnitComponent), false);
    const base = si && v(si.Name) === 'METRE' ? (PREFIX[v(si.Prefix)] || 1) : 1;
    if (amount > 0) return amount * base;
  } catch (e) { /* fall through */ }
  const name = String(v(u.Name) || '').toUpperCase();
  return name.includes('INCH') ? 0.0254 : name.includes('FOOT') || name.includes('FEET') ? 0.3048 : 1;
}

function* iter(vec) {
  if (!vec) return;
  if (typeof vec.size === 'function') { for (let i = 0; i < vec.size(); i++) yield vec.get(i); return; }
  yield* vec;
}

// ── The model as triangles ───────────────────────────────────────────────

function flatten(W, api, model) {
  const mpu = metresPerUnit(W, api, model);
  const schema = api.GetModelSchema(model);
  const bins = new Map();   // "IfcWall\u0000r,g,b,a" → { type, rgba, pos: [], nrm: [], idx: [], elements: Set }
  const typeNames = new Map();
  const typeName = code => {
    if (!typeNames.has(code)) {
      let n = '';
      try { n = api.GetNameFromTypeCode(code) || ''; } catch (e) { /* unknown */ }
      typeNames.set(code, n || 'IfcProduct');
    }
    return typeNames.get(code);
  };
  let elements = 0, failed = 0;
  api.StreamAllMeshes(model, mesh => {
    let type;
    try { type = typeName(api.GetLineType(model, mesh.expressID)); } catch (e) { type = 'IfcProduct'; }
    let any = false;
    const n = mesh.geometries.size();
    for (let i = 0; i < n; i++) {
      const pg = mesh.geometries.get(i);
      let geo;
      try { geo = api.GetGeometry(model, pg.geometryExpressID); } catch (e) { failed++; continue; }
      const vd = api.GetVertexArray(geo.GetVertexData(), geo.GetVertexDataSize());
      const id = api.GetIndexArray(geo.GetIndexData(), geo.GetIndexDataSize());
      if (geo.delete) try { geo.delete(); } catch (e) { /* freed */ }
      if (!vd.length || !id.length) continue;
      const c = pg.color || { x: 0.8, y: 0.8, z: 0.8, w: 1 };
      const rgba = [c.x, c.y, c.z, c.w].map(q => Math.round(q * 1000) / 1000);
      const key = type + '\u0000' + rgba.join(',');
      let b = bins.get(key);
      if (!b) bins.set(key, b = { type, rgba, pos: [], nrm: [], idx: [], count: 0 });
      const M = pg.flatTransformation;   // column-major, Y up, in the file's unit (no scaling asked for, below)
      const base = b.count;
      for (let k = 0; k < vd.length; k += 6) {
        const x = vd[k], y = vd[k + 1], z = vd[k + 2];
        const wx = M[0] * x + M[4] * y + M[8] * z + M[12];
        const wy = M[1] * x + M[5] * y + M[9] * z + M[13];
        const wz = M[2] * x + M[6] * y + M[10] * z + M[14];
        const nx = vd[k + 3], ny = vd[k + 4], nz = vd[k + 5];
        let ax = M[0] * nx + M[4] * ny + M[8] * nz, ay = M[1] * nx + M[5] * ny + M[9] * nz, az = M[2] * nx + M[6] * ny + M[10] * nz;
        const l = Math.hypot(ax, ay, az) || 1;
        // web-ifc's Y up back to the file's Z up: (x, y, z)_ifc = (x, -z, y)_web-ifc.
        b.pos.push(wx, -wz, wy);
        b.nrm.push(ax / l, -az / l, ay / l);
      }
      for (let k = 0; k < id.length; k++) b.idx.push(base + id[k]);
      b.count += vd.length / 6;
      any = true;
    }
    if (any) elements++;
  }, false);   // false: geometry stays in the file's unit

  // Kept relative to a corner when far from the origin (site coordinates),
  // so 32-bit floats do not round the model; the page moves the group back.
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const b of bins.values()) for (let i = 0; i < b.pos.length; i++) {
    const a = i % 3;
    if (b.pos[i] < lo[a]) lo[a] = b.pos[i];
    if (b.pos[i] > hi[a]) hi[a] = b.pos[i];
  }
  const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], 1e-9);
  const far = lo.every(Number.isFinite) && Math.max(...lo.map(Math.abs)) >= 4 * span;
  const anchor = far ? lo : [0, 0, 0];
  const groups = [];
  for (const b of bins.values()) {
    const positions = new Float32Array(b.pos.length);
    for (let i = 0; i < b.pos.length; i++) positions[i] = b.pos[i] - anchor[i % 3];
    groups.push({ type: b.type, rgba: b.rgba, positions, normals: new Float32Array(b.nrm), indices: new Uint32Array(b.idx) });
  }
  return { groups, anchor, metresPerUnit: mpu, schema, elements, failed };
}
