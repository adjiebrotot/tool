/* Runs OpenCascade (occt-import-js) off the page's main thread, so a large
   STEP or IGES file does not freeze the page while it is triangulated.
   Message in:  { id, kind: 'step' | 'iges' | 'brep', buffer, params, base }
   Message out: { id, ok, result } with typed arrays (transferred), or
                { id, ok: false, error }. */
/* global occtimportjs */
let ready = null;

self.onmessage = async function (e) {
  const { id, kind, buffer, params, base } = e.data;
  try {
    if (!ready) {
      try { importScripts(base + 'occt-import-js.js'); } catch (err) { throw new Error('download-failed'); }
      ready = occtimportjs({ locateFile: name => base + name });
    }
    let occt;
    try { occt = await ready; } catch (err) { ready = null; throw new Error('download-failed'); }
    const bytes = new Uint8Array(buffer);
    const fn = kind === 'step' ? occt.ReadStepFile : kind === 'iges' ? occt.ReadIgesFile : occt.ReadBrepFile;
    const res = fn(bytes, params);
    if (!res || !res.success) { self.postMessage({ id, ok: false, error: 'read-failed' }); return; }

    const transfer = [];
    const meshes = res.meshes.map(m => {
      const pos = new Float32Array(m.attributes.position.array);
      const nor = m.attributes.normal ? new Float32Array(m.attributes.normal.array) : null;
      const idx = new Uint32Array(m.index.array);
      transfer.push(pos.buffer, idx.buffer);
      if (nor) transfer.push(nor.buffer);
      return {
        name: m.name || '',
        color: m.color || null,
        faces: (m.brep_faces || []).map(f => ({ first: f.first, last: f.last, color: f.color || null })),
        position: pos, normal: nor, index: idx,
      };
    });
    self.postMessage({ id, ok: true, result: { root: res.root, meshes } }, transfer);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
